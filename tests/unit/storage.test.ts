import { describe, it } from 'vitest';

// Tests will be filled in when src/storage/keys.ts is implemented (Plan 02)
describe('Storage: API key management', () => {
  it.todo('getApiKey: returns null when no key stored');
  it.todo('getApiKey: returns stored key');
  it.todo('saveApiKey: persists key to chrome.storage.local');
  it.todo('clearApiKey: removes key from storage');
  it.todo('hasApiKey: returns false when key missing');
  it.todo('hasApiKey: returns true when key present');
});
