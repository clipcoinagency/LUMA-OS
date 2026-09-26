<script lang="ts">
  // Restore a backup: pick → validate → preview (+ replace warning) → safety copy → atomic restore.
  // Set `open = true` to start; the file picker opens immediately.
  import { Database } from '@lucide/svelte';
  import Modal from '../../lib/ui/Modal.svelte';
  import Button from '../../lib/ui/Button.svelte';
  import ProgressBar from '../../lib/ui/ProgressBar.svelte';
  import { toast } from '../../lib/ui/toast.svelte';
  import { countAll } from '../../lib/db/idb';
  import { BACKUP_STORES, CONFIG_STORES } from '../../lib/db/schema';
  import { MAX_BACKUP_BYTES, restoreBackup, validateBackupText, type Backup, type BackupSummary } from '../../lib/backup/backup';
  import { pickTextFile } from '../../lib/platform/platform';
  import { app } from '../../lib/app.svelte';
  import { undoLastChange } from './backupActions';

  interface Props { open?: boolean; ondone?: () => void }
  let { open = $bindable(false), ondone }: Props = $props();

  // raw (not deeply reactive): IndexedDB cannot store Svelte's reactive proxies
  let pending = $state.raw<{ backup: Backup; summary: BackupSummary } | null>(null);
  let current = $state(0);
  let busy = $state(false);
  let modal = $state(false);

  $effect(() => {
    if (open && !modal && !busy) void begin();
  });

  async function begin() {
    const file = await pickTextFile();
    if (!file) { open = false; return; }
    if (file.size > MAX_BACKUP_BYTES) { fail('This file is too large to be a Life OS backup.'); return; }
    const v = validateBackupText(await file.text());
    if (!v.ok) { fail(v.reason); return; }
    const counts = await countAll(BACKUP_STORES);
    current = Object.entries(counts).filter(([k]) => !CONFIG_STORES.includes(k as never)).reduce((a, [, n]) => a + n, 0);
    pending = { backup: v.backup, summary: v.summary };
    modal = true;
  }

  function fail(reason: string) {
    toast(`${reason} Nothing was changed.`, { tone: 'danger', ms: 7000 });
    open = false;
  }

  function close() {
    modal = false;
    pending = null;
    open = false;
  }

  async function confirm() {
    if (!pending) return;
    busy = true;
    try {
      await restoreBackup(pending.backup);
      close();
      await app.reload();
      toast('Backup restored', { tone: 'success', action: { label: 'Undo', run: () => void undoLastChange() } });
      ondone?.();
    } catch (e) {
      console.error('Restore failed', e);
      toast("Restore didn't complete, so nothing was changed. Your data is exactly as before.", { tone: 'danger', ms: 7000 });
    } finally {
      busy = false;
    }
  }

  const fmt = (iso: string) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'unknown date');
</script>

<Modal bind:open={modal} title="Restore this backup?" size="sm" dismissible={!busy} onclose={close}>
  {#if pending}
    <div class="summary">
      <Database size={20} aria-hidden="true" />
      <div>
        <p><strong>Backup from {fmt(pending.summary.exportedAt)}</strong></p>
        <p class="meta">Life OS {pending.summary.appVersion} · {pending.summary.totalRecords} records</p>
      </div>
    </div>
    {#if current > 0}
      <p class="warn">This will <strong>replace</strong> the {current} records currently on this device. A safety copy of your current data is kept so you can undo.</p>
    {:else}
      <p class="warn">Your workspace, settings and history will be restored exactly as they were.</p>
    {/if}
    {#if busy}<div class="pb"><ProgressBar label="Restoring" /></div>{/if}
  {/if}
  {#snippet footer()}
    <Button variant="ghost" disabled={busy} onclick={close}>Cancel</Button>
    <Button variant="primary" loading={busy} onclick={confirm}>{current > 0 ? 'Replace my data' : 'Restore'}</Button>
  {/snippet}
</Modal>

<style>
  .summary { display: flex; gap: var(--space-3); align-items: center; padding: var(--space-3); border-radius: var(--radius-md); background: var(--surface-2); color: var(--text-2); }
  .summary p { color: var(--text); }
  .summary .meta { color: var(--text-3); }
  .warn { margin-top: var(--space-4); color: var(--text-2); }
  .pb { margin-top: var(--space-4); }
</style>
