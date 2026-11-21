import { describe, expect, it } from 'vitest';
import {
	agreedLessons,
	coverage,
	gather,
	lessonSources,
	rowLines,
	splitLinked,
	strandAgreed,
	strandSources,
	strandTasks
} from './coverage.ts';
import type { CurriculumLink, Lesson, Unit } from './types.ts';

// Science's Working scientifically strand: one registry that every focus area
// links into with `links_into`, and that no lesson teaches on its own.

const entry = (id: string) => ({ id, framework: 'NESA', phase: 'P', text: `Dot point ${id}` });
const link = (id: string, coverage = 'full'): CurriculumLink => ({
	framework: 'NESA',
	id,
	coverage,
	mode: 'introduced'
});
const plan = (title: string, ...links: CurriculumLink[]): Lesson => ({
	title,
	description: '',
	duration_minutes: 30,
	sections: [],
	learning_intentions: [],
	success_criteria: [],
	curriculum_links: links
});

const strand = [entry('ST-1'), entry('ST-2'), entry('ST-3')];
const strandIds = new Set(strand.map((e) => e.id));

describe('a focus area linking into a strand', () => {
	const own = [entry('TOP-1')];
	const unit: Unit = { unit_title: 'Topic', planned: [{ title: 'Two', ids: ['ST-2'] }] };
	const registry = [...own, ...strand];
	const sources = lessonSources([
		{ ref: 'lessons/one.json', lesson: plan('One', link('TOP-1'), link('ST-1', 'partial')) }
	]);
	const report = coverage(
		registry,
		gather(registry, sources, []),
		null,
		agreedLessons(unit, registry)
	);
	const split = splitLinked(report.rows, [{ title: 'Strand', ids: strandIds }]);

	it('resolves the strand’s ids rather than calling them dangling', () => {
		expect(report.dangling).toEqual([]);
	});

	it('keeps its own rows apart from the strand’s', () => {
		expect(split.own.map((r) => r.entry.id)).toEqual(['TOP-1']);
	});

	it('shows only the strand points a lesson or planned lesson reaches', () => {
		const [section] = split.linked;
		expect(section.rows.map((r) => [r.entry.id, r.plannedFlag])).toEqual([
			['ST-1', 'PARTIAL'],
			['ST-2', 'PLANNED']
		]);
		expect(section.total).toBe(3);
	});
});

describe('a strand read from the units linking into it', () => {
	const topic: Unit = { unit_title: 'Topic', planned: [{ title: 'Two', ids: ['ST-2', 'TOP-2'] }] };
	const other: Unit = { unit_title: 'Other' };
	const units = [
		{
			dir: 'subjects/s/units/topic',
			unit: topic,
			lessons: [{ ref: 'lessons/one.json', lesson: plan('One', link('TOP-1'), link('ST-1')) }]
		},
		{
			dir: 'subjects/s/units/other',
			unit: other,
			lessons: [{ ref: 'lessons/one.json', lesson: plan('One', link('ST-1', 'partial')) }]
		}
	];
	const sources = strandSources(units, strandIds);
	const tasks = strandTasks(
		[{ unit: topic, tasks: [{ title: 'Test', curriculum_links: [link('ST-3'), link('TOP-1')] }] }],
		strandIds
	);
	const report = coverage(
		strand,
		gather(strand, sources, tasks),
		null,
		strandAgreed([topic, other], strand)
	);
	const row = (id: string) => report.rows.find((r) => r.entry.id === id)!;

	it('keeps only the strand’s ids, so the other units’ ids never dangle', () => {
		expect(report.dangling).toEqual([]);
	});

	it('titles each lesson and task with its unit, and remembers where it lives', () => {
		expect(row('ST-1').planned.map((r) => [r.title, r.unit])).toEqual([
			['Topic: One', 'subjects/s/units/topic'],
			['Other: One', 'subjects/s/units/other']
		]);
		expect(row('ST-3').tasks.map((r) => r.title)).toEqual(['Topic: Test (assessment)']);
	});

	it('lists both lessons, though they share a file name', () => {
		expect(rowLines(row('ST-1'), new Set())).toHaveLength(2);
	});

	it('counts the linking units’ planned lessons, and flags what nothing reaches', () => {
		expect(row('ST-2').agreed).toEqual(['Topic: Two']);
		expect(row('ST-2').plannedFlag).toBe('PLANNED');
		expect(row('ST-3').plannedFlag).toBe('UNCOVERED');
	});
});
