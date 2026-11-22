<script lang="ts">
	// Search plans' text: where a topic was taught, or is going to be. The
	// plans are read once for the place searched (searchScope.ts), then every
	// keystroke searches them in memory (search.ts). The query lives in the URL
	// so a search can be bookmarked or sent.
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import Failure from '#lib/components/Failure.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import PageHead from '#lib/components/PageHead.svelte';
	import { dedupe, matchFields, terms, type FieldHit } from '#lib/domain/search.ts';
	import { className, houseMap, houseOf, titleCase } from '#lib/house.ts';
	import { links } from '#lib/links.ts';
	import {
		classCorpus,
		statusText,
		subjectCorpus,
		unitClassCorpus,
		unitCorpus,
		type SearchItem
	} from '#lib/searchScope.ts';
	import { session } from '#lib/session.svelte.ts';

	const params = $derived(page.url.searchParams);
	const u = $derived(params.get('u'));
	const o = $derived(params.get('o'));
	const t = $derived(params.get('t'));
	const s = $derived(params.get('s'));

	/** Places in the scope shown at most; the rest are counted. */
	const SHOWN = 200;
	/** Places shown under a lesson before "more places". */
	const PLACES = 4;

	let query = $state(untrack(() => page.url.searchParams.get('q') ?? ''));
	// A link to this page while it is open (the jump dialog's search row) brings a new
	// query; the page's own URL updates while typing match the field, so leave those.
	const urlQuery = $derived(params.get('q') ?? '');
	$effect(() => {
		const next = urlQuery;
		if (untrack(() => query.trim()) !== next.trim()) query = next;
	});
	let progress = $state<{ done: number; total: number } | null>(null);
	let opened = $state(new Set<string>());

	/** The subject directory (`subjects/science`) a unit sits in. */
	const subjectDir = (unitDir: string) => unitDir.split('/').slice(0, 2).join('/');

	const load = $derived.by(() => {
		const data = session.data;
		void session.revision;
		if (!data) return null;
		const where = { u, o, t, s };
		return (async () => {
			const onProgress = (done: number, total: number) => (progress = { done, total });
			const [offerings, unit] = await Promise.all([
				data.offerings(),
				where.u ? data.unit(where.u) : Promise.resolve(null)
			]);
			// After the first await: a derived must not write state while it is worked out.
			progress = null;
			const offering = where.o ? (offerings.find(([p]) => p === where.o)?.[1] ?? null) : null;
			if (where.o && !offering) throw new Error(`${where.o} is not a class in these files.`);
			const corpus = where.u
				? where.o
					? await unitClassCorpus(data, where.u, where.o, where.t, onProgress)
					: await unitCorpus(data, where.u, onProgress)
				: where.o
					? await classCorpus(data, where.o, onProgress)
					: await subjectCorpus(data, where.s, onProgress);
			const subject = where.u ? subjectDir(where.u) : (offering?.subject ?? where.s ?? null);
			return { ...corpus, unit, offering, subject, houses: houseMap(offerings) };
		})();
	});

	// The query follows the URL without adding history, a moment after typing stops.
	let timer: ReturnType<typeof setTimeout> | undefined;
	function onInput() {
		opened = new Set();
		clearTimeout(timer);
		timer = setTimeout(() => {
			replaceState(links.search({ q: query.trim(), u, o, t, s }), page.state);
		}, 300);
	}

	type Result = { item: SearchItem; hits: FieldHit[]; key: string };

	function search(items: SearchItem[], q: string): Result[] {
		const words = terms(q);
		if (!words.length) return [];
		const out: Result[] = [];
		items.forEach((item, i) => {
			const hits = matchFields(item.fields, words);
			if (hits) out.push({ item, hits: dedupe(hits), key: `${i}` });
		});
		return out;
	}

	/** How many units the results span; names show on each row only past one. */
	const unitCount = (items: SearchItem[]) => new Set(items.map((i) => i.unitDir)).size;

	const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;

	function scopeLede(loaded: {
		unit: { unit_title: string } | null;
		offering: Parameters<typeof className>[0] | null;
		subject: string | null;
	}) {
		const { unit, offering, subject } = loaded;
		if (unit && offering)
			return `${unit.unit_title}, in ${className(offering)}’s order: taught lessons as they were taught, the rest as planned.`;
		if (unit) return `Every plan in ${unit.unit_title}, in the unit’s own order.`;
		if (offering)
			return `${className(offering)}’s year: taught lessons as they were taught, the rest as planned.`;
		if (subject) return `Every plan in ${titleCase(subject.split('/').pop() ?? subject)}.`;
		return 'Every plan in these files.';
	}
</script>

<svelte:head><title>Search · Almanac</title></svelte:head>

{#if load}
	{#await load}
		<PageHead title="Search" />
		<div class="page">
			<p class="reading" aria-live="polite">
				{progress ? `Reading plans: ${progress.done} of ${progress.total}` : 'Finding the plans…'}
			</p>
			<div class="loading"><span></span><span></span><span></span></div>
		</div>
	{:then loaded}
		{@const { items, unreadable, unit, offering, subject, houses } = loaded}
		{@const results = search(items, query)}
		{@const plans = items.filter((i) => i.ref !== null).length}
		{@const manyUnits = unitCount(items) > 1}
		<PageHead
			crumbs={[
				...(offering ? [{ href: links.calendar(o ?? ''), label: className(offering) }] : []),
				...(unit && u ? [{ href: links.unit(u, o, t), label: unit.unit_title }] : [])
			]}
			title="Search"
			lede={scopeLede(loaded)}
		>
			<nav class="views" aria-label="Where to search">
				{#if u && unit}
					<a
						href={links.search({ q: query, u })}
						aria-current={!o ? 'page' : undefined}
						data-house="none"
					>
						{unit.unit_title}
					</a>
					{#if o && offering}
						<a
							href={links.search({ q: query, u, o, t })}
							aria-current="page"
							data-house={houseOf(o, houses)}
						>
							<span class="sw" aria-hidden="true"></span>
							{unit.unit_title} · {className(offering)}{t ? ` · ${t}` : ''}
						</a>
					{/if}
				{/if}
				{#if o && offering}
					<a
						href={links.search({ q: query, o })}
						aria-current={!u ? 'page' : undefined}
						data-house={houseOf(o, houses)}
					>
						<span class="sw" aria-hidden="true"></span>
						{className(offering)}’s year
					</a>
				{/if}
				{#if subject}
					<a
						href={links.search({ q: query, s: subject })}
						aria-current={!u && !o && s ? 'page' : undefined}
						data-house="none"
					>
						All of {titleCase(subject.split('/').pop() ?? subject)}
					</a>
				{/if}
				<a
					href={links.search({ q: query })}
					aria-current={!u && !o && !s ? 'page' : undefined}
					data-house="none"
				>
					Every subject
				</a>
			</nav>
		</PageHead>

		<div class="page">
			<form class="bar" role="search" onsubmit={(e) => e.preventDefault()}>
				<label>
					<Icon name="search" size={20} />
					<span class="sr-only">Words to find</span>
					<!-- svelte-ignore a11y_autofocus -->
					<input
						type="search"
						bind:value={query}
						oninput={onInput}
						placeholder="Galileo, retrieval, “line of best fit”"
						autocomplete="off"
						spellcheck="false"
						autofocus
					/>
				</label>
			</form>

			{#if unreadable.length}
				<div class="msg warn">
					<div>
						{plural(unreadable.length, 'plan')} could not be read and {unreadable.length === 1
							? 'is'
							: 'are'} left out:
						{unreadable.join(', ')}.
					</div>
				</div>
			{/if}

			{#if !terms(query).length}
				<p class="count">
					{plural(plans, 'plan')} read. Type a word or two: every part of a plan is searched, with its
					content file. Put words in double quotes to find them together.
				</p>
			{:else if !results.length}
				<p class="count">Nothing in these {plural(plans, 'plan')} mentions “{query.trim()}”.</p>
				{#if subject && (u || o)}
					<p class="count">
						<a href={links.search({ q: query, s: subject })}
							>Search all of {titleCase(subject.split('/').pop() ?? subject)}</a
						>
					</p>
				{/if}
			{:else}
				<p class="count" aria-live="polite">
					“{query.trim()}” comes up in {plural(results.length, 'lesson')} of {plans}.
				</p>
				<ol class="results">
					{#each results.slice(0, SHOWN) as { item, hits, key } (key)}
						{@const status = statusText(item.status)}
						{@const open = opened.has(key)}
						<li class:unwritten={item.ref === null}>
							<span class="num"
								>{item.number === null ? '' : String(item.number).padStart(2, '0')}</span
							>
							<div class="body">
								<div class="head">
									{#if item.ref}
										<a class="title" href={links.lesson(item.unitDir, item.ref, o, item.term)}
											>{item.title}</a
										>
									{:else}
										<span class="title">{item.title}</span>
									{/if}
									{#if status}
										<span
											class="status {item.status.kind}"
											class:past={item.status.kind === 'planned' && item.status.past}>{status}</span
										>
									{/if}
								</div>
								{#if manyUnits}<span class="unit">{item.unitTitle}</span>{/if}
								<ul class="hits">
									{#each open ? hits : hits.slice(0, PLACES) as hit, j (j)}
										<li>
											<span class="where">{hit.where}</span>
											<span class="snip"
												>{#each hit.parts as part, k (k)}{#if part.hit}<mark>{part.text}</mark
														>{:else}{part.text}{/if}{/each}</span
											>
										</li>
									{/each}
								</ul>
								{#if hits.length > PLACES}
									<button
										type="button"
										class="more"
										aria-expanded={open}
										onclick={() => {
											const next = new Set(opened);
											if (open) next.delete(key);
											else next.add(key);
											opened = next;
										}}
									>
										{open ? 'Fewer places' : `${plural(hits.length - PLACES, 'more place')}`}
									</button>
								{/if}
							</div>
						</li>
					{/each}
				</ol>
				{#if results.length > SHOWN}
					<p class="count">
						Showing the first {SHOWN} of {results.length} lessons. Add a word to narrow it down.
					</p>
				{/if}
			{/if}
		</div>
	{:catch error}
		<PageHead title="Could not search" />
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

	.reading {
		font-size: 13px;
		font-weight: 600;
		color: var(--muted);
		margin: 0 0 12px;
	}

	.bar label {
		display: flex;
		align-items: center;
		gap: 10px;
		max-width: var(--measure);
		padding: 0 12px;
		background: var(--paper);
		border: 1px solid var(--rule-strong);
		border-radius: 2px;
		color: var(--muted);
	}

	.bar label:hover {
		border-color: var(--ink-2);
	}

	.bar label:focus-within {
		border-color: var(--house);
		box-shadow: 0 0 0 3px color-mix(in oklab, var(--house) 22%, transparent);
	}

	.bar input {
		flex: 1;
		min-width: 0;
		border: 0;
		background: transparent;
		padding: 14px 0;
		font-size: 18px;
		font-weight: 600;
		color: var(--ink);
		box-shadow: none;
	}

	.bar input:focus {
		box-shadow: none;
		outline: none;
	}

	.count {
		font-size: 14px;
		color: var(--ink-2);
		margin: 18px 0 14px;
		max-width: var(--measure);
	}

	.msg {
		margin-top: 16px;
	}

	.results {
		list-style: none;
		margin: 0;
		padding: 0;
		border-top: 2px solid var(--ink);
	}

	.results > li {
		display: grid;
		grid-template-columns: 64px minmax(0, 1fr);
		gap: 6px 20px;
		padding: 16px 4px;
		border-bottom: 1px solid var(--rule);
	}

	.num {
		font-size: 40px;
		font-weight: 900;
		font-stretch: 70%;
		line-height: 0.85;
		letter-spacing: -0.03em;
		color: var(--house);
	}

	.body {
		display: grid;
		gap: 6px;
		min-width: 0;
	}

	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 4px 12px;
	}

	.title {
		font-size: 17px;
		font-weight: 750;
		font-stretch: 88%;
		line-height: 1.2;
	}

	a.title {
		text-decoration: none;
	}

	a.title:hover {
		text-decoration: underline;
		text-decoration-thickness: 2px;
		text-underline-offset: 0.18em;
	}

	.unwritten .title {
		color: var(--ink-2);
	}

	.status {
		font-size: 12px;
		font-weight: 700;
		color: var(--muted);
	}

	.status.taught {
		color: var(--house-deep);
	}

	.status.past {
		color: var(--warn-deep);
	}

	.unit {
		font-size: 13px;
		font-weight: 600;
		color: var(--muted);
	}

	.hits {
		list-style: none;
		margin: 4px 0 0;
		padding: 0;
		display: grid;
		gap: 8px;
		max-width: var(--measure);
	}

	.hits li {
		display: grid;
		gap: 1px;
	}

	.where {
		font-size: 12px;
		font-weight: 700;
		color: var(--ink-2);
	}

	.snip {
		font-size: 14px;
		line-height: 1.5;
		overflow-wrap: anywhere;
	}

	mark {
		background: var(--house-soft);
		color: var(--house-deep);
		font-weight: 750;
		padding: 0 1px;
	}

	.more {
		justify-self: start;
		border: 0;
		background: none;
		padding: 2px 0;
		font-size: 13px;
		font-weight: 750;
		color: var(--house-deep);
		cursor: pointer;
	}

	.more:hover {
		text-decoration: underline;
	}

	@media (max-width: 640px) {
		.results > li {
			grid-template-columns: 44px minmax(0, 1fr);
			gap: 6px 12px;
		}

		.num {
			font-size: 30px;
		}
	}
</style>
