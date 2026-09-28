import { vi } from 'vitest';
import type { WxLike, WxRequestOptions } from '../src/platform';
import type { EnterOptions } from '../src/types';

export interface WxMock extends WxLike {
  storage: Map<string, unknown>;
  requests: Array<{ url: string; data: string; header: Record<string, string> }>;
  /** HTTP status for subsequent requests; `'fail'` triggers the fail callback. */
  status: number | 'fail';
  launch: EnterOptions;
  emitNetwork(isConnected: boolean): void;
}

export function createWxMock(overrides: Partial<WxLike> = {}): WxMock {
  const storage = new Map<string, unknown>();
  const listeners: Array<(result: { isConnected: boolean }) => void> = [];
  const mock: WxMock = {
    storage,
    requests: [],
    status: 200,
    launch: { path: 'pages/index/index', scene: 1001, query: {} },
    getStorageSync: vi.fn((key: string) => (storage.has(key) ? storage.get(key) : '')),
    setStorageSync: vi.fn((key: string, value: unknown) => {
      storage.set(key, value);
    }),
    removeStorageSync: vi.fn((key: string) => {
      storage.delete(key);
    }),
    request: vi.fn((o: WxRequestOptions) => {
      mock.requests.push({ url: o.url, data: o.data, header: o.header });
      if (mock.status === 'fail') o.fail({ errMsg: 'request:fail' });
      else o.success({ statusCode: mock.status });
    }),
    getLaunchOptionsSync: vi.fn(() => mock.launch),
    getEnterOptionsSync: vi.fn(() => mock.launch),
    getAccountInfoSync: vi.fn(() => ({
      miniProgram: { appId: 'wx1234567890abcdef', envVersion: 'release', version: '1.2.3' },
    })),
    getDeviceInfo: vi.fn(() => ({
      brand: 'Apple',
      model: 'iPhone 15',
      system: 'iOS 17.4',
      platform: 'ios',
    })),
    getWindowInfo: vi.fn(() => ({ screenWidth: 393, screenHeight: 852, pixelRatio: 3 })),
    getAppBaseInfo: vi.fn(() => ({ language: 'zh_CN', version: '8.0.50', SDKVersion: '3.5.0' })),
    onNetworkStatusChange: vi.fn((listener: (result: { isConnected: boolean }) => void) => {
      listeners.push(listener);
    }),
    emitNetwork: (isConnected: boolean) => listeners.forEach((l) => l({ isConnected })),
    ...overrides,
  };
  return mock;
}
