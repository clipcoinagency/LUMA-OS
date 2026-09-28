<script lang="ts">
  import Modal from '../../lib/ui/Modal.svelte';
  import Button from '../../lib/ui/Button.svelte';
  import TextField from '../../lib/ui/TextField.svelte';
  import Select from '../../lib/ui/Select.svelte';
  import Segmented from '../../lib/ui/Segmented.svelte';
  import { toast } from '../../lib/ui/toast.svelte';
  import ConfirmDialog from '../../lib/ui/ConfirmDialog.svelte';
  import { addTransaction, listCategories } from '../../lib/domain/finance';
  import { deleteRecord, restoreRecord, saveRecord } from '../../lib/domain/records';
  import { today } from '../../lib/util/dates';
  import { app } from '../../lib/app.svelte';
  import { formatMoney, minorDigits, parseAmount } from '../../lib/util/money';
  import type { FinanceCategory, Transaction, TransactionType } from '../../lib/db/schema';

  let { open = $bindable(false), type: initialType = 'expense', transaction = null }: { open?: boolean; type?: TransactionType; transaction?: Transaction | null } = $props();
  let confirmDelete = $state(false);
  let type = $state<string>('expense');
  let amount = $state('');
  let categoryId = $state('');
  let date = $state(today());
  let note = $state('');
  let error = $state('');
  let saving = $state(false);
  let categories = $state<FinanceCategory[]>([]);
  const currency = $derived(transaction?.currency ?? app.settings?.currency ?? 'USD');
  const catOptions = $derived(categories.filter((c) => c.type === type).map((c) => ({ value: c.id, label: c.name })));

  $effect(() => {
    if (open) {
      error = '';
      if (transaction) {
        type = transaction.type; note = transaction.note; date = transaction.date; categoryId = transaction.categoryId ?? '';
        amount = (transaction.amountMinor / 10 ** minorDigits(transaction.currency)).toFixed(minorDigits(transaction.currency));
      } else { type = initialType; amount = ''; note = ''; date = today(); }
      void listCategories().then((c) => { categories = c; });
    }
  });
  // only once categories have loaded — otherwise an edited transaction would lose its category
  $effect(() => { if (categories.length && !catOptions.some((o) => o.value === categoryId)) categoryId = catOptions[0]?.value ?? ''; });

  const preview = $derived.by(() => { const v = parseAmount(amount, currency); return v && v > 0 ? formatMoney(v, currency) : ''; });

  async function del() {
    confirmDelete = false;
    if (!transaction) return;
    const old = await deleteRecord('transactions', transaction.id);
    open = false;
    toast('Transaction deleted', { action: old ? { label: 'Undo', run: () => void restoreRecord('transactions', old) } : undefined });
  }

  async function save(e?: Event) {
    e?.preventDefault();
    const v = parseAmount(amount, currency);
    if (v === null || v <= 0) { error = 'Enter an amount, like 12.50'; return; }
    saving = true;
    try {
      if (transaction) {
        await saveRecord('transactions', { ...transaction, type: type as TransactionType, amountMinor: v, categoryId: categoryId || null, note: note.trim(), date });
        toast('Transaction updated', { tone: 'success' });
      } else {
        await addTransaction({ type: type as TransactionType, amountMinor: v, currency, categoryId: categoryId || null, note: note.trim(), date });
        toast(`${type === 'income' ? 'Income' : type === 'saving' ? 'Saving' : 'Expense'} of ${formatMoney(v, currency)} saved`, { tone: 'success' });
      }
      open = false;
    } finally { saving = false; }
  }
</script>

<Modal bind:open title={transaction ? 'Edit transaction' : 'Record money'} size="sm">
  <form class="form" onsubmit={save}>
    <Segmented label="Type" bind:value={type} options={[{ value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }, { value: 'saving', label: 'Saving' }]} />
    <TextField label="Amount ({currency})" bind:value={amount} inputmode="decimal" placeholder="0.00" error={error} hint={preview} oninput={() => (error = '')} />
    {#if catOptions.length}<Select label="Category" bind:value={categoryId} options={catOptions} />{/if}
    <TextField label="Date" type="date" bind:value={date} />
    <TextField label="Note (optional)" bind:value={note} maxlength={140} placeholder="e.g. Lunch with Sam" />
    <button type="submit" hidden aria-hidden="true" tabindex="-1"></button>
  </form>
  {#snippet footer()}
    {#if transaction}<span class="left"><Button variant="ghost" onclick={() => (confirmDelete = true)}>Delete</Button></span>{/if}
    <Button variant="ghost" onclick={() => (open = false)}>Cancel</Button>
    <Button variant="primary" loading={saving} onclick={() => save()}>Save</Button>
  {/snippet}
</Modal>

<ConfirmDialog bind:open={confirmDelete} title="Delete this transaction?" message={transaction ? `${formatMoney(transaction.amountMinor, transaction.currency)} on ${transaction.date} will be deleted. You can undo right after.` : ''} confirmLabel="Delete transaction" onconfirm={del} />

<style>
  .form { display: grid; gap: var(--space-4); }
  .left { margin-right: auto; }
  .left :global(.btn) { color: var(--danger); }
</style>
