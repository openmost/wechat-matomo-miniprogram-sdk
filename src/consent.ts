import type { Platform } from './platform';
import type { ConsentMode } from './types';
import { isRecord } from './util';

/** Consent kinds, as indexes into the state arrays below. */
export const enum Kind {
  Tracking,
  Cookie,
}

/** Storage keys of the remembered consents (tracking kept its 0.1.x key). */
const KEYS = ['consent', 'cookie_consent'];
/** Matomo JS `mtm_consent_removed`: tracking consent was withdrawn and not given since. */
const REMOVED = 'consent_removed';

interface Remembered {
  ts: number;
  exp?: number;
}

/**
 * Same semantics as Matomo JS. Tracking consent: no hit is sent until it is given. Cookie consent
 * ("cookies" = the persistent visitor storage): hits are sent, but nothing is stored until it is
 * given. Tracking consent implies cookie consent. A consent given without `remember` lasts for the
 * session; a remembered one is stored, optionally for `hoursToExpire`. Opt-out always wins.
 */
export class Consent {
  /** Per kind: is consent required, is it given (session or remembered)? */
  private readonly required: boolean[];
  private readonly given: boolean[];
  private readonly stored: Array<Remembered | undefined> = [];
  private optedOut: boolean;

  constructor(
    private readonly platform: Platform,
    mode: ConsentMode,
  ) {
    // A withdrawn consent requires tracking consent again, whatever the mode, and voids any
    // remembered one (Matomo JS `getRememberedConsent()` deletes it too).
    const removed = platform.getItem<unknown>(REMOVED) !== undefined;
    if (removed) platform.removeItem(KEYS[Kind.Tracking] as string);
    this.required = [removed || mode === 'tracking', mode === 'cookie'];
    const tracking = !removed && this.load(Kind.Tracking);
    this.given = [tracking, this.load(Kind.Cookie) || tracking];
    this.optedOut = platform.getItem<boolean>('optout') === true;
  }

  /** Matomo JS `requireConsent()` / `requireCookieConsent()`. */
  require(kind: Kind): void {
    this.required[kind] = true;
  }

  /** Matomo JS `set*ConsentGiven()`, or `remember*ConsentGiven(hoursToExpire)` with `remember`. */
  give(kind: Kind, remember = false, hoursToExpire?: number): void {
    if (remember) {
      const ts = this.platform.now();
      const r: Remembered = { ts };
      if (typeof hoursToExpire === 'number' && hoursToExpire > 0 && hoursToExpire < Infinity)
        r.exp = ts + hoursToExpire * 3_600_000;
      this.stored[kind] = r;
      this.platform.setItem(KEYS[kind] as string, r);
    }
    this.given[kind] = true;
    if (kind === Kind.Tracking) {
      this.given[Kind.Cookie] = true;
      this.platform.removeItem(REMOVED);
    }
  }

  /**
   * Matomo JS `forget*ConsentGiven()`: withdraws the session and remembered consent and requires it
   * again; forgetting tracking consent also forgets cookie consent, and is remembered (next launches
   * require tracking consent too) until tracking consent is given.
   */
  forget(kind: Kind): void {
    this.given[kind] = false;
    this.required[kind] = true;
    this.stored[kind] = undefined;
    this.platform.removeItem(KEYS[kind] as string);
    if (kind === Kind.Tracking) {
      this.platform.setItem(REMOVED, this.platform.now());
      this.forget(Kind.Cookie);
    }
  }

  /** Matomo JS `isConsentRequired()`: is tracking consent required? */
  isRequired(): boolean {
    return this.required[Kind.Tracking] === true;
  }

  /** Timestamp (ms) of the remembered, unexpired consent of that kind, or null. */
  rememberedAt(kind: Kind): number | null {
    const r = this.stored[kind];
    return r && !(this.platform.now() >= (r.exp ?? Infinity)) ? r.ts : null;
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
    return !this.optedOut && this.has(Kind.Tracking);
  }

  /**
   * May stored visitor data be used? False while opted out or while cookie consent is required and
   * not given: the stored data is then removed, like Matomo JS `deleteCookies()`.
   */
  canReadStorage(): boolean {
    return !this.optedOut && this.has(Kind.Cookie);
  }

  /**
   * Matomo JS `areCookiesEnabled()`: may the visitor id (and queue) be written? While tracking
   * consent is pending the stored visitor is read but not written, like Matomo JS `_pk_id`.
   */
  canPersistVisitor(): boolean {
    return this.canReadStorage() && this.has(Kind.Tracking);
  }

  private has(kind: Kind): boolean {
    return !this.required[kind] || this.given[kind] === true;
  }

  /** Reads a remembered consent (a bare timestamp in 0.1.x); drops it once expired. */
  private load(kind: Kind): boolean {
    const v = this.platform.getItem<unknown>(KEYS[kind] as string);
    const r = typeof v === 'number' ? { ts: v } : isRecord(v) ? (v as Partial<Remembered>) : {};
    const exp = typeof r.exp === 'number' ? r.exp : undefined;
    if (typeof r.ts !== 'number') return false;
    if (this.platform.now() >= (exp ?? Infinity)) {
      this.platform.removeItem(KEYS[kind] as string);
      return false;
    }
    this.stored[kind] = { ts: r.ts, exp };
    return true;
  }
}
