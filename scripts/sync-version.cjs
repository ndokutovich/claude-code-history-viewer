#!/usr/bin/env node

/**
 * Script to sync version from package.json to src-tauri/Cargo.toml
 *
 * Usage:
 *   node scripts/sync-version.js
 *   (or in package.json scripts: "sync-version": "node scripts/sync-version.js")
 */

const fs = require("fs");
const path = require("path");

const packageJsonPath = path.join(process.cwd(), "package.json");
const cargoTomlPath = path.join(process.cwd(), "src-tauri", "Cargo.toml");

// 1. Read version from package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const version = packageJson.version;

console.log(`[sync-version] package.json version: ${version}`);

// 2. Read Cargo.toml
let cargoToml = fs.readFileSync(cargoTomlPath, "utf8");

// 3. Find and replace version = "..." line
const versionRegex = /^version\s*=\s*"[^\"]*"/m;
if (!versionRegex.test(cargoToml)) {
  console.error(
    "[sync-version] Could not find version line in Cargo.toml."
  );
  process.exit(1);
}

cargoToml = cargoToml.replace(versionRegex, `version = "${version}"`);

// 4. Write back to file
fs.writeFileSync(cargoTomlPath, cargoToml);
console.log(`[sync-version] Cargo.toml version synced to ${version}.`);
