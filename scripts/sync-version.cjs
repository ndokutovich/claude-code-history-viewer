#!/usr/bin/env node

/**
 * package.json의 버전을 src-tauri/Cargo.toml에 동기화하는 스크립트
 *
 * 사용법:
 *   node scripts/sync-version.js
 *   (또는 package.json scripts에서 "sync-version": "node scripts/sync-version.js")
 */

const fs = require("fs");
const path = require("path");

const packageJsonPath = path.join(process.cwd(), "package.json");
const cargoTomlPath = path.join(process.cwd(), "src-tauri", "Cargo.toml");

// 1. package.json에서 버전 읽기
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const version = packageJson.version;

console.log(`[sync-version] package.json 버전: ${version}`);

// 2. Cargo.toml 읽기
let cargoToml = fs.readFileSync(cargoTomlPath, "utf8");

// 3. version = "..." 라인 찾아서 교체
const versionRegex = /^version\s*=\s*"[^\"]*"/m;
if (!versionRegex.test(cargoToml)) {
  console.error(
    "[sync-version] Cargo.toml에서 version 라인을 찾을 수 없습니다."
  );
  process.exit(1);
}

cargoToml = cargoToml.replace(versionRegex, `version = "${version}"`);

// 4. 파일에 다시 쓰기
fs.writeFileSync(cargoTomlPath, cargoToml);
console.log(`[sync-version] Cargo.toml 버전이 ${version}로 동기화되었습니다.`);
