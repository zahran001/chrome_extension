# Feature Plan: Editable Scratchpad + Cursor Differentiation

## Summary

Two focused improvements:

1. **Editable scratchpad** — after rubber-band selection, show the extracted text in an editable textarea *before* sending to the LLM. User can trim noise, fix OCR artifacts, or add context. Opt-in: default flow stays fast; scratchpad is collapsed by default and expandable.
2. **Distinct selection cursor** — replace the plain `crosshair` CSS cursor with a custom SVG cursor so users can tell the extension is active and not confuse it with Windows' built-in Win+Shift+S snipping tool cursor.

---

## Part 1: Editable Scratchpad

### The problem it solves

`extractVisibleText()` uses TreeWalker across all visible DOM nodes in the bounding box. On real pages this picks up nav bars, sidebars, ads, cookie banners — anything that geometrically overlaps the selection. The user selected a product description; they get product description + nav links + footer copyright + cookie disclaimer. The LLM gets confused, the answer is off, user has to re-select. The scratchpad lets them fix the input in one shot before the API call fires.

### Flow (before and after)

**Current:**
```
Alt+S → drag → mouseup → [Analyze button] → click → extract → check key → show skeleton → stream
```

**With scratchpad:**
```
Alt+S → drag → mouseup → [Analyze button] [👁 Preview] →
  Happy path: click Analyze → extract → check key → show skeleton → stream (unchanged)
  Scratchpad path: click Preview → panel opens in "scratchpad" mode → user edits → click Send → check key → show skeleton → stream
```

The happy path is **identical** to today. The scratchpad is an alternative entry point, not a gate.

---

### UI layout

The confirm button area currently shows a single green "Analyze" button. After this change it shows two controls side by side:

```
┌─────────────┬───────────────┐
│   Analyze   │  ✎ Edit text │
└─────────────┴───────────────┘
```

- **Analyze** — same behavior as today. Extract → stream. No extra click.
- **✎ Edit text** — opens the panel in scratchpad mode (new `PanelMode`).

Both buttons live in the same fixed-positioned container that `showConfirmButton()` already creates in `selection-renderer.ts:133`.

---

### New panel mode: `'scratchpad'`

Add `'scratchpad'` to `PanelMode` in `panel.ts`. The panel title shows **"Inspect"** in this mode. The panel renders:

```
┌──────────────────────────────── Inspect ── ✕ ─┐
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │ [editable textarea — extracted text here]    │ │
│  │                                              │ │
│  │                                              │ │
│  └──────────────────────────────────────────────┘ │
│  [character count]              [Cancel] [Send →] │
└────────────────────────────────────────────────────┘
```

- Textarea gets `autofocus` so the user can immediately start editing with the keyboard.
- Character count below the textarea: e.g. `1,240 / 20,000 chars`. Turns amber at 15k, red at 20k (matches the existing `MAX_CHARS` guard in content-script).
- **Cancel** — closes panel, returns to confirm button (user can still click Analyze).
- **Send →** — takes the textarea's current value, passes it through the existing `openStreamPort()` call, transitions panel to loading skeleton. Same path as Analyze from here.

---

### Data flow

Today in `content-script.ts`, `setOnConfirm` fires with a `DOMRect`, then extracts inside the callback:

```ts
// content-script.ts:166
renderer.setOnConfirm(async (selectionRect: DOMRect) => {
  let extractedText = extractVisibleText(document.documentElement, selectionRect);
  // ...
  openStreamPort(extractedText);
});
```

With scratchpad, extraction still happens at the same point — but instead of always going straight to `openStreamPort`, a second button on the confirm UI calls a new `showScratchpad(extractedText)` helper that:

1. Calls `showPanel({ mode: 'scratchpad', initialText: extractedText })`
2. The panel's "Send" button calls `openStreamPort(editedText)` with whatever text is in the textarea at send time.

`openStreamPort` signature doesn't change. No changes to the service worker or LLM layer.

---

### Files to change

| File | Change |
|------|--------|
| `src/ui/selection-renderer.ts` | Add `setOnPreview(cb)` alongside `setOnConfirm`. `showConfirmButton()` renders two buttons instead of one. |
| `src/content-script.ts` | Wire `renderer.setOnPreview()` callback: extract text, call `showScratchpad()`. |
| `src/ui/panel.ts` | Add `'scratchpad'` to `PanelMode`. Add `showScratchpad(text)` method. Add `onSend` option to `PanelOptions`. |
| `src/ui/panel.css` | Add `.scratchpad-textarea`, `.char-count`, `.scratchpad-actions` styles. |

No changes to: `service-worker.ts`, `openai.ts`, `streaming.ts`, `storage/keys.ts`, extraction layer.

---

### CSS: scratchpad textarea

Inside Shadow DOM so host-page styles can't bleed in. Key rules:

```css
.scratchpad-textarea {
  width: 100%;
  min-height: 160px;
  max-height: 320px;
  resize: vertical;
  padding: 10px 12px;
  border: 1px solid #d0d0d0;
  border-radius: 6px;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.5;
  color: #1a1a1a;
  background: #fafafa;
  outline: none;
  transition: border-color 0.15s;
}

.scratchpad-textarea:focus {
  border-color: #4CAF50;
  background: #fff;
}

.char-count {
  font-size: 11px;
  color: #999;
  text-align: right;
  margin-top: 4px;
}

.char-count.warn  { color: #e65100; }
.char-count.limit { color: #c62828; }

.scratchpad-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 16px;
  border-top: 1px solid #f0f0f0;
}
```

---

### XSS note

The textarea `value` is set via `.value = extractedText` (DOM property, not innerHTML). When the user clicks Send, the edited value is read via `.value` and passed to `openStreamPort()` as a plain string. The service worker sends it to OpenAI as message content — never rendered as HTML anywhere. XSS constraint is fully preserved.

---

### Edge cases

| Scenario | Handling |
|----------|----------|
| User empties the textarea | "Send" button disabled when `textarea.value.trim() === ''` |
| User pastes and exceeds 20k chars | Character count turns red; Send button disabled; tooltip: "Too long — trim before sending" |
| User clicks Analyze after opening scratchpad | Scratchpad panel closes, fresh stream starts with original extracted text |
| Panel dismissed mid-scratchpad (Escape or ✕) | Same dismiss path as today — `rba-dismiss` CustomEvent dispatched, no port was opened yet so no abort needed |
| Retry (follow-up question) after response | Unchanged — retry input still appears after streaming done, uses existing `onRetry` path |

---

## Part 2: Distinct Selection Cursor

### The problem

`document.documentElement.style.cursor = 'crosshair'` sets the OS-default crosshair. On Windows, Win+Shift+S (Snipping Tool) also uses a crosshair cursor. When both are active (or the user just sees the extension activate), they look identical. Users can't tell which tool they've triggered.

### Solution: custom SVG cursor

Replace the plain `crosshair` with a custom cursor that has a visual marker distinguishing it as the extension's own — a colored center dot or a small "AI" indicator in the crosshair.

**Cursor design:**

```
     |
     |
─────╋─────   (standard crosshair lines)
     |
     ●         (filled green dot at center — 4px radius)
```

The green dot matches the extension's accent color (`#4CAF50`) and makes it instantly visually different from the Windows snipping cursor which is a plain thin crosshair with no fill.

### Implementation

SVG data URI embedded directly in `content-script.ts` (no additional file). Set on `activateSelectionMode()`, cleared on `deactivateSelectionMode()`:

```ts
const RBA_CURSOR = `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'><line x1='16' y1='0' x2='16' y2='13' stroke='%234CAF50' stroke-width='2'/><line x1='16' y1='19' x2='16' y2='32' stroke='%234CAF50' stroke-width='2'/><line x1='0' y1='16' x2='13' y2='16' stroke='%234CAF50' stroke-width='2'/><line x1='19' y1='16' x2='32' y2='16' stroke='%234CAF50' stroke-width='2'/><circle cx='16' cy='16' r='4' fill='%234CAF50'/></svg>") 16 16, crosshair`;
```

- `16 16` is the hotspot — the pixel that registers as the click point, centered on the crosshair.
- Fallback `crosshair` at the end handles any browser that can't render the SVG cursor (Chrome always can, but good practice).
- Green lines + filled green circle = unmistakably different from Windows snipping tool's thin gray crosshair.

### Files to change

| File | Change |
|------|--------|
| `src/content-script.ts` | Add `RBA_CURSOR` constant. Replace `'crosshair'` string with `RBA_CURSOR` in `activateSelectionMode()` and `deactivateSelectionMode()` (2 occurrences). |

That's it — one constant, two substitutions.

---

## What is NOT changing

- Service worker — no changes
- OpenAI / streaming layer — no changes
- Extraction layer — no changes
- Popup / API key flow — no changes
- Port lifecycle — no changes
- Shadow DOM adoption pattern — no changes
- Escape / dismiss / abort chain — no changes

---

## Implementation order

1. **Cursor first** — tiny, self-contained, immediately verifiable. Two-line change + one constant.
2. **Selection-renderer buttons** — add the "✎ Edit text" button next to Analyze.
3. **Panel scratchpad mode** — new `PanelMode`, `showScratchpad()` method, textarea + char count + Send/Cancel.
4. **CSS** — scratchpad-specific styles in `panel.css`.
5. **Wire content-script** — `setOnPreview` callback extracts text and calls scratchpad path.
6. **Manual test** — open on a content-heavy page (Wikipedia, news article), verify: (a) cursor looks distinct, (b) Analyze still works as before, (c) Edit text opens scratchpad with real extracted content, (d) editing and sending produces correct LLM response, (e) empty textarea disables Send, (f) exceeding 20k chars disables Send.

---

## Locked decisions

1. **Button order** — "Analyze" left, "✎ Edit text" right. Analyze is the primary action.
2. **Scratchpad button label** — "✎ Edit text". Panel header / mode label: "Inspect".
3. **Cursor color** — green (`#4CAF50`) lines + green filled center dot.
4. **Panel size in scratchpad mode** — same 480px width as the response panel.
