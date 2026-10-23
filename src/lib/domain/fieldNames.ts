/**
 * Validation paths (`sections[0].section`) named as the pages label them
 * ("Section 1, What happens"), so a schema's complaint can be read by a
 * teacher. One tree per schema the app saves against.
 */

import { DIFFERENTIATION_LABELS } from './lessonView.ts';
import type { Problem } from './validate.ts';

interface Field {
	/** The field's name: "Run sheet". */
	name: string;
	/** For a list, the name of one entry, numbered from 1: "Section". */
	item?: string;
	/** The fields inside it, or inside each entry of a list. */
	fields?: Record<string, Field>;
}

const text = (name: string): Field => ({ name });
const list = (name: string, item: string, fields?: Record<string, Field>): Field => ({
	name,
	item,
	fields
});

const differentiation: Field = {
	name: 'Differentiation',
	fields: Object.fromEntries(
		Object.entries(DIFFERENTIATION_LABELS).map(([key, name]) => [key, text(name)])
	)
};

const lessonFields: Record<string, Field> = {
	title: text('Title'),
	description: text('Description'),
	summary: text('Summary'),
	duration_minutes: text('Lesson length'),
	sections: list('Run sheet', 'Section', {
		section: text('What happens'),
		label: text('Label'),
		duration_minutes: text('Minutes'),
		kind: text('Kind'),
		tier: text('Tier')
	}),
	learning_intentions: list('Learning intentions', 'Learning intention'),
	success_criteria: list('Success criteria', 'Success criterion'),
	curriculum_links: list('Syllabus', 'Syllabus link', { note: text('Note') }),
	assessment: {
		name: 'Assessment',
		fields: { formative: text('Formative'), evidence: list('Evidence', 'Evidence') }
	},
	differentiation,
	resources: list('Resources', 'Resource', { name: text('Name'), notes: text('Notes') }),
	materials: text('Materials')
};

const SCHEMAS: Record<string, Field> = {
	'lesson.schema.json': { name: 'The plan', fields: lessonFields },
	'unit.schema.json': {
		name: 'The unit',
		fields: {
			unit_title: text('Unit title'),
			subject: text('Subject'),
			description: text('Unit description'),
			syllabus_registry: list('Syllabus dot points', 'Dot point', {
				id: text('Id'),
				framework: text('Framework'),
				phase: text('Phase'),
				text: text('Text')
			}),
			applicable_outcomes: list('Outcomes', 'Outcome'),
			assessments: list('Assessment tasks', 'Task', {
				title: text('Title'),
				assessment_type: text('Type'),
				weight: text('Weight'),
				description: text('Description'),
				overview: text('Overview'),
				offerings: list('Classes', 'Class'),
				term: text('Term'),
				class_minutes: text('Class time'),
				curriculum_links: list('Syllabus', 'Syllabus link', {
					coverage: text('Coverage'),
					mode: text('Mode'),
					note: text('Note')
				})
			}),
			lessons: list('The unit’s lesson list', 'Lesson')
		}
	},
	'offering.schema.json': {
		name: 'The class',
		fields: {
			id: text('Id'),
			year: text('Year'),
			year_group: text('Year group'),
			class_label: text('Class'),
			colour: text('Colour'),
			mode: text('Mode'),
			subject: text('Subject'),
			cohort: {
				name: 'Cohort',
				fields: { size: text('Class size'), notes: text('About the class') }
			},
			units: list('Units', 'Unit', {
				unit: text('Unit'),
				term: text('Term'),
				start_date: text('Start date'),
				end_date: text('End date'),
				duration_weeks: text('Weeks'),
				notes: text('Notes'),
				lessons: list('Lessons', 'Lesson')
			}),
			one_offs: list('One-off lessons', 'One-off lesson', {
				path: text('Lesson'),
				term: text('Term'),
				notes: text('Notes')
			}),
			differentiation
		}
	},
	'outcome.schema.json': {
		name: 'The outcomes',
		fields: {
			name: text('Course name'),
			framework: text('Framework'),
			stage: text('Stage'),
			outcomes: list('Outcomes', 'Outcome', { code: text('Code'), text: text('Outcome') })
		}
	},
	'delivery.schema.json': {
		name: 'The record',
		fields: {
			offering: text('Class'),
			lesson: text('Lesson'),
			deliveries: list('Lessons taught', 'Lesson taught', {
				taught: text('Date'),
				by: text('Taught by'),
				deviations: text('What changed on the day'),
				plan: { name: 'Plan', fields: lessonFields },
				feedback: list('Feedback', 'Feedback item', {
					issue: text('What happened'),
					change: text('Change next time'),
					status: text('Status'),
					note: text('Note')
				})
			})
		}
	}
};

/**
 * `path` in the file `schema` checks, named as the pages label it. A path
 * with no label is returned as it is.
 */
export function fieldName(schema: string, path: string): string {
	const root = SCHEMAS[schema];
	if (!root) return path;
	if (!path) return root.name;
	const names: string[] = [];
	let fields = root.fields;
	let current: Field | undefined;
	for (const [, key, index] of path.matchAll(/([^.[\]]+)|\[(\d+)\]/g)) {
		if (key !== undefined) {
			current = fields?.[key];
			if (!current) return path;
			names.push(current.name);
			fields = current.fields;
		} else {
			if (!current?.item) return path;
			names[names.length - 1] = `${current.item} ${Number(index) + 1}`;
			current = undefined;
		}
	}
	return names.join(', ');
}

/** The problems as sentences: "Section 1, What happens is empty." */
export function describeProblems(schema: string, problems: Problem[]): string[] {
	return problems.map((p) => `${fieldName(schema, p.path)} ${p.message}.`);
}
