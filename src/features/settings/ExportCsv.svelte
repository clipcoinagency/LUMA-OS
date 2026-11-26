<script lang="ts">
  // New looks: take your own data into a spreadsheet. One CSV per kind of record; nothing is uploaded —
  // the file is made on this device and handed to the system (download, save dialog or share sheet).
  import { FileSpreadsheet } from '@lucide/svelte';
  import Button from '../../lib/ui/Button.svelte';
  import { app } from '../../lib/app.svelte';
  import { toast } from '../../lib/ui/toast.svelte';
  import { buildExport, EXPORTS, type ExportKind } from '../../lib/domain/exportCsv';
  import { CSV_FILE, saveTextFile } from '../../lib/platform/platform';

  let busy = $state<ExportKind | null>(null);
  const shown = $derived(EXPORTS.filter((e) => e.module === null || app.workspace?.enabledModules.includes(e.module as never)));

  async function run(kind: ExportKind) {
    if (busy) return;
    busy = kind;
    try {
      const f = await buildExport(kind);
      if (f.rows === 0) { toast('Nothing to export yet — there are no records of that kind.'); return; }
      const res = await saveTextFile(f.name, f.text, CSV_FILE);
      if (res.ok) toast(`Saved ${f.rows.toLocaleString()} row${f.rows === 1 ? '' : 's'} to ${res.where ?? 'your device'}`);
      else if (!res.cancelled) toast('Could not save the file.', { tone: 'danger' });
    } catch {
      toast('Could not make the file.', { tone: 'danger' });
    } finally { busy = null; }
  }
</script>

<div class="ex">
  <p class="lead"><FileSpreadsheet size={18} aria-hidden="true" /><span>Open your data in Excel, Numbers or Google Sheets. Each file is made on this device.</span></p>
  <ul>
    {#each shown as e (e.id)}
      <li>
        <span class="t"><b>{e.label}</b><span>{e.hint}</span></span>
        <Button size="sm" loading={busy === e.id} onclick={() => void run(e.id)}>Export .csv</Button>
      </li>
    {/each}
  </ul>
</div>

<style>
  .ex { display: grid; gap: var(--space-3); }
  .lead { display: flex; gap: var(--space-3); align-items: flex-start; font-size: var(--text-sm); color: var(--text-2); }
  .lead :global(svg) { flex: none; color: var(--accent-ink); margin-top: 1px; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; }
  li { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); padding: var(--space-3) 0; border-top: 1px solid var(--border); }
  li:first-child { border-top: 0; }
  .t { display: grid; gap: 2px; min-width: 0; }
  .t b { font-weight: 650; }
  .t span { font-size: var(--text-xs); color: var(--text-2); }
</style>
