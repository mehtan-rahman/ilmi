// A lens's view of one document: read through the vault's cache, refreshed
// when the vault reports the file changed, re-keyed when it moves.

import { useEffect, useState } from 'react';
import type { Loaded } from '../vault/index.js';
import { currentVault } from './vault.js';

export function useDoc(path: string): Loaded | null {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  useEffect(() => {
    const vault = currentVault();
    if (!vault) return;
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
