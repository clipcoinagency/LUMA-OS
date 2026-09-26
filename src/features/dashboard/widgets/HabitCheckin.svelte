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
  import type { Habit } from '../../../lib/db/schema';

  let rows = $state<{ habit: Habit; stats: HabitStats }[] | null>(null);

  $effect(() => {
    void changes.version;
    const day = clock.today;
    const ws = app.settings?.weekStartsOn ?? 1;
    void (async () => {
      const habits = await listHabits();
      rows = await Promise.all(habits.map(async (h) => ({ habit: h, stats: habitStats(h, await logsByHabit(h.id), day, ws) })));
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
        {#each due as { habit, stats } (habit.id)}
          <li>
            <Checkbox label="{habit.name} done today" checked={stats.doneToday} color={habit.color} size={24} onchange={(v) => setHabitDone(habit.id, clock.today, v)} />
            <span class="name">{habit.name}</span>
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
  .rest { margin-top: var(--space-2); }
</style>
