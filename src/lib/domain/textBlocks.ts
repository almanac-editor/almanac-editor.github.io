/**
 * A section's text as blocks a teacher edits without seeing Markdown:
 * paragraphs, sub-headings, bullet and numbered lists, tables and quotes.
 * Inline marks (bold, italic, links) stay as Markdown inside each block's
 * text; RichText.svelte shows them as formatting.
 *
 * Each block keeps the exact lines it came from, and the gap before it, until
 * it is edited, so joining untouched blocks gives back the same text. A block
 * that would not read back exactly in the form written here is kept as
 * plain text ("raw"), so nothing is lost.
 */

export type TextBlock =
	| { kind: 'para'; text: string }
	| { kind: 'heading'; level: number; text: string }
	| { kind: 'list'; ordered: boolean; marker: string; start: number; items: string[] }
	| { kind: 'table'; head: string[]; rows: string[][]; align: string }
	| { kind: 'quote'; text: string }
	| { kind: 'rule' }
	| { kind: 'raw'; text: string };

export type Held = TextBlock & {
	/** Stable for the editor's keyed lists. */
	key: number;
	/** What separates this block from the one before: "\n\n" for a blank line. */
	__sep: string;
	/** The lines this came from, without the final newline; absent for a new block. */
	__raw?: string;
	/** The block as read, to tell whether it was edited. */
	__was?: string;
};

let keys = 0;
export const blockKey = () => ++keys;

const BULLET = /^([-*+]) (.*)$/;
const NUMBER = /^(\d+)\. (.*)$/;
const HEADING = /^(#{3,6}) (.*?)\s*$/;
const RULE = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/;
const SEPARATOR = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;

function kindOf(line: string): string {
	if (HEADING.test(line)) return 'heading';
	if (RULE.test(line)) return 'rule';
	if (line.trimStart().startsWith('|')) return 'table';
	if (line.startsWith('>')) return 'quote';
	if (BULLET.test(line)) return 'bullet';
	if (NUMBER.test(line)) return 'number';
	if (/^\s+\S/.test(line)) return 'indented';
	return 'para';
}

function cells(line: string): string[] {
	let row = line.trim();
	if (row.startsWith('|')) row = row.slice(1);
	if (row.endsWith('|') && !row.endsWith('\\|')) row = row.slice(0, -1);
	return row.split(/(?<!\\)\|/).map((c) => c.trim().replaceAll('\\|', '|'));
}

const cell = (text: string) => {
	const t = text
		.replace(/\s*\n\s*/g, ' ')
		.trim()
		.replaceAll('|', '\\|');
	return t ? ` ${t} ` : ' ';
};
const rowText = (row: string[]) => `|${row.map(cell).join('|')}|`;

/** A block written in the house form. */
export function blockText(block: TextBlock): string {
	switch (block.kind) {
		case 'para':
			return block.text.replace(/\r\n?/g, '\n').trim();
		case 'heading':
			return `${'#'.repeat(block.level)} ${block.text.replace(/\s*\n\s*/g, ' ').trim()}`;
		case 'list':
			return block.items
				.map((item, i) => {
					const text = item.replace(/\s*\n\s*/g, ' ').trim();
					return block.ordered ? `${block.start + i}. ${text}` : `${block.marker} ${text}`;
				})
				.join('\n');
		case 'table': {
			const width = Math.max(block.head.length, ...block.rows.map((r) => r.length));
			const pad = (r: string[]) => [...r, ...Array(width - r.length).fill('')].slice(0, width);
			const align =
				block.align && cells(block.align).length === width
					? block.align
					: `|${Array(width).fill('---').join('|')}|`;
			return [rowText(pad(block.head)), align, ...block.rows.map((r) => rowText(pad(r)))].join(
				'\n'
			);
		}
		case 'quote':
			return block.text
				.replace(/\r\n?/g, '\n')
				.trim()
				.split('\n')
				.map((l) => (l ? `> ${l}` : '>'))
				.join('\n');
		case 'rule':
			return '---';
		case 'raw':
			return block.text.replace(/\r\n?/g, '\n').replace(/\s+$/, '');
	}
}

function read(kind: string, group: string[]): TextBlock {
	const raw = group.join('\n');
	switch (kind) {
		case 'heading': {
			const m = HEADING.exec(group[0]);
			return m ? { kind: 'heading', level: m[1].length, text: m[2] } : { kind: 'raw', text: raw };
		}
		case 'rule':
			return { kind: 'rule' };
		case 'table': {
			if (group.length < 2 || !SEPARATOR.test(group[1])) return { kind: 'raw', text: raw };
			return {
				kind: 'table',
				head: cells(group[0]),
				align: group[1],
				rows: group.slice(2).map(cells)
			};
		}
		case 'quote':
			return { kind: 'quote', text: group.map((l) => l.replace(/^>\s?/, '')).join('\n') };
		case 'bullet': {
			const marker = BULLET.exec(group[0])?.[1] ?? '-';
			return {
				kind: 'list',
				ordered: false,
				marker,
				start: 1,
				items: group.map((l) => BULLET.exec(l)?.[2] ?? l)
			};
		}
		case 'number':
			return {
				kind: 'list',
				ordered: true,
				marker: '.',
				start: Number(NUMBER.exec(group[0])?.[1] ?? 1),
				items: group.map((l) => NUMBER.exec(l)?.[2] ?? l)
			};
		case 'para':
			return { kind: 'para', text: raw };
		default:
			return { kind: 'raw', text: raw };
	}
}

const sameKind = (a: string, b: string) => a === b && a !== 'heading' && a !== 'rule';

/** The text as blocks. Joining them with `joinBlocks` gives back the text. */
export function readBlocks(text: string): Held[] {
	const lines = text.replace(/\r\n?/g, '\n').split('\n');
	const out: Held[] = [];
	let sep = '';
	let i = 0;
	while (i < lines.length) {
		if (!lines[i].trim()) {
			sep += '\n';
			i++;
			continue;
		}
		const kind = kindOf(lines[i]);
		const group = [lines[i++]];
		// A list or paragraph that runs into indented lines is kept as text.
		let loose = false;
		while (i < lines.length && lines[i].trim()) {
			const next = kindOf(lines[i]);
			if (sameKind(kind, next)) group.push(lines[i++]);
			else if (next === 'indented' && kind !== 'table') {
				loose = true;
				group.push(lines[i++]);
			} else break;
		}
		const raw = group.join('\n');
		let block = loose ? ({ kind: 'raw', text: raw } as TextBlock) : read(kind, group);
		if (blockText(block) !== raw) block = { kind: 'raw', text: raw };
		out.push({
			...block,
			key: blockKey(),
			__sep: out.length ? `\n${sep || ''}` : '',
			__raw: raw,
			__was: JSON.stringify(block)
		} as Held);
		sep = '';
	}
	return out;
}

function strip(block: Held): TextBlock {
	const { key: _k, __sep: _s, __raw: _r, __was: _w, ...rest } = block;
	void _k;
	void _s;
	void _r;
	void _w;
	return rest as TextBlock;
}

/** The blocks as text: each untouched block as it was read. */
export function joinBlocks(blocks: Held[]): string {
	return blocks
		.map((b, i) => {
			const sep = i === 0 ? '' : b.__sep || '\n\n';
			const text =
				b.__raw !== undefined && JSON.stringify(strip(b)) === b.__was ? b.__raw : blockText(b);
			return text ? sep + text : '';
		})
		.join('');
}

/** A new block, ready to type into. */
export function newBlock(kind: TextBlock['kind']): Held {
	const base = { key: blockKey(), __sep: '\n\n' };
	switch (kind) {
		case 'heading':
			return { ...base, kind, level: 3, text: '' };
		case 'list':
			return { ...base, kind, ordered: false, marker: '-', start: 1, items: [''] };
		case 'table':
			return { ...base, kind, head: ['', ''], rows: [['', '']], align: '' };
		case 'quote':
			return { ...base, kind, text: '' };
		case 'rule':
			return { ...base, kind };
		case 'raw':
			return { ...base, kind, text: '' };
		default:
			return { ...base, kind: 'para', text: '' };
	}
}

/** Whether a table is a parts table: a Part column and a Marks column. */
export function partsColumns(
	head: string[]
): { part: number; marks: number; where: number } | null {
	const clean = head.map((h) => h.replace(/[*_]/g, '').trim().toLowerCase());
	// A table with a criterion per row (a blueprint) is not a parts table.
	if (clean.some((h) => h.startsWith('criteri'))) return null;
	const part = clean.findIndex((h) => h === 'part' || h === 'parts');
	const marks = clean.findIndex((h) => h === 'marks' || h === 'mark');
	const where = clean.findIndex((h) => h === 'where');
	return part !== -1 && marks !== -1 ? { part, marks, where } : null;
}
