import { rectsIntersect, Rect } from './aabb';
import { isVisible } from './visibility';

const BLOCK_TAGS = new Set([
  'P', 'DIV', 'LI', 'TR', 'TD', 'TH', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'BLOCKQUOTE', 'PRE', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'LABEL',
  'OPTION', 'DT', 'DD', 'FIGCAPTION', 'CAPTION',
]);

interface Part { text: string; isBlock: boolean; }

function walkNode(
  node: Node,
  selection: Rect,
  parts: Part[],
  scopeRoot: Element | ShadowRoot,
): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const parent = (node as Text).parentElement;
    if (!parent) return;

    // CLAUDE.md check order: visibility → zero-dim → AABB
    if (!isVisible(parent)) return;
    // parentElement here is the immediate parent inside the shadow tree (e.g. <p>),
    // NOT the shadow host — so getBoundingClientRect() returns real rendered dims.
    const rect = parent.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    if (!rectsIntersect({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }, selection)) return;

    const text = (node as Text).data.trim();
    if (!text) return;

    let el: Element | null = parent;
    let isBlock = false;
    const boundary = scopeRoot instanceof ShadowRoot ? null : scopeRoot as Element;
    while (el && el !== boundary) {
      if (BLOCK_TAGS.has(el.tagName)) { isBlock = true; break; }
      el = el.parentElement;
    }
    parts.push({ text, isBlock });

  } else if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as Element;

    // Pierce open shadow roots in document order before light DOM children.
    // Closed shadow roots return null — skipped silently.
    if (el.shadowRoot) {
      const shadowChildren = el.shadowRoot.childNodes;
      for (let i = 0; i < shadowChildren.length; i++) {
        walkNode(shadowChildren[i], selection, parts, el.shadowRoot);
      }
    }

    const children = el.childNodes;
    for (let i = 0; i < children.length; i++) {
      walkNode(children[i], selection, parts, scopeRoot);
    }
  }
}

export function extractVisibleText(root: Element, selectionBounds: DOMRect): string {
  const selection: Rect = {
    left: selectionBounds.left,
    right: selectionBounds.right,
    top: selectionBounds.top,
    bottom: selectionBounds.bottom,
  };

  const parts: Part[] = [];
  walkNode(root, selection, parts, root);

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
