<script lang="ts">
  // Round "complete" check used for tasks and habits: animated tick, announced as a checkbox.
  interface Props { checked?: boolean; label: string; hideLabel?: boolean; color?: string; size?: number; id?: string; onchange?: (v: boolean) => void }
  let { checked = $bindable(false), label, hideLabel = true, color, size = 26, id, onchange }: Props = $props();
  function toggle() {
    checked = !checked;
    onchange?.(checked);
  }
</script>

<button type="button" {id} role="checkbox" aria-checked={checked} class="cb" class:on={checked}
  style="--c:{color ?? 'var(--accent)'};--s:{size}px" onclick={toggle} aria-label={hideLabel ? label : undefined}>
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12.5l4 4 8-9" /></svg>
  {#if !hideLabel}<span>{label}</span>{/if}
</button>

<style>
  .cb {
    display: inline-flex; align-items: center; justify-content: center; gap: var(--space-2); background: none; border: 0; padding: 0;
    cursor: pointer; min-height: var(--touch); min-width: var(--touch); color: var(--text);
  }
  svg {
    width: var(--s); height: var(--s); border-radius: 50%; border: 2px solid var(--border-strong); padding: 3px; flex: none;
    transition: background-color var(--dur) var(--ease-out), border-color var(--dur) var(--ease-out), transform var(--dur-fast) var(--ease-out);
  }
  path {
    fill: none; stroke: transparent; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round;
    stroke-dasharray: 20; stroke-dashoffset: 20;
    transition: stroke-dashoffset var(--dur-slow) var(--ease-out) 60ms, stroke var(--dur-fast);
  }
  .cb:hover svg { border-color: var(--c); }
  .cb:active svg { transform: scale(.9); }
  .on svg { background: var(--c); border-color: var(--c); }
  .on path { stroke: var(--on-accent); stroke-dashoffset: 0; }
</style>
