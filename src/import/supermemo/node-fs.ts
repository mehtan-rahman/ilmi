// `SmFs` over node:fs, for the command line and the tests. Not imported by the app.

import { promises as fsp } from 'node:fs';
import { nodeFs } from '../../vault/node-fs.js';
import type { SmFs } from './collection.js';

export const smNodeFs: SmFs = {
  readDir: (path) => nodeFs.readDir(path),
  stat: (path) => nodeFs.stat(path),
  readBytes: async (path) => new Uint8Array(await fsp.readFile(path)),
};
