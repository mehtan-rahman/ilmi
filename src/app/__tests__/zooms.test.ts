// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { cleanZooms } from '../vault.js';
import { emptyPanes, openTab, openTwin, openWhereBeside } from '../panes.js';

describe('a book\'s zoom, kept with the collection\'s view state', () => {
  it('only a zoom past fit is kept; anything else read from the file is dropped', () => {
    expect(cleanZooms({ 'a.pdf': 1.5, 'b.pdf': 1, 'c.pdf': 'big', 'd.pdf': 40, 'e.pdf': 3, 'f.pdf': 0.75, 'g.pdf': 0 })).toEqual({ 'a.pdf': 1.5, 'e.pdf': 3, 'f.pdf': 0.75 });
    expect(cleanZooms(null)).toEqual({});
    expect(cleanZooms([1.5])).toEqual({});
  });
});

describe('the pane beside shows another book for a portal into it', () => {
  it('the other book is a tab in front where the twin is, the active pane kept; the twin in front again when asked', () => {
    let p = openTab(emptyPanes(), 'a.pdf');
    p = openTwin(p, 'a.pdf');
    expect(p.panes.length).toBe(2);
    const away = openWhereBeside(p, 'a.pdf', 'b.pdf');
    expect(away.active).toBe(p.active);
    const beside = away.panes[1 - away.active]!;
    expect(beside.tabs.map((t) => t.id)).toEqual(['a.pdf', 'b.pdf']);
    expect(beside.tabs[beside.active]!.id).toBe('b.pdf');
    const back = openWhereBeside(away, 'a.pdf', 'a.pdf');
    const again = back.panes[1 - back.active]!;
    expect(again.tabs.map((t) => t.id)).toEqual(['a.pdf', 'b.pdf']);
    expect(again.tabs[again.active]!.id).toBe('a.pdf');
  });
  it('with no pane beside holding the book, nothing changes', () => {
    const p = openTab(emptyPanes(), 'a.pdf');
    expect(openWhereBeside(p, 'a.pdf', 'b.pdf')).toBe(p);
  });
});
