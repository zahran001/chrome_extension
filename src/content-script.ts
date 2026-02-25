import { SelectionRenderer } from './ui/selection-renderer';
import { extractVisibleText } from './extraction/tree-walker';
import { showPanel } from './ui/panel';

// MAX_CHARS guard — protects BYOK quota and prevents token explosion (Suggestion B)
const MAX_CHARS = 20_000;

const renderer = new SelectionRenderer();
let isSelectionMode = false;
let isDragging = false;
let dragAbort: AbortController | null = null;

// Listen for Alt+S command from service worker / background
// Chrome MV3 commands are handled in service worker; SW sends message to content script
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'activate-selection') {
    activateSelectionMode();
  }
});

function activateSelectionMode(): void {
  if (isSelectionMode) return; // Prevent double-activation
  isSelectionMode = true;

  // Set crosshair cursor (SEL-02 locked)
  document.documentElement.style.cursor = 'crosshair';

  // Listen for mousedown to start drag
  const startAbort = new AbortController();
  document.addEventListener('mousedown', onMouseDown, {
    signal: startAbort.signal,
    capture: true,
  });

  // Also listen for Escape before any drag starts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isSelectionMode) {
      e.preventDefault();
      deactivateSelectionMode();
    }
  }, { signal: startAbort.signal });

  // Store reference so deactivate can clean up
  dragAbort = startAbort;
}

function onMouseDown(e: MouseEvent): void {
  if (e.button !== 0) return; // Left click only
  e.preventDefault();

  isDragging = true;
  const startX = e.clientX;
  const startY = e.clientY;

  // Disable scrolling (SEL-04 locked)
  document.body.style.overflow = 'hidden';
  // Prevent text selection during drag
  document.body.style.userSelect = 'none';

  renderer.startDrag(startX, startY);

  // Per-drag abort controller (separate from mode abort)
  const perDragAbort = new AbortController();

  document.addEventListener('mousemove', (moveEvent) => {
    renderer.updateDrag(moveEvent.clientX, moveEvent.clientY);
  }, { signal: perDragAbort.signal });

  document.addEventListener('mouseup', (upEvent) => {
    isDragging = false;
    perDragAbort.abort(); // Remove drag listeners
    // Restore scrolling immediately (SEL-04, Pitfall 5)
    document.body.style.overflow = '';
    document.body.style.userSelect = '';
    renderer.endDrag(upEvent.clientX, upEvent.clientY);
  }, { signal: perDragAbort.signal, once: true });

  document.addEventListener('keydown', (keyEvent) => {
    if (keyEvent.key === 'Escape') {
      keyEvent.preventDefault();
      isDragging = false;
      perDragAbort.abort();
      // Restore scrolling (Pitfall 5 — ALL exit paths must restore)
      document.body.style.overflow = '';
      document.body.style.userSelect = '';
      renderer.cleanup();
      deactivateSelectionMode();
    }
  }, { signal: perDragAbort.signal });
}

function deactivateSelectionMode(): void {
  isSelectionMode = false;
  isDragging = false;

  // Restore cursor
  document.documentElement.style.cursor = '';

  // Restore body in case cleanup was skipped
  document.body.style.overflow = '';
  document.body.style.userSelect = '';

  // Abort all selection-mode listeners
  dragAbort?.abort();
  dragAbort = null;

  renderer.cleanup();
}

/**
 * Open a long-lived port to the service worker and wire all streaming event handlers.
 * Handles token forwarding, done/error completion, mid-stream disconnect, and
 * the rba-dismiss abort chain (panel dismiss → port.disconnect → SW abort.abort()).
 */
function openStreamPort(extractedText: string, retryContext?: string): void {
  const port = chrome.runtime.connect({ name: 'llm-stream' });

  // Wire onDisconnect BEFORE any messages (CLAUDE.md hard rule: port lifecycle)
  // SW killed mid-stream → dispatch rba-interrupted so panel shows partial response notice
  port.onDisconnect.addListener(() => {
    document.dispatchEvent(new CustomEvent('rba-interrupted'));
  });

  port.onMessage.addListener((msg) => {
    if (msg.type === 'token') {
      document.dispatchEvent(new CustomEvent('rba-token', { detail: msg.text }));
    } else if (msg.type === 'done') {
      document.dispatchEvent(new CustomEvent('rba-done'));
      port.disconnect();
    } else if (msg.type === 'error') {
      document.dispatchEvent(new CustomEvent('rba-error', { detail: msg }));
      port.disconnect();
    }
  });

  // Abort chain: panel.dismiss() dispatches rba-dismiss → we disconnect port →
  // SW port.onDisconnect fires → abort.abort() in streaming.ts cancels Gemini HTTP request.
  // { once: true } ensures listener is auto-removed after first dismiss. (Suggestion A)
  document.addEventListener('rba-dismiss', () => {
    port.disconnect();
  }, { once: true });

  // Send extracted text to service worker (with optional retry context)
  port.postMessage({ type: 'generate', text: extractedText, retryContext });
}

// Wire up confirm: extract text, check for key, open streaming port
renderer.setOnConfirm(async (selectionRect: DOMRect) => {
  deactivateSelectionMode();

  // Extract visible text from selection bounds (EXT-01, EXT-02, EXT-03)
  let extractedText = extractVisibleText(document.documentElement, selectionRect);

  // Guard against token explosion (Suggestion B: MAX_CHARS = 20_000)
  if (extractedText.length > MAX_CHARS) {
    extractedText = extractedText.slice(0, MAX_CHARS) + '\n\n[Selection truncated \u2014 too large to send]';
  }

  // showPanel is statically imported at the top of this file (Issue B fix: no dynamic import)

  // Check for API key (KEY-04)
  const hasKey = await chrome.runtime.sendMessage({ type: 'check-api-key' });
  if (!hasKey) {
    // No key: show setup prompt in panel (per CONTEXT.md first-run decision)
    showPanel({ mode: 'setup' });
    return;
  }

  // Show panel with loading skeleton (PNL-02)
  // Pass onRetry callback so panel's retry section re-runs the same selection
  // with the user's additional context appended (Issue F close: retry wiring)
  showPanel({
    mode: 'loading',
    onRetry: (retryContext: string) => {
      // Re-run the same selection with additional user context
      openStreamPort(extractedText, retryContext);
    },
  });

  // Open long-lived port to service worker and start streaming (LLM-03)
  openStreamPort(extractedText);
});
