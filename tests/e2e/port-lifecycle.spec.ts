import { test, expect } from '../fixtures';

// Fixture served via HTTP (playwright.config.ts webServer).
// Port lifecycle tests verify the service worker registers and accepts connections.

const fixturePath = 'http://localhost:4321/selection-page.html';

test('SW registers on extension load', async ({ context }) => {
  // Service worker should be registered when the extension loads.
  // Wait up to 10s for it to appear (SW may still be installing when test starts).
  let workers = context.serviceWorkers();
  if (workers.length === 0) {
    await context.waitForEvent('serviceworker', { timeout: 10000 });
    workers = context.serviceWorkers();
  }
  expect(workers.length).toBeGreaterThan(0);
});

test('SW wakes up when a tab with the extension navigates', async ({ page, context }) => {
  await page.goto(fixturePath);
  // Give SW time to wake up after page navigation
  await page.waitForTimeout(500);
  const workers = context.serviceWorkers();
  expect(workers.length).toBeGreaterThan(0);
});

test('Content script activates on Alt+S — proves SW/CS injection works', async ({ page }) => {
  // The content script is injected on HTTP pages automatically.
  // Alt+S triggers activateSelectionMode() via the direct keydown listener.
  // If cursor becomes crosshair, content script injected and ran successfully.
  await page.goto(fixturePath);
  await page.waitForTimeout(300);
  await page.keyboard.press('Alt+s');
  const cursor = await page.evaluate(() => document.documentElement.style.cursor);
  expect(cursor).toBe('crosshair');
});

test('Port connection: full flow opens llm-stream port and panel appears', async ({ page }) => {
  // The content script opens an llm-stream port internally when confirm is clicked.
  // Panel appearing = port was opened + SW responded to check-api-key message.
  await page.goto(fixturePath);
  await page.waitForTimeout(300);

  await page.keyboard.press('Alt+s');
  await page.waitForTimeout(100);
  await page.mouse.move(50, 50);
  await page.mouse.down();
  await page.mouse.move(400, 300);
  await page.mouse.up();

  await page.waitForFunction(
    () => document.getElementById('rubber-band-ai-confirm') !== null
  );
  await page.evaluate(() => {
    (document.getElementById('rubber-band-ai-confirm') as HTMLButtonElement)?.click();
  });

  // Panel appears — proves check-api-key message was sent and SW responded
  await page.waitForFunction(
    () => document.querySelector('dialog[data-rba="result-panel"]') !== null
  );
  const panelExists = await page.evaluate(
    () => document.querySelector('dialog[data-rba="result-panel"]') !== null
  );
  expect(panelExists).toBe(true);
});
