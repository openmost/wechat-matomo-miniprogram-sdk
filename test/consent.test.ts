import { describe, expect, it } from 'vitest';
import { Consent, Kind } from '../src/consent';
import { STORAGE_PREFIX, createPlatform } from '../src/platform';
import { createWxMock } from './wx-mock';

const HOUR = 3_600_000;

const setup = () => {
  const wx = createWxMock();
  const clock = { t: 1000 };
  return { wx, clock, platform: createPlatform(wx, { now: () => clock.t }) };
};

describe('Consent', () => {
  it('without consent mode sends and persists', () => {
    const c = new Consent(setup().platform, false);
    expect(c.canSend()).toBe(true);
    expect(c.canPersistVisitor()).toBe(true);
  });

  it('setConsentGiven lasts for the session only, like Matomo JS', () => {
    const { wx, platform } = setup();
    const c = new Consent(platform, 'tracking');
    expect(c.canSend()).toBe(false);
    expect(c.canPersistVisitor()).toBe(false);
    c.give(Kind.Tracking);
    expect(c.canSend()).toBe(true);
    expect(c.canPersistVisitor()).toBe(true);
    expect(wx.storage.has(`${STORAGE_PREFIX}consent`)).toBe(false);
    expect(c.rememberedAt(Kind.Tracking)).toBeNull();
    expect(new Consent(platform, 'tracking').canSend()).toBe(false);
  });

  it('rememberConsentGiven persists consent across launches until forgotten', () => {
    const { wx, platform } = setup();
    const c = new Consent(platform, 'tracking');
    c.give(Kind.Tracking, true);
    expect(c.canSend()).toBe(true);
    expect(c.rememberedAt(Kind.Tracking)).not.toBeNull();
    expect(c.rememberedAt(Kind.Tracking)).toBe(1000);
    const next = new Consent(platform, 'tracking');
    expect(next.canSend()).toBe(true);
    expect(next.canPersistVisitor()).toBe(true);
    next.forget(Kind.Tracking);
    expect(next.canSend()).toBe(false);
    expect(next.rememberedAt(Kind.Tracking)).toBeNull();
    expect(next.rememberedAt(Kind.Tracking)).toBeNull();
    expect(wx.storage.has(`${STORAGE_PREFIX}consent`)).toBe(false);
    expect(new Consent(platform, 'tracking').canSend()).toBe(false);
  });

  it('remembered consent expires after hoursToExpire', () => {
    const { wx, clock, platform } = setup();
    new Consent(platform, 'tracking').give(Kind.Tracking, true, 2);
    clock.t += 2 * HOUR - 1;
    const early = new Consent(platform, 'tracking');
    expect(early.canSend()).toBe(true);
    expect(early.rememberedAt(Kind.Tracking)).toBe(1000);
    clock.t += 1;
    // The running session keeps its consent, but the remembered one is gone.
    expect(early.canSend()).toBe(true);
    expect(early.rememberedAt(Kind.Tracking)).toBeNull();
    expect(early.rememberedAt(Kind.Tracking)).toBeNull();
    const late = new Consent(platform, 'tracking');
    expect(late.canSend()).toBe(false);
    expect(wx.storage.has(`${STORAGE_PREFIX}consent`)).toBe(false);
  });

  it('ignores invalid hoursToExpire and remembers without expiry', () => {
    const { clock, platform } = setup();
    for (const hours of [0, -1, NaN, Infinity]) {
      new Consent(platform, 'tracking').give(Kind.Tracking, true, hours);
      clock.t += 1_000_000 * HOUR;
      expect(new Consent(platform, 'tracking').canSend()).toBe(true);
    }
  });

  it('reads consent remembered by 0.1.x (a bare timestamp) as remembered without expiry', () => {
    const { wx, platform } = setup();
    wx.storage.set(`${STORAGE_PREFIX}consent`, 42);
    const c = new Consent(platform, 'tracking');
    expect(c.canSend()).toBe(true);
    expect(c.rememberedAt(Kind.Tracking)).toBe(42);
  });

  it('ignores a malformed remembered value', () => {
    const { wx, platform } = setup();
    wx.storage.set(`${STORAGE_PREFIX}consent`, { ts: 'x' });
    expect(new Consent(platform, 'tracking').canSend()).toBe(false);
  });

  it('cookie mode sends but only persists after cookie consent', () => {
    const c = new Consent(setup().platform, 'cookie');
    expect(c.canSend()).toBe(true);
    expect(c.canPersistVisitor()).toBe(false);
    c.give(Kind.Cookie);
    expect(c.canPersistVisitor()).toBe(true);
  });

  it('tracking consent implies cookie consent', () => {
    const { platform } = setup();
    const c = new Consent(platform, 'cookie');
    c.give(Kind.Tracking);
    expect(c.canPersistVisitor()).toBe(true);
    const r = new Consent(platform, 'cookie');
    r.give(Kind.Tracking, true);
    expect(new Consent(platform, 'cookie').canPersistVisitor()).toBe(true);
  });

  it('cookie consent alone does not allow sending under tracking consent', () => {
    const c = new Consent(setup().platform, 'tracking');
    c.give(Kind.Cookie);
    expect(c.canSend()).toBe(false);
    expect(c.canPersistVisitor()).toBe(false);
    c.give(Kind.Tracking);
    expect(c.canPersistVisitor()).toBe(true);
  });

  it('rememberCookieConsentGiven persists, expires and is forgotten', () => {
    const { wx, clock, platform } = setup();
    new Consent(platform, 'cookie').give(Kind.Cookie, true, 1);
    expect(new Consent(platform, 'cookie').canPersistVisitor()).toBe(true);
    clock.t += HOUR;
    expect(new Consent(platform, 'cookie').canPersistVisitor()).toBe(false);
    expect(wx.storage.has(`${STORAGE_PREFIX}cookie_consent`)).toBe(false);
    const c = new Consent(platform, 'cookie');
    c.give(Kind.Cookie, true);
    c.forget(Kind.Cookie);
    expect(c.canPersistVisitor()).toBe(false);
    expect(new Consent(platform, 'cookie').canPersistVisitor()).toBe(false);
  });

  it('requireCookieConsent disables storage until cookie consent, but keeps sending', () => {
    const c = new Consent(setup().platform, false);
    c.require(Kind.Cookie);
    expect(c.canSend()).toBe(true);
    expect(c.canPersistVisitor()).toBe(false);
    c.give(Kind.Cookie);
    expect(c.canPersistVisitor()).toBe(true);
  });

  it('requireCookieConsent is a no-op when cookie consent was remembered', () => {
    const { platform } = setup();
    new Consent(platform, false).give(Kind.Cookie, true);
    const c = new Consent(platform, false);
    c.require(Kind.Cookie);
    expect(c.canPersistVisitor()).toBe(true);
  });

  it('forgetCookieConsentGiven disables storage even with tracking consent', () => {
    const c = new Consent(setup().platform, false);
    c.give(Kind.Tracking);
    c.forget(Kind.Cookie);
    expect(c.canSend()).toBe(true);
    expect(c.canPersistVisitor()).toBe(false);
    c.give(Kind.Tracking);
    expect(c.canPersistVisitor()).toBe(true);
  });

  it('requireConsent switches a no-consent tracker to tracking mode', () => {
    const c = new Consent(setup().platform, false);
    c.require(Kind.Tracking);
    expect(c.canSend()).toBe(false);
  });

  it('forgetConsentGiven requires tracking consent again and forgets cookie consent', () => {
    for (const mode of [false, 'cookie', 'tracking'] as const) {
      const { wx, platform } = setup();
      const c = new Consent(platform, mode);
      c.give(Kind.Tracking, true);
      c.give(Kind.Cookie, true);
      c.forget(Kind.Tracking);
      expect(c.canSend()).toBe(false);
      expect(c.canPersistVisitor()).toBe(false);
      expect(wx.storage.has(`${STORAGE_PREFIX}cookie_consent`)).toBe(false);
      c.give(Kind.Tracking);
      expect(c.canSend()).toBe(true);
      expect(c.canPersistVisitor()).toBe(true);
    }
  });

  it('persists a withdrawn consent until tracking consent is given, like mtm_consent_removed', () => {
    const { wx, platform } = setup();
    const c = new Consent(platform, false);
    c.give(Kind.Tracking, true);
    c.forget(Kind.Tracking);
    expect(wx.storage.has(`${STORAGE_PREFIX}consent_removed`)).toBe(true);
    const next = new Consent(platform, false);
    expect(next.isRequired()).toBe(true);
    expect(next.canSend()).toBe(false);
    expect(next.rememberedAt(Kind.Tracking)).toBeNull();
    next.give(Kind.Tracking);
    expect(wx.storage.has(`${STORAGE_PREFIX}consent_removed`)).toBe(false);
    expect(new Consent(platform, false).canSend()).toBe(true);
  });

  it('ignores a remembered consent left next to a withdrawal flag', () => {
    const { wx, platform } = setup();
    wx.storage.set(`${STORAGE_PREFIX}consent`, { ts: 5 });
    wx.storage.set(`${STORAGE_PREFIX}consent_removed`, 6);
    const c = new Consent(platform, 'tracking');
    expect(c.canSend()).toBe(false);
    expect(wx.storage.has(`${STORAGE_PREFIX}consent`)).toBe(false);
  });

  it('opt-out blocks everything, wins over consent and persists', () => {
    const { platform } = setup();
    const c = new Consent(platform, false);
    c.give(Kind.Tracking, true);
    c.optOut();
    expect(c.isOptedOut()).toBe(true);
    expect(c.canSend()).toBe(false);
    expect(new Consent(platform, false).isOptedOut()).toBe(true);
    c.optIn();
    expect(c.canSend()).toBe(true);
    expect(new Consent(platform, false).isOptedOut()).toBe(false);
  });
});
