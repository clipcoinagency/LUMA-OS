<script lang="ts">
  import { Target, Plus } from '@lucide/svelte';
  import WidgetCard from '../WidgetCard.svelte';
  import ProgressRing from '../../../lib/ui/ProgressRing.svelte';
  import Badge from '../../../lib/ui/Badge.svelte';
  import EmptyState from '../../../lib/ui/EmptyState.svelte';
  import Button from '../../../lib/ui/Button.svelte';
  import { changes } from '../../../lib/db/changes.svelte';
  import { clock } from '../../../lib/clock.svelte';
  import { openQuick } from '../../quick/quick.svelte';
  import { goalFraction, goalPace, listGoals, type Pace } from '../../../lib/domain/goals';
  import { diffDays } from '../../../lib/util/dates';
  import type { Goal } from '../../../lib/db/schema';

  let goals = $state<Goal[] | null>(null);
  $effect(() => { void changes.version; void listGoals().then((g) => { goals = g.filter((x) => x.status === 'active').slice(0, 3); }); });

  const PACE: Record<Pace, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' | 'accent' } | null> = {
    done: { label: 'Done', tone: 'success' }, ahead: { label: 'Ahead', tone: 'success' }, 'on-track': { label: 'On track', tone: 'accent' },
    behind: { label: 'Behind', tone: 'warning' }, overdue: { label: 'Past deadline', tone: 'danger' }, 'no-deadline': null,
  };
  function sub(g: Goal): string {
    const prog = g.target !== null ? `${fmt(g.current)} / ${fmt(g.target)}${g.unit ? ' ' + g.unit : ''}` : `${g.milestones.filter((m) => m.done).length} of ${g.milestones.length} milestones`;
    if (!g.deadline) return prog;
    const d = diffDays(clock.today, g.deadline);
    return `${prog} · ${d > 1 ? `${d} days left` : d === 1 ? 'due tomorrow' : d === 0 ? 'due today' : 'deadline passed'}`;
  }
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
</script>

<WidgetCard title="Goal progress" module="goals" loaded={!!goals}>
  {#if goals}
    {#if goals.length === 0}
      <EmptyState compact title="No active goals" body="Set something to work toward — big or small.">
        {#snippet icon()}<Target />{/snippet}
        {#snippet action()}<Button size="sm" variant="primary" onclick={() => openQuick('goal')}>{#snippet icon()}<Plus />{/snippet}Set a goal</Button>{/snippet}
      </EmptyState>
    {:else}
      <ul class="list">
        {#each goals as g (g.id)}
          {@const pace = PACE[goalPace(g, clock.today)]}
          <li>
            <ProgressRing value={goalFraction(g) * 100} size={56} stroke={6} label="{g.title} progress" color="var(--mod-goals)" />
            <div class="info">
              <div class="row"><span class="title">{g.title}</span>{#if pace}<Badge tone={pace.tone}>{pace.label}</Badge>{/if}</div>
              <span class="sub">{sub(g)}</span>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</WidgetCard>

<style>
  .list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-4); }
  li { display: flex; align-items: center; gap: var(--space-4); }
  .info { display: grid; gap: 3px; min-width: 0; flex: 1; }
  .sub { font-size: var(--text-xs); color: var(--text-2); }
  .row { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
  .title { font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
