// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { NO_STORAGE, clientOf, configOf, signsIn, storageName, storageOf, saveStorage, storageReady } from '../storage.js';

describe('the kinds that are signed in to', () => {
  const dropbox = { ...NO_STORAGE, kind: 'dropbox' as const, appKey: ' key ', place: ' /notes/ ' };
  const drive = { ...NO_STORAGE, kind: 'drive' as const, clientId: '1-a.apps.googleusercontent.com', clientSecret: 's', place: 'notes' };

  afterEach(() => { globalThis.localStorage?.clear(); });

  it('wants a sign-in and a folder before it is ready', () => {
    expect(storageReady(dropbox)).toBe(false);
    expect(storageReady({ ...dropbox, account: 'a' })).toBe(true);
    expect(storageReady({ ...drive, account: 'a', place: '  ' })).toBe(false);
    expect(signsIn('dropbox') && signsIn('drive')).toBe(true);
    expect(signsIn('s3') || signsIn('webdav') || signsIn('folder')).toBe(false);
  });

  it('tells the Rust side which sign-in and which folder, and nothing of a client', () => {
    expect(configOf({ ...dropbox, account: 'a' })).toEqual({ kind: 'dropbox', account: 'a', folder: 'notes' });
    expect(configOf({ ...drive, account: 'a' })).toEqual({ kind: 'drive', account: 'a', folder: 'notes' });
  });

  it('reads the client of the kind, and names a collection for the folder', () => {
    expect(clientOf(dropbox)).toBe('key');
    expect(clientOf(drive)).toBe('1-a.apps.googleusercontent.com');
    expect(storageName(dropbox)).toBe('notes');
    expect(storageName({ ...drive, place: 'a/b' })).toBe('b');
  });

  it('keeps its fields with the tweaks, and an unknown kind reads as a folder', () => {
    saveStorage('/c/one', { ...drive, account: 'a' });
    expect(storageOf('/c/one')).toMatchObject({ kind: 'drive', clientId: drive.clientId, clientSecret: 's', place: 'notes', account: 'a' });
    const raw = JSON.parse(globalThis.localStorage.getItem('ilmi.storage') ?? '{}') as Record<string, { kind: string }>;
    for (const k of Object.keys(raw)) raw[k]!.kind = 'icloud';
    globalThis.localStorage.setItem('ilmi.storage', JSON.stringify(raw));
    expect(storageOf('/c/one').kind).toBe('folder');
  });
});
