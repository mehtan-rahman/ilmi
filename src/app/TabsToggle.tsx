// The `tabs` toggle in the reader's top row (milestone 39): on any document
// with children, outside another notebook, a quiet word that sets or clears
// the document's `tabs` field (FORMAT.md §3), so its children show as tabs
// in a rail beside its page, or as rows in the tree only. The node menu's
// `show as tabs` / `show as tree` is the same switch.

import { useApp } from './store.js';
import { showsTabsToggle } from './tabs.js';
import { setTabs } from './vault.js';

export function TabsToggle({ path }: { path: string }) {
  const tree = useApp((s) => s.tree);
  const docs = useApp((s) => s.docs);
  if (!showsTabsToggle(path, tree, docs)) return null;
  const on = !!docs[path]?.tabs;
  return (
    <button
      type="button"
      className="frozen-tag tabs-toggle"
      data-on={on ? '1' : '0'}
      title={on ? 'show the children in the tree only' : 'show the children as tabs beside the page'}
      onClick={() => { setTabs(path, !on).catch((e: unknown) => console.error(e)); }}
    >
      tabs
    </button>
  );
}
