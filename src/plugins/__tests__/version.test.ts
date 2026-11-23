import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APP_VERSION } from '../index.js';

// one version for the Mac, the iPad and the iPhone: tauri.conf.json's, and every other place that names one says the same
const read = (path: string) => readFileSync(path, 'utf8');
const version = (JSON.parse(read('src-tauri/tauri.conf.json')) as { version: string }).version;

describe('the version', () => {
  it('is the same everywhere it is written', () => {
    const lock = JSON.parse(read('package-lock.json')) as { version: string; packages: Record<string, { version?: string }> };
    const plist = read('src-tauri/gen/apple/ilmi_iOS/Info.plist');
    const cargoLock = read('src-tauri/Cargo.lock');
    expect({
      app: APP_VERSION,
      cargo: read('src-tauri/Cargo.toml').match(/^version = "([^"]+)"/m)?.[1],
      cargoLock: cargoLock.match(/name = "ilmi"\nversion = "([^"]+)"/)?.[1],
      npm: (JSON.parse(read('package.json')) as { version: string }).version,
      npmLock: lock.version,
      npmLockRoot: lock.packages['']?.version,
      iosShort: plist.match(/<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/)?.[1],
      iosBuild: plist.match(/<key>CFBundleVersion<\/key>\s*<string>([^<]+)<\/string>/)?.[1],
      iosProjectShort: read('src-tauri/gen/apple/project.yml').match(/CFBundleShortVersionString: "?([^"\n]+)"?/)?.[1],
      iosProjectBuild: read('src-tauri/gen/apple/project.yml').match(/CFBundleVersion: "?([^"\n]+)"?/)?.[1],
    }).toEqual({
      app: version, cargo: version, cargoLock: version, npm: version, npmLock: version, npmLockRoot: version,
      iosShort: version, iosBuild: version, iosProjectShort: version, iosProjectBuild: version,
    });
  });
});
