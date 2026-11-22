/**
 * The plans a search reads, for each place it can search from: one unit, one
 * class's year, a subject, or every plan. Reads through `Data`, so it works the
 * same on a folder and on GitHub.
 *
 * A folder is read fresh each time the page opens, so a plan changed in
 * another program is found as it is now. On GitHub, files already read come
 * from the blob cache. Either way, reads run a few at a time (`mapLimit`).
 *
 * For a class, a lesson already taught is searched in the plan its delivery
 * record kept, which is what the class was taught; a lesson still to come is
 * searched in today's plan, with the date the class calendar gives it.
 */

import type { Data } from './data.ts';
import { formatDate, lessonRef, today, type DeliveryRecord } from './domain/deliveries.ts';
import { join } from './domain/paths.ts';
import { lessonRefs } from './domain/offerings.ts';
import {
	classOrder,
	planClass,
	taughtDates,
	teachingSlots,
	type ClassPlan
} from './domain/schedule.ts';
import { mapLimit, planFields, type Field } from './domain/search.ts';
import type { Lesson, Offering, Unit } from './domain/types.ts';
import { humanise } from './house.ts';

/** How many files are read at once. */
const AT_ONCE = 12;

export type Status =
	| { kind: 'taught'; dates: string[] }
	| { kind: 'planned'; date: string | null; past: boolean }
	| { kind: 'unwritten' }
	| { kind: 'none' };

export interface SearchItem {
	unitDir: string;
	unitTitle: string;
	/** Relative to the unit, as the lesson page's `l`; null for a lesson not written yet. */
	ref: string | null;
	/** Its place in the unit's order (or the class's order for that unit), from 1; null when outside it. */
	number: number | null;
	title: string;
	/** The term of the class's unit entry, for the lesson link's `t`. */
	term: string | null;
	status: Status;
	fields: Field[];
}

export interface Corpus {
	items: SearchItem[];
	/** Plans that could not be read; they are left out rather than failing the search. */
	unreadable: string[];
}

type Progress = (done: number, total: number) => void;

/** What a delivery record holds for searching: the plan last taught, its dates, and deviations. */
export function fromRecord(record: DeliveryRecord | undefined): {
	plan: Lesson | null;
	dates: string[];
	deviations: string[];
} {
	const deliveries = record?.deliveries ?? [];
	const plan = deliveries.findLast((d) => d.plan)?.plan ?? null;
	return {
		plan,
		dates: deliveries.flatMap((d) => (d.taught ? [d.taught] : [])).sort(),
		deviations: deliveries.flatMap((d) => (d.deviations ? [d.deviations] : []))
	};
}

/** One plan read for searching, with its content file; null when it can't be read. */
async function readPlan(
	data: Data,
	path: string,
	unreadable: string[]
): Promise<{ plan: Lesson; content: string | null } | null> {
	try {
		const [loaded, content] = await Promise.all([data.lesson(path), data.content(path)]);
		return { plan: loaded.doc, content };
	} catch {
		unreadable.push(path);
		return null;
	}
}

function unwritten(unitDir: string, unit: Unit): SearchItem[] {
	return (unit.planned ?? []).map((p) => ({
		unitDir,
		unitTitle: unit.unit_title,
		ref: null,
		number: null,
		title: p.title,
		term: null,
		status: { kind: 'unwritten' },
		fields: [
			{ where: 'Title', text: p.title },
			...(p.note ? [{ where: 'Planned lesson note', text: p.note }] : [])
		]
	}));
}

/** Every plan in each unit, in the unit's own order, then its lessons not written yet. */
async function unitsCorpus(
	data: Data,
	units: { dir: string; unit: Unit }[],
	onProgress?: Progress
): Promise<Corpus> {
	const jobs = units.flatMap(({ dir, unit }) =>
		(unit.lessons ?? []).map((ref, i) => ({ dir, unit, ref, number: i + 1 }))
	);
	const unreadable: string[] = [];
	const read = await mapLimit(
		jobs,
		AT_ONCE,
		(j) => readPlan(data, join(j.dir, j.ref), unreadable),
		(done) => onProgress?.(done, jobs.length)
	);
	const items: SearchItem[] = [];
	for (const { dir, unit } of units) {
		jobs.forEach((j, i) => {
			const got = read[i];
			if (j.dir !== dir || !got) return;
			items.push({
				unitDir: dir,
				unitTitle: unit.unit_title,
				ref: j.ref,
				number: j.number,
				title: got.plan.title || humanise(j.ref.split('/').pop() ?? j.ref),
				term: null,
				status: { kind: 'none' },
				fields: planFields(got.plan, got.content)
			});
		});
		items.push(...unwritten(dir, unit));
	}
	return { items, unreadable };
}

/** Every unit in a subject (`subjects/science`), or every unit when `subject` is null. */
export async function subjectCorpus(
	data: Data,
	subject: string | null,
	onProgress?: Progress
): Promise<Corpus> {
	const units = (await data.units())
		.filter((u) => subject === null || u.dir.startsWith(subject + '/'))
		.toSorted((a, b) => a.dir.localeCompare(b.dir));
	return unitsCorpus(data, units, onProgress);
}

/** One unit's plans, in its own order. */
export async function unitCorpus(data: Data, u: string, onProgress?: Progress): Promise<Corpus> {
	return unitsCorpus(data, [{ dir: u, unit: await data.unit(u) }], onProgress);
}

interface ClassContext {
	offering: Offering;
	units: Map<string, Unit>;
	records: Map<string, DeliveryRecord>;
	plan: ClassPlan;
}

async function classContext(data: Data, o: string): Promise<ClassContext> {
	const [offerings, units, held, calendars] = await Promise.all([
		data.offerings(),
		data.units(),
		data.classDeliveries(o),
		data.calendars()
	]);
	const offering = offerings.find(([path]) => path === o)?.[1];
	if (!offering) throw new Error(`${o} is not a class in these files.`);
	const unitMap = new Map(units.map((x) => [x.dir, x.unit]));
	const slots = teachingSlots(
		[...calendars.values()].map((f) => f.doc),
		offering.timetable ?? [],
		offering.year_group ?? null
	);
	const plan = planClass(
		classOrder(offering, unitMap),
		taughtDates(held.map((h) => h.record)),
		slots,
		today()
	);
	return {
		offering,
		units: unitMap,
		records: new Map(held.map((h) => [h.record.lesson, h.record])),
		plan
	};
}

/** Where a lesson stands for the class: its taught dates, or the date it is planned for. */
function statusIn(ctx: ClassContext, subjectRef: string, term: string | null): Status {
	const taught = fromRecord(ctx.records.get(subjectRef)).dates;
	if (taught.length) return { kind: 'taught', dates: taught };
	const now = today();
	const placed =
		ctx.plan.planned.find((p) => p.item.subjectRef === subjectRef && p.item.term === term) ??
		ctx.plan.planned.find((p) => p.item.subjectRef === subjectRef);
	if (placed) return { kind: 'planned', date: placed.date, past: placed.date < now };
	return { kind: 'planned', date: null, past: false };
}

async function classItems(
	data: Data,
	ctx: ClassContext,
	jobs: { unitDir: string; ref: string; number: number | null; term: string | null }[],
	onProgress?: Progress
): Promise<Corpus> {
	const unreadable: string[] = [];
	const subjectRef = (unitDir: string, ref: string) => lessonRef(join(unitDir, ref))?.ref ?? ref;
	const read = await mapLimit(
		jobs,
		AT_ONCE,
		async (j) => {
			const kept = fromRecord(ctx.records.get(subjectRef(j.unitDir, j.ref)));
			if (kept.plan) {
				// The record keeps the plan, not its content file: search today's file, and say so.
				const content = await data.content(join(j.unitDir, j.ref)).catch(() => null);
				return { plan: kept.plan, content, deviations: kept.deviations, contentToday: true };
			}
			const got = await readPlan(data, join(j.unitDir, j.ref), unreadable);
			return got && { ...got, deviations: kept.deviations, contentToday: false };
		},
		(done) => onProgress?.(done, jobs.length)
	);
	const items: SearchItem[] = [];
	jobs.forEach((j, i) => {
		const got = read[i];
		if (!got) return;
		const unit = ctx.units.get(j.unitDir);
		items.push({
			unitDir: j.unitDir,
			unitTitle: unit?.unit_title ?? humanise(j.unitDir.split('/').pop() ?? j.unitDir),
			ref: j.ref,
			number: j.number,
			title: got.plan.title || humanise(j.ref.split('/').pop() ?? j.ref),
			term: j.term,
			status: statusIn(ctx, subjectRef(j.unitDir, j.ref), j.term),
			fields: planFields(got.plan, got.content, got.deviations).map((f) =>
				got.contentToday && f.where.startsWith('Content')
					? { ...f, where: f.where.replace(/^Content/, 'Content file today') }
					: f
			)
		});
	});
	return { items, unreadable };
}

/**
 * A class's whole year in teaching order: what it was taught, as taught, and
 * what is to come. Lessons taught that are not in the class's order come last.
 */
export async function classCorpus(data: Data, o: string, onProgress?: Progress): Promise<Corpus> {
	const ctx = await classContext(data, o);
	const order = classOrder(ctx.offering, ctx.units);
	// Number each lesson within its unit entry, as the lesson page does.
	const counts = new Map<string, number>();
	const jobs: { unitDir: string; ref: string; number: number | null; term: string | null }[] =
		order.map((item) => {
			const key = `${item.unitDir}|${item.term ?? ''}`;
			const n = (counts.get(key) ?? 0) + 1;
			counts.set(key, n);
			return { unitDir: item.unitDir, ref: item.ref, number: n, term: item.term };
		});
	const inOrder = new Set(order.map((i) => i.subjectRef));
	const subjectDirs = [...ctx.units.keys()].filter((d) => d.startsWith(ctx.offering.subject + '/'));
	for (const subjectRef of ctx.records.keys()) {
		if (inOrder.has(subjectRef)) continue;
		const path = join(ctx.offering.subject, subjectRef);
		const unitDir = subjectDirs
			.filter((d) => path.startsWith(d + '/'))
			.sort((a, b) => b.length - a.length)[0];
		if (!unitDir) continue;
		jobs.push({ unitDir, ref: path.slice(unitDir.length + 1), number: null, term: null });
	}
	return classItems(data, ctx, jobs, onProgress);
}

/** One unit in a class's order (`t` picks one of its entries), with the class's dates. */
export async function unitClassCorpus(
	data: Data,
	u: string,
	o: string,
	t: string | null,
	onProgress?: Progress
): Promise<Corpus> {
	const ctx = await classContext(data, o);
	const unit = ctx.units.get(u) ?? (await data.unit(u));
	const refs = lessonRefs(u, unit, ctx.offering, t);
	const jobs = refs.map((ref, i) => ({ unitDir: u, ref, number: i + 1, term: t }));
	const corpus = await classItems(data, ctx, jobs, onProgress);
	corpus.items.push(...unwritten(u, unit));
	return corpus;
}

/** The status in words, for a result row. */
export function statusText(status: Status): string | null {
	switch (status.kind) {
		case 'taught':
			return `Taught ${status.dates.map(formatDate).join(', ')}`;
		case 'planned':
			if (!status.date) return 'Not taught yet';
			return status.past
				? `Planned for ${formatDate(status.date)}, not marked taught`
				: `Planned for ${formatDate(status.date)}`;
		case 'unwritten':
			return 'Planned, not written yet';
		case 'none':
			return null;
	}
}
