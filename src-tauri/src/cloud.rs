//! Dropbox and Google Drive as storages (milestone 64): the same verbs as
//! `storage.rs`'s, over each service's own API, with a token from `oauth.rs`.
//!
//! **Each keeps to a folder of its own.** Dropbox: an app of the *App folder*
//! kind sees `/Apps/<its name>/` as its root, and a collection is the folder
//! named in its settings under that. Drive: the scope is `drive.file`, which
//! shows the app only what it made, and a collection is a folder under a
//! folder `ilmi` in My Drive.
//!
//! **Drive's ids and a storage's paths.** Drive finds a file by an id, and a
//! name is not unique in a folder. So a collection's folder holds its files
//! flat, each *named* its whole path (`devices/0a1b…/3`): the one thing to
//! find by name is that folder, once a run; a listing is a paged walk of one
//! folder, filtered by prefix here, and there are no folders in between for
//! two devices to make twice. The listing leaves a path → id table for the
//! reads after it; a path not in it is asked for by name. A file sent twice
//! (a reply lost, a sync tried again) is two files of one name: the later is
//! the file, and `remove` takes both. Two devices making the folder at once
//! both settle on the older.
//!
//! **Large files.** Dropbox: one `upload` up to 150 MiB, above that an upload
//! session, 16 MiB a request; a reply that was lost is told by the session's
//! `correct_offset`. Drive: over 5 MB a resumable session, 16 MiB a request,
//! its offset read from each `308`, and asked for after a failure. Either way
//! a file is read from disk as it goes, and appears whole at the end.
//!
//! **What a refusal means.** A `401` gets a fresh token and one more try. A
//! `429`, Drive's rate-limit `403`s and a `5xx` wait as they say (`Retry-After`)
//! or by doubling, five times, and then fail: the next sync tries again.

use crate::oauth::{self, Hosts, Service};
use crate::storage::{body_of, http, send_long};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;
use tauri_plugin_http::reqwest;

/// Dropbox takes up to this in one `upload`.
pub const DROPBOX_WHOLE: u64 = 150 * 1024 * 1024;
/// A request of an upload session, either service: a multiple of Dropbox's 4 MiB and of Drive's 256 KiB.
pub const CHUNK: u64 = 16 * 1024 * 1024;
/// Drive's multipart upload is for this and less.
pub const DRIVE_WHOLE: u64 = 5_000_000;
const TRIES: u32 = 5;
const FOLDER: &str = "application/vnd.google-apps.folder";

fn err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

async fn pause(d: Duration) {
    let _ = tauri::async_runtime::spawn_blocking(move || std::thread::sleep(d)).await;
}

/// How long a refusal says to wait; by doubling when it does not say.
fn wait_of(res: Option<&reqwest::Response>, tries: u32) -> Duration {
    let said = res.and_then(|r| r.headers().get("retry-after")).and_then(|v| v.to_str().ok()).and_then(|v| v.parse::<u64>().ok());
    Duration::from_secs(said.unwrap_or(1 << tries.min(5)).min(300))
}

/// Whether a `403` from Drive is a rate limit, by its reason.
fn rate_limit(body: &str) -> bool {
    body.contains("ateLimitExceeded")
}

/// What a service said when it refused, in a line: Dropbox's `error_summary`, Google's reason.
fn said(what: &str, status: u16, body: &str) -> String {
    let v: Value = serde_json::from_str(body).unwrap_or(Value::Null);
    let why = v["error_summary"].as_str().map(|s| s.trim_end_matches(['/', '.']).to_string()).or_else(|| v["error"]["errors"][0]["reason"].as_str().map(String::from)).or_else(|| v["error"]["message"].as_str().map(String::from));
    match why {
        Some(w) => format!("{what}: {status} {w}"),
        None => format!("{what}: {status}"),
    }
}

/// A request made with a good token, and made again as the module's head says. `make` builds it each time; `long` is for a body that takes as long as it takes.
async fn call(account: &str, long: bool, make: impl Fn(&str) -> Result<reqwest::RequestBuilder, String>) -> Result<reqwest::Response, String> {
    let mut fresh = false;
    let mut tries = 0;
    loop {
        let token = oauth::bearer(account).await?;
        let req = make(&token)?;
        let res = if long { send_long(req).await? } else { req.send().await.map_err(err)? };
        let status = res.status().as_u16();
        if status == 401 && !fresh {
            fresh = true;
            oauth::spoil(account, &token);
            continue;
        }
        if status == 401 {
            oauth::spoil(account, &token);
            return Err(oauth::GONE.to_string());
        }
        let busy = status == 429 || status >= 500;
        if busy && tries < TRIES {
            tries += 1;
            pause(wait_of(Some(&res), tries)).await;
            continue;
        }
        if status == 403 {
            let wait = wait_of(Some(&res), tries + 1);
            let body = res.text().await.map_err(err)?;
            if rate_limit(&body) && tries < TRIES {
                tries += 1;
                pause(wait).await;
                continue;
            }
            return Err(said("refused", 403, &body));
        }
        return Ok(res);
    }
}

// ── Dropbox ──────────────────────────────────────────────────────

pub struct Dropbox<'a> {
    account: &'a str,
    /// `/<folder>`, the collection's place in the app's folder.
    root: String,
    hosts: Hosts,
}

/// `Dropbox-API-Arg` is a header, so its JSON is ASCII: anything else as `\uXXXX`.
pub fn header_json(v: &Value) -> String {
    let mut out = String::new();
    for c in v.to_string().chars() {
        if c.is_ascii() && c != '\x7f' {
            out.push(c);
        } else {
            let mut units = [0u16; 2];
            for u in c.encode_utf16(&mut units) {
                out.push_str(&format!("\\u{u:04x}"));
            }
        }
    }
    out
}

impl<'a> Dropbox<'a> {
    pub fn new(account: &'a str, folder: &str) -> Result<Dropbox<'a>, String> {
        let e = oauth::entry(account).filter(|e| e.service == Service::Dropbox).ok_or_else(|| oauth::GONE.to_string())?;
        let f = folder.trim().trim_matches('/');
        if f.is_empty() {
            return Err("no folder named".to_string());
        }
        Ok(Dropbox { account, root: format!("/{f}"), hosts: oauth::hosts(Service::Dropbox, e.dev.as_deref()) })
    }

    fn at(&self, path: &str) -> String {
        if path.is_empty() {
            self.root.clone()
        } else {
            format!("{}/{path}", self.root)
        }
    }

    async fn rpc(&self, route: &str, body: &Value) -> Result<(u16, String), String> {
        let url = format!("{}/2/{route}", self.hosts.api);
        let res = call(self.account, false, |token| Ok(http().post(&url).bearer_auth(token).header("content-type", "application/json").body(body.to_string()))).await?;
        let status = res.status().as_u16();
        Ok((status, res.text().await.map_err(err)?))
    }

    pub async fn list(&self, prefix: &str) -> Result<Vec<String>, String> {
        let mut out = Vec::new();
        let start = json!({ "path": self.at(prefix), "recursive": true, "include_deleted": false, "limit": 2000 });
        let (mut status, mut body) = self.rpc("files/list_folder", &start).await?;
        // a path in `path_lower` is lower-cased, which every storage's own path already is; the folder's may not be
        let top = format!("{}/", self.root.to_lowercase());
        loop {
            if status == 409 && summary_starts(&body, "path/not_found") {
                return Ok(Vec::new());
            }
            if status != 200 {
                return Err(said("list", status, &body));
            }
            let v: Value = serde_json::from_str(&body).map_err(err)?;
            for e in v["entries"].as_array().map(Vec::as_slice).unwrap_or(&[]) {
                if e[".tag"] == "file" {
                    if let Some(rel) = e["path_lower"].as_str().and_then(|p| p.strip_prefix(&top)) {
                        out.push(rel.to_string());
                    }
                }
            }
            if v["has_more"] != true {
                return Ok(out);
            }
            (status, body) = self.rpc("files/list_folder/continue", &json!({ "cursor": v["cursor"] })).await?;
        }
    }

    /// The file's response, to read; none when it is not there.
    pub async fn get(&self, path: &str) -> Result<Option<reqwest::Response>, String> {
        let url = format!("{}/2/files/download", self.hosts.content);
        let arg = header_json(&json!({ "path": self.at(path) }));
        let res = call(self.account, false, |token| Ok(http().post(&url).bearer_auth(token).header("dropbox-api-arg", &arg))).await?;
        if res.status().as_u16() == 409 {
            let body = res.text().await.map_err(err)?;
            return if summary_starts(&body, "path/not_found") { Ok(None) } else { Err(said("read", 409, &body)) };
        }
        Ok(Some(res))
    }

    fn commit(&self, path: &str) -> Value {
        // a file is written once; a retry of one whose reply was lost lands on itself
        json!({ "path": self.at(path), "mode": "overwrite", "autorename": false, "mute": true })
    }

    async fn checked(what: &str, res: reqwest::Response) -> Result<String, String> {
        let status = res.status().as_u16();
        let body = res.text().await.map_err(err)?;
        if status == 200 {
            Ok(body)
        } else {
            Err(said(what, status, &body))
        }
    }

    pub async fn write(&self, path: &str, bytes: Vec<u8>) -> Result<(), String> {
        let url = format!("{}/2/files/upload", self.hosts.content);
        let arg = header_json(&self.commit(path));
        let res = call(self.account, true, |token| Ok(http().post(&url).bearer_auth(token).header("dropbox-api-arg", &arg).header("content-type", "application/octet-stream").header("content-length", bytes.len()).body(bytes.clone()))).await?;
        Self::checked("write", res).await.map(|_| ())
    }

    pub async fn remove(&self, path: &str) -> Result<(), String> {
        let (status, body) = self.rpc("files/delete_v2", &json!({ "path": self.at(path) })).await?;
        if status == 200 || (status == 409 && summary_starts(&body, "path_lookup/not_found")) {
            Ok(())
        } else {
            Err(said("remove", status, &body))
        }
    }

    /// A request of the content host with a file's bytes from `offset`, `len` of them, as its body.
    fn part(&self, route: &str, token: &str, arg: &str, file: &Path, offset: u64, len: u64, progress: &Told) -> Result<reqwest::RequestBuilder, String> {
        let url = format!("{}/2/{route}", self.hosts.content);
        let p = progress.clone();
        let mut f = std::fs::File::open(file).map_err(err)?;
        f.seek(SeekFrom::Start(offset)).map_err(err)?;
        Ok(http().post(url).bearer_auth(token).header("dropbox-api-arg", arg).header("content-type", "application/octet-stream").header("content-length", len).body(body_of(f.take(len), move |n| p(offset + n))))
    }

    /// The file written as `path`: whole up to 150 MiB, in a session above that.
    pub async fn upload(&self, path: &str, file: &Path, size: u64, progress: Told) -> Result<(), String> {
        if size <= DROPBOX_WHOLE {
            let arg = header_json(&self.commit(path));
            let res = call(self.account, true, |token| self.part("files/upload", token, &arg, file, 0, size, &progress)).await?;
            return Self::checked("send", res).await.map(|_| ());
        }
        let quiet: Told = Arc::new(|_| {});
        let arg = header_json(&json!({ "close": false }));
        let res = call(self.account, true, |token| self.part("files/upload_session/start", token, &arg, file, 0, 0, &quiet)).await?;
        let started: Value = serde_json::from_str(&Self::checked("send", res).await?).map_err(err)?;
        let session = started["session_id"].as_str().ok_or("send: no session")?.to_string();
        let mut offset = 0;
        let mut tries = 0;
        while offset < size {
            let len = CHUNK.min(size - offset);
            let arg = header_json(&json!({ "cursor": { "session_id": session, "offset": offset }, "close": false }));
            let res = call(self.account, true, |token| self.part("files/upload_session/append_v2", token, &arg, file, offset, len, &progress)).await;
            let res = match res {
                Ok(r) => r,
                // a connection lost: the same request again, which the session's offset sets right if it had landed
                Err(e) if tries < TRIES && e != oauth::GONE => {
                    tries += 1;
                    pause(wait_of(None, tries)).await;
                    continue;
                }
                Err(e) => return Err(e),
            };
            let status = res.status().as_u16();
            let body = res.text().await.map_err(err)?;
            if status == 200 {
                offset += len;
                tries = 0;
            } else if status == 409 && body.contains("incorrect_offset") {
                let v: Value = serde_json::from_str(&body).map_err(err)?;
                offset = v["error"]["correct_offset"].as_u64().ok_or_else(|| said("send", status, &body))?;
            } else {
                return Err(said("send", status, &body));
            }
        }
        let arg = header_json(&json!({ "cursor": { "session_id": session, "offset": size }, "commit": self.commit(path) }));
        let res = call(self.account, true, |token| self.part("files/upload_session/finish", token, &arg, file, 0, 0, &quiet)).await?;
        Self::checked("send", res).await.map(|_| ())
    }
}

/// How far a file has gone, in bytes.
pub type Told = Arc<dyn Fn(u64) + Send + Sync>;

/// `error_summary` begins so (Dropbox adds dots to it so that nobody matches it whole).
fn summary_starts(body: &str, what: &str) -> bool {
    serde_json::from_str::<Value>(body).ok().and_then(|v| v["error_summary"].as_str().map(|s| s.starts_with(what))).unwrap_or(false)
}

// ── Google Drive ─────────────────────────────────────────────────

pub struct Drive<'a> {
    account: &'a str,
    folder: String,
    hosts: Hosts,
}

/// The collection's folder by account and name, and each file's id by that folder and its path.
fn roots() -> &'static Mutex<HashMap<String, String>> {
    static R: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();
    R.get_or_init(Default::default)
}

fn ids() -> &'static Mutex<HashMap<String, String>> {
    static I: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();
    I.get_or_init(Default::default)
}

fn table<'t>(m: &'t Mutex<HashMap<String, String>>) -> std::sync::MutexGuard<'t, HashMap<String, String>> {
    m.lock().unwrap_or_else(|e| e.into_inner())
}

/// A string inside a query's quotes.
pub fn quoted(s: &str) -> String {
    format!("'{}'", s.replace('\\', "\\\\").replace('\'', "\\'"))
}

/// Everything in a `Range: bytes=0-N` answer: the next offset; nothing said is nothing kept.
fn next_offset(res: &reqwest::Response) -> u64 {
    res.headers().get("range").and_then(|v| v.to_str().ok()).and_then(|v| v.rsplit('-').next()).and_then(|v| v.parse::<u64>().ok()).map(|n| n + 1).unwrap_or(0)
}

impl<'a> Drive<'a> {
    pub fn new(account: &'a str, folder: &str) -> Result<Drive<'a>, String> {
        let e = oauth::entry(account).filter(|e| e.service == Service::Drive).ok_or_else(|| oauth::GONE.to_string())?;
        let f = folder.trim().trim_matches('/');
        if f.is_empty() {
            return Err("no folder named".to_string());
        }
        Ok(Drive { account, folder: f.to_string(), hosts: oauth::hosts(Service::Drive, e.dev.as_deref()) })
    }

    async fn json(&self, res: reqwest::Response, what: &str) -> Result<Value, String> {
        let status = res.status().as_u16();
        let body = res.text().await.map_err(err)?;
        if !(200..300).contains(&status) {
            // the folder may have gone from under it: looked for again by the next call
            if status == 404 {
                self.forget_root();
            }
            return Err(said(what, status, &body));
        }
        serde_json::from_str(&body).map_err(err)
    }

    /// One page of what a query finds.
    async fn query(&self, q: &str, fields: &str, order: Option<&str>, page: Option<&str>) -> Result<Value, String> {
        let url = self.hosts.api.clone();
        let mut pairs: Vec<(&str, &str)> = vec![("q", q), ("fields", fields), ("pageSize", "1000"), ("spaces", "drive")];
        if let Some(o) = order {
            pairs.push(("orderBy", o));
        }
        if let Some(p) = page {
            pairs.push(("pageToken", p));
        }
        let res = call(self.account, false, |token| Ok(http().get(&url).bearer_auth(token).query(&pairs))).await?;
        self.json(res, "list").await
    }

    /// The folder called `name` under `parent`, the oldest of that name, made if there is none.
    async fn folder_in(&self, parent: &str, name: &str) -> Result<String, String> {
        let q = format!("name = {} and {} in parents and mimeType = {} and trashed = false", quoted(name), quoted(parent), quoted(FOLDER));
        let oldest = |v: &Value| v["files"][0]["id"].as_str().map(String::from);
        if let Some(id) = oldest(&self.query(&q, "files(id)", Some("createdTime"), None).await?) {
            return Ok(id);
        }
        let url = self.hosts.api.clone();
        let meta = json!({ "name": name, "mimeType": FOLDER, "parents": [parent] }).to_string();
        let res = call(self.account, false, |token| Ok(http().post(&url).query(&[("fields", "id")]).bearer_auth(token).header("content-type", "application/json").body(meta.clone()))).await?;
        let made = self.json(res, "make folder").await?;
        let mine = made["id"].as_str().ok_or("make folder: no id")?.to_string();
        // another device may have made it in the same moment: both go by the older
        let first = oldest(&self.query(&q, "files(id)", Some("createdTime"), None).await?).unwrap_or_else(|| mine.clone());
        if first != mine {
            let _ = self.delete_id(&mine).await;
        }
        Ok(first)
    }

    /// The id of the collection's folder: looked for once a run.
    async fn root(&self) -> Result<String, String> {
        let key = format!("{}\0{}", self.account, self.folder);
        if let Some(id) = table(roots()).get(&key) {
            return Ok(id.clone());
        }
        let top = self.folder_in("root", "ilmi").await?;
        let id = self.folder_in(&top, &self.folder).await?;
        table(roots()).insert(key, id.clone());
        Ok(id)
    }

    fn forget_root(&self) {
        table(roots()).remove(&format!("{}\0{}", self.account, self.folder));
    }

    pub async fn list(&self, prefix: &str) -> Result<Vec<String>, String> {
        let root = self.root().await?;
        let want = if prefix.is_empty() { String::new() } else { format!("{prefix}/") };
        let q = format!("{} in parents and trashed = false", quoted(&root));
        let mut newest: HashMap<String, (String, String)> = HashMap::new();
        let mut page: Option<String> = None;
        loop {
            let v = self.query(&q, "nextPageToken,files(id,name,modifiedTime)", None, page.as_deref()).await?;
            for f in v["files"].as_array().map(Vec::as_slice).unwrap_or(&[]) {
                let (Some(id), Some(name)) = (f["id"].as_str(), f["name"].as_str()) else { continue };
                let when = f["modifiedTime"].as_str().unwrap_or("").to_string();
                if newest.get(name).is_none_or(|(w, _)| *w < when) {
                    newest.insert(name.to_string(), (when, id.to_string()));
                }
            }
            page = v["nextPageToken"].as_str().map(String::from);
            if page.is_none() {
                break;
            }
        }
        let mut t = table(ids());
        let mut out = Vec::new();
        for (name, (_, id)) in newest {
            if name.starts_with(&want) {
                out.push(name.clone());
            }
            t.insert(format!("{root}\0{name}"), id);
        }
        Ok(out)
    }

    /// Every id `path` goes by, the latest first.
    async fn named(&self, root: &str, path: &str) -> Result<Vec<String>, String> {
        let q = format!("name = {} and {} in parents and trashed = false", quoted(path), quoted(root));
        let v = self.query(&q, "files(id,modifiedTime)", None, None).await?;
        let mut found: Vec<(String, String)> = v["files"].as_array().map(Vec::as_slice).unwrap_or(&[]).iter().filter_map(|f| Some((f["modifiedTime"].as_str().unwrap_or("").to_string(), f["id"].as_str()?.to_string()))).collect();
        found.sort();
        Ok(found.into_iter().rev().map(|(_, id)| id).collect())
    }

    /// The file's response, to read; none when it is not there.
    pub async fn get(&self, path: &str) -> Result<Option<reqwest::Response>, String> {
        let root = self.root().await?;
        let key = format!("{root}\0{path}");
        // an id from a listing may be of a file since removed: then by name, once
        let known = table(ids()).get(&key).cloned();
        for id in known.into_iter().map(Some).chain([None]) {
            let id = match id {
                Some(id) => id,
                None => match self.named(&root, path).await?.into_iter().next() {
                    Some(id) => id,
                    None => return Ok(None),
                },
            };
            let url = format!("{}/{id}", self.hosts.api);
            let res = call(self.account, false, |token| Ok(http().get(&url).query(&[("alt", "media")]).bearer_auth(token))).await?;
            if res.status().as_u16() != 404 {
                table(ids()).insert(key, id);
                return Ok(Some(res));
            }
            table(ids()).remove(&key);
        }
        Ok(None)
    }

    async fn delete_id(&self, id: &str) -> Result<(), String> {
        let url = format!("{}/{id}", self.hosts.api);
        let res = call(self.account, false, |token| Ok(http().delete(&url).bearer_auth(token))).await?;
        let status = res.status().as_u16();
        if (200..300).contains(&status) || status == 404 {
            Ok(())
        } else {
            Err(said("remove", status, &res.text().await.map_err(err)?))
        }
    }

    pub async fn remove(&self, path: &str) -> Result<(), String> {
        let root = self.root().await?;
        for id in self.named(&root, path).await? {
            self.delete_id(&id).await?;
        }
        table(ids()).remove(&format!("{root}\0{path}"));
        Ok(())
    }

    fn landed(&self, root: &str, path: &str, v: &Value) {
        if let Some(id) = v["id"].as_str() {
            table(ids()).insert(format!("{root}\0{path}"), id.to_string());
        }
    }

    pub async fn write(&self, path: &str, bytes: Vec<u8>) -> Result<(), String> {
        let root = self.root().await?;
        if bytes.len() as u64 > DRIVE_WHOLE {
            return self.send(&root, path, Source::Bytes(Arc::new(bytes)), Arc::new(|_| {})).await;
        }
        let boundary = "ilmi-part-3f9c1e";
        let meta = json!({ "name": path, "parents": [root] }).to_string();
        let mut body = format!("--{boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{meta}\r\n--{boundary}\r\nContent-Type: application/octet-stream\r\n\r\n").into_bytes();
        body.extend_from_slice(&bytes);
        body.extend_from_slice(format!("\r\n--{boundary}--\r\n").as_bytes());
        let url = self.hosts.content.clone();
        let res = call(self.account, true, |token| {
            Ok(http().post(&url).query(&[("uploadType", "multipart"), ("fields", "id")]).bearer_auth(token).header("content-type", format!("multipart/related; boundary={boundary}")).header("content-length", body.len()).body(body.clone()))
        })
        .await;
        let v = self.json(res?, "write").await?;
        self.landed(&root, path, &v);
        Ok(())
    }

    /// The file written as `path`: whole when it is small, in a session otherwise.
    pub async fn upload(&self, path: &str, file: &Path, size: u64, progress: Told) -> Result<(), String> {
        if size <= DRIVE_WHOLE {
            let bytes = std::fs::read(file).map_err(err)?;
            self.write(path, bytes).await?;
            progress(size);
            return Ok(());
        }
        let root = self.root().await?;
        self.send(&root, path, Source::File(file.to_path_buf()), progress).await
    }

    /// A resumable session: Google's guide, step by step.
    async fn send(&self, root: &str, path: &str, src: Source, progress: Told) -> Result<(), String> {
        let size = src.size()?;
        let url = self.hosts.content.clone();
        let meta = json!({ "name": path, "parents": [root] }).to_string();
        let res = call(self.account, false, |token| {
            Ok(http()
                .post(&url)
                .query(&[("uploadType", "resumable"), ("fields", "id")])
                .bearer_auth(token)
                .header("content-type", "application/json; charset=UTF-8")
                .header("x-upload-content-type", "application/octet-stream")
                .header("x-upload-content-length", size)
                .body(meta.clone()))
        })
        .await?;
        if !res.status().is_success() {
            let s = res.status().as_u16();
            return Err(said("send", s, &res.text().await.map_err(err)?));
        }
        let session = res.headers().get("location").and_then(|v| v.to_str().ok()).ok_or("send: no session")?.to_string();
        let mut offset = 0;
        let mut fails = 0;
        let mut ask = false;
        loop {
            let token = oauth::bearer(self.account).await?;
            let req = if ask {
                http().put(&session).bearer_auth(&token).header("content-range", format!("bytes */{size}")).header("content-length", 0)
            } else {
                let len = CHUNK.min(size - offset);
                let p = progress.clone();
                let from = offset;
                http()
                    .put(&session)
                    .bearer_auth(&token)
                    .header("content-range", format!("bytes {offset}-{}/{size}", offset + len - 1))
                    .header("content-length", len)
                    .body(src.body(offset, len, move |n| p(from + n))?)
            };
            let wait;
            match send_long(req).await {
                Ok(res) => {
                    let status = res.status().as_u16();
                    match status {
                        200 | 201 => {
                            let v = self.json(res, "send").await?;
                            self.landed(root, path, &v);
                            return Ok(());
                        }
                        // it has it all and has not said so: asked again, in a moment
                        308 if next_offset(&res) >= size => {
                            if fails >= TRIES {
                                return Err("send: the session did not finish".to_string());
                            }
                            wait = wait_of(None, fails + 1);
                        }
                        308 => {
                            offset = next_offset(&res);
                            fails = 0;
                            ask = false;
                            continue;
                        }
                        401 if fails < TRIES => {
                            fails += 1;
                            oauth::spoil(self.account, &token);
                            continue;
                        }
                        404 => return Err("send: the session ended".to_string()),
                        _ => {
                            wait = wait_of(Some(&res), fails + 1);
                            let body = res.text().await.map_err(err)?;
                            if !(status == 429 || status >= 500 || (status == 403 && rate_limit(&body))) || fails >= TRIES {
                                return Err(said("send", status, &body));
                            }
                        }
                    }
                }
                Err(e) if fails >= TRIES => return Err(e),
                Err(_) => wait = wait_of(None, fails + 1),
            }
            fails += 1;
            pause(wait).await;
            ask = true;
        }
    }
}

/// What a session sends: a file, read as it goes, or bytes already held.
enum Source {
    File(std::path::PathBuf),
    Bytes(Arc<Vec<u8>>),
}

impl Source {
    fn size(&self) -> Result<u64, String> {
        match self {
            Source::File(f) => std::fs::metadata(f).map(|m| m.len()).map_err(err),
            Source::Bytes(b) => Ok(b.len() as u64),
        }
    }

    fn body(&self, offset: u64, len: u64, progress: impl Fn(u64) + Send + Sync + 'static) -> Result<reqwest::Body, String> {
        match self {
            Source::File(file) => {
                let mut f = std::fs::File::open(file).map_err(err)?;
                f.seek(SeekFrom::Start(offset)).map_err(err)?;
                Ok(body_of(f.take(len), progress))
            }
            Source::Bytes(b) => Ok(b[offset as usize..(offset + len) as usize].to_vec().into()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_header_s_json_is_ascii() {
        assert_eq!(header_json(&json!({ "path": "/a" })), r#"{"path":"/a"}"#);
        assert_eq!(header_json(&json!({ "path": "/ل" })), r#"{"path":"/\u0644"}"#);
        assert_eq!(header_json(&json!("𝄞")), r#""\ud834\udd1e""#);
    }

    #[test]
    fn a_query_s_quotes_hold() {
        assert_eq!(quoted(r"quinn's paper\essay"), r"'quinn\'s paper\\essay'");
    }

    #[test]
    fn a_refusal_reads_in_a_line() {
        assert_eq!(said("list", 409, r#"{"error_summary":"path/malformed_path/..."}"#), "list: 409 path/malformed_path");
        assert_eq!(said("send", 403, r#"{"error":{"errors":[{"reason":"storageQuotaExceeded"}]}}"#), "send: 403 storageQuotaExceeded");
        assert_eq!(said("x", 500, "oops"), "x: 500");
    }
}
