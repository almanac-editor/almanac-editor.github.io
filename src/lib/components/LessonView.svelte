<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';
	import Lane from './Lane.svelte';
	import {
		DIFFERENTIATION_LABELS,
		KIND_LABELS,
		TIER_LABELS,
		citationParts,
		kindClass,
		linkHost,
		startTimes,
		timing
	} from '#lib/domain/lessonView.ts';
	import type { Lesson, RegistryEntry } from '#lib/domain/types.ts';

	let {
		lesson,
		registry,
		content,
		feedback
	}: {
		lesson: Lesson;
		registry: Map<string, RegistryEntry>;
		/** The content file; undefined for a taught plan, whose content was not kept. */
		content: string | null | undefined;
		/** Feedback from the delivery records, for the margin. */
		feedback?: Snippet;
	} = $props();

	const t = $derived(timing(lesson));
	const starts = $derived(startTimes(lesson.sections.map((s) => s.duration_minutes)));
	const differentiation = $derived(
		Object.entries(DIFFERENTIATION_LABELS).filter(
			([key]) => lesson.differentiation?.[key as keyof typeof DIFFERENTIATION_LABELS]
		)
	);
</script>

<section class="strip" aria-labelledby="strip-h">
	<div class="strip-h">
		<h2 id="strip-h" class="sr-only">Timing</h2>
		<p class="totals">
			<span><strong>{t.talk}</strong> min talk</span>
			<span><strong>{t.activity}</strong> min activity</span>
			{#if t.other}<span><strong>{t.other}</strong> min unclassified</span>{/if}
		</p>
		{#if t.nominal && t.total !== t.nominal}
			<p class="off">
				Sections add up to {t.total} minutes; the lesson is {t.nominal}.
			</p>
		{/if}
	</div>
	<Lane sections={lesson.sections} nominal={lesson.duration_minutes} />
</section>

<div class="cols">
	<div class="main">
		{#if lesson.summary}
			<p class="summary">{lesson.summary}</p>
		{/if}

		<section>
			<h2>Run sheet</h2>
			<ol class="run">
				{#each lesson.sections as s, i (i)}
					<li class:stretch={s.tier === 'stretch'}>
						<span class="at">{starts[i]}<small>min</small></span>
						<div class="body">
							<div class="top">
								{#if s.label}<strong>{s.label}</strong>{/if}
								<span class="mins">{s.duration_minutes} min</span>
							</div>
							<p>{s.section}</p>
						</div>
						<span class="kind {kindClass(s.kind) || 'plain'}">
							<i aria-hidden="true"></i>
							{s.kind ? KIND_LABELS[s.kind] : 'Unclassified'}
							{#if s.tier && s.tier !== 'core'}<em>{TIER_LABELS[s.tier]}</em>{/if}
						</span>
					</li>
				{/each}
			</ol>
		</section>

		<div class="pair">
			<section>
				<h2>Learning intentions</h2>
				{#if lesson.learning_intentions.length}
					<ul class="ticks">
						{#each lesson.learning_intentions as item, i (i)}<li>{item}</li>{/each}
					</ul>
				{:else}<p class="muted">None written yet.</p>{/if}
			</section>
			<section>
				<h2>Success criteria</h2>
				{#if lesson.success_criteria.length}
					<ul class="ticks">
						{#each lesson.success_criteria as item, i (i)}<li>{item}</li>{/each}
					</ul>
				{:else}<p class="muted">None written yet.</p>{/if}
			</section>
		</div>

		{#if lesson.assessment?.formative || lesson.assessment?.evidence?.length}
			<section>
				<h2>Assessment</h2>
				{#if lesson.assessment.formative}<p>{lesson.assessment.formative}</p>{/if}
				{#if lesson.assessment.evidence?.length}
					<h3>Evidence</h3>
					<ul class="ticks">
						{#each lesson.assessment.evidence as item, i (i)}<li>{item}</li>{/each}
					</ul>
				{/if}
			</section>
		{/if}

		{#if differentiation.length}
			<section>
				<h2>Differentiation</h2>
				<dl class="diff">
					{#each differentiation as [key, label] (key)}
						<div>
							<dt>{label}</dt>
							<dd>{lesson.differentiation?.[key as keyof typeof DIFFERENTIATION_LABELS]}</dd>
						</div>
					{/each}
				</dl>
			</section>
		{/if}

		{#if content !== undefined}
			<section>
				<h2>Content file</h2>
				{#if content === null}
					<p class="muted">No content file written yet.</p>
				{:else}
					<details class="content">
						<summary><Icon name="file" size={16} /> Show the content file</summary>
						<pre>{content}</pre>
					</details>
				{/if}
			</section>
		{/if}
	</div>

	<aside class="margin" aria-label="Syllabus, feedback, resources and references">
		<section>
			<h2>Syllabus</h2>
			{#if lesson.curriculum_links.length}
				<ul class="dots">
					{#each lesson.curriculum_links as link, i (i)}
						{@const entry = registry.get(link.id)}
						<li>
							<span class="id">{link.id}</span>
							{#if entry}
								<span class="text">{entry.text}</span>
							{:else}
								<span class="text missing">Not in the unit’s registry</span>
							{/if}
							<span class="cov">{link.coverage}, {link.mode}</span>
							{#if link.note}<span class="note">{link.note}</span>{/if}
						</li>
					{/each}
				</ul>
			{:else}<p class="muted">No dot points linked.</p>{/if}
		</section>

		{#if feedback}<div>{@render feedback()}</div>{/if}

		{#if lesson.resources?.length}
			<section>
				<h2>Resources</h2>
				<ul class="res">
					{#each lesson.resources as r, i (i)}
						{@const host = r.url ? linkHost(r.url) : null}
						<li>
							<Icon name={r.url ? 'link' : 'file'} size={16} />
							<div>
								{#if host}<a href={r.url} target="_blank" rel="noreferrer">{r.name}</a
									>{:else}<strong>{r.name}</strong>{/if}
								{#if r.url && !host}<span class="where">{r.url}</span>{/if}
								{#if r.canvas || r.file}
									<span class="where">
										{#if r.canvas}Canvas: {r.canvas}{/if}
										{#if r.file}File: {r.file}{/if}
									</span>
								{/if}
								{#if r.notes}<span class="rnote">{r.notes}</span>{/if}
							</div>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if lesson.references?.length}
			<section>
				<h2>References</h2>
				<ul class="res">
					{#each lesson.references as r, i (i)}
						{@const host = r.url ? linkHost(r.url) : null}
						<li>
							<Icon name={r.url ? 'link' : 'file'} size={16} />
							<div>
								<span
									>{#each citationParts(r.citation) as part, j (j)}{#if part.italic}<i
												>{part.text}</i
											>{:else}{part.text}{/if}{/each}</span
								>
								{#if host}
									<a class="where" href={r.url} target="_blank" rel="noreferrer">{host}</a>
								{:else if r.url}
									<span class="where">{r.url}</span>
								{/if}
								{#if r.path}<span class="where">File: {r.path}</span>{/if}
								<span class="rnote">{r.used_for}</span>
							</div>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	</aside>
</div>

<style>
	.strip {
		background: var(--paper);
		padding: 18px 20px 6px;
		box-shadow: var(--shadow);
		margin-bottom: 36px;
	}

	.strip-h {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 6px 20px;
		margin-bottom: 18px;
	}

	.totals {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 20px;
		margin: 0;
		font-size: 14px;
		color: var(--muted);
	}

	.totals strong {
		font-size: 34px;
		font-weight: 900;
		line-height: 1;
		font-stretch: 75%;
		color: var(--ink);
	}

	.off {
		margin: 0;
		padding: 4px 10px;
		background: var(--warn-soft);
		color: var(--warn-deep);
		font-size: 13px;
		font-weight: 650;
		align-self: center;
	}

	.cols {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(260px, var(--margin-col));
		gap: 40px;
		align-items: start;
	}

	section + section,
	.pair,
	.pair + section {
		margin-top: 36px;
	}

	h2 {
		margin-bottom: 14px;
	}

	h3 {
		margin: 16px 0 8px;
	}

	.summary {
		font-size: 17px;
		line-height: 1.55;
		max-width: var(--measure);
		margin: 0 0 32px;
		color: var(--ink-2);
	}

	.run {
		list-style: none;
		padding: 0;
		margin: 0;
		border-top: 2px solid var(--ink);
	}

	.run li {
		display: grid;
		grid-template-columns: 64px minmax(0, 1fr) 150px;
		gap: 16px;
		padding: 14px 0;
		border-bottom: 1px solid var(--rule);
	}

	.run li.stretch .body,
	.run li.stretch .at {
		opacity: 0.72;
	}

	.at {
		font-size: 36px;
		font-weight: 900;
		font-stretch: 70%;
		color: var(--house);
		line-height: 1;
	}

	.at small {
		display: block;
		font-size: 11px;
		font-weight: 600;
		font-stretch: 100%;
		color: var(--muted);
		margin-top: 3px;
	}

	.top {
		display: flex;
		flex-wrap: wrap;
		gap: 2px 12px;
		align-items: baseline;
		margin-bottom: 3px;
	}

	.top strong {
		font-size: 16px;
	}

	.mins {
		font-size: 13px;
		color: var(--muted);
	}

	.body p {
		margin: 0;
		max-width: var(--measure);
	}

	.kind {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		align-content: flex-start;
		gap: 4px 7px;
		font-size: 13px;
		font-weight: 650;
	}

	.kind i {
		width: 12px;
		height: 12px;
	}

	.kind.talk i {
		background: var(--house);
	}

	.kind.activity i {
		background:
			repeating-linear-gradient(
				135deg,
				color-mix(in oklab, var(--house) 40%, transparent) 0 2px,
				transparent 2px 5px
			),
			var(--house-soft);
		outline: 1px solid color-mix(in oklab, var(--house) 40%, transparent);
	}

	.kind.plain i {
		background: var(--rule-strong);
	}

	.kind em {
		font-style: normal;
		padding: 1px 6px;
		outline: 1.5px dashed var(--house);
		color: var(--house-deep);
		font-size: 12px;
	}

	.pair {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 32px;
	}

	.pair section + section {
		margin-top: 0;
	}

	.ticks {
		list-style: none;
		padding: 0;
		display: grid;
		gap: 8px;
	}

	.ticks li {
		position: relative;
		padding-left: 22px;
	}

	.ticks li::before {
		content: '';
		position: absolute;
		left: 2px;
		top: 0.5em;
		width: 9px;
		height: 9px;
		background: var(--house);
	}

	.diff {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 2px;
		margin: 0;
	}

	.diff div {
		background: var(--paper);
		padding: 14px 16px;
	}

	.diff dt {
		font-weight: 800;
		font-size: 13px;
		color: var(--house-deep);
		margin-bottom: 4px;
	}

	.diff dd {
		margin: 0;
	}

	.content summary {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		font-weight: 650;
		margin-bottom: 10px;
	}

	.margin {
		position: sticky;
		top: 24px;
		display: grid;
		gap: 0;
		border-top: 2px solid var(--ink);
		padding-top: 18px;
	}

	.margin h2 {
		font-size: 17px;
		font-stretch: 90%;
	}

	.margin > * + * {
		margin-top: 28px;
	}

	.dots,
	.res {
		list-style: none;
		padding: 0;
		display: grid;
		gap: 12px;
	}

	.dots li {
		display: grid;
		grid-template-columns: minmax(58px, max-content) minmax(0, 1fr);
		gap: 2px 10px;
		font-size: 14px;
	}

	.dots li > :not(.id) {
		grid-column: 2;
	}

	.id {
		grid-row: span 3;
		font-weight: 800;
		font-size: 13px;
		color: var(--house-deep);
		padding-top: 1px;
		white-space: nowrap;
	}

	.text.missing {
		color: var(--warn);
	}

	.cov {
		font-size: 12px;
		color: var(--muted);
	}

	.note {
		font-size: 13px;
		color: var(--ink-2);
		font-style: italic;
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
	}

	.where,
	.rnote {
		font-size: 13px;
		color: var(--muted);
	}

	@media (max-width: 1000px) {
		.cols {
			grid-template-columns: 1fr;
		}

		.margin {
			position: static;
		}
	}

	@media (max-width: 640px) {
		.run li {
			grid-template-columns: 44px minmax(0, 1fr);
		}

		.kind {
			grid-column: 2;
		}

		.pair {
			grid-template-columns: 1fr;
		}

		.strip {
			padding: 14px 12px 4px;
		}
	}
</style>
