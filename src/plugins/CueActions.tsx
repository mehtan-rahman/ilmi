// The verbs plugins add to the selection cue, after `extract` and `card`.
// The lens passes the selection it built; each verb runs the plugin's action.

import type { Selection } from './api.js';
import { usePlugins } from './index.js';

export function CueActions({ sel, onRun }: { sel: Selection; onRun?: () => void }) {
  const host = usePlugins();
  if (!host) return null;
  const actions = host.actionsFor(sel);
  if (!actions.length) return null;
  return (
    <>
      {actions.map((a) => (
        <button
          key={a.id}
          type="button"
          className="cue-act plug"
          onMouseDown={(e) => {
            e.preventDefault();
            host.runAction(a.id, sel);
            onRun?.();
          }}
        >
          {a.name}
          {a.key !== undefined && <span className="kbd">{a.key}</span>}
        </button>
      ))}
    </>
  );
}
