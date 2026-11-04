//! Dev only: a small ntfy-shaped server on the loopback for the nudge
//! smoke (milestone 54), so the check runs with no network and no public
//! topic. `POST /<topic>` with the message as the body; `GET /<topic>/sse`
//! answers with server-sent events, chunked, an `open` event first and one
//! `message` event per publish, as ntfy writes them. `drop_all` closes
//! every stream, for the reconnect check. One server per process, started
//! on first use.

use std::io::{BufRead, BufReader, Read, Write};
use std::net::{Shutdown, TcpListener, TcpStream};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};

static URL: OnceLock<String> = OnceLock::new();
static STREAMS: Mutex<Vec<(String, TcpStream)>> = Mutex::new(Vec::new());
static SEQ: AtomicU64 = AtomicU64::new(1);

/// Start the server if it is not running; its address either way.
pub fn serve() -> Result<String, String> {
    if let Some(url) = URL.get() {
        return Ok(url.clone());
    }
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    std::thread::spawn(move || {
        for stream in listener.incoming().flatten() {
            std::thread::spawn(move || handle(stream));
        }
    });
    Ok(URL.get_or_init(|| format!("http://127.0.0.1:{port}")).clone())
}

/// Close every subscriber's stream: what a dropped connection looks like.
pub fn drop_all() -> usize {
    let mut streams = STREAMS.lock().unwrap_or_else(|e| e.into_inner());
    let n = streams.len();
    for (_, s) in streams.drain(..) {
        let _ = s.shutdown(Shutdown::Both);
    }
    n
}

/// How many streams are open on `topic`.
pub fn listeners(topic: &str) -> usize {
    STREAMS.lock().unwrap_or_else(|e| e.into_inner()).iter().filter(|(t, _)| t == topic).count()
}

fn handle(stream: TcpStream) {
    let mut reader = BufReader::new(match stream.try_clone() {
        Ok(s) => s,
        Err(_) => return,
    });
    let mut line = String::new();
    if reader.read_line(&mut line).is_err() {
        return;
    }
    let mut parts = line.split_whitespace();
    let method = parts.next().unwrap_or("").to_string();
    let path = parts.next().unwrap_or("/").split('?').next().unwrap_or("/").to_string();
    let mut length = 0usize;
    loop {
        let mut h = String::new();
        if reader.read_line(&mut h).is_err() || h == "\r\n" || h == "\n" || h.is_empty() {
            break;
        }
        if let Some(v) = h.to_ascii_lowercase().strip_prefix("content-length:") {
            length = v.trim().parse().unwrap_or(0);
        }
    }
    let mut stream = stream;
    match method.as_str() {
        "GET" if path.ends_with("/sse") => {
            let topic = path[1..path.len() - 4].to_string();
            let head = "HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nCache-Control: no-cache\r\nConnection: keep-alive\r\nTransfer-Encoding: chunked\r\nAccess-Control-Allow-Origin: *\r\n\r\n";
            let open = event("open", &topic, "");
            if stream.write_all(head.as_bytes()).is_err() || stream.write_all(chunk(&open).as_bytes()).is_err() || stream.flush().is_err() {
                return;
            }
            STREAMS.lock().unwrap_or_else(|e| e.into_inner()).push((topic, stream));
        }
        "POST" => {
            let mut body = vec![0u8; length];
            if reader.read_exact(&mut body).is_err() {
                return;
            }
            let topic = path.trim_start_matches('/').to_string();
            let message = String::from_utf8_lossy(&body).into_owned();
            let ev = event("message", &topic, &message);
            let data = chunk(&ev);
            let mut streams = STREAMS.lock().unwrap_or_else(|e| e.into_inner());
            streams.retain_mut(|(t, s)| t != &topic || (s.write_all(data.as_bytes()).is_ok() && s.flush().is_ok()));
            respond(&mut stream, "200 OK", &ev);
        }
        "OPTIONS" => {
            let _ = stream.write_all(b"HTTP/1.1 204 No Content\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST\r\nAccess-Control-Allow-Headers: *\r\nContent-Length: 0\r\n\r\n");
        }
        _ => respond(&mut stream, "404 Not Found", "{}"),
    }
}

fn respond(stream: &mut TcpStream, status: &str, body: &str) {
    let _ = stream.write_all(format!("HTTP/1.1 {status}\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nContent-Length: {}\r\n\r\n{body}", body.len()).as_bytes());
    let _ = stream.flush();
}

/// One event, as ntfy's JSON.
fn event(kind: &str, topic: &str, message: &str) -> String {
    let time = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    let id = SEQ.fetch_add(1, Ordering::Relaxed);
    let mut o = serde_json::json!({ "id": format!("n{id}"), "time": time, "event": kind, "topic": topic });
    if kind == "message" {
        o["message"] = serde_json::Value::String(message.to_string());
    }
    o.to_string()
}

/// A chunk of the stream: `event: <kind>` and `data: <json>`, then the blank line, in chunked encoding.
fn chunk(json: &str) -> String {
    let kind = serde_json::from_str::<serde_json::Value>(json).ok().and_then(|v| v["event"].as_str().map(str::to_string)).unwrap_or_default();
    let body = format!("event: {kind}\ndata: {json}\n\n");
    format!("{:x}\r\n{body}\r\n", body.len())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    fn get(url: &str, path: &str) -> TcpStream {
        let addr = url.trim_start_matches("http://");
        let mut s = TcpStream::connect(addr).unwrap();
        s.write_all(format!("GET {path} HTTP/1.1\r\nHost: x\r\nAccept: text/event-stream\r\n\r\n").as_bytes()).unwrap();
        s
    }

    fn post(url: &str, path: &str, body: &str) -> String {
        let addr = url.trim_start_matches("http://");
        let mut s = TcpStream::connect(addr).unwrap();
        s.write_all(format!("POST {path} HTTP/1.1\r\nHost: x\r\nContent-Length: {}\r\n\r\n{body}", body.len()).as_bytes()).unwrap();
        let mut out = String::new();
        s.set_read_timeout(Some(Duration::from_secs(2))).unwrap();
        let _ = s.read_to_string(&mut out);
        out
    }

    fn read_some(s: &mut TcpStream) -> String {
        s.set_read_timeout(Some(Duration::from_millis(500))).unwrap();
        let mut buf = [0u8; 4096];
        let mut out = String::new();
        while let Ok(n) = s.read(&mut buf) {
            if n == 0 {
                break;
            }
            out.push_str(&String::from_utf8_lossy(&buf[..n]));
        }
        out
    }

    #[test]
    fn a_publish_reaches_the_topic_s_subscribers_and_no_other() {
        let url = serve().unwrap();
        let mut a = get(&url, "/ilmi-aaaa/sse");
        let mut b = get(&url, "/ilmi-bbbb/sse");
        let head = read_some(&mut a);
        assert!(head.starts_with("HTTP/1.1 200 OK"), "{head}");
        assert!(head.contains("event: open"), "{head}");
        read_some(&mut b);
        assert_eq!(listeners("ilmi-aaaa"), 1);
        let reply = post(&url, "/ilmi-aaaa", "changed from 12345678");
        assert!(reply.starts_with("HTTP/1.1 200 OK"), "{reply}");
        let got = read_some(&mut a);
        assert!(got.contains("event: message") && got.contains("\"message\":\"changed from 12345678\"") && got.contains("\"topic\":\"ilmi-aaaa\""), "{got}");
        assert_eq!(read_some(&mut b), "");
        assert!(drop_all() >= 2);
        assert_eq!(read_some(&mut a), "");
        assert_eq!(listeners("ilmi-aaaa"), 0);
    }
}
