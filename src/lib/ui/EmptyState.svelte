<script lang="ts">
  import type { Snippet } from 'svelte';
  interface Props { title: string; body?: string; icon?: Snippet; action?: Snippet; compact?: boolean }
  let { title, body, icon, action, compact = false }: Props = $props();
</script>

<div class="empty" class:compact>
  {#if icon}<div class="art" aria-hidden="true">{@render icon()}</div>{/if}
  <p class="title">{title}</p>
  {#if body}<p class="body">{body}</p>{/if}
  {#if action}<div class="action">{@render action()}</div>{/if}
</div>

<style>
  .empty { display: grid; justify-items: center; text-align: center; gap: var(--space-2); padding: var(--space-8) var(--space-5); }
  .compact { padding: var(--space-5) var(--space-3); }
  .art {
    width: 56px; height: 56px; border-radius: var(--radius-lg); display: grid; place-items: center;
    background: var(--accent-soft); color: var(--accent-ink); margin-bottom: var(--space-2); box-shadow: var(--glow);
  }
  .compact .art { width: 44px; height: 44px; }
  .art :global(svg) { width: 26px; height: 26px; }
  .title { font-family: var(--font-display); font-weight: var(--display-weight); font-size: var(--text-md); }
  .body { color: var(--text-2); max-width: 36ch; }
  .action { margin-top: var(--space-3); }
</style>
