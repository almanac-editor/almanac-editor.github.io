/**
 * Syllabus coverage for one unit: which lessons reach each dot point in the
 * unit's registry, and how. `gather` and `classify` are a port of the data
 * repo's `scripts/coverage_report.py` (`gather`, `classify`), which reports a
 * class's lesson list. `taughtSources` adds what the script cannot see: the
 * lessons a class's delivery records say it was taught, each with the plan
 * it was taught from.
 *
 * As in the script, a flag is a prompt for a reader, not a verdict. Three
 * partials may add up to full treatment; one full link may name-check a point
 * and move on.
 */

import type { DeliveryRecord } from './deliveries.ts';
import { termOf } from './schedule.ts';
import type { Task } from './tasks.ts';
import type { CurriculumLink, Lesson, RegistryEntry, SchoolCalendar } from './types.ts';

export const DEVELOPED_MODES = new Set(['developed', 'consolidated']);

export type Flag = 'UNCOVERED' | 'PARTIAL' | 'ONCE' | 'SHALLOW' | 'ELSEWHERE' | 'OK';
export const FLAGS: Flag[] = ['UNCOVERED', 'PARTIAL', 'ONCE', 'SHALLOW', 'ELSEWHERE', 'OK'];

/** Where links come from: a lesson (its ref relative to the unit) and the links it makes. */
export interface Source {
	ref: string;
	title: string;
	links: CurriculumLink[];
	/** False for a taught lesson whose record kept no plan, so its links are the plan as it stands. */
	planKept?: boolean;
}

/** One link to a dot point, and what made it. */
export interface Reach {
	link: CurriculumLink;
	/** The lesson's ref relative to the unit; null for an assessment task. */
	ref: string | null;
	title: string;
	assessment: boolean;
	planKept: boolean;
}

export interface Gathered {
	/** Every registry id, in registry order, with the links that reach it. */
	links: Map<string, Reach[]>;
	/** Links to an id the registry does not hold: `ref -> id`, or `task title -> id`. */
	dangling: string[];
	/** Every lesson gathered, by its ref, whether or not it links anything. */
	refs: Set<string>;
}

/** The registry by id, as the script's dict: first place, last entry for a repeated id. */
export function registryById(registry: RegistryEntry[]): Map<string, RegistryEntry> {
	return new Map(registry.map((e) => [e.id, e]));
}

/** Plans as sources: a missing plan is skipped and an untitled one goes by its ref, as in the script. */
export function lessonSources(lessons: { ref: string; lesson: Lesson | null }[]): Source[] {
	return lessons.flatMap(({ ref, lesson }) =>
		lesson ? [{ ref, title: lesson.title ?? ref, links: lesson.curriculum_links ?? [] }] : []
	);
}

/** Every link from `sources`, then from the tasks a class sat, against the registry. */
export function gather(registry: RegistryEntry[], sources: Source[], tasks: Task[]): Gathered {
	const links = new Map<string, Reach[]>([...registryById(registry).keys()].map((id) => [id, []]));
	const dangling: string[] = [];
	for (const source of sources) {
		for (const link of source.links) {
			const at = links.get(link.id);
			if (!at) {
				dangling.push(`${source.ref} -> ${link.id}`);
				continue;
			}
			at.push({
				link,
				ref: source.ref,
				title: source.title,
				assessment: false,
				planKept: source.planKept ?? true
			});
		}
	}
	// A task can be the only place a point is met. That still counts, but it
	// is marked, so it never reads as taught.
	for (const task of tasks) {
		const title = task.title ?? 'assessment';
		for (const link of task.curriculum_links ?? []) {
			const at = links.get(link.id);
			if (!at) {
				dangling.push(`${title} -> ${link.id}`);
				continue;
			}
			at.push({
				link,
				ref: null,
				title: `${title} (assessment)`,
				assessment: true,
				planKept: true
			});
		}
	}
	return { links, dangling, refs: new Set(sources.map((s) => s.ref)) };
}

/** One dot point's flag from the links that reach it, as `classify` in the script decides it. */
export function flagOf(entry: RegistryEntry, reaches: Reach[]): Flag {
	if (reaches.length === 0) return entry.owned_by ? 'ELSEWHERE' : 'UNCOVERED';
	if (!reaches.some((r) => r.link.coverage === 'full')) return 'PARTIAL';
	if (reaches.some((r) => DEVELOPED_MODES.has(r.link.mode))) return 'OK';
	// One encounter can only be 'introduced': say how many lessons reach the
	// point rather than calling it shallow.
	return reaches.length === 1 ? 'ONCE' : 'SHALLOW';
}

/** Registry ids by flag, each in registry order. */
export function classify(registry: RegistryEntry[], gathered: Gathered): Record<Flag, string[]> {
	const flags = Object.fromEntries(FLAGS.map((f) => [f, [] as string[]])) as Record<Flag, string[]>;
	for (const [id, entry] of registryById(registry)) {
		flags[flagOf(entry, gathered.links.get(id) ?? [])].push(id);
	}
	return flags;
}

/** One class's record for a lesson of the unit, with the plan as it stands (null if gone). */
export interface TaughtLesson {
	/** The lesson's ref relative to the unit. */
	ref: string;
	record: DeliveryRecord;
	current: Lesson | null;
}

/**
 * The lessons a class was taught, as sources. A lesson counts once it has a
 * delivery, dated or not; its links are those of the latest delivery's plan,
 * or the plan as it stands where no delivery kept one. With `term`, only
 * deliveries the school calendar puts in a term of that name count; one it
 * cannot place (no date, or no calendar covering it) always counts, since
 * the record cannot say which cohort had it.
 */
export function taughtSources(
	taught: TaughtLesson[],
	term: string | null = null,
	calendars: SchoolCalendar[] = []
): Source[] {
	const sources: Source[] = [];
	for (const { ref, record, current } of taught) {
		const deliveries = (record.deliveries ?? []).filter((d) => {
			if (term === null || !d.taught) return true;
			const at = termOf(d.taught, calendars);
			return !at || at.term.name === term;
		});
		if (deliveries.length === 0) continue;
		const plan = deliveries.findLast((d) => d.plan)?.plan ?? null;
		const lesson = plan ?? current;
		sources.push({
			ref,
			title: lesson?.title ?? ref,
			links: lesson?.curriculum_links ?? [],
			planKept: plan !== null
		});
	}
	return sources;
}

/**
 * One dot point, planned against taught. Both flags read lesson links only:
 * a task assesses a point, it doesn't teach it, so tasks stand apart. (The
 * data repo's report counts them; `classify` still does, for parity.)
 */
export interface CoverageRow {
	entry: RegistryEntry;
	/** Lesson links in the list's plans, in list order. */
	planned: Reach[];
	plannedFlag: Flag;
	/** Lesson links in the plans taught from; null where no class is chosen. */
	taught: Reach[] | null;
	taughtFlag: Flag | null;
	/** Links from the assessment tasks the class sits, or every task without a class. */
	tasks: Reach[];
	/** No taught lesson reaches it yet, and a planned lesson that does is still to be taught. */
	toCome: boolean;
}

export interface Coverage {
	rows: CoverageRow[];
	dangling: string[];
}

/** The registry's rows, planned against taught. `taught` is null without a class. */
export function coverage(
	registry: RegistryEntry[],
	planned: Gathered,
	taught: Gathered | null
): Coverage {
	const lessons = (reaches: Reach[]) => reaches.filter((r) => !r.assessment);
	const rows: CoverageRow[] = [];
	for (const [id, entry] of registryById(registry)) {
		const all = planned.links.get(id) ?? [];
		const p = lessons(all);
		const t = taught ? lessons(taught.links.get(id) ?? []) : null;
		rows.push({
			entry,
			planned: p,
			plannedFlag: flagOf(entry, p),
			taught: t,
			taughtFlag: t ? flagOf(entry, t) : null,
			tasks: all.filter((r) => r.assessment),
			toCome: !!taught && t?.length === 0 && p.some((r) => !taught.refs.has(r.ref ?? ''))
		});
	}
	const dangling = [...planned.dangling];
	for (const d of taught?.dangling ?? []) if (!dangling.includes(d)) dangling.push(d);
	return { rows, dangling };
}

/** The flag a row is read by: as taught where a class is chosen, else as planned. */
export function shownFlag(row: CoverageRow): Flag {
	return row.taughtFlag ?? row.plannedFlag;
}

/** Some lesson reaches the point: as taught where a class is chosen, else as planned. */
export function reached(row: CoverageRow): boolean {
	return (row.taught ?? row.planned).length > 0;
}

/**
 * A row worth a second look: its plan, or its teaching so far, falls short of
 * developing the point. A point still to come is on its way, not short; one
 * owned by another unit is not this unit's to teach.
 */
export function needsLook(row: CoverageRow): boolean {
	const short = (f: Flag | null) => f !== null && f !== 'OK' && f !== 'ELSEWHERE';
	return short(row.plannedFlag) || (!row.toCome && short(row.taughtFlag));
}

/** One link behind a row, and whether its lesson is in the list and was taught. */
export interface Line {
	reach: Reach;
	planned: boolean;
	taught: boolean;
	/** The lesson was taught, from a plan that didn't link this dot point. */
	without?: boolean;
}

/**
 * The links behind a row, in the planned order. A lesson the class was
 * taught shows its links as taught, from the plan it had then; taught
 * lessons not in the list follow, then the tasks. `taughtRefs` is every
 * lesson taught.
 */
export function rowLines(row: CoverageRow, taughtRefs: ReadonlySet<string>): Line[] {
	const of = (r: Reach) => r.ref ?? r.title;
	const taught = row.taught ?? [];
	const plannedFrom = new Set(row.planned.map(of));
	const shown = new Set<string>();
	const out: Line[] = [];
	for (const reach of row.planned) {
		const from = of(reach);
		const asTaught = taught.filter((r) => of(r) === from);
		if (asTaught.length === 0) {
			out.push({ reach, planned: true, taught: false, without: taughtRefs.has(from) });
		} else if (!shown.has(from)) {
			for (const r of asTaught) out.push({ reach: r, planned: true, taught: true });
		}
		shown.add(from);
	}
	for (const reach of taught) {
		if (!shown.has(of(reach)))
			out.push({ reach, planned: plannedFrom.has(of(reach)), taught: true });
	}
	for (const reach of row.tasks) out.push({ reach, planned: true, taught: false });
	return out;
}

/** What a line says about its lesson; empty without a class. */
export function lineStatus(line: Line, classChosen: boolean): string {
	if (line.reach.assessment) return 'Assessment';
	if (!classChosen) return '';
	if (line.without) return 'Taught without this link';
	if (!line.taught) return 'Not yet taught';
	const read = line.reach.planKept ? '' : ', links from today’s plan';
	return (line.planned ? 'Taught' : 'Taught, not in the list') + read;
}

/** How a link reaches its point, in words: `In full, developed`. */
export function reachWords(link: CurriculumLink): string {
	return `${link.coverage === 'full' ? 'In full' : 'In part'}, ${link.mode}`;
}

/** Rows by the registry's phases, in the order each phase first appears. */
export function byPhase(rows: CoverageRow[]): { phase: string; rows: CoverageRow[] }[] {
	const out: { phase: string; rows: CoverageRow[] }[] = [];
	for (const row of rows) {
		const phase = row.entry.phase ?? '';
		const group = out.find((g) => g.phase === phase);
		if (group) group.rows.push(row);
		else out.push({ phase, rows: [row] });
	}
	return out;
}
