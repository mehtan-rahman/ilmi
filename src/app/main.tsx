import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource-variable/source-serif-4';
import '@fontsource-variable/source-serif-4/wght-italic.css';
import '@fontsource-variable/literata';
import './tokens.css';
import { App } from './App.js';
import { exposeConsole } from './store.js';

exposeConsole();

// dev: renderer errors reach the terminal, since the window's console may not
if (import.meta.env.DEV) {
  void import('@tauri-apps/plugin-log').then(({ error }) => {
    window.addEventListener('error', (e) => void error(`renderer: ${e.message}`));
    window.addEventListener('unhandledrejection', (e) => void error(`renderer: ${String(e.reason)}`));
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
