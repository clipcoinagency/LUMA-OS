<script lang="ts">
  // Phase 2 module frame; each module's real screens arrive in Phase 4.
  import Card from '../../lib/ui/Card.svelte';
  import EmptyState from '../../lib/ui/EmptyState.svelte';
  import { MODULES } from '../../lib/modules';
  import type { ModuleId } from '../../lib/db/schema';

  let { module }: { module: ModuleId } = $props();
  const m = $derived(MODULES[module]);
</script>

<header class="head" style="--c:{m.color}">
  <span class="ico" aria-hidden="true"><m.icon size={24} /></span>
  <div>
    <h1>{m.name}</h1>
    <p class="muted">{m.tagline}</p>
  </div>
</header>
<Card>
  <EmptyState title="{m.name} is being built" body="This module's screens arrive in the next build. Your workspace settings are already saved.">
    {#snippet icon()}<m.icon />{/snippet}
  </EmptyState>
</Card>

<style>
  .head { display: flex; align-items: center; gap: var(--space-4); margin-bottom: var(--space-6); }
  .ico { width: 52px; height: 52px; border-radius: var(--radius-lg); display: grid; place-items: center; color: var(--c); background: color-mix(in srgb, var(--c) 14%, transparent); box-shadow: var(--glow); flex: none; }
</style>
