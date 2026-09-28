/** Tracking API parameters before URL encoding; `undefined` values are dropped. */
export type Params = Record<string, string | number | undefined>;

/** Mirrors Matomo JS: `tracking` = requireConsent, `cookie` = requireCookieConsent. */
export type ConsentMode = false | 'tracking' | 'cookie';

/** Subset of wx.getEnterOptionsSync() / wx.getLaunchOptionsSync() the SDK relies on. */
export interface EnterOptions {
  path: string;
  scene: number;
  query: Record<string, string>;
  referrerInfo?: { appId?: string; extraData?: unknown };
}

/** Device, window and app info merged from the split wx APIs or legacy getSystemInfoSync. */
export interface SystemSnapshot {
  brand: string;
  model: string;
  system: string;
  platform: string;
  screenWidth: number;
  screenHeight: number;
  pixelRatio: number;
  language: string;
  wechatVersion: string;
  sdkVersion: string;
}

export interface AccountSnapshot {
  appId: string;
  envVersion: string;
  version: string;
}

export interface RequestOptions {
  url: string;
  /** JSON body. */
  data: string;
  timeout: number;
}

/** Network calls never reject: failures are values. */
export type RequestResult = { ok: true; status: number } | { ok: false; status?: number };
