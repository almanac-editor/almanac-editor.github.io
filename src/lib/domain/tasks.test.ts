import { describe, expect, it } from 'vitest';
import { dump } from './format.ts';
import { EditError } from './lessonEdit.ts';
import {
	blankTask,
	cohortTerms,
	fromTaskDrafts,
	taskClasses,
	taskLink,
	tasksForOffering,
	toTaskDrafts
} from './tasks.ts';
import type { Unit } from './types.ts';

const unit = (): Unit => ({
	unit_title: 'Sorting things',
	syllabus_registry: [{ id: 'S-1', framework: 'NESA', phase: 'Sorting', text: 'Sorts socks.' }],
	assessments: [
		{
			title: 'Sock audit',
			assessment_type: 'Project',
			weight: 30,
			description: 'Audit a drawer.',
			overview: '',
			marker: 'kept as it is'
		},
		{ title: 'Hat quiz', weight: 0, offerings: ['2030-y7-class1'], term: 'Term 2' }
	],
	lessons: ['lessons/01_socks.json']
});

describe('tasksForOffering', () => {
	it('gives every task with no class', () => {
		expect(tasksForOffering(unit(), null).map((t) => t.title)).toEqual(['Sock audit', 'Hat quiz']);
	});

	it('gives a class the tasks for every class, and its own', () => {
		expect(tasksForOffering(unit(), '2030-y7-class2').map((t) => t.title)).toEqual(['Sock audit']);
		expect(tasksForOffering(unit(), '2030-y7-class1').map((t) => t.title)).toEqual([
			'Sock audit',
			'Hat quiz'
		]);
	});

	it('gives a cohort only its own term’s tasks', () => {
		expect(tasksForOffering(unit(), '2030-y7-class1', 'Term 1').map((t) => t.title)).toEqual([
			'Sock audit'
		]);
	});
});

describe('fromTaskDrafts', () => {
	it('saves untouched tasks as the same bytes, empty fields and unknown keys included', () => {
		const u = unit();
		expect(dump(fromTaskDrafts(u, toTaskDrafts(u)))).toBe(dump(u));
	});

	it('leaves a unit with no tasks without the key', () => {
		const u: Unit = { unit_title: 'X', lessons: [] };
		expect(Object.keys(fromTaskDrafts(u, [blankTask()]))).toEqual(['unit_title', 'lessons']);
	});

	it('adds a unit’s first task before its lessons, trimmed, with only the fields given', () => {
		const u: Unit = { unit_title: 'X', syllabus_registry: [], lessons: [] };
		const next = fromTaskDrafts(u, [{ ...blankTask(), title: ' Quiz ', weight: 10 }]);
		expect(Object.keys(next)).toEqual([
			'unit_title',
			'syllabus_registry',
			'assessments',
			'lessons'
		]);
		expect(next.assessments).toEqual([{ title: 'Quiz', weight: 10 }]);
	});

	it('removes cleared fields and places new ones in schema order', () => {
		const drafts = toTaskDrafts(unit());
		drafts[1].offerings = [];
		drafts[1].term = '';
		drafts[1].class_minutes = 120;
		drafts[1].assessment_type = 'Quiz';
		drafts[1].curriculum_links.push(taskLink({ id: 'S-1', framework: 'NESA' }));
		const [, task] = fromTaskDrafts(unit(), drafts).assessments as Record<string, unknown>[];
		expect(Object.keys(task)).toEqual([
			'title',
			'assessment_type',
			'weight',
			'class_minutes',
			'curriculum_links'
		]);
		expect(task.curriculum_links).toEqual([
			{ framework: 'NESA', id: 'S-1', coverage: 'full', mode: 'developed' }
		]);
	});

	it('reorders and removes tasks', () => {
		const drafts = toTaskDrafts(unit()).reverse();
		const next = fromTaskDrafts(unit(), drafts);
		expect((next.assessments as { title: string }[]).map((t) => t.title)).toEqual([
			'Hat quiz',
			'Sock audit'
		]);
		expect(fromTaskDrafts(unit(), []).assessments).toBeUndefined();
	});

	it('refuses an untitled task, a part weight, and a dot point linked twice', () => {
		const untitled = [{ ...blankTask(), weight: 5 }];
		expect(() => fromTaskDrafts(unit(), untitled)).toThrow('Task 1 has no title.');
		const part = toTaskDrafts(unit());
		part[0].weight = 12.5;
		expect(() => fromTaskDrafts(unit(), part)).toThrow(EditError);
		const twice = toTaskDrafts(unit());
		const link = taskLink({ id: 'S-1', framework: 'NESA' });
		twice[0].curriculum_links.push(link, { ...link });
		expect(() => fromTaskDrafts(unit(), twice)).toThrow('Sock audit links dot point S-1 twice.');
	});
});

describe('cohortTerms', () => {
	const offering = (id: string) => ({ id });
	const classes = taskClasses(
		[
			{ offering: offering('c1'), term: 'Term 1' },
			{ offering: offering('c1'), term: 'Term 2' },
			{ offering: offering('c2'), term: 'Term 3' }
		],
		(o) => o.id.toUpperCase()
	);

	it('gathers each class once, with the terms it took the unit in', () => {
		expect([...classes]).toEqual([
			['c1', { label: 'C1', terms: ['Term 1', 'Term 2'] }],
			['c2', { label: 'C2', terms: ['Term 3'] }]
		]);
	});

	it('offers the terms of split classes ticked, or of every class, and keeps the task’s own', () => {
		expect(cohortTerms({ offerings: [], term: '' }, classes)).toEqual(['Term 1', 'Term 2']);
		expect(cohortTerms({ offerings: ['c2'], term: '' }, classes)).toEqual([]);
		expect(cohortTerms({ offerings: ['c2'], term: 'Term 4' }, classes)).toEqual(['Term 4']);
	});
});
