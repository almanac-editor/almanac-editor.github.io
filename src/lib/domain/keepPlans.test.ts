import { describe, expect, it } from 'vitest';
import { Data } from '../data.ts';
import { DEMO_TARGET, demoFetch } from '../demo.ts';
import {
	keepOutcome,
	keepPlan,
	keptStamp,
	offeringLessons,
	plansAtRisk,
	plansToKeep,
	type DeliveryRecord
} from './deliveries.ts';
import { copyOffering, offeringPath } from './newOffering.ts';
import { ConflictError, Repo } from './repo.ts';
import type { Lesson, Offering } from './types.ts';

const plan = (): Lesson => ({
	title: 'Sorting socks',
	description: 'Pairs.',
	duration_minutes: 60,
	sections: [{ section: 'Sort.', duration_minutes: 60 }],
	learning_intentions: [],
	success_criteria: [],
	curriculum_links: [],
	materials: { deck: {} }
});

const offering = (year: number, more: Partial<Offering> = {}): Offering => ({
	id: `${year}-y7-a`,
	year,
	subject: 'subjects/socks',
	units: [{ unit: 'units/pairs' }],
	...more
});

describe('offeringLessons', () => {
	it('takes an entry’s own list, else the unit’s, then one-offs sorted, without repeats', () => {
		const o = offering(2026, {
			units: [
				{ unit: 'units/pairs', lessons: ['lessons/02.json', 'lessons/01.json'] },
				{ unit: 'units/piles' },
				{ unit: 'units/pairs' }
			],
			one_offs: [{ path: 'one_offs/day_one' }]
		});
		const lessons = offeringLessons(
			o,
			(unit) => (unit === 'units/piles' ? ['lessons/01.json'] : ['lessons/03.json']),
			() => ['one_offs/day_one/lessons/b.json', 'one_offs/day_one/lessons/a.json']
		);
		expect(lessons).toEqual([
			{ ref: 'units/pairs/lessons/02.json', unit: 'units/pairs' },
			{ ref: 'units/pairs/lessons/01.json', unit: 'units/pairs' },
			{ ref: 'units/piles/lessons/01.json', unit: 'units/piles' },
			{ ref: 'units/pairs/lessons/03.json', unit: 'units/pairs' },
			{ ref: 'one_offs/day_one/lessons/a.json', unit: 'one_offs/day_one' },
			{ ref: 'one_offs/day_one/lessons/b.json', unit: 'one_offs/day_one' }
		]);
	});

	it('treats a unit it cannot read as having no lessons', () => {
		expect(
			offeringLessons(
				offering(2026),
				() => null,
				() => []
			)
		).toEqual([]);
	});
});

describe('plansToKeep', () => {
	const lessons = (...refs: string[]) => refs.map((ref) => ({ ref, unit: 'units/pairs' }));
	const record = (deliveries: DeliveryRecord['deliveries']): DeliveryRecord => ({
		offering: '2025-y7-a',
		lesson: 'units/pairs/lessons/01.json',
		deliveries
	});

	it('names earlier classes’ shared lessons with no plan kept, and how each would be kept', () => {
		const next = {
			offering: offering(2027),
			lessons: lessons(
				'units/pairs/lessons/01.json',
				'units/pairs/lessons/02.json',
				'units/pairs/lessons/03.json',
				'units/pairs/lessons/04.json'
			)
		};
		const earlier = {
			path: 'offerings/2025_y7_a.json',
			offering: offering(2025),
			lessons: lessons(
				'units/pairs/lessons/01.json',
				'units/pairs/lessons/02.json',
				'units/pairs/lessons/03.json',
				'units/pairs/lessons/04.json',
				'units/pairs/lessons/09.json'
			)
		};
		const taught = 'offerings/2025_y7_a/taught/units/pairs/lessons';
		const records = new Map([
			[`${taught}/01.json`, record([{ taught: '2025-02-01', plan: plan() }])],
			[`${taught}/02.json`, record([{ taught: '2025-02-08' }])],
			[`${taught}/03.json`, record([{ taught: '2025-02-15' }, { taught: '2025-06-15' }])]
		]);
		const found = plansToKeep(next, [earlier], records);
		expect(found.map((k) => [k.ref.split('/').pop(), k.outcome, k.recordPath])).toEqual([
			['02.json', 'add', `${taught}/02.json`],
			['03.json', 'several', `${taught}/03.json`],
			['04.json', 'write', `${taught}/04.json`]
		]);
	});

	it('leaves classes of the same year, a later year, or another subject alone', () => {
		const next = { offering: offering(2026), lessons: lessons('units/pairs/lessons/01.json') };
		const classes = [
			{ path: 'offerings/a.json', offering: offering(2026), lessons: next.lessons },
			{ path: 'offerings/b.json', offering: offering(2027), lessons: next.lessons },
			{
				path: 'offerings/c.json',
				offering: offering(2025, { subject: 'subjects/hats' }),
				lessons: next.lessons
			}
		];
		expect(plansToKeep(next, classes, new Map())).toEqual([]);
	});
});

describe('plansAtRisk', () => {
	const ref = 'units/pairs/lessons/01.json';
	const lessons = [{ ref, unit: 'units/pairs' }];
	const classOf = (year: number) => ({
		path: `offerings/${year}_y7_a.json`,
		offering: offering(year),
		lessons
	});

	it('names earlier classes once a later class takes the lesson too', () => {
		const found = plansAtRisk(ref, [classOf(2025), classOf(2026), classOf(2027)], new Map());
		expect(found.map((k) => k.offering.year)).toEqual([2025, 2026]);
	});

	it('names none while only one year takes it', () => {
		expect(plansAtRisk(ref, [classOf(2026)], new Map())).toEqual([]);
	});
});

describe('keepPlan', () => {
	const stamp = keptStamp('2026-10-24', 'when 2027-y7-a was created', 'abc1234def');

	it('says who kept the plan, when, why and from which commit', () => {
		expect(stamp).toBe(
			'plan kept by almanac-editor on 2026-10-24, when 2027-y7-a was created, from abc1234'
		);
		expect(keptStamp('2026-10-24', 'when 2027-y7-a was created', null)).toBe(
			'plan kept by almanac-editor on 2026-10-24, when 2027-y7-a was created'
		);
	});

	it('writes a new record with the plan, without materials', () => {
		const record = keepPlan(
			null,
			'2025-y7-a',
			'units/pairs/lessons/01.json',
			plan(),
			'abc1234def',
			stamp
		);
		expect(Object.keys(record.deliveries[0])).toEqual(['plan', 'plan_commit', 'source']);
		expect(record.deliveries[0].plan).not.toHaveProperty('materials');
		expect(record.deliveries[0].source).toBe(`${stamp}. Date and teacher not recorded.`);
	});

	it('adds the plan to a record’s one delivery at its schema place, joining the source', () => {
		const before: DeliveryRecord = {
			offering: '2025-y7-a',
			lesson: 'units/pairs/lessons/01.json',
			deliveries: [
				{
					taught: '2025-02-01',
					source: 'migrated from lesson feedback',
					feedback: [{ issue: 'Ran long.', status: 'open' }]
				}
			]
		};
		const after = keepPlan(before, '2025-y7-a', 'units/pairs/lessons/01.json', plan(), null, stamp);
		expect(Object.keys(after.deliveries[0])).toEqual(['taught', 'plan', 'source', 'feedback']);
		expect(after.deliveries[0].source).toBe(`migrated from lesson feedback; ${stamp}`);
		expect(keepOutcome(after)).toBe('has');
	});

	it('refuses a record it must leave', () => {
		const several: DeliveryRecord = {
			offering: 'a',
			lesson: 'l',
			deliveries: [{ taught: '2025-01-01' }, { taught: '2025-06-01' }]
		};
		expect(() => keepPlan(several, 'a', 'l', plan(), null, stamp)).toThrow();
	});
});

describe('Keeping plans, against the sample repo', () => {
	const fetcher = () => demoFetch();
	const repo = (f = fetcher()) => new Repo({ ...DEMO_TARGET }, 'sample', f);

	it('keeps the earlier classes’ plans in the same commit as the new class', async () => {
		const store = repo();
		const data = new Data(store);
		const source = await data.offering('offerings/2026_y07_class_a.json');
		const next = copyOffering(source, {
			id: '2027-y7-class-a',
			year: 2027,
			year_group: 'Year 7',
			class_label: 'Class A'
		});
		const keep = await data.plansToKeep(next);
		const brief = 'units/product_design/lessons/02_writing_a_brief.json';
		const outcome = (path: string, ref: string) =>
			keep.find((k) => k.offeringPath === path && k.ref === ref)?.outcome;
		// Lesson 1 already has its plan kept by both Year 7 classes; lesson 2's 2026 record has a delivery but no plan.
		const good = 'units/product_design/lessons/01_what_makes_good_design.json';
		expect(outcome('offerings/2025_y07_class_a.json', good)).toBeUndefined();
		expect(outcome('offerings/2026_y07_class_a.json', good)).toBeUndefined();
		expect(outcome('offerings/2026_y07_class_a.json', brief)).toBe('add');
		expect(outcome('offerings/2025_y07_class_a.json', brief)).toBe('write');
		// Year 8 took some circuits lessons and all of product design; those are at risk.
		expect(
			keep.filter((k) => k.offeringPath === 'offerings/2026_y08_class_b.json').map((k) => k.ref)
		).toEqual([
			'units/simple_circuits/lessons/01_battery_and_bulb.json',
			'units/simple_circuits/lessons/03_switches.json',
			'units/simple_circuits/lessons/04_build_a_torch.json',
			'units/product_design/lessons/01_what_makes_good_design.json',
			'units/product_design/lessons/02_writing_a_brief.json',
			'units/product_design/lessons/03_sketching_ideas.json',
			'units/product_design/lessons/04_cardboard_prototypes.json',
			'units/product_design/lessons/05_test_and_evaluate.json'
		]);

		const before = await store.head();
		await data.createOffering(next, keep);
		const after = await store.head();
		expect(after).not.toBe(before);
		expect(await store.has(offeringPath(next.id))).toBe(true);
		const kept = (
			await store.readJson<DeliveryRecord>(`offerings/2026_y07_class_a/taught/${brief}`)
		).doc;
		expect(Object.keys(kept.deliveries[0])).toEqual([
			'taught',
			'by',
			'plan',
			'plan_commit',
			'source'
		]);
		expect(kept.deliveries[0].plan_commit).toBe(before);
		expect(await data.plansToKeep(next)).toEqual([]);
	});

	it('keeps the plan as it was before an edit, in the same commit as the edit', async () => {
		const store = repo();
		const data = new Data(store);
		const path = 'subjects/design_tech/units/product_design/lessons/02_writing_a_brief.json';
		const ref = 'units/product_design/lessons/02_writing_a_brief.json';
		// 2026's classes take lesson 2 after 2025's Year 7, which has no record for it.
		const keep = await data.plansAtRisk(path);
		expect(keep.map((k) => [k.offeringPath, k.outcome])).toEqual([
			['offerings/2025_y07_class_a.json', 'write']
		]);
		const { doc: before, sha } = await data.lesson(path);
		const edited = { ...before, title: 'Writing a sharper brief' };
		const newSha = await data.saveLesson(path, edited, sha, 'Edit 02', keep, before);
		const saved = await data.lesson(path);
		expect(saved.sha).toBe(newSha);
		expect(saved.doc.title).toBe('Writing a sharper brief');
		const record = (
			await store.readJson<DeliveryRecord>(`offerings/2025_y07_class_a/taught/${ref}`)
		).doc;
		expect(record.deliveries[0].plan?.title).toBe(before.title);
		expect(record.deliveries[0].source).toMatch(/before the lesson was edited/);
		expect(await data.plansAtRisk(path)).toEqual([]);
	});

	it('refuses the whole save when a file changed since it was read', async () => {
		const store = repo();
		const path = 'offerings/2026_y07_class_a.json';
		const { doc, sha } = await store.readJson<Offering>(path);
		await store.writeJson(path, { ...doc, class_label: 'Class Z' }, sha, 'Edit elsewhere');
		await expect(
			store.writeMany(
				[
					{ path: 'offerings/new.json', doc: { id: 'x' }, sha: null },
					{ path, doc, sha }
				],
				'Both'
			)
		).rejects.toBeInstanceOf(ConflictError);
		expect(await store.has('offerings/new.json')).toBe(false);
	});

	it('refuses when the branch moves while the commit is made', async () => {
		const inner = fetcher();
		let moved = false;
		const store = repo(async (input, init) => {
			if (!moved && init?.method === 'PATCH') {
				moved = true;
				// Someone else commits between our commit and moving the branch.
				const other = new Repo({ ...DEMO_TARGET }, 'sample', inner);
				const { doc, sha } = await other.readJson('offerings/2026_y07_class_a.json');
				await other.writeJson('offerings/2026_y07_class_a.json', doc, sha, 'Elsewhere');
			}
			return inner(input, init);
		});
		await expect(
			store.writeMany([{ path: 'offerings/new.json', doc: { id: 'x' }, sha: null }], 'New')
		).rejects.toBeInstanceOf(ConflictError);
		store.refresh();
		expect(await store.has('offerings/new.json')).toBe(false);
	});
});
