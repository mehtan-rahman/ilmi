// @vitest-environment jsdom
// A sweep over the shapes, the themes, narrow windows, the keyboard and what
// a failure tells the user (2026-11-15). Each test states what should hold;
// the ones that fail name a finding of the audit. The stylesheets are held
// to rules by reading them, as `pass.test.ts` does.

import { promises as fsp, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { nodeFs } from '../../vault/node-fs.js';
import { Vault } from '../../vault/index.js';
import { useApp } from '../store.js';

const APP = join(import.meta.dirname, '..');
const css = (name: string) => readFileSync(join(APP, name), 'utf8');
const src = (name: string) => readFileSync(join(APP, name), 'utf8');
/** The body of the first rule whose selector is exactly `selector`. */
const rule = (sheet: string, selector: string): string | null => {
  const at = sheet.split('\n').findIndex((l) => l.trim() === `${selector} {` || l.trim().startsWith(`${selector} { `));
  if (at < 0) return null;
  const rest = sheet.split('\n').slice(at).join('\n');
  return rest.slice(rest.indexOf('{') + 1, rest.indexOf('}'));
};

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | null = null;
let host: HTMLDivElement | null = null;
const draw = async (el: ReturnType<typeof createElement>) => {
  host = document.body.appendChild(document.createElement('div'));
  root = createRoot(host);
  await act(async () => { root!.render(el); });
};
afterEach(async () => {
  if (root) await act(async () => { root!.unmount(); });
  host?.remove();
  root = null; host = null;
  useApp.setState({ paletteOpen: false, tweaksOpen: false });
});

describe('the tweaks panel on the Mac and an iPad', () => {
  it('scrolls inside the window instead of running off its top', () => {
    // fixed at bottom: 36px with a dozen rows, then the mirror, sync, storage and plugins: taller than an 820 px window
    const body = rule(css('chrome.css'), '.tweaks');
    expect(body).not.toBeNull();
    expect(body).toMatch(/max-height\s*:/);
    expect(body).toMatch(/overflow(-y)?\s*:\s*auto/);
  });

  it('names its close button for a screen reader', async () => {
    const { Tweaks } = await import('../Tweaks.js');
    useApp.setState({ tweaksOpen: true });
    await draw(createElement(Tweaks));
    const x = document.querySelector('.tweaks .tw-x');
    expect(x).not.toBeNull();
    expect(x!.getAttribute('aria-label') ?? x!.getAttribute('title')).toBeTruthy();
  });
});

describe('a narrow window on the Mac', () => {
  it('keeps where sync stands (offline, n conflicts) in the top strip under 1000 px', () => {
    // `n conflicts` is the only way to the conflicted files; half a 13-inch screen is ~750 px
    const sheet = css('chrome.css');
    const hidesAll = /@media \(max-width: 1000px\)\s*\{\s*\.top \.right\s*\{\s*display:\s*none;?\s*\}\s*\}/.test(sheet);
    expect(hidesAll).toBe(false);
  });
});

describe('the themes', () => {
  it('draws a done task\'s tick in an ink that shows on the dark theme\'s light gold', () => {
    // dark's accent is oklch(0.80 …): a white tick on it is ~1.6:1
    const sheet = css('reader.css');
    const checked = rule(sheet, '.draft-doc .li-task[data-checked="1"]') ?? '';
    const whiteTick = /stroke='white'/.test(checked);
    const darkOverride = /\[data-theme="dark"\] \.draft-doc \.li-task\[data-checked="1"\]/.test(sheet);
    expect(!whiteTick || darkOverride).toBe(true);
  });

  it('never marks a focused field with a border fainter than its resting one', () => {
    // these fields drop the outline; `--accent-soft` is 18% gold (14% ink in e-ink) where the resting hairline is 30–48% ink in e-ink
    const offenders: string[] = [];
    for (const f of readdirSync(APP).filter((n) => n.endsWith('.css'))) {
      css(f).split('\n').forEach((l, i) => {
        if (/:focus[^{]*\{[^}]*border(-bottom)?-color:\s*var\(--accent-soft\)/.test(l)) offenders.push(`${f}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});

describe('the palette', () => {
  it('keeps the focus on Tab (nothing else in it takes focus; behind it nothing answers keys)', async () => {
    const { Palette } = await import('../Palette.js');
    useApp.setState({ paletteOpen: true });
    await draw(createElement(Palette));
    const input = document.querySelector<HTMLInputElement>('.palette-input input');
    expect(input).not.toBeNull();
    const e = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    await act(async () => { input!.dispatchEvent(e); });
    expect(e.defaultPrevented).toBe(true);
  });
});

describe('a failure reaches the user', () => {
  it('has a handler for an unhandled rejection in a release build, not only under DEV', () => {
    const main = src('main.tsx');
    const outsideDev = main.replace(/if \(import\.meta\.env\.DEV\) \{[\s\S]*?\n\}\n/, '');
    const others = readdirSync(APP).filter((n) => /\.tsx?$/.test(n) && n !== 'main.tsx' && n !== 'smoke.ts').map(src).join('\n');
    expect(/unhandledrejection/.test(outsideDev) || /unhandledrejection/.test(others)).toBe(true);
  });

  it('says why a rename did not happen (a sibling has the name), not only to the console', async () => {
    // the premise: the vault refuses, with words worth showing
    const dir = await fsp.mkdtemp(join(tmpdir(), 'ilmi-sweep-'));
    try {
      await fsp.writeFile(join(dir, 'one.md'), '# one\n\ntext\n');
      await fsp.writeFile(join(dir, 'two.md'), '# two\n\ntext\n');
      const vault = await Vault.open(nodeFs, dir);
      await expect(vault.rename('one.md', 'two')).rejects.toThrow(/already exists/);
    } finally {
      await fsp.rm(dir, { recursive: true, force: true });
    }
    // what the tree, the rail, the row menus, the deck and a grade do with it
    const silent = ['Tree.tsx', 'Rail.tsx', 'NodeMenu.tsx', 'DeckBrowser.tsx', 'Session.tsx']
      .filter((f) => /const fail = \(e: unknown\) => console\.error\(e\);/.test(src(f)));
    expect(silent).toEqual([]);
  });

  it('leaves no user action in the inspector failing to the console alone', () => {
    const n = (src('Inspector.tsx').match(/\.catch\(console\.error\)/g) ?? []).length;
    expect(n).toBe(0);
  });
});
