import { describe, expect, it } from 'vitest';
import { buildUserAgent, getDeviceContext } from '../src/context';
import { createPlatform } from '../src/platform';
import type { SystemSnapshot } from '../src/types';
import { createWxMock } from './wx-mock';

const sys = (over: Partial<SystemSnapshot>): SystemSnapshot => ({
  brand: '',
  model: '',
  system: '',
  platform: '',
  screenWidth: 0,
  screenHeight: 0,
  pixelRatio: 1,
  language: '',
  wechatVersion: '8.0.50',
  sdkVersion: '3.5.0',
  ...over,
});

describe('buildUserAgent', () => {
  it('builds an iPhone WeChat UA', () => {
    expect(buildUserAgent(sys({ platform: 'ios', system: 'iOS 17.4.1', model: 'iPhone 15' }))).toBe(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.50 miniProgram',
    );
  });

  it('builds an iPad UA from the model', () => {
    expect(
      buildUserAgent(sys({ platform: 'ios', system: 'iOS 16.0', model: 'iPad Pro' })),
    ).toContain('(iPad; CPU OS 16_0 like Mac OS X)');
  });

  it('builds an Android WeChat UA', () => {
    expect(
      buildUserAgent(sys({ platform: 'android', system: 'Android 13', model: 'M2012K11AC' })),
    ).toBe(
      'Mozilla/5.0 (Linux; Android 13; M2012K11AC) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Mobile Safari/537.36 MicroMessenger/8.0.50 miniProgram',
    );
  });

  it('builds HarmonyOS, Windows, macOS and DevTools UAs', () => {
    expect(
      buildUserAgent(sys({ platform: 'ohos', system: 'HarmonyOS 5.0', model: 'Mate 70' })),
    ).toContain('(Linux; OpenHarmony 5.0; Mate 70)');
    expect(buildUserAgent(sys({ platform: 'windows' }))).toContain('(Windows NT 10.0; Win64; x64)');
    expect(buildUserAgent(sys({ platform: 'mac' }))).toContain(
      '(Macintosh; Intel Mac OS X 10_15_7)',
    );
    expect(buildUserAgent(sys({ platform: 'devtools' }))).toContain('wechatdevtools');
  });

  it('falls back to a generic UA', () => {
    expect(buildUserAgent(sys({ platform: 'unknown' }))).toBe(
      'Mozilla/5.0 (Linux) MicroMessenger/8.0.50 miniProgram',
    );
  });
});

describe('getDeviceContext', () => {
  it('derives res (in device pixels), lang and appId', () => {
    expect(getDeviceContext(createPlatform(createWxMock()))).toEqual({
      ua: expect.stringContaining('iPhone OS 17_4'),
      res: '1179x2556',
      lang: 'zh-CN',
      appId: 'wx1234567890abcdef',
    });
  });

  it('rounds res for fractional pixel ratios, like Matomo JS', () => {
    const wx = createWxMock({
      getWindowInfo: () => ({ screenWidth: 393, screenHeight: 873, pixelRatio: 2.75 }),
    });
    expect(getDeviceContext(createPlatform(wx)).res).toBe('1081x2401');
  });

  it('leaves res empty when the screen size is unknown', () => {
    const wx = createWxMock({ getWindowInfo: () => ({}) });
    expect(getDeviceContext(createPlatform(wx)).res).toBe('');
  });
});
