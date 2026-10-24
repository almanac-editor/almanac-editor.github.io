<script lang="ts">
	import Lane from './Lane.svelte';
	import { KIND_LABELS, TIER_LABELS } from '#lib/domain/lessonView.ts';
	import { fieldName } from '#lib/domain/fieldNames.ts';
	import {
		comparePlans,
		type ListRow,
		type SectionField,
		type TextField
	} from '#lib/domain/planDiff.ts';
	import type { Lesson, RegistryEntry, Section } from '#lib/domain/types.ts';

	/**
	 * Two versions of a lesson, the older first: both lane strips, one above
	 * the other, then field by field what changed from the older to the newer.
	 */
	let {
		before,
		after,
		registry
	}: {
		before: { plan: Lesson; label: string };
		after: { plan: Lesson; label: string };
		registry: Map<string, RegistryEntry>;
	} = $props();

	const diff = $derived(comparePlans(before.plan, after.plan));

	const TEXT_NAMES: Record<TextField, string> = {
		title: 'Title',
		description: 'Description',
		summary: 'Summary',
		duration_minutes: 'Lesson length'
	};
	const SECTION_NAMES: Record<SectionField, string> = {
		label: 'label',
		minutes: 'minutes',
		kind: 'kind',
		tier: 'tier',
		text: 'wording'
	};
	const STATUS: Record<string, string> = {
		same: 'Same',
		changed: 'Changed',
		added: 'Added',
		removed: 'Removed'
	};

	const value = (field: TextField, v: string | number | null) =>
		v === null || v === '' ? 'None' : field === 'duration_minutes' ? `${v} minutes` : String(v);
	const how = (s: Section) =>
		[
			`${s.duration_minutes} min`,
			s.kind ? KIND_LABELS[s.kind] : 'Unclassified',
			s.tier && s.tier !== 'core' ? TIER_LABELS[s.tier] : ''
		]
			.filter(Boolean)
			.join(' · ');
	const listChanged = (rows: ListRow[]) => rows.some((r) => r.status !== 'same');
	const linksChanged = $derived(diff.curriculum_links.some((r) => r.status !== 'same'));
</script>

<section class="lanes" aria-label="Timing of both versions">
	<div class="lane">
		<h2>{before.label}</h2>
		<Lane sections={before.plan.sections} nominal={before.plan.duration_minutes} />
	</div>
	<div class="lane">
		<h2>{after.label}</h2>
		<Lane sections={after.plan.sections} nominal={after.plan.duration_minutes} />
	</div>
</section>

{#if diff.text.length}
	<section>
		<h2>The plan’s text</h2>
		<dl class="texts">
			{#each diff.text as change (change.field)}
				<div>
					<dt>{TEXT_NAMES[change.field]}</dt>
					<dd class="before">
						<span class="sr-only">{before.label}:</span>{value(change.field, change.before)}
					</dd>
					<dd><span class="sr-only">{after.label}:</span>{value(change.field, change.after)}</dd>
				</div>
			{/each}
		</dl>
	</section>
{/if}

<section>
	<h2>Run sheet</h2>
	<ol class="rows">
		{#each diff.sections as row, i (i)}
			{@const s = (row.after ?? row.before)!}
			<li class={row.status}>
				<span class="status"
					>{STATUS[row.status]}{#if row.status === 'changed'}: {row.changed
							.map((f) => SECTION_NAMES[f])
							.join(', ')}{/if}</span
				>
				<div class="body">
					<div class="top">
						{#if s.label}<strong>{s.label}</strong>{/if}
						<span class="how">{how(s)}</span>
					</div>
					{#if row.status === 'changed' && row.before}
						<div class="was">
							<span class="tag">{before.label}</span>
							{#if row.changed.includes('label') && row.before.label}<strong
									>{row.before.label}</strong
								>{/if}
							<span class="how">{how(row.before)}</span>
							{#if row.changed.includes('text')}<p>{row.before.section}</p>{/if}
						</div>
						{#if row.changed.includes('text')}
							<div class="now">
								<span class="tag">{after.label}</span>
								<p>{s.section}</p>
							</div>
						{/if}
					{:else if row.status !== 'same'}
						<p>{s.section}</p>
					{/if}
				</div>
			</li>
		{/each}
	</ol>
</section>

{#snippet list(title: string, rows: ListRow[])}
	<section>
		<h2>{title}</h2>
		{#if listChanged(rows)}
			<ul class="rows plain">
				{#each rows as row, i (i)}
					<li class={row.status}>
						<span class="status">{STATUS[row.status]}</span>
						<div class="body"><p>{row.text}</p></div>
					</li>
				{/each}
			</ul>
		{:else}<p class="muted">No change.</p>{/if}
	</section>
{/snippet}

<div class="pair">
	{@render list('Learning intentions', diff.learning_intentions)}
	{@render list('Success criteria', diff.success_criteria)}
</div>

<section>
	<h2>Syllabus</h2>
	{#if linksChanged}
		<ul class="rows plain">
			{#each diff.curriculum_links as row, i (i)}
				{@const link = (row.after ?? row.before)!}
				<li class={row.status}>
					<span class="status"
						>{STATUS[row.status]}{#if row.status === 'changed'}: {row.changed.join(', ')}{/if}</span
					>
					<div class="body">
						<p>
							<strong>{link.id}</strong>
							{registry.get(link.id)?.text ?? ''}
							<span class="how">
								{#if row.status === 'changed' && row.before}
									was {row.before.coverage}, {row.before.mode}{row.before.note
										? ` (${row.before.note})`
										: ''}; now
								{/if}
								{link.coverage}, {link.mode}{link.note ? ` (${link.note})` : ''}
							</span>
						</p>
					</div>
				</li>
			{/each}
		</ul>
	{:else}<p class="muted">No change.</p>{/if}
</section>

{#if diff.other.length}
	<section>
		<h2>Also changed</h2>
		<p>
			{diff.other.map((k) => fieldName('lesson.schema.json', k)).join(', ')}. View each version to
			see them.
		</p>
	</section>
{/if}

<style>
	section + section,
	.pair,
	section + .pair,
	.pair + section {
		margin-top: 36px;
	}

	h2 {
		margin-bottom: 14px;
	}

	.lanes {
		display: grid;
		gap: 18px;
		background: var(--paper);
		padding: 18px 20px 6px;
		box-shadow: var(--shadow);
	}

	.lane h2 {
		font-size: 13px;
		font-weight: 700;
		font-stretch: 100%;
		color: var(--ink-2);
		margin: 0 0 6px;
	}

	.texts {
		display: grid;
		gap: 14px;
		margin: 0;
		max-width: var(--measure);
	}

	.texts dt {
		font-size: 13px;
		font-weight: 700;
		color: var(--ink-2);
	}

	.texts dd {
		margin: 2px 0 0;
	}

	.texts dd.before,
	.was {
		color: var(--muted);
		text-decoration: line-through;
		text-decoration-color: var(--rule-strong);
	}

	.rows {
		list-style: none;
		padding: 0;
		margin: 0;
		border-top: 2px solid var(--ink);
	}

	.rows li {
		display: grid;
		grid-template-columns: 150px minmax(0, 1fr);
		gap: 0 16px;
		padding: 12px 0;
		border-bottom: 1px solid var(--rule);
	}

	.status {
		font-size: 13px;
		font-weight: 700;
		color: var(--muted);
	}

	.changed .status {
		color: var(--house-deep);
	}

	.added .status {
		color: var(--good);
	}

	.removed .status {
		color: var(--warn-deep);
	}

	.same .body {
		color: var(--muted);
	}

	.removed .body {
		color: var(--muted);
		text-decoration: line-through;
		text-decoration-color: var(--rule-strong);
	}

	.top {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 10px;
		align-items: baseline;
	}

	.how {
		font-size: 13px;
		color: var(--muted);
	}

	.body p {
		margin: 4px 0 0;
		max-width: var(--measure);
	}

	.was,
	.now {
		margin-top: 8px;
	}

	.tag {
		display: block;
		font-size: 12px;
		font-weight: 700;
		color: var(--ink-2);
		text-decoration: none;
	}

	.was .tag {
		display: inline-block;
		margin-right: 8px;
	}

	.pair {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 32px;
	}

	.pair section {
		margin-top: 0;
	}

	@media (max-width: 760px) {
		.pair {
			grid-template-columns: 1fr;
		}

		.rows li {
			grid-template-columns: 1fr;
			gap: 4px;
		}
	}
</style>
