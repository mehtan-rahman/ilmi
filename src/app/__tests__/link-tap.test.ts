// @vitest-environment jsdom
// A tap on a link under a finger: it opens the link while the note is only being read, and is the caret's while the
// note is being typed in. Whether it was being read is taken where the touch begins (by the click, the touch itself
// has given the page the caret: what a simulator showed, the link's words opened up and nothing followed).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EditorView } from 'prosemirror-view';
import { handleClick, linkTouchEnd, linkTouchStart } from '../Reader.js';
import { useApp } from '../store.js';

const link = () => {
  const p = document.createElement('p');
  p.innerHTML = 'a line with <span class="md-link" data-href="https://example.com/x"><b>a link</b></span> in it';
  document.body.replaceChildren(p);
  return { on: p.querySelector('b')!, off: p };
};
const view = (focused: boolean) => ({ hasFocus: () => focused }) as unknown as EditorView;
const touch = (target: Element, x: number, y: number, t: number, lifted = false) => {
  const pt = { clientX: x, clientY: y };
  return { target, timeStamp: t, touches: lifted ? [] : [pt], changedTouches: [pt], preventDefault: vi.fn() } as unknown as TouchEvent & { preventDefault: ReturnType<typeof vi.fn> };
};

describe('a link under a finger', () => {
  let opened: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    opened = vi.spyOn(window, 'open').mockImplementation(() => null);
    useApp.setState({ mobile: true });
    document.documentElement.removeAttribute('data-keyboard');
  });
  afterEach(() => { opened.mockRestore(); useApp.setState({ mobile: false }); });

  it('a tap on it, the note only read, opens it and gives the page no caret', () => {
    const { on } = link();
    const v = view(false);
    linkTouchStart(v, touch(on, 50, 60, 1000));
    const up = touch(on, 52, 61, 1120, true);
    expect(linkTouchEnd(v, up)).toBe(true);
    expect(opened).toHaveBeenCalledWith('https://example.com/x', '_blank', 'noopener');
    expect(up.preventDefault).toHaveBeenCalled();
  });

  it('while the note is typed in (the caret in it, or the keyboard up) the tap is the caret\'s', () => {
    const { on } = link();
    const typing = view(true);
    linkTouchStart(typing, touch(on, 50, 60, 1000));
    expect(linkTouchEnd(typing, touch(on, 50, 60, 1100, true))).toBe(false);
    document.documentElement.setAttribute('data-keyboard', '');
    const v = view(false);
    linkTouchStart(v, touch(on, 50, 60, 2000));
    expect(linkTouchEnd(v, touch(on, 50, 60, 2100, true))).toBe(false);
    expect(opened).not.toHaveBeenCalled();
  });

  it('a touch that moved (the page scrolled), one held, or one beside the link opens nothing', () => {
    const { on, off } = link();
    const v = view(false);
    linkTouchStart(v, touch(on, 50, 60, 1000));
    expect(linkTouchEnd(v, touch(on, 50, 95, 1150, true))).toBe(false);
    linkTouchStart(v, touch(on, 50, 60, 2000));
    expect(linkTouchEnd(v, touch(on, 50, 60, 2900, true))).toBe(false);
    linkTouchStart(v, touch(off, 10, 60, 4000));
    expect(linkTouchEnd(v, touch(off, 10, 60, 4100, true))).toBe(false);
    // and a lift with no touch begun on a read note before it
    expect(linkTouchEnd(v, touch(on, 50, 60, 5000, true))).toBe(false);
    expect(opened).not.toHaveBeenCalled();
  });

  it('where there is no finger a touch is nothing, and ⌘-click is what opens', () => {
    const { on } = link();
    useApp.setState({ mobile: false });
    const v = view(false);
    linkTouchStart(v, touch(on, 50, 60, 1000));
    expect(linkTouchEnd(v, touch(on, 50, 60, 1100, true))).toBe(false);
    expect(handleClick(v, 0, { target: on, metaKey: false, ctrlKey: false, preventDefault: () => {} } as unknown as MouseEvent)).toBe(false);
    expect(opened).not.toHaveBeenCalled();
    expect(handleClick(v, 0, { target: on, metaKey: true, ctrlKey: false, preventDefault: () => {} } as unknown as MouseEvent)).toBe(true);
    expect(opened).toHaveBeenCalledTimes(1);
  });
});
