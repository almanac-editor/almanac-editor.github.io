/**
 * Editing a unit's own fields, and a subject's outcomes, without disturbing
 * the file: the same rules as lessonEdit.ts. Keys keep their order, a key the
 * file lacked goes in at its schema place, an optional list left empty is
 * removed unless the file held it empty, and keys the editor does not know
 * (`overview`, `assessments`, a dot point's `including`) are carried through.
 *
 * Ids and codes are references: lessons link dot points by id, and units name
 * outcomes by code. So an existing one never changes, and one still in use
 * cannot be removed. New ones are typed in full.
 */

import { normaliseText } from './format.ts';
import { EditError, ordered } from './lessonEdit.ts';
import { UNIT_ORDER } from './newLesson.ts';
import type { RegistryEntry, Unit } from './types.ts';

export interface PointDraft {
	id: string;
	framework: string;
	phase: string;
	text: string;
	/** Index of the entry in the file this one came from; absent for a new one. */
	from?: number;
}

export interface UnitDraft {
	unit_title: string;
	description: string;
	syllabus_registry: PointDraft[];
	applicable_outcomes: string[];
}

const POINT_ORDER = ['id', 'framework', 'phase', 'owned_by', 'text', 'including', 'verb'];

export function toUnitDraft(unit: Unit): UnitDraft {
	return {
		unit_title: unit.unit_title ?? '',
		description: unit.description ?? '',
		syllabus_registry: (unit.syllabus_registry ?? []).map((e, i) => ({
			id: e.id,
			framework: e.framework,
			phase: e.phase,
			text: e.text,
			from: i
		})),
		applicable_outcomes: [...(unit.applicable_outcomes ?? [])]
	};
}

export function blankPoint(after?: PointDraft): PointDraft {
	return { id: '', framework: after?.framework ?? '', phase: after?.phase ?? '', text: '' };
}

/**
 * The unit with the draft's fields. `linked` is every dot point id a lesson
 * links, so one in use is not removed.
 */
export function fromUnitDraft(original: Unit, draft: UnitDraft, linked: Set<string>): Unit {
	const registry = original.syllabus_registry ?? [];
	const kept = new Set(
		draft.syllabus_registry.flatMap((p) => (p.from === undefined ? [] : [p.from]))
	);
	const removed = registry.filter((e, i) => !kept.has(i) && linked.has(e.id)).map((e) => e.id);
	if (removed.length) {
		throw new EditError(
			`Lessons still link ${removed.join(', ')}. Unlink ${removed.length === 1 ? 'it' : 'them'} first.`
		);
	}
	const points = draft.syllabus_registry
		.map((p) => pointFrom(p, registry))
		.filter((p): p is RegistryEntry => p !== null);
	const ids = points.map((p) => p.id);
	const twice = ids.filter((id, i) => ids.indexOf(id) !== i);
	if (twice.length) throw new EditError(`Dot point ${twice[0]} is listed twice.`);

	const out: Record<string, unknown> = { ...original };
	out.unit_title = text(draft.unit_title);
	const description = text(draft.description);
	if (description || Object.prototype.hasOwnProperty.call(original, 'description')) {
		out.description = description;
	}
	const hadRegistry = Object.prototype.hasOwnProperty.call(original, 'syllabus_registry');
	if (points.length || hadRegistry) out.syllabus_registry = points;
	else delete out.syllabus_registry;
	const outcomes = [...new Set(draft.applicable_outcomes)];
	const had = Object.prototype.hasOwnProperty.call(original, 'applicable_outcomes');
	if (outcomes.length || had) out.applicable_outcomes = outcomes;
	return ordered(out, Object.keys(original), UNIT_ORDER) as Unit;
}

function pointFrom(p: PointDraft, registry: RegistryEntry[]): RegistryEntry | null {
	const source = p.from === undefined ? undefined : registry[p.from];
	if (!source && !p.id.trim() && !p.phase.trim() && !p.text.trim()) return null;
	const fresh = !source;
	const item: Record<string, unknown> = { ...(source ?? {}) };
	item.id = source ? source.id : p.id.trim();
	item.framework = clean(p.framework, fresh);
	item.phase = clean(p.phase, fresh);
	item.text = clean(p.text, fresh);
	return ordered(item, source ? Object.keys(source) : undefined, POINT_ORDER) as RegistryEntry;
}

function text(value: string): string {
	return normaliseText(value ?? '');
}

/** New entries are trimmed; existing ones keep what the file had, so an untouched save is the same bytes. */
function clean(value: string, fresh: boolean): string {
	return fresh ? text(value).trim() : text(value);
}

/** A subject's `outcome.json`: the course's outcomes, which units name by code. */
export interface OutcomeSet {
	name: string;
	framework: string;
	stage?: string;
	outcomes: { code: string; text: string }[];
	[key: string]: unknown;
}

export interface OutcomeDraft {
	name: string;
	framework: string;
	stage: string;
	outcomes: { code: string; text: string; from?: number }[];
}

const OUTCOME_SET_ORDER = ['name', 'framework', 'stage', 'outcomes'];

export function toOutcomeDraft(set: OutcomeSet): OutcomeDraft {
	return {
		name: set.name ?? '',
		framework: set.framework ?? '',
		stage: set.stage ?? '',
		outcomes: (set.outcomes ?? []).map((o, i) => ({ code: o.code, text: o.text, from: i }))
	};
}

/** A subject with no outcomes yet. */
export function blankOutcomeSet(name: string, framework: string): OutcomeSet {
	return { name, framework, outcomes: [] };
}

/** The outcome set with the draft's fields. `used` is every code a unit names. */
export function fromOutcomeDraft(
	original: OutcomeSet,
	draft: OutcomeDraft,
	used: Set<string>
): OutcomeSet {
	const outcomes = original.outcomes ?? [];
	const kept = new Set(draft.outcomes.flatMap((o) => (o.from === undefined ? [] : [o.from])));
	const removed = outcomes.filter((o, i) => !kept.has(i) && used.has(o.code)).map((o) => o.code);
	if (removed.length) {
		throw new EditError(
			`Units still name ${removed.join(', ')}. Untick ${removed.length === 1 ? 'it' : 'them'} in those units first.`
		);
	}
	const next = draft.outcomes.flatMap((o) => {
		const source = o.from === undefined ? undefined : outcomes[o.from];
		if (!source && !o.code.trim() && !o.text.trim()) return [];
		const item: Record<string, unknown> = { ...(source ?? {}) };
		item.code = source ? source.code : o.code.trim();
		item.text = clean(o.text, !source);
		return [ordered(item, source ? Object.keys(source) : undefined, ['code', 'text'])];
	}) as { code: string; text: string }[];
	const codes = next.map((o) => o.code);
	const twice = codes.filter((c, i) => codes.indexOf(c) !== i);
	if (twice.length) throw new EditError(`Outcome ${twice[0]} is listed twice.`);

	const out: Record<string, unknown> = { ...original };
	out.name = text(draft.name);
	out.framework = draft.framework;
	const stage = text(draft.stage);
	if (stage || Object.prototype.hasOwnProperty.call(original, 'stage')) out.stage = stage;
	out.outcomes = next;
	return ordered(out, Object.keys(original), OUTCOME_SET_ORDER) as OutcomeSet;
}
