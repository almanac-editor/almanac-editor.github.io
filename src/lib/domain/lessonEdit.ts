/**
 * Editing a lesson plan without disturbing what the editor did not touch.
 *
 * `toDraft` turns a plan into a working copy with every editable field present,
 * so a form can bind to it. `fromDraft` turns the draft back into a plan
 * against the original:
 *
 * - Keys keep the order the file had. A key the file did not have goes in at
 *   its place in the schema's order, after the nearest key that precedes it.
 * - An optional field left empty is removed, unless the file already held it
 *   empty, so saving an untouched draft gives back the same bytes.
 * - Blank entries in string lists are dropped.
 * - What the editor never changes is copied through: `materials`, a curriculum
 *   link's framework, id, coverage and mode, a resource's url, canvas and file,
 *   and any key the editor does not know.
 * - A reference is edited whole: its citation, its link or file, and what it
 *   is used for. It has a link or a file, never both, and is refused with
 *   neither.
 */

import { normaliseText } from './format.ts';
import type { CurriculumLink, Kind, Lesson, Reference, Resource, Section, Tier } from './types.ts';

/** Original key order of a list item, carried through the draft so a moved item keeps it. */
type Keyed = { __keys?: string[] };

export type SectionDraft = {
	label: string;
	section: string;
	duration_minutes: number | null;
	tier: Tier | '';
	kind: Kind | '';
} & Keyed;
export type LinkDraft = CurriculumLink & { note: string } & Keyed;
export type ResourceDraft = Resource & { notes: string } & Keyed;
/** `where` is the link when `source` is `url`, and the file's path in the repo when it is `path`. */
export type ReferenceDraft = {
	citation: string;
	source: 'url' | 'path';
	where: string;
	used_for: string;
} & Keyed;

export const DIFFERENTIATION_KEYS = [
	'support',
	'extension',
	'eald',
	'response_modes',
	'adhd'
] as const;
export type DifferentiationKey = (typeof DIFFERENTIATION_KEYS)[number];

export interface LessonDraft {
	title: string;
	description: string;
	summary: string;
	duration_minutes: number | null;
	sections: SectionDraft[];
	learning_intentions: string[];
	success_criteria: string[];
	curriculum_links: LinkDraft[];
	assessment: { formative: string; evidence: string[] };
	differentiation: Record<DifferentiationKey, string>;
	resources: ResourceDraft[];
	references: ReferenceDraft[];
}

/** Schema order, for placing keys a file did not already have. */
export const LESSON_ORDER = [
	'title',
	'description',
	'summary',
	'duration_minutes',
	'sections',
	'learning_intentions',
	'success_criteria',
	'curriculum_links',
	'assessment',
	'differentiation',
	'resources',
	'references',
	'materials'
];
const SECTION_ORDER = ['label', 'section', 'duration_minutes', 'kind', 'tier'];
const LINK_ORDER = ['framework', 'id', 'coverage', 'mode', 'note'];
const RESOURCE_ORDER = ['name', 'url', 'canvas', 'file', 'notes'];
const REFERENCE_ORDER = ['citation', 'url', 'path', 'used_for'];
const ASSESSMENT_ORDER = ['formative', 'evidence'];

export class EditError extends Error {}

export function toDraft(lesson: Lesson): LessonDraft {
	const differentiation = Object.fromEntries(
		DIFFERENTIATION_KEYS.map((k) => [k, lesson.differentiation?.[k] ?? ''])
	) as Record<DifferentiationKey, string>;
	return {
		title: lesson.title ?? '',
		description: lesson.description ?? '',
		summary: lesson.summary ?? '',
		duration_minutes: lesson.duration_minutes ?? null,
		sections: (lesson.sections ?? []).map((s) => ({
			label: s.label ?? '',
			section: s.section ?? '',
			duration_minutes: s.duration_minutes ?? null,
			tier: s.tier ?? '',
			kind: s.kind ?? '',
			__keys: Object.keys(s)
		})),
		learning_intentions: [...(lesson.learning_intentions ?? [])],
		success_criteria: [...(lesson.success_criteria ?? [])],
		curriculum_links: (lesson.curriculum_links ?? []).map((c) => ({
			...c,
			note: c.note ?? '',
			__keys: Object.keys(c)
		})),
		assessment: {
			formative: lesson.assessment?.formative ?? '',
			evidence: [...(lesson.assessment?.evidence ?? [])]
		},
		differentiation,
		resources: (lesson.resources ?? []).map((r) => ({
			...r,
			notes: r.notes ?? '',
			__keys: Object.keys(r)
		})),
		references: (lesson.references ?? []).map((r) => ({
			citation: r.citation ?? '',
			source: r.url === undefined && r.path !== undefined ? 'path' : 'url',
			where: r.url ?? r.path ?? '',
			used_for: r.used_for ?? '',
			__keys: Object.keys(r)
		}))
	};
}

export function blankSection(): SectionDraft {
	return { label: '', section: '', duration_minutes: 5, tier: '', kind: '' };
}

export function blankReference(): ReferenceDraft {
	return { citation: '', source: 'url', where: '', used_for: '' };
}

export function sectionTotal(draft: Pick<LessonDraft, 'sections'>): number {
	return draft.sections.reduce((sum, s) => sum + (Number(s.duration_minutes) || 0), 0);
}

/**
 * `linking` is for a plan with no file yet: its curriculum links are chosen
 * in the editor, so they are taken from the draft whole. A saved plan's
 * links keep their framework, id, coverage and mode.
 */
export function fromDraft(original: Lesson, draft: LessonDraft, linking = false): Lesson {
	const out: Record<string, unknown> = { ...original };
	const set = (key: string, value: unknown, optional: boolean) =>
		setField(out, original, key, value, optional);

	set('title', text(draft.title), false);
	set('description', text(draft.description), false);
	set('summary', text(draft.summary), true);
	set('duration_minutes', draft.duration_minutes, false);
	set(
		'sections',
		draft.sections.map((s) => sectionFrom(s)),
		false
	);
	set('learning_intentions', lines(draft.learning_intentions), false);
	set('success_criteria', lines(draft.success_criteria), false);
	set(
		'curriculum_links',
		linking
			? draft.curriculum_links.map((d) => newLink(d))
			: linksFrom(original.curriculum_links ?? [], draft.curriculum_links),
		false
	);

	const assessment: Record<string, unknown> = { ...(original.assessment ?? {}) };
	setField(
		assessment,
		original.assessment ?? {},
		'formative',
		text(draft.assessment.formative),
		true
	);
	setField(
		assessment,
		original.assessment ?? {},
		'evidence',
		lines(draft.assessment.evidence),
		true
	);
	set('assessment', ordered(assessment, keysOf(original.assessment), ASSESSMENT_ORDER), true);

	const differentiation: Record<string, unknown> = { ...(original.differentiation ?? {}) };
	for (const key of DIFFERENTIATION_KEYS) {
		setField(
			differentiation,
			original.differentiation ?? {},
			key,
			text(draft.differentiation[key]),
			true
		);
	}
	set(
		'differentiation',
		ordered(differentiation, keysOf(original.differentiation), [...DIFFERENTIATION_KEYS]),
		true
	);

	set('resources', resourcesFrom(original.resources ?? [], draft.resources), true);
	set('references', referencesFrom(draft.references), true);

	return ordered(out, Object.keys(original), LESSON_ORDER) as Lesson;
}

function sectionFrom(s: SectionDraft): Section {
	const item: Record<string, unknown> = {};
	put(item, 'label', text(s.label));
	item.section = text(s.section);
	item.duration_minutes = s.duration_minutes;
	put(item, 'kind', s.kind);
	put(item, 'tier', s.tier);
	return ordered(item, s.__keys, SECTION_ORDER) as unknown as Section;
}

function linksFrom(original: CurriculumLink[], drafts: LinkDraft[]): CurriculumLink[] {
	const ids = (links: { id: string }[]) => links.map((l) => l.id).join('\n');
	if (ids(original) !== ids(drafts)) {
		throw new EditError(
			'Curriculum link ids are set from the unit registry and cannot change here.'
		);
	}
	return drafts.map((d, i) => {
		const item: Record<string, unknown> = { ...original[i] };
		setField(item, original[i], 'note', text(d.note), true);
		return ordered(item, d.__keys, LINK_ORDER) as unknown as CurriculumLink;
	});
}

function newLink(d: LinkDraft): CurriculumLink {
	const item: Record<string, unknown> = {
		framework: d.framework,
		id: d.id,
		coverage: d.coverage,
		mode: d.mode
	};
	put(item, 'note', text(d.note));
	return item as unknown as CurriculumLink;
}

/** A link to a unit's registry entry, as a new plan starts it. */
export function linkTo(entry: { id: string; framework: string }): LinkDraft {
	return {
		framework: entry.framework,
		id: entry.id,
		coverage: 'full',
		mode: 'introduced',
		note: ''
	};
}

function resourcesFrom(original: Resource[], drafts: ResourceDraft[]): Resource[] {
	if (drafts.length !== original.length) {
		throw new EditError('Resources can be renamed and annotated here, not added or removed.');
	}
	return drafts.map((d, i) => {
		const item: Record<string, unknown> = { ...original[i] };
		item.name = text(d.name);
		setField(item, original[i], 'notes', text(d.notes), true);
		return ordered(item, d.__keys, RESOURCE_ORDER) as unknown as Resource;
	});
}

/** References left wholly blank are dropped. Numbers in errors count every reference in the editor. */
function referencesFrom(drafts: ReferenceDraft[]): Reference[] {
	const out: Reference[] = [];
	drafts.forEach((d, i) => {
		const blank = (v: string) => text(v).trim() === '';
		if ([d.citation, d.where, d.used_for].every(blank)) return;
		if (blank(d.where)) throw new EditError(`Reference ${i + 1} needs a link or a file.`);
		const item: Record<string, unknown> = { citation: text(d.citation) };
		item[d.source] = text(d.where);
		item.used_for = text(d.used_for);
		out.push(ordered(item, d.__keys, REFERENCE_ORDER) as unknown as Reference);
	});
	return out;
}

function text(value: string | null | undefined): string {
	return normaliseText(value ?? '');
}

function lines(values: string[]): string[] {
	return values.map(text).filter((v) => v.trim() !== '');
}

function isEmpty(value: unknown): boolean {
	if (value === undefined || value === null || value === '') return true;
	if (Array.isArray(value)) return value.length === 0;
	if (typeof value === 'object') return Object.keys(value as object).length === 0;
	return false;
}

/** Sets an optional value, or removes it when empty and the original did not already hold it empty. */
export function setField(
	target: Record<string, unknown>,
	original: object,
	key: string,
	value: unknown,
	optional: boolean
): void {
	const had = Object.prototype.hasOwnProperty.call(original, key);
	if (optional && isEmpty(value) && !(had && isEmpty((original as Record<string, unknown>)[key]))) {
		delete target[key];
	} else {
		target[key] = value;
	}
}

/** Adds a key to a new list item only when it has a value. */
function put(target: Record<string, unknown>, key: string, value: string): void {
	if (value !== '') target[key] = value;
}

export function keysOf(value: object | undefined): string[] | undefined {
	return value ? Object.keys(value) : undefined;
}

/**
 * The object's keys in the order `existing` had them, with any key not in
 * `existing` placed by `canonical`: after the last key that comes before it
 * there. Keys in neither list go at the end, in the object's own order.
 */
export function ordered<T extends Record<string, unknown>>(
	obj: T,
	existing: string[] | undefined,
	canonical: string[]
): T {
	const keys = (existing ?? []).filter((k) => k !== '__keys' && k in obj);
	const rank = (k: string) => canonical.indexOf(k);
	const fresh = Object.keys(obj).filter((k) => k !== '__keys' && !keys.includes(k));
	fresh.sort((a, b) => (rank(a) === -1 ? 1 : rank(b) === -1 ? -1 : rank(a) - rank(b)));
	for (const key of fresh) {
		const r = rank(key);
		if (r === -1) {
			keys.push(key);
			continue;
		}
		let at = 0;
		keys.forEach((k, i) => {
			const rk = rank(k);
			if (rk !== -1 && rk < r) at = i + 1;
		});
		keys.splice(at, 0, key);
	}
	const out: Record<string, unknown> = {};
	for (const key of keys) out[key] = obj[key];
	return out as T;
}

/** Moves `list[index]` by `delta` places, in place. Out-of-range moves do nothing. */
export function move<T>(list: T[], index: number, delta: number): void {
	const to = index + delta;
	if (index < 0 || index >= list.length || to < 0 || to >= list.length) return;
	const [item] = list.splice(index, 1);
	list.splice(to, 0, item);
}
