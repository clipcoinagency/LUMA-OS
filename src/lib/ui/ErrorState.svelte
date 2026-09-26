<script lang="ts">
  // Friendly failure with a recovery path. Raw errors live behind "Technical details" only.
  import type { Snippet } from 'svelte';
  interface Props { title: string; message: string; details?: string; actions?: Snippet }
  let { title, message, details, actions }: Props = $props();
</script>

<div class="err" role="alert">
  <div class="icon" aria-hidden="true">
    <svg viewBox="0 0 24 24"><path d="M12 8v5m0 3.5v.01M10.3 3.9L2.4 17.6A2 2 0 004.1 20.6h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" /></svg>
  </div>
  <h2>{title}</h2>
  <p>{message}</p>
  {#if actions}<div class="actions">{@render actions()}</div>{/if}
  {#if details}
    <details><summary>Technical details</summary><code>{details}</code></details>
  {/if}
</div>

<style>
  .err { display: grid; justify-items: center; text-align: center; gap: var(--space-3); max-width: 460px; margin: 0 auto; padding: var(--space-7) var(--space-5); }
  .icon { width: 56px; height: 56px; border-radius: var(--radius-lg); display: grid; place-items: center; background: var(--danger-soft); color: var(--danger); }
  svg { width: 26px; height: 26px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  p { color: var(--text-2); }
  .actions { display: flex; gap: var(--space-2); flex-wrap: wrap; justify-content: center; margin-top: var(--space-2); }
  details { font-size: var(--text-sm); color: var(--text-3); margin-top: var(--space-3); }
  summary { cursor: pointer; }
  code { display: block; margin-top: var(--space-2); font-family: var(--font-mono); white-space: pre-wrap; text-align: left; }
</style>
