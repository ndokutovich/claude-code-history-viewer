import { chromium } from '@playwright/test';
const b = await chromium.connectOverCDP('http://127.0.0.1:9222');
const p = b.contexts()[0].pages().find((p) => /5173|localhost/.test(p.url())) || b.contexts()[0].pages()[0];
const info = await p.evaluate(() => {
  const q = (s) => document.querySelectorAll(s).length;
  // sample clickable tree items
  const treeitems = [...document.querySelectorAll('[role="treeitem"]')].slice(0, 4).map((e) => ({
    text: (e.textContent || '').trim().slice(0, 40), aria: e.getAttribute('aria-expanded'),
  }));
  return {
    url: location.href,
    msgNodes: q('[id^="message-"]'),
    hasLog: !!document.querySelector('[role="log"]'),
    treeitems: q('[role="treeitem"]'),
    buttonsInAside: q('aside button'),
    sampleTreeitems: treeitems,
    loadAllBtn: !!([...document.querySelectorAll('button')].find((b) => /load all/i.test(b.textContent || ''))),
  };
});
console.log(JSON.stringify(info, null, 2));
await b.close();
