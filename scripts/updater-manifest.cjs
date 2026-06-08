// Helpers for assembling the Tauri updater `latest.json` from a GitHub release.
//
// Background — three bugs this module fixes (see git history / release v1.10.3):
//   1. The old workflow fetched signatures from `browser_download_url`, which
//      returns a 404 "Not Found" body for assets on an unpublished/draft
//      release. Without an `ok` check that text was stored AS the signature
//      (base64("Not Found") === "Tm90IEZvdW5k"), so the updater rejected every
//      download — the "Download does nothing" bug.
//   2. A Tauri `.sig` file's contents ARE the signature string the updater
//      expects verbatim. The old code base64-encoded it a SECOND time, which
//      would fail verification even if the fetch had succeeded.
//   3. macOS pointed the updater at the `.dmg` (no `.dmg.sig`); the updater
//      bundle is the `.app.tar.gz` with a `.app.tar.gz.sig`.
//
// A valid Tauri signature file is the base64 of a minisign signature, whose
// decoded form starts with "untrusted comment:". We validate that shape and
// throw on anything else so a broken manifest can never be published.

/**
 * Validate a raw `.sig` file's contents and return the signature string to
 * place in latest.json verbatim (no re-encoding). Throws on missing/invalid
 * content (empty, an HTTP error body like "Not Found", or not a minisign sig).
 *
 * @param {string|null|undefined} rawContent  raw bytes of the `.sig` file as text
 * @param {string} label                      platform label for error messages
 * @returns {string}
 */
function validateSignature(rawContent, label) {
  const content = (rawContent ?? "").trim();

  if (!content) {
    throw new Error(`Missing signature for ${label}: empty content`);
  }
  // Reject obvious HTTP error bodies (the 404 "Not Found" regression).
  if (content.length < 100 || /^(not found|bad credentials|<!doctype|<html)/i.test(content)) {
    throw new Error(
      `Invalid signature for ${label}: looks like an error response, not a .sig ` +
        `(len=${content.length}, starts="${content.slice(0, 24)}")`
    );
  }
  // A Tauri .sig is base64 whose decoded form begins with "untrusted comment:".
  let decoded;
  try {
    decoded = Buffer.from(content, "base64").toString("utf8");
  } catch {
    throw new Error(`Invalid signature for ${label}: not valid base64`);
  }
  if (!decoded.startsWith("untrusted comment:")) {
    throw new Error(
      `Invalid signature for ${label}: decoded content is not a minisign signature`
    );
  }
  return content;
}

/**
 * Pick the updater artifact + its signature asset for each platform from a
 * release's asset list. macOS uses the `.app.tar.gz` updater bundle (NOT the
 * `.dmg`). Returns a map of tauri platform key → { asset, sigAsset } for every
 * platform whose primary artifact is present.
 *
 * @param {Array<{name:string}>} assets
 */
function selectPlatformAssets(assets) {
  const find = (pred) => assets.find((a) => a?.name && pred(a.name));
  const out = {};

  const macApp = find((n) => n.endsWith(".app.tar.gz"));
  if (macApp) {
    out["darwin-universal"] = {
      asset: macApp,
      sigAsset: find((n) => n.endsWith(".app.tar.gz.sig")),
    };
  }

  const msi = find((n) => n.endsWith(".msi") && !n.endsWith(".sig"));
  if (msi) {
    out["windows-x86_64"] = {
      asset: msi,
      sigAsset: find((n) => n === `${msi.name}.sig`),
    };
  }

  const appImage = find((n) => n.endsWith(".AppImage") && !n.endsWith(".sig"));
  if (appImage) {
    out["linux-x86_64"] = {
      asset: appImage,
      sigAsset: find((n) => n === `${appImage.name}.sig`),
    };
  }

  return out;
}

/**
 * Assemble the final latest.json object. `signatureFor` maps a platform key to
 * its already-validated signature string.
 */
function buildManifest({ version, notes, pubDate, platforms }) {
  if (!version) throw new Error("buildManifest: version is required");
  if (!platforms || Object.keys(platforms).length === 0) {
    throw new Error("buildManifest: no platforms resolved — refusing to publish empty manifest");
  }
  return {
    version,
    notes: notes || "",
    pub_date: pubDate,
    platforms,
  };
}

module.exports = { validateSignature, selectPlatformAssets, buildManifest };
