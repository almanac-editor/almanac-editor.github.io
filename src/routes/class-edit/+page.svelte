<script lang="ts">
	import { page } from '$app/state';
	import ClassEditor from '#lib/components/ClassEditor.svelte';
	import Failure from '#lib/components/Failure.svelte';
	import PageHead from '#lib/components/PageHead.svelte';
	import { calendarPath } from '#lib/domain/layout.ts';
	import type { Offering } from '#lib/domain/types.ts';
	import { session } from '#lib/session.svelte.ts';

	const o = $derived(page.url.searchParams.get('o') ?? '');
	const u = $derived(page.url.searchParams.get('u'));
	const t = $derived(page.url.searchParams.get('t'));

	const load = $derived.by(() => {
		const data = session.data;
		void session.revision;
		if (!data || !o) return null;
		return (async () => {
			const [loaded, units, calendars] = await Promise.all([
				data.store.readJson<Offering>(o),
				data.units(),
				data.calendars()
			]);
			const subject = loaded.doc.subject;
			const calendar = calendars.get(calendarPath(loaded.doc.year))?.doc;
			return {
				loaded,
				periods: calendar?.periods ?? [],
				units: units.filter((entry) => entry.dir.startsWith(subject + '/')),
				oneOffs: await data.oneOffs(subject)
			};
		})();
	});
</script>

{#if !o}
	<PageHead title="No class given" />
	<div class="page">
		<div class="msg warn"><div>Open a class from the list of classes.</div></div>
	</div>
{:else if load}
	{#await load}
		<PageHead title={null} />
		<div class="page"><div class="loading"><span></span><span></span><span></span></div></div>
	{:then { loaded, units, oneOffs, periods }}
		{#key loaded.sha}
			<ClassEditor
				path={o}
				offering={loaded.doc}
				sha={loaded.sha}
				{units}
				{oneOffs}
				{periods}
				{u}
				{t}
			/>
		{/key}
	{:catch error}
		<PageHead title="Could not open this class" />
		<div class="page"><Failure {error} /></div>
	{/await}
{/if}
