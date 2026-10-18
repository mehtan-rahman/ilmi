// The `plugins` section of tweaks: a row per plugin found under
// `.ilmi/plugins/` with its toggle, a `reload` for authors, its settings
// inline when it has any, and `add a plugin` from a `.zip` or a folder; a
// package dropped on the section does the same.

import { getCurrentWebview, type DragDropEvent } from '@tauri-apps/api/webview';
import { open as pickPath } from '@tauri-apps/plugin-dialog';
import { useEffect, useRef, useState } from 'react';
import { addPluginFromPath, pluginHooks, usePlugins } from './index.js';
import type { PluginHost, PluginRow, SettingControl } from './runtime.js';

/** A `.zip` whose id is here already with another version: the user says. */
interface Offer {
  path: string;
  name: string;
  have: string;
  incoming: string;
}

/** A text setting: commits on blur or ⏎, escape restores. */
function TextSetting({ value, placeholder, onCommit }: { value: string; placeholder?: string; onCommit(v: string): void }) {
  const [text, setText] = useState(value);
  useEffect(() => { setText(value); }, [value]);
  return (
    <input
      className="pl-text"
      type="text"
      value={text}
      placeholder={placeholder}
      spellCheck={false}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => { if (text !== value) onCommit(text); }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); onCommit(text); e.currentTarget.blur(); }
        else if (e.key === 'Escape') { e.preventDefault(); setText(value); e.currentTarget.blur(); }
        e.stopPropagation();
      }}
    />
  );
}

function Setting({ host, id, c }: { host: PluginHost; id: string; c: SettingControl }) {
  if (c.kind === 'note') return <div className="pl-note">{c.text}</div>;
  const set = (v: unknown) => void host.setSetting(id, c.key, v).catch(console.error);
  const val = host.settingValue(id, c.key);
  if (c.kind === 'text') {
    return (
      <label className="tw-lbl">
        {c.label}
        <TextSetting value={typeof val === 'string' ? val : ''} {...(c.placeholder !== undefined ? { placeholder: c.placeholder } : {})} onCommit={set} />
      </label>
    );
  }
  if (c.kind === 'toggle') {
    return (
      <span className="tw-lbl">
        {c.label}
        <button type="button" className="pl-toggle" data-on={val ? '1' : '0'} onClick={() => set(!val)}>{val ? 'on' : 'off'}</button>
      </span>
    );
  }
  return (
    <label className="tw-lbl">
      {c.label}
      <select className="tw-sel" value={typeof val === 'string' && c.options.includes(val) ? val : c.options[0] ?? ''} onChange={(e) => set(e.target.value)} onKeyDown={(e) => e.stopPropagation()}>
        {c.options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function Row({ host, row }: { host: PluginHost; row: PluginRow }) {
  const on = row.state === 'on';
  const settings = on && row.hasSettings ? host.settingsOf(row.id) : [];
  return (
    <div className="pl-row" data-id={row.id} data-state={row.state}>
      <div className="pl-head">
        <span className="pl-name">{row.name}</span>
        {row.version && <span className="pl-ver">{row.version}</span>}
        {row.author !== undefined && <span className="pl-by">{row.author}</span>}
        <span className="grow" />
        {row.enabled && row.state !== 'broken' && (
          <button type="button" className="pl-link" onClick={() => void host.reload(row.id).catch(console.error)}>reload</button>
        )}
        {row.state !== 'broken' && (
          <button type="button" className="pl-toggle" data-on={row.enabled ? '1' : '0'} onClick={() => void host.setEnabled(row.id, !row.enabled).catch(console.error)}>
            {row.enabled ? 'on' : 'off'}
          </button>
        )}
      </div>
      {row.error !== undefined && <div className="pl-err">{row.error}</div>}
      {settings.length > 0 && (
        <div className="pl-set">
          {settings.map((c, i) => <Setting key={i} host={host} id={row.id} c={c} />)}
        </div>
      )}
    </div>
  );
}

export function PluginsSection() {
  const host = usePlugins();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [drag, setDrag] = useState(false);
  const addRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const add = async (path: string, replace = false) => {
    setOffer(null);
    const r = await addPluginFromPath(path, { replace });
    if (r?.status === 'replace') setOffer({ path, name: r.name, have: r.have, incoming: r.incoming });
  };

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    pluginHooks.addFromPath = (p) => add(p);
    return () => { delete pluginHooks.addFromPath; };
  });

  // a package dropped on the section, through Tauri (with a position, so only a drop here counts)
  useEffect(() => {
    let off: (() => void) | null = null;
    let gone = false;
    const here = (pos: { x: number; y: number }) => {
      const k = window.devicePixelRatio || 1;
      const el = document.elementFromPoint(pos.x / k, pos.y / k);
      return !!el && !!wrapRef.current?.contains(el);
    };
    const on = (ev: DragDropEvent) => {
      if (ev.type === 'leave') setDrag(false);
      else if (ev.type === 'drop') {
        setDrag(false);
        if (ev.paths[0] && here(ev.position)) void add(ev.paths[0]);
      } else setDrag(here(ev.position));
    };
    getCurrentWebview().onDragDropEvent((e) => on(e.payload)).then(
      (fn) => { if (gone) fn(); else off = fn; },
      () => { /* not under Tauri */ },
    );
    return () => { gone = true; off?.(); };
  }, []);

  if (!host) return null;
  const rows = host.rows();
  const pick = async (directory: boolean) => {
    const path = await pickPath(directory ? { directory: true, multiple: false } : { directory: false, multiple: false, filters: [{ name: 'plugin', extensions: ['zip'] }] });
    if (typeof path === 'string') await add(path);
  };
  return (
    <div className="tw-row tw-plugins" ref={wrapRef}>
      <span className="tw-lbl">plugins</span>
      <div className="pl-note">a plugin runs with the app's access to this vault and the network</div>
      {rows.map((row) => <Row key={row.id} host={host} row={row} />)}
      {offer && (
        <div className="pl-offer">
          <span>{offer.name} {offer.have} is here, this is {offer.incoming}</span>
          <button type="button" className="pl-link" onClick={() => void add(offer.path, true)}>replace</button>
          <button type="button" className="pl-link" onClick={() => setOffer(null)}>keep</button>
        </div>
      )}
      <div className="pl-add" ref={addRef} data-drag={drag ? '1' : '0'}>
        <button type="button" className="pl-link" onClick={() => void pick(false).catch(console.error)}>add a plugin</button>
        <button type="button" className="pl-link" onClick={() => void pick(true).catch(console.error)}>from a folder</button>
      </div>
    </div>
  );
}
