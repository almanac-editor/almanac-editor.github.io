import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dump } from './format.ts';
import {
	EditError,
	blankReference,
	blankSection,
	fromDraft,
	linkTo,
	move,
	ordered,
	sectionTotal,
	toDraft
} from './lessonEdit.ts';
import { blankLesson } from './newLesson.ts';
import type { Lesson } from './types.ts';

const text = readFileSync(new URL('./fixtures/lesson.json', import.meta.url), 'utf-8');
const lesson = (): Lesson => JSON.parse(text);

function save(edit: (d: ReturnType<typeof toDraft>) => void): Lesson {
	const original = lesson();
	const draft = toDraft(original);
	edit(draft);
	return fromDraft(original, draft);
}

describe('fromDraft', () => {
	it('gives back the same bytes for an untouched draft', () => {
		expect(dump(save(() => {}))).toBe(text);
	});

	it('changes only the field edited', () => {
		const saved = save((d) => (d.summary = 'Sorting by colour, then size.'));
		expect(saved.summary).toBe('Sorting by colour, then size.');
		expect(Object.keys(saved)).toEqual(Object.keys(lesson()));
	});

	it('removes an optional field cleared to empty', () => {
		const saved = save((d) => (d.summary = ''));
		expect('summary' in saved).toBe(false);
	});

	it('keeps an optional field the file already held empty', () => {
		const saved = save(() => {});
		expect(saved.assessment?.evidence).toEqual([]);
	});

	it('places a new optional key by schema order', () => {
		const original = lesson();
		delete original.summary;
		const draft = toDraft(original);
		draft.summary = 'New summary.';
		const keys = Object.keys(fromDraft(original, draft));
		expect(keys.slice(0, 4)).toEqual(['title', 'description', 'summary', 'duration_minutes']);
	});

	it('carries lesson feedback from an older file through untouched', () => {
		// Feedback now lives on delivery records; a plan that still has it keeps it.
		const older = { ...lesson(), feedback: [{ issue: 'Too few socks.' }] };
		const saved = fromDraft(older, toDraft(older));
		expect(dump(saved)).toBe(dump(older));
	});

	it('keeps each section key order through a move', () => {
		const saved = save((d) => move(d.sections, 1, -1));
		expect(saved.sections[0].section).toMatch(/class pile/);
		expect(Object.keys(saved.sections[0])).toEqual(['section', 'duration_minutes', 'kind', 'tier']);
		expect(Object.keys(saved.sections[1])).toEqual([
			'label',
			'section',
			'duration_minutes',
			'kind'
		]);
	});

	it('writes a new section with only the keys it has', () => {
		const saved = save((d) => {
			d.sections.push({ ...blankSection(), section: 'Pack away.', duration_minutes: 2 });
		});
		expect(saved.sections.at(-1)).toEqual({ section: 'Pack away.', duration_minutes: 2 });
	});

	it('drops blank list entries', () => {
		const saved = save((d) => d.success_criteria.push('   '));
		expect(saved.success_criteria).toEqual(lesson().success_criteria);
	});

	it('normalises Windows line endings', () => {
		const saved = save((d) => (d.description = 'One.\r\nTwo.'));
		expect(saved.description).toBe('One.\nTwo.');
	});

	it('edits a curriculum note and keeps the link otherwise', () => {
		const saved = save((d) => (d.curriculum_links[1].note = 'Whole point.'));
		expect(saved.curriculum_links[1]).toEqual({
			framework: 'NESA',
			id: 'SK-C02',
			coverage: 'full',
			mode: 'introduced',
			note: 'Whole point.'
		});
	});

	it('refuses a changed curriculum id', () => {
		const original = lesson();
		const draft = toDraft(original);
		draft.curriculum_links[0].id = 'SK-C99';
		expect(() => fromDraft(original, draft)).toThrow(EditError);
	});

	it('keeps a resource canvas target and its key position', () => {
		const saved = save((d) => (d.resources[1].notes = 'Two pages.'));
		expect(Object.keys(saved.resources![1])).toEqual(['name', 'notes', 'canvas']);
		expect(saved.resources![1].canvas).toBe('cheat_sheet');
	});

	it('adds a differentiation key in schema order', () => {
		const saved = save((d) => (d.differentiation.extension = 'Sort shoes too.'));
		expect(Object.keys(saved.differentiation!)).toEqual(['support', 'extension', 'eald']);
	});

	it('edits a reference and keeps its key order', () => {
		const saved = save((d) => (d.references[0].used_for = 'Section 1: the odd-sock rate.'));
		expect(saved.references![0]).toEqual({
			citation: 'Hosiery Council. (2025). *Odd socks: A national count*.',
			url: 'https://example.com/odd-socks',
			used_for: 'Section 1: the odd-sock rate.'
		});
	});

	it('switches a reference from a link to a file, never holding both', () => {
		const saved = save((d) => {
			d.references[0].source = 'path';
			d.references[0].where = 'data/odd_socks.csv';
		});
		expect(Object.keys(saved.references![0])).toEqual(['citation', 'path', 'used_for']);
		expect(saved.references![0].path).toBe('data/odd_socks.csv');
	});

	it('adds, moves and removes references, dropping blank ones', () => {
		const saved = save((d) => {
			d.references.push({
				...blankReference(),
				citation: 'Sock drawer survey.',
				where: 'https://example.com/drawers',
				used_for: 'Section 3.'
			});
			d.references.push(blankReference());
			move(d.references, 2, -2);
			d.references.splice(2, 1);
		});
		expect(saved.references!.map((r) => r.citation)).toEqual([
			'Sock drawer survey.',
			'Hosiery Council. (2025). *Odd socks: A national count*.'
		]);
		expect(Object.keys(saved.references![0])).toEqual(['citation', 'url', 'used_for']);
	});

	it('refuses a reference with neither a link nor a file, numbered as the editor shows it', () => {
		expect(() =>
			save((d) => {
				d.references.push(blankReference());
				d.references.push({ ...blankReference(), citation: 'A', used_for: 'B' });
			})
		).toThrow('Reference 4 needs a link or a file.');
	});

	it('removes references when every one is removed', () => {
		expect('references' in save((d) => (d.references = []))).toBe(false);
	});

	it('places references after resources in a plan that had none', () => {
		const original = lesson();
		delete original.references;
		const draft = toDraft(original);
		draft.references.push({ ...blankReference(), citation: 'A', where: 'B', used_for: 'C' });
		const keys = Object.keys(fromDraft(original, draft));
		expect(keys.slice(keys.indexOf('resources'))).toEqual(['resources', 'references', 'materials']);
	});

	it('never touches materials', () => {
		expect(save((d) => (d.title = 'Socks')).materials).toEqual(lesson().materials);
	});
});

describe('helpers', () => {
	it('totals section minutes', () => {
		expect(sectionTotal(toDraft(lesson()))).toBe(30);
	});

	it('ignores out-of-range moves', () => {
		const list = [1, 2, 3];
		move(list, 0, -1);
		move(list, 2, 1);
		expect(list).toEqual([1, 2, 3]);
	});

	it('orders unknown keys last', () => {
		expect(Object.keys(ordered({ z: 1, b: 2, a: 3 }, undefined, ['a', 'b']))).toEqual([
			'a',
			'b',
			'z'
		]);
	});
});

describe('fromDraft for a plan with no file yet', () => {
	it('takes the links chosen in the editor, in link order, notes only when written', () => {
		const original = blankLesson('New', 60);
		const draft = toDraft(original);
		draft.curriculum_links.push(linkTo({ id: 'SK-C02', framework: 'NESA' }));
		draft.curriculum_links.push({
			...linkTo({ id: 'SK-C01', framework: 'NESA' }),
			mode: 'revisited',
			note: 'Warm-up.'
		});
		expect(fromDraft(original, draft, true).curriculum_links).toEqual([
			{ framework: 'NESA', id: 'SK-C02', coverage: 'full', mode: 'introduced' },
			{ framework: 'NESA', id: 'SK-C01', coverage: 'full', mode: 'revisited', note: 'Warm-up.' }
		]);
	});

	it('still refuses new links on a saved plan', () => {
		const original = blankLesson('Saved', 60);
		const draft = toDraft(original);
		draft.curriculum_links.push(linkTo({ id: 'SK-C01', framework: 'NESA' }));
		expect(() => fromDraft(original, draft)).toThrow(EditError);
	});
});
