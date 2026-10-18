//! A plugin package: a zip holding `plugin.json`, `main.js`, and optionally
//! `style.css` and `data.json`, flat or under one folder (as a zip of a
//! folder comes out). Read here because a dropped or picked file is outside
//! the fs scope, as `anki.rs` reads a package; the renderer checks the
//! manifest and lands the files under `.ilmi/plugins/<id>/`.

use serde::Serialize;
use std::io::Read;
use std::path::Path;

#[derive(Serialize, Debug, PartialEq)]
pub struct PluginFile {
    pub name: String,
    pub text: String,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct PluginZip {
    pub files: Vec<PluginFile>,
}

/// The files a plugin folder is made of; anything else in the zip is dropped.
const WANTED: [&str; 4] = ["plugin.json", "main.js", "style.css", "data.json"];

/// `dir/` when every name sits under the same first folder, else empty.
fn common_dir(names: &[String]) -> String {
    let first = match names.first() {
        Some(n) => n,
        None => return String::new(),
    };
    let seg = match first.find('/') {
        Some(i) => &first[..=i],
        None => return String::new(),
    };
    if names.iter().all(|n| n.starts_with(seg)) {
        seg.to_string()
    } else {
        String::new()
    }
}

/// The zip at `path`, read.
pub fn read_zip(path: &Path) -> Result<PluginZip, String> {
    let file = std::fs::File::open(path).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipArchive::new(file).map_err(|e| format!("not a zip: {}", e))?;
    let mut names = Vec::new();
    for i in 0..zip.len() {
        let entry = zip.by_index(i).map_err(|e| e.to_string())?;
        let name = String::from_utf8_lossy(entry.name_raw()).into_owned();
        if !entry.is_file() || name.starts_with("__MACOSX/") || name.ends_with(".DS_Store") {
            continue;
        }
        names.push(name);
    }
    let prefix = common_dir(&names);
    let mut files = Vec::new();
    for name in &names {
        let rel = name.strip_prefix(&prefix).unwrap_or(name);
        if !WANTED.contains(&rel) {
            continue;
        }
        let mut entry = zip.by_name(name).map_err(|e| e.to_string())?;
        let mut text = String::new();
        entry
            .read_to_string(&mut text)
            .map_err(|e| format!("{}: {}", rel, e))?;
        files.push(PluginFile { name: rel.to_string(), text });
    }
    if !files.iter().any(|f| f.name == "plugin.json") {
        return Err("no plugin.json in the zip".to_string());
    }
    Ok(PluginZip { files })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use std::path::PathBuf;

    fn scratch(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("ilmi-plugin-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        dir.join(name)
    }

    fn write_zip(path: &Path, entries: &[(&str, &[u8])]) {
        let file = std::fs::File::create(path).unwrap();
        let mut w = zip::ZipWriter::new(file);
        let opts = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);
        for (name, bytes) in entries {
            if name.ends_with('/') {
                w.add_directory(*name, opts).unwrap();
            } else {
                w.start_file(*name, opts).unwrap();
                w.write_all(bytes).unwrap();
            }
        }
        w.finish().unwrap();
    }

    #[test]
    fn reads_a_flat_zip() {
        let path = scratch("flat.zip");
        write_zip(&path, &[("plugin.json", b"{\"id\":\"x\"}"), ("main.js", b"module.exports = {};"), ("readme.txt", b"no")]);
        let z = read_zip(&path).unwrap();
        assert_eq!(z.files.len(), 2);
        assert_eq!((z.files[0].name.as_str(), z.files[0].text.as_str()), ("plugin.json", "{\"id\":\"x\"}"));
        assert_eq!(z.files[1].name, "main.js");
    }

    #[test]
    fn strips_one_folder_and_the_mac_noise() {
        let path = scratch("folder.zip");
        write_zip(&path, &[
            ("hello/", b""),
            ("hello/plugin.json", b"{}"),
            ("hello/main.js", b"x"),
            ("hello/style.css", b".a{}"),
            ("__MACOSX/hello/._main.js", b"junk"),
            ("hello/.DS_Store", b"junk"),
        ]);
        let z = read_zip(&path).unwrap();
        let names: Vec<&str> = z.files.iter().map(|f| f.name.as_str()).collect();
        assert_eq!(names, ["plugin.json", "main.js", "style.css"]);
    }

    #[test]
    fn refuses_what_is_not_a_plugin() {
        let path = scratch("not.zip");
        std::fs::write(&path, b"hello").unwrap();
        assert!(read_zip(&path).unwrap_err().starts_with("not a zip"));
        write_zip(&path, &[("main.js", b"x")]);
        assert_eq!(read_zip(&path).unwrap_err(), "no plugin.json in the zip");
    }
}
