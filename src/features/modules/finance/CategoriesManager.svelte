<script lang="ts">
  // Add / rename / hide categories. Hiding (archive) keeps old transactions intact.
  import { Plus, EyeOff, Eye } from '@lucide/svelte';
  import Modal from '../../../lib/ui/Modal.svelte';
  import Button from '../../../lib/ui/Button.svelte';
  import TextField from '../../../lib/ui/TextField.svelte';
  import Segmented from '../../../lib/ui/Segmented.svelte';
  import { toast } from '../../../lib/ui/toast.svelte';
  import { getAll } from '../../../lib/db/idb';
  import { changes } from '../../../lib/db/changes.svelte';
  import { saveRecord } from '../../../lib/domain/records';
  import { newId } from '../../../lib/util/ids';
  import { nowIso } from '../../../lib/util/dates';
  import { app } from '../../../lib/app.svelte';
  import { minorDigits, parseAmount } from '../../../lib/util/money';
  import type { FinanceCategory, TransactionType } from '../../../lib/db/schema';

  let { open = $bindable(false) }: { open?: boolean } = $props();
  let cats = $state.raw<FinanceCategory[]>([]);
  let type = $state<string>('expense');
  let name = $state('');
  let error = $state('');
  const PALETTE = ['#e0906f', '#e36d8a', '#5aa2e0', '#8c7ae6', '#4fbfa8', '#c9a227', '#d47fc1', '#3aa57a', '#9aa3b2'];

  $effect(() => { void changes.version; if (open) void getAll('finance_categories').then((c) => { cats = c.sort((a, b) => a.order - b.order); }); });
  const list = $derived(cats.filter((c) => c.type === type));
  const currency = $derived(app.settings?.currency ?? 'USD');
  const budgetText = (c: FinanceCategory) => (typeof c.budgetMinor === 'number' && c.budgetMinor > 0 ? String(c.budgetMinor / 10 ** minorDigits(currency)) : '');
  async function setBudget(c: FinanceCategory, v: string) {
    const t = v.trim();
    if (!t) { if (c.budgetMinor) await saveRecord('finance_categories', { ...c, budgetMinor: null }); return; }
    const minor = parseAmount(t, currency);
    if (minor !== null && minor > 0 && minor !== c.budgetMinor) await saveRecord('finance_categories', { ...c, budgetMinor: minor });
  }

  async function add(e?: Event) {
    e?.preventDefault();
    const n = name.trim();
    if (!n) { error = 'Name the category.'; return; }
    if (cats.some((c) => c.type === type && c.name.toLowerCase() === n.toLowerCase())) { error = 'You already have that category.'; return; }
    const at = nowIso();
    await saveRecord('finance_categories', { id: newId('cat'), name: n, type: type as TransactionType, color: PALETTE[cats.length % PALETTE.length]!, icon: 'circle', order: cats.length, archived: false, createdAt: at, updatedAt: at });
    name = '';
    toast('Category added', { tone: 'success' });
  }
  async function rename(c: FinanceCategory, v: string) {
    const n = v.trim();
    if (n && n !== c.name) await saveRecord('finance_categories', { ...c, name: n.slice(0, 40) });
  }
</script>

<Modal bind:open title="Categories" size="sm">
  <Segmented label="Category type" size="sm" bind:value={type} options={[{ value: 'expense', label: 'Expenses' }, { value: 'income', label: 'Income' }, { value: 'saving', label: 'Savings' }]} />
  <ul class="list">
    {#each list as c (c.id)}
      <li class:off={c.archived}>
        <span class="sw" style="background:{c.color}" aria-hidden="true"></span>
        <input value={c.name} aria-label="Rename {c.name}" maxlength="40" onchange={(e) => rename(c, e.currentTarget.value)} />
        {#if c.type === 'expense'}<input class="bud" inputmode="decimal" placeholder="Budget" value={budgetText(c)} aria-label="Monthly budget for {c.name}" maxlength="12" onchange={(e) => setBudget(c, e.currentTarget.value)} />{/if}
        <button type="button" aria-label={c.archived ? `Show ${c.name}` : `Hide ${c.name}`} title={c.archived ? 'Show' : 'Hide (old transactions keep it)'} onclick={() => saveRecord('finance_categories', { ...c, archived: !c.archived })}>
          {#if c.archived}<Eye size={18} />{:else}<EyeOff size={18} />{/if}
        </button>
      </li>
    {/each}
  </ul>
  <form class="add" onsubmit={add}>
    <TextField label="New category" bind:value={name} maxlength={40} placeholder="e.g. Pets" error={error} oninput={() => (error = '')} />
    <Button type="submit" variant="primary">{#snippet icon()}<Plus />{/snippet}Add</Button>
  </form>
</Modal>

<style>
  .list { list-style: none; margin: var(--space-4) 0; padding: 0; display: grid; gap: var(--space-1); max-height: 320px; overflow: auto; }
  li { display: flex; align-items: center; gap: var(--space-2); padding: 4px var(--space-2); border-radius: var(--radius-sm); }
  li:hover { background: var(--surface-2); }
  li.off { opacity: .5; }
  .sw { width: 14px; height: 14px; border-radius: 50%; flex: none; }
  input { flex: 1; min-height: 38px; border: 1px solid transparent; background: none; border-radius: var(--radius-xs); padding: 0 8px; color: var(--text); }
  input:hover { border-color: var(--border); }
  input:focus-visible { border-color: var(--accent); }
  button { width: 38px; height: 38px; display: grid; place-items: center; border: 0; background: none; color: var(--text-3); cursor: pointer; border-radius: var(--radius-sm); }
  button:hover { color: var(--text); background: var(--surface-3); }
  .add { display: grid; grid-template-columns: 1fr auto; gap: var(--space-2); align-items: end; }
  .bud { width: 84px; flex: none; text-align: right; }
</style>
