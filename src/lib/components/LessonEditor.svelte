<script lang="ts">
	import type { Snippet } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import Icon from './Icon.svelte';
	import Lane from './Lane.svelte';
	import ListEditor from './ListEditor.svelte';
	import {
		DIFFERENTIATION_LABELS,
		KIND_LABELS,
		TIER_LABELS,
		startTimes
	} from '#lib/domain/lessonView.ts';
	import {
		DIFFERENTIATION_KEYS,
		blankReference,
		blankSection,
		fromDraft,
		linkTo,
		move,
		sectionTotal,
		toDraft,
		type LessonDraft
	} from '#lib/domain/lessonEdit.ts';
	import { fieldName } from '#lib/domain/fieldNames.ts';
	import { stem } from '#lib/domain/paths.ts';
	import { AuthError, ConflictError } from '#lib/domain/repo.ts';
	import type { Store } from '#lib/domain/store.ts';
	import type { Lesson, RegistryEntry } from '#lib/domain/types.ts';
	import type { Problem, Schemas } from '#lib/domain/validate.ts';
	import { session } from '#lib/session.svelte.ts';
	import { className, titleCase } from '#lib/house.ts';
	import type { ToKeep } from '#lib/domain/deliveries.ts';

	const MODES = ['introduced', 'developed', 'consolidated', 'revisited'] as const;

	let {
		path,
		lesson,
		sha,
		registry,
		schemas,
		store,
		hasContent,
		viewHref,
		onsaved,
		onreload,
		feedback,
		create
	}: {
		path: string;
		lesson: Lesson;
		sha: string;
		registry: Map<string, RegistryEntry>;
		schemas: Schemas;
		store: Store;
		hasContent: boolean;
		viewHref: string;
		onsaved: (lesson: Lesson, sha: string) => void;
		/** Throws away the loaded plan and reads the file again. */
		onreload: () => void;
		/** Open feedback from the delivery records, for the margin. */
		feedback?: Snippet;
		/**
		 * Set for a plan with no file yet: saving calls this instead of
		 * overwriting `path`, and is allowed before anything is changed.
		 */
		create?: (lesson: Lesson, message: string) => Promise<void>;
	} = $props();

	// The editor works on a copy taken when it opens; a save makes the saved plan the new baseline.
	// svelte-ignore state_referenced_locally
	let draft = $state<LessonDraft>(toDraft(lesson));
	// svelte-ignore state_referenced_locally
	let baseline = $state(JSON.stringify(toDraft(lesson)));
	// svelte-ignore state_referenced_locally
	let message = $state(create ? `Add lesson ${stem(path)}` : `Edit ${stem(path)}`);
	let saving = $state(false);
	let status = $state<
		| { kind: 'saved'; sectionsMoved: boolean }
		| { kind: 'problems'; problems: Problem[] }
		| { kind: 'conflict' }
		| { kind: 'error'; text: string }
		| { kind: 'keep'; keep: ToKeep[] }
		| null
	>(null);

	const dirty = $derived(JSON.stringify(draft) !== baseline);
	const total = $derived(sectionTotal(draft));
	const starts = $derived(startTimes(draft.sections.map((s) => s.duration_minutes)));

	function sectionsChanged(before: Lesson, after: Lesson): boolean {
		const shape = (l: Lesson) =>
			JSON.stringify(l.sections.map((s) => [s.label ?? '', s.duration_minutes]));
		return shape(before) !== shape(after);
	}

	/**
	 * `ask` checks first whether the save would put an earlier class's plan at
	 * risk, and if so asks; `keep` keeps those plans in the same commit, and
	 * `skip` saves the lesson alone.
	 */
	async function save(choice: 'ask' | 'keep' | 'skip' = 'ask') {
		if (saving) return;
		const asked = status?.kind === 'keep' ? status.keep : [];
		status = null;
		let next: Lesson;
		try {
			next = fromDraft(lesson, $state.snapshot(draft) as LessonDraft, !!create);
		} catch (error) {
			status = { kind: 'error', text: (error as Error).message };
			return;
		}
		// A folder without schemas/ saves unchecked.
		const problems = schemas.has('lesson.schema.json')
			? schemas.validate('lesson.schema.json', next)
			: [];
		if (problems.length) {
			status = { kind: 'problems', problems };
			return;
		}
		saving = true;
		try {
			const data = session.data;
			if (!create && data && choice === 'ask') {
				// A lesson an earlier class had with no plan kept, which a later class also takes.
				const atRisk = await data.plansAtRisk(path).catch(() => [] as ToKeep[]);
				if (atRisk.some((k) => k.outcome !== 'several')) {
					status = { kind: 'keep', keep: atRisk };
					return;
				}
			}
			const text = message.trim() || (create ? `Add lesson ${stem(path)}` : `Edit ${stem(path)}`);
			let newSha = '';
			if (create) await create(next, text);
			else if (data && choice === 'keep' && asked.length) {
				newSha = await data.saveLesson(path, next, sha, text, asked, lesson);
			} else newSha = await store.writeJson(path, next, sha, text);
			const moved = sectionsChanged(lesson, next);
			// The new baseline goes first, so a page that moves on after the save is not asked to discard.
			draft = toDraft(next);
			baseline = JSON.stringify(toDraft(next));
			status = { kind: 'saved', sectionsMoved: moved && hasContent };
			onsaved(next, newSha);
		} catch (error) {
			if (error instanceof ConflictError && create) {
				status = { kind: 'error', text: (error as Error).message };
			} else if (error instanceof ConflictError) status = { kind: 'conflict' };
			else if (error instanceof AuthError) {
				status = {
					kind: 'error',
					text: 'GitHub no longer accepts the token. Copy your edits, then add a new token in Settings.'
				};
			} else status = { kind: 'error', text: (error as Error).message };
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

	function onbeforeunload(event: BeforeUnloadEvent) {
		if (dirty) event.preventDefault();
	}

	const where = $derived(session.source === 'github' ? 'on GitHub' : 'on disk');

	beforeNavigate(({ cancel, willUnload }) => {
		if (
			dirty &&
			!willUnload &&
			!confirm('Leave without saving? Your edits to this plan will be lost.')
		) {
			cancel();
		}
	});

	function loadLatest() {
		if (dirty && !confirm(`Load the version ${where}? Your unsaved edits will be lost.`)) return;
		onreload();
	}

	const over = $derived(draft.duration_minutes !== null && total !== draft.duration_minutes);

	const kinds = Object.entries(KIND_LABELS);
	const tiers = Object.entries(TIER_LABELS);
</script>

<svelte:window {onkeydown} {onbeforeunload} />

<section class="strip" aria-label="Timing as you edit">
	<div class="strip-h">
		<p class="total" class:off={over}>
			<strong>{total}</strong> of {draft.duration_minutes ?? '?'} min
			{#if over && draft.duration_minutes !== null}
				<span>
					{total > draft.duration_minutes
						? `${total - draft.duration_minutes} over`
						: `${draft.duration_minutes - total} spare`}
				</span>
			{/if}
		</p>
		<label class="length">
			<span>Lesson length</span>
			<input type="number" min="1" step="1" bind:value={draft.duration_minutes} />
			<span>min</span>
		</label>
	</div>
	<Lane sections={draft.sections} nominal={draft.duration_minutes} />
</section>

<div class="cols">
	<div class="main">
		<label class="field"
			><span>Title</span><input type="text" bind:value={draft.title} class="title-input" /></label
		>
		<label class="field"
			><span>Description</span><textarea bind:value={draft.description}></textarea></label
		>
		<label class="field"><span>Summary</span><textarea bind:value={draft.summary}></textarea></label
		>

		<section>
			<h2>Run sheet</h2>
			<ol class="run">
				{#each draft.sections as s, i (i)}
					<li class:stretch={s.tier === 'stretch'}>
						<span class="at" aria-hidden="true">{starts[i]}<small>min</small></span>
						<fieldset>
							<legend class="sr-only">Section {i + 1}, starts at {starts[i]} min</legend>
							<div class="row">
								<label class="field grow"
									><span>Label</span><input type="text" bind:value={s.label} /></label
								>
								<label class="field mins"
									><span>Minutes</span><input
										type="number"
										min="1"
										step="1"
										bind:value={s.duration_minutes}
									/></label
								>
								<label class="field">
									<span>Kind</span>
									<select bind:value={s.kind}>
										<option value="">Unclassified</option>
										{#each kinds as [value, text] (value)}<option {value}>{text}</option>{/each}
									</select>
								</label>
								<label class="field">
									<span>Tier</span>
									<select bind:value={s.tier}>
										<option value="">Core (unset)</option>
										{#each tiers as [value, text] (value)}<option {value}>{text}</option>{/each}
									</select>
								</label>
							</div>
							<label class="field"
								><span>What happens</span><textarea bind:value={s.section}></textarea></label
							>
						</fieldset>
						<div class="controls">
							<button
								type="button"
								class="quiet icon"
								title="Move up"
								aria-label="Move section {i + 1} up"
								disabled={i === 0}
								onclick={() => move(draft.sections, i, -1)}><Icon name="up" /></button
							>
							<button
								type="button"
								class="quiet icon"
								title="Move down"
								aria-label="Move section {i + 1} down"
								disabled={i === draft.sections.length - 1}
								onclick={() => move(draft.sections, i, 1)}><Icon name="down" /></button
							>
							<button
								type="button"
								class="quiet icon danger"
								title="Remove section"
								aria-label="Remove section {i + 1}"
								onclick={() => draft.sections.splice(i, 1)}><Icon name="bin" /></button
							>
						</div>
					</li>
				{/each}
			</ol>
			<button type="button" class="add" onclick={() => draft.sections.push(blankSection())}>
				<Icon name="plus" size={16} /> Add section
			</button>
		</section>

		<div class="pair">
			<section>
				<h2>Learning intentions</h2>
				<ListEditor
					bind:items={draft.learning_intentions}
					label="Learning intention"
					addLabel="Add learning intention"
				/>
			</section>
			<section>
				<h2>Success criteria</h2>
				<ListEditor
					bind:items={draft.success_criteria}
					label="Success criterion"
					addLabel="Add success criterion"
				/>
			</section>
		</div>

		<section>
			<h2>Assessment</h2>
			<label class="field"
				><span>Formative</span><textarea bind:value={draft.assessment.formative}></textarea></label
			>
			<h3>Evidence</h3>
			<ListEditor bind:items={draft.assessment.evidence} label="Evidence" addLabel="Add evidence" />
		</section>

		<section>
			<h2>Differentiation</h2>
			<div class="diff">
				{#each DIFFERENTIATION_KEYS as key (key)}
					<label class="field"
						><span>{DIFFERENTIATION_LABELS[key]}</span><textarea
							bind:value={draft.differentiation[key]}></textarea></label
					>
				{/each}
			</div>
		</section>
	</div>

	<aside class="margin" aria-label="Syllabus, feedback, resources and references">
		{#if feedback}<div class="slot">{@render feedback()}</div>{/if}

		<section>
			<h2>Syllabus</h2>
			{#if create}
				<p class="hint">Link the dot points this lesson covers, from the unit’s registry.</p>
				{#each draft.curriculum_links as link, i (link.id)}
					<div class="field dot">
						<b class="dot-id">{link.id}</b>
						<span class="dot-text">{registry.get(link.id)?.text ?? ''}</span>
						<div class="dot-how">
							<select bind:value={link.coverage} aria-label="Coverage of {link.id}">
								<option value="full">Full</option>
								<option value="partial">Partial</option>
							</select>
							<select bind:value={link.mode} aria-label="Mode for {link.id}">
								{#each MODES as mode (mode)}<option value={mode}>{titleCase(mode)}</option>{/each}
							</select>
							<button
								type="button"
								class="quiet icon danger"
								title="Unlink"
								aria-label="Unlink {link.id}"
								onclick={() => draft.curriculum_links.splice(i, 1)}><Icon name="bin" /></button
							>
						</div>
						<textarea
							bind:value={link.note}
							placeholder="Note (optional)"
							aria-label="Note for {link.id}"></textarea>
					</div>
				{/each}
				{@const linked = new Set(draft.curriculum_links.map((l) => l.id))}
				{@const open = [...registry.values()].filter((entry) => !linked.has(entry.id))}
				{#if open.length}
					<select
						class="add-dot"
						aria-label="Link a dot point"
						value=""
						onchange={(e) => {
							const entry = registry.get(e.currentTarget.value);
							if (entry) draft.curriculum_links.push(linkTo(entry));
							e.currentTarget.value = '';
						}}
					>
						<option value="">Link a dot point…</option>
						{#each open as entry (entry.id)}
							<option value={entry.id}>{entry.id}: {entry.text}</option>
						{/each}
					</select>
				{:else if registry.size === 0}
					<p class="muted">The unit has no dot points yet.</p>
				{/if}
			{:else}
				<p class="hint">
					Ids, coverage and mode come from the unit’s registry. Notes can be edited.
				</p>
				{#each draft.curriculum_links as link, i (i)}
					<label class="field dot">
						<b class="dot-id">{link.id}</b>
						<span class="dot-text"
							>{registry.get(link.id)?.text ?? 'Not in the unit’s registry'}
							<i>{link.coverage}, {link.mode}</i></span
						>
						<textarea bind:value={link.note} placeholder="Note (optional)"></textarea>
					</label>
				{:else}
					<p class="muted">No dot points linked.</p>
				{/each}
			{/if}
		</section>

		{#if draft.resources.length}
			<section>
				<h2>Resources</h2>
				<p class="hint">Links, Canvas targets and files are set in the plan’s source.</p>
				{#each draft.resources as r, i (i)}
					<fieldset class="res">
						<legend class="sr-only">Resource {i + 1}</legend>
						<label class="field"><span>Name</span><input type="text" bind:value={r.name} /></label>
						{#if r.canvas || r.file || r.url}
							<p class="where">
								{#if r.canvas}Canvas: {r.canvas}{/if}
								{#if r.file}File: {r.file}{/if}
								{#if r.url}Link{/if}
							</p>
						{/if}
						<label class="field"><span>Notes</span><textarea bind:value={r.notes}></textarea></label
						>
					</fieldset>
				{/each}
			</section>
		{/if}

		<section>
			<h2>References</h2>
			<p class="hint">Where the lesson’s claims come from, for checking them later.</p>
			{#each draft.references as r, i (i)}
				<fieldset class="res">
					<legend class="sr-only">Reference {i + 1}</legend>
					<div class="ref-head">
						<span class="ref-num">{i + 1}</span>
						<div class="ref-controls">
							<button
								type="button"
								class="quiet icon"
								title="Move up"
								aria-label="Move reference {i + 1} up"
								disabled={i === 0}
								onclick={() => move(draft.references, i, -1)}><Icon name="up" /></button
							>
							<button
								type="button"
								class="quiet icon"
								title="Move down"
								aria-label="Move reference {i + 1} down"
								disabled={i === draft.references.length - 1}
								onclick={() => move(draft.references, i, 1)}><Icon name="down" /></button
							>
							<button
								type="button"
								class="quiet icon danger"
								title="Remove reference"
								aria-label="Remove reference {i + 1}"
								onclick={() => draft.references.splice(i, 1)}><Icon name="bin" /></button
							>
						</div>
					</div>
					<label class="field"
						><span>Citation</span><textarea
							bind:value={r.citation}
							placeholder="APA 7, with *asterisks* around italics"></textarea></label
					>
					<div class="field">
						<span>Source</span>
						<div class="ref-source">
							<select bind:value={r.source} aria-label="Reference {i + 1} source kind">
								<option value="url">Link</option>
								<option value="path">File in the repo</option>
							</select>
							<input
								type="text"
								bind:value={r.where}
								aria-label={r.source === 'url'
									? `Reference ${i + 1} link`
									: `Reference ${i + 1} file`}
								placeholder={r.source === 'url' ? 'https://' : 'scripts/make_data.py'}
							/>
						</div>
					</div>
					<label class="field"
						><span>Used for</span><textarea
							bind:value={r.used_for}
							placeholder="The section, and the claims that rest on this source"></textarea></label
					>
				</fieldset>
			{/each}
			<button type="button" class="add" onclick={() => draft.references.push(blankReference())}>
				<Icon name="plus" size={16} /> Add reference
			</button>
		</section>
	</aside>
</div>

<div class="dock" class:dirty>
	{#if status?.kind === 'saved'}
		<div class="msg ok">
			<div>
				{session.source === 'sample'
					? 'Saved in this tab (sample lessons).'
					: session.source === 'github'
						? `Saved as a commit to ${session.target.branch}.`
						: `Saved to ${stem(path)}.json in ${session.label}.`}
				{#if status.sectionsMoved}
					The run sheet changed, so the content file’s section headings may no longer match. Update
					them, or record the change under <code>## Plan deviations</code>.
				{/if}
			</div>
		</div>
	{:else if status?.kind === 'problems'}
		<div class="msg warn">
			<div>
				Not saved. Fix these first:
				<ul>
					{#each status.problems as p, i (i)}<li>
							<b>{fieldName('lesson.schema.json', p.path)}</b>
							{p.message}.
						</li>{/each}
				</ul>
			</div>
		</div>
	{:else if status?.kind === 'conflict'}
		<div class="msg warn">
			<div>
				Not saved: this plan changed {where} after you opened it. Your edits are still here. Copy what
				you need, then
				<button type="button" onclick={loadLatest}>Load the latest version</button>
			</div>
		</div>
	{:else if status?.kind === 'error'}
		<div class="msg warn"><div>Not saved. {status.text}</div></div>
	{:else if status?.kind === 'keep'}
		{@const kept = status.keep.filter((k) => k.outcome !== 'several')}
		{@const left = status.keep.length - kept.length}
		{@const whom = [...new Set(kept.map((k) => `${className(k.offering)} (${k.offering.year})`))]}
		<div class="msg note">
			<div>
				{whom.join(', ')}
				{whom.length === 1 ? 'had' : 'each had'} this lesson with no plan kept, and a later class takes
				it too. Saving changes the plan they were taught. Keep it as it stands now, before your edit,
				in {whom.length === 1 ? 'that class’s' : 'each class’s'} record?
				{#if left}
					{left === 1 ? 'One class' : `${left} classes`} that had it more than once {left === 1
						? 'is'
						: 'are'} left as {left === 1 ? 'it is' : 'they are'}.
				{/if}
				<div class="choices">
					<button type="button" class="primary" onclick={() => save('keep')}
						>Keep {kept.length === 1 ? 'the plan' : 'the plans'} and save</button
					>
					<button type="button" onclick={() => save('skip')}>Save without keeping</button>
				</div>
			</div>
		</div>
	{/if}
	<div class="bar">
		<span class="state">
			<i aria-hidden="true"></i>
			{dirty ? 'Unsaved changes' : 'No changes'}
		</span>
		{#if session.source === 'github'}
			<label class="message">
				<span class="sr-only">Commit message</span>
				<Icon name="commit" size={16} />
				<input type="text" bind:value={message} />
			</label>
		{:else}
			<span class="message where">
				<Icon name="file" size={16} />
				{session.label}/…/{stem(path)}.json
			</span>
		{/if}
		<a class="btn" href={viewHref}>
			<Icon name="eye" size={16} />
			{create ? 'Cancel' : dirty ? 'Discard' : 'View'}
		</a>
		<button
			class="primary"
			type="button"
			onclick={() => save()}
			disabled={saving || !(dirty || create) || !session.active}
		>
			{saving ? 'Saving…' : create ? 'Create lesson' : 'Save'}
			<kbd>Ctrl S</kbd>
		</button>
	</div>
</div>

<style>
	.strip {
		background: var(--paper);
		padding: 16px 20px 6px;
		box-shadow: var(--shadow);
		margin-bottom: 32px;
	}

	.strip-h {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px 20px;
		margin-bottom: 16px;
	}

	.total {
		margin: 0;
		font-size: 14px;
		color: var(--muted);
	}

	.total strong {
		font-size: 34px;
		font-weight: 900;
		font-stretch: 75%;
		color: var(--ink);
		margin-right: 2px;
	}

	.total span {
		margin-left: 8px;
		padding: 2px 8px;
		font-weight: 700;
		background: var(--warn-soft);
		color: var(--warn-deep);
	}

	.total.off strong {
		color: var(--warn);
	}

	.length {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		font-weight: 700;
		color: var(--ink-2);
	}

	.length input {
		width: 5.5em;
	}

	.cols {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(260px, var(--margin-col));
		gap: 40px;
		align-items: start;
	}

	.cols section,
	.pair {
		margin-top: 36px;
	}

	h2 {
		margin-bottom: 14px;
	}

	h3 {
		margin: 4px 0 8px;
	}

	.title-input {
		font-size: 20px;
		font-weight: 750;
	}

	.run {
		list-style: none;
		padding: 0;
		margin: 0 0 12px;
		border-top: 2px solid var(--ink);
	}

	.run li {
		display: grid;
		grid-template-columns: 64px minmax(0, 1fr) auto;
		gap: 16px;
		padding: 16px 0 4px;
		border-bottom: 1px solid var(--rule);
	}

	.run li.stretch .at {
		color: var(--house);
	}

	.at {
		font-size: 36px;
		font-weight: 900;
		font-stretch: 70%;
		color: var(--house);
		line-height: 1;
		padding-top: 22px;
	}

	.at small {
		display: block;
		font-size: 11px;
		font-weight: 600;
		font-stretch: 100%;
		color: var(--muted);
		margin-top: 3px;
	}

	fieldset {
		border: 0;
		margin: 0;
		padding: 0;
		min-width: 0;
	}

	.row {
		display: grid;
		grid-template-columns: minmax(0, 2fr) minmax(64px, 0.55fr) minmax(0, 1.25fr) minmax(0, 1fr);
		gap: 0 10px;
	}

	.controls {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding-top: 20px;
	}

	.danger:hover:not(:disabled) {
		color: var(--warn);
	}

	.add {
		border-style: dashed;
	}

	.pair {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 32px;
	}

	.pair section {
		margin-top: 0;
	}

	.diff {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 0 16px;
	}

	.margin {
		border-top: 2px solid var(--ink);
		padding-top: 18px;
	}

	.margin > section:first-child {
		margin-top: 0;
	}

	.margin h2 {
		font-size: 17px;
		font-stretch: 90%;
	}

	.hint {
		font-size: 13px;
		color: var(--muted);
	}

	.dot {
		display: grid;
		grid-template-columns: minmax(58px, max-content) minmax(0, 1fr);
		gap: 4px 10px;
	}

	.dot-id {
		grid-row: span 2;
		font-size: 13px;
		color: var(--house-deep);
		padding-top: 1px;
		white-space: nowrap;
	}

	.dot-text {
		font-size: 13px;
	}

	.dot-text i {
		display: block;
		font-style: normal;
		font-size: 12px;
		color: var(--muted);
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

	.add-dot {
		width: 100%;
		margin-top: 4px;
	}

	.dot textarea {
		grid-column: 2;
	}

	.res {
		padding-bottom: 6px;
		margin-bottom: 14px;
		border-bottom: 1px solid var(--rule);
	}

	.ref-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 6px;
	}

	.ref-num {
		font-size: 13px;
		font-weight: 800;
		color: var(--house-deep);
	}

	.ref-controls {
		display: flex;
		gap: 2px;
	}

	.ref-source {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		gap: 6px;
	}

	.where {
		margin: -8px 0 10px;
		font-size: 12px;
		color: var(--muted);
	}

	.dock {
		position: sticky;
		bottom: 0;
		z-index: 5;
		margin: 48px calc(-1 * clamp(16px, 4vw, 48px)) 0;
		padding: 0 clamp(16px, 4vw, 48px) 12px;
		background: linear-gradient(transparent, var(--chalk) 14px);
	}

	.dock .msg {
		margin: 0 0 8px;
		box-shadow: var(--shadow);
	}

	.choices {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 8px;
	}

	.choices button {
		margin-top: 0;
	}

	.dock .msg ul {
		margin-top: 4px;
	}

	.bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 10px;
		padding: 10px 10px 10px 16px;
		background: var(--ink);
		color: var(--chalk);
		box-shadow: var(--shadow);
	}

	.state {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		font-weight: 650;
		min-width: 128px;
	}

	.state i {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		border: 2px solid currentColor;
		opacity: 0.6;
	}

	.dirty .state i {
		background: var(--house);
		border-color: var(--house);
		opacity: 1;
		box-shadow: 0 0 0 3px color-mix(in oklab, var(--house) 35%, transparent);
	}

	.message {
		flex: 1 1 220px;
		display: flex;
		align-items: center;
		gap: 8px;
		color: #9a9ea8;
	}

	.where {
		font-size: 13px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}

	.message input {
		background: #23252c;
		border-color: #3a3d45;
		color: var(--chalk);
		padding: 7px 10px;
	}

	.bar .btn {
		background: transparent;
		color: var(--chalk);
		border-color: #4a4d55;
	}

	.bar .btn:hover {
		border-color: var(--chalk);
	}

	.bar .primary:disabled {
		opacity: 0.35;
	}

	.bar kbd {
		font-size: 10px;
	}

	@media (max-width: 1000px) {
		.cols {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 640px) {
		.run li {
			grid-template-columns: minmax(0, 1fr) auto;
		}

		.at {
			display: none;
		}

		.pair {
			grid-template-columns: 1fr;
		}

		.row {
			grid-template-columns: minmax(0, 1fr) 80px;
		}

		.bar kbd,
		.message {
			display: none;
		}

		.bar {
			flex-wrap: nowrap;
		}

		.state {
			flex: 1;
		}

		.state {
			min-width: 0;
		}

		.strip {
			padding: 14px 12px 4px;
		}
	}
</style>
