// @vitest-environment jsdom
// Milestone 49, from 48's window check: a notice is about the document in
// front of you. It closes when the active tab changes (the `clipped · p. 1`
// notice from the Arabic page stayed up over the next session's bar) and
// sits above the session bar while a session is on.

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyPanes, openTab } from '../panes.js';
import { useApp } from '../store.js';

vi.mock('../vault.js', async (orig) => ({ ...(await orig<typeof import('../vault.js')>()), openNode: vi.fn() }));
const { Notice } = await import('../Notice.js');
const { notify } = await import('../land.js');
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
async function mount() {
  host = document.body.appendChild(document.createElement('div'));
  root = createRoot(host);
  await act(async () => { root.render(createElement(Notice)); });
}
afterEach(() => { act(() => root.unmount()); host.remove(); useApp.setState({ notice: null, sessionEl: null, panes: emptyPanes() }); });

describe('the notice and the tab it came up on', () => {
  it('stays while the tab stays, and closes when another tab is shown', async () => {
    await act(async () => { useApp.setState({ panes: openTab(emptyPanes(), 'a.md') }); });
    await mount();
    await act(async () => { notify('clipped · p. 1'); });
    expect(host.querySelector('.notice .nl')?.textContent).toBe('clipped · p. 1');
    // the same tab re-set: nothing happens
    await act(async () => { useApp.setState({ panes: openTab(useApp.getState().panes, 'a.md') }); });
    expect(host.querySelector('.notice')).not.toBeNull();
    await act(async () => { useApp.setState({ panes: openTab(useApp.getState().panes, 'b.md') }); });
    expect(host.querySelector('.notice')).toBeNull();
    expect(useApp.getState().notice).toBeNull();
  });

  it('a notice shown as a tab opens is the new tab\'s, and stays', async () => {
    await act(async () => { useApp.setState({ panes: openTab(emptyPanes(), 'a.md') }); });
    await mount();
    await act(async () => { useApp.setState({ panes: openTab(useApp.getState().panes, 'b.md') }); notify('placed · 3 chapters in x'); });
    expect(host.querySelector('.notice .nl')?.textContent).toBe('placed · 3 chapters in x');
  });

  it('in a session it says so, to sit above the bar', async () => {
    await mount();
    await act(async () => { notify('§ x · back in 3d'); });
    expect(host.querySelector('.notice')?.getAttribute('data-session')).toBe('0');
    await act(async () => { useApp.setState({ sessionEl: { kind: 'read', label: 'x', item: { kind: 'read', path: 'a.md' } as never } }); });
    expect(host.querySelector('.notice')?.getAttribute('data-session')).toBe('1');
  });
});
