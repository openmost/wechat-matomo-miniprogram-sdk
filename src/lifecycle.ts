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

function withPageHandlers(handlers: Options, hooks: LifecycleHooks, safe: Safe): Options {
  const out: Options = { ...handlers };
  const originalLoad = handlers.onLoad;
  out.onLoad = function (this: PageContext, ...args: unknown[]) {
    safe(() => {
      this.__mtmQuery = toQuery(args[0]);
    });
    return typeof originalLoad === 'function'
      ? (originalLoad as Handler).apply(this, args)
      : undefined;
  };
  out.onShow = after(handlers.onShow, (ctx) =>
    safe(() => {
      const route = routeOf(ctx);
      if (route) hooks.pageShow(route, ctx.__mtmQuery ?? {});
    }),
  );
  const hide = (ctx: PageContext) =>
    safe(() => {
      const route = routeOf(ctx);
      if (route) hooks.pageHide(route);
    });
  out.onHide = after(handlers.onHide, hide);
  out.onUnload = after(handlers.onUnload, hide);

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
    target.Component = (options) => {
      const o = isRecord(options) ? options : {};
      const methods = isRecord(o.methods) ? o.methods : {};
      return Component({ ...o, methods: withPageHandlers(methods, hooks, safe) });
    };
  }

  return () => {
    target.App = originals.App;
    target.Page = originals.Page;
    target.Component = originals.Component;
  };
}
