// Records feature walkthrough GIFs for the README from the running dev server
// (npm run dev — FastAPI on :5175 + web on :5173).
// Each scenario re-seeds the demo data (uvicorn --reload picks it up), records
// a Playwright video with a synthetic cursor, and converts it to docs/gif-<name>.gif.
// Usage: node scripts/record-gifs.mjs
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const APP = process.env.DEKU_APP_URL ?? 'http://localhost:5173';
const VID_DIR = '/tmp/deku-vids';
fs.mkdirSync('docs', { recursive: true });
fs.mkdirSync(VID_DIR, { recursive: true });

// ── demo seed: materialized from @deku/core's seed.json (offsets from now, $ref
// entries splice in the referenced branch's messages) ──
const DB_PATH = process.env.DEKU_DB_PATH ?? 'apps/fullstack/backend/data/db.json';
const API_TOUCH = 'apps/fullstack/backend/deku_server/main.py';
const SEED = JSON.parse(fs.readFileSync('packages/core/src/seed.json', 'utf8'));

function materializeMsg(m, now) {
  const out = { ...m, createdAt: now + m.createdAt };
  if (m.summaryOf) out.summaryOf = m.summaryOf.map((o) => materializeMsg(o, now));
  return out;
}

function seedDb() {
  const now = Date.now();
  const conversations = SEED.conversations.map((conv) => {
    const built = [];
    for (const b of conv.branches) {
      const messages = [];
      for (const entry of b.messages) {
        if (entry.$ref) {
          const src = built.find((x) => x.id === entry.$ref);
          messages.push(...src.messages.map((m) => ({ ...m })));
        } else {
          messages.push(materializeMsg(entry, now));
        }
      }
      built.push({ ...b, messages, createdAt: now + b.createdAt });
    }
    return { ...conv, branches: built, createdAt: now + conv.createdAt, updatedAt: now + conv.updatedAt };
  });
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify({ conversations }, null, 2));
}

async function resetServer() {
  seedDb();
  const t = new Date();
  fs.utimesSync(API_TOUCH, t, t); // uvicorn --reload restarts → store re-reads db.json
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 400));
    try {
      const res = await fetch(`${APP}/api/conversations`);
      const list = await res.json();
      if (list.length === 3 && list[0].branchCount === 3) return;
    } catch { /* server restarting */ }
  }
  throw new Error('server did not come back with seed data');
}

// ── synthetic cursor so the GIFs show where the mouse is ──
const CURSOR_SCRIPT = () => {
  window.addEventListener('DOMContentLoaded', () => {
    const c = document.createElement('div');
    Object.assign(c.style, {
      position: 'fixed', width: '16px', height: '16px', borderRadius: '50%',
      background: 'color-mix(in srgb, #9184d9 85%, transparent)', border: '2.5px solid #fff',
      boxShadow: '0 1px 5px rgba(0,0,0,.45)', zIndex: 99999, pointerEvents: 'none',
      transform: 'translate(-50%,-50%)', left: '-30px', top: '-30px',
      transition: 'transform .12s',
    });
    document.body.appendChild(c);
    document.addEventListener('mousemove', (e) => { c.style.left = `${e.clientX}px`; c.style.top = `${e.clientY}px`; }, true);
    document.addEventListener('mousedown', () => { c.style.transform = 'translate(-50%,-50%) scale(.6)'; }, true);
    document.addEventListener('mouseup', () => { c.style.transform = 'translate(-50%,-50%)'; }, true);
  });
};

async function moveTo(page, locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('no bounding box');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 24 });
  await page.waitForTimeout(220);
}
async function click(page, locator) {
  await moveTo(page, locator);
  await page.mouse.down();
  await page.waitForTimeout(90);
  await page.mouse.up();
}

const browser = await chromium.launch();

async function record(name, scenario) {
  await resetServer();
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: VID_DIR, size: { width: 1280, height: 800 } },
  });
  await ctx.addInitScript(() => localStorage.setItem('deku-theme', 'light'));
  await ctx.addInitScript(CURSOR_SCRIPT);
  const page = await ctx.newPage();
  await page.goto(APP, { waitUntil: 'networkidle' });
  await page.waitForSelector('.msg-assistant');
  await page.mouse.move(640, 400);
  await page.waitForTimeout(600);
  await scenario(page);
  await page.waitForTimeout(1400);
  const video = page.video();
  await ctx.close();
  const webm = await video.path();
  const gif = path.join('docs', `gif-${name}.gif`);
  execFileSync('ffmpeg', ['-y', '-ss', '0.5', '-i', webm,
    '-vf', 'fps=10,scale=880:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=4',
    '-loop', '0', gif], { stdio: 'pipe' });
  console.log(`captured ${gif} (${Math.round(fs.statSync(gif).size / 1024)} kB)`);
}

// ── scenarios ──

await record('rewind', async (page) => {
  await click(page, page.locator('.rewind-here').last());
  await page.waitForSelector('.modal');
  await page.waitForTimeout(900);
  await click(page, page.locator('.modal .pick-row').nth(2));
  await page.waitForTimeout(2400); // drop animation + commit + toast
});

await record('combine', async (page) => {
  await click(page, page.getByRole('button', { name: 'Combine', exact: true }));
  await page.waitForSelector('.modal');
  await page.waitForTimeout(700);
  await click(page, page.locator('.modal .pick-row', { hasText: 'Formal tone' }));
  await page.waitForTimeout(3400); // lift → replay → done → toast
});

await record('summarize', async (page) => {
  await click(page, page.getByRole('button', { name: 'Summarize', exact: true }));
  await page.waitForSelector('.modal');
  await page.waitForTimeout(600);
  await click(page, page.locator('.modal .pick-row').nth(1));
  await page.waitForTimeout(350);
  await click(page, page.locator('.modal .pick-row').nth(3));
  await page.waitForTimeout(600);
  await click(page, page.locator('.modal button', { hasText: 'Summarize 3 messages' }));
  await page.waitForTimeout(2600); // drop animation + summary card fade-in
});

await record('tree', async (page) => {
  await click(page, page.getByRole('button', { name: 'Tree', exact: true }));
  await page.waitForSelector('.modal');
  await page.waitForTimeout(800);
  await click(page, page.locator('.modal button', { hasText: 'Formal tone' }).first());
  await page.waitForTimeout(700);
  await click(page, page.locator('.modal button', { hasText: 'Switch to branch' }));
  await page.waitForTimeout(1200); // transcript switches to Formal tone
});

await record('keys', async (page) => {
  await click(page, page.getByTitle('Account options'));
  await page.waitForTimeout(500);
  await click(page, page.getByRole('menuitem', { name: 'API keys…' }));
  await page.waitForSelector('.modal');
  await page.waitForTimeout(600);
  const input = page.locator('.key-row input').first();
  await moveTo(page, input);
  await input.click();
  await input.pressSequentially('sk-ant-api03-demo-key-1234', { delay: 28 });
  await page.waitForTimeout(300);
  await click(page, page.locator('.key-row button', { hasText: 'Save' }).first());
  await page.waitForTimeout(1200); // masked row + toast
});

await browser.close();
console.log('done');
