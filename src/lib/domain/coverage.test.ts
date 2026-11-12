import { describe, expect, it } from 'vitest';
import {
	byPhase,
	classify,
	coverage,
	flagOf,
	gather,
	lessonSources,
	lineStatus,
	needsLook,
	reachWords,
	reached,
	rowLines,
	shownFlag,
	taughtSources,
	type Reach,
	type TaughtLesson
} from './coverage.ts';
import type { Delivery } from './deliveries.ts';
import type { Task } from './tasks.ts';
import type { CurriculumLink, Lesson, RegistryEntry, SchoolCalendar } from './types.ts';

const entry = (id: string, phase = 'Exploring', extra: Partial<RegistryEntry> = {}) => ({
	id,
	framework: 'NESA',
	phase,
	text: `Dot point ${id}`,
	...extra
});

const link = (id: string, coverage = 'full', mode = 'introduced'): CurriculumLink => ({
	framework: 'NESA',
	id,
	coverage,
	mode
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

const reach = (coverage: string, mode: string): Reach => ({
	link: link('X', coverage, mode),
	ref: 'lessons/01.json',
	title: 'A lesson',
	assessment: false,
	planKept: true
});

const registry = [entry('SK-01'), entry('SK-02'), entry('SK-03', 'Building'), entry('SK-04')];

describe('flagOf', () => {
	const e = entry('X');
	it('flags a point nothing reaches, unless another unit owns it', () => {
		expect(flagOf(e, [])).toBe('UNCOVERED');
		expect(flagOf({ ...e, owned_by: 'units/other' }, [])).toBe('ELSEWHERE');
	});

	it('flags a point reached only in part', () => {
		expect(flagOf(e, [reach('partial', 'developed'), reach('partial', 'consolidated')])).toBe(
			'PARTIAL'
		);
	});

	it('is OK once a full link is developed or consolidated anywhere', () => {
		expect(flagOf(e, [reach('full', 'introduced'), reach('partial', 'consolidated')])).toBe('OK');
	});

	it('tells one encounter apart from a point returned to and never developed', () => {
		expect(flagOf(e, [reach('full', 'introduced')])).toBe('ONCE');
		expect(flagOf(e, [reach('full', 'introduced'), reach('full', 'revisited')])).toBe('SHALLOW');
	});
});

describe('gather and classify', () => {
	const lessons = [
		{ ref: 'lessons/01.json', lesson: plan('Socks', link('SK-01'), link('SK-09')) },
		{ ref: 'lessons/02.json', lesson: null },
		{ ref: 'lessons/03.json', lesson: plan('Hats', link('SK-02', 'partial')) }
	];
	const tasks: Task[] = [
		{ title: 'Sort a drawer', curriculum_links: [link('SK-03', 'full', 'developed')] }
	];

	it('collects links by registry id, marks tasks, and lists dangling links', () => {
		const g = gather(registry, lessonSources(lessons), tasks);
		expect([...g.links.keys()]).toEqual(['SK-01', 'SK-02', 'SK-03', 'SK-04']);
		expect(g.links.get('SK-01')?.map((r) => r.title)).toEqual(['Socks']);
		expect(g.links.get('SK-03')?.[0]).toMatchObject({
			title: 'Sort a drawer (assessment)',
			assessment: true,
			ref: null
		});
		expect(g.dangling).toEqual(['lessons/01.json -> SK-09']);
	});

	it('puts each id under its flag in registry order', () => {
		expect(classify(registry, gather(registry, lessonSources(lessons), tasks))).toEqual({
			UNCOVERED: ['SK-04'],
			PARTIAL: ['SK-02'],
			ONCE: ['SK-01'],
			SHALLOW: [],
			ELSEWHERE: [],
			OK: ['SK-03']
		});
	});

	it('goes by the ref where a plan has no title', () => {
		const untitled = { ...plan('x', link('SK-01')), title: undefined } as unknown as Lesson;
		expect(lessonSources([{ ref: 'lessons/04.json', lesson: untitled }])[0].title).toBe(
			'lessons/04.json'
		);
	});
});

describe('taughtSources', () => {
	const record = (...deliveries: Delivery[]) => ({
		offering: '2026-y7-a',
		lesson: 'units/sorting/lessons/01.json',
		deliveries
	});
	const taught = (
		ref: string,
		current: Lesson | null,
		...deliveries: Delivery[]
	): TaughtLesson => ({
		ref,
		current,
		record: record(...deliveries)
	});

	it('uses the plan the class was last taught from, not the plan as it stands', () => {
		const [source] = taughtSources([
			taught(
				'lessons/01.json',
				plan('Socks, rewritten', link('SK-02')),
				{ taught: '2026-02-10', plan: plan('Socks', link('SK-01', 'partial')) },
				{ taught: '2026-02-17', plan: plan('Socks again', link('SK-01')) }
			)
		]);
		expect(source).toMatchObject({ title: 'Socks again', links: [link('SK-01')], planKept: true });
	});

	it('falls back to the plan as it stands, and says so, where no plan was kept', () => {
		const [source] = taughtSources([
			taught('lessons/01.json', plan('Socks', link('SK-01')), { taught: '2026-02-10' })
		]);
		expect(source).toMatchObject({ links: [link('SK-01')], planKept: false });
	});

	it('leaves out a record with no deliveries', () => {
		expect(taughtSources([taught('lessons/01.json', plan('Socks'))])).toEqual([]);
	});

	it('keeps one term’s deliveries, and any it cannot place', () => {
		const calendars: SchoolCalendar[] = [
			{
				year: 2026,
				periods: [],
				terms: [
					{ name: 'Term 1', start: '2026-01-28', end: '2026-04-02' },
					{ name: 'Term 2', start: '2026-04-21', end: '2026-07-03' }
				]
			}
		];
		const sources = taughtSources(
			[
				taught('lessons/01.json', null, { taught: '2026-02-10', plan: plan('Term 1 run') }),
				taught('lessons/02.json', null, { taught: '2026-05-05', plan: plan('Term 2 run') }),
				taught('lessons/03.json', null, { plan: plan('Undated') }),
				taught('lessons/04.json', null, { taught: '2026-04-10', plan: plan('Holidays') })
			],
			'Term 2',
			calendars
		);
		expect(sources.map((s) => s.title)).toEqual(['Term 2 run', 'Undated', 'Holidays']);
	});
});

describe('coverage', () => {
	const planned = gather(
		registry,
		lessonSources([
			{ ref: 'lessons/01.json', lesson: plan('Socks', link('SK-01')) },
			{ ref: 'lessons/02.json', lesson: plan('Shoes', link('SK-02', 'full', 'developed')) }
		]),
		[{ title: 'Sort a drawer', curriculum_links: [link('SK-03')] }]
	);

	it('marks a planned point no taught lesson reaches yet', () => {
		const taught = gather(
			registry,
			[{ ref: 'lessons/01.json', title: 'Socks', links: [link('SK-01')], planKept: true }],
			[{ title: 'Sort a drawer', curriculum_links: [link('SK-03')] }]
		);
		const { rows } = coverage(registry, planned, taught);
		expect(rows.map((r) => [r.entry.id, r.plannedFlag, r.taughtFlag, r.toCome])).toEqual([
			['SK-01', 'ONCE', 'ONCE', false],
			['SK-02', 'OK', 'UNCOVERED', true],
			// Assessed by a task, never taught by a lesson: tasks stand apart.
			['SK-03', 'UNCOVERED', 'UNCOVERED', false],
			['SK-04', 'UNCOVERED', 'UNCOVERED', false]
		]);
	});

	it('has nothing to come where the lesson was taught from a plan without the link', () => {
		const taught = gather(
			registry,
			[
				{ ref: 'lessons/01.json', title: 'Socks', links: [link('SK-01')] },
				{ ref: 'lessons/02.json', title: 'Shoes, as first written', links: [] }
			],
			[]
		);
		const row = coverage(registry, planned, taught).rows.find((r) => r.entry.id === 'SK-02');
		expect(row).toMatchObject({ taughtFlag: 'UNCOVERED', toCome: false });
	});

	it('keeps tasks apart from the lessons that teach a point', () => {
		const row = coverage(registry, planned, null).rows.find((r) => r.entry.id === 'SK-03');
		expect(row?.planned).toEqual([]);
		expect(row?.tasks.map((r) => r.title)).toEqual(['Sort a drawer (assessment)']);
		expect(row && reached(row)).toBe(false);
	});

	it('picks out rows worth a second look, and not those still to come', () => {
		const taught = gather(
			registry,
			[{ ref: 'lessons/01.json', title: 'Socks', links: [link('SK-01')], planKept: true }],
			[]
		);
		const { rows } = coverage(registry, planned, taught);
		expect(rows.filter(needsLook).map((r) => r.entry.id)).toEqual(['SK-01', 'SK-03', 'SK-04']);
		expect(rows.map(shownFlag)).toEqual(['ONCE', 'UNCOVERED', 'UNCOVERED', 'UNCOVERED']);
	});

	it('has no taught side without a class', () => {
		const { rows } = coverage(registry, planned, null);
		expect(rows.every((r) => r.taught === null && r.taughtFlag === null && !r.toCome)).toBe(true);
	});

	it('lists a dangling link once, planned or taught', () => {
		const p = gather(registry, [{ ref: 'a', title: 'A', links: [link('ZZ')] }], []);
		const t = gather(
			registry,
			[
				{ ref: 'a', title: 'A', links: [link('ZZ')] },
				{ ref: 'b', title: 'B', links: [link('YY')] }
			],
			[]
		);
		expect(coverage(registry, p, t).dangling).toEqual(['a -> ZZ', 'b -> YY']);
	});

	it('groups rows by phase in first-appearance order', () => {
		const { rows } = coverage(registry, planned, null);
		expect(byPhase(rows).map((g) => [g.phase, g.rows.map((r) => r.entry.id)])).toEqual([
			['Exploring', ['SK-01', 'SK-02', 'SK-04']],
			['Building', ['SK-03']]
		]);
	});
});

describe('rowLines and lineStatus', () => {
	const planned = gather(
		registry,
		[
			{ ref: 'lessons/01.json', title: 'Socks', links: [link('SK-01')] },
			{ ref: 'lessons/02.json', title: 'Shoes', links: [link('SK-01', 'full', 'developed')] },
			{ ref: 'lessons/03.json', title: 'Hats', links: [link('SK-01', 'partial')] }
		],
		[{ title: 'Sort a drawer', curriculum_links: [link('SK-01')] }]
	);
	const taught = gather(
		registry,
		[
			{ ref: 'lessons/01.json', title: 'Socks', links: [link('SK-01')], planKept: false },
			{ ref: 'lessons/02.json', title: 'Shoes, as first written', links: [] },
			{ ref: 'lessons/swap.json', title: 'Gloves', links: [link('SK-01', 'partial')] }
		],
		[{ title: 'Sort a drawer', curriculum_links: [link('SK-01')] }]
	);
	const [row] = coverage(registry, planned, taught).rows;

	it('shows each lesson as taught, in the planned order, then lessons taught in place of the list', () => {
		const lines = rowLines(row, taught.refs);
		expect(lines.map((l) => [l.reach.title, lineStatus(l, true)])).toEqual([
			['Socks', 'Taught, links from today’s plan'],
			['Shoes', 'Taught without this link'],
			['Hats', 'Not yet taught'],
			['Gloves', 'Taught, not in the list'],
			['Sort a drawer (assessment)', 'Assessment']
		]);
	});

	it('says nothing about teaching without a class', () => {
		const [solo] = coverage(registry, planned, null).rows;
		expect(rowLines(solo, new Set()).map((l) => lineStatus(l, false))).toEqual([
			'',
			'',
			'',
			'Assessment'
		]);
	});
});

describe('reachWords', () => {
	it('says how a link reaches its point', () => {
		expect(reachWords(link('SK-01', 'full', 'developed'))).toBe('In full, developed');
		expect(reachWords(link('SK-01', 'partial'))).toBe('In part, introduced');
	});
});
