<script lang="ts">
  // The "reconstruct this date" panel: everything recorded on a past or present day, grouped by
  // module and shown only for modules the user has enabled. Tasks, habits and money can be
  // corrected right here (the same "tap a day to fix history" idea as the Habits calendar);
  // goals, wellness and notes are shown read-only with a link to their module for deeper edits.
  import { CheckSquare, Repeat, Target, Wallet, HeartPulse, NotebookPen, Droplet, Moon, Footprints, Scale, Pencil } from '@lucide/svelte';
  import Checkbox from '../../../lib/ui/Checkbox.svelte';
  import Badge from '../../../lib/ui/Badge.svelte';
  import EmptyState from '../../../lib/ui/EmptyState.svelte';
  import { href } from '../../../lib/router.svelte';
  import { openQuick } from '../../quick/quick.svelte';
  import { setTaskDone } from '../../../lib/domain/tasks';
  import { setHabitDone } from '../../../lib/domain/habits';
  import { mergedTaskChecklist, type DayHistory } from '../../../lib/domain/history';
  import { formatMoney } from '../../../lib/util/money';
  import { MOODS } from '../../../lib/moods';
  import type { FinanceCategory, ModuleId } from '../../../lib/db/schema';

  interface Props { history: DayHistory; enabledModules: ModuleId[]; currency: string; categories: Map<string, FinanceCategory> }
  let { history, enabledModules, currency, categories }: Props = $props();
  const has = (m: ModuleId) => enabledModules.includes(m);

  const tasks = $derived(mergedTaskChecklist(history));
  const moneyTotal = $derived(history.transactions.reduce((a, t) => a + (t.type === 'expense' ? -t.amountMinor : t.amountMinor), 0));
  const anySection = $derived(
    (has('tasks') && tasks.length > 0) || (has('habits') && history.habits.length > 0) || (has('goals') && history.goalCheckins.length > 0)
    || (has('finance') && history.transactions.length > 0) || (has('wellness') && (history.wellness || history.workouts.length > 0))
    || (has('notes') && history.notes.length > 0),
  );
</script>

{#if !anySection}
  <EmptyState compact title="Nothing recorded on this day" body="Tasks, habits, spending and more will show up here once you log something.">
    {#snippet icon()}<CheckSquare />{/snippet}
  </EmptyState>
{:else}
  <div class="sections">
    {#if has('tasks') && tasks.length > 0}
      <section aria-labelledby="h-tasks">
        <h3 id="h-tasks" style="--c:var(--mod-tasks)"><CheckSquare size={16} aria-hidden="true" />Tasks</h3>
        <ul class="rows">
          {#each tasks as { task, doneThatDay } (task.id)}
            <li class:done={doneThatDay}>
              <Checkbox label="{doneThatDay ? 'Mark not done' : 'Mark done'}: {task.title}" checked={doneThatDay} size={20}
                onchange={(v) => setTaskDone(task.id, v, history.date)} />
              <button type="button" class="title" onclick={() => openQuick('task', { task })}>{task.title}</button>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if has('habits') && history.habits.length > 0}
      <section aria-labelledby="h-habits">
        <h3 id="h-habits" style="--c:var(--mod-habits)"><Repeat size={16} aria-hidden="true" />Habits</h3>
        <ul class="rows">
          {#each history.habits as { habit, done } (habit.id)}
            <li class:done>
              <Checkbox label="{habit.name} {done ? 'done' : 'not done'} on this day" checked={done} color={habit.color} size={20}
                onchange={(v) => setHabitDone(habit.id, history.date, v)} />
              <span class="title">{habit.name}</span>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if has('goals') && history.goalCheckins.length > 0}
      <section aria-labelledby="h-goals">
        <h3 id="h-goals" style="--c:var(--mod-goals)"><Target size={16} aria-hidden="true" />Goal progress</h3>
        <ul class="rows plain">
          {#each history.goalCheckins as { row, goal } (row.id)}
            <li>
              <a class="title" href={href({ name: 'module', module: 'goals' })}>{goal?.title ?? 'Goal'}</a>
              <span class="meta">{row.value}{goal?.unit ? ' ' + goal.unit : ''}{row.note ? ` — ${row.note}` : ''}</span>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if has('finance') && history.transactions.length > 0}
      <section aria-labelledby="h-finance">
        <h3 id="h-finance" style="--c:var(--mod-finance)"><Wallet size={16} aria-hidden="true" />Money{#if moneyTotal !== 0}<Badge tone={moneyTotal < 0 ? 'danger' : 'success'}>{moneyTotal > 0 ? '+' : ''}{formatMoney(moneyTotal, currency)}</Badge>{/if}</h3>
        <ul class="rows">
          {#each history.transactions as t (t.id)}
            {@const cat = t.categoryId ? categories.get(t.categoryId) : undefined}
            <li>
              <button type="button" class="txrow" onclick={() => openQuick('transaction', { transaction: t })}>
                <span class="sw" style="background:{cat?.color ?? 'var(--text-3)'}" aria-hidden="true"></span>
                <span class="title">{cat?.name ?? (t.type === 'income' ? 'Income' : t.type === 'saving' ? 'Saving' : 'Expense')}{#if t.note}<span class="meta"> — {t.note}</span>{/if}</span>
                <span class="amt num {t.type}">{t.type === 'expense' ? '−' : t.type === 'income' ? '+' : ''}{formatMoney(t.amountMinor, t.currency)}</span>
              </button>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if has('wellness') && (history.wellness || history.workouts.length > 0)}
      <section aria-labelledby="h-wellness">
        <h3 id="h-wellness" style="--c:var(--mod-wellness)"><HeartPulse size={16} aria-hidden="true" />Wellness</h3>
        {#if history.wellness}
          {@const w = history.wellness}
          <div class="stats">
            {#if w.water !== null}<span class="stat"><Droplet size={14} aria-hidden="true" />{w.water}</span>{/if}
            {#if w.sleepHours !== null}<span class="stat"><Moon size={14} aria-hidden="true" />{w.sleepHours}h</span>{/if}
            {#if w.steps !== null}<span class="stat"><Footprints size={14} aria-hidden="true" />{w.steps.toLocaleString()}</span>{/if}
            {#if w.weight !== null}<span class="stat"><Scale size={14} aria-hidden="true" />{w.weight}</span>{/if}
            {#if w.mood !== null}<span class="stat mood">{MOODS[w.mood - 1]?.label}</span>{/if}
          </div>
          {#if w.note}<p class="note">{w.note}</p>{/if}
        {/if}
        {#if history.workouts.length}
          <ul class="rows">
            {#each history.workouts as wo (wo.id)}
              <li>
                <button type="button" class="txrow" onclick={() => openQuick('workout', { workout: wo })}>
                  <span class="title">{wo.type}</span>
                  <span class="meta">{wo.durationMin} min{wo.intensity ? ` · ${wo.intensity}` : ''}</span>
                  <Pencil size={14} aria-hidden="true" />
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    {/if}

    {#if has('notes') && history.notes.length > 0}
      <section aria-labelledby="h-notes">
        <h3 id="h-notes" style="--c:var(--mod-notes)"><NotebookPen size={16} aria-hidden="true" />Notes</h3>
        <ul class="rows plain">
          {#each history.notes as n (n.id)}
            <li><a class="title" href={href({ name: 'module', module: 'notes' })}>{n.title || 'Untitled'}</a>{#if n.content}<span class="meta"> — {n.content.replace(/\s+/g, ' ').trim().slice(0, 70)}</span>{/if}</li>
          {/each}
        </ul>
      </section>
    {/if}
  </div>
{/if}

<style>
  .sections { display: grid; gap: var(--space-5); }
  section h3 {
    display: flex; align-items: center; gap: 8px; font-family: var(--font-body); font-size: var(--text-sm); font-weight: 700;
    color: var(--text-2); letter-spacing: 0; margin-bottom: var(--space-2);
  }
  section h3 :global(svg:first-child) { color: var(--c); flex: none; }
  .rows { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
  .rows:not(.plain) li { display: flex; align-items: center; gap: var(--space-2); min-height: 40px; }
  .rows.plain li { padding: 6px 0; font-size: var(--text-sm); }
  .rows.plain li + li { border-top: 1px solid var(--border); }
  .done .title { text-decoration: line-through; color: var(--text-3); }
  .title { flex: 1; min-width: 0; background: none; border: 0; padding: 0; text-align: left; font: inherit; color: var(--text); cursor: pointer; overflow: hidden; text-overflow: ellipsis; }
  a.title { cursor: pointer; text-decoration: none; }
  a.title:hover { text-decoration: underline; }
  button.title:hover { color: var(--accent-ink); }
  .meta { color: var(--text-2); font-weight: 400; }
  .txrow { display: flex; align-items: center; gap: var(--space-2); width: 100%; background: none; border: 0; padding: 6px 0; cursor: pointer; text-align: left; color: var(--text); }
  .sw { width: 9px; height: 9px; border-radius: 50%; flex: none; }
  .amt { font-weight: 650; flex: none; }
  .amt.income { color: var(--success); }
  .amt.saving { color: var(--info); }
  .stats { display: flex; flex-wrap: wrap; gap: var(--space-2); }
  .stat { display: flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 999px; background: var(--surface-2); font-size: var(--text-sm); font-weight: 600; }
  .stat :global(svg) { color: var(--mod-wellness); }
  .stat.mood { font-weight: 600; }
  .note { margin: var(--space-2) 0 0; color: var(--text-2); font-size: var(--text-sm); }
</style>
