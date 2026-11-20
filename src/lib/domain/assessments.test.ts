import { describe, expect, it } from 'vitest';
import {
	assessmentNames,
	assessmentPath,
	groupTopics,
	specProblems,
	topicLines,
	type AssessmentSpec,
	type Registries
} from './assessments.ts';
import type { Offering, RegistryEntry } from './types.ts';

const offering: Offering = {
	id: '2030-y8-blue',
	year: 2030,
	subject: 'subjects/sample',
	units: [{ unit: 'units/bridges' }, { unit: 'units/kites' }]
};

const entry = (id: string, phase = 'Stage 4'): RegistryEntry => ({
	id,
	framework: 'Sample',
	phase,
	text: `Text of ${id}`
});

const registries: Registries = new Map([
	['units/bridges', [entry('BR-1'), entry('BR-2', 'Testing')]],
	['units/kites', [entry('KT-1')]]
]);

function spec(over: Partial<AssessmentSpec> = {}): AssessmentSpec {
	return {
		offering: '2030-y8-blue',
		title: 'Model test',
		notification: 'offerings/2030_y8_blue/assessments/model_test.md',
		units: ['units/bridges', 'units/kites'],
		topics: [
			{ text: 'Build a truss', unit: 'units/bridges', phase: 'Stage 4', ids: ['BR-1'] },
			{ text: 'Load it', unit: 'units/bridges', phase: 'Testing', ids: ['BR-2'] },
			{ text: 'Fly a kite', unit: 'units/kites', phase: 'Stage 4', ids: ['KT-1'] }
		],
		...over
	};
}

const notification = (lines: string[]) =>
	[
		'# 2030 Year 8 Sample',
		'',
		'## Assessment: Model test',
		'',
		'- not a topic',
		'',
		'## Assessable topics',
		'',
		'Intro text.',
		...lines.map((l) => `- ${l}`),
		'  - nested, not a topic',
		'',
		'## Marking criteria',
		'',
		'- not a topic either',
		''
	].join('\n');

const good = notification(['Build a truss', 'Load it', 'Fly a kite']);

describe('assessmentNames', () => {
	it('lists the json files directly in the class’s assessments folder', () => {
		const paths = [
			'offerings/2030_y8_blue.json',
			'offerings/2030_y8_blue/assessments/model_test.json',
			'offerings/2030_y8_blue/assessments/model_test.md',
			'offerings/2030_y8_blue/assessments/a_first.json',
			'offerings/2030_y8_blue/assessments/old/archived.json',
			'offerings/2030_y8_blue/taught/units/bridges/lessons/x.json',
			'offerings/2030_y8_blue_two/assessments/other.json'
		];
		expect(assessmentNames('offerings/2030_y8_blue.json', paths)).toEqual([
			'a_first',
			'model_test'
		]);
		expect(assessmentPath('offerings/2030_y8_blue.json', 'model_test')).toBe(
			'offerings/2030_y8_blue/assessments/model_test.json'
		);
	});
});

describe('topicLines', () => {
	it('reads the bullets under Assessable topics, up to the next heading', () => {
		expect(topicLines(good)).toEqual(['Build a truss', 'Load it', 'Fly a kite']);
	});

	it('runs to the end when no heading follows', () => {
		expect(topicLines('## Assessable topics\n- one  \n- two')).toEqual(['one', 'two']);
	});

	it('is null without the heading', () => {
		expect(topicLines('# Task\n\n- one\n')).toBeNull();
	});
});

describe('specProblems', () => {
	it('finds nothing wrong with a spec that matches', () => {
		expect(specProblems(spec(), offering, registries, good)).toEqual([]);
	});

	it('flags a spec that names another class', () => {
		const problems = specProblems(spec({ offering: '2030-y8-red' }), offering, registries, good);
		expect(problems).toEqual([
			'The spec names class 2030-y8-red, but it sits beside 2030-y8-blue.'
		]);
	});

	it('flags ids not in the unit’s registry, and a unit with no file', () => {
		const s = spec();
		s.topics[0].ids = ['BR-1', 'BR-9', 'BR-0'];
		const missing: Registries = new Map([...registries, ['units/kites', null]]);
		expect(specProblems(s, offering, missing, good)).toEqual([
			'units/kites is in the spec’s units, but subjects/sample/units/kites has no unit.json.',
			'“Build a truss” links BR-0, BR-9, not in units/bridges’s syllabus dot points.'
		]);
	});

	it('flags a topic in a unit the spec does not examine', () => {
		const s = spec({ units: ['units/bridges'] });
		expect(specProblems(s, offering, registries, good)).toEqual([
			'“Fly a kite” is in units/kites, which is not in the spec’s units.'
		]);
	});

	it('allows a topic with no ids when a note says why', () => {
		const s = spec();
		s.topics[2].ids = [];
		expect(specProblems(s, offering, registries, good)).toEqual([
			'“Fly a kite” has no dot point ids and no note saying why.'
		]);
		s.topics[2].note = 'Covered by the practical.';
		expect(specProblems(s, offering, registries, good)).toEqual([]);
	});

	it('flags topic lines that differ from the notification', () => {
		const changed = notification(['Build a truss', 'Load it until it breaks', 'Fly a kite']);
		expect(specProblems(spec(), offering, registries, changed)).toEqual([
			'Topic 2 differs from the notification: the spec has “Load it”, the notification “Load it until it breaks”.'
		]);
		const longer = notification(['Build a truss', 'Load it', 'Fly a kite', 'Write it up']);
		expect(specProblems(spec(), offering, registries, longer)).toEqual([
			'The notification lists 4 assessable topics and the spec 3. The first one only the notification has is “Write it up”.'
		]);
		const shorter = notification(['Build a truss', 'Load it']);
		expect(specProblems(spec(), offering, registries, shorter)).toEqual([
			'The notification lists 2 assessable topics and the spec 3. The first one only the spec has is “Fly a kite”.'
		]);
	});

	it('flags a notification that is missing or has no topics heading', () => {
		expect(specProblems(spec(), offering, registries, null)).toEqual([
			'The notification offerings/2030_y8_blue/assessments/model_test.md is not in the repo.'
		]);
		expect(specProblems(spec(), offering, registries, '# Task\n')).toEqual([
			'The notification has no “Assessable topics” heading.'
		]);
	});
});

describe('groupTopics', () => {
	it('groups by unit, then phase, in the order each first appears', () => {
		const s = spec();
		s.topics.push({ text: 'Another truss', unit: 'units/bridges', phase: 'Stage 4', ids: [] });
		expect(
			groupTopics(s).map((g) => [g.unit, g.phases.map((p) => [p.phase, p.topics.length])])
		).toEqual([
			[
				'units/bridges',
				[
					['Stage 4', 2],
					['Testing', 1]
				]
			],
			['units/kites', [['Stage 4', 1]]]
		]);
	});
});
