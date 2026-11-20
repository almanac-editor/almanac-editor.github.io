<script lang="ts">
	// One class's assessment task, read from its spec and notification. The
	// notification reads top to bottom as students get it, its parts where it
	// puts them. The header carries the details; a side column keeps the
	// contents and the syllabus check in reach. Teacher notes stay folded at
	// the foot.
	import { page } from '$app/state';
	import Failure from '#lib/components/Failure.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Markdown, { type TopicMark } from '#lib/components/Markdown.svelte';
	import PageHead from '#lib/components/PageHead.svelte';
	import {
		assessmentPath,
		groupTopics,
		specProblems,
		unitDir,
		type Registries
	} from '#lib/domain/assessments.ts';
	import { leadOf, readNotification } from '#lib/domain/notification.ts';
	import type { Unit } from '#lib/domain/types.ts';
	import { className, humanise } from '#lib/house.ts';
	import { links } from '#lib/links.ts';
	import { session } from '#lib/session.svelte.ts';

	const o = $derived(page.url.searchParams.get('o') ?? '');
	const a = $derived(page.url.searchParams.get('a') ?? '');

	const load = $derived.by(() => {
		const data = session.data;
		if (!data || !o || !a) return null;
		return (async () => {
			const offerings = await data.offerings();
			const offering = offerings.find(([path]) => path === o)?.[1];
			if (!offering) throw new Error(`${o} is not a class in ${session.label}.`);
			const path = assessmentPath(o, a);
			if (!(await data.store.has(path))) {
				throw new Error(`${className(offering)} has no assessment at ${path}.`);
			}
			const spec = (await data.assessment(o, a)).doc;
			const units = new Map<string, Unit | null>(
				await Promise.all(
					spec.units.map(
						async (unit) =>
							[unit, await data.unit(unitDir(offering, unit)).catch(() => null)] as const
					)
				)
			);
			const registries: Registries = new Map(
				[...units].map(([unit, doc]) => [unit, doc ? (doc.syllabus_registry ?? []) : null])
			);
			const text = await data.text(spec.notification);
			return {
				offering,
				spec,
				path,
				units,
				registries,
				notification: text === null ? null : readNotification(text),
				problems: specProblems(spec, offering, registries, text)
			};
		})();
	});

	let teacherOpen = $state(false);
	let here = $state<string | null>(null);

	// A different task starts closed.
	$effect(() => {
		void o;
		void a;
		teacherOpen = false;
	});

	// The contents list starts open where the side column has room for it.
	let wide = $state(true);
	let tocOpen = $state(true);
	$effect(() => {
		const query = matchMedia('(min-width: 861px)');
		const sync = () => {
			wide = query.matches;
			tocOpen = query.matches;
		};
		sync();
		query.addEventListener('change', sync);
		return () => query.removeEventListener('change', sync);
	});

	/** Marks the contents entry for the section being read. */
	function spy(node: HTMLElement) {
		const seen: Record<string, boolean> = {};
		const observer = new IntersectionObserver(
			(entries) => {
				for (const e of entries) seen[e.target.id] = e.isIntersecting;
				const sections = [...node.querySelectorAll<HTMLElement>('[data-toc]')];
				here = sections.find((s) => seen[s.id])?.id ?? here;
			},
			{ rootMargin: '0px 0px -55% 0px' }
		);
		for (const s of node.querySelectorAll('[data-toc]')) observer.observe(s);
		return () => observer.disconnect();
	}

	const slug = (heading: string) =>
		's-' +
		heading
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');

	const github = $derived(
		session.source === 'github'
			? (path: string) =>
					`https://github.com/${session.target.owner}/${session.target.repo}/blob/${encodeURIComponent(session.target.branch)}/${path.split('/').map(encodeURIComponent).join('/')}`
			: null
	);
</script>

{#if !o || !a}
	<PageHead title="No assessment given" />
	<div class="page">
		<div class="msg warn"><div>Open an assessment from a class’s unit page.</div></div>
	</div>
{:else if load}
	{#await load}
		<PageHead title={null} />
		<div class="page"><div class="loading"><span></span><span></span><span></span></div></div>
	{:then { offering, spec, path, units, registries, notification, problems }}
		{@const titleOf = (unit: string) =>
			units.get(unit)?.unit_title ?? humanise(unit.split('/').pop() ?? unit)}
		{@const entryOf = (unit: string) => offering.units.find((e) => e.unit === unit)}
		{@const first = spec.units.find((u) => units.get(u))}
		{@const topicMark = (text: string): TopicMark | undefined => {
			const t = spec.topics.find((x) => x.text === text);
			if (!t) return undefined;
			const known = new Set((registries.get(t.unit) ?? []).map((e) => e.id));
			return {
				ids: t.ids.map((id) => ({ id, known: !registries.get(t.unit) || known.has(id) })),
				note: t.note
			};
		}}
		{@const isTopicsHeading = (heading: string) => /^assessable topics$/i.test(heading)}
		{@const topicsSection = notification?.sections.find((s) => isTopicsHeading(s.heading))}
		{@const teacherTopics = notification?.teacher.find((s) => isTopicsHeading(s.heading))}
		{@const toTopics = () => {
			if (teacherTopics) teacherOpen = true;
		}}
		{@const sectionId = (heading: string) =>
			topicsSection?.heading === heading ? 'topics' : slug(heading)}
		{@const contents = [
			...(notification?.sections ?? []).map((s) => ({
				id: sectionId(s.heading),
				label: s.heading
			})),
			...(topicsSection || teacherTopics ? [] : [{ id: 'topics', label: 'Assessable topics' }]),
			...(notification?.teacher.length ? [{ id: 'teacher-notes', label: 'Teacher notes' }] : [])
		]}
		{@const current = here ?? contents[0]?.id}
		<!-- Beside the topics only when the syllabus check finds something to fix. -->
		{#snippet topicsStatus()}
			{#if problems.length}
				<span class="status bad">
					<i aria-hidden="true"></i>
					{problems.length} to fix before the data repo’s checks pass
				</span>
			{/if}
		{/snippet}
		{#snippet topicsProblems()}
			{#if problems.length}
				<ul class="problems">
					{#each problems as problem, i (i)}<li>{problem}</li>{/each}
				</ul>
			{/if}
		{/snippet}
		<PageHead
			crumbs={[
				{ href: links.home(), label: className(offering) },
				...(first
					? [
							{
								href: links.unit(unitDir(offering, first), o, entryOf(first)?.term),
								label: titleOf(first)
							}
						]
					: [])
			]}
			title={notification?.title ?? spec.title}
			lede={notification?.subject}
		>
			{#snippet actions()}
				{#if github}
					<a class="btn" href={github(spec.notification)} target="_blank" rel="noopener noreferrer">
						<Icon name="link" size={16} /> Notification on GitHub
					</a>
				{/if}
			{/snippet}
			{#snippet meta()}
				<span class="examines">
					Examines
					{#each spec.units as unit, i (unit)}
						{#if i > 0}<span aria-hidden="true">·</span>{/if}
						{#if units.get(unit)}
							<a href={links.unit(unitDir(offering, unit), o, entryOf(unit)?.term)}
								>{titleOf(unit)}</a
							>
						{:else}
							<span>{titleOf(unit)}</span>
						{/if}
					{/each}
				</span>
				<a class="check" class:bad={problems.length} href="#topics" onclick={toTopics}>
					<i aria-hidden="true"></i>
					{problems.length
						? `${problems.length} syllabus ${problems.length === 1 ? 'problem' : 'problems'}`
						: 'Topics match the syllabus'}
				</a>
			{/snippet}
			{#if notification?.details.length}
				<dl class="facts">
					{#each notification.details as d (d.label)}
						{@const { lead, rest } = leadOf(d.text)}
						<div class:wide={lead.length > 8}>
							<dt>{d.label}</dt>
							<dd>
								<span class="lead">{lead}</span>
								{#if rest}<span class="rest">{rest}</span>{/if}
							</dd>
						</div>
					{/each}
				</dl>
			{/if}
		</PageHead>

		<div class="page doc-page">
			<aside class="side" aria-label="Contents and syllabus check">
				<details class="side-block toc" bind:open={tocOpen}>
					<summary class:fixed={wide}>
						On this page
						{#if !wide}<Icon name="down" size={16} />{/if}
					</summary>
					<ul>
						{#each contents as c (c.id)}
							<li class:here={current === c.id}>
								<a
									href="#{c.id}"
									aria-current={current === c.id ? 'location' : undefined}
									onclick={() => {
										if (c.id === 'teacher-notes') teacherOpen = true;
									}}>{c.label}</a
								>
							</li>
						{/each}
					</ul>
				</details>

				<section class="side-block" aria-labelledby="side-check">
					<h2 id="side-check">Syllabus check</h2>
					<a class="status" class:bad={problems.length} href="#topics" onclick={toTopics}>
						<i aria-hidden="true"></i>
						<span>
							<b>{problems.length ? `${problems.length} to fix` : 'Matches'}</b>
							· {spec.units.length}
							{spec.units.length === 1 ? 'unit' : 'units'}, {spec.topics.length}
							{spec.topics.length === 1 ? 'topic' : 'topics'}
						</span>
					</a>
				</section>
			</aside>

			<article class="doc" {@attach spy}>
				{#if notification === null}
					<div class="msg warn">
						<div>
							The notification <code>{spec.notification}</code> is not
							{session.source === 'folder'
								? 'in the folders Almanac reads (subjects/, offerings/ and schemas/).'
								: 'in the repo.'} The task’s topic lines are shown from its spec.
						</div>
					</div>
				{/if}

				{#if notification}
					{#if notification.preface.length}
						<div class="doc-section"><Markdown blocks={notification.preface} /></div>
					{/if}
					{#each notification.sections as section (section.heading)}
						{@const isTopics = section === topicsSection}
						<section class="doc-section" id={sectionId(section.heading)} data-toc>
							<div class="doc-h">
								<h2>{section.heading}</h2>
								{#if isTopics}{@render topicsStatus()}{/if}
							</div>
							{#if isTopics}{@render topicsProblems()}{/if}
							<Markdown blocks={section.blocks} topic={isTopics ? topicMark : undefined} />
						</section>
					{/each}
				{/if}

				{#if !topicsSection && !teacherTopics}
					<section class="doc-section" id="topics" data-toc>
						<div class="doc-h">
							<h2>Assessable topics</h2>
							{@render topicsStatus()}
						</div>
						{@render topicsProblems()}
						{#each groupTopics(spec) as group (group.unit)}
							{#each group.phases as phase, p (p)}
								<h3 class="phase">{titleOf(group.unit)}{phase.phase ? `: ${phase.phase}` : ''}</h3>
								<ul class="spec-topics">
									{#each phase.topics as t, i (i)}
										{@const mark = topicMark(t.text)}
										<li>
											<span>{t.text}</span>
											<span class="ids">
												{#each mark?.ids ?? [] as { id, known } (id)}
													<span class:unknown={!known}>{id}</span>
												{/each}
											</span>
										</li>
									{/each}
								</ul>
							{/each}
						{/each}
					</section>
				{/if}

				{#if notification?.teacher.length}
					<details class="teacher" id="teacher-notes" data-toc bind:open={teacherOpen}>
						<summary>
							<span class="chev"><Icon name="down" size={18} /></span>
							Teacher notes
							<span>{notification.teacher.map((s) => s.heading).join(' · ')}</span>
						</summary>
						{#each notification.teacher as section (section.heading)}
							{@const isTopics = section === teacherTopics}
							<section class="doc-section" id={isTopics ? 'topics' : undefined}>
								<div class="doc-h">
									<h2>{section.heading}</h2>
									{#if isTopics}{@render topicsStatus()}{/if}
								</div>
								{#if isTopics}{@render topicsProblems()}{/if}
								<Markdown blocks={section.blocks} topic={isTopics ? topicMark : undefined} />
							</section>
						{/each}
					</details>
				{/if}

				<p class="source">
					Read from <code>{path}</code>
					{#if github}(<a href={github(path)} target="_blank" rel="noopener noreferrer">GitHub</a
						>){/if}
					and <code>{spec.notification}</code>.
				</p>
			</article>
		</div>
	{:catch error}
		<PageHead title="Could not open this assessment" />
		<div class="page"><Failure {error} /></div>
	{/await}
{/if}

<style>
	/* Header: the details as figures. */
	.facts {
		display: flex;
		flex-wrap: wrap;
		gap: 0;
		max-width: var(--page-max);
		margin: 0 auto;
		padding: 0 clamp(16px, 4vw, 48px) 22px;
	}

	.facts > div {
		flex: 0 1 auto;
		min-width: 120px;
		padding: 12px 28px 2px 0;
		margin-right: 28px;
		border-top: 2px solid color-mix(in oklab, var(--house-on) 55%, transparent);
	}

	.facts > div.wide {
		flex: 1 1 260px;
		max-width: 420px;
	}

	.facts dt {
		font-size: 12px;
		font-weight: 650;
		opacity: 0.85;
	}

	.facts dd {
		margin: 6px 0 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.facts .lead {
		font-size: 40px;
		font-weight: 900;
		font-stretch: 70%;
		line-height: 0.9;
		letter-spacing: -0.02em;
		font-variant-numeric: tabular-nums;
	}

	.facts .wide .lead {
		font-size: 22px;
		font-weight: 800;
		font-stretch: 80%;
		line-height: 1.05;
		letter-spacing: -0.01em;
	}

	.facts .rest {
		font-size: 13px;
		line-height: 1.35;
		opacity: 0.88;
	}

	.examines {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 4px 8px;
		opacity: 0.92;
	}

	.check {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		text-decoration: none;
	}

	.check:hover {
		text-decoration: underline;
	}

	.check i,
	.status i {
		flex: none;
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: currentColor;
	}

	.check.bad i,
	.status.bad i {
		border-radius: 0;
		transform: rotate(45deg);
	}

	/* The document beside its side column. */
	.doc-page {
		display: grid;
		grid-template-columns: minmax(0, 1fr) var(--side, 290px);
		grid-template-areas: 'doc side';
		gap: 0 48px;
		align-items: start;
	}

	.doc {
		grid-area: doc;
		min-width: 0;
	}

	.side {
		grid-area: side;
		position: sticky;
		top: 24px;
		max-height: calc(100vh - 48px);
		overflow-y: auto;
		padding-top: 10px;
	}

	.side-block {
		padding-top: 10px;
		border-top: 2px solid var(--ink);
	}

	.side-block + .side-block {
		margin-top: 26px;
	}

	.side-block h2,
	.toc summary {
		margin: 0 0 10px;
		font-size: 13px;
		font-weight: 800;
	}

	.toc summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		list-style: none;
		cursor: pointer;
	}

	.toc summary::-webkit-details-marker {
		display: none;
	}

	.toc summary.fixed {
		pointer-events: none;
	}

	.toc[open] summary :global(svg) {
		transform: rotate(180deg);
	}

	.toc ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.toc li a {
		display: block;
		padding: 4px 0 4px 12px;
		border-left: 2px solid var(--rule);
		font-size: 14px;
		color: var(--ink-2);
		text-decoration: none;
	}

	.toc li a:hover {
		color: var(--house-deep);
		border-left-color: var(--rule-strong);
	}

	.toc li.here a {
		border-left: 3px solid var(--house);
		padding-left: 11px;
		font-weight: 800;
		color: var(--house-deep);
	}

	.side .status {
		align-items: baseline;
		font-size: 14px;
		font-weight: 500;
		color: var(--ink-2);
		text-decoration: none;
	}

	.side .status b {
		color: var(--good);
		font-weight: 800;
	}

	.side .status.bad b {
		color: var(--warn-deep);
	}

	.side .status i {
		color: var(--good);
		transform: translateY(-1px);
	}

	.side .status.bad i {
		color: var(--warn-deep);
		transform: translateY(-1px) rotate(45deg);
	}

	.side .status:hover span {
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	/* The notification, in its own order. */
	.doc-section {
		margin-top: 44px;
		scroll-margin-top: 16px;
	}

	.doc > .doc-section:first-child,
	.doc > .msg + .doc-section {
		margin-top: 10px;
	}

	.doc-h {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 6px 16px;
		padding-bottom: 10px;
		margin-bottom: 16px;
		border-bottom: 2px solid var(--ink);
	}

	.doc-h h2 {
		margin: 0;
	}

	.status {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		font-size: 13px;
		font-weight: 650;
		color: var(--good);
	}

	.status.bad {
		color: var(--warn-deep);
	}

	.problems {
		margin: 0 0 18px;
		padding: 12px 14px 12px 32px;
		background: var(--warn-soft);
		color: var(--warn-deep);
		font-size: 14px;
	}

	.problems li + li {
		margin-top: 4px;
	}

	.phase {
		margin: 20px 0 8px;
		font-size: 15px;
		color: var(--house-deep);
	}

	.spec-topics {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.spec-topics li {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 2px 16px;
		padding: 8px 0;
		border-bottom: 1px solid var(--rule);
	}

	.ids {
		display: inline-flex;
		gap: 10px;
		font-size: 12px;
		font-weight: 750;
		color: var(--house-deep);
	}

	.ids .unknown {
		color: var(--warn-deep);
		text-decoration: line-through;
	}

	.teacher {
		margin-top: 48px;
		border-top: 2px solid var(--ink);
		scroll-margin-top: 16px;
	}

	.teacher summary {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 10px;
		padding: 16px 0;
		cursor: pointer;
		font-size: 17px;
		font-weight: 800;
		list-style: none;
	}

	.teacher summary::-webkit-details-marker {
		display: none;
	}

	.teacher summary span {
		font-size: 13px;
		font-weight: 500;
		color: var(--muted);
	}

	.chev {
		display: inline-flex;
		transition: transform 180ms var(--ease);
	}

	.teacher[open] .chev {
		transform: rotate(180deg);
	}

	.teacher summary:hover,
	.teacher[open] summary {
		color: var(--house-deep);
	}

	.teacher .doc-section:first-of-type {
		margin-top: 12px;
	}

	.source {
		margin: 48px 0 0;
		font-size: 12px;
		color: var(--muted);
		overflow-wrap: anywhere;
	}

	/* No room beside the document: the side column sits under the header. */
	@media (max-width: 860px) {
		.doc-page {
			grid-template-columns: minmax(0, 1fr);
			grid-template-areas: 'side' 'doc';
		}

		.side {
			position: static;
			max-height: none;
			overflow: visible;
			padding-top: 0;
			margin-bottom: 30px;
		}

		.side-block + .side-block {
			margin-top: 20px;
		}

		.toc summary {
			margin: 0;
			padding: 4px 0;
		}

		.toc[open] summary {
			margin-bottom: 8px;
		}
	}

	@media (max-width: 640px) {
		.facts .lead {
			font-size: 32px;
		}

		.facts {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			column-gap: 18px;
		}

		.facts > div,
		.facts > div.wide {
			min-width: 0;
			max-width: none;
			margin-right: 0;
			padding-right: 0;
		}

		.facts > div.wide {
			grid-column: 1 / -1;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.chev {
			transition: none;
		}
	}
</style>
