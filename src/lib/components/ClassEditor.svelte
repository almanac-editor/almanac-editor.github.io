<script lang="ts">
	// How a class runs: its units in order, each unit's term, dates, weeks,
	// notes and lesson list, its one-off lessons, its mode, cohort and folder.
	// The class's name, colour and Canvas links are not edited here.
	import { beforeNavigate, goto } from '$app/navigation';
	import Icon from './Icon.svelte';
	import PageHead from './PageHead.svelte';
	import type { UnitEntry } from '#lib/data.ts';
	import { move } from '#lib/domain/lessonEdit.ts';
	import { httpsHost } from '#lib/domain/materials.ts';
	import {
		MODES,
		fromClassDraft,
		newEntry,
		newOneOff,
		toClassDraft,
		type OfferingDraft
	} from '#lib/domain/offeringEdit.ts';
	import { basename, join, stem } from '#lib/domain/paths.ts';
	import { AuthError, ConflictError } from '#lib/domain/repo.ts';
	import type { Offering } from '#lib/domain/types.ts';
	import { className, humanise, termParts } from '#lib/house.ts';
	import { links } from '#lib/links.ts';
	import { session } from '#lib/session.svelte.ts';
	import { tasksForOffering } from '#lib/domain/tasks.ts';

	let {
		path,
		offering,
		sha,
		units,
		oneOffs,
		u = null,
		t = null
	}: {
		path: string;
		offering: Offering;
		sha: string;
		/** The units of the class's subject. */
		units: UnitEntry[];
		/** The subject's one-offs, as `one_offs/<name>`. */
		oneOffs: string[];
		/** The unit page the editor was opened from, if any. */
		u?: string | null;
		t?: string | null;
	} = $props();

	// svelte-ignore state_referenced_locally
	let draft = $state<OfferingDraft>(toClassDraft(offering));
	// svelte-ignore state_referenced_locally
	let baseline = $state(JSON.stringify(toClassDraft(offering)));
	let saving = $state(false);
	let problem = $state<string | null>(null);
	const dirty = $derived(JSON.stringify(draft) !== baseline);
	// Checked here as well as by the schema, since a folder without schemas/ saves unchecked.
	const incomplete = $derived(
		draft.units.length === 0 || draft.units.some((e) => e.lessons?.length === 0)
	);

	const name = $derived(className(offering));
	const where = $derived(session.source === 'github' ? 'on GitHub' : 'on disk');
	const back = $derived(u ? links.unit(u, path, t) : links.home());

	/** The subject's unit at `rel` (as an offering names it), if it exists. */
	const unitAt = (rel: string) => units.find((e) => e.dir === join(offering.subject, rel));
	const unitTitle = (rel: string) => unitAt(rel)?.unit.unit_title ?? humanise(basename(rel));
	const relOf = (dir: string) => dir.slice(offering.subject.length + 1);
	const lessonName = (ref: string) => humanise(stem(ref));

	const terms = $derived(
		[
			...new Set([
				'Term 1',
				'Term 2',
				'Term 3',
				'Term 4',
				...draft.units.map((e) => e.term),
				...draft.one_offs.map((o) => o.term)
			])
		].filter(Boolean)
	);
	const oneOffChoices = $derived([...new Set([...oneOffs, ...draft.one_offs.map((o) => o.path)])]);

	function addUnit(event: Event & { currentTarget: HTMLSelectElement }) {
		const rel = event.currentTarget.value;
		event.currentTarget.value = '';
		if (rel) draft.units.push(newEntry(rel));
	}

	function addOneOff(event: Event & { currentTarget: HTMLSelectElement }) {
		const rel = event.currentTarget.value;
		event.currentTarget.value = '';
		if (rel) draft.one_offs.push(newOneOff(rel));
	}

	function addLesson(i: number, event: Event & { currentTarget: HTMLSelectElement }) {
		const ref = event.currentTarget.value;
		event.currentTarget.value = '';
		if (ref) draft.units[i].lessons?.push(ref);
	}

	/** After a save: back to the unit page if the class still takes that unit (and term), else home. */
	function returnTo(saved: Offering): string {
		if (!u) return links.home();
		const still = saved.units.some(
			(e) => join(saved.subject, e.unit) === u && (t === null || e.term === t)
		);
		return still ? links.unit(u, path, t) : links.home();
	}

	async function save() {
		const data = session.data;
		if (!data || saving || !dirty || incomplete) return;
		problem = null;
		saving = true;
		try {
			const next = fromClassDraft(offering, $state.snapshot(draft) as OfferingDraft);
			await data.saveOffering(path, next, sha, `Edit class ${offering.id}`);
			baseline = JSON.stringify(draft);
			session.revision += 1;
			await goto(returnTo(next));
		} catch (error) {
			problem =
				error instanceof ConflictError
					? `Not saved: this class changed ${where} after you opened it. Copy what you need, then reload the page.`
					: error instanceof AuthError
						? 'Not saved. GitHub no longer accepts the token. Copy your edits, then add a new token in Settings.'
						: `Not saved. ${(error as Error).message}`;
		} finally {
			saving = false;
		}
	}

	function onkeydown(event: KeyboardEvent) {
		if ((event.metaKey || event.ctrlKey) && event.key === 's') {
			event.preventDefault();
			save();
		}
	}

	beforeNavigate(({ cancel, willUnload }) => {
		if (
			dirty &&
			!willUnload &&
			!confirm('Leave without saving? Your edits to this class will be lost.')
		) {
			cancel();
		}
	});
</script>

<svelte:window {onkeydown} onbeforeunload={(e) => dirty && e.preventDefault()} />

<datalist id="terms">
	{#each terms as term (term)}<option value={term}></option>{/each}
</datalist>

<PageHead
	crumbs={[
		{ href: links.home(), label: 'Classes' },
		...(u ? [{ href: back, label: unitTitle(relOf(u)) }] : [])
	]}
	title="Edit {name}"
	lede="The units {name} takes, in what order and when, and which lessons. The name, colour and Canvas links stay as they are."
>
	{#snippet meta()}
		<span>{offering.id}</span>
		<span>{draft.units.length} {draft.units.length === 1 ? 'unit' : 'units'}</span>
		<span>{path}</span>
	{/snippet}
</PageHead>

<div class="page">
	<form
		onsubmit={(event) => {
			event.preventDefault();
			save();
		}}
	>
		<section>
			<h2>Units</h2>
			<p class="hint">
				In the order the class takes them. A unit taken in two parts can be listed twice, once for
				each term.
			</p>
			<ol class="entries">
				{#each draft.units as entry, i (i)}
					{@const own = unitAt(entry.unit)?.unit.lessons ?? []}
					{@const parts = termParts(entry.term)}
					<li>
						<span class="term" class:long={parts.length > 1 || (parts[0]?.length ?? 0) > 3}>
							{#each parts as part, j (j)}<span>{part}</span>{:else}–{/each}
						</span>
						<fieldset>
							<legend>
								<span class="title">{unitTitle(entry.unit)}</span>
								{#if !unitAt(entry.unit)}
									<span class="bad">Not a unit in this subject: <code>{entry.unit}</code></span>
								{/if}
							</legend>
							<div class="row">
								<label class="field">
									<span>Term</span>
									<input type="text" list="terms" bind:value={entry.term} placeholder="Term 1" />
								</label>
								<label class="field">
									<span>Weeks</span>
									<input type="number" min="1" step="1" bind:value={entry.duration_weeks} />
								</label>
								<label class="field">
									<span>Starts</span>
									<input type="date" bind:value={entry.start_date} />
								</label>
								<label class="field">
									<span>Ends</span>
									<input type="date" bind:value={entry.end_date} />
								</label>
							</div>
							<label class="field">
								<span>Notes</span>
								<textarea
									bind:value={entry.notes}
									rows="1"
									placeholder="Changes to the pace for this class, such as an extra lesson"
								></textarea>
							</label>

							<div
								class="lessons"
								role="radiogroup"
								aria-label="Lessons for {unitTitle(entry.unit)}"
							>
								<label class="choice">
									<input
										type="radio"
										name="lessons-{i}"
										checked={entry.lessons === null}
										onchange={() => (entry.lessons = null)}
									/>
									<span>
										Every plan in the unit, in the unit’s order
										<i>{own.length} {own.length === 1 ? 'lesson' : 'lessons'}</i>
									</span>
								</label>
								<label class="choice">
									<input
										type="radio"
										name="lessons-{i}"
										checked={entry.lessons !== null}
										onchange={() => (entry.lessons = [...own])}
									/>
									<span>
										This class’s own list
										{#if entry.lessons}<i>{entry.lessons.length} chosen</i>{/if}
									</span>
								</label>
							</div>

							{#if entry.lessons}
								{@const lessons = entry.lessons}
								{@const remaining = own.filter((ref) => !lessons.includes(ref))}
								<ol class="picked">
									{#each lessons as ref, j (j)}
										<li>
											<span class="n">{j + 1}</span>
											<span class="ref">
												{lessonName(ref)}
												{#if !own.includes(ref)}<i class="bad">Not in the unit’s list</i>{/if}
											</span>
											<span class="controls">
												<button
													type="button"
													class="quiet icon"
													title="Move up"
													aria-label="Move {lessonName(ref)} up"
													disabled={j === 0}
													onclick={() => move(lessons, j, -1)}><Icon name="up" size={16} /></button
												>
												<button
													type="button"
													class="quiet icon"
													title="Move down"
													aria-label="Move {lessonName(ref)} down"
													disabled={j === lessons.length - 1}
													onclick={() => move(lessons, j, 1)}><Icon name="down" size={16} /></button
												>
												<button
													type="button"
													class="quiet icon danger"
													title="Leave out"
													aria-label="Leave out {lessonName(ref)}"
													onclick={() => lessons.splice(j, 1)}
													><Icon name="close" size={16} /></button
												>
											</span>
										</li>
									{:else}
										<li class="empty">
											No lessons chosen. Add one, or take every plan in the unit.
										</li>
									{/each}
								</ol>
								{#if remaining.length}
									<select
										class="add"
										aria-label="Add a lesson to {unitTitle(entry.unit)}"
										onchange={(e) => addLesson(i, e)}
									>
										<option value="">Add a lesson…</option>
										{#each remaining as ref (ref)}<option value={ref}>{lessonName(ref)}</option
											>{/each}
									</select>
								{/if}
							{/if}

							{#if unitAt(entry.unit)}
								{@const found = unitAt(entry.unit)}
								{@const tasks = found
									? tasksForOffering(found.unit, offering.id, entry.term || null)
									: []}
								<div class="tasks">
									<span class="label">Assessment tasks</span>
									{#if tasks.length}
										<ul>
											{#each tasks as task, j (j)}
												<li>
													{task.title}{#if task.weight !== undefined}<i>{task.weight}%</i>{/if}
												</li>
											{/each}
										</ul>
									{:else}
										<span class="none">None for this class.</span>
									{/if}
									<a href={links.unitTasks(join(offering.subject, entry.unit), path, entry.term)}
										>Edit the unit’s tasks</a
									>
								</div>
							{/if}
						</fieldset>
						<div class="controls">
							<button
								type="button"
								class="quiet icon"
								title="Move up"
								aria-label="Move {unitTitle(entry.unit)} up"
								disabled={i === 0}
								onclick={() => move(draft.units, i, -1)}><Icon name="up" /></button
							>
							<button
								type="button"
								class="quiet icon"
								title="Move down"
								aria-label="Move {unitTitle(entry.unit)} down"
								disabled={i === draft.units.length - 1}
								onclick={() => move(draft.units, i, 1)}><Icon name="down" /></button
							>
							<button
								type="button"
								class="quiet icon danger"
								title="Remove from the class"
								aria-label="Remove {unitTitle(entry.unit)} from the class"
								onclick={() => draft.units.splice(i, 1)}><Icon name="bin" /></button
							>
						</div>
					</li>
				{/each}
			</ol>
			{#if draft.units.length === 0}
				<p class="hint bad">A class takes at least one unit.</p>
			{/if}
			<select class="add" aria-label="Add a unit" onchange={addUnit}>
				<option value="">Add a unit…</option>
				{#each units as entry (entry.dir)}
					{@const rel = relOf(entry.dir)}
					<option value={rel}
						>{entry.unit.unit_title}{draft.units.some((e) => e.unit === rel)
							? ' (taken already)'
							: ''}</option
					>
				{/each}
			</select>
		</section>

		<section>
			<h2>One-off lessons</h2>
			<p class="hint">Lessons outside any unit, such as the first day, in the order they ran.</p>
			{#if draft.one_offs.length}
				<ol class="entries one-offs">
					{#each draft.one_offs as item, i (i)}
						<li>
							<span class="term long">
								{#each termParts(item.term) as part, j (j)}<span>{part}</span>{:else}–{/each}
							</span>
							<fieldset>
								<legend class="sr-only">One-off lesson {i + 1}</legend>
								<div class="row two">
									<label class="field">
										<span>Lesson</span>
										<select bind:value={item.path}>
											{#each oneOffChoices as choice (choice)}
												<option value={choice}>{humanise(basename(choice))}</option>
											{/each}
										</select>
									</label>
									<label class="field">
										<span>Term</span>
										<input type="text" list="terms" bind:value={item.term} placeholder="Term 1" />
									</label>
								</div>
								<label class="field">
									<span>Notes</span>
									<textarea
										bind:value={item.notes}
										rows="1"
										placeholder="Which version this class had"></textarea>
								</label>
							</fieldset>
							<div class="controls">
								<button
									type="button"
									class="quiet icon"
									title="Move up"
									aria-label="Move one-off lesson {i + 1} up"
									disabled={i === 0}
									onclick={() => move(draft.one_offs, i, -1)}><Icon name="up" /></button
								>
								<button
									type="button"
									class="quiet icon"
									title="Move down"
									aria-label="Move one-off lesson {i + 1} down"
									disabled={i === draft.one_offs.length - 1}
									onclick={() => move(draft.one_offs, i, 1)}><Icon name="down" /></button
								>
								<button
									type="button"
									class="quiet icon danger"
									title="Remove"
									aria-label="Remove one-off lesson {i + 1}"
									onclick={() => draft.one_offs.splice(i, 1)}><Icon name="bin" /></button
								>
							</div>
						</li>
					{/each}
				</ol>
			{/if}
			{#if oneOffs.length}
				<select class="add" aria-label="Add a one-off lesson" onchange={addOneOff}>
					<option value="">Add a one-off lesson…</option>
					{#each oneOffs as choice (choice)}
						<option value={choice}>{humanise(basename(choice))}</option>
					{/each}
				</select>
			{:else if !draft.one_offs.length}
				<p class="muted">
					The subject has no one-off lessons. They live in <code>{offering.subject}/one_offs/</code
					>.
				</p>
			{/if}
		</section>

		<section>
			<h2>The class</h2>
			<div class="row class">
				<label class="field">
					<span>Mode</span>
					<select bind:value={draft.mode}>
						<option value="">Not set</option>
						{#each MODES as mode (mode)}
							<option value={mode}>{mode.charAt(0).toUpperCase() + mode.slice(1)}</option>
						{/each}
						{#if draft.mode && !(MODES as readonly string[]).includes(draft.mode)}
							<option value={draft.mode}>{draft.mode}</option>
						{/if}
					</select>
				</label>
				<label class="field">
					<span>Class size</span>
					<input type="number" min="0" step="1" bind:value={draft.cohort.size} />
				</label>
			</div>
			<label class="field">
				<span>About the class</span>
				<textarea bind:value={draft.cohort.notes} placeholder="Context that affects how lessons run"
				></textarea>
			</label>
			<p class="hint">Nothing that identifies a student.</p>
			<label class="field folder">
				<span>Class folder (optional)</span>
				<input
					type="url"
					bind:value={draft.folder}
					placeholder="https://"
					autocomplete="off"
					spellcheck="false"
				/>
			</label>
			{#if draft.folder.trim()}
				{@const host = httpsHost(draft.folder.trim())}
				<p class="hint" class:bad={!host}>
					{host ? `Opens ${host}` : 'Only a web address starting https:// can be saved.'}
				</p>
			{/if}
			<p class="hint">
				Where the decks, workbooks and handouts this class saw are kept, in your school’s cloud
				storage. Use a school-wide sharing link to a shared drive, so colleagues can open it.
			</p>
		</section>

		<div class="dock">
			{#if problem}<div class="msg warn"><div>{problem}</div></div>{/if}
			<div class="actions">
				<button
					class="primary go"
					type="submit"
					disabled={saving || !dirty || incomplete || !session.active}
				>
					{saving ? 'Saving…' : 'Save class'}
					<kbd>Ctrl S</kbd>
				</button>
				<a class="btn quiet" href={back}>{dirty ? 'Discard' : 'Back'}</a>
				<span class="state">{dirty ? 'Unsaved changes' : 'No changes'}</span>
			</div>
		</div>
	</form>
</div>

<style>
	form {
		max-width: 860px;
	}

	section {
		margin: 0 0 40px;
	}

	h2 {
		margin: 0 0 4px;
	}

	.folder input {
		width: 100%;
	}

	.hint {
		margin: 0 0 14px;
		font-size: 13px;
		color: var(--muted);
	}

	.bad {
		color: var(--warn);
	}

	.entries {
		list-style: none;
		padding: 0;
		margin: 0 0 12px;
		border-top: 2px solid var(--ink);
	}

	.entries > li {
		display: grid;
		grid-template-columns: 64px minmax(0, 1fr) auto;
		gap: 16px;
		padding: 16px 0 6px;
		border-bottom: 1px solid var(--rule);
	}

	.term {
		display: flex;
		flex-direction: column;
		font-size: 34px;
		font-weight: 900;
		font-stretch: 70%;
		line-height: 0.85;
		color: var(--house);
	}

	.term.long {
		gap: 4px;
		font-size: 17px;
		line-height: 1;
		padding-top: 4px;
	}

	fieldset {
		border: 0;
		margin: 0;
		padding: 0;
		min-width: 0;
	}

	legend {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 4px 12px;
		padding: 0;
		margin-bottom: 12px;
	}

	.title {
		font-size: 18px;
		font-weight: 750;
		font-stretch: 88%;
		line-height: 1.2;
	}

	legend .bad {
		font-size: 13px;
	}

	.row {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(64px, 0.6fr) minmax(0, 1fr) minmax(0, 1fr);
		gap: 0 10px;
	}

	.row.two {
		grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
	}

	.row.class {
		grid-template-columns: minmax(0, 240px) minmax(0, 140px);
	}

	.lessons {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 20px;
		margin: -4px 0 10px;
	}

	.choice {
		display: flex;
		align-items: baseline;
		gap: 8px;
		font-size: 14px;
	}

	.choice i,
	.ref i {
		font-style: normal;
		font-size: 12px;
		color: var(--muted);
		margin-left: 4px;
	}

	.ref i.bad {
		color: var(--warn);
	}

	.tasks {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 4px 14px;
		margin-top: 14px;
		padding-top: 10px;
		border-top: 1px solid var(--rule);
		font-size: 13px;
	}

	.tasks .label {
		font-weight: 700;
	}

	.tasks ul {
		display: contents;
		list-style: none;
	}

	.tasks li i {
		margin-left: 4px;
		font-style: normal;
		color: var(--muted);
	}

	.tasks .none {
		color: var(--muted);
	}

	.picked {
		list-style: none;
		padding: 0;
		margin: 0 0 8px;
		background: var(--paper);
	}

	.picked li {
		display: grid;
		grid-template-columns: 28px minmax(0, 1fr) auto;
		gap: 8px;
		align-items: center;
		padding: 2px 4px 2px 10px;
		border-bottom: 1px solid var(--rule);
		font-size: 14px;
	}

	.picked li.empty {
		display: block;
		padding: 10px;
		color: var(--warn);
	}

	.picked .n {
		font-weight: 900;
		font-stretch: 75%;
		font-size: 16px;
		color: var(--house-deep);
	}

	.picked .controls {
		display: flex;
	}

	.entries > li > .controls {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.danger:hover:not(:disabled) {
		color: var(--warn);
	}

	select.add {
		width: auto;
		max-width: 100%;
		border-style: dashed;
		margin-bottom: 14px;
	}

	.dock {
		position: sticky;
		bottom: 0;
		z-index: 5;
		padding: 14px 0 12px;
		background: linear-gradient(transparent, var(--chalk) 14px);
	}

	.dock .msg {
		margin: 0 0 8px;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
	}

	.go {
		min-height: 44px;
		padding: 0 22px;
		font-size: 15px;
	}

	.go kbd {
		font-size: 10px;
	}

	.state {
		margin-left: auto;
		font-size: 13px;
		color: var(--muted);
	}

	@media (max-width: 640px) {
		.entries > li {
			grid-template-columns: minmax(0, 1fr) auto;
		}

		.entries .term {
			display: none;
		}

		.row,
		.row.two,
		.row.class {
			grid-template-columns: 1fr 1fr;
		}

		.go kbd {
			display: none;
		}
	}
</style>
