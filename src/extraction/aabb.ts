export interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export function rectsIntersect(rect1: Rect, rect2: Rect): boolean {
  // Zero-size fast-fail
  if (rect1.right - rect1.left <= 0 || rect1.bottom - rect1.top <= 0) return false;
  if (rect2.right - rect2.left <= 0 || rect2.bottom - rect2.top <= 0) return false;
  // AABB intersection (inclusive — touching edges count as intersecting)
  return (
    rect1.left <= rect2.right &&
    rect1.right >= rect2.left &&
    rect1.top <= rect2.bottom &&
    rect1.bottom >= rect2.top
  );
}

export function pointInRect(x: number, y: number, rect: Rect): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}
