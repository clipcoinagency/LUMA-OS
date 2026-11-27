// Builds the Etsy V2 listing images (2000x2000 PNG) from the real-app screenshots.
//   node scripts/promo/etsy-v2-images.mjs
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const V2 = path.join(ROOT, 'etsy-delivery-v2');
const RAW = path.join(V2, 'images', 'raw');
const OUT = path.join(V2, 'images');
const PROFILE = path.join(os.tmpdir(), 'lifeos-store-profile');
const html = fs.readFileSync(path.join(ROOT, 'dist', 'index.html'));
const logo = fs.readFileSync(path.join(ROOT, 'packaging', 'pwa', 'favicon.svg'), 'utf8');

const browser = await chromium.launch({ channel: 'msedge' });

// ---- the app's own module icons (read from the real sidebar so they match exactly)
const srv = http.createServer((q, r) => { r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); r.end(html); });
await new Promise((r) => srv.listen(47833, '127.0.0.1', r));
const ictx = await chromium.launchPersistentContext(PROFILE, { channel: 'msedge', viewport: { width: 1440, height: 1000 }, locale: 'en-US', colorScheme: 'dark' });
const ip = ictx.pages()[0];
await ip.goto('http://127.0.0.1:47833/#/dashboard');
await ip.locator('aside.sidebar nav a').first().waitFor();
const ICONS = await ip.evaluate(() => Object.fromEntries([...document.querySelectorAll('aside.sidebar nav a')].map((a) => [a.textContent.trim(), a.querySelector('svg')?.outerHTML ?? ''])));
await ictx.close(); srv.close();
console.log('icons:', Object.keys(ICONS).join(', '));

// ---- images as small JPEG data URIs
const toolPage = await browser.newPage();
async function img(name, maxW = 1500) {
  const b64 = fs.readFileSync(path.join(RAW, name + '.png')).toString('base64');
  return toolPage.evaluate(async ({ b64, maxW }) => {
    const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
    const k = Math.min(1, maxW / im.width); const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.9);
  }, { b64, maxW });
}
const I = {};
for (const [k, w] of [['desktop-home-dark', 1800], ['desktop-home-light', 1500], ['desktop-home-soft', 1500], ['desktop-library-dark', 1500], ['desktop-review-dark', 1100], ['desktop-focus-dark', 1300], ['desktop-finance-dark', 1400], ['desktop-currency-dark', 1200], ['desktop-insights-dark', 1400], ['desktop-datepicker-dark', 900], ['phone-pulse-dark', 640], ['phone-home-dark', 640], ['phone-library-dark', 640], ['phone-review-dark', 640], ['phone-pulse-light', 640], ['phone-home-soft', 640]]) I[k] = await img(k, w);

const FONTS = `<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">`;
const CSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:2000px;height:2000px;overflow:hidden;background:#04050d;color:#eef0ff;font-family:'Inter',system-ui,sans-serif}
  .bg{position:absolute;inset:0;background:radial-gradient(60% 45% at 85% 0%,rgba(120,96,255,.50),transparent 70%),radial-gradient(55% 45% at 4% 100%,rgba(70,130,255,.38),transparent 70%),radial-gradient(40% 30% at 50% 55%,rgba(190,90,255,.14),transparent 70%),#04050d}
  .orb{position:absolute;border-radius:50%;background:radial-gradient(circle at 30% 26%,rgba(255,255,255,.7),rgba(255,255,255,.1) 24%,transparent 34%),radial-gradient(circle at 62% 72%,#7b6cff,#14164f 74%);box-shadow:inset -10px -14px 40px rgba(120,100,255,.4),0 0 90px rgba(120,100,255,.4);opacity:.75}
  .wrap{position:absolute;inset:0;padding:110px 120px}
  .brand{display:flex;align-items:center;gap:22px}.brand svg{width:78px;height:78px;filter:drop-shadow(0 0 30px rgba(110,100,255,.6))}
  .brand b{font-family:'Space Grotesk';font-weight:700;font-size:48px;letter-spacing:-.03em}
  h1{font-family:'Space Grotesk';font-weight:700;letter-spacing:-.035em;line-height:1.02}
  .grad{background:linear-gradient(100deg,#fff 5%,#b9b0ff 52%,#7fd6ff);-webkit-background-clip:text;background-clip:text;color:transparent}
  .sub{color:#a9b0d2;font-weight:500;line-height:1.35}
  .chips{display:flex;gap:16px;flex-wrap:wrap}.chip{padding:14px 28px;border-radius:999px;border:2px solid rgba(190,180,255,.35);background:rgba(120,100,255,.16);font-weight:700;font-size:30px;color:#d9d4ff}
  .win{position:absolute;border-radius:30px;overflow:hidden;border:2px solid rgba(190,180,255,.35);box-shadow:0 60px 160px rgba(0,0,0,.65),0 0 140px rgba(120,100,255,.35);background:#0a0d1c}
  .win img{display:block;width:100%}
  .phone{position:absolute;border-radius:70px;overflow:hidden;border:3px solid rgba(190,180,255,.4);padding:12px;background:#0a0d1c;box-shadow:0 60px 140px rgba(0,0,0,.7),0 0 120px rgba(120,100,255,.4)}
  .phone img{display:block;width:100%;border-radius:58px}
  .tag{display:inline-block;padding:12px 26px;border-radius:999px;font-weight:800;font-size:28px;letter-spacing:.04em;text-transform:uppercase;background:linear-gradient(100deg,#7a6bff,#4aa8ff);color:#fff}
  .li{display:flex;gap:24px;align-items:flex-start;font-size:42px;font-weight:600;line-height:1.25;margin-bottom:34px}
  .dot{flex:none;width:58px;height:58px;border-radius:18px;display:grid;place-items:center;background:linear-gradient(135deg,#7a6bff,#4aa8ff);font-weight:800;font-size:30px;color:#fff;box-shadow:0 10px 30px rgba(110,100,255,.45)}
`;
const logoSvg = logo.replace(/width="512" height="512"/, 'width="78" height="78"');
const brand = `<div class="brand">${logoSvg}<b>Life OS 2.0</b></div>`;

const PAGES = {
  '1-hero': `
    <div class="bg"></div><i class="orb" style="right:90px;top:90px;width:100px;height:100px"></i>
    <div class="wrap">${brand}
      <h1 style="font-size:150px;margin-top:70px;max-width:1500px"><span class="grad">Your entire life.<br>One system.</span></h1>
      <p class="sub" style="font-size:44px;margin-top:34px;max-width:1300px">The private, all-in-one planner app for tasks, goals, habits, focus, study, money and more.</p>
      <div class="chips" style="margin-top:44px"><span class="chip">Windows</span><span class="chip">Mac</span><span class="chip">Android</span><span class="chip">iPhone &amp; iPad</span></div>
    </div>
    <div class="win" style="left:120px;top:1010px;width:1380px"><img src="${I['desktop-home-dark']}"></div>
    <div class="phone" style="right:110px;top:830px;width:540px"><img src="${I['phone-pulse-dark']}"></div>
    <div style="position:absolute;left:120px;top:858px;display:flex;gap:18px"><span class="tag">Instant download</span><span class="tag" style="background:linear-gradient(100deg,#2aa57a,#4ad0a0)">No subscription</span></div>`,

  '2-everything': (() => {
    const mods = [
      ['Tasks', 'Plan your day and get things done', '#4fd8f2'], ['Goals', 'Track progress toward what matters', '#f2c35b'], ['Habits', 'Build routines and see your streaks', '#9be564'],
      ['Calendar', 'Events and a look back at any day', '#8d9bff'], ['Study & Read', 'Subjects, your reading list and flashcards', '#ff9f6b'], ['Work', 'Projects, clients, meetings and deadlines', '#6fb1ff'],
      ['Finance', 'Budgets, spending and 68 currencies', '#38d9b0'], ['Fitness & Wellness', 'Workouts, sleep, water and mood', '#ff8a9b'], ['Notes', 'Notes and a private journal with moods', '#c7a6ff'],
    ];
    const card = ([n, d, c]) => `<div style="position:relative;padding:38px 40px;border-radius:36px;background:linear-gradient(160deg,rgba(255,255,255,.07),rgba(255,255,255,.025));border:2px solid rgba(190,180,255,.22);backdrop-filter:blur(10px);box-shadow:0 30px 80px rgba(0,0,0,.4)">
      <div style="width:96px;height:96px;border-radius:28px;display:grid;place-items:center;color:${c};background:linear-gradient(145deg,${c}44,${c}11);box-shadow:inset 0 2px 0 rgba(255,255,255,.2),0 14px 40px ${c}44"><span style="display:block;width:54px;height:54px">${(ICONS[n] || '').replace(/width="\d+"/, 'width="54"').replace(/height="\d+"/, 'height="54"')}</span></div>
      <div style="font-family:'Space Grotesk';font-weight:700;font-size:48px;margin-top:26px;letter-spacing:-.02em">${n}</div><div style="color:#a9b0d2;font-size:30px;margin-top:10px;line-height:1.3;font-weight:500">${d}</div></div>`;
    return `<div class="bg"></div><div class="wrap">${brand}
      <h1 style="font-size:118px;margin-top:56px"><span class="grad">Everything in one place</span></h1>
      <p class="sub" style="font-size:42px;margin-top:22px">Nine life areas that work together. Switch on only what you need.</p>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:34px;margin-top:62px">${mods.map(card).join('')}</div>
      <div class="chips" style="margin-top:56px;justify-content:center"><span class="chip">Focus Mode</span><span class="chip">Weekly Reset</span><span class="chip">Insights</span><span class="chip">Command Center</span><span class="chip">Quick search</span></div>
    </div>`;
  })(),

  '3-themes': `
    <div class="bg"></div><div class="wrap">${brand}
      <h1 style="font-size:130px;margin-top:56px"><span class="grad">Three themes.<br>Pick your mood.</span></h1></div>
    <div class="win" style="left:50px;top:640px;width:840px;transform:rotate(-3deg)"><img src="${I['desktop-home-light']}"></div>
    <div class="win" style="left:580px;top:790px;width:840px;transform:rotate(1deg);z-index:2"><img src="${I['desktop-home-soft']}"></div>
    <div class="win" style="left:1110px;top:640px;width:840px;transform:rotate(3deg);z-index:3"><img src="${I['desktop-home-dark']}"></div>
    <div style="position:absolute;left:0;right:0;bottom:120px;display:flex;justify-content:center;gap:90px;font-family:'Space Grotesk';font-weight:700;font-size:64px;letter-spacing:-.02em"><span>Light</span><span style="color:#ffb0c8">Soft</span><span style="color:#9a8cff">Dark</span></div>`,

  '4-study': `
    <div class="bg"></div><div class="wrap">${brand}
      <h1 style="font-size:126px;margin-top:56px"><span class="grad">Study &amp; Read</span></h1>
      <p class="sub" style="font-size:42px;margin-top:20px">For students, lifelong learners and book lovers.</p>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:44px;margin-top:56px">
        <div style="display:flex;gap:20px;font-size:34px;font-weight:600;line-height:1.25"><span class="dot" style="flex:none">1</span><span>Reading library with page tracking, highlights &amp; streaks</span></div>
        <div style="display:flex;gap:20px;font-size:34px;font-weight:600;line-height:1.25"><span class="dot" style="flex:none">2</span><span>Flashcards that return just before you forget</span></div>
        <div style="display:flex;gap:20px;font-size:34px;font-weight:600;line-height:1.25"><span class="dot" style="flex:none">3</span><span>Subjects, assignments &amp; exams in one place</span></div>
      </div></div>
    <div class="win" style="left:110px;top:760px;width:1230px"><img src="${I['desktop-library-dark']}"></div>
    <div class="win" style="left:760px;top:1290px;width:830px;z-index:3"><img src="${I['desktop-review-dark']}"></div>
    <div class="phone" style="right:120px;top:730px;width:470px;z-index:2"><img src="${I['phone-library-dark']}"></div>`,

  '5-focus-progress': `
    <div class="bg"></div><div class="wrap">${brand}
      <h1 style="font-size:122px;margin-top:56px"><span class="grad">See your progress.<br>Protect your focus.</span></h1>
      <div class="chips" style="margin-top:40px"><span class="chip">Graphs from your real data</span><span class="chip">Focus timer</span><span class="chip">Weekly Reset</span></div></div>
    <div class="phone" style="left:110px;top:760px;width:560px"><img src="${I['phone-pulse-dark']}"></div>
    <div class="win" style="left:690px;top:770px;width:1200px"><img src="${I['desktop-focus-dark']}"></div>
    <div class="win" style="left:790px;top:1330px;width:1100px;z-index:2"><img src="${I['desktop-insights-dark']}"></div>`,

  '6-private-whats-included': `
    <div class="bg"></div><div class="wrap">${brand}
      <h1 style="font-size:122px;margin-top:56px"><span class="grad">Private by design.</span></h1>
      <p class="sub" style="font-size:42px;margin-top:18px">Your data stays on your device. Always.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:70px;margin-top:70px">
        <div>
          <div class="li"><span class="dot">&#10003;</span><span>No account, no sign-in</span></div>
          <div class="li"><span class="dot">&#10003;</span><span>Works offline</span></div>
          <div class="li"><span class="dot">&#10003;</span><span>Nothing is uploaded, ever</span></div>
          <div class="li"><span class="dot">&#10003;</span><span>No subscription</span></div>
          <div class="li"><span class="dot">&#10003;</span><span>Back up and restore with one tap</span></div>
        </div>
        <div style="padding:46px 50px;border-radius:40px;background:rgba(255,255,255,.06);border:2px solid rgba(190,180,255,.28);box-shadow:0 30px 90px rgba(0,0,0,.45)">
          <div style="font-family:'Space Grotesk';font-weight:700;font-size:54px;margin-bottom:30px">What you get</div>
          ${['Windows app + browser version', 'Mac version', 'Android app (APK)', 'iPhone &amp; iPad install guide', 'START HERE guide (PDF)', 'Backup &amp; Updates guide (PDF)'].map((t) => `<div style="display:flex;align-items:center;gap:20px;font-size:38px;font-weight:600;margin-bottom:24px"><span style="width:20px;height:20px;border-radius:50%;background:linear-gradient(135deg,#7a6bff,#4aa8ff);flex:none"></span>${t}</div>`).join('')}
        </div>
      </div>
      <div class="chips" style="margin-top:56px"><span class="chip">Instant digital download</span><span class="chip">Re-download any time</span></div>
    </div>
    <div class="win" style="left:110px;top:1260px;width:1150px"><img src="${I['desktop-home-light']}"></div>
    <div class="win" style="left:760px;top:1400px;width:1120px;z-index:2"><img src="${I['desktop-home-soft']}"></div>
    <div class="phone" style="right:130px;top:1240px;width:430px;z-index:3"><img src="${I['phone-home-soft']}"></div>`,
};

for (const [name, body] of Object.entries(PAGES)) {
  const page = await browser.newPage({ viewport: { width: 2000, height: 2000 } });
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>${CSS}</style></head><body>${body}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, `listing-image-${name}.png`) });
  await page.close();
  console.log('wrote listing-image-' + name + '.png');
}
await browser.close();
