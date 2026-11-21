import { describe, expect, it } from 'vitest';
import { plain } from './markdown.ts';
import {
	issuedHalf,
	logoUrl,
	notificationLayout,
	sectionLines,
	type Line
} from './notificationPdf.ts';
import { parseMarkdown } from './markdown.ts';

// Made up: a notification in the house form.
const SOURCE = `# 2031 Year 8 Kite Making

## Assessment Task 2: Build a box kite

A line before the table is not issued.

| | |
|---|---|
| **Date** | Friday 3 March (Term 1, Week 6) |
| **Weighting** | 30% |

---

## Outcomes assessed

| | |
|---|---|
| KM-8-01 | designs a kite | for a given wind |
| KM-8-02 | tests a kite |

## Task details

### Task information

You build a kite in class.

- Use the frame you are given
- Bring string

**Part 1: Frame (10 marks)**

- Join the spars
- See [the Canvas page](https://example.com/canvas)

Plain text closes the bold paragraph.

- Back to the first level

3. Third step
4. Fourth step

> Kites fly against the wind.

# Teacher notes

## Marking

Never issued.
`;

const text = (line: Line) => ('inline' in line ? plain(line.inline) : `${line.code}|${line.text}`);

describe('notificationLayout', () => {
	const layout = notificationLayout(SOURCE);

	it('puts the subject line in the letterhead and splits the title at its colon', () => {
		expect(layout.subject).toBe('2031 Year 8 Kite Making');
		expect(layout.lead).toBe('Assessment Task 2:');
		expect(layout.name).toBe('Build a box kite');
	});

	it('gives each detail a label row, then each section, and drops the teacher notes', () => {
		expect(layout.rows.map((r) => r.label)).toEqual([
			'Date',
			'Weighting',
			'Outcomes assessed',
			'Task details'
		]);
		expect(text(layout.rows[0].lines[0])).toBe('Friday 3 March (Term 1, Week 6)');
		expect(JSON.stringify(layout)).not.toContain('Never issued');
		expect(JSON.stringify(layout)).not.toContain('not issued');
	});

	it('sets a table as a code column with the rest joined by colons', () => {
		expect(layout.rows[2].lines).toEqual([
			{ kind: 'coded', code: 'KM-8-01', text: 'designs a kite: for a given wind' },
			{ kind: 'coded', code: 'KM-8-02', text: 'tests a kite' }
		]);
	});

	it('nests bullets under a bold paragraph until plain text or a heading closes it', () => {
		const lines = layout.rows[3].lines;
		const shape = lines.map((l) =>
			l.kind === 'item'
				? `${l.level}${l.mark}${l.bold ? 'b' : ''} ${text(l)}`
				: `${l.kind} ${text(l)}`
		);
		expect(shape).toEqual([
			'heading Task information',
			'para You build a kite in class.',
			'1● Use the frame you are given',
			'1● Bring string',
			'1●b Part 1: Frame (10 marks)',
			'2o Join the spars',
			'2o See the Canvas page',
			'para Plain text closes the bold paragraph.',
			'1● Back to the first level',
			'13. Third step',
			'14. Fourth step',
			'quote Kites fly against the wind.'
		]);
	});

	it('takes a title with no colon as the name alone', () => {
		const l = notificationLayout('# S\n\n## Final exam\n\n## Notes\n\nHi\n');
		expect([l.lead, l.name]).toEqual(['', 'Final exam']);
		expect(l.rows).toHaveLength(1);
	});
});

describe('issuedHalf', () => {
	it('cuts at the second top-level heading only', () => {
		expect(issuedHalf('# A\n## B\n# C\nx')).toBe('# A\n## B\n');
		expect(issuedHalf('# A\n## B\n')).toBe('# A\n## B\n');
	});
});

describe('sectionLines', () => {
	it('starts numbered steps from the number written', () => {
		const lines = sectionLines(parseMarkdown('7. Seven\n8. Eight\n'));
		expect(lines.map((l) => (l.kind === 'item' ? l.mark : ''))).toEqual(['7.', '8.']);
	});
});

describe('logoUrl', () => {
	it('names the image type from the extension', () => {
		expect(logoUrl('assets/logo.JPG', 'AAAA')).toBe('data:image/jpeg;base64,AAAA');
		expect(logoUrl('assets/logo.svg', 'AAAA')).toBe('data:image/svg+xml;base64,AAAA');
	});
});
