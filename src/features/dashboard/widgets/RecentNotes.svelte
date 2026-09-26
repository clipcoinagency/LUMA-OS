<script lang="ts">
  import { NotebookPen, Plus, Pin } from '@lucide/svelte';
  import WidgetCard from '../WidgetCard.svelte';
  import EmptyState from '../../../lib/ui/EmptyState.svelte';
  import Button from '../../../lib/ui/Button.svelte';
  import { changes } from '../../../lib/db/changes.svelte';
  import { clock } from '../../../lib/clock.svelte';
  import { openQuick } from '../../quick/quick.svelte';
  import { recentNotes } from '../../../lib/domain/daily';
  import { diffDays, formatDateKey } from '../../../lib/util/dates';
  import type { Note } from '../../../lib/db/schema';

  let notes = $state<Note[] | null>(null);
  $effect(() => { void changes.version; void recentNotes(3).then((n) => { notes = n; }); });

  function when(n: Note): string {
    const d = diffDays(n.date, clock.today);
    return d === 0 ? 'Today' : d === 1 ? 'Yesterday' : d < 7 ? `${d} days ago` : formatDateKey(n.date, { day: 'numeric', month: 'short' });
  }
  const snippet = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, 110);
</script>

<WidgetCard title="Recent notes" module="notes" loaded={!!notes}>
  {#snippet actions()}{#if notes?.length}<Button size="sm" variant="ghost" aria-label="New note" onclick={() => openQuick('note')}>{#snippet icon()}<Plus />{/snippet}</Button>{/if}{/snippet}
  {#if notes}
    {#if notes.length === 0}
      <EmptyState compact title="No notes yet" body="Capture a thought, an idea or a reflection.">
        {#snippet icon()}<NotebookPen />{/snippet}
        {#snippet action()}<Button size="sm" variant="primary" onclick={() => openQuick('note')}>{#snippet icon()}<Plus />{/snippet}Write a note</Button>{/snippet}
      </EmptyState>
    {:else}
      <ul class="list">
        {#each notes as n (n.id)}
          <li>
            <div class="row"><span class="title">{#if n.pinned}<Pin size={13} aria-label="Pinned" />{/if}{n.title}</span><span class="meta">{when(n)}</span></div>
            {#if snippet(n.content)}<p class="snip">{snippet(n.content)}</p>{/if}
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</WidgetCard>

<style>
  .list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-3); }
  li { padding: var(--space-3); border-radius: var(--radius-md); background: var(--surface-2); display: grid; gap: 4px; }
  .row { display: flex; justify-content: space-between; gap: var(--space-2); align-items: baseline; }
  .title { font-weight: 650; display: flex; gap: 6px; align-items: center; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .snip { color: var(--text-2); font-size: var(--text-sm); display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
</style>
