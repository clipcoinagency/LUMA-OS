<script lang="ts">
  // Dashboard: greeting, quick actions, then the user's widgets in their order.
  // Layout: widgets are dealt into balanced columns (each goes to the currently shortest column,
  // by estimated height) — preserves reading order and never leaves grid gaps. Column count
  // follows the chosen layout, the screen width and how many widgets there are.
  import type { Component } from 'svelte';
  import { Settings2 } from '@lucide/svelte';
  import Button from '../../lib/ui/Button.svelte';
  import { app } from '../../lib/app.svelte';
  import { clock } from '../../lib/clock.svelte';
  import { router } from '../../lib/router.svelte';
  import { visibleWidgets } from '../../lib/workspace';
  import { formatDateKey } from '../../lib/util/dates';
  import type { WidgetId } from '../../lib/db/schema';
  import QuickActions from './widgets/QuickActions.svelte';
  import TodayTasks from './widgets/TodayTasks.svelte';
  import HabitCheckin from './widgets/HabitCheckin.svelte';
  import GoalProgress from './widgets/GoalProgress.svelte';
  import Upcoming from './widgets/Upcoming.svelte';
  import WellnessToday from './widgets/WellnessToday.svelte';
  import FinanceMonth from './widgets/FinanceMonth.svelte';
  import RecentNotes from './widgets/RecentNotes.svelte';
  import WeekStats from './widgets/WeekStats.svelte';

  const COMPONENTS: Partial<Record<WidgetId, Component>> = {
    'today-tasks': TodayTasks, 'habit-progress': HabitCheckin, 'goal-progress': GoalProgress, 'upcoming-events': Upcoming,
    'wellness-summary': WellnessToday, 'finance-summary': FinanceMonth, 'recent-notes': RecentNotes, 'week-stats': WeekStats,
  };
  const WEIGHT: Partial<Record<WidgetId, number>> = {
    'today-tasks': 6, 'habit-progress': 6, 'goal-progress': 5, 'upcoming-events': 4, 'wellness-summary': 6,
    'finance-summary': 5, 'recent-notes': 5, 'week-stats': 5,
  };

  let width = $state(800);
  const ws = $derived(app.workspace!);
  const all = $derived(visibleWidgets(ws));
  const showQuick = $derived(all.includes('quick-actions'));
  const hasActivity = $derived(ws.enabledModules.some((m) => m === 'tasks' || m === 'habits' || m === 'wellness'));
  const cards = $derived(all.filter((w) => w !== 'quick-actions' && (w !== 'week-stats' || hasActivity)));

  const cols = $derived.by(() => {
    const max = ws.dashboardLayout === 'focus' ? 1 : ws.dashboardLayout === 'compact' ? (width >= 1060 ? 3 : width >= 660 ? 2 : 1) : width >= 720 ? 2 : 1;
    return Math.max(1, Math.min(max, cards.length));
  });
  const columns = $derived.by(() => {
    const out: WidgetId[][] = Array.from({ length: cols }, () => []);
    const h = new Array(cols).fill(0) as number[];
    for (const w of cards) {
      const i = h.indexOf(Math.min(...h));
      out[i]!.push(w);
      h[i]! += WEIGHT[w] ?? 5;
    }
    return out;
  });

  const name = $derived(app.settings!.displayName);
  const greeting = $derived(clock.hour < 5 ? 'Good night' : clock.hour < 12 ? 'Good morning' : clock.hour < 18 ? 'Good afternoon' : 'Good evening');
</script>

<div class="dash {ws.dashboardLayout}" bind:clientWidth={width}>
  <header class="hello">
    <p class="date">{formatDateKey(clock.today)}</p>
    <h1>{greeting}{name ? `, ${name}` : ''}</h1>
  </header>

  {#if showQuick}<div class="quick"><QuickActions /></div>{/if}

  {#if cards.length === 0 && !showQuick}
    <div class="none">
      <p>Your dashboard is empty. Choose the widgets you want to see.</p>
      <Button variant="primary" onclick={() => router.go({ name: 'settings' })}>{#snippet icon()}<Settings2 />{/snippet}Choose widgets</Button>
    </div>
  {:else}
    <div class="cols" style="--cols:{cols}">
      {#each columns as col, ci (ci)}
        <div class="dcol">
          {#each col as w, i (w)}
            {@const C = COMPONENTS[w]}
            {#if C}<div class="cell" style="--i:{ci + i * cols}"><C /></div>{/if}
          {/each}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .dash { max-width: 1180px; }
  .dash.focus { max-width: 720px; }
  .hello { display: grid; gap: var(--space-1); margin-bottom: var(--space-5); }
  .date { color: var(--text-2); font-weight: 600; }
  h1 { font-size: clamp(var(--text-2xl), 5vw, var(--text-3xl)); }
  .quick { margin-bottom: var(--space-4); }
  .cols { display: grid; grid-template-columns: repeat(var(--cols), minmax(0, 1fr)); gap: var(--space-4); align-items: start; }
  .dcol { display: grid; gap: var(--space-4); min-width: 0; align-content: start; }
  .compact .cols, .compact .dcol { gap: var(--space-3); }
  .cell { animation: rise var(--dur-slow) var(--ease-out) both; animation-delay: calc(var(--i) * 50ms); }
  @keyframes rise { from { opacity: 0; transform: translateY(8px); } }
  .none { display: grid; gap: var(--space-4); justify-items: start; padding: var(--space-6); border: 1px dashed var(--border-strong); border-radius: var(--radius-lg); }
</style>
