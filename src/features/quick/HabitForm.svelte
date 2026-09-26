<script lang="ts">
  import Modal from '../../lib/ui/Modal.svelte';
  import Button from '../../lib/ui/Button.svelte';
  import TextField from '../../lib/ui/TextField.svelte';
  import Segmented from '../../lib/ui/Segmented.svelte';
  import { toast } from '../../lib/ui/toast.svelte';
  import { saveHabit } from '../../lib/domain/habits';
  import type { HabitFrequency } from '../../lib/db/schema';

  let { open = $bindable(false) }: { open?: boolean } = $props();
  const COLORS = ['#4f8f75', '#a5546c', '#4f98a8', '#b0875c', '#6c78b8', '#7a6bb0', '#d0823c'];
  const DAYS = [{ i: 1, l: 'Mon' }, { i: 2, l: 'Tue' }, { i: 3, l: 'Wed' }, { i: 4, l: 'Thu' }, { i: 5, l: 'Fri' }, { i: 6, l: 'Sat' }, { i: 0, l: 'Sun' }];
  let name = $state('');
  let kind = $state('daily');
  let days = $state<number[]>([1, 3, 5]);
  let times = $state(3);
  let color = $state(COLORS[0]!);
  let error = $state('');
  let saving = $state(false);

  $effect(() => { if (!open) { name = ''; kind = 'daily'; error = ''; } });

  function toggleDay(i: number) { days = days.includes(i) ? days.filter((d) => d !== i) : [...days, i]; }

  async function save(e?: Event) {
    e?.preventDefault();
    if (!name.trim()) { error = 'Give your habit a name.'; return; }
    if (kind === 'weekdays' && days.length === 0) { error = 'Pick at least one day.'; return; }
    const frequency: HabitFrequency = kind === 'daily' ? { kind: 'daily' } : kind === 'weekdays' ? { kind: 'weekdays', days: [...days].sort() } : { kind: 'times-per-week', times };
    saving = true;
    try {
      await saveHabit({ name: name.trim(), frequency, color });
      toast('Habit created', { tone: 'success' });
      open = false;
    } finally { saving = false; }
  }
</script>

<Modal bind:open title="New habit" size="sm">
  <form class="form" onsubmit={save}>
    <TextField label="Habit" bind:value={name} placeholder="e.g. Read 20 minutes" maxlength={80} error={error} oninput={() => (error = '')} />
    <div class="field"><span class="lbl">How often</span>
      <Segmented label="How often" size="sm" bind:value={kind} options={[{ value: 'daily', label: 'Every day' }, { value: 'weekdays', label: 'Some days' }, { value: 'times', label: 'Times / week' }]} />
    </div>
    {#if kind === 'weekdays'}
      <div class="chips" role="group" aria-label="Days">
        {#each DAYS as d (d.i)}
          <button type="button" class="chip" class:on={days.includes(d.i)} aria-pressed={days.includes(d.i)} onclick={() => toggleDay(d.i)}>{d.l}</button>
        {/each}
      </div>
    {:else if kind === 'times'}
      <div class="stepper" role="group" aria-label="Times per week">
        <button type="button" aria-label="Fewer" disabled={times <= 1} onclick={() => (times -= 1)}>−</button>
        <span class="num" aria-live="polite">{times}× a week</span>
        <button type="button" aria-label="More" disabled={times >= 7} onclick={() => (times += 1)}>+</button>
      </div>
    {/if}
    <div class="field"><span class="lbl">Colour</span>
      <div class="swatches" role="radiogroup" aria-label="Colour">
        {#each COLORS as c (c)}
          <button type="button" role="radio" aria-checked={color === c} aria-label="Colour {c}" class="sw" class:on={color === c} style="--c:{c}" onclick={() => (color = c)}></button>
        {/each}
      </div>
    </div>
    <button type="submit" hidden aria-hidden="true" tabindex="-1"></button>
  </form>
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (open = false)}>Cancel</Button>
    <Button variant="primary" loading={saving} onclick={() => save()}>Create habit</Button>
  {/snippet}
</Modal>

<style>
  .form { display: grid; gap: var(--space-4); }
  .field { display: grid; gap: 8px; }
  .lbl { font-size: var(--text-sm); font-weight: 600; color: var(--text-2); }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { min-width: 48px; min-height: 40px; border-radius: 999px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--text-2); font-weight: 600; cursor: pointer; transition: all var(--dur) var(--ease-out); }
  .chip.on { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
  .stepper { display: flex; align-items: center; gap: var(--space-4); }
  .stepper button { width: 44px; height: 44px; border-radius: 50%; border: 1px solid var(--border-strong); background: var(--surface); font-size: 20px; cursor: pointer; color: var(--text); }
  .stepper button:disabled { opacity: .4; cursor: default; }
  .swatches { display: flex; gap: var(--space-2); flex-wrap: wrap; }
  .sw { width: 34px; height: 34px; border-radius: 50%; background: var(--c); border: 3px solid transparent; cursor: pointer; box-shadow: 0 0 0 1px var(--border); transition: transform var(--dur) var(--ease-emphasis); }
  .sw.on { border-color: var(--surface); box-shadow: 0 0 0 2px var(--c); transform: scale(1.08); }
</style>
