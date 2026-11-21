import { describe, expect, it } from 'vitest';
import { Data } from '../data.ts';
import { DEMO_TARGET, demoFetch } from '../demo.ts';
import {
	blankSection,
	blankText,
	blankTopic,
	fromAssessmentDraft,
	moveSection,
	newAssessmentDraft,
	newAssessmentPaths,
	stemProblem,
	teacherDivider,
	titleParts,
	toAssessmentDraft,
	topicRows,
	type AssessmentDraft,
	type TopicRow
} from './assessmentEdit.ts';
import { topicLines, type AssessmentSpec } from './assessments.ts';
import { dump } from './format.ts';
import { EditError } from './lessonEdit.ts';
import { blankCriterion, blankPart, marksProblems, type Part } from './notificationEdit.ts';
import { ConflictError, Repo } from './repo.ts';
import type { Offering } from './types.ts';

// Made up, in the shape real notifications take.
const NOTE = `# 2026 Year 7 Design and Technology

## Assessment Task 1: Torch Redesign

| | |
|---|---|
| **Due** | Friday 12 June, end of lesson |
| **Marks** | 20 (15 in class, 5 at home) |

---

## Task overview

Redesign a torch so a younger student can use it.

---

## Marking criteria

### Part 1: Design brief (5 marks, at home)

DT-4-1 identifies a need

| Marks | Criteria |
|---|---|
| 5 | Writes a clear brief. |
| 4-0 | Writes a brief. |

### Part 2: Ideas and prototype (15 marks, in class)

DT-4-2 generates ideas

**Sketches (5 marks)**

| Marks | Criteria |
|---|---|
| 5 | Sketches three ideas. |

**Prototype (10 marks)**

| Marks | Criteria |
|---|---|
| 10-9 | Builds and tests a prototype. |

# Teacher notes

Nothing below renders.

## Assessable topics

### Product design

- Write a design brief
- Sketch and model three ideas

### Simple circuits

- Build a series circuit

## Blueprint

Part 1 maps to DT-4.1.
`;

const spec = (): AssessmentSpec => ({
	offering: '2026-y7-class-a',
	title: 'Torch Redesign',
	notification: 'offerings/2026_y07_class_a/assessments/torch.md',
	klunk: { profile: 'klunk/profile.yml' },
	units: ['units/product_design', 'units/simple_circuits'],
	topics: [
		{
			text: 'Write a design brief',
			unit: 'units/product_design',
			phase: 'Stage 4',
			ids: ['DT-01']
		},
		{
			text: 'Sketch and model three ideas',
			unit: 'units/product_design',
			phase: 'Stage 4',
			ids: ['DT-02', 'DT-03']
		},
		{
			text: 'Build a series circuit',
			unit: 'units/simple_circuits',
			phase: 'Stage 4',
			ids: [],
			note: 'Practical only.'
		}
	]
});

const load = (s = spec(), note = NOTE) => toAssessmentDraft(s, note);
const named = (d: AssessmentDraft, heading: string) => {
	const found = d.sections.find((x) => x.heading === heading);
	if (!found) throw new Error(`no ${heading}`);
	return found;
};
const parts = (d: AssessmentDraft) => {
	const body = named(d, 'Marking criteria').body;
	if (body.kind !== 'criteria') throw new Error('not criteria');
	return body;
};
const topicsBody = (d: AssessmentDraft) => {
	const body = named(d, 'Assessable topics').body;
	if (body.kind !== 'topics') throw new Error('not topics');
	return body;
};

describe('reading a notification', () => {
	it('gives back both files byte for byte when nothing is touched', () => {
		const { draft, notes } = load();
		expect(notes).toEqual([]);
		const out = fromAssessmentDraft(draft);
		expect(out.notification).toBe(NOTE);
		expect(dump(out.spec)).toBe(dump(spec()));
	});

	it('finds the title, the details, the sections and the teacher notes', () => {
		const { draft } = load();
		expect(draft.sections.map((s) => [s.role, s.half, s.heading, s.body.kind])).toEqual([
			['subject', 'issued', '2026 Year 7 Design and Technology', 'text'],
			['title', 'issued', 'Assessment Task 1: Torch Redesign', 'details'],
			['section', 'issued', 'Task overview', 'text'],
			['section', 'issued', 'Marking criteria', 'criteria'],
			['teacher', 'teacher', 'Teacher notes', 'text'],
			['section', 'teacher', 'Assessable topics', 'topics'],
			['section', 'teacher', 'Blueprint', 'text']
		]);
		const title = named(draft, 'Assessment Task 1: Torch Redesign').body;
		expect(title.kind === 'details' && title.rows.map((r) => [r.label, r.value])).toEqual([
			['Due', 'Friday 12 June, end of lesson'],
			['Marks', '20 (15 in class, 5 at home)']
		]);
		expect(draft.syncTitle).toBe(true);
		expect(titleParts('Assessment Task 1: Torch Redesign')).toEqual({
			prefix: 'Assessment Task 1',
			name: 'Torch Redesign'
		});
	});

	it('reads Marking criteria as parts, criteria and mark ranges', () => {
		const body = parts(load().draft);
		const [one, two] = body.parts as Part[];
		expect([one.label, one.name, one.marks, one.where, one.intro]).toEqual([
			'Part 1',
			'Design brief',
			5,
			'at home',
			'DT-4-1 identifies a need'
		]);
		expect(one.criteria).toEqual([
			expect.objectContaining({
				name: null,
				ranges: [
					{ marks: '5', text: 'Writes a clear brief.' },
					{ marks: '4-0', text: 'Writes a brief.' }
				]
			})
		]);
		expect(two.criteria.map((c) => [c.name, c.marks])).toEqual([
			['Sketches', 5],
			['Prototype', 10]
		]);
		expect(marksProblems(body, 20)).toEqual([]);
	});

	it('keeps a part that does not read back exactly as plain text', () => {
		const odd = NOTE.replace(
			'| 5 | Writes a clear brief. |',
			'| 5 | Writes a clear brief. | extra |'
		);
		const body = parts(load(spec(), odd).draft);
		expect(body.parts[0].kind).toBe('text-part');
		expect(fromAssessmentDraft(load(spec(), odd).draft).notification).toBe(odd);
	});
});

describe('editing the content', () => {
	it('writes a changed detail as one row and leaves the rest', () => {
		const { draft } = load();
		const title = named(draft, 'Assessment Task 1: Torch Redesign').body;
		if (title.kind !== 'details') throw new Error();
		title.rows[0].value = 'Monday 15 June';
		title.rows.push({ label: 'Teacher', value: 'Sample Teacher' });
		expect(fromAssessmentDraft(draft).notification).toBe(
			NOTE.replace(
				'| **Due** | Friday 12 June, end of lesson |\n| **Marks** | 20 (15 in class, 5 at home) |\n',
				'| **Due** | Monday 15 June |\n| **Marks** | 20 (15 in class, 5 at home) |\n| **Teacher** | Sample Teacher |\n'
			)
		);
	});

	it('writes an edited section between the blank lines and rule it had', () => {
		const { draft } = load();
		const s = named(draft, 'Task overview');
		if (s.body.kind !== 'text') throw new Error();
		s.body.text = 'Redesign a torch.\n\nThen test it.';
		s.heading = 'Overview';
		expect(fromAssessmentDraft(draft).notification).toBe(
			NOTE.replace(
				'## Task overview\n\nRedesign a torch so a younger student can use it.\n',
				'## Overview\n\nRedesign a torch.\n\nThen test it.\n'
			)
		);
	});

	it('adds, moves and removes sections', () => {
		const { draft } = load();
		const fresh = blankSection('issued');
		fresh.heading = 'Academic integrity';
		if (fresh.body.kind === 'text') fresh.body.text = 'Your own work.';
		draft.sections.splice(3, 0, fresh);
		const at = moveSection(draft.sections, 3, -1);
		expect(draft.sections[at].heading).toBe('Academic integrity');
		expect(moveSection(draft.sections, at, -1)).toBe(at); // never above the title
		draft.sections.splice(
			draft.sections.findIndex((s) => s.heading === 'Blueprint'),
			1
		);
		const out = fromAssessmentDraft(draft).notification;
		expect(out).toContain('## Academic integrity\n\nYour own work.\n\n---\n\n## Task overview\n');
		expect(out).not.toContain('Blueprint');
		const back = load(spec(), out).draft;
		expect(back.sections.find((s) => s.heading === 'Academic integrity')?.half).toBe('issued');
	});

	it('moves a section into the teacher notes past their heading', () => {
		const { draft } = load();
		const i = draft.sections.findIndex((s) => s.heading === 'Marking criteria');
		const j = moveSection(draft.sections, i, 1);
		expect(draft.sections[j].half).toBe('teacher');
		const back = load(spec(), fromAssessmentDraft(draft).notification).draft;
		expect(back.sections.find((s) => s.heading === 'Marking criteria')?.half).toBe('teacher');
	});

	it('adds teacher notes to a notification without them', () => {
		const plain = NOTE.slice(0, NOTE.indexOf('# Teacher notes')).replace(/\n+$/, '\n');
		const { draft, notes } = load(spec(), plain);
		expect(notes).toHaveLength(1); // the topics section is added
		draft.sections.splice(draft.sections.length - 1, 0, teacherDivider());
		const out = fromAssessmentDraft(draft).notification;
		expect(out).toContain('# Teacher notes\n\nNothing below renders.\n');
		expect(topicLines(out)).toEqual(spec().topics.map((t) => t.text));
	});

	it('writes an edited part in the house form, leaving the others', () => {
		const { draft } = load();
		const one = parts(draft).parts[0] as Part;
		one.marks = 6;
		one.criteria[0].ranges[0] = { marks: '6', text: 'Writes a clear | sharp brief.' };
		const out = fromAssessmentDraft(draft).notification;
		expect(out).toContain('### Part 1: Design brief (6 marks, at home)\n');
		expect(out).toContain('| 6 | Writes a clear \\| sharp brief. |\n');
		expect(out).toContain('### Part 2: Ideas and prototype (15 marks, in class)\n');
		const back = parts(load(spec(), out).draft).parts[0] as Part;
		expect(back.criteria[0].ranges[0].text).toBe('Writes a clear | sharp brief.');
	});

	it('adds a part with criteria that reads back as a part', () => {
		const { draft } = load();
		const body = parts(draft);
		const three = blankPart(3);
		Object.assign(three, { name: 'Circuit', marks: 5, where: 'in class' });
		three.criteria = [
			{ ...blankCriterion('Wiring'), marks: 3, ranges: [{ marks: '3', text: 'Wires it.' }] },
			{ ...blankCriterion('Switch'), marks: 2, ranges: [{ marks: '2', text: 'Adds a switch.' }] }
		];
		body.parts.push(three);
		const out = fromAssessmentDraft(draft).notification;
		const again = parts(load(spec(), out).draft);
		expect(again.parts.map((p) => p.kind)).toEqual(['part', 'part', 'part']);
		expect(marksProblems(again, 20)).toEqual(['The parts add up to 25 marks, but Marks says 20.']);
	});

	it('says what does not add up in the marks', () => {
		const { draft } = load();
		const two = parts(draft).parts[1] as Part;
		two.criteria[1].marks = 9;
		expect(marksProblems(parts(draft), 20)).toEqual([
			'Part 2 (Ideas and prototype) is worth 15 marks, but its criteria add up to 14.',
			"Prototype's top mark range is 10, but it is worth 9."
		]);
	});

	it('refuses an incomplete part and a heading inside a section', () => {
		const at = (edit: (d: AssessmentDraft) => void) => {
			const { draft } = load();
			edit(draft);
			return () => fromAssessmentDraft(draft);
		};
		expect(at((d) => ((parts(d).parts[0] as Part).name = ''))).toThrow(/no name/);
		expect(at((d) => ((parts(d).parts[0] as Part).marks = null))).toThrow(/whole number/);
		expect(
			at((d) => {
				const s = named(d, 'Task overview');
				if (s.body.kind === 'text') s.body.text = 'Intro\n\n## Sneaky';
			})
		).toThrow(/###/);
		expect(at((d) => (named(d, 'Task overview').heading = ' '))).toThrow(EditError);
	});
});

describe('editing the topics', () => {
	it('writes an edited topic into both files', () => {
		const { draft } = load();
		topicRows(draft)[1].text = 'Sketch, model and test three ideas';
		const out = fromAssessmentDraft(draft);
		expect(out.notification).toBe(
			NOTE.replace('- Sketch and model three ideas', '- Sketch, model and test three ideas')
		);
		expect(out.spec.topics[1].text).toBe('Sketch, model and test three ideas');
	});

	it('adds and removes topics as bullet lines', () => {
		const { draft } = load();
		const rows = topicsBody(draft).rows;
		const last = topicRows(draft)[2];
		rows.splice(rows.indexOf(last) + 1, 0, {
			...blankTopic(last),
			text: 'Solder a switch',
			ids: ['DT-08']
		});
		rows.splice(rows.indexOf(topicRows(draft)[0]), 1);
		const out = fromAssessmentDraft(draft);
		expect(topicLines(out.notification)).toEqual([
			'Sketch and model three ideas',
			'Build a series circuit',
			'Solder a switch'
		]);
		expect(out.notification).toContain(
			'- Build a series circuit\n- Solder a switch\n\n## Blueprint'
		);
	});

	it('puts a new heading between topics', () => {
		const { draft } = load();
		const rows = topicsBody(draft).rows;
		rows.splice(rows.indexOf(topicRows(draft)[0]) + 1, 0, { ...blankText(), text: '**Stage 5**' });
		expect(fromAssessmentDraft(draft).notification).toContain(
			'- Write a design brief\n\n**Stage 5**\n\n- Sketch and model three ideas\n'
		);
	});

	it('takes the notification’s wording where the files disagree, and says so', () => {
		const s = spec();
		s.topics[0].text = 'Write a brief';
		const { draft, notes } = load(s);
		expect(topicRows(draft)[0].text).toBe('Write a design brief');
		expect(notes).toEqual([expect.stringMatching(/^Topic 1 reads differently/)]);
	});

	it('refuses a topic outside the units, without a phase, or linking an id twice', () => {
		const at = (edit: (t: TopicRow, d: AssessmentDraft) => void) => {
			const { draft } = load();
			edit(topicRows(draft)[0], draft);
			return () => fromAssessmentDraft(draft);
		};
		expect(at((_, d) => d.units.pop())).toThrow(/not among the units/);
		expect(at((t) => (t.phase = ' '))).toThrow(/no phase/);
		expect(at((t) => (t.ids = ['DT-01', 'DT-01']))).toThrow(/twice/);
		expect(at((t) => (t.text = ' '))).toThrow(/no text/);
	});
});

describe('a new task', () => {
	const offering = {
		id: '2026-y7-class-a',
		year: 2026,
		year_group: 'Year 7',
		subject: 'subjects/design',
		units: [{ unit: 'units/product_design' }]
	} as Offering;

	it('starts with the headings the renderer and the test expect', () => {
		const draft = newAssessmentDraft(offering, 'Design and Technology');
		const paths = newAssessmentPaths('offerings/2026_y07_class_a.json', 'torch');
		const title = draft.sections.find((s) => s.role === 'title');
		if (!title) throw new Error();
		title.heading = 'Assessment: Torch';
		draft.title = 'Torch';
		draft.units = ['units/product_design'];
		Object.assign(topicRows(draft)[0], {
			text: 'Write a design brief',
			unit: 'units/product_design',
			phase: 'Stage 4',
			ids: ['DT-01']
		});
		const out = fromAssessmentDraft(draft, {
			offering: offering.id,
			notification: paths.notification
		});
		expect(out.notification).toMatch(
			/^# 2026 Year 7 Design and Technology\n\n## Assessment: Torch\n\n\| \| \|\n/
		);
		expect(out.notification).toContain(
			'\n## Assessable topics\n\n- Write a design brief\n\n# Teacher notes\n'
		);
		expect(topicLines(out.notification)).toEqual(['Write a design brief']);
		expect(Object.keys(out.spec)).toEqual(['offering', 'title', 'notification', 'units', 'topics']);
	});

	it('needs a title', () => {
		const draft = newAssessmentDraft(offering, 'Design');
		expect(() => fromAssessmentDraft(draft)).toThrow(/no title/);
	});

	it('checks the file name', () => {
		const taken = new Set(['offerings/y7/assessments/final.md']);
		const check = (name: string) => stemProblem(name, (p) => taken.has(p), 'offerings/y7.json');
		expect(check('')).toMatch(/file name/);
		expect(check('Final Exam')).toMatch(/lower-case/);
		expect(check('final')).toMatch(/already/);
		expect(check('task3_final')).toBeNull();
	});
});

describe('saving, against the sample repo', () => {
	const path = 'offerings/2026_y07_class_a/assessments/torch_redesign.json';

	it('commits the spec and its notification together', async () => {
		const store = new Repo({ ...DEMO_TARGET }, 'sample', demoFetch());
		const data = new Data(store);
		const { doc, sha } = await data.assessment('offerings/2026_y07_class_a.json', 'torch_redesign');
		const note = await data.textFile(doc.notification);
		if (!note) throw new Error('the sample has no notification');
		const { draft } = toAssessmentDraft(doc, note.doc);
		expect(fromAssessmentDraft(draft).notification).toBe(note.doc);
		topicRows(draft)[0].text = 'Write a design brief for a torch a child could use';
		const out = fromAssessmentDraft(draft);
		const before = await store.head();
		await data.saveAssessment(path, out.spec, sha, out.notification, note.sha, 'Edit torch');
		expect(await store.head()).not.toBe(before);
		expect((await store.readText(path)).doc).toBe(dump(out.spec));
		expect((await store.readText(doc.notification)).doc).toBe(out.notification);
		await expect(
			data.saveAssessment(path, out.spec, sha, out.notification, note.sha, 'Again')
		).rejects.toBeInstanceOf(ConflictError);
	});
});

describe('the parts table against Marking criteria', () => {
	const withTable = NOTE.replace(
		'Redesign a torch so a younger student can use it.\n',
		'Redesign a torch so a younger student can use it.\n\n| Part | Where | Marks |\n|---|---|---|\n| 1. Design brief | At home | 5 |\n| 2. Ideas and prototype | In class | 15 |\n| **Total** | | **20** |\n'
	);

	it('finds nothing when they agree, and says where they differ', async () => {
		const { overviewProblems } = await import('./assessmentEdit.ts');
		const { draft } = load(spec(), withTable);
		expect(overviewProblems(draft.sections)).toEqual([]);
		(parts(draft).parts[0] as Part).marks = 6;
		expect(overviewProblems(draft.sections)).toEqual([
			'Task overview’s table gives Part 1 5 marks, but Marking criteria gives it 6.',
			'Task overview’s table gives a total of 20 marks, but the parts add up to 21.'
		]);
	});

	it('draws a section’s text as it would be written', async () => {
		const { sectionText } = await import('./assessmentEdit.ts');
		const { draft } = load();
		expect(sectionText(named(draft, 'Task overview'))).toBe(
			'\nRedesign a torch so a younger student can use it.\n\n---\n\n'
		);
	});
});

describe('marks from the parts', () => {
	const withTable = NOTE.replace(
		'Redesign a torch so a younger student can use it.\n',
		'Redesign a torch so a younger student can use it.\n\n| Part | Where | Marks |\n|---|---|---|\n| 1. Design brief | At home | 5 |\n| 2. Ideas and prototype | In class | 15 |\n| **Total** | | **20** |\n'
	);

	it('leaves a notification that already agrees alone', async () => {
		const { syncMarks } = await import('./assessmentEdit.ts');
		const { draft } = load(spec(), withTable);
		expect(syncMarks(draft)).toBe(false);
		expect(fromAssessmentDraft(draft).notification).toBe(withTable);
	});

	it('writes a part’s new marks into the table, its total and the Marks detail', async () => {
		const { syncMarks, overviewProblems } = await import('./assessmentEdit.ts');
		const { draft } = load(spec(), withTable);
		(parts(draft).parts[0] as Part).marks = 6;
		expect(syncMarks(draft)).toBe(true);
		const out = fromAssessmentDraft(draft).notification;
		expect(out).toContain(
			'| 1. Design brief | At home | 6 |\n| 2. Ideas and prototype | In class | 15 |\n| **Total** | | **21** |'
		);
		expect(out).toContain('| **Marks** | 21 (15 in class, 6 at home) |');
		expect(overviewProblems(draft.sections)).toEqual([]);
		expect(syncMarks(draft)).toBe(false);
	});
});

describe('the small print and part names follow the parts', () => {
	const withTable = NOTE.replace(
		'Redesign a torch so a younger student can use it.\n',
		'Redesign a torch so a younger student can use it.\n\n| Part | Where | Marks |\n|---|---|---|\n| 1. Design brief | At home | 5 |\n| 2. Ideas and prototype | In class | 15 |\n| **Total** | | **20** |\n'
	);

	it('works out the in-class and at-home marks, and renames the table’s parts', async () => {
		const { syncMarks } = await import('./assessmentEdit.ts');
		const { draft } = load(spec(), withTable);
		const [one, two] = parts(draft).parts as Part[];
		one.marks = 6;
		two.name = 'Ideas, models and tests';
		expect(syncMarks(draft)).toBe(true);
		const out = fromAssessmentDraft(draft).notification;
		expect(out).toContain('| **Marks** | 21 (15 in class, 6 at home) |');
		expect(out).toContain('| 2. Ideas, models and tests | In class | 15 |');
		expect(syncMarks(draft)).toBe(false);
	});
});

describe('Where follows the parts', () => {
	const withTable = NOTE.replace(
		'Redesign a torch so a younger student can use it.\n',
		'Redesign a torch so a younger student can use it.\n\n| Part | Where | Marks |\n|---|---|---|\n| 1. Design brief | At home | 5 |\n| 2. Ideas and prototype | In class | 15 |\n| **Total** | | **20** |\n\n### Part 1: Design brief (at home)\n\n- a brief\n'
	);

	it('writes a part’s new Where into the table and its sub-heading', async () => {
		const { syncMarks } = await import('./assessmentEdit.ts');
		const { draft } = load(spec(), withTable);
		expect(syncMarks(draft)).toBe(false);
		(parts(draft).parts[0] as Part).where = 'in class';
		expect(syncMarks(draft)).toBe(true);
		const out = fromAssessmentDraft(draft).notification;
		expect(out).toContain('| 1. Design brief | In class | 5 |');
		expect(out).toContain('### Part 1: Design brief (in class)');
		expect(out).toContain('| **Marks** | 20 (20 in class, 0 at home) |');
	});

	it('flags a Weighting split that disagrees with the marks', async () => {
		const { overviewProblems } = await import('./assessmentEdit.ts');
		const note = withTable.replace(
			'| **Due** |',
			'| **Weighting** | 20% (10% in class, 10% at home) |\n| **Due** |'
		);
		const { draft } = load(spec(), note);
		expect(overviewProblems(draft.sections)).toEqual([
			'Weighting says 10% in class and 10% at home, but the marks are 15 in class and 5 at home, which would be 15% and 5%.'
		]);
	});
});

describe('removing a part never mislabels the other sections', () => {
	const withTable = NOTE.replace(
		'Redesign a torch so a younger student can use it.\n',
		'Redesign a torch so a younger student can use it.\n\n| Part | Where | Marks |\n|---|---|---|\n| 1. Design brief | At home | 5 |\n| 2. Ideas and prototype | In class | 15 |\n| **Total** | | **20** |\n\n### Part 1: Design brief (at home)\n\n- a brief\n\n### Part 2: Ideas and prototype (in class)\n\n- sketches\n'
	);

	it('rebuilds the parts table and flags the removed part’s heading, renaming nothing', async () => {
		const { syncMarks, overviewProblems, headingFollows } = await import('./assessmentEdit.ts');
		const { draft } = load(spec(), withTable);
		const body = parts(draft);
		body.parts.splice(0, 1);
		(body.parts[0] as Part).label = 'Part 1'; // renumbered, as the editor does
		syncMarks(draft);
		const out = fromAssessmentDraft(draft).notification;
		expect(out).toContain(
			'| Part | Where | Marks |\n|---|---|---|\n| 1. Ideas and prototype | In class | 15 |\n| **Total** | | **15** |'
		);
		expect(out).toContain('### Part 1: Design brief (at home)');
		expect(out).toContain('### Part 2: Ideas and prototype (in class)');
		expect(headingFollows(draft.sections, 'Part 1: Design brief (at home)')).toBe(false);
		expect(overviewProblems(draft.sections)).toEqual([
			'Task overview has the heading “Part 1: Design brief (at home)”, but Part 1 is now Ideas and prototype. Change the heading, or move what’s under it.',
			'Task overview has the heading “Part 2: Ideas and prototype (in class)”, but there is no Part 2 any more. Change the heading, or remove what’s under it.'
		]);
	});
});
