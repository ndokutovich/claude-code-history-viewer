// Count fetch() / Tauri IPC invocations and their callers (finds async setState loops).
import { chromium } from '@playwright/test';
const PORT = 9222;
const sec = Number(process.argv[2] || 3);
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
const ctx = browser.contexts()[0];
const page = ctx.pages().find((p) => /5173|localhost/.test(p.url())) || ctx.pages()[0];

await page.evaluate(() => {
  const top = () => (new Error().stack || '').split('\n').slice(2, 6).join(' | ')
    .replace(/https?:\/\/[^ )]*\/(src|node_modules|@[^/]+)\//g, '$1/').replace(/\?[a-z0-9=]+/g, '');
  globalThis.__a = { fetch: new Map(), ipc: new Map() };
  const bump = (m, k, arg) => m.set(`${arg} ${k}`, (m.get(`${arg} ${k}`) || 0) + 1);
  const of = window.fetch;
  window.fetch = function (u, ...r) { bump(globalThis.__a.fetch, top(), String(u).slice(0, 40)); return of.call(this, u, ...r); };
  // Tauri IPC core (withGlobalTauri:false, but internals exist)
  const ti = window.__TAURI_INTERNALS__;
  if (ti && typeof ti.invoke === 'function') {
    const oi = ti.invoke;
    ti.invoke = function (cmd, ...r) { bump(globalThis.__a.ipc, top(), cmd); return oi.call(this, cmd, ...r); };
  }
});
await new Promise((r) => setTimeout(r, sec * 1000));
const res = await page.evaluate((s) => {
  const dump = (m) => [...m].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => `${(n / s).toFixed(1)}/s  ${k}`);
  return { fetch: dump(globalThis.__a.fetch), ipc: dump(globalThis.__a.ipc), hasIpc: !!window.__TAURI_INTERNALS__ };
}, sec);
console.log('=== fetch() callers (per sec) ===');
res.fetch.length ? res.fetch.forEach((r) => console.log('  ' + r)) : console.log('  (none)');
console.log(`=== Tauri IPC invoke callers (per sec)  [internals:${res.hasIpc}] ===`);
res.ipc.length ? res.ipc.forEach((r) => console.log('  ' + r)) : console.log('  (none)');
await browser.close();
