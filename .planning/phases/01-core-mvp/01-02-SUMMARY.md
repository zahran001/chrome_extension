---
phase: 01-core-mvp
plan: "02"
subsystem: storage-popup
tags: [chrome-storage, byok, popup, typescript, vitest, gemini-api]

# Dependency graph
requires:
  - 01-01 (build pipeline, test infrastructure, stubs for popup.html/popup.ts/storage.test.ts)
provides:
  - chrome.storage.local typed wrapper (getApiKey, saveApiKey, clearApiKey, hasApiKey)
  - Working BYOK settings popup with masked input, eye toggle, Gemini key validation, and save confirmation
  - 7 passing unit tests for storage/keys.ts
affects:
  - 01-05 (service worker) — uses getApiKey/hasApiKey to retrieve key before Gemini calls
  - 01-07 (integration tests) — popup.spec.ts stubs now have real UI to test against

# Tech tracking
tech-stack:
  added: []
  patterns:
    - chrome.storage.local CRUD via typed async wrapper (avoids direct API calls in feature code)
    - Popup isolated by Chrome — no Shadow DOM needed; standard CSS link works
    - Gemini validation via lightweight GET /v1beta/models?key= endpoint (no token cost)
    - Unicode escapes for emoji in TypeScript (avoids file encoding issues on Windows)

key-files:
  created:
    - src/storage/keys.ts
    - src/ui/popup.css
  modified:
    - src/popup.html
    - src/popup.ts
    - tests/unit/storage.test.ts

key-decisions:
  - "Used /v1beta/models?key= GET endpoint for key validation — zero token cost, returns 200 on valid key or 400/403 on invalid"
  - "Unicode escapes for emoji characters in popup.ts — avoids Windows CRLF/encoding issues in TypeScript source"
  - "hasApiKey checks both null AND whitespace-only — whitespace key would cause cryptic Gemini errors downstream"

# Metrics
duration: 3min
completed: 2026-02-25
---

# Phase 1 Plan 02: BYOK Settings Popup Summary

**chrome.storage.local typed wrapper (getApiKey/saveApiKey/clearApiKey/hasApiKey) with 7 passing unit tests, plus a working Gemini BYOK settings popup featuring masked input, eye-icon visibility toggle, live key validation against Gemini models API, and green save confirmation**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-25T06:21:07Z
- **Completed:** 2026-02-25T06:23:40Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- `src/storage/keys.ts` exports 4 typed functions: `getApiKey`, `saveApiKey`, `clearApiKey`, `hasApiKey`
- `tests/unit/storage.test.ts` has 7 passing tests replacing 6 todo stubs; covers null return, value return, set call, remove call, false/true/whitespace for hasApiKey
- `src/popup.html` full settings form with labeled password input, eye-icon toggle button, Test Key + Save buttons, and polite status region
- `src/popup.ts` 85 lines: loads existing key on open, toggles visibility, validates key via Gemini models endpoint, saves key with .saved CSS class feedback, clears status on input change
- `src/ui/popup.css` 148 lines: clean popup styling, green border/background for .saved state, color-coded status messages
- Build includes popup in dist/src/popup.html; popup JS bundle 2.42 kB gzipped to 1.16 kB

## Storage API Signatures

```typescript
// src/storage/keys.ts
getApiKey(): Promise<string | null>
saveApiKey(key: string): Promise<void>
clearApiKey(): Promise<void>
hasApiKey(): Promise<boolean>   // false if null OR whitespace-only
```

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Storage wrapper + unit tests | b0e992b | src/storage/keys.ts, tests/unit/storage.test.ts |
| 2 | Settings popup HTML/TS/CSS | b28c7b1 | src/popup.html, src/popup.ts, src/ui/popup.css |

## Files Created/Modified

- `src/storage/keys.ts` — thin `chrome.storage.local` wrapper, 20 lines
- `src/ui/popup.css` — popup styling, 148 lines; green .saved state, status color variants
- `src/popup.html` — full settings form replacing stub; references ./ui/popup.css
- `src/popup.ts` — 85-line popup script; imports getApiKey/saveApiKey from storage/keys
- `tests/unit/storage.test.ts` — 7 real tests replacing 6 todo stubs

## Validation Endpoint Decision

Used `GET https://generativelanguage.googleapis.com/v1beta/models?key=${key}` for Test Key validation:
- Returns HTTP 200 on valid key (lists available models)
- Returns HTTP 400 on invalid/malformed key
- Returns HTTP 429 on quota exceeded (key is valid, just rate-limited — user sees distinct message)
- Zero token cost — no generation request made

## Deviations from Plan

None — plan executed exactly as written.

Only adaptation: used Unicode escapes (`\u{1F648}`, `\u{1F441}`, `\u2713`, `\u2014`) instead of raw emoji/symbols in popup.ts to avoid Windows CRLF/encoding issues in TypeScript source files. Visual output is identical.

## Issues Encountered

None. Build clean on first attempt. All 7 tests passed on first run.

## Next Phase Readiness

- Service worker (Plan 05) can call `getApiKey()` / `hasApiKey()` directly from `src/storage/keys.ts`
- Popup E2E tests (popup.spec.ts) can now test against the real popup UI
- KEY-04 (SW checks hasApiKey before streaming, opens popup if missing) deferred to Plan 05 per plan spec

---
*Phase: 01-core-mvp*
*Completed: 2026-02-25*

## Self-Check: PASSED

- src/storage/keys.ts exists on disk (verified)
- src/popup.html exists on disk (verified)
- src/popup.ts exists on disk (verified)
- src/ui/popup.css exists on disk (verified)
- tests/unit/storage.test.ts exists on disk (verified)
- .planning/phases/01-core-mvp/01-02-SUMMARY.md exists on disk (verified)
- Task 1 commit b0e992b exists in git log (verified)
- Task 2 commit b28c7b1 exists in git log (verified)
