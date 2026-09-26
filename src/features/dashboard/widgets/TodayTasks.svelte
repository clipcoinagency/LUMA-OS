<script lang="ts">
  import { flip } from 'svelte/animate';
  import { fade } from 'svelte/transition';
  import { Plus, CheckCircle2 } from '@lucide/svelte';
  import WidgetCard from '../WidgetCard.svelte';
  import Checkbox from '../../../lib/ui/Checkbox.svelte';
  import Badge from '../../../lib/ui/Badge.svelte';
  import EmptyState from '../../../lib/ui/EmptyState.svelte';
  import { toast } from '../../../lib/ui/toast.svelte';
  import { changes } from '../../../lib/db/changes.svelte';
  import { clock } from '../../../lib/clock.svelte';
  import { dur } from '../../../lib/motion';
  import { createTask, listTasks, setTaskDone, splitToday, type TodayTasks } from '../../../lib/domain/tasks';
  import { diffDays } from '../../../lib/util/dates';
  import { href } from '../../../lib/router.svelte';
  import type { Task } from '../../../lib/db/schema';

  const MAX = 6;
  let data = $state<TodayTasks | null>(null);
  let draft = $state('');

  $effect(() => {
    void changes.version;
    const day = clock.today;
    void listTasks().then((all) => { data = splitToday(all, day); });
  });

  // today's tasks first; a few recent overdue ones fill remaining space, the rest are summarised
  const overdueRecent = $derived(data ? [...data.overdue].sort((a, b) => (b.dueDate ?? '').localeCompare(a.dueDate ?? '')) : []);
  const shown = $derived(data ? [...data.today, ...overdueRecent].slice(0, MAX) : []);
  const open = $derived(data ? [...data.today, ...data.overdue] : []);
  const hiddenOverdue = $derived(data ? data.overdue.filter((t) => !shown.includes(t)).length : 0);
  const total = $derived(data ? data.today.length + data.doneToday.length : 0);

  async function toggle(t: Task, done: boolean) {
    await setTaskDone(t.id, done, clock.today);
    if (done) toast(`Done: ${t.title}`, { action: { label: 'Undo', run: () => void setTaskDone(t.id, false) } });
  }
  async function add(e: KeyboardEvent) {
    if (e.key !== 'Enter' || !draft.trim()) return;
    const title = draft;
    draft = '';
    await createTask({ title, dueDate: clock.today });
  }
  const overdueBy = (t: Task) => (t.dueDate ? diffDays(t.dueDate, clock.today) : 0);
</script>

<WidgetCard title="Today's tasks" module="tasks" loaded={!!data}>
  {#snippet actions()}{#if total}<span class="count num" aria-label="{data?.doneToday.length} of {total} of today's tasks done">{data?.doneToday.length}/{total}</span>{/if}{/snippet}
  {#if data}
    {#if open.length === 0}
      <EmptyState compact title={data.doneToday.length ? 'All done for today' : 'Nothing due today'} body={data.doneToday.length ? `You finished ${data.doneToday.length} task${data.doneToday.length === 1 ? '' : 's'}. Nice work.` : 'Add something below, or enjoy the free time.'}>
        {#snippet icon()}<CheckCircle2 />{/snippet}
      </EmptyState>
    {:else}
      <ul class="list">
        {#each shown as t (t.id)}
          <li animate:flip={{ duration: dur(220) }} out:fade={{ duration: dur(150) }}>
            <Checkbox label="Complete {t.title}" checked={t.done} size={22} onchange={(v) => toggle(t, v)} />
            <span class="title">{t.title}</span>
            {#if overdueBy(t) > 0}<Badge tone="danger">{overdueBy(t) === 1 ? 'Yesterday' : `${overdueBy(t)}d late`}</Badge>
            {:else if t.priority === 'high'}<Badge tone="warning">High</Badge>{/if}
          </li>
        {/each}
      </ul>
      {#if hiddenOverdue > 0}
        <a class="more" href={href({ name: 'module', module: 'tasks' })}><Badge tone="danger">{hiddenOverdue} more overdue</Badge><span>Review in Tasks</span></a>
      {:else if open.length > shown.length}<p class="more meta">+{open.length - shown.length} more in Tasks</p>{/if}
    {/if}
    <label class="add">
      <Plus size={18} aria-hidden="true" />
      <span class="sr-only">Add a task for today</span>
      <input bind:value={draft} onkeydown={add} placeholder="Add a task for today…" maxlength="200" />
    </label>
  {/if}
</WidgetCard>

<style>
  .count { font-size: var(--text-sm); font-weight: 700; color: var(--text-2); background: var(--surface-2); padding: 2px 8px; border-radius: 999px; }
  .list { list-style: none; margin: 0; padding: 0; display: grid; }
  li { display: flex; align-items: center; gap: var(--space-2); min-height: 44px; border-bottom: 1px solid var(--border); }
  li:last-child { border-bottom: 0; }
  li :global(.cb) { min-width: 36px; }
  .title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .more { margin-top: var(--space-2); display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-sm); color: var(--text-2); text-decoration: none; }
  a.more:hover span { color: var(--accent-ink); text-decoration: underline; }
  .add { display: flex; align-items: center; gap: var(--space-2); margin-top: var(--space-3); padding: 0 var(--space-3); min-height: 44px; border-radius: var(--radius-sm); background: var(--surface-2); color: var(--text-3); cursor: text; }
  .add:focus-within { box-shadow: var(--focus); color: var(--accent-ink); }
  .add input { flex: 1; border: 0; background: none; min-height: 44px; outline: none; color: var(--text); }
  .add input::placeholder { color: var(--text-3); }
</style>
