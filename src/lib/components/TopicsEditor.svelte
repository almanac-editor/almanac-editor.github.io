<script lang="ts">
	// The Assessable topics section: the units the task examines, then each
	// topic line in the notification's order with its dot points beside it.
	// Choosing a topic opens its unit, phase and note, and the dot points of
	// its unit to link from.
	import BlocksEditor from './BlocksEditor.svelte';
	import Icon from './Icon.svelte';
	import { removing } from '#lib/undo.svelte.ts';
	import { blankText, blankTopic, type Row, type TopicRow } from '#lib/domain/assessmentEdit.ts';
	import type { RegistryEntry, Unit } from '#lib/domain/types.ts';
	import { humanise } from '#lib/house.ts';

	let {
		rows = $bindable(),
		examined = $bindable(),
		units,
		problems,
		why
	}: {
		rows: Row[];
		examined: string[];
		/** Every unit the class takes or the spec names. */
		units: Map<string, Unit | null>;
		/** The syllabus check's findings. */
		problems: string[];
		/** Why the draft can't be saved yet, if it can't. */
		why: string | null;
	} = $props();

	let selected = $state<number | null>(null);
	let find = $state('');

	const titleOf = (unit: string) =>
		units.get(unit)?.unit_title ?? humanise(unit.split('/').pop() ?? unit);
	const registryOf = (unit: string): RegistryEntry[] => units.get(unit)?.syllabus_registry ?? [];

	function phasesOf(unit: string, now: string): string[] {
		const phases = [...new Set(registryOf(unit).map((e) => e.phase))];
		return now && !phases.includes(now) ? [now, ...phases] : phases;
	}

	function setUnits(next: string[]) {
		const order = [...units.keys()];
		examined = order.filter((u) => next.includes(u));
	}

	const at = $derived(selected === null ? null : rows[selected]);
	const chosen = $derived(at?.kind === 'topic' ? at : null);

	function insert(row: Row) {
		const i = selected === null ? rows.length : selected + 1;
		rows.splice(i, 0, row);
		selected = i;
	}

	function move(i: number, by: -1 | 1) {
		const j = i + by;
		if (j < 0 || j >= rows.length) return;
		[rows[i], rows[j]] = [rows[j], rows[i]];
		selected = j;
	}

	function link(t: TopicRow, unit: string, entry: RegistryEntry) {
		if (t.unit === unit && t.ids.includes(entry.id)) {
			t.ids = t.ids.filter((id) => id !== entry.id);
			return;
		}
		if (t.unit !== unit) {
			t.unit = unit;
			t.phase = entry.phase;
			t.ids = [entry.id];
		} else {
			t.ids = [...t.ids, entry.id];
			if (!t.phase) t.phase = entry.phase;
		}
		if (!t.text.trim()) t.text = entry.text;
	}

	const number = (i: number) => rows.slice(0, i + 1).filter((r) => r.kind === 'topic').length;
	const quiet = (r: Row) =>
		r.kind === 'text' && r.__raw !== undefined && /^(-{3,})?$/.test(r.text.trim());
</script>

<fieldset class="units">
	<legend>Units examined</legend>
	{#each [...units.keys()] as unit (unit)}
		<label>
			<input
				type="checkbox"
				checked={examined.includes(unit)}
				onchange={(e) =>
					setUnits(
						e.currentTarget.checked ? [...examined, unit] : examined.filter((u) => u !== unit)
					)}
			/>
			{titleOf(unit)}
		</label>
	{/each}
</fieldset>

{#if why}
	<div class="msg warn"><div>{why}</div></div>
{:else if problems.length}
	<div class="msg warn problems">
		<ul>
			{#each problems as p, i (i)}<li>{p}</li>{/each}
		</ul>
	</div>
{/if}

<ol class="rows">
	{#each rows as row, i (row)}
		<li
			class="row {row.kind}"
			class:sel={selected === i}
			hidden={quiet(row) && selected !== i}
			onfocusin={() => (selected = i)}
		>
			{#if row.kind === 'text'}
				<div class="text-row">
					<BlocksEditor host={row} compact />
				</div>
			{:else}
				{@const known = new Set(registryOf(row.unit).map((e) => e.id))}
				<div class="topic-main">
					<textarea
						class="topic-text"
						bind:value={row.text}
						rows="1"
						aria-label="Topic line {number(i)}"
						placeholder="The topic line, as students read it"
						onkeydown={(e) => e.key === 'Enter' && e.preventDefault()}></textarea>
					{#if selected !== i}
						<p class="meta">
							{row.unit ? titleOf(row.unit) : 'No unit yet'}{row.phase
								? ` · ${row.phase}`
								: ''}{row.note ? ` · Note: ${row.note}` : ''}
						</p>
					{/if}
				</div>
				<div class="ids">
					{#each row.ids as id (id)}
						<span class="id" class:unknown={known.size > 0 && !known.has(id)}>{id}</span>
					{:else}
						<span class="none">No dot point</span>
					{/each}
				</div>
				{#if selected === i}
					<div class="topic-open">
						<div class="fields">
							<label>
								<span>Unit</span>
								<select
									value={row.unit}
									onchange={(e) => {
										row.unit = e.currentTarget.value;
										row.ids = [];
									}}
								>
									{#if !row.unit}<option value="">Choose…</option>{/if}
									{#each examined.includes(row.unit) || !row.unit ? examined : [row.unit, ...examined] as u (u)}
										<option value={u}>{titleOf(u)}</option>
									{/each}
								</select>
							</label>
							<label>
								<span>Phase</span>
								<select bind:value={row.phase} disabled={!row.unit}>
									{#if !row.phase}<option value="">Choose…</option>{/if}
									{#each phasesOf(row.unit, row.phase) as p (p)}
										<option value={p}>{p}</option>
									{/each}
								</select>
							</label>
							<label class="note">
								<span>Note</span>
								<input
									type="text"
									bind:value={row.note}
									placeholder="Why the mapping is loose, partial or empty"
								/>
							</label>
						</div>
						<div class="picker">
							<label class="find">
								<Icon name="search" size={15} />
								<span class="sr-only">Find a dot point</span>
								<input type="search" bind:value={find} placeholder="Find a dot point" />
							</label>
							{#each row.unit ? [row.unit] : examined as unit (unit)}
								{@const q = find.trim().toLowerCase()}
								{@const entries = registryOf(unit).filter(
									(e) => !q || e.id.toLowerCase().includes(q) || e.text.toLowerCase().includes(q)
								)}
								{#each [...new Set(entries.map((e) => e.phase))] as phase (phase)}
									<h4>{titleOf(unit)} · {phase}</h4>
									<ul>
										{#each entries.filter((e) => e.phase === phase) as entry (entry.id)}
											{@const on = row.unit === unit && row.ids.includes(entry.id)}
											<li class:on>
												<button
													type="button"
													class="dp"
													aria-pressed={on}
													onclick={() => link(row, unit, entry)}
												>
													<b>{entry.id}</b>
													<span>{entry.text}</span>
													<i
														>{#if on}<Icon name="check" size={14} />{/if}</i
													>
												</button>
											</li>
										{/each}
									</ul>
								{:else}
									<p class="hint">
										{q ? 'No dot point matches.' : `${titleOf(unit)} has no dot points.`}
									</p>
								{/each}
							{:else}
								<p class="hint">Choose the units the task examines to link dot points.</p>
							{/each}
						</div>
					</div>
				{/if}
			{/if}
			{#if selected === i}
				<div class="tools">
					<button type="button" class="quiet" disabled={i === 0} onclick={() => move(i, -1)}>
						<Icon name="up" size={14} /> Move up
					</button>
					<button
						type="button"
						class="quiet"
						disabled={i === rows.length - 1}
						onclick={() => move(i, 1)}
					>
						<Icon name="down" size={14} /> Move down
					</button>
					<button
						type="button"
						class="quiet danger"
						onclick={() => {
							const gone = $state.snapshot(row) as Row;
							const list = rows;
							removing(row.kind === 'topic' ? 'Removed a topic' : 'Removed a sub-heading', () =>
								list.splice(Math.min(i, list.length), 0, gone)
							);
							rows.splice(i, 1);
							selected = null;
						}}
					>
						<Icon name="bin" size={14} />
						{row.kind === 'topic' ? 'Remove topic' : 'Remove'}
					</button>
				</div>
			{/if}
		</li>
	{/each}
</ol>
<div class="adds">
	<button type="button" class="quiet" onclick={() => insert(blankTopic(chosen ?? undefined))}>
		<Icon name="plus" size={15} /> Add a topic
	</button>
	<button type="button" class="quiet" onclick={() => insert(blankText())}>
		<Icon name="plus" size={15} /> Add a sub-heading
	</button>
</div>

<style>
	.units {
		border: 0;
		margin: 0 0 10px;
		padding: 0;
	}

	.units legend {
		padding: 0;
		margin-bottom: 4px;
		font-size: 13px;
		font-weight: 700;
		color: var(--ink-2);
	}

	.units label {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin: 2px 14px 2px 0;
		font-size: 14px;
	}

	.problems ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.problems li + li {
		margin-top: 6px;
		padding-top: 6px;
		border-top: 1px solid color-mix(in oklab, var(--warn-deep) 18%, transparent);
	}

	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.row {
		position: relative;
		border-bottom: 1px solid var(--rule);
	}

	.row.topic {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 2px 12px;
		align-items: start;
		padding: 8px 0;
	}

	.row.sel {
		margin-inline: -10px;
		padding-inline: 10px;
		padding-bottom: 42px;
		background: var(--house-soft);
		border-bottom-color: var(--house);
	}

	textarea.topic-text {
		display: block;
		width: 100%;
		min-height: 0;
		resize: none;
		font: inherit;
		font-size: 14px;
	}

	.text-row {
		padding: 8px 0;
	}

	.meta {
		margin: 3px 0 0;
		font-size: 13px;
		color: var(--muted);
	}

	.ids {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 2px 10px;
		max-width: 130px;
	}

	.id {
		font-size: 15px;
		font-weight: 900;
		font-stretch: 70%;
		color: var(--house-deep);
		font-variant-numeric: tabular-nums;
	}

	.id.unknown {
		color: var(--warn-deep);
		text-decoration: line-through;
	}

	.none {
		font-size: 13px;
		color: var(--muted);
	}

	.topic-open {
		grid-column: 1 / -1;
	}

	.fields {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 10px;
		margin-top: 8px;
	}

	.fields label > span {
		display: block;
		margin-bottom: 3px;
		font-size: 13px;
		font-weight: 700;
		color: var(--ink-2);
	}

	.fields label {
		flex: 1 1 100px;
	}

	.fields label:first-child {
		flex: 2 1 180px;
	}

	.fields select {
		width: 100%;
	}

	.note {
		flex: 1 1 100%;
	}

	.note input {
		width: 100%;
	}

	.picker {
		margin-top: 10px;
		padding: 8px 10px 4px;
		background: var(--paper);
		border: 1px solid var(--rule-strong);
		border-radius: 2px;
		max-height: 340px;
		overflow-y: auto;
	}

	.find {
		display: flex;
		align-items: center;
		gap: 6px;
		padding-bottom: 6px;
		border-bottom: 1px solid var(--rule);
		color: var(--muted);
	}

	.find input {
		flex: 1;
		min-width: 0;
		border: 0;
		padding: 6px 0;
		background: transparent;
	}

	.find input:focus {
		outline: none;
	}

	h4 {
		margin: 10px 0 2px;
		font-size: 13px;
		font-weight: 800;
		color: var(--house-deep);
	}

	.picker ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.dp {
		display: grid;
		grid-template-columns: 52px minmax(0, 1fr) 18px;
		gap: 8px;
		width: 100%;
		min-height: 0;
		padding: 6px 2px;
		background: transparent;
		border: 0;
		border-bottom: 1px solid var(--rule);
		border-radius: 0;
		text-align: left;
		white-space: normal;
		font-size: 13px;
		font-weight: 500;
		line-height: 1.35;
		align-items: baseline;
	}

	.dp:hover:not(:disabled) {
		background: var(--house-soft);
		border-color: var(--rule);
	}

	.dp b {
		font-size: 14px;
		font-weight: 900;
		font-stretch: 70%;
	}

	.on .dp b,
	.on .dp i {
		color: var(--house-deep);
	}

	.dp i {
		font-style: normal;
		align-self: center;
	}

	.hint {
		margin: 8px 0;
		font-size: 13px;
		color: var(--muted);
	}

	.tools {
		position: absolute;
		left: 10px;
		bottom: 5px;
		display: flex;
		flex-wrap: wrap;
		gap: 2px;
	}

	.tools button {
		min-height: 30px;
		padding: 0 8px;
		font-size: 13px;
	}

	.danger {
		color: var(--warn-deep);
	}

	.adds {
		display: flex;
		gap: 4px;
		padding-top: 6px;
	}

	.adds button {
		min-height: 30px;
		padding: 0 8px;
		font-size: 13px;
		font-weight: 750;
		color: var(--house-deep);
	}
</style>
