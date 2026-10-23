/**
 * A made-up data repo held in memory, so anyone can look around the editor
 * before they make a token. It answers the few GitHub API calls `Repo` makes
 * (repo, tree, blob, contents PUT), so the rest of the app cannot tell the
 * difference. Saves change this tab's copy only.
 *
 * Every unit, class and lesson here is invented. None comes from a real data
 * repo, in keeping with the rule for fixtures.
 */

import { decodeBase64, encodeBase64, type RepoTarget } from './domain/repo.ts';
import type { DeliveryRecord } from './domain/deliveries.ts';
import type { Kind, Lesson, Offering, Tier, Unit } from './domain/types.ts';

export const DEMO_TARGET: RepoTarget = { owner: 'sample', repo: 'almanac', branch: 'main' };

type Row = [label: string, section: string, minutes: number, kind?: Kind, tier?: Tier];

function lesson(
	title: string,
	description: string,
	minutes: number,
	rows: Row[],
	more: Partial<Lesson> = {}
): Lesson {
	return {
		title,
		description,
		duration_minutes: minutes,
		summary: more.summary,
		sections: rows.map(([label, section, duration_minutes, kind, tier]) => ({
			...(label ? { label } : {}),
			section,
			duration_minutes,
			...(kind ? { kind } : {}),
			...(tier ? { tier } : {})
		})),
		learning_intentions: more.learning_intentions ?? [],
		success_criteria: more.success_criteria ?? [],
		curriculum_links: more.curriculum_links ?? [],
		...(more.assessment ? { assessment: more.assessment } : {}),
		...(more.differentiation ? { differentiation: more.differentiation } : {}),
		...(more.resources ? { resources: more.resources } : {})
	};
}

const link = (id: string, coverage = 'partial', mode = 'introduced', note?: string) => ({
	framework: 'Sample',
	id,
	coverage,
	mode,
	...(note ? { note } : {})
});

const productDesign: Unit = {
	unit_title: 'Designing everyday products',
	description:
		'Students follow a design brief from need to prototype, redesigning a small object they use every day.',
	syllabus_registry: [
		{
			id: 'DT-4.1',
			framework: 'Sample',
			phase: 'Stage 4',
			text: 'Identify a need and write a design brief'
		},
		{
			id: 'DT-4.2',
			framework: 'Sample',
			phase: 'Stage 4',
			text: 'Generate and sketch a range of ideas'
		},
		{ id: 'DT-4.3', framework: 'Sample', phase: 'Stage 4', text: 'Model and test a solution' },
		{
			id: 'DT-4.4',
			framework: 'Sample',
			phase: 'Stage 4',
			text: 'Evaluate a product against criteria'
		}
	],
	assessments: [
		{
			title: 'Redesign folio',
			assessment_type: 'Design project',
			weight: 30,
			description: 'A brief, three sketched ideas, a tested prototype and an evaluation.',
			class_minutes: 120,
			curriculum_links: [
				link('DT-4.1', 'full', 'consolidated'),
				link('DT-4.4', 'full', 'developed')
			]
		},
		{
			title: 'Prototype pitch',
			assessment_type: 'Presentation',
			weight: 10,
			offerings: ['2026-y10-class-2']
		}
	],
	lessons: [
		'lessons/01_what_makes_good_design.json',
		'lessons/02_writing_a_brief.json',
		'lessons/03_sketching_ideas.json',
		'lessons/04_cardboard_prototypes.json',
		'lessons/05_test_and_evaluate.json'
	]
};

const productLessons: Record<string, Lesson> = {
	'01_what_makes_good_design': lesson(
		'What makes good design?',
		'Students rank everyday objects from best to worst designed and agree on what the good ones share.',
		60,
		[
			[
				'Hook: the worst object',
				'Pass round a badly designed bottle opener. Who can open the bottle first?',
				5,
				'discussion'
			],
			[
				'Design is a choice',
				'Short talk: every object answers a need, and a designer chose each part of the answer.',
				10,
				'instruction'
			],
			[
				'Rank the table',
				'Groups rank six objects from best to worst designed and note why on sticky notes.',
				20,
				'practice'
			],
			[
				'Share the rules',
				'Each group adds one rule to the class list of what good design does.',
				15,
				'discussion'
			],
			[
				'Stretch: fix one',
				'Sketch one change that would move the worst object up the ranking.',
				5,
				'practice',
				'stretch'
			],
			['Exit ticket', 'One sentence: the object I would redesign, and why.', 5, 'review']
		],
		{
			summary: 'Builds the class definition of good design that every later lesson tests against.',
			learning_intentions: [
				'Understand that every product answers a need',
				'Recognise features of good design'
			],
			success_criteria: [
				'I can explain why one object is better designed than another',
				'I can add a rule to the class list of good design'
			],
			curriculum_links: [
				link('DT-4.4', 'partial', 'introduced', 'Evaluation language only, no formal criteria yet.')
			],
			assessment: {
				formative: 'Listen in on the rankings; collect the exit tickets.',
				evidence: ['Exit ticket']
			},
			differentiation: {
				support: 'Give a sentence starter for the sticky notes.',
				extension: 'Ask for a rule that would be true of a digital product too.',
				eald: 'Picture cards for the six objects.'
			},
			resources: [
				{
					name: 'Six objects box',
					notes: 'Bottle opener, peeler, two pens, a stapler and a phone stand.'
				},
				{ name: 'Good design slides', canvas: 'good_design_slides' }
			]
		}
	),
	'02_writing_a_brief': lesson(
		'Writing a design brief',
		'Students turn a need they found at home into a one-paragraph brief with constraints.',
		60,
		[
			['Recap', 'Read back three rules from last lesson’s good design list.', 5, 'review'],
			[
				'Anatomy of a brief',
				'Model a brief for a pencil case: the user, the need, the constraints.',
				12,
				'instruction'
			],
			[
				'Find the need',
				'Pairs interview each other about an annoying object at home.',
				13,
				'practice'
			],
			['Draft the brief', 'Write a first brief using the template.', 20, 'practice'],
			[
				'Swap and check',
				'Partner ticks the three parts of the brief and asks one question.',
				10,
				'discussion'
			]
		],
		{
			learning_intentions: ['Write a design brief that names a user, a need and constraints'],
			success_criteria: ['My brief names who it is for', 'My brief lists at least two constraints'],
			curriculum_links: [link('DT-4.1', 'full', 'introduced')],
			assessment: {
				formative: 'Partner check against the three parts.',
				evidence: ['Draft brief']
			},
			differentiation: { support: 'Brief template with the three headings filled in as questions.' }
		}
	),
	'03_sketching_ideas': lesson(
		'Sketching ideas fast',
		'Crazy eights and annotated sketches: quantity first, then choose two ideas to develop.',
		60,
		[
			[
				'Warm-up: draw a cup',
				'Thirty seconds, then ten seconds, then five. What survives?',
				5,
				'practice'
			],
			[
				'Annotated sketches',
				'Demonstrate labels, arrows and notes on a sketch.',
				10,
				'instruction'
			],
			['Crazy eights', 'Eight ideas in eight minutes for their own brief.', 10, 'practice'],
			['Develop two', 'Pick two ideas and annotate them fully.', 25, 'practice'],
			['Gallery walk', 'Leave one comment on three other desks.', 10, 'discussion']
		],
		{
			learning_intentions: ['Generate many ideas before choosing one'],
			success_criteria: [
				'I can produce eight different ideas',
				'I can annotate a sketch so someone else understands it'
			],
			curriculum_links: [link('DT-4.2', 'full', 'developed')]
		}
	),
	'04_cardboard_prototypes': lesson(
		'Cardboard prototypes',
		'Students model their chosen idea in cardboard to test size and use, not looks.',
		60,
		[
			['Safety', 'Cutting mats, knives and the hot glue station.', 5, 'instruction'],
			['Build', 'Model the chosen idea at full size.', 40, 'practice'],
			[
				'Stretch: second version',
				'Build a variation that changes one dimension.',
				10,
				'practice',
				'stretch'
			],
			['Pack up', 'Label the prototype and clear the benches.', 10]
		],
		{
			learning_intentions: ['Use a quick model to test an idea'],
			success_criteria: ['My prototype is the right size for the user'],
			curriculum_links: [link('DT-4.3', 'partial', 'introduced')]
		}
	),
	'05_test_and_evaluate': lesson(
		'Test and evaluate',
		'Users try each prototype; students record what worked against the brief.',
		60,
		[
			['User testing', 'Swap prototypes; each tester completes the task card.', 20, 'practice'],
			['Results', 'Record the tester’s comments against each constraint.', 15, 'practice'],
			['Evaluation', 'Write a short evaluation: met, partly met, not met.', 20, 'practice'],
			['Reflect', 'What would you change in version two?', 5, 'review']
		],
		{
			learning_intentions: ['Evaluate a product against the brief'],
			success_criteria: ['I can say whether each constraint was met, with evidence'],
			curriculum_links: [link('DT-4.4', 'full', 'developed')]
		}
	)
};

const circuits: Unit = {
	unit_title: 'Simple circuits',
	description: 'From a battery and a bulb to a working torch with a switch.',
	syllabus_registry: [
		{
			id: 'DT-4.7',
			framework: 'Sample',
			phase: 'Stage 4',
			text: 'Build and explain a series circuit'
		},
		{
			id: 'DT-4.8',
			framework: 'Sample',
			phase: 'Stage 4',
			text: 'Use a switch to control a circuit'
		}
	],
	lessons: [
		'lessons/01_battery_and_bulb.json',
		'lessons/02_series_circuits.json',
		'lessons/03_switches.json',
		'lessons/04_build_a_torch.json'
	]
};

const circuitLessons: Record<string, Lesson> = {
	'01_battery_and_bulb': lesson(
		'Battery and bulb',
		'Make a bulb light with one battery and one wire, then explain why.',
		50,
		[
			['Challenge', 'One battery, one wire, one bulb. Light it.', 10, 'practice'],
			['Why it works', 'Draw the loop on the board; name the parts.', 15, 'instruction'],
			['Draw it', 'Students draw their working circuit with labels.', 15, 'practice'],
			['Exit ticket', 'Circle the drawing that will not light.', 5, 'review']
		],
		{
			learning_intentions: ['Understand that a circuit is a complete loop'],
			success_criteria: ['I can light a bulb', 'I can explain why a broken loop does not work'],
			curriculum_links: [link('DT-4.7')]
		}
	),
	'02_series_circuits': lesson(
		'Series circuits',
		'Add bulbs one after another and predict what happens to brightness.',
		50,
		[
			['Predict', 'Two bulbs in a row: brighter, dimmer, the same?', 5, 'discussion'],
			['Test', 'Build one, two and three bulbs in series.', 20, 'practice'],
			['Explain', 'Short talk on sharing the battery’s push.', 10, 'instruction'],
			['Symbols', 'Redraw the circuits with standard symbols.', 15, 'practice']
		],
		{ curriculum_links: [link('DT-4.7', 'full', 'developed')] }
	),
	'03_switches': lesson(
		'Switches',
		'Make a paperclip switch and add it to a circuit.',
		50,
		[
			['Demo', 'A switch is a gap you can close.', 10, 'instruction'],
			['Make a switch', 'Paperclip, two pins and a card base.', 25, 'practice'],
			['Test and draw', 'Add it to the circuit and draw the symbol.', 15, 'practice']
		],
		{ curriculum_links: [link('DT-4.8', 'full', 'introduced')] }
	),
	'04_build_a_torch': lesson(
		'Build a torch',
		'Combine everything into a torch that fits in one hand.',
		50,
		[
			['Plan', 'Sketch the torch layout.', 10, 'practice'],
			['Build', 'Build and test the torch.', 35, 'practice'],
			['Show and tell', 'Three torches, three good ideas.', 10, 'discussion']
		],
		{
			curriculum_links: [
				link('DT-4.7', 'full', 'consolidated'),
				link('DT-4.8', 'full', 'consolidated')
			]
		}
	)
};

const stopMotion: Unit = {
	unit_title: 'Stop-motion storytelling',
	description: 'Plan, shoot and edit a thirty-second stop-motion film in small crews.',
	syllabus_registry: [
		{
			id: 'MA-5.1',
			framework: 'Sample',
			phase: 'Stage 5',
			text: 'Plan a sequence with a storyboard'
		},
		{
			id: 'MA-5.2',
			framework: 'Sample',
			phase: 'Stage 5',
			text: 'Capture and edit frames into a film'
		}
	],
	lessons: [
		'lessons/01_how_animation_works.json',
		'lessons/02_storyboards.json',
		'lessons/03_shoot_day.json'
	]
};

const stopMotionLessons: Record<string, Lesson> = {
	'01_how_animation_works': lesson(
		'How animation works',
		'Flip books and frame rates: why twelve still pictures look like movement.',
		70,
		[
			['Flip book', 'Draw a ten-page flip book of a bouncing ball.', 20, 'practice'],
			['Frame rates', 'Watch the same clip at 6, 12 and 24 frames a second.', 15, 'instruction'],
			['Discuss', 'Which looked smoothest? Which looked more handmade?', 10, 'discussion'],
			['Crew roles', 'Form crews and choose a director, animator and editor.', 15, 'practice']
		],
		{ curriculum_links: [link('MA-5.2', 'partial', 'introduced')] }
	),
	'02_storyboards': lesson(
		'Storyboards',
		'Each crew plans its thirty-second story in twelve panels.',
		70,
		[
			['Model', 'Storyboard a ten-second gag together.', 15, 'instruction'],
			['Storyboard', 'Crews draw twelve panels with shot notes.', 40, 'practice'],
			['Pitch', 'Each crew pitches in thirty seconds.', 15, 'discussion']
		],
		{ curriculum_links: [link('MA-5.1', 'full', 'developed')] }
	),
	'03_shoot_day': lesson(
		'Shoot day',
		'Crews shoot their frames on tablets with a fixed stand.',
		70,
		[
			['Set up', 'Stands, lights and the onion-skin setting.', 10, 'instruction'],
			['Shoot', 'Capture frames, checking every ten.', 50, 'practice'],
			['Back up', 'Export and save to the shared drive.', 10]
		],
		{ curriculum_links: [link('MA-5.2', 'full', 'developed')] }
	)
};

const offerings: Record<string, Offering> = {
	'offerings/2025_y07_class_a.json': {
		id: '2025-y7-class-a',
		year: 2025,
		year_group: 'Year 7',
		class_label: 'Class A',
		subject: 'subjects/design_tech',
		units: [{ unit: 'units/product_design', term: 'Term 2', notes: 'Ran a week long.' }]
	},
	'offerings/2026_y07_class_a.json': {
		id: '2026-y7-class-a',
		year: 2026,
		year_group: 'Year 7',
		class_label: 'Class A',
		subject: 'subjects/design_tech',
		units: [
			{ unit: 'units/product_design', term: 'Term 1' },
			{ unit: 'units/simple_circuits', term: 'Term 2' }
		]
	},
	'offerings/2026_y08_class_b.json': {
		id: '2026-y8-class-b',
		year: 2026,
		year_group: 'Year 8',
		class_label: 'Class B',
		subject: 'subjects/design_tech',
		units: [
			{
				unit: 'units/simple_circuits',
				term: 'Term 1',
				lessons: [
					'lessons/01_battery_and_bulb.json',
					'lessons/03_switches.json',
					'lessons/04_build_a_torch.json'
				]
			},
			{ unit: 'units/product_design', term: 'Term 3' }
		]
	},
	'offerings/2026_y09_elective.json': {
		id: '2026-y9-elective',
		year: 2026,
		year_group: 'Year 9',
		class_label: 'Media elective',
		subject: 'subjects/media_arts',
		units: [{ unit: 'units/stop_motion', term: 'Term 1' }]
	},
	'offerings/2026_y10_class_2.json': {
		id: '2026-y10-class-2',
		year: 2026,
		year_group: 'Year 10',
		class_label: 'Class 2',
		subject: 'subjects/design_tech',
		units: [{ unit: 'units/product_design', term: 'Term 4 2025 and Term 1 2026' }]
	}
};

/**
 * What the classes were taught, by record path. The plans are left out of the
 * snapshots here to keep the sample short; the app writes them in full.
 */
const deliveries: Record<string, DeliveryRecord> = {
	'offerings/2025_y07_class_a/taught/units/product_design/lessons/01_what_makes_good_design.json': {
		offering: '2025-y7-class-a',
		lesson: 'units/product_design/lessons/01_what_makes_good_design.json',
		deliveries: [
			{
				taught: '2025-05-06',
				by: 'Sample Teacher',
				feedback: [
					{
						issue: 'The bottle opener hook took over; nobody wanted to put it down.',
						change: 'Collect the opener before the talk starts.',
						status: 'applied',
						raised: '2025-05-06',
						resolved: '2025-05-20',
						note: 'Added to the hook section.'
					},
					{
						issue: 'Two groups had the same six objects and copied each other.',
						status: 'declined',
						raised: '2025-05-06',
						resolved: '2025-05-20',
						note: 'Only one box of objects; not worth a second.'
					}
				]
			}
		]
	},
	'offerings/2026_y07_class_a/taught/units/product_design/lessons/01_what_makes_good_design.json': {
		offering: '2026-y7-class-a',
		lesson: 'units/product_design/lessons/01_what_makes_good_design.json',
		deliveries: [
			{
				taught: '2026-02-10',
				by: 'Sample Teacher',
				deviations: 'Fire drill in the middle; skipped the stretch task.',
				feedback: [
					{
						issue: 'Ranking ran long; groups argued about the stapler for ten minutes.',
						change: 'Give each group a two-minute timer per object.',
						status: 'open',
						raised: '2026-02-10'
					}
				]
			}
		]
	},
	'offerings/2026_y07_class_a/taught/units/product_design/lessons/02_writing_a_brief.json': {
		offering: '2026-y7-class-a',
		lesson: 'units/product_design/lessons/02_writing_a_brief.json',
		deliveries: [{ taught: '2026-02-12', by: 'Sample Teacher' }]
	},
	'offerings/2026_unattributed/taught/units/product_design/lessons/04_cardboard_prototypes.json': {
		offering: null,
		lesson: 'units/product_design/lessons/04_cardboard_prototypes.json',
		deliveries: [
			{
				source: 'migrated from lesson feedback',
				feedback: [
					{
						issue: 'Pack up took far longer than five minutes.',
						change: 'Start pack up with ten minutes left.',
						status: 'open'
					}
				]
			}
		]
	}
};

const LESSON_SCHEMA = {
	$schema: 'https://json-schema.org/draft/2020-12/schema',
	type: 'object',
	required: ['title', 'duration_minutes', 'sections'],
	properties: {
		title: { type: 'string', minLength: 1 },
		duration_minutes: { type: 'integer', minimum: 1 },
		sections: {
			type: 'array',
			minItems: 1,
			items: {
				type: 'object',
				required: ['section', 'duration_minutes'],
				properties: {
					section: { type: 'string', minLength: 1 },
					duration_minutes: { type: 'integer', minimum: 1 }
				}
			}
		}
	}
};

function files(): Map<string, string> {
	const out = new Map<string, string>();
	const put = (path: string, doc: unknown) => out.set(path, JSON.stringify(doc, null, 2) + '\n');
	const unit = (dir: string, doc: Unit, lessons: Record<string, Lesson>) => {
		put(`${dir}/unit.json`, doc);
		for (const [stem, plan] of Object.entries(lessons)) put(`${dir}/lessons/${stem}.json`, plan);
	};
	unit('subjects/design_tech/units/product_design', productDesign, productLessons);
	unit('subjects/design_tech/units/simple_circuits', circuits, circuitLessons);
	unit('subjects/media_arts/units/stop_motion', stopMotion, stopMotionLessons);
	for (const [path, doc] of Object.entries(offerings)) put(path, doc);
	for (const [path, doc] of Object.entries(deliveries)) put(path, doc);
	put('schemas/lesson.schema.json', LESSON_SCHEMA);
	out.set(
		'subjects/design_tech/units/product_design/lessons/01_what_makes_good_design.md',
		'# What makes good design?\n\n## Hook: the worst object\n\nHand the opener to the quietest table first.\n\n## Plan deviations\n\nNone yet.\n'
	);
	return out;
}

/** A `fetch` that answers `Repo`'s requests from the in-memory sample repo. */
export function demoFetch(): typeof fetch {
	const store = files();
	let next = 0;
	const shaOf = () => `sample${(next += 1)}`;
	const shas = new Map<string, string>([...store.keys()].map((p) => [p, shaOf()]));
	// Commits are hex, as a delivery's plan_commit must be.
	let commits = 0xa1b2c3d;
	const head = () => commits.toString(16);
	const json = (body: unknown, status = 200) =>
		new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

	return async (input, init) => {
		const url = new URL(String(input));
		const path = decodeURIComponent(url.pathname).replace(/^\/repos\/sample\/almanac/, '');
		if (path === '') return json({ full_name: 'sample/almanac' });
		if (path.startsWith('/git/trees/')) {
			return json({
				truncated: false,
				tree: [...shas].map(([p, sha]) => ({ path: p, sha, type: 'blob' }))
			});
		}
		if (path === '/git/ref/heads/main') return json({ object: { sha: head() } });
		if (path.startsWith('/git/blobs/')) {
			const sha = url.pathname.split('/git/blobs/')[1];
			const file = [...shas].find(([, s]) => s === sha)?.[0];
			if (!file) return json({ message: 'Not Found' }, 404);
			return json({ encoding: 'base64', content: encodeBase64(store.get(file) ?? '') });
		}
		if (path.startsWith('/contents/') && init?.method === 'PUT') {
			const file = path.slice('/contents/'.length);
			const body = JSON.parse(String(init.body)) as { content: string; sha: string };
			if (shas.get(file) !== body.sha) return json({ message: 'sha does not match' }, 409);
			store.set(file, decodeBase64(body.content));
			const sha = shaOf();
			shas.set(file, sha);
			commits += 1;
			return json({ content: { sha }, commit: { sha: head() } });
		}
		return json({ message: 'Not Found' }, 404);
	};
}
