// Generates placeholder app icons (PNG) with zero dependencies.
// Final brand icons come in Phase 7; these just let every platform build/install cleanly.
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const mix = (a, b, t) => a + (b - a) * t;
const clamp = (v) => Math.max(0, Math.min(1, v));
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

// Navy tile with a soft-pink → cyan ring: nods to both themes (Soft + Dark).
function drawIcon(size, { rounded, inset = 0 }) {
  const buf = Buffer.alloc(size * size * 4);
  const bgA = hex('#0b1226'), bgB = hex('#1b2f57');
  const ringA = hex('#f2b8c6'), ringB = hex('#5ee0f7');
  const c = size / 2, R = size * (0.27 - inset * 0.27), T = size * 0.075;
  const rad = rounded ? size * 0.225 : 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5, py = y + 0.5;
      // rounded-rect coverage (signed distance, 1px antialias)
      const qx = Math.abs(px - c) - (c - rad), qy = Math.abs(py - c) - (c - rad);
      const dRect = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rad;
      const aBg = rounded ? clamp(0.5 - dRect) : 1;
      const tBg = (px + py) / (2 * size);
      let col = [0, 1, 2].map((i) => mix(bgA[i], bgB[i], tBg));
      // ring
      const dist = Math.hypot(px - c, py - c);
      const aRing = clamp(0.5 - (Math.abs(dist - R) - T / 2));
      const ang = (Math.atan2(py - c, px - c) + Math.PI) / (2 * Math.PI);
      const ringCol = [0, 1, 2].map((i) => mix(ringA[i], ringB[i], 0.5 + 0.5 * Math.sin(ang * 2 * Math.PI)));
      col = col.map((v, i) => mix(v, ringCol[i], aRing));
      // orbit dot
      const dx = c + R * Math.cos(-Math.PI / 4), dy = c + R * Math.sin(-Math.PI / 4);
      const aDot = clamp(0.5 - (Math.hypot(px - dx, py - dy) - T * 0.95));
      col = col.map((v) => mix(v, 255, aDot));
      const o = (y * size + x) * 4;
      buf[o] = Math.round(col[0]); buf[o + 1] = Math.round(col[1]); buf[o + 2] = Math.round(col[2]);
      buf[o + 3] = Math.round(255 * aBg);
    }
  }
  return encodePNG(size, size, buf);
}

const out = [
  ['poc/web/icons/icon-192.png', 192, { rounded: true }],
  ['poc/web/icons/icon-512.png', 512, { rounded: true }],
  ['poc/web/icons/icon-512-maskable.png', 512, { rounded: false, inset: 0.2 }],
  ['poc/web/icons/apple-touch-icon.png', 180, { rounded: false }], // iOS applies its own mask; must be opaque
  ['poc/assets/icon-1024.png', 1024, { rounded: true }],          // source for `tauri icon` / Android
];
for (const [rel, size, opts] of out) {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, drawIcon(size, opts));
  console.log('wrote', rel);
}
