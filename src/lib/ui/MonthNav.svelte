<script lang="ts">
  // "‹ September 2026 ›" with a "This month" shortcut. Works on DateKeys (first day of month).
  import { ChevronLeft, ChevronRight } from '@lucide/svelte';
  import { reclaimFocusIfLost } from './reclaimFocus';
  import { addMonths, formatDateKey, startOfMonth, type DateKey } from '../util/dates';

  interface Props { month: DateKey; today: DateKey; onchange: (m: DateKey) => void; allowFuture?: boolean }
  let { month, today, onchange, allowFuture = true }: Props = $props();
  const current = $derived(startOfMonth(today));
  const label = $derived(formatDateKey(month, { month: 'long', year: 'numeric' }));
  let prevBtn: HTMLButtonElement | undefined = $state();

  // "This month" always disappears once clicked (its own if-condition flips false), and "Next
  // month" can become disabled right at the future boundary — either way the just-activated,
  // still-focused button can vanish from under the user, dropping focus to <body>. "Previous
  // month" is never itself removed or disabled, so it's a safe place to land.
  function go(m: DateKey) {
    onchange(m);
    reclaimFocusIfLost(() => prevBtn);
  }
</script>

<div class="mn">
  <button bind:this={prevBtn} type="button" aria-label="Previous month" onclick={() => go(addMonths(month, -1))}><ChevronLeft size={20} /></button>
  <span class="label" aria-live="polite">{label}</span>
  <button type="button" aria-label="Next month" disabled={!allowFuture && month >= current} onclick={() => go(addMonths(month, 1))}><ChevronRight size={20} /></button>
  {#if month !== current}<button type="button" class="now" onclick={() => go(current)}>This month</button>{/if}
</div>

<style>
  .mn { display: flex; align-items: center; gap: var(--space-1); }
  button { min-width: 40px; height: 40px; display: grid; place-items: center; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); color: var(--text-2); cursor: pointer; }
  button:hover:not(:disabled) { color: var(--text); border-color: var(--border-strong); }
  button:disabled { opacity: .35; cursor: default; }
  .label { min-width: 150px; text-align: center; font-family: var(--font-display); font-weight: var(--display-weight); font-size: var(--text-md); }
  .now { padding: 0 var(--space-3); font-weight: 600; font-size: var(--text-sm); margin-left: var(--space-2); }
</style>
