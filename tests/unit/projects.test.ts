import { describe, expect, it, beforeEach } from 'vitest';
import { closeDB, getAll, put } from '../../src/lib/db/idb';
import { deleteProject, projectStats, saveProject, listProjects } from '../../src/lib/domain/projects';
import type { CalendarEvent, FocusSession, Note, Project, Task } from '../../src/lib/db/schema';

const DAY = '2026-10-01';
const proj = (over: Partial<Project> = {}): Project => ({ id: 'p1', title: 'Website', kind: 'work', color: '#000', client: '', deadline: null, status: 'active', goalId: null, notes: '', createdOn: '2026-09-01', createdAt: '', updatedAt: '', ...over });
const task = (id: string, over: Partial<Task> = {}): Task => ({ id, title: id, notes: '', priority: 'none', dueDate: null, dueTime: null, reminder: false, remindedOn: null, tags: [], done: false, completedOn: null, createdOn: '2026-09-01', createdAt: '', updatedAt: '', ...over });
const ev = (id: string, date: string, over: Partial<CalendarEvent> = {}): CalendarEvent => ({ id, title: id, date, allDay: false, startTime: '10:00', endTime: null, notes: '', color: '#000', createdAt: '', updatedAt: '', ...over });
const sess = (id: string, over: Partial<FocusSession> = {}): FocusSession => ({ id, date: DAY, startedAt: '', endedAt: '', seconds: 1800, plannedMin: 30, taskId: null, projectId: null, label: '', createdAt: '', ...over });

describe('project stats', () => {
  it('rolls up tasks, meetings, notes and focus linked to one project', () => {
    const p = proj({ deadline: '2026-10-20' });
    const tasks = [task('a', { projectId: 'p1', done: true, completedOn: DAY }), task('b', { projectId: 'p1', dueDate: '2026-09-25' }), task('c', { projectId: 'p1', dueDate: '2026-10-05' }), task('other', { projectId: 'p2' })];
    const events = [ev('m1', '2026-10-03', { projectId: 'p1', kind: 'meeting' }), ev('old', '2026-09-01', { projectId: 'p1' }), ev('x', '2026-10-04', { projectId: 'p2' })];
    const notes = [{ id: 'n', projectId: 'p1' } as Note, { id: 'n2', projectId: null } as Note];
    const sessions = [sess('s1', { projectId: 'p1' }), sess('s2', { taskId: 'b' }), sess('s3', { projectId: 'p2' })];
    const s = projectStats(p, tasks, events, notes, sessions, DAY);
    expect(s.tasksTotal).toBe(3);
    expect(s.tasksDone).toBe(1);
    expect(s.overdue).toBe(1);
    expect(s.events.map((e) => e.id)).toEqual(['m1']);
    expect(s.notes).toBe(1);
    expect(s.focusMin).toBe(60);       // direct + via a linked task
    expect(s.nextDue).toBe('2026-10-05');
    expect(s.daysToDeadline).toBe(19);
  });
  it('uses the project deadline when no task is due sooner', () => {
    expect(projectStats(proj({ deadline: '2026-10-03' }), [task('a', { projectId: 'p1', dueDate: '2026-10-09' })], [], [], [], DAY).nextDue).toBe('2026-10-03');
  });
  it('is empty and calm for a new project', () => {
    const s = projectStats(proj(), [], [], [], [], DAY);
    expect(s).toMatchObject({ tasksTotal: 0, tasksDone: 0, overdue: 0, focusMin: 0, nextDue: null, daysToDeadline: null });
  });
});

describe('project storage', () => {
  beforeEach(async () => { await closeDB(); indexedDB.deleteDatabase('lifeos'); });
  it('saves, lists by kind, and edits in place', async () => {
    const a = await saveProject({ title: '  Launch  ', kind: 'work' });
    await saveProject({ title: 'Biology', kind: 'study' });
    expect(a.title).toBe('Launch');
    expect((await listProjects('work')).map((p) => p.title)).toEqual(['Launch']);
    await saveProject({ id: a.id, title: 'Launch v2', kind: 'work', client: 'Acme' });
    const all = await listProjects();
    expect(all).toHaveLength(2);
    expect(all.find((p) => p.id === a.id)).toMatchObject({ title: 'Launch v2', client: 'Acme' });
  });
  it('deleting a project keeps its tasks, just unassigned', async () => {
    const p = await saveProject({ title: 'Temp', kind: 'work' });
    await put('tasks', task('t1', { projectId: p.id }));
    await deleteProject(p.id);
    expect(await listProjects()).toHaveLength(0);
    const rows = await getAll('tasks');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.projectId).toBeNull();
  });
});
