// store.jsx — the live vault + the operations that move it.
//
// One tree, one source of truth (VAULT in data.jsx). Everything else is a lens:
//  · the sidebar renders the tree and edits it in place (rename/new/delete/move)
//  · a CARD is a marked span inside a source's body — never a separate store.
//    Grading rewrites that span's inline schedule.
//  · the queue + saved views are QUERIES over the tree (blocks due ≤ today).
//
// No coercion: postpone/done are plain log lines, never failures. Counts are
// numerals. There are no streaks.

const StoreContext = React.createContext(null);
function useStore() { return React.useContext(StoreContext); }

const clone = (x) => JSON.parse(JSON.stringify(x));
const clamp = (v, lo = 0.05, hi = 0.95) => Math.max(lo, Math.min(hi, v));
let _idn = 5000;
const uid = (p) => p + (++_idn);

// ── fuzzy match (palette) ────────────────────────────────────────
function fuzzy(query, text) {
  query = (query || '').toLowerCase();
  text = (text || '').toLowerCase();
  if (!query) return 0;
  let qi = 0, score = 0, prev = -2, run = 0;
  for (let ti = 0; ti < text.length && qi < query.length; ti++) {
    if (text[ti] === query[qi]) {
      if (prev >= 0) score += (ti - prev === 1) ? 0 : (ti - prev);
      if (ti === 0 || /[\s\-·/.]/.test(text[ti - 1])) score -= 2;
      prev = ti; qi++; run++;
    }
  }
  return qi === query.length ? score - run * 0.2 : -1;
}

// ── dates ────────────────────────────────────────────────────────
function parseDate(s) { const [y, m, d] = (s || TODAY).split('-').map(Number); return new Date(y, m - 1, d); }
function fmtDate(dt) {
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
}
function addDays(s, n) { const dt = parseDate(s); dt.setDate(dt.getDate() + n); return fmtDate(dt); }
function dayDelta(due) { return Math.round((parseDate(due) - parseDate(TODAY)) / 86400000); }
const isDue = (due) => (due || TODAY) <= TODAY;          // lexical compare on YYYY-MM-DD
function dueLabel(due) {
  const d = dayDelta(due);
  if (d < 0) return 'overdue ' + (-d) + 'd';
  if (d === 0) return 'today';
  if (d === 1) return 'tomorrow';
  if (d < 30) return '+' + d + 'd';
  return '+' + Math.round(d / 30) + 'mo';
}

// ── FSRS-ish scheduler (display model) ───────────────────────────
function fmtDays(d) {
  if (d < 1 / 24) return '<10m';
  if (d < 1) return Math.round(d * 24) + 'h';
  if (d < 60) return Math.round(d) + 'd';
  return Math.round(d / 30) + 'mo';
}
function previewIntervals(stability) {
  return ['<10m', fmtDays(stability * 1.2), fmtDays(stability * 2.4), fmtDays(stability * 3.6)];
}
function fsrsStep(sched, grade) {
  let { stab = 1, reps = 0, lapses = 0, diff = 0.4 } = sched || {};
  reps += 1;
  const name = ['', 'again', 'hard', 'good', 'easy'][grade];
  if (grade === 1)      { lapses += 1; stab = Math.max(0.4, stab * 0.4); diff = clamp(diff + 0.15); }
  else if (grade === 2) { stab *= 1.2; diff = clamp(diff + 0.05); }
  else if (grade === 3) { stab *= 2.4; diff = clamp(diff - 0.04); }
  else                  { stab *= 3.6; diff = clamp(diff - 0.10); }
  stab = Math.round(stab * 10) / 10;
  const interval = grade === 1 ? 0 : Math.max(1, Math.round(stab));
  return {
    reps, lapses, diff: Math.round(diff * 100) / 100, stab,
    due: addDays(TODAY, interval),
    last: 'just now · ' + name,
  };
}

// ── text helpers ─────────────────────────────────────────────────
// a cloze token: { cloze: answer, n: groupNumber|null }. Syntax: {{answer}} (a
// lone blank, group null) or {{c1::answer}} / {{1::answer}} (numbered groups, so
// one passage can carry several blanks tested in turn — multi-cloze).
function parseCloze(text) {
  return (text || '').split(/(\{\{[^}]+\}\})/g)
    .filter(p => p !== '')
    .map(p => {
      if (p.startsWith('{{') && p.endsWith('}}')) {
        const inner = p.slice(2, -2);
        const m = /^c?(\d+)::([\s\S]+)$/.exec(inner);
        return m ? { cloze: m[2], n: +m[1] } : { cloze: inner, n: null };
      }
      return p;
    });
}
// the distinct cloze groups in order; a lone {{blank}} counts as its own group
function clozeGroups(text) {
  const seen = [];
  parseCloze(text).forEach((p) => { if (typeof p !== 'string') { const k = p.n == null ? 'l' + seen.length : 'g' + p.n; if (!seen.includes(k)) seen.push(k); } });
  return seen;
}
// a fresh card schedule, and a per-group schedule for a multi-cloze blank
function freshSched() { return { due: TODAY, stab: 1, reps: 0, lapses: 0, diff: 0.3, last: 'new' }; }
function groupSched(card, key) {
  if (!card.cz) card.cz = {};
  if (!card.cz[key]) card.cz[key] = card.sched ? clone(card.sched) : freshSched();
  return card.cz[key];
}
const firstCloze = (t) => { const m = (t || '').match(/\{\{([^}]+)\}\}/); if (!m) return null; const mm = /^c?\d+::([\s\S]+)$/.exec(m[1]); return mm ? mm[1] : m[1]; };
const stripBraces = (t) => (t || '').replace(/\{\{(?:c?\d+::)?([^}]*)\}\}/g, '$1');
const firstWords = (t, n = 7) => {
  const w = (t || '').trim().split(/\s+/);
  return w.slice(0, n).join(' ') + (w.length > n ? '…' : '');
};

// card → human label for a tree leaf / queue line
function cardLabel(card) {
  if (card.title) return card.title;
  if (card.type === 'cloze') return firstCloze(card.text) || stripBraces(card.text).slice(0, 46) || 'cloze';
  if (card.type === 'qa') return (card.body.q || 'q&a').slice(0, 50);
  return ((card.body.l || '?') + ' ⇄ ' + (card.body.r || '?')).slice(0, 46);
}
// readable block-ref for a card span: drop the internal 'c' prefix, keep the rest
const blockRef = (id) => (id || '').replace(/^c(?=[a-z])/, '');

// ── tree traversal ───────────────────────────────────────────────
function walk(node, fn, parent) {
  fn(node, parent);
  (node.children || []).forEach(c => walk(c, fn, node));
}
function findNode(vault, id) { let out = null; walk(vault, (n) => { if (n.id === id) out = n; }); return out; }
function findParent(vault, id) { let out = null; walk(vault, (n, p) => { if (n.id === id) out = p; }); return out; }
function eachSource(vault, fn) { walk(vault, (n) => { if (n.type === 'source') fn(n); }); }
function findSource(vault, id) { return findNode(vault, id); }
// a card lives inside a CONTAINER body. Any node that carries a `body` is a
// container: a source (prose + cards), a deck (loose cards), or a folder that
// holds loose cards directly. The tree is the model; a container is whatever
// holds card spans.
function eachCardContainer(vault, fn) { walk(vault, (n) => { if (Array.isArray(n.body) && (n.type === 'source' || n.type === 'deck' || n.type === 'folder' || n.type === 'draft')) fn(n); }); }
// a card lives in a container body — return { card, source, idx }  (source = its container)
function findCard(vault, cardId) {
  let out = null;
  eachCardContainer(vault, (s) => (s.body || []).forEach((blk, i) => {
    if (blk.kind === 'card' && blk.id === cardId) out = { card: blk, source: s, idx: i };
  }));
  return out;
}
// walk every card with its container + nearest preceding heading (decks have none)
function eachCard(vault, fn) {
  eachCardContainer(vault, (s) => {
    let section = '';
    (s.body || []).forEach((blk) => {
      if (blk.kind === 'h') section = blk.text;
      else if (blk.kind === 'card') fn(blk, s, section);
    });
  });
}
const isDescendant = (node, id) => { let hit = false; walk(node, (n) => { if (n.id === id) hit = true; }); return hit; };

// card span → a queue/recall ITEM (a thing to recall)
function cardToItem(card, source, section) {
  const base = {
    id: card.id, cardId: card.id, el: 'card', kind: 'card', sub: card.type,
    source: source.id, sourceLabel: source.name + (section ? ' — ' + section.replace(/^§\d+ — /, '') : ''),
    section, sched: card.sched, due: dueLabel(card.sched.due),
    pri: isDue(card.sched.due) ? 2 : 3,
    stab: card.sched.stab,
    interval: card.sched.reps === 0 ? 'new → 1d' : fmtDays(card.sched.stab),
  };
  if (card.type === 'cloze') base.body = parseCloze(card.text);
  else base.body = card.body;
  return base;
}

// a cloze card with several numbered blanks tests each blank SEPARATELY: it
// expands into one queue item per group, each carrying its own schedule. A
// single-blank cloze (or a q&a / bidir card) stays a single item.
function cardItems(card, source, section) {
  if (card.type === 'cloze') {
    const keys = clozeGroups(card.text);
    if (keys.length > 1) {
      const label = source.name + (section ? ' — ' + section.replace(/^§\d+ — /, '') : '');
      return keys.map((key, gi) => {
        const sched = (card.cz && card.cz[key]) || card.sched;
        return {
          id: card.id + '~' + key, cardId: card.id, el: 'card', kind: 'card', sub: 'cloze',
          source: source.id, sourceLabel: label, section,
          sched, due: dueLabel(sched.due), pri: isDue(sched.due) ? 2 : 3, stab: sched.stab,
          interval: sched.reps === 0 ? 'new → 1d' : fmtDays(sched.stab),
          body: parseCloze(card.text), gi, groupKey: key, groupCount: keys.length, blank: gi + 1,
        };
      });
    }
  }
  return [cardToItem(card, source, section)];
}

// every source enrolled in incremental reading carries an inline read schedule
function eachTopic(vault, fn) { eachSource(vault, (s) => { if (s.read) fn(s); }); }

// a reading TOPIC → a queue/recall element (a thing to read, incrementally)
function topicToItem(src) {
  const r = src.read;
  const prose = (src.body || []).filter(b => b.kind !== 'card');
  const total = prose.length || 1;
  const pos = Math.min(r.pos || 0, total);
  const next = prose[Math.min(pos, total - 1)] || null;
  const reps = r.reps || 0;
  return {
    id: src.id, el: 'read', kind: 'read', sub: 'read',
    source: src.id, sourceLabel: src.name,
    sched: r, due: dueLabel(r.due),
    pri: r.pri || 2,
    pos, total, fresh: reps === 0,
    progress: Math.round((pos / total) * 100),
    snippet: next ? firstWords(next.text, 15) : '',
    interval: reps === 0 ? 'new read' : 'pass ' + (reps + 1),
  };
}

// ── writables: drafts + their extracts (incremental writing) ─────
// A draft is your own document enrolled in spaced composition. Each extract is a
// chunk carved out of it with its OWN schedule. Neither is graded — both simply
// resurface until `write.done` is set. The draft is the parent; extracts are the
// independently-writable parts, mirroring reading's extract model run backward.
function writableWords(node) {
  let n = 0;
  (node.body || []).forEach((b) => { if (b.kind !== 'card' && b.text) n += b.text.split(/\s+/).filter(Boolean).length; });
  return n;
}
function writableSnippet(node) {
  const p = (node.body || []).find((b) => b.kind === 'p' && b.text) || (node.body || []).find((b) => b.text);
  return p ? firstWords(p.text, 16) : '';
}
function eachWritable(vault, fn) {
  walk(vault, (n) => {
    if (n.type === 'draft' && n.write && !n.write.done) fn({ id: n.id, kind: 'draft', draft: n, node: n, write: n.write });
  });
}
function findWritable(vault, id) {
  const node = findNode(vault, id);
  if (node && node.type === 'draft') return { id, kind: 'draft', draft: node, node, write: node.write };
  return null;
}
function writableToItem(w) {
  const r = w.write || {};
  const reps = r.reps || 0;
  return {
    id: w.id, el: 'write', kind: 'write', sub: 'write',
    draft: w.draft.id, source: w.draft.id,
    sourceLabel: w.draft.name,
    sched: r, due: dueLabel(r.due),
    pri: r.pri || 2,
    words: writableWords(w.node),
    fresh: reps === 0,
    snippet: writableSnippet(w.node),
    interval: reps === 0 ? 'new draft' : 'pass ' + (reps + 1),
  };
}

// ── provider ─────────────────────────────────────────────────────
function StoreProvider({ children }) {
  const [vault, setVault] = React.useState(() => clone(VAULT));
  const [log, setLog] = React.useState([]);
  const [reviewed, setReviewed] = React.useState(0);
  const [lastGraded, setLastGraded] = React.useState(null);   // {sched, label} for inspector
  const [reading, setReading] = React.useState({});

  const note = (entry) => setLog((l) => [entry, ...l].slice(0, 6));
  const mutate = (fn) => setVault((v) => { const n = clone(v); fn(n); return n; });

  // ── QUERIES over the vault ─────────────────────────────────────
  // One outstanding queue. Topics (reading) and items (cards) interleave,
  // sorted by priority then due date — incremental everything.
  const query = React.useCallback((scope) => {
    const items = [];
    eachCard(vault, (card, s, section) => cardItems(card, s, section).forEach((it) => items.push(it)));
    eachTopic(vault, (s) => items.push(topicToItem(s)));
    eachWritable(vault, (w) => items.push(writableToItem(w)));
    items.sort((a, b) => (a.pri - b.pri) || (a.sched.due < b.sched.due ? -1 : a.sched.due > b.sched.due ? 1 : 0));
    if (scope === 'today')    return items.filter(i => isDue(i.sched.due));
    if (scope === 'upcoming') return items.filter(i => !isDue(i.sched.due));
    if (scope === 'reading')  return items.filter(i => i.el === 'read');
    if (scope === 'writing')  return items.filter(i => i.el === 'write');
    if (scope === 'cards')    return items.filter(i => i.el === 'card');
    return items; // 'all'
  }, [vault]);

  const counts = React.useMemo(() => {
    const all = query('all');
    return {
      today: all.filter(i => isDue(i.sched.due)).length,
      upcoming: all.filter(i => !isDue(i.sched.due)).length,
      cards: all.filter(i => i.el === 'card').length,
      reading: all.filter(i => i.el === 'read').length,
      writing: all.filter(i => i.el === 'write').length,
    };
  }, [query]);

  // ── tree edits ─────────────────────────────────────────────────
  const renameNode = React.useCallback((id, name) => {
    name = (name || '').trim();
    if (!name) return;
    mutate((v) => {
      const n = findNode(v, id);
      if (n) { n.name = name; return; }
      const f = findCard(v, id);
      if (f) { f.card.title = name; return; }     // card leaf: rename = label override
      const w = findWritable(v, id);
      if (w && w.kind === 'extract') w.node.title = name;   // extract leaf: rename its title
    });
  }, []);

  const deleteNode = React.useCallback((id) => {
    mutate((v) => {
      // card leaf → strip the annotation (the span/schedule), keep prose
      const fc = findCard(v, id);
      if (fc) { fc.source.body.splice(fc.idx, 1); return; }
      // extract leaf → remove the carved piece from its draft
      const w = findWritable(v, id);
      if (w && w.kind === 'extract') { w.draft.body = w.draft.body.filter(b => b.id !== id); return; }
      const parent = findParent(v, id);
      if (parent && parent.children) parent.children = parent.children.filter(c => c.id !== id);
    });
    const fc = findCard(vault, id);
    note({ kind: 'delete', label: 'removed · ' + (fc ? 'card annotation' : 'node') });
  }, [vault]);

  const createFolder = React.useCallback((parentId, name = 'untitled folder') => {
    const id = uid('fld');
    mutate((v) => {
      const p = findNode(v, parentId) || v;
      p.open = true; p.children = p.children || [];
      p.children.push({ id, type: 'folder', name, open: true, children: [] });
    });
    note({ kind: 'new', label: 'new folder' });
    return id;
  }, []);

  const createSource = React.useCallback((parentId, name = 'untitled', body) => {
    const id = uid('src');
    mutate((v) => {
      const p = findNode(v, parentId) || v;
      p.open = true; p.children = p.children || [];
      p.children.push({
        id, type: 'source', name, open: true, summary: 'new · empty',
        meta: { path: name + '.md', imported: TODAY, words: 0 },
        body: body || [{ id: uid('b'), kind: 'p', text: '' }],
      });
    });
    note({ kind: 'new', label: 'new source · ' + name });
    return id;
  }, []);

  // move a dragged node before/after/into a target
  const moveNode = React.useCallback((dragId, targetId, mode) => {
    if (dragId === targetId) return;
    mutate((v) => {
      const dragged = findNode(v, dragId);
      if (!dragged) return;
      if (isDescendant(dragged, targetId)) return;     // never drop a node into its own subtree
      // detach
      const p = findParent(v, dragId);
      if (p && p.children) p.children = p.children.filter(c => c.id !== dragId);
      if (mode === 'into') {
        const t = findNode(v, targetId);
        if (t && t.type === 'folder') { t.open = true; t.children = t.children || []; t.children.push(dragged); }
        return;
      }
      const tp = findParent(v, targetId);
      const arr = (tp && tp.children) || v.children;
      const idx = arr.findIndex(c => c.id === targetId);
      arr.splice(mode === 'before' ? idx : idx + 1, 0, dragged);
    });
  }, []);

  const toggleOpen = React.useCallback((id, force) => {
    mutate((v) => { const n = findNode(v, id); if (n) n.open = force !== undefined ? force : !n.open; });
  }, []);

  // ── a source enters whole, unread ──────────────────────────────
  const ingestSource = React.useCallback(({ title, folder, raw }) => {
    const paras = (raw || '').split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
    const words = (raw || '').split(/\s+/).filter(Boolean).length;
    const body = paras.length ? paras.map(p => ({ id: uid('b'), kind: 'p', text: p })) : [{ id: uid('b'), kind: 'p', text: '' }];
    let id;
    mutate((v) => {
      const f = (v.children || []).find(x => x.id === folder || x.name === folder) || v.children[0];
      f.open = true;
      id = uid('src');
      f.children.unshift({
        id, type: 'source', name: title, open: true, frozen: true, summary: 'just added · unread',
        meta: { path: (f.name || 'notes') + '/' + title + '.md', imported: TODAY, words },
        body,
      });
    });
    note({ kind: 'ingest', label: 'added · ' + firstWords(title, 6) });
    return id;
  }, []);

  // ── a card is a span carved into a CONTAINER (a source, a draft, a folder, or a deck of loose cards) ──
  const addCard = React.useCallback(({ sourceId, deckId, containerId, type, text, front, back, a, b, pri, afterBlockId }) => {
    const cardId = uid('cd');
    let payload;
    if (type === 'cloze') payload = { text: text || '' };
    else if (type === 'qa') payload = { body: { q: front || '', a: back || '' } };
    else payload = { body: { l: a || '', r: b || '' } };
    const block = { id: cardId, kind: 'card', type, ...payload, isNew: true,
      sched: { due: TODAY, stab: 1, reps: 0, lapses: 0, diff: 0.3, last: 'new' } };
    mutate((v) => {
      const container = findNode(v, containerId || deckId || sourceId);
      if (!container) return;
      container.open = true;
      container.body = container.body || [];
      const i = afterBlockId ? (container.body.findIndex(x => x.id === afterBlockId)) : -1;
      if (i >= 0) container.body.splice(i + 1, 0, block); else container.body.push(block);
    });
    note({ kind: 'card', label: 'card · ' + firstWords(stripBraces(cardLabel(block)), 6) });
    return cardId;
  }, []);

  // ── a deck: a container of loose cards with no source text behind them ──
  const createDeck = React.useCallback((parentId, name = 'untitled deck') => {
    const id = uid('dck');
    mutate((v) => {
      const p = findNode(v, parentId) || v;
      p.open = true; p.children = p.children || [];
      p.children.push({ id, type: 'deck', name, open: true, body: [] });
    });
    note({ kind: 'new', label: 'new deck · ' + name });
    return id;
  }, []);

  // ── a draft: your own document, enrolled in spaced composition. Resurfaces in
  //    the queue until you mark it done. Always editable; never frozen. ──
  const createDraft = React.useCallback((parentId, name = 'untitled draft') => {
    const id = uid('drf');
    mutate((v) => {
      const p = findNode(v, parentId) || v;
      p.open = true; p.children = p.children || [];
      p.children.push({
        id, type: 'draft', name, open: true,
        meta: { path: name + '.md', started: TODAY, words: 0 },
        write: { due: TODAY, ivl: 1, reps: 0, pri: 2, done: false },
        body: [{ id: uid('b'), kind: 'p', text: '' }],
      });
    });
    note({ kind: 'new', label: 'new draft · ' + firstWords(name, 5) });
    return id;
  }, []);

  // ── replace a draft's whole body in one shot — the continuous editor hands
  //    back a fresh block list (paragraphs + headings) parsed from the doc. ──
  const setDraftDoc = React.useCallback((draftId, blocks) => {
    mutate((v) => { const d = findNode(v, draftId); if (d) d.body = blocks.length ? blocks : [{ id: uid('b'), kind: 'p', text: '' }]; });
  }, []);
  // same, for any container the unified editor writes back (sources, notes, drafts)
  const setDocBody = React.useCallback((nodeId, blocks) => {
    mutate((v) => { const d = findNode(v, nodeId); if (d) d.body = blocks.length ? blocks : [{ id: uid('b'), kind: 'p', text: '' }]; });
  }, []);

  // ── reading EXTRACT: carve a passage out of a source into its own child
  //    reading element. The extract is a real node in the tree (a source nested
  //    under its parent) with its OWN read schedule — so it joins the queue and
  //    can be read, sub-extracted, or carved into cards in turn. The parent
  //    keeps the passage but marks it as processed; the read marker advances
  //    past it, so the article shows progress as you work through it. ──
  const extractReading = React.useCallback((sourceId, { text, blockIds = [], pri } = {}) => {
    const t = (text || '').trim();
    if (!t) return null;
    const exId = uid('ex');
    mutate((v) => {
      const src = findNode(v, sourceId);
      if (!src) return;
      const paras = t.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
      const body = paras.length
        ? paras.map((p) => ({ id: uid('b'), kind: 'p', text: p }))
        : [{ id: uid('b'), kind: 'p', text: t }];
      const base = ((src.meta && src.meta.path) || (src.name + '.md')).replace(/\.md$/, '');
      const ex = {
        id: exId, type: 'source', extract: true, parent: src.id,
        name: firstWords(t, 5), open: false, frozen: false, summary: 'extract',
        meta: { path: base + '/' + (exId) + '.md', imported: TODAY, words: t.split(/\s+/).filter(Boolean).length, of: src.name },
        read: { due: TODAY, ivl: 1, reps: 0, pos: 0, pri: pri || (src.read && src.read.pri) || 2 },
        body,
      };
      src.children = src.children || [];
      src.children.push(ex);
      src.open = true;
      // mark the originating prose in the parent as processed, and advance the
      // read marker past the last block the selection touched
      const prose = (src.body || []).filter((b) => b.kind !== 'card');
      let lastProseIdx = -1;
      (src.body || []).forEach((b) => {
        if (blockIds.includes(b.id) && b.kind !== 'card') {
          b.exrefs = (b.exrefs || []).concat(exId);
          const pi = prose.indexOf(b);
          if (pi > lastProseIdx) lastProseIdx = pi;
        }
      });
      if (src.read && lastProseIdx >= 0) src.read.pos = Math.max(src.read.pos || 0, lastProseIdx + 1);
    });
    note({ kind: 'read', label: 'extract · ' + firstWords(t, 5) });
    return exId;
  }, []);

  // ── set the reading position live, by block id (the left-margin read marker) ──
  const setReadPos = React.useCallback((sourceId, blockId) => {
    mutate((v) => {
      const s = findNode(v, sourceId);
      if (!s || !s.read) return;
      const prose = (s.body || []).filter(b => b.kind !== 'card');
      const idx = prose.findIndex(b => b.id === blockId);
      if (idx >= 0) s.read.pos = idx;
    });
  }, []);

  // add a prose block (paragraph / heading) to a draft or one of its extracts
  const addDraftBlock = React.useCallback((draftId, extractId, kind, afterBlockId) => {
    const bid = uid('b');
    mutate((v) => {
      const d = findNode(v, draftId); if (!d) return;
      const container = extractId ? (d.body || []).find(b => b.id === extractId) : d;
      if (!container) return;
      container.body = container.body || [];
      const blk = { id: bid, kind, text: '', isNew: true };
      const i = afterBlockId ? container.body.findIndex(x => x.id === afterBlockId) : -1;
      if (i >= 0) container.body.splice(i + 1, 0, blk); else container.body.push(blk);
    });
    return bid;
  }, []);

  // ── edit a card's content in place — it IS a block in its container, so this
  //    edits the source material too (a cloze's text lives in the file). ──
  const editCard = React.useCallback((cardId, fields) => {
    mutate((v) => {
      const fc = findCard(v, cardId);
      if (!fc) return;
      const c = fc.card;
      if (c.type === 'cloze') { if (fields.text !== undefined) c.text = fields.text; }
      else if (c.type === 'qa') { c.body = { ...c.body, ...(fields.q !== undefined ? { q: fields.q } : {}), ...(fields.a !== undefined ? { a: fields.a } : {}) }; }
      else { c.body = { ...c.body, ...(fields.l !== undefined ? { l: fields.l } : {}), ...(fields.r !== undefined ? { r: fields.r } : {}) }; }
    });
  }, []);

  // ── edit a prose block. Works on un-frozen sources, your own notes, AND any
  //    draft / extract body (drafts are always yours to write). ──
  const editBlock = React.useCallback((blockId, text) => {
    mutate((v) => {
      let done = false;
      const scan = (body) => {
        if (!body) return;
        body.forEach((b) => {
          if (done) return;
          if (b.id === blockId && (b.kind === 'p' || b.kind === 'h')) { b.text = text; done = true; }
          else if (b.kind === 'extract' && b.body) scan(b.body);
        });
      };
      walk(v, (n) => { if (!done && Array.isArray(n.body)) scan(n.body); });
    });
  }, []);

  // ── freeze / thaw a source: frozen = imported text you don't edit (PDF, web),
  //    but its cards stay editable. Your own notes start thawed. ──
  const toggleFrozen = React.useCallback((sourceId) => {
    mutate((v) => { const s = findNode(v, sourceId); if (s) s.frozen = !s.frozen; });
  }, []);

  // ── a deck's default card type — what the composer opens to ──
  const setDeckDefault = React.useCallback((deckId, cardType) => {
    mutate((v) => { const d = findNode(v, deckId); if (d) d.defaultCard = cardType; });
  }, []);

  // ── grade: rewrite the span's inline schedule, in place ────────
  const gradeCard = React.useCallback((cardId, grade) => {
    setReviewed((n) => n + 1);
    let nextSched = null, lbl = '';
    mutate((v) => {
      const t = cardId.indexOf('~');
      const baseId = t >= 0 ? cardId.slice(0, t) : cardId;
      const key = t >= 0 ? cardId.slice(t + 1) : null;
      const fc = findCard(v, baseId);
      if (!fc) return;
      if (key) {
        nextSched = fsrsStep(groupSched(fc.card, key), grade);
        fc.card.cz[key] = nextSched;
      } else {
        nextSched = fsrsStep(fc.card.sched, grade);
        fc.card.sched = nextSched;
      }
      fc.card.justGraded = grade;
      lbl = cardLabel(fc.card);
    });
    if (nextSched) setLastGraded({ sched: nextSched, label: lbl });
  }, []);

  const advanceReading = React.useCallback((sourceId, toIndex) => {
    setReading((r) => ({ ...r, [sourceId]: Math.max(r[sourceId] || 0, toIndex) }));
  }, []);

  // ── read a topic, then reschedule it — the reading half of the queue.
  //    mode: 'next' (read some; remember how far, bring it back on schedule) ·
  //    'postpone' (not now → tomorrow) · 'done' (processed however you liked →
  //    out of the queue). Reading is linear and unbounded; you decide done. ──
  const readAdvance = React.useCallback((sourceId, mode, posBlockId) => {
    setReviewed((n) => n + 1);
    mutate((v) => {
      const s = findNode(v, sourceId);
      if (!s || !s.read) return;
      const r = s.read;
      r.reps = (r.reps || 0) + 1;
      if (mode === 'done') { s.summary = 'read'; s.read = null; }
      else if (mode === 'postpone') { r.due = addDays(TODAY, 1); }
      else {
        if (posBlockId) {
          const prose = (s.body || []).filter(b => b.kind !== 'card');
          const idx = prose.findIndex(b => b.id === posBlockId);
          if (idx >= 0) r.pos = Math.max(r.pos || 0, idx);
        }
        r.ivl = Math.max(1, Math.round((r.ivl || 1) * 1.6));
        r.due = addDays(TODAY, r.ivl);
      }
      s.justGraded = 1;
    });
    note({ kind: 'read', label: 'read · ' + ({ next: 'read on', postpone: 'tomorrow', done: 'done' }[mode] || mode) });
  }, []);

  // ── write a draft, then reschedule it — the writing half of the queue. Never
  //    graded; it just comes back. mode: 'next' (worked on it → back on
  //    schedule) · 'postpone' (not now → tomorrow) · 'done' (graduate). ──
  const writeAdvance = React.useCallback((id, mode) => {
    setReviewed((n) => n + 1);
    mutate((v) => {
      const w = findWritable(v, id);
      if (!w || !w.write) return;
      const r = w.write;
      r.reps = (r.reps || 0) + 1;
      if (mode === 'done') { r.done = true; }
      else if (mode === 'postpone') { r.due = addDays(TODAY, 1); r.done = false; }
      else { r.ivl = Math.max(1, Math.round((r.ivl || 1) * 1.5)); r.due = addDays(TODAY, r.ivl); r.done = false; }
      w.node.justGraded = 1;
    });
    note({ kind: 'write', label: 'wrote · ' + ({ next: 'progress', postpone: 'tomorrow', done: 'done' }[mode] || mode) });
  }, []);

  const postpone = React.useCallback((cardId, label) => {
    mutate((v) => { const fc = findCard(v, cardId); if (fc) fc.card.sched.due = addDays(TODAY, 1); });
    note({ kind: 'postpone', label: 'postponed · ' + (label || 'card') + ' → tomorrow' });
  }, []);

  const markDone = React.useCallback((cardId, label) => {
    mutate((v) => { const fc = findCard(v, cardId); if (fc) fc.card.sched.due = addDays(TODAY, Math.max(2, Math.round(fc.card.sched.stab || 4))); });
    note({ kind: 'done', label: 'done · ' + (label || 'card') });
  }, []);

  const value = {
    vault, workspace: vault, log, reviewed, lastGraded, reading, counts,
    query, renameNode, deleteNode, createFolder, createSource, moveNode, toggleOpen,
    ingestSource, addCard, createDeck, editCard, editBlock, toggleFrozen, setDeckDefault, gradeCard, advanceReading, readAdvance, postpone, markDone,
    createDraft, addDraftBlock, setDraftDoc, setDocBody, setReadPos, writeAdvance, extractReading,
  };
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
