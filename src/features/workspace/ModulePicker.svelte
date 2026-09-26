<script lang="ts">
  // Big, tappable module cards. Each card is a checkbox; at least one module must stay on.
  import { Check } from '@lucide/svelte';
  import { MODULE_IDS, type ModuleId } from '../../lib/db/schema';
  import { MODULES } from '../../lib/modules';

  interface Props { selected: ModuleId[]; onchange: (next: ModuleId[]) => void }
  let { selected, onchange }: Props = $props();
  let hint = $state('');

  function toggle(id: ModuleId) {
    const on = selected.includes(id);
    if (on && selected.length === 1) {
      hint = 'Keep at least one module — you can change this any time.';
      return;
    }
    hint = '';
    // keep canonical order for newly added modules; existing order is preserved
    onchange(on ? selected.filter((m) => m !== id) : MODULE_IDS.filter((m) => m === id || selected.includes(m)));
  }
</script>

<div class="grid" role="group" aria-label="Modules">
  {#each MODULE_IDS as id (id)}
    {@const m = MODULES[id]}
    {@const on = selected.includes(id)}
    <button type="button" role="checkbox" aria-checked={on} class="card" class:on style="--c:{m.color}" onclick={() => toggle(id)}>
      <span class="ico" aria-hidden="true"><m.icon size={22} /></span>
      <span class="text">
        <span class="name">{m.name}</span>
        <span class="tag">{m.tagline}</span>
      </span>
      <span class="tick" aria-hidden="true"><Check size={16} strokeWidth={3} /></span>
    </button>
  {/each}
</div>
<p class="hint" aria-live="polite">{hint}</p>

<style>
  .grid { display: grid; gap: var(--space-3); grid-template-columns: repeat(auto-fill, minmax(min(100%, 250px), 1fr)); }
  .card {
    position: relative; display: flex; align-items: center; gap: var(--space-3); text-align: left; cursor: pointer;
    padding: var(--space-4); min-height: 76px; border-radius: var(--radius-lg); border: 1.5px solid var(--border);
    background: var(--surface); color: var(--text); box-shadow: var(--shadow-1);
    transition: border-color var(--dur) var(--ease-out), background-color var(--dur) var(--ease-out), transform var(--dur-fast) var(--ease-out), box-shadow var(--dur) var(--ease-out);
  }
  .card:hover { border-color: color-mix(in srgb, var(--c) 55%, var(--border)); box-shadow: var(--shadow-2); }
  .card:active { transform: scale(.985); }
  .card:focus-visible { border-radius: var(--radius-lg); }
  .card.on { border-color: var(--c); background: color-mix(in srgb, var(--c) 7%, var(--surface)); }
  .ico {
    width: 44px; height: 44px; flex: none; display: grid; place-items: center; border-radius: var(--radius-md);
    color: var(--c); background: color-mix(in srgb, var(--c) 14%, transparent); transition: transform var(--dur) var(--ease-emphasis);
  }
  .on .ico { transform: scale(1.04); }
  .text { display: grid; gap: 2px; min-width: 0; flex: 1; }
  .name { font-weight: 650; }
  .tag { font-size: var(--text-sm); color: var(--text-2); }
  .tick {
    width: 24px; height: 24px; flex: none; border-radius: 50%; display: grid; place-items: center;
    border: 1.5px solid var(--border-strong); color: transparent;
    transition: background-color var(--dur) var(--ease-out), border-color var(--dur) var(--ease-out), color var(--dur) var(--ease-out), transform var(--dur) var(--ease-emphasis);
  }
  .on .tick { background: var(--c); border-color: var(--c); color: var(--surface); transform: scale(1.05); }
  .hint { min-height: 1.5em; margin-top: var(--space-2); font-size: var(--text-sm); color: var(--warning); font-weight: 600; }
</style>
