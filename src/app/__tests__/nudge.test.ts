// Milestone 54: the nudge's pure side (`src/app/nudge.ts`): the topic from
// the remote, the events off the wire, the publish, the subscription and
// its reconnect, and the strip's age.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ago, isNudge, normalizeRemote, nudgeMessage, parseSse, publishNudge, RECONNECT_MIN_MS, sha256, subscribeNudge, topicOf } from '../nudge.js';
import { syncAge, syncWord, SYNC_OFF } from '../sync.js';

describe('the topic', () => {
  it('hashes with SHA-256', () => {
    expect(sha256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
    // past one block, and multi-byte text
    expect(sha256('a'.repeat(1000))).toBe('41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3');
    expect(sha256('ʿilmī')).toBe(sha256('ʿilmī'));
  });

  it('names the topic by the remote, the same on two devices however the URL was typed', () => {
    const t = topicOf('https://github.com/me/notes.git');
    expect(t).toMatch(/^ilmi-[0-9a-f]{32}$/);
    expect(topicOf('  https://github.com/me/notes ')).toBe(t);
    expect(topicOf('https://github.com/me/notes.git/')).toBe(t);
    expect(topicOf('https://github.com/me/other.git')).not.toBe(t);
    expect(normalizeRemote('/tmp/host.git/')).toBe('/tmp/host');
    // nothing of the URL is in the topic
    expect(t).not.toContain('github');
  });
});

describe('the wire', () => {
  it('reads ntfy events out of chunks, whole or split, and leaves the rest', () => {
    const open = 'event: open\ndata: {"id":"1","time":1,"event":"open","topic":"t"}\n\n';
    const msg = 'event: message\ndata: {"id":"2","time":2,"event":"message","topic":"t","message":"changed from 0badf00d"}\n\n';
    const keep = 'event: keepalive\ndata: {"id":"3","time":3,"event":"keepalive","topic":"t"}\n\n';
    const one = parseSse(open + msg);
    expect(one.events.map((e) => e.event)).toEqual(['open', 'message']);
    expect(one.rest).toBe('');
    const cut = msg.slice(0, 40);
    const first = parseSse(open + cut);
    expect(first.events.map((e) => e.event)).toEqual(['open']);
    expect(first.rest).toBe(cut);
    const second = parseSse(first.rest + msg.slice(40) + keep);
    expect(second.events.map((e) => e.event)).toEqual(['message', 'keepalive']);
    expect(second.events[0]!.message).toBe('changed from 0badf00d');
    // CRLF, a comment line, and a line that is not JSON
    expect(parseSse(':ok\r\ndata: {"event":"message","message":"x"}\r\n\r\ndata: not json\n\n').events).toEqual([{ event: 'message', message: 'x' }]);
  });

  it('a nudge is a message from another window; ours and a keepalive are not', () => {
    expect(isNudge({ event: 'message', message: 'changed from 0badf00d' }, 'c0ffee00')).toBe(true);
    expect(isNudge({ event: 'message', message: 'changed from c0ffee00' }, 'c0ffee00')).toBe(false);
    expect(isNudge({ event: 'keepalive' }, 'c0ffee00')).toBe(false);
    expect(isNudge({ event: 'message', message: 'hello' }, 'c0ffee00')).toBe(false);
    expect(nudgeMessage('c0ffee00')).toBe('changed from c0ffee00');
  });

  it('publishes the word to the topic on the server, and is quiet when the server is not there', async () => {
    const calls: { url: string; init: RequestInit | undefined }[] = [];
    const ok = async (url: string, init?: RequestInit) => { calls.push({ url, init }); return new Response('{}', { status: 200 }); };
    expect(await publishNudge('https://ntfy.sh/', 'https://github.com/me/notes.git', ok, 'c0ffee00')).toBe(true);
    expect(calls[0]!.url).toBe(`https://ntfy.sh/${topicOf('https://github.com/me/notes')}`);
    expect(calls[0]!.init?.method).toBe('POST');
    expect(calls[0]!.init?.body).toBe('changed from c0ffee00');
    const down = async () => { throw new Error('connect'); };
    expect(await publishNudge('https://ntfy.sh', 'x', down)).toBe(false);
    expect(await publishNudge('', 'x', ok)).toBe(false);
    expect(await publishNudge('https://ntfy.sh', '', ok)).toBe(false);
    expect(calls.length).toBe(1);
  });
});

/** A server-sent stream under the test's hand: push text, end it, or fail the next connection. */
function fakeServer() {
  const enc = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  let fail = false;
  const opened: string[] = [];
  const fetch = async (url: string, init?: RequestInit): Promise<Response> => {
    opened.push(url);
    if (fail) throw new Error('connect');
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        controller = c;
        c.enqueue(enc.encode('event: open\ndata: {"event":"open"}\n\n'));
        init?.signal?.addEventListener('abort', () => { try { c.close(); } catch { /* closed */ } });
      },
    });
    return new Response(body, { status: 200 });
  };
  return {
    fetch,
    opened,
    send(text: string) { controller?.enqueue(enc.encode(text)); },
    end() { controller?.close(); controller = null; },
    down(v: boolean) { fail = v; },
  };
}

const flush = async (n = 6) => { for (let i = 0; i < n; i++) await Promise.resolve(); };

describe('the subscription', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('listens on the topic, pulls on a nudge from another window and not on its own, and stops', async () => {
    const srv = fakeServer();
    const got: string[] = [];
    const sub = subscribeNudge('https://ntfy.sh', 'https://h/r.git', (why) => got.push(why), { fetch: srv.fetch, device: 'c0ffee00', setTimeout });
    await flush();
    expect(srv.opened).toEqual([`https://ntfy.sh/${topicOf('https://h/r')}/sse`]);
    srv.send('event: message\ndata: {"event":"message","message":"changed from c0ffee00"}\n\n');
    await flush();
    expect(got).toEqual([]);
    srv.send('event: message\ndata: {"event":"message","message":"changed from 0badf00d"}\n\n');
    await flush();
    expect(got).toEqual(['nudge']);
    srv.send('event: keepalive\ndata: {"event":"keepalive"}\n\n');
    await flush();
    expect(got).toEqual(['nudge']);
    sub.stop();
    await flush();
    await vi.advanceTimersByTimeAsync(RECONNECT_MIN_MS * 4);
    expect(srv.opened.length).toBe(1);
  });

  it('reconnects after the stream ends, says so once back, and waits longer while the server is down', async () => {
    const srv = fakeServer();
    const got: string[] = [];
    const sub = subscribeNudge('https://ntfy.sh', 'https://h/r', (why) => got.push(why), { fetch: srv.fetch, device: 'c0ffee00', setTimeout });
    await flush();
    srv.end();
    await flush();
    expect(srv.opened.length).toBe(1);
    await vi.advanceTimersByTimeAsync(RECONNECT_MIN_MS);
    await flush();
    expect(srv.opened.length).toBe(2);
    expect(got).toEqual(['reconnect']);
    srv.send('event: message\ndata: {"event":"message","message":"changed from 0badf00d"}\n\n');
    await flush();
    expect(got).toEqual(['reconnect', 'nudge']);
    // the server goes away: the wait doubles each try
    srv.down(true);
    srv.end();
    await flush();
    await vi.advanceTimersByTimeAsync(RECONNECT_MIN_MS * 2);
    expect(srv.opened.length).toBe(3);
    await vi.advanceTimersByTimeAsync(RECONNECT_MIN_MS * 4);
    expect(srv.opened.length).toBe(4);
    await vi.advanceTimersByTimeAsync(RECONNECT_MIN_MS * 8);
    expect(srv.opened.length).toBe(5);
    srv.down(false);
    await vi.advanceTimersByTimeAsync(RECONNECT_MIN_MS * 16);
    expect(srv.opened.length).toBe(6);
    expect(got).toEqual(['reconnect', 'nudge', 'reconnect']);
    sub.stop();
  });

  it('does nothing without a server or a remote', async () => {
    const srv = fakeServer();
    subscribeNudge('', 'https://h/r', () => {}, { fetch: srv.fetch }).stop();
    subscribeNudge('https://ntfy.sh', '  ', () => {}, { fetch: srv.fetch }).stop();
    await flush();
    expect(srv.opened).toEqual([]);
  });
});

describe('the strip', () => {
  it('says how long ago the remote was reached, beside synced alone', () => {
    expect(ago(0)).toBe('just now');
    expect(ago(2_300)).toBe('2 s ago');
    expect(ago(59_999)).toBe('59 s ago');
    expect(ago(60_000)).toBe('1 min ago');
    expect(ago(59 * 60_000)).toBe('59 min ago');
    expect(ago(3 * 3_600_000)).toBe('3 h ago');
    expect(ago(49 * 3_600_000)).toBe('2 d ago');
    const on = { ...SYNC_OFF, on: true, repo: true, at: 10_000 };
    expect(syncWord(on)).toBe('synced');
    expect(syncAge(on, 12_000)).toBe('2 s ago');
    expect(syncAge({ ...on, at: null }, 12_000)).toBeNull();
    expect(syncAge({ ...on, toPush: 1 }, 12_000)).toBeNull();
    expect(syncAge({ ...on, busy: 'pulling' }, 12_000)).toBeNull();
    expect(syncAge({ ...on, on: false }, 12_000)).toBeNull();
  });
});
