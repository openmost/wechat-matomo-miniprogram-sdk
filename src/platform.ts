import type { EnterOptions } from './types';

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
