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

  it('documents every option in both READMEs', () => {
    const en = read('README.md');
    const zh = read('README.zh-CN.md');
    for (const key of ['trackerUrl', 'siteId', ...Object.keys(DEFAULTS), 'userId']) {
      expect(en).toContain(`\`${key}\``);
      expect(zh).toContain(`\`${key}\``);
    }
  });
});
