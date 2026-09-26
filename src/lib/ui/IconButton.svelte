<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  interface Props extends HTMLButtonAttributes {
    label: string; // required: icon-only buttons must be named for screen readers
    variant?: 'ghost' | 'soft' | 'primary';
    children: Snippet;
  }
  let { label, variant = 'ghost', children, type = 'button', ...rest }: Props = $props();
</script>

<button {type} class="ib {variant}" aria-label={label} title={label} {...rest}>{@render children()}</button>

<style>
  .ib {
    display: inline-grid; place-items: center; width: var(--touch); height: var(--touch); flex: none;
    border-radius: var(--radius-sm); border: 1px solid transparent; cursor: pointer; color: var(--text-2);
    background: transparent;
    transition: background-color var(--dur) var(--ease-out), color var(--dur) var(--ease-out), transform var(--dur-fast) var(--ease-out);
  }
  .ib:hover { background: var(--surface-2); color: var(--text); }
  .ib:active { transform: scale(.94); }
  .ib :global(svg) { width: 20px; height: 20px; }
  .soft { background: var(--surface-2); }
  .primary { background: var(--accent); color: var(--on-accent); }
  .primary:hover { background: var(--accent-hover); color: var(--on-accent); }
</style>
