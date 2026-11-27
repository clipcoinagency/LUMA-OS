// Bounding box of the differing pixels between two same-size PNGs (rendered in a browser canvas).
import { chromium } from 'playwright';
import fs from 'node:fs';
const [a, b] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'msedge' });
const p = await browser.newPage();
const r = await p.evaluate(async ([x, y]) => {
  const load = (s) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = 'data:image/png;base64,' + s; });
  const [i1, i2] = await Promise.all([load(x), load(y)]);
  const c = document.createElement('canvas'); c.width = i1.width; c.height = i1.height; const g = c.getContext('2d');
  g.drawImage(i1, 0, 0); const d1 = g.getImageData(0, 0, c.width, c.height).data;
  g.clearRect(0, 0, c.width, c.height); g.drawImage(i2, 0, 0); const d2 = g.getImageData(0, 0, c.width, c.height).data;
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, n = 0;
  for (let i = 0; i < d1.length; i += 4) if (Math.abs(d1[i] - d2[i]) + Math.abs(d1[i + 1] - d2[i + 1]) + Math.abs(d1[i + 2] - d2[i + 2]) > 6) { const px = (i / 4) % c.width, py = Math.floor(i / 4 / c.width); n++; x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py); }
  return { n, box: [x0, y0, x1, y1], size: [c.width, c.height] };
}, [fs.readFileSync(a).toString('base64'), fs.readFileSync(b).toString('base64')]);
console.log(JSON.stringify(r));
await browser.close();
