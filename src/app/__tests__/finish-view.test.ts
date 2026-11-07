// @vitest-environment jsdom
// Milestone 52: the inspector's `finish by` field. A day ahead is written as
// it is picked, a year half typed is not, empty on leaving clears, escape
// puts back what was there.

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DayField } from '../Inspector.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
async function mount(value: string | undefined, onCommit: (d: string | null) => void) {
  host = document.body.appendChild(document.createElement('div'));
  root = createRoot(host);
  await act(async () => { root.render(createElement(DayField, { value, today: '2026-11-03', onCommit })); });
  return host.querySelector<HTMLInputElement>('.day-field')!;
}
const type = (el: HTMLInputElement, v: string) => act(async () => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
const leave = (el: HTMLInputElement) => act(async () => { el.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); });
afterEach(() => { act(() => root.unmount()); host.remove(); });

describe('the finish by field', () => {
  it('a day ahead is written as it is picked, once', async () => {
    const commit = vi.fn();
    const el = await mount(undefined, commit);
    expect(el.value).toBe('');
    await type(el, '2026-11-24');
    expect(commit).toHaveBeenCalledExactlyOnceWith('2026-11-24');
  });

  it('a year half typed waits; empty on leaving clears', async () => {
    const commit = vi.fn();
    const el = await mount('2026-11-24', commit);
    expect(el.value).toBe('2026-11-24');
    await type(el, '0202-11-24');
    expect(commit).not.toHaveBeenCalled();
    await type(el, '');
    expect(commit).not.toHaveBeenCalled();
    await leave(el);
    expect(commit).toHaveBeenCalledExactlyOnceWith(null);
  });

  it('a day past is written on leaving; nothing changed writes nothing; escape puts it back', async () => {
    const commit = vi.fn();
    const el = await mount('2026-11-24', commit);
    await leave(el);
    expect(commit).not.toHaveBeenCalled();
    await type(el, '2026-10-01');
    await act(async () => { el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(el.value).toBe('2026-11-24');
    await leave(el);
    expect(commit).not.toHaveBeenCalled();
    await type(el, '2026-10-01');
    await leave(el);
    expect(commit).toHaveBeenCalledExactlyOnceWith('2026-10-01');
  });
});
