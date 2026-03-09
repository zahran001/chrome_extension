import { streamToPort } from './llm/streaming';
import { hasApiKey } from './storage/keys';

/**
 * Alt+S keyboard command: activate selection mode in the active tab's content script.
 * Chrome MV3 commands are handled in the service worker via chrome.commands.onCommand.
 */
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'activate-selection') {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab?.id) return;

    // Send activation message to content script
    // Content scripts aren't injected on chrome:// or extension pages — swallow the error
    chrome.tabs.sendMessage(activeTab.id, { type: 'activate-selection' }).catch(() => {});
  }
});

/**
 * Handle one-off messages from content scripts.
 * Currently: check-api-key (KEY-04 — first-run flow).
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'check-api-key') {
    hasApiKey().then(sendResponse);
    return true; // Keep channel open for async response
  }

  if (message.type === 'open-popup') {
    // KEY-04: open the popup for key setup.
    // chrome.action.openPopup() requires a user gesture and silently fails from message handlers.
    // chrome.tabs.create is 100% reliable across all Chrome versions (Issue C fix).
    chrome.tabs.create({ url: chrome.runtime.getURL('src/popup.html') });
    sendResponse(true);
  }
});

/**
 * Long-lived port for LLM streaming (LLM-03, LLM-04).
 * Port name 'llm-stream' — opened by content script on selection confirm.
 * The open port keeps the service worker alive for up to 5 minutes (MV3 spec).
 */
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'llm-stream') return;

  port.onMessage.addListener(async (message) => {
    if (message.type === 'generate') {
      // streamToPort handles all streaming, error classification, and port.onDisconnect
      await streamToPort(port, {
        type: 'generate',
        text: message.text,
        retryContext: message.retryContext,
      });
    }
  });

  // SW-side disconnect handler (complementary to content script's port.onDisconnect)
  // This fires if the content script's tab is closed mid-stream
  port.onDisconnect.addListener(() => {
    // Tab closed or content script unloaded — stream already cleaned up in streamToPort
    // No action needed here, but log during development
    console.debug('[RubberBandAI SW] Port disconnected');
  });
});

/**
 * Service worker install: no persistent state to set up.
 * Ephemeral results = no storage initialization needed.
 */
self.addEventListener('install', () => {
  console.debug('[RubberBandAI SW] Installed');
});

self.addEventListener('activate', () => {
  console.debug('[RubberBandAI SW] Activated');
});
