const STORAGE_KEY = 'openaiApiKey';

export async function getApiKey(): Promise<string | null> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] ?? null;
}

export async function saveApiKey(key: string): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: key });
}

export async function clearApiKey(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY);
}

export async function hasApiKey(): Promise<boolean> {
  const key = await getApiKey();
  return key !== null && key.trim().length > 0;
}
