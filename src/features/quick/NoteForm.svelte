<script lang="ts">
  import Modal from '../../lib/ui/Modal.svelte';
  import Button from '../../lib/ui/Button.svelte';
  import TextField from '../../lib/ui/TextField.svelte';
  import { toast } from '../../lib/ui/toast.svelte';
  import { put } from '../../lib/db/idb';
  import { bump } from '../../lib/db/changes.svelte';
  import { newId } from '../../lib/util/ids';
  import { nowIso, today } from '../../lib/util/dates';

  let { open = $bindable(false) }: { open?: boolean } = $props();
  let title = $state('');
  let content = $state('');
  let error = $state('');
  let saving = $state(false);

  $effect(() => { if (!open) { title = ''; content = ''; error = ''; } });

  async function save(e?: Event) {
    e?.preventDefault();
    if (!title.trim() && !content.trim()) { error = 'Write something first.'; return; }
    saving = true;
    try {
      const at = nowIso();
      const firstLine = content.trim().split('\n')[0]?.slice(0, 60) ?? '';
      await put('notes', { id: newId('note'), title: title.trim() || firstLine || 'Untitled', content, date: today(), pinned: false, tags: [], createdAt: at, updatedAt: at });
      bump();
      toast('Note saved', { tone: 'success' });
      open = false;
    } finally { saving = false; }
  }
</script>

<Modal bind:open title="New note" size="md">
  <form class="form" onsubmit={save}>
    <TextField label="Title" bind:value={title} placeholder="Untitled" maxlength={120} />
    <TextField label="Note" bind:value={content} multiline rows={8} placeholder="Start writing…" error={error} oninput={() => (error = '')} />
  </form>
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (open = false)}>Cancel</Button>
    <Button variant="primary" loading={saving} onclick={() => save()}>Save note</Button>
  {/snippet}
</Modal>

<style>.form { display: grid; gap: var(--space-4); }</style>
