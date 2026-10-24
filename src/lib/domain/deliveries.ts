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
import type { Lesson } from './types.ts';

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
	materials?: unknown[];
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

export interface TaughtInput {
	taught: string;
	by: string;
	deviations: string;
	feedback: { issue: string; change: string }[];
}

/**
 * A new delivery from what the teacher typed. Blank fields are left out, and
 * feedback with no issue is dropped. Each item is open and raised on the day
 * the lesson ran.
 */
export function newDelivery(input: TaughtInput, plan: Lesson, commit: string | null): Delivery {
	const text = (value: string) => normaliseText(value).trim();
	const delivery: Delivery = { taught: input.taught };
	if (text(input.by)) delivery.by = text(input.by);
	if (text(input.deviations)) delivery.deviations = text(input.deviations);
	delivery.plan = snapshot(plan);
	if (commit) delivery.plan_commit = commit;
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
