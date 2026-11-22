import { describe, expect, it } from 'vitest';
import { contentFields, dedupe, mapLimit, matchFields, planFields, terms } from './search.ts';
import type { Lesson } from './types.ts';

const plan: Lesson = {
	title: 'A new telescope',
	description: 'Better tools give new evidence.',
	duration_minutes: 50,
	sections: [
		{
			label: "Retrieval: Galileo's telescope",
			section: 'Ask what Galileo saw that supported the Sun-centred model.',
			duration_minutes: 5
		},
		{ section: 'Watch the launch video.', duration_minutes: 10 }
	],
	learning_intentions: ['Explain how a new tool changes a model.'],
	success_criteria: ['I can name one thing the telescope showed.'],
	curriculum_links: [
		{
			framework: 'S',
			id: 'OTU-1',
			coverage: 'full',
			mode: 'introduced',
			note: 'From Galileo to JWST.'
		}
	],
	differentiation: { eald: 'Picture of the moons of Jupiter.' },
	resources: [{ name: 'Launch video', notes: 'Naïve questions welcome.' }]
};

const texts = (q: string, fields = planFields(plan)) =>
	matchFields(fields, terms(q))?.map((h) => ({
		where: h.where,
		text: h.parts.map((p) => (p.hit ? `[${p.text}]` : p.text)).join('')
	})) ?? null;

describe('terms', () => {
	it('folds case and accents and keeps quoted phrases whole', () => {
		expect(terms('  Galileo "Sun-centred  MODEL" Naïve galileo')).toEqual([
			'galileo',
			'sun-centred model',
			'naive'
		]);
		expect(terms('   ')).toEqual([]);
	});
});

describe('matchFields', () => {
	it('names every place a word appears, in plan order, marking it', () => {
		expect(texts('galileo')).toEqual([
			{
				where: "Run sheet · Retrieval: Galileo's telescope",
				text: "Retrieval: [Galileo]'s telescope"
			},
			{
				where: "Run sheet · Retrieval: Galileo's telescope",
				text: 'Ask what [Galileo] saw that supported the Sun-centred model.'
			},
			{ where: 'Syllabus · OTU-1', text: 'From [Galileo] to JWST.' }
		]);
	});

	it('needs every word somewhere in the plan, not in one field', () => {
		expect(texts('galileo jupiter')?.map((h) => h.where)).toContain('Differentiation · EAL/D');
		expect(texts('galileo kepler')).toBeNull();
	});

	it('matches from the start of a word only', () => {
		const fields = [{ where: 'Summary', text: 'The quietest tester; re-test (test).' }];
		expect(texts('test', fields)).toEqual([
			{ where: 'Summary', text: 'The quietest [test]er; re-[test] ([test]).' }
		]);
	});

	it('ignores accents both ways, and marks the original letters', () => {
		expect(texts('naive')).toEqual([
			{ where: 'Resources · Launch video', text: '[Naïve] questions welcome.' }
		]);
	});

	it('finds a phrase only as a phrase', () => {
		expect(texts('"telescope showed"')).toEqual([
			{ where: 'Success criteria', text: 'I can name one thing the [telescope showed].' }
		]);
		expect(texts('"showed telescope"')).toBeNull();
	});

	it('cuts long text at word boundaries around the match', () => {
		const long = 'word '.repeat(60) + 'Galileo' + ' more'.repeat(60);
		const [hit] = matchFields([{ where: 'Summary', text: long }], ['galileo'])!;
		const shown = hit.parts.map((p) => p.text).join('');
		expect(shown.startsWith('…word')).toBe(true);
		expect(shown.endsWith('more…')).toBe(true);
		expect(hit.parts.filter((p) => p.hit)).toEqual([{ text: 'Galileo', hit: true }]);
	});

	it('keeps the match right after runs of white space', () => {
		const [hit] = matchFields(
			[{ where: 'Summary', text: 'One\n\n   two   Galileo' }],
			['galileo']
		)!;
		expect(hit.parts).toEqual([
			{ text: 'One two ', hit: false },
			{ text: 'Galileo', hit: true }
		]);
	});
});

describe('planFields', () => {
	it('reads the content file under its headings, and a class’s deviations last', () => {
		const fields = planFields(plan, '# Opening\n\nGalileo saw four moons.\n\n## Later\nKepler.', [
			'Skipped the video.'
		]);
		expect(fields.slice(-5)).toEqual([
			{ where: 'Content · Opening', text: 'Opening' },
			{ where: 'Content · Opening', text: 'Galileo saw four moons.' },
			{ where: 'Content · Later', text: 'Later' },
			{ where: 'Content · Later', text: 'Kepler.' },
			{ where: 'What this class did differently', text: 'Skipped the video.' }
		]);
	});

	it('places content before any heading as plain Content', () => {
		expect(contentFields('Intro line.\n\n# H\nBody')).toEqual([
			{ where: 'Content', text: 'Intro line.' },
			{ where: 'Content · H', text: 'H' },
			{ where: 'Content · H', text: 'Body' }
		]);
	});
});

describe('dedupe', () => {
	it('keeps one of two identical hits', () => {
		const hit = { where: 'Run sheet · Galileo', parts: [{ text: 'Galileo', hit: true }] };
		expect(dedupe([hit, { ...hit }])).toHaveLength(1);
	});
});

describe('mapLimit', () => {
	it('keeps order and never runs more than the limit at once', async () => {
		let running = 0;
		let most = 0;
		const done: number[] = [];
		const out = await mapLimit(
			[5, 1, 4, 2, 3],
			2,
			async (n) => {
				running++;
				most = Math.max(most, running);
				await new Promise((r) => setTimeout(r, n));
				running--;
				return n * 10;
			},
			(d) => done.push(d)
		);
		expect(out).toEqual([50, 10, 40, 20, 30]);
		expect(most).toBe(2);
		expect(done).toEqual([1, 2, 3, 4, 5]);
	});
});
