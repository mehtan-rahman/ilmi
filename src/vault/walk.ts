// Walk a vault directory into the tree FORMAT.md §1 describes.

import type { Fs } from './fs.js';
import { join } from './fs.js';

export interface Folder {
  kind: 'folder';
  name: string;
  /** Vault-relative, `/`-separated. */
  path: string;
  children: TreeNode[];
}

export interface DocNode {
  kind: 'doc';
  /** Filename without `.md`. Front-matter `title` is applied by the UI, not here. */
  name: string;
  /** Vault-relative path including `.md`. */
  path: string;
  /** Contents of the sibling `name/` directory, when there is one. */
  children?: TreeNode[];
  /** Vault-relative path of the sibling `name.pdf`, the document's pages, when there is one. */
  pdf?: string;
}

export type TreeNode = Folder | DocNode;

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function byName(a: TreeNode, b: TreeNode): number {
  if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
  return collator.compare(a.name, b.name) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
}

export function isDocPath(path: string): boolean {
  return path.endsWith('.md');
}

/** A file that can be a document's pages. */
export function isPdfPath(path: string): boolean {
  return /\.pdf$/i.test(path);
}

/** True when any segment of a vault-relative path starts with `.`. */
export function isHidden(rel: string): boolean {
  return rel.split('/').some((s) => s.startsWith('.'));
}

/** Children of the directory at `rel` (`''` for the vault root). */
export async function walk(fs: Fs, root: string, rel = ''): Promise<TreeNode[]> {
  const entries = await fs.readDir(join(root, rel));
  const dirs = new Map<string, string>();
  const pdfs = new Map<string, string>();
  const docs: DocNode[] = [];
  for (const e of entries) {
    const path = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDir) {
      if (!e.name.startsWith('.')) dirs.set(e.name, path);
    } else if (e.isFile && isDocPath(e.name)) {
      docs.push({ kind: 'doc', name: e.name.slice(0, -3), path });
    } else if (e.isFile && isPdfPath(e.name)) {
      pdfs.set(e.name.slice(0, -4), path);
    }
  }
  const out: TreeNode[] = [];
  for (const d of docs) {
    const childDir = dirs.get(d.name);
    if (childDir !== undefined) {
      dirs.delete(d.name);
      d.children = await walk(fs, root, childDir);
    }
    // `name.pdf` beside `name.md` is the document's pages (FORMAT.md §1)
    const pdf = pdfs.get(d.name);
    if (pdf !== undefined) d.pdf = pdf;
    out.push(d);
  }
  for (const [name, path] of dirs) {
    out.push({ kind: 'folder', name, path, children: await walk(fs, root, path) });
  }
  return out.sort(byName);
}

/** Every document path in the tree, depth first, in tree order. */
export function documents(nodes: TreeNode[]): string[] {
  const out: string[] = [];
  const visit = (list: TreeNode[]) => {
    for (const n of list) {
      if (n.kind === 'doc') {
        out.push(n.path);
        if (n.children) visit(n.children);
      } else visit(n.children);
    }
  };
  visit(nodes);
  return out;
}
