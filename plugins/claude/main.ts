// Claude beside the pages: a chat in a panel in the inspector's place
// (`ilmi.ui.panel`), where Claude reads, searches and edits the collection's
// documents and adds cards through the tools in `tools.ts`, each write held
// to `guard.ts` and shown in the chat with an undo. The Claude API is called
// through the app's fetch with the person's own API key, which is kept on
// the device (`ilmi.cache.device`) and never in the collection, so it does
// not sync, export or reach a git remote. The conversation is the
// session's: `new chat` starts another.

import Anthropic from '@anthropic-ai/sdk';
import type { BetaContentBlockParam, BetaMessage, BetaMessageParam, BetaToolResultBlockParam, BetaToolUseBlock } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import type { Ilmi, Selection } from '../ilmi.js';
import { CollectionTools, TOOLS, type Change } from './tools.js';

export const MODEL = 'claude-opus-5-5';
const KEY = 'anthropic-api-key';
export const EFFORTS = ['low', 'medium', 'high'] as const;
type Effort = (typeof EFFORTS)[number];

export const SYSTEM = `You are Claude, working inside ilmi, a study app the person uses for notes, readings and spaced-repetition cards. You are in a panel beside their documents. You can list, search, read and open documents, edit them, create them, and add cards. Every change you make is shown to the person with an undo.

How ilmi stores things (Markdown files, one document each):
- Front matter between --- lines: \`type: deck\` for a deck of cards; a note has no type. Study options there (\`new-per-day\`, \`retention\`, \`exam: 2026-12-14 final\`) apply to everything under the document.
- A card is a paragraph (or a list item) whose text makes it one: \`front :: back\`; \`left ::: right\` for a card asked both ways; a cloze, with blanks \`{{c1::answer}}\` (blanks with the same number are asked together; blanks may nest, as \`{{c8::{{c1::a}} {{c2::b}}}}\`); or a front, a line holding only \`?\` (or \`??\` for both ways), then a back on the lines after it.
- The app owns the lines under a card: a \`^id\` at the end of its last line, and schedule lines \`<!-- sr … -->\` directly under it, with no blank line between. Never write, change or move a schedule line or an id apart from its card. A new card has neither: the app writes them at its first review. To reword a card that has them, change only its words and keep them as they are. A cloze blank keeps its number when reworded.
- Other comment lines (\`<!-- read … -->\`, \`<!-- extract … -->\`, \`<!-- box … -->\`) and front-matter \`read:\` and \`write:\` lines are the app's too; leave them.

How to work:
- Read a document before you edit it, and change it with the smallest exact replacement that does the job. Keep its language, script and style (Arabic stays Arabic, with its diacritics); match how its cards are already written.
- Cards should each test one thing, with a short, unambiguous answer.
- Before deleting cards or rewriting much of a document, say what you will do and ask.
- An edit that breaks the rules above is refused with the reason; fix it and try again.
- Reply briefly and plainly. Name documents by their path.`;

// ── a little Markdown, as DOM nodes (no HTML is ever parsed) ──────

/** `rtl` when a line has more Arabic-script letters than Latin ones: a sentence in English that opens with an Arabic word stays left to right, as `dir="auto"` (the first letter) would not keep it. */
export function dirOf(text: string): 'rtl' | 'ltr' {
  // letters only: the marks (harakat, shadda) are not counted, or a voweled word outweighs a sentence
  const rtl = (text.match(/(?=\p{L})[\p{Script=Arabic}\p{Script=Hebrew}]/gu) ?? []).length;
  const ltr = (text.match(/(?=\p{L})\p{Script=Latin}/gu) ?? []).length;
  return rtl > ltr ? 'rtl' : 'ltr';
}

function inline(parent: HTMLElement, text: string): void {
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let at = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > at) parent.append(text.slice(at, m.index));
    const t = m[0];
    const el = document.createElement(t.startsWith('**') ? 'strong' : 'code');
    el.textContent = t.startsWith('**') ? t.slice(2, -2) : t.slice(1, -1);
    parent.append(el);
    at = m.index! + t.length;
  }
  if (at < text.length) parent.append(text.slice(at));
}

/** Paragraphs, `-` and `1.` lists, fenced code, **bold** and `code`, into `el`. */
export function renderMarkdown(el: HTMLElement, text: string): void {
  el.replaceChildren();
  const lines = text.split('\n');
  let list: HTMLElement | null = null;
  let para: string[] = [];
  const flush = () => {
    if (para.length) {
      const p = document.createElement('p');
      p.dir = dirOf(para.join('\n'));
      inline(p, para.join('\n'));
      el.append(p);
      para = [];
    }
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.startsWith('```')) {
      flush(); list = null;
      const pre = document.createElement('pre');
      const body: string[] = [];
      for (i++; i < lines.length && !lines[i]!.startsWith('```'); i++) body.push(lines[i]!);
      pre.textContent = body.join('\n');
      pre.dir = dirOf(pre.textContent);
      el.append(pre);
      continue;
    }
    const item = /^\s*(?:[-*]|\d+[.)])\s+(.*)$/.exec(line);
    if (item) {
      flush();
      const ordered = /^\s*\d/.test(line);
      if (!list || (list.tagName === 'OL') !== ordered) { list = document.createElement(ordered ? 'ol' : 'ul'); el.append(list); }
      const li = document.createElement('li');
      li.dir = dirOf(item[1]!);
      inline(li, item[1]!);
      list.append(li);
      continue;
    }
    if (!line.trim()) { flush(); list = null; continue; }
    list = null;
    para.push(line.replace(/^#+\s+/, ''));
  }
  flush();
}

// ── the chat ─────────────────────────────────────────────────────

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
};

/** What the person was looking at, said at the head of each of their messages (the system prompt stays the same, so it caches). */
export function contextNote(ilmi: Ilmi, sel: Selection | null, now: Date): string {
  const lens = ilmi.lens.active();
  const parts = [`today is ${now.toISOString().slice(0, 10)}`];
  if (lens && !lens.path.startsWith(':')) parts.push(`the open ${lens.kind === 'folder' ? 'folder' : lens.path.endsWith('.pdf') ? 'PDF' : 'document'} is ${lens.path}`);
  if (sel?.text.trim()) parts.push(`they have selected, in ${sel.path}: “${sel.text.trim().slice(0, 2000)}”`);
  return `<context>${parts.join('; ')}</context>`;
}

class Chat {
  readonly el = h('div', 'claude-chat');
  private log = h('div', 'cc-log');
  private input = h('textarea', 'cc-input');
  private send = h('button', 'cc-send', 'send');
  private messages: BetaMessageParam[] = [];
  private abort: AbortController | null = null;
  private quote: Selection | null = null;
  private quoteEl = h('div', 'cc-quote');
  private tools: CollectionTools;

  constructor(private ilmi: Ilmi, private keyOf: () => Promise<string | null>, private effort: () => Effort, private selection: () => Selection | null) {
    this.tools = new CollectionTools(ilmi);
    const head = h('div', 'cc-head');
    const fresh = h('button', 'cc-new', 'new chat');
    fresh.type = 'button';
    fresh.onclick = () => this.reset();
    head.append(h('span', 'cc-model', 'claude opus 5.5'), fresh);
    this.input.placeholder = 'ask claude about your notes and cards';
    this.input.rows = 3;
    this.input.dir = 'auto';
    this.input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); void this.submit(); }
    });
    this.send.type = 'button';
    this.send.onclick = () => (this.abort ? this.abort.abort() : void this.submit());
    this.quoteEl.hidden = true;
    const foot = h('div', 'cc-foot');
    const row = h('div', 'cc-row');
    row.append(this.input, this.send);
    foot.append(this.quoteEl, row);
    this.el.append(head, this.log, foot);
    this.empty();
  }

  private empty(): void {
    this.log.replaceChildren(h('p', 'cc-hint', 'claude can read, search and edit your documents and add cards. every change shows here with an undo.'));
  }

  focus(): void {
    this.input.focus();
  }

  /** The panel is going: a reply still coming is stopped. */
  stop(): void {
    this.abort?.abort();
  }

  /** Ask about a passage: it rides with the next message. */
  quoteSelection(sel: Selection): void {
    this.quote = sel;
    this.quoteEl.hidden = false;
    this.quoteEl.replaceChildren(h('span', 'cc-quote-t', sel.text.trim().slice(0, 300)));
    const x = h('button', 'cc-quote-x', '×');
    x.type = 'button';
    x.onclick = () => { this.quote = null; this.quoteEl.hidden = true; };
    this.quoteEl.append(x);
    this.quoteEl.dir = dirOf(sel.text);
    this.focus();
  }

  private reset(): void {
    this.abort?.abort();
    this.messages = [];
    this.empty();
  }

  private scroll(): void {
    this.log.scrollTop = this.log.scrollHeight;
  }

  private line(cls: string, text: string): HTMLElement {
    const el = h('div', cls, text);
    el.dir = dirOf(text);
    this.log.append(el);
    this.scroll();
    return el;
  }

  private changeLine(c: Change): void {
    const row = h('div', 'cc-change');
    row.append(h('span', 'cc-change-t', `${c.verb} ${c.path}`));
    const open = h('button', 'cc-link', 'open');
    open.type = 'button';
    open.onclick = () => this.ilmi.lens.open(c.path);
    const undo = h('button', 'cc-link', 'undo');
    undo.type = 'button';
    undo.onclick = async () => {
      undo.disabled = true;
      const said = await this.tools.undo(c);
      undo.textContent = said.startsWith('undone') ? 'undone' : 'changed since';
      // Claude hears of it with the next message
      this.messages.push({ role: 'user', content: [{ type: 'text', text: `<context>the person undid this change: ${c.verb} ${c.path}</context>` }] });
    };
    row.append(open, undo);
    this.log.append(row);
    this.scroll();
  }

  private busy(on: boolean): void {
    this.send.textContent = on ? 'stop' : 'send';
    this.el.dataset.busy = on ? '1' : '0';
  }

  async submit(): Promise<void> {
    const text = this.input.value.trim();
    if (!text || this.abort) return;
    const key = await this.keyOf();
    if (!key) {
      this.line('cc-error', 'add an anthropic api key in tweaks › plugins › claude first');
      return;
    }
    if (!this.messages.length) this.log.replaceChildren();
    this.input.value = '';
    const sel = this.quote ?? this.selection();
    this.quote = null;
    this.quoteEl.hidden = true;
    this.line('cc-user', text);
    this.messages.push({ role: 'user', content: [{ type: 'text', text: contextNote(this.ilmi, sel, new Date()) }, { type: 'text', text }] });
    this.abort = new AbortController();
    this.busy(true);
    try {
      await this.run(new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, fetch: ((url: string, init?: RequestInit) => this.ilmi.net.fetch(url, init)) as never, maxRetries: 2 }), this.abort.signal);
    } finally {
      this.abort = null;
      this.busy(false);
    }
  }

  private async run(client: Anthropic, signal: AbortSignal): Promise<void> {
    let retries = 0;
    for (;;) {
      const reply = h('div', 'cc-reply');
      const wait = h('div', 'cc-wait', 'thinking…');
      this.log.append(wait);
      this.scroll();
      let text = '';
      const stream = client.beta.messages.stream({
        model: MODEL,
        max_tokens: 64000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        thinking: { type: 'adaptive' },
        output_config: { effort: this.effort() },
        cache_control: { type: 'ephemeral' },
        system: SYSTEM,
        tools: TOOLS,
        messages: this.messages,
      }, { signal });
      stream.on('text', (d) => {
        if (!text) { wait.remove(); this.log.append(reply); }
        text += d;
        renderMarkdown(reply, text);
        this.scroll();
      });
      stream.on('streamEvent', (ev) => {
        if (ev.type === 'content_block_start' && ev.content_block.type === 'tool_use') wait.textContent = `${ev.content_block.name.replace(/_/g, ' ')}…`;
      });
      let msg: BetaMessage;
      try {
        msg = await stream.finalMessage();
        retries = 0;
      } catch (e) {
        wait.remove();
        if (signal.aborted) { this.line('cc-note', 'stopped'); return; }
        if (e instanceof Anthropic.AuthenticationError) { this.line('cc-error', 'the api key was refused; set it again in tweaks › plugins › claude'); return; }
        if (e instanceof Anthropic.RateLimitError) { this.line('cc-error', 'too many requests just now; try again in a moment'); return; }
        if (e instanceof Anthropic.APIConnectionError) { this.line('cc-error', 'could not reach claude: no connection'); return; }
        if (e instanceof Anthropic.APIError) { this.line('cc-error', `claude answered with an error: ${e.message}`); return; }
        // a tool input that would not parse, or a stream cut short: ask the same turn again
        if (retries++ < 2) continue;
        this.line('cc-error', `the reply broke off: ${e instanceof Error ? e.message : String(e)}`);
        return;
      }
      wait.remove();
      this.messages.push({ role: 'assistant', content: msg.content as BetaContentBlockParam[] });
      if (msg.stop_reason === 'refusal') { this.line('cc-note', 'claude declined to go on with this'); return; }
      if (msg.stop_reason === 'pause_turn') continue;
      const uses = msg.content.filter((b): b is BetaToolUseBlock => b.type === 'tool_use');
      if (!uses.length) return;
      if (msg.stop_reason === 'max_tokens') { this.line('cc-error', 'the reply ran out of room in the middle of a change; nothing was written'); this.messages.pop(); return; }
      const results: BetaToolResultBlockParam[] = [];
      for (const u of uses) {
        if (signal.aborted) {
          results.push({ type: 'tool_result', tool_use_id: u.id, content: 'stopped by the person before this ran', is_error: true });
          continue;
        }
        const out = await this.tools.run(u.name, u.input);
        if (out.change) this.changeLine(out.change);
        else if (out.isError) this.line('cc-tool cc-tool-err', `${u.name.replace(/_/g, ' ')}: ${out.text.split('\n')[0]}`);
        else if (out.shown) this.line('cc-tool', out.shown);
        results.push({ type: 'tool_result', tool_use_id: u.id, content: out.text, ...(out.isError ? { is_error: true } : {}) });
      }
      this.messages.push({ role: 'user', content: results });
      if (signal.aborted) { this.line('cc-note', 'stopped'); return; }
    }
  }
}

// ── the plugin ───────────────────────────────────────────────────

const enc = new TextEncoder();
const dec = new TextDecoder();

export function activate(ilmi: Ilmi) {
  let key: string | null | undefined;
  const keyOf = async () => {
    if (key === undefined) {
      const bytes = await ilmi.cache.device.get(KEY);
      key = bytes ? dec.decode(bytes).trim() || null : null;
    }
    return key;
  };
  const effort = (): Effort => {
    const e = ilmi.store.get<string>('effort');
    return (EFFORTS as readonly string[]).includes(e ?? '') ? (e as Effort) : 'medium';
  };
  let selection: Selection | null = null;
  ilmi.lens.on('selection', (s) => { selection = s; });

  let chat: Chat | null = null;
  ilmi.ui.panel({
    id: 'chat',
    name: 'claude',
    mount: (el) => {
      chat = new Chat(ilmi, keyOf, effort, () => selection);
      el.append(chat.el);
      return () => { chat?.stop(); chat?.el.remove(); chat = null; };
    },
  });
  const show = () => { ilmi.ui.showPanel('chat'); setTimeout(() => chat?.focus(), 0); };
  ilmi.commands.add({ id: 'open', name: 'claude: open the chat', run: show });
  ilmi.selection.addAction({
    id: 'ask',
    name: 'ask claude',
    run: (sel) => {
      show();
      setTimeout(() => chat?.quoteSelection(sel), 0);
    },
  });

  const askKey = async () => {
    const box = h('div', 'claude-key');
    box.append(h('p', '', 'an api key from console.anthropic.com. it stays on this device: it is not in the collection, so it does not sync or export.'));
    const field = h('input', 'claude-key-field');
    field.type = 'password';
    field.placeholder = 'sk-ant-…';
    field.autocomplete = 'off';
    const save = h('button', '', 'save');
    save.type = 'button';
    box.append(field, save);
    const m = ilmi.ui.modal(box);
    await new Promise<void>((done) => {
      const finish = async () => {
        const v = field.value.trim();
        if (v) {
          await ilmi.cache.device.put(KEY, enc.encode(v));
          key = v;
        }
        m.close();
        done();
      };
      save.onclick = () => void finish();
      field.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') void finish(); if (e.key === 'Escape') { m.close(); done(); } });
      setTimeout(() => field.focus(), 0);
      // a press outside or esc closes the box without a word
      const watch = setInterval(() => { if (!m.el.isConnected) { clearInterval(watch); done(); } }, 300);
    });
  };

  ilmi.ui.settings((s) => {
    const has = key === undefined ? null : !!key;
    s.action(has ? 'api key: on this device' : has === false ? 'api key: none yet' : 'api key', has ? 'replace' : 'add', askKey);
    if (has) s.action('', 'remove the key', async () => { await ilmi.cache.device.remove(KEY); key = null; });
    s.choice('effort', 'effort', EFFORTS);
    s.note(`model ${MODEL}. what claude sends and reads is billed to the key's account.`);
  });
  void keyOf();
}
