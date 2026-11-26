<script lang="ts">
  // New looks: a short "Get started" checklist for a brand-new workspace. Every step ticks itself
  // from your real records (nothing to click to "mark done"), and the whole card goes away when all
  // steps are done, or when you dismiss it (remembered on this device).
  import { Check, ArrowRight, X } from '@lucide/svelte';
  import { app } from '../../lib/app.svelte';
  import { changes } from '../../lib/db/changes.svelte';
  import { count } from '../../lib/db/idb';
  import { router } from '../../lib/router.svelte';
  import { focus } from '../../lib/focus.svelte';
  import { openQuick } from '../quick/quick.svelte';
  import { lastBackupAt } from '../settings/backupActions';
  import { spotlight } from '../../lib/ui/spotlight';

  const KEY = 'lifeos.getstarted.dismissed';
  let gone = $state(read());
  function read() { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } }
  function dismiss() { gone = true; try { localStorage.setItem(KEY, '1'); } catch { /* private mode: hidden for this visit only */ } }

  let done = $state<Record<string, boolean>>({});
  let ready = $state(false);
  $effect(() => {
    void changes.version;
    if (gone) return;
    void Promise.all([count('tasks'), count('habit_logs'), count('focus_sessions'), count('notes'), lastBackupAt()]).then(([tasks, logs, sessions, notes, backup]) => {
      done = { task: tasks > 0, habit: logs > 0, focus: sessions > 0, note: notes > 0, remind: !!app.settings?.notify?.enabled, backup: !!backup };
      ready = true;
    });
  });

  const on = (m: string) => app.workspace?.enabledModules.includes(m as never);
  const steps = $derived([
    { id: 'task', label: 'Add your first task', hint: 'Try typing “Call mom tomorrow 6pm” in the bar above.', go: () => openQuick('task'), show: on('tasks') },
    { id: 'habit', label: 'Check in on a habit', hint: 'Add one small habit, then tick it today.', go: () => router.go({ name: 'module', module: 'habits' }), show: on('habits') },
    { id: 'focus', label: 'Run a focus session', hint: '25 quiet minutes. It is logged for you.', go: () => focus.openFor(), show: true },
    { id: 'note', label: 'Write a note or journal entry', hint: 'One line is enough.', go: () => openQuick('note'), show: on('notes') },
    { id: 'remind', label: 'Turn on reminders', hint: 'Choose what Life OS nudges you about.', go: () => router.go({ name: 'settings' }), show: true },
    { id: 'backup', label: 'Make your first backup', hint: 'Your data lives on this device — keep a copy.', go: () => router.go({ name: 'settings' }), show: true },
  ].filter((s) => s.show));
  const doneN = $derived(steps.filter((s) => done[s.id]).length);
  const visible = $derived(!gone && ready && doneN < steps.length);
</script>

{#if visible}
  <section class="gs gcard" style="--c:var(--accent)" use:spotlight aria-labelledby="gs-h">
    <header>
      <div><h2 id="gs-h">Get started</h2><p class="meta">{doneN} of {steps.length} done · the list ticks itself off</p></div>
      <button type="button" class="x" onclick={dismiss} aria-label="Hide the Get started list"><X size={16} aria-hidden="true" /></button>
    </header>
    <div class="bar" role="progressbar" aria-label="Getting started" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={doneN}><i style="width:{(doneN / steps.length) * 100}%"></i></div>
    <ul>
      {#each steps as s (s.id)}
        <li class:on={done[s.id]}>
          <span class="tick" aria-hidden="true">{#if done[s.id]}<Check size={13} strokeWidth={3} />{/if}</span>
          <span class="t"><b>{s.label}</b><span>{s.hint}</span></span>
          {#if !done[s.id]}<button type="button" class="go" onclick={s.go}>Start<ArrowRight size={13} aria-hidden="true" /></button>{:else}<span class="ok">Done</span>{/if}
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .gs { padding: var(--space-5); margin-top: var(--space-5); }
  header { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-3); }
  h2 { font-size: var(--text-lg); }
  .meta { margin-top: 2px; }
  .x { width: 32px; height: 32px; display: grid; place-items: center; border-radius: 50%; border: 0; background: none; color: var(--text-3); cursor: pointer; }
  .x:hover { background: var(--surface-2); color: var(--text); }
  .bar { height: 5px; margin: var(--space-3) 0 var(--space-2); border-radius: 99px; background: var(--ring-track); overflow: hidden; }
  .bar i { display: block; height: 100%; background: var(--accent); border-radius: inherit; transition: width .6s var(--ease-glide); }
  ul { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 330px), 1fr)); column-gap: var(--space-6); }
  li { display: flex; align-items: center; gap: var(--space-3); padding: 10px 0; border-bottom: 1px solid var(--border); min-width: 0; }
  .tick { width: 20px; height: 20px; border-radius: 50%; flex: none; display: grid; place-items: center; border: 1.5px solid var(--border-strong); color: var(--on-accent); }
  li.on .tick { background: var(--accent); border-color: var(--accent); }
  .t { display: grid; gap: 1px; min-width: 0; flex: 1; }
  .t b { font-weight: 600; font-size: var(--text-sm); }
  .t span { font-size: var(--text-xs); color: var(--text-2); }
  li.on .t b { color: var(--text-2); text-decoration: line-through; text-decoration-color: color-mix(in srgb, var(--text) 30%, transparent); }
  .go { display: inline-flex; align-items: center; gap: 3px; height: 30px; padding: 0 12px; flex: none; border-radius: 999px; border: 0; cursor: pointer; font-size: var(--text-xs); font-weight: 700; color: var(--accent-ink); background: var(--accent-soft); }
  .go:hover { filter: brightness(1.08); }
  .ok { font-size: var(--text-xs); font-weight: 650; color: var(--success); flex: none; }

  :global(:root[data-style='almanac']) .gs { background: none; border: 0; border-top: 2px solid var(--text); border-radius: 0; padding: var(--space-3) 0 0; margin-top: var(--space-7); }
  :global(:root[data-style='almanac']) h2 { font-size: 23px; font-weight: 400; }
  :global(:root[data-style='almanac']) .bar { border-radius: 0; height: 3px; }
  :global(:root[data-style='almanac']) .bar i { border-radius: 0; }
  :global(:root[data-style='almanac']) .tick { border-radius: 2px; border-color: var(--text); }
  :global(:root[data-style='almanac']) li.on .tick { background: var(--text); border-color: var(--text); color: var(--bg); }
  :global(:root[data-style='almanac']) .go { border-radius: 0; background: none; border-bottom: 1px solid currentColor; padding: 0 0 1px; height: auto; color: var(--text); }
  :global(:root[data-style='nebula']) .bar i { background: var(--accent-grad); box-shadow: 0 0 10px rgba(183, 140, 255, .6); }
  :global(:root[data-style='nebula']) li.on .tick { background: var(--accent-grad); border-color: transparent; }
</style>
