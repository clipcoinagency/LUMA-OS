<script lang="ts">
  interface Props { value?: number | null; max?: number; label: string; color?: string; height?: number }
  let { value = null, max = 100, label, color = 'var(--accent)', height = 8 }: Props = $props();
  const pct = $derived(value === null ? null : Math.max(0, Math.min(100, (value / (max || 1)) * 100)));
</script>

<div class="track" style="height:{height}px" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max}
  aria-valuenow={value ?? undefined} aria-busy={value === null || undefined}>
  <div class="fill" class:indeterminate={pct === null} style="width:{pct ?? 35}%;background:{color};--fillc:{color}"></div>
</div>

<style>
  .track { width: 100%; background: var(--surface-3); border-radius: 999px; overflow: hidden; }
  .fill { position: relative; overflow: hidden; --tip: color-mix(in srgb, #fff 55%, transparent); height: 100%; border-radius: inherit; transition: width .9s var(--ease-glide); box-shadow: 0 0 12px color-mix(in srgb, var(--fillc, var(--accent)) 38%, transparent); }
  .indeterminate { animation: slide 1.1s var(--ease-in-out) infinite; }
  @keyframes slide { from { transform: translateX(-110%); } to { transform: translateX(310%); } }
  /* a slow, quiet light sweep — a still bar reads as "loading forever", this reads as "alive" */
  .fill:not(.indeterminate)::after {
    content: ''; position: absolute; inset: 0; transform: translateX(-120%);
    background: linear-gradient(100deg, transparent 30%, rgba(255, 255, 255, .35) 50%, transparent 70%);
    animation: shimmer 3.2s ease-in-out infinite; animation-delay: 1s;
  }
  .fill:not(.indeterminate)::before { content: ''; position: absolute; right: 0; top: 0; bottom: 0; width: 14px; background: linear-gradient(to right, transparent, var(--tip)); border-radius: inherit; opacity: .7; }
  @keyframes shimmer { 0%, 35% { transform: translateX(-120%); } 65%, 100% { transform: translateX(120%); } }
</style>
