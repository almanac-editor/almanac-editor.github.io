/**
 * When a class has its lessons: taught ones on the dates their delivery
 * records give, the rest laid forward over the class's free periods.
 *
 * The periods come from two files. The school calendar, `calendar/<year>.json`,
 * holds the terms, the periods of the day and the days off. The offering's
 * `timetable` names the periods the class has each week, or each Week A or
 * Week B of a fortnight. Nothing here is saved: a planned date is worked out
 * each time from what is recorded, so it never goes stale.
 *
 * The rules follow riker's planner (`scheduling_ops.py`): a term opens on its
 * `first_week` (Week A unless it says B) and weeks alternate from the term's
 * first Monday; a day off with no `periods` takes the whole day, and one with
 * `year_groups` only those year groups.
 *
 * Dates are `YYYY-MM-DD` strings throughout, worked as whole UTC days, so no
 * time zone can move a lesson to another day.
 */

import type { DeliveryRecord } from './deliveries.ts';
import { join } from './paths.ts';
import type {
	DayOff,
	Offering,
	SchoolCalendar,
	Term,
	TimetableSlot,
	Unit,
	Weekday
} from './types.ts';

const DAY = 86_400_000;
const WEEKDAYS: (Weekday | null)[] = [null, 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', null];

/** `2026-02-02` -> whole days since 1970-01-01. NaN for anything else. */
export function dayNumber(iso: string): number {
	const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!m) return NaN;
	return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / DAY;
}

export function fromDayNumber(n: number): string {
	return new Date(n * DAY).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
	return fromDayNumber(dayNumber(iso) + days);
}

/** `Mon` to `Fri`, or null for a weekend. */
export function weekdayOf(iso: string): Weekday | null {
	return WEEKDAYS[new Date(dayNumber(iso) * DAY).getUTCDay()] ?? null;
}

/** The Monday on or before the date, as a day number. */
function mondayOf(n: number): number {
	const day = new Date(n * DAY).getUTCDay();
	return n - ((day + 6) % 7);
}

/** The term holding the date, with its number: from its name ("Term 2"), else its place. */
export function termOf(
	iso: string,
	calendars: SchoolCalendar[]
): { term: Term; number: number } | null {
	for (const calendar of calendars) {
		const terms = calendar.terms ?? [];
		for (const [i, term] of terms.entries()) {
			if (term.start <= iso && iso <= term.end) {
				const named = (term.name ?? '').match(/\d+/);
				return { term, number: named ? Number(named[0]) : i + 1 };
			}
		}
	}
	return null;
}

/** Which week of its term the date is in, counting from 1, and whether it is Week A or B. */
export function termWeek(iso: string, term: Term): { week: number; ab: 'A' | 'B' } {
	const week = Math.floor((mondayOf(dayNumber(iso)) - mondayOf(dayNumber(term.start))) / 7) + 1;
	const first = term.first_week === 'B' ? 'B' : 'A';
	const ab = (week - 1) % 2 === 0 ? first : first === 'A' ? 'B' : 'A';
	return { week, ab };
}

/**
 * `T1 W3`, or `T1 W3A` for a class on a fortnightly timetable. Null outside
 * every term.
 */
export function weekLabel(
	iso: string,
	calendars: SchoolCalendar[],
	fortnight: boolean
): string | null {
	const at = termOf(iso, calendars);
	if (!at) return null;
	const { week, ab } = termWeek(iso, at.term);
	return `T${at.number} W${week}${fortnight ? ab : ''}`;
}

/** Whether a timetable changes between Week A and Week B. */
export function isFortnightly(timetable: TimetableSlot[]): boolean {
	return timetable.some((s) => s.week === 'A' || s.week === 'B');
}

function affects(off: DayOff, yearGroup: string | null): boolean {
	return !off.year_groups?.length || (yearGroup != null && off.year_groups.includes(yearGroup));
}

/** The days off that touch the date for this year group (null: every day off). */
export function daysOffOn(
	iso: string,
	calendars: SchoolCalendar[],
	yearGroup: string | null = null
): DayOff[] {
	return calendars
		.flatMap((c) => c.days_off ?? [])
		.filter((off) => off.start <= iso && iso <= (off.end || off.start))
		.filter((off) => yearGroup === null || affects(off, yearGroup));
}

export interface Slot {
	date: string;
	/** A period id from the calendar. */
	period: string;
}

/**
 * Every period the class has across the calendars' terms, in order: by date,
 * then by the period's place in its calendar's day. A day and period counts
 * when it is a weekday inside a term, the timetable has it in that week, and
 * no day off for the class's year group takes it.
 */
export function teachingSlots(
	calendars: SchoolCalendar[],
	timetable: TimetableSlot[],
	yearGroup: string | null
): Slot[] {
	const slots: Slot[] = [];
	if (!timetable.length) return slots;
	for (const calendar of calendars) {
		const order = new Map((calendar.periods ?? []).map((p, i) => [p.id, i]));
		const rank = (id: string) => order.get(id) ?? order.size;
		const offs = (calendar.days_off ?? []).filter((off) => affects(off, yearGroup));
		for (const term of calendar.terms ?? []) {
			const last = dayNumber(term.end);
			for (let n = dayNumber(term.start); n <= last; n++) {
				const date = fromDayNumber(n);
				const day = weekdayOf(date);
				if (!day) continue;
				const { ab } = termWeek(date, term);
				const periods = timetable
					.filter((s) => s.day === day && (!s.week || s.week === 'both' || s.week === ab))
					.map((s) => s.period);
				const off = offs.filter((o) => o.start <= date && date <= (o.end || o.start));
				const free = [...new Set(periods)]
					.filter((p) => !off.some((o) => !o.periods?.length || o.periods.includes(p)))
					.sort((a, b) => rank(a) - rank(b));
				for (const period of free) slots.push({ date, period });
			}
		}
	}
	// Stable: periods within a day keep their order.
	return slots.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** A class's taught dates by the lesson its records name, oldest first. */
export function taughtDates(records: DeliveryRecord[]): Map<string, string[]> {
	const out = new Map<string, string[]>();
	for (const record of records) {
		for (const { taught } of record.deliveries ?? []) {
			if (!taught) continue;
			const list = out.get(record.lesson);
			if (list) list.push(taught);
			else out.set(record.lesson, [taught]);
		}
	}
	for (const list of out.values()) list.sort();
	return out;
}

/** One lesson in a class's teaching order. */
export interface PlanItem {
	/** The lesson plan's path in the repo. */
	path: string;
	/** Its unit's directory. */
	unitDir: string;
	/** Relative to the unit, as the unit's `lessons` writes it. */
	ref: string;
	/** Relative to the subject: the `lesson` a delivery record names. */
	subjectRef: string;
	term: string | null;
	start: string | null;
	end: string | null;
}

/**
 * The class's lessons in teaching order: each unit entry in turn, with its
 * own `lessons` or else the unit's. A lesson in two entries (a unit taken in
 * two parts) appears twice, as the class meets it twice.
 */
export function classOrder(offering: Offering, units: Map<string, Unit>): PlanItem[] {
	const items: PlanItem[] = [];
	for (const entry of offering.units ?? []) {
		const unitDir = join(offering.subject ?? '', entry.unit);
		const refs = entry.lessons ?? units.get(unitDir)?.lessons ?? [];
		for (const ref of refs) {
			items.push({
				path: join(unitDir, ref),
				unitDir,
				ref,
				subjectRef: join(entry.unit, ref),
				term: entry.term ?? null,
				start: entry.start_date || null,
				end: entry.end_date || null
			});
		}
	}
	return items;
}

export interface Placed {
	item: PlanItem;
	date: string;
	/** The period it takes; null when the date has none of the class's periods free. */
	period: string | null;
}

export interface ClassPlan {
	taught: Placed[];
	/** In teaching order. Those before `today` are also in `unmarked`. */
	planned: Placed[];
	/** Planned before today but with no taught date: taught and not marked, or the class is behind. */
	unmarked: Placed[];
	/** Planned past its unit entry's `end_date`. */
	late: Placed[];
	/** Lessons still to teach once the calendar has no periods left. */
	unplaced: PlanItem[];
	/** Taught dates for lessons not in the class's order, by subject-relative path. */
	elsewhere: { subjectRef: string; date: string }[];
}

/**
 * Lays the class's lessons over its periods.
 *
 * - **Taught.** A lesson goes on its taught date. A lesson the class met
 *   twice takes its dates in order, one per appearance. It takes the first of
 *   the class's periods that day, which planned lessons then skip. So does a
 *   taught lesson outside the order (listed as `elsewhere`).
 * - **Planned.** Every other lesson, in order, takes the next free period
 *   after the lesson before it, taught or planned, and on or after its
 *   entry's `start_date`. One that falls before today is listed as unmarked,
 *   and one past its entry's `end_date` as late.
 *
 * Planning on from the last lesson, not from today, keeps a unit in the
 * weeks it ran when a few lessons were never marked taught, and says which.
 *
 * `taught` maps a delivery record's `lesson` to its taught dates.
 */
export function planClass(
	order: PlanItem[],
	taught: Map<string, string[]>,
	slots: Slot[],
	today: string
): ClassPlan {
	const queues = new Map([...taught].map(([ref, dates]) => [ref, [...dates].sort()]));
	const used = new Set<number>();
	const byDate = new Map<string, number[]>();
	for (const [i, slot] of slots.entries()) {
		const list = byDate.get(slot.date);
		if (list) list.push(i);
		else byDate.set(slot.date, [i]);
	}
	/** The first slot after the date. */
	const after = (date: string) => {
		const i = slots.findIndex((s) => s.date > date);
		return i === -1 ? slots.length : i;
	};
	const take = (date: string): number | null => {
		const at = (byDate.get(date) ?? []).find((i) => !used.has(i));
		if (at === undefined) return null;
		used.add(at);
		return at;
	};

	// Taught lessons first, so the periods they took are taken before planning.
	const dates = order.map((item) => queues.get(item.subjectRef)?.shift() ?? null);
	const taken = dates.map((date) => (date ? take(date) : null));
	const plan: ClassPlan = {
		taught: [],
		planned: [],
		unmarked: [],
		late: [],
		unplaced: [],
		elsewhere: []
	};
	for (const [subjectRef, rest] of queues) {
		for (const date of rest) {
			take(date);
			plan.elsewhere.push({ subjectRef, date });
		}
	}

	let cursor = 0;
	for (const [n, item] of order.entries()) {
		const date = dates[n];
		if (date) {
			const at = taken[n];
			plan.taught.push({ item, date, period: at === null ? null : slots[at].period });
			cursor = Math.max(cursor, at === null ? after(date) : at + 1);
			continue;
		}
		let i = cursor;
		while (i < slots.length && ((item.start && slots[i].date < item.start) || used.has(i))) i++;
		if (i >= slots.length) {
			plan.unplaced.push(item);
			continue;
		}
		used.add(i);
		cursor = i + 1;
		const placed = { item, date: slots[i].date, period: slots[i].period };
		plan.planned.push(placed);
		if (placed.date < today) plan.unmarked.push(placed);
		if (item.end && placed.date > item.end) plan.late.push(placed);
	}
	return plan;
}
