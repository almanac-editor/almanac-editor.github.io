import { describe, expect, it } from 'vitest';
import { blankMaterial, httpsHost, lessonOutputs, materialsFrom } from './materials.ts';
import type { Lesson } from './types.ts';

describe('httpsHost', () => {
	it('names the host of an https link', () => {
		expect(httpsHost('https://drive.example.com/d/abc?x=1')).toBe('drive.example.com');
	});

	it('refuses anything else', () => {
		expect(httpsHost('http://example.com/deck')).toBeNull();
		expect(httpsHost('javascript:alert(1)')).toBeNull();
		expect(httpsHost('drive.example.com/deck')).toBeNull();
		expect(httpsHost('')).toBeNull();
	});
});

describe('materialsFrom', () => {
	it('keeps links in order, trims, drops blank rows and leaves out an empty label', () => {
		expect(
			materialsFrom([
				{ kind: 'deck', label: ' Slides as shown ', url: ' https://a.example.com/deck ' },
				blankMaterial(),
				{ kind: 'handout', label: '', url: 'https://b.example.com/h' }
			])
		).toEqual([
			{ kind: 'deck', label: 'Slides as shown', url: 'https://a.example.com/deck' },
			{ kind: 'handout', url: 'https://b.example.com/h' }
		]);
	});

	it('refuses a label without a link, and a link that is not https, numbered as shown', () => {
		expect(() =>
			materialsFrom([blankMaterial(), { kind: 'deck', label: 'Deck', url: '' }])
		).toThrow('Link 2 has a label but no link.');
		expect(() => materialsFrom([{ kind: 'file', label: '', url: 'http://example.com/f' }])).toThrow(
			'Link 1 must be a web address starting https://.'
		);
	});
});

describe('lessonOutputs', () => {
	const lesson = {
		materials: {
			content: '01_sorting.md',
			workbook: { 'y7-a': 'dist/workbooks/y7-a/01.html', 'y8-b': 'dist/workbooks/y8-b/01.html' },
			deck: { 'y7-a': 'dist/decks/y7-a/01.pptx' },
			deck_pdf: { 'y7-a': 'dist/decks/y7-a/01.pdf' },
			handout: {},
			files: ['01_socks.csv']
		}
	} as unknown as Lesson;
	const path = 'subjects/x/units/socks/lessons/01_sorting.json';

	it('lists one class’s outputs, and the plan’s sources from the repo root', () => {
		expect(lessonOutputs(lesson, path, 'y7-a')).toEqual({
			outputs: [
				{ kind: 'deck', offering: 'y7-a', path: 'dist/decks/y7-a/01.pptx' },
				{ kind: 'deck_pdf', offering: 'y7-a', path: 'dist/decks/y7-a/01.pdf' },
				{ kind: 'workbook', offering: 'y7-a', path: 'dist/workbooks/y7-a/01.html' }
			],
			sources: [
				'subjects/x/units/socks/lessons/01_sorting.md',
				'subjects/x/units/socks/lessons/01_socks.csv'
			]
		});
	});

	it('lists every class’s outputs without a class', () => {
		expect(lessonOutputs(lesson, path, null).outputs.map((o) => o.offering)).toEqual([
			'y7-a',
			'y7-a',
			'y7-a',
			'y8-b'
		]);
	});

	it('copes with a plan that has no materials', () => {
		expect(lessonOutputs({} as Lesson, path, null)).toEqual({ outputs: [], sources: [] });
	});
});
