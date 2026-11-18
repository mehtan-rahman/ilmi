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

  it("a folder's rows fold shut in their order, under the row that stays, with no path left on them", async () => {
    const tree = document.createElement('div');
    tree.className = 'tree';
    const rows = ['a', 'a/1', 'a/2', 'a/3', 'b'].map(row);
    tree.append(...rows);
    host.append(tree);
    await tick();
    rows[1]!.remove(); rows[2]!.remove(); rows[3]!.remove();
    await tick();
    const all = Array.from(tree.children) as HTMLElement[];
    expect(all.map((r) => r.textContent)).toEqual(['a', 'a/1', 'a/2', 'a/3', 'b']);
    expect(all.map((r) => r.dataset.ghost ?? '')).toEqual(['', '1', '1', '1', '']);
    expect(all.slice(1, 4).every((r) => r.classList.contains('m-row-out') && r.dataset.path === undefined)).toBe(true);
    expect(tree.querySelectorAll('[data-path]').length).toBe(2);
  });

  it('a row drawn again in another place has not gone, and a great many gone at once are not a folder closed', async () => {
    const tree = document.createElement('div');
    tree.className = 'tree';
    const a = row('a');
    const b = row('b');
    tree.append(a, b);
    host.append(tree);
    await tick();
    a.remove();
    tree.append(row('a'));
    await tick();
    expect(tree.querySelector('[data-ghost]')).toBeNull();
    const many = Array.from({ length: 120 }, (_, i) => row(`m/${i}`));
    tree.append(...many);
    await tick();
    for (const m of many) m.remove();
    await tick();
    expect(tree.querySelector('[data-ghost]')).toBeNull();
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
    await new Promise((r) => setTimeout(r, 340));
    expect(host.querySelector('.tweaks')).toBeNull();
  });
});
