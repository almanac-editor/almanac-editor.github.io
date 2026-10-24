import { describe, expect, it } from 'vitest';
import { dump } from './format.ts';
import { EditError } from './lessonEdit.ts';
import type { Unit } from './types.ts';
import {
	blankOutcomeSet,
	blankPoint,
	fromOutcomeDraft,
	fromUnitDraft,
	toOutcomeDraft,
	toUnitDraft,
	type OutcomeSet
} from './unitEdit.ts';

const unit = (): Unit => ({
	unit_title: 'Sorting things',
	subject: 'Sorting',
	description: 'Sort by one attribute.',
	overview: 'Kept as it is.',
	syllabus_registry: [
		{
			id: 'SK-C01',
			framework: 'NESA',
			phase: 'Exploring',
			text: 'Sort objects by one attribute',
			including: ['colour']
		},
		{ id: 'SK-C02', framework: 'NESA', phase: 'Exploring', text: 'Name a sorting rule' }
	],
	lessons: ['lessons/01_socks.json']
});

describe('fromUnitDraft', () => {
	it('gives back the same bytes for an untouched draft', () => {
		const u = unit();
		expect(dump(fromUnitDraft(u, toUnitDraft(u), new Set()))).toBe(dump(u));
	});

	it('rewords and reorders dot points, keeping their ids and extra keys', () => {
		const u = unit();
		const draft = toUnitDraft(u);
		draft.syllabus_registry.reverse();
		draft.syllabus_registry[1].text = 'Sort objects by one property';
		draft.syllabus_registry[1].id = 'CHANGED';
		const next = fromUnitDraft(u, draft, new Set());
		expect(next.syllabus_registry).toEqual([
			u.syllabus_registry![1],
			{ ...u.syllabus_registry![0], text: 'Sort objects by one property' }
		]);
	});

	it('adds a new dot point, trimmed, and drops a wholly blank one', () => {
		const u = unit();
		const draft = toUnitDraft(u);
		draft.syllabus_registry.push({
			...blankPoint(draft.syllabus_registry[1]),
			id: ' SK-C03 ',
			text: 'Explain a sort '
		});
		draft.syllabus_registry.push(blankPoint());
		expect(fromUnitDraft(u, draft, new Set()).syllabus_registry?.at(-1)).toEqual({
			id: 'SK-C03',
			framework: 'NESA',
			phase: 'Exploring',
			text: 'Explain a sort'
		});
		expect(fromUnitDraft(u, draft, new Set()).syllabus_registry).toHaveLength(3);
	});

	it('refuses to remove a dot point a lesson links, but removes an unlinked one', () => {
		const u = unit();
		const draft = toUnitDraft(u);
		draft.syllabus_registry.splice(0, 1);
		expect(() => fromUnitDraft(u, draft, new Set(['SK-C01']))).toThrow(EditError);
		expect(fromUnitDraft(u, draft, new Set(['SK-C02'])).syllabus_registry).toHaveLength(1);
	});

	it('refuses a new dot point with an id already used', () => {
		const u = unit();
		const draft = toUnitDraft(u);
		draft.syllabus_registry.push({ ...blankPoint(), id: 'SK-C02', phase: 'P', text: 'T' });
		expect(() => fromUnitDraft(u, draft, new Set())).toThrow(/SK-C02 is listed twice/);
	});

	it('adds no dot points to a unit that has none', () => {
		const u = unit();
		delete u.syllabus_registry;
		const saved = fromUnitDraft(u, toUnitDraft(u), new Set());
		expect('syllabus_registry' in saved).toBe(false);
		expect(dump(saved)).toBe(dump(u));
	});

	it('adds applicable outcomes at their schema place, and leaves them out when none', () => {
		const u = unit();
		const draft = toUnitDraft(u);
		expect('applicable_outcomes' in fromUnitDraft(u, draft, new Set())).toBe(false);
		draft.applicable_outcomes = ['OUT-2', 'OUT-1'];
		expect(Object.keys(fromUnitDraft(u, draft, new Set()))).toEqual([
			'unit_title',
			'subject',
			'description',
			'overview',
			'applicable_outcomes',
			'syllabus_registry',
			'lessons'
		]);
	});
});

describe('fromOutcomeDraft', () => {
	const set = (): OutcomeSet => ({
		name: 'Sorting',
		framework: 'NESA',
		stage: 'Stage 1',
		outcomes: [
			{ code: 'SO-01', text: 'sorts objects' },
			{ code: 'SO-02', text: 'explains a sort' }
		]
	});

	it('gives back the same bytes for an untouched draft', () => {
		const s = set();
		expect(dump(fromOutcomeDraft(s, toOutcomeDraft(s), new Set()))).toBe(dump(s));
	});

	it('adds an outcome and rewords one, keeping codes', () => {
		const s = set();
		const draft = toOutcomeDraft(s);
		draft.outcomes[0].text = 'sorts objects by a rule';
		draft.outcomes[0].code = 'X';
		draft.outcomes.push({ code: ' SO-03 ', text: 'compares sorts' });
		expect(fromOutcomeDraft(s, draft, new Set()).outcomes).toEqual([
			{ code: 'SO-01', text: 'sorts objects by a rule' },
			{ code: 'SO-02', text: 'explains a sort' },
			{ code: 'SO-03', text: 'compares sorts' }
		]);
	});

	it('refuses to remove an outcome a unit names', () => {
		const s = set();
		const draft = toOutcomeDraft(s);
		draft.outcomes.splice(1, 1);
		expect(() => fromOutcomeDraft(s, draft, new Set(['SO-02']))).toThrow(EditError);
	});

	it('starts a subject with no outcomes', () => {
		expect(dump(blankOutcomeSet('Food Tech', 'NESA'))).toBe(
			'{\n  "name": "Food Tech",\n  "framework": "NESA",\n  "outcomes": []\n}\n'
		);
	});
});
