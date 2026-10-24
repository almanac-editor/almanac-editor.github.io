import { describe, expect, it } from 'vitest';
import { align, comparePlans, planChanged } from './planDiff.ts';
import type { Lesson } from './types.ts';

const plan = (more: Partial<Lesson> = {}): Lesson => ({
	title: 'Sorting socks',
	description: 'Pairs, then piles.',
	duration_minutes: 30,
	sections: [
		{ label: 'Hook', section: 'Tip out the basket.', duration_minutes: 5, kind: 'discussion' },
		{ label: 'Sort', section: 'Pair every sock.', duration_minutes: 20, kind: 'practice' },
		{ label: 'Exit', section: 'Count the odd ones.', duration_minutes: 5, kind: 'review' }
	],
	learning_intentions: ['Match by colour', 'Match by size'],
	success_criteria: ['I can pair ten socks'],
	curriculum_links: [{ framework: 'S', id: 'SK-1', coverage: 'full', mode: 'introduced' }],
	...more
});

describe('planChanged', () => {
	it('ignores materials and key order', () => {
		const taught = plan();
		const current: Lesson = { materials: { deck: {} }, ...plan() };
		expect(planChanged(taught, current)).toBe(false);
	});

	it('sees a change anywhere, even in a field the comparison does not show', () => {
		expect(planChanged(plan(), plan({ resources: [{ name: 'Basket' }] }))).toBe(true);
	});
});

describe('comparePlans', () => {
	it('finds nothing in an unchanged plan', () => {
		const diff = comparePlans(plan(), plan());
		expect(diff.changed).toBe(false);
		expect(diff.text).toEqual([]);
		expect(diff.sections.map((r) => r.status)).toEqual(['same', 'same', 'same']);
		expect(diff.other).toEqual([]);
	});

	it('names the text fields that changed', () => {
		const diff = comparePlans(plan(), plan({ title: 'Pairing socks', summary: 'New.' }));
		expect(diff.text).toEqual([
			{ field: 'title', before: 'Sorting socks', after: 'Pairing socks' },
			{ field: 'summary', before: null, after: 'New.' }
		]);
	});

	it('shows a re-timed and reworded section as changed, keeping the rest the same', () => {
		const current = plan();
		current.sections = structuredClone(current.sections);
		current.sections[1].duration_minutes = 15;
		current.sections[1].section = 'Pair every sock, then fold.';
		const rows = comparePlans(plan(), current).sections;
		expect(rows.map((r) => r.status)).toEqual(['same', 'changed', 'same']);
		expect(rows[1].changed).toEqual(['minutes', 'text']);
	});

	it('shows added and removed sections where they stand', () => {
		const current = plan();
		current.sections = [
			current.sections[0],
			{ label: 'Model', section: 'Show one pair.', duration_minutes: 5, kind: 'instruction' },
			current.sections[1]
		];
		const rows = comparePlans(plan(), current).sections;
		expect(rows.map((r) => [r.status, (r.after ?? r.before)!.label])).toEqual([
			['same', 'Hook'],
			['added', 'Model'],
			['same', 'Sort'],
			['removed', 'Exit']
		]);
	});

	it('pairs a relabelled section with the one it replaced', () => {
		const current = plan();
		current.sections = structuredClone(current.sections);
		current.sections[2].label = 'Exit ticket';
		current.sections[2].section = 'Count the odd ones and write the total.';
		const rows = comparePlans(plan(), current).sections;
		expect(rows.map((r) => r.status)).toEqual(['same', 'same', 'changed']);
		expect(rows[2].changed).toEqual(['label', 'text']);
	});

	it('matches unlabelled sections by their text', () => {
		const strip = (l: Lesson) => ({
			...l,
			sections: l.sections.map(({ section, duration_minutes }) => ({ section, duration_minutes }))
		});
		const taught = strip(plan());
		const current = strip(plan());
		current.sections = [current.sections[1], current.sections[2]];
		expect(comparePlans(taught, current).sections.map((r) => r.status)).toEqual([
			'removed',
			'same',
			'same'
		]);
	});

	it('compares intentions and criteria entry by entry', () => {
		const diff = comparePlans(
			plan(),
			plan({ learning_intentions: ['Match by colour', 'Match by pattern'] })
		);
		expect(diff.learning_intentions).toEqual([
			{ status: 'same', text: 'Match by colour' },
			{ status: 'removed', text: 'Match by size' },
			{ status: 'added', text: 'Match by pattern' }
		]);
		expect(diff.success_criteria).toEqual([{ status: 'same', text: 'I can pair ten socks' }]);
	});

	it('compares curriculum links by id', () => {
		const diff = comparePlans(
			plan(),
			plan({
				curriculum_links: [
					{ framework: 'S', id: 'SK-1', coverage: 'partial', mode: 'introduced' },
					{ framework: 'S', id: 'SK-2', coverage: 'full', mode: 'developed' }
				]
			})
		);
		expect(diff.curriculum_links.map((r) => [r.status, r.changed])).toEqual([
			['changed', ['coverage']],
			['added', []]
		]);
	});

	it('names other fields that differ', () => {
		const diff = comparePlans(
			plan({ differentiation: { support: 'A' } }),
			plan({ differentiation: { support: 'B' }, materials: {} })
		);
		expect(diff.other).toEqual(['differentiation']);
	});
});

describe('align', () => {
	it('keeps order and puts removed entries where they stood', () => {
		const eq = (a: string, b: string) => a === b;
		expect(align(['a', 'b', 'c'], ['a', 'c', 'd'], eq, false)).toEqual([
			['a', 'a'],
			['b', null],
			['c', 'c'],
			[null, 'd']
		]);
	});

	it('handles empty lists', () => {
		const eq = (a: number, b: number) => a === b;
		expect(align([], [1], eq, true)).toEqual([[null, 1]]);
		expect(align([1], [], eq, true)).toEqual([[1, null]]);
	});
});
