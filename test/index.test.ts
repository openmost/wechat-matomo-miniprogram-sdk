import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTracker, type MatomoTracker } from '../src/index';
import type { LifecycleTarget } from '../src/lifecycle';
import { STORAGE_PREFIX, createPlatform } from '../src/platform';
import { createWxMock, type WxMock } from './wx-mock';

type Opts = Record<string, unknown>;
type Fn = (this: unknown, ...args: unknown[]) => unknown;

let wx: WxMock;
let now: number;
let pages: Opts[];
let app: Opts | undefined;
let target: LifecycleTarget;
let m: MatomoTracker;

const hits = (): Array<Record<string, string>> => {
  const queued = (wx.storage.get(`${STORAGE_PREFIX}queue`) ?? []) as Array<{ q: string }>;
  const fromRequests = wx.requests.flatMap((r) =>
    (JSON.parse(r.data) as { requests: string[] }).requests.map((q) => q.slice(1)),
  );
  return [...fromRequests, ...queued.map((h) => h.q)].map((q) =>
    Object.fromEntries(q.split('&').map((p) => p.split('=').map(decodeURIComponent))),
  );
};
const last = () => hits()[hits().length - 1] ?? {};

const init = (extra: Opts = {}) =>
  m.init({ trackerUrl: 'https://stats.example.cn', siteId: 3, batchSize: 50, ...extra });

const showPage = (route: string, query: Opts = {}, def: Opts = {}) => {
  target.Page?.(def);
  const p = pages[pages.length - 1];
  const ctx = { route };
  (p?.onLoad as Fn).call(ctx, query);
  (p?.onShow as Fn).call(ctx);
  return { p, ctx };
};

beforeEach(() => {
  vi.useFakeTimers();
  wx = createWxMock();
  now = new Date(2026, 8, 28, 10, 0, 0).getTime();
  pages = [];
  app = undefined;
  target = { App: (o) => (app = o), Page: (o) => pages.push(o), Component: () => undefined };
  let seed = 1;
  const random = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const platform = createPlatform(wx, { now: () => now, random });
  m = createTracker(() => ({ platform, target }));
});

describe('Matomo facade', () => {
  it('stays inert and returns false on invalid config', () => {
    expect(m.init({ trackerUrl: 'http://x', siteId: 1 })).toBe(false);
    m.trackEvent('a', 'b');
    expect(hits()).toEqual([]);
  });

  it('tracks a pageview automatically with scene attribution on the first hit', () => {
    wx.launch = { path: 'pages/index/index', scene: 1007, query: {} };
    init();
    showPage('pages/index/index', { ref: 'x' });
    expect(last()).toMatchObject({
      idsite: '3',
      action_name: 'pages/index/index',
      url: 'app://wx1234567890abcdef/pages/index/index?ref=x&mtm_campaign=wechat_share&mtm_source=wechat&mtm_medium=share&mtm_kwd=1007',
      lang: 'zh-CN',
      res: '393x852',
    });
    showPage('pages/item/item');
    expect(last().url).toBe('app://wx1234567890abcdef/pages/item/item');
  });

  it('uses pageTitles and skips excluded routes', () => {
    init({ pageTitles: { 'pages/index/index': 'Home' }, excludedRoutes: ['pages/debug/'] });
    showPage('pages/index/index');
    showPage('pages/debug/log');
    expect(hits().map((h) => h.action_name)).toEqual(['Home']);
  });

  it('does not auto track when autoTrackPages is false', () => {
    init({ autoTrackPages: false });
    showPage('pages/index/index');
    expect(hits()).toEqual([]);
    m.trackPageView('Manual', '/pages/x/x?id=1');
    expect(last()).toMatchObject({
      action_name: 'Manual',
      url: 'app://wx1234567890abcdef/pages/x/x?id=1',
    });
  });

  it('replays calls made before init in order', () => {
    m.trackEvent('Cat', 'first');
    m.setUserId('u-1');
    m.trackEvent('Cat', 'second');
    init();
    expect(hits().map((h) => [h.e_a, h.uid])).toEqual([
      ['first', undefined],
      ['second', 'u-1'],
    ]);
  });

  it('buffers at most 100 calls before init and keeps the oldest', async () => {
    for (let i = 0; i < 105; i++) m.trackEvent('Cat', String(i));
    init();
    await vi.advanceTimersByTimeAsync(0); // let the auto-flush requests settle
    await m.flush(); // send whatever is still queued
    expect(hits().map((h) => h.e_a)).toEqual(Array.from({ length: 100 }, (_, i) => String(i)));
  });

  it('ignores a second init', () => {
    init();
    expect(m.init({ trackerUrl: 'https://other.cn', siteId: 9 })).toBe(true);
    m.trackEvent('a', 'b');
    expect(last().idsite).toBe('3');
  });

  it('tracks events, site search, goals, links with validation', () => {
    init();
    m.trackEvent('Video', 'play', 'intro', 3);
    m.trackEvent('', 'invalid');
    m.trackSiteSearch('tea', 'products', 12);
    m.trackSiteSearch('');
    m.trackGoal(2, 9.99);
    m.trackGoal(0);
    m.trackLink('https://openmost.com', 'link');
    m.trackLink('https://x.cn/a.pdf', 'download');
    expect(hits()).toEqual([
      expect.objectContaining({ e_c: 'Video', e_a: 'play', e_n: 'intro', e_v: '3' }),
      expect.objectContaining({ search: 'tea', search_cat: 'products', search_count: '12' }),
      expect.objectContaining({ idgoal: '2', revenue: '9.99' }),
      expect.objectContaining({ link: 'https://openmost.com' }),
      expect.objectContaining({ download: 'https://x.cn/a.pdf' }),
    ]);
  });

  it('sends ecommerce view with the next pageview, cart updates and orders', () => {
    init({ autoTrackPages: false });
    m.setEcommerceView('SKU1', 'Tea', 'Drinks', 12.5);
    m.trackPageView('Product');
    m.addEcommerceItem('SKU1', 'Tea', 'Drinks', 12.5, 2);
    m.trackEcommerceCartUpdate(25);
    m.trackEcommerceOrder('O-1', 25, 22, 3);
    m.trackEcommerceCartUpdate(0);
    const [view, cart, order, empty] = hits();
    expect(view).toMatchObject({ _pks: 'SKU1', _pkn: 'Tea', _pkc: 'Drinks', _pkp: '12.5' });
    expect(cart).toMatchObject({
      idgoal: '0',
      revenue: '25',
      ec_items: '[["SKU1","Tea","Drinks",12.5,2]]',
    });
    expect(order).toMatchObject({ ec_id: 'O-1', ec_st: '22', ec_tx: '3' });
    expect(empty?.ec_items).toBe('[]');
    m.trackPageView('Next');
    expect(last()).not.toHaveProperty('_pks');
  });

  it('adds custom dimensions and user id to hits', () => {
    init({ customDimensions: { 1: 'vip' } });
    m.setCustomDimension(2, 'cn');
    m.setCustomDimension(1000, 'ignored');
    m.setUserId('u-9');
    m.trackEvent('a', 'b');
    expect(last()).toMatchObject({ dimension1: 'vip', dimension2: 'cn', uid: 'u-9' });
    expect(last()).not.toHaveProperty('dimension1000');
    m.deleteCustomDimension(1);
    m.resetUserId();
    m.trackEvent('a', 'c');
    expect(last()).not.toHaveProperty('dimension1');
    expect(last()).not.toHaveProperty('uid');
  });

  it('respects tracking consent', () => {
    init({ requireConsent: 'tracking' });
    m.trackEvent('a', 'before');
    expect(hits()).toEqual([]);
    m.setConsentGiven();
    m.trackEvent('a', 'after');
    expect(hits().map((h) => h.e_a)).toEqual(['after']);
    expect(wx.storage.has(`${STORAGE_PREFIX}visitor`)).toBe(true);
    const id = m.getVisitorId();
    m.forgetConsentGiven();
    expect(m.getVisitorId()).not.toBe(id);
    expect(wx.storage.has(`${STORAGE_PREFIX}visitor`)).toBe(false);
  });

  it('opt-out stops tracking and clears the queue', () => {
    init();
    wx.status = 'fail';
    m.trackEvent('a', 'queued');
    m.optOut();
    expect(m.isOptedOut()).toBe(true);
    expect(wx.storage.get(`${STORAGE_PREFIX}queue`)).toEqual([]);
    m.trackEvent('a', 'blocked');
    expect(wx.storage.get(`${STORAGE_PREFIX}queue`)).toEqual([]);
    m.optIn();
    m.trackEvent('a', 'back');
    expect(last().e_a).toBe('back');
  });

  it('adds share campaign params and a share event', () => {
    init();
    const { p, ctx } = showPage(
      'pages/item/item',
      { id: '7' },
      {
        onShareAppMessage: () => ({ title: 'T' }),
        onShareTimeline: () => ({ title: 'T', query: 'id=7' }),
      },
    );
    expect((p?.onShareAppMessage as Fn).call(ctx)).toEqual({
      title: 'T',
      path: '/pages/item/item?id=7&mtm_campaign=wechat_share&mtm_source=wechat&mtm_medium=share',
    });
    expect((p?.onShareTimeline as Fn).call(ctx)).toEqual({
      title: 'T',
      query: 'id=7&mtm_campaign=wechat_share&mtm_source=wechat&mtm_medium=share_timeline',
    });
    expect(last()).toMatchObject({ e_c: 'Share', e_a: 'share_timeline', e_n: 'pages/item/item' });
  });

  it('sends a heartbeat ping on hide after the heartbeat delay and flushes on app hide', async () => {
    init({ heartbeat: 15 });
    target.App?.({});
    const { p, ctx } = showPage('pages/index/index');
    now += 16_000;
    (p?.onHide as Fn).call(ctx);
    expect(last()).toMatchObject({ ping: '1' });
    expect(wx.requests).toHaveLength(0);
    (app?.onHide as Fn).call({});
    expect(wx.requests).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(0); // let the send settle so the queue is emptied
    expect(hits().map((h) => h.ping)).toEqual([undefined, '1']);
  });

  it('never throws into the host', () => {
    const broken = createTracker(() => {
      throw new Error('no wx');
    });
    expect(() => broken.init({ trackerUrl: 'https://x.cn', siteId: 1 })).not.toThrow();
    expect(broken.init({ trackerUrl: 'https://x.cn', siteId: 1 })).toBe(false);
    expect(() => broken.trackEvent('a', 'b')).not.toThrow();
    return expect(broken.flush()).resolves.toBeUndefined();
  });

  it('flush sends queued hits and getVisitorId is empty before init', async () => {
    expect(m.getVisitorId()).toBe('');
    init();
    m.trackEvent('a', 'b');
    await m.flush();
    expect(wx.requests).toHaveLength(1);
    expect(m.getVisitorId()).toMatch(/^[0-9a-f]{16}$/);
  });
});
