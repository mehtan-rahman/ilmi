# ilmi

Incremental reading, spaced-repetition cards, and incremental writing over a
directory of plain Markdown files. The files are the model; the app is a lens.

- `FORMAT.md` is the on-disk contract. `src/format/` implements it.
- `spec/hashiyah/` is the hi-fi prototype: the decided spec for behavior and feel.
- `PLAN.md` is the build order.

## Running

Requires node (Homebrew: `/opt/homebrew/bin`) and a Rust toolchain
(`curl https://sh.rustup.rs | sh`, then `~/.cargo/bin` on `PATH`).

```
npm install
npm run tauri dev      # desktop window; first Rust build takes a few minutes
npm run dev            # renderer only, in a browser at http://localhost:1420
npm test               # format round-trip and vault tests
npm run typecheck
```

In a dev build, `ILMI_VAULT=/path/to/vault npm run tauri dev` opens that vault
at launch instead of asking for one.

Theme toggle, until the tweaks panel exists, from the devtools console
(right-click → Inspect Element in the window):

```
ilmi.theme('dark')     // 'light' | 'dark' | 'eink'
ilmi.cycleTheme()
ilmi.density(0.8)
```

## Layout

```
index.html         Vite entry
src/app/           renderer: React, Zustand store, tokens.css
src/format/        parser and serializer, the only code that touches vault files
src/vault/         open, walk, read, write, watch a vault; pure over an Fs interface
src-tauri/         desktop shell (Tauri v2, fs + dialog + log plugins)
```
