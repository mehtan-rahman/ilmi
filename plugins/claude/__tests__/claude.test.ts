// @vitest-environment jsdom
//
// The claude plugin: the guard over an edit (schedule lines, ids, cloze
// numbers, diagnostics), the tools over the corpus vault (search without
// Arabic marks, an edit, a refused edit, a new deck, a card added, undo),
// and, through the runtime, the panel in the inspector's place and a whole
// turn of the chat against a scripted Claude API: the request it sends (the
// model, the fallback, caching, the tools streaming their input, no key in
// the collection), a read and an edit run as tools, the edit shown with an
// undo that puts the text back, and a stop. No request leaves the test.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parse, serialize, cardForm, cardFields, setField, meta } from '../../../src/format/index.js';
import { ROOT, Vault, enable, fakeBridge, memFs, seed, sleep, type MemFs } from '../../../src/plugins/__tests__/memfs.js';
import { PluginHost, type Bridge } from '../../../src/plugins/runtime.js';
import type { Format, Ilmi } from '../../ilmi.js';
import { editProblems } from '../guard.js';
import { MODEL, contextNote, dirOf, renderMarkdown } from '../main.js';
import { CollectionTools, TOOLS, validInput } from '../tools.js';

const format = { parse, serialize, cardForm, cardFields, setField, meta } as unknown as Format;

const DECK = `---
type: deck
---

what does promulgate mean? :: to enact into law ^c1weoxl
<!-- sr due=2027-01-22 st=review s=65.6 d=1 r=2 l=0 ivl=66 last=2026-11-17T16:41:36Z g=4 -->

باب نصر {{c1::نَصَرَ}} {{c2::يَنْصُرُ}} ^cp9i0um
<!-- sr c1 due=2027-01-03 st=review s=41.8 d=1 r=2 l=0 ivl=42 last=2026-11-23T04:45:01Z g=4 -->
<!-- sr c2 due=2026-12-22 st=review s=29.8 d=1.4 r=4 l=0 ivl=30 last=2026-11-23T04:40:30Z g=4 -->
`;

describe('the guard', () => {
  it('lets words change and cards come and go, schedule lines and ids kept', () => {
    expect(editProblems(format, DECK, DECK.replace('to enact into law', 'to put a law into effect'))).toEqual([]);
    expect(editProblems(format, DECK, `${DECK}\nobviate :: to remove a need\n`)).toEqual([]);
    const gone = DECK.replace(/what does promulgate[^\n]*\n<!--[^\n]*-->\n/, '');
    expect(editProblems(format, DECK, gone)).toEqual([]);
    expect(editProblems(format, null, '---\ntype: deck\n---\n\nlaconic ::: using few words\n')).toEqual([]);
  });

  it('refuses a schedule line changed, written new, or lost, an id dropped, and a blank renumbered', () => {
    const one = (after: string) => editProblems(format, DECK, after);
    expect(one(DECK.replace('due=2027-01-22', 'due=2026-11-24'))).toEqual([expect.stringMatching(/promulgate.*its sr line changed/)]);
    expect(one(`${DECK}\nnew :: card\n<!-- sr due=2026-12-01 st=review s=3 d=5 r=1 l=0 ivl=3 -->\n`)).toEqual([expect.stringMatching(/"new :: card" has a sr line it did not have/)]);
    expect(one(DECK.replace(/<!-- sr c2[^\n]*\n/, ''))).toEqual([expect.stringMatching(/its sr c2 line is gone/)]);
    expect(one(DECK.replace(' ^c1weoxl', ''))).toEqual([expect.stringMatching(/lost its \^c1weoxl/)]);
    expect(one(DECK.replace('{{c2::', '{{c3::'))).toEqual([expect.stringMatching(/schedule for c2 but no blank/)]);
  });

  it('refuses a diagnostic the document did not have', () => {
    expect(editProblems(format, DECK, DECK.replace('type: deck', 'type: deck\nretention: 1.5'))).toEqual([expect.stringMatching(/^line 3: .*retention/)]);
  });
});

describe('the tools', () => {
  it('say what they take, strings only, nothing more', () => {
    expect(TOOLS.map((t) => t.name)).toEqual(['list_documents', 'search', 'read_document', 'edit_document', 'create_document', 'add_card', 'open_document']);
    expect(TOOLS.every((t) => t.eager_input_streaming === true)).toBe(true);
    expect(validInput('edit_document', { path: 'a.md', old_text: 'x', new_text: '' })).toEqual({ path: 'a.md', old_text: 'x', new_text: '' });
    expect(validInput('edit_document', { path: 'a.md', old_text: 'x' })).toBeNull();
    expect(validInput('read_document', { path: 'a.md', extra: '1' })).toBeNull();
    expect(validInput('read_document', { path: 3 })).toBeNull();
  });
});

// ── through the runtime ──────────────────────────────────────────

async function until<T>(probe: () => T | null | undefined | false, ms = 4000): Promise<T> {
  const t0 = Date.now();
  for (;;) {
    const v = probe();
    if (v) return v;
    if (Date.now() - t0 > ms) throw new Error('timed out');
    await sleep(10);
  }
}

/** A streamed reply as the Messages API sends it. */
function sse(blocks: ({ text: string } | { tool: string; input: Record<string, string> })[], stop = blocks.some((b) => 'tool' in b) ? 'tool_use' : 'end_turn'): Response {
  const ev: [string, unknown][] = [['message_start', { type: 'message_start', message: { id: 'msg_1', type: 'message', role: 'assistant', model: MODEL, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 0 } } }]];
  blocks.forEach((b, index) => {
    if ('text' in b) {
      ev.push(['content_block_start', { type: 'content_block_start', index, content_block: { type: 'text', text: '' } }]);
      for (const part of b.text.match(/.{1,12}/gsu) ?? []) ev.push(['content_block_delta', { type: 'content_block_delta', index, delta: { type: 'text_delta', text: part } }]);
    } else {
      ev.push(['content_block_start', { type: 'content_block_start', index, content_block: { type: 'tool_use', id: `toolu_${index}${b.tool}`, name: b.tool, input: {} } }]);
      const json = JSON.stringify(b.input);
      for (let i = 0; i < json.length; i += 20) ev.push(['content_block_delta', { type: 'content_block_delta', index, delta: { type: 'input_json_delta', partial_json: json.slice(i, i + 20) } }]);
    }
    ev.push(['content_block_stop', { type: 'content_block_stop', index }]);
  });
  ev.push(['message_delta', { type: 'message_delta', delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: 20 } }]);
  ev.push(['message_stop', { type: 'message_stop' }]);
  const body = ev.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join('');
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream', 'request-id': 'req_test' } });
}

describe('in the app', () => {
  let fs: MemFs;
  let vault: Vault;
  let host: PluginHost;
  let requests: { url: string; headers: Headers; body: Record<string, unknown> }[];
  let replies: (() => Response | Promise<Response>)[];
  let cache: Map<string, Uint8Array>;
  let shown: string[];

  const open = async () => {
    vault = await Vault.open(fs, ROOT);
    const base = fakeBridge();
    const bridge: Bridge = {
      ...base,
      fetch: async (url, init) => {
        requests.push({ url: String(url), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body ?? '{}')) });
        const next = replies.shift();
        if (!next) throw new Error('no reply scripted');
        return next();
      },
      cache: {
        get: async (p, k, d) => cache.get(`${d ? 'device' : 'here'}/${p}/${k}`) ?? null,
        put: async (p, k, b, d) => { cache.set(`${d ? 'device' : 'here'}/${p}/${k}`, b); },
        remove: async (p, k, d) => { cache.delete(`${d ? 'device' : 'here'}/${p}/${k}`); },
      },
      showPanel: (key) => shown.push(key),
    };
    host = new PluginHost(vault, bridge);
    await host.start();
  };

  beforeEach(async () => {
    requests = [];
    replies = [];
    cache = new Map([['device/claude/anthropic-api-key', new TextEncoder().encode('sk-ant-test')]]);
    shown = [];
    fs = memFs();
    await seed(fs, ['claude']);
    await enable(fs, ['claude']);
    await open();
  });

  afterEach(() => {
    host.stop();
    document.body.innerHTML = '';
  });

  const mount = () => {
    const el = document.createElement('div');
    document.body.append(el);
    const undo = host.mountPanel('claude:chat', el);
    return { el, undo };
  };
  const ask = async (el: HTMLElement, text: string) => {
    const input = el.querySelector<HTMLTextAreaElement>('.cc-input')!;
    input.value = text;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  };

  it('adds a panel named claude, a command and a verb, and shows the panel by its key', async () => {
    expect(host.rows().find((r) => r.id === 'claude')?.state).toBe('on');
    expect(host.panels()).toEqual([{ key: 'claude:chat', plugin: 'claude', name: 'claude' }]);
    expect(host.actionsFor({ text: 'Vorsatz', path: 'german.md', block: 0, rect: { top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 }, context: 'der Vorsatz' }).map((a) => a.name)).toContain('ask claude');
    const { el, undo } = mount();
    expect(el.querySelector('.claude-chat')).not.toBeNull();
    expect(el.querySelector('.cc-hint')!.textContent).toContain('undo');
    undo();
    await host.setEnabled('claude', false);
    expect(host.panels()).toEqual([]);
  });

  it('a panel filled, emptied and filled again holds one chat (React mounts twice in development)', () => {
    const el = document.createElement('div');
    document.body.append(el);
    host.mountPanel('claude:chat', el)();
    expect(el.childElementCount).toBe(0);
    host.mountPanel('claude:chat', el);
    expect(el.querySelectorAll('.claude-chat')).toHaveLength(1);
  });

  it('reads, edits with an undo, and answers, in one turn, the key never in the collection', async () => {
    const before = (await fs.get(`${ROOT}/german.md`))!;
    replies.push(
      () => sse([{ text: 'let me look.' }, { tool: 'read_document', input: { path: 'german.md' } }]),
      () => sse([{ tool: 'edit_document', input: { path: 'german.md', old_text: 'resolution; intention', new_text: 'resolution, intention' } }]),
      () => sse([{ text: 'done: **der Vorsatz** now reads `resolution, intention`.' }]),
    );
    const { el } = mount();
    await ask(el, 'use a comma in der Vorsatz');
    await until(() => el.querySelector('.cc-reply strong'));
    await until(() => el.querySelector('.claude-chat')!.getAttribute('data-busy') === '0');

    // what was sent
    expect(requests).toHaveLength(3);
    const first = requests[0]!;
    expect(first.url).toBe('https://api.anthropic.com/v1/messages');
    expect(first.headers.get('authorization')).toBe('Bearer sk-ant-test');
    expect(first.headers.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01');
    expect(first.body).toMatchObject({ model: 'claude-opus-5-5', max_tokens: 64000, stream: true, fallbacks: 'default', thinking: { type: 'adaptive' }, output_config: { effort: 'medium' }, cache_control: { type: 'ephemeral' } });
    expect((first.body.tools as { name: string }[]).map((t) => t.name)).toContain('edit_document');
    const userTurn = (first.body.messages as { role: string; content: { text: string }[] }[])[0]!;
    expect(userTurn.content[0]!.text).toMatch(/^<context>today is \d{4}-\d\d-\d\d; the open document is german\.md<\/context>$/);
    expect(userTurn.content[1]!.text).toBe('use a comma in der Vorsatz');
    // the second request carries the read's result, the third the edit's
    const results = (i: number) => (requests[i]!.body.messages as { role: string; content: { type: string; content?: string; is_error?: boolean }[] }[]).at(-1)!.content;
    expect(results(1)[0]).toMatchObject({ type: 'tool_result', content: before });
    expect(results(2)[0]).toMatchObject({ type: 'tool_result', content: 'edited german.md' });
    expect(results(2)[0]!.is_error).toBeUndefined();

    // what it did, and what the chat says
    const after = (await fs.get(`${ROOT}/german.md`))!;
    expect(after).toBe(before.replace('resolution; intention', 'resolution, intention'));
    expect(el.querySelector('.cc-user')!.textContent).toBe('use a comma in der Vorsatz');
    expect(el.querySelector('.cc-tool')!.textContent).toBe('read german.md');
    expect(el.querySelector('.cc-change-t')!.textContent).toBe('edited german.md');
    expect([...el.querySelectorAll('.cc-reply')].map((r) => r.textContent)).toEqual(['let me look.', 'done: der Vorsatz now reads resolution, intention.']);
    // the key is on the device, not in the collection
    for (const p of vault.documents()) expect(await fs.get(`${ROOT}/${p}`)).not.toContain('sk-ant-test');
    expect(await fs.get(`${ROOT}/.ilmi/plugins/claude/data.json`) ?? '').not.toContain('sk-ant-test');

    // undo puts it back, once
    const undo = [...el.querySelectorAll<HTMLButtonElement>('.cc-link')].find((b) => b.textContent === 'undo')!;
    undo.click();
    await until(() => undo.textContent === 'undone');
    expect((await fs.get(`${ROOT}/german.md`))!).toBe(before);
  });

  it('hands a refused edit back to claude with the reason, and writes nothing', async () => {
    const before = (await fs.get(`${ROOT}/german.md`))!;
    replies.push(
      () => sse([{ tool: 'edit_document', input: { path: 'german.md', old_text: 'due=2026-05-27 st=review s=3', new_text: 'due=2026-06-27 st=review s=3' } }]),
      () => sse([{ text: 'that line is the app\'s; I left it.' }]),
    );
    const { el } = mount();
    await ask(el, 'push der Vorsatz back a month');
    await until(() => el.querySelector('.cc-reply'));
    await until(() => el.querySelector('.claude-chat')!.getAttribute('data-busy') === '0');
    const result = (requests[1]!.body.messages as { content: { content?: string; is_error?: boolean }[] }[]).at(-1)!.content[0]!;
    expect(result.is_error).toBe(true);
    expect(result.content).toMatch(/not written, nothing changed:\n- .*its sr line changed/);
    expect((await fs.get(`${ROOT}/german.md`))!).toBe(before);
    expect(el.querySelector('.cc-tool-err')!.textContent).toBe('edit document: not written, nothing changed:');
  });

  it('says a refused key plainly, and asks for one when there is none', async () => {
    replies.push(() => new Response(JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }), { status: 401, headers: { 'content-type': 'application/json' } }));
    const { el } = mount();
    await ask(el, 'hello');
    await until(() => el.querySelector('.cc-error'));
    expect(el.querySelector('.cc-error')!.textContent).toBe('the api key was refused; set it again in tweaks › plugins › claude');
    cache.clear();
    host.stop();
    await open();
    const again = mount();
    await ask(again.el, 'hello');
    await until(() => again.el.querySelector('.cc-error'));
    expect(again.el.querySelector('.cc-error')!.textContent).toMatch(/^add an anthropic api key/);
    expect(requests).toHaveLength(1);
  });

  it('stops when asked, mid-reply', async () => {
    let release: (() => void) | null = null;
    replies.push(() => new Promise<Response>((done, fail) => {
      release = () => fail(new DOMException('aborted', 'AbortError'));
      void done;
    }));
    const { el } = mount();
    await ask(el, 'a long question');
    await until(() => release);
    expect(el.querySelector('.cc-send')!.textContent).toBe('stop');
    el.querySelector<HTMLButtonElement>('.cc-send')!.click();
    release!();
    await until(() => el.querySelector('.cc-note'));
    expect(el.querySelector('.cc-note')!.textContent).toBe('stopped');
    expect(el.querySelector('.claude-chat')!.getAttribute('data-busy')).toBe('0');
  });
});

describe('the tools over the corpus', () => {
  let host: PluginHost;
  let ilmi: Ilmi;
  let tools: CollectionTools;

  beforeEach(async () => {
    const fs = memFs();
    await seed(fs, []);
    // a handle as a plugin gets one, by way of a plugin of the test's own
    let handle: Ilmi | null = null;
    (globalThis as { __grab?: (i: Ilmi) => void }).__grab = (i) => { handle = i; };
    await fs.put(`${ROOT}/.ilmi/plugins/grab/plugin.json`, JSON.stringify({ id: 'grab', name: 'grab', version: '1.0.0', api: 4 }));
    await fs.put(`${ROOT}/.ilmi/plugins/grab/main.js`, 'module.exports.activate = (i) => globalThis.__grab(i);');
    await enable(fs, ['grab']);
    host = new PluginHost(await Vault.open(fs, ROOT), fakeBridge());
    await host.start();
    ilmi = await until(() => handle);
    tools = new CollectionTools(ilmi);
  });

  afterEach(() => host.stop());

  it('search finds Arabic without its marks, and a word in any case; .ilmi is not a document', async () => {
    await ilmi.vault.create('arabic.md', '---\ntype: deck\n---\n\nnasara {{c1::نَصَرَ}}\n');
    expect((await tools.run('search', { query: 'نصر' })).text).toBe('arabic.md:5: nasara {{c1::نَصَرَ}}');
    expect((await tools.run('search', { query: 'VORSATZ' })).text).toMatch(/^german\.md:\d+: der Vorsatz/);
    expect((await tools.run('read_document', { path: '.ilmi/plugins.json' })).isError).toBe(true);
    expect((await tools.run('edit_document', { path: 'german.md', old_text: 'nowhere in it', new_text: 'x' })).text).toMatch(/^old_text is not in german\.md/);
  });

  it('makes a deck and adds a card to it, each undone in turn', async () => {
    const made = await tools.run('create_document', { path: 'words/new.md', text: '---\ntype: deck\n---\n\nlaconic ::: using few words\n' });
    expect(made).toMatchObject({ text: 'created words/new.md', change: { path: 'words/new.md', before: null, verb: 'created' } });
    const added = await tools.run('add_card', { deck: 'words/new.md', text: 'terse :: brief' });
    expect(added.text).toBe('added the card to words/new.md');
    expect(added.change!.after).toContain('terse :: brief');
    expect((await tools.run('add_card', { deck: 'words/new.md', text: 'just prose' })).isError).toBe(true);
    expect(await tools.undo(made.change!)).toBe('words/new.md has changed since, so it was left as it is');
    expect(await tools.undo(added.change!)).toBe('undone: added a card to words/new.md');
    expect(await tools.undo(made.change!)).toBe('undone: created words/new.md');
    expect(ilmi.vault.list()).not.toContain('words/new.md');
  });
});

describe('the chat\'s words', () => {
  it('draws Markdown as elements, never as HTML', () => {
    const el = document.createElement('div');
    renderMarkdown(el, 'a **bold** `code` <img src=x onerror=alert(1)>\n\n- one\n- two\n\n```\nx :: y\n```');
    expect(el.innerHTML).toBe('<p dir="ltr">a <strong>bold</strong> <code>code</code> &lt;img src=x onerror=alert(1)&gt;</p><ul><li dir="ltr">one</li><li dir="ltr">two</li></ul><pre dir="ltr">x :: y</pre>');
  });

  it('lays a line out by the script it is mostly in', () => {
    expect(dirOf('ظَلَّ as a نَاقِص verb, like أَصْبَحَ and كَانَ')).toBe('ltr');
    expect(dirOf('أَصْبَحَ: فِعْلٌ مَاضٍ نَاقِصٌ (a past verb)')).toBe('rtl');
  });


  it('says what is open and selected at the head of a message', () => {
    const ilmi = { lens: { active: () => ({ path: 'arabic/sarf.md', kind: 'deck' }) } } as unknown as Ilmi;
    const sel = { text: ' نَصَرَ ', path: 'arabic/sarf.md', block: 2, rect: { top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 }, context: '' };
    expect(contextNote(ilmi, sel, new Date('2026-11-23T10:00:00Z'))).toBe('<context>today is 2026-11-23; the open document is arabic/sarf.md; they have selected, in arabic/sarf.md: “نَصَرَ”</context>');
    expect(contextNote({ lens: { active: () => ({ path: ':queue', kind: 'queue' }) } } as unknown as Ilmi, null, new Date('2026-11-23T10:00:00Z'))).toBe('<context>today is 2026-11-23</context>');
  });
});
