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
//! Nothing here knows the format or what a path is: the renderer's
//! `src/vault/store.ts` reads the rows once, keeps the tree, takes a file
//! apart on a write (`src/vault/lift.ts`) and puts it together on a read.

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

/// The database's file in a collection's folder.
pub const DB_FILE: &str = "collection.db";
const BLOBS_DIR: &str = "blobs";

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
CREATE TRIGGER IF NOT EXISTS documents_gone AFTER DELETE ON documents
BEGIN
  DELETE FROM originals WHERE key = OLD.id;
END;
";

/// The schema this code writes. A collection made before the state had
/// tables is 1: it opens, and the renderer takes its documents apart
/// before anything else reads them (`storeFs` in `src/vault/store.ts`).
pub const VERSION: i64 = 2;

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

/// What goes with a document's text in the transaction that writes it.
#[derive(Deserialize, Debug, Clone, Default)]
pub struct Lift {
    pub state: Vec<Sched>,
    pub digest: String,
    pub original: Option<Original>,
    pub size: i64,
    #[serde(default)]
    pub reviews: Vec<ReviewRow>,
}

/// A document as it is stored: its text without its state, its schedules, its original.
#[derive(Serialize, Debug, Clone, PartialEq)]
pub struct DocContent {
    pub front: String,
    pub text: String,
    pub state: Vec<Sched>,
    pub original: Option<Original>,
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
        if !matches!(at.kind.as_str(), "folder" | "doc" | "file") {
            return Err(format!("{}: not a kind", at.kind));
        }
        let mut rev = self.rev;
        let tx = self.conn.transaction().map_err(err)?;
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
            tx.execute(
                "UPDATE documents SET front = ?2, text = ?3 WHERE id = ?1 AND (front IS NOT ?2 OR text IS NOT ?3)",
                params![at.id, c.front, c.text],
            )
            .map_err(err)?;
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
                if let Some(o) = &l.original {
                    tx.execute("INSERT INTO originals (key, text, stamp) VALUES (?1, ?2, ?3)", params![at.id, o.text, o.stamp])
                        .map_err(err)?;
                }
                for r in &l.reviews {
                    insert_review(&tx, r)?;
                    tx.execute("DELETE FROM originals WHERE key = ?1", [format!("{REVIEWS_PATH}/{}", r.file)]).map_err(err)?;
                }
            }
        }
        tx.commit().map_err(err)?;
        self.rev = rev;
        self.row(&at.id)?.ok_or_else(|| format!("{}: no such row", at.id))
    }

    /// Delete rows; what is under a deleted row goes with it.
    pub fn remove(&mut self, ids: &[String]) -> Result<(), String> {
        let tx = self.conn.transaction().map_err(err)?;
        for id in ids {
            tx.execute("DELETE FROM documents WHERE id = ?1", [id]).map_err(err)?;
        }
        tx.commit().map_err(err)
    }

    /// The order chosen: these rows' places, every other row's cleared.
    pub fn places(&mut self, set: &[(String, f64)]) -> Result<(), String> {
        let tx = self.conn.transaction().map_err(err)?;
        tx.execute("UPDATE documents SET place = NULL WHERE place IS NOT NULL", []).map_err(err)?;
        for (id, place) in set {
            tx.execute("UPDATE documents SET place = ?2 WHERE id = ?1", params![id, place]).map_err(err)?;
        }
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

    /// The review log's files, and how many lines each holds.
    pub fn review_files(&self) -> Result<Vec<(String, i64)>, String> {
        let mut st = self.conn.prepare("SELECT file, COUNT(*) FROM reviews GROUP BY file ORDER BY file").map_err(err)?;
        let rows = st.query_map([], |r| Ok((r.get(0)?, r.get(1)?))).map_err(err)?;
        rows.collect::<rusqlite::Result<Vec<_>>>().map_err(err)
    }

    /// One file's lines in the order they were written; every line without a file.
    pub fn reviews(&self, file: Option<&str>) -> Result<Vec<String>, String> {
        let mut st = self
            .conn
            .prepare("SELECT line FROM reviews WHERE ?1 IS NULL OR file = ?1 ORDER BY seq")
            .map_err(err)?;
        let rows = st.query_map([file], |r| r.get(0)).map_err(err)?;
        rows.collect::<rusqlite::Result<Vec<String>>>().map_err(err)
    }

    /// Add lines to a file of the log, or with `replace` make them all it holds.
    pub fn reviews_put(&mut self, file: &str, rows: &[ReviewRow], replace: bool) -> Result<(), String> {
        let tx = self.conn.transaction().map_err(err)?;
        if replace {
            tx.execute("DELETE FROM reviews WHERE file = ?1", [file]).map_err(err)?;
        }
        for r in rows {
            insert_review(&tx, &ReviewRow { file: file.to_string(), ..r.clone() })?;
        }
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
        tx.execute("DELETE FROM not_same", []).map_err(err)?;
        for p in pairs {
            tx.execute("INSERT OR IGNORE INTO not_same (pair) VALUES (?1)", [p]).map_err(err)?;
        }
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
        match original {
            Some(o) => self
                .conn
                .execute("INSERT OR REPLACE INTO originals (key, text, stamp) VALUES (?1, ?2, ?3)", params![key, o.text, o.stamp])
                .map(|_| ())
                .map_err(err),
            None => self.conn.execute("DELETE FROM originals WHERE key = ?1", [key]).map(|_| ()).map_err(err),
        }
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
        self.conn
            .execute("INSERT OR IGNORE INTO blobs (hash, size, path) VALUES (?1, ?2, ?3)", params![hash, size, rel])
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
        std::fs::read(self.dir.join(rel)).map_err(err)
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
            let _ = std::fs::remove_file(self.dir.join(rel));
            self.conn.execute("DELETE FROM blobs WHERE hash = ?1", [hash]).map_err(err)?;
        }
        Ok(())
    }
}

/// Where the review log's files are, as the renderer names them.
const REVIEWS_PATH: &str = ".ilmi/reviews";

fn insert_review(tx: &rusqlite::Transaction<'_>, r: &ReviewRow) -> Result<(), String> {
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
    pub fn blob_get(&self, dir: &Path, hash: &str) -> Result<Vec<u8>, String> {
        self.with(dir, |s| s.blob_get(hash))
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
        let lift = Lift { state: vec![], digest: "{}".into(), original: Some(Original { text: "b\r\n".into(), stamp: "t".into() }), size: 3, reviews: vec![] };
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
}
