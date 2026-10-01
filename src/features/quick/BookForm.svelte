<script lang="ts">
  // Add or edit something to read: a book, article, paper or course.
  import { Trash2 } from '@lucide/svelte';
  import Modal from '../../lib/ui/Modal.svelte';
  import Button from '../../lib/ui/Button.svelte';
  import TextField from '../../lib/ui/TextField.svelte';
  import Select from '../../lib/ui/Select.svelte';
  import Segmented from '../../lib/ui/Segmented.svelte';
  import ConfirmDialog from '../../lib/ui/ConfirmDialog.svelte';
  import { toast } from '../../lib/ui/toast.svelte';
  import { BOOK_COLORS, deleteBook, KIND_LABEL, saveBook } from '../../lib/domain/reading';
  import { listProjects } from '../../lib/domain/projects';
  import type { Book, BookKind, BookStatus, Project } from '../../lib/db/schema';

  let { open = $bindable(false), book = null, status: presetStatus = 'want' }: { open?: boolean; book?: Book | null; status?: BookStatus } = $props();

  let title = $state('');
  let author = $state('');
  let kind = $state<BookKind>('book');
  let status = $state<BookStatus>('want');
  let total = $state('');
  let progress = $state('');
  let subjectId = $state('');
  let color = $state(BOOK_COLORS[0]!);
  let notes = $state('');
  let error = $state('');
  let saving = $state(false);
  let confirmDelete = $state(false);
  let subjects = $state<Project[]>([]);

  $effect(() => {
    if (!open) return;
    error = '';
    if (book) {
      title = book.title; author = book.author; kind = book.kind; status = book.status; total = book.total ? String(book.total) : ''; progress = String(book.progress);
      subjectId = book.subjectId ?? ''; color = book.color; notes = book.notes;
    } else {
      title = ''; author = ''; kind = 'book'; status = presetStatus; total = ''; progress = ''; subjectId = ''; color = BOOK_COLORS[Math.floor(Math.random() * BOOK_COLORS.length)]!; notes = '';
    }
    void listProjects('study').then((p) => { subjects = p.filter((x) => x.status === 'active' || x.id === book?.subjectId); });
  });

  const unit = $derived(total.trim() ? 'pages' : 'percent');

  async function save(e?: Event) {
    e?.preventDefault();
    if (!title.trim()) { error = 'What are you reading? Give it a title.'; return; }
    const t = total.trim() ? Number(total) : null;
    if (t !== null && (!Number.isFinite(t) || t <= 0 || t > 100000)) { error = 'Total pages should be a positive number (or leave it empty).'; return; }
    const p = progress.trim() ? Number(progress) : 0;
    if (!Number.isFinite(p) || p < 0) { error = 'Progress should be zero or more.'; return; }
    saving = true;
    try {
      await saveBook({
        ...(book ? { id: book.id } : {}), title, author: author.trim(), kind, status, total: t, progress: book ? p : 0,
        subjectId: subjectId || null, color, notes: notes.trim(),
      });
      toast(book ? 'Saved' : `Added “${title.trim()}”`, { tone: 'success' });
      open = false;
    } finally { saving = false; }
  }
  async function del() {
    confirmDelete = false;
    if (!book) return;
    await deleteBook(book.id);
    open = false;
    toast(`Deleted “${book.title}” and its reading history`);
  }
</script>

<Modal bind:open title={book ? 'Edit' : 'Add to your library'} size="sm">
  <form class="form" onsubmit={save}>
    <TextField label="Title" bind:value={title} placeholder="e.g. Atomic Habits" maxlength={140} {error} oninput={() => (error = '')} />
    <TextField label="Author (optional)" bind:value={author} maxlength={100} />
    <div class="row2">
      <Select label="Type" bind:value={kind} options={(Object.keys(KIND_LABEL) as BookKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))} />
      <TextField label="Total pages" bind:value={total} inputmode="numeric" placeholder="optional" hint={unit === 'percent' ? 'Empty = track in %' : undefined} />
    </div>
    <div class="field"><span class="lbl">Status</span>
      <Segmented label="Status" size="sm" bind:value={status} options={[{ value: 'want', label: 'Want to read' }, { value: 'reading', label: 'Reading' }, { value: 'paused', label: 'Paused' }, { value: 'finished', label: 'Finished' }]} />
    </div>
    {#if book}<TextField label={unit === 'pages' ? 'Pages read so far' : 'Progress (%)'} bind:value={progress} inputmode="numeric" />{/if}
    {#if subjects.length}
      <Select label="Part of a subject (optional)" bind:value={subjectId} options={[{ value: '', label: 'None' }, ...subjects.map((s) => ({ value: s.id, label: s.title }))]} />
    {/if}
    <div class="field"><span class="lbl">Cover colour</span>
      <div class="swatches" role="radiogroup" aria-label="Cover colour">
        {#each BOOK_COLORS as c (c)}<button type="button" role="radio" aria-checked={color === c} aria-label={c} class:on={color === c} style="--c:{c}" onclick={() => (color = c)}></button>{/each}
      </div>
    </div>
    <TextField label="Notes (optional)" bind:value={notes} multiline rows={2} maxlength={2000} />
    <button type="submit" hidden aria-hidden="true" tabindex="-1"></button>
  </form>
  {#snippet footer()}
    {#if book}<span class="left"><Button variant="ghost" onclick={() => (confirmDelete = true)}>{#snippet icon()}<Trash2 />{/snippet}Delete</Button></span>{/if}
    <Button variant="ghost" onclick={() => (open = false)}>Cancel</Button>
    <Button variant="primary" loading={saving} onclick={() => save()}>{book ? 'Save' : 'Add'}</Button>
  {/snippet}
</Modal>

<ConfirmDialog bind:open={confirmDelete} title="Delete this from your library?" message={`“${book?.title ?? ''}” and its reading history will be removed.`} confirmLabel="Delete" onconfirm={del} />

<style>
  .form { display: grid; gap: var(--space-4); }
  .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }
  .field { display: grid; gap: 6px; }
  .lbl { font-size: var(--text-sm); font-weight: 600; color: var(--text-2); }
  .swatches { display: flex; flex-wrap: wrap; gap: 10px; }
  .swatches button { width: 32px; height: 32px; border-radius: 50%; border: 2px solid transparent; background: var(--c); cursor: pointer; transition: transform var(--dur-fast) var(--ease-out), box-shadow var(--dur) var(--ease-out); }
  .swatches button:hover { transform: scale(1.1); }
  .swatches button.on { box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--c); }
  .left { margin-right: auto; }
  .left :global(.btn) { color: var(--danger); }
</style>
