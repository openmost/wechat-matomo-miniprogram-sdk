import { describe, expect, it } from 'vitest';
import { createPlatform, STORAGE_PREFIX } from '../src/platform';
import { Storage, VISIT_TIMEOUT_MS, Visitor, generateVisitorId } from '../src/visitor';
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
    const v = new Visitor(platform, Storage.Write);
    expect(v.touch()).toEqual({ newVisit: true });
    expect(v.params()).toEqual({ _id: v.id, _idts: 1_700_000_000, _idvc: 1, _viewts: undefined });
    expect(wx.storage.get(`${STORAGE_PREFIX}visitor`)).toMatchObject({ id: v.id, visitCount: 1 });
  });

  it('keeps the visit within 30 minutes and starts a new one after', () => {
    const { platform, advance } = setup();
    const v = new Visitor(platform, Storage.Write);
    v.touch();
    advance(VISIT_TIMEOUT_MS - 1);
    expect(v.touch()).toEqual({ newVisit: false });
    advance(VISIT_TIMEOUT_MS + 1);
    expect(v.touch()).toEqual({ newVisit: true });
    expect(v.params()).toMatchObject({ _idvc: 2, _viewts: 1_700_000_000 });
  });

  it('restores a persisted visitor', () => {
    const { platform } = setup();
    const first = new Visitor(platform, Storage.Write);
    first.touch();
    const second = new Visitor(platform, Storage.Write);
    expect(second.id).toBe(first.id);
    expect(second.params()._idvc).toBe(1);
  });

  it('ignores corrupt storage', () => {
    const { wx, platform } = setup();
    wx.storage.set(`${STORAGE_PREFIX}visitor`, { id: 'not-hex' });
    expect(new Visitor(platform, Storage.Write).id).toMatch(/^[0-9a-f]{16}$/);
  });

  it('does not persist without storage, and saves once enabled', () => {
    const { wx, platform } = setup();
    const v = new Visitor(platform, Storage.None);
    v.touch();
    expect(wx.storage.has(`${STORAGE_PREFIX}visitor`)).toBe(false);
    v.setStorage(Storage.Write);
    expect(wx.storage.get(`${STORAGE_PREFIX}visitor`)).toMatchObject({ id: v.id });
    v.setStorage(Storage.None);
    expect(wx.storage.has(`${STORAGE_PREFIX}visitor`)).toBe(false);
  });

  it('read-only storage loads the stored visitor but never writes it', () => {
    const { wx, platform } = setup();
    const first = new Visitor(platform, Storage.Write);
    first.touch();
    const saved = wx.storage.get(`${STORAGE_PREFIX}visitor`);
    const v = new Visitor(platform, Storage.Read);
    expect(v.id).toBe(first.id);
    v.touch();
    v.setStorage(Storage.Read);
    expect(wx.storage.get(`${STORAGE_PREFIX}visitor`)).toBe(saved);
  });

  it('removes the stored visitor when created without storage', () => {
    const { wx, platform } = setup();
    new Visitor(platform, Storage.Write).touch();
    new Visitor(platform, Storage.None);
    expect(wx.storage.has(`${STORAGE_PREFIX}visitor`)).toBe(false);
  });

  it('reset creates a new identity and clears storage', () => {
    const { wx, platform } = setup();
    const v = new Visitor(platform, Storage.Write);
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
