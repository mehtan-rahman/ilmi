// Typing through an input method (Japanese, Chinese, Korean, a dead key's
// accent): while a word is being composed its keys are the input method's.
// The ⏎ that takes a candidate is not the ⏎ that commits a rename, runs the
// palette's row or saves a card; esc that drops the candidates is not the
// esc that closes the field. A keydown of a composition is stopped at the
// window, before any handler of the app's sees it; the web view's own
// handling of it (the composition itself) is untouched.

/** Whether a keydown belongs to a composition: said so by the event, or by WebKit's key code for the ⏎ that ends one (229, sent after `compositionend`). */
export const composingKey = (e: KeyboardEvent): boolean => e.isComposing || e.keyCode === 229;

/** Keep a composition's keys from the app's handlers. Returns the undoing. */
export function installComposing(win: Window = window): () => void {
  const stop = (e: KeyboardEvent) => { if (composingKey(e)) e.stopPropagation(); };
  win.addEventListener('keydown', stop, true);
  win.addEventListener('keyup', stop, true);
  return () => {
    win.removeEventListener('keydown', stop, true);
    win.removeEventListener('keyup', stop, true);
  };
}
