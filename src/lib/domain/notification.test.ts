import { describe, expect, it } from 'vitest';
import { parseInline, parseMarkdown, plain } from './markdown.ts';
import { leadOf, readNotification } from './notification.ts';

const NOTE = `# 2030 Year 8 Sample Subject

## Assessment Task 2: Bridge Challenge

| | |
|---|---|
| **Due** | Friday 6 September 2030, by 3pm |
| **Weighting** | 25% (20% in class, 5% at home) |
| **Marks** | 30 |

---

## Task overview

Design and test a bridge.

| Part | Where | Marks |
|---|---|---|
| 1. Sketches | At home | 10 |
| 2. Build and test | In class | 20 |
| **Total** | | **30** |

## What to submit

### Part 1: Sketches (at home)

- three labelled sketches
- a [photo](https://example.com/photo) of your best one

### Parts 1 and 2: Logbook

1. one entry per lesson

## Assessable topics

- Build a truss

## Marking criteria

### Part 1: Sketches (10 marks)

BR-1 sketches a range of ideas

| Marks | Criteria |
|---|---|
| 10-9 | Sketches *many* ideas. |
| 8-0 | Sketches \\| some ideas. |

### Part 2: Build and test (20 marks, in class)

| Marks | Criteria |
|---|---|
| 20 | Builds it. |

# Teacher notes

Not for students.

## Blueprint

- one
`;

describe('parseMarkdown', () => {
	it('reads inline marks, and drops links that are not to the web', () => {
		expect(parseInline('a **b _c_** `d` [e](javascript:void) [f](https://x.org)')).toEqual([
			{ kind: 'text', text: 'a ' },
			{
				kind: 'strong',
				children: [
					{ kind: 'text', text: 'b ' },
					{ kind: 'em', children: [{ kind: 'text', text: 'c' }] }
				]
			},
			{ kind: 'text', text: ' ' },
			{ kind: 'code', text: 'd' },
			{ kind: 'text', text: ' ' },
			{ kind: 'text', text: 'e' },
			{ kind: 'text', text: ' ' },
			{ kind: 'link', href: 'https://x.org', children: [{ kind: 'text', text: 'f' }] }
		]);
	});

	it('leaves underscores inside words alone', () => {
		expect(plain(parseInline('snake_case_name and 2*3*4'))).toBe('snake_case_name and 2*3*4');
	});

	it('nests indented list items and joins paragraph lines', () => {
		const blocks = parseMarkdown('- one\n  - inner\n- two\n\nfirst\nsecond\n');
		expect(blocks[0]).toMatchObject({ kind: 'list', ordered: false });
		const list = blocks[0] as Extract<(typeof blocks)[number], { kind: 'list' }>;
		expect(list.items).toHaveLength(2);
		expect(list.items[0][1]).toMatchObject({ kind: 'list' });
		expect(blocks[1]).toEqual({
			kind: 'paragraph',
			inline: [{ kind: 'text', text: 'first second' }]
		});
	});

	it('reads a backslash escape as the character itself', () => {
		expect(plain(parseInline('I, \\<name\\>, sign \\*here\\*'))).toBe('I, <name>, sign *here*');
	});

	it('reads a table without a header, and escaped pipes in cells', () => {
		const [table] = parseMarkdown('| | |\n|---|---|\n| a | b \\| c |\n');
		expect(table).toMatchObject({ kind: 'table', head: null });
		expect((table as { rows: unknown[][] }).rows[0]).toHaveLength(2);
	});
});

describe('readNotification', () => {
	const n = readNotification(NOTE);

	it('reads the subject, title and details', () => {
		expect(n.subject).toBe('2030 Year 8 Sample Subject');
		expect(n.title).toBe('Bridge Challenge');
		expect(n.details.map((d) => [d.label, d.text])).toEqual([
			['Due', 'Friday 6 September 2030, by 3pm'],
			['Weighting', '25% (20% in class, 5% at home)'],
			['Marks', '30']
		]);
	});

	it('keeps the sections in order and the teacher notes apart', () => {
		expect(n.sections.map((s) => s.heading)).toEqual([
			'Task overview',
			'What to submit',
			'Assessable topics',
			'Marking criteria'
		]);
		expect(n.teacher.map((s) => s.heading)).toEqual(['Teacher notes', 'Blueprint']);
	});

	it('copes with no headings at all', () => {
		const bare = readNotification('Just a line.\n');
		expect(bare).toMatchObject({ subject: null, title: null, details: [], sections: [] });
		expect(bare.preface).toHaveLength(1);
	});
});

describe('helpers', () => {
	it('splits a detail into its lead and the rest', () => {
		expect(leadOf('25% (20% in class, 5% at home)')).toEqual({
			lead: '25%',
			rest: '(20% in class, 5% at home)'
		});
		expect(leadOf('Friday 6 September 2030, by 3pm')).toEqual({
			lead: 'Friday 6 September 2030',
			rest: 'by 3pm'
		});
		expect(leadOf('30')).toEqual({ lead: '30', rest: '' });
	});
});
