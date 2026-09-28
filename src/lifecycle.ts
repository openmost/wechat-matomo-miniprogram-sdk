import { guard, isRecord } from './util';

export type Constructor = (options: Record<string, unknown>) => unknown;

export interface LifecycleTarget {
  App?: Constructor;
  Page?: Constructor;
  Component?: Constructor;
}

export interface ShareResult {
  title?: string;
  path?: string;
  query?: string;
  imageUrl?: string;
  promise?: unknown;
}

export interface LifecycleHooks {
  appShow(): void;
  appHide(): void;
  pageShow(route: string, query: Record<string, string>): void;
  pageHide(route: string): void;
  share(
    kind: 'chat' | 'timeline',
    route: string,
    result: ShareResult | undefined,
  ): ShareResult | undefined;
}

type Options = Record<string, unknown>;
interface PageContext {
  route?: unknown;
  options?: unknown;
  __mtmQuery?: Record<string, string>;
}
type Handler = (this: PageContext, ...args: unknown[]) => unknown;
/** `guard` bound to the installer's `onError`. */
type Safe = (fn: () => void) => void;

function toQuery(value: unknown): Record<string, string> {
  const query: Record<string, string> = {};
  if (isRecord(value)) for (const [k, v] of Object.entries(value)) query[k] = String(v);
  return query;
}

const routeOf = (ctx: PageContext): string => (typeof ctx.route === 'string' ? ctx.route : '');

/** Host handler first (result and exceptions untouched), then the guarded SDK hook. */
function after(original: unknown, hook: (ctx: PageContext) => void): Handler {
  return function (this: PageContext, ...args: unknown[]) {
    const result =
      typeof original === 'function' ? (original as Handler).apply(this, args) : undefined;
    hook(this);
    return result;
  };
}

const PAGE_HANDLERS = [
  'onLoad',
  'onShow',
  'onHide',
  'onUnload',
  'onShareAppMessage',
  'onShareTimeline',
];

const showHook = (hooks: LifecycleHooks, safe: Safe) => (ctx: PageContext) =>
  safe(() => {
    const route = routeOf(ctx);
    // `this.options` (the page query) covers pages whose onLoad the SDK did not wrap.
    if (route) hooks.pageShow(route, ctx.__mtmQuery ?? toQuery(ctx.options));
  });

const hideHook = (hooks: LifecycleHooks, safe: Safe) => (ctx: PageContext) =>
  safe(() => {
    const route = routeOf(ctx);
    if (route) hooks.pageHide(route);
  });

/**
 * Wraps page lifecycle handlers. `onlyDefined` (Component pages) wraps only the handlers the host
 * declared itself: adding a `methods.onShow` would shadow one coming from a behavior.
 */
function withPageHandlers(
  handlers: Options,
  hooks: LifecycleHooks,
  safe: Safe,
  onlyDefined = false,
): Options {
  const out: Options = { ...handlers };
  const has = (name: string) => !onlyDefined || typeof handlers[name] === 'function';
  const originalLoad = handlers.onLoad;
  if (has('onLoad'))
    out.onLoad = function (this: PageContext, ...args: unknown[]) {
      safe(() => {
        this.__mtmQuery = toQuery(args[0]);
      });
      return typeof originalLoad === 'function'
        ? (originalLoad as Handler).apply(this, args)
        : undefined;
    };
  const hide = hideHook(hooks, safe);
  if (has('onShow')) out.onShow = after(handlers.onShow, showHook(hooks, safe));
  if (has('onHide')) out.onHide = after(handlers.onHide, hide);
  if (has('onUnload')) out.onUnload = after(handlers.onUnload, hide);

  for (const [name, kind] of [
    ['onShareAppMessage', 'chat'],
    ['onShareTimeline', 'timeline'],
  ] as const) {
    const original = handlers[name];
    // Defining a share handler enables the share menu: only wrap what the host defined.
    if (typeof original !== 'function') continue;
    out[name] = function (this: PageContext, ...args: unknown[]) {
      const result = (original as Handler).apply(this, args) as ShareResult | undefined;
      let wrapped = result;
      safe(() => {
        wrapped = hooks.share(kind, routeOf(this), result);
      });
      return wrapped;
    };
  }
  return out;
}

/**
 * Component pages: host-defined `methods.on*` handlers are wrapped; for the ones the host did not
 * define, the SDK hooks `pageLifetimes.show/hide` and `lifetimes.detached` instead, which WeChat
 * merges with behaviors rather than overriding them. Components without a route (not pages) are
 * ignored by the hooks, and their `methods` are never touched.
 */
function withComponentHandlers(o: Options, hooks: LifecycleHooks, safe: Safe): Options {
  const methods = isRecord(o.methods) ? o.methods : {};
  const defined = (name: string) => typeof methods[name] === 'function';
  const out: Options = { ...o };
  if (PAGE_HANDLERS.some(defined)) out.methods = withPageHandlers(methods, hooks, safe, true);
  const pageLifetimes = isRecord(o.pageLifetimes) ? { ...o.pageLifetimes } : {};
  const hide = hideHook(hooks, safe);
  if (!defined('onShow')) pageLifetimes.show = after(pageLifetimes.show, showHook(hooks, safe));
  if (!defined('onHide')) pageLifetimes.hide = after(pageLifetimes.hide, hide);
  out.pageLifetimes = pageLifetimes;
  if (!defined('onUnload')) {
    const lifetimes = isRecord(o.lifetimes) ? { ...o.lifetimes } : {};
    // `lifetimes.detached` takes precedence over a top-level `detached`, so chain the latter.
    lifetimes.detached = after(lifetimes.detached ?? o.detached, hide);
    out.lifetimes = lifetimes;
  }
  return out;
}

export function installLifecycle(
  target: LifecycleTarget,
  hooks: LifecycleHooks,
  onError: (error: unknown) => void = () => undefined,
): () => void {
  const originals = { App: target.App, Page: target.Page, Component: target.Component };
  const safe: Safe = (fn) => guard(fn, onError);

  const { App, Page, Component } = originals;
  if (App) {
    target.App = (options) => {
      const o = isRecord(options) ? options : {};
      return App({
        ...o,
        onShow: after(o.onShow, () => safe(() => hooks.appShow())),
        onHide: after(o.onHide, () => safe(() => hooks.appHide())),
      });
    };
  }
  if (Page) {
    target.Page = (options) =>
      Page(withPageHandlers(isRecord(options) ? options : {}, hooks, safe));
  }
  if (Component) {
    target.Component = (options) =>
      Component(withComponentHandlers(isRecord(options) ? options : {}, hooks, safe));
  }

  return () => {
    target.App = originals.App;
    target.Page = originals.Page;
    target.Component = originals.Component;
  };
}
