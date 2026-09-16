# Build prompt — ilmi

Paste everything below the line into a fresh agent session. Attach or copy in
`HANDOFF.md` alongside it; that file is the interaction spec, this file is the
build brief.

---

## What you're building

**ilmi** — a local-first personal knowledge management app that unifies
**incremental reading**, **spaced-repetition flashcards**, and **incremental
writing** into one document surface.

A working hi-fi prototype already exists and is **a decided spec, not a
suggestion**. Read `HANDOFF.md` for the full interaction model and the list of
settled behaviors. Reproduce those interactions exactly. Where the prototype and
this brief disagree on architecture, this brief wins; where they disagree on
*behavior or feel*, the prototype wins.

The governing metaphor: **the file tree IS the model.** A vault is a tree of
folders. Everything else — queue, deck, reader, draft — is a *lens* over that
tree. A card is a span living inside a document's body; reviewing it rewrites
that span's inline schedule in place. Any folder holds any mix of object types.

## Day-one architecture (non-negotiable)

**1. Files over app.** The vault is a directory of plain Markdown files on the
user's disk. The app is a viewer/editor over them, never the owner. No opaque
database as source of truth. A user must be able to open the vault in any text
editor, edit a file, and have the app pick it up. Sync is whatever the user
already uses (git, iCloud, Syncthing) — the app must tolerate files changing
underneath it.

Design the on-disk format **first**, before any UI, and write it down as
`FORMAT.md`. It must round-trip losslessly:

- Document body: ordinary Markdown. Headings, paragraphs, lists.
- Cards: inline spans in the body. Cloze syntax `{{c1::answer}}`, plus q&a and
  bidirectional forms. A multi-blank cloze carries a **separate schedule per
  blank**.
- Schedules: an inline annotation attached to the card span, or a sidecar block —
  your call, but it must survive a human hand-editing the prose around it, and
  it must be diff-friendly (one card's review should not rewrite the whole file).
- Reading position, freeze state, extract backrefs: front-matter or an adjacent
  metadata line.
- Math: `$…$` / `$$…$$` as-authored.
- Editorial marks: inline `[bracketed notes]` and `#TODO:` stay literal text.

State every escaping rule. Write parser round-trip tests before the UI exists:
parse → serialize → parse must be a fixed point on a corpus of ugly real files.

**2. Scheduler.** Use `ts-fsrs`. The prototype fakes FSRS; replace it with the
real thing. Reading and writing elements are **not graded** — reading advances,
writing resurfaces until done; both support postpone (→ next day). Only cards
grade. Keep that distinction sharp.

**3. Stack.** Vite + React + TypeScript. Tauri for the desktop shell (real
filesystem access, small binary, no Node in the renderer) unless you have a
concrete reason to prefer Electron. Editor: **ProseMirror** (or CodeMirror 6 if
you decide the surface should stay closer to raw text) — the prototype's
contentEditable-on-blur repainting is a prototype hack and must not port.
Zustand or a plain reducer for app state; the filesystem is the store.

**4. What the prototype got wrong and you should not copy:** in-browser Babel,
global lexical scope across files, one giant `styles.css`, uncontrolled
contentEditable repainted on blur, in-memory vault, localStorage persistence.

## Scope for the first real milestone

Ship the full loop, nothing more:

1. Open a vault directory. Tree view. Create/rename/move/delete folders and docs.
2. Import a document (paste, file, URL → readable text). Imported docs are
   **frozen** by default: prose locked, cards still editable.
3. Read a document: continuous surface, left-margin read marker you can
   click/drag to set progress, snapping to block boundaries.
4. **Extract**: select a passage → carve a child reading element with its own
   schedule, nested under its parent. Parent keeps the passage, marks it, and the
   read marker advances past it.
5. **Make cards** from any selection — in a source, in an extract, and in a
   draft. The prototype does this; a card is anchored in whatever container it
   was carved from.
6. Review queue: cards grade, reading advances, writing resurfaces. Prev/next
   queue nav. Multi-blank clozes appear as one item per blank with the other
   blanks dimmed as context.
7. Three themes: light / dark / e-ink.

Explicitly **out** of milestone one: margin-gloss text flow around anchored cards
(a later experiment), mobile, collaboration, plugins, AI anything.

## Design direction — make it look like a person made it

Take this as seriously as the architecture. The aesthetic is **quiet and
editorial**: a serious reading tool, closer to a well-set book or a scholarly
apparatus than to a SaaS dashboard.

Concretely:

- **Paper, not sepia.** Bright neutral off-white ground, near-black ink. Dark
  mode is a genuinely dark neutral, not navy. E-ink mode is pure grayscale with
  hard edges and no shadows at all.
- **One accent: gold.** Used for the read marker, active state, and little else.
  Never a second accent. Never a gradient.
- **Type does the work.** IBM Plex Sans / IBM Plex Mono for chrome and metadata;
  Source Serif 4 or Literata for reading prose. Real typographic hierarchy —
  size, weight, spacing, small caps for labels — instead of boxes and color.
- **Density over air.** This is a tool someone uses for hours. Compact rows,
  tight vertical rhythm, information close together. Not a landing page.
- **Borders and rules, not cards and shadows.** Hairline 1px dividers. At most
  one very soft shadow anywhere, and probably zero.
- **Sharp or barely-rounded corners.** 0–2px. Nothing pill-shaped except where a
  pill is genuinely the right control.

Banned, because they are the fingerprints of generated design:

- Gradient backgrounds, glassmorphism/backdrop blur, glow effects, neon.
- Rounded container with a colored left-border accent stripe.
- Emoji as UI iconography.
- Inter, Roboto, Arial, system-ui as the display face.
- Purple-to-blue anything. Two-tone "AI" accents.
- Big centered hero sections, marketing-style empty states with an illustration
  and a cheerful headline, onboarding modals, feature-tour tooltips.
- Stat cards, sparkline dashboards, "streak" gamification, badges, confetti.
- Icon + label + description stacked in a three-column grid.

**Copy rules, which matter as much as the visuals:**

- No self-narrating UI. The interface does not describe itself, congratulate the
  user, or explain what a button will do in a subtitle under the button.
- No `noun · qualifier · qualifier` middot pileups.
- No exposed pseudo-code, ids, or internal type names in the UI. Human refs
  only: "source · section", never a block hash.
- Lowercase, terse labels. Keyboard hints where a keyboard shortcut exists.
- Empty states are one quiet line, or nothing.
- When in doubt, delete the words. Every review pass should remove copy, not add
  it.

A good test: screenshot any screen, and it should read as a piece of software
someone maintained for years for their own use — not something produced to be
demoed.

## How to work

- Start with `FORMAT.md` and the parser + round-trip tests. Do not write UI until
  parse/serialize is a fixed point.
- Then the vault layer (watch, read, write, conflict tolerance), then the tree,
  then the reader, then the queue.
- Commit in small, reviewable steps. Each milestone should run.
- Ask before adding any screen, section, or setting that isn't in this brief or
  the prototype.
