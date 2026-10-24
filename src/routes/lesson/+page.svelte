<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import Failure from '#lib/components/Failure.svelte';
	import FeedbackList from '#lib/components/FeedbackList.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import LessonEditor from '#lib/components/LessonEditor.svelte';
	import LessonView from '#lib/components/LessonView.svelte';
	import MaterialsDialog from '#lib/components/MaterialsDialog.svelte';
	import MaterialsPanel from '#lib/components/MaterialsPanel.svelte';
	import PageHead from '#lib/components/PageHead.svelte';
	import PlanCompare from '#lib/components/PlanCompare.svelte';
	import VersionBar, { versionLabel } from '#lib/components/VersionBar.svelte';
	import ResolveDialog from '#lib/components/ResolveDialog.svelte';
	import TaughtDialog from '#lib/components/TaughtDialog.svelte';
	import type { HeldRecord } from '#lib/data.ts';
	import { formatDate } from '#lib/domain/deliveries.ts';
	import { lessonRefs, OfferingMismatch } from '#lib/domain/offerings.ts';
	import { join, stem } from '#lib/domain/paths.ts';
	import { lessonVersions, versionOf, type Version } from '#lib/domain/versions.ts';
	import type { Lesson } from '#lib/domain/types.ts';
	import { className } from '#lib/house.ts';
	import { links } from '#lib/links.ts';
	import { session } from '#lib/session.svelte.ts';

	const u = $derived(page.url.searchParams.get('u') ?? '');
	const l = $derived(page.url.searchParams.get('l') ?? '');
	const o = $derived(page.url.searchParams.get('o'));
	const t = $derived(page.url.searchParams.get('t'));
	const editing = $derived(page.url.searchParams.get('edit') === '1');
	const path = $derived(u && l ? join(u, l) : '');

	const load = $derived.by(() => {
		const data = session.data;
		void session.revision;
		if (!data || !path) return null;
		return (async () => {
			const [unit, loaded, content, schemas, offering, offerings] = await Promise.all([
				data.unit(u),
				data.lesson(path),
				data.content(path),
				data.schemas(),
				o ? data.offering(o) : Promise.resolve(null),
				data.offerings()
			]);
			// Class names by offering id, for outputs listed for every class.
			const classNames = new Map(offerings.map(([, x]) => [x.id, className(x)]));
			let refs: string[] = [];
			try {
				refs = lessonRefs(u, unit, offering, t);
			} catch (error) {
				if (!(error instanceof OfferingMismatch)) throw error;
			}
			const registry = new Map((unit.syllabus_registry ?? []).map((r) => [r.id, r]));
			// Warm the neighbours so the next and previous lessons open at once.
			const at = refs.indexOf(l);
			for (const ref of [refs[at + 1], refs[at - 1]]) {
				if (ref) data.lesson(join(u, ref)).catch(() => {});
			}
			return {
				unit,
				loaded,
				content,
				schemas,
				refs,
				registry,
				offering,
				classNames,
				store: data.store,
				data
			};
		})();
	});

	// The plan as last loaded or saved; a save replaces it without refetching.
	let saved = $state<{ path: string; lesson: Lesson; sha: string } | null>(null);

	// Where J and K go, once the lesson's place in the order is known.
	let neighbours = $state<{ prev: string | null; next: string | null }>({ prev: null, next: null });
	$effect(() => {
		const pending = load;
		const at = { u, l, o, t };
		neighbours = { prev: null, next: null };
		pending
			?.then(({ refs }) => {
				if (load !== pending) return;
				const i = refs.indexOf(at.l);
				neighbours = {
					prev: i > 0 ? links.lesson(at.u, refs[i - 1], at.o, at.t) : null,
					next: i >= 0 && i < refs.length - 1 ? links.lesson(at.u, refs[i + 1], at.o, at.t) : null
				};
			})
			.catch(() => {});
	});

	// Every class's delivery records for this lesson, read apart from the plan so the page never waits on them.
	let held = $state.raw<HeldRecord[] | null>(null);
	let heldError = $state<unknown>(null);
	let heldRevision = $state(0);
	$effect(() => {
		const data = session.data;
		const at = path;
		void session.revision;
		void heldRevision;
		held = null;
		heldError = null;
		if (!data || !at) return;
		let current = true;
		data
			.deliveries(at)
			.then((found) => current && (held = found))
			.catch((error) => current && (heldError = error));
		return () => (current = false);
	});
	const hasOpen = (records: HeldRecord[] | null) =>
		!!records?.some((h) =>
			h.record.deliveries.some((d) => d.feedback?.some((f) => f.status === 'open'))
		);
	// The last time this class had the lesson, when the page is in a class's context.
	const lastTaught = $derived(
		held
			?.find((h) => h.offeringPath === o)
			?.record.deliveries.map((d) => d.taught)
			.filter(Boolean)
			.at(-1) ?? null
	);

	// This class's deliveries of the lesson, oldest first, when the page is in a class's context.
	const mine = $derived(
		o ? (held?.find((h) => h.offeringPath === o)?.record.deliveries ?? []) : []
	);
	// Which version shows, and which it is compared with. Unpicked, the page shows the
	// version the class had (or the current plan), compared with the one before it.
	let shownPick = $state<number | null>(null);
	let againstPick = $state<number | null>(null);
	let comparing = $state(false);
	$effect(() => {
		void path;
		void o;
		shownPick = null;
		againstPick = null;
		comparing = false;
	});

	function shownIn(versions: Version[]): number {
		if (shownPick !== null && shownPick < versions.length) return shownPick;
		const mineAt = o ? versionOf(versions, o) : -1;
		return mineAt >= 0 ? mineAt : versions.findIndex((v) => v.current);
	}

	function againstIn(versions: Version[], shown: number): number {
		if (againstPick !== null && againstPick !== shown && againstPick < versions.length) {
			return againstPick;
		}
		return shown > 0 ? shown - 1 : shown + 1;
	}

	const names = $derived(
		new Map(
			(held ?? []).flatMap((h) =>
				h.offeringPath && h.offering ? [[h.offeringPath, className(h.offering)] as const] : []
			)
		)
	);

	function commitHref(sha: string): string | null {
		if (session.source !== 'github') return null;
		const { owner, repo } = session.target;
		return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commit/${encodeURIComponent(sha)}`;
	}

	let marking = $state(false);
	// The page's class's record for this lesson, whose deliveries can be given links.
	const myRecord = $derived(o ? (held?.find((h) => h.offeringPath === o) ?? null) : null);
	let linking = $state(false);
	let linkingAt = $state(0);
	let resolving = $state(false);
	let afterSave = $state<{ commit: string | null } | null>(null);

	/** After a plan is saved, asks which open feedback the change dealt with. */
	async function askAfterSave() {
		const data = session.data;
		if (!data) return;
		try {
			const [commit, found] = await Promise.all([data.store.head(), data.deliveries(path)]);
			held = found;
			if (!hasOpen(found)) return;
			afterSave = { commit };
			resolving = true;
		} catch {
			// The plan is saved; feedback can still be closed from the lesson's margin.
		}
	}

	function onkeydown(event: KeyboardEvent) {
		if (editing || event.ctrlKey || event.metaKey || event.altKey) return;
		const target = event.target as HTMLElement;
		if (target.closest('input, textarea, select, dialog[open]')) return;
		if (event.key === 'j' && neighbours.next) goto(neighbours.next);
		else if (event.key === 'k' && neighbours.prev) goto(neighbours.prev);
		else if (event.key === 'e') goto(links.lesson(u, l, o, t, true));
		else if (event.key === 't' && o) {
			// The panel focuses a text box; the key must not land in it.
			event.preventDefault();
			marking = true;
		}
	}
</script>

<svelte:window {onkeydown} />

{#if !path}
	<PageHead title="No lesson given" />
	<div class="page"><div class="msg warn"><div>Open a lesson from a unit.</div></div></div>
{:else if load}
	{#await load}
		<PageHead title={null} />
		<div class="page"><div class="loading"><span></span><span></span><span></span></div></div>
	{:then { unit, loaded, content, schemas, refs, registry, offering, classNames, store, data }}
		{@const current = saved?.path === path ? saved : { path, lesson: loaded.doc, sha: loaded.sha }}
		{@const index = refs.indexOf(l)}
		{@const prev = index > 0 ? links.lesson(u, refs[index - 1], o, t) : null}
		{@const next =
			index >= 0 && index < refs.length - 1 ? links.lesson(u, refs[index + 1], o, t) : null}
		{@const versions = lessonVersions(held ?? [], current.lesson)}
		{@const shown = shownIn(versions)}
		{@const against = againstIn(versions, shown)}
		{@const past = !editing && !versions[shown].current ? versions[shown].plan : null}
		<PageHead
			crumbs={[
				...(offering ? [{ href: links.home(), label: className(offering) }] : []),
				{ href: links.unit(u, o, t), label: unit.unit_title + (t ? ` · ${t}` : '') }
			]}
			numeral={index >= 0 ? String(index + 1).padStart(2, '0') : null}
			title={current.lesson.title}
			lede={editing ? null : (past ?? current.lesson).description}
		>
			{#snippet actions()}
				{#if !editing}
					<a
						class="btn icon-btn"
						href={prev ?? undefined}
						aria-disabled={!prev}
						aria-label="Previous lesson (K)"
						title="Previous lesson (K)"
					>
						<Icon name="left" />
					</a>
					<a
						class="btn icon-btn"
						href={next ?? undefined}
						aria-disabled={!next}
						aria-label="Next lesson (J)"
						title="Next lesson (J)"
					>
						<Icon name="right" />
					</a>
					{#if offering && o}
						<button type="button" onclick={() => (marking = true)} title="Mark as taught (T)">
							<Icon name="check" size={16} /> Mark as taught
						</button>
					{/if}
					<a class="btn solid" href={links.lesson(u, l, o, t, true)} title="Edit (E)">
						<Icon name="pencil" size={16} /> Edit
					</a>
				{/if}
			{/snippet}
			{#snippet meta()}
				{#if index >= 0}<span>Lesson {index + 1} of {refs.length}</span>{/if}
				<span>{current.lesson.duration_minutes} minutes</span>
				<span class="file">{stem(l)}</span>
				{#if offering && lastTaught}<span>Taught {formatDate(lastTaught)}</span>{/if}
				{#if editing}<span>Editing</span>{/if}
			{/snippet}
		</PageHead>

		<div class="page">
			{#if editing}
				{#key current.path}
					<LessonEditor
						{path}
						lesson={current.lesson}
						sha={current.sha}
						{registry}
						{schemas}
						{store}
						hasContent={content !== null}
						viewHref={links.lesson(u, l, o, t)}
						onsaved={(lesson, sha) => {
							saved = { path, lesson, sha };
							askAfterSave();
						}}
						onreload={() => {
							store.refresh();
							saved = null;
							session.revision += 1;
						}}
					>
						{#snippet feedback()}
							<FeedbackList {held} error={heldError} />
						{/snippet}
					</LessonEditor>
				{/key}
			{:else}
				{#key `${path}|${o}`}
					<VersionBar
						{versions}
						bind:shown={() => shown, (i) => (shownPick = i)}
						bind:against={() => against, (i) => (againstPick = i)}
						bind:comparing
						{names}
						{mine}
						whom={offering ? className(offering) : null}
						offeringPath={offering ? o : null}
						{commitHref}
					/>
				{/key}
				{#if comparing && versions.length > 1}
					{@const [older, newer] = [Math.min(shown, against), Math.max(shown, against)]}
					<PlanCompare
						before={{ plan: versions[older].plan, label: versionLabel(versions[older], names) }}
						after={{ plan: versions[newer].plan, label: versionLabel(versions[newer], names) }}
						{registry}
					/>
				{:else}
					<LessonView
						lesson={past ?? current.lesson}
						{registry}
						content={past ? undefined : content}
					>
						{#snippet feedback()}
							<FeedbackList
								{held}
								error={heldError}
								onclose={() => {
									afterSave = null;
									resolving = true;
								}}
							/>
						{/snippet}
						{#snippet materials()}
							<MaterialsPanel
								lesson={current.lesson}
								lessonPath={path}
								offering={offering?.id ?? null}
								{mine}
								names={classNames}
								folder={offering?.folder ?? null}
								onedit={myRecord
									? (i) => {
											linkingAt = i;
											linking = true;
										}
									: null}
							/>
						{/snippet}
					</LessonView>
				{/if}

				<nav class="pager" aria-label="Lessons in order">
					{#if prev}
						<a href={prev} class="prev">
							<span class="dir"><Icon name="left" size={16} /> Previous <kbd>K</kbd></span>
							<span class="name">Lesson {index}</span>
						</a>
					{:else}<span></span>{/if}
					{#if next}
						<a href={next} class="next">
							<span class="dir">Next <kbd>J</kbd> <Icon name="right" size={16} /></span>
							<span class="name">Lesson {index + 2}</span>
						</a>
					{/if}
				</nav>
			{/if}
		</div>

		{#if offering && o}
			<TaughtDialog
				bind:open={marking}
				{data}
				offeringPath={o}
				{offering}
				lessonPath={path}
				lesson={current.lesson}
				onsaved={() => (heldRevision += 1)}
			/>
		{/if}
		{#if offering && myRecord}
			<MaterialsDialog
				bind:open={linking}
				{data}
				held={myRecord}
				bind:delivery={linkingAt}
				whom={className(offering)}
				onsaved={() => (heldRevision += 1)}
				onreload={() => {
					data.store.refresh();
					heldRevision += 1;
				}}
			/>
		{/if}
		{#if held}
			<ResolveDialog
				bind:open={resolving}
				{data}
				lessonPath={path}
				{held}
				commit={afterSave?.commit ?? null}
				afterSave={afterSave !== null}
				onsaved={() => (heldRevision += 1)}
				onreload={() => (heldRevision += 1)}
			/>
		{/if}
	{:catch error}
		<PageHead title="Could not open this lesson" />
		<div class="page"><Failure {error} /></div>
	{/await}
{/if}

<style>
	.icon-btn {
		width: 36px;
		padding: 0;
	}

	.icon-btn[aria-disabled='true'] {
		opacity: 0.35;
		pointer-events: none;
	}

	.file {
		opacity: 0.75;
		font-weight: 500;
	}

	.pager {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 4px;
		margin-top: 48px;
	}

	.pager a {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 18px 20px;
		background: var(--house-soft);
		text-decoration: none;
		transition: background-color 160ms var(--ease);
	}

	.pager a:hover {
		background: var(--house);
		color: var(--house-on);
	}

	.pager .next {
		align-items: flex-end;
		grid-column: 2;
	}

	.dir {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		font-weight: 700;
	}

	.name {
		font-size: 22px;
		font-weight: 850;
		font-stretch: 75%;
	}
</style>
