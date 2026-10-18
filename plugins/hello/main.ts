// The sample plugin. Everything a plugin can do, once: a palette command, a
// verb on the selection cue, a hook on drawn blocks, one setting, and an
// ear on the session's grades. Built to `plugins/dist/hello/main.js` by
// `npm run plugins`; the corpus vault carries a copy for the tests.

import type { Ilmi } from '../ilmi.js';

const WORD = /\[hello\]/g;

export function activate(ilmi: Ilmi): () => void {
  const greeting = () => (ilmi.store.get<string>('greeting') ?? '').trim() || 'hi';

  ilmi.commands.add({ id: 'say-hi', name: 'hello: say hi', run: () => ilmi.ui.notice(greeting()) });

  ilmi.selection.addAction({
    id: 'count',
    name: 'hello: count',
    run: (sel) => {
      const n = sel.text.split(/\s+/).filter(Boolean).length;
      ilmi.ui.notice(`${n} word${n === 1 ? '' : 's'}`);
    },
  });

  // light every `[hello]` in prose; a hook may run again on the same element, so lit text is left alone
  ilmi.render.onBlock((el) => {
    if (!el.textContent?.includes('[hello]')) return;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.textContent?.includes('[hello]') && !(n.parentElement?.closest('.hello-lit'))) nodes.push(n as Text);
    }
    for (const node of nodes) {
      const parts = node.textContent!.split(WORD);
      if (parts.length < 2) continue;
      const frag = document.createDocumentFragment();
      parts.forEach((part, i) => {
        if (i > 0) {
          const lit = document.createElement('span');
          lit.className = 'hello-lit';
          lit.textContent = '[hello]';
          frag.appendChild(lit);
        }
        if (part) frag.appendChild(document.createTextNode(part));
      });
      node.replaceWith(frag);
    }
  });

  ilmi.ui.settings((s) => {
    s.text('greeting', 'greeting', { placeholder: 'hi' });
  });

  ilmi.session.on('grade', (ev) => ilmi.ui.notice(`hello saw a ${ev.grade}`));

  return () => { /* nothing of its own to undo: the runtime takes the registrations back */ };
}
