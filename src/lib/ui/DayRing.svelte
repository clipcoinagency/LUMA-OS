<script lang="ts">
  // The "Orbit": one arc per area of your day (tasks, habits, focus, wellness), each filled by its own
  // real progress — deliberately NOT merged into a single score. A thin outer track carries a small
  // light that travels around it as the day passes, so the ring is also a clock. Hover or focus a legend
  // entry to isolate its arc.
  import { onMount } from 'svelte';
  import { dur } from '../motion';

  export interface RingSegment {
    id: string;
    label: string;
    color: string;
    fraction: number | null;      // 0–1, or null = nothing to measure today
    value: string;
    sub?: string;
  }
  interface Props {
    segments: RingSegment[];
    dayFraction: number;          // 0–1 through the local day
    top?: string;
    main: string;
    sub?: string;
    size?: number;
    label: string;
    active?: string | null;
  }
  let { segments, dayFraction, top = '', main, sub = '', size = 320, label, active = $bindable(null) }: Props = $props();

  const C = 160;
  const R = 116;
  const OUT = 146;
  let mounted = $state(false);
  onMount(() => { const id = requestAnimationFrame(() => { mounted = true; }); return () => cancelAnimationFrame(id); });

  const rad = (deg: number) => (deg * Math.PI) / 180;
  const pt = (r: number, deg: number) => `${(C + r * Math.cos(rad(deg))).toFixed(2)} ${(C + r * Math.sin(rad(deg))).toFixed(2)}`;
  function arc(r: number, a0: number, a1: number): string {
    return `M ${pt(r, a0)} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${pt(r, a1)}`;
  }

  const n = $derived(Math.max(1, segments.length));
  const gap = $derived(n === 1 ? 0 : 9);
  const arcs = $derived(segments.map((s, i) => {
    const step = 360 / n;
    const a0 = -90 + i * step + gap / 2;
    const a1 = -90 + (i + 1) * step - gap / 2;
    return { ...s, a0, a1, d: arc(R, a0, a1), mid: (a0 + a1) / 2 };
  }));

  const dayAng = $derived(-90 + dayFraction * 360);
  const night = $derived(dayFraction < 0.25 || dayFraction > 0.83);
  const nowDot = $derived({ x: C + OUT * Math.cos(rad(dayAng)), y: C + OUT * Math.sin(rad(dayAng)) });
  const elapsed = $derived(dayFraction > 0.002 ? arc(OUT, -90, -90 + Math.min(359.9, dayFraction * 360)) : '');
</script>

<figure class="ring" style="--size:{size}px" aria-label={label}>
  <svg viewBox="0 0 320 320" role="img" aria-label={label}>
    <defs>
      <filter id="glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    </defs>

    <!-- the day, as an outer orbit -->
    <circle cx={C} cy={C} r={OUT} class="orbit" />
    {#if elapsed}<path d={elapsed} class="elapsed" />{/if}
    {#each [0, 6, 12, 18] as h (h)}
      {@const a = -90 + (h / 24) * 360}
      <line x1={C + (OUT - 4) * Math.cos(rad(a))} y1={C + (OUT - 4) * Math.sin(rad(a))} x2={C + (OUT + 4) * Math.cos(rad(a))} y2={C + (OUT + 4) * Math.sin(rad(a))} class="mark" />
    {/each}
    <g class="now" style="transform:translate({nowDot.x - C}px,{nowDot.y - C}px)" class:night>
      <circle cx={C} cy={C} r="11" class="halo" />
      <circle cx={C} cy={C} r="5.5" class="core" />
    </g>

    <!-- the areas -->
    {#each arcs as s (s.id)}
      <g class="seg" class:dim={active !== null && active !== s.id} role="presentation">
        <path d={s.d} class="track" />
        {#if s.fraction !== null}
          <path d={s.d} class="fill" pathLength="1" stroke={s.color} stroke-dasharray="1 1" stroke-dashoffset={mounted ? 1 - s.fraction : 1}
            style="transition-duration:{dur(1100)}ms;filter:drop-shadow(0 0 7px color-mix(in srgb, {s.color} 55%, transparent));opacity:{s.fraction > 0.004 ? 1 : 0}" />
        {:else}
          <path d={s.d} class="empty" stroke={s.color} />
        {/if}
      </g>
    {/each}
  </svg>
  <figcaption class="mid">
    {#if top}<span class="top">{top}</span>{/if}
    <span class="main">{main}</span>
    {#if sub}<span class="subt">{sub}</span>{/if}
  </figcaption>
</figure>

<style>
  .ring { position: relative; margin: 0; width: var(--size); max-width: 100%; aspect-ratio: 1; flex: none; }
  svg { width: 100%; height: 100%; overflow: visible; }
  .orbit { fill: none; stroke: var(--ring-track); stroke-width: 1.5; }
  .elapsed { fill: none; stroke: color-mix(in srgb, var(--text) 22%, transparent); stroke-width: 1.5; stroke-linecap: round; }
  .mark { stroke: var(--text-3); stroke-width: 1.5; opacity: .55; stroke-linecap: round; }
  .now { transition: transform 1.2s var(--ease-glide); }
  .halo { fill: color-mix(in srgb, var(--warning) 34%, transparent); animation: pulse 3.2s var(--ease-in-out) infinite; transform-box: fill-box; transform-origin: center; }
  .core { fill: var(--warning); filter: drop-shadow(0 0 5px var(--warning)); }
  .night .halo { fill: color-mix(in srgb, var(--accent-2) 36%, transparent); }
  .night .core { fill: var(--accent-2); filter: drop-shadow(0 0 5px var(--accent-2)); }
  @keyframes pulse { 0%, 100% { transform: scale(.8); opacity: .6; } 50% { transform: scale(1.25); opacity: 1; } }

  .seg { transition: opacity var(--dur) var(--ease-out); }
  .seg.dim { opacity: .28; }
  .track { fill: none; stroke: var(--ring-track); stroke-width: 15; stroke-linecap: round; }
  .fill { fill: none; stroke-width: 15; stroke-linecap: round; transition-property: stroke-dashoffset; transition-timing-function: var(--ease-glide); }
  .empty { fill: none; stroke-width: 15; stroke-linecap: round; stroke-dasharray: .001 22; opacity: .45; }

  .mid { position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; gap: 2px; text-align: center; pointer-events: none; }
  .top { font-size: var(--text-xs); font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: var(--text-3); }
  .main { font-family: var(--font-display); font-weight: var(--display-weight); font-size: calc(var(--size) * .17); line-height: 1; letter-spacing: -0.03em; }
  .subt { font-size: var(--text-sm); color: var(--text-2); font-weight: 600; margin-top: 4px; }
</style>
