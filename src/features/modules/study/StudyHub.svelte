<script lang="ts">
  // Study & Read: one place for everything learning-related — Subjects (classes, assignments, exams),
  // Library (books, articles, papers, courses) and Flashcards (spaced repetition). The same area works
  // for a student, a lifelong learner or someone who simply reads: switch tabs, ignore what you don't use.
  import { Plus } from '@lucide/svelte';
  import PageHeader from '../PageHeader.svelte';
  import Button from '../../../lib/ui/Button.svelte';
  import Segmented from '../../../lib/ui/Segmented.svelte';
  import ProjectsPage from '../projects/ProjectsPage.svelte';
  import LibraryTab from './LibraryTab.svelte';
  import FlashcardsTab from './FlashcardsTab.svelte';
  import { openQuick } from '../../quick/quick.svelte';

  const TABS = ['library', 'subjects', 'flashcards'] as const;
  type Tab = (typeof TABS)[number];
  const KEY = 'lifeos.studyTab';
  const saved = (() => { try { const v = localStorage.getItem(KEY); return TABS.includes(v as Tab) ? (v as Tab) : 'subjects'; } catch { return 'subjects' as Tab; } })();
  let tab = $state<string>(saved);
  $effect(() => { try { localStorage.setItem(KEY, tab); } catch { /* private mode: the tab just isn't remembered */ } });

  const sub = $derived(tab === 'library' ? 'Books, articles, papers and courses — with progress, highlights and a reading streak.'
    : tab === 'flashcards' ? 'Decks that bring each card back just before you forget it.'
    : 'Classes, assignments, exams and study time.');
</script>

<PageHeader module="study" subtitle={sub}>
  {#snippet actions()}
    {#if tab === 'library'}<Button variant="primary" onclick={() => openQuick('book', { status: 'reading' })}>{#snippet icon()}<Plus />{/snippet}Add book</Button>
    {:else if tab === 'flashcards'}<Button variant="primary" onclick={() => openQuick('deck')}>{#snippet icon()}<Plus />{/snippet}New deck</Button>
    {:else}<Button variant="primary" onclick={() => openQuick('project', { kind: 'study' })}>{#snippet icon()}<Plus />{/snippet}New subject</Button>{/if}
  {/snippet}
</PageHeader>

<div class="tabs">
  <Segmented label="Study and read sections" bind:value={tab} options={[{ value: 'subjects', label: 'Subjects' }, { value: 'library', label: 'Library' }, { value: 'flashcards', label: 'Flashcards' }]} />
</div>

{#key tab}
  <div class="pane">
    {#if tab === 'library'}<LibraryTab />
    {:else if tab === 'flashcards'}<FlashcardsTab />
    {:else}<ProjectsPage kind="study" embedded />{/if}
  </div>
{/key}

<style>
  .tabs { margin-bottom: var(--space-5); }
  .pane { animation: in .35s var(--ease-glide); }
  @keyframes in { from { opacity: 0; transform: translateY(8px); } }
</style>
