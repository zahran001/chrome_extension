import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const extensionPath = path.join(__dirname, 'dist');

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false, // Extensions must run sequentially in one browser instance
  projects: [
    {
      name: 'chrome-extension',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        launchOptions: {
          args: [
            `--disable-extensions-except=${extensionPath}`,
            `--load-extension=${extensionPath}`,
          ],
          headless: false, // Required for extensions
        },
      },
    },
  ],
  reporter: [['list'], ['html', { open: 'never' }]],
});
