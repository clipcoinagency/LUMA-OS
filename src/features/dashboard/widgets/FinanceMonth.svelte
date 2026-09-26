<script lang="ts">
  import { Plus, Wallet } from '@lucide/svelte';
  import WidgetCard from '../WidgetCard.svelte';
  import Button from '../../../lib/ui/Button.svelte';
  import EmptyState from '../../../lib/ui/EmptyState.svelte';
  import { changes } from '../../../lib/db/changes.svelte';
  import { clock } from '../../../lib/clock.svelte';
  import { app } from '../../../lib/app.svelte';
  import { openQuick } from '../../quick/quick.svelte';
  import { listCategories, monthSummary, type PeriodSummary } from '../../../lib/domain/finance';
  import { formatMoney } from '../../../lib/util/money';
  import { formatDateKey } from '../../../lib/util/dates';
  import type { FinanceCategory } from '../../../lib/db/schema';

  let sum = $state<PeriodSummary | null>(null);
  let cats = $state<Map<string, FinanceCategory>>(new Map());
  const currency = $derived(app.settings?.currency ?? 'USD');

  $effect(() => {
    void changes.version;
    const d = clock.today;
    const cur = currency;
    void monthSummary(cur, d).then((s) => { sum = s; });
    void listCategories().then((c) => { cats = new Map(c.map((x) => [x.id, x])); });
  });

  const money = (m: number) => formatMoney(m, currency);
  const top = $derived(sum ? sum.byCategory.slice(0, 4) : []);
  const month = $derived(formatDateKey(clock.today, { month: 'long' }));
</script>

<WidgetCard title="This month" module="finance" loaded={!!sum}>
  {#snippet actions()}<Button size="sm" variant="ghost" onclick={() => openQuick('transaction')} aria-label="Record money">{#snippet icon()}<Plus />{/snippet}</Button>{/snippet}
  {#if sum}
    {#if sum.count === 0}
      <EmptyState compact title="No money recorded in {month}" body="Record income and spending to see where it goes.">
        {#snippet icon()}<Wallet />{/snippet}
        {#snippet action()}<Button size="sm" variant="primary" onclick={() => openQuick('transaction')}>{#snippet icon()}<Plus />{/snippet}Record spending</Button>{/snippet}
      </EmptyState>
    {:else}
      <div class="spent"><span class="lbl">Spent</span><span class="big num">{money(sum.expenseMinor)}</span></div>
      <div class="stats">
        <div><span class="lbl">Income</span><span class="num">{money(sum.incomeMinor)}</span></div>
        <div><span class="lbl">Saved</span><span class="num">{money(sum.savingMinor)}</span></div>
        <div><span class="lbl">Left</span><span class="num" class:neg={sum.balanceMinor < 0}>{money(sum.balanceMinor)}</span></div>
      </div>
      {#if top.length}
        <ul class="cats" aria-label="Top spending categories">
          {#each top as c (c.categoryId ?? 'none')}
            {@const cat = c.categoryId ? cats.get(c.categoryId) : undefined}
            <li>
              <span class="name">{cat?.name ?? 'Uncategorised'}</span>
              <span class="track" aria-hidden="true"><span style="width:{(c.amountMinor / sum.expenseMinor) * 100}%;background:{cat?.color ?? 'var(--text-3)'}"></span></span>
              <span class="num amt">{money(c.amountMinor)}</span>
            </li>
          {/each}
        </ul>
      {/if}
      {#if sum.otherCurrencyCount}<p class="meta">{sum.otherCurrencyCount} transaction{sum.otherCurrencyCount === 1 ? '' : 's'} in other currencies not included.</p>{/if}
    {/if}
  {/if}
</WidgetCard>

<style>
  .spent { display: grid; gap: 2px; margin-bottom: var(--space-3); }
  .stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-3); margin-bottom: var(--space-4); padding: var(--space-3); border-radius: var(--radius-md); background: var(--surface-2); }
  .stats .num { overflow-wrap: anywhere; }
  .stats > div { display: grid; gap: 2px; }
  .lbl { font-size: var(--text-xs); font-weight: 650; color: var(--text-2); text-transform: uppercase; letter-spacing: .06em; }
  .stats .num { font-weight: 650; }
  .big { font-family: var(--font-display); font-size: var(--text-2xl); font-weight: var(--display-weight); line-height: 1.1; }
  .neg { color: var(--danger); }
  .cats { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-2); }
  .cats li { display: grid; grid-template-columns: minmax(80px, 1fr) 2fr auto; align-items: center; gap: var(--space-3); font-size: var(--text-sm); }
  .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .track { height: 8px; border-radius: 99px; background: var(--surface-3); overflow: hidden; }
  .track span { display: block; height: 100%; border-radius: inherit; animation: grow var(--dur-slow) var(--ease-out); }
  @keyframes grow { from { width: 0 !important; } }
  .amt { color: var(--text-2); }
</style>
