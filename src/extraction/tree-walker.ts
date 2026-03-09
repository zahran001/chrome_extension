import { rectsIntersect, Rect } from './aabb';
import { isVisible } from './visibility';

export function extractVisibleText(root: Element, selectionBounds: DOMRect): string {
  const selection: Rect = {
    left: selectionBounds.left,
    right: selectionBounds.right,
    top: selectionBounds.top,
    bottom: selectionBounds.bottom,
  };

  // Block-level tags that represent visual line breaks in the DOM
  const BLOCK_TAGS = new Set([
    'P', 'DIV', 'LI', 'TR', 'TD', 'TH', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'BLOCKQUOTE', 'PRE', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'LABEL',
    'OPTION', 'DT', 'DD', 'FIGCAPTION', 'CAPTION',
  ]);

  interface Part { text: string; isBlock: boolean; }
  const parts: Part[] = [];

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node: Text): number {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;

        // 1. Visibility check first (skips display:none, visibility:hidden, opacity:0)
        if (!isVisible(parent)) return NodeFilter.FILTER_REJECT;

        // 2. Get bounding rect once — used for both zero-dimension fast-fail and AABB check
        const rect = parent.getBoundingClientRect();

        // 3. Zero-dimension fast-fail BEFORE AABB (per CLAUDE.md constraint)
        if (rect.width === 0 || rect.height === 0) return NodeFilter.FILTER_REJECT;

        // 4. AABB intersection check against selection bounds
        const nodeRect: Rect = {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
        };
        if (!rectsIntersect(nodeRect, selection)) return NodeFilter.FILTER_REJECT;

        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  let node: Node | null;
  while ((node = walker.nextNode()) !== null) {
    // NEVER use innerHTML — read textNode.data only (XSS constraint from CLAUDE.md)
    const text = (node as Text).data.trim();
    if (!text) continue;

    // Walk up to find nearest block ancestor within the selection root
    let el: Element | null = (node as Text).parentElement;
    let isBlock = false;
    while (el && el !== root) {
      if (BLOCK_TAGS.has(el.tagName)) { isBlock = true; break; }
      el = el.parentElement;
    }

    parts.push({ text, isBlock });
  }

  // Join: block-level nodes get a newline before them (except the first),
  // inline nodes are space-joined with their predecessor.
  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const { text, isBlock } = parts[i];
    if (i === 0) {
      out.push(text);
    } else if (isBlock) {
      out.push('\n' + text);
    } else {
      out.push(' ' + text);
    }
  }

  return out.join('');
}
