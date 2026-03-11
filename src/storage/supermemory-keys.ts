const SM_KEY = 'supermemoryApiKey';

export async function getSupermemoryKey(): Promise<string | null> {
  const result = await chrome.storage.local.get(SM_KEY);
  return result[SM_KEY] ?? null;
}

export async function saveSupermemoryKey(key: string): Promise<void> {
  await chrome.storage.local.set({ [SM_KEY]: key });
}

export async function clearSupermemoryKey(): Promise<void> {
  await chrome.storage.local.remove(SM_KEY);
}

export async function hasSupermemoryKey(): Promise<boolean> {
  const key = await getSupermemoryKey();
  return key !== null && key.trim().length > 0;
}
