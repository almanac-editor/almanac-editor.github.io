/**
 * Starter schemas, written into `schemas/` when a teacher starts from an empty
 * folder, so saves are checked from the first one. They are Almanac's own,
 * generic, and only ask for the shape the app and its readers rely on: a
 * school replaces or extends them freely. A folder that already has plans is
 * never given them; one without `schemas/` saves unchecked.
 */

import type { Schema } from '@cfworker/json-schema';
import calendar from './starter/calendar.schema.json';
import lesson from './starter/lesson.schema.json';
import offering from './starter/offering.schema.json';
import outcome from './starter/outcome.schema.json';
import unit from './starter/unit.schema.json';

export const STARTER_SCHEMAS: Record<string, Schema> = {
	'calendar.schema.json': calendar as Schema,
	'lesson.schema.json': lesson as Schema,
	'offering.schema.json': offering as Schema,
	'outcome.schema.json': outcome as Schema,
	'unit.schema.json': unit as Schema
};

/** Whether the files are a fresh start: no units, classes or schemas yet. */
export function isFresh(paths: Iterable<string>): boolean {
	for (const path of paths) {
		if (/^(subjects\/.+\/unit|offerings\/[^/]+|schemas\/[^/]+\.schema)\.json$/.test(path)) {
			return false;
		}
	}
	return true;
}
