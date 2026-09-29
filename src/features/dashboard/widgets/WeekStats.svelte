<script lang="ts">
  // "Your week": what you actually did each of the last 7 days, across enabled modules.
  // Plain counts — no points, no fake scores.
  import WidgetCard from '../WidgetCard.svelte';
  import BarChart from '../../../lib/ui/BarChart.svelte';
  import CountUp from '../../../lib/ui/CountUp.svelte';
  import { changes } from '../../../lib/db/changes.svelte';
  import { clock } from '../../../lib/clock.svelte';
  import { app } from '../../../lib/app.svelte';
  import { tasksCompletedOn } from '../../../lib/domain/tasks';
  import { logsInRange } from '../../../lib/domain/habits';
  import { workoutsRange } from '../../../lib/domain/daily';
  import { addDays, eachDay, formatDateKey } from '../../../lib/util/dates';

  let days = $state<{ label: string; value: number; date: string }[] | null>(null);
  let parts = $state<{ tasks: number; habits: number; workouts: number }>({ tasks: 0, habits: 0, workouts: 0 });

  $effect(() => {
    void changes.version;
    const end = clock.today;
    const start = addDays(end, -6);
    const mods = app.workspace?.enabledModules ?? [];
    void (async () => {
      const [tasks, logs, workouts] = await Promise.all([
        mods.includes('tasks') ? tasksCompletedOn(start, end) : [],
        mods.includes('habits') ? logsInRange(start, end) : [],
        mods.includes('wellness') ? workoutsRange(start, end) : [],
      ]);
      const count = new Map<string, number>();
      for (const d of [...tasks.map((t) => t.completedOn!), ...logs.map((l) => l.date), ...workouts.map((w) => w.date)]) count.set(d, (count.get(d) ?? 0) + 1);
      parts = { tasks: tasks.length, habits: logs.length, workouts: workouts.length };
      days = eachDay(start, end).map((d) => ({ date: d, value: count.get(d) ?? 0, label: formatDateKey(d, { weekday: 'narrow' }) }));
    })();
  });

  const active = $derived(days ? days.filter((d) => d.value > 0).length : 0);
</script>

<WidgetCard title="Your week" loaded={!!days}>
  {#if days}
    <p class="summary"><strong><CountUp value={active} suffix=" of 7" /></strong> <span class="muted">days with progress</span></p>
    <BarChart data={days} label="Things done per day, last 7 days" height={120} highlight={6} format={(v) => `${v} done`} />
    <ul class="legend">
      {#if app.workspace?.enabledModules.includes('tasks')}<li><span class="dot" style="background:var(--mod-tasks)"></span>{parts.tasks} tasks</li>{/if}
      {#if app.workspace?.enabledModules.includes('habits')}<li><span class="dot" style="background:var(--mod-habits)"></span>{parts.habits} habit check-ins</li>{/if}
      {#if app.workspace?.enabledModules.includes('wellness')}<li><span class="dot" style="background:var(--mod-wellness)"></span>{parts.workouts} workouts</li>{/if}
    </ul>
  {/if}
</WidgetCard>

<style>
  .summary { margin-bottom: var(--space-3); }
  .legend { list-style: none; margin: var(--space-2) 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-4); font-size: var(--text-sm); color: var(--text-2); }
  .legend li { display: flex; align-items: center; gap: 6px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; }
</style>
