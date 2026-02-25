import { test } from '@playwright/test';

test.describe('Gemini streaming', () => {
  test.todo('SW receives extracted text and calls Gemini API');
  test.todo('Response tokens stream word-by-word to content script');
  test.todo('AI infers intent from content without user mode selection');
  test.todo('Error from Gemini API surfaces as error message in panel');
});
