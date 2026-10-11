/**
 * Checks against a local clone of a real data repo. Skipped unless DATA_REPO
 * names one, so no private data is ever needed in, or committed to, this repo:
 *
 *     DATA_REPO=../subject-almanac npm test
 */

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join as joinFs, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { feedbackEntries, lessonRef, recordPaths, type DeliveryRecord } from './deliveries.ts';
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
import { fromTaskDrafts, tasksForOffering, toTaskDrafts } from './tasks.ts';
import type { Lesson, Offering, Unit } from './types.ts';
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
	const lessons = files.filter((f) => /^subjects\/.*\/lessons\/.*\.json$/.test(f));
	const records = files.filter((f) => /^offerings\/[^/]+\/taught\//.test(f));
	const offerings = files.filter((f) => /^offerings\/[^/]+\.json$/.test(f));
	const schemas = new Schemas(
		Object.fromEntries(
			readdirSync(joinFs(repo, 'schemas'))
				.filter((f) => f.endsWith('.schema.json'))
				.map((f) => [f, JSON.parse(read(`schemas/${f}`))])
		)
	);

	it('round-trips every file the editor can write through dump', () => {
		// outcome.json is skipped: one lacks its final newline, which an edit in
		// the app adds. Its untouched-draft test compares with the house format.
		const writable = files.filter((f) => !f.endsWith('/outcome.json'));
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
		const units = files.filter((f) => f.endsWith('/unit.json'));
		const wrong = units.flatMap((f) => {
			const dir = f.slice(0, -'/unit.json'.length);
			const unit: Unit = JSON.parse(read(f));
			return lessonFolders(unit).flatMap((folder) => {
				const ref = lessonFile(folder, 'new_plan');
				const before = read(f).split('\n');
				const after = dump(withLesson(unit, ref)).split('\n');
				const added = after.filter((line) => !before.includes(line));
				const ok =
					after.length === before.length + 1 &&
					added.every((line) => line.includes('"lessons/')) &&
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
		const units = files.filter((f) => f.endsWith('/unit.json'));
		const invalid = [
			...lessons.map((f) => [f, 'lesson.schema.json'] as const),
			...units.map((f) => [f, 'unit.schema.json'] as const),
			...offerings.map((f) => [f, 'offering.schema.json'] as const),
			...files
				.filter((f) => f.endsWith('/outcome.json'))
				.map((f) => [f, 'outcome.schema.json'] as const)
		]
			.map(([f, name]) => [f, starter.validate(name, JSON.parse(read(f)))] as const)
			.filter(([, problems]) => problems.length > 0);
		expect(invalid).toEqual([]);
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

	it('saves every unit’s untouched tasks as the same bytes', () => {
		const units = files.filter((f) => f.endsWith('/unit.json'));
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
});
