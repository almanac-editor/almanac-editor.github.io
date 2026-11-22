/**
 * A notification laid out as students get it, for the notification page to
 * print as a PDF. It starts from the layout `render_notification.py` in the
 * data repo gives the school's Word file, and lays out tables and the rubric
 * as the school's hand-made notifications do:
 *
 *   `# ...`            the year and subject line, beside the logo at the top
 *                      of every page
 *   `## Assessment: X` the title: "Assessment:" regular, the rest bold
 *   the first tables   one label row per body row (Date, Weighting, Marks…);
 *   after the title    a table's header row is dropped. Other text there is
 *                      not issued
 *   every later `##`   one label row, the heading as its label
 *   `###`              a bold line
 *   `**bold para**`    a bold first-level bullet
 *   a list item        a second-level bullet under an open bold paragraph,
 *                      else first-level
 *   a numbered list    numbered steps, at the same levels
 *   a `>` quote        an indented italic line
 *   a `|` table with   each body row: the first cell bold in its own column,
 *   an empty header,   the rest beside it, joined with ": " (outcome lists)
 *   or outcome codes
 *   down its first
 *   column
 *   a line opening     the code bold in its own column, the wording beside it
 *   with an outcome
 *   code
 *   any other table    a table, its header row shaded
 *   `## Marking        on landscape pages after the rest: per part, its
 *   criteria`          heading and outcomes, then per criterion a shaded row
 *                      of mark ranges and the criterion beside each range's
 *                      wording. Only when it holds a rubric (a table headed
 *                      Marks); otherwise it is a label row like any other
 *
 * Everything from the second `#` heading on is the teacher notes and never
 * issued. Links print as their text: notifications name Canvas pages, they
 * don't link them.
 */

import { parseMarkdown, plain, type Block, type Inline } from './markdown.ts';

/** Where the logo may be, in the order they are tried. */
export const LOGO_PATHS = [
	'assets/logo.png',
	'assets/logo.jpg',
	'assets/logo.jpeg',
	'assets/logo.svg'
];

const TYPES: Record<string, string> = {
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	svg: 'image/svg+xml'
};

/** The logo as a `data:` URL, the only kind of image the CSP lets the page show. */
export function logoUrl(path: string, base64: string): string {
	const type = TYPES[path.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';
	return `data:${type};base64,${base64}`;
}

export type Line =
	| { kind: 'heading'; inline: Inline[] }
	| { kind: 'para'; inline: Inline[] }
	| { kind: 'item'; mark: string; level: 1 | 2; bold: boolean; inline: Inline[] }
	| { kind: 'quote'; inline: Inline[] }
	| { kind: 'coded'; code: string; text: string }
	| { kind: 'table'; head: Inline[][]; rows: Inline[][][] };

export interface Row {
	label: string;
	lines: Line[];
}

/** One criterion's mark ranges, across the page. */
export interface Criterion {
	/** "Structured dataset (5 marks)"; a part's one unnamed criterion takes the part's name. */
	label: string;
	ranges: { marks: string; text: Inline[] }[];
}

export interface RubricPart {
	/** "Part 1: Survey (5 marks, at home)" */
	heading: Inline[];
	/** Outcome lines and anything else in the part that is not a criterion. */
	lines: Line[];
	criteria: Criterion[];
}

export interface Rubric {
	/** The section's own heading: "Marking criteria". */
	heading: string;
	/** Text before the first part. */
	lines: Line[];
	parts: RubricPart[];
}

export interface Layout {
	/** The year and subject line; null when there is no `#` heading. */
	subject: string | null;
	/** The title up to and including its colon, set regular; empty without one. */
	lead: string;
	/** The rest of the title, set bold. */
	name: string;
	rows: Row[];
	/** Marking criteria, for the landscape pages; null when it holds no rubric. */
	rubric: Rubric | null;
}

/** Everything above the second `#` heading. */
export function issuedHalf(source: string): string {
	const tops = [...source.matchAll(/^# /gm)];
	return tops.length < 2 ? source : source.slice(0, tops[1].index);
}

const isBoldOnly = (inline: Inline[]) => {
	const meaningful = inline.filter((n) => n.kind !== 'text' || n.text.trim());
	return meaningful.length === 1 && meaningful[0].kind === 'strong';
};

const RUBRIC_HEADING = /^marking criteria$/i;
const isRubricTable = (block: Block): block is Extract<Block, { kind: 'table' }> =>
	block.kind === 'table' && /^marks?$/i.test(plain(block.head?.[0] ?? []).trim());

/** An outcome code: "EC-12-02", "CT5-DAT-01", "DT-4.1" is not one. */
const CODE = /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-\d+[A-Z]?$/;
const CODED_LINE = /^([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-\d+[A-Z]?)\s+(.+)$/;

/** A table to keep as a table: it has a header, and its first column is not outcome codes. */
const isTable = (block: Extract<Block, { kind: 'table' }>) =>
	!!block.head?.some((cell) => plain(cell).trim()) &&
	!block.rows.every((row) => CODE.test(plain(row[0] ?? []).trim()));

function tableLines(block: Extract<Block, { kind: 'table' }>): Line[] {
	if (isTable(block)) {
		return [{ kind: 'table', head: block.head ?? [], rows: block.rows }];
	}
	return block.rows.map((row) => ({
		kind: 'coded',
		code: plain(row[0] ?? []),
		text: row
			.slice(1)
			.map(plain)
			.filter((t) => t)
			.join(': ')
	}));
}

/** A section's blocks as lines, with the bullet levels `render_notification.py` gives them. */
export function sectionLines(blocks: Block[]): Line[] {
	const out: Line[] = [];
	// A list sits a level deeper while a bold paragraph is open above it.
	let underBold = false;
	for (const block of blocks) {
		switch (block.kind) {
			case 'heading':
				out.push({ kind: 'heading', inline: block.inline });
				underBold = false;
				break;
			case 'paragraph':
				if (isBoldOnly(block.inline)) {
					out.push({ kind: 'item', mark: '●', level: 1, bold: true, inline: block.inline });
					underBold = true;
				} else {
					// A line that opens with an outcome code, as Outcomes assessed lists them.
					const coded =
						block.inline.length === 1 && block.inline[0].kind === 'text'
							? CODED_LINE.exec(block.inline[0].text)
							: null;
					out.push(
						coded
							? { kind: 'coded', code: coded[1], text: coded[2] }
							: { kind: 'para', inline: block.inline }
					);
					underBold = false;
				}
				break;
			case 'list':
				block.items.forEach((item, i) => {
					for (const child of item) {
						if (child.kind !== 'paragraph') continue;
						out.push({
							kind: 'item',
							mark: block.ordered ? `${block.start + i}.` : underBold ? 'o' : '●',
							level: underBold ? 2 : 1,
							bold: false,
							inline: child.inline
						});
					}
				});
				break;
			case 'quote':
				for (const child of block.blocks) {
					if (child.kind === 'paragraph') out.push({ kind: 'quote', inline: child.inline });
				}
				break;
			case 'table':
				out.push(...tableLines(block));
				break;
			case 'rule':
				break;
		}
	}
	return out;
}

/** "Part 1: Survey (5 marks, at home)" -> "Survey (5 marks)" */
function partLabel(heading: string): string {
	const m = /^Parts? [^:]+:\s*(.*?)\s*\((\d+ marks?)/.exec(heading);
	return m ? `${m[1]} (${m[2]})` : heading;
}

/** Marking criteria as parts and criteria, or null when it holds no rubric table. */
export function readRubric(heading: string, blocks: Block[]): Rubric | null {
	if (!blocks.some(isRubricTable)) return null;
	const lead: Block[] = [];
	const parts: { heading: Inline[]; rest: Block[]; criteria: Criterion[] }[] = [];
	let name: string | null = null;
	blocks.forEach((block, i) => {
		const part = parts.at(-1);
		if (block.kind === 'heading' && block.level >= 3) {
			parts.push({ heading: block.inline, rest: [], criteria: [] });
			name = null;
		} else if (!part) {
			lead.push(block);
		} else if (
			block.kind === 'paragraph' &&
			isBoldOnly(block.inline) &&
			!name &&
			isRubricTable(blocks[i + 1] ?? { kind: 'rule' })
		) {
			name = plain(block.inline);
		} else if (isRubricTable(block)) {
			part.criteria.push({
				label: name ?? partLabel(plain(part.heading)),
				ranges: block.rows.map((row) => ({
					marks: plain(row[0] ?? []),
					text: row
						.slice(1)
						.flatMap((cell, i) => (i ? [{ kind: 'text', text: ' ' }, ...cell] : cell))
				}))
			});
			name = null;
		} else if (block.kind !== 'rule') {
			part.rest.push(block);
		}
	});
	return {
		heading,
		lines: sectionLines(lead),
		parts: parts.map((p) => ({
			heading: p.heading,
			lines: sectionLines(p.rest),
			criteria: p.criteria
		}))
	};
}

export function notificationLayout(source: string): Layout {
	let subject: string | null = null;
	let title: string | null = null;
	const rows: Row[] = [];
	let section: Block[] | null = null;
	const sections: { label: string; blocks: Block[] }[] = [];
	for (const block of parseMarkdown(issuedHalf(source))) {
		if (block.kind === 'heading' && block.level === 1) {
			subject = plain(block.inline);
		} else if (block.kind === 'heading' && block.level === 2) {
			if (title === null) {
				title = plain(block.inline);
				continue;
			}
			sections.push({ label: plain(block.inline), blocks: [] });
			section = sections.at(-1)!.blocks;
		} else if (section) {
			section.push(block);
		} else if (block.kind === 'table') {
			// The details: one label row each, in the order written.
			for (const row of block.rows) {
				if (!row.some((cell) => cell.length)) continue;
				rows.push({
					label: plain(row[0] ?? []),
					lines: [{ kind: 'para', inline: row[1] ?? [] }]
				});
			}
		}
	}
	let rubric: Rubric | null = null;
	for (const s of sections) {
		const read: Rubric | null =
			!rubric && RUBRIC_HEADING.test(s.label) ? readRubric(s.label, s.blocks) : null;
		if (read) rubric = read;
		else rows.push({ label: s.label, lines: sectionLines(s.blocks) });
	}
	const colon = (title ?? '').indexOf(':');
	return {
		subject,
		lead: colon === -1 ? '' : title!.slice(0, colon + 1),
		name: colon === -1 ? (title ?? '') : title!.slice(colon + 1).trim(),
		rows,
		rubric
	};
}
