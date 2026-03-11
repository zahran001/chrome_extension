import { getApiKey, saveApiKey, clearApiKey } from './storage/keys';
import { getSupermemoryKey, saveSupermemoryKey, clearSupermemoryKey } from './storage/supermemory-keys';

const apiKeyInput = document.getElementById('api-key') as HTMLInputElement;
const toggleBtn = document.getElementById('toggle-visibility') as HTMLButtonElement;
const eyeIcon = document.getElementById('eye-icon') as HTMLSpanElement;
const keyStatus = document.getElementById('key-status') as HTMLDivElement;
const testKeyBtn = document.getElementById('test-key') as HTMLButtonElement;
const saveKeyBtn = document.getElementById('save-key') as HTMLButtonElement;
const clearKeyBtn = document.getElementById('clear-key') as HTMLButtonElement;

// Load existing key on open
async function loadExistingKey(): Promise<void> {
  const existingKey = await getApiKey();
  if (existingKey) {
    apiKeyInput.value = existingKey;
    showStatus('Key loaded from storage.', 'info');
  }
}

// Toggle visibility (password <-> text)
toggleBtn.addEventListener('click', () => {
  const isPassword = apiKeyInput.type === 'password';
  apiKeyInput.type = isPassword ? 'text' : 'password';
  eyeIcon.textContent = isPassword ? '\u{1F648}' : '\u{1F441}';
  toggleBtn.setAttribute('aria-label', isPassword ? 'Hide key' : 'Show key');
});

// Test key: cheap Gemini API validation call
testKeyBtn.addEventListener('click', async () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    showStatus('Enter a key first.', 'error');
    return;
  }

  testKeyBtn.disabled = true;
  showStatus('Testing key...', 'info');

  try {
    // Lightweight validation: list models endpoint
    const response = await fetch(
      'https://api.openai.com/v1/models',
      { method: 'GET', headers: { Authorization: `Bearer ${key}` } }
    );

    if (response.ok) {
      showStatus('Key valid \u2713', 'success');
    } else if (response.status === 401) {
      showStatus('API key invalid \u2014 check your key.', 'error');
    } else if (response.status === 429) {
      showStatus('Rate limited \u2014 key is valid but quota exceeded.', 'warning');
    } else {
      showStatus(`Unexpected error: HTTP ${response.status}`, 'error');
    }
  } catch (_err) {
    showStatus('Network error \u2014 check your connection.', 'error');
  } finally {
    testKeyBtn.disabled = false;
  }
});

// Save key
saveKeyBtn.addEventListener('click', async () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    showStatus('Enter a key first.', 'error');
    return;
  }

  saveKeyBtn.disabled = true;
  try {
    await saveApiKey(key);
    apiKeyInput.classList.add('saved');
    showStatus('Key saved \u2713', 'success');
    setTimeout(() => window.close(), 800);
  } catch (_err) {
    showStatus('Failed to save key. Try again.', 'error');
  } finally {
    saveKeyBtn.disabled = false;
  }
});

// Clear key from storage
clearKeyBtn.addEventListener('click', async () => {
  clearKeyBtn.disabled = true;
  try {
    await clearApiKey();
    apiKeyInput.value = '';
    apiKeyInput.classList.remove('saved');
    showStatus('Key cleared.', 'info');
  } catch (_err) {
    showStatus('Failed to clear key.', 'error');
  } finally {
    clearKeyBtn.disabled = false;
  }
});

// Clear saved state when user edits
apiKeyInput.addEventListener('input', () => {
  apiKeyInput.classList.remove('saved');
  clearStatus();
});

function showStatus(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
  keyStatus.textContent = message;
  keyStatus.className = `key-status ${type}`;
}

function clearStatus(): void {
  keyStatus.textContent = '';
  keyStatus.className = 'key-status';
}

// ── Supermemory key section ──────────────────────────────────────────────────

const smKeyInput = document.getElementById('sm-api-key') as HTMLInputElement;
const smToggleBtn = document.getElementById('sm-toggle-visibility') as HTMLButtonElement;
const smEyeIcon = document.getElementById('sm-eye-icon') as HTMLSpanElement;
const smKeyStatus = document.getElementById('sm-key-status') as HTMLDivElement;
const smSaveKeyBtn = document.getElementById('sm-save-key') as HTMLButtonElement;
const smClearKeyBtn = document.getElementById('sm-clear-key') as HTMLButtonElement;

async function loadExistingSmKey(): Promise<void> {
  const existingKey = await getSupermemoryKey();
  if (existingKey) {
    smKeyInput.value = existingKey;
    showSmStatus('Key loaded from storage.', 'info');
  }
}

smToggleBtn.addEventListener('click', () => {
  const isPassword = smKeyInput.type === 'password';
  smKeyInput.type = isPassword ? 'text' : 'password';
  smEyeIcon.textContent = isPassword ? '\u{1F648}' : '\u{1F441}';
  smToggleBtn.setAttribute('aria-label', isPassword ? 'Hide key' : 'Show key');
});

smSaveKeyBtn.addEventListener('click', async () => {
  const key = smKeyInput.value.trim();
  if (!key) {
    showSmStatus('Enter a key first.', 'error');
    return;
  }
  smSaveKeyBtn.disabled = true;
  try {
    await saveSupermemoryKey(key);
    smKeyInput.classList.add('saved');
    showSmStatus('Key saved \u2713', 'success');
  } catch (_err) {
    showSmStatus('Failed to save key. Try again.', 'error');
  } finally {
    smSaveKeyBtn.disabled = false;
  }
});

smClearKeyBtn.addEventListener('click', async () => {
  smClearKeyBtn.disabled = true;
  try {
    await clearSupermemoryKey();
    smKeyInput.value = '';
    smKeyInput.classList.remove('saved');
    showSmStatus('Key cleared.', 'info');
  } catch (_err) {
    showSmStatus('Failed to clear key.', 'error');
  } finally {
    smClearKeyBtn.disabled = false;
  }
});

smKeyInput.addEventListener('input', () => {
  smKeyInput.classList.remove('saved');
  smKeyStatus.textContent = '';
  smKeyStatus.className = 'key-status';
});

function showSmStatus(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
  smKeyStatus.textContent = message;
  smKeyStatus.className = `key-status ${type}`;
}

// Initialize
loadExistingKey();
loadExistingSmKey();
