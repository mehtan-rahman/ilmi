//! A storage over the network (milestone 63): where a collection's changes
//! and files are kept for its other devices (`src/sync/storage.ts` says
//! what a storage is: `format`, `devices/<device>/<n>`,
//! `snapshots/<name>/…`, `blobs/<sha256>`, each file written once). Three
//! kinds, all with the same verbs: a folder, an S3-compatible bucket
//! (Cloudflare R2, MinIO, AWS; requests signed by Signature Version 4,
//! addressed by path: `<endpoint>/<bucket>/<key>`), and a WebDAV folder
//! (Nextcloud, a Synology; basic auth).
//!
//! The small files (a device's changes, a few hundred kilobytes each) cross
//! to the renderer whole, since the engine there is what reads them. A blob
//! never does: `upload` sends a file from the collection's `blobs/` as the
//! request's body a piece at a time, and `download` writes the response to
//! a file as it arrives, hashing it, so a PDF of any size passes through
//! this process a quarter megabyte at a time and through the web view not
//! at all.
//!
//! What is not here: an upload in parts (S3 takes one `PUT` up to 5 GB,
//! which is the limit this has), and resuming a transfer cut short (it
//! starts again).

use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::io::{Read, Write};
use std::path::Path;
use std::sync::OnceLock;
use std::time::Duration;
use tauri_plugin_http::reqwest;

/// Which storage, and what it needs to be reached.
#[derive(Deserialize, Debug, Clone)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum Config {
    Folder {
        folder: String,
    },
    /// `bucket` may carry a prefix after the bucket's name (`notes/ilmi`): the storage is under it.
    S3 {
        endpoint: String,
        bucket: String,
        key: String,
        secret: String,
    },
    /// `address` is the folder's own: `https://cloud.example/remote.php/dav/files/me/ilmi`.
    Webdav {
        address: String,
        user: String,
        password: String,
    },
}

fn err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

fn client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(15))
            .read_timeout(Duration::from_secs(60))
            .build()
            .expect("an http client")
    })
}

/// A path inside a storage: segments of plain names, nothing that climbs out.
fn clean(path: &str) -> Result<&str, String> {
    let p = path.trim_matches('/');
    if p.split('/').any(|s| s.is_empty() || s == "." || s == "..") && !p.is_empty() {
        return Err(format!("{path}: not a path in a storage"));
    }
    Ok(p)
}

/// A name a write goes under in a folder until it is whole; a listing leaves these out.
const PART: &str = ".part";

// ── Signature Version 4 ──────────────────────────────────────────

pub fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn hmac(key: &[u8], data: &[u8]) -> [u8; 32] {
    let mut k = [0u8; 64];
    if key.len() > 64 {
        k[..32].copy_from_slice(&Sha256::digest(key));
    } else {
        k[..key.len()].copy_from_slice(key);
    }
    let mut inner = Sha256::new();
    inner.update(k.map(|b| b ^ 0x36));
    inner.update(data);
    let mut outer = Sha256::new();
    outer.update(k.map(|b| b ^ 0x5c));
    outer.update(inner.finalize());
    outer.finalize().into()
}

/// Percent-encoded as the signature wants it: everything but letters, digits and `-._~`; a `/` kept in a path.
pub fn uri_encode(s: &str, slash: bool) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        if b.is_ascii_alphanumeric() || matches!(b, b'-' | b'.' | b'_' | b'~') || (slash && b == b'/') {
            out.push(b as char);
        } else {
            out.push_str(&format!("%{b:02X}"));
        }
    }
    out
}

/// A request as the signature reads it.
pub struct Signed<'a> {
    pub method: &'a str,
    /// The path as it is sent, already encoded.
    pub path: &'a str,
    /// The query's pairs, not yet encoded.
    pub query: &'a [(String, String)],
    /// The headers that are signed, lower-case names, sorted by name.
    pub headers: &'a [(String, String)],
    /// The hex SHA-256 of the body, or `UNSIGNED-PAYLOAD`.
    pub payload: &'a str,
}

pub fn canonical_query(query: &[(String, String)]) -> String {
    let mut q: Vec<(String, String)> = query.iter().map(|(k, v)| (uri_encode(k, false), uri_encode(v, false))).collect();
    q.sort();
    q.iter().map(|(k, v)| format!("{k}={v}")).collect::<Vec<_>>().join("&")
}

/// The signature of `req` made at `amz_date` (`20130524T000000Z`) for `region` and `service`, in hex.
pub fn signature(req: &Signed<'_>, secret: &str, amz_date: &str, region: &str, service: &str) -> String {
    let day = &amz_date[..8];
    let names = req.headers.iter().map(|(k, _)| k.as_str()).collect::<Vec<_>>().join(";");
    let canonical = format!(
        "{}\n{}\n{}\n{}\n{}\n{}",
        req.method,
        req.path,
        canonical_query(req.query),
        req.headers.iter().map(|(k, v)| format!("{k}:{}\n", v.trim())).collect::<String>(),
        names,
        req.payload
    );
    let scope = format!("{day}/{region}/{service}/aws4_request");
    let to_sign = format!("AWS4-HMAC-SHA256\n{amz_date}\n{scope}\n{}", hex(&Sha256::digest(canonical.as_bytes())));
    let k = hmac(format!("AWS4{secret}").as_bytes(), day.as_bytes());
    let k = hmac(&k, region.as_bytes());
    let k = hmac(&k, service.as_bytes());
    let k = hmac(&k, b"aws4_request");
    hex(&hmac(&k, to_sign.as_bytes()))
}

/// The `Authorization` header for `req`.
pub fn authorization(req: &Signed<'_>, key: &str, secret: &str, amz_date: &str, region: &str, service: &str) -> String {
    let names = req.headers.iter().map(|(k, _)| k.as_str()).collect::<Vec<_>>().join(";");
    format!(
        "AWS4-HMAC-SHA256 Credential={key}/{}/{region}/{service}/aws4_request, SignedHeaders={names}, Signature={}",
        &amz_date[..8],
        signature(req, secret, amz_date, region, service)
    )
}

/// Now, as `20261106T093000Z`.
fn amz_now() -> String {
    let secs = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    amz_date(secs)
}

/// Seconds since 1970 as `YYYYMMDDTHHMMSSZ` (the days to a date by the civil calendar's arithmetic).
pub fn amz_date(secs: u64) -> String {
    let days = (secs / 86_400) as i64;
    let rem = secs % 86_400;
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = yoe + era * 400 + if m <= 2 { 1 } else { 0 };
    format!("{y:04}{m:02}{d:02}T{:02}{:02}{:02}Z", rem / 3600, rem % 3600 / 60, rem % 60)
}

/// The region a signature names: an AWS endpoint says its own, R2 takes `auto`, anything else (MinIO) `us-east-1`.
pub fn region_of(host: &str) -> String {
    let h = host.split(':').next().unwrap_or(host);
    if h.ends_with(".r2.cloudflarestorage.com") {
        return "auto".to_string();
    }
    if let Some(rest) = h.strip_suffix(".amazonaws.com") {
        let parts: Vec<&str> = rest.split('.').collect();
        if let Some(i) = parts.iter().position(|p| *p == "s3" || p.starts_with("s3-")) {
            if let Some(r) = parts.get(i + 1) {
                return r.to_string();
            }
            if let Some(r) = parts[i].strip_prefix("s3-") {
                return r.to_string();
            }
        }
    }
    "us-east-1".to_string()
}

struct S3<'a> {
    endpoint: reqwest::Url,
    bucket: &'a str,
    prefix: String,
    key: &'a str,
    secret: &'a str,
}

impl<'a> S3<'a> {
    fn new(endpoint: &str, bucket: &'a str, key: &'a str, secret: &'a str) -> Result<S3<'a>, String> {
        let endpoint = reqwest::Url::parse(endpoint.trim().trim_end_matches('/')).map_err(|_| "the endpoint is not an address".to_string())?;
        if endpoint.host_str().is_none() {
            return Err("the endpoint is not an address".to_string());
        }
        let b = bucket.trim().trim_matches('/');
        let (bucket, prefix) = match b.split_once('/') {
            Some((b, p)) => (b, format!("{}/", p.trim_matches('/'))),
            None => (b, String::new()),
        };
        if bucket.is_empty() {
            return Err("no bucket named".to_string());
        }
        Ok(S3 { endpoint, bucket, prefix, key, secret })
    }

    fn host(&self) -> String {
        match self.endpoint.port() {
            Some(p) => format!("{}:{p}", self.endpoint.host_str().unwrap_or("")),
            None => self.endpoint.host_str().unwrap_or("").to_string(),
        }
    }

    /// The path of `key` in the bucket (the bucket itself for none), as it is sent.
    fn path(&self, key: Option<&str>) -> String {
        let base = self.endpoint.path().trim_end_matches('/');
        match key {
            Some(k) => format!("{base}/{}/{}", uri_encode(self.bucket, false), uri_encode(&format!("{}{k}", self.prefix), true)),
            None => format!("{base}/{}", uri_encode(self.bucket, false)),
        }
    }

    /// A signed request: `payload` is the body's SHA-256 in hex.
    fn request(&self, method: reqwest::Method, key: Option<&str>, query: &[(String, String)], payload: &str) -> reqwest::RequestBuilder {
        let path = self.path(key);
        let date = amz_now();
        let host = self.host();
        let headers = vec![
            ("host".to_string(), host.clone()),
            ("x-amz-content-sha256".to_string(), payload.to_string()),
            ("x-amz-date".to_string(), date.clone()),
        ];
        let auth = authorization(
            &Signed { method: method.as_str(), path: &path, query, headers: &headers, payload },
            self.key,
            self.secret,
            &date,
            &region_of(&host),
            "s3",
        );
        let q = canonical_query(query);
        let url = format!("{}://{host}{path}{}{q}", self.endpoint.scheme(), if q.is_empty() { "" } else { "?" });
        client()
            .request(method, url)
            .header("x-amz-content-sha256", payload)
            .header("x-amz-date", date)
            .header("authorization", auth)
    }
}

const EMPTY_SHA: &str = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

/// What a server said when it refused: its status and the start of its answer.
async fn refused(what: &str, res: reqwest::Response) -> String {
    let status = res.status();
    let body = res.text().await.unwrap_or_default();
    let code = between(&body, "<Code>", "</Code>").map(|c| format!(" {c}")).unwrap_or_default();
    format!("{what}: {}{code}", status.as_u16())
}

fn between<'a>(s: &'a str, open: &str, close: &str) -> Option<&'a str> {
    let a = s.find(open)? + open.len();
    let b = s[a..].find(close)? + a;
    Some(&s[a..b])
}

fn unescape(s: &str) -> String {
    s.replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"").replace("&apos;", "'").replace("&amp;", "&")
}

// ── WebDAV ───────────────────────────────────────────────────────

struct Dav<'a> {
    base: reqwest::Url,
    user: &'a str,
    password: &'a str,
}

impl<'a> Dav<'a> {
    fn new(address: &str, user: &'a str, password: &'a str) -> Result<Dav<'a>, String> {
        let base = reqwest::Url::parse(address.trim().trim_end_matches('/')).map_err(|_| "the address is not one".to_string())?;
        if base.host_str().is_none() {
            return Err("the address is not one".to_string());
        }
        Ok(Dav { base, user, password })
    }

    fn url(&self, path: &str) -> String {
        let base = self.base.as_str().trim_end_matches('/');
        if path.is_empty() {
            base.to_string()
        } else {
            format!("{base}/{}", uri_encode(path, true))
        }
    }

    fn request(&self, method: &str, path: &str) -> reqwest::RequestBuilder {
        let m = reqwest::Method::from_bytes(method.as_bytes()).expect("a method");
        let r = client().request(m, self.url(path));
        if self.user.is_empty() && self.password.is_empty() {
            r
        } else {
            r.basic_auth(self.user, Some(self.password))
        }
    }

    /// What is directly in the folder at `path`: each entry's name and whether it is a folder; none when the folder is not there.
    async fn children(&self, path: &str) -> Result<Vec<(String, bool)>, String> {
        let res = self
            .request("PROPFIND", path)
            .header("Depth", "1")
            .header("Content-Type", "application/xml")
            .body(r#"<?xml version="1.0" encoding="utf-8"?><D:propfind xmlns:D="DAV:"><D:prop><D:resourcetype/></D:prop></D:propfind>"#)
            .send()
            .await
            .map_err(err)?;
        if res.status().as_u16() == 404 {
            return Ok(Vec::new());
        }
        if !res.status().is_success() {
            return Err(refused("list", res).await);
        }
        let here = percent_encoding::percent_decode_str(reqwest::Url::parse(&self.url(path)).map_err(err)?.path()).decode_utf8_lossy().trim_end_matches('/').to_string();
        let mut out = Vec::new();
        for (href, dir) in multistatus(&res.text().await.map_err(err)?)? {
            // an href is a path, or a whole address: its path either way
            let p = reqwest::Url::parse(&href).map(|u| u.path().to_string()).unwrap_or(href);
            let p = percent_encoding::percent_decode_str(&p).decode_utf8_lossy().trim_end_matches('/').to_string();
            if p == here {
                continue;
            }
            if let Some(name) = p.strip_prefix(&format!("{here}/")) {
                if !name.contains('/') {
                    out.push((name.to_string(), dir));
                }
            }
        }
        Ok(out)
    }

    /// The folders above `path`, made where they are missing.
    async fn parents(&self, path: &str) -> Result<(), String> {
        let segs: Vec<&str> = path.split('/').collect();
        // the storage's own folder first: a new one on a server is made by the first write
        for i in 0..segs.len() {
            let dir = segs[..i].join("/");
            let res = self.request("MKCOL", &dir).send().await.map_err(err)?;
            let s = res.status().as_u16();
            // made, or there already (405; some servers say 409 or 301 for a folder that is)
            if !(res.status().is_success() || s == 405 || s == 301 || (s == 409 && i == 0)) {
                return Err(refused("make folder", res).await);
            }
        }
        Ok(())
    }
}

/// The entries of a `207 Multi-Status` answer: each `href`, and whether it is a collection. Read by its tags'
/// local names, whatever prefix a server gives the `DAV:` namespace.
pub fn multistatus(xml: &str) -> Result<Vec<(String, bool)>, String> {
    let mut out = Vec::new();
    let mut href: Option<String> = None;
    let mut dir = false;
    let mut rest = xml;
    while let Some(open) = rest.find('<') {
        let Some(close) = rest[open..].find('>') else { break };
        let tag = &rest[open + 1..open + close];
        let after = &rest[open + close + 1..];
        let ending = tag.starts_with('/');
        let name = tag.trim_start_matches('/').split([' ', '\t', '\n', '\r', '/']).next().unwrap_or("");
        let local = name.rsplit(':').next().unwrap_or(name);
        match (local, ending) {
            ("response", false) => {
                href = None;
                dir = false;
            }
            ("href", false) if href.is_none() => {
                let end = after.find('<').unwrap_or(after.len());
                href = Some(unescape(after[..end].trim()));
            }
            ("collection", false) => dir = true,
            ("response", true) => {
                if let Some(h) = href.take() {
                    out.push((h, dir));
                }
            }
            _ => {}
        }
        rest = after;
    }
    Ok(out)
}

// ── the verbs ────────────────────────────────────────────────────

/// The files under `prefix`, by their path from the storage's top, sorted.
pub async fn list(cfg: &Config, prefix: &str) -> Result<Vec<String>, String> {
    let prefix = clean(prefix)?;
    let mut out = Vec::new();
    match cfg {
        Config::Folder { folder } => {
            fn walk(root: &Path, rel: &str, out: &mut Vec<String>) {
                let Ok(entries) = std::fs::read_dir(if rel.is_empty() { root.to_path_buf() } else { root.join(rel) }) else { return };
                for e in entries.flatten() {
                    let name = e.file_name().to_string_lossy().into_owned();
                    if name.starts_with('.') || name.ends_with(PART) {
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
            walk(Path::new(folder), prefix, &mut out);
        }
        Config::S3 { endpoint, bucket, key, secret } => {
            let s3 = S3::new(endpoint, bucket, key, secret)?;
            let mut token: Option<String> = None;
            loop {
                let mut query = vec![("list-type".to_string(), "2".to_string()), ("prefix".to_string(), format!("{}{prefix}{}", s3.prefix, if prefix.is_empty() { "" } else { "/" }))];
                if let Some(t) = &token {
                    query.push(("continuation-token".to_string(), t.clone()));
                }
                let res = s3.request(reqwest::Method::GET, None, &query, EMPTY_SHA).send().await.map_err(err)?;
                if !res.status().is_success() {
                    return Err(refused("list", res).await);
                }
                let xml = res.text().await.map_err(err)?;
                let mut rest = xml.as_str();
                while let Some(k) = between(rest, "<Key>", "</Key>") {
                    let key = unescape(k);
                    if let Some(rel) = key.strip_prefix(&s3.prefix) {
                        out.push(rel.to_string());
                    }
                    rest = &rest[rest.find("</Key>").unwrap() + 6..];
                }
                token = between(&xml, "<NextContinuationToken>", "</NextContinuationToken>").map(unescape);
                if token.is_none() || between(&xml, "<IsTruncated>", "</IsTruncated>") != Some("true") {
                    break;
                }
            }
        }
        Config::Webdav { address, user, password } => {
            let dav = Dav::new(address, user, password)?;
            let mut dirs = vec![prefix.to_string()];
            while let Some(dir) = dirs.pop() {
                for (name, is_dir) in dav.children(&dir).await? {
                    if name.starts_with('.') {
                        continue;
                    }
                    let path = if dir.is_empty() { name } else { format!("{dir}/{name}") };
                    if is_dir {
                        dirs.push(path);
                    } else {
                        out.push(path);
                    }
                }
            }
        }
    }
    out.sort();
    Ok(out)
}

/// A file's bytes; none when it is not there.
pub async fn read(cfg: &Config, path: &str) -> Result<Option<Vec<u8>>, String> {
    let path = clean(path)?;
    let res = match cfg {
        Config::Folder { folder } => {
            return match std::fs::read(Path::new(folder).join(path)) {
                Ok(b) => Ok(Some(b)),
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
                Err(e) => Err(err(e)),
            };
        }
        Config::S3 { endpoint, bucket, key, secret } => S3::new(endpoint, bucket, key, secret)?.request(reqwest::Method::GET, Some(path), &[], EMPTY_SHA).send().await.map_err(err)?,
        Config::Webdav { address, user, password } => Dav::new(address, user, password)?.request("GET", path).send().await.map_err(err)?,
    };
    if res.status().as_u16() == 404 {
        return Ok(None);
    }
    if !res.status().is_success() {
        return Err(refused("read", res).await);
    }
    Ok(Some(res.bytes().await.map_err(err)?.to_vec()))
}

/// A file that is not there yet, whole.
pub async fn write(cfg: &Config, path: &str, bytes: Vec<u8>) -> Result<(), String> {
    let path = clean(path)?;
    let res = match cfg {
        Config::Folder { folder } => {
            let dest = Path::new(folder).join(path);
            std::fs::create_dir_all(dest.parent().unwrap_or(Path::new(folder))).map_err(err)?;
            let part = dest.with_file_name(format!("{}{PART}", dest.file_name().unwrap_or_default().to_string_lossy()));
            let mut f = std::fs::File::create(&part).map_err(err)?;
            f.write_all(&bytes).map_err(err)?;
            f.sync_all().map_err(err)?;
            return std::fs::rename(&part, &dest).map_err(err);
        }
        Config::S3 { endpoint, bucket, key, secret } => {
            let sha = hex(&Sha256::digest(&bytes));
            S3::new(endpoint, bucket, key, secret)?.request(reqwest::Method::PUT, Some(path), &[], &sha).header("content-length", bytes.len()).body(bytes).send().await.map_err(err)?
        }
        Config::Webdav { address, user, password } => {
            let dav = Dav::new(address, user, password)?;
            // the folders above it are made when the server says they are missing, not asked after on every write
            let first = dav.request("PUT", path).header("content-length", bytes.len()).body(bytes.clone()).send().await.map_err(err)?;
            if missing_parent(&first) {
                dav.parents(path).await?;
                dav.request("PUT", path).header("content-length", bytes.len()).body(bytes).send().await.map_err(err)?
            } else {
                first
            }
        }
    };
    if !res.status().is_success() {
        return Err(refused("write", res).await);
    }
    Ok(())
}

/// A `PUT` refused because the folder it is for is not there.
fn missing_parent(res: &reqwest::Response) -> bool {
    matches!(res.status().as_u16(), 403 | 404 | 409)
}

pub async fn remove(cfg: &Config, path: &str) -> Result<(), String> {
    let path = clean(path)?;
    let res = match cfg {
        Config::Folder { folder } => {
            return match std::fs::remove_file(Path::new(folder).join(path)) {
                Ok(()) => Ok(()),
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
                Err(e) => Err(err(e)),
            };
        }
        Config::S3 { endpoint, bucket, key, secret } => S3::new(endpoint, bucket, key, secret)?.request(reqwest::Method::DELETE, Some(path), &[], EMPTY_SHA).send().await.map_err(err)?,
        Config::Webdav { address, user, password } => Dav::new(address, user, password)?.request("DELETE", path).send().await.map_err(err)?,
    };
    if !(res.status().is_success() || res.status().as_u16() == 404) {
        return Err(refused("remove", res).await);
    }
    Ok(())
}

/// How much of a file goes into the request at a time.
const PIECE: usize = 256 * 1024;

/// A request's body read from `file` a piece at a time, `progress` told how much has gone.
fn body_of(file: std::fs::File, progress: impl Fn(u64) + Send + Sync + 'static) -> reqwest::Body {
    let stream = futures_util::stream::unfold((file, 0u64), move |(mut file, done)| {
        let mut buf = vec![0u8; PIECE];
        let got = file.read(&mut buf);
        let out = match got {
            Ok(0) => None,
            Ok(n) => {
                buf.truncate(n);
                progress(done + n as u64);
                Some((Ok::<Vec<u8>, std::io::Error>(buf), (file, done + n as u64)))
            }
            Err(e) => Some((Err(e), (file, done))),
        };
        std::future::ready(out)
    });
    reqwest::Body::wrap_stream(stream)
}

/// The file at `file`, whose SHA-256 is `sha`, written to the storage as `path`, without being read whole.
pub async fn upload(cfg: &Config, path: &str, file: &Path, sha: &str, progress: impl Fn(u64) + Send + Sync + 'static) -> Result<(), String> {
    let path = clean(path)?;
    let size = std::fs::metadata(file).map_err(err)?.len();
    let res = match cfg {
        Config::Folder { folder } => {
            let dest = Path::new(folder).join(path);
            std::fs::create_dir_all(dest.parent().unwrap_or(Path::new(folder))).map_err(err)?;
            let part = dest.with_file_name(format!("{}{PART}", dest.file_name().unwrap_or_default().to_string_lossy()));
            crate::store::copy_hashing(file, &part, progress).inspect_err(|_| {
                let _ = std::fs::remove_file(&part);
            })?;
            return std::fs::rename(&part, &dest).map_err(err);
        }
        Config::S3 { endpoint, bucket, key, secret } => S3::new(endpoint, bucket, key, secret)?
            .request(reqwest::Method::PUT, Some(path), &[], sha)
            .header("content-length", size)
            .body(body_of(std::fs::File::open(file).map_err(err)?, progress))
            .send()
            .await
            .map_err(err)?,
        Config::Webdav { address, user, password } => {
            let dav = Dav::new(address, user, password)?;
            let progress = std::sync::Arc::new(progress);
            let put = || -> Result<reqwest::RequestBuilder, String> {
                let p = progress.clone();
                Ok(dav.request("PUT", path).header("content-length", size).body(body_of(std::fs::File::open(file).map_err(err)?, move |n| p(n))))
            };
            let first = put()?.send().await.map_err(err)?;
            if missing_parent(&first) {
                dav.parents(path).await?;
                put()?.send().await.map_err(err)?
            } else {
                first
            }
        }
    };
    if !res.status().is_success() {
        return Err(refused("send", res).await);
    }
    Ok(())
}

/// The storage's file at `path` written to `dest` as it arrives; its SHA-256 in hex and its length, or none when the storage does not hold it. `progress` is told the bytes so far and, when the server says it, the whole.
pub async fn download(cfg: &Config, path: &str, dest: &Path, progress: impl Fn(u64, Option<u64>) + Send + Sync + 'static) -> Result<Option<(String, u64)>, String> {
    let path = clean(path)?;
    let mut res = match cfg {
        Config::Folder { folder } => {
            let src = Path::new(folder).join(path);
            if !src.is_file() {
                return Ok(None);
            }
            let whole = std::fs::metadata(&src).map(|m| m.len()).ok();
            return crate::store::copy_hashing(&src, dest, |n| progress(n, whole)).map(Some);
        }
        Config::S3 { endpoint, bucket, key, secret } => S3::new(endpoint, bucket, key, secret)?.request(reqwest::Method::GET, Some(path), &[], EMPTY_SHA).send().await.map_err(err)?,
        Config::Webdav { address, user, password } => Dav::new(address, user, password)?.request("GET", path).send().await.map_err(err)?,
    };
    if res.status().as_u16() == 404 {
        return Ok(None);
    }
    if !res.status().is_success() {
        return Err(refused("fetch", res).await);
    }
    let whole = res.content_length();
    let mut out = std::fs::File::create(dest).map_err(err)?;
    let mut hasher = Sha256::new();
    let mut done: u64 = 0;
    while let Some(chunk) = res.chunk().await.map_err(err)? {
        hasher.update(&chunk);
        out.write_all(&chunk).map_err(err)?;
        done += chunk.len() as u64;
        progress(done, whole);
    }
    out.sync_all().map_err(err)?;
    Ok(Some((hex(&hasher.finalize()), done)))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pairs(list: &[(&str, &str)]) -> Vec<(String, String)> {
        list.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect()
    }

    // The examples Amazon publishes for S3 (Signature Version 4, "Authenticating Requests: Using the Authorization
    // Header"): one bucket, one key pair, one instant, and the signature each request must come to.
    const KEY: &str = "AKIAIOSFODNN7EXAMPLE";
    const SECRET: &str = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
    const DATE: &str = "20130524T000000Z";
    const HOST: &str = "examplebucket.s3.amazonaws.com";

    #[test]
    fn a_get_is_signed_as_amazon_s_example_is() {
        let headers = pairs(&[("host", HOST), ("range", "bytes=0-9"), ("x-amz-content-sha256", EMPTY_SHA), ("x-amz-date", DATE)]);
        let req = Signed { method: "GET", path: "/test.txt", query: &[], headers: &headers, payload: EMPTY_SHA };
        assert_eq!(signature(&req, SECRET, DATE, "us-east-1", "s3"), "f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41");
        assert_eq!(
            authorization(&req, KEY, SECRET, DATE, "us-east-1", "s3"),
            "AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41"
        );
    }

    #[test]
    fn a_put_and_a_listing_are_signed_as_amazon_s_examples_are() {
        let body = hex(&Sha256::digest(b"Welcome to Amazon S3."));
        assert_eq!(body, "44ce7dd67c959e0d3524ffac1771dfbba87d2b6b4b4e99e42034a8b803f8b072");
        let headers = pairs(&[("date", "Fri, 24 May 2013 00:00:00 GMT"), ("host", HOST), ("x-amz-content-sha256", &body), ("x-amz-date", DATE), ("x-amz-storage-class", "REDUCED_REDUNDANCY")]);
        let put = Signed { method: "PUT", path: &format!("/{}", uri_encode("test$file.text", true)), query: &[], headers: &headers, payload: &body };
        assert_eq!(put.path, "/test%24file.text");
        assert_eq!(signature(&put, SECRET, DATE, "us-east-1", "s3"), "98ad721746da40c64f1a55b78f14c238d841ea1380cd77a1b5971af0ece108bd");
        let headers = pairs(&[("host", HOST), ("x-amz-content-sha256", EMPTY_SHA), ("x-amz-date", DATE)]);
        let query = pairs(&[("prefix", "J"), ("max-keys", "2")]);
        let listing = Signed { method: "GET", path: "/", query: &query, headers: &headers, payload: EMPTY_SHA };
        assert_eq!(canonical_query(&query), "max-keys=2&prefix=J");
        assert_eq!(signature(&listing, SECRET, DATE, "us-east-1", "s3"), "34b48302e7b5fa45bde8084f4b7868a86f0a534bc59db6670ed5711ef69dc6f7");
    }

    #[test]
    fn a_date_a_region_and_a_path_read_as_they_should() {
        assert_eq!(amz_date(1_369_353_600), "20130524T000000Z");
        assert_eq!(amz_date(0), "19700101T000000Z");
        assert_eq!(amz_date(1_794_043_859), "20261107T093059Z");
        assert_eq!(amz_date(951_782_400 + 86_399), "20000229T235959Z");
        assert_eq!(region_of("s3.eu-west-1.amazonaws.com"), "eu-west-1");
        assert_eq!(region_of("bucket.s3.ap-south-1.amazonaws.com"), "ap-south-1");
        assert_eq!(region_of("s3.amazonaws.com"), "us-east-1");
        assert_eq!(region_of("abc123.r2.cloudflarestorage.com"), "auto");
        assert_eq!(region_of("127.0.0.1:9000"), "us-east-1");
        assert_eq!(uri_encode("devices/0a1b/12", true), "devices/0a1b/12");
        assert_eq!(uri_encode("a b/ç", true), "a%20b/%C3%A7");
        assert_eq!(uri_encode("a/b", false), "a%2Fb");
        assert!(clean("../x").is_err());
        assert!(clean("a//b").is_err());
        assert_eq!(clean("/devices/").unwrap(), "devices");
        let s3 = S3::new("https://s3.example:9000/base/", "notes/ilmi/", "k", "s").unwrap();
        assert_eq!((s3.bucket, s3.prefix.as_str(), s3.host().as_str()), ("notes", "ilmi/", "s3.example:9000"));
        assert_eq!(s3.path(Some("blobs/ab")), "/base/notes/ilmi/blobs/ab");
        assert_eq!(s3.path(None), "/base/notes");
        assert!(S3::new("not an address", "b", "k", "s").is_err());
        assert!(S3::new("https://x", " ", "k", "s").is_err());
    }

    #[test]
    fn a_multistatus_is_read_whatever_its_prefixes() {
        // as Apache's mod_dav writes it, and as Nextcloud does
        let apache = r#"<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
<D:response xmlns:lp1="DAV:"><D:href>/dav/ilmi/devices/</D:href><D:propstat><D:prop><lp1:resourcetype><D:collection/></lp1:resourcetype></D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat></D:response>
<D:response xmlns:lp1="DAV:"><D:href>/dav/ilmi/devices/0a%201b/</D:href><D:propstat><D:prop><lp1:resourcetype><D:collection/></lp1:resourcetype></D:prop></D:propstat></D:response>
<D:response><D:href>/dav/ilmi/devices/format</D:href><D:propstat><D:prop><lp1:resourcetype/></D:prop></D:propstat></D:response>
</D:multistatus>"#;
        assert_eq!(
            multistatus(apache).unwrap(),
            vec![("/dav/ilmi/devices/".to_string(), true), ("/dav/ilmi/devices/0a%201b/".to_string(), true), ("/dav/ilmi/devices/format".to_string(), false)]
        );
        let nextcloud = r#"<?xml version="1.0"?><d:multistatus xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns"><d:response><d:href>/remote.php/dav/files/me/ilmi/</d:href><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response><d:response><d:href>/remote.php/dav/files/me/ilmi/a&amp;b</d:href><d:propstat><d:prop><d:resourcetype/></d:prop></d:propstat></d:response></d:multistatus>"#;
        assert_eq!(multistatus(nextcloud).unwrap(), vec![("/remote.php/dav/files/me/ilmi/".to_string(), true), ("/remote.php/dav/files/me/ilmi/a&b".to_string(), false)]);
    }
}
