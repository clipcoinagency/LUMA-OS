<script lang="ts">
  import type { Snippet } from 'svelte';
  import { ChevronRight } from '@lucide/svelte';
  import { MODULES } from '../../lib/modules';
  import Skeleton from '../../lib/ui/Skeleton.svelte';
  import { spotlight } from '../../lib/ui/spotlight';
  import { href } from '../../lib/router.svelte';
  import type { ModuleId } from '../../lib/db/schema';

  interface Props { title: string; module?: ModuleId; loaded?: boolean; actions?: Snippet; children: Snippet }
  let { title, module, loaded = true, actions, children }: Props = $props();
  const uid = `w-${Math.random().toString(36).slice(2, 8)}`;
</script>

<section class="wc gcard lift" style={module ? `--c:${MODULES[module].color}` : undefined} use:spotlight aria-labelledby={uid}>
  <header>
    <div class="ttl">
      {#if module}{@const Icon = MODULES[module].icon}<span class="chip" style="--c:{MODULES[module].color}" aria-hidden="true"><Icon size={15} /></span>{/if}
      <h2 id={uid}>{title}</h2>
    </div>
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
  .wc { padding: var(--space-5); height: 100%; display: flex; flex-direction: column; }
  .ttl { display: flex; align-items: center; gap: var(--space-2); min-width: 0; }
  .chip {
    width: 30px; height: 30px; border-radius: 10px; display: grid; place-items: center; flex: none; color: var(--c);
    background: linear-gradient(145deg, color-mix(in srgb, var(--c) 30%, transparent), color-mix(in srgb, var(--c) 9%, transparent));
    box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 35%, transparent), 0 4px 14px color-mix(in srgb, var(--c) 22%, transparent);
    transition: transform .5s var(--ease-glide);
  }
  .wc:hover .chip { transform: rotate(-6deg) scale(1.08); }
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
