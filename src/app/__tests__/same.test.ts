// Milestone 45: the same fact twice. The finder's text (folded, math
// normalized), its precision and recall on the sample collection's known
// pairs and on random pairs, its speed, and the pairs it leaves out.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse, type Doc } from '../../format/index.js';
import { SAME_THRESHOLD, cardFaces, features, findSame, normalizeMath, pairKey, sameCards, similarPairs, type SameCard } from '../same.js';

const SAMPLE = join(import.meta.dirname, '../../../samples/double-major');
const CORPUS = join(import.meta.dirname, '../../format/__tests__/corpus/vault');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    if (name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith('.md')) out.push(p);
  }
  return out;
}

const docsIn = (root: string, prefix = ''): [string, Doc][] =>
  walk(root).map((p) => [`${prefix}${relative(root, p)}`, parse(readFileSync(p, 'utf8')).doc]);

const sample = docsIn(SAMPLE);
const cards = sameCards(sample);

/** A card by its id, or by its file and the start of its text (a card with no id). */
function key(ref: string): string {
  const [path, start] = ref.split('::: ');
  const hit = start === undefined ? cards.find((c) => c.id === ref) : cards.find((c) => c.path === path && c.text.startsWith(start));
  if (!hit) throw new Error(`no card ${ref}`);
  return hit.key;
}
const pair = ([a, b]: readonly [string, string]) => pairKey(key(a), key(b));

/**
 * The stat-mech pairs (PLAN 45's notes): read off the course notes, the
 * Lindqvist textbook and its extracts, and the derivation drills. Each asks
 * the same thing and is answered the same, on separate schedules.
 */
const STAT_MECH: [string, string][] = [
  ['sm-F-lnZ', 'lq3-F-lnZ'],                         // the same cloze, typed twice
  ['sm-einstein-omega', 'lq2-einstein-omega'],       // the multiplicity of an Einstein solid
  ['sm-peak-width', 'lq2-peak-width'],               // the width of the multiplicity peak
  ['sm-def-T', 'lq2-def-T'],                         // 1/T, a cloze in the notes, a q&a in the book
  ['sm-equip-fail', 'lq3-equip-cond'],               // when equipartition fails / applies
  ['sm-classical-criterion', 'lq4-nQ'],              // a gas is classical when nλ³ ≪ 1, n ≪ n_Q
  ['sm-degeneracy', 'lq-ex-boltz-system-omega'],     // P(E) = g(E)e^{-βE}/Z
  ['sm-dv-equip', 'dr-equip'],                       // the equipartition derivation, course and drill
  ['sm-dv-fermi', 'dr-fermi'],                       // the Fermi energy derivation, course and drill
];

/** The same fact twice elsewhere in the collection: the Arabic courses and the vocab deck, mechanics, quantum. */
const ELSEWHERE: [string, string][] = [
  ['voc-idha-ghamarta', 'ab-ghamarta'], ['voc-ala-qadri', 'ab-ala-qadri'], ['voc-al-khaylu', 'ab-al-khayl'],
  ['voc-halla', 'rd-halla'], ['voc-bala', 'rd-bala'], ['voc-awdaa', 'rd-awdaa-objects'], ['voc-form-x', 'sf-x-meaning'],
  ['nh-fpl-nasb', 'nh-fpl-kasra'], ['nh-ashadd', 'sf-ashaddu'], ['rd-turahu', 'rd-tura-vs-tara'],
  ['cm-dof', 'courses/fall-2025/phys-301-classical-mechanics/lagrangian-mechanics.md::: dof ::'],
  ['cm-el', 'dr-el'], ['cm-hameqs', 'dr-hamilton'], ['qm1-dyson', 'fl-dyson'], ['qm5-golden', 'dr-golden'],
];

/**
 * Overlapping, not the same: a formula and its derivation, a verse's
 * completion and its meter, a word and the sentence it was met in. Worth
 * reading in the list (a link or a merge is the person's call), not counted
 * as found or as false.
 */
const OVERLAP: [string, string][] = [
  ['ab-drill-qifa', 'ab-qifa'], ['ab-al-khayl', 'ab-drill-khayl'], ['voc-al-khaylu', 'ab-drill-khayl'],
  ['sm-sigmaE', 'lq3-fluct-scaling'], ['sm-sigmaE', 'sm-dv-fluct'], ['qm1-e2', 'dr-pt1'], ['qm1-e1', 'dr-pt1'],
  ['qm2-rel', 'qmps5-jlower'], ['rt-form-vi', 'sf-tamarada'], ['voc-ariyya', 'rd-ariyya'], ['lq2-peak-width', 'lq-ex-sharp-width'],
  ['voc-istakhdama', 'sf-x-passive'], ['sm-boltzmann-P', 'sm-dv-boltzmann'], ['sm-P-from-F', 'dr-maxwellrel'],
  ['sm-equip-fail', 'sm-dv-equip'], ['sm-why-expand-S', 'sm-dv-boltzmann'], ['sm-dv-schottky', 'lq-ex-schottky-cosh'],
  ['nh-fpl-nasb', 'nh-hal-fpl'], ['sm-boltzmann-P', 'sm-gibbs-factor'], ['qmps7-ho', 'qm4-valid'], ['nh-dr-kulla', 'nh-mm-kulla'],
  ['sm-dv-para-micro', 'sm-para-M'], ['rt-nawahin', 'voc-nahiya'], ['sm-dv-sackur', 'sm-sackur-tetrode'], ['sm-dv-einstein', 'lq3-dulong-petit'],
];

/** Asked alike, about different things: never listed. */
const APART: [string, string][] = [
  ['rt-form-vi', 'rt-form-vii'], ['rt-krm', 'rt-shrf'], ['rt-ilm', 'rt-byn'], ['dr-me', 'dr-mp'], ['ab-tawil', 'ab-wafir'],
  ['qm2-good', 'qmmt-sign'], ['nh-ishrin', 'nh-dr-thalathata'], ['lq2-mixing', 'dr-freeexp'],
];

describe('the text the finder reads', () => {
  it('normalizes math: delimiters, spacing, sizing, synonyms, fractions, groupings', () => {
    const same = (a: string, b: string) => expect(normalizeMath(a), `${a} ~ ${b}`).toBe(normalizeMath(b));
    same('$\\left(\\frac{\\partial S}{\\partial U}\\right)_{N,V}$', '$(\\partial S/\\partial U)_{N,V}$');
    same('$-kT \\ln Z$', '$-kT\\ln Z$');
    same('$\\tfrac12 kT$', '$\\frac{1}{2}kT$');
    same('$\\dfrac{x^2}{4}$', '$\\frac{x^{2}}{4}$');
    same('$C = Nk\\,x$', '$C=Nk x$');
    same('$a \\le b \\quad c$', '$a\\leq b c$');
    same('$\\mathrm{d}x$', '$dx$');
    same('ħω', '$\\hbar\\omega$');
    expect(normalizeMath('$\\partial_\\beta$')).not.toBe(normalizeMath('$\\partial\\beta$'));
  });

  it('folds case, accents, Arabic marks and the tatweel', () => {
    const keys = (s: string) => [...features(s).keys()].sort();
    expect(keys('Lücke Café')).toEqual(keys('lucke CAFE'));
    expect(keys('الكِتَابُ')).toEqual(keys('الكتاب'));
    expect(keys('الكـــتاب')).toEqual(keys('الكتاب'));
    expect(keys('oscillators sharing units')).toEqual(keys('oscillator shares unit'));
  });

  it('reads a cloze as its text without the answers and its answers, and the whole with the answers in place', () => {
    expect(cardFaces('$$\nF = {{c1::-kT \\ln Z}}\n$$')).toEqual({ front: '$$\nF =  \n$$', back: '$-kT \\ln Z$', whole: '$$\nF = -kT \\ln Z\n$$', cloze: true });
    expect(cardFaces('the {{c1::kasra}} and {{c2::the fatha}}')?.back).toBe('kasra ; the fatha');
    expect(cardFaces('a :: b')).toEqual({ front: 'a', back: 'b', whole: 'a\nb', cloze: false });
    expect(cardFaces('not a card')).toBeNull();
  });
});

describe('the sample collection', () => {
  const t0 = performance.now();
  const listed = findSame(cards);
  const ms = performance.now() - t0;
  const keys = new Set(listed.map((p) => pairKey(p.a.key, p.b.key)));
  const same = new Set([...STAT_MECH, ...ELSEWHERE].map(pair));
  const overlap = new Set(OVERLAP.map(pair));

  it('finds eight of the nine stat-mech pairs (the ninth says the same thing in other words)', () => {
    const found = STAT_MECH.filter((p) => keys.has(pair(p)));
    expect(found.length).toBe(8);
    expect(STAT_MECH.filter((p) => !keys.has(pair(p)))).toEqual([['sm-classical-criterion', 'lq4-nQ']]);
    // the clearest first
    expect(pairKey(listed[0]!.a.key, listed[0]!.b.key)).toBe(pair(['sm-F-lnZ', 'lq3-F-lnZ']));
  });

  it('lists nothing that is neither the same fact nor an overlapping one: precision on what it lists', () => {
    const stray = listed.filter((p) => !same.has(pairKey(p.a.key, p.b.key)) && !overlap.has(pairKey(p.a.key, p.b.key)));
    expect(stray.map((p) => `${p.a.key} ~ ${p.b.key} ${p.score.toFixed(3)}`)).toEqual([]);
    const strict = listed.filter((p) => same.has(pairKey(p.a.key, p.b.key))).length;
    // 20 of 43 listed are the same fact, the other 23 overlap (a formula and its derivation, a verse and its meter);
    // two overlapping pairs fell out when 49 moved the Lindqvist extracts into their chapters' notes: the peak-width
    // pair now sits in one document, where its shared words read as that document's own, and the Einstein pair's
    // score fell with the chapter's larger set of cards
    expect([strict, listed.length]).toEqual([20, 43]);
  });

  it('recall over the collection: twenty of the twenty-four known pairs', () => {
    const all = [...STAT_MECH, ...ELSEWHERE];
    expect(all.filter((p) => keys.has(pair(p))).length).toBe(20);
  });

  it('never lists pairs asked alike about different things', () => {
    for (const p of APART) expect(keys.has(pair(p)), p.join(' ~ ')).toBe(false);
  });

  it('lists none of 5000 random pairs (outside the labelled ones)', () => {
    let seed = 45;
    const rand = () => { seed = (seed * 1103515245 + 12345) % 2 ** 31; return seed / 2 ** 31; };
    let tried = 0;
    let hits = 0;
    while (tried < 5000) {
      const a = cards[Math.floor(rand() * cards.length)]!;
      const b = cards[Math.floor(rand() * cards.length)]!;
      const k = pairKey(a.key, b.key);
      if (a === b || same.has(k) || overlap.has(k)) continue;
      tried++;
      if (keys.has(k)) hits++;
    }
    expect(hits).toBe(0);
  });

  it('is fast enough over a thousand cards: the token index prunes the pairs', () => {
    expect(cards.length).toBe(758);
    // the sample, the corpus, and a quarter of the sample again under another folder: over a thousand
    const more: [string, Doc][] = [...sample, ...docsIn(CORPUS, 'corpus/'), ...sample.slice(0, 20).map(([p, d]): [string, Doc] => [`copy/${p}`, d])];
    const big = sameCards(more);
    expect(big.length).toBeGreaterThan(1000);
    const t = performance.now();
    const found = findSame(big);
    const took = performance.now() - t;
    // the copies are found as the same cards
    expect(found.filter((p) => p.score > 0.99).length).toBeGreaterThan(100);
    expect(ms).toBeLessThan(2000);
    expect(took).toBeLessThan(3000);
  });

  it('leaves out the pairs said not the same, and the pairs already linked to each other', () => {
    const k = pair(['sm-F-lnZ', 'lq3-F-lnZ']);
    expect(similarPairs(cards, [k]).some((p) => pairKey(p.a.key, p.b.key) === k)).toBe(false);
    const linked: SameCard[] = cards.map((c) => (c.id === 'sm-F-lnZ' ? { ...c, link: 'lq3-F-lnZ' } : c));
    expect(similarPairs(linked, []).some((p) => pairKey(p.a.key, p.b.key) === k)).toBe(false);
    expect(similarPairs(cards, []).length).toBe(listed.length);
    expect(SAME_THRESHOLD).toBe(0.35);
  });

  it('keys a card by its id, by path and id when two files share it, by path and text when it has none', () => {
    const card = 'why is entropy additive :: multiplicities multiply ^same';
    const twice = sameCards([['a.md', parse(`${card}\n\nno id :: here\n`).doc], ['b.md', parse(`${card}\n\nthe kasra :: a vowel ^solo\n`).doc]]);
    expect(twice.map((c) => c.key)).toEqual(['a.md#same', expect.stringMatching(/^a\.md#[0-9a-z]+$/), 'b.md#same', 'solo']);
    // a duplicated document's cards are the same cards
    expect(findSame(twice).map((p) => [p.a.key, p.b.key])).toEqual([['a.md#same', 'b.md#same']]);
  });
});
