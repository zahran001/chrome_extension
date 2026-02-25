/**
 * Playwright fixture that provides a persistent browser context with the
 * Chrome extension loaded. Chrome MV3 extensions (service workers, content
 * script injection) only work in a persistent context — launchPersistentContext,
 * not a regular launch with launchOptions.
 *
 * Usage in spec files:
 *   import { test, expect } from '../fixtures';
 */
import { test as base, chromium, BrowserContext } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extensionPath = path.join(__dirname, '..', 'dist');

export { expect } from '@playwright/test';

// One persistent context shared across all tests (workers: 1 in playwright.config.ts
// ensures only one worker runs, so module-level state is safe).
let _sharedContext: BrowserContext | null = null;
let _userDataDir: string | null = null;

async function getSharedContext(): Promise<BrowserContext> {
  if (!_sharedContext) {
    _userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rba-pw-'));
    _sharedContext = await chromium.launchPersistentContext(_userDataDir, {
      headless: false,
      executablePath: chromium.executablePath(),
      ignoreDefaultArgs: ['--disable-extensions'],
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });
    // Cleanup on process exit
    process.once('exit', () => {
      if (_userDataDir) fs.rmSync(_userDataDir, { recursive: true, force: true });
    });
  }
  return _sharedContext;
}

export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  // Override context: always the persistent extension context.
  context: async ({}, use) => {
    const ctx = await getSharedContext();
    await use(ctx);
    // Don't close — reuse across tests. Process exit handles cleanup.
  },

  // Override page: new tab from the shared context, closed after each test.
  page: async ({}, use) => {
    const ctx = await getSharedContext();
    const page = await ctx.newPage();
    await use(page);
    await page.close();
  },

  // Extension ID derived from SW URL — stable for the lifetime of the context.
  extensionId: async ({}, use) => {
    const ctx = await getSharedContext();
    let workers = ctx.serviceWorkers();
    if (workers.length === 0) {
      await ctx.waitForEvent('serviceworker', { timeout: 15000 });
      workers = ctx.serviceWorkers();
    }
    // SW URL: chrome-extension://{extensionId}/service-worker-loader.js
    const id = workers[0].url().split('/')[2];
    await use(id);
  },
});
