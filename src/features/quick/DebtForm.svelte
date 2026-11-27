<script lang="ts">
  // Add or edit a debt: money you borrowed ("I owe") or lent ("owed to me").
  import Modal from '../../lib/ui/Modal.svelte';
  import Button from '../../lib/ui/Button.svelte';
  import TextField from '../../lib/ui/TextField.svelte';
  import DateField from '../../lib/ui/DateField.svelte';
  import Segmented from '../../lib/ui/Segmented.svelte';
  import CurrencyPicker from '../../lib/ui/CurrencyPicker.svelte';
  import ConfirmDialog from '../../lib/ui/ConfirmDialog.svelte';
  import { toast } from '../../lib/ui/toast.svelte';
  import { addDebt, deleteDebt, restoreDebt, updateDebt } from '../../lib/domain/debts';
  import { getAll } from '../../lib/db/idb';
  import { isDateKey, today } from '../../lib/util/dates';
  import { app } from '../../lib/app.svelte';
  import { formatMoney, minorDigits, parseAmount } from '../../lib/util/money';
  import type { Debt, DebtDirection } from '../../lib/db/schema';

  let { open = $bindable(false), debt = null, direction: initialDirection = 'owe' }: { open?: boolean; debt?: Debt | null; direction?: DebtDirection } = $props();

  let direction = $state<string>('owe');
  let person = $state('');
  let amount = $state('');
  let currency = $state('USD');
  let date = $state(today());
  let due = $state('');
  let note = $state('');
  let paid = $state(0);              // already repaid (when editing)
  let people = $state<string[]>([]); // people you have had a debt with, for one-tap reuse
  let errors = $state<{ person?: string; amount?: string; date?: string; due?: string }>({});
  let saving = $state(false);
  let confirmDelete = $state(false);

  $effect(() => {
    if (!open) return;
    errors = {};
    if (debt) {
      direction = debt.direction; person = debt.person; currency = debt.currency; date = debt.date; due = debt.dueDate ?? ''; note = debt.note;
      amount = (debt.amountMinor / 10 ** minorDigits(debt.currency)).toFixed(minorDigits(debt.currency));
    } else {
      direction = initialDirection; person = ''; amount = ''; currency = app.settings?.currency ?? 'USD'; date = today(); due = ''; note = '';
    }
    void Promise.all([getAll('debts'), getAll('debt_payments')]).then(([ds, ps]) => {
      paid = debt ? ps.filter((p) => p.debtId === debt.id).reduce((s, p) => s + p.amountMinor, 0) : 0;
      const seen = new Map<string, string>();
      for (const d of ds.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))) if (!seen.has(d.person.toLocaleLowerCase())) seen.set(d.person.toLocaleLowerCase(), d.person);
      people = [...seen.values()].slice(0, 6);
    });
  });

  const preview = $derived.by(() => { const v = parseAmount(amount, currency); return v && v > 0 ? formatMoney(v, currency) : ''; });
  const owe = $derived(direction === 'owe');

  async function save(e?: Event) {
    e?.preventDefault();
    const errs: typeof errors = {};
    const v = parseAmount(amount, currency);
    if (!person.trim()) errs.person = owe ? 'Who did you borrow from?' : 'Who did you lend to?';
    if (v === null || v <= 0) errs.amount = 'Enter an amount, like 50.00';
    else if (debt && v < paid) errs.amount = `${formatMoney(paid, currency)} has already been repaid — it can’t be less than that.`;
    if (!isDateKey(date)) errs.date = 'Pick a date.';
    if (due && !isDateKey(due)) errs.due = 'Pick a date.';
    else if (due && isDateKey(date) && due < date) errs.due = 'The due date can’t be before the day it started.';
    errors = errs;
    if (Object.keys(errs).length) return;
    saving = true;
    try {
      const input = { person, direction: direction as DebtDirection, amountMinor: v!, currency, date, dueDate: due || null, note };
      if (debt) { await updateDebt(debt, input, paid); toast('Debt updated', { tone: 'success' }); }
      else { await addDebt(input); toast(owe ? `Noted: you owe ${person.trim()} ${formatMoney(v!, currency)}` : `Noted: ${person.trim()} owes you ${formatMoney(v!, currency)}`, { tone: 'success' }); }
      open = false;
    } catch (err) {
      errors = { amount: err instanceof Error ? err.message : 'Could not save.' };
    } finally { saving = false; }
  }

  async function del() {
    confirmDelete = false;
    if (!debt) return;
    const gone = await deleteDebt(debt.id);
    open = false;
    toast('Debt deleted', { action: gone ? { label: 'Undo', run: () => void restoreDebt(gone) } : undefined });
  }
</script>

<Modal bind:open title={debt ? 'Edit debt' : 'Add a debt'} size="sm">
  <form class="form" onsubmit={save}>
    <Segmented label="Direction" bind:value={direction} options={[{ value: 'owe', label: 'I owe someone' }, { value: 'owed', label: 'Someone owes me' }]} />
    <div class="who">
      <TextField label={owe ? 'Borrowed from' : 'Lent to'} bind:value={person} maxlength={60} placeholder="e.g. Sam" error={errors.person} oninput={() => (errors = { ...errors, person: undefined })} />
      {#if people.length && !debt}
        <div class="chips" role="group" aria-label="People you have had a debt with">
          {#each people as p (p)}<button type="button" class="chip" onclick={() => (person = p)}>{p}</button>{/each}
        </div>
      {/if}
    </div>
    <div class="row">
      <TextField label="Amount" bind:value={amount} inputmode="decimal" placeholder="0.00" error={errors.amount} hint={preview} oninput={() => (errors = { ...errors, amount: undefined })} />
      <CurrencyPicker bind:value={currency} label="Currency" />
    </div>
    <div class="row">
      <DateField label={owe ? 'Borrowed on' : 'Lent on'} bind:value={date} error={errors.date} oninput={() => (errors = { ...errors, date: undefined })} />
      <DateField label="Due back by" optional bind:value={due} error={errors.due} oninput={() => (errors = { ...errors, due: undefined })} />
    </div>
    <TextField label="Note (optional)" bind:value={note} maxlength={140} placeholder="e.g. Rent top-up" />
    <button type="submit" hidden aria-hidden="true" tabindex="-1"></button>
  </form>
  {#snippet footer()}
    {#if debt}<span class="left"><Button variant="ghost" onclick={() => (confirmDelete = true)}>Delete</Button></span>{/if}
    <Button variant="ghost" onclick={() => (open = false)}>Cancel</Button>
    <Button variant="primary" loading={saving} onclick={() => save()}>{debt ? 'Save' : 'Add debt'}</Button>
  {/snippet}
</Modal>

<ConfirmDialog bind:open={confirmDelete} title="Delete this debt?" message={debt ? `${debt.person} — ${formatMoney(debt.amountMinor, debt.currency)} and all of its repayments will be deleted. You can undo right after.` : ''} confirmLabel="Delete debt" onconfirm={del} />

<style>
  .form { display: grid; gap: var(--space-4); }
  .row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--space-3); align-items: start; }
  .row > :global(*) { min-width: 0; }
  @media (max-width: 460px) { .row { grid-template-columns: 1fr; } }
  .who { display: grid; gap: var(--space-2); }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { min-height: 32px; padding: 0 12px; border-radius: 99px; border: 1px solid var(--border-strong); background: var(--surface-2); color: var(--text-2); font: 600 var(--text-xs) var(--font-body); cursor: pointer; }
  .chip:hover { color: var(--text); border-color: var(--accent); }
  .left { margin-right: auto; }
  .left :global(.btn) { color: var(--danger); }
</style>
