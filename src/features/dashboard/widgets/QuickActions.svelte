<script lang="ts">
  // One-tap entry points, only for enabled modules.
  import type { Component } from 'svelte';
  import { CheckSquare, Repeat, Target, CalendarPlus, NotebookPen, Droplet, Wallet } from '@lucide/svelte';
  import { app } from '../../../lib/app.svelte';
  import { clock } from '../../../lib/clock.svelte';
  import { router } from '../../../lib/router.svelte';
  import { openQuick } from '../../quick/quick.svelte';
  import { getWellness, updateWellness } from '../../../lib/domain/daily';
  import { toast } from '../../../lib/ui/toast.svelte';
  import type { ModuleId } from '../../../lib/db/schema';

  interface Action { id: string; module: ModuleId; label: string; icon: Component; color: string; run: () => void }
  async function addWater() {
    const unit = app.settings?.units.water ?? 'glasses';
    const step = unit === 'ml' ? 250 : unit === 'oz' ? 8 : 1;
    const d = await getWellness(clock.today);
    const w = await updateWellness(clock.today, { water: (d.water ?? 0) + step });
    toast(`Water: ${w.water} ${unit} today`, { action: { label: 'Undo', run: () => void updateWellness(clock.today, { water: d.water }) } });
  }
  const ALL: Action[] = [
    { id: 'task', module: 'tasks', label: 'Add task', icon: CheckSquare, color: 'var(--mod-tasks)', run: () => openQuick('task') },
    { id: 'habit', module: 'habits', label: 'Habits', icon: Repeat, color: 'var(--mod-habits)', run: () => router.go({ name: 'module', module: 'habits' }) },
    { id: 'money', module: 'finance', label: 'Spending', icon: Wallet, color: 'var(--mod-finance)', run: () => openQuick('transaction') },
    { id: 'water', module: 'wellness', label: 'Add water', icon: Droplet, color: 'var(--mod-wellness)', run: () => void addWater() },
    { id: 'event', module: 'calendar', label: 'Add event', icon: CalendarPlus, color: 'var(--mod-calendar)', run: () => openQuick('event') },
    { id: 'note', module: 'notes', label: 'New note', icon: NotebookPen, color: 'var(--mod-notes)', run: () => openQuick('note') },
    { id: 'goal', module: 'goals', label: 'New goal', icon: Target, color: 'var(--mod-goals)', run: () => openQuick('goal') },
  ];
  const actions = $derived.by(() => {
    const order = app.workspace?.moduleOrder ?? [];
    const on = app.workspace?.enabledModules ?? [];
    return ALL.filter((a) => on.includes(a.module)).sort((a, b) => order.indexOf(a.module) - order.indexOf(b.module));
  });
</script>

<section class="qa" aria-label="Quick actions">
  {#each actions as a (a.id)}
    <button type="button" style="--c:{a.color}" onclick={a.run}>
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
    font-weight: 600; font-size: var(--text-sm); text-align: center; line-height: 1.25; cursor: pointer; box-shadow: var(--shadow-1);
    transition: transform var(--dur-fast) var(--ease-out), border-color var(--dur) var(--ease-out), box-shadow var(--dur) var(--ease-out);
  }
  button:hover { border-color: color-mix(in srgb, var(--c) 50%, var(--border)); box-shadow: var(--shadow-2); }
  button:active { transform: scale(.96); }
  button:focus-visible { border-radius: var(--radius-md); }
  .ico { width: 38px; height: 38px; display: grid; place-items: center; border-radius: var(--radius-sm); color: var(--c); background: color-mix(in srgb, var(--c) 14%, transparent); transition: transform var(--dur) var(--ease-emphasis); }
  button:hover .ico { transform: scale(1.06); }
  /* phones: one swipeable row instead of a wrapped grid */
  @media (max-width: 640px) {
    .qa { grid-template-columns: none; grid-auto-flow: column; grid-auto-columns: 96px; overflow-x: auto; scroll-snap-type: x mandatory;
      margin: 0 calc(-1 * var(--space-4)); padding: 2px var(--space-4) var(--space-2); scrollbar-width: none; }
    .qa::-webkit-scrollbar { display: none; }
    button { scroll-snap-align: start; }
  }
</style>
