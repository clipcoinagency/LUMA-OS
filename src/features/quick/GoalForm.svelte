<script lang="ts">
  import { X, Plus } from '@lucide/svelte';
  import Modal from '../../lib/ui/Modal.svelte';
  import Button from '../../lib/ui/Button.svelte';
  import TextField from '../../lib/ui/TextField.svelte';
  import Segmented from '../../lib/ui/Segmented.svelte';
  import { toast } from '../../lib/ui/toast.svelte';
  import { saveGoal } from '../../lib/domain/goals';
  import type { Goal, Milestone } from '../../lib/db/schema';
  import { newId } from '../../lib/util/ids';
  import { nowIso, today } from '../../lib/util/dates';

  let { open = $bindable(false), goal = null }: { open?: boolean; goal?: Goal | null } = $props();
  let title = $state('');
  let description = $state('');
  let kind = $state('number');
  let target = $state('');
  let unit = $state('');
  let deadline = $state('');
  let milestones = $state<string[]>(['', '']);
  let error = $state('');
  let saving = $state(false);

  $effect(() => {
    if (!open) return;
    error = '';
    if (goal) {
      title = goal.title; description = goal.description; kind = goal.target !== null ? 'number' : 'milestones';
      target = goal.target !== null ? String(goal.target) : ''; unit = goal.unit; deadline = goal.deadline ?? '';
      milestones = goal.milestones.length ? goal.milestones.map((m) => m.title) : ['', ''];
    } else { title = ''; description = ''; kind = 'number'; target = ''; unit = ''; deadline = ''; milestones = ['', '']; }
  });

  async function save(e?: Event) {
    e?.preventDefault();
    if (!title.trim()) { error = 'Give your goal a name.'; return; }
    const t = Number(target.replace(',', '.'));
    if (kind === 'number' && !(t > 0)) { error = 'Enter a target number, like 12.'; return; }
    const ms = milestones.map((m) => m.trim()).filter(Boolean);
    if (kind === 'milestones' && ms.length === 0) { error = 'Add at least one milestone.'; return; }
    saving = true;
    try {
      const at = nowIso();
      // keep done-state of milestones that still exist (matched by title)
      const keep = new Map((goal?.milestones ?? []).map((m) => [m.title, m]));
      const msRows: Milestone[] = kind === 'milestones' ? ms.map((m) => keep.get(m) ?? { id: newId('ms'), title: m, done: false, doneOn: null }) : [];
      await saveGoal({
        id: goal?.id ?? newId('goal'), title: title.trim(), description: description.trim(), target: kind === 'number' ? t : null, unit: unit.trim(),
        current: goal?.current ?? 0, deadline: deadline || null, status: goal?.status ?? 'active', milestones: msRows,
        createdOn: goal?.createdOn ?? today(), completedOn: goal?.completedOn ?? null, createdAt: goal?.createdAt ?? at, updatedAt: at,
      });
      toast(goal ? 'Goal updated' : 'Goal created', { tone: 'success' });
      open = false;
    } finally { saving = false; }
  }
</script>

<Modal bind:open title={goal ? 'Edit goal' : 'New goal'} size="sm">
  <form class="form" onsubmit={save}>
    <TextField label="Goal" bind:value={title} placeholder="e.g. Read 12 books" maxlength={120} error={error} oninput={() => (error = '')} />
    <Segmented label="Track by" size="sm" bind:value={kind} options={[{ value: 'number', label: 'A number' }, { value: 'milestones', label: 'Milestones' }]} />
    {#if kind === 'number'}
      <div class="two">
        <TextField label="Target" bind:value={target} inputmode="decimal" placeholder="12" />
        <TextField label="Unit (optional)" bind:value={unit} placeholder="books" maxlength={20} />
      </div>
    {:else}
      <div class="ms">
        {#each milestones as _, i (i)}
          <div class="msrow">
            <TextField label="Milestone {i + 1}" bind:value={milestones[i]} placeholder="e.g. Finish the draft" maxlength={120} />
            {#if milestones.length > 1}<button type="button" class="rm" aria-label="Remove milestone {i + 1}" onclick={() => (milestones = milestones.filter((_, j) => j !== i))}><X size={18} /></button>{/if}
          </div>
        {/each}
        <Button size="sm" variant="ghost" onclick={() => (milestones = [...milestones, ''])}>{#snippet icon()}<Plus />{/snippet}Add milestone</Button>
      </div>
    {/if}
    <TextField label="Deadline (optional)" type="date" bind:value={deadline} />
    <TextField label="Why it matters (optional)" bind:value={description} multiline rows={2} maxlength={400} />
    <button type="submit" hidden aria-hidden="true" tabindex="-1"></button>
  </form>
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (open = false)}>Cancel</Button>
    <Button variant="primary" loading={saving} onclick={() => save()}>{goal ? 'Save' : 'Create goal'}</Button>
  {/snippet}
</Modal>

<style>
  .form { display: grid; gap: var(--space-4); }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }
  .ms { display: grid; gap: var(--space-3); justify-items: start; }
  .msrow { display: flex; gap: var(--space-2); align-items: flex-end; width: 100%; }
  .msrow > :global(.field) { flex: 1; }
  .rm { width: 44px; height: 44px; display: grid; place-items: center; border: 0; background: none; color: var(--text-3); cursor: pointer; border-radius: var(--radius-sm); }
  .rm:hover { background: var(--surface-2); color: var(--danger); }
</style>
