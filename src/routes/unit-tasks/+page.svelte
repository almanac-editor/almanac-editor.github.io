<script lang="ts">
	// A unit's assessment tasks: what each is, its weight, which classes sat
	// it, and the dot points it evidences. They live in the unit's file.
	import { page } from '$app/state';
	import { beforeNavigate, goto } from '$app/navigation';
	import Failure from '#lib/components/Failure.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import PageHead from '#lib/components/PageHead.svelte';
	import { move } from '#lib/domain/lessonEdit.ts';
	import { offeringEntries } from '#lib/domain/offerings.ts';
	import { basename } from '#lib/domain/paths.ts';
	import { ConflictError } from '#lib/domain/repo.ts';
	import {
		blankTask,
		cohortTerms,
		COVERAGES,
		fromTaskDrafts,
		MODES,
		taskClasses,
		taskLink,
		toTaskDrafts,
		type Task,
		type TaskDraft
	} from '#lib/domain/tasks.ts';
	import type { Offering, Unit } from '#lib/domain/types.ts';
	import { className, titleCase } from '#lib/house.ts';
	import { links } from '#lib/links.ts';
	import { session } from '#lib/session.svelte.ts';

	const u = $derived(page.url.searchParams.get('u') ?? '');
	const o = $derived(page.url.searchParams.get('o'));
	const t = $derived(page.url.searchParams.get('t'));

	const load = $derived.by(() => {
		const data = session.data;
		void session.revision;
		if (!data || !u) return null;
		return Promise.all([data.unitFile(u), data.offerings(), data.units()]).then(
			([loaded, offerings, units]) => {
				drafts = toTaskDrafts(loaded.doc);
				baseline = JSON.stringify(drafts);
				// Two years' classes can share a name; tell them apart by year.
				const names = offerings.map(([, x]) => className(x));
				const classes = taskClasses(offeringEntries(u, offerings), (x) => {
					const name = className(x as Offering);
					const shared = names.filter((n) => n === name).length > 1;
					return shared ? `${name}, ${(x as Offering).year}` : name;
				});
				const types = [
					...new Set(
						units.flatMap(({ unit }) =>
							((unit.assessments ?? []) as Task[]).flatMap((x) => x.assessment_type ?? [])
						)
					)
				].sort();
				current = loaded;
				return { loaded, classes, types };
			}
		);
	});

	let drafts = $state<TaskDraft[]>([]);
	let current: { doc: Unit; sha: string } | null = null;
	let baseline = $state('');
	let saving = $state(false);
	let problem = $state<string | null>(null);
	let open = $state<number | null>(null);
	const dirty = $derived(baseline !== '' && JSON.stringify(drafts) !== baseline);

	beforeNavigate(({ cancel, willUnload }) => {
		if (
			dirty &&
			!willUnload &&
			!confirm('Leave without saving? Your edits to these tasks will be lost.')
		) {
			cancel();
		}
	});

	async function save(original: Unit, sha: string) {
		const data = session.data;
		if (!data || saving || !dirty) return;
		problem = null;
		saving = true;
		try {
			const next = fromTaskDrafts(original, $state.snapshot(drafts) as TaskDraft[]);
			await data.saveUnit(u, next, sha, `Edit assessment tasks in ${basename(u)}`);
			baseline = JSON.stringify(drafts);
			session.revision += 1;
			await goto(links.unit(u, o, t));
		} catch (error) {
			problem =
				error instanceof ConflictError
					? 'Not saved: the unit changed since you opened it. Copy what you need, then reload the page.'
					: `Not saved. ${(error as Error).message}`;
		} finally {
			saving = false;
		}
	}

	function onkeydown(event: KeyboardEvent) {
		if ((event.metaKey || event.ctrlKey) && event.key === 's') {
			event.preventDefault();
			if (current) save(current.doc, current.sha);
		}
	}

	function add() {
		drafts.push(blankTask());
		open = drafts.length - 1;
	}

	function shift(i: number, delta: number) {
		move(drafts, i, delta);
		if (open === i) open = i + delta;
		else if (open === i + delta) open = i;
	}

	function remove(i: number) {
		drafts.splice(i, 1);
		if (open === i) open = null;
		else if (open !== null && open > i) open -= 1;
	}

	function toggleClass(task: TaskDraft, id: string, on: boolean) {
		task.offerings = on ? [...task.offerings, id] : task.offerings.filter((x) => x !== id);
	}

	const number = (value: string) => (value === '' ? null : Number(value));
</script>

<svelte:window {onkeydown} onbeforeunload={(e) => dirty && e.preventDefault()} />

{#if !u}
	<PageHead title="No unit given" />
	<div class="page"><div class="msg warn"><div>Open a unit first.</div></div></div>
{:else if load}
	{#await load}
		<PageHead title={null} />
		<div class="page"><div class="loading"><span></span><span></span><span></span></div></div>
	{:then { loaded, classes, types }}
		{@const registry = loaded.doc.syllabus_registry ?? []}
		<PageHead
			crumbs={[{ href: links.unit(u, o, t), label: loaded.doc.unit_title }]}
			title="Assessment tasks"
			lede="The unit’s tasks, in the order they’re set. A task with no classes ticked is sat by every class taking the unit."
		/>

		<div class="page">
			<form
				class="fields"
				onsubmit={(event) => {
					event.preventDefault();
					save(loaded.doc, loaded.sha);
				}}
			>
				<ol class="tasks">
					{#each drafts as task, i (i)}
						{@const expanded = open === i}
						<li class="task" class:expanded>
							<div class="task-head">
								<button
									type="button"
									class="quiet summary"
									aria-expanded={expanded}
									onclick={() => (open = expanded ? null : i)}
								>
									<span class="num">{i + 1}</span>
									<span class="what">
										<span class="title">{task.title || 'Untitled task'}</span>
										<span class="sub">
											{[
												task.assessment_type,
												task.weight !== null ? `${task.weight}%` : '',
												task.offerings.length
													? task.offerings.map((id) => classes.get(id)?.label ?? id).join(', ')
													: 'Every class',
												task.term
											]
												.filter(Boolean)
												.join(' · ')}
										</span>
									</span>
								</button>
								<div class="controls">
									<button
										type="button"
										class="quiet icon"
										aria-label="Move task {i + 1} up"
										title="Move up"
										disabled={i === 0}
										onclick={() => shift(i, -1)}><Icon name="up" /></button
									>
									<button
										type="button"
										class="quiet icon"
										aria-label="Move task {i + 1} down"
										title="Move down"
										disabled={i === drafts.length - 1}
										onclick={() => shift(i, 1)}><Icon name="down" /></button
									>
									<button
										type="button"
										class="quiet icon danger"
										aria-label="Remove task {i + 1}"
										title="Remove task"
										onclick={() => remove(i)}><Icon name="bin" /></button
									>
								</div>
							</div>

							{#if expanded}
								{@const terms = cohortTerms(task, classes)}
								{@const unlinked = registry.filter(
									(p) => !task.curriculum_links.some((l) => l.id === p.id)
								)}
								<div class="task-body">
									<label class="field">
										<span>Title</span>
										<input type="text" bind:value={task.title} />
									</label>
									<div class="row">
										<label class="field grow">
											<span>Type</span>
											<input
												type="text"
												bind:value={task.assessment_type}
												list="task-types"
												placeholder="Project"
											/>
										</label>
										<label class="field">
											<span>Weight (%)</span>
											<input
												type="number"
												min="0"
												step="1"
												value={task.weight ?? ''}
												oninput={(e) => (task.weight = number(e.currentTarget.value))}
											/>
										</label>
										<label class="field">
											<span>Class time (min)</span>
											<input
												type="number"
												min="0"
												step="5"
												value={task.class_minutes ?? ''}
												oninput={(e) => (task.class_minutes = number(e.currentTarget.value))}
											/>
										</label>
									</div>
									<label class="field">
										<span>Description</span>
										<textarea bind:value={task.description}></textarea>
									</label>
									<label class="field">
										<span>Overview</span>
										<textarea bind:value={task.overview} rows="5"></textarea>
									</label>

									<fieldset>
										<legend>Classes that sat it</legend>
										{#if classes.size || task.offerings.length}
											<div class="choices">
												{#each [...classes] as [id, c] (id)}
													<label>
														<input
															type="checkbox"
															checked={task.offerings.includes(id)}
															onchange={(e) => toggleClass(task, id, e.currentTarget.checked)}
														/>
														{c.label}
													</label>
												{/each}
												{#each task.offerings.filter((id) => !classes.has(id)) as id (id)}
													<label class="stray">
														<input
															type="checkbox"
															checked
															onchange={(e) => toggleClass(task, id, e.currentTarget.checked)}
														/>
														{id} <small>(doesn’t take this unit)</small>
													</label>
												{/each}
											</div>
											<p class="hint">None ticked means every class taking the unit.</p>
										{:else}
											<p class="hint">No class takes this unit yet, so every class will sit it.</p>
										{/if}
										{#if terms.length}
											<label class="field term">
												<span>Cohort</span>
												<select bind:value={task.term}>
													<option value="">Every term</option>
													{#each terms as term (term)}<option value={term}>{term} only</option
														>{/each}
												</select>
											</label>
											<p class="hint">
												For a class that took the unit in two parts: the term whose cohort sat it.
											</p>
										{/if}
									</fieldset>

									<fieldset>
										<legend>Syllabus</legend>
										<p class="hint">Only the dot points the task itself evidences.</p>
										{#each task.curriculum_links as link, j (link.id)}
											<div class="dot">
												<b class="dot-id">{link.id}</b>
												<span class="dot-text"
													>{registry.find((p) => p.id === link.id)?.text ??
														'Not in the unit’s dot points'}</span
												>
												<div class="dot-how">
													<select bind:value={link.coverage} aria-label="Coverage of {link.id}">
														{#each COVERAGES as c (c)}<option value={c}>{titleCase(c)}</option
															>{/each}
													</select>
													<select bind:value={link.mode} aria-label="Mode for {link.id}">
														{#each MODES as m (m)}<option value={m}>{titleCase(m)}</option>{/each}
													</select>
													<button
														type="button"
														class="quiet icon danger"
														title="Unlink"
														aria-label="Unlink {link.id}"
														onclick={() => task.curriculum_links.splice(j, 1)}
														><Icon name="bin" /></button
													>
												</div>
												<textarea
													bind:value={link.note}
													placeholder="Note (optional)"
													aria-label="Note for {link.id}"></textarea>
											</div>
										{/each}
										{#if unlinked.length}
											<select
												class="add-dot"
												aria-label="Link a dot point"
												value=""
												onchange={(e) => {
													const entry = registry.find((p) => p.id === e.currentTarget.value);
													if (entry) task.curriculum_links.push(taskLink(entry));
													e.currentTarget.value = '';
												}}
											>
												<option value="">Link a dot point…</option>
												{#each unlinked as entry (entry.id)}
													<option value={entry.id}>{entry.id}: {entry.text}</option>
												{/each}
											</select>
										{:else if registry.length === 0}
											<p class="hint">
												The unit has no dot points yet. <a href={links.unitEdit(u, o, t)}
													>Add them in the unit editor.</a
												>
											</p>
										{/if}
									</fieldset>
								</div>
							{/if}
						</li>
					{:else}
						<li class="empty">No assessment tasks yet.</li>
					{/each}
				</ol>
				<datalist id="task-types">
					{#each types as type (type)}<option value={type}></option>{/each}
				</datalist>
				<button type="button" onclick={add}><Icon name="plus" size={16} /> Add task</button>

				<div class="dock">
					{#if problem}<div class="msg warn"><div>{problem}</div></div>{/if}
					<div class="actions">
						<button class="primary go" type="submit" disabled={saving || !dirty}>
							{saving ? 'Saving…' : 'Save tasks'}
							<kbd>Ctrl S</kbd>
						</button>
						<a class="btn quiet" href={links.unit(u, o, t)}>{dirty ? 'Discard' : 'Back'}</a>
						<span class="state">{dirty ? 'Unsaved changes' : 'No changes'}</span>
					</div>
				</div>
			</form>
		</div>
	{:catch error}
		<PageHead title="Could not open this unit" />
		<div class="page"><Failure {error} /></div>
	{/await}
{/if}

<style>
	.fields {
		max-width: 820px;
	}

	.tasks {
		list-style: none;
		margin: 0 0 14px;
		padding: 0;
		border-top: 2px solid var(--ink);
	}

	.task {
		border-bottom: 1px solid var(--rule);
	}

	.task.expanded {
		background: var(--paper);
	}

	.task-head {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.summary {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		justify-content: flex-start;
		gap: 16px;
		padding: 12px 4px;
		text-align: left;
		font: inherit;
		color: inherit;
	}

	.num {
		font-size: 30px;
		font-weight: 900;
		font-stretch: 70%;
		line-height: 0.85;
		color: var(--house);
		min-width: 32px;
	}

	.what {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.title {
		font-size: 17px;
		font-weight: 750;
	}

	.sub {
		font-size: 13px;
		color: var(--muted);
	}

	.controls {
		display: flex;
	}

	.task-body {
		padding: 4px 14px 14px;
	}

	.row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 120px 140px;
		gap: 0 10px;
	}

	fieldset {
		border: 0;
		padding: 0;
		margin: 8px 0 18px;
	}

	legend {
		font-weight: 700;
		margin-bottom: 6px;
	}

	.choices {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 18px;
		margin-bottom: 4px;
	}

	.choices label {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 14px;
	}

	.stray small {
		color: var(--warn);
	}

	.term {
		max-width: 260px;
		margin: 10px 0 0;
	}

	.hint {
		margin: 4px 0 8px;
		font-size: 13px;
		color: var(--muted);
	}

	.dot {
		display: grid;
		grid-template-columns: minmax(58px, max-content) minmax(0, 1fr);
		gap: 4px 10px;
		margin-bottom: 12px;
	}

	.dot-id {
		grid-row: span 2;
		font-size: 13px;
		color: var(--house-deep);
		white-space: nowrap;
	}

	.dot-text {
		font-size: 13px;
	}

	.dot-how {
		grid-column: 1 / -1;
		display: flex;
		gap: 6px;
		align-items: center;
	}

	.dot-how select {
		flex: 1;
		min-width: 0;
	}

	.dot textarea {
		grid-column: 2;
	}

	.add-dot {
		width: 100%;
	}

	.empty {
		padding: 18px 4px;
		color: var(--ink-2);
	}

	.dock {
		position: sticky;
		bottom: 0;
		z-index: 5;
		margin-top: 20px;
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

	.state {
		font-size: 13px;
		color: var(--muted);
	}

	@media (max-width: 560px) {
		.row {
			grid-template-columns: 1fr 1fr;
		}

		.row .grow {
			grid-column: 1 / -1;
		}
	}
</style>
