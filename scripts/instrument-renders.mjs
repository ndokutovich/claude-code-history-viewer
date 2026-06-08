// Count React commits/sec and name the components that render, via the
// React DevTools global hook (present in dev builds).
import { chromium } from '@playwright/test';
const PORT = 9222;
const sec = Number(process.argv[2] || 3);
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
const ctx = browser.contexts()[0];
const page = ctx.pages().find((p) => /5173|localhost/.test(p.url())) || ctx.pages()[0];

const ok = await page.evaluate(() => {
  const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (!hook) return false;
  globalThis.__rc = { commits: 0, names: new Map() };
  const walk = (fiber, depth, out) => {
    // collect displayName of fibers that have memoizedProps changed this commit is hard;
    // instead, sample the type names near the root of the committed tree.
    let n = fiber, count = 0;
    while (n && count < 40) {
      const t = n.type;
      const name = typeof t === 'function' ? (t.displayName || t.name) : (typeof t === 'string' ? null : (t?.displayName || null));
      if (name) out.set(name, (out.get(name) || 0) + 1);
      n = n.child; count++;
    }
  };
  const orig = hook.onCommitFiberRoot;
  hook.onCommitFiberRoot = function (id, root, ...rest) {
    globalThis.__rc.commits++;
    try { walk(root.current, 0, globalThis.__rc.names); } catch {}
    return orig ? orig.call(this, id, root, ...rest) : undefined;
  };
  return true;
});

if (!ok) { console.log('React DevTools hook not available — cannot count commits.'); await browser.close(); process.exit(0); }

await new Promise((r) => setTimeout(r, sec * 1000));
const res = await page.evaluate((s) => ({
  perSec: (globalThis.__rc.commits / s).toFixed(1),
  total: globalThis.__rc.commits,
  names: [...globalThis.__rc.names].sort((a, b) => b[1] - a[1]).slice(0, 15),
}), sec);
console.log(`React commits: ${res.total} total = ${res.perSec}/sec`);
console.log('top component names near committed roots:');
res.names.forEach(([n, c]) => console.log(`  ${String(c).padStart(5)}  ${n}`));
await browser.close();
