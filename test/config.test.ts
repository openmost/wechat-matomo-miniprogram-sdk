import { describe, expect, it } from 'vitest';
import { DEFAULTS, normalizeTrackerUrl, parseConfig } from '../src/config';

describe('normalizeTrackerUrl', () => {
  it.each([
    ['https://stats.example.cn', 'https://stats.example.cn/'],
    ['https://Stats.Example.cn/matomo.php', 'https://stats.example.cn/'],
    ['https://example.cn/analytics/piwik.php?x=1#y', 'https://example.cn/analytics/'],
    ['https://example.cn/analytics/index.php', 'https://example.cn/analytics/'],
    ['  https://example.cn/analytics  ', 'https://example.cn/analytics/'],
    ['https://example.cn:8443/m/matomo.js', 'https://example.cn:8443/m/'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeTrackerUrl(input)).toEqual({ ok: true, url: expected });
  });

  it('requires https', () => {
    expect(normalizeTrackerUrl('http://example.cn')).toEqual({ ok: false, code: 'https_required' });
  });

  it.each(['example.cn', 'ftp//x', 'https://user:pw@example.cn', ''])('rejects %s', (input) => {
    expect(normalizeTrackerUrl(input)).toEqual({ ok: false, code: 'invalid_url' });
  });
});

describe('parseConfig', () => {
  const base = { trackerUrl: 'https://stats.example.cn', siteId: 3 };

  it('applies defaults', () => {
    const result = parseConfig(base);
    expect(result).toEqual({
      ok: true,
      config: { ...DEFAULTS, trackerUrl: 'https://stats.example.cn/', siteId: '3' },
    });
  });

  it('defaults match the spec', () => {
    expect(DEFAULTS).toMatchObject({
      trackerPath: 'matomo.php',
      autoTrackPages: true,
      trackShares: true,
      shareCampaign: 'wechat_share',
      trackScenes: true,
      requireConsent: false,
      heartbeat: 15,
      batchSize: 20,
      flushInterval: 5000,
      maxQueue: 500,
      debug: false,
      disabled: false,
    });
  });

  it('accepts string site ids and custom values', () => {
    const result = parseConfig({
      ...base,
      siteId: '12',
      trackerPath: '/js/tracker.php',
      requireConsent: 'cookie',
      customDimensions: { 1: 'vip', '2': 'cn' },
      pageTitles: { 'pages/index/index': 'Home' },
      excludedRoutes: ['/pages/debug/'],
      shareCampaign: false,
      userId: '  u-1 ',
      heartbeat: 0,
    });
    expect(result.ok && result.config).toMatchObject({
      siteId: '12',
      trackerPath: 'js/tracker.php',
      requireConsent: 'cookie',
      customDimensions: { 1: 'vip', 2: 'cn' },
      pageTitles: { 'pages/index/index': 'Home' },
      excludedRoutes: ['pages/debug/'],
      shareCampaign: false,
      userId: 'u-1',
      heartbeat: 0,
    });
  });

  it('collects every error with a code', () => {
    const result = parseConfig({
      trackerUrl: 'http://x.cn',
      siteId: 0,
      heartbeat: 999,
      batchSize: 1.5,
      debug: 'yes',
      requireConsent: 'always',
      customDimensions: { 1000: 'x', 3: 4 },
    });
    expect(result).toEqual({
      ok: false,
      errors: expect.arrayContaining([
        { field: 'trackerUrl', code: 'https_required' },
        { field: 'siteId', code: 'invalid_site_id' },
        { field: 'heartbeat', code: 'out_of_range' },
        { field: 'batchSize', code: 'invalid_type' },
        { field: 'debug', code: 'invalid_type' },
        { field: 'requireConsent', code: 'invalid_type' },
        { field: 'customDimensions.1000', code: 'out_of_range' },
        { field: 'customDimensions.3', code: 'invalid_type' },
      ]),
    });
  });

  it('requires trackerUrl and siteId', () => {
    expect(parseConfig({})).toEqual({
      ok: false,
      errors: [
        { field: 'trackerUrl', code: 'required' },
        { field: 'siteId', code: 'required' },
      ],
    });
  });

  it('rejects non-objects', () => {
    expect(parseConfig(null)).toEqual({
      ok: false,
      errors: [{ field: 'config', code: 'invalid_type' }],
    });
  });
});
