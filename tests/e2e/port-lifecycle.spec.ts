import { test } from '@playwright/test';

test.describe('Service worker port lifecycle', () => {
  test.todo('SW wakes up on first port connection message');
  test.todo('Port stays open during streaming (SW not killed mid-response)');
  test.todo('port.onDisconnect fires when SW is killed mid-stream');
  test.todo('Content script shows "Stream interrupted" error on SW kill');
});
