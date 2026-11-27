<script lang="ts">
  // The Debts tracker: money you borrowed (you owe) and money you lent (they owe you), per person, with
  // repayments, due dates and a running balance. Everything is derived from the debt + repayment rows.
  import { ArrowDownLeft, ArrowUpRight, CalendarClock, ChevronDown, HandCoins, Pencil, Plus, Trash2, CheckCheck, Scale } from '@lucide/svelte';
  import Button from '../../../lib/ui/Button.svelte';
  import Segmented from '../../../lib/ui/Segmented.svelte';
  import IconButton from '../../../lib/ui/IconButton.svelte';
  import EmptyState from '../../../lib/ui/EmptyState.svelte';
  import ProgressBar from '../../../lib/ui/ProgressBar.svelte';
  import PaymentForm from './PaymentForm.svelte';
  import { toast } from '../../../lib/ui/toast.svelte';
  import { changes } from '../../../lib/db/changes.svelte';
  import { clock } from '../../../lib/clock.svelte';
  import { app } from '../../../lib/app.svelte';
  import { openQuick } from '../../quick/quick.svelte';
  import { deletePayment, dueLabel, loadDebtViews, personBalances, restorePayment, settleInFull, totalsByCurrency, type DebtView } from '../../../lib/domain/debts';
  import { formatMoney } from '../../../lib/util/money';
  import { formatDateKey } from '../../../lib/util/dates';

  let views = $state.raw<DebtView[] | null>(null);
  let filter = $state('open');
  let paying = $state<DebtView | null>(null);
  let payOpen = $state(false);
  let openIds = $state<Record<string, boolean>>({});

  const currency = $derived(app.settings?.currency ?? 'USD');
  $effect(() => {
    void changes.version;
    const on = clock.today;
    void loadDebtViews(on).then((v) => { views = v; });
  });

  const totals = $derived(views ? totalsByCurrency(views, currency) : []);
  const main = $derived(totals[0]);
  const others = $derived(totals.slice(1));
  const people = $derived(views ? personBalances(views) : []);
  const counts = $derived({
    open: views?.filter((v) => v.status !== 'settled').length ?? 0,
    owe: views?.filter((v) => v.status !== 'settled' && v.debt.direction === 'owe').length ?? 0,
    owed: views?.filter((v) => v.status !== 'settled' && v.debt.direction === 'owed').length ?? 0,
    settled: views?.filter((v) => v.status === 'settled').length ?? 0,
  });
  const shown = $derived((views ?? []).filter((v) => filter === 'settled' ? v.status === 'settled' : v.status !== 'settled' && (filter === 'open' || v.debt.direction === filter)));
  // the split bar: how the open balance divides between "you owe" and "owed to you" (preferred currency)
  const splitPct = $derived(main && main.oweMinor + main.owedMinor > 0 ? Math.round((main.owedMinor / (main.oweMinor + main.owedMinor)) * 100) : null);

  const money = (m: number, c: string = currency) => formatMoney(m, c);
  const day = (d: string) => formatDateKey(d, { day: 'numeric', month: 'short', year: d.slice(0, 4) === clock.today.slice(0, 4) ? undefined : 'numeric' });
  const hue = (s: string) => { let h = 0; for (const ch of s.toLocaleLowerCase()) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; };
  const initial = (s: string) => (s.trim()[0] ?? '?').toLocaleUpperCase();

  function pay(v: DebtView) { paying = v; payOpen = true; }
  async function settle(v: DebtView) {
    const p = await settleInFull(v.debt.id);
    if (p) toast(v.debt.direction === 'owe' ? `Settled with ${v.debt.person}` : `${v.debt.person} is all paid up`, { tone: 'success', action: { label: 'Undo', run: () => void deletePayment(p.id) } });
  }
  async function dropPayment(id: string) {
    const gone = await deletePayment(id);
    if (gone) toast('Repayment removed', { action: { label: 'Undo', run: () => void restorePayment(gone) } });
  }
</script>

{#if views}
  <section class="hero" aria-label="Debt summary">
    <div class="stat owe">
      <span class="ico" aria-hidden="true"><ArrowUpRight size={18} /></span>
      <span class="l">You owe</span>
      <span class="v num">{money(main?.oweMinor ?? 0)}</span>
      <span class="s">{counts.owe} open {counts.owe === 1 ? 'debt' : 'debts'}</span>
    </div>
    <div class="stat owed">
      <span class="ico" aria-hidden="true"><ArrowDownLeft size={18} /></span>
      <span class="l">Owed to you</span>
      <span class="v num">{money(main?.owedMinor ?? 0)}</span>
      <span class="s">{counts.owed} open {counts.owed === 1 ? 'debt' : 'debts'}</span>
    </div>
    <div class="stat net" class:neg={(main?.netMinor ?? 0) < 0}>
      <span class="ico" aria-hidden="true"><Scale size={18} /></span>
      <span class="l">Net position</span>
      <span class="v num">{(main?.netMinor ?? 0) > 0 ? '+' : ''}{money(main?.netMinor ?? 0)}</span>
      <span class="s">{(main?.netMinor ?? 0) === 0 ? 'All square' : (main?.netMinor ?? 0) > 0 ? 'More is owed to you' : 'You owe more than you are owed'}</span>
    </div>
    {#if splitPct !== null}
      <div class="split" role="img" aria-label="{splitPct}% of the open balance is owed to you, {100 - splitPct}% is owed by you">
        <span class="bar"><span class="a" style="width:{100 - splitPct}%"></span><span class="b" style="width:{splitPct}%"></span></span>
        <span class="legend"><span class="la">You owe {100 - splitPct}%</span><span class="lb">Owed to you {splitPct}%</span></span>
      </div>
    {/if}
  </section>
  {#if others.some((o) => o.openCount > 0)}
    <ul class="others" aria-label="Other currencies">
      {#each others.filter((o) => o.openCount > 0) as o (o.currency)}
        <li><span class="cur">{o.currency}</span>{#if o.oweMinor}<span>you owe <b class="num">{money(o.oweMinor, o.currency)}</b></span>{/if}{#if o.owedMinor}<span>owed to you <b class="num">{money(o.owedMinor, o.currency)}</b></span>{/if}</li>
      {/each}
    </ul>
  {/if}

  {#if views.length === 0}
    <div class="card empty">
      <EmptyState title="No debts tracked" body="Keep track of money you have borrowed, money you have lent, and what has been paid back.">
        {#snippet icon()}<HandCoins />{/snippet}
        {#snippet action()}
          <Button variant="primary" onclick={() => openQuick('debt', { direction: 'owe' })}>{#snippet icon()}<ArrowUpRight />{/snippet}I owe someone</Button>
          <Button onclick={() => openQuick('debt', { direction: 'owed' })}>{#snippet icon()}<ArrowDownLeft />{/snippet}Someone owes me</Button>
        {/snippet}
      </EmptyState>
    </div>
  {:else}
    {#if people.length > 0}
      <section class="card" aria-labelledby="ppl-h">
        <h2 id="ppl-h">By person</h2>
        <ul class="ppl">
          {#each people as p (p.person.toLocaleLowerCase() + p.currency)}
            <li>
              <span class="av" style="--h:{hue(p.person)}" aria-hidden="true">{initial(p.person)}</span>
              <span class="pn">{p.person}</span>
              <span class="pd">{p.netMinor > 0 ? 'owes you' : 'you owe'}</span>
              <span class="pa num" class:pos={p.netMinor > 0} class:neg={p.netMinor < 0}>{money(Math.abs(p.netMinor), p.currency)}</span>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <div class="listbar">
      <h2 id="dl-h">Debts</h2>
      <Segmented label="Show debts" size="sm" bind:value={filter} options={[
        { value: 'open', label: `Open · ${counts.open}` }, { value: 'owe', label: `I owe · ${counts.owe}` }, { value: 'owed', label: `Owed to me · ${counts.owed}` }, { value: 'settled', label: `Settled · ${counts.settled}` },
      ]} />
    </div>

    {#if shown.length === 0}
      <div class="card"><EmptyState compact title={filter === 'settled' ? 'Nothing settled yet' : 'Nothing here'} body={filter === 'settled' ? 'Debts that are paid off in full are kept here.' : 'No open debts in this view.'}>{#snippet icon()}<CheckCheck />{/snippet}</EmptyState></div>
    {/if}

    <ul class="debts" aria-labelledby="dl-h">
      {#each shown as v (v.debt.id)}
        {@const d = v.debt}
        {@const due = dueLabel(v)}
        <li class="debt {d.direction} {v.status}">
          <div class="top">
            <span class="av" style="--h:{hue(d.person)}" aria-hidden="true">{initial(d.person)}</span>
            <div class="who">
              <span class="pn">{d.person}</span>
              <span class="sub">
                <span class="dir">{d.direction === 'owe' ? 'You owe' : 'Owes you'}</span>
                <span aria-hidden="true">·</span><span>{d.direction === 'owe' ? 'borrowed' : 'lent'} {day(d.date)}</span>
                {#if d.note}<span aria-hidden="true">·</span><span class="nt">{d.note}</span>{/if}
              </span>
            </div>
            <div class="amt">
              <span class="bal num">{v.status === 'settled' ? money(d.amountMinor, d.currency) : money(v.balanceMinor, d.currency)}</span>
              <span class="of">{#if v.status === 'settled'}settled {d.settledOn ? day(d.settledOn) : ''}{:else if v.paidMinor > 0}left of {money(d.amountMinor, d.currency)}{:else}to {d.direction === 'owe' ? 'pay back' : 'collect'}{/if}</span>
            </div>
          </div>
          <ProgressBar value={Math.round(v.progress * 100)} label="{d.person}: {Math.round(v.progress * 100)}% repaid" color={d.direction === 'owe' ? 'var(--warning)' : 'var(--success)'} height={7} />
          <div class="foot">
            {#if due}<span class="due" class:late={v.status === 'overdue'}><CalendarClock size={13} aria-hidden="true" />{due}{#if d.dueDate}<span class="dd"> · {day(d.dueDate)}</span>{/if}</span>{/if}
            <span class="pct">{Math.round(v.progress * 100)}% repaid</span>
            <span class="acts">
              {#if v.status !== 'settled'}
                <Button size="sm" onclick={() => pay(v)}>{d.direction === 'owe' ? 'Pay' : 'Received'}</Button>
                <Button size="sm" variant="ghost" onclick={() => settle(v)}>Settle</Button>
              {/if}
              <IconButton label="Edit debt with {d.person}" onclick={() => openQuick('debt', { debt: $state.snapshot(d) })}><Pencil size={16} /></IconButton>
              <IconButton label="{openIds[d.id] ? 'Hide' : 'Show'} repayments for {d.person}" aria-expanded={!!openIds[d.id]} onclick={() => (openIds[d.id] = !openIds[d.id])}><span class="chev" class:up={openIds[d.id]}><ChevronDown size={16} /></span></IconButton>
            </span>
          </div>
          {#if openIds[d.id]}
            <div class="hist">
              {#if v.payments.length === 0}<p class="meta">No repayments yet.</p>{/if}
              <ul>
                {#each v.payments as p (p.id)}
                  <li><span class="pdt">{day(p.date)}</span><span class="pnote">{p.note || (d.direction === 'owe' ? 'You paid' : 'You received')}</span><span class="pam num">{money(p.amountMinor, d.currency)}</span>
                    <IconButton label="Remove the {money(p.amountMinor, d.currency)} repayment of {day(p.date)}" onclick={() => dropPayment(p.id)}><Trash2 size={14} /></IconButton></li>
                {/each}
              </ul>
              <p class="meta">Started {day(d.date)} · {money(d.amountMinor, d.currency)}</p>
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
{/if}

<PaymentForm bind:open={payOpen} view={paying} />

<style>
  .hero { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-3); margin-bottom: var(--space-3); }
  @media (max-width: 700px) { .hero { grid-template-columns: 1fr; } }
  .stat { position: relative; overflow: hidden; background: var(--surface); border: var(--card-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-1); padding: var(--space-4); display: grid; gap: 2px; align-content: start; --c: var(--text-2); }
  .stat::before { content: ''; position: absolute; inset: 0; background: radial-gradient(120% 90% at 100% 0%, color-mix(in srgb, var(--c) 16%, transparent), transparent 62%); pointer-events: none; }
  .stat.owe { --c: var(--warning); } .stat.owed { --c: var(--success); } .stat.net { --c: var(--accent); } .stat.net.neg { --c: var(--warning); }
  .ico { width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; color: var(--c); background: color-mix(in srgb, var(--c) 16%, transparent); margin-bottom: 6px; }
  .l { font-size: var(--text-xs); font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--text-2); }
  .v { font-family: var(--font-display); font-weight: var(--display-weight); font-size: var(--text-2xl); overflow-wrap: anywhere; }
  .s { font-size: var(--text-xs); color: var(--text-3); }
  .split { grid-column: 1 / -1; display: grid; gap: 6px; }
  .bar { display: flex; height: 10px; border-radius: 99px; overflow: hidden; background: var(--surface-3); gap: 2px; }
  .bar .a { background: var(--warning); } .bar .b { background: var(--success); }
  .bar span { display: block; height: 100%; transition: width var(--dur-xslow) var(--ease-glide); }
  .legend { display: flex; justify-content: space-between; font-size: var(--text-xs); font-weight: 650; }
  .la { color: var(--warning); } .lb { color: var(--success); }
  .others { list-style: none; margin: 0 0 var(--space-4); padding: 0; display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-4); font-size: var(--text-sm); color: var(--text-2); }
  .others li { display: flex; gap: var(--space-2); align-items: baseline; flex-wrap: wrap; }
  .cur { font-weight: 800; letter-spacing: .05em; color: var(--text); }
  .card { background: var(--surface); border: var(--card-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-1); padding: var(--space-4) var(--space-5); margin-bottom: var(--space-4); }
  .card h2 { font-size: var(--text-md); margin-bottom: var(--space-3); }
  .ppl { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); gap: var(--space-2) var(--space-5); }
  .ppl li { display: flex; align-items: center; gap: var(--space-3); min-width: 0; padding: 6px 0; }
  .ppl .pn { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
  .pd { font-size: var(--text-xs); color: var(--text-3); }
  .pa { font-weight: 700; } .pa.pos { color: var(--success); } .pa.neg { color: var(--warning); }
  .av { flex: none; width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; font-weight: 800; font-size: var(--text-sm); color: hsl(var(--h) 70% 38%); background: hsl(var(--h) 80% 55% / .18); border: 1px solid hsl(var(--h) 70% 50% / .35); }
  :global(:root[data-theme='dark']) .av, :global(:root[data-theme='graphite']) .av, :global(:root[data-theme='ink']) .av, :global(:root[data-theme='nebula']) .av { color: hsl(var(--h) 85% 76%); }
  .listbar { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); flex-wrap: wrap; margin: var(--space-5) 0 var(--space-3); }
  .listbar h2 { font-size: var(--text-md); margin: 0; }
  .debts { list-style: none; margin: 0 0 var(--space-6); padding: 0; display: grid; gap: var(--space-3); }
  .debt { position: relative; background: var(--surface); border: var(--card-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-1); padding: var(--space-4) var(--space-5); display: grid; gap: var(--space-3); border-left: 3px solid var(--warning); }
  .debt.owed { border-left-color: var(--success); }
  .debt.settled { opacity: .72; border-left-color: var(--border-strong); }
  .debt.overdue { border-color: color-mix(in srgb, var(--danger) 45%, var(--border)); border-left-color: var(--danger); }
  .top { display: flex; align-items: center; gap: var(--space-3); }
  .who { flex: 1; min-width: 0; display: grid; gap: 2px; }
  .who .pn { font-weight: 700; font-size: var(--text-md); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sub { display: flex; flex-wrap: wrap; gap: 4px 6px; font-size: var(--text-xs); color: var(--text-3); }
  .dir { font-weight: 700; color: var(--warning); } .owed .dir { color: var(--success); } .settled .dir { color: var(--text-3); }
  .nt { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 220px; }
  .amt { text-align: right; display: grid; gap: 0; flex: none; }
  .bal { font-family: var(--font-display); font-weight: var(--display-weight); font-size: var(--text-xl); }
  .of { font-size: var(--text-xs); color: var(--text-3); }
  .foot { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; font-size: var(--text-xs); color: var(--text-3); }
  .due { display: inline-flex; align-items: center; gap: 4px; font-weight: 700; color: var(--text-2); }
  .due.late { color: var(--danger); }
  .dd { font-weight: 500; color: var(--text-3); }
  .acts { margin-left: auto; display: flex; align-items: center; gap: 2px; flex-wrap: wrap; }
  .chev { display: grid; transition: transform var(--dur) var(--ease-out); } .chev.up { transform: rotate(180deg); }
  .hist { border-top: 1px solid var(--border); padding-top: var(--space-3); display: grid; gap: var(--space-2); }
  .hist ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
  .hist li { display: grid; grid-template-columns: 90px 1fr auto auto; align-items: center; gap: var(--space-3); font-size: var(--text-sm); min-height: 36px; }
  .pdt { color: var(--text-3); } .pnote { color: var(--text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .pam { font-weight: 650; }
  .meta { margin: 0; font-size: var(--text-xs); color: var(--text-3); }
  @media (max-width: 520px) { .top { flex-wrap: wrap; } .amt { width: 100%; text-align: left; } .acts { margin-left: 0; width: 100%; } }
</style>
