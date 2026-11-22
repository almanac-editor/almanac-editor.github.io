/**
 * Searching lesson plans for words: where a topic was taught, or is going to
 * be. Plain functions over plans already read; the search page decides which
 * plans (a unit's, a class's year, a subject's) and reads them.
 *
 * A plan matches when every word of the query appears somewhere in it, in any
 * field or its content file, at the start of a word ("test" finds
 * "testing", not "quietest"). Each place a word appears is returned with the
 * text around it, so the teacher sees why it matched. Case and accents are
 * ignored ("galileo" finds "Galileo", "naive" finds "naïve"). Words in double
 * quotes are found together as a phrase.
 */

import { DIFFERENTIATION_LABELS } from './lessonView.ts';
import type { Lesson } from './types.ts';

/** One piece of a plan's text and where in the plan it sits. */
export interface Field {
	/** Where it is, in the editor's words: "Run sheet · Retrieval", "Success criteria". */
	where: string;
	text: string;
}

/** A piece of text to draw, with the matched words marked. */
export interface Part {
	text: string;
	hit: boolean;
}

export interface FieldHit {
	where: string;
	parts: Part[];
}

/** A letter or digit: a match must not follow one. */
const WORD = /[\p{L}\p{N}]/u;

/** How much text to keep either side of the first match in a field. */
const AROUND = 90;

/**
 * Every piece of text in a plan, in the order the lesson page shows it, then
 * the content file's paragraphs, then what a class did differently
 * (`deviations`, from a delivery record).
 */
export function planFields(
	plan: Lesson,
	content: string | null = null,
	deviations: string[] = []
): Field[] {
	const out: Field[] = [];
	const add = (where: string, text: unknown) => {
		if (typeof text === 'string' && text.trim()) out.push({ where, text });
	};
	add('Title', plan.title);
	add('Description', plan.description);
	add('Summary', plan.summary);
	for (const s of plan.sections ?? []) {
		add(s.label ? `Run sheet · ${s.label}` : 'Run sheet', s.label);
		add(s.label ? `Run sheet · ${s.label}` : 'Run sheet', s.section);
	}
	for (const li of plan.learning_intentions ?? []) add('Learning intentions', li);
	for (const sc of plan.success_criteria ?? []) add('Success criteria', sc);
	for (const c of plan.curriculum_links ?? []) add(`Syllabus · ${c.id}`, c.note);
	add('Assessment', plan.assessment?.formative);
	for (const e of plan.assessment?.evidence ?? []) add('Assessment evidence', e);
	for (const [key, label] of Object.entries(DIFFERENTIATION_LABELS)) {
		add(
			`Differentiation · ${label}`,
			plan.differentiation?.[key as keyof typeof DIFFERENTIATION_LABELS]
		);
	}
	for (const r of plan.resources ?? []) {
		add('Resources', r.name);
		add(`Resources · ${r.name}`, r.notes);
	}
	for (const r of plan.references ?? []) {
		add('References', r.citation);
		add('References', r.used_for);
	}
	if (content) out.push(...contentFields(content));
	for (const d of deviations) add('What this class did differently', d);
	return out;
}

/**
 * A content file as paragraphs, each placed under the heading above it.
 * Markdown marks are left in: the teacher wrote them, and the snippet is
 * plain text, never rendered.
 */
export function contentFields(markdown: string): Field[] {
	const out: Field[] = [];
	let heading = '';
	for (const block of markdown.split(/\n\s*\n/)) {
		const lines = block.split('\n');
		const body: string[] = [];
		for (const line of lines) {
			const h = line.match(/^#{1,6}\s+(.*)$/);
			if (h) {
				heading = h[1].trim();
				out.push({ where: `Content · ${heading}`, text: heading });
			} else body.push(line);
		}
		const text = body.join('\n').trim();
		if (text) out.push({ where: heading ? `Content · ${heading}` : 'Content', text });
	}
	return out;
}

/** The query as the terms to find: words, or "quoted phrases", folded. Empty for a blank query. */
export function terms(query: string): string[] {
	const out: string[] = [];
	for (const m of query.matchAll(/"([^"]*)"?|(\S+)/g)) {
		const term = fold(m[1] ?? m[2] ?? '')
			.trim()
			.replace(/\s+/g, ' ');
		if (term && !out.includes(term)) out.push(term);
	}
	return out;
}

/**
 * The fields that hold any of the terms, with the matches marked, or null
 * when some term appears nowhere in the plan.
 */
export function matchFields(fields: Field[], query: string[]): FieldHit[] | null {
	if (!query.length) return null;
	const folded = fields.map((f) => foldWithMap(f.text));
	const found = new Set<string>();
	const hits: FieldHit[] = [];
	for (const [i, field] of fields.entries()) {
		const ranges = rangesOf(folded[i], query, found);
		if (ranges.length) hits.push({ where: field.where, parts: snippet(field.text, ranges) });
	}
	return query.every((t) => found.has(t)) ? hits : null;
}

/** Hits in the same place with the same text, kept once: a run sheet label is also its heading. */
export function dedupe(hits: FieldHit[]): FieldHit[] {
	const seen = new Set<string>();
	return hits.filter((h) => {
		const key = h.where + '\u0000' + h.parts.map((p) => p.text).join('');
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

/** Lower case with accents removed, one character in for one character out where possible. */
function fold(text: string): string {
	return foldWithMap(text).text;
}

/**
 * The folded text and, for each of its characters, the index in the original
 * it came from, so a match in the folded text marks the right original letters.
 */
function foldWithMap(text: string): { text: string; at: number[] } {
	let out = '';
	const at: number[] = [];
	let i = 0;
	for (const ch of text) {
		const f = ch.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
		for (const c of f) {
			out += c;
			at.push(i);
		}
		i += ch.length;
	}
	at.push(i);
	return { text: out, at };
}

/** Where each term appears in the original text, merged and in order. */
function rangesOf(
	folded: { text: string; at: number[] },
	query: string[],
	found: Set<string>
): [number, number][] {
	const ranges: [number, number][] = [];
	for (const term of query) {
		let from = 0;
		for (;;) {
			const i = folded.text.indexOf(term, from);
			if (i === -1) break;
			from = i + 1;
			// From the start of a word: "test" finds "testing", not "quietest".
			if (i > 0 && WORD.test(folded.text[i - 1])) continue;
			found.add(term);
			ranges.push([folded.at[i], folded.at[i + term.length]]);
		}
	}
	ranges.sort((a, b) => a[0] - b[0]);
	const merged: [number, number][] = [];
	for (const r of ranges) {
		const last = merged.at(-1);
		if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
		else merged.push([...r]);
	}
	return merged;
}

/** The text around the matches, cut at word boundaries, with "…" where it was cut. */
function snippet(text: string, ranges: [number, number][]): Part[] {
	const flat = text.replace(/\s+/g, ' ');
	// Collapsing whitespace moves indices; map them across.
	const shift: number[] = [];
	let j = 0;
	for (let i = 0; i < text.length; i++) {
		shift.push(j);
		if (!(/\s/.test(text[i]) && i > 0 && /\s/.test(text[i - 1]))) j++;
	}
	shift.push(j);
	const rs = ranges.map(([a, b]) => [shift[a], shift[b]] as [number, number]);

	let start = Math.max(0, rs[0][0] - AROUND);
	let end = Math.min(flat.length, rs.at(-1)![1] + AROUND);
	if (end - start > AROUND * 4) end = Math.min(flat.length, rs[0][1] + AROUND * 2);
	if (start > 0) {
		const space = flat.indexOf(' ', start);
		if (space !== -1 && space < rs[0][0]) start = space + 1;
	}
	if (end < flat.length) {
		const space = flat.lastIndexOf(' ', end);
		const lastInside = rs.filter(([a]) => a < end).at(-1);
		if (space > (lastInside?.[1] ?? 0)) end = space;
	}

	const parts: Part[] = [];
	const push = (t: string, hit: boolean) => {
		if (t) parts.push({ text: t, hit });
	};
	let pos = start;
	if (start > 0) push('…', false);
	for (const [a, b] of rs) {
		if (a >= end) break;
		push(flat.slice(pos, Math.max(pos, a)), false);
		push(flat.slice(Math.max(pos, a), Math.min(b, end)), true);
		pos = Math.min(b, end);
	}
	push(flat.slice(pos, end), false);
	if (end < flat.length) push('…', false);
	// Join a leading "…" to the text after it, so it reads as one piece.
	return parts.reduce<Part[]>((acc, p) => {
		const last = acc.at(-1);
		if (last && !last.hit && !p.hit) last.text += p.text;
		else acc.push({ ...p });
		return acc;
	}, []);
}

/**
 * Runs `fn` over `items` with at most `limit` running at once, keeping order.
 * A folder reads files from the disk, and GitHub asks for no more than a
 * handful of requests at a time, so neither is flooded.
 */
export async function mapLimit<T, R>(
	items: T[],
	limit: number,
	fn: (item: T, index: number) => Promise<R>,
	onDone?: (done: number) => void
): Promise<R[]> {
	const out = new Array<R>(items.length);
	let next = 0;
	let done = 0;
	const worker = async () => {
		while (next < items.length) {
			const i = next++;
			out[i] = await fn(items[i], i);
			onDone?.(++done);
		}
	};
	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
	return out;
}
