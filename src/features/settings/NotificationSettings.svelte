<script lang="ts">
  // Reminders & notifications. Honest about what each device can do: the Android app rings even when
  // closed; browsers only while Life OS is open; iPhone/iPad Safari has no system notifications for
  // web apps without a push server, so reminders stay inside the app there.
  import { BellRing, BellOff, Send } from '@lucide/svelte';
  import Button from '../../lib/ui/Button.svelte';
  import Switch from '../../lib/ui/Switch.svelte';
  import Select from '../../lib/ui/Select.svelte';
  import TimeField from '../../lib/ui/TimeField.svelte';
  import { app } from '../../lib/app.svelte';
  import { toast } from '../../lib/ui/toast.svelte';
  import { notifyChannel, notifyPermission, requestNotifyPermission, showNotification, type NotifyChannel, type NotifyPermission } from '../../lib/notify';
  import { notifyPrefs, replanSoon } from '../../lib/notifications.svelte';
  import { idFor } from '../../lib/domain/notifyPlan';
  import { isIOS } from '../../lib/platform/platform';
  import type { NotifyPrefs } from '../../lib/db/schema';

  let channel = $state<NotifyChannel>('web');
  let perm = $state<NotifyPermission>('default');
  const p = $derived.by(() => { void app.settings; return notifyPrefs(); });
  const habitsOn = $derived(!!app.workspace?.enabledModules.includes('habits'));

  async function refresh() { channel = await notifyChannel(); perm = await notifyPermission(); }
  $effect(() => { void refresh(); });

  async function save(patch: Partial<NotifyPrefs>) {
    await app.updateSettings({ notify: { ...notifyPrefs(), ...patch } });
    replanSoon(300);
  }
  async function setEnabled(v: boolean) {
    if (v && perm !== 'granted') perm = await requestNotifyPermission();
    await save({ enabled: v });
    if (v && perm === 'denied') toast('Notifications are blocked — see the note below to allow them.', { tone: 'danger' });
  }
  async function test() {
    const ok = await showNotification({ key: 'test', title: 'Life OS', body: 'Notifications are working. This is what a reminder looks like.', route: '#/settings' }, idFor('test'));
    if (!ok) toast('Couldn’t show a notification — check the permission note below.', { tone: 'danger' });
  }

  const where = $derived(
    channel === 'native' ? 'Reminders ring at their time even when Life OS is closed — Android schedules them.'
    : channel === 'none' ? (isIOS() ? 'iPhone and iPad don’t let a web app show notifications without an online server, so reminders appear inside Life OS while it’s open.' : 'This browser can’t show system notifications. Reminders still appear inside Life OS while it’s open.')
    : app.platform === 'file' ? 'Reminders ring while Life OS is open on this computer — in front, behind other windows or minimized. Closing the window stops them.'
    : 'Reminders ring while Life OS is open — in front or in the background. Closing it stops them.');
  const blocked = $derived(channel === 'native' ? 'Notifications are turned off for Life OS. Open Android Settings → Apps → Life OS → Notifications and turn them on.'
    : 'Notifications are blocked for Life OS in this browser. Click the icon at the left of the address bar (or open Site settings), allow Notifications, then reload.');
  const leadOpts = [{ value: '0', label: 'When they start' }, { value: '5', label: '5 minutes before' }, { value: '10', label: '10 minutes before' }, { value: '15', label: '15 minutes before' }, { value: '30', label: '30 minutes before' }, { value: '60', label: '1 hour before' }];
</script>

<div class="nset">
  <div class="status" class:on={p.enabled && perm === 'granted'}>
    <span class="si" aria-hidden="true">{#if p.enabled && perm === 'granted'}<BellRing size={18} />{:else}<BellOff size={18} />{/if}</span>
    <p>{where}</p>
  </div>

  {#if channel !== 'none'}
    <Switch label="Notifications" description="Let Life OS remind you — you choose which ones below." checked={p.enabled} onchange={(v) => void setEnabled(v)} />
    {#if perm === 'denied'}<p class="warn" role="status">{blocked}</p>{/if}

    <fieldset disabled={!p.enabled}>
      <legend class="sr-only">Which reminders</legend>
      <Switch label="Task reminders" description="At the time you set on a task with “Remind me”." checked={p.tasks} disabled={!p.enabled} onchange={(v) => void save({ tasks: v })} />
      <div class="pair">
        <Switch label="Upcoming events" description="Meetings, exams and appointments from your calendar." checked={p.events} disabled={!p.enabled} onchange={(v) => void save({ events: v })} />
        {#if p.events}<Select label="When" value={String(p.eventLeadMin)} options={leadOpts} onchange={(v) => void save({ eventLeadMin: Number(v) })} />{/if}
      </div>
      <div class="pair">
        <Switch label="Morning briefing" description="Your day in one sentence — tasks, events and what's overdue." checked={p.morning} disabled={!p.enabled} onchange={(v) => void save({ morning: v })} />
        {#if p.morning}<TimeField label="At" value={p.morningTime} oninput={(v) => { if (v) void save({ morningTime: v }); }} />{/if}
      </div>
      {#if habitsOn}
        <div class="pair">
          <Switch label="Evening habit check-in" description="Only if some of today's habits are still open." checked={p.habits} disabled={!p.enabled} onchange={(v) => void save({ habits: v })} />
          {#if p.habits}<TimeField label="At" value={p.habitTime} oninput={(v) => { if (v) void save({ habitTime: v }); }} />{/if}
        </div>
      {/if}
      <Switch label="Weekly Reset" description="The evening before your week starts, at 6 pm." checked={p.reset} disabled={!p.enabled} onchange={(v) => void save({ reset: v })} />
      <Switch label="Focus finished" description="When a focus session reaches its time." checked={p.focus} disabled={!p.enabled} onchange={(v) => void save({ focus: v })} />
    </fieldset>

    {#if p.enabled && perm === 'granted'}
      <div class="row"><Button size="sm" onclick={() => void test()}>{#snippet icon()}<Send />{/snippet}Send a test notification</Button></div>
    {/if}
  {/if}
</div>

<style>
  .nset { display: grid; gap: var(--space-3); }
  fieldset { border: 0; margin: 0; padding: 0; display: grid; gap: var(--space-2); }
  fieldset:disabled { opacity: .55; }
  .status { display: flex; gap: var(--space-3); align-items: flex-start; padding: var(--space-3); border-radius: var(--radius-md); background: var(--surface-2); color: var(--text-2); font-size: var(--text-sm); }
  .status.on { background: var(--success-soft); color: var(--text); }
  .si { flex: none; color: var(--text-3); margin-top: 1px; }
  .status.on .si { color: var(--success); }
  .warn { font-size: var(--text-sm); color: var(--danger); background: var(--danger-soft); padding: var(--space-3); border-radius: var(--radius-md); }
  .pair { display: grid; gap: var(--space-2); }
  .pair :global(.field) { max-width: 260px; margin: 0 0 var(--space-2); }
  .row { display: flex; gap: var(--space-2); }
</style>
