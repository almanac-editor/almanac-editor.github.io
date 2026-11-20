<script lang="ts">
	// One year's school calendar: the periods of the day, the terms and the
	// days off. Class calendars lay lessons over it; nothing else reads it.
	import { page } from '$app/state';
	import CalendarEditor from '#lib/components/CalendarEditor.svelte';
	import Failure from '#lib/components/Failure.svelte';
	import PageHead from '#lib/components/PageHead.svelte';
	import { blankCalendar } from '#lib/domain/calendarEdit.ts';
	import { calendarPath } from '#lib/domain/layout.ts';
	import { session } from '#lib/session.svelte.ts';

	const y = $derived(Number(page.url.searchParams.get('y')));
	const o = $derived(page.url.searchParams.get('o'));
	const valid = $derived(Number.isInteger(y) && y >= 2000 && y <= 2100);

	const load = $derived.by(() => {
		const data = session.data;
		void session.revision;
		if (!data || !valid) return null;
		return (async () => {
			const files = await data.calendars();
			const years = [...files.values()].map((f) => f.doc.year).sort((a, b) => a - b);
			const held = files.get(calendarPath(y));
			if (held) return { calendar: held.doc, sha: held.sha, years };
			// A new year starts from the nearest earlier year's periods.
			const before = years.filter((n) => n < y).at(-1);
			const previous = before ? files.get(calendarPath(before))?.doc : null;
			return { calendar: blankCalendar(y, previous), sha: null, years };
		})();
	});
</script>

{#if !valid}
	<PageHead title="No year given" />
	<div class="page">
		<div class="msg warn"><div>Open a school calendar from a class’s calendar.</div></div>
	</div>
{:else if load}
	{#await load}
		<PageHead title={null} />
		<div class="page"><div class="loading"><span></span><span></span><span></span></div></div>
	{:then { calendar, sha, years }}
		{#key `${y}:${sha}`}
			<CalendarEditor {calendar} {sha} {years} {o} />
		{/key}
	{:catch error}
		<PageHead title="Couldn’t open the school calendar" />
		<div class="page"><Failure {error} /></div>
	{/await}
{/if}
