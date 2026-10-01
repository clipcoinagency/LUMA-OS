<script lang="ts">
  // Home: what you're reading right now, with one-tap progress. Real reading logs only.
  import { BookOpen, Plus, Flame } from '@lucide/svelte';
  import WidgetCard from '../WidgetCard.svelte';
  import EmptyState from '../../../lib/ui/EmptyState.svelte';
  import Button from '../../../lib/ui/Button.svelte';
  import ProgressBar from '../../../lib/ui/ProgressBar.svelte';
  import BookCover from '../../modules/study/BookCover.svelte';
  import { toast } from '../../../lib/ui/toast.svelte';
  import { changes } from '../../../lib/db/changes.svelte';
  import { clock } from '../../../lib/clock.svelte';
  import { router } from '../../../lib/router.svelte';
  import { openQuick } from '../../quick/quick.svelte';
  import { fractionOf, logReading, maxOf, readingSnapshot, unitOf, type ReadingSnap } from '../../../lib/domain/reading';
  import type { Book } from '../../../lib/db/schema';

  let snap = $state.raw<ReadingSnap | null>(null);
  $effect(() => { const v = changes.version; void readingSnapshot(clock.today).then((s) => { if (v === changes.version) snap = s; }); });

  const list = $derived((snap?.reading ?? []).slice(0, 3));
  async function add(b: Book) {
    const n = unitOf(b) === 'pages' ? 10 : 5;
    await logReading(b.id, n);
    toast(`+${n} ${unitOf(b) === 'pages' ? 'pages' : '%'} · ${b.title}`, { tone: 'success' });
  }
</script>

<WidgetCard title="Reading now" module="study" loaded={!!snap}>
  {#snippet actions()}{#if snap && snap.streak > 0}<span class="streak" title="Reading streak"><Flame size={14} aria-hidden="true" />{snap.streak}d</span>{/if}{/snippet}
  {#if snap}
    {#if list.length === 0}
      <EmptyState compact title={snap.any ? 'Nothing in progress' : 'Start your reading list'} body={snap.any ? 'Pick a book from your library and start reading.' : 'Add a book, article or course and track your progress.'}>
        {#snippet icon()}<BookOpen />{/snippet}
        {#snippet action()}
          {#if snap?.any}<Button size="sm" variant="primary" onclick={() => router.go({ name: 'module', module: 'study' })}>Open library</Button>
          {:else}<Button size="sm" variant="primary" onclick={() => openQuick('book', { status: 'reading' })}>{#snippet icon()}<Plus />{/snippet}Add a book</Button>{/if}
        {/snippet}
      </EmptyState>
    {:else}
      <ul class="list">
        {#each list as b (b.id)}
          <li>
            <span class="cv"><BookCover title={b.title} color={b.color} kind={b.kind} size="sm" /></span>
            <div class="info">
              <span class="t">{b.title}</span>
              <span class="s">{b.progress} / {maxOf(b)} {unitOf(b) === 'pages' ? 'pages' : '%'} · {Math.round(fractionOf(b) * 100)}%</span>
              <ProgressBar value={fractionOf(b) * 100} label="{b.title} progress" color={b.color} height={5} />
            </div>
            <button type="button" class="plus" onclick={() => add(b)} aria-label="Log {unitOf(b) === 'pages' ? '10 pages' : '5 percent'} of {b.title}">+{unitOf(b) === 'pages' ? 10 : 5}</button>
          </li>
        {/each}
      </ul>
      {#if !snap.loggedToday}<p class="nudge">No reading logged today yet.</p>{/if}
    {/if}
  {/if}
</WidgetCard>

<style>
  .streak { display: inline-flex; align-items: center; gap: 3px; font-size: var(--text-xs); font-weight: 700; color: var(--warning); padding: 3px 9px; border-radius: 999px; background: var(--warning-soft); }
  .list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-4); }
  li { display: flex; align-items: center; gap: var(--space-3); }
  .cv { width: 44px; flex: none; }
  .info { flex: 1; min-width: 0; display: grid; gap: 3px; }
  .t { font-weight: 650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .s { font-size: var(--text-xs); color: var(--text-2); }
  .plus { flex: none; min-width: 44px; height: 36px; border-radius: 999px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--text); font-weight: 700; cursor: pointer; transition: transform var(--dur-fast) var(--ease-out), background-color var(--dur) var(--ease-out); }
  .plus:hover { background: var(--accent-soft); } .plus:active { transform: scale(.92); }
  .nudge { margin: var(--space-3) 0 0; font-size: var(--text-xs); color: var(--text-2); }
</style>
