<script lang="ts">
  import { CalendarDays, Plus } from '@lucide/svelte';
  import WidgetCard from '../WidgetCard.svelte';
  import EmptyState from '../../../lib/ui/EmptyState.svelte';
  import Button from '../../../lib/ui/Button.svelte';
  import { changes } from '../../../lib/db/changes.svelte';
  import { clock } from '../../../lib/clock.svelte';
  import { openQuick } from '../../quick/quick.svelte';
  import { upcomingEvents } from '../../../lib/domain/daily';
  import { addDays, formatDateKey, fromDateKey } from '../../../lib/util/dates';
  import type { CalendarEvent } from '../../../lib/db/schema';

  let events = $state<CalendarEvent[] | null>(null);
  $effect(() => { void changes.version; const d = clock.today; void upcomingEvents(d, 14, 5).then((e) => { events = e; }); });

  function dayLabel(d: string): string {
    if (d === clock.today) return 'Today';
    if (d === addDays(clock.today, 1)) return 'Tomorrow';
    return formatDateKey(d, { weekday: 'short', day: 'numeric', month: 'short' });
  }
  function time(t: string | null): string {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number) as [number, number];
    const d = fromDateKey(clock.today);
    d.setHours(h, m);
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(d);
  }
</script>

<WidgetCard title="Upcoming" module="calendar" loaded={!!events}>
  {#if events}
    {#if events.length === 0}
      <EmptyState compact title="Nothing in the next two weeks" body="Add plans so they show up here.">
        {#snippet icon()}<CalendarDays />{/snippet}
        {#snippet action()}<Button size="sm" variant="primary" onclick={() => openQuick('event')}>{#snippet icon()}<Plus />{/snippet}Add event</Button>{/snippet}
      </EmptyState>
    {:else}
      <ul class="list">
        {#each events as e (e.id)}
          <li>
            <span class="when"><span class="day">{dayLabel(e.date)}</span><span class="meta">{e.allDay ? 'All day' : time(e.startTime)}</span></span>
            <span class="bar" aria-hidden="true"></span>
            <span class="title">{e.title}</span>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</WidgetCard>

<style>
  .list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-3); }
  li { display: flex; align-items: center; gap: var(--space-3); min-height: 40px; }
  .when { display: grid; width: 92px; flex: none; line-height: 1.3; }
  .day { font-weight: 650; font-size: var(--text-sm); }
  .bar { width: 3px; align-self: stretch; border-radius: 3px; background: var(--mod-calendar); }
  .title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
