<script lang="ts">
  import Modal from '../../lib/ui/Modal.svelte';
  import Button from '../../lib/ui/Button.svelte';
  import TextField from '../../lib/ui/TextField.svelte';
  import Switch from '../../lib/ui/Switch.svelte';
  import { toast } from '../../lib/ui/toast.svelte';
  import { put } from '../../lib/db/idb';
  import { bump } from '../../lib/db/changes.svelte';
  import { newId } from '../../lib/util/ids';
  import { isDateKey, nowIso, today } from '../../lib/util/dates';

  let { open = $bindable(false), date: presetDate }: { open?: boolean; date?: string } = $props();
  let title = $state('');
  let date = $state(today());
  let allDay = $state(false);
  let start = $state('09:00');
  let end = $state('');
  let notes = $state('');
  let error = $state('');
  let saving = $state(false);

  $effect(() => { if (open) { title = ''; notes = ''; error = ''; allDay = false; start = '09:00'; end = ''; date = presetDate && isDateKey(presetDate) ? presetDate : today(); } });

  async function save(e?: Event) {
    e?.preventDefault();
    if (!title.trim()) { error = 'Give your event a name.'; return; }
    if (!isDateKey(date)) { error = 'Pick a date.'; return; }
    if (!allDay && end && start && end < start) { error = 'The end time is before the start time.'; return; }
    saving = true;
    try {
      const at = nowIso();
      await put('events', { id: newId('ev'), title: title.trim(), date, allDay, startTime: allDay ? null : start || null, endTime: allDay ? null : end || null, notes: notes.trim(), color: '#6c78b8', createdAt: at, updatedAt: at });
      bump();
      toast('Event added', { tone: 'success' });
      open = false;
    } finally { saving = false; }
  }
</script>

<Modal bind:open title="New event" size="sm">
  <form class="form" onsubmit={save}>
    <TextField label="Event" bind:value={title} placeholder="e.g. Dinner with friends" maxlength={120} error={error} oninput={() => (error = '')} />
    <TextField label="Date" type="date" bind:value={date} />
    <Switch label="All day" bind:checked={allDay} />
    {#if !allDay}
      <div class="two">
        <TextField label="Starts" type="time" bind:value={start} />
        <TextField label="Ends (optional)" type="time" bind:value={end} />
      </div>
    {/if}
    <TextField label="Notes (optional)" bind:value={notes} multiline rows={2} maxlength={500} />
    <button type="submit" hidden aria-hidden="true" tabindex="-1"></button>
  </form>
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (open = false)}>Cancel</Button>
    <Button variant="primary" loading={saving} onclick={() => save()}>Add event</Button>
  {/snippet}
</Modal>

<style>
  .form { display: grid; gap: var(--space-4); }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }
</style>
