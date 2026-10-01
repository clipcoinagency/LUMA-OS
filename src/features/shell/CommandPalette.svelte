<script lang="ts">
  // "Jump to anything": pages, quick actions and live search across your own tasks, goals, habits and
  // notes. Keyboard first (Ctrl/Cmd+K, arrows, Enter, Esc) but fully tappable. Glass overlay.
  import { tick } from 'svelte';
  import type { Component } from 'svelte';
  import { Search, Home as HomeIcon, Settings as SettingsIcon, Palette, CornerDownLeft } from './paletteIcons';
  import { palette } from '../../lib/palette.svelte';
  import { reset } from '../../lib/reset.svelte';
  import { app } from '../../lib/app.svelte';
  import { router } from '../../lib/router.svelte';
  import { navGroups } from '../../lib/nav';
  import { QUICK_ACTIONS } from '../quick/actions';
  import { listTasks } from '../../lib/domain/tasks';
  import { listGoals } from '../../lib/domain/goals';
  import { listHabits } from '../../lib/domain/habits';
  import { getAll } from '../../lib/db/idb';
  import { CheckSquare, Target, Repeat, NotebookPen, RefreshCcw } from '@lucide/svelte';

  interface Cmd { id: string; label: string; hint: string; icon: Component; color: string; run: () => void }

  let dlg: HTMLDialogElement | undefined = $state();
  let input: HTMLInputElement | undefined = $state();
  let q = $state('');
  let active = $state(0);
  let found = $state<Cmd[]>([]);
  let seq = 0;

  const go = (r: Parameters<typeof router.go>[0]) => () => router.go(r);

  const base = $derived.by((): Cmd[] => {
    const ws = app.workspace;
    if (!ws) return [];
    const out: Cmd[] = [{ id: 'p-home', label: 'Home', hint: 'Page', icon: HomeIcon, color: 'var(--accent)', run: go({ name: 'dashboard' }) }];
    for (const g of navGroups(ws)) for (const it of g.items) out.push({ id: `p-${it.id}`, label: it.label, hint: `${g.label} · page`, icon: it.icon, color: it.color, run: go(it.route) });
    out.push({ id: 'p-settings', label: 'Settings', hint: 'Page', icon: SettingsIcon, color: 'var(--text-2)', run: go({ name: 'settings' }) });
    for (const a of QUICK_ACTIONS) if (a.module === null || ws.enabledModules.includes(a.module)) out.push({ id: `a-${a.id}`, label: a.label, hint: 'Create', icon: a.icon, color: a.color, run: a.run });
    out.push({ id: 'a-reset', label: 'Start Weekly Reset', hint: 'Reflect', icon: RefreshCcw, color: 'var(--mod-reset)', run: () => void reset.begin() });
    out.push({
      id: 'a-theme', label: app.settings?.theme === 'dark' ? 'Switch to Soft theme' : 'Switch to Dark theme', hint: 'Appearance', icon: Palette, color: 'var(--accent-2)',
      run: () => void app.updateSettings({ theme: app.settings?.theme === 'dark' ? 'soft' : 'dark' }),
    });
    return out;
  });

  const score = (label: string, terms: string[]): number => {
    const l = label.toLowerCase();
    let s = 0;
    for (const t of terms) {
      const i = l.indexOf(t);
      if (i === -1) return -1;
      s += i === 0 ? 3 : l[i - 1] === ' ' ? 2 : 1;
    }
    return s;
  };

  const results = $derived.by((): Cmd[] => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return base.slice(0, 14);
    const ranked = base.map((c) => ({ c, s: score(c.label, terms) })).filter((x) => x.s >= 0).sort((a, b) => b.s - a.s).map((x) => x.c);
    return [...ranked, ...found].slice(0, 14);
  });

  // search the user's own data (lazily, only while typing)
  $effect(() => {
    const term = q.trim().toLowerCase();
    const mine = ++seq;
    if (!palette.open || term.length < 2) { found = []; return; }
    void (async () => {
      const ws = app.workspace;
      if (!ws) return;
      const terms = term.split(/\s+/);
      const hit = (s: string) => terms.every((t) => s.toLowerCase().includes(t));
      const out: Cmd[] = [];
      if (ws.enabledModules.includes('tasks')) for (const t of (await listTasks()).filter((x) => hit(x.title)).slice(0, 4)) out.push({ id: `t-${t.id}`, label: t.title, hint: t.done ? 'Task · done' : 'Task', icon: CheckSquare, color: 'var(--mod-tasks)', run: go({ name: 'module', module: 'tasks' }) });
      if (ws.enabledModules.includes('goals')) for (const g of (await listGoals()).filter((x) => hit(x.title)).slice(0, 3)) out.push({ id: `g-${g.id}`, label: g.title, hint: 'Goal', icon: Target, color: 'var(--mod-goals)', run: go({ name: 'module', module: 'goals' }) });
      if (ws.enabledModules.includes('habits')) for (const h of (await listHabits()).filter((x) => hit(x.name)).slice(0, 3)) out.push({ id: `h-${h.id}`, label: h.name, hint: 'Habit', icon: Repeat, color: 'var(--mod-habits)', run: go({ name: 'module', module: 'habits' }) });
      if (ws.enabledModules.includes('notes')) for (const n of (await getAll('notes')).filter((x) => hit(x.title || x.content.slice(0, 60))).slice(0, 3)) out.push({ id: `n-${n.id}`, label: n.title || n.content.slice(0, 60), hint: 'Note', icon: NotebookPen, color: 'var(--mod-notes)', run: go({ name: 'module', module: 'notes' }) });
      if (mine === seq) found = out;
    })();
  });

  $effect(() => { void q; active = 0; });

  $effect(() => {
    if (!dlg) return;
    if (palette.open && !dlg.open) {
      q = '';
      found = [];
      dlg.showModal();
      void tick().then(() => input?.focus());
    } else if (!palette.open && dlg.open) dlg.close();
  });

  function choose(c: Cmd | undefined) {
    if (!c) return;
    palette.hide();
    // let the dialog close first so a form opened by the action isn't stacked under it
    queueMicrotask(() => c.run());
  }
  function onkey(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(results.length - 1, active + 1); scrollActive(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); scrollActive(); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(results[active]); }
  }
  function scrollActive() { void tick().then(() => document.getElementById(`cmd-${active}`)?.scrollIntoView({ block: 'nearest' })); }

  function globalKey(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (app.workspace?.onboarded) palette.toggle(); }
  }
</script>

<svelte:window onkeydown={globalKey} />

<dialog bind:this={dlg} class="pal" aria-label="Command palette" oncancel={(e) => { e.preventDefault(); palette.hide(); }}
  onclick={(e) => { if (e.target === dlg) palette.hide(); }}>
  <div class="panel glass-strong">
    <div class="search">
      <Search size={18} aria-hidden="true" />
      <input bind:this={input} bind:value={q} onkeydown={onkey} placeholder="Search or jump to…" role="combobox" aria-expanded="true"
        aria-controls="cmd-list" aria-activedescendant={results.length ? `cmd-${active}` : undefined} aria-label="Search or jump to" autocomplete="off" spellcheck="false" />
      <kbd>Esc</kbd>
    </div>
    <ul id="cmd-list" role="listbox" aria-label="Results">
      {#each results as c, i (c.id)}
        <li id="cmd-{i}" role="option" aria-selected={i === active} class:on={i === active} style="--c:{c.color}"
          onpointermove={() => (active = i)} onclick={() => choose(c)} onkeydown={() => {}}>
          <span class="ico" aria-hidden="true"><c.icon size={17} /></span>
          <span class="lbl">{c.label}</span>
          <span class="hint">{c.hint}</span>
          {#if i === active}<CornerDownLeft size={14} aria-hidden="true" />{/if}
        </li>
      {:else}
        <li class="none" role="presentation">Nothing found for “{q}”.</li>
      {/each}
    </ul>
  </div>
</dialog>

<style>
  dialog.pal { padding: 0; border: 0; background: transparent; color: var(--text); width: min(620px, calc(100vw - 24px)); max-width: none; margin: 12vh auto auto; overflow: visible; }
  dialog.pal::backdrop { background: var(--scrim); backdrop-filter: blur(5px); animation: fade var(--dur) var(--ease-out); }
  .panel { border-radius: var(--radius-xl); overflow: hidden; animation: pop var(--dur-slow) var(--ease-glide); }
  .search { display: flex; align-items: center; gap: var(--space-3); padding: 0 var(--space-4); height: 56px; border-bottom: 1px solid var(--glass-edge); color: var(--text-2); }
  input { flex: 1; min-width: 0; height: 100%; background: none; border: 0; outline: none; font-size: var(--text-md); color: var(--text); }
  input::placeholder { color: var(--text-3); }
  kbd { font: 600 11px var(--font-body); padding: 3px 7px; border-radius: 6px; border: 1px solid var(--border-strong); color: var(--text-3); }
  ul { list-style: none; margin: 0; padding: var(--space-2); max-height: min(52vh, 440px); overflow: auto; }
  li { display: flex; align-items: center; gap: var(--space-3); min-height: 46px; padding: 0 var(--space-3); border-radius: var(--radius-sm); cursor: pointer; color: var(--text-2); }
  li.on { background: color-mix(in srgb, var(--c) 13%, transparent); color: var(--text); }
  .ico { width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; color: var(--c); background: color-mix(in srgb, var(--c) 14%, transparent); flex: none; }
  .lbl { flex: 1; min-width: 0; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .hint { font-size: var(--text-xs); color: var(--text-3); white-space: nowrap; }
  .none { color: var(--text-3); justify-content: center; cursor: default; }
  @keyframes pop { from { opacity: 0; transform: translateY(-8px) scale(.975); } }
  @keyframes fade { from { opacity: 0; } }
</style>
