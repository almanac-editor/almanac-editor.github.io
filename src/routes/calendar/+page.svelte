<script lang="ts">
	// One class's year on a month grid: lessons on the dates they were taught,
	// the rest on the dates the class's periods give them (schedule.ts). Reads
	// the school calendars and this class's delivery records only.
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import { Calendar, DayGrid, List } from '@event-calendar/core';
	import '@event-calendar/core/index.css';
	import Failure from '#lib/components/Failure.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import PageHead from '#lib/components/PageHead.svelte';
	import { formatDate, today } from '#lib/domain/deliveries.ts';
	import { join } from '#lib/domain/paths.ts';
	import {
		addDays,
		classOrder,
		daysOffOn,
		isFortnightly,
		planClass,
		taughtDates,
		teachingSlots,
		weekLabel,
		type PlanItem
	} from '#lib/domain/schedule.ts';
	import type { SchoolCalendar } from '#lib/domain/types.ts';
	import { className, humanise } from '#lib/house.ts';
	import { links } from '#lib/links.ts';
	import { session } from '#lib/session.svelte.ts';

	const o = $derived(page.url.searchParams.get('o') ?? '');

	/** `YYYY-MM-DD` of a Date the calendar hands over, read in local time. */
	function iso(date: Date): string {
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
	}

	/** `01_what_is_data.json` -> `01`; null for a name with no number. */
	const numberOf = (ref: string) => ref.split('/').pop()?.match(/^\d+/)?.[0] ?? null;

	type Kind = 'taught' | 'planned' | 'unmarked';
	type Shown = {
		kind: Kind;
		date: string;
		period: string | null;
		label: string;
		unit: string;
		href: string;
	};
	const lessonOf = (event: Calendar.Event) => event.extendedProps as Shown;

	const load = $derived.by(() => {
		const data = session.data;
		void session.revision;
		if (!data || !o) return null;
		return (async () => {
			const [offerings, units, held, files] = await Promise.all([
				data.offerings(),
				data.units(),
				data.classDeliveries(o),
				data.calendars()
			]);
			const offering = offerings.find(([path]) => path === o)?.[1];
			if (!offering) throw new Error(`${o} is not a class in these files.`);
			const calendars: SchoolCalendar[] = [...files.values()].map((f) => f.doc);
			const unitMap = new Map(units.map((u) => [u.dir, u.unit]));
			const title = (dir: string) =>
				unitMap.get(dir)?.unit_title ?? humanise(dir.split('/').pop() ?? dir);

			const taught = taughtDates(held.map((h) => h.record));
			const timetable = offering.timetable ?? [];
			const slots = teachingSlots(calendars, timetable, offering.year_group ?? null);
			const now = today();
			const plan = planClass(classOrder(offering, unitMap), taught, slots, now);

			const shown = (item: PlanItem, kind: Kind, date: string, period: string | null): Shown => {
				const n = numberOf(item.ref);
				return {
					kind,
					date,
					period,
					label: `${n ? n + ' ' : ''}${humanise(item.ref.split('/').pop() ?? item.ref)}`,
					unit: title(item.unitDir),
					href: links.lesson(item.unitDir, item.ref, o, item.term)
				};
			};
			const unmarked = new Set(plan.unmarked);
			const lessons: Shown[] = [
				...plan.taught.map((p) => shown(p.item, 'taught', p.date, p.period)),
				...plan.planned.map((p) =>
					shown(p.item, unmarked.has(p) ? 'unmarked' : 'planned', p.date, p.period)
				)
			];
			// Taught, but not in the class's order: find the unit by its directory.
			const subjectDirs = units
				.map((u) => u.dir)
				.filter((d) => d.startsWith(offering.subject + '/'));
			for (const { subjectRef, date } of plan.elsewhere) {
				const path = join(offering.subject, subjectRef);
				const unitDir = subjectDirs
					.filter((d) => path.startsWith(d + '/'))
					.sort((a, b) => b.length - a.length)[0];
				if (!unitDir) continue;
				const ref = path.slice(unitDir.length + 1);
				const item = { path, unitDir, ref, subjectRef, term: null, start: null, end: null };
				lessons.push(shown(item, 'taught', date, null));
			}

			const years = new Set(calendars.map((c) => c.year));
			return {
				offering,
				calendars,
				lessons,
				plan,
				now,
				fortnight: isFortnightly(timetable),
				hasTimetable: timetable.length > 0,
				missingYear: years.has(offering.year) ? null : offering.year,
				shown
			};
		})();
	});

	/** School holidays between terms, as background days. */
	function holidays(calendars: SchoolCalendar[]) {
		const terms = calendars
			.flatMap((c) => c.terms ?? [])
			.toSorted((a, b) => (a.start < b.start ? -1 : 1));
		const out: { start: string; end: string; title: string }[] = [];
		for (let i = 1; i < terms.length; i++) {
			const start = addDays(terms[i - 1].end, 1);
			if (start < terms[i].start) out.push({ start, end: terms[i].start, title: 'Holidays' });
		}
		return out;
	}

	function options(loaded: NonNullable<Awaited<typeof load>>): Calendar.Options {
		const { calendars, lessons, now, offering } = loaded;
		// Read once: the month in the URL follows the calendar, not the other way round.
		const fromUrl = untrack(() => page.url.searchParams.get('m'));
		const firstLesson = lessons.map((l) => l.date).toSorted()[0];
		const inYear = calendars.some((c) => c.year === Number(now.slice(0, 4)));
		const start = fromUrl?.match(/^\d{4}-\d{2}$/)
			? `${fromUrl}-01`
			: inYear || !firstLesson
				? now
				: firstLesson;
		const offs = calendars
			.flatMap((c) => c.days_off ?? [])
			.filter((d) => {
				return !d.year_groups?.length || d.year_groups.includes(offering.year_group ?? '');
			});
		return {
			view: 'dayGridMonth',
			date: start,
			locale: 'en-AU',
			firstDay: 1,
			hiddenDays: [0, 6],
			height: 'auto',
			dayMaxEvents: false,
			weekNumbers: calendars.length > 0,
			headerToolbar: { start: 'prev,next today', center: 'title', end: 'dayGridMonth,listMonth' },
			buttonText: { today: 'Today', dayGridMonth: 'Month', listMonth: 'List' },
			noEventsContent: 'No lessons this month.',
			eventOrder: (a, b) => (lessonOf(a).period ?? '').localeCompare(lessonOf(b).period ?? ''),
			events: [
				...lessons.map((l, i) => ({
					id: `l${i}`,
					start: l.date,
					end: l.date,
					allDay: true,
					title: l.label,
					classNames: [`is-${l.kind}`],
					extendedProps: l
				})),
				...offs.map((d, i) => ({
					id: `off${i}`,
					start: d.start,
					end: addDays(d.end || d.start, 1),
					allDay: true,
					display: 'background' as const,
					classNames: [d.periods?.length ? 'is-part-off' : 'is-off']
				})),
				...holidays(calendars).map((h, i) => ({
					id: `hol${i}`,
					...h,
					allDay: true,
					display: 'background' as const,
					classNames: ['is-holiday']
				}))
			],
			datesSet: (info) => {
				view = info.view.type;
				const month = iso(info.view.currentStart).slice(0, 7);
				untrack(() => {
					if (page.url.searchParams.get('m') !== month) {
						replaceState(links.calendar(o, month), page.state);
					}
				});
			}
		};
	}

	/** The calendar's view; the day cells carry the date and days off in the month grid only. */
	let view = $state('dayGridMonth');

	const kindName: Record<Kind, string> = {
		taught: 'Taught',
		planned: 'Planned',
		unmarked: 'Not marked taught'
	};
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
	{:then loaded}
		{@const { offering, calendars, plan, fortnight, hasTimetable, missingYear, shown } = loaded}
		<PageHead
			crumbs={[{ href: links.home(), label: className(offering) }]}
			title="Calendar"
			lede="Lessons on the days they were taught, and the rest on the class’s next free periods."
		>
			{#snippet actions()}
				<a class="btn" href={links.editClass(o)}><Icon name="pencil" size={16} /> Edit class</a>
				<a class="btn" href={links.calendarEdit(offering.year, o)}>
					<Icon name="calendar" size={16} /> School calendar
				</a>
			{/snippet}
			{#snippet meta()}
				<span>{plan.taught.length} taught</span>
				<span>{plan.planned.length - plan.unmarked.length} planned</span>
				{#if plan.unmarked.length}<span>{plan.unmarked.length} not marked taught</span>{/if}
			{/snippet}
		</PageHead>

		<div class="page">
			{#if missingYear !== null}
				<div class="msg note">
					<div>
						There is no school calendar for {missingYear} yet, so only taught lessons are shown.
						<a href={links.calendarEdit(missingYear, o)}>Add {missingYear}’s terms</a>.
					</div>
				</div>
			{:else if !hasTimetable}
				<div class="msg note">
					<div>
						This class has no periods set, so only taught lessons are shown.
						<a href={links.editClass(o)}>Set its periods</a>.
					</div>
				</div>
			{/if}

			<div class="legend" aria-hidden="true">
				<span><i class="k taught"></i>Taught</span>
				<span><i class="k planned"></i>Planned</span>
				<span><i class="k unmarked"></i>Not marked taught</span>
				<span><i class="k off"></i>Day off or holidays</span>
			</div>

			<div class="cal">
				<Calendar plugins={[DayGrid, List]} options={options(loaded)}>
					{#snippet eventContent({ event }: Calendar.EventContentInfo)}
						{@const l = lessonOf(event)}
						<a class="ev" href={l.href} title="{kindName[l.kind]}: {l.label} ({l.unit})">
							{#if l.period}<span class="p">{l.period}</span>{/if}
							<span class="t">{l.label}</span>
							<span class="sr">{kindName[l.kind]}, {l.unit}</span>
						</a>
					{/snippet}
					{#snippet dayCellContent({ date }: Calendar.DayCellContentArg)}
						{#if view === 'dayGridMonth'}
							{@const offs = daysOffOn(iso(date), calendars, offering.year_group ?? '')}
							<span class="dn">{date.getDate()}</span>
							{#each offs as off, i (i)}
								<span class="off"
									>{off.title}{off.periods?.length ? ` (${off.periods.join(', ')})` : ''}</span
								>
							{/each}
						{/if}
					{/snippet}
					{#snippet weekNumberContent({ date }: Calendar.WeekNumberContentArg)}
						{[0, 1, 2, 3, 4]
							.map((n) => weekLabel(addDays(iso(date), n), calendars, fortnight))
							.find(Boolean) ?? ''}
					{/snippet}
				</Calendar>
			</div>

			{#if plan.unmarked.length}
				<div class="section-h">
					<h2>Not marked taught</h2>
					<p>Planned for a day already past. Mark them taught, or the class is behind.</p>
				</div>
				<ol class="rows">
					{#each plan.unmarked as p, i (i)}
						{@const l = shown(p.item, 'unmarked', p.date, p.period)}
						<li>
							<span class="lead">{formatDate(p.date)}</span>
							<a href={l.href}>{l.label}</a>
							<span class="u">{l.unit}</span>
						</li>
					{/each}
				</ol>
			{/if}

			{#if plan.late.length}
				<div class="section-h">
					<h2>Running past the unit’s end date</h2>
				</div>
				<ol class="rows">
					{#each plan.late as p, i (i)}
						{@const l = shown(p.item, 'planned', p.date, p.period)}
						<li>
							<span class="lead">{formatDate(p.date)}</span>
							<a href={l.href}>{l.label}</a>
							<span class="u">{l.unit}, ends {formatDate(p.item.end ?? '')}</span>
						</li>
					{/each}
				</ol>
			{/if}

			{#if plan.unplaced.length && hasTimetable && calendars.length}
				<div class="section-h">
					<h2>No periods left</h2>
					<p>The calendar runs out before these lessons.</p>
				</div>
				<ol class="rows">
					{#each plan.unplaced as item, i (i)}
						{@const l = shown(item, 'planned', '', null)}
						<li>
							<span class="lead">{numberOf(item.ref) ?? ''}</span>
							<a href={l.href}>{l.label}</a>
							<span class="u">{l.unit}</span>
						</li>
					{/each}
				</ol>
			{/if}
		</div>
	{:catch error}
		<PageHead title="Couldn’t open the calendar" />
		<div class="page"><Failure {error} /></div>
	{/await}
{/if}

<style>
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 18px;
		margin: 0 0 14px;
		font-size: 13px;
		font-weight: 600;
		color: var(--ink-2);
	}

	.legend span {
		display: inline-flex;
		align-items: center;
		gap: 7px;
	}

	.k {
		width: 12px;
		height: 12px;
		display: inline-block;
	}

	.k.taught {
		background: var(--house);
	}

	.k.planned {
		background: var(--paper);
		outline: 2px dashed var(--house);
		outline-offset: -2px;
	}

	.k.unmarked {
		background: var(--warn-soft);
		outline: 2px dashed var(--warn);
		outline-offset: -2px;
	}

	.k.off {
		background: var(--sunk);
	}

	/* The library's grid, in house terms: square, flat, ruled. */
	.cal {
		--ec-bg-color: var(--paper);
		--ec-text-color: var(--ink);
		--ec-border-color: var(--rule);
		--ec-today-bg-color: var(--house-soft);
		--ec-highlight-color: var(--house-soft);
		--ec-button-bg-color: var(--paper);
		--ec-button-border-color: var(--rule-strong);
		--ec-button-text-color: var(--ink);
		--ec-button-active-bg-color: var(--ink);
		--ec-button-active-border-color: var(--ink);
		--ec-button-active-text-color: var(--chalk);
		--ec-event-bg-color: var(--house);
		--ec-event-text-color: var(--house-on);
		--ec-bg-event-color: var(--sunk);
		--ec-bg-event-opacity: 1;
		--ec-popup-bg-color: var(--paper);
		border-top: 2px solid var(--ink);
		font-family: var(--font);
	}

	.cal :global(.ec-toolbar) {
		padding: 12px 0;
		margin: 0;
	}

	.cal :global(.ec-title) {
		font-size: 22px;
		font-weight: 800;
		font-variation-settings: 'wdth' 80;
		letter-spacing: -0.015em;
	}

	.cal :global(.ec-button) {
		border-radius: 2px;
		height: 36px;
		padding: 0 14px;
		font: inherit;
		font-size: 14px;
		font-weight: 650;
	}

	.cal :global(.ec-button:hover) {
		border-color: var(--ink);
	}

	.cal :global(.ec-day-head) {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
	}

	.cal :global(.ec-week-number) {
		font-size: 11px;
		font-weight: 800;
		color: var(--house-deep);
		background: none;
	}

	.cal :global(.ec-event) {
		border-radius: 0;
		box-shadow: none;
		padding: 0;
	}

	.cal :global(.ec-event.is-taught) {
		background: var(--house);
		color: var(--house-on);
	}

	.cal :global(.ec-event.is-planned) {
		background: var(--paper);
		color: var(--house-deep);
		outline: 2px dashed var(--house);
		outline-offset: -2px;
	}

	.cal :global(.ec-event.is-unmarked) {
		background: var(--warn-soft);
		color: var(--warn-deep);
		outline: 2px dashed var(--warn);
		outline-offset: -2px;
	}

	.cal :global(.ec-bg-event.is-part-off) {
		background: repeating-linear-gradient(135deg, var(--sunk) 0 6px, transparent 6px 12px);
	}

	.dn {
		font-size: 15px;
		font-weight: 900;
		font-variation-settings: 'wdth' 70;
		font-variant-numeric: tabular-nums;
	}

	.off {
		font-size: 11px;
		font-weight: 600;
		color: var(--muted);
		line-height: 1.2;
	}

	.ev {
		display: flex;
		gap: 6px;
		align-items: baseline;
		width: 100%;
		padding: 3px 6px;
		color: inherit;
		text-decoration: none;
		font-size: 12px;
		line-height: 1.25;
		overflow: hidden;
	}

	.ev:hover .t {
		text-decoration: underline;
	}

	.ev .p {
		font-weight: 800;
		flex: none;
	}

	.ev .t {
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
		border-top: 2px solid var(--ink);
	}

	.rows li {
		display: grid;
		grid-template-columns: 120px 1fr auto;
		gap: 14px;
		align-items: baseline;
		padding: 12px 0;
		border-bottom: 1px solid var(--rule);
	}

	.rows .lead {
		font-size: 13px;
		font-weight: 800;
		color: var(--house-deep);
	}

	.rows a {
		font-size: 17px;
		font-weight: 750;
		font-variation-settings: 'wdth' 88;
		color: var(--ink);
	}

	.rows .u {
		font-size: 13px;
		color: var(--muted);
	}

	@media (max-width: 640px) {
		.rows li {
			grid-template-columns: 1fr;
			gap: 4px;
		}
	}
</style>
