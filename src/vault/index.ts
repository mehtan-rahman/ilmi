// The vault layer: a directory of Markdown files, walked, read, written, and
// watched. Pure over `Fs`; see `node-fs.ts` and `tauri-fs.ts` for adapters.

export type { Fs, FsEntry, FsStat, Stamp } from './fs.js';
export { join, relative, sameStamp } from './fs.js';
export { walk, documents, isDocPath, isHidden, type TreeNode, type Folder, type DocNode } from './walk.js';
export { dirOf, baseOf, joinRel, isDoc, childDirOf, nameOf, within, rekey, cleanName } from './paths.js';
export { Vault, VaultConflict, NEW_NAMES, extractName, type ExtractSpec, type Loaded, type VaultEvent, type VaultState } from './vault.js';
