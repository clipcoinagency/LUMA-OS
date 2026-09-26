<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  interface Props extends HTMLButtonAttributes {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    full?: boolean;
    icon?: Snippet;
    children?: Snippet;
  }
  let { variant = 'secondary', size = 'md', loading = false, full = false, icon, children, disabled, type = 'button', ...rest }: Props = $props();
</script>

<button {type} class="btn {variant} {size}" class:full disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
  {#if loading}<span class="spinner" aria-hidden="true"></span>{:else if icon}<span class="icon" aria-hidden="true">{@render icon()}</span>{/if}
  {#if children}<span class="label">{@render children()}</span>{/if}
</button>

<style>
  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: var(--space-2);
    min-height: var(--touch); padding: 0 var(--space-5); border-radius: var(--radius-btn);
    border: 1px solid transparent; font-weight: 600; font-size: var(--text-base); cursor: pointer;
    white-space: nowrap; user-select: none; -webkit-tap-highlight-color: transparent;
    transition: transform var(--dur-fast) var(--ease-out), background-color var(--dur) var(--ease-out),
      border-color var(--dur) var(--ease-out), box-shadow var(--dur) var(--ease-out), color var(--dur) var(--ease-out);
  }
  .btn:active:not(:disabled) { transform: scale(.97); }
  .btn:disabled { opacity: .55; cursor: not-allowed; }
  .btn:focus-visible { border-radius: var(--radius-btn); }
  .full { width: 100%; }
  .sm { min-height: 36px; padding: 0 var(--space-3); font-size: var(--text-sm); }
  .lg { min-height: 52px; padding: 0 var(--space-7); font-size: var(--text-md); }

  .primary { background: var(--accent); color: var(--on-accent); box-shadow: var(--shadow-1), var(--glow); }
  .primary:hover:not(:disabled) { background: var(--accent-hover); }
  .secondary { background: var(--surface); border-color: var(--border-strong); color: var(--text); }
  .secondary:hover:not(:disabled) { border-color: var(--accent); background: var(--surface-2); }
  .ghost { background: transparent; color: var(--text-2); }
  .ghost:hover:not(:disabled) { background: var(--surface-2); color: var(--text); }
  .danger { background: var(--danger); color: #fff; }
  .danger:hover:not(:disabled) { filter: brightness(1.08); }
  :global([data-theme='dark']) .danger { color: #1a0605; }

  .icon { display: inline-flex; }
  .icon :global(svg) { width: 18px; height: 18px; }
  .spinner {
    width: 16px; height: 16px; border-radius: 50%; border: 2px solid currentColor; border-right-color: transparent;
    animation: spin .7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
