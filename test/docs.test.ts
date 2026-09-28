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
});
