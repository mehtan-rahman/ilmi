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
import './fonts.css';
import './tokens.css';
import { App } from './App.js';
import { Fell } from './Fell.js';
import { exposeConsole } from './store.js';
import { installComposing } from './compose.js';

exposeConsole();

// dev: renderer errors reach the terminal, since the window's console may not
if (import.meta.env.DEV) {
  void import('@tauri-apps/plugin-log').then(({ error }) => {
    window.addEventListener('error', (e) => void error(`renderer: ${e.message}`));
    window.addEventListener('unhandledrejection', (e) => void error(`renderer: ${String(e.reason)}`));
  });
}

// a promise nobody caught is still something that did not happen: say so, in a release build too
// a word being composed (an input method, a dead key): its keys never reach the app's handlers
installComposing();
window.addEventListener('unhandledrejection', (e) => {
  const why = e.reason instanceof Error ? e.reason.message : String(e.reason);
  console.error(e.reason);
  void import('./land.js').then(({ notify }) => notify(`something went wrong · ${why}`));
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Fell>
      <App />
    </Fell>
  </StrictMode>,
);
