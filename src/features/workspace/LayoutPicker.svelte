<script lang="ts">
  // Dashboard layout: each option shows a tiny diagram of how the dashboard will be arranged.
  import type { Workspace } from '../../lib/db/schema';

  type Layout = Workspace['dashboardLayout'];
  interface Props { value: Layout; onchange: (v: Layout) => void }
  let { value, onchange }: Props = $props();

  const options: { id: Layout; name: string; desc: string }[] = [
    { id: 'focus', name: 'Focus', desc: 'One column. Today first, fewer distractions.' },
    { id: 'balanced', name: 'Balanced', desc: 'A calm grid with room to breathe.' },
    { id: 'compact', name: 'Compact', desc: 'Everything at a glance, denser cards.' },
  ];
</script>

<div class="grid" role="radiogroup" aria-label="Dashboard layout">
  {#each options as o (o.id)}
    <button type="button" role="radio" aria-checked={value === o.id} class="opt" class:on={value === o.id} onclick={() => onchange(o.id)}>
      <span class="diagram {o.id}" aria-hidden="true">
        {#each Array(o.id === 'focus' ? 3 : o.id === 'balanced' ? 4 : 6) as _, i (i)}<span></span>{/each}
      </span>
      <span class="name">{o.name}</span>
      <span class="desc">{o.desc}</span>
    </button>
  {/each}
</div>

<style>
  .grid { display: grid; gap: var(--space-3); grid-template-columns: repeat(auto-fit, minmax(min(100%, 170px), 1fr)); }
  .opt {
    display: grid; gap: var(--space-2); text-align: left; padding: var(--space-4); border-radius: var(--radius-lg); cursor: pointer;
    border: 1.5px solid var(--border); background: var(--surface); color: var(--text);
    transition: border-color var(--dur) var(--ease-out), transform var(--dur-fast) var(--ease-out), background-color var(--dur);
  }
  .opt:active { transform: scale(.98); }
  .opt:focus-visible { border-radius: var(--radius-lg); }
  .opt.on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 6%, var(--surface)); }
  .diagram { display: grid; gap: 4px; height: 64px; padding: 6px; border-radius: var(--radius-sm); background: var(--surface-2); }
  .diagram span { border-radius: 4px; background: var(--border-strong); transition: background-color var(--dur); }
  .on .diagram span:first-child { background: var(--accent); }
  .focus { grid-template-columns: 1fr; }
  .balanced { grid-template-columns: 1.4fr 1fr; }
  .compact { grid-template-columns: repeat(3, 1fr); }
  .name { font-weight: 650; }
  .desc { font-size: var(--text-sm); color: var(--text-2); }
</style>
