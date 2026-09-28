import type { Platform } from './platform';
import type { ConsentMode } from './types';
import { isRecord } from './util';

const TRACKING = 'consent';
const COOKIE = 'cookie_consent';

interface Remembered {
  ts: number;
  exp?: number;
}

/**
 * Same semantics as Matomo JS. Tracking consent: no hit is sent until it is given. Cookie consent
 * ("cookies" = the persistent visitor storage): hits are sent, but nothing is stored until it is
 * given. Tracking consent implies cookie consent. `set*` lasts for the session, `remember*` is
 * stored (optionally for `hoursToExpire`). Opt-out always wins.
 */
export class Consent {
  private trackingRequired: boolean;
  private cookieRequired: boolean;
  private given: boolean;
  private cookieGiven: boolean;
  private optedOut: boolean;
  private readonly memo: Record<string, Remembered | undefined> = {};

  constructor(
    private readonly platform: Platform,
    mode: ConsentMode,
  ) {
    this.trackingRequired = mode === 'tracking';
    this.cookieRequired = mode === 'cookie';
    this.given = this.load(TRACKING);
    this.cookieGiven = this.given || this.load(COOKIE);
    this.optedOut = platform.getItem<boolean>('optout') === true;
  }

  requireConsent(): void {
    this.trackingRequired = true;
  }

  /** Session only; also gives cookie consent. */
  setConsentGiven(): void {
    this.given = this.cookieGiven = true;
  }

  rememberConsentGiven(hoursToExpire?: number): void {
    this.remember(TRACKING, hoursToExpire);
    this.setConsentGiven();
  }

  /** Like Matomo JS: tracking consent is required again afterwards, and cookie consent is forgotten. */
  forgetConsentGiven(): void {
    this.given = false;
    this.trackingRequired = true;
    this.forget(TRACKING);
    this.forgetCookieConsentGiven();
  }

  hasRememberedConsent(): boolean {
    return this.getRememberedConsent() !== null;
  }

  /** Timestamp (ms) of the remembered tracking consent, or null. */
  getRememberedConsent(): number | null {
    const r = this.memo[TRACKING];
    return r && !(r.exp !== undefined && this.platform.now() >= r.exp) ? r.ts : null;
  }

  requireCookieConsent(): void {
    this.cookieRequired = true;
  }

  setCookieConsentGiven(): void {
    this.cookieGiven = true;
  }

  rememberCookieConsentGiven(hoursToExpire?: number): void {
    this.remember(COOKIE, hoursToExpire);
    this.cookieGiven = true;
  }

  forgetCookieConsentGiven(): void {
    this.cookieGiven = false;
    this.cookieRequired = true;
    this.forget(COOKIE);
  }

  optOut(): void {
    this.optedOut = true;
    this.platform.setItem('optout', true);
  }

  optIn(): void {
    this.optedOut = false;
    this.platform.removeItem('optout');
  }

  isOptedOut(): boolean {
    return this.optedOut;
  }

  canSend(): boolean {
    return !this.optedOut && (!this.trackingRequired || this.given);
  }

  /** Matomo JS `areCookiesEnabled()`: may the visitor id (and queue) be stored? */
  canPersistVisitor(): boolean {
    return (!this.trackingRequired || this.given) && (!this.cookieRequired || this.cookieGiven);
  }

  /** Reads a remembered consent (a bare timestamp in 0.1.x); drops it once expired. */
  private load(key: string): boolean {
    const v = this.platform.getItem<unknown>(key);
    const r: Remembered | undefined =
      typeof v === 'number'
        ? { ts: v }
        : isRecord(v) && typeof v.ts === 'number'
          ? { ts: v.ts, exp: typeof v.exp === 'number' ? v.exp : undefined }
          : undefined;
    if (r?.exp !== undefined && this.platform.now() >= r.exp) this.forget(key);
    else this.memo[key] = r;
    return this.memo[key] !== undefined;
  }

  private remember(key: string, hours?: number): void {
    const ts = this.platform.now();
    const r: Remembered =
      typeof hours === 'number' && hours > 0 && Number.isFinite(hours)
        ? { ts, exp: ts + hours * 3_600_000 }
        : { ts };
    this.memo[key] = r;
    this.platform.setItem(key, r);
  }

  private forget(key: string): void {
    this.memo[key] = undefined;
    this.platform.removeItem(key);
  }
}
