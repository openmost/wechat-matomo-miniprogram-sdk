import type { ConsentMode } from './types';
import { isRecord, stripLeadingSlash } from './util';

export interface MatomoConfig {
  trackerUrl: string;
  siteId: string;
  trackerPath: string;
  autoTrackPages: boolean;
  pageTitles: Record<string, string>;
  excludedRoutes: string[];
  trackShares: boolean;
  trackPayments: boolean;
  shareCampaign: string | false;
  trackScenes: boolean;
  requireConsent: ConsentMode;
  userId?: string;
  customDimensions: Record<number, string>;
  heartbeat: number;
  batchSize: number;
  flushInterval: number;
  maxQueue: number;
  debug: boolean;
  disabled: boolean;
}

export type MatomoOptions = Partial<Omit<MatomoConfig, 'trackerUrl' | 'siteId'>> & {
  trackerUrl: string;
  siteId: number | string;
};

export type ConfigErrorCode =
  | 'required'
  | 'invalid_url'
  | 'https_required'
  | 'invalid_site_id'
  | 'invalid_type'
  | 'out_of_range';

export interface ConfigError {
  field: string;
  code: ConfigErrorCode;
}

export type ConfigResult =
  { ok: true; config: MatomoConfig } | { ok: false; errors: ConfigError[] };

export const DEFAULTS: Omit<MatomoConfig, 'trackerUrl' | 'siteId'> = {
  trackerPath: 'matomo.php',
  autoTrackPages: true,
  pageTitles: {},
  excludedRoutes: [],
  trackShares: true,
  trackPayments: false,
  shareCampaign: 'wechat_share',
  trackScenes: true,
  requireConsent: false,
  customDimensions: {},
  heartbeat: 15,
  batchSize: 20,
  flushInterval: 5000,
  maxQueue: 500,
  debug: false,
  disabled: false,
};

const BOOLEAN_KEYS = [
  'autoTrackPages',
  'trackShares',
  'trackPayments',
  'trackScenes',
  'debug',
  'disabled',
] as const;

const RANGES = {
  heartbeat: [0, 300],
  batchSize: [1, 50],
  flushInterval: [1000, 60000],
  maxQueue: [10, 1000],
} as const;

/**
 * Accepts what people paste (tracker file, index.php, query, hash) and returns the Matomo base URL
 * with a trailing slash. No `URL` global exists in the mini program runtime, hence the regex.
 */
export function normalizeTrackerUrl(
  input: string,
): { ok: true; url: string } | { ok: false; code: 'invalid_url' | 'https_required' } {
  const match = /^([a-z][a-z0-9+.-]*):\/\/([^/?#\s]+)([^?#\s]*)/i.exec(input.trim());
  if (!match) return { ok: false, code: 'invalid_url' };
  const [, scheme = '', host = '', rawPath = ''] = match;
  if (host.includes('@')) return { ok: false, code: 'invalid_url' };
  if (scheme.toLowerCase() !== 'https') return { ok: false, code: 'https_required' };
  let path = rawPath.replace(/\/(matomo|piwik)\.(php|js)$/i, '/').replace(/\/index\.php$/i, '/');
  if (!path.endsWith('/')) path += '/';
  return { ok: true, url: `https://${host.toLowerCase()}${path}` };
}

export function parseConfig(input: unknown): ConfigResult {
  if (!isRecord(input)) return { ok: false, errors: [{ field: 'config', code: 'invalid_type' }] };
  const errors: ConfigError[] = [];
  const config: MatomoConfig = {
    ...DEFAULTS,
    pageTitles: {},
    excludedRoutes: [],
    customDimensions: {},
    trackerUrl: '',
    siteId: '',
  };

  if (typeof input.trackerUrl !== 'string' || input.trackerUrl.trim() === '') {
    errors.push({ field: 'trackerUrl', code: 'required' });
  } else {
    const url = normalizeTrackerUrl(input.trackerUrl);
    if (url.ok) config.trackerUrl = url.url;
    else errors.push({ field: 'trackerUrl', code: url.code });
  }

  const siteId = typeof input.siteId === 'number' ? String(input.siteId) : input.siteId;
  if (siteId === undefined || siteId === '') errors.push({ field: 'siteId', code: 'required' });
  else if (typeof siteId !== 'string' || !/^[1-9]\d*$/.test(siteId))
    errors.push({ field: 'siteId', code: 'invalid_site_id' });
  else config.siteId = siteId;

  if (input.trackerPath !== undefined) {
    if (typeof input.trackerPath === 'string' && /^\/*[\w.-]+(\/[\w.-]+)*$/.test(input.trackerPath))
      config.trackerPath = stripLeadingSlash(input.trackerPath);
    else errors.push({ field: 'trackerPath', code: 'invalid_type' });
  }

  for (const key of BOOLEAN_KEYS) {
    const value = input[key];
    if (value === undefined) continue;
    if (typeof value === 'boolean') config[key] = value;
    else errors.push({ field: key, code: 'invalid_type' });
  }

  for (const key of Object.keys(RANGES) as Array<keyof typeof RANGES>) {
    const value = input[key];
    if (value === undefined) continue;
    const [min, max] = RANGES[key];
    if (typeof value !== 'number' || !Number.isInteger(value))
      errors.push({ field: key, code: 'invalid_type' });
    else if (value < min || value > max) errors.push({ field: key, code: 'out_of_range' });
    else config[key] = value;
  }

  if (input.pageTitles !== undefined) {
    const titles = input.pageTitles;
    if (isRecord(titles) && Object.values(titles).every((v) => typeof v === 'string')) {
      for (const [route, title] of Object.entries(titles))
        config.pageTitles[stripLeadingSlash(route)] = title as string;
    } else errors.push({ field: 'pageTitles', code: 'invalid_type' });
  }

  if (input.excludedRoutes !== undefined) {
    const routes = input.excludedRoutes;
    if (Array.isArray(routes) && routes.every((r) => typeof r === 'string'))
      config.excludedRoutes = routes.map((r: string) => stripLeadingSlash(r));
    else errors.push({ field: 'excludedRoutes', code: 'invalid_type' });
  }

  if (input.shareCampaign !== undefined) {
    const c = input.shareCampaign;
    if (c === false || (typeof c === 'string' && c.trim() !== ''))
      config.shareCampaign = c === false ? false : c.trim();
    else errors.push({ field: 'shareCampaign', code: 'invalid_type' });
  }

  if (input.requireConsent !== undefined) {
    const mode = input.requireConsent;
    if (mode === false || mode === 'tracking' || mode === 'cookie') config.requireConsent = mode;
    else errors.push({ field: 'requireConsent', code: 'invalid_type' });
  }

  if (input.userId !== undefined) {
    if (typeof input.userId === 'string' && input.userId.trim() !== '')
      config.userId = input.userId.trim();
    else errors.push({ field: 'userId', code: 'invalid_type' });
  }

  if (input.customDimensions !== undefined) {
    if (!isRecord(input.customDimensions)) {
      errors.push({ field: 'customDimensions', code: 'invalid_type' });
    } else {
      for (const [key, value] of Object.entries(input.customDimensions)) {
        const index = Number(key);
        if (!Number.isInteger(index) || index < 1 || index > 999)
          errors.push({ field: `customDimensions.${key}`, code: 'out_of_range' });
        else if (typeof value !== 'string')
          errors.push({ field: `customDimensions.${key}`, code: 'invalid_type' });
        else config.customDimensions[index] = value;
      }
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, config };
}
