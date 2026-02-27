#!/usr/bin/env node

/**
 * Release script - Updates version in all necessary files
 *
 * Usage:
 *   node scripts/release.cjs 1.0.5
 *   pnpm release 1.0.5
 *
 * This script updates:
 * 1. package.json version
 * 2. src-tauri/Cargo.toml version
 * 3. src-tauri/tauri.conf.json version
 *
 * Options:
 *   --no-git    Skip git commit and tag creation
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Parse arguments
const args = process.argv.slice(2);
const noGit = args.includes("--no-git");
const versionArg = args.find(arg => !arg.startsWith("--"));

if (!versionArg) {
  console.error("❌ Error: Version argument is required");
  console.log("Usage: node scripts/release.cjs <version> [--no-git]");
  console.log("Example: node scripts/release.cjs 1.0.5");
  process.exit(1);
}

// Validate version format (semver: major.minor.patch)
const semverRegex = /^\d+\.\d+\.\d+$/;
if (!semverRegex.test(versionArg)) {
  console.error(`❌ Error: Invalid version format "${versionArg}"`);
  console.log("Version must follow semver format: major.minor.patch (e.g., 1.0.5)");
  process.exit(1);
}

const newVersion = versionArg;

console.log("🚀 Starting release process...\n");

// File paths
const packageJsonPath = path.join(process.cwd(), "package.json");
const cargoTomlPath = path.join(process.cwd(), "src-tauri", "Cargo.toml");
const tauriConfigPath = path.join(process.cwd(), "src-tauri", "tauri.conf.json");

// 1. Update package.json
console.log("📦 Updating package.json...");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const oldVersion = packageJson.version;
console.log(`   ${oldVersion} → ${newVersion}`);
packageJson.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n");
console.log("   ✅ package.json updated\n");

// 2. Update Cargo.toml
console.log("🦀 Updating Cargo.toml...");
let cargoToml = fs.readFileSync(cargoTomlPath, "utf8");
const cargoVersionRegex = /^version\s*=\s*"[^\"]*"/m;
if (!cargoVersionRegex.test(cargoToml)) {
  console.error("   ❌ Error: Could not find version line in Cargo.toml");
  process.exit(1);
}
cargoToml = cargoToml.replace(cargoVersionRegex, `version = "${newVersion}"`);
fs.writeFileSync(cargoTomlPath, cargoToml);
console.log("   ✅ Cargo.toml updated\n");

// 3. Update tauri.conf.json
console.log("⚙️  Updating tauri.conf.json...");
const tauriConfig = JSON.parse(fs.readFileSync(tauriConfigPath, "utf8"));
tauriConfig.version = newVersion;
fs.writeFileSync(tauriConfigPath, JSON.stringify(tauriConfig, null, 2) + "\n");
console.log("   ✅ tauri.conf.json updated\n");

// 4. Git operations (if not skipped)
if (!noGit) {
  console.log("📝 Creating git commit and tag...");

  try {
    // Check if there are uncommitted changes
    execSync("git diff-index --quiet HEAD --", { stdio: "pipe" });
  } catch (error) {
    console.log("   ⚠️  Warning: You have uncommitted changes");
    console.log("   Continuing with release commit...\n");
  }

  try {
    // Stage the version files
    execSync("git add package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json", { stdio: "inherit" });

    // Create commit
    const commitMessage = `chore: bump version to ${newVersion}`;
    execSync(`git commit -m "${commitMessage}"`, { stdio: "inherit" });
    console.log(`   ✅ Commit created: "${commitMessage}"\n`);

    // Create tag
    const tagName = `v${newVersion}`;
    execSync(`git tag -a ${tagName} -m "Release ${newVersion}"`, { stdio: "inherit" });
    console.log(`   ✅ Tag created: ${tagName}\n`);

    console.log("💡 To push the changes and tag:");
    console.log(`   git push origin main`);
    console.log(`   git push origin ${tagName}`);

  } catch (error) {
    console.error("   ❌ Error during git operations:", error.message);
    process.exit(1);
  }
} else {
  console.log("⏭️  Skipping git commit and tag (--no-git flag)\n");
}

console.log("✨ Release process completed successfully!");
console.log(`\n📋 Summary:`);
console.log(`   Old version: ${oldVersion}`);
console.log(`   New version: ${newVersion}`);
console.log(`   Files updated: 3`);
console.log(`   - package.json`);
console.log(`   - src-tauri/Cargo.toml`);
console.log(`   - src-tauri/tauri.conf.json`);
if (!noGit) {
  console.log(`   - Git commit and tag created`);
}
console.log("\n🎉 Ready to release!");
