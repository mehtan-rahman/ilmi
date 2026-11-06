// The canvas is a Swift package (`ios/`), built and linked for iOS by Tauri's own plugin build. What reads a
// drawing (`native/ink.m`) is Objective-C over PencilKit, compiled here for the Mac and for iOS alike.
fn main() {
    tauri_plugin::Builder::new(&[]).ios_path("ios").build();
    let os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    println!("cargo:rerun-if-changed=native/ink.m");
    if os == "macos" || os == "ios" {
        cc::Build::new().file("native/ink.m").flag("-fobjc-arc").compile("ilmi_ink");
        for f in ["Foundation", "CoreGraphics", "PencilKit", if os == "macos" { "AppKit" } else { "UIKit" }] {
            println!("cargo:rustc-link-lib=framework={f}");
        }
    }
}
