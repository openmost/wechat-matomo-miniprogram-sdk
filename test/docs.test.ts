import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SCENE_MAP } from '../src/attribution';
import { DEFAULTS } from '../src/config';
import { MatomoTracker } from '../src/index';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('docs stay in sync with code', () => {
  it('lists every mapped scene in docs/scenes.md', () => {
    const doc = read('docs/scenes.md');
    for (const id of Object.keys(SCENE_MAP)) expect(doc).toContain(`| ${id} |`);
  });

  it('documents every public method in docs/api.md', () => {
    const doc = read('docs/api.md');
    // Private prototype methods of MatomoTracker (Task 12); `onError` is an instance arrow, not listed.
    const internal = [
      'constructor',
      'hooks',
      'share',
      'pageView',
      'heartbeat',
      'track',
      'run',
      'consent',
      'read',
      'log',
    ];
    const methods = Object.getOwnPropertyNames(MatomoTracker.prototype).filter(
      (n) => !internal.includes(n),
    );
    for (const m of methods) expect(doc).toContain(`### ${m}(`);
  });

  it('documents every option in all three READMEs', () => {
    const zhCN = read('README.md');
    const zhTW = read('README.zh-TW.md');
    const en = read('README.en.md');
    for (const key of ['trackerUrl', 'siteId', ...Object.keys(DEFAULTS), 'userId']) {
      expect(zhCN).toContain(`\`${key}\``);
      expect(zhTW).toContain(`\`${key}\``);
      expect(en).toContain(`\`${key}\``);
    }
  });

  it('keeps the same sections and GA4-style event example in all three READMEs', () => {
    const zhCN = read('README.md');
    const zhTW = read('README.zh-TW.md');
    const en = read('README.en.md');

    // Same number of headings, in the same relative structure.
    const headingLevels = (doc: string) =>
      doc
        .split('\n')
        .filter((line) => /^#{1,6} /.test(line))
        .map((line) => line.match(/^#+/)?.[0].length);
    expect(headingLevels(zhTW)).toEqual(headingLevels(zhCN));
    expect(headingLevels(en)).toEqual(headingLevels(zhCN));

    // Same language-switch line shape: current language plain, the other two linked.
    expect(zhCN.split('\n')[2]).toBe(
      '简体中文 | [繁體中文](README.zh-TW.md) | [English](README.en.md)',
    );
    expect(zhTW.split('\n')[2]).toBe('[簡體中文](README.md) | 繁體中文 | [English](README.en.md)');
    expect(en.split('\n')[2]).toBe('[简体中文](README.md) | [繁體中文](README.zh-TW.md) | English');

    // Same GA4-style trackEvent example in every language.
    const ga4Example = "Matomo.trackEvent('Product', 'Add to cart', 'add_to_cart', 59.9);";
    expect(zhCN).toContain(ga4Example);
    expect(zhTW).toContain(ga4Example);
    expect(en).toContain(ga4Example);
  });

  it('describes the consent API and the automatic GA4-style events in all three READMEs', () => {
    const terms = [
      'requireConsent',
      'setConsentGiven',
      'rememberConsentGiven(hoursToExpire?)',
      'forgetConsentGiven',
      'hasRememberedConsent',
      'getRememberedConsent',
      'isConsentRequired',
      'requireCookieConsent',
      'setCookieConsentGiven',
      'rememberCookieConsentGiven(hoursToExpire?)',
      'forgetCookieConsentGiven',
      'getRememberedCookieConsent',
      'areCookiesEnabled',
      'optOut',
      'Share to chat',
      'share_to_chat',
      'Share to Moments',
      'share_to_moments',
      'Begin checkout',
      'begin_checkout',
      'Purchase',
      'purchase',
      'Payment cancelled',
      'payment_cancelled',
      'Payment failed',
      'payment_failed',
      'requestPayment:fail cancel',
      'Matomo.trackEcommerceOrder(orderId, 119.8);',
    ];
    for (const doc of ['README.md', 'README.zh-TW.md', 'README.en.md'].map(read))
      for (const term of terms) expect(doc).toContain(term);
    for (const doc of ['README.md', 'README.zh-TW.md', 'README.en.md'].map(read))
      for (const term of ['Payment started', 'Payment completed', '/ `share` '])
        expect(doc).not.toContain(term);
  });

  it('documents the event naming convention in all three READMEs and docs/api.md', () => {
    const rows = [
      '| `Ecommerce` | `Begin checkout`',
      '| `Ecommerce` | `Purchase`',
      '| `Ecommerce` | `Payment cancelled`',
      '| `Ecommerce` | `Payment failed`',
      '| `Share`     | `Share to chat`',
      '| `Share`     | `Share to Moments`',
      '| `Auth`      | `Login`',
      '| `Auth`      | `Sign up`',
    ];
    const ga4 = 'https://support.google.com/analytics/answer/9267735?hl=en';
    for (const doc of ['README.md', 'README.zh-TW.md', 'README.en.md', 'docs/api.md'].map(read)) {
      for (const row of rows) expect(doc).toContain(row);
      for (const name of ['`login`', '`sign_up`', 'setUserId']) expect(doc).toContain(name);
      expect(doc).toContain(ga4);
    }
  });

  it('points to Openmost in a callout before Install in all three READMEs', () => {
    for (const doc of ['README.md', 'README.zh-TW.md', 'README.en.md'].map(read)) {
      const tip = doc.indexOf('> [!TIP]');
      expect(tip).toBeGreaterThan(0);
      expect(tip).toBeLessThan(doc.indexOf('npm i @openmost/wechat-matomo-miniprogram-sdk'));
      const callout = doc.slice(tip, doc.indexOf('\n\n', tip));
      expect(callout).toContain('https://openmost.com · ronan@openmost.com');
    }
  });

  it('never offers hosting and uses one contact address', () => {
    const docs = ['README.md', 'README.zh-TW.md', 'README.en.md', 'docs/api.md', 'package.json'];
    for (const doc of docs.map(read)) {
      for (const term of [
        'support@openmost.com',
        '托管',
        '託管',
        'hosting',
        'snake_case GA4 event name',
      ])
        expect(doc).not.toContain(term);
    }
  });
});
