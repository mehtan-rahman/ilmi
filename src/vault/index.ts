// The vault layer: a directory of Markdown files, walked, read, written, and
// watched. Pure over `Fs`; see `node-fs.ts` and `tauri-fs.ts` for adapters.

export type { Fs, FsEntry, FsStat, Stamp } from './fs.js';
export { join, relative, sameStamp } from './fs.js';
export { walk, documents, isDocPath, isPdfPath, isHidden, type TreeNode, type Folder, type DocNode } from './walk.js';
export { dirOf, baseOf, joinRel, isDoc, childDirOf, pdfOf, nameOf, within, rekey, cleanName, fileName } from './paths.js';
export { pageHeading, pageOf, pageOfBlock, pageSection, addToPage } from './pages.js';
export { Vault, VaultConflict, NEW_NAMES, extractName, imageExt, type ExtractSpec, type ImportSpec, type ImportPdfSpec, type ImportDeckSpec, type ImageGet, type Loaded, type VaultEvent, type VaultState } from './vault.js';
