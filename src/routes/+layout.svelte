<script lang="ts">
	import '../app.css';
	import favicon from '#lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { afterNavigate } from '$app/navigation';
	import Icon from '#lib/components/Icon.svelte';
	import Jump, { type JumpItem } from '#lib/components/Jump.svelte';
	import Welcome from '#lib/components/Welcome.svelte';
	import type { UnitEntry } from '#lib/data.ts';
	import { subjectOf } from '#lib/domain/layout.ts';
	import { join } from '#lib/domain/paths.ts';
	import type { Offering } from '#lib/domain/types.ts';
	import {
		className,
		houseMap,
		houseOf,
		humanise,
		shownYear,
		termParts,
		titleCase,
		yearsOf,
		type House
	} from '#lib/house.ts';
	import { defaultYear } from '#lib/domain/newOffering.ts';
	import { links } from '#lib/links.ts';
	import { session } from '#lib/session.svelte.ts';

	let { children } = $props();

	const onSettings = $derived(page.url.pathname.endsWith('/settings'));
	const onCalendar = $derived(page.url.pathname.endsWith('/calendar'));
	const o = $derived(page.url.searchParams.get('o'));
	const u = $derived(page.url.searchParams.get('u'));

	// The rail's lists, read once per sign-in (Data caches them).
	let index = $state<{ units: UnitEntry[]; offerings: [string, Offering][] } | null>(null);
	$effect(() => {
		const data = session.data;
		void session.revision;
		if (!data) {
			index = null;
			return;
		}
		Promise.all([data.units(), data.offerings()])
			.then(([units, offerings]) => {
				if (session.data === data) index = { units, offerings };
			})
			.catch(() => {
				// The page itself shows the failure; the rail stays empty.
			});
	});

	const houses = $derived(houseMap(index?.offerings ?? []));
	const years = $derived(yearsOf(index?.offerings ?? []));
	const shown = $derived(shownYear(session.year, years, defaultYear));
	/** The shown year's classes, plus the class being looked at if it is from another year. */
	const railClasses = $derived(
		(index?.offerings ?? []).filter(([p, of]) => shown === 'all' || of.year === shown || p === o)
	);
	const house = $derived<House>(houseOf(o, houses));
	let from = $state<House>('none');

	afterNavigate(({ from: previous }) => {
		from = houseOf(previous?.url?.searchParams.get('o'), houses);
		menuOpen = false;
	});

	const unitTitle = (dir: string) =>
		index?.units.find((e) => e.dir === dir)?.unit.unit_title ??
		humanise(dir.split('/').pop() ?? '');

	const subjects = $derived(
		index
			? (Object.entries(Object.groupBy(index.units, (e) => subjectOf(e.dir))) as [
					string,
					UnitEntry[]
				][])
			: []
	);

	const jumpItems = $derived.by<JumpItem[]>(() => {
		if (!index) return [];
		const items: JumpItem[] = [];
		for (const [path, offering] of index.offerings) {
			const h = houseOf(path, houses);
			const first = offering.units[0];
			items.push({
				kind: 'Class',
				label: className(offering),
				sub: `${offering.id} · ${offering.units.length} units`,
				href: first
					? links.unit(join(offering.subject, first.unit), path, first.term)
					: links.home(),
				house: h
			});
			items.push({
				kind: 'Calendar',
				label: `${className(offering)} calendar`,
				sub: `${offering.id} · taught and planned lessons`,
				href: links.calendar(path),
				house: h
			});
			for (const entry of offering.units) {
				const dir = join(offering.subject, entry.unit);
				items.push({
					kind: 'Unit',
					label: unitTitle(dir),
					sub: `${className(offering)}${entry.term ? ` · ${entry.term}` : ''}`,
					href: links.unit(dir, path, entry.term),
					house: h
				});
			}
		}
		for (const { dir, unit } of index.units) {
			items.push({
				kind: 'Unit',
				label: unit.unit_title,
				sub: `${titleCase(subjectOf(dir))} · every plan`,
				href: links.unit(dir),
				house: 'none'
			});
			for (const ref of unit.lessons ?? []) {
				items.push({
					kind: 'Lesson',
					label: humanise(ref.split('/').pop() ?? ref),
					sub: unit.unit_title,
					href: links.lesson(dir, ref),
					house: 'none'
				});
			}
		}
		return items;
	});

	let jump = $state<ReturnType<typeof Jump>>();
	let menuOpen = $state(false);

	function onkeydown(event: KeyboardEvent) {
		const target = event.target as HTMLElement;
		const typing = target.closest('input, textarea, select, [contenteditable="true"]');
		if ((event.key === 'k' && (event.ctrlKey || event.metaKey)) || (event.key === '/' && !typing)) {
			if (!session.active) return;
			event.preventDefault();
			jump?.open();
		}
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Almanac</title>
</svelte:head>

<svelte:window {onkeydown} />

{#if !session.ready}
	<div class="boot" aria-hidden="true"></div>
{:else if !session.active && !onSettings}
	<Welcome />
{:else}
	<div class="app" class:menu-open={menuOpen}>
		<div class="topbar">
			<a href={links.home()} class="mark">Almanac</a>
			<button class="quiet icon" onclick={() => jump?.open()} aria-label="Jump to…">
				<Icon name="search" />
			</button>
			<button
				class="quiet icon"
				onclick={() => (menuOpen = !menuOpen)}
				aria-label={menuOpen ? 'Close menu' : 'Open menu'}
				aria-expanded={menuOpen}
			>
				<Icon name={menuOpen ? 'close' : 'menu'} />
			</button>
		</div>

		<aside class="rail" aria-label="Classes and units">
			<a href={links.home()} class="mark big">Almanac</a>
			{#if session.active}
				<p class="repo">
					{#if session.source === 'sample'}
						Sample lessons
					{:else if session.source === 'folder'}
						<Icon name="file" size={13} /> {session.label}
					{:else}
						{session.label}<span>@{session.target.branch}</span>
					{/if}
				</p>
				<button class="jump" onclick={() => jump?.open()}>
					<Icon name="search" size={16} />
					<span>Jump to…</span>
					<kbd>/</kbd>
				</button>
			{/if}

			{#if index}
				<nav aria-label="Classes">
					<h2 class="rail-h">
						Classes{#if shown !== 'all' && years.length > 1}<a href={links.home()}>{shown}</a>{/if}
					</h2>
					<ul class="bands">
						{#each railClasses as [path, offering] (path)}
							{@const h = houseOf(path, houses)}
							{@const here = o === path}
							{@const first = offering.units[0]}
							<li data-house={h} class:here>
								<a
									class="band"
									href={first
										? links.unit(join(offering.subject, first.unit), path, first.term)
										: links.home()}
									aria-current={here ? 'true' : undefined}
								>
									<span class="yr">{offering.year_group ?? offering.id}</span>
									<span class="cl">{offering.class_label ?? ''}</span>
									<span class="oid">{offering.id}</span>
								</a>
								{#if here}
									<ul class="terms">
										{#each offering.units as entry, i (i)}
											{@const dir = join(offering.subject, entry.unit)}
											<li>
												<a
													href={links.unit(dir, path, entry.term)}
													aria-current={u === dir &&
													page.url.searchParams.get('t') === (entry.term ?? null)
														? 'page'
														: undefined}
												>
													{#if entry.term}<span class="term" title={entry.term}
															>{termParts(entry.term).join(' + ')}</span
														>{/if}
													<span>{unitTitle(dir)}</span>
												</a>
											</li>
										{/each}
										<li>
											<a href={links.calendar(path)} aria-current={onCalendar ? 'page' : undefined}>
												<span class="term"><Icon name="calendar" size={14} /></span>
												<span>Calendar</span>
											</a>
										</li>
									</ul>
								{/if}
							</li>
						{/each}
					</ul>
				</nav>

				<nav aria-label="Units">
					{#each subjects as [subject, units] (subject)}
						<h2 class="rail-h">{titleCase(subject)}</h2>
						<ul class="units">
							{#each units as { dir, unit } (dir)}
								<li>
									<a href={links.unit(dir)} aria-current={!o && u === dir ? 'page' : undefined}>
										<span>{unit.unit_title}</span>
										<span class="n">{unit.lessons?.length ?? 0}</span>
									</a>
								</li>
							{/each}
						</ul>
					{/each}
				</nav>
			{:else if session.active}
				<div class="rail-loading" aria-hidden="true">
					<span></span><span></span><span></span>
				</div>
			{/if}

			<div class="rail-foot">
				<a href={links.settings()} aria-current={onSettings ? 'page' : undefined}>
					<Icon name="gear" size={16} />
					{session.source === 'sample' ? 'Use your own lessons' : 'Lesson files'}
				</a>
			</div>
		</aside>

		<div class="scrim" aria-hidden="true" onclick={() => (menuOpen = false)}></div>

		<div class="from" data-house={from}>
			<div class="from-capture">
				<main data-house={house}>
					{@render children()}
				</main>
			</div>
		</div>
	</div>

	<Jump bind:this={jump} items={jumpItems} />
{/if}

<style>
	.boot {
		min-height: 100vh;
		background: var(--rail);
	}

	.app {
		--rail-w: 248px;
		display: grid;
		grid-template-columns: var(--rail-w) minmax(0, 1fr);
		min-height: 100vh;
	}

	.topbar {
		display: none;
	}

	.rail {
		position: sticky;
		top: 0;
		height: 100vh;
		overflow-y: auto;
		background: var(--rail);
		color: var(--rail-ink);
		padding: 22px 0 16px;
		display: flex;
		flex-direction: column;
		gap: 18px;
		scrollbar-color: #3a3d45 transparent;
	}

	.mark {
		font-weight: 900;
		font-stretch: 72%;
		font-size: 22px;
		letter-spacing: -0.02em;
		text-decoration: none;
		line-height: 1;
	}

	.mark.big {
		font-size: 34px;
		padding: 0 20px;
	}

	.repo {
		margin: -10px 0 0;
		padding: 0 20px;
		font-size: 12px;
		color: var(--rail-muted);
		overflow-wrap: anywhere;
	}

	.repo :global(svg) {
		display: inline-block;
		vertical-align: -2px;
	}

	.repo span {
		opacity: 0.7;
	}

	.jump {
		margin: 0 16px;
		justify-content: flex-start;
		background: #23252c;
		border-color: #33363e;
		color: var(--rail-muted);
		font-weight: 500;
	}

	.jump:hover:not(:disabled) {
		border-color: var(--rail-muted);
		color: var(--rail-ink);
	}

	.jump span {
		flex: 1;
		text-align: left;
	}

	.rail-h a {
		margin-left: 6px;
		color: var(--rail-ink);
		text-decoration: none;
	}

	.rail-h a:hover {
		text-decoration: underline;
	}

	.rail-h {
		font-size: 12px;
		font-weight: 700;
		font-stretch: 100%;
		letter-spacing: 0;
		color: var(--rail-muted);
		padding: 0 20px;
		margin: 0 0 8px;
	}

	.rail ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.bands {
		display: grid;
		gap: 3px;
	}

	.band {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0 8px;
		margin: 0 12px 0 0;
		padding: 11px 16px 11px 20px;
		background: var(--house);
		color: var(--house-on);
		text-decoration: none;
		transition:
			margin 260ms var(--ease),
			padding 260ms var(--ease);
	}

	.band:hover {
		margin-right: 4px;
	}

	.here .band {
		margin-right: 0;
		padding-top: 16px;
		padding-bottom: 16px;
	}

	.yr {
		font-weight: 850;
		font-stretch: 75%;
		font-size: 20px;
		line-height: 1;
	}

	.here .yr {
		font-size: 26px;
	}

	.oid {
		flex-basis: 100%;
		font-size: 11px;
		opacity: 0.75;
		margin-top: 3px;
	}

	.cl {
		font-size: 13px;
		font-weight: 600;
		opacity: 0.85;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.terms {
		background: color-mix(in oklab, var(--house) 22%, var(--rail));
		padding: 6px 0 !important;
	}

	.terms a,
	.units a {
		display: flex;
		gap: 10px;
		align-items: baseline;
		padding: 6px 16px 6px 20px;
		font-size: 14px;
		line-height: 1.3;
		text-decoration: none;
		color: var(--rail-ink);
	}

	.terms a:hover,
	.units a:hover {
		background: rgb(255 255 255 / 0.06);
	}

	.terms a[aria-current='page'] {
		background: var(--house);
		color: var(--house-on);
		font-weight: 700;
	}

	.terms a[aria-current='page'] .term {
		color: var(--house-on);
	}

	.term {
		flex: none;
		font-size: 11px;
		font-weight: 800;
		min-width: 22px;
		max-width: 56px;
		line-height: 1.25;
		color: var(--rail-muted);
	}

	.units a {
		justify-content: space-between;
		color: #d6d8d2;
	}

	.units a[aria-current='page'] {
		background: rgb(255 255 255 / 0.1);
		color: #fff;
		font-weight: 700;
	}

	.units + .rail-h {
		margin-top: 14px;
	}

	.n {
		font-size: 12px;
		color: var(--rail-muted);
	}

	.rail-loading {
		display: grid;
		gap: 3px;
		padding-right: 12px;
	}

	.rail-loading span {
		height: 44px;
		background: #23252c;
	}

	.rail-foot {
		margin-top: auto;
		padding: 12px 20px 0;
		border-top: 1px solid #2a2c33;
	}

	.rail-foot a {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-size: 14px;
		color: var(--rail-muted);
		text-decoration: none;
	}

	.rail-foot a:hover,
	.rail-foot a[aria-current='page'] {
		color: var(--rail-ink);
	}

	.from,
	.from-capture {
		display: contents;
	}

	.from-capture {
		--from: var(--house);
		--from-on: var(--house-on);
	}

	main {
		min-width: 0;
		padding-bottom: 96px;
	}

	.scrim {
		display: none;
	}

	@media (max-width: 899px) {
		.app {
			grid-template-columns: minmax(0, 1fr);
		}

		.topbar {
			display: flex;
			align-items: center;
			gap: 4px;
			position: sticky;
			top: 0;
			z-index: 20;
			padding: 8px 8px 8px 16px;
			background: var(--rail);
			color: var(--rail-ink);
		}

		.topbar .mark {
			margin-right: auto;
		}

		.topbar button {
			color: var(--rail-ink);
		}

		.topbar button:hover:not(:disabled) {
			background: rgb(255 255 255 / 0.1);
		}

		.rail {
			position: fixed;
			z-index: 30;
			top: 0;
			left: 0;
			width: min(320px, 86vw);
			transform: translateX(-100%);
			transition: transform 280ms var(--ease);
		}

		.menu-open .rail {
			transform: none;
		}

		.menu-open .scrim {
			display: block;
			position: fixed;
			inset: 0;
			z-index: 25;
			background: rgb(13 14 17 / 0.5);
		}
	}
</style>
