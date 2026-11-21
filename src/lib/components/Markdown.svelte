<script lang="ts" module>
	export interface TopicMark {
		ids: { id: string; known: boolean }[];
		note?: string;
	}
</script>

<script lang="ts">
	// Notification Markdown drawn in the house style. A table headed "Marks"
	// is a rubric: each mark band sits in a leading cell as a condensed figure.
	// A line that opens with an outcome code puts the code in a leading cell.
	// `topic` can mark a bullet that is one of the spec's topic lines with its
	// dot point ids.
	import { plain, type Block } from '#lib/domain/markdown.ts';
	import MdInline from './MdInline.svelte';
	import Self from './Markdown.svelte';

	let { blocks, topic }: { blocks: Block[]; topic?: (text: string) => TopicMark | undefined } =
		$props();

	const CODE = /^([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-\d+[A-Z]?)\s+(.+)$/;

	const isRubric = (block: Extract<Block, { kind: 'table' }>) =>
		/^marks?$/i.test(plain(block.head?.[0] ?? []));

	const loneStrong = (block: Block) =>
		block.kind === 'paragraph' && block.inline.length === 1 && block.inline[0].kind === 'strong';

	function itemTopic(item: Block[]): TopicMark | undefined {
		const first = item[0];
		return topic && first?.kind === 'paragraph' ? topic(plain(first.inline)) : undefined;
	}
</script>

{#each blocks as block, b (b)}
	{#if block.kind === 'heading'}
		{#if block.level <= 3}
			<h3 class="md-h3"><MdInline nodes={block.inline} /></h3>
		{:else}
			<h4 class="md-h4"><MdInline nodes={block.inline} /></h4>
		{/if}
	{:else if block.kind === 'paragraph'}
		{@const text = plain(block.inline)}
		{@const code = text.match(CODE)}
		{#if loneStrong(block)}
			<p class="md-lead"><MdInline nodes={block.inline} /></p>
		{:else if code && block.inline.length === 1 && block.inline[0].kind === 'text'}
			<p class="md-coded"><span class="md-code">{code[1]}</span><span>{code[2]}</span></p>
		{:else}
			<p class="md-p"><MdInline nodes={block.inline} /></p>
		{/if}
	{:else if block.kind === 'list'}
		<svelte:element
			this={block.ordered ? 'ol' : 'ul'}
			class="md-list"
			class:ordered={block.ordered}
		>
			{#each block.items as item, i (i)}
				{@const mark = itemTopic(item)}
				<li class:topic={!!mark}>
					{#if mark}
						<span class="topic-ids">
							{#each mark.ids as { id, known } (id)}
								<span
									class:unknown={!known}
									title={known ? undefined : 'Not in the unit’s dot points'}>{id}</span
								>
							{:else}
								<span class="no-id">No id</span>
							{/each}
						</span>
						<div class="topic-text">
							<Self blocks={item} />
							{#if mark.note}<p class="topic-note">{mark.note}</p>{/if}
						</div>
					{:else}
						<Self blocks={item} />
					{/if}
				</li>
			{/each}
		</svelte:element>
	{:else if block.kind === 'table'}
		{#if isRubric(block)}
			<table class="rubric">
				<thead>
					<tr>
						{#each block.head ?? [] as cell, c (c)}<th scope="col"><MdInline nodes={cell} /></th
							>{/each}
					</tr>
				</thead>
				<tbody>
					{#each block.rows as row, r (r)}
						<tr>
							{#each row as cell, c (c)}
								{#if c === 0}
									<th scope="row" class="band"><MdInline nodes={cell} /></th>
								{:else}
									<td><MdInline nodes={cell} /></td>
								{/if}
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		{:else}
			<div class="md-table-wrap">
				<table class="md-table">
					{#if block.head}
						<thead>
							<tr>
								{#each block.head as cell, c (c)}<th scope="col"><MdInline nodes={cell} /></th
									>{/each}
							</tr>
						</thead>
					{/if}
					<tbody>
						{#each block.rows as row, r (r)}
							<tr>
								{#each row as cell, c (c)}<td><MdInline nodes={cell} /></td>{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{:else if block.kind === 'quote'}
		<blockquote class="md-quote"><Self blocks={block.blocks} {topic} /></blockquote>
	{/if}
{/each}

<style>
	.md-h3 {
		margin: 26px 0 8px;
		font-size: 20px;
		font-weight: 850;
		font-stretch: 72%;
	}

	.md-h4 {
		margin: 18px 0 6px;
		font-size: 15px;
		font-weight: 750;
	}

	.md-h3:first-child,
	.md-h4:first-child,
	.md-p:first-child,
	.md-lead:first-child,
	.md-coded:first-child {
		margin-top: 0;
	}

	.md-p {
		margin: 0 0 10px;
		max-width: var(--measure);
	}

	.md-lead {
		margin: 14px 0 6px;
		font-size: 14px;
		color: var(--ink-2);
	}

	.md-coded {
		display: grid;
		grid-template-columns: 82px minmax(0, 1fr);
		gap: 12px;
		margin: 0 0 6px;
		font-size: 14px;
		color: var(--ink-2);
		max-width: calc(var(--measure) + 94px);
	}

	.md-code {
		font-weight: 750;
		color: var(--house-deep);
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	.md-list {
		margin: 0 0 12px;
		padding-left: 20px;
		max-width: var(--measure);
	}

	.md-list:not(.ordered) {
		list-style: none;
		padding-left: 18px;
	}

	.md-list:not(.ordered) > li {
		position: relative;
	}

	.md-list:not(.ordered) > li::before {
		content: '';
		position: absolute;
		left: -16px;
		top: 0.62em;
		width: 6px;
		height: 6px;
		background: var(--house);
	}

	.md-list > li + li {
		margin-top: 4px;
	}

	.md-list :global(.md-p) {
		margin-bottom: 4px;
	}

	.md-list :global(.md-list) {
		margin: 4px 0 4px;
	}

	.md-list:has(> li.topic) {
		padding-left: 0;
		max-width: none;
	}

	.md-list > li.topic {
		display: grid;
		grid-template-columns: 112px minmax(0, 1fr);
		gap: 12px;
		padding: 7px 0;
		border-bottom: 1px solid var(--rule);
	}

	.md-list > li.topic + li.topic {
		margin-top: 0;
	}

	.md-list > li.topic::before {
		display: none;
	}

	.topic-ids {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding-top: 2px;
		font-size: 13px;
		font-weight: 750;
		color: var(--house-deep);
		font-variant-numeric: tabular-nums;
	}

	.topic-ids .unknown {
		color: var(--warn-deep);
		text-decoration: line-through;
		text-decoration-thickness: 2px;
	}

	.topic-ids .no-id {
		font-weight: 600;
		color: var(--muted);
	}

	.topic-text {
		max-width: var(--measure);
	}

	.topic-text :global(.md-p) {
		margin: 0;
	}

	.topic-note {
		margin: 2px 0 0;
		font-size: 13px;
		color: var(--note-deep);
	}

	.md-quote {
		margin: 0 0 12px;
		padding: 10px 14px;
		background: var(--paper);
		border: 1px solid var(--rule);
		font-style: italic;
	}

	.md-table-wrap {
		overflow-x: auto;
		margin: 0 0 14px;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 14px;
	}

	thead th {
		text-align: left;
		font-size: 12px;
		font-weight: 700;
		color: var(--muted);
		padding: 0 10px 6px 0;
		border-bottom: 2px solid var(--ink);
	}

	td,
	tbody th {
		text-align: left;
		vertical-align: top;
		padding: 9px 10px 9px 0;
		border-bottom: 1px solid var(--rule);
	}

	.md-table td:first-child {
		font-weight: 650;
	}

	.rubric {
		margin: 12px 0 18px;
	}

	.rubric:first-child {
		margin-top: 0;
	}

	.rubric thead th:first-child {
		width: 96px;
	}

	.rubric tbody td {
		max-width: var(--measure);
		line-height: 1.5;
		color: var(--ink);
	}

	.rubric .band {
		padding-top: 6px;
		font-size: 34px;
		font-weight: 900;
		font-stretch: 70%;
		line-height: 1;
		color: var(--house);
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	.rubric tbody tr:first-child .band {
		color: var(--house-deep);
	}

	@media (max-width: 640px) {
		.md-coded {
			grid-template-columns: 1fr;
			gap: 0;
		}

		.rubric thead th:first-child {
			width: 76px;
		}

		.rubric .band {
			font-size: 28px;
		}
	}
</style>
