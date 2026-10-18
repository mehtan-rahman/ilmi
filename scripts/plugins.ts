// Build the plugins the repo ships: each `plugins/<id>/` with a `plugin.json`
// is bundled by esbuild into `plugins/dist/<id>/main.js` (one CommonJS file,
// dependencies included), its manifest and `style.css` copied beside it, and
// the folder zipped flat as `plugins/dist/<id>.zip`, the shape `add a plugin`
// takes. The API's types go to `plugins/ilmi.d.ts` from `src/plugins/api.ts`,
// and the corpus vault gets the sample under `.ilmi/plugins/` with
// `.ilmi/plugins.json` turning it on, so the tests load what a vault holds.
//
//   npm run plugins

import { build } from 'esbuild';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'plugins');
const DIST = join(SRC, 'dist');
const CORPUS = join(ROOT, 'src/format/__tests__/corpus/vault/.ilmi');
/** The plugins the corpus vault has on. */
const CORPUS_ON = ['hello'];

// ── a flat, stored zip: deterministic, no dependency ──────────────

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zip(files: [name: string, text: string][]): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  // 1980-01-01 00:00: a stable stamp, as DOS time
  const time = 0;
  const date = (1 << 5) | 1;
  for (const [name, text] of files) {
    const data = Buffer.from(text, 'utf8');
    const nameBytes = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // utf-8 names
    local.writeUInt16LE(0, 8); // stored
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    parts.push(local, nameBytes, data);
    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(20, 4);
    dir.writeUInt16LE(20, 6);
    dir.writeUInt16LE(0x0800, 8);
    dir.writeUInt16LE(0, 10);
    dir.writeUInt16LE(time, 12);
    dir.writeUInt16LE(date, 14);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(data.length, 20);
    dir.writeUInt32LE(data.length, 24);
    dir.writeUInt16LE(nameBytes.length, 28);
    dir.writeUInt16LE(0, 30);
    dir.writeUInt16LE(0, 32);
    dir.writeUInt16LE(0, 34);
    dir.writeUInt16LE(0, 36);
    dir.writeUInt32LE(0, 38);
    dir.writeUInt32LE(offset, 42);
    central.push(dir, nameBytes);
    offset += local.length + nameBytes.length + data.length;
  }
  const centralBytes = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBytes.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...parts, centralBytes, end]);
}

// ── the build ─────────────────────────────────────────────────────

const ids = readdirSync(SRC).filter((n) => n !== 'dist' && statSync(join(SRC, n)).isDirectory() && existsSync(join(SRC, n, 'plugin.json')));

const api = readFileSync(join(ROOT, 'src/plugins/api.ts'), 'utf8');
writeFileSync(join(SRC, 'ilmi.d.ts'), `// Generated from src/plugins/api.ts by \`npm run plugins\`; edit that file.\n${api}`);

rmSync(DIST, { recursive: true, force: true });
for (const id of ids) {
  const dir = join(SRC, id);
  const entry = ['main.ts', 'main.js'].map((n) => join(dir, n)).find((p) => existsSync(p));
  if (!entry) throw new Error(`${id}: no main.ts or main.js`);
  const out = join(DIST, id);
  mkdirSync(out, { recursive: true });
  await build({
    entryPoints: [entry],
    bundle: true,
    format: 'cjs',
    platform: 'browser',
    target: 'es2020',
    outfile: join(out, 'main.js'),
    logLevel: 'warning',
  });
  const files: [string, string][] = [['plugin.json', readFileSync(join(dir, 'plugin.json'), 'utf8')], ['main.js', readFileSync(join(out, 'main.js'), 'utf8')]];
  if (existsSync(join(dir, 'style.css'))) {
    const css = readFileSync(join(dir, 'style.css'), 'utf8');
    writeFileSync(join(out, 'style.css'), css);
    files.push(['style.css', css]);
  }
  writeFileSync(join(out, 'plugin.json'), files[0]![1]);
  writeFileSync(join(DIST, `${id}.zip`), zip(files));
  if (CORPUS_ON.includes(id)) {
    const target = join(CORPUS, 'plugins', id);
    rmSync(target, { recursive: true, force: true });
    mkdirSync(target, { recursive: true });
    for (const [name, text] of files) writeFileSync(join(target, name), text);
  }
  console.log(`${id}: ${files.map(([n]) => n).join(', ')} → plugins/dist/${id}/, plugins/dist/${id}.zip`);
}
writeFileSync(join(CORPUS, 'plugins.json'), `${JSON.stringify(CORPUS_ON, null, 2)}\n`);
console.log(`corpus: .ilmi/plugins.json ${JSON.stringify(CORPUS_ON)}`);
