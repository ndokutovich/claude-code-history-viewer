// Find what schedules continuous work: count rAF/setTimeout/setInterval calls
// over N seconds and capture the most frequent caller stack.
import { chromium } from '@playwright/test';
const PORT = 9222;
const sec = Number(process.argv[2] || 3);
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
const ctx = browser.contexts()[0];
const page = ctx.pages().find((p) => /5173|localhost/.test(p.url())) || ctx.pages()[0];

await page.evaluate(() => {
  const top = (n) => (new Error().stack || '').split('\n').slice(2, 5).join(' | ').replace(/https?:\/\/[^ )]*\/(src|node_modules)\//g, '$1/');
  globalThis.__c = { raf: new Map(), to: new Map(), si: new Map() };
  const bump = (m, k) => m.set(k, (m.get(k) || 0) + 1);
  const oraf = window.requestAnimationFrame;
  window.requestAnimationFrame = function (cb) { bump(globalThis.__c.raf, top()); return oraf.call(this, cb); };
  const oto = window.setTimeout;
  window.setTimeout = function (cb, d, ...a) { bump(globalThis.__c.to, `${d}ms ${top()}`); return oto.call(this, cb, d, ...a); };
  const osi = window.setInterval;
  window.setInterval = function (cb, d, ...a) { bump(globalThis.__c.si, `${d}ms ${top()}`); return osi.call(this, cb, d, ...a); };
});

await new Promise((r) => setTimeout(r, sec * 1000));

const res = await page.evaluate((s) => {
  const dump = (m) => [...m].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => `${(n / s).toFixed(0)}/s  ${k}`);
  return { raf: dump(globalThis.__c.raf), to: dump(globalThis.__c.to), si: dump(globalThis.__c.si) };
}, sec);

console.log('=== requestAnimationFrame callers (per sec) ===');
res.raf.forEach((r) => console.log('  ' + r));
console.log('=== setTimeout callers (per sec) ===');
res.to.forEach((r) => console.log('  ' + r));
console.log('=== setInterval callers (per sec) ===');
res.si.forEach((r) => console.log('  ' + r));
await browser.close();
