<script lang="ts">
  // Create or edit a task. Editing adds notes, tags and delete (with Undo).
  import { Trash2 } from '@lucide/svelte';
  import Modal from '../../lib/ui/Modal.svelte';
  import Button from '../../lib/ui/Button.svelte';
  import TextField from '../../lib/ui/TextField.svelte';
  import Segmented from '../../lib/ui/Segmented.svelte';
  import Switch from '../../lib/ui/Switch.svelte';
  import ConfirmDialog from '../../lib/ui/ConfirmDialog.svelte';
  import { toast } from '../../lib/ui/toast.svelte';
  import { createTask, deleteTask, restoreTask, updateTask } from '../../lib/domain/tasks';
  import { requestNotificationPermission } from '../../lib/reminders.svelte';
  import { addDays, isDateKey, today } from '../../lib/util/dates';
  import type { Priority, Task } from '../../lib/db/schema';

  let { open = $bindable(false), task = null }: { open?: boolean; task?: Task | null } = $props();
  let title = $state('');
  let notes = $state('');
  let tags = $state('');
  let when = $state('today');
  let date = $state(addDays(today(), 2));
  let time = $state('');
  let reminder = $state(false);
  let priority = $state<string>('none');
  let error = $state('');
  let saving = $state(false);
  let confirmDelete = $state(false);

  $effect(() => {
    if (!open) return;
    error = '';
    if (task) {
      title = task.title; notes = task.notes; tags = task.tags.join(', '); priority = task.priority;
      time = task.dueTime ?? ''; reminder = task.reminder;
      const t = today();
      when = task.dueDate === null ? 'none' : task.dueDate === t ? 'today' : task.dueDate === addDays(t, 1) ? 'tomorrow' : 'date';
      date = task.dueDate ?? addDays(t, 2);
    } else {
      title = ''; notes = ''; tags = ''; when = 'today'; priority = 'none'; date = addDays(today(), 2); time = ''; reminder = false;
    }
  });

  function toggleReminder(v: boolean) {
    reminder = v;
    if (v) requestNotificationPermission();
  }

  async function save(e?: Event) {
    e?.preventDefault();
    if (!title.trim()) { error = 'Give your task a name.'; return; }
    if (when === 'date' && !isDateKey(date)) { error = 'Pick a date, or choose Someday.'; return; }
    saving = true;
    try {
      const due = when === 'today' ? today() : when === 'tomorrow' ? addDays(today(), 1) : when === 'date' ? date : null;
      // a reminder needs a due date + time to anchor to — dropping either drops the other
      const dueTime = due && time ? time : null;
      const remind = dueTime ? reminder : false;
      const tagList = [...new Set(tags.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean))].slice(0, 10);
      if (task) {
        await updateTask(task.id, { title: title.trim(), notes: notes.trim(), tags: tagList, dueDate: due, dueTime, reminder: remind, remindedOn: null, priority: priority as Priority });
        toast('Task updated', { tone: 'success' });
      } else {
        await createTask({ title, notes: notes.trim(), tags: tagList, dueDate: due, dueTime, reminder: remind, priority: priority as Priority });
        toast('Task added', { tone: 'success' });
      }
      open = false;
    } finally { saving = false; }
  }

  async function del() {
    confirmDelete = false;
    if (!task) return;
    const old = await deleteTask(task.id);
    open = false;
    toast('Task deleted', { action: old ? { label: 'Undo', run: () => void restoreTask(old) } : undefined });
  }
</script>

<Modal bind:open title={task ? 'Edit task' : 'New task'} size="sm">
  <form class="form" onsubmit={save}>
    <TextField label="Task" bind:value={title} placeholder="What needs doing?" maxlength={200} error={error} oninput={() => (error = '')} />
    <div class="field"><span class="lbl">When</span>
      <Segmented label="When" size="sm" bind:value={when} options={[{ value: 'today', label: 'Today' }, { value: 'tomorrow', label: 'Tomorrow' }, { value: 'date', label: 'Pick date' }, { value: 'none', label: 'Someday' }]} />
    </div>
    {#if when === 'date'}<TextField label="Due date" type="date" bind:value={date} />{/if}
    {#if when !== 'none'}
      <TextField label="Time (optional)" type="time" bind:value={time} />
      {#if time}<Switch label="Remind me" description="Ring an alert with a sound at that time." checked={reminder} onchange={toggleReminder} />{/if}
    {/if}
    <div class="field"><span class="lbl">Priority</span>
      <Segmented label="Priority" size="sm" bind:value={priority} options={[{ value: 'none', label: 'None' }, { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }]} />
    </div>
    <TextField label="Notes (optional)" bind:value={notes} multiline rows={2} maxlength={2000} />
    <TextField label="Tags (optional)" bind:value={tags} placeholder="work, home" hint="Separate with commas." maxlength={200} />
    <button type="submit" hidden aria-hidden="true" tabindex="-1"></button>
  </form>
  {#snippet footer()}
    {#if task}<span class="left"><Button variant="ghost" onclick={() => (confirmDelete = true)}>{#snippet icon()}<Trash2 />{/snippet}Delete</Button></span>{/if}
    <Button variant="ghost" onclick={() => (open = false)}>Cancel</Button>
    <Button variant="primary" loading={saving} onclick={() => save()}>{task ? 'Save' : 'Add task'}</Button>
  {/snippet}
</Modal>

<ConfirmDialog bind:open={confirmDelete} title="Delete this task?" message={`"${task?.title ?? ''}" will be deleted. You can undo right after.`} confirmLabel="Delete task" onconfirm={del} />

<style>
  .form { display: grid; gap: var(--space-4); }
  .field { display: grid; gap: 6px; }
  .lbl { font-size: var(--text-sm); font-weight: 600; color: var(--text-2); }
  .left { margin-right: auto; }
  .left :global(.btn) { color: var(--danger); }
</style>
