import { describe, expect, it } from 'vitest';
import { SCENE_MAP, resolveAttribution } from '../src/attribution';

const opts = (scene: number, query: Record<string, string> = {}, appId?: string) => ({
  path: 'pages/index/index',
  scene,
  query,
  referrerInfo: appId ? { appId } : undefined,
});

describe('resolveAttribution', () => {
  it('uses explicit campaign parameters first', () => {
    expect(
      resolveAttribution(
        opts(1007, { mtm_campaign: 'spring', utm_source: 'kol', other: 'x' }),
        true,
      ),
    ).toEqual({ params: { mtm_campaign: 'spring', utm_source: 'kol' } });
  });

  it('maps a chat share scene to a campaign', () => {
    expect(resolveAttribution(opts(1007), true)).toEqual({
      params: {
        mtm_campaign: 'wechat_share',
        mtm_source: 'wechat',
        mtm_medium: 'share',
        mtm_kwd: '1007',
      },
    });
  });

  it('uses the referrer app id for mini program to mini program jumps', () => {
    expect(resolveAttribution(opts(1037, {}, 'wxabc'), true).params).toMatchObject({
      mtm_campaign: 'wechat_miniprogram',
      mtm_kwd: 'wxabc',
    });
  });

  it('treats direct scenes as direct entries', () => {
    expect(resolveAttribution(opts(1001), true)).toEqual({ params: {} });
    expect(resolveAttribution(opts(1089), true)).toEqual({ params: {} });
  });

  it('labels unknown scenes as other', () => {
    expect(resolveAttribution(opts(9999), true).params).toMatchObject({
      mtm_campaign: 'wechat_other',
      mtm_kwd: '9999',
    });
  });

  it('can disable scene tracking but keeps explicit campaigns', () => {
    expect(resolveAttribution(opts(1007), false)).toEqual({ params: {} });
    expect(resolveAttribution(opts(1007, { utm_campaign: 'x' }), false)).toEqual({
      params: { utm_campaign: 'x' },
    });
  });

  it('handles missing options and query', () => {
    expect(resolveAttribution(undefined, true)).toEqual({ params: {} });
    expect(
      resolveAttribution(
        { path: '', scene: 1011, query: undefined as unknown as Record<string, string> },
        true,
      ).params.mtm_medium,
    ).toBe('qrcode');
  });

  it('every mapped scene has a medium and label', () => {
    for (const info of Object.values(SCENE_MAP)) {
      if (info) expect(info.medium && info.label).toBeTruthy();
    }
  });
});
