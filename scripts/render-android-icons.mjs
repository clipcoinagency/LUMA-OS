// Regenerates the Android launcher icons and splash screens from the Life OS mark.
//   node scripts/render-android-icons.mjs
// Writes into packaging/android/android/app/src/main/res (same file names/sizes the Capacitor project uses):
//   mipmap-*/ic_launcher.png, ic_launcher_round.png, ic_launcher_foreground.png, ic_launcher_background.png
//   drawable*/splash.png (every existing splash keeps its own dimensions)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RES = path.join(ROOT, 'packaging', 'android', 'android', 'app', 'src', 'main', 'res');
const nodes = [[406, 256], [331, 386], [181, 386], [106, 256], [181, 126], [331, 126]];

const DEFS = `<defs>
  <radialGradient id="bg" cx="50%" cy="42%" r="75%"><stop offset="0" stop-color="#14204a"/><stop offset="1" stop-color="#04060f"/></radialGradient>
  <radialGradient id="s" cx="36%" cy="30%" r="78%"><stop offset="0" stop-color="#f1fbff"/><stop offset=".22" stop-color="#8fdcff"/><stop offset=".58" stop-color="#4a6dff"/><stop offset="1" stop-color="#2a1b9c"/></radialGradient>
  <linearGradient id="l" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6fd6ff"/><stop offset="1" stop-color="#9a7bff"/></linearGradient>
  <filter id="g" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="14"/></filter></defs>`;
const ART = `
  <g stroke="url(#l)" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <polygon points="${nodes.map((n) => n.join(',')).join(' ')}" stroke-width="7" stroke-opacity=".75"/>
    <circle cx="256" cy="256" r="92" stroke-width="6" stroke-opacity=".6"/>
    ${nodes.map((n) => `<line x1="256" y1="256" x2="${n[0]}" y2="${n[1]}" stroke-width="4" stroke-opacity=".45"/>`).join('')}
  </g>
  <g filter="url(#g)" opacity=".85" fill="#5b7bff"><circle cx="256" cy="256" r="60"/>${nodes.map((n) => `<circle cx="${n[0]}" cy="${n[1]}" r="30"/>`).join('')}</g>
  ${nodes.map((n) => `<circle cx="${n[0]}" cy="${n[1]}" r="29" fill="url(#s)"/><circle cx="${n[0] - 8}" cy="${n[1] - 9}" r="7" fill="#fff" opacity=".7"/>`).join('')}
  <circle cx="256" cy="256" r="58" fill="url(#s)"/><circle cx="238" cy="236" r="15" fill="#fff" opacity=".65"/>`;

const svg = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">${DEFS}${inner}</svg>`;
const scaled = (k) => `<g transform="translate(256 256) scale(${k}) translate(-256 -256)">${ART}</g>`;

const VARIANTS = {
  legacy: svg(`<rect width="512" height="512" rx="116" fill="url(#bg)"/>${scaled(0.86)}`),
  round: svg(`<circle cx="256" cy="256" r="256" fill="url(#bg)"/>${scaled(0.78)}`),
  foreground: svg(scaled(0.74)),                                  // transparent; the adaptive-icon inset adds the safe zone
  background: svg(`<rect width="512" height="512" fill="url(#bg)"/>`),
};
const DENSITY = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

function pngSize(file) { const b = fs.readFileSync(file); return [b.readUInt32BE(16), b.readUInt32BE(20)]; }
function* walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) yield* walk(p); else yield p; } }

const browser = await chromium.launch({ channel: 'msedge' });
async function render(html, w, h, file) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.setContent(`<style>html,body{margin:0;background:transparent;width:${w}px;height:${h}px;overflow:hidden}</style>${html}`);
  await page.screenshot({ path: file, omitBackground: true });
  await page.close();
}
const fit = (s, px) => s.replace('width="512" height="512"', `width="${px}" height="${px}"`);

let n = 0;
for (const [d, k] of Object.entries(DENSITY)) {
  const dir = path.join(RES, `mipmap-${d}`);
  if (!fs.existsSync(dir)) continue;
  await render(fit(VARIANTS.legacy, 48 * k), 48 * k, 48 * k, path.join(dir, 'ic_launcher.png')); n++;
  await render(fit(VARIANTS.round, 48 * k), 48 * k, 48 * k, path.join(dir, 'ic_launcher_round.png')); n++;
  await render(fit(VARIANTS.foreground, 108 * k), 108 * k, 108 * k, path.join(dir, 'ic_launcher_foreground.png')); n++;
  await render(fit(VARIANTS.background, 108 * k), 108 * k, 108 * k, path.join(dir, 'ic_launcher_background.png')); n++;
}

// splash screens: dark aurora background with the mark in the middle (each file keeps its current size)
for (const file of walk(RES)) {
  if (path.basename(file) !== 'splash.png') continue;
  const [w, h] = pngSize(file);
  const m = Math.round(Math.min(w, h) * 0.34);
  const html = `<div style="position:relative;width:${w}px;height:${h}px;background:
    radial-gradient(60% 40% at 78% 6%,rgba(120,96,255,.42),transparent 70%),radial-gradient(55% 40% at 8% 94%,rgba(70,130,255,.32),transparent 70%),#04050d">
    <div style="position:absolute;left:${(w - m) / 2}px;top:${(h - m) / 2}px;width:${m}px;height:${m}px;filter:drop-shadow(0 0 ${m * 0.18}px rgba(110,100,255,.55))">${fit(VARIANTS.legacy, m)}</div></div>`;
  await render(html, w, h, file); n++;
}
await browser.close();
console.log('wrote', n, 'images into', path.relative(ROOT, RES));
