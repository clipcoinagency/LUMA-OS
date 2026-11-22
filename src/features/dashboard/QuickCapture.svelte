<script lang="ts">
  // New looks: one line of plain English becomes a task. The chips show what was understood before
  // you press Enter, so nothing surprising is saved.
  import { CornerDownLeft, CalendarDays, Clock, Hash, Flag, BellRing } from '@lucide/svelte';
  import { parseCapture } from '../../lib/domain/capture';
  import { createTask } from '../../lib/domain/tasks';
  import { timeLabel } from '../../lib/domain/home';
  import { clock } from '../../lib/clock.svelte';
  import { addDays, formatDateKey } from '../../lib/util/dates';
  import { toast } from '../../lib/ui/toast.svelte';
  import { requestNotificationPermission } from '../../lib/reminders.svelte';

  let text = $state('');
  let busy = $state(false);
  const parsed = $derived(text.trim() ? parseCapture(text, clock.today) : null);
  const dayLabel = (k: string) => (k === clock.today ? 'Today' : k === addDays(clock.today, 1) ? 'Tomorrow' : formatDateKey(k as never, { weekday: 'short', day: 'numeric', month: 'short' }));
  const PRIO = { high: 'High', medium: 'Medium', low: 'Low', none: '' } as const;

  async function add(e: Event) {
    e.preventDefault();
    const p = parsed;
    if (!p || !p.title || busy) return;
    busy = true;
    try {
      await createTask({ title: p.title, dueDate: p.dueDate ?? clock.today, dueTime: p.dueTime, reminder: p.reminder, priority: p.priority ?? 'none', tags: p.tags });
      if (p.reminder) requestNotificationPermission();
      toast(`Added “${p.title}” — ${dayLabel(p.dueDate ?? clock.today)}${p.dueTime ? `, ${timeLabel(p.dueTime)}` : ''}`);
      text = '';
    } finally { busy = false; }
  }
</script>

<form class="qc" onsubmit={add} aria-label="Quick capture">
  <label class="field">
    <span class="sr-only">Add anything</span>
    <input bind:value={text} maxlength="200" autocomplete="off" placeholder="Add anything — “Call mom tomorrow 6pm #family !high”" />
    <button type="submit" class="go" disabled={!parsed?.title || busy} aria-label="Add task"><CornerDownLeft size={16} aria-hidden="true" /></button>
  </label>
  {#if parsed && (parsed.dueDate || parsed.dueTime || parsed.tags.length || parsed.priority)}
    <div class="chips" aria-live="polite">
      <span class="what">“{parsed.title || '…'}”</span>
      {#if parsed.dueDate}<span class="chip"><CalendarDays size={13} aria-hidden="true" />{dayLabel(parsed.dueDate)}</span>{/if}
      {#if parsed.dueTime}<span class="chip"><Clock size={13} aria-hidden="true" />{timeLabel(parsed.dueTime)}</span>{/if}
      {#if parsed.reminder}<span class="chip"><BellRing size={13} aria-hidden="true" />Reminder</span>{/if}
      {#if parsed.priority}<span class="chip"><Flag size={13} aria-hidden="true" />{PRIO[parsed.priority]}</span>{/if}
      {#each parsed.tags as t (t)}<span class="chip"><Hash size={13} aria-hidden="true" />{t}</span>{/each}
    </div>
  {/if}
</form>

<style>
  .qc { margin-top: var(--space-5); }
  .field { display: flex; align-items: center; gap: var(--space-2); padding: 6px 6px 6px var(--space-4); border-radius: var(--radius-btn);
    background: var(--card-bg); border: 1px solid var(--card-edge); box-shadow: var(--solid-highlight), var(--shadow-1);
    -webkit-backdrop-filter: blur(var(--card-blur)); backdrop-filter: blur(var(--card-blur)); transition: border-color var(--dur) var(--ease-out), box-shadow var(--dur) var(--ease-out); }
  .field:focus-within { border-color: var(--accent); box-shadow: var(--focus); }
  input { flex: 1; min-width: 0; height: 40px; border: 0; background: none; outline: none; color: var(--text); font-size: var(--text-md); }
  input::placeholder { color: var(--text-3); }
  .go { flex: none; width: 40px; height: 40px; border-radius: 50%; border: 0; display: grid; place-items: center; cursor: pointer; background: var(--accent); color: var(--on-accent);
    transition: opacity var(--dur) var(--ease-out), transform var(--dur-fast) var(--ease-out); }
  .go:disabled { opacity: .35; cursor: default; }
  .go:not(:disabled):active { transform: scale(.92); }
  .chips { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: var(--space-2) var(--space-2) 0; animation: in var(--dur) var(--ease-out); }
  @keyframes in { from { opacity: 0; transform: translateY(-3px); } }
  .what { font-size: var(--text-sm); color: var(--text-2); margin-right: 2px; max-width: 40ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 9px; border-radius: 999px; font-size: var(--text-xs); font-weight: 650; color: var(--accent-ink); background: var(--accent-soft); }

  :global(:root[data-style='almanac']) .field { border-radius: 0; background: transparent; border: 0; border-bottom: 2px solid var(--text); box-shadow: none; padding-left: 0; -webkit-backdrop-filter: none; backdrop-filter: none; }
  :global(:root[data-style='almanac']) .field:focus-within { box-shadow: none; border-bottom-color: var(--accent); }
  :global(:root[data-style='almanac']) input { font-family: var(--font-display); font-style: italic; font-size: 20px; }
  :global(:root[data-style='almanac']) .go { background: var(--text); color: var(--bg); }
  :global(:root[data-style='almanac']) .chip { border-radius: 0; background: none; border: 1px solid currentColor; font: 500 10px var(--font-mono); letter-spacing: .1em; text-transform: uppercase; }
  :global(:root[data-style='nebula']) .field { background: linear-gradient(180deg, rgba(255, 255, 255, .08), rgba(255, 255, 255, .02)), var(--glass-bg); box-shadow: var(--glass-highlight), 0 10px 30px rgba(20, 0, 60, .35); }
  :global(:root[data-style='nebula']) .go { background: var(--accent-grad); color: #fff; box-shadow: 0 6px 18px rgba(123, 97, 255, .45); }
</style>
