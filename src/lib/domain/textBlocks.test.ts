import { describe, expect, it } from 'vitest';
import { blockText, joinBlocks, newBlock, partsColumns, readBlocks } from './textBlocks.ts';

const TEXT = `Redesign a torch so a younger student can use it.

| Part | Where | Marks |
|---|---|---|
| 1. Design brief | At home | 5 |
| **Total** | | **20** |

### Part 1: Design brief (at home)

- a one-page brief
- two photos
1. First
2. Second

> I, \\<name\\>, wrote this.
>
> Signed

---

A line
that wraps.`;

describe('readBlocks / joinBlocks', () => {
	it('gives back the same text untouched', () => {
		expect(joinBlocks(readBlocks(TEXT))).toBe(TEXT);
	});

	it('reads paragraphs, tables, sub-headings, lists and quotes', () => {
		expect(readBlocks(TEXT).map((b) => b.kind)).toEqual([
			'para',
			'table',
			'heading',
			'list',
			'list',
			'quote',
			'rule',
			'para'
		]);
		const table = readBlocks(TEXT)[1];
		expect(table.kind === 'table' && table.rows).toEqual([
			['1. Design brief', 'At home', '5'],
			['**Total**', '', '**20**']
		]);
	});

	it('writes an edited block in the house form and leaves the rest', () => {
		const blocks = readBlocks(TEXT);
		const table = blocks[1];
		if (table.kind !== 'table') throw new Error();
		table.rows[0][2] = '6';
		table.rows.push(['2. Model | test', 'In class', '15']);
		const list = blocks[3];
		if (list.kind !== 'list') throw new Error();
		list.items.push('a sketch');
		const out = joinBlocks(blocks);
		expect(out).toContain(
			'| 1. Design brief | At home | 6 |\n| **Total** | | **20** |\n| 2. Model \\| test | In class | 15 |'
		);
		expect(out).toContain('- two photos\n- a sketch\n1. First');
		expect(out.endsWith('A line\nthat wraps.')).toBe(true);
	});

	it('keeps what it cannot lay out as text', () => {
		const odd = '- item\n  continued\n\ntext  ';
		const blocks = readBlocks(odd);
		expect(blocks.map((b) => b.kind)).toEqual(['raw', 'raw']);
		expect(joinBlocks(blocks)).toBe(odd);
	});

	it('adds new blocks with a blank line before them', () => {
		const blocks = readBlocks('One.');
		blocks.push({ ...newBlock('list'), items: ['a', 'b'] } as never);
		blocks.push({ ...newBlock('table'), head: ['Part', 'Marks'], rows: [['1', '5']] } as never);
		expect(joinBlocks(blocks)).toBe('One.\n\n- a\n- b\n\n| Part | Marks |\n|---|---|\n| 1 | 5 |');
	});

	it('drops an emptied block', () => {
		const blocks = readBlocks('One.\n\nTwo.');
		if (blocks[1].kind === 'para') blocks[1].text = '';
		expect(joinBlocks(blocks)).toBe('One.');
	});

	it('finds a parts table', () => {
		expect(partsColumns(['Part', 'Where', 'Marks'])).toEqual({ part: 0, marks: 2, where: 1 });
		expect(partsColumns(['Code', 'Outcome'])).toBeNull();
		expect(blockText({ kind: 'rule' })).toBe('---');
	});
});
