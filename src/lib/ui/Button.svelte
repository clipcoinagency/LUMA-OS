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
  .primary:hover:not(:disabled) { background: var(--accent-hover); transform: translateY(-1px); box-shadow: var(--shadow-2), var(--glow); }
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

  /* ---- Almanac ---------------------------------------------------------------- */
  :global(:root[data-style='almanac']) .btn { font-weight: 560; letter-spacing: .005em; }
  :global(:root[data-style='almanac']) .primary { background: var(--text); color: var(--bg); box-shadow: none; }
  :global(:root[data-style='almanac']) .primary:hover:not(:disabled) { background: var(--accent); color: var(--on-accent); transform: translate(-2px, -2px); box-shadow: 3px 3px 0 var(--text); }
  :global(:root[data-style='almanac']) .secondary { background: transparent; border-color: var(--text); color: var(--text); }
  :global(:root[data-style='almanac']) .secondary:hover:not(:disabled) { background: var(--text); color: var(--bg); border-color: var(--text); }
  :global(:root[data-style='almanac']) .ghost { color: var(--text-2); }
  :global(:root[data-style='almanac']) .ghost:hover:not(:disabled) { background: none; color: var(--text); text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 4px; }
  :global(:root[data-style='almanac']) .danger { background: var(--danger); color: #fff; }

  /* ---- Nebula (liquid glass) ---------------------------------------------------- */
  :global(:root[data-style='nebula']) .primary { background: var(--accent-grad); color: #fff; box-shadow: 0 8px 24px rgba(123, 97, 255, .35), inset 0 1px 0 rgba(255, 255, 255, .35); position: relative; overflow: hidden; }
  :global(:root[data-style='nebula']) .primary::after { content: ''; position: absolute; inset: 0; background: linear-gradient(100deg, transparent 30%, rgba(255, 255, 255, .35) 50%, transparent 70%); transform: translateX(-120%); transition: transform .7s var(--ease-glide); }
  :global(:root[data-style='nebula']) .primary:hover:not(:disabled) { background: var(--accent-grad); transform: translateY(-1px); box-shadow: 0 12px 32px rgba(123, 97, 255, .5), 0 0 30px rgba(255, 113, 200, .25), inset 0 1px 0 rgba(255, 255, 255, .4); }
  :global(:root[data-style='nebula']) .primary:hover:not(:disabled)::after { transform: translateX(120%); }
  :global(:root[data-style='nebula']) .secondary { background: rgba(255, 255, 255, .05); border-color: rgba(214, 190, 255, .28); -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px); }
  :global(:root[data-style='nebula']) .secondary:hover:not(:disabled) { border-color: var(--accent); background: rgba(183, 140, 255, .1); }
  :global(:root[data-style='nebula']) .danger { color: #1a0610; }
</style>
