//! The store (milestone 59): a collection is one SQLite file under the
//! app's data directory, `collections/<name>/collection.db`, with the files
//! that are not text (PDFs, images) beside it under `blobs/`, each named by
//! its SHA-256.
//!
//! Two tables. `documents` is the tree: every folder, document and file is
//! a row with an id, its parent's id and its name, so a path is made from
//! names and parents and a rename or a move is one row changing. A
//! document's text is Markdown as FORMAT.md has it, its front matter block
//! kept apart from the rest (`front` then `text` is the file an export
//! writes, byte for byte). `blobs` names the files beside the database.
//!
//! Nothing here knows the format or what a path is: the renderer's
//! `src/vault/store.ts` reads the rows once, keeps the tree, and asks for
//! one row's text or one blob at a time. `place` is a row's position among
//! its siblings; it is carried but not used until the order moves out of
//! `.ilmi/order.json` (milestone 60).

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
";

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
        conn.pragma_update(None, "foreign_keys", "ON").map_err(err)?;
        conn.execute_batch(SCHEMA).map_err(err)?;
        conn.pragma_update(None, "user_version", 1).map_err(err)?;
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
        Store { conn, dir: dir.to_path_buf(), rev: 0 }
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

    /// Write a row: where it is, and with `content` what it holds. Without
    /// `content` an existing row keeps what it has (a rename, a move) and
    /// its `rev`; a new row holds nothing.
    pub fn put(&mut self, at: &Place, content: Option<&Content>) -> Result<Row, String> {
        if !matches!(at.kind.as_str(), "folder" | "doc" | "file") {
            return Err(format!("{}: not a kind", at.kind));
        }
        let exists = self.row(&at.id)?.is_some();
        if exists {
            self.conn
                .execute(
                    "UPDATE documents SET parent = ?2, name = ?3, place = ?4, kind = ?5 WHERE id = ?1",
                    params![at.id, at.parent, at.name, at.place, at.kind],
                )
                .map_err(err)?;
        } else {
            self.rev += 1;
            self.conn
                .execute(
                    "INSERT INTO documents (id, parent, name, place, kind, rev) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    params![at.id, at.parent, at.name, at.place, at.kind, self.rev],
                )
                .map_err(err)?;
        }
        if let Some(c) = content {
            let size: i64 = match &c.blob {
                Some(hash) => self
                    .conn
                    .query_row("SELECT size FROM blobs WHERE hash = ?1", [hash], |r| r.get(0))
                    .optional()
                    .map_err(err)?
                    .ok_or_else(|| format!("{hash}: no such blob"))?,
                None => (c.front.as_deref().map_or(0, str::len) + c.text.as_deref().map_or(0, str::len)) as i64,
            };
            self.rev += 1;
            self.conn
                .execute(
                    "UPDATE documents SET front = ?2, text = ?3, blob = ?4, size = ?5, rev = ?6 WHERE id = ?1",
                    params![at.id, c.front, c.text, c.blob, size, self.rev],
                )
                .map_err(err)?;
        }
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
    pub fn put(&self, dir: &Path, at: &Place, content: Option<&Content>) -> Result<Row, String> {
        self.with(dir, |s| s.put(at, content))
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
        let row = s.put(&place("a", None, "maxwell", "doc"), Some(&text("---\ntype: source\n---\n", "\nلا إله\n"))).unwrap();
        assert_eq!(row.kind, "doc");
        assert_eq!(row.size, "---\ntype: source\n---\n\nلا إله\n".len() as i64);
        assert_eq!(s.text("a").unwrap(), "---\ntype: source\n---\n\nلا إله\n");
        assert!(s.text("nope").is_err());
        assert!(s.put(&place("x", None, "x", "page"), None).is_err());
    }

    #[test]
    fn a_move_keeps_the_text_and_the_rev_and_a_write_moves_it() {
        let dir = scratch("move");
        let mut s = Store::memory(&dir);
        s.put(&place("f", None, "papers", "folder"), None).unwrap();
        let a = s.put(&place("a", None, "maxwell", "doc"), Some(&text("", "one\n"))).unwrap();
        let moved = s.put(&place("a", Some("f"), "equations", "doc"), None).unwrap();
        assert_eq!((moved.parent.as_deref(), moved.name.as_str(), moved.rev), (Some("f"), "equations", a.rev));
        assert_eq!(s.text("a").unwrap(), "one\n");
        let written = s.put(&place("a", Some("f"), "equations", "doc"), Some(&text("", "two\n"))).unwrap();
        assert!(written.rev > a.rev);
        assert_eq!(s.text("a").unwrap(), "two\n");
        // content given as nothing: the row holds nothing (a document that became a folder)
        let emptied = s.put(&place("a", Some("f"), "equations", "folder"), Some(&Content::default())).unwrap();
        assert_eq!((emptied.kind.as_str(), emptied.size), ("folder", 0));
        assert_eq!(s.text("a").unwrap(), "");
    }

    #[test]
    fn what_is_under_a_deleted_row_goes_with_it() {
        let dir = scratch("remove");
        let mut s = Store::memory(&dir);
        s.put(&place("f", None, "papers", "folder"), None).unwrap();
        s.put(&place("a", Some("f"), "a", "doc"), Some(&text("", "a\n"))).unwrap();
        s.put(&place("b", Some("a"), "b", "doc"), Some(&text("", "b\n"))).unwrap();
        s.put(&place("c", None, "c", "doc"), Some(&text("", "c\n"))).unwrap();
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
            .put(&place("p", None, "book.pdf", "file"), Some(&Content { blob: Some(info.hash.clone()), ..Default::default() }))
            .unwrap();
        assert_eq!((row.blob.as_deref(), row.size), (Some(info.hash.as_str()), 14));
        assert!(s.put(&place("q", None, "q.pdf", "file"), Some(&Content { blob: Some("00".into()), ..Default::default() })).is_err());
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
            s.put(&place("a", None, "a", "doc"), Some(&text("", "kept\n"))).unwrap();
        }
        assert!(Store::create(&dir).is_err());
        let mut s = Store::open(&dir).unwrap();
        assert_eq!(s.text("a").unwrap(), "kept\n");
        // the clock goes on from where it was
        let first = s.rows().unwrap()[0].rev;
        assert!(s.put(&place("b", None, "b", "doc"), Some(&text("", "b\n"))).unwrap().rev > first);
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
