<script lang="ts">
  // Mounted once in the app shell; renders whichever create form was requested.
  import TaskForm from './TaskForm.svelte';
  import TransactionForm from './TransactionForm.svelte';
  import HabitForm from './HabitForm.svelte';
  import GoalForm from './GoalForm.svelte';
  import EventForm from './EventForm.svelte';
  import NoteForm from './NoteForm.svelte';
  import WorkoutForm from './WorkoutForm.svelte';
  import { quick, type QuickKind } from './quick.svelte';
  import type { CalendarEvent, Goal, Habit, Task, Transaction, TransactionType, Workout } from '../../lib/db/schema';
  const pre = <T,>(k: string) => (quick.preset[k] as T | undefined) ?? null;

  // function bindings: each form is "open" while the controller points at it; closing clears it
  const is = (k: QuickKind) => () => quick.kind === k;
  const set = (k: QuickKind) => (v: boolean) => { if (!v && quick.kind === k) quick.kind = null; };
</script>

<TaskForm bind:open={is('task'), set('task')} task={pre<Task>('task')} />
<TransactionForm bind:open={is('transaction'), set('transaction')} type={(quick.preset.type as TransactionType) ?? 'expense'} transaction={pre<Transaction>('transaction')} />
<HabitForm bind:open={is('habit'), set('habit')} habit={pre<Habit>('habit')} />
<GoalForm bind:open={is('goal'), set('goal')} goal={pre<Goal>('goal')} />
<EventForm bind:open={is('event'), set('event')} date={quick.preset.date as string | undefined} event={pre<CalendarEvent>('event')} />
<NoteForm bind:open={is('note'), set('note')} />
<WorkoutForm bind:open={is('workout'), set('workout')} date={quick.preset.date as string | undefined} workout={pre<Workout>('workout')} />
