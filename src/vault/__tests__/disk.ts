// What the vault's tests run over. A vault is pure over `Fs`, so every
// test here runs twice: over a temporary directory (`node-fs.ts`), and
// over a collection's store in memory (`store.ts` over `mem-store.ts`,
// milestone 59) with the same corpus imported into it. `*-store.test.ts`
// sets `ILMI_TEST_STORE` and imports the directory's test file whole.
//
// `Disk` is the tests' own hands on what is under the vault: a file
// written behind its back, read back as it is stored.

import { promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { join as joinPath } from 'node:path';
import type { Fs } from '../fs.js';
import { join } from '../fs.js';
import { memStore } from '../mem-store.js';
import { nodeFs } from '../node-fs.js';
import { storeFs } from '../store.js';
import { importFolder } from '../transfer.js';

/** True in a `*-store.test.ts` file: the tests it imports open a collection. */
export const STORE = (globalThis as { ILMI_TEST_STORE?: boolean }).ILMI_TEST_STORE === true;

export interface Disk {
  fs: Fs;
  root: string;
  write(rel: string, text: string): Promise<void>;
  append(rel: string, text: string): Promise<void>;
  read(rel: string): Promise<string>;
  bytes(rel: string): Promise<Uint8Array>;
  copy(from: string, to: string): Promise<void>;
  mkdir(rel: string): Promise<void>;
  rm(rel: string): Promise<void>;
  /** The names in a directory. */
  names(rel: string): Promise<string[]>;
  exists(rel: string): Promise<boolean>;
  isDir(rel: string): Promise<boolean>;
  dispose(): Promise<void>;
}

/** A fresh copy of the vault at `corpus`: a temporary directory, or a collection in memory. */
export async function openDisk(corpus: string, tag: string): Promise<Disk> {
  let fs: Fs;
  let root: string;
  let dispose: () => Promise<void>;
  if (STORE) {
    root = `/collections/${tag}`;
    fs = storeFs(memStore(), root);
    await importFolder(nodeFs, corpus.replace(/\/+$/, ''), fs, root);
    dispose = async () => {};
  } else {
    root = await fsp.mkdtemp(joinPath(tmpdir(), `ilmi-${tag}-`));
    await fsp.cp(corpus, root, { recursive: true });
    fs = nodeFs;
    dispose = () => fsp.rm(root, { recursive: true, force: true });
  }
  const abs = (rel: string) => join(root, rel);
  return {
    fs,
    root,
    write: (rel, text) => fs.writeText(abs(rel), text),
    append: async (rel, text) => fs.writeText(abs(rel), (await fs.readText(abs(rel))) + text),
    read: (rel) => fs.readText(abs(rel)),
    bytes: (rel) => fs.readBytes(abs(rel)),
    copy: async (from, to) => fs.writeBytes(abs(to), await fs.readBytes(abs(from))),
    mkdir: (rel) => fs.mkdir(abs(rel)),
    rm: (rel) => fs.remove(abs(rel)),
    names: async (rel) => (await fs.readDir(abs(rel))).map((e) => e.name),
    exists: async (rel) => !!(await fs.stat(abs(rel))),
    isDir: async (rel) => (await fs.stat(abs(rel)))?.isDir === true,
    dispose,
  };
}
