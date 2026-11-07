//! Dev only: small servers on the loopback, one shaped like an S3 bucket and
//! one like a WebDAV folder, for the storage smoke (milestone 63), so two
//! collections can sync through each with no network and no account; since
//! 64 Dropbox's and Google Drive's are here too (`devcloud.rs`). One listener
//! serves them all over a folder on disk:
//!
//! - `/s3/<bucket>/<key>`: `PUT`, `GET`, `DELETE`, and `GET
//!   /s3/<bucket>?list-type=2&prefix=…` answered as S3's XML, a thousand
//!   keys a page (or `max-keys`) with a continuation token. Every request
//!   must be signed by Signature Version 4 with the dev key, and a body
//!   must hash to what its header says, as S3 holds a client to.
//! - `/dav/…`: `PROPFIND` (depth 1), `MKCOL`, `PUT`, `GET`, `DELETE`,
//!   with basic auth. A `PUT` into a folder that is not there is refused
//!   with 409, as a real server refuses it.
//!
//! A body is written to its file as it arrives and a file is sent as it is
//! read, so a 200 MB PDF is never held here whole. One request a
//! connection.

use crate::storage::{hex, signature, Signed};
use base64::Engine as _;
use sha2::{Digest, Sha256};
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

pub const KEY: &str = "ilmi-dev-key";
pub const SECRET: &str = "ilmi-dev-secret-0123456789";
pub const BUCKET: &str = "ilmi";
pub const USER: &str = "ilmi";
pub const PASSWORD: &str = "dev-password";

static SERVER: OnceLock<(String, PathBuf)> = OnceLock::new();

/// The folder the running server is over (the tests set files down in it).
#[cfg(test)]
pub fn folder() -> PathBuf {
    SERVER.get().expect("a server").1.clone()
}

/// Start the server over `root` if it is not running; its address either way (the first root stands).
pub fn serve(root: &Path) -> Result<String, String> {
    if let Some((url, _)) = SERVER.get() {
        return Ok(url.clone());
    }
    std::fs::create_dir_all(root.join("s3").join(BUCKET)).map_err(|e| e.to_string())?;
    std::fs::create_dir_all(root.join("dav")).map_err(|e| e.to_string())?;
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    let dir = root.to_path_buf();
    std::thread::spawn(move || {
        for stream in listener.incoming().flatten() {
            let dir = dir.clone();
            std::thread::spawn(move || {
                let _ = handle(stream, &dir);
            });
        }
    });
    Ok(SERVER.get_or_init(|| (format!("http://127.0.0.1:{port}"), root.to_path_buf())).0.clone())
}

pub struct Request {
    pub method: String,
    /// The path as it was sent, still encoded.
    pub raw_path: String,
    pub query: Vec<(String, String)>,
    pub headers: Vec<(String, String)>,
    pub length: Option<u64>,
}

impl Request {
    pub fn header(&self, name: &str) -> Option<&str> {
        self.headers.iter().find(|(k, _)| k == name).map(|(_, v)| v.as_str())
    }
}

pub fn decode(s: &str) -> String {
    percent_encoding::percent_decode_str(s).decode_utf8_lossy().into_owned()
}

pub fn respond(stream: &mut TcpStream, status: &str, kind: &str, body: &[u8]) -> std::io::Result<()> {
    stream.write_all(format!("HTTP/1.1 {status}\r\nContent-Type: {kind}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n", body.len()).as_bytes())?;
    stream.write_all(body)?;
    stream.flush()
}

fn s3_error(stream: &mut TcpStream, status: &str, code: &str) -> std::io::Result<()> {
    respond(stream, status, "application/xml", format!("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Error><Code>{code}</Code></Error>").as_bytes())
}

/// The file a path names under `base`, when the path stays inside it.
pub fn inside(base: &Path, rel: &str) -> Option<PathBuf> {
    let mut out = base.to_path_buf();
    for seg in rel.split('/').filter(|s| !s.is_empty()) {
        if seg == "." || seg == ".." {
            return None;
        }
        out.push(seg);
    }
    Some(out)
}

/// A request's body written to `dest` as it arrives; its SHA-256 in hex.
pub fn receive(reader: &mut impl Read, length: u64, dest: &Path) -> std::io::Result<String> {
    let tmp = dest.with_file_name(format!(".{}.in", dest.file_name().unwrap_or_default().to_string_lossy()));
    let mut out = std::fs::File::create(&tmp)?;
    let mut hasher = Sha256::new();
    let mut left = length;
    let mut buf = vec![0u8; 1 << 16];
    while left > 0 {
        let want = buf.len().min(left as usize);
        let n = reader.read(&mut buf[..want])?;
        if n == 0 {
            let _ = std::fs::remove_file(&tmp);
            return Err(std::io::Error::new(std::io::ErrorKind::UnexpectedEof, "the body ended early"));
        }
        hasher.update(&buf[..n]);
        out.write_all(&buf[..n])?;
        left -= n as u64;
    }
    out.sync_all()?;
    drop(out);
    let sha = hex(&hasher.finalize());
    std::fs::rename(&tmp, dest.with_file_name(format!(".{}.got", dest.file_name().unwrap_or_default().to_string_lossy())))?;
    Ok(sha)
}

pub fn got(dest: &Path) -> PathBuf {
    dest.with_file_name(format!(".{}.got", dest.file_name().unwrap_or_default().to_string_lossy()))
}

pub fn send_file(stream: &mut TcpStream, path: &Path) -> std::io::Result<()> {
    let mut f = std::fs::File::open(path)?;
    let len = f.metadata()?.len();
    stream.write_all(format!("HTTP/1.1 200 OK\r\nContent-Type: application/octet-stream\r\nContent-Length: {len}\r\nConnection: close\r\n\r\n").as_bytes())?;
    std::io::copy(&mut f, stream)?;
    stream.flush()
}

fn handle(stream: TcpStream, root: &Path) -> std::io::Result<()> {
    let mut reader = BufReader::new(stream.try_clone()?);
    let mut line = String::new();
    reader.read_line(&mut line)?;
    let mut parts = line.split_whitespace();
    let method = parts.next().unwrap_or("").to_string();
    let target = parts.next().unwrap_or("/").to_string();
    let (raw_path, raw_query) = match target.split_once('?') {
        Some((p, q)) => (p.to_string(), q.to_string()),
        None => (target, String::new()),
    };
    let query: Vec<(String, String)> = raw_query
        .split('&')
        .filter(|s| !s.is_empty())
        .map(|kv| match kv.split_once('=') {
            // a client's query may say a space as `+` (reqwest's does)
            Some((k, v)) => (decode(k), decode(&v.replace('+', " "))),
            None => (decode(kv), String::new()),
        })
        .collect();
    let mut headers = Vec::new();
    loop {
        let mut h = String::new();
        if reader.read_line(&mut h)? == 0 || h == "\r\n" || h == "\n" {
            break;
        }
        if let Some((k, v)) = h.split_once(':') {
            headers.push((k.trim().to_ascii_lowercase(), v.trim().to_string()));
        }
    }
    let length = headers.iter().find(|(k, _)| k == "content-length").and_then(|(_, v)| v.parse().ok());
    let req = Request { method, raw_path, query, headers, length };
    let mut stream = stream;
    if req.header("expect").is_some_and(|v| v.eq_ignore_ascii_case("100-continue")) {
        stream.write_all(b"HTTP/1.1 100 Continue\r\n\r\n")?;
    }
    let path = decode(&req.raw_path);
    if let Some(rest) = path.strip_prefix("/s3/").or(if path == "/s3" { Some("") } else { None }) {
        s3(&mut stream, &mut reader, &req, &root.join("s3"), rest)
    } else if let Some(rest) = path.strip_prefix("/dav/").or(if path == "/dav" { Some("") } else { None }) {
        dav(&mut stream, &mut reader, &req, &root.join("dav"), rest)
    } else if let Some(rest) = path.strip_prefix("/dropbox/") {
        crate::devcloud::dropbox(&mut stream, &mut reader, &req, &root.join("dropbox"), rest)
    } else if let Some(rest) = path.strip_prefix("/drive/") {
        crate::devcloud::drive(&mut stream, &mut reader, &req, &root.join("drive"), rest)
    } else {
        respond(&mut stream, "404 Not Found", "text/plain", b"")
    }
}

/// Whether the request carries the signature its own headers come to with the dev secret.
fn signed(req: &Request) -> bool {
    let Some(auth) = req.header("authorization") else { return false };
    let Some(rest) = auth.strip_prefix("AWS4-HMAC-SHA256 ") else { return false };
    let mut credential = "";
    let mut names = "";
    let mut sig = "";
    for part in rest.split(',') {
        let part = part.trim();
        if let Some(v) = part.strip_prefix("Credential=") {
            credential = v;
        } else if let Some(v) = part.strip_prefix("SignedHeaders=") {
            names = v;
        } else if let Some(v) = part.strip_prefix("Signature=") {
            sig = v;
        }
    }
    let scope: Vec<&str> = credential.split('/').collect();
    if scope.len() != 5 || scope[0] != KEY || scope[3] != "s3" || scope[4] != "aws4_request" {
        return false;
    }
    let (Some(date), Some(payload)) = (req.header("x-amz-date"), req.header("x-amz-content-sha256")) else { return false };
    if !date.starts_with(scope[1]) || !names.split(';').any(|n| n == "host") {
        return false;
    }
    let headers: Vec<(String, String)> = names.split(';').map(|n| (n.to_string(), req.header(n).unwrap_or("").to_string())).collect();
    let want = signature(&Signed { method: &req.method, path: &req.raw_path, query: &req.query, headers: &headers, payload }, SECRET, date, scope[2], "s3");
    want == sig
}

fn s3(stream: &mut TcpStream, reader: &mut impl Read, req: &Request, base: &Path, rest: &str) -> std::io::Result<()> {
    if !signed(req) {
        return s3_error(stream, "403 Forbidden", "SignatureDoesNotMatch");
    }
    let (bucket, key) = rest.split_once('/').unwrap_or((rest, ""));
    if bucket != BUCKET {
        return s3_error(stream, "404 Not Found", "NoSuchBucket");
    }
    let dir = base.join(BUCKET);
    if key.is_empty() {
        if req.method != "GET" {
            return s3_error(stream, "405 Method Not Allowed", "MethodNotAllowed");
        }
        // a listing: every key under the prefix, in order, a page at a time
        let get = |k: &str| req.query.iter().find(|(q, _)| q == k).map(|(_, v)| v.as_str());
        let prefix = get("prefix").unwrap_or("");
        let max: usize = get("max-keys").and_then(|v| v.parse().ok()).unwrap_or(1000);
        let after = get("continuation-token").unwrap_or("");
        let mut keys = Vec::new();
        walk(&dir, "", &mut keys);
        keys.retain(|k| k.starts_with(prefix) && k.as_str() > after);
        keys.sort();
        let truncated = keys.len() > max;
        keys.truncate(max);
        let mut xml = String::from("<?xml version=\"1.0\" encoding=\"UTF-8\"?><ListBucketResult xmlns=\"http://s3.amazonaws.com/doc/2006-03-01/\">");
        xml.push_str(&format!("<Name>{BUCKET}</Name><Prefix>{}</Prefix><KeyCount>{}</KeyCount><MaxKeys>{max}</MaxKeys><IsTruncated>{truncated}</IsTruncated>", escape(prefix), keys.len()));
        for k in &keys {
            let size = std::fs::metadata(dir.join(k)).map(|m| m.len()).unwrap_or(0);
            xml.push_str(&format!("<Contents><Key>{}</Key><Size>{size}</Size></Contents>", escape(k)));
        }
        if truncated {
            xml.push_str(&format!("<NextContinuationToken>{}</NextContinuationToken>", escape(keys.last().map(String::as_str).unwrap_or(""))));
        }
        xml.push_str("</ListBucketResult>");
        return respond(stream, "200 OK", "application/xml", xml.as_bytes());
    }
    let Some(file) = inside(&dir, key) else { return s3_error(stream, "400 Bad Request", "InvalidArgument") };
    match req.method.as_str() {
        "PUT" => {
            let Some(length) = req.length else { return s3_error(stream, "411 Length Required", "MissingContentLength") };
            std::fs::create_dir_all(file.parent().unwrap_or(&dir))?;
            let sha = receive(reader, length, &file)?;
            let said = req.header("x-amz-content-sha256").unwrap_or("");
            if said != "UNSIGNED-PAYLOAD" && said != sha {
                let _ = std::fs::remove_file(got(&file));
                return s3_error(stream, "400 Bad Request", "XAmzContentSHA256Mismatch");
            }
            std::fs::rename(got(&file), &file)?;
            respond(stream, "200 OK", "application/xml", b"")
        }
        "GET" if file.is_file() => send_file(stream, &file),
        "GET" => s3_error(stream, "404 Not Found", "NoSuchKey"),
        "DELETE" => {
            let _ = std::fs::remove_file(&file);
            respond(stream, "204 No Content", "application/xml", b"")
        }
        _ => s3_error(stream, "405 Method Not Allowed", "MethodNotAllowed"),
    }
}

fn walk(root: &Path, rel: &str, out: &mut Vec<String>) {
    let Ok(entries) = std::fs::read_dir(if rel.is_empty() { root.to_path_buf() } else { root.join(rel) }) else { return };
    for e in entries.flatten() {
        let name = e.file_name().to_string_lossy().into_owned();
        // a body still arriving is not a key yet
        if name.starts_with('.') {
            continue;
        }
        let path = if rel.is_empty() { name } else { format!("{rel}/{name}") };
        if e.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            walk(root, &path, out);
        } else {
            out.push(path);
        }
    }
}

fn escape(s: &str) -> String {
    s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;")
}

fn dav(stream: &mut TcpStream, reader: &mut impl Read, req: &Request, base: &Path, rest: &str) -> std::io::Result<()> {
    let want = format!("Basic {}", base64::engine::general_purpose::STANDARD.encode(format!("{USER}:{PASSWORD}")));
    if req.header("authorization") != Some(want.as_str()) {
        stream.write_all(b"HTTP/1.1 401 Unauthorized\r\nWWW-Authenticate: Basic realm=\"ilmi\"\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")?;
        return stream.flush();
    }
    let Some(file) = inside(base, rest) else { return respond(stream, "400 Bad Request", "text/plain", b"") };
    match req.method.as_str() {
        "PROPFIND" => {
            if !file.exists() {
                return respond(stream, "404 Not Found", "text/plain", b"");
            }
            let href = |rel: &str, dir: bool| {
                let p = crate::storage::uri_encode(&format!("/dav/{}", rel.trim_matches('/')), true);
                format!(
                    "<D:response><D:href>{}{}</D:href><D:propstat><D:prop><D:resourcetype>{}</D:resourcetype></D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat></D:response>",
                    p.trim_end_matches('/'),
                    if dir { "/" } else { "" },
                    if dir { "<D:collection/>" } else { "" }
                )
            };
            let mut xml = String::from("<?xml version=\"1.0\" encoding=\"utf-8\"?><D:multistatus xmlns:D=\"DAV:\">");
            xml.push_str(&href(rest, file.is_dir()));
            if file.is_dir() && req.header("depth") != Some("0") {
                let mut names: Vec<(String, bool)> = std::fs::read_dir(&file)?
                    .flatten()
                    .map(|e| (e.file_name().to_string_lossy().into_owned(), e.file_type().map(|t| t.is_dir()).unwrap_or(false)))
                    .filter(|(n, _)| !n.starts_with('.'))
                    .collect();
                names.sort();
                for (name, dir) in names {
                    xml.push_str(&href(&format!("{}/{name}", rest.trim_matches('/')), dir));
                }
            }
            xml.push_str("</D:multistatus>");
            respond(stream, "207 Multi-Status", "application/xml; charset=utf-8", xml.as_bytes())
        }
        "MKCOL" => {
            if file.exists() {
                respond(stream, "405 Method Not Allowed", "text/plain", b"")
            } else if !file.parent().is_some_and(Path::is_dir) {
                respond(stream, "409 Conflict", "text/plain", b"")
            } else {
                std::fs::create_dir(&file)?;
                respond(stream, "201 Created", "text/plain", b"")
            }
        }
        "PUT" => {
            let Some(length) = req.length else { return respond(stream, "411 Length Required", "text/plain", b"") };
            if !file.parent().is_some_and(Path::is_dir) {
                // the body is read and dropped, so the refusal is what the client reads
                std::io::copy(&mut reader.take(length), &mut std::io::sink())?;
                return respond(stream, "409 Conflict", "text/plain", b"");
            }
            if file.is_dir() {
                return respond(stream, "405 Method Not Allowed", "text/plain", b"");
            }
            let existed = file.is_file();
            receive(reader, length, &file)?;
            std::fs::rename(got(&file), &file)?;
            respond(stream, if existed { "204 No Content" } else { "201 Created" }, "text/plain", b"")
        }
        "GET" if file.is_file() => send_file(stream, &file),
        "GET" => respond(stream, "404 Not Found", "text/plain", b""),
        "DELETE" => {
            if file.is_dir() {
                std::fs::remove_dir_all(&file)?;
            } else if file.is_file() {
                std::fs::remove_file(&file)?;
            } else {
                return respond(stream, "404 Not Found", "text/plain", b"");
            }
            respond(stream, "204 No Content", "text/plain", b"")
        }
        _ => respond(stream, "405 Method Not Allowed", "text/plain", b""),
    }
}

/// What the smoke hands the renderer: each server's settings, as the tweaks would hold them.
pub fn settings(url: &str) -> serde_json::Value {
    serde_json::json!({
        "dropbox": { "kind": "dropbox", "appKey": crate::devcloud::DROPBOX_KEY, "place": "ilmi-dev", "dev": url },
        "drive": { "kind": "drive", "clientId": crate::devcloud::DRIVE_CLIENT, "clientSecret": crate::devcloud::DRIVE_SECRET, "place": "ilmi-dev", "dev": url },
        "s3": { "kind": "s3", "endpoint": format!("{url}/s3"), "bucket": BUCKET, "key": KEY, "secret": SECRET },
        "webdav": { "kind": "webdav", "address": format!("{url}/dav/ilmi"), "user": USER, "password": PASSWORD },
    })
}

#[cfg(test)]
pub mod tests {
    use super::*;
    use crate::storage::{self, Config};
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::sync::Arc;

    pub fn scratch(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("ilmi-devstore-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    /// One server for the tests of this process, its folder made once.
    pub fn server() -> String {
        static URL: OnceLock<String> = OnceLock::new();
        URL.get_or_init(|| serve(&scratch("server")).unwrap()).clone()
    }

    pub fn block<T>(f: impl std::future::Future<Output = T>) -> T {
        tauri::async_runtime::block_on(f)
    }

    fn configs(tag: &str) -> Vec<(&'static str, Config)> {
        let url = server();
        let folder = scratch(&format!("folder-{tag}"));
        vec![
            ("folder", Config::Folder { folder: folder.to_string_lossy().into_owned() }),
            ("s3", Config::S3 { endpoint: format!("{url}/s3"), bucket: format!("{BUCKET}/{tag}"), key: KEY.into(), secret: SECRET.into() }),
            ("webdav", Config::Webdav { address: format!("{url}/dav/{tag}"), user: USER.into(), password: PASSWORD.into() }),
        ]
    }

    #[test]
    fn the_four_verbs_over_a_folder_a_bucket_and_a_webdav_folder() {
        for (kind, cfg) in configs("verbs") {
            verbs(kind, &cfg);
        }
    }

    /// The same checks against a server that is not this one, when the environment names it:
    /// `ILMI_TEST_S3=endpoint,bucket,key,secret` (the bucket may carry a prefix, which should be empty) and
    /// `ILMI_TEST_WEBDAV=address,user,password` (a folder that is empty or not there yet). What they write is
    /// removed again. With neither set this checks nothing.
    #[test]
    fn a_server_the_environment_names() {
        let mut named: Vec<(&'static str, Config)> = Vec::new();
        if let Ok(v) = std::env::var("ILMI_TEST_S3") {
            let f: Vec<&str> = v.splitn(4, ',').collect();
            assert_eq!(f.len(), 4, "ILMI_TEST_S3=endpoint,bucket,key,secret");
            named.push(("s3", Config::S3 { endpoint: f[0].into(), bucket: f[1].into(), key: f[2].into(), secret: f[3].into() }));
        }
        if let Ok(v) = std::env::var("ILMI_TEST_WEBDAV") {
            let f: Vec<&str> = v.splitn(3, ',').collect();
            assert_eq!(f.len(), 3, "ILMI_TEST_WEBDAV=address,user,password");
            named.push(("webdav", Config::Webdav { address: f[0].into(), user: f[1].into(), password: f[2].into() }));
        }
        let dir = scratch("named");
        let bytes: Vec<u8> = (0..3_000_017u32).map(|i| (i.wrapping_mul(2_654_435_761) >> 24) as u8).collect();
        let sha = hex(&Sha256::digest(&bytes));
        std::fs::write(dir.join("up"), &bytes).unwrap();
        for (kind, cfg) in named {
            verbs(kind, &cfg);
            block(async {
                storage::upload(&cfg, &format!("blobs/{sha}"), &dir.join("up"), &sha, |_| {}).await.unwrap_or_else(|e| panic!("{kind}: {e}"));
                let got = storage::download(&cfg, &format!("blobs/{sha}"), &dir.join("down"), |_, _| {}).await.unwrap();
                assert_eq!(got, Some((sha.clone(), bytes.len() as u64)), "{kind}: a file up and down in pieces");
                for path in storage::list(&cfg, "").await.unwrap() {
                    storage::remove(&cfg, &path).await.unwrap();
                }
                assert_eq!(storage::list(&cfg, "").await.unwrap(), Vec::<String>::new(), "{kind}: left as it was found");
            });
        }
    }

    pub fn verbs(kind: &str, cfg: &Config) {
        {
            block(async {
                assert_eq!(storage::list(cfg, "").await.unwrap(), Vec::<String>::new(), "{kind}: empty");
                assert_eq!(storage::read(cfg, "format").await.unwrap(), None, "{kind}: nothing to read");
                storage::write(cfg, "format", b"{\"ilmi\":\"sync\"}\n".to_vec()).await.unwrap();
                storage::write(cfg, "devices/0a1b2c3d4e5f6a7b/1", b"one\n".to_vec()).await.unwrap();
                storage::write(cfg, "devices/0a1b2c3d4e5f6a7b/2", vec![0u8, 255, 10, 13]).await.unwrap();
                storage::write(cfg, "devices/ffff000011112222/1", "\u{644}\u{627}\n".as_bytes().to_vec()).await.unwrap();
                storage::write(cfg, "snapshots/x-1/0", Vec::new()).await.unwrap();
                assert_eq!(storage::read(cfg, "format").await.unwrap().as_deref(), Some(&b"{\"ilmi\":\"sync\"}\n"[..]), "{kind}: read back");
                assert_eq!(storage::read(cfg, "devices/0a1b2c3d4e5f6a7b/2").await.unwrap(), Some(vec![0u8, 255, 10, 13]), "{kind}: bytes as they are");
                assert_eq!(storage::read(cfg, "snapshots/x-1/0").await.unwrap(), Some(Vec::new()), "{kind}: an empty file");
                assert_eq!(
                    storage::list(cfg, "devices/").await.unwrap(),
                    vec!["devices/0a1b2c3d4e5f6a7b/1".to_string(), "devices/0a1b2c3d4e5f6a7b/2".to_string(), "devices/ffff000011112222/1".to_string()],
                    "{kind}: a listing under a prefix"
                );
                assert_eq!(storage::list(cfg, "").await.unwrap().len(), 5, "{kind}: everything");
                assert_eq!(storage::list(cfg, "blobs/").await.unwrap(), Vec::<String>::new(), "{kind}: a prefix nothing is under");
                storage::remove(cfg, "devices/0a1b2c3d4e5f6a7b/1").await.unwrap();
                storage::remove(cfg, "devices/0a1b2c3d4e5f6a7b/1").await.unwrap();
                assert_eq!(storage::read(cfg, "devices/0a1b2c3d4e5f6a7b/1").await.unwrap(), None, "{kind}: removed");
                assert_eq!(storage::list(cfg, "devices/").await.unwrap().len(), 2, "{kind}: and not listed");
                assert!(storage::read(cfg, "../format").await.is_err(), "{kind}: nothing outside");
            });
        }
    }

    #[test]
    fn a_file_goes_up_and_comes_down_in_pieces_and_is_what_it_was() {
        let dir = scratch("pieces");
        // five megabytes that do not repeat by the megabyte
        let bytes: Vec<u8> = (0..5_000_003u32).map(|i| (i.wrapping_mul(2_654_435_761) >> 24) as u8).collect();
        let sha = hex(&Sha256::digest(&bytes));
        let src = dir.join("book.pdf");
        std::fs::write(&src, &bytes).unwrap();
        for (kind, cfg) in configs("pieces") {
            block(async {
                let sent = Arc::new(AtomicU64::new(0));
                let calls = Arc::new(AtomicU64::new(0));
                let (s, c) = (sent.clone(), calls.clone());
                storage::upload(&cfg, &format!("blobs/{sha}"), &src, &sha, move |n| {
                    s.store(n, Ordering::Relaxed);
                    c.fetch_add(1, Ordering::Relaxed);
                })
                .await
                .unwrap_or_else(|e| panic!("{kind}: {e}"));
                assert_eq!(sent.load(Ordering::Relaxed), bytes.len() as u64, "{kind}: all of it went");
                assert!(calls.load(Ordering::Relaxed) >= 5, "{kind}: in pieces ({})", calls.load(Ordering::Relaxed));
                assert_eq!(storage::list(&cfg, "blobs/").await.unwrap(), vec![format!("blobs/{sha}")], "{kind}: listed");
                let dest = dir.join(format!("down-{kind}"));
                let got = Arc::new(AtomicU64::new(0));
                let g = got.clone();
                let whole = Arc::new(AtomicU64::new(0));
                let w = whole.clone();
                let (hash, size) = storage::download(&cfg, &format!("blobs/{sha}"), &dest, move |n, of| {
                    g.store(n, Ordering::Relaxed);
                    w.store(of.unwrap_or(0), Ordering::Relaxed);
                })
                .await
                .unwrap()
                .unwrap();
                assert_eq!((hash.as_str(), size), (sha.as_str(), bytes.len() as u64), "{kind}: the same bytes came down");
                assert_eq!(got.load(Ordering::Relaxed), bytes.len() as u64);
                assert_eq!(whole.load(Ordering::Relaxed), bytes.len() as u64, "{kind}: the size was said");
                assert_eq!(std::fs::read(&dest).unwrap(), bytes);
                assert_eq!(storage::download(&cfg, "blobs/0000", &dir.join("none"), |_, _| {}).await.unwrap(), None, "{kind}: one that is not there");
            });
        }
    }

    #[test]
    fn a_bucket_refuses_a_wrong_secret_and_a_body_that_is_not_what_it_says() {
        let url = server();
        block(async {
            let wrong = Config::S3 { endpoint: format!("{url}/s3"), bucket: BUCKET.into(), key: KEY.into(), secret: "not the secret".into() };
            let e = storage::list(&wrong, "").await.unwrap_err();
            assert!(e.contains("403") && e.contains("SignatureDoesNotMatch"), "{e}");
            let other = Config::S3 { endpoint: format!("{url}/s3"), bucket: "elsewhere".into(), key: KEY.into(), secret: SECRET.into() };
            assert!(storage::list(&other, "").await.unwrap_err().contains("NoSuchBucket"));
            // a blob sent under another's hash is refused, as S3 refuses it
            let dir = scratch("mismatch");
            std::fs::write(dir.join("f"), b"these bytes").unwrap();
            let cfg = Config::S3 { endpoint: format!("{url}/s3"), bucket: format!("{BUCKET}/mismatch"), key: KEY.into(), secret: SECRET.into() };
            let e = storage::upload(&cfg, "blobs/x", &dir.join("f"), &hex(&Sha256::digest(b"other bytes")), |_| {}).await.unwrap_err();
            assert!(e.contains("XAmzContentSHA256Mismatch"), "{e}");
            assert_eq!(storage::list(&cfg, "").await.unwrap(), Vec::<String>::new());
            let dav = Config::Webdav { address: format!("{url}/dav/locked"), user: USER.into(), password: "wrong".into() };
            assert!(storage::write(&dav, "format", b"x".to_vec()).await.unwrap_err().contains("401"));
        });
    }

    #[test]
    fn a_long_listing_comes_a_page_at_a_time() {
        let url = server();
        let cfg = Config::S3 { endpoint: format!("{url}/s3"), bucket: format!("{BUCKET}/pages"), key: KEY.into(), secret: SECRET.into() };
        let root = SERVER.get().unwrap().1.join("s3").join(BUCKET).join("pages/devices/d");
        std::fs::create_dir_all(&root).unwrap();
        for i in 0..1203 {
            std::fs::write(root.join(i.to_string()), b"x").unwrap();
        }
        block(async {
            let all = storage::list(&cfg, "devices/").await.unwrap();
            assert_eq!(all.len(), 1203);
            assert!(all.contains(&"devices/d/1202".to_string()));
        });
    }

    /// curl signs for S3 by its own code (`--aws-sigv4`): the server here takes its requests, so the signature
    /// checked is the one another implementation makes, not only this one's.
    #[test]
    fn curl_s_own_signature_is_taken() {
        if std::process::Command::new("curl").arg("--version").output().is_err() {
            return;
        }
        let url = server();
        let dir = scratch("curl");
        std::fs::write(dir.join("up"), b"sent by curl\n").unwrap();
        let curl = |args: &[&str]| {
            let out = std::process::Command::new("curl")
                .args(["-sS", "--aws-sigv4", "aws:amz:us-east-1:s3", "--user", &format!("{KEY}:{SECRET}"), "-w", "\n%{http_code}"])
                .args(args)
                .output()
                .unwrap();
            String::from_utf8_lossy(&out.stdout).into_owned()
        };
        let put = curl(&["-T", dir.join("up").to_str().unwrap(), &format!("{url}/s3/{BUCKET}/curl/devices/c/1")]);
        if put.ends_with("\n000") {
            // a curl without the option
            return;
        }
        assert!(put.ends_with("\n200"), "{put}");
        let get = curl(&[&format!("{url}/s3/{BUCKET}/curl/devices/c/1")]);
        assert_eq!(get, "sent by curl\n\n200");
        let listing = curl(&[&format!("{url}/s3/{BUCKET}?list-type=2&prefix=curl%2F")]);
        assert!(listing.contains("<Key>curl/devices/c/1</Key>") && listing.ends_with("\n200"), "{listing}");
        // and what curl wrote, this client reads
        let cfg = Config::S3 { endpoint: format!("{url}/s3"), bucket: format!("{BUCKET}/curl"), key: KEY.into(), secret: SECRET.into() };
        assert_eq!(block(storage::read(&cfg, "devices/c/1")).unwrap().as_deref(), Some(&b"sent by curl\n"[..]));
        let bad = std::process::Command::new("curl")
            .args(["-sS", "--aws-sigv4", "aws:amz:us-east-1:s3", "--user", &format!("{KEY}:wrong"), "-w", "\n%{http_code}", &format!("{url}/s3/{BUCKET}/curl/devices/c/1")])
            .output()
            .unwrap();
        assert!(String::from_utf8_lossy(&bad.stdout).ends_with("\n403"));
    }
}
