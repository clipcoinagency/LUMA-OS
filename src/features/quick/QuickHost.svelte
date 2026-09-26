<script lang="ts">
  // Mounted once in the app shell; renders whichever create form was requested.
  import TaskForm from './TaskForm.svelte';
  import TransactionForm from './TransactionForm.svelte';
  import HabitForm from './HabitForm.svelte';
  import GoalForm from './GoalForm.svelte';
  import EventForm from './EventForm.svelte';
  import NoteForm from './NoteForm.svelte';
  import { quick, type QuickKind } from './quick.svelte';
  import type { TransactionType } from '../../lib/db/schema';

  // function bindings: each form is "open" while the controller points at it; closing clears it
  const is = (k: QuickKind) => () => quick.kind === k;
  const set = (k: QuickKind) => (v: boolean) => { if (!v && quick.kind === k) quick.kind = null; };
</script>

<TaskForm bind:open={is('task'), set('task')} />
<TransactionForm bind:open={is('transaction'), set('transaction')} type={(quick.preset.type as TransactionType) ?? 'expense'} />
<HabitForm bind:open={is('habit'), set('habit')} />
<GoalForm bind:open={is('goal'), set('goal')} />
<EventForm bind:open={is('event'), set('event')} date={quick.preset.date as string | undefined} />
<NoteForm bind:open={is('note'), set('note')} />
