import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isVisible } from '../../src/extraction/visibility';

describe('Visibility filter', () => {
  let el: HTMLElement;

  beforeEach(() => {
    el = document.createElement('div');
    document.body.appendChild(el);
  });

  afterEach(() => {
    document.body.removeChild(el);
  });

  it('isVisible: visible element returns true', () => {
    // Default element with no hiding styles — JSDOM returns '' for computed styles
    // so we only rely on dimension checks here
    // Simulate a real visible element: mock getComputedStyle
    const mockStyle = { display: 'block', visibility: 'visible', opacity: '1' };
    vi.spyOn(window, 'getComputedStyle').mockReturnValue(mockStyle as CSSStyleDeclaration);
    Object.defineProperty(el, 'clientWidth', { value: 100, configurable: true });
    Object.defineProperty(el, 'clientHeight', { value: 100, configurable: true });

    expect(isVisible(el)).toBe(true);
    vi.restoreAllMocks();
  });

  it('isVisible: display:none element returns false', () => {
    const mockStyle = { display: 'none', visibility: 'visible', opacity: '1' };
    vi.spyOn(window, 'getComputedStyle').mockReturnValue(mockStyle as CSSStyleDeclaration);

    expect(isVisible(el)).toBe(false);
    vi.restoreAllMocks();
  });

  it('isVisible: visibility:hidden element returns false', () => {
    const mockStyle = { display: 'block', visibility: 'hidden', opacity: '1' };
    vi.spyOn(window, 'getComputedStyle').mockReturnValue(mockStyle as CSSStyleDeclaration);

    expect(isVisible(el)).toBe(false);
    vi.restoreAllMocks();
  });

  it('isVisible: opacity:0 element returns false', () => {
    const mockStyle = { display: 'block', visibility: 'visible', opacity: '0' };
    vi.spyOn(window, 'getComputedStyle').mockReturnValue(mockStyle as CSSStyleDeclaration);

    expect(isVisible(el)).toBe(false);
    vi.restoreAllMocks();
  });

  it('isVisible: zero-width element returns false', () => {
    const mockStyle = { display: 'block', visibility: 'visible', opacity: '1' };
    vi.spyOn(window, 'getComputedStyle').mockReturnValue(mockStyle as CSSStyleDeclaration);
    Object.defineProperty(el, 'clientWidth', { value: 0, configurable: true });
    Object.defineProperty(el, 'clientHeight', { value: 100, configurable: true });

    expect(isVisible(el)).toBe(false);
    vi.restoreAllMocks();
  });

  it('isVisible: zero-height element returns false', () => {
    const mockStyle = { display: 'block', visibility: 'visible', opacity: '1' };
    vi.spyOn(window, 'getComputedStyle').mockReturnValue(mockStyle as CSSStyleDeclaration);
    Object.defineProperty(el, 'clientWidth', { value: 100, configurable: true });
    Object.defineProperty(el, 'clientHeight', { value: 0, configurable: true });

    expect(isVisible(el)).toBe(false);
    vi.restoreAllMocks();
  });
});
