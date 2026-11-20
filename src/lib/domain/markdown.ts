/**
 * A small Markdown reader for assessment notifications: the subset
 * `render_notification.py` in the data repo understands (headings,
 * paragraphs, bullet and numbered lists, `|` tables, `>` quotes, rules) with
 * bold, italic, code and links inline. It returns plain data for Svelte to
 * draw, so nothing from a file is ever inserted as HTML.
 */

export type Inline =
	| { kind: 'text'; text: string }
	| { kind: 'strong'; children: Inline[] }
	| { kind: 'em'; children: Inline[] }
	| { kind: 'code'; text: string }
	| { kind: 'link'; href: string; children: Inline[] };

export type Block =
	| { kind: 'heading'; level: number; text: string; inline: Inline[] }
	| { kind: 'paragraph'; inline: Inline[] }
	| { kind: 'list'; ordered: boolean; items: Block[][] }
	| { kind: 'table'; head: Inline[][] | null; rows: Inline[][][] }
	| { kind: 'quote'; blocks: Block[] }
	| { kind: 'rule' };

const BULLET = /^(\s*)([-*+])\s+(.*)$/;
const NUMBER = /^(\s*)(\d+)[.)]\s+(.*)$/;
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/;
const SEPARATOR = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;

/** Links only to the web or email; anything else shows as its text. */
export function safeHref(href: string): string | null {
	return /^(https?:|mailto:)/i.test(href.trim()) ? href.trim() : null;
}

export function parseInline(source: string): Inline[] {
	const out: Inline[] = [];
	let text = '';
	const flush = () => {
		if (text) out.push({ kind: 'text', text });
		text = '';
	};
	let i = 0;
	while (i < source.length) {
		const rest = source.slice(i);
		let m: RegExpMatchArray | null;
		if ((m = rest.match(/^`([^`]+)`/))) {
			flush();
			out.push({ kind: 'code', text: m[1] });
		} else if ((m = rest.match(/^(\*\*|__)(?=\S)([\s\S]*?\S)\1/))) {
			flush();
			out.push({ kind: 'strong', children: parseInline(m[2]) });
		} else if (
			(m = rest.match(/^(\*|_)(?=\S)([\s\S]*?\S)\1(?![*_\w])/)) &&
			!/\w/.test(source[i - 1] ?? '')
		) {
			flush();
			out.push({ kind: 'em', children: parseInline(m[2]) });
		} else if ((m = rest.match(/^\[([^\]]+)\]\(([^)\s]+)\)/))) {
			flush();
			const href = safeHref(m[2]);
			if (href) out.push({ kind: 'link', href, children: parseInline(m[1]) });
			else out.push(...parseInline(m[1]));
		} else {
			text += source[i];
			i += 1;
			continue;
		}
		i += m[0].length;
	}
	flush();
	return out;
}

/** The text of inline content, with the marks dropped. */
export function plain(inline: Inline[]): string {
	return inline
		.map((n) => ('children' in n ? plain(n.children) : n.text))
		.join('')
		.trim();
}

function cells(line: string): string[] {
	let row = line.trim();
	if (row.startsWith('|')) row = row.slice(1);
	if (row.endsWith('|') && !row.endsWith('\\|')) row = row.slice(0, -1);
	return row.split(/(?<!\\)\|/).map((c) => c.trim().replaceAll('\\|', '|'));
}

const indentOf = (line: string) => line.length - line.trimStart().length;

export function parseMarkdown(source: string): Block[] {
	return parseLines(source.split(/\r\n|\r|\n/));
}

function parseLines(lines: string[]): Block[] {
	const blocks: Block[] = [];
	let i = 0;
	while (i < lines.length) {
		const line = lines[i];
		if (!line.trim()) {
			i += 1;
			continue;
		}
		let m: RegExpMatchArray | null;
		if ((m = line.match(HEADING))) {
			blocks.push({ kind: 'heading', level: m[1].length, text: m[2], inline: parseInline(m[2]) });
			i += 1;
		} else if (RULE.test(line)) {
			blocks.push({ kind: 'rule' });
			i += 1;
		} else if (line.trimStart().startsWith('|')) {
			const rows: string[] = [];
			while (i < lines.length && lines[i].trimStart().startsWith('|')) rows.push(lines[i++]);
			const hasHead = rows.length > 1 && SEPARATOR.test(rows[1]);
			const head = hasHead ? cells(rows[0]) : null;
			const body = (hasHead ? rows.slice(2) : rows).filter((r) => !SEPARATOR.test(r));
			blocks.push({
				kind: 'table',
				head: head && head.some(Boolean) ? head.map(parseInline) : null,
				rows: body.map((r) => cells(r).map(parseInline))
			});
		} else if (line.trimStart().startsWith('>')) {
			const quoted: string[] = [];
			while (i < lines.length && lines[i].trimStart().startsWith('>')) {
				quoted.push(lines[i++].trimStart().replace(/^>\s?/, ''));
			}
			blocks.push({ kind: 'quote', blocks: parseLines(quoted) });
		} else if (BULLET.test(line) || NUMBER.test(line)) {
			const ordered = !BULLET.test(line);
			const base = indentOf(line);
			const items: string[][] = [];
			while (i < lines.length) {
				const l = lines[i];
				const marker = l.match(ordered ? NUMBER : BULLET);
				if (marker && indentOf(l) === base) {
					items.push([marker[3]]);
				} else if (l.trim() && indentOf(l) > base && items.length) {
					items[items.length - 1].push(l.slice(Math.min(indentOf(l), base + 2)));
				} else if (!l.trim() && items.length && indentOf(lines[i + 1] ?? '') > base) {
					items[items.length - 1].push('');
				} else {
					break;
				}
				i += 1;
			}
			blocks.push({ kind: 'list', ordered, items: items.map((item) => parseLines(item)) });
		} else {
			const para: string[] = [];
			while (
				i < lines.length &&
				lines[i].trim() &&
				!HEADING.test(lines[i]) &&
				!RULE.test(lines[i]) &&
				!lines[i].trimStart().startsWith('|') &&
				!lines[i].trimStart().startsWith('>') &&
				!BULLET.test(lines[i]) &&
				!NUMBER.test(lines[i])
			) {
				para.push(lines[i++].trim());
			}
			blocks.push({ kind: 'paragraph', inline: parseInline(para.join(' ')) });
		}
	}
	return blocks;
}
