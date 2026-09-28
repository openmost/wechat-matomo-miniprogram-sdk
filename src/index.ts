import { resolveAttribution } from './attribution';
import { parseConfig, type MatomoConfig, type MatomoOptions } from './config';
import { Consent } from './consent';
import { getDeviceContext, type DeviceContext } from './context';
import { Cart, cartUpdateParams, orderParams, productViewParams } from './ecommerce';
import { installLifecycle, type LifecycleTarget, type ShareResult } from './lifecycle';
import { createPlatform, type Platform } from './platform';
import { HitQueue } from './queue';
import { buildHit, newPageViewId, pageUrl, parsePath, withQuery, type PageRef } from './request';
import type { Params } from './types';
import { guard } from './util';
import { Visitor } from './visitor';

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
}

const MAX_BUFFER = 100;
const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

export class MatomoTracker {
  private state: State | undefined;
  private buffer: Array<(s: State) => void> = [];
  private debug = false;

  constructor(private readonly deps: () => TrackerDeps) {}

  init(options: MatomoOptions): boolean {
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
      const { platform, target } = this.deps();
      const config = parsed.config;
      const consent = new Consent(platform, config.requireConsent);
      const launch = platform.launchOptions();
      const state: State = {
        config,
        platform,
        consent,
        visitor: new Visitor(platform, consent.canPersistVisitor()),
        queue: new HitQueue(platform, {
          endpoint: config.trackerUrl + config.trackerPath,
          batchSize: config.batchSize,
          maxQueue: config.maxQueue,
          flushInterval: config.flushInterval,
        }),
        device: getDeviceContext(platform),
        cart: new Cart(),
        dimensions: { ...config.customDimensions },
        userId: config.userId,
        current: { route: launch?.path ?? '', query: launch?.query ?? {} },
        attribution: resolveAttribution(launch, config.trackScenes).params,
        lastHitTs: 0,
      };
      this.state = state;
      if (!config.disabled) state.queue.start();
      if (target) installLifecycle(target, this.hooks(state), (e) => this.log('hook error', e));
      const pending = this.buffer;
      this.buffer = [];
      pending.forEach((call) => guard(() => call(state), this.onError));
      return true;
    } catch (error) {
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
        e_v: typeof value === 'number' ? value : undefined,
      });
    });
  }

  trackSiteSearch(keyword: string, category?: string, resultsCount?: number): void {
    this.run((s) => {
      if (!nonEmpty(keyword)) return this.log('trackSiteSearch needs a keyword');
      this.track(s, {
        search: keyword,
        search_cat: category,
        search_count: typeof resultsCount === 'number' ? resultsCount : undefined,
      });
    });
  }

  trackGoal(idGoal: number, revenue?: number): void {
    this.run((s) => {
      if (!Number.isInteger(idGoal) || idGoal <= 0) return this.log('trackGoal needs a goal id');
      this.track(s, { idgoal: idGoal, revenue: typeof revenue === 'number' ? revenue : undefined });
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
    this.run((s) => {
      s.consent.requireConsent();
      s.visitor.setPersist(s.consent.canPersistVisitor());
    });
  }

  setConsentGiven(): void {
    this.run((s) => {
      s.consent.setConsentGiven();
      s.visitor.setPersist(true);
    });
  }

  forgetConsentGiven(): void {
    this.run((s) => {
      s.consent.forgetConsentGiven();
      s.visitor.reset();
      s.visitor.setPersist(s.consent.canPersistVisitor());
    });
  }

  optOut(): void {
    this.run((s) => {
      s.consent.optOut();
      s.queue.clear();
    });
  }

  optIn(): void {
    this.run((s) => s.consent.optIn());
  }

  isOptedOut(): boolean {
    try {
      return this.state?.consent.isOptedOut() ?? false;
    } catch {
      return false;
    }
  }

  flush(): Promise<void> {
    try {
      return this.state ? this.state.queue.flush().catch(() => undefined) : Promise.resolve();
    } catch {
      return Promise.resolve();
    }
  }

  getVisitorId(): string {
    try {
      return this.state?.visitor.id ?? '';
    } catch {
      return '';
    }
  }

  private hooks(s: State) {
    return {
      appShow: () => {
        s.attribution = resolveAttribution(s.platform.enterOptions(), s.config.trackScenes).params;
      },
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
    if (s.config.trackShares)
      this.track(s, {
        e_c: 'Share',
        e_a: kind === 'chat' ? 'share_app_message' : 'share_timeline',
        e_n: route,
      });
    if (s.config.shareCampaign === false) return result;
    const params = {
      mtm_campaign: s.config.shareCampaign,
      mtm_source: 'wechat',
      mtm_medium: kind === 'chat' ? 'share' : 'share_timeline',
    };
    const base: ShareResult = result ?? {};
    if (kind === 'timeline') return { ...base, query: withQuery(base.query ?? '', params) };
    const defaultPath = withQuery(`/${route}`, route === s.current.route ? s.current.query : {});
    return { ...base, path: withQuery(base.path ?? defaultPath, params) };
  }

  private pageView(s: State, title?: string, path?: string): void {
    if (nonEmpty(path)) s.current = parsePath(path);
    const route = s.current.route;
    const params: Params = {
      action_name: nonEmpty(title) ? title : (s.config.pageTitles[route] ?? route),
      pv_id: newPageViewId(() => s.platform.random()),
      ...s.ecommerceView,
    };
    s.ecommerceView = undefined;
    this.track(s, params);
  }

  private heartbeat(s: State): void {
    const hb = s.config.heartbeat;
    if (hb > 0 && s.lastHitTs > 0 && s.platform.now() - s.lastHitTs >= hb * 1000)
      this.track(s, { ping: 1 });
  }

  private track(s: State, specific: Params): void {
    if (s.config.disabled || !s.consent.canSend()) return;
    const { newVisit } = s.visitor.touch();
    if (newVisit && s.lastHitTs > 0)
      s.attribution = resolveAttribution(s.platform.enterOptions(), s.config.trackScenes).params;
    let url = pageUrl(s.device.appId, s.current);
    if (s.attribution && Object.keys(s.attribution).length > 0) url = withQuery(url, s.attribution);
    s.attribution = undefined;
    const now = s.platform.now();
    s.queue.enqueue(
      buildHit(
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
        specific,
      ),
    );
    s.lastHitTs = now;
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
