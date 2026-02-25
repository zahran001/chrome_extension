import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractVisibleText } from '../../src/extraction/tree-walker';

// JSDOM does not implement getBoundingClientRect — returns zeros.
// We mock it on each element to simulate real layout positions.

function makeDOMRect(x: number, y: number, w: number, h: number): DOMRect {
  return {
    left: x,
    right: x + w,
    top: y,
    bottom: y + h,
    width: w,
    height: h,
    x,
    y,
    toJSON: () => ({}),
  } as DOMRect;
}

function mockComputedStyle(display = 'block', visibility = 'visible', opacity = '1') {
  return { display, visibility, opacity } as CSSStyleDeclaration;
}

describe('TreeWalker text extraction', () => {
  let root: HTMLElement;
  let selectionBounds: DOMRect;

  beforeEach(() => {
    root = document.createElement('div');
    document.body.appendChild(root);
    // Selection covers (0,0) to (200,200)
    selectionBounds = makeDOMRect(0, 0, 200, 200);
  });

  afterEach(() => {
    document.body.removeChild(root);
    vi.restoreAllMocks();
  });

  it('extractVisibleText: returns text from visible elements within bounds', () => {
    const p = document.createElement('p');
    p.textContent = 'Hello world';
    root.appendChild(p);

    vi.spyOn(window, 'getComputedStyle').mockReturnValue(mockComputedStyle());
    vi.spyOn(p, 'getBoundingClientRect').mockReturnValue(makeDOMRect(10, 10, 100, 20));

    const result = extractVisibleText(root, selectionBounds);
    expect(result).toContain('Hello world');
  });

  it('extractVisibleText: skips display:none elements', () => {
    const p = document.createElement('p');
    p.textContent = 'Hidden text';
    root.appendChild(p);

    vi.spyOn(window, 'getComputedStyle').mockReturnValue(mockComputedStyle('none'));
    vi.spyOn(p, 'getBoundingClientRect').mockReturnValue(makeDOMRect(10, 10, 100, 20));

    const result = extractVisibleText(root, selectionBounds);
    expect(result).not.toContain('Hidden text');
  });

  it('extractVisibleText: skips visibility:hidden elements', () => {
    const p = document.createElement('p');
    p.textContent = 'Invisible text';
    root.appendChild(p);

    vi.spyOn(window, 'getComputedStyle').mockReturnValue(mockComputedStyle('block', 'hidden'));
    vi.spyOn(p, 'getBoundingClientRect').mockReturnValue(makeDOMRect(10, 10, 100, 20));

    const result = extractVisibleText(root, selectionBounds);
    expect(result).not.toContain('Invisible text');
  });

  it('extractVisibleText: skips opacity:0 elements', () => {
    const p = document.createElement('p');
    p.textContent = 'Transparent text';
    root.appendChild(p);

    vi.spyOn(window, 'getComputedStyle').mockReturnValue(mockComputedStyle('block', 'visible', '0'));
    vi.spyOn(p, 'getBoundingClientRect').mockReturnValue(makeDOMRect(10, 10, 100, 20));

    const result = extractVisibleText(root, selectionBounds);
    expect(result).not.toContain('Transparent text');
  });

  it('extractVisibleText: skips zero-dimension elements', () => {
    const p = document.createElement('p');
    p.textContent = 'Zero size text';
    root.appendChild(p);

    vi.spyOn(window, 'getComputedStyle').mockReturnValue(mockComputedStyle());
    // Zero-dimension: width=0 — fast-fail before AABB
    vi.spyOn(p, 'getBoundingClientRect').mockReturnValue(makeDOMRect(10, 10, 0, 20));

    const result = extractVisibleText(root, selectionBounds);
    expect(result).not.toContain('Zero size text');
  });

  it('extractVisibleText: handles nested elements', () => {
    const outer = document.createElement('div');
    const inner = document.createElement('span');
    inner.textContent = 'Nested text';
    outer.appendChild(inner);
    root.appendChild(outer);

    vi.spyOn(window, 'getComputedStyle').mockReturnValue(mockComputedStyle());
    vi.spyOn(outer, 'getBoundingClientRect').mockReturnValue(makeDOMRect(0, 0, 200, 200));
    vi.spyOn(inner, 'getBoundingClientRect').mockReturnValue(makeDOMRect(10, 10, 80, 20));

    const result = extractVisibleText(root, selectionBounds);
    expect(result).toContain('Nested text');
  });

  it('extractVisibleText: returns empty string when nothing in bounds', () => {
    const p = document.createElement('p');
    p.textContent = 'Out of bounds text';
    root.appendChild(p);

    vi.spyOn(window, 'getComputedStyle').mockReturnValue(mockComputedStyle());
    // Element is far outside selection (300,300) — beyond (0,0)-(200,200) bounds
    vi.spyOn(p, 'getBoundingClientRect').mockReturnValue(makeDOMRect(300, 300, 100, 20));

    const result = extractVisibleText(root, selectionBounds);
    expect(result).toBe('');
  });
});
