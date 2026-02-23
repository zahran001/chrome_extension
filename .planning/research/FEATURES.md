# Features Research: Chrome MV3 AI Extension

## Table Stakes Features

These are baseline expectations from users of AI Chrome extensions. Missing any of these causes immediate abandonment.

### Selection UX
- **Visual rubber-band feedback during drag** — Users must see the selection rectangle drawing in real-time. No feedback = confusion about whether it worked.
- **Escape to cancel** — Users expect Esc to cancel selection without triggering anything.
- **Cursor change on activation** — Cursor should change to crosshair on activation to signal "selection mode."
- **Selection highlight persists** — The selection rect should remain visible while the result loads.

### Result Panel UX
- **Streaming render** — Response must appear word-by-word. A blank panel that fills all at once feels broken.
- **Copy to clipboard button** — Table stakes. Users immediately want to paste results.
- **Escape / click outside to close** — Must be dismissible without a visible close button (though one should exist too).
- **Loading state** — Some spinner or skeleton while waiting for first token. Sub-500ms to first visible feedback or it feels laggy.
- **Error state** — Clear, actionable error messages. "Invalid API key" vs "Network error" vs "Rate limited" must be distinct.

### Error Handling
- **Invalid API key**: Show inline error with link to get a key. Don't just say "error."
- **Rate limit (429)**: "Rate limited — try again in a moment." Don't leave user confused.
- **Network failure**: "Network error — check your connection."
- **Empty selection**: Don't submit if nothing was selected or extracted.
- **No key set**: On first activation with no key, redirect to popup settings immediately.

### Keyboard / Dismissal
- **Single hotkey activation** — One shortcut to enter selection mode (configurable via Chrome command API).
- **Escape at any stage** — Cancels selection or closes panel.
- **Tab/focus trap in panel** — If panel has interactive elements (copy button), focus should be managed.

## Differentiating Features

Features that set this extension apart from Merlin/Monica/Sider:

### Architecture-level differentiators (already in spec)
- **Rubber-band visual selection** — Most extensions require text selection or whole-page context. Free-form region selection is unique.
- **DOM fast path** — Near-zero latency for text content vs screenshot path. Users notice this speed difference.
- **Auto-intent detection** — No mode switching. Most competitors require the user to pick "explain" or "summarize." Auto-detect reduces friction.
- **True BYOK** — No account, no subscription, no usage cap tied to the extension. Power users value this.
- **Zero telemetry** — Privacy-conscious users (developers, researchers) will choose this over tracked alternatives.

### UX differentiators worth considering
- **Selection refinement** — Allow user to nudge selection boundaries after initial draw (arrow keys or drag handles).
- **Re-run last selection** — "Redo" the last selection with a second keypress. Useful for iterating on prompts.

## Anti-Features (Explicitly Avoid)

Given the BYOK + privacy-first positioning, these would undermine the product's identity:

| Feature | Why to Avoid |
|---------|-------------|
| Account / login system | Contradicts zero-infrastructure principle; adds auth complexity |
| Cloud sync of results | Privacy violation risk; ephemeral is the feature |
| Usage analytics / telemetry | Core promise is zero data collection |
| "Upgrade to Pro" prompts | BYOK means no monetization via subscription |
| Social sharing | Not the use case; adds surface area |
| Built-in prompt library | Adds UI complexity; auto-detect handles this |
| Suggested prompts sidebar | Scope creep for MVP |
| Multiple provider selection UI | Gemini-only for MVP; abstract internally, don't surface in UI yet |

## Onboarding Flow Patterns

Based on successful BYOK extension patterns:

### First-run (no key set)
1. User installs extension → pin it to toolbar
2. Click toolbar icon → popup opens with "Enter your Gemini API key to get started"
3. Input field + "Get a free API key →" link to Google AI Studio
4. User pastes key → click Save → success confirmation
5. Brief tooltip or banner: "Press Alt+S on any page to start selecting"

### First activation (key set, never used)
- The result panel itself is self-explanatory — no tutorial overlay needed
- First error (if any) should be maximally helpful

### Key considerations
- Don't gate activation behind onboarding flow — if they have a key stored, just work
- Make key visible/copyable in popup (show/hide toggle) so users can verify it

## Result Panel UX Patterns

### Minimum viable panel
- Floating position: bottom-right corner by default, or near the selection
- Width: 380–480px
- Streaming text renders in readable font (not monospace unless code detected)
- Copy button (top-right of panel)
- Close button (X, top-right corner)
- Source indicator: "via Gemini Flash" (small, subtle)

### Nice-to-have (Phase 3+)
- Code blocks with syntax highlighting when code detected in response
- "Ask a follow-up" input field
- Drag to reposition panel
- Keyboard shortcut to copy (Ctrl+C while panel focused)

## Summary

- Table stakes: streaming render, copy button, Esc to close, distinct error states, loading skeleton
- Differentiators: rubber-band selection + auto-intent + DOM fast path + true BYOK + zero telemetry
- Anti-features: no accounts, no analytics, no sync, no subscriptions
- Onboarding: popup key entry → one-line usage hint → that's it
