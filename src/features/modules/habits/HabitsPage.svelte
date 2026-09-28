<script lang="ts">
  import { Plus, Repeat, Pencil, Archive } from '@lucide/svelte';
  import PageHeader from '../PageHeader.svelte';
  import Button from '../../../lib/ui/Button.svelte';
  import Checkbox from '../../../lib/ui/Checkbox.svelte';
  import DayStrip from '../../../lib/ui/DayStrip.svelte';
  import EmptyState from '../../../lib/ui/EmptyState.svelte';
  import Modal from '../../../lib/ui/Modal.svelte';
  import MonthGrid from '../../../lib/ui/MonthGrid.svelte';
  import MonthNav from '../../../lib/ui/MonthNav.svelte';
  import { changes } from '../../../lib/db/changes.svelte';
  import { clock } from '../../../lib/clock.svelte';
  import { app } from '../../../lib/app.svelte';
  import { openQuick } from '../../quick/quick.svelte';
  import { frequencyLabel, habitStats, isDueOn, listHabits, logsByHabit, setHabitDone, type HabitStats } from '../../../lib/domain/habits';
  import { startOfMonth, type DateKey } from '../../../lib/util/dates';
  import type { Habit } from '../../../lib/db/schema';

  interface Row { habit: Habit; stats: HabitStats; done: Set<string> }
  let rows = $state.raw<Row[] | null>(null);
  let showArchived = $state(false);
  let detailId = $state<string | null>(null);
  let month = $state(startOfMonth(clock.today));

  $effect(() => {
    void changes.version;
    const day = clock.today;
    const ws = app.settings?.weekStartsOn ?? 1;
    void (async () => {
      const habits = await listHabits(true);
      rows = await Promise.all(habits.map(async (h) => {
        const done = await logsByHabit(h.id);
        return { habit: h, done, stats: habitStats(h, done, day, ws) };
      }));
    })();
  });

  const active = $derived(rows?.filter((r) => !r.habit.archived) ?? []);
  const archived = $derived(rows?.filter((r) => r.habit.archived) ?? []);
  const detail = $derived(rows?.find((r) => r.habit.id === detailId) ?? null);
  const pct = (r: number | null) => (r === null ? '—' : `${Math.round(r * 100)}%`);
  const streakUnit = (s: HabitStats, n: number) => `${n} ${s.unit}${n === 1 ? '' : 's'}`;

  function openDetail(id: string) { detailId = id; month = startOfMonth(clock.today); }
  async function toggleDay(d: DateKey) {
    if (!detail || d > clock.today) return; // past days can be corrected; the future cannot be checked
    await setHabitDone(detail.habit.id, d, !detail.done.has(d));
  }
</script>

<PageHeader module="habits">
  {#snippet actions()}<Button variant="primary" onclick={() => openQuick('habit')}>{#snippet icon()}<Plus />{/snippet}New habit</Button>{/snippet}
</PageHeader>

{#if rows}
  {#if active.length === 0}
    <div class="card">
      <EmptyState title="No habits yet" body="Start with one small thing you want to do regularly — like reading, stretching or drinking water.">
        {#snippet icon()}<Repeat />{/snippet}
        {#snippet action()}<Button variant="primary" onclick={() => openQuick('habit')}>{#snippet icon()}<Plus />{/snippet}Create your first habit</Button>{/snippet}
      </EmptyState>
    </div>
  {:else}
    <ul class="habits">
      {#each active as r (r.habit.id)}
        {@const h = r.habit}
        <li class="habit" style="--c:{h.color}">
          <div class="top">
            <Checkbox label="{h.name} done today" checked={r.stats.doneToday} color={h.color} onchange={(v) => setHabitDone(h.id, clock.today, v)} />
            <button type="button" class="name" onclick={() => openDetail(h.id)}>
              <span class="n">{h.name}</span>
              <span class="meta">{frequencyLabel(h.frequency)}{!r.stats.dueToday ? ' · not due today' : ''}</span>
            </button>
            <button type="button" class="edit" aria-label="Edit {h.name}" onclick={() => openQuick('habit', { habit: $state.snapshot(h) })}><Pencil size={16} /></button>
          </div>
          <div class="stats">
            <div><span class="v num">{streakUnit(r.stats, r.stats.current)}</span><span class="l">Current streak</span></div>
            <div><span class="v num">{streakUnit(r.stats, r.stats.best)}</span><span class="l">Best streak</span></div>
            <div><span class="v num">{pct(r.stats.rate)}</span><span class="l">Last 30 days</span></div>
          </div>
          <button type="button" class="stripbtn" onclick={() => openDetail(h.id)} aria-label="Open {h.name} history">
            <DayStrip end={clock.today} days={30} done={r.done} due={(d) => isDueOn(h.frequency, d) && d >= h.createdOn} color={h.color} label="{h.name}, last 30 days" />
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  {#if archived.length}
    <div class="arch">
      <Button variant="ghost" size="sm" onclick={() => (showArchived = !showArchived)}>{#snippet icon()}<Archive />{/snippet}{showArchived ? 'Hide' : 'Show'} archived ({archived.length})</Button>
      {#if showArchived}
        <ul class="archlist">
          {#each archived as r (r.habit.id)}
            <li><span>{r.habit.name}</span><span class="meta">best {streakUnit(r.stats, r.stats.best)}</span><Button size="sm" variant="ghost" onclick={() => openQuick('habit', { habit: $state.snapshot(r.habit) })}>Manage</Button></li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}
{/if}

<Modal open={!!detail} title={detail?.habit.name ?? ''} description={detail ? `${frequencyLabel(detail.habit.frequency)} · tap a day to fix your history` : ''} size="lg" onclose={() => (detailId = null)}>
  {#if detail}
    <div class="dhead">
      <MonthNav {month} today={clock.today} allowFuture={false} onchange={(m) => (month = m)} />
      <span class="meta">{streakUnit(detail.stats, detail.stats.current)} current · best {streakUnit(detail.stats, detail.stats.best)}</span>
    </div>
    <MonthGrid {month} today={clock.today} weekStartsOn={app.settings?.weekStartsOn ?? 1} label="{detail.habit.name} history" compact onselect={toggleDay}>
      {#snippet cell(d)}
        {#if detail.done.has(d)}<span class="dot on" style="background:{detail.habit.color}" aria-label="done"></span>
        {:else if d <= clock.today && d >= detail.habit.createdOn && isDueOn(detail.habit.frequency, d)}<span class="dot miss" aria-label="missed"></span>{/if}
      {/snippet}
    </MonthGrid>
    <p class="meta legend"><span class="dot on" style="background:{detail.habit.color}"></span> done <span class="dot miss"></span> missed. Future days can't be checked.</p>
  {/if}
</Modal>

<style>
  .card { background: var(--surface); border: var(--card-border); border-radius: var(--radius-lg); }
  .habits { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-3); grid-template-columns: repeat(auto-fill, minmax(min(100%, 380px), 1fr)); }
  .habit { background: var(--surface); border: var(--card-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-1); padding: var(--space-3) var(--space-4) var(--space-4); display: grid; gap: var(--space-3); border-top: 3px solid var(--c); }
  .top { display: flex; align-items: center; gap: var(--space-2); }
  .name { flex: 1; min-width: 0; display: grid; text-align: left; background: none; border: 0; cursor: pointer; color: var(--text); padding: 4px 0; }
  .n { font-weight: 650; font-size: var(--text-md); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .edit { width: 40px; height: 40px; display: grid; place-items: center; border: 0; background: none; color: var(--text-3); border-radius: var(--radius-sm); cursor: pointer; }
  .edit:hover { background: var(--surface-2); color: var(--text); }
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-2); }
  .stats > div { display: grid; gap: 2px; padding: var(--space-2) var(--space-3); background: var(--surface-2); border-radius: var(--radius-sm); }
  .v { font-weight: 700; }
  .l { font-size: var(--text-xs); color: var(--text-3); }
  .stripbtn { background: none; border: 0; padding: 0; cursor: pointer; }
  .stripbtn:focus-visible { border-radius: var(--radius-xs); }
  .arch { margin-top: var(--space-5); }
  .archlist { list-style: none; padding: 0; margin: var(--space-2) 0 0; display: grid; gap: var(--space-1); }
  .archlist li { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) var(--space-3); background: var(--surface); border: var(--card-border); border-radius: var(--radius-md); }
  .archlist li span:first-child { flex: 1; }
  .dhead { display: flex; justify-content: space-between; align-items: center; gap: var(--space-3); flex-wrap: wrap; margin-bottom: var(--space-3); }
  .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; }
  .dot.miss { background: transparent; border: 1.5px solid var(--border-strong); }
  .legend { display: flex; align-items: center; gap: 6px; margin-top: var(--space-3); }
</style>
