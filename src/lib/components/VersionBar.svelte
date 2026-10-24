<script lang="ts" module>
	import { formatDate } from '#lib/domain/deliveries.ts';
	import type { Taught, Version } from '#lib/domain/versions.ts';

	/** A version as its button names it: when it was first taught, and to whom. */
	export function versionLabel(v: Version, names: Map<string, string>): string {
		const first = v.taught[0];
		if (!first) return 'Now';
		const when = first.taught ? formatDate(first.taught) : 'Date not recorded';
		const who = first.offeringPath ? (names.get(first.offeringPath) ?? 'A class') : 'A class';
		const more = v.taught.length > 1 ? ` +${v.taught.length - 1}` : '';
		return `${when} · ${who}${more}${v.current ? ' · now' : ''}`;
	}
</script>

<script lang="ts">
	import Icon from './Icon.svelte';
	import type { Delivery } from '#lib/domain/deliveries.ts';
	import { versionOf } from '#lib/domain/versions.ts';

	/**
	 * A lesson's versions above the lesson: the plan each class was taught,
	 * oldest first, and the plan as it stands. One shows, and can be compared
	 * with any other, earlier or later. Only the current plan can be edited.
	 */
	let {
		versions,
		shown = $bindable(),
		against = $bindable(),
		comparing = $bindable(),
		names,
		mine,
		whom,
		offeringPath,
		commitHref
	}: {
		versions: Version[];
		/** The version showing. */
		shown: number;
		/** The version it is compared with. */
		against: number;
		comparing: boolean;
		/** Class names by offering file. */
		names: Map<string, string>;
		/** The page's class's deliveries of the lesson, oldest first; empty outside a class. */
		mine: Delivery[];
		/** The page's class, as named on its band; null outside a class. */
		whom: string | null;
		/** The page's class's offering file; null outside a class. */
		offeringPath: string | null;
		/** A link to a commit, where the files are on GitHub. */
		commitHref: (sha: string) => string | null;
	} = $props();

	const last = $derived(mine.at(-1));
	const when = $derived(
		last?.taught ? `on ${formatDate(last.taught)}` : '(the date was not recorded)'
	);
	const lastPlanned = $derived(mine.findLast((d) => d.plan));
	const href = $derived(last?.plan_commit ? commitHref(last.plan_commit) : null);
	const label = (i: number) => versionLabel(versions[i], names);
	const className = (t: Taught) =>
		t.offeringPath ? (names.get(t.offeringPath) ?? 'A class') : 'A class';
	const who = (v: Version) =>
		v.taught.map((t) => `${className(t)}${t.taught ? `, ${formatDate(t.taught)}` : ''}`).join('; ');
	const had = $derived(versions[shown]?.taught ?? []);
	// The version the page's class had, which the summary line speaks of.
	const mineAt = $derived(offeringPath ? versionOf(versions, offeringPath) : -1);
	// Away from the current plan, the line is tinted so an old plan is never taken for today's.
	const away = $derived(comparing || !versions[shown]?.current);
	// Closed by default, so the history never takes focus from the plan; opened by the teacher.
	let open = $state(false);
</script>

{#if versions.length > 1 || (whom && last) || had.length}
	<details class="history" class:away bind:open>
		<summary>
			<span class="chev" aria-hidden="true"><Icon name="right" size={14} /></span>
			<span class="line">
				{#if whom && last}
					{#if !lastPlanned}
						{whom} had this lesson {when}, but the plan as taught was not recorded.
					{:else if versions[mineAt]?.current}
						{whom} had this lesson {when}, as the plan stands now.
					{:else}
						{whom} had this lesson {when}. The plan has changed since.
					{/if}
				{:else if versions.length > 1}
					This lesson has {versions.length} versions.
				{:else}
					{had.length === 1 ? 'One class has' : `${had.length} classes have`} had this plan.
				{/if}
				{#if away}
					<strong
						>{comparing
							? `Comparing ${label(shown)} with ${label(against)}.`
							: `Showing ${label(shown)}, not the current plan.`}</strong
					>
				{/if}
			</span>
			<span class="more">History</span>
		</summary>
		<div class="body">
			{#if whom && last && !lastPlanned && (last.source || last.deviations?.trim())}
				<p>
					{#if last.source}Recorded as {last.source}.{/if}
					{#if last.deviations?.trim()}<span class="day"
							><span class="lead">On the day</span> {last.deviations}</span
						>{/if}
				</p>
			{/if}
			{#if whom && last?.plan_commit}
				<p class="commit">
					{whom} was taught from commit {#if href}<a {href} target="_blank" rel="noreferrer"
							><code>{last.plan_commit.slice(0, 7)}</code></a
						>{:else}<code>{last.plan_commit.slice(0, 7)}</code>{/if}.
				</p>
			{/if}
			{#if versions.length > 1}
				<div class="row">
					<span class="lead">Versions</span>
					<div class="choices" role="group" aria-label="Versions of this lesson, oldest first">
						{#each versions as v, i (i)}
							<button
								type="button"
								class="quiet"
								aria-pressed={shown === i}
								title={who(v) || 'No class has had this version yet'}
								onclick={() => {
									shown = i;
									if (against === i) against = i > 0 ? i - 1 : i + 1;
								}}>{label(i)}</button
							>
						{/each}
					</div>
				</div>
			{/if}
			{#if had.length}
				<div class="row">
					<span class="lead">{versions.length > 1 ? 'Had this version' : 'Had this plan'}</span>
					<ul class="had">
						{#each had as t, i (i)}
							<li>
								{className(t)}, {t.taught ? formatDate(t.taught) : 'date not recorded'}{t.by
									? `, ${t.by}`
									: ''}
								{#if t.deviations}<span class="day"
										><span class="lead">On the day</span> {t.deviations}</span
									>{/if}
							</li>
						{/each}
					</ul>
				</div>
			{/if}
			{#if versions.length > 1}
				<div class="row">
					<div class="choices" role="group" aria-label="View or compare">
						<button
							type="button"
							class="quiet"
							aria-pressed={!comparing}
							onclick={() => (comparing = false)}>View</button
						>
						<button
							type="button"
							class="quiet"
							aria-pressed={comparing}
							onclick={() => (comparing = true)}>Compare</button
						>
					</div>
					{#if comparing}
						<label class="with">
							<span>with</span>
							<select bind:value={against}>
								{#each versions as v, i (i)}
									{#if i !== shown}<option value={i}>{versionLabel(v, names)}</option>{/if}
								{/each}
							</select>
						</label>
					{/if}
					{#if away}
						<button
							type="button"
							class="quiet back"
							onclick={() => {
								shown = versions.findIndex((v) => v.current);
								comparing = false;
							}}>Back to the current plan</button
						>
					{/if}
				</div>
			{/if}
		</div>
	</details>
{/if}

<style>
	.history {
		margin: 0 0 24px;
		border-bottom: 1px solid var(--rule);
		font-size: 14px;
		color: var(--ink-2);
	}

	.history.away {
		background: var(--note-soft);
		color: var(--note-deep);
		border-bottom-color: transparent;
	}

	summary {
		display: flex;
		align-items: baseline;
		gap: 8px;
		padding: 8px 0;
		cursor: pointer;
		list-style: none;
	}

	.away summary,
	.away .body {
		padding-left: 12px;
		padding-right: 12px;
	}

	summary::-webkit-details-marker {
		display: none;
	}

	.chev {
		display: inline-flex;
		align-self: center;
		transition: transform 160ms var(--ease);
	}

	.history[open] .chev {
		transform: rotate(90deg);
	}

	.line {
		flex: 1;
		min-width: 0;
	}

	.more {
		font-size: 13px;
		font-weight: 700;
	}

	summary:hover .more {
		text-decoration: underline;
	}

	.body {
		padding: 0 0 12px 22px;
	}

	.body p {
		margin: 0 0 8px;
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 12px;
		margin-top: 10px;
	}

	.lead {
		font-size: 13px;
		font-weight: 700;
	}

	.choices {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	.choices button,
	.back {
		color: inherit;
		border: 1px solid transparent;
		margin-top: 0;
	}

	.choices button[aria-pressed='true'] {
		background: var(--paper);
		border-color: currentColor;
		color: var(--ink);
	}

	.with {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		font-weight: 700;
	}

	.with select {
		max-width: 100%;
	}

	.had {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 4px;
	}

	.day {
		display: block;
		margin-top: 2px;
	}

	.day .lead {
		margin-right: 6px;
	}

	.commit code {
		font-size: 12px;
	}

	@media (prefers-reduced-motion: reduce) {
		.chev {
			transition: none;
		}
	}
</style>
