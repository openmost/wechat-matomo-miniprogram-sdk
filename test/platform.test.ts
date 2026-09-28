import { describe, expect, it, vi } from 'vitest';
import { STORAGE_PREFIX, createPlatform } from '../src/platform';
import { createWxMock } from './wx-mock';

describe('createPlatform', () => {
  it('prefixes storage keys and treats empty string as missing', () => {
    const wx = createWxMock();
    const p = createPlatform(wx);
    expect(p.getItem('visitor')).toBeUndefined();
    expect(p.setItem('visitor', { id: 'a' })).toBe(true);
    expect(wx.storage.get(`${STORAGE_PREFIX}visitor`)).toEqual({ id: 'a' });
    expect(p.getItem('visitor')).toEqual({ id: 'a' });
    p.removeItem('visitor');
    expect(wx.storage.has(`${STORAGE_PREFIX}visitor`)).toBe(false);
  });

  it('swallows storage errors', () => {
    const boom = () => {
      throw new Error('quota exceeded');
    };
    const p = createPlatform(
      createWxMock({ getStorageSync: boom, setStorageSync: boom, removeStorageSync: boom }),
    );
    expect(p.setItem('queue', [])).toBe(false);
    expect(() => p.removeItem('queue')).not.toThrow();
    expect(p.getItem('queue')).toBeUndefined();
  });

  it('posts JSON and resolves ok for 2xx', async () => {
    const wx = createWxMock();
    const p = createPlatform(wx);
    await expect(
      p.post({ url: 'https://x.cn/matomo.php', data: '{}', timeout: 1000 }),
    ).resolves.toEqual({
      ok: true,
      status: 200,
    });
    expect(wx.requests[0]).toEqual({
      url: 'https://x.cn/matomo.php',
      data: '{}',
      header: { 'content-type': 'application/json' },
    });
  });

  it('resolves failures instead of rejecting', async () => {
    const wx = createWxMock();
    const p = createPlatform(wx);
    wx.status = 503;
    await expect(p.post({ url: 'u', data: '', timeout: 1 })).resolves.toEqual({
      ok: false,
      status: 503,
    });
    wx.status = 'fail';
    await expect(p.post({ url: 'u', data: '', timeout: 1 })).resolves.toEqual({ ok: false });
    const throwing = createPlatform(
      createWxMock({
        request: () => {
          throw new Error('no network');
        },
      }),
    );
    await expect(throwing.post({ url: 'u', data: '', timeout: 1 })).resolves.toEqual({ ok: false });
  });

  it('merges split system APIs', () => {
    expect(createPlatform(createWxMock()).system()).toEqual({
      brand: 'Apple',
      model: 'iPhone 15',
      system: 'iOS 17.4',
      platform: 'ios',
      screenWidth: 393,
      screenHeight: 852,
      pixelRatio: 3,
      language: 'zh_CN',
      wechatVersion: '8.0.50',
      sdkVersion: '3.5.0',
    });
  });

  it('falls back to getSystemInfoSync on old base libraries', () => {
    const wx = createWxMock({
      getDeviceInfo: undefined,
      getWindowInfo: undefined,
      getAppBaseInfo: undefined,
      getSystemInfoSync: () => ({
        brand: 'Xiaomi',
        model: 'M2012K11AC',
        system: 'Android 13',
        platform: 'android',
        screenWidth: 400,
        screenHeight: 800,
        pixelRatio: 2.75,
        language: 'en',
        version: '8.0.40',
        SDKVersion: '2.30.0',
      }),
    });
    expect(createPlatform(wx).system()).toMatchObject({
      platform: 'android',
      wechatVersion: '8.0.40',
    });
  });

  it('returns empty defaults when nothing is available', () => {
    const wx = createWxMock({
      getDeviceInfo: undefined,
      getWindowInfo: undefined,
      getAppBaseInfo: undefined,
      getAccountInfoSync: undefined,
      getEnterOptionsSync: undefined,
    });
    const p = createPlatform(wx);
    expect(p.system()).toMatchObject({ platform: '', screenWidth: 0, language: '' });
    expect(p.account()).toEqual({ appId: '', envVersion: '', version: '' });
    expect(p.enterOptions()).toEqual(wx.launch);
  });

  it('reads account info and launch options', () => {
    const wx = createWxMock();
    const p = createPlatform(wx);
    expect(p.account()).toEqual({
      appId: 'wx1234567890abcdef',
      envVersion: 'release',
      version: '1.2.3',
    });
    expect(p.launchOptions()).toEqual(wx.launch);
  });

  it('calls onOnline only when connectivity returns', () => {
    const wx = createWxMock();
    const listener = vi.fn();
    createPlatform(wx).onOnline(listener);
    wx.emitNetwork(false);
    wx.emitNetwork(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('uses the injected clock', () => {
    const p = createPlatform(createWxMock(), { now: () => 42, random: () => 0.5 });
    expect(p.now()).toBe(42);
    expect(p.random()).toBe(0.5);
  });
});
