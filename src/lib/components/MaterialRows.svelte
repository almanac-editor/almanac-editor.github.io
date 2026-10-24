<script lang="ts">
	import { tick } from 'svelte';
	import Icon from './Icon.svelte';
	import {
		KIND_NAMES,
		MATERIAL_KINDS,
		blankMaterial,
		httpsHost,
		type MaterialDraft
	} from '#lib/domain/materials.ts';

	/**
	 * Links to what a class saw, one row each: what it is, an optional label,
	 * and the link from cloud storage. Each row says where its link goes.
	 */
	let { items = $bindable() }: { items: MaterialDraft[] } = $props();

	let list = $state<HTMLElement>();

	const PLACEHOLDERS: Record<MaterialDraft['kind'], string> = {
		deck: 'Slides as shown',
		workbook: 'Workbook as handed out',
		handout: 'Handout as printed',
		file: 'What the file is'
	};

	async function add() {
		// The next kind not yet given, so a deck, workbook and handout go in order.
		const used = new Set(items.map((m) => m.kind));
		items.push(blankMaterial(MATERIAL_KINDS.find((k) => !used.has(k)) ?? 'file'));
		await tick();
		list?.querySelector<HTMLInputElement>('li:last-child input[type="url"]')?.focus();
	}
</script>

<ol class="links" bind:this={list}>
	{#each items as m, i (i)}
		{@const host = m.url.trim() ? httpsHost(m.url.trim()) : null}
		<li>
			<div class="row">
				<label class="field">
					<span>What</span>
					<select bind:value={m.kind}>
						{#each MATERIAL_KINDS as kind (kind)}<option value={kind}>{KIND_NAMES[kind]}</option
							>{/each}
					</select>
				</label>
				<label class="field">
					<span>Label (optional)</span>
					<input type="text" bind:value={m.label} placeholder={PLACEHOLDERS[m.kind]} />
				</label>
			</div>
			<label class="field link">
				<span>Link</span>
				<input
					type="url"
					bind:value={m.url}
					placeholder="https://"
					autocomplete="off"
					spellcheck="false"
				/>
			</label>
			{#if m.url.trim()}
				<p class="where" class:bad={!host}>
					{host ? `Opens ${host}` : 'Only a web address starting https:// can be saved.'}
				</p>
			{/if}
			<button
				type="button"
				class="quiet icon"
				aria-label="Remove link {i + 1}"
				title="Remove"
				onclick={() => items.splice(i, 1)}><Icon name="bin" /></button
			>
		</li>
	{/each}
</ol>
<button type="button" class="add" onclick={add}><Icon name="plus" size={16} /> Add a link</button>

<style>
	.links {
		list-style: none;
		margin: 0 0 10px;
		padding: 0;
		display: grid;
		gap: 8px;
	}

	.links li {
		position: relative;
		background: var(--chalk);
		padding: 12px 44px 4px 14px;
	}

	.links li > button {
		position: absolute;
		top: 6px;
		right: 6px;
	}

	.row {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		gap: 0 12px;
	}

	.link {
		margin-bottom: 6px;
	}

	.links input,
	.links select {
		width: 100%;
	}

	.where {
		margin: 0 0 10px;
		font-size: 12px;
		color: var(--muted);
	}

	.where.bad {
		color: var(--warn-deep);
	}

	.add {
		border-style: dashed;
	}

	@media (max-width: 640px) {
		.row {
			grid-template-columns: 1fr;
		}
	}
</style>
