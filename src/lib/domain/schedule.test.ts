import { describe, expect, it } from 'vitest';
import {
	addDays,
	classOrder,
	daysOffOn,
	isFortnightly,
	planClass,
	taughtDates,
	teachingSlots,
	termOf,
	termWeek,
	weekdayOf,
	weekLabel
} from './schedule.ts';
import type { Offering, SchoolCalendar, TimetableSlot, Unit } from './types.ts';

// Made up. 2 February 2026 is a Monday.
const calendar = (): SchoolCalendar => ({
	year: 2026,
	periods: [{ id: 'P1' }, { id: 'P2' }, { id: 'P3' }, { id: 'P4' }],
	terms: [
		{ name: 'Term 1', start: '2026-02-02', end: '2026-02-27' },
		{ name: 'Term 2', start: '2026-04-27', end: '2026-05-08', first_week: 'B' }
	],
	days_off: [
		{ title: 'Whole day', start: '2026-02-09' },
		{ title: 'Assembly', start: '2026-02-12', periods: ['P2'] },
		{ title: 'Camp', start: '2026-02-17', end: '2026-02-18', year_groups: ['Year 7'] }
	]
});

const timetable: TimetableSlot[] = [
	{ day: 'Thu', period: 'P1', week: 'A' },
	{ day: 'Mon', period: 'P3', week: 'both' },
	{ day: 'Thu', period: 'P2', week: 'B' },
	{ day: 'Wed', period: 'P4' }
];

const flat = (slots: { date: string; period: string }[]) =>
	slots.map((s) => `${s.date} ${s.period}`);

describe('dates', () => {
	it('works in whole days', () => {
		expect(weekdayOf('2026-02-02')).toBe('Mon');
		expect(weekdayOf('2026-02-07')).toBeNull();
		expect(addDays('2026-02-27', 3)).toBe('2026-03-02');
		expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
	});

	it('finds the term and its number', () => {
		expect(termOf('2026-02-10', [calendar()])?.number).toBe(1);
		expect(termOf('2026-05-08', [calendar()])?.number).toBe(2);
		expect(termOf('2026-03-10', [calendar()])).toBeNull();
	});

	it('counts weeks from the term’s first Monday and alternates A and B', () => {
		const [t1, t2] = calendar().terms;
		expect(termWeek('2026-02-06', t1)).toEqual({ week: 1, ab: 'A' });
		expect(termWeek('2026-02-09', t1)).toEqual({ week: 2, ab: 'B' });
		expect(termWeek('2026-02-16', t1)).toEqual({ week: 3, ab: 'A' });
		// Term 2 opens on Week B.
		expect(termWeek('2026-04-27', t2)).toEqual({ week: 1, ab: 'B' });
		expect(termWeek('2026-05-04', t2)).toEqual({ week: 2, ab: 'A' });
	});

	it('counts a term that starts mid-week from that week’s Monday', () => {
		const term = { name: 'Term 3', start: '2026-07-22', end: '2026-09-25' };
		expect(termWeek('2026-07-24', term).week).toBe(1);
		expect(termWeek('2026-07-27', term).week).toBe(2);
	});

	it('labels a week, with A or B only for a fortnight', () => {
		expect(weekLabel('2026-02-10', [calendar()], true)).toBe('T1 W2B');
		expect(weekLabel('2026-02-10', [calendar()], false)).toBe('T1 W2');
		expect(weekLabel('2026-03-10', [calendar()], true)).toBeNull();
		expect(isFortnightly(timetable)).toBe(true);
		expect(isFortnightly([{ day: 'Mon', period: 'P1' }])).toBe(false);
	});

	it('finds the days off a year group has', () => {
		expect(daysOffOn('2026-02-17', [calendar()], 'Year 7').map((d) => d.title)).toEqual(['Camp']);
		expect(daysOffOn('2026-02-17', [calendar()], 'Year 10')).toEqual([]);
		expect(daysOffOn('2026-02-17', [calendar()]).map((d) => d.title)).toEqual(['Camp']);
	});
});

describe('teachingSlots', () => {
	it('keeps the timetabled periods inside terms, minus the days off', () => {
		const slots = flat(teachingSlots([calendar()], timetable, 'Year 10'));
		expect(slots.slice(0, 7)).toEqual([
			// Week 1, A
			'2026-02-02 P3',
			'2026-02-04 P4',
			'2026-02-05 P1',
			// Week 2, B: Monday is off, and Thursday's P2 has assembly.
			'2026-02-11 P4',
			// Week 3, A: camp is for Year 7 only.
			'2026-02-16 P3',
			'2026-02-18 P4',
			'2026-02-19 P1'
		]);
		// Term 2 opens on Week B, so Thursday is P2 first, then P1.
		expect(slots.filter((s) => s >= '2026-04')).toEqual([
			'2026-04-27 P3',
			'2026-04-29 P4',
			'2026-04-30 P2',
			'2026-05-04 P3',
			'2026-05-06 P4',
			'2026-05-07 P1'
		]);
	});

	it('takes out a day off for the class’s own year group', () => {
		const slots = flat(teachingSlots([calendar()], timetable, 'Year 7'));
		expect(slots).not.toContain('2026-02-18 P4');
		expect(slots).toContain('2026-02-16 P3');
	});

	it('orders a day’s periods as the calendar lists them', () => {
		const tt: TimetableSlot[] = [
			{ day: 'Mon', period: 'P4' },
			{ day: 'Mon', period: 'P1' }
		];
		expect(flat(teachingSlots([calendar()], tt, null)).slice(0, 2)).toEqual([
			'2026-02-02 P1',
			'2026-02-02 P4'
		]);
	});

	it('runs across two calendar years', () => {
		const next: SchoolCalendar = {
			year: 2027,
			periods: [{ id: 'P3' }],
			terms: [{ name: 'Term 1', start: '2027-02-01', end: '2027-02-05' }]
		};
		const slots = flat(teachingSlots([next, calendar()], [{ day: 'Mon', period: 'P3' }], null));
		expect(slots.at(-1)).toBe('2027-02-01 P3');
		expect(slots[0]).toBe('2026-02-02 P3');
	});

	it('gives nothing without a timetable', () => {
		expect(teachingSlots([calendar()], [], null)).toEqual([]);
	});
});

describe('classOrder', () => {
	it('walks the unit entries in order, each with its own list or the unit’s', () => {
		const offering: Offering = {
			id: 'c',
			year: 2026,
			subject: 'subjects/socks',
			units: [
				{ unit: 'units/pairs', term: 'Term 1', start_date: '2026-02-02', lessons: ['l/02.json'] },
				{ unit: 'units/darning', term: 'Term 2' },
				{ unit: 'units/pairs', term: 'Term 2', lessons: ['l/01.json'] }
			]
		};
		const units = new Map<string, Unit>([
			['subjects/socks/units/darning', { unit_title: 'Darning', lessons: ['l/a.json', 'l/b.json'] }]
		]);
		const order = classOrder(offering, units);
		expect(order.map((i) => i.path)).toEqual([
			'subjects/socks/units/pairs/l/02.json',
			'subjects/socks/units/darning/l/a.json',
			'subjects/socks/units/darning/l/b.json',
			'subjects/socks/units/pairs/l/01.json'
		]);
		expect(order[0]).toMatchObject({
			subjectRef: 'units/pairs/l/02.json',
			ref: 'l/02.json',
			term: 'Term 1',
			start: '2026-02-02',
			end: null
		});
	});
});

describe('planClass', () => {
	const item = (n: number, extra: { start?: string; end?: string } = {}) => ({
		path: `s/units/u/l/${n}.json`,
		unitDir: 's/units/u',
		ref: `l/${n}.json`,
		subjectRef: `units/u/l/${n}.json`,
		term: null,
		start: extra.start ?? null,
		end: extra.end ?? null
	});
	const slots = () => teachingSlots([calendar()], timetable, 'Year 10');
	const dates = (placed: { date: string; period: string | null }[]) =>
		placed.map((p) => `${p.date} ${p.period}`);

	it('puts taught lessons on their dates and plans on from the last one', () => {
		const taught = new Map([
			['units/u/l/1.json', ['2026-02-02']],
			['units/u/l/2.json', ['2026-02-04']]
		]);
		const plan = planClass([item(1), item(2), item(3), item(4)], taught, slots(), '2026-02-04');
		expect(dates(plan.taught)).toEqual(['2026-02-02 P3', '2026-02-04 P4']);
		expect(dates(plan.planned)).toEqual(['2026-02-05 P1', '2026-02-11 P4']);
		expect(plan.unmarked).toEqual([]);
		expect(plan.unplaced).toEqual([]);
	});

	it('lists planned lessons already past as unmarked', () => {
		const taught = new Map([['units/u/l/1.json', ['2026-02-02']]]);
		const plan = planClass([item(1), item(2), item(3)], taught, slots(), '2026-02-11');
		expect(dates(plan.planned)).toEqual(['2026-02-04 P4', '2026-02-05 P1']);
		expect(dates(plan.unmarked)).toEqual(['2026-02-04 P4', '2026-02-05 P1']);
	});

	it('plans a lesson after a later one that was taught', () => {
		const taught = new Map([['units/u/l/2.json', ['2026-02-11']]]);
		const plan = planClass([item(1), item(2), item(3)], taught, slots(), '2026-02-01');
		// Lesson 1 was skipped or not marked; lesson 3 comes after lesson 2.
		expect(dates(plan.planned)).toEqual(['2026-02-02 P3', '2026-02-16 P3']);
	});

	it('keeps a taught date with none of the class’s periods', () => {
		const taught = new Map([['units/u/l/1.json', ['2026-02-03']]]);
		const plan = planClass([item(1)], taught, slots(), '2026-02-01');
		expect(dates(plan.taught)).toEqual(['2026-02-03 null']);
	});

	it('gives a lesson met twice its dates in order', () => {
		const taught = new Map([['units/u/l/1.json', ['2026-02-11', '2026-02-02']]]);
		const plan = planClass([item(1), item(2), item(1)], taught, slots(), '2026-02-01');
		expect(dates(plan.taught)).toEqual(['2026-02-02 P3', '2026-02-11 P4']);
		// Lesson 2 goes between them.
		expect(dates(plan.planned)).toEqual(['2026-02-04 P4']);
	});

	it('waits for a unit entry’s start date, and keeps order after it', () => {
		const plan = planClass(
			[item(1, { start: '2026-02-16' }), item(2)],
			new Map(),
			slots(),
			'2026-02-01'
		);
		expect(dates(plan.planned)).toEqual(['2026-02-16 P3', '2026-02-18 P4']);
	});

	it('lists lessons past their entry’s end date as late', () => {
		const plan = planClass(
			[item(1, { end: '2026-02-02' }), item(2, { end: '2026-02-02' })],
			new Map(),
			slots(),
			'2026-02-01'
		);
		expect(dates(plan.late)).toEqual(['2026-02-04 P4']);
	});

	it('lists what does not fit once the periods run out', () => {
		const few = slots().slice(0, 2);
		const plan = planClass([item(1), item(2), item(3)], new Map(), few, '2026-02-01');
		expect(plan.planned).toHaveLength(2);
		expect(plan.unplaced.map((i) => i.ref)).toEqual(['l/3.json']);
	});

	it('keeps taught records for lessons outside the order', () => {
		const taught = new Map([['units/other/l/9.json', ['2026-02-02']]]);
		const plan = planClass([item(1)], taught, slots(), '2026-02-01');
		expect(plan.elsewhere).toEqual([{ subjectRef: 'units/other/l/9.json', date: '2026-02-02' }]);
		// It still used that day's period.
		expect(dates(plan.planned)).toEqual(['2026-02-04 P4']);
	});
});

describe('taughtDates', () => {
	it('collects each lesson’s taught dates, oldest first, skipping runs with none', () => {
		const dates = taughtDates([
			{ offering: 'c', lesson: 'units/u/l/1.json', deliveries: [{ taught: '2026-05-01' }, {}] },
			{ offering: 'c', lesson: 'units/u/l/1.json', deliveries: [{ taught: '2026-02-01' }] },
			{ offering: 'c', lesson: 'units/u/l/2.json', deliveries: [{ source: 'migrated' }] }
		]);
		expect([...dates]).toEqual([['units/u/l/1.json', ['2026-02-01', '2026-05-01']]]);
	});
});
