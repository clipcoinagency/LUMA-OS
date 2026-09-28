<script lang="ts">
  // Month grid with events + the selected day's agenda. Phase 5 adds every module's records to the day view.
  import { Plus, CalendarDays } from '@lucide/svelte';
  import PageHeader from '../PageHeader.svelte';
  import Button from '../../../lib/ui/Button.svelte';
  import MonthNav from '../../../lib/ui/MonthNav.svelte';
  import MonthGrid from '../../../lib/ui/MonthGrid.svelte';
  import EmptyState from '../../../lib/ui/EmptyState.svelte';
  import { changes } from '../../../lib/db/changes.svelte';
  import { clock } from '../../../lib/clock.svelte';
  import { app } from '../../../lib/app.svelte';
  import { openQuick } from '../../quick/quick.svelte';
  import { getRange } from '../../../lib/db/idb';
  import { addDays, endOfMonth, formatDateKey, fromDateKey, startOfMonth, type DateKey } from '../../../lib/util/dates';
  import type { CalendarEvent } from '../../../lib/db/schema';

  let month = $state(startOfMonth(clock.today));
  let selected = $state<DateKey>(clock.today);
  let events = $state.raw<CalendarEvent[]>([]);

  $effect(() => {
    void changes.version;
    const from = addDays(startOfMonth(month), -7), to = addDays(endOfMonth(month), 14);
    void getRange('events', 'by_date', from, to).then((e) => { events = e; });
  });

  const byDay = $derived.by(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const e of [...events].sort(sortEvents)) m.set(e.date, [...(m.get(e.date) ?? []), e]);
    return m;
  });
  const dayEvents = $derived(byDay.get(selected) ?? []);

  function sortEvents(a: CalendarEvent, b: CalendarEvent) {
    return a.date.localeCompare(b.date) || Number(b.allDay) - Number(a.allDay) || (a.startTime ?? '').localeCompare(b.startTime ?? '');
  }
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
</script>

<PageHeader module="calendar">
  {#snippet actions()}<Button variant="primary" onclick={() => openQuick('event', { date: selected })}>{#snippet icon()}<Plus />{/snippet}Add event</Button>{/snippet}
</PageHeader>

<div class="layout">
  <section class="cal card" aria-label="Month">
    <div class="nav"><MonthNav {month} today={clock.today} onchange={(m) => { month = m; selected = m === startOfMonth(clock.today) ? clock.today : m; }} /></div>
    <MonthGrid {month} today={clock.today} {selected} weekStartsOn={app.settings?.weekStartsOn ?? 1} label="Calendar for {formatDateKey(month, { month: 'long', year: 'numeric' })}" onselect={pick}>
      {#snippet cell(d)}
        {@const list = byDay.get(d) ?? []}
        {#each list.slice(0, 2) as e (e.id)}<span class="chip">{e.title}</span>{/each}
        {#if list.length > 2}<span class="more">+{list.length - 2}</span>{/if}
        {#if list.length}<span class="dotm" aria-hidden="true"></span>{/if}
        {#if list.length}<span class="sr-only">{list.length} event{list.length === 1 ? '' : 's'}</span>{/if}
      {/snippet}
    </MonthGrid>
  </section>

  <section class="day card" aria-labelledby="day-h">
    <header>
      <div>
        <h2 id="day-h">{selected === clock.today ? 'Today' : formatDateKey(selected, { weekday: 'long' })}</h2>
        <p class="meta">{formatDateKey(selected, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>
      <Button size="sm" onclick={() => openQuick('event', { date: selected })}>{#snippet icon()}<Plus />{/snippet}Add</Button>
    </header>
    {#if dayEvents.length === 0}
      <EmptyState compact title="Nothing planned" body="Add an event for this day.">{#snippet icon()}<CalendarDays />{/snippet}</EmptyState>
    {:else}
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
  </section>
</div>

<style>
  .layout { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: var(--space-4); align-items: start; }
  @media (max-width: 1100px) { .layout { grid-template-columns: 1fr; } }
  .card { background: var(--surface); border: var(--card-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-1); padding: var(--space-4); }
  .nav { margin-bottom: var(--space-3); }
  .chip { font-size: 11px; line-height: 1.3; padding: 1px 5px; border-radius: 4px; background: color-mix(in srgb, var(--mod-calendar) 18%, transparent); color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .more { font-size: 11px; color: var(--text-3); }
  .dotm { display: none; width: 6px; height: 6px; border-radius: 50%; background: var(--mod-calendar); align-self: center; margin-top: auto; }
  @media (max-width: 640px) { .chip, .more { display: none; } .dotm { display: block; } }
  .day header { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-2); margin-bottom: var(--space-3); }
  .agenda { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-2); }
  .agenda button { width: 100%; text-align: left; display: grid; gap: 2px; padding: var(--space-3); border-radius: var(--radius-md); border: 0; border-left: 3px solid var(--mod-calendar); background: var(--surface-2); color: var(--text); cursor: pointer; }
  .agenda button:hover { background: var(--surface-3); }
  .when { font-size: var(--text-xs); font-weight: 700; color: var(--text-2); }
  .title { font-weight: 650; }
  .notes { font-size: var(--text-sm); color: var(--text-2); }
</style>
