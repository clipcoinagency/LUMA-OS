<script lang="ts">
  // Confirmation for destructive actions. Cancel is focused by default; the most dangerous
  // actions require typing a word, and can offer "Back up first".
  import type { Snippet } from 'svelte';
  import Modal from './Modal.svelte';
  import Button from './Button.svelte';
  import TextField from './TextField.svelte';

  interface Props {
    open?: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
    typeToConfirm?: string;
    busy?: boolean;
    onconfirm: () => void | Promise<void>;
    oncancel?: () => void;
    extra?: Snippet;
  }
  let {
    open = $bindable(false), title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = true,
    typeToConfirm, busy = false, onconfirm, oncancel, extra,
  }: Props = $props();
  let typed = $state('');
  const allowed = $derived(!typeToConfirm || typed.trim().toLowerCase() === typeToConfirm.toLowerCase());

  $effect(() => { if (!open) typed = ''; });

  function cancel() {
    open = false;
    oncancel?.();
  }
</script>

<Modal bind:open {title} size="sm" onclose={oncancel}>
  <p class="msg">{message}</p>
  {#if extra}<div class="extra">{@render extra()}</div>{/if}
  {#if typeToConfirm}
    <div class="type">
      <TextField label={`Type "${typeToConfirm}" to confirm`} bind:value={typed} autocomplete="off" />
    </div>
  {/if}
  {#snippet footer()}
    <Button variant="ghost" onclick={cancel} autofocus>{cancelLabel}</Button>
    <Button variant={danger ? 'danger' : 'primary'} disabled={!allowed} loading={busy} onclick={() => onconfirm()}>{confirmLabel}</Button>
  {/snippet}
</Modal>

<style>
  .msg { color: var(--text-2); }
  .extra { margin-top: var(--space-4); }
  .type { margin-top: var(--space-4); }
</style>
