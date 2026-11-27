<script lang="ts">
  // Lightweight SVG bar chart: responsive, animated entrance, keyboard/screen-reader friendly
  // (every bar is described; a visually-hidden table carries the exact numbers).
  interface Datum { label: string; value: number; color?: string }
  interface Props { data: Datum[]; label: string; height?: number; format?: (v: number) => string; highlight?: number }
  let { data, label, height = 160, format = (v) => String(v), highlight = -1 }: Props = $props();

  const max = $derived(Math.max(1, ...data.map((d) => d.value)));
  let mounted = $state(false);
  $effect(() => { const id = requestAnimationFrame(() => { mounted = true; }); return () => cancelAnimationFrame(id); });
</script>

<figure class="chart" aria-label={label}>
  <div class="bars" style="height:{height}px">
    {#each data as d, i (d.label + i)}
      <div class="col" title="{d.label}: {format(d.value)}">
        <div class="bar" class:hl={i === highlight}
          style="height:{mounted ? (d.value / max) * 100 : 0}%;background:{d.color ?? 'var(--accent)'};transition-delay:{i * 30}ms"></div>
        <span class="lbl" aria-hidden="true">{d.label}</span>
      </div>
    {/each}
  </div>
  <table class="sr-only">
    <caption>{label}</caption>
    <tbody>{#each data as d, i (i)}<tr><th scope="row">{d.label}</th><td>{format(d.value)}</td></tr>{/each}</tbody>
  </table>
</figure>

<style>
  .chart { margin: 0; position: relative; overflow-x: clip; } /* the hidden data table must never widen the page */
  .bars { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 6px; align-items: end; padding-bottom: 22px; }
  .col { position: relative; height: 100%; display: flex; align-items: flex-end; justify-content: center; }
  .bar {
    width: min(100%, 34px); min-height: 3px; border-radius: 6px 6px 3px 3px; opacity: .85;
    transition: height 600ms var(--ease-out), opacity var(--dur) var(--ease-out);
  }
  .bar.hl, .col:hover .bar { opacity: 1; box-shadow: var(--glow); }
  .lbl { position: absolute; bottom: -22px; font-size: var(--text-xs); color: var(--text-3); white-space: nowrap; }

  /* ---- Almanac ---------------------------------------------------------------- */
  :global(:root[data-style='almanac']) .bars { border-bottom: 1px solid var(--text); }
  :global(:root[data-style='almanac']) .bar { border-radius: 0; opacity: .9; }
  :global(:root[data-style='almanac']) .bar.hl, :global(:root[data-style='almanac']) .col:hover .bar { box-shadow: none; opacity: 1; }
  :global(:root[data-style='almanac']) .lbl { font-family: var(--font-mono); font-size: 10px; letter-spacing: .04em; }
</style>
