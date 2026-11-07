//! Signing in to a service that holds a storage (milestone 64): Dropbox and
//! Google Drive, by OAuth 2.0's code flow with PKCE, in the system browser.
//!
//! **How a sign-in comes back.** On a desk, to a listener on the loopback
//! (`http://localhost:51764/auth` for Dropbox, `http://127.0.0.1:51764/auth`
//! for Google), which is what each service's guide has a desktop app do and
//! which a dev binary has as a bundle does. On iOS the app is not running
//! while the browser is in front, so by a link: `ilmi://auth` for Dropbox,
//! and for Google the only scheme it allows, the client id turned round
//! (`com.googleusercontent.apps.<id>:/oauth2redirect`). Google takes no
//! `ilmi://` on any client. A link reaches `back` through `clipper.ts`.
//!
//! **Where a token is kept.** Here, and never in the web view: what the
//! renderer holds is `account`, a name for an entry of `oauth.json` in the
//! app's own data folder (mode 0600, not in any collection, so in no export
//! or storage). The refresh token and what is needed to use it are written
//! there in the clear, as a file only this user reads; an access token lives
//! in memory. Not the Keychain: an unsigned dev binary's rebuilt signature
//! makes the system ask every time, and nothing here has a signing identity.

use base64::Engine as _;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc, Mutex, OnceLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

/// The one port a sign-in comes back to: Dropbox matches a redirect exactly, so it cannot be any free one.
pub const PORT: u16 = 51764;
/// How long a browser has.
const WAIT: Duration = Duration::from_secs(600);
/// What Dropbox is asked for: list, read, write and delete, inside the app's folder.
const DROPBOX_SCOPE: &str = "files.metadata.read files.content.read files.content.write";
/// Only what this app itself made: nothing else of the person's Drive is seen.
const DRIVE_SCOPE: &str = "https://www.googleapis.com/auth/drive.file";

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Service {
    Dropbox,
    Drive,
}

impl Service {
    fn word(self) -> &'static str {
        match self {
            Service::Dropbox => "dropbox",
            Service::Drive => "google drive",
        }
    }
}

/// Where a service answers. `dev` is a loopback server's address (`devstore.rs`), which a debug build alone listens to.
#[derive(Debug, Clone)]
pub struct Hosts {
    pub authorize: String,
    pub token: String,
    /// Dropbox's RPC host; Drive's `files`.
    pub api: String,
    /// Dropbox's content host; Drive's `upload/…/files`.
    pub content: String,
}

pub fn hosts(service: Service, dev: Option<&str>) -> Hosts {
    match (service, dev.filter(|_| cfg!(debug_assertions))) {
        (Service::Dropbox, None) => Hosts {
            authorize: "https://www.dropbox.com/oauth2/authorize".into(),
            token: "https://api.dropboxapi.com/oauth2/token".into(),
            api: "https://api.dropboxapi.com".into(),
            content: "https://content.dropboxapi.com".into(),
        },
        (Service::Drive, None) => Hosts {
            authorize: "https://accounts.google.com/o/oauth2/v2/auth".into(),
            token: "https://oauth2.googleapis.com/token".into(),
            api: "https://www.googleapis.com/drive/v3/files".into(),
            content: "https://www.googleapis.com/upload/drive/v3/files".into(),
        },
        (Service::Dropbox, Some(d)) => Hosts {
            authorize: format!("{d}/dropbox/www/oauth2/authorize"),
            token: format!("{d}/dropbox/api/oauth2/token"),
            api: format!("{d}/dropbox/api"),
            content: format!("{d}/dropbox/content"),
        },
        (Service::Drive, Some(d)) => Hosts {
            authorize: format!("{d}/drive/accounts/o/oauth2/v2/auth"),
            token: format!("{d}/drive/oauth2/token"),
            api: format!("{d}/drive/api/drive/v3/files"),
            content: format!("{d}/drive/api/upload/drive/v3/files"),
        },
    }
}

/// Where a sign-in comes back to, for a client: the loopback, or a link.
pub fn redirect(service: Service, client: &str, link: bool) -> String {
    match (service, link) {
        (Service::Dropbox, false) => format!("http://localhost:{PORT}/auth"),
        (Service::Drive, false) => format!("http://127.0.0.1:{PORT}/auth"),
        (Service::Dropbox, true) => "ilmi://auth".to_string(),
        (Service::Drive, true) => format!("com.googleusercontent.apps.{}:/oauth2redirect", client.trim_end_matches(".apps.googleusercontent.com")),
    }
}

// ── what is kept ─────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Entry {
    pub service: Service,
    pub client: String,
    /// Google's for a desktop client, which it says is no secret; empty otherwise.
    #[serde(default)]
    pub secret: String,
    pub refresh: String,
    /// A loopback server's address, in a dev run.
    #[serde(default)]
    pub dev: Option<String>,
}

struct Live {
    token: String,
    until: u64,
}

#[derive(Default)]
struct Kept {
    loaded: bool,
    entries: HashMap<String, Entry>,
    live: HashMap<String, Live>,
}

static FILE: OnceLock<PathBuf> = OnceLock::new();
static KEPT: OnceLock<Mutex<Kept>> = OnceLock::new();

/// The folder `oauth.json` is kept in: the app's own, told once at start.
pub fn keep_in(dir: PathBuf) {
    let _ = std::fs::create_dir_all(&dir);
    let _ = FILE.set(dir.join("oauth.json"));
}

fn kept<T>(f: impl FnOnce(&mut Kept) -> T) -> T {
    let mut k = KEPT.get_or_init(Default::default).lock().unwrap_or_else(|e| e.into_inner());
    if !k.loaded {
        k.loaded = true;
        if let Some(raw) = FILE.get().and_then(|p| std::fs::read(p).ok()) {
            k.entries = serde_json::from_slice(&raw).unwrap_or_default();
        }
    }
    f(&mut k)
}

/// Written whole under another name and moved over, readable by this user alone.
fn save(entries: &HashMap<String, Entry>) -> Result<(), String> {
    let Some(file) = FILE.get() else { return Ok(()) };
    let tmp = file.with_extension("part");
    let bytes = serde_json::to_vec(entries).map_err(|e| e.to_string())?;
    {
        use std::io::Write;
        let mut o = std::fs::OpenOptions::new();
        o.write(true).create(true).truncate(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            o.mode(0o600);
        }
        let mut f = o.open(&tmp).map_err(|e| e.to_string())?;
        f.write_all(&bytes).map_err(|e| e.to_string())?;
        f.sync_all().map_err(|e| e.to_string())?;
    }
    std::fs::rename(&tmp, file).map_err(|e| e.to_string())
}

fn random(bytes: usize) -> Result<String, String> {
    let mut b = vec![0u8; bytes];
    getrandom::fill(&mut b).map_err(|e| e.to_string())?;
    Ok(base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(b))
}

fn now() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

/// What is kept for an account; none once it has been signed out from the other end.
pub fn entry(account: &str) -> Option<Entry> {
    kept(|k| k.entries.get(account).cloned())
}

pub fn signed_in(account: &str) -> bool {
    entry(account).is_some()
}

/// `sign out`: what is kept for an account gone, here and in `oauth.json`. A collection that names it then says to sign in again.
pub fn forget(account: &str) -> Result<(), String> {
    kept(|k| {
        k.live.remove(account);
        if k.entries.remove(account).is_some() { save(&k.entries) } else { Ok(()) }
    })
}

/// A refresh token got by other means kept as an account (the tests' `ILMI_TEST_DROPBOX`).
#[cfg(test)]
pub fn adopt(e: Entry) -> String {
    let id = random(12).unwrap();
    kept(|k| k.entries.insert(id.clone(), e));
    id
}

// ── a sign-in ────────────────────────────────────────────────────

struct Waiting {
    state: String,
    tx: mpsc::Sender<Back>,
    stop: Arc<AtomicBool>,
}

/// What came back: the query of the address the browser was sent to.
type Back = HashMap<String, String>;

static WAITING: Mutex<Option<Waiting>> = Mutex::new(None);

fn query_of(url: &str) -> Back {
    let q = url.split_once('?').map(|(_, q)| q).unwrap_or("");
    let q = q.split('#').next().unwrap_or("");
    q.split('&')
        .filter_map(|kv| kv.split_once('='))
        .map(|(k, v)| {
            let v = v.replace('+', " ");
            (k.to_string(), percent_encoding::percent_decode_str(&v).decode_utf8_lossy().into_owned())
        })
        .collect()
}

/// A sign-in's link, arrived. True when one was waiting for it; anything else is left alone.
pub fn back(url: &str) -> bool {
    let q = query_of(url);
    let mut w = WAITING.lock().unwrap_or_else(|e| e.into_inner());
    if w.as_ref().is_some_and(|w| q.get("state") == Some(&w.state)) {
        if let Some(w) = w.take() {
            w.stop.store(true, Ordering::Relaxed);
            let _ = w.tx.send(q);
            return true;
        }
    }
    false
}

const PAGE: &str = "<!doctype html><meta charset=\"utf-8\"><title>ilmi</title><style>body{font:16px/1.5 Georgia,serif;margin:30vh auto;width:20em;text-align:center}</style>";

/// One connection to the loopback listener: a sign-in's return, or something to turn away.
fn answer(stream: std::net::TcpStream, state: &str) -> Option<Back> {
    use std::io::{BufRead, BufReader, Write};
    let _ = stream.set_nonblocking(false);
    let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
    let mut line = String::new();
    BufReader::new(stream.try_clone().ok()?).read_line(&mut line).ok()?;
    let target = line.split_whitespace().nth(1).unwrap_or("/");
    let q = query_of(target);
    let ours = target.split('?').next() == Some("/auth") && q.get("state").map(String::as_str) == Some(state);
    let text = if !ours {
        String::new()
    } else if q.contains_key("code") {
        format!("{PAGE}<p>Signed in. Back to ilmi.</p>")
    } else {
        format!("{PAGE}<p>Not signed in.</p>")
    };
    let head = if ours { "200 OK" } else { "404 Not Found" };
    let mut stream = stream;
    let _ = write!(stream, "HTTP/1.1 {head}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{text}", text.len());
    let _ = stream.flush();
    ours.then_some(q)
}

fn listen(state: String, tx: mpsc::Sender<Back>, stop: Arc<AtomicBool>) -> Result<(), String> {
    // the sign-in before this one lets go of the port a moment after it is told to
    let mut bound = std::net::TcpListener::bind(("127.0.0.1", PORT));
    for _ in 0..20 {
        if bound.is_ok() {
            break;
        }
        std::thread::sleep(Duration::from_millis(50));
        bound = std::net::TcpListener::bind(("127.0.0.1", PORT));
    }
    let listener = bound.map_err(|_| format!("port {PORT} is taken"))?;
    listener.set_nonblocking(true).map_err(|e| e.to_string())?;
    std::thread::spawn(move || {
        while !stop.load(Ordering::Relaxed) {
            match listener.accept() {
                Ok((stream, _)) => {
                    if let Some(q) = answer(stream, &state) {
                        // through the slot a link comes by, so that one or the other is the answer
                        let mut w = WAITING.lock().unwrap_or_else(|e| e.into_inner());
                        if w.as_ref().is_some_and(|w| w.state == state) {
                            *w = None;
                        }
                        let _ = tx.send(q);
                        return;
                    }
                }
                Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => std::thread::sleep(Duration::from_millis(50)),
                Err(_) => return,
            }
        }
    });
    Ok(())
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SignIn {
    pub service: Service,
    pub client: String,
    #[serde(default)]
    pub secret: String,
    /// The account to keep this under, when one was signed in before.
    #[serde(default)]
    pub account: Option<String>,
    /// Come back by a link, not the loopback.
    #[serde(default)]
    pub link: bool,
    #[serde(default)]
    pub dev: Option<String>,
}

/// The address the browser is sent to.
pub fn authorize_url(s: &SignIn, state: &str, challenge: &str) -> String {
    use crate::storage::uri_encode as e;
    let h = hosts(s.service, s.dev.as_deref());
    let mut pairs = vec![
        ("client_id", s.client.trim().to_string()),
        ("response_type", "code".to_string()),
        ("redirect_uri", redirect(s.service, s.client.trim(), s.link)),
        ("state", state.to_string()),
        ("code_challenge", challenge.to_string()),
        ("code_challenge_method", "S256".to_string()),
    ];
    match s.service {
        Service::Dropbox => {
            pairs.push(("token_access_type", "offline".to_string()));
            pairs.push(("scope", DROPBOX_SCOPE.to_string()));
        }
        Service::Drive => {
            pairs.push(("access_type", "offline".to_string()));
            // Google gives a refresh token at the first consent only, unless it is asked for the consent again
            pairs.push(("prompt", "consent".to_string()));
            pairs.push(("scope", DRIVE_SCOPE.to_string()));
        }
    }
    let q = pairs.iter().map(|(k, v)| format!("{k}={}", e(v, false))).collect::<Vec<_>>().join("&");
    format!("{}?{q}", h.authorize)
}

#[derive(Deserialize)]
struct Granted {
    access_token: String,
    #[serde(default)]
    refresh_token: Option<String>,
    #[serde(default)]
    expires_in: Option<u64>,
}

fn form(pairs: &[(&str, &str)]) -> String {
    pairs.iter().map(|(k, v)| format!("{k}={}", crate::storage::uri_encode(v, false))).collect::<Vec<_>>().join("&")
}

async fn token_request(url: &str, body: String) -> Result<Result<Granted, String>, String> {
    let res = crate::storage::http()
        .post(url)
        .header("content-type", "application/x-www-form-urlencoded")
        .body(body)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let status = res.status();
    let text = res.text().await.map_err(|e| e.to_string())?;
    if status.is_success() {
        return Ok(Ok(serde_json::from_str(&text).map_err(|e| e.to_string())?));
    }
    // both services say why as `error`, an OAuth word
    let why = serde_json::from_str::<serde_json::Value>(&text).ok().and_then(|v| v["error"].as_str().map(String::from)).unwrap_or_else(|| status.as_u16().to_string());
    Ok(Err(why))
}

/// The whole of a sign-in: `open` is handed the address for the browser; what comes back is exchanged and kept. The account's name, to go in the settings.
pub async fn sign_in(s: SignIn, open: impl FnOnce(String) -> Result<(), String>) -> Result<String, String> {
    if s.client.trim().is_empty() {
        return Err("no client named".to_string());
    }
    let state = random(16)?;
    let verifier = random(48)?;
    let challenge = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
    let (tx, rx) = mpsc::channel();
    let stop = Arc::new(AtomicBool::new(false));
    // one sign-in at a time: a second press starts again
    {
        let mut w = WAITING.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(was) = w.take() {
            was.stop.store(true, Ordering::Relaxed);
        }
        *w = Some(Waiting { state: state.clone(), tx: tx.clone(), stop: stop.clone() });
    }
    if !s.link {
        listen(state.clone(), tx.clone(), stop.clone())?;
    }
    drop(tx);
    let url = authorize_url(&s, &state, &challenge);
    if let Err(e) = open(url) {
        stop.store(true, Ordering::Relaxed);
        return Err(e);
    }
    let got = tauri::async_runtime::spawn_blocking(move || rx.recv_timeout(WAIT)).await.map_err(|e| e.to_string())?;
    stop.store(true, Ordering::Relaxed);
    let q = got.map_err(|_| "not signed in".to_string())?;
    let Some(code) = q.get("code") else { return Err("not signed in".to_string()) };

    let client = s.client.trim().to_string();
    let secret = s.secret.trim().to_string();
    let back_to = redirect(s.service, &client, s.link);
    let h = hosts(s.service, s.dev.as_deref());
    let mut pairs = vec![("grant_type", "authorization_code"), ("code", code.as_str()), ("redirect_uri", back_to.as_str()), ("client_id", client.as_str()), ("code_verifier", verifier.as_str())];
    if !secret.is_empty() {
        pairs.push(("client_secret", secret.as_str()));
    }
    let granted = token_request(&h.token, form(&pairs)).await?.map_err(|why| format!("{}: {why}", s.service.word()))?;
    let refresh = granted.refresh_token.ok_or_else(|| format!("{}: no refresh token", s.service.word()))?;
    let account = match s.account.filter(|a| !a.is_empty()) {
        Some(a) => a,
        None => random(12)?,
    };
    let e = Entry { service: s.service, client, secret, refresh, dev: s.dev.filter(|_| cfg!(debug_assertions)) };
    kept(|k| {
        k.entries.insert(account.clone(), e);
        k.live.insert(account.clone(), Live { token: granted.access_token, until: now() + granted.expires_in.unwrap_or(3600) });
        save(&k.entries)
    })?;
    Ok(account)
}

// ── a token to use ───────────────────────────────────────────────

/// Said when the service has let go of the sign-in; the renderer takes these words to clear the account.
pub const GONE: &str = "sign in again";

/// A good access token for `account`, refreshed when the one held is near its end.
pub async fn bearer(account: &str) -> Result<String, String> {
    let held = kept(|k| k.live.get(account).filter(|l| l.until > now() + 60).map(|l| l.token.clone()));
    if let Some(t) = held {
        return Ok(t);
    }
    let e = entry(account).ok_or_else(|| GONE.to_string())?;
    let mut pairs = vec![("grant_type", "refresh_token"), ("refresh_token", e.refresh.as_str()), ("client_id", e.client.as_str())];
    if !e.secret.is_empty() {
        pairs.push(("client_secret", e.secret.as_str()));
    }
    let url = hosts(e.service, e.dev.as_deref()).token;
    match token_request(&url, form(&pairs)).await? {
        Ok(g) => {
            let token = g.access_token.clone();
            let turned = g.refresh_token.filter(|r| *r != e.refresh);
            kept(|k| {
                k.live.insert(account.to_string(), Live { token: g.access_token, until: now() + g.expires_in.unwrap_or(3600) });
                // a refresh token may be replaced by its service, Google's in particular
                match (turned, k.entries.get_mut(account)) {
                    (Some(r), Some(en)) => {
                        en.refresh = r;
                        save(&k.entries)
                    }
                    _ => Ok(()),
                }
            })?;
            Ok(token)
        }
        // revoked, or Google's seven days for an app still in testing
        Err(why) if why == "invalid_grant" => {
            kept(|k| {
                k.live.remove(account);
                k.entries.remove(account);
                save(&k.entries)
            })?;
            Err(GONE.to_string())
        }
        Err(why) => Err(format!("{}: {why}", e.service.word())),
    }
}

/// A token the service refused: the next `bearer` gets another. Left alone if it has been replaced already.
pub fn spoil(account: &str, token: &str) {
    kept(|k| {
        if k.live.get(account).is_some_and(|l| l.token == token) {
            k.live.remove(account);
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn signing_out_forgets_the_account() {
        let id = adopt(Entry { service: Service::Dropbox, client: "k".to_string(), secret: String::new(), refresh: "r".to_string(), dev: None });
        assert!(signed_in(&id));
        forget(&id).unwrap();
        assert!(!signed_in(&id));
        forget(&id).unwrap();
    }

    #[test]
    fn a_way_back_for_each_service() {
        assert_eq!(redirect(Service::Dropbox, "k", false), "http://localhost:51764/auth");
        assert_eq!(redirect(Service::Drive, "1-a.apps.googleusercontent.com", false), "http://127.0.0.1:51764/auth");
        assert_eq!(redirect(Service::Dropbox, "k", true), "ilmi://auth");
        assert_eq!(redirect(Service::Drive, "1-a.apps.googleusercontent.com", true), "com.googleusercontent.apps.1-a:/oauth2redirect");
        assert_eq!(query_of("ilmi://auth?code=a%2Fb&state=c+d#x").get("code").map(String::as_str), Some("a/b"));
        assert_eq!(query_of("ilmi://auth?code=a%2Fb&state=c+d#x").get("state").map(String::as_str), Some("c d"));
    }

    #[test]
    fn the_real_hosts_unless_a_debug_build_is_told_otherwise() {
        assert_eq!(hosts(Service::Dropbox, None).content, "https://content.dropboxapi.com");
        assert_eq!(hosts(Service::Drive, None).token, "https://oauth2.googleapis.com/token");
        assert!(hosts(Service::Drive, Some("http://127.0.0.1:1")).api.starts_with("http://127.0.0.1:1/drive/"));
    }

    #[test]
    fn the_address_asks_for_what_each_service_wants() {
        let s = SignIn { service: Service::Dropbox, client: " key ".into(), secret: String::new(), account: None, link: false, dev: None };
        let u = authorize_url(&s, "st", "ch");
        assert!(u.starts_with("https://www.dropbox.com/oauth2/authorize?client_id=key&"), "{u}");
        for part in ["response_type=code", "token_access_type=offline", "code_challenge=ch", "code_challenge_method=S256", "state=st", "redirect_uri=http%3A%2F%2Flocalhost%3A51764%2Fauth"] {
            assert!(u.contains(part), "{part} in {u}");
        }
        let s = SignIn { service: Service::Drive, client: "1-a.apps.googleusercontent.com".into(), secret: "x".into(), account: None, link: true, dev: None };
        let u = authorize_url(&s, "st", "ch");
        assert!(u.starts_with("https://accounts.google.com/o/oauth2/v2/auth?"), "{u}");
        for part in ["access_type=offline", "prompt=consent", "scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive.file", "redirect_uri=com.googleusercontent.apps.1-a%3A%2Foauth2redirect"] {
            assert!(u.contains(part), "{part} in {u}");
        }
        assert!(!u.contains("secret"), "a secret is no part of the address");
    }
}
