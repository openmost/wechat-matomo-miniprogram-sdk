import { describe, expect, it, vi } from 'vitest';
import { guard, isRecord, stripLeadingSlash } from '../src/util';

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

describe('guard', () => {
  it('runs the function and reports exceptions instead of throwing', () => {
    const onError = vi.fn();
    const fn = vi.fn();
    guard(fn, onError);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
    const boom = new Error('boom');
    expect(() =>
      guard(() => {
        throw boom;
      }, onError),
    ).not.toThrow();
    expect(onError).toHaveBeenCalledWith(boom);
  });
});
