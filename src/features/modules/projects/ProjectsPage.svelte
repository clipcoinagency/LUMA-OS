<script lang="ts">
  // Work → Projects, Study → Subjects: one page, two vocabularies. The list shows each one's progress,
  // next deadline and focus time; opening one shows everything linked to it — tasks/assignments,
  // meetings/exams and focus sessions — so nothing lives in an isolated silo.
  import { Plus, ArrowLeft, Pencil, Calendar, Flame } from '@lucide/svelte';
  import PageHeader from '../PageHeader.svelte';
  import Button from '../../../lib/ui/Button.svelte';
  import Checkbox from '../../../lib/ui/Checkbox.svelte';
  import Segmented from '../../../lib/ui/Segmented.svelte';
  import ProgressBar from '../../../lib/ui/ProgressBar.svelte';
  import EmptyState from '../../../lib/ui/EmptyState.svelte';
  import Badge from '../../../lib/ui/Badge.svelte';
  import Skeleton from '../../../lib/ui/Skeleton.svelte';
  import FocusButton from '../../focus/FocusButton.svelte';
  import { openQuick } from '../../quick/quick.svelte';
  import { app } from '../../../lib/app.svelte';
  import { clock } from '../../../lib/clock.svelte';
  import { changes } from '../../../lib/db/changes.svelte';
  import { createTask, setTaskDone, sortTasks } from '../../../lib/domain/tasks';
  import { loadProjects, VOCAB, type ProjectKind, type ProjectRow } from '../../../lib/domain/projects';
  import { formatMinutes } from '../../../lib/domain/focus';
  import { listGoals, goalFraction } from '../../../lib/domain/goals';
  import { formatDateKey, type DateKey } from '../../../lib/util/dates';
  import { toast } from '../../../lib/ui/toast.svelte';
  import type { Goal } from '../../../lib/db/schema';

  let { kind }: { kind: ProjectKind } = $props();
  const v = $derived(VOCAB[kind]);
  const mod = $derived(kind);

  let rows = $state.raw<ProjectRow[] | null>(null);
  let goals = $state.raw<Goal[]>([]);
  let view = $state('active');
  let openId = $state<string | null>(null);
  let draft = $state('');

  $effect(() => {
    const ver = changes.version;
    const k = kind;
    void loadProjects(k).then((r) => { if (ver === changes.version) rows = r; });
    if (app.workspace?.enabledModules.includes('goals')) void listGoals().then((g) => { goals = g; });
  });
  // switching between Work and Study resets the view
  $effect(() => { void kind; openId = null; view = 'active'; });

  const counts = $derived({ active: rows?.filter((r) => r.project.status === 'active').length ?? 0, done: rows?.filter((r) => r.project.status === 'done').length ?? 0, archived: rows?.filter((r) => r.project.status === 'archived').length ?? 0 });
  const shown = $derived((rows ?? []).filter((r) => r.project.status === view).sort((a, b) => (a.stats.nextDue ?? '9999').localeCompare(b.stats.nextDue ?? '9999') || a.project.title.localeCompare(b.project.title)));
  const open = $derived(rows?.find((r) => r.project.id === openId) ?? null);
  const goalOf = (id: string | null) => goals.find((g) => g.id === id) ?? null;

  const when = (d: DateKey | null): { text: string; tone: 'danger' | 'warning' | 'neutral' } | null => {
    if (!d) return null;
    const n = Math.round((new Date(d + 'T00:00').getTime() - new Date(clock.today + 'T00:00').getTime()) / 86400000);
    if (n < 0) return { text: `${-n}d overdue`, tone: 'danger' };
    if (n === 0) return { text: 'Today', tone: 'warning' };
    if (n === 1) return { text: 'Tomorrow', tone: 'warning' };
    if (n <= 7) return { text: `In ${n} days`, tone: 'warning' };
    return { text: formatDateKey(d, { month: 'short', day: 'numeric' }), tone: 'neutral' };
  };

  async function addTask(e: KeyboardEvent) {
    if (e.key !== 'Enter' || !draft.trim() || !open) return;
    const title = draft;
    draft = '';
    await createTask({ title, projectId: open.project.id, dueDate: null });
  }
  async function toggle(id: string, title: string, done: boolean) {
    await setTaskDone(id, done);
    if (done) toast(`Done: ${title}`, { action: { label: 'Undo', run: () => void setTaskDone(id, false) } });
  }
</script>

{#if open}
  {@const p = open.project}
  {@const s = open.stats}
  {@const g = goalOf(p.goalId)}
  <div class="detail" style="--c:{p.color}">
    <button type="button" class="back" onclick={() => (openId = null)}><ArrowLeft size={16} aria-hidden="true" />{v.many}</button>
    <header class="dh">
      <span class="bar" aria-hidden="true"></span>
      <div class="dt">
        <h1>{p.title}</h1>
        <p class="muted">{p.client || `${v.area} ${v.one}`}{#if p.deadline} · due {formatDateKey(p.deadline, { month: 'short', day: 'numeric', year: 'numeric' })}{/if}</p>
        {#if g}<p class="goal"><span class="gl">Serves goal</span> {g.title} <strong class="num">{Math.round(goalFraction(g) * 100)}%</strong></p>{/if}
      </div>
      <div class="da">
        <Button size="sm" onclick={() => openQuick('project', { project: $state.snapshot(p) })}>{#snippet icon()}<Pencil />{/snippet}Edit</Button>
      </div>
    </header>

    <div class="stats">
      <div><span class="k">{v.tasks}</span><strong class="num">{s.tasksDone}<small>/{s.tasksTotal}</small></strong></div>
      <div><span class="k">{v.focus}</span><strong class="num">{formatMinutes(s.focusMin)}</strong></div>
      <div><span class="k">{v.events}</span><strong class="num">{s.events.length}<small> upcoming</small></strong></div>
      <div><span class="k">Notes</span><strong class="num">{s.notes}</strong></div>
    </div>
    {#if s.tasksTotal}<ProgressBar value={(s.tasksDone / s.tasksTotal) * 100} label="{p.title} progress" color={p.color} height={10} />{/if}

    <div class="cols">
      <section class="panel solid" aria-labelledby="pt">
        <h2 id="pt">{v.tasks}</h2>
        {#if s.tasksOpen.length}
          <ul class="list">
            {#each [...s.tasksOpen].sort(sortTasks) as t (t.id)}
              {@const d = when(t.dueDate as DateKey | null)}
              <li>
                <Checkbox label="Complete: {t.title}" checked={false} size={22} color={p.color} onchange={(val) => toggle(t.id, t.title, val)} />
                <button type="button" class="tt" onclick={() => openQuick('task', { task: $state.snapshot(t) })}>{t.title}</button>
                {#if d}<Badge tone={d.tone}>{d.text}</Badge>{/if}
                <FocusButton task={t} />
              </li>
            {/each}
          </ul>
        {:else if s.tasksTotal}<p class="muted pad">Everything is done.</p>{:else}<p class="muted pad">No {v.tasks.toLowerCase()} yet.</p>{/if}
        <label class="add"><Plus size={18} aria-hidden="true" /><span class="sr-only">Add to {p.title}</span>
          <input bind:value={draft} onkeydown={addTask} placeholder={kind === 'study' ? 'Add an assignment…' : 'Add a task…'} maxlength="200" /></label>
      </section>

      <section class="panel solid" aria-labelledby="pe">
        <h2 id="pe">{v.events}</h2>
        {#if s.events.length}
          <ul class="list ev">
            {#each s.events as e (e.id)}
              <li><Calendar size={16} aria-hidden="true" /><span class="tt static">{e.title}</span><span class="meta">{formatDateKey(e.date as DateKey, { weekday: 'short', day: 'numeric', month: 'short' })}{e.startTime ? ` · ${e.startTime}` : ''}</span></li>
            {/each}
          </ul>
        {:else}<p class="muted pad">Nothing scheduled.</p>{/if}
        <div class="pad"><Button size="sm" onclick={() => openQuick('event', { kind: v.eventKind, projectId: p.id })}>{#snippet icon()}<Plus />{/snippet}Add {v.eventKind}</Button></div>
        {#if p.notes}<h2 class="n2">Notes</h2><p class="pad notes">{p.notes}</p>{/if}
      </section>
    </div>
  </div>
{:else}
  <PageHeader module={mod} subtitle={v.empty}>
    {#snippet actions()}<Button variant="primary" onclick={() => openQuick('project', { kind })}>{#snippet icon()}<Plus />{/snippet}New {v.one}</Button>{/snippet}
  </PageHeader>

  {#if rows === null}
    <Skeleton lines={4} />
  {:else if rows.length === 0}
    <EmptyState title={`No ${v.many.toLowerCase()} yet`} body={v.empty}>
      {#snippet action()}<Button variant="primary" onclick={() => openQuick('project', { kind })}>{#snippet icon()}<Plus />{/snippet}Create your first {v.one}</Button>{/snippet}
    </EmptyState>
  {:else}
    <div class="seg"><Segmented label="Show" bind:value={view} options={[{ value: 'active', label: `Active · ${counts.active}` }, { value: 'done', label: `Done · ${counts.done}` }, { value: 'archived', label: `Archived · ${counts.archived}` }]} /></div>
    {#if shown.length === 0}<p class="muted">Nothing here.</p>{:else}
      <ul class="cards">
        {#each shown as r, i (r.project.id)}
          {@const d = when(r.stats.nextDue)}
          <li style="--c:{r.project.color};--i:{i}">
            <button type="button" class="card solid" onclick={() => (openId = r.project.id)}>
              <span class="stripe" aria-hidden="true"></span>
              <span class="top"><strong class="ttl">{r.project.title}</strong>{#if d}<Badge tone={d.tone}>{d.text}</Badge>{/if}</span>
              <span class="cl muted">{r.project.client || `${v.area} ${v.one}`}</span>
              {#if r.stats.tasksTotal}
                <ProgressBar value={(r.stats.tasksDone / r.stats.tasksTotal) * 100} label="{r.project.title} progress" color={r.project.color} />
                <span class="row"><span>{r.stats.tasksDone} of {r.stats.tasksTotal} {v.tasks.toLowerCase()}</span>{#if r.stats.overdue}<span class="late">{r.stats.overdue} overdue</span>{/if}</span>
              {:else}<span class="row"><span>No {v.tasks.toLowerCase()} yet</span></span>{/if}
              <span class="foot"><span><Flame size={13} aria-hidden="true" />{formatMinutes(r.stats.focusMin)}</span><span><Calendar size={13} aria-hidden="true" />{r.stats.events.length} {v.events.toLowerCase()}</span></span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
{/if}

<style>
  .seg { margin-bottom: var(--space-4); max-width: 460px; }
  .cards { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 290px), 1fr)); gap: var(--space-4); }
  .cards li { animation: rise var(--dur-slow) var(--ease-glide) both; animation-delay: calc(var(--i) * 55ms); }
  @keyframes rise { from { opacity: 0; transform: translateY(10px); } }
  .card { position: relative; width: 100%; display: grid; gap: 10px; padding: var(--space-5) var(--space-5) var(--space-4); text-align: left; cursor: pointer; border-radius: var(--radius-xl); color: var(--text); overflow: hidden;
    transition: transform var(--dur) var(--ease-out), box-shadow var(--dur) var(--ease-out), border-color var(--dur) var(--ease-out); }
  .card:hover { transform: translateY(-2px); box-shadow: var(--solid-highlight), var(--shadow-2), 0 0 0 1px color-mix(in srgb, var(--c) 40%, transparent); border-color: color-mix(in srgb, var(--c) 45%, var(--border)); }
  .stripe { position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--c); }
  .top { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
  .ttl { font-family: var(--font-display); font-weight: var(--display-weight); font-size: var(--text-lg); line-height: 1.2; }
  .cl { font-size: var(--text-sm); margin-top: -4px; }
  .row { display: flex; justify-content: space-between; font-size: var(--text-sm); color: var(--text-2); }
  .late { color: var(--danger); font-weight: 650; }
  .foot { display: flex; gap: var(--space-4); font-size: var(--text-xs); color: var(--text-3); font-weight: 600; padding-top: 8px; border-top: 1px solid var(--border); }
  .foot span { display: inline-flex; align-items: center; gap: 5px; }

  .detail { display: grid; gap: var(--space-4); }
  .back { justify-self: start; display: inline-flex; align-items: center; gap: 6px; background: none; border: 0; padding: 4px 0; color: var(--text-2); font-weight: 600; cursor: pointer; }
  .back:hover { color: var(--text); }
  .dh { display: flex; align-items: flex-start; gap: var(--space-4); flex-wrap: wrap; }
  .bar { width: 6px; align-self: stretch; min-height: 54px; border-radius: 99px; background: var(--c); box-shadow: 0 0 18px color-mix(in srgb, var(--c) 55%, transparent); }
  .dt { flex: 1; min-width: 200px; display: grid; gap: 4px; }
  .goal { font-size: var(--text-sm); color: var(--text-2); } .gl { font-size: var(--text-xs); font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--text-3); margin-right: 6px; }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: var(--space-3); }
  .stats > div { display: grid; gap: 2px; padding: var(--space-3) var(--space-4); border-radius: var(--radius-lg); background: var(--glass-bg); border: 1px solid var(--glass-border); -webkit-backdrop-filter: blur(var(--glass-blur)); backdrop-filter: blur(var(--glass-blur)); }
  .k { font-size: var(--text-xs); font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--text-3); }
  .stats strong { font-family: var(--font-display); font-size: var(--text-xl); } .stats small { font-size: var(--text-sm); color: var(--text-3); font-weight: 600; }
  .cols { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: var(--space-4); align-items: start; }
  @media (max-width: 860px) { .cols { grid-template-columns: 1fr; } }
  .panel { border-radius: var(--radius-xl); padding: var(--space-4) var(--space-4) var(--space-3); }
  .panel h2 { font-size: var(--text-md); margin-bottom: var(--space-2); } .n2 { margin-top: var(--space-4); }
  .list { list-style: none; margin: 0; padding: 0; display: grid; }
  .list li { display: flex; align-items: center; gap: var(--space-2); min-height: 48px; border-bottom: 1px solid var(--border); }
  .list li:last-child { border-bottom: 0; }
  .tt { flex: 1; min-width: 0; text-align: left; background: none; border: 0; padding: 0; color: var(--text); font-weight: 550; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tt.static { cursor: default; } .tt:hover:not(.static) { color: var(--accent-ink); }
  .ev li { color: var(--text-2); } .meta { font-size: var(--text-xs); color: var(--text-3); white-space: nowrap; }
  .pad { padding: var(--space-2) 0; } .notes { white-space: pre-wrap; color: var(--text-2); }
  .add { display: flex; align-items: center; gap: var(--space-2); margin-top: var(--space-2); padding: 0 var(--space-3); min-height: 44px; border-radius: var(--radius-sm); background: var(--surface-2); color: var(--text-3); cursor: text; }
  .add:focus-within { box-shadow: var(--focus); color: var(--accent-ink); }
  .add input { flex: 1; border: 0; background: none; min-height: 44px; outline: none; color: var(--text); } .add input::placeholder { color: var(--text-3); }
</style>
