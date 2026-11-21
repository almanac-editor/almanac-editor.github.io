/**
 * A class's assessment specs: `offerings/<class>/assessments/<task>.json`,
 * checked by the data repo's `schemas/assessment.schema.json`. A spec names
 * the task, the units it examines, its notification, and every topic line in
 * the notification mapped to registry ids.
 *
 * Read-only for now. The checks are the ones the data repo's
 * `tests/test_assessment_specs.py` makes, so the page shows what that test
 * would fail on.
 */

import { join } from './paths.ts';
import type { Offering, RegistryEntry } from './types.ts';

export interface Topic {
	text: string;
	/** A unit the task examines, relative to the offering's subject directory. */
	unit: string;
	phase?: string;
	ids: string[];
	note?: string;
	[key: string]: unknown;
}

export interface AssessmentSpec {
	offering: string;
	title: string;
	/** The notification's path, relative to the repo root. */
	notification: string;
	klunk?: { profile?: string; paper?: string };
	units: string[];
	topics: Topic[];
	[key: string]: unknown;
}

/** `offerings/2026_y7.json` -> `offerings/2026_y7/assessments` */
export function assessmentDir(offeringPath: string): string {
	return `${offeringPath.replace(/\.json$/, '')}/assessments`;
}

/** The spec named `name` (its file stem) for a class. */
export function assessmentPath(offeringPath: string, name: string): string {
	return join(assessmentDir(offeringPath), `${name}.json`);
}

/**
 * A class's specs, as file stems: every `.json` directly in its assessments
 * folder, as `assessment_specs()` in the data repo's `scripts/view.py` globs.
 */
export function assessmentNames(offeringPath: string, paths: Iterable<string>): string[] {
	const prefix = `${assessmentDir(offeringPath)}/`;
	const names: string[] = [];
	for (const path of paths) {
		if (!path.startsWith(prefix)) continue;
		const rest = path.slice(prefix.length);
		if (!rest.includes('/') && rest.endsWith('.json')) names.push(rest.slice(0, -'.json'.length));
	}
	return names.sort();
}

export const TOPICS_HEADING = '## Assessable topics';

/**
 * The bullets under a notification's `## Assessable topics`, up to the next
 * `## ` heading, as `_topic_lines` in `tests/test_assessment_specs.py` reads
 * them. Null when the notification has no such heading.
 */
export function topicLines(notification: string): string[] | null {
	const at = notification.indexOf(TOPICS_HEADING);
	if (at === -1) return null;
	let section = notification.slice(at + TOPICS_HEADING.length);
	const next = /^## /m.exec(section);
	if (next) section = section.slice(0, next.index);
	return section
		.split(/\r\n|\r|\n/)
		.filter((line) => line.startsWith('- '))
		.map((line) => line.slice(2).trim());
}

/** The registry entries of each unit a spec examines; null where the unit's file is missing. */
export type Registries = Map<string, RegistryEntry[] | null>;

/** A unit's directory in the repo, from its path in a spec. */
export function unitDir(offering: Offering, unit: string): string {
	return join(offering.subject, unit);
}

/**
 * What is wrong with a spec, in plain words, one sentence each: the checks
 * `tests/test_assessment_specs.py` makes. `notification` is the file's text,
 * or null where it is not in the repo.
 */
export function specProblems(
	spec: AssessmentSpec,
	offering: Offering,
	registries: Registries,
	notification: string | null
): string[] {
	const problems: string[] = [];
	if (spec.offering !== offering.id) {
		problems.push(`The spec names class ${spec.offering}, but it sits beside ${offering.id}.`);
	}
	for (const unit of spec.units) {
		if (registries.get(unit) === null) {
			problems.push(
				`${unit} is in the spec’s units, but ${unitDir(offering, unit)} has no unit.json.`
			);
		}
	}
	for (const topic of spec.topics) {
		const quoted = `“${topic.text}”`;
		if (!spec.units.includes(topic.unit)) {
			problems.push(`${quoted} is in ${topic.unit}, which is not in the spec’s units.`);
			continue;
		}
		const registry = registries.get(topic.unit);
		if (registry) {
			const known = new Set(registry.map((entry) => entry.id));
			const missing = [...new Set(topic.ids)].filter((id) => !known.has(id)).sort();
			if (missing.length) {
				problems.push(
					`${quoted} links ${missing.join(', ')}, not in ${topic.unit}’s syllabus dot points.`
				);
			}
		}
		if (!topic.ids.length && !topic.note) {
			problems.push(`${quoted} has no dot point ids and no note saying why.`);
		}
	}
	problems.push(...notificationProblems(spec, notification));
	return problems;
}

function notificationProblems(spec: AssessmentSpec, notification: string | null): string[] {
	if (notification === null) return [`The notification ${spec.notification} is not in the repo.`];
	const lines = topicLines(notification);
	if (lines === null) return [`The notification has no “${TOPICS_HEADING.slice(3)}” heading.`];
	const texts = spec.topics.map((t) => t.text);
	const at = texts.findIndex((text, i) => text !== lines[i]);
	if (at === -1 && texts.length === lines.length) return [];
	if (at === -1) {
		return [
			`The notification lists ${lines.length} assessable topics and the spec ${texts.length}. The first one only the notification has is “${lines[texts.length]}”.`
		];
	}
	if (at >= lines.length) {
		return [
			`The notification lists ${lines.length} assessable topics and the spec ${texts.length}. The first one only the spec has is “${texts[at]}”.`
		];
	}
	return [
		`Topic ${at + 1} differs from the notification: the spec has “${texts[at]}”, the notification “${lines[at]}”.`
	];
}

export interface TopicGroup {
	unit: string;
	phases: { phase: string; topics: Topic[] }[];
}

/**
 * The topics grouped by unit, then phase, each in the order it first
 * appears, so a spec written in the notification's order reads the same.
 */
export function groupTopics(spec: AssessmentSpec): TopicGroup[] {
	const groups: TopicGroup[] = [];
	for (const topic of spec.topics) {
		let group = groups.find((g) => g.unit === topic.unit);
		if (!group) groups.push((group = { unit: topic.unit, phases: [] }));
		const phase = topic.phase ?? '';
		let bucket = group.phases.find((p) => p.phase === phase);
		if (!bucket) group.phases.push((bucket = { phase, topics: [] }));
		bucket.topics.push(topic);
	}
	return groups;
}
