// The phone as a remote (milestone 90): what a phone shows while a Mac's
// session is studied. It is the buttons the session shows on the Mac, as the
// Mac sends them (`app/remote.ts`), drawn large for a thumb: one button fills
// the glass (reveal, next, got it, enter queue); four grades are a square of
// four; reading's three are three rows. A press is sent with the version of
// what was shown, so a second tap meant for the card gone by grades nothing.
//
// `mountRemote` and `browserTransport` are each written to stand alone (no
// import, nothing of the module's but types): the Mac hands the phone's
// browser a page made of their own source (`remotePage`), and ilmi's phone
// app runs the same `mountRemote` over its own transport (`app/remoteClient.ts`).

/** One button the session shows. */
export interface RemoteButton {
  /** What the Mac knows it by: `g1`–`g4` for the grades, else the button's own act (`reveal`, `on`, `postpone`, …). */
  id: string;
  label: string;
  /** The line under it: a grade's next interval. */
  sub?: string;
  /** The Mac's key for it, as written on the Mac's button. */
  key?: string;
  /** The grade given already, when the card is come back to. */
  on?: boolean;
  /** Shown and not pressable (‹ at the first element). */
  off?: boolean;
}

/** What the phone shows, as the Mac sends it. Last of all, when the remote is stopped, the stream sends `{ "stopped": true }`. */
export interface RemoteView {
  /** Counts up with every change; a press names the one it was made on. */
  v: number;
  /** What is studied: the element's source. */
  title: string;
  /** `3 / 20`, or empty. */
  count: string;
  /** The element's kind (`card`, `read`, `write`, `section`), or `none` outside a session. */
  kind: string;
  /** A line in place of buttons, or beside them: `all done …`, `not in a session`. */
  note: string;
  main: RemoteButton[];
  /** ‹ and ›. */
  nav: RemoteButton[];
}

/** `connecting`, `on` (the stream is open), `lost` (trying again), `stopped` (the Mac ended it). */
export type RemoteStatus = 'connecting' | 'on' | 'lost' | 'stopped';

export interface RemoteTransport {
  /** Hear each view and each change of the connection; the function back stops it. */
  listen(onView: (view: RemoteView) => void, onStatus: (status: RemoteStatus) => void): () => void;
  press(v: number, id: string): Promise<void>;
  /** Felt under the finger, where the device can. */
  feel?(): void;
  /** A close button, where the remote is inside an app (the phone's ilmi); a browser's tab is closed as a tab. */
  close?(): void;
}

/** The remote drawn into `root`, live until the function back is called. Stands alone (see the file's head). */
export function mountRemote(root: HTMLElement, transport: RemoteTransport): () => void {
  const doc = root.ownerDocument;
  const make = (tag: string, cls: string, text?: string): HTMLElement => {
    const e = doc.createElement(tag);
    e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  root.textContent = '';
  root.classList.add('rm');
  const head = root.appendChild(make('div', 'rm-head'));
  const count = head.appendChild(make('span', 'rm-count'));
  const title = head.appendChild(make('span', 'rm-title'));
  if (transport.close) {
    const x = head.appendChild(make('button', 'rm-close', '×'));
    x.setAttribute('aria-label', 'close the remote');
    x.addEventListener('click', () => transport.close?.());
  }
  const line = root.appendChild(make('div', 'rm-line'));
  const main = root.appendChild(make('div', 'rm-main'));
  const foot = root.appendChild(make('div', 'rm-foot'));
  const status = foot.appendChild(make('span', 'rm-status'));
  const nav = foot.appendChild(make('div', 'rm-nav'));

  let view: RemoteView | null = null;
  let state: RemoteStatus = 'connecting';
  // a press sent and the view it was made on: every button waits until another view comes, or a while has gone by
  let sentOn: number | null = null;
  let sentAt = 0;
  let wake: ReturnType<typeof setTimeout> | undefined;

  const button = (b: RemoteButton, cls: string): HTMLElement => {
    const e = make('button', cls) as HTMLButtonElement;
    e.type = 'button';
    e.dataset.id = b.id;
    if (b.on) e.dataset.on = '1';
    e.appendChild(make('span', 'rm-l', b.label));
    if (b.sub) e.appendChild(make('span', 'rm-s', b.sub));
    e.disabled = !!b.off || (sentOn !== null && view !== null && sentOn === view.v);
    e.addEventListener('click', () => {
      if (!view || e.disabled) return;
      sentOn = view.v;
      sentAt = Date.now();
      e.dataset.pressed = '1';
      transport.feel?.();
      for (const other of Array.from(root.querySelectorAll('button[data-id]'))) (other as HTMLButtonElement).disabled = true;
      void transport.press(view.v, b.id);
      clearTimeout(wake);
      // nothing came of it (a press the Mac had no button for): the buttons are back after a moment
      wake = setTimeout(() => { if (sentOn !== null && Date.now() - sentAt >= 1400) { sentOn = null; draw(); } }, 1500);
    });
    return e;
  };

  const draw = (): void => {
    root.dataset.status = state;
    status.textContent = state === 'connecting' ? 'connecting to the mac…'
      : state === 'lost' ? 'lost the mac · trying again'
      : state === 'stopped' ? 'the mac stopped the remote · show its code again to reconnect'
      : '';
    const live = state !== 'stopped';
    count.textContent = live ? view?.count ?? '' : '';
    title.textContent = live ? view?.title ?? '' : '';
    main.textContent = '';
    nav.textContent = '';
    line.textContent = '';
    if (!view || state === 'stopped') return;
    main.dataset.n = String(view.main.length);
    main.dataset.kind = view.kind;
    // a line beside buttons is over them; alone, it is in their place
    if (view.note) (view.main.length ? line : main).appendChild(make('div', 'rm-note', view.note));
    for (const b of view.main) main.appendChild(button(b, 'rm-b'));
    for (const b of view.nav) nav.appendChild(button(b, 'rm-n'));
  };

  const stop = transport.listen(
    (v) => {
      if (sentOn !== null && v.v !== sentOn) sentOn = null;
      view = v;
      if (state !== 'on') state = 'on';
      draw();
    },
    (s) => { state = s; draw(); },
  );
  draw();
  return () => { clearTimeout(wake); stop(); root.textContent = ''; };
}

/** A phone's browser's way to the Mac: the page's own address, its stream and its presses. Stands alone (see the file's head). */
export function browserTransport(): RemoteTransport {
  const base = location.pathname.replace(/\/+$/, '');
  return {
    listen(onView, onStatus) {
      let es: EventSource | null = null;
      let again: ReturnType<typeof setTimeout> | undefined;
      let done = false;
      const open = (): void => {
        es = new EventSource(`${base}/events`);
        es.onopen = () => onStatus('on');
        es.onmessage = (e) => {
          let got: (RemoteView & { stopped?: boolean }) | null = null;
          try { got = JSON.parse(e.data as string) as RemoteView & { stopped?: boolean }; } catch { /* not a view */ }
          if (!got) return;
          // the Mac stopped the remote: said, and not tried again
          if (got.stopped) { done = true; es?.close(); onStatus('stopped'); return; }
          onView(got);
        };
        es.onerror = () => {
          if (!es || es.readyState !== 2) { onStatus('lost'); return; }
          // closed for good: the Mac answered and not with a stream (its server stopped, a new token), or it is away
          es.close();
          if (done) return;
          void fetch(base, { method: 'GET', cache: 'no-store' }).then(
            (r) => { if (r.status === 404) onStatus('stopped'); else onStatus('lost'); },
            () => onStatus('lost'),
          ).finally(() => { if (!done) again = setTimeout(open, 2000); });
        };
      };
      open();
      // back from the lock screen: a stream the system dropped is opened again at once
      const onShow = (): void => { if (!done && document.visibilityState === 'visible' && es && es.readyState === 2) { clearTimeout(again); open(); } };
      document.addEventListener('visibilitychange', onShow);
      return () => { done = true; clearTimeout(again); es?.close(); document.removeEventListener('visibilitychange', onShow); };
    },
    press(v, id) {
      return fetch(`${base}/press`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ v, id }) }).then(() => {}, () => {});
    },
    feel() {
      try { navigator.vibrate?.(12); } catch { /* not here */ }
    },
  };
}

/** The remote's look: its own tokens, light and dark, nothing of the app's needed (a phone's browser has none of it). */
export const REMOTE_CSS = `
.rm {
  --bg: #f6f5f2; --paper: #fff; --fg: #1d1c1a; --fg-3: #6f6c66; --line: #dcd9d2; --on: #2f5fd0; --again: #b4432f;
  position: fixed; inset: 0; display: flex; flex-direction: column; gap: 10px;
  padding: max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left));
  background: var(--bg); color: var(--fg); box-sizing: border-box;
  font: 15px/1.3 -apple-system, BlinkMacSystemFont, "Inter", "Helvetica Neue", sans-serif; text-transform: lowercase;
  -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; touch-action: manipulation;
}
@media (prefers-color-scheme: dark) {
  .rm { --bg: #141413; --paper: #1f1e1c; --fg: #ecebe7; --fg-3: #9a978f; --line: #34332f; --on: #7ea2ff; --again: #ee8b76; }
}
.rm * { box-sizing: border-box; }
.rm-head { display: flex; align-items: baseline; gap: 10px; min-height: 22px; }
.rm-count { color: var(--fg-3); font-variant-numeric: tabular-nums; white-space: nowrap; }
.rm-title { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rm-close { border: 0; background: none; color: var(--fg-3); font: inherit; font-size: 22px; line-height: 1; padding: 0 4px; }
.rm-main { flex: 1; min-height: 0; display: grid; gap: 10px; grid-auto-rows: 1fr; }
.rm-main[data-n="4"] { grid-template-columns: 1fr 1fr; }
.rm-main[data-n="0"] { display: flex; align-items: center; justify-content: center; }
.rm-note { color: var(--fg-3); text-align: center; }
.rm-line:empty { display: none; }
.rm button { font: inherit; color: inherit; text-transform: lowercase; }
.rm-b {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  border: 1px solid var(--line); border-radius: 4px; background: var(--paper); font-size: 22px; font-weight: 500;
  transition: transform 90ms ease-out, opacity 120ms ease-out;
}
.rm-b:active, .rm-b[data-pressed="1"] { transform: scale(0.97); }
.rm-b:disabled { opacity: 0.45; }
.rm-b[data-pressed="1"] { opacity: 1; border-color: var(--on); }
.rm-b[data-on="1"] { border-color: var(--on); }
.rm-b[data-id="g1"] .rm-l { color: var(--again); }
.rm-s { font-size: 14px; font-weight: 400; color: var(--fg-3); font-variant-numeric: tabular-nums; }
.rm-foot { display: flex; align-items: center; gap: 10px; min-height: 44px; }
.rm-status { flex: 1; color: var(--fg-3); font-size: 13px; }
.rm-nav { display: flex; gap: 8px; }
.rm-n { min-width: 56px; height: 44px; border: 1px solid var(--line); border-radius: 4px; background: var(--paper); font-size: 20px; }
.rm-n:disabled { opacity: 0.35; }
`;

/** The page a phone's browser is given: the remote, its look and its transport, from their own source. */
export function remotePage(): string {
  return '<!doctype html><html lang="en"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">'
    + '<meta name="apple-mobile-web-app-capable" content="yes"><meta name="color-scheme" content="light dark">'
    + `<title>ilmi remote</title><style>html,body{margin:0;height:100%}${REMOTE_CSS}</style></head>`
    + `<body><div id="rm"></div><script>(${mountRemote.toString()})(document.getElementById('rm'),(${browserTransport.toString()})());</script></body></html>`;
}
