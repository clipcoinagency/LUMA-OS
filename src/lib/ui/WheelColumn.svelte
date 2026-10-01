<script lang="ts">
  // One column of a time "wheel": five visible values with the selected one in the middle band.
  // Drag, scroll, tap a neighbouring value, or use the arrow keys. Circular for hours/minutes.
  import { flip } from 'svelte/animate';
  import { dur } from '../motion';

  interface Props { items: string[]; index: number; label: string; circular?: boolean; onpick: (i: number) => void }
  let { items, index, label, circular = true, onpick }: Props = $props();
  const H = 38;                                   // px per row
  const n = $derived(items.length);
  const wrap = (i: number) => ((i % n) + n) % n;

  const rows = $derived.by(() => {
    const out: { key: string; i: number; off: number }[] = [];
    for (let off = -2; off <= 2; off++) {
      const raw = index + off;
      if (!circular && (raw < 0 || raw >= n)) { out.push({ key: `e${off}`, i: -1, off }); continue; }
      const i = circular ? wrap(raw) : raw;
      // a key per (value, turn) keeps rows moving smoothly as the window slides
      out.push({ key: `${i}:${circular ? Math.floor(raw / n) : 0}`, i, off });
    }
    return out;
  });

  const move = (d: number) => { const t = circular ? wrap(index + d) : Math.max(0, Math.min(n - 1, index + d)); if (t !== index) onpick(t); };

  let acc = 0;
  let lastY = 0;
  let dragging = false;
  function down(e: PointerEvent) { dragging = true; lastY = e.clientY; acc = 0; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }
  function drag(e: PointerEvent) {
    if (!dragging) return;
    acc += e.clientY - lastY; lastY = e.clientY;
    while (Math.abs(acc) >= H * 0.7) { const s = acc > 0 ? -1 : 1; move(s); acc -= (acc > 0 ? 1 : -1) * H * 0.7; }
  }
  const up = () => { dragging = false; };
  function wheel(e: WheelEvent) { e.preventDefault(); move(e.deltaY > 0 ? 1 : -1); }
  function key(e: KeyboardEvent) {
    const m: Record<string, number> = { ArrowUp: -1, ArrowDown: 1, PageUp: -3, PageDown: 3 };
    if (e.key in m) { e.preventDefault(); move(m[e.key]!); }
    else if (e.key === 'Home' && !circular) { e.preventDefault(); if (index !== 0) onpick(0); }
    else if (e.key === 'End' && !circular) { e.preventDefault(); if (index !== n - 1) onpick(n - 1); }
  }
</script>

<div class="wheel" role="spinbutton" tabindex="0" aria-label={label} aria-valuenow={index} aria-valuetext={items[index]} aria-valuemin={0} aria-valuemax={n - 1}
  onkeydown={key} onwheel={wheel} onpointerdown={down} onpointermove={drag} onpointerup={up} onpointercancel={up} style="--h:{H}px">
  <span class="band" aria-hidden="true"></span>
  <div class="rows">
    {#each rows as r (r.key)}
      <button type="button" tabindex="-1" class="row" class:sel={r.off === 0} class:empty={r.i < 0} style="--o:{Math.abs(r.off)}" aria-hidden={r.off !== 0}
        animate:flip={{ duration: dur(200) }} onclick={() => r.i >= 0 && onpick(r.i)}>{r.i >= 0 ? items[r.i] : ''}</button>
    {/each}
  </div>
</div>

<style>
  .wheel { position: relative; height: calc(var(--h) * 5); flex: 1; min-width: 0; touch-action: none; cursor: grab; border-radius: var(--radius-md); outline: none; user-select: none;
    -webkit-mask-image: linear-gradient(transparent, #000 28%, #000 72%, transparent); mask-image: linear-gradient(transparent, #000 28%, #000 72%, transparent); }
  .wheel:active { cursor: grabbing; }
  .wheel:focus-visible { box-shadow: var(--focus); }
  .band { position: absolute; left: 4px; right: 4px; top: calc(var(--h) * 2); height: var(--h); border-radius: 12px; background: var(--accent-soft); border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent); }
  .rows { position: relative; display: grid; grid-auto-rows: var(--h); }
  .row { height: var(--h); border: 0; background: none; color: var(--text); font: inherit; font-variant-numeric: tabular-nums; font-size: var(--text-md); font-weight: 600; cursor: pointer; opacity: calc(1 - var(--o) * .3); transform: scale(calc(1 - var(--o) * .08)); transition: opacity .2s var(--ease-out), transform .2s var(--ease-out); }
  .row.sel { font-size: var(--text-lg); font-weight: 800; color: var(--accent-ink); opacity: 1; transform: none; }
  .row.empty { visibility: hidden; }
</style>
