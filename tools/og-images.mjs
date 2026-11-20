/**
 * Gera as imagens de prévia dos links (1200×630): public/og.png (o site) e public/og-desafio.png
 * (link de desafio do cronômetro). Sem texto em português ou inglês: servem para as duas versões.
 *
 * Uso: npm run build && npx wrangler pages dev dist --port 8788   (em outro terminal)
 *      node tools/og-images.mjs
 */
import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:8788';
const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome' });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(BASE + '/');
await page.waitForSelector('.pz-card svg');
const icons = await page.evaluate(() =>
  Object.fromEntries([...document.querySelectorAll('a.pz-card')].map((a) => [new URL(a.href).pathname.slice(1), a.querySelector('svg').outerHTML])),
);
const logo = await (await page.request.get(BASE + '/logo.svg')).text();

const shell = (body) => `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face { font-family: 'Space Grotesk'; font-weight: 500 700; src: url('${BASE}/fonts/space-grotesk-latin.woff2') format('woff2'); }
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; overflow: hidden; color: #eef1f8; font-family: 'Space Grotesk', sans-serif;
    background: radial-gradient(700px 420px at 88% 0%, rgba(124,140,255,0.32), transparent 65%),
                radial-gradient(600px 420px at 0% 100%, rgba(63,208,201,0.22), transparent 60%), #0b0e17; }
  .brand { display: flex; align-items: center; gap: 22px; }
  .brand svg { width: 96px; height: 96px; }
  .word { font-size: 92px; font-weight: 700; letter-spacing: -0.03em; }
  .word b { background: linear-gradient(90deg, #7c8cff, #3fd0c9); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .row { display: flex; gap: 26px; align-items: flex-end; }
  .row svg { width: 92px; height: 92px; filter: drop-shadow(0 12px 18px rgba(0,0,0,0.45)); }
</style></head><body>${body}</body></html>`;

// ---- o site
await page.setContent(
  shell(`<div style="position:absolute;left:84px;top:110px">
      <div class="brand">${logo}<span class="word">Cubo<b>Guia</b></span></div>
      <div style="width:520px;height:6px;border-radius:6px;margin:34px 0 52px;background:linear-gradient(90deg,#ffd500,#ff6a13,#d0192d,#00a651,#0a5bd6)"></div>
      <div class="row">${['2x2', '3x3', '4x4', '5x5', 'pyraminx', 'skewb', 'megaminx'].map((k) => icons[k]).join('')}</div>
    </div>
    <div style="position:absolute;right:-40px;top:70px;transform:rotate(-8deg)">${icons['3x3'].replace('<svg', '<svg style="width:400px;height:400px;filter:drop-shadow(0 30px 40px rgba(0,0,0,.55))"')}</div>`),
);
await page.waitForTimeout(300);
await page.screenshot({ path: 'public/og.png' });

// ---- desafio: o cronômetro (como o das competições) e dois cubos frente a frente
const duel = (deg) => icons['3x3'].replace('<svg', `<svg style="width:170px;height:170px;transform:rotate(${deg}deg);filter:drop-shadow(0 20px 30px rgba(0,0,0,.5))"`);
await page.setContent(
  shell(`<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:34px;padding-bottom:40px">
      <div style="padding:22px 50px;border-radius:34px;background:#05070c;border:3px solid rgba(255,255,255,0.14);box-shadow:0 0 90px rgba(61,220,132,0.28), inset 0 0 40px rgba(61,220,132,0.08)">
        <div style="font-size:136px;font-weight:700;line-height:1;color:#3ddc84;letter-spacing:-0.02em;font-variant-numeric:tabular-nums">0.00</div>
      </div>
      <div style="display:flex;align-items:center;gap:70px">
        ${duel(-12)}
        <span style="font-size:76px;font-weight:700;color:#ffd500;text-shadow:0 0 40px rgba(255,213,0,0.35)">VS</span>
        ${duel(12)}
      </div>
      <div class="brand" style="position:absolute;left:48px;bottom:36px;gap:14px">${logo.replace('<svg', '<svg style="width:56px;height:56px"')}<span class="word" style="font-size:48px">Cubo<b>Guia</b></span></div>
    </div>`),
);
await page.waitForTimeout(300);
await page.screenshot({ path: 'public/og-desafio.png' });
await browser.close();
console.log('ok: public/og.png e public/og-desafio.png');
