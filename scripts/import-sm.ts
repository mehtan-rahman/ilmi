// npm run import-sm -- <collection.kno> <vault-dir> [--today YYYY-MM-DD]
//
// One-shot import of a SuperMemo collection into a vault directory, created
// if need be. Writes through `Vault` over node's file system; HTML is read
// the way the intake reads it, with jsdom standing in for the webview.

import { promises as fsp } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { formatSummary, importCollection } from '../src/import/supermemo/index.js';
import { smNodeFs } from '../src/import/supermemo/node-fs.js';
import { Vault } from '../src/vault/index.js';
import { nodeFs } from '../src/vault/node-fs.js';

const args = process.argv.slice(2);
let today: string | undefined;
const rest: string[] = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i]!;
  if (a === '--today') today = args[++i];
  else if (a.startsWith('--today=')) today = a.slice('--today='.length);
  else rest.push(a);
}
const [kno, target] = rest;
if (!kno || !target || (today !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(today))) {
  console.error('usage: npm run import-sm -- <collection.kno> <vault-dir> [--today YYYY-MM-DD]');
  process.exit(2);
}

(globalThis as { DOMParser?: unknown }).DOMParser = new JSDOM('').window.DOMParser;

const dir = resolve(target);
await fsp.mkdir(dir, { recursive: true });
const vault = await Vault.open(nodeFs, dir);
try {
  const summary = await importCollection(smNodeFs, resolve(kno), vault, today ? { today } : {});
  console.log(formatSummary(summary, dir));
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
}
