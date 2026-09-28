import { describe, expect, it } from 'vitest';
import {
  buildHit,
  newPageViewId,
  pageUrl,
  parsePath,
  toQueryString,
  withQuery,
} from '../src/request';

const decode = (q: string) =>
  Object.fromEntries(q.split('&').map((p) => p.split('=').map(decodeURIComponent)));

describe('toQueryString', () => {
  it('encodes and drops undefined', () => {
    expect(toQueryString({ a: 'x y', b: 1, c: undefined, 'd&': '中文' })).toBe(
      'a=x%20y&b=1&d%26=%E4%B8%AD%E6%96%87',
    );
  });
});

describe('page helpers', () => {
  it('builds app:// urls', () => {
    expect(pageUrl('wx1', { route: 'pages/item/item', query: { id: '7', q: 'a b' } })).toBe(
      'app://wx1/pages/item/item?id=7&q=a%20b',
    );
    expect(pageUrl('', { route: 'pages/index/index', query: {} })).toBe(
      'app://miniprogram/pages/index/index',
    );
  });

  it('parses paths with or without leading slash and query', () => {
    expect(parsePath('/pages/item/item?id=7&q=a%20b')).toEqual({
      route: 'pages/item/item',
      query: { id: '7', q: 'a b' },
    });
    expect(parsePath('pages/index/index')).toEqual({ route: 'pages/index/index', query: {} });
    expect(parsePath('pages/x?bad=%E0%A4%A')).toEqual({
      route: 'pages/x',
      query: { bad: '%E0%A4%A' },
    });
  });

  it('adds only missing query keys', () => {
    expect(withQuery('/pages/a/a', { mtm_campaign: 'x' })).toBe('/pages/a/a?mtm_campaign=x');
    expect(withQuery('/pages/a/a?id=1', { mtm_campaign: 'x' })).toBe(
      '/pages/a/a?id=1&mtm_campaign=x',
    );
    expect(withQuery('id=1&mtm_campaign=mine', { mtm_campaign: 'x' })).toBe(
      'id=1&mtm_campaign=mine',
    );
    expect(withQuery('', { a: '1' })).toBe('a=1');
  });

  it('makes 6-char page view ids', () => {
    expect(newPageViewId(Math.random)).toMatch(/^[A-Za-z0-9]{6}$/);
  });
});

describe('buildHit', () => {
  const now = new Date(2026, 8, 28, 14, 5, 9).getTime();
  const ctx = {
    siteId: '3',
    visitor: { _id: 'abcdefabcdefabcd', _idts: 1, _idvc: 2, _viewts: undefined },
    ua: 'UA',
    res: '393x852',
    lang: 'zh-CN',
    userId: 'u1',
    dimensions: { 1: 'vip', 4: 'cn' },
    url: 'app://wx1/pages/index/index',
    now,
    random: () => 0.123456,
  };

  it('merges common and specific params', () => {
    expect(decode(buildHit(ctx, { action_name: 'Home', pv_id: 'AbC123' }))).toEqual({
      idsite: '3',
      rec: '1',
      apiv: '1',
      send_image: '0',
      rand: '123456',
      _id: 'abcdefabcdefabcd',
      _idts: '1',
      _idvc: '2',
      url: 'app://wx1/pages/index/index',
      res: '393x852',
      lang: 'zh-CN',
      ua: 'UA',
      uid: 'u1',
      h: '14',
      m: '5',
      s: '9',
      cdt: String(Math.floor(now / 1000)),
      dimension1: 'vip',
      dimension4: 'cn',
      action_name: 'Home',
      pv_id: 'AbC123',
    });
  });

  it('lets specific params override common ones and omits empty optional ones', () => {
    const q = decode(buildHit({ ...ctx, userId: undefined, res: '' }, { url: 'app://x/y' }));
    expect(q.url).toBe('app://x/y');
    expect(q).not.toHaveProperty('uid');
    expect(q).not.toHaveProperty('res');
  });
});
