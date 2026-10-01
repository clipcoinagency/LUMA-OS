<script lang="ts">
  // Flashcard review: show the front, reveal the back, rate how well you knew it. The four buttons
  // show when each choice would bring the card back, so the schedule is never a mystery.
  // Keyboard: Space = reveal, 1–4 = Again / Hard / Good / Easy.
  import { PartyPopper, Flame, RotateCcw } from '@lucide/svelte';
  import Modal from '../../../lib/ui/Modal.svelte';
  import Button from '../../../lib/ui/Button.svelte';
  import ProgressBar from '../../../lib/ui/ProgressBar.svelte';
  import EmptyState from '../../../lib/ui/EmptyState.svelte';
  import { clock } from '../../../lib/clock.svelte';
  import { dueCards, previewLabels, RATINGS, reviewCard, studySnapshot, type StudySnap } from '../../../lib/domain/flashcards';
  import type { Card, CardRating } from '../../../lib/db/schema';

  interface Props { open?: boolean; deckId?: string | null; title?: string }
  let { open = $bindable(false), deckId = null, title = 'Review' }: Props = $props();

  let queue = $state.raw<Card[]>([]);
  let idx = $state(0);
  let flipped = $state(false);
  let loading = $state(true);
  let busy = $state(false);
  let tally = $state<Record<CardRating, number>>({ again: 0, hard: 0, good: 0, easy: 0 });
  let requeued = new Set<string>();
  let after = $state.raw<StudySnap | null>(null);

  $effect(() => { if (open) void start(); });
  async function start() {
    loading = true;
    idx = 0; flipped = false; tally = { again: 0, hard: 0, good: 0, easy: 0 }; requeued = new Set(); after = null;
    queue = await dueCards(deckId, clock.today);
    loading = false;
  }

  const current = $derived(queue[idx] ?? null);
  const finished = $derived(!loading && idx >= queue.length);
  const reviewed = $derived(tally.again + tally.hard + tally.good + tally.easy);
  const labels = $derived(current ? previewLabels(current, clock.today) : null);
  const accuracy = $derived(reviewed ? Math.round(((tally.good + tally.easy) / reviewed) * 100) : 0);

  const reveal = () => { if (current) flipped = true; };
  async function rate(r: CardRating) {
    if (!current || !flipped || busy) return;
    busy = true;
    try {
      const updated = await reviewCard(current, r, clock.today);
      tally[r] += 1;
      if (r === 'again' && !requeued.has(current.id)) { requeued.add(current.id); queue = [...queue, updated]; }
      flipped = false;
      idx += 1;
      if (idx >= queue.length) after = await studySnapshot(clock.today);
    } finally { busy = false; }
  }

  function key(e: KeyboardEvent) {
    if (!open || finished || loading || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === ' ') { e.preventDefault(); reveal(); return; }
    const r = RATINGS.find((x) => x.key === e.key);
    if (r && flipped) { e.preventDefault(); void rate(r.id); }
  }
</script>

<svelte:window onkeydown={key} />

<Modal bind:open {title} size="md">
  {#if loading}
    <p class="muted">Getting your cards ready…</p>
  {:else if queue.length === 0}
    <EmptyState title="Nothing due right now" body="You're all caught up. New cards and reviews show up here when they're due.">
      {#snippet icon()}<PartyPopper />{/snippet}
      {#snippet action()}<Button variant="primary" onclick={() => (open = false)}>Close</Button>{/snippet}
    </EmptyState>
  {:else if finished}
    <div class="end" aria-live="polite">
      <span class="trophy" aria-hidden="true"><PartyPopper size={34} /></span>
      <h3>Session complete</h3>
      <p class="lead">You reviewed <strong>{reviewed}</strong> card{reviewed === 1 ? '' : 's'}{#if accuracy}, and recalled <strong>{accuracy}%</strong> of them{/if}.</p>
      <ul class="tally" aria-label="Results">
        {#each RATINGS as r (r.id)}<li class={r.id}><strong class="num">{tally[r.id]}</strong><span>{r.label}</span></li>{/each}
      </ul>
      {#if after}
        <p class="muted">
          {#if after.streak > 0}<Flame size={14} aria-hidden="true" /> {after.streak}-day study streak · {/if}{after.due === 0 ? 'Nothing else due today.' : `${after.due} more card${after.due === 1 ? '' : 's'} due today in other decks.`}
        </p>
      {/if}
      <Button variant="primary" onclick={() => (open = false)}>Done</Button>
    </div>
  {:else if current}
    <div class="hdr">
      <span class="count num">{idx + 1} / {queue.length}</span>
      <div class="pb"><ProgressBar value={idx} max={queue.length} label="Session progress" height={6} /></div>
    </div>

    <div class="stage">
      <div class="flip" class:flipped>
        <div class="face front" aria-hidden={flipped}><span class="tag">Question</span><p>{current.front}</p></div>
        <div class="face back" aria-hidden={!flipped}><span class="tag">Answer</span><p>{current.back}</p></div>
      </div>
    </div>

    {#if !flipped}
      <div class="actions"><Button variant="primary" size="lg" full onclick={reveal}>Show answer <kbd>Space</kbd></Button></div>
    {:else if labels}
      <div class="rate" role="group" aria-label="How well did you know it?">
        {#each RATINGS as r (r.id)}
          <button type="button" class="rb {r.id}" disabled={busy} onclick={() => rate(r.id)} aria-keyshortcuts={r.key}>
            <span class="rl">{r.label}</span><span class="ri">{labels[r.id]}</span><kbd>{r.key}</kbd>
          </button>
        {/each}
      </div>
    {/if}
    <p class="hint muted"><RotateCcw size={12} aria-hidden="true" /> “Again” brings a card back at the end of this session.</p>
  {/if}
</Modal>

<style>
  .hdr { display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-4); }
  .count { font-weight: 700; font-size: var(--text-sm); color: var(--text-2); min-width: 4.5ch; }
  .pb { flex: 1; }
  .stage { perspective: 1200px; margin-bottom: var(--space-5); }
  .flip { position: relative; min-height: 250px; transform-style: preserve-3d; transition: transform .65s var(--ease-glide); }
  .flip.flipped { transform: rotateY(180deg); }
  .face {
    position: absolute; inset: 0; backface-visibility: hidden; -webkit-backface-visibility: hidden; border-radius: var(--radius-xl); padding: var(--space-6);
    display: grid; align-content: center; justify-items: center; text-align: center; gap: var(--space-3); overflow: auto;
    border: 1px solid var(--card-edge); box-shadow: var(--glass-highlight), var(--shadow-2);
  }
  .front { background: radial-gradient(120% 90% at 0% 0%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 60%), var(--surface); }
  .back { transform: rotateY(180deg); background: radial-gradient(120% 90% at 100% 0%, color-mix(in srgb, var(--accent-2) 20%, transparent), transparent 60%), var(--surface-2); }
  .face p { font-family: var(--font-display); font-size: clamp(1.2rem, 3.4vw, 1.7rem); line-height: 1.3; margin: 0; overflow-wrap: anywhere; white-space: pre-wrap; max-width: 34ch; }
  .tag { font-size: var(--text-xs); font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--text-3); }
  .actions kbd, .rb kbd { margin-left: var(--space-2); font: 600 var(--text-xs) var(--font-mono); padding: 2px 6px; border-radius: 6px; background: rgba(127, 127, 127, .2); }
  .rate { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-2); }
  .rb {
    --t: var(--accent); position: relative; display: grid; gap: 2px; justify-items: center; padding: var(--space-3) var(--space-1); min-height: 64px; cursor: pointer;
    border-radius: var(--radius-lg); border: 1px solid color-mix(in srgb, var(--t) 35%, transparent); background: color-mix(in srgb, var(--t) 11%, var(--surface)); color: var(--text);
    transition: transform var(--dur-fast) var(--ease-out), background-color var(--dur) var(--ease-out), box-shadow var(--dur) var(--ease-out);
  }
  .rb:hover { background: color-mix(in srgb, var(--t) 22%, var(--surface)); box-shadow: 0 6px 18px color-mix(in srgb, var(--t) 25%, transparent); transform: translateY(-2px); }
  .rb:active { transform: scale(.96); }
  .rb.again { --t: var(--danger); } .rb.hard { --t: var(--warning); } .rb.good { --t: var(--success); } .rb.easy { --t: var(--info); }
  .rl { font-weight: 700; font-size: var(--text-sm); } .ri { font-size: var(--text-xs); color: var(--text-2); }
  .rb kbd { position: absolute; top: 4px; right: 4px; margin: 0; opacity: .7; }
  .hint { display: flex; align-items: center; gap: 6px; justify-content: center; margin-top: var(--space-4); font-size: var(--text-xs); }
  .end { display: grid; justify-items: center; gap: var(--space-3); text-align: center; padding: var(--space-4) 0; }
  .trophy { width: 72px; height: 72px; border-radius: 50%; display: grid; place-items: center; color: #fff; background: var(--accent-grad); box-shadow: 0 10px 30px color-mix(in srgb, var(--accent) 40%, transparent); animation: pop .7s var(--ease-emphasis) both; }
  @keyframes pop { from { transform: scale(.4); opacity: 0; } }
  .lead { font-size: var(--text-md); }
  .tally { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-2); width: 100%; max-width: 360px; }
  .tally li { display: grid; padding: var(--space-3); border-radius: var(--radius-md); background: var(--surface-2); }
  .tally strong { font-family: var(--font-display); font-size: var(--text-xl); } .tally span { font-size: var(--text-xs); color: var(--text-2); }
  .tally .again strong { color: var(--danger); } .tally .good strong { color: var(--success); } .tally .hard strong { color: var(--warning); } .tally .easy strong { color: var(--info); }
  @media (max-width: 480px) { .rate { grid-template-columns: repeat(2, 1fr); } .flip { min-height: 220px; } }
  @media (prefers-reduced-motion: reduce) { .flip { transition: none; } }
</style>
