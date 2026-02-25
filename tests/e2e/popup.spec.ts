import { test, expect } from '../fixtures';

// Popup E2E tests navigate directly to the popup HTML served by the extension.
// The extension ID is dynamic; we retrieve it from the service worker URL.
// Fixture served via HTTP (playwright.config.ts webServer).

const fixturePath = 'http://localhost:4321/selection-page.html';

/** Get the extension ID from the context's service workers */
async function getExtensionId(context: import('@playwright/test').BrowserContext, page: import('@playwright/test').Page): Promise<string> {
  // Navigate to fixture to ensure the extension is active and SW is running
  await page.goto(fixturePath);
  await page.waitForTimeout(500);

  let workers = context.serviceWorkers();
  if (workers.length === 0) {
    await context.waitForEvent('serviceworker', { timeout: 10000 });
    workers = context.serviceWorkers();
  }
  const swUrl = workers[0].url();
  // URL format: chrome-extension://{extensionId}/...
  return swUrl.split('/')[2];
}

test.describe('Settings popup', () => {
  test('Popup page loads with API key input field', async ({ page, context }) => {
    const extensionId = await getExtensionId(context, page);
    await page.goto(`chrome-extension://${extensionId}/src/popup.html`);

    // API key input field must be present
    const apiKeyInput = page.locator('#api-key');
    await expect(apiKeyInput).toBeVisible({ timeout: 5000 });
  });

  test('Popup has Test Key and Save buttons', async ({ page, context }) => {
    const extensionId = await getExtensionId(context, page);
    await page.goto(`chrome-extension://${extensionId}/src/popup.html`);

    await expect(page.locator('#test-key')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#save-key')).toBeVisible({ timeout: 5000 });
  });

  test('Eye icon toggles key visibility (password to text type)', async ({ page, context }) => {
    const extensionId = await getExtensionId(context, page);
    await page.goto(`chrome-extension://${extensionId}/src/popup.html`);

    // Input starts as password type
    const inputType = await page.getAttribute('#api-key', 'type');
    expect(inputType).toBe('password');

    // Click the toggle-visibility button
    await page.click('#toggle-visibility');

    // Input should now be text type (key visible)
    const inputTypeAfter = await page.getAttribute('#api-key', 'type');
    expect(inputTypeAfter).toBe('text');
  });

  test('Popup displays title "Rubber-Band AI"', async ({ page, context }) => {
    const extensionId = await getExtensionId(context, page);
    await page.goto(`chrome-extension://${extensionId}/src/popup.html`);

    const heading = page.locator('h1');
    await expect(heading).toHaveText('Rubber-Band AI', { timeout: 5000 });
  });

  test.fixme(
    'Test key button shows "Key valid" for valid key',
    // Requires a real Gemini API key — test.fixme when no key available.
    // Manual verification: enter key in popup → click Test Key → see "Key valid ✓"
    async () => {}
  );

  test.fixme(
    'Save button turns field green + shows "Key saved" message',
    // Requires API key interaction — test.fixme when no key available.
    // Manual verification: enter key → click Save → field turns green + "Key saved ✓"
    async () => {}
  );
});
