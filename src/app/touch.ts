// Under a finger or the Pencil (milestone 57). What the mouse had and a
// touch does not, said once here:
//
//  · a drag on a book's page boxes a passage. The mouse's drag does so at
//    once. A finger's plain drag is the scroll, as it is everywhere on an
//    iPad, so a finger boxes after a short hold (`HOLD_MS`); `boxStart`
//    says which, `Pdf.tsx` draws.
//  · the Pencil writes on a book's page (milestone 67): where there is a
//    canvas its touch opens it over that page (`pagePress`, `ink.ts`). 57
//    had it box at once, as a pen still does where there is no canvas.
//  · a right-click opens a row's, a heading's or a card's menu. A touch
//    held still for `LONG_PRESS_MS` and let go is that right-click: the
//    same `contextmenu` event at the same place, so every menu there was
//    is there (`installLongPress`).
//
// A row's drag needs nothing here: the web view on an iPad lifts a
// `draggable` row after a long press and sends the same drag events the
// Mac's does (`drag.ts`), so a row held and then moved is dragged, and one
// held and let go where it was gets its menu.

/** How long a finger rests on a page before its drag draws a box. */
export const HOLD_MS = 320;
/** How long a touch rests before it is a long press. */
export const LONG_PRESS_MS = 480;
/** How far a touch may wander and still be resting, px. */
export const SLOP = 10;
/** How long a touch rests where a menu is before the system's own long press (a word selected, its callout) is kept off. */
export const REST_MS = 200;
/** How long after such a press is let go that stays so: the system's press may fire late. */
const UNPRESS_MS = 400;

/** Where right-click was: on these a long press is the menu's, not the system's to select text with. */
export const MENUS = '.side, .tab-rail, .folder-view, .deck-row, .dd-h';

/** When a press on a page starts a box: at once under a mouse (or a pen that does not write), after a hold under a finger. */
export function boxStart(pointerType: string): 'now' | 'hold' {
  return pointerType === 'touch' ? 'hold' : 'now';
}

/** What a press on a book's page begins: writing under the Pencil where there is a canvas to write on (an iPad); else a box, at once or after a hold (`boxStart`). */
export function pagePress(pointerType: string, canvas: boolean): 'write' | 'now' | 'hold' {
  return pointerType === 'pen' && canvas ? 'write' : boxStart(pointerType);
}

/** Whether a pointer is a touch on the glass (a finger or the Pencil), not a mouse. */
export const onGlass = (pointerType: string): boolean => pointerType === 'touch' || pointerType === 'pen';

interface Press {
  id: number;
  target: Element;
  x: number;
  y: number;
  timer: ReturnType<typeof setTimeout> | null;
  rest: ReturnType<typeof setTimeout> | null;
  /** The touch rested long enough: letting go where it is, is the right-click. */
  held: boolean;
}

/**
 * A touch held still and let go is a right-click where it rests: a
 * `contextmenu` event at that point, on what was pressed. A touch that
 * moves is the scroll, or the system's drag of a row, and nothing here.
 * While a touch rests where a menu is (`MENUS`) the page carries
 * `data-pressing`, by which the styles keep the system from selecting
 * text under it; when a menu took the event, what the press selected or
 * focused on its way is let go (the web view sends no click after a long
 * press, so none is waited for). Returns the undoing.
 */
export function installLongPress(doc: Document = document): () => void {
  const root = doc.documentElement;
  let press: Press | null = null;
  let unpress: ReturnType<typeof setTimeout> | null = null;
  /** Until when a selection or a focus is the long press's own doing. */
  let quiet = 0;
  const clear = () => {
    const p = press;
    press = null;
    if (!p) return;
    if (p.timer) clearTimeout(p.timer);
    if (p.rest) clearTimeout(p.rest);
    if (root.hasAttribute('data-pressing')) {
      if (unpress) clearTimeout(unpress);
      unpress = setTimeout(() => { unpress = null; if (!press) root.removeAttribute('data-pressing'); }, UNPRESS_MS);
    }
  };
  const down = (e: PointerEvent) => {
    clear();
    if (!onGlass(e.pointerType) || !e.isPrimary || !(e.target instanceof Element)) return;
    focused = doc.activeElement;
    const p: Press = { id: e.pointerId, target: e.target, x: e.clientX, y: e.clientY, timer: null, rest: null, held: false };
    p.timer = setTimeout(() => { p.timer = null; p.held = true; }, LONG_PRESS_MS);
    if (e.target.closest(MENUS)) p.rest = setTimeout(() => { p.rest = null; root.setAttribute('data-pressing', '1'); }, REST_MS);
    press = p;
  };
  const move = (e: PointerEvent) => {
    const p = press;
    if (p && e.pointerId === p.id && Math.hypot(e.clientX - p.x, e.clientY - p.y) > SLOP) clear();
  };
  const up = (e: PointerEvent) => {
    const p = press;
    if (!p || e.pointerId !== p.id) return;
    clear();
    // let go where it rested (a system drag that moved sends no moves here, only where it ended)
    if (!p.held || !p.target.isConnected || Math.hypot(e.clientX - p.x, e.clientY - p.y) > SLOP) return;
    const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: p.x, clientY: p.y });
    if (p.target.dispatchEvent(menu)) return;
    // a menu opened: the press is spent
    quiet = Date.now() + 700;
    pressed = p.target;
    doc.defaultView?.getSelection()?.removeAllRanges();
    unfocus();
  };
  const cancel = (e: PointerEvent) => { if (press && e.pointerId === press.id) clear(); };
  // the press may also have put the caret in a page that was not being typed in, and brought the
  // keyboard up under the menu: what it focused is let go
  let focused: Element | null = null;
  let pressed: Element | null = null;
  const unfocus = () => {
    const now = doc.activeElement;
    // only the page the press was on: a field the menu's own choice opens is not the press's doing
    if (now && now !== focused && now !== doc.body && Date.now() <= quiet && pressed && now.contains(pressed)) (now as HTMLElement).blur?.();
  };
  // the system's long press selects a word where the text is editable, whatever the styles say:
  // it is refused while a touch rests where a menu is, and undone for a moment after the menu opens
  const zoned = (): boolean => root.hasAttribute('data-pressing');
  const selectStart = (e: Event) => { if (zoned() || Date.now() <= quiet) e.preventDefault(); };
  const selection = () => {
    if (!zoned() && Date.now() > quiet) return;
    // a field's own selection (a rename begun from the menu) is not the press's
    if (/^(input|textarea)$/i.test(doc.activeElement?.tagName ?? '')) return;
    const sel = doc.defaultView?.getSelection();
    if (sel && !sel.isCollapsed) sel.removeAllRanges();
  };
  doc.addEventListener('pointerdown', down, true);
  doc.addEventListener('pointermove', move, true);
  doc.addEventListener('pointerup', up, true);
  doc.addEventListener('pointercancel', cancel, true);
  doc.addEventListener('selectstart', selectStart, true);
  doc.addEventListener('selectionchange', selection);
  doc.addEventListener('focusin', unfocus, true);
  return () => {
    clear();
    if (unpress) clearTimeout(unpress);
    root.removeAttribute('data-pressing');
    doc.removeEventListener('pointerdown', down, true);
    doc.removeEventListener('pointermove', move, true);
    doc.removeEventListener('pointerup', up, true);
    doc.removeEventListener('pointercancel', cancel, true);
    doc.removeEventListener('selectstart', selectStart, true);
    doc.removeEventListener('selectionchange', selection);
    doc.removeEventListener('focusin', unfocus, true);
  };
}
