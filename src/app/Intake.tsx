// The intake: how a raw article, a text file, or a page enters the vault and
// becomes a source. After the prototype's ingest.jsx: no upload chrome. You
// paste or drop, name it, choose where it lives, and it lands frozen and
// unread. Nothing is scheduled; it waits until you open it.
//
// A dropped file arrives through Tauri's drag-drop event with a path (the
// webview's own drop event carries no files under Tauri); dragged text still
// comes through the DOM. A pasted address is fetched through the http plugin.
//
// Text that reads as a list of cards (`src/import/cards.ts` finds at least
// two) gets a delimiter row and lands as a deck instead; an Anki text export
// is read by its header. A dropped `.apkg` is read on the Rust side and its
// decks listed; each lands as a deck file with its progress
// (`src/import/anki.ts`).

import { getCurrentWebview, type DragDropEvent } from '@tauri-apps/api/webview';
import { open as pickFile } from '@tauri-apps/plugin-dialog';
import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent } from 'react';
import {
  CARD_KINDS, CARD_LABEL, SIDE_KINDS, SIDE_LABEL, cleanText, deckDoc, deckLabel, deriveTitle, detect, droppedLabel, isUrl, leftoverLines,
  mapPackage, splitCards, stats, titleFromFileName, toCards, type CardDelim, type Delims, type Mapped, type SideDelim,
} from '../import/index.js';
import { NEW_NAMES } from '../vault/index.js';
import { CardText } from './CardText.js';
import { APKG_EXT, PDF_EXT, fetchReadable, readAnkiPackage, readDropped, readDroppedPdf } from './fetch.js';
import { folderPaths, titleOf } from './names.js';
import type { OpenOpts } from './panes.js';
import { pdfText } from './pdfjs.js';
import { useApp } from './store.js';
import { importAnkiNode, importDeckNode, importNode, importPdfNode, note as notice } from './vault.js';

/** A PDF waiting on the intake: it lands as the pair, the text beside it as the fallback body. */
interface PendingPdf {
  bytes: Uint8Array;
  pages: number;
}

/** Dev only: the smoke drops a file on the intake through here, since the OS drop cannot be faked. */
export const intakeHooks: { ingestFile?: (path: string) => Promise<void> } = {};

/** Extensions the picker offers: what a drop would take. */
const PICK_EXT = ['txt', 'md', 'markdown', 'text', 'csv', 'tsv', 'html', 'htm', 'pdf', 'apkg'];

/** The default name of a deck landed from text. */
const DECK_NAME = 'cards';

/** How an Anki header's separator is named in the row. */
const SEP_NAME: Record<string, string> = { '\t': 'tab', ',': 'comma', ';': 'semicolon', ' ': 'space', '|': 'pipe', ':': 'colon' };

export const INTAKE_SAMPLE = `Spaced repetition and the economics of attention

Every review you schedule is a small wager against forgetting. The wager has a cost — the minutes spent — and a payoff that compounds: each successful recall pushes the next due date further out, so a few well-timed reviews buy years of retention for the price of an afternoon.

The mistake most learners make is to treat the wager as free. They review everything, constantly, and confuse the warm feeling of familiarity with the harder fact of retrieval. Familiarity is cheap. Retrieval is the thing that lasts, and it is only trained by the discomfort of nearly forgetting and then not quite forgetting.

A good system spends your attention the way a careful gardener spends water: not evenly, but where the curve is about to cross the floor.`;

interface Props {
  active: boolean;
  onOpen(path: string, opts: OpenOpts): void;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function Intake({ active, onOpen }: Props) {
  const tree = useApp((s) => s.tree);
  const docs = useApp((s) => s.docs);
  const root = useApp((s) => s.vault);
  const intakeDir = useApp((s) => s.intakeDir);
  const [raw, setRaw] = useState('');
  const [title, setTitle] = useState('');
  const [folder, setFolder] = useState(intakeDir);
  const [drag, setDrag] = useState(false);
  /** One quiet line under the field: what is happening, or what went wrong. */
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [pdf, setPdf] = useState<PendingPdf | null>(null);
  /** An Anki package waiting on the intake: its decks, listed where the text would be. */
  const [anki, setAnki] = useState<Mapped | null>(null);
  /** The delimiters the user chose over the detected ones; `null` follows detection. */
  const [delims, setDelims] = useState<Delims | null>(null);
  const [both, setBoth] = useState(false);
  /** The user's say on whether the text is cards; `null` leaves it to detection. */
  const [asCards, setAsCards] = useState<boolean | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  // what the drop listener, subscribed once, needs to read at the time of the drop
  const titleRef = useRef(title);
  titleRef.current = title;

  const folders = folderPaths(tree);
  const text = raw.trim();
  const st = stats(text);

  // cards: detected over the text, the row's choice over that, an Anki header over both
  const detected = useMemo(() => (text && !pdf && !anki ? detect(text) : null), [text, pdf, anki]);
  const cardsMode = !!detected && (asCards ?? detected.cards >= 2);
  const used: Delims | null = detected ? (detected.anki ? detected.delims : delims ?? detected.delims) : null;
  const split = useMemo(() => (cardsMode && used ? splitCards(text, used) : null), [cardsMode, used, text]);
  const deck = useMemo(() => (split ? toCards(split, both) : null), [split, both]);
  const dropped = split ? droppedLabel(split.dropped) : '';
  const ankiDropped = anki ? droppedLabel(anki.dropped, [[anki.dropped.schedules, 'schedule'], [anki.dropped.notes, 'empty note']]) : '';
  const ankiCards = anki ? anki.decks.reduce((n, d) => n + d.cards, 0) : 0;

  // a PDF lands even without a text layer: it opens as pages, nothing to select
  const can = (anki ? anki.decks.length > 0 : deck ? deck.cards.length > 0 : st.words > 0 || !!pdf) && !busy;
  const titleShown = title || (cardsMode ? DECK_NAME : deriveTitle(raw));
  const setSide = (side: SideDelim) => { if (used) setDelims({ ...used, side }); };
  const setCard = (card: CardDelim) => { if (used) setDelims({ ...used, card }); };
  const customOf = (d: SideDelim | CardDelim) => (typeof d === 'object' ? d.custom : '');

  // the folder follows where the intake was opened from, and stays a real one
  useEffect(() => { setFolder(intakeDir); }, [intakeDir]);
  const chosen = folders.includes(folder) ? folder : folders.find((f) => f !== '') ?? '';

  useEffect(() => { if (active) taRef.current?.focus(); }, [active]);

  const fail = (e: unknown, fallback: string) => {
    const msg = e instanceof Error ? e.message : String(e);
    setNote(msg === 'not a text file' || msg === 'nothing readable' || msg === 'no cards in that package' ? msg : fallback);
  };

  const fresh = () => {
    setDelims(null);
    setBoth(false);
    setAsCards(null);
  };

  const take = (body: string, name?: string, pages: PendingPdf | null = null) => {
    setRaw(cleanText(body));
    setPdf(pages);
    setAnki(null);
    setNote('');
    fresh();
    if (name && !titleRef.current) setTitle(name);
  };

  const fetchUrl = async (url: string) => {
    setNote('fetching');
    try {
      const r = await fetchReadable(url.trim());
      take(r.text, r.title);
    } catch (e) {
      fail(e, 'nothing readable at that link');
    }
  };

  /** Text from anywhere: an address is fetched, anything else is the text itself. */
  const ingestText = (body: string, name?: string) => {
    if (isUrl(body)) void fetchUrl(body);
    else take(body, name);
  };

  const ingestFile = async (path: string) => {
    try {
      if (APKG_EXT.test(path)) {
        setNote('reading');
        const m = mapPackage(await readAnkiPackage(path));
        if (!m.decks.length) throw new Error('no cards in that package');
        setRaw('');
        setPdf(null);
        setAnki(m);
        setNote('');
        fresh();
        return;
      }
      if (PDF_EXT.test(path)) {
        setNote('reading');
        const r = await readDroppedPdf(path);
        take(r.text, r.title, { bytes: r.bytes, pages: r.pages });
        return;
      }
      const r = await readDropped(path);
      take(r.text, r.title);
    } catch (e) {
      fail(e, 'could not read that file');
    }
  };

  const pick = async () => {
    const path = await pickFile({ multiple: false, directory: false, filters: [{ name: 'text, pdf, or anki', extensions: PICK_EXT }] });
    if (typeof path === 'string') await ingestFile(path);
  };

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    intakeHooks.ingestFile = ingestFile;
    return () => { delete intakeHooks.ingestFile; };
  });

  // a pasted address into an empty field is fetched; pasted text is just text
  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    if (raw.trim()) return;
    const t = e.clipboardData.getData('text/plain');
    if (isUrl(t)) {
      e.preventDefault();
      void fetchUrl(t);
    }
  };

  // drops: files through Tauri (with a position, so only a drop on this panel counts), text through the DOM
  useEffect(() => {
    let off: (() => void) | null = null;
    let gone = false;
    const here = (pos: { x: number; y: number }) => {
      const k = window.devicePixelRatio || 1;
      const el = document.elementFromPoint(pos.x / k, pos.y / k);
      return !!el && !!wrapRef.current?.contains(el);
    };
    const on = (ev: DragDropEvent) => {
      if (ev.type === 'leave') setDrag(false);
      else if (ev.type === 'drop') {
        setDrag(false);
        if (ev.paths[0] && here(ev.position)) void ingestFile(ev.paths[0]);
      } else setDrag(here(ev.position));
    };
    getCurrentWebview().onDragDropEvent((e) => on(e.payload)).then(
      (fn) => { if (gone) fn(); else off = fn; },
      () => { /* not under Tauri: the DOM handlers below still take dragged text */ },
    );
    return () => { gone = true; off?.(); };
  }, []);

  const onDrop = async (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const dt = e.dataTransfer;
    const file = dt.files[0];
    if (file) {
      // a package needs the Rust side; outside Tauri the drop arrives here with no path
      if (APKG_EXT.test(file.name)) { setNote('could not read that file'); return; }
      try {
        if (PDF_EXT.test(file.name)) {
          const bytes = new Uint8Array(await file.arrayBuffer());
          const r = await pdfText(bytes);
          take(r.text, r.title || titleFromFileName(file.name.replace(PDF_EXT, '')), { bytes, pages: r.pages });
        } else take(await file.text(), file.name.replace(/\.[^.]+$/, ''));
      } catch { setNote('could not read that file'); }
      return;
    }
    const t = dt.getData('text/plain');
    if (t) ingestText(t);
  };

  const place = async (open: boolean) => {
    if (!can) return;
    setBusy(true);
    try {
      if (anki) {
        const paths = await importAnkiNode(chosen, anki.decks);
        for (const d of anki.decks) notice(`placed · ${plural(d.cards, 'card')} in ${d.title}`);
        setAnki(null);
        setNote('');
        if (open && paths[0]) onOpen(paths[0], {});
        return;
      }
      const title = (titleShown || (deck ? DECK_NAME : NEW_NAMES.source)).trim();
      const path = deck
        ? await importDeckNode(chosen, { title, doc: deckDoc(deck.cards, deck.leftovers) })
        : pdf
          ? await importPdfNode(chosen, { title, bytes: pdf.bytes, text: raw })
          : await importNode(chosen, { title, text: raw });
      setRaw('');
      setPdf(null);
      setTitle('');
      setNote('');
      fresh();
      if (open) onOpen(path, {});
    } catch (e) {
      fail(e, 'could not write the file');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      ref={wrapRef}
      className={`reader-wrap intake-wrap${drag ? ' dragging' : ''}`}
      onDragOver={(e) => { e.preventDefault(); if (!drag) setDrag(true); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDrag(false); }}
      onDrop={(e) => void onDrop(e)}
    >
      <div className="reader intake">
        <div className="meta">
          <span className="crumb">intake</span>
        </div>
        <h1>{anki ? (anki.decks.length === 1 ? 'Add a deck' : 'Add decks') : cardsMode ? 'Add a deck' : 'Add a source'}</h1>

        {anki ? (
          <div className="deck-list">
            {anki.decks.map((d) => (
              <div key={d.name} className="deck-row">
                <span className="dname">{deckLabel(d)}</span>
                <span className="dcount">{plural(d.cards, 'card')}{d.scheduled > 0 && `, ${d.scheduled} scheduled`}</span>
              </div>
            ))}
          </div>
        ) : (
        <div className="paste-field">
          <textarea
            ref={taRef}
            value={raw}
            spellCheck={false}
            onChange={(e) => { setRaw(e.target.value); if (!e.target.value.trim() && !pdf?.pages) setPdf(null); if (note) setNote(''); }}
            onPaste={onPaste}
            placeholder={pdf ? 'no text' : 'paste text or a link'}
          />
          {!raw && !pdf && (
            <div className="paste-hint">
              {note ? (
                <span className="note">{note}</span>
              ) : (
                <span>or drop a <span className="mono">.txt</span> / <span className="mono">.md</span> / <span className="mono">.pdf</span> / <span className="mono">.apkg</span> file</span>
              )}
              <button type="button" className="link" onClick={() => void pick().catch((e: unknown) => fail(e, 'could not read that file'))}>pick a file →</button>
              <button type="button" className="link" onClick={() => ingestText(INTAKE_SAMPLE)}>use a sample →</button>
            </div>
          )}
        </div>
        )}

        {(st.words > 0 || pdf || anki) && (
          <div className="intake-detail">
            {anki && (
              <div className="stats">
                <span><b>{ankiCards.toLocaleString()}</b> {ankiCards === 1 ? 'card' : 'cards'} in {plural(anki.decks.length, 'deck')}</span>
                {anki.empty > 0 && (
                  <>
                    <span className="dot" />
                    <span>{plural(anki.empty, 'empty deck')} skipped</span>
                  </>
                )}
                {anki.other > 0 && (
                  <>
                    <span className="dot" />
                    <span>{anki.other} from other notetypes</span>
                  </>
                )}
                {ankiDropped && (
                  <>
                    <span className="dot" />
                    <span>{ankiDropped}</span>
                  </>
                )}
                <button type="button" className="link" onClick={() => setAnki(null)}>not this →</button>
              </div>
            )}
            {!deck && !anki && (
              <div className="stats">
                {pdf ? <span><b>{pdf.pages.toLocaleString()}</b> {pdf.pages === 1 ? 'page' : 'pages'}</span> : <span><b>{st.words.toLocaleString()}</b> words</span>}
                <span className="dot" />
                {pdf && st.words === 0 ? <span>no text</span> : pdf ? <span>{st.words.toLocaleString()} words</span> : <span>{plural(st.paragraphs, 'paragraph')}</span>}
                {st.words > 0 && (
                  <>
                    <span className="dot" />
                    <span>~{st.minutes} min</span>
                  </>
                )}
                {detected && <button type="button" className="link" onClick={() => setAsCards(true)}>as cards →</button>}
              </div>
            )}

            {deck && split && used && (
              <>
                <div className="delim-row">
                  {split.anki ? (
                    <div className="field">
                      <span className="flbl">from</span>
                      <span className="delim-note">an anki export, fields split by {SEP_NAME[split.anki.separator] ?? split.anki.separator}</span>
                    </div>
                  ) : (
                    <>
                      <div className="field">
                        <span className="flbl">sides</span>
                        <div className="delim-pick">
                          {SIDE_KINDS.map((k) => (
                            <button key={k} type="button" data-active={used.side === k ? '1' : '0'} onClick={() => setSide(k)}>{SIDE_LABEL[k]}</button>
                          ))}
                          <input
                            className="custom"
                            value={customOf(used.side)}
                            placeholder="custom"
                            spellCheck={false}
                            data-active={typeof used.side === 'object' ? '1' : '0'}
                            onChange={(e) => (e.target.value ? setSide({ custom: e.target.value }) : setDelims(delims && detected ? { ...delims, side: detected.delims.side } : null))}
                          />
                        </div>
                      </div>
                      <div className="field">
                        <span className="flbl">cards</span>
                        <div className="delim-pick">
                          {CARD_KINDS.map((k) => (
                            <button key={k} type="button" data-active={used.card === k ? '1' : '0'} onClick={() => setCard(k)}>{CARD_LABEL[k]}</button>
                          ))}
                          <input
                            className="custom"
                            value={customOf(used.card)}
                            placeholder="custom"
                            spellCheck={false}
                            data-active={typeof used.card === 'object' ? '1' : '0'}
                            onChange={(e) => (e.target.value ? setCard({ custom: e.target.value }) : setDelims(delims && detected ? { ...delims, card: detected.delims.card } : null))}
                          />
                        </div>
                      </div>
                    </>
                  )}
                  <div className="field">
                    <span className="flbl">write</span>
                    <div className="delim-pick">
                      <button type="button" data-active={both ? '0' : '1'} onClick={() => setBoth(false)}>one direction</button>
                      <button type="button" data-active={both ? '1' : '0'} onClick={() => setBoth(true)}>both directions</button>
                    </div>
                  </div>
                </div>

                {deck.cards.length > 0 && (
                  <div className="cards-preview">
                    {deck.cards.slice(0, 3).map((c, i) => (
                      <div key={i} className="card-span"><CardText text={c.text} /></div>
                    ))}
                  </div>
                )}
                <div className="stats">
                  <span><b>{deck.cards.length.toLocaleString()}</b> {deck.cards.length === 1 ? 'card' : 'cards'}</span>
                  {deck.leftovers.length > 0 && (
                    <>
                      <span className="dot" />
                      <span>{plural(leftoverLines(deck.leftovers), 'line')} not cards</span>
                    </>
                  )}
                  {dropped && (
                    <>
                      <span className="dot" />
                      <span>{dropped}</span>
                    </>
                  )}
                  <button type="button" className="link" onClick={() => setAsCards(false)}>as a source →</button>
                </div>
              </>
            )}

            {!anki && (
              <label className="field">
                <span className="flbl">title</span>
                <input value={titleShown} onChange={(e) => setTitle(e.target.value)} spellCheck={false} />
              </label>
            )}

            <div className="field">
              <span className="flbl">lives in</span>
              <div className="folder-pick">
                {folders.map((f) => (
                  <button key={f} type="button" data-active={chosen === f ? '1' : '0'} onClick={() => setFolder(f)}>
                    {f === '' ? titleOf('', docs, root) : f}
                  </button>
                ))}
              </div>
            </div>

            <div className="place-row">
              <button type="button" className="place primary" disabled={!can} onClick={() => void place(true)}>place &amp; open</button>
              <button type="button" className="place" disabled={!can} onClick={() => void place(false)}>place &amp; leave it</button>
            </div>
          </div>
        )}
      </div>

      {drag && <div className="drop-veil"><span>drop it here</span></div>}
    </div>
  );
}
