---
phase: 01-core-mvp
plan: "01"
subsystem: testing
tags: [vite, crxjs, typescript, vitest, playwright, jsdom, chrome-extension, mv3]

# Dependency graph
requires: []
provides:
  - Vite + CRXJS v2 build pipeline producing Chrome MV3 extension in dist/
  - TypeScript 5.x project configuration targeting ES2022
  - Chrome MV3 manifest with Alt+S command, CSP, and entry points
  - Vitest + JSDOM unit test infrastructure with chrome API mocks
  - Playwright E2E test infrastructure configured for headful Chrome extension testing
  - 28 todo unit test stubs across 4 files (aabb, extraction, visibility, storage)
  - 6 E2E test spec stubs for all planned feature areas
  - Static test fixture page for panel injection testing
affects:
  - 01-02 (popup BYOK) — uses test infrastructure and manifest
  - 01-03 (AABB/TreeWalker) — fills in aabb.test.ts and extraction.test.ts stubs
  - 01-04 (panel) — uses panel.spec.ts stub and selection-page.html fixture
  - 01-05 (content-script/SW) — fills service-worker.ts and content-script.ts stubs
  - 01-06 (streaming) — fills streaming.spec.ts and port-lifecycle.spec.ts
  - 01-07 (integration) — uses all stubs

# Tech tracking
tech-stack:
  added:
    - vite@5.x
    - "@crxjs/vite-plugin@2.3.x"
    - typescript@5.x
    - vitest@1.x
    - "@playwright/test@1.40.x"
    - jsdom@24.x
    - "@google/genai@1.x"
    - "@types/chrome@0.0.270"
  patterns:
    - CRXJS manifest-driven build (src/manifest.json is source of truth)
    - Vitest globals mode with chrome API mocks in setup.ts
    - Playwright headful Chrome extension testing with --load-extension flag
    - Stub test files with it.todo() to reserve test slots for later implementation

key-files:
  created:
    - package.json
    - vite.config.ts
    - tsconfig.json
    - src/manifest.json
    - src/service-worker.ts
    - src/content-script.ts
    - src/popup.html
    - src/popup.ts
    - src/ui/panel.css
    - vitest.config.ts
    - playwright.config.ts
    - tests/setup.ts
    - tests/unit/aabb.test.ts
    - tests/unit/extraction.test.ts
    - tests/unit/visibility.test.ts
    - tests/unit/storage.test.ts
    - tests/e2e/selection.spec.ts
    - tests/e2e/port-lifecycle.spec.ts
    - tests/e2e/streaming.spec.ts
    - tests/e2e/panel.spec.ts
    - tests/e2e/popup.spec.ts
    - tests/e2e/first-run.spec.ts
    - tests/fixtures/selection-page.html
  modified: []

key-decisions:
  - "Used @crxjs/vite-plugin v2 (not v1) — v2 supports Vite 5.x and MV3 service worker type=module"
  - "moduleResolution: bundler in tsconfig — required for Vite's module resolution to work correctly"
  - "tsconfig exclude: tests/ — prevents test files from polluting src/ type checking"
  - "Playwright fullyParallel: false — Chrome extensions require single browser instance"
  - "src/ui/panel.css stub created — CRXJS requires all web_accessible_resources to exist at build time"

patterns-established:
  - "Stub pattern: entry point stubs use export {} to be valid ESM modules without content"
  - "Test todo pattern: all test stubs use it.todo() to be valid and skipped without implementation"
  - "Chrome mock pattern: tests/setup.ts centralizes all chrome.* API mocks for unit tests"

requirements-completed:
  - TST-01
  - TST-02
  - TST-03
  - TST-04

# Metrics
duration: 5min
completed: 2026-02-25
---

# Phase 1 Plan 01: Project Scaffold Summary

**Vite + CRXJS v2 Chrome MV3 build pipeline with Vitest + JSDOM unit tests and Playwright E2E infrastructure, including 28 todo test stubs across 4 unit files and 6 E2E spec files**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-25T06:11:30Z
- **Completed:** 2026-02-25T06:16:41Z
- **Tasks:** 2
- **Files modified:** 23

## Accomplishments
- Chrome MV3 extension builds successfully with CRXJS v2 — dist/ contains manifest.json, service worker loader, and all entry points
- Vitest + JSDOM unit test infrastructure running with 28 todo test stubs and zero errors
- Playwright E2E config ready for headful Chrome extension testing; Chromium browser installed
- All 15 test/fixture files created at expected paths so later plans' verify commands work immediately

## Task Commits

Each task was committed atomically:

1. **Task 1: Project scaffold** - `4328407` (chore)
2. **Task 2: Test infrastructure** - `129c65d` (chore)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `package.json` - Project config with Vite, CRXJS, Vitest, Playwright, and @google/genai dependencies
- `vite.config.ts` - CRXJS v2 plugin config targeting ES2022 with sourcemaps
- `tsconfig.json` - TypeScript 5.x with moduleResolution:bundler, includes src/ only
- `src/manifest.json` - Chrome MV3 manifest: Alt+S command, storage/activeTab/scripting permissions, CSP
- `src/service-worker.ts` - Empty stub module (filled by Plan 05)
- `src/content-script.ts` - Empty stub module (filled by Plan 05)
- `src/popup.html` - Minimal HTML pointing to popup.ts (filled by Plan 02)
- `src/popup.ts` - Empty stub module (filled by Plan 02)
- `src/ui/panel.css` - Empty stub CSS (filled by Plan 04); required by web_accessible_resources
- `vitest.config.ts` - jsdom environment, tests/unit glob, globals mode, tests/setup.ts
- `playwright.config.ts` - Chrome extension E2E with --load-extension, headful, sequential execution
- `tests/setup.ts` - chrome.storage.local and chrome.runtime mock for unit tests
- `tests/unit/aabb.test.ts` - 9 todo tests for AABB collision detection (Plan 03)
- `tests/unit/extraction.test.ts` - 7 todo tests for TreeWalker extraction (Plan 03)
- `tests/unit/visibility.test.ts` - 6 todo tests for visibility filter (Plan 03)
- `tests/unit/storage.test.ts` - 6 todo tests for API key storage (Plan 02)
- `tests/e2e/selection.spec.ts` - 7 todo tests for rubber-band selection UI
- `tests/e2e/port-lifecycle.spec.ts` - 4 todo tests for SW port lifecycle
- `tests/e2e/streaming.spec.ts` - 4 todo tests for Gemini streaming
- `tests/e2e/panel.spec.ts` - 11 todo tests for result panel
- `tests/e2e/popup.spec.ts` - 5 todo tests for settings popup
- `tests/e2e/first-run.spec.ts` - 3 todo tests for first-run flow
- `tests/fixtures/selection-page.html` - Static HTML with visible/hidden/invisible elements for extraction testing

## Decisions Made
- Used `moduleResolution: "bundler"` in tsconfig — required for Vite 5.x module resolution to work correctly with CRXJS
- Created `src/ui/panel.css` stub — CRXJS plugin requires all `web_accessible_resources` files to physically exist at build time (deviation Rule 3 auto-fix)
- Set `fullyParallel: false` in playwright.config.ts — Chrome extensions require a single shared browser instance
- Set `tsconfig.exclude: ["tests"]` — prevents test files from polluting the src/ type-check scope

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created missing src/ui/panel.css stub**
- **Found during:** Task 1 (build verification)
- **Issue:** CRXJS plugin requires all files listed in `web_accessible_resources` to exist at build time. `src/ui/panel.css` was referenced in manifest.json but didn't exist, causing the build to fail with `ENOENT: Could not load manifest asset "src/ui/panel.css"`
- **Fix:** Created `src/ui/panel.css` with a single comment placeholder line
- **Files modified:** src/ui/panel.css
- **Verification:** `npm run build` exited 0 after fix
- **Committed in:** 4328407 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix was necessary for the build to succeed. No scope creep — panel.css is already planned for Plan 04, this just creates the stub early.

## Issues Encountered
- `npm WARN EBADENGINE` for undici@7.22.0 requiring Node >=20.18.1 (current: 20.13.1) — this is a transitive dependency warning, not an error; all packages installed successfully

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- Build pipeline fully operational; dist/ directory ready for extension loading
- Test infrastructure ready; all 28 unit test stubs will be filled by Plans 02-03
- All 6 E2E spec stubs will be filled by Plans 02-06
- Plan 02 (BYOK popup) can begin immediately — uses popup.html, popup.ts, and storage.test.ts stubs

---
*Phase: 01-core-mvp*
*Completed: 2026-02-25*

## Self-Check: PASSED

- All 18 key files exist on disk (verified)
- Both task commits exist: 4328407, 129c65d
- dist/ directory created with manifest.json (verified via npm run build)
- 28 unit test stubs run as todo/skipped (verified via npm run test:unit)
