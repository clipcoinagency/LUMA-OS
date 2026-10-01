<script lang="ts">
  // Create or edit a flashcard deck.
  import { Trash2 } from '@lucide/svelte';
  import Modal from '../../lib/ui/Modal.svelte';
  import Button from '../../lib/ui/Button.svelte';
  import TextField from '../../lib/ui/TextField.svelte';
  import Select from '../../lib/ui/Select.svelte';
  import ConfirmDialog from '../../lib/ui/ConfirmDialog.svelte';
  import { toast } from '../../lib/ui/toast.svelte';
  import { DECK_COLORS, deleteDeck, saveDeck } from '../../lib/domain/flashcards';
  import { listProjects } from '../../lib/domain/projects';
  import type { Deck, Project } from '../../lib/db/schema';

  let { open = $bindable(false), deck = null, onsaved }: { open?: boolean; deck?: Deck | null; onsaved?: (d: Deck) => void } = $props();

  let title = $state('');
  let description = $state('');
  let subjectId = $state('');
  let color = $state(DECK_COLORS[0]!);
  let error = $state('');
  let saving = $state(false);
  let confirmDelete = $state(false);
  let subjects = $state<Project[]>([]);

  $effect(() => {
    if (!open) return;
    error = '';
    if (deck) { title = deck.title; description = deck.description; subjectId = deck.subjectId ?? ''; color = deck.color; }
    else { title = ''; description = ''; subjectId = ''; color = DECK_COLORS[Math.floor(Math.random() * DECK_COLORS.length)]!; }
    void listProjects('study').then((p) => { subjects = p.filter((x) => x.status === 'active' || x.id === deck?.subjectId); });
  });

  async function save(e?: Event) {
    e?.preventDefault();
    if (!title.trim()) { error = 'Give your deck a name.'; return; }
    saving = true;
    try {
      const d = await saveDeck({ ...(deck ? { id: deck.id } : {}), title, description: description.trim(), subjectId: subjectId || null, color });
      toast(deck ? 'Deck updated' : `Deck “${d.title}” created`, { tone: 'success' });
      open = false;
      onsaved?.(d);
    } finally { saving = false; }
  }
  async function del() {
    confirmDelete = false;
    if (!deck) return;
    await deleteDeck(deck.id);
    open = false;
    toast(`Deleted “${deck.title}” and its cards`);
  }
</script>

<Modal bind:open title={deck ? 'Edit deck' : 'New flashcard deck'} size="sm">
  <form class="form" onsubmit={save}>
    <TextField label="Deck name" bind:value={title} placeholder="e.g. Cell biology" maxlength={80} {error} oninput={() => (error = '')} />
    <TextField label="Description (optional)" bind:value={description} maxlength={200} />
    {#if subjects.length}
      <Select label="Part of a subject (optional)" bind:value={subjectId} options={[{ value: '', label: 'None' }, ...subjects.map((s) => ({ value: s.id, label: s.title }))]} />
    {/if}
    <div class="field"><span class="lbl">Colour</span>
      <div class="swatches" role="radiogroup" aria-label="Deck colour">
        {#each DECK_COLORS as c (c)}<button type="button" role="radio" aria-checked={color === c} aria-label={c} class:on={color === c} style="--c:{c}" onclick={() => (color = c)}></button>{/each}
      </div>
    </div>
    <button type="submit" hidden aria-hidden="true" tabindex="-1"></button>
  </form>
  {#snippet footer()}
    {#if deck}<span class="left"><Button variant="ghost" onclick={() => (confirmDelete = true)}>{#snippet icon()}<Trash2 />{/snippet}Delete</Button></span>{/if}
    <Button variant="ghost" onclick={() => (open = false)}>Cancel</Button>
    <Button variant="primary" loading={saving} onclick={() => save()}>{deck ? 'Save' : 'Create deck'}</Button>
  {/snippet}
</Modal>

<ConfirmDialog bind:open={confirmDelete} title="Delete this deck?" message={`“${deck?.title ?? ''}” and all of its cards will be removed.`} confirmLabel="Delete deck" onconfirm={del} />

<style>
  .form { display: grid; gap: var(--space-4); }
  .field { display: grid; gap: 6px; }
  .lbl { font-size: var(--text-sm); font-weight: 600; color: var(--text-2); }
  .swatches { display: flex; flex-wrap: wrap; gap: 10px; }
  .swatches button { width: 32px; height: 32px; border-radius: 50%; border: 2px solid transparent; background: var(--c); cursor: pointer; transition: transform var(--dur-fast) var(--ease-out), box-shadow var(--dur) var(--ease-out); }
  .swatches button:hover { transform: scale(1.1); }
  .swatches button.on { box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--c); }
  .left { margin-right: auto; }
  .left :global(.btn) { color: var(--danger); }
</style>
