import { describe, expect, it } from 'vitest';
import { cleanClipDir, clipTitle, openCandidates, parseClipUri, vaultMatches } from '../clip.js';

const enc = encodeURIComponent;

describe('ilmi:// links', () => {
  it('new with content: the text, the name, and nothing else', () => {
    expect(parseClipUri(`ilmi://new?name=${enc('a note')}&content=${enc('hello from the clipper')}`)).toEqual({
      kind: 'new', name: 'a note', content: 'hello from the clipper',
    });
  });

  it('new with a url: fetched later; the selection beside it is the content', () => {
    expect(parseClipUri(`ilmi://new?url=${enc('https://example.com/a?b=1&c=2')}`)).toEqual({ kind: 'new', url: 'https://example.com/a?b=1&c=2' });
    expect(parseClipUri(`ilmi://new?url=${enc('https://example.com/')}&content=${enc('the bit I selected')}`)).toEqual({
      kind: 'new', url: 'https://example.com/', content: 'the bit I selected',
    });
  });

  it('new with a folder: slashes at the ends dropped, dots never climb', () => {
    expect(parseClipUri(`ilmi://new?content=x&folder=${enc('/fleeting/web/')}`)).toMatchObject({ kind: 'new', folder: 'fleeting/web' });
    expect(parseClipUri(`ilmi://new?content=x&folder=${enc('../../etc')}`)).toMatchObject({ kind: 'new', folder: 'etc' });
    expect(parseClipUri('ilmi://new?content=x&folder=')).toEqual({ kind: 'new', content: 'x' });
  });

  it('new with nothing to clip is refused, as is a url that is not a web address', () => {
    expect(parseClipUri('ilmi://new')).toEqual({ kind: 'refused', reason: 'nothing to clip' });
    expect(parseClipUri('ilmi://new?name=t&content=%20%20')).toEqual({ kind: 'refused', reason: 'nothing to clip' });
    expect(parseClipUri(`ilmi://new?url=${enc('file:///etc/passwd')}`)).toEqual({ kind: 'refused', reason: 'not a web address' });
    // a bad url beside real content: the content wins, the url is dropped
    expect(parseClipUri(`ilmi://new?url=${enc('not a url')}&content=hi`)).toEqual({ kind: 'new', content: 'hi' });
  });

  it('open: a path, with or without .md, or Obsidian\'s file=', () => {
    expect(parseClipUri(`ilmi://open?path=${enc('papers/wozniak-1990.md')}`)).toEqual({ kind: 'open', path: 'papers/wozniak-1990.md' });
    expect(parseClipUri(`ilmi://open?file=${enc('papers/wozniak-1990')}`)).toEqual({ kind: 'open', path: 'papers/wozniak-1990' });
    expect(parseClipUri('ilmi://open')).toEqual({ kind: 'refused', reason: 'nothing to open' });
    expect(openCandidates('papers/wozniak-1990')).toEqual(['papers/wozniak-1990', 'papers/wozniak-1990.md']);
    expect(openCandidates('papers/wozniak-1990.md')).toEqual(['papers/wozniak-1990.md']);
  });

  it('a vault is carried through and matched by name or by path', () => {
    expect(parseClipUri('ilmi://new?vault=corpus&content=x')).toEqual({ kind: 'new', content: 'x', vault: 'corpus' });
    expect(parseClipUri('ilmi://open?vault=other&path=a.md')).toEqual({ kind: 'open', path: 'a.md', vault: 'other' });
    expect(vaultMatches('corpus', '/Users/me/vaults/corpus')).toBe(true);
    expect(vaultMatches('/Users/me/vaults/corpus/', '/Users/me/vaults/corpus')).toBe(true);
    expect(vaultMatches('other', '/Users/me/vaults/corpus')).toBe(false);
  });

  it('the verb may come as a host, a path, or after three slashes', () => {
    expect(parseClipUri('ilmi:new?content=x')).toEqual({ kind: 'new', content: 'x' });
    expect(parseClipUri('ilmi:///new?content=x')).toEqual({ kind: 'new', content: 'x' });
    expect(parseClipUri('ILMI://NEW?content=x')).toEqual({ kind: 'new', content: 'x' });
    expect(parseClipUri('  ilmi://open?path=a.md  ')).toEqual({ kind: 'open', path: 'a.md' });
  });

  it('garbage and other schemes are one quiet line', () => {
    expect(parseClipUri('')).toEqual({ kind: 'refused', reason: 'not an ilmi link' });
    expect(parseClipUri('hello there')).toEqual({ kind: 'refused', reason: 'not an ilmi link' });
    expect(parseClipUri('obsidian://new?content=x')).toEqual({ kind: 'refused', reason: 'not an ilmi link' });
    expect(parseClipUri('https://example.com/')).toEqual({ kind: 'refused', reason: 'not an ilmi link' });
    expect(parseClipUri('ilmi://')).toEqual({ kind: 'refused', reason: 'not an ilmi link' });
    expect(parseClipUri('ilmi://search?q=x')).toEqual({ kind: 'refused', reason: 'no such link: search' });
  });

  it('the title: the name, else the page title, else the first line, else the host', () => {
    expect(clipTitle({ name: 'given' }, 'Page', '# First\n\nbody')).toBe('given');
    expect(clipTitle({}, ' Page ', '# First\n\nbody')).toBe('Page');
    expect(clipTitle({}, '', '# First\n\nbody')).toBe('First');
    expect(clipTitle({ url: 'https://example.com/a' }, '', '')).toBe('example.com');
    expect(clipTitle({}, '', '')).toBe('clipping');
  });

  it('the clippings setting cleans the same way; anything that is not a string is the root', () => {
    expect(cleanClipDir('fleeting')).toBe('fleeting');
    expect(cleanClipDir('/a//b/')).toBe('a/b');
    expect(cleanClipDir(undefined)).toBe('');
    expect(cleanClipDir(3)).toBe('');
  });
});
