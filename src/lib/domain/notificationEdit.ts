/**
 * An assessment notification as an editable draft: its subject line, its
 * title and details, its sections and its teacher notes, with Marking
 * criteria as parts, criteria and mark ranges. The conventions are the ones
 * `render_notification.py` in the data repo reads (see notification.ts):
 *
 *   `# ...`              the year and subject line
 *   `## Assessment: X`   the title, then the details table
 *   every later `##`     a section
 *   a second `#`         the teacher notes, never issued
 *
 * and, inside `## Marking criteria`, what every real notification writes:
 *
 *   ### Part 1: Survey (5 marks, at home)
 *
 *   EC-12-02 explains ...            outcome lines and any other text
 *
 *   **Structured dataset (5 marks)**  a criterion, when a part has several
 *
 *   | Marks | Criteria |
 *   |---|---|
 *   | 5 | ... |                       its mark ranges
 *
 * Every piece keeps the exact text it came from until it is edited, so an
 * untouched draft gives back the same bytes. An edited piece is written in
 * the form above. A part that does not read back exactly in that form stays
 * plain text, so nothing is lost.
 */

export type Half = 'issued' | 'teacher';

export interface TextBody {
	kind: 'text';
	/** The body without the blank lines (and closing `---`) around it. */
	text: string;
	/** The body this came from, blank lines included; absent for a new one. */
	__raw?: string;
}

export interface DetailRow {
	label: string;
	value: string;
	/** The table row this came from; absent for a new one. */
	__raw?: string;
}

export interface DetailsBody {
	kind: 'details';
	/** Text between the title and the table, kept as written. */
	before: string;
	/** The table's header and separator lines; empty when there is no table yet. */
	head: string;
	rows: DetailRow[];
	/** Text after the table: a preface, the closing `---`. */
	after: TextBody;
}

export interface MarkRange {
	marks: string;
	text: string;
}

export interface Criterion {
	/** Null for a part's one unnamed criterion. */
	name: string | null;
	marks: number | null;
	/** The table's header and separator lines. */
	head: string;
	ranges: MarkRange[];
}

export interface Part {
	kind: 'part';
	/** "Part 1" */
	label: string;
	name: string;
	marks: number | null;
	/** "at home", "in class"; may be empty. */
	where: string;
	/** Outcome lines and any text before the first criterion. */
	intro: string;
	criteria: Criterion[];
	/** Blank lines (and a closing `---`) after the part, kept as written. */
	__trail: string;
	/** The part's number when the file was opened, to tell a part that moved or was renumbered. */
	__at?: number;
	/** The part as loaded, to write back untouched; absent for a new one. */
	__raw?: string;
	__was?: string;
}

/** A part that does not read back in the house form: edited as text. */
export interface TextPart {
	kind: 'text-part';
	text: string;
	__raw?: string;
}

export interface CriteriaBody {
	kind: 'criteria';
	/** Text before the first part. */
	intro: TextBody;
	parts: (Part | TextPart)[];
}

/** The topics' rows live in assessmentEdit.ts; here they are opaque. */
export interface TopicsBody<R = unknown> {
	kind: 'topics';
	rows: R[];
}

export type Body<R = unknown> = TextBody | DetailsBody | CriteriaBody | TopicsBody<R>;

export interface Section<R = unknown> {
	/** Stable for the editor's keyed lists. */
	key: number;
	role: 'subject' | 'title' | 'section' | 'teacher';
	half: Half;
	level: 1 | 2;
	heading: string;
	/** The heading line this came from, terminator included; absent for a new one. */
	__line?: string;
	body: Body<R>;
}

export const TOPICS_SECTION = 'Assessable topics';
const CRITERIA = /^marking criteria$/i;

let keys = 0;
export const nextKey = () => ++keys;

/** Lines with their terminators, so joining them gives back the text. */
export function lines(text: string): string[] {
	return text.match(/[^\n]*\n|[^\n]+$/g) ?? [];
}

const isBlank = (line: string) => line.trim() === '';
const isRule = (line: string) => /^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line);

/** A body as text: its blank lines (and a closing rule) at either end kept aside. */
export function textBody(raw: string): TextBody {
	const { body } = edges(raw);
	return { kind: 'text', text: body, __raw: raw };
}

function edges(raw: string): { lead: string; body: string; trail: string } {
	const all = lines(raw);
	let start = 0;
	let end = all.length;
	while (start < end && isBlank(all[start])) start++;
	while (end > start && isBlank(all[end - 1])) end--;
	// A closing rule belongs to the gap between sections, not the text.
	if (end > start && isRule(all[end - 1])) {
		end--;
		while (end > start && isBlank(all[end - 1])) end--;
	}
	return {
		lead: all.slice(0, start).join(''),
		body: all
			.slice(start, end)
			.join('')
			.replace(/\r?\n$/, ''),
		trail: all.slice(end).join('')
	};
}

/** A text body written back: as loaded when untouched, else between the blank lines it had. */
export function textOut(body: TextBody, fallbackTrail = '\n'): string {
	const text = body.text.replace(/\r\n?/g, '\n').replace(/\s+$/, '');
	if (body.__raw !== undefined) {
		if (edges(body.__raw).body === body.text) return body.__raw;
		const { lead, trail } = edges(body.__raw);
		if (!text) return lead || trail;
		return `${lead || '\n'}${text}\n${trail || '\n'}`;
	}
	if (!text) return fallbackTrail;
	return `\n${text}\n${fallbackTrail}`;
}

/** The pieces of a notification: cut before each `#` and `##` heading line. */
function pieces(text: string): string[] {
	const out: string[] = [];
	let piece = '';
	for (const line of lines(text)) {
		if (/^#{1,2} /.test(line) && piece) {
			out.push(piece);
			piece = '';
		}
		piece += line;
	}
	if (piece) out.push(piece);
	return out;
}

function headingOf(line: string): { level: 1 | 2; text: string } | null {
	const m = /^(#{1,2}) (.*?)\s*$/.exec(line.replace(/\r?\n$/, ''));
	return m ? { level: m[1].length as 1 | 2, text: m[2] } : null;
}

export interface ReadNotification<R> {
	/** Text before the first heading. */
	lead: string;
	sections: Section<R>[];
}

/**
 * The notification as sections. `topics` turns the first `## Assessable
 * topics` section's body into rows (see assessmentEdit.ts).
 */
export function readSections<R>(text: string, topics: (body: string) => R[]): ReadNotification<R> {
	const all = pieces(text);
	let lead = '';
	if (all.length && !headingOf(lines(all[0])[0] ?? '')) lead = all.shift() ?? '';
	const sections: Section<R>[] = [];
	let tops = 0;
	let titled = false;
	let topicsTaken = false;
	for (const piece of all) {
		const [line, ...rest] = lines(piece);
		const h = headingOf(line);
		if (!h) continue;
		const raw = rest.join('');
		let role: Section['role'];
		let body: Body<R>;
		if (h.level === 1) {
			tops++;
			role = tops === 1 ? 'subject' : 'teacher';
			body = textBody(raw);
		} else if (!titled && tops < 2) {
			titled = true;
			role = 'title';
			body = readDetails(raw);
		} else {
			role = 'section';
			if (!topicsTaken && h.text === TOPICS_SECTION && line.startsWith(`## ${TOPICS_SECTION}`)) {
				topicsTaken = true;
				body = { kind: 'topics', rows: topics(raw) };
			} else if (CRITERIA.test(h.text)) {
				body = readCriteria(raw);
			} else {
				body = textBody(raw);
			}
		}
		sections.push({
			key: nextKey(),
			role,
			half: tops >= 2 ? 'teacher' : 'issued',
			level: h.level,
			heading: h.text,
			__line: line,
			body
		});
	}
	return { lead, sections };
}

/** The notification's text for the sections. */
export function writeSections<R>(
	lead: string,
	sections: Section<R>[],
	topics: (rows: R[]) => string
): string {
	let out = lead;
	sections.forEach((s, i) => {
		const line =
			s.__line !== undefined && headingOf(s.__line)?.text === s.heading
				? s.__line
				: `${'#'.repeat(s.level)} ${s.heading.trim()}\n`;
		if (out && !out.endsWith('\n')) out += '\n';
		out += line + bodyOut(s.body, trailFor(sections, i), topics);
	});
	return out;
}

/** What a new section's text ends with: the gap the nearest section in the same half uses. */
function trailFor(sections: Section<unknown>[], i: number): string {
	const gap = (s: Section<unknown> | undefined) =>
		s &&
		s.half === sections[i].half &&
		s.role === 'section' &&
		s.body.kind === 'text' &&
		s.body.__raw !== undefined
			? edges(s.body.__raw).trail || '\n'
			: null;
	for (let d = 1; d < sections.length; d++) {
		const found = gap(sections[i - d]) ?? gap(sections[i + d]);
		if (found) return found;
	}
	return '\n';
}

function bodyOut<R>(body: Body<R>, trail: string, topics: (rows: R[]) => string): string {
	switch (body.kind) {
		case 'text':
			return textOut(body, trail);
		case 'topics':
			return topics(body.rows);
		case 'details':
			return detailsOut(body);
		case 'criteria':
			return textOut(body.intro, '\n') + body.parts.map(partOut).join('');
	}
}

/* Details: the table after the title. */

function cells(row: string): string[] {
	const inner = row.trim().replace(/^\|/, '').replace(/\|$/, '');
	return inner.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
}

const escapeCell = (text: string) =>
	text
		.replace(/\|/g, '\\|')
		.replace(/\s*\n\s*/g, ' ')
		.trim();

function readDetails(raw: string): DetailsBody {
	const all = lines(raw);
	const start = all.findIndex((l) => l.trimStart().startsWith('|'));
	if (start === -1) {
		return { kind: 'details', before: '', head: '', rows: [], after: textBody(raw) };
	}
	let end = start;
	while (end < all.length && all[end].trimStart().startsWith('|')) end++;
	const table = all.slice(start, end);
	const head = table.slice(0, 2).join('');
	const rows = table.slice(2).map((line) => {
		const [label = '', ...rest] = cells(line);
		return { label: label.replace(/^\*\*(.*)\*\*$/, '$1'), value: rest.join(' | '), __raw: line };
	});
	return {
		kind: 'details',
		before: all.slice(0, start).join(''),
		head,
		rows,
		after: textBody(all.slice(end).join(''))
	};
}

function rowOut(row: DetailRow): string {
	if (row.__raw !== undefined) {
		const [label = '', ...rest] = cells(row.__raw);
		if (label.replace(/^\*\*(.*)\*\*$/, '$1') === row.label && rest.join(' | ') === row.value) {
			return row.__raw;
		}
	}
	return `| **${escapeCell(row.label)}** | ${escapeCell(row.value)} |\n`;
}

function detailsOut(body: DetailsBody): string {
	const rows = body.rows.filter((r) => r.__raw !== undefined || r.label.trim() || r.value.trim());
	if (!rows.length && !body.head) return body.before + textOut(body.after, '\n');
	const head = body.head || '| | |\n|---|---|\n';
	const before = body.head ? body.before : body.before || '\n';
	return before + head + rows.map(rowOut).join('') + textOut(body.after, '\n');
}

/* Marking criteria: parts, criteria and mark ranges. */

const PART = /^### (Parts? [^:]+?):\s*(.*?)\s*\((\d+) marks?(?:,\s*(.*?))?\)\s*$/;
const CRITERION = /^\*\*(.+?)\s*\((\d+) marks?\)\*\*\s*$/;

function readCriteria(raw: string): CriteriaBody {
	const chunks: string[] = [];
	let chunk = '';
	for (const line of lines(raw)) {
		if (line.startsWith('### ') && (chunk || chunks.length)) {
			chunks.push(chunk);
			chunk = '';
		}
		chunk += line;
	}
	chunks.push(chunk);
	const intro = chunks[0]?.startsWith('### ') ? '' : (chunks.shift() ?? '');
	return {
		kind: 'criteria',
		intro: textBody(intro),
		parts: chunks.map(
			(c) => readPart(c) ?? { kind: 'text-part', text: c.replace(/\s+$/, ''), __raw: c }
		)
	};
}

/** A part in the house form, or null when it would not read back exactly. */
export function readPart(raw: string): Part | null {
	const all = lines(raw);
	const m = PART.exec((all[0] ?? '').replace(/\r?\n$/, ''));
	if (!m) return null;
	let end = all.length;
	while (end > 1 && (isBlank(all[end - 1]) || isRule(all[end - 1]))) end--;
	const trail = all.slice(end).join('');
	const body = all.slice(1, end);
	const criteria: Criterion[] = [];
	const intro: string[] = [];
	let pending: { name: string; marks: number } | null = null;
	let i = 0;
	while (i < body.length) {
		const line = body[i].replace(/\r?\n$/, '');
		const c = CRITERION.exec(line);
		if (c) {
			if (pending) return null;
			pending = { name: c[1], marks: Number(c[2]) };
			i++;
			continue;
		}
		if (line.trimStart().startsWith('|')) {
			let j = i;
			while (j < body.length && body[j].trimStart().startsWith('|')) j++;
			const table = body.slice(i, j);
			if (table.length < 2) return null;
			criteria.push({
				name: pending?.name ?? null,
				marks: pending?.marks ?? null,
				head: table.slice(0, 2).join('').replace(/\n?$/, '\n'),
				ranges: table.slice(2).map((row) => {
					const [marks = '', text = '', ...more] = cells(row);
					return { marks, text: more.length ? [text, ...more].join(' | ') : text };
				})
			});
			pending = null;
			i = j;
			continue;
		}
		if (pending || criteria.length) {
			if (!isBlank(line)) return null;
		} else {
			intro.push(body[i]);
		}
		i++;
	}
	if (pending) return null;
	const part: Part = {
		kind: 'part',
		label: m[1],
		name: m[2],
		marks: Number(m[3]),
		where: m[4] ?? '',
		intro: intro.join('').trim(),
		criteria,
		__trail: trail
	};
	if (partText(part) !== raw) return null;
	part.__raw = raw;
	part.__at = Number(/\d+/.exec(part.label)?.[0]) || undefined;
	part.__was = JSON.stringify(strip(part));
	return part;
}

function strip(part: Part) {
	return [part.label, part.name, part.marks, part.where, part.intro, part.criteria];
}

const plural = (n: number | null) => `${n ?? ''} mark${n === 1 ? '' : 's'}`;

/** A part in the house form. */
export function partText(part: Part): string {
	const where = part.where.trim() ? `, ${part.where.trim()}` : '';
	let out = `### ${part.label.trim()}: ${part.name.trim()} (${plural(part.marks)}${where})\n\n`;
	const intro = part.intro.replace(/\r\n?/g, '\n').trim();
	if (intro) out += `${intro}\n\n`;
	part.criteria.forEach((c, i) => {
		if (i > 0) out += '\n';
		if (c.name !== null) out += `**${c.name.trim()} (${plural(c.marks)})**\n\n`;
		out += c.head || '| Marks | Criteria |\n|---|---|\n';
		for (const r of c.ranges) out += `| ${escapeCell(r.marks)} | ${escapeCell(r.text)} |\n`;
	});
	return out + (part.__trail || '\n');
}

function partOut(part: Part | TextPart): string {
	if (part.kind === 'text-part') {
		if (part.__raw !== undefined && part.__raw.replace(/\s+$/, '') === part.text) return part.__raw;
		const text = part.text.replace(/\r\n?/g, '\n').replace(/\s+$/, '');
		return text ? `${text}\n\n` : '';
	}
	if (part.__raw !== undefined && JSON.stringify(strip(part)) === part.__was) return part.__raw;
	return partText(part);
}

export function blankPart(n: number): Part {
	return {
		kind: 'part',
		label: `Part ${n}`,
		name: '',
		marks: null,
		where: '',
		intro: '',
		criteria: [blankCriterion(null)],
		__trail: '\n'
	};
}

export function blankCriterion(name: string | null): Criterion {
	return {
		name,
		marks: null,
		head: '| Marks | Criteria |\n|---|---|\n',
		ranges: [{ marks: '', text: '' }]
	};
}

/** A part's criteria marks add up to, or null where a criterion has none. */
export function criteriaMarks(part: Part): number | null {
	if (part.criteria.length === 1 && part.criteria[0].name === null) return part.marks;
	let sum = 0;
	for (const c of part.criteria) {
		if (c.marks === null) return null;
		sum += c.marks;
	}
	return sum;
}

/** The top of a mark range: "10-9" -> 10, "1-0" -> 1. */
export function topMark(range: string): number | null {
	const m = /^\s*(\d+)/.exec(range);
	return m ? Number(m[1]) : null;
}

/** The leading number of a detail's value: "40 (25 in class…)" -> 40. */
export function leadNumber(value: string): number | null {
	const m = /^\s*(\d+)\b/.exec(value);
	return m ? Number(m[1]) : null;
}

/** What doesn't add up in Marking criteria, in plain words. */
export function marksProblems(body: CriteriaBody, totalMarks: number | null): string[] {
	const problems: string[] = [];
	let total = 0;
	let known = true;
	for (const part of body.parts) {
		if (part.kind !== 'part') {
			known = false;
			continue;
		}
		const name = `${part.label}${part.name ? ` (${part.name})` : ''}`;
		if (part.marks === null) {
			known = false;
			continue;
		}
		total += part.marks;
		const sum = criteriaMarks(part);
		if (sum !== null && sum !== part.marks) {
			problems.push(`${name} is worth ${part.marks} marks, but its criteria add up to ${sum}.`);
		}
		for (const c of part.criteria) {
			const top = Math.max(...c.ranges.map((r) => topMark(r.marks) ?? 0));
			const worth = c.name === null ? part.marks : c.marks;
			if (worth !== null && c.ranges.length && top !== worth) {
				problems.push(`${c.name ?? name}'s top mark range is ${top}, but it is worth ${worth}.`);
			}
		}
	}
	if (known && totalMarks !== null && body.parts.length && total !== totalMarks) {
		problems.push(`The parts add up to ${total} marks, but Marks says ${totalMarks}.`);
	}
	return problems;
}
