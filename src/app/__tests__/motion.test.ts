// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startMotion } from '../motion.js';

const tick = () => new Promise<void>((r) => setTimeout(r, 0));
let stop: () => void;
let host: HTMLElement;

beforeEach(() => {
  document.documentElement.removeAttribute('data-still');
  document.documentElement.removeAttribute('data-theme');
  host = document.createElement('div');
  document.body.append(host);
  stop = startMotion();
});
afterEach(() => { stop(); host.remove(); vi.useRealTimers(); });

const row = (path: string) => { const r = document.createElement('div'); r.className = 'row trow'; r.dataset.path = path; r.textContent = path; return r; };

describe('what closes leaves', () => {
  it('a menu taken out of the page leaves a likeness where it was, which takes no press and has no id, and goes', async () => {
    const menu = document.createElement('div');
    menu.className = 'ctx-menu';
    menu.id = 'the-menu';
    menu.style.left = '40px';
    const after = document.createElement('p');
    host.append(menu, after);
    await tick();
    menu.remove();
    await tick();
    const g = host.querySelector<HTMLElement>('.ctx-menu')!;
    expect(g).not.toBeNull();
    expect(g).not.toBe(menu);
    expect(g.dataset.ghost).toBe('1');
    expect(g.classList.contains('m-out')).toBe(true);
    expect(g.id).toBe('');
    expect(g.style.left).toBe('40px');
    expect(g.nextElementSibling).toBe(after);
    g.dispatchEvent(new Event('animationend'));
    expect(host.querySelector('.ctx-menu')).toBeNull();
    // its going leaves nothing behind in turn
    await tick();
    expect(host.querySelector('[data-ghost]')).toBeNull();
  });

  it("a folder's rows and the sidebar's sheet close at once: no likeness of them", async () => {
    const tree = document.createElement('div');
    tree.className = 'tree';
    const rows = ['a', 'a/1', 'b'].map(row);
    tree.append(...rows);
    const side = document.createElement('div');
    side.className = 'side';
    side.dataset.sheet = '1';
    host.append(tree, side);
    await tick();
    rows[1]!.remove();
    side.remove();
    await tick();
    expect(host.querySelector('[data-ghost]')).toBeNull();
  });

  it('nothing lingers under a smoke, or on e-ink', async () => {
    for (const set of [() => { document.documentElement.dataset.still = '1'; }, () => { document.documentElement.removeAttribute('data-still'); document.documentElement.dataset.theme = 'eink'; }]) {
      set();
      const n = document.createElement('div');
      n.className = 'notice';
      host.append(n);
      await tick();
      n.remove();
      await tick();
      expect(host.querySelector('.notice')).toBeNull();
    }
  });

  it('a likeness is gone by its time even if no animation ends', async () => {
    const n = document.createElement('div');
    n.className = 'tweaks';
    host.append(n);
    await tick();
    n.remove();
    await tick();
    expect(host.querySelector('.tweaks[data-ghost]')).not.toBeNull();
    await new Promise((r) => setTimeout(r, 300));
    expect(host.querySelector('.tweaks')).toBeNull();
  });
});
