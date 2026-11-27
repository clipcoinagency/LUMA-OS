// Builds the two V2 guides (US Letter PDFs): START HERE (5 pages) and Backup & Updates (2 pages).
//   node scripts/promo/etsy-v2-pdfs.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const V2 = path.join(ROOT, 'etsy-delivery-v2');
const RAW = path.join(V2, 'images', 'raw');
const logo = fs.readFileSync(path.join(ROOT, 'packaging', 'pwa', 'favicon.svg'), 'utf8');

const browser = await chromium.launch({ channel: 'msedge' });
const tool = await browser.newPage();
async function img(name, maxW) {
  const b64 = fs.readFileSync(path.join(RAW, name + '.png')).toString('base64');
  return tool.evaluate(async ({ b64, maxW }) => {
    const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
    const k = Math.min(1, maxW / im.width); const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.86);
  }, { b64, maxW });
}
const I = {};
for (const [k, w] of [['desktop-home-dark', 1500], ['desktop-home-light', 900], ['desktop-home-soft', 900], ['desktop-library-dark', 1100], ['desktop-review-dark', 800], ['desktop-finance-dark', 1000], ['desktop-currency-dark', 800], ['desktop-datepicker-dark', 600], ['phone-pulse-dark', 460], ['phone-home-dark', 460], ['phone-library-dark', 460]]) I[k] = await img(k, w);
const logoSm = (px) => logo.replace('width="512" height="512"', `width="${px}" height="${px}"`);

const CSS = `
  @page{size:Letter;margin:0}
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{background:#fff;font-family:'Inter',system-ui,sans-serif;color:#1a1f3a;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .page{width:816px;height:1056px;position:relative;overflow:hidden;page-break-after:always;background:#f6f7fd;padding:56px 56px 48px}
  .page:last-child{page-break-after:auto}
  .cover{background:radial-gradient(60% 40% at 88% 0%,rgba(120,96,255,.55),transparent 70%),radial-gradient(55% 40% at 0% 100%,rgba(70,130,255,.42),transparent 70%),#04050d;color:#eef0ff;padding:60px}
  h1,h2,h3{font-family:'Space Grotesk',sans-serif;letter-spacing:-.025em;line-height:1.08}
  .brand{display:flex;align-items:center;gap:12px;font-family:'Space Grotesk';font-weight:700;font-size:22px}
  .topbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:26px;padding-bottom:16px;border-bottom:2px solid #e3e6f6}
  .topbar .t{font-family:'Space Grotesk';font-weight:700;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#6a5cf0}
  .step{display:flex;align-items:center;gap:14px;margin:6px 0 16px}
  .num{width:42px;height:42px;border-radius:14px;display:grid;place-items:center;font-family:'Space Grotesk';font-weight:700;font-size:21px;color:#fff;background:linear-gradient(135deg,#7a6bff,#4aa8ff);box-shadow:0 8px 20px rgba(110,100,255,.35)}
  h2{font-size:30px}
  h3{font-size:18px;margin-bottom:6px}
  p,li{font-size:13.5px;line-height:1.55;color:#3a4064}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .card{background:#fff;border-radius:18px;border:1.5px solid #e3e6f6;box-shadow:0 8px 24px rgba(40,50,120,.06);overflow:hidden}
  .card .hd{padding:11px 18px;color:#fff;font-family:'Space Grotesk';font-weight:700;font-size:16px;display:flex;align-items:center;gap:10px}
  .card .bd{padding:16px 18px 18px}
  .card ol{padding-left:20px}.card li{margin-bottom:5px}
  .note{border-radius:16px;padding:14px 18px;background:linear-gradient(135deg,#ece9ff,#e3f1ff);border:1.5px solid #d6d2ff;font-size:13px;line-height:1.5;color:#2c2f66}
  .warn{background:#fff6e0;border-color:#f2dc9c;color:#6b4a00}
  .shot{border-radius:14px;overflow:hidden;border:1.5px solid #dcdff3;box-shadow:0 12px 30px rgba(40,50,120,.16)}
  .shot img{display:block;width:100%}
  .shot.crop img{height:165px;object-fit:cover;object-position:top left}
  .pill{display:inline-block;padding:4px 12px;border-radius:999px;background:#ebe9ff;color:#4b3fd0;font-weight:700;font-size:11.5px;margin:0 6px 6px 0}
  .feat{display:flex;gap:12px;align-items:flex-start;margin-bottom:14px}
  .feat .ic{flex:none;width:38px;height:38px;border-radius:12px;display:grid;place-items:center;color:#fff;font-weight:800;font-size:17px}
  .feat > div > b:first-child{font-family:'Space Grotesk';font-size:15px;display:block;margin-bottom:2px;color:#1a1f3a}
  .qa > b:first-child{display:block;color:#1a1f3a;font-size:13.5px;margin-bottom:3px}.qa{margin-bottom:13px}
  .foot{position:absolute;left:56px;right:56px;bottom:26px;display:flex;justify-content:space-between;font-size:11px;color:#8a90b4}
  code{background:#ebe9ff;padding:1px 6px;border-radius:6px;font-size:12.5px;color:#3d33b8}
`;
const FONTS = `<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">`;
const top = (t) => `<div class="topbar"><div class="brand" style="color:#1a1f3a">${logoSm(34)}Life OS 2.0</div><div class="t">${t}</div></div>`;
const foot = (n, of) => `<div class="foot"><span>Life OS 2.0 · Your entire life. One system.</span><span>${n} / ${of}</span></div>`;

// ================================================================ START HERE
const START = `
<div class="page cover">
  <div class="brand" style="color:#eef0ff;font-size:26px">${logoSm(46)}Life OS 2.0</div>
  <h1 style="font-size:84px;margin-top:70px;background:linear-gradient(100deg,#fff 6%,#b9b0ff 55%,#7fd6ff);-webkit-background-clip:text;background-clip:text;color:transparent">Welcome to<br>Life OS 2.0</h1>
  <p style="font-size:22px;color:#b9b6ee;margin-top:20px;max-width:560px;line-height:1.4">Your entire life. One system. Thank you for downloading &mdash; this guide gets you set up in about two minutes.</p>
  <div style="margin-top:26px"><span class="pill" style="background:rgba(154,140,255,.2);color:#d9d4ff">Tasks</span><span class="pill" style="background:rgba(154,140,255,.2);color:#d9d4ff">Goals</span><span class="pill" style="background:rgba(154,140,255,.2);color:#d9d4ff">Habits</span><span class="pill" style="background:rgba(154,140,255,.2);color:#d9d4ff">Focus</span><span class="pill" style="background:rgba(154,140,255,.2);color:#d9d4ff">Study &amp; Read</span><span class="pill" style="background:rgba(154,140,255,.2);color:#d9d4ff">Money</span><span class="pill" style="background:rgba(154,140,255,.2);color:#d9d4ff">Wellness</span></div>
  <div style="position:absolute;left:60px;top:470px;width:600px;border-radius:20px;overflow:hidden;border:1.5px solid rgba(190,180,255,.4);box-shadow:0 40px 90px rgba(0,0,0,.6),0 0 90px rgba(120,100,255,.35)"><img src="${I['desktop-home-dark']}" style="display:block;width:100%"></div>
  <div style="position:absolute;right:56px;top:505px;width:190px;border-radius:34px;overflow:hidden;border:2px solid rgba(190,180,255,.45);padding:6px;background:#0a0d1c;box-shadow:0 40px 90px rgba(0,0,0,.65),0 0 80px rgba(120,100,255,.4)"><img src="${I['phone-pulse-dark']}" style="display:block;width:100%;border-radius:28px"></div>
  <div style="position:absolute;left:60px;right:60px;bottom:54px;display:flex;gap:14px">
    <div style="flex:1;border-radius:16px;padding:14px 16px;background:rgba(255,255,255,.07);border:1.5px solid rgba(190,180,255,.25)"><div style="font-family:'Space Grotesk';font-weight:700;font-size:15px">Private</div><div style="font-size:12px;color:#b9b6ee;margin-top:2px">Your data stays on your device</div></div>
    <div style="flex:1;border-radius:16px;padding:14px 16px;background:rgba(255,255,255,.07);border:1.5px solid rgba(190,180,255,.25)"><div style="font-family:'Space Grotesk';font-weight:700;font-size:15px">No account</div><div style="font-size:12px;color:#b9b6ee;margin-top:2px">No sign-in, no subscription</div></div>
    <div style="flex:1;border-radius:16px;padding:14px 16px;background:rgba(255,255,255,.07);border:1.5px solid rgba(190,180,255,.25)"><div style="font-family:'Space Grotesk';font-weight:700;font-size:15px">Works offline</div><div style="font-size:12px;color:#b9b6ee;margin-top:2px">Even in Airplane Mode</div></div>
  </div>
</div>

<div class="page">${top('Step 1 · Install')}
  <div class="step"><div class="num">1</div><h2>Install in two minutes</h2></div>
  <p style="margin-bottom:16px">Pick your device below. There&rsquo;s no installer wizard and no account &mdash; the first time you open Life OS it walks you through a one-minute setup.</p>
  <div class="grid2">
    <div class="card"><div class="hd" style="background:linear-gradient(135deg,#2b6fd6,#4aa8ff)">Windows PC</div><div class="bd"><ol>
      <li>Open the <b>Windows</b> folder.</li><li>Double-click <b>Install Desktop App.vbs</b>. It adds a <i>Life OS</i> shortcut to your Desktop and Start menu (recommended).</li><li>Prefer a browser tab? Double-click <b>Life OS.html</b> instead.</li></ol></div></div>
    <div class="card"><div class="hd" style="background:linear-gradient(135deg,#5b5f8a,#8d92c8)">Mac</div><div class="bd"><ol>
      <li>Open the <b>Mac</b> folder.</li><li>Double-click <b>Life OS.html</b>. It opens in your default browser (Safari or Chrome both work).</li><li>If macOS shows a warning, it&rsquo;s normal for any downloaded file.</li></ol></div></div>
    <div class="card"><div class="hd" style="background:linear-gradient(135deg,#1fa36f,#4ad0a0)">Android phone or tablet</div><div class="bd"><ol>
      <li>Open the <b>Android</b> folder and copy <b>Life OS.apk</b> to your phone.</li><li>Tap it. Allow &ldquo;install unknown apps&rdquo; once when asked.</li><li>Tap <b>Install</b>. Full steps are in <b>Install Guide.txt</b>.</li></ol></div></div>
    <div class="card"><div class="hd" style="background:linear-gradient(135deg,#d6489a,#ff8ab4)">iPhone &amp; iPad</div><div class="bd"><ol>
      <li>Apple doesn&rsquo;t allow installable files, so open <b>Safari</b> and go to <code>luma-os-beta.vercel.app</code>.</li><li>Tap <b>Share</b> &rarr; <b>Add to Home Screen</b>.</li><li>It now opens like a normal app and works offline.</li></ol></div></div>
  </div>
  <div class="note" style="margin-top:18px"><b>Upgrading from Life OS 1.x?</b> Make a backup first (<i>Settings &rarr; Back up now</i>), then follow the &ldquo;Updating&rdquo; section of the <b>Backup &amp; Updates</b> guide. Your data carries over automatically.</div>
  <p style="margin-top:16px"><b>One purchase, every device.</b> Each device keeps its own private copy &mdash; use a backup file to move your data between them (see the Backup guide).</p>
  ${foot(2, 5)}
</div>

<div class="page">${top('Step 2 · First five minutes')}
  <div class="step"><div class="num">2</div><h2>Your first five minutes</h2></div>
  <div class="feat"><div class="ic" style="background:linear-gradient(135deg,#7a6bff,#4aa8ff)">1</div><div><b>Pick a starting point</b><p>Student, Founder, Professional, Reader &amp; learner, Health first, Organise my life or Keep it simple. It simply switches on the right areas &mdash; you can change them any time in Settings.</p></div></div>
  <div class="feat"><div class="ic" style="background:linear-gradient(135deg,#7a6bff,#4aa8ff)">2</div><div><b>Choose your look</b><p>Three themes, each designed on its own: <b>Light</b> (crisp white), <b>Soft</b> (calm cream and rose) and <b>Dark</b> (deep midnight).</p></div></div>
  <div class="grid2" style="margin:4px 0 16px"><div class="shot"><img src="${I['desktop-home-light']}"></div><div class="shot"><img src="${I['desktop-home-soft']}"></div></div>
  <div class="feat"><div class="ic" style="background:linear-gradient(135deg,#7a6bff,#4aa8ff)">3</div><div><b>Meet your Home</b><p>Home greets you with a short briefing about what matters today, a ring showing progress in each area, and graph tiles for Focus, Wellbeing and weekly Progress. Use <i>Customize</i> to choose which widgets you see.</p></div></div>
  <div class="feat"><div class="ic" style="background:linear-gradient(135deg,#7a6bff,#4aa8ff)">4</div><div><b>Add your first things</b><p>Tap <b>New</b> (top right) or press <code>Ctrl + K</code> / <code>Cmd + K</code> to search or add anything from the keyboard. Date and time fields open a friendly calendar and time wheel.</p></div></div>
  <div class="feat"><div class="ic" style="background:linear-gradient(135deg,#7a6bff,#4aa8ff)">5</div><div><b>Start a focus session</b><p>Tap <b>Start focus</b>, pick a task, and the time is logged for you when you finish. Close the room and it keeps running in a small pill.</p></div></div>
  <div class="note"><b>Tip:</b> on Sunday evening, open <b>Weekly Reset</b>. It&rsquo;s a guided ten-minute review that clears loose ends and plans your next week &mdash; nothing changes until the final step.</div>
  ${foot(3, 5)}
</div>

<div class="page">${top("What's inside")}
  <div class="step"><div class="num">3</div><h2>A quick tour</h2></div>
  <div class="grid2" style="margin-bottom:14px">
    <div class="feat"><div class="ic" style="background:#4fd8f2">&#9998;</div><div><b>Tasks, Goals &amp; Habits</b><p>Plan your day, track goals with milestones, build streaks. Link tasks to projects and subjects.</p></div></div>
    <div class="feat"><div class="ic" style="background:#8d9bff">&#9719;</div><div><b>Calendar</b><p>Events, meetings and exams &mdash; plus a look back at any past day across every area.</p></div></div>
    <div class="feat"><div class="ic" style="background:#ff9f6b">&#128214;</div><div><b>Study &amp; Read</b><p>Subjects and assignments, a reading library with highlights and streaks, and spaced-repetition flashcards.</p></div></div>
    <div class="feat"><div class="ic" style="background:#38d9b0">$</div><div><b>Finance</b><p>Income, spending, categories, budgets and savings, in 68 currencies (&#8377; &euro; &pound; &yen; and more).</p></div></div>
    <div class="feat"><div class="ic" style="background:#6fb1ff">&#9632;</div><div><b>Work</b><p>Projects with tasks, meetings, deadlines and focus time, all in one place.</p></div></div>
    <div class="feat"><div class="ic" style="background:#ff8a9b">&hearts;</div><div><b>Wellness &amp; Notes</b><p>Workouts, sleep, water and mood &mdash; plus notes and a private journal. Not medical advice.</p></div></div>
  </div>
  <div class="grid2" style="margin-bottom:14px"><div class="shot"><img src="${I['desktop-library-dark']}"></div><div class="shot"><img src="${I['desktop-review-dark']}"></div></div>
  <div class="grid2" style="align-items:center">
    <div class="shot crop"><img src="${I['desktop-finance-dark']}"></div>
    <div><h3>Insights, only from your real data</h3><p>Life OS never invents numbers. Until it has enough of your history, Insights says &ldquo;still learning your patterns&rdquo; &mdash; and there is no made-up &ldquo;life score&rdquo;. Everything you see comes from what you logged.</p></div>
  </div>
  ${foot(4, 5)}
</div>

<div class="page">${top('Good to know')}
  <div class="step"><div class="num">4</div><h2>Good to know</h2></div>
  <div class="grid2">
    <div class="card"><div class="hd" style="background:linear-gradient(135deg,#7a6bff,#4aa8ff)">Your data</div><div class="bd"><ul style="padding-left:18px">
      <li><b>Nothing is uploaded, ever.</b> Everything stays in your browser&rsquo;s or app&rsquo;s private storage on that one device.</li>
      <li><b>One device, one copy.</b> Phone and laptop don&rsquo;t sync. To move data, back up on one and restore on the other.</li>
      <li><b>Use the same browser every time</b> (Windows/Mac). A different browser shows an empty workspace &mdash; your data isn&rsquo;t lost, it&rsquo;s just not there.</li></ul></div></div>
    <div class="card"><div class="hd" style="background:linear-gradient(135deg,#d6489a,#ff8ab4)">Reminders &amp; backups</div><div class="bd"><ul style="padding-left:18px">
      <li><b>Reminders ring while Life OS is open.</b> With no account or server behind the app, it can&rsquo;t wake itself in the background.</li>
      <li><b>Make your first backup today:</b> <i>Settings &rarr; Back up now</i>. Life OS also reminds you every couple of weeks.</li></ul></div></div>
  </div>
  <h2 style="font-size:24px;margin:22px 0 12px">Troubleshooting</h2>
  <div class="qa"><b>&ldquo;My browser blocked the download&rdquo; / &ldquo;Windows says this file isn&rsquo;t commonly downloaded.&rdquo;</b><p>Life OS is a single web page, not a program, so it can&rsquo;t contain a virus the way an .exe can. This warning is normal for less-common file types &mdash; choose Keep / More info &rarr; Run anyway. The same applies to <code>Install Desktop App.vbs</code>, which only creates two shortcuts.</p></div>
  <div class="qa"><b>&ldquo;I opened it and my data from yesterday is gone!&rdquo;</b><p>Almost always it opened in a different browser than last time. Open the browser you used first, or restore your latest backup.</p></div>
  <div class="qa"><b>&ldquo;The Android install button doesn&rsquo;t show up.&rdquo;</b><p>Your phone needs permission to install from outside the Play Store for this one file &mdash; see <b>Android/Install Guide.txt</b>.</p></div>
  <div class="qa"><b>&ldquo;I don&rsquo;t hear my reminder.&rdquo;</b><p>Keep Life OS open on screen at that time, and check your device isn&rsquo;t on silent or Do Not Disturb.</p></div>
  <div class="qa"><b>&ldquo;Something looks off after an update.&rdquo;</b><p>Restore the backup you made before updating (see the Backup &amp; Updates guide). You can also re-download your files from your Etsy order any time.</p></div>
  <div class="note" style="margin-top:6px;text-align:center"><b>Enjoy Life OS</b> &mdash; build the system that fits <i>your</i> life.</div>
  ${foot(5, 5)}
</div>`;

// ================================================================ BACKUP & UPDATES
const BACKUP = `
<div class="page">${top('Backup &amp; Updates')}
  <h1 style="font-size:40px;margin-bottom:8px">Backups, restores &amp; updates</h1>
  <p style="margin-bottom:18px">Life OS keeps everything on your device and never touches the internet, so backups are something <i>you</i> do. This guide covers everything you&rsquo;ll ever need.</p>
  <div class="step"><div class="num">1</div><h2 style="font-size:24px">Back up</h2></div>
  <ol style="padding-left:22px;margin-bottom:12px">
    <li>Open Life OS and go to <b>Settings</b>.</li>
    <li>Tap <b>Back up now</b>. A file like <code>LifeOS-Backup-2026-10-03.json</code> is saved: on Windows/Mac it lands in your <b>Downloads</b> folder; on Android and iPhone/iPad the share sheet opens &mdash; choose <b>Save to Files</b>, Google Drive or iCloud.</li>
    <li>Keep that file somewhere safe: a cloud drive, a USB stick, or emailed to yourself.</li>
  </ol>
  <div class="note" style="margin-bottom:18px"><b>How often?</b> Life OS gently reminds you every couple of weeks (you can change this in Settings). For anything you&rsquo;d hate to lose, back up right after you enter it.</div>
  <div class="step"><div class="num">2</div><h2 style="font-size:24px">Restore</h2></div>
  <p style="margin-bottom:8px">Use this on a <b>new device</b>, or after your browser data was cleared.</p>
  <ol style="padding-left:22px;margin-bottom:12px">
    <li>Fresh install? On the Welcome screen tap <b>I have a backup</b>. Already set up? Go to <b>Settings &rarr; Restore from backup</b>.</li>
    <li>Pick your backup file. Life OS shows exactly what&rsquo;s inside (tasks, books, transactions&hellip;) before changing anything.</li>
    <li>Confirm. Everything returns exactly as it was.</li>
  </ol>
  <div class="note warn"><b>Heads-up:</b> restoring <i>replaces</i> what&rsquo;s on that device with the backup. If you added things since your last backup, back up again first.</div>
  ${foot(1, 2)}
</div>

<div class="page">${top('Backup &amp; Updates')}
  <div class="step"><div class="num">3</div><h2 style="font-size:24px">Update without losing anything</h2></div>
  <p style="margin-bottom:10px">Etsy downloads don&rsquo;t update themselves, so here&rsquo;s how to move to a new version safely:</p>
  <ol style="padding-left:22px;margin-bottom:12px">
    <li><b>Back up first</b> (above) &mdash; always, even though updating is normally safe.</li>
    <li>Re-download your files from your Etsy order (your download link doesn&rsquo;t expire).</li>
    <li><b>Windows &amp; Mac:</b> replace the old <code>Life OS.html</code> with the new one in the same folder, and keep using the <b>same browser</b>. Your data lives in the browser, not in the file, so the new file simply sees it.</li>
    <li><b>Android:</b> install the new APK over the old one. Android treats it as an update and keeps your data.</li>
    <li><b>iPhone &amp; iPad:</b> nothing to do &mdash; the Home Screen app updates itself the next time you&rsquo;re online.</li>
  </ol>
  <div class="note" style="margin-bottom:18px"><b>Coming from Life OS 1.x?</b> Same steps. Life OS 2.0 upgrades your existing data automatically the first time you open it, and a 1.x backup file restores into 2.0 without any conversion. Your tasks, goals, habits, calendar, notes, wellness and finance data all come with you.</div>
  <div class="step"><div class="num">4</div><h2 style="font-size:24px">Move to a new device</h2></div>
  <ol style="padding-left:22px;margin-bottom:18px"><li>On the old device: <b>Settings &rarr; Back up now</b>, then send the file to yourself.</li><li>On the new device: install Life OS (Step 1 of the START HERE guide).</li><li>On the Welcome screen tap <b>I have a backup</b> and choose the file.</li></ol>
  <div class="step"><div class="num">5</div><h2 style="font-size:24px">Start fresh or clear one area</h2></div>
  <p style="margin-bottom:18px">In <b>Settings</b> you can reset a single area (for example just Finance) or delete everything and start over. Life OS keeps a private safety copy before any reset so a mis-tap can be recovered, and you always have to confirm. Make a backup first if you want to keep a copy yourself.</p>
  <div class="grid2">
    <div class="qa"><b>Does Life OS sync between my devices?</b><p>No &mdash; there&rsquo;s no account or server. That is what keeps your data private. Use backups to move data.</p></div>
    <div class="qa"><b>Can I use two browsers?</b><p>Each browser has its own separate copy. Pick one for daily use.</p></div>
    <div class="qa"><b>Where is my data stored?</b><p>In your browser&rsquo;s (or the Android app&rsquo;s) private storage on that device &mdash; never on a server.</p></div>
    <div class="qa"><b>I cleared my browser data.</b><p>Restore your latest backup; that&rsquo;s exactly what it&rsquo;s for.</p></div>
  </div>
  ${foot(2, 2)}
</div>`;

async function pdf(name, body) {
  const page = await browser.newPage();
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>${CSS}</style></head><body>${body}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  // layout check: every page's content must fit inside the 1056px Letter page; also save a PNG preview of each page
  const over = await page.evaluate(() => [...document.querySelectorAll('.page')].map((p, i) => { const pb = p.getBoundingClientRect().top; const bottoms = [...p.children].filter((c) => !c.classList.contains('foot')).map((c) => c.getBoundingClientRect().bottom - pb); return { page: i + 1, contentBottom: Math.round(Math.max(...bottoms)) }; }));
  console.log(name, 'content bottoms (page height 1056, footer starts ~1000):', over.map((o) => o.page + ':' + o.contentBottom).join('  '));
  const prev = path.join(V2, 'images', 'pdf-preview'); fs.mkdirSync(prev, { recursive: true });
  const pages = await page.locator('.page').all();
  for (let i = 0; i < pages.length; i++) await pages[i].screenshot({ path: path.join(prev, name.replace('.pdf', '') + '-p' + (i + 1) + '.png') });
  await page.pdf({ path: path.join(V2, name), width: '816px', height: '1056px', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  await page.close();
  console.log('wrote', name, (fs.statSync(path.join(V2, name)).size / 1024).toFixed(0) + ' KB');
}
await pdf('LifeOS-v2.0-START-HERE.pdf', START);
await pdf('LifeOS-v2.0-Backup-and-Updates.pdf', BACKUP);
// also save the HTML sources next to the guides (handy for edits)
fs.mkdirSync(path.join(V2, 'guides'), { recursive: true });
await browser.close();
