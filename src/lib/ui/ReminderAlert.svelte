<script lang="ts">
  // Pops up one task reminder at a time from the shared queue (see reminders.svelte.ts). Mounted
  // once, globally, alongside Toaster — a reminder is more important than a toast (it needs a
  // sound and to not silently auto-dismiss), so it gets its own modal instead.
  import { BellRing, Check } from '@lucide/svelte';
  import Modal from './Modal.svelte';
  import Button from './Button.svelte';
  import { dueReminders, clearReminder } from '../reminders.svelte';
  import { setTaskDone, snoozeReminder } from '../domain/tasks';

  const current = $derived(dueReminders[0] ?? null);

  async function markDone() {
    if (!current) return;
    const id = current.id;
    clearReminder(id);
    await setTaskDone(id, true);
  }
  async function snooze() {
    if (!current) return;
    const id = current.id;
    clearReminder(id);
    await snoozeReminder(id, 10);
  }
  function dismiss() {
    if (current) clearReminder(current.id);
  }
</script>

{#if current}
  <Modal open title="Reminder" dismissible={true} onclose={dismiss} size="sm">
    <div class="body">
      <span class="ico" aria-hidden="true"><BellRing size={22} /></span>
      <p class="title">{current.title}</p>
    </div>
    {#snippet footer()}
      <Button variant="ghost" onclick={snooze}>Snooze 10 min</Button>
      <Button variant="ghost" onclick={dismiss}>Dismiss</Button>
      <Button variant="primary" onclick={markDone}>{#snippet icon()}<Check />{/snippet}Mark done</Button>
    {/snippet}
  </Modal>
{/if}

<style>
  .body { display: flex; align-items: center; gap: var(--space-3); }
  .ico { flex: none; width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; background: var(--accent-soft); color: var(--accent-ink); }
  .title { font-weight: 650; font-size: var(--text-md); }
</style>
