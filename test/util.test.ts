import { describe, expect, it } from 'vitest';
import { isRecord, stripLeadingSlash } from '../src/util';

describe('isRecord', () => {
  it('accepts plain objects only', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ a: 1 })).toBe(true);
    expect(isRecord(null)).toBe(false);
    expect(isRecord([])).toBe(false);
    expect(isRecord('x')).toBe(false);
    expect(isRecord(undefined)).toBe(false);
  });
});

describe('stripLeadingSlash', () => {
  it('removes every leading slash and nothing else', () => {
    expect(stripLeadingSlash('//pages/a/a/')).toBe('pages/a/a/');
    expect(stripLeadingSlash('pages/a')).toBe('pages/a');
    expect(stripLeadingSlash('')).toBe('');
  });
});
