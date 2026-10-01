<script lang="ts">
  // Everything chosen in onboarding stays editable here, applied instantly.
  import { Download, Upload, RotateCcw, Trash2, ShieldCheck, Eraser, Smartphone, Share } from '@lucide/svelte';
  import { pwa } from '../../lib/pwa.svelte';
  import Card from '../../lib/ui/Card.svelte';
  import Button from '../../lib/ui/Button.svelte';
  import TextField from '../../lib/ui/TextField.svelte';
  import Select from '../../lib/ui/Select.svelte';
  import Switch from '../../lib/ui/Switch.svelte';
  import Segmented from '../../lib/ui/Segmented.svelte';
  import ReorderList from '../../lib/ui/ReorderList.svelte';
  import ConfirmDialog from '../../lib/ui/ConfirmDialog.svelte';
  import ModulePicker from '../workspace/ModulePicker.svelte';
  import ThemePicker from '../workspace/ThemePicker.svelte';
  import LayoutPicker from '../workspace/LayoutPicker.svelte';
  import RestoreFlow from './RestoreFlow.svelte';
  import { backUpNow, lastBackupAt, undoLastChange } from './backupActions';
  import { toast } from '../../lib/ui/toast.svelte';
  import { app } from '../../lib/app.svelte';
  import { MODULES, WIDGETS } from '../../lib/modules';
  import CurrencyPicker from '../../lib/ui/CurrencyPicker.svelte';
  import { withEnabledModules, widgetChoices } from '../../lib/workspace';
  import { latestSafetySnapshot, resetModule, resetWorkspace } from '../../lib/backup/backup';
  import { APP_VERSION } from '../../lib/db/defaults';
  import { SCHEMA_VERSION, type ModuleId, type WidgetId } from '../../lib/db/schema';

  const s = $derived(app.settings!);
  const w = $derived(app.workspace!);

  let name = $state(app.settings?.displayName ?? '');
  let nameTimer: ReturnType<typeof setTimeout>;
  function saveName(v: string) {
    clearTimeout(nameTimer);
    nameTimer = setTimeout(() => void app.updateSettings({ displayName: v.trim() }), 400);
  }


  const moduleItems = $derived(w.moduleOrder.filter((m) => w.enabledModules.includes(m)).map((m) => ({ id: m, label: MODULES[m].name, color: MODULES[m].color })));
  const moduleIcons = Object.fromEntries(Object.values(MODULES).map((m) => [m.id, m.icon]));
  const widgetItems = $derived(widgetChoices(w).map((id) => ({ id, label: WIDGETS[id].name, description: WIDGETS[id].description })));

  function setModules(next: ModuleId[]) { void app.updateWorkspace(withEnabledModules(w, next)); }
  function reorderWidgets(ids: string[]) { void app.updateWorkspace({ widgets: ids.filter((id) => w.widgets.includes(id as WidgetId)) as WidgetId[] }); }
  function toggleWidget(id: string, on: boolean) {
    const enabled = new Set(w.widgets);
    if (on) enabled.add(id as WidgetId); else enabled.delete(id as WidgetId);
    void app.updateWorkspace({ widgets: widgetChoices(w).filter((x) => enabled.has(x)) });
  }

  // data
  let restoring = $state(false);
  let lastBackup = $state<string | null>(null);
  let canUndo = $state(false);
  let resetAllOpen = $state(false);
  let resetModuleOpen = $state(false);
  let moduleToReset = $state<string>('tasks');
  let busy = $state(false);
  async function refreshData() {
    lastBackup = await lastBackupAt();
    canUndo = !!(await latestSafetySnapshot());
  }
  $effect(() => { void refreshData(); });

  async function doBackup() { if (await backUpNow()) await refreshData(); }
  async function doUndo() { await undoLastChange(); await refreshData(); }
  async function doResetModule() {
    busy = true;
    try {
      await resetModule(moduleToReset as ModuleId);
      resetModuleOpen = false;
      toast(`${MODULES[moduleToReset as ModuleId].name} data deleted`, { action: { label: 'Undo', run: () => void doUndo() } });
      await refreshData();
    } finally { busy = false; }
  }
  async function doResetAll() {
    busy = true;
    try {
      await resetWorkspace();
      resetAllOpen = false;
      await app.reload(); // back to first-run → onboarding
      toast('Everything was deleted. A safety copy is kept on this device.', { action: { label: 'Undo', run: () => void doUndo() } });
    } finally { busy = false; }
  }

  const fmt = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  const where = $derived(
    app.platform === 'file' ? 'in this web browser on this computer. Use the same browser each time, and keep backups: clearing your browser’s site data would delete it.'
    : app.platform === 'web' ? 'in this browser on this device. Keep backups — clearing site data or uninstalling would delete it.'
    : 'inside the Life OS app on this device. Uninstalling the app deletes it, so keep backups.');
</script>

<div class="settings">
  <header class="head">
    <h1>Settings</h1>
    <p class="muted">Changes save automatically.</p>
  </header>

  <Card title="Profile">
    <TextField label="Your name" bind:value={name} oninput={saveName} maxlength={40} placeholder="Your first name" hint="Used for your greeting." />
  </Card>

  <Card title="Appearance">
    <ThemePicker value={s.theme} onchange={(t) => app.updateSettings({ theme: t })} />
    <div class="gap"><Switch label="Reduce motion" description="Minimise animations throughout Life OS." checked={s.reduceMotion} onchange={(v) => app.updateSettings({ reduceMotion: v })} /></div>
  </Card>

  <Card title="Modules" subtitle="Turn areas on or off. Turning a module off hides it — your data is kept.">
    <ModulePicker selected={w.enabledModules} onchange={setModules} />
    <h3 class="sub">Order in navigation</h3>
    <ReorderList label="Module order" items={moduleItems} icons={moduleIcons} onreorder={(ids) => app.updateWorkspace({ moduleOrder: ids as ModuleId[] })} />
  </Card>

  <Card title="Dashboard">
    <LayoutPicker value={w.dashboardLayout} onchange={(v) => app.updateWorkspace({ dashboardLayout: v })} />
    <h3 class="sub">Widgets</h3>
    <ReorderList label="Dashboard widgets" items={widgetItems} enabled={w.widgets} onreorder={reorderWidgets} ontoggle={toggleWidget} />
  </Card>

  <Card title="Preferences">
    <div class="form">
      {#if w.enabledModules.includes('finance')}
        <CurrencyPicker label="Currency" value={s.currency} onchange={(v) => app.updateSettings({ currency: v })} hint="Used for new transactions. Existing ones keep their currency." />
      {/if}
      <div class="field">
        <span class="flabel">Week starts on</span>
        <Segmented label="Week starts on" value={String(s.weekStartsOn)} options={[{ value: '1', label: 'Monday' }, { value: '0', label: 'Sunday' }]} onchange={(v) => app.updateSettings({ weekStartsOn: v === '0' ? 0 : 1 })} />
      </div>
      {#if w.enabledModules.includes('wellness')}
        <div class="two">
          <Select label="Weight unit" value={s.units.weight} options={[{ value: 'kg', label: 'Kilograms (kg)' }, { value: 'lb', label: 'Pounds (lb)' }]} onchange={(v) => app.updateSettings({ units: { ...s.units, weight: v as 'kg' | 'lb' } })} />
          <Select label="Water unit" value={s.units.water} options={[{ value: 'glasses', label: 'Glasses' }, { value: 'ml', label: 'Millilitres (ml)' }, { value: 'oz', label: 'Fluid ounces (oz)' }]} onchange={(v) => app.updateSettings({ units: { ...s.units, water: v as 'ml' | 'oz' | 'glasses' } })} />
        </div>
      {/if}
      <Select label="Daily focus goal" value={String(s.focusTargetMin ?? 120)} options={[{ value: '30', label: '30 minutes' }, { value: '60', label: '1 hour' }, { value: '90', label: '1½ hours' }, { value: '120', label: '2 hours' }, { value: '180', label: '3 hours' }, { value: '240', label: '4 hours' }]} onchange={(v) => app.updateSettings({ focusTargetMin: Number(v) })} hint="Shown as the Focus arc on Home." />
      <Select label="Backup reminder" value={String(s.backupReminderDays)} options={[{ value: '7', label: 'Every week' }, { value: '14', label: 'Every 2 weeks' }, { value: '30', label: 'Every month' }, { value: '0', label: 'Never remind me' }]} onchange={(v) => app.updateSettings({ backupReminderDays: Number(v) })} />
    </div>
  </Card>

  {#if pwa.hosted && !pwa.installed && (pwa.canInstall || pwa.iosHint)}
    <Card title="Install Life OS" subtitle="Put it on your home screen or desktop and it opens like a real app — full screen, fully offline.">
      {#if pwa.canInstall}
        <Button variant="primary" onclick={() => void pwa.install()}>{#snippet icon()}<Smartphone />{/snippet}Install app</Button>
      {:else}
        <p class="privacy"><Share size={18} aria-hidden="true" /><span>In Safari, tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.</span></p>
      {/if}
    </Card>
  {/if}

  <Card title="Data & backup" subtitle={lastBackup ? `Last backup: ${fmt(lastBackup)}` : 'You have not made a backup on this device yet.'}>
    <p class="privacy"><ShieldCheck size={18} aria-hidden="true" /><span>Your data stays on your device. It is stored {where}</span></p>
    <div class="actions">
      <Button variant="primary" onclick={doBackup}>{#snippet icon()}<Download />{/snippet}Back up now</Button>
      <Button onclick={() => (restoring = true)}>{#snippet icon()}<Upload />{/snippet}Restore from backup…</Button>
      {#if canUndo}<Button variant="ghost" onclick={doUndo}>{#snippet icon()}<RotateCcw />{/snippet}Undo last restore / delete</Button>{/if}
    </div>
    <div class="danger">
      <h3 class="sub">Danger zone</h3>
      <div class="actions">
        <Button onclick={() => (resetModuleOpen = true)}>{#snippet icon()}<Eraser />{/snippet}Clear one module…</Button>
        <Button variant="danger" onclick={() => (resetAllOpen = true)}>{#snippet icon()}<Trash2 />{/snippet}Delete everything…</Button>
      </div>
    </div>
  </Card>

  <Card title="About">
    <dl class="about">
      <dt>Version</dt><dd>Life OS {APP_VERSION} (data v{SCHEMA_VERSION})</dd>
      <dt>Running as</dt><dd>{app.platform === 'file' ? 'Browser edition' : app.platform === 'web' ? 'Web app' : app.platform === 'tauri' ? 'Desktop app' : 'Android app'}</dd>
      <dt>Privacy</dt><dd>No accounts, no tracking, no internet needed.</dd>
    </dl>
  </Card>
</div>

<RestoreFlow bind:open={restoring} ondone={refreshData} />

<ConfirmDialog bind:open={resetModuleOpen} title="Clear one module?" confirmLabel="Delete module data" busy={busy}
  message="This deletes all records in the chosen module (settings stay). A safety copy is kept so you can undo." onconfirm={doResetModule}>
  {#snippet extra()}
    <Select label="Module" bind:value={moduleToReset} options={Object.values(MODULES).map((m) => ({ value: m.id, label: m.name }))} />
  {/snippet}
</ConfirmDialog>

<ConfirmDialog bind:open={resetAllOpen} title="Delete everything?" confirmLabel="Delete everything" typeToConfirm="DELETE" busy={busy}
  message="This removes every task, goal, habit, event, note, wellness entry, transaction and all your settings from this device, and returns Life OS to first-time setup." onconfirm={doResetAll}>
  {#snippet extra()}
    <Button full onclick={doBackup}>{#snippet icon()}<Download />{/snippet}Back up first (recommended)</Button>
  {/snippet}
</ConfirmDialog>

<style>
  .settings { display: grid; gap: var(--space-4); max-width: 760px; }
  .head { display: grid; gap: var(--space-1); margin-bottom: var(--space-2); }
  .sub { font-family: var(--font-body); font-size: var(--text-sm); font-weight: 700; letter-spacing: 0; color: var(--text-2); margin: var(--space-6) 0 var(--space-3); }
  .gap { margin-top: var(--space-4); }
  .form { display: grid; gap: var(--space-5); }
  .field { display: grid; gap: 6px; }
  .flabel { font-size: var(--text-sm); font-weight: 600; color: var(--text-2); }
  .two { display: grid; gap: var(--space-4); grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
  .privacy { display: flex; gap: var(--space-2); align-items: flex-start; color: var(--text-2); padding: var(--space-3); border-radius: var(--radius-md); background: var(--surface-2); margin-bottom: var(--space-4); }
  .privacy :global(svg) { flex: none; margin-top: 2px; color: var(--success); }
  .actions { display: flex; flex-wrap: wrap; gap: var(--space-2); }
  .danger { border-top: 1px solid var(--border); margin-top: var(--space-5); }
  .about { display: grid; grid-template-columns: max-content 1fr; gap: var(--space-2) var(--space-5); margin: 0; }
  .about dt { color: var(--text-2); }
  .about dd { margin: 0; }
</style>
