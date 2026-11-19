# Plugins

A plugin is a folder in the collection, `.ilmi/plugins/<id>/`, holding three
files. It is off until it is turned on in tweaks (⌘,), runs with the app's
access to the vault and the network and nothing else, and a throw anywhere
in it is caught, shown as a notice naming the plugin, and turns it off for
the session. The API is ilmi's own and versioned; everything a plugin can do
through it, the app does through the same functions.

```
.ilmi/
  plugins.json            the ids that are on
  plugins/
    hello/
      plugin.json         id, name, version, api, description, author, repo
      main.js             one CommonJS bundle: module.exports.activate(ilmi)
      style.css           optional
      data.json           the plugin's settings and data, written by the app
```

`.ilmi/` is never a document and never appears in the tree.

## The handle

`activate(ilmi)` is called with the handle below and may return a function
to run on deactivate. Every registration returns a disposer; the runtime
calls them all when the plugin is turned off, the vault closes, or the
plugin's files change on disk (it is then reloaded, with a notice). The
types are in [`plugins/ilmi.d.ts`](plugins/ilmi.d.ts); `api` is `2`. A plugin
whose `plugin.json` says `1` runs as it did: 2 only added `scheduler` and
`cache`.

```
ilmi.version, ilmi.api, ilmi.manifest
ilmi.commands.add({ id, name, key?, run })           the palette and the key map
ilmi.selection.addAction({ id, name, key?, when?, run(sel) })
                                                     a verb on the selection cue;
                                                     sel = { text, path, block, rect, context, page? }
ilmi.render.onBlock(fn(el, { path, block, where }))  after a block is drawn: the reader,
                                                     a deck's rows, a session card's faces
ilmi.vault.list() read(path) write(path, text) create(path, text) remove(path) rename(path, name) watch(fn)
ilmi.vault.doc(path) update(path, fn(doc)) addCard(deck, text, { sched? }) addSource(folder, { title, text })
ilmi.queue.today()  queue.on('change', fn)
ilmi.session.current()  session.on('grade' | 'read-on' | 'worked-on', fn)
ilmi.lens.active()  lens.open(path)  lens.on('open' | 'selection', fn)
ilmi.ui.notice(text)  ui.popover(rect, el)  ui.modal(el)  ui.settings(fn(s))
ilmi.net.fetch(url, init?)                           through the app, no CORS
ilmi.store.load() save(data) get(key) on('change', fn)   data.json
ilmi.scheduler.register({ id, name, recall? | next?, preview?, curve?, prepare?, observe? })
                                                     a scheduler for the cards (below)
ilmi.cache.get(key) put(key, bytes) remove(key)      bytes on this device, outside the collection
ilmi.format.parse serialize cardForm cardFields setField meta
ilmi.onDeactivate(fn)
```

Notes on a few of them:

- `sel.context` is the sentence around the selection (Latin, Arabic, and
  Urdu stops), else the line it sits in, else the selection itself. In the
  PDF lens the context is the text-layer line.
- `onBlock` runs once per drawn element until its text changes, and again
  after a reload, so a hook that changes the DOM should leave what it
  already changed alone (the sample checks for its own class). The reader's
  surface is a ProseMirror editor: wrap text in spans, do not change it.
- `addCard` creates the deck when it is missing (`type: deck`, named after
  the file), and the folders on the way to it, and refuses text that is not
  a card by FORMAT.md §5.
- `ui.settings` takes a builder that runs each time the section draws:
  `s.text(key, label, { placeholder? })`, `s.toggle(key, label)`,
  `s.choice(key, label, options)`, `s.note(text)`. Each control is bound to
  `key` in `data.json`; read values with `ilmi.store.get(key)`.
- `ui.popover` and `ui.modal` take an element you built and style the box
  as the palette; esc, a press outside, or `close()` ends it. The box has
  focus when it opens, so listen on the `el` that comes back
  (`pop.el.addEventListener('keydown', …)`); keys pressed inside stay inside
  (the app's bare keys do not see them), and a popover whose content grows
  after it opened is placed again so it stays on screen.
- A command's `key` is `h`, `shift+h`, or `mod+shift+h`; an action's is a
  bare key. `e` and `m` belong to the cue and are refused. The app's own
  keys (`r`, `j`, `k`, `p`, `d`, `o`, `[`, `]`, space, the digits) are not
  guarded; stay off them.
- Paths are vault-relative with `/`; one that climbs out of the vault is
  refused.

## A scheduler

`ilmi.scheduler.register(spec)` adds a scheduler to the `scheduler` row in
tweaks, beside `built in` and `fsrs-7` (which the app carries, through this
same slot: `src/schedule/fsrs7.ts` is a scheduler like any plugin's). One is in use at a time, and which is the
collection's choice (`.ilmi/scheduler.json`), so every device means the same
one; a device where it is not installed, or is off, says so once and uses
the built in.

The built in (FSRS) is always underneath. Every grade still writes its
state to the card's `sr` line, whatever is chosen, and nothing a scheduler
says is written anywhere: it is asked again, from the review log, on each
device. So a device without the plugin, a session where it failed, and any
other app reading the files schedule from FSRS with nothing lost.

A scheduler is one of two kinds, and may be async throughout:

- `recall(cards, ctx)` gives each card's chance of recall now, 0 to 1. A
  card is due when that is at or under the retention it is studied at
  (`card.retention`), and among the cards it scored the lowest recall
  against its target comes first. There are no dates. `null` for a card
  leaves it to the built in.
- `next(card, grade, ctx)` gives `{ due }` after a grade. It is asked as of
  the card's last review (`card.history` is the reviews before it, `ctx.now`
  when it was given), so the same date comes out of the log everywhere.

And, optionally: `preview(card, ctx)`, the four grades' `{ due }` for the
buttons' `back in` words (without it they say nothing, never FSRS's days);
`curve(card, days, ctx)`, recall that many days from now, which is what the
upcoming list, the forecast and an exam's count read for a date-less
scheduler (without it they read FSRS's day); `prepare(history, ctx)`, the
whole review log, oldest first, when the scheduler is chosen and whenever
the log changes other than by a review added at its end (a sync);
`observe(review, ctx)` for each review added.

```ts
import type { Ilmi, SchedulerCard } from '../ilmi.js';

const DAY = 86_400_000;
// each review passed doubles the days recall takes to halve; `again` starts over
const halfLife = (c: SchedulerCard) => c.history.reduce((h, r) => (r.g === 1 ? 1 : h * 2), 1);
const recallAt = (c: SchedulerCard, at: number) => {
  const last = c.history[c.history.length - 1];
  return last ? 0.5 ** ((at - Date.parse(last.at)) / DAY / halfLife(c)) : null;
};

export function activate(ilmi: Ilmi) {
  ilmi.scheduler.register({
    id: 'recall-sample',
    name: 'recall sample',
    recall: (cards, { now }) => cards.map((c) => recallAt(c, now.getTime())),
    curve: (card, days, { now }) => days.map((d) => recallAt(card, now.getTime() + d * DAY) ?? 0),
  });
}
```

What it is handed, and when:

- A card is one line of a card: a cloze group and a both-ways card's
  reverse are cards of their own, named by `id` and `key` as the review log
  names them. With it come its document (`path`), the retention it is
  studied at, its own reviews oldest first (`history`), and FSRS's state
  from its `sr` line (`fsrs`).
- It is asked about cards that have a review and are out of their learning
  steps. A new card, and a card minutes from due in its steps (`again`, a
  first `good`), are the app's: the day's new cards, learnt once, asked
  again before the session ends. Suspended cards are never asked about.
  What holds a card back for a day holds as before: the day's allowances,
  one direction of a both-ways card and one of two linked cards a day, an
  exam's days.
- It is asked a moment after the queue is built, after each grade, and
  every ten minutes while a date-less one is in use. Nothing waits for it:
  a grade is written first, and until new scores are in the queue shows the
  last ones; a card graded since its score is FSRS's until the next comes.
- A throw, an answer for other cards than were asked, or more than ten
  seconds on one call (two minutes on `prepare`) fails the plugin as any
  throw does: one notice, the plugin off for the session, and the built in
  schedules.

`ilmi.cache` keeps bytes (`Uint8Array`) for the plugin on this device, for
this collection, under the app's data directory: not in the collection, not
synced, not exported. It is for what is costly to make again and can be: a
model's state over the review log, say, stamped with how much of the log it
covers. 64 MB a plugin at most.

## Writing one

The repo carries its plugins under `plugins/<id>/` as TypeScript or ES
modules typed against `plugins/ilmi.d.ts`:

```ts
import type { Ilmi } from '../ilmi.js';

export function activate(ilmi: Ilmi) {
  ilmi.commands.add({ id: 'say-hi', name: 'hello: say hi', run: () => ilmi.ui.notice('hi') });
}
```

`npm run plugins` bundles each one with esbuild into
`plugins/dist/<id>/main.js` (one file, dependencies included, so `require`
is never needed and serves nothing at run time), copies `plugin.json` and
`style.css` beside it, zips the folder flat as `plugins/dist/<id>.zip`, and
regenerates `plugins/ilmi.d.ts` from `src/plugins/api.ts`. The shipped
plugins are also copied into the corpus vault for the tests (the sample on,
the rest off), so run it after changing one. A plugin's own tests live
beside it in `plugins/<id>/__tests__/` and run with `npx vitest run`; the
helpers in `src/plugins/__tests__/memfs.ts` give them the corpus vault in a
collection in memory and a bridge that remembers its notices and fetches.

## The ones here

- `hello`: the sample, one of everything.
- `recall-sample`: a sample scheduler, a few lines (the ones above, and the
  buttons' outcomes): a demo of the slot, not a memory model.
- `dictionary`: `look up` on the selection cue (key `d`) normalizes the
  word (Arabic: tashkeel and tatweel stripped, then the clitics `و` `ف` `ب`
  `ك` `ل` `ال` `لل` `س` tried off the front, one at a time and in that
  order, and a second one after a conjunction), asks Wiktionary's REST
  definitions endpoint, and shows the entries of the word's language section
  in a popover: the headword with the vowels the selection had, part of
  speech, definitions, the first example. `add to deck` there (key `a`)
  writes `<headword> :: <first definition>` to the deck in its settings
  (`vocab` at the root by default, made when missing), with the sentence
  around the word as a second line of the back while `context on the back`
  is on. Another dictionary goes in `dictionary url` (`{word}` and `{lang}`
  are filled) with `definitions at`, a JSON path to its definition strings
  (`[].meanings[].definitions[].definition` reads dictionaryapi.dev);
  `language` fixes the section (`ar`, `en`, …) instead of going by script.

Outside the repo, any bundler that produces one CommonJS file does. Keep
`id` to lowercase letters, digits, and hyphens; it is the folder's name.

## Installing one

In tweaks, `add a plugin` takes a `.zip` and `from a folder` a directory; a
`.zip` or folder dropped on the section does the same. The package needs
`plugin.json` and `main.js` (and may hold `style.css`), zipped flat or
under one folder. It lands in `.ilmi/plugins/<id>/` under the manifest's id
and is turned on. The same id already there with the same version is
refused with a notice; with another version, `replace` is offered.

A collection is a database (milestone 59), so a bundler can no longer write
into it and have the plugin reload on every build: add the built folder
again with `from a folder` (a new `version` in `plugin.json` gets `replace`
offered). `reload` on the row runs what the collection holds again. An
exported collection carries its plugins under `.ilmi/plugins/`, and an
imported folder brings them in.

## Publishing

Zip the three files flat and share the zip. There is no directory yet; the
user adds a plugin from a file.
