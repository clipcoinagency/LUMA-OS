<script lang="ts">
  // Quick capture for a note or a journal entry (a dated note with a mood).
  import Modal from '../../lib/ui/Modal.svelte';
  import Button from '../../lib/ui/Button.svelte';
  import TextField from '../../lib/ui/TextField.svelte';
  import { toast } from '../../lib/ui/toast.svelte';
  import { put } from '../../lib/db/idb';
  import { bump } from '../../lib/db/changes.svelte';
  import { MOODS } from '../../lib/moods';
  import { newId } from '../../lib/util/ids';
  import { nowIso, today } from '../../lib/util/dates';

  let { open = $bindable(false), kind = 'note' }: { open?: boolean; kind?: string } = $props();
  const journal = $derived(kind === 'journal');
  let title = $state('');
  let content = $state('');
  let mood = $state<1 | 2 | 3 | 4 | 5 | null>(null);
  let error = $state('');
  let saving = $state(false);

  $effect(() => { if (!open) { title = ''; content = ''; mood = null; error = ''; } });

  async function save(e?: Event) {
    e?.preventDefault();
    if (!title.trim() && !content.trim() && !mood) { error = 'Write something first.'; return; }
    saving = true;
    try {
      const at = nowIso();
      const firstLine = content.trim().split('\n')[0]?.slice(0, 60) ?? '';
      await put('notes', {
        id: newId('note'), title: title.trim() || firstLine || (journal ? 'Journal entry' : 'Untitled'), content, date: today(), pinned: false, tags: [],
        kind: journal ? 'journal' : 'note', mood: journal ? mood : null, projectId: null, createdAt: at, updatedAt: at,
      });
      bump();
      toast(journal ? 'Journal entry saved' : 'Note saved', { tone: 'success' });
      open = false;
    } finally { saving = false; }
  }
</script>

<Modal bind:open title={journal ? 'New journal entry' : 'New note'} size="md">
  <form class="form" onsubmit={save}>
    {#if journal}
      <div class="moods" role="radiogroup" aria-label="How are you feeling?">
        <span class="lbl">How are you feeling?</span>
        <div class="row">
          {#each MOODS as m (m.value)}
            <button type="button" role="radio" aria-checked={mood === m.value} class:on={mood === m.value} style="--c:{m.color}" onclick={() => (mood = mood === m.value ? null : m.value)} aria-label={m.label} title={m.label}><m.icon size={22} /></button>
          {/each}
        </div>
      </div>
    {/if}
    <TextField label="Title" bind:value={title} placeholder={journal ? 'Optional' : 'Untitled'} maxlength={120} />
    <TextField label={journal ? 'Today' : 'Note'} bind:value={content} multiline rows={8} placeholder={journal ? 'How was your day? What is on your mind?' : 'Start writing…'} error={error} oninput={() => (error = '')} />
  </form>
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (open = false)}>Cancel</Button>
    <Button variant="primary" loading={saving} onclick={() => save()}>{journal ? 'Save entry' : 'Save note'}</Button>
  {/snippet}
</Modal>

<style>
  .form { display: grid; gap: var(--space-4); }
  .lbl { font-size: var(--text-sm); font-weight: 600; color: var(--text-2); }
  .moods { display: grid; gap: 8px; } .row { display: flex; gap: 10px; }
  .row button { width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center; cursor: pointer; border: 1.5px solid var(--border-strong); background: var(--surface); color: var(--c); transition: all var(--dur) var(--ease-emphasis); }
  .row button:hover { transform: scale(1.08); }
  .row button.on { background: color-mix(in srgb, var(--c) 18%, var(--surface)); border-color: var(--c); transform: scale(1.12); }
</style>
