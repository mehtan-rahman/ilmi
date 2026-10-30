// @vitest-environment jsdom
// Milestone 33: what you write is a note. The reader's keys (bare letters
// type in editable text; ⌘⇧E and ⌘⇧M carve and card there), the strip's
// hints that follow them, and a note's row in the queue.

import { describe, expect, it } from 'vitest';
import { parse } from '../../format/index.js';
import { docItems } from '../../schedule/index.js';
import { hintsFor } from '../chrome.js';
import { kindTag } from '../items.js';
import { GLYPH, kindOf } from '../names.js';
import { readerAction } from '../Reader.js';

const ev = (key: string, mods: Partial<Record<'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey', boolean>> = {}) =>
  ({ key, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...mods });

describe('the reader\'s keys', () => {
  it('bare e, m, r act only where the text is not being edited', () => {
    expect(readerAction(ev('e'), false)).toBe('extract');
    expect(readerAction(ev('m'), false)).toBe('card');
    expect(readerAction(ev('r'), false)).toBe('enrol');
    // in editable text they are letters
    for (const k of ['e', 'm', 'r']) expect(readerAction(ev(k), true)).toBeNull();
    expect(readerAction(ev('E', { shiftKey: true }), false)).toBeNull();
    expect(readerAction(ev('x'), false)).toBeNull();
  });

  it('⌘⇧E extracts and ⌘⇧M cards, in editable text or not; ⌥ letters are not keys', () => {
    expect(readerAction(ev('E', { metaKey: true, shiftKey: true }), true)).toBe('extract');
    expect(readerAction(ev('m', { metaKey: true, shiftKey: true }), true)).toBe('card');
    expect(readerAction(ev('M', { ctrlKey: true, shiftKey: true }), false)).toBe('card');
    expect(readerAction(ev('e', { metaKey: true }), true)).toBeNull();
    expect(readerAction(ev('´', { altKey: true }), false)).toBeNull();
    expect(readerAction(ev('E', { metaKey: true, shiftKey: true, altKey: true }), true)).toBeNull();
    expect(readerAction(ev('R', { metaKey: true, shiftKey: true }), true)).toBeNull();
  });

  it('the strip names the keys the page has: letters when frozen, ⌘⇧ when editable', () => {
    const keys = (c: Parameters<typeof hintsFor>[0]) => hintsFor(c).map(([k, w]) => `${k} ${w}`);
    expect(keys({ kind: 'note', el: null, scope: null, canEnrol: true })).toEqual(['⌘⇧E extract', '⌘⇧M card', 'r revisit', '⌘F find', '⌘\\ split pane']);
    expect(keys({ kind: 'source', el: null, scope: null, canEnrol: true, frozen: true })).toEqual(['e extract', 'm card', 'r start reading', '⌘F find', '⌘\\ split pane']);
    expect(keys({ kind: 'draft', el: null, scope: null, canEnrol: false })).toEqual(['⌘⇧M card', '⌘F find', 'esc leave the text']);
    expect(keys({ kind: 'session', el: 'read', scope: null, canEnrol: false, note: true })).toEqual(['⏎ went over it', 'p postpone', 'd done', '⌘⇧E extract', '⌘⇧M card', '[ ] prev / next']);
    expect(keys({ kind: 'session', el: 'read', scope: null, canEnrol: false, frozen: true })[3]).toBe('e extract');
  });
});

describe('a note', () => {
  it('is what a typeless file is, with its own glyph', () => {
    expect(kindOf('n.md', {})).toBe('note');
    expect(kindOf('n.md', { 'n.md': { type: 'source', frozen: true, cards: 0, due: 0 } })).toBe('source');
    expect(GLYPH.note).not.toBe(GLYPH.source);
  });

  it('revisited, is a NOTE row in the queue, from the top', () => {
    const now = new Date('2026-10-30T09:00:00');
    const note = parse('---\nread: due=2026-10-30 ivl=3 reps=1\n---\n\n## first\n\ntop of the note\n\nlater on\n').doc;
    const [item] = docItems('n.md', note, now);
    expect(item && kindTag(item)).toBe('note');
    expect(item).toMatchObject({ kind: 'read', pos: 0, next: 'first' });
    const src = parse('---\ntype: source\nread: due=2026-10-30 ivl=3 reps=1 pos=2\n---\n\na\n\nb\n\nc\n').doc;
    const [read] = docItems('s.md', src, now);
    expect(read && kindTag(read)).toBe('read');
    expect(read).toMatchObject({ pos: 2, next: 'c' });
  });
});
