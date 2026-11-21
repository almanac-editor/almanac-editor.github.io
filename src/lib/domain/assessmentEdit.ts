/**
 * Editing an assessment task: its notification (see notificationEdit.ts) and
 * its spec together, so the two never drift apart. A spec's `topics[].text`
 * must match, line for line, the bullets under the notification's
 * `## Assessable topics` (the data repo's `tests/test_assessment_specs.py`),
 * so a topic line is edited once, in that section, and a save writes both
 * files.
 *
 * In the Assessable topics section each `- ` bullet is a topic row, and every
 * run of other lines (an intro, unit and phase headings) is a text row, kept
 * as written.
 *
 * Saving an untouched draft gives back both files byte for byte. Before
 * anything is written, the notification is read back: its sections must be
 * the draft's, and its topic lines the spec's. A draft that would not read
 * back that way is refused.
 */

import { assessmentPath, topicLines, type AssessmentSpec, type Topic } from './assessments.ts';
import { normaliseText } from './format.ts';
import { EditError, keysOf, ordered, setField } from './lessonEdit.ts';
import {
	TOPICS_SECTION,
	lines,
	nextKey,
	readSections,
	writeSections,
	type Part,
	type Section
} from './notificationEdit.ts';
import { joinBlocks, partsColumns, readBlocks } from './textBlocks.ts';
import type { Offering } from './types.ts';

export interface TopicRow {
	kind: 'topic';
	text: string;
	unit: string;
	phase: string;
	ids: string[];
	note: string;
	/** The bullet line this row came from, terminator included; absent for a new one. */
	__line?: string;
	/** The spec's topic this row came from; absent for a new one. */
	__from?: Topic;
}

export interface TextRow {
	kind: 'text';
	/** The lines between two topics, without the blank lines around them. */
	text: string;
	/** The lines this row came from, blank lines included; absent for a new one. */
	__raw?: string;
}

export type Row = TopicRow | TextRow;

export type TaskSection = Section<Row>;

export interface AssessmentDraft {
	/** The spec's title. */
	title: string;
	/** Whether the spec's title follows the notification's, as it did when loaded. */
	syncTitle: boolean;
	units: string[];
	/** Text before the notification's first heading. */
	lead: string;
	sections: TaskSection[];
	/** The spec as loaded; null for a new one. */
	__spec: AssessmentSpec | null;
}

export const SPEC_ORDER = ['offering', 'title', 'notification', 'klunk', 'units', 'topics'];
const TOPIC_ORDER = ['text', 'unit', 'phase', 'ids', 'note'];

/** A file stem a new spec may have: what the data repo's own names use. */
export const STEM = /^[a-z0-9_]+$/;

const isBullet = (line: string) => line.startsWith('- ');
const isBlank = (line: string) => line.trim() === '';

/** The bullet's text as the data repo reads it. */
function bulletText(line: string): string {
	return line
		.replace(/\r?\n$/, '')
		.slice(2)
		.trim();
}

/** A run of non-bullet lines as a text row: its blank lines at either end kept aside. */
function textRow(raw: string): TextRow {
	const all = lines(raw);
	let start = 0;
	let end = all.length;
	while (start < end && isBlank(all[start])) start++;
	while (end > start && isBlank(all[end - 1])) end--;
	return {
		kind: 'text',
		text: all
			.slice(start, end)
			.join('')
			.replace(/\r?\n$/, ''),
		__raw: raw
	};
}

type Raw = TextRow | { kind: 'bullet'; line: string };

/** A topics section's body as rows: each bullet a topic, each run of other lines one text row. */
function bodyRows(body: string): Raw[] {
	const rows: Raw[] = [];
	let run = '';
	for (const line of lines(body)) {
		if (isBullet(line)) {
			if (run) rows.push(textRow(run));
			run = '';
			rows.push({ kind: 'bullet', line });
		} else {
			run += line;
		}
	}
	if (run) rows.push(textRow(run));
	return rows;
}

function topicRow(topic: Topic | undefined, line?: string): TopicRow {
	return {
		kind: 'topic',
		text: line !== undefined ? bulletText(line) : (topic?.text ?? ''),
		unit: topic?.unit ?? '',
		phase: topic?.phase ?? '',
		ids: [...(topic?.ids ?? [])],
		note: topic?.note ?? '',
		...(line !== undefined ? { __line: line } : {}),
		...(topic ? { __from: topic } : {})
	};
}

/** The title section's heading split at its first colon: "Assessment Task 2" and the title. */
export function titleParts(heading: string): { prefix: string; name: string } {
	const at = heading.indexOf(':');
	return at === -1
		? { prefix: '', name: heading }
		: { prefix: heading.slice(0, at), name: heading.slice(at + 1).trim() };
}

export function joinTitle(prefix: string, name: string): string {
	return prefix.trim() ? `${prefix.trim()}: ${name}` : name;
}

export interface Loaded {
	draft: AssessmentDraft;
	/** Where the two files disagreed and what the draft took, in plain words. */
	notes: string[];
}

/**
 * The draft for a spec and its notification's text. Where the two disagree,
 * the notification's wording wins, since it is what students got; a topic
 * the spec has beyond the notification's bullets is added after the last
 * one, and a bullet beyond the spec's topics becomes a topic with no unit.
 * A notification with no Assessable topics gets the section at its end.
 */
export function toAssessmentDraft(spec: AssessmentSpec, notification: string): Loaded {
	const notes: string[] = [];
	const read = readSections<Raw>(notification, bodyRows);
	const sections = read.sections as unknown as TaskSection[];
	let topics = sections.find((s) => s.body.kind === 'topics');
	let raws: Raw[];
	if (topics) {
		raws = (topics.body as unknown as { rows: Raw[] }).rows;
	} else {
		raws = [textRow('\n')];
		topics = {
			key: nextKey(),
			role: 'section',
			half: sections.at(-1)?.half ?? 'issued',
			level: 2,
			heading: TOPICS_SECTION,
			body: { kind: 'topics', rows: [] }
		};
		sections.push(topics);
		notes.push(
			`The notification has no “${TOPICS_SECTION}” section. Saving adds one at its end, with the spec’s topics.`
		);
	}
	const rows: Row[] = [];
	let n = 0;
	const differ: number[] = [];
	for (const row of raws) {
		if (row.kind === 'text') {
			rows.push(row);
			continue;
		}
		const topic = spec.topics[n];
		const made = topicRow(topic, row.line);
		if (topic && topic.text !== made.text) differ.push(n + 1);
		rows.push(made);
		n++;
	}
	if (differ.length) {
		notes.push(
			`${differ.length === 1 ? 'Topic' : 'Topics'} ${list(differ)} ${differ.length === 1 ? 'reads' : 'read'} differently in the two files. The editor took the notification’s wording, so saving changes the spec to match.`
		);
	}
	if (n < spec.topics.length) {
		const extra = spec.topics.slice(n);
		const last = rows.findLastIndex((r) => r.kind === 'topic');
		rows.splice(last === -1 ? rows.length : last + 1, 0, ...extra.map((t) => topicRow(t)));
		if (n > 0) {
			notes.push(
				`The spec has ${plural(extra.length, 'topic')} the notification doesn’t. ${extra.length === 1 ? 'It is' : 'They are'} added after the last bullet, so saving puts ${extra.length === 1 ? 'it' : 'them'} in the notification.`
			);
		}
	} else if (n > spec.topics.length) {
		const extra = n - spec.topics.length;
		notes.push(
			`The notification has ${plural(extra, 'topic line')} the spec doesn’t. Choose a unit, phase and dot points for ${extra === 1 ? 'it' : 'each'} before saving.`
		);
	}
	topics.body = { kind: 'topics', rows };
	const title = sections.find((s) => s.role === 'title');
	return {
		draft: {
			title: spec.title,
			syncTitle: !!title && titleParts(title.heading).name === spec.title,
			units: [...spec.units],
			lead: read.lead,
			sections,
			__spec: spec
		},
		notes
	};
}

function plural(n: number, word: string): string {
	return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function list(ns: number[]): string {
	if (ns.length === 1) return String(ns[0]);
	return `${ns.slice(0, -1).join(', ')} and ${ns.at(-1)}`;
}

/** A new topic row, starting from another's unit and phase. */
export function blankTopic(like?: Pick<TopicRow, 'unit' | 'phase'>): TopicRow {
	return {
		kind: 'topic',
		text: '',
		unit: like?.unit ?? '',
		phase: like?.phase ?? '',
		ids: [],
		note: ''
	};
}

export function blankText(): TextRow {
	return { kind: 'text', text: '' };
}

/** A new section, to go in `half`. */
export function blankSection(half: TaskSection['half']): TaskSection {
	return {
		key: nextKey(),
		role: 'section',
		half,
		level: 2,
		heading: '',
		body: { kind: 'text', text: '' }
	};
}

/** The teacher notes' opening heading, for a notification that has none yet. */
export function teacherDivider(): TaskSection {
	return {
		key: nextKey(),
		role: 'teacher',
		half: 'teacher',
		level: 1,
		heading: 'Teacher notes',
		body: { kind: 'text', text: 'Nothing below renders.' }
	};
}

/** Each section's half, from where it sits: after the teacher notes' heading, teacher. */
export function rehalve(sections: TaskSection[]): void {
	let teacher = false;
	for (const s of sections) {
		if (s.role === 'teacher') teacher = true;
		s.half = teacher ? 'teacher' : 'issued';
	}
}

/**
 * Moves the section at `i` past its neighbour and returns where it went. A
 * section can cross the teacher notes' heading, which moves it between the
 * halves, but never above the title.
 */
export function moveSection(sections: TaskSection[], i: number, by: -1 | 1): number {
	const j = i + by;
	if (sections[i]?.role !== 'section' || j < 0 || j >= sections.length) return i;
	if (sections[j].role === 'subject' || sections[j].role === 'title') return i;
	[sections[i], sections[j]] = [sections[j], sections[i]];
	rehalve(sections);
	return j;
}

/** The topics section's rows written back. */
function rowsOut(rows: Row[]): string {
	let out = '';
	for (const row of rows) {
		if (row.kind === 'topic') out += topicLine(row);
		else out += textRaw(row, out);
	}
	const last = rows.at(-1);
	if (last?.kind === 'topic' && last.__line === undefined) out += '\n';
	return out;
}

/** The notification's text for the draft. */
export function notificationText(draft: AssessmentDraft): string {
	return writeSections(draft.lead, draft.sections, rowsOut);
}

function topicLine(row: TopicRow): string {
	const text = cleanLine(row.text);
	if (row.__line !== undefined && bulletText(row.__line) === text) return row.__line;
	const end = row.__line?.endsWith('\r\n') ? '\r\n' : '\n';
	return `- ${text}${end}`;
}

/** A topic's text as one line: what the data repo will read back. */
function cleanLine(text: string): string {
	return text.replace(/\s*[\r\n]+\s*/g, ' ').trim();
}

function textRaw(row: TextRow, sofar: string): string {
	const body = normaliseText(row.text)
		.replace(/\s+$/, '')
		.replace(/^\s*\n/, '');
	if (row.__raw !== undefined) {
		const was = textRow(row.__raw);
		if (was.text === row.text) return row.__raw;
		const all = lines(row.__raw);
		const lead = all
			.slice(
				0,
				all.findIndex((l) => !isBlank(l))
			)
			.join('');
		const trail = all.slice(all.findLastIndex((l) => !isBlank(l)) + 1).join('');
		if (!body.trim()) return lead || trail ? '\n' : '';
		return `${lead}${body}\n${trail}`;
	}
	if (!body.trim()) return '';
	const gap = sofar === '' || sofar.endsWith('\n\n') ? '' : '\n';
	return `${gap}${body}\n\n`;
}

/** The draft's topic rows, wherever the topics section sits. */
export function topicRows(draft: AssessmentDraft): TopicRow[] {
	const section = draft.sections.find((s) => s.body.kind === 'topics');
	const rows = section?.body.kind === 'topics' ? section.body.rows : [];
	return rows.filter((r): r is TopicRow => r.kind === 'topic');
}

/** The spec for the draft, with untouched keys where the file had them. */
export function specFrom(
	draft: AssessmentDraft,
	fresh?: Pick<AssessmentSpec, 'offering' | 'notification'>
): AssessmentSpec {
	const source = draft.__spec ?? { ...fresh };
	const title = draft.__spec ? normaliseText(draft.title) : normaliseText(draft.title).trim();
	if (!title.trim()) throw new EditError('The task has no title.');
	if (!draft.units.length) throw new EditError('Choose at least one unit the task examines.');
	const topics = topicRows(draft);
	if (!topics.length) throw new EditError('Add at least one assessable topic.');
	const out: Record<string, unknown> = { ...source };
	out.title = title;
	out.units = [...new Set(draft.units)];
	out.topics = topics.map((row, i) => topicFrom(row, i + 1, draft.units));
	return ordered(out, keysOf(draft.__spec ?? undefined), SPEC_ORDER) as AssessmentSpec;
}

function topicFrom(row: TopicRow, n: number, units: string[]): Topic {
	const text = cleanLine(row.text);
	const name = text ? `“${text}”` : `Topic ${n}`;
	if (!text) throw new EditError(`Topic ${n} has no text.`);
	if (!row.unit) throw new EditError(`${name} has no unit.`);
	if (!units.includes(row.unit)) {
		throw new EditError(
			`${name} is in ${row.unit}, which is not among the units the task examines.`
		);
	}
	const phase = row.__from ? row.phase : row.phase.trim();
	if (!phase.trim()) throw new EditError(`${name} has no phase.`);
	const twice = row.ids.find((id, i) => row.ids.indexOf(id) !== i);
	if (twice) throw new EditError(`${name} links ${twice} twice.`);
	const source = row.__from ?? {};
	const item: Record<string, unknown> = { ...source };
	item.text = text;
	item.unit = row.unit;
	item.phase = phase;
	item.ids = [...row.ids];
	const note = row.__from ? normaliseText(row.note) : normaliseText(row.note).trim();
	setField(item, source, 'note', note, true);
	return ordered(item, keysOf(row.__from), TOPIC_ORDER) as Topic;
}

function checkPart(part: Part, section: string): void {
	const name = part.name.trim() ? `${part.label} (${part.name.trim()})` : part.label;
	if (!part.label.trim())
		throw new EditError(`A part in ${section} has no label, such as “Part 1”.`);
	if (!part.name.trim()) throw new EditError(`${part.label} in ${section} has no name.`);
	if (part.marks === null || !Number.isInteger(part.marks) || part.marks < 0) {
		throw new EditError(`${name} needs its marks as a whole number.`);
	}
	if (!part.criteria.length) throw new EditError(`${name} has no marking criteria.`);
	for (const c of part.criteria) {
		if (c.name !== null) {
			if (!c.name.trim()) throw new EditError(`A criterion in ${name} has no name.`);
			if (c.marks === null || !Number.isInteger(c.marks) || c.marks < 0) {
				throw new EditError(`${c.name} in ${name} needs its marks as a whole number.`);
			}
		}
		for (const r of c.ranges) {
			if (!r.marks.trim() && r.text.trim()) {
				throw new EditError(`A mark range in ${c.name ?? name} has criteria but no marks.`);
			}
		}
	}
}

/**
 * Both files for the draft, checked against each other the way the data
 * repo's test reads them. Throws EditError saying what to fix when a section
 * or a part is incomplete, or the notification would not read back as the
 * draft (a heading inside a section's text, topic lines that differ).
 */
export function fromAssessmentDraft(
	draft: AssessmentDraft,
	fresh?: Pick<AssessmentSpec, 'offering' | 'notification'>
): { spec: AssessmentSpec; notification: string } {
	for (const s of draft.sections) {
		if (!s.heading.trim() || (s.role === 'title' && !titleParts(s.heading).name.trim())) {
			throw new EditError(
				s.role === 'title' ? 'The task has no title.' : 'A section has no heading.'
			);
		}
		if (s.body.kind === 'criteria') {
			for (const p of s.body.parts) if (p.kind === 'part') checkPart(p, s.heading);
		}
		if (s.body.kind === 'topics') {
			for (const row of s.body.rows) {
				if (row.kind !== 'text') continue;
				for (const line of normaliseText(row.text).split('\n')) {
					if (isBullet(line)) {
						throw new EditError(
							`“${line}” among the topics starts with “- ”, which makes it a topic line. Add it as a topic instead.`
						);
					}
				}
			}
		}
	}
	const spec = specFrom(draft, fresh);
	const notification = notificationText(draft);
	const back = readSections<Raw>(notification, bodyRows).sections;
	const want = draft.sections.map((s) => `${s.level} ${s.heading.trim()}`);
	const got = back.map((s) => `${s.level} ${s.heading}`);
	const at = want.findIndex((h, i) => h !== got[i]);
	if (at !== -1 || want.length !== got.length) {
		const i = at === -1 ? Math.min(want.length, got.length) : at;
		const where = draft.sections[Math.max(0, i - 1)]?.heading.trim() || 'the text';
		throw new EditError(
			`A line in “${where}” starts with “#” or “##”, which would start a new section. Use “###” for a heading inside a section.`
		);
	}
	const read = topicLines(notification) ?? [];
	const texts = spec.topics.map((t) => t.text);
	const differ = texts.findIndex((t, i) => t !== read[i]);
	if (differ !== -1 || read.length !== texts.length) {
		const i = differ === -1 ? texts.length : differ;
		throw new EditError(
			`The notification would read topic ${i + 1} as “${read[i] ?? 'nothing'}” but the spec as “${texts[i] ?? 'nothing'}”. Check no text above the topics mentions “## ${TOPICS_SECTION}”.`
		);
	}
	return { spec, notification };
}

/** Where a new spec and its notification go. */
export function newAssessmentPaths(
	offeringPath: string,
	name: string
): { spec: string; notification: string } {
	const spec = assessmentPath(offeringPath, name);
	return { spec, notification: spec.replace(/\.json$/, '.md') };
}

/** What is wrong with a new spec's file stem, or null. */
export function stemProblem(
	name: string,
	taken: (path: string) => boolean,
	offeringPath: string
): string | null {
	if (!name) return 'Give the task a file name.';
	if (!STEM.test(name))
		return 'Use lower-case letters, digits and underscores only, e.g. task3_final_exam.';
	const paths = newAssessmentPaths(offeringPath, name);
	if (taken(paths.spec) || taken(paths.notification))
		return `${name} is already one of this class’s files.`;
	return null;
}

/**
 * A new task's draft: a starter notification with the headings the data
 * repo's renderer and test expect (`#` year and subject, `## Assessment: …`
 * with its details, `## Assessable topics`), a Task overview and Marking
 * criteria to write, and teacher notes.
 */
export function newAssessmentDraft(offering: Offering, subjectTitle: string): AssessmentDraft {
	const subject = [String(offering.year), offering.year_group, subjectTitle]
		.filter(Boolean)
		.join(' ');
	const starter = [
		`# ${subject}`,
		'',
		'## Assessment:',
		'',
		'| | |',
		'|---|---|',
		'| **Due** | |',
		'| **Weighting** | |',
		'| **Marks** | |',
		'| **Teacher** | |',
		'',
		'---',
		'',
		'## Task overview',
		'',
		'---',
		'',
		'## Marking criteria',
		'',
		'---',
		'',
		`## ${TOPICS_SECTION}`,
		'',
		'- ',
		'',
		'# Teacher notes',
		'',
		'Nothing below renders.',
		''
	].join('\n');
	const read = readSections<Raw>(starter, bodyRows);
	const sections = read.sections as unknown as TaskSection[];
	for (const s of sections) {
		if (s.body.kind === 'topics') {
			s.body = { kind: 'topics', rows: [textRow('\n'), blankTopic(), textRow('\n')] };
		}
	}
	return { title: '', syncTitle: true, units: [], lead: '', sections, __spec: null };
}

/** The units a class takes, as a spec names them (relative to its subject). */
export function classUnits(offering: Offering): string[] {
	return [...new Set(offering.units.map((u) => u.unit))];
}

/** A parts table's rows name each part once; one that repeats a part (a row per criterion) is skipped. */
export function partsTable(block: { head: string[]; rows: string[][] }) {
	const cols = partsColumns(block.head);
	if (!cols) return null;
	const seen = new Set<number>();
	for (const row of block.rows) {
		if (/total/i.test(row.join(' '))) continue;
		const n = Number(/\d+/.exec((row[cols.part] ?? '').replace(/[*_]/g, ''))?.[0]);
		if (!Number.isFinite(n)) continue;
		if (seen.has(n)) return null;
		seen.add(n);
	}
	return cols;
}

/** A section's body as it would be written, for drawing it closed. */
export function sectionText(section: TaskSection): string {
	const out = writeSections('', [section], rowsOut);
	return out.slice(out.indexOf('\n') + 1);
}

/**
 * Where a parts table (a Part and a Marks column, as Task overview has)
 * disagrees with Marking criteria, in plain words. Parts are matched by the
 * first number in the Part cell; a row that names a total is checked against
 * the parts' sum.
 */
export function overviewProblems(sections: TaskSection[]): string[] {
	const criteria = sections.find((s) => s.body.kind === 'criteria');
	if (criteria?.body.kind !== 'criteria') return [];
	const parts = criteria.body.parts.filter((p): p is Part => p.kind === 'part');
	if (!parts.length) return [];
	const byNumber = new Map(parts.map((p) => [Number(/\d+/.exec(p.label)?.[0]), p]));
	const total = parts.reduce((n, p) => n + (p.marks ?? 0), 0);
	const problems: string[] = [];
	for (const s of sections) {
		if (s.body.kind !== 'text') continue;
		for (const block of readBlocks(s.body.text)) {
			if (block.kind !== 'table') continue;
			const cols = partsTable(block);
			if (!cols) continue;
			for (const row of block.rows) {
				const label = (row[cols.part] ?? '').replace(/[*_]/g, '');
				const marks = Number(/\d+/.exec((row[cols.marks] ?? '').replace(/[*_]/g, ''))?.[0]);
				if (!Number.isFinite(marks)) continue;
				if (/total/i.test(row.join(' '))) {
					if (marks !== total) {
						problems.push(
							`${s.heading}’s table gives a total of ${marks} marks, but the parts add up to ${total}.`
						);
					}
					continue;
				}
				const n = Number(/\d+/.exec(label)?.[0]);
				const part = byNumber.get(n);
				if (part && part.marks !== null && part.marks !== marks) {
					problems.push(
						`${s.heading}’s table gives Part ${n} ${marks} marks, but Marking criteria gives it ${part.marks}.`
					);
				}
			}
		}
	}
	const marks = partMarks(sections);
	if (marks) {
		for (const s of sections) {
			if (s.body.kind !== 'text') continue;
			for (const block of readBlocks(s.body.text)) {
				if (block.kind !== 'heading') continue;
				const h = PART_HEADING.exec(block.text);
				if (!h || headingOwner(marks.list, Number(h[2]))) continue;
				const now = marks.list.find((p) => p.n === Number(h[2]));
				if (now && now.name === h[3].trim()) continue;
				problems.push(
					now
						? `${s.heading} has the heading “${block.text}”, but Part ${h[2]} is now ${now.name}. Change the heading, or move what’s under it.`
						: `${s.heading} has the heading “${block.text}”, but there is no Part ${h[2]} any more. Change the heading, or remove what’s under it.`
				);
			}
		}
	}
	const title = sections.find((s) => s.role === 'title');
	if (marks?.split && marks.total && title?.body.kind === 'details') {
		for (const row of title.body.rows) {
			if (!/^weighting$/i.test(row.label.trim())) continue;
			const all = Number(/^\s*(\d+(?:\.\d+)?)\s*%/.exec(row.value)?.[1]);
			const inClass = Number(/(\d+(?:\.\d+)?)\s*%\s+in class/i.exec(row.value)?.[1]);
			const atHome = Number(/(\d+(?:\.\d+)?)\s*%\s+at home/i.exec(row.value)?.[1]);
			if (![all, inClass, atHome].every(Number.isFinite)) continue;
			const want = (all * marks.split.inClass) / marks.total;
			if (Math.abs(want - inClass) > 0.5 || Math.abs(all - want - atHome) > 0.5) {
				const round = (x: number) => Math.round(x * 10) / 10;
				problems.push(
					`Weighting says ${inClass}% in class and ${atHome}% at home, but the marks are ${marks.split.inClass} in class and ${marks.split.atHome} at home, which would be ${round(want)}% and ${round(all - want)}%.`
				);
			}
		}
	}
	return problems;
}

/** One part as the other sections show it. `at` is its number when the file was opened. */
interface PartLine {
	n: number;
	name: string;
	where: string;
	marks: number | null;
	at: number | undefined;
}

/** The parts' marks, by part number, and their total when every part has marks. */
function partMarks(sections: TaskSection[]): {
	byNumber: Map<number, number>;
	names: Map<number, string>;
	wheres: Map<number, string>;
	list: PartLine[];
	total: number | null;
	split: { inClass: number; atHome: number } | null;
} | null {
	const criteria = sections.find((s) => s.body.kind === 'criteria');
	if (criteria?.body.kind !== 'criteria' || !criteria.body.parts.length) return null;
	const byNumber = new Map<number, number>();
	const names = new Map<number, string>();
	const wheres = new Map<number, string>();
	const list: PartLine[] = [];
	let total: number | null = 0;
	// Marks done in class and at home, when every part says which.
	let split: { inClass: number; atHome: number } | null = { inClass: 0, atHome: 0 };
	for (const p of criteria.body.parts) {
		if (p.kind !== 'part') {
			total = null;
			split = null;
			continue;
		}
		const n = Number(/\d+/.exec(p.label)?.[0]);
		list.push({ n, name: p.name.trim(), where: p.where.trim(), marks: p.marks, at: p.__at });
		if (Number.isFinite(n) && p.name.trim()) names.set(n, p.name.trim());
		if (Number.isFinite(n) && p.where.trim()) wheres.set(n, p.where.trim());
		if (p.marks === null) {
			total = null;
			split = null;
			continue;
		}
		if (Number.isFinite(n)) byNumber.set(n, p.marks);
		if (total !== null) total += p.marks;
		const where = p.where.trim().toLowerCase();
		if (split && where === 'in class') split.inClass += p.marks;
		else if (split && where === 'at home') split.atHome += p.marks;
		else split = null;
	}
	return { byNumber, names, wheres, list, total, split };
}

/** A parts table's Part cell: "1. Design brief", "**Part 2: Folio**": the lead, the number, the name, the close. */
const PART_CELL = /^(\s*(?:\*\*)?\s*(?:Part\s+)?(\d+)[.):]?\s*)(.*?)(\s*(?:\*\*)?\s*)$/;

/** The part a heading "Part N: …" belongs to: the part numbered N, if it still has the number it opened with. */
function headingOwner(list: PartLine[], n: number): PartLine | undefined {
	const p = list.find((x) => x.n === n);
	return p && (p.at === undefined ? false : p.at === n) ? p : undefined;
}

/** Whether a part heading is kept in step with its part (so it is drawn locked). */
export function headingFollows(sections: TaskSection[], text: string): boolean {
	const h = PART_HEADING.exec(text);
	const marks = partMarks(sections);
	return !!(h && marks && headingOwner(marks.list, Number(h[2])));
}

/** A part's own sub-heading, as What to submit writes it: "Part 1: Design brief (at home)". */
const PART_HEADING = /^(Part\s+(\d+)\s*:\s*)(.+?)\s*\((at home|in class)\)\s*$/i;

const withNumber = (text: string, n: number) =>
	/\d+/.test(text) ? text.replace(/\d+/, String(n)) : String(n);

/**
 * Makes every other place the marks appear follow Marking criteria: the
 * Marks column and total row of a parts table (Task overview's), and the
 * Marks detail. Only numbers that differ are written, so a draft that
 * already agrees is left alone. Returns whether anything changed.
 */
export function syncMarks(draft: AssessmentDraft): boolean {
	const marks = partMarks(draft.sections);
	if (!marks) return false;
	let changed = false;
	for (const s of draft.sections) {
		if (s.body.kind !== 'text') continue;
		const blocks = readBlocks(s.body.text);
		let touched = false;
		for (const block of blocks) {
			if (block.kind === 'heading') {
				// A part's own heading follows its part only while the part keeps the
				// number it had when the file was opened; otherwise it is flagged, never renamed.
				const h = PART_HEADING.exec(block.text);
				const owner = h ? headingOwner(marks.list, Number(h[2])) : undefined;
				const where = owner?.where.toLowerCase();
				if (h && owner?.name && where && /^(at home|in class)$/.test(where)) {
					const next = `${h[1]}${owner.name} (${where})`;
					if (next !== block.text) {
						block.text = next;
						touched = true;
					}
				}
				continue;
			}
			if (block.kind !== 'table') continue;
			const cols = partsTable(block);
			if (!cols) continue;
			// The parts table is made from Marking criteria: one row per part, in order, then its total.
			const total = block.rows.find((r) => /total/i.test(r.join(' ')));
			const rows: string[][] = marks.list.map((p, i) => {
				const was = block.rows.filter((r) => r !== total)[i] ?? [];
				const row = block.head.map((_, c) => was[c] ?? '');
				const m = PART_CELL.exec(was[cols.part] ?? '');
				row[cols.part] = m
					? `${m[1].replace(/\d+/, String(p.n))}${p.name}${m[4]}`
					: `${p.n}. ${p.name}`;
				if (cols.where !== -1) {
					const plain = (was[cols.where] ?? '').replace(/[*_]/g, '').trim();
					if (plain.toLowerCase() !== p.where.toLowerCase()) {
						row[cols.where] = p.where ? p.where[0].toUpperCase() + p.where.slice(1) : '';
					}
				}
				if (p.marks !== null) {
					const have = Number(/\d+/.exec(was[cols.marks] ?? '')?.[0]);
					if (have !== p.marks) row[cols.marks] = withNumber(was[cols.marks] ?? '', p.marks);
				}
				return row;
			});
			if (total) {
				const t = [...total];
				const have = Number(/\d+/.exec(t[cols.marks] ?? '')?.[0]);
				if (marks.total !== null && have !== marks.total) {
					t[cols.marks] = withNumber(t[cols.marks] ?? '', marks.total);
				}
				rows.push(t);
			}
			if (JSON.stringify(rows) !== JSON.stringify(block.rows)) {
				block.rows = rows;
				touched = true;
			}
		}
		if (touched) {
			s.body.text = joinBlocks(blocks);
			changed = true;
		}
	}
	const title = draft.sections.find((s) => s.role === 'title');
	if (title?.body.kind === 'details' && marks.total !== null) {
		for (const row of title.body.rows) {
			if (!/^marks?$/i.test(row.label.trim())) continue;
			if (marks.split) {
				const next = row.value
					.replace(/(\d+)(\s+in class)/i, `${marks.split.inClass}$2`)
					.replace(/(\d+)(\s+at home)/i, `${marks.split.atHome}$2`);
				if (next !== row.value) {
					row.value = next;
					changed = true;
				}
			}
			const have = Number(/^\s*(\d+)/.exec(row.value)?.[1]);
			if (have !== marks.total) {
				row.value = /^\s*\d+/.test(row.value)
					? row.value.replace(/\d+/, String(marks.total))
					: `${marks.total}${row.value.trim() ? ` ${row.value.trim()}` : ''}`;
				changed = true;
			}
		}
	}
	return changed;
}

/** Whether marks are worked out from the parts (so other places show them locked). */
export function marksFromParts(sections: TaskSection[]): boolean {
	return partMarks(sections) !== null;
}

/** Whether the Marks detail's in-class and at-home split is worked out from the parts. */
export function splitFromParts(sections: TaskSection[]): boolean {
	return partMarks(sections)?.split != null;
}

/** Whether a sub-heading is a part's own ("Part 1: Design brief (at home)"), kept in step with the part. */
export function isPartHeading(text: string): boolean {
	return PART_HEADING.test(text);
}
