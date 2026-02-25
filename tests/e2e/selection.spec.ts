import { test, expect } from '../fixtures';

// Fixture served via HTTP (playwright.config.ts webServer).
// Chrome extensions inject content scripts on http:// pages automatically
// via <all_urls> match in the manifest — no extra user configuration needed.

const fixturePath = 'http://localhost:4321/selection-page.html';

test.beforeEach(async ({ page }) => {
  await page.goto(fixturePath);
  // Wait for content script to inject and initialize
  await page.waitForTimeout(300);
  // Reset any DOM state left by a previous failed test (belt-and-suspenders cleanup)
  await page.evaluate(() => {
    document.documentElement.style.cursor = '';
    document.body.style.overflow = '';
    document.body.style.userSelect = '';
    document.getElementById('rubber-band-ai-overlay')?.remove();
    document.getElementById('rubber-band-ai-confirm')?.remove();
    document.querySelector('dialog[data-rba="result-panel"]')?.remove();
  });
});

test('Alt+S activates selection mode — cursor becomes crosshair', async ({ page }) => {
  await page.keyboard.press('Alt+s');
  const cursor = await page.evaluate(() => document.documentElement.style.cursor);
  expect(cursor).toBe('crosshair');
});

test('Dragging creates rubber-band SVG overlay', async ({ page }) => {
  await page.keyboard.press('Alt+s');
  await page.waitForTimeout(100);
  await page.mouse.move(100, 100);
  await page.mouse.down();
  await page.mouse.move(300, 250);
  const svgExists = await page.evaluate(() =>
    document.getElementById('rubber-band-ai-overlay') !== null
  );
  expect(svgExists).toBe(true);
  await page.mouse.up();
});

test('Scrolling is disabled during drag', async ({ page }) => {
  await page.keyboard.press('Alt+s');
  await page.waitForTimeout(100);
  await page.mouse.move(100, 100);
  await page.mouse.down();
  await page.mouse.move(300, 250);
  const overflow = await page.evaluate(() => document.body.style.overflow);
  expect(overflow).toBe('hidden');
  await page.mouse.up();
});

test('Releasing mouse shows confirm button at bottom-right', async ({ page }) => {
  await page.keyboard.press('Alt+s');
  await page.waitForTimeout(100);
  await page.mouse.move(100, 100);
  await page.mouse.down();
  await page.mouse.move(300, 250);
  await page.mouse.up();
  // Wait for confirm button to render
  await page.waitForFunction(
    () => document.getElementById('rubber-band-ai-confirm') !== null
  );
  const confirmBtn = await page.evaluate(() =>
    document.getElementById('rubber-band-ai-confirm') !== null
  );
  expect(confirmBtn).toBe(true);
});

test('Escape mid-drag cancels selection — SVG overlay removed', async ({ page }) => {
  await page.keyboard.press('Alt+s');
  await page.waitForTimeout(100);
  await page.mouse.move(100, 100);
  await page.mouse.down();
  await page.mouse.move(300, 250);
  await page.keyboard.press('Escape');
  const svgGone = await page.evaluate(() =>
    document.getElementById('rubber-band-ai-overlay') === null
  );
  expect(svgGone).toBe(true);
});

test('Page fully interactive after Escape cancel — pointer-events restored', async ({ page }) => {
  await page.keyboard.press('Alt+s');
  await page.waitForTimeout(100);
  await page.mouse.move(100, 100);
  await page.mouse.down();
  await page.mouse.move(300, 250);
  await page.keyboard.press('Escape');
  const overflow = await page.evaluate(() => document.body.style.overflow);
  const cursor = await page.evaluate(() => document.documentElement.style.cursor);
  expect(overflow).toBe('');
  expect(cursor).toBe('');
});

test('Escape before drag cancels selection mode — cursor restored', async ({ page }) => {
  await page.keyboard.press('Alt+s');
  // Cursor becomes crosshair when selection mode activates
  const cursorActive = await page.evaluate(() => document.documentElement.style.cursor);
  expect(cursorActive).toBe('crosshair');
  // Escape without dragging cancels selection mode
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  const cursorAfter = await page.evaluate(() => document.documentElement.style.cursor);
  expect(cursorAfter).toBe('');
});
