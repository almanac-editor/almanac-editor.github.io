import { describe, expect, it } from 'vitest';
import { Data } from '../data.ts';
import { DEMO_TARGET, demoFetch } from '../demo.ts';
import {
	deliveryPath,
	feedbackEntries,
	formatDate,
	lessonRef,
	newDelivery,
	recordPaths,
	resolveFeedback,
	snapshot,
	today,
	withDelivery,
	withMaterials,
	type DeliveryRecord
} from './deliveries.ts';
import { dump } from './format.ts';
import { timing } from './lessonView.ts';
import { comparePlans, planChanged } from './planDiff.ts';
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
	materials: { deck: 'dist/deck.pptx' }
});

const input = (more = {}) => ({
	taught: '2026-07-21',
	by: '  Sample Teacher ',
	deviations: '',
	feedback: [
		{ issue: 'Ran long.', change: '' },
		{ issue: '   ', change: 'ignored' }
	],
	...more
});

describe('paths', () => {
	it('splits a lesson path at its last units/ or revision/', () => {
		expect(lessonRef('subjects/ec/hsc/units/a/lessons/01.json')).toEqual({
			subject: 'subjects/ec/hsc',
			ref: 'units/a/lessons/01.json'
		});
		expect(lessonRef('subjects/ct/revision/final/lessons/01.json')).toEqual({
			subject: 'subjects/ct',
			ref: 'revision/final/lessons/01.json'
		});
		expect(lessonRef('subjects/x/lessons/01.json')).toBeNull();
	});

	it('puts a record beside its offering', () => {
		expect(deliveryPath('offerings/2026_y10_class1.json', 'units/a/lessons/01.json')).toBe(
			'offerings/2026_y10_class1/taught/units/a/lessons/01.json'
		);
	});

	it('finds the records for one lesson and no other', () => {
		const ref = 'units/a/lessons/01.json';
		const found = recordPaths(
			[
				'offerings/2026_b.json',
				`offerings/2026_b/taught/${ref}`,
				`offerings/2026_a/taught/${ref}`,
				`offerings/2026_unattributed/taught/${ref}`,
				'offerings/2026_a/taught/units/a/lessons/02.json',
				`offerings/x/y/taught/${ref}`,
				`subjects/s/taught/${ref}`
			],
			ref
		);
		expect(found).toEqual([
			{
				path: `offerings/2026_a/taught/${ref}`,
				offeringPath: 'offerings/2026_a.json',
				unattributed: false
			},
			{
				path: `offerings/2026_b/taught/${ref}`,
				offeringPath: 'offerings/2026_b.json',
				unattributed: false
			},
			{
				path: `offerings/2026_unattributed/taught/${ref}`,
				offeringPath: 'offerings/2026_unattributed.json',
				unattributed: true
			}
		]);
	});
});

describe('newDelivery', () => {
	it('writes the fields in schema order and drops what is blank', () => {
		const d = newDelivery(input(), plan(), 'abc1234');
		expect(Object.keys(d)).toEqual(['taught', 'by', 'plan', 'plan_commit', 'feedback']);
		expect(d.by).toBe('Sample Teacher');
		expect(d.feedback).toEqual([{ issue: 'Ran long.', status: 'open', raised: '2026-07-21' }]);
	});

	it('snapshots the plan without materials, and leaves the lesson alone', () => {
		const lesson = plan();
		const d = newDelivery(input(), lesson, null);
		expect(d.plan).toEqual(snapshot(lesson));
		expect(d.plan).not.toHaveProperty('materials');
		expect(lesson).toHaveProperty('materials');
		expect(d).not.toHaveProperty('plan_commit');
	});

	it('has no feedback key when there is none', () => {
		const d = newDelivery(input({ feedback: [], deviations: 'Fire drill.' }), plan(), null);
		expect(Object.keys(d)).toEqual(['taught', 'by', 'deviations', 'plan']);
	});
});

describe('withDelivery', () => {
	const d = (taught?: string) => (taught ? { taught } : { source: 'migrated' });

	it('starts a record for the first delivery', () => {
		expect(withDelivery(null, '2026-a', 'units/a/lessons/01.json', d('2026-01-01'))).toEqual({
			offering: '2026-a',
			lesson: 'units/a/lessons/01.json',
			deliveries: [{ taught: '2026-01-01' }]
		});
	});

	it('appends, keeping deliveries oldest first', () => {
		const record: DeliveryRecord = {
			offering: 'a',
			lesson: 'l',
			deliveries: [d(), d('2026-02-01'), d('2026-05-01')]
		};
		const later = withDelivery(record, 'a', 'l', d('2026-06-01'));
		expect(later.deliveries.map((x) => x.taught)).toEqual([
			undefined,
			'2026-02-01',
			'2026-05-01',
			'2026-06-01'
		]);
		const between = withDelivery(record, 'a', 'l', d('2026-03-01'));
		expect(between.deliveries.map((x) => x.taught)).toEqual([
			undefined,
			'2026-02-01',
			'2026-03-01',
			'2026-05-01'
		]);
		expect(record.deliveries).toHaveLength(3);
	});
});

describe('materials on a delivery', () => {
	const link = { kind: 'deck' as const, label: '', url: 'https://drive.example.com/deck' };

	it('adds links from Mark as taught at their schema place', () => {
		const d = newDelivery(input({ materials: [link] }), plan(), 'abc1234');
		expect(Object.keys(d)).toEqual([
			'taught',
			'by',
			'plan',
			'plan_commit',
			'materials',
			'feedback'
		]);
		expect(d.materials).toEqual([{ kind: 'deck', url: 'https://drive.example.com/deck' }]);
	});

	it('sets one delivery’s links, keeping every other key in place, and removes them when cleared', () => {
		const record = {
			offering: 'a',
			lesson: 'l',
			deliveries: [
				{ taught: '2026-01-01', feedback: [{ issue: 'x', status: 'open' as const }] },
				{ taught: '2026-02-01' }
			]
		};
		const added = withMaterials(record, 0, [link]);
		expect(Object.keys(added.deliveries[0])).toEqual(['taught', 'materials', 'feedback']);
		expect(added.deliveries[1]).toBe(record.deliveries[1]);
		expect(withMaterials(added, 0, []).deliveries[0]).toEqual(record.deliveries[0]);
	});
});

describe('feedback', () => {
	const records: { path: string; record: DeliveryRecord }[] = [
		{
			path: 'one',
			record: {
				offering: 'a',
				lesson: 'l',
				deliveries: [
					{
						taught: '2026-02-01',
						feedback: [
							{ issue: 'A', status: 'open' },
							{ issue: 'B', status: 'applied', raised: '2026-03-01', resolved: '2026-04-01' }
						]
					}
				]
			}
		},
		{
			path: 'two',
			record: {
				offering: null,
				lesson: 'l',
				deliveries: [{ source: 'migrated', feedback: [{ issue: 'C', status: 'open' }] }]
			}
		},
		{
			path: 'three',
			record: {
				offering: 'b',
				lesson: 'l',
				deliveries: [{ taught: '2026-02-10', feedback: [{ issue: 'D', status: 'open' }] }]
			}
		}
	];

	it('lists newest first, dated by raised then taught, undated last', () => {
		const entries = feedbackEntries(records);
		expect(entries.map((e) => e.item.issue)).toEqual(['B', 'D', 'A', 'C']);
		expect(entries[3]).toMatchObject({ path: 'two', offering: null, taught: null });
	});

	it('applies and declines open items only, keeping key order', () => {
		const record = records[0].record;
		const next = resolveFeedback(record, [
			{ delivery: 0, index: 0, status: 'applied', date: '2026-05-01', note: '', commit: 'abc1234' },
			{ delivery: 0, index: 1, status: 'declined', date: '2026-05-01', note: 'x', commit: null }
		]);
		expect(next.deliveries[0].feedback).toEqual([
			{ issue: 'A', status: 'applied', resolved: '2026-05-01', plan_commit_after: 'abc1234' },
			record.deliveries[0].feedback?.[1]
		]);
		expect(record.deliveries[0].feedback?.[0].status).toBe('open');
	});

	it('records a declined item with its note and no commit', () => {
		const next = resolveFeedback(records[1].record, [
			{ delivery: 0, index: 0, status: 'declined', date: '2026-05-01', note: ' No. ', commit: 'f' }
		]);
		expect(next.deliveries[0].feedback?.[0]).toEqual({
			issue: 'C',
			status: 'declined',
			resolved: '2026-05-01',
			note: 'No.'
		});
	});

	it('changes no bytes when nothing is resolved', () => {
		const record = records[0].record;
		expect(dump(resolveFeedback(record, []))).toBe(dump(record));
	});
});

describe('dates', () => {
	it('gives today as a local date', () => {
		expect(today(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
	});

	it('formats a date for reading', () => {
		expect(formatDate('2026-07-21')).toMatch(/^21 Jul.* 2026$/);
	});
});

describe('Data, against the sample repo', () => {
	const lessonPath =
		'subjects/design_tech/units/product_design/lessons/01_what_makes_good_design.json';
	const data = () => new Data(new Repo({ ...DEMO_TARGET }, 'sample', demoFetch()));

	it("reads every class's record for a lesson, and the unattributed ones", async () => {
		const held = await data().deliveries(lessonPath);
		expect(held.map((h) => h.offering?.id)).toEqual(['2025-y7-class-a', '2026-y7-class-a']);
		const other = await data().deliveries(
			'subjects/design_tech/units/product_design/lessons/04_cardboard_prototypes.json'
		);
		expect(other.map((h) => [h.offeringPath, h.record.offering])).toEqual([[null, null]]);
	});

	it('shows last year’s class a plan that has changed since, and this year’s the plan as it stands', async () => {
		const d = data();
		const [lastYear, thisYear] = await d.deliveries(lessonPath);
		const { doc } = await d.lesson(lessonPath);
		const before = lastYear.record.deliveries[0].plan as Lesson;
		const diff = comparePlans(before, doc);
		expect(diff.changed).toBe(true);
		expect(diff.sections.map((r) => r.status)).toEqual([
			'changed',
			'added',
			'changed',
			'changed',
			'added',
			'same'
		]);
		expect(timing(before).total).toBe(65);
		expect(planChanged(thisYear.record.deliveries[0].plan as Lesson, doc)).toBe(false);
	});

	it('skips a class that teaches another subject', async () => {
		const held = await data().deliveries(
			'subjects/media_arts/units/product_design/lessons/01_what_makes_good_design.json'
		);
		expect(held).toEqual([]);
	});

	it('creates a record for a first delivery, then appends to it', async () => {
		const d = data();
		const offeringPath = 'offerings/2026_y08_class_b.json';
		const offering = await d.offering(offeringPath);
		const { doc } = await d.lesson(lessonPath);
		await d.markTaught(offeringPath, offering, lessonPath, doc, input());
		await d.markTaught(offeringPath, offering, lessonPath, doc, input({ taught: '2026-07-28' }));
		const mine = (await d.deliveries(lessonPath)).find((h) => h.offeringPath === offeringPath);
		expect(mine?.record.offering).toBe('2026-y8-class-b');
		expect(mine?.record.lesson).toBe('units/product_design/lessons/01_what_makes_good_design.json');
		expect(mine?.record.deliveries.map((x) => x.taught)).toEqual(['2026-07-21', '2026-07-28']);
		expect(mine?.record.deliveries[0].plan_commit).toMatch(/^[0-9a-f]{7,40}$/);
	});

	it('saves a delivery’s links, and refuses over a record that changed since it was read', async () => {
		const d = data();
		const [lastYear] = await d.deliveries(lessonPath);
		const deck = {
			kind: 'deck' as const,
			label: 'Slides as shown',
			url: 'https://drive.example.com/d'
		};
		await d.saveMaterials(lastYear, 0, [deck], 'Add links');
		const [after] = await d.deliveries(lessonPath);
		expect(after.record.deliveries[0].materials).toEqual([deck]);
		await expect(d.saveMaterials(lastYear, 0, [], 'Clear')).rejects.toBeInstanceOf(ConflictError);
	});

	it('refuses to resolve over a record that changed since it was read', async () => {
		const d = data();
		const [, held] = await d.deliveries(lessonPath);
		const offering = held.offering as Offering;
		const { doc } = await d.lesson(lessonPath);
		await d.markTaught(held.offeringPath as string, offering, lessonPath, doc, input());
		const close = [
			{ delivery: 0, index: 0, status: 'applied' as const, date: today(), note: '', commit: null }
		];
		await expect(d.resolve(held, close, 'Close')).rejects.toBeInstanceOf(ConflictError);
		const [, fresh] = await d.deliveries(lessonPath);
		await d.resolve(fresh, close, 'Close');
		const [, after] = await d.deliveries(lessonPath);
		expect(after.record.deliveries[0].feedback?.[0].status).toBe('applied');
	});
});
