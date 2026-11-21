/**
 * An assessment notification read into what the assessment page shows: the
 * subject line, the task's title and details table, its `##` sections and
 * the teacher notes. The shape follows the conventions
 * `render_notification.py` in the data repo relies on:
 *
 *   `# ...`              the year and subject line
 *   `## Assessment: X`   the title, followed by the details table
 *   every later `##`     a section
 *   a second `#`         the start of the teacher notes, never issued
 *
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

export interface Notification {
	subject: string | null;
	title: string | null;
	details: Detail[];
	/** Blocks between the details and the first section. */
	preface: Block[];
	sections: Section[];
	teacher: Section[];
}

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

	return { subject, title, details, preface, sections, teacher };
}

/** "20% (15% in class, 5% at home)" -> the lead "20%" and the rest. */
export function leadOf(text: string): { lead: string; rest: string } {
	const m = text.match(/^([^(,;]+?)\s*([(,;].*)?$/);
	if (!m) return { lead: text, rest: '' };
	return { lead: m[1].trim(), rest: (m[2] ?? '').replace(/^[,;]\s*/, '').trim() };
}
