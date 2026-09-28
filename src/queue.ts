import type { Platform } from './platform';

export interface QueueOptions {
  endpoint: string;
  batchSize: number;
  maxQueue: number;
  flushInterval: number;
  maxAgeMs?: number;
  maxAttempts?: number;
  maxInFlight?: number;
  timeout?: number;
}

interface QueuedHit {
  q: string;
  ts: number;
  /** Server errors so far (counted toward maxAttempts). */
  attempts: number;
  /** Failed sends of any kind so far (drives the backoff). */
  retries?: number;
  nextAt: number;
}

const KEY = 'queue';
/** Matomo rejects `cdt` older than 24 h without token_auth; keep a 1 h safety margin. */
const DEFAULT_MAX_AGE = 23 * 3_600_000;

function isHit(v: unknown): v is QueuedHit {
  if (typeof v !== 'object' || v === null) return false;
  const h = v as Record<string, unknown>;
  return (
    typeof h.q === 'string' &&
    typeof h.ts === 'number' &&
    typeof h.attempts === 'number' &&
    typeof h.nextAt === 'number'
  );
}

/**
 * Persisted FIFO of tracking hits sent with Matomo bulk tracking. WeChat caps concurrent requests
 * at 10, so the SDK keeps at most `maxInFlight` (2) of them pending, across all flush() calls.
 */
export class HitQueue {
  private hits: QueuedHit[];
  private readonly sending = new Set<QueuedHit>();
  private inFlight = 0;
  private timer: ReturnType<typeof setInterval> | undefined;
  private listening = false;
  private readonly maxAge: number;
  private readonly maxAttempts: number;
  private readonly maxInFlight: number;
  private readonly timeout: number;

  constructor(
    private readonly platform: Platform,
    private readonly options: QueueOptions,
  ) {
    const stored = platform.getItem<unknown>(KEY);
    this.hits = Array.isArray(stored) ? stored.filter(isHit) : [];
    this.maxAge = options.maxAgeMs ?? DEFAULT_MAX_AGE;
    this.maxAttempts = options.maxAttempts ?? 10;
    this.maxInFlight = options.maxInFlight ?? 2;
    this.timeout = options.timeout ?? 10_000;
  }

  size(): number {
    return this.hits.length;
  }

  enqueue(query: string): void {
    this.hits.push({ q: query, ts: this.platform.now(), attempts: 0, nextAt: 0 });
    const overflow = this.hits.length - this.options.maxQueue;
    if (overflow > 0) this.hits.splice(0, overflow);
    this.persist();
    if (this.hits.length >= this.options.batchSize) void this.flush();
  }

  async flush(): Promise<void> {
    this.prune();
    const sends: Array<Promise<void>> = [];
    while (this.inFlight < this.maxInFlight) {
      const now = this.platform.now();
      const batch = this.hits
        .filter((h) => h.nextAt <= now && !this.sending.has(h))
        .slice(0, this.options.batchSize);
      if (batch.length === 0) break;
      sends.push(this.send(batch));
    }
    await Promise.all(sends);
  }

  clear(): void {
    this.hits = [];
    this.persist();
  }

  start(): void {
    if (this.timer === undefined)
      this.timer = setInterval(() => void this.flush(), this.options.flushInterval);
    if (!this.listening) {
      this.listening = true;
      this.platform.onOnline(() => void this.flush());
    }
  }

  stop(): void {
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
  }

  private async send(batch: QueuedHit[]): Promise<void> {
    // Runs synchronously up to the first await, so flush() sees the new inFlight value at once.
    this.inFlight += 1;
    batch.forEach((h) => this.sending.add(h));
    const result = await this.platform.post({
      url: this.options.endpoint,
      data: JSON.stringify({ requests: batch.map((h) => `?${h.q}`) }),
      timeout: this.timeout,
    });
    this.inFlight -= 1;
    batch.forEach((h) => this.sending.delete(h));
    const status = result.status ?? 0;
    const permanent =
      !result.ok && status >= 400 && status < 500 && status !== 408 && status !== 429;
    if (result.ok || permanent) {
      this.hits = this.hits.filter((h) => !batch.includes(h));
    } else {
      const now = this.platform.now();
      for (const h of batch) {
        h.retries = (h.retries ?? 0) + 1;
        h.nextAt = now + Math.min(60_000, 1000 * 2 ** (h.retries - 1));
        // Transport failures (no HTTP status: offline, DNS, domain not allowlisted) keep the hit
        // until maxAge; only server errors (5xx, 408, 429) count toward maxAttempts.
        if (result.status !== undefined) h.attempts += 1;
      }
      this.hits = this.hits.filter((h) => h.attempts < this.maxAttempts);
    }
    this.persist();
  }

  private prune(): void {
    const oldest = this.platform.now() - this.maxAge;
    const before = this.hits.length;
    this.hits = this.hits.filter((h) => h.ts >= oldest || this.sending.has(h));
    if (this.hits.length !== before) this.persist();
  }

  private persist(): void {
    this.platform.setItem(KEY, this.hits);
  }
}
