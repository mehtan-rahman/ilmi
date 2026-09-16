import { useEffect } from 'react';
import { useApp } from './store.js';

// Empty shell. Milestone 2 puts the vault's file list here.
export function App() {
  const theme = useApp((s) => s.theme);
  const rho = useApp((s) => s.density);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.style.setProperty('--rho', String(rho));
  }, [theme, rho]);

  return <div className="shell" />;
}
