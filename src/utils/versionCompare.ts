/**
 * Numeric version comparison for release tags ("v1.10.10" > "v1.10.9").
 *
 * `1.10.10 < 1.10.9` under a string compare, which is how a shipped update can
 * look absent. Pre-release suffixes are ignored: "1.2.0-beta.1" ranks as 1.2.0.
 */
export function compareVersions(left: string, right: string): number {
  const parse = (version: string): number[] =>
    version
      .replace(/^v/i, "")
      .split("-")[0]!
      .split(".")
      .map((part) => {
        const value = Number.parseInt(part, 10);
        return Number.isNaN(value) ? 0 : value;
      });

  const a = parse(left);
  const b = parse(right);
  const length = Math.max(a.length, b.length);

  for (let i = 0; i < length; i += 1) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }

  return 0;
}

export function isNewerVersion(candidate: string, current: string): boolean {
  if (!candidate || !current) return false;
  return compareVersions(candidate, current) > 0;
}
