/**
 * A unit's assessment tasks (`assessments` in `unit.json`): which ones a class
 * sat, and editing them without disturbing the file. The same rules as
 * lessonEdit.ts: keys keep their order, a key a task lacked goes in at its
 * schema place, an optional field cleared to empty is removed unless the task
 * held it empty, and keys the editor does not know are carried through.
 *
 * `weight` is a number in the schema, but the house format writes integers
 * only (see format.ts), so a weight is a whole number.
 */

import { normaliseText } from './format.ts';
import { EditError, keysOf, ordered, setField } from './lessonEdit.ts';
import { UNIT_ORDER } from './newLesson.ts';
import type { CurriculumLink, Unit } from './types.ts';

export interface Task {
	title: string;
	assessment_type?: string;
	weight?: number;
	description?: string;
	overview?: string;
	/** Ids of the classes that sat it; absent means every class taking the unit. */
	offerings?: string[];
	/** The cohort's term, for a class that took the unit in two parts. */
	term?: string;
	class_minutes?: number;
	curriculum_links?: CurriculumLink[];
	[key: string]: unknown;
}

export type TaskLinkDraft = CurriculumLink & { note: string; __from?: CurriculumLink };

export interface TaskDraft {
	title: string;
	assessment_type: string;
	weight: number | null;
	description: string;
	overview: string;
	offerings: string[];
	term: string;
	class_minutes: number | null;
	curriculum_links: TaskLinkDraft[];
	/** The task in the file this one came from; absent for a new one. */
	__from?: Task;
}

/** Schema order, with `offerings` before `term` as the data repo's files have it. */
export const TASK_ORDER = [
	'title',
	'assessment_type',
	'weight',
	'description',
	'overview',
	'offerings',
	'term',
	'class_minutes',
	'curriculum_links'
];
const LINK_ORDER = ['framework', 'id', 'coverage', 'mode', 'note'];

export const COVERAGES = ['full', 'partial'];
export const MODES = ['introduced', 'developed', 'consolidated', 'revisited'];

/**
 * The tasks one class, or one cohort of it, sat. A port of the data repo's
 * `tasks_for_offering` (`scripts/offering_lessons.py`): with no offering,
 * every task; with no term, every term's.
 */
export function tasksForOffering(
	unit: Unit,
	offering: string | null,
	term: string | null = null
): Task[] {
	const tasks = (unit.assessments ?? []) as Task[];
	if (offering === null) return [...tasks];
	return tasks.filter(
		(t) =>
			(!('offerings' in t) || (t.offerings ?? []).includes(offering)) &&
			(term === null || !('term' in t) || t.term === term)
	);
}

export function toTaskDrafts(unit: Unit): TaskDraft[] {
	return ((unit.assessments ?? []) as Task[]).map((task) => ({
		title: task.title ?? '',
		assessment_type: task.assessment_type ?? '',
		weight: task.weight ?? null,
		description: task.description ?? '',
		overview: task.overview ?? '',
		offerings: [...(task.offerings ?? [])],
		term: task.term ?? '',
		class_minutes: task.class_minutes ?? null,
		curriculum_links: (task.curriculum_links ?? []).map((l) => ({
			...l,
			note: l.note ?? '',
			__from: l
		})),
		__from: task
	}));
}

export function blankTask(): TaskDraft {
	return {
		title: '',
		assessment_type: '',
		weight: null,
		description: '',
		overview: '',
		offerings: [],
		term: '',
		class_minutes: null,
		curriculum_links: []
	};
}

/** A task's link to a unit's dot point, as one starts. */
export function taskLink(entry: { id: string; framework: string }): TaskLinkDraft {
	return {
		framework: entry.framework,
		id: entry.id,
		coverage: 'full',
		mode: 'developed',
		note: ''
	};
}

/** The unit with the drafts as its tasks, in the drafts' order. */
export function fromTaskDrafts(original: Unit, drafts: TaskDraft[]): Unit {
	const tasks = drafts.filter((d) => d.__from || !isBlank(d)).map((d, i) => taskFrom(d, i + 1));
	const out: Record<string, unknown> = { ...original };
	setField(out, original, 'assessments', tasks, true);
	return ordered(out, Object.keys(original), UNIT_ORDER) as Unit;
}

function taskFrom(d: TaskDraft, n: number): Task {
	const source = d.__from ?? {};
	const fresh = !d.__from;
	const title = clean(d.title, fresh);
	if (!title.trim()) throw new EditError(`Task ${n} has no title.`);
	const item: Record<string, unknown> = { ...source };
	const set = (key: string, value: unknown) => setField(item, source, key, value, true);
	item.title = title;
	set('assessment_type', clean(d.assessment_type, fresh));
	set('weight', whole(d.weight, `${title}: the weight`));
	set('description', clean(d.description, fresh));
	set('overview', clean(d.overview, fresh));
	set('offerings', [...new Set(d.offerings)]);
	set('term', d.term);
	set('class_minutes', whole(d.class_minutes, `${title}: class time`));
	const ids = d.curriculum_links.map((l) => l.id);
	const twice = ids.find((id, i) => ids.indexOf(id) !== i);
	if (twice) throw new EditError(`${title} links dot point ${twice} twice.`);
	set(
		'curriculum_links',
		d.curriculum_links.map((l) => linkFrom(l))
	);
	return ordered(item, keysOf(d.__from), TASK_ORDER) as Task;
}

function linkFrom(l: TaskLinkDraft): CurriculumLink {
	const source = l.__from ?? {};
	const item: Record<string, unknown> = { ...source };
	item.framework = l.framework;
	item.id = l.id;
	item.coverage = l.coverage;
	item.mode = l.mode;
	setField(item, source, 'note', clean(l.note, !l.__from), true);
	return ordered(item, keysOf(l.__from), LINK_ORDER) as unknown as CurriculumLink;
}

function whole(value: number | null, what: string): number | null {
	if (value === null || value === undefined || Number.isNaN(value)) return null;
	if (!Number.isInteger(value) || value < 0) {
		throw new EditError(`${what} must be a whole number, 0 or more.`);
	}
	return value;
}

function isBlank(d: TaskDraft): boolean {
	return (
		![d.title, d.assessment_type, d.description, d.overview, d.term].some((v) => v.trim()) &&
		d.weight === null &&
		d.class_minutes === null &&
		d.offerings.length === 0 &&
		d.curriculum_links.length === 0
	);
}

/** New tasks are trimmed; existing ones keep what the file had, so an untouched save is the same bytes. */
function clean(value: string, fresh: boolean): string {
	const text = normaliseText(value ?? '');
	return fresh ? text.trim() : text;
}

export interface TaskClass {
	label: string;
	/** The terms the class took the unit in, for one taken in parts. */
	terms: string[];
}

/** The classes that can sit a unit's tasks, by offering id, from the unit's offering entries. */
export function taskClasses(
	entries: { offering: { id: string }; term: string | null }[],
	label: (offering: { id: string }) => string
): Map<string, TaskClass> {
	const classes = new Map<string, TaskClass>();
	for (const { offering, term } of entries) {
		const known = classes.get(offering.id) ?? { label: label(offering), terms: [] };
		if (term && !known.terms.includes(term)) known.terms.push(term);
		classes.set(offering.id, known);
	}
	return classes;
}

/**
 * The terms a task's cohort can be: those its classes (or every class) took
 * the unit across, for a class that took it in more than one part.
 */
export function cohortTerms(
	task: Pick<TaskDraft, 'offerings' | 'term'>,
	classes: Map<string, TaskClass>
): string[] {
	const ids = task.offerings.length ? task.offerings : [...classes.keys()];
	const terms = new Set(
		ids.flatMap((id) => {
			const found = classes.get(id)?.terms ?? [];
			return found.length > 1 ? found : [];
		})
	);
	if (task.term) terms.add(task.term);
	return [...terms];
}
