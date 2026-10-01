// Renders the Life OS mark (same artwork as src/lib/ui/Logo.svelte) to the PWA icon PNGs and a
// standalone SVG. Run:  node scripts/render-icons.mjs
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'packaging', 'pwa');
const nodes = [[406, 256], [331, 386], [181, 386], [106, 256], [181, 126], [331, 126]];

/** mode: 'rounded' (store icon) | 'full' (maskable: full-bleed background, art kept inside the safe zone) */
function svg(mode) {
  const art = `
  <g stroke="url(#l)" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <polygon points="${nodes.map((n) => n.join(',')).join(' ')}" stroke-width="7" stroke-opacity=".75"/>
    <circle cx="256" cy="256" r="92" stroke-width="6" stroke-opacity=".6"/>
    ${nodes.map((n) => `<line x1="256" y1="256" x2="${n[0]}" y2="${n[1]}" stroke-width="4" stroke-opacity=".45"/>`).join('')}
  </g>
  <g filter="url(#g)" opacity=".85" fill="#5b7bff"><circle cx="256" cy="256" r="60"/>${nodes.map((n) => `<circle cx="${n[0]}" cy="${n[1]}" r="30"/>`).join('')}</g>
  ${nodes.map((n) => `<circle cx="${n[0]}" cy="${n[1]}" r="29" fill="url(#s)"/><circle cx="${n[0] - 8}" cy="${n[1] - 9}" r="7" fill="#fff" opacity=".7"/>`).join('')}
  <circle cx="256" cy="256" r="58" fill="url(#s)"/><circle cx="238" cy="236" r="15" fill="#fff" opacity=".65"/>`;
  const bg = mode === 'rounded'
    ? `<rect width="512" height="512" rx="116" fill="url(#bg)"/><rect x="1.5" y="1.5" width="509" height="509" rx="114.5" fill="none" stroke="#8fa6ff" stroke-opacity=".22" stroke-width="3"/>`
    : `<rect width="512" height="512" fill="url(#bg)"/>`;
  const wrap = mode === 'rounded' ? art : `<g transform="translate(256 256) scale(.74) translate(-256 -256)">${art}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"><defs>
    <radialGradient id="bg" cx="50%" cy="42%" r="75%"><stop offset="0" stop-color="#14204a"/><stop offset="1" stop-color="#04060f"/></radialGradient>
    <radialGradient id="s" cx="36%" cy="30%" r="78%"><stop offset="0" stop-color="#f1fbff"/><stop offset=".22" stop-color="#8fdcff"/><stop offset=".58" stop-color="#4a6dff"/><stop offset="1" stop-color="#2a1b9c"/></radialGradient>
    <linearGradient id="l" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6fd6ff"/><stop offset="1" stop-color="#9a7bff"/></linearGradient>
    <filter id="g" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="14"/></filter></defs>${bg}${wrap}</svg>`;
}

const browser = await chromium.launch({ channel: 'msedge' });
const jobs = [['icon-512.png', 512, 'rounded'], ['icon-192.png', 192, 'rounded'], ['icon-maskable-512.png', 512, 'full'], ['apple-touch-icon.png', 180, 'full']];
for (const [file, size, mode] of jobs) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg(mode)}`);
  await page.screenshot({ path: path.join(OUT, file), omitBackground: true });
  await page.close();
  console.log('wrote', file);
}
await fs.writeFile(path.join(OUT, 'favicon.svg'), svg('rounded'));
await browser.close();
