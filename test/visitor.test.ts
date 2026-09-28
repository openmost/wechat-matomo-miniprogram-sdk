import { describe, expect, it } from 'vitest';
import { createPlatform, STORAGE_PREFIX } from '../src/platform';
import { VISIT_TIMEOUT_MS, Visitor, generateVisitorId } from '../src/visitor';
import { createWxMock } from './wx-mock';

function setup(start = 1_700_000_000_000) {
  const wx = createWxMock();
  let now = start;
  const platform = createPlatform(wx, { now: () => now, random: () => 0.5 });
  return { wx, platform, advance: (ms: number) => (now += ms) };
}

describe('generateVisitorId', () => {
  it('returns 16 hex characters', () => {
    expect(generateVisitorId(Math.random)).toMatch(/^[0-9a-f]{16}$/);
    expect(generateVisitorId(() => 0.5)).toBe('8888888888888888');
  });
});

describe('Visitor', () => {
  it('starts a visit on first touch and persists the id', () => {
    const { wx, platform } = setup();
    const v = new Visitor(platform, true);
    expect(v.touch()).toEqual({ newVisit: true });
    expect(v.params()).toEqual({ _id: v.id, _idts: 1_700_000_000, _idvc: 1, _viewts: undefined });
    expect(wx.storage.get(`${STORAGE_PREFIX}visitor`)).toMatchObject({ id: v.id, visitCount: 1 });
  });

  it('keeps the visit within 30 minutes and starts a new one after', () => {
    const { platform, advance } = setup();
    const v = new Visitor(platform, true);
    v.touch();
    advance(VISIT_TIMEOUT_MS - 1);
    expect(v.touch()).toEqual({ newVisit: false });
    advance(VISIT_TIMEOUT_MS + 1);
    expect(v.touch()).toEqual({ newVisit: true });
    expect(v.params()).toMatchObject({ _idvc: 2, _viewts: 1_700_000_000 });
  });

  it('restores a persisted visitor', () => {
    const { platform } = setup();
    const first = new Visitor(platform, true);
    first.touch();
    const second = new Visitor(platform, true);
    expect(second.id).toBe(first.id);
    expect(second.params()._idvc).toBe(1);
  });

  it('ignores corrupt storage', () => {
    const { wx, platform } = setup();
    wx.storage.set(`${STORAGE_PREFIX}visitor`, { id: 'not-hex' });
    expect(new Visitor(platform, true).id).toMatch(/^[0-9a-f]{16}$/);
  });

  it('does not persist when persistence is off, and saves once enabled', () => {
    const { wx, platform } = setup();
    const v = new Visitor(platform, false);
    v.touch();
    expect(wx.storage.has(`${STORAGE_PREFIX}visitor`)).toBe(false);
    v.setPersist(true);
    expect(wx.storage.get(`${STORAGE_PREFIX}visitor`)).toMatchObject({ id: v.id });
    v.setPersist(false);
    expect(wx.storage.has(`${STORAGE_PREFIX}visitor`)).toBe(false);
  });

  it('reset creates a new identity and clears storage', () => {
    const { wx, platform } = setup();
    const v = new Visitor(platform, true);
    v.touch();
    const old = v.id;
    let r = 0;
    Object.assign(platform, { random: () => (r = (r + 0.37) % 1) });
    v.reset();
    expect(v.id).not.toBe(old);
    expect(v.params()._idvc).toBe(0);
    expect(wx.storage.has(`${STORAGE_PREFIX}visitor`)).toBe(false);
  });
});
