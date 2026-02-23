# Phase 1: Core MVP - Context

**Gathered:** 2026-02-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Keyboard-activated (Alt+S) rubber-band selection over any screen region → DOM text extraction via TreeWalker → Gemini API streaming → floating Top Layer results panel. Includes BYOK settings popup and full test coverage. No backend. No persistence. Chrome MV3 only.

</domain>

<decisions>
## Implementation Decisions

### Selection UI behavior
- Release mouse ends drag — a small confirm button (arrow/send icon) appears just outside the bottom-right corner of the rubber-band box
- Confirm button submits the selection to Gemini
- Escape key cancels at any point (mid-drag or after release, before confirm)
- Rubber-band visual: semi-transparent fill (~20% opacity) with animated dashed border (marching ants style)

### Results panel presentation
- Panel appears fixed at center of viewport, regardless of selection position
- AI response streams word-by-word with a blinking cursor at insertion point
- Panel dismissed via Escape key OR visible close button (X) — both work
- Panel is ephemeral: close = gone, no persistence
- Available actions in panel:
  - **Copy** button — copies full response to clipboard
  - **Retry with custom prompt** — text input field appears below the response; user types additional context or a follow-up prompt, submits with Enter or Send button to re-run against the same selection

### First-run & key setup flow
- First activation with no API key: selection mode activates normally (teaches the UX), then when user confirms the selection, the panel shows a setup prompt: "Add your Gemini API key to get started" with a button to open settings
- Settings popup UX:
  - API key field with masked input by default; eye icon toggle to reveal
  - "Test key" button makes a cheap validation call to Gemini — shows 'Key valid ✓' or specific error
  - On save: inline success state — field turns green + "Key saved" message (no auto-close)

### Error UX
- All errors (invalid key, rate limited, network error) surface inside the results panel, replacing the streaming area
- Error message format: human-readable summary + actionable suggestion (e.g. "API key invalid — check your key in settings")
- Errors include clickable action buttons where applicable (e.g. "Open Settings" button for key errors)
- Mid-stream connection failure: preserve partial response, append error notice below it ("Stream interrupted — partial response shown")
- No raw API error codes shown to users
- `port.onDisconnect` (SW killed by Chrome — device sleep, network drop) must be explicitly wired to the same mid-stream failure path, not left unhandled

### Implementation Constraints
- **Shadow DOM CSS:** Use `import styles from './panel.css?inline'` (Vite inline import) + `shadowRoot.adoptedStyleSheets = [sheet]` via `CSSStyleSheet`. Standard CSS imports do not reach inside a Shadow Root — this pattern is required, not optional.
- **TreeWalker filter:** In addition to skipping `display:none` and zero-opacity nodes, add a zero-dimension fast-fail during the AABB pass: `if (rect.width === 0 || rect.height === 0) return NodeFilter.FILTER_REJECT`. Cheap and catches geometrically-empty nodes without extra style computation.
- **XSS — hard constraint:** Phase 1 must use `textContent` exclusively when rendering streamed Gemini output. `innerHTML` is prohibited anywhere in Phase 1. Forward note for planner: Phase 2 Markdown rendering must be gated on DOMPurify or equivalent sanitizer before any HTML injection.

### Claude's Discretion
- Exact color/accent for the rubber-band selection box (must work on light and dark pages)
- Panel width and max-height, internal padding and typography
- Exact copy for AI-generated prompts (how intent is inferred from selected content)
- Loading/thinking state while waiting for first token to arrive
- Specific test coverage patterns and test file organization

</decisions>

<specifics>
## Specific Ideas

- The retry flow is: response renders → text input appears below → user types → Enter/Send → same selection re-sent with added context appended to prompt
- The confirm button placement (bottom-right of selection) must not overlap the selected content region itself
- "Marching ants" animated border is the explicit preference for the rubber-band style

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-core-mvp*
*Context gathered: 2026-02-23*
