import type { Platform } from './platform';
import type { ConsentMode } from './types';

/**
 * Same semantics as Matomo JS: `tracking` sends nothing until consent; `cookie` sends hits but keeps
 * the visitor id in memory only until consent. Opt-out always wins.
 */
export class Consent {
  private given: boolean;
  private optedOut: boolean;

  constructor(
    private readonly platform: Platform,
    private currentMode: ConsentMode,
  ) {
    this.given = platform.getItem<number>('consent') !== undefined;
    this.optedOut = platform.getItem<boolean>('optout') === true;
  }

  get mode(): ConsentMode {
    return this.currentMode;
  }

  requireConsent(): void {
    if (this.currentMode === false) this.currentMode = 'tracking';
  }

  setConsentGiven(): void {
    this.given = true;
    this.platform.setItem('consent', this.platform.now());
  }

  forgetConsentGiven(): void {
    this.given = false;
    this.platform.removeItem('consent');
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
    return !this.optedOut && (this.currentMode !== 'tracking' || this.given);
  }

  canPersistVisitor(): boolean {
    return this.currentMode === false || this.given;
  }
}
