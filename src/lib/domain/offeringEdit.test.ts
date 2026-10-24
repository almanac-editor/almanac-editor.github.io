import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { byNumber, houseMap, termParts } from '../house.ts';
import { dump } from './format.ts';
import { oneOffDirs } from './layout.ts';
import { EditError } from './lessonEdit.ts';
import { fromClassDraft, newEntry, newOneOff, toClassDraft, withColour } from './offeringEdit.ts';
import type { Offering } from './types.ts';

const offering = (): Offering =>
	JSON.parse(readFileSync(new URL('./fixtures/offering.json', import.meta.url), 'utf-8'));

describe('withColour', () => {
	it('puts a new colour at its schema place', () => {
		const next = withColour(offering(), 'ruby');
		expect(next.colour).toBe('ruby');
		expect(Object.keys(next)).toEqual(['id', 'year', 'colour', 'subject', 'units']);
	});

	it('changes a colour in place', () => {
		const once = withColour({ ...offering(), year_group: 'Year 7' }, 'ruby');
		const twice = withColour(once, 'plum');
		expect(Object.keys(twice)).toEqual(Object.keys(once));
		expect(twice.colour).toBe('plum');
	});

	it('gives back the same bytes when the colour is cleared again', () => {
		const original = offering();
		expect(dump(withColour(withColour(original, 'cobalt'), null))).toBe(dump(original));
	});
});

/** A class with every field the editor touches, some held empty, in an unusual key order. */
const full = (): Offering => ({
	id: '2030-y8-class2',
	year: 2030,
	subject: 'subjects/sorting',
	mode: 'standard',
	cohort: { notes: 'Two lessons a week.', size: 24 },
	units: [
		{
			unit: 'units/sorting_things',
			lessons: ['lessons/02_shoes.json'],
			term: 'Term 1',
			duration_weeks: 3,
			start_date: '2030-02-03',
			notes: ''
		},
		{ unit: 'units/other_unit', term: 'Term 2', end_date: '2030-06-20' }
	],
	one_offs: [{ term: 'Term 1', path: 'one_offs/first_day' }],
	canvas: { course_id: '123' }
});

describe('class editing', () => {
	it('gives back the same bytes for an untouched draft', () => {
		for (const original of [offering(), full()]) {
			expect(dump(fromClassDraft(original, toClassDraft(original)))).toBe(dump(original));
		}
	});

	it('removes cleared fields, but keeps one the file already held empty', () => {
		const draft = toClassDraft(full());
		draft.units[0].duration_weeks = null;
		draft.units[0].start_date = '';
		draft.units[1].term = '';
		draft.cohort = { size: null, notes: '' };
		draft.mode = '';
		const next = fromClassDraft(full(), draft);
		expect(next.units[0]).toEqual({
			unit: 'units/sorting_things',
			lessons: ['lessons/02_shoes.json'],
			term: 'Term 1',
			notes: ''
		});
		expect(next.units[1]).toEqual({ unit: 'units/other_unit', end_date: '2030-06-20' });
		expect('cohort' in next).toBe(false);
		expect('mode' in next).toBe(false);
	});

	it('sets the class folder after canvas, and removes it when cleared', () => {
		const original = { ...offering(), canvas: { course_id: '1' }, differentiation: {} };
		const draft = toClassDraft(original);
		draft.folder = ' https://school.example.com/sites/y7a ';
		const saved = fromClassDraft(original, draft);
		expect(saved.folder).toBe('https://school.example.com/sites/y7a');
		expect(Object.keys(saved).slice(-3)).toEqual(['canvas', 'folder', 'differentiation']);
		const cleared = toClassDraft(saved);
		cleared.folder = '';
		expect(dump(fromClassDraft(saved, cleared))).toBe(dump(original));
	});

	it('refuses a class folder that is not an https link', () => {
		const draft = toClassDraft(offering());
		draft.folder = 'C:\\Users\\Teacher\\OneDrive\\Year 7';
		expect(() => fromClassDraft(offering(), draft)).toThrow(EditError);
	});

	it('puts new keys at their schema place', () => {
		const draft = toClassDraft(offering());
		draft.mode = 'intensive';
		draft.cohort.size = 20;
		draft.units[1].duration_weeks = 4;
		draft.units[1].notes = 'Short\r\nterm.';
		draft.one_offs.push(newOneOff('one_offs/first_day', 'Term 1'));
		const next = fromClassDraft(offering(), draft);
		expect(Object.keys(next)).toEqual([
			'id',
			'year',
			'mode',
			'subject',
			'cohort',
			'units',
			'one_offs'
		]);
		expect(next.units[1]).toEqual({
			unit: 'units/sorting_things',
			term: 'Term 2',
			duration_weeks: 4,
			notes: 'Short\nterm.'
		});
		expect(next.cohort).toEqual({ size: 20 });
	});

	it('moves, adds and removes units, each keeping its own key order', () => {
		const draft = toClassDraft(full());
		draft.units.reverse();
		draft.units.push(newEntry('units/third', 'Term 3'));
		const next = fromClassDraft(full(), draft);
		expect(next.units.map((e) => e.unit)).toEqual([
			'units/other_unit',
			'units/sorting_things',
			'units/third'
		]);
		expect(Object.keys(next.units[1])).toEqual(Object.keys(full().units[0]));
		expect(next.units[2]).toEqual({ unit: 'units/third', term: 'Term 3' });

		draft.units.splice(0, 2);
		expect(fromClassDraft(full(), draft).units).toEqual([{ unit: 'units/third', term: 'Term 3' }]);
	});

	it('sets, reorders and drops a unit’s own lesson list', () => {
		const draft = toClassDraft(offering());
		expect(draft.units[1].lessons).toBeNull();
		draft.units[1].lessons = ['lessons/02_shoes.json', 'lessons/01_socks.json'];
		draft.units[0].lessons = null;
		const next = fromClassDraft(offering(), draft);
		expect(next.units[0]).toEqual({ unit: 'units/sorting_things', term: 'Term 1' });
		expect(next.units[1].lessons).toEqual(['lessons/02_shoes.json', 'lessons/01_socks.json']);
	});

	it('keeps an emptied lesson list for the schema to refuse', () => {
		const draft = toClassDraft(offering());
		draft.units[0].lessons = [];
		expect(fromClassDraft(offering(), draft).units[0].lessons).toEqual([]);
	});

	it('leaves canvas, colour and the name alone', () => {
		const original: Offering = { ...full(), colour: 'ruby', year_group: 'Year 8' };
		const draft = toClassDraft(original);
		draft.units.pop();
		const next = fromClassDraft(original, draft);
		expect(next.canvas).toEqual(original.canvas);
		expect(next.colour).toBe('ruby');
		expect(next.year_group).toBe('Year 8');
	});
});

describe('oneOffDirs', () => {
	it('lists the directories under a subject’s one_offs', () => {
		const paths = [
			'subjects/sorting/one_offs/first_day/README.md',
			'subjects/sorting/one_offs/first_day/notes.md',
			'subjects/sorting/one_offs/a_quiz/quiz.ipynb',
			'subjects/sorting/one_offs/loose.md',
			'subjects/other/one_offs/x/README.md'
		];
		expect(oneOffDirs(paths, 'subjects/sorting')).toEqual([
			'one_offs/a_quiz',
			'one_offs/first_day'
		]);
	});
});

describe('houseMap', () => {
	const o = (colour?: string) => ({ ...(colour ? { colour } : {}) });

	it('shares colours out by sorted path', () => {
		const map = houseMap([
			['offerings/b.json', o()],
			['offerings/a.json', o()]
		]);
		expect(map.get('offerings/a.json')).toBe('cobalt');
		expect(map.get('offerings/b.json')).toBe('emerald');
	});

	it('keeps a fixed colour and never gives it to another class', () => {
		const map = houseMap([
			['offerings/a.json', o()],
			['offerings/b.json', o('cobalt')]
		]);
		expect(map.get('offerings/b.json')).toBe('cobalt');
		expect(map.get('offerings/a.json')).toBe('emerald');
	});

	it('leaves other classes on their own colour when one is fixed', () => {
		const map = houseMap([
			['offerings/a.json', o()],
			['offerings/b.json', o()],
			['offerings/c.json', o('plum')],
			['offerings/d.json', o()]
		]);
		expect([...map.values()]).toEqual(['plum', 'cobalt', 'emerald', 'saffron']);
	});

	it('gives seven classes seven different colours', () => {
		const seven = Array.from(
			{ length: 7 },
			(_, i) => [`offerings/${i}.json`, o()] as [string, object]
		);
		expect(new Set(houseMap(seven).values()).size).toBe(7);
	});

	it('shares colours out within each year', () => {
		const map = houseMap([
			['offerings/2026_a.json', { year: 2026 }],
			['offerings/2026_b.json', { year: 2026 }],
			['offerings/2027_a.json', { year: 2027 }]
		]);
		expect(map.get('offerings/2027_a.json')).toBe('cobalt');
		expect(map.get('offerings/2026_b.json')).toBe('emerald');
	});

	it('ignores a colour it does not know', () => {
		expect(houseMap([['offerings/a.json', o('teal')]]).get('offerings/a.json')).toBe('cobalt');
	});
});

describe('termParts', () => {
	it('shortens one term, two terms, and terms with years', () => {
		expect(termParts('Term 2')).toEqual(['T2']);
		expect(termParts('Term 1 and Term 3')).toEqual(['T1', 'T3']);
		expect(termParts('Term 4 2025 and Term 1 2026')).toEqual(['T4 2025', 'T1 2026']);
		expect(termParts('Standard week')).toEqual(['Standard week']);
		expect(termParts(undefined)).toEqual([]);
	});
});

describe('byNumber', () => {
	it('puts Year 8 before Year 10', () => {
		const paths = ['offerings/2026_y10_class1.json', 'offerings/2026_y8_tutor.json'];
		expect(paths.sort(byNumber)[0]).toBe('offerings/2026_y8_tutor.json');
	});
});
