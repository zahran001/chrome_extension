import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractVisibleText } from '../../src/extraction/tree-walker';

function makeDOMRect(x: number, y: number, w: number, h: number): DOMRect {
  return {
    left: x, right: x + w, top: y, bottom: y + h,
    width: w, height: h, x, y,
    toJSON: () => ({}),
  } as DOMRect;
}

function mockLayout(el: HTMLElement, x: number, y: number, w: number, h: number): void {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(makeDOMRect(x, y, w, h));
  Object.defineProperty(el, 'clientWidth', { value: w, configurable: true });
  Object.defineProperty(el, 'clientHeight', { value: h, configurable: true });
}

function visibleStyle(): CSSStyleDeclaration {
  return { display: 'block', visibility: 'visible', opacity: '1' } as CSSStyleDeclaration;
}

describe('Shadow DOM text extraction', () => {
  let root: HTMLElement;
  const selection = makeDOMRect(0, 0, 500, 500);

  beforeEach(() => {
    root = document.createElement('div');
    document.body.appendChild(root);
    vi.spyOn(window, 'getComputedStyle').mockReturnValue(visibleStyle());
  });

  afterEach(() => {
    document.body.removeChild(root);
    vi.restoreAllMocks();
  });

  it('pierces a single open shadow root and collects text', () => {
    const host = document.createElement('div');
    root.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const p = document.createElement('p');
    p.textContent = 'Shadow text';
    shadow.appendChild(p);

    mockLayout(p, 10, 10, 100, 20);

    const result = extractVisibleText(root, selection);
    expect(result).toContain('Shadow text');
  });

  it('collects text from nested shadow roots in document order', () => {
    const host1 = document.createElement('div');
    root.appendChild(host1);
    const shadow1 = host1.attachShadow({ mode: 'open' });

    const before = document.createElement('p');
    before.textContent = 'Before';
    shadow1.appendChild(before);

    const host2 = document.createElement('div');
    shadow1.appendChild(host2);
    const shadow2 = host2.attachShadow({ mode: 'open' });

    const inner = document.createElement('p');
    inner.textContent = 'Inner';
    shadow2.appendChild(inner);

    const after = document.createElement('p');
    after.textContent = 'After';
    shadow1.appendChild(after);

    mockLayout(before, 10, 10, 100, 20);
    mockLayout(inner, 10, 40, 100, 20);
    mockLayout(after, 10, 70, 100, 20);

    const result = extractVisibleText(root, selection);
    const beforeIdx = result.indexOf('Before');
    const innerIdx = result.indexOf('Inner');
    const afterIdx = result.indexOf('After');

    expect(beforeIdx).toBeGreaterThanOrEqual(0);
    expect(innerIdx).toBeGreaterThan(beforeIdx);
    expect(afterIdx).toBeGreaterThan(innerIdx);
  });

  it('does not crash on closed shadow roots and returns no text from them', () => {
    const host = document.createElement('div');
    root.appendChild(host);
    // attachShadow mode:closed — shadowRoot property returns null externally
    const shadow = host.attachShadow({ mode: 'closed' });
    const p = document.createElement('p');
    p.textContent = 'Closed shadow text';
    shadow.appendChild(p);
    mockLayout(p, 10, 10, 100, 20);

    // Should not throw, and closed content is inaccessible — no text expected
    expect(() => extractVisibleText(root, selection)).not.toThrow();
    const result = extractVisibleText(root, selection);
    expect(result).not.toContain('Closed shadow text');
  });

  it('collects light DOM and shadow DOM text in document order', () => {
    const lightBefore = document.createElement('p');
    lightBefore.textContent = 'Light before';
    root.appendChild(lightBefore);

    const host = document.createElement('div');
    root.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const shadowP = document.createElement('p');
    shadowP.textContent = 'Shadow middle';
    shadow.appendChild(shadowP);

    const lightAfter = document.createElement('p');
    lightAfter.textContent = 'Light after';
    root.appendChild(lightAfter);

    mockLayout(lightBefore, 10, 10, 100, 20);
    mockLayout(shadowP, 10, 40, 100, 20);
    mockLayout(lightAfter, 10, 70, 100, 20);

    const result = extractVisibleText(root, selection);
    const beforeIdx = result.indexOf('Light before');
    const middleIdx = result.indexOf('Shadow middle');
    const afterIdx = result.indexOf('Light after');

    expect(beforeIdx).toBeGreaterThanOrEqual(0);
    expect(middleIdx).toBeGreaterThan(beforeIdx);
    expect(afterIdx).toBeGreaterThan(middleIdx);
  });

  it('does not collect text from shadow host outside selection bounds', () => {
    const host = document.createElement('div');
    root.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const p = document.createElement('p');
    p.textContent = 'Out of bounds shadow text';
    shadow.appendChild(p);

    // Place the shadow content outside selection rect (0,0)-(500,500)
    mockLayout(p, 600, 600, 100, 20);

    const result = extractVisibleText(root, selection);
    expect(result).not.toContain('Out of bounds shadow text');
  });

  it('does not double-collect slotted light DOM content', () => {
    // Light DOM node slotted into shadow DOM via <slot>
    const host = document.createElement('div');
    root.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });

    const slot = document.createElement('slot');
    shadow.appendChild(slot);

    const slotted = document.createElement('p');
    slotted.textContent = 'Slotted text';
    host.appendChild(slotted); // light DOM child of host — gets slotted

    mockLayout(slotted, 10, 10, 100, 20);

    const result = extractVisibleText(root, selection);
    // Text should appear exactly once
    const count = (result.match(/Slotted text/g) ?? []).length;
    expect(count).toBe(1);
  });
});
