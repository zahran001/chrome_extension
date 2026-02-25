import { test, expect } from '../fixtures';

// Fixture served via HTTP (playwright.config.ts webServer).
// Panel tests verify the dialog element created by the content script.

const fixturePath = 'http://localhost:4321/selection-page.html';

/** Helper: trigger full selection flow and click confirm button, wait for panel */
async function triggerPanelFlow(page: import('@playwright/test').Page): Promise<void> {
  // Content script initializes on page load; wait briefly for it to set up
  await page.waitForTimeout(300);

  await page.keyboard.press('Alt+s');

  // Small delay to let activateSelectionMode() run and set up drag listeners
  await page.waitForTimeout(100);

  await page.mouse.move(50, 50);
  await page.mouse.down();
  await page.mouse.move(400, 300);
  await page.mouse.up();

  // Wait for confirm button to appear (endDrag() renders it)
  await page.waitForFunction(
    () => document.getElementById('rubber-band-ai-confirm') !== null
  );

  // Click confirm button
  await page.evaluate(() => {
    (document.getElementById('rubber-band-ai-confirm') as HTMLButtonElement)?.click();
  });

  // Wait for dialog to appear (showPanel() creates it)
  await page.waitForFunction(
    () => document.querySelector('dialog[data-rba="result-panel"]') !== null
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto(fixturePath);
  // DOM state reset between tests (prevents state bleed from failed tests)
  await page.evaluate(() => {
    document.documentElement.style.cursor = '';
    document.body.style.overflow = '';
    document.body.style.userSelect = '';
    document.getElementById('rubber-band-ai-overlay')?.remove();
    document.getElementById('rubber-band-ai-confirm')?.remove();
    document.querySelector('dialog[data-rba="result-panel"]')?.remove();
  });
});

test('Panel renders as Top Layer dialog with Shadow DOM on confirm', async ({ page }) => {
  await triggerPanelFlow(page);

  const dialogExists = await page.evaluate(() =>
    document.querySelector('dialog[data-rba="result-panel"]') !== null
  );
  expect(dialogExists).toBe(true);

  // Verify Shadow DOM is attached (PNL-01 — Shadow DOM isolation)
  const hasShadowRoot = await page.evaluate(() => {
    const dialog = document.querySelector('dialog[data-rba="result-panel"]');
    return dialog !== null && dialog.shadowRoot !== null;
  });
  expect(hasShadowRoot).toBe(true);
});

test('Panel header contains title "Rubber-Band AI"', async ({ page }) => {
  await triggerPanelFlow(page);

  const titleText = await page.evaluate(() => {
    const dialog = document.querySelector('dialog[data-rba="result-panel"]');
    return dialog?.shadowRoot?.querySelector('.panel-title')?.textContent;
  });
  expect(titleText).toBe('Rubber-Band AI');
});

test('Close button (X) dismisses panel', async ({ page }) => {
  await triggerPanelFlow(page);

  // Click close button inside Shadow DOM
  await page.evaluate(() => {
    const dialog = document.querySelector('dialog[data-rba="result-panel"]');
    const closeBtn = dialog?.shadowRoot?.querySelector('.close-btn') as HTMLButtonElement | null;
    closeBtn?.click();
  });

  // Panel should be removed from DOM
  await page.waitForFunction(
    () => document.querySelector('dialog[data-rba="result-panel"]') === null
  );
  const dialogGone = await page.evaluate(() =>
    document.querySelector('dialog[data-rba="result-panel"]') === null
  );
  expect(dialogGone).toBe(true);
});

test('Escape key dismisses panel', async ({ page }) => {
  await triggerPanelFlow(page);

  // Escape dismisses panel (PNL-05 — keyboard accessible dismiss)
  await page.keyboard.press('Escape');

  await page.waitForFunction(
    () => document.querySelector('dialog[data-rba="result-panel"]') === null
  );
  const dialogGone = await page.evaluate(() =>
    document.querySelector('dialog[data-rba="result-panel"]') === null
  );
  expect(dialogGone).toBe(true);
});

test('Panel body appears with content (skeleton or setup based on API key state)', async ({ page }) => {
  await triggerPanelFlow(page);

  // Panel body must exist in Shadow DOM regardless of mode (loading or setup)
  const hasBody = await page.evaluate(() => {
    const dialog = document.querySelector('dialog[data-rba="result-panel"]');
    return dialog?.shadowRoot?.querySelector('.panel-body') !== null;
  });
  expect(hasBody).toBe(true);
});
