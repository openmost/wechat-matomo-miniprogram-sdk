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
      res: '1179x2556',
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
    expect(hits().map((h) => h.e_a)).toEqual(['before', 'after']);
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
    expect(wx.storage.has(`${STORAGE_PREFIX}queue`)).toBe(false);
    m.trackEvent('a', 'blocked');
    expect(wx.storage.has(`${STORAGE_PREFIX}queue`)).toBe(false);
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
    const shares = hits().filter((h) => h.e_c === 'Share');
    expect(shares.map((h) => [h.e_a, h.e_n])).toEqual([
      ['Share to chat', 'share'],
      ['Share to Moments', 'share'],
    ]);
    expect(last().url).toContain('pages/item/item');
  });

  it('keeps the page query on a timeline share when the host returns no query', () => {
    init();
    const { p, ctx } = showPage(
      'pages/item/item',
      { id: '42' },
      { onShareTimeline: () => ({ title: 'T' }) },
    );
    expect((p?.onShareTimeline as Fn).call(ctx)).toEqual({
      title: 'T',
      query: 'id=42&mtm_campaign=wechat_share&mtm_source=wechat&mtm_medium=share_timeline',
    });
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

  it('does not re-attribute a hot start within the same visit, but does after a new visit', () => {
    init(); // default wx-mock launch: scene 1001 -> no attribution
    showPage('pages/index/index');
    expect(last().url).not.toContain('mtm_');

    target.App?.({});
    wx.launch = { ...wx.launch, scene: 1038 }; // hot start: returning from another mini program
    (app?.onShow as Fn).call({});
    showPage('pages/item/item'); // same visit: must not pick up the hot-start scene mid-visit
    expect(last().url).not.toContain('mtm_');

    now += 31 * 60 * 1000; // past the 30 min visit timeout
    (app?.onShow as Fn).call({});
    showPage('pages/other/other'); // new visit: attribution comes from the latest enter options
    expect(last().url).toBe(
      'app://wx1234567890abcdef/pages/other/other?mtm_campaign=wechat_miniprogram&mtm_source=wechat&mtm_medium=miniprogram&mtm_kwd=1038',
    );
  });

  it('skips a heartbeat ping that would open a new visit, and never attributes a ping', () => {
    init({ heartbeat: 15 });
    target.App?.({});
    const { p, ctx } = showPage('pages/index/index');

    now += 31 * 60 * 1000; // a ping here would silently open a new visit; must be skipped instead
    (p?.onHide as Fn).call(ctx);
    expect(hits()).toHaveLength(1); // still just the initial pageview

    // Opening the new visit for real (a pageview), then a hot start mid-visit, must not leak
    // campaign attribution onto the next heartbeat ping.
    const { p: p2, ctx: ctx2 } = showPage('pages/other/other');
    wx.launch = { ...wx.launch, scene: 1038 };
    (app?.onShow as Fn).call({});
    now += 16_000; // heartbeat due again, still well inside the (fresh) visit window
    (p2?.onHide as Fn).call(ctx2);
    expect(last()).toMatchObject({ ping: '1' });
    expect(last().url).not.toContain('mtm_');
  });

  it('keeps a pending ecommerce view when the pageview it belongs to is blocked', () => {
    init({ autoTrackPages: false });
    m.optOut();
    m.setEcommerceView('SKU9', 'Coffee', 'Drinks', 8);
    m.trackPageView('Blocked');
    expect(hits()).toEqual([]);
    m.optIn();
    m.trackPageView('Shown');
    expect(last()).toMatchObject({
      action_name: 'Shown',
      _pks: 'SKU9',
      _pkn: 'Coffee',
      _pkc: 'Drinks',
      _pkp: '8',
    });
  });

  it('links non-pageview hits to the last pageview with its pv_id', () => {
    init({ heartbeat: 15 });
    m.trackEvent('a', 'no-page-yet');
    const { p, ctx } = showPage('pages/index/index');
    m.trackEvent('a', 'b');
    m.trackGoal(1);
    m.addEcommerceItem('SKU1', 'Tea', 'Drinks', 1, 1);
    m.trackEcommerceCartUpdate(1);
    now += 16_000;
    (p?.onHide as Fn).call(ctx);
    const [before, view, ...rest] = hits();
    expect(before).not.toHaveProperty('pv_id');
    expect(view?.pv_id).toMatch(/^[A-Za-z0-9]{6}$/);
    expect(rest).toHaveLength(4);
    for (const hit of rest) expect(hit.pv_id).toBe(view?.pv_id);
    showPage('pages/item/item');
    m.trackEvent('a', 'c');
    const [next, event] = hits().slice(-2);
    expect(next?.pv_id).not.toBe(view?.pv_id);
    expect(event?.pv_id).toBe(next?.pv_id);
  });

  it('tracks nothing and persists nothing for the WeChat crawler (scene 1129)', async () => {
    wx.launch = { path: 'pages/index/index', scene: 1129, query: {} };
    init();
    showPage('pages/index/index');
    m.trackEvent('a', 'b');
    await m.flush();
    expect(hits()).toEqual([]);
    expect([...wx.storage.keys()].filter((k) => k.startsWith(STORAGE_PREFIX))).toEqual([]);
  });

  it('forgetConsentGiven blocks a cookie-consent tracker until consent is given again', async () => {
    init({ requireConsent: 'cookie' });
    m.setConsentGiven();
    m.trackEvent('a', 'before');
    m.forgetConsentGiven();
    m.trackEvent('a', 'withheld');
    await m.flush();
    // Nothing is sent while tracking consent is pending, not even hits queued before.
    expect(hits()).toEqual([]);
    m.setConsentGiven();
    await m.flush();
    expect(hits().map((h) => h.e_a)).toEqual(['before', 'withheld']);
  });

  it('starts no queue and writes no storage when launched by the crawler (scene 1129)', async () => {
    wx.launch = { path: 'pages/index/index', scene: 1129, query: {} };
    const timers = vi.getTimerCount();
    init();
    m.setConsentGiven();
    m.optOut();
    m.optIn();
    m.forgetConsentGiven();
    m.trackEvent('a', 'b');
    await m.flush();
    expect(vi.getTimerCount()).toBe(timers);
    expect(wx.onNetworkStatusChange).not.toHaveBeenCalled();
    expect(wx.setStorageSync).not.toHaveBeenCalled();
    expect(wx.removeStorageSync).not.toHaveBeenCalled();
    expect(hits()).toEqual([]);
  });

  it('drops NaN numeric params instead of sending the literal "NaN"', () => {
    init();
    m.trackEvent('a', 'b', undefined, NaN);
    m.trackSiteSearch('tea', undefined, NaN);
    m.trackGoal(2, NaN);
    const [event, search, goal] = hits();
    expect(event).not.toHaveProperty('e_v');
    expect(search).not.toHaveProperty('search_count');
    expect(goal).not.toHaveProperty('revenue');
  });

  it('does not leave a running queue when installLifecycle throws', () => {
    const throwingTarget: LifecycleTarget = {
      get App(): never {
        throw new Error('boom');
      },
    };
    let seed = 1;
    const random = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    const platform = createPlatform(wx, { now: () => now, random });
    const broken = createTracker(() => ({ platform, target: throwingTarget }));
    const before = vi.getTimerCount();
    expect(broken.init({ trackerUrl: 'https://stats.example.cn', siteId: 3, batchSize: 50 })).toBe(
      false,
    );
    expect(vi.getTimerCount()).toBe(before);
  });

  it('never tracks anything while disabled', () => {
    init({ disabled: true });
    m.trackEvent('a', 'b');
    m.trackPageView();
    expect(hits()).toEqual([]);
  });

  it('does not track a Share event when trackShares is false, but still adds campaign params', () => {
    init({ trackShares: false });
    const { p, ctx } = showPage(
      'pages/item/item',
      {},
      { onShareAppMessage: () => ({ title: 'T' }) },
    );
    const result = (p?.onShareAppMessage as Fn).call(ctx);
    expect(result).toEqual({
      title: 'T',
      path: '/pages/item/item?mtm_campaign=wechat_share&mtm_source=wechat&mtm_medium=share',
    });
    expect(hits().some((h) => h.e_c === 'Share')).toBe(false);
  });

  it('adds no campaign params when shareCampaign is false, but still tracks the share event', () => {
    init({ shareCampaign: false });
    const { p, ctx } = showPage(
      'pages/item/item',
      {},
      { onShareAppMessage: () => ({ title: 'T' }) },
    );
    const result = (p?.onShareAppMessage as Fn).call(ctx);
    expect(result).toEqual({ title: 'T' });
    expect(last()).toMatchObject({
      e_c: 'Share',
      e_a: 'Share to chat',
      e_n: 'share',
    });
  });

  it('cookie consent sends hits immediately but persists the visitor only once given', async () => {
    init({ requireConsent: 'cookie' });
    m.trackEvent('a', 'b');
    await m.flush();
    expect(hits().map((h) => h.e_a)).toEqual(['b']);
    expect(wx.storage.has(`${STORAGE_PREFIX}visitor`)).toBe(false);
    m.setConsentGiven();
    expect(wx.storage.has(`${STORAGE_PREFIX}visitor`)).toBe(true);
  });

  it('requireConsent() gates a previously unrestricted tracker at runtime', async () => {
    init();
    m.trackEvent('a', 'before');
    m.requireConsent();
    m.trackEvent('a', 'blocked');
    await m.flush();
    expect(hits()).toEqual([]); // 'before' is held in memory
    m.setConsentGiven();
    m.trackEvent('a', 'after');
    await m.flush();
    expect(hits().map((h) => h.e_a)).toEqual(['before', 'blocked', 'after']);
  });

  it('keeps hits in memory until consent and sends them in order with their original time', () => {
    init({ requireConsent: 'tracking' });
    m.trackEvent('a', 'first');
    now += 60_000;
    m.trackEvent('a', 'second');
    expect(hits()).toEqual([]);
    expect(wx.storage.has(`${STORAGE_PREFIX}queue`)).toBe(false); // never persisted
    now += 60_000;
    m.setConsentGiven();
    const sentHits = hits();
    expect(sentHits.map((h) => h.e_a)).toEqual(['first', 'second']);
    const start = Math.floor(new Date(2026, 8, 28, 10, 0, 0).getTime() / 1000);
    expect(sentHits.map((h) => Number(h.cdt))).toEqual([start, start + 60]);
    expect(new Set(sentHits.map((h) => h._id))).toEqual(new Set([m.getVisitorId()]));
  });

  it('keeps at most 100 hits before consent, dropping the oldest', async () => {
    init({ requireConsent: 'tracking' });
    for (let i = 0; i < 105; i++) m.trackEvent('Cat', String(i));
    m.setConsentGiven();
    await vi.advanceTimersByTimeAsync(0); // let the auto-flush requests settle
    await m.flush();
    expect(hits().map((h) => h.e_a)).toEqual(Array.from({ length: 100 }, (_, i) => String(i + 5)));
  });

  it('drops hits kept before consent on optOut and forgetConsentGiven', () => {
    init({ requireConsent: 'tracking' });
    m.trackEvent('a', 'opted-out');
    m.optOut();
    m.optIn();
    m.trackEvent('a', 'forgotten');
    m.forgetConsentGiven();
    m.setConsentGiven();
    expect(hits()).toEqual([]);
  });

  it('forgetConsentGiven stops tracking even without requireConsent, like Matomo JS', async () => {
    init();
    m.trackEvent('a', 'before');
    m.forgetConsentGiven();
    m.trackEvent('a', 'withheld');
    await m.flush();
    expect(hits()).toEqual([]);
    m.setConsentGiven();
    await m.flush();
    expect(hits().map((h) => h.e_a)).toEqual(['before', 'withheld']);
  });

  const newTracker = () => {
    const platform = createPlatform(wx, { now: () => now });
    return createTracker(() => ({ platform, target }));
  };
  const stored = () => [...wx.storage.keys()].filter((k) => k.startsWith(STORAGE_PREFIX));

  it('writes nothing to storage before cookie consent, but still sends hits', async () => {
    init({ requireConsent: 'cookie' });
    showPage('pages/index/index');
    m.trackEvent('a', 'b');
    await m.flush();
    expect(hits().map((h) => h.e_a ?? 'pv')).toEqual(['pv', 'b']);
    expect(wx.setStorageSync).not.toHaveBeenCalled();
    expect(m.areCookiesEnabled()).toBe(false);
    const id = m.getVisitorId();
    wx.status = 'fail';
    m.trackEvent('a', 'offline');
    m.setCookieConsentGiven();
    expect(m.areCookiesEnabled()).toBe(true);
    expect(m.getVisitorId()).toBe(id);
    expect(stored()).toEqual([`${STORAGE_PREFIX}visitor`, `${STORAGE_PREFIX}queue`]);
    expect(wx.storage.get(`${STORAGE_PREFIX}visitor`)).toMatchObject({ id });
    // Session only: nothing remembered, a new launch asks again.
    const next = newTracker();
    next.init({ trackerUrl: 'https://s.cn', siteId: 1, requireConsent: 'cookie' });
    expect(next.areCookiesEnabled()).toBe(false);
  });

  it('forgetCookieConsentGiven wipes stored visitor data but keeps sending', async () => {
    init();
    wx.status = 'fail';
    m.trackEvent('a', 'b');
    await m.flush();
    expect(stored()).toContain(`${STORAGE_PREFIX}visitor`);
    const id = m.getVisitorId();
    m.forgetCookieConsentGiven();
    expect(m.areCookiesEnabled()).toBe(false);
    expect(stored()).toEqual([]);
    expect(m.getVisitorId()).toBe(id);
    wx.status = 200;
    m.trackEvent('a', 'after');
    await m.flush();
    expect(stored()).toEqual([]);
    expect(hits().map((h) => h.e_a)).toEqual(['b', 'after']);
  });

  it('requireCookieConsent at runtime stops storing until cookie consent', () => {
    init();
    m.trackEvent('a', 'b');
    m.requireCookieConsent();
    expect(stored()).toEqual([]);
    m.rememberCookieConsentGiven();
    expect(stored()).toContain(`${STORAGE_PREFIX}visitor`);
    expect(stored()).toContain(`${STORAGE_PREFIX}cookie_consent`);
  });

  it('remembers cookie consent across launches until it expires', () => {
    init({ requireConsent: 'cookie' });
    m.rememberCookieConsentGiven(1);
    const next = newTracker();
    next.init({ trackerUrl: 'https://s.cn', siteId: 1, requireConsent: 'cookie' });
    expect(next.areCookiesEnabled()).toBe(true);
    now += 3_600_000;
    const later = newTracker();
    later.init({ trackerUrl: 'https://s.cn', siteId: 1, requireConsent: 'cookie' });
    expect(later.areCookiesEnabled()).toBe(false);
  });

  it('setConsentGiven lasts for the session; rememberConsentGiven survives a relaunch', async () => {
    init({ requireConsent: 'tracking' });
    m.setConsentGiven();
    expect(m.hasRememberedConsent()).toBe(false);
    expect(m.getRememberedConsent()).toBeNull();
    const session = newTracker();
    session.init({ trackerUrl: 'https://s.cn', siteId: 1, requireConsent: 'tracking' });
    session.trackEvent('s', 'withheld');
    await session.flush();
    expect(hits().some((h) => h.e_c === 's')).toBe(false);
    m.rememberConsentGiven(24);
    expect(m.hasRememberedConsent()).toBe(true);
    expect(m.getRememberedConsent()).toBe(now);
    const next = newTracker();
    next.init({ trackerUrl: 'https://s.cn', siteId: 1, requireConsent: 'tracking' });
    expect(next.hasRememberedConsent()).toBe(true);
    next.trackEvent('n', 'sent');
    await next.flush();
    expect(hits().some((h) => h.e_c === 'n')).toBe(true);
    now += 24 * 3_600_000;
    expect(m.hasRememberedConsent()).toBe(false);
    const expired = newTracker();
    expired.init({ trackerUrl: 'https://s.cn', siteId: 1, requireConsent: 'tracking' });
    expired.trackEvent('e', 'withheld');
    await expired.flush();
    expect(hits().some((h) => h.e_c === 'e')).toBe(false);
  });

  it('forgetConsentGiven clears remembered tracking and cookie consent', () => {
    init({ requireConsent: 'tracking' });
    m.rememberConsentGiven();
    m.rememberCookieConsentGiven();
    m.forgetConsentGiven();
    expect(m.hasRememberedConsent()).toBe(false);
    expect(m.areCookiesEnabled()).toBe(false);
    expect(stored()).toEqual([`${STORAGE_PREFIX}consent_removed`]);
  });

  it('optOut wins over remembered consent', () => {
    init({ requireConsent: 'tracking' });
    m.rememberConsentGiven();
    m.optOut();
    m.trackEvent('a', 'b');
    expect(hits()).toEqual([]);
  });

  it('buffers every consent call made before init', () => {
    expect(m.hasRememberedConsent()).toBe(false);
    expect(m.getRememberedConsent()).toBeNull();
    expect(m.areCookiesEnabled()).toBe(false);
    m.requireCookieConsent();
    m.setCookieConsentGiven();
    m.forgetCookieConsentGiven();
    m.rememberConsentGiven(2);
    init();
    expect(m.hasRememberedConsent()).toBe(true);
    expect(m.areCookiesEnabled()).toBe(true);

    m.forgetConsentGiven();
    const other = newTracker();
    other.requireConsent();
    other.rememberCookieConsentGiven();
    other.init({ trackerUrl: 'https://s.cn', siteId: 1 });
    expect(other.areCookiesEnabled()).toBe(false); // tracking consent still pending
  });

  const TRACKING = { trackerUrl: 'https://s.cn', siteId: 1, requireConsent: 'tracking' } as const;
  const COOKIE = { trackerUrl: 'https://s.cn', siteId: 1, requireConsent: 'cookie' } as const;
  const sent = () =>
    wx.requests.flatMap((r) => (JSON.parse(r.data) as { requests: string[] }).requests);

  it('never sends, nor keeps, a stored queue while tracking consent is pending', async () => {
    init({ requireConsent: 'tracking' });
    m.setConsentGiven();
    wx.status = 'fail';
    m.trackEvent('a', 'offline');
    await m.flush();
    expect(stored()).toContain(`${STORAGE_PREFIX}queue`);
    wx.status = 200;
    wx.requests = [];
    for (let i = 0; i < 3; i++) {
      vi.clearAllTimers(); // the previous launch has ended
      newTracker().init(TRACKING);
      await vi.advanceTimersByTimeAsync(10_000);
    }
    expect(wx.requests).toEqual([]);
    expect(stored()).not.toContain(`${STORAGE_PREFIX}queue`);
  });

  it('sends a stored hit once when session-only consent is given again at each launch', async () => {
    init({ requireConsent: 'tracking' });
    m.setConsentGiven();
    wx.status = 'fail';
    m.trackEvent('a', 'offline');
    await m.flush();
    wx.status = 200;
    wx.requests = [];
    now += 60_000; // past the retry backoff
    for (let i = 0; i < 3; i++) {
      vi.clearAllTimers(); // the previous launch has ended
      const t = newTracker();
      t.init(TRACKING);
      await t.flush();
      await vi.advanceTimersByTimeAsync(10_000);
      expect(sent().filter((q) => q.includes('e_a=offline')).length).toBe(i === 0 ? 0 : 1);
      t.setConsentGiven();
      await t.flush();
    }
    expect(sent().filter((q) => q.includes('e_a=offline')).length).toBe(1);
    expect(stored()).not.toContain(`${STORAGE_PREFIX}queue`);
  });

  it('keeps the stored visitor while tracking consent is pending, without writing it', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) {
      const t = newTracker();
      t.init(TRACKING);
      const before = wx.storage.get(`${STORAGE_PREFIX}visitor`);
      now += 3_600_000;
      t.trackEvent('a', 'pending');
      expect(wx.storage.get(`${STORAGE_PREFIX}visitor`)).toEqual(before);
      t.setConsentGiven();
      await t.flush();
      ids.push(t.getVisitorId());
    }
    expect(new Set(ids).size).toBe(1);
    expect(new Set(sent().map((q) => /_id=(\w+)/.exec(q)?.[1]))).toEqual(new Set(ids));
    expect(sent().map((q) => /_idvc=(\d+)/.exec(q)?.[1])).toEqual(['1', '2', '3', '4']);
  });

  it('runtime requireConsent() keeps the stored visitor', () => {
    init();
    m.trackEvent('a', 'b');
    m.requireConsent();
    expect(stored()).toContain(`${STORAGE_PREFIX}visitor`);
  });

  it('wipes stored visitor data at launch when cookie consent is required and not given', async () => {
    // Remembered cookie consent that has expired by the next launch.
    const t = newTracker();
    t.init(COOKIE);
    t.rememberCookieConsentGiven(1);
    wx.status = 'fail';
    t.trackEvent('a', 'offline');
    await t.flush();
    const id = t.getVisitorId();
    expect(stored()).toEqual(expect.arrayContaining([`${STORAGE_PREFIX}visitor`]));
    now += 3_600_000;
    wx.status = 200;
    wx.requests = [];
    const next = newTracker();
    next.init(COOKIE);
    expect(stored()).toEqual([]);
    expect(next.getVisitorId()).not.toBe(id);
    await next.flush();
    expect(sent()).toEqual([]);

    // requireConsent: 'cookie' newly set in the config.
    init();
    m.trackEvent('a', 'b');
    expect(stored()).toContain(`${STORAGE_PREFIX}visitor`);
    newTracker().init(COOKIE);
    expect(stored()).toEqual([]);
  });

  it('optOut removes visitor and queue data and disables storage until optIn', async () => {
    init();
    wx.status = 'fail';
    m.trackEvent('a', 'b');
    await m.flush();
    const id = m.getVisitorId();
    m.optOut();
    expect(stored()).toEqual([`${STORAGE_PREFIX}optout`]);
    expect(m.areCookiesEnabled()).toBe(false);
    expect(m.getVisitorId()).not.toBe(id);
    m.trackEvent('a', 'blocked');
    expect(stored()).toEqual([`${STORAGE_PREFIX}optout`]);
    // A stale visitor left by an older build is wiped at the next launch.
    wx.storage.set(`${STORAGE_PREFIX}visitor`, { id: '0123456789abcdef' });
    const next = newTracker();
    next.init({ trackerUrl: 'https://s.cn', siteId: 1 });
    expect(stored()).toEqual([`${STORAGE_PREFIX}optout`]);
    expect(next.areCookiesEnabled()).toBe(false);
    m.optIn();
    expect(m.areCookiesEnabled()).toBe(true);
  });

  it('forgetConsentGiven still blocks sending at the next launch, until consent is given', async () => {
    init();
    m.forgetConsentGiven();
    expect(stored()).toEqual([`${STORAGE_PREFIX}consent_removed`]);
    vi.clearAllTimers();
    const next = newTracker();
    next.init({ trackerUrl: 'https://s.cn', siteId: 1 });
    expect(next.isConsentRequired()).toBe(true);
    next.trackEvent('a', 'withheld');
    await next.flush();
    expect(sent()).toEqual([]);
    next.setConsentGiven();
    await next.flush();
    expect(sent()).toHaveLength(1);
    expect(stored()).not.toContain(`${STORAGE_PREFIX}consent_removed`);
    vi.clearAllTimers();
    const later = newTracker();
    later.init({ trackerUrl: 'https://s.cn', siteId: 1 });
    expect(later.isConsentRequired()).toBe(false);
    later.trackEvent('a', 'sent');
    await later.flush();
    expect(sent()).toHaveLength(2);
  });

  it('isConsentRequired reports whether tracking consent is required', () => {
    expect(m.isConsentRequired()).toBe(false);
    init({ requireConsent: 'cookie' });
    expect(m.isConsentRequired()).toBe(false);
    m.requireConsent();
    expect(m.isConsentRequired()).toBe(true);
    const t = newTracker();
    t.init(TRACKING);
    expect(t.isConsentRequired()).toBe(true);
    t.setConsentGiven();
    expect(t.isConsentRequired()).toBe(true);
  });

  it('getRememberedCookieConsent returns the time cookie consent was remembered', () => {
    expect(m.getRememberedCookieConsent()).toBeNull();
    init({ requireConsent: 'cookie' });
    expect(m.getRememberedCookieConsent()).toBeNull();
    m.setCookieConsentGiven();
    expect(m.getRememberedCookieConsent()).toBeNull();
    m.rememberCookieConsentGiven(1);
    expect(m.getRememberedCookieConsent()).toBe(now);
    now += 3_600_000;
    expect(m.getRememberedCookieConsent()).toBeNull();
    m.rememberCookieConsentGiven();
    m.forgetCookieConsentGiven();
    expect(m.getRememberedCookieConsent()).toBeNull();
  });

  it('sends consent=1 once tracking consent is required and given, like Matomo JS', () => {
    init({ requireConsent: 'tracking' });
    m.trackEvent('a', 'pending');
    m.setConsentGiven();
    m.trackEvent('a', 'given');
    expect(hits().map((h) => h.consent)).toEqual(['1', '1']);
    const free = newTracker();
    wx.storage.clear();
    free.init({ trackerUrl: 'https://s.cn', siteId: 1, requireConsent: 'cookie', batchSize: 50 });
    free.trackEvent('a', 'b');
    expect(hits().some((h) => h.e_a === 'b' && 'consent' in h)).toBe(false);
  });

  it('consent getters never throw', () => {
    const broken = createTracker(() => ({ platform: createPlatform(wx), target }));
    broken.init({ trackerUrl: 'https://s.cn', siteId: 1 });
    wx.getStorageSync = () => {
      throw new Error('boom');
    };
    expect(broken.hasRememberedConsent()).toBe(false);
    (broken as unknown as { state: unknown }).state = {};
    expect(broken.hasRememberedConsent()).toBe(false);
    expect(broken.getRememberedConsent()).toBeNull();
    expect(broken.areCookiesEnabled()).toBe(false);
  });

  it('tracks native payments in GA4 style when trackPayments is on', () => {
    let result = { errMsg: '' };
    wx.requestPayment = (o?: unknown) => {
      const c = o as Record<string, (r: unknown) => void>;
      if (result.errMsg.endsWith(':ok')) c.success?.(result);
      else c.fail?.(result);
      c.complete?.(result);
    };
    init({ trackPayments: true });
    const pay = (errMsg: string) => {
      result = { errMsg };
      wx.requestPayment?.({ paySign: 's', complete: () => undefined });
    };
    pay('requestPayment:ok');
    pay('requestPayment:fail cancel');
    pay('requestPayment:fail');
    expect(
      hits()
        .filter((h) => h.e_c === 'Ecommerce')
        .map((h) => [h.e_a, h.e_n]),
    ).toEqual([
      ['Payment started', 'begin_checkout'],
      ['Payment completed', 'purchase'],
      ['Payment started', 'begin_checkout'],
      ['Payment cancelled', 'payment_cancelled'],
      ['Payment started', 'begin_checkout'],
      ['Payment failed', 'payment_failed'],
    ]);
  });

  it('leaves wx.requestPayment alone by default and on a crawler launch', () => {
    const original = () => undefined;
    wx.requestPayment = original;
    init();
    expect(wx.requestPayment).toBe(original);
    wx.launch = { path: 'pages/index/index', scene: 1129, query: {} };
    newTracker().init({ trackerUrl: 'https://s.cn', siteId: 1, trackPayments: true });
    expect(wx.requestPayment).toBe(original);
  });

  it('silently disables trackPayments when wx.requestPayment cannot be replaced', () => {
    const original = () => 'task';
    Object.defineProperty(wx, 'requestPayment', { value: original, writable: false });
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    expect(init({ trackPayments: true, debug: true })).toBe(true);
    expect(wx.requestPayment).toBe(original);
    expect(log.mock.calls.some((c) => String(c[0]).includes('trackPayments'))).toBe(true);
    log.mockRestore();
  });
});
