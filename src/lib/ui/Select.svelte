<script lang="ts">
  interface Option { value: string; label: string }
  interface Props { label: string; value?: string; options: Option[]; hint?: string; id?: string; hideLabel?: boolean; onchange?: (v: string) => void }
  let { label, value = $bindable(''), options, hint, id, hideLabel = false, onchange }: Props = $props();
  const fallbackId = `s-${Math.random().toString(36).slice(2, 8)}`;
  const uid = $derived(id ?? fallbackId);
</script>

<div class="field">
  <label for={uid} class:sr-only={hideLabel}>{label}</label>
  <div class="wrap">
    <select id={uid} bind:value onchange={() => onchange?.(value)} aria-describedby={hint ? `${uid}-hint` : undefined}>
      {#each options as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
    </select>
    <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 7.5l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
  </div>
  {#if hint}<p class="hint" id="{uid}-hint">{hint}</p>{/if}
</div>

<style>
  .field { display: grid; gap: 6px; }
  label { font-size: var(--text-sm); font-weight: 600; color: var(--text-2); }
  .wrap { position: relative; }
  select {
    appearance: none; width: 100%; min-height: var(--touch); padding: 10px 40px 10px 14px; border-radius: var(--radius-sm);
    border: 1px solid var(--border-strong); background: var(--surface); color: var(--text); cursor: pointer;
  }
  select:focus-visible { border-color: var(--accent); box-shadow: var(--focus); border-radius: var(--radius-sm); }
  svg { position: absolute; right: 12px; top: 50%; width: 18px; height: 18px; transform: translateY(-50%); pointer-events: none; color: var(--text-2); }
  .hint { font-size: var(--text-xs); color: var(--text-3); }
</style>
