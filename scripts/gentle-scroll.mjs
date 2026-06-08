// Human-paced scroll: CDP CPU profile + commit count over slow steps.
import { chromium } from '@playwright/test';
const b = await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx = b.contexts()[0];
const page = ctx.pages().find((p) => /5173|localhost/.test(p.url())) || ctx.pages()[0];
const has = await page.evaluate(() => !!document.querySelector('[role="log"]') && document.querySelectorAll('[id^="message-"]').length > 0);
if (!has) { console.log('no open session — run: node scripts/measure-scroll.mjs ccpaste --loadall'); await b.close(); process.exit(0); }

await page.evaluate(() => {
  const h = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  globalThis.__rc = 0;
  if (h) { const o = h.onCommitFiberRoot; h.onCommitFiberRoot = function (...a) { globalThis.__rc++; return o ? o.apply(this, a) : undefined; }; }
});
const cdp = await ctx.newCDPSession(page);
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 100 });
await page.evaluate(() => { globalThis.__rc = 0; });

const STEPS = 12, PX = 300, GAP = 250; // human-ish: ~12 slow nudges
await cdp.send('Profiler.start');
const t0 = Date.now();
for (let i = 0; i < STEPS; i++) {
  await page.evaluate((px) => { const el = document.querySelector('[role="log"]'); if (el) el.scrollTop += px; }, PX);
  await page.waitForTimeout(GAP);
}
const wallMs = Date.now() - t0;
const prof = (await cdp.send('Profiler.stop')).profile;
const commits = await page.evaluate(() => globalThis.__rc);
const byId = new Map(prof.nodes.map((n) => [n.id, n.callFrame]));
let busy = 0, idle = 0;
for (let i = 0; i < prof.samples.length; i++) {
  const cf = byId.get(prof.samples[i]); const d = prof.timeDeltas[i] || 0;
  if (cf && cf.functionName === '(idle)') idle += d; else busy += d;
}
const busyMs = busy / 1000;
console.log(`gentle scroll: ${STEPS} steps over ${(wallMs / 1000).toFixed(1)}s | commits=${commits} | busyCPU=${busyMs.toFixed(0)}ms (${((busyMs / wallMs) * 100).toFixed(0)}% of wall) | ~${(busyMs / STEPS).toFixed(0)}ms/step`);
console.log('(<~16ms/step ≈ 60fps smooth; >~50ms/step ≈ noticeable jank)');
await b.close();
