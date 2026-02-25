import { test, expect } from '@playwright/test';

test.describe('Selection UI', () => {
  test.todo('Alt+S activates selection mode (cursor becomes crosshair)');
  test.todo('Dragging creates rubber-band rectangle with marching ants border');
  test.todo('Scrolling is disabled during drag');
  test.todo('Releasing mouse shows confirm button at bottom-right of selection');
  test.todo('Escape key cancels mid-drag (rubber-band disappears)');
  test.todo('Escape key cancels after release but before confirm');
  test.todo('Page is fully interactive after cancel (pointer-events restored)');
});
