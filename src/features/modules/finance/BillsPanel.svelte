<script lang="ts">
  // Bills & subscriptions: what repeats, what is due soon, and what it all costs per month and per year.
  import { CalendarClock, CalendarDays, Pencil, Receipt, Repeat, TrendingUp } from '@lucide/svelte';
  import Button from '../../../lib/ui/Button.svelte';
  import IconButton from '../../../lib/ui/IconButton.svelte';
  import EmptyState from '../../../lib/ui/EmptyState.svelte';
  import { toast } from '../../../lib/ui/toast.svelte';
  import { changes } from '../../../lib/db/changes.svelte';
  import { clock } from '../../../lib/clock.svelte';
  import { app } from '../../../lib/app.svelte';
  import { openQuick } from '../../quick/quick.svelte';
  import { billTotals, CADENCE_LABEL, dueText, loadBillViews, payBill, undoPayBill, type BillView } from '../../../lib/domain/bills';
  import { getAll } from '../../../lib/db/idb';
  import { formatMoney } from '../../../lib/util/money';
  import { formatDateKey } from '../../../lib/util/dates';
  import type { FinanceCategory } from '../../../lib/db/schema';

  let views = $state.raw<BillView[] | null>(null);
  let cats = $state.raw<Map<string, FinanceCategory>>(new Map());
  let busy = $state<string | null>(null);

  const currency = $derived(app.settings?.currency ?? 'USD');
  $effect(() => {
    void changes.version;
    const on = clock.today;
    void loadBillViews(on).then((v) => { views = v; });
    void getAll('finance_categories').then((c) => { cats = new Map(c.map((x) => [x.id, x])); });
  });

  const totals = $derived(views ? billTotals(views, currency) : []);
  const main = $derived(totals[0]);
  const others = $derived(totals.slice(1).filter((t) => t.activeCount > 0));
  const money = (m: number, c: string = currency) => formatMoney(m, c);
  const day = (d: string) => formatDateKey(d, { day: 'numeric', month: 'short', year: d.slice(0, 4) === clock.today.slice(0, 4) ? undefined : 'numeric' });
  const hue = (s: string) => { let h = 0; for (const ch of s.toLocaleLowerCase()) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; };

  async function pay(v: BillView) {
    if (busy) return;
    busy = v.bill.id;
    try {
      const p = await payBill(v.bill.id, clock.today);
      toast(`${v.bill.name} paid — ${money(v.bill.amountMinor, v.bill.currency)} recorded as an expense`, { tone: 'success', action: { label: 'Undo', run: () => void undoPayBill(p) } });
    } catch (err) { toast(err instanceof Error ? err.message : 'Could not record the payment.', { tone: 'danger' }); }
    finally { busy = null; }
  }
</script>

{#if views}
  <section class="hero" aria-label="Bills summary">
    <div class="stat m"><span class="ico" aria-hidden="true"><Repeat size={18} /></span><span class="l">Per month</span><span class="v num">{money(main?.monthlyMinor ?? 0)}</span><span class="s">{main?.activeCount ?? 0} active {main?.activeCount === 1 ? 'bill' : 'bills'}</span></div>
    <div class="stat d" class:hot={(main?.dueSoonCount ?? 0) > 0}><span class="ico" aria-hidden="true"><CalendarClock size={18} /></span><span class="l">Due in the next 7 days</span><span class="v num">{money(main?.dueSoonMinor ?? 0)}</span><span class="s">{main?.dueSoonCount ? `${main.dueSoonCount} ${main.dueSoonCount === 1 ? 'bill' : 'bills'} coming up` : 'Nothing due this week'}</span></div>
    <div class="stat y"><span class="ico" aria-hidden="true"><TrendingUp size={18} /></span><span class="l">Per year</span><span class="v num">{money(main?.yearlyMinor ?? 0)}</span><span class="s">what these add up to</span></div>
  </section>
  {#if others.length}
    <ul class="others" aria-label="Other currencies">
      {#each others as o (o.currency)}<li><span class="cur">{o.currency}</span><span>{money(o.monthlyMinor, o.currency)} / month</span><span>{money(o.yearlyMinor, o.currency)} / year</span></li>{/each}
    </ul>
  {/if}

  {#if views.length === 0}
    <div class="card"><EmptyState title="No bills or subscriptions yet" body="Add rent, subscriptions and anything else that repeats. You'll see what's due soon and what it all costs in a year.">
      {#snippet icon()}<Receipt />{/snippet}
      {#snippet action()}<Button variant="primary" onclick={() => openQuick('bill')}>Add a bill</Button>{/snippet}
    </EmptyState></div>
  {:else}
    <ul class="bills" aria-label="Bills and subscriptions">
      {#each views as v (v.bill.id)}
        {@const b = v.bill}
        {@const cat = b.categoryId ? cats.get(b.categoryId) : undefined}
        <li class="bill {v.status}">
          <span class="av" style="--h:{hue(b.name)}" aria-hidden="true">{(b.name.trim()[0] ?? '?').toLocaleUpperCase()}</span>
          <div class="who">
            <span class="n">{b.name}</span>
            <span class="sub"><span class="chip">{CADENCE_LABEL[b.cadence]}</span>{#if cat}<span class="cat"><i style="background:{cat.color}"></i>{cat.name}</span>{/if}{#if b.note}<span class="nt">{b.note}</span>{/if}</span>
          </div>
          <div class="when" class:late={v.status === 'overdue'} class:soon={v.status === 'soon'}>
            <span class="dt"><CalendarDays size={13} aria-hidden="true" />{dueText(v)}</span>
            {#if v.status !== 'paused'}<span class="dd">{day(b.nextDue)}</span>{/if}
          </div>
          <div class="amt"><span class="a num">{money(b.amountMinor, b.currency)}</span>{#if b.cadence !== 'monthly'}<span class="mo">≈ {money(v.monthlyMinor, b.currency)} / mo</span>{/if}</div>
          <div class="acts">
            {#if v.status !== 'paused'}<Button size="sm" loading={busy === b.id} onclick={() => pay(v)}>Mark paid</Button>{/if}
            <IconButton label="Edit {b.name}" onclick={() => openQuick('bill', { bill: $state.snapshot(b) })}><Pencil size={16} /></IconButton>
          </div>
        </li>
      {/each}
    </ul>
    <p class="note">“Mark paid” records the expense in your transactions and moves the bill to its next date.</p>
  {/if}
{/if}

<style>
  .hero { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-3); margin-bottom: var(--space-3); }
  @media (max-width: 700px) { .hero { grid-template-columns: 1fr; } }
  .stat { position: relative; overflow: hidden; background: var(--surface); border: var(--card-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-1); padding: var(--space-4); display: grid; gap: 2px; align-content: start; --c: var(--accent); }
  .stat::before { content: ''; position: absolute; inset: 0; background: radial-gradient(120% 90% at 100% 0%, color-mix(in srgb, var(--c) 16%, transparent), transparent 62%); pointer-events: none; }
  .stat.d { --c: var(--info); } .stat.d.hot { --c: var(--warning); } .stat.y { --c: var(--mod-finance); }
  .ico { width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; color: var(--c); background: color-mix(in srgb, var(--c) 16%, transparent); margin-bottom: 6px; }
  .l { font-size: var(--text-xs); font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--text-2); }
  .v { font-family: var(--font-display); font-weight: var(--display-weight); font-size: var(--text-2xl); overflow-wrap: anywhere; }
  .s { font-size: var(--text-xs); color: var(--text-3); }
  .others { list-style: none; margin: 0 0 var(--space-4); padding: 0; display: grid; gap: 4px; font-size: var(--text-sm); color: var(--text-2); }
  .others li { display: flex; gap: var(--space-4); flex-wrap: wrap; } .cur { font-weight: 800; letter-spacing: .05em; color: var(--text); }
  .card { background: var(--surface); border: var(--card-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-1); padding: var(--space-4) var(--space-5); }
  .bills { list-style: none; margin: var(--space-4) 0 var(--space-3); padding: 0; display: grid; gap: var(--space-2); }
  .bill { display: grid; grid-template-columns: 40px minmax(0, 1.6fr) minmax(0, 1fr) auto auto; align-items: center; gap: var(--space-3); background: var(--surface); border: var(--card-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-1); padding: var(--space-3) var(--space-4); }
  .bill.overdue { border-color: color-mix(in srgb, var(--danger) 45%, var(--border)); }
  .bill.paused { opacity: .6; }
  .av { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; font-weight: 800; color: hsl(var(--h) 70% 38%); background: hsl(var(--h) 80% 55% / .18); border: 1px solid hsl(var(--h) 70% 50% / .35); }
  :global(:root[data-theme='dark']) .av, :global(:root[data-theme='ink']) .av, :global(:root[data-theme='nebula']) .av { color: hsl(var(--h) 85% 76%); }
  .who { display: grid; gap: 3px; min-width: 0; }
  .n { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sub { display: flex; gap: 6px 10px; align-items: center; flex-wrap: wrap; font-size: var(--text-xs); color: var(--text-3); }
  .chip { font-weight: 700; padding: 1px 8px; border-radius: 99px; background: var(--surface-3); color: var(--text-2); }
  .cat { display: inline-flex; align-items: center; gap: 5px; } .cat i { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
  .nt { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 160px; }
  .when { display: grid; gap: 1px; font-size: var(--text-sm); }
  .dt { display: inline-flex; align-items: center; gap: 5px; font-weight: 650; color: var(--text-2); }
  .when.late .dt { color: var(--danger); } .when.soon .dt { color: var(--warning); }
  .dd { font-size: var(--text-xs); color: var(--text-3); }
  .amt { text-align: right; display: grid; }
  .a { font-weight: 750; } .mo { font-size: var(--text-xs); color: var(--text-3); }
  .acts { display: flex; align-items: center; gap: 2px; }
  .note { margin: 0 0 var(--space-6); font-size: var(--text-xs); color: var(--text-3); }
  @media (max-width: 760px) {
    .bill { grid-template-columns: 40px minmax(0, 1fr) auto; grid-template-areas: 'av who amt' 'when when acts'; row-gap: var(--space-2); }
    .av { grid-area: av; } .who { grid-area: who; } .amt { grid-area: amt; } .when { grid-area: when; } .acts { grid-area: acts; justify-self: end; }
  }
</style>
