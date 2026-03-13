# Shadow DOM Text Extraction Fix

## Problem

`extractVisibleText` in `src/extraction/tree-walker.ts` uses `document.createTreeWalker` rooted at `document.documentElement`. A TreeWalker **cannot cross Shadow Root boundaries** — it silently skips shadow hosts and never descends into their shadow trees.

Sites like ChatGPT and Gemini render chat messages inside open Shadow DOM subtrees. When rubber-banding over a quiz question on those sites, all text nodes live inside shadow roots → the walker finds nothing → sandbox is empty.

---

## Root Cause

```
document.documentElement          ← TreeWalker starts here
  └── div.chat-container          ← light DOM, walker enters
        └── chat-message          ← shadow host (e.g. <turnstile-elem>)
              └── #shadow-root    ← WALL — walker stops here
                    └── p         ← "6. What is the basic unit of life?" ← NEVER REACHED
```

`node.shadowRoot` is accessible on open shadow roots from the outside, but `createTreeWalker` does not follow it automatically.

---

## Constraints

| Constraint | Source | Impact on fix |
|------------|--------|---------------|
| `textContent` only, never `innerHTML` | CLAUDE.md XSS rule | No change needed — fix stays in TreeWalker layer |
| Zero-dimension check before AABB | CLAUDE.md order rule | Must preserve in recursive helper too |
| `isVisible` check first | CLAUDE.md visibility check order | Must preserve in recursive helper too |
| Closed shadow roots (`mode: 'closed'`) | Browser security | `.shadowRoot === null` — skip silently, not an error |

---

## Approach: Single Recursive Descent

Do **not** use two separate walkers (one for `SHOW_TEXT`, one for `SHOW_ELEMENT`). That breaks document order — shadow-hosted text would appear after all light DOM text from the same subtree.

Instead, use a **single recursive function** that walks nodes in document order and handles both cases:

1. Text node → run visibility + AABB check → collect
2. Element node → check for `shadowRoot` → if present, recurse into it

```
walkSubtree(document.documentElement)
  ├── text node: (whitespace) → skip
  ├── element: div.chat-container → no shadowRoot, recurse children
  │     ├── element: chat-message → has shadowRoot! → recurse into shadow root
  │     │     └── element: p → text node: "6. What is the basic unit of life?" → COLLECT
  │     └── element: div.choices → recurse children
  │           └── text node: "A. Atom\nB. Molecule..." → COLLECT
  └── ...
```

---

## Implementation Plan — COMPLETED

### Step 1 — Refactor `extractVisibleText` in `src/extraction/tree-walker.ts` ✓

Extract a private recursive helper `walkNode(node, selectionRect, parts, BLOCK_TAGS)`:

```ts
function walkNode(
  node: Node,
  selection: Rect,
  parts: Part[],
  BLOCK_TAGS: Set<string>,
  root: Element | ShadowRoot,
): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const parent = (node as Text).parentElement;
    if (!parent) return;

    // Preserve CLAUDE.md check order: visibility → zero-dim → AABB
    if (!isVisible(parent)) return;
    const rect = parent.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    if (!rectsIntersect({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }, selection)) return;

    const text = (node as Text).data.trim();
    if (!text) return;

    let el: Element | null = parent;
    let isBlock = false;
    while (el && el !== (root instanceof ShadowRoot ? null : root as Element)) {
      if (BLOCK_TAGS.has(el.tagName)) { isBlock = true; break; }
      el = el.parentElement;
    }
    parts.push({ text, isBlock });

  } else if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as Element;

    // Pierce open shadow roots — closed ones return null, skip silently
    if (el.shadowRoot) {
      for (const child of el.shadowRoot.childNodes) {
        walkNode(child, selection, parts, BLOCK_TAGS, el.shadowRoot);
      }
    }

    // Walk light DOM children
    for (const child of el.childNodes) {
      walkNode(child, selection, parts, BLOCK_TAGS, root);
    }
  }
  // Other node types (comments, CDATA, etc.) — ignore
}
```

The public `extractVisibleText` becomes:

```ts
export function extractVisibleText(root: Element, selectionBounds: DOMRect): string {
  const selection: Rect = { ... };
  const parts: Part[] = [];
  walkNode(root, selection, parts, BLOCK_TAGS, root);
  return join(parts); // existing join logic unchanged
}
```

### Step 2 — Edge cases to handle ✓

| Case | Handling |
|------|----------|
| Closed shadow root | `el.shadowRoot === null` → `if (el.shadowRoot)` guard skips it naturally |
| Nested shadow roots (shadow inside shadow) | Recursion handles it — each shadow host encountered inside a shadow root is also pierced |
| Shadow root element has zero-size host | Not a problem — see critique B rebuttal below |
| Infinite recursion | Not possible — DOM trees are acyclic; shadow roots cannot contain their own host |
| `<slot>` elements | Not double-counted — see critique A rebuttal below |

---

## Critique Evaluation

### Critique A: `<slot>` Double-Counting & Ordering

**Double-counting verdict: Not a real risk.**

The recursive descent walks `el.childNodes`, which traverses the actual DOM tree, not the rendered (flat) tree. A slotted element has exactly one position in the DOM — in the light DOM of the slot's host. The `<slot>` element inside the shadow root has no text `childNodes` of its own; assigned nodes are not its children in the DOM tree. So `walkNode` visits `<slot>` as an element, finds no children to recurse into, and moves on. No double-collection occurs.

**Ordering verdict: Real but narrow, and not worth fixing.**

If a web component uses named slots to *visually reorder* content (e.g. a "header" slot rendered above a "footer" slot despite source order being reversed), the recursive descent extracts text in source/DOM order, not rendered order. This is a real gap.

However:
- ChatGPT and Gemini use shadow DOM for *encapsulation*, not slot-based reordering of user-visible text. Quiz question text lives directly inside the shadow tree, not slotted in from outside.
- Implementing `assignedNodes()` traversal to fix rendered order would add significant complexity and introduce its own double-counting risk if the light DOM walk isn't carefully suppressed for slotted nodes.
- This is a known limitation acceptable for Phase 1 target sites.

**Decision: No change. Document as a known limitation.**

---

### Critique B: Layout Context / `display: contents` Shadow Host

**Verdict: Factually incorrect — based on a misread of `parentElement`.**

The critique claims that checking `parent.getBoundingClientRect()` could fail because the shadow *host* might be `display: contents` or zero-sized. But look at exactly what `parent` is in the code:

```ts
const parent = (node as Text).parentElement;
```

For a text node *inside a shadow root*, `parentElement` is that text node's **immediate parent within the shadow tree** — e.g. the `<p>` inside the `#shadow-root`. It is **not** the shadow host. The shadow host is a different node, in the light DOM, one level up from the shadow root boundary.

```
<chat-message>        ← shadow host (light DOM) — NOT what parentElement returns
  #shadow-root
    <p>               ← this IS node.parentElement for text inside it
      "What is..."    ← text node being checked
```

The `<p>` inside the shadow root has real rendered dimensions. The zero-dimension check is against the correct element. The shadow host's size is irrelevant to this check.

The `display: contents` concern would only apply if the text node's *direct* parent (inside the shadow tree) is itself `display: contents` — which would affect the current code identically whether or not shadow DOM is involved. It is not a shadow-DOM-specific risk and requires no special handling.

**Decision: No change to check logic. Add a clarifying comment in the code.**

### Step 3 — Latency analysis ✓

| Scenario | Old | New | Delta |
|----------|-----|-----|-------|
| Normal page (no shadow roots) | baseline | +element childNodes iteration | ~0ms — just pointer traversal |
| ChatGPT/Gemini (shadow roots present) | 0 results | correct results | small constant per shadow root |
| Pathological page (100s of shadow roots) | fast, wrong | slightly slower, correct | still well under 50ms |

The `getBoundingClientRect` calls (layout) and `getComputedStyle` calls (style) are the expensive operations. Those are gated behind the text-node path and unchanged. The new element-traversal path does **no layout queries**.

### Step 4 — Tests added in `tests/unit/shadow-dom.test.ts` ✓

1. **Basic shadow root pierce** ✓ — text inside a single `attachShadow({ mode: 'open' })` in the selection rect is returned
2. **Nested shadow roots** ✓ — shadow inside shadow, text appears in correct document order
3. **Closed shadow root** ✓ — `attachShadow({ mode: 'closed' })` → no crash, no text, no error
4. **Mixed light + shadow** ✓ — light DOM text and shadow DOM text interleaved; verify correct order
5. **Shadow root outside selection** ✓ — shadow host outside AABB → text not collected
6. **Slot passthrough** ✓ — slotted light-DOM content not double-collected

All 6 tests pass. Typecheck: zero errors.

---

## Files Changed ✓

| File | Change |
|------|--------|
| `src/extraction/tree-walker.ts` | Replaced TreeWalker with recursive `walkNode`; added shadow-piercing |
| `tests/unit/shadow-dom.test.ts` | Added 6 test cases (new file) |

No other files changed — the `extractVisibleText` signature is unchanged.

---

## What Does NOT Change

- `src/extraction/visibility.ts` — untouched
- `src/extraction/aabb.ts` — untouched
- `src/content-script.ts` — call site unchanged
- CLAUDE.md check order invariants — preserved in recursive helper
- XSS rule — only `node.data` (textContent) ever read, no innerHTML anywhere
