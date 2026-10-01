<script lang="ts">
  // One book: progress (log pages, jump to a page, mark finished), rating, highlights and a reading
  // focus session. Everything written here is a dated row, so the streak and weekly chart stay true.
  import { Pencil, Play, Check, Quote, Trash2, Star, BookOpenCheck } from '@lucide/svelte';
  import Modal from '../../../lib/ui/Modal.svelte';
  import Button from '../../../lib/ui/Button.svelte';
  import Segmented from '../../../lib/ui/Segmented.svelte';
  import ProgressBar from '../../../lib/ui/ProgressBar.svelte';
  import TextField from '../../../lib/ui/TextField.svelte';
  import BookCover from './BookCover.svelte';
  import { toast } from '../../../lib/ui/toast.svelte';
  import { focus } from '../../../lib/focus.svelte';
  import { openQuick } from '../../quick/quick.svelte';
  import { addHighlight, finishBook, fractionOf, KIND_LABEL, logReading, maxOf, remainingOf, removeHighlight, saveBook, setProgress, unitOf } from '../../../lib/domain/reading';
  import type { Book, BookStatus, Project, ReadingLog } from '../../../lib/db/schema';
  import { formatDateKey } from '../../../lib/util/dates';

  interface Props { open?: boolean; book: Book | null; logs: ReadingLog[]; subjects: Project[] }
  let { open = $bindable(false), book, logs, subjects }: Props = $props();

  let amount = $state('');
  let atPage = $state('');
  let quote = $state('');
  let quotePage = $state('');
  let busy = $state(false);

  $effect(() => { if (open) { amount = ''; atPage = ''; quote = ''; quotePage = ''; } });

  const unit = $derived(book ? unitOf(book) : 'pages');
  const mine = $derived(book ? logs.filter((l) => l.bookId === book.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5) : []);
  const subject = $derived(subjects.find((s) => s.id === book?.subjectId) ?? null);

  async function log(n: number) {
    if (!book || !Number.isFinite(n) || n <= 0 || busy) return;
    busy = true;
    try {
      const before = book.status;
      const next = await logReading(book.id, n);
      amount = '';
      if (next?.status === 'finished' && before !== 'finished') toast(`Finished “${book.title}”. Nicely done.`, { tone: 'success' });
      else toast(`+${n} ${unit === 'pages' ? (n === 1 ? 'page' : 'pages') : '%'} logged`, { tone: 'success' });
    } finally { busy = false; }
  }
  async function jump() {
    if (!book || !atPage.trim()) return;
    const v = Number(atPage);
    if (!Number.isFinite(v)) return;
    await setProgress(book.id, v);
    atPage = '';
  }
  async function status(v: string) { if (book) await saveBook({ id: book.id, title: book.title, status: v as BookStatus }); }
  async function rate(n: 1 | 2 | 3 | 4 | 5) { if (book) await saveBook({ id: book.id, title: book.title, rating: book.rating === n ? null : n }); }
  async function finish() {
    if (!book) return;
    await finishBook(book.id);
    toast(`Finished “${book.title}”. Nicely done.`, { tone: 'success' });
  }
  async function addQuote() {
    if (!book || !quote.trim()) return;
    await addHighlight(book.id, quote, quotePage.trim() ? Number(quotePage) : null);
    quote = ''; quotePage = '';
  }
  function readNow() {
    if (!book) return;
    open = false;
    void focus.start({ plannedMin: 25, label: `Reading: ${book.title}`, projectId: book.subjectId });
  }
  const edit = () => { if (!book) return; open = false; openQuick('book', { book }); };
</script>

<Modal bind:open title={book?.title ?? 'Book'} size="md">
  {#if book}
    {@const frac = fractionOf(book)}
    <div class="top">
      <div class="cov"><BookCover title={book.title} color={book.color} kind={book.kind} size="md" done={book.status === 'finished'} /></div>
      <div class="meta">
        <p class="by">{book.author || KIND_LABEL[book.kind]}{#if book.author}<span class="kind"> · {KIND_LABEL[book.kind]}</span>{/if}</p>
        {#if subject}<p class="subj">Part of <strong>{subject.title}</strong></p>{/if}
        <Segmented label="Status" size="sm" value={book.status} onchange={status} options={[{ value: 'want', label: 'Want' }, { value: 'reading', label: 'Reading' }, { value: 'paused', label: 'Paused' }, { value: 'finished', label: 'Finished' }]} />
        <div class="stars" role="radiogroup" aria-label="Your rating">
          {#each [1, 2, 3, 4, 5] as n (n)}
            <button type="button" role="radio" aria-checked={book.rating === n} aria-label="{n} star{n === 1 ? '' : 's'}" class:on={(book.rating ?? 0) >= n} onclick={() => rate(n as 1 | 2 | 3 | 4 | 5)}><Star size={20} /></button>
          {/each}
        </div>
        <div class="acts">
          {#if book.status !== 'finished'}<Button size="sm" variant="primary" onclick={readNow}>{#snippet icon()}<Play />{/snippet}Read with focus</Button>{/if}
          <Button size="sm" variant="ghost" onclick={edit}>{#snippet icon()}<Pencil />{/snippet}Edit</Button>
        </div>
      </div>
    </div>

    <section class="prog" aria-label="Progress">
      <div class="ph">
        <strong class="num">{Math.round(frac * 100)}%</strong>
        <span class="muted">{book.progress} / {maxOf(book)} {unit === 'pages' ? 'pages' : '%'}{#if book.status !== 'finished' && remainingOf(book) > 0} · {remainingOf(book)} {unit === 'pages' ? 'to go' : '% to go'}{/if}</span>
      </div>
      <ProgressBar value={frac * 100} label="{book.title} progress" color={book.color} height={10} />
      {#if book.status !== 'finished'}
        <div class="log">
          <div class="chips" role="group" aria-label="Quick log">
            {#each (unit === 'pages' ? [5, 10, 25, 50] : [5, 10, 25]) as n (n)}<button type="button" class="chip" onclick={() => log(n)}>+{n}</button>{/each}
          </div>
          <form class="inline" onsubmit={(e) => { e.preventDefault(); void log(Number(amount)); }}>
            <TextField label={unit === 'pages' ? 'Pages read' : 'Percent read'} bind:value={amount} inputmode="numeric" placeholder="e.g. 20" />
            <Button variant="primary" type="submit" disabled={!amount.trim() || busy}>Log</Button>
          </form>
          <form class="inline" onsubmit={(e) => { e.preventDefault(); void jump(); }}>
            <TextField label={unit === 'pages' ? 'I am on page' : 'I am at (%)'} bind:value={atPage} inputmode="numeric" />
            <Button type="submit" disabled={!atPage.trim()}>Set</Button>
          </form>
          <Button variant="ghost" onclick={finish}>{#snippet icon()}<BookOpenCheck />{/snippet}Mark finished</Button>
        </div>
      {:else if book.finishedOn}
        <p class="muted done"><Check size={15} aria-hidden="true" /> Finished {formatDateKey(book.finishedOn, { month: 'long', day: 'numeric', year: 'numeric' })}</p>
      {/if}
      {#if mine.length}
        <ul class="hist" aria-label="Recent reading">
          {#each mine as l (l.id)}<li><span>{formatDateKey(l.date, { weekday: 'short', month: 'short', day: 'numeric' })}</span><span class="num">+{l.amount} {unit === 'pages' ? 'pages' : '%'}</span></li>{/each}
        </ul>
      {/if}
    </section>

    <section class="hl" aria-label="Highlights">
      <h3><Quote size={16} aria-hidden="true" />Highlights</h3>
      <form class="qf" onsubmit={(e) => { e.preventDefault(); void addQuote(); }}>
        <TextField label="A line worth keeping" bind:value={quote} multiline rows={2} maxlength={800} />
        <div class="qrow">
          <TextField label="Page" bind:value={quotePage} inputmode="numeric" placeholder="optional" />
          <Button type="submit" disabled={!quote.trim()}>Save highlight</Button>
        </div>
      </form>
      {#if book.highlights.length}
        <ul class="quotes">
          {#each book.highlights as h (h.id)}
            <li>
              <blockquote>{h.text}</blockquote>
              <span class="src">{#if h.page}p. {h.page} · {/if}{formatDateKey(h.at.slice(0, 10), { month: 'short', day: 'numeric' })}</span>
              <button type="button" class="rm" aria-label="Delete highlight" onclick={() => removeHighlight(book.id, h.id)}><Trash2 size={14} /></button>
            </li>
          {/each}
        </ul>
      {/if}
    </section>
    {#if book.notes}<section class="notes"><h3>Notes</h3><p>{book.notes}</p></section>{/if}
  {/if}
</Modal>

<style>
  .top { display: grid; grid-template-columns: 112px 1fr; gap: var(--space-5); align-items: start; margin-bottom: var(--space-5); }
  .meta { display: grid; gap: var(--space-3); min-width: 0; }
  .by { font-weight: 600; } .kind { color: var(--text-2); font-weight: 500; }
  .subj { font-size: var(--text-sm); color: var(--text-2); }
  .stars { display: flex; gap: 2px; }
  .stars button { border: 0; background: none; padding: 4px; cursor: pointer; color: var(--text-3); border-radius: 8px; transition: transform var(--dur-fast) var(--ease-out), color var(--dur) var(--ease-out); }
  .stars button.on { color: var(--warning); } .stars button.on :global(svg) { fill: currentColor; }
  .stars button:hover { transform: scale(1.15); }
  .acts { display: flex; gap: var(--space-2); flex-wrap: wrap; }
  .prog { display: grid; gap: var(--space-3); padding: var(--space-4); border-radius: var(--radius-lg); background: var(--surface-2); border: 1px solid var(--border); }
  .ph { display: flex; align-items: baseline; gap: var(--space-3); flex-wrap: wrap; }
  .ph strong { font-family: var(--font-display); font-size: var(--text-2xl); }
  .log { display: grid; gap: var(--space-3); }
  .chips { display: flex; gap: var(--space-2); flex-wrap: wrap; }
  .chip { min-height: 36px; padding: 0 var(--space-4); border-radius: 999px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--text); font-weight: 700; cursor: pointer; transition: transform var(--dur-fast) var(--ease-out), background-color var(--dur) var(--ease-out); }
  .chip:hover { background: var(--accent-soft); } .chip:active { transform: scale(.94); }
  .inline { display: grid; grid-template-columns: 1fr auto; gap: var(--space-3); align-items: end; }
  .done { display: flex; align-items: center; gap: 6px; color: var(--success); }
  .hist { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; font-size: var(--text-sm); color: var(--text-2); }
  .hist li { display: flex; justify-content: space-between; }
  .hl, .notes { margin-top: var(--space-5); }
  h3 { display: flex; align-items: center; gap: 6px; font-size: var(--text-md); margin-bottom: var(--space-3); }
  .qf { display: grid; gap: var(--space-3); }
  .qrow { display: grid; grid-template-columns: 120px 1fr; gap: var(--space-3); align-items: end; }
  .quotes { list-style: none; margin: var(--space-4) 0 0; padding: 0; display: grid; gap: var(--space-3); }
  .quotes li { position: relative; padding: var(--space-3) var(--space-8) var(--space-3) var(--space-4); border-radius: var(--radius-md); background: var(--surface-2); border-left: 3px solid var(--accent); }
  blockquote { margin: 0; font-family: var(--font-display); font-size: var(--text-md); line-height: 1.4; }
  .src { font-size: var(--text-xs); color: var(--text-2); }
  .rm { position: absolute; top: 6px; right: 6px; border: 0; background: none; color: var(--text-3); cursor: pointer; padding: 6px; border-radius: 8px; }
  .rm:hover { color: var(--danger); background: var(--danger-soft); }
  .notes p { white-space: pre-wrap; color: var(--text-2); }
  @media (max-width: 480px) { .top { grid-template-columns: 88px 1fr; gap: var(--space-4); } }
</style>
