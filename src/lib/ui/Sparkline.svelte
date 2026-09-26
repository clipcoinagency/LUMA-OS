<script lang="ts">
  // Trend line with soft area fill; draws itself in on mount. Null values = gaps (no fake data).
  interface Props { values: (number | null)[]; label: string; width?: number; height?: number; color?: string }
  let { values, label, width = 160, height = 44, color = 'var(--accent)' }: Props = $props();
  const uid = `sp-${Math.random().toString(36).slice(2, 8)}`;

  const pts = $derived.by(() => {
    const nums = values.filter((v): v is number => v !== null);
    if (nums.length === 0) return [] as { x: number; y: number }[];
    const min = Math.min(...nums), max = Math.max(...nums);
    const span = max - min || 1;
    const step = values.length > 1 ? width / (values.length - 1) : 0;
    return values.flatMap((v, i) => (v === null ? [] : [{ x: i * step, y: height - 4 - ((v - min) / span) * (height - 8) }]));
  });
  const line = $derived(pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(''));
  const area = $derived(pts.length ? `${line}L${pts.at(-1)!.x},${height}L${pts[0]!.x},${height}Z` : '');
</script>

<svg viewBox="0 0 {width} {height}" width="100%" height={height} preserveAspectRatio="none" role="img" aria-label={label}>
  <defs>
    <linearGradient id={uid} x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color={color} stop-opacity=".28" />
      <stop offset="100%" stop-color={color} stop-opacity="0" />
    </linearGradient>
  </defs>
  {#if pts.length > 1}
    <path d={area} fill="url(#{uid})" class="area" />
    <path d={line} fill="none" stroke={color} stroke-width="2" stroke-linecap="round" stroke-linejoin="round" pathLength="1" class="line" vector-effect="non-scaling-stroke" />
  {/if}
</svg>

<style>
  svg { display: block; overflow: visible; }
  .line { stroke-dasharray: 1; stroke-dashoffset: 1; animation: draw 900ms var(--ease-out) forwards; }
  .area { opacity: 0; animation: fadein 600ms var(--ease-out) 300ms forwards; }
  @keyframes draw { to { stroke-dashoffset: 0; } }
  @keyframes fadein { to { opacity: 1; } }
</style>
