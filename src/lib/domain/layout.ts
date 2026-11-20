/**
 * Where things are in the data repo, worked out from the list of paths alone.
 *
 * Units are `subjects/**\/unit.json`; offerings are `offerings/*.json`. A
 * subject may have a course level beneath it (Enterprise Computing's
 * preliminary and hsc), so a unit's subject is never assumed from depth: an
 * offering names its subject, and a unit belongs to the offering's subject
 * when `subject/entry.unit` is the unit's directory.
 */

import { dirname, join } from './paths.ts';

export function unitDirs(paths: Iterable<string>): string[] {
	const dirs: string[] = [];
	for (const path of paths) {
		if (path.startsWith('subjects/') && path.endsWith('/unit.json')) dirs.push(dirname(path));
	}
	return dirs.sort();
}

export function offeringPaths(paths: Iterable<string>): string[] {
	const found: string[] = [];
	for (const path of paths) {
		if (/^offerings\/[^/]+\.json$/.test(path)) found.push(path);
	}
	return found.sort();
}

/** The school calendars, `calendar/<year>.json`. */
export function calendarPaths(paths: Iterable<string>): string[] {
	const found: string[] = [];
	for (const path of paths) {
		if (/^calendar\/\d{4}\.json$/.test(path)) found.push(path);
	}
	return found.sort();
}

export function calendarPath(year: number): string {
	return `calendar/${year}.json`;
}

export function schemaPaths(paths: Iterable<string>): string[] {
	const found: string[] = [];
	for (const path of paths) {
		if (/^schemas\/[^/]+\.schema\.json$/.test(path)) found.push(path);
	}
	return found.sort();
}

/**
 * Whether a folder can be opened as lesson files: it holds a unit or an
 * offering, or nothing in subfolders yet (a fresh start). Loose top-level
 * files, such as a new clone's README, still count as fresh.
 */
export function canOpen(paths: Iterable<string>): boolean {
	let fresh = true;
	for (const path of paths) {
		if (/^subjects\/.+\/unit\.json$/.test(path) || /^offerings\/[^/]+\.json$/.test(path)) {
			return true;
		}
		if (path.includes('/')) fresh = false;
	}
	return fresh;
}

/** The nearest `outcome.json` at or above the unit directory, as the renderers find it. */
export function outcomePath(
	unitDir: string,
	paths: Set<string> | Map<string, unknown>
): string | null {
	let dir = unitDir;
	while (dir) {
		const candidate = join(dir, 'outcome.json');
		if (paths.has(candidate)) return candidate;
		dir = dirname(dir);
	}
	return null;
}

/** `subjects/computing_technology/units/analysing_data` -> `computing_technology` */
export function subjectOf(unitDir: string): string {
	return unitDir.split('/')[1] ?? '';
}

/**
 * The content file paired with a plan: same directory, same stem, `.md`.
 * Returns the path whether or not it exists.
 */
export function contentPath(lessonPath: string): string {
	return lessonPath.replace(/\.json$/, '.md');
}

/**
 * The subject's one-off lessons, as `one_offs/<name>` relative to the subject:
 * every directory directly under `<subject>/one_offs/` that holds a file.
 */
export function oneOffDirs(paths: Iterable<string>, subject: string): string[] {
	const prefix = `${subject}/one_offs/`;
	const found = new Set<string>();
	for (const path of paths) {
		if (!path.startsWith(prefix)) continue;
		const name = path.slice(prefix.length).split('/')[0];
		if (name && path.length > prefix.length + name.length) found.add(`one_offs/${name}`);
	}
	return [...found].sort();
}
