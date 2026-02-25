import { describe, it, expect } from 'vitest';
import { rectsIntersect, pointInRect } from '../../src/extraction/aabb';

describe('AABB collision detection', () => {
  it('rectsIntersect: overlapping rects returns true', () => {
    const r1 = { left: 0, right: 100, top: 0, bottom: 100 };
    const r2 = { left: 50, right: 150, top: 50, bottom: 150 };
    expect(rectsIntersect(r1, r2)).toBe(true);
  });

  it('rectsIntersect: non-overlapping rects returns false', () => {
    const r1 = { left: 0, right: 100, top: 0, bottom: 100 };
    const r2 = { left: 200, right: 300, top: 200, bottom: 300 };
    expect(rectsIntersect(r1, r2)).toBe(false);
  });

  it('rectsIntersect: touching edge returns true (inclusive)', () => {
    const r1 = { left: 0, right: 100, top: 0, bottom: 100 };
    const r2 = { left: 100, right: 200, top: 0, bottom: 100 };
    expect(rectsIntersect(r1, r2)).toBe(true);
  });

  it('rectsIntersect: zero-size rect (width=0) returns false', () => {
    const r1 = { left: 50, right: 50, top: 0, bottom: 100 }; // width = 0
    const r2 = { left: 0, right: 100, top: 0, bottom: 100 };
    expect(rectsIntersect(r1, r2)).toBe(false);
  });

  it('rectsIntersect: zero-size rect (height=0) returns false', () => {
    const r1 = { left: 0, right: 100, top: 50, bottom: 50 }; // height = 0
    const r2 = { left: 0, right: 100, top: 0, bottom: 100 };
    expect(rectsIntersect(r1, r2)).toBe(false);
  });

  it('rectsIntersect: negative coordinates handled correctly', () => {
    const r1 = { left: -100, right: -10, top: 0, bottom: 10 };
    const r2 = { left: -50, right: 50, top: 0, bottom: 10 };
    expect(rectsIntersect(r1, r2)).toBe(true);
  });

  it('rectsIntersect: one rect fully inside another returns true', () => {
    const outer = { left: 0, right: 200, top: 0, bottom: 200 };
    const inner = { left: 50, right: 100, top: 50, bottom: 100 };
    expect(rectsIntersect(outer, inner)).toBe(true);
  });

  it('pointInRect: point inside returns true', () => {
    const rect = { left: 0, right: 100, top: 0, bottom: 100 };
    expect(pointInRect(50, 50, rect)).toBe(true);
  });

  it('pointInRect: point on boundary returns true', () => {
    const rect = { left: 0, right: 100, top: 0, bottom: 100 };
    expect(pointInRect(0, 0, rect)).toBe(true);
    expect(pointInRect(100, 100, rect)).toBe(true);
  });

  it('pointInRect: point outside returns false', () => {
    const rect = { left: 0, right: 100, top: 0, bottom: 100 };
    expect(pointInRect(150, 50, rect)).toBe(false);
    expect(pointInRect(50, -1, rect)).toBe(false);
  });
});
