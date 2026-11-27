<script lang="ts">
  // Two bars per period (e.g. income and spending). Responsive, animated entrance; a visually-hidden table carries the numbers.
  interface Datum { label: string; a: number; b: number }
  interface Props { data: Datum[]; label: string; aName: string; bName: string; height?: number; format?: (v: number) => string; aColor?: string; bColor?: string }
  let { data, label, aName, bName, height = 160, format = (v) => String(v), aColor = 'var(--success)', bColor = 'var(--warning)' }: Props = $props();
  const max = $derived(Math.max(1, ...data.flatMap((d) => [d.a, d.b])));
  let mounted = $state(false);
  $effect(() => { const id = requestAnimationFrame(() => { mounted = true; }); return () => cancelAnimationFrame(id); });
</script>

<figure class="chart" aria-label={label}>
  <div class="bars" style="height:{height}px">
    {#each data as d, i (d.label + i)}
      <div class="col" title="{d.label}: {aName} {format(d.a)}, {bName} {format(d.b)}">
        <div class="pair">
          <div class="bar" style="height:{mounted ? (d.a / max) * 100 : 0}%;background:{aColor};transition-delay:{i * 30}ms"></div>
          <div class="bar" style="height:{mounted ? (d.b / max) * 100 : 0}%;background:{bColor};transition-delay:{i * 30 + 15}ms"></div>
        </div>
        <span class="lbl" aria-hidden="true">{d.label}</span>
      </div>
    {/each}
  </div>
  <div class="legend" aria-hidden="true"><span><i style="background:{aColor}"></i>{aName}</span><span><i style="background:{bColor}"></i>{bName}</span></div>
  <table class="sr-only">
    <caption>{label}</caption>
    <thead><tr><th scope="col">Period</th><th scope="col">{aName}</th><th scope="col">{bName}</th></tr></thead>
    <tbody>{#each data as d, i (i)}<tr><th scope="row">{d.label}</th><td>{format(d.a)}</td><td>{format(d.b)}</td></tr>{/each}</tbody>
  </table>
</figure>

<style>
  .chart { margin: 0; }
  .bars { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 8px; align-items: end; padding-bottom: 22px; }
  .col { position: relative; height: 100%; display: flex; align-items: flex-end; justify-content: center; }
  .pair { height: 100%; width: min(100%, 52px); display: flex; align-items: flex-end; gap: 3px; }
  .bar { flex: 1; min-height: 3px; border-radius: 5px 5px 2px 2px; opacity: .88; transition: height 600ms var(--ease-out), opacity var(--dur) var(--ease-out); }
  .col:hover .bar { opacity: 1; box-shadow: var(--glow); }
  .lbl { position: absolute; bottom: -22px; font-size: var(--text-xs); color: var(--text-3); white-space: nowrap; }
  .legend { display: flex; gap: var(--space-4); justify-content: center; font-size: var(--text-xs); color: var(--text-2); font-weight: 600; }
  .legend span { display: inline-flex; align-items: center; gap: 6px; } .legend i { width: 9px; height: 9px; border-radius: 3px; display: inline-block; }
  :global(:root[data-style='almanac']) .bars { border-bottom: 1px solid var(--text); }
  :global(:root[data-style='almanac']) .bar { border-radius: 0; }
  :global(:root[data-style='almanac']) .lbl { font-family: var(--font-mono); font-size: 10px; letter-spacing: .04em; }
</style>
