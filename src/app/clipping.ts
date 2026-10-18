// A clipped page landing as a file. The intake's address path and an
// `ilmi://new?url=` link both end here: the source is written through the
// intake's own import path with the page's fields (FORMAT.md §3 `url`,
// `author`, `published`), then, while `download images when clipping` is
// on, the page's images are fetched into the document's folder and the
// links pointed at them. A download that fails leaves the address in place.

import type { ClipImage } from '../import/index.js';
import type { ImportSpec } from '../vault/index.js';
import { fetchImage } from './fetch.js';
import { useApp } from './store.js';
import { currentVault, importNode } from './vault.js';

export interface Landed {
  path: string;
  /** The image files written, vault-relative. */
  images: string[];
}

/** A clipped source in `dir`; the images landed when the tweak says so. Resolves once the file is complete. */
export async function importClipNode(dir: string, spec: ImportSpec, images: ClipImage[]): Promise<Landed> {
  const path = await importNode(dir, spec);
  let landed: string[] = [];
  const vault = currentVault();
  if (vault && images.length && useApp.getState().clipImages) {
    landed = await vault.attachImages(path, images.map((i) => i.src), fetchImage).catch((e: unknown) => { console.error(e); return []; });
  }
  return { path, images: landed };
}
