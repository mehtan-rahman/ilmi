// @vitest-environment jsdom
// Milestone 57, the touch side that needs no page: when a press on a page
// starts a box, and the long press that stands where right-click was. A
// touch held still and let go sends the `contextmenu` a right-click sends,
// at the place it rested; one that moves, or a mouse, sends none; while it
// rests where a menu is the page says so, for the styles that keep the
// system's own long press off; what the press focused on its way is let go.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HOLD_MS, LONG_PRESS_MS, REST_MS, boxStart, installLongPress, onGlass, pagePress } from '../touch.js';

const ptr = (type: string, pointerType: string, x: number, y: number, more: PointerEventInit = {}) =>
  new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 5, pointerType, isPrimary: true, clientX: x, clientY: y, ...more });

describe('a press on a page', () => {
  it('boxes at once under a mouse or the Pencil, after a hold under a finger', () => {
    expect(boxStart('mouse')).toBe('now');
    expect(boxStart('pen')).toBe('now');
    expect(boxStart('')).toBe('now');
    expect(boxStart('touch')).toBe('hold');
    expect(onGlass('touch') && onGlass('pen')).toBe(true);
    expect(onGlass('mouse')).toBe(false);
    expect(HOLD_MS).toBeLessThan(LONG_PRESS_MS);
  });

  it('writes under the Pencil where there is a canvas (milestone 67), and is a box\'s under anything else', () => {
    expect(pagePress('pen', true)).toBe('write');
    // no canvas (the Mac): a pen boxes as the mouse does
    expect(pagePress('pen', false)).toBe('now');
    // a finger scrolls and boxes after its hold, a mouse boxes at once, canvas or none
    expect(pagePress('touch', true)).toBe('hold');
    expect(pagePress('touch', false)).toBe('hold');
    expect(pagePress('mouse', true)).toBe('now');
    expect(pagePress('mouse', false)).toBe('now');
  });
});

describe('a long press', () => {
  let row: HTMLElement;
  let para: HTMLElement;
  let menus: { x: number; y: number; target: EventTarget | null }[];
  let undo: () => void;
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div class="side"><div class="trow" id="row">library</div></div><p id="para">prose</p>';
    row = document.getElementById('row')!;
    para = document.getElementById('para')!;
    menus = [];
    // the row has a menu, as the tree's rows do; the paragraph has none
    row.addEventListener('contextmenu', (e) => { e.preventDefault(); menus.push({ x: e.clientX, y: e.clientY, target: e.target }); });
    undo = installLongPress();
  });
  afterEach(() => {
    undo();
    vi.useRealTimers();
  });

  it('held still and let go is a right-click where it rested', () => {
    row.dispatchEvent(ptr('pointerdown', 'touch', 40, 60));
    vi.advanceTimersByTime(LONG_PRESS_MS + 20);
    expect(menus).toHaveLength(0);
    row.dispatchEvent(ptr('pointerup', 'touch', 42, 61));
    expect(menus).toEqual([{ x: 40, y: 60, target: row }]);
  });

  it('is the Pencil\'s too, and never the mouse\'s', () => {
    row.dispatchEvent(ptr('pointerdown', 'pen', 40, 60));
    vi.advanceTimersByTime(LONG_PRESS_MS + 20);
    row.dispatchEvent(ptr('pointerup', 'pen', 40, 60));
    expect(menus).toHaveLength(1);
    row.dispatchEvent(ptr('pointerdown', 'mouse', 40, 60));
    vi.advanceTimersByTime(LONG_PRESS_MS + 20);
    row.dispatchEvent(ptr('pointerup', 'mouse', 40, 60));
    expect(menus).toHaveLength(1);
  });

  it('a tap is not one, nor a touch that moved, was cancelled, or ended somewhere else', () => {
    row.dispatchEvent(ptr('pointerdown', 'touch', 40, 60));
    vi.advanceTimersByTime(120);
    row.dispatchEvent(ptr('pointerup', 'touch', 40, 60));
    // a scroll
    row.dispatchEvent(ptr('pointerdown', 'touch', 40, 60));
    vi.advanceTimersByTime(100);
    row.dispatchEvent(ptr('pointermove', 'touch', 40, 90));
    vi.advanceTimersByTime(LONG_PRESS_MS);
    row.dispatchEvent(ptr('pointerup', 'touch', 40, 90));
    // the system took the touch
    row.dispatchEvent(ptr('pointerdown', 'touch', 40, 60));
    vi.advanceTimersByTime(LONG_PRESS_MS + 20);
    row.dispatchEvent(ptr('pointercancel', 'touch', 40, 60));
    row.dispatchEvent(ptr('pointerup', 'touch', 40, 60));
    // a row's drag by the system: no moves come, only where it ended
    row.dispatchEvent(ptr('pointerdown', 'touch', 40, 60));
    vi.advanceTimersByTime(LONG_PRESS_MS + 20);
    row.dispatchEvent(ptr('pointerup', 'touch', 40, 200));
    // a second finger
    row.dispatchEvent(ptr('pointerdown', 'touch', 40, 60, { isPrimary: false }));
    vi.advanceTimersByTime(LONG_PRESS_MS + 20);
    row.dispatchEvent(ptr('pointerup', 'touch', 40, 60, { isPrimary: false }));
    expect(menus).toHaveLength(0);
  });

  it('says a touch rests where a menu is, and for a moment after', () => {
    const root = document.documentElement;
    row.dispatchEvent(ptr('pointerdown', 'touch', 40, 60));
    vi.advanceTimersByTime(REST_MS - 20);
    expect(root.hasAttribute('data-pressing')).toBe(false);
    vi.advanceTimersByTime(40);
    expect(root.dataset.pressing).toBe('1');
    // the system's selection is refused meanwhile
    const start = new Event('selectstart', { bubbles: true, cancelable: true });
    row.dispatchEvent(start);
    expect(start.defaultPrevented).toBe(true);
    vi.advanceTimersByTime(LONG_PRESS_MS);
    row.dispatchEvent(ptr('pointerup', 'touch', 40, 60));
    expect(root.dataset.pressing).toBe('1');
    vi.advanceTimersByTime(450);
    expect(root.hasAttribute('data-pressing')).toBe(false);
    // prose is the system's to select with a long press: nothing is said there
    para.dispatchEvent(ptr('pointerdown', 'touch', 10, 300));
    vi.advanceTimersByTime(LONG_PRESS_MS + 20);
    expect(root.hasAttribute('data-pressing')).toBe(false);
    const free = new Event('selectstart', { bubbles: true, cancelable: true });
    para.dispatchEvent(free);
    expect(free.defaultPrevented).toBe(false);
    para.dispatchEvent(ptr('pointerup', 'touch', 10, 300));
    expect(menus).toHaveLength(1);
  });

  it('lets go what the press focused when a menu opened, and leaves a click alone', () => {
    document.body.insertAdjacentHTML('beforeend', '<div class="dd-h" id="head" tabindex="0">a heading</div>');
    const head = document.getElementById('head')!;
    head.addEventListener('contextmenu', (e) => { e.preventDefault(); menus.push({ x: e.clientX, y: e.clientY, target: e.target }); });
    head.dispatchEvent(ptr('pointerdown', 'touch', 40, 400));
    vi.advanceTimersByTime(LONG_PRESS_MS + 20);
    // the system puts the caret where the finger rests
    head.focus();
    expect(document.activeElement).toBe(head);
    head.dispatchEvent(ptr('pointerup', 'touch', 40, 400));
    expect(menus).toHaveLength(1);
    expect(document.activeElement).not.toBe(head);
    const clicks: string[] = [];
    row.addEventListener('click', () => clicks.push('row'));
    row.click();
    expect(clicks).toEqual(['row']);
    // a field the menu's choice opens keeps its focus
    document.body.insertAdjacentHTML('beforeend', '<input id="rename">');
    document.getElementById('rename')!.focus();
    expect(document.activeElement?.id).toBe('rename');
    // what was focused before the press stays so
    vi.advanceTimersByTime(1000);
    head.focus();
    head.dispatchEvent(ptr('pointerdown', 'touch', 40, 400));
    vi.advanceTimersByTime(LONG_PRESS_MS + 20);
    head.dispatchEvent(ptr('pointerup', 'touch', 40, 400));
    expect(document.activeElement).toBe(head);
  });

  it('undone, sends nothing', () => {
    undo();
    row.dispatchEvent(ptr('pointerdown', 'touch', 40, 60));
    vi.advanceTimersByTime(LONG_PRESS_MS + 20);
    row.dispatchEvent(ptr('pointerup', 'touch', 40, 60));
    expect(menus).toHaveLength(0);
  });
});
