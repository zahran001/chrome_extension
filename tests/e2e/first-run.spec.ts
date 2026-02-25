import { test } from '@playwright/test';

test.describe('First-run flow', () => {
  test.todo('Alt+S with no API key: selection mode still activates normally');
  test.todo('Confirming selection with no key shows setup prompt in panel');
  test.todo('Setup prompt has "Open Settings" button that opens popup');
});
