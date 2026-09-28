<script lang="ts">
  import { fly } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import { toasts, dismiss } from './toast.svelte';
  import { dur } from '../motion';
</script>

<div class="toaster" role="status" aria-live="polite">
  {#each toasts as t (t.id)}
    <div class="toast {t.tone}" in:fly={{ y: 16, duration: dur(200) }} out:fly={{ y: 8, duration: dur(150) }} animate:flip={{ duration: dur(200) }}>
      <span>{t.message}</span>
      {#if t.action}
        <button type="button" onclick={() => { t.action?.run(); dismiss(t.id); }}>{t.action.label}</button>
      {/if}
    </div>
  {/each}
</div>

<style>
  .toaster {
    position: fixed; z-index: var(--z-toast); left: 50%; transform: translateX(-50%);
    bottom: calc(max(16px, env(safe-area-inset-bottom)) + var(--toast-offset, 0px));
    display: grid; gap: var(--space-2); width: min(440px, calc(100vw - 32px)); pointer-events: none;
  }
  .toast {
    pointer-events: auto; display: flex; align-items: center; justify-content: space-between; gap: var(--space-3);
    padding: 12px 16px; border-radius: var(--radius-md); background: var(--text); color: var(--bg);
    box-shadow: var(--shadow-3); font-weight: 550;
  }
  :global([data-theme='dark']) .toast { background: var(--surface-3); color: var(--text); border: 1px solid var(--border-strong); }
  .success { border-left: 4px solid var(--success); }
  .danger { border-left: 4px solid var(--danger); }
  button { background: none; border: 0; color: inherit; font-weight: 700; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; min-height: 32px; padding: 0 4px; }
</style>
