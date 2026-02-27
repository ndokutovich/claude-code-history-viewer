#!/usr/bin/env node

/**
 * Cross-platform script runner that uses the current package manager
 *
 * Usage: node scripts/run-with-pm.cjs <command>
 * Example: node scripts/run-with-pm.cjs sync-version
 */

const { execSync } = require("child_process");

const command = process.argv[2];

if (!command) {
  console.error("Error: Command argument is required");
  console.log("Usage: node scripts/run-with-pm.cjs <command>");
  process.exit(1);
}

// Detect package manager from npm_execpath or npm_config_user_agent
const packageManager =
  process.env.npm_execpath?.includes("pnpm") ? "pnpm" :
  process.env.npm_execpath?.includes("yarn") ? "yarn" :
  process.env.npm_execpath?.includes("bun") ? "bun" :
  process.env.npm_config_user_agent?.includes("pnpm") ? "pnpm" :
  process.env.npm_config_user_agent?.includes("yarn") ? "yarn" :
  process.env.npm_config_user_agent?.includes("bun") ? "bun" :
  "npm";

try {
  execSync(`${packageManager} run ${command}`, { stdio: "inherit" });
} catch (error) {
  process.exit(error.status || 1);
}
