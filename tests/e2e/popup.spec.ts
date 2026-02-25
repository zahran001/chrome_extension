import { test } from '@playwright/test';

test.describe('Settings popup', () => {
  test.todo('User can enter API key in masked input field');
  test.todo('Eye icon toggles key visibility (password <-> text type)');
  test.todo('Test key button shows "Key valid ✓" for valid key');
  test.todo('Test key button shows specific error for invalid key');
  test.todo('Save button turns field green + shows "Key saved" message');
});
