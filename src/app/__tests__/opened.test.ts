// @vitest-environment jsdom
// A file the system opens the app with (`open in ilmi` on a share sheet, `open with`, the dock icon): it goes where a
// dropped file goes, in the order it came, kept while no collection is open, and the system's copy is forgotten only
// once the collection has the file.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fileName } from '../fetch.js';
import type { Landed } from '../land.js';
import { isFileUrl, openedWaiting, resetOpened, takeOpened, takeWaiting, waitingLine, type OpenedFx } from '../opened.js';

const INBOX = 'file:///private/var/mobile/Containers/Data/Application/X/Documents/Inbox/';
const landed = (path: string): Landed => ({ line: `placed · ${path}`, open: 'library/paper.md', written: ['library/paper.md'], folders: [] });

function rig(over: Partial<OpenedFx> = {}) {
  const state = { ready: true };
  const fx: OpenedFx = {
    ready: () => state.ready,
    dir: () => 'library',
    land: vi.fn(async (paths: string[]) => paths.map(landed)),
    forget: vi.fn(async () => true),
    ...over,
  };
  return { fx, state };
}

describe('a file the system hands over', () => {
  beforeEach(() => resetOpened());

  it('is told from a link', () => {
    expect(isFileUrl(`${INBOX}paper.pdf`)).toBe(true);
    expect(isFileUrl('  FILE:///Users/x/Downloads/a%20b.epub ')).toBe(true);
    expect(isFileUrl('ilmi://new?url=https%3A%2F%2Fexample.com')).toBe(false);
    expect(isFileUrl('https://example.com/paper.pdf')).toBe(false);
  });

  it('lands in the folder in front as a dropped file does, and its copy is forgotten', async () => {
    const { fx } = rig();
    await takeOpened(`${INBOX}a%20paper.pdf`, fx);
    expect(fx.land).toHaveBeenCalledWith([`${INBOX}a%20paper.pdf`], 'library');
    expect(fx.forget).toHaveBeenCalledWith(`${INBOX}a%20paper.pdf`);
    expect(openedWaiting()).toEqual([]);
  });

  it('one that did not land (it could not be read, or waits on a choice in the intake) keeps its copy', async () => {
    const { fx } = rig({ land: vi.fn(async () => []) });
    await takeOpened(`${INBOX}decks.apkg`, fx);
    expect(fx.land).toHaveBeenCalledTimes(1);
    expect(fx.forget).not.toHaveBeenCalled();
  });

  it('with no collection open it is kept and said to be, and comes in when one opens', async () => {
    const { fx, state } = rig();
    state.ready = false;
    await takeOpened(`${INBOX}a%20paper.pdf`, fx);
    expect(waitingLine(openedWaiting().map(fileName))).toBe('a paper.pdf is kept: it comes in once a collection is open');
    resetOpened();
    await takeOpened(`${INBOX}paper.pdf`, fx);
    await takeOpened(`${INBOX}book.epub`, fx);
    // (the same file told twice is one file)
    await takeOpened(`${INBOX}paper.pdf`, fx);
    expect(fx.land).not.toHaveBeenCalled();
    expect(openedWaiting()).toEqual([`${INBOX}paper.pdf`, `${INBOX}book.epub`]);
    expect(waitingLine(openedWaiting().map(fileName))).toBe('2 files are kept: they come in once a collection is open');
    // still none: nothing moves
    await takeWaiting(fx);
    expect(fx.land).not.toHaveBeenCalled();
    state.ready = true;
    await takeWaiting(fx);
    expect((fx.land as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0])).toEqual([[`${INBOX}paper.pdf`], [`${INBOX}book.epub`]]);
    expect(fx.forget).toHaveBeenCalledTimes(2);
    expect(openedWaiting()).toEqual([]);
  });

  it('two shared at once land one after the other, in their order', async () => {
    const order: string[] = [];
    let release: () => void = () => {};
    const first = new Promise<void>((r) => { release = r; });
    const { fx } = rig({
      land: vi.fn(async (paths: string[]) => {
        if (paths[0]!.endsWith('one.pdf')) await first;
        order.push(paths[0]!.slice(INBOX.length));
        return paths.map(landed);
      }),
    });
    const a = takeOpened(`${INBOX}one.pdf`, fx);
    const b = takeOpened(`${INBOX}two.pdf`, fx);
    await Promise.resolve();
    expect(order).toEqual([]);
    release();
    await Promise.all([a, b]);
    expect(order).toEqual(['one.pdf', 'two.pdf']);
  });

  it('a landing that throws is not the end of the line', async () => {
    const { fx } = rig({ land: vi.fn(async (paths: string[]) => { if (paths[0]!.endsWith('bad.pdf')) throw new Error('no'); return paths.map(landed); }) });
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    await takeOpened(`${INBOX}bad.pdf`, fx);
    await takeOpened(`${INBOX}good.pdf`, fx);
    quiet.mockRestore();
    expect(fx.forget).toHaveBeenCalledTimes(1);
    expect(fx.forget).toHaveBeenCalledWith(`${INBOX}good.pdf`);
  });
});
