import { describe, expect, it, vi } from 'vitest';
import { installLifecycle, type LifecycleHooks, type LifecycleTarget } from '../src/lifecycle';

type Opts = Record<string, unknown>;
type Fn = (this: unknown, ...args: unknown[]) => unknown;

function setup() {
  const registered: { app?: Opts; pages: Opts[]; components: Opts[] } = {
    pages: [],
    components: [],
  };
  const target: LifecycleTarget = {
    App: (o) => (registered.app = o),
    Page: (o) => registered.pages.push(o),
    Component: (o) => registered.components.push(o),
  };
  const hooks: LifecycleHooks = {
    appShow: vi.fn(),
    appHide: vi.fn(),
    pageShow: vi.fn(),
    pageHide: vi.fn(),
    share: vi.fn((_kind, _route, result) => ({ ...result, path: 'wrapped' })),
  };
  const onError = vi.fn();
  const uninstall = installLifecycle(target, hooks, onError);
  return { target, hooks, registered, onError, uninstall };
}

const call = (opts: Opts | undefined, name: string, ctx: unknown, ...args: unknown[]) =>
  (opts?.[name] as Fn).apply(ctx, args);

describe('installLifecycle', () => {
  it('wraps App onShow/onHide and keeps host handlers', () => {
    const { target, hooks, registered } = setup();
    const onShow = vi.fn();
    target.App?.({ onShow, globalData: { a: 1 } });
    call(registered.app, 'onShow', {}, { scene: 1001 });
    call(registered.app, 'onHide', {});
    expect(onShow).toHaveBeenCalledWith({ scene: 1001 });
    expect(hooks.appShow).toHaveBeenCalledTimes(1);
    expect(hooks.appHide).toHaveBeenCalledTimes(1);
    expect(registered.app?.globalData).toEqual({ a: 1 });
  });

  it('tracks page show with the onLoad query after the host handler', () => {
    const { target, hooks, registered } = setup();
    const order: string[] = [];
    (hooks.pageShow as ReturnType<typeof vi.fn>).mockImplementation(() => order.push('sdk'));
    target.Page?.({ onShow: () => order.push('host') });
    const page = { route: 'pages/item/item' };
    call(registered.pages[0], 'onLoad', page, { id: '7' });
    call(registered.pages[0], 'onShow', page);
    call(registered.pages[0], 'onHide', page);
    call(registered.pages[0], 'onUnload', page);
    expect(order).toEqual(['host', 'sdk']);
    expect(hooks.pageShow).toHaveBeenCalledWith('pages/item/item', { id: '7' });
    expect(hooks.pageHide).toHaveBeenCalledTimes(2);
  });

  it('returns the host result and propagates host errors', () => {
    const { target, registered, hooks } = setup();
    target.Page?.({
      onLoad: () => 'loaded',
      onShow: () => {
        throw new Error('host bug');
      },
    });
    const page = { route: 'pages/a/a' };
    expect(call(registered.pages[0], 'onLoad', page, {})).toBe('loaded');
    expect(() => call(registered.pages[0], 'onShow', page)).toThrow('host bug');
    expect(hooks.pageShow).not.toHaveBeenCalled();
  });

  it('swallows SDK hook errors', () => {
    const { target, registered, hooks, onError } = setup();
    (hooks.pageShow as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('sdk bug');
    });
    target.Page?.({});
    expect(() => call(registered.pages[0], 'onShow', { route: 'pages/a/a' })).not.toThrow();
    expect(onError).toHaveBeenCalled();
  });

  it('does not add share handlers the page did not define', () => {
    const { target, registered } = setup();
    target.Page?.({ onShow() {} });
    expect(registered.pages[0]).not.toHaveProperty('onShareAppMessage');
    expect(registered.pages[0]).not.toHaveProperty('onShareTimeline');
  });

  it('passes share results through the share hook', () => {
    const { target, registered, hooks } = setup();
    target.Page?.({
      onShareAppMessage: () => ({ title: 'T', path: '/pages/a/a' }),
      onShareTimeline: () => undefined,
    });
    const page = { route: 'pages/a/a' };
    expect(call(registered.pages[0], 'onShareAppMessage', page, { from: 'menu' })).toEqual({
      title: 'T',
      path: 'wrapped',
    });
    call(registered.pages[0], 'onShareTimeline', page);
    expect(hooks.share).toHaveBeenCalledWith('chat', 'pages/a/a', {
      title: 'T',
      path: '/pages/a/a',
    });
    expect(hooks.share).toHaveBeenCalledWith('timeline', 'pages/a/a', undefined);
  });

  it('returns the host share result when the hook throws', () => {
    const { target, registered, hooks } = setup();
    (hooks.share as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('x');
    });
    target.Page?.({ onShareAppMessage: () => ({ title: 'T' }) });
    expect(call(registered.pages[0], 'onShareAppMessage', { route: 'p' })).toEqual({ title: 'T' });
  });

  it('wraps Component used as a page through methods', () => {
    const { target, registered, hooks } = setup();
    const onShow = vi.fn();
    target.Component?.({ methods: { onLoad: vi.fn(), onShow, doThing: () => 1 } });
    const methods = registered.components[0]?.methods as Opts;
    const page = { route: 'pages/c/c' };
    call(methods, 'onLoad', page, { x: '1' });
    call(methods, 'onShow', page);
    expect(onShow).toHaveBeenCalled();
    expect(hooks.pageShow).toHaveBeenCalledWith('pages/c/c', { x: '1' });
    expect((methods.doThing as Fn).call(page)).toBe(1);
  });

  it('ignores components that are not pages and leaves their methods untouched', () => {
    const { target, registered, hooks } = setup();
    const methods = { tap: () => 1 };
    target.Component?.({ methods });
    target.Component?.({});
    expect(registered.components[0]?.methods).toBe(methods);
    expect(registered.components[1]).not.toHaveProperty('methods');
    const plain = {}; // a plain component instance has no route
    call(registered.components[0]?.pageLifetimes as Opts, 'show', plain);
    call(registered.components[0]?.pageLifetimes as Opts, 'hide', plain);
    call(registered.components[0]?.lifetimes as Opts, 'detached', plain);
    expect(hooks.pageShow).not.toHaveBeenCalled();
    expect(hooks.pageHide).not.toHaveBeenCalled();
  });

  it('keeps behavior-provided lifecycle methods on Component pages', () => {
    const { target, registered, hooks } = setup();
    const hostShow = vi.fn();
    const hostDetached = vi.fn();
    target.Component?.({
      behaviors: ['b'],
      pageLifetimes: { show: hostShow },
      detached: hostDetached,
    });
    const options = registered.components[0] as Opts;
    // No methods.onShow/onHide/onUnload injected: the behavior's own ones stay in effect.
    expect(options).not.toHaveProperty('methods');
    expect(options.behaviors).toEqual(['b']);
    const page = { route: 'pages/c/c', options: { id: '42' } };
    call(options.pageLifetimes as Opts, 'show', page);
    expect(hostShow).toHaveBeenCalled();
    expect(hooks.pageShow).toHaveBeenCalledWith('pages/c/c', { id: '42' });
    call(options.pageLifetimes as Opts, 'hide', page);
    call(options.lifetimes as Opts, 'detached', page);
    expect(hostDetached).toHaveBeenCalled();
    expect(hooks.pageHide).toHaveBeenCalledTimes(2);
  });

  it('does not double track Component pages that define methods.onShow', () => {
    const { target, registered, hooks } = setup();
    target.Component?.({ methods: { onShow() {}, onHide() {}, onUnload() {} } });
    const options = registered.components[0] as Opts;
    expect(options.pageLifetimes).toEqual({});
    expect(options).not.toHaveProperty('lifetimes');
    const page = { route: 'pages/c/c' };
    call(options.methods as Opts, 'onShow', page);
    expect(hooks.pageShow).toHaveBeenCalledTimes(1);
  });

  it('does not mutate host option objects', () => {
    const { target } = setup();
    const options = { onShow() {} };
    const original = options.onShow;
    target.Page?.(options);
    expect(options.onShow).toBe(original);
  });

  it('uninstall restores the original constructors', () => {
    const originalPage = vi.fn();
    const target: LifecycleTarget = { Page: originalPage };
    const uninstall = installLifecycle(target, {
      appShow() {},
      appHide() {},
      pageShow() {},
      pageHide() {},
      share: (_k, _r, res) => res,
    });
    expect(target.Page).not.toBe(originalPage);
    uninstall();
    expect(target.Page).toBe(originalPage);
  });
});
