<script lang="ts">
	import Icon from './Icon.svelte';
	import MaterialRows from './MaterialRows.svelte';
	import Sheet from './Sheet.svelte';
	import type { Data, HeldRecord } from '#lib/data.ts';
	import { formatDate } from '#lib/domain/deliveries.ts';
	import { blankMaterial, toMaterialDrafts, type MaterialDraft } from '#lib/domain/materials.ts';
	import { stem } from '#lib/domain/paths.ts';
	import { AuthError, ConflictError } from '#lib/domain/repo.ts';
	import { session } from '#lib/session.svelte.ts';

	/**
	 * Links to what a class saw, added after the lesson: one delivery's
	 * `materials`, in one write to the class's record.
	 */
	let {
		open = $bindable(false),
		data,
		held,
		delivery = $bindable(),
		whom,
		onsaved,
		onreload
	}: {
		open: boolean;
		data: Data;
		/** The class's record for this lesson. */
		held: HeldRecord;
		/** Which of its deliveries. */
		delivery: number;
		whom: string;
		onsaved: () => void;
		/** Reads the record again, after it changed elsewhere. */
		onreload: () => void;
	} = $props();

	let items = $state<MaterialDraft[]>([]);
	let saving = $state(false);
	let status = $state<string | null>(null);
	let stale = $state(false);

	const deliveries = $derived(held.record.deliveries);
	const where = $derived(session.source === 'github' ? 'on GitHub' : 'on disk');

	// Opening, or choosing another delivery, starts from what that delivery holds.
	$effect(() => {
		if (!open) return;
		// Built aside and assigned once: reading `items` here would re-run this effect forever.
		const drafts = toMaterialDrafts(deliveries[delivery]?.materials);
		items = drafts.length ? drafts : [blankMaterial()];
		status = null;
		stale = false;
	});

	async function save() {
		if (saving || stale) return;
		saving = true;
		status = null;
		try {
			await data.saveMaterials(
				held,
				delivery,
				$state.snapshot(items),
				`Link what ${whom} saw in ${stem(held.record.lesson)}`
			);
			open = false;
			onsaved();
		} catch (error) {
			if (error instanceof ConflictError) {
				stale = true;
				status = `Not saved: ${whom}’s record for this lesson changed ${where} since it was read. Copy your links, then load the latest version.`;
			} else if (error instanceof AuthError) {
				status =
					'GitHub no longer accepts the token. Copy your links, then add a new token in Settings.';
			} else status = `Not saved. ${(error as Error).message}`;
		} finally {
			saving = false;
		}
	}
</script>

<Sheet bind:open title="Links to what the class saw" lede={whom} onsubmit={save}>
	{#if deliveries.length > 1}
		<label class="field">
			<span>Which time</span>
			<select bind:value={delivery}>
				{#each deliveries as d, i (i)}
					<option value={i}>{d.taught ? formatDate(d.taught) : `Time ${i + 1}`}</option>
				{/each}
			</select>
		</label>
	{/if}
	<MaterialRows bind:items />
	<p class="hint">
		Paste links from your school’s cloud storage, such as OneDrive, Google Drive or SharePoint.
		Almanac only stores the links; they open when clicked.
	</p>

	{#snippet foot()}
		{#if status}
			<div class="msg warn">
				<div>
					{status}
					{#if stale}<button type="button" onclick={onreload}>Load the latest version</button>{/if}
				</div>
			</div>
		{/if}
		<button type="button" class="quiet" onclick={() => (open = false)}>Close</button>
		<button type="submit" class="primary" disabled={saving || stale || !session.active}>
			<Icon name="check" size={16} />
			{saving ? 'Saving…' : 'Save'}
			<kbd>Ctrl Enter</kbd>
		</button>
	{/snippet}
</Sheet>

<style>
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
		kbd {
			display: none;
		}
	}
</style>
