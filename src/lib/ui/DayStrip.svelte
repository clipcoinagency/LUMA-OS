<script lang="ts">
  // Consistency strip: one square per day (done / missed / not due / future). Honest at a glance.
  import { addDays, formatDateKey, type DateKey } from '../util/dates';

  interface Props { end: DateKey; days?: number; done: Set<string>; due?: (d: DateKey) => boolean; color?: string; label: string }
  let { end, days = 30, done, due = () => true, color = 'var(--accent)', label }: Props = $props();
  const list = $derived(Array.from({ length: days }, (_, i) => addDays(end, i - days + 1)));
  const doneN = $derived(list.filter((d) => done.has(d)).length);
</script>

<div class="strip" role="img" aria-label="{label}: {doneN} of the last {days} days done" style="--c:{color};--n:{days}">
  {#each list as d (d)}
    <span class="sq" class:done={done.has(d)} class:skip={!due(d) && !done.has(d)} title="{formatDateKey(d, { weekday: 'short', day: 'numeric', month: 'short' })}{done.has(d) ? ' — done' : ''}"></span>
  {/each}
</div>

<style>
  .strip { display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: 3px; }
  .sq { aspect-ratio: 1; min-width: 0; border-radius: 3px; background: var(--surface-3); }
  .sq.done { background: var(--c); box-shadow: 0 0 6px color-mix(in srgb, var(--c) 35%, transparent); }
  .sq.skip { background: transparent; border: 1px dashed var(--border); }
</style>
