// Capture WebView console (React warnings pinpoint render loops).
import { chromium } from '@playwright/test';
const PORT = 9222;
const sec = Number(process.argv[2] || 8);
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
const ctx = browser.contexts()[0];
const pick = () => ctx.pages().find((p) => /5173|localhost|tauri|index\.html/.test(p.url()))
  || ctx.pages().find((p) => !/devtools:|about:blank/.test(p.url()))
  || ctx.pages()[0];
let page = pick();
for (let i = 0; i < 20 && (!page || /about:blank/.test(page.url())); i++) {
  await new Promise((r) => setTimeout(r, 500));
  page = pick();
}
const counts = new Map();
page.on('console', (m) => {
  const t = m.type();
  if (t !== 'warning' && t !== 'error') return;
  const txt = m.text().slice(0, 200);
  const key = `[${t}] ${txt}`;
  counts.set(key, (counts.get(key) || 0) + 1);
});
page.on('pageerror', (e) => {
  const key = `[pageerror] ${String(e.message).slice(0, 200)}`;
  counts.set(key, (counts.get(key) || 0) + 1);
});
console.log(`capturing console ${sec}s on ${page.url()} ...`);
await new Promise((r) => setTimeout(r, sec * 1000));
const rows = [...counts].sort((a, b) => b[1] - a[1]);
console.log(`\n=== console warnings/errors (count × message) ===`);
for (const [k, n] of rows.slice(0, 25)) console.log(`  ${String(n).padStart(5)} ${k}`);
if (!rows.length) console.log('  (none)');
await browser.close();
