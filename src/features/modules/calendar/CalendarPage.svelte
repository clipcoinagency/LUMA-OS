<script lang="ts">
  // Month grid with events + the selected day's full history: everything recorded on that date
  // across every enabled module, reconstructed from each record's own dated row (nothing is ever
  // stored "for today" and overwritten — see docs/PHASE-0-ARCHITECTURE.md). Past/today show the
  // full reconstruction; future days show only planned events, since nothing has happened yet.
  import { Plus, CalendarDays, ChevronLeft, ChevronRight } from '@lucide/svelte';
  import PageHeader from '../PageHeader.svelte';
  import Button from '../../../lib/ui/Button.svelte';
  import IconButton from '../../../lib/ui/IconButton.svelte';
  import MonthNav from '../../../lib/ui/MonthNav.svelte';
  import MonthGrid from '../../../lib/ui/MonthGrid.svelte';
  import EmptyState from '../../../lib/ui/EmptyState.svelte';
  import DayHistoryPanel from './DayHistoryPanel.svelte';
  import { changes } from '../../../lib/db/changes.svelte';
  import { clock } from '../../../lib/clock.svelte';
  import { app } from '../../../lib/app.svelte';
  import { openQuick } from '../../quick/quick.svelte';
  import { getAll } from '../../../lib/db/idb';
  import { activityDays, dayFromAggregate, loadMonthAggregate, type DeepAggregate } from '../../../lib/domain/history';
  import { addDays, endOfMonth, formatDateKey, fromDateKey, startOfMonth, type DateKey } from '../../../lib/util/dates';
  import type { FinanceCategory } from '../../../lib/db/schema';

  let month = $state(startOfMonth(clock.today));
  let selected = $state<DateKey>(clock.today);
  let agg = $state.raw<DeepAggregate | null>(null);
  let categories = $state<Map<string, FinanceCategory>>(new Map());

  const enabledModules = $derived(app.workspace!.enabledModules);
  const weekStartsOn = $derived(app.settings?.weekStartsOn ?? 1);

  // One set of range queries per visible month (padded a week either side, plus a fortnight ahead
  // for upcoming events) — cheap even with a year of history (Phase 0: ~60ms for a month on 21k rows).
  $effect(() => {
    void changes.version;
    const from = addDays(startOfMonth(month), -7), to = addDays(endOfMonth(month), 14);
    const mods = enabledModules;
    void loadMonthAggregate(from, to, mods).then((a) => { agg = a; });
  });
  $effect(() => { void changes.version; void getAll('finance_categories').then((c) => { categories = new Map(c.map((x) => [x.id, x])); }); });

  const dots = $derived(agg ? activityDays(agg) : new Set<DateKey>());
  const eventsByDay = $derived.by(() => {
    const m = new Map<string, number>();
    for (const e of agg?.events ?? []) m.set(e.date, (m.get(e.date) ?? 0) + 1);
    return m;
  });
  const history = $derived(agg ? dayFromAggregate(selected, agg, weekStartsOn) : null);
  const currency = $derived(app.settings?.currency ?? 'USD');

  function time(t: string | null) {
    if (!t) return '';
    const [h, mm] = t.split(':').map(Number) as [number, number];
    const d = fromDateKey(selected);
    d.setHours(h, mm);
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(d);
  }
  function pick(d: DateKey) {
    selected = d;
    if (d.slice(0, 7) !== month.slice(0, 7)) month = startOfMonth(d);
  }
  function shiftDay(n: number) {
    pick(addDays(selected, n));
  }
  const dayEvents = $derived((agg?.events ?? []).filter((e) => e.date === selected).sort((a, b) =>
    Number(b.allDay) - Number(a.allDay) || (a.startTime ?? '').localeCompare(b.startTime ?? '')));
</script>

<PageHeader module="calendar">
  {#snippet actions()}<Button variant="primary" onclick={() => openQuick('event', { date: selected })}>{#snippet icon()}<Plus />{/snippet}Add event</Button>{/snippet}
</PageHeader>

<div class="layout">
  <section class="cal card" aria-label="Month">
    <div class="nav"><MonthNav {month} today={clock.today} onchange={(m) => { month = m; selected = m === startOfMonth(clock.today) ? clock.today : m; }} /></div>
    <MonthGrid {month} today={clock.today} {selected} {weekStartsOn} label="Calendar for {formatDateKey(month, { month: 'long', year: 'numeric' })}" onselect={pick}>
      {#snippet cell(d)}
        {@const n = eventsByDay.get(d) ?? 0}
        {@const hasHistory = dots.has(d)}
        {#if n > 0}<span class="chip">{n} event{n === 1 ? '' : 's'}</span>{/if}
        {#if n > 0 || hasHistory}
          <span class="dotrow" aria-hidden="true">
            {#if n > 0}<span class="dotm event"></span>{/if}
            {#if hasHistory}<span class="dotm history"></span>{/if}
          </span>
        {/if}
        {#if n > 0 || hasHistory}<span class="sr-only">{n > 0 ? `${n} event${n === 1 ? '' : 's'}. ` : ''}{hasHistory ? 'Has recorded history.' : ''}</span>{/if}
      {/snippet}
    </MonthGrid>
  </section>

  <section class="day card" aria-labelledby="day-h">
    <header>
      <IconButton label="Previous day" onclick={() => shiftDay(-1)}><ChevronLeft /></IconButton>
      <div class="dtitle">
        <h2 id="day-h">{selected === clock.today ? 'Today' : formatDateKey(selected, { weekday: 'long' })}</h2>
        <p class="meta">{formatDateKey(selected, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>
      <IconButton label="Next day" onclick={() => shiftDay(1)}><ChevronRight /></IconButton>
    </header>

    {#if dayEvents.length === 0 && history?.isFuture}
      <EmptyState compact title="Nothing planned" body="Add an event for this day.">{#snippet icon()}<CalendarDays />{/snippet}</EmptyState>
    {:else}
      {#if dayEvents.length > 0}
        <ul class="agenda">
          {#each dayEvents as e (e.id)}
            <li>
              <button type="button" onclick={() => openQuick('event', { event: $state.snapshot(e) })}>
                <span class="when">{e.allDay ? 'All day' : `${time(e.startTime)}${e.endTime ? ` – ${time(e.endTime)}` : ''}`}</span>
                <span class="title">{e.title}</span>
                {#if e.notes}<span class="notes">{e.notes}</span>{/if}
              </button>
            </li>
          {/each}
        </ul>
      {/if}
      {#if history && !history.isFuture}
        <div class="hist" class:pad={dayEvents.length > 0}>
          <DayHistoryPanel {history} {enabledModules} {currency} {categories} />
        </div>
      {:else if dayEvents.length === 0}
        <EmptyState compact title="Nothing planned yet" body="Add an event for this day.">{#snippet icon()}<CalendarDays />{/snippet}</EmptyState>
      {/if}
    {/if}
  </section>
</div>

<style>
  .layout { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: var(--space-4); align-items: start; }
  @media (max-width: 1100px) { .layout { grid-template-columns: 1fr; } }
  .card { background: var(--surface); border: var(--card-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-1); padding: var(--space-4); }
  .nav { margin-bottom: var(--space-3); }
  .chip { font-size: 11px; line-height: 1.3; padding: 1px 5px; border-radius: 4px; background: color-mix(in srgb, var(--mod-calendar) 18%, transparent); color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dotrow { display: none; gap: 3px; margin-top: auto; }
  .dotm { width: 6px; height: 6px; border-radius: 50%; }
  .dotm.event { background: var(--mod-calendar); }
  .dotm.history { background: var(--text-3); }
  @media (max-width: 640px) { .chip { display: none; } .dotrow { display: flex; } }
  .day header { display: flex; align-items: center; gap: var(--space-1); margin-bottom: var(--space-4); }
  .dtitle { flex: 1; text-align: center; min-width: 0; }
  .agenda { list-style: none; margin: 0 0 var(--space-4); padding: 0; display: grid; gap: var(--space-2); }
  .agenda button { width: 100%; text-align: left; display: grid; gap: 2px; padding: var(--space-3); border-radius: var(--radius-md); border: 0; border-left: 3px solid var(--mod-calendar); background: var(--surface-2); color: var(--text); cursor: pointer; }
  .agenda button:hover { background: var(--surface-3); }
  .when { font-size: var(--text-xs); font-weight: 700; color: var(--text-2); }
  .title { font-weight: 650; }
  .notes { font-size: var(--text-sm); color: var(--text-2); }
  .hist.pad { padding-top: var(--space-2); border-top: 1px solid var(--border); }
</style>
