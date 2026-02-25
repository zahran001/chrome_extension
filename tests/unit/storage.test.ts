import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getApiKey, saveApiKey, clearApiKey, hasApiKey } from '../../src/storage/keys';

describe('Storage: API key management', () => {
  beforeEach(() => {
    // Reset mock state between tests
    vi.clearAllMocks();
    // Default: no key stored
    (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockResolvedValue({});
  });

  it('getApiKey: returns null when no key stored', async () => {
    (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockResolvedValue({});
    const key = await getApiKey();
    expect(key).toBeNull();
  });

  it('getApiKey: returns stored key', async () => {
    (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      geminiApiKey: 'test-key-123'
    });
    const key = await getApiKey();
    expect(key).toBe('test-key-123');
  });

  it('saveApiKey: persists key to chrome.storage.local', async () => {
    await saveApiKey('my-api-key');
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      geminiApiKey: 'my-api-key'
    });
  });

  it('clearApiKey: removes key from storage', async () => {
    await clearApiKey();
    expect(chrome.storage.local.remove).toHaveBeenCalledWith('geminiApiKey');
  });

  it('hasApiKey: returns false when key missing', async () => {
    (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockResolvedValue({});
    expect(await hasApiKey()).toBe(false);
  });

  it('hasApiKey: returns true when key present', async () => {
    (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      geminiApiKey: 'some-key'
    });
    expect(await hasApiKey()).toBe(true);
  });

  it('hasApiKey: returns false for whitespace-only key', async () => {
    (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      geminiApiKey: '   '
    });
    expect(await hasApiKey()).toBe(false);
  });
});
