<script lang="ts">
  import Modal from '../../lib/ui/Modal.svelte';
  import Button from '../../lib/ui/Button.svelte';
  import TextField from '../../lib/ui/TextField.svelte';
  import Segmented from '../../lib/ui/Segmented.svelte';
  import { toast } from '../../lib/ui/toast.svelte';
  import { createTask } from '../../lib/domain/tasks';
  import { addDays, today } from '../../lib/util/dates';
  import type { Priority } from '../../lib/db/schema';

  let { open = $bindable(false) }: { open?: boolean } = $props();
  let title = $state('');
  let when = $state('today');
  let date = $state(addDays(today(), 2));
  let priority = $state<string>('none');
  let error = $state('');
  let saving = $state(false);

  $effect(() => { if (!open) { title = ''; when = 'today'; priority = 'none'; error = ''; } });

  async function save(e?: Event) {
    e?.preventDefault();
    if (!title.trim()) { error = 'Give your task a name.'; return; }
    saving = true;
    try {
      const due = when === 'today' ? today() : when === 'tomorrow' ? addDays(today(), 1) : when === 'date' ? date : null;
      await createTask({ title, dueDate: due, priority: priority as Priority });
      toast('Task added', { tone: 'success' });
      open = false;
    } finally { saving = false; }
  }
</script>

<Modal bind:open title="New task" size="sm">
  <form class="form" onsubmit={save}>
    <TextField label="Task" bind:value={title} placeholder="What needs doing?" maxlength={200} error={error} oninput={() => (error = '')} />
    <div class="field"><span class="lbl">When</span>
      <Segmented label="When" size="sm" bind:value={when} options={[{ value: 'today', label: 'Today' }, { value: 'tomorrow', label: 'Tomorrow' }, { value: 'date', label: 'Pick date' }, { value: 'none', label: 'Someday' }]} />
    </div>
    {#if when === 'date'}<TextField label="Due date" type="date" bind:value={date} />{/if}
    <div class="field"><span class="lbl">Priority</span>
      <Segmented label="Priority" size="sm" bind:value={priority} options={[{ value: 'none', label: 'None' }, { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }]} />
    </div>
    <button type="submit" hidden aria-hidden="true" tabindex="-1"></button>
  </form>
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (open = false)}>Cancel</Button>
    <Button variant="primary" loading={saving} onclick={() => save()}>Add task</Button>
  {/snippet}
</Modal>

<style>
  .form { display: grid; gap: var(--space-4); }
  .field { display: grid; gap: 6px; }
  .lbl { font-size: var(--text-sm); font-weight: 600; color: var(--text-2); }
</style>
