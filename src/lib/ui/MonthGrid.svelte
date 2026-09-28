<script lang="ts">
  // Accessible month grid (role="grid", arrow-key navigation). Cell contents come from a snippet,
  // so Habits, Calendar and the History view all share one calendar.
  import type { Snippet } from 'svelte';
  import { addDays, endOfMonth, formatDateKey, startOfMonth, startOfWeek, type DateKey } from '../util/dates';

  interface Props {
    month: DateKey;
    today: DateKey;
    selected?: DateKey | null;
    weekStartsOn?: 0 | 1;
    label: string;
    onselect?: (d: DateKey) => void;
    cell?: Snippet<[DateKey]>;
    compact?: boolean;
  }
  let { month, today, selected = null, weekStartsOn = 1, label, onselect, cell, compact = false }: Props = $props();

  const weeks = $derived.by(() => {
    const first = startOfWeek(startOfMonth(month), weekStartsOn);
    const last = endOfMonth(month);
    const rows: DateKey[][] = [];
    for (let d = first; d <= last || rows.length < 5; d = addDays(d, 7)) {
      rows.push(Array.from({ length: 7 }, (_, i) => addDays(d, i)));
      if (rows.length === 6) break;
    }
    return rows;
  });
  const dayNames = $derived(weeks[0]!.map((d) => formatDateKey(d, { weekday: 'short' })));
  const inMonth = (d: DateKey) => d.slice(0, 7) === month.slice(0, 7);
  // aria-label on the gridcell button (below) sets its accessible NAME, which overrides any
  // nested text content entirely — so per-day details rendered by the `cell` snippet (event
  // counts, habit done/missed dots) would otherwise be invisible to screen readers. Wiring the
  // content wrapper up as an aria-describedby target adds it as a DESCRIPTION instead, which is
  // additive rather than a replacement, and still correctly picks up any aria-label a snippet
  // puts on its own nested elements (e.g. a habit dot's aria-label="done").
  const gridId = `mg${Math.random().toString(36).slice(2, 8)}`;
  let focusKey = $state<DateKey | null>(null);
  const tabKey = $derived(focusKey && inMonth(focusKey) ? focusKey : selected && inMonth(selected) ? selected : inMonth(today) ? today : startOfMonth(month));

  function key(e: KeyboardEvent, d: DateKey) {
    const move: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in move) {
      e.preventDefault();
      const next = addDays(d, move[e.key]!);
      focusKey = next;
      queueMicrotask(() => (document.querySelector(`[data-day="${next}"]`) as HTMLElement | null)?.focus());
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onselect?.(d);
    }
  }
</script>

<div class="grid" class:compact role="grid" aria-label={label}>
  <div class="row head" role="row">
    {#each dayNames as n, i (i)}<span role="columnheader" class="dn">{n}</span>{/each}
  </div>
  {#each weeks as w, wi (wi)}
    <div class="row" role="row">
      {#each w as d (d)}
        <button type="button" role="gridcell" data-day={d} class="day" class:out={!inMonth(d)} class:today={d === today} class:sel={d === selected}
          aria-selected={d === selected} aria-current={d === today ? 'date' : undefined} aria-label={formatDateKey(d, { weekday: 'long', month: 'long', day: 'numeric' })}
          aria-describedby={cell ? `${gridId}-${d}` : undefined}
          tabindex={d === tabKey ? 0 : -1} onclick={() => onselect?.(d)} onkeydown={(e) => key(e, d)}>
          <span class="num">{Number(d.slice(8))}</span>
          {#if cell}<span class="content" id="{gridId}-{d}">{@render cell(d)}</span>{/if}
        </button>
      {/each}
    </div>
  {/each}
</div>

<style>
  .grid { display: grid; gap: 4px; }
  .row { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; }
  .dn { text-align: center; font-size: var(--text-xs); font-weight: 650; color: var(--text-3); padding: 4px 0; text-transform: uppercase; letter-spacing: .04em; }
  .day {
    position: relative; display: flex; flex-direction: column; align-items: stretch; gap: 2px; min-height: 76px; padding: 6px;
    border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface); color: var(--text); cursor: pointer; text-align: left;
    transition: border-color var(--dur) var(--ease-out), background-color var(--dur) var(--ease-out);
  }
  .compact .day { min-height: 44px; align-items: center; justify-content: center; padding: 4px; }
  .day:hover { border-color: var(--border-strong); }
  .day:focus-visible { border-radius: var(--radius-sm); }
  .out { opacity: .38; }
  .num { font-size: var(--text-sm); font-weight: 600; line-height: 1.2; }
  .compact .num { font-size: var(--text-xs); }
  .today .num { color: var(--accent-ink); font-weight: 800; }
  .today { border-color: color-mix(in srgb, var(--accent) 60%, var(--border)); }
  .sel { background: var(--accent-soft); border-color: var(--accent); box-shadow: var(--glow); }
  .content { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
  .compact .content { align-items: center; }
  @media (max-width: 640px) { .day { min-height: 52px; padding: 4px; } }
</style>
