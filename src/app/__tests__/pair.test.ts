// @vitest-environment jsdom
// Pairing by a code (milestone 84; `pair.ts`, `PairRows.tsx`): a code's text
// there and back for every kind, what is refused and in which words, the QR
// code read back by a decoder that is not the encoder's, and that the code
// reaches no log, no store and no storage of the web view's.

import jsQR from 'jsqr';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NUDGE_SERVER } from '../nudge.js';
import { BROKEN_CODE, NEWER_CODE, NOT_A_CODE, PAIR_PREFIX, QR_QUIET, decodePairing, encodePairing, pairingOf, qrMatrix, qrPath, storageOfPairing, type Pairing, type StoragePairing } from '../pair.js';
import { NO_STORAGE, saveStorage } from '../storage.js';
import { useApp } from '../store.js';
import { SYNC_OFF, saveSettings } from '../sync.js';

// every one made up
const TOKEN = 'made-up-token-7f3a9c2e51b84d06';
const SECRET = 'made-up-secret-0c5e8a1f93b7462d';
const GIT: Pairing = { kind: 'git', name: 'double-major', url: 'https://git.example.invalid/someone/double-major.git', token: TOKEN, nudge: NUDGE_SERVER };
const S3: Pairing = { kind: 's3', name: 'notes', fields: { endpoint: 'https://s3.example.invalid', bucket: 'bucket/notes', key: 'MADEUPKEY0001', secret: SECRET } };
const DAV: Pairing = { kind: 'webdav', name: 'دفتر', fields: { address: 'https://dav.example.invalid/remote.php/dav/files/someone/دفتر', user: 'someone', password: SECRET } };
const ALL: Pairing[] = [
  GIT,
  { ...GIT, nudge: 'https://ntfy.example.invalid' } as Pairing,
  { ...GIT, nudge: '' } as Pairing,
  S3,
  DAV,
  { kind: 'webdav', name: 'open', fields: { address: 'http://nas.example.invalid/dav', user: '', password: '' } },
  { kind: 'dropbox', name: 'notes', fields: { appKey: 'madeupappkey', place: 'notes' } },
  { kind: 'drive', name: 'notes', fields: { clientId: 'made-up.apps.example.invalid', clientSecret: SECRET, place: 'notes' } },
  { kind: 'folder', name: 'notes', fields: { folder: '/Volumes/nas/ilmi/notes' } },
  { kind: 'icloud', name: 'notes', fields: { place: 'notes' } },
];

const coded = (o: unknown): string => PAIR_PREFIX + btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** The squares as a picture, a few pixels a square, and what a QR reader makes of it. */
function read(side: number, dark: (r: number, c: number) => boolean, scale = 4): string | null {
  const px = (side + 2 * QR_QUIET) * scale;
  const data = new Uint8ClampedArray(px * px * 4).fill(255);
  for (let r = 0; r < side; r++) for (let c = 0; c < side; c++) {
    if (!dark(r, c)) continue;
    for (let y = 0; y < scale; y++) for (let x = 0; x < scale; x++) {
      const i = (((r + QR_QUIET) * scale + y) * px + (c + QR_QUIET) * scale + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 0;
    }
  }
  return jsQR(data, px, px)?.data ?? null;
}

/** The squares a drawn path covers: `M x y h n v1 h-n z` a run, as `qrPath` writes them. */
function squaresOf(d: string, side: number): boolean[][] {
  const grid = Array.from({ length: side }, () => Array<boolean>(side).fill(false));
  for (const m of d.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
    for (let k = 0; k < Number(m[3]); k++) grid[Number(m[2]) - QR_QUIET]![Number(m[1]) - QR_QUIET + k] = true;
  }
  return grid;
}

describe('a code\'s text', () => {
  it('there and back, for a remote and for every kind of storage', () => {
    for (const p of ALL) {
      const text = encodePairing(p);
      expect(text.startsWith('ilmi-pair:')).toBe(true);
      expect(text.slice(PAIR_PREFIX.length)).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(decodePairing(text)).toEqual(p);
      // as a scanner or a paste may hand it over
      expect(decodePairing(`  ${text}\n`)).toEqual(p);
    }
  });

  it('is versioned, and holds its kind\'s fields and nothing else', () => {
    const o = JSON.parse(atob(encodePairing(GIT).slice(PAIR_PREFIX.length).replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>;
    expect(o).toEqual({ v: 1, kind: 'git', name: 'double-major', url: (GIT as { url: string }).url, token: TOKEN });
    const s = JSON.parse(atob(encodePairing({ ...S3, fields: { ...(S3 as StoragePairing).fields, password: 'not s3\'s', account: 'a sign-in' } } as Pairing).slice(PAIR_PREFIX.length).replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>;
    expect(Object.keys(s).sort()).toEqual(['bucket', 'endpoint', 'key', 'kind', 'name', 'secret', 'v']);
  });

  it('anything else is refused in plain words that do not repeat it', () => {
    const not = [
      '', 'hello', 'https://example.invalid/', `otpauth://totp/x?secret=${SECRET}`, 'ilmi-pair:', 'ilmi-pair:!!!', 'ILMI-PAIR:abcd',
      `ilmi-pair:${btoa('not json')}`, coded([1, 2]), coded('text'), coded(null), coded({ kind: 'git', url: 'u', token: 't' }), coded({ v: 0, kind: 'git' }),
      coded({ v: '1', kind: 'git', url: 'u', token: 't' }), coded({ v: 1, kind: 'ftp', name: 'x', url: 'u' }), coded({ v: 1, kind: '__proto__', name: 'x' }),
      PAIR_PREFIX + 'A'.repeat(5000),
    ];
    for (const text of not) expect(() => decodePairing(text), text.slice(0, 40)).toThrow(NOT_A_CODE);
    expect(() => decodePairing(coded({ v: 2, kind: 'git', name: 'x', url: 'u', token: TOKEN }))).toThrow(NEWER_CODE);
    const broken = [
      coded({ v: 1, name: 'x' }), coded({ v: 1, kind: 'git', name: 'x', token: TOKEN }), coded({ v: 1, kind: 'git', name: 'x', url: '  ', token: TOKEN }),
      coded({ v: 1, kind: 'git', name: 'x', url: 'u', token: 5 }), coded({ v: 1, kind: 's3', name: 'x', endpoint: 'e', bucket: 'b', key: 'k' }),
      coded({ v: 1, kind: 's3', name: 'x', endpoint: 'e', bucket: 'b', key: 'k', secret: '' }), coded({ v: 1, kind: 'webdav', name: 'x', user: 'u', password: SECRET }),
    ];
    for (const text of broken) expect(() => decodePairing(text)).toThrow(BROKEN_CODE);
    for (const text of [...not, ...broken, coded({ v: 2, token: TOKEN })]) {
      let said = '';
      try { decodePairing(text); } catch (e) { said = (e as Error).message; }
      expect([NOT_A_CODE, NEWER_CODE, BROKEN_CODE]).toContain(said);
      expect(said).toBe(said.toLowerCase());
      expect(said.includes(SECRET) || said.includes(TOKEN) || (text.length > 12 && said.includes(text))).toBe(false);
    }
    // a token may be empty (a remote that asks for none), a name may be missing
    expect(decodePairing(coded({ v: 1, kind: 'git', url: 'https://git.example.invalid/x.git', token: '' }))).toEqual({ kind: 'git', name: 'collection', url: 'https://git.example.invalid/x.git', token: '', nudge: NUDGE_SERVER });
  });
});

describe('the code as squares', () => {
  it('is read back by a QR reader, from the matrix and from the path that is drawn', () => {
    for (const p of [GIT, S3, DAV]) {
      const text = encodePairing(p);
      const m = qrMatrix(text);
      expect(m.size).toBeGreaterThanOrEqual(21);
      expect(read(m.size, m.dark)).toBe(text);
      const grid = squaresOf(qrPath(m), m.size);
      expect(read(m.size, (r, c) => grid[r]![c]!)).toBe(text);
      expect(decodePairing(read(m.size, (r, c) => grid[r]![c]!)!)).toEqual(p);
    }
  });
});

describe('what a collection\'s code holds', () => {
  const ROOT = '/collections/pair-test';
  beforeEach(() => { localStorage.clear(); });

  it('its storage when it syncs through one, else its remote, else nothing', () => {
    expect(pairingOf(ROOT, { git: false })).toBeNull();
    saveSettings(ROOT, { url: ' https://git.example.invalid/x.git ', token: TOKEN, server: NUDGE_SERVER });
    // a remote typed but not connected is not paired from
    expect(pairingOf(ROOT, { git: false })).toBeNull();
    expect(pairingOf(ROOT, { git: true })).toEqual({ kind: 'git', name: 'pair-test', url: 'https://git.example.invalid/x.git', token: TOKEN, nudge: NUDGE_SERVER });
    saveStorage(ROOT, { ...NO_STORAGE, kind: 's3', endpoint: 'https://s3.example.invalid ', bucket: 'b', key: 'k', secret: SECRET, account: 'a sign-in', keep: 'opened', dev: 'http://127.0.0.1:1' });
    expect(pairingOf(ROOT, { git: true })?.kind).toBe('git');
    saveStorage(ROOT, { ...NO_STORAGE, on: true, kind: 's3', endpoint: 'https://s3.example.invalid ', bucket: 'b', key: 'k', secret: SECRET, account: 'a sign-in', keep: 'opened', dev: 'http://127.0.0.1:1' });
    const p = pairingOf(ROOT, { git: true })!;
    // the storage's own fields: not what this device keeps, not a sign-in, not a dev run's server
    expect(p).toEqual({ kind: 's3', name: 'pair-test', fields: { endpoint: 'https://s3.example.invalid', bucket: 'b', key: 'k', secret: SECRET } });
    expect(storageOfPairing(decodePairing(encodePairing(p)) as StoragePairing)).toEqual({ ...NO_STORAGE, kind: 's3', endpoint: 'https://s3.example.invalid', bucket: 'b', key: 'k', secret: SECRET });
  });
});

describe('the code is shown and nothing else', () => {
  const ROOT = '/collections/pair-shown';
  let host: HTMLDivElement;
  let root: Root;
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const logs = ['log', 'info', 'warn', 'error', 'debug', 'trace'] as const;
  const spies = () => logs.map((k) => vi.spyOn(console, k).mockImplementation(() => {}));
  afterEach(() => { vi.restoreAllMocks(); });

  it('encoding, decoding and refusing log nothing', () => {
    const heard = spies();
    const text = encodePairing(GIT);
    decodePairing(text);
    qrPath(qrMatrix(text));
    for (const bad of [text.slice(0, -9), `${text}%`, coded({ v: 9, token: TOKEN }), coded({ v: 1, kind: 'git', name: 'x', token: TOKEN })]) {
      try { decodePairing(bad); } catch { /* refused */ }
    }
    for (const spy of heard) expect(spy).not.toHaveBeenCalled();
  });

  it('the panel draws the code, says not to pass it on, and leaves it in no log, store or storage', async () => {
    localStorage.clear();
    saveSettings(ROOT, { url: (GIT as { url: string }).url, token: TOKEN, server: NUDGE_SERVER });
    const before = JSON.stringify(localStorage);
    useApp.setState({ vault: ROOT, mobile: false, sync: { ...SYNC_OFF, on: true, repo: true }, syncSettings: { url: (GIT as { url: string }).url, token: TOKEN, server: NUDGE_SERVER }, storage: { ...NO_STORAGE } });
    const expected = encodePairing(pairingOf(ROOT, { git: true })!);
    const heard = spies();
    const { PairCode, pairLine } = await import('../PairRows.js');
    host = document.body.appendChild(document.createElement('div'));
    root = createRoot(host);
    await act(async () => { root.render(createElement(PairCode)); });
    const svg = host.querySelector('svg.pair-qr')!;
    const side = Number(svg.getAttribute('viewBox')!.split(' ')[2]) - 2 * QR_QUIET;
    const grid = squaresOf(svg.querySelector('path')!.getAttribute('d')!, side);
    // what is on the screen is the code, and a reader reads the collection's remote and token out of it
    expect(read(side, (r, c) => grid[r]![c]!)).toBe(expected);
    expect(svg.querySelector('rect')!.getAttribute('fill')).toBe('#fff');
    const line = host.querySelector('.pair-line')!.textContent!;
    expect(line).toBe(pairLine('git'));
    expect(line).toBe(line.toLowerCase());
    expect(line).toMatch(/scan this with ilmi on the other device/);
    expect(line).toMatch(/holds the access token, so do not share or photograph it/);
    // the code's text is in no attribute and no text of the page
    expect(host.innerHTML.includes(expected) || host.innerHTML.includes(TOKEN)).toBe(false);
    // nor in the store, nor in the web view's storage beyond the settings that were already there
    expect(JSON.stringify(useApp.getState()).includes(expected)).toBe(false);
    expect(JSON.stringify(localStorage)).toBe(before);
    expect(JSON.stringify(sessionStorage).includes(PAIR_PREFIX)).toBe(false);
    for (const spy of heard) for (const call of spy.mock.calls) expect(JSON.stringify(call).includes(TOKEN) || JSON.stringify(call).includes(PAIR_PREFIX)).toBe(false);
    // closed, it is gone
    act(() => root.unmount());
    expect(host.innerHTML).toBe('');
    host.remove();
    useApp.setState({ vault: null, sync: SYNC_OFF });
  });

  it('each kind\'s line names what the code holds', async () => {
    const { pairLine } = await import('../PairRows.js');
    expect(pairLine('s3')).toMatch(/holds the secret, so do not share or photograph it/);
    expect(pairLine('webdav')).toMatch(/holds the password/);
    expect(pairLine('dropbox')).toMatch(/the other device signs in for itself/);
    expect(pairLine('folder')).toMatch(/says where this collection is kept/);
    for (const k of ['git', 's3', 'webdav', 'dropbox', 'drive', 'folder', 'icloud'] as const) expect(pairLine(k)).toBe(pairLine(k).toLowerCase());
  });
});

describe('scan a code, on a device\'s welcome', () => {
  let host: HTMLDivElement;
  let root: Root;
  const q = <T extends Element>(sel: string) => host.querySelector<T>(sel);
  const scanButton = () => Array.from(host.querySelectorAll<HTMLButtonElement>('.welcome-acts button')).find((b) => b.textContent === 'scan a code');
  const tapScan = async () => { await act(async () => { scanButton()!.click(); await new Promise((r) => setTimeout(r, 10)); }); };
  const draw = async (mobile: boolean) => {
    const { Welcome } = await import('../Welcome.js');
    useApp.setState({ vault: null, mobile, recents: [], gone: [], namingVault: false, tweaksOpen: false });
    host = document.body.appendChild(document.createElement('div'));
    root = createRoot(host);
    await act(async () => { root.render(createElement(Welcome)); });
  };
  afterEach(async () => {
    const { setDevScan } = await import('../scan.js');
    setDevScan(null);
    act(() => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  });

  it('is offered on an iPhone or an iPad, not on a mac', async () => {
    await draw(false);
    expect(scanButton()).toBeUndefined();
    act(() => root.unmount());
    host.remove();
    await draw(true);
    expect(scanButton()).toBeDefined();
  });

  it('a camera refused, something that is not a code, and a scan cancelled are said plainly or not at all, with the fields still to hand', async () => {
    const { CAMERA_OFF, setDevScan } = await import('../scan.js');
    const heard = (['log', 'info', 'warn', 'error', 'debug'] as const).map((k) => vi.spyOn(console, k).mockImplementation(() => {}));
    await draw(true);
    setDevScan(async () => { throw new Error(CAMERA_OFF); });
    await tapScan();
    expect(q('.welcome-said')!.textContent).toBe(CAMERA_OFF);
    expect(CAMERA_OFF).toBe(CAMERA_OFF.toLowerCase());
    setDevScan(async () => `otpauth://totp/someone?secret=${SECRET}`);
    await tapScan();
    expect(q('.welcome-said')!.textContent).toBe(NOT_A_CODE);
    setDevScan(async () => coded({ v: 1, kind: 's3', name: 'x', endpoint: 'e', bucket: 'b', key: 'k', secret: '' }));
    await tapScan();
    expect(q('.welcome-said')!.textContent).toBe(BROKEN_CODE);
    setDevScan(async () => null);
    await tapScan();
    expect(q('.welcome-said')).toBeNull();
    // connect and join are there throughout
    await act(async () => { host.querySelector<HTMLButtonElement>('.welcome-acts button')!.click(); });
    expect(host.querySelectorAll('.welcome-connect input').length).toBe(2);
    for (const spy of heard) for (const call of spy.mock.calls) expect(JSON.stringify(call).includes(SECRET)).toBe(false);
  });

  it('a code for a storage that is signed in to fills its fields and leaves the sign-in to press', async () => {
    const { setDevScan } = await import('../scan.js');
    await draw(true);
    setDevScan(async () => encodePairing({ kind: 'dropbox', name: 'notes', fields: { appKey: 'madeupappkey', place: 'notes' } }));
    await tapScan();
    expect(q('.welcome-join')).not.toBeNull();
    expect(q('.welcome-join .tw-seg button[data-active="1"]')!.textContent).toBe('dropbox');
    expect(Array.from(host.querySelectorAll<HTMLInputElement>('.welcome-join input')).map((i) => i.value)).toEqual(['madeupappkey', 'notes']);
    expect(q('.welcome-join .welcome-problem')!.textContent).toBe('sign in to finish, then join');
  });
});
