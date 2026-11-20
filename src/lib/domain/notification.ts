/**
 * An assessment notification read into the parts the assessment page shows:
 * the subject line, the task's title and details table, its `##` sections,
 * the teacher notes, and the task's parts with each part's submission and
 * rubric. The shape follows the conventions `render_notification.py` in the
 * data repo relies on:
 *
 *   `# ...`              the year and subject line
 *   `## Assessment: X`   the title, followed by the details table
 *   every later `##`     a section
 *   a second `#`         the start of the teacher notes, never issued
 *
 * Parts come from `### Part 1: Name (5 marks, at home)` headings under
 * "Marking criteria" where there are any, else from a task overview table
 * with a Marks column, else from bold `**Part A: Name (14 marks)**` lines.
 * "What to submit" headings name the parts they cover ("Parts 2 and 3: ...").
 */

import { parseMarkdown, plain, type Block, type Inline } from './markdown.ts';

export interface Section {
	heading: string;
	blocks: Block[];
}

export interface Detail {
	label: string;
	value: Inline[];
	text: string;
}

export interface Submission {
	heading: string;
	blocks: Block[];
}

export interface Part {
	/** The part's number where its label gives one ("Part 2", "2. Survey"). */
	number: number | null;
	label: string;
	marks: number | null;
	where: 'class' | 'home' | null;
	/** Everything under its marking criteria heading: outcome lines, criteria, rubric tables. */
	rubric: Block[];
	submit: Submission[];
}

export interface Notification {
	subject: string | null;
	title: string | null;
	details: Detail[];
	/** Blocks between the details and the first section. */
	preface: Block[];
	sections: Section[];
	teacher: Section[];
	parts: Part[];
	/** The marks the details give, else the parts' sum. */
	totalMarks: number | null;
}

const CRITERIA = /^marking criteria$/i;
const SUBMIT = /^what to submit$/i;

function heading(block: Block, level: number): string | null {
	return block.kind === 'heading' && block.level === level ? plain(block.inline) : null;
}

/** Splits blocks at headings of `level`; blocks before the first go in `lead`. */
function split(blocks: Block[], level: number): { lead: Block[]; groups: Section[] } {
	const lead: Block[] = [];
	const groups: Section[] = [];
	for (const block of blocks) {
		const h = heading(block, level);
		if (h !== null) groups.push({ heading: h, blocks: [] });
		else (groups.at(-1)?.blocks ?? lead).push(block);
	}
	return { lead, groups };
}

const whereOf = (text: string): Part['where'] =>
	/\bat home\b/i.test(text) ? 'home' : /\bin class\b/i.test(text) ? 'class' : null;

const numberOf = (label: string): number | null => {
	const m = label.match(/^(?:part|section)\s+(\d+)\b/i) ?? label.match(/^(\d+)[.)]\s/);
	return m ? Number(m[1]) : null;
};

/** "Part 1: Survey (5 marks, at home)" -> label, marks and place. */
function partHeading(text: string): Omit<Part, 'rubric' | 'submit'> | null {
	const m = text.match(/^(.*?)\s*\(([^)]*\b(\d+)\s*marks?\b[^)]*)\)\s*$/i);
	if (!m) return null;
	return { number: numberOf(m[1]), label: m[1], marks: Number(m[3]), where: whereOf(m[2]) };
}

/** The numbers a submission heading covers: "Parts 2 and 3: ..." -> [2, 3]. */
export function coveredParts(text: string): number[] {
	const m = text.match(/^parts?\s+([\d\s,&]+(?:and\s+\d+)?)/i);
	return m ? [...m[1].matchAll(/\d+/g)].map((n) => Number(n[0])) : [];
}

function fromCriteria(section: Section | undefined): Part[] {
	if (!section) return [];
	return split(section.blocks, 3).groups.flatMap((g) => {
		const part = partHeading(g.heading);
		return part ? [{ ...part, rubric: g.blocks, submit: [] }] : [];
	});
}

function fromOverview(sections: Section[]): Part[] {
	for (const section of sections) {
		for (const block of section.blocks) {
			if (block.kind !== 'table' || !block.head) continue;
			const head = block.head.map((c) => plain(c).toLowerCase());
			const marks = head.indexOf('marks');
			if (marks === -1 || !/^(part|section)/.test(head[0] ?? '')) continue;
			const where = head.findIndex((h) => h === 'where');
			return block.rows
				.filter((r) => !/^total\b/i.test(plain(r[0] ?? [])))
				.map((r) => {
					const label = plain(r[0] ?? []);
					const n = Number.parseInt(plain(r[marks] ?? []), 10);
					return {
						number: numberOf(label),
						label: label.replace(/^\d+[.)]\s*/, ''),
						marks: Number.isNaN(n) ? null : n,
						where: where === -1 ? null : whereOf(plain(r[where] ?? [])),
						rubric: [],
						submit: []
					};
				});
		}
	}
	return [];
}

function fromBold(sections: Section[]): Part[] {
	const parts: Part[] = [];
	for (const section of sections) {
		for (const block of section.blocks) {
			if (block.kind !== 'paragraph' || block.inline.length !== 1) continue;
			if (block.inline[0].kind !== 'strong') continue;
			const part = partHeading(plain(block.inline));
			if (part) parts.push({ ...part, rubric: [], submit: [] });
		}
	}
	return parts;
}

export function readNotification(source: string): Notification {
	const blocks = parseMarkdown(source);
	const tops = blocks.flatMap((b, i) => (heading(b, 1) !== null ? [i] : []));
	const subject = tops.length ? heading(blocks[tops[0]], 1) : null;
	const issued = blocks.slice(tops.length ? tops[0] + 1 : 0, tops[1] ?? blocks.length);
	const notes = tops.length > 1 ? blocks.slice(tops[1]) : [];

	const { lead, groups } = split(issued, 2);
	const first = groups.shift();
	let title: string | null = null;
	const details: Detail[] = [];
	const preface: Block[] = [...lead];
	if (first) {
		title = first.heading.includes(':')
			? first.heading.slice(first.heading.indexOf(':') + 1).trim()
			: first.heading;
		for (const block of first.blocks) {
			if (block.kind === 'table' && !details.length) {
				const rows = block.head ? [block.head, ...block.rows] : block.rows;
				for (const row of rows) {
					const label = plain(row[0] ?? []);
					if (!label) continue;
					const value = row.slice(1).flat();
					details.push({ label, value, text: plain(value) });
				}
			} else if (block.kind !== 'rule') {
				preface.push(block);
			}
		}
	}
	const sections = groups.map((g) => ({
		heading: g.heading,
		blocks: g.blocks.filter((b) => b.kind !== 'rule')
	}));

	const teacher: Section[] = [];
	if (notes.length) {
		const name = heading(notes[0], 1) ?? 'Teacher notes';
		const split2 = split(notes.slice(1), 2);
		if (split2.lead.length) teacher.push({ heading: name, blocks: split2.lead });
		teacher.push(...split2.groups);
	}

	const criteria = sections.find((s) => CRITERIA.test(s.heading));
	let parts = fromCriteria(criteria);
	if (parts.length) {
		// Places the criteria headings leave out come from the overview table.
		const overview = fromOverview(sections);
		for (const part of parts) {
			part.where ??=
				overview.find((o) => o.number !== null && o.number === part.number)?.where ?? null;
		}
	} else {
		parts = fromOverview(sections);
		if (!parts.length) parts = fromBold(sections);
	}

	const submit = sections.find((s) => SUBMIT.test(s.heading));
	if (submit && parts.some((p) => p.number !== null)) {
		for (const group of split(submit.blocks, 3).groups) {
			const covered = coveredParts(group.heading);
			for (const part of parts) {
				if (part.number !== null && covered.includes(part.number)) part.submit.push(group);
			}
		}
	}

	const marksDetail = details.find((d) => /^(total\s+)?marks$/i.test(d.label));
	const stated = marksDetail ? Number.parseInt(marksDetail.text, 10) : Number.NaN;
	const sum = parts.reduce((n, p) => n + (p.marks ?? 0), 0);
	return {
		subject,
		title,
		details,
		preface,
		sections,
		teacher,
		parts,
		totalMarks: Number.isNaN(stated) ? sum || null : stated
	};
}

/** "20% (15% in class, 5% at home)" -> the lead "20%" and the rest. */
export function leadOf(text: string): { lead: string; rest: string } {
	const m = text.match(/^([^(,;]+?)\s*([(,;].*)?$/);
	if (!m) return { lead: text, rest: '' };
	return { lead: m[1].trim(), rest: (m[2] ?? '').replace(/^[,;]\s*/, '').trim() };
}
