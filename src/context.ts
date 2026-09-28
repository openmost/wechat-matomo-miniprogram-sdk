import type { Platform } from './platform';
import type { SystemSnapshot } from './types';

export interface DeviceContext {
  ua: string;
  res: string;
  lang: string;
  appId: string;
}

/** Version number part of "iOS 17.4.1" / "Android 13" / "HarmonyOS 5.0". */
const osVersion = (system: string): string => /(\d+(?:[._]\d+)*)/.exec(system)?.[1] ?? '';

/**
 * wx.request cannot override User-Agent, so the SDK sends a WeChat-like UA in the `ua` parameter
 * so Matomo's DeviceDetector reports the right OS, device type and "WeChat" browser.
 */
export function buildUserAgent(s: SystemSnapshot): string {
  const mm = `MicroMessenger/${s.wechatVersion} miniProgram`;
  const version = osVersion(s.system);
  switch (s.platform) {
    case 'ios': {
      const v = version.replace(/\./g, '_');
      const device = /ipad/i.test(s.model) ? `iPad; CPU OS ${v}` : `iPhone; CPU iPhone OS ${v}`;
      return `Mozilla/5.0 (${device} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 ${mm}`;
    }
    case 'android':
      return `Mozilla/5.0 (Linux; Android ${version}; ${s.model}) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Mobile Safari/537.36 ${mm}`;
    case 'ohos':
      return `Mozilla/5.0 (Linux; OpenHarmony ${version}; ${s.model}) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 ${mm}`;
    case 'windows':
      return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ${mm}`;
    case 'mac':
      return `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) ${mm}`;
    case 'devtools':
      return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) wechatdevtools ${mm}`;
    default:
      return `Mozilla/5.0 (Linux) ${mm}`;
  }
}

export function getDeviceContext(platform: Platform): DeviceContext {
  const s = platform.system();
  // Physical pixels, like Matomo JS (screen size × devicePixelRatio).
  const ratio = s.pixelRatio > 0 ? s.pixelRatio : 1;
  return {
    ua: buildUserAgent(s),
    res:
      s.screenWidth > 0 && s.screenHeight > 0
        ? `${Math.round(s.screenWidth * ratio)}x${Math.round(s.screenHeight * ratio)}`
        : '',
    lang: s.language.replace(/_/g, '-'),
    appId: platform.account().appId,
  };
}
