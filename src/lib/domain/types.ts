/**
 * Shapes of the data repo's files, as far as the editor reads them. The JSON
 * schemas in the data repo's `schemas/` are the definition; these types only
 * describe the fields the app touches, and every type allows the rest.
 */

export type Tier = 'core' | 'practice' | 'stretch';
export type Kind = 'instruction' | 'practice' | 'discussion' | 'review';

export interface Section {
	label?: string;
	section: string;
	duration_minutes: number;
	tier?: Tier;
	kind?: Kind;
}

export interface CurriculumLink {
	framework: string;
	id: string;
	coverage: string;
	mode: string;
	note?: string;
}

export interface Differentiation {
	support?: string;
	extension?: string;
	eald?: string;
	response_modes?: string;
	adhd?: string;
}

export interface Resource {
	name: string;
	url?: string;
	canvas?: string;
	file?: string;
	notes?: string;
}

/** Where a lesson's claims come from: a public link or a file in the repo, never both. */
export interface Reference {
	citation: string;
	url?: string;
	path?: string;
	used_for: string;
}

export interface Lesson {
	title: string;
	description: string;
	summary?: string;
	duration_minutes: number;
	sections: Section[];
	learning_intentions: string[];
	success_criteria: string[];
	curriculum_links: CurriculumLink[];
	assessment?: { formative?: string; evidence?: string[] };
	differentiation?: Differentiation;
	resources?: Resource[];
	references?: Reference[];
	materials?: unknown;
	[key: string]: unknown;
}

export interface RegistryEntry {
	id: string;
	framework: string;
	phase: string;
	text: string;
	owned_by?: string;
	[key: string]: unknown;
}

export interface Unit {
	unit_title: string;
	description?: string;
	syllabus_registry?: RegistryEntry[];
	/** Outcome codes from the subject's `outcome.json`. */
	applicable_outcomes?: string[];
	lessons?: string[];
	[key: string]: unknown;
}

export interface OfferingUnit {
	unit: string;
	term?: string;
	start_date?: string;
	end_date?: string;
	lessons?: string[];
	duration_weeks?: number;
	notes?: string;
	[key: string]: unknown;
}

export interface Offering {
	id: string;
	year: number;
	year_group?: string;
	class_label?: string;
	/** The class's house colour in the editor; see house.ts. */
	colour?: string;
	mode?: string;
	subject: string;
	/** The periods the class has each week; see `calendar/<year>.json`. */
	timetable?: TimetableSlot[];
	units: OfferingUnit[];
	/** The class's folder in cloud storage, an `https:` link. */
	folder?: string;
	[key: string]: unknown;
}

export type Weekday = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri';

/** One period a class has each week, or each Week A or Week B of a fortnight. */
export interface TimetableSlot {
	day: Weekday;
	/** A period id from the calendar, e.g. `P3`. */
	period: string;
	/** Omitted means every week. */
	week?: 'A' | 'B' | 'both';
	[key: string]: unknown;
}

/** One school year's teaching days: `calendar/<year>.json`. Dates are `YYYY-MM-DD`. */
export interface SchoolCalendar {
	year: number;
	periods: { id: string; name?: string; start?: string; end?: string; [key: string]: unknown }[];
	terms: Term[];
	days_off?: DayOff[];
	[key: string]: unknown;
}

export interface Term {
	name: string;
	start: string;
	/** Inclusive. */
	end: string;
	first_week?: 'A' | 'B';
	[key: string]: unknown;
}

/** Days or periods in a term without normal lessons. */
export interface DayOff {
	title: string;
	start: string;
	/** Inclusive; omitted means the one day. */
	end?: string;
	/** Omitted means the whole day. */
	periods?: string[];
	/** As an offering's `year_group` writes them; omitted means every year group. */
	year_groups?: string[];
	[key: string]: unknown;
}
