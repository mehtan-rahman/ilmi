// The phone as a remote (milestone 90), the phone's side inside ilmi: the
// Mac's remote code scanned (`scan a code` on the welcome, or the palette's
// `remote for a mac`), and the same controller a phone's browser is given
// (`remote/controller.ts`) drawn over the app. Its stream and its presses
// go through the http plugin (the app's page is not on the network the Mac's
// server is on, and a web view would refuse plain http from it).

import { fetch as httpFetch } from '@tauri-apps/plugin-http';
import { REMOTE_CSS, mountRemote, type RemoteFeel, type RemoteStatus, type RemoteTransport, type RemoteView } from '../remote/controller.js';
import { GRADE_HAPTIC, REVEAL_HAPTIC, hapticPlay, type Haptic } from './haptics.js';
import { notify } from './land.js';
import { scanCode } from './scan.js';

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * What the remote's feels are on an iPhone: the session's own for a reveal and the grades (`haptics.ts`), easy's
 * light tap twice so it is not taken for the swipe's; a tap the moment a swipe counts; a soft bump for a new card, a
 * heavy one for something to read on the Mac, the system's success at the end, its warning for a press lost. Each a
 * list of [ms after the first, kind].
 */
export const REMOTE_HAPTICS: Record<RemoteFeel, [number, Haptic][]> = {
  arm: [[0, 'tick']],
  reveal: [[0, REVEAL_HAPTIC]],
  g1: [[0, GRADE_HAPTIC[1]]],
  g2: [[0, GRADE_HAPTIC[2]]],
  g3: [[0, GRADE_HAPTIC[3]]],
  g4: [[0, GRADE_HAPTIC[4]], [110, GRADE_HAPTIC[4]]],
  press: [[0, 'rigid']],
  back: [[0, 'soft'], [90, 'soft']],
  card: [[0, 'soft']],
  look: [[0, 'heavy'], [140, 'heavy']],
  end: [[0, 'success']],
  missed: [[0, 'warning']],
};

const feelOnPhone = (what: RemoteFeel): void => {
  for (const [at, kind] of REMOTE_HAPTICS[what] ?? []) {
    if (at === 0) hapticPlay(kind); else setTimeout(() => hapticPlay(kind), at);
  }
};

/** The Mac's remote address, as its code holds it: plain http to a host and port, then the token. */
const REMOTE = /^http:\/\/[^/\s]+:\d+\/[A-Za-z0-9_-]{16,64}\/?$/;

export const isRemoteCode = (text: string): boolean => REMOTE.test(text.trim());

/** The `data:` lines of server-sent events, each event's joined; what is not ended yet is kept for the next chunk. */
export function sseData(text: string): { data: string[]; rest: string } {
  const chunks = text.split(/\r?\n\r?\n/);
  const rest = chunks.pop() ?? '';
  const data: string[] = [];
  for (const c of chunks) {
    const d = c.split(/\r?\n/).filter((l) => l.startsWith('data:')).map((l) => l.slice(5).replace(/^ /, '')).join('\n');
    if (d) data.push(d);
  }
  return { data, rest };
}

/** The remote's way to the Mac from inside the app: the stream read as it comes, opened again when it ends. */
export function appTransport(url: string, opts: { fetch?: Fetch; close?: () => void; wait?: number } = {}): RemoteTransport {
  const fetch = opts.fetch ?? httpFetch;
  const base = url.trim().replace(/\/+$/, '');
  const wait = opts.wait ?? 1500;
  return {
    listen(onView, onStatus) {
      let stopped = false;
      let controller: AbortController | null = null;
      const say = (s: RemoteStatus) => { if (!stopped) onStatus(s); };
      void (async () => {
        const decoder = new TextDecoder();
        while (!stopped) {
          try {
            controller = new AbortController();
            const res = await fetch(`${base}/events`, { headers: { accept: 'text/event-stream' }, signal: controller.signal });
            if (res.status === 404) { say('stopped'); return; }
            if (!res.ok || !res.body) throw new Error(String(res.status));
            say('on');
            const reader = res.body.getReader();
            let rest = '';
            for (;;) {
              const { value, done } = await reader.read();
              if (done || stopped) break;
              const got = sseData(rest + decoder.decode(value, { stream: true }));
              rest = got.rest;
              for (const d of got.data) {
                let v: (RemoteView & { stopped?: boolean }) | null = null;
                try { v = JSON.parse(d) as RemoteView & { stopped?: boolean }; } catch { /* not a view */ }
                if (v?.stopped) { say('stopped'); stopped = true; controller?.abort(); return; }
                if (v) onView(v);
              }
            }
          } catch { /* away: tried again */ }
          if (stopped) return;
          say('lost');
          await new Promise((r) => setTimeout(r, wait));
        }
      })();
      return () => { stopped = true; controller?.abort(); };
    },
    press(v, id) {
      return fetch(`${base}/press`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ v, id }) }).then(() => {}, () => {});
    },
    feel: feelOnPhone,
    ...(opts.close ? { close: opts.close } : {}),
  };
}

let shown: { host: HTMLElement; unmount: () => void } | null = null;

/** The controller's look, put in the app's page once (a phone's browser has it in the page it is given). */
export function styleRemote(): void {
  if (document.getElementById('rm-style')) return;
  const style = document.head.appendChild(document.createElement('style'));
  style.id = 'rm-style';
  style.textContent = REMOTE_CSS;
}

/** The remote over the app, at the Mac's address; × takes it away. */
export function showRemote(url: string, fetch?: Fetch): void {
  closeRemote();
  styleRemote();
  const host = document.body.appendChild(document.createElement('div'));
  host.className = 'rm-host';
  const unmount = mountRemote(host, appTransport(url, { ...(fetch ? { fetch } : {}), close: closeRemote }));
  shown = { host, unmount };
}

export function closeRemote(): void {
  if (!shown) return;
  shown.unmount();
  shown.host.remove();
  shown = null;
}

/** The palette's `remote for a mac`: the camera, then the remote; a code that is not the Mac's remote is said. */
export function scanRemote(): void {
  void scanCode().then((text) => {
    if (text === null) return;
    if (isRemoteCode(text)) showRemote(text);
    else notify('that is not a remote code · on the mac, open the palette and run phone as a remote');
  }, (e: unknown) => notify(e instanceof Error ? e.message : String(e)));
}
