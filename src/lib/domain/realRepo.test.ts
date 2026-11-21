/**
 * Checks against a local clone of a real data repo. Skipped unless DATA_REPO
 * names one, so no private data is ever needed in, or committed to, this repo:
 *
 *     DATA_REPO=../subject-almanac npm test
 */

import { execFileSync } from 'node:child_process';
import {
	existsSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join as joinFs, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { blankTopic, fromAssessmentDraft, syncMarks, toAssessmentDraft } from './assessmentEdit.ts';
import { partText } from './notificationEdit.ts';
import { joinBlocks, readBlocks } from './textBlocks.ts';
import { fromCalendarDraft, toCalendarDraft } from './calendarEdit.ts';
import { agreedLessons, classify, gather, lessonSources } from './coverage.ts';
import {
	deliveryPath,
	feedbackEntries,
	keepOutcome,
	lessonRef,
	offeringLessons,
	plansAtRisk,
	plansToKeep,
	recordPaths,
	type DeliveryRecord
} from './deliveries.ts';
import {
	specProblems,
	topicLines,
	unitDir,
	type AssessmentSpec,
	type Registries
} from './assessments.ts';
import { dump } from './format.ts';
import { unitDirs } from './layout.ts';
import { fromDraft, toDraft } from './lessonEdit.ts';
import { fromClassDraft, toClassDraft, withColour } from './offeringEdit.ts';
import { blankLesson, lessonFile, lessonFolders, withLesson } from './newLesson.ts';
import { copyOffering } from './newOffering.ts';
import { STARTER_SCHEMAS } from './starter.ts';
import {
	fromOutcomeDraft,
	fromUnitDraft,
	toOutcomeDraft,
	toUnitDraft,
	type OutcomeSet
} from './unitEdit.ts';
import { lessonsForOffering } from './offerings.ts';
import { join as joinPath } from './paths.ts';
import { fromTaskDrafts, tasksForOffering, toTaskDrafts } from './tasks.ts';
import type { Lesson, Offering, SchoolCalendar, Unit } from './types.ts';
import { Schemas } from './validate.ts';

const root = process.env.DATA_REPO;

function walk(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const full = joinFs(dir, name);
		return statSync(full).isDirectory() ? walk(full) : [full];
	});
}

describe.skipIf(!root)('real data repo', () => {
	// skipIf skips the tests, but vitest still runs this body to collect them.
	if (!root) return;
	const repo = root;
	const files = walk(joinFs(repo, 'subjects'))
		.concat(walk(joinFs(repo, 'offerings')))
		.filter((f) => f.endsWith('.json'))
		.map((f) => relative(repo, f).replaceAll('\\', '/'));
	const read = (rel: string) => readFileSync(joinFs(repo, rel), 'utf-8');
	const units = files.filter((f) => f.endsWith('/unit.json'));
	const lessons = files.filter((f) => /^subjects\/.*\/lessons\/.*\.json$/.test(f));
	const records = files.filter((f) => /^offerings\/[^/]+\/taught\//.test(f));
	const offerings = files.filter((f) => /^offerings\/[^/]+\.json$/.test(f));
	const calendars = existsSync(joinFs(repo, 'calendar'))
		? readdirSync(joinFs(repo, 'calendar'))
				.filter((f) => /^\d{4}\.json$/.test(f))
				.map((f) => `calendar/${f}`)
		: [];
	const schemas = new Schemas(
		Object.fromEntries(
			readdirSync(joinFs(repo, 'schemas'))
				.filter((f) => f.endsWith('.schema.json'))
				.map((f) => [f, JSON.parse(read(`schemas/${f}`))])
		)
	);

	it('round-trips every file the editor can write through dump', () => {
		// The editor writes units, lessons, offerings and delivery records; other
		// JSON under subjects/ (question banks, taxonomies) belongs to other tools.
		// outcome.json is skipped: one lacks its final newline, which an edit in
		// the app adds. Its untouched-draft test compares with the house format.
		const writable = [...units, ...lessons, ...offerings, ...records];
		const changed = writable.filter((f) => dump(JSON.parse(read(f))) !== read(f));
		expect(changed).toEqual([]);
	});

	it('saves every untouched lesson draft as the same bytes', () => {
		const changed = lessons.filter((f) => {
			const lesson: Lesson = JSON.parse(read(f));
			return dump(fromDraft(lesson, toDraft(lesson))) !== read(f);
		});
		expect(changed).toEqual([]);
	});

	it('adds a new plan to every unit by changing only its lessons list', () => {
		const wrong = units.flatMap((f) => {
			const dir = f.slice(0, -'/unit.json'.length);
			const unit: Unit = JSON.parse(read(f));
			return lessonFolders(unit).flatMap((folder) => {
				const ref = lessonFile(folder, 'new_plan');
				const before = read(f).split('\n');
				const after = dump(withLesson(unit, ref)).split('\n');
				const added = after.filter((line) => !before.includes(line));
				// An empty `"lessons": []` opens onto its own lines, so the first plan adds two.
				const empty = !unit.lessons?.length;
				const ok =
					after.length === before.length + (empty ? 2 : 1) &&
					added.every(
						(line) =>
							line.includes('"lessons/') || (empty && /^\s*("lessons": \[|\],?)$/.test(line))
					) &&
					!files.includes(`${dir}/${ref}`) &&
					schemas.validate('unit.schema.json', withLesson(unit, ref)).length === 0;
				return ok ? [] : [`${f} ${ref}`];
			});
		});
		expect(wrong).toEqual([]);
	});

	it('accepts a filled-in new plan against the repo schema', () => {
		const plan = {
			...blankLesson('A new plan', 60),
			description: 'What it is.',
			sections: [{ section: 'What happens.', duration_minutes: 60 }],
			learning_intentions: ['Know a thing.'],
			success_criteria: ['I can do a thing.']
		};
		expect(schemas.validate('lesson.schema.json', plan)).toEqual([]);
	});

	it('finds every unit, lesson, class and outcome set valid against the starter schemas', () => {
		// The starter schemas must never be stricter than a real repo's own.
		const starter = new Schemas(STARTER_SCHEMAS);
		const invalid = [
			...lessons.map((f) => [f, 'lesson.schema.json'] as const),
			...units.map((f) => [f, 'unit.schema.json'] as const),
			...offerings.map((f) => [f, 'offering.schema.json'] as const),
			...files
				.filter((f) => f.endsWith('/outcome.json'))
				.map((f) => [f, 'outcome.schema.json'] as const),
			...calendars.map((f) => [f, 'calendar.schema.json'] as const)
		]
			.map(([f, name]) => [f, starter.validate(name, JSON.parse(read(f)))] as const)
			.filter(([, problems]) => problems.length > 0);
		expect(invalid).toEqual([]);
	});

	it('saves every untouched school calendar as the same bytes, valid', () => {
		const bad = calendars.flatMap((f) => {
			const calendar: SchoolCalendar = JSON.parse(read(f));
			const next = fromCalendarDraft(calendar, toCalendarDraft(calendar));
			const problems = schemas.has('calendar.schema.json')
				? schemas.validate('calendar.schema.json', next)
				: [];
			return dump(next) === read(f) && problems.length === 0 ? [] : [f];
		});
		expect(bad).toEqual([]);
	});

	it('saves every untouched unit and outcome draft as the same bytes', () => {
		const changed = files.flatMap((f) => {
			if (f.endsWith('/unit.json')) {
				const unit: Unit = JSON.parse(read(f));
				return dump(fromUnitDraft(unit, toUnitDraft(unit), new Set())) === read(f) ? [] : [f];
			}
			if (f.endsWith('/outcome.json')) {
				// Compared with the house format: one outcome.json lacks its final newline.
				const set: OutcomeSet = JSON.parse(read(f));
				const house = dump(set);
				return dump(fromOutcomeDraft(set, toOutcomeDraft(set), new Set())) === house ? [] : [f];
			}
			return [];
		});
		expect(changed).toEqual([]);
	});

	it('finds every lesson valid against the repo schema', () => {
		const invalid = lessons
			.map((f) => [f, schemas.validate('lesson.schema.json', JSON.parse(read(f)))] as const)
			.filter(([, problems]) => problems.length > 0);
		expect(invalid).toEqual([]);
	});

	it('finds every offering valid against the repo schema', () => {
		const invalid = offerings
			.map((f) => [f, schemas.validate('offering.schema.json', JSON.parse(read(f)))] as const)
			.filter(([, problems]) => problems.length > 0);
		expect(invalid).toEqual([]);
	});

	it('finds every delivery record valid against the repo schema', () => {
		const invalid = records
			.map((f) => [f, schemas.validate('delivery.schema.json', JSON.parse(read(f)))] as const)
			.filter(([, problems]) => problems.length > 0);
		expect(invalid).toEqual([]);
	});

	it('finds each lesson’s ref as scripts/deliveries.py does', () => {
		const python = `
import json, sys
from pathlib import Path
sys.path.insert(0, "scripts")
from deliveries import lesson_ref
print(json.dumps({p.as_posix(): lesson_ref(p) for p in sorted(Path("subjects").glob("**/lessons/**/*.json"))}))
`;
		const expected: Record<string, string> = JSON.parse(
			execFileSync('python3', ['-c', python], { cwd: repo, encoding: 'utf-8' })
		);
		const actual = Object.fromEntries(lessons.map((f) => [f, lessonRef(f)?.ref]));
		expect(actual).toEqual(expected);
	});

	/** Every lesson a class takes, read from the clone as `Data.lessonsOf` reads a store. */
	const lessonsOfClass = (o: Offering) => {
		const subject = o.subject.replace(/\/$/, '');
		return offeringLessons(
			o,
			(unit) => {
				try {
					return (JSON.parse(read(`${subject}/${unit}/unit.json`)) as Unit).lessons ?? [];
				} catch {
					return null;
				}
			},
			(dir) =>
				files
					.filter((f) => f.startsWith(`${subject}/${dir}/`))
					.map((f) => f.slice(subject.length + 1))
		);
	};
	const python = (code: string) =>
		JSON.parse(
			execFileSync(
				'python3',
				[
					'-c',
					`import json, sys\nfrom pathlib import Path\nsys.path.insert(0, "scripts")\n${code}`
				],
				{
					cwd: repo,
					encoding: 'utf-8'
				}
			)
		);

	it('lists each class’s lessons as offering_lesson_refs in deliveries.py does', () => {
		const expected: Record<string, string[]> = python(`
from deliveries import offering_lesson_refs
out = {}
for p in sorted(Path("offerings").glob("*.json")):
    o = json.loads(p.read_text(encoding="utf-8"))
    base = Path(o["subject"])
    rj = lambda rel, base=base: json.loads((base / rel).read_text(encoding="utf-8"))
    lj = lambda rel, base=base: sorted(q.relative_to(base).as_posix() for q in (base / rel).rglob("*.json"))
    out[p.as_posix()] = offering_lesson_refs(o, rj, lj)
print(json.dumps(out))
`);
		const actual = Object.fromEntries(
			offerings.map((f) => [f, lessonsOfClass(JSON.parse(read(f)) as Offering).map((l) => l.ref)])
		);
		expect(actual).toEqual(expected);
	});

	it('decides each lesson’s keeping as snapshot in deliveries.py does', () => {
		const expected: Record<string, [string, string][]> = python(`
from deliveries import snapshot
names = {"written": "write", "plan added": "add", "has a plan": "has"}
out = {}
for p in sorted(Path("offerings").glob("*.json")):
    out[p.as_posix()] = [[ref, names.get(outcome, "several")] for ref, outcome in snapshot(p, dry_run=True)]
print(json.dumps(out))
`);
		const actual = Object.fromEntries(
			offerings.map((f) => [
				f,
				lessonsOfClass(JSON.parse(read(f)) as Offering).map(({ ref }) => {
					const path = deliveryPath(f, ref);
					const record = records.includes(path) ? (JSON.parse(read(path)) as DeliveryRecord) : null;
					return [ref, keepOutcome(record)];
				})
			])
		);
		expect(actual).toEqual(expected);
		// snapshot reads every plan through git show, so this takes a while.
	}, 120_000);

	it('finds the plans at risk as missing_plans in deliveries.py does', () => {
		const expected: string[] = python(`
from deliveries import missing_plans
print(json.dumps(missing_plans()))
`);
		const classes = offerings.map((path) => {
			const offering = JSON.parse(read(path)) as Offering;
			return { path, offering, lessons: lessonsOfClass(offering) };
		});
		const held = new Map(records.map((r) => [r, JSON.parse(read(r)) as DeliveryRecord]));
		const actual = new Set<string>();
		for (const next of classes) {
			for (const k of plansToKeep(next, classes, held)) actual.add(`${k.offering.id}  ${k.ref}`);
		}
		expect([...actual].sort()).toEqual([...new Set(expected)].sort());
		// Lesson by lesson, as the editor asks on saving one, the same plans are at risk.
		const byLesson = new Set(
			[...new Set(classes.flatMap((c) => c.lessons.map((l) => l.ref)))].flatMap((ref) =>
				plansAtRisk(ref, classes, held).map((k) => `${k.offering.id}  ${k.ref}`)
			)
		);
		expect([...byLesson].sort()).toEqual([...actual].sort());
	});

	it('lists open feedback as scripts/deliveries.py does', () => {
		const python = `
import json, sys
from pathlib import Path
sys.path.insert(0, "scripts")
from deliveries import open_feedback
out = {}
for lesson in sorted(Path("subjects").glob("**/lessons/**/*.json")):
    items = open_feedback(lesson)
    if items:
        out[lesson.as_posix()] = [[i["offering"], i["taught"], i["issue"]] for i in items]
print(json.dumps(out))
`;
		const expected: Record<string, [string | null, string | null, string][]> = JSON.parse(
			execFileSync('python3', ['-c', python], { cwd: repo, encoding: 'utf-8' })
		);
		const offeringDocs = new Map(offerings.map((f) => [f, JSON.parse(read(f)) as Offering]));
		const actual: typeof expected = {};
		for (const lesson of lessons) {
			const at = lessonRef(lesson);
			if (!at) continue;
			const held = recordPaths(records, at.ref).filter(({ offeringPath, unattributed }) => {
				const offering = offeringDocs.get(offeringPath);
				return offering ? offering.subject === at.subject : unattributed;
			});
			const open = feedbackEntries(
				held.map(({ path }) => ({ path, record: JSON.parse(read(path)) as DeliveryRecord }))
			).filter((e) => e.item.status === 'open');
			if (open.length) actual[lesson] = open.map((e) => [e.offering, e.taught, e.item.issue]);
		}
		expect(actual).toEqual(expected);
	});

	it('sets and clears a colour on every offering, valid and byte for byte', () => {
		const problems = offerings.flatMap((f) => {
			const original: Offering = JSON.parse(read(f));
			const coloured = withColour(original, 'cobalt');
			const invalid = schemas.validate('offering.schema.json', coloured);
			const back = dump(withColour(coloured, original.colour ?? null));
			return [
				...(invalid.length ? [`${f}: invalid`] : []),
				...(back === read(f) ? [] : [`${f}: bytes`])
			];
		});
		expect(problems).toEqual([]);
	});

	it('saves every offering untouched in the class editor byte for byte', () => {
		const changed = offerings.filter((f) => {
			const original: Offering = JSON.parse(read(f));
			return dump(fromClassDraft(original, toClassDraft(original))) !== read(f);
		});
		expect(changed).toEqual([]);
	});

	it('copies every offering to next year as a valid file', () => {
		const invalid = offerings.flatMap((f) => {
			const original: Offering = JSON.parse(read(f));
			const year = original.year + 1;
			const copy = copyOffering(original, { ...original, id: `${year}-copy`, year });
			const problems = schemas.validate('offering.schema.json', copy);
			return problems.length ? [`${f}: ${problems.map((p) => p.message).join('; ')}`] : [];
		});
		expect(invalid).toEqual([]);
	});

	it('orders lessons as scripts/offering_lessons.py does', () => {
		const python = `
import json, sys
from pathlib import Path
sys.path.insert(0, "scripts")
from offering_lessons import lessons_for_offering
out = {}
for o in sorted(Path("offerings").glob("*.json")):
    offering = json.loads(o.read_text(encoding="utf-8"))
    for entry in offering["units"]:
        unit_dir = Path(offering["subject"]) / entry["unit"]
        for term in (None, entry.get("term")):
            key = f"{o.as_posix()}|{unit_dir.as_posix()}|{term}"
            out[key] = lessons_for_offering(unit_dir, o, term)
print(json.dumps(out))
`;
		const expected: Record<string, string[]> = JSON.parse(
			execFileSync('python3', ['-c', python], { cwd: repo, encoding: 'utf-8' })
		);
		const units = new Set(unitDirs(files));
		const actual: Record<string, string[]> = {};
		for (const key of Object.keys(expected)) {
			const [path, unitDir, term] = key.split('|');
			expect(units.has(unitDir)).toBe(true);
			const unit: Unit = JSON.parse(read(`${unitDir}/unit.json`));
			const offering: Offering = JSON.parse(read(path));
			actual[key] = lessonsForOffering(unitDir, unit, offering, term === 'None' ? null : term);
		}
		expect(actual).toEqual(expected);
	});

	it('flags each unit’s coverage as gather and classify in coverage_report.py do', () => {
		const python = `
import json, sys
from pathlib import Path
sys.path.insert(0, "scripts")
from coverage_report import classify, gather, gather_planned
from offering_lessons import lessons_for_offering
def report(unit_dir, refs=None, oid=None, term=None):
    registry, links, dangling = gather(unit_dir, refs, oid, term)
    planned, planned_dangling = gather_planned(unit_dir, registry)
    flags = classify(registry, links, planned)
    return {"flags": {f: [rid for rid, _, _ in rows] for f, rows in flags.items()}, "dangling": dangling + planned_dangling}
out = {}
for u in sorted(Path("subjects").rglob("unit.json")):
    out[f"{u.parent.as_posix()}|None|None"] = report(u.parent)
for o in sorted(Path("offerings").glob("*.json")):
    offering = json.loads(o.read_text(encoding="utf-8"))
    for entry in offering["units"]:
        unit_dir = Path(offering["subject"]) / entry["unit"]
        for term in (None, entry.get("term")):
            refs = lessons_for_offering(unit_dir, o, term)
            out[f"{unit_dir.as_posix()}|{o.as_posix()}|{term}"] = report(unit_dir, refs, offering["id"], term)
print(json.dumps(out))
`;
		const expected: Record<string, unknown> = JSON.parse(
			execFileSync('python3', ['-c', python], { cwd: repo, encoding: 'utf-8' })
		);
		const actual: Record<string, unknown> = {};
		for (const key of Object.keys(expected)) {
			const [unitDir, path, t] = key.split('|');
			const term = t === 'None' ? null : t;
			const unit: Unit = JSON.parse(read(`${unitDir}/unit.json`));
			const offering: Offering | null = path === 'None' ? null : JSON.parse(read(path));
			const refs = offering
				? lessonsForOffering(unitDir, unit, offering, term)
				: (unit.lessons ?? []);
			const lessons = refs.map((ref) => {
				const at = joinPath(unitDir, ref);
				return { ref, lesson: files.includes(at) ? (JSON.parse(read(at)) as Lesson) : null };
			});
			const registry = unit.syllabus_registry ?? [];
			const gathered = gather(
				registry,
				lessonSources(lessons),
				tasksForOffering(unit, offering?.id ?? null, term)
			);
			const agreed = agreedLessons(unit, registry);
			actual[key] = {
				flags: classify(registry, gathered, agreed),
				dangling: [...gathered.dangling, ...agreed.dangling]
			};
		}
		expect(actual).toEqual(expected);
	});

	it('saves every unit’s untouched tasks as the same bytes', () => {
		const changed = units.filter((f) => {
			const unit: Unit = JSON.parse(read(f));
			return dump(fromTaskDrafts(unit, toTaskDrafts(unit))) !== read(f);
		});
		expect(changed).toEqual([]);
	});

	it('picks a class’s tasks as scripts/offering_lessons.py does', () => {
		const python = `
import json, sys
from pathlib import Path
sys.path.insert(0, "scripts")
from offering_lessons import tasks_for_offering
out = {}
for o in sorted(Path("offerings").glob("*.json")):
    offering = json.loads(o.read_text(encoding="utf-8"))
    for entry in offering["units"]:
        unit_dir = Path(offering["subject"]) / entry["unit"]
        unit = json.loads((unit_dir / "unit.json").read_text(encoding="utf-8"))
        for oid in (None, offering["id"]):
            for term in (None, entry.get("term")):
                key = f"{unit_dir.as_posix()}|{oid}|{term}"
                out[key] = [t["title"] for t in tasks_for_offering(unit, oid, term)]
print(json.dumps(out))
`;
		const expected: Record<string, string[]> = JSON.parse(
			execFileSync('python3', ['-c', python], { cwd: repo, encoding: 'utf-8' })
		);
		const actual: Record<string, string[]> = {};
		for (const key of Object.keys(expected)) {
			const [unitDir, id, term] = key.split('|');
			const unit: Unit = JSON.parse(read(`${unitDir}/unit.json`));
			actual[key] = tasksForOffering(
				unit,
				id === 'None' ? null : id,
				term === 'None' ? null : term
			).map((t) => t.title);
		}
		expect(actual).toEqual(expected);
	});

	describe('assessment specs', () => {
		const specs = files.filter((f) => /^offerings\/[^/]+\/assessments\/[^/]+\.json$/.test(f));

		it('reads each notification’s topic lines as test_assessment_specs.py does', () => {
			// The test module imports pytest, so only its _topic_lines is run.
			const expected: Record<string, string[] | null> = python(`
import ast, re
tree = ast.parse(Path("tests/test_assessment_specs.py").read_text(encoding="utf-8"))
fn = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "_topic_lines")
ns = {"re": re}
exec(compile(ast.Module(body=[fn], type_ignores=[]), "_topic_lines", "exec"), ns)
out = {}
for p in sorted(Path("offerings").glob("*/assessments/*.json")):
    note = json.loads(p.read_text(encoding="utf-8"))["notification"]
    try:
        out[note] = ns["_topic_lines"](Path(note).read_text(encoding="utf-8"))
    except IndexError:
        out[note] = None
print(json.dumps(out))
`);
			const actual = Object.fromEntries(
				Object.keys(expected).map((note) => [note, topicLines(read(note))])
			);
			expect(actual).toEqual(expected);
		});

		const loaded = () =>
			specs.flatMap((path) => {
				const spec = JSON.parse(read(path)) as AssessmentSpec;
				if (!existsSync(joinFs(repo, spec.notification))) return [];
				return [{ path, spec, notification: read(spec.notification) }];
			});

		it('saves every untouched spec and notification as the same bytes', () => {
			// Compared with the house format, as for outcome.json: a spec written by
			// hand (ids on one line) is reformatted by its first save from the app.
			const changed = loaded().flatMap(({ path, spec, notification }) => {
				const out = fromAssessmentDraft(toAssessmentDraft(spec, notification).draft);
				return [
					...(dump(out.spec) === dump(spec) ? [] : [path]),
					...(out.notification === notification ? [] : [spec.notification])
				];
			});
			expect(changed).toEqual([]);
		});

		it('reads every part of every Marking criteria as parts, criteria and mark ranges', () => {
			const loose: string[] = [];
			for (const { spec, notification } of loaded()) {
				const { draft } = toAssessmentDraft(spec, notification);
				for (const x of draft.sections) {
					if (x.body.kind !== 'criteria') continue;
					for (const part of x.body.parts) {
						if (part.kind !== 'part')
							loose.push(`${spec.notification}: ${part.text.split('\n')[0]}`);
					}
				}
			}
			expect(loose).toEqual([]);
		});

		it('reads every section’s text as blocks that join back the same', () => {
			const changed: string[] = [];
			const raw: string[] = [];
			for (const { spec, notification } of loaded()) {
				const { draft } = toAssessmentDraft(spec, notification);
				for (const x of draft.sections) {
					if (x.body.kind !== 'text') continue;
					const blocks = readBlocks(x.body.text);
					if (joinBlocks(blocks) !== x.body.text)
						changed.push(`${spec.notification}: ${x.heading}`);
					for (const b of blocks) {
						if (b.kind === 'raw') raw.push(`${x.heading}: ${b.text.split('\n')[0].slice(0, 40)}`);
					}
				}
			}
			expect(changed).toEqual([]);
			// Kept as text: shown so a change to the reader that loses structure is noticed.
			expect(raw.length).toBeLessThanOrEqual(3);
		});

		it('finds every real notification’s marks already following its parts', () => {
			const moved: string[] = [];
			for (const { spec, notification } of loaded()) {
				const { draft } = toAssessmentDraft(spec, notification);
				if (syncMarks(draft)) moved.push(spec.notification);
			}
			expect(moved).toEqual([]);
		});

		it('writes every edited part so it reads back the same', () => {
			const changed: string[] = [];
			for (const { spec, notification } of loaded()) {
				const { draft } = toAssessmentDraft(spec, notification);
				for (const x of draft.sections) {
					if (x.body.kind !== 'criteria') continue;
					for (const part of x.body.parts) {
						if (part.kind !== 'part') continue;
						// Forget where it came from, so it is written fresh.
						const fresh = { ...part, __raw: undefined, __was: undefined };
						if (partText(fresh) !== part.__raw) changed.push(`${spec.notification}: ${part.label}`);
					}
				}
			}
			expect(changed).toEqual([]);
		});

		it('writes edited topics so test_assessment_specs.py reads them back', () => {
			// Every topic reworded and one added, then the data repo's own
			// _topic_lines run on each notification the editor would write.
			const out = mkdtempSync(joinFs(tmpdir(), 'almanac-topics-'));
			const expected: Record<string, string[]> = {};
			loaded().forEach(({ spec, notification }, i) => {
				const { draft } = toAssessmentDraft(spec, notification);
				const section = draft.sections.find((x) => x.body.kind === 'topics');
				if (section?.body.kind !== 'topics') throw new Error(`${spec.notification}: no topics`);
				const all = section.body.rows;
				const rows = all.filter((r) => r.kind === 'topic');
				for (const row of rows) row.text = `${row.text} (edited)`;
				const last = all.lastIndexOf(rows.at(-1)!);
				all.splice(last + 1, 0, {
					...blankTopic(rows.at(-1)),
					text: 'A new topic',
					ids: [],
					note: 'Added by the test.'
				});
				const made = fromAssessmentDraft(draft);
				writeFileSync(joinFs(out, `${i}.md`), made.notification);
				expected[`${i}.md`] = made.spec.topics.map((t) => t.text);
			});
			const actual: Record<string, string[]> = python(`
import ast, re
tree = ast.parse(Path("tests/test_assessment_specs.py").read_text(encoding="utf-8"))
fn = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "_topic_lines")
ns = {"re": re}
exec(compile(ast.Module(body=[fn], type_ignores=[]), "_topic_lines", "exec"), ns)
out = Path(${JSON.stringify(out)})
print(json.dumps({p.name: ns["_topic_lines"](p.read_text(encoding="utf-8")) for p in sorted(out.glob("*.md"))}))
`);
			rmSync(out, { recursive: true });
			expect(Object.keys(actual).length).toBeGreaterThan(0);
			expect(actual).toEqual(expected);
		});

		it('finds every spec valid and nothing wrong with any', () => {
			const problems: Record<string, string[]> = {};
			for (const path of specs) {
				const spec = JSON.parse(read(path)) as AssessmentSpec;
				const found = schemas.has('assessment.schema.json')
					? schemas.validate('assessment.schema.json', spec).map((p) => JSON.stringify(p))
					: [];
				const offering = JSON.parse(
					read(path.replace(/\/assessments\/[^/]+$/, '.json'))
				) as Offering;
				const registries: Registries = new Map(
					spec.units.map((unit) => {
						const file = `${unitDir(offering, unit)}/unit.json`;
						const doc = files.includes(file) ? (JSON.parse(read(file)) as Unit) : null;
						return [unit, doc ? (doc.syllabus_registry ?? []) : null];
					})
				);
				let notification: string | null = null;
				try {
					notification = read(spec.notification);
				} catch {
					// Missing: specProblems says so.
				}
				found.push(...specProblems(spec, offering, registries, notification));
				if (found.length) problems[path] = found;
			}
			expect(problems).toEqual({});
		});
	});
});
