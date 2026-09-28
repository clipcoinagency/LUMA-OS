<script lang="ts">
  import { Search, X } from '@lucide/svelte';
  interface Props { value?: string; label?: string; placeholder?: string }
  let { value = $bindable(''), label = 'Search', placeholder = 'Search…' }: Props = $props();
</script>

<label class="search">
  <Search size={18} aria-hidden="true" />
  <span class="sr-only">{label}</span>
  <input type="search" bind:value {placeholder} onkeydown={(e) => { if (e.key === 'Escape') value = ''; }} />
  {#if value}<button type="button" aria-label="Clear search" onclick={() => (value = '')}><X size={16} /></button>{/if}
</label>

<style>
  .search { display: flex; align-items: center; gap: var(--space-2); min-height: var(--touch); padding: 0 var(--space-2) 0 var(--space-3); border-radius: var(--radius-btn); border: 1px solid var(--border-strong); background: var(--surface); color: var(--text-3); min-width: 0; }
  :global([data-theme='dark']) .search { border-radius: var(--radius-sm); }
  .search:focus-within { border-color: var(--accent); box-shadow: var(--focus); color: var(--accent-ink); }
  input { flex: 1; min-width: 0; border: 0; background: none; min-height: 40px; outline: none; color: var(--text); }
  input::-webkit-search-cancel-button { display: none; }
  button { width: 32px; height: 32px; display: grid; place-items: center; border: 0; background: none; color: var(--text-3); cursor: pointer; border-radius: 50%; }
  button:hover { background: var(--surface-2); color: var(--text); }
</style>
