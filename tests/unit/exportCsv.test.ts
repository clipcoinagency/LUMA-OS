import { describe, expect, it } from 'vitest';
import { csvCell, focusCsv, habitCheckinsCsv, notesCsv, tasksCsv, toCsv, transactionsCsv } from '../../src/lib/domain/exportCsv';
import type { FinanceCategory, FocusSession, Habit, HabitLog, Note, Task, Transaction } from '../../src/lib/db/schema';

const body = (csv: string) => csv.replace(/^﻿/, '').trimEnd().split('\r\n');

describe('csv cells', () => {
  it('quotes commas, quotes and line breaks, and leaves plain text alone', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell(12.5)).toBe('12.5');
    expect(csvCell(-3)).toBe('-3');                    // real numbers are never altered
  });
  it('stops a text cell from running as a spreadsheet formula', () => {
    for (const evil of ['=SUM(A1)', '+1+1', '-2+3', '@cmd', '\tx']) expect(csvCell(evil).replace(/^"|"$/g, '').startsWith("'")).toBe(true);
    expect(csvCell('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`);
  });
  it('starts with a byte-order mark and ends rows with CRLF', () => {
    const t = toCsv(['A', 'B'], [[1, 'x'], [2, 'y']]);
    expect(t.startsWith('﻿')).toBe(true);
    expect(body(t)).toEqual(['A,B', '1,x', '2,y']);
  });
});

const stamp = { createdAt: '2026-11-01T10:00:00Z', updatedAt: '2026-11-01T10:00:00Z' };

describe('datasets', () => {
  it('writes money in major units with each currency’s own decimals', () => {
    const cat = { id: 'c1', name: 'Food, drink', type: 'expense', color: '', icon: '', order: 0, archived: false, ...stamp } as FinanceCategory;
    const tx = (over: Partial<Transaction>): Transaction => ({ id: 'x', date: '2026-11-02', type: 'expense', amountMinor: 1234, currency: 'USD', categoryId: 'c1', note: '', ...stamp, ...over });
    const rows = body(transactionsCsv([tx({}), tx({ id: 'y', currency: 'JPY', amountMinor: 1500, date: '2026-11-03' }), tx({ id: 'z', currency: 'KWD', amountMinor: 12345, date: '2026-11-04', categoryId: null, type: 'income' })], [cat]));
    expect(rows[1]).toBe('2026-11-02,expense,12.34,USD,"Food, drink",');
    expect(rows[2]).toBe('2026-11-03,expense,1500,JPY,"Food, drink",');
    expect(rows[3]).toBe('2026-11-04,income,12.345,KWD,,');
  });
  it('lists tasks by due date with yes/no and tags', () => {
    const t = (over: Partial<Task>): Task => ({ id: 't', title: 'T', notes: '', priority: 'none', dueDate: null, dueTime: null, reminder: false, remindedOn: null, tags: [], done: false, completedOn: null, createdOn: '2026-11-01', ...stamp, ...over });
    const rows = body(tasksCsv([t({ title: 'No date' }), t({ title: 'Call mom', dueDate: '2026-11-24', dueTime: '18:00', priority: 'high', tags: ['family', 'home'], done: true, completedOn: '2026-11-24' })]));
    expect(rows[1]).toBe('Call mom,yes,2026-11-24,2026-11-24,18:00,high,family; home,,2026-11-01');
    expect(rows[2]?.startsWith('No date,no,')).toBe(true);
  });
  it('names habits in check-ins, even deleted ones', () => {
    const h = { id: 'h1', name: 'Read' } as Habit;
    const l = (id: string, habitId: string, date: string): HabitLog => ({ id, habitId, date, createdAt: '' });
    expect(body(habitCheckinsCsv([h], [l('a', 'h1', '2026-11-02'), l('b', 'gone', '2026-11-01')]))).toEqual(['Date,Habit', '2026-11-01,(deleted habit)', '2026-11-02,Read']);
  });
  it('writes focus minutes with one decimal', () => {
    const s = { id: 's', date: '2026-11-02', startedAt: '2026-11-02T09:00:00Z', endedAt: '2026-11-02T09:25:30Z', seconds: 1530, plannedMin: 25, taskId: null, projectId: null, label: 'Write, plan', createdAt: '' } as FocusSession;
    expect(body(focusCsv([s]))[1]).toBe('2026-11-02,2026-11-02T09:00:00Z,2026-11-02T09:25:30Z,25.5,25,"Write, plan"');
  });
  it('keeps multi-line journal text in one quoted cell with the mood word', () => {
    const n = { id: 'n', title: 'Day', content: 'line one\nline two', date: '2026-11-02', pinned: false, tags: ['a'], kind: 'journal', mood: 4, ...stamp } as Note;
    expect(notesCsv([n]).replace(/^﻿/, '')).toBe('Date,Kind,Title,Text,Tags,Mood\r\n2026-11-02,journal,Day,"line one\nline two",a,4 Good\r\n');
  });
});
