<script lang="ts">
	// A unit's syllabus coverage (coverage.ts): each dot point in the unit's
	// registry, as the lesson list plans it and, for a class, as its delivery
	// records say it was taught. Reads that one class's records for this unit.
	import { SvelteSet } from 'svelte/reactivity';
	import { page } from '$app/state';
	import Failure from '#lib/components/Failure.svelte';
	import PageHead from '#lib/components/PageHead.svelte';
	import {
		byPhase,
		coverage,
		gather,
		lineStatus,
		lessonSources,
		needsLook,
		reachWords,
		reached,
		rowLines,
		shownFlag,
		taughtSources,
		type CoverageRow,
		type Flag
	} from '#lib/domain/coverage.ts';
	import { subjectOf } from '#lib/domain/layout.ts';
	import { entryTakes, lessonRefs, offeringEntries } from '#lib/domain/offerings.ts';
	import { join } from '#lib/domain/paths.ts';
	import { tasksForOffering } from '#lib/domain/tasks.ts';
	import type { Lesson, Offering } from '#lib/domain/types.ts';
	import { className, houseMap, houseOf, titleCase } from '#lib/house.ts';
	import { links } from '#lib/links.ts';
	import { session } from '#lib/session.svelte.ts';

	const u = $derived(page.url.searchParams.get('u') ?? '');
	const o = $derived(page.url.searchParams.get('o'));
	const t = $derived(page.url.searchParams.get('t'));

	/** Only the rows worth a second look. */
	let onlyFlagged = $state(false);
	/** The ids of the rows that are open. */
	const opened = new SvelteSet<string>();

	const load = $derived.by(() => {
		const data = session.data;
		void session.revision;
		if (!data || !u) return null;
		return (async () => {
			const [unit, offerings] = await Promise.all([data.unit(u), data.offerings()]);
			const offering = o ? (offerings.find(([path]) => path === o)?.[1] ?? null) : null;
			if (o && !offering) throw new Error(`${o} is not a class in these files.`);
			const refs = lessonRefs(u, unit, offering, t);
			const [held, calendars] = o
				? await Promise.all([data.unitDeliveries(o, u), data.calendars()])
				: [[], new Map()];

			// Every listed plan, and any plan taught in place of one, as it stands.
			const plans = new Map<string, Lesson | null>(
				await Promise.all(
					[...new Set([...refs, ...held.map((h) => h.ref)])].map(
						async (ref) =>
							[
								ref,
								await data
									.lesson(join(u, ref))
									.then((l) => l.doc)
									.catch(() => null)
							] as const
					)
				)
			);

			const registry = unit.syllabus_registry ?? [];
			const tasks = tasksForOffering(unit, offering?.id ?? null, offering ? t : null);
			const planned = gather(
				registry,
				lessonSources(refs.map((ref) => ({ ref, lesson: plans.get(ref) ?? null }))),
				tasks
			);
			// A term picks out one cohort only where the class takes the unit in more
			// than one; otherwise a unit run on past its term would lose lessons.
			const split =
				!!offering && (offering.units ?? []).filter((e) => entryTakes(offering, e, u)).length > 1;
			const taught = offering
				? gather(
						registry,
						taughtSources(
							held.map((h) => ({ ...h, current: plans.get(h.ref) ?? null })),
							split ? t : null,
							[...calendars.values()].map((c) => c.doc)
						),
						tasks
					)
				: null;
			return {
				unit,
				offering,
				refs,
				revision: 'revises' in unit,
				report: coverage(registry, planned, taught),
				taughtRefs: taught?.refs ?? new Set<string>(),
				entries: offeringEntries(u, offerings),
				houses: houseMap(offerings)
			};
		})();
	});

	const LABELS: Record<Flag, string> = {
		UNCOVERED: 'Not reached',
		PARTIAL: 'Only in part',
		ONCE: 'Once',
		SHALLOW: 'Never developed',
		ELSEWHERE: 'Another unit',
		OK: 'Developed'
	};

	const HINTS: Record<Flag, string> = {
		UNCOVERED: 'No lesson links to this dot point.',
		PARTIAL: 'Every lesson link is partial; none is full.',
		ONCE: 'One lesson reaches this in full, and nothing comes back to it.',
		SHALLOW: 'Lessons return to it, and none develops or consolidates it.',
		ELSEWHERE: 'Not taught here; the registry says another unit owns it.',
		OK: 'Reached in full, and developed or consolidated in some lesson.'
	};

	const COME_HINT = 'A planned lesson reaches it, and hasn’t been taught yet.';

	/** The legend's order: healthy first, then each kind of shortfall. */
	const KEY_ORDER: Flag[] = ['OK', 'ONCE', 'SHALLOW', 'PARTIAL', 'UNCOVERED', 'ELSEWHERE'];

	/** `lessons/03_hats.json` -> `03`; null for a name with no number. */
	const numberOf = (ref: string) => ref.split('/').pop()?.match(/^\d+/)?.[0] ?? null;

	/** "1 lesson", "3 lessons". */
	const lessons = (n: number) => `${n} lesson${n === 1 ? '' : 's'}`;

	/** A class's tab: its name, its year where another tab shares the name, its term. */
	function tabLabel(
		entry: { offering: Offering; term: string | null },
		all: { offering: Offering }[]
	): string {
		const name = className(entry.offering);
		const shared = all.filter((e) => className(e.offering) === name).length > 1;
		return [name, shared ? String(entry.offering.year) : null, entry.term]
			.filter(Boolean)
			.join(' · ');
	}

	function openAll(rows: CoverageRow[]) {
		for (const row of rows) opened.add(row.entry.id);
	}
</script>

{#snippet cell(label: string, flag: Flag, count: number)}
	<span class="cell {flag}">
		<span class="lab">{label}<span class="sr-only">:</span></span>
		<i class="k {flag}" aria-hidden="true"></i>{LABELS[flag]}
		{#if count}<span class="n"><span class="sr-only">, </span>{count}</span>{/if}
	</span>
{/snippet}

{#if !u}
	<PageHead title="No unit given" />
	<div class="page"><div class="msg warn"><div>Open a unit first.</div></div></div>
{:else if load}
	{#await load}
		<PageHead title={null} />
		<div class="page"><div class="loading"><span></span><span></span><span></span></div></div>
	{:then { unit, offering, refs, revision, report, taughtRefs, entries, houses }}
		{@const total = report.rows.length}
		{@const developed = report.rows.filter((r) => shownFlag(r) === 'OK').length}
		{@const toCome = report.rows.filter((r) => r.toCome).length}
		{@const flagged = report.rows.filter(needsLook)}
		{@const shown = onlyFlagged ? flagged : report.rows}
		{@const keys = KEY_ORDER.filter(
			(f) => f !== 'ELSEWHERE' || report.rows.some((r) => r.plannedFlag === f || r.taughtFlag === f)
		)}
		<PageHead
			crumbs={[
				{ href: links.home(), label: offering ? className(offering) : titleCase(subjectOf(u)) },
				{ href: links.unit(u, o, t), label: unit.unit_title }
			]}
			title="Syllabus coverage"
			lede={offering
				? `How ${className(offering)}’s lessons reach each dot point: as planned, and as taught. Flags are prompts for a second look, not verdicts.`
				: 'How every lesson in the unit reaches each dot point. Flags are prompts for a second look, not verdicts.'}
		>
			{#snippet meta()}
				<span>{total} dot points</span>
				<span>{developed} developed{offering ? ' as taught' : ''}</span>
				{#if offering}<span>{toCome} still to come</span>{/if}
				<span>{flagged.length} worth a second look</span>
				<span>{lessons(refs.length)}</span>
			{/snippet}
			<nav class="views" aria-label="Whose lessons">
				<a href={links.coverage(u)} aria-current={!o ? 'page' : undefined} data-house="none">
					Every plan
				</a>
				{#each entries as entry, i (i)}
					<a
						href={links.coverage(u, entry.path, entry.term)}
						aria-current={o === entry.path && t === entry.term ? 'page' : undefined}
						data-house={houseOf(entry.path, houses)}
					>
						<span class="sw" aria-hidden="true"></span>
						{tabLabel(entry, entries)}
					</a>
				{/each}
			</nav>
		</PageHead>

		<div class="page">
			{#if revision}
				<div class="msg note">
					<div>
						This is a revision unit. Its coverage is read against the units it revises, which this
						page doesn’t show yet. The data repo’s <code>coverage_report.py</code> reports it.
					</div>
				</div>
			{:else if total === 0}
				<div class="msg note">
					<div>
						The unit has no dot points yet. <a href={links.unitEdit(u, o, t)}>Add them</a> to see coverage.
					</div>
				</div>
			{:else}
				<div class="wrap">
					{#if report.dangling.length}
						<div class="msg warn">
							<div>
								<strong>Links to dot points the unit doesn’t hold.</strong>
								<ul class="dangling">
									{#each report.dangling as d (d)}<li><code>{d}</code></li>{/each}
								</ul>
							</div>
						</div>
					{/if}

					<div class="tools">
						<label class="check">
							<input type="checkbox" bind:checked={onlyFlagged} />
							Only rows worth a second look ({flagged.length})
						</label>
						<button type="button" class="btn" onclick={() => openAll(shown)}>Open all</button>
						<button type="button" class="btn" onclick={() => opened.clear()}>Close all</button>
					</div>

					<details class="key">
						<summary>
							<span class="key-title">Key</span>
							<ul class="legend">
								{#each keys as f (f)}
									<li><i class="k {f}" aria-hidden="true"></i>{LABELS[f]}</li>
								{/each}
								{#if offering}<li><i class="k come" aria-hidden="true"></i>Still to come</li>{/if}
							</ul>
						</summary>
						<dl class="means">
							{#each keys as f (f)}
								<dt><i class="k {f}" aria-hidden="true"></i>{LABELS[f]}</dt>
								<dd>{HINTS[f]}</dd>
							{/each}
							{#if offering}
								<dt><i class="k come" aria-hidden="true"></i>Still to come</dt>
								<dd>{COME_HINT}</dd>
							{/if}
						</dl>
						<p class="sub">
							Only lessons count. A task assesses a point, and doesn’t teach it, so each row lists
							its tasks apart. The count after a flag is how many lessons link the point.
						</p>
					</details>

					{#if onlyFlagged && flagged.length === 0}
						<div class="msg ok"><div>No row needs a second look.</div></div>
					{/if}

					{#each byPhase(report.rows) as group (group.phase)}
						{@const rows = onlyFlagged ? group.rows.filter(needsLook) : group.rows}
						{@const reachedN = group.rows.filter(reached).length}
						{@const notReached = group.rows.filter(
							(r) => shownFlag(r) === 'UNCOVERED' && !r.toCome
						).length}
						{@const look = group.rows.filter(needsLook).length}
						{#if rows.length}
							<section class="phase" aria-labelledby="ph-{group.phase}">
								<div class="phase-top">
									<h2 id="ph-{group.phase}">{group.phase || 'No phase'}</h2>
									<p class="count">
										{reachedN} of {group.rows.length} reached{offering
											? ' so far'
											: ''}{#if notReached}<span class="warn">
												· {notReached} not reached</span
											>{/if}{#if look}<span> · {look} worth a second look</span>{/if}
									</p>
								</div>
								<div class="cols" class:solo={!offering} aria-hidden="true">
									<span></span><span>Dot point</span><span>Planned</span>
									{#if offering}<span>Taught</span>{/if}
								</div>
								<ul class="rows">
									{#each rows as row (row.entry.id)}
										{@const id = row.entry.id}
										<li>
											<details
												open={opened.has(id)}
												ontoggle={(e) =>
													e.currentTarget.open ? opened.add(id) : opened.delete(id)}
											>
												<summary class:solo={!offering}>
													<span class="id">{id}</span>
													<span class="what">
														<span class="text">{row.entry.text}</span>
														{#if row.tasks.length}
															<span class="assessed">
																Assessed in {[...new Set(row.tasks.map((r) => r.title))]
																	.map((s) => s.replace(/ \(assessment\)$/, ''))
																	.join(', ')}
															</span>
														{/if}
													</span>
													{@render cell('Planned', row.plannedFlag, row.planned.length)}
													{#if row.taughtFlag && row.taught}
														{#if row.toCome}
															<span class="cell come">
																<span class="lab">Taught<span class="sr-only">:</span></span>
																<i class="k come" aria-hidden="true"></i>Still to come
															</span>
														{:else}
															{@render cell('Taught', row.taughtFlag, row.taught.length)}
														{/if}
													{/if}
													<span class="chev" aria-hidden="true"></span>
												</summary>
												<div class="behind">
													<p class="mean">
														<strong>Planned: {LABELS[row.plannedFlag]}.</strong>
														{HINTS[row.plannedFlag]}
													</p>
													{#if row.taughtFlag}
														<p class="mean">
															{#if row.toCome}
																<strong>Taught: Still to come.</strong> {COME_HINT}
															{:else}
																<strong>Taught: {LABELS[row.taughtFlag]}.</strong>
																{HINTS[row.taughtFlag]}
															{/if}
														</p>
													{/if}
													{#if row.tasks.length && row.planned.length === 0}
														<p class="mean warn">
															A task assesses this point, and no lesson teaches it.
														</p>
													{:else if row.tasks.length && row.taught?.length === 0}
														<p class="mean warn">
															A task assesses this point, and no lesson has taught it yet.
														</p>
													{/if}
													{#if row.entry.owned_by}
														<p class="sub">Owned by <code>{row.entry.owned_by}</code>.</p>
													{/if}
													{#each rowLines(row, taughtRefs) as line, i (i)}
														{@const n = line.reach.ref ? numberOf(line.reach.ref) : null}
														{@const status = lineStatus(line, !!offering)}
														<div class="line">
															<span class="ln">{n ?? ''}</span>
															<div class="lt">
																{#if line.reach.ref}
																	<a href={links.lesson(u, line.reach.ref, o, t)}
																		>{line.reach.title}</a
																	>
																{:else}
																	<span>{line.reach.title}</span>
																{/if}
																{#if status}
																	<span
																		class="st"
																		class:warn={!line.reach.planKept || line.without}
																	>
																		{status}
																	</span>
																{/if}
																<span class="cov">{reachWords(line.reach.link)}</span>
															</div>
														</div>
													{:else}
														<p class="sub">No lesson or task links to this dot point.</p>
													{/each}
												</div>
											</details>
										</li>
									{/each}
								</ul>
							</section>
						{/if}
					{/each}
				</div>
			{/if}
		</div>
	{:catch error}
		<PageHead title="Could not show this unit’s coverage" />
		<div class="page"><Failure {error} /></div>
	{/await}
{/if}

<style>
	.views {
		display: flex;
		gap: 2px;
		overflow-x: auto;
		padding: 0 clamp(16px, 4vw, 48px);
		max-width: var(--page-max);
		margin-inline: auto;
		scrollbar-width: none;
	}

	.views a {
		--sw: var(--house);
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 10px 14px 12px;
		font-size: 14px;
		font-weight: 650;
		white-space: nowrap;
		text-decoration: none;
		color: inherit;
		background: color-mix(in oklab, currentColor 10%, transparent);
	}

	.views a:hover {
		background: color-mix(in oklab, currentColor 18%, transparent);
	}

	.views a[aria-current='page'] {
		background: var(--chalk);
		color: var(--ink);
	}

	.sw {
		width: 10px;
		height: 10px;
		background: var(--sw);
		box-shadow: 0 0 0 1px color-mix(in oklab, #fff 50%, transparent);
	}

	/* The table stops where a dot point's text would grow past an easy line,
	   so the flags sit near the words they judge. */
	.wrap {
		max-width: 1040px;
	}

	.msg {
		margin-bottom: 24px;
	}

	.dangling {
		margin: 6px 0 0;
		padding-left: 18px;
	}

	.tools {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 12px;
		margin-bottom: 14px;
	}

	.check {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		margin-right: auto;
		font-size: 14px;
		font-weight: 650;
		cursor: pointer;
	}

	.key {
		margin-bottom: 32px;
		border-top: 1px solid var(--rule);
		border-bottom: 1px solid var(--rule);
	}

	.key > summary {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 6px 18px;
		padding: 10px 4px;
		cursor: pointer;
		list-style: none;
	}

	.key > summary::-webkit-details-marker {
		display: none;
	}

	.key-title {
		font-size: 13px;
		font-weight: 700;
	}

	.key-title::after {
		content: ' ▸';
		color: var(--muted);
	}

	.key[open] .key-title::after {
		content: ' ▾';
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 18px;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 12px;
		color: var(--ink-2);
	}

	.legend li {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}

	.means {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		gap: 6px 16px;
		margin: 4px 4px 10px;
		font-size: 14px;
	}

	.means dt {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		font-weight: 650;
	}

	.means dd {
		margin: 0;
		color: var(--ink-2);
	}

	.key > .sub {
		margin: 0 4px 12px;
	}

	/* Keys: solid house for developed, the dashed stretch outline for a thin
	   reach, a note square for partial, a warn diamond for nothing at all.
	   House deep, so a light house still clears 3:1 on paper. */
	.k {
		display: inline-block;
		flex: none;
		width: 10px;
		height: 10px;
	}

	.k.OK {
		background: var(--house-deep);
	}

	.k.ONCE,
	.k.SHALLOW {
		outline: 2px solid var(--house-deep);
		outline-offset: -2px;
	}

	.k.SHALLOW {
		outline-style: dashed;
	}

	.k.PARTIAL {
		background: linear-gradient(135deg, var(--note-deep) 50%, transparent 50%);
		outline: 1px solid var(--note-deep);
		outline-offset: -1px;
	}

	.k.UNCOVERED {
		width: 9px;
		height: 9px;
		background: var(--warn-deep);
		transform: rotate(45deg);
	}

	.k.ELSEWHERE {
		background: var(--rule-strong);
	}

	.k.come {
		outline: 2px dashed var(--house-deep);
		outline-offset: -2px;
		background: var(--paper);
	}

	.phase {
		margin-bottom: 36px;
	}

	.phase-top {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 4px 12px;
		margin-bottom: 14px;
	}

	.phase-top h2 {
		margin: 0;
	}

	.count {
		margin: 0;
		font-size: 13px;
		font-weight: 600;
		color: var(--muted);
	}

	.count .warn {
		color: var(--warn-deep);
	}

	.cols,
	.rows summary {
		display: grid;
		grid-template-columns: 58px minmax(0, 1fr) 150px 150px 16px;
		gap: 4px 16px;
		align-items: baseline;
	}

	.cols.solo,
	.rows summary.solo {
		grid-template-columns: 58px minmax(0, 1fr) 150px 16px;
	}

	.cols {
		padding: 0 4px 6px;
		font-size: 12px;
		font-weight: 700;
		color: var(--muted);
		border-bottom: 2px solid var(--ink);
	}

	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.rows > li {
		border-bottom: 1px solid var(--rule);
	}

	.rows summary {
		padding: 12px 4px;
		cursor: pointer;
		list-style: none;
		transition: background-color 160ms var(--ease);
	}

	.rows summary::-webkit-details-marker {
		display: none;
	}

	.rows summary:hover {
		background: color-mix(in oklab, var(--house-deep) 12%, var(--paper));
	}

	/* Inset, so the ring never runs into the ink rule over the first row. */
	.rows summary:focus-visible {
		outline: 2px solid var(--house-deep);
		outline-offset: -2px;
	}

	.id {
		font-weight: 800;
		font-size: 13px;
		color: var(--house-deep);
		white-space: nowrap;
	}

	.what {
		display: grid;
		gap: 2px;
	}

	.text {
		font-size: 15px;
	}

	.assessed {
		font-size: 12px;
		font-weight: 600;
		color: var(--muted);
	}

	.cell {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		font-size: 14px;
		font-weight: 650;
	}

	/* A shortfall reads in its own colour, so it stands out from the rest. */
	.cell.UNCOVERED {
		color: var(--warn-deep);
	}

	.cell.PARTIAL,
	.cell.SHALLOW {
		color: var(--note-deep);
	}

	.cell.ELSEWHERE {
		color: var(--muted);
	}

	.cell.come {
		color: var(--house-deep);
	}

	/* "Planned" and "Taught": read aloud on wide screens, shown when stacked. */
	.lab {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.n {
		font-size: 12px;
		font-weight: 600;
		color: var(--muted);
	}

	.chev {
		align-self: center;
		justify-self: end;
		color: var(--muted);
	}

	.chev::before {
		content: '';
		display: block;
		width: 7px;
		height: 7px;
		border-right: 2px solid currentColor;
		border-bottom: 2px solid currentColor;
		transform: translateY(-2px) rotate(45deg);
		transition: transform 160ms var(--ease);
	}

	details[open] > summary .chev::before {
		transform: translateY(2px) rotate(-135deg);
	}

	.behind {
		padding: 2px 4px 16px calc(58px + 16px + 4px);
		display: grid;
		gap: 8px;
	}

	.mean {
		margin: 0;
		font-size: 14px;
		color: var(--ink-2);
	}

	.mean strong {
		color: var(--ink);
	}

	.mean.warn {
		color: var(--warn-deep);
		font-weight: 650;
	}

	.line {
		display: grid;
		grid-template-columns: 32px minmax(0, 1fr);
		gap: 12px;
		align-items: baseline;
		font-size: 14px;
	}

	.ln {
		font-size: 24px;
		font-weight: 900;
		font-stretch: 70%;
		line-height: 0.85;
		color: var(--house-deep);
		font-variant-numeric: tabular-nums;
	}

	.lt {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 2px 12px;
	}

	.cov {
		font-size: 12px;
		color: var(--muted);
		white-space: nowrap;
	}

	.st {
		font-size: 12px;
		font-weight: 650;
		color: var(--ink-2);
		white-space: nowrap;
	}

	.st.warn {
		color: var(--warn-deep);
	}

	.sub {
		margin: 0;
		font-size: 13px;
		color: var(--muted);
	}

	@media (max-width: 720px) {
		.cols {
			display: none;
		}

		.rows summary,
		.rows summary.solo {
			grid-template-columns: 58px minmax(0, 1fr) 16px;
		}

		.cell {
			grid-column: 2;
		}

		.chev {
			grid-column: 3;
			grid-row: 1;
		}

		.lab {
			position: static;
			width: auto;
			height: auto;
			overflow: visible;
			clip-path: none;
			min-width: 56px;
			font-size: 12px;
			font-weight: 600;
			color: var(--muted);
		}

		.means {
			grid-template-columns: minmax(0, 1fr);
		}

		.means dd {
			margin-bottom: 6px;
		}
	}
</style>
