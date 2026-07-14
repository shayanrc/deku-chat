// Captures per-modal screenshots for the README from the running dev server.
// Usage: node scripts/screenshot-modals.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

mkdirSync('docs', { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => localStorage.setItem('deku-theme', 'light'));
const page = await ctx.newPage();
await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
await page.waitForSelector('.msg-assistant');

async function shot(name, open) {
  await open();
  await page.waitForSelector('.modal');
  await page.waitForTimeout(350); // let the entry animation finish
  await page.locator('.modal').screenshot({ path: `docs/modal-${name}.png` });
  console.log(`captured docs/modal-${name}.png`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
}

await shot('tree', () => page.getByRole('button', { name: 'Tree', exact: true }).click());

await shot('rewind', () => page.getByRole('button', { name: 'Rewind', exact: true }).click());

await shot('combine', () => page.getByRole('button', { name: 'Combine', exact: true }).click());

await shot('summarize', async () => {
  await page.getByRole('button', { name: 'Summarize', exact: true }).click();
  await page.waitForSelector('.modal');
  // select a range (messages 2–4) so the shot shows the selection state
  await page.locator('.modal .pick-row').nth(1).click();
  await page.locator('.modal .pick-row').nth(3).click();
});

await shot('keys', async () => {
  await page.getByTitle('Account options').click();
  await page.getByRole('menuitem', { name: 'API keys…' }).click();
  await page.waitForSelector('.modal');
  // save a fake key so the masked "browser" state is visible
  await page.locator('.key-row input').first().fill('sk-ant-demo-key-1234');
  await page.locator('.key-row button', { hasText: 'Save' }).first().click();
  // dismiss the confirmation toast so it doesn't bleed into the shot
  await page.locator('.toast-box button').click().catch(() => {});
  await page.waitForTimeout(250);
});

await browser.close();
