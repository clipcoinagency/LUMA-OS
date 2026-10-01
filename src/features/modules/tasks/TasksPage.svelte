<script lang="ts">
  import { flip } from 'svelte/animate';
  import { fade } from 'svelte/transition';
  import { Plus, CheckCircle2, Inbox, SearchX, BellRing } from '@lucide/svelte';
  import PageHeader from '../PageHeader.svelte';
  import Button from '../../../lib/ui/Button.svelte';
  import Segmented from '../../../lib/ui/Segmented.svelte';
  import SearchField from '../../../lib/ui/SearchField.svelte';
  import Select from '../../../lib/ui/Select.svelte';
  import Checkbox from '../../../lib/ui/Checkbox.svelte';
  import FocusButton from '../../focus/FocusButton.svelte';
  import Badge from '../../../lib/ui/Badge.svelte';
  import EmptyState from '../../../lib/ui/EmptyState.svelte';
  import { toast } from '../../../lib/ui/toast.svelte';
  import { changes } from '../../../lib/db/changes.svelte';
  import { clock } from '../../../lib/clock.svelte';
  import { dur } from '../../../lib/motion';
  import { openQuick } from '../../quick/quick.svelte';
  import { reclaimFocusIfLost } from '../../../lib/ui/reclaimFocus';
  import { listTasks, setTaskDone, sortTasks } from '../../../lib/domain/tasks';
  import { diffDays, formatDateKey } from '../../../lib/util/dates';
  import type { Task } from '../../../lib/db/schema';

  let all = $state<Task[] | null>(null);
  let view = $state('today');
  let q = $state('');
  let priority = $state('all');
  let doneLimit = $state(60);

  $effect(() => { void changes.version; void listTasks().then((t) => { all = t; }); });

  const matches = (t: Task) => {
    if (priority !== 'all' && t.priority !== priority) return false;
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return t.title.toLowerCase().includes(s) || t.notes.toLowerCase().includes(s) || t.tags.some((g) => g.toLowerCase().includes(s.replace(/^#/, '')));
  };

  interface Group { key: string; title: string; tone?: 'danger'; tasks: Task[] }
  const groups = $derived.by((): Group[] => {
    if (!all) return [];
    const day = clock.today;
    const list = all.filter(matches);
    const open = list.filter((t) => !t.done);
    if (view === 'today') {
      return [
        { key: 'overdue', title: 'Overdue', tone: 'danger' as const, tasks: open.filter((t) => t.dueDate && t.dueDate < day).sort(sortTasks) },
        { key: 'today', title: 'Today', tasks: open.filter((t) => t.dueDate === day || (!t.dueDate && t.createdOn === day)).sort(sortTasks) },
        { key: 'done', title: 'Done today', tasks: list.filter((t) => t.done && t.completedOn === day) },
      ].filter((g) => g.tasks.length);
    }
    if (view === 'upcoming') {
      const by = new Map<string, Task[]>();
      for (const t of open.filter((t) => t.dueDate && t.dueDate > day).sort(sortTasks)) by.set(t.dueDate!, [...(by.get(t.dueDate!) ?? []), t]);
      const out: Group[] = [...by].map(([d, tasks]) => ({ key: d, title: dueGroupTitle(d), tasks }));
      const someday = open.filter((t) => !t.dueDate && t.createdOn !== day);
      if (someday.length) out.push({ key: 'someday', title: 'Someday', tasks: someday.sort(sortTasks) });
      return out;
    }
    if (view === 'all') return open.length ? [{ key: 'open', title: `${open.length} open`, tasks: open.sort(sortTasks) }] : [];
    const done = list.filter((t) => t.done && t.completedOn).sort((a, b) => b.completedOn!.localeCompare(a.completedOn!) || b.updatedAt.localeCompare(a.updatedAt)).slice(0, doneLimit);
    const by = new Map<string, Task[]>();
    for (const t of done) by.set(t.completedOn!, [...(by.get(t.completedOn!) ?? []), t]);
    return [...by].map(([d, tasks]) => ({ key: d, title: completedTitle(d), tasks }));
  });
  const doneTotal = $derived(all ? all.filter((t) => t.done && matches(t)).length : 0);

  function dueGroupTitle(d: string): string {
    const n = diffDays(clock.today, d);
    if (n === 1) return 'Tomorrow';
    if (n < 7) return formatDateKey(d, { weekday: 'long' });
    return formatDateKey(d, { weekday: 'short', day: 'numeric', month: 'short' });
  }
  function completedTitle(d: string): string {
    const n = diffDays(d, clock.today);
    return n === 0 ? 'Today' : n === 1 ? 'Yesterday' : formatDateKey(d, { weekday: 'short', day: 'numeric', month: 'short', year: d.slice(0, 4) !== clock.today.slice(0, 4) ? 'numeric' : undefined });
  }
  function dueLabel(t: Task): { text: string; tone: 'danger' | 'neutral' | 'accent' } | null {
    if (!t.dueDate || t.done) return null;
    const n = diffDays(clock.today, t.dueDate);
    if (n < 0) return { text: n === -1 ? 'Yesterday' : `${-n}d late`, tone: 'danger' };
    if (n === 0) return view === 'today' ? null : { text: 'Today', tone: 'accent' };
    if (n === 1) return view === 'upcoming' ? null : { text: 'Tomorrow', tone: 'neutral' };
    return view === 'upcoming' ? null : { text: formatDateKey(t.dueDate, { day: 'numeric', month: 'short' }), tone: 'neutral' };
  }
  function timeLabel(hm: string): string {
    const [h, m] = hm.split(':').map(Number);
    const period = h! < 12 ? 'AM' : 'PM';
    const h12 = h! % 12 === 0 ? 12 : h! % 12;
    return `${h12}:${String(m).padStart(2, '0')} ${period}`;
  }
  async function toggle(t: Task, v: boolean) {
    // Completing/reopening a task can move it out of its current group (e.g. Today → Done today)
    // or drop it from the view entirely (Upcoming/All only list open tasks) — either way the
    // checkbox's <li> is eventually destroyed by the keyed {#each}, dropping keyboard focus to
    // <body>. That re-render only happens once the DB write's version bump is noticed by the
    // page's own async refetch, so there's no single point right after this function to check —
    // watch for the loss and redirect the moment it actually happens.
    reclaimFocusIfLost(() => document.getElementById('add-task-btn'));
    await setTaskDone(t.id, v, clock.today);
    if (v) toast(`Done: ${t.title}`, { action: { label: 'Undo', run: () => void setTaskDone(t.id, false) } });
  }
  const counts = $derived.by(() => {
    if (!all) return { today: 0, upcoming: 0 };
    const d = clock.today;
    const open = all.filter((t) => !t.done);
    return {
      today: open.filter((t) => (t.dueDate && t.dueDate <= d) || (!t.dueDate && t.createdOn === d)).length,
      upcoming: open.filter((t) => (t.dueDate && t.dueDate > d) || (!t.dueDate && t.createdOn !== d)).length,
    };
  });
</script>

<PageHeader module="tasks">
  {#snippet actions()}<Button id="add-task-btn" variant="primary" onclick={() => openQuick('task')}>{#snippet icon()}<Plus />{/snippet}Add task</Button>{/snippet}
</PageHeader>

<div class="toolbar">
  <div class="views">
    <Segmented label="Task view" bind:value={view} options={[
      { value: 'today', label: `Today${counts.today ? ` · ${counts.today}` : ''}` },
      { value: 'upcoming', label: `Upcoming${counts.upcoming ? ` · ${counts.upcoming}` : ''}` },
      { value: 'all', label: 'All' },
      { value: 'done', label: 'Completed' },
    ]} />
  </div>
  <div class="filters">
    <SearchField bind:value={q} label="Search tasks" placeholder="Search tasks or #tags" />
    <div class="pri"><Select label="Priority" hideLabel bind:value={priority} options={[{ value: 'all', label: 'All priorities' }, { value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }, { value: 'none', label: 'No priority' }]} /></div>
  </div>
</div>

{#if all}
  {#if groups.length === 0}
    <div class="empty">
      {#if q || priority !== 'all'}
        <EmptyState title="No matching tasks" body="Try a different search or filter.">{#snippet icon()}<SearchX />{/snippet}</EmptyState>
      {:else if view === 'today'}
        <EmptyState title="Nothing due today" body="Add a task, or enjoy a clear day.">
          {#snippet icon()}<CheckCircle2 />{/snippet}
          {#snippet action()}<Button variant="primary" onclick={() => openQuick('task')}>{#snippet icon()}<Plus />{/snippet}Add task</Button>{/snippet}
        </EmptyState>
      {:else if view === 'done'}
        <EmptyState title="No completed tasks yet" body="Tasks you finish are kept here, by the day you finished them.">{#snippet icon()}<CheckCircle2 />{/snippet}</EmptyState>
      {:else}
        <EmptyState title="All clear" body="No open tasks here.">{#snippet icon()}<Inbox />{/snippet}</EmptyState>
      {/if}
    </div>
  {:else}
    <div class="groups">
      {#each groups as g (g.key)}
        <section class="group" aria-labelledby="g-{g.key}">
          <h2 id="g-{g.key}" class="gt" class:danger={g.tone === 'danger'}>{g.title} <span class="n">{g.tasks.length}</span></h2>
          <ul class="list">
            {#each g.tasks as t (t.id)}
              {@const due = dueLabel(t)}
              <li animate:flip={{ duration: dur(220) }} out:fade={{ duration: dur(140) }} class:done={t.done}>
                <Checkbox id="task-check-{t.id}" label="{t.done ? 'Mark not done' : 'Complete'}: {t.title}" checked={t.done} size={22} onchange={(v) => toggle(t, v)} />
                <button type="button" class="body" onclick={() => openQuick('task', { task: $state.snapshot(t) })}>
                  <span class="titlerow">
                    <span class="title">{t.title}</span>
                    {#if t.dueTime}<span class="time" class:on={t.reminder}>{#if t.reminder}<BellRing size={12} aria-hidden="true" />{/if}{timeLabel(t.dueTime)}</span>{/if}
                  </span>
                  {#if t.notes || t.tags.length}
                    <span class="sub">{#each t.tags as tag (tag)}<span class="tag">#{tag}</span>{/each}{#if t.notes}<span class="note">{t.notes}</span>{/if}</span>
                  {/if}
                </button>
                {#if !t.done}<FocusButton task={t} />{/if}
                <span class="badges">
                  {#if t.priority === 'high' && !t.done}<Badge tone="warning">High</Badge>{:else if t.priority === 'medium' && !t.done}<Badge>Medium</Badge>{/if}
                  {#if due}<Badge tone={due.tone}>{due.text}</Badge>{/if}
                </span>
              </li>
            {/each}
          </ul>
        </section>
      {/each}
      {#if view === 'done' && doneTotal > doneLimit}
        <Button variant="ghost" onclick={() => (doneLimit += 100)}>Show more</Button>
      {/if}
    </div>
  {/if}
{/if}

<style>
  .toolbar { display: grid; gap: var(--space-3); margin-bottom: var(--space-5); }
  .views { max-width: 560px; overflow-x: auto; }
  .filters { display: grid; grid-template-columns: 1fr auto; gap: var(--space-2); }
  .pri { min-width: 160px; }
  @media (max-width: 520px) { .filters { grid-template-columns: 1fr; } }
  .groups { display: grid; gap: var(--space-5); }
  .gt { font-family: var(--font-body); font-size: var(--text-sm); font-weight: 700; letter-spacing: .02em; color: var(--text-2); margin-bottom: var(--space-2); display: flex; gap: var(--space-2); align-items: center; }
  .gt.danger { color: var(--danger); }
  .n { font-weight: 600; color: var(--text-3); }
  .list { list-style: none; margin: 0; padding: 0; background: var(--surface); border: var(--card-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-1); overflow: hidden; }
  li { display: flex; align-items: center; gap: var(--space-2); padding: 0 var(--space-3) 0 var(--space-2); min-height: 56px; border-bottom: 1px solid var(--border); background: var(--surface); }
  li:last-child { border-bottom: 0; }
  li.done .title { text-decoration: line-through; color: var(--text-3); }
  .body { flex: 1; min-width: 0; display: grid; gap: 2px; text-align: left; background: none; border: 0; padding: var(--space-2) 0; cursor: pointer; color: var(--text); }
  .body:hover .title { color: var(--accent-ink); }
  .titlerow { display: flex; align-items: center; gap: var(--space-2); min-width: 0; }
  .title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 550; }
  .time { flex: none; display: inline-flex; align-items: center; gap: 3px; font-size: var(--text-xs); color: var(--text-3); }
  .time.on { color: var(--accent-ink); font-weight: 600; }
  .sub { display: flex; gap: var(--space-2); font-size: var(--text-xs); color: var(--text-3); overflow: hidden; white-space: nowrap; }
  .tag { color: var(--accent-ink); font-weight: 600; }
  .note { overflow: hidden; text-overflow: ellipsis; }
  .badges { display: flex; gap: 4px; flex: none; }
  .empty { background: var(--surface); border: var(--card-border); border-radius: var(--radius-lg); }
</style>
