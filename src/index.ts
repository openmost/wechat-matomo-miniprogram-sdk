import { resolveAttribution } from './attribution';
import { parseConfig, type MatomoConfig, type MatomoOptions } from './config';
import { Consent, Kind } from './consent';
import { getDeviceContext, type DeviceContext } from './context';
import { Cart, cartUpdateParams, orderParams, productViewParams } from './ecommerce';
import { installLifecycle, wrapPayment, type LifecycleTarget, type ShareResult } from './lifecycle';
import { createPlatform, type Platform } from './platform';
import { HitQueue } from './queue';
import {
  buildHit,
  newPageViewId,
  pageUrl,
  parsePath,
  toQueryString,
  withQuery,
  type PageRef,
} from './request';
import type { Params } from './types';
import { guard } from './util';
import { Storage, Visitor, VISIT_TIMEOUT_MS } from './visitor';

export type { ConfigError, MatomoConfig, MatomoOptions } from './config';

export interface TrackerDeps {
  platform: Platform;
  target?: LifecycleTarget;
}

interface State {
  config: MatomoConfig;
  platform: Platform;
  consent: Consent;
  visitor: Visitor;
  queue: HitQueue;
  device: DeviceContext;
  cart: Cart;
  dimensions: Record<number, string>;
  userId?: string;
  current: PageRef;
  attribution?: Record<string, string>;
  ecommerceView?: Params;
  lastHitTs: number;
  /** `pv_id` of the last pageview; other hits carry it like Matomo JS. */
  pageViewId?: string;
  /** Hits tracked while 'tracking' consent is pending: memory only, like Matomo JS. */
  pending: Array<{ q: string; ts: number }>;
}

const MAX_BUFFER = 100;
const MAX_PENDING = 100;
/** WeChat crawler (微信爬虫访问): indexing visits are not tracked. */
const CRAWLER_SCENE = 1129;
/** Same platform, with storage writes turned into no-ops. */
const readOnly = (p: Platform): Platform =>
  Object.assign(Object.create(p) as Platform, {
    setItem: () => false,
    removeItem: () => undefined,
  });
const isCrawler = (p: Platform): boolean =>
  p.launchOptions()?.scene === CRAWLER_SCENE || p.enterOptions()?.scene === CRAWLER_SCENE;
const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';
/** Stored data is removed without cookie consent or when opted out; read-only while tracking consent is pending. */
const storageOf = (c: Consent): Storage =>
  !c.canReadStorage() ? Storage.None : c.canPersistVisitor() ? Storage.Write : Storage.Read;

export class MatomoTracker {
  private state: State | undefined;
  private buffer: Array<(s: State) => void> = [];
  private debug = false;

  constructor(private readonly deps: () => TrackerDeps) {}

  init(options: MatomoOptions): boolean {
    let state: State | undefined;
    try {
      if (this.state) {
        this.log('init called twice; ignored');
        return true;
      }
      this.debug = options?.debug === true;
      const parsed = parseConfig(options);
      if (!parsed.ok) {
        if (this.debug) console.warn('[matomo] invalid config', parsed.errors);
        this.buffer = [];
        return false;
      }
      const deps = this.deps();
      const { target } = deps;
      const launch = deps.platform.launchOptions();
      // Crawler launch: nothing is tracked, so nothing may be written to storage either.
      const crawler = launch?.scene === CRAWLER_SCENE;
      const platform = crawler ? readOnly(deps.platform) : deps.platform;
      const config = parsed.config;
      const consent = new Consent(platform, config.requireConsent);
      const storage = storageOf(consent);
      state = {
        config,
        platform,
        consent,
        visitor: new Visitor(platform, storage),
        // While tracking consent is pending, the stored queue is held in memory (never sent) and
        // its stored copy removed; without cookie consent it is dropped.
        queue: new HitQueue(platform, {
          endpoint: config.trackerUrl + config.trackerPath,
          batchSize: config.batchSize,
          maxQueue: config.maxQueue,
          flushInterval: config.flushInterval,
          persist: storage === Storage.Write,
          load: storage !== Storage.None,
          paused: !consent.canSend(),
        }),
        device: getDeviceContext(platform),
        cart: new Cart(),
        dimensions: { ...config.customDimensions },
        userId: config.userId,
        current: { route: launch?.path ?? '', query: launch?.query ?? {} },
        attribution: resolveAttribution(launch, config.trackScenes).params,
        lastHitTs: 0,
        pending: [],
      };
      // Wire the lifecycle hooks before starting the queue's timer/online-listener: if
      // `installLifecycle` throws, the queue must never have been started, or a failed init
      // would leave a live queue running behind the caller's back.
      if (target) installLifecycle(target, this.hooks(state), (e) => this.log('hook error', e));
      if (!config.disabled && !crawler) state.queue.start();
      this.state = state;
      if (config.trackPayments && !crawler && !config.disabled) {
        const hooked = platform.hookPayment((original) =>
          wrapPayment(original, (action, name) =>
            this.run((s) => this.track(s, { e_c: 'Ecommerce', e_a: action, e_n: name })),
          ),
        );
        if (!hooked) this.log('trackPayments: wx.requestPayment not wrappable');
      }
      const pending = this.buffer;
      this.buffer = [];
      const initializedState = state;
      pending.forEach((call) => guard(() => call(initializedState), this.onError));
      return true;
    } catch (error) {
      state?.queue.stop();
      this.state = undefined;
      this.log('init failed', error);
      return false;
    }
  }

  trackPageView(title?: string, path?: string): void {
    this.run((s) => this.pageView(s, title, path));
  }

  trackEvent(category: string, action: string, name?: string, value?: number): void {
    this.run((s) => {
      if (!nonEmpty(category) || !nonEmpty(action))
        return this.log('trackEvent needs category and action');
      this.track(s, {
        e_c: category,
        e_a: action,
        e_n: name,
        e_v: Number.isFinite(value) ? value : undefined,
      });
    });
  }

  trackSiteSearch(keyword: string, category?: string, resultsCount?: number): void {
    this.run((s) => {
      if (!nonEmpty(keyword)) return this.log('trackSiteSearch needs a keyword');
      this.track(s, {
        search: keyword,
        search_cat: category,
        search_count: Number.isFinite(resultsCount) ? resultsCount : undefined,
      });
    });
  }

  trackGoal(idGoal: number, revenue?: number): void {
    this.run((s) => {
      if (!Number.isInteger(idGoal) || idGoal <= 0) return this.log('trackGoal needs a goal id');
      this.track(s, { idgoal: idGoal, revenue: Number.isFinite(revenue) ? revenue : undefined });
    });
  }

  trackLink(url: string, type: 'link' | 'download' = 'link'): void {
    this.run((s) => {
      if (!nonEmpty(url)) return;
      this.track(s, type === 'download' ? { download: url } : { link: url });
    });
  }

  setEcommerceView(
    sku?: string,
    name?: string,
    category?: string | string[],
    price?: number,
  ): void {
    this.run((s) => {
      s.ecommerceView = productViewParams(sku, name, category, price);
    });
  }

  addEcommerceItem(
    sku: string,
    name?: string,
    category?: string | string[],
    price?: number,
    quantity?: number,
  ): void {
    this.run((s) => s.cart.add(sku, name, category, price, quantity));
  }

  removeEcommerceItem(sku: string): void {
    this.run((s) => s.cart.remove(sku));
  }

  clearEcommerceCart(): void {
    this.run((s) => s.cart.clear());
  }

  trackEcommerceCartUpdate(grandTotal: number): void {
    this.run((s) => this.track(s, cartUpdateParams(s.cart.items, grandTotal)));
  }

  trackEcommerceOrder(
    orderId: string,
    grandTotal: number,
    subTotal?: number,
    tax?: number,
    shipping?: number,
    discount?: number,
  ): void {
    this.run((s) => {
      if (!nonEmpty(orderId)) return this.log('trackEcommerceOrder needs an order id');
      this.track(
        s,
        orderParams(s.cart.items, orderId, grandTotal, subTotal, tax, shipping, discount),
      );
      s.cart.clear();
    });
  }

  setUserId(userId: string): void {
    this.run((s) => {
      if (nonEmpty(userId)) s.userId = userId.trim();
    });
  }

  resetUserId(): void {
    this.run((s) => {
      s.userId = undefined;
    });
  }

  setCustomDimension(index: number, value: string): void {
    this.run((s) => {
      if (Number.isInteger(index) && index >= 1 && index <= 999 && typeof value === 'string')
        s.dimensions[index] = value;
    });
  }

  deleteCustomDimension(index: number): void {
    this.run((s) => {
      const next: Record<number, string> = {};
      for (const [key, value] of Object.entries(s.dimensions))
        if (Number(key) !== index) next[Number(key)] = value;
      s.dimensions = next;
    });
  }

  requireConsent(): void {
    this.consent((c) => c.require(Kind.Tracking));
  }

  setConsentGiven(): void {
    this.consent((c) => c.give(Kind.Tracking));
  }

  rememberConsentGiven(hoursToExpire?: number): void {
    this.consent((c) => c.give(Kind.Tracking, true, hoursToExpire));
  }

  forgetConsentGiven(): void {
    this.consent((c, s) => {
      c.forget(Kind.Tracking); // also requires tracking consent from now on
      s.pending = [];
      s.queue.clear(); // hits from before the withdrawal are never sent, like optOut()
      s.visitor.reset();
    });
  }

  hasRememberedConsent(): boolean {
    return this.getRememberedConsent() !== null;
  }

  getRememberedConsent(): number | null {
    return this.read((s) => s.consent.rememberedAt(Kind.Tracking), null);
  }

  isConsentRequired(): boolean {
    return this.read((s) => s.consent.isRequired(), false);
  }

  requireCookieConsent(): void {
    this.consent((c) => c.require(Kind.Cookie));
  }

  setCookieConsentGiven(): void {
    this.consent((c) => c.give(Kind.Cookie));
  }

  rememberCookieConsentGiven(hoursToExpire?: number): void {
    this.consent((c) => c.give(Kind.Cookie, true, hoursToExpire));
  }

  forgetCookieConsentGiven(): void {
    this.consent((c) => c.forget(Kind.Cookie));
  }

  getRememberedCookieConsent(): number | null {
    return this.read((s) => s.consent.rememberedAt(Kind.Cookie), null);
  }

  areCookiesEnabled(): boolean {
    return this.read((s) => s.consent.canPersistVisitor(), false);
  }

  optOut(): void {
    this.consent((c, s) => {
      c.optOut();
      s.pending = [];
      s.queue.clear();
      s.visitor.reset(); // only the opt-out flag stays in storage
    });
  }

  optIn(): void {
    this.consent((c) => c.optIn());
  }

  isOptedOut(): boolean {
    return this.read((s) => s.consent.isOptedOut(), false);
  }

  flush(): Promise<void> {
    return this.read((s) => s.queue.flush().catch(() => undefined), Promise.resolve());
  }

  getVisitorId(): string {
    return this.read((s) => s.visitor.id, '');
  }

  private hooks(s: State) {
    return {
      // Attribution is only (re-)resolved by `track()` when `visitor.touch()` reports a new
      // visit, reading `platform.enterOptions()` at that moment — WeChat keeps that call
      // current across hot starts (spec §4.4: campaign params belong on "the first hit's page
      // URL of a visit"). Resolving it eagerly here would stamp mtm_* onto the next hit even
      // mid-visit (e.g. returning from another mini program), splitting a single Matomo visit.
      appShow: () => undefined,
      appHide: () => {
        this.heartbeat(s);
        void s.queue.flush();
      },
      pageShow: (route: string, query: Record<string, string>) => {
        s.current = { route, query };
        const excluded = s.config.excludedRoutes.some((prefix) => route.startsWith(prefix));
        if (s.config.autoTrackPages && !excluded) this.pageView(s);
      },
      pageHide: () => this.heartbeat(s),
      share: (kind: 'chat' | 'timeline', route: string, result: ShareResult | undefined) =>
        this.share(s, kind, route, result),
    };
  }

  private share(
    s: State,
    kind: 'chat' | 'timeline',
    route: string,
    result: ShareResult | undefined,
  ): ShareResult | undefined {
    // Convention: action = sentence case of the snake_case name (the page is in the hit URL).
    if (s.config.trackShares)
      this.track(
        s,
        kind === 'chat'
          ? { e_c: 'Share', e_a: 'Share to chat', e_n: 'share_to_chat' }
          : { e_c: 'Share', e_a: 'Share to Moments', e_n: 'share_to_moments' },
      );
    if (s.config.shareCampaign === false) return result;
    const params = {
      mtm_campaign: s.config.shareCampaign,
      mtm_source: 'wechat',
      mtm_medium: kind === 'chat' ? 'share' : 'share_timeline',
    };
    const base: ShareResult = result ?? {};
    // Without an explicit path/query from the host, WeChat shares the current page with its
    // own query, so default to that before appending the campaign.
    const pageQuery = route === s.current.route ? s.current.query : {};
    if (kind === 'timeline')
      return { ...base, query: withQuery(base.query ?? toQueryString(pageQuery), params) };
    return { ...base, path: withQuery(base.path ?? withQuery(`/${route}`, pageQuery), params) };
  }

  private pageView(s: State, title?: string, path?: string): void {
    if (nonEmpty(path)) s.current = parsePath(path);
    const route = s.current.route;
    s.pageViewId = newPageViewId(() => s.platform.random());
    const params: Params = {
      action_name: nonEmpty(title) ? title : (s.config.pageTitles[route] ?? route),
      pv_id: s.pageViewId,
      ...s.ecommerceView,
    };
    // Only drop the pending ecommerce view once the hit that carries it is actually enqueued —
    // if `track()` blocks the hit (consent, opt-out, disabled), the product view must survive
    // for the next pageview attempt instead of being silently lost.
    this.track(s, params, { onSent: () => (s.ecommerceView = undefined) });
  }

  private heartbeat(s: State): void {
    const hb = s.config.heartbeat;
    if (hb <= 0 || s.lastHitTs <= 0) return;
    const elapsed = s.platform.now() - s.lastHitTs;
    // A gap past the visit timeout would make `visitor.touch()` open a brand new visit for a
    // synthetic ping; skip it instead so the next real hit opens (and attributes) that visit.
    if (elapsed >= hb * 1000 && elapsed <= VISIT_TIMEOUT_MS)
      this.track(s, { ping: 1 }, { attribute: false });
  }

  private track(
    s: State,
    specific: Params,
    opts: { attribute?: boolean; onSent?: () => void } = {},
  ): void {
    if (s.config.disabled || s.consent.isOptedOut() || isCrawler(s.platform)) return;
    // Past the opt-out check, `canSend()` is only false while 'tracking' consent is pending.
    const pending = !s.consent.canSend();
    const attribute = opts.attribute ?? true;
    const { newVisit } = s.visitor.touch();
    if (attribute && newVisit && s.lastHitTs > 0)
      s.attribution = resolveAttribution(s.platform.enterOptions(), s.config.trackScenes).params;
    let url = pageUrl(s.device.appId, s.current);
    if (attribute && s.attribution && Object.keys(s.attribution).length > 0)
      url = withQuery(url, s.attribution);
    if (attribute) s.attribution = undefined;
    const now = s.platform.now();
    // Matomo JS adds consent=1 when consent is required and given (read by log analytics).
    const consent = !pending && s.consent.isRequired() ? 1 : undefined;
    const hit = buildHit(
      {
        siteId: s.config.siteId,
        visitor: s.visitor.params(),
        ua: s.device.ua,
        res: s.device.res,
        lang: s.device.lang,
        userId: s.userId,
        dimensions: s.dimensions,
        url,
        now,
        random: () => s.platform.random(),
      },
      { pv_id: s.pageViewId, ...specific, consent },
    );
    if (!pending) s.queue.enqueue(hit, now);
    else if (s.pending.push({ q: hit, ts: now }) > MAX_PENDING) s.pending.shift();
    s.lastHitTs = now;
    opts.onSent?.();
  }

  /**
   * Runs a consent change, then applies it: storage follows `storageOf()`, the queue is held while
   * tracking consent is pending, and hits kept meanwhile are queued (in order) once it is given.
   */
  private consent(change: (c: Consent, s: State) => void): void {
    this.run((s) => {
      change(s.consent, s);
      const storage = storageOf(s.consent);
      const send = s.consent.canSend();
      s.visitor.setStorage(storage);
      s.queue.setPersist(storage === Storage.Write);
      s.queue.pause(!send);
      if (!send) return;
      const pending = s.pending;
      s.pending = [];
      // Kept while tracking consent was pending, so consent is required and now given.
      pending.forEach((hit) => s.queue.enqueue(`${hit.q}&consent=1`, hit.ts));
    });
  }

  /** Getter counterpart of `run`: `fallback` before init or on error. */
  private read<T>(get: (s: State) => T, fallback: T): T {
    try {
      return this.state ? get(this.state) : fallback;
    } catch {
      return fallback;
    }
  }

  private run(call: (s: State) => void): void {
    guard(() => {
      if (this.state) call(this.state);
      else if (this.buffer.length < MAX_BUFFER) this.buffer.push(call);
    }, this.onError);
  }

  /** Instance arrow (not a prototype method) so it can be passed to `guard` unbound. */
  private readonly onError = (error: unknown): void => this.log('error', error);

  private log(message: string, ...details: unknown[]): void {
    if (this.debug) console.log(`[matomo] ${message}`, ...details);
  }
}

export function createTracker(deps: () => TrackerDeps): MatomoTracker {
  return new MatomoTracker(deps);
}

/** Accessors over the mini program globals so lifecycle.ts can replace them in place. */
function globalTarget(): LifecycleTarget {
  return {
    get App() {
      return typeof App === 'function' ? App : undefined;
    },
    set App(v) {
      App = v;
    },
    get Page() {
      return typeof Page === 'function' ? Page : undefined;
    },
    set Page(v) {
      Page = v;
    },
    get Component() {
      return typeof Component === 'function' ? Component : undefined;
    },
    set Component(v) {
      Component = v;
    },
  };
}

export const Matomo: MatomoTracker = createTracker(() => {
  if (typeof wx === 'undefined' || !wx) throw new Error('wx is not available');
  return { platform: createPlatform(wx), target: globalTarget() };
});
