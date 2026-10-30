# SuperMemo collection layout

What `src/import/supermemo/` reads, fact by fact, each with its source. This
file is the only thing that crosses from outside into the importer: the code
is written from these notes, never from anyone else's code. Everything not
listed as known is unknown, and the importer treats it as unknown (a
diagnostic, never a guess written into a vault file).

Written 2026-10-17 for milestone 14. No SuperMemo executable, no Wine prefix,
and no live `.kno` collection is on this machine; the user's own SuperMemo 18
collection ("cognitive canopy", 190 elements, last backed up 2024-02-05) sits
inside a Duplicati backup set under Box (`99 supermemo/`), and only its file
list was read (names and sizes, no contents): restoring the block volumes was
refused by the session's permission rules. Nothing was decompiled.

Conventions: offsets are 0-based bytes from the start of a record; integers
are little-endian (Delphi, x86); `i32` is a signed 4-byte integer, `u16` an
unsigned 2-byte one, `u8` a byte, `f64` an IEEE double, `real48` the 6-byte
Borland real; element ids, registry member ids, and `.rtx` offsets are 1-based,
so element N is record N-1.

## Sources

- **[HELP]** SuperMemo's own help, "SuperMemo files":
  https://super-memory.com/help/files.htm (the same text as
  https://help.supermemo.org/wiki/SuperMemo_files, which answered 403 to the
  tools used here). Names and roles of every file; the `.kno` field list; the
  40-files-per-folder rule for `elements/`.
- **[HELP02]** The SuperMemo 2002 help on the same subject:
  http://super-memory.com/archive/help2002/files.htm. Older names
  (`elinfo.dat`, `reps.dat`, `text.reg`), the "filespace slot" vocabulary.
- **[FAQ16]** SuperMemo 16 FAQ, "Errors in SuperMemo":
  https://www.super-memory.com/archive/help16/faq/errors.htm. Example element
  paths (`elements\27\21\8315.HTM`, `elements\1\17.HTM`,
  `elements\1\28\585.bmp`), "filespace slot #585 → 585.bmp", `elinfo.dat` as
  the file whose record count is the collection's size.
- **[SMA]** SuperMemo Assistant, MIT, https://github.com/supermemo/SuperMemoAssistant,
  `src/Core/SuperMemoAssistant.Core/SuperMemo/SuperMemo17/Files/`:
  `InfContentsElem17.cs`, `InfElementsElem17.cs`, `InfComponentsElem17.cs`,
  `RegMemElem17.cs`, `RegRtElem17.cs`; and SuperMemoAssistant.Interop, MIT,
  `Interop/SMConst.cs`, `Interop/SuperMemo/Elements/Models/ElementType.cs`,
  `ElementStatus.cs`. Record sizes and the offsets it names; everything it
  marks `unknown` is unknown here too.
- **[FREEMEMO]** freememo, MIT-0, https://github.com/adham-omran/freememo,
  `src/freememo/supermemo_format.clj` and `supermemo_import.clj`. Takes SMA's
  layouts and adds fields "recovered by measurement against a real SM19
  collection": the schedule fields of `ElementInfo.dat`, the
  `RepetitionHistory.dat` record, `repetitions.dat`, `priority.sub`,
  `reference.dat`, the `.rtx` trailer, the self-describing component header,
  the day epoch calibration. Also what it found *not* recoverable.
- **[TOOLKIT]** SuperMemo-Toolkit, GPL-2.0, https://github.com/Zacharia2/SuperMemo-Toolkit,
  `supermemo_toolkit/database/registry.py`. Component type headers with
  their sizes, the registry link types, the `.rtx` record shape, the
  1-based `.rtx` offset, the slot-number → folder rule. Read for facts only;
  no code from it is used.
- **[SMJS]** https://github.com/pattontim/supermemo.js, `supermemo20/README.md`:
  a directory listing of a SuperMemo 20 install with the `ABC of SuperMemo
  20` collection (file names only).
- **[SRSC]** https://github.com/eikowagenknecht/srs-converter,
  `docs/formats/supermemo.md`: a secondary survey; useful for the XML export
  schema and the "hour recorded only since SuperMemo 2006" caveat it cites.
- **[BACKUP]** The file list (`filelist.json` of the newest `dlist`) of the
  user's own collection's Duplicati backup: 221 files under
  `cognitive canopy/`, their sizes, and 127 element slot paths. Sizes are
  cited below where they corroborate a record size by divisibility.

Not consulted, by the plan's license rule: the published Ghidra
decompilations of `sm18.exe` / `sm20.exe` (`zitons/sm20-re`,
`L-M-Sherlock/sm18-re`, `melpomenex/sm18-re`). They would answer the open
questions below; nothing from them is in these notes.

## 1. Where a collection is

- `<name>.kno` (SuperMemo writes `.Kno`) beside a folder `<name>/` holding
  everything else. Both are needed; the folder alone is not a collection.
  [HELP] [HELP02] [BACKUP: `cognitive canopy.Kno`, 950 bytes, beside
  `cognitive canopy/`]
- Inside `<name>/`: `collection.ini`, `info/`, `registry/`, `elements/`,
  `tasks/`, `stats/`, `history/`, `subsets/`, `reports/`, `temp/`,
  `recover/`, `alg17/` (SM17+), `sma/` (SuperMemo Assistant's own folder).
  [HELP] [SMJS] [BACKUP]
- File names are Windows-cased (`ElementInfo.dat`, `Text.rtx`, `2.HTM`,
  `124.htm`); a copy may lower-case them. The importer matches names
  case-insensitively. [SMA `SMConst.cs` says `elementinfo.dat`; HELP says
  `ElementInfo.dat`; BACKUP has `ElementInfo.dat`, `Text.rtx`, both `.HTM`
  and `.htm`]

## 2. `<name>.kno`

Collection-wide values. [HELP] lists the "most important fields" in Pascal
notation, in this order, and says integer and longint are 4 bytes, byte 1,
real48 6, word 2:

```
Total, Memorized: integer            undeleted elements, memorized elements
AllocatedFileSpaceSlots: integer     slots allocated in elements/
Version: byte                        structure version
Burden: real48                       average items per day
FirstDay, LastDay: word              days relative to Jan 1, 1980
DefaultFI: byte
MeasuredFI: real48
MeasuredFICases: word
FutureReps: real48                   "not used in the current version"
ALR, AFI, AR, AL, AI, AF, ATim, AG: real48
AFactorDistribution: array[1..20] of word
IntervalDistribution: array[1..13] of word
LapsesDistribution: array[1..15] of word
RepetitionsDistribution: array[1..20] of word
… "author specific data, repetition time measurements, repetition counters,
   reserved fields, topic statistics, collection version, etc."
```

Unknown: whether the record is packed (so that `Total` is at byte 0 and
`FirstDay` at byte 19), the rest of the fields, and the file's total size
(950 bytes in [BACKUP]). The importer does not read the `.kno`; it uses the
path to find `<name>/`.

## 3. `info/contents.dat` — the tree

"Information about the structure of the knowledge tree. Each element has its
parent, siblings and the first child recorded in this file along with the
number of children and the number of descendants." [HELP] [HELP02]

Fixed 37-byte records, element N at record N-1. [SMA `InfContentsElem17`,
Size = 37] [FREEMEMO: 37] [BACKUP: 7030 bytes = 190 × 37, and
`ElementInfo.dat` 22420 = 190 × 118, the same count]

| offset | type | field | source |
| --- | --- | --- | --- |
| 0 | u8 | deleted (non-zero = deleted) | SMA, FREEMEMO |
| 1 | i32 | parent id (0 for the root) | SMA, FREEMEMO |
| 5 | i32 | first child id | SMA, FREEMEMO |
| 9 | i32 | last child id ("Unsure" in SMA) | SMA |
| 13 | i32 | previous sibling id | SMA, FREEMEMO |
| 17 | i32 | next sibling id | SMA, FREEMEMO |
| 21 | i32 | descendant count | SMA, FREEMEMO |
| 25 | i32 | children count | SMA, FREEMEMO |
| 29 | i32 | unknown | SMA (`unknown9`) |
| 33 | i32 | unknown | SMA (`unknown10`) |

Element 1 is the root (its parent is 0). [FREEMEMO's `verify` checks that the
live element count equals the root's descendant count + 1]

The importer walks the tree from element 1 by first child / next sibling,
checks that every visited id is in range and that no id is visited twice (a
cycle or a bad pointer is reported, not followed), and reports elements that
are not deleted and not reachable from the root.

## 4. `info/ElementInfo.dat` — per-element data

"Information about all individual elements, such as A-factor, last repetition
date, number of repetitions, forgetting index, task number, etc." [HELP]
"Each element also stores a pointer to the next element on the repetition
list." [HELP02] Older name `elinfo.dat`. [HELP02] [FAQ16]

Fixed 118-byte records, element N at record N-1. [SMA `InfElementsElem17`,
Size = 118] [FREEMEMO: 118] [TOOLKIT: 118] [BACKUP: 22420 = 190 × 118, and
eleven older versions of the file, every one a multiple of 118]

| offset | type | field | source | status |
| --- | --- | --- | --- | --- |
| 0 | u8 | element type: 0 topic, 1 item, 2 task, 3 template, 4 concept group | SMA `ElementType`, FREEMEMO, TOOLKIT | known |
| 1 | u8 | unknown | SMA | unknown |
| 2 | i32 | title: Text registry member id; -1 when deleted | SMA, FREEMEMO, TOOLKIT | known |
| 6 | i32 | component group position in `compon.dat`; -1 when none | SMA, FREEMEMO, TOOLKIT | known |
| 10 | i32 | unknown ("unknownId") | SMA | unknown |
| 14 | i32 | unknown | SMA | unknown |
| 16 | u16 | interval, days | FREEMEMO (measured) | measured |
| 18 | i16 | last repetition, as a day number relative to the collection's epoch (§12) | FREEMEMO (measured) | measured |
| 20 | f64 | last touch, a TDateTime (§12) | FREEMEMO (measured) | measured |
| 28 | real48 | A-factor | SMA (`AF[6] // Real48`), FREEMEMO | known |
| 34 | real48 | U-factor | FREEMEMO (measured) | measured |
| 44 | u16 | reference id (into `registry/reference.dat`) | FREEMEMO (measured) | measured |
| 61 | i32 | template id | SMA, FREEMEMO | known |
| 65 | i32 | concept id | SMA, FREEMEMO | known |
| 77 | f64 | first repetition, a TDateTime | FREEMEMO (measured) | measured |
| 103 | 5 bytes | "ordinal" | SMA | unknown meaning |
| everything else | | | SMA marks it unknown | unknown |

SMA's offsets 16–27 are `unknown4`/`unknown5`/two bytes/`AF`: FREEMEMO's
measured interval, last-rep day, and last-touch sit inside those unknowns, and
its A-factor at 28 agrees with SMA. The measured fields were taken from a
different program, on a different collection, than SMA's, so they are the
best evidence available here, not a specification; the importer checks them
the way FREEMEMO does (§12) and reports when they do not hold.

Unknown, and wanted: the repetition count, the lapse count, the forgetting
index, the element status (SMA's `ElementStatus`: 0 pending, 1 memorized,
2 dismissed, 3 deleted, is read from the running program, not from a file
offset), the priority as a percentage, the task number, the next-repetition
pointer. The importer derives what it can from other files (§8, §9) and
leaves the rest out of the vault.

## 5. `info/compon.dat` — components

"A binary file with the layout and attributes of all components." [HELP]
Element → group through the position at `ElementInfo` offset 6. [FAQ16: "the
address of component data in compon.dat from elinfo.dat"]

A group at that position: [FREEMEMO] [TOOLKIT]

| offset | type | field |
| --- | --- | --- |
| 0 | 2 bytes | magic `31 D4` |
| 2 | u16 | group length (TOOLKIT calls it that; unused here) |
| 4 | i32 | element id (checked against the element) |
| 8 | u8 | component count |
| 9 | u16 | skip: the first component starts at 11 + skip |

Each component: a `u16` header, then a fixed-size struct. The header's low
byte is the component kind and its high byte is the struct size minus one
[FREEMEMO: "Html 29 encodes as 0x1C0D, Image 26 as 0x1902, Text 35 as 0x2200,
Sound 49 as 0x3003"; TOOLKIT lists the same headers as decimal type numbers
with their lengths]. Kinds and sizes that agree across SMA's structs,
FREEMEMO, and TOOLKIT:

| kind byte | struct size | component |
| --- | --- | --- |
| 0x0D | 29 | HTML |
| 0x10 | 29 | WebView (TOOLKIT: "identical to HTM") |
| 0x00 | 35 | Text |
| 0x0C | 30 | RTF |
| 0x01 | 35 | Spelling |
| 0x02 | 26 | Image |
| 0x03 | 49 | Sound |
| 0x04 | 32 | Video |
| 0x05, 0x06, 0x07 | 28 | shapes (ellipse, rectangle, rounded rectangle) |

Within the struct, every kind that SMA lays out puts a 10-byte geometry
prefix first (`unknown1`, left, top, width, height as i16s, `displayAt`) and
its `registryId` (i32) at struct offset 18 [SMA `InfComponentsElem17`: the
field order and sizes add up to 18 for HTML, Text, RTF, Spelling, Image,
Sound, Video; FREEMEMO: "Every component struct places registryId at struct
offset 18"; TOOLKIT: `POS_OFFSET = 18`]. Shapes have no registry id.

The importer walks a group by the sizes in the headers, so an unlisted kind
is skipped by its own size and reported (`component kind 0xNN unknown`); a
header with a high byte of 0 is a desynchronised walk and ends the group
with a diagnostic. [FREEMEMO reasons the same way]

Which component is the question and which the answer is not recorded
anywhere read here. The importer takes the components in order: for a topic
every HTML / Text / RTF component is body text; for an item the first is the
question and the second the answer [TOOLKIT: "for a topic take component 0,
for an item components 0 and 1"]. Image, sound, video, and shape components
are dropped with a count in the summary.

## 6. `registry/` — texts and files

Registries are deduplicated stores of texts, images, sounds, templates,
concepts, and so on; each has `.mem` (per-member records), `.rtx` (the
members' texts), `.lst` (which elements use each member), `.ptr` (a sorted
index), and for texts `.rtf`. [HELP] [HELP02] [BACKUP: `Text`, `Image`,
`Concept`, `Template`, `Tasklist`, `Reference`, `Program`, `Comment`, `Font`,
`Style`, `Lexicon`, each with `.lst .mem .ptr .rtx`; plus `concept.dat`,
`reference.dat`, `tasklist.dat`]

`<reg>.mem`: fixed 30-byte records, member N at record N-1. [SMA
`RegMemElem17`, Size = 30] [FREEMEMO: 30] [TOOLKIT: 30] [BACKUP: every `.mem`
is a multiple of 30, and every `.ptr` is 4 × that count: `Concept.mem` 420 =
14 × 30 with `Concept.ptr` 56 = 14 × 4, `Template` 480 / 64, `Image` 150 /
20, `Reference` 210 / 28, `Program` 180 / 24, `Tasklist` 30 / 4]

| offset | type | field | source |
| --- | --- | --- | --- |
| 0 | i32 | use count | SMA, FREEMEMO, TOOLKIT |
| 4 | u8 | link type: 0 deleted, 1 RTF, 2 file and rtx, 3 rtx, 5 file | SMA (byte), TOOLKIT (the values; reads it as u16) |
| 5 | u8 | unknown | SMA |
| 6 | i32 | unknown | SMA |
| 10 | i32 | offset into `.rtx`, 1-based | SMA, FREEMEMO, TOOLKIT |
| 14 | i32 | length in `.rtx`, trailer included | SMA, FREEMEMO, TOOLKIT |
| 18 | i32 | "lstRelated" (SMA: "Physical position ?") | SMA | 
| 22 | i32 | file slot number in `elements/` (0 = none), or a position for RTF / template members | SMA, FREEMEMO, TOOLKIT |
| 26 | i32 | slot length or concept group | SMA |

`<reg>.rtx`: one record per member with a text, at the member's 1-based
offset: the text bytes, a NUL, the member id as i32, one flag byte; the
`.mem` length counts all of it, so the text is length − 6 bytes. [FREEMEMO:
"<value> NUL <int32 member-id> <byte flag>"; TOOLKIT: "[UTF-8 text] + [null]
+ [4 B own id] + [1 B type flag]"] The trailing id is checked against the
member id; a mismatch is reported and the member's text is not used.
Text is UTF-8; older imports may carry windows-1252, so a UTF-8 decode that
fails falls back to windows-1252. [FREEMEMO] [TOOLKIT falls back to the
system code page]

An element's title is `Text` member `ElementInfo[2]`'s text. [SMA, FREEMEMO,
TOOLKIT] An HTML component's text is `Text` member `registryId`'s file slot
(§7); a Text component's text is the member's `.rtx` text (link type 3). A
member with both (link type 2) is read from the file. [TOOLKIT's link types;
FREEMEMO reads the slot file first and falls back to the `.rtx` text]

`Text.lst`, `Text.ptr`, `Text.rtf`, `concept.dat`, `reference.dat` (32-byte
records of eight Text member ids [FREEMEMO]), `tasklist.dat` are not read.

## 7. `elements/` — file slots

Media and HTML files, one per "filespace slot", named `<slot>.<ext>`.
[HELP] [HELP02] [FAQ16: "filespace slot #585" → `585.bmp`] The folder tree
"sticks to the 40-files-per-folder limit to maximize the performance on
CD-ROM media". [HELP]

Observed placement [SMJS: `1.HTM … 10.HTM` at the top, `1/11.HTM … 1/20.HTM`;
BACKUP: `1.pdf 2.HTM 3.HTM … 10.HTM` at the top, `1/11…20`, `2/21…30`, …
`12/121…127`; FAQ16: `1/17.HTM`, `1/28/585.bmp`, `27/21/8315.HTM`]: ten
files per leaf folder, thirty folders per folder, so forty entries. TOOLKIT
states the rule as tiers of 10, 300, 9000, 270000, 8100000 slots (limits 10,
310, 9310, 279310, 8379310): slot s ≤ 10 sits at the top; otherwise the
folder digits come from s minus the previous tier's limit, divided out
tier by tier. The three FAQ16 paths and every BACKUP path agree with that
rule.

The importer does not compute paths: it walks `elements/` once and indexes
every file by the integer stem of its name, whatever the extension and the
folder (`124.htm` and `121.pdf` are both slots) [FREEMEMO does the same].
Duplicate stems are reported.

## 8. `info/RepetitionHistory.dat` — the repetition log

"File with the repetition history of all elements (date, hour, grade,
interval, etc.)" [HELP, as `RepetitionHist.dat`]; "repetition history of all
individual elements … optional" [HELP02, as `reps.dat`]. The hour is recorded
only since SuperMemo 2006. [SRSC, citing SuperMemo's "Repetition history"
help] SM17+ derives its state from this history rather than from stored
scalars. [SRSC]

Fixed 39-byte records. [FREEMEMO: 39] [BACKUP: 10335 = 265 × 39, and fourteen
older versions, every one a multiple of 39]

| offset | type | field | source |
| --- | --- | --- | --- |
| 0 | i32 | element id | FREEMEMO (measured) |
| 4 | u16 | ordinal of this repetition for the element | FREEMEMO (measured) |
| 10 | f64 | when, a TDateTime; below 1000 means a placeholder row for an element scheduled but never repeated | FREEMEMO (measured) |
| 6–9, 18–38 | | unknown | |

**The grade is not known.** FREEMEMO's import lists "Per-repetition grade —
not recoverable from the collection format" and "Lapse counts — not
recoverable from the collection format"; nothing else read here places the
grade or the interval in the record. So the plan's "replay the history
through `grade`" is not possible from these notes: the importer counts an
element's dated rows as its repetition count and seeds the card's schedule
(§13). The file is optional; without it the count is left out.

## 9. `info/repetitions.dat`, `priority.sub`, `Outstanding*.sub`

- `repetitions.dat`: "the dates of the nearest repetition for each element"
  [HELP]; one i32 per element, element N at index N-1 [FREEMEMO reads it as
  an i32 array; BACKUP: 760 = 190 × 4 for 190 elements]. The day's epoch is
  not verified; not read.
- `priority.sub`: "element subset file holding the priority queue. Elements
  are stored in this subset in the order of priority" [HELP]; an i32 array of
  element ids, first = highest priority [FREEMEMO; BACKUP: 736 = 184 × 4,
  fewer than the 190 elements]. The importer maps rank r of n to
  `round(100 × r / (n − 1))`, 0 when n = 1; an element not in the file gets
  no `pri` field. [FREEMEMO maps the same way] The percentage SuperMemo shows
  is not recovered; the rank is.
- `Outstanding.sub`, `OutstandingItems.sub`, `OutstandingTopics.sub`: the
  day's outstanding queues, rebuilt from `repetitions.dat` at the start of a
  learning day [HELP]; i32 arrays [FREEMEMO; BACKUP: 260 = 65 × 4 = 55 + 10
  items and topics]. Not read: the vault's queue is computed from the
  schedules the importer writes.
- `.sub` files under `history/` and `subsets/`: the same shape, not read.

## 10. Tasklists

"`tasks` folder: tasklist files. `tasklist name.dat` (task data), `tasklist
name.ptr` (sorted pointers), `tasklist name.txt` (text export, deletable)."
[HELP] [SMJS: `tasks/Tasks.dat`; BACKUP: `tasks/Tasks.dat`, 0 bytes, and
`registry/tasklist.dat`, 29 bytes, `Tasklist.mem` one member]

The record layout of `tasks/*.dat` is unknown: no source read here describes
it, and the only live example is empty. A task is still an element (type 2)
in the tree, so the importer places tasks from the tree alone and reads no
deadline or value: `write: due=<import day> ivl=1 reps=0 done=false`, the
priority from `priority.sub` like every other element. Task files that are
non-empty are reported as unread.

## 11. Element HTML

Topics and items are HTML files in `elements/` (SuperMemo's HTML components),
or plain texts in `Text.rtx` (Text components). [HELP: `elements` holds
"html, images, sound, video, OLE, scripts"; TOOLKIT; BACKUP: 116 `.htm`/
`.HTM`, 6 `.pdf`, 5 `.jpg`]

Unknown: the exact markup SuperMemo uses for a cloze (the question of a
cloze item shows `[...]` where the clozed text was; which span classes wrap
it is not documented in the sources read). The importer recognises a cloze
item by the literal `[...]` in the question's text and a non-empty answer.
Also unknown: how an extract's HTML refers back to its parent (SuperMemo
keeps that as a reference in the text; not read), and the reference block
SuperMemo appends to topics (`#Title`, `#Source` … lines; left in the text
as prose).

## 12. Days and dates

- TDateTime (Delphi): an f64 whose integer part is days since 1899-12-30 and
  whose fraction is the time of day. SuperMemo writes "never" as a value
  below 1000. [FREEMEMO: "A TDateTime below 1000 is SuperMemo's 'never'
  rather than the year 1902"]
- real48 (Borland): byte 0 is the exponent (biased by 129; 0 means the value
  is 0), bytes 1–5 the mantissa low-to-high with the sign in bit 7 of byte 5
  and an implicit leading 1. [FREEMEMO's decoder; the type is Turbo Pascal's
  `real`]
- Day numbers (`ElementInfo` offset 18) are relative to a per-collection
  epoch. FREEMEMO recovers it as the mode of `floor(lastTouch) − lastRepDay`
  over elements that have both, and reports the fraction of elements that
  vote for the mode (below 1 is normal: elements touched after their last
  repetition; near 0 means the layout does not hold). The importer does the
  same; with no votes it reports the epoch as unknown and uses
  `floor(lastTouch)` as the last repetition day, saying so. Whether the
  epoch is the `.kno`'s `FirstDay` is unknown.

## 13. What the importer writes, and from what

| in SuperMemo | evidence | in the vault |
| --- | --- | --- |
| element 1 | §3 | the vault root |
| concept group; topic with children and no body text | §4 type byte, §5 | a folder |
| topic with body text | §4, §5, §6, §7 | a source: `type: source`, `frozen: true`, `imported`, `title` when it differs from the file name; a child of a topic-document is an extract under `name/`, with `type: extract` |
| item | §4 | a q&a card at the end of the nearest topic-document above it (a child of an item lands in the nearest topic); under a folder with no topic above it, a `cards.md` deck in that folder |
| item whose question holds `[...]` | §11 | a cloze card, `{{c1::answer}}` in place of every `[...]` |
| task | §4, §10 | a draft in the nearest folder: `type: draft`, `started`, `write: due=<import day> ivl=1 reps=0 done=false` |
| template; deleted element | §4 | skipped, counted |
| unknown type byte | §4 | skipped, reported |
| rank in `priority.sub` | §9 | `pri` on the document; on a card's own `sr` line when it differs from its document's |
| topic interval ≥ 1 and last repetition day ≥ 1 | §4, §12 | `read: due=<last + interval> ivl=<interval> reps=<dated history rows> pos=0 af=<A-factor>` (`af` only when ≥ 1.1, the format's floor; `reps` only with a history file) |
| item interval ≥ 1 and last repetition day ≥ 1 | §4, §8, §12 | `<!-- sr due=<last + interval> st=review s=<interval> d=5 r=<dated rows> ivl=<interval> last=<last day> -->`, the plan's seed, since grades are not readable |
| anything else | | not written; an unscheduled topic is not enrolled, an unscheduled item is a new card |

Every vault file is built as a `Doc` and written through `Vault`, so it
parses with no diagnostics by construction; the test asserts it.
