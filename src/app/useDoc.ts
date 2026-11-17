// A lens's view of one document: read through the vault's cache, refreshed
// when the vault reports the file changed, re-keyed when it moves.

import { useEffect, useState } from 'react';
import type { Loaded } from '../vault/index.js';
import { currentVault } from './vault.js';

/** `path` null: nothing is read (a lens that has no document to show). */
export function useDoc(path: string | null): Loaded | null {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  useEffect(() => {
    const vault = currentVault();
    if (!vault || path === null) { setLoaded(null); return; }
    let live = true;
    vault.read(path).then((l) => { if (live) setLoaded(l); }, () => { if (live) setLoaded(null); });
    const off = vault.subscribe((ev) => {
      if (ev.kind === 'doc' && ev.path === path) setLoaded(ev.loaded);
      else if (ev.kind === 'gone' && ev.path === path) setLoaded(null);
    });
    return () => {
      live = false;
      off();
    };
  }, [path]);
  return loaded;
}

/** Several documents, loaded and kept current: each of `paths` that is there, by its path. */
export function useDocs(paths: readonly string[]): ReadonlyMap<string, Loaded> {
  const [loaded, setLoaded] = useState<ReadonlyMap<string, Loaded>>(() => new Map());
  const key = paths.join('\n');
  useEffect(() => {
    const vault = currentVault();
    const want = key === '' ? [] : key.split('\n');
    if (!vault || !want.length) { setLoaded((m) => (m.size ? new Map() : m)); return; }
    let live = true;
    const put = (path: string, l: Loaded | null) => setLoaded((m) => {
      const next = new Map([...m].filter(([p]) => want.includes(p) && p !== path));
      if (l) next.set(path, l);
      return next;
    });
    for (const path of want) vault.read(path).then((l) => { if (live) put(path, l); }, () => { if (live) put(path, null); });
    const off = vault.subscribe((ev) => {
      if (!('path' in ev) || !want.includes(ev.path)) return;
      if (ev.kind === 'doc') put(ev.path, ev.loaded);
      else if (ev.kind === 'gone') put(ev.path, null);
    });
    return () => {
      live = false;
      off();
    };
  }, [key]);
  return loaded;
}
