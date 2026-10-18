//! An Anki package (`.apkg`) read on this side, since the webview cannot open
//! SQLite. The package is a zip holding the collection database, `collection
//! .anki2` (schema 11, the notetypes and decks as JSON in the `col` row) or,
//! in exports from 2.1.50 on, `collection.anki21b` (schema 18, zstd
//! compressed, with `notetypes`, `fields`, `templates`, and `decks` tables;
//! the `.anki2` beside it is then a stub). Whichever is newest is read, the
//! database is written to a temporary file for SQLite to open, and what the
//! renderer needs comes back as plain data: the creation epoch, the decks,
//! the notetypes with their fields and template fronts, the notes, and the
//! cards with their scheduling columns. Media is not extracted; only the form
//! of the `media` entry is noted.

use rusqlite::{Connection, OpenFlags};
use serde::Serialize;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AnkiPackage {
    /// The collection's creation time, an epoch in seconds at local midnight; review `due` counts days from it.
    pub crt: i64,
    /// The database's `user_version`: 11 for `.anki2`, 18 for `.anki21b`.
    pub schema: i64,
    /// The form of the `media` entry: `json` (old exports), `zstd` (new ones), `other`, or `none`.
    pub media: String,
    pub decks: Vec<AnkiDeck>,
    pub notetypes: Vec<AnkiNotetype>,
    pub notes: Vec<AnkiNote>,
    pub cards: Vec<AnkiCard>,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct AnkiDeck {
    pub id: i64,
    /// `Parent::Child`, the old separator whatever the schema wrote.
    pub name: String,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct AnkiNotetype {
    pub id: i64,
    pub name: String,
    /// Field names in order.
    pub fields: Vec<String>,
    /// A template's front holds `{{cloze:`.
    pub cloze: bool,
    pub templates: Vec<AnkiTemplate>,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct AnkiTemplate {
    pub name: String,
    /// The question format.
    pub front: String,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct AnkiNote {
    pub id: i64,
    pub notetype: i64,
    pub fields: Vec<String>,
    pub tags: Vec<String>,
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AnkiCard {
    pub id: i64,
    pub note: i64,
    /// The template index, or the cloze group minus one.
    pub ord: i64,
    /// The home deck: `odid` when the card sits in a filtered deck.
    pub deck: i64,
    /// 0 new, 1 learning, 2 review, 3 relearning.
    #[serde(rename = "type")]
    pub kind: i64,
    pub queue: i64,
    pub ivl: i64,
    /// Days since `crt` for a review card; `odue` when the card sits in a filtered deck.
    pub due: i64,
    /// Ease × 1000.
    pub factor: i64,
    pub reps: i64,
    pub lapses: i64,
}

const COLLECTIONS: [&str; 3] = ["collection.anki21b", "collection.anki21", "collection.anki2"];
const ZSTD_MAGIC: [u8; 4] = [0x28, 0xB5, 0x2F, 0xFD];
const FIELD_SEP: char = '\u{1f}';

static TEMP_SEQ: AtomicU64 = AtomicU64::new(0);

/// A temporary file removed when dropped.
struct TempFile(PathBuf);

impl TempFile {
    fn new(bytes: &[u8]) -> Result<Self, String> {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let seq = TEMP_SEQ.fetch_add(1, Ordering::Relaxed);
        let path = std::env::temp_dir().join(format!("ilmi-anki-{}-{}-{}.sqlite", std::process::id(), nanos, seq));
        std::fs::write(&path, bytes).map_err(|e| format!("{}: {}", path.display(), e))?;
        Ok(TempFile(path))
    }
}

impl Drop for TempFile {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.0);
    }
}

/// The package at `path`, read.
pub fn read_package(path: &Path) -> Result<AnkiPackage, String> {
    let file = std::fs::File::open(path).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipArchive::new(file).map_err(|e| format!("not a zip: {}", e))?;
    let mut db: Option<Vec<u8>> = None;
    for name in COLLECTIONS {
        if let Ok(mut entry) = zip.by_name(name) {
            let mut bytes = Vec::new();
            entry.read_to_end(&mut bytes).map_err(|e| e.to_string())?;
            if name.ends_with('b') {
                bytes = zstd::stream::decode_all(bytes.as_slice()).map_err(|e| format!("{}: {}", name, e))?;
            }
            db = Some(bytes);
            break;
        }
    }
    let db = db.ok_or_else(|| "no collection in the package".to_string())?;
    let media = match zip.by_name("media") {
        Ok(mut entry) => {
            let mut head = [0u8; 4];
            let n = entry.read(&mut head).map_err(|e| e.to_string())?;
            if n > 0 && head[0] == b'{' {
                "json"
            } else if n == 4 && head == ZSTD_MAGIC {
                "zstd"
            } else {
                "other"
            }
        }
        Err(_) => "none",
    };
    let tmp = TempFile::new(&db)?;
    let conn = Connection::open_with_flags(&tmp.0, OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX)
        .map_err(|e| format!("not a database: {}", e))?;
    unicase(&conn).map_err(|e| e.to_string())?;
    let mut pkg = read_collection(&conn).map_err(|e| e.to_string())?;
    pkg.media = media.to_string();
    Ok(pkg)
}

/// Anki declares its name columns `collate unicase`, a collation it registers itself; the same one here, so the schema loads.
fn unicase(conn: &Connection) -> rusqlite::Result<()> {
    conn.create_collation("unicase", |a, b| a.to_lowercase().cmp(&b.to_lowercase()))
}

fn read_collection(conn: &Connection) -> rusqlite::Result<AnkiPackage> {
    let schema: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0))?;
    let new_schema: i64 = conn.query_row(
        "SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name = 'notetypes'",
        [],
        |r| r.get(0),
    )?;
    let (crt, decks, notetypes) = if new_schema > 0 { read_new(conn)? } else { read_old(conn)? };

    let mut notes = Vec::new();
    let mut stmt = conn.prepare("SELECT id, mid, flds, tags FROM notes ORDER BY id")?;
    let rows = stmt.query_map([], |r| {
        let flds: String = r.get(2)?;
        let tags: String = r.get(3)?;
        Ok(AnkiNote {
            id: r.get(0)?,
            notetype: r.get(1)?,
            fields: flds.split(FIELD_SEP).map(str::to_string).collect(),
            tags: tags.split_whitespace().map(str::to_string).collect(),
        })
    })?;
    for n in rows {
        notes.push(n?);
    }

    let mut cards = Vec::new();
    let mut stmt = conn.prepare(
        "SELECT id, nid, ord, CASE WHEN odid != 0 THEN odid ELSE did END, type, queue, ivl,
                CASE WHEN odid != 0 THEN odue ELSE due END, factor, reps, lapses
         FROM cards ORDER BY id",
    )?;
    let rows = stmt.query_map([], |r| {
        Ok(AnkiCard {
            id: r.get(0)?,
            note: r.get(1)?,
            ord: r.get(2)?,
            deck: r.get(3)?,
            kind: r.get(4)?,
            queue: r.get(5)?,
            ivl: r.get(6)?,
            due: r.get(7)?,
            factor: r.get(8)?,
            reps: r.get(9)?,
            lapses: r.get(10)?,
        })
    })?;
    for c in rows {
        cards.push(c?);
    }

    Ok(AnkiPackage { crt, schema, media: String::new(), decks, notetypes, notes, cards })
}

type Tables = (i64, Vec<AnkiDeck>, Vec<AnkiNotetype>);

/// Schema 11: the notetypes and decks as JSON objects keyed by id in the `col` row.
fn read_old(conn: &Connection) -> rusqlite::Result<Tables> {
    let (crt, models, decks): (i64, String, String) =
        conn.query_row("SELECT crt, models, decks FROM col LIMIT 1", [], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))?;
    let json = |s: &str| -> rusqlite::Result<serde_json::Value> {
        serde_json::from_str(s).map_err(|e| rusqlite::Error::InvalidParameterName(format!("col json: {}", e)))
    };
    let models = json(&models)?;
    let decks = json(&decks)?;
    let str_of = |v: &serde_json::Value| v.as_str().unwrap_or("").to_string();
    let id_of = |key: &str, v: &serde_json::Value| v.get("id").and_then(|i| i.as_i64()).or_else(|| key.parse().ok()).unwrap_or(0);
    /// Objects of an array, sorted by their `ord`.
    fn by_ord(v: Option<&serde_json::Value>) -> Vec<&serde_json::Value> {
        let mut items: Vec<&serde_json::Value> = v.and_then(|a| a.as_array()).map(|a| a.iter().collect()).unwrap_or_default();
        items.sort_by_key(|t| t.get("ord").and_then(|o| o.as_i64()).unwrap_or(0));
        items
    }

    let mut out_decks: Vec<AnkiDeck> = decks
        .as_object()
        .map(|o| o.iter().map(|(k, v)| AnkiDeck { id: id_of(k, v), name: str_of(&v["name"]).replace(FIELD_SEP, "::") }).collect())
        .unwrap_or_default();
    out_decks.sort_by_key(|d| d.id);

    let mut out_models: Vec<AnkiNotetype> = models
        .as_object()
        .map(|o| {
            o.iter()
                .map(|(k, v)| {
                    let templates: Vec<AnkiTemplate> =
                        by_ord(v.get("tmpls")).into_iter().map(|t| AnkiTemplate { name: str_of(&t["name"]), front: str_of(&t["qfmt"]) }).collect();
                    AnkiNotetype {
                        id: id_of(k, v),
                        name: str_of(&v["name"]),
                        fields: by_ord(v.get("flds")).into_iter().map(|f| str_of(&f["name"])).collect(),
                        cloze: is_cloze(&templates),
                        templates,
                    }
                })
                .collect()
        })
        .unwrap_or_default();
    out_models.sort_by_key(|m| m.id);
    Ok((crt, out_decks, out_models))
}

/// Schema 18: one table each; a template's formats sit in a protobuf `config` blob, the question format its first field.
fn read_new(conn: &Connection) -> rusqlite::Result<Tables> {
    let crt: i64 = conn.query_row("SELECT crt FROM col LIMIT 1", [], |r| r.get(0))?;
    let mut decks = Vec::new();
    let mut stmt = conn.prepare("SELECT id, name FROM decks ORDER BY id")?;
    for row in stmt.query_map([], |r| Ok(AnkiDeck { id: r.get(0)?, name: r.get::<_, String>(1)?.replace(FIELD_SEP, "::") }))? {
        decks.push(row?);
    }
    let mut notetypes = Vec::new();
    let mut stmt = conn.prepare("SELECT id, name FROM notetypes ORDER BY id")?;
    for row in stmt.query_map([], |r| Ok((r.get::<_, i64>(0)?, r.get::<_, String>(1)?)))? {
        let (id, name) = row?;
        let mut fields = Vec::new();
        let mut fs = conn.prepare("SELECT name FROM fields WHERE ntid = ?1 ORDER BY ord")?;
        for f in fs.query_map([id], |r| r.get::<_, String>(0))? {
            fields.push(f?);
        }
        let mut templates = Vec::new();
        let mut ts = conn.prepare("SELECT name, config FROM templates WHERE ntid = ?1 ORDER BY ord")?;
        for t in ts.query_map([id], |r| Ok((r.get::<_, String>(0)?, r.get::<_, Vec<u8>>(1)?)))? {
            let (name, config) = t?;
            templates.push(AnkiTemplate { name, front: proto_string(&config, 1).unwrap_or_default() });
        }
        notetypes.push(AnkiNotetype { id, name, fields, cloze: is_cloze(&templates), templates });
    }
    Ok((crt, decks, notetypes))
}

fn is_cloze(templates: &[AnkiTemplate]) -> bool {
    templates.iter().any(|t| t.front.contains("{{cloze:"))
}

/// A varint at `at`: its value and width.
fn varint(buf: &[u8], at: usize) -> Option<(u64, usize)> {
    let mut v: u64 = 0;
    for (n, b) in buf.get(at..)?.iter().take(10).enumerate() {
        v |= u64::from(b & 0x7f) << (7 * n);
        if b & 0x80 == 0 {
            return Some((v, n + 1));
        }
    }
    None
}

/// The first string of protobuf field `want` in `buf`, read without a schema: other fields are skipped by wire type.
fn proto_string(buf: &[u8], want: u64) -> Option<String> {
    let mut i = 0;
    while i < buf.len() {
        let (key, n) = varint(buf, i)?;
        i += n;
        match key & 7 {
            0 => i += varint(buf, i)?.1,
            1 => i += 8,
            2 => {
                let (len, n) = varint(buf, i)?;
                i += n;
                let end = i.checked_add(len as usize)?;
                if end > buf.len() {
                    return None;
                }
                if key >> 3 == want {
                    return Some(String::from_utf8_lossy(&buf[i..end]).into_owned());
                }
                i = end;
            }
            5 => i += 4,
            _ => return None,
        }
    }
    None
}

#[cfg(test)]
pub mod tests {
    //! A two-deck package built here with rusqlite and read back; the same
    //! collection zstd-compressed under the new name; a schema 18 database.
    //! With `ILMI_ANKI_FIXTURE=<dir>` set, the two-deck package and the JSON
    //! it reads as are also written there (`npm run fixture:anki`), for
    //! `anki.test.ts` and the `anki` smoke.

    use super::*;
    use std::io::Write;

    /// 2026-01-01T00:00:00Z: a creation time whose day reads the same in any zone within twelve hours.
    pub const CRT: i64 = 1_767_225_600;
    const DECK_GERMAN: i64 = 1_700_000_000_001;
    const DECK_SCIENCE: i64 = 1_700_000_000_002;
    const NT_BASIC: i64 = 1_700_000_000_010;
    const NT_REVERSED: i64 = 1_700_000_000_011;
    const NT_CLOZE: i64 = 1_700_000_000_012;

    const SCHEMA_11: &str = "
        CREATE TABLE col (id integer primary key, crt integer not null, mod integer not null, scm integer not null, ver integer not null, dty integer not null, usn integer not null, ls integer not null, conf text not null, models text not null, decks text not null, dconf text not null, tags text not null);
        CREATE TABLE notes (id integer primary key, guid text not null, mid integer not null, mod integer not null, usn integer not null, tags text not null, flds text not null, sfld integer not null, csum integer not null, flags integer not null, data text not null);
        CREATE TABLE cards (id integer primary key, nid integer not null, did integer not null, ord integer not null, mod integer not null, usn integer not null, type integer not null, queue integer not null, due integer not null, ivl integer not null, factor integer not null, reps integer not null, lapses integer not null, left integer not null, odue integer not null, odid integer not null, flags integer not null, data text not null);
        CREATE TABLE revlog (id integer primary key, cid integer not null, usn integer not null, ease integer not null, ivl integer not null, lastIvl integer not null, factor integer not null, time integer not null, type integer not null);
        CREATE TABLE graves (usn integer not null, oid integer not null, type integer not null);
        PRAGMA user_version = 11;
    ";

    fn tmpl(name: &str, ord: i64, qfmt: &str, afmt: &str) -> serde_json::Value {
        serde_json::json!({ "name": name, "ord": ord, "qfmt": qfmt, "afmt": afmt, "bqfmt": "", "bafmt": "", "did": null })
    }

    fn fld(name: &str, ord: i64) -> serde_json::Value {
        serde_json::json!({ "name": name, "ord": ord, "sticky": false, "rtl": false, "font": "Arial", "size": 20 })
    }

    fn model(id: i64, name: &str, kind: i64, flds: Vec<serde_json::Value>, tmpls: Vec<serde_json::Value>) -> serde_json::Value {
        serde_json::json!({ "id": id, "name": name, "type": kind, "mod": CRT, "usn": -1, "sortf": 0, "did": 1, "flds": flds, "tmpls": tmpls, "css": "", "latexPre": "", "latexPost": "", "req": [] })
    }

    fn deck(id: i64, name: &str) -> serde_json::Value {
        serde_json::json!({ "id": id, "name": name, "mod": CRT, "usn": -1, "desc": "", "dyn": 0, "conf": 1, "collapsed": false })
    }

    /// The two-deck collection, schema 11: `Languages::German` (a basic note, a reversed note), `Science` (a cloze note with two blanks, a learning card), `Default` empty.
    pub fn build_collection(conn: &Connection) -> rusqlite::Result<()> {
        conn.execute_batch(SCHEMA_11)?;
        let models = serde_json::json!({
            NT_BASIC.to_string(): model(NT_BASIC, "Basic", 0, vec![fld("Front", 0), fld("Back", 1)], vec![tmpl("Card 1", 0, "{{Front}}", "{{FrontSide}}<hr id=answer>{{Back}}")]),
            NT_REVERSED.to_string(): model(NT_REVERSED, "Basic (and reversed card)", 0, vec![fld("Front", 0), fld("Back", 1)], vec![
                tmpl("Card 1", 0, "{{Front}}", "{{FrontSide}}<hr id=answer>{{Back}}"),
                tmpl("Card 2", 1, "{{Back}}", "{{FrontSide}}<hr id=answer>{{Front}}"),
            ]),
            NT_CLOZE.to_string(): model(NT_CLOZE, "Cloze", 1, vec![fld("Text", 0), fld("Back Extra", 1)], vec![tmpl("Cloze", 0, "{{cloze:Text}}", "{{cloze:Text}}<br>{{Back Extra}}")]),
        });
        let decks = serde_json::json!({
            "1": deck(1, "Default"),
            DECK_GERMAN.to_string(): deck(DECK_GERMAN, "Languages::German"),
            DECK_SCIENCE.to_string(): deck(DECK_SCIENCE, "Science"),
        });
        conn.execute(
            "INSERT INTO col VALUES (1, ?1, ?1, ?1, 11, 0, 0, 0, '{}', ?2, ?3, '{}', '{}')",
            rusqlite::params![CRT, models.to_string(), decks.to_string()],
        )?;
        let notes: [(i64, &str, i64, &str, &str); 5] = [
            (1_700_000_000_100, "aaaaaaaaaa", NT_BASIC, "geo", "What is the capital of <b>France</b>?\u{1f}Paris [sound:paris.mp3]"),
            (1_700_000_000_101, "bbbbbbbbbb", NT_REVERSED, "german", "der Vorsatz\u{1f}resolution; intention"),
            (1_700_000_000_102, "cccccccccc", NT_CLOZE, "bio", "The {{c1::mitochondrion::organelle}} is the {{c2::powerhouse}} of the cell.\u{1f}<img src=\"cell.png\">"),
            (1_700_000_000_103, "dddddddddd", NT_BASIC, "", "Only a front\u{1f}"),
            (1_700_000_000_104, "eeeeeeeeee", NT_BASIC, "astro", "Which planet is nearest the sun?\u{1f}Mercury"),
        ];
        for (id, guid, mid, tags, flds) in notes {
            let sfld = flds.split(FIELD_SEP).next().unwrap_or("");
            conn.execute(
                "INSERT INTO notes VALUES (?1, ?2, ?3, ?4, -1, ?5, ?6, ?7, 0, 0, '')",
                rusqlite::params![id, guid, mid, CRT, format!(" {} ", tags).replace("  ", ""), flds, sfld],
            )?;
        }
        // (id, nid, did, ord, type, queue, due, ivl, factor, reps, lapses)
        let cards: [(i64, i64, i64, i64, i64, i64, i64, i64, i64, i64, i64); 7] = [
            (1_700_000_000_200, 1_700_000_000_100, DECK_GERMAN, 0, 2, 2, 200, 30, 2500, 7, 1),
            (1_700_000_000_201, 1_700_000_000_101, DECK_GERMAN, 0, 2, 2, 150, 45, 2100, 9, 0),
            (1_700_000_000_202, 1_700_000_000_101, DECK_GERMAN, 1, 2, 2, 160, 20, 1300, 4, 3),
            (1_700_000_000_203, 1_700_000_000_102, DECK_SCIENCE, 0, 2, 2, 100, 10, 1300, 3, 2),
            (1_700_000_000_204, 1_700_000_000_102, DECK_SCIENCE, 1, 0, 0, 3, 0, 0, 0, 0),
            (1_700_000_000_205, 1_700_000_000_103, DECK_GERMAN, 0, 0, 0, 4, 0, 0, 0, 0),
            (1_700_000_000_206, 1_700_000_000_104, DECK_SCIENCE, 0, 1, 1, 1_767_300_000, 0, 2500, 1, 0),
        ];
        for (id, nid, did, ord, kind, queue, due, ivl, factor, reps, lapses) in cards {
            conn.execute(
                "INSERT INTO cards VALUES (?1, ?2, ?3, ?4, ?5, -1, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 0, 0, 0, 0, '')",
                rusqlite::params![id, nid, did, ord, CRT, kind, queue, due, ivl, factor, reps, lapses],
            )?;
        }
        Ok(())
    }

    /// The database as bytes, built in a temporary file.
    fn db_bytes(build: fn(&Connection) -> rusqlite::Result<()>) -> Vec<u8> {
        let tmp = TempFile::new(b"").unwrap();
        {
            let conn = Connection::open(&tmp.0).unwrap();
            unicase(&conn).unwrap();
            build(&conn).unwrap();
            conn.execute_batch("VACUUM").unwrap();
        }
        std::fs::read(&tmp.0).unwrap()
    }

    /// A package with the named entries, each dated to the epoch so the bytes do not move between runs.
    fn write_package(path: &Path, entries: &[(&str, &[u8], zip::CompressionMethod)]) {
        let file = std::fs::File::create(path).unwrap();
        let mut zip = zip::ZipWriter::new(file);
        for (name, bytes, method) in entries {
            let opts = zip::write::SimpleFileOptions::default()
                .compression_method(*method)
                .last_modified_time(zip::DateTime::from_date_and_time(2026, 1, 1, 0, 0, 0).unwrap());
            zip.start_file(*name, opts).unwrap();
            zip.write_all(bytes).unwrap();
        }
        zip.finish().unwrap();
    }

    fn scratch(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("ilmi-anki-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        dir.join(name)
    }

    #[test]
    fn reads_the_two_deck_package() {
        let db = db_bytes(build_collection);
        let apkg = scratch("two-decks.apkg");
        write_package(&apkg, &[("collection.anki2", &db, zip::CompressionMethod::Deflated), ("media", b"{}", zip::CompressionMethod::Deflated)]);
        let pkg = read_package(&apkg).unwrap();
        assert_eq!(pkg.crt, CRT);
        assert_eq!(pkg.schema, 11);
        assert_eq!(pkg.media, "json");
        assert_eq!(pkg.decks.iter().map(|d| d.name.as_str()).collect::<Vec<_>>(), ["Default", "Languages::German", "Science"]);
        assert_eq!(pkg.notetypes.len(), 3);
        let basic = &pkg.notetypes[0];
        assert_eq!((basic.name.as_str(), basic.cloze, basic.templates.len()), ("Basic", false, 1));
        assert_eq!(basic.fields, ["Front", "Back"]);
        let reversed = &pkg.notetypes[1];
        assert_eq!(reversed.templates[1].front, "{{Back}}");
        let cloze = &pkg.notetypes[2];
        assert!(cloze.cloze);
        assert_eq!(cloze.fields, ["Text", "Back Extra"]);
        assert_eq!(pkg.notes.len(), 5);
        assert_eq!(pkg.notes[0].fields, ["What is the capital of <b>France</b>?", "Paris [sound:paris.mp3]"]);
        assert_eq!(pkg.notes[0].tags, ["geo"]);
        assert_eq!(pkg.notes[3].fields, ["Only a front", ""]);
        assert_eq!(pkg.cards.len(), 7);
        let c = &pkg.cards[0];
        assert_eq!((c.note, c.ord, c.deck, c.kind, c.due, c.ivl, c.factor, c.reps, c.lapses), (1_700_000_000_100, 0, DECK_GERMAN, 2, 200, 30, 2500, 7, 1));
        assert_eq!((pkg.cards[4].kind, pkg.cards[4].ivl), (0, 0));

        if let Ok(dir) = std::env::var("ILMI_ANKI_FIXTURE") {
            let dir = Path::new(&dir);
            std::fs::create_dir_all(dir).unwrap();
            std::fs::copy(&apkg, dir.join("two-decks.apkg")).unwrap();
            let json = serde_json::to_string_pretty(&pkg).unwrap();
            std::fs::write(dir.join("two-decks.json"), format!("{}\n", json)).unwrap();
        }
    }

    #[test]
    fn prefers_the_compressed_collection() {
        let db = db_bytes(build_collection);
        let packed = zstd::stream::encode_all(db.as_slice(), 0).unwrap();
        let stub = db_bytes(|conn| {
            conn.execute_batch(SCHEMA_11)?;
            conn.execute("INSERT INTO col VALUES (1, 0, 0, 0, 11, 0, 0, 0, '{}', '{}', '{}', '{}', '{}')", [])?;
            Ok(())
        });
        let apkg = scratch("new.apkg");
        write_package(&apkg, &[
            ("collection.anki2", &stub, zip::CompressionMethod::Deflated),
            ("collection.anki21b", &packed, zip::CompressionMethod::Stored),
            ("media", &ZSTD_MAGIC, zip::CompressionMethod::Stored),
        ]);
        let pkg = read_package(&apkg).unwrap();
        assert_eq!(pkg.crt, CRT);
        assert_eq!(pkg.media, "zstd");
        assert_eq!(pkg.notes.len(), 5);
    }

    /// A protobuf blob with field 1 and field 2 as strings.
    fn template_config(qfmt: &str, afmt: &str) -> Vec<u8> {
        let mut out = Vec::new();
        for (field, s) in [(1u8, qfmt), (2u8, afmt)] {
            out.push(field << 3 | 2);
            out.push(s.len() as u8);
            out.extend_from_slice(s.as_bytes());
        }
        out
    }

    #[test]
    fn reads_schema_18_tables() {
        let db = db_bytes(|conn| {
            conn.execute_batch(
                "CREATE TABLE col (id integer primary key, crt integer not null, mod integer not null, scm integer not null, ver integer not null, dty integer not null, usn integer not null, ls integer not null, conf text not null, models text not null, decks text not null, dconf text not null, tags text not null);
                 CREATE TABLE notetypes (id integer not null primary key, name text not null collate unicase, mtime_secs integer not null, usn integer not null, config blob not null);
                 CREATE TABLE fields (ntid integer not null, ord integer not null, name text not null collate unicase, config blob not null, primary key (ntid, ord)) without rowid;
                 CREATE TABLE templates (ntid integer not null, ord integer not null, name text not null collate unicase, mtime_secs integer not null, usn integer not null, config blob not null, primary key (ntid, ord)) without rowid;
                 CREATE TABLE decks (id integer primary key not null, name text not null collate unicase, mtime_secs integer not null, usn integer not null, common blob not null, kind blob not null);
                 CREATE TABLE notes (id integer primary key, guid text not null, mid integer not null, mod integer not null, usn integer not null, tags text not null, flds text not null, sfld integer not null, csum integer not null, flags integer not null, data text not null);
                 CREATE TABLE cards (id integer primary key, nid integer not null, did integer not null, ord integer not null, mod integer not null, usn integer not null, type integer not null, queue integer not null, due integer not null, ivl integer not null, factor integer not null, reps integer not null, lapses integer not null, left integer not null, odue integer not null, odid integer not null, flags integer not null, data text not null);
                 PRAGMA user_version = 18;",
            )?;
            conn.execute("INSERT INTO col VALUES (1, ?1, 0, 0, 18, 0, 0, 0, '', '', '', '', '')", [CRT])?;
            conn.execute("INSERT INTO notetypes VALUES (?1, 'Cloze', 0, 0, x'0801')", [NT_CLOZE])?;
            conn.execute("INSERT INTO fields VALUES (?1, 0, 'Text', x''), (?1, 1, 'Back Extra', x'')", [NT_CLOZE])?;
            conn.execute(
                "INSERT INTO templates VALUES (?1, 0, 'Cloze', 0, 0, ?2)",
                rusqlite::params![NT_CLOZE, template_config("{{cloze:Text}}", "{{cloze:Text}}<br>{{Back Extra}}")],
            )?;
            conn.execute("INSERT INTO decks VALUES (1, 'Default', 0, 0, x'', x''), (?1, 'Languages\u{1f}German', 0, 0, x'', x'')", [DECK_GERMAN])?;
            conn.execute(
                "INSERT INTO notes VALUES (1, 'g', ?1, 0, 0, '', 'a {{c1::b}}\u{1f}', 'a', 0, 0, '')",
                [NT_CLOZE],
            )?;
            // a card in a filtered deck: its home deck and original due are what come back
            conn.execute(
                "INSERT INTO cards VALUES (1, 1, 99, 0, 0, 0, 2, 2, -100000, 12, 2300, 5, 0, 0, 40, ?1, 0, '')",
                [DECK_GERMAN],
            )?;
            Ok(())
        });
        let apkg = scratch("eighteen.apkg");
        write_package(&apkg, &[("collection.anki21b", &zstd::stream::encode_all(db.as_slice(), 0).unwrap(), zip::CompressionMethod::Stored)]);
        let pkg = read_package(&apkg).unwrap();
        assert_eq!(pkg.schema, 18);
        assert_eq!(pkg.media, "none");
        assert_eq!(pkg.decks[1].name, "Languages::German");
        let nt = &pkg.notetypes[0];
        assert_eq!((nt.name.as_str(), nt.cloze), ("Cloze", true));
        assert_eq!(nt.fields, ["Text", "Back Extra"]);
        assert_eq!(nt.templates[0].front, "{{cloze:Text}}");
        assert_eq!((pkg.cards[0].deck, pkg.cards[0].due), (DECK_GERMAN, 40));
    }

    #[test]
    fn refuses_what_is_not_a_package() {
        let path = scratch("not.apkg");
        std::fs::write(&path, b"hello").unwrap();
        assert!(read_package(&path).unwrap_err().starts_with("not a zip"));
        write_package(&path, &[("readme.txt", b"x", zip::CompressionMethod::Stored)]);
        assert_eq!(read_package(&path).unwrap_err(), "no collection in the package");
    }

    #[test]
    fn reads_protobuf_strings_past_other_fields() {
        let mut buf = vec![0x08, 0x96, 0x01]; // field 1 varint 150
        buf.extend_from_slice(&[0x15, 1, 2, 3, 4]); // field 2 fixed32
        buf.extend_from_slice(&[0x1a, 2, b'h', b'i']); // field 3 string
        assert_eq!(proto_string(&buf, 3).as_deref(), Some("hi"));
        assert_eq!(proto_string(&buf, 4), None);
    }
}
