// Projects (Work) and Subjects (Study) are ONE concept: a container that sits between a Goal and its
// Tasks. Tasks, meetings/exams (calendar events), notes and focus sessions all point at it with a
// projectId, so a project's page is simply "everything linked to this" — no duplicated systems.
import { diffDays, nowIso, today, type DateKey } from '../util/dates';
import { newId } from '../util/ids';
import { getAll, get, put, transact } from '../db/idb';
import { bump } from '../db/changes.svelte';
import type { CalendarEvent, FocusSession, Note, Project, Task } from '../db/schema';
import { sumMinutes } from './focus';

export type ProjectKind = Project['kind'];

/** The words each area uses for the same underlying things. */
export const VOCAB: Record<ProjectKind, { area: string; one: string; many: string; tasks: string; events: string; eventKind: 'meeting' | 'exam'; clientLabel: string; clientHint: string; empty: string; focus: string }> = {
  work: { area: 'Work', one: 'project', many: 'Projects', tasks: 'Tasks', events: 'Meetings', eventKind: 'meeting', clientLabel: 'Client or team', clientHint: 'Who is this for? (optional)', empty: 'Group the tasks, meetings and deadlines of a piece of work in one place.', focus: 'Focus time' },
  study: { area: 'Study', one: 'subject', many: 'Subjects', tasks: 'Assignments', events: 'Exams', eventKind: 'exam', clientLabel: 'Course or instructor', clientHint: 'e.g. BIO 101 · Dr. Rao (optional)', empty: 'Add each subject you study, then attach assignments, exams and study sessions to it.', focus: 'Study time' },
};

export const PROJECT_COLORS = ['#4fa3e0', '#e0906f', '#7a6bb0', '#4f8f75', '#d4637f', '#b0875c', '#4f98a8', '#8c7ae6'];

export const listProjects = async (kind?: ProjectKind): Promise<Project[]> =>
  (await getAll('projects')).filter((p) => !kind || p.kind === kind).sort((a, b) => a.title.localeCompare(b.title));

export async function saveProject(input: Partial<Project> & Pick<Project, 'title' | 'kind'>): Promise<Project> {
  const at = nowIso();
  const existing = input.id ? await get('projects', input.id) : undefined;
  const p: Project = {
    id: existing?.id ?? newId('proj'), color: PROJECT_COLORS[0]!, client: '', deadline: null, status: 'active', goalId: null, notes: '', createdOn: today(),
    ...existing, ...input, title: input.title.trim(), createdAt: existing?.createdAt ?? at, updatedAt: at,
  } as Project;
  await put('projects', p);
  bump();
  return p;
}

/** Removing a project never deletes the work inside it — tasks/events/notes just become unassigned. */
export async function deleteProject(id: string): Promise<void> {
  const [tasks, events, notes] = await Promise.all([getAll('tasks'), getAll('events'), getAll('notes')]);
  await transact<void>(['projects', 'tasks', 'events', 'notes'], 'readwrite', (t) => {
    t.objectStore('projects').delete(id);
    const unlink = <T extends { id: string; projectId?: string | null }>(store: 'tasks' | 'events' | 'notes', rows: T[]) => {
      const os = t.objectStore(store);
      for (const r of rows) if (r.projectId === id) os.put({ ...r, projectId: null });
    };
    unlink('tasks', tasks); unlink('events', events); unlink('notes', notes);
  });
  bump();
}

export interface ProjectStats {
  tasksTotal: number;
  tasksDone: number;
  tasksOpen: Task[];
  overdue: number;
  events: Pick<CalendarEvent, 'id' | 'title' | 'date' | 'startTime' | 'kind'>[];   // upcoming, soonest first
  notes: number;
  focusMin: number;
  nextDue: DateKey | null;                                                         // earliest open task due date or the project deadline
  daysToDeadline: number | null;
}

/** Pure: everything linked to one project. */
export function projectStats(p: Project, tasks: Task[], events: CalendarEvent[], notes: Note[], sessions: FocusSession[], day: DateKey = today()): ProjectStats {
  const mine = tasks.filter((t) => t.projectId === p.id);
  const open = mine.filter((t) => !t.done);
  const dues = open.map((t) => t.dueDate).filter((d): d is DateKey => d !== null).sort();
  const nextDue = [...dues.filter((d) => d >= day).slice(0, 1), ...(p.deadline && p.deadline >= day ? [p.deadline] : [])].sort()[0] ?? null;
  const taskIds = new Set(mine.map((t) => t.id));
  return {
    tasksTotal: mine.length, tasksDone: mine.length - open.length, tasksOpen: open,
    overdue: open.filter((t) => t.dueDate !== null && t.dueDate < day).length,
    events: events.filter((e) => e.projectId === p.id && e.date >= day).sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? '').localeCompare(b.startTime ?? '')),
    notes: notes.filter((n) => n.projectId === p.id).length,
    focusMin: sumMinutes(sessions.filter((s) => s.projectId === p.id || (s.taskId !== null && taskIds.has(s.taskId)))),
    nextDue, daysToDeadline: p.deadline ? diffDays(day, p.deadline) : null,
  };
}

export interface ProjectRow { project: Project; stats: ProjectStats }

export async function loadProjects(kind: ProjectKind): Promise<ProjectRow[]> {
  const [projects, tasks, events, notes, sessions] = await Promise.all([listProjects(kind), getAll('tasks'), getAll('events'), getAll('notes'), getAll('focus_sessions')]);
  return projects.map((project) => ({ project, stats: projectStats(project, tasks, events, notes, sessions) }));
}
