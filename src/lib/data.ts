/**
 * The lesson files as the pages see it: units, offerings, lessons and schemas,
 * read through one `Store` (a folder, or a GitHub repo). Lists are read once
 * per source; for GitHub, individual files come from the Repo's blob cache,
 * so revisiting a page is free.
 */

import type { Schema } from '@cfworker/json-schema';
import {
	deliveryPath,
	lessonRef,
	newDelivery,
	recordPaths,
	resolveFeedback,
	withDelivery,
	withMaterials,
	type DeliveryRecord,
	type Resolution,
	type TaughtInput
} from './domain/deliveries.ts';
import {
	contentPath,
	offeringPaths,
	oneOffDirs,
	outcomePath,
	schemaPaths,
	unitDirs
} from './domain/layout.ts';
import type { MaterialDraft } from './domain/materials.ts';
import { basename, join, normalise, stem } from './domain/paths.ts';
import { withColour } from './domain/offeringEdit.ts';
import { withLesson } from './domain/newLesson.ts';
import { isFresh, STARTER_SCHEMAS } from './domain/starter.ts';
import { offeringPath } from './domain/newOffering.ts';
import { byNumber } from './house.ts';
import { ConflictError, type Loaded } from './domain/repo.ts';
import type { Store } from './domain/store.ts';
import type { Lesson, Offering, Unit } from './domain/types.ts';
import type { OutcomeSet } from './domain/unitEdit.ts';
import { describeProblems } from './domain/fieldNames.ts';
import { Schemas, type Problem } from './domain/validate.ts';

export interface UnitEntry {
	dir: string;
	unit: Unit;
}

/** One class's delivery record for a lesson, as read. */
export interface HeldRecord {
	path: string;
	sha: string;
	record: DeliveryRecord;
	/** The offering file the record sits beside; null for an unattributed one. */
	offeringPath: string | null;
	offering: Offering | null;
}

export class Data {
	private unitsPromise: Promise<UnitEntry[]> | null = null;
	private offeringsPromise: Promise<[string, Offering][]> | null = null;
	private schemasPromise: Promise<Schemas> | null = null;

	constructor(readonly store: Store) {}

	units(): Promise<UnitEntry[]> {
		this.unitsPromise ??= this.store.paths().then((paths) =>
			Promise.all(
				unitDirs(paths.keys()).map(async (dir) => ({
					dir,
					unit: (await this.store.readJson<Unit>(join(dir, 'unit.json'))).doc
				}))
			)
		);
		return this.unitsPromise;
	}

	async unit(dir: string): Promise<Unit> {
		return (await this.store.readJson<Unit>(join(dir, 'unit.json'))).doc;
	}

	offerings(): Promise<[string, Offering][]> {
		this.offeringsPromise ??= this.store.paths().then((paths) =>
			Promise.all(
				offeringPaths(paths.keys())
					.sort(byNumber)
					.map(
						async (path) =>
							[path, (await this.store.readJson<Offering>(path)).doc] as [string, Offering]
					)
			)
		);
		return this.offeringsPromise;
	}

	async offering(path: string): Promise<Offering> {
		return (await this.store.readJson<Offering>(path)).doc;
	}

	/**
	 * Saves a new class as `offerings/<id>.json` and returns its path. Throws
	 * ConflictError if that file exists, and an Error listing the problems if
	 * the schema refuses it.
	 */
	async createOffering(doc: Offering): Promise<string> {
		const path = offeringPath(doc.id);
		const schemas = await this.schemas();
		if (schemas.has('offering.schema.json')) {
			const problems = schemas.validate('offering.schema.json', doc);
			if (problems.length) throw problemError('offering.schema.json', problems);
		}
		await this.store.createJson(path, doc, `Add class ${doc.id}`);
		this.offeringsPromise = null;
		return path;
	}

	/**
	 * Saves a new unit as `dir/unit.json`. On a fresh start (no units, classes
	 * or schemas yet) the starter schemas are written first, so this and every
	 * later save is checked. Throws ConflictError if the unit's file exists,
	 * and an Error listing the problems if the schema refuses it.
	 */
	async createUnit(dir: string, doc: Unit): Promise<void> {
		if (isFresh((await this.store.paths()).keys())) {
			for (const [name, schema] of Object.entries(STARTER_SCHEMAS)) {
				await this.store.createJson(join('schemas', name), schema, `Add starter ${name}`);
			}
			this.schemasPromise = null;
		}
		await this.check('unit.schema.json', doc);
		await this.store.createJson(join(dir, 'unit.json'), doc, `Add unit ${basename(dir)}`);
		this.unitsPromise = null;
	}

	/** The unit's file as it stands, with its version for a later save. */
	unitFile(dir: string): Promise<Loaded<Unit>> {
		return this.store.readJson<Unit>(join(dir, 'unit.json'));
	}

	/**
	 * Every dot point id a plan in the unit's directory links, so the editor
	 * never removes one in use. Reads every plan under the unit, listed or not.
	 */
	async linkedIds(dir: string): Promise<Set<string>> {
		const prefix = dir + '/';
		const plans = [...(await this.store.paths()).keys()].filter(
			(p) => p.startsWith(prefix) && p.endsWith('.json') && p !== join(dir, 'unit.json')
		);
		const ids = new Set<string>();
		for (const lesson of await Promise.all(plans.map((p) => this.lesson(p).catch(() => null)))) {
			for (const link of lesson?.doc.curriculum_links ?? []) ids.add(link.id);
		}
		return ids;
	}

	/**
	 * Saves a unit's own fields. Throws ConflictError if the file changed
	 * since it was read, and an Error listing the problems if the schema
	 * refuses it.
	 */
	async saveUnit(dir: string, next: Unit, sha: string, message: string): Promise<string> {
		await this.check('unit.schema.json', next);
		const newSha = await this.store.writeJson(join(dir, 'unit.json'), next, sha, message);
		this.unitsPromise = null;
		return newSha;
	}

	/**
	 * The outcomes that apply to a unit: the nearest `outcome.json` at or
	 * above it, as the renderers find it, or null where the subject has none.
	 */
	async outcomesFor(dir: string): Promise<(Loaded<OutcomeSet> & { path: string }) | null> {
		const path = outcomePath(dir, await this.store.paths());
		if (!path) return null;
		return { path, ...(await this.store.readJson<OutcomeSet>(path)) };
	}

	/** Every outcome code a unit names, among the units that take their outcomes from `path`. */
	async usedCodes(path: string): Promise<Set<string>> {
		const paths = await this.store.paths();
		const codes = new Set<string>();
		for (const { dir, unit } of await this.units()) {
			if (outcomePath(dir, paths) !== path) continue;
			for (const code of unit.applicable_outcomes ?? []) codes.add(code);
		}
		return codes;
	}

	/**
	 * Saves a subject's outcomes: over the file read with `sha`, or as a new
	 * file when `sha` is null. Throws ConflictError if the file changed (or
	 * appeared) meanwhile, and an Error listing the problems if the schema
	 * refuses it.
	 */
	async saveOutcomes(
		path: string,
		next: OutcomeSet,
		sha: string | null,
		message: string
	): Promise<string> {
		await this.check('outcome.schema.json', next);
		return sha === null
			? this.store.createJson(path, next, message)
			: this.store.writeJson(path, next, sha, message);
	}

	/**
	 * Saves a new plan at `unitDir/ref` and adds it to the unit's index, in
	 * that order, as two writes. Both files are checked against the schemas
	 * before either is written. Throws ConflictError if the plan's file
	 * exists. A unit that changed meanwhile is read again and the plan added
	 * to that; if the index still cannot be written, the Error says the plan
	 * is saved but not listed.
	 */
	async createLesson(unitDir: string, ref: string, doc: Lesson, message?: string): Promise<void> {
		const path = join(unitDir, ref);
		const unitPath = join(unitDir, 'unit.json');
		const name = stem(ref);
		const { doc: unit, sha } = await this.store.readJson<Unit>(unitPath);
		await this.check('lesson.schema.json', doc);
		await this.check('unit.schema.json', withLesson(unit, ref));
		await this.store.createJson(path, doc, message || `Add lesson ${name}`);
		const listed = `List ${name} in ${basename(unitDir)}`;
		try {
			try {
				await this.store.writeJson(unitPath, withLesson(unit, ref), sha, listed);
			} catch (error) {
				if (!(error instanceof ConflictError)) throw error;
				this.store.refresh();
				const fresh = await this.store.readJson<Unit>(unitPath);
				await this.store.writeJson(unitPath, withLesson(fresh.doc, ref), fresh.sha, listed);
			}
		} catch (error) {
			throw new Error(
				`${name} is saved, but adding it to ${unitPath} failed: ${(error as Error).message} Add "${ref}" to the unit's lessons by hand.`,
				{ cause: error }
			);
		} finally {
			this.unitsPromise = null;
		}
	}

	/**
	 * Fixes a class's colour (or clears it, with null) and saves the offering.
	 * Throws ConflictError if the file changed since it was read, and an Error listing the problems if the schema refuses it.
	 */
	async setColour(path: string, colour: string | null): Promise<void> {
		const { doc, sha } = await this.store.readJson<Offering>(path);
		const next = withColour(doc, colour);
		const schemas = await this.schemas();
		// A folder without schemas/ saves unchecked.
		if (schemas.has('offering.schema.json')) {
			const problems = schemas.validate('offering.schema.json', next);
			if (problems.length) throw problemError('offering.schema.json', problems);
		}
		const message = colour ? `Set ${doc.id} colour to ${colour}` : `Clear ${doc.id} colour`;
		await this.store.writeJson(path, next, sha, message);
		const list = await this.offerings();
		this.offeringsPromise = Promise.resolve(
			list.map(([p, o]) => [p, p === path ? next : o] as [string, Offering])
		);
	}

	/**
	 * Saves an edited class over the version `sha` names and returns the new
	 * version id. Throws ConflictError if the file changed since it was read,
	 * and an Error listing the problems if the schema refuses it.
	 */
	async saveOffering(path: string, doc: Offering, sha: string, message: string): Promise<string> {
		await this.check('offering.schema.json', doc);
		const next = await this.store.writeJson(path, doc, sha, message);
		const list = await this.offerings();
		this.offeringsPromise = Promise.resolve(
			list.map(([p, o]) => [p, p === path ? doc : o] as [string, Offering])
		);
		return next;
	}

	/** The subject's one-off lessons, as `one_offs/<name>` relative to the subject. */
	async oneOffs(subject: string): Promise<string[]> {
		return oneOffDirs((await this.store.paths()).keys(), subject);
	}

	lesson(path: string): Promise<Loaded<Lesson>> {
		return this.store.readJson<Lesson>(path);
	}

	/** The plan's paired content file, or null where none is written yet. */
	async content(lessonPath: string): Promise<string | null> {
		const path = contentPath(lessonPath);
		if (!(await this.store.has(path))) return null;
		return (await this.store.readText(path)).doc;
	}

	/**
	 * Every class's record for one lesson, in class-directory order. Reads
	 * only the files at the lesson's own path under each `taught/`, as
	 * `lesson_deliveries` in the data repo's `scripts/deliveries.py` does: a
	 * class whose offering teaches another subject is skipped, and an
	 * unattributed directory matches on path alone.
	 */
	async deliveries(lessonPath: string): Promise<HeldRecord[]> {
		const at = lessonRef(lessonPath);
		if (!at) return [];
		const [paths, offerings] = await Promise.all([this.store.paths(), this.offerings()]);
		type Found = Omit<HeldRecord, 'sha' | 'record'>;
		const found = recordPaths(paths.keys(), at.ref).flatMap(
			({ path, offeringPath, unattributed }): Found[] => {
				const offering = offerings.find(([p]) => p === offeringPath)?.[1] ?? null;
				if (offering) {
					return normalise(offering.subject ?? '') === normalise(at.subject)
						? [{ path, offeringPath, offering }]
						: [];
				}
				return unattributed ? [{ path, offeringPath: null, offering: null }] : [];
			}
		);
		return Promise.all(
			found.map(async (f) => {
				const { doc, sha } = await this.store.readJson<DeliveryRecord>(f.path);
				return { ...f, sha, record: doc };
			})
		);
	}

	/**
	 * Records one class's delivery of a lesson, in one write: appended to the
	 * class's record, or a new record for its first. `plan` is the lesson as
	 * it stands. Throws ConflictError if the record changed since it was read
	 * (or appeared meanwhile), and an Error listing the problems if the
	 * schema refuses it.
	 */
	async markTaught(
		offeringPath: string,
		offering: Offering,
		lessonPath: string,
		plan: Lesson,
		input: TaughtInput
	): Promise<void> {
		const at = lessonRef(lessonPath);
		if (!at) throw new Error(`${lessonPath} is not under a units/ or revision/ directory.`);
		const path = deliveryPath(offeringPath, at.ref);
		const delivery = newDelivery(input, plan, await this.store.head());
		const message = `Taught ${stem(lessonPath)} to ${offering.id}`;
		if (await this.store.has(path)) {
			const { doc, sha } = await this.store.readJson<DeliveryRecord>(path);
			const next = withDelivery(doc, offering.id, at.ref, delivery);
			await this.check('delivery.schema.json', next);
			await this.store.writeJson(path, next, sha, message);
		} else {
			const next = withDelivery(null, offering.id, at.ref, delivery);
			await this.check('delivery.schema.json', next);
			await this.store.createJson(path, next, message);
		}
	}

	/**
	 * Applies or declines feedback in one record. Throws ConflictError if the
	 * record changed since `held` was read.
	 */
	async resolve(held: HeldRecord, resolutions: Resolution[], message: string): Promise<void> {
		const next = resolveFeedback(held.record, resolutions);
		await this.check('delivery.schema.json', next);
		await this.store.writeJson(held.path, next, held.sha, message);
	}

	/**
	 * Sets the links on one delivery in a record. Throws ConflictError if the
	 * record changed since `held` was read.
	 */
	async saveMaterials(
		held: HeldRecord,
		delivery: number,
		drafts: MaterialDraft[],
		message: string
	): Promise<void> {
		const next = withMaterials(held.record, delivery, drafts);
		await this.check('delivery.schema.json', next);
		await this.store.writeJson(held.path, next, held.sha, message);
	}

	/** Throws the schema's problems, if the files include it; a folder without schemas/ saves unchecked. */
	private async check(name: string, doc: unknown): Promise<void> {
		const schemas = await this.schemas();
		if (!schemas.has(name)) return;
		const problems = schemas.validate(name, doc);
		if (problems.length) throw problemError(name, problems);
	}

	schemas(): Promise<Schemas> {
		this.schemasPromise ??= this.store.paths().then(async (paths) => {
			const entries = await Promise.all(
				schemaPaths(paths.keys()).map(
					async (path) => [basename(path), (await this.store.readJson<Schema>(path)).doc] as const
				)
			);
			return new Schemas(Object.fromEntries(entries));
		});
		return this.schemasPromise;
	}
}

/** An Error that lists a schema's problems in plain words, one sentence each. */
function problemError(schema: string, problems: Problem[]): Error {
	return new Error(describeProblems(schema, problems).join(' '));
}
