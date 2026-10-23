import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dump } from './format.ts';
import { contentPath, offeringPaths, outcomePath, unitDirs } from './layout.ts';
import { lessonsForOffering, offeringEntries, OfferingMismatch } from './offerings.ts';
import { join, normalise, stem } from './paths.ts';
import { decodeBase64, encodeBase64 } from './repo.ts';
import type { Offering, Unit } from './types.ts';
import { Schemas, toPath } from './validate.ts';
import { describeProblems, fieldName } from './fieldNames.ts';
import { citationParts, linkHost } from './lessonView.ts';

const fixture = <T>(name: string): T =>
	JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf-8'));

describe('dump', () => {
	it('writes the house format', () => {
		expect(dump({ a: [], b: {}, c: ['≥'], d: 1 })).toBe(
			'{\n  "a": [],\n  "b": {},\n  "c": [\n    "≥"\n  ],\n  "d": 1\n}\n'
		);
	});

	it('refuses a float', () => {
		expect(() => dump({ weeks: 1.5 })).toThrow(/integers only/);
	});
});

describe('paths', () => {
	it('normalises and joins', () => {
		expect(join('subjects/x/', './units/y')).toBe('subjects/x/units/y');
		expect(normalise('a/b/../c')).toBe('a/c');
		expect(() => normalise('../a')).toThrow();
		expect(stem('lessons/2026_y9/01_intro.json')).toBe('01_intro');
	});
});

describe('layout', () => {
	const paths = [
		'subjects/ec/hsc/outcome.json',
		'subjects/ec/hsc/units/data/unit.json',
		'subjects/ct/units/ux/unit.json',
		'offerings/2030_y7_class1.json',
		'offerings/notes/readme.json',
		'README.md'
	];

	it('finds units and offerings', () => {
		expect(unitDirs(paths)).toEqual(['subjects/ct/units/ux', 'subjects/ec/hsc/units/data']);
		expect(offeringPaths(paths)).toEqual(['offerings/2030_y7_class1.json']);
	});

	it('walks up to the outcome set', () => {
		expect(outcomePath('subjects/ec/hsc/units/data', new Set(paths))).toBe(
			'subjects/ec/hsc/outcome.json'
		);
		expect(outcomePath('subjects/ct/units/ux', new Set(paths))).toBeNull();
	});

	it('pairs a plan with its content file', () => {
		expect(contentPath('lessons/01_a.json')).toBe('lessons/01_a.md');
	});
});

describe('lessonsForOffering', () => {
	const unit = fixture<Unit>('unit.json');
	const offering = fixture<Offering>('offering.json');
	const dir = 'subjects/sorting/units/sorting_things';

	it('merges entries in order and drops repeats', () => {
		expect(lessonsForOffering(dir, unit, offering)).toEqual([
			'lessons/03_hats.json',
			'lessons/01_socks.json',
			'lessons/02_shoes.json'
		]);
	});

	it('takes one term', () => {
		expect(lessonsForOffering(dir, unit, offering, 'Term 1')).toEqual([
			'lessons/03_hats.json',
			'lessons/01_socks.json'
		]);
		expect(lessonsForOffering(dir, unit, offering, 'Term 2')).toEqual(unit.lessons);
	});

	it('throws where the Python exits', () => {
		expect(() => lessonsForOffering('subjects/sorting/units/nope', unit, offering)).toThrow(
			OfferingMismatch
		);
		expect(() => lessonsForOffering(dir, unit, offering, 'Term 4')).toThrow(OfferingMismatch);
	});

	it('lists the entries taking a unit', () => {
		const found = offeringEntries(dir, [['offerings/x.json', offering]]);
		expect(found.map((f) => f.term)).toEqual(['Term 1', 'Term 2']);
	});
});

describe('base64', () => {
	it('round-trips UTF-8', () => {
		const text = 'Sections ≥ 5 — café\n';
		expect(decodeBase64(encodeBase64(text))).toBe(text);
	});
});

describe('Schemas', () => {
	const schemas = new Schemas({
		'lesson.schema.json': fixture('lesson.schema.json'),
		'offering.schema.json': fixture('offering.schema.json')
	});

	it('accepts a valid lesson', () => {
		const lesson = {
			title: 'A',
			duration_minutes: 5,
			sections: [{ section: 'x', duration_minutes: 5 }]
		};
		expect(schemas.validate('lesson.schema.json', lesson)).toEqual([]);
	});

	it('reports leaf problems with readable paths', () => {
		const problems = schemas.validate('lesson.schema.json', {
			title: '',
			duration_minutes: 5,
			sections: [{ section: 'x', duration_minutes: '5' }],
			extra: true
		});
		const paths = problems.map((p) => p.path);
		expect(paths).toContain('title');
		expect(paths).toContain('sections[0].duration_minutes');
		expect(paths).toContain('extra');
	});

	it('does not call a field unknown when something inside it is wrong', () => {
		const problems = schemas.validate('lesson.schema.json', {
			title: 'A',
			duration_minutes: 5,
			sections: [{ section: '', duration_minutes: 5 }]
		});
		expect(problems).toEqual([{ path: 'sections[0].section', message: 'is empty' }]);
	});

	it('resolves a reference into another schema', () => {
		const problems = schemas.validate('offering.schema.json', {
			id: 'x',
			differentiation: { support: 1 }
		});
		expect(problems.map((p) => p.path)).toEqual(['differentiation.support']);
	});

	it('says what is wrong in plain words', () => {
		const problems = schemas.validate('lesson.schema.json', {
			title: 'A',
			duration_minutes: 0,
			sections: [{ section: '', duration_minutes: '5' }]
		});
		expect(problems).toEqual(
			expect.arrayContaining([
				{ path: 'duration_minutes', message: 'must be at least 1' },
				{ path: 'sections[0].section', message: 'is empty' },
				{ path: 'sections[0].duration_minutes', message: 'must be a whole number' }
			])
		);
	});

	it('reports a missing field where the field belongs', () => {
		const problems = schemas.validate('lesson.schema.json', { title: 'A', duration_minutes: 5 });
		expect(problems).toEqual([{ path: 'sections', message: 'is missing' }]);
	});

	it('turns pointers into paths', () => {
		expect(toPath('#/sections/2/duration_minutes')).toBe('sections[2].duration_minutes');
		expect(toPath('#')).toBe('');
	});
});

describe('fieldName', () => {
	const lesson = (path: string) => fieldName('lesson.schema.json', path);

	it('names a path as the editor labels it', () => {
		expect(lesson('sections[0].section')).toBe('Section 1, What happens');
		expect(lesson('duration_minutes')).toBe('Lesson length');
		expect(lesson('assessment.evidence[1]')).toBe('Assessment, Evidence 2');
		expect(lesson('differentiation.eald')).toBe('Differentiation, EAL/D');
		expect(lesson('learning_intentions[2]')).toBe('Learning intention 3');
		expect(lesson('references[0].url')).toBe('Reference 1, Link');
		expect(lesson('')).toBe('The plan');
		expect(lesson('extra')).toBe('extra');
	});

	it('names paths in classes and records', () => {
		expect(fieldName('offering.schema.json', 'units[1].lessons[0]')).toBe('Unit 2, Lesson 1');
		expect(fieldName('offering.schema.json', 'differentiation.support')).toBe(
			'Differentiation, Support'
		);
		expect(fieldName('delivery.schema.json', 'deliveries[0].feedback[2].issue')).toBe(
			'Lesson taught 1, Feedback item 3, What happened'
		);
		expect(fieldName('delivery.schema.json', 'deliveries[0].plan.sections[1].section')).toBe(
			'Lesson taught 1, Plan, Section 2, What happens'
		);
	});

	it('writes problems as sentences', () => {
		expect(
			describeProblems('offering.schema.json', [{ path: 'id', message: 'is missing' }])
		).toEqual(['Id is missing.']);
	});
});

describe('citationParts', () => {
	it('marks the starred runs italic', () => {
		expect(citationParts('Smith, J. (2024). *Socks*. Press.')).toEqual([
			{ text: 'Smith, J. (2024). ', italic: false },
			{ text: 'Socks', italic: true },
			{ text: '. Press.', italic: false }
		]);
	});

	it('leaves an unpaired asterisk as it is', () => {
		expect(citationParts('5 * 4 socks')).toEqual([{ text: '5 * 4 socks', italic: false }]);
	});
});

describe('linkHost', () => {
	it('names the site of a web link', () => {
		expect(linkHost('https://www.example.com/a/b?c=1')).toBe('www.example.com');
	});

	it('refuses anything that is not a web address', () => {
		expect(linkHost('javascript:alert(1)')).toBeNull();
		expect(linkHost('example.com/a')).toBeNull();
	});
});
