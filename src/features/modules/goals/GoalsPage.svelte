<script lang="ts">
  import { Plus, Target, TrendingUp, History } from '@lucide/svelte';
  import PageHeader from '../PageHeader.svelte';
  import Button from '../../../lib/ui/Button.svelte';
  import Segmented from '../../../lib/ui/Segmented.svelte';
  import ProgressRing from '../../../lib/ui/ProgressRing.svelte';
  import Badge from '../../../lib/ui/Badge.svelte';
  import Checkbox from '../../../lib/ui/Checkbox.svelte';
  import EmptyState from '../../../lib/ui/EmptyState.svelte';
  import Modal from '../../../lib/ui/Modal.svelte';
  import TextField from '../../../lib/ui/TextField.svelte';
  import Sparkline from '../../../lib/ui/Sparkline.svelte';
  import ConfirmDialog from '../../../lib/ui/ConfirmDialog.svelte';
  import { toast } from '../../../lib/ui/toast.svelte';
  import { changes } from '../../../lib/db/changes.svelte';
  import { clock } from '../../../lib/clock.svelte';
  import { openQuick } from '../../quick/quick.svelte';
  import { deleteGoal, goalFraction, goalHistory, goalPace, listGoals, recordProgress, setGoalStatus, toggleMilestone, type Pace } from '../../../lib/domain/goals';
  import { diffDays, formatDateKey } from '../../../lib/util/dates';
  import type { Goal, GoalProgress } from '../../../lib/db/schema';

  let goals = $state.raw<Goal[] | null>(null);
  let tab = $state('active');
  let logFor = $state.raw<Goal | null>(null);
  let logValue = $state('');
  let logNote = $state('');
  let logError = $state('');
  let detailId = $state<string | null>(null);
  let history = $state.raw<GoalProgress[]>([]);
  let confirmDelete = $state(false);

  $effect(() => { void changes.version; void listGoals().then((g) => { goals = g; }); });
  const detail = $derived(goals?.find((g) => g.id === detailId) ?? null);
  $effect(() => { void changes.version; if (detailId) void goalHistory(detailId).then((h) => { history = h; }); });

  const shown = $derived((goals ?? []).filter((g) => tab === 'active' ? g.status === 'active' || g.status === 'paused' : tab === 'done' ? g.status === 'completed' : g.status === 'archived'));
  const counts = $derived({ active: (goals ?? []).filter((g) => g.status === 'active' || g.status === 'paused').length, done: (goals ?? []).filter((g) => g.status === 'completed').length, archived: (goals ?? []).filter((g) => g.status === 'archived').length });

  const PACE: Record<Pace, { label: string; tone: 'success' | 'warning' | 'danger' | 'accent' } | null> = {
    done: { label: 'Completed', tone: 'success' }, ahead: { label: 'Ahead', tone: 'success' }, 'on-track': { label: 'On track', tone: 'accent' },
    behind: { label: 'Behind', tone: 'warning' }, overdue: { label: 'Past deadline', tone: 'danger' }, 'no-deadline': null,
  };
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  function progressText(g: Goal) {
    return g.target !== null ? `${fmt(g.current)} / ${fmt(g.target)}${g.unit ? ' ' + g.unit : ''}` : `${g.milestones.filter((m) => m.done).length} of ${g.milestones.length} milestones`;
  }
  function deadlineText(g: Goal) {
    if (!g.deadline) return 'No deadline';
    const d = diffDays(clock.today, g.deadline);
    const date = formatDateKey(g.deadline, { day: 'numeric', month: 'short', year: g.deadline.slice(0, 4) !== clock.today.slice(0, 4) ? 'numeric' : undefined });
    return d > 1 ? `${date} · ${d} days left` : d === 1 ? `${date} · tomorrow` : d === 0 ? 'Due today' : `${date} · passed`;
  }

  function openLog(g: Goal) { logFor = g; logValue = fmt(g.current); logNote = ''; logError = ''; }
  async function saveLog(e?: Event) {
    e?.preventDefault();
    if (!logFor) return;
    const v = Number(logValue.replace(',', '.'));
    if (!Number.isFinite(v) || v < 0) { logError = 'Enter a number, like 5.'; return; }
    const reached = logFor.target !== null && v >= logFor.target && logFor.current < logFor.target;
    await recordProgress(logFor.id, v, logNote.trim(), clock.today);
    toast(reached ? `Goal reached: ${logFor.title}` : 'Progress saved', { tone: 'success' });
    logFor = null;
  }
  async function status(g: Goal, s: Goal['status']) {
    await setGoalStatus(g.id, s, clock.today);
    toast(s === 'completed' ? 'Marked as completed' : s === 'paused' ? 'Goal paused' : s === 'archived' ? 'Goal archived' : 'Goal is active again');
  }
  async function del() {
    if (!detail) return;
    confirmDelete = false;
    const { id, title } = detail; // read before clearing the selection (detail derives from detailId)
    detailId = null;
    await deleteGoal(id);
    toast(`Deleted "${title}"`);
  }
</script>

<PageHeader module="goals">
  {#snippet actions()}<Button variant="primary" onclick={() => openQuick('goal')}>{#snippet icon()}<Plus />{/snippet}New goal</Button>{/snippet}
</PageHeader>

<div class="tabs">
  <Segmented label="Goal status" bind:value={tab} options={[{ value: 'active', label: `Active${counts.active ? ` · ${counts.active}` : ''}` }, { value: 'done', label: `Completed${counts.done ? ` · ${counts.done}` : ''}` }, { value: 'archived', label: 'Archived' }]} />
</div>

{#if goals}
  {#if shown.length === 0}
    <div class="card">
      <EmptyState title={tab === 'active' ? 'No active goals' : tab === 'done' ? 'No completed goals yet' : 'Nothing archived'} body={tab === 'active' ? 'Set something to work toward — a number to reach or milestones to tick off.' : ''}>
        {#snippet icon()}<Target />{/snippet}
        {#snippet action()}{#if tab === 'active'}<Button variant="primary" onclick={() => openQuick('goal')}>{#snippet icon()}<Plus />{/snippet}Set a goal</Button>{/if}{/snippet}
      </EmptyState>
    </div>
  {:else}
    <ul class="goals">
      {#each shown as g (g.id)}
        {@const pace = g.status === 'paused' ? null : PACE[goalPace(g, clock.today)]}
        <li class="goal">
          <div class="top">
            <ProgressRing value={goalFraction(g) * 100} size={64} stroke={7} label="{g.title} progress" color="var(--mod-goals)" />
            <div class="t">
              <button type="button" class="title" onclick={() => (detailId = g.id)}>{g.title}</button>
              <p class="meta">{progressText(g)}</p>
              <p class="meta">{deadlineText(g)}</p>
            </div>
            <div class="badges">
              {#if g.status === 'paused'}<Badge>Paused</Badge>{:else if pace}<Badge tone={pace.tone}>{pace.label}</Badge>{/if}
            </div>
          </div>
          {#if g.description}<p class="desc">{g.description}</p>{/if}
          {#if g.milestones.length}
            <ul class="ms">
              {#each g.milestones as m (m.id)}
                <li><Checkbox label="Milestone: {m.title}" checked={m.done} size={20} color="var(--mod-goals)" onchange={(v) => toggleMilestone(g.id, m.id, v, clock.today)} /><span class:done={m.done}>{m.title}</span>{#if m.doneOn}<span class="meta">{formatDateKey(m.doneOn, { day: 'numeric', month: 'short' })}</span>{/if}</li>
              {/each}
            </ul>
          {/if}
          <div class="acts">
            {#if g.target !== null && g.status !== 'archived'}<Button size="sm" variant="primary" onclick={() => openLog(g)}>{#snippet icon()}<TrendingUp />{/snippet}Log progress</Button>{/if}
            <Button size="sm" variant="ghost" onclick={() => (detailId = g.id)}>{#snippet icon()}<History />{/snippet}History</Button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
{/if}

<Modal open={!!logFor} title="Log progress" description={logFor ? `${logFor.title} — target ${fmt(logFor.target ?? 0)}${logFor.unit ? ' ' + logFor.unit : ''}` : ''} size="sm" onclose={() => (logFor = null)}>
  <form class="form" onsubmit={saveLog}>
    <TextField label="Where are you now?{logFor?.unit ? ` (${logFor.unit})` : ''}" bind:value={logValue} inputmode="decimal" error={logError} oninput={() => (logError = '')} hint="Saved as today's check-in, so you can look back later." />
    <TextField label="Note (optional)" bind:value={logNote} maxlength={200} />
  </form>
  {#snippet footer()}<Button variant="ghost" onclick={() => (logFor = null)}>Cancel</Button><Button variant="primary" onclick={() => saveLog()}>Save progress</Button>{/snippet}
</Modal>

<Modal open={!!detail} title={detail?.title ?? ''} description={detail ? `${progressText(detail)} · ${deadlineText(detail)}` : ''} size="md" onclose={() => (detailId = null)}>
  {#if detail}
    {#if history.length > 1}<div class="spark"><Sparkline values={history.map((h) => h.value)} label="Progress over time" color="var(--mod-goals)" height={56} /></div>{/if}
    <h3 class="sub">History</h3>
    {#if history.length === 0}<p class="meta">No check-ins yet.</p>{:else}
      <ol class="hist">
        {#each [...history].reverse() as h (h.id)}
          <li><span class="d">{formatDateKey(h.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span><span class="num v">{fmt(h.value)}{detail.target !== null && detail.unit ? ' ' + detail.unit : detail.target === null ? ' done' : ''}</span>{#if h.note}<span class="meta note">{h.note}</span>{/if}</li>
        {/each}
      </ol>
    {/if}
  {/if}
  {#snippet footer()}
    {#if detail}
      <span class="left">
        <Button size="sm" variant="ghost" onclick={() => (confirmDelete = true)}>Delete</Button>
        {#if detail.status === 'archived'}<Button size="sm" variant="ghost" onclick={() => status(detail!, 'active')}>Restore</Button>
        {:else}<Button size="sm" variant="ghost" onclick={() => status(detail!, 'archived')}>Archive</Button>{/if}
      </span>
      {#if detail.status === 'active'}<Button size="sm" variant="ghost" onclick={() => status(detail!, 'paused')}>Pause</Button>{:else if detail.status === 'paused'}<Button size="sm" variant="ghost" onclick={() => status(detail!, 'active')}>Resume</Button>{/if}
      {#if detail.status !== 'completed'}<Button size="sm" onclick={() => status(detail!, 'completed')}>Mark complete</Button>{/if}
      <Button size="sm" variant="primary" onclick={() => { const g = detail; detailId = null; openQuick('goal', { goal: $state.snapshot(g) }); }}>Edit</Button>
    {/if}
  {/snippet}
</Modal>

<ConfirmDialog bind:open={confirmDelete} title="Delete this goal?" confirmLabel="Delete goal and history"
  message={`"${detail?.title ?? ''}" and its ${history.length} progress check-ins will be permanently deleted. Archive it instead to keep the history.`} onconfirm={del} />

<style>
  .tabs { max-width: 460px; margin-bottom: var(--space-5); }
  .card { background: var(--surface); border: var(--card-border); border-radius: var(--radius-lg); }
  .goals { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-3); grid-template-columns: repeat(auto-fill, minmax(min(100%, 380px), 1fr)); align-items: start; }
  .goal { background: var(--surface); border: var(--card-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-1); padding: var(--space-4); display: grid; gap: var(--space-3); }
  .top { display: flex; gap: var(--space-3); align-items: flex-start; }
  .t { flex: 1; min-width: 0; display: grid; gap: 2px; }
  .title { text-align: left; background: none; border: 0; padding: 0; cursor: pointer; color: var(--text); font-weight: 700; font-size: var(--text-md); }
  .title:hover { color: var(--accent-ink); }
  .desc { color: var(--text-2); font-size: var(--text-sm); }
  .ms { list-style: none; margin: 0; padding: 0; display: grid; }
  .ms li { display: flex; align-items: center; gap: var(--space-2); min-height: 40px; }
  .ms li span:nth-child(2) { flex: 1; }
  .ms .done { text-decoration: line-through; color: var(--text-3); }
  .acts { display: flex; gap: var(--space-2); flex-wrap: wrap; }
  .form { display: grid; gap: var(--space-4); }
  .spark { margin-bottom: var(--space-4); }
  .sub { font-family: var(--font-body); font-size: var(--text-sm); font-weight: 700; color: var(--text-2); letter-spacing: 0; margin-bottom: var(--space-2); }
  .hist { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; max-height: 280px; overflow: auto; }
  .hist li { display: grid; grid-template-columns: 1fr auto; gap: 2px var(--space-3); padding: var(--space-2) 0; border-bottom: 1px solid var(--border); }
  .hist .v { font-weight: 700; }
  .hist .note { grid-column: 1 / -1; }
  .left { margin-right: auto; display: flex; gap: var(--space-1); }
  .left :global(.btn:first-child) { color: var(--danger); }
</style>
