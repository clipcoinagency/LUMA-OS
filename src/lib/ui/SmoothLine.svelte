<script lang="ts">
  // A smooth, glowing trend curve (Catmull-Rom through the logged points) with a soft area fill,
  // a pulsing end dot and a point per logged day. Null values are gaps: the curve joins the
  // logged days but never invents values for the missing ones.
  interface Props { values: (number | null)[]; min: number; max: number; label: string; color?: string; ghost?: boolean }
  let { values, min, max, label, color = 'var(--accent)', ghost = false }: Props = $props();
  const uid = `sl-${Math.random().toString(36).slice(2, 8)}`;
  const W = 300, H = 96, PX = 8, PY = 12;

  const pts = $derived.by(() => {
    const n = values.length;
    return values.flatMap((v, i) => (v === null ? [] : [{ x: PX + (n > 1 ? (i * (W - 2 * PX)) / (n - 1) : (W - 2 * PX) / 2), y: PY + (1 - (Math.min(max, Math.max(min, v)) - min) / (max - min || 1)) * (H - 2 * PY) }]));
  });
  const clampY = (y: number) => Math.min(H - PY + 4, Math.max(PY - 4, y));
  const line = $derived.by(() => {
    const p = pts;
    if (p.length < 2) return '';
    let d = `M${p[0]!.x.toFixed(1)},${p[0]!.y.toFixed(1)}`;
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[i - 1] ?? p[i]!, p1 = p[i]!, p2 = p[i + 1]!, p3 = p[i + 2] ?? p2;
      d += `C${(p1.x + (p2.x - p0.x) / 6).toFixed(1)},${clampY(p1.y + (p2.y - p0.y) / 6).toFixed(1)} ${(p2.x - (p3.x - p1.x) / 6).toFixed(1)},${clampY(p2.y - (p3.y - p1.y) / 6).toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }
    return d;
  });
  const area = $derived(line ? `${line}L${pts.at(-1)!.x.toFixed(1)},${H}L${pts[0]!.x.toFixed(1)},${H}Z` : '');
  const last = $derived(pts.at(-1));
  // placeholder wave for the "not enough data" state — drawn dashed and labelled as such by the caller
  const GHOST = 'M8,62 C46,30 70,30 104,52 C138,74 166,76 198,50 C228,26 262,30 292,44';
</script>

<svg viewBox="0 0 {W} {H}" width="100%" role="img" aria-label={label} class:ghost>
  <defs>
    <linearGradient id="{uid}-a" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color={color} stop-opacity=".34" /><stop offset="100%" stop-color={color} stop-opacity="0" /></linearGradient>
    <filter id="{uid}-g" x="-10%" y="-40%" width="120%" height="180%"><feGaussianBlur stdDeviation="4" /></filter>
  </defs>
  {#each [0.25, 0.5, 0.75] as g (g)}<line x1="0" x2={W} y1={H * g} y2={H * g} class="grid" />{/each}
  {#if ghost}
    <path d={GHOST} fill="none" stroke={color} stroke-width="2.5" stroke-linecap="round" stroke-dasharray="2 7" opacity=".55" />
  {:else if pts.length > 1}
    <path d={area} fill="url(#{uid}-a)" class="area" />
    <path d={line} fill="none" stroke={color} stroke-width="6" stroke-linecap="round" filter="url(#{uid}-g)" opacity=".55" class="fade" />
    <path d={line} fill="none" stroke={color} stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" pathLength="1" class="line" />
    {#each pts.slice(0, -1) as p, i (i)}<circle cx={p.x} cy={p.y} r="2.6" fill={color} fill-opacity=".6" class="pt" style="animation-delay:{i * 40 + 500}ms" />{/each}
    {#if last}
      <circle cx={last.x} cy={last.y} r="9" fill={color} opacity=".22" class="halo" />
      <circle cx={last.x} cy={last.y} r="4.4" fill={color} stroke="var(--surface)" stroke-width="2" class="pt" style="animation-delay:900ms" />
    {/if}
  {/if}
</svg>

<style>
  svg { display: block; overflow: visible; }
  .grid { stroke: var(--ring-track); stroke-width: 1; stroke-dasharray: 3 5; }
  .line { stroke-dasharray: 1; stroke-dashoffset: 1; animation: draw 1.1s var(--ease-glide) .1s forwards; }
  .area, .fade, .pt { opacity: 0; animation: fadein .8s var(--ease-out) .5s forwards; }
  .fade { animation-name: fadeglow; }
  .pt { animation-duration: .5s; }
  .halo { transform-box: fill-box; transform-origin: center; animation: pulse 2.6s var(--ease-in-out) 1.2s infinite; }
  @keyframes draw { to { stroke-dashoffset: 0; } }
  @keyframes fadein { to { opacity: 1; } }
  @keyframes fadeglow { to { opacity: .55; } }
  @keyframes pulse { 0%, 100% { transform: scale(.8); opacity: .3; } 50% { transform: scale(1.5); opacity: .08; } }
</style>
