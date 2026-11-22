<script lang="ts">
  // New looks: today, hour by hour (in the spirit of Structured / Tiimo) — events as blocks, timed
  // tasks as markers, focus you've already done as a band on the rail, and a line for "now".
  // Untimed tasks wait underneath under "Any time today". Your own data only.
  import { Focus } from '@lucide/svelte';
  import { clock } from '../../lib/clock.svelte';
  import { changes } from '../../lib/db/changes.svelte';
  import { getRange } from '../../lib/db/idb';
  import { listTasks } from '../../lib/domain/tasks';
  import { sessionsInRange } from '../../lib/domain/focus';
  import { timeLabel } from '../../lib/domain/home';
  import { router } from '../../lib/router.svelte';
  import type { CalendarEvent, FocusSession, Task } from '../../lib/db/schema';

  let events = $state.raw<CalendarEvent[]>([]);
  let timed = $state.raw<Task[]>([]);
  let anytime = $state.raw<Task[]>([]);
  let sessions = $state.raw<FocusSession[]>([]);
  let nowMin = $state(new Date().getHours() * 60 + new Date().getMinutes());
  $effect(() => { const id = setInterval(() => { const d = new Date(); nowMin = d.getHours() * 60 + d.getMinutes(); }, 60_000); return () => clearInterval(id); });

  $effect(() => {
    const v = changes.version, day = clock.today;
    void Promise.all([getRange('events', 'by_date', day, day), listTasks(), sessionsInRange(day, day)]).then(([ev, ts, ss]) => {
      if (v !== changes.version) return;
      events = ev.filter((e) => !e.allDay && e.startTime).sort((a, b) => a.startTime!.localeCompare(b.startTime!));
      const todays = ts.filter((t) => t.dueDate === day);
      timed = todays.filter((t) => t.dueTime).sort((a, b) => a.dueTime!.localeCompare(b.dueTime!));
      anytime = todays.filter((t) => !t.dueTime && !t.done).slice(0, 6);
      sessions = ss;
    });
  });

  const mins = (hm: string) => { const [h = 0, m = 0] = hm.split(':').map(Number); return h * 60 + m; };
  const localMin = (iso: string) => { const d = new Date(iso); return d.getHours() * 60 + d.getMinutes(); };
  const HOUR = 46;

  const range = $derived.by(() => {
    // "now" only stretches the view during waking hours, so a 2 am glance doesn't show an empty night
    const pts = [...(nowMin >= 6 * 60 ? [nowMin] : []), ...events.map((e) => mins(e.startTime!)), ...events.map((e) => (e.endTime ? mins(e.endTime) : mins(e.startTime!) + 60)), ...timed.map((t) => mins(t.dueTime!))];
    const lo = Math.min(8 * 60, ...pts), hi = Math.max(21 * 60, ...pts);
    return { start: Math.max(0, Math.floor(lo / 60) - (lo % 60 === 0 && lo > 0 ? 1 : 0)), end: Math.min(24, Math.ceil(hi / 60) + 1) };
  });
  const y = (m: number) => ((m - range.start * 60) / 60) * HOUR;
  const hours = $derived(Array.from({ length: range.end - range.start + 1 }, (_, i) => range.start + i));

  // overlapping events share the width in lanes
  const blocks = $derived.by(() => {
    const lanesEnd: number[] = [];
    return events.map((e) => {
      const s = mins(e.startTime!), en = Math.max(s + 20, e.endTime ? mins(e.endTime) : s + 60);
      let lane = lanesEnd.findIndex((x) => x <= s);
      if (lane === -1) { lane = lanesEnd.length; lanesEnd.push(en); } else lanesEnd[lane] = en;
      return { e, s, en, lane };
    }).map((b, _i, all) => ({ ...b, lanes: Math.max(1, ...all.filter((o) => o.s < b.en && o.en > b.s).map((o) => o.lane + 1)) }));
  });
  const bands = $derived(sessions.map((s) => ({ s: localMin(s.startedAt), en: Math.max(localMin(s.startedAt) + 5, localMin(s.endedAt)) })));
  const empty = $derived(!events.length && !timed.length && !sessions.length);
</script>

<section class="tl gcard" aria-labelledby="tl-h">
  <header><h2 id="tl-h">Today, hour by hour</h2><span class="kicker meta">{events.length} event{events.length === 1 ? '' : 's'} · {timed.length} timed task{timed.length === 1 ? '' : 's'}</span></header>
  {#if empty}
    <p class="none">Nothing on the clock yet. Give a task a time — or type “Gym at 6pm” above — and it appears here.</p>
  {:else}
    <div class="grid" style="height:{(range.end - range.start) * HOUR}px">
      {#each hours as h (h)}
        <div class="hr" style="top:{(h - range.start) * HOUR}px"><span class="num">{timeLabel(`${String(h % 24).padStart(2, '0')}:00`).replace(':00', '')}</span></div>
      {/each}
      {#each bands as b, i (i)}<i class="band" style="top:{y(b.s)}px;height:{Math.max(4, y(b.en) - y(b.s))}px" title="Focus"></i>{/each}
      {#each blocks as b (b.e.id)}
        <button type="button" class="ev" style="top:{y(b.s)}px;height:{Math.max(38, y(b.en) - y(b.s) - 3)}px;left:calc(64px + (100% - 70px) * {b.lane / b.lanes});width:calc((100% - 70px) / {b.lanes} - 4px);--c:{b.e.color || 'var(--mod-calendar)'}"
          onclick={() => router.go({ name: 'module', module: 'calendar' })}>
          <b>{b.e.title}</b><span>{timeLabel(b.e.startTime!)}{b.e.endTime ? ` – ${timeLabel(b.e.endTime)}` : ''}</span>
        </button>
      {/each}
      {#each timed as t (t.id)}
        <button type="button" class="tk" class:done={t.done} style="top:{y(mins(t.dueTime!)) - 12}px" onclick={() => router.go({ name: 'module', module: 'tasks' })}>
          <i aria-hidden="true"></i><span class="t">{t.title}</span><span class="when">{timeLabel(t.dueTime!)}</span>
        </button>
      {/each}
      {#if nowMin >= range.start * 60 && nowMin <= range.end * 60}<div class="now" style="top:{y(nowMin)}px"><span>Now</span></div>{/if}
    </div>
  {/if}
  {#if anytime.length}
    <div class="any"><span class="kicker">Any time today</span>
      <ul>{#each anytime as t (t.id)}<li>{t.title}</li>{/each}</ul>
    </div>
  {/if}
  {#if bands.length}<p class="legend"><Focus size={13} aria-hidden="true" />The violet band on the left is focus you've done today.</p>{/if}
</section>

<style>
  .tl { --c: var(--mod-calendar); padding: var(--space-5); margin-top: var(--space-5); }
  header { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-3); flex-wrap: wrap; margin-bottom: var(--space-4); }
  h2 { font-size: var(--text-lg); }
  .meta { color: var(--text-3); }
  .none { color: var(--text-2); font-size: var(--text-sm); padding: var(--space-3) 0; }
  .grid { position: relative; margin-top: var(--space-2); }
  .hr { position: absolute; left: 0; right: 0; height: 0; border-top: 1px dashed color-mix(in srgb, var(--text) 12%, transparent); }
  .hr span { position: absolute; top: -9px; left: 0; width: 52px; font-size: 11px; color: var(--text-3); background: none; }
  .band { position: absolute; left: 56px; width: 4px; border-radius: 2px; background: var(--mod-focus); box-shadow: 0 0 10px color-mix(in srgb, var(--mod-focus) 60%, transparent); }
  .ev { position: absolute; display: grid; align-content: start; gap: 1px; padding: 5px 8px; text-align: left; overflow: hidden; cursor: pointer; border-radius: var(--radius-sm);
    border: 1px solid color-mix(in srgb, var(--c) 45%, transparent); background: color-mix(in srgb, var(--c) 16%, var(--surface)); color: var(--text); }
  .ev:hover { border-color: var(--c); }
  .ev b { font-size: var(--text-sm); font-weight: 650; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ev span { font-size: 11px; color: var(--text-2); }
  .tk { position: absolute; left: 64px; right: 6px; height: 24px; display: flex; align-items: center; gap: 8px; padding: 0 8px; border: 0; background: none; cursor: pointer; color: var(--text); text-align: left; z-index: 1; }
  .tk i { width: 9px; height: 9px; border-radius: 50%; border: 2px solid var(--mod-tasks); flex: none; background: var(--surface); }
  .tk.done i { background: var(--mod-tasks); }
  .tk.done .t { text-decoration: line-through; color: var(--text-3); }
  .tk .t { font-size: var(--text-sm); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tk .when { margin-left: auto; font-size: 11px; color: var(--text-3); flex: none; }
  .now { position: absolute; left: 48px; right: 0; height: 0; border-top: 2px solid var(--accent); z-index: 2; pointer-events: none; }
  .now::before { content: ''; position: absolute; left: -5px; top: -6px; width: 10px; height: 10px; border-radius: 50%; background: var(--accent); }
  .now span { position: absolute; right: 0; top: -18px; font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--accent-ink); }
  .any { margin-top: var(--space-5); }
  .any ul { list-style: none; margin: var(--space-2) 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
  .any li { font-size: var(--text-sm); padding: 3px 10px; border-radius: 999px; background: color-mix(in srgb, var(--text) 6%, transparent); }
  .legend { display: flex; align-items: center; gap: 6px; margin-top: var(--space-3); font-size: var(--text-xs); color: var(--text-3); }

  :global(:root[data-style='almanac']) .tl { background: none; border: 0; border-top: 2px solid var(--text); border-radius: 0; padding: var(--space-3) 0 0; margin-top: var(--space-8); }
  :global(:root[data-style='almanac']) h2 { font-size: 23px; font-weight: 400; }
  :global(:root[data-style='almanac']) .hr { border-top-style: solid; border-top-color: var(--border); }
  :global(:root[data-style='almanac']) .hr span { font-family: var(--font-mono); font-size: 10px; }
  :global(:root[data-style='almanac']) .ev { border-radius: 2px; background: color-mix(in srgb, var(--c) 10%, var(--surface)); border-left: 3px solid var(--c); }
  :global(:root[data-style='almanac']) .tk i { border-radius: 2px; border-color: var(--text); }
  :global(:root[data-style='almanac']) .tk.done i { background: var(--accent); border-color: var(--accent); }
  :global(:root[data-style='almanac']) .band { border-radius: 0; box-shadow: none; }
  :global(:root[data-style='almanac']) .any li { border-radius: 0; background: none; border-bottom: 1px solid var(--border-strong); }
  :global(:root[data-style='nebula']) .ev { background: linear-gradient(180deg, rgba(255, 255, 255, .08), rgba(255, 255, 255, 0)), color-mix(in srgb, var(--c) 20%, transparent); box-shadow: 0 6px 18px color-mix(in srgb, var(--c) 18%, transparent); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); }
  :global(:root[data-style='nebula']) .now { border-top-color: transparent; background: var(--accent-grad); height: 2px; box-shadow: 0 0 12px rgba(183, 140, 255, .7); }
</style>
