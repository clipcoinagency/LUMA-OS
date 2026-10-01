<script lang="ts">
  import { Repeat, Plus } from '@lucide/svelte';
  import WidgetCard from '../WidgetCard.svelte';
  import Checkbox from '../../../lib/ui/Checkbox.svelte';
  import ProgressRing from '../../../lib/ui/ProgressRing.svelte';
  import EmptyState from '../../../lib/ui/EmptyState.svelte';
  import Button from '../../../lib/ui/Button.svelte';
  import { changes } from '../../../lib/db/changes.svelte';
  import { clock } from '../../../lib/clock.svelte';
  import { app } from '../../../lib/app.svelte';
  import { openQuick } from '../../quick/quick.svelte';
  import { habitStats, listHabits, logsByHabit, setHabitDone, type HabitStats } from '../../../lib/domain/habits';
  import { addDays, startOfWeek } from '../../../lib/util/dates';
  import type { Habit } from '../../../lib/db/schema';

  let rows = $state<{ habit: Habit; stats: HabitStats; week: boolean[] }[] | null>(null);

  $effect(() => {
    void changes.version;
    const day = clock.today;
    const ws = app.settings?.weekStartsOn ?? 1;
    void (async () => {
      const habits = await listHabits();
      const wk = startOfWeek(day, ws);
      rows = await Promise.all(habits.map(async (h) => { const logs = await logsByHabit(h.id); return { habit: h, stats: habitStats(h, logs, day, ws), week: Array.from({ length: 7 }, (_, i) => logs.has(addDays(wk, i))) }; }));
    })();
  });

  const due = $derived(rows?.filter((r) => r.stats.dueToday) ?? []);
  const done = $derived(due.filter((r) => r.stats.doneToday).length);

  function streakText(s: HabitStats, h: Habit): string {
    if (h.frequency.kind === 'times-per-week') return `${s.weekCount}/${h.frequency.times} this week`;
    if (s.current === 0) return s.best ? `Best ${s.best} days` : 'Start today';
    return `${s.current}-day streak`;
  }
</script>

<WidgetCard title="Habit check-in" module="habits" loaded={!!rows}>
  {#if rows}
    {#if rows.length === 0}
      <EmptyState compact title="No habits yet" body="Pick one small thing you want to do regularly.">
        {#snippet icon()}<Repeat />{/snippet}
        {#snippet action()}<Button size="sm" variant="primary" onclick={() => openQuick('habit')}>{#snippet icon()}<Plus />{/snippet}Create a habit</Button>{/snippet}
      </EmptyState>
    {:else}
      <div class="top">
        <ProgressRing value={done} max={Math.max(1, due.length)} size={56} stroke={6} label="Habits done today" color="var(--mod-habits)" />
        <p><strong class="num">{done} of {due.length}</strong> <span class="muted">done today</span></p>
      </div>
      <ul class="list">
        {#each due as { habit, stats, week } (habit.id)}
          <li>
            <Checkbox label="{habit.name} done today" checked={stats.doneToday} color={habit.color} size={24} onchange={(v) => setHabitDone(habit.id, clock.today, v)} />
            <span class="name">{habit.name}</span>
            <span class="wk" aria-hidden="true">{#each week as on, i (i)}<i class:on style="--c:{habit.color}"></i>{/each}</span>
            <span class="streak meta">{streakText(stats, habit)}</span>
          </li>
        {/each}
      </ul>
      {#if due.length < rows.length}<p class="meta rest">{rows.length - due.length} not due today</p>{/if}
    {/if}
  {/if}
</WidgetCard>

<style>
  .top { display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-3); }
  .list { list-style: none; margin: 0; padding: 0; display: grid; }
  li { display: flex; align-items: center; gap: var(--space-2); min-height: 46px; border-bottom: 1px solid var(--border); }
  li:last-child { border-bottom: 0; }
  .name { flex: 1; min-width: 0; font-weight: 550; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .streak { white-space: nowrap; }
  .wk { display: inline-flex; gap: 3px; flex: none; }
  .wk i { width: 7px; height: 7px; border-radius: 50%; background: var(--ring-track); }
  .wk i.on { background: var(--c); box-shadow: 0 0 6px color-mix(in srgb, var(--c) 55%, transparent); }
  @media (max-width: 420px) { .wk { display: none; } }
  .rest { margin-top: var(--space-2); }
</style>
