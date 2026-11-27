<script lang="ts">
  // Record a repayment against one debt (paid by you, or received by you).
  import Modal from '../../../lib/ui/Modal.svelte';
  import Button from '../../../lib/ui/Button.svelte';
  import TextField from '../../../lib/ui/TextField.svelte';
  import DateField from '../../../lib/ui/DateField.svelte';
  import { toast } from '../../../lib/ui/toast.svelte';
  import { recordPayment, type DebtView } from '../../../lib/domain/debts';
  import { isDateKey, today } from '../../../lib/util/dates';
  import { formatMoney, minorDigits, parseAmount } from '../../../lib/util/money';

  let { open = $bindable(false), view = null }: { open?: boolean; view?: DebtView | null } = $props();
  let amount = $state('');
  let date = $state(today());
  let note = $state('');
  let error = $state('');
  let dateError = $state('');
  let saving = $state(false);

  const cur = $derived(view?.debt.currency ?? 'USD');
  const owe = $derived(view?.debt.direction === 'owe');
  const left = $derived(view?.balanceMinor ?? 0);

  $effect(() => {
    if (!open) return;
    error = ''; dateError = ''; note = ''; date = today();
    amount = view ? (view.balanceMinor / 10 ** minorDigits(view.debt.currency)).toFixed(minorDigits(view.debt.currency)) : '';
  });

  const after = $derived.by(() => { const v = parseAmount(amount, cur); return v && v > 0 && v <= left ? (left - v === 0 ? 'This settles the debt in full.' : `${formatMoney(left - v, cur)} will remain.`) : ''; });

  async function save(e?: Event) {
    e?.preventDefault();
    if (!view) return;
    const v = parseAmount(amount, cur);
    if (v === null || v <= 0) { error = 'Enter an amount, like 25.00'; return; }
    if (v > left) { error = `That is more than the ${formatMoney(left, cur)} still ${owe ? 'owed' : 'due'}.`; return; }
    if (!isDateKey(date)) { dateError = 'Pick a date.'; return; }
    saving = true;
    try {
      await recordPayment(view.debt.id, v, date, note);
      toast(left - v === 0 ? 'Settled in full 🎉' : owe ? `Paid ${formatMoney(v, cur)} to ${view.debt.person}` : `${view.debt.person} paid you ${formatMoney(v, cur)}`, { tone: 'success' });
      open = false;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not save.';
    } finally { saving = false; }
  }
</script>

<Modal bind:open title={owe ? `Pay ${view?.debt.person ?? ''}` : `${view?.debt.person ?? ''} paid you`} size="sm" description={view ? `${formatMoney(left, cur)} ${owe ? 'left to pay' : 'still to come'}.` : undefined}>
  <form class="form" onsubmit={save}>
    <TextField label="Amount ({cur})" bind:value={amount} inputmode="decimal" placeholder="0.00" {error} hint={after} oninput={() => (error = '')} />
    <DateField label={owe ? 'Paid on' : 'Received on'} bind:value={date} error={dateError} oninput={() => (dateError = '')} />
    <TextField label="Note (optional)" bind:value={note} maxlength={140} placeholder="e.g. Bank transfer" />
    <button type="submit" hidden aria-hidden="true" tabindex="-1"></button>
  </form>
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (open = false)}>Cancel</Button>
    <Button variant="primary" loading={saving} onclick={() => save()}>{owe ? 'Record payment' : 'Record payment received'}</Button>
  {/snippet}
</Modal>

<style>
  .form { display: grid; gap: var(--space-4); }
</style>
