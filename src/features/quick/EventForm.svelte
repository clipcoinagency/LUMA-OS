<script lang="ts">
  import Modal from '../../lib/ui/Modal.svelte';
  import Button from '../../lib/ui/Button.svelte';
  import TextField from '../../lib/ui/TextField.svelte';
  import Switch from '../../lib/ui/Switch.svelte';
  import { toast } from '../../lib/ui/toast.svelte';
  import ConfirmDialog from '../../lib/ui/ConfirmDialog.svelte';
  import { deleteRecord, restoreRecord, saveRecord } from '../../lib/domain/records';
  import type { CalendarEvent } from '../../lib/db/schema';
  import { newId } from '../../lib/util/ids';
  import { isDateKey, nowIso, today } from '../../lib/util/dates';

  let { open = $bindable(false), date: presetDate, event = null }: { open?: boolean; date?: string; event?: CalendarEvent | null } = $props();
  let confirmDelete = $state(false);
  let title = $state('');
  let date = $state(today());
  let allDay = $state(false);
  let start = $state('09:00');
  let end = $state('');
  let notes = $state('');
  let error = $state('');
  let saving = $state(false);

  $effect(() => {
    if (!open) return;
    error = '';
    if (event) { title = event.title; notes = event.notes; allDay = event.allDay; start = event.startTime ?? '09:00'; end = event.endTime ?? ''; date = event.date; }
    else { title = ''; notes = ''; allDay = false; start = '09:00'; end = ''; date = presetDate && isDateKey(presetDate) ? presetDate : today(); }
  });

  async function del() {
    confirmDelete = false;
    if (!event) return;
    const old = await deleteRecord('events', event.id);
    open = false;
    toast('Event deleted', { action: old ? { label: 'Undo', run: () => void restoreRecord('events', old) } : undefined });
  }

  async function save(e?: Event) {
    e?.preventDefault();
    if (!title.trim()) { error = 'Give your event a name.'; return; }
    if (!isDateKey(date)) { error = 'Pick a date.'; return; }
    if (!allDay && end && start && end < start) { error = 'The end time is before the start time.'; return; }
    saving = true;
    try {
      const at = nowIso();
      await saveRecord('events', { id: event?.id ?? newId('ev'), title: title.trim(), date, allDay, startTime: allDay ? null : start || null, endTime: allDay ? null : end || null, notes: notes.trim(), color: event?.color ?? '#6c78b8', createdAt: event?.createdAt ?? at, updatedAt: at });
      toast(event ? 'Event updated' : 'Event added', { tone: 'success' });
      open = false;
    } finally { saving = false; }
  }
</script>

<Modal bind:open title={event ? 'Edit event' : 'New event'} size="sm">
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
    {#if event}<span class="left"><Button variant="ghost" onclick={() => (confirmDelete = true)}>Delete</Button></span>{/if}
    <Button variant="ghost" onclick={() => (open = false)}>Cancel</Button>
    <Button variant="primary" loading={saving} onclick={() => save()}>{event ? 'Save' : 'Add event'}</Button>
  {/snippet}
</Modal>

<ConfirmDialog bind:open={confirmDelete} title="Delete this event?" message={`"${event?.title ?? ''}" will be removed from your calendar. You can undo right after.`} confirmLabel="Delete event" onconfirm={del} />

<style>
  .form { display: grid; gap: var(--space-4); }
  .left { margin-right: auto; }
  .left :global(.btn) { color: var(--danger); }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }
</style>
