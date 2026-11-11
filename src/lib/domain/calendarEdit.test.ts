import { describe, expect, it } from 'vitest';
import {
	blankCalendar,
	calendarProblems,
	fromCalendarDraft,
	newDayOff,
	newPeriod,
	newTerm,
	toCalendarDraft
} from './calendarEdit.ts';
import { dump } from './format.ts';
import type { SchoolCalendar } from './types.ts';

// Made up.
const calendar = (): SchoolCalendar => ({
	year: 2030,
	periods: [
		{ id: 'P1', name: 'Period 1', start: '08:50', end: '09:50' },
		{ name: 'Roll call', id: 'RC', room: 'kept' }
	],
	terms: [
		{ name: 'Term 1', start: '2030-02-04', end: '2030-04-12' },
		{ name: 'Term 2', start: '2030-04-29', end: '2030-07-05', first_week: 'B' }
	],
	days_off: [
		{ title: 'Carnival', start: '2030-02-22' },
		{ title: 'Camp', start: '2030-03-13', end: '2030-03-15', year_groups: ['Year 7'] },
		{ title: 'Assembly', start: '2030-05-02', end: '2030-05-02', periods: ['P1'] }
	]
});

describe('calendar editing', () => {
	it('gives back the same bytes for an untouched draft', () => {
		const original = calendar();
		expect(dump(fromCalendarDraft(original, toCalendarDraft(original)))).toBe(dump(original));
	});

	it('writes new rows with only the fields they have, in schema order', () => {
		const original: SchoolCalendar = { year: 2030, periods: [], terms: [] };
		const draft = toCalendarDraft(original);
		draft.periods.push({ ...newPeriod(1), start: '08:50' });
		draft.terms.push({ ...newTerm(1), start: '2030-02-04', end: '2030-04-12' });
		draft.days_off.push({
			...newDayOff(),
			title: 'Assembly',
			start: '2030-02-07',
			end: '2030-02-07',
			periods: 'P1, ',
			year_groups: ' Year 7 , Year 8'
		});
		expect(fromCalendarDraft(original, draft)).toEqual({
			year: 2030,
			periods: [{ id: 'P1', name: 'Period 1', start: '08:50' }],
			terms: [{ name: 'Term 1', start: '2030-02-04', end: '2030-04-12' }],
			days_off: [
				{
					title: 'Assembly',
					start: '2030-02-07',
					periods: ['P1'],
					year_groups: ['Year 7', 'Year 8']
				}
			]
		});
	});

	it('removes cleared fields and an emptied list of days off', () => {
		const original = calendar();
		const draft = toCalendarDraft(original);
		draft.terms[1].first_week = '';
		draft.days_off[1].year_groups = '';
		let next = fromCalendarDraft(original, draft);
		expect(next.terms[1]).toEqual({ name: 'Term 2', start: '2030-04-29', end: '2030-07-05' });
		expect(next.days_off?.[1]).toEqual({ title: 'Camp', start: '2030-03-13', end: '2030-03-15' });
		draft.days_off = [];
		next = fromCalendarDraft(original, draft);
		expect('days_off' in next).toBe(false);
	});

	it('starts a new year with the previous year’s periods only', () => {
		const next = blankCalendar(2031, calendar());
		expect(next).toEqual({ year: 2031, periods: calendar().periods, terms: [] });
		expect(blankCalendar(2031)).toEqual({ year: 2031, periods: [], terms: [] });
	});

	it('says what stops a save', () => {
		expect(calendarProblems(toCalendarDraft(calendar()))).toEqual([]);
		const draft = toCalendarDraft(calendar());
		draft.periods.push(newPeriod(1));
		draft.terms[0].end = '2030-01-01';
		draft.terms.push(newTerm(3));
		draft.days_off[2].periods = 'P1, P9';
		expect(calendarProblems(draft)).toEqual([
			'Two periods have the same short name.',
			'Term 1 ends before it starts.',
			'Term 3 needs a first and a last day.',
			'Assembly names periods the day does not have: P9.'
		]);
	});
});
