<script lang="ts">
  // A plain number that eases toward a new value instead of snapping — used wherever a stat
  // updates live (goal %, weekly counts) so the dashboard feels responsive, not static.
  // Starts at its initial value with no animate-in; only later changes tween.
  import { Tween } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { dur } from '../motion';

  interface Props { value: number; decimals?: number; prefix?: string; suffix?: string }
  let { value, decimals = 0, prefix = '', suffix = '' }: Props = $props();

  // svelte-ignore state_referenced_locally -- intentional: capture the starting value once, no
  // animate-in on mount; the $effect below tweens every value AFTER that.
  const tween = new Tween(value, { duration: dur(600), easing: cubicOut });
  $effect(() => { tween.target = value; });
</script>

<span class="num">{prefix}{tween.current.toFixed(decimals)}{suffix}</span>
