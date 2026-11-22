<script lang="ts">
  // New looks: "From the archive" — what you did and wrote a week, a month and a year ago today.
  // Only real records; days with nothing recorded are simply left out.
  import { clock } from '../../lib/clock.svelte';
  import { changes } from '../../lib/db/changes.svelte';
  import { getRange } from '../../lib/db/idb';
  import { addDays, formatDateKey, type DateKey } from '../../lib/util/dates';
  import { router } from '../../lib/router.svelte';
  import type { Note } from '../../lib/db/schema';

  interface Past { label: string; day: DateKey; tasks: number; habits: number; note: Note | null }
  let past = $state.raw<Past[]>([]);

  function monthAgo(k: DateKey): DateKey {
    const [y, m, d] = k.split('-').map(Number) as [number, number, number];
    const dt = new Date(y, m - 2, Math.min(d, new Date(y, m - 1, 0).getDate()));
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}` as DateKey;
  }
  const yearAgo = (k: DateKey) => `${Number(k.slice(0, 4)) - 1}${k.slice(4)}` as DateKey;

  $effect(() => {
    const v = changes.version, today = clock.today;
    const marks: [string, DateKey][] = [['A week ago', addDays(today, -7)], ['A month ago', monthAgo(today)], ['A year ago', yearAgo(today)]];
    void Promise.all(marks.map(async ([label, day]) => {
      const [tasks, logs, notes] = await Promise.all([getRange('tasks', 'by_completed', day, day), getRange('habit_logs', 'by_date', day, day), getRange('notes', 'by_date', day, day)]);
      const note = notes.find((n) => n.kind === 'journal') ?? notes[0] ?? null;
      return { label, day, tasks: tasks.length, habits: logs.length, note };
    })).then((rows) => { if (v === changes.version) past = rows.filter((r) => r.tasks || r.habits || r.note); });
  });
  const firstLine = (n: Note) => (n.content.split('\n').find((l) => l.trim() && !l.startsWith('—')) ?? '').slice(0, 160);
</script>

<section class="arc" aria-labelledby="arc-h">
  <header><h2 id="arc-h">From the archive</h2><span class="kicker">On this day</span></header>
  {#if past.length}
    <div class="cards">
      {#each past as p (p.day)}
        <article class="card gcard">
          <p class="kicker lab">{p.label}</p>
          <p class="when">{formatDateKey(p.day, { weekday: 'long', day: 'numeric', month: 'long', ...(p.label === 'A year ago' ? { year: 'numeric' } : {}) })}</p>
          <p class="did">{[p.tasks ? `${p.tasks} task${p.tasks === 1 ? '' : 's'} done` : '', p.habits ? `${p.habits} habit check-in${p.habits === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ') || 'A day in your journal'}</p>
          {#if p.note}
            <button type="button" class="note" onclick={() => router.go({ name: 'module', module: 'notes' })}>
              <b>{p.note.title || 'Untitled note'}</b>{#if firstLine(p.note)}<span>“{firstLine(p.note)}”</span>{/if}
            </button>
          {/if}
        </article>
      {/each}
    </div>
  {:else}
    <p class="none">Your archive writes itself. In a week, this is where today comes back to you.</p>
  {/if}
</section>

<style>
  .arc { margin-top: var(--space-8); }
  header { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-3); margin-bottom: var(--space-3); }
  h2 { font-size: var(--text-lg); }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: var(--space-3); }
  .card { padding: var(--space-4); display: grid; gap: 4px; align-content: start; }
  .lab { color: var(--accent-ink); }
  .when { font-family: var(--font-display); font-weight: var(--display-weight); font-size: var(--text-md); }
  .did { font-size: var(--text-sm); color: var(--text-2); }
  .note { margin-top: var(--space-2); text-align: left; display: grid; gap: 2px; padding: var(--space-2) var(--space-3); border-radius: var(--radius-sm); cursor: pointer; color: var(--text);
    border: 1px solid var(--border); background: color-mix(in srgb, var(--text) 4%, transparent); font: inherit; }
  .note b { font-size: var(--text-sm); }
  .note span { font-size: var(--text-xs); color: var(--text-2); font-style: italic; }
  .none { font-size: var(--text-sm); color: var(--text-2); }
  :global(:root[data-style='almanac']) .arc { border-top: 2px solid var(--text); padding-top: var(--space-3); margin-top: var(--space-10); }
  :global(:root[data-style='almanac']) h2 { font-size: clamp(26px, 2.6vw, 34px); font-weight: 340; font-style: italic; letter-spacing: -0.03em; }
  :global(:root[data-style='almanac']) .card { background: none; border: 0; border-left: 1px solid var(--border-strong); border-radius: 0; padding: 0 0 0 var(--space-4); }
  :global(:root[data-style='almanac']) .when { font-style: italic; font-size: 20px; font-weight: 400; }
  :global(:root[data-style='almanac']) .note { border-radius: 0; background: none; border: 0; border-top: 1px dotted var(--border-strong); padding: var(--space-2) 0 0; }
</style>
