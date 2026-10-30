// Images put into a page: pasted (the clipboard's files), dropped from the
// Finder (Tauri's drag-drop hands the window's one router, `land.ts`, the
// paths; over an editable page it gives them to that page instead of
// landing them as documents), or picked from the slash menu's `image` row.
// Each is written beside the document as the next `img-NN` (Vault.addImage)
// and linked there.

import { invoke } from '@tauri-apps/api/core';
import { open as pickFile } from '@tauri-apps/plugin-dialog';

export const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg|bmp|tiff?)$/i;

const TYPES: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', svg: 'image/svg+xml', bmp: 'image/bmp', tif: 'image/tiff', tiff: 'image/tiff',
};

/** An image's content type by its name, `''` when the name says none. */
export const imageType = (name: string): string => TYPES[/\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? ''] ?? '';

/** An image to land: its bytes, its content type, the name it came with. */
export interface ImageFile {
  bytes: Uint8Array;
  type: string;
  name: string;
}

/** A file on disk, outside the vault (a drop or a pick), read by path on the Rust side. */
export async function readImagePath(path: string): Promise<ImageFile> {
  const name = path.slice(path.lastIndexOf('/') + 1);
  const bytes = new Uint8Array(await invoke<ArrayBuffer>('read_dropped_bytes', { path }));
  return { bytes, type: imageType(name), name };
}

/** The pages that take an image dropped on them, by their surface; each registers while it is mounted. */
export const pageDrops = new Map<Element, (paths: string[], x: number, y: number) => void>();

/** The surface under `el` that takes images, with its handler, when every path is an image. */
export function pageDropAt(el: Element | null, paths: string[]): ((paths: string[], x: number, y: number) => void) | null {
  if (!paths.length || !paths.every((p) => IMAGE_EXT.test(p))) return null;
  const surface = el?.closest('.draft-doc');
  return surface ? pageDrops.get(surface) ?? null : null;
}

/** The picker behind the slash menu's `image` row; the smoke puts its own in. */
export const imagePicker: { pick: () => Promise<string[]> } = {
  async pick() {
    const got = await pickFile({ multiple: true, directory: false, filters: [{ name: 'image', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'bmp', 'tif', 'tiff'] }] });
    return got === null ? [] : Array.isArray(got) ? got : [got];
  },
};
