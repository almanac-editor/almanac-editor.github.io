<script lang="ts">
	// Marking criteria edited as the rubric students read: each part's
	// heading ("Part 1: Design brief (5 marks, at home)"), its outcome lines,
	// and its mark ranges with the marks as big figures beside what earns
	// them. Every piece is edited in place. A part's move, split and remove
	// sit in one small menu; a removal can be undone from the save bar.
	import BlocksEditor from './BlocksEditor.svelte';
	import Icon from './Icon.svelte';
	import RichText from './RichText.svelte';
	import {
		blankCriterion,
		blankPart,
		criteriaMarks,
		topMark,
		type CriteriaBody,
		type Criterion,
		type Part
	} from '#lib/domain/notificationEdit.ts';
	import { removing, undo, undoRemove } from '#lib/undo.svelte.ts';

	let { body = $bindable() }: { body: CriteriaBody } = $props();

	const WHERE = ['at home', 'in class'];
	const numberOf = (label: string) => /\d+/.exec(label)?.[0] ?? '';

	function wholeOrNull(value: string): number | null {
		const n = Number(value);
		return value.trim() === '' || !Number.isFinite(n) ? null : n;
	}

	/** Parts labelled "Part N" follow their order; any other label is the teacher's own. */
	function renumber() {
		body.parts.forEach((p, i) => {
			if (p.kind === 'part' && /^Part \d+$/.test(p.label) && p.label !== `Part ${i + 1}`) {
				p.label = `Part ${i + 1}`;
			}
		});
	}

	function movePart(i: number, by: -1 | 1) {
		const j = i + by;
		if (j < 0 || j >= body.parts.length) return;
		[body.parts[i], body.parts[j]] = [body.parts[j], body.parts[i]];
		renumber();
	}

	/** Where the last part removal was, to offer Undo in its place. */
	let ghost = $state<{ at: number; label: string } | null>(null);
	$effect(() => {
		if (!undo.label) ghost = null;
	});

	function removePart(i: number) {
		const gone = $state.snapshot(body.parts[i]) as Part;
		const list = body.parts;
		ghost = {
			at: i,
			label: `Removed ${gone.kind === 'part' ? gone.name || gone.label : 'a part'}`
		};
		removing(`Removed ${gone.kind === 'part' ? gone.name || gone.label : 'a part'}`, () => {
			list.splice(Math.min(i, list.length), 0, gone);
			renumber();
		});
		body.parts.splice(i, 1);
		renumber();
	}

	function split(part: Part) {
		const only = part.criteria[0];
		part.criteria = [{ ...only, name: '', marks: part.marks }, blankCriterion('')];
	}

	function removeCriterion(part: Part, i: number) {
		const gone = $state.snapshot(part.criteria[i]) as Criterion;
		const list = part.criteria;
		removing(`Removed ${gone.name || 'a criterion'}`, () =>
			list.splice(Math.min(i, list.length), 0, gone)
		);
		part.criteria.splice(i, 1);
		if (part.criteria.length === 1 && part.criteria[0].name !== null && !part.criteria[0].name) {
			part.criteria[0] = { ...part.criteria[0], name: null, marks: null };
		}
	}

	function removeRange(c: Criterion, i: number) {
		const gone = { ...c.ranges[i] };
		const list = c.ranges;
		removing('Removed a mark range', () => list.splice(Math.min(i, list.length), 0, gone));
		c.ranges.splice(i, 1);
	}

	/** The highest top mark among a criterion's ranges. */
	const topOf = (c: Criterion) => Math.max(0, ...c.ranges.map((r) => topMark(r.marks) ?? 0));

	/** Makes the range holding the top mark start at `worth`: "5" -> "6", "10-9" -> "11-9". */
	function setTop(c: Criterion, worth: number) {
		const top = topOf(c);
		const r = c.ranges.find((x) => topMark(x.marks) === top);
		if (r) r.marks = r.marks.replace(/\d+/, String(worth));
	}

	const close = (e: Event) =>
		(e.currentTarget as HTMLElement).closest('details')?.removeAttribute('open');
</script>

{#snippet fixTop(c: Criterion, worth: number | null)}
	{#if worth !== null && c.ranges.length && topOf(c) !== worth}
		<p class="fix">
			The top mark range is {topOf(c)}, but this is worth {worth}.
			<button type="button" onclick={() => setTop(c, worth)}>Make the top range {worth}</button>
		</p>
	{/if}
{/snippet}

{#snippet rubric(c: Criterion, owner: string)}
	<table class="rubric">
		<thead>
			<tr>
				<th scope="col">Marks</th>
				<th scope="col">Criteria</th>
				<th class="edge"><span class="sr-only">Remove</span></th>
			</tr>
		</thead>
		<tbody>
			{#each c.ranges as r, i (i)}
				<tr>
					<td>
						<input
							class="inplace num band"
							type="text"
							inputmode="numeric"
							bind:value={r.marks}
							placeholder="5"
							aria-label="Marks, row {i + 1} of {owner}"
						/>
					</td>
					<td>
						<RichText
							class="inplace"
							value={r.text}
							label="What earns {r.marks || 'these'} marks in {owner}"
							placeholder="What earns these marks"
							onchange={(v) => (r.text = v)}
							onenter={() => c.ranges.splice(i + 1, 0, { marks: '', text: '' })}
						/>
					</td>
					<td class="edge">
						<button
							type="button"
							class="icon quiet row-remove"
							aria-label="Remove mark range {r.marks || i + 1} of {owner}"
							title="Remove this mark range"
							onclick={() => removeRange(c, i)}
						>
							<Icon name="close" size={14} />
						</button>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
	<button type="button" class="quiet add" onclick={() => c.ranges.push({ marks: '', text: '' })}>
		<Icon name="plus" size={14} /> Add a mark range
	</button>
{/snippet}

{#if body.intro.text || !body.parts.length}
	<div class="intro">
		<BlocksEditor host={body.intro} compact />
	</div>
{/if}

{#snippet ghostAt(at: number)}
	{#if ghost && ghost.at === at && undo.label}
		<p class="ghost" role="status">
			{ghost.label}.
			<button type="button" class="quiet" onclick={() => undoRemove()}>Undo</button>
		</p>
	{/if}
{/snippet}

<ol class="parts">
	{#each body.parts as part, p (p)}
		{#if ghost && ghost.at === p && undo.label}<li class="ghost-li">{@render ghostAt(p)}</li>{/if}
		<li class="part">
			{#if part.kind === 'text-part'}
				<p class="hint">
					This part isn’t written in the form the editor reads as criteria, so it’s shown as text.
				</p>
				<textarea class="raw" bind:value={part.text} aria-label="Part, as text"></textarea>
			{:else}
				{@const owner = part.name || part.label}
				{@const where = part.where.trim().toLowerCase()}
				<div class="part-h">
					{#if /^Part \d+$/.test(part.label)}
						<span class="label">Part {numberOf(part.label)}:</span>
					{:else}
						<input
							class="inplace label-in"
							type="text"
							bind:value={part.label}
							aria-label="Part label"
						/>
					{/if}
					<input
						class="inplace name"
						type="text"
						bind:value={part.name}
						placeholder="Name this part"
						aria-label="{part.label} name"
					/>
					<span class="paren">
						(<input
							class="inplace num marks"
							type="text"
							inputmode="numeric"
							value={part.marks ?? ''}
							oninput={(e) => (part.marks = wholeOrNull(e.currentTarget.value))}
							aria-label="Marks for {part.label}"
						/> marks)
					</span>
					<details class="more part-menu">
						<summary aria-label="More for {part.label}">
							More <Icon name="down" size={14} />
						</summary>
						<div class="menu">
							<button
								type="button"
								class="quiet"
								disabled={p === 0}
								onclick={(e) => {
									close(e);
									movePart(p, -1);
								}}
							>
								<Icon name="up" size={14} /> Move part up
							</button>
							<button
								type="button"
								class="quiet"
								disabled={p === body.parts.length - 1}
								onclick={(e) => {
									close(e);
									movePart(p, 1);
								}}
							>
								<Icon name="down" size={14} /> Move part down
							</button>
							{#if part.criteria.length === 1 && part.criteria[0].name === null}
								<button
									type="button"
									class="quiet"
									onclick={(e) => {
										close(e);
										split(part);
									}}
								>
									<Icon name="plus" size={14} /> Split into criteria
								</button>
							{/if}
							<button
								type="button"
								class="quiet danger"
								onclick={(e) => {
									close(e);
									removePart(p);
								}}
							>
								<Icon name="bin" size={14} /> Remove part
							</button>
						</div>
					</details>
				</div>

				<div class="where" role="group" aria-label="Where {part.label} is done">
					<span>Where</span>
					{#each WHERE as w (w)}
						<button
							type="button"
							class="pick"
							aria-pressed={where === w}
							onclick={() => (part.where = w)}>{w[0].toUpperCase() + w.slice(1)}</button
						>
					{/each}
					<input
						class="inplace other"
						type="text"
						value={WHERE.includes(where) ? '' : part.where}
						oninput={(e) => (part.where = e.currentTarget.value)}
						placeholder="Other"
						aria-label="Where, in your own words"
					/>
				</div>

				<div class="outcomes">
					<span class="small-label">Outcomes and notes for students</span>
					<BlocksEditor host={part} field="intro" compact />
				</div>

				{#if part.criteria.length === 1 && part.criteria[0].name === null}
					{@render rubric(part.criteria[0], owner)}
					{@render fixTop(part.criteria[0], part.marks)}
				{:else}
					{#each part.criteria as c, i (i)}
						<div class="criterion">
							<div class="crit-h">
								<input
									class="inplace crit-name"
									type="text"
									value={c.name ?? ''}
									oninput={(e) => (c.name = e.currentTarget.value)}
									placeholder="Name this criterion"
									aria-label="Criterion name"
								/>
								<span class="paren">
									(<input
										class="inplace num marks"
										type="text"
										inputmode="numeric"
										value={c.marks ?? ''}
										oninput={(e) => (c.marks = wholeOrNull(e.currentTarget.value))}
										aria-label="Marks for {c.name || 'this criterion'}"
									/> marks)
								</span>
								<button
									type="button"
									class="quiet crit-remove"
									onclick={() => removeCriterion(part, i)}
								>
									Remove criterion
								</button>
							</div>
							{@render rubric(c, c.name || owner)}
							{@render fixTop(c, c.marks)}
						</div>
					{/each}
					<button
						type="button"
						class="quiet add"
						onclick={() => part.criteria.push(blankCriterion(''))}
					>
						<Icon name="plus" size={14} /> Add a criterion
					</button>
					{@const sum = criteriaMarks(part)}
					{#if sum !== null && part.marks !== null && sum !== part.marks}
						<p class="fix">
							Its criteria add up to {sum}, but {part.label} is worth {part.marks}.
							<button type="button" onclick={() => (part.marks = sum)}>
								Make {part.label} worth {sum}
							</button>
						</p>
					{/if}
				{/if}
			{/if}
		</li>
	{/each}
	{#if ghost && ghost.at >= body.parts.length && undo.label}<li class="ghost-li">
			{@render ghostAt(ghost.at)}
		</li>{/if}
</ol>
<button
	type="button"
	class="quiet add strong"
	onclick={() => body.parts.push(blankPart(body.parts.length + 1))}
>
	<Icon name="plus" size={16} /> Add a part
</button>

<style>
	.ghost {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 8px 0;
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

	.parts {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.part {
		padding: 18px 0 14px;
		border-top: 1px solid var(--rule);
	}

	/* The part's heading reads as the notification writes it. */
	.part-h {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 2px 8px;
		font-size: 22px;
		font-weight: 850;
		font-stretch: 72%;
	}

	.label {
		white-space: nowrap;
	}

	.label-in {
		width: 8em;
	}

	.name {
		flex: 1 1 220px;
		min-width: 0;
	}

	.paren {
		display: inline-flex;
		align-items: baseline;
		gap: 2px;
		font-size: 15px;
		font-weight: 650;
		font-stretch: 100%;
		white-space: nowrap;
		color: var(--ink-2);
	}

	.marks {
		width: 3.4em;
		text-align: center;
		font-weight: 900;
		font-variant-numeric: tabular-nums;
	}

	.part-menu {
		margin-left: auto;
		font-size: 14px;
		font-weight: 650;
		font-stretch: 100%;
	}

	.where {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 6px;
		margin: 8px 0 6px;
		font-size: 13px;
	}

	.where > span {
		margin-right: 4px;
		font-weight: 700;
		color: var(--ink-2);
	}

	.pick {
		min-height: 32px;
		padding: 0 12px;
		background: var(--paper);
		border-color: var(--field-edge);
		font-size: 13px;
	}

	.pick[aria-pressed='true'] {
		background: var(--house);
		border-color: var(--house);
		color: var(--house-on);
	}

	.other {
		width: 9em;
	}

	.small-label {
		display: block;
		margin-bottom: 4px;
		font-size: 13px;
		font-weight: 700;
		color: var(--ink-2);
	}

	.outcomes {
		margin: 4px 0 8px;
		font-size: 14px;
		color: var(--ink-2);
	}

	.criterion {
		margin-top: 14px;
	}

	.crit-h {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 2px 8px;
	}

	.crit-name {
		flex: 1 1 200px;
		min-width: 0;
		font-size: 15px;
		font-weight: 800;
	}

	/* The rubric: marks as big figures beside what earns them. */
	.rubric {
		width: 100%;
		margin: 8px 0 2px;
		border-collapse: collapse;
	}

	.rubric th {
		padding: 4px 8px 6px 0;
		border-bottom: 2px solid var(--ink);
		font-size: 13px;
		font-weight: 800;
		text-align: left;
	}

	.rubric th:first-child {
		width: 96px;
	}

	.rubric td {
		padding: 4px 8px 4px 0;
		vertical-align: top;
		border-bottom: 1px solid var(--rule);
		line-height: 1.5;
	}

	.band {
		width: 84px;
		font-size: 30px;
		font-weight: 900;
		font-stretch: 70%;
		line-height: 1.1;
		color: var(--house);
		font-variant-numeric: tabular-nums;
	}

	.rubric tbody tr:first-child .band {
		color: var(--house-deep);
	}

	.rubric .edge {
		width: 36px;
		padding-right: 0;
	}

	.row-remove,
	.crit-remove {
		opacity: 0;
	}

	tr:hover .row-remove,
	tr:focus-within .row-remove,
	.crit-h:hover .crit-remove,
	.crit-h:focus-within .crit-remove {
		opacity: 1;
	}

	.crit-remove {
		min-height: 30px;
		padding: 0 8px;
		font-size: 13px;
		color: var(--warn-deep);
	}

	.danger {
		color: var(--warn-deep);
	}

	.add {
		min-height: 32px;
		margin-top: 4px;
		padding: 0 8px;
		font-size: 13px;
		font-weight: 750;
		color: var(--house-deep);
	}

	.add.strong {
		margin-top: 12px;
		font-size: 14px;
	}

	.fix {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 10px;
		margin: 6px 0;
		padding: 6px 10px;
		background: var(--warn-soft);
		border-radius: 2px;
		font-size: 13px;
		color: var(--warn-deep);
	}

	.fix button {
		min-height: 30px;
		padding: 0 10px;
		background: var(--paper);
		border: 1px solid currentColor;
		font-size: 13px;
		font-weight: 750;
		color: var(--warn-deep);
	}

	.intro {
		margin-bottom: 10px;
	}

	.hint {
		margin: 0 0 6px;
		font-size: 13px;
		color: var(--muted);
	}

	.raw {
		width: 100%;
		font-family: var(--mono, ui-monospace, monospace);
		font-size: 13px;
	}

	/* The part's menu, like the section's. */
	.more {
		position: relative;
	}

	.more summary {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 32px;
		padding: 0 10px;
		background: var(--paper);
		border: 1px solid var(--field-edge);
		border-radius: 2px;
		cursor: pointer;
		list-style: none;
	}

	.more summary::-webkit-details-marker {
		display: none;
	}

	.more .menu {
		position: absolute;
		top: calc(100% + 4px);
		right: 0;
		z-index: 3;
		display: flex;
		flex-direction: column;
		min-width: 200px;
		padding: 6px;
		background: var(--paper);
		border: 1px solid var(--field-edge);
		border-radius: 2px;
		box-shadow: var(--shadow);
	}

	.more .menu button {
		justify-content: flex-start;
	}

	@media (max-width: 560px) {
		.part-h {
			font-size: 18px;
		}

		.rubric th:first-child {
			width: 70px;
		}

		.band {
			width: 64px;
			font-size: 22px;
		}

		.row-remove,
		.crit-remove {
			opacity: 1;
		}
	}
</style>
