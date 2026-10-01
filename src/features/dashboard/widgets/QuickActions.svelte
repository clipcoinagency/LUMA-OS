<script lang="ts">
  // One-tap entry points, only for enabled modules.
  import { enabledQuickActions } from '../../quick/actions';

  let { onrun, wrap = false }: { onrun?: () => void; wrap?: boolean } = $props();
  const actions = $derived(enabledQuickActions(wrap));
</script>

<section class="qa" class:wrap aria-label="Quick actions">
  {#each actions as a (a.id)}
    <button type="button" style="--c:{a.color}" onclick={() => { onrun?.(); a.run(); }}>
      <span class="ico" aria-hidden="true"><a.icon size={20} /></span>
      <span>{a.label}</span>
    </button>
  {/each}
</section>

<style>
  .qa { display: grid; grid-template-columns: repeat(auto-fit, minmax(104px, 1fr)); gap: var(--space-2); }
  button {
    display: grid; justify-items: center; align-content: center; gap: 6px; min-height: 84px; padding: var(--space-3) var(--space-2);
    border-radius: var(--radius-md); border: 1px solid var(--border); background: var(--surface); color: var(--text);
    font-weight: 600; font-size: var(--text-sm); text-align: center; line-height: 1.25; cursor: pointer;
    box-shadow: var(--solid-highlight), var(--shadow-1);
    transition: transform var(--dur-fast) var(--ease-out), border-color var(--dur) var(--ease-out), box-shadow var(--dur) var(--ease-out);
  }
  button:hover { border-color: color-mix(in srgb, var(--c) 50%, var(--border)); box-shadow: var(--solid-highlight), var(--shadow-2); }
  button:active { transform: scale(.96); }
  button:focus-visible { border-radius: var(--radius-md); }
  .ico { width: 38px; height: 38px; display: grid; place-items: center; border-radius: var(--radius-sm); color: var(--c); background: color-mix(in srgb, var(--c) 14%, transparent); transition: transform var(--dur) var(--ease-emphasis); }
  button:hover .ico { transform: scale(1.06); }
  /* phones: one swipeable row instead of a wrapped grid */
  @media (max-width: 640px) {
    .qa:not(.wrap) { grid-template-columns: none; grid-auto-flow: column; grid-auto-columns: 96px; overflow-x: auto; scroll-snap-type: x mandatory;
      margin: 0 calc(-1 * var(--space-4)); padding: 2px var(--space-4) var(--space-2); scrollbar-width: none; }
    .qa:not(.wrap)::-webkit-scrollbar { display: none; }
    .qa:not(.wrap) button { scroll-snap-align: start; }
    .qa.wrap { grid-template-columns: repeat(3, 1fr); }
  }
</style>
