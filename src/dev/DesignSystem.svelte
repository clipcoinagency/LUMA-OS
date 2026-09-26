<script lang="ts">
  // Living design-system reference: every component, every state, in the current theme.
  import { Plus, Target, Inbox, Bell } from '@lucide/svelte';
  import Card from '../lib/ui/Card.svelte';
  import Button from '../lib/ui/Button.svelte';
  import IconButton from '../lib/ui/IconButton.svelte';
  import TextField from '../lib/ui/TextField.svelte';
  import Select from '../lib/ui/Select.svelte';
  import Switch from '../lib/ui/Switch.svelte';
  import Checkbox from '../lib/ui/Checkbox.svelte';
  import Segmented from '../lib/ui/Segmented.svelte';
  import Badge from '../lib/ui/Badge.svelte';
  import ProgressRing from '../lib/ui/ProgressRing.svelte';
  import ProgressBar from '../lib/ui/ProgressBar.svelte';
  import BarChart from '../lib/ui/BarChart.svelte';
  import Sparkline from '../lib/ui/Sparkline.svelte';
  import EmptyState from '../lib/ui/EmptyState.svelte';
  import ErrorState from '../lib/ui/ErrorState.svelte';
  import Skeleton from '../lib/ui/Skeleton.svelte';
  import Modal from '../lib/ui/Modal.svelte';
  import ConfirmDialog from '../lib/ui/ConfirmDialog.svelte';
  import { toast } from '../lib/ui/toast.svelte';

  let name = $state('');
  let amount = $state('12.50');
  let currency = $state('USD');
  let notify = $state(true);
  let done = $state(false);
  let view = $state('today');
  let progress = $state(64);
  let modal = $state(false);
  let confirm = $state(false);

  const swatches = ['--bg', '--surface', '--surface-2', '--surface-3', '--border', '--text', '--text-2', '--accent', '--accent-soft', '--accent-2', '--success', '--warning', '--danger', '--info'];
  const modules = ['tasks', 'goals', 'habits', 'calendar', 'notes', 'wellness', 'finance'];
  const week = [{ label: 'Mon', value: 42 }, { label: 'Tue', value: 18 }, { label: 'Wed', value: 64 }, { label: 'Thu', value: 30 }, { label: 'Fri', value: 88 }, { label: 'Sat', value: 51 }, { label: 'Sun', value: 23 }];
</script>

<div class="ds">
  <Card title="Typography">
    <div class="type">
      <p class="display" style="font-size:var(--text-3xl)">Your life. Your system.</p>
      <h1>Heading 1 — Good morning</h1>
      <h2>Heading 2 — Today</h2>
      <h3>Heading 3 — Habits</h3>
      <p>Body — Build a workspace that fits the way you live. Everything stays on your device.</p>
      <p class="muted">Secondary — 3 tasks due today</p>
      <p class="meta">Meta — Updated 2 minutes ago</p>
    </div>
  </Card>

  <Card title="Colour">
    <div class="swatches">
      {#each swatches as s (s)}<div class="sw"><span style="background:var({s})"></span><code>{s}</code></div>{/each}
    </div>
    <div class="swatches mods">
      {#each modules as m (m)}<div class="sw"><span style="background:var(--mod-{m})"></span><code>{m}</code></div>{/each}
    </div>
  </Card>

  <Card title="Buttons">
    <div class="wrap">
      <Button variant="primary">{#snippet icon()}<Plus />{/snippet}Add task</Button>
      <Button>Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Delete</Button>
      <Button variant="primary" loading>Saving</Button>
      <Button disabled>Disabled</Button>
      <Button size="sm">Small</Button>
      <IconButton label="Notifications"><Bell /></IconButton>
      <IconButton label="Add" variant="primary"><Plus /></IconButton>
    </div>
  </Card>

  <Card title="Inputs">
    <div class="form">
      <TextField label="Display name" bind:value={name} placeholder="e.g. Alex" hint="Shown in your greeting." />
      <TextField label="Amount" bind:value={amount} inputmode="decimal" error={amount && isNaN(Number(amount)) ? 'Enter a number, like 12.50' : ''} />
      <Select label="Currency" bind:value={currency} options={[{ value: 'USD', label: 'US Dollar ($)' }, { value: 'EUR', label: 'Euro (€)' }, { value: 'GBP', label: 'Pound (£)' }]} />
      <TextField label="Note" multiline rows={3} placeholder="Anything to remember?" />
    </div>
  </Card>

  <Card title="Selection controls">
    <div class="form">
      <Switch label="Daily backup reminder" description="We'll remind you every 14 days." bind:checked={notify} />
      <div class="check"><Checkbox label="Morning run" bind:checked={done} /><span class:struck={done}>Morning run</span></div>
      <Segmented label="Task view" bind:value={view} options={[{ value: 'today', label: 'Today' }, { value: 'upcoming', label: 'Upcoming' }, { value: 'done', label: 'Done' }]} />
      <div class="wrap"><Badge>Neutral</Badge><Badge tone="accent">Accent</Badge><Badge tone="success">On track</Badge><Badge tone="warning">Due soon</Badge><Badge tone="danger">Overdue</Badge><Badge tone="info">Info</Badge></div>
    </div>
  </Card>

  <Card title="Progress & charts">
    <div class="prog">
      <ProgressRing value={progress} label="Goal progress" size={84} />
      <div class="bars">
        <ProgressBar value={progress} label="Savings goal" />
        <ProgressBar value={null} label="Loading" />
        <input type="range" min="0" max="100" bind:value={progress} aria-label="Demo progress value" />
      </div>
    </div>
    <BarChart data={week} label="Focus minutes this week" format={(v) => `${v} min`} highlight={4} />
    <Sparkline values={[7.5, 6, 8, null, 7, 8.5, 7.5, 6.5, 8]} label="Sleep trend" />
  </Card>

  <Card title="States" padded={false}>
    <EmptyState title="No tasks yet" body="Add your first task and it will show up here." compact>
      {#snippet icon()}<Inbox />{/snippet}
      {#snippet action()}<Button variant="primary" size="sm">{#snippet icon()}<Plus />{/snippet}Add task</Button>{/snippet}
    </EmptyState>
    <div class="pad"><Skeleton lines={3} /></div>
    <ErrorState title="Couldn't open that file" message="It doesn't look like a Life OS backup. Nothing was changed." />
  </Card>

  <Card title="Overlays & feedback">
    <div class="wrap">
      <Button onclick={() => (modal = true)}>Open modal</Button>
      <Button variant="danger" onclick={() => (confirm = true)}>Destructive confirm</Button>
      <Button onclick={() => toast('Task added')}>Toast</Button>
      <Button onclick={() => toast('Task deleted', { action: { label: 'Undo', run: () => toast('Restored') } })}>Toast + undo</Button>
    </div>
  </Card>
</div>

<Modal bind:open={modal} title="New goal" description="Give it a name and a target — you can add milestones later.">
  <div class="form"><TextField label="Goal" placeholder="Read 12 books" /></div>
  {#snippet footer()}<Button variant="ghost" onclick={() => (modal = false)}>Cancel</Button><Button variant="primary" onclick={() => (modal = false)}>{#snippet icon()}<Target />{/snippet}Create goal</Button>{/snippet}
</Modal>
<ConfirmDialog bind:open={confirm} title="Delete this habit?" message="Its history (42 check-ins) will be deleted too." confirmLabel="Delete habit" onconfirm={() => { confirm = false; toast('Habit deleted'); }} />

<style>
  .ds { display: grid; gap: var(--space-4); grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); align-items: start; }
  .type { display: grid; gap: var(--space-2); }
  .swatches { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: var(--space-2); }
  .mods { margin-top: var(--space-3); }
  .sw { display: flex; align-items: center; gap: 8px; font-size: var(--text-xs); }
  .sw span { width: 26px; height: 26px; border-radius: var(--radius-xs); border: 1px solid var(--border); flex: none; }
  .sw code { font-family: var(--font-mono); color: var(--text-2); overflow: hidden; text-overflow: ellipsis; }
  .wrap { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; }
  .form { display: grid; gap: var(--space-4); }
  .check { display: flex; align-items: center; gap: var(--space-2); }
  .struck { text-decoration: line-through; color: var(--text-3); transition: color var(--dur); }
  .prog { display: flex; gap: var(--space-5); align-items: center; margin-bottom: var(--space-5); }
  .bars { flex: 1; display: grid; gap: var(--space-3); }
  input[type='range'] { accent-color: var(--accent); width: 100%; }
  .pad { padding: 0 var(--space-5) var(--space-3); }
</style>
