<script lang="ts">
  // Mounted once in the app shell; renders whichever create form was requested.
  import TaskForm from './TaskForm.svelte';
  import TransactionForm from './TransactionForm.svelte';
  import HabitForm from './HabitForm.svelte';
  import GoalForm from './GoalForm.svelte';
  import EventForm from './EventForm.svelte';
  import NoteForm from './NoteForm.svelte';
  import WorkoutForm from './WorkoutForm.svelte';
  import ProjectForm from './ProjectForm.svelte';
  import BookForm from './BookForm.svelte';
  import DeckForm from './DeckForm.svelte';
  import { quick, type QuickKind } from './quick.svelte';
  import type { Book, BookStatus, CalendarEvent, Deck, Goal, Habit, Project, Task, Transaction, TransactionType, Workout } from '../../lib/db/schema';
  const pre = <T,>(k: string) => (quick.preset[k] as T | undefined) ?? null;

  // function bindings: each form is "open" while the controller points at it; closing clears it
  // a form only sees the preset 'kind' when IT is the one being opened — otherwise "exam" meant for the event
  // form would also reach the (closed) project form and crash it
  const kindFor = (k: QuickKind) => (quick.kind === k ? (quick.preset.kind as string | undefined) : undefined);
  const is = (k: QuickKind) => () => quick.kind === k;
  const set = (k: QuickKind) => (v: boolean) => { if (!v && quick.kind === k) quick.kind = null; };
</script>

<TaskForm bind:open={is('task'), set('task')} task={pre<Task>('task')} projectId={(quick.preset.projectId as string | undefined) ?? null} />
<TransactionForm bind:open={is('transaction'), set('transaction')} type={(quick.preset.type as TransactionType) ?? 'expense'} transaction={pre<Transaction>('transaction')} />
<HabitForm bind:open={is('habit'), set('habit')} habit={pre<Habit>('habit')} />
<GoalForm bind:open={is('goal'), set('goal')} goal={pre<Goal>('goal')} />
<EventForm bind:open={is('event'), set('event')} date={quick.preset.date as string | undefined} event={pre<CalendarEvent>('event')} kind={kindFor('event') ?? 'event'} projectId={(quick.preset.projectId as string | undefined) ?? null} />
<NoteForm bind:open={is('note'), set('note')} kind={kindFor('note') ?? 'note'} />
<WorkoutForm bind:open={is('workout'), set('workout')} date={quick.preset.date as string | undefined} workout={pre<Workout>('workout')} />
<ProjectForm bind:open={is('project'), set('project')} kind={kindFor('project') === 'study' ? 'study' : 'work'} project={pre<Project>('project')} />
<BookForm bind:open={is('book'), set('book')} book={pre<Book>('book')} status={(quick.preset.status as BookStatus | undefined) ?? 'want'} />
<DeckForm bind:open={is('deck'), set('deck')} deck={pre<Deck>('deck')} />
