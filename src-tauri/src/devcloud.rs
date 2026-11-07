//! Dev only: Dropbox and Google Drive as loopback servers (milestone 64),
//! behind `devstore.rs`'s listener, for the storage smoke and the tests, with
//! no account and no network. Shaped from each service's published guides,
//! and in several places stricter than asked, so that a client that only
//! happens to work here is unlikely:
//!
//! - **Sign-in, both.** The code flow with S256: `authorize` answers `302`
//!   straight off (there is no consent screen); it refuses a redirect the
//!   client has not registered. A code goes once, and only with the verifier
//!   that hashes to its challenge and the same redirect. A token lasts 60
//!   requests (a client with `short` in its name, 5), not hours, so runs go
//!   through refreshes. `revoke` ends a client's tokens: `invalid_grant`.
//! - **Dropbox.** `/dropbox/www`, `/dropbox/api`, `/dropbox/content`, as its
//!   three hosts, and a route on the wrong one is refused. A client's root is
//!   its app folder. Paths are matched without case. `Dropbox-API-Arg` must be
//!   ASCII. `upload` refuses over 150 MiB; a session checks each offset and
//!   says `correct_offset`; its third append lands and the reply is dropped.
//!   `error_summary` ends in a random run of dots, as the service's does.
//!   A listing pages at 500 whatever it asks.
//! - **Drive.** `/drive/…`. Ids are random, and a name is not unique: two
//!   files of one name are two files. `q` is parsed, and what it does not
//!   know is refused; `fields` is obeyed, so a listing that does not ask for
//!   `nextPageToken` does not get it. Each client sees only what it made
//!   (`drive.file`). Pages stop at 400. Multipart refuses over 5 MB. A
//!   resumable session wants non-final chunks in multiples of 256 KiB and
//!   says `308` with `Range`; its third chunk lands and answers `503`.
//! - **Both** refuse one request in 97 as a rate limit: Dropbox `429` with
//!   `Retry-After`, Drive `403 userRateLimitExceeded`.
//!
//! Drive's index is in memory: it lasts as long as the process.

use crate::devstore::{decode, got, inside, receive, respond, Request};
use crate::storage::hex;
use base64::Engine as _;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::{BTreeSet, HashMap};
use std::io::{Read, Write};
use std::net::{Shutdown, TcpStream};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

pub const DROPBOX_KEY: &str = "ilmi-dev-dropbox";
pub const DRIVE_CLIENT: &str = "1234-ilmidev.apps.googleusercontent.com";
pub const DRIVE_SECRET: &str = "ilmi-dev-drive-secret";
const WHOLE: u64 = 150 * 1024 * 1024;
const DRIVE_WHOLE: u64 = 5 * 1000 * 1000;
const ROOT: &str = "root";
const FOLDER: &str = "application/vnd.google-apps.folder";

#[derive(Clone, Copy, PartialEq)]
enum Svc {
    Dropbox,
    Drive,
}

struct Code {
    client: String,
    challenge: String,
    redirect: String,
    offline: bool,
}

struct Token {
    client: String,
    left: u32,
}

struct DbxSession {
    file: PathBuf,
    offset: u64,
    appends: u32,
    dropped: bool,
}

#[derive(Clone)]
struct Obj {
    id: String,
    client: String,
    name: String,
    mime: String,
    parents: Vec<String>,
    created: String,
    modified: String,
}

struct Resumable {
    client: String,
    name: String,
    parents: Vec<String>,
    total: Option<u64>,
    file: PathBuf,
    got: u64,
    chunks: u32,
    failed: bool,
}

#[derive(Default)]
struct Fake {
    codes: HashMap<String, Code>,
    refresh: HashMap<String, String>,
    access: HashMap<String, Token>,
    sessions: HashMap<String, DbxSession>,
    objects: Vec<Obj>,
    uploads: HashMap<String, Resumable>,
    requests: u64,
    last_ms: u64,
    dropbox: DropboxStats,
    drive: DriveStats,
}

#[derive(Default, serde::Serialize, Clone)]
struct DropboxStats {
    sign_ins: u32,
    refreshes: u32,
    expired: u32,
    limited: u32,
    whole: u32,
    largest_whole: u64,
    sessions: u32,
    appends: u32,
    largest_append: u64,
    dropped_replies: u32,
    offsets_said: u32,
    finished: u32,
}

#[derive(Default, serde::Serialize, Clone)]
struct DriveStats {
    sign_ins: u32,
    refreshes: u32,
    expired: u32,
    limited: u32,
    multipart: u32,
    largest_multipart: u64,
    sessions: u32,
    chunks: u32,
    largest_chunk: u64,
    failed_chunks: u32,
    asked: u32,
    finished: u32,
}

fn fake<T>(f: impl FnOnce(&mut Fake) -> T) -> T {
    static F: OnceLock<Mutex<Fake>> = OnceLock::new();
    f(&mut F.get_or_init(Default::default).lock().unwrap_or_else(|e| e.into_inner()))
}

fn rnd(n: usize) -> String {
    let mut b = vec![0u8; n];
    getrandom::fill(&mut b).expect("random");
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(b)
}

/// What the servers have seen, for a smoke to ask.
pub fn stats() -> Value {
    fake(|f| json!({ "dropbox": f.dropbox, "drive": f.drive }))
}

/// Every token of `client` let go.
pub fn revoke(client: &str) {
    fake(|f| {
        f.refresh.retain(|_, c| c != client);
        f.access.retain(|_, t| t.client != client);
    });
}

/// What a browser does with the address it is sent to: the service's answer followed, to the app's listener or as a link.
pub async fn browse(url: String, link: impl FnOnce(String)) -> Result<(), String> {
    use tauri_plugin_http::reqwest;
    let c = reqwest::Client::builder().redirect(reqwest::redirect::Policy::none()).build().map_err(|e| e.to_string())?;
    let res = c.get(&url).send().await.map_err(|e| e.to_string())?;
    if res.status().as_u16() != 302 {
        return Err(format!("authorize: {}", res.status().as_u16()));
    }
    let to = res.headers().get("location").and_then(|v| v.to_str().ok()).ok_or("no location")?.to_string();
    if to.starts_with("http://") {
        c.get(&to).send().await.map_err(|e| e.to_string())?;
    } else {
        link(to);
    }
    Ok(())
}

/// The browser's part in a dev run. A link is told to the window just as the deep-link plugin tells it.
pub fn play_browser(app: tauri::AppHandle, url: String) {
    use tauri::Emitter;
    tauri::async_runtime::spawn(async move {
        let done = browse(url, |to| {
            let _ = app.emit("deep-link://new-url", vec![to]);
        })
        .await;
        if let Err(e) = done {
            log::error!("the dev browser: {e}");
        }
    });
}

fn answer(stream: &mut TcpStream, status: &str, headers: &[(&str, String)], kind: &str, body: &[u8]) -> std::io::Result<()> {
    let mut head = format!("HTTP/1.1 {status}\r\nContent-Type: {kind}\r\nContent-Length: {}\r\nConnection: close\r\n", body.len());
    for (k, v) in headers {
        head.push_str(&format!("{k}: {v}\r\n"));
    }
    head.push_str("\r\n");
    stream.write_all(head.as_bytes())?;
    stream.write_all(body)?;
    stream.flush()
}

fn send_json(stream: &mut TcpStream, status: &str, v: &Value) -> std::io::Result<()> {
    respond(stream, status, "application/json", v.to_string().as_bytes())
}

fn read_body(reader: &mut impl Read, req: &Request) -> std::io::Result<Vec<u8>> {
    let mut b = vec![0u8; req.length.unwrap_or(0) as usize];
    reader.read_exact(&mut b)?;
    Ok(b)
}

fn drain(reader: &mut impl Read, req: &Request) -> std::io::Result<()> {
    std::io::copy(&mut reader.take(req.length.unwrap_or(0)), &mut std::io::sink()).map(|_| ())
}

fn bearer_of(req: &Request) -> Option<String> {
    req.header("authorization").and_then(|a| a.strip_prefix("Bearer ")).map(String::from)
}

/// The client a token is good for, its use counted.
fn client_of(req: &Request, svc: Svc) -> Option<String> {
    let token = bearer_of(req)?;
    fake(|f| {
        let Some(t) = f.access.get_mut(&token) else {
            match svc {
                Svc::Dropbox => f.dropbox.expired += 1,
                Svc::Drive => f.drive.expired += 1,
            }
            return None;
        };
        t.left -= 1;
        let client = t.client.clone();
        if t.left == 0 {
            f.access.remove(&token);
        }
        Some(client)
    })
}

/// Whether this request is the one in 97 turned away. A short client is left alone, for its tests to count.
fn limited(client: &str) -> bool {
    fake(|f| {
        f.requests += 1;
        f.requests % 97 == 0 && !client.contains("short")
    })
}

fn registered(svc: Svc, client: &str, redirect: &str) -> bool {
    match svc {
        // a redirect is matched exactly, as the guide says it is
        Svc::Dropbox => client.starts_with(DROPBOX_KEY) && (redirect == format!("http://localhost:{}/auth", crate::oauth::PORT) || redirect == "ilmi://auth"),
        Svc::Drive => {
            let turned = format!("com.googleusercontent.apps.{}:", client.trim_end_matches(".apps.googleusercontent.com"));
            client.ends_with(".apps.googleusercontent.com") && (redirect.starts_with("http://127.0.0.1:") || redirect.starts_with(&turned))
        }
    }
}

fn authorize(stream: &mut TcpStream, req: &Request, svc: Svc) -> std::io::Result<()> {
    let get = |k: &str| req.query.iter().find(|(q, _)| q == k).map(|(_, v)| v.clone()).unwrap_or_default();
    let (client, redirect, state, challenge) = (get("client_id"), get("redirect_uri"), get("state"), get("code_challenge"));
    let scope = get("scope");
    let scoped = match svc {
        Svc::Dropbox => ["files.metadata.read", "files.content.read", "files.content.write"].iter().all(|s| scope.split(' ').any(|x| x == *s)),
        Svc::Drive => scope == "https://www.googleapis.com/auth/drive.file",
    };
    if get("response_type") != "code" || !registered(svc, &client, &redirect) || get("code_challenge_method") != "S256" || challenge.len() != 43 || !scoped {
        return respond(stream, "400 Bad Request", "text/plain", b"invalid request");
    }
    let offline = match svc {
        Svc::Dropbox => get("token_access_type") == "offline",
        Svc::Drive => get("access_type") == "offline",
    };
    let code = rnd(24);
    fake(|f| f.codes.insert(code.clone(), Code { client, challenge, redirect: redirect.clone(), offline }));
    let e = |s: &str| crate::storage::uri_encode(s, false);
    let to = format!("{redirect}?code={}&state={}", e(&code), e(&state));
    answer(stream, "302 Found", &[("Location", to)], "text/plain", b"")
}

fn oauth_error(stream: &mut TcpStream, what: &str) -> std::io::Result<()> {
    send_json(stream, "400 Bad Request", &json!({ "error": what, "error_description": what }))
}

fn grant(svc: Svc, client: &str) -> (String, u64) {
    let token = rnd(32);
    let left = if client.contains("short") { 5 } else { 60 };
    fake(|f| f.access.insert(token.clone(), Token { client: client.to_string(), left }));
    (token, if svc == Svc::Dropbox { 14_400 } else { 3_599 })
}

fn token(stream: &mut TcpStream, reader: &mut impl Read, req: &Request, svc: Svc) -> std::io::Result<()> {
    let body = read_body(reader, req)?;
    if !req.header("content-type").is_some_and(|c| c.starts_with("application/x-www-form-urlencoded")) {
        return oauth_error(stream, "invalid_request");
    }
    let form: HashMap<String, String> = String::from_utf8_lossy(&body).split('&').filter_map(|kv| kv.split_once('=')).map(|(k, v)| (k.to_string(), decode(&v.replace('+', " ")))).collect();
    let get = |k: &str| form.get(k).map(String::as_str).unwrap_or("");
    match get("grant_type") {
        "authorization_code" => {
            let Some(code) = fake(|f| f.codes.remove(get("code"))) else { return oauth_error(stream, "invalid_grant") };
            let hashed = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(Sha256::digest(get("code_verifier").as_bytes()));
            if hashed != code.challenge || code.redirect != get("redirect_uri") || code.client != get("client_id") {
                return oauth_error(stream, "invalid_grant");
            }
            // a desktop client of Google's shows its secret; a client made for iOS has none (assumed: the guide marks it optional)
            if svc == Svc::Drive && code.redirect.starts_with("http") && get("client_secret") != DRIVE_SECRET {
                return oauth_error(stream, "invalid_client");
            }
            let (access, expires) = grant(svc, &code.client);
            let mut out = json!({ "access_token": access, "token_type": if svc == Svc::Dropbox { "bearer" } else { "Bearer" }, "expires_in": expires });
            if code.offline {
                let refresh = rnd(32);
                fake(|f| f.refresh.insert(refresh.clone(), code.client.clone()));
                out["refresh_token"] = json!(refresh);
            }
            fake(|f| match svc {
                Svc::Dropbox => f.dropbox.sign_ins += 1,
                Svc::Drive => f.drive.sign_ins += 1,
            });
            send_json(stream, "200 OK", &out)
        }
        "refresh_token" => {
            let Some(client) = fake(|f| f.refresh.get(get("refresh_token")).cloned()) else { return oauth_error(stream, "invalid_grant") };
            if client != get("client_id") {
                return oauth_error(stream, "invalid_client");
            }
            let (access, expires) = grant(svc, &client);
            fake(|f| match svc {
                Svc::Dropbox => f.dropbox.refreshes += 1,
                Svc::Drive => f.drive.refreshes += 1,
            });
            send_json(stream, "200 OK", &json!({ "access_token": access, "token_type": "bearer", "expires_in": expires }))
        }
        _ => oauth_error(stream, "unsupported_grant_type"),
    }
}

// ── Dropbox ──────────────────────────────────────────────────────

fn dbx_409(stream: &mut TcpStream, summary: &str, error: Value) -> std::io::Result<()> {
    let dots = ".".repeat(1 + (rnd(1).len() + summary.len()) % 4);
    send_json(stream, "409 Conflict", &json!({ "error_summary": format!("{summary}/{dots}"), "error": error }))
}

fn dbx_path(base: &Path, client: &str, path: &str) -> Option<PathBuf> {
    if !path.starts_with('/') {
        return None;
    }
    inside(&base.join(client), &path.to_lowercase())
}

fn file_meta(path: &str, size: u64) -> Value {
    let lower = path.to_lowercase();
    json!({ ".tag": "file", "name": lower.rsplit('/').next().unwrap_or(""), "path_lower": lower, "path_display": lower, "id": format!("id:{}", &hex(&Sha256::digest(lower.as_bytes()))[..22]), "size": size })
}

fn walk_all(root: &Path, rel: &str, out: &mut BTreeSet<(String, bool)>) {
    let Ok(entries) = std::fs::read_dir(if rel.is_empty() { root.to_path_buf() } else { root.join(rel) }) else { return };
    for e in entries.flatten() {
        let name = e.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') {
            continue;
        }
        let path = if rel.is_empty() { name } else { format!("{rel}/{name}") };
        if e.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            out.insert((path.clone(), true));
            walk_all(root, &path, out);
        } else {
            out.insert((path, false));
        }
    }
}

const LIST_PAGE: usize = 500;

fn listing(stream: &mut TcpStream, base: &Path, client: &str, path: &str, after: &str) -> std::io::Result<()> {
    let Some(dir) = dbx_path(base, client, path) else { return dbx_409(stream, "path/malformed_path", json!({ ".tag": "path" })) };
    if !dir.exists() {
        return dbx_409(stream, "path/not_found", json!({ ".tag": "path", "path": { ".tag": "not_found" } }));
    }
    if !dir.is_dir() {
        return dbx_409(stream, "path/not_folder", json!({ ".tag": "path", "path": { ".tag": "not_folder" } }));
    }
    let mut all = BTreeSet::new();
    walk_all(&dir, "", &mut all);
    let top = path.to_lowercase();
    let rest: Vec<_> = all.into_iter().filter(|(p, _)| p.as_str() > after).collect();
    let more = rest.len() > LIST_PAGE;
    let page = &rest[..rest.len().min(LIST_PAGE)];
    let entries: Vec<Value> = page
        .iter()
        .map(|(p, is_dir)| {
            let full = format!("{top}/{p}");
            if *is_dir {
                json!({ ".tag": "folder", "name": p.rsplit('/').next().unwrap_or(""), "path_lower": full, "path_display": full, "id": "id:folder" })
            } else {
                file_meta(&full, std::fs::metadata(dir.join(p)).map(|m| m.len()).unwrap_or(0))
            }
        })
        .collect();
    let last = page.last().map(|(p, _)| p.as_str()).unwrap_or(after);
    let cursor = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(json!({ "path": path, "after": last }).to_string());
    send_json(stream, "200 OK", &json!({ "entries": entries, "cursor": cursor, "has_more": more }))
}

pub fn dropbox(stream: &mut TcpStream, reader: &mut impl Read, req: &Request, base: &Path, rest: &str) -> std::io::Result<()> {
    if rest == "www/oauth2/authorize" {
        return authorize(stream, req, Svc::Dropbox);
    }
    if rest == "api/oauth2/token" {
        return token(stream, reader, req, Svc::Dropbox);
    }
    let Some(client) = client_of(req, Svc::Dropbox) else {
        drain(reader, req)?;
        let v = json!({ "error_summary": "expired_access_token/..", "error": { ".tag": "expired_access_token" } });
        return respond(stream, "401 Unauthorized", "application/json", v.to_string().as_bytes());
    };
    if limited(&client) {
        drain(reader, req)?;
        fake(|f| f.dropbox.limited += 1);
        let v = json!({ "error_summary": "too_many_requests/.", "error": { "reason": { ".tag": "too_many_requests" } } });
        return answer(stream, "429 Too Many Requests", &[("Retry-After", "1".to_string())], "application/json", v.to_string().as_bytes());
    }
    if let Some(route) = rest.strip_prefix("api/2/") {
        if !req.header("content-type").is_some_and(|c| c.starts_with("application/json")) {
            drain(reader, req)?;
            return respond(stream, "400 Bad Request", "text/plain", b"Error in call: bad Content-Type");
        }
        let body: Value = serde_json::from_slice(&read_body(reader, req)?).unwrap_or(Value::Null);
        return match route {
            "files/list_folder" if body["recursive"] == true => listing(stream, base, &client, body["path"].as_str().unwrap_or(""), ""),
            "files/list_folder/continue" => {
                let raw = base64::engine::general_purpose::URL_SAFE_NO_PAD.decode(body["cursor"].as_str().unwrap_or("")).unwrap_or_default();
                let c: Value = serde_json::from_slice(&raw).unwrap_or(Value::Null);
                listing(stream, base, &client, c["path"].as_str().unwrap_or(""), c["after"].as_str().unwrap_or(""))
            }
            "files/delete_v2" => {
                let path = body["path"].as_str().unwrap_or("");
                let Some(file) = dbx_path(base, &client, path) else { return dbx_409(stream, "path_lookup/malformed_path", json!({ ".tag": "path_lookup" })) };
                if !file.exists() {
                    return dbx_409(stream, "path_lookup/not_found", json!({ ".tag": "path_lookup", "path_lookup": { ".tag": "not_found" } }));
                }
                if file.is_dir() {
                    std::fs::remove_dir_all(&file)?;
                } else {
                    std::fs::remove_file(&file)?;
                }
                send_json(stream, "200 OK", &json!({ "metadata": file_meta(path, 0) }))
            }
            _ => respond(stream, "400 Bad Request", "text/plain", b"Unknown API function"),
        };
    }
    let Some(route) = rest.strip_prefix("content/2/") else {
        drain(reader, req)?;
        return respond(stream, "400 Bad Request", "text/plain", b"wrong host");
    };
    let Some(raw) = req.header("dropbox-api-arg").filter(|a| a.is_ascii()) else {
        drain(reader, req)?;
        return respond(stream, "400 Bad Request", "text/plain", b"Dropbox-API-Arg: not HTTP header safe");
    };
    let Ok(arg) = serde_json::from_str::<Value>(raw) else {
        drain(reader, req)?;
        return respond(stream, "400 Bad Request", "text/plain", b"Dropbox-API-Arg: not JSON");
    };
    if route == "files/download" {
        if req.header("content-type").is_some_and(|c| !c.is_empty()) {
            return respond(stream, "400 Bad Request", "text/plain", b"a download has no Content-Type");
        }
        let path = arg["path"].as_str().unwrap_or("");
        let Some(file) = dbx_path(base, &client, path).filter(|f| f.is_file()) else {
            return dbx_409(stream, "path/not_found", json!({ ".tag": "path", "path": { ".tag": "not_found" } }));
        };
        let mut f = std::fs::File::open(&file)?;
        let len = f.metadata()?.len();
        let result = crate::cloud::header_json(&file_meta(path, len));
        stream.write_all(format!("HTTP/1.1 200 OK\r\nContent-Type: application/octet-stream\r\nContent-Length: {len}\r\nDropbox-API-Result: {result}\r\nConnection: close\r\n\r\n").as_bytes())?;
        std::io::copy(&mut f, stream)?;
        return stream.flush();
    }
    if req.header("content-type") != Some("application/octet-stream") {
        drain(reader, req)?;
        return respond(stream, "400 Bad Request", "text/plain", b"bad Content-Type");
    }
    let length = req.length.unwrap_or(0);
    if length > WHOLE {
        drain(reader, req)?;
        return send_json(stream, "413 Payload Too Large", &json!({ "error_summary": "payload_too_large/...", "error": { ".tag": "payload_too_large" } }));
    }
    let commit = |stream: &mut TcpStream, c: &Value, from: Option<&Path>| -> std::io::Result<Option<u64>> {
        let path = c["path"].as_str().unwrap_or("");
        let Some(dest) = dbx_path(base, &client, path) else {
            dbx_409(stream, "path/malformed_path", json!({ ".tag": "path" }))?;
            return Ok(None);
        };
        if c["mode"] != "overwrite" && dest.exists() {
            dbx_409(stream, "path/conflict/file", json!({ ".tag": "path" }))?;
            return Ok(None);
        }
        std::fs::create_dir_all(dest.parent().unwrap_or(base))?;
        match from {
            Some(f) => std::fs::rename(f, &dest)?,
            None => std::fs::rename(got(&dest), &dest)?,
        }
        let size = std::fs::metadata(&dest)?.len();
        send_json(stream, "200 OK", &file_meta(path, size))?;
        Ok(Some(size))
    };
    match route {
        "files/upload" => {
            let path = arg["path"].as_str().unwrap_or("");
            let Some(dest) = dbx_path(base, &client, path) else {
                drain(reader, req)?;
                return dbx_409(stream, "path/malformed_path", json!({ ".tag": "path" }));
            };
            std::fs::create_dir_all(dest.parent().unwrap_or(base))?;
            receive(reader, length, &dest)?;
            if let Some(size) = commit(stream, &arg, None)? {
                fake(|f| {
                    f.dropbox.whole += 1;
                    f.dropbox.largest_whole = f.dropbox.largest_whole.max(size);
                });
            }
            Ok(())
        }
        "files/upload_session/start" => {
            let id = rnd(16);
            let dir = base.join(".sessions");
            std::fs::create_dir_all(&dir)?;
            let file = dir.join(&id);
            let mut out = std::fs::File::create(&file)?;
            std::io::copy(&mut reader.take(length), &mut out)?;
            fake(|f| {
                f.dropbox.sessions += 1;
                f.sessions.insert(id.clone(), DbxSession { file, offset: length, appends: 0, dropped: false });
            });
            send_json(stream, "200 OK", &json!({ "session_id": id }))
        }
        "files/upload_session/append_v2" => {
            let id = arg["cursor"]["session_id"].as_str().unwrap_or("").to_string();
            let offset = arg["cursor"]["offset"].as_u64().unwrap_or(0);
            let Some((file, at)) = fake(|f| f.sessions.get(&id).map(|s| (s.file.clone(), s.offset))) else {
                drain(reader, req)?;
                return dbx_409(stream, "not_found", json!({ ".tag": "not_found" }));
            };
            if offset != at {
                drain(reader, req)?;
                fake(|f| f.dropbox.offsets_said += 1);
                return dbx_409(stream, "incorrect_offset", json!({ ".tag": "incorrect_offset", "correct_offset": at }));
            }
            let mut out = std::fs::OpenOptions::new().append(true).open(&file)?;
            let n = std::io::copy(&mut reader.take(length), &mut out)?;
            out.sync_all()?;
            if n != length {
                return Ok(());
            }
            let drop_it = fake(|f| {
                f.dropbox.appends += 1;
                f.dropbox.largest_append = f.dropbox.largest_append.max(n);
                let s = f.sessions.get_mut(&id).expect("a session");
                s.offset += n;
                s.appends += 1;
                if s.appends == 3 && !s.dropped {
                    s.dropped = true;
                    f.dropbox.dropped_replies += 1;
                    true
                } else {
                    false
                }
            });
            if drop_it {
                return stream.shutdown(Shutdown::Both);
            }
            send_json(stream, "200 OK", &Value::Null)
        }
        "files/upload_session/finish" => {
            let id = arg["cursor"]["session_id"].as_str().unwrap_or("").to_string();
            let offset = arg["cursor"]["offset"].as_u64().unwrap_or(0);
            let Some((file, at)) = fake(|f| f.sessions.get(&id).map(|s| (s.file.clone(), s.offset))) else {
                drain(reader, req)?;
                return dbx_409(stream, "lookup_failed/not_found", json!({ ".tag": "lookup_failed" }));
            };
            let mut out = std::fs::OpenOptions::new().append(true).open(&file)?;
            std::io::copy(&mut reader.take(length), &mut out)?;
            if offset != at {
                return dbx_409(stream, "lookup_failed/incorrect_offset", json!({ ".tag": "lookup_failed", "lookup_failed": { ".tag": "incorrect_offset", "correct_offset": at } }));
            }
            if commit(stream, &arg["commit"], Some(&file))?.is_some() {
                fake(|f| {
                    f.sessions.remove(&id);
                    f.dropbox.finished += 1;
                });
            }
            Ok(())
        }
        _ => {
            drain(reader, req)?;
            respond(stream, "400 Bad Request", "text/plain", b"Unknown API function")
        }
    }
}

// ── Google Drive ─────────────────────────────────────────────────

fn g_error(stream: &mut TcpStream, status: &str, reason: &str, headers: &[(&str, String)]) -> std::io::Result<()> {
    let code: u16 = status.split(' ').next().and_then(|c| c.parse().ok()).unwrap_or(500);
    let v = json!({ "error": { "code": code, "message": reason, "errors": [{ "domain": "global", "reason": reason, "message": reason }] } });
    answer(stream, status, headers, "application/json; charset=UTF-8", v.to_string().as_bytes())
}

fn stamp() -> String {
    fake(|f| {
        let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0);
        f.last_ms = now.max(f.last_ms + 1);
        let d = crate::storage::amz_date(f.last_ms / 1000);
        format!("{}-{}-{}T{}:{}:{}.{:03}Z", &d[0..4], &d[4..6], &d[6..8], &d[9..11], &d[11..13], &d[13..15], f.last_ms % 1000)
    })
}

fn made(client: &str, name: &str, mime: &str, parents: Vec<String>) -> Obj {
    let when = stamp();
    Obj { id: rnd(24), client: client.to_string(), name: name.to_string(), mime: mime.to_string(), parents, created: when.clone(), modified: when }
}

/// A file of `client` under `parent`, as a test sets one down.
#[cfg(test)]
pub fn seed(client: &str, parent: &str, name: &str) {
    let o = made(client, name, "application/octet-stream", vec![parent.to_string()]);
    fake(|f| f.objects.push(o));
}

/// The ids of what `client` holds under the name, for a test to see.
#[cfg(test)]
pub fn folder_ids(client: &str, name: &str) -> Vec<String> {
    fake(|f| f.objects.iter().filter(|o| o.client == client && o.name == name).map(|o| o.id.clone()).collect())
}

/// One clause of `q`, or `None` for one this does not know.
fn clause(c: &str) -> Option<Box<dyn Fn(&Obj) -> bool>> {
    fn string(s: &str) -> Option<(String, &str)> {
        let s = s.strip_prefix('\'')?;
        let mut out = String::new();
        let mut chars = s.char_indices();
        while let Some((i, c)) = chars.next() {
            match c {
                '\\' => out.push(chars.next()?.1),
                '\'' => return Some((out, &s[i + 1..])),
                c => out.push(c),
            }
        }
        None
    }
    let c = c.trim();
    if c == "trashed = false" {
        return Some(Box::new(|_| true));
    }
    if let Some(rest) = c.strip_prefix("name = ") {
        let (v, tail) = string(rest)?;
        return tail.is_empty().then(|| Box::new(move |o: &Obj| o.name == v) as Box<dyn Fn(&Obj) -> bool>);
    }
    if let Some(rest) = c.strip_prefix("mimeType = ") {
        let (v, tail) = string(rest)?;
        return tail.is_empty().then(|| Box::new(move |o: &Obj| o.mime == v) as Box<dyn Fn(&Obj) -> bool>);
    }
    let (v, tail) = string(c)?;
    (tail == " in parents").then(|| Box::new(move |o: &Obj| o.parents.contains(&v)) as Box<dyn Fn(&Obj) -> bool>)
}

/// `q` split at its `and`s, outside the quotes.
fn clauses(q: &str) -> Vec<String> {
    let mut out = vec![String::new()];
    let mut quoted = false;
    let mut chars = q.chars().peekable();
    let mut rest = q;
    while let Some(c) = chars.next() {
        rest = &rest[c.len_utf8()..];
        if c == '\\' && quoted {
            out.last_mut().unwrap().push(c);
            if let Some(n) = chars.next() {
                rest = &rest[n.len_utf8()..];
                out.last_mut().unwrap().push(n);
            }
            continue;
        }
        if c == '\'' {
            quoted = !quoted;
        }
        if c == ' ' && !quoted && rest.starts_with("and ") {
            for _ in 0..4 {
                let n = chars.next().unwrap();
                rest = &rest[n.len_utf8()..];
            }
            out.push(String::new());
            continue;
        }
        out.last_mut().unwrap().push(c);
    }
    out
}

fn obj_json(o: &Obj, fields: Option<&[&str]>) -> Value {
    let all = json!({ "kind": "drive#file", "id": o.id, "name": o.name, "mimeType": o.mime, "parents": o.parents, "createdTime": o.created, "modifiedTime": o.modified });
    let names: &[&str] = fields.unwrap_or(&["kind", "id", "name", "mimeType"]);
    Value::Object(names.iter().filter_map(|n| all.get(*n).map(|v| (n.to_string(), v.clone()))).collect())
}

const DRIVE_PAGE: usize = 400;

fn drive_list(stream: &mut TcpStream, req: &Request, client: &str) -> std::io::Result<()> {
    let get = |k: &str| req.query.iter().find(|(q, _)| q == k).map(|(_, v)| v.as_str());
    let mut tests = Vec::new();
    for c in clauses(get("q").unwrap_or("")) {
        match clause(&c) {
            Some(t) => tests.push(t),
            None => return g_error(stream, "400 Bad Request", "invalid", &[]),
        }
    }
    let size: usize = get("pageSize").and_then(|v| v.parse().ok()).unwrap_or(100);
    if size == 0 || size > 1000 {
        return g_error(stream, "400 Bad Request", "invalid", &[]);
    }
    let mut found: Vec<Obj> = fake(|f| f.objects.iter().filter(|o| o.client == client && tests.iter().all(|t| t(o))).cloned().collect());
    match get("orderBy") {
        Some("createdTime") => found.sort_by(|a, b| a.created.cmp(&b.created)),
        None => found.sort_by(|a, b| b.id.cmp(&a.id)),
        Some(_) => return g_error(stream, "400 Bad Request", "invalid", &[]),
    }
    let start: usize = get("pageToken").and_then(|v| v.parse().ok()).unwrap_or(0);
    let end = (start + size.min(DRIVE_PAGE)).min(found.len());
    let page = found.get(start..end).unwrap_or(&[]);
    // `fields` is obeyed: nothing is said that was not asked for
    let fields = get("fields");
    let inner: Option<Vec<&str>> = fields.and_then(|f| f.split_once("files(")).map(|(_, r)| r.trim_end_matches(')').split(',').map(str::trim).collect());
    let mut out = json!({ "files": page.iter().map(|o| obj_json(o, inner.as_deref())).collect::<Vec<_>>() });
    if end < found.len() && fields.is_none_or(|f| f.contains("nextPageToken")) {
        out["nextPageToken"] = json!(end.to_string());
    }
    send_json(stream, "200 OK", &out)
}

fn fields_of<'q>(req: &'q Request) -> Option<Vec<&'q str>> {
    req.query.iter().find(|(k, _)| k == "fields").map(|(_, v)| v.split(',').map(str::trim).collect())
}

fn parents_of(meta: &Value) -> Vec<String> {
    match meta["parents"].as_array() {
        Some(p) => p.iter().filter_map(|v| v.as_str().map(String::from)).collect(),
        None => vec![ROOT.to_string()],
    }
}

/// Whether the parents are the client's own, or the top of its Drive.
fn parents_known(client: &str, parents: &[String]) -> bool {
    fake(|f| parents.iter().all(|p| p == ROOT || f.objects.iter().any(|o| o.id == *p && o.client == client)))
}

fn multipart(stream: &mut TcpStream, reader: &mut impl Read, req: &Request, base: &Path, client: &str) -> std::io::Result<()> {
    if req.length.unwrap_or(0) > DRIVE_WHOLE + 4096 {
        drain(reader, req)?;
        return g_error(stream, "413 Request Entity Too Large", "uploadTooLarge", &[]);
    }
    let body = read_body(reader, req)?;
    let Some(boundary) = req.header("content-type").and_then(|c| c.strip_prefix("multipart/related; boundary=")).map(String::from) else {
        return g_error(stream, "400 Bad Request", "badContent", &[]);
    };
    let mark = format!("--{boundary}").into_bytes();
    let find = |from: usize, what: &[u8]| body[from..].windows(what.len()).position(|w| w == what).map(|i| i + from);
    let (Some(a), Some(z)) = (find(0, &mark), body.windows(mark.len()).rposition(|w| w == &mark[..])) else { return g_error(stream, "400 Bad Request", "badContent", &[]) };
    let Some(b) = find(a + 1, &mark).filter(|b| *b < z) else { return g_error(stream, "400 Bad Request", "badContent", &[]) };
    let split = |s: &[u8]| -> Option<(String, Vec<u8>)> {
        let at = s.windows(4).position(|w| w == b"\r\n\r\n")?;
        let tail = &s[at + 4..];
        Some((String::from_utf8_lossy(&s[..at]).to_lowercase(), tail[..tail.len() - 2].to_vec()))
    };
    let (Some((head1, meta)), Some((_, media))) = (split(&body[a + mark.len()..b]), split(&body[b + mark.len()..z])) else { return g_error(stream, "400 Bad Request", "badContent", &[]) };
    if !head1.contains("application/json") {
        return g_error(stream, "400 Bad Request", "badContent", &[]);
    }
    let meta: Value = serde_json::from_slice(&meta).unwrap_or(Value::Null);
    let parents = parents_of(&meta);
    if media.len() as u64 > DRIVE_WHOLE {
        return g_error(stream, "413 Request Entity Too Large", "uploadTooLarge", &[]);
    }
    if !parents_known(client, &parents) {
        return g_error(stream, "404 Not Found", "notFound", &[]);
    }
    let o = made(client, meta["name"].as_str().unwrap_or("Untitled"), "application/octet-stream", parents);
    std::fs::create_dir_all(base.join("objects"))?;
    std::fs::write(base.join("objects").join(&o.id), &media)?;
    let out = obj_json(&o, fields_of(req).as_deref());
    fake(|f| {
        f.drive.multipart += 1;
        f.drive.largest_multipart = f.drive.largest_multipart.max(media.len() as u64);
        f.objects.push(o);
    });
    send_json(stream, "200 OK", &out)
}

fn resumable_put(stream: &mut TcpStream, reader: &mut impl Read, req: &Request, base: &Path, id: &str) -> std::io::Result<()> {
    let Some((file, at, total)) = fake(|f| f.uploads.get(id).map(|u| (u.file.clone(), u.got, u.total))) else {
        drain(reader, req)?;
        return g_error(stream, "404 Not Found", "notFound", &[]);
    };
    let range = req.header("content-range").unwrap_or("").strip_prefix("bytes ").unwrap_or("").to_string();
    let Some((span, whole)) = range.split_once('/') else {
        drain(reader, req)?;
        return g_error(stream, "400 Bad Request", "badContent", &[]);
    };
    let whole: u64 = whole.parse().unwrap_or(total.unwrap_or(0));
    if total.is_some_and(|t| t != whole) {
        drain(reader, req)?;
        return g_error(stream, "400 Bad Request", "badContent", &[]);
    }
    let incomplete = |stream: &mut TcpStream, at: u64| {
        let headers: Vec<(&str, String)> = if at > 0 { vec![("Range", format!("bytes=0-{}", at - 1))] } else { Vec::new() };
        answer(stream, "308 Resume Incomplete", &headers, "text/plain", b"")
    };
    if span == "*" {
        fake(|f| f.drive.asked += 1);
        // a session that had all of it is done, whatever the last chunk answered
        return if at == whole { resumable_done(stream, req, base, id) } else { incomplete(stream, at) };
    }
    let Some((a, z)) = span.split_once('-').and_then(|(a, z)| Some((a.parse::<u64>().ok()?, z.parse::<u64>().ok()?))) else {
        drain(reader, req)?;
        return g_error(stream, "400 Bad Request", "badContent", &[]);
    };
    let length = req.length.unwrap_or(0);
    let last = z + 1 == whole;
    // a chunk starts where the server is, says its own length, and all but the last are multiples of 256 KiB
    if a != at || z + 1 - a != length || (!last && length % (256 * 1024) != 0) {
        drain(reader, req)?;
        return g_error(stream, "400 Bad Request", "badContent", &[]);
    }
    let mut out = std::fs::OpenOptions::new().append(true).open(&file)?;
    let n = std::io::copy(&mut reader.take(length), &mut out)?;
    out.sync_all()?;
    let (fail, now) = fake(|f| {
        let u = f.uploads.get_mut(id).expect("a session");
        u.got += n;
        u.chunks += 1;
        let fail = u.chunks == 3 && !u.failed;
        if fail {
            u.failed = true;
        }
        let now = u.got;
        f.drive.chunks += 1;
        f.drive.largest_chunk = f.drive.largest_chunk.max(n);
        if fail {
            f.drive.failed_chunks += 1;
        }
        (fail, now)
    });
    if fail {
        return g_error(stream, "503 Service Unavailable", "backendError", &[]);
    }
    if now < whole {
        return incomplete(stream, now);
    }
    resumable_done(stream, req, base, id)
}

fn resumable_done(stream: &mut TcpStream, req: &Request, base: &Path, id: &str) -> std::io::Result<()> {
    let u = fake(|f| f.uploads.remove(id)).expect("a session");
    let o = made(&u.client, &u.name, "application/octet-stream", u.parents);
    std::fs::create_dir_all(base.join("objects"))?;
    std::fs::rename(&u.file, base.join("objects").join(&o.id))?;
    let out = obj_json(&o, fields_of(req).as_deref());
    fake(|f| {
        f.drive.finished += 1;
        f.objects.push(o);
    });
    send_json(stream, "200 OK", &out)
}

pub fn drive(stream: &mut TcpStream, reader: &mut impl Read, req: &Request, base: &Path, rest: &str) -> std::io::Result<()> {
    if rest == "accounts/o/oauth2/v2/auth" {
        return authorize(stream, req, Svc::Drive);
    }
    if rest == "oauth2/token" {
        return token(stream, reader, req, Svc::Drive);
    }
    let Some(client) = client_of(req, Svc::Drive) else {
        drain(reader, req)?;
        return g_error(stream, "401 Unauthorized", "authError", &[("WWW-Authenticate", "Bearer".to_string())]);
    };
    if limited(&client) {
        drain(reader, req)?;
        fake(|f| f.drive.limited += 1);
        return g_error(stream, "403 Forbidden", "userRateLimitExceeded", &[]);
    }
    let get = |k: &str| req.query.iter().find(|(q, _)| q == k).map(|(_, v)| v.as_str());
    if rest == "api/upload/drive/v3/files" {
        if let Some(id) = get("upload_id") {
            if req.method != "PUT" {
                drain(reader, req)?;
                return g_error(stream, "400 Bad Request", "badRequest", &[]);
            }
            return resumable_put(stream, reader, req, base, id);
        }
        if req.method != "POST" {
            drain(reader, req)?;
            return g_error(stream, "405 Method Not Allowed", "badRequest", &[]);
        }
        return match get("uploadType") {
            Some("multipart") => multipart(stream, reader, req, base, &client),
            Some("resumable") => {
                let meta: Value = serde_json::from_slice(&read_body(reader, req)?).unwrap_or(Value::Null);
                let parents = parents_of(&meta);
                if !parents_known(&client, &parents) {
                    return g_error(stream, "404 Not Found", "notFound", &[]);
                }
                let id = rnd(20);
                let dir = base.join("sessions");
                std::fs::create_dir_all(&dir)?;
                let file = dir.join(&id);
                std::fs::File::create(&file)?;
                let total = req.header("x-upload-content-length").and_then(|v| v.parse().ok());
                let name = meta["name"].as_str().unwrap_or("Untitled").to_string();
                fake(|f| {
                    f.drive.sessions += 1;
                    f.uploads.insert(id.clone(), Resumable { client: client.clone(), name, parents, total, file, got: 0, chunks: 0, failed: false });
                });
                let fields = get("fields").map(|v| format!("&fields={v}")).unwrap_or_default();
                let at = format!("http://{}/drive/api/upload/drive/v3/files?uploadType=resumable&upload_id={id}{fields}", req.header("host").unwrap_or(""));
                answer(stream, "200 OK", &[("Location", at)], "text/plain", b"")
            }
            _ => {
                drain(reader, req)?;
                g_error(stream, "400 Bad Request", "badRequest", &[])
            }
        };
    }
    let Some(rest) = rest.strip_prefix("api/drive/v3/files") else {
        drain(reader, req)?;
        return respond(stream, "404 Not Found", "text/plain", b"");
    };
    let id = rest.trim_start_matches('/');
    if id.is_empty() {
        return match req.method.as_str() {
            "GET" => drive_list(stream, req, &client),
            "POST" => {
                let meta: Value = serde_json::from_slice(&read_body(reader, req)?).unwrap_or(Value::Null);
                let parents = parents_of(&meta);
                if !parents_known(&client, &parents) {
                    return g_error(stream, "404 Not Found", "notFound", &[]);
                }
                let o = made(&client, meta["name"].as_str().unwrap_or("Untitled"), meta["mimeType"].as_str().unwrap_or("application/octet-stream"), parents);
                let out = obj_json(&o, fields_of(req).as_deref());
                fake(|f| f.objects.push(o));
                send_json(stream, "200 OK", &out)
            }
            _ => g_error(stream, "405 Method Not Allowed", "badRequest", &[]),
        };
    }
    let Some(o) = fake(|f| f.objects.iter().find(|o| o.id == id && o.client == client).cloned()) else { return g_error(stream, "404 Not Found", "notFound", &[]) };
    match req.method.as_str() {
        "GET" if get("alt") == Some("media") => {
            if o.mime == FOLDER {
                return g_error(stream, "403 Forbidden", "fileNotDownloadable", &[]);
            }
            crate::devstore::send_file(stream, &base.join("objects").join(&o.id))
        }
        "GET" => send_json(stream, "200 OK", &obj_json(&o, fields_of(req).as_deref())),
        "DELETE" => {
            let _ = std::fs::remove_file(base.join("objects").join(&o.id));
            // a folder's children go with it, as they do
            fake(|f| f.objects.retain(|x| x.id != o.id && !x.parents.contains(&o.id)));
            respond(stream, "204 No Content", "text/plain", b"")
        }
        _ => g_error(stream, "405 Method Not Allowed", "badRequest", &[]),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::devstore::tests::{block, scratch, server, verbs};
    use crate::oauth::{self, Service, SignIn};
    use crate::storage::{self, Config};
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::sync::{Arc, Once};

    /// One sign-in at a time: there is one port and one slot.
    static ONE: Mutex<()> = Mutex::new(());
    /// The tests that count what the servers saw, each alone among those that send in sessions.
    static COUNTED: Mutex<()> = Mutex::new(());

    fn keep_tokens() {
        static ONCE: Once = Once::new();
        ONCE.call_once(|| oauth::keep_in(scratch("tokens")));
    }

    fn sign_in(service: Service, client: &str, link: bool) -> String {
        keep_tokens();
        let _one = ONE.lock().unwrap_or_else(|e| e.into_inner());
        let s = SignIn { service, client: client.into(), secret: if service == Service::Drive { DRIVE_SECRET.into() } else { String::new() }, account: None, link, dev: Some(server()) };
        block(oauth::sign_in(s, |url| {
            tauri::async_runtime::spawn(async move {
                browse(url, |to| assert!(oauth::back(&to), "a link is taken")).await.unwrap();
            });
            Ok(())
        }))
        .unwrap()
    }

    fn dropbox(folder: &str) -> Config {
        Config::Dropbox { account: sign_in(Service::Dropbox, DROPBOX_KEY, false), folder: folder.into() }
    }

    fn drive(folder: &str) -> Config {
        Config::Drive { account: sign_in(Service::Drive, DRIVE_CLIENT, false), folder: folder.into() }
    }

    #[test]
    fn the_four_verbs_over_dropbox_and_drive() {
        verbs("dropbox", &dropbox("verbs"));
        verbs("drive", &drive("verbs"));
        // a folder's name is the person's: not ASCII, not free of quotes
        verbs("dropbox", &dropbox("دفتر it's"));
        verbs("drive", &drive("دفتر it's"));
    }

    #[test]
    fn a_sign_in_comes_back_by_a_link_as_well() {
        verbs("dropbox", &Config::Dropbox { account: sign_in(Service::Dropbox, DROPBOX_KEY, true), folder: "link".into() });
        // Drive's client turned round, and no secret: a client made for iOS
        let _one = ONE.lock().unwrap_or_else(|e| e.into_inner());
        let s = SignIn { service: Service::Drive, client: DRIVE_CLIENT.into(), secret: String::new(), account: None, link: true, dev: Some(server()) };
        let account = block(oauth::sign_in(s, |url| {
            tauri::async_runtime::spawn(async move {
                browse(url, |to| {
                    assert!(to.starts_with("com.googleusercontent.apps.1234-ilmidev:/oauth2redirect?"), "{to}");
                    assert!(!oauth::back("ilmi://auth?code=x&state=not-the-state"), "a link with another state is nobody's");
                    assert!(oauth::back(&to));
                })
                .await
                .unwrap();
            });
            Ok(())
        }))
        .unwrap();
        drop(_one);
        verbs("drive", &Config::Drive { account, folder: "link".into() });
    }

    #[test]
    fn a_token_is_kept_where_only_this_user_reads_it() {
        keep_tokens();
        let account = sign_in(Service::Dropbox, DROPBOX_KEY, false);
        let e = oauth::entry(&account).unwrap();
        let file = scratch_tokens();
        let raw = std::fs::read_to_string(&file).unwrap();
        assert!(raw.contains(&e.refresh) && raw.contains(&account));
        use std::os::unix::fs::PermissionsExt;
        assert_eq!(std::fs::metadata(&file).unwrap().permissions().mode() & 0o777, 0o600);
    }

    fn scratch_tokens() -> PathBuf {
        std::env::temp_dir().join(format!("ilmi-devstore-tokens-{}", std::process::id())).join("oauth.json")
    }

    #[test]
    fn tokens_run_out_and_are_refreshed_and_a_revoked_sign_in_says_so() {
        for (kind, service, client) in [("dropbox", Service::Dropbox, "ilmi-dev-dropbox-short"), ("drive", Service::Drive, "5678-short.apps.googleusercontent.com")] {
            let account = sign_in(service, client, false);
            let cfg = match service {
                Service::Dropbox => Config::Dropbox { account: account.clone(), folder: "short".into() },
                Service::Drive => Config::Drive { account: account.clone(), folder: "short".into() },
            };
            let was = stats()[kind]["refreshes"].as_u64().unwrap();
            verbs(kind, &cfg);
            assert!(stats()[kind]["refreshes"].as_u64().unwrap() >= was + 2, "{kind}: refreshed along the way");
            revoke(client);
            let e = block(storage::list(&cfg, "")).unwrap_err();
            assert_eq!(e, oauth::GONE, "{kind}");
            assert!(!oauth::signed_in(&account), "{kind}: the sign-in is gone");
            assert_eq!(block(storage::read(&cfg, "format")).unwrap_err(), oauth::GONE, "{kind}: and stays gone");
        }
    }

    /// A file that does not repeat by the megabyte, on disk, and its hash; large ones as one megabyte over and over with a counter in it.
    fn make_file(dir: &Path, name: &str, size: u64) -> (PathBuf, String) {
        let path = dir.join(name);
        let mut f = std::fs::File::create(&path).unwrap();
        let mut h = Sha256::new();
        let mut block: Vec<u8> = (0..1_048_573u32).map(|i| (i.wrapping_mul(2_654_435_761) >> 24) as u8).collect();
        let mut left = size;
        let mut n = 0u32;
        while left > 0 {
            block[..4].copy_from_slice(&n.to_le_bytes());
            let take = left.min(block.len() as u64) as usize;
            f.write_all(&block[..take]).unwrap();
            h.update(&block[..take]);
            left -= take as u64;
            n += 1;
        }
        (path, hex(&h.finalize()))
    }

    fn up_and_down(kind: &str, cfg: &Config, dir: &Path, size: u64) {
        let (src, sha) = make_file(dir, &format!("{kind}-{size}"), size);
        let told = Arc::new(AtomicU64::new(0));
        let t = told.clone();
        block(storage::upload(cfg, &format!("blobs/{sha}"), &src, &sha, move |n| t.store(n, Ordering::Relaxed))).unwrap_or_else(|e| panic!("{kind}: {e}"));
        assert_eq!(told.load(Ordering::Relaxed), size, "{kind}: all of it told");
        assert_eq!(block(storage::list(cfg, "blobs/")).unwrap(), vec![format!("blobs/{sha}")], "{kind}: listed");
        let back = block(storage::download(cfg, &format!("blobs/{sha}"), &dir.join(format!("{kind}-down")), |_, _| {})).unwrap();
        assert_eq!(back, Some((sha.clone(), size)), "{kind}: the same bytes came down");
        block(storage::remove(cfg, &format!("blobs/{sha}"))).unwrap();
    }

    #[test]
    fn a_small_file_goes_whole() {
        let dir = scratch("small");
        let was = stats();
        up_and_down("dropbox", &dropbox("small"), &dir, 5_000_003);
        up_and_down("drive", &drive("small"), &dir, 3_000_017);
        let now = stats();
        assert!(now["dropbox"]["whole"].as_u64() > was["dropbox"]["whole"].as_u64());
        assert!(now["drive"]["multipart"].as_u64() > was["drive"]["multipart"].as_u64());
    }

    #[test]
    fn a_file_over_150_mib_goes_to_dropbox_in_parts_and_a_lost_reply_is_put_right() {
        let _counted = COUNTED.lock().unwrap_or_else(|e| e.into_inner());
        let dir = scratch("parts");
        let cfg = dropbox("parts");
        let was = stats()["dropbox"].clone();
        up_and_down("dropbox", &cfg, &dir, 150 * 1024 * 1024 + 4097);
        let now = stats()["dropbox"].clone();
        let grew = |k: &str| now[k].as_u64().unwrap() - was[k].as_u64().unwrap();
        assert_eq!(grew("sessions"), 1);
        assert_eq!(grew("finished"), 1);
        assert!(grew("appends") >= 10, "{now}");
        assert!(now["largest_append"].as_u64().unwrap() <= crate::cloud::CHUNK);
        assert_eq!(grew("dropped_replies"), 1, "the third append's reply was lost");
        assert_eq!(grew("offsets_said"), 1, "and the session said where it stood");
        // exactly at the limit it is one upload
        let was = stats()["dropbox"].clone();
        up_and_down("dropbox", &cfg, &dir, 150 * 1024 * 1024);
        let now = stats()["dropbox"].clone();
        assert_eq!(now["sessions"], was["sessions"]);
        assert_eq!(now["largest_whole"].as_u64().unwrap(), 150 * 1024 * 1024);
    }

    #[test]
    fn a_large_file_goes_to_drive_in_a_session_and_a_failed_chunk_is_asked_after() {
        let _counted = COUNTED.lock().unwrap_or_else(|e| e.into_inner());
        let dir = scratch("session");
        let cfg = drive("session");
        let was = stats()["drive"].clone();
        up_and_down("drive", &cfg, &dir, 40 * 1024 * 1024 + 7);
        let now = stats()["drive"].clone();
        let grew = |k: &str| now[k].as_u64().unwrap() - was[k].as_u64().unwrap();
        assert_eq!(grew("sessions"), 1);
        assert_eq!(grew("finished"), 1);
        assert_eq!(grew("chunks"), 3);
        assert_eq!(grew("failed_chunks"), 1, "the third chunk answered 503");
        assert_eq!(grew("asked"), 1, "and the session was asked how far it had got");
        // a write over the multipart limit goes the same way
        block(storage::write(&cfg, "devices/big/1", vec![7u8; 6_000_000])).unwrap();
        assert_eq!(block(storage::read(&cfg, "devices/big/1")).unwrap().map(|b| b.len()), Some(6_000_000));
    }

    #[test]
    fn drive_s_names_are_not_unique_and_its_ids_are_not_paths() {
        let cfg = drive("twice");
        block(async {
            storage::write(&cfg, "devices/d/1", b"first".to_vec()).await.unwrap();
            storage::write(&cfg, "devices/d/1", b"later".to_vec()).await.unwrap();
            assert_eq!(folder_ids(DRIVE_CLIENT, "devices/d/1").len() >= 2, true, "two files of one name");
            assert_eq!(storage::list(&cfg, "devices/").await.unwrap(), vec!["devices/d/1".to_string()], "one path");
            assert_eq!(storage::read(&cfg, "devices/d/1").await.unwrap().as_deref(), Some(&b"later"[..]), "the later is the file");
            storage::remove(&cfg, "devices/d/1").await.unwrap();
            assert_eq!(storage::list(&cfg, "").await.unwrap(), Vec::<String>::new(), "both are gone");
            assert_eq!(storage::read(&cfg, "devices/d/1").await.unwrap(), None);
        });
        // a second sign-in, a second device: it finds the folder by name and the files by listing or by name
        let a = drive("shared");
        let b = drive("shared");
        block(storage::write(&a, "format", b"x\n".to_vec())).unwrap();
        assert_eq!(block(storage::read(&b, "format")).unwrap().as_deref(), Some(&b"x\n"[..]));
        // another client's files are not seen, whatever the folder is called
        let other = Config::Drive { account: sign_in(Service::Drive, "999-other.apps.googleusercontent.com", false), folder: "shared".into() };
        assert_eq!(block(storage::list(&other, "")).unwrap(), Vec::<String>::new());
    }

    #[test]
    fn a_long_listing_comes_a_page_at_a_time() {
        let cfg = drive("pages");
        block(storage::write(&cfg, "format", b"x".to_vec())).unwrap();
        let root = {
            // the folder the collection is, by what the service holds
            let ids = folder_ids(DRIVE_CLIENT, "pages");
            assert_eq!(ids.len(), 1);
            ids[0].clone()
        };
        for i in 0..1203 {
            seed(DRIVE_CLIENT, &root, &format!("devices/d/{i}"));
        }
        assert_eq!(block(storage::list(&cfg, "devices/")).unwrap().len(), 1203);
        // Dropbox's, on disk
        let cfg = dropbox("pages");
        block(storage::write(&cfg, "format", b"x".to_vec())).unwrap();
        let (url, dir) = (server(), crate::devstore::folder());
        assert!(url.starts_with("http://127.0.0.1:"));
        let d = dir.join("dropbox").join(DROPBOX_KEY).join("pages/devices/d");
        std::fs::create_dir_all(&d).unwrap();
        for i in 0..1203 {
            std::fs::write(d.join(i.to_string()), b"x").unwrap();
        }
        assert_eq!(block(storage::list(&cfg, "devices/")).unwrap().len(), 1203);
    }

    #[test]
    fn a_rate_limit_is_waited_out() {
        let cfg = dropbox("busy");
        let gcfg = drive("busy");
        let was = stats();
        let mut left = 400;
        while left > 0 && (stats()["dropbox"]["limited"] == was["dropbox"]["limited"] || stats()["drive"]["limited"] == was["drive"]["limited"]) {
            block(storage::write(&cfg, "format", b"x".to_vec())).unwrap();
            block(storage::write(&gcfg, "format", b"x".to_vec())).unwrap();
            left -= 1;
        }
        assert!(left > 0, "both were turned away and neither write failed");
        assert_eq!(block(storage::read(&cfg, "format")).unwrap().as_deref(), Some(&b"x"[..]));
    }

    #[test]
    fn the_servers_refuse_what_their_services_refuse() {
        let _counted = COUNTED.lock().unwrap_or_else(|e| e.into_inner());
        use tauri_plugin_http::reqwest;
        let url = server();
        block(async {
            let c = reqwest::Client::builder().redirect(reqwest::redirect::Policy::none()).build().unwrap();
            let auth = |client: &str, redirect: &str, method: &str| {
                let e = |s: &str| crate::storage::uri_encode(s, false);
                format!("{url}/dropbox/www/oauth2/authorize?client_id={}&response_type=code&redirect_uri={}&state=s&code_challenge={}&code_challenge_method={method}&scope={}", e(client), e(redirect), "a".repeat(43), e("files.metadata.read files.content.read files.content.write"))
            };
            let code = |u: String| { let c = c.clone(); async move { c.get(u).send().await.unwrap().status().as_u16() } };
            assert_eq!(code(auth(DROPBOX_KEY, "ilmi://auth", "S256")).await, 302);
            assert_eq!(code(auth(DROPBOX_KEY, "http://localhost:9/auth", "S256")).await, 400, "a redirect not registered");
            assert_eq!(code(auth("someone", "ilmi://auth", "S256")).await, 400, "an app not known");
            assert_eq!(code(auth(DROPBOX_KEY, "ilmi://auth", "plain")).await, 400);
            // a code goes with its verifier, and once
            let res = c.get(auth(DROPBOX_KEY, "ilmi://auth", "S256")).send().await.unwrap();
            let to = res.headers()["location"].to_str().unwrap().to_string();
            let the = to.split("code=").nth(1).unwrap().split('&').next().unwrap().to_string();
            let res = c.post(format!("{url}/dropbox/api/oauth2/token")).header("content-type", "application/x-www-form-urlencoded").body(format!("grant_type=authorization_code&code={the}&client_id={DROPBOX_KEY}&redirect_uri=ilmi%3A%2F%2Fauth&code_verifier=wrong")).send().await.unwrap();
            assert_eq!(res.status().as_u16(), 400);
            assert!(res.text().await.unwrap().contains("invalid_grant"));
            // a route on the wrong host, a token nobody gave
            let res = c.post(format!("{url}/dropbox/api/2/files/upload")).bearer_auth("nobody").header("content-type", "application/octet-stream").body("x").send().await.unwrap();
            assert_eq!(res.status().as_u16(), 401);
            let res = c.get(format!("{url}/drive/api/drive/v3/files")).bearer_auth("nobody").send().await.unwrap();
            assert_eq!(res.status().as_u16(), 401);
        });
        let (Config::Dropbox { account, .. }, Config::Drive { account: gaccount, .. }) = (dropbox("refusals"), drive("refusals")) else { panic!() };
        block(async {
            let t = oauth::bearer(&account).await.unwrap();
            let c = reqwest::Client::new();
            // not ASCII in the header's JSON
            let res = c.post(format!("{url}/dropbox/content/2/files/upload")).bearer_auth(&t).header("dropbox-api-arg", reqwest::header::HeaderValue::from_bytes("{\"path\":\"/é\"}".as_bytes()).unwrap()).header("content-type", "application/octet-stream").body("x").send().await;
            assert!(res.map(|r| r.status().as_u16() == 400).unwrap_or(true));
            let res = c.post(format!("{url}/dropbox/api/2/files/upload")).bearer_auth(&t).header("content-type", "application/json").body("{}").send().await.unwrap();
            assert_eq!(res.status().as_u16(), 400, "the content host's route on the API host");
            let t = oauth::bearer(&gaccount).await.unwrap();
            let q = |q: &str, fields: &str| {
                let c = c.clone();
                let (u, t, q, fields) = (format!("{url}/drive/api/drive/v3/files"), t.clone(), q.to_string(), fields.to_string());
                async move { c.get(u).bearer_auth(t).query(&[("q", q.as_str()), ("fields", fields.as_str())]).send().await.unwrap().status().as_u16() }
            };
            assert_eq!(q("name contains 'x'", "files(id)").await, 400, "a clause this client does not use");
            assert_eq!(q("name = 'it\\'s' and 'root' in parents and trashed = false", "files(id)").await, 200);
            // a multipart over the limit, a chunk not a multiple
            let meta = json!({ "name": "n", "parents": ["root"] }).to_string();
            let res = c.post(format!("{url}/drive/api/upload/drive/v3/files?uploadType=resumable")).bearer_auth(&t).header("content-type", "application/json; charset=UTF-8").header("x-upload-content-length", 1_000_000).body(meta).send().await.unwrap();
            let at = res.headers()["location"].to_str().unwrap().to_string();
            let res = c.put(&at).bearer_auth(&t).header("content-range", "bytes 0-999/1000000").body(vec![0u8; 1000]).send().await.unwrap();
            assert_eq!(res.status().as_u16(), 400, "a chunk that is not a multiple of 256 KiB");
        });
    }

    /// The same checks against the real thing, when the environment names it:
    /// `ILMI_TEST_DROPBOX=<app key>,<refresh token>,<folder>` and
    /// `ILMI_TEST_DRIVE=<client id>,<client secret>,<refresh token>,<folder>`,
    /// the refresh token read from `oauth.json` after a sign-in in the app, the
    /// folder empty or not there yet. What they write is removed again. With
    /// neither set this checks nothing.
    #[test]
    fn a_service_the_environment_names() {
        let mut named: Vec<(&'static str, Config)> = Vec::new();
        if let Ok(v) = std::env::var("ILMI_TEST_DROPBOX") {
            let f: Vec<&str> = v.splitn(3, ',').collect();
            assert_eq!(f.len(), 3, "ILMI_TEST_DROPBOX=app key,refresh token,folder");
            let account = oauth::adopt(oauth::Entry { service: Service::Dropbox, client: f[0].into(), secret: String::new(), refresh: f[1].into(), dev: None });
            named.push(("dropbox", Config::Dropbox { account, folder: f[2].into() }));
        }
        if let Ok(v) = std::env::var("ILMI_TEST_DRIVE") {
            let f: Vec<&str> = v.splitn(4, ',').collect();
            assert_eq!(f.len(), 4, "ILMI_TEST_DRIVE=client id,client secret,refresh token,folder");
            let account = oauth::adopt(oauth::Entry { service: Service::Drive, client: f[0].into(), secret: f[1].into(), refresh: f[2].into(), dev: None });
            named.push(("drive", Config::Drive { account, folder: f[3].into() }));
        }
        let dir = scratch("named");
        for (kind, cfg) in named {
            verbs(kind, &cfg);
            up_and_down(kind, &cfg, &dir, 20 * 1024 * 1024 + 11);
            block(async {
                for path in storage::list(&cfg, "").await.unwrap() {
                    storage::remove(&cfg, &path).await.unwrap();
                }
            });
        }
    }
}
