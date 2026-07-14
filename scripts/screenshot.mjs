// Captures README screenshots from the running dev server (http://localhost:5173).
// Usage: node scripts/screenshot.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

mkdirSync('docs', { recursive: true });
const browser = await chromium.launch();

for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await ctx.addInitScript((t) => localStorage.setItem('deku-theme', t), theme);
  const page = await ctx.newPage();
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.waitForSelector('.msg-assistant', { timeout: 15000 });
  // open the tool-use disclosure so "Show the work" content is visible
  await page.locator('.work summary').first().click().catch(() => {});
  await page.waitForTimeout(400);
  await page.screenshot({ path: `docs/screenshot-${theme}.png` });
  console.log(`captured docs/screenshot-${theme}.png`);
  await ctx.close();
}

await browser.close();
