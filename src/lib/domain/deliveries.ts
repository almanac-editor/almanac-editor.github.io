/**
 * Delivery records: what each class was taught of each lesson, and what to
 * change. The lesson plan is the living plan; a record keeps the history, so
 * improving a lesson never rewrites what a past class was taught. Follows the
 * data repo's `scripts/deliveries.py` and `schemas/delivery.schema.json`.
 *
 * One record per class per lesson, beside the offering, at the lesson's path
 * relative to its subject:
 *
 *     offerings/2026_y10_class1.json
 *     offerings/2026_y10_class1/taught/units/analysing_data/lessons/01_intro.json
 *
 * Feedback whose class was never recorded sits under a directory with no
 * offering file, `offerings/<year>_unattributed/`, with `"offering": null`.
 *
 * Nothing here deletes: a feedback item is applied or declined and keeps its
 * record. Keys keep the order the file had, and a new key goes in at its
 * schema position, as for lessons.
 */

import { ordered } from './lessonEdit.ts';
import { normaliseText } from './format.ts';
import { materialsFrom, type MaterialDraft, type MaterialLink } from './materials.ts';
import { normalise } from './paths.ts';
import type { Lesson, Offering } from './types.ts';

export type FeedbackStatus = 'open' | 'applied' | 'declined';

export interface FeedbackItem {
	issue: string;
	change?: string;
	status: FeedbackStatus;
	raised?: string;
	resolved?: string;
	note?: string;
	plan_commit_after?: string;
	[key: string]: unknown;
}

export interface Delivery {
	taught?: string;
	by?: string;
	deviations?: string;
	plan?: Lesson;
	plan_commit?: string;
	source?: string;
	materials?: MaterialLink[];
	feedback?: FeedbackItem[];
	[key: string]: unknown;
}

export interface DeliveryRecord {
	offering: string | null;
	lesson: string;
	deliveries: Delivery[];
	[key: string]: unknown;
}

/** Schema order, for placing keys a file did not already have. */
const RECORD_ORDER = ['offering', 'lesson', 'deliveries'];
const DELIVERY_ORDER = [
	'taught',
	'by',
	'deviations',
	'plan',
	'plan_commit',
	'source',
	'materials',
	'feedback'
];
const FEEDBACK_ORDER = [
	'issue',
	'change',
	'status',
	'raised',
	'resolved',
	'note',
	'plan_commit_after'
];

export const UNATTRIBUTED_SUFFIX = '_unattributed';

/** Directories that hold units, as `UNIT_ROOTS` in `deliveries.py`. */
const UNIT_ROOTS = ['units', 'revision'];

/**
 * Splits a lesson path at its last `units/` or `revision/`: the subject
 * directory, and the lesson's path relative to it. The subject is whatever
 * directory holds them, so a course level beneath a subject costs nothing.
 * Null for a path under neither.
 *
 * `subjects/x/units/a/lessons/01.json` -> `{ subject: 'subjects/x', ref: 'units/a/lessons/01.json' }`
 */
export function lessonRef(lessonPath: string): { subject: string; ref: string } | null {
	const parts = lessonPath.split('/');
	const at = parts.findLastIndex((part) => UNIT_ROOTS.includes(part));
	if (at === -1) return null;
	return { subject: parts.slice(0, at).join('/'), ref: parts.slice(at).join('/') };
}

/** `offerings/2026_y10_class1.json` -> `offerings/2026_y10_class1` */
export function classDir(offeringPath: string): string {
	return offeringPath.replace(/\.json$/, '');
}

/** Where one class's record for one lesson lives, written or not. */
export function deliveryPath(offeringPath: string, ref: string): string {
	return `${classDir(offeringPath)}/taught/${ref}`;
}

/**
 * Every record for one lesson ref among `paths`, with the offering file its
 * class directory sits beside (which may not exist), in class-directory order.
 */
export function recordPaths(
	paths: Iterable<string>,
	ref: string
): { path: string; offeringPath: string; unattributed: boolean }[] {
	const found: { path: string; offeringPath: string; unattributed: boolean }[] = [];
	const suffix = `/taught/${ref}`;
	for (const path of paths) {
		if (!path.startsWith('offerings/') || !path.endsWith(suffix)) continue;
		const dir = path.slice('offerings/'.length, -suffix.length);
		if (!dir || dir.includes('/')) continue;
		found.push({
			path,
			offeringPath: `offerings/${dir}.json`,
			unattributed: dir.endsWith(UNATTRIBUTED_SUFFIX)
		});
	}
	return found.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/** Where a feedback item is: which record file, which delivery, which item. */
export interface ItemRef {
	path: string;
	delivery: number;
	index: number;
}

export interface FeedbackEntry extends ItemRef {
	item: FeedbackItem;
	/** The offering id, or null when the class was never recorded. */
	offering: string | null;
	/** The date the lesson ran, or null where it was never recorded. */
	taught: string | null;
	/** The delivery's `source`, for one not written at the time. */
	source: string | null;
}

/**
 * Feedback from a lesson's records, newest first, as `open_feedback` in
 * `deliveries.py` orders it: by `raised`, falling back to `taught`, with
 * undated items last in record order. All statuses; filter for open.
 */
export function feedbackEntries(records: { path: string; record: DeliveryRecord }[]) {
	const entries: FeedbackEntry[] = [];
	for (const { path, record } of records) {
		record.deliveries.forEach((delivery, d) => {
			(delivery.feedback ?? []).forEach((item, index) => {
				entries.push({
					path,
					delivery: d,
					index,
					item,
					offering: record.offering,
					taught: delivery.taught ?? null,
					source: delivery.source ?? null
				});
			});
		});
	}
	const dateOf = (e: FeedbackEntry) => e.item.raised ?? e.taught ?? '';
	const dated = entries.filter(dateOf);
	const undated = entries.filter((e) => !dateOf(e));
	dated.sort((a, b) => (dateOf(a) < dateOf(b) ? 1 : dateOf(a) > dateOf(b) ? -1 : 0));
	return [...dated, ...undated];
}

/** The lesson as it stands, without `materials`, for a delivery's `plan`. */
export function snapshot(lesson: Lesson): Lesson {
	const plan: Record<string, unknown> = structuredClone(lesson);
	delete plan.materials;
	return plan as Lesson;
}

/** One lesson a class takes: its ref relative to the subject, and the unit entry or one-off it comes from. */
export interface TakenLesson {
	ref: string;
	unit: string;
}

/**
 * Every lesson an offering takes, as `offering_lesson_refs` in `deliveries.py`
 * lists them: a unit entry's own `lessons`, else the unit's; a one-off's plans
 * under its `lessons/`, sorted. Repeats are dropped. `unitLessons(entry)` is
 * the unit's own index, or null where the unit cannot be read; `listJson(dir)`
 * is every `.json` under a directory, both relative to the subject.
 */
export function offeringLessons(
	offering: Offering,
	unitLessons: (unit: string) => string[] | null,
	listJson: (dir: string) => string[]
): TakenLesson[] {
	const found: TakenLesson[] = [];
	for (const entry of offering.units ?? []) {
		const refs = entry.lessons ?? unitLessons(entry.unit) ?? [];
		for (const ref of refs) found.push({ ref: `${entry.unit}/${ref}`, unit: entry.unit });
	}
	const oneOffs = Array.isArray(offering.one_offs) ? (offering.one_offs as { path: string }[]) : [];
	for (const entry of oneOffs) {
		for (const ref of [...listJson(`${entry.path}/lessons`)].sort()) {
			found.push({ ref, unit: entry.path });
		}
	}
	const seen = new Set<string>();
	return found.filter(({ ref }) => !seen.has(ref) && !!seen.add(ref));
}

/**
 * What keeping a plan would do to a class's record for a lesson, as
 * `snapshot` in `deliveries.py` decides it: write a new record, add the plan
 * to its one delivery, leave a record that has a plan, or leave one with
 * several deliveries and none, since which run the plan belongs to is unknown.
 */
export type KeepOutcome = 'write' | 'add' | 'has' | 'several';

export function keepOutcome(record: DeliveryRecord | null): KeepOutcome {
	if (!record) return 'write';
	if (record.deliveries.some((d) => d.plan)) return 'has';
	return record.deliveries.length === 1 ? 'add' : 'several';
}

/** One earlier class's lesson whose plan a new class would put at risk. */
export interface ToKeep {
	offeringPath: string;
	offering: Offering;
	ref: string;
	/** The unit entry or one-off the lesson comes from, so a whole unit can be left out. */
	unit: string;
	recordPath: string;
	outcome: Exclude<KeepOutcome, 'has'>;
}

/**
 * The plans to keep before `next` is created: every lesson an earlier year's
 * class of the same subject took, that `next` takes too, and whose record has
 * no plan. The rule of `missing_plans` in `deliveries.py`, for one new class:
 * year, not history, decides it, so it holds before any lesson is edited.
 * `records` holds the records that exist, by path.
 */
export function plansToKeep(
	next: { offering: Offering; lessons: TakenLesson[] },
	classes: { path: string; offering: Offering; lessons: TakenLesson[] }[],
	records: Map<string, DeliveryRecord>
): ToKeep[] {
	const taken = new Set(next.lessons.map((l) => l.ref));
	const subject = normalise(next.offering.subject ?? '');
	const found: ToKeep[] = [];
	for (const { path, offering, lessons } of classes) {
		if (normalise(offering.subject ?? '') !== subject) continue;
		if (!(offering.year < next.offering.year)) continue;
		for (const { ref, unit } of lessons) {
			if (!taken.has(ref)) continue;
			const recordPath = deliveryPath(path, ref);
			const outcome = keepOutcome(records.get(recordPath) ?? null);
			if (outcome === 'has') continue;
			found.push({ offeringPath: path, offering, ref, unit, recordPath, outcome });
		}
	}
	return found;
}

/**
 * The `source` a kept plan carries: who kept it, when, why, and from which
 * commit. `why` reads on from the date: "when 2027-y7-a was created".
 */
export function keptStamp(date: string, why: string, commit: string | null): string {
	return `plan kept by almanac-editor on ${date}, ${why}${commit ? `, from ${commit.slice(0, 7)}` : ''}`;
}

/**
 * The plans one lesson puts at risk: every earlier class that took it with no
 * plan kept, while a later year's class of the same subject takes it too. The
 * rule of `missing_plans` in `deliveries.py`, for one lesson.
 */
export function plansAtRisk(
	ref: string,
	classes: { path: string; offering: Offering; lessons: TakenLesson[] }[],
	records: Map<string, DeliveryRecord>
): ToKeep[] {
	const found: ToKeep[] = [];
	for (const later of classes) {
		const taken = later.lessons.find((l) => l.ref === ref);
		if (!taken) continue;
		for (const k of plansToKeep({ offering: later.offering, lessons: [taken] }, classes, records)) {
			if (!found.some((f) => f.recordPath === k.recordPath)) found.push(k);
		}
	}
	return found;
}

/**
 * The record with `plan` kept: a new record with one delivery, or the plan
 * added to a record's one delivery, with `stamp` joined onto its `source`.
 * A new key goes in at its schema place. Throws for a record that already has
 * a plan or has several deliveries, which are left as they are.
 */
export function keepPlan(
	record: DeliveryRecord | null,
	offering: string,
	ref: string,
	plan: Lesson,
	commit: string | null,
	stamp: string
): DeliveryRecord {
	const kept: Delivery = { plan: snapshot(plan) };
	if (commit) kept.plan_commit = commit;
	const outcome = keepOutcome(record);
	if (!record) {
		const delivery = { ...kept, source: `${stamp}. Date and teacher not recorded.` };
		return { offering, lesson: ref, deliveries: [ordered(delivery, undefined, DELIVERY_ORDER)] };
	}
	if (outcome !== 'add') throw new Error(`${ref}: the record is left as it is (${outcome}).`);
	const [only] = record.deliveries;
	const next: Delivery = {
		...only,
		...kept,
		source: [only.source, stamp].filter(Boolean).join('; ')
	};
	return { ...record, deliveries: [ordered(next, Object.keys(only), DELIVERY_ORDER)] };
}

export interface TaughtInput {
	taught: string;
	by: string;
	deviations: string;
	feedback: { issue: string; change: string }[];
	/** Links to what the class saw; optional, as it may be added afterwards. */
	materials?: MaterialDraft[];
}

/**
 * A new delivery from what the teacher typed. Blank fields are left out, and
 * feedback with no issue is dropped. Each item is open and raised on the day
 * the lesson ran. A link that is not `https:` is refused.
 */
export function newDelivery(input: TaughtInput, plan: Lesson, commit: string | null): Delivery {
	const text = (value: string) => normaliseText(value).trim();
	const delivery: Delivery = { taught: input.taught };
	if (text(input.by)) delivery.by = text(input.by);
	if (text(input.deviations)) delivery.deviations = text(input.deviations);
	delivery.plan = snapshot(plan);
	if (commit) delivery.plan_commit = commit;
	const materials = materialsFrom(input.materials ?? []);
	if (materials.length) delivery.materials = materials;
	const feedback = input.feedback
		.filter((f) => text(f.issue))
		.map((f) => {
			const item: FeedbackItem = { issue: text(f.issue), status: 'open' };
			if (text(f.change)) item.change = text(f.change);
			item.raised = input.taught;
			return ordered(item, undefined, FEEDBACK_ORDER);
		});
	if (feedback.length) delivery.feedback = feedback;
	return ordered(delivery, undefined, DELIVERY_ORDER);
}

/**
 * The record with `delivery` appended, or a new record when this is the
 * class's first delivery of the lesson. Deliveries stay oldest first: one
 * dated earlier than the last goes in at its place.
 */
export function withDelivery(
	record: DeliveryRecord | null,
	offering: string | null,
	ref: string,
	delivery: Delivery
): DeliveryRecord {
	if (!record) return { offering, lesson: ref, deliveries: [delivery] };
	const deliveries = [...record.deliveries];
	let at = deliveries.length;
	if (delivery.taught) {
		while (at > 0 && (deliveries[at - 1].taught ?? '') > delivery.taught) at -= 1;
	}
	deliveries.splice(at, 0, delivery);
	return ordered({ ...record, deliveries }, Object.keys(record), RECORD_ORDER);
}

export interface Resolution {
	delivery: number;
	index: number;
	status: 'applied' | 'declined';
	/** The day it was resolved. */
	date: string;
	note: string;
	/** The commit that applied the change, where there is one. */
	commit: string | null;
}

/**
 * The record with the given items applied or declined. Only open items
 * change; anything else is left as it is. Every other key keeps its value and
 * its place.
 */
export function resolveFeedback(record: DeliveryRecord, resolutions: Resolution[]): DeliveryRecord {
	const deliveries = record.deliveries.map((delivery, d) => {
		const mine = resolutions.filter((r) => r.delivery === d);
		if (!mine.length || !delivery.feedback) return delivery;
		const feedback = delivery.feedback.map((item, i) => {
			const r = mine.find((m) => m.index === i);
			if (!r || item.status !== 'open') return item;
			const next: FeedbackItem = { ...item, status: r.status, resolved: r.date };
			const note = normaliseText(r.note).trim();
			if (note) next.note = note;
			if (r.status === 'applied' && r.commit) next.plan_commit_after = r.commit;
			return ordered(next, Object.keys(item), FEEDBACK_ORDER);
		});
		return { ...delivery, feedback };
	});
	return { ...record, deliveries };
}

/**
 * The record with one delivery's links replaced. No links removes the key.
 * Every other key keeps its value and its place.
 */
export function withMaterials(
	record: DeliveryRecord,
	delivery: number,
	drafts: MaterialDraft[]
): DeliveryRecord {
	const links = materialsFrom(drafts);
	const deliveries = record.deliveries.map((d, i) => {
		if (i !== delivery) return d;
		const next: Delivery = { ...d };
		if (links.length) next.materials = links;
		else delete next.materials;
		return ordered(next, Object.keys(d), DELIVERY_ORDER);
	});
	return { ...record, deliveries };
}

/** Today in the teacher's own time zone, as `YYYY-MM-DD`. */
export function today(now = new Date()): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** `2026-07-21` -> `21 Jul 2026` */
export function formatDate(iso: string): string {
	const [y, m, d] = iso.split('-').map(Number);
	if (!y || !m || !d) return iso;
	return new Date(y, m - 1, d).toLocaleDateString('en-AU', {
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	});
}
