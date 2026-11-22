import { describe, expect, it } from 'vitest';
import { parseCapture } from '../../src/lib/domain/capture';
import type { DateKey } from '../../src/lib/util/dates';

const TODAY = '2026-11-23' as DateKey; // a Monday

describe('quick capture', () => {
  it('reads a date, a time, a tag and a priority', () => {
    expect(parseCapture('Call mom tomorrow 6pm #family !high', TODAY)).toEqual({
      title: 'Call mom', dueDate: '2026-11-24', dueTime: '18:00', reminder: true, priority: 'high', tags: ['family'],
    });
  });
  it('keeps a plain line as the title with no date', () => {
    expect(parseCapture('Buy oat milk', TODAY)).toMatchObject({ title: 'Buy oat milk', dueDate: null, dueTime: null, reminder: false, priority: null, tags: [] });
  });
  it('understands weekdays, "next", weekends and "in N days"', () => {
    expect(parseCapture('Dentist on friday', TODAY).dueDate).toBe('2026-11-27');
    expect(parseCapture('Review monday', TODAY).dueDate).toBe('2026-11-30');          // said on a Monday → next Monday
    expect(parseCapture('Team sync next wed', TODAY).dueDate).toBe('2026-12-02');
    expect(parseCapture('Hike this weekend', TODAY).dueDate).toBe('2026-11-28');
    expect(parseCapture('Renew passport in 3 days', TODAY).dueDate).toBe('2026-11-26');
    expect(parseCapture('Plan trip in 2 weeks', TODAY).dueDate).toBe('2026-12-07');
    expect(parseCapture('Clean up next week', TODAY).dueDate).toBe('2026-11-30');
  });
  it('understands month names and rolls past dates to next year', () => {
    expect(parseCapture('Pay rent dec 1', TODAY).dueDate).toBe('2026-12-01');
    expect(parseCapture('Birthday 5th March', TODAY).dueDate).toBe('2027-03-05');
  });
  it('understands 24h times, "at 9", noon and parts of the day; a time alone means today', () => {
    expect(parseCapture('Standup 09:30', TODAY)).toMatchObject({ title: 'Standup', dueDate: TODAY, dueTime: '09:30', reminder: true });
    expect(parseCapture('Gym at 7', TODAY).dueTime).toBe('07:00');
    expect(parseCapture('Lunch with Sam at noon', TODAY).dueTime).toBe('12:00');
    expect(parseCapture('Read tonight', TODAY)).toMatchObject({ dueDate: TODAY, dueTime: '20:00' });
    expect(parseCapture('Call the bank tomorrow morning', TODAY)).toMatchObject({ title: 'Call the bank', dueDate: '2026-11-24', dueTime: '09:00' });
  });
  it('handles several tags, other priorities and "remind me"', () => {
    const c = parseCapture('remind me Water plants #home #weekly !low', TODAY);
    expect(c).toMatchObject({ title: 'Water plants', priority: 'low', tags: ['home', 'weekly'], reminder: true });
    expect(parseCapture('Draft report !! ', TODAY).priority).toBe('medium');
  });
  it('reads day words as dates (the preview chips show it), but leaves names that only start like one', () => {
    expect(parseCapture('Read Monday Morning Leadership', TODAY).title).toBe('Read Leadership');
    expect(parseCapture('Email Sunita', TODAY).title).toBe('Email Sunita');
  });
});
