<script lang="ts">
  // New looks: Close the day — an evening ritual. 1 what you finished, 2 loose ends (tomorrow / next
  // week / someday / done), 3 one line about today with a mood, 4 tomorrow at a glance. Closing saves
  // the line as a journal note; nothing else changes unless you move a loose end yourself.
  import { MoonStar, CheckCircle2, ArrowRight, CalendarClock, Sparkles } from '@lucide/svelte';
  import PageKicker from '../modules/PageKicker.svelte';
  import Card from '../../lib/ui/Card.svelte';
  import Button from '../../lib/ui/Button.svelte';
  import { app } from '../../lib/app.svelte';
  import { clock } from '../../lib/clock.svelte';
  import { changes } from '../../lib/db/changes.svelte';
  import { router } from '../../lib/router.svelte';
  import { toast } from '../../lib/ui/toast.svelte';
  import { MOODS } from '../../lib/moods';
  import { timeLabel } from '../../lib/domain/home';
  import { formatMinutes } from '../../lib/domain/focus';
  import { closeTheDay, loadDaySummary, moveLooseEnd, type DaySummary, type LooseMove } from '../../lib/domain/rituals';
  import { addDays, formatDateKey } from '../../lib/util/dates';
  import type { Task } from '../../lib/db/schema';

  let s = $state.raw<DaySummary | null>(null);
  let line = $state('');
  let mood = $state<1 | 2 | 3 | 4 | 5 | null>(null);
  let seeded = false;
  let saving = $state(false);
  $effect(() => {
    const v = changes.version, day = clock.today;
    void loadDaySummary(day).then((r) => {
      if (v !== changes.version) return;
      s = r;
      if (!seeded && r.closing) { seeded = true; line = r.closing.content.split('\n\n— ')[0]!.replace(/^— .*/, ''); mood = r.closing.mood ?? null; }
    });
  });

  const lateBy = (t: Task) => {
    if (!s || !t.dueDate || t.dueDate === s.day) return 'Today';
    const d = Math.round((Date.parse(s.day) - Date.parse(t.dueDate)) / 86_400_000);
    return `${d} day${d === 1 ? '' : 's'} late`;
  };
  async function move(t: Task, m: LooseMove) {
    await moveLooseEnd(t, m, clock.today, app.settings?.weekStartsOn ?? 1);
    toast(m === 'done' ? `Done: ${t.title}` : m === 'tomorrow' ? `“${t.title}” → tomorrow` : m === 'next-week' ? `“${t.title}” → next week` : `“${t.title}” → someday`);
  }
  async function close() {
    if (!s || saving) return;
    saving = true;
    try {
      await closeTheDay(s, line, mood);
      toast(s.closing ? 'Your closing note is updated.' : 'Day closed. Tomorrow is ready — rest well.');
      router.go({ name: 'dashboard' });
    } finally { saving = false; }
  }
</script>

<header class="ph">
  <span class="ico" aria-hidden="true"><MoonStar size={24} /></span>
  <div class="t"><PageKicker id="close" /><h1>Close the day</h1><p class="muted">Five quiet minutes: see what you did, tidy the loose ends, and leave tomorrow ready.</p></div>
</header>

{#if s}
  {#if s.closing}<p class="closed"><CheckCircle2 size={16} aria-hidden="true" />You closed today already. Change anything below and close again to update it.</p>{/if}

  <div class="steps">
    <Card title="1 · What you finished" subtitle={formatDateKey(s.day, { weekday: 'long', day: 'numeric', month: 'long' })}>
      <div class="facts">
        <div><b class="num">{s.done.length}</b><span>task{s.done.length === 1 ? '' : 's'} done</span></div>
        <div><b class="num">{s.habitsDone.length}<small>/{s.habitsDone.length + s.habitsOpen.length}</small></b><span>habits checked</span></div>
        <div><b class="num">{formatMinutes(s.focusMin)}</b><span>focus</span></div>
      </div>
      {#if s.done.length}
        <ul class="done">{#each s.done.slice(0, 8) as t (t.id)}<li><CheckCircle2 size={15} aria-hidden="true" />{t.title}</li>{/each}</ul>
        {#if s.done.length > 8}<p class="more">and {s.done.length - 8} more.</p>{/if}
      {:else}
        <p class="soft">No tasks ticked off today — rest days count too.</p>
      {/if}
    </Card>

    <Card title="2 · Loose ends" subtitle={s.loose.length ? 'Give each one a home, so nothing follows you to bed.' : ''}>
      {#if s.loose.length}
        <ul class="loose">
          {#each s.loose as t (t.id)}
            <li>
              <div class="lt"><b>{t.title}</b><span class:late={lateBy(t) !== 'Today'}>{lateBy(t)}</span></div>
              <div class="la" role="group" aria-label="Move “{t.title}”">
                <button type="button" onclick={() => void move(t, 'tomorrow')}>Tomorrow</button>
                <button type="button" onclick={() => void move(t, 'next-week')}>Next week</button>
                <button type="button" onclick={() => void move(t, 'someday')}>Someday</button>
                <button type="button" class="ok" onclick={() => void move(t, 'done')}>Done</button>
              </div>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="clear"><Sparkles size={16} aria-hidden="true" />Nothing left hanging. A clean slate.</p>
      {/if}
    </Card>

    <Card title="3 · One line about today">
      <label class="line"><span class="sr-only">One line about today</span>
        <textarea bind:value={line} rows="2" maxlength="280" placeholder="What mattered today? A win, a thought, a thank-you…"></textarea>
      </label>
      <div class="moods" role="radiogroup" aria-label="How was today?">
        {#each MOODS as m (m.value)}
          <button type="button" role="radio" aria-checked={mood === m.value} class:on={mood === m.value} style="--m:{m.color}" onclick={() => (mood = mood === m.value ? null : (m.value as 1 | 2 | 3 | 4 | 5))}>
            <m.icon size={18} aria-hidden="true" /><span>{m.label}</span>
          </button>
        {/each}
      </div>
    </Card>

    <Card title="4 · Tomorrow" subtitle={formatDateKey(addDays(s.day, 1), { weekday: 'long', day: 'numeric', month: 'long' })}>
      {#if s.tomorrowEvents.length || s.tomorrowTasks.length}
        <ul class="tom">
          {#each s.tomorrowEvents as e (e.id)}<li><CalendarClock size={15} aria-hidden="true" /><span class="when">{e.allDay || !e.startTime ? 'All day' : timeLabel(e.startTime)}</span>{e.title}</li>{/each}
          {#each s.tomorrowTasks as t (t.id)}<li><ArrowRight size={15} aria-hidden="true" /><span class="when">{t.dueTime ? timeLabel(t.dueTime) : 'Task'}</span>{t.title}</li>{/each}
        </ul>
      {:else}
        <p class="soft">Nothing planned yet — a blank page to start fresh.</p>
      {/if}
    </Card>
  </div>

  <div class="go"><Button variant="primary" size="lg" loading={saving} onclick={() => void close()}>{#snippet icon()}<MoonStar />{/snippet}{s.closing ? 'Update & close the day' : 'Close the day'}</Button></div>
{/if}

<style>
  .ph { display: flex; align-items: center; gap: var(--space-4); margin-bottom: var(--space-5); flex-wrap: wrap; }
  .ico { width: 52px; height: 52px; border-radius: var(--radius-lg); display: grid; place-items: center; color: var(--mod-focus); background: color-mix(in srgb, var(--mod-focus) 14%, transparent); box-shadow: var(--glow); flex: none; }
  .t { flex: 1; min-width: 200px; }
  .closed { display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-4); font-size: var(--text-sm); color: var(--success); }
  .steps { display: grid; gap: var(--space-4); grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr)); align-items: start; }
  .facts { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-3); margin-bottom: var(--space-4); }
  .facts div { display: grid; gap: 2px; }
  .facts b { font-family: var(--font-display); font-weight: var(--display-weight); font-size: var(--text-2xl); letter-spacing: var(--display-tracking); line-height: 1; }
  .facts small { font-size: .5em; color: var(--text-3); }
  .facts span { font-size: var(--text-xs); color: var(--text-2); }
  ul { list-style: none; margin: 0; padding: 0; }
  .done { display: grid; gap: 6px; }
  .done li { display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-sm); }
  .done :global(svg) { color: var(--success); flex: none; }
  .more, .soft { font-size: var(--text-sm); color: var(--text-2); margin-top: var(--space-2); }
  .loose { display: grid; gap: var(--space-2); }
  .loose li { display: grid; gap: var(--space-2); padding: var(--space-3); border-radius: var(--radius-md); background: color-mix(in srgb, var(--text) 4%, transparent); border: 1px solid var(--border); }
  .lt { display: flex; justify-content: space-between; gap: var(--space-2); align-items: baseline; }
  .lt b { font-weight: 600; font-size: var(--text-sm); }
  .lt span { font-size: var(--text-xs); color: var(--text-3); flex: none; }
  .lt span.late { color: var(--warning); font-weight: 650; }
  .la { display: flex; flex-wrap: wrap; gap: 6px; }
  .la button { height: 30px; padding: 0 12px; border-radius: 999px; font-size: var(--text-xs); font-weight: 650; cursor: pointer; color: var(--text-2); background: none; border: 1px solid var(--border-strong); }
  .la button:hover { color: var(--text); border-color: var(--accent); }
  .la button.ok { color: var(--success); border-color: color-mix(in srgb, var(--success) 50%, transparent); }
  .clear { display: flex; align-items: center; gap: var(--space-2); color: var(--text-2); font-size: var(--text-sm); }
  .clear :global(svg) { color: var(--accent); }
  .line textarea { width: 100%; resize: vertical; padding: 12px 14px; border-radius: var(--radius-sm); border: 1px solid var(--border-strong); background: var(--surface); color: var(--text); font: inherit; line-height: 1.5; }
  .line textarea:focus-visible { border-color: var(--accent); box-shadow: var(--focus); }
  .moods { display: flex; flex-wrap: wrap; gap: 6px; margin-top: var(--space-3); }
  .moods button { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 12px; border-radius: 999px; cursor: pointer; font-size: var(--text-xs); font-weight: 650; color: var(--text-2); background: none; border: 1px solid var(--border); }
  .moods button :global(svg) { color: var(--m); }
  .moods button.on { color: var(--text); border-color: var(--m); background: color-mix(in srgb, var(--m) 16%, transparent); }
  .tom { display: grid; gap: 8px; }
  .tom li { display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-sm); }
  .tom :global(svg) { color: var(--accent-ink); flex: none; }
  .when { min-width: 64px; font-size: var(--text-xs); color: var(--text-3); }
  .go { display: flex; justify-content: center; margin: var(--space-7) 0 var(--space-4); }

  :global(:root[data-style='almanac']) .loose li { border-radius: 0; background: none; border: 0; border-bottom: 1px solid var(--border-strong); padding: var(--space-2) 0; }
  :global(:root[data-style='almanac']) .la button { border-color: var(--text); color: var(--text); font-weight: 500; }
  :global(:root[data-style='almanac']) .la button:hover { background: var(--text); color: var(--bg); }
  :global(:root[data-style='almanac']) .line textarea { font-family: var(--font-display); font-style: italic; font-size: 19px; border-radius: 0; border: 0; border-bottom: 1px solid var(--text); background: transparent; padding-left: 0; }
  :global(:root[data-style='almanac']) .line textarea:focus-visible { box-shadow: none; border-bottom-color: var(--accent); }
  :global(:root[data-style='almanac']) .facts b { font-weight: 320; font-size: 44px; }
</style>
