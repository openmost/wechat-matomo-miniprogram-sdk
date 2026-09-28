import { describe, expect, it } from 'vitest';
import { Consent } from '../src/consent';
import { STORAGE_PREFIX, createPlatform } from '../src/platform';
import { createWxMock } from './wx-mock';

const setup = () => {
  const wx = createWxMock();
  return { wx, platform: createPlatform(wx, { now: () => 1000 }) };
};

describe('Consent', () => {
  it('without consent mode sends and persists', () => {
    const c = new Consent(setup().platform, false);
    expect(c.canSend()).toBe(true);
    expect(c.canPersistVisitor()).toBe(true);
  });

  it('tracking mode waits for consent and remembers it', () => {
    const { wx, platform } = setup();
    const c = new Consent(platform, 'tracking');
    expect(c.canSend()).toBe(false);
    expect(c.canPersistVisitor()).toBe(false);
    c.setConsentGiven();
    expect(c.canSend()).toBe(true);
    expect(c.canPersistVisitor()).toBe(true);
    expect(wx.storage.get(`${STORAGE_PREFIX}consent`)).toBe(1000);
    expect(new Consent(platform, 'tracking').canSend()).toBe(true);
    c.forgetConsentGiven();
    expect(c.canSend()).toBe(false);
    expect(wx.storage.has(`${STORAGE_PREFIX}consent`)).toBe(false);
  });

  it('cookie mode sends but only persists after consent', () => {
    const c = new Consent(setup().platform, 'cookie');
    expect(c.canSend()).toBe(true);
    expect(c.canPersistVisitor()).toBe(false);
    c.setConsentGiven();
    expect(c.canPersistVisitor()).toBe(true);
  });

  it('requireConsent switches a no-consent tracker to tracking mode', () => {
    const c = new Consent(setup().platform, false);
    c.requireConsent();
    expect(c.mode).toBe('tracking');
    expect(c.canSend()).toBe(false);
  });

  it('opt-out blocks everything and persists', () => {
    const { platform } = setup();
    const c = new Consent(platform, false);
    c.optOut();
    expect(c.isOptedOut()).toBe(true);
    expect(c.canSend()).toBe(false);
    expect(new Consent(platform, false).isOptedOut()).toBe(true);
    c.optIn();
    expect(c.canSend()).toBe(true);
    expect(new Consent(platform, false).isOptedOut()).toBe(false);
  });
});
