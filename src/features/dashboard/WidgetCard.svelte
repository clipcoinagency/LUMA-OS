<script lang="ts">
  import type { Snippet } from 'svelte';
  import { ChevronRight } from '@lucide/svelte';
  import Skeleton from '../../lib/ui/Skeleton.svelte';
  import { href } from '../../lib/router.svelte';
  import type { ModuleId } from '../../lib/db/schema';

  interface Props { title: string; module?: ModuleId; loaded?: boolean; actions?: Snippet; children: Snippet }
  let { title, module, loaded = true, actions, children }: Props = $props();
  const uid = `w-${Math.random().toString(36).slice(2, 8)}`;
</script>

<section class="wc" aria-labelledby={uid}>
  <header>
    <h2 id={uid}>{title}</h2>
    <div class="acts">
      {@render actions?.()}
      {#if module}<a class="open" href={href({ name: 'module', module })} aria-label="Open {title}">Open<ChevronRight size={16} aria-hidden="true" /></a>{/if}
    </div>
  </header>
  {#if loaded}
    <div class="body">{@render children()}</div>
  {:else}
    <div class="body" aria-busy="true"><Skeleton lines={3} /></div>
  {/if}
</section>

<style>
  .wc {
    background: var(--surface); border: var(--card-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-1);
    padding: var(--space-5); min-width: 0; height: 100%; display: flex; flex-direction: column;
    transition: transform var(--dur) var(--ease-out), box-shadow var(--dur) var(--ease-out), border-color var(--dur) var(--ease-out);
  }
  .wc:hover { transform: translateY(-2px); box-shadow: var(--shadow-2), var(--glow); border-color: var(--border-strong); }
  header { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); margin-bottom: var(--space-4); min-height: 28px; }
  h2 { font-size: var(--text-md); }
  .acts { display: flex; align-items: center; gap: var(--space-1); }
  .open { display: inline-flex; align-items: center; gap: 2px; font-size: var(--text-sm); font-weight: 600; color: var(--text-2); text-decoration: none; padding: 6px 8px; border-radius: var(--radius-xs); }
  .open:hover { color: var(--accent-ink); background: var(--surface-2); }
  .body { flex: 1; min-width: 0; animation: in var(--dur-slow) var(--ease-out); }
  @keyframes in { from { opacity: 0; } }
  :global(.compact) .wc { padding: var(--space-4); }
  :global(.compact) header { margin-bottom: var(--space-3); }
</style>
