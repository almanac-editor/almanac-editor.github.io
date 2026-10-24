<script lang="ts">
	import Icon from './Icon.svelte';
	import { formatDate, type Delivery } from '#lib/domain/deliveries.ts';
	import { KIND_NAMES, OUTPUT_NAMES, httpsHost, lessonOutputs } from '#lib/domain/materials.ts';
	import type { Lesson } from '#lib/domain/types.ts';

	/**
	 * The lesson's materials, in the margin. In a class's context, the links
	 * to what that class saw, from its deliveries. Where there are none, the
	 * current plan's outputs as paths: the files to build or find.
	 */
	let {
		lesson,
		lessonPath,
		offering,
		mine,
		names,
		folder,
		onedit
	}: {
		/** The current plan, whose derived `materials` says where outputs land. */
		lesson: Lesson;
		lessonPath: string;
		/** The page's class's offering id; null outside a class. */
		offering: string | null;
		/** The page's class's deliveries of the lesson, oldest first. */
		mine: Delivery[];
		/** Class names by offering id, for outputs listed for every class. */
		names: Map<string, string>;
		/** The page's class's folder in cloud storage, from its offering; null for none. */
		folder: string | null;
		/** Opens the links of one delivery for editing; null where there is none to edit. */
		onedit: ((delivery: number) => void) | null;
	} = $props();

	const linked = $derived(mine.flatMap((d, i) => (d.materials?.length ? [{ d, i }] : [])));
	const files = $derived(lessonOutputs(lesson, lessonPath, offering));
	const shown = $derived(files.outputs.length > 0 || files.sources.length > 0);
	const folderHost = $derived(folder ? httpsHost(folder) : null);
</script>

{#if linked.length || shown || onedit || folderHost}
	<section>
		<h2>Materials</h2>
		{#if folderHost}
			<ul class="res folder">
				<li>
					<Icon name="book" size={16} />
					<div>
						<a href={folder} target="_blank" rel="noreferrer">Class folder</a>
						<span class="where">{folderHost}</span>
					</div>
				</li>
			</ul>
		{/if}
		{#each linked as { d, i } (i)}
			{#if mine.length > 1}<h3>{d.taught ? formatDate(d.taught) : `Time ${i + 1}`}</h3>{/if}
			<ul class="res">
				{#each d.materials ?? [] as m, j (j)}
					{@const host = httpsHost(m.url)}
					<li>
						<Icon name={m.kind === 'file' ? 'file' : 'link'} size={16} />
						<div>
							{#if host}
								<a href={m.url} target="_blank" rel="noreferrer">{m.label ?? KIND_NAMES[m.kind]}</a>
								<span class="where">{m.label ? `${KIND_NAMES[m.kind]} · ` : ''}{host}</span>
							{:else}
								<strong>{m.label ?? KIND_NAMES[m.kind]}</strong>
								<span class="where">{m.url}</span>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		{/each}
		{#if !linked.length && shown}
			<p class="hint">
				{offering ? 'This class’s files' : 'Each class’s files'}, built from the current plan. Find
				them, or build them, at:
			</p>
			<ul class="paths">
				{#each files.outputs as out, i (i)}
					<li>
						<span class="kind"
							>{OUTPUT_NAMES[out.kind]}{offering
								? ''
								: ` · ${names.get(out.offering) ?? out.offering}`}</span
						>
						<code>{out.path}</code>
					</li>
				{/each}
				{#each files.sources as path (path)}
					<li><span class="kind">Source</span> <code>{path}</code></li>
				{/each}
			</ul>
		{/if}
		{#if onedit}
			<button
				type="button"
				class="quiet edit"
				onclick={() => onedit(linked.at(-1)?.i ?? mine.length - 1)}
			>
				<Icon name={linked.length ? 'pencil' : 'plus'} size={16} />
				{linked.length ? 'Edit links' : 'Add links to what the class saw'}
			</button>
		{/if}
	</section>
{/if}

<style>
	h2 {
		margin-bottom: 14px;
		font-size: 17px;
		font-stretch: 90%;
	}

	h3 {
		font-size: 13px;
		margin: 10px 0 6px;
		color: var(--ink-2);
	}

	.res {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 12px;
	}

	.res li {
		display: grid;
		grid-template-columns: 16px 1fr;
		gap: 10px;
		font-size: 14px;
	}

	.res li > :global(svg) {
		margin-top: 3px;
		color: var(--muted);
	}

	.res div {
		display: grid;
		gap: 2px;
		min-width: 0;
	}

	.folder {
		margin-bottom: 12px;
	}

	.where {
		font-size: 13px;
		color: var(--muted);
		overflow-wrap: anywhere;
	}

	.edit {
		margin-top: 10px;
		padding-left: 6px;
	}

	.hint {
		font-size: 13px;
		color: var(--muted);
		margin: 10px 0 8px;
	}

	.paths {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 8px;
		font-size: 13px;
	}

	.kind {
		display: block;
		font-weight: 700;
		color: var(--ink-2);
	}

	.paths code {
		font-size: 12px;
		overflow-wrap: anywhere;
	}
</style>
