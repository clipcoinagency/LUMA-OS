<script lang="ts">
  import type { Snippet } from 'svelte';
  import { MODULES } from '../../lib/modules';
  import type { ModuleId } from '../../lib/db/schema';

  interface Props { module: ModuleId; subtitle?: string; actions?: Snippet }
  let { module, subtitle, actions }: Props = $props();
  const m = $derived(MODULES[module]);
</script>

<header class="ph" style="--c:{m.color}">
  <span class="ico" aria-hidden="true"><m.icon size={24} /></span>
  <div class="t">
    <h1>{m.name}</h1>
    <p class="muted">{subtitle ?? m.tagline}</p>
  </div>
  {#if actions}<div class="acts">{@render actions()}</div>{/if}
</header>

<style>
  .ph { display: flex; align-items: center; gap: var(--space-4); margin-bottom: var(--space-5); flex-wrap: wrap; }
  .ico { width: 52px; height: 52px; border-radius: var(--radius-lg); display: grid; place-items: center; color: var(--c); background: color-mix(in srgb, var(--c) 14%, transparent); box-shadow: var(--glow); flex: none; }
  .t { flex: 1; min-width: 180px; }
  .acts { display: flex; gap: var(--space-2); flex-wrap: wrap; }
</style>
