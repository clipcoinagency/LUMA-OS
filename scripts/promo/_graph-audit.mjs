// Graph + numbers audit. Starts the dev server, then for three datasets (empty, realistic, nasty edge
// cases) visits every page in two themes and checks:
//   • no "NaN" / "Infinity" / "undefined" / "[object" in the visible text or in any attribute
//   • no console/page errors
//   • bars never taller than their container, no negative sizes
// and, for the realistic dataset, compares what the charts show with numbers computed independently
// from the raw database (Finance totals, 6-month trend, daily spending, Home progress, goal percent).
// Usage: node scripts/promo/_graph-audit.mjs
import { chromium } from 'playwright';
import { spawn, execSync } from 'node:child_process';

const PORT = 5197;
const URL = `http://localhost:${PORT}/`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const problems = [];
const note = (m) => { problems.push(m); console.log('  [PROBLEM]', m); };
const ok = (m) => console.log('  [ok]', m);

const dev = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { shell: true, stdio: 'ignore' });
const killDev = () => { try { execSync(`taskkill /pid ${dev.pid} /T /F`, { stdio: 'ignore' }); } catch { /* already gone */ } };
process.on('exit', killDev);
for (let i = 0; i < 90; i++) { try { const r = await fetch(URL); if (r.ok) break; } catch { /* not up yet */ } await sleep(1000); }

const browser = await chromium.launch({ channel: 'msedge' });
const clickText = (page, sel, src) => page.evaluate(([s, src]) => { const re = new RegExp(src); const el = [...document.querySelectorAll(s)].find((e) => re.test(e.textContent.trim()) && !e.disabled); el?.click(); return !!el; }, [sel, src]);

async function freshApp() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light', locale: 'en-US' });
  const page = await ctx.newPage();
  page.errs = [];
  page.on('pageerror', (e) => page.errs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/MIME type|favicon|Failed to load resource/.test(m.text())) page.errs.push('console: ' + m.text()); });
  await page.goto(URL, { waitUntil: 'networkidle' }); await sleep(2500);
  await page.getByRole('button', { name: /Set up my workspace/ }).click(); await sleep(400);
  await clickText(page, 'button, [role=radio]', '^Founder'); await sleep(300);
  await clickText(page, 'button', '^Continue$'); await sleep(500);
  await page.evaluate(() => { for (const el of document.querySelectorAll('[aria-checked=false]')) if (/Tasks|Goals|Habits|Calendar|Notes|Wellness|Finance|Work|Study/.test(el.closest('label,button,[role]')?.textContent || '')) el.click(); });
  await sleep(300);
  for (let i = 0; i < 6; i++) { if (!(await clickText(page, 'button', '^(Continue|Create workspace)$'))) break; await sleep(450); }
  await clickText(page, 'button', 'Open my workspace'); await sleep(1200);
  return { ctx, page };
}

const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

async function seedSample(page) {
  await page.evaluate(async () => { const m = await import('/src/lib/db/sample.ts'); await m.seedSampleData(90, 7); });
  await page.reload({ waitUntil: 'networkidle' }); await sleep(2500);
}

// Nasty-but-possible data: zero/over targets, tiny and huge amounts, 20 h sessions, ancient and
// future dates, another currency, a yen workspace (0 decimals).
async function seedEdge(page, currency) {
  await page.evaluate(async (cur) => {
    const idb = await import('/src/lib/db/idb.ts');
    const defaults = await import('/src/lib/db/defaults.ts');
    await defaults.saveSettings({ currency: cur });
    const now = new Date();
    const key = (off) => { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + off); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    const at = now.toISOString();
    const st = { createdAt: at, updatedAt: at };
    let n = 0; const id = (p) => `${p}_edge${++n}`;
    const cats = await idb.getAll('finance_categories');
    const cat = cats.find((c) => c.type === 'expense')?.id ?? null;
    const put = (s, v) => idb.put(s, v);
    // money
    const tx = (type, amountMinor, off, currency = cur) => put('transactions', { id: id('tx'), date: key(off), type, amountMinor, currency, categoryId: type === 'expense' ? cat : null, note: 'edge', ...st });
    await tx('expense', 1, 0); await tx('expense', 150000000, -1); await tx('income', 9000000000, 0); await tx('saving', 5, 0);
    await tx('expense', 12345, -40); await tx('expense', 777, -75); await tx('expense', 4200, 3); await tx('expense', 5000, 0, cur === 'USD' ? 'EUR' : 'USD');
    // tasks
    for (let i = 0; i < 5; i++) await put('tasks', { id: id('t'), title: 'Edge ' + i, notes: '', priority: 'none', dueDate: key(0), dueTime: null, reminder: false, remindedOn: null, tags: [], done: true, completedOn: key(0), createdOn: key(-1), ...st });
    await put('tasks', { id: id('t'), title: 'Ancient', notes: '', priority: 'none', dueDate: null, dueTime: null, reminder: false, remindedOn: null, tags: [], done: true, completedOn: key(-400), createdOn: key(-401), ...st });
    // habits
    const hid = id('hab');
    await put('habits', { id: hid, name: 'One log only', frequency: { kind: 'daily' }, color: '#4f98a8', icon: 'droplet', archived: false, order: 0, createdOn: key(0), ...st });
    await put('habit_logs', { id: `${hid}|${key(0)}`, habitId: hid, date: key(0), createdAt: at });
    // focus
    const sess = (seconds, off) => put('focus_sessions', { id: id('fs'), date: key(off), startedAt: new Date(now.getTime() + off * 86400000).toISOString(), endedAt: at, seconds, plannedMin: 25, taskId: null, projectId: null, label: 'edge', createdAt: at });
    await sess(31, 0); await sess(72000, -1); await sess(0, -2);
    // wellness + workouts
    await put('wellness', { id: key(0), date: key(0), water: 0, sleepHours: 24, mood: 5, steps: 0, weight: null, note: '', updatedAt: at });
    await put('wellness', { id: key(-1), date: key(-1), water: 99, sleepHours: 0, mood: 1, steps: 1000000, weight: 0, note: '', updatedAt: at });
    await put('workouts', { id: id('w'), date: key(0), type: 'Run', durationMin: 0, intensity: null, note: '', ...st });
    await put('workouts', { id: id('w'), date: key(-1), type: 'Ultra', durationMin: 600, intensity: 'hard', note: '', ...st });
    // goals: zero target, over target, past deadline, deadline = creation day, milestone-only
    const goal = (title, target, current, deadline, createdOn) => put('goals', { id: id('g'), title, description: '', target, unit: 'pts', current, deadline, status: 'active', milestones: [], createdOn, completedOn: null, ...st });
    await goal('Zero target', 0, 5, key(30), key(-10)); await goal('Over target', 100, 150, key(30), key(-10)); await goal('Past deadline', 100, 10, key(-5), key(-20));
    await goal('Same day', 100, 10, key(0), key(0)); await goal('Milestones only', null, 0, null, key(-3));
    // debts: tiny, huge, overdue, settled, another currency, a very long name
    const debt = (person, direction, amountMinor, began, due, currency = cur, settledOn = null) => put('debts', { id: id('debt'), person, direction, amountMinor, currency, date: key(began), dueDate: due === null ? null : key(due), note: '', settledOn: settledOn === null ? null : key(settledOn), ...st });
    await debt('Tiny', 'owe', 1, -3, 0); await debt('Huge', 'owed', 900000000000, -30, -10); await debt('Z'.repeat(80), 'owe', 5000, -2, 400);
    await debt('Settled', 'owed', 2500, -50, -40, cur, -45); await debt('Euro friend', 'owed', 7000, -9, 1, cur === 'EUR' ? 'USD' : 'EUR');
    await put('debt_payments', { id: id('dpay'), debtId: (await idb.getAll('debts')).find((d) => d.person === 'Huge').id, date: key(-5), amountMinor: 450000000000, note: '', createdAt: at });
    // bills: weekly / yearly, huge, paused, overdue, long name
    const bill = (name, amountMinor, cadence, nextDue, paused = false) => put('bills', { id: id('bill'), name, amountMinor, currency: cur, cadence, anchor: key(nextDue), nextDue: key(nextDue), categoryId: null, note: '', paused, ...st });
    await bill('Tiny weekly', 1, 'weekly', 2); await bill('Huge yearly', 90000000000, 'yearly', 200); await bill('Paused', 1500, 'monthly', -3, true); await bill('Overdue', 2500, 'monthly', -8); await bill('B'.repeat(90), 999, 'monthly', 0);
    // events / notes / long names
    await put('events', { id: id('e'), title: 'X'.repeat(120), date: key(0), allDay: false, startTime: '23:59', endTime: '00:30', notes: '', color: '#4f98a8', ...st });
    await put('notes', { id: id('n'), title: 'N'.repeat(140), content: 'x', date: key(0), pinned: false, tags: [], kind: 'journal', mood: 1, ...st });
  }, currency);
  await page.reload({ waitUntil: 'networkidle' }); await sleep(2500);
}

const ROUTES = ['dashboard', 'tasks', 'calendar', 'goals', 'habits', 'study', 'work', 'finance', 'finance:bills', 'finance:debts', 'wellness', 'notes', 'insights', 'reset', 'close', 'seals', 'settings'];

async function setTheme(page, label) {
  await page.goto(URL + '#/settings'); await page.locator('main h1').first().waitFor();
  await page.evaluate((l) => [...document.querySelectorAll('[role=radio]')].find((b) => b.querySelector('.name')?.textContent.trim() === l)?.click(), label);
  await sleep(700);
}

async function scan(page, where) {
  const r = await page.evaluate(() => {
    const bad = /\bNaN\b|Infinity|\bundefined\b|\[object|\bnull\b/;
    const out = [];
    const text = document.querySelector('main')?.innerText ?? '';
    const m = text.match(bad); if (m) out.push(`text has "${m[0]}": …${text.slice(Math.max(0, m.index - 30), m.index + 30).replace(/\s+/g, ' ')}…`);
    for (const el of document.querySelectorAll('main *')) {
      for (const a of el.getAttributeNames()) {
        const v = el.getAttribute(a) ?? '';
        if (/NaN|Infinity|undefined/.test(v) && a !== 'class') out.push(`<${el.tagName.toLowerCase()} ${a}="${v.slice(0, 60)}">`);
      }
      if (el.classList.contains('bar') || el.classList.contains('fill')) {
        const b = el.getBoundingClientRect(), p = el.parentElement.getBoundingClientRect();
        if (b.height < 0 || b.width < 0) out.push(`negative size on .${[...el.classList].join('.')}`);
        if (p.height > 0 && b.height > p.height + 1.5 && el.classList.contains('bar')) out.push(`bar taller than its container (${Math.round(b.height)} > ${Math.round(p.height)})`);
      }
    }
    return [...new Set(out)].slice(0, 6);
  });
  for (const m of r) note(`${where}: ${m}`);
  return r.length === 0;
}

async function sweep(page, label, themes) {
  for (const th of themes) {
    await setTheme(page, th);
    let clean = true;
    for (const r of ROUTES) {
      page.errs.length = 0;
      const [route, tab] = r.split(':');
      await page.goto(URL + '#/' + route); await page.locator('main h1').first().waitFor({ timeout: 8000 }).catch(() => note(`${label}/${th}/${r}: page did not render`));
      await sleep(1400);
      if (tab) { await page.getByRole('radio', { name: new RegExp('^' + tab, 'i') }).click(); await sleep(900); }
      const w = `${label}/${th}/${r}`;
      if (!(await scan(page, w))) clean = false;
      if (page.errs.length) { clean = false; note(`${w}: ${page.errs.slice(0, 2).join(' | ')}`); }
    }
    if (clean) ok(`${label} · ${th}: all ${ROUTES.length} pages clean`);
  }
}

// ---------------------------------------------------------------- 1. empty
console.log('\n== empty workspace');
{ const { ctx, page } = await freshApp(); await sweep(page, 'empty', ['Soft', 'Dark', 'Nebula']); await ctx.close(); }

// ---------------------------------------------------------------- 2. realistic data + ground truth
console.log('\n== realistic data (90 days)');
{
  const { ctx, page } = await freshApp();
  await seedSample(page);
  await sweep(page, 'sample', ['Soft', 'Light', 'Dark', 'Nebula']);

  // independent truth, straight from the raw database
  const truth = await page.evaluate(async () => {
    const idb = await import('/src/lib/db/idb.ts');
    const key = (off) => { const n = new Date(); const d = new Date(n.getFullYear(), n.getMonth(), n.getDate() + off); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    const tx = await idb.getAll('transactions');
    const settings = await idb.get('settings', 'settings');
    const cur = settings.currency;
    const ym = key(0).slice(0, 7);
    const sumOf = (rows, type) => rows.filter((t) => t.type === type && t.currency === cur).reduce((a, t) => a + t.amountMinor, 0);
    const month = tx.filter((t) => t.date.startsWith(ym));
    const months = [];
    for (let i = 5; i >= 0; i--) { const d = new Date(new Date().getFullYear(), new Date().getMonth() - i, 1); const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; months.push(sumOf(tx.filter((t) => t.date.startsWith(k)), 'expense')); }
    const daily = []; for (let d = 1; d <= Number(key(0).slice(8)); d++) daily.push(sumOf(tx.filter((t) => t.date === `${ym}-${String(d).padStart(2, '0')}`), 'expense'));
    const last7 = new Set([0, 1, 2, 3, 4, 5, 6].map((i) => key(-i)));
    const tasks = (await idb.getAll('tasks')).filter((t) => t.done && last7.has(t.completedOn)).length;
    const logs = (await idb.getAll('habit_logs')).filter((l) => last7.has(l.date)).length;
    const wk = (await idb.getAll('workouts')).filter((w) => last7.has(w.date)).length;
    const goals = (await idb.getAll('goals')).filter((g) => g.status === 'active' && g.target).map((g) => ({ title: g.title, pct: Math.min(100, Math.round((g.current / g.target) * 100)) }));
    return { cur, expense: sumOf(month, 'expense'), income: sumOf(month, 'income'), saving: sumOf(month, 'saving'), months, daily, progress: tasks + logs + wk, goals };
  });
  const money = (minor, cur) => new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(minor / 100);

  await setTheme(page, 'Soft');
  await page.goto(URL + '#/finance'); await page.locator('main h1').first().waitFor(); await sleep(1200);
  await page.getByRole('radio', { name: 'Money' }).click(); await sleep(1200);   // Finance remembers the last tab (Debts/Bills)
  const fin = await page.evaluate(() => ({
    cards: [...document.querySelectorAll('.summary .s')].map((s) => ({ l: s.querySelector('.l')?.textContent.trim(), v: s.querySelector('.v')?.textContent.trim() })),
    tables: [...document.querySelectorAll('figure.chart')].map((f) => ({ label: f.getAttribute('aria-label'), rows: [...f.querySelectorAll('tbody tr')].map((r) => r.querySelector('td')?.textContent.trim()) })),
  }));
  const card = (l) => fin.cards.find((c) => c.l === l)?.v;
  const cmp = (name, got, want) => (got === want ? ok(`${name}: ${got}`) : note(`${name}: page shows ${got}, database says ${want}`));
  cmp('Finance · Spent', card('Spent'), money(truth.expense, truth.cur));
  cmp('Finance · Income', card('Income'), money(truth.income, truth.cur));
  cmp('Finance · Saved', card('Saved'), money(truth.saving, truth.cur));
  cmp('Finance · Left', card('Left'), money(truth.income - truth.expense - truth.saving, truth.cur));
  const trend = fin.tables.find((t) => /^Spending per month/.test(t.label ?? ''));
  const daily = fin.tables.find((t) => /per day/.test(t.label ?? ''));
  cmp('Finance · 6-month trend', JSON.stringify(trend?.rows), JSON.stringify(truth.months.map((m) => money(m, truth.cur))));
  cmp('Finance · daily spending', JSON.stringify(daily?.rows), JSON.stringify(truth.daily.map((m) => money(m, truth.cur))));

  await page.goto(URL + '#/dashboard'); await page.locator('main h1').first().waitFor();
  // Home loads a lot more now: wait for the Progress tile's number to finish counting up to the expected value
  await page.waitForFunction((want) => { const t = [...document.querySelectorAll('.tile')].find((x) => /Progress/.test(x.textContent)); return t?.querySelector('.big .num')?.textContent.trim() === want; }, String(truth.progress), { timeout: 12000 }).catch(() => {});
  await sleep(500);
  const prog = await page.evaluate(() => { const t = [...document.querySelectorAll('.tile')].find((x) => /Progress/.test(x.textContent)); return { big: t?.querySelector('.big .num')?.textContent.trim(), bars: [...(t?.querySelectorAll('.col') ?? [])].map((c) => c.getAttribute('title')) }; });
  cmp('Home · "done this week"', prog.big, String(truth.progress));
  const barsTotal = prog.bars.reduce((a, t) => a + Number(/: (\d+) done/.exec(t ?? '')?.[1] ?? NaN), 0);
  cmp('Home · progress bars add up to the total', String(barsTotal), String(truth.progress));

  await page.goto(URL + '#/goals'); await page.locator('main h1').first().waitFor(); await sleep(1800);
  const gp = await page.evaluate(() => [...document.querySelectorAll('[role=progressbar][aria-valuenow]')].map((e) => ({ label: e.getAttribute('aria-label'), v: Number(e.getAttribute('aria-valuenow')) })));
  for (const g of truth.goals) { const hit = gp.find((p) => (p.label ?? '').includes(g.title)); if (hit) cmp(`Goals · "${g.title}" ring`, String(hit.v), String(g.pct)); }
  await ctx.close();
}

// ---------------------------------------------------------------- 3. edge cases (USD, then yen = 0 decimals, then dinar = 3)
for (const cur of ['USD', 'JPY', 'KWD']) {
  console.log(`\n== edge-case data (${cur})`);
  const { ctx, page } = await freshApp();
  await seedEdge(page, cur);
  await sweep(page, `edge-${cur}`, cur === 'USD' ? ['Soft', 'Nebula', 'Paper'] : ['Nebula']);
  await ctx.close();
}

await browser.close();
killDev();
console.log(problems.length ? `\n${problems.length} PROBLEM(S):\n - ${problems.join('\n - ')}` : '\nNo problems found.');
process.exit(0);
