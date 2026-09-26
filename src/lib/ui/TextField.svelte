<script lang="ts">
  interface Props {
    label: string;
    value?: string;
    hint?: string;
    error?: string;
    multiline?: boolean;
    rows?: number;
    hideLabel?: boolean;
    id?: string;
    type?: string;
    placeholder?: string;
    maxlength?: number;
    autocomplete?: HTMLInputElement['autocomplete'];
    inputmode?: 'text' | 'decimal' | 'numeric' | 'email' | 'search';
    oninput?: (v: string) => void;
    onkeydown?: (e: KeyboardEvent) => void;
  }
  let {
    label, value = $bindable(''), hint, error, multiline = false, rows = 4, hideLabel = false, id,
    type = 'text', placeholder, maxlength, autocomplete, inputmode, oninput, onkeydown,
  }: Props = $props();
  const fallbackId = `f-${Math.random().toString(36).slice(2, 8)}`;
  const uid = $derived(id ?? fallbackId);
  const describedBy = $derived([hint && !error ? `${uid}-hint` : '', error ? `${uid}-err` : ''].filter(Boolean).join(' ') || undefined);
</script>

<div class="field" class:invalid={!!error}>
  <label for={uid} class:sr-only={hideLabel}>{label}</label>
  {#if multiline}
    <textarea id={uid} bind:value {rows} {placeholder} {maxlength} aria-invalid={!!error} aria-describedby={describedBy}
      oninput={() => oninput?.(value)} {onkeydown}></textarea>
  {:else}
    <input id={uid} {type} bind:value {placeholder} {maxlength} {autocomplete} {inputmode} aria-invalid={!!error}
      aria-describedby={describedBy} oninput={() => oninput?.(value)} {onkeydown} />
  {/if}
  {#if error}<p class="err" id="{uid}-err" role="alert">{error}</p>{:else if hint}<p class="hint" id="{uid}-hint">{hint}</p>{/if}
</div>

<style>
  .field { display: grid; gap: 6px; min-width: 0; }
  label { font-size: var(--text-sm); font-weight: 600; color: var(--text-2); }
  input, textarea {
    width: 100%; min-height: var(--touch); padding: 10px 14px; border-radius: var(--radius-sm);
    border: 1px solid var(--border-strong); background: var(--surface); color: var(--text);
    transition: border-color var(--dur) var(--ease-out), box-shadow var(--dur) var(--ease-out);
  }
  textarea { resize: vertical; line-height: var(--leading); }
  input::placeholder, textarea::placeholder { color: var(--text-3); }
  input:hover, textarea:hover { border-color: var(--text-3); }
  input:focus-visible, textarea:focus-visible { border-color: var(--accent); box-shadow: var(--focus); border-radius: var(--radius-sm); }
  .invalid input, .invalid textarea { border-color: var(--danger); }
  .hint { font-size: var(--text-xs); color: var(--text-3); }
  .err { font-size: var(--text-xs); color: var(--danger); font-weight: 600; }
</style>
