<script lang="ts">
  interface Props { value?: number | null; max?: number; label: string; color?: string; height?: number }
  let { value = null, max = 100, label, color = 'var(--accent)', height = 8 }: Props = $props();
  const pct = $derived(value === null ? null : Math.max(0, Math.min(100, (value / (max || 1)) * 100)));
</script>

<div class="track" style="height:{height}px" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max}
  aria-valuenow={value ?? undefined} aria-busy={value === null || undefined}>
  <div class="fill" class:indeterminate={pct === null} style="width:{pct ?? 35}%;background:{color}"></div>
</div>

<style>
  .track { width: 100%; background: var(--surface-3); border-radius: 999px; overflow: hidden; }
  .fill { height: 100%; border-radius: inherit; transition: width var(--dur-slow) var(--ease-out); box-shadow: var(--glow); }
  .indeterminate { animation: slide 1.1s var(--ease-in-out) infinite; }
  @keyframes slide { from { transform: translateX(-110%); } to { transform: translateX(310%); } }
</style>
