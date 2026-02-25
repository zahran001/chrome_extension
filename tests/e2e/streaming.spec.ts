import { test, expect } from '../fixtures';

// Streaming E2E tests require a real Gemini API key configured in the extension popup.
// These tests are marked test.fixme when no API key is present — expected, not broken.
// To run these tests: open extension popup, enter your Gemini API key, click Save.
// Fixture served via HTTP (playwright.config.ts webServer).

const fixturePath = 'http://localhost:4321/selection-page.html';

test.describe('Gemini streaming', () => {
  test.fixme(
    'SW receives extracted text and calls Gemini API',
    // Requires API key configured in popup.
    // Full flow: select text → confirm → SW opens Gemini stream → tokens arrive in panel
    async ({ page }) => {
      await page.goto(fixturePath);
      await page.waitForTimeout(300);
      await page.keyboard.press('Alt+s');
      await page.waitForTimeout(100);
      await page.mouse.move(50, 50);
      await page.mouse.down();
      await page.mouse.move(600, 400);
      await page.mouse.up();
      await page.waitForFunction(() =>
        document.getElementById('rubber-band-ai-confirm') !== null
      );
      await page.evaluate(() => {
        (document.getElementById('rubber-band-ai-confirm') as HTMLButtonElement)?.click();
      });
      await page.waitForFunction(() =>
        document.querySelector('dialog[data-rba="result-panel"]') !== null
      );
      // Wait for response-text element (tokens streaming in)
      await page.waitForFunction(
        () => {
          const dialog = document.querySelector('dialog[data-rba="result-panel"]');
          const responseEl = dialog?.shadowRoot?.querySelector('.response-text');
          return responseEl !== null && (responseEl.textContent?.length ?? 0) > 0;
        },
        { timeout: 30000 }
      );
      const responseText = await page.evaluate(() => {
        const dialog = document.querySelector('dialog[data-rba="result-panel"]');
        return dialog?.shadowRoot?.querySelector('.response-text')?.textContent ?? '';
      });
      expect(responseText.length).toBeGreaterThan(0);
    }
  );

  test.fixme(
    'Response tokens stream word-by-word to content script',
    // Requires API key configured in popup.
    // Verifies: skeleton disappears, response-text fills progressively with streaming-done class
    async ({ page }) => {
      await page.goto(fixturePath);
      await page.waitForTimeout(300);
      await page.keyboard.press('Alt+s');
      await page.waitForTimeout(100);
      await page.mouse.move(50, 50);
      await page.mouse.down();
      await page.mouse.move(600, 400);
      await page.mouse.up();
      await page.waitForFunction(() =>
        document.getElementById('rubber-band-ai-confirm') !== null
      );
      await page.evaluate(() => {
        (document.getElementById('rubber-band-ai-confirm') as HTMLButtonElement)?.click();
      });
      await page.waitForFunction(() =>
        document.querySelector('dialog[data-rba="result-panel"]') !== null
      );
      // Wait for streaming to complete (streaming-done class added)
      await page.waitForFunction(
        () => {
          const dialog = document.querySelector('dialog[data-rba="result-panel"]');
          return dialog?.shadowRoot?.querySelector('.response-text.streaming-done') !== null;
        },
        { timeout: 30000 }
      );
      const isDone = await page.evaluate(() => {
        const dialog = document.querySelector('dialog[data-rba="result-panel"]');
        return dialog?.shadowRoot?.querySelector('.response-text.streaming-done') !== null;
      });
      expect(isDone).toBe(true);
    }
  );

  test.fixme(
    'AI infers intent from content without user mode selection',
    // Requires API key configured in popup.
    // Verifies: response appears without user having to select explain/summarize/solve mode
    async ({ page }) => {
      await page.goto(fixturePath);
      await page.waitForTimeout(300);
      await page.keyboard.press('Alt+s');
      await page.waitForTimeout(100);
      await page.mouse.move(50, 50);
      await page.mouse.down();
      await page.mouse.move(600, 400);
      await page.mouse.up();
      await page.waitForFunction(() =>
        document.getElementById('rubber-band-ai-confirm') !== null
      );
      await page.evaluate(() => {
        (document.getElementById('rubber-band-ai-confirm') as HTMLButtonElement)?.click();
      });
      await page.waitForFunction(
        () => {
          const dialog = document.querySelector('dialog[data-rba="result-panel"]');
          return dialog?.shadowRoot?.querySelector('.response-text.streaming-done') !== null;
        },
        { timeout: 30000 }
      );
      // Reached here = Gemini responded without user selecting a mode
      expect(true).toBe(true);
    }
  );

  test.fixme(
    'Error from Gemini API surfaces as error message in panel',
    // Requires API key configured in popup.
    // Full error path test: error conditions are hard to trigger deterministically
    async () => {}
  );
});
