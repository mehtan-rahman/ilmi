//! A book in EPUB read on this side, as `anki.rs` reads a package. An
//! `.epub` is a zip: `META-INF/container.xml` names the OPF package file,
//! whose `<manifest>` lists the files and whose `<spine>` gives the reading
//! order; chapter titles come from the navigation document (`nav.xhtml`,
//! the `<nav epub:type="toc">`) in EPUB 3 or `toc.ncx` in EPUB 2, the title
//! and creators from `<dc:title>` / `<dc:creator>`. What the renderer needs
//! comes back as plain data: the metadata, and the spine's XHTML items in
//! order, each with its href, its markup as a string, and the toc title that
//! points at it (or at an anchor inside it) when one does. Images are listed
//! by href, not extracted. The XML is read with `quick-xml` leniently: a
//! document that stops parsing yields what was read before the error.

use quick_xml::events::{BytesStart, Event};
use quick_xml::{Reader, XmlVersion};
use serde::Serialize;
use std::collections::HashMap;
use std::io::Read;
use std::path::Path;

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Epub {
    /// `<dc:title>`, or `""`.
    pub title: String,
    /// Every `<dc:creator>`, in order.
    pub creators: Vec<String>,
    /// `<dc:language>`, or `""`.
    pub language: String,
    /// The spine in reading order, XHTML items only.
    pub items: Vec<EpubItem>,
    /// Manifest hrefs of the images, relative to the package file; not extracted.
    pub images: Vec<String>,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct EpubItem {
    /// The manifest href, relative to the package file.
    pub href: String,
    /// The item's XHTML as a string.
    pub html: String,
    /// The first toc entry pointing at the item, or at an anchor inside it.
    pub title: Option<String>,
    /// The navigation document itself, when the spine lists it.
    pub nav: bool,
}

/// A `<manifest>` item.
struct Item {
    id: String,
    href: String,
    media: String,
    properties: String,
}

/// What the package file says.
#[derive(Default)]
struct Package {
    title: String,
    creators: Vec<String>,
    language: String,
    items: Vec<Item>,
    /// `idref`s, in order.
    spine: Vec<String>,
    /// The spine's `toc` attribute: the NCX item's id, in EPUB 2.
    toc: Option<String>,
}

const NCX: &str = "application/x-dtbncx+xml";

/// The book at `path`, read.
pub fn read_book(path: &Path) -> Result<Epub, String> {
    let file = std::fs::File::open(path).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipArchive::new(file).map_err(|e| format!("not a zip: {}", e))?;
    let container = entry(&mut zip, "META-INF/container.xml").ok_or_else(|| "no container in the book".to_string())?;
    let opf_path = rootfile(&container).ok_or_else(|| "no package in the book".to_string())?;
    let opf = entry(&mut zip, &opf_path).ok_or_else(|| "no package in the book".to_string())?;
    let dir = dir_of(&opf_path);
    let pkg = package(&opf);
    let by_id: HashMap<&str, &Item> = pkg.items.iter().map(|i| (i.id.as_str(), i)).collect();

    // the table of contents: the nav document first, the NCX when there is none or it names nothing
    let mut toc: HashMap<String, String> = HashMap::new();
    if let Some(nav) = pkg.items.iter().find(|i| has_property(i, "nav")) {
        read_toc(&mut zip, &dir, nav, nav_toc, &mut toc);
    }
    if toc.is_empty() {
        let ncx = pkg.toc.as_deref().and_then(|id| by_id.get(id).copied()).or_else(|| pkg.items.iter().find(|i| i.media == NCX));
        if let Some(ncx) = ncx {
            read_toc(&mut zip, &dir, ncx, ncx_toc, &mut toc);
        }
    }

    let mut items = Vec::new();
    for idref in &pkg.spine {
        let Some(item) = by_id.get(idref.as_str()) else { continue };
        if !is_xhtml(item) {
            continue;
        }
        let path = resolve(&dir, &item.href);
        let Some(html) = entry(&mut zip, &path) else { continue };
        items.push(EpubItem { href: item.href.clone(), html, title: toc.get(&path).cloned(), nav: has_property(item, "nav") });
    }
    let images = pkg.items.iter().filter(|i| i.media.starts_with("image/")).map(|i| i.href.clone()).collect();
    Ok(Epub { title: pkg.title, creators: pkg.creators, language: pkg.language, items, images })
}

/// The titles a table of contents gives, by the zip path each points at; the first entry for a path wins.
fn read_toc(zip: &mut zip::ZipArchive<std::fs::File>, dir: &str, item: &Item, parse: fn(&str) -> Vec<(String, String)>, toc: &mut HashMap<String, String>) {
    let path = resolve(dir, &item.href);
    let Some(xml) = entry(zip, &path) else { return };
    let base = dir_of(&path);
    for (href, title) in parse(&xml) {
        if !title.is_empty() {
            toc.entry(resolve(&base, &href)).or_insert(title);
        }
    }
}

/// A zip entry as text, lossily decoded, a byte-order mark dropped; `None` when it is not there.
fn entry(zip: &mut zip::ZipArchive<std::fs::File>, name: &str) -> Option<String> {
    let mut file = zip.by_name(name).ok()?;
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes).ok()?;
    let text = String::from_utf8_lossy(&bytes);
    Some(text.strip_prefix('\u{feff}').unwrap_or(&text).to_string())
}

fn is_xhtml(item: &Item) -> bool {
    item.media.starts_with("application/xhtml") || item.media.starts_with("text/html")
}

fn has_property(item: &Item, name: &str) -> bool {
    item.properties.split_whitespace().any(|p| p == name)
}

// ── paths ────────────────────────────────────────────────────────

fn dir_of(path: &str) -> String {
    path.rfind('/').map(|i| path[..i].to_string()).unwrap_or_default()
}

fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Some(b) = std::str::from_utf8(&bytes[i + 1..i + 3]).ok().and_then(|h| u8::from_str_radix(h, 16).ok()) {
                out.push(b);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// `href` as a zip path, resolved against the directory `dir`: the fragment and query dropped, percent-escapes decoded, `.` and `..` folded.
fn resolve(dir: &str, href: &str) -> String {
    let bare = href.split(['#', '?']).next().unwrap_or("");
    let decoded = percent_decode(bare);
    let mut parts: Vec<&str> = if decoded.starts_with('/') { Vec::new() } else { dir.split('/').filter(|s| !s.is_empty()).collect() };
    for seg in decoded.split('/') {
        match seg {
            "" | "." => {}
            ".." => {
                parts.pop();
            }
            s => parts.push(s),
        }
    }
    parts.join("/")
}

// ── xml ──────────────────────────────────────────────────────────

fn reader(xml: &str) -> Reader<&[u8]> {
    let mut r = Reader::from_str(xml);
    let c = r.config_mut();
    c.check_end_names = false;
    c.allow_unmatched_ends = true;
    r
}

/// The value of the attribute whose local name is `name`.
fn attr(e: &BytesStart, name: &str) -> Option<String> {
    e.attributes().flatten().find(|a| a.key.local_name().as_ref() == name).map(|a| match a.normalized_value(XmlVersion::Implicit1_0) {
        Ok(v) => v.into_owned(),
        Err(_) => a.value.to_string(),
    })
}

/// Whitespace collapsed to single spaces, the ends trimmed.
fn collapse(s: &str) -> String {
    s.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// A general reference's text: character references, the XML five, and the HTML entities a navigation document tends to carry; anything else is nothing.
fn entity(name: &str) -> &'static str {
    match name {
        "amp" => "&",
        "lt" => "<",
        "gt" => ">",
        "quot" => "\"",
        "apos" => "'",
        "nbsp" => "\u{a0}",
        "mdash" => "\u{2014}",
        "ndash" => "\u{2013}",
        "hellip" => "\u{2026}",
        "lsquo" => "\u{2018}",
        "rsquo" => "\u{2019}",
        "ldquo" => "\u{201c}",
        "rdquo" => "\u{201d}",
        "copy" => "\u{a9}",
        _ => "",
    }
}

/// Append the text an event carries to `buf`, references resolved.
fn push_text(buf: &mut String, ev: &Event) {
    match ev {
        Event::Text(t) => buf.push_str(&t.xml10_content()),
        Event::CData(c) => buf.push_str(&c.xml10_content()),
        Event::GeneralRef(r) => {
            let name = r.xml10_content();
            if let Some(num) = name.strip_prefix('#') {
                let code = match num.strip_prefix(['x', 'X']) {
                    Some(hex) => u32::from_str_radix(hex, 16).ok(),
                    None => num.parse().ok(),
                };
                if let Some(c) = code.and_then(char::from_u32) {
                    buf.push(c);
                }
            } else {
                buf.push_str(entity(&name));
            }
        }
        _ => {}
    }
}

/// `META-INF/container.xml`: the package file's path, the OEBPS package preferred over any other rootfile.
fn rootfile(xml: &str) -> Option<String> {
    let mut r = reader(xml);
    let mut first: Option<String> = None;
    loop {
        match r.read_event() {
            Ok(Event::Start(e)) | Ok(Event::Empty(e)) if e.local_name().as_ref() == "rootfile" => {
                if let Some(path) = attr(&e, "full-path") {
                    if attr(&e, "media-type").as_deref() == Some("application/oebps-package+xml") {
                        return Some(path);
                    }
                    first.get_or_insert(path);
                }
            }
            Ok(Event::Eof) | Err(_) => return first,
            _ => {}
        }
    }
}

/// The OPF package file: metadata, manifest, spine.
fn package(xml: &str) -> Package {
    let mut r = reader(xml);
    let mut pkg = Package::default();
    let mut in_metadata = false;
    let mut field: Option<String> = None;
    let mut buf = String::new();
    loop {
        match r.read_event() {
            Ok(Event::Start(e)) => {
                let name = e.local_name();
                let name = name.as_ref();
                match name {
                    "metadata" => in_metadata = true,
                    "spine" => pkg.toc = attr(&e, "toc"),
                    "title" | "creator" | "language" if in_metadata => {
                        field = Some(name.to_string());
                        buf.clear();
                    }
                    "item" => manifest_item(&mut pkg, &e),
                    "itemref" => pkg.spine.extend(attr(&e, "idref")),
                    _ => {}
                }
            }
            Ok(Event::Empty(e)) => match e.local_name().as_ref() {
                "spine" => pkg.toc = attr(&e, "toc"),
                "item" => manifest_item(&mut pkg, &e),
                "itemref" => pkg.spine.extend(attr(&e, "idref")),
                _ => {}
            },
            Ok(Event::End(e)) => {
                let name = e.local_name();
                let name = name.as_ref();
                if name == "metadata" {
                    in_metadata = false;
                }
                if field.as_deref() == Some(name) {
                    let text = collapse(&buf);
                    match name {
                        "title" if pkg.title.is_empty() => pkg.title = text,
                        "creator" if !text.is_empty() => pkg.creators.push(text),
                        "language" if pkg.language.is_empty() => pkg.language = text,
                        _ => {}
                    }
                    field = None;
                }
            }
            Ok(Event::Eof) | Err(_) => return pkg,
            Ok(ev) => {
                if field.is_some() {
                    push_text(&mut buf, &ev);
                }
            }
        }
    }
}

fn manifest_item(pkg: &mut Package, e: &BytesStart) {
    if let (Some(id), Some(href)) = (attr(e, "id"), attr(e, "href")) {
        pkg.items.push(Item { id, href, media: attr(e, "media-type").unwrap_or_default(), properties: attr(e, "properties").unwrap_or_default() });
    }
}

/// An EPUB 3 navigation document: every link inside `<nav epub:type="toc">`, as (href, title), in document order.
fn nav_toc(xml: &str) -> Vec<(String, String)> {
    let mut r = reader(xml);
    let mut out = Vec::new();
    let mut depth = 0usize;
    let mut link: Option<(String, String)> = None;
    loop {
        match r.read_event() {
            Ok(Event::Start(e)) => {
                let name = e.local_name();
                let name = name.as_ref();
                if depth > 0 {
                    depth += 1;
                    if name == "a" {
                        if let Some(href) = attr(&e, "href") {
                            link = Some((href, String::new()));
                        }
                    }
                } else if name == "nav" && attr(&e, "type").map_or(false, |t| t.split_whitespace().any(|w| w == "toc")) {
                    depth = 1;
                }
            }
            Ok(Event::End(e)) if depth > 0 => {
                if e.local_name().as_ref() == "a" {
                    if let Some((href, text)) = link.take() {
                        out.push((href, collapse(&text)));
                    }
                }
                depth -= 1;
            }
            Ok(Event::Eof) | Err(_) => return out,
            Ok(ev) => {
                if let Some((_, text)) = link.as_mut() {
                    push_text(text, &ev);
                }
            }
        }
    }
}

/// An EPUB 2 NCX: every `<navPoint>`'s label and content source, as (src, label), in document order.
fn ncx_toc(xml: &str) -> Vec<(String, String)> {
    let mut r = reader(xml);
    let mut out = Vec::new();
    let mut in_text = false;
    let mut buf = String::new();
    let mut label = String::new();
    loop {
        match r.read_event() {
            Ok(Event::Start(e)) => match e.local_name().as_ref() {
                "text" => {
                    in_text = true;
                    buf.clear();
                }
                "content" => out.extend(attr(&e, "src").map(|src| (src, collapse(&label)))),
                _ => {}
            },
            Ok(Event::Empty(e)) if e.local_name().as_ref() == "content" => out.extend(attr(&e, "src").map(|src| (src, collapse(&label)))),
            Ok(Event::End(e)) if in_text && e.local_name().as_ref() == "text" => {
                in_text = false;
                label = buf.clone();
            }
            Ok(Event::Eof) | Err(_) => return out,
            Ok(ev) => {
                if in_text {
                    push_text(&mut buf, &ev);
                }
            }
        }
    }
}

#[cfg(test)]
pub mod tests {
    //! A three-chapter EPUB 3 built here and read back; a two-chapter EPUB 2
    //! with an NCX; refusals. With `ILMI_EPUB_FIXTURE=<dir>` set, the
    //! three-chapter book and the JSON it reads as are also written there
    //! (`npm run fixture:epub`), for `epub.test.ts` and the `epub` smoke.

    use super::*;
    use std::io::Write;
    use std::path::PathBuf;

    const CONTAINER: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
"#;

    const OPF3: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">urn:uuid:3b8c6a1e-0000-4000-8000-000000000019</dc:identifier>
    <dc:title>The Small Book</dc:title>
    <dc:creator id="creator">A. Author</dc:creator>
    <dc:language>en</dc:language>
    <meta property="dcterms:modified">2026-01-01T00:00:00Z</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch2" href="ch2.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch3" href="ch3.xhtml" media-type="application/xhtml+xml"/>
    <item id="map" href="images/map.png" media-type="image/png"/>
    <item id="orn" href="images/orn.png" media-type="image/png"/>
    <item id="css" href="style.css" media-type="text/css"/>
  </manifest>
  <spine>
    <itemref idref="cover"/>
    <itemref idref="nav" linear="no"/>
    <itemref idref="ch1"/>
    <itemref idref="ch2"/>
    <itemref idref="ch3"/>
  </spine>
</package>
"#;

    const NAV: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Contents</title></head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Contents</h1>
    <ol>
      <li><a href="ch1.xhtml">One: the premise</a></li>
      <li><a href="ch3.xhtml#start">Three: <span>the close</span></a></li>
    </ol>
  </nav>
  <nav epub:type="landmarks" hidden="">
    <ol><li><a epub:type="cover" href="cover.xhtml">Cover</a></li></ol>
  </nav>
</body>
</html>
"#;

    const COVER: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Cover</title></head>
<body><p>The Small Book, a cover.</p></body>
</html>
"#;

    const CH1: &str = r##"<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>One</title><link rel="stylesheet" href="style.css"/></head>
<body>
  <section epub:type="chapter">
    <h1>One: the premise</h1>
    <p>Every review is a <em>small wager</em> against forgetting. The wager has a cost, the minutes spent, and a payoff that compounds: each recall pushes the next due date further out, so a few well-timed reviews buy years of retention for the price of an afternoon.<sup><a epub:type="noteref" href="#fn1" id="fnref1">1</a></sup></p>
    <p>The <strong>minimum information principle</strong> says the same thing from the other side; see <a href="ch3.xhtml">the close</a>.</p>
    <ul>
      <li>cost: the minutes</li>
      <li>payoff: the years</li>
    </ul>
    <blockquote><p>Familiarity is cheap. Retrieval is the thing that lasts.</p></blockquote>
    <aside epub:type="footnote" id="fn1"><p>A note on the wager, for the curious. <a epub:type="backlink" href="#fnref1">&#8617;</a></p></aside>
  </section>
</body>
</html>
"##;

    const CH2: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Two</title></head>
<body>
  <h2>Two: the middle</h2>
  <p>A good system spends your attention the way a careful gardener spends water: not evenly, but where the curve is about to cross the floor. Most learners review everything, constantly, and confuse the warm feeling of familiarity with the harder fact of retrieval.</p>
  <figure>
    <img src="images/map.png" alt="A map of the valley"/>
    <figcaption>The valley, surveyed.</figcaption>
  </figure>
  <p>What follows is the middle of the argument, which is where most books lose their readers and most readers lose their place.</p>
</body>
</html>
"#;

    const CH3: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Three</title></head>
<body>
  <h1 id="start">Three: the close</h1>
  <p>Atomicity sounds easy and is in fact the hardest discipline in the practice. A card that asks two things teaches neither; a card that asks one thing, in the fewest words that still make sense, is remembered for years.</p>
  <p><img src="images/orn.png"/></p>
  <p>So the book closes where it opened: with the wager, now priced.</p>
  <h3>A last word</h3>
  <p>Read on.</p>
</body>
</html>
"#;

    /// A book with the named entries, `mimetype` first and stored as the spec asks, each dated to one day so the bytes do not move between runs.
    fn write_book(path: &Path, entries: &[(&str, &[u8])]) {
        let file = std::fs::File::create(path).unwrap();
        let mut zip = zip::ZipWriter::new(file);
        let date = zip::DateTime::from_date_and_time(2026, 1, 1, 0, 0, 0).unwrap();
        let stored = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored).last_modified_time(date);
        zip.start_file("mimetype", stored).unwrap();
        zip.write_all(b"application/epub+zip").unwrap();
        let deflated = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated).last_modified_time(date);
        for (name, bytes) in entries {
            zip.start_file(*name, deflated).unwrap();
            zip.write_all(bytes).unwrap();
        }
        zip.finish().unwrap();
    }

    fn scratch(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("ilmi-epub-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        dir.join(name)
    }

    #[test]
    fn reads_the_three_chapter_book() {
        let epub = scratch("three-chapters.epub");
        write_book(&epub, &[
            ("META-INF/container.xml", CONTAINER.as_bytes()),
            ("OEBPS/content.opf", OPF3.as_bytes()),
            ("OEBPS/nav.xhtml", NAV.as_bytes()),
            ("OEBPS/cover.xhtml", COVER.as_bytes()),
            ("OEBPS/ch1.xhtml", CH1.as_bytes()),
            ("OEBPS/ch2.xhtml", CH2.as_bytes()),
            ("OEBPS/ch3.xhtml", CH3.as_bytes()),
            ("OEBPS/images/map.png", b"\x89PNG\r\n\x1a\nmap"),
            ("OEBPS/images/orn.png", b"\x89PNG\r\n\x1a\norn"),
            ("OEBPS/style.css", b"p { margin: 0 }"),
        ]);
        let book = read_book(&epub).unwrap();
        assert_eq!(book.title, "The Small Book");
        assert_eq!(book.creators, ["A. Author"]);
        assert_eq!(book.language, "en");
        assert_eq!(book.items.iter().map(|i| i.href.as_str()).collect::<Vec<_>>(), ["cover.xhtml", "nav.xhtml", "ch1.xhtml", "ch2.xhtml", "ch3.xhtml"]);
        assert_eq!(book.items.iter().map(|i| i.nav).collect::<Vec<_>>(), [false, true, false, false, false]);
        assert_eq!(
            book.items.iter().map(|i| i.title.as_deref()).collect::<Vec<_>>(),
            [None, None, Some("One: the premise"), None, Some("Three: the close")]
        );
        assert_eq!(book.items[0].html, COVER);
        assert!(book.items[3].html.contains("<h2>Two: the middle</h2>"));
        assert_eq!(book.images, ["images/map.png", "images/orn.png"]);

        if let Ok(dir) = std::env::var("ILMI_EPUB_FIXTURE") {
            let dir = Path::new(&dir);
            std::fs::create_dir_all(dir).unwrap();
            std::fs::copy(&epub, dir.join("three-chapters.epub")).unwrap();
            let json = serde_json::to_string_pretty(&book).unwrap();
            std::fs::write(dir.join("three-chapters.json"), format!("{}\n", json)).unwrap();
        }
    }

    #[test]
    fn reads_an_epub2_table_of_contents() {
        let container = CONTAINER.replace("OEBPS/content.opf", "OPS/book.opf");
        let opf = r#"<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="id">
  <metadata>
    <dc:title>Two Chapters &amp; a Preface</dc:title>
    <dc:creator opf:role="aut">First Author</dc:creator>
    <dc:creator opf:role="aut">Second Author</dc:creator>
    <dc:language>de</dc:language>
    <dc:identifier id="id">x</dc:identifier>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="a" href="a.xhtml" media-type="application/xhtml+xml"/>
    <item id="b" href="text/b%20two.xhtml" media-type="application/xhtml+xml"/>
    <item id="pic" href="pic.jpg" media-type="image/jpeg"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="a"/>
    <itemref idref="b"/>
    <itemref idref="missing"/>
  </spine>
</package>
"#;
        let ncx = r#"<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="x"/></head>
  <docTitle><text>Two Chapters</text></docTitle>
  <navMap>
    <navPoint id="n1" playOrder="1">
      <navLabel><text>Preface</text></navLabel>
      <content src="a.xhtml"/>
      <navPoint id="n2" playOrder="2">
        <navLabel><text>Preface, part two</text></navLabel>
        <content src="a.xhtml#two"/>
      </navPoint>
    </navPoint>
    <navPoint id="n3" playOrder="3">
      <navLabel><text>Chapter &amp; verse</text></navLabel>
      <content src="text/b%20two.xhtml#x"/>
    </navPoint>
  </navMap>
</ncx>
"#;
        let a = "<html><body><h1>Preface</h1><p id=\"two\">a</p></body></html>";
        let b = "<html><body><p id=\"x\">b</p></body></html>";
        let epub = scratch("two.epub");
        write_book(&epub, &[
            ("META-INF/container.xml", container.as_bytes()),
            ("OPS/book.opf", opf.as_bytes()),
            ("OPS/toc.ncx", ncx.as_bytes()),
            ("OPS/a.xhtml", a.as_bytes()),
            ("OPS/text/b two.xhtml", b.as_bytes()),
        ]);
        let book = read_book(&epub).unwrap();
        assert_eq!(book.title, "Two Chapters & a Preface");
        assert_eq!(book.creators, ["First Author", "Second Author"]);
        assert_eq!(book.language, "de");
        assert_eq!(book.items.len(), 2);
        assert_eq!((book.items[0].href.as_str(), book.items[0].title.as_deref(), book.items[0].nav), ("a.xhtml", Some("Preface"), false));
        assert_eq!((book.items[1].href.as_str(), book.items[1].title.as_deref()), ("text/b%20two.xhtml", Some("Chapter & verse")));
        assert_eq!(book.items[1].html, b);
        assert_eq!(book.images, ["pic.jpg"]);
    }

    #[test]
    fn refuses_what_is_not_a_book() {
        let path = scratch("not.epub");
        std::fs::write(&path, b"hello").unwrap();
        assert!(read_book(&path).unwrap_err().starts_with("not a zip"));
        write_book(&path, &[("readme.txt", b"x")]);
        assert_eq!(read_book(&path).unwrap_err(), "no container in the book");
        write_book(&path, &[("META-INF/container.xml", CONTAINER.as_bytes())]);
        assert_eq!(read_book(&path).unwrap_err(), "no package in the book");
    }

    #[test]
    fn resolves_hrefs_against_the_package_directory() {
        assert_eq!(resolve("OEBPS", "ch1.xhtml#start"), "OEBPS/ch1.xhtml");
        assert_eq!(resolve("OEBPS/text", "../images/a%20b.png"), "OEBPS/images/a b.png");
        assert_eq!(resolve("", "./x/./y.xhtml?z=1"), "x/y.xhtml");
        assert_eq!(resolve("OEBPS", "/abs.xhtml"), "abs.xhtml");
        assert_eq!(dir_of("OEBPS/content.opf"), "OEBPS");
        assert_eq!(dir_of("content.opf"), "");
    }
}
