import { rectsIntersect, Rect } from './aabb';
import { isVisible } from './visibility';

export function extractVisibleText(root: Element, selectionBounds: DOMRect): string {
  const selection: Rect = {
    left: selectionBounds.left,
    right: selectionBounds.right,
    top: selectionBounds.top,
    bottom: selectionBounds.bottom,
  };

  const parts: string[] = [];

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
    if (text) {
      parts.push(text);
    }
  }

  return parts.join(' ');
}
