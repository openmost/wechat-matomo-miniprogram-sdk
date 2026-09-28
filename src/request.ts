import type { Params } from './types';
import { stripLeadingSlash } from './util';

export interface PageRef {
  route: string;
  query: Record<string, string>;
}

export interface CommonContext {
  siteId: string;
  visitor: Params;
  ua: string;
  res: string;
  lang: string;
  userId?: string;
  dimensions: Record<number, string>;
  url: string;
  now: number;
  random: () => number;
}

const safeDecode = (s: string): string => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

export function toQueryString(params: Params): string {
  return Object.keys(params)
    .filter((k) => params[k] !== undefined)
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(params[k]))}`)
    .join('&');
}

function parseQuery(qs: string): Record<string, string> {
  const query: Record<string, string> = {};
  for (const pair of qs.split('&')) {
    if (pair === '') continue;
    const i = pair.indexOf('=');
    const key = safeDecode(i === -1 ? pair : pair.slice(0, i));
    query[key] = i === -1 ? '' : safeDecode(pair.slice(i + 1));
  }
  return query;
}

/** Matomo page URL for a mini program route: app://<appId>/<route>?<query>. */
export function pageUrl(appId: string, page: PageRef): string {
  const qs = toQueryString(page.query);
  return `app://${appId || 'miniprogram'}/${page.route}${qs ? `?${qs}` : ''}`;
}

export function parsePath(path: string): PageRef {
  const [rawRoute = '', qs = ''] = path.split('?', 2);
  return { route: stripLeadingSlash(rawRoute), query: parseQuery(qs) };
}

/**
 * Appends params that are not already present. Works on "path?query" and on a bare query string
 * (onShareTimeline returns `query` without a path).
 */
export function withQuery(base: string, params: Record<string, string>): string {
  const hasPath = base.includes('?') || (base !== '' && !base.includes('='));
  const [path, qs = ''] = hasPath ? (base.split('?', 2) as [string, string?]) : ['', base];
  const existing = parseQuery(qs);
  const added: Params = {};
  for (const [k, v] of Object.entries(params)) if (!(k in existing)) added[k] = v;
  const extra = toQueryString(added);
  const merged = [qs, extra].filter(Boolean).join('&');
  if (!hasPath) return merged;
  return merged ? `${path}?${merged}` : path;
}

const PV_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function newPageViewId(random: () => number): string {
  let id = '';
  for (let i = 0; i < 6; i++) id += PV_CHARS.charAt(Math.floor(random() * PV_CHARS.length));
  return id;
}

/** One Matomo Tracking HTTP API request, as a query string without the leading "?". */
export function buildHit(ctx: CommonContext, specific: Params): string {
  const date = new Date(ctx.now);
  const dims: Params = {};
  for (const [index, value] of Object.entries(ctx.dimensions)) dims[`dimension${index}`] = value;
  return toQueryString({
    idsite: ctx.siteId,
    rec: 1,
    apiv: 1,
    send_image: 0,
    rand: String(ctx.random()).slice(2, 8),
    ...ctx.visitor,
    url: ctx.url,
    res: ctx.res || undefined,
    lang: ctx.lang || undefined,
    ua: ctx.ua,
    uid: ctx.userId,
    h: date.getHours(),
    m: date.getMinutes(),
    s: date.getSeconds(),
    cdt: Math.floor(ctx.now / 1000),
    ...dims,
    ...specific,
  });
}
