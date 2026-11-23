// The phone as a remote (milestone 90): what a phone shows while a Mac's
// session is studied, made to be used without looking at it. The whole glass
// is one surface, the same in portrait and landscape, and the session's
// buttons (as the Mac sends them, `app/remote.ts`) sit on it by gesture:
//
//   tap anywhere   what space or ⏎ is on the Mac: reveal, then good; got it;
//                  next; a reading's next; enter queue
//   swipe left     again (a reading: later)
//   swipe down     hard
//   swipe right    easy (a reading: dismiss)
//   swipe up       ‹ back, to the last element (a grade given again replaces it)
//
// A swipe is felt the moment it has gone far enough to count, before the
// finger lifts, and each thing sent is felt by what it was (again a double
// knock, hard firm, good crisp, easy soft); what the Mac then puts up is felt
// too: a new card a soft bump, something to read (look at the Mac) a heavy one,
// the end of the queue the system's success, a press that came to nothing a
// warning. A gesture made while the Mac has not answered the last one is kept
// and done on what comes next, so tap-tap-tap runs as fast as the Mac does;
// every press is sent with the version of what it was made on, so nothing is
// done to an element it was not meant for. The labels at the edges say the
// same for a glance; they are buttons for VoiceOver, never targets for a
// finger, which can land anywhere.
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

/**
 * What is felt, by name: `arm` a swipe gone far enough to count; `reveal`, `g1`–`g4`, `press` (anything else) and
 * `back` what was sent; `card` a new card up on the Mac, `look` something that is not a card (read it there), `end`
 * the queue's end, `missed` a press that came to nothing.
 */
export type RemoteFeel = 'arm' | 'reveal' | 'g1' | 'g2' | 'g3' | 'g4' | 'press' | 'back' | 'card' | 'look' | 'end' | 'missed';

export interface RemoteTransport {
  /** Hear each view and each change of the connection; the function back stops it. */
  listen(onView: (view: RemoteView) => void, onStatus: (status: RemoteStatus) => void): () => void;
  press(v: number, id: string): Promise<void>;
  /** Felt under the finger, where the device can. */
  feel?(what: RemoteFeel): void;
  /** A close button, where the remote is inside an app (the phone's ilmi); a browser's tab is closed as a tab. */
  close?(): void;
}

/** Where a gesture puts a button: `tap` anywhere, a swipe `left`, `right`, `down`, `up`. */
export type RemoteSlot = 'tap' | 'left' | 'right' | 'down' | 'up';

/** The remote drawn into `root`, live until the function back is called. Stands alone (see the file's head). */
export function mountRemote(root: HTMLElement, transport: RemoteTransport): () => void {
  const doc = root.ownerDocument;
  const win = doc.defaultView ?? window;
  const make = (tag: string, cls: string, text?: string): HTMLElement => {
    const e = doc.createElement(tag);
    e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  // each button's gesture: the grades on a line from again (left) to easy (right), hard below; a reading's later
  // with again, its dismiss with easy; anything the Mac has that is not named here takes the first gesture free
  const SLOT: Record<string, RemoteSlot> = {
    g3: 'tap', g1: 'left', g2: 'down', g4: 'right',
    on: 'tap', postpone: 'left', done: 'right',
    reveal: 'tap', learnt: 'tap', pass: 'tap', skip: 'tap', next: 'tap', enter: 'tap',
  };
  const ARROW: Record<RemoteSlot, string> = { tap: '', left: '←', right: '→', down: '↓', up: '↑' };
  const FEEL: Record<string, RemoteFeel> = { reveal: 'reveal', g1: 'g1', g2: 'g2', g3: 'g3', g4: 'g4', prev: 'back' };

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
  const pad = root.appendChild(make('div', 'rm-pad'));
  pad.setAttribute('aria-label', 'tap or swipe');
  const foot = root.appendChild(make('div', 'rm-foot'));
  const status = foot.appendChild(make('span', 'rm-status'));

  let view: RemoteView | null = null;
  let state: RemoteStatus = 'connecting';
  // the buttons by gesture, for what is shown now
  let slots: Partial<Record<RemoteSlot, RemoteButton>> = {};
  // a press sent, on the view it was made on: nothing more is sent on that view
  let sentOn: number | null = null;
  // a gesture made while waiting: done on the next view, if it comes soon
  let queued: { slot: RemoteSlot; at: number } | null = null;
  let wake: ReturnType<typeof setTimeout> | undefined;

  const assign = (v: RemoteView): Partial<Record<RemoteSlot, RemoteButton>> => {
    const out: Partial<Record<RemoteSlot, RemoteButton>> = {};
    const free: RemoteSlot[] = ['tap', 'left', 'right', 'down'];
    const take = (s: RemoteSlot | undefined, b: RemoteButton) => {
      const at = s && !out[s] ? s : free.find((f) => !out[f]);
      if (at) out[at] = b;
    };
    for (const b of v.main) if (SLOT[b.id]) take(SLOT[b.id], b);
    for (const b of v.main) if (!SLOT[b.id]) take(undefined, b);
    const prev = v.nav.find((b) => b.id === 'prev');
    if (prev && !prev.off) out.up = prev;
    return out;
  };

  const send = (slot: RemoteSlot): boolean => {
    const b = slots[slot];
    if (!view || !b || b.off || state !== 'on') return false;
    if (sentOn === view.v) {
      // the Mac has not answered the last one yet: this one waits for what comes next
      queued = { slot, at: Date.now() };
      return true;
    }
    sentOn = view.v;
    transport.feel?.(FEEL[b.id] ?? 'press');
    const el = pad.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
    if (el) el.dataset.pressed = '1';
    pad.dataset.wait = '1';
    void transport.press(view.v, b.id);
    clearTimeout(wake);
    // nothing came of it: felt, and the surface is free again
    wake = setTimeout(() => {
      if (sentOn !== null && view && sentOn === view.v) {
        sentOn = null;
        queued = null;
        transport.feel?.('missed');
        draw();
      }
    }, 1500);
    return true;
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
    pad.textContent = '';
    line.textContent = '';
    delete pad.dataset.wait;
    if (!view || !live) { slots = {}; pad.dataset.n = '0'; return; }
    slots = assign(view);
    const shown = (Object.keys(slots) as RemoteSlot[]).filter((k) => k !== 'up');
    pad.dataset.n = String(shown.length);
    pad.dataset.kind = view.kind;
    if (view.note) (shown.length ? line : pad).appendChild(make('div', 'rm-note', view.note));
    for (const slot of ['up', 'left', 'tap', 'right', 'down'] as RemoteSlot[]) {
      const b = slots[slot];
      if (!b) continue;
      const e = make('button', 'rm-slot') as HTMLButtonElement;
      e.type = 'button';
      e.tabIndex = -1;
      e.dataset.id = b.id;
      e.dataset.slot = slot;
      if (b.on) e.dataset.on = '1';
      const words = e.appendChild(make('span', 'rm-w'));
      if (ARROW[slot]) words.appendChild(make('span', 'rm-a', ARROW[slot]));
      words.appendChild(make('span', 'rm-l', slot === 'up' ? 'back' : b.label));
      if (b.sub && slot !== 'up') e.appendChild(make('span', 'rm-s', b.sub));
      if (slot === 'tap' && shown.length > 1) e.appendChild(make('span', 'rm-h', 'tap'));
      // VoiceOver's activation, and a test's: the gesture's own
      e.addEventListener('click', () => { send(slot); });
      pad.appendChild(e);
    }
  };

  // ── the gesture ──
  let start: { x: number; y: number; t: number; id: number } | null = null;
  let armed: RemoteSlot | null = null;
  const reach = (): number => Math.max(44, Math.min(pad.clientWidth || 300, pad.clientHeight || 300) * 0.14);
  const dirOf = (dx: number, dy: number): RemoteSlot | null => {
    if (Math.hypot(dx, dy) < reach()) return null;
    if (Math.abs(dx) > Math.abs(dy) * 1.2) return dx < 0 ? 'left' : 'right';
    if (Math.abs(dy) > Math.abs(dx) * 1.2) return dy < 0 ? 'up' : 'down';
    return null;
  };
  const arm = (to: RemoteSlot | null): void => {
    if (to === armed) return;
    armed = to;
    for (const e of Array.from(pad.querySelectorAll<HTMLElement>('[data-slot]'))) {
      if (e.dataset.slot === to) e.dataset.armed = '1'; else delete e.dataset.armed;
    }
    if (to) transport.feel?.('arm');
  };
  const onDown = (e: PointerEvent): void => {
    if (start || (e.button !== undefined && e.button > 0)) return;
    start = { x: e.clientX, y: e.clientY, t: Date.now(), id: e.pointerId };
    try { pad.setPointerCapture(e.pointerId); } catch { /* not captured: still followed on the pad */ }
  };
  const onMove = (e: PointerEvent): void => {
    if (!start || e.pointerId !== start.id) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const d = dirOf(dx, dy);
    arm(d && slots[d] ? d : null);
    // the surface leans a little with the finger (no more than a few points)
    const k = 0.12;
    pad.style.transform = `translate(${Math.max(-14, Math.min(14, dx * k))}px, ${Math.max(-14, Math.min(14, dy * k))}px)`;
  };
  const onUp = (e: PointerEvent): void => {
    if (!start || e.pointerId !== start.id) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const quick = Date.now() - start.t < 600;
    start = null;
    pad.style.transform = '';
    const was = armed;
    arm(null);
    if (was) send(was);
    else if (quick && Math.hypot(dx, dy) < 16) send('tap');
  };
  const onCancel = (): void => { start = null; pad.style.transform = ''; arm(null); };
  pad.addEventListener('pointerdown', onDown);
  pad.addEventListener('pointermove', onMove);
  pad.addEventListener('pointerup', onUp);
  pad.addEventListener('pointercancel', onCancel);
  // nothing of the browser's own under the finger: no menu, no selection, no double-tap zoom
  const noMenu = (e: Event) => e.preventDefault();
  root.addEventListener('contextmenu', noMenu);
  root.addEventListener('dblclick', noMenu);

  const stop = transport.listen(
    (v) => {
      const before = view;
      const changed = !before || v.v !== before.v;
      if (sentOn !== null && v.v !== sentOn) { sentOn = null; clearTimeout(wake); }
      view = v;
      if (state !== 'on') state = 'on';
      draw();
      if (!before || !changed) return;
      // what the Mac put up, felt: only when it is a new element, not a card's answer shown
      const ids = (x: RemoteView) => x.main.map((b) => b.id).join();
      const newCard = v.main.some((b) => b.id === 'reveal') && ids(before) !== ids(v);
      const ended = v.kind === 'none' && before.kind !== 'none' && !!v.note;
      const look = v.kind !== 'card' && v.kind !== 'none' && (before.kind !== v.kind || before.title !== v.title);
      const q = queued;
      queued = null;
      if (ended) transport.feel?.('end');
      else if (look) transport.feel?.('look');
      else if (newCard && !q) win.setTimeout(() => transport.feel?.('card'), 90);
      // a gesture made while waiting, done now, on this view, if it was made a moment ago
      if (q && Date.now() - q.at < 1500 && !ended && !look) send(q.slot);
    },
    (s) => { state = s; if (s !== 'on') { sentOn = null; queued = null; } draw(); },
  );
  draw();
  return () => {
    clearTimeout(wake);
    stop();
    root.removeEventListener('contextmenu', noMenu);
    root.removeEventListener('dblclick', noMenu);
    root.textContent = '';
  };
}

/** A phone's browser's way to the Mac: the page's own address, its stream and its presses. Stands alone (see the file's head). */
export function browserTransport(): RemoteTransport {
  const base = location.pathname.replace(/\/+$/, '');
  // Safari on an iPhone has no vibration; a switch's label clicked is the system's tick (iOS 18 on), felt while the
  // finger's press still counts. Elsewhere (Android) the vibration's own patterns.
  let tick: (() => void) | null = null;
  try {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    label.appendChild(input);
    label.setAttribute('aria-hidden', 'true');
    label.style.cssText = 'position:fixed;left:-99px;top:0;width:1px;height:1px;overflow:hidden;opacity:0';
    document.body.appendChild(label);
    tick = () => label.click();
  } catch { /* none */ }
  // what each is: ticks and the gaps between them, in ms
  const PATTERN: Record<string, number[]> = {
    arm: [0], reveal: [0], g1: [0, 70, 140], g2: [0, 70], g3: [0], g4: [0, 180], press: [0], back: [0],
    card: [], look: [0, 120], end: [0, 150, 300], missed: [0, 90],
  };
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
    feel(what) {
      const at = PATTERN[what] ?? [0];
      if (!at.length) return;
      try {
        const vib = (navigator as Navigator & { vibrate?: (p: number[]) => boolean }).vibrate;
        if (typeof vib === 'function') { vib.call(navigator, at.flatMap((t, i) => (i ? [Math.max(20, t - at[i - 1]! - 15), 15] : [15]))); return; }
        for (const t of at) { if (t === 0) tick?.(); else setTimeout(() => tick?.(), t); }
      } catch { /* not here */ }
    },
  };
}

/** The remote's look: its own tokens, light and dark, nothing of the app's needed (a phone's browser has none of it). */
export const REMOTE_CSS = `
.rm {
  --bg: #f6f5f2; --paper: #fff; --fg: #1d1c1a; --fg-3: #6f6c66; --fg-4: #a19d95; --line: #dcd9d2; --on: #2f5fd0; --again: #b4432f; --easy: #2f7d4f;
  position: fixed; inset: 0; display: flex; flex-direction: column; gap: 8px;
  padding: max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left));
  background: var(--bg); color: var(--fg); box-sizing: border-box; overscroll-behavior: none;
  font: 15px/1.3 -apple-system, BlinkMacSystemFont, "Inter", "Helvetica Neue", sans-serif; text-transform: lowercase;
  -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent;
}
@media (prefers-color-scheme: dark) {
  .rm { --bg: #141413; --paper: #1d1c1a; --fg: #ecebe7; --fg-3: #9a978f; --fg-4: #6b6862; --line: #34332f; --on: #7ea2ff; --again: #ee8b76; --easy: #7fcf9c; }
}
.rm * { box-sizing: border-box; }
.rm button { font: inherit; color: inherit; text-transform: lowercase; }
.rm-head { display: flex; align-items: baseline; gap: 10px; min-height: 22px; }
.rm-count { color: var(--fg-3); font-variant-numeric: tabular-nums; white-space: nowrap; }
.rm-title { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rm-close { border: 0; background: none; color: var(--fg-3); font-size: 22px; line-height: 1; padding: 0 4px; }
.rm-line:empty { display: none; }
.rm-note { color: var(--fg-3); text-align: center; }
/* the surface: one target, the gestures' words at its edges, the tap's in the middle */
.rm-pad {
  flex: 1; min-height: 0; position: relative; touch-action: none;
  display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr) minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr) auto;
  grid-template-areas: ". up ." "left tap right" ". down .";
  border: 1px solid var(--line); border-radius: 4px; background: var(--paper);
  transition: transform 160ms cubic-bezier(.2,.8,.2,1);
}
.rm-pad[data-n="0"] { display: flex; align-items: center; justify-content: center; }
.rm-pad[data-n="1"] { grid-template-columns: 0 1fr 0; }
.rm-slot {
  pointer-events: none; border: 0; background: none; padding: 14px 8px;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
  color: var(--fg-3); transition: transform 120ms ease-out, color 120ms ease-out;
}
.rm-slot[data-slot="up"] { grid-area: up; padding-top: 10px; font-size: 13px; color: var(--fg-4); }
.rm-slot[data-slot="left"] { grid-area: left; }
.rm-slot[data-slot="right"] { grid-area: right; }
.rm-slot[data-slot="down"] { grid-area: down; }
.rm-slot[data-slot="tap"] { grid-area: tap; color: var(--fg); }
.rm-w { display: flex; align-items: baseline; gap: 6px; font-size: 18px; font-weight: 500; }
.rm-slot[data-slot="tap"] .rm-w { font-size: 30px; }
.rm-slot[data-slot="up"] .rm-w { font-size: 13px; font-weight: 400; }
.rm-a { color: var(--fg-4); font-weight: 400; }
.rm-s { font-size: 14px; color: var(--fg-3); font-variant-numeric: tabular-nums; }
.rm-slot[data-slot="tap"] .rm-s { font-size: 17px; }
.rm-h { margin-top: 6px; font-size: 12px; color: var(--fg-4); letter-spacing: .04em; }
.rm-slot[data-id="g1"] .rm-l { color: var(--again); }
.rm-slot[data-id="g4"] .rm-l { color: var(--easy); }
.rm-slot[data-on="1"] .rm-l { text-decoration: underline; text-underline-offset: 4px; }
.rm-slot[data-armed="1"] { color: var(--fg); transform: scale(1.12); }
.rm-slot[data-armed="1"] .rm-a { color: var(--on); }
.rm-slot[data-pressed="1"] { color: var(--on); }
.rm-slot[data-pressed="1"] .rm-l { color: var(--on); }
.rm-pad[data-wait="1"] .rm-slot:not([data-pressed]) { opacity: .5; }
.rm-foot { display: flex; align-items: center; min-height: 20px; }
.rm-status { flex: 1; color: var(--fg-3); font-size: 13px; }
.rm-status:empty::before { content: "tap · swipe ← ↓ → · ↑ back"; color: var(--fg-4); }
@media (orientation: landscape) and (max-height: 500px) {
  .rm { gap: 4px; }
  .rm-slot { padding: 8px; }
  .rm-slot[data-slot="tap"] .rm-w { font-size: 26px; }
}
`;

/** The page a phone's browser is given: the remote, its look and its transport, from their own source. */
export function remotePage(): string {
  return '<!doctype html><html lang="en"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">'
    + '<meta name="apple-mobile-web-app-capable" content="yes"><meta name="color-scheme" content="light dark">'
    + `<title>ilmi remote</title><style>html,body{margin:0;height:100%}${REMOTE_CSS}</style></head>`
    + `<body><div id="rm"></div><script>(${mountRemote.toString()})(document.getElementById('rm'),(${browserTransport.toString()})());</script></body></html>`;
}
