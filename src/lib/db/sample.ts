// Realistic sample workspace (N days of history) for QA, screenshots and the Vercel demo.
// Never used in the purchased build unless the user explicitly chooses "Try with sample data".
import { addDays, nowIso, today, weekday, type DateKey } from '../util/dates';
import { newId } from '../util/ids';
import { getAll, transact } from './idb';
import type {
  CalendarEvent, Goal, GoalProgress, Habit, HabitLog, Note, Task, Transaction, WellnessDay, Workout,
} from './schema';

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

export async function seedSampleData(days = 90, seed = 7): Promise<Record<string, number>> {
  const r = rng(seed);
  const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)]!;
  const end = today();
  const start = addDays(end, -(days - 1));
  const at = nowIso();
  const stamp = { createdAt: at, updatedAt: at };
  const cats = await getAll('finance_categories');
  const catBy = (name: string) => cats.find((c) => c.name === name)?.id ?? null;

  const habits: Habit[] = [
    { id: newId('hab'), name: 'Drink water', frequency: { kind: 'daily' }, color: '#4f98a8', icon: 'droplet', archived: false, order: 0, createdOn: start, ...stamp },
    { id: newId('hab'), name: 'Read 20 minutes', frequency: { kind: 'daily' }, color: '#a5546c', icon: 'book-open', archived: false, order: 1, createdOn: start, ...stamp },
    { id: newId('hab'), name: 'Workout', frequency: { kind: 'weekdays', days: [1, 3, 5] }, color: '#4f8f75', icon: 'dumbbell', archived: false, order: 2, createdOn: start, ...stamp },
    { id: newId('hab'), name: 'Journal', frequency: { kind: 'times-per-week', times: 4 }, color: '#b0875c', icon: 'pen-line', archived: false, order: 3, createdOn: start, ...stamp },
  ];
  const habitLogs: HabitLog[] = [];
  const tasks: Task[] = [];
  const events: CalendarEvent[] = [];
  const notes: Note[] = [];
  const wellness: WellnessDay[] = [];
  const workouts: Workout[] = [];
  const txns: Transaction[] = [];
  const progress: GoalProgress[] = [];

  const goals: Goal[] = [
    { id: newId('goal'), title: 'Save for a trip', description: 'Two weeks in Japan', target: 3000, unit: '$', current: 0, deadline: addDays(end, 120), status: 'active', milestones: [], createdOn: start, completedOn: null, ...stamp },
    { id: newId('goal'), title: 'Read 12 books', description: '', target: 12, unit: 'books', current: 0, deadline: addDays(end, 200), status: 'active', milestones: [], createdOn: start, completedOn: null, ...stamp },
    {
      id: newId('goal'), title: 'Launch my side project', description: 'Ship v1 and get 10 users', target: null, unit: '', current: 0, deadline: addDays(end, 60), status: 'active',
      milestones: [
        { id: newId('ms'), title: 'Define the idea', done: true, doneOn: addDays(start, 5) },
        { id: newId('ms'), title: 'Build the first version', done: true, doneOn: addDays(start, 40) },
        { id: newId('ms'), title: 'Share with 10 people', done: false, doneOn: null },
      ],
      createdOn: start, completedOn: null, ...stamp,
    },
  ];

  const taskTitles = ['Reply to emails', 'Plan the week', 'Call mom', 'Grocery run', 'Pay electricity bill', 'Clean the desk', 'Book dentist', 'Update CV', 'Water the plants', 'Prepare presentation'];
  let trip = 0, books = 0;
  for (let i = 0; i < days; i++) {
    const d: DateKey = addDays(start, i);
    const dow = weekday(d);
    const future = d > end;
    if (future) break;

    habits.forEach((h, idx) => {
      const due = h.frequency.kind === 'daily' || (h.frequency.kind === 'weekdays' && h.frequency.days.includes(dow)) || h.frequency.kind === 'times-per-week';
      const chance = [0.85, 0.65, 0.8, 0.55][idx]!;
      if (due && r() < chance) habitLogs.push({ id: `${h.id}|${d}`, habitId: h.id, date: d, createdAt: at });
    });

    const nTasks = 1 + Math.floor(r() * 3);
    for (let k = 0; k < nTasks; k++) {
      const age = days - 1 - i; // days before today
      const done = age === 0 ? r() < 0.3 : age < 7 ? r() < 0.85 : r() < 0.99;
      tasks.push({ id: newId('task'), title: pick(taskTitles), notes: '', priority: pick(['none', 'low', 'medium', 'high'] as const), dueDate: d, dueTime: null, reminder: false, remindedOn: null, tags: [], done, completedOn: done ? d : null, createdOn: addDays(d, -1) < start ? start : addDays(d, -1), ...stamp });
    }

    wellness.push({ id: d, date: d, water: 4 + Math.floor(r() * 5), sleepHours: Math.round((6 + r() * 2.5) * 2) / 2, mood: (2 + Math.floor(r() * 4)) as 2 | 3 | 4 | 5, steps: 3000 + Math.floor(r() * 9000), weight: Math.round((72 - i * 0.02 + r() * 0.6) * 10) / 10, note: '', updatedAt: at });
    if ([1, 3, 5].includes(dow) && r() < 0.85) workouts.push({ id: newId('wo'), date: d, type: pick(['Run', 'Strength', 'Yoga', 'Cycling']), durationMin: 20 + Math.floor(r() * 50), intensity: pick(['easy', 'moderate', 'hard'] as const), note: '', ...stamp });

    if (Number(d.slice(8)) === 1) txns.push({ id: newId('tx'), date: d, type: 'income', amountMinor: 420000, currency: 'USD', categoryId: catBy('Salary'), note: 'Monthly salary', ...stamp });
    if (Number(d.slice(8)) === 3) txns.push({ id: newId('tx'), date: d, type: 'expense', amountMinor: 145000, currency: 'USD', categoryId: catBy('Housing'), note: 'Rent', ...stamp });
    if (Number(d.slice(8)) === 5) { const s = 25000; trip += s / 100; txns.push({ id: newId('tx'), date: d, type: 'saving', amountMinor: s, currency: 'USD', categoryId: catBy('Savings'), note: 'Trip fund', ...stamp }); progress.push({ id: newId('gp'), goalId: goals[0]!.id, date: d, value: trip, note: '', ...stamp }); }
    if (r() < 0.6) txns.push({ id: newId('tx'), date: d, type: 'expense', amountMinor: 500 + Math.floor(r() * 6000), currency: 'USD', categoryId: catBy(pick(['Groceries', 'Eating out', 'Transport', 'Shopping', 'Fun'])), note: '', ...stamp });
    if (i % 17 === 8) { books += 1; progress.push({ id: newId('gp'), goalId: goals[1]!.id, date: d, value: books, note: '', ...stamp }); }

    if (r() < 0.25) events.push({ id: newId('ev'), title: pick(['Team meeting', 'Dinner with friends', 'Yoga class', 'Doctor appointment', 'Birthday party']), date: d, allDay: false, startTime: pick(['09:00', '12:30', '18:00', '19:30']), endTime: null, notes: '', color: '#6c78b8', ...stamp });
    if (r() < 0.15) notes.push({ id: newId('note'), title: pick(['Ideas', 'Weekly reflection', 'Book notes', 'Meeting notes']), content: 'Things I want to remember from today.', date: d, pinned: false, tags: [], ...stamp });
  }
  for (let k = 1; k <= 6; k++) events.push({ id: newId('ev'), title: pick(['Team meeting', 'Gym session', 'Coffee with Sam', 'Flight to Lisbon']), date: addDays(end, k * 2), allDay: k % 3 === 0, startTime: k % 3 === 0 ? null : '10:00', endTime: null, notes: '', color: '#6c78b8', ...stamp });
  goals[0]!.current = trip;
  goals[1]!.current = books;

  const rows = { habits, habit_logs: habitLogs, tasks, goals, goal_progress: progress, events, notes, wellness, workouts, transactions: txns } as const;
  await transact<void>(Object.keys(rows) as (keyof typeof rows)[], 'readwrite', (t) => {
    for (const [store, list] of Object.entries(rows)) {
      const os = t.objectStore(store);
      for (const row of list as unknown[]) os.put(row);
    }
  });
  return Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, v.length]));
}
