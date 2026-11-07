//! The store (milestone 59): a collection is one SQLite file under the
//! app's data directory, `collections/<name>/collection.db`, with the files
//! that are not text (PDFs, images) beside it under `blobs/`, each named by
//! its SHA-256.
//!
//! `documents` is the tree: every folder, document and file is a row with
//! an id, its parent's id and its name, so a path is made from names and
//! parents and a rename or a move is one row changing. A document's text
//! is Markdown as FORMAT.md has it, its front matter block kept apart from
//! the rest. `blobs` names the files beside the database.
//!
//! Since milestone 60 the state is in tables of its own, and a document's
//! text is stored without it: `schedules` (a card's lines by its id, a
//! section's by its heading, a document's `read` and `write`), `reviews`
//! (the review log, a line a row), `documents.place` (the order chosen for
//! a directory), `not_same` (pairs said not the same fact). `digests` is
//! the index: what the queue, a deck's rows and the counts need of each
//! document, written with it, so opening a collection parses nothing.
//! `originals` keeps a file as it came in while what the tables hold
//! still composes to the same, so an untouched file is exported byte for
//! byte. A document's text, its schedules, its digest, its original and a
//! grade's line in the log are written in one transaction.
//!
//! Since milestone 61 a collection that syncs keeps the engine's state
//! beside its rows (`src/sync/engine.ts` is the engine): `regs`, a register
//! a field (a row's name and parent, a line of front matter, a schedule),
//! each with the stamp of the write that won it; `crdt`, a document's text
//! as the text library keeps it; `outbox`, the changes made here and not
//! yet written to the storage; `sync_meta`, the device, its clock and how
//! far each other device has been read. `batch` writes any of these with
//! the rows they belong to in one transaction, so a change and its record
//! are never apart.
//!
//! Since milestone 63 a blob a row names need not be here: a collection
//! that keeps only the files it has opened knows a PDF by its hash and its
//! size (`blobs.path` empty) until the storage has given it its bytes.
//! Big files come and go as files, never through the renderer: one taken
//! in from disk (`take`), one that came down from a storage (`land`), a
//! piece of one read for the page that asks (`blob_range`).
//!
//! Since milestone 58 a page of ink is a file's row that holds no blob
//! (`ink-01.pkdrawing`; `documents.kind` is checked against the three
//! kinds there were, so there is no fourth) and its strokes are rows of
//! `ink`, each named by what it is (`tauri-plugin-ink` reads a
//! PencilKit drawing as strokes). Nothing made from them is kept: the
//! drawing PencilKit opens and the picture a note shows are put together
//! when they are read (`ink_file`).
//!
//! Since milestone 67 a book's page may be written on. Those strokes are
//! rows of `ink` too, under a page that is no row: `p.<the PDF's
//! SHA-256>.<the page's number>`. They belong to the file by what it is,
//! not to a row that names it, so no row's delete takes them, and they
//! are never written into the PDF. Read, they are a drawing for the
//! canvas or a picture of the whole page (`ink_page`).
//!
//! Since milestone 68 every document's text and every card can be searched.
//! `search` holds a row a block, its text as it is shown and folded
//! (`hay`), and `search_grams` is FTS5's three-letter pieces of `hay`. The
//! folding is the renderer's (`src/format/fold.ts`), so nothing here folds:
//! the rows come with the document's write and go by its row's delete, a
//! rename touches neither, and they are this device's alone: nothing of
//! them reaches `regs`, `crdt` or `outbox`. A collection from before them
//! is walked by the renderer as it opens; `search_meta` says how far.
//!
//! Nothing here knows the format or what a path is: the renderer's
//! `src/vault/store.ts` reads the rows once, keeps the tree, takes a file
//! apart on a write (`src/vault/lift.ts`) and puts it together on a read.

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use base64::Engine as _;
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

/// The database's file in a collection's folder.
pub const DB_FILE: &str = "collection.db";
const BLOBS_DIR: &str = "blobs";
/// What is made from a page of ink's strokes when it is read as a file, kept until the page changes.
const INK_DIR: &str = "ink";

const SCHEMA: &str = "
CREATE TABLE IF NOT EXISTS blobs (
  hash TEXT PRIMARY KEY,
  size INTEGER NOT NULL,
  path TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  parent TEXT REFERENCES documents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  place REAL,
  kind TEXT NOT NULL CHECK (kind IN ('folder', 'doc', 'file')),
  front TEXT,
  text TEXT,
  blob TEXT REFERENCES blobs(hash),
  size INTEGER NOT NULL DEFAULT 0,
  rev INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS documents_parent ON documents(parent);
CREATE TABLE IF NOT EXISTS schedules (
  doc TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('card', 'section', 'read', 'write')),
  item TEXT NOT NULL,
  key TEXT NOT NULL,
  due TEXT,
  last TEXT,
  attrs TEXT NOT NULL,
  PRIMARY KEY (doc, kind, item, key)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS schedules_due ON schedules(due);
CREATE TABLE IF NOT EXISTS digests (
  doc TEXT PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
  data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS originals (
  key TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  stamp TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reviews (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  file TEXT NOT NULL,
  at TEXT NOT NULL,
  doc TEXT NOT NULL,
  card TEXT NOT NULL,
  key TEXT,
  g INTEGER NOT NULL,
  line TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS reviews_file ON reviews(file, seq);
CREATE INDEX IF NOT EXISTS reviews_at ON reviews(at);
CREATE TABLE IF NOT EXISTS not_same (pair TEXT PRIMARY KEY) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS regs (
  key TEXT PRIMARY KEY,
  stamp TEXT NOT NULL,
  value TEXT
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS crdt (
  doc TEXT PRIMARY KEY,
  state BLOB NOT NULL
);
CREATE TABLE IF NOT EXISTS outbox (
  seq INTEGER PRIMARY KEY,
  data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sync_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
) WITHOUT ROWID;
CREATE TRIGGER IF NOT EXISTS documents_gone AFTER DELETE ON documents
BEGIN
  DELETE FROM originals WHERE key = OLD.id;
END;
CREATE TABLE IF NOT EXISTS ink (
  page TEXT NOT NULL,
  stroke TEXT NOT NULL,
  at REAL NOT NULL,
  data BLOB NOT NULL,
  PRIMARY KEY (page, stroke)
) WITHOUT ROWID;
CREATE TRIGGER IF NOT EXISTS documents_gone_ink AFTER DELETE ON documents
BEGIN
  DELETE FROM ink WHERE page = OLD.id;
END;
CREATE TABLE IF NOT EXISTS search (
  id INTEGER PRIMARY KEY,
  doc TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  block INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('heading', 'card', 'text')),
  card TEXT,
  hay TEXT NOT NULL,
  text TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS search_doc ON search(doc);
CREATE VIRTUAL TABLE IF NOT EXISTS search_grams USING fts5(hay, content = 'search', content_rowid = 'id', tokenize = 'trigram case_sensitive 1');
CREATE TRIGGER IF NOT EXISTS search_in AFTER INSERT ON search
BEGIN
  INSERT INTO search_grams (rowid, hay) VALUES (NEW.id, NEW.hay);
END;
CREATE TRIGGER IF NOT EXISTS search_out AFTER DELETE ON search
BEGIN
  INSERT INTO search_grams (search_grams, rowid, hay) VALUES ('delete', OLD.id, OLD.hay);
END;
CREATE TABLE IF NOT EXISTS search_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
) WITHOUT ROWID;
";

/// The schema this code writes. A collection made before the state had
/// tables is 1: it opens, and the renderer takes its documents apart
/// before anything else reads them (`storeFs` in `src/vault/store.ts`).
/// 3 adds the engine's tables (milestone 61), which are made when a
/// collection opens; a collection of 2 needs nothing more. 4 adds `ink`
/// (milestone 58), made the same way: a collection of 3 opens as it is.
/// 5 adds the search index's tables (milestone 68), made the same way;
/// the rows of a collection of 4 are made by a walk, the app open meanwhile.
pub const VERSION: i64 = 5;
/// What FTS5's three-letter pieces cannot find: anything shorter is looked for by reading `hay`.
const GRAM: usize = 3;
/// The key of `search_meta` that says how far the walk has come; its value when no document is left.
const WALKED: &str = "walked";
const WALKED_ALL: &str = "all";

/// A row of the tree, without its text.
#[derive(Serialize, Debug, Clone, PartialEq)]
pub struct Row {
    pub id: String,
    pub parent: Option<String>,
    pub name: String,
    pub place: Option<f64>,
    pub kind: String,
    /// The length in bytes of what the row holds: its text, or its blob.
    pub size: i64,
    /// Moves when the row's content is written, never on a rename or a move.
    pub rev: i64,
    pub blob: Option<String>,
}

/// Where a row is in the tree: all of it is written on every `put`.
#[derive(Deserialize, Debug, Clone)]
pub struct Place {
    pub id: String,
    pub parent: Option<String>,
    pub name: String,
    pub place: Option<f64>,
    pub kind: String,
}

/// What a row holds: text (a document's `front` and `text`, a hidden
/// file's `text`), or a blob by hash; with none of them the row holds
/// nothing (a folder).
#[derive(Deserialize, Debug, Clone, Default)]
pub struct Content {
    pub front: Option<String>,
    pub text: Option<String>,
    pub blob: Option<String>,
}

/// One schedule: whose it is (`kind`, `item`), which line (`key`), and the
/// line's attributes as JSON, as the renderer's model holds them.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct Sched {
    pub kind: String,
    pub item: String,
    pub key: String,
    pub attrs: String,
}

/// A file as it came in, and the stamp of what the tables composed to then.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct Original {
    pub text: String,
    pub stamp: String,
}

/// One line of the review log: what it is found by, and the line itself.
#[derive(Deserialize, Debug, Clone)]
pub struct ReviewRow {
    pub file: String,
    pub at: String,
    pub doc: String,
    pub card: String,
    pub key: Option<String>,
    pub g: i64,
    pub line: String,
}

/// A block as the search index holds it: where it is, what is shown, and `hay`, that text folded, the only thing looked through.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct SearchRow {
    pub block: i64,
    pub kind: String,
    pub card: Option<String>,
    pub hay: String,
    pub text: String,
}

/// A block found: the row of the document that holds it, and what `SearchRow` says of it.
#[derive(Serialize, Debug, Clone, PartialEq)]
pub struct SearchHit {
    pub doc: String,
    pub block: i64,
    pub kind: String,
    pub card: Option<String>,
    pub text: String,
}

/// How far the walk of a collection from before the index has come. `after`: the last document's id it has been through.
#[derive(Serialize, Debug, Clone, PartialEq)]
pub struct SearchState {
    pub done: bool,
    pub after: Option<String>,
}

/// What goes with a document's text in the transaction that writes it.
#[derive(Deserialize, Debug, Clone, Default)]
pub struct Lift {
    pub state: Vec<Sched>,
    pub digest: String,
    pub original: Option<Original>,
    pub size: i64,
    #[serde(default)]
    pub reviews: Vec<ReviewRow>,
    /// The document's rows of the search index. Text that is what the row holds already keeps the ones it has.
    #[serde(default)]
    pub search: Option<Vec<SearchRow>>,
}

/// A document as it is stored: its text without its state, its schedules, its original.
#[derive(Serialize, Debug, Clone, PartialEq)]
pub struct DocContent {
    pub front: String,
    pub text: String,
    pub state: Vec<Sched>,
    pub original: Option<Original>,
}

/// A register: a field's value and the stamp of the write that won it.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct Reg {
    pub key: String,
    pub stamp: String,
    pub value: Option<String>,
}

/// One stroke of a page of ink: its name, when it was drawn (seconds since 1970: the order strokes lie in), and a `PKDrawing` of it alone, in base64.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct InkStroke {
    pub stroke: String,
    pub at: f64,
    pub data: String,
}

/// One write of a batch (`Store::batch`): the store's own writes, and the engine's.
#[derive(Deserialize, Debug, Clone)]
#[serde(tag = "op", rename_all = "camelCase")]
pub enum Op {
    Put { at: Place, content: Option<Content>, lift: Option<Lift> },
    Remove { ids: Vec<String> },
    Places { set: Vec<(String, f64)> },
    /// `mode`: `add` the lines, `replace` the file's with them, or `union` (a line the file holds already is not added).
    Reviews { file: String, rows: Vec<ReviewRow>, mode: String },
    Same { pairs: Vec<String> },
    Original { key: String, original: Option<Original> },
    Meta { key: String, value: Option<String> },
    Regs { set: Vec<Reg> },
    /// A document's text as the text library keeps it, in base64; none forgets it.
    Crdt { doc: String, state: Option<String> },
    Out { seq: i64, data: String },
    #[serde(rename_all = "camelCase")]
    OutDrop { up_to: i64 },
    /// A blob a row is about to name, by its hash and size, whether or not its bytes are here.
    Expect { hash: String, size: i64 },
    /// Strokes added to a page of ink and taken from it. The page's row says how many bytes its strokes are, and its `rev` moves.
    Ink { page: String, add: Vec<InkStroke>, remove: Vec<String> },
    /// A document's rows of the search index, in place of the ones it has.
    Search { doc: String, rows: Vec<SearchRow> },
    /// The walk has been through every document up to `after`; none says it has been through them all.
    SearchWalked { after: Option<String> },
}

#[derive(Serialize, Debug, Clone, PartialEq)]
pub struct BlobInfo {
    pub hash: String,
    pub size: i64,
}

pub struct Store {
    conn: Connection,
    dir: PathBuf,
    rev: i64,
}

fn err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

fn read_row(r: &rusqlite::Row<'_>) -> rusqlite::Result<Row> {
    Ok(Row {
        id: r.get(0)?,
        parent: r.get(1)?,
        name: r.get(2)?,
        place: r.get(3)?,
        kind: r.get(4)?,
        size: r.get(5)?,
        rev: r.get(6)?,
        blob: r.get(7)?,
    })
}

const ROW_COLUMNS: &str = "id, parent, name, place, kind, size, rev, blob";

impl Store {
    /// A new collection in `dir`, which must not hold one.
    pub fn create(dir: &Path) -> Result<Store, String> {
        if dir.join(DB_FILE).exists() {
            return Err("already there".to_string());
        }
        std::fs::create_dir_all(dir).map_err(err)?;
        Store::at(dir)
    }

    /// The collection in `dir`.
    pub fn open(dir: &Path) -> Result<Store, String> {
        if !dir.join(DB_FILE).is_file() {
            return Err(format!("{}: no collection", dir.display()));
        }
        Store::at(dir)
    }

    fn at(dir: &Path) -> Result<Store, String> {
        let conn = Connection::open(dir.join(DB_FILE)).map_err(err)?;
        conn.pragma_update(None, "journal_mode", "WAL").map_err(err)?;
        // with a write-ahead log a commit is safe without a sync of its own; the log is synced at a checkpoint
        conn.pragma_update(None, "synchronous", "NORMAL").map_err(err)?;
        conn.pragma_update(None, "foreign_keys", "ON").map_err(err)?;
        let fresh: bool = conn
            .query_row("SELECT COUNT(*) = 0 FROM sqlite_master WHERE name = 'documents'", [], |r| r.get(0))
            .map_err(err)?;
        conn.execute_batch(SCHEMA).map_err(err)?;
        // a new collection is the present schema; an older one keeps its number until the renderer has brought it up
        if fresh {
            conn.pragma_update(None, "user_version", VERSION).map_err(err)?;
            // nothing in it to walk: whatever comes in brings its rows
            conn.execute("INSERT OR REPLACE INTO search_meta (key, value) VALUES (?1, ?2)", params![WALKED, WALKED_ALL]).map_err(err)?;
        }
        let rev: i64 = conn
            .query_row("SELECT COALESCE(MAX(rev), 0) FROM documents", [], |r| r.get(0))
            .map_err(err)?;
        let store = Store { conn, dir: dir.to_path_buf(), rev };
        store.sweep()?;
        Ok(store)
    }

    /// An in-memory collection whose blobs go under `dir`: the tests'.
    #[cfg(test)]
    fn memory(dir: &Path) -> Store {
        let conn = Connection::open_in_memory().unwrap();
        conn.pragma_update(None, "foreign_keys", "ON").unwrap();
        conn.execute_batch(SCHEMA).unwrap();
        conn.pragma_update(None, "user_version", VERSION).unwrap();
        conn.execute("INSERT OR REPLACE INTO search_meta (key, value) VALUES (?1, ?2)", params![WALKED, WALKED_ALL]).unwrap();
        Store { conn, dir: dir.to_path_buf(), rev: 0 }
    }

    /// The schema the collection was last written by.
    pub fn version(&self) -> Result<i64, String> {
        self.conn.query_row("PRAGMA user_version", [], |r| r.get(0)).map_err(err)
    }

    pub fn set_version(&self, n: i64) -> Result<(), String> {
        self.conn.pragma_update(None, "user_version", n).map_err(err)
    }

    /// Every row, without text.
    pub fn rows(&self) -> Result<Vec<Row>, String> {
        let mut st = self
            .conn
            .prepare(&format!("SELECT {ROW_COLUMNS} FROM documents"))
            .map_err(err)?;
        let rows = st.query_map([], read_row).map_err(err)?;
        rows.collect::<rusqlite::Result<Vec<Row>>>().map_err(err)
    }

    fn row(&self, id: &str) -> Result<Option<Row>, String> {
        self.conn
            .query_row(&format!("SELECT {ROW_COLUMNS} FROM documents WHERE id = ?1"), [id], read_row)
            .optional()
            .map_err(err)
    }

    /// A row's text: its front matter block, then the rest.
    pub fn text(&self, id: &str) -> Result<String, String> {
        let got: Option<(Option<String>, Option<String>)> = self
            .conn
            .query_row("SELECT front, text FROM documents WHERE id = ?1", [id], |r| Ok((r.get(0)?, r.get(1)?)))
            .optional()
            .map_err(err)?;
        let (front, text) = got.ok_or_else(|| format!("{id}: no such row"))?;
        Ok(format!("{}{}", front.unwrap_or_default(), text.unwrap_or_default()))
    }

    /// A document's text without its state, its schedules, and its original.
    pub fn doc(&self, id: &str) -> Result<DocContent, String> {
        let got: Option<(Option<String>, Option<String>)> = self
            .conn
            .query_row("SELECT front, text FROM documents WHERE id = ?1", [id], |r| Ok((r.get(0)?, r.get(1)?)))
            .optional()
            .map_err(err)?;
        let (front, text) = got.ok_or_else(|| format!("{id}: no such row"))?;
        let mut st = self
            .conn
            .prepare("SELECT kind, item, key, attrs FROM schedules WHERE doc = ?1")
            .map_err(err)?;
        let state = st
            .query_map([id], |r| Ok(Sched { kind: r.get(0)?, item: r.get(1)?, key: r.get(2)?, attrs: r.get(3)? }))
            .map_err(err)?
            .collect::<rusqlite::Result<Vec<Sched>>>()
            .map_err(err)?;
        let original = self
            .conn
            .query_row("SELECT text, stamp FROM originals WHERE key = ?1", [id], |r| Ok(Original { text: r.get(0)?, stamp: r.get(1)? }))
            .optional()
            .map_err(err)?;
        Ok(DocContent { front: front.unwrap_or_default(), text: text.unwrap_or_default(), state, original })
    }

    /// Write a row: where it is, and with `content` what it holds. Without
    /// `content` an existing row keeps what it has (a rename, a move) and
    /// its `rev`; a new row holds nothing. `lift` goes with a document's
    /// text: its schedules, its digest and its original replace the ones it
    /// had, and a grade's lines join the log, all in this one transaction;
    /// content without it clears them. Text that is what the row holds
    /// already is not written again.
    pub fn put(&mut self, at: &Place, content: Option<&Content>, lift: Option<&Lift>) -> Result<Row, String> {
        let mut rev = self.rev;
        let tx = self.conn.transaction().map_err(err)?;
        put_tx(&tx, &mut rev, at, content, lift)?;
        tx.commit().map_err(err)?;
        self.rev = rev;
        self.row(&at.id)?.ok_or_else(|| format!("{}: no such row", at.id))
    }

    /// Several writes as one transaction: all of them, or none. The rows the `put`s wrote, as they are after it, in order.
    pub fn batch(&mut self, ops: &[Op]) -> Result<Vec<Row>, String> {
        let mut rev = self.rev;
        let tx = self.conn.transaction().map_err(err)?;
        let mut put: Vec<&str> = Vec::new();
        for op in ops {
            match op {
                Op::Put { at, content, lift } => {
                    put_tx(&tx, &mut rev, at, content.as_ref(), lift.as_ref())?;
                    put.push(&at.id);
                }
                Op::Remove { ids } => remove_tx(&tx, ids)?,
                Op::Places { set } => places_tx(&tx, set)?,
                Op::Reviews { file, rows, mode } => reviews_tx(&tx, file, rows, mode)?,
                Op::Same { pairs } => same_tx(&tx, pairs)?,
                Op::Original { key, original } => original_tx(&tx, key, original.as_ref())?,
                Op::Meta { key, value } => match value {
                    Some(v) => tx.execute("INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?1, ?2)", params![key, v]).map(|_| ()).map_err(err)?,
                    None => tx.execute("DELETE FROM sync_meta WHERE key = ?1", [key]).map(|_| ()).map_err(err)?,
                },
                Op::Regs { set } => {
                    for r in set {
                        tx.execute("INSERT OR REPLACE INTO regs (key, stamp, value) VALUES (?1, ?2, ?3)", params![r.key, r.stamp, r.value]).map_err(err)?;
                    }
                }
                Op::Crdt { doc, state } => match state {
                    Some(b64) => {
                        let bytes = base64::engine::general_purpose::STANDARD.decode(b64).map_err(err)?;
                        tx.execute("INSERT OR REPLACE INTO crdt (doc, state) VALUES (?1, ?2)", params![doc, bytes]).map_err(err)?;
                    }
                    None => {
                        tx.execute("DELETE FROM crdt WHERE doc = ?1", [doc]).map_err(err)?;
                    }
                },
                Op::Out { seq, data } => {
                    tx.execute("INSERT OR REPLACE INTO outbox (seq, data) VALUES (?1, ?2)", params![seq, data]).map_err(err)?;
                }
                Op::OutDrop { up_to } => {
                    tx.execute("DELETE FROM outbox WHERE seq <= ?1", [up_to]).map_err(err)?;
                }
                Op::Expect { hash, size } => expect_tx(&tx, hash, *size)?,
                Op::Ink { page, add, remove } => {
                    ink_tx(&tx, &mut rev, page, add, remove)?;
                    put.push(page);
                }
                Op::Search { doc, rows } => search_tx(&tx, doc, rows)?,
                Op::SearchWalked { after } => {
                    tx.execute("INSERT OR REPLACE INTO search_meta (key, value) VALUES (?1, ?2)", params![WALKED, after.as_deref().unwrap_or(WALKED_ALL)]).map_err(err)?;
                }
            }
        }
        let mut rows = Vec::new();
        for id in put {
            let row = tx
                .query_row(&format!("SELECT {ROW_COLUMNS} FROM documents WHERE id = ?1"), [id], read_row)
                .optional()
                .map_err(err)?;
            if let Some(r) = row {
                rows.push(r);
            }
        }
        tx.commit().map_err(err)?;
        self.rev = rev;
        Ok(rows)
    }

    /// The engine's own keys and values: the device, its clock, how far each device has been read.
    pub fn meta(&self) -> Result<Vec<(String, String)>, String> {
        let mut st = self.conn.prepare("SELECT key, value FROM sync_meta ORDER BY key").map_err(err)?;
        let rows = st.query_map([], |r| Ok((r.get(0)?, r.get(1)?))).map_err(err)?;
        rows.collect::<rusqlite::Result<Vec<_>>>().map_err(err)
    }

    /// The registers of these keys that there are.
    pub fn regs(&self, keys: &[String]) -> Result<Vec<Reg>, String> {
        let mut st = self.conn.prepare("SELECT key, stamp, value FROM regs WHERE key = ?1").map_err(err)?;
        let mut out = Vec::new();
        for k in keys {
            let got = st
                .query_row([k], |r| Ok(Reg { key: r.get(0)?, stamp: r.get(1)?, value: r.get(2)? }))
                .optional()
                .map_err(err)?;
            if let Some(r) = got {
                out.push(r);
            }
        }
        Ok(out)
    }

    /// Every register whose key starts with one of `prefixes`, by key.
    pub fn regs_under(&self, prefixes: &[String]) -> Result<Vec<Reg>, String> {
        let mut st = self.conn.prepare("SELECT key, stamp, value FROM regs WHERE key >= ?1 AND key < ?2 ORDER BY key").map_err(err)?;
        let mut out = Vec::new();
        for p in prefixes {
            // the keys that carry the prefix are those from it up to it with its last character one higher (a prefix ends in ASCII)
            let mut end = p.clone().into_bytes();
            match end.last_mut() {
                Some(b) if *b < 0x7f => *b += 1,
                _ => return Err(format!("{p}: not a prefix")),
            }
            let end = String::from_utf8(end).map_err(err)?;
            let mut rows = st.query(params![p, end]).map_err(err)?;
            while let Some(r) = rows.next().map_err(err)? {
                out.push(Reg { key: r.get(0).map_err(err)?, stamp: r.get(1).map_err(err)?, value: r.get(2).map_err(err)? });
            }
        }
        Ok(out)
    }

    /// A document's text as the text library keeps it, in base64.
    pub fn crdt(&self, doc: &str) -> Result<Option<String>, String> {
        let got: Option<Vec<u8>> = self.conn.query_row("SELECT state FROM crdt WHERE doc = ?1", [doc], |r| r.get(0)).optional().map_err(err)?;
        Ok(got.map(|b| base64::engine::general_purpose::STANDARD.encode(b)))
    }

    /// The changes waiting to be written out, after `after`, in order: as many as fit in `bytes` (one at least).
    pub fn outbox(&self, after: i64, bytes: i64) -> Result<Vec<(i64, String)>, String> {
        let mut st = self.conn.prepare("SELECT seq, data FROM outbox WHERE seq > ?1 ORDER BY seq").map_err(err)?;
        let mut rows = st.query([after]).map_err(err)?;
        let mut out: Vec<(i64, String)> = Vec::new();
        let mut size: i64 = 0;
        while let Some(r) = rows.next().map_err(err)? {
            let data: String = r.get(1).map_err(err)?;
            size += data.len() as i64;
            if !out.is_empty() && size > bytes {
                break;
            }
            out.push((r.get(0).map_err(err)?, data));
        }
        Ok(out)
    }

    /// How many changes wait.
    pub fn outbox_count(&self) -> Result<i64, String> {
        self.conn.query_row("SELECT COUNT(*) FROM outbox", [], |r| r.get(0)).map_err(err)
    }

    /// Whether a blob of that hash is kept here: its bytes, not only its name.
    pub fn blob_has(&self, hash: &str) -> Result<bool, String> {
        self.conn.query_row("SELECT COUNT(*) > 0 FROM blobs WHERE hash = ?1 AND path <> ''", [hash], |r| r.get(0)).map_err(err)
    }

    /// Every register after `after`, by key: a page of them (a snapshot reads them all).
    pub fn regs_page(&self, after: Option<&str>, limit: i64) -> Result<Vec<Reg>, String> {
        let mut st = self.conn.prepare("SELECT key, stamp, value FROM regs WHERE key > ?1 ORDER BY key LIMIT ?2").map_err(err)?;
        let rows = st
            .query_map(params![after.unwrap_or(""), limit], |r| Ok(Reg { key: r.get(0)?, stamp: r.get(1)?, value: r.get(2)? }))
            .map_err(err)?;
        rows.collect::<rusqlite::Result<Vec<Reg>>>().map_err(err)
    }

    /// A page's strokes, in the order they were drawn.
    pub fn ink(&self, page: &str) -> Result<Vec<InkStroke>, String> {
        let mut st = self.conn.prepare("SELECT stroke, at, data FROM ink WHERE page = ?1 ORDER BY at, stroke").map_err(err)?;
        let rows = st
            .query_map([page], |r| {
                let data: Vec<u8> = r.get(2)?;
                Ok(InkStroke { stroke: r.get(0)?, at: r.get(1)?, data: base64::engine::general_purpose::STANDARD.encode(data) })
            })
            .map_err(err)?;
        rows.collect::<rusqlite::Result<Vec<_>>>().map_err(err)
    }

    /// The pages that hold strokes and whose name starts with `prefix`: a book's pages are named by its PDF's hash and the page's number (milestone 67), and are no rows.
    pub fn ink_pages(&self, prefix: &str) -> Result<Vec<String>, String> {
        let mut st = self.conn.prepare("SELECT DISTINCT page FROM ink WHERE substr(page, 1, length(?1)) = ?1 ORDER BY page").map_err(err)?;
        let rows = st.query_map([prefix], |r| r.get::<_, String>(0)).map_err(err)?;
        rows.collect::<rusqlite::Result<Vec<_>>>().map_err(err)
    }

    /// The writing on a book's page, made from its strokes: `drawing` is the `PKDrawing` the canvas opens, `picture` a PNG at 2× of the whole page, `w` by `h` points, on nothing. Nothing is kept: no file is ever compared with it.
    pub fn ink_page(&self, page: &str, what: &str, w: f64, h: f64) -> Result<Vec<u8>, String> {
        if !matches!(what, "drawing" | "picture") {
            return Err(format!("{what}: not something a page's writing is read as"));
        }
        let mut st = self.conn.prepare("SELECT data FROM ink WHERE page = ?1 ORDER BY at, stroke").map_err(err)?;
        let strokes: Vec<Vec<u8>> = st.query_map([page], |r| r.get(0)).map_err(err)?.collect::<rusqlite::Result<_>>().map_err(err)?;
        let refs: Vec<&[u8]> = strokes.iter().map(Vec::as_slice).collect();
        if what == "drawing" { tauri_plugin_ink::join(&refs) } else { tauri_plugin_ink::page_picture(&refs, w, h, 2.0) }
    }

    /// A page of ink as a file, made from its strokes: `drawing` is the `PKDrawing` PencilKit opens, `picture` a PNG at 2× of what they cover (empty when there are none).
    /// PencilKit does not write one drawing as the same bytes twice, so what is made is kept beside the database until the page's `rev` moves: a file read twice is the same file.
    pub fn ink_file(&self, page: &str, what: &str) -> Result<Vec<u8>, String> {
        if !matches!(what, "drawing" | "picture") {
            return Err(format!("{what}: not a file a page of ink is"));
        }
        let rev: i64 = self.conn.query_row("SELECT rev FROM documents WHERE id = ?1", [page], |r| r.get(0)).optional().map_err(err)?.unwrap_or(0);
        let plain = !page.is_empty() && page.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'.');
        let dir = self.dir.join(INK_DIR);
        let made = dir.join(format!("{page}.{rev}.{what}"));
        if plain {
            if let Ok(bytes) = std::fs::read(&made) {
                return Ok(bytes);
            }
        }
        let mut st = self.conn.prepare("SELECT data FROM ink WHERE page = ?1 ORDER BY at, stroke").map_err(err)?;
        let strokes: Vec<Vec<u8>> = st.query_map([page], |r| r.get(0)).map_err(err)?.collect::<rusqlite::Result<_>>().map_err(err)?;
        let refs: Vec<&[u8]> = strokes.iter().map(Vec::as_slice).collect();
        let bytes = if what == "drawing" { tauri_plugin_ink::join(&refs)? } else { tauri_plugin_ink::picture(&refs, 2.0)? };
        if plain && std::fs::create_dir_all(&dir).is_ok() {
            // the ones made before the page changed go
            let (head, tail) = (format!("{page}."), format!(".{what}"));
            for e in std::fs::read_dir(&dir).into_iter().flatten().flatten() {
                let name = e.file_name().to_string_lossy().into_owned();
                if name.starts_with(&head) && name.ends_with(&tail) {
                    let _ = std::fs::remove_file(e.path());
                }
            }
            let _ = std::fs::write(&made, &bytes);
        }
        Ok(bytes)
    }

    /// The blobs rows name whose bytes are not here, each with its size.
    pub fn blobs_away(&self) -> Result<Vec<(String, i64)>, String> {
        let mut st = self
            .conn
            .prepare("SELECT hash, size FROM blobs WHERE path = '' AND hash IN (SELECT blob FROM documents WHERE blob IS NOT NULL) ORDER BY hash")
            .map_err(err)?;
        let rows = st.query_map([], |r| Ok((r.get(0)?, r.get(1)?))).map_err(err)?;
        rows.collect::<rusqlite::Result<Vec<_>>>().map_err(err)
    }

    /// Where a blob's file is, when its bytes are here.
    pub fn blob_file(&self, hash: &str) -> Result<Option<PathBuf>, String> {
        let rel: Option<String> = self.conn.query_row("SELECT path FROM blobs WHERE hash = ?1", [hash], |r| r.get(0)).optional().map_err(err)?;
        Ok(rel.filter(|p| !p.is_empty()).map(|p| self.dir.join(p)))
    }

    /// The file at `tmp` (under this collection's `blobs/`), whose bytes hash to `hash`, is that blob from now on.
    pub fn blob_land(&self, hash: &str, tmp: &Path, size: i64) -> Result<BlobInfo, String> {
        if !is_hash(hash) {
            return Err(format!("{hash}: not a hash"));
        }
        let rel = Store::blob_path(hash);
        let abs = self.dir.join(&rel);
        if abs.is_file() {
            let _ = std::fs::remove_file(tmp);
        } else {
            std::fs::create_dir_all(abs.parent().unwrap()).map_err(err)?;
            std::fs::rename(tmp, &abs).map_err(err)?;
        }
        self.conn
            .execute(
                "INSERT INTO blobs (hash, size, path) VALUES (?1, ?2, ?3) ON CONFLICT(hash) DO UPDATE SET size = excluded.size, path = excluded.path",
                params![hash, size, rel],
            )
            .map_err(err)?;
        // a row that named it before its size was known says it now; its stamp does not move
        self.conn.execute("UPDATE documents SET size = ?2 WHERE blob = ?1 AND size <> ?2", params![hash, size]).map_err(err)?;
        Ok(BlobInfo { hash: hash.to_string(), size })
    }

    /// Where a file on its way in is written before it has its name.
    pub fn blob_tmp(&self) -> Result<PathBuf, String> {
        static N: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
        let dir = self.dir.join(BLOBS_DIR);
        std::fs::create_dir_all(&dir).map_err(err)?;
        Ok(dir.join(format!("in-{}-{}.tmp", std::process::id(), N.fetch_add(1, std::sync::atomic::Ordering::Relaxed))))
    }
}

/// Sixty-four hex digits, lower case: a SHA-256 as a blob is named by it.
pub fn is_hash(s: &str) -> bool {
    s.len() == 64 && s.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}

fn expect_tx(tx: &Connection, hash: &str, size: i64) -> Result<(), String> {
    if !is_hash(hash) {
        return Err(format!("{hash}: not a hash"));
    }
    tx.execute("INSERT OR IGNORE INTO blobs (hash, size, path) VALUES (?1, ?2, '')", params![hash, size]).map_err(err)?;
    tx.execute("UPDATE blobs SET size = ?2 WHERE hash = ?1 AND path = '' AND size = 0", params![hash, size]).map_err(err)?;
    Ok(())
}

/// `src` copied to `dest`, a megabyte at a time; its SHA-256 in hex and its length. `progress` is told the bytes so far.
pub fn copy_hashing(src: &Path, dest: &Path, mut progress: impl FnMut(u64)) -> Result<(String, u64), String> {
    use std::io::Read;
    let mut from = std::fs::File::open(src).map_err(err)?;
    let mut to = std::fs::File::create(dest).map_err(err)?;
    let mut hasher = Sha256::new();
    let mut buf = vec![0u8; 1 << 20];
    let mut done: u64 = 0;
    loop {
        let n = from.read(&mut buf).map_err(err)?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
        to.write_all(&buf[..n]).map_err(err)?;
        done += n as u64;
        progress(done);
    }
    to.sync_all().map_err(err)?;
    Ok((hasher.finalize().iter().map(|b| format!("{b:02x}")).collect(), done))
}

fn put_tx(tx: &Connection, rev_at: &mut i64, at: &Place, content: Option<&Content>, lift: Option<&Lift>) -> Result<(), String> {
    {
        if !matches!(at.kind.as_str(), "folder" | "doc" | "file") {
            return Err(format!("{}: not a kind", at.kind));
        }
        let mut rev = *rev_at;
        let exists: bool = tx
            .query_row("SELECT COUNT(*) > 0 FROM documents WHERE id = ?1", [&at.id], |r| r.get(0))
            .map_err(err)?;
        if exists {
            tx.execute(
                "UPDATE documents SET parent = ?2, name = ?3, place = ?4, kind = ?5 WHERE id = ?1",
                params![at.id, at.parent, at.name, at.place, at.kind],
            )
            .map_err(err)?;
        } else {
            rev += 1;
            tx.execute(
                "INSERT INTO documents (id, parent, name, place, kind, rev) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![at.id, at.parent, at.name, at.place, at.kind, rev],
            )
            .map_err(err)?;
        }
        if let Some(c) = content {
            let size: i64 = match (&c.blob, lift) {
                (Some(hash), _) => tx
                    .query_row("SELECT size FROM blobs WHERE hash = ?1", [hash], |r| r.get(0))
                    .optional()
                    .map_err(err)?
                    .ok_or_else(|| format!("{hash}: no such blob"))?,
                (None, Some(l)) => l.size,
                (None, None) => (c.front.as_deref().map_or(0, str::len) + c.text.as_deref().map_or(0, str::len)) as i64,
            };
            rev += 1;
            // the text is written when it differs: a grade changes a schedule's row, not the document's text
            let rewritten = tx
                .execute(
                    "UPDATE documents SET front = ?2, text = ?3 WHERE id = ?1 AND (front IS NOT ?2 OR text IS NOT ?3)",
                    params![at.id, c.front, c.text],
                )
                .map_err(err)?
                > 0;
            tx.execute("UPDATE documents SET blob = ?2, size = ?3, rev = ?4 WHERE id = ?1", params![at.id, c.blob, size, rev])
                .map_err(err)?;
            tx.execute("DELETE FROM schedules WHERE doc = ?1", [&at.id]).map_err(err)?;
            tx.execute("DELETE FROM digests WHERE doc = ?1", [&at.id]).map_err(err)?;
            tx.execute("DELETE FROM originals WHERE key = ?1", [&at.id]).map_err(err)?;
            if let Some(l) = lift {
                for s in &l.state {
                    // the two instants a merge and a query go by, beside the line whole
                    let v: serde_json::Value = serde_json::from_str(&s.attrs).map_err(err)?;
                    let when = |k: &str| v.get(k).and_then(|x| x.as_str()).map(str::to_string);
                    tx.execute(
                        "INSERT OR REPLACE INTO schedules (doc, kind, item, key, due, last, attrs) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                        params![at.id, s.kind, s.item, s.key, when("due"), when("last"), s.attrs],
                    )
                    .map_err(err)?;
                }
                tx.execute("INSERT INTO digests (doc, data) VALUES (?1, ?2)", params![at.id, l.digest]).map_err(err)?;
                // the rows are made from the text alone, so a grade rewrites none of them; one that has none may be new to the text it holds
                if let Some(rows) = &l.search {
                    let none = || tx.query_row("SELECT NOT EXISTS (SELECT 1 FROM search WHERE doc = ?1)", [&at.id], |r| r.get::<_, bool>(0)).map_err(err);
                    if rewritten || none()? {
                        search_tx(tx, &at.id, rows)?;
                    }
                }
                if let Some(o) = &l.original {
                    tx.execute("INSERT INTO originals (key, text, stamp) VALUES (?1, ?2, ?3)", params![at.id, o.text, o.stamp])
                        .map_err(err)?;
                }
                for r in &l.reviews {
                    insert_review(tx, r)?;
                    tx.execute("DELETE FROM originals WHERE key = ?1", [format!("{REVIEWS_PATH}/{}", r.file)]).map_err(err)?;
                }
            }
            // content with no rows for it: a document no more, or text on its way to being one
            if lift.is_none_or(|l| l.search.is_none()) {
                search_tx(tx, &at.id, &[])?;
            }
        }
        *rev_at = rev;
        Ok(())
    }
}

/// A document's rows of the index replaced. The triggers keep `search_grams` with them.
fn search_tx(tx: &Connection, doc: &str, rows: &[SearchRow]) -> Result<(), String> {
    tx.execute("DELETE FROM search WHERE doc = ?1", [doc]).map_err(err)?;
    let mut st = tx.prepare_cached("INSERT INTO search (doc, block, kind, card, hay, text) VALUES (?1, ?2, ?3, ?4, ?5, ?6)").map_err(err)?;
    for r in rows {
        st.execute(params![doc, r.block, r.kind, r.card, r.hay, r.text]).map_err(err)?;
    }
    Ok(())
}

fn ink_tx(tx: &Connection, rev_at: &mut i64, page: &str, add: &[InkStroke], remove: &[String]) -> Result<(), String> {
    for s in add {
        let bytes = base64::engine::general_purpose::STANDARD.decode(&s.data).map_err(err)?;
        tx.execute("INSERT OR REPLACE INTO ink (page, stroke, at, data) VALUES (?1, ?2, ?3, ?4)", params![page, s.stroke, s.at, bytes]).map_err(err)?;
    }
    for k in remove {
        tx.execute("DELETE FROM ink WHERE page = ?1 AND stroke = ?2", params![page, k]).map_err(err)?;
    }
    *rev_at += 1;
    tx.execute(
        "UPDATE documents SET size = (SELECT COALESCE(SUM(LENGTH(data)), 0) FROM ink WHERE page = ?1), rev = ?2 WHERE id = ?1",
        params![page, *rev_at],
    )
    .map_err(err)?;
    Ok(())
}

fn remove_tx(tx: &Connection, ids: &[String]) -> Result<(), String> {
    for id in ids {
        tx.execute("DELETE FROM documents WHERE id = ?1", [id]).map_err(err)?;
    }
    Ok(())
}

fn places_tx(tx: &Connection, set: &[(String, f64)]) -> Result<(), String> {
    tx.execute("UPDATE documents SET place = NULL WHERE place IS NOT NULL", []).map_err(err)?;
    for (id, place) in set {
        tx.execute("UPDATE documents SET place = ?2 WHERE id = ?1", params![id, place]).map_err(err)?;
    }
    Ok(())
}

fn reviews_tx(tx: &Connection, file: &str, rows: &[ReviewRow], mode: &str) -> Result<(), String> {
    if mode == "replace" {
        tx.execute("DELETE FROM reviews WHERE file = ?1", [file]).map_err(err)?;
    }
    for r in rows {
        if mode == "union" {
            // found by the instant's index; a line the file holds is not added again
            let have: bool = tx
                .query_row("SELECT COUNT(*) > 0 FROM reviews WHERE at = ?1 AND file = ?2 AND line = ?3", params![r.at, file, r.line], |x| x.get(0))
                .map_err(err)?;
            if have {
                continue;
            }
        }
        insert_review(tx, &ReviewRow { file: file.to_string(), ..r.clone() })?;
    }
    if mode == "union" && !rows.is_empty() {
        tx.execute("DELETE FROM originals WHERE key = ?1", [format!("{REVIEWS_PATH}/{file}")]).map_err(err)?;
    }
    Ok(())
}

fn same_tx(tx: &Connection, pairs: &[String]) -> Result<(), String> {
    tx.execute("DELETE FROM not_same", []).map_err(err)?;
    for p in pairs {
        tx.execute("INSERT OR IGNORE INTO not_same (pair) VALUES (?1)", [p]).map_err(err)?;
    }
    Ok(())
}

fn original_tx(tx: &Connection, key: &str, original: Option<&Original>) -> Result<(), String> {
    match original {
        Some(o) => tx
            .execute("INSERT OR REPLACE INTO originals (key, text, stamp) VALUES (?1, ?2, ?3)", params![key, o.text, o.stamp])
            .map(|_| ())
            .map_err(err),
        None => tx.execute("DELETE FROM originals WHERE key = ?1", [key]).map(|_| ()).map_err(err),
    }
}

impl Store {
    /// Delete rows; what is under a deleted row goes with it.
    pub fn remove(&mut self, ids: &[String]) -> Result<(), String> {
        let tx = self.conn.transaction().map_err(err)?;
        remove_tx(&tx, ids)?;
        tx.commit().map_err(err)
    }

    /// The order chosen: these rows' places, every other row's cleared.
    pub fn places(&mut self, set: &[(String, f64)]) -> Result<(), String> {
        let tx = self.conn.transaction().map_err(err)?;
        places_tx(&tx, set)?;
        tx.commit().map_err(err)
    }

    /// A page of the index as one JSON text, `[["id", digest], …]`, by id
    /// after `after`: the digests are JSON already and are not read here.
    pub fn digests(&self, after: Option<&str>, limit: i64) -> Result<String, String> {
        let mut st = self
            .conn
            .prepare("SELECT doc, data FROM digests WHERE doc > ?1 ORDER BY doc LIMIT ?2")
            .map_err(err)?;
        let rows = st
            .query_map(params![after.unwrap_or(""), limit], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
            .map_err(err)?;
        let mut out = String::from("[");
        for (i, row) in rows.enumerate() {
            let (id, data) = row.map_err(err)?;
            if i > 0 {
                out.push(',');
            }
            out.push('[');
            out.push_str(&serde_json::to_string(&id).map_err(err)?);
            out.push(',');
            out.push_str(&data);
            out.push(']');
        }
        out.push(']');
        Ok(out)
    }

    /// The blocks that hold what was asked, `limit` at most. `words` and
    /// `phrase` are folded already, `phrase` being `words` joined by a space:
    /// the blocks that hold it as written come first, then those that hold
    /// every word of it anywhere. A word of three letters or more is found
    /// by its pieces (a run of three-letter pieces in order is the text
    /// itself, so nothing found needs checking); a shorter one by reading
    /// `hay`, and a query of nothing but those reads every row until
    /// `limit` are found.
    pub fn search(&self, phrase: &str, words: &[String], limit: i64) -> Result<Vec<SearchHit>, String> {
        let long = |w: &str| w.chars().count() >= GRAM;
        let quote = |w: &str| format!("\"{}\"", w.replace('"', "\"\""));
        let mut seen: HashSet<i64> = HashSet::new();
        let mut out: Vec<SearchHit> = Vec::new();
        if words.len() > 1 && long(phrase) {
            self.search_pass(Some(&quote(phrase)), &[], limit, &mut seen, &mut out)?;
        }
        if words.is_empty() || out.len() as i64 >= limit {
            return Ok(out);
        }
        let pieces: Vec<String> = words.iter().filter(|w| long(w)).map(|w| quote(w)).collect();
        let short: Vec<&String> = words.iter().filter(|w| !long(w)).collect();
        let found = if pieces.is_empty() { None } else { Some(pieces.join(" AND ")) };
        self.search_pass(found.as_deref(), &short, limit, &mut seen, &mut out)?;
        Ok(out)
    }

    /// One way of looking: by `pieces` if any, every row otherwise; a row must hold each of `read` too. Rows already in `seen` are not found twice.
    fn search_pass(&self, pieces: Option<&str>, read: &[&String], limit: i64, seen: &mut HashSet<i64>, out: &mut Vec<SearchHit>) -> Result<(), String> {
        let mut args: Vec<&str> = Vec::new();
        let mut sql = String::from("SELECT s.id, s.doc, s.block, s.kind, s.card, s.text FROM ");
        match pieces {
            Some(p) => {
                sql.push_str("search_grams g JOIN search s ON s.id = g.rowid WHERE search_grams MATCH ?1");
                args.push(p);
            }
            None => sql.push_str("search s WHERE 1"),
        }
        for w in read {
            args.push(w);
            sql.push_str(&format!(" AND instr(s.hay, ?{}) > 0", args.len()));
        }
        let want = limit - out.len() as i64 + seen.len() as i64;
        sql.push_str(&format!(" LIMIT {want}"));
        let mut st = self.conn.prepare_cached(&sql).map_err(err)?;
        let mut rows = st.query(rusqlite::params_from_iter(args)).map_err(err)?;
        while let Some(r) = rows.next().map_err(err)? {
            if (out.len() as i64) >= limit {
                break;
            }
            if seen.insert(r.get(0).map_err(err)?) {
                out.push(SearchHit { doc: r.get(1).map_err(err)?, block: r.get(2).map_err(err)?, kind: r.get(3).map_err(err)?, card: r.get(4).map_err(err)?, text: r.get(5).map_err(err)? });
            }
        }
        Ok(())
    }

    /// How far the walk has come. No row at all is a collection from before the index that has not been started on.
    pub fn search_state(&self) -> Result<SearchState, String> {
        let at: Option<String> = self.conn.query_row("SELECT value FROM search_meta WHERE key = ?1", [WALKED], |r| r.get(0)).optional().map_err(err)?;
        Ok(match at.as_deref() {
            Some(WALKED_ALL) => SearchState { done: true, after: None },
            _ => SearchState { done: false, after: at },
        })
    }

    /// The documents after `after` by id, `limit` at most, each with its text (front matter, then the rest): what the walk reads.
    pub fn search_walk(&self, after: Option<&str>, limit: i64) -> Result<Vec<(String, String)>, String> {
        let mut st = self
            .conn
            .prepare("SELECT id, COALESCE(front, '') || COALESCE(text, '') FROM documents WHERE id > ?1 AND kind = 'doc' AND blob IS NULL ORDER BY id LIMIT ?2")
            .map_err(err)?;
        let rows = st.query_map(params![after.unwrap_or(""), limit], |r| Ok((r.get(0)?, r.get(1)?))).map_err(err)?;
        rows.collect::<rusqlite::Result<Vec<_>>>().map_err(err)
    }

    /// The review log's files, and how many lines each holds.
    pub fn review_files(&self) -> Result<Vec<(String, i64)>, String> {
        let mut st = self.conn.prepare("SELECT file, COUNT(*) FROM reviews GROUP BY file ORDER BY file").map_err(err)?;
        let rows = st.query_map([], |r| Ok((r.get(0)?, r.get(1)?))).map_err(err)?;
        rows.collect::<rusqlite::Result<Vec<_>>>().map_err(err)
    }

    /// One file's lines by their instant, then by the line itself: the
    /// same order on every device that holds the same lines (milestone
    /// 61; a grade's line is the latest, so it is still the last). Every
    /// line without a file.
    pub fn reviews(&self, file: Option<&str>) -> Result<Vec<String>, String> {
        let mut st = self
            .conn
            .prepare("SELECT line FROM reviews WHERE ?1 IS NULL OR file = ?1 ORDER BY at, line")
            .map_err(err)?;
        let rows = st.query_map([file], |r| r.get(0)).map_err(err)?;
        rows.collect::<rusqlite::Result<Vec<String>>>().map_err(err)
    }

    /// Add lines to a file of the log, or with `replace` make them all it holds.
    pub fn reviews_put(&mut self, file: &str, rows: &[ReviewRow], replace: bool) -> Result<(), String> {
        let tx = self.conn.transaction().map_err(err)?;
        reviews_tx(&tx, file, rows, if replace { "replace" } else { "add" })?;
        tx.commit().map_err(err)
    }

    /// The pairs said not the same fact.
    pub fn same(&self) -> Result<Vec<String>, String> {
        let mut st = self.conn.prepare("SELECT pair FROM not_same ORDER BY pair").map_err(err)?;
        let rows = st.query_map([], |r| r.get(0)).map_err(err)?;
        rows.collect::<rusqlite::Result<Vec<String>>>().map_err(err)
    }

    pub fn same_put(&mut self, pairs: &[String]) -> Result<(), String> {
        let tx = self.conn.transaction().map_err(err)?;
        same_tx(&tx, pairs)?;
        tx.commit().map_err(err)
    }

    /// The files kept as they came in that are not documents, by their path.
    pub fn originals(&self) -> Result<Vec<(String, Original)>, String> {
        let mut st = self
            .conn
            .prepare("SELECT key, text, stamp FROM originals WHERE key NOT IN (SELECT id FROM documents)")
            .map_err(err)?;
        let rows = st
            .query_map([], |r| Ok((r.get(0)?, Original { text: r.get(1)?, stamp: r.get(2)? })))
            .map_err(err)?;
        rows.collect::<rusqlite::Result<Vec<_>>>().map_err(err)
    }

    pub fn original_put(&self, key: &str, original: Option<&Original>) -> Result<(), String> {
        original_tx(&self.conn, key, original)
    }

    fn blob_path(hash: &str) -> String {
        format!("{BLOBS_DIR}/{}/{hash}", &hash[..2])
    }

    /// Keep `bytes` beside the database under their SHA-256; the same bytes twice are one file.
    pub fn blob_put(&mut self, bytes: &[u8]) -> Result<BlobInfo, String> {
        let hash: String = Sha256::digest(bytes).iter().map(|b| format!("{b:02x}")).collect();
        let rel = Store::blob_path(&hash);
        let abs = self.dir.join(&rel);
        if !abs.is_file() {
            std::fs::create_dir_all(abs.parent().unwrap()).map_err(err)?;
            let tmp = abs.with_extension("tmp");
            let mut f = std::fs::File::create(&tmp).map_err(err)?;
            f.write_all(bytes).map_err(err)?;
            f.sync_all().map_err(err)?;
            std::fs::rename(&tmp, &abs).map_err(err)?;
        }
        let size = bytes.len() as i64;
        // a blob known only by name until now has its bytes from here on
        self.conn
            .execute(
                "INSERT INTO blobs (hash, size, path) VALUES (?1, ?2, ?3) ON CONFLICT(hash) DO UPDATE SET size = excluded.size, path = excluded.path",
                params![hash, size, rel],
            )
            .map_err(err)?;
        Ok(BlobInfo { hash, size })
    }

    pub fn blob_get(&self, hash: &str) -> Result<Vec<u8>, String> {
        let rel: String = self
            .conn
            .query_row("SELECT path FROM blobs WHERE hash = ?1", [hash], |r| r.get(0))
            .optional()
            .map_err(err)?
            .ok_or_else(|| format!("{hash}: no such blob"))?;
        if rel.is_empty() {
            return Err(format!("{hash}: not here"));
        }
        std::fs::read(self.dir.join(rel)).map_err(err)
    }

    /// The bytes of a blob from `begin` up to `end`, for a reader that takes a file a piece at a time.
    pub fn blob_range(&self, hash: &str, begin: u64, end: u64) -> Result<Vec<u8>, String> {
        use std::io::{Read, Seek, SeekFrom};
        let path = self.blob_file(hash)?.ok_or_else(|| format!("{hash}: not here"))?;
        let mut f = std::fs::File::open(path).map_err(err)?;
        let len = f.metadata().map_err(err)?.len();
        let end = end.min(len);
        if begin >= end {
            return Ok(Vec::new());
        }
        f.seek(SeekFrom::Start(begin)).map_err(err)?;
        let mut out = vec![0u8; (end - begin) as usize];
        f.read_exact(&mut out).map_err(err)?;
        Ok(out)
    }

    /// Blobs no row names, dropped with their files. Run when a collection
    /// opens: a delete keeps its blob for the session, so an undo can put
    /// the row back without the bytes.
    fn sweep(&self) -> Result<(), String> {
        let mut st = self
            .conn
            .prepare("SELECT hash, path FROM blobs WHERE hash NOT IN (SELECT blob FROM documents WHERE blob IS NOT NULL)")
            .map_err(err)?;
        let loose: Vec<(String, String)> = st
            .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))
            .map_err(err)?
            .collect::<rusqlite::Result<_>>()
            .map_err(err)?;
        for (hash, rel) in loose {
            if !rel.is_empty() {
                let _ = std::fs::remove_file(self.dir.join(rel));
            }
            self.conn.execute("DELETE FROM blobs WHERE hash = ?1", [hash]).map_err(err)?;
        }
        Ok(())
    }
}

/// Where the review log's files are, as the renderer names them.
const REVIEWS_PATH: &str = ".ilmi/reviews";

fn insert_review(tx: &Connection, r: &ReviewRow) -> Result<(), String> {
    tx.execute(
        "INSERT INTO reviews (file, at, doc, card, key, g, line) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![r.file, r.at, r.doc, r.card, r.key, r.g, r.line],
    )
    .map(|_| ())
    .map_err(err)
}

// ── the collections, and the open ones ──────────────────────────

/// The stores open in this process, by their folder. A window opens its
/// collection once and every command after names it by that folder.
#[derive(Default)]
pub struct Stores(Mutex<HashMap<PathBuf, Store>>);

impl Stores {
    fn with<T>(&self, dir: &Path, f: impl FnOnce(&mut Store) -> Result<T, String>) -> Result<T, String> {
        let mut map = self.0.lock().map_err(err)?;
        if !map.contains_key(dir) {
            map.insert(dir.to_path_buf(), Store::open(dir)?);
        }
        f(map.get_mut(dir).unwrap())
    }

    pub fn create(&self, dir: &Path) -> Result<(), String> {
        let mut map = self.0.lock().map_err(err)?;
        let store = Store::create(dir)?;
        map.insert(dir.to_path_buf(), store);
        Ok(())
    }

    /// Close and delete the collection in `dir`, its blobs with it.
    pub fn delete(&self, dir: &Path) -> Result<(), String> {
        let mut map = self.0.lock().map_err(err)?;
        map.remove(dir);
        if dir.join(DB_FILE).is_file() {
            std::fs::remove_dir_all(dir).map_err(err)?;
        }
        Ok(())
    }

    pub fn rows(&self, dir: &Path) -> Result<Vec<Row>, String> {
        self.with(dir, |s| s.rows())
    }
    pub fn text(&self, dir: &Path, id: &str) -> Result<String, String> {
        self.with(dir, |s| s.text(id))
    }
    pub fn put(&self, dir: &Path, at: &Place, content: Option<&Content>, lift: Option<&Lift>) -> Result<Row, String> {
        self.with(dir, |s| s.put(at, content, lift))
    }
    pub fn version(&self, dir: &Path) -> Result<i64, String> {
        self.with(dir, |s| s.version())
    }
    pub fn set_version(&self, dir: &Path, n: i64) -> Result<(), String> {
        self.with(dir, |s| s.set_version(n))
    }
    pub fn doc(&self, dir: &Path, id: &str) -> Result<DocContent, String> {
        self.with(dir, |s| s.doc(id))
    }
    pub fn places(&self, dir: &Path, set: &[(String, f64)]) -> Result<(), String> {
        self.with(dir, |s| s.places(set))
    }
    pub fn digests(&self, dir: &Path, after: Option<&str>, limit: i64) -> Result<String, String> {
        self.with(dir, |s| s.digests(after, limit))
    }
    pub fn search(&self, dir: &Path, phrase: &str, words: &[String], limit: i64) -> Result<Vec<SearchHit>, String> {
        self.with(dir, |s| s.search(phrase, words, limit))
    }
    pub fn search_state(&self, dir: &Path) -> Result<SearchState, String> {
        self.with(dir, |s| s.search_state())
    }
    pub fn search_walk(&self, dir: &Path, after: Option<&str>, limit: i64) -> Result<Vec<(String, String)>, String> {
        self.with(dir, |s| s.search_walk(after, limit))
    }
    pub fn review_files(&self, dir: &Path) -> Result<Vec<(String, i64)>, String> {
        self.with(dir, |s| s.review_files())
    }
    pub fn reviews(&self, dir: &Path, file: Option<&str>) -> Result<Vec<String>, String> {
        self.with(dir, |s| s.reviews(file))
    }
    pub fn reviews_put(&self, dir: &Path, file: &str, rows: &[ReviewRow], replace: bool) -> Result<(), String> {
        self.with(dir, |s| s.reviews_put(file, rows, replace))
    }
    pub fn same(&self, dir: &Path) -> Result<Vec<String>, String> {
        self.with(dir, |s| s.same())
    }
    pub fn same_put(&self, dir: &Path, pairs: &[String]) -> Result<(), String> {
        self.with(dir, |s| s.same_put(pairs))
    }
    pub fn originals(&self, dir: &Path) -> Result<Vec<(String, Original)>, String> {
        self.with(dir, |s| s.originals())
    }
    pub fn original_put(&self, dir: &Path, key: &str, original: Option<&Original>) -> Result<(), String> {
        self.with(dir, |s| s.original_put(key, original))
    }
    pub fn remove(&self, dir: &Path, ids: &[String]) -> Result<(), String> {
        self.with(dir, |s| s.remove(ids))
    }
    pub fn blob_put(&self, dir: &Path, bytes: &[u8]) -> Result<BlobInfo, String> {
        self.with(dir, |s| s.blob_put(bytes))
    }
    pub fn batch(&self, dir: &Path, ops: &[Op]) -> Result<Vec<Row>, String> {
        self.with(dir, |s| s.batch(ops))
    }
    pub fn meta(&self, dir: &Path) -> Result<Vec<(String, String)>, String> {
        self.with(dir, |s| s.meta())
    }
    pub fn regs(&self, dir: &Path, keys: &[String]) -> Result<Vec<Reg>, String> {
        self.with(dir, |s| s.regs(keys))
    }
    pub fn regs_under(&self, dir: &Path, prefixes: &[String]) -> Result<Vec<Reg>, String> {
        self.with(dir, |s| s.regs_under(prefixes))
    }
    pub fn crdt(&self, dir: &Path, doc: &str) -> Result<Option<String>, String> {
        self.with(dir, |s| s.crdt(doc))
    }
    pub fn outbox(&self, dir: &Path, after: i64, bytes: i64) -> Result<Vec<(i64, String)>, String> {
        self.with(dir, |s| s.outbox(after, bytes))
    }
    pub fn outbox_count(&self, dir: &Path) -> Result<i64, String> {
        self.with(dir, |s| s.outbox_count())
    }
    pub fn blob_has(&self, dir: &Path, hash: &str) -> Result<bool, String> {
        self.with(dir, |s| s.blob_has(hash))
    }
    pub fn blob_get(&self, dir: &Path, hash: &str) -> Result<Vec<u8>, String> {
        self.with(dir, |s| s.blob_get(hash))
    }
    pub fn regs_page(&self, dir: &Path, after: Option<&str>, limit: i64) -> Result<Vec<Reg>, String> {
        self.with(dir, |s| s.regs_page(after, limit))
    }
    pub fn blobs_away(&self, dir: &Path) -> Result<Vec<(String, i64)>, String> {
        self.with(dir, |s| s.blobs_away())
    }
    pub fn ink(&self, dir: &Path, page: &str) -> Result<Vec<InkStroke>, String> {
        self.with(dir, |s| s.ink(page))
    }
    pub fn ink_file(&self, dir: &Path, page: &str, what: &str) -> Result<Vec<u8>, String> {
        self.with(dir, |s| s.ink_file(page, what))
    }
    pub fn ink_pages(&self, dir: &Path, prefix: &str) -> Result<Vec<String>, String> {
        self.with(dir, |s| s.ink_pages(prefix))
    }
    pub fn ink_page(&self, dir: &Path, page: &str, what: &str, w: f64, h: f64) -> Result<Vec<u8>, String> {
        self.with(dir, |s| s.ink_page(page, what, w, h))
    }
    pub fn blob_file(&self, dir: &Path, hash: &str) -> Result<Option<PathBuf>, String> {
        self.with(dir, |s| s.blob_file(hash))
    }
    pub fn blob_tmp(&self, dir: &Path) -> Result<PathBuf, String> {
        self.with(dir, |s| s.blob_tmp())
    }
    pub fn blob_land(&self, dir: &Path, hash: &str, tmp: &Path, size: i64) -> Result<BlobInfo, String> {
        self.with(dir, |s| s.blob_land(hash, tmp, size))
    }
    pub fn blob_range(&self, dir: &Path, hash: &str, begin: u64, end: u64) -> Result<Vec<u8>, String> {
        self.with(dir, |s| s.blob_range(hash, begin, end))
    }

    /// A file on disk taken in as a blob: copied beside the database and
    /// named by its hash, a megabyte at a time, the lock held only to
    /// name it. The renderer never holds its bytes.
    pub fn take(&self, dir: &Path, src: &Path) -> Result<BlobInfo, String> {
        let tmp = self.blob_tmp(dir)?;
        let (hash, size) = copy_hashing(src, &tmp, |_| {}).inspect_err(|_| {
            let _ = std::fs::remove_file(&tmp);
        })?;
        self.blob_land(dir, &hash, &tmp, size as i64)
    }
}

/// A name a collection's folder can have: no separators, not hidden, not empty.
pub fn clean_name(name: &str) -> Option<&str> {
    let s = name.trim();
    if s.is_empty() || s.starts_with('.') || s.contains(['/', '\\', ':']) || s.chars().any(char::is_control) {
        return None;
    }
    Some(s)
}

/// The collections under `home`, by name: every folder there holding a database.
pub fn list(home: &Path) -> Result<Vec<String>, String> {
    std::fs::create_dir_all(home).map_err(err)?;
    let mut out: Vec<String> = std::fs::read_dir(home)
        .map_err(err)?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().join(DB_FILE).is_file())
        .filter_map(|e| e.file_name().into_string().ok())
        .collect();
    out.sort();
    Ok(out)
}

/// The folder of the collection `root` names, which must sit directly under `home`.
pub fn dir_in(home: &Path, root: &str) -> Result<PathBuf, String> {
    let path = Path::new(root);
    let name = path.file_name().and_then(|n| n.to_str()).and_then(clean_name);
    match (path.parent(), name) {
        (Some(parent), Some(name)) if parent == home => Ok(home.join(name)),
        _ => Err(format!("{root}: not a collection")),
    }
}

/// Every file under `dir` as one zip at `dest`, under a folder `top`, in name order.
pub fn zip_dir(dir: &Path, top: &str, dest: &Path) -> Result<usize, String> {
    fn visit(dir: &Path, rel: &str, out: &mut Vec<(String, PathBuf, bool)>) -> Result<(), String> {
        let mut entries: Vec<_> = std::fs::read_dir(dir).map_err(err)?.filter_map(|e| e.ok()).collect();
        entries.sort_by_key(|e| e.file_name());
        for e in entries {
            let name = e.file_name().to_string_lossy().into_owned();
            let path = format!("{rel}/{name}");
            if e.file_type().map_err(err)?.is_dir() {
                out.push((format!("{path}/"), e.path(), true));
                visit(&e.path(), &path, out)?;
            } else {
                out.push((path, e.path(), false));
            }
        }
        Ok(())
    }
    let mut entries = Vec::new();
    visit(dir, top, &mut entries)?;
    let file = std::fs::File::create(dest).map_err(err)?;
    let mut zip = zip::ZipWriter::new(file);
    let opts = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
    let mut files = 0;
    for (name, path, is_dir) in &entries {
        if *is_dir {
            zip.add_directory(name.as_str(), opts).map_err(err)?;
        } else {
            zip.start_file(name.as_str(), opts).map_err(err)?;
            zip.write_all(&std::fs::read(path).map_err(err)?).map_err(err)?;
            files += 1;
        }
    }
    zip.finish().map_err(err)?;
    Ok(files)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("ilmi-store-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn place(id: &str, parent: Option<&str>, name: &str, kind: &str) -> Place {
        Place { id: id.into(), parent: parent.map(Into::into), name: name.into(), place: None, kind: kind.into() }
    }

    fn text(front: &str, text: &str) -> Content {
        Content { front: Some(front.into()), text: Some(text.into()), blob: None }
    }

    #[test]
    fn a_document_is_its_front_matter_and_its_text() {
        let dir = scratch("doc");
        let mut s = Store::memory(&dir);
        let row = s.put(&place("a", None, "maxwell", "doc"), Some(&text("---\ntype: source\n---\n", "\nلا إله\n")), None).unwrap();
        assert_eq!(row.kind, "doc");
        assert_eq!(row.size, "---\ntype: source\n---\n\nلا إله\n".len() as i64);
        assert_eq!(s.text("a").unwrap(), "---\ntype: source\n---\n\nلا إله\n");
        assert!(s.text("nope").is_err());
        assert!(s.put(&place("x", None, "x", "page"), None, None).is_err());
    }

    #[test]
    fn a_move_keeps_the_text_and_the_rev_and_a_write_moves_it() {
        let dir = scratch("move");
        let mut s = Store::memory(&dir);
        s.put(&place("f", None, "papers", "folder"), None, None).unwrap();
        let a = s.put(&place("a", None, "maxwell", "doc"), Some(&text("", "one\n")), None).unwrap();
        let moved = s.put(&place("a", Some("f"), "equations", "doc"), None, None).unwrap();
        assert_eq!((moved.parent.as_deref(), moved.name.as_str(), moved.rev), (Some("f"), "equations", a.rev));
        assert_eq!(s.text("a").unwrap(), "one\n");
        let written = s.put(&place("a", Some("f"), "equations", "doc"), Some(&text("", "two\n")), None).unwrap();
        assert!(written.rev > a.rev);
        assert_eq!(s.text("a").unwrap(), "two\n");
        // content given as nothing: the row holds nothing (a document that became a folder)
        let emptied = s.put(&place("a", Some("f"), "equations", "folder"), Some(&Content::default()), None).unwrap();
        assert_eq!((emptied.kind.as_str(), emptied.size), ("folder", 0));
        assert_eq!(s.text("a").unwrap(), "");
    }

    #[test]
    fn what_is_under_a_deleted_row_goes_with_it() {
        let dir = scratch("remove");
        let mut s = Store::memory(&dir);
        s.put(&place("f", None, "papers", "folder"), None, None).unwrap();
        s.put(&place("a", Some("f"), "a", "doc"), Some(&text("", "a\n")), None).unwrap();
        s.put(&place("b", Some("a"), "b", "doc"), Some(&text("", "b\n")), None).unwrap();
        s.put(&place("c", None, "c", "doc"), Some(&text("", "c\n")), None).unwrap();
        s.remove(&["f".to_string()]).unwrap();
        let ids: Vec<String> = s.rows().unwrap().into_iter().map(|r| r.id).collect();
        assert_eq!(ids, vec!["c".to_string()]);
    }

    #[test]
    fn a_blob_is_a_file_named_by_its_hash_and_a_row_names_it() {
        let dir = scratch("blob");
        let mut s = Store::memory(&dir);
        let info = s.blob_put(b"%PDF-1.7 pages").unwrap();
        // sha256 of the bytes, in hex
        assert_eq!(info.hash.len(), 64);
        assert_eq!(info.size, 14);
        assert_eq!(s.blob_put(b"%PDF-1.7 pages").unwrap(), info);
        assert!(dir.join(format!("blobs/{}/{}", &info.hash[..2], info.hash)).is_file());
        assert_eq!(s.blob_get(&info.hash).unwrap(), b"%PDF-1.7 pages");
        let row = s
            .put(&place("p", None, "book.pdf", "file"), Some(&Content { blob: Some(info.hash.clone()), ..Default::default() }), None)
            .unwrap();
        assert_eq!((row.blob.as_deref(), row.size), (Some(info.hash.as_str()), 14));
        assert!(s.put(&place("q", None, "q.pdf", "file"), Some(&Content { blob: Some("00".into()), ..Default::default() }), None).is_err());
        // a blob no row names goes on the sweep; one a row names stays
        let loose = s.blob_put(b"loose").unwrap();
        s.sweep().unwrap();
        assert!(s.blob_get(&loose.hash).is_err());
        assert!(!dir.join(format!("blobs/{}/{}", &loose.hash[..2], loose.hash)).exists());
        assert_eq!(s.blob_get(&info.hash).unwrap(), b"%PDF-1.7 pages");
    }

    #[test]
    fn a_collection_is_a_file_that_opens_again() {
        let home = scratch("home");
        let dir = home.join("double-major");
        {
            let mut s = Store::create(&dir).unwrap();
            s.put(&place("a", None, "a", "doc"), Some(&text("", "kept\n")), None).unwrap();
        }
        assert!(Store::create(&dir).is_err());
        let mut s = Store::open(&dir).unwrap();
        assert_eq!(s.text("a").unwrap(), "kept\n");
        // the clock goes on from where it was
        let first = s.rows().unwrap()[0].rev;
        assert!(s.put(&place("b", None, "b", "doc"), Some(&text("", "b\n")), None).unwrap().rev > first);
        assert!(Store::open(&home.join("nothing")).is_err());
        assert_eq!(list(&home).unwrap(), vec!["double-major".to_string()]);
        assert_eq!(dir_in(&home, dir.to_str().unwrap()).unwrap(), dir);
        assert!(dir_in(&home, "/elsewhere/double-major").is_err());
        assert!(dir_in(&home, home.join(".hidden").to_str().unwrap()).is_err());
        let stores = Stores::default();
        assert_eq!(stores.rows(&dir).unwrap().len(), 2);
        stores.delete(&dir).unwrap();
        assert!(!dir.exists());
        assert!(list(&home).unwrap().is_empty());
    }

    fn sched(kind: &str, item: &str, key: &str, attrs: &str) -> Sched {
        Sched { kind: kind.into(), item: item.into(), key: key.into(), attrs: attrs.into() }
    }

    fn review(file: &str, at: &str, card: &str) -> ReviewRow {
        ReviewRow { file: file.into(), at: at.into(), doc: "deck.md".into(), card: card.into(), key: None, g: 3, line: format!("{{\"at\":\"{at}\",\"card\":\"{card}\"}}") }
    }

    #[test]
    fn a_document_is_written_with_its_schedules_its_digest_and_a_grade_s_line() {
        let dir = scratch("lift");
        let mut s = Store::memory(&dir);
        let lift = Lift {
            search: None,
            state: vec![
                sched("card", "ca", "", r#"{"due":"2026-11-07","last":"2026-11-01T08:00:00Z","stability":4.5}"#),
                sched("read", "", "", r#"{"due":"2026-11-06","ivl":2}"#),
            ],
            digest: r#"{"blocks":[{"kind":"card","text":"a :: b","id":"ca"}]}"#.into(),
            original: Some(Original { text: "a :: b ^ca\r\n".into(), stamp: "x".into() }),
            size: 99,
            reviews: vec![],
        };
        let a = s.put(&place("a", None, "deck", "doc"), Some(&text("---\nread:\n---\n", "\na :: b ^ca\n")), Some(&lift)).unwrap();
        assert_eq!(a.size, 99);
        let got = s.doc("a").unwrap();
        assert_eq!((got.front.as_str(), got.text.as_str()), ("---\nread:\n---\n", "\na :: b ^ca\n"));
        assert_eq!(got.state.len(), 2);
        assert_eq!(got.original.as_ref().map(|o| o.stamp.as_str()), Some("x"));
        let due: Option<String> = s.conn.query_row("SELECT due FROM schedules WHERE doc = 'a' AND kind = 'card'", [], |r| r.get(0)).unwrap();
        assert_eq!(due.as_deref(), Some("2026-11-07"));
        assert_eq!(s.digests(None, 10).unwrap(), r#"[["a",{"blocks":[{"kind":"card","text":"a :: b","id":"ca"}]}]]"#);
        assert_eq!(s.digests(Some("a"), 10).unwrap(), "[]");

        // a grade: the same text, another schedule, a line in the log, one transaction; the text is not written again
        let changes = |s: &Store| -> i64 { s.conn.query_row("SELECT total_changes()", [], |r| r.get(0)).unwrap() };
        let graded = Lift {
            search: None,
            state: vec![sched("card", "ca", "", r#"{"due":"2026-11-20","last":"2026-11-05T09:00:00Z"}"#)],
            digest: "{}".into(),
            original: None,
            size: 60,
            reviews: vec![review("2026-11.jsonl", "2026-11-05T09:00:00Z", "ca")],
        };
        s.original_put(".ilmi/reviews/2026-11.jsonl", Some(&Original { text: "as it came in".into(), stamp: "y".into() })).unwrap();
        let before = changes(&s);
        let b = s.put(&place("a", None, "deck", "doc"), Some(&text("---\nread:\n---\n", "\na :: b ^ca\n")), Some(&graded)).unwrap();
        assert!(b.rev > a.rev);
        // the place, the stamp, two schedules and a digest and an original dropped, one schedule, a digest and a line added: not the text
        assert_eq!(changes(&s) - before, 2 + 2 + 1 + 1 + 1 + 1 + 1 + 1);
        let got = s.doc("a").unwrap();
        assert_eq!(got.state, vec![sched("card", "ca", "", r#"{"due":"2026-11-20","last":"2026-11-05T09:00:00Z"}"#)]);
        assert_eq!(got.original, None);
        assert_eq!(s.review_files().unwrap(), vec![("2026-11.jsonl".to_string(), 1)]);
        assert!(s.originals().unwrap().is_empty());

        // content without a lift (the document became a folder, or a file) holds no state
        s.put(&place("a", None, "deck", "folder"), Some(&Content::default()), None).unwrap();
        assert!(s.doc("a").unwrap().state.is_empty());
        assert_eq!(s.digests(None, 10).unwrap(), "[]");
    }

    #[test]
    fn the_log_the_order_and_the_pairs_are_tables() {
        let dir = scratch("tables");
        let mut s = Store::memory(&dir);
        s.reviews_put("2026-10.jsonl", &[review("x", "2026-10-01T08:00:00Z", "a"), review("x", "2026-10-02T08:00:00Z", "b")], false).unwrap();
        s.reviews_put("2026-11.jsonl", &[review("x", "2026-11-01T08:00:00Z", "a")], false).unwrap();
        s.reviews_put("2026-10.jsonl", &[review("x", "2026-10-03T08:00:00Z", "c")], false).unwrap();
        assert_eq!(s.review_files().unwrap(), vec![("2026-10.jsonl".to_string(), 3), ("2026-11.jsonl".to_string(), 1)]);
        let lines = s.reviews(Some("2026-10.jsonl")).unwrap();
        assert_eq!(lines.len(), 3);
        assert!(lines[2].contains("\"c\""));
        assert_eq!(s.reviews(None).unwrap().len(), 4);
        s.reviews_put("2026-10.jsonl", &[review("x", "2026-10-09T08:00:00Z", "z")], true).unwrap();
        assert_eq!(s.reviews(Some("2026-10.jsonl")).unwrap().len(), 1);

        s.put(&place("f", None, "papers", "folder"), None, None).unwrap();
        s.put(&place("a", Some("f"), "a", "doc"), Some(&text("", "a\n")), None).unwrap();
        s.put(&place("b", Some("f"), "b", "doc"), Some(&text("", "b\n")), None).unwrap();
        s.places(&[("b".to_string(), 0.0), ("a".to_string(), 1.0)]).unwrap();
        let at = |s: &Store, id: &str| s.rows().unwrap().into_iter().find(|r| r.id == id).unwrap().place;
        assert_eq!((at(&s, "a"), at(&s, "b"), at(&s, "f")), (Some(1.0), Some(0.0), None));
        s.places(&[("a".to_string(), 0.0)]).unwrap();
        assert_eq!((at(&s, "a"), at(&s, "b")), (Some(0.0), None));

        s.same_put(&["b|c".to_string(), "a|b".to_string(), "a|b".to_string()]).unwrap();
        assert_eq!(s.same().unwrap(), vec!["a|b".to_string(), "b|c".to_string()]);
        s.same_put(&[]).unwrap();
        assert!(s.same().unwrap().is_empty());

        // a file kept as it came in is found by its path; a document's goes with its row, and with what its row is under
        s.original_put(".ilmi/order.json", Some(&Original { text: "{}".into(), stamp: "s".into() })).unwrap();
        let lift = Lift { state: vec![], digest: "{}".into(), search: None, original: Some(Original { text: "b\r\n".into(), stamp: "t".into() }), size: 3, reviews: vec![] };
        s.put(&place("b", Some("f"), "b", "doc"), Some(&text("", "b\n")), Some(&lift)).unwrap();
        assert_eq!(s.originals().unwrap().len(), 1);
        s.remove(&["f".to_string()]).unwrap();
        let left: i64 = s.conn.query_row("SELECT COUNT(*) FROM originals", [], |r| r.get(0)).unwrap();
        assert_eq!(left, 1);
        s.original_put(".ilmi/order.json", None).unwrap();
        assert!(s.originals().unwrap().is_empty());
    }

    #[test]
    fn a_collection_made_before_the_tables_keeps_its_number_until_it_is_brought_up() {
        let home = scratch("version");
        let dir = home.join("old");
        std::fs::create_dir_all(&dir).unwrap();
        {
            // as milestone 59 made it: two tables, version 1
            let conn = Connection::open(dir.join(DB_FILE)).unwrap();
            conn.execute_batch(
                "CREATE TABLE blobs (hash TEXT PRIMARY KEY, size INTEGER NOT NULL, path TEXT NOT NULL);
                 CREATE TABLE documents (id TEXT PRIMARY KEY, parent TEXT REFERENCES documents(id) ON DELETE CASCADE, name TEXT NOT NULL, place REAL,
                   kind TEXT NOT NULL CHECK (kind IN ('folder', 'doc', 'file')), front TEXT, text TEXT, blob TEXT REFERENCES blobs(hash),
                   size INTEGER NOT NULL DEFAULT 0, rev INTEGER NOT NULL DEFAULT 0);
                 INSERT INTO documents (id, name, kind, text, size, rev) VALUES ('a', 'a', 'doc', 'q :: a\n<!-- sr due=2026-11-07 -->\n', 34, 1);
                 PRAGMA user_version = 1;",
            )
            .unwrap();
        }
        let s = Store::open(&dir).unwrap();
        // the engine's tables are made when it opens, whatever its number
        assert!(s.meta().unwrap().is_empty());
        assert_eq!(s.version().unwrap(), 1);
        assert_eq!(s.text("a").unwrap(), "q :: a\n<!-- sr due=2026-11-07 -->\n");
        assert!(s.doc("a").unwrap().state.is_empty());
        s.set_version(VERSION).unwrap();
        drop(s);
        assert_eq!(Store::open(&dir).unwrap().version().unwrap(), VERSION);
        // a new one is the present schema from the start
        assert_eq!(Store::create(&home.join("new")).unwrap().version().unwrap(), VERSION);
    }

    #[test]
    fn a_batch_is_one_transaction_and_keeps_the_engine_s_record_with_the_rows() {
        let dir = scratch("batch");
        let mut s = Store::memory(&dir);
        let reg = |key: &str, stamp: &str, value: Option<&str>| Reg { key: key.into(), stamp: stamp.into(), value: value.map(Into::into) };
        let rows = s
            .batch(&[
                Op::Put { at: place("f", None, "papers", "folder"), content: None, lift: None },
                Op::Put { at: place("a", Some("f"), "maxwell", "doc"), content: Some(text("", "one\n")), lift: None },
                Op::Regs { set: vec![reg("a|n", "0001", Some("maxwell")), reg("a|p", "0001", Some("f")), reg("b|n", "0002", Some("other")), reg("a}", "0003", None)] },
                Op::Crdt { doc: "a".into(), state: Some(base64::engine::general_purpose::STANDARD.encode([0u8, 1, 2, 255])) },
                Op::Out { seq: 1, data: "[1]".into() },
                Op::Out { seq: 2, data: "[2,2]".into() },
                Op::Meta { key: "device".into(), value: Some("d1".into()) },
                Op::Reviews { file: "2026-11.jsonl".into(), rows: vec![review("x", "2026-11-01T08:00:00Z", "a")], mode: "add".into() },
            ])
            .unwrap();
        assert_eq!(rows.iter().map(|r| r.id.as_str()).collect::<Vec<_>>(), vec!["f", "a"]);
        assert!(rows[1].rev > rows[0].rev);
        assert_eq!(s.text("a").unwrap(), "one\n");
        // the registers of a row are found by its prefix, and no other row's with them
        let under: Vec<String> = s.regs_under(&["a|".to_string()]).unwrap().into_iter().map(|r| r.key).collect();
        assert_eq!(under, vec!["a|n".to_string(), "a|p".to_string()]);
        assert_eq!(s.regs(&["b|n".to_string(), "nope".to_string(), "a}".to_string()]).unwrap(), vec![reg("b|n", "0002", Some("other")), reg("a}", "0003", None)]);
        assert_eq!(base64::engine::general_purpose::STANDARD.decode(s.crdt("a").unwrap().unwrap()).unwrap(), vec![0u8, 1, 2, 255]);
        assert_eq!(s.crdt("f").unwrap(), None);
        assert_eq!(s.meta().unwrap(), vec![("device".to_string(), "d1".to_string())]);
        // the outbox by size: one change at least, then as many as fit
        assert_eq!(s.outbox(0, 1).unwrap(), vec![(1, "[1]".to_string())]);
        assert_eq!(s.outbox(0, 100).unwrap().len(), 2);
        assert_eq!(s.outbox(1, 100).unwrap(), vec![(2, "[2,2]".to_string())]);
        assert_eq!(s.outbox_count().unwrap(), 2);

        // one write that fails takes the whole batch with it
        let failed = s.batch(&[
            Op::Put { at: place("b", None, "b", "doc"), content: Some(text("", "b\n")), lift: None },
            Op::Meta { key: "device".into(), value: None },
            Op::Put { at: place("c", Some("nowhere"), "c", "doc"), content: None, lift: None },
        ]);
        assert!(failed.is_err());
        assert!(s.text("b").is_err());
        assert_eq!(s.meta().unwrap().len(), 1);

        // a line the log holds is not added again by a union; one it does not hold is, and the file's original goes
        s.original_put(".ilmi/reviews/2026-11.jsonl", Some(&Original { text: "as it came in".into(), stamp: "y".into() })).unwrap();
        s.batch(&[
            Op::Reviews { file: "2026-11.jsonl".into(), rows: vec![review("x", "2026-11-01T08:00:00Z", "a"), review("x", "2026-11-02T08:00:00Z", "b")], mode: "union".into() },
            Op::OutDrop { up_to: 1 },
            Op::Remove { ids: vec!["f".to_string()] },
            Op::Crdt { doc: "zz".into(), state: None },
        ])
        .unwrap();
        assert_eq!(s.reviews(Some("2026-11.jsonl")).unwrap().len(), 2);
        assert!(s.originals().unwrap().is_empty());
        assert_eq!(s.outbox_count().unwrap(), 1);
        assert!(s.rows().unwrap().is_empty());
        // what the engine keeps of a row outlives it: an edit made elsewhere can bring the row back
        assert!(s.crdt("a").unwrap().is_some());
        assert_eq!(s.regs_under(&["a|".to_string()]).unwrap().len(), 2);
        assert!(!s.blob_has("00").unwrap());
        let info = s.blob_put(b"bytes").unwrap();
        assert!(s.blob_has(&info.hash).unwrap());
    }

    #[test]
    fn a_blob_is_named_before_its_bytes_are_here_and_taken_in_as_a_file() {
        let home = scratch("away");
        let dir = home.join("c");
        let stores = Stores::default();
        stores.create(&dir).unwrap();
        let bytes: Vec<u8> = (0..3_000_000u32).map(|i| (i % 251) as u8).collect();
        let hash: String = Sha256::digest(&bytes).iter().map(|b| format!("{b:02x}")).collect();
        // named by a row, by hash and size, with no bytes
        stores
            .batch(&dir, &[
                Op::Expect { hash: hash.clone(), size: bytes.len() as i64 },
                Op::Put { at: place("p", None, "book.pdf", "file"), content: Some(Content { blob: Some(hash.clone()), ..Default::default() }), lift: None },
            ])
            .unwrap();
        let row = &stores.rows(&dir).unwrap()[0];
        assert_eq!((row.blob.as_deref(), row.size), (Some(hash.as_str()), 3_000_000));
        assert!(!stores.blob_has(&dir, &hash).unwrap());
        assert_eq!(stores.blobs_away(&dir).unwrap(), vec![(hash.clone(), 3_000_000)]);
        assert!(stores.blob_get(&dir, &hash).unwrap_err().ends_with("not here"));
        assert!(stores.blob_file(&dir, &hash).unwrap().is_none());
        assert!(stores.batch(&dir, &[Op::Expect { hash: "../x".into(), size: 1 }]).is_err());
        // a sweep leaves the collection's own folder alone
        stores.with(&dir, |s| s.sweep()).unwrap();
        assert!(dir.join(DB_FILE).is_file());
        // its bytes arrive as a file
        let src = home.join("book.pdf");
        std::fs::write(&src, &bytes).unwrap();
        let rev = row.rev;
        assert_eq!(stores.take(&dir, &src).unwrap(), BlobInfo { hash: hash.clone(), size: 3_000_000 });
        assert!(stores.blob_has(&dir, &hash).unwrap());
        assert!(stores.blobs_away(&dir).unwrap().is_empty());
        assert_eq!(stores.rows(&dir).unwrap()[0].rev, rev);
        assert_eq!(stores.blob_range(&dir, &hash, 1_000_000, 1_000_004).unwrap(), bytes[1_000_000..1_000_004]);
        assert_eq!(stores.blob_range(&dir, &hash, 2_999_998, 9_999_999).unwrap(), bytes[2_999_998..]);
        assert!(stores.blob_range(&dir, &hash, 5_000_000, 5_000_001).unwrap().is_empty());
        // nothing is left of the way in but the blob itself
        let left: Vec<String> = std::fs::read_dir(dir.join("blobs")).unwrap().map(|e| e.unwrap().file_name().to_string_lossy().into_owned()).collect();
        assert_eq!(left, vec![hash[..2].to_string()]);
        // an expected size of nothing is corrected by the first that knows it; bytes put the old way fill a name too
        let small: String = Sha256::digest(b"small").iter().map(|b| format!("{b:02x}")).collect();
        stores.batch(&dir, &[Op::Expect { hash: small.clone(), size: 0 }, Op::Expect { hash: small.clone(), size: 5 }]).unwrap();
        let sized: i64 = stores.with(&dir, |s| s.conn.query_row("SELECT size FROM blobs WHERE hash = ?1", [&small], |r| r.get(0)).map_err(err)).unwrap();
        assert_eq!(sized, 5);
        assert!(!stores.blob_has(&dir, &small).unwrap());
        assert_eq!(stores.blob_put(&dir, b"small").unwrap().hash, small);
        assert!(stores.blob_has(&dir, &small).unwrap());
        // the registers a page at a time
        stores.batch(&dir, &[Op::Regs { set: (0..5).map(|i| Reg { key: format!("r{i}|n"), stamp: "1".into(), value: None }).collect() }]).unwrap();
        let page = stores.regs_page(&dir, None, 2).unwrap();
        assert_eq!(page.iter().map(|r| r.key.as_str()).collect::<Vec<_>>(), vec!["r0|n", "r1|n"]);
        assert_eq!(stores.regs_page(&dir, Some("r1|n"), 10).unwrap().len(), 3);
    }

    #[test]
    fn a_page_of_ink_is_its_strokes_and_what_is_read_is_made_from_them() {
        use base64::Engine as _;
        let b64 = base64::engine::general_purpose::STANDARD;
        let dir = scratch("ink");
        let mut s = Store::create(&dir).unwrap();
        let strokes: Vec<InkStroke> = tauri_plugin_ink::split(&tauri_plugin_ink::sample(2, 6, 5).unwrap())
            .unwrap()
            .into_iter()
            .map(|x| InkStroke { stroke: x.key, at: x.at, data: b64.encode(x.data) })
            .collect();
        let page = place("p", None, "ink-01.pkdrawing", "file");
        let empty = Content { text: Some(String::new()), ..Default::default() };
        // the row and its strokes in one transaction; the row comes back as the strokes left it
        let rows = s
            .batch(&[Op::Put { at: page.clone(), content: Some(empty), lift: None }, Op::Ink { page: "p".into(), add: strokes[..8].to_vec(), remove: vec![] }])
            .unwrap();
        let row = rows.last().unwrap();
        assert!(row.blob.is_none() && row.size > 0);
        assert_eq!(s.ink("p").unwrap(), strokes[..8].to_vec(), "in the order they were drawn");
        // read as a file: the drawing PencilKit opens, holding those strokes, and the same bytes on a second read
        let drawing = s.ink_file("p", "drawing").unwrap();
        let names = |d: &[u8]| tauri_plugin_ink::split(d).unwrap().into_iter().map(|x| x.key).collect::<Vec<_>>();
        assert_eq!(names(&drawing), strokes[..8].iter().map(|x| x.stroke.clone()).collect::<Vec<_>>());
        assert_eq!(s.ink_file("p", "drawing").unwrap(), drawing);
        let picture = s.ink_file("p", "picture").unwrap();
        assert_eq!(&picture[..4], b"\x89PNG");
        // four more and one taken away: the `rev` moves, and what is read is made again
        let rows = s.batch(&[Op::Ink { page: "p".into(), add: strokes[8..].to_vec(), remove: vec![strokes[0].stroke.clone()] }]).unwrap();
        assert!(rows[0].rev > row.rev);
        assert_eq!(names(&s.ink_file("p", "drawing").unwrap()), strokes[1..].iter().map(|x| x.stroke.clone()).collect::<Vec<_>>());
        assert_ne!(s.ink_file("p", "picture").unwrap(), picture);
        assert_eq!(std::fs::read_dir(dir.join(INK_DIR)).unwrap().count(), 2, "the ones made before are not kept");
        // a move is not a change to it; the strokes go with the row
        s.put(&place("f", None, "notes", "folder"), None, None).unwrap();
        let moved = s.put(&place("p", Some("f"), "ink-01.pkdrawing", "file"), None, None).unwrap();
        assert_eq!(moved.rev, rows[0].rev);
        s.remove(&["f".to_string()]).unwrap();
        assert!(s.ink("p").unwrap().is_empty());
        assert!(s.ink_file("p", "picture").unwrap().is_empty());
        // a collection made before there was ink (schema 3) gets the table as it opens, and keeps its number until it is brought up
        let old = scratch("ink-old");
        {
            let conn = Connection::open(old.join(DB_FILE)).unwrap();
            conn.execute_batch(SCHEMA).unwrap();
            conn.execute_batch("DROP TRIGGER documents_gone_ink; DROP TABLE ink; PRAGMA user_version = 3;").unwrap();
        }
        let mut was = Store::open(&old).unwrap();
        assert_eq!(was.version().unwrap(), 3);
        was.batch(&[Op::Put { at: page, content: Some(Content { text: Some(String::new()), ..Default::default() }), lift: None }, Op::Ink { page: "p".into(), add: strokes[..2].to_vec(), remove: vec![] }])
            .unwrap();
        assert_eq!(was.ink("p").unwrap().len(), 2);
    }

    #[test]
    fn a_book_s_page_holds_strokes_under_its_pdf_s_hash_and_no_row_s_delete_takes_them() {
        use base64::Engine as _;
        let b64 = base64::engine::general_purpose::STANDARD;
        let dir = scratch("ink-page");
        let mut s = Store::create(&dir).unwrap();
        let strokes: Vec<InkStroke> = tauri_plugin_ink::split(&tauri_plugin_ink::sample(2, 6, 67).unwrap())
            .unwrap()
            .into_iter()
            .map(|x| InkStroke { stroke: x.key, at: x.at, data: b64.encode(x.data) })
            .collect();
        // the book: a file's row that names a PDF by its hash
        let pdf = s.blob_put(b"%PDF-1.7 a book").unwrap();
        s.put(&place("book", None, "book.pdf", "file"), Some(&Content { blob: Some(pdf.hash.clone()), ..Default::default() }), None).unwrap();
        let (p3, p4) = (format!("p.{}.3", pdf.hash), format!("p.{}.4", pdf.hash));
        // strokes on two of its pages: no row is written, and none comes back
        let rows = s.batch(&[Op::Ink { page: p3.clone(), add: strokes[..5].to_vec(), remove: vec![] }, Op::Ink { page: p4.clone(), add: strokes[5..7].to_vec(), remove: vec![] }]).unwrap();
        assert!(rows.is_empty());
        assert_eq!(s.rows().unwrap().len(), 1, "a page written on is no row");
        assert_eq!(s.ink(&p3).unwrap(), strokes[..5].to_vec());
        assert_eq!(s.ink_pages(&format!("p.{}.", pdf.hash)).unwrap(), vec![p3.clone(), p4.clone()]);
        assert!(s.ink_pages("p.0000.").unwrap().is_empty());
        // read: a drawing for the canvas holding those strokes, and a picture of the whole page whatever they cover
        let names = |d: &[u8]| tauri_plugin_ink::split(d).unwrap().into_iter().map(|x| x.key).collect::<Vec<_>>();
        assert_eq!(names(&s.ink_page(&p3, "drawing", 0.0, 0.0).unwrap()), strokes[..5].iter().map(|x| x.stroke.clone()).collect::<Vec<_>>());
        let picture = s.ink_page(&p3, "picture", 612.0, 792.0).unwrap();
        assert_eq!(&picture[..4], b"\x89PNG");
        assert_eq!((u32::from_be_bytes(picture[16..20].try_into().unwrap()), u32::from_be_bytes(picture[20..24].try_into().unwrap())), (1224, 1584));
        assert!(!dir.join(INK_DIR).exists(), "nothing made from them is kept");
        // one more and one taken away
        s.batch(&[Op::Ink { page: p3.clone(), add: strokes[7..8].to_vec(), remove: vec![strokes[0].stroke.clone()] }]).unwrap();
        assert_eq!(s.ink(&p3).unwrap().len(), 5);
        assert_ne!(s.ink_page(&p3, "picture", 612.0, 792.0).unwrap(), picture);
        // the PDF is as it was: nothing is written into it
        assert_eq!(s.blob_get(&pdf.hash).unwrap(), b"%PDF-1.7 a book");
        // the book's row deleted: the strokes are the file's, by what it is, and stay
        s.remove(&["book".to_string()]).unwrap();
        assert_eq!(s.ink(&p3).unwrap().len(), 5);
        assert_eq!(s.ink(&p4).unwrap().len(), 2);
    }

    #[test]
    fn a_folder_zips_under_its_name() {
        let dir = scratch("zip");
        let src = dir.join("src");
        std::fs::create_dir_all(src.join("papers")).unwrap();
        std::fs::create_dir_all(src.join(".ilmi")).unwrap();
        std::fs::write(src.join("a.md"), "a\n").unwrap();
        std::fs::write(src.join("papers/b.md"), "b\n").unwrap();
        std::fs::write(src.join(".ilmi/state.json"), "{}\n").unwrap();
        let dest = dir.join("out.zip");
        assert_eq!(zip_dir(&src, "my notes", &dest).unwrap(), 3);
        let mut zip = zip::ZipArchive::new(std::fs::File::open(&dest).unwrap()).unwrap();
        let mut names: Vec<String> = (0..zip.len()).map(|i| String::from_utf8_lossy(zip.by_index(i).unwrap().name_raw()).into_owned()).collect();
        names.sort();
        assert_eq!(names, vec!["my notes/.ilmi/", "my notes/.ilmi/state.json", "my notes/a.md", "my notes/papers/", "my notes/papers/b.md"]);
        let mut text = String::new();
        std::io::Read::read_to_string(&mut zip.by_name("my notes/papers/b.md").unwrap(), &mut text).unwrap();
        assert_eq!(text, "b\n");
    }

    fn found(s: &Store, q: &str) -> Vec<(String, i64)> {
        let words: Vec<String> = q.split_whitespace().map(str::to_string).collect();
        s.search(&words.join(" "), &words, 50).unwrap().into_iter().map(|h| (h.doc, h.block)).collect()
    }

    fn hit_row(block: i64, hay: &str) -> SearchRow {
        SearchRow { block, kind: "text".to_string(), card: None, hay: hay.to_string(), text: hay.to_string() }
    }

    fn lifted(rows: Vec<SearchRow>) -> Lift {
        Lift { search: Some(rows), ..Lift::default() }
    }

    fn grams(s: &Store, q: &str) -> i64 {
        s.conn.query_row("SELECT COUNT(*) FROM search_grams WHERE search_grams MATCH ?1", [q], |r| r.get(0)).unwrap()
    }

    #[test]
    fn search_finds_by_pieces_and_by_reading() {
        let dir = scratch("search-find");
        let mut s = Store::memory(&dir);
        s.put(&place("a", None, "a", "doc"), Some(&text("", "x")), Some(&lifted(vec![hit_row(0, "the kingdom of heaven"), hit_row(2, "heaven is a kingdom"), hit_row(3, "بالكرم والجود")]))).unwrap();
        s.put(&place("b", None, "b", "doc"), Some(&text("", "y")), Some(&lifted(vec![hit_row(1, "he said \"so\" 100%")]))).unwrap();
        // a word, inside a word, across a word's end
        assert_eq!(found(&s, "kingdom"), vec![("a".to_string(), 0), ("a".to_string(), 2)]);
        assert_eq!(found(&s, "ngdo"), vec![("a".to_string(), 0), ("a".to_string(), 2)]);
        // three letters of Arabic with its prefix and its joined word
        assert_eq!(found(&s, "كرم"), vec![("a".to_string(), 3)]);
        // the phrase as written first, then every word anywhere
        assert_eq!(found(&s, "kingdom of heaven"), vec![("a".to_string(), 0)]);
        assert_eq!(found(&s, "heaven kingdom"), vec![("a".to_string(), 0), ("a".to_string(), 2)]);
        assert_eq!(found(&s, "a kingdom"), vec![("a".to_string(), 2), ("a".to_string(), 0)]);
        // under three letters: read, not looked up
        assert_eq!(found(&s, "ki"), vec![("a".to_string(), 0), ("a".to_string(), 2)]);
        assert_eq!(found(&s, "كر"), vec![("a".to_string(), 3)]);
        assert_eq!(found(&s, "is he"), vec![("a".to_string(), 2)]);
        // what FTS5's own syntax would take as an operator is only text
        assert_eq!(found(&s, "\"so\""), vec![("b".to_string(), 1)]);
        assert_eq!(found(&s, "100%"), vec![("b".to_string(), 1)]);
        assert_eq!(found(&s, "and OR not"), vec![]);
        assert_eq!(found(&s, "nothing"), vec![]);
        assert_eq!(found(&s, ""), vec![]);
    }

    #[test]
    fn search_follows_the_row() {
        let dir = scratch("search-row");
        let mut s = Store::memory(&dir);
        let at = place("a", None, "a", "doc");
        s.put(&at, Some(&text("", "one")), Some(&lifted(vec![hit_row(0, "first words")]))).unwrap();
        let id: i64 = s.conn.query_row("SELECT id FROM search WHERE doc = 'a'", [], |r| r.get(0)).unwrap();
        // the same text (a grade): nothing is written, whatever rows came
        s.put(&at, Some(&text("", "one")), Some(&lifted(vec![hit_row(0, "not what the text says")]))).unwrap();
        assert_eq!(s.conn.query_row::<i64, _, _>("SELECT id FROM search WHERE doc = 'a'", [], |r| r.get(0)).unwrap(), id);
        assert_eq!(found(&s, "first"), vec![("a".to_string(), 0)]);
        // a rename or a move: the row keeps its id, so the index has nothing to do
        s.put(&place("f", None, "f", "folder"), None, None).unwrap();
        s.put(&place("a", Some("f"), "renamed", "doc"), None, None).unwrap();
        assert_eq!(found(&s, "first"), vec![("a".to_string(), 0)]);
        // other text: the old words are gone from the rows and the pieces
        s.put(&at, Some(&text("", "two")), Some(&lifted(vec![hit_row(1, "second thoughts")]))).unwrap();
        assert_eq!(found(&s, "first"), vec![]);
        assert_eq!(grams(&s, "\"first\""), 0);
        assert_eq!(found(&s, "second"), vec![("a".to_string(), 1)]);
        // text with none for it, a document that became its children's folder
        s.put(&place("a", None, "a", "folder"), Some(&Content::default()), None).unwrap();
        assert_eq!(found(&s, "second"), vec![]);
        // a delete takes them, and those of what is under it
        s.put(&place("k", Some("f"), "k", "doc"), Some(&text("", "three")), Some(&lifted(vec![hit_row(0, "third time")]))).unwrap();
        assert_eq!(found(&s, "third"), vec![("k".to_string(), 0)]);
        s.remove(&["f".to_string()]).unwrap();
        assert_eq!(found(&s, "third"), vec![]);
        assert_eq!(grams(&s, "\"third\""), 0);
        assert_eq!(s.conn.query_row::<i64, _, _>("SELECT COUNT(*) FROM search", [], |r| r.get(0)).unwrap(), 0);
        // the engine's tables hold nothing of it
        let (regs, out): (i64, i64) = s.conn.query_row("SELECT (SELECT COUNT(*) FROM regs), (SELECT COUNT(*) FROM outbox)", [], |r| Ok((r.get(0)?, r.get(1)?))).unwrap();
        assert_eq!((regs, out), (0, 0));
    }

    #[test]
    fn a_collection_from_before_the_index_is_walked() {
        let dir = scratch("search-walk");
        {
            let conn = Connection::open(dir.join(DB_FILE)).unwrap();
            // what 4 was: the same tables but for the index's
            conn.execute_batch(&SCHEMA[..SCHEMA.find("CREATE TABLE IF NOT EXISTS search (").unwrap()]).unwrap();
            conn.pragma_update(None, "user_version", 4).unwrap();
            for id in ["a", "b", "c"] {
                conn.execute("INSERT INTO documents (id, name, kind, front, text) VALUES (?1, ?1, 'doc', '---\n---\n', 'the text of ' || ?1)", [id]).unwrap();
            }
            conn.execute("INSERT INTO documents (id, name, kind) VALUES ('f', 'f', 'folder')", []).unwrap();
        }
        let mut s = Store::open(&dir).unwrap();
        // it opens, tables added, nothing else touched
        assert_eq!(s.version().unwrap(), 4);
        assert_eq!(s.rows().unwrap().len(), 4);
        assert_eq!(s.search_state().unwrap(), SearchState { done: false, after: None });
        assert_eq!(found(&s, "text"), vec![]);
        let first = s.search_walk(None, 2).unwrap();
        assert_eq!(first, vec![("a".to_string(), "---\n---\nthe text of a".to_string()), ("b".to_string(), "---\n---\nthe text of b".to_string())]);
        s.batch(&[Op::Search { doc: "a".to_string(), rows: vec![hit_row(0, "the text of a")] }, Op::Search { doc: "b".to_string(), rows: vec![hit_row(0, "the text of b")] }, Op::SearchWalked { after: Some("b".to_string()) }]).unwrap();
        assert_eq!(s.search_state().unwrap(), SearchState { done: false, after: Some("b".to_string()) });
        drop(s);
        // closed half way: the next open goes on from there
        let mut s = Store::open(&dir).unwrap();
        assert_eq!(s.search_state().unwrap().after.as_deref(), Some("b"));
        assert_eq!(found(&s, "text").len(), 2);
        let rest = s.search_walk(Some("b"), 2).unwrap();
        assert_eq!(rest.len(), 1);
        s.batch(&[Op::Search { doc: "c".to_string(), rows: vec![hit_row(0, "the text of c")] }, Op::SearchWalked { after: None }]).unwrap();
        assert_eq!(s.search_state().unwrap(), SearchState { done: true, after: None });
        assert_eq!(found(&s, "text").len(), 3);
        // a walk again finds what it found, once
        s.batch(&[Op::Search { doc: "c".to_string(), rows: vec![hit_row(0, "the text of c")] }]).unwrap();
        assert_eq!(found(&s, "text").len(), 3);
    }

    #[test]
    fn a_new_collection_has_nothing_to_walk() {
        let dir = scratch("search-new");
        let s = Store::create(&dir.join("c")).unwrap();
        assert_eq!(s.search_state().unwrap(), SearchState { done: true, after: None });
    }
}
