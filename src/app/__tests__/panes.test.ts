import { describe, expect, it } from 'vitest';
import {
  activeTab, closePane, closeTab, dropTabs, emptyPanes, openTab, retarget, selectTab, splitPane,
} from '../panes.js';

const ids = (s: ReturnType<typeof emptyPanes>) => s.panes.map((p) => p.tabs.map((t) => t.id));

describe('panes', () => {
  it('opens into an empty pane, then replaces the active tab', () => {
    let s = openTab(emptyPanes(), 'a.md');
    expect(ids(s)).toEqual([['a.md']]);
    s = openTab(s, 'b.md');
    expect(ids(s)).toEqual([['b.md']]);
    expect(activeTab(s)?.id).toBe('b.md');
  });

  it('adds a tab on ⌘-click or newTab, and focuses a tab that is already open', () => {
    let s = openTab(emptyPanes(), 'a.md');
    s = openTab(s, 'b.md', { cmdClick: true });
    s = openTab(s, 'c.md', { newTab: true });
    expect(ids(s)).toEqual([['a.md', 'b.md', 'c.md']]);
    const keys = s.panes[0]!.tabs.map((t) => t.key);
    s = openTab(s, 'a.md');
    expect(ids(s)).toEqual([['a.md', 'b.md', 'c.md']]);
    expect(s.panes[0]!.active).toBe(0);
    expect(s.panes[0]!.tabs.map((t) => t.key)).toEqual(keys);
  });

  it('⌘⇧-click opens in the next pane, splitting up to three', () => {
    let s = openTab(emptyPanes(), 'a.md');
    s = openTab(s, 'b.md', { cmdClick: true, shiftClick: true });
    expect(ids(s)).toEqual([['a.md'], ['b.md']]);
    expect(s.active).toBe(1);
    s = openTab(s, 'c.md', { cmdClick: true, shiftClick: true });
    expect(ids(s)).toEqual([['a.md'], ['b.md'], ['c.md']]);
    s = openTab(s, 'd.md', { cmdClick: true, shiftClick: true });
    expect(ids(s)).toEqual([['a.md', 'd.md'], ['b.md'], ['c.md']]);
    expect(s.active).toBe(0);
  });

  it('closes tabs, keeps the active index sane, and closes an emptied pane', () => {
    let s = openTab(emptyPanes(), 'a.md');
    s = openTab(s, 'b.md', { newTab: true });
    s = openTab(s, 'c.md', { newTab: true });
    s = selectTab(s, 0, 2);
    s = closeTab(s, 0, 2);
    expect(s.panes[0]!.active).toBe(1);
    s = selectTab(s, 0, 1);
    s = closeTab(s, 0, 0);
    expect(ids(s)).toEqual([['b.md']]);
    expect(s.panes[0]!.active).toBe(0);
    s = closeTab(s, 0, 0);
    expect(ids(s)).toEqual([[]]);

    s = openTab(s, 'a.md');
    s = splitPane(s, 0);
    expect(s.panes.length).toBe(2);
    expect(s.active).toBe(1);
    s = openTab(s, 'z.md');
    s = closeTab(s, 1, 0);
    expect(ids(s)).toEqual([['a.md']]);
    expect(s.active).toBe(0);
  });

  it('splits to at most three panes and closes panes without losing the active one', () => {
    let s = splitPane(splitPane(splitPane(emptyPanes(), 0), 1), 2);
    expect(s.panes.length).toBe(3);
    s = { ...s, active: 2 };
    s = closePane(s, 0);
    expect(s.panes.length).toBe(2);
    expect(s.active).toBe(1);
    s = closePane(s, 1);
    expect(s.active).toBe(0);
    expect(closePane(s, 0)).toBe(s);
  });

  it('follows a rename or move and closes on delete', () => {
    let s = openTab(emptyPanes(), 'papers/wozniak-1990.md');
    s = openTab(s, 'papers/wozniak-1990/woz-ex1.md', { newTab: true });
    s = openTab(s, 'papers/crick-1995.md', { newTab: true });
    const keys = s.panes[0]!.tabs.map((t) => t.key);
    s = retarget(s, 'papers/wozniak-1990.md', 'papers/woz.md');
    expect(ids(s)).toEqual([['papers/woz.md', 'papers/woz/woz-ex1.md', 'papers/crick-1995.md']]);
    expect(s.panes[0]!.tabs.map((t) => t.key)).toEqual(keys);
    s = retarget(s, 'papers', 'articles');
    expect(ids(s)).toEqual([['articles/woz.md', 'articles/woz/woz-ex1.md', 'articles/crick-1995.md']]);
    expect(retarget(s, 'books', 'shelf')).toBe(s);
    s = dropTabs(s, 'articles/woz.md');
    expect(ids(s)).toEqual([['articles/crick-1995.md']]);
    s = dropTabs(s, 'articles');
    expect(ids(s)).toEqual([[]]);
  });
});
