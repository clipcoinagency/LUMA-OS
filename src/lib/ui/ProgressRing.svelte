<script lang="ts">
  import { Tween } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';

  interface Props { value: number; max?: number; size?: number; stroke?: number; label: string; color?: string; showValue?: boolean }
  let { value, max = 100, size = 64, stroke = 7, label, color = 'var(--accent)', showValue = true }: Props = $props();

  const pct = $derived(max > 0 ? Math.max(0, Math.min(1, value / max)) : 0);
  const tween = new Tween(0, { duration: 700, easing: cubicOut });
  $effect(() => { tween.target = pct; });

  const r = $derived((size - stroke) / 2);
  const c = $derived(2 * Math.PI * r);
</script>

<div class="ring" style="width:{size}px;height:{size}px" role="progressbar" aria-label={label}
  aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)}>
  <svg viewBox="0 0 {size} {size}" aria-hidden="true">
    <circle cx={size / 2} cy={size / 2} {r} stroke-width={stroke} class="track" />
    <circle cx={size / 2} cy={size / 2} {r} stroke-width={stroke} class="bar" style="stroke:{color}"
      stroke-dasharray={c} stroke-dashoffset={c * (1 - tween.current)} />
  </svg>
  {#if showValue}<span class="val num">{Math.round(pct * 100)}%</span>{/if}
</div>

<style>
  .ring { position: relative; display: inline-grid; place-items: center; flex: none; }
  svg { position: absolute; inset: 0; transform: rotate(-90deg); }
  circle { fill: none; }
  .track { stroke: var(--surface-3); }
  .bar { stroke-linecap: round; filter: drop-shadow(var(--ring-glow, 0 0 0 transparent)); }
  :global([data-theme='dark']) .ring { --ring-glow: 0 0 4px rgba(79, 216, 242, .45); }
  .val { font-weight: 700; font-size: 0.8em; }
</style>
