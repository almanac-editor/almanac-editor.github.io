import { describe, expect, it } from 'vitest';
import type { Delivery, DeliveryRecord } from './deliveries.ts';
import type { Lesson } from './types.ts';
import { lessonVersions, versionOf } from './versions.ts';

const plan = (minutes: number): Lesson => ({
	title: 'Sorting socks',
	description: 'Pairs, then piles.',
	duration_minutes: 30,
	sections: [{ section: 'Pair every sock.', duration_minutes: minutes }],
	learning_intentions: [],
	success_criteria: [],
	curriculum_links: []
});

const held = (offeringPath: string | null, ...deliveries: Delivery[]) => ({
	offeringPath,
	record: { offering: null, lesson: 'units/a/lessons/01.json', deliveries } as DeliveryRecord
});

describe('lessonVersions', () => {
	it('groups classes taught the same plan, oldest first, and marks the current one', () => {
		const versions = lessonVersions(
			[
				held('offerings/2026_a.json', { taught: '2026-02-10', plan: plan(30) }),
				held('offerings/2025_a.json', { taught: '2025-05-06', plan: plan(35) }),
				held('offerings/2026_b.json', { taught: '2026-03-01', plan: plan(30) })
			],
			{ ...plan(30), materials: {} }
		);
		expect(versions.map((v) => [v.taught.map((t) => t.taught), v.current])).toEqual([
			[['2025-05-06'], false],
			[['2026-02-10', '2026-03-01'], true]
		]);
		expect(versions[1].plan.materials).toEqual({});
	});

	it('adds the current plan last when no class has had it', () => {
		const versions = lessonVersions(
			[held('offerings/2025_a.json', { taught: '2025-05-06', plan: plan(35) })],
			plan(30)
		);
		expect(versions.map((v) => [v.taught.length, v.current])).toEqual([
			[1, false],
			[0, true]
		]);
	});

	it('keeps who taught each delivery and what changed on the day', () => {
		const [version] = lessonVersions(
			[
				held('offerings/2026_a.json', {
					taught: '2026-02-10',
					by: 'A. Teacher',
					deviations: 'Fire drill; skipped the stretch task.',
					plan: plan(30)
				}),
				held('offerings/2026_b.json', { taught: '2026-02-17', deviations: '  ', plan: plan(30) })
			],
			plan(30)
		);
		expect(version.taught).toEqual([
			{
				offeringPath: 'offerings/2026_a.json',
				taught: '2026-02-10',
				by: 'A. Teacher',
				deviations: 'Fire drill; skipped the stretch task.'
			},
			{ offeringPath: 'offerings/2026_b.json', taught: '2026-02-17', by: null, deviations: null }
		]);
	});

	it('skips deliveries without a plan', () => {
		const versions = lessonVersions(
			[held(null, { source: 'migrated from lesson feedback' })],
			plan(30)
		);
		expect(versions).toEqual([{ plan: plan(30), taught: [], current: true }]);
	});
});

describe('versionOf', () => {
	it('finds the version a class last had, or -1', () => {
		const versions = lessonVersions(
			[
				held(
					'offerings/2026_a.json',
					{ taught: '2026-02-10', plan: plan(35) },
					{ taught: '2026-06-10', plan: plan(30) }
				)
			],
			plan(25)
		);
		expect(versionOf(versions, 'offerings/2026_a.json')).toBe(1);
		expect(versionOf(versions, 'offerings/2025_a.json')).toBe(-1);
	});
});
