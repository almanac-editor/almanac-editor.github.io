<script lang="ts">
	import { tick } from 'svelte';
	import Icon from './Icon.svelte';
	import MaterialRows from './MaterialRows.svelte';
	import Sheet from './Sheet.svelte';
	import type { Data } from '#lib/data.ts';
	import { today } from '#lib/domain/deliveries.ts';
	import type { MaterialDraft } from '#lib/domain/materials.ts';
	import { AuthError, ConflictError } from '#lib/domain/repo.ts';
	import type { Lesson, Offering } from '#lib/domain/types.ts';
	import { className } from '#lib/house.ts';
	import { session } from '#lib/session.svelte.ts';

	/**
	 * "Log feedback straight after class": records one delivery of the lesson
	 * to this class, with a snapshot of the plan, in one write. What the teacher
	 * typed stays here until it is saved, through closing and conflicts.
	 */
	let {
		open = $bindable(false),
		data,
		offeringPath,
		offering,
		lessonPath,
		lesson,
		onsaved
	}: {
		open: boolean;
		data: Data;
		offeringPath: string;
		offering: Offering;
		lessonPath: string;
		lesson: Lesson;
		onsaved: () => void;
	} = $props();

	const blank = () => ({
		taught: today(),
		by: session.teacher,
		deviations: '',
		feedback: [{ issue: '', change: '' }],
		materials: [] as MaterialDraft[]
	});

	let entry = $state(blank());
	let saving = $state(false);
	let retry = $state(false);
	let status = $state<string | null>(null);
	let list = $state<HTMLElement>();

	const where = $derived(session.source === 'github' ? 'on GitHub' : 'on disk');

	async function addFeedback() {
		entry.feedback.push({ issue: '', change: '' });
		await tick();
		list?.querySelector<HTMLTextAreaElement>('li:last-child textarea')?.focus();
	}

	async function save() {
		if (saving) return;
		if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.taught)) {
			status = 'Give the date the lesson ran.';
			return;
		}
		saving = true;
		status = null;
		session.rememberTeacher(entry.by.trim());
		try {
			// After a conflict, read the record afresh so the entry goes onto the latest version.
			if (retry) data.store.refresh();
			await data.markTaught(offeringPath, offering, lessonPath, lesson, $state.snapshot(entry));
			entry = blank();
			retry = false;
			open = false;
			onsaved();
		} catch (error) {
			if (error instanceof ConflictError) {
				retry = true;
				status = `Not saved: ${className(offering)}’s record for this lesson changed ${where} since it was read. Your entry is still here; save again to add it to the latest version.`;
			} else if (error instanceof AuthError) {
				status =
					'GitHub no longer accepts the token. Copy your entry, then add a new token in Settings.';
			} else status = `Not saved. ${(error as Error).message}`;
		} finally {
			saving = false;
		}
	}
</script>

<Sheet
	bind:open
	title="Mark as taught"
	lede={`${className(offering)} · ${lesson.title}`}
	onsubmit={save}
>
	<div class="row">
		<label class="field"><span>Date</span><input type="date" bind:value={entry.taught} /></label>
		<label class="field grow">
			<span>Taught by</span>
			<input type="text" bind:value={entry.by} autocomplete="name" placeholder="Your name" />
		</label>
	</div>
	<label class="field">
		<span>What changed on the day (optional)</span>
		<!-- svelte-ignore a11y_autofocus -->
		<textarea
			bind:value={entry.deviations}
			autofocus
			placeholder="What was skipped, cut short or added"></textarea>
	</label>

	<h3>Feedback for next time</h3>
	<ol class="fb" bind:this={list}>
		{#each entry.feedback as f, i (i)}
			<li>
				<label class="field">
					<span>What happened</span>
					<textarea bind:value={f.issue}></textarea>
				</label>
				<label class="field">
					<span>Change next time (optional)</span>
					<textarea bind:value={f.change}></textarea>
				</label>
				{#if entry.feedback.length > 1}
					<button
						type="button"
						class="quiet icon"
						aria-label="Remove feedback {i + 1}"
						title="Remove"
						onclick={() => entry.feedback.splice(i, 1)}><Icon name="bin" /></button
					>
				{/if}
			</li>
		{/each}
	</ol>
	<button type="button" class="add" onclick={addFeedback}>
		<Icon name="plus" size={16} /> Add feedback
	</button>

	<h3>Links to what the class saw (optional)</h3>
	<p class="hint first">
		The deck, workbook or handout as the class had it, from your school’s cloud storage. You can add
		them later.
	</p>
	<MaterialRows bind:items={entry.materials} />
	<p class="hint">
		Saves the plan as it stands{session.source === 'github' ? ' and the commit it is at' : ''}, so
		this class’s history keeps what it was taught after the lesson changes.
	</p>

	{#snippet foot()}
		{#if status}<div class="msg warn"><div>{status}</div></div>{/if}
		<button type="button" class="quiet" onclick={() => (open = false)}>Close</button>
		<button type="submit" class="primary" disabled={saving || !session.active}>
			<Icon name="check" size={16} />
			{saving ? 'Saving…' : 'Save'}
			<kbd>Ctrl Enter</kbd>
		</button>
	{/snippet}
</Sheet>

<style>
	.row {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: 0 12px;
	}

	h3 {
		margin: 18px 0 8px;
	}

	.fb {
		list-style: none;
		margin: 0 0 10px;
		padding: 0;
		display: grid;
		gap: 8px;
	}

	.fb li {
		position: relative;
		background: var(--chalk);
		border-top: 3px solid var(--house);
		padding: 12px 14px 2px;
	}

	.fb li button {
		position: absolute;
		top: 6px;
		right: 6px;
	}

	.add {
		border-style: dashed;
	}

	.hint.first {
		margin: 0 0 8px;
	}

	.hint {
		margin: 14px 0 12px;
		font-size: 13px;
		color: var(--muted);
	}

	.msg {
		flex: 1 1 100%;
		margin: 0;
	}

	kbd {
		font-size: 10px;
	}

	@media (max-width: 640px) {
		.row {
			grid-template-columns: 1fr;
		}

		kbd {
			display: none;
		}
	}
</style>
