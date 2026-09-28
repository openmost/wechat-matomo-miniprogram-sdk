import type {
  AccountSnapshot,
  EnterOptions,
  RequestOptions,
  RequestResult,
  SystemSnapshot,
} from './types';

export interface WxDeviceInfo {
  brand?: string;
  model?: string;
  system?: string;
  platform?: string;
}
export interface WxWindowInfo {
  screenWidth?: number;
  screenHeight?: number;
  pixelRatio?: number;
}
export interface WxAppBaseInfo {
  language?: string;
  version?: string;
  SDKVersion?: string;
}
export interface WxRequestOptions {
  url: string;
  method: 'POST';
  data: string;
  header: Record<string, string>;
  timeout: number;
  success(result: { statusCode: number }): void;
  fail(error: unknown): void;
}

/** The subset of the `wx` global the SDK touches. Optional members are feature-detected. */
export interface WxLike {
  getStorageSync(key: string): unknown;
  setStorageSync(key: string, value: unknown): void;
  removeStorageSync(key: string): void;
  request(options: WxRequestOptions): unknown;
  getLaunchOptionsSync?(): EnterOptions;
  getEnterOptionsSync?(): EnterOptions;
  getAccountInfoSync?(): {
    miniProgram?: { appId?: string; envVersion?: string; version?: string };
  };
  getDeviceInfo?(): WxDeviceInfo;
  getWindowInfo?(): WxWindowInfo;
  getAppBaseInfo?(): WxAppBaseInfo;
  getSystemInfoSync?(): WxDeviceInfo & WxWindowInfo & WxAppBaseInfo;
  onNetworkStatusChange?(listener: (result: { isConnected: boolean }) => void): void;
}

export const STORAGE_PREFIX = '_mtm_sdk_';

export interface Platform {
  getItem<T>(key: string): T | undefined;
  setItem(key: string, value: unknown): void;
  removeItem(key: string): void;
  post(options: RequestOptions): Promise<RequestResult>;
  now(): number;
  random(): number;
  launchOptions(): EnterOptions | undefined;
  enterOptions(): EnterOptions | undefined;
  account(): AccountSnapshot;
  system(): SystemSnapshot;
  onOnline(listener: () => void): void;
}

function attempt<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/**
 * Prefers the split APIs (getDeviceInfo / getWindowInfo / getAppBaseInfo) and only calls the
 * legacy getSystemInfoSync when one of them is missing (old base libraries).
 */
function readSystem(wx: WxLike): SystemSnapshot {
  const device: WxDeviceInfo = attempt(() => wx.getDeviceInfo?.() ?? {}, {});
  const win: WxWindowInfo = attempt(() => wx.getWindowInfo?.() ?? {}, {});
  const base: WxAppBaseInfo = attempt(() => wx.getAppBaseInfo?.() ?? {}, {});
  const complete = Boolean(wx.getDeviceInfo && wx.getWindowInfo && wx.getAppBaseInfo);
  const legacy = complete ? {} : attempt(() => wx.getSystemInfoSync?.() ?? {}, {});
  return {
    brand: device.brand ?? legacy.brand ?? '',
    model: device.model ?? legacy.model ?? '',
    system: device.system ?? legacy.system ?? '',
    platform: device.platform ?? legacy.platform ?? '',
    screenWidth: win.screenWidth ?? legacy.screenWidth ?? 0,
    screenHeight: win.screenHeight ?? legacy.screenHeight ?? 0,
    pixelRatio: win.pixelRatio ?? legacy.pixelRatio ?? 1,
    language: base.language ?? legacy.language ?? '',
    wechatVersion: base.version ?? legacy.version ?? '',
    sdkVersion: base.SDKVersion ?? legacy.SDKVersion ?? '',
  };
}

export function createPlatform(
  wx: WxLike,
  clock: { now?: () => number; random?: () => number } = {},
): Platform {
  let system: SystemSnapshot | undefined;
  return {
    getItem<T>(key: string): T | undefined {
      return attempt(() => {
        const value = wx.getStorageSync(STORAGE_PREFIX + key);
        return value === '' || value === undefined || value === null ? undefined : (value as T);
      }, undefined);
    },
    setItem(key, value) {
      attempt(() => wx.setStorageSync(STORAGE_PREFIX + key, value), undefined);
    },
    removeItem(key) {
      attempt(() => wx.removeStorageSync(STORAGE_PREFIX + key), undefined);
    },
    post(options) {
      return new Promise<RequestResult>((resolve) => {
        try {
          wx.request({
            url: options.url,
            method: 'POST',
            data: options.data,
            header: { 'content-type': 'application/json' },
            timeout: options.timeout,
            success: ({ statusCode }) =>
              resolve(
                statusCode >= 200 && statusCode < 300
                  ? { ok: true, status: statusCode }
                  : { ok: false, status: statusCode },
              ),
            fail: () => resolve({ ok: false }),
          });
        } catch {
          resolve({ ok: false });
        }
      });
    },
    now: clock.now ?? (() => Date.now()),
    random: clock.random ?? (() => Math.random()),
    launchOptions: () => attempt(() => wx.getLaunchOptionsSync?.(), undefined),
    enterOptions: () =>
      attempt(() => wx.getEnterOptionsSync?.() ?? wx.getLaunchOptionsSync?.(), undefined),
    account() {
      return attempt(
        () => {
          const mp = wx.getAccountInfoSync?.().miniProgram;
          return {
            appId: mp?.appId ?? '',
            envVersion: mp?.envVersion ?? '',
            version: mp?.version ?? '',
          };
        },
        { appId: '', envVersion: '', version: '' },
      );
    },
    system() {
      system ??= readSystem(wx);
      return system;
    },
    onOnline(listener) {
      attempt(
        () =>
          wx.onNetworkStatusChange?.((result) => {
            if (result.isConnected) listener();
          }),
        undefined,
      );
    },
  };
}
