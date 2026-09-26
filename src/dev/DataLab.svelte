<script lang="ts">
  // Phase 1 "Data & backup" lab — exercises the real data layer end to end with production UX:
  // export, validated restore with preview, safety-snapshot undo, guarded reset.
  import { Download, Upload, RotateCcw, Trash2, Database, Sparkles } from '@lucide/svelte';
  import Card from '../lib/ui/Card.svelte';
  import Button from '../lib/ui/Button.svelte';
  import Modal from '../lib/ui/Modal.svelte';
  import ConfirmDialog from '../lib/ui/ConfirmDialog.svelte';
  import ProgressBar from '../lib/ui/ProgressBar.svelte';
  import Badge from '../lib/ui/Badge.svelte';
  import { toast } from '../lib/ui/toast.svelte';
  import { countAll, get } from '../lib/db/idb';
  import { BACKUP_STORES } from '../lib/db/schema';
  import { seedSampleData } from '../lib/db/sample';
  import {
    backupFileName, createBackup, latestSafetySnapshot, markBackupDone, MAX_BACKUP_BYTES, resetWorkspace,
    restoreBackup, serializeBackup, validateBackupText, type Backup, type BackupSummary,
  } from '../lib/backup/backup';
  import { pickTextFile, saveTextFile } from '../lib/platform/platform';
  import { app } from '../lib/app.svelte';

  const LABELS: Record<string, string> = {
    tasks: 'Tasks', goals: 'Goals', goal_progress: 'Goal check-ins', habits: 'Habits', habit_logs: 'Habit check-ins',
    events: 'Events', notes: 'Notes', wellness: 'Wellness days', workouts: 'Workouts', transactions: 'Transactions',
  };

  let counts = $state<Record<string, number>>({});
  let lastBackupAt = $state<string | null>(null);
  let busy = $state<'' | 'export' | 'restore' | 'reset' | 'seed'>('');
  // raw (not deeply reactive): IndexedDB cannot store Svelte's reactive proxies (DataCloneError)
  let pending = $state.raw<{ backup: Backup; summary: BackupSummary } | null>(null);
  let restoreOpen = $state(false);
  let resetOpen = $state(false);
  let canUndo = $state(false);

  const total = $derived(Object.entries(counts).filter(([k]) => k in LABELS).reduce((a, [, v]) => a + v, 0));

  async function refresh() {
    counts = await countAll(BACKUP_STORES);
    lastBackupAt = ((await get('meta', 'lastBackupAt'))?.value as string) ?? null;
    canUndo = !!(await latestSafetySnapshot());
  }
  $effect(() => { void refresh(); });

  async function exportBackup() {
    busy = 'export';
    try {
      const b = await createBackup();
      const res = await saveTextFile(backupFileName(), serializeBackup(b));
      if (res.cancelled) return;
      await markBackupDone();
      toast(`Backup saved to ${res.where}`, { tone: 'success' });
      await refresh();
    } catch (e) {
      console.error('Backup failed', e);
      toast("Couldn't create the backup. Please try again.", { tone: 'danger' });
    } finally { busy = ''; }
  }

  async function chooseBackup() {
    const file = await pickTextFile();
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) { toast('This file is too large to be a Life OS backup.', { tone: 'danger' }); return; }
    const v = validateBackupText(await file.text());
    if (!v.ok) { toast(`${v.reason} Nothing was changed.`, { tone: 'danger', ms: 6000 }); return; }
    pending = { backup: v.backup, summary: v.summary };
    restoreOpen = true;
  }

  async function confirmRestore() {
    if (!pending) return;
    busy = 'restore';
    try {
      await restoreBackup(pending.backup);
      restoreOpen = false;
      pending = null;
      await app.reload();
      await refresh();
      toast('Backup restored', { tone: 'success', action: { label: 'Undo', run: undoLast } });
    } catch (e) {
      console.error('Restore failed', e);
      toast("Restore didn't complete, so nothing was changed. Your data is exactly as before.", { tone: 'danger', ms: 7000 });
    } finally { busy = ''; }
  }

  async function undoLast() {
    const snap = await latestSafetySnapshot();
    if (!snap) return;
    const v = validateBackupText(JSON.stringify(snap.backup));
    if (!v.ok) { toast("The safety copy couldn't be used.", { tone: 'danger' }); return; }
    await restoreBackup(v.backup, { snapshot: false });
    await app.reload();
    await refresh();
    toast('Restored your data from before the last change', { tone: 'success' });
  }

  async function confirmReset() {
    busy = 'reset';
    try {
      await resetWorkspace();
      resetOpen = false;
      await app.reload();
      await refresh();
      toast('Workspace cleared. A safety copy was kept on this device.', { action: { label: 'Undo', run: undoLast } });
    } finally { busy = ''; }
  }

  async function seed() {
    busy = 'seed';
    try {
      const n = await seedSampleData(90);
      await refresh();
      toast(`Added sample history: ${Object.values(n).reduce((a, b) => a + b, 0)} records over 90 days`, { tone: 'success' });
    } finally { busy = ''; }
  }

  const fmt = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
</script>

<div class="grid">
  <Card title="Your data" subtitle="Stored only on this device, in this {app.platform === 'file' ? 'browser' : 'app'}.">
    {#snippet actions()}<Badge tone="accent">{total} records</Badge>{/snippet}
    <ul class="counts">
      {#each Object.keys(LABELS) as k (k)}
        <li><span>{LABELS[k]}</span><span class="num">{counts[k] ?? 0}</span></li>
      {/each}
    </ul>
    <div class="row">
      <Button variant="ghost" size="sm" loading={busy === 'seed'} onclick={seed}>
        {#snippet icon()}<Sparkles />{/snippet}Add 90 days of sample data
      </Button>
    </div>
  </Card>

  <Card title="Backup & restore" subtitle={lastBackupAt ? `Last backup: ${fmt(lastBackupAt)}` : 'No backup yet on this device'}>
    <div class="stack">
      <Button variant="primary" full loading={busy === 'export'} onclick={exportBackup}>
        {#snippet icon()}<Download />{/snippet}Back up now
      </Button>
      <Button full onclick={chooseBackup}>
        {#snippet icon()}<Upload />{/snippet}Restore from a backup file…
      </Button>
      {#if canUndo}
        <Button variant="ghost" full onclick={undoLast}>
          {#snippet icon()}<RotateCcw />{/snippet}Undo last restore / reset
        </Button>
      {/if}
    </div>
    <p class="meta note">Backups include every record, your settings, theme, modules, layout and widgets.</p>
  </Card>

  <Card title="Danger zone">
    <p class="muted">Delete everything and start over. We strongly recommend backing up first.</p>
    <div class="row">
      <Button variant="danger" onclick={() => (resetOpen = true)}>{#snippet icon()}<Trash2 />{/snippet}Delete all data…</Button>
    </div>
  </Card>
</div>

<Modal bind:open={restoreOpen} title="Restore this backup?" size="sm" onclose={() => (pending = null)} dismissible={busy !== 'restore'}>
  {#if pending}
    <div class="summary">
      <Database size={20} aria-hidden="true" />
      <div>
        <p><strong>Backup from {fmt(pending.summary.exportedAt)}</strong></p>
        <p class="meta">Life OS {pending.summary.appVersion} · {pending.summary.totalRecords} records</p>
      </div>
    </div>
    <p class="warn">This will <strong>replace</strong> the {total} records currently on this device. A safety copy of your current data is kept so you can undo.</p>
    {#if busy === 'restore'}<div class="pb"><ProgressBar label="Restoring" /></div>{/if}
  {/if}
  {#snippet footer()}
    <Button variant="ghost" disabled={busy === 'restore'} onclick={() => { restoreOpen = false; pending = null; }}>Cancel</Button>
    <Button variant="ghost" disabled={busy === 'restore'} onclick={exportBackup}>Back up current first</Button>
    <Button variant="primary" loading={busy === 'restore'} onclick={confirmRestore}>Replace my data</Button>
  {/snippet}
</Modal>

<ConfirmDialog bind:open={resetOpen} title="Delete all data?" confirmLabel="Delete everything" typeToConfirm="DELETE" busy={busy === 'reset'}
  message="This removes every task, goal, habit, event, note, wellness entry, transaction and your settings from this device." onconfirm={confirmReset}>
  {#snippet extra()}
    <Button full onclick={exportBackup} loading={busy === 'export'}>{#snippet icon()}<Download />{/snippet}Back up first</Button>
  {/snippet}
</ConfirmDialog>

<style>
  .grid { display: grid; gap: var(--space-4); grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); align-items: start; }
  .counts { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
  .counts li { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed var(--border); font-size: var(--text-sm); }
  .counts li:last-child { border-bottom: 0; }
  .row { margin-top: var(--space-4); display: flex; gap: var(--space-2); flex-wrap: wrap; }
  .stack { display: grid; gap: var(--space-2); }
  .note { margin-top: var(--space-3); }
  .summary { display: flex; gap: var(--space-3); align-items: center; padding: var(--space-3); border-radius: var(--radius-md); background: var(--surface-2); color: var(--text-2); }
  .summary p { color: var(--text); }
  .warn { margin-top: var(--space-4); color: var(--text-2); }
  .pb { margin-top: var(--space-4); }
</style>
