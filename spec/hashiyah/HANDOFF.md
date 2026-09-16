# ilmi — handoff prompt

Paste this into a new session to resume. Describes what the project is, how it's
built, what's done, and what's next.

---

## What this is

**ilmi** (from Arabic *ʿilmī* = "of knowledge"; formerly *hashiyah*) is a hi-fi, clickable
**prototype** of a personal knowledge management system (PKMS) — a single
document app that unifies **incremental reading**, **spaced-repetition
flashcards**, and **incremental writing**. State lives in memory + React +
localStorage. No backend, no build step (React 18.3.1 via in-browser Babel).

**The user's long-term intent: this becomes their real daily-driver PKMS.**
Treat the prototype as an exact, decided spec for that eventual real build — keep
every interaction crisp because it's what the real app will reproduce. The real
build would be a fresh project (build step, router, real store, and crucially a
**files-over-app storage/sync layer** — that's the one day-one architectural
decision the whole metaphor depends on). Everything else ports screen by screen.

The governing metaphor: **the file tree IS the model.** A vault is a tree of
folders; everything else is a *lens* over it. A card is a span living inside a
container's body; reviewing it rewrites that span's inline schedule in place.
Any folder can hold any mix of object types.

Aesthetic: quiet, editorial, anti-"AI slop." Bright neutral paper (NOT sepia),
near-black ink, **gold** default accent, IBM Plex Sans/Mono for chrome, Source
Serif 4 / Literata for reading. Three themes: **light / dark / e-ink**. Tweaks
panel toggles theme, accent, density.

**Voice rule the user cares about a lot:** no self-narrating UI copy, no exposed
pseudo-code, no `noun · qualifier · qualifier` middot pileups, no
over-explanatory placeholder text. Keep copy quiet and human. When in doubt,
prune. The user repeatedly asks to *trim* UI explanation — bias hard toward less.

## Files (all loaded via Babel from hashiyah.html)

- `hashiyah.html` — shell, script tags, Google Fonts, **KaTeX** (CDN, pinned),
  `__om-edit-overrides`.
- `styles.css` — all styling, CSS-var token system (~2900 lines). Theme blocks
  at top: `:root` (light), `[data-theme="dark"]`, `[data-theme="eink"]`.
- `data.jsx` — `VAULT` seed tree. Helpers `C()` card, `SR()` card schedule,
  `WR()` write schedule, `P()`/`H()` prose blocks. Node types: `folder`,
  `source`, `deck`, `draft`.
- `store.jsx` — live vault + all mutations (`useStore` context). Cards, reading
  schedules (`read`), write schedules (`write`), FSRS-ish stepping, queue query,
  multi-cloze expansion. Key ops below.
- `tree.jsx` — editable workspace tree. Generic `renderNode` dispatch (one branch
  per type). Rename, drag-reorder, right-click menu, new folder/deck/card.
- `reader.jsx` — the UNIFIED document editor + reader. `DocEditor` (one
  continuous contentEditable surface, used everywhere), `Reader` (DocEditor +
  reading marker), `MakeCard` composer, math + editorial-mark rendering, cloze
  helpers.
- `draft.jsx` — `DraftEditor` (wraps the continuous editor for drafts) +
  `DraftView` (draft as a full lens with done/reopen).
- `recall.jsx` — the review session. `SessionShell`, `SessionBar` (with
  prev/next queue nav), `CardElement`, `ReadingSession`, `WritingSession`.
- `views.jsx` — `Queue`, `SavedView`, `DeckView`, `FolderView`.
- `chrome.jsx` — `TopStrip`, `Sidebar`, `Inspector` (adapts per node type),
  `CardEditor`, `TabBar`, `Spark`, `BottomStrip` (keyboard hints per element).
- `palette.jsx` — ⌘K command palette.
- `app.jsx` — root. Pane/tab model (`panes[]`), tweaks wiring, global keyboard
  router, sidebar/inspector drag-resize + persistence (`hashiyah.*` keys — kept
  deliberately after the rename, see conventions).
- `fit.jsx` — viewport scaling helper.
- `tweaks-panel.jsx` — starter component.

## Store ops (store.jsx)

`ingestSource, addCard, createDeck, createFolder, createDraft, editCard,
editBlock, setDraftDoc, setReadPos, toggleFrozen, gradeCard, readAdvance,
writeAdvance, postpone, markDone, toggleOpen` + tree move/rename/delete.
`eachCard`/`findCard` walk all containers. `cardItems` expands a multi-blank
cloze into one queue item per group. `query(scope)` builds the queue.

## What's DONE (verified)

1. **De-AI / voice passes** — removed self-narrating copy, exposed pseudo-code,
   middot pileups, over-explanatory placeholders. Ongoing discipline.
2. **Generalized tree** — any folder holds any mix of types; loose cards live
   directly in folders; folders open as a `FolderView` lens; generic dispatch.
3. **Drag-resizable + hideable** inspector and sidebar; persisted.
4. **Themes** — light / dark / e-ink, themed + auto-hiding scrollbars.
5. **Gold accent**, bright neutral (non-sepia) light mode.
6. **Decks** — sourceless loose-card containers; per-deck default card type.
7. **Humanized refs** — "source · section", never raw block ids.
8. **Unified editor** — ONE continuous contentEditable (`DocEditor`) used for
   sources, drafts, notes, AND in-queue reading. Notion-like: no visible `##`;
   typing `# `/`## `/`### ` at line start makes a heading (markers consumed);
   stays markdown underneath, round-trips on blur. Spell-check on.
9. **Editorial notes** — inline `[like this]` and `#TODO:` auto-highlight; live
   in the text (file-over-app); re-render when caret leaves the block.
10. **LaTeX/KaTeX** — `$…$` / `$$…$$` render as atomic chips (source in
    `data-tex`, round-trips); re-render on caret-leave. Works in reader + drafts.
11. **Incremental writing** — `draft` node type; spaced composition (resurfaces
    until done, never graded). Actions: worked-on-it / postpone(→tomorrow) /
    done. Extracts were REMOVED from writing per user (drafts are plain docs).
12. **Incremental reading** — linear + unbounded. Whole source opens; **left-margin
    read marker** (a continuous accent-colored rule; click/drag the gutter to set
    how far you've read; smart snapping to the block you've pointed past).
    Actions: read-on / postpone / done.
13. **Postpone semantics** — only reading/writing get postpone (→ next day);
    cards just grade. "Worked on it" vs "postpone" are distinct.
14. **Multi-cloze separated** — a cloze with several numbered blanks expands into
    one queue item per blank, each with its OWN schedule; other blanks show as
    dimmed context. Single-blank/q&a/bidir stay single items.
15. **Frozen sources** — imported papers/PDFs/web default `frozen: true` (prose
    locked, cards still editable). Per-source freeze/thaw toggle.
16. **Live editing everywhere** — `CardEditor` in inspector edits a card while
    reviewing; cloze edits edit source material; double-/click-to-edit prose on
    non-frozen sources.
17. **Session nav** — ‹ › (and `[` / `]`) step back/forward through the queue on
    cards, reading, and writing.
18. **Distinct color + icon per element type** in queue + session bar
    (read / write / card).
19. **Saved queries open in a new tab**; tab title follows the queue element.
20. **Removed leech** model + terminology entirely.
21. **Removed duplicate source label** inside the card (header shows it once,
    with go-to-source ↗).
22. **⌘B wraps selection in `{{ }}`** in the card composer; bigger composer
    positioned under the selected paragraph.
23. **Reading extracts (the SuperMemo loop)** — in a reading session, select a
    passage → **extract** (key `e` / cue button) carves it into a **child
    reading element** (a `source` with `extract:true`, nested under its parent in
    the tree) with its OWN `read` schedule, so it joins the queue and can itself
    be read, sub-extracted, or carved into cards/clozes (extracts are editable).
    The parent KEEPS the passage but marks it (`block.exrefs`, shown with an
    "extract" tag + left accent) and the read marker advances past it — progress
    through the article. Anything not extracted stays in the parent until you
    mark it done. Card-making (`m`) now also works in reading sessions, even on
    frozen papers. Store op: `extractReading(sourceId, {text, blockIds})`.
    Inspector shows a source's extracts + an extract's parent.
24. **Card creation while writing** — drafts are card containers
    (`eachCardContainer` includes `draft`). Select in a draft (lens or writing
    session) → `m` opens the same `MakeCard` composer; card is anchored after the
    selected paragraph. Inspector lists a draft's cards. No extracts in drafts.
25. **Renamed to ilmi** — title, tweaks title, docs. `hashiyah.*` storage keys
    and `hashiyah.html` kept on purpose (see conventions).
26. **Flattening / anti-slop pass** — removed: enter-queue banner (now a plain
    row), popover shadows + blur, 4–10px radii (all 2px), left-accent-stripe
    boxes (draft schedule, deck rows, notices), outlined pill tags (READ/WRITE/
    FROZEN/kind), dotted texture, session progress ticks, retention sparks,
    "reviewed today" / "done N" counters, folder/vault count blocks, top-strip
    retention stat. Copy: no block indices in queue rows, no self-narrating
    inspector prose, middot pileups collapsed (tab titles, states, meta), bottom
    strip shows only real key bindings, tooltips dropped, empty states one word.
    Implemented as an override block at the END of `styles.css` — consolidate
    into the base rules when porting rather than copying the overrides.

## What's NEXT (roadmap — recommended order)

### 1. Pretext margin-gloss text-flow (the namesake showpiece)
Prototype **Cheng Lou's Pretext** (DOM-free text layout/measurement) to flow
reading prose **around cards sitting in the margin** at their anchor — real
obstacle-aware typesetting, the marginalia metaphor made literal. Only for
*anchored* cards (cards with a location in a source). Unanchored cards collect in
a margin rail; sourceless deck cards never appear in the reader. Scoped to the
reader as a toggleable experiment (gives up clean-selectable-HTML simplicity).

### 2. (Only if a flow keeps growing) Session state-machine refactor
The review session (reveal counts, grade-vs-advance, multi-cloze masking, marker
drag, on-leave re-render) is currently effects + counters. If it grows hairier,
model it as an explicit state machine. Not worth retrofitting now.

## Working notes / conventions

- React 18.3.1 + Babel standalone, pinned with integrity hashes in the HTML.
- Each `<script type="text/babel">` shares global lexical scope (Babel compiles
  to classic scripts appended to the page) — top-level `function`/`const`
  declarations are visible across files; no `Object.assign(window,…)` needed.
  **Never** name a styles object just `styles` — collisions break everything.
- Canonical HTML (explicit closing tags, quoted attrs) so direct-edit works.
- contentEditable surfaces are UNCONTROLLED while focused and re-painted from the
  model on blur / caret-leave — never reconcile React children into them mid-edit.
- Verify with `ready_for_verification({path:"hashiyah.html"})`. Synthetic
  focus/blur in eval_js often won't trigger React handlers — use real `.focus()`
  on another element, or dispatch `selectionchange`, to test caret-leave logic.
  Clean console logs are the real signal.
- localStorage keys stay namespaced `hashiyah.*` (pre-rename). **Deliberate, not
  an oversight:** migrating would discard the user's live state, and the real
  build defines its own persistence. Same for the filename `hashiyah.html`.
  Never clear keys you didn't set.
- `data-comment-anchor` attrs are pinned to teammate comments — preserve them.
- The user values brevity in both UI copy AND chat replies. Trim relentlessly.
