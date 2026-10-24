/**
 * What changed between the plan a class was taught (a delivery's `plan`) and
 * the plan as it stands. Field by field, focused on what teachers change: the
 * run sheet, intentions, success criteria, curriculum links, and the plan's
 * own text. Anything else that differs is named, not shown, so no change goes
 * unmentioned. `materials` is never compared: a snapshot leaves it out.
 *
 * A small alignment (longest common subsequence) pairs list entries, so a
 * section moved, added or removed shows as that, not as every later section
 * changing.
 */

import type { CurriculumLink, Lesson, Section } from './types.ts';

export type RowStatus = 'same' | 'changed' | 'added' | 'removed';

export type SectionField = 'label' | 'minutes' | 'kind' | 'tier' | 'text';

/** One run sheet section: `before` as taught, `after` as it stands. */
export interface SectionRow {
	status: RowStatus;
	before: Section | null;
	after: Section | null;
	changed: SectionField[];
}

export interface ListRow {
	status: 'same' | 'added' | 'removed';
	text: string;
}

export type LinkField = 'coverage' | 'mode' | 'note';

export interface LinkRow {
	status: RowStatus;
	before: CurriculumLink | null;
	after: CurriculumLink | null;
	changed: LinkField[];
}

export type TextField = 'title' | 'description' | 'summary' | 'duration_minutes';

export interface TextChange {
	field: TextField;
	before: string | number | null;
	after: string | number | null;
}

export interface PlanDiff {
	/** True when anything but `materials` differs. */
	changed: boolean;
	text: TextChange[];
	/** Every section, in the current plan's order, with removed ones where they were. */
	sections: SectionRow[];
	learning_intentions: ListRow[];
	success_criteria: ListRow[];
	curriculum_links: LinkRow[];
	/** Other top-level fields that differ, by key: `differentiation`, `resources`. */
	other: string[];
}

const TEXT_FIELDS: TextField[] = ['title', 'description', 'summary', 'duration_minutes'];
const SHOWN = new Set<string>([
	...TEXT_FIELDS,
	'sections',
	'learning_intentions',
	'success_criteria',
	'curriculum_links',
	'materials'
]);

export function comparePlans(taught: Lesson, current: Lesson): PlanDiff {
	const text = TEXT_FIELDS.flatMap((field): TextChange[] => {
		const before = (taught[field] as string | number | undefined) ?? null;
		const after = (current[field] as string | number | undefined) ?? null;
		return before === after ? [] : [{ field, before, after }];
	});
	const keys = new Set([...Object.keys(taught), ...Object.keys(current)]);
	const other = [...keys].filter((k) => !SHOWN.has(k) && !same(taught[k], current[k]));
	return {
		changed: planChanged(taught, current),
		text,
		sections: compareSections(taught.sections ?? [], current.sections ?? []),
		learning_intentions: compareLists(
			taught.learning_intentions ?? [],
			current.learning_intentions ?? []
		),
		success_criteria: compareLists(taught.success_criteria ?? [], current.success_criteria ?? []),
		curriculum_links: compareLinks(taught.curriculum_links ?? [], current.curriculum_links ?? []),
		other
	};
}

/** Whether the plan differs from the one taught, leaving out `materials` and key order. */
export function planChanged(taught: Lesson, current: Lesson): boolean {
	const a: Record<string, unknown> = { ...taught };
	const b: Record<string, unknown> = { ...current };
	delete a.materials;
	delete b.materials;
	return !same(a, b);
}

function compareSections(before: Section[], after: Section[]): SectionRow[] {
	// Labelled sections match by label, so a reworded one is still itself.
	const match = (x: Section, y: Section) =>
		x.label && y.label ? x.label === y.label : x.section === y.section;
	return align(before, after, match, true).map(([x, y]) => {
		if (!y) return { status: 'removed', before: x, after: null, changed: [] };
		if (!x) return { status: 'added', before: null, after: y, changed: [] };
		const changed: SectionField[] = [];
		if ((x.label ?? '') !== (y.label ?? '')) changed.push('label');
		if (x.duration_minutes !== y.duration_minutes) changed.push('minutes');
		if ((x.kind ?? '') !== (y.kind ?? '')) changed.push('kind');
		if ((x.tier ?? 'core') !== (y.tier ?? 'core')) changed.push('tier');
		if (x.section !== y.section) changed.push('text');
		return { status: changed.length ? 'changed' : 'same', before: x, after: y, changed };
	});
}

function compareLists(before: string[], after: string[]): ListRow[] {
	return align(before, after, (x, y) => x === y, false).map(([x, y]) =>
		x === null
			? { status: 'added', text: y! }
			: y === null
				? { status: 'removed', text: x }
				: { status: 'same', text: y }
	);
}

function compareLinks(before: CurriculumLink[], after: CurriculumLink[]): LinkRow[] {
	return align(before, after, (x, y) => x.id === y.id, false).map(([x, y]) => {
		if (!y) return { status: 'removed', before: x, after: null, changed: [] };
		if (!x) return { status: 'added', before: null, after: y, changed: [] };
		const changed = (['coverage', 'mode', 'note'] as const).filter(
			(k) => (x[k] ?? '') !== (y[k] ?? '')
		);
		return { status: changed.length ? 'changed' : 'same', before: x, after: y, changed };
	});
}

/**
 * The two lists side by side, matched by `match` along their longest common
 * subsequence, in `after`'s order with removed entries where they stood.
 * With `pair`, entries left unmatched between two matches are paired in order
 * (an edited entry, not a removal and an addition).
 */
export function align<T>(
	before: T[],
	after: T[],
	match: (x: T, y: T) => boolean,
	pair: boolean
): [T | null, T | null][] {
	const n = before.length;
	const m = after.length;
	// lcs[i][j]: length of the common subsequence of before[i:] and after[j:].
	const lcs = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
	for (let i = n - 1; i >= 0; i--) {
		for (let j = m - 1; j >= 0; j--) {
			lcs[i][j] = match(before[i], after[j])
				? lcs[i + 1][j + 1] + 1
				: Math.max(lcs[i + 1][j], lcs[i][j + 1]);
		}
	}
	const out: [T | null, T | null][] = [];
	let removed: T[] = [];
	let added: T[] = [];
	const flush = () => {
		const paired = pair ? Math.min(removed.length, added.length) : 0;
		for (let k = 0; k < paired; k++) out.push([removed[k], added[k]]);
		for (const x of removed.slice(paired)) out.push([x, null]);
		for (const y of added.slice(paired)) out.push([null, y]);
		removed = [];
		added = [];
	};
	let i = 0;
	let j = 0;
	while (i < n || j < m) {
		if (i < n && j < m && match(before[i], after[j]) && lcs[i][j] === lcs[i + 1][j + 1] + 1) {
			flush();
			out.push([before[i++], after[j++]]);
		} else if (j < m && (i === n || lcs[i][j + 1] >= lcs[i + 1][j])) {
			added.push(after[j++]);
		} else {
			removed.push(before[i++]);
		}
	}
	flush();
	return out;
}

/** Deep equality that ignores key order. */
function same(a: unknown, b: unknown): boolean {
	return canonical(a) === canonical(b);
}

function canonical(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
	if (value && typeof value === 'object') {
		const entries = Object.keys(value)
			.filter((k) => (value as Record<string, unknown>)[k] !== undefined)
			.sort()
			.map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`);
		return `{${entries.join(',')}}`;
	}
	return JSON.stringify(value) ?? 'null';
}
