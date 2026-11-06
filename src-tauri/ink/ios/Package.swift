// swift-tools-version:5.3

import PackageDescription

let package = Package(
  name: "tauri-plugin-ink",
  platforms: [
    .macOS(.v10_13),
    .iOS(.v14),
  ],
  products: [
    .library(
      name: "tauri-plugin-ink",
      type: .static,
      targets: ["tauri-plugin-ink"])
  ],
  dependencies: [
    .package(name: "Tauri", path: "../.tauri/tauri-api")
  ],
  targets: [
    .target(
      name: "tauri-plugin-ink",
      dependencies: [
        .byName(name: "Tauri")
      ],
      path: "Sources")
  ]
)
