import { useEffect } from 'react';
import { useApp } from './store.js';
import { openInitialVault, pickVault } from './vault.js';
import './app.css';

// Until the sidebar tree (milestone 4): a button to open a vault, then a plain
// list of its documents.
export function App() {
  const theme = useApp((s) => s.theme);
  const rho = useApp((s) => s.density);
  const vault = useApp((s) => s.vault);
  const files = useApp((s) => s.files);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.style.setProperty('--rho', String(rho));
  }, [theme, rho]);

  useEffect(() => {
    openInitialVault().catch((e: unknown) => console.error(e));
  }, []);

  return (
    <div className="shell">
      <main className="files">
        {vault === null ? (
          <button className="open" type="button" onClick={() => void pickVault().catch(console.error)}>
            Open vault
          </button>
        ) : (
          <ul>
            {files.map((f) => (
              <li key={f}>{f.slice(0, -3)}</li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
