/**
 * Editing a school calendar, `calendar/<year>.json`, without disturbing the
 * file. As with lessons and offerings:
 *
 * - Keys keep the order the file had; a new key goes in at its schema place.
 * - An optional field cleared to empty is removed, unless the file already
 *   held it empty.
 * - A row carries the object it came from, so a key the editor does not know
 *   is copied through.
 */

import { normaliseText } from './format.ts';
import { keysOf, ordered, setField } from './lessonEdit.ts';
import type { DayOff, SchoolCalendar, Term } from './types.ts';

const CALENDAR_ORDER = ['year', 'periods', 'terms', 'days_off'];
const PERIOD_ORDER = ['id', 'name', 'start', 'end'];
const TERM_ORDER = ['name', 'start', 'end', 'first_week'];
const OFF_ORDER = ['title', 'start', 'end', 'periods', 'year_groups'];

type From = { __from?: Record<string, unknown> };

export type PeriodDraft = { id: string; name: string; start: string; end: string } & From;
export type TermDraft = {
	name: string;
	start: string;
	end: string;
	/** '' leaves the term on the default, Week A. */
	first_week: '' | 'A' | 'B';
} & From;
/** `periods` and `year_groups` as comma-separated text; '' means all of them. */
export type DayOffDraft = {
	title: string;
	start: string;
	end: string;
	periods: string;
	year_groups: string;
} & From;

export interface CalendarDraft {
	periods: PeriodDraft[];
	terms: TermDraft[];
	days_off: DayOffDraft[];
}

const str = (value: unknown) => (typeof value === 'string' ? value : '');
const list = (value: unknown) => (Array.isArray(value) ? value.map(String).join(', ') : '');
const rows = <T>(value: unknown) => (Array.isArray(value) ? (value as T[]) : []);

export function toCalendarDraft(calendar: SchoolCalendar): CalendarDraft {
	return {
		periods: rows<Record<string, unknown>>(calendar.periods).map((p) => ({
			id: str(p.id),
			name: str(p.name),
			start: str(p.start),
			end: str(p.end),
			__from: structuredClone(p)
		})),
		terms: rows<Term>(calendar.terms).map((t) => ({
			name: str(t.name),
			start: str(t.start),
			end: str(t.end),
			first_week: t.first_week === 'A' || t.first_week === 'B' ? t.first_week : '',
			__from: structuredClone(t)
		})),
		days_off: rows<DayOff>(calendar.days_off).map((d) => ({
			title: str(d.title),
			start: str(d.start),
			end: str(d.end),
			periods: list(d.periods),
			year_groups: list(d.year_groups),
			__from: structuredClone(d)
		}))
	};
}

/**
 * A new year's calendar: the periods of the year before, if there is one,
 * since a school's bell times rarely change; no terms or days off yet.
 */
export function blankCalendar(year: number, previous?: SchoolCalendar | null): SchoolCalendar {
	return {
		year,
		periods: previous?.periods ? structuredClone(previous.periods) : [],
		terms: []
	};
}

export function newPeriod(n: number): PeriodDraft {
	return { id: `P${n}`, name: `Period ${n}`, start: '', end: '' };
}

export function newTerm(n: number): TermDraft {
	return { name: `Term ${n}`, start: '', end: '', first_week: '' };
}

export function newDayOff(): DayOffDraft {
	return { title: '', start: '', end: '', periods: '', year_groups: '' };
}

export function fromCalendarDraft(original: SchoolCalendar, draft: CalendarDraft): SchoolCalendar {
	const out: Record<string, unknown> = { ...original };
	out.periods = draft.periods.map(periodFrom);
	out.terms = draft.terms.map(termFrom);
	setField(out, original, 'days_off', draft.days_off.map(dayOffFrom), true);
	return ordered(out, Object.keys(original), CALENDAR_ORDER) as SchoolCalendar;
}

function periodFrom(d: PeriodDraft): Record<string, unknown> {
	const from = d.__from ?? {};
	const item: Record<string, unknown> = { ...from, id: text(d.id) };
	setField(item, from, 'name', text(d.name), true);
	setField(item, from, 'start', d.start, true);
	setField(item, from, 'end', d.end, true);
	return ordered(item, keysOf(d.__from), PERIOD_ORDER);
}

function termFrom(d: TermDraft): Term {
	const from = d.__from ?? {};
	const item: Record<string, unknown> = { ...from, name: text(d.name), start: d.start, end: d.end };
	setField(item, from, 'first_week', d.first_week, true);
	return ordered(item, keysOf(d.__from), TERM_ORDER) as Term;
}

function dayOffFrom(d: DayOffDraft): DayOff {
	const from = d.__from ?? {};
	const item: Record<string, unknown> = { ...from, title: text(d.title), start: d.start };
	// A one-day entry needs no end; one the file gave an end keeps it.
	setField(item, from, 'end', d.end === d.start && !('end' in from) ? '' : d.end, true);
	setField(item, from, 'periods', split(d.periods), true);
	setField(item, from, 'year_groups', split(d.year_groups), true);
	return ordered(item, keysOf(d.__from), OFF_ORDER) as DayOff;
}

function split(value: string): string[] {
	return value
		.split(',')
		.map((v) => normaliseText(v).trim())
		.filter(Boolean);
}

function text(value: string): string {
	return normaliseText(value).trim();
}

/** What stops the draft being saved, as sentences; empty when it can be. */
export function calendarProblems(draft: CalendarDraft): string[] {
	const problems: string[] = [];
	const ids = draft.periods.map((p) => p.id.trim());
	if (ids.some((id) => !id)) problems.push('Every period needs a short name, such as P1.');
	if (new Set(ids).size !== ids.length) problems.push('Two periods have the same short name.');
	for (const [i, t] of draft.terms.entries()) {
		const name = t.name.trim() || `Term ${i + 1}`;
		if (!t.name.trim()) problems.push(`Term ${i + 1} needs a name.`);
		if (!t.start || !t.end) problems.push(`${name} needs a first and a last day.`);
		else if (t.end < t.start) problems.push(`${name} ends before it starts.`);
	}
	for (const d of draft.days_off) {
		const name = d.title.trim() || 'A day off';
		if (!d.title.trim()) problems.push('Every day off needs a name.');
		if (!d.start) problems.push(`${name} needs a date.`);
		else if (d.end && d.end < d.start) problems.push(`${name} ends before it starts.`);
		const unknown = split(d.periods).filter((p) => !ids.includes(p));
		if (unknown.length)
			problems.push(`${name} names periods the day does not have: ${unknown.join(', ')}.`);
	}
	return problems;
}
