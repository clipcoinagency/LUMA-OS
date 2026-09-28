<script lang="ts">
  // Notes: list + search on the left (or on its own on phones), editor with autosave.
  import { Plus, NotebookPen, Pin, PinOff, Trash2, ArrowLeft, SearchX } from '@lucide/svelte';
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
  import type { Note } from '../../../lib/db/schema';

  let notes = $state.raw<Note[] | null>(null);
  let q = $state('');
  let selectedId = $state<string | null>(null);
  let title = $state('');
  let content = $state('');
  let date = $state('');
  let saved = $state<'saved' | 'saving' | ''>('');
  let confirmDelete = $state(false);
  let wasNew = $state(false); // only a just-created, never-had-content note is silently dropped when left empty
  let timer: ReturnType<typeof setTimeout> | undefined;

  $effect(() => { void changes.version; void getAll('notes').then((n) => { notes = n; }); });

  const sorted = $derived((notes ?? []).slice().sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt)));
  const filtered = $derived.by(() => {
    const s = q.trim().toLowerCase();
    return s ? sorted.filter((n) => n.title.toLowerCase().includes(s) || n.content.toLowerCase().includes(s)) : sorted;
  });
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
  }
  async function create() {
    leave();
    const at = nowIso();
    const n: Note = { id: newId('note'), title: '', content: '', date: clock.today, pinned: false, tags: [], createdAt: at, updatedAt: at };
    await saveRecord('notes', n);
    selectedId = n.id; title = ''; content = ''; date = n.date; wasNew = true;
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
    const next = { ...n, title: title.trim(), content, date: isDateKey(date) ? date : n.date };
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
  {#snippet actions()}<Button variant="primary" onclick={create}>{#snippet icon()}<Plus />{/snippet}New note</Button>{/snippet}
</PageHeader>

{#if notes}
  {#if notes.length === 0}
    <div class="card"><EmptyState title="No notes yet" body="Capture thoughts, ideas, lists and reflections. They stay on your device.">
      {#snippet icon()}<NotebookPen />{/snippet}
      {#snippet action()}<Button variant="primary" onclick={create}>{#snippet icon()}<Plus />{/snippet}Write your first note</Button>{/snippet}
    </EmptyState></div>
  {:else}
    <div class="split" class:editing={!!current}>
      <aside class="listcol">
        <SearchField bind:value={q} label="Search notes" placeholder="Search notes" />
        {#if filtered.length === 0}<EmptyState compact title="No matches" body="Try another word.">{#snippet icon()}<SearchX />{/snippet}</EmptyState>{/if}
        <ul class="list">
          {#each filtered as n (n.id)}
            <li>
              <button type="button" class="item" class:sel={n.id === selectedId} onclick={() => select(n)} aria-current={n.id === selectedId || undefined}>
                <span class="row"><span class="t">{#if n.pinned}<Pin size={13} aria-label="Pinned" />{/if}{n.title || 'Untitled'}</span><span class="meta">{when(n)}</span></span>
                {#if preview(n)}<span class="p">{preview(n)}</span>{/if}
              </button>
            </li>
          {/each}
        </ul>
      </aside>
      <section class="editor" aria-label="Note editor">
        {#if current}
          <div class="etop">
            <button type="button" class="back" onclick={() => { leave(); selectedId = null; }} aria-label="Back to notes"><ArrowLeft size={18} /> Notes</button>
            <span class="meta status" aria-live="polite">{saved === 'saving' ? 'Saving…' : saved === 'saved' ? 'Saved' : ''}</span>
            <button type="button" class="ic" aria-label={current.pinned ? 'Unpin note' : 'Pin note'} onclick={() => togglePin(current!)}>{#if current.pinned}<PinOff size={18} />{:else}<Pin size={18} />{/if}</button>
            <button type="button" class="ic danger" aria-label="Delete note" onclick={() => (confirmDelete = true)}><Trash2 size={18} /></button>
          </div>
          <input id="note-title" class="title" bind:value={title} oninput={schedule} placeholder="Title" maxlength="160" aria-label="Note title" />
          <label class="date meta">Belongs to <input type="date" bind:value={date} onchange={schedule} aria-label="Note date" /></label>
          <textarea class="body" bind:value={content} oninput={schedule} placeholder="Start writing…" aria-label="Note text"></textarea>
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
  .date input { border: 0; background: var(--surface-2); color: var(--text-2); border-radius: var(--radius-xs); padding: 4px 8px; font-size: var(--text-sm); }
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
</style>
