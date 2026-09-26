// Phase 0 validator: drives REAL installed browsers through the customer workflow.
//
// For every engine × launch mode it:
//   launch #1  open → write test value → write 1,000 dated records → CLOSE THE WHOLE BROWSER
//   launch #2  reopen same profile → value + records still there → refresh → export (real download)
//              → clear → restore via file picker (confirm dialog) → reject 6 invalid backups
//              → cancel path → stress N records (--stress, default 20,000) → CLOSE
//   launch #3  reopen → restored + stress data survived
//   extras     folder-move behaviour, offline reload (http), file:// script-loading rules, time zones
//
// Usage: node poc/tests/validate.mjs [--only=edge,firefox] [--headed]
import { chromium, firefox, webkit } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { startServer, WEB_ROOT } from './serve.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'results');
// Profiles live in the OS temp dir (like a real browser profile in AppData), not in the OneDrive-synced project.
const TMP = path.join(os.tmpdir(), 'lifeos-poc-validate');
const PORT = 4817;
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const only = args.only ? args.only.split(',') : null;
const headed = 'headed' in args;
const STRESS = Number(args.stress || 20000);          // CI uses a smaller number; full 20k measured locally
const TOTAL = 1000 + STRESS;
const fmt = (n) => n.toLocaleString('en-US');
const TARGET_TIMEOUT_MS = Number(args.timeout || 6 * 60 * 1000);

const TARGETS = [
  { id: 'edge', label: 'Microsoft Edge (installed, default .html handler)', type: chromium, launch: { channel: 'msedge' } },
  { id: 'chrome', label: 'Google Chrome (installed)', type: chromium, launch: { channel: 'chrome' } },
  { id: 'firefox', label: 'Firefox (Playwright build)', type: firefox, launch: {} },
  { id: 'webkit', label: 'WebKit (Playwright build — Safari engine proxy, NOT real Safari)', type: webkit, launch: {} },
];
const MODES = ['file', 'http'];

const fileUrl = (p) => pathToFileURL(p).href;
const now = () => new Date().toISOString();

function reporter(target, mode) {
  const checks = [];
  const add = (status, name, detail = '') => { checks.push({ status, name, detail: String(detail) }); console.log(`  [${status.toUpperCase().padEnd(4)}] ${name}${detail !== '' ? ' — ' + detail : ''}`); };
  return {
    checks,
    pass: (n, d) => add('pass', n, d), fail: (n, d) => add('fail', n, d), info: (n, d) => add('info', n, d),
    expect: (cond, n, d) => { add(cond ? 'pass' : 'fail', n, d); return cond; },
  };
}

async function openApp(ctx, url, { reuseFirstPage = true } = {}) {
  const page = reuseFirstPage && ctx.pages()[0] ? ctx.pages()[0] : await ctx.newPage();
  const t0 = Date.now();
  await page.goto(url);
  await page.waitForFunction(() => window.lifeosPocReady === true || !!window.lifeosPocError, null, { timeout: 30000 });
  const err = await page.evaluate(() => window.lifeosPocError || null);
  return { page, err, openMs: Date.now() - t0 };
}
const api = (page, fn, arg) => page.evaluate(({ fn, arg }) => window.lifeosPoc[fn](arg), { fn, arg });
const opSeq = (page) => page.evaluate(() => Number(document.body.dataset.opSeq || 0));
async function waitOp(page, prev) {
  await page.waitForFunction((p) => Number(document.body.dataset.opSeq || 0) > p, prev, { timeout: 60000 });
  return page.evaluate(() => ({ op: document.body.dataset.lastOp, message: document.body.dataset.lastMessage }));
}

async function uiImport(page, file, { confirm = true } = {}) {
  const prev = await opSeq(page);
  await page.setInputFiles('#fileImport', file);
  const dlg = page.locator('#confirmDlg[open]');
  const res = await Promise.race([
    dlg.waitFor({ timeout: 15000 }).then(() => 'dialog'),
    waitOp(page, prev).then(() => 'op'),
  ]);
  let dialogText = '';
  if (res === 'dialog') {
    dialogText = (await page.locator('#confirmBody').innerText()).replace(/\s+/g, ' ');
    await page.click(confirm ? '#confirmOk' : '#confirmCancel');
  }
  const r = await waitOp(page, prev);
  return { ...r, dialogText };
}

async function makeInvalidBackups(validPath, dir) {
  const text = await fs.readFile(validPath, 'utf8');
  const b = JSON.parse(text);
  const cases = {
    'empty.json': '',
    'not-json.json': 'PK\u0003\u0004 this is a zip header, not JSON',
    'wrong-kind.json': JSON.stringify({ hello: 'world' }),
    'newer-version.json': JSON.stringify({ ...b, schemaVersion: 99 }),
    'edited.json': text.replace('sample #1"', 'sample #1 (edited)"'),
    'truncated.json': text.slice(0, Math.floor(text.length / 2)),
  };
  const files = [];
  for (const [name, content] of Object.entries(cases)) {
    const p = path.join(dir, name);
    await fs.writeFile(p, content);
    files.push([name, p]);
  }
  return files;
}

async function runTarget(t, mode, server) {
  const r = reporter(t, mode);
  const url = mode === 'file' ? fileUrl(path.join(WEB_ROOT, 'index.html')) : `http://127.0.0.1:${PORT}/index.html`;
  const profile = path.join(TMP, `profile-${t.id}-${mode}`);
  const work = path.join(TMP, `work-${t.id}-${mode}`);
  await fs.rm(profile, { recursive: true, force: true });
  await fs.rm(work, { recursive: true, force: true });
  await fs.mkdir(work, { recursive: true });
  const launch = () => t.type.launchPersistentContext(profile, { ...t.launch, headless: !headed, acceptDownloads: true });
  const meta = { target: t.id, label: t.label, mode, url };

  let ctx;
  try {
    // ---------------- launch #1
    ctx = await launch();
    meta.browserVersion = ctx.browser()?.version?.() ?? null;
    let { page, err } = await openApp(ctx, url);
    if (err) { r.fail('IndexedDB available', err); await ctx.close(); return { ...meta, checks: r.checks }; }
    r.pass('IndexedDB opens (launch #1)');
    meta.userAgent = await page.evaluate(() => navigator.userAgent);
    const probe = await api(page, 'writeProbe');
    const add = await api(page, 'addRecords', 1000);
    r.pass('Write test value + 1,000 dated records', `${add.ms} ms`);
    const persist1 = await api(page, 'requestPersist');
    r.info('navigator.storage.persist()', persist1);
    await ctx.close(); ctx = null;           // full browser shutdown

    // ---------------- launch #2
    ctx = await launch();
    ({ page } = await openApp(ctx, url));
    const p2 = await api(page, 'readProbe');
    r.expect(p2?.token === probe.token, 'Test value survives full browser restart', p2?.token);
    const L2 = await api(page, 'launches');
    r.expect(L2?.count === 2, 'Launch counter = 2', L2?.count);
    let c = await api(page, 'counts');
    r.expect(c.records === 1000, 'All 1,000 records survive restart', c.records);
    await page.reload();
    await page.waitForFunction(() => window.lifeosPocReady === true);
    const p3 = await api(page, 'readProbe');
    r.expect(p3?.token === probe.token, 'Survives page refresh');
    const launchesBefore3 = (await api(page, 'launches')).count;  // a refresh counts as an open

    // export through the real UI → real download
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.click('#btnExport')]);
    const suggested = dl.suggestedFilename();
    const backupPath = path.join(work, suggested);
    await dl.saveAs(backupPath);
    const backup = JSON.parse(await fs.readFile(backupPath, 'utf8'));
    r.expect(/^LifeOS-PoC-Backup-\d{4}-\d{2}-\d{2}\.json$/.test(suggested), 'Export downloads a dated backup file', suggested);
    r.expect(backup.counts.records === 1000 && backup.data.records.length === 1000 && backup.schemaVersion === 1, 'Backup contains every record + schema version', `${backup.data.records.length} records, ${(JSON.stringify(backup).length / 1024).toFixed(0)} KB`);
    r.expect(!backup.data.meta.some((m) => m.key === 'launches'), 'Backup excludes device-only diagnostics');

    // clear through the UI (confirm dialog)
    let prev = await opSeq(page);
    await page.click('#btnClear');
    await page.locator('#confirmDlg[open]').waitFor();
    await page.click('#confirmCancel');
    await waitOp(page, prev);
    c = await api(page, 'counts');
    r.expect(c.records === 1000, 'Clear → Cancel leaves data untouched');
    prev = await opSeq(page);
    await page.click('#btnClear');
    await page.locator('#confirmDlg[open]').waitFor();
    await page.click('#confirmOk');
    await waitOp(page, prev);
    c = await api(page, 'counts');
    r.expect(c.records === 0 && !(await api(page, 'readProbe')), 'Clear → Confirm deletes data', c.records);

    // restore through the file picker
    const imp = await uiImport(page, backupPath, { confirm: true });
    c = await api(page, 'counts');
    const p4 = await api(page, 'readProbe');
    r.expect(imp.op === 'restore:ok' && c.records === 1000 && p4?.token === probe.token, 'Restore via file picker brings everything back', `${imp.op}, ${c.records} records`);
    r.expect(/replace/i.test(imp.dialogText) && /1000 records/.test(imp.dialogText), 'Restore warns before replacing (shows counts)', imp.dialogText.slice(0, 110) + '…');

    // cancel path
    const cancel = await uiImport(page, backupPath, { confirm: false });
    r.expect(cancel.op === 'restore:cancelled' && (await api(page, 'counts')).records === 1000, 'Restore → Cancel changes nothing');

    // invalid backups
    for (const [name, file] of await makeInvalidBackups(backupPath, work)) {
      const res = await uiImport(page, file);
      const cc = await api(page, 'counts');
      r.expect(res.op === 'restore:rejected' && cc.records === 1000, `Rejects invalid backup: ${name}`, res.message);
    }

    // stress / performance
    const s = await api(page, 'addRecords', STRESS);
    r.info(`Stress: write ${fmt(STRESS)} more records`, `${s.ms} ms`);
    const today = await page.evaluate(() => window.lifeosPoc.localDateKey());
    const monthStart = today.slice(0, 8) + '01';
    const q2 = await page.evaluate(([a, b]) => window.lifeosPoc.queryRange(a, b), [monthStart, today]);
    r.expect(q2.ms < 1000, `Month query on ${fmt(TOTAL)} records < 1 s`, `${q2.rows} rows in ${q2.ms} ms`);
    const bt0 = Date.now();
    const bsize = await page.evaluate(() => window.lifeosPoc.buildBackup().then((b) => JSON.stringify(b).length));
    r.expect(Date.now() - bt0 < 5000, `Export of ${fmt(TOTAL)} records < 5 s`, `${Date.now() - bt0} ms, ${(bsize / 1048576).toFixed(1)} MB`);
    const est = await api(page, 'storageInfo');
    r.info('Storage persisted / estimate', `${est.persisted} · ${est.estimate}`);
    await ctx.close(); ctx = null;

    // ---------------- launch #3
    ctx = await launch();
    let opened;
    ({ page, openMs: opened } = await openApp(ctx, url));
    c = await api(page, 'counts');
    const p5 = await api(page, 'readProbe');
    r.expect(c.records === TOTAL && p5?.token === probe.token, 'Restored + stress data survive another restart', `${c.records} records`);
    r.info(`Cold open with ${fmt(TOTAL)} records`, `${opened} ms (incl. browser page load)`);
    r.expect((await api(page, 'launches')).count === launchesBefore3 + 1, 'Launch counter keeps counting across restore + restart');
    const rt = await api(page, 'roundtrip');
    r.expect(rt.ok && rt.restoreMs < 15000, `Full backup → restore of ${fmt(TOTAL)} records`, `export ${rt.exportMs} ms, validate ${rt.validateMs} ms, restore ${rt.restoreMs} ms`);

    // ---------------- mode-specific extras
    if (mode === 'file') {
      // folder move: same browser profile, the app file now lives somewhere else
      const moved = path.join(TMP, `moved copy ${t.id}`, 'Life OS');
      await fs.rm(path.dirname(moved), { recursive: true, force: true });
      await fs.mkdir(moved, { recursive: true });
      await fs.copyFile(path.join(WEB_ROOT, 'index.html'), path.join(moved, 'index.html'));
      const m = await openApp(ctx, fileUrl(path.join(moved, 'index.html')), { reuseFirstPage: false });
      const pm = await api(m.page, 'readProbe');
      r.info('Folder moved/copied → data still visible?', pm?.token === probe.token ? 'YES (storage shared by all file:// pages)' : 'NO (storage tied to the file path)');

      const mp = await ctx.newPage();
      await mp.goto(fileUrl(path.join(WEB_ROOT, 'module-probe.html')));
      await mp.waitForFunction(() => window.__probe && window.__probe.done, null, { timeout: 10000 });
      const probeRes = await mp.evaluate(() => window.__probe);
      r.info('file:// script loading', `inline classic ${!!probeRes.inlineClassic}, external classic ${!!probeRes.externalClassic}, inline module ${!!probeRes.inlineModule}, external module ${!!probeRes.externalModule}, fetch() sibling ${!!probeRes.fetchSibling}`);
      meta.scriptProbe = probeRes;
    } else {
      // offline: service worker must serve the app with the network off
      await page.reload();
      await page.waitForFunction(() => window.lifeosPocReady === true);
      const controlled = await page.waitForFunction(() => !!navigator.serviceWorker && !!navigator.serviceWorker.controller, null, { timeout: 8000 }).then(() => true, () => false);
      if (!controlled) {
        r.info('Offline reload via service worker', 'service worker not controlling in this engine/automation');
      } else {
        await ctx.setOffline(true);
        try {
          await page.reload();
          await page.waitForFunction(() => window.lifeosPocReady === true, null, { timeout: 15000 });
          const po = await api(page, 'readProbe');
          r.expect(po?.token === probe.token, 'Offline reload works (service worker) + data readable');
        } catch (e) {
          r.fail('Offline reload works (service worker)', e.message.split('\n')[0]);
        } finally { await ctx.setOffline(false); }
      }
    }
    await ctx.close(); ctx = null;
  } catch (e) {
    r.fail('Harness error', e.message.split('\n')[0]);
    if (ctx) await ctx.close().catch(() => {});
  }
  return { ...meta, checks: r.checks };
}

async function runEdgeAppMode() {
  // The Windows launcher idea: open the file in an Edge "app window" (no tabs/address bar).
  const r = reporter({ id: 'edge-app' }, 'file');
  const url = fileUrl(path.join(WEB_ROOT, 'index.html'));
  const profile = path.join(TMP, 'profile-edge-appmode');
  await fs.rm(profile, { recursive: true, force: true });
  const launch = () => chromium.launchPersistentContext(profile, { channel: 'msedge', headless: false, args: [`--app=${url}`] });
  const findApp = async (ctx) => {
    for (let i = 0; i < 50; i++) {
      const p = ctx.pages().find((pg) => pg.url().startsWith('file:'));
      if (p) return p;
      await new Promise((res) => setTimeout(res, 200));
    }
    throw new Error('app window not found');
  };
  let ctx;
  try {
    ctx = await launch();
    let page = await findApp(ctx);
    await page.waitForFunction(() => window.lifeosPocReady === true);
    const probe = await page.evaluate(() => window.lifeosPoc.writeProbe());
    await page.evaluate(() => window.lifeosPoc.addRecords(250));
    r.pass('App window opens the local file + writes');
    await ctx.close();
    ctx = await launch();
    page = await findApp(ctx);
    await page.waitForFunction(() => window.lifeosPocReady === true);
    const p2 = await page.evaluate(() => window.lifeosPoc.readProbe());
    const c = await page.evaluate(() => window.lifeosPoc.counts());
    r.expect(p2?.token === probe.token && c.records === 250, 'Data survives closing/reopening the app window', `${c.records} records`);
    await ctx.close(); ctx = null;
  } catch (e) {
    r.fail('Edge --app window', e.message.split('\n')[0]);
    if (ctx) await ctx.close().catch(() => {});
  }
  return { target: 'edge-app', label: 'Edge app-window launcher (msedge --app=file://…)', mode: 'file', checks: r.checks };
}

async function runTimezones() {
  const r = reporter({ id: 'tz' }, 'file');
  const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : 'chrome' });
  const url = fileUrl(path.join(WEB_ROOT, 'index.html'));
  const cases = [
    { tz: 'America/Los_Angeles', utc: '2026-09-16T06:30:00Z', expect: '2026-09-15', label: '11:30 pm Sep 15 in Los Angeles' },
    { tz: 'Pacific/Auckland', utc: '2026-09-15T13:30:00Z', expect: '2026-09-16', label: '1:30 am Sep 16 in Auckland' },
    { tz: 'Asia/Kolkata', utc: '2026-09-15T18:45:00Z', expect: '2026-09-16', label: '12:15 am Sep 16 in India' },
  ];
  try {
    for (const k of cases) {
      const ctx = await browser.newContext({ timezoneId: k.tz });
      const page = await ctx.newPage();
      await page.clock.setFixedTime(new Date(k.utc));
      await page.goto(url);
      await page.waitForFunction(() => window.lifeosPocReady === true || !!window.lifeosPocError);
      const got = await page.evaluate(() => ({ key: window.lifeosPoc.localDateKey(), iso: new Date().toISOString().slice(0, 10) }));
      r.expect(got.key === k.expect, `Day key correct at ${k.label}`, `local key ${got.key} (naive toISOString would say ${got.iso})`);
      const dst = await page.evaluate(() => [window.lifeosPoc.addDays('2026-10-31', 1), window.lifeosPoc.addDays('2026-11-01', 1), window.lifeosPoc.addDays('2026-03-08', 1), window.lifeosPoc.addDays('2026-09-27', 1)]);
      r.expect(dst.join() === '2026-11-01,2026-11-02,2026-03-09,2026-09-28', `Day arithmetic across DST in ${k.tz}`, dst.join(' '));
      await ctx.close();
    }
  } catch (e) { r.fail('Timezone harness', e.message.split('\n')[0]); }
  await browser.close();
  return { target: 'timezones', label: 'Date strategy under different time zones (Chromium)', mode: 'file', checks: r.checks };
}

function toMarkdown(results, startedAt) {
  const lines = [`# Phase 0 — automated validation results`, '', `Run: ${startedAt} on ${os.type()} ${os.release()} (${os.arch()}), Node ${process.version}.`, `Project path contains spaces and lives in OneDrive: \`${WEB_ROOT}\`.`, ''];
  const summary = results.map((x) => {
    const f = x.checks.filter((c) => c.status === 'fail').length;
    const p = x.checks.filter((c) => c.status === 'pass').length;
    return `| ${x.label} | ${x.mode === 'file' ? 'file:// (double-click)' : 'http://127.0.0.1 (served)'} | ${x.browserVersion || ''} | ${p} | ${f} | ${f ? '❌' : '✅'} |`;
  });
  lines.push('| Target | Launch mode | Version | Passed | Failed | Result |', '|---|---|---|---|---|---|', ...summary, '');
  for (const x of results) {
    lines.push(`## ${x.label} — ${x.mode}`, '');
    if (x.userAgent) lines.push(`UA: \`${x.userAgent}\``, '');
    for (const c of x.checks) lines.push(`- ${c.status === 'pass' ? '✅' : c.status === 'fail' ? '❌' : 'ℹ️'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
    lines.push('');
  }
  return lines.join('\n');
}

// A hung engine must not stall the whole run: give up on that target and keep going.
function withTimeout(promise, meta) {
  let timer;
  const timeout = new Promise((res) => { timer = setTimeout(() => res({ ...meta, checks: [{ status: 'fail', name: 'Timed out', detail: `no result after ${TARGET_TIMEOUT_MS / 1000}s (engine hung)` }] }), TARGET_TIMEOUT_MS); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
async function saveResults() {
  await fs.writeFile(path.join(OUT, 'validation-results.json'), JSON.stringify({ startedAt, results }, null, 2));
  await fs.writeFile(path.join(OUT, 'VALIDATION-RESULTS.md'), toMarkdown(results, startedAt));
}

const startedAt = now();
await fs.mkdir(OUT, { recursive: true });
await fs.mkdir(TMP, { recursive: true });
const server = await startServer(PORT);
const results = [];
try {
  for (const t of TARGETS) {
    if (only && !only.includes(t.id)) continue;
    for (const mode of MODES) {
      console.log(`\n▶ ${t.label} — ${mode}`);
      results.push(await withTimeout(runTarget(t, mode, server), { target: t.id, label: t.label, mode }));
      await saveResults();
    }
  }
  if (!only || only.includes('edge-app')) { console.log('\n▶ Edge app-window mode'); results.push(await withTimeout(runEdgeAppMode(), { target: 'edge-app', label: 'Edge app-window launcher', mode: 'file' })); await saveResults(); }
  if (!only || only.includes('tz')) { console.log('\n▶ Time zones'); results.push(await withTimeout(runTimezones(), { target: 'timezones', label: 'Time zones', mode: 'file' })); await saveResults(); }
} finally {
  server.close();
}
await saveResults();
const failed = results.flatMap((x) => x.checks).filter((c) => c.status === 'fail').length;
console.log(`\nDone. ${failed} failed check(s). Results in poc/tests/results/`);
process.exit(failed ? 1 : 0);  // exit even if a timed-out browser is still hanging
