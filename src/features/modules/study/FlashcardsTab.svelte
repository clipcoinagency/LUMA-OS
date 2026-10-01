<script lang="ts">
  // Study & Read → Flashcards: decks of cards, quick entry (or paste a whole list), and spaced-repetition
  // review. Each review is a dated row, so the streak and "reviewed today" are real counts.
  import { Plus, ArrowLeft, Pencil, Play, Trash2, Flame, Layers, ClipboardPaste, Check, X, Sparkles } from '@lucide/svelte';
  import Button from '../../../lib/ui/Button.svelte';
  import EmptyState from '../../../lib/ui/EmptyState.svelte';
  import ProgressBar from '../../../lib/ui/ProgressBar.svelte';
  import Skeleton from '../../../lib/ui/Skeleton.svelte';
  import Badge from '../../../lib/ui/Badge.svelte';
  import Modal from '../../../lib/ui/Modal.svelte';
  import TextField from '../../../lib/ui/TextField.svelte';
  import CountUp from '../../../lib/ui/CountUp.svelte';
  import { spotlight } from '../../../lib/ui/spotlight';
  import ReviewSession from './ReviewSession.svelte';
  import { toast } from '../../../lib/ui/toast.svelte';
  import { clock } from '../../../lib/clock.svelte';
  import { changes } from '../../../lib/db/changes.svelte';
  import { openQuick } from '../../quick/quick.svelte';
  import { addCards, deleteCard, isDue, isNew, listCards, loadDecks, parseCards, saveCard, studySnapshot, type DeckRow, type StudySnap } from '../../../lib/domain/flashcards';
  import { diffDays } from '../../../lib/util/dates';
  import type { Card } from '../../../lib/db/schema';

  let rows = $state.raw<DeckRow[] | null>(null);
  let snap = $state.raw<StudySnap | null>(null);
  let cards = $state.raw<Card[]>([]);
  let openId = $state<string | null>(null);
  let reviewOpen = $state(false);
  let reviewDeck = $state<string | null>(null);
  let reviewTitle = $state('Review');
  let importOpen = $state(false);
  let importText = $state('');
  let front = $state('');
  let back = $state('');
  let editId = $state<string | null>(null);
  let editFront = $state('');
  let editBack = $state('');

  $effect(() => {
    const v = changes.version;
    const day = clock.today;
    void loadDecks(day).then((r) => { if (v === changes.version) rows = r; });
    void studySnapshot(day).then((s) => { if (v === changes.version) snap = s; });
    if (openId) void listCards(openId).then((c) => { if (v === changes.version) cards = c; });
  });
  $effect(() => { if (openId && rows && !rows.some((r) => r.deck.id === openId)) openId = null; }); // deck was deleted

  const open = $derived(rows?.find((r) => r.deck.id === openId) ?? null);
  const totalDue = $derived(rows?.reduce((n, r) => n + r.due, 0) ?? 0);
  const parsed = $derived(parseCards(importText));

  function review(deckId: string | null, title: string) { reviewDeck = deckId; reviewTitle = title; reviewOpen = true; }

  async function addOne(e: Event) {
    e.preventDefault();
    if (!open || !front.trim() || !back.trim()) return;
    await addCards(open.deck.id, [{ front, back }]);
    front = ''; back = '';
    document.getElementById('card-front')?.focus();
  }
  async function doImport() {
    if (!open || !parsed.length) return;
    const n = await addCards(open.deck.id, parsed);
    importOpen = false; importText = '';
    toast(`Added ${n} card${n === 1 ? '' : 's'}`, { tone: 'success' });
  }
  function startEdit(c: Card) { editId = c.id; editFront = c.front; editBack = c.back; }
  async function saveEdit(c: Card) {
    if (!editFront.trim() || !editBack.trim()) return;
    await saveCard({ ...c, front: editFront, back: editBack });
    editId = null;
  }
  async function remove(c: Card) {
    await deleteCard(c.id);
    toast('Card deleted');
  }
  const dueText = (c: Card) => {
    if (isNew(c)) return { t: 'New', tone: 'accent' as const };
    if (isDue(c, clock.today)) return { t: 'Due', tone: 'warning' as const };
    const n = diffDays(clock.today, c.due);
    return { t: n === 1 ? 'Tomorrow' : `In ${n}d`, tone: 'neutral' as const };
  };
</script>

{#if rows === null}
  <Skeleton lines={4} />
{:else if open}
  {@const d = open.deck}
  <div class="detail" style="--c:{d.color}">
    <button type="button" class="back" onclick={() => (openId = null)}><ArrowLeft size={16} aria-hidden="true" />Decks</button>
    <header class="dh">
      <span class="bar" aria-hidden="true"></span>
      <div class="dt"><h2>{d.title}</h2>{#if d.description}<p class="muted">{d.description}</p>{/if}</div>
      <div class="dacts">
        <Button variant="primary" disabled={open.due === 0} onclick={() => review(d.id, d.title)}>{#snippet icon()}<Play />{/snippet}{open.due ? `Review ${open.due} due` : 'All caught up'}</Button>
        <Button variant="ghost" onclick={() => openQuick('deck', { deck: d })}>{#snippet icon()}<Pencil />{/snippet}Edit</Button>
      </div>
    </header>

    <div class="kpis">
      <div><strong class="num">{open.total}</strong><span>cards</span></div>
      <div><strong class="num">{open.fresh}</strong><span>new</span></div>
      <div><strong class="num">{open.due}</strong><span>due</span></div>
      <div><strong class="num">{open.mastered}</strong><span>mastered</span></div>
    </div>
    {#if open.total}<ProgressBar value={open.mastered} max={open.total} label="Cards mastered" color={d.color} height={8} />{/if}

    <form class="add" onsubmit={addOne} aria-label="Add a card">
      <TextField label="Front" bind:value={front} placeholder="Question or term" maxlength={500} id="card-front" />
      <TextField label="Back" bind:value={back} placeholder="Answer or definition" maxlength={1000} />
      <Button type="submit" variant="primary" disabled={!front.trim() || !back.trim()}>{#snippet icon()}<Plus />{/snippet}Add card</Button>
      <Button variant="ghost" onclick={() => { importText = ''; importOpen = true; }}>{#snippet icon()}<ClipboardPaste />{/snippet}Paste a list</Button>
    </form>

    {#if cards.length === 0}
      <EmptyState compact title="No cards yet" body="Add your first card above, or paste a whole list at once (one “front :: back” per line).">
        {#snippet icon()}<Layers />{/snippet}
      </EmptyState>
    {:else}
      <ul class="cards" aria-label="Cards in this deck">
        {#each cards as c (c.id)}
          {@const st = dueText(c)}
          <li class="crd">
            {#if editId === c.id}
              <div class="edit">
                <TextField label="Front" bind:value={editFront} multiline rows={2} />
                <TextField label="Back" bind:value={editBack} multiline rows={2} />
                <div class="ea"><Button size="sm" variant="primary" onclick={() => saveEdit(c)}>{#snippet icon()}<Check />{/snippet}Save</Button><Button size="sm" variant="ghost" onclick={() => (editId = null)}>{#snippet icon()}<X />{/snippet}Cancel</Button></div>
              </div>
            {:else}
              <div class="txt"><p class="f">{c.front}</p><p class="b">{c.back}</p></div>
              <Badge tone={st.tone}>{st.t}</Badge>
              <div class="cacts">
                <button type="button" aria-label="Edit card: {c.front}" onclick={() => startEdit(c)}><Pencil size={15} /></button>
                <button type="button" aria-label="Delete card: {c.front}" class="del" onclick={() => remove(c)}><Trash2 size={15} /></button>
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </div>
{:else if rows.length === 0}
  <EmptyState title="No flashcard decks yet" body="Make a deck for anything you want to remember — vocabulary, formulas, definitions. Cards come back just when you're about to forget them.">
    {#snippet icon()}<Layers />{/snippet}
    {#snippet action()}<Button variant="primary" onclick={() => openQuick('deck')}>{#snippet icon()}<Plus />{/snippet}Create your first deck</Button>{/snippet}
  </EmptyState>
{:else}
  <section class="hero gcard" style="--c:var(--mod-study)" use:spotlight aria-label="Today's review">
    <div class="hl">
      <span class="ico" aria-hidden="true"><Sparkles size={22} /></span>
      <div>
        <p class="big"><strong class="num"><CountUp value={totalDue} /></strong> card{totalDue === 1 ? '' : 's'} due today</p>
        <p class="muted">
          {#if snap && snap.reviewedToday}Reviewed {snap.reviewedToday} so far · {/if}{#if snap && snap.streak}<Flame size={13} aria-hidden="true" /> {snap.streak}-day streak{:else}A few minutes a day beats cramming.{/if}
        </p>
      </div>
    </div>
    <div class="ha">
      <Button variant="primary" size="lg" disabled={totalDue === 0} onclick={() => review(null, 'Review all due cards')}>{#snippet icon()}<Play />{/snippet}{totalDue ? 'Review all' : 'All caught up'}</Button>
      <Button variant="ghost" onclick={() => openQuick('deck')}>{#snippet icon()}<Plus />{/snippet}New deck</Button>
    </div>
  </section>

  <ul class="decks" aria-label="Flashcard decks">
    {#each rows as r, i (r.deck.id)}
      <li style="--i:{i}">
        <article class="deck gcard lift" style="--c:{r.deck.color}" use:spotlight>
          <button type="button" class="open" onclick={() => (openId = r.deck.id)} aria-label="Open deck {r.deck.title}, {r.total} cards, {r.due} due">
            <span class="chip" aria-hidden="true"><Layers size={16} /></span>
            <span class="dn">{r.deck.title}</span>
            <span class="dm">{r.total} card{r.total === 1 ? '' : 's'}{#if r.fresh} · {r.fresh} new{/if}</span>
          </button>
          {#if r.total}<ProgressBar value={r.mastered} max={r.total} label="{r.deck.title}: cards mastered" color={r.deck.color} height={6} />
            <span class="ms">{r.mastered} mastered</span>{/if}
          <div class="dfoot">
            {#if r.due}<Badge tone="warning">{r.due} due</Badge>{:else}<Badge tone="success">Up to date</Badge>{/if}
            <Button size="sm" variant={r.due ? 'primary' : 'ghost'} disabled={r.due === 0} onclick={() => review(r.deck.id, r.deck.title)} aria-label="Review {r.deck.title}">{#snippet icon()}<Play />{/snippet}Review</Button>
          </div>
        </article>
      </li>
    {/each}
  </ul>
{/if}

<ReviewSession bind:open={reviewOpen} deckId={reviewDeck} title={reviewTitle} />

<Modal bind:open={importOpen} title="Paste a list of cards" size="md">
  <div class="imp">
    <p class="muted">One card per line: <code>front :: back</code> (a tab or <code> | </code> also works).</p>
    <TextField label="Cards" bind:value={importText} multiline rows={8} placeholder={'Capital of France :: Paris\nH2O :: Water\nmitochondria | powerhouse of the cell'} />
    <p class="muted" aria-live="polite">{parsed.length ? `${parsed.length} card${parsed.length === 1 ? '' : 's'} ready to add` : 'Nothing to add yet'}</p>
  </div>
  {#snippet footer()}<Button variant="ghost" onclick={() => (importOpen = false)}>Cancel</Button><Button variant="primary" disabled={!parsed.length} onclick={doImport}>Add {parsed.length || ''} card{parsed.length === 1 ? '' : 's'}</Button>{/snippet}
</Modal>

<style>
  .hero { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); flex-wrap: wrap; padding: var(--space-5) var(--space-6); margin-bottom: var(--space-5); }
  .hl { display: flex; align-items: center; gap: var(--space-4); }
  .ico { width: 48px; height: 48px; border-radius: 16px; display: grid; place-items: center; flex: none; color: var(--on-accent); background: var(--accent-grad); box-shadow: 0 8px 24px color-mix(in srgb, var(--accent) 35%, transparent); }
  :global(:is([data-theme='soft'], [data-theme='light'])) .ico { color: #fff; }
  .big { font-size: var(--text-lg); } .big strong { font-family: var(--font-display); font-size: var(--text-2xl); }
  .hl .muted { display: flex; align-items: center; gap: 4px; font-size: var(--text-sm); }
  .ha { display: flex; gap: var(--space-2); flex-wrap: wrap; }
  .decks { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 250px), 1fr)); gap: var(--space-4); }
  .decks li { animation: rise .55s var(--ease-glide) both; animation-delay: calc(var(--i) * 60ms); }
  @keyframes rise { from { opacity: 0; transform: translateY(12px); } }
  .deck { padding: var(--space-5); display: grid; gap: var(--space-2); height: 100%; align-content: start; }
  .open { display: grid; gap: 4px; text-align: left; border: 0; background: none; padding: 0; color: var(--text); cursor: pointer; font: inherit; }
  .chip { width: 34px; height: 34px; border-radius: 11px; display: grid; place-items: center; color: var(--c); background: linear-gradient(145deg, color-mix(in srgb, var(--c) 30%, transparent), color-mix(in srgb, var(--c) 9%, transparent)); box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 35%, transparent), 0 4px 14px color-mix(in srgb, var(--c) 22%, transparent); margin-bottom: var(--space-2); }
  .dn { font-family: var(--font-display); font-weight: var(--display-weight); font-size: var(--text-lg); line-height: 1.2; }
  .dm, .ms { font-size: var(--text-xs); color: var(--text-2); }
  .dfoot { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); margin-top: var(--space-2); }

  .back { display: inline-flex; align-items: center; gap: 4px; border: 0; background: none; color: var(--text-2); font-weight: 600; cursor: pointer; padding: 6px 0; margin-bottom: var(--space-3); }
  .back:hover { color: var(--text); }
  .dh { display: flex; align-items: center; gap: var(--space-4); flex-wrap: wrap; margin-bottom: var(--space-4); }
  .bar { width: 6px; align-self: stretch; min-height: 44px; border-radius: 6px; background: var(--c); box-shadow: 0 0 16px color-mix(in srgb, var(--c) 50%, transparent); }
  .dt { flex: 1; min-width: 160px; } .dt h2 { font-size: var(--text-2xl); }
  .dacts { display: flex; gap: var(--space-2); flex-wrap: wrap; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-3); margin-bottom: var(--space-3); }
  .kpis div { display: grid; padding: var(--space-3) var(--space-4); border-radius: var(--radius-md); background: var(--surface-2); border: 1px solid var(--border); }
  .kpis strong { font-family: var(--font-display); font-size: var(--text-xl); } .kpis span { font-size: var(--text-xs); color: var(--text-2); }
  .add { display: grid; grid-template-columns: 1fr 1fr auto auto; gap: var(--space-3); align-items: end; margin: var(--space-5) 0; padding: var(--space-4); border-radius: var(--radius-lg); background: var(--surface-2); border: 1px solid var(--border); }
  .cards { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-2); }
  .crd { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3) var(--space-4); border-radius: var(--radius-md); background: var(--surface-2); border: 1px solid var(--border); min-width: 0; }
  .txt { flex: 1; min-width: 0; display: grid; gap: 2px; }
  .f { font-weight: 650; overflow-wrap: anywhere; } .b { color: var(--text-2); font-size: var(--text-sm); overflow-wrap: anywhere; }
  .cacts { display: flex; gap: 2px; }
  .cacts button { border: 0; background: none; color: var(--text-3); padding: 8px; border-radius: 8px; cursor: pointer; }
  .cacts button:hover { background: var(--surface-3); color: var(--text); } .cacts .del:hover { color: var(--danger); background: var(--danger-soft); }
  .edit { flex: 1; display: grid; gap: var(--space-2); } .ea { display: flex; gap: var(--space-2); }
  .imp { display: grid; gap: var(--space-3); }
  code { font-family: var(--font-mono); font-size: .9em; padding: 1px 6px; border-radius: 6px; background: var(--surface-3); }
  @media (max-width: 720px) { .add { grid-template-columns: 1fr; } .kpis { grid-template-columns: repeat(2, 1fr); } }
</style>
