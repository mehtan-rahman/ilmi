// Generated from src/plugins/api.ts by `npm run plugins`; edit that file.
// The plugin API, version 1: what `activate(ilmi)` is handed. Types only;
// this file is copied verbatim to `plugins/ilmi.d.ts` by `npm run plugins`,
// so a plugin's TypeScript sees the same names the app does. Everything a
// plugin can do through this handle, the app does through the same
// functions. A registration returns a disposer; the runtime calls every
// disposer when the plugin is turned off, the vault closes, or its files
// change on disk.

/** The API version this file describes. A plugin's manifest names the one it was written for. */
export type ApiVersion = 1;

/** `plugin.json`. */
export interface PluginManifest {
  /** Lowercase letters, digits, and hyphens; the folder name under `.ilmi/plugins/`. */
  id: string;
  name: string;
  version: string;
  /** The API version the plugin was written against; must be the app's. */
  api: ApiVersion;
  description?: string;
  author?: string;
  repo?: string;
}

/** Every registration gives one of these back. Calling it twice is harmless. */
export type Dispose = () => void;

// ── documents, as the format module sees them ───────────────────

export type NodeType = 'note' | 'source' | 'deck' | 'draft' | 'extract';
export type CardForm = 'cloze' | 'qa' | 'bidir';

export interface Heading { kind: 'heading'; level: number; text: string; setext?: true }
export interface Paragraph { kind: 'paragraph'; text: string; id?: string; extracts?: string[] }
export interface CardSchedule {
  due?: string;
  state?: 'new' | 'learning' | 'review' | 'relearning';
  stability?: number;
  difficulty?: number;
  reps?: number;
  lapses?: number;
  steps?: number;
  ivl?: number;
  last?: string;
  grade?: number;
  pri?: number;
}
export interface Card { kind: 'card'; text: string; id?: string; sched?: CardSchedule; blanks?: Record<number, CardSchedule>; extracts?: string[] }
export interface Raw { kind: 'raw'; text: string }
export type Block = Heading | Paragraph | Card | Raw;

/** A parsed file. Front-matter is opaque here; change it through `ilmi.format.setField`. */
export interface Doc {
  frontmatter?: unknown;
  blocks: Block[];
}

export interface Diagnostic { line: number; message: string }

/** A cloze's blank: its answer and its group number, when numbered. */
export interface Blank { answer: string; n: number | null; raw: string }

export type CardFields =
  | { form: 'cloze'; parts: (string | Blank)[] }
  | { form: 'qa'; front: string; back: string }
  | { form: 'bidir'; left: string; right: string };

export interface Format {
  parse(text: string): { doc: Doc; diagnostics: Diagnostic[] };
  serialize(doc: Doc): string;
  /** `cloze`, `qa`, `bidir`, or null when the text is not a card. */
  cardForm(text: string): CardForm | null;
  /** The sides of a card's text, or null when it is not one. */
  cardFields(text: string): CardFields | null;
  /** Read or set a front-matter field: `type`, `title`, `frozen`, `pri`, and the rest FORMAT.md names. `null` removes. */
  setField(doc: Doc, key: string, value: unknown): void;
  meta(doc: Doc): { type: NodeType; title?: string; frozen: boolean; pri?: number };
}

// ── the vault ────────────────────────────────────────────────────

export type VaultEvent =
  | { kind: 'tree' }
  | { kind: 'doc'; path: string }
  | { kind: 'gone'; path: string }
  | { kind: 'moved'; from: string; to: string };

export interface VaultApi {
  /** The vault directory's name. */
  name: string;
  /** Every document path, tree order, vault-relative with `/`. */
  list(): string[];
  /** A file's text. Any file inside the vault. */
  read(path: string): Promise<string>;
  /** Replace a file's text. A document goes through the format module and is normalized; other files are written as they are. */
  write(path: string, text: string): Promise<void>;
  /** A new file; `path` must not exist. Resolves to the path as written (a document is renamed `name 2.md` when the name is taken). */
  create(path: string, text: string): Promise<string>;
  remove(path: string): Promise<void>;
  /** A new file name (no extension) for a document or folder; resolves to the new path. */
  rename(path: string, name: string): Promise<string>;
  /** Vault changes, as the app sees them. */
  watch(fn: (ev: VaultEvent) => void): Dispose;
  /** A document, parsed. A copy: change it through `update`. */
  doc(path: string): Promise<Doc>;
  /** Change a document; `fn` runs on a copy and may run again if the file moved on disk in between. */
  update(path: string, fn: (doc: Doc) => void): Promise<void>;
  /**
   * Append a card paragraph to a deck, creating the deck when it is missing
   * (`vocab.md` at the root, `words/arabic.md` in a folder). Resolves to the
   * card's block index.
   */
  addCard(deck: string, text: string, opts?: { sched?: CardSchedule }): Promise<number>;
  /** A frozen source from text in `folder` (`''` for the root); resolves to its path. */
  addSource(folder: string, spec: { title: string; text: string }): Promise<string>;
}

// ── the queue, the session, the lenses ───────────────────────────

export type ElementKind = 'card' | 'read' | 'write';

/** One element of the queue, as the app lists it. */
export interface QueueElement {
  kind: ElementKind;
  path: string;
  /** The card's block index, for a card. */
  block?: number;
  text?: string;
  /** When it is due, as an ISO instant. */
  due: string;
  pri: number;
}

export interface QueueApi {
  /** What is due today, in the order the session walks it. */
  today(): QueueElement[];
  on(event: 'change', fn: () => void): Dispose;
}

export type Grade = 1 | 2 | 3 | 4;

export interface GradeEvent { element: QueueElement; grade: Grade; card: Card | null }
export interface SessionApi {
  /** The element the session is on, or null outside a session. */
  current(): QueueElement | null;
  on(event: 'grade', fn: (ev: GradeEvent) => void): Dispose;
  on(event: 'read-on' | 'worked-on', fn: (ev: { element: QueueElement }) => void): Dispose;
}

export type LensKind = NodeType | 'folder' | 'queue' | 'session' | 'intake';

export interface Lens {
  /** A vault path, or an id starting with `:` for the queue, the session, and the intake. */
  path: string;
  kind: LensKind;
}

/** Where on screen something is; a `DOMRect` fits. */
export interface Rect { top: number; left: number; bottom: number; right: number; width: number; height: number }

/** A selection in a lens: text, where it lives, where it sits, and the sentence or line around it. */
export interface Selection {
  text: string;
  /** The document's path. */
  path: string;
  /** The block index the selection ends in, when known. */
  block: number | null;
  rect: Rect;
  /** The sentence around the selection, else the line; the selection itself when nothing more is known. */
  context: string;
  /** The PDF page the selection is on, in the PDF lens. */
  page?: number;
}

export interface LensApi {
  active(): Lens | null;
  open(path: string): void;
  on(event: 'open', fn: (lens: Lens) => void): Dispose;
  on(event: 'selection', fn: (sel: Selection | null) => void): Dispose;
}

// ── what a plugin adds ───────────────────────────────────────────

export interface CommandSpec {
  /** Unique within the plugin. */
  id: string;
  /** As the palette lists it: lowercase, terse. */
  name: string;
  /** `h`, `shift+h`, `mod+shift+h`; a bare letter works when no field has focus. */
  key?: string;
  run(): void | Promise<void>;
}

export interface SelectionActionSpec {
  id: string;
  /** The verb on the cue, after `extract` and `card`. */
  name: string;
  /** A bare key, as `e` and `m` are. */
  key?: string;
  /** When given, the verb shows only where this says so. */
  when?(sel: Selection): boolean;
  run(sel: Selection): void | Promise<void>;
}

export interface BlockContext {
  path: string;
  /** The block's index among the document's blocks, when known. */
  block: number | null;
  /** The reader's surface, a deck's rows, or a session card's faces. */
  where: 'reader' | 'deck' | 'face';
}

export type BlockHook = (el: HTMLElement, ctx: BlockContext) => void;

export interface Popover {
  el: HTMLElement;
  close(): void;
}

/** The settings builder: each call adds a control under the plugin's row in tweaks, bound to a key of `data.json`. */
export interface Settings {
  text(key: string, label: string, opts?: { placeholder?: string }): void;
  toggle(key: string, label: string): void;
  choice(key: string, label: string, options: readonly string[]): void;
  /** One quiet line. */
  note(text: string): void;
}

export interface UiApi {
  /** One line in the queue's log, as the app's own notices. */
  notice(text: string): void;
  /** `el` under `rect`, styled as the palette; esc, a click outside, or `close()` ends it. One at a time. */
  popover(rect: Rect, el: HTMLElement): Popover;
  /** `el` centered over a dimmed canvas; esc, a click outside, or `close()` ends it. One at a time. */
  modal(el: HTMLElement): Popover;
  /** Controls under the plugin's row in tweaks; `build` runs each time the section draws. */
  settings(build: (s: Settings) => void): Dispose;
}

export type StoreData = Record<string, unknown>;

export interface StoreApi {
  /** `data.json` in the plugin's folder; `{}` when there is none. */
  load(): Promise<StoreData>;
  /** Replaces the file. */
  save(data: StoreData): Promise<void>;
  /** The data as last loaded or saved, without waiting. */
  get<T = unknown>(key: string): T | undefined;
  /** When the data changes: a setting edited in tweaks, `save`, or the file on disk. */
  on(event: 'change', fn: (data: StoreData) => void): Dispose;
}

export interface NetApi {
  /** `fetch` through the app, so no page's CORS rules apply. */
  fetch(url: string, init?: RequestInit): Promise<Response>;
}

/** The handle `activate` receives. */
export interface Ilmi {
  /** The app's version. */
  version: string;
  api: ApiVersion;
  /** The plugin's own manifest. */
  manifest: PluginManifest;
  commands: { add(spec: CommandSpec): Dispose };
  selection: { addAction(spec: SelectionActionSpec): Dispose };
  render: { onBlock(fn: BlockHook): Dispose };
  vault: VaultApi;
  queue: QueueApi;
  session: SessionApi;
  lens: LensApi;
  ui: UiApi;
  net: NetApi;
  store: StoreApi;
  format: Format;
  /** Runs when the plugin is turned off, the vault closes, or the plugin reloads. */
  onDeactivate(fn: () => void): Dispose;
}

/** What `main.js` exports: `module.exports.activate = (ilmi) => { … }`. */
export interface PluginModule {
  activate(ilmi: Ilmi): void | Dispose | Promise<void | Dispose>;
}
