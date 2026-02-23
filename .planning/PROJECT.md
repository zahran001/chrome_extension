# Rubber-Band AI

## What This Is

A Chrome Manifest V3 extension that lets users draw a rubber-band selection over any screen region and instantly get AI-powered explanation, summarization, or problem-solving — triggered by keyboard shortcut, results rendered in a floating Top Layer panel. No backend. No tracking. Bring Your Own Key.

## Core Value

Select anything on screen, understand it immediately — without leaving the page or copying text manually.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] User can activate rubber-band selection mode via keyboard shortcut
- [ ] User can drag to select any screen region
- [ ] Extension routes to DOM text extraction (fast path) or screenshot/VLM (visual fallback) based on content type
- [ ] Extension sends selected content to Gemini API and streams results
- [ ] Results render in a floating Top Layer panel (dialog/popover) that dominates all host-page z-index
- [ ] AI auto-detects intent from selected content (explain / summarize / solve)
- [ ] User can enter and store their Gemini API key via extension popup
- [ ] Results are ephemeral — panel close = gone, no persistence
- [ ] Large selection regions (> 800×800px) show a non-blocking size warning
- [ ] API key stored in chrome.storage.local only — never transmitted to any backend

### Out of Scope

- Multi-provider support (OpenAI, Anthropic) — Gemini-only for MVP, abstract later
- Result history / persistence — privacy-first, ephemeral by design
- Always-on overlay mode — keyboard activation only
- Local model / offline inference — browser BYOK only
- Mobile / Firefox support — Chrome MV3 only

## Context

- Chrome Manifest V3 architecture: content script (unprivileged) + background service worker (privileged) + top layer UI
- Cascade heuristic: DOM TreeWalker fast path (~2–5ms) vs. OffscreenCanvas + VLM screenshot fallback
- AABB collision test determines which DOM text nodes fall within the user's selection rectangle
- Top Layer API (dialog.showModal / popover) solves z-index dominance without hacks
- Viewport-locked selection during drag (scrolling disabled) bounds pixel-area to viewport size
- CSP in manifest.json restricts connect-src to Gemini endpoints only — defense-in-depth against supply-chain attacks
- No bundler complexity required for MVP — keep dependencies minimal

## Constraints

- **Platform:** Chrome MV3 only — architecture depends on service worker, OffscreenCanvas, chrome APIs
- **Auth:** BYOK (Bring Your Own Key) — no backend key proxy, no hardcoded credentials
- **Privacy:** Zero telemetry, zero server-side persistence, direct-to-provider API calls only
- **Performance:** Sub-500ms time-to-first-UI-feedback; streaming TTFB for LLM responses
- **Bundle:** Minimize dependencies — no Tesseract.js, no heavy ML libs client-side

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Gemini-only for MVP | Simplifies BYOK flow, single API surface, Flash handles both text + vision | — Pending |
| Top Layer API for UI | Eliminates z-index arms race without MutationObserver hacks | — Pending |
| VLM over client-side OCR | Smaller bundle, better accuracy, spatial reasoning in one pass | — Pending |
| Viewport-locked drag | Bounds selection area — prevents token explosion, keeps heuristic mathematically sound | — Pending |
| Ephemeral results | Privacy-first — no storage risk, simpler state management | — Pending |
| Auto-detect intent | Removes UX friction — AI infers explain/summarize/solve from content | — Pending |

---
*Last updated: 2026-02-23 after initialization*
