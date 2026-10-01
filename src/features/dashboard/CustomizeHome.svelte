<script lang="ts">
  // Home has two modes. "Simple" is the default: Life OS arranges the widgets for the areas you've turned
  // on. "Customize" (this sheet) lets you choose the layout, switch widgets on/off and reorder them.
  import Modal from '../../lib/ui/Modal.svelte';
  import Button from '../../lib/ui/Button.svelte';
  import ReorderList from '../../lib/ui/ReorderList.svelte';
  import LayoutPicker from '../workspace/LayoutPicker.svelte';
  import { app } from '../../lib/app.svelte';
  import { WIDGETS } from '../../lib/modules';
  import { widgetChoices } from '../../lib/workspace';
  import { MODULE_WIDGETS } from '../../lib/db/defaults';
  import type { WidgetId } from '../../lib/db/schema';

  let { open = $bindable(false) }: { open?: boolean } = $props();
  const ws = $derived(app.workspace!);
  const items = $derived(widgetChoices(ws).map((id) => ({ id, label: WIDGETS[id].name, description: WIDGETS[id].description })));

  function reorder(ids: string[]) {
    void app.updateWorkspace({ widgets: ids.filter((id) => ws.widgets.includes(id as WidgetId)) as WidgetId[] });
  }
  function toggle(id: string, on: boolean) {
    const order = widgetChoices(ws);
    const enabled = new Set(ws.widgets);
    if (on) enabled.add(id as WidgetId); else enabled.delete(id as WidgetId);
    void app.updateWorkspace({ widgets: order.filter((x) => enabled.has(x)) });
  }
  function suggested() {
    const mods = ws.moduleOrder.filter((m) => ws.enabledModules.includes(m));
    void app.updateWorkspace({ widgets: ['quick-actions', ...mods.flatMap((m) => MODULE_WIDGETS[m]), 'week-stats'], dashboardLayout: 'balanced' });
  }
</script>

<Modal bind:open title="Customize Home" size="lg" description="Home arranges itself for the areas you use. Change that here — it only affects the cards below the top panel.">
  <div class="body">
    <section aria-labelledby="ch-l"><h3 id="ch-l">Layout</h3><LayoutPicker value={ws.dashboardLayout} onchange={(v) => void app.updateWorkspace({ dashboardLayout: v })} /></section>
    <section aria-labelledby="ch-w"><h3 id="ch-w">Cards</h3>
      <ReorderList label="Home cards" {items} enabled={ws.widgets} onreorder={reorder} ontoggle={toggle} />
    </section>
  </div>
  {#snippet footer()}
    <Button variant="ghost" onclick={suggested}>Reset to suggested</Button>
    <Button variant="primary" onclick={() => (open = false)}>Done</Button>
  {/snippet}
</Modal>

<style>
  .body { display: grid; gap: var(--space-6); }
  h3 { font-family: var(--font-body); font-size: var(--text-sm); font-weight: 700; color: var(--text-2); margin-bottom: var(--space-3); letter-spacing: 0; }
</style>
