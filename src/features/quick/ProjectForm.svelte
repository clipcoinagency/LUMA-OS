<script lang="ts">
  // Create or edit a project (Work) or subject (Study).
  import { Trash2 } from '@lucide/svelte';
  import Modal from '../../lib/ui/Modal.svelte';
  import Button from '../../lib/ui/Button.svelte';
  import TextField from '../../lib/ui/TextField.svelte';
  import Select from '../../lib/ui/Select.svelte';
  import Segmented from '../../lib/ui/Segmented.svelte';
  import ConfirmDialog from '../../lib/ui/ConfirmDialog.svelte';
  import { toast } from '../../lib/ui/toast.svelte';
  import { app } from '../../lib/app.svelte';
  import { deleteProject, PROJECT_COLORS, saveProject, VOCAB, type ProjectKind } from '../../lib/domain/projects';
  import { listGoals } from '../../lib/domain/goals';
  import { isDateKey } from '../../lib/util/dates';
  import type { Goal, Project } from '../../lib/db/schema';

  let { open = $bindable(false), kind = 'work', project = null }: { open?: boolean; kind?: ProjectKind; project?: Project | null } = $props();
  const v = $derived(VOCAB[project?.kind ?? kind]);
  let title = $state('');
  let client = $state('');
  let color = $state(PROJECT_COLORS[0]!);
  let deadline = $state('');
  let goalId = $state('');
  let status = $state('active');
  let notes = $state('');
  let error = $state('');
  let saving = $state(false);
  let confirmDelete = $state(false);
  let goals = $state<Goal[]>([]);

  $effect(() => {
    if (!open) return;
    error = '';
    if (project) { title = project.title; client = project.client; color = project.color; deadline = project.deadline ?? ''; goalId = project.goalId ?? ''; status = project.status; notes = project.notes; }
    else { title = ''; client = ''; color = PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)]!; deadline = ''; goalId = ''; status = 'active'; notes = ''; }
    if (app.workspace?.enabledModules.includes('goals')) void listGoals().then((g) => { goals = g.filter((x) => x.status === 'active' || x.id === project?.goalId); });
  });

  async function save(e?: Event) {
    e?.preventDefault();
    if (!title.trim()) { error = `Give your ${v.one} a name.`; return; }
    if (deadline && !isDateKey(deadline)) { error = 'That deadline is not a valid date.'; return; }
    saving = true;
    try {
      await saveProject({ ...(project ? { id: project.id } : {}), kind: project?.kind ?? kind, title, client: client.trim(), color, deadline: deadline || null, goalId: goalId || null, status: status as Project['status'], notes: notes.trim() });
      toast(project ? `${v.one[0]!.toUpperCase() + v.one.slice(1)} updated` : `${v.one[0]!.toUpperCase() + v.one.slice(1)} created`, { tone: 'success' });
      open = false;
    } finally { saving = false; }
  }
  async function del() {
    confirmDelete = false;
    if (!project) return;
    await deleteProject(project.id);
    open = false;
    toast(`${v.one[0]!.toUpperCase() + v.one.slice(1)} deleted — its ${v.tasks.toLowerCase()} were kept`);
  }
</script>

<Modal bind:open title={project ? `Edit ${v.one}` : `New ${v.one}`} size="sm">
  <form class="form" onsubmit={save}>
    <TextField label={v.one[0]!.toUpperCase() + v.one.slice(1)} bind:value={title} placeholder={kind === 'study' ? 'e.g. Organic Chemistry' : 'e.g. Website redesign'} maxlength={100} error={error} oninput={() => (error = '')} />
    <TextField label={v.clientLabel} bind:value={client} hint={v.clientHint} maxlength={80} />
    <div class="field"><span class="lbl">Colour</span>
      <div class="swatches" role="radiogroup" aria-label="Colour">
        {#each PROJECT_COLORS as c (c)}
          <button type="button" role="radio" aria-checked={color === c} aria-label={c} class:on={color === c} style="--c:{c}" onclick={() => (color = c)}></button>
        {/each}
      </div>
    </div>
    <TextField label="Deadline (optional)" type="date" bind:value={deadline} />
    {#if goals.length}
      <Select label="Serves a goal (optional)" bind:value={goalId} options={[{ value: '', label: 'No goal' }, ...goals.map((g) => ({ value: g.id, label: g.title }))]} />
    {/if}
    {#if project}
      <div class="field"><span class="lbl">Status</span>
        <Segmented label="Status" size="sm" bind:value={status} options={[{ value: 'active', label: 'Active' }, { value: 'done', label: 'Done' }, { value: 'archived', label: 'Archived' }]} />
      </div>
    {/if}
    <TextField label="Notes (optional)" bind:value={notes} multiline rows={2} maxlength={1000} />
    <button type="submit" hidden aria-hidden="true" tabindex="-1"></button>
  </form>
  {#snippet footer()}
    {#if project}<span class="left"><Button variant="ghost" onclick={() => (confirmDelete = true)}>{#snippet icon()}<Trash2 />{/snippet}Delete</Button></span>{/if}
    <Button variant="ghost" onclick={() => (open = false)}>Cancel</Button>
    <Button variant="primary" loading={saving} onclick={() => save()}>{project ? 'Save' : `Create ${v.one}`}</Button>
  {/snippet}
</Modal>

<ConfirmDialog bind:open={confirmDelete} title={`Delete this ${v.one}?`} message={`"${project?.title ?? ''}" will be removed. Its ${v.tasks.toLowerCase()}, events and notes are kept, just unassigned.`} confirmLabel={`Delete ${v.one}`} onconfirm={del} />

<style>
  .form { display: grid; gap: var(--space-4); }
  .field { display: grid; gap: 6px; }
  .lbl { font-size: var(--text-sm); font-weight: 600; color: var(--text-2); }
  .swatches { display: flex; flex-wrap: wrap; gap: 10px; }
  .swatches button { width: 32px; height: 32px; border-radius: 50%; border: 2px solid transparent; background: var(--c); cursor: pointer; transition: transform var(--dur-fast) var(--ease-out), box-shadow var(--dur) var(--ease-out); }
  .swatches button:hover { transform: scale(1.1); }
  .swatches button.on { box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--c); }
  .left { margin-right: auto; }
  .left :global(.btn) { color: var(--danger); }
</style>
