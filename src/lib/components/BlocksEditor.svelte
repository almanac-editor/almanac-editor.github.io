<script lang="ts">
	// A section's text edited in place, as it reads: paragraphs, sub-headings,
	// bullet and numbered lists, tables and quotes keep their drawn look, and
	// the line you're in becomes a clear field. Enter starts the next
	// paragraph or item; Backspace in an empty one removes it. Each block's
	// tools show only while you're in it, and a removal can be undone from the
	// save bar. In a parts table the Marks column comes from Marking criteria.
	import { tick } from 'svelte';
	import Icon from './Icon.svelte';
	import RichText from './RichText.svelte';
	import { partsTable } from '#lib/domain/assessmentEdit.ts';
	import { joinBlocks, newBlock, readBlocks, type Held } from '#lib/domain/textBlocks.ts';
	import { removing, undo, undoRemove } from '#lib/undo.svelte.ts';

	let {
		host,
		field = 'text',
		compact = false,
		marksLocked = false,
		headingLocked = () => false
	}: {
		/** The object whose `field` holds the text: a section's body, a part, a topics row. */
		host: object;
		field?: string;
		/** A short piece (a heading among topics): no add bar, no block tools. */
		compact?: boolean;
		/** Marks come from Marking criteria, so a parts table's Marks column is not typed. */
		marksLocked?: boolean;
		/** Whether a sub-heading is a part's own heading, kept in step with Marking criteria. */
		headingLocked?: (text: string) => boolean;
	} = $props();

	let blocks = $state<Held[]>([]);
	let mine: string | null = null;
	let root: HTMLDivElement;

	const read = () => String((host as Record<string, unknown>)[field] ?? '');
	const write = (t: string) => ((host as Record<string, unknown>)[field] = t);

	// Read the text into blocks when it changes from outside (opening, Cancel, Undo).
	$effect(() => {
		const t = read();
		if (t === mine) return;
		mine = t;
		blocks = readBlocks(t);
	});

	function emit() {
		const next = joinBlocks(blocks);
		mine = next;
		write(next);
	}

	/**
	 * Undo for a removal inside block `at`: read the text as it is then, change
	 * just that block back, and write it. Edits made since are kept.
	 */
	function putBackIn(at: number, change: (b: Held) => void) {
		const now = readBlocks(read());
		const b = now[at];
		if (b) change(b);
		write(joinBlocks(now));
	}

	const NAMES: Record<Held['kind'], string> = {
		para: 'paragraph',
		heading: 'sub-heading',
		list: 'list',
		table: 'table',
		quote: 'quote',
		rule: 'line',
		raw: 'text'
	};

	async function focusBlock(key: number, last = false) {
		await tick();
		const fields = root.querySelectorAll<HTMLElement>(
			`[data-block="${key}"] .rich, [data-block="${key}"] textarea`
		);
		(last ? fields[fields.length - 1] : fields[0])?.focus();
	}

	function insertAfter(i: number, kind: Held['kind']) {
		const block = newBlock(kind);
		blocks.splice(i + 1, 0, block);
		emit();
		void focusBlock(block.key);
	}

	/** Backspace in an empty block: nothing is lost, so no undo is offered. */
	function dropEmpty(i: number) {
		const prev = blocks[i - 1];
		blocks.splice(i, 1);
		emit();
		if (prev) void focusBlock(prev.key, true);
	}

	/** Where the last removal was, to offer Undo in its place. */
	let ghost = $state<{ at: number; label: string } | null>(null);
	$effect(() => {
		if (!undo.label) ghost = null;
	});

	function remove(i: number) {
		const gone = $state.snapshot(blocks[i]) as Held;
		ghost = { at: i, label: `Removed the ${NAMES[gone.kind]}` };
		removing(`Removed the ${NAMES[gone.kind]}`, () => {
			const now = readBlocks(read());
			now.splice(Math.min(i, now.length), 0, {
				...gone,
				__sep: i === 0 ? '' : gone.__sep || '\n\n'
			});
			if (i === 0 && now[1]) now[1].__sep = now[1].__sep || '\n\n';
			write(joinBlocks(now));
		});
		blocks.splice(i, 1);
		emit();
	}

	function itemEnter(b: Held & { kind: 'list' }, j: number, i: number) {
		if (!b.items[j].trim() && j === b.items.length - 1) {
			// Enter on an empty last item leaves the list.
			b.items.splice(j, 1);
			insertAfter(i, 'para');
			return;
		}
		b.items.splice(j + 1, 0, '');
		emit();
		void tick().then(() =>
			root.querySelectorAll<HTMLElement>(`[data-block="${b.key}"] .rich`)[j + 1]?.focus()
		);
	}

	function itemBack(b: Held & { kind: 'list' }, j: number, i: number) {
		if (b.items.length === 1) {
			dropEmpty(i);
			return;
		}
		b.items.splice(j, 1);
		emit();
		void tick().then(() =>
			root
				.querySelectorAll<HTMLElement>(`[data-block="${b.key}"] .rich`)
				[Math.max(0, j - 1)]?.focus()
		);
	}

	const LABELS: Record<Held['kind'], string> = {
		para: 'Paragraph',
		heading: 'Sub-heading',
		list: 'Bullet list',
		table: 'Table',
		quote: 'Quote',
		rule: 'Dividing line',
		raw: 'Text'
	};

	const ADD: { kind: Held['kind']; label: string }[] = [
		{ kind: 'para', label: 'Paragraph' },
		{ kind: 'heading', label: 'Sub-heading' },
		{ kind: 'list', label: 'Bullet list' },
		{ kind: 'table', label: 'Table' }
	];
</script>

{#snippet ghostAt(at: number)}
	{#if ghost && ghost.at === at && undo.label}
		<p class="ghost" role="status">
			{ghost.label}.
			<button type="button" class="quiet" onclick={() => undoRemove()}>Undo</button>
		</p>
	{/if}
{/snippet}

<div class="blocks" bind:this={root}>
	{#each blocks as b, i (b.key)}
		{@render ghostAt(i)}
		<div class="block {b.kind}" class:compact data-block={b.key}>
			{#if !compact}
				<span class="block-label" aria-hidden="true"
					>{b.kind === 'list' && b.ordered ? 'Numbered list' : LABELS[b.kind]}</span
				>
			{/if}
			{#if b.kind === 'para'}
				<RichText
					class="inplace"
					value={b.text}
					multiline
					label="Paragraph"
					placeholder="Type a paragraph"
					onchange={(v) => {
						b.text = v;
						emit();
					}}
					onenter={() => insertAfter(i, 'para')}
					onemptyback={() => dropEmpty(i)}
				/>
			{:else if b.kind === 'heading' && headingLocked(b.text)}
				<p class="from-parts locked-heading" title="Follows Marking criteria. Change it there.">
					{b.text}
				</p>
				<p class="locked-note">This part’s heading follows Marking criteria. Change it there.</p>
			{:else if b.kind === 'heading'}
				<RichText
					class="inplace sub"
					value={b.text}
					label="Sub-heading"
					placeholder="Sub-heading"
					onchange={(v) => {
						b.text = v;
						emit();
					}}
					onenter={() => insertAfter(i, 'para')}
					onemptyback={() => dropEmpty(i)}
				/>
			{:else if b.kind === 'list'}
				<svelte:element
					this={b.ordered ? 'ol' : 'ul'}
					class="items"
					class:ordered={b.ordered}
					start={b.ordered ? b.start : undefined}
				>
					{#each b.items as item, j (j)}
						<li>
							<RichText
								class="inplace"
								value={item}
								label="List item {j + 1}"
								placeholder="List item"
								onchange={(v) => {
									b.items[j] = v;
									emit();
								}}
								onenter={() => itemEnter(b, j, i)}
								onemptyback={() => itemBack(b, j, i)}
							/>
						</li>
					{/each}
				</svelte:element>
			{:else if b.kind === 'table' && marksLocked && partsTable(b)}
				<!-- Made from Marking criteria: drawn, never typed. -->
				<table class="grid made">
					<thead>
						<tr>
							{#each b.head as h, c (c)}<th scope="col">{h.replace(/[*_]/g, '')}</th>{/each}
						</tr>
					</thead>
					<tbody>
						{#each b.rows as row, r (r)}
							<tr>
								{#each [...b.head.keys()] as c (c)}<td>{(row[c] ?? '').replace(/[*_]/g, '')}</td
									>{/each}
							</tr>
						{/each}
					</tbody>
				</table>
				<p class="locked-note">
					This table is made from Marking criteria: its parts, Where and marks. Change the parts
					there.
				</p>
			{:else if b.kind === 'table'}
				<div class="grid-wrap">
					<table class="grid">
						<thead>
							<tr>
								{#each b.head as h, c (c)}
									<th>
										<RichText
											class="inplace"
											value={h}
											label="Column {c + 1} heading"
											placeholder="Heading"
											onchange={(v) => {
												b.head[c] = v;
												emit();
											}}
										/>
									</th>
								{/each}
								<th class="edge"></th>
							</tr>
						</thead>
						<tbody>
							{#each b.rows as row, r (r)}
								<tr>
									{#each [...b.head.keys()] as c (c)}
										<td>
											<RichText
												class="inplace"
												value={row[c] ?? ''}
												label="Row {r + 1}, {b.head[c] || `column ${c + 1}`}"
												onchange={(v) => {
													row[c] = v;
													emit();
												}}
											/>
										</td>
									{/each}
									<td class="edge">
										<button
											type="button"
											class="icon quiet row-remove"
											aria-label="Remove row {r + 1}{row[0]
												? ` (${row[0].replace(/[*_]/g, '')})`
												: ''}"
											title="Remove this row"
											onclick={() => {
												const gone = [...row];
												removing('Removed a table row', () =>
													putBackIn(i, (x) => {
														if (x.kind === 'table')
															x.rows.splice(Math.min(r, x.rows.length), 0, gone);
													})
												);
												b.rows.splice(r, 1);
												emit();
											}}
										>
											<Icon name="close" size={14} />
										</button>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else if b.kind === 'quote'}
				<RichText
					class="inplace quote"
					value={b.text}
					multiline
					label="Quoted text"
					placeholder="Quoted text"
					onchange={(v) => {
						b.text = v;
						emit();
					}}
					onemptyback={() => dropEmpty(i)}
				/>
			{:else if b.kind === 'rule'}
				<hr />
			{:else}
				<p class="raw-note">The editor can’t lay this part out, so it’s shown as text.</p>
				<textarea
					class="raw"
					value={b.text}
					aria-label="Text the editor can’t lay out"
					oninput={(e) => {
						b.text = e.currentTarget.value;
						emit();
					}}></textarea>
			{/if}

			{#if !compact}
				<!-- The block's own tools, under it, while you're in it. -->
				<div class="block-tools">
					{#if b.kind === 'list'}
						<button
							type="button"
							class="quiet small"
							onclick={() => {
								b.items.push('');
								emit();
								void focusBlock(b.key, true);
							}}
						>
							<Icon name="plus" size={14} /> Add an item
						</button>
						<button
							type="button"
							class="quiet small"
							onclick={() => {
								b.ordered = !b.ordered;
								emit();
							}}
						>
							{b.ordered ? 'Use bullets' : 'Use numbers'}
						</button>
					{:else if b.kind === 'table' && !(marksLocked && partsTable(b))}
						<button
							type="button"
							class="quiet small"
							onclick={() => {
								b.rows.push(b.head.map(() => ''));
								emit();
							}}
						>
							<Icon name="plus" size={14} /> Add a row
						</button>
						<button
							type="button"
							class="quiet small"
							onclick={() => {
								b.head.push('');
								for (const row of b.rows) row.push('');
								emit();
							}}
						>
							<Icon name="plus" size={14} /> Add a column
						</button>
						{#if b.head.length > 1}
							<button
								type="button"
								class="quiet small"
								onclick={() => {
									const head = b.head.at(-1) ?? '';
									const cells = b.rows.map((row) => row[b.head.length - 1] ?? '');
									removing('Removed a table column', () =>
										putBackIn(i, (x) => {
											if (x.kind !== 'table') return;
											x.head.push(head);
											x.rows.forEach((row, k) => row.push(cells[k] ?? ''));
										})
									);
									b.head.pop();
									for (const row of b.rows) row.splice(b.head.length);
									emit();
								}}
							>
								Remove the last column
							</button>
						{/if}
					{/if}
					<button type="button" class="quiet small danger" onclick={() => remove(i)}>
						<Icon name="bin" size={14} /> Remove {NAMES[b.kind]}
					</button>
				</div>
			{/if}
		</div>
	{/each}
	{@render ghostAt(blocks.length)}
	{#if !compact}
		<div class="add-row">
			<span>Add</span>
			{#each ADD as a (a.kind)}
				<button
					type="button"
					class="quiet small"
					onclick={() => insertAfter(blocks.length - 1, a.kind)}
				>
					<Icon name="plus" size={14} />
					{a.label}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.blocks {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.ghost {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 0;
		padding: 6px 10px;
		background: var(--sunk);
		border: 1px dashed var(--field-edge);
		border-radius: 2px;
		font-size: 14px;
		color: var(--ink-2);
	}

	.ghost button {
		min-height: 30px;
		padding: 0 10px;
		font-weight: 800;
		color: var(--house-deep);
	}

	.block-label {
		display: block;
		margin-bottom: 4px;
		font-size: 13px;
		font-weight: 700;
		color: var(--ink-2);
	}

	.block {
		position: relative;
	}

	.block :global(.rich.inplace) {
		font-size: 15px;
		line-height: 1.6;
	}

	.block :global(.rich.sub) {
		font-size: 18px;
		font-weight: 800;
		line-height: 1.3;
	}

	.block :global(.rich.quote) {
		padding-left: 14px;
		font-style: italic;
		box-shadow: inset 2px 0 0 var(--rule-strong);
	}

	.items {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin: 0;
		padding-left: 22px;
		list-style: square;
	}

	.items.ordered {
		list-style: decimal;
	}

	.items li::marker {
		color: var(--house-deep);
		font-weight: 800;
	}

	.grid-wrap {
		overflow-x: auto;
		overflow-y: hidden;
	}

	.grid {
		width: 100%;
		border-collapse: collapse;
		font-size: 15px;
	}

	.grid th,
	.grid td {
		min-width: 90px;
		padding: 2px 10px 2px 0;
		vertical-align: top;
		text-align: left;
		border-bottom: 1px solid var(--rule);
	}

	.grid thead th {
		border-bottom: 2px solid var(--ink);
		font-size: 13px;
	}

	.grid th :global(.rich) {
		font-weight: 800;
	}

	.grid .edge {
		width: 34px;
		min-width: 34px;
		padding-right: 0;
	}

	/* Locked: plain text, muted, never a box, so it can't be mistaken for a field. */
	.from-parts {
		display: inline-block;
		padding: 9px 0;
		font-weight: 700;
		color: var(--muted);
		cursor: help;
	}

	.locked-heading {
		margin: 0;
		font-size: 18px;
		font-weight: 800;
	}

	.grid.made td,
	.grid.made th {
		padding: 9px 10px 9px 0;
		color: var(--ink-2);
	}

	.locked-note {
		margin: 4px 0 0;
		font-size: 13px;
		color: var(--muted);
	}

	.row-remove {
		opacity: 0;
	}

	tr:hover .row-remove,
	tr:focus-within .row-remove {
		opacity: 1;
	}

	/* A block's tools show while you're in it. */
	/* A block's tools show under the block you're in; Done stays pinned, so nothing you're aiming at moves. */
	.block-tools {
		display: none;
		flex-wrap: wrap;
		gap: 4px;
		margin: 4px 0 2px;
	}

	.block:focus-within .block-tools {
		display: flex;
	}

	button.small {
		min-height: 30px;
		padding: 0 8px;
		font-size: 13px;
		font-weight: 750;
		color: var(--house-deep);
	}

	button.danger {
		color: var(--warn-deep);
	}

	hr {
		margin: 10px 0;
		border: 0;
		border-top: 1px solid var(--rule-strong);
	}

	.raw-note {
		margin: 0 0 4px;
		font-size: 13px;
		color: var(--muted);
	}

	.raw {
		width: 100%;
		font-family: var(--mono, ui-monospace, monospace);
		font-size: 13px;
	}

	.add-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px;
		margin-top: 10px;
		padding-top: 8px;
		border-top: 1px dashed var(--field-edge);
	}

	.add-row span {
		margin-right: 4px;
		font-size: 13px;
		font-weight: 700;
		color: var(--ink-2);
	}

	@media (max-width: 560px) {
		.row-remove {
			opacity: 1;
		}
	}
</style>
