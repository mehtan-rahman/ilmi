// @vitest-environment jsdom
// The phone as a remote (milestone 90): the controller drawn from its own
// source alone (what a phone's browser is given), its presses and its
// waits; the app's transport over a stream that comes in pieces; and the
// Mac's reading of the session's buttons off the page, and a press clicking
// the one it names only when it was made on what is shown.

import { describe, expect, it, vi } from 'vitest';
import { browserTransport, mountRemote, remotePage, type RemoteStatus, type RemoteTransport, type RemoteView } from '../../remote/controller.js';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => ({ url: 'http://192.168.1.20:51765/abcdefghijklmnopqrstuv' })) }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock('@tauri-apps/plugin-http', () => ({ fetch: vi.fn() }));
vi.mock('../vault.js', async (orig) => ({ ...(await orig<typeof import('../vault.js')>()), startSession: vi.fn() }));

const { isRemoteCode, sseData, appTransport, showRemote, closeRemote } = await import('../remoteClient.js');
const { readView, pressed } = await import('../remote.js');
const { startSession } = await import('../vault.js');
const { useApp } = await import('../store.js');

const view = (over: Partial<RemoteView> = {}): RemoteView => ({ v: 1, title: 'kana and its sisters', count: '3 / 20', kind: 'card', note: '', main: [{ id: 'reveal', label: 'reveal' }], nav: [{ id: 'prev', label: '‹' }, { id: 'next', label: '›', off: true }], ...over });
const GRADES = [{ id: 'g1', label: 'again', sub: '1m' }, { id: 'g2', label: 'hard', sub: '6m' }, { id: 'g3', label: 'good', sub: '1d' }, { id: 'g4', label: 'easy', sub: '4d' }];

/** A transport the test drives: what it is told to show, what was pressed, and what was felt. */
function fake() {
  let onView: (v: RemoteView) => void = () => {};
  let onStatus: (s: RemoteStatus) => void = () => {};
  const presses: [number, string][] = [];
  const felt: string[] = [];
  const t: RemoteTransport = {
    listen(v, s) { onView = v; onStatus = s; return () => {}; },
    press: async (v, id) => { presses.push([v, id]); },
    feel: (what) => { felt.push(what); },
  };
  return { t, presses, felt, show: (v: RemoteView) => onView(v), status: (s: RemoteStatus) => onStatus(s) };
}

/** `mountRemote` as the phone's browser has it: made again from its source text, so it uses nothing of this module. */
const fromSource = new Function(`return (${mountRemote.toString()})`)() as typeof mountRemote;

/** The buttons on the surface, by gesture. */
const slots = (root: HTMLElement) => Object.fromEntries(Array.from(root.querySelectorAll<HTMLElement>('.rm-pad [data-slot]')).map((b) => [b.dataset.slot, b.dataset.id]));

/** A finger on the surface: down, through each point, up. jsdom has no PointerEvent: an Event with its fields. */
function finger(root: HTMLElement, path: [number, number][], ms = 80): void {
  const pad = root.querySelector<HTMLElement>('.rm-pad')!;
  const fire = (type: string, [x, y]: [number, number]) => {
    const e = new Event(type, { bubbles: true });
    Object.assign(e, { clientX: x, clientY: y, pointerId: 1, button: 0 });
    pad.dispatchEvent(e);
  };
  const now = Date.now();
  vi.setSystemTime(now);
  fire('pointerdown', path[0]!);
  for (const p of path.slice(1)) fire('pointermove', p);
  vi.setSystemTime(now + ms);
  fire('pointerup', path.at(-1)!);
}
const tap = (root: HTMLElement) => finger(root, [[150, 300], [152, 301]]);
const swipe = (root: HTMLElement, dx: number, dy: number) => finger(root, [[150, 300], [150 + dx / 2, 300 + dy / 2], [150 + dx, 300 + dy]]);

describe('the controller', () => {
  it('stands alone: made from its own source, one surface, the grades by gesture and never a grid', () => {
    vi.useFakeTimers();
    try {
      const root = document.body.appendChild(document.createElement('div'));
      const f = fake();
      const unmount = fromSource(root, f.t);
      expect(root.querySelector('.rm-status')!.textContent).toBe('connecting to the mac…');
      f.show(view());
      expect(slots(root)).toEqual({ up: 'prev', tap: 'reveal' });
      expect(root.querySelector('.rm-count')!.textContent).toBe('3 / 20');
      // a tap anywhere reveals; felt as a reveal
      tap(root);
      expect(f.presses).toEqual([[1, 'reveal']]);
      expect(f.felt).toEqual(['reveal']);
      f.show(view({ v: 2, main: GRADES }));
      expect(slots(root)).toEqual({ up: 'prev', left: 'g1', tap: 'g3', right: 'g4', down: 'g2' });
      expect(root.querySelector('.rm-pad .rm-slot[data-slot="tap"] .rm-s')!.textContent).toBe('1d');
      // no answer shown is felt as anything more than the press
      expect(f.felt).toEqual(['reveal']);
      tap(root);
      expect(f.presses.at(-1)).toEqual([2, 'g3']);
      f.show(view({ v: 3 }));
      // the next card felt as it comes
      vi.advanceTimersByTime(100);
      expect(f.felt).toEqual(['reveal', 'g3', 'card']);
      unmount();
      expect(root.textContent).toBe('');
    } finally { vi.useRealTimers(); }
  });

  it('a swipe counts once it has gone far enough, felt then, and sends on the lift; a short one is nothing', () => {
    vi.useFakeTimers();
    try {
      const root = document.body.appendChild(document.createElement('div'));
      const f = fake();
      fromSource(root, f.t);
      f.show(view({ main: GRADES }));
      swipe(root, -20, 0);
      expect(f.presses).toEqual([]);
      expect(f.felt).toEqual([]);
      swipe(root, -120, 10);
      expect(f.felt).toEqual(['arm', 'g1']);
      expect(f.presses).toEqual([[1, 'g1']]);
      for (const [dx, dy, id, v] of [[130, -5, 'g4', 2], [8, 140, 'g2', 3], [0, -140, 'prev', 4]] as const) {
        f.show(view({ v: v, main: GRADES }));
        swipe(root, dx, dy);
        expect(f.presses.at(-1)).toEqual([v, id]);
      }
      expect(f.felt).toEqual(['arm', 'g1', 'arm', 'g4', 'arm', 'g2', 'arm', 'back']);
      // a diagonal is no direction, and a slow press that did not move is not a tap
      f.show(view({ v: 5, main: GRADES }));
      swipe(root, 100, 100);
      finger(root, [[150, 300], [151, 300]], 900);
      expect(f.presses.at(-1)).toEqual([4, 'prev']);
    } finally { vi.useRealTimers(); }
  });

  it('a gesture while the mac has not answered is done on what comes next, never twice on one view', () => {
    vi.useFakeTimers();
    try {
      const root = document.body.appendChild(document.createElement('div'));
      const f = fake();
      fromSource(root, f.t);
      f.show(view());
      tap(root);
      tap(root);
      expect(f.presses).toEqual([[1, 'reveal']]);
      // the same view again (a reconnect) does not let it through
      f.show(view());
      expect(f.presses).toEqual([[1, 'reveal']]);
      f.show(view({ v: 2, main: GRADES }));
      expect(f.presses).toEqual([[1, 'reveal'], [2, 'g3']]);
      // kept a moment only: one made long before is dropped
      swipe(root, -150, 0);
      vi.advanceTimersByTime(1000);
      tap(root);
      vi.advanceTimersByTime(1400);
      f.show(view({ v: 3, main: GRADES }));
      expect(f.presses).toEqual([[1, 'reveal'], [2, 'g3']]);
    } finally { vi.useRealTimers(); }
  });

  it('a press that came to nothing is felt, and the surface is free again', () => {
    vi.useFakeTimers();
    try {
      const root = document.body.appendChild(document.createElement('div'));
      const f = fake();
      fromSource(root, f.t);
      f.show(view());
      tap(root);
      vi.advanceTimersByTime(1600);
      expect(f.felt).toEqual(['reveal', 'missed']);
      tap(root);
      expect(f.presses).toEqual([[1, 'reveal'], [1, 'reveal']]);
    } finally { vi.useRealTimers(); }
  });

  it('a reading: tap is its next, left later, right dismiss; it is felt as something to look at', () => {
    const root = document.body.appendChild(document.createElement('div'));
    const f = fake();
    fromSource(root, f.t);
    f.show(view());
    f.show(view({ v: 2, kind: 'read', title: 'lindqvist › ch 3', main: [{ id: 'on', label: 'done for today' }, { id: 'postpone', label: 'later' }, { id: 'done', label: 'dismiss' }] }));
    expect(slots(root)).toEqual({ up: 'prev', left: 'postpone', tap: 'on', right: 'done' });
    expect(f.felt).toEqual(['look']);
    // the end of the queue: the system's success
    f.show(view({ v: 3, kind: 'none', title: '', main: [], nav: [], note: 'all done, 12 items · back to the queue' }));
    expect(f.felt).toEqual(['look', 'end']);
  });

  it('says a line alone in the buttons\' place, and beside them over them', () => {
    const root = document.body.appendChild(document.createElement('div'));
    const f = fake();
    fromSource(root, f.t);
    f.show(view({ main: [], nav: [], note: 'all done, 12 items · back to the queue', count: '' }));
    expect(root.querySelector('.rm-pad .rm-note')!.textContent).toBe('all done, 12 items · back to the queue');
    f.show(view({ v: 2, note: 'next for today', main: [{ id: 'pass', label: 'next' }] }));
    expect(root.querySelector('.rm-line .rm-note')!.textContent).toBe('next for today');
    expect(root.querySelector('.rm-pad .rm-note')).toBeNull();
  });

  it('says the mac stopped, and nothing on the surface does anything then', () => {
    const root = document.body.appendChild(document.createElement('div'));
    const f = fake();
    fromSource(root, f.t);
    f.show(view());
    f.status('stopped');
    expect(root.querySelector('.rm-status')!.textContent).toMatch(/^the mac stopped the remote/);
    expect(slots(root)).toEqual({});
    tap(root);
    expect(f.presses).toEqual([]);
    f.status('lost');
    expect(root.dataset.status).toBe('lost');
  });

  it('the phone\'s page runs: its script made from the two functions, over a browser\'s stream', async () => {
    const page = remotePage();
    expect(page).toContain('<title>ilmi remote</title>');
    const script = page.match(/<script>([\s\S]*)<\/script>/)![1]!;
    const sources: { url: string; onmessage?: (e: { data: string }) => void; onopen?: () => void }[] = [];
    class ES { url: string; readyState = 1; onmessage?: (e: { data: string }) => void; onopen?: () => void; onerror?: () => void; constructor(u: string) { this.url = u; sources.push(this); } close() { this.readyState = 2; } }
    const posted: { url: string; body: string }[] = [];
    const fetch = async (url: string, init?: { body?: string }) => { posted.push({ url, body: init?.body ?? '' }); return { status: 204 }; };
    document.body.innerHTML = '<div id="rm"></div>';
    window.history.replaceState(null, '', '/abcdefghijklmnopqrstuv');
    new Function('EventSource', 'fetch', script)(ES, fetch);
    expect(sources[0]!.url).toBe('/abcdefghijklmnopqrstuv/events');
    sources[0]!.onopen?.();
    sources[0]!.onmessage?.({ data: JSON.stringify(view({ v: 7 })) });
    document.querySelector<HTMLButtonElement>('#rm .rm-slot[data-slot="tap"]')!.click();
    await Promise.resolve();
    expect(posted).toEqual([{ url: '/abcdefghijklmnopqrstuv/press', body: '{"v":7,"id":"reveal"}' }]);
    // the Mac stops the remote: said, and the stream not opened again
    const statuses: string[] = [];
    (globalThis as { EventSource?: unknown }).EventSource = ES;
    browserTransport().listen(() => {}, (st) => statuses.push(st));
    sources.at(-1)!.onmessage?.({ data: '{"stopped":true}' });
    expect(statuses).toEqual(['stopped']);
    expect(document.querySelector('#rm .rm-status')!.textContent).not.toMatch(/stopped/);
  });
});

describe('the app\'s side on a phone', () => {
  it('knows the mac\'s remote code from any other', () => {
    expect(isRemoteCode('http://192.168.1.20:51765/abcdefghijklmnopqrstuv')).toBe(true);
    expect(isRemoteCode(' http://ilmi-mac.local:51765/abcdefghijklmnopqrstuv/ ')).toBe(true);
    expect(isRemoteCode('ilmi-pair:eyJ2IjoxfQ')).toBe(false);
    expect(isRemoteCode('https://example.com/abcdefghijklmnopqrstuv')).toBe(false);
    expect(isRemoteCode('http://192.168.1.20:51765/short')).toBe(false);
  });

  it('the remote over the app has the controller\'s look, once, and × takes it away', () => {
    showRemote('http://10.0.0.2:51765/abcdefghijklmnopqrstuv', vi.fn(() => new Promise<Response>(() => {})));
    showRemote('http://10.0.0.2:51765/abcdefghijklmnopqrstuv', vi.fn(() => new Promise<Response>(() => {})));
    expect(document.querySelectorAll('#rm-style')).toHaveLength(1);
    expect(document.querySelectorAll('.rm-host')).toHaveLength(1);
    document.querySelector<HTMLButtonElement>('.rm-host .rm-close')!.click();
    expect(document.querySelector('.rm-host')).toBeNull();
    closeRemote();
  });

  it('reads server-sent events however the stream is cut', () => {
    expect(sseData('retry: 1000\n\ndata: {"v":1}\n\n: k\n\ndata: {"v"')).toEqual({ data: ['{"v":1}'], rest: 'data: {"v"' });
    expect(sseData('data: {"v":2}\r\n\r\n')).toEqual({ data: ['{"v":2}'], rest: '' });
  });

  it('a stream that says stopped is not opened again', async () => {
    const enc = new TextEncoder();
    const fetch = vi.fn(async () => new Response(new ReadableStream({ start(c) { c.enqueue(enc.encode('data: {"v":1,"main":[],"nav":[]}\n\ndata: {"stopped":true}\n\n')); } }), { status: 200 }));
    const statuses: string[] = [];
    await new Promise<void>((done) => { appTransport('http://10.0.0.2:51765/abcdefghijklmnopqrstuv', { fetch, wait: 1 }).listen(() => {}, (s) => { statuses.push(s); if (s === 'stopped') done(); }); });
    await new Promise((r) => setTimeout(r, 20));
    expect(statuses).toEqual(['on', 'stopped']);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('hears views from the stream in pieces, opens it again when it ends, and stops on a 404', async () => {
    const enc = new TextEncoder();
    let calls = 0;
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/press')) return new Response(null, { status: 204 });
      calls++;
      if (calls === 1) {
        const pieces = ['data: {"v":1,"main":[]', ',"nav":[]}\n\nda', 'ta: {"v":2,"main":[],"nav":[]}\n\n'];
        return new Response(new ReadableStream({ start(c) { for (const p of pieces) c.enqueue(enc.encode(p)); c.close(); } }), { status: 200 });
      }
      void init;
      return new Response('not found', { status: 404 });
    });
    const t = appTransport('http://192.168.1.20:51765/abcdefghijklmnopqrstuv/', { fetch, wait: 1 });
    const views: number[] = [];
    const statuses: string[] = [];
    await new Promise<void>((done) => {
      t.listen((v) => views.push(v.v), (s) => { statuses.push(s); if (s === 'stopped') done(); });
    });
    expect(views).toEqual([1, 2]);
    expect(statuses).toEqual(['on', 'lost', 'stopped']);
    expect(fetch.mock.calls[0]![0]).toBe('http://192.168.1.20:51765/abcdefghijklmnopqrstuv/events');
    await t.press(2, 'g3');
    expect(fetch.mock.calls.at(-1)![0]).toBe('http://192.168.1.20:51765/abcdefghijklmnopqrstuv/press');
    expect(fetch.mock.calls.at(-1)![1]!.body).toBe('{"v":2,"id":"g3"}');
  });
});

// The session's markup, as `Session.tsx` draws it: a card with its answer down, then up; a reading's bar; the end.
const CARD = (revealed: boolean) => `
<div class="recall-wrap">
  <div class="recall-meta">
    <span class="sess-nav"><button class="sn-btn" disabled><span class="gch">‹</span></button><button class="sn-btn"><span class="gch">›</span></button></span>
    <span class="sess-count">3 / 20</span>
  </div>
  <div class="card" data-revealed="${revealed ? 1 : 0}"><div class="face front">q</div>${revealed ? '' : '<button type="button" class="face-hint"><kbd class="kbd">space</kbd> <span class="lbl">reveal</span></button>'}</div>
  <div class="grades" data-revealed="${revealed ? 1 : 0}">
    ${[['again', '1m'], ['hard', '6m'], ['good', '1d'], ['easy', '4d']].map(([w, gap], i) => `<button type="button" data-grade="${i + 1}" data-given="${i === 2 && revealed ? 1 : 0}"><span class="label">${w}<kbd>${i + 1}</kbd></span><span class="gap">${gap}</span></button>`).join('')}
  </div>
</div>`;

/** jsdom lays nothing out: the session's root is taken as drawn. */
function drawn(html: string): void {
  document.body.innerHTML = html;
  for (const el of Array.from(document.querySelectorAll<HTMLElement>('.recall-wrap, .doc-session'))) {
    Object.defineProperty(el, 'offsetParent', { value: document.body, configurable: true });
  }
}

describe('the mac\'s reading of the session', () => {
  it('a card with its answer down is reveal alone; up, the four grades with their intervals and the one given', () => {
    useApp.setState({ sessionEl: { kind: 'card', label: 'arabic › kana', item: {} as never } });
    drawn(CARD(false));
    let { view: v, els } = readView();
    expect(v.main).toEqual([{ id: 'reveal', label: 'reveal' }]);
    expect(v).toMatchObject({ title: 'arabic › kana', count: '3 / 20', kind: 'card', note: '' });
    expect(v.nav).toEqual([{ id: 'prev', label: '‹', off: true }, { id: 'next', label: '›' }]);
    expect(els.get('reveal')!.className).toBe('face-hint');
    drawn(CARD(true));
    ({ view: v, els } = readView());
    expect(v.main).toEqual([
      { id: 'g1', label: 'again', sub: '1m' }, { id: 'g2', label: 'hard', sub: '6m' },
      { id: 'g3', label: 'good', sub: '1d', on: true }, { id: 'g4', label: 'easy', sub: '4d' },
    ]);
  });

  it('got it, next, and skip are read by their acts, what only a keyboard is told left out', () => {
    drawn(`<div class="recall-wrap"><div class="card" data-revealed="1"></div><div class="grades learn" data-revealed="1" data-learn="1">
      <button type="button" data-act="learnt"><span class="label">got it<kbd>space</kbd></span><span class="gap">tested at the end<span class="keys-only"> · 1–4 grade it now</span></span></button></div></div>`);
    expect(readView().view.main).toEqual([{ id: 'learnt', label: 'got it', sub: 'tested at the end' }]);
  });

  it('a reading\'s three from its bar, and what was done said over its next', () => {
    useApp.setState({ sessionEl: { kind: 'read', label: 'lindqvist › ch 3', item: {} as never } });
    drawn(`<div class="doc-session" data-el="read"><div class="session-bar"><div class="sb-meta"><span class="sess-nav"><button class="sn-btn"></button><button class="sn-btn"></button></span><span class="sb-count">4 / 20</span></div>
      <div class="sb-actions"><button type="button" data-act="on"><span class="ra-l">done for today</span><kbd>⏎</kbd></button><button type="button" data-act="postpone"><span class="ra-l">later</span><kbd>p</kbd></button><button type="button" data-act="done"><span class="ra-l">dismiss</span><kbd>d</kbd></button></div></div>
      <div class="pdf"><button data-act="zoom">+</button></div></div>`);
    const { view: v } = readView();
    expect(v.main.map((b) => [b.id, b.label])).toEqual([['on', 'done for today'], ['postpone', 'later'], ['done', 'dismiss']]);
    expect(v).toMatchObject({ kind: 'read', count: '4 / 20', title: 'lindqvist › ch 3' });
    drawn(`<div class="doc-session" data-el="read"><div class="session-bar"><div class="sb-actions"><span class="sb-done" data-done="on">read for today</span><button type="button" data-act="pass"><span class="ra-l">next</span><kbd>⏎</kbd></button></div></div></div>`);
    expect(readView().view).toMatchObject({ note: 'read for today', main: [{ id: 'pass', label: 'next' }] });
  });

  it('the end says itself; outside a session, enter queue when there is something to do', () => {
    drawn('<div class="recall-wrap"><div class="empty center session-end">all done, 12 items · back to the queue</div></div>');
    expect(readView().view).toMatchObject({ kind: 'none', note: 'all done, 12 items · back to the queue', main: [] });
    // a deck's card view, browsed with ‹ ›, is not a session (its count was taken for one, and nothing could be pressed)
    drawn('<div class="recall-wrap card-view"><div class="recall-meta"><span class="sess-count cv-count">1 / 35</span></div><div class="card"></div></div>');
    useApp.setState({ vault: '/c', queue: [], budget: 0 });
    expect(readView().view).toMatchObject({ kind: 'none', count: '', note: 'nothing to do today' });
    drawn('<div class="queue"></div>');
    useApp.setState({ vault: '/c', queue: [], budget: 0 });
    expect(readView().view).toMatchObject({ kind: 'none', note: 'nothing to do today', main: [] });
  });

  it('a press clicks the button it names, only on the view it was made on', async () => {
    const { startRemote, stopRemote } = await import('../remote.js');
    useApp.setState({ sessionEl: { kind: 'card', label: 'arabic › kana', item: {} as never } });
    drawn(CARD(true));
    await startRemote();
    const good = document.querySelector<HTMLButtonElement>('[data-grade="3"]')!;
    const clicked = vi.fn();
    good.addEventListener('click', clicked);
    expect(pressed({ v: 0, id: 'g3' })).toBe(false);
    expect(pressed({ v: 1, id: 'g9' })).toBe(false);
    expect(pressed({ v: 1, id: 'g3' })).toBe(true);
    expect(clicked).toHaveBeenCalledTimes(1);
    // `enter` starts the day's queue, as the queue's button does
    drawn('<div class="queue"></div>');
    await new Promise((r) => setTimeout(r, 60));
    expect(pressed({ v: 2, id: 'enter' })).toBe(true);
    expect(startSession).toHaveBeenCalled();
    await stopRemote();
    expect(pressed({ v: 2, id: 'g3' })).toBe(false);
  });
});
