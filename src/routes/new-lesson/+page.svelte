<script lang="ts">
	// A new lesson plan in a unit: first where its file goes, then the plan
	// itself in the lesson editor. Nothing is written until the plan is created.
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import Failure from '#lib/components/Failure.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import LessonEditor from '#lib/components/LessonEditor.svelte';
	import PageHead from '#lib/components/PageHead.svelte';
	import {
		blankLesson,
		lessonFolders,
		lessonFile,
		lessonSlug,
		numbered,
		ownLists,
		usualLength,
		validSlug
	} from '#lib/domain/newLesson.ts';
	import { entryTakes } from '#lib/domain/offerings.ts';
	import { dirname, join } from '#lib/domain/paths.ts';
	import type { Lesson } from '#lib/domain/types.ts';
	import { className } from '#lib/house.ts';
	import { links } from '#lib/links.ts';
	import { session } from '#lib/session.svelte.ts';

	const u = $derived(page.url.searchParams.get('u') ?? '');
	const o = $derived(page.url.searchParams.get('o'));
	const t = $derived(page.url.searchParams.get('t'));

	const load = $derived.by(() => {
		const data = session.data;
		void session.revision;
		if (!data || !u) return null;
		return (async () => {
			const [unit, offerings, paths, schemas] = await Promise.all([
				data.unit(u),
				data.offerings(),
				data.store.paths(),
				data.schemas()
			]);
			const registry = await data.registry(u, unit);
			const lessons = await Promise.all(
				(unit.lessons ?? []).map((ref) =>
					data
						.lesson(join(u, ref))
						.then((l) => l.doc)
						.catch(() => null)
				)
			);
			const folders = lessonFolders(unit);
			const own = ownLists(u, offerings);
			// Start in the folder of the class's last lesson, else of the index's last.
			const offering = offerings.find(([p]) => p === o)?.[1];
			const entry = offering?.units.find((e) => entryTakes(offering, e, u) && e.lessons);
			const last = entry?.lessons?.at(-1) ?? unit.lessons?.at(-1);
			const start = last && folders.includes(dirname(last)) ? dirname(last) : folders[0];
			return {
				data,
				unit,
				paths,
				schemas,
				registry,
				folders,
				own,
				start,
				minutes: usualLength(lessons)
			};
		})();
	});

	let title = $state('');
	let folder = $state<string | null>(null);
	let slug = $state('');
	let slugEdited = $state(false);
	// The plan's file and starting draft, once the first step is done.
	let chosen = $state<{ ref: string; lesson: Lesson } | null>(null);

	$effect(() => {
		if (!slugEdited) slug = lessonSlug(title);
	});
</script>

{#if !u}
	<PageHead title="No unit given" />
	<div class="page"><div class="msg warn"><div>Start a new lesson from its unit.</div></div></div>
{:else if load}
	{#await load}
		<PageHead title={null} />
		<div class="page"><div class="loading"><span></span><span></span><span></span></div></div>
	{:then { data, unit, paths, schemas, registry, folders, own, start, minutes }}
		{@const where = folder ?? start}
		{@const ref = lessonFile(where, slug || '…')}
		{@const taken = paths.has(join(u, ref))}
		{@const slugProblem = !slug
			? 'Give the lesson a title.'
			: !validSlug(slug)
				? 'Use lowercase words and numbers joined by underscores.'
				: numbered(slug)
					? 'Start with a word, not a number. The unit’s lesson list and each class set the order.'
					: taken
						? `${ref} already exists.`
						: null}
		{@const unitHref = links.unit(u, o, t)}
		<PageHead
			crumbs={[{ href: unitHref, label: unit.unit_title }]}
			title={chosen ? chosen.lesson.title || 'New lesson' : 'New lesson'}
			lede={chosen
				? null
				: 'Name the lesson, then write the plan. Nothing is saved until you create it.'}
		>
			{#snippet meta()}
				<span>Lesson {(unit.lessons?.length ?? 0) + 1} in the unit’s index</span>
				{#if chosen}<span class="file">{chosen.ref}</span>{/if}
			{/snippet}
		</PageHead>

		<div class="page">
			{#if chosen}
				{@const made = chosen}
				<LessonEditor
					path={join(u, made.ref)}
					lesson={made.lesson}
					sha=""
					{registry}
					{schemas}
					store={data.store}
					hasContent={false}
					viewHref={unitHref}
					onreload={() => {}}
					create={(lesson, message) => data.createLesson(u, made.ref, lesson, message)}
					onsaved={() => {
						session.revision += 1;
						const inClass = !own.some((c) => c.path === o);
						goto(links.lesson(u, made.ref, inClass ? o : null, inClass ? t : null));
					}}
				/>
			{:else}
				<form
					class="fields"
					onsubmit={(event) => {
						event.preventDefault();
						if (slugProblem) return;
						chosen = {
							ref: lessonFile(where, slug),
							lesson: blankLesson(title.trim(), minutes)
						};
					}}
				>
					<label class="field">
						<span>Title</span>
						<!-- svelte-ignore a11y_autofocus -->
						<input type="text" bind:value={title} class="title-input" required autofocus />
					</label>

					{#if folders.length > 1}
						<label class="field">
							<span>Version</span>
							<select value={where} onchange={(e) => (folder = e.currentTarget.value)}>
								{#each folders as f (f)}<option value={f}>{f}</option>{/each}
							</select>
						</label>
					{/if}

					<label class="field">
						<span>File name</span>
						<span class="name">
							<input
								type="text"
								bind:value={slug}
								oninput={() => (slugEdited = true)}
								spellcheck="false"
								autocomplete="off"
							/>
							<span class="fixed">.json</span>
						</span>
					</label>
					<p class="hint" class:bad={slugProblem && title}>
						{#if slugProblem && title}{slugProblem}{:else}Saved as <code>{join(u, ref)}</code>, and
							added to the end of the unit’s lessons.{/if}
					</p>

					{#if own.length}
						<div class="msg note">
							<div>
								{own.map((c) => className(c.offering) + (c.term ? ` (${c.term})` : '')).join(', ')}
								{own.length === 1 ? 'lists its' : 'list their'} own lessons for this unit, so the new
								lesson won’t be in {own.length === 1 ? 'that class’s' : 'those classes’'} order. Add it
								to the class’s file by hand.
							</div>
						</div>
					{/if}

					<div class="actions">
						<button class="primary go" type="submit" disabled={!!slugProblem}>
							Write the plan <Icon name="right" size={16} />
						</button>
						<a class="btn quiet" href={unitHref}>Cancel</a>
					</div>
				</form>
			{/if}
		</div>
	{:catch error}
		<PageHead title="Could not open this unit" />
		<div class="page"><Failure {error} /></div>
	{/await}
{/if}

<style>
	.fields {
		max-width: 680px;
	}

	.title-input {
		font-size: 20px;
		font-weight: 750;
	}

	.name {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.name input {
		flex: 1;
		min-width: 0;
	}

	.fixed {
		font-weight: 700;
		color: var(--ink-2);
	}

	.file {
		opacity: 0.75;
		font-weight: 500;
	}

	.hint {
		margin: -8px 0 20px;
		font-size: 13px;
		color: var(--muted);
	}

	.hint.bad {
		color: var(--warn);
	}

	.msg {
		margin-bottom: 20px;
	}

	.actions {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.go {
		min-height: 44px;
		padding: 0 22px;
		font-size: 15px;
	}
</style>
