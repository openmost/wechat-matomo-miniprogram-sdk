import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_PREFIX, createPlatform, type WxRequestOptions } from '../src/platform';
import { HitQueue } from '../src/queue';
import { createWxMock } from './wx-mock';

const HOUR = 3_600_000;

function setup(options: Partial<ConstructorParameters<typeof HitQueue>[1]> = {}) {
  const wx = createWxMock();
  let now = 1_700_000_000_000;
  const platform = createPlatform(wx, { now: () => now });
  const queue = new HitQueue(platform, {
    endpoint: 'https://stats.example.cn/matomo.php',
    batchSize: 20,
    maxQueue: 500,
    flushInterval: 5000,
    ...options,
  });
  return { wx, platform, queue, advance: (ms: number) => (now += ms) };
}

const sent = (wx: ReturnType<typeof createWxMock>, i = 0) =>
  (JSON.parse(wx.requests[i]?.data ?? '{}') as { requests: string[] }).requests;

describe('HitQueue', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('keeps hits in memory only while persistence is off, and stores them once it is on', async () => {
    const { wx, platform, queue } = setup({ persist: false });
    queue.enqueue('idsite=1&a=1');
    expect(queue.size()).toBe(1);
    expect(wx.storage.has(`${STORAGE_PREFIX}queue`)).toBe(false);
    queue.setPersist(true);
    expect(wx.storage.get(`${STORAGE_PREFIX}queue`)).toHaveLength(1);
    queue.setPersist(false);
    expect(wx.storage.has(`${STORAGE_PREFIX}queue`)).toBe(false);
    wx.status = 'fail';
    await queue.flush();
    expect(wx.storage.has(`${STORAGE_PREFIX}queue`)).toBe(false);
    expect(queue.size()).toBe(1);
    wx.storage.set(`${STORAGE_PREFIX}queue`, [{ q: 'old', ts: 0, attempts: 0, nextAt: 0 }]);
    expect(
      new HitQueue(platform, {
        endpoint: 'x',
        batchSize: 1,
        maxQueue: 10,
        flushInterval: 1000,
        persist: false,
      }).size(),
    ).toBe(1);
  });

  it('sends queued hits in one bulk request and empties the queue', async () => {
    const { wx, queue } = setup();
    queue.enqueue('idsite=1&a=1');
    queue.enqueue('idsite=1&a=2');
    await queue.flush();
    expect(wx.requests).toHaveLength(1);
    expect(wx.requests[0]?.url).toBe('https://stats.example.cn/matomo.php');
    expect(sent(wx)).toEqual(['?idsite=1&a=1', '?idsite=1&a=2']);
    expect(queue.size()).toBe(0);
    expect(wx.storage.has(`${STORAGE_PREFIX}queue`)).toBe(false);
  });

  it('sends at most batchSize hits per request and maxInFlight requests per flush', async () => {
    const big = setup({ batchSize: 50, maxInFlight: 2, maxQueue: 100 });
    ['a', 'b', 'c', 'd', 'e'].forEach((q) => big.queue.enqueue(q));
    const small = new HitQueue(big.platform, {
      endpoint: 'https://stats.example.cn/matomo.php',
      batchSize: 2,
      maxInFlight: 2,
      maxQueue: 100,
      flushInterval: 5000,
    });
    await small.flush();
    expect(big.wx.requests.map((_, i) => sent(big.wx, i))).toEqual([
      ['?a', '?b'],
      ['?c', '?d'],
    ]);
    expect(small.size()).toBe(1);
  });

  it('keeps at most maxInFlight requests pending across flush calls', async () => {
    // Partial batches (1 hit each, batchSize 2) so a hit-count check would not catch the overflow.
    const { wx, queue } = setup({ batchSize: 2, maxInFlight: 2 });
    const pending: Array<() => void> = [];
    wx.request = vi.fn((o: WxRequestOptions) => {
      wx.requests.push({ url: o.url, data: o.data, header: o.header });
      pending.push(() => o.success({ statusCode: 200 }));
    });
    queue.enqueue('a');
    void queue.flush(); // e.g. interval tick → request 1 pending with ['?a']
    queue.enqueue('b'); // size 2 → auto flush → request 2 pending with ['?b']
    queue.enqueue('c'); // size 3 → auto flush → blocked, 2 already in flight
    void queue.flush(); // e.g. network back → still blocked
    expect(wx.requests).toHaveLength(2);
    pending.splice(0).forEach((respond) => respond());
    await vi.advanceTimersByTimeAsync(0); // let the settled sends resume
    const third = queue.flush(); // resolves only once its request is answered
    expect(wx.requests).toHaveLength(3);
    expect(sent(wx, 2)).toEqual(['?c']);
    pending.splice(0).forEach((respond) => respond());
    await third;
    expect(queue.size()).toBe(0);
  });

  it('auto flushes when batchSize is reached', () => {
    const { wx, queue } = setup({ batchSize: 2 });
    queue.enqueue('a');
    expect(wx.requests).toHaveLength(0);
    queue.enqueue('b');
    expect(wx.requests).toHaveLength(1);
  });

  it('retries with exponential backoff on network failure', async () => {
    const { wx, queue, advance } = setup();
    wx.status = 'fail';
    queue.enqueue('a');
    await queue.flush();
    expect(queue.size()).toBe(1);
    await queue.flush(); // not due yet (1 s backoff)
    expect(wx.requests).toHaveLength(1);
    advance(1000);
    wx.status = 200;
    await queue.flush();
    expect(wx.requests).toHaveLength(2);
    expect(queue.size()).toBe(0);
  });

  it('retries 5xx and 429 but drops other 4xx', async () => {
    const { wx, queue, advance } = setup();
    wx.status = 503;
    queue.enqueue('a');
    await queue.flush();
    expect(queue.size()).toBe(1);
    advance(1000);
    wx.status = 429;
    await queue.flush();
    expect(queue.size()).toBe(1);
    advance(2000);
    wx.status = 400;
    await queue.flush();
    expect(queue.size()).toBe(0);
  });

  it('drops a hit after maxAttempts server errors', async () => {
    const { wx, queue, advance } = setup({ maxAttempts: 2 });
    wx.status = 503;
    queue.enqueue('a');
    await queue.flush();
    advance(60_000);
    await queue.flush();
    expect(queue.size()).toBe(0);
  });

  it('keeps hits through a long offline period without counting attempts', async () => {
    const { wx, queue, advance } = setup({ maxAttempts: 2 });
    wx.status = 'fail'; // no HTTP status: offline, DNS, domain not allowlisted
    queue.enqueue('a');
    for (let i = 0; i < 30; i++) {
      await queue.flush();
      advance(60_000);
    }
    expect(wx.requests).toHaveLength(30);
    expect(queue.size()).toBe(1);
    wx.status = 200;
    await queue.flush();
    expect(sent(wx, 30)).toEqual(['?a']);
    expect(queue.size()).toBe(0);
  });

  it('still backs off exponentially on transport failures', async () => {
    const { wx, queue, advance } = setup();
    wx.status = 'fail';
    queue.enqueue('a');
    await queue.flush(); // retry 1 -> wait 1 s
    advance(1000);
    await queue.flush(); // retry 2 -> wait 2 s
    advance(1000);
    await queue.flush(); // not due yet
    expect(wx.requests).toHaveLength(2);
    advance(1000);
    await queue.flush();
    expect(wx.requests).toHaveLength(3);
  });

  it('drops hits older than 23 hours', async () => {
    const { wx, queue, advance } = setup();
    wx.status = 'fail';
    queue.enqueue('old');
    await queue.flush();
    advance(23 * HOUR + 1);
    queue.enqueue('new');
    wx.status = 200;
    await queue.flush();
    expect(sent(wx, wx.requests.length - 1)).toEqual(['?new']);
  });

  it('ages a hit from the time it was tracked when given one', async () => {
    const { wx, platform, queue } = setup();
    queue.enqueue('stale', platform.now() - 23 * HOUR - 1);
    queue.enqueue('fresh');
    await queue.flush();
    expect(sent(wx)).toEqual(['?fresh']);
  });

  it('caps the queue by dropping the oldest hits', () => {
    const { queue, wx } = setup({ maxQueue: 10, batchSize: 50 });
    wx.status = 'fail';
    for (let i = 0; i < 12; i++) queue.enqueue(`h${i}`);
    expect(queue.size()).toBe(10);
    const stored = wx.storage.get(`${STORAGE_PREFIX}queue`) as Array<{ q: string }>;
    expect(stored[0]?.q).toBe('h2');
  });

  it('restores persisted hits', async () => {
    const { wx, platform, queue } = setup();
    wx.status = 'fail';
    queue.enqueue('kept');
    const restored = new HitQueue(platform, {
      endpoint: 'https://stats.example.cn/matomo.php',
      batchSize: 20,
      maxQueue: 500,
      flushInterval: 5000,
    });
    expect(restored.size()).toBe(1);
  });

  it('ignores corrupt persisted queue', () => {
    const { wx, platform } = setup();
    wx.storage.set(`${STORAGE_PREFIX}queue`, 'abc');
    const q = new HitQueue(platform, {
      endpoint: 'e',
      batchSize: 1,
      maxQueue: 10,
      flushInterval: 1000,
    });
    expect(q.size()).toBe(0);
    wx.storage.set(`${STORAGE_PREFIX}queue`, [
      { q: 1 },
      null,
      { q: 'ok', ts: 1, attempts: 0, nextAt: 0 },
    ]);
    expect(
      new HitQueue(platform, {
        endpoint: 'e',
        batchSize: 1,
        maxQueue: 10,
        flushInterval: 1000,
      }).size(),
    ).toBe(1);
  });

  it('flushes on interval and when the network comes back', async () => {
    const { wx, queue } = setup({ batchSize: 50 });
    queue.start();
    queue.enqueue('a');
    await vi.advanceTimersByTimeAsync(5000);
    expect(wx.requests).toHaveLength(1);
    queue.enqueue('b');
    wx.emitNetwork(true);
    expect(wx.requests).toHaveLength(2);
    queue.stop();
    queue.enqueue('c');
    await vi.advanceTimersByTimeAsync(10_000);
    expect(wx.requests).toHaveLength(2);
  });

  it('removes the stale persisted queue when persisting fails', () => {
    const { wx, queue } = setup();
    wx.status = 'fail';
    queue.enqueue('a');
    expect(wx.storage.has(`${STORAGE_PREFIX}queue`)).toBe(true);
    wx.setStorageSync = vi.fn(() => {
      throw new Error('setStorageSync:fail exceed max size');
    });
    queue.enqueue('b');
    expect(wx.storage.has(`${STORAGE_PREFIX}queue`)).toBe(false);
    expect(queue.size()).toBe(2);
  });

  it('clear empties memory and storage', () => {
    const { wx, queue } = setup();
    wx.status = 'fail';
    queue.enqueue('a');
    queue.clear();
    expect(queue.size()).toBe(0);
    expect(wx.storage.has(`${STORAGE_PREFIX}queue`)).toBe(false);
  });

  it('removes the stored queue once every hit is sent', async () => {
    const { wx, queue, advance } = setup();
    wx.status = 'fail';
    queue.enqueue('a');
    await queue.flush();
    expect(wx.storage.has(`${STORAGE_PREFIX}queue`)).toBe(true);
    wx.status = 200;
    advance(1000);
    await queue.flush();
    expect(wx.storage.has(`${STORAGE_PREFIX}queue`)).toBe(false);
  });

  it('holds hits while paused, even on interval, network and batch triggers', async () => {
    const { wx, queue } = setup({ batchSize: 1, paused: true });
    queue.start();
    queue.enqueue('a');
    await queue.flush();
    await vi.advanceTimersByTimeAsync(10_000);
    wx.emitNetwork(true);
    expect(wx.requests).toHaveLength(0);
    queue.pause(false);
    await queue.flush();
    expect(sent(wx)).toEqual(['?a']);
    queue.pause(true);
    queue.enqueue('b');
    await queue.flush();
    expect(wx.requests).toHaveLength(1);
    queue.stop();
  });

  it('loads a stored queue into memory only when persistence is off, or ignores it with load: false', () => {
    const { wx, platform } = setup();
    const opts = { endpoint: 'e', batchSize: 5, maxQueue: 10, flushInterval: 1000 };
    const hit = { q: 'old', ts: 1, attempts: 0, nextAt: 0 };
    wx.storage.set(`${STORAGE_PREFIX}queue`, [hit]);
    expect(new HitQueue(platform, { ...opts, persist: false }).size()).toBe(1);
    expect(wx.storage.has(`${STORAGE_PREFIX}queue`)).toBe(false);
    wx.storage.set(`${STORAGE_PREFIX}queue`, [hit]);
    expect(new HitQueue(platform, { ...opts, persist: false, load: false }).size()).toBe(0);
    expect(wx.storage.has(`${STORAGE_PREFIX}queue`)).toBe(false);
  });
});
