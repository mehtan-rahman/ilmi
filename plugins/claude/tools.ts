// What Claude can do in the collection, through the plugin API and nothing
// else: list, search and read documents, open one, and change them by an
// exact replacement, a new document, or a card added to a deck. Every write
// is held to `guard.ts` first and remembered with what it replaced, so the
// chat can undo it. Documents only: nothing under `.ilmi/`, no PDFs.

import type { BetaTool } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import type { Ilmi } from '../ilmi.js';
import { editProblems, removedCards } from './guard.js';

/** A change made, as the chat shows it and undoes it. */
export interface Change {
  path: string;
  /** The text before; null when the change made the document. */
  before: string | null;
  after: string;
  /** What the chat says of it: `edited`, `created`, `added a card to`. */
  verb: string;
}

export interface ToolOutcome {
  /** What Claude reads back. */
  text: string;
  isError?: boolean;
  change?: Change;
  /** A short line for the chat: what was looked at. */
  shown?: string;
}

/** The marks Arabic search leaves out on both sides: harakat, tanwin, shadda, sukun, dagger alif, tatweel. */
const MARKS = /[ً-ْٰـ]/g;
const fold = (s: string) => s.replace(MARKS, '').toLowerCase();
const MAX_READ = 400_000;
const MAX_HITS = 60;

export const TOOLS: BetaTool[] = [
  {
    name: 'list_documents',
    description: 'List the documents (Markdown files) in the collection, optionally under one folder. Paths are relative to the collection, with `/`.',
    input_schema: { type: 'object', properties: { folder: { type: 'string', description: 'Only documents under this folder, e.g. `arabic`. Omit for all.' } }, additionalProperties: false },
    eager_input_streaming: true,
  },
  {
    name: 'search',
    description: 'Find lines that contain the text, across every document. Case and Arabic diacritics are ignored. Returns `path:line: text` for each match.',
    input_schema: { type: 'object', properties: { query: { type: 'string' }, folder: { type: 'string', description: 'Only under this folder.' } }, required: ['query'], additionalProperties: false },
    eager_input_streaming: true,
  },
  {
    name: 'read_document',
    description: 'Read a document as it is stored, schedule lines included. Read a document before editing it.',
    input_schema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'], additionalProperties: false },
    eager_input_streaming: true,
  },
  {
    name: 'edit_document',
    description: 'Replace one exact passage of a document with new text. `old_text` must occur exactly once, copied from read_document including whitespace; give enough around it to make it unique. To delete, make `new_text` empty. Schedule lines (`<!-- sr … -->`) and a card\'s `^id` must stay exactly as they are; an edit that changes them is refused.',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string' }, old_text: { type: 'string' }, new_text: { type: 'string' } },
      required: ['path', 'old_text', 'new_text'],
      additionalProperties: false,
    },
    eager_input_streaming: true,
  },
  {
    name: 'create_document',
    description: 'Make a new document at a path ending in `.md` that does not exist yet. A deck starts with front matter `---\\ntype: deck\\n---`. Write no schedule lines.',
    input_schema: { type: 'object', properties: { path: { type: 'string' }, text: { type: 'string' } }, required: ['path', 'text'], additionalProperties: false },
    eager_input_streaming: true,
  },
  {
    name: 'add_card',
    description: 'Append one card to a deck, making the deck when it is missing. `text` is the card as written in ilmi: `front :: back`, `left ::: right` for both ways, a cloze with `{{c1::…}}`, or a front, a line `?`, and a back.',
    input_schema: { type: 'object', properties: { deck: { type: 'string', description: 'The deck\'s path, e.g. `misc/english vocab.md`.' }, text: { type: 'string' } }, required: ['deck', 'text'], additionalProperties: false },
    eager_input_streaming: true,
  },
  {
    name: 'open_document',
    description: 'Open a document in the app for the person to see.',
    input_schema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'], additionalProperties: false },
    eager_input_streaming: true,
  },
];

const REQUIRED: Record<string, string[]> = Object.fromEntries(TOOLS.map((t) => [t.name, ((t.input_schema as { required?: string[] }).required ?? [])]));

/** The input's fields, when every one the tool needs is a string and nothing else is there; null otherwise. */
export function validInput(name: string, input: unknown): Record<string, string> | null {
  const need = REQUIRED[name];
  if (!need || !input || typeof input !== 'object' || Array.isArray(input)) return null;
  const tool = TOOLS.find((t) => t.name === name)!;
  const props = Object.keys((tool.input_schema as { properties?: object }).properties ?? {});
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(input)) {
    if (!props.includes(k) || typeof v !== 'string') return null;
    out[k] = v;
  }
  return need.every((k) => k in out) ? out : null;
}

const clean = (p: string) => p.trim().replace(/^\.?\/+/, '');
const isDocument = (p: string) => p.endsWith('.md') && !p.startsWith('.ilmi/') && !p.split('/').includes('..');
const under = (p: string, folder?: string) => !folder || p.startsWith(`${clean(folder).replace(/\/+$/, '')}/`);

export class CollectionTools {
  constructor(private ilmi: Ilmi) {}

  private documents(folder?: string): string[] {
    return this.ilmi.vault.list().filter((p) => isDocument(p) && under(p, folder)).sort();
  }

  async run(name: string, raw: unknown): Promise<ToolOutcome> {
    const input = validInput(name, raw);
    if (!input) return { text: `the input for ${name} was incomplete or malformed: ${JSON.stringify(raw)}`, isError: true };
    try {
      switch (name) {
        case 'list_documents': return this.list(input.folder);
        case 'search': return await this.search(input.query!, input.folder);
        case 'read_document': return await this.read(clean(input.path!));
        case 'edit_document': return await this.edit(clean(input.path!), input.old_text!, input.new_text!);
        case 'create_document': return await this.create(clean(input.path!), input.text!);
        case 'add_card': return await this.addCard(clean(input.deck!), input.text!);
        case 'open_document': return this.open(clean(input.path!));
      }
      return { text: `no tool named ${name}`, isError: true };
    } catch (e) {
      return { text: e instanceof Error ? e.message : String(e), isError: true };
    }
  }

  private list(folder?: string): ToolOutcome {
    const docs = this.documents(folder);
    return { text: docs.length ? docs.join('\n') : 'no documents there', shown: folder ? `listed ${folder}` : 'listed the documents' };
  }

  private async search(query: string, folder?: string): Promise<ToolOutcome> {
    const q = fold(query.trim());
    if (!q) return { text: 'an empty query', isError: true };
    const hits: string[] = [];
    let more = 0;
    for (const p of this.documents(folder)) {
      const lines = (await this.ilmi.vault.read(p)).split('\n');
      lines.forEach((line, i) => {
        if (!fold(line).includes(q)) return;
        if (hits.length < MAX_HITS) hits.push(`${p}:${i + 1}: ${line.length > 200 ? `${line.slice(0, 197)}…` : line}`);
        else more++;
      });
    }
    const text = hits.length ? hits.join('\n') + (more ? `\n… and ${more} more matches; narrow the query or the folder` : '') : 'no matches';
    return { text, shown: `searched for “${query.trim()}”` };
  }

  private async read(path: string): Promise<ToolOutcome> {
    if (!isDocument(path)) return { text: `${path} is not a document (a .md file outside .ilmi/)`, isError: true };
    if (!this.ilmi.vault.list().includes(path)) return { text: `no document at ${path}; list_documents or search to find it`, isError: true };
    const text = await this.ilmi.vault.read(path);
    if (text.length > MAX_READ) return { text: `${path} is ${text.length} characters, more than can be read at once; search it for the part you need`, isError: true };
    return { text, shown: `read ${path}` };
  }

  private async write(path: string, before: string | null, after: string, verb: string): Promise<ToolOutcome> {
    const problems = editProblems(this.ilmi.format, before, after);
    if (problems.length) return { text: `not written, nothing changed:\n- ${problems.join('\n- ')}`, isError: true };
    if (before === null) await this.ilmi.vault.create(path, after);
    else await this.ilmi.vault.write(path, after);
    const stored = await this.ilmi.vault.read(path);
    const gone = before === null ? [] : removedCards(this.ilmi.format, before, stored);
    const said = gone.length ? ` (removed ${gone.length} card${gone.length > 1 ? 's' : ''} with a schedule: ${gone.map((t) => `"${t}"`).join(', ')})` : '';
    return { text: `${verb} ${path}${said}`, change: { path, before, after: stored, verb } };
  }

  private async edit(path: string, oldText: string, newText: string): Promise<ToolOutcome> {
    if (!isDocument(path)) return { text: `${path} is not a document`, isError: true };
    if (!this.ilmi.vault.list().includes(path)) return { text: `no document at ${path}`, isError: true };
    if (!oldText) return { text: 'old_text is empty; to add text, replace a passage next to where it goes', isError: true };
    const before = await this.ilmi.vault.read(path);
    const at = before.indexOf(oldText);
    if (at < 0) return { text: `old_text is not in ${path}; read it again and copy the passage exactly`, isError: true };
    if (before.indexOf(oldText, at + 1) >= 0) return { text: `old_text occurs more than once in ${path}; include more around it`, isError: true };
    return this.write(path, before, before.slice(0, at) + newText + before.slice(at + oldText.length), 'edited');
  }

  private async create(path: string, text: string): Promise<ToolOutcome> {
    if (!isDocument(path)) return { text: `${path} must end in .md and be outside .ilmi/`, isError: true };
    if (this.ilmi.vault.list().includes(path)) return { text: `${path} exists; edit it instead`, isError: true };
    return this.write(path, null, text, 'created');
  }

  private async addCard(deck: string, text: string): Promise<ToolOutcome> {
    const path = deck.endsWith('.md') ? deck : `${deck}.md`;
    if (!isDocument(path)) return { text: `${path} is not a document`, isError: true };
    if (!this.ilmi.format.cardForm(text.trim())) return { text: `that is not a card in ilmi's format: ${text}`, isError: true };
    const before = this.ilmi.vault.list().includes(path) ? await this.ilmi.vault.read(path) : null;
    const problems = editProblems(this.ilmi.format, '', text);
    if (problems.length) return { text: `not added:\n- ${problems.join('\n- ')}`, isError: true };
    await this.ilmi.vault.addCard(path, text.trim());
    const after = await this.ilmi.vault.read(path);
    return { text: `added the card to ${path}`, change: { path, before, after, verb: 'added a card to' } };
  }

  private open(path: string): ToolOutcome {
    if (!this.ilmi.vault.list().includes(path)) return { text: `no document at ${path}`, isError: true };
    this.ilmi.lens.open(path);
    return { text: `opened ${path}`, shown: `opened ${path}` };
  }

  /** Put a change back: the text before, or no document where the change made it; refused when the document has changed since. */
  async undo(c: Change): Promise<string> {
    const now = this.ilmi.vault.list().includes(c.path) ? await this.ilmi.vault.read(c.path) : null;
    if (now !== c.after) return `${c.path} has changed since, so it was left as it is`;
    if (c.before === null) await this.ilmi.vault.remove(c.path);
    else await this.ilmi.vault.write(c.path, c.before);
    return `undone: ${c.verb} ${c.path}`;
  }
}
