// @vitest-environment jsdom
// A card edited in place: an edit of each face (one write, the card's lines
// only, its id and schedule kept), the three form switches with their
// schedule rules (the bare line kept, group lines whose blank is gone
// dropped, asking when they carry reviews), the editor's cancel and save
// over live fields, and a new card at the cursor's place.

import { promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cardForm, parse, serialize, type Card } from '../../format/index.js';
import { nodeFs } from '../../vault/node-fs.js';
import { Vault } from '../../vault/index.js';
import { BLANK_MARK, applyEdit, asks, facesOf, facesText, insertCard, planEdit, switchForm, withPri } from '../cardEdit.js';
import { deckRows, type CardRef } from '../deck.js';
import { CardEditor } from '../DeckBrowser.js';

const CORPUS = join(import.meta.dirname, '../../format/__tests__/corpus/vault');
const DECK = 'german.md';
const PSET = 'courses/linear-algebra/problem-set-1.md';
const NOW = new Date('2026-05-27T12:00:00');

let root: string;
let vault: Vault;

beforeEach(async () => {
  root = await fsp.mkdtemp(join(tmpdir(), 'ilmi-edit-'));
  await fsp.cp(CORPUS, root, { recursive: true });
  vault = await Vault.open(nodeFs, root);
});

afterEach(async () => {
  vault.close();
  await fsp.rm(root, { recursive: true, force: true });
});

const readDisk = (rel: string) => fsp.readFile(join(root, rel), 'utf8');
const refTo = async (path: string, id: string): Promise<CardRef> => {
  const r = deckRows([[path, (await vault.read(path)).doc]], NOW).find((x) => x.id === id)!;
  return { path, block: r.block, id, text: r.text };
};
const cardIn = async (path: string, id: string) => (await vault.read(path, true)).doc.blocks.find((b): b is Card => b.kind === 'card' && b.id === id)!;
function changedLines(a: string, b: string): number[] {
  const la = a.split('\n');
  const lb = b.split('\n');
  expect(lb.length).toBe(la.length);
  return la.flatMap((l, i) => (l === lb[i] ? [] : [i + 1]));
}

describe('the faces', () => {
  it('reads and writes each form', () => {
    expect(facesOf('der Vorsatz ::: resolution')).toEqual({ form: 'bidir', front: 'der Vorsatz', back: 'resolution' });
    expect(facesOf('what? :: this')).toEqual({ form: 'qa', front: 'what?', back: 'this' });
    expect(facesOf('a {{c1::b}} c')).toEqual({ form: 'cloze', front: 'a {{c1::b}} c', back: '' });
    expect(facesOf('prose')).toBeNull();
    expect(facesText({ form: 'qa', front: 'q', back: 'a' })).toBe('q :: a');
    expect(facesText({ form: 'bidir', front: 'l', back: 'r' })).toBe('l ::: r');
    expect(facesText({ form: 'qa', front: 'two\nlines', back: 'a' })).toBe('two\nlines\n?\na');
    // a face left empty, or a cloze with no blank, is no card
    expect(facesText({ form: 'qa', front: 'q', back: '' })).toBeNull();
    expect(facesText({ form: 'cloze', front: 'no blank here', back: '' })).toBeNull();
  });
});

describe('an edit of each face', () => {
  it('the front: one write, the card text line only, id and schedule kept', async () => {
    const before = await readDisk(DECK);
    const ref = await refTo(DECK, 'cv-vergessen');
    const spy = vi.spyOn(vault, 'update');
    await vault.update(DECK, (d) => { applyEdit(d, ref, 'vergessen (verb) ::: to forget', null, 50); });
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
    const after = await readDisk(DECK);
    const lines = changedLines(before, after);
    expect(lines).toHaveLength(1);
    expect(after.split('\n')[lines[0]! - 1]).toBe('vergessen (verb) ::: to forget ^cv-vergessen');
    expect((await cardIn(DECK, 'cv-vergessen')).sched).toMatchObject({ due: '2026-06-02', reps: 5 });
  });

  it('the back, and the priority on the bare line', async () => {
    const before = await readDisk(DECK);
    const ref = await refTo(DECK, 'cv-gedacht');
    await vault.update(DECK, (d) => { applyEdit(d, ref, 'das Gedächtnis ::: memory; the faculty of keeping', 20, 50); });
    const after = await readDisk(DECK);
    expect(changedLines(before, after)).toHaveLength(2);
    expect(after).toContain('das Gedächtnis ::: memory; the faculty of keeping ^cv-gedacht\n<!-- sr due=2026-06-09 st=review s=14 d=3.4 r=7 l=0 ivl=14 last=2026-05-26T07:30:00Z g=3 pri=20 -->');
    // the document's own priority is no priority of the card's
    const c = structuredClone(await cardIn(DECK, 'cv-gedacht'));
    withPri(c, 50, 50);
    expect(c.sched?.pri).toBeUndefined();
    const fresh: Card = { kind: 'card', text: 'a :: b', sched: { pri: 10 } };
    withPri(fresh, null, 50);
    expect(fresh.sched).toBeUndefined();
  });

  it('a cloze edited, its blanks kept, a group line kept while its blank is', async () => {
    const card = await cardIn(PSET, 'la-rank');
    const kept = planEdit(card, 'the {{c1::rank}} of a matrix $A$ is the dimension of its {{c2::column space}}');
    expect(kept.dropped).toEqual([]);
    expect(Object.keys(kept.card.blanks ?? {})).toEqual(['1', '2']);
    const one = planEdit(card, 'the {{c1::rank}} of a matrix');
    expect(one.dropped).toEqual([{ n: 2, reps: 2 }]);
    expect(asks(one)).toBe(true);
    expect(Object.keys(one.card.blanks ?? {})).toEqual(['1']);
  });

  it('throws for a card that is gone', async () => {
    const ref = await refTo(DECK, 'cv-wdh');
    await vault.update(DECK, (d) => { d.blocks = d.blocks.filter((b) => !(b.kind === 'card' && b.id === 'cv-wdh')); });
    await expect(vault.update(DECK, (d) => { applyEdit(d, ref, 'x ::: y', null, 50); })).rejects.toThrow(/not found/);
  });
});

describe('the form switch', () => {
  it('q&a ⇄ both ways: the faces stay, the separator changes, the bare line stays', async () => {
    const qa = switchForm({ form: 'bidir', front: 'die Lücke', back: 'gap; blank' }, 'qa');
    expect(qa).toEqual({ form: 'qa', front: 'die Lücke', back: 'gap; blank' });
    expect(facesText(qa)).toBe('die Lücke :: gap; blank');
    expect(switchForm(qa, 'bidir')).toEqual({ form: 'bidir', front: 'die Lücke', back: 'gap; blank' });
    const ref = await refTo(DECK, 'cv-luecke');
    await vault.update(DECK, (d) => { applyEdit(d, ref, facesText(qa)!, null, 50); });
    const c = await cardIn(DECK, 'cv-luecke');
    expect(cardForm(c.text)).toBe('qa');
    expect(c.sched).toMatchObject({ state: 'relearning', lapses: 4, steps: 1 });
  });

  it('both ways to q&a drops the reverse line, asking when it was reviewed; q&a to both ways starts the reverse new', async () => {
    const ref = await refTo(DECK, 'cv-vorsatz');
    const card = await cardIn(DECK, 'cv-vorsatz');
    expect(card.reverse?.reps).toBe(2);
    const plan = planEdit(card, 'der Vorsatz :: resolution; intention');
    expect(plan.dropped).toEqual([{ n: 0, reps: 2, reverse: true }]);
    expect(asks(plan)).toBe(true);
    expect(plan.card.reverse).toBeUndefined();
    expect(plan.card.sched).toEqual(card.sched);
    // an edit that stays both ways keeps both lines
    expect(planEdit(card, 'der Vorsatz ::: resolution').card.reverse).toEqual(card.reverse);
    const before = await readDisk(DECK);
    await vault.update(DECK, (d) => { applyEdit(d, ref, 'der Vorsatz :: resolution; intention', null, 50); });
    const after = await readDisk(DECK);
    expect(after.split('\n').length).toBe(before.split('\n').length - 1);
    expect(after).not.toContain('<!-- sr r ');
    // and back: the forward's line as it was, no reverse line until the reverse is graded
    await vault.update(DECK, (d) => { applyEdit(d, ref, 'der Vorsatz ::: resolution; intention', null, 50); });
    const back = await cardIn(DECK, 'cv-vorsatz');
    expect([back.sched, back.reverse]).toEqual([card.sched, undefined]);
  });

  it('q&a to cloze: the back as {{c1::…}} after the front, the bare line kept', async () => {
    const cloze = switchForm({ form: 'qa', front: 'the capital of France is', back: 'Paris' }, 'cloze');
    expect(cloze).toEqual({ form: 'cloze', front: 'the capital of France is {{c1::Paris}}', back: '' });
    const ref = await refTo(DECK, 'cv-vorsatz');
    const to = switchForm(facesOf(ref.text)!, 'cloze');
    expect(to.front).toBe('der Vorsatz {{c1::resolution; intention}}');
    await vault.update(DECK, (d) => { applyEdit(d, ref, facesText(to)!, null, 50); });
    const text = await readDisk(DECK);
    expect(text).toContain('der Vorsatz {{c1::resolution; intention}} ^cv-vorsatz\n<!-- sr due=2026-05-27 st=review s=3 d=5 r=4 l=1 ivl=3 last=2026-05-24T07:30:00Z g=2 -->');
  });

  it('cloze to q&a: the first answer as the back, the blank shown on the front; group lines dropped, asking', async () => {
    const card = await cardIn(PSET, 'la-rank');
    const faces = switchForm(facesOf(card.text)!, 'qa');
    expect(faces).toEqual({ form: 'qa', front: `the ${BLANK_MARK} of a matrix is the dimension of its column space`, back: 'rank' });
    const text = facesText(faces)!;
    expect(cardForm(text)).toBe('qa');
    const plan = planEdit(card, text);
    // no bare line to keep: the lowest group's line becomes it, the other is dropped, with its reviews (so the editor asks)
    expect(plan.card.sched).toMatchObject({ due: '2026-09-22', reps: 2 });
    expect(plan.card.sched?.suspended).toBeUndefined();
    expect(plan.card.blanks).toBeUndefined();
    expect(plan.dropped).toEqual([{ n: 2, reps: 2 }]);
    expect(asks(plan)).toBe(true);
    // a card with a bare line keeps it and drops every group line
    const both: Card = { kind: 'card', text: '{{c1::a}} {{c2::b}}', id: 'x', sched: { due: '2026-01-01', reps: 3 }, blanks: { 1: { due: '2026-02-01' }, 2: { due: '2026-03-01' } } };
    const p2 = planEdit(both, 'q :: a');
    expect(p2.card.sched).toEqual({ due: '2026-01-01', reps: 3 });
    expect(p2.card.blanks).toBeUndefined();
    expect(p2.dropped).toEqual([{ n: 1, reps: 0 }, { n: 2, reps: 0 }]);
    expect(asks(p2)).toBe(false);
    // and to both ways the same, with `:::`
    expect(facesText(switchForm(facesOf('{{c1::Hund}} ist ein Tier')!, 'bidir'))).toBe(`${BLANK_MARK} ist ein Tier ::: Hund`);
    // written: one card, its id kept
    const ref = await refTo(PSET, 'la-rank');
    await vault.update(PSET, (d) => { applyEdit(d, ref, text, null, 50); });
    const out = await readDisk(PSET);
    expect(out).toContain(`the ${BLANK_MARK} of a matrix is the dimension of its column space :: rank ^la-rank\n<!-- sr due=2026-09-22 st=review s=12 d=4 r=2 l=0 ivl=12 last=2026-09-10T09:00:00Z g=3 -->\n`);
    expect(out).not.toContain('sr c2');
    expect(parse(out).diagnostics).toEqual([]);
  });
});

describe('a new card at the cursor', () => {
  it('lands after the cursor row, else at the end', async () => {
    const after = await refTo(DECK, 'cv-wdh');
    let at = -1;
    await vault.update(DECK, (d) => { at = insertCard(d, after, 'die Pause ::: break', 20); });
    expect(at).toBe(2);
    const blocks = (await vault.read(DECK, true)).doc.blocks;
    expect(blocks[2]).toEqual({ kind: 'card', text: 'die Pause ::: break', sched: { pri: 20 } });
    expect(blocks[1]).toMatchObject({ id: 'cv-wdh' });
    expect(await readDisk(DECK)).toContain('<!-- sr due=2026-05-27 st=review s=8 d=3.6 r=6 l=0 ivl=8 last=2026-05-19T07:30:00Z g=3 -->\n\ndie Pause ::: break\n<!-- sr pri=20 -->\n\ndas Gedächtnis');
    await vault.update(DECK, (d) => { at = insertCard(d, null, 'das Ende ::: the end'); });
    const end = (await vault.read(DECK, true)).doc.blocks;
    expect(at).toBe(end.length - 1);
    expect(serialize((await vault.read(DECK)).doc).endsWith('das Ende ::: the end\n')).toBe(true);
  });
});

// ── the editor, drawn ────────────────────────────────────────────

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('the editor', () => {
  let host: HTMLDivElement;
  let r: Root;
  const mount = async (props: Parameters<typeof CardEditor>[0]) => {
    host = document.createElement('div');
    document.body.appendChild(host);
    r = createRoot(host);
    await act(async () => { r.render(createElement(CardEditor, props)); });
  };
  afterEach(() => { act(() => r.unmount()); host.remove(); });
  const key = (k: string, init: KeyboardEventInit = {}) => act(() => {
    (host.querySelector('.deck-edit .ProseMirror') ?? host.querySelector('.deck-edit'))!.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }));
  });

  it('draws both faces live, math as a chip; Escape cancels and writes nothing', async () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    await mount({ card: { kind: 'card', text: 'the area of a circle :: $\\pi r^2$', id: 'x' }, initial: facesOf('the area of a circle :: $\\pi r^2$')!, pri: 50, onSave, onCancel });
    const faces = host.querySelectorAll('.deck-edit .face .ProseMirror');
    expect(faces).toHaveLength(2);
    expect(faces[0]!.textContent).toBe('the area of a circle');
    expect(faces[1]!.querySelector('.math')?.getAttribute('data-tex')).toBe('$\\pi r^2$');
    await key('Escape');
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('⌘⏎ saves; the switch rewrites the faces; a reviewed blank asks before it goes', async () => {
    const onSave = vi.fn();
    const card: Card = { kind: 'card', text: '{{c1::a}} and {{c2::b}}', id: 'y', blanks: { 1: { reps: 2 }, 2: { reps: 3 } } };
    await mount({ card, initial: facesOf(card.text)!, pri: 50, onSave, onCancel: () => {} });
    expect(host.querySelectorAll('.deck-edit .face')).toHaveLength(1);
    await key('Enter', { metaKey: true });
    expect(onSave).toHaveBeenCalledWith('{{c1::a}} and {{c2::b}}', 50, false);
    onSave.mockClear();
    const qaBtn = Array.from(host.querySelectorAll<HTMLElement>('.type-toggle button')).find((b) => b.textContent?.startsWith('q&a'))!;
    await act(() => { qaBtn.click(); });
    const faces = host.querySelectorAll('.deck-edit .face .ProseMirror');
    expect(Array.from(faces).map((f) => f.textContent)).toEqual([`${BLANK_MARK} and b`, 'a']);
    await key('Enter', { metaKey: true });
    expect(onSave).not.toHaveBeenCalled();
    expect(host.querySelector('.de-ask')?.textContent).toBe('drops the schedule of blank 2 (3 reviews)');
    await key('Enter', { metaKey: true });
    expect(onSave).toHaveBeenCalledWith(`${BLANK_MARK} and b :: a`, 50, false);
  });

  it('a press outside saves', async () => {
    const onSave = vi.fn();
    await mount({ initial: { form: 'qa', front: 'q', back: 'a' }, pri: 40, onSave, onCancel: () => {} });
    await act(() => { document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
    expect(onSave).toHaveBeenCalledWith('q :: a', 40, false);
  });
});
