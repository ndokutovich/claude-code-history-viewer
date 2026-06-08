// Open a heavy session and measure message-list scroll cost (DOM nodes, React
// commits/sec, CPU) — baseline for virtualization work.
import { chromium } from '@playwright/test';
const PORT = 9222;
const projMatch = process.argv[2] || 'ccpaste';
const b = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
const ctx = b.contexts()[0];
const page = ctx.pages().find((p) => /5173|localhost/.test(p.url())) || ctx.pages()[0];

const clickByText = async (sel, rx) => page.evaluate(({ sel, rx }) => {
  const el = [...document.querySelectorAll(sel)].find((e) => new RegExp(rx, 'i').test(e.textContent || ''));
  if (el) { el.click(); return (el.textContent || '').trim().slice(0, 40); }
  return null;
}, { sel, rx });

const proj = await clickByText('[role="treeitem"]', projMatch);
console.log('clicked project:', proj);
await page.waitForTimeout(2500);

// session rows appear as nested treeitems / buttons after expand; click the first that looks like a session (has a time / message count)
const sess = await page.evaluate(() => {
  const items = [...document.querySelectorAll('[role="treeitem"], button')]
    .filter((e) => /message|ago|session|\d{1,3} msg/i.test(e.textContent || ''));
  const target = items[0];
  if (target) { target.click(); return (target.textContent || '').trim().slice(0, 50); }
  return null;
});
console.log('clicked session:', sess);

// wait for message log
let ok = false;
for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(500);
  const n = await page.evaluate(() => document.querySelectorAll('[id^="message-"]').length);
  if (n > 0) { ok = true; break; }
}
const census0 = await page.evaluate(() => ({
  msgNodes: document.querySelectorAll('[id^="message-"]').length,
  domNodes: document.querySelectorAll('*').length,
}));
console.log('after open:', JSON.stringify(census0));

// Click "Load All" if present and let it load everything (stress test)
if (process.argv.includes('--loadall')) {
  const clicked = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((b) => /load all/i.test(b.textContent || ''));
    if (b) { b.click(); return true; } return false;
  });
  console.log('Load All clicked:', clicked);
  if (clicked) {
    const t0 = Date.now();
    let prev = 0, stable = 0;
    for (let i = 0; i < 120; i++) {
      await page.waitForTimeout(500);
      const n = await page.evaluate(() => document.querySelectorAll('[id^="message-"]').length);
      if (n === prev) { if (++stable >= 4) break; } else { stable = 0; prev = n; }
    }
    console.log(`Load All settled in ~${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
}

const census1 = await page.evaluate(() => ({
  msgNodes: document.querySelectorAll('[id^="message-"]').length,
  domNodes: document.querySelectorAll('*').length,
  scrollHeight: (document.querySelector('[role="log"]') || {}).scrollHeight || 0,
}));
console.log('before scroll:', JSON.stringify(census1));

// install commit counter
await page.evaluate(() => {
  const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (!hook) return;
  globalThis.__rc = 0;
  const o = hook.onCommitFiberRoot;
  hook.onCommitFiberRoot = function (...a) { globalThis.__rc++; return o ? o.apply(this, a) : undefined; };
});
const cdp = await ctx.newCDPSession(page);
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 100 });
await page.evaluate(() => { globalThis.__rc = 0; });
await cdp.send('Profiler.start');
// scroll burst
for (let i = 0; i < 20; i++) {
  await page.evaluate(() => { const el = document.querySelector('[role="log"]'); if (el) el.scrollTop += 500; });
  await page.waitForTimeout(80);
}
const prof = (await cdp.send('Profiler.stop')).profile;
const commits = await page.evaluate(() => globalThis.__rc);
// busy CPU = total minus (idle)
const byId = new Map(prof.nodes.map((n) => [n.id, n.callFrame]));
let busy = 0, idle = 0;
for (let i = 0; i < prof.samples.length; i++) {
  const cf = byId.get(prof.samples[i]); const d = prof.timeDeltas[i] || 0;
  if (cf && cf.functionName === '(idle)') idle += d; else busy += d;
}
console.log(`SCROLL over ~1.6s: commits=${commits}, busyCPU=${(busy / 1000).toFixed(0)}ms, idle=${(idle / 1000).toFixed(0)}ms, msgNodes=${census1.msgNodes}`);
await b.close();
