import { describe, expect, it, vi } from 'vitest';
import { wrapPayment } from '../src/lifecycle';

type Fn = (this: unknown, ...args: unknown[]) => unknown;
type Callbacks = Record<string, ((r: unknown) => unknown) | undefined>;

const setup = (impl: Fn) => {
  const events: string[][] = [];
  const original = vi.fn(impl);
  const pay = wrapPayment(original, (action, name) => events.push([action, name]));
  return { events, original, pay };
};
const params = {
  timeStamp: '1',
  nonceStr: 'n',
  package: 'prepay_id=1',
  signType: 'RSA',
  paySign: 's',
};
const STARTED = ['Payment started', 'begin_checkout'];

describe('wrapPayment', () => {
  it('reports start and success, and calls the host callbacks with the same arguments', () => {
    const { events, original, pay } = setup(function (o) {
      const c = o as Callbacks;
      c.success?.({ errMsg: 'requestPayment:ok' });
      c.complete?.({ errMsg: 'requestPayment:ok' });
      return 'task';
    });
    const success = vi.fn(() => 'ignored');
    const complete = vi.fn();
    const wx = { pay };
    expect(wx.pay({ ...params, success, complete })).toBe('task');
    expect(original.mock.contexts[0]).toBe(wx);
    expect(original.mock.calls[0]?.[0]).toMatchObject(params);
    expect(success).toHaveBeenCalledWith({ errMsg: 'requestPayment:ok' });
    expect(complete).toHaveBeenCalledWith({ errMsg: 'requestPayment:ok' });
    expect(events).toEqual([STARTED, ['Payment completed', 'purchase']]);
  });

  it('reports a cancellation and a failure', () => {
    for (const [errMsg, expected] of [
      ['requestPayment:fail cancel', ['Payment cancelled', 'payment_cancelled']],
      ['requestPayment:fail (detail message)', ['Payment failed', 'payment_failed']],
    ] as const) {
      const { events, pay } = setup((o) => (o as Callbacks).fail?.({ errMsg }));
      const fail = vi.fn();
      pay({ ...params, fail });
      expect(fail).toHaveBeenCalledWith({ errMsg });
      expect(events).toEqual([STARTED, expected]);
    }
  });

  it('reports a failure without errMsg, even when the host only passed complete', () => {
    const { events, pay } = setup((o) => (o as Callbacks).fail?.(undefined));
    pay({ ...params, complete: () => undefined });
    expect(events[1]).toEqual(['Payment failed', 'payment_failed']);
  });

  it('lets host callback exceptions propagate after reporting', () => {
    const { events, original, pay } = setup(() => undefined);
    const success = () => {
      throw new Error('host bug');
    };
    pay({ ...params, success });
    // WeChat calls the callbacks later, on its own stack.
    const wrapped = original.mock.calls[0]?.[0] as Callbacks;
    expect(() => wrapped.success?.({})).toThrow('host bug');
    expect(events[1]).toEqual(['Payment completed', 'purchase']);
  });

  it('lets a synchronous exception of wx.requestPayment propagate, and reports nothing', () => {
    const { events, pay } = setup(() => {
      throw new Error('wx');
    });
    expect(() => pay(params)).toThrow('wx');
    expect(() => pay({ ...params, success: () => undefined })).toThrow('wx');
    expect(events).toEqual([]);
  });

  it('reports begin_checkout once wx.requestPayment returned, before an early callback', () => {
    const { events, pay } = setup((o) => (o as Callbacks).fail?.({ errMsg: 'x:fail cancel' }));
    pay({ ...params, fail: () => undefined });
    expect(events).toEqual([STARTED, ['Payment cancelled', 'payment_cancelled']]);
  });

  it('never wraps an already wrapped wx.requestPayment again', () => {
    const { events, pay } = setup(() => undefined);
    const twice = wrapPayment(pay, (action, name) => events.push(['again', action, name]));
    expect(twice).toBe(pay);
    twice(params);
    expect(events).toEqual([STARTED]);
  });

  it('leaves promise-style calls untouched and observes the result', async () => {
    const ok = Promise.resolve({ errMsg: 'requestPayment:ok' });
    const a = setup(() => ok);
    expect(a.pay(params)).toBe(ok);
    // No callback added, so WeChat keeps returning its Promise.
    expect(a.original.mock.calls[0]?.[0]).toBe(params);
    await ok;
    await Promise.resolve();
    expect(a.events).toEqual([STARTED, ['Payment completed', 'purchase']]);

    // WeChat rejects with the fail result object, as passed to `fail`.
    const ko = Promise.reject({ errMsg: 'requestPayment:fail cancel' });
    const b = setup(() => ko);
    expect(b.pay(params)).toBe(ko);
    await expect(ko).rejects.toEqual({ errMsg: 'requestPayment:fail cancel' });
    await Promise.resolve();
    expect(b.events).toEqual([STARTED, ['Payment cancelled', 'payment_cancelled']]);
  });

  it('passes through non-object arguments and non-promise results', () => {
    const { events, original, pay } = setup(() => undefined);
    expect(pay()).toBeUndefined();
    expect(original).toHaveBeenCalledWith();
    expect(events).toEqual([STARTED]);
    const weird = setup(() => ({
      get then() {
        throw new Error('odd thenable');
      },
    }));
    expect(() => weird.pay(params)).not.toThrow();
  });
});
