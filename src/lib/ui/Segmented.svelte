<script lang="ts">
  // Single-choice segmented control: radio-group semantics, roving tabindex, arrow keys.
  interface Option { value: string; label: string }
  interface Props { label: string; options: Option[]; value?: string; onchange?: (v: string) => void; size?: 'sm' | 'md' }
  let { label, options, value = $bindable(''), onchange, size = 'md' }: Props = $props();
  let buttons: HTMLButtonElement[] = $state([]);
  const index = $derived(Math.max(0, options.findIndex((o) => o.value === value)));

  function select(i: number, focus = false) {
    const o = options[i];
    if (!o) return;
    value = o.value;
    onchange?.(o.value);
    if (focus) buttons[i]?.focus();
  }
  function onkey(e: KeyboardEvent) {
    const n = options.length;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); select((index + 1) % n, true); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); select((index - 1 + n) % n, true); }
  }
</script>

<div class="seg {size}" role="radiogroup" aria-label={label} tabindex="-1" onkeydown={onkey} style="--n:{options.length};--i:{index}">
  <span class="pill" aria-hidden="true"></span>
  {#each options as o, i (o.value)}
    <button bind:this={buttons[i]} type="button" role="radio" aria-checked={o.value === value}
      tabindex={o.value === value || (!value && i === 0) ? 0 : -1} onclick={() => select(i)}>{o.label}</button>
  {/each}
</div>

<style>
  .seg {
    position: relative; display: grid; grid-template-columns: repeat(var(--n), 1fr); padding: 4px;
    border-radius: calc(var(--radius-btn) + 4px); background: var(--surface-2); border: 1px solid var(--border);
  }
  :global([data-theme='dark']) .seg { border-radius: calc(var(--radius-sm) + 2px); }
  .pill {
    position: absolute; top: 4px; bottom: 4px; left: 4px; width: calc((100% - 8px) / var(--n));
    transform: translateX(calc(var(--i) * 100%)); border-radius: var(--radius-btn); background: var(--surface);
    box-shadow: var(--shadow-1), var(--glow); transition: transform var(--dur-slow) var(--ease-out);
  }
  :global([data-theme='dark']) .pill { border-radius: var(--radius-sm); background: var(--surface-3); }
  button {
    position: relative; z-index: 1; min-height: 40px; border: 0; background: none; cursor: pointer; font-weight: 600;
    color: var(--text-2); border-radius: var(--radius-btn); padding: 0 var(--space-3); transition: color var(--dur) var(--ease-out);
  }
  .sm button { min-height: 32px; font-size: var(--text-sm); }
  button[aria-checked='true'] { color: var(--text); }
</style>
