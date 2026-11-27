<script lang="ts">
  // Add or edit a recurring bill or subscription.
  import Modal from '../../lib/ui/Modal.svelte';
  import Button from '../../lib/ui/Button.svelte';
  import TextField from '../../lib/ui/TextField.svelte';
  import DateField from '../../lib/ui/DateField.svelte';
  import Select from '../../lib/ui/Select.svelte';
  import Segmented from '../../lib/ui/Segmented.svelte';
  import Switch from '../../lib/ui/Switch.svelte';
  import CurrencyPicker from '../../lib/ui/CurrencyPicker.svelte';
  import ConfirmDialog from '../../lib/ui/ConfirmDialog.svelte';
  import { toast } from '../../lib/ui/toast.svelte';
  import { addBill, deleteBill, monthlyEquivalent, restoreBill, updateBill } from '../../lib/domain/bills';
  import { getAll } from '../../lib/db/idb';
  import { isDateKey, today } from '../../lib/util/dates';
  import { app } from '../../lib/app.svelte';
  import { formatMoney, minorDigits, parseAmount } from '../../lib/util/money';
  import type { Bill, BillCadence, FinanceCategory } from '../../lib/db/schema';

  let { open = $bindable(false), bill = null }: { open?: boolean; bill?: Bill | null } = $props();

  let name = $state('');
  let amount = $state('');
  let currency = $state('USD');
  let cadence = $state<string>('monthly');
  let due = $state(today());
  let categoryId = $state('');
  let note = $state('');
  let paused = $state(false);
  let cats = $state<FinanceCategory[]>([]);
  let errors = $state<{ name?: string; amount?: string; due?: string }>({});
  let saving = $state(false);
  let confirmDelete = $state(false);

  $effect(() => {
    if (!open) return;
    errors = {};
    if (bill) {
      name = bill.name; currency = bill.currency; cadence = bill.cadence; due = bill.nextDue; categoryId = bill.categoryId ?? ''; note = bill.note; paused = bill.paused;
      amount = (bill.amountMinor / 10 ** minorDigits(bill.currency)).toFixed(minorDigits(bill.currency));
    } else { name = ''; amount = ''; currency = app.settings?.currency ?? 'USD'; cadence = 'monthly'; due = today(); categoryId = ''; note = ''; paused = false; }
    void getAll('finance_categories').then((c) => { cats = c.filter((x) => x.type === 'expense' && (!x.archived || x.id === bill?.categoryId)).sort((a, b) => a.order - b.order); });
  });

  const catOptions = $derived([{ value: '', label: 'No category' }, ...cats.map((c) => ({ value: c.id, label: c.archived ? `${c.name} (hidden)` : c.name }))]);
  const parsed = $derived(parseAmount(amount, currency));
  const hint = $derived.by(() => {
    if (!parsed || parsed <= 0) return '';
    const m = monthlyEquivalent(parsed, cadence as BillCadence);
    return cadence === 'monthly' ? formatMoney(parsed, currency) : `${formatMoney(parsed, currency)} · about ${formatMoney(m, currency)} a month`;
  });

  async function save(e?: Event) {
    e?.preventDefault();
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = 'What is this bill called?';
    if (parsed === null || parsed <= 0) errs.amount = 'Enter an amount, like 15.99';
    if (!isDateKey(due)) errs.due = 'Pick the next due date.';
    errors = errs;
    if (Object.keys(errs).length) return;
    saving = true;
    try {
      const input = { name, amountMinor: parsed!, currency, cadence: cadence as BillCadence, nextDue: due, categoryId: categoryId || null, note, paused };
      if (bill) { await updateBill(bill, input); toast('Bill updated', { tone: 'success' }); }
      else { await addBill(input); toast(`${name.trim()} added`, { tone: 'success' }); }
      open = false;
    } catch (err) {
      errors = { amount: err instanceof Error ? err.message : 'Could not save.' };
    } finally { saving = false; }
  }

  async function del() {
    confirmDelete = false;
    if (!bill) return;
    const gone = await deleteBill(bill.id);
    open = false;
    toast('Bill deleted', { action: gone ? { label: 'Undo', run: () => void restoreBill(gone) } : undefined });
  }
</script>

<Modal bind:open title={bill ? 'Edit bill' : 'Add a bill or subscription'} size="sm">
  <form class="form" onsubmit={save}>
    <TextField label="Name" bind:value={name} maxlength={60} placeholder="e.g. Rent, Netflix, Gym" error={errors.name} oninput={() => (errors = { ...errors, name: undefined })} />
    <div class="row">
      <TextField label="Amount" bind:value={amount} inputmode="decimal" placeholder="0.00" error={errors.amount} {hint} oninput={() => (errors = { ...errors, amount: undefined })} />
      {#if open}<CurrencyPicker bind:value={currency} label="Currency" />{/if}
    </div>
    <Segmented label="How often" bind:value={cadence} options={[{ value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: 'Yearly' }]} />
    <div class="row">
      <DateField label="Next due" bind:value={due} error={errors.due} oninput={() => (errors = { ...errors, due: undefined })} />
      <Select label="Category" bind:value={categoryId} options={catOptions} />
    </div>
    <TextField label="Note (optional)" bind:value={note} maxlength={140} placeholder="e.g. Family plan" />
    {#if bill}<Switch label="Paused" description="Cancelled or on hold: kept here, but not counted or reminded." bind:checked={paused} />{/if}
    <button type="submit" hidden aria-hidden="true" tabindex="-1"></button>
  </form>
  {#snippet footer()}
    {#if bill}<span class="left"><Button variant="ghost" onclick={() => (confirmDelete = true)}>Delete</Button></span>{/if}
    <Button variant="ghost" onclick={() => (open = false)}>Cancel</Button>
    <Button variant="primary" loading={saving} onclick={() => save()}>{bill ? 'Save' : 'Add bill'}</Button>
  {/snippet}
</Modal>

<ConfirmDialog bind:open={confirmDelete} title="Delete this bill?" message={bill ? `${bill.name} will be removed from your bills. Past payments you recorded stay in your transactions. You can undo right after.` : ''} confirmLabel="Delete bill" onconfirm={del} />

<style>
  .form { display: grid; gap: var(--space-4); }
  .row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--space-3); align-items: start; }
  .row > :global(*) { min-width: 0; }
  @media (max-width: 460px) { .row { grid-template-columns: 1fr; } }
  .left { margin-right: auto; }
  .left :global(.btn) { color: var(--danger); }
</style>
