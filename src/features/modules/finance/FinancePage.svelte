<script lang="ts">
  // Month-by-month finance: summary, category breakdown, daily spending, and every transaction.
  // Browse back to any previous month — nothing is overwritten.
  import { Plus, Wallet, Tags, SearchX, TrendingDown, TrendingUp } from '@lucide/svelte';
  import PageHeader from '../PageHeader.svelte';
  import CategoriesManager from './CategoriesManager.svelte';
  import Button from '../../../lib/ui/Button.svelte';
  import MonthNav from '../../../lib/ui/MonthNav.svelte';
  import Segmented from '../../../lib/ui/Segmented.svelte';
  import SearchField from '../../../lib/ui/SearchField.svelte';
  import BarChart from '../../../lib/ui/BarChart.svelte';
  import EmptyState from '../../../lib/ui/EmptyState.svelte';
  import { changes } from '../../../lib/db/changes.svelte';
  import { clock } from '../../../lib/clock.svelte';
  import { app } from '../../../lib/app.svelte';
  import { openQuick } from '../../quick/quick.svelte';
  import { summarize, transactionsInRange } from '../../../lib/domain/finance';
  import { getAll } from '../../../lib/db/idb';
  import { formatMoney, minorDigits } from '../../../lib/util/money';
  import { addMonths, diffDays, eachDay, endOfMonth, formatDateKey, startOfMonth } from '../../../lib/util/dates';
  import type { FinanceCategory, Transaction } from '../../../lib/db/schema';

  let month = $state(startOfMonth(clock.today));
  let txns = $state.raw<Transaction[] | null>(null);
  let prevTxns = $state.raw<Transaction[]>([]);
  let cats = $state.raw<Map<string, FinanceCategory>>(new Map());
  let filter = $state('all');
  let q = $state('');
  let manage = $state(false);

  const currency = $derived(app.settings?.currency ?? 'USD');
  $effect(() => {
    void changes.version;
    const m = month;
    void transactionsInRange(m, endOfMonth(m)).then((t) => { txns = t; });
    void transactionsInRange(addMonths(m, -1), endOfMonth(addMonths(m, -1))).then((t) => { prevTxns = t; });
    void getAll('finance_categories').then((c) => { cats = new Map(c.map((x) => [x.id, x])); });
  });

  const sum = $derived(txns ? summarize(txns, currency) : null);
  const prev = $derived(summarize(prevTxns, currency));
  const money = (m: number) => formatMoney(m, currency);
  const spendChange = $derived(sum && prev.expenseMinor > 0 ? (sum.expenseMinor - prev.expenseMinor) / prev.expenseMinor : null);
  const daily = $derived.by(() => {
    if (!txns) return [];
    const last = month === startOfMonth(clock.today) ? clock.today : endOfMonth(month);
    const by = new Map<string, number>();
    for (const t of txns) if (t.type === 'expense' && t.currency === currency) by.set(t.date, (by.get(t.date) ?? 0) + t.amountMinor);
    const unit = 10 ** minorDigits(currency);
    return eachDay(month, last).map((d) => ({ label: String(Number(d.slice(8))), value: (by.get(d) ?? 0) / unit }));
  });
  const shownTx = $derived.by(() => {
    if (!txns) return [];
    const s = q.trim().toLowerCase();
    return txns
      .filter((t) => (filter === 'all' || t.type === filter) && (!s || t.note.toLowerCase().includes(s) || (t.categoryId && cats.get(t.categoryId)?.name.toLowerCase().includes(s))))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  });
  const groups = $derived.by(() => {
    const m = new Map<string, Transaction[]>();
    for (const t of shownTx) m.set(t.date, [...(m.get(t.date) ?? []), t]);
    return [...m];
  });
  const dayTitle = (d: string) => { const n = diffDays(d, clock.today); return n === 0 ? 'Today' : n === 1 ? 'Yesterday' : formatDateKey(d, { weekday: 'long', day: 'numeric', month: 'short' }); };
  const signed = (t: Transaction) => `${t.type === 'income' ? '+' : t.type === 'expense' ? '−' : ''}${formatMoney(t.amountMinor, t.currency)}`;
</script>

<PageHeader module="finance">
  {#snippet actions()}
    <Button onclick={() => (manage = true)}>{#snippet icon()}<Tags />{/snippet}Categories</Button>
    <Button variant="primary" onclick={() => openQuick('transaction')}>{#snippet icon()}<Plus />{/snippet}Record</Button>
  {/snippet}
</PageHeader>

<div class="bar"><MonthNav {month} today={clock.today} allowFuture={false} onchange={(m) => (month = m)} /></div>

{#if sum}
  <section class="summary" aria-label="Month summary">
    <div class="s main"><span class="l">Spent</span><span class="v big num">{money(sum.expenseMinor)}</span>
      {#if spendChange !== null}<span class="chg" class:up={spendChange > 0}>{#if spendChange > 0}<TrendingUp size={14} aria-hidden="true" />{:else}<TrendingDown size={14} aria-hidden="true" />{/if}{Math.abs(Math.round(spendChange * 100))}% {spendChange > 0 ? 'more' : 'less'} than last month</span>{/if}
    </div>
    <div class="s"><span class="l">Income</span><span class="v num">{money(sum.incomeMinor)}</span></div>
    <div class="s"><span class="l">Saved</span><span class="v num">{money(sum.savingMinor)}</span></div>
    <div class="s"><span class="l">Left</span><span class="v num" class:neg={sum.balanceMinor < 0}>{money(sum.balanceMinor)}</span></div>
  </section>
  {#if sum.otherCurrencyCount}<p class="meta other">{sum.otherCurrencyCount} transaction{sum.otherCurrencyCount === 1 ? '' : 's'} in other currencies are listed below but not included in these totals.</p>{/if}

  {#if sum.count === 0}
    <div class="card"><EmptyState title="Nothing recorded in {formatDateKey(month, { month: 'long' })}" body="Record income, spending and savings to see where your money goes.">
      {#snippet icon()}<Wallet />{/snippet}
      {#snippet action()}<Button variant="primary" onclick={() => openQuick('transaction')}>{#snippet icon()}<Plus />{/snippet}Record money</Button>{/snippet}
    </EmptyState></div>
  {:else}
    <div class="charts">
      <section class="card" aria-labelledby="cat-h">
        <h2 id="cat-h">Where it went</h2>
        {#if sum.byCategory.length === 0}<p class="meta">No expenses this month.</p>{:else}
          <ul class="cats">
            {#each sum.byCategory as c (c.categoryId ?? 'none')}
              {@const cat = c.categoryId ? cats.get(c.categoryId) : undefined}
              <li>
                <span class="name"><span class="sw" style="background:{cat?.color ?? 'var(--text-3)'}"></span>{cat?.name ?? 'Uncategorised'}</span>
                <span class="track" aria-hidden="true"><span style="width:{(c.amountMinor / sum.expenseMinor) * 100}%;background:{cat?.color ?? 'var(--text-3)'}"></span></span>
                <span class="pct num">{Math.round((c.amountMinor / sum.expenseMinor) * 100)}%</span>
                <span class="amt num">{money(c.amountMinor)}</span>
              </li>
            {/each}
          </ul>
        {/if}
      </section>
      <section class="card" aria-labelledby="daily-h">
        <h2 id="daily-h">Daily spending</h2>
        <BarChart data={daily} label="Spending per day in {formatDateKey(month, { month: 'long' })}" height={150} format={(v) => formatMoney(Math.round(v * 10 ** minorDigits(currency)), currency)} highlight={daily.length - 1} />
      </section>
    </div>
  {/if}

  <section class="tx" aria-labelledby="tx-h">
    <div class="txbar">
      <h2 id="tx-h">Transactions</h2>
      <div class="f"><Segmented label="Filter" size="sm" bind:value={filter} options={[{ value: 'all', label: 'All' }, { value: 'expense', label: 'Spent' }, { value: 'income', label: 'Income' }, { value: 'saving', label: 'Saved' }]} /></div>
      <div class="s2"><SearchField bind:value={q} label="Search transactions" placeholder="Search notes or categories" /></div>
    </div>
    {#if groups.length === 0 && (q || filter !== 'all')}
      <EmptyState compact title="No matching transactions">{#snippet icon()}<SearchX />{/snippet}</EmptyState>
    {/if}
    {#each groups as [d, list] (d)}
      <h3 class="dt">{dayTitle(d)}</h3>
      <ul class="list">
        {#each list as t (t.id)}
          {@const cat = t.categoryId ? cats.get(t.categoryId) : undefined}
          <li><button type="button" onclick={() => openQuick('transaction', { transaction: $state.snapshot(t) })}>
            <span class="sw" style="background:{cat?.color ?? 'var(--text-3)'}" aria-hidden="true"></span>
            <span class="what"><span class="c">{cat?.name ?? (t.type === 'income' ? 'Income' : t.type === 'saving' ? 'Saving' : 'Expense')}</span>{#if t.note}<span class="meta">{t.note}</span>{/if}</span>
            <span class="amt num {t.type}">{signed(t)}</span>
          </button></li>
        {/each}
      </ul>
    {/each}
  </section>
{/if}

<CategoriesManager bind:open={manage} />

<style>
  .bar { margin-bottom: var(--space-4); }
  .summary { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: var(--space-3); margin-bottom: var(--space-3); }
  @media (max-width: 760px) { .summary { grid-template-columns: repeat(3, 1fr); } .summary .main { grid-column: 1 / -1; } }
  .s { background: var(--surface); border: var(--card-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-1); padding: var(--space-4); display: grid; gap: 4px; align-content: start; min-width: 0; }
  .l { font-size: var(--text-xs); font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--text-2); }
  .v { font-weight: 700; font-size: var(--text-md); overflow-wrap: anywhere; }
  .big { font-family: var(--font-display); font-weight: var(--display-weight); font-size: var(--text-2xl); }
  .neg { color: var(--danger); }
  .chg { display: inline-flex; align-items: center; gap: 4px; font-size: var(--text-xs); font-weight: 650; color: var(--success); }
  .chg.up { color: var(--warning); }
  .other { margin-bottom: var(--space-3); }
  .card { background: var(--surface); border: var(--card-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-1); padding: var(--space-4) var(--space-5); }
  .card h2, .tx h2 { font-size: var(--text-md); margin-bottom: var(--space-3); }
  .charts { display: grid; gap: var(--space-4); grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr)); margin-bottom: var(--space-5); align-items: start; }
  .cats { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-2); }
  .cats li { display: grid; grid-template-columns: minmax(90px, 1.2fr) 2fr 40px minmax(70px, auto); gap: var(--space-2); align-items: center; font-size: var(--text-sm); }
  .name { display: flex; align-items: center; gap: 6px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sw { width: 10px; height: 10px; border-radius: 50%; flex: none; display: inline-block; }
  .track { height: 8px; border-radius: 99px; background: var(--surface-3); overflow: hidden; }
  .track span { display: block; height: 100%; border-radius: inherit; }
  .pct { color: var(--text-3); text-align: right; }
  .amt { text-align: right; font-weight: 600; }
  .txbar { display: grid; grid-template-columns: auto auto 1fr; gap: var(--space-3); align-items: center; margin-bottom: var(--space-3); }
  .txbar h2 { margin: 0; }
  @media (max-width: 760px) { .txbar { grid-template-columns: 1fr; } }
  .dt { font-family: var(--font-body); font-size: var(--text-sm); font-weight: 700; color: var(--text-2); letter-spacing: 0; margin: var(--space-4) 0 var(--space-2); }
  .list { list-style: none; margin: 0; padding: 0; background: var(--surface); border: var(--card-border); border-radius: var(--radius-lg); overflow: hidden; }
  .list li + li { border-top: 1px solid var(--border); }
  .list button { width: 100%; display: flex; align-items: center; gap: var(--space-3); min-height: 56px; padding: var(--space-2) var(--space-4); background: none; border: 0; text-align: left; color: var(--text); cursor: pointer; }
  .list button:hover { background: var(--surface-2); }
  .what { flex: 1; min-width: 0; display: grid; }
  .c { font-weight: 600; }
  .what .meta { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .amt.income { color: var(--success); }
  .amt.saving { color: var(--info); }
</style>
