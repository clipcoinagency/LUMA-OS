<script lang="ts">
  // Notes: list + search on the left (or on its own on phones), editor with autosave.
  import { Plus, NotebookPen, Pin, PinOff, Trash2, ArrowLeft, SearchX, BookHeart } from '@lucide/svelte';
  import DateField from '../../../lib/ui/DateField.svelte';
  import Segmented from '../../../lib/ui/Segmented.svelte';
  import Select from '../../../lib/ui/Select.svelte';
  import { MOODS } from '../../../lib/moods';
  import { app } from '../../../lib/app.svelte';
  import { listProjects } from '../../../lib/domain/projects';
  import PageHeader from '../PageHeader.svelte';
  import Button from '../../../lib/ui/Button.svelte';
  import SearchField from '../../../lib/ui/SearchField.svelte';
  import EmptyState from '../../../lib/ui/EmptyState.svelte';
  import ConfirmDialog from '../../../lib/ui/ConfirmDialog.svelte';
  import { toast } from '../../../lib/ui/toast.svelte';
  import { changes } from '../../../lib/db/changes.svelte';
  import { clock } from '../../../lib/clock.svelte';
  import { getAll } from '../../../lib/db/idb';
  import { deleteRecord, restoreRecord, saveRecord } from '../../../lib/domain/records';
  import { newId } from '../../../lib/util/ids';
  import { diffDays, formatDateKey, isDateKey, nowIso } from '../../../lib/util/dates';
  import type { Note, Project } from '../../../lib/db/schema';

  let notes = $state.raw<Note[] | null>(null);
  let q = $state('');
  let selectedId = $state<string | null>(null);
  let title = $state('');
  let content = $state('');
  let date = $state('');
  let kind = $state<'note' | 'journal'>('note');
  let mood = $state<1 | 2 | 3 | 4 | 5 | null>(null);
  let tagText = $state('');
  let projectId = $state('');
  let view = $state('all');
  let projects = $state<Project[]>([]);
  const hasProjects = $derived(!!app.workspace?.enabledModules.some((m) => m === 'work' || m === 'study'));
  const parseTags = (t: string) => [...new Set(t.split(',').map((x) => x.trim().replace(/^#/, '')).filter(Boolean))].slice(0, 12);
  let saved = $state<'saved' | 'saving' | ''>('');
  let confirmDelete = $state(false);
  let wasNew = $state(false); // only a just-created, never-had-content note is silently dropped when left empty
  let timer: ReturnType<typeof setTimeout> | undefined;

  $effect(() => { void changes.version; void getAll('notes').then((n) => { notes = n; }); if (hasProjects) void listProjects().then((p) => { projects = p; }); });

  const sorted = $derived((notes ?? []).slice().sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt)));
  const filtered = $derived.by(() => {
    const s = q.trim().toLowerCase().replace(/^#/, '');
    const byKind = view === 'all' ? sorted : sorted.filter((n) => (n.kind ?? 'note') === view);
    return s ? byKind.filter((n) => n.title.toLowerCase().includes(s) || n.content.toLowerCase().includes(s) || n.tags.some((t) => t.toLowerCase().includes(s))) : byKind;
  });
  const journalCount = $derived((notes ?? []).filter((n) => n.kind === 'journal').length);
  const current = $derived(notes?.find((n) => n.id === selectedId) ?? null);

  /** A just-created note left completely empty is removed instead of cluttering the list.
   *  An EXISTING note the user happens to clear out is saved as-is, never silently destroyed —
   *  they can still delete it explicitly (with confirmation) if that's what they meant to do. */
  function leave() {
    flush();
    const n = current;
    if (wasNew && n && !title.trim() && !content.trim()) void deleteRecord('notes', n.id);
  }
  function select(n: Note) {
    if (n.id === selectedId) return;
    leave();
    selectedId = n.id; title = n.title; content = n.content; date = n.date; saved = ''; wasNew = false;
    kind = n.kind ?? 'note'; mood = n.mood ?? null; tagText = n.tags.join(', '); projectId = n.projectId ?? '';
    // On the phone-width split view the list pane is hidden once an editor is open, which would
    // otherwise drop focus to <body> (an ancestor going display:none takes any focused descendant
    // with it) — moving focus into the now-visible editor keeps keyboard/screen-reader users
    // oriented, on phone and desktop alike.
    queueMicrotask(() => document.getElementById('note-title')?.focus());
  }
  async function create(k: 'note' | 'journal' = 'note') {
    leave();
    const at = nowIso();
    const n: Note = { id: newId('note'), title: '', content: '', date: clock.today, pinned: false, tags: [], kind: k, mood: null, projectId: null, createdAt: at, updatedAt: at };
    await saveRecord('notes', n);
    selectedId = n.id; title = ''; content = ''; date = n.date; wasNew = true; kind = k; mood = null; tagText = ''; projectId = '';
    queueMicrotask(() => document.getElementById('note-title')?.focus());
  }
  function schedule() {
    saved = 'saving';
    clearTimeout(timer);
    timer = setTimeout(flush, 500);
  }
  function flush() {
    clearTimeout(timer);
    timer = undefined;
    const n = current;
    if (!n || saved !== 'saving') return;
    const next: Note = { ...n, title: title.trim(), content, date: isDateKey(date) ? date : n.date, kind, mood: kind === 'journal' ? mood : null, tags: parseTags(tagText), projectId: projectId || null };
    void saveRecord('notes', next).then(() => { saved = 'saved'; });
  }
  async function togglePin(n: Note) { await saveRecord('notes', { ...n, pinned: !n.pinned }); }
  async function del() {
    confirmDelete = false;
    if (!current) return;
    clearTimeout(timer);
    const old = await deleteRecord('notes', current.id);
    selectedId = null;
    toast('Note deleted', { action: old ? { label: 'Undo', run: () => void restoreRecord('notes', old) } : undefined });
    // The trash button the confirm dialog would normally restore focus to no longer exists once
    // the editor collapses back to the empty-state pick — send focus somewhere still on the page.
    queueMicrotask(() => document.getElementById('notes-search')?.focus());
  }
  function when(n: Note) {
    const d = diffDays(n.date, clock.today);
    return d === 0 ? 'Today' : d === 1 ? 'Yesterday' : formatDateKey(n.date, { day: 'numeric', month: 'short', year: n.date.slice(0, 4) !== clock.today.slice(0, 4) ? 'numeric' : undefined });
  }
  const preview = (n: Note) => n.content.replace(/\s+/g, ' ').trim().slice(0, 90);
  $effect(() => () => leave()); // save (or drop if empty) when leaving the page

  // A pending 500ms debounce must not lose the last few keystrokes if the tab is closed,
  // reloaded or backgrounded before it fires.
  $effect(() => {
    const onHide = () => { if (saved === 'saving') flush(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => { document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', onHide); };
  });
</script>

<PageHeader module="notes">
  {#snippet actions()}<Button onclick={() => create('journal')}>{#snippet icon()}<BookHeart />{/snippet}Journal entry</Button><Button variant="primary" onclick={() => create('note')}>{#snippet icon()}<Plus />{/snippet}New note</Button>{/snippet}
</PageHeader>

{#if notes}
  {#if notes.length === 0}
    <div class="card"><EmptyState title="No notes yet" body="Capture thoughts, ideas, lists and reflections. They stay on your device.">
      {#snippet icon()}<NotebookPen />{/snippet}
      {#snippet action()}<Button variant="primary" onclick={() => create('note')}>{#snippet icon()}<Plus />{/snippet}Write your first note</Button>{/snippet}
    </EmptyState></div>
  {:else}
    <div class="split" class:editing={!!current}>
      <aside class="listcol">
        {#if journalCount}<Segmented label="Show" size="sm" bind:value={view} options={[{ value: 'all', label: 'All' }, { value: 'note', label: 'Notes' }, { value: 'journal', label: 'Journal' }]} />{/if}
        <SearchField id="notes-search" bind:value={q} label="Search notes" placeholder="Search notes, journal and #tags" />
        {#if filtered.length === 0}<EmptyState compact title="No matches" body="Try another word.">{#snippet icon()}<SearchX />{/snippet}</EmptyState>{/if}
        <ul class="list">
          {#each filtered as n (n.id)}
            <li>
              <button type="button" id="note-item-{n.id}" class="item" class:sel={n.id === selectedId} onclick={() => select(n)} aria-current={n.id === selectedId || undefined}>
                <span class="row"><span class="t">{#if n.pinned}<Pin size={13} aria-label="Pinned" />{/if}{#if n.kind === 'journal'}<BookHeart size={13} aria-label="Journal entry" />{/if}{n.title || (n.kind === 'journal' ? 'Journal entry' : 'Untitled')}</span><span class="meta">{#if n.kind === 'journal' && n.mood}{@const M = MOODS.find((x) => x.value === n.mood)}{#if M}<span class="mood" style="color:{M.color}" title={M.label}><M.icon size={14} aria-label={M.label} /></span>{/if}{/if}{when(n)}</span></span>
                {#if preview(n)}<span class="p">{preview(n)}</span>{/if}
              </button>
            </li>
          {/each}
        </ul>
      </aside>
      <section class="editor" aria-label="Note editor">
        {#if current}
          <div class="etop">
            <button type="button" class="back" onclick={() => { const backTo = selectedId; leave(); selectedId = null; queueMicrotask(() => (document.getElementById(`note-item-${backTo}`) ?? document.getElementById('notes-search'))?.focus()); }} aria-label="Back to notes"><ArrowLeft size={18} /> Notes</button>
            <span class="meta status" aria-live="polite">{saved === 'saving' ? 'Saving…' : saved === 'saved' ? 'Saved' : ''}</span>
            <button type="button" class="ic" aria-label={current.pinned ? 'Unpin note' : 'Pin note'} onclick={() => togglePin(current!)}>{#if current.pinned}<PinOff size={18} />{:else}<Pin size={18} />{/if}</button>
            <button type="button" class="ic danger" aria-label="Delete note" onclick={() => (confirmDelete = true)}><Trash2 size={18} /></button>
          </div>
          <input id="note-title" class="title" bind:value={title} oninput={schedule} placeholder="Title" maxlength="160" aria-label="Note title" />
          <div class="emeta">
            <Segmented label="Type" size="sm" bind:value={kind} options={[{ value: 'note', label: 'Note' }, { value: 'journal', label: 'Journal' }]} onchange={schedule} />
            <span class="date meta">Belongs to <DateField label="Note date" compact bind:value={date} oninput={schedule} /></span>
          </div>
          {#if kind === 'journal'}
            <div class="moods" role="radiogroup" aria-label="How are you feeling?">
              <span class="meta">How are you feeling?</span>
              {#each MOODS as m (m.value)}
                <button type="button" role="radio" aria-checked={mood === m.value} class:on={mood === m.value} style="--c:{m.color}" onclick={() => { mood = mood === m.value ? null : m.value; schedule(); }} aria-label={m.label} title={m.label}><m.icon size={20} /></button>
              {/each}
            </div>
          {/if}
          <textarea class="body" bind:value={content} oninput={schedule} placeholder={kind === 'journal' ? 'How was your day? What is on your mind?' : 'Start writing…'} aria-label="Note text"></textarea>
          <div class="efoot">
            <label class="tags meta">Tags <input bind:value={tagText} oninput={schedule} placeholder="ideas, reading" maxlength="120" aria-label="Tags, comma separated" /></label>
            {#if hasProjects && projects.length}<div class="proj"><Select label="Project" value={projectId} options={[{ value: '', label: 'None' }, ...projects.map((p) => ({ value: p.id, label: p.title }))]} onchange={(v) => { projectId = v; schedule(); }} /></div>{/if}
          </div>
        {:else}
          <div class="pick"><EmptyState compact title="Select a note" body="Or start a new one.">{#snippet icon()}<NotebookPen />{/snippet}</EmptyState></div>
        {/if}
      </section>
    </div>
  {/if}
{/if}

<ConfirmDialog bind:open={confirmDelete} title="Delete this note?" message={`"${current?.title || 'Untitled'}" will be deleted. You can undo right after.`} confirmLabel="Delete note" onconfirm={del} />

<style>
  .card { background: var(--surface); border: var(--card-border); border-radius: var(--radius-lg); }
  .split { display: grid; grid-template-columns: minmax(260px, 340px) 1fr; gap: var(--space-4); align-items: start; }
  .listcol { display: grid; gap: var(--space-3); position: sticky; top: var(--space-4); }
  .list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-2); max-height: calc(100dvh - 260px); overflow: auto; }
  .item { width: 100%; text-align: left; display: grid; gap: 4px; padding: var(--space-3); border-radius: var(--radius-md); border: 1px solid var(--border); background: var(--surface); color: var(--text); cursor: pointer; transition: border-color var(--dur), background-color var(--dur); }
  .item:hover { border-color: var(--border-strong); }
  .item.sel { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 6%, var(--surface)); }
  .item:focus-visible { border-radius: var(--radius-md); }
  .row { display: flex; justify-content: space-between; gap: var(--space-2); }
  .t { font-weight: 650; display: flex; gap: 6px; align-items: center; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .p { color: var(--text-2); font-size: var(--text-sm); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .editor { background: var(--surface); border: var(--card-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-1); padding: var(--space-4) var(--space-5) var(--space-5); min-height: 60dvh; display: flex; flex-direction: column; gap: var(--space-2); }
  .etop { display: flex; align-items: center; gap: var(--space-1); }
  .back { display: none; align-items: center; gap: 6px; background: none; border: 0; color: var(--text-2); font-weight: 600; cursor: pointer; min-height: 40px; }
  .status { margin-right: auto; }
  .ic { width: 40px; height: 40px; display: grid; place-items: center; border: 0; background: none; color: var(--text-2); border-radius: var(--radius-sm); cursor: pointer; }
  .ic:hover { background: var(--surface-2); color: var(--text); }
  .ic.danger:hover { color: var(--danger); }
  .title { border: 0; background: none; font-family: var(--font-display); font-weight: var(--display-weight); font-size: var(--text-xl); color: var(--text); padding: var(--space-1) 0; outline: none; }
  .date { display: flex; align-items: center; gap: var(--space-2); }
  .body { flex: 1; min-height: 45dvh; border: 0; background: none; resize: none; outline: none; color: var(--text); font-size: var(--text-md); line-height: 1.7; padding-top: var(--space-3); }
  .title:focus-visible, .body:focus-visible { box-shadow: none; }
  .pick { display: grid; place-items: center; flex: 1; }
  @media (max-width: 860px) {
    .split { grid-template-columns: 1fr; }
    .listcol { position: static; }
    .list { max-height: none; }
    .split.editing .listcol, .split:not(.editing) .editor { display: none; }
    .back { display: inline-flex; }
  }
  .emeta { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); flex-wrap: wrap; }
  .moods { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .moods button { width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; cursor: pointer; border: 1.5px solid var(--border-strong); background: var(--surface); color: var(--c); transition: all var(--dur) var(--ease-emphasis); }
  .moods button:hover { transform: scale(1.08); }
  .moods button.on { background: color-mix(in srgb, var(--c) 18%, var(--surface)); border-color: var(--c); transform: scale(1.12); }
  .mood { display: inline-flex; margin-right: 6px; vertical-align: -2px; }
  .efoot { display: flex; gap: var(--space-3); align-items: end; flex-wrap: wrap; }
  .tags { display: grid; gap: 4px; flex: 1; min-width: 180px; }
  .tags input { height: 40px; padding: 0 var(--space-3); border-radius: var(--radius-sm); border: 1px solid var(--border-strong); background: var(--surface); color: var(--text); }
  .proj { min-width: 180px; }
</style>
