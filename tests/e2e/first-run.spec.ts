import { test, expect } from '../fixtures';

// First-run flow tests: behavior when no API key is configured.
// The extension should still allow selection, and show a panel on confirm.
// Fixture served via HTTP (playwright.config.ts webServer).

const fixturePath = 'http://localhost:4321/selection-page.html';

test.describe('First-run flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(fixturePath);
    // Wait for content script to inject and initialize
    await page.waitForTimeout(300);
    // Reset DOM state
    await page.evaluate(() => {
      document.documentElement.style.cursor = '';
      document.body.style.overflow = '';
      document.getElementById('rubber-band-ai-overlay')?.remove();
      document.getElementById('rubber-band-ai-confirm')?.remove();
      document.querySelector('dialog[data-rba="result-panel"]')?.remove();
    });
  });

  test('Alt+S with no API key — selection mode still activates normally', async ({ page }) => {
    // Selection mode should activate regardless of whether API key is stored
    await page.keyboard.press('Alt+s');
    const cursor = await page.evaluate(() => document.documentElement.style.cursor);
    expect(cursor).toBe('crosshair');
  });

  test('Confirming selection with no key shows panel (setup or loading mode)', async ({ page }) => {
    // Trigger full selection flow — panel should appear regardless of key presence
    await page.keyboard.press('Alt+s');
    await page.waitForTimeout(100);
    await page.mouse.move(50, 50);
    await page.mouse.down();
    await page.mouse.move(500, 350);
    await page.mouse.up();

    // Wait for confirm button
    await page.waitForFunction(
      () => document.getElementById('rubber-band-ai-confirm') !== null
    );

    // Click confirm
    await page.evaluate(() => {
      (document.getElementById('rubber-band-ai-confirm') as HTMLButtonElement)?.click();
    });

    // Panel must appear regardless of API key state
    await page.waitForFunction(
      () => document.querySelector('dialog[data-rba="result-panel"]') !== null
    );

    const panelExists = await page.evaluate(() =>
      document.querySelector('dialog[data-rba="result-panel"]') !== null
    );
    expect(panelExists).toBe(true);
  });

  test('Panel body contains expected content based on API key state', async ({ page }) => {
    // With no API key: panel shows setup prompt with "Open Settings"
    // With API key: panel shows loading skeleton then streams
    // Either way, panel body must appear in Shadow DOM.
    await page.keyboard.press('Alt+s');
    await page.waitForTimeout(100);
    await page.mouse.move(50, 50);
    await page.mouse.down();
    await page.mouse.move(500, 350);
    await page.mouse.up();

    await page.waitForFunction(
      () => document.getElementById('rubber-band-ai-confirm') !== null
    );
    await page.evaluate(() => {
      (document.getElementById('rubber-band-ai-confirm') as HTMLButtonElement)?.click();
    });

    await page.waitForFunction(
      () => document.querySelector('dialog[data-rba="result-panel"]') !== null
    );

    // Check for either setup-btn (no key) or skeleton-container (has key) or panel-body.
    // Shadow root is on the inner div host (dialog itself doesn't support attachShadow).
    const hasExpectedContent = await page.evaluate(() => {
      const dialog = document.querySelector('dialog[data-rba="result-panel"]');
      const shadow = dialog?.firstElementChild?.shadowRoot;
      if (!shadow) return false;
      const hasSetup = shadow.querySelector('.setup-btn') !== null;
      const hasSkeleton = shadow.querySelector('.skeleton-container') !== null;
      const hasBody = shadow.querySelector('.panel-body') !== null;
      return hasSetup || hasSkeleton || hasBody;
    });
    expect(hasExpectedContent).toBe(true);
  });
});
