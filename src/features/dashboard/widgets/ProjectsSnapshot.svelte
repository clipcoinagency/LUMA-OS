<script lang="ts">
  // Home snapshot for Work (projects) or Study (subjects): active ones, soonest-due first.
  import { Briefcase, GraduationCap, Plus } from '@lucide/svelte';
  import WidgetCard from '../WidgetCard.svelte';
  import ProgressBar from '../../../lib/ui/ProgressBar.svelte';
  import Badge from '../../../lib/ui/Badge.svelte';
  import Button from '../../../lib/ui/Button.svelte';
  import EmptyState from '../../../lib/ui/EmptyState.svelte';
  import { changes } from '../../../lib/db/changes.svelte';
  import { clock } from '../../../lib/clock.svelte';
  import { router } from '../../../lib/router.svelte';
  import { openQuick } from '../../quick/quick.svelte';
  import { loadProjects, VOCAB, type ProjectKind, type ProjectRow } from '../../../lib/domain/projects';
  import { formatDateKey, diffDays, type DateKey } from '../../../lib/util/dates';

  let { kind }: { kind: ProjectKind } = $props();
  const v = $derived(VOCAB[kind]);
  let rows = $state.raw<ProjectRow[] | null>(null);

  $effect(() => {
    void changes.version;
    void loadProjects(kind).then((r) => { rows = r.filter((x) => x.project.status === 'active').sort((a, b) => (a.stats.nextDue ?? '9999').localeCompare(b.stats.nextDue ?? '9999')).slice(0, 4); });
  });
  const due = (d: DateKey | null) => {
    if (!d) return null;
    const n = diffDays(clock.today, d);
    return n < 0 ? { t: `${-n}d late`, tone: 'danger' as const } : n === 0 ? { t: 'Today', tone: 'warning' as const } : n <= 7 ? { t: n === 1 ? 'Tomorrow' : `In ${n}d`, tone: 'warning' as const } : { t: formatDateKey(d, { month: 'short', day: 'numeric' }), tone: 'neutral' as const };
  };
</script>

<WidgetCard title={v.many} module={kind} loaded={!!rows}>
  {#if rows}
    {#if rows.length === 0}
      <EmptyState compact title={`No active ${v.many.toLowerCase()}`} body={v.empty}>
        {#snippet icon()}{#if kind === 'work'}<Briefcase />{:else}<GraduationCap />{/if}{/snippet}
        {#snippet action()}<Button size="sm" variant="primary" onclick={() => openQuick('project', { kind })}>{#snippet icon()}<Plus />{/snippet}New {v.one}</Button>{/snippet}
      </EmptyState>
    {:else}
      <ul class="list">
        {#each rows as r (r.project.id)}
          {@const d = due(r.stats.nextDue)}
          <li style="--c:{r.project.color}">
            <button type="button" onclick={() => router.go({ name: 'module', module: kind })}>
              <span class="top"><span class="dot" aria-hidden="true"></span><span class="t">{r.project.title}</span>{#if d}<Badge tone={d.tone}>{d.t}</Badge>{/if}</span>
              {#if r.stats.tasksTotal}<ProgressBar value={(r.stats.tasksDone / r.stats.tasksTotal) * 100} label="{r.project.title} progress" color={r.project.color} height={6} />
                <span class="meta">{r.stats.tasksDone} of {r.stats.tasksTotal} {v.tasks.toLowerCase()}</span>{/if}
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</WidgetCard>

<style>
  .list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-3); }
  button { width: 100%; display: grid; gap: 6px; text-align: left; background: none; border: 0; padding: 0; cursor: pointer; color: var(--text); }
  .top { display: flex; align-items: center; gap: var(--space-2); }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--c); box-shadow: 0 0 10px color-mix(in srgb, var(--c) 60%, transparent); flex: none; }
  .t { flex: 1; min-width: 0; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  button:hover .t { color: var(--accent-ink); }
</style>
