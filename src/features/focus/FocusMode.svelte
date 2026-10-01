<script lang="ts">
  // Focus Mode: pick a task (or just a label), choose a length, and get a calm full-screen room with a
  // single glowing ring. Ending the session records the time automatically. Minimising (Esc) keeps the
  // session running — a small pill in the app shows it and brings you back.
  import { tick } from 'svelte';
  import { Play, Pause, Square, Check, Minimize, Sparkles } from '../../lib/navicons';
  import Button from '../../lib/ui/Button.svelte';
  import { focus } from '../../lib/focus.svelte';
  import { listTasks, sortTasks } from '../../lib/domain/tasks';
  import { sessionsForTask, sumMinutes, formatMinutes } from '../../lib/domain/focus';
  import { changes } from '../../lib/db/changes.svelte';
  import { clock } from '../../lib/clock.svelte';
  import { formatDateKey, type DateKey } from '../../lib/util/dates';
  import type { Task } from '../../lib/db/schema';

  let dlg: HTMLDialogElement | undefined = $state();
  let tasks = $state<Task[]>([]);
  let spent = $state<Record<string, number>>({});
  let pickedId = $state<string | null>(null);
  let label = $state('');
  let minutes = $state(25);
  let custom = $state('');
  const PRESETS = [15, 25, 45, 60, 90];

  $effect(() => {
    if (!dlg) return;
    if (focus.open && !dlg.open) dlg.showModal();
    else if (!focus.open && dlg.open) dlg.close();
  });

  // candidates: open tasks, most urgent first
  $effect(() => {
    void changes.version;
    if (!focus.open || focus.active) return;
    void listTasks().then(async (all) => {
      const day = clock.today;
      const open = all.filter((t) => !t.done && (t.dueDate === null || t.dueDate <= day || t.priority === 'high')).sort(sortTasks).slice(0, 7);
      tasks = open;
      const entries = await Promise.all(open.map(async (t) => [t.id, sumMinutes(await sessionsForTask(t.id))] as const));
      spent = Object.fromEntries(entries);
    });
  });

  // arriving with a task chosen elsewhere ("focus on this")
  $effect(() => {
    if (focus.open && !focus.active && focus.preselect) {
      pickedId = focus.preselect.id;
      label = '';
    }
  });
  $effect(() => { if (!focus.open) { focus.preselect = null; } });

  const picked = $derived(tasks.find((t) => t.id === pickedId) ?? (focus.preselect && focus.preselect.id === pickedId ? { id: focus.preselect.id, title: focus.preselect.title, projectId: focus.preselect.projectId } as Task : null));
  const canStart = $derived(!!picked || label.trim().length > 0);

  function pick(id: string) { pickedId = pickedId === id ? null : id; if (pickedId) label = ''; }
  function setMin(m: number) { minutes = m; custom = ''; }
  function onCustom() {
    const n = Math.round(Number(custom));
    if (Number.isFinite(n) && n >= 1 && n <= 300) minutes = n;
  }
  async function begin() {
    if (!canStart) return;
    await focus.start({ label: picked ? picked.title : label, plannedMin: minutes, taskId: picked?.id ?? null, projectId: (picked as Task | null)?.projectId ?? null });
    pickedId = null; label = '';
    await tick();
  }

  const due = (t: Task): string | null => {
    if (!t.dueDate) return null;
    if (t.dueDate < clock.today) return 'Overdue';
    if (t.dueDate === clock.today) return 'Today';
    return formatDateKey(t.dueDate as DateKey, { month: 'short', day: 'numeric' });
  };

  // ring geometry
  const R = 148, C = 2 * Math.PI * R;
  const ang = $derived(focus.progress * 2 * Math.PI - Math.PI / 2);
  const dotX = $derived(170 + R * Math.cos(ang));
  const dotY = $derived(170 + R * Math.sin(ang));
</script>

<dialog bind:this={dlg} class="focus" aria-label="Focus mode" oncancel={(e) => { e.preventDefault(); focus.hide(); }}>
  <div class="room" class:live={focus.running} class:paused={!!focus.active?.pausedAt} class:reached={focus.reached}>
    <header>
      <span class="tag"><Sparkles size={15} aria-hidden="true" />Focus</span>
      <button type="button" class="min" onclick={() => focus.hide()} aria-label={focus.active ? 'Minimise — keeps the session running' : 'Close'}>
        <Minimize size={18} aria-hidden="true" /><span>{focus.active ? 'Minimise' : 'Close'}</span>
      </button>
    </header>

    {#if !focus.active}
      <section class="picker glass-strong" aria-labelledby="fp-h">
        <h2 id="fp-h">What are you focusing on?</h2>
        <div class="tasks" role="radiogroup" aria-label="Pick a task">
          {#each tasks as t (t.id)}
            <button type="button" role="radio" aria-checked={pickedId === t.id} class="task" class:on={pickedId === t.id} onclick={() => pick(t.id)}>
              <span class="dot" aria-hidden="true"></span>
              <span class="tt">{t.title}</span>
              {#if spent[t.id]}<span class="meta">{formatMinutes(spent[t.id]!)} so far</span>{/if}
              {#if due(t)}<span class="due" class:late={due(t) === 'Overdue'}>{due(t)}</span>{/if}
            </button>
          {/each}
          {#if picked && !tasks.some((t) => t.id === picked.id)}
            <button type="button" role="radio" aria-checked="true" class="task on"><span class="dot" aria-hidden="true"></span><span class="tt">{picked.title}</span></button>
          {/if}
        </div>
        <label class="free">
          <span>{tasks.length ? 'Or just focus on…' : 'What are you working on?'}</span>
          <input bind:value={label} placeholder="Deep work, reading, study…" maxlength="80" oninput={() => { if (label) pickedId = null; }} />
        </label>
        <div class="durs" role="radiogroup" aria-label="Session length">
          {#each PRESETS as m (m)}
            <button type="button" role="radio" aria-checked={minutes === m && !custom} class:on={minutes === m && !custom} onclick={() => setMin(m)}>{m}<small>min</small></button>
          {/each}
          <label class="cust" class:on={!!custom}>
            <input type="number" inputmode="numeric" min="1" max="300" placeholder="…" bind:value={custom} oninput={onCustom} aria-label="Custom minutes" /><small>min</small>
          </label>
        </div>
        <Button variant="primary" size="lg" full disabled={!canStart} onclick={begin}>{#snippet icon()}<Play />{/snippet}Start {minutes}-minute focus</Button>
      </section>
    {:else}
      <section class="stage" aria-label="Focus session">
        <p class="what" title={focus.active.label}>{focus.active.label}</p>
        <div class="ringwrap">
          <div class="aura" aria-hidden="true"></div>
          <svg viewBox="0 0 340 340" class="ring" aria-hidden="true">
            <defs>
              <linearGradient id="fgrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" style="stop-color:var(--accent)" /><stop offset="100%" style="stop-color:var(--accent-2)" />
              </linearGradient>
            </defs>
            {#each Array.from({ length: 60 }) as _, i (i)}
              {@const a = (i / 60) * 2 * Math.PI}
              <line x1={170 + 160 * Math.cos(a)} y1={170 + 160 * Math.sin(a)} x2={170 + (i % 5 === 0 ? 168 : 164) * Math.cos(a)} y2={170 + (i % 5 === 0 ? 168 : 164) * Math.sin(a)} class="tick" class:major={i % 5 === 0} />
            {/each}
            <circle cx="170" cy="170" r={R} class="track" />
            <circle cx="170" cy="170" r={R} class="arc" stroke-dasharray={C} stroke-dashoffset={C * (1 - focus.progress)} transform="rotate(-90 170 170)" />
            <circle cx={dotX} cy={dotY} r="8" class="dotp" />
          </svg>
          <div class="center" role="timer" aria-label="Time remaining">
            {#if focus.reached}
              <span class="done"><Check size={44} aria-hidden="true" /></span>
              <span class="cap">{Math.round(focus.targetMin)} minutes done</span>
            {:else}
              <span class="time num">{focus.clock}</span>
              <span class="cap">{focus.active.pausedAt ? 'Paused' : 'remaining'}</span>
            {/if}
          </div>
        </div>
        <div class="live-region sr-only" aria-live="polite">{focus.reached ? 'Focus session complete.' : ''}</div>

        <div class="controls">
          {#if focus.reached}
            <Button variant="primary" size="lg" onclick={() => focus.finish()}>{#snippet icon()}<Check />{/snippet}Log session</Button>
            {#if focus.active.taskId}<Button size="lg" onclick={() => focus.finish({ completeTask: true })}>Log & complete task</Button>{/if}
            <Button variant="ghost" size="lg" onclick={() => focus.extend(5)}>+5 min</Button>
          {:else}
            <button type="button" class="round big" onclick={() => (focus.active?.pausedAt ? focus.resume() : focus.pause())} aria-label={focus.active.pausedAt ? 'Resume' : 'Pause'}>
              {#if focus.active.pausedAt}<Play size={28} />{:else}<Pause size={28} />{/if}
            </button>
            <button type="button" class="round" onclick={() => focus.finish()} aria-label="Stop and log this session"><Square size={20} /></button>
            {#if focus.active.taskId}
              <button type="button" class="pillbtn" onclick={() => focus.finish({ completeTask: true })}><Check size={17} aria-hidden="true" />Complete task</button>
            {/if}
          {/if}
        </div>
        <button type="button" class="discard" onclick={() => focus.discard()}>Discard session</button>
      </section>
    {/if}
  </div>
</dialog>

<style>
  dialog.focus { padding: 0; border: 0; margin: 0; width: 100vw; max-width: none; height: 100dvh; max-height: none; background: var(--bg); color: var(--text); overflow: hidden; }
  dialog.focus::backdrop { background: var(--bg); }
  .room {
    position: relative; height: 100%; display: grid; grid-template-rows: auto 1fr; justify-items: center; padding: max(var(--space-4), env(safe-area-inset-top)) var(--space-5) max(var(--space-5), env(safe-area-inset-bottom));
    background:
      radial-gradient(70vmax 60vmax at 80% -10%, var(--aurora-1), transparent 70%),
      radial-gradient(60vmax 60vmax at 0% 105%, var(--aurora-2), transparent 70%),
      radial-gradient(40vmax 40vmax at 55% 55%, var(--aurora-3), transparent 70%), var(--bg);
    animation: enter var(--dur-xslow) var(--ease-glide);
  }
  @keyframes enter { from { opacity: 0; transform: scale(1.02); } }
  header { width: 100%; max-width: 980px; display: flex; align-items: center; justify-content: space-between; }
  .tag { display: inline-flex; align-items: center; gap: 8px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; font-size: var(--text-xs); color: var(--accent-ink); }
  .min {
    display: inline-flex; align-items: center; gap: 8px; height: 40px; padding: 0 var(--space-4); border-radius: 999px; cursor: pointer;
    border: 1px solid var(--glass-border); background: var(--glass-bg); color: var(--text-2); font-weight: 600; font-size: var(--text-sm);
    -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px);
  }
  .min:hover { color: var(--text); }

  /* ---- picker ---- */
  .picker { align-self: center; width: min(560px, 100%); border-radius: var(--radius-2xl); padding: var(--space-6); display: grid; gap: var(--space-5); animation: rise var(--dur-xslow) var(--ease-glide) both; }
  h2 { font-size: var(--text-xl); }
  .tasks { display: grid; gap: 6px; max-height: 34dvh; overflow: auto; margin: 0 calc(-1 * var(--space-2)); padding: 2px var(--space-2); }
  .task { display: flex; align-items: center; gap: var(--space-3); min-height: 48px; padding: 0 var(--space-3); border-radius: var(--radius-md); cursor: pointer; text-align: left;
    background: color-mix(in srgb, var(--text) 4%, transparent); border: 1px solid transparent; color: var(--text); transition: background-color var(--dur) var(--ease-out), border-color var(--dur) var(--ease-out); }
  .task:hover { background: color-mix(in srgb, var(--text) 7%, transparent); }
  .task.on { background: color-mix(in srgb, var(--accent) 13%, transparent); border-color: color-mix(in srgb, var(--accent) 45%, transparent); }
  .dot { width: 18px; height: 18px; border-radius: 50%; border: 2px solid var(--border-strong); flex: none; display: grid; place-items: center; transition: border-color var(--dur) var(--ease-out), background-color var(--dur) var(--ease-out); }
  .task.on .dot { border-color: var(--accent); background: var(--accent); box-shadow: inset 0 0 0 3px var(--bg); }
  .tt { flex: 1; min-width: 0; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .meta { font-size: var(--text-xs); color: var(--text-3); white-space: nowrap; }
  .due { font-size: var(--text-xs); font-weight: 700; padding: 2px 8px; border-radius: 99px; background: var(--surface-3); color: var(--text-2); }
  .due.late { background: var(--danger-soft); color: var(--danger); }
  .free { display: grid; gap: 6px; font-size: var(--text-sm); font-weight: 600; color: var(--text-2); }
  .free input { height: 46px; padding: 0 var(--space-4); border-radius: var(--radius-md); border: 1px solid var(--border-strong); background: color-mix(in srgb, var(--surface) 70%, transparent); color: var(--text); font-size: var(--text-base); }
  .free input:focus { border-color: var(--accent); box-shadow: var(--focus); outline: none; }
  .durs { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; }
  .durs button, .cust { height: 54px; border-radius: var(--radius-md); border: 1px solid var(--border-strong); background: color-mix(in srgb, var(--surface) 55%, transparent); color: var(--text); font-weight: 700; font-size: var(--text-md);
    display: grid; place-content: center; justify-items: center; line-height: 1.05; cursor: pointer; transition: background-color var(--dur) var(--ease-out), border-color var(--dur) var(--ease-out); }
  .durs button.on, .cust.on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 16%, transparent); }
  small { font-size: 10px; font-weight: 600; color: var(--text-3); letter-spacing: .04em; text-transform: uppercase; }
  .cust { cursor: text; }
  .cust input { width: 100%; border: 0; background: none; text-align: center; font: inherit; color: inherit; outline: none; padding: 0; -moz-appearance: textfield; appearance: textfield; }
  .cust input::-webkit-outer-spin-button, .cust input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }

  /* ---- running ---- */
  .stage { align-self: center; display: grid; justify-items: center; gap: var(--space-5); width: 100%; animation: rise var(--dur-xslow) var(--ease-glide) both; }
  @keyframes rise { from { opacity: 0; transform: translateY(14px); } }
  .what { font-family: var(--font-display); font-weight: var(--display-weight); font-size: clamp(var(--text-lg), 3.4vw, var(--text-2xl)); text-align: center; max-width: 24ch; line-height: 1.2; text-wrap: balance;
    overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; }
  .ringwrap { position: relative; width: min(78vw, 46dvh, 360px); aspect-ratio: 1; display: grid; place-items: center; }
  .aura { position: absolute; inset: -14%; border-radius: 50%; background: radial-gradient(closest-side, color-mix(in srgb, var(--accent) 34%, transparent), transparent); filter: blur(10px); opacity: .55; }
  .live .aura { animation: breathe 7s var(--ease-in-out) infinite; }
  @keyframes breathe { 0%, 100% { transform: scale(.9); opacity: .42; } 50% { transform: scale(1.06); opacity: .8; } }
  .ring { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
  .tick { stroke: var(--text-3); stroke-width: 1.2; opacity: .35; stroke-linecap: round; }
  .tick.major { stroke-width: 2; opacity: .6; }
  .track { fill: none; stroke: var(--ring-track); stroke-width: 10; }
  .arc { fill: none; stroke: url(#fgrad); stroke-width: 10; stroke-linecap: round; filter: drop-shadow(0 0 10px color-mix(in srgb, var(--accent) 65%, transparent)); transition: stroke-dashoffset 300ms linear; }
  .dotp { fill: #fff; filter: drop-shadow(0 0 8px var(--accent)); }
  .paused .arc, .paused .dotp { opacity: .55; }
  .center { position: relative; display: grid; justify-items: center; gap: 4px; text-align: center; }
  .time { font-family: var(--font-display); font-weight: 500; font-size: clamp(3.2rem, 12vw, 5.2rem); letter-spacing: -0.03em; line-height: 1; }
  .paused .time { opacity: .6; animation: blink 1.6s steps(2) infinite; }
  @keyframes blink { 50% { opacity: .25; } }
  .cap { font-size: var(--text-sm); font-weight: 600; letter-spacing: .1em; text-transform: uppercase; color: var(--text-3); }
  .done { width: 76px; height: 76px; display: grid; place-items: center; border-radius: 50%; color: var(--on-accent); background: var(--accent-grad); box-shadow: var(--glow); animation: pop-in 520ms var(--ease-emphasis); }
  @keyframes pop-in { from { transform: scale(.4); opacity: 0; } }
  .controls { display: flex; align-items: center; justify-content: center; gap: var(--space-3); flex-wrap: wrap; }
  .round { width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center; cursor: pointer; color: var(--text); border: 1px solid var(--glass-border); background: var(--glass-bg);
    -webkit-backdrop-filter: blur(16px); backdrop-filter: blur(16px); box-shadow: var(--glass-highlight); transition: transform var(--dur-fast) var(--ease-out), border-color var(--dur) var(--ease-out); }
  .round:hover { border-color: var(--accent); }
  .round:active { transform: scale(.92); }
  .round.big { width: 76px; height: 76px; background: var(--accent-grad); color: var(--on-accent); border-color: transparent; box-shadow: var(--shadow-2), var(--glow); }
  :global([data-theme='soft']) .round.big { color: #fff; }
  .pillbtn { height: 48px; padding: 0 var(--space-5); border-radius: 999px; display: inline-flex; align-items: center; gap: 8px; cursor: pointer; font-weight: 700; color: var(--text); border: 1px solid var(--glass-border); background: var(--glass-bg);
    -webkit-backdrop-filter: blur(16px); backdrop-filter: blur(16px); }
  .pillbtn:hover { border-color: var(--success); color: var(--success); }
  .discard { background: none; border: 0; color: var(--text-3); font-size: var(--text-sm); cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
  .discard:hover { color: var(--danger); }
  @media (max-width: 480px) { .durs { grid-template-columns: repeat(3, 1fr); } }
</style>
