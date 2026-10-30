// Where an outline's click goes: each reader registers how to bring its
// page's nth heading into view (opening any fold it is inside), and the
// rail's outline and the inspector's call it by the page's path. One list
// of headings feeds both (`outline` in tabs.ts); this is only the jump.

type Jump = { go(index: number): boolean; active(): boolean };

const jumps = new Map<string, Set<Jump>>();

/** A reader over `path` says how to show its nth heading; the returned function takes it back. */
export function registerHeadings(path: string, go: (index: number) => boolean, active: () => boolean): () => void {
  const j: Jump = { go, active };
  let set = jumps.get(path);
  if (!set) jumps.set(path, (set = new Set()));
  set.add(j);
  return () => {
    set.delete(j);
    if (!set.size && jumps.get(path) === set) jumps.delete(path);
  };
}

/** Show heading `index` (among all the page's headings, as the outline counts them) of the page at `path`: in its active reader first. False when no reader has the page. */
export function goToHeading(path: string, index: number): boolean {
  const set = jumps.get(path);
  if (!set) return false;
  const all = [...set];
  for (const j of [...all.filter((x) => x.active()), ...all.filter((x) => !x.active())]) if (j.go(index)) return true;
  return false;
}
