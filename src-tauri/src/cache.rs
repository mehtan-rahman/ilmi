//! A plugin's cache (`ilmi.cache`): bytes a plugin keeps on this device for
//! one collection, under the app's data directory and never in the
//! collection, so they are not synced, not exported, and gone with the
//! app's data. `plugin-cache/<collection>/<plugin>/<key>`, each a file.
//! What it keeps for the device and no one collection (`ilmi.cache.device`)
//! is beside them under `.device`, a name no collection has.

use std::path::{Path, PathBuf};

/// Where what is kept for the device, and not for a collection, lives: no collection's name starts with a dot.
const DEVICE: &str = ".device";

/// A plugin may keep this much on a device for a collection, and as much again for the device, over all its keys.
pub const CACHE_MAX: u64 = 64 * 1024 * 1024;

/// A name that is one path segment of lowercase letters, digits, `-`, `_` and `.`, not starting with a dot.
fn segment(s: &str) -> Option<&str> {
    let ok = !s.is_empty() && s.len() <= 96 && !s.starts_with('.') && s.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-' || b == b'_' || b == b'.');
    ok.then_some(s)
}

/// Where `plugin` keeps `key` for the collection named `collection` (none: for the device), under `home` (the app's data directory).
pub fn cache_path(home: &Path, collection: Option<&str>, plugin: &str, key: &str) -> Result<PathBuf, String> {
    let name = match collection {
        Some(c) => Path::new(c).file_name().and_then(|n| n.to_str()).filter(|n| !n.is_empty() && !n.starts_with('.')).ok_or_else(|| "no collection named".to_string())?,
        None => DEVICE,
    };
    let plugin = segment(plugin).ok_or_else(|| "not a plugin's id".to_string())?;
    let key = segment(key).ok_or_else(|| "a cache key is lowercase letters, digits, - _ and .".to_string())?;
    Ok(home.join("plugin-cache").join(name).join(plugin).join(key))
}

pub fn cache_get(path: &Path) -> Result<Option<Vec<u8>>, String> {
    match std::fs::read(path) {
        Ok(bytes) => Ok(Some(bytes)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Write `bytes` at `path`, whole; refused when the plugin's folder would then hold more than `CACHE_MAX`.
pub fn cache_put(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let dir = path.parent().ok_or_else(|| "no folder".to_string())?;
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let mut held = 0u64;
    for e in std::fs::read_dir(dir).map_err(|e| e.to_string())?.filter_map(|e| e.ok()) {
        if e.path() != path {
            held += e.metadata().map(|m| m.len()).unwrap_or(0);
        }
    }
    if held + bytes.len() as u64 > CACHE_MAX {
        return Err(format!("the cache holds {} MB at most", CACHE_MAX / 1024 / 1024));
    }
    let tmp = path.with_extension("ilmi-tmp");
    std::fs::write(&tmp, bytes).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, path).map_err(|e| e.to_string())
}

pub fn cache_remove(path: &Path) -> Result<(), String> {
    match std::fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_cache_is_kept_by_collection_plugin_and_key_and_nowhere_else() {
        let home = std::env::temp_dir().join(format!("ilmi-cache-{}", std::process::id()));
        let p = cache_path(&home, Some("/data/collections/double-major"), "fsrs-7", "state.bin").unwrap();
        assert_eq!(p, home.join("plugin-cache/double-major/fsrs-7/state.bin"));
        assert!(cache_path(&home, Some("/data/collections/double-major"), "../x", "k").is_err());
        assert!(cache_path(&home, Some("/data/collections/double-major"), "p", "a/b").is_err());
        assert!(cache_path(&home, Some("/data/collections/double-major"), "p", "..").is_err());
        assert!(cache_path(&home, Some(""), "p", "k").is_err());
        assert_eq!(cache_get(&p).unwrap(), None);
        cache_put(&p, &[1, 2, 3]).unwrap();
        assert_eq!(cache_get(&p).unwrap(), Some(vec![1, 2, 3]));
        cache_put(&p, &[9]).unwrap();
        assert_eq!(cache_get(&p).unwrap(), Some(vec![9]));
        cache_remove(&p).unwrap();
        cache_remove(&p).unwrap();
        assert_eq!(cache_get(&p).unwrap(), None);
        let _ = std::fs::remove_dir_all(&home);
    }

    #[test]
    fn what_is_kept_for_the_device_is_no_collections_and_counted_apart() {
        let home = std::env::temp_dir().join(format!("ilmi-cache-device-{}", std::process::id()));
        let d = cache_path(&home, None, "model", "weights.bin").unwrap();
        assert_eq!(d, home.join("plugin-cache/.device/model/weights.bin"));
        // a collection cannot be named into it
        assert!(cache_path(&home, Some("/data/collections/.device"), "model", "weights.bin").is_err());
        let c = cache_path(&home, Some("/data/collections/double-major"), "model", "weights.bin").unwrap();
        cache_put(&d, &[7; 16]).unwrap();
        assert_eq!(cache_get(&c).unwrap(), None);
        cache_put(&c, &[8; 4]).unwrap();
        assert_eq!(cache_get(&d).unwrap(), Some(vec![7; 16]));
        assert_eq!(cache_get(&c).unwrap(), Some(vec![8; 4]));
        cache_remove(&c).unwrap();
        assert_eq!(cache_get(&d).unwrap(), Some(vec![7; 16]));
        let _ = std::fs::remove_dir_all(&home);
    }
}
