import { test } from '@playwright/test';

test.describe('Result panel', () => {
  test.todo('Panel renders as Top Layer dialog with Shadow DOM on static page');
  test.todo('Loading skeleton appears within 500ms of selection confirmation');
  test.todo('Response streams word-by-word with blinking cursor');
  test.todo('Copy button copies full response to clipboard');
  test.todo('Escape key dismisses panel');
  test.todo('Close button (X) dismisses panel');
  test.todo('Retry input field appears below response; submits with Enter');
  test.todo('Error: invalid API key shows actionable message with Open Settings button');
  test.todo('Error: rate limited shows actionable message');
  test.todo('Error: network error shows actionable message');
  test.todo('Mid-stream connection failure preserves partial response + error notice');
});
