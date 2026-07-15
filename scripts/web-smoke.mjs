// Runtime smoke for the standalone web app (apps/web) + provider CORS probe.
// Needs `npm run dev -w apps/web` running on :5174. Usage: node scripts/web-smoke.mjs
import { chromium } from 'playwright';

const APP = process.env.DEKU_WEB_URL ?? 'http://localhost:5174';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript(() => {
  localStorage.setItem('deku-theme', 'light');
  localStorage.setItem('deku-api-keys', JSON.stringify({ ANTHROPIC_API_KEY: 'sk-ant-bogus-key' }));
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

// 1. app boots and seeds the demo
await page.goto(APP, { waitUntil: 'networkidle' });
await page.waitForSelector('.msg-assistant', { timeout: 15000 });
const title = await page.locator('.chat-header').textContent();
console.log('BOOT_OK', title?.includes('Q3 campaign messaging') ? 'seeded' : `unexpected: ${title}`);

// 2. IndexedDB persistence across reload
await page.getByRole('button', { name: 'Branch', exact: true }).click();
await page.waitForTimeout(400);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.msg-assistant');
const hasBranch = await page.locator('.branch-row', { hasText: 'Branch 1' }).count();
console.log('PERSIST_OK', hasBranch > 0 ? 'Branch 1 survived reload' : 'MISSING branch after reload');

// 3. full agent path through the UI with a bogus key:
//    a provider 401 reaching the toast proves LangGraph ran in-browser and CORS passed
await page.locator('.composer textarea').fill('hello');
await page.getByRole('button', { name: 'Send' }).click();
const toast = page.locator('.toast-box');
await toast.waitFor({ timeout: 20000 });
console.log('AGENT_TOAST', JSON.stringify(await toast.textContent()));

// 4. local branching ops through the UI (IdbStore + core ops)
await page.locator('.toast-box button').click().catch(() => {});
await page.getByRole('button', { name: 'Rewind', exact: true }).click();
await page.locator('.modal .pick-row').nth(1).click();
await page.waitForTimeout(2200);
const onRewind = await page.locator('.chat-header').textContent();
console.log('REWIND_OK', onRewind?.includes('Rewind') ? 'switched to rewind branch' : `unexpected: ${onRewind}`);

// 5. CORS probe per provider endpoint (bogus keys): HTTP status = CORS open, TypeError = blocked
const probes = {
  anthropic: ['https://api.anthropic.com/v1/messages', { 'x-api-key': 'bogus', 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }],
  openai: ['https://api.openai.com/v1/chat/completions', { authorization: 'Bearer bogus' }],
  google: ['https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=bogus', {}],
  groq: ['https://api.groq.com/openai/v1/chat/completions', { authorization: 'Bearer bogus' }],
  mistral: ['https://api.mistral.ai/v1/chat/completions', { authorization: 'Bearer bogus' }],
  cohere: ['https://api.cohere.com/v2/chat', { authorization: 'Bearer bogus' }],
  xai: ['https://api.x.ai/v1/chat/completions', { authorization: 'Bearer bogus' }],
  deepseek: ['https://api.deepseek.com/chat/completions', { authorization: 'Bearer bogus' }],
  tavily: ['https://api.tavily.com/search', {}],
};
for (const [name, [url, headers]] of Object.entries(probes)) {
  const result = await page.evaluate(async ({ url, headers }) => {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify({ model: 'probe', messages: [{ role: 'user', content: 'hi' }], api_key: 'bogus', query: 'hi' }),
      });
      return `CORS_OK status=${res.status}`;
    } catch (e) {
      return `BLOCKED ${String(e).slice(0, 80)}`;
    }
  }, { url, headers });
  console.log(`PROBE ${name}: ${result}`);
}

console.log('PAGE_ERRORS', errors.length ? errors.slice(0, 3) : 'none');
await browser.close();
