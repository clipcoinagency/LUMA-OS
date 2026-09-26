<script lang="ts">
  // Phase 2 dashboard frame: greeting + the user's widgets in their chosen order and layout.
  // Widget bodies are filled with live data in Phase 3.
  import { Settings2 } from '@lucide/svelte';
  import Card from '../../lib/ui/Card.svelte';
  import Button from '../../lib/ui/Button.svelte';
  import { app } from '../../lib/app.svelte';
  import { router } from '../../lib/router.svelte';
  import { MODULES, WIDGETS } from '../../lib/modules';
  import { visibleWidgets } from '../../lib/workspace';
  import { formatDateKey, today } from '../../lib/util/dates';

  const widgets = $derived(visibleWidgets(app.workspace!));
  const layout = $derived(app.workspace!.dashboardLayout);
  const name = $derived(app.settings!.displayName);

  function greeting(): string {
    const h = new Date().getHours();
    return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  }
</script>

<header class="hello">
  <p class="date">{formatDateKey(today())}</p>
  <h1>{greeting()}{name ? `, ${name}` : ''}</h1>
</header>

{#if widgets.length === 0}
  <Card>
    <div class="none">
      <p>Your dashboard is empty. Pick the widgets you want to see.</p>
      <Button variant="primary" onclick={() => router.go({ name: 'settings' })}>{#snippet icon()}<Settings2 />{/snippet}Choose widgets</Button>
    </div>
  </Card>
{:else}
  <div class="grid {layout}">
    {#each widgets as id, i (id)}
      {@const wd = WIDGETS[id]}
      {@const mod = wd.module ? MODULES[wd.module] : null}
      <div class="cell" class:wide={i === 0 && layout !== 'focus'} style="--i:{i}">
        <Card title={wd.name}>
          <div class="placeholder" style="--c:{mod?.color ?? 'var(--accent)'}">
            {#if mod}<span class="ico" aria-hidden="true"><mod.icon size={20} /></span>{/if}
            <p class="meta">{wd.description}</p>
          </div>
        </Card>
      </div>
    {/each}
  </div>
{/if}

<style>
  .hello { display: grid; gap: var(--space-1); margin-bottom: var(--space-6); }
  .date { color: var(--text-2); font-weight: 600; }
  h1 { font-size: clamp(var(--text-2xl), 5vw, var(--text-3xl)); }
  .grid { display: grid; gap: var(--space-4); }
  .focus { grid-template-columns: minmax(0, 720px); }
  .balanced { grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr)); }
  .compact { grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr)); gap: var(--space-3); }
  @media (min-width: 900px) { .balanced .wide { grid-column: span 2; } }
  .cell { animation: rise var(--dur-slow) var(--ease-out) both; animation-delay: calc(var(--i) * 45ms); }
  @keyframes rise { from { opacity: 0; transform: translateY(8px); } }
  .placeholder { display: flex; align-items: center; gap: var(--space-3); min-height: 64px; }
  .ico { width: 40px; height: 40px; border-radius: var(--radius-md); display: grid; place-items: center; color: var(--c); background: color-mix(in srgb, var(--c) 14%, transparent); flex: none; }
  .none { display: grid; gap: var(--space-4); justify-items: start; }
</style>
