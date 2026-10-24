/**
 * Editing an offering without disturbing the rest of the file.
 *
 * `withColour` sets the one field the home page's picker writes. `toClassDraft` and
 * `fromClassDraft` are the class editor's: the units it takes and their order, each
 * unit's term, dates, weeks, notes and lesson list, the one-offs, the mode, the
 * cohort and the class's folder. As with lessons:
 *
 * - Keys keep the order the file had; a new key goes in at its schema place.
 * - An optional field cleared to empty is removed, unless the file already
 *   held it empty.
 * - A unit entry or one-off carries the object it came from, so a moved item
 *   keeps its key order, and a key the editor does not know is copied through.
 * - `canvas`, `colour`, `differentiation` and the class's name are not edited
 *   here and pass through unchanged.
 */

import { normaliseText } from './format.ts';
import { EditError, keysOf, ordered, setField } from './lessonEdit.ts';
import { httpsHost } from './materials.ts';
import type { Offering, OfferingUnit } from './types.ts';

/** Schema order, for placing a key the file did not have. */
export const OFFERING_ORDER = [
	'id',
	'year',
	'year_group',
	'class_label',
	'colour',
	'mode',
	'subject',
	'cohort',
	'units',
	'one_offs',
	'canvas',
	'folder',
	'differentiation'
];
const ENTRY_ORDER = [
	'unit',
	'term',
	'start_date',
	'end_date',
	'duration_weeks',
	'notes',
	'lessons'
];
const ONE_OFF_ORDER = ['path', 'term', 'notes'];
const COHORT_ORDER = ['size', 'notes'];

/** The schema's modes. A file holding another value keeps it. */
export const MODES = ['standard', 'intensive', 'remote', 'mixed'] as const;

/** The item a draft entry was made from; absent for one added in the editor. */
type From = { __from?: Record<string, unknown> };

export type EntryDraft = {
	unit: string;
	term: string;
	start_date: string;
	end_date: string;
	duration_weeks: number | null;
	notes: string;
	/** This class's lessons for the unit; null means the unit's own list (no `lessons` key). */
	lessons: string[] | null;
} & From;

export type OneOffDraft = { path: string; term: string; notes: string } & From;

export interface OfferingDraft {
	mode: string;
	cohort: { size: number | null; notes: string };
	units: EntryDraft[];
	one_offs: OneOffDraft[];
	/** The class's folder in cloud storage, an `https:` link; empty for none. */
	folder: string;
}

/** The offering with `colour` set, or removed when `colour` is null. */
export function withColour(offering: Offering, colour: string | null): Offering {
	const next: Record<string, unknown> = { ...offering };
	if (colour === null) delete next.colour;
	else next.colour = colour;
	return ordered(next, Object.keys(offering), OFFERING_ORDER) as Offering;
}

const str = (value: unknown) => (typeof value === 'string' ? value : '');

export function toClassDraft(offering: Offering): OfferingDraft {
	const cohort = (offering.cohort ?? {}) as { size?: number; notes?: string };
	const oneOffs = Array.isArray(offering.one_offs)
		? (offering.one_offs as Record<string, unknown>[])
		: [];
	return {
		mode: str(offering.mode),
		cohort: { size: cohort.size ?? null, notes: cohort.notes ?? '' },
		units: (offering.units ?? []).map((e) => ({
			unit: e.unit,
			term: str(e.term),
			start_date: str(e.start_date),
			end_date: str(e.end_date),
			duration_weeks: e.duration_weeks ?? null,
			notes: str(e.notes),
			lessons: e.lessons ? [...e.lessons] : null,
			__from: structuredClone(e)
		})),
		one_offs: oneOffs.map((o) => ({
			path: str(o.path),
			term: str(o.term),
			notes: str(o.notes),
			__from: structuredClone(o)
		})),
		folder: str(offering.folder)
	};
}

/** A unit entry added in the editor, taking the unit's own list of lessons. */
export function newEntry(unit: string, term = ''): EntryDraft {
	return {
		unit,
		term,
		start_date: '',
		end_date: '',
		duration_weeks: null,
		notes: '',
		lessons: null
	};
}

export function newOneOff(path: string, term = ''): OneOffDraft {
	return { path, term, notes: '' };
}

export function fromClassDraft(original: Offering, draft: OfferingDraft): Offering {
	const out: Record<string, unknown> = { ...original };
	setField(out, original, 'mode', draft.mode, true);

	const before = (original.cohort ?? {}) as Record<string, unknown>;
	const cohort: Record<string, unknown> = { ...before };
	setField(cohort, before, 'size', number(draft.cohort.size), true);
	setField(cohort, before, 'notes', text(draft.cohort.notes), true);
	setField(
		out,
		original,
		'cohort',
		ordered(cohort, keysOf(original.cohort as object), COHORT_ORDER),
		true
	);

	out.units = draft.units.map(entryFrom);
	setField(out, original, 'one_offs', draft.one_offs.map(oneOffFrom), true);
	const folder = draft.folder.trim();
	if (folder && !httpsHost(folder)) {
		throw new EditError('The class folder must be a web address starting https://.');
	}
	setField(out, original, 'folder', folder, true);

	return ordered(out, Object.keys(original), OFFERING_ORDER) as Offering;
}

function entryFrom(d: EntryDraft): OfferingUnit {
	const from = d.__from ?? {};
	const item: Record<string, unknown> = { ...from, unit: d.unit };
	setField(item, from, 'term', text(d.term), true);
	setField(item, from, 'start_date', d.start_date, true);
	setField(item, from, 'end_date', d.end_date, true);
	setField(item, from, 'duration_weeks', number(d.duration_weeks), true);
	setField(item, from, 'notes', text(d.notes), true);
	// An empty list is kept for the schema to refuse: dropping it would quietly mean "every plan".
	if (d.lessons === null) delete item.lessons;
	else item.lessons = [...d.lessons];
	return ordered(item, keysOf(d.__from), ENTRY_ORDER) as OfferingUnit;
}

function oneOffFrom(d: OneOffDraft): Record<string, unknown> {
	const from = d.__from ?? {};
	const item: Record<string, unknown> = { ...from, path: d.path };
	setField(item, from, 'term', text(d.term), true);
	setField(item, from, 'notes', text(d.notes), true);
	return ordered(item, keysOf(d.__from), ONE_OFF_ORDER);
}

function text(value: string | null | undefined): string {
	return normaliseText(value ?? '');
}

/** A number field's value, with a cleared field (null, undefined or '') as null. */
function number(value: unknown): number | null {
	return typeof value === 'number' && !Number.isNaN(value) ? value : null;
}
