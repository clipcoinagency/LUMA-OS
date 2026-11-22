<script lang="ts">
  import type { Snippet } from 'svelte';
  interface Props { tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'; children: Snippet }
  let { tone = 'neutral', children }: Props = $props();
</script>

<span class="badge {tone}">{@render children()}</span>

<style>
  .badge {
    display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px; border-radius: 999px;
    font-size: var(--text-xs); font-weight: 650; line-height: 1.4; white-space: nowrap;
  }
  .neutral { background: var(--surface-3); color: var(--text-2); }
  .accent { background: var(--accent-soft); color: var(--accent-ink); }
  .success { background: var(--success-soft); color: var(--success); }
  .warning { background: var(--warning-soft); color: var(--warning); }
  .danger { background: var(--danger-soft); color: var(--danger); }
  .info { background: var(--info-soft); color: var(--info); }

  /* ---- Almanac ---------------------------------------------------------------- */
  :global(:root[data-style='almanac']) .badge { border-radius: 0; background: none; border: 1px solid currentColor; padding: 1px 6px; font: 500 10px/1.5 var(--font-mono); letter-spacing: .1em; text-transform: uppercase; }
  :global(:root[data-style='almanac']) .neutral { color: var(--text-2); border-color: var(--border-strong); }
</style>
