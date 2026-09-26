// Step-by-step diagnostics for engines that hang or misbehave (Firefox, WebKit) — every step has
// its own timeout and is logged, so a hang pinpoints the exact step.
import { firefox, webkit } from 'playwright';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { startServer, WEB_ROOT } from './serve.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const log = [];
const t0 = Date.now();
const note = (engine, step, detail = '') => { const l = `${((Date.now() - t0) / 1000).toFixed(1)}s ${engine} ${step} ${detail}`; log.push(l); console.log(l); };
const within = (p, ms, what) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`TIMEOUT ${ms}ms: ${what}`)), ms))]);
const state = (page) => page.evaluate(() => ({ href: location.href, ready: document.readyState, poc: typeof window.lifeosPoc, ok: window.lifeosPocReady === true, err: window.lifeosPocError || null, idb: !!window.indexedDB, body: document.body ? document.body.innerText.slice(0, 80) : null }));

const server = await startServer(4817);
const urls = { file: pathToFileURL(path.join(WEB_ROOT, 'index.html')).href, http: 'http://127.0.0.1:4817/index.html' };

for (const [name, type] of [['firefox', firefox], ['webkit', webkit]]) {
  for (const persistent of [false, true]) {
    for (const [mode, url] of Object.entries(urls)) {
      const tag = `${name}/${persistent ? 'persistent' : 'ephemeral'}/${mode}`;
      let ctx, browser;
      try {
        if (persistent) {
          ctx = await within(type.launchPersistentContext(path.join(os.tmpdir(), `dbg-${name}-${mode}-${Date.now()}`), { headless: true }), 60000, 'launchPersistentContext');
        } else {
          browser = await within(type.launch({ headless: true }), 60000, 'launch');
          ctx = await within(browser.newContext(), 20000, 'newContext');
        }
        note(tag, 'launched');
        const page = ctx.pages()[0] || await within(ctx.newPage(), 20000, 'newPage');
        page.on('pageerror', (e) => note(tag, 'PAGEERROR', e.message));
        page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') note(tag, 'console.' + m.type(), m.text().slice(0, 200)); });
        await within(page.goto(url, { waitUntil: 'domcontentloaded' }), 30000, 'goto');
        note(tag, 'goto ok');
        for (let i = 0; i < 8; i++) {
          const s = await within(state(page), 10000, 'evaluate state');
          note(tag, 'state', JSON.stringify(s));
          if (s.ok || s.err) break;
          await new Promise((r) => setTimeout(r, 1500));
        }
        const w = await within(page.evaluate(() => window.lifeosPoc.writeProbe().then((p) => p.token)), 15000, 'writeProbe');
        const r = await within(page.evaluate(() => window.lifeosPoc.readProbe().then((p) => p && p.token)), 15000, 'readProbe');
        note(tag, w === r ? 'RESULT PASS write/read' : 'RESULT FAIL write/read', `${w} / ${r}`);
      } catch (e) {
        note(tag, 'RESULT ERROR', e.message.split('\n')[0]);
      } finally {
        await within((ctx ? ctx.close() : Promise.resolve()).then(() => browser && browser.close()), 20000, 'close').catch((e) => note(tag, 'close', e.message));
      }
    }
  }
}
server.close();
await fs.mkdir(path.join(HERE, 'results'), { recursive: true });
await fs.writeFile(path.join(HERE, 'results', 'engine-debug.log'), log.join('\n'));
process.exit(0);
