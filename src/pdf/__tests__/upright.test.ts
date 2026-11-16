import { describe, expect, it } from 'vitest';
import { uprightItems } from '../text.js';

describe('text items read where the page shows them', () => {
  const item = { str: 'a', transform: [10, 0, 0, 10, 100, 700], height: 10 };
  it('a plain page is left as it is', () => {
    const items = [item];
    expect(uprightItems(items, [1, 0, 0, -1, 0, 792], 792)).toBe(items);
  });
  it('a page turned a quarter: the item lands where the turned page shows it', () => {
    // 612 × 792 turned 90°: the view is 792 × 612, a point (x, y) shown at (y, x)
    const [out] = uprightItems([item], [0, 1, 1, 0, 0, 0], 612);
    expect(out!.transform[4]).toBe(700);
    expect(out!.transform[5]).toBe(612 - 100);
    expect(out!.str).toBe('a');
  });
  it('a crop box that does not start at 0 moves the item with it', () => {
    const [out] = uprightItems([item], [1, 0, 0, -1, -50, 842], 792);
    expect(out!.transform[4]).toBe(50);
    expect(out!.transform[5]).toBe(792 - (842 - 700));
  });
});
