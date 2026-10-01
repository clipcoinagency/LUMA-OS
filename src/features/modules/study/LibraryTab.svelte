<script lang="ts">
  // Study & Read → Library: a shelf of what you're reading, want to read and have finished, with a
  // streak, a weekly pages chart and a yearly goal. All of it comes from dated reading logs.
  import { Plus, BookOpen, Flame, Target, Library, Pencil, CalendarCheck } from '@lucide/svelte';
  import Button from '../../../lib/ui/Button.svelte';
  import Segmented from '../../../lib/ui/Segmented.svelte';
  import SearchField from '../../../lib/ui/SearchField.svelte';
  import ProgressBar from '../../../lib/ui/ProgressBar.svelte';
  import EmptyState from '../../../lib/ui/EmptyState.svelte';
  import CountUp from '../../../lib/ui/CountUp.svelte';
  import Modal from '../../../lib/ui/Modal.svelte';
  import TextField from '../../../lib/ui/TextField.svelte';
  import Skeleton from '../../../lib/ui/Skeleton.svelte';
  import { spotlight } from '../../../lib/ui/spotlight';
  import BookCover from './BookCover.svelte';
  import BookDetail from './BookDetail.svelte';
  import { app } from '../../../lib/app.svelte';
  import { clock } from '../../../lib/clock.svelte';
  import { changes } from '../../../lib/db/changes.svelte';
  import { openQuick } from '../../quick/quick.svelte';
  import { listProjects } from '../../../lib/domain/projects';
  import { amountSeries, finishedInYear, fractionOf, loadLibrary, maxOf, readingStreak, STATUS_LABEL, unitOf, type LibraryData } from '../../../lib/domain/reading';
  import { formatDateKey } from '../../../lib/util/dates';
  import type { Book, BookStatus, Project } from '../../../lib/db/schema';

  let data = $state.raw<LibraryData | null>(null);
  let subjects = $state.raw<Project[]>([]);
  let filter = $state('reading');
  let query = $state('');
  let openId = $state<string | null>(null);
  let detailOpen = $state(false);
  let goalOpen = $state(false);
  let goalDraft = $state('');

  $effect(() => {
    const v = changes.version;
    void loadLibrary().then((d) => { if (v === changes.version) data = d; });
    void listProjects('study').then((p) => { subjects = p; });
  });

  // first load: land on what is in progress, or on everything when nothing is
  let landed = false;
  $effect(() => { if (data && !landed) { landed = true; filter = data.books.some((b) => b.status === 'reading') ? 'reading' : 'all'; } });

  const year = $derived(Number(clock.today.slice(0, 4)));
  const books = $derived(data?.books ?? []);
  const counts = $derived({
    reading: books.filter((b) => b.status === 'reading').length, want: books.filter((b) => b.status === 'want').length,
    finished: books.filter((b) => b.status === 'finished').length, all: books.length,
  });
  const shown = $derived.by(() => {
    const q = query.trim().toLowerCase();
    return books
      .filter((b) => (filter === 'all' || (filter === 'reading' ? b.status === 'reading' || b.status === 'paused' : b.status === filter)) && (!q || b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q)))
      .sort((a, b) => (filter === 'finished' ? (b.finishedOn ?? '').localeCompare(a.finishedOn ?? '') : b.updatedAt.localeCompare(a.updatedAt)));
  });
  const week = $derived(data ? amountSeries(data.logs, clock.today, 7) : []);
  const weekTotal = $derived(week.reduce((n, d) => n + d.value, 0));
  const weekMax = $derived(Math.max(1, ...week.map((d) => d.value)));
  const streak = $derived(data ? readingStreak(data.logs.map((l) => l.date), clock.today) : 0);
  const finishedYear = $derived(finishedInYear(books, year));
  const goal = $derived(app.settings?.readingGoal ?? 0);
  const open = $derived(books.find((b) => b.id === openId) ?? null);
  const nowReading = $derived(books.filter((b) => b.status === 'reading'));

  function show(b: Book) { openId = b.id; detailOpen = true; }
  async function saveGoal(e?: Event) {
    e?.preventDefault();
    const n = Math.max(0, Math.min(999, Math.round(Number(goalDraft) || 0)));
    await app.updateSettings({ readingGoal: n });
    goalOpen = false;
  }
  const label = (b: Book) => (b.status === 'finished' ? 'Finished' : STATUS_LABEL[b.status]);
</script>

{#if data === null}
  <Skeleton lines={4} />
{:else if books.length === 0}
  <EmptyState title="Your library is empty" body="Add a book, article, paper or course you're reading or want to read. Track pages, keep highlights and build a reading streak.">
    {#snippet icon()}<Library />{/snippet}
    {#snippet action()}<Button variant="primary" onclick={() => openQuick('book', { status: 'reading' })}>{#snippet icon()}<Plus />{/snippet}Add your first book</Button>{/snippet}
  </EmptyState>
{:else}
  <div class="stats" aria-label="Reading overview">
    <section class="st gcard" style="--c:var(--mod-study);--i:0" use:spotlight aria-label="Reading now">
      <span class="lab"><BookOpen size={15} aria-hidden="true" />Reading now</span>
      <strong class="big num"><CountUp value={nowReading.length} /></strong>
      <span class="sub">{nowReading[0] ? nowReading[0].title : 'Nothing in progress'}</span>
    </section>
    <section class="st gcard" style="--c:var(--mod-goals);--i:1" use:spotlight aria-label="Finished this year">
      <span class="lab"><CalendarCheck size={15} aria-hidden="true" />Finished in {year}</span>
      <strong class="big num"><CountUp value={finishedYear} />{#if goal}<span class="of"> / {goal}</span>{/if}</strong>
      {#if goal}<ProgressBar value={finishedYear} max={goal} label="Yearly reading goal" color="var(--mod-goals)" height={6} />{/if}
      <button type="button" class="link" onclick={() => { goalDraft = goal ? String(goal) : ''; goalOpen = true; }}>{#if goal}<Pencil size={12} aria-hidden="true" />Change goal{:else}<Target size={12} aria-hidden="true" />Set a yearly goal{/if}</button>
    </section>
    <section class="st gcard" style="--c:var(--accent);--i:2" use:spotlight aria-label="This week">
      <span class="lab">This week</span>
      <strong class="big num"><CountUp value={weekTotal} /><span class="of"> read</span></strong>
      <div class="bars" role="img" aria-label="Reading per day, last 7 days">
        {#each week as d, i (d.date)}<span class="col" class:now={d.date === clock.today} title="{formatDateKey(d.date, { weekday: 'long' })}: {d.value}"><i class:zero={d.value === 0} style="height:{Math.max(8, (d.value / weekMax) * 100)}%;animation-delay:{i * 50}ms"></i></span>{/each}
      </div>
    </section>
    <section class="st gcard" style="--c:var(--warning);--i:3" use:spotlight aria-label="Reading streak">
      <span class="lab"><Flame size={15} aria-hidden="true" />Reading streak</span>
      <strong class="big num"><CountUp value={streak} /><span class="of"> day{streak === 1 ? '' : 's'}</span></strong>
      <span class="sub">{streak ? 'Keep it going — a page counts.' : 'Log some reading to start a streak.'}</span>
    </section>
  </div>

  <div class="bar">
    <Segmented label="Show" size="sm" bind:value={filter} options={[
      { value: 'reading', label: `Reading (${counts.reading})` }, { value: 'want', label: `Want to read (${counts.want})` },
      { value: 'finished', label: `Finished (${counts.finished})` }, { value: 'all', label: `All (${counts.all})` }]} />
    <div class="search"><SearchField bind:value={query} label="Search library" placeholder="Search title or author…" /></div>
  </div>

  {#if shown.length === 0}
    <EmptyState compact title={query ? 'No matches' : 'Nothing here yet'} body={query ? 'Try another word.' : 'Books with this status will appear here.'} />
  {:else}
    <ul class="shelf" aria-label="Books">
      {#each shown as b, i (b.id)}
        <li style="--i:{i}">
          <button type="button" class="book" onclick={() => show(b)} aria-label="{b.title}{b.author ? `, ${b.author}` : ''}, {label(b)}, {Math.round(fractionOf(b) * 100)}%">
            <span class="cv"><BookCover title={b.title} color={b.color} kind={b.kind} size="md" done={b.status === 'finished'} /></span>
            <span class="tt">{b.title}</span>
            <span class="au">{b.author || label(b)}</span>
            {#if b.status !== 'want'}
              <span class="pg"><ProgressBar value={fractionOf(b) * 100} label="{b.title} progress" color={b.color} height={5} /></span>
              <span class="pn num">{b.status === 'finished' ? 'Finished' : `${b.progress} / ${maxOf(b)} ${unitOf(b) === 'pages' ? 'pages' : '%'}`}</span>
            {:else}<span class="pn">Want to read</span>{/if}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
{/if}

<BookDetail bind:open={detailOpen} book={open} logs={data?.logs ?? []} {subjects} />

<Modal bind:open={goalOpen} title="Yearly reading goal" size="sm">
  <form onsubmit={saveGoal} class="gf">
    <TextField label="Books to finish this year" bind:value={goalDraft} inputmode="numeric" hint="Set 0 to remove the goal." />
    <button type="submit" hidden aria-hidden="true" tabindex="-1"></button>
  </form>
  {#snippet footer()}<Button variant="ghost" onclick={() => (goalOpen = false)}>Cancel</Button><Button variant="primary" onclick={() => saveGoal()}>Save goal</Button>{/snippet}
</Modal>

<style>
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: var(--space-4); margin-bottom: var(--space-5); }
  .st { padding: var(--space-4) var(--space-5); display: grid; gap: var(--space-2); align-content: start; min-height: 128px; animation: rise .6s var(--ease-glide) both; animation-delay: calc(var(--i) * 70ms); }
  @keyframes rise { from { opacity: 0; transform: translateY(12px); } }
  .lab { display: flex; align-items: center; gap: 6px; font-size: var(--text-xs); font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--text-2); }
  .lab :global(svg) { color: var(--c); }
  .big { font-family: var(--font-display); font-weight: var(--display-weight); font-size: var(--text-3xl); line-height: 1; letter-spacing: var(--display-tracking); }
  .of { font-size: var(--text-md); color: var(--text-2); font-weight: 600; letter-spacing: 0; }
  .sub { font-size: var(--text-sm); color: var(--text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .link { justify-self: start; display: inline-flex; align-items: center; gap: 4px; border: 0; background: none; padding: 2px 0; font-size: var(--text-xs); font-weight: 700; color: var(--accent-ink); cursor: pointer; }
  .link:hover { text-decoration: underline; }
  .bars { display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; height: 38px; align-items: end; }
  .col { display: flex; align-items: flex-end; height: 100%; }
  .col i { display: block; width: 100%; border-radius: 4px 4px 2px 2px; background: linear-gradient(180deg, var(--accent), var(--accent-2)); opacity: .55; transform-origin: bottom; animation: grow .8s var(--ease-glide) both; }
  .col.now i { opacity: 1; box-shadow: 0 0 12px color-mix(in srgb, var(--accent) 50%, transparent); }
  .col i.zero { background: var(--ring-track); opacity: 1; box-shadow: none; }
  @keyframes grow { from { transform: scaleY(0); } }

  .bar { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); flex-wrap: wrap; margin-bottom: var(--space-5); }
  .search { flex: 1; min-width: 200px; max-width: 360px; }

  .shelf { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: var(--space-6) var(--space-5); }
  .shelf li { animation: rise .55s var(--ease-glide) both; animation-delay: calc(var(--i) * 45ms); min-width: 0; }
  .book { width: 100%; display: grid; gap: 6px; text-align: left; border: 0; background: none; color: var(--text); padding: 0; cursor: pointer; font: inherit; }
  .cv { display: block; transition: transform .5s var(--ease-glide), filter .5s var(--ease-glide); transform-origin: 50% 100%; }
  .book:hover .cv, .book:focus-visible .cv { transform: translateY(-6px) rotate(-1.2deg) scale(1.02); }
  .tt { font-weight: 700; font-size: var(--text-sm); line-height: 1.25; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-top: 4px; }
  .au { font-size: var(--text-xs); color: var(--text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pg { display: block; margin-top: 2px; }
  .pn { font-size: var(--text-xs); color: var(--text-2); }
  .gf { display: grid; gap: var(--space-3); }
  @media (max-width: 480px) { .shelf { grid-template-columns: repeat(auto-fill, minmax(124px, 1fr)); gap: var(--space-5) var(--space-4); } }
</style>
