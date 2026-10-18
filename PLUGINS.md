# Plugins

A plugin is a folder in the vault, `.ilmi/plugins/<id>/`, holding three
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
types are in [`plugins/ilmi.d.ts`](plugins/ilmi.d.ts); `api` is `1`.

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
helpers in `src/plugins/__tests__/memfs.ts` give them the corpus vault in an
in-memory fs and a bridge that remembers its notices and fetches.

## The ones here

- `hello`: the sample, one of everything.
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

To develop against a vault, point your bundler's output at
`<vault>/.ilmi/plugins/<id>/main.js`: every write reloads the plugin, with
a notice. `reload` on the row does the same by hand.

## Publishing

Zip the three files flat and share the zip. There is no directory yet; the
user adds a plugin from a file.
