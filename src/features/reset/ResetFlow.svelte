<script lang="ts">
  // The guided Weekly Reset: look back → wins → loose ends → goals → habits → priorities → plan → "Your
  // week is ready." Full-screen, one idea per step, nothing written until the end.
  import { fly, fade, scale } from 'svelte/transition';
  import { ArrowLeft, ArrowRight, X, Check, Sparkles, TrendingUp, TrendingDown, Plus } from '../../lib/navicons';
  import Button from '../../lib/ui/Button.svelte';
  import ProgressBar from '../../lib/ui/ProgressBar.svelte';
  import { reset, STEP_LABEL } from '../../lib/reset.svelte';
  import { app } from '../../lib/app.svelte';
  import { clock } from '../../lib/clock.svelte';
  import { dur } from '../../lib/motion';
  import { formatDateKey, type DateKey } from '../../lib/util/dates';
  import { formatMinutes } from '../../lib/domain/focus';
  import { formatMoney } from '../../lib/util/money';
  import { goalFraction } from '../../lib/domain/goals';
  import type { Task } from '../../lib/db/schema';

  let dlg: HTMLDialogElement | undefined = $state();
  let newPriority = $state('');
  let newWin = $state('');

  $effect(() => {
    if (!dlg) return;
    if (reset.open && !dlg.open) dlg.showModal();
    else if (!reset.open && dlg.open) dlg.close();
  });

  const r = $derived(reset.report);
  const cur = $derived(reset.current);
  const wk = (d: DateKey) => formatDateKey(d, { day: 'numeric', month: 'short' });
  const dow = (d: DateKey) => formatDateKey(d, { weekday: 'short' });
  const rangeLabel = $derived(`${wk(reset.reviewWeek)} – ${wk(r?.end ?? reset.reviewWeek)}`);
  const planLabel = $derived(`${wk(reset.planWeek)} – ${wk(reset.planDays[6] ?? reset.planWeek)}`);
  const currency = $derived(app.settings?.currency ?? 'USD');

  function delta(now: number, prev: number, unit = ''): { text: string; up: boolean | null } {
    if (prev === 0 && now === 0) return { text: 'same as before', up: null };
    const d = now - prev;
    if (d === 0) return { text: 'same as last week', up: null };
    return { text: `${d > 0 ? '+' : '−'}${Math.abs(Math.round(d))}${unit} vs last week`, up: d > 0 };
  }

  const tiles = $derived.by(() => {
    if (!r) return [];
    const out: { id: string; label: string; value: string; note: string; up: boolean | null; bars: number[]; color: string }[] = [];
    const on = (m: string) => reset.enabled.includes(m as never);
    if (on('tasks')) out.push({ id: 'tasks', label: 'Tasks done', value: String(r.tasksDone), ...(() => { const d = delta(r.tasksDone, r.tasksDonePrev); return { note: d.text, up: d.up }; })(), bars: r.days.map((d) => d.tasksDone), color: 'var(--mod-tasks)' });
    if (on('habits') && r.habitRate !== null) out.push({ id: 'habits', label: 'Habits done', value: `${Math.round(r.habitRate * 100)}%`, ...(() => { const d = r.habitRatePrev === null ? { text: 'first full week', up: null } : delta(Math.round(r.habitRate! * 100), Math.round(r.habitRatePrev * 100), ' pts'); return { note: d.text, up: d.up as boolean | null }; })(), bars: r.days.map((d) => d.habitChecks), color: 'var(--mod-habits)' });
    if (r.focusMin > 0 || r.focusMinPrev > 0) out.push({ id: 'focus', label: 'Focus time', value: formatMinutes(r.focusMin), ...(() => { const d = delta(Math.round(r.focusMin), Math.round(r.focusMinPrev), ' min'); return { note: d.text, up: d.up }; })(), bars: r.days.map((d) => d.focusMin), color: 'var(--mod-focus)' });
    if (on('wellness') && r.workouts > 0) out.push({ id: 'move', label: 'Workouts', value: String(r.workouts), note: r.moodAvg !== null ? `mood averaged ${r.moodAvg}/5` : 'logged', up: null, bars: [], color: 'var(--mod-wellness)' });
    else if (on('finance') && r.spentMinor !== null) out.push({ id: 'spent', label: 'Spent', value: formatMoney(r.spentMinor, currency), note: r.spentMinorPrev !== null ? `${formatMoney(r.spentMinorPrev, currency)} the week before` : 'this week', up: null, bars: [], color: 'var(--mod-finance)' });
    return out.slice(0, 4);
  });

  const dueLabel = (t: Task) => (t.dueDate ? wk(t.dueDate as DateKey) : 'No date');
  const moveDay = (t: Task) => { const d = reset.decisions[t.id]; return d && d.action === 'move' ? d.day : null; };
  const carried = $derived(Object.values(reset.decisions).filter((d) => d.action === 'carry').length);
  const moved = $derived(Object.values(reset.decisions).filter((d) => d.action === 'move').length);
  const dropped = $derived(Object.values(reset.decisions).filter((d) => d.action === 'drop').length);

  const eventsByDay = $derived.by(() => {
    const m = new Map<string, string[]>();
    for (const e of reset.planEvents) m.set(e.date, [...(m.get(e.date) ?? []), e.title]);
    return m;
  });
  const deadlines = $derived(reset.goals.filter((g) => g.deadline && g.deadline >= reset.planWeek && g.deadline <= (reset.planDays[6] ?? '')).map((g) => ({ date: g.deadline as DateKey, title: `Goal due: ${g.title}` })));

  function addCustomWin() { const t = newWin.trim(); if (!t) return; reset.customWins = [...reset.customWins, t]; newWin = ''; }
  function addNewPriority() { reset.addPriority({ title: newPriority, taskId: null }); newPriority = ''; }
  const primaryLabel = $derived(cur === 'plan' ? 'Plan my week' : cur === 'lookback' ? "Let's go" : 'Continue');
  const embers = Array.from({ length: 26 }, (_, i) => ({ x: (i * 37) % 100, d: (i * 173) % 1400, s: 4 + ((i * 7) % 7), t: 3200 + ((i * 331) % 2200) }));
</script>

<dialog bind:this={dlg} class="reset" aria-label="Weekly Reset" oncancel={(e) => { e.preventDefault(); reset.close(); }}>
  <div class="room">
    <header class="top">
      <ol class="rail" aria-label="Reset progress">
        {#each reset.steps as s, i (s)}
          <li><button type="button" class="seg" class:done={i < reset.step} class:now={i === reset.step} disabled={i > reset.step || reset.saving} onclick={() => reset.goto(i)}
            aria-label="{STEP_LABEL[s]}{i === reset.step ? ' (current step)' : ''}" aria-current={i === reset.step ? 'step' : undefined}>
            <span class="bar"></span><span class="nm">{STEP_LABEL[s]}</span>
          </button></li>
        {/each}
      </ol>
      <button type="button" class="x" onclick={() => reset.close()} aria-label="Close — your progress is kept until you finish"><X size={18} /></button>
    </header>

    <main class="stage">
      {#if reset.loading || !r}
        <div class="loading" aria-busy="true"><span class="orb"></span><p>Gathering your week…</p></div>
      {:else}
        {#key cur}
          <section class="step" in:fly={{ x: 36 * reset.dir, duration: dur(380), delay: dur(80) }} out:fade={{ duration: dur(110) }} aria-labelledby="rs-h">

            {#if cur === 'lookback'}
              <p class="eyebrow">Weekly Reset · {rangeLabel}</p>
              <h1 id="rs-h">How did last week go?</h1>
              {#if r.hasAnyActivity}
                <p class="lead">Here is what actually happened — just the numbers, no scores.</p>
                <div class="tiles">
                  {#each tiles as t, i (t.id)}
                    <article class="tile" style="--c:{t.color};--i:{i}">
                      <span class="tl">{t.label}</span>
                      <span class="tv num">{t.value}</span>
                      <span class="tn" class:up={t.up === true} class:down={t.up === false}>
                        {#if t.up === true}<TrendingUp size={13} aria-hidden="true" />{:else if t.up === false}<TrendingDown size={13} aria-hidden="true" />{/if}{t.note}
                      </span>
                      {#if t.bars.length}
                        {@const mx = Math.max(1, ...t.bars)}
                        <div class="mini" aria-hidden="true">{#each t.bars as b, j (j)}<i style="height:{Math.max(6, (b / mx) * 100)}%;opacity:{b ? 1 : .25};animation-delay:{j * 45 + 200}ms"></i>{/each}</div>
                      {/if}
                    </article>
                  {/each}
                </div>
                {#if r.bestDay}<p class="note">Strongest day: <strong>{formatDateKey(r.bestDay.date, { weekday: 'long' })}</strong> — {r.bestDay.score} things done.</p>{/if}
              {:else}
                <p class="lead">A quiet week — nothing was logged. That's fine: the reset still helps you set up the next one.</p>
              {/if}
              {#if reset.reviewWeek !== reset.planWeek && clock.today >= reset.planWeek}
                <button type="button" class="link" onclick={() => reset.begin({ week: reset.planWeek })}>Review the week that's still running ({wk(reset.planWeek)} –) instead</button>
              {/if}

            {:else if cur === 'wins'}
              <p class="eyebrow">Celebrate</p>
              <h1 id="rs-h">What went well</h1>
              <p class="lead">Tap the ones worth keeping. Add your own — only you know what mattered.</p>
              <ul class="wins">
                {#each reset.wins as w, i (w.id)}
                  {@const on = reset.keptWins.includes(w.id)}
                  <li style="--i:{i}"><button type="button" class:on aria-pressed={on} onclick={() => reset.toggleWin(w.id)}>
                    <span class="tick"><Check size={14} aria-hidden="true" /></span>
                    <span class="wt"><strong>{w.text}</strong>{#if w.detail}<small>{w.detail}</small>{/if}</span>
                  </button></li>
                {/each}
                {#each reset.customWins as c, i (c + i)}
                  <li><button type="button" class="on" onclick={() => (reset.customWins = reset.customWins.filter((_, j) => j !== i))} aria-label="Remove: {c}"><span class="tick"><Check size={14} aria-hidden="true" /></span><span class="wt"><strong>{c}</strong><small>Yours</small></span></button></li>
                {/each}
              </ul>
              {#if !reset.wins.length && !reset.customWins.length}<p class="note">Nothing to count this time — what's one thing you're glad you did?</p>{/if}
              <form class="addrow" onsubmit={(e) => { e.preventDefault(); addCustomWin(); }}>
                <input bind:value={newWin} placeholder="Something you're proud of this week…" maxlength="120" aria-label="Add your own win" />
                <Button size="sm" type="submit" disabled={!newWin.trim()}>{#snippet icon()}<Plus />{/snippet}Add</Button>
              </form>

            {:else if cur === 'unfinished'}
              <p class="eyebrow">Loose ends</p>
              <h1 id="rs-h">{r.unfinished.length ? 'What did not get done?' : 'Nothing left behind'}</h1>
              {#if r.unfinished.length}
                <p class="lead">Decide each one now so it stops nagging. Nothing changes until you finish.</p>
                <div class="bulk">
                  <Button size="sm" onclick={() => reset.carryAll(r.unfinished)}>Carry all to {dow(reset.planWeek)}</Button>
                  <span class="tally">{carried} carried · {moved} moved · {dropped} dropped</span>
                </div>
                <ul class="loose">
                  {#each r.unfinished as t (t.id)}
                    {@const d = reset.decisions[t.id]}
                    <li class:decided={!!d}>
                      <div class="lt"><span class="ttl">{t.title}</span><span class="when">{dueLabel(t)}</span></div>
                      <div class="acts" role="group" aria-label="What to do with {t.title}">
                        <button type="button" class:on={d?.action === 'carry'} onclick={() => reset.decide(t.id, d?.action === 'carry' ? null : { action: 'carry' })}>Carry</button>
                        <button type="button" class:on={d?.action === 'move'} onclick={() => reset.decide(t.id, d?.action === 'move' ? null : { action: 'move', day: reset.planDays[0]! })}>Move</button>
                        <button type="button" class="drop" class:on={d?.action === 'drop'} onclick={() => reset.decide(t.id, d?.action === 'drop' ? null : { action: 'drop' })}>Drop</button>
                      </div>
                      {#if d?.action === 'move'}
                        <div class="days" role="radiogroup" aria-label="Move to">
                          {#each reset.planDays as day (day)}
                            <button type="button" role="radio" aria-checked={moveDay(t) === day} class:on={moveDay(t) === day} onclick={() => reset.decide(t.id, { action: 'move', day })}>{dow(day)}</button>
                          {/each}
                        </div>
                      {/if}
                    </li>
                  {/each}
                </ul>
              {:else}
                <p class="lead">Everything due this week is done. A clean slate for the next one.</p>
                <div class="bigcheck" aria-hidden="true"><Check size={34} /></div>
              {/if}

            {:else if cur === 'goals'}
              <p class="eyebrow">Goals</p>
              <h1 id="rs-h">Where do your goals stand?</h1>
              <p class="lead">Update a number if you've moved since you last logged it.</p>
              <ul class="goals">
                {#each reset.goals as g (g.id)}
                  {@const mv = r.goalMoves.find((m) => m.goalId === g.id)}
                  <li>
                    <div class="gh"><strong>{g.title}</strong><span class="num">{Math.round(goalFraction(g) * 100)}%</span></div>
                    <ProgressBar value={goalFraction(g) * 100} label="{g.title} progress" color="var(--mod-goals)" />
                    <div class="gm">
                      {#if mv}<span class="up"><TrendingUp size={13} aria-hidden="true" />+{mv.toPct - mv.fromPct} pts this week</span>{:else}<span>No change this week</span>{/if}
                      {#if g.target !== null}
                        <label class="upd">Now at
                          <input type="number" inputmode="decimal" step="any" value={reset.goalValues[g.id] ?? g.current} aria-label="Current value for {g.title}"
                            oninput={(e) => { const v = Number((e.currentTarget as HTMLInputElement).value); if (Number.isFinite(v) && v !== g.current) reset.goalValues = { ...reset.goalValues, [g.id]: v }; else { const n = { ...reset.goalValues }; delete n[g.id]; reset.goalValues = n; } }} />
                          <span>/ {g.target} {g.unit}</span>
                        </label>
                      {/if}
                    </div>
                  </li>
                {/each}
              </ul>

            {:else if cur === 'habits'}
              <p class="eyebrow">Habits</p>
              <h1 id="rs-h">How did your habits hold up?</h1>
              <p class="lead">Each dot is a day of last week. Pause one if it isn't serving you right now.</p>
              <ul class="habits">
                {#each reset.habits as h (h.id)}
                  {@const days = reset.habitDays[h.id] ?? []}
                  {@const paused = reset.pauseHabits.includes(h.id)}
                  <li class:paused style="--c:{h.color}">
                    <span class="hn">{h.name}</span>
                    <span class="dots" aria-label="{days.length} of 7 days">
                      {#each reset.reviewDays as d, i (d)}
                        <i class:on={days.includes(d)} style="--k:{i}"></i>
                      {/each}
                    </span>
                    <span class="hc num">{days.length}/7</span>
                    <button type="button" class="pause" class:on={paused} aria-pressed={paused} onclick={() => reset.togglePause(h.id)}>{paused ? 'Will pause' : 'Pause'}</button>
                  </li>
                {/each}
              </ul>

            {:else if cur === 'priorities'}
              <p class="eyebrow">Next week · {planLabel}</p>
              <h1 id="rs-h">What matters most?</h1>
              <p class="lead">Pick up to three. Give each a day if you like.</p>
              {#if reset.priorities.length}
                <ul class="picked">
                  {#each reset.priorities as p, i (p.key)}
                    <li style="--i:{i}" in:scale={{ start: .94, duration: dur(260) }}>
                      <span class="pn">{i + 1}</span><span class="pt">{p.title}</span>
                      <button type="button" class="rm" onclick={() => reset.removePriority(p.key)} aria-label="Remove {p.title}"><X size={14} /></button>
                      <div class="days" role="radiogroup" aria-label="Day for {p.title}">
                        {#each reset.planDays as day (day)}
                          <button type="button" role="radio" aria-checked={p.day === day} class:on={p.day === day} onclick={() => reset.setPriorityDay(p.key, p.day === day ? null : day)}>{dow(day)}</button>
                        {/each}
                      </div>
                    </li>
                  {/each}
                </ul>
              {/if}
              {#if reset.priorities.length < 3}
                {#if reset.suggestions.length}
                  <p class="sub">From your open tasks</p>
                  <div class="chips">
                    {#each reset.suggestions as t (t.id)}
                      <button type="button" onclick={() => reset.addPriority({ title: t.title, taskId: t.id })}><Plus size={13} aria-hidden="true" />{t.title}</button>
                    {/each}
                  </div>
                {/if}
                <form class="addrow" onsubmit={(e) => { e.preventDefault(); addNewPriority(); }}>
                  <input bind:value={newPriority} placeholder="Or type something new…" maxlength="120" aria-label="Add a new priority" />
                  <Button size="sm" type="submit" disabled={!newPriority.trim()}>{#snippet icon()}<Plus />{/snippet}Add</Button>
                </form>
              {/if}
              <div class="focusgoal">
                <label for="fg"><span>Focus time this week</span><strong class="num">{reset.focusGoalHours} h</strong></label>
                <input id="fg" type="range" min="0" max="30" step="1" bind:value={reset.focusGoalHours} />
                <small>Last week you focused for {formatMinutes(r.focusMin)}.</small>
              </div>

            {:else if cur === 'plan'}
              <p class="eyebrow">The shape of it</p>
              <h1 id="rs-h">Your week at a glance</h1>
              <div class="week">
                {#each reset.planDays as day (day)}
                  {@const items = [...(eventsByDay.get(day) ?? []), ...deadlines.filter((d) => d.date === day).map((d) => d.title)]}
                  {@const pri = reset.priorities.filter((p) => p.day === day)}
                  <div class="col" class:has={items.length || pri.length}>
                    <span class="cd">{dow(day)}<small>{formatDateKey(day, { day: 'numeric' })}</small></span>
                    {#each pri as p (p.key)}<span class="pill pr">{p.title}</span>{/each}
                    {#each items as it, k (it + k)}<span class="pill">{it}</span>{/each}
                  </div>
                {/each}
              </div>
              <label class="reflect"><span>One sentence to carry into next week</span>
                <textarea bind:value={reset.reflection} rows="2" maxlength="240" placeholder="e.g. Start the hard thing first."></textarea></label>
              <p class="note">{carried + moved ? `${carried + moved} task${carried + moved === 1 ? '' : 's'} will be rescheduled` : 'No tasks will be rescheduled'}{dropped ? ` · ${dropped} removed` : ''}. Nothing changes until you press <strong>Plan my week</strong>.</p>

            {:else}
              <div class="finale">
                <div class="embers" aria-hidden="true">{#each embers as e, i (i)}<i style="left:{e.x}%;width:{e.s}px;height:{e.s}px;animation-delay:{e.d}ms;animation-duration:{e.t}ms"></i>{/each}</div>
                <span class="seal" aria-hidden="true"><Sparkles size={30} /></span>
                <h1 id="rs-h" class="grad-text">Your week is ready.</h1>
                <p class="lead">{planLabel}</p>
                <div class="sum">
                  <section><h2>Priorities</h2>
                    {#if reset.priorities.length}<ol>{#each reset.priorities as p (p.key)}<li><span>{p.title}</span>{#if p.day}<em>{dow(p.day)}</em>{/if}</li>{/each}</ol>
                    {:else}<p class="muted">None chosen — a flexible week.</p>{/if}
                  </section>
                  <section><h2>Planned focus</h2><p class="big num">{reset.focusGoalHours}<small> hours</small></p>
                    {#if reset.reflection}<blockquote>“{reset.reflection}”</blockquote>{/if}
                  </section>
                  {#if reset.goals.length}<section><h2>Goals in play</h2><ul>{#each reset.goals.slice(0, 3) as g (g.id)}<li><span>{g.title}</span><em class="num">{Math.round(goalFraction(g) * 100)}%</em></li>{/each}</ul></section>{/if}
                  {#if reset.habits.length - reset.pauseHabits.length > 0}<section><h2>Habits to keep</h2><ul>{#each reset.habits.filter((h) => !reset.pauseHabits.includes(h.id)).slice(0, 4) as h (h.id)}<li><span>{h.name}</span></li>{/each}</ul></section>{/if}
                  {#if reset.planEvents.length || deadlines.length}<section class="wide"><h2>Important dates</h2><ul>
                    {#each reset.planEvents.slice(0, 5) as e (e.id)}<li><span>{e.title}</span><em>{dow(e.date as DateKey)} {formatDateKey(e.date as DateKey, { day: 'numeric' })}</em></li>{/each}
                    {#each deadlines as d (d.title)}<li><span>{d.title}</span><em>{dow(d.date)}</em></li>{/each}
                  </ul></section>{/if}
                </div>
              </div>
            {/if}
          </section>
        {/key}
      {/if}
    </main>

    {#if !reset.loading && r}
      <footer class="nav">
        {#if cur === 'done'}
          <span></span><Button variant="primary" size="lg" onclick={() => reset.finishAndClose()}>{#snippet icon()}<Check />{/snippet}Done</Button>
        {:else}
          <Button variant="ghost" onclick={() => reset.back()} disabled={reset.step === 0 || reset.saving}>{#snippet icon()}<ArrowLeft />{/snippet}Back</Button>
          <Button variant="primary" size="lg" loading={reset.saving} onclick={() => (cur === 'plan' ? reset.finish() : reset.next())}>{primaryLabel}{#snippet icon()}<ArrowRight />{/snippet}</Button>
        {/if}
      </footer>
    {/if}
  </div>
</dialog>

<style>
  dialog.reset { padding: 0; border: 0; margin: 0; width: 100vw; max-width: none; height: 100dvh; max-height: none; background: var(--bg); color: var(--text); overflow: hidden; }
  dialog.reset::backdrop { background: var(--bg); }
  .room {
    position: relative; height: 100%; display: grid; grid-template-rows: auto 1fr auto; padding: max(var(--space-4), env(safe-area-inset-top)) var(--space-5) max(var(--space-4), env(safe-area-inset-bottom));
    background:
      radial-gradient(70vmax 60vmax at 90% -10%, var(--aurora-1), transparent 70%),
      radial-gradient(60vmax 60vmax at -5% 105%, var(--aurora-2), transparent 70%),
      radial-gradient(40vmax 40vmax at 45% 50%, var(--aurora-3), transparent 70%), var(--bg);
    animation: enter var(--dur-xslow) var(--ease-glide);
  }
  @keyframes enter { from { opacity: 0; transform: scale(1.015); } }
  .top { width: min(860px, 100%); margin: 0 auto; display: flex; align-items: center; gap: var(--space-4); }
  .rail { flex: 1; display: flex; gap: 6px; list-style: none; margin: 0; padding: 0; }
  .rail li { flex: 1; min-width: 0; }
  .seg { width: 100%; display: grid; gap: 6px; background: none; border: 0; padding: 6px 0; cursor: pointer; text-align: left; min-width: 0; }
  .seg:disabled { cursor: default; }
  .bar { height: 4px; border-radius: 99px; background: var(--ring-track); position: relative; overflow: hidden; }
  .bar::after { content: ''; position: absolute; inset: 0; background: var(--accent-grad); transform: scaleX(0); transform-origin: left; transition: transform var(--dur-xslow) var(--ease-glide); }
  .seg.done .bar::after, .seg.now .bar::after { transform: scaleX(1); }
  .seg.now .bar::after { box-shadow: 0 0 12px var(--accent); }
  .nm { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .seg.now .nm { color: var(--accent-ink); }
  @media (max-width: 640px) { .nm { display: none; } }
  .x { width: 40px; height: 40px; flex: none; display: grid; place-items: center; border-radius: 50%; cursor: pointer; color: var(--text-2); border: 1px solid var(--glass-border); background: var(--glass-bg); -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); }
  .x:hover { color: var(--text); }

  .stage { position: relative; width: min(860px, 100%); margin: 0 auto; display: grid; align-items: center; overflow-y: auto; padding: var(--space-5) 0; scrollbar-width: thin; }
  .step { grid-area: 1 / 1; display: grid; gap: var(--space-4); align-content: start; padding: var(--space-2) var(--space-1); }
  .eyebrow { font-size: var(--text-xs); font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--accent-ink); }
  h1 { font-size: clamp(var(--text-2xl), 5.2vw, var(--text-4xl)); line-height: 1.05; }
  .lead { color: var(--text-2); font-size: var(--text-md); max-width: 54ch; }
  .note { color: var(--text-2); font-size: var(--text-sm); }
  .sub { font-size: var(--text-sm); font-weight: 700; color: var(--text-2); margin-top: var(--space-2); }
  .link { justify-self: start; background: none; border: 0; padding: 0; color: var(--accent-ink); font-weight: 600; font-size: var(--text-sm); cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
  .loading { display: grid; justify-items: center; gap: var(--space-4); color: var(--text-2); }
  .orb { width: 54px; height: 54px; border-radius: 32%; background: conic-gradient(from 210deg, var(--accent), var(--accent-2), var(--accent)); animation: spin 2.4s linear infinite; box-shadow: var(--glow); }
  @keyframes spin { to { transform: rotate(360deg); } }

  .nav { width: min(860px, 100%); margin: 0 auto; display: flex; justify-content: space-between; align-items: center; gap: var(--space-3); padding-top: var(--space-3); }

  /* look back */
  .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(176px, 1fr)); gap: var(--space-3); margin-top: var(--space-2); }
  .tile { display: grid; gap: 4px; padding: var(--space-4); border-radius: var(--radius-xl); background: var(--glass-bg); border: 1px solid var(--glass-border); box-shadow: var(--glass-highlight);
    -webkit-backdrop-filter: blur(var(--glass-blur)); backdrop-filter: blur(var(--glass-blur)); animation: rise var(--dur-slow) var(--ease-glide) both; animation-delay: calc(var(--i) * 80ms + 160ms); }
  @keyframes rise { from { opacity: 0; transform: translateY(12px); } }
  .tl { font-size: var(--text-xs); font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--text-3); }
  .tv { font-family: var(--font-display); font-weight: var(--display-weight); font-size: var(--text-3xl); line-height: 1.05; color: var(--c); }
  .tn { display: inline-flex; align-items: center; gap: 4px; font-size: var(--text-xs); color: var(--text-3); font-weight: 600; }
  .tn.up { color: var(--success); } .tn.down { color: var(--warning); }
  .mini { display: flex; align-items: flex-end; gap: 4px; height: 38px; margin-top: var(--space-2); }
  .mini i { flex: 1; border-radius: 3px; background: var(--c); transform-origin: bottom; animation: grow 700ms var(--ease-glide) both; }
  @keyframes grow { from { transform: scaleY(0); } }

  /* wins */
  .wins { list-style: none; margin: var(--space-2) 0 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--space-2); }
  .wins li { animation: rise var(--dur-slow) var(--ease-glide) both; animation-delay: calc(var(--i, 0) * 60ms + 100ms); }
  .wins button { width: 100%; display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3) var(--space-4); text-align: left; border-radius: var(--radius-lg); cursor: pointer; color: var(--text);
    background: var(--glass-bg); border: 1px solid var(--glass-border); transition: border-color var(--dur) var(--ease-out), background-color var(--dur) var(--ease-out), transform var(--dur-fast) var(--ease-out); }
  .wins button:active { transform: scale(.98); }
  .wins button.on { border-color: color-mix(in srgb, var(--success) 55%, transparent); background: color-mix(in srgb, var(--success) 10%, var(--glass-bg)); }
  .tick { width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; flex: none; border: 2px solid var(--border-strong); color: transparent; transition: all var(--dur) var(--ease-emphasis); }
  button.on .tick { background: var(--success); border-color: var(--success); color: var(--on-accent); transform: scale(1.08); }
  .wt { display: grid; gap: 1px; min-width: 0; } .wt strong { font-weight: 650; line-height: 1.3; } .wt small { color: var(--text-3); font-size: var(--text-xs); }
  .addrow { display: flex; gap: var(--space-2); align-items: center; }
  .addrow input { flex: 1; min-width: 0; height: 44px; padding: 0 var(--space-4); border-radius: var(--radius-md); border: 1px solid var(--border-strong); background: color-mix(in srgb, var(--surface) 70%, transparent); color: var(--text); }
  .addrow input:focus, textarea:focus { border-color: var(--accent); box-shadow: var(--focus); outline: none; }

  /* loose ends */
  .bulk { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; }
  .tally { font-size: var(--text-sm); color: var(--text-3); }
  .loose { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-2); max-height: 44dvh; overflow-y: auto; }
  .loose li { display: grid; gap: var(--space-2); padding: var(--space-3) var(--space-4); border-radius: var(--radius-lg); background: var(--glass-bg); border: 1px solid var(--glass-border); transition: border-color var(--dur) var(--ease-out), opacity var(--dur) var(--ease-out); }
  .loose li.decided { border-color: color-mix(in srgb, var(--accent) 35%, transparent); }
  .lt { display: flex; justify-content: space-between; gap: var(--space-3); align-items: baseline; }
  .ttl { font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .when { font-size: var(--text-xs); color: var(--text-3); white-space: nowrap; }
  .acts, .days { display: flex; gap: 6px; flex-wrap: wrap; }
  .acts button, .days button, .chips button, .pause { height: 34px; padding: 0 var(--space-3); border-radius: 999px; cursor: pointer; font-weight: 650; font-size: var(--text-sm); color: var(--text-2);
    border: 1px solid var(--border-strong); background: color-mix(in srgb, var(--surface) 60%, transparent); transition: all var(--dur) var(--ease-out); }
  .acts button.on, .days button.on, .pause.on { color: var(--on-accent); background: var(--accent); border-color: var(--accent); }
  :global(:is([data-theme='soft'], [data-theme='light'])) .acts button.on, :global(:is([data-theme='soft'], [data-theme='light'])) .days button.on, :global(:is([data-theme='soft'], [data-theme='light'])) .pause.on { color: #fff; }
  .acts button.drop.on { background: var(--danger); border-color: var(--danger); color: #fff; }
  .bigcheck { width: 76px; height: 76px; border-radius: 50%; display: grid; place-items: center; color: var(--on-accent); background: var(--accent-grad); box-shadow: var(--glow); animation: pop-in 560ms var(--ease-emphasis); }
  @keyframes pop-in { from { transform: scale(.4); opacity: 0; } }

  /* goals */
  .goals, .habits { list-style: none; margin: var(--space-2) 0 0; padding: 0; display: grid; gap: var(--space-3); }
  .goals li { display: grid; gap: 8px; padding: var(--space-4); border-radius: var(--radius-lg); background: var(--glass-bg); border: 1px solid var(--glass-border); }
  .gh { display: flex; justify-content: space-between; gap: var(--space-3); } .gm { display: flex; justify-content: space-between; align-items: center; gap: var(--space-3); flex-wrap: wrap; font-size: var(--text-sm); color: var(--text-3); }
  .up { color: var(--success); display: inline-flex; align-items: center; gap: 4px; font-weight: 600; }
  .upd { display: inline-flex; align-items: center; gap: 8px; color: var(--text-2); }
  .upd input { width: 84px; height: 34px; border-radius: var(--radius-sm); border: 1px solid var(--border-strong); background: color-mix(in srgb, var(--surface) 70%, transparent); color: var(--text); text-align: center; font-weight: 700; }

  /* habits */
  .habits li { display: grid; grid-template-columns: minmax(0, 1fr) auto auto auto; align-items: center; gap: var(--space-3); padding: var(--space-3) var(--space-4); border-radius: var(--radius-lg); background: var(--glass-bg); border: 1px solid var(--glass-border); }
  .habits li.paused { opacity: .6; }
  .hn { font-weight: 650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dots { display: flex; gap: 5px; } .dots i { width: 12px; height: 12px; border-radius: 50%; background: var(--ring-track); }
  .dots i.on { background: var(--c); box-shadow: 0 0 9px color-mix(in srgb, var(--c) 60%, transparent); animation: pop-in 400ms var(--ease-emphasis) both; animation-delay: calc(var(--k) * 50ms); }
  .hc { color: var(--text-3); font-size: var(--text-sm); font-weight: 600; }
  @media (max-width: 560px) { .habits li { grid-template-columns: 1fr auto; } .dots { grid-column: 1; } .hc { display: none; } }

  /* priorities */
  .picked { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-2); }
  .picked li { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: var(--space-2) var(--space-3); padding: var(--space-3) var(--space-4); border-radius: var(--radius-lg); background: var(--glass-bg); border: 1px solid color-mix(in srgb, var(--accent) 38%, transparent); }
  .pn { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; font-weight: 800; font-size: var(--text-sm); color: var(--on-accent); background: var(--accent-grad); }
  :global(:is([data-theme='soft'], [data-theme='light'])) .pn { color: #fff; }
  .pt { font-weight: 650; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rm { width: 30px; height: 30px; border-radius: 50%; border: 0; background: none; color: var(--text-3); cursor: pointer; display: grid; place-items: center; } .rm:hover { color: var(--danger); }
  .picked .days { grid-column: 1 / -1; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; } .chips button { display: inline-flex; align-items: center; gap: 4px; height: 36px; max-width: 100%; } .chips button:hover { border-color: var(--accent); color: var(--text); }
  .focusgoal { display: grid; gap: 6px; padding: var(--space-4); border-radius: var(--radius-lg); background: var(--glass-bg); border: 1px solid var(--glass-border); margin-top: var(--space-2); }
  .focusgoal label { display: flex; justify-content: space-between; font-weight: 650; } .focusgoal strong { color: var(--mod-focus); font-family: var(--font-display); }
  .focusgoal input[type='range'] { width: 100%; accent-color: var(--mod-focus); } .focusgoal small { color: var(--text-3); }

  /* plan */
  .week { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; }
  .col { display: grid; align-content: start; gap: 4px; min-height: 150px; padding: var(--space-2); border-radius: var(--radius-md); background: var(--glass-bg); border: 1px solid var(--glass-border); }
  .col.has { border-color: color-mix(in srgb, var(--accent) 30%, transparent); }
  .cd { display: flex; align-items: baseline; justify-content: space-between; font-size: var(--text-xs); font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--text-2); } .cd small { font-size: var(--text-sm); color: var(--text-3); }
  .pill { font-size: 11px; line-height: 1.25; padding: 4px 6px; border-radius: 7px; background: color-mix(in srgb, var(--mod-calendar) 16%, transparent); color: var(--text); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; line-clamp: 3; -webkit-box-orient: vertical; }
  .pill.pr { background: var(--accent-grad); color: var(--on-accent); font-weight: 700; } :global(:is([data-theme='soft'], [data-theme='light'])) .pill.pr { color: #fff; }
  @media (max-width: 720px) { .week { grid-template-columns: 1fr; } .col { min-height: 0; grid-auto-flow: row; } }
  .reflect { display: grid; gap: 6px; font-size: var(--text-sm); font-weight: 650; color: var(--text-2); }
  textarea { padding: var(--space-3) var(--space-4); border-radius: var(--radius-md); border: 1px solid var(--border-strong); background: color-mix(in srgb, var(--surface) 70%, transparent); color: var(--text); resize: none; font-size: var(--text-base); }

  /* finale */
  .finale { position: relative; display: grid; justify-items: center; gap: var(--space-3); text-align: center; padding-top: var(--space-4); }
  .seal { width: 68px; height: 68px; border-radius: 50%; display: grid; place-items: center; color: var(--on-accent); background: var(--accent-grad); box-shadow: 0 0 40px color-mix(in srgb, var(--accent) 55%, transparent); animation: pop-in 700ms var(--ease-emphasis) both, bob 5s var(--ease-in-out) 700ms infinite; }
  :global(:is([data-theme='soft'], [data-theme='light'])) .seal { color: #fff; }
  @keyframes bob { 50% { transform: translateY(-5px); } }
  .finale h1 { font-size: clamp(2.2rem, 7vw, 4rem); }
  .embers { position: absolute; inset: -20% 0 0; pointer-events: none; overflow: hidden; }
  .embers i { position: absolute; bottom: 0; border-radius: 50%; background: var(--accent); box-shadow: 0 0 10px var(--accent); opacity: 0; animation: ember linear both; }
  .embers i:nth-child(3n) { background: var(--accent-2); box-shadow: 0 0 10px var(--accent-2); } .embers i:nth-child(4n) { background: var(--warning); box-shadow: 0 0 10px var(--warning); }
  @keyframes ember { 0% { transform: translateY(0) scale(.6); opacity: 0; } 15% { opacity: .9; } 100% { transform: translateY(-82vh) scale(1.1); opacity: 0; } }
  .sum { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--space-3); width: 100%; text-align: left; margin-top: var(--space-3); }
  .sum section { padding: var(--space-4); border-radius: var(--radius-xl); background: var(--glass-bg); border: 1px solid var(--glass-border); box-shadow: var(--glass-highlight); -webkit-backdrop-filter: blur(var(--glass-blur)); backdrop-filter: blur(var(--glass-blur)); }
  .sum .wide { grid-column: 1 / -1; }
  .sum h2 { font-family: var(--font-body); font-size: var(--text-xs); letter-spacing: .12em; text-transform: uppercase; color: var(--text-3); margin-bottom: var(--space-2); font-weight: 700; }
  .sum ol, .sum ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; } .sum li { display: flex; justify-content: space-between; gap: var(--space-3); font-weight: 600; }
  .sum li em { font-style: normal; color: var(--text-3); font-weight: 600; font-size: var(--text-sm); white-space: nowrap; }
  .big { font-family: var(--font-display); font-size: var(--text-3xl); line-height: 1; color: var(--mod-focus); } .big small { font-size: var(--text-md); color: var(--text-2); }
  blockquote { margin: var(--space-3) 0 0; font-style: italic; color: var(--text-2); }
</style>
