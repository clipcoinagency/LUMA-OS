<script lang="ts">
  import Modal from '../../lib/ui/Modal.svelte';
  import Button from '../../lib/ui/Button.svelte';
  import TextField from '../../lib/ui/TextField.svelte';
  import Segmented from '../../lib/ui/Segmented.svelte';
  import ConfirmDialog from '../../lib/ui/ConfirmDialog.svelte';
  import { toast } from '../../lib/ui/toast.svelte';
  import { deleteRecord, restoreRecord, saveRecord } from '../../lib/domain/records';
  import { newId } from '../../lib/util/ids';
  import { isDateKey, nowIso, today } from '../../lib/util/dates';
  import type { Workout } from '../../lib/db/schema';

  let { open = $bindable(false), workout = null, date: presetDate }: { open?: boolean; workout?: Workout | null; date?: string } = $props();
  const TYPES = ['Walk', 'Run', 'Strength', 'Yoga', 'Cycling', 'Swim', 'HIIT', 'Sport', 'Other'];
  let type = $state('Walk');
  let custom = $state('');
  let minutes = $state('30');
  let intensity = $state<string>('moderate');
  let date = $state(today());
  let note = $state('');
  let error = $state('');
  let confirmDelete = $state(false);

  $effect(() => {
    if (!open) return;
    error = '';
    if (workout) {
      type = TYPES.includes(workout.type) ? workout.type : 'Other'; custom = TYPES.includes(workout.type) ? '' : workout.type;
      minutes = String(workout.durationMin); intensity = workout.intensity ?? 'moderate'; date = workout.date; note = workout.note;
    } else { type = 'Walk'; custom = ''; minutes = '30'; intensity = 'moderate'; date = presetDate && isDateKey(presetDate) ? presetDate : today(); note = ''; }
  });

  async function save(e?: Event) {
    e?.preventDefault();
    const m = Math.round(Number(minutes));
    if (!(m > 0 && m <= 1440)) { error = 'Enter the duration in minutes, like 30.'; return; }
    if (!isDateKey(date)) { error = 'Pick a date.'; return; }
    const at = nowIso();
    await saveRecord('workouts', {
      id: workout?.id ?? newId('wo'), date, type: type === 'Other' && custom.trim() ? custom.trim() : type, durationMin: m,
      intensity: intensity as Workout['intensity'], note: note.trim(), createdAt: workout?.createdAt ?? at, updatedAt: at,
    });
    toast(workout ? 'Workout updated' : 'Workout logged', { tone: 'success' });
    open = false;
  }
  async function del() {
    confirmDelete = false;
    if (!workout) return;
    const old = await deleteRecord('workouts', workout.id);
    open = false;
    toast('Workout deleted', { action: old ? { label: 'Undo', run: () => void restoreRecord('workouts', old) } : undefined });
  }
</script>

<Modal bind:open title={workout ? 'Edit workout' : 'Log a workout'} size="sm">
  <form class="form" onsubmit={save}>
    <div class="types" role="radiogroup" aria-label="Workout type">
      {#each TYPES as t (t)}<button type="button" role="radio" aria-checked={type === t} class="chip" class:on={type === t} onclick={() => (type = t)}>{t}</button>{/each}
    </div>
    {#if type === 'Other'}<TextField label="What did you do?" bind:value={custom} maxlength={40} placeholder="e.g. Hiking" />{/if}
    <div class="two">
      <TextField label="Minutes" bind:value={minutes} inputmode="numeric" error={error} oninput={() => (error = '')} />
      <TextField label="Date" type="date" bind:value={date} />
    </div>
    <div class="field"><span class="lbl">How hard?</span>
      <Segmented label="Intensity" size="sm" bind:value={intensity} options={[{ value: 'easy', label: 'Easy' }, { value: 'moderate', label: 'Moderate' }, { value: 'hard', label: 'Hard' }]} />
    </div>
    <TextField label="Note (optional)" bind:value={note} maxlength={200} />
    <button type="submit" hidden aria-hidden="true" tabindex="-1"></button>
  </form>
  {#snippet footer()}
    {#if workout}<span class="left"><Button variant="ghost" onclick={() => (confirmDelete = true)}>Delete</Button></span>{/if}
    <Button variant="ghost" onclick={() => (open = false)}>Cancel</Button>
    <Button variant="primary" onclick={() => save()}>{workout ? 'Save' : 'Log workout'}</Button>
  {/snippet}
</Modal>

<ConfirmDialog bind:open={confirmDelete} title="Delete this workout?" message="It will be removed from your history. You can undo right after." confirmLabel="Delete workout" onconfirm={del} />

<style>
  .form { display: grid; gap: var(--space-4); }
  .types { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { min-height: 38px; padding: 0 14px; border-radius: 999px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--text-2); font-weight: 600; cursor: pointer; transition: all var(--dur) var(--ease-out); }
  .chip.on { background: var(--mod-wellness); border-color: var(--mod-wellness); color: var(--surface); }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }
  .field { display: grid; gap: 6px; }
  .lbl { font-size: var(--text-sm); font-weight: 600; color: var(--text-2); }
  .left { margin-right: auto; }
  .left :global(.btn) { color: var(--danger); }
</style>
