<script lang="ts">
  interface Props { checked?: boolean; label: string; description?: string; disabled?: boolean; onchange?: (v: boolean) => void }
  let { checked = $bindable(false), label, description, disabled = false, onchange }: Props = $props();
  const uid = `sw-${Math.random().toString(36).slice(2, 8)}`;
  function toggle() {
    if (disabled) return;
    checked = !checked;
    onchange?.(checked);
  }
</script>

<div class="row">
  <span class="text">
    <span class="label" id="{uid}-l">{label}</span>
    {#if description}<span class="desc" id="{uid}-d">{description}</span>{/if}
  </span>
  <button type="button" role="switch" aria-checked={checked} aria-labelledby="{uid}-l" aria-describedby={description ? `${uid}-d` : undefined}
    class="switch" class:on={checked} {disabled} onclick={toggle}>
    <span class="thumb"></span>
  </button>
</div>

<style>
  .row { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); min-height: var(--touch); }
  .text { display: grid; gap: 2px; min-width: 0; }
  .label { font-weight: 600; }
  .desc { font-size: var(--text-sm); color: var(--text-2); }
  .switch {
    position: relative; flex: none; width: 50px; height: 30px; border-radius: 999px; border: 1px solid var(--border-strong);
    background: var(--surface-3); cursor: pointer; padding: 0;
    transition: background-color var(--dur) var(--ease-out), border-color var(--dur) var(--ease-out), box-shadow var(--dur) var(--ease-out);
  }
  .switch:focus-visible { border-radius: 999px; }
  .thumb {
    position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: 50%;
    background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, .25); transition: transform var(--dur) var(--ease-emphasis);
  }
  .on { background: var(--accent); border-color: var(--accent); box-shadow: var(--glow); }
  .on .thumb { transform: translateX(20px); }
  :global([data-theme='dark']) .on .thumb { background: var(--on-accent); }
  .switch:disabled { opacity: .5; cursor: not-allowed; }
</style>
