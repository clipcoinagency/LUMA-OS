// State + actions for the guided Weekly Reset. Nothing is written to the user's data until the final
// "Plan my week" step, so backing out part-way changes nothing; the draft just waits in memory.
import { addDays, eachDay, type DateKey } from './util/dates';
import { app } from './app.svelte';
import { clock } from './clock.svelte';
import { getAll, getRange, put } from './db/idb';
import { bump } from './db/changes.svelte';
import { nowIso } from './util/dates';
import { createTask, deleteTask, updateTask } from './domain/tasks';
import { recordProgress } from './domain/goals';
import { saveHabit } from './domain/habits';
import { reviewId, weekToReview } from './domain/review';
import { detectWins, loadWeekReport, type Win, type WeekReport } from './domain/weekReport';
import { toast } from './ui/toast.svelte';
import type { CalendarEvent, Goal, Habit, Task, WeeklyReview } from './db/schema';

export type StepId = 'lookback' | 'wins' | 'unfinished' | 'goals' | 'habits' | 'priorities' | 'plan' | 'done';
export type Decision = { action: 'carry' } | { action: 'move'; day: DateKey } | { action: 'drop' };
export interface Priority { key: string; title: string; taskId: string | null; day: DateKey | null }

export const STEP_LABEL: Record<StepId, string> = {
  lookback: 'Look back', wins: 'Wins', unfinished: 'Loose ends', goals: 'Goals', habits: 'Habits', priorities: 'Priorities', plan: 'Plan', done: 'Ready',
};

class ResetSession {
  open = $state(false);
  loading = $state(false);
  saving = $state(false);
  started = $state(false);
  step = $state(0);
  dir = $state(1);

  reviewWeek = $state<DateKey>('2000-01-03');
  planWeek = $state<DateKey>('2000-01-10');
  report = $state.raw<WeekReport | null>(null);
  wins = $state.raw<Win[]>([]);
  keptWins = $state<string[]>([]);
  customWins = $state<string[]>([]);
  decisions = $state<Record<string, Decision>>({});
  goalValues = $state<Record<string, number>>({});
  pauseHabits = $state<string[]>([]);
  priorities = $state<Priority[]>([]);
  focusGoalHours = $state(8);
  reflection = $state('');

  goals = $state.raw<Goal[]>([]);
  habits = $state.raw<Habit[]>([]);
  habitDays = $state.raw<Record<string, string[]>>({});
  openTasks = $state.raw<Task[]>([]);
  planEvents = $state.raw<CalendarEvent[]>([]);
  saved = $state.raw<WeeklyReview | null>(null);

  get enabled() { return app.workspace?.enabledModules ?? []; }
  get steps(): StepId[] {
    const on = (m: string) => this.enabled.includes(m as never);
    const s: StepId[] = ['lookback', 'wins'];
    if (on('tasks')) s.push('unfinished');
    if (on('goals') && this.goals.length) s.push('goals');
    if (on('habits') && this.habits.length) s.push('habits');
    s.push('priorities', 'plan', 'done');
    return s;
  }
  get current(): StepId { return this.steps[Math.min(this.step, this.steps.length - 1)]!; }
  get planDays(): DateKey[] { return eachDay(this.planWeek, addDays(this.planWeek, 6)); }
  get reviewDays(): DateKey[] { return eachDay(this.reviewWeek, addDays(this.reviewWeek, 6)); }
  get isLast() { return this.current === 'done'; }

  /** Opens the flow (resuming an unfinished draft for the same week) */
  async begin(opts: { startOver?: boolean; week?: DateKey } = {}) {
    this.open = true;
    const ws = app.settings?.weekStartsOn ?? 1;
    const pair = weekToReview(clock.today, ws);
    const review = opts.week ?? pair.reviewWeek;
    if (this.started && !opts.startOver && !opts.week && this.reviewWeek === review && this.current !== 'done') return;
    await this.load(review, ws);
  }

  private async load(review: DateKey, weekStartsOn: 0 | 1) {
    this.loading = true;
    this.reviewWeek = review;
    this.planWeek = addDays(review, 7);
    const st = app.settings!;
    const [report, goals, habits, tasks, events] = await Promise.all([
      loadWeekReport(review, { weekStartsOn, enabled: this.enabled, currency: st.currency }),
      getAll('goals'), getAll('habits'), getAll('tasks'),
      getRange('events', 'by_date', this.planWeek, addDays(this.planWeek, 6)),
    ]);
    this.report = report;
    this.wins = detectWins(report, st.currency);
    this.keptWins = this.wins.slice(0, 3).map((w) => w.id);
    this.customWins = [];
    this.goals = goals.filter((g) => g.status === 'active');
    this.habits = habits.filter((h) => !h.archived).sort((a, b) => a.order - b.order);
    const days = eachDay(review, addDays(review, 6));
    const logs = await getAll('habit_logs');
    const map: Record<string, string[]> = {};
    for (const h of this.habits) map[h.id] = days.filter((d) => logs.some((l) => l.habitId === h.id && l.date === d));
    this.habitDays = map;
    this.openTasks = tasks.filter((t) => !t.done);
    this.planEvents = events.sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? '').localeCompare(b.startTime ?? ''));
    this.decisions = {};
    this.goalValues = {};
    this.pauseHabits = [];
    this.priorities = [];
    this.reflection = '';
    this.focusGoalHours = Math.max(2, Math.min(20, Math.round((report.focusMin / 60) / 1) || 8));
    this.saved = null;
    this.step = 0;
    this.dir = 1;
    this.started = true;
    this.loading = false;
  }

  close() { this.open = false; }
  next() { if (this.step < this.steps.length - 1) { this.dir = 1; this.step += 1; } }
  back() { if (this.step > 0) { this.dir = -1; this.step -= 1; } }
  goto(i: number) { this.dir = i >= this.step ? 1 : -1; this.step = i; }

  decide(taskId: string, d: Decision | null) {
    const next = { ...this.decisions };
    if (d) next[taskId] = d; else delete next[taskId];
    this.decisions = next;
  }
  carryAll(tasks: Task[]) {
    const next = { ...this.decisions };
    for (const t of tasks) if (!next[t.id]) next[t.id] = { action: 'carry' };
    this.decisions = next;
  }
  toggleWin(id: string) { this.keptWins = this.keptWins.includes(id) ? this.keptWins.filter((x) => x !== id) : [...this.keptWins, id]; }
  togglePause(habitId: string) { this.pauseHabits = this.pauseHabits.includes(habitId) ? this.pauseHabits.filter((x) => x !== habitId) : [...this.pauseHabits, habitId]; }

  addPriority(p: { title: string; taskId: string | null }) {
    if (this.priorities.length >= 3 || !p.title.trim()) return;
    if (p.taskId && this.priorities.some((x) => x.taskId === p.taskId)) return;
    this.priorities = [...this.priorities, { key: Math.random().toString(36).slice(2, 8), title: p.title.trim(), taskId: p.taskId, day: null }];
  }
  removePriority(key: string) { this.priorities = this.priorities.filter((p) => p.key !== key); }
  setPriorityDay(key: string, day: DateKey | null) { this.priorities = this.priorities.map((p) => (p.key === key ? { ...p, day } : p)); }

  /** Tasks still worth suggesting as next week's priorities (not dropped, not already chosen). */
  get suggestions(): Task[] {
    const rank = { high: 0, medium: 1, low: 2, none: 3 } as const;
    return this.openTasks
      .filter((t) => this.decisions[t.id]?.action !== 'drop' && !this.priorities.some((p) => p.taskId === t.id))
      .sort((a, b) => rank[a.priority] - rank[b.priority] || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'))
      .slice(0, 6);
  }

  /** Everything in one go — only now does the user's data change. */
  async finish() {
    if (this.saving || !this.report) return;
    this.saving = true;
    try {
      for (const [id, d] of Object.entries(this.decisions)) {
        if (d.action === 'drop') await deleteTask(id);
        else await updateTask(id, { dueDate: d.action === 'move' ? d.day : this.planWeek });
      }
      for (const [goalId, value] of Object.entries(this.goalValues)) await recordProgress(goalId, value, 'Weekly Reset');
      for (const id of this.pauseHabits) {
        const h = this.habits.find((x) => x.id === id);
        if (h) await saveHabit({ ...h, archived: true });
      }
      for (const p of this.priorities) {
        if (p.taskId) await updateTask(p.taskId, { priority: 'high', ...(p.day ? { dueDate: p.day } : {}) });
        else await createTask({ title: p.title, dueDate: p.day ?? this.planWeek, priority: 'high' });
      }
      const r = this.report;
      const wins = [...this.wins.filter((w) => this.keptWins.includes(w.id)).map((w) => w.text), ...this.customWins];
      const review: WeeklyReview = {
        id: reviewId(this.reviewWeek), date: this.reviewWeek, planWeek: this.planWeek,
        priorities: this.priorities.map((p) => ({ title: p.title, taskId: p.taskId, day: p.day })),
        wins, reflection: this.reflection.trim(), focusGoalMin: Math.round(this.focusGoalHours * 60),
        snapshot: { tasksDone: r.tasksDone, habitRate: r.habitRate, focusMin: Math.round(r.focusMin), spentMinor: r.spentMinor, moodAvg: r.moodAvg },
        createdAt: nowIso(), updatedAt: nowIso(),
      };
      await put('reviews', review);
      bump();
      this.saved = review;
      this.dir = 1;
      this.step = this.steps.length - 1;
    } catch (e) {
      console.error('Weekly reset failed', e);
      toast("Your reset couldn't be saved. Nothing was lost — please try again.", { tone: 'danger' });
    } finally {
      this.saving = false;
    }
  }

  /** After the summary is dismissed, forget the draft so the next reset starts fresh. */
  finishAndClose() { this.open = false; this.started = false; this.saved = null; }
}

export const reset = new ResetSession();
