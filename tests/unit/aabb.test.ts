import { describe, it, expect } from 'vitest';

// Tests will be filled in when src/extraction/aabb.ts is implemented (Plan 03)
describe('AABB collision detection', () => {
  it.todo('rectsIntersect: overlapping rects returns true');
  it.todo('rectsIntersect: non-overlapping rects returns false');
  it.todo('rectsIntersect: touching edge returns true (inclusive)');
  it.todo('rectsIntersect: zero-size rect returns false');
  it.todo('rectsIntersect: negative coordinates handled correctly');
  it.todo('rectsIntersect: one rect fully inside another returns true');
  it.todo('pointInRect: point inside returns true');
  it.todo('pointInRect: point on boundary returns true');
  it.todo('pointInRect: point outside returns false');
});
