// Ad-hoc CPU profiler for the running Tauri app (WebView2 remote-debug :9222).
// Usage: node scripts/profile-cpu.mjs [idleSeconds]
import { chromium } from '@playwright/test';

const PORT = 9222;
const idleSec = Number(process.argv[2] || 8);

function summarize(profile, label) {
  const { nodes, samples, timeDeltas } = profile;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  // self time per node id (sum of timeDeltas where the sample's leaf == node)
  const selfUs = new Map();
  for (let i = 0; i < samples.length; i++) {
    const id = samples[i];
    selfUs.set(id, (selfUs.get(id) || 0) + (timeDeltas[i] || 0));
  }
  const rows = [];
  for (const [id, us] of selfUs) {
    const n = byId.get(id);
    if (!n) continue;
    const cf = n.callFrame || {};
    const name = cf.functionName || '(anonymous)';
    const url = (cf.url || '').replace(/^.*[\\/](src|node_modules)[\\/]/, '$1/').slice(-60);
    rows.push({ name, where: `${url}:${cf.lineNumber ?? '?'}`, ms: us / 1000 });
  }
  rows.sort((a, b) => b.ms - a.ms);
  const total = rows.reduce((s, r) => s + r.ms, 0);
  console.log(`\n=== ${label} — total sampled CPU ≈ ${total.toFixed(0)}ms over ${idleSec}s ===`);

  // OUR code only (src/), aggregated by function name — these are the triggers.
  const ours = new Map();
  for (const [id, us] of selfUs) {
    const n = byId.get(id); if (!n) continue;
    const cf = n.callFrame || {};
    if (!/[\\/]src[\\/]/.test(cf.url || '') || /node_modules/.test(cf.url || '')) continue;
    const key = `${cf.functionName || '(anon)'}  ${(cf.url || '').replace(/\?.*$/, '').replace(/^.*[\\/]src[\\/]/, 'src/')}:${cf.lineNumber}`;
    ours.set(key, (ours.get(key) || 0) + us / 1000);
  }
  const oursRows = [...ours].sort((a, b) => b[1] - a[1]);
  console.log('  -- top OUR-code (src/) self-time --');
  for (const [k, ms] of oursRows.slice(0, 12)) {
    if (ms < 0.3) break;
    console.log(`  ${ms.toFixed(1).padStart(7)}  ${k}`);
  }

  // Top-down: subtree total per node (self+descendants), aggregated by function.
  const childMap = new Map(nodes.map((n) => [n.id, n.children || []]));
  const selfById = new Map(nodes.map((n) => [n.id, 0]));
  for (let i = 0; i < samples.length; i++)
    selfById.set(samples[i], (selfById.get(samples[i]) || 0) + (timeDeltas[i] || 0));
  const memo = new Map();
  const subtree = (id) => {
    if (memo.has(id)) return memo.get(id);
    let t = selfById.get(id) || 0;
    for (const c of childMap.get(id) || []) t += subtree(c);
    memo.set(id, t); return t;
  };
  const byFn = new Map();
  for (const n of nodes) {
    const cf = n.callFrame || {};
    const key = `${cf.functionName || '(anon)'}  ${(cf.url || '').replace(/\?.*$/, '').replace(/^.*[\\/](src|node_modules)[\\/]/, '$1/').slice(-50)}`;
    byFn.set(key, Math.max(byFn.get(key) || 0, subtree(n.id) / 1000));
  }
  console.log('  -- top SUBTREE drivers (entry points scheduling the work) --');
  for (const [k, ms] of [...byFn].sort((a, b) => b[1] - a[1]).slice(0, 14))
    console.log(`  ${ms.toFixed(0).padStart(7)}  ${k}`);
}

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
const ctx = browser.contexts()[0];
const pages = ctx.pages();
const page = pages.find((p) => !p.url().startsWith('devtools://')) || pages[0];
console.log('Connected. page url:', page.url());

const cdp = await ctx.newCDPSession(page);

// DOM / message-node census (confirms (non-)virtualization)
const census = await page.evaluate(() => ({
  domNodes: document.querySelectorAll('*').length,
  messageNodes: document.querySelectorAll('[id^="message-"]').length,
  scrollers: document.querySelectorAll('.overflow-y-auto, [class*="overflow-y"]').length,
}));
console.log('DOM census:', JSON.stringify(census));

await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 100 }); // 100us

// --- IDLE profile (no interaction) ---
await cdp.send('Profiler.start');
await new Promise((r) => setTimeout(r, idleSec * 1000));
const idle = (await cdp.send('Profiler.stop')).profile;
summarize(idle, 'IDLE (no interaction)');

// --- SCROLL profile (drive the message scroller) ---
const scrolled = await page.evaluate(() => {
  const el = document.querySelector('[role="log"]') ||
    [...document.querySelectorAll('*')].find((e) => e.scrollHeight > e.clientHeight + 200 && /overflow-y/.test(e.className || ''));
  return el ? { ok: true, scrollHeight: el.scrollHeight } : { ok: false };
});
if (scrolled.ok) {
  await cdp.send('Profiler.start');
  for (let i = 0; i < 12; i++) {
    await page.evaluate(() => {
      const el = document.querySelector('[role="log"]');
      if (el) el.scrollTop += 600;
    });
    await new Promise((r) => setTimeout(r, 120));
  }
  const scroll = (await cdp.send('Profiler.stop')).profile;
  summarize(scroll, `SCROLL (message list, scrollHeight=${scrolled.scrollHeight})`);
} else {
  console.log('\n(no scrollable message log found — open a session with many messages first)');
}

await browser.close();
console.log('\ndone.');
