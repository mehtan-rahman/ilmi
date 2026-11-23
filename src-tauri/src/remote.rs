//! The phone as a remote (milestone 90): while a Mac shows its remote code, a
//! small HTTP server on the local network lets a phone press the session's
//! buttons. Every path starts with a token made when the server starts
//! (128 random bits, base64url), and anything else is a 404.
//!
//! `GET /<token>` is the remote's page, as the app handed it over
//! (`remote_start`); `GET /<token>/events` is a stream of server-sent events,
//! one `data:` line a state (the JSON the app wrote last, sent again on a
//! connect; `{"stopped":true}` last when the server stops), with a comment every 15 s so a dead phone is noticed; `POST
//! /<token>/press` takes the JSON of a press and hands it to the app as the
//! `remote-press` event. The app is told how many phones are connected by
//! `remote-clients`. Nothing is kept on disk: the token lives as long as the
//! server, and a stop closes every stream.

use base64::Engine;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{Shutdown, TcpListener, TcpStream, UdpSocket};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

/// The port tried first, so a phone's page reloads at the same address across a restart of the server; any free one after.
const PORT: u16 = 51765;
/// A press, or anything else sent, is small: a body over this is refused.
const BODY_MAX: usize = 4096;

struct Running {
    url: String,
    port: u16,
    stop: Arc<AtomicBool>,
}

#[derive(Default)]
struct Shared {
    running: Option<Running>,
    page: String,
    state: String,
    streams: Vec<TcpStream>,
}

static SHARED: Mutex<Option<Shared>> = Mutex::new(None);
static APP: OnceLock<AppHandle> = OnceLock::new();

fn with<T>(f: impl FnOnce(&mut Shared) -> T) -> T {
    let mut g = SHARED.lock().unwrap_or_else(|e| e.into_inner());
    f(g.get_or_insert_with(Shared::default))
}

/// The address phones on this network reach the Mac at: the interface a packet out would leave by (nothing is sent).
fn lan_ip() -> String {
    let found = UdpSocket::bind("0.0.0.0:0").and_then(|s| {
        s.connect("10.254.254.254:1")?;
        s.local_addr()
    });
    match found {
        Ok(a) if !a.ip().is_loopback() && !a.ip().is_unspecified() => a.ip().to_string(),
        _ => "127.0.0.1".into(),
    }
}

fn token() -> Result<String, String> {
    let mut b = [0u8; 16];
    getrandom::fill(&mut b).map_err(|e| e.to_string())?;
    Ok(base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(b))
}

/// Start the server (or keep the one running) with `page` as the remote's page; its address, the token in its path.
pub fn start(app: AppHandle, page: String) -> Result<serde_json::Value, String> {
    let _ = APP.set(app);
    if let Some(r) = with(|s| {
        s.page = page.clone();
        s.running.as_ref().map(|r| (r.url.clone(), r.port))
    }) {
        return Ok(serde_json::json!({ "url": r.0, "port": r.1 }));
    }
    let listener = TcpListener::bind(("0.0.0.0", PORT)).or_else(|_| TcpListener::bind(("0.0.0.0", 0))).map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    let tok = token()?;
    let url = format!("http://{}:{port}/{tok}", lan_ip());
    let stop = Arc::new(AtomicBool::new(false));
    with(|s| {
        s.running = Some(Running { url: url.clone(), port, stop: stop.clone() });
        s.state.clear();
    });
    let accept_stop = stop.clone();
    std::thread::spawn(move || {
        for conn in listener.incoming() {
            if accept_stop.load(Ordering::SeqCst) {
                break;
            }
            if let Ok(conn) = conn {
                let tok = tok.clone();
                std::thread::spawn(move || handle(conn, &tok));
            }
        }
    });
    let beat_stop = stop;
    std::thread::spawn(move || {
        while !beat_stop.load(Ordering::SeqCst) {
            std::thread::sleep(Duration::from_secs(15));
            broadcast(": k\n\n");
        }
    });
    Ok(serde_json::json!({ "url": url, "port": port }))
}

/// Stop the server: every phone's stream is closed and the token is gone.
pub fn stop() {
    // every phone is told it was stopped, not lost, so it does not keep trying
    let last = chunk("data: {\"stopped\":true}\n\n");
    let was = with(|s| {
        for mut st in s.streams.drain(..) {
            let _ = st.write_all(&last).and_then(|_| st.flush());
            let _ = st.shutdown(Shutdown::Both);
        }
        s.state.clear();
        s.running.take()
    });
    if let Some(r) = was {
        r.stop.store(true, Ordering::SeqCst);
        // the accept loop is woken to see the flag
        let _ = TcpStream::connect_timeout(&([127, 0, 0, 1], r.port).into(), Duration::from_millis(300));
    }
    clients_changed();
}

/// What the remote shows now: sent to every phone, and to each one that connects after.
pub fn set_state(json: String) {
    let line = format!("data: {}\n\n", json.replace('\n', " "));
    with(|s| s.state = json);
    broadcast(&line);
}

/// How many phones have the stream open.
pub fn clients() -> usize {
    with(|s| s.streams.len())
}

fn clients_changed() {
    if let Some(app) = APP.get() {
        let _ = app.emit("remote-clients", clients());
    }
}

fn chunk(s: &str) -> Vec<u8> {
    format!("{:x}\r\n{s}\r\n", s.len()).into_bytes()
}

fn broadcast(text: &str) {
    let bytes = chunk(text);
    let before = clients();
    with(|s| s.streams.retain_mut(|st| st.write_all(&bytes).and_then(|_| st.flush()).is_ok()));
    if clients() != before {
        clients_changed();
    }
}

fn respond(mut conn: TcpStream, status: &str, kind: &str, body: &[u8]) {
    let head = format!("HTTP/1.1 {status}\r\nContent-Type: {kind}\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n", body.len());
    let _ = conn.write_all(head.as_bytes());
    let _ = conn.write_all(body);
    let _ = conn.flush();
}

fn handle(conn: TcpStream, tok: &str) {
    let _ = conn.set_read_timeout(Some(Duration::from_secs(10)));
    let mut reader = BufReader::new(match conn.try_clone() {
        Ok(c) => c,
        Err(_) => return,
    });
    let mut line = String::new();
    if reader.read_line(&mut line).is_err() {
        return;
    }
    let mut parts = line.split_whitespace();
    let (method, target) = (parts.next().unwrap_or(""), parts.next().unwrap_or(""));
    let mut length = 0usize;
    loop {
        let mut h = String::new();
        if reader.read_line(&mut h).is_err() || h.trim().is_empty() {
            break;
        }
        if let Some((k, v)) = h.split_once(':') {
            if k.trim().eq_ignore_ascii_case("content-length") {
                length = v.trim().parse().unwrap_or(usize::MAX);
            }
        }
    }
    let path = target.split('?').next().unwrap_or("");
    let rest = match path.strip_prefix('/').and_then(|p| p.strip_prefix(tok)) {
        Some(r) if !tok.is_empty() => r,
        _ => return respond(conn, "404 Not Found", "text/plain", b"not found"),
    };
    match (method, rest) {
        ("GET", "" | "/") => {
            let page = with(|s| s.page.clone());
            respond(conn, "200 OK", "text/html; charset=utf-8", page.as_bytes());
        }
        ("GET", "/events") => {
            let mut conn = conn;
            let _ = conn.set_read_timeout(None);
            let _ = conn.set_write_timeout(Some(Duration::from_secs(5)));
            let head = "HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nCache-Control: no-store\r\nTransfer-Encoding: chunked\r\nConnection: keep-alive\r\n\r\n";
            let state = with(|s| s.state.clone());
            let mut first = chunk("retry: 1000\n\n");
            if !state.is_empty() {
                first.extend(chunk(&format!("data: {}\n\n", state.replace('\n', " "))));
            }
            if conn.write_all(head.as_bytes()).and_then(|_| conn.write_all(&first)).and_then(|_| conn.flush()).is_err() {
                return;
            }
            with(|s| s.streams.push(conn));
            clients_changed();
        }
        ("POST", "/press") => {
            if length > BODY_MAX {
                return respond(conn, "413 Payload Too Large", "text/plain", b"too large");
            }
            let mut body = vec![0u8; length];
            if reader.read_exact(&mut body).is_err() {
                return respond(conn, "400 Bad Request", "text/plain", b"bad request");
            }
            match serde_json::from_slice::<serde_json::Value>(&body) {
                Ok(v) if v.is_object() => {
                    if let Some(app) = APP.get() {
                        let _ = app.emit("remote-press", v);
                    }
                    respond(conn, "204 No Content", "text/plain", b"");
                }
                _ => respond(conn, "400 Bad Request", "text/plain", b"bad request"),
            }
        }
        _ => respond(conn, "404 Not Found", "text/plain", b"not found"),
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn a_chunk_is_its_length_in_hex_then_itself() {
        assert_eq!(super::chunk("data: {}\n\n"), b"a\r\ndata: {}\n\n\r\n".to_vec());
    }

    #[test]
    fn a_token_is_22_url_safe_characters() {
        let t = super::token().unwrap();
        assert_eq!(t.len(), 22);
        assert!(t.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_'));
    }
}
