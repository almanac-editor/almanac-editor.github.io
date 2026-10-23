/**
 * Validation against the data repo's own JSON schemas, fetched at run time, so
 * the editor and `check-jsonschema` share one definition of a valid file.
 *
 * Uses @cfworker/json-schema, which interprets schemas rather than compiling
 * them to code, so it runs under a Content-Security-Policy without
 * 'unsafe-eval'. The schemas carry no `$id` and refer to each other by file
 * name (`lesson.schema.json#/$defs/differentiation`), so each one is given an
 * `$id` under a common base before it is registered.
 */

import { Validator, type Schema } from '@cfworker/json-schema';

const BASE = 'https://schemas.almanac.invalid/';

export interface Problem {
	/** Where in the document, as a dotted path: `sections[2].duration_minutes`. Empty for the whole file. */
	path: string;
	/** What is wrong, in plain words, to follow the field's name: "is empty". */
	message: string;
}

export class Schemas {
	private readonly byName = new Map<string, Schema>();

	/** `schemas` maps a file name (`lesson.schema.json`) to its parsed content. */
	constructor(schemas: Record<string, Schema>) {
		for (const [name, schema] of Object.entries(schemas)) {
			this.byName.set(name, { ...structuredClone(schema), $id: BASE + name });
		}
	}

	has(name: string): boolean {
		return this.byName.has(name);
	}

	validate(name: string, instance: unknown): Problem[] {
		const root = this.byName.get(name);
		if (!root) throw new Error(`No schema named ${name}`);
		// The validator annotates the schemas it is given, so each run gets fresh copies.
		const validator = new Validator(structuredClone(root), '2020-12', false);
		for (const [other, schema] of this.byName) {
			if (other !== name) validator.addSchema(structuredClone(schema));
		}
		const result = validator.validate(instance);
		if (result.valid) return [];
		return leafErrors(result.errors);
	}
}

/** Keywords that only say a child failed; the child's own error says why. */
const WRAPPERS = new Set([
	'properties',
	'items',
	'prefixItems',
	'additionalProperties',
	'$ref',
	'allOf',
	'anyOf',
	'oneOf',
	'not',
	'patternProperties',
	'unevaluatedProperties',
	'unevaluatedItems',
	'dependentSchemas',
	'if',
	'then',
	'else',
	'contains'
]);

interface SchemaError {
	keyword: string;
	instanceLocation: string;
	error: string;
}

function leafErrors(errors: SchemaError[]): Problem[] {
	const seen = new Set<string>();
	const problems: Problem[] = [];
	const add = (path: string, message: string) => {
		const key = `${path}\n${message}`;
		if (seen.has(key)) return;
		seen.add(key);
		problems.push({ path, message });
	};
	for (const e of errors) {
		if (WRAPPERS.has(e.keyword) || e.keyword === 'false') continue;
		// A missing field is reported where the field would be, not on its parent.
		const missing = e.keyword === 'required' ? /"(.*)"/.exec(e.error)?.[1] : undefined;
		const pointer = missing
			? `${e.instanceLocation.replace(/\/$/, '')}/${encodeURIComponent(missing)}`
			: e.instanceLocation;
		add(toPath(pointer), plain(e));
	}
	// `additionalProperties: false` also fails a known property whose value is
	// invalid, so "not allowed" is only reported where nothing at or inside the
	// property explains it.
	const explained = problems.map((p) => p.path);
	const within = (path: string, inner: string) =>
		inner === path || inner.startsWith(`${path}.`) || inner.startsWith(`${path}[`);
	for (const e of errors) {
		if (e.keyword !== 'false') continue;
		const path = toPath(e.instanceLocation);
		if (!explained.some((inner) => within(path, inner))) {
			add(path, 'is not a field this file can have');
		}
	}
	// A `not` failure has no leaf beneath it; keep it rather than report nothing.
	if (problems.length === 0) {
		for (const e of errors) problems.push({ path: toPath(e.instanceLocation), message: plain(e) });
	}
	return problems;
}

const TYPES: Record<string, string> = {
	string: 'text',
	integer: 'a whole number',
	number: 'a number',
	boolean: 'yes or no',
	array: 'a list',
	object: 'a group of fields',
	null: 'empty'
};

/**
 * The validator's message, reworded for a teacher. The validator's own words
 * ("String is too short (0 < 1)") name JSON, not the form, so each keyword the
 * schemas use gets a sentence; anything else keeps the validator's message.
 */
function plain(e: SchemaError): string {
	const numbers = [...e.error.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
	const limit = numbers[numbers.length - 1];
	switch (e.keyword) {
		case 'required':
			return 'is missing';
		case 'minLength':
			return limit === 1 ? 'is empty' : `needs at least ${limit} characters`;
		case 'maxLength':
			return `is too long (at most ${limit} characters)`;
		case 'minItems':
			return limit === 1 ? 'needs at least one entry' : `needs at least ${limit} entries`;
		case 'maxItems':
			return `has too many entries (at most ${limit})`;
		case 'minimum':
			return `must be at least ${limit}`;
		case 'exclusiveMinimum':
			return `must be more than ${limit}`;
		case 'maximum':
			return `must be at most ${limit}`;
		case 'exclusiveMaximum':
			return `must be less than ${limit}`;
		case 'type': {
			const expected = [...e.error.matchAll(/"(\w+)"/g)].slice(1).map((m) => TYPES[m[1]!] ?? m[1]);
			return expected.length ? `must be ${expected.join(' or ')}` : e.error;
		}
		case 'enum':
		case 'const':
			return 'is not one of the allowed choices';
		case 'pattern':
		case 'format':
			return 'is not in the expected form';
		case 'uniqueItems':
			return 'has the same entry twice';
		default:
			return e.error;
	}
}

/** `#/sections/2/duration_minutes` -> `sections[2].duration_minutes` */
export function toPath(pointer: string): string {
	const parts = pointer.replace(/^#\/?/, '').split('/').filter(Boolean);
	let out = '';
	for (const raw of parts) {
		const part = decodeURIComponent(raw).replace(/~1/g, '/').replace(/~0/g, '~');
		out += /^\d+$/.test(part) ? `[${part}]` : out ? `.${part}` : part;
	}
	return out;
}
