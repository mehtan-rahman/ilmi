// Two writes to one file asked for at once (a grade while an edit of the
// card is written, two grades in a deck a keypress apart) both land: each
// update runs on what the last one wrote. Before, both read the file's stamp
// before either wrote, and the second wrote over the first (over a store),
// or the two shared the temporary file and the second's rename failed (on
// disk). Found by the session's model (`app/__tests__/session.model.test.ts`).

import { promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Card } from '../../format/index.js';
import { nodeFs } from '../node-fs.js';
import { memStore } from '../mem-store.js';
import { Vault, storeFs } from '../index.js';

const FILE = 'a :: b\n\nc :: d\n';

async function open(kind: 'store' | 'disk'): Promise<Vault> {
  if (kind === 'store') {
    const fs = storeFs(memStore(), '/v');
    await fs.mkdir('/v');
    await fs.writeText('/v/d.md', FILE);
    return Vault.open(fs, '/v');
  }
  const root = await fsp.mkdtemp(join(tmpdir(), 'ilmi-turns-'));
  await fsp.writeFile(join(root, 'd.md'), FILE);
  return Vault.open(nodeFs, root);
}

describe('updates to one file at once', () => {
  for (const kind of ['store', 'disk'] as const) {
    it(`both land, in the order asked (${kind})`, async () => {
      const v = await open(kind);
      await v.read('d.md');
      const order: string[] = [];
      const one = v.update('d.md', (doc) => { (doc.blocks[0] as Card).text = 'a :: B'; order.push('one'); });
      const two = v.update('d.md', (doc) => { (doc.blocks[1] as Card).text = 'c :: D'; order.push('two'); });
      const three = v.write('d.md', { blocks: [] }).catch(() => 'moved');
      await Promise.all([one, two]);
      // the overwrite asked third read the file the two left; it is written after them
      expect(await three).not.toBe('moved');
      expect(order).toEqual(['one', 'two']);
      v.close();
    });

    it(`a failed update does not hold up the next (${kind})`, async () => {
      const v = await open(kind);
      const bad = v.update('d.md', () => { throw new Error('no'); });
      const good = v.update('d.md', (doc) => { (doc.blocks[0] as Card).text = 'a :: B'; });
      await expect(bad).rejects.toThrow('no');
      expect((await good).text).toBe('a :: B\n\nc :: d\n');
      v.close();
    });
  }

  it('two at once over a store: both edits in the file', async () => {
    const v = await open('store');
    await v.read('d.md');
    await Promise.all([
      v.update('d.md', (doc) => { (doc.blocks[0] as Card).text = 'a :: B'; }),
      v.update('d.md', (doc) => { (doc.blocks[1] as Card).text = 'c :: D'; }),
    ]);
    expect((await v.read('d.md', true)).text).toBe('a :: B\n\nc :: D\n');
    v.close();
  });
});
