import { defineConfig } from '@playwright/test';

// Chrome MV3 extensions require a persistent browser context (launchPersistentContext).
// The context + extension loading is handled by tests/fixtures.ts, which all spec files
// import instead of '@playwright/test'. No launchOptions needed here.
//
// workers: 1 — required because we share one Chrome extension context across all tests.
// Multiple workers would each try to launch their own Chrome instance pointing at the
// same dist/ directory, causing extension ID collisions and flaky test ordering.

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,

  // Serve test fixtures over HTTP so Chrome extension content scripts can inject.
  // Chrome MV3 extensions cannot inject content scripts into file:// pages without
  // the user explicitly enabling "Allow access to file URLs" in chrome://extensions.
  // HTTP pages match <all_urls> automatically without any extra user configuration.
  webServer: {
    command: 'node tests/serve-fixtures.mjs',
    url: 'http://localhost:4321/',
    reuseExistingServer: !process.env.CI,
    timeout: 10_000,
  },

  use: {
    baseURL: 'http://localhost:4321',
  },

  projects: [
    {
      name: 'chrome-extension',
    },
  ],
  reporter: [['list'], ['html', { open: 'never' }]],
});
