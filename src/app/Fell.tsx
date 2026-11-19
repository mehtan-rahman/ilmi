// What the window shows when something on the page threw while it was being drawn. Without this React takes the
// whole app down and the window is left white, with nothing to say why and no way on: at the next start the tab
// kept from last time is drawn again and falls again. Here the page says what was thrown, in the words it was
// thrown with (they can be selected and sent), and offers a reload, and a reload that opens no kept tab.

import { Component, type ReactNode } from 'react';

const BARE_KEY = 'ilmi.start.bare';

export class Fell extends Component<{ children: ReactNode }, { error: unknown; stack: string }> {
  state = { error: null as unknown, stack: '' };

  static getDerivedStateFromError(error: unknown): { error: unknown } {
    return { error };
  }

  componentDidCatch(error: unknown, info: { componentStack?: string | null }): void {
    console.error(error);
    this.setState({ stack: info.componentStack ?? '' });
  }

  render(): ReactNode {
    const { error, stack } = this.state;
    if (error === null) return this.props.children;
    const what = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    const where = [error instanceof Error ? error.stack ?? '' : '', stack].join('\n').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 14).join('\n');
    const reload = () => window.location.reload();
    const bare = () => {
      try { localStorage.setItem(BARE_KEY, '1'); } catch { /* no storage */ }
      reload();
    };
    return (
      <div className="fell" role="alert" style={{ position: 'fixed', inset: 0, overflow: 'auto', boxSizing: 'border-box', padding: 'max(48px, env(safe-area-inset-top)) 24px 24px', background: 'var(--bg)', color: 'var(--fg-1)', fontFamily: 'var(--sans)', fontSize: 15, lineHeight: 1.5 }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{ fontWeight: 600 }}>something went wrong</div>
          <div style={{ color: 'var(--fg-3)', marginTop: 4 }}>the page could not be drawn. nothing you wrote is lost.</div>
          <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
            <button type="button" data-act="fell-bare" onClick={bare} style={{ minHeight: 44, padding: '0 16px', border: '1px solid var(--fg-1)', background: 'var(--fg-1)', color: 'var(--bg)', font: 'inherit' }}>close tabs and reload</button>
            <button type="button" data-act="fell-reload" onClick={reload} style={{ minHeight: 44, padding: '0 16px', border: '1px solid var(--line-1)', background: 'transparent', color: 'inherit', font: 'inherit' }}>reload</button>
          </div>
          <pre className="fell-what" style={{ marginTop: 24, padding: 12, border: '1px solid var(--line-2)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--fg-2)', userSelect: 'text', WebkitUserSelect: 'text' }}>{`${what}\n\n${where}`}</pre>
        </div>
      </div>
    );
  }
}
