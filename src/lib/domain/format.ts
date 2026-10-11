/**
 * The data repo's house JSON format.
 *
 * Python writes every source file with
 * `json.dumps(doc, indent=2, ensure_ascii=False) + "\n"`. For the values these
 * files hold (strings, integers, booleans, null, arrays, objects), JavaScript's
 * `JSON.stringify(doc, null, 2)` produces the same bytes: two-space indent,
 * `": "` after keys, non-ASCII written literally, `[]` and `{}` for empties.
 *
 * The one known divergence is floats with no fractional part: Python writes
 * `1.0`, JavaScript writes `1`, and after parsing the two can't be told apart.
 * The one number field (a task's `weight`) holds whole numbers, so `dump`
 * refuses a non-integer number rather than guessing.
 */

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type JsonObject = { [key: string]: Json };

export function dump(doc: unknown): string {
	assertIntegers(doc, '');
	return JSON.stringify(doc, null, 2) + '\n';
}

function assertIntegers(value: unknown, path: string): void {
	if (typeof value === 'number') {
		if (!Number.isInteger(value)) {
			throw new Error(`${path || 'value'} is ${value}; the house format has integers only`);
		}
	} else if (Array.isArray(value)) {
		value.forEach((item, i) => assertIntegers(item, `${path}[${i}]`));
	} else if (value !== null && typeof value === 'object') {
		for (const [key, item] of Object.entries(value)) {
			assertIntegers(item, path ? `${path}.${key}` : key);
		}
	}
}

/** Text as it arrives from a form field, with Windows line endings made plain. */
export function normaliseText(text: string): string {
	return text.replace(/\r\n?/g, '\n');
}
