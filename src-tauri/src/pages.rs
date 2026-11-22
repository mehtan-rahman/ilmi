//! A PDF's pages drawn for the reader (`ilmipage:`): whole pages small (`k=low`, `k=mid`) and pieces of a page at the
//! size it is shown (`k=tile`), each by Core Graphics (`tauri_plugin_ink::pdf_region`).
//!
//! The drawing is done by a few worker threads at once, about as many as the device has cores, taking the asking
//! with the least `p` first (the reader says how near the middle of the view a piece is), so a screen's tiles are
//! drawn together and the one under the eye first. An asking of a generation the reader has gone past (`g`, set by
//! [`set_generation`] at each zoom) is not drawn. Whole pages are kept on disk (a small cache under the app's caches,
//! let go oldest first past [`DISK_MOST`]) and the latest pictures in memory, so a page seen once comes back at once.
//! Each drawing is written down in the zoom log ([`note`]) with what it was, its pixels and how long it took.

use std::collections::{BinaryHeap, HashMap, VecDeque};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU32, AtomicUsize, Ordering};
use std::sync::{Arc, Condvar, Mutex, OnceLock};
use std::time::Instant;

/// The most the disk cache of whole pages holds, bytes.
const DISK_MOST: u64 = 160 << 20;
/// The most the memory cache holds, bytes.
const MEMORY_MOST: usize = 64 << 20;
/// The zoom log is begun anew past this (the one before kept beside it): about a megabyte in all.
const LOG_MOST: u64 = 512 << 10;

/// What an asking is for, from its address.
#[derive(Debug, Clone, PartialEq)]
pub struct Ask {
    pub hash: String,
    pub page: u32,
    pub root: String,
    /// The page's width as drawn, pixels.
    pub width: u32,
    pub quality: f64,
    /// The piece of it (`x y w h`); all of it at `w` 0.
    pub at: (u32, u32, u32, u32),
    /// `low`, `mid` or `tile`.
    pub kind: String,
    /// `jpg`, `png` or `bmp`.
    pub format: String,
    /// The lower the sooner.
    pub priority: i64,
    /// The reader's generation for this book when it asked; 0: always drawn.
    pub generation: u32,
    /// Whose generations they are (`gk`: a reader, a book open in it): the book's own where none is said.
    pub generations_of: String,
}

/// An address read: `ilmipage://localhost/<hash>/<page>?root=…&w=…&q=…[&x=&y=&tw=&th=][&k=][&f=][&p=][&g=]`.
pub fn parse(path: &str, query: &str) -> Result<Ask, String> {
    let mut segs = path.trim_matches('/').split('/');
    let hash = segs.next().unwrap_or_default().to_string();
    let page: u32 = segs.next().and_then(|n| n.parse().ok()).ok_or("no page named")?;
    let mut a = Ask { hash, page, root: String::new(), width: 0, quality: 0.8, at: (0, 0, 0, 0), kind: "low".into(), format: String::new(), priority: 50, generation: 0, generations_of: String::new() };
    for pair in query.split('&') {
        let (k, v) = pair.split_once('=').unwrap_or((pair, ""));
        let num = |v: &str| v.parse::<u32>().map_err(|_| format!("{k}: not a number"));
        match k {
            "root" => a.root = percent_encoding::percent_decode_str(v).decode_utf8().map_err(|e| e.to_string())?.into_owned(),
            "w" => a.width = num(v)?,
            "q" => a.quality = v.parse().map_err(|_| "no quality")?,
            "x" => a.at.0 = num(v)?,
            "y" => a.at.1 = num(v)?,
            "tw" => a.at.2 = num(v)?,
            "th" => a.at.3 = num(v)?,
            "k" => a.kind = v.to_string(),
            "f" => a.format = v.to_string(),
            "p" => a.priority = v.parse().map_err(|_| "no priority")?,
            "g" => a.generation = num(v)?,
            "gk" => a.generations_of = v.to_string(),
            _ => {}
        }
    }
    if a.width == 0 {
        return Err("no width".into());
    }
    if a.generations_of.is_empty() {
        a.generations_of = a.hash.clone();
    }
    if a.format.is_empty() {
        a.format = if a.quality >= 1.0 { "png".into() } else { "jpg".into() };
    }
    Ok(a)
}

impl Ask {
    pub fn picture_kind(&self) -> tauri_plugin_ink::PictureKind {
        match self.format.as_str() {
            "bmp" => tauri_plugin_ink::PictureKind::Bmp,
            "png" => tauri_plugin_ink::PictureKind::Png,
            _ => tauri_plugin_ink::PictureKind::Jpeg(self.quality.clamp(0.1, 0.99)),
        }
    }
    pub fn mime(&self) -> &'static str {
        match self.format.as_str() { "bmp" => "image/bmp", "png" => "image/png", _ => "image/jpeg" }
    }
    /// What the picture is known by in the caches.
    pub fn key(&self) -> String {
        format!("{}/{}-{}-{}-{}-{}-{}-{}.{}", self.hash, self.page, self.width, self.at.0, self.at.1, self.at.2, self.at.3, (self.quality * 100.0).round(), self.format)
    }
    /// Whole pages are kept on disk; tiles are not (a zoom's tiles are many and seldom asked twice).
    pub fn kept_on_disk(&self) -> bool {
        self.at.2 == 0 && self.kind != "tile"
    }
}

/// The reader's latest generation for each book: an asking older than it is not drawn.
fn generations() -> &'static Mutex<HashMap<String, u32>> {
    static G: OnceLock<Mutex<HashMap<String, u32>>> = OnceLock::new();
    G.get_or_init(|| Mutex::new(HashMap::new()))
}

/// The reader has zoomed (or gone far): what it asked for before generation `g` of `hash` (a book open in a reader, `gk`) is no longer wanted.
pub fn set_generation(hash: &str, g: u32) {
    let mut m = generations().lock().unwrap();
    let e = m.entry(hash.to_string()).or_insert(0);
    *e = (*e).max(g);
}

fn stale(a: &Ask) -> bool {
    a.generation != 0 && generations().lock().unwrap().get(&a.generations_of).is_some_and(|&g| a.generation < g)
}

// ── the workers ──

struct Job {
    priority: i64,
    seq: u64,
    asked: Instant,
    run: Box<dyn FnOnce(f64, usize) + Send>,
}
impl PartialEq for Job { fn eq(&self, o: &Self) -> bool { self.priority == o.priority && self.seq == o.seq } }
impl Eq for Job {}
impl PartialOrd for Job { fn partial_cmp(&self, o: &Self) -> Option<std::cmp::Ordering> { Some(self.cmp(o)) } }
// (a max-heap: the least priority, then the earliest asked, is the greatest)
impl Ord for Job { fn cmp(&self, o: &Self) -> std::cmp::Ordering { o.priority.cmp(&self.priority).then(o.seq.cmp(&self.seq)) } }

struct Pool {
    queue: Mutex<(BinaryHeap<Job>, u64, usize)>,
    ready: Condvar,
}

/// How many drawings go on at once: about as many as the cores, two at least, eight at most.
pub fn workers() -> usize {
    std::thread::available_parallelism().map(|n| n.get()).unwrap_or(4).clamp(2, 8)
}
/// (dev) How many of the workers draw (fewer, to stand for a device with fewer cores), 0 for all.
static DEV_WORKERS: AtomicUsize = AtomicUsize::new(0);
/// (dev) Each drawing held back to this many hundredths of the time it took (300: as a processor three times slower).
static DEV_SLOW: AtomicU32 = AtomicU32::new(100);
pub fn dev_slow(factor: f64, workers: usize) {
    DEV_SLOW.store((factor.max(1.0) * 100.0) as u32, Ordering::SeqCst);
    DEV_WORKERS.store(workers, Ordering::SeqCst);
    pool().ready.notify_all();
}

fn pool() -> &'static Arc<Pool> {
    static P: OnceLock<Arc<Pool>> = OnceLock::new();
    P.get_or_init(|| {
        let p = Arc::new(Pool { queue: Mutex::new((BinaryHeap::new(), 0, 0)), ready: Condvar::new() });
        for i in 0..workers() {
            let p = p.clone();
            std::thread::Builder::new().name(format!("ilmipage-{i}")).spawn(move || loop {
                let (job, depth) = {
                    let mut q = p.queue.lock().unwrap();
                    loop {
                        let most = match DEV_WORKERS.load(Ordering::SeqCst) { 0 => usize::MAX, n => n };
                        if !q.0.is_empty() && q.2 < most { break; }
                        q = p.ready.wait(q).unwrap();
                    }
                    q.2 += 1;
                    let depth = q.0.len();
                    (q.0.pop().unwrap(), depth)
                };
                let waited = job.asked.elapsed().as_secs_f64() * 1000.0;
                (job.run)(waited, depth);
                p.queue.lock().unwrap().2 -= 1;
                p.ready.notify_one();
            }).expect("a worker thread");
        }
        p
    })
}

/// `run` on a worker when its turn comes: given how long it waited, ms, and how many were waiting behind it.
pub fn queue(priority: i64, run: impl FnOnce(f64, usize) + Send + 'static) {
    let p = pool();
    let mut q = p.queue.lock().unwrap();
    q.1 += 1;
    let seq = q.1;
    q.0.push(Job { priority, seq, asked: Instant::now(), run: Box::new(run) });
    drop(q);
    p.ready.notify_one();
}

// ── the caches ──

fn memory() -> &'static Mutex<(HashMap<String, Arc<Vec<u8>>>, VecDeque<String>, usize)> {
    static M: OnceLock<Mutex<(HashMap<String, Arc<Vec<u8>>>, VecDeque<String>, usize)>> = OnceLock::new();
    M.get_or_init(|| Mutex::new((HashMap::new(), VecDeque::new(), 0)))
}
fn remember(key: &str, bytes: Arc<Vec<u8>>) {
    let mut m = memory().lock().unwrap();
    if let Some(old) = m.0.insert(key.to_string(), bytes.clone()) { m.2 -= old.len(); m.1.retain(|k| k != key); }
    m.2 += bytes.len();
    m.1.push_back(key.to_string());
    while m.2 > MEMORY_MOST {
        let Some(k) = m.1.pop_front() else { break };
        if let Some(b) = m.0.remove(&k) { m.2 -= b.len(); }
    }
}
fn recall(key: &str) -> Option<Arc<Vec<u8>>> {
    memory().lock().unwrap().0.get(key).cloned()
}

/// Where whole pages are kept on disk, and how much is there (read once, then counted).
fn disk() -> &'static Mutex<Option<(PathBuf, u64)>> {
    static D: OnceLock<Mutex<Option<(PathBuf, u64)>>> = OnceLock::new();
    D.get_or_init(|| Mutex::new(None))
}
pub fn set_disk(dir: PathBuf) {
    let size = walk(&dir).iter().map(|(_, n, _)| n).sum();
    *disk().lock().unwrap() = Some((dir, size));
}
fn walk(dir: &Path) -> Vec<(PathBuf, u64, std::time::SystemTime)> {
    let mut out = vec![];
    for book in std::fs::read_dir(dir).into_iter().flatten().flatten() {
        for f in std::fs::read_dir(book.path()).into_iter().flatten().flatten() {
            if let Ok(m) = f.metadata() { out.push((f.path(), m.len(), m.modified().unwrap_or(std::time::UNIX_EPOCH))); }
        }
    }
    out
}
fn from_disk(key: &str) -> Option<Vec<u8>> {
    let dir = disk().lock().unwrap().as_ref()?.0.clone();
    std::fs::read(dir.join(key)).ok()
}
fn to_disk(key: &str, bytes: &[u8]) {
    let Some(dir) = disk().lock().unwrap().as_ref().map(|d| d.0.clone()) else { return };
    let at = dir.join(key);
    if let Some(p) = at.parent() { let _ = std::fs::create_dir_all(p); }
    let tmp = at.with_extension("part");
    if std::fs::write(&tmp, bytes).is_err() || std::fs::rename(&tmp, &at).is_err() { return; }
    let over = {
        let mut d = disk().lock().unwrap();
        let Some(d) = d.as_mut() else { return };
        d.1 += bytes.len() as u64;
        d.1 > DISK_MOST
    };
    if over {
        // the oldest let go until a quarter under the most
        let mut all = walk(&dir);
        all.sort_by_key(|f| f.2);
        let mut size: u64 = all.iter().map(|f| f.1).sum();
        for (p, n, _) in all {
            if size <= DISK_MOST * 3 / 4 { break; }
            if std::fs::remove_file(&p).is_ok() { size -= n; }
        }
        if let Some(d) = disk().lock().unwrap().as_mut() { d.1 = size; }
    }
}

/// A picture for an asking: from memory, from disk, or drawn (by `draw`, given the PDF's path); with where it came
/// from and how long the drawing and the picture's making took.
pub fn picture(a: &Ask, file: impl FnOnce() -> Result<PathBuf, String>) -> Result<(Arc<Vec<u8>>, &'static str, f64, f64), String> {
    let key = a.key();
    if let Some(b) = recall(&key) { return Ok((b, "memory", 0.0, 0.0)); }
    if a.kept_on_disk() {
        if let Some(b) = from_disk(&key) { let b = Arc::new(b); remember(&key, b.clone()); return Ok((b, "disk", 0.0, 0.0)); }
    }
    let path = file()?;
    let (bytes, draw, make) = tauri_plugin_ink::pdf_region(path.to_str().ok_or("a path that is not text")?, a.page, a.width, a.at, a.picture_kind())?;
    let slow = DEV_SLOW.load(Ordering::SeqCst);
    if slow > 100 { std::thread::sleep(std::time::Duration::from_secs_f64(draw * (slow as f64 / 100.0 - 1.0) / 1000.0)); }
    if a.kept_on_disk() { to_disk(&key, &bytes); }
    let b = Arc::new(bytes);
    remember(&key, b.clone());
    Ok((b, "drawn", draw * slow as f64 / 100.0, make))
}

/// An asking no longer wanted (`g` older than the book's): not drawn.
pub fn wanted(a: &Ask) -> bool {
    !stale(a)
}

// ── the zoom log ──

fn log_file() -> &'static Mutex<Option<PathBuf>> {
    static L: OnceLock<Mutex<Option<PathBuf>>> = OnceLock::new();
    L.get_or_init(|| Mutex::new(None))
}
pub fn set_log(path: PathBuf) {
    *log_file().lock().unwrap() = Some(path);
}
pub fn log_path() -> Option<PathBuf> {
    log_file().lock().unwrap().clone()
}

/// A line in the zoom log, with the time (ms since 1970) before it; past the most the log is begun anew and the
/// one before kept as `.1`.
pub fn note(line: &str) {
    let g = log_file().lock().unwrap();
    let Some(path) = g.as_ref() else { return };
    if std::fs::metadata(path).map(|m| m.len() > LOG_MOST).unwrap_or(false) {
        let _ = std::fs::rename(path, path.with_extension("1.log"));
    }
    let ms = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0);
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(f, "{ms} {line}");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_address_says_what_is_asked() {
        let a = parse("/abc/12", "root=%2Fx%20y&w=1640&q=0.9&x=512&y=1024&tw=512&th=512&k=tile&f=bmp&p=3&g=7").unwrap();
        assert_eq!(a, Ask { hash: "abc".into(), page: 12, root: "/x y".into(), width: 1640, quality: 0.9, at: (512, 1024, 512, 512), kind: "tile".into(), format: "bmp".into(), priority: 3, generation: 7, generations_of: "abc".into() });
        assert!(!a.kept_on_disk());
        // as the reader asked before tiles: a whole page, a JPEG, or a PNG at full quality
        let low = parse("/abc/3", "root=r&w=256&q=0.6").unwrap();
        assert_eq!((low.kind.as_str(), low.format.as_str(), low.mime(), low.kept_on_disk()), ("low", "jpg", "image/jpeg", true));
        assert_eq!(parse("/abc/3", "root=r&w=256&q=1").unwrap().format, "png");
        assert!(parse("/abc", "w=2").is_err());
        assert!(parse("/abc/3", "root=r").is_err());
    }

    #[test]
    fn the_nearest_is_drawn_first_and_a_generation_gone_by_is_not() {
        set_generation("book", 3);
        assert!(!wanted(&parse("/book/1", "w=10&g=2").unwrap()));
        assert!(wanted(&parse("/book/1", "w=10&g=3").unwrap()));
        assert!(wanted(&parse("/book/1", "w=10").unwrap()));
        // another reader of the same book has its own generations
        assert!(wanted(&parse("/book/1", "w=10&g=1&gk=book:2").unwrap()));
        // jobs come off the heap least priority first, then in the order asked
        let mut h = BinaryHeap::new();
        for (p, s) in [(5, 1), (1, 2), (5, 3), (0, 4)] { h.push(Job { priority: p, seq: s, asked: Instant::now(), run: Box::new(|_, _| {}) }); }
        let order: Vec<_> = std::iter::from_fn(|| h.pop().map(|j| j.seq)).collect();
        assert_eq!(order, vec![4, 2, 1, 3]);
    }

    #[test]
    fn the_log_is_begun_anew_past_its_most() {
        let dir = std::env::temp_dir().join(format!("ilmi-zoomlog-{}", std::process::id()));
        let _ = std::fs::create_dir_all(&dir);
        let path = dir.join("ilmi-zoom.log");
        set_log(path.clone());
        let line = "x".repeat(1000);
        for _ in 0..600 { note(&line); }
        let a = std::fs::metadata(&path).unwrap().len();
        let b = std::fs::metadata(path.with_extension("1.log")).unwrap().len();
        assert!(a <= LOG_MOST + 2000 && b <= LOG_MOST + 2000 && a + b > 500_000, "{a} {b}");
        let _ = std::fs::remove_dir_all(&dir);
    }
}
