---
phase: 01-core-mvp
plan: "05"
subsystem: llm
tags: [gemini, streaming, service-worker, chrome-mv3, ports, abort-controller, typescript]

# Dependency graph
requires:
  - phase: 01-02
    provides: storage/keys.ts with getApiKey(), hasApiKey() used by gemini.ts and service-worker.ts
  - phase: 01-03
    provides: extraction layer (extractVisibleText) that content-script will pass text from
provides:
  - src/llm/gemini.ts — GoogleGenAI client factory (createGeminiClient, GEMINI_MODEL, GeminiClient type)
  - src/llm/prompts.ts — buildPrompt() with auto-intent detection (no user mode selection)
  - src/llm/streaming.ts — streamToPort() with port.onDisconnect-before-loop + AbortController HTTP cancel
  - src/service-worker.ts — full SW: command routing, port listener, check-api-key, open-popup
affects:
  - 01-04 (Top Layer panel) — panel will receive {type:'token'|'done'|'error'} messages via the port protocol
  - 01-06 (content-script) — content-script opens 'llm-stream' port and sends {type:'generate', text}
  - 01-07 (integration tests) — streaming E2E tests verify the full port protocol end-to-end

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "@google/genai SDK: GoogleGenAI({ apiKey }), ai.models.generateContentStream({ model, contents, config }), chunk.text getter"
    - "Port lifecycle: port.onDisconnect wired BEFORE async loop — missed disconnect events prevented"
    - "AbortController pattern: abort.abort() in onDisconnect handler cancels in-flight Gemini HTTP request"
    - "AbortError swallowing: err.name === 'AbortError' caught silently — not surfaced as user error"
    - "Error classification ladder: NO_API_KEY → no-key, api_key_invalid → invalid-key, quota/rate/429 → rate-limited, network/fetch → network, else unknown"
    - "chrome.tabs.create for open-popup (not chrome.action.openPopup which requires user gesture)"

key-files:
  created:
    - src/llm/gemini.ts
    - src/llm/prompts.ts
    - src/llm/streaming.ts
  modified:
    - src/service-worker.ts

key-decisions:
  - "@google/genai SDK used (not deprecated @google/generative-ai) — generateContentStream returns AsyncGenerator<GenerateContentResponse>"
  - "abortSignal is a direct field in GenerateContentConfig (not nested) — confirmed from SDK type definitions"
  - "port.onDisconnect wired before await createGeminiClient() — ensures no disconnect events missed even during client init"
  - "chrome.tabs.create used for open-popup (not chrome.action.openPopup) — openPopup requires user gesture, silently fails from message handlers"
  - "buildPrompt embeds system instruction inline with user content (single string) — @google/genai systemInstruction field in config exists but inline approach avoids API surface differences"
  - "Error messages are human-readable strings — no raw API error codes exposed to user per CONTEXT.md locked decision"

patterns-established:
  - "LLM error classification: string-match on error.message.toLowerCase() → ErrorType enum → human-readable string"
  - "Port message protocol: generate → token* → done|error (port stays open until done/error)"
  - "SW message handler pattern: return true for async sendResponse, no return for sync"

requirements-completed:
  - LLM-01
  - LLM-02
  - LLM-03
  - LLM-04
  - KEY-04

# Metrics
duration: 2min
completed: 2026-02-25
---

# Phase 1 Plan 05: Service Worker + Gemini Streaming Summary

**Port-based Gemini streaming via @google/genai SDK with AbortController HTTP cancellation, auto-intent prompt engineering, and human-readable error classification**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-25T06:31:33Z
- **Completed:** 2026-02-25T06:33:29Z
- **Tasks:** 2 (LLM modules + service worker)
- **Files modified:** 4

## Accomplishments
- Four files implementing the complete service worker + Gemini streaming pipeline
- CLAUDE.md hard rule enforced: port.onDisconnect wired before the async streaming loop in streamToPort()
- AbortController wired to port.onDisconnect so in-flight Gemini HTTP request is cancelled immediately on panel dismiss (stops BYOK charges)
- Build succeeds (269KB service worker including @google/genai SDK), all 30 existing unit tests still pass
- Auto-intent prompt strategy: AI classifies content type and responds appropriately with no user mode selection (LLM-02)

## Task Commits

Each task was committed atomically:

1. **Task 1: Gemini client + prompt engineering + streaming helper** - `60451d9` (feat)
2. **Task 2: Service worker — command routing, port listener, API key check, streaming orchestration** - `63fd45c` (feat)

**Plan metadata:** (docs commit — see below)

## Service Worker Message Types

| Message | Transport | Handler | Response |
|---------|-----------|---------|----------|
| `activate-selection` | `chrome.commands.onCommand` | SW sends to active tab | None (fire and forget) |
| `check-api-key` | `chrome.runtime.onMessage` | SW calls `hasApiKey()` | `true`/`false` (async) |
| `open-popup` | `chrome.runtime.onMessage` | SW calls `chrome.tabs.create` | `true` (sync) |
| `generate` | Port `llm-stream` (onMessage) | SW calls `streamToPort()` | Streaming tokens via port |

## Port Protocol

```
Content script opens port: chrome.runtime.connect({ name: 'llm-stream' })
Content script sends:       { type: 'generate', text: '...', retryContext?: '...' }
Service worker streams:     { type: 'token', text: '...' }  (repeated N times)
Service worker terminates:  { type: 'done' }                (success)
                            { type: 'error', error: '...', errorType: '...' }  (failure)
```

## Error Types and Human-Readable Messages

| ErrorType | Trigger Condition | User-Facing Message |
|-----------|-------------------|---------------------|
| `no-key` | `NO_API_KEY` in error message | "No API key configured — open settings to add your Gemini key." |
| `invalid-key` | `api_key_invalid`, `api key not valid`, `invalid api key` | "API key invalid — check your key in settings." |
| `rate-limited` | `quota`, `rate`, `429` | "Rate limit reached — wait a moment and try again." |
| `network` | `network`, `failed to fetch`, `networkerror` | "Network error — check your connection and try again." |
| `unknown` | All other errors | "Something went wrong — try again." |

AbortError (from port disconnect cancellation) is caught silently — not surfaced to user.

## Gemini API Details

- **Model:** `gemini-2.0-flash`
- **SDK:** `@google/genai` v1.0.0 (not deprecated `@google/generative-ai`)
- **Key SDK differences from old SDK:**
  - Constructor: `new GoogleGenAI({ apiKey })` (vs `new GoogleGenerativeAI(apiKey)`)
  - Streaming: `ai.models.generateContentStream({ model, contents, config })` (vs `model.generateContentStream(contents)`)
  - Response: `chunk.text` getter returns `string | undefined` (vs `chunk.text()` method call)
  - AbortSignal: `config.abortSignal` field in `GenerateContentConfig` (confirmed from type definitions)

## AbortController Pattern

```
port.onDisconnect → abort.abort() → Gemini HTTP request cancelled
                                  → for-await loop gets AbortError
                                  → AbortError caught and swallowed
                                  → User sees nothing (panel already closed)
```

This prevents BYOK charges from completing requests after the user has dismissed the panel.

## buildPrompt Strategy

Auto-intent detection with no user mode selection (LLM-02 requirement):
- Technical content (code, formulas) → explain clearly
- Long prose/articles → summarize concisely
- Problems/questions/exercises → solve or answer
- Unknown content type → describe and explain

Rules enforced in prompt:
- No preamble ("Sure!", "Of course!")
- Plain text only (no markdown, bullets, headers)
- Respond in the same language as selected text
- Optional `retryContext` appended when user provides follow-up

## Files Created/Modified
- `src/llm/gemini.ts` — `createGeminiClient()` factory using @google/genai; throws `NO_API_KEY` if no key stored; exports `GeminiClient` type alias and `GEMINI_MODEL` constant
- `src/llm/prompts.ts` — `buildPrompt(selectedText, retryContext?)` with auto-intent system instruction and optional retry context
- `src/llm/streaming.ts` — `streamToPort(port, message)`: port.onDisconnect + AbortController wired before async loop; streams tokens; classifies and humanizes errors
- `src/service-worker.ts` — Full MV3 service worker replacing `export {}` stub; chrome.commands, chrome.runtime.onMessage, chrome.runtime.onConnect handlers

## Decisions Made

- **`abortSignal` in GenerateContentConfig (not top-level):** Verified directly from @google/genai TypeScript type definitions — `GenerateContentConfig.abortSignal` is the correct field name
- **`chrome.tabs.create` for open-popup:** `chrome.action.openPopup()` requires a user gesture and silently fails from message handlers; `chrome.tabs.create` is reliable from any context
- **buildPrompt uses single string (no systemInstruction field):** Avoids needing to split system/user content across API fields; simpler, more portable
- **port.onDisconnect wired before `await createGeminiClient()`:** Even client initialization (which reads from chrome.storage.local) is async — wiring after any await risks missing a disconnect that happens during that await

## Deviations from Plan

None — plan executed exactly as written. All code in the plan was used as-is; the only investigation was confirming the `abortSignal` field name and `chunk.text` accessor from the SDK type definitions (both matched the plan's expectations).

## Issues Encountered

None — @google/genai was already installed, TypeScript compiled cleanly on first attempt, build succeeded without modifications.

## User Setup Required

**External service configuration needed.** Users must provide their own Gemini API key:
- Get a Gemini API key: Google AI Studio → https://aistudio.google.com/app/apikey → Create API key
- Enter the key in the extension popup (click the extension icon in Chrome)

This is BYOK by design — the extension never stores any backend credentials.

## Next Phase Readiness
- Service worker is fully operational — ready to receive `llm-stream` port connections from content-script
- streamToPort() exports clean interface: takes `(port, { type: 'generate', text, retryContext? })` → streams tokens
- All three LLM modules export TypeScript-typed interfaces; content-script.ts (Plan 06) can import streamToPort pattern reference
- 30/30 unit tests still passing — extraction layer unaffected

---
*Phase: 01-core-mvp*
*Completed: 2026-02-25*

## Self-Check: PASSED

- src/llm/gemini.ts exists on disk (verified)
- src/llm/prompts.ts exists on disk (verified)
- src/llm/streaming.ts exists on disk (verified)
- src/service-worker.ts modified and non-stub (verified)
- .planning/phases/01-core-mvp/01-05-SUMMARY.md exists on disk (this file)
- All 2 task commits exist: 60451d9 (feat: LLM modules), 63fd45c (feat: service worker)
