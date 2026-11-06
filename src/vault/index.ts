// The vault layer: a tree of Markdown documents, walked, read, written, and
// watched. Pure over `Fs`: `store.ts` is the `Fs` over a collection's
// database (the app's), `node-fs.ts` and `tauri-fs.ts` are directories
// (tests, and the folders an import reads and an export writes).

export type { Fs, FsEntry, FsStat, Stamp } from './fs.js';
export { join, relative, sameStamp } from './fs.js';
export { walk, documents, isDocPath, isPdfPath, isHidden, type TreeNode, type Folder, type DocNode } from './walk.js';
export { dirOf, baseOf, joinRel, isDoc, childDirOf, pdfOf, nameOf, within, rekey, cleanName, fileName, normRel, relFrom } from './paths.js';
export { ORDER_FILE, childrenAt, cleanOrder, directories, entryOf, followMove, forget, ordered, placeEntry, pruneOrder, restoreOrder, type Order } from './order.js';
export { pageHeading, pageOf, pageOfBlock, pageSection, addToPage } from './pages.js';
export { Vault, VaultConflict, SAME_FILE, NEW_NAMES, extractName, notesOf, imageExt, type ExtractSpec, type SectionSpec, type ImportSpec, type ImportPdfSpec, type PdfChapterSpec, type ImportDeckSpec, type ImageGet, type Loaded, type Removed, type VaultEvent, type VaultState } from './vault.js';
export { storeFs, splitFront, newId, hiddenId, type Store, type StoreFs, type Row, type RowKind, type Place, type Content, type Reg, type StoreOp, type Recorder, type Door, type ViewWrite, type Lift, type Sched, type ReviewRow, type DocContent } from './store.js';
export { importFolder, exportFolder, mirrorFolder, takeFiles, skipped, mirrorPass, mirrorDirIn, MIRROR_LIST } from './transfer.js';
