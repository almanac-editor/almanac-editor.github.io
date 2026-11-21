/**
 * A notification laid out as students get it, for the notification page to
 * print as a PDF. The layout is the one `render_notification.py` in the data
 * repo gives the school's Word file, rule for rule, so the two agree:
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
 *   a `|` table        each body row: the first cell bold in its own column,
 *                      the rest beside it, joined with ": "
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
	| { kind: 'coded'; code: string; text: string };

export interface Row {
	label: string;
	lines: Line[];
}

export interface Layout {
	/** The year and subject line; null when there is no `#` heading. */
	subject: string | null;
	/** The title up to and including its colon, set regular; empty without one. */
	lead: string;
	/** The rest of the title, set bold. */
	name: string;
	rows: Row[];
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

function tableLines(block: Extract<Block, { kind: 'table' }>): Line[] {
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
					out.push({ kind: 'para', inline: block.inline });
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
	for (const s of sections) rows.push({ label: s.label, lines: sectionLines(s.blocks) });
	const colon = (title ?? '').indexOf(':');
	return {
		subject,
		lead: colon === -1 ? '' : title!.slice(0, colon + 1),
		name: colon === -1 ? (title ?? '') : title!.slice(colon + 1).trim(),
		rows
	};
}
