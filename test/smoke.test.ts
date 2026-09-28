import { describe, expect, it } from 'vitest';
import { createWxMock } from './wx-mock';

describe('wx mock', () => {
  it('returns an empty string for missing storage keys like WeChat', () => {
    expect(createWxMock().getStorageSync('nope')).toBe('');
  });
});
