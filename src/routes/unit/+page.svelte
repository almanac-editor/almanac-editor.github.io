<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import Failure from '#lib/components/Failure.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Lane from '#lib/components/Lane.svelte';
	import PageHead from '#lib/components/PageHead.svelte';
	import { formatDate } from '#lib/domain/deliveries.ts';
	import { planChanged } from '#lib/domain/planDiff.ts';
	import { timing } from '#lib/domain/lessonView.ts';
	import { lessonRefs, offeringEntries } from '#lib/domain/offerings.ts';
	import { join } from '#lib/domain/paths.ts';
	import { className, houseMap, houseOf, humanise, titleCase } from '#lib/house.ts';
	import { subjectOf } from '#lib/domain/layout.ts';
	import { tasksForOffering } from '#lib/domain/tasks.ts';
	import { leadOf, readNotification } from '#lib/domain/notification.ts';
	import { links } from '#lib/links.ts';
	import { session } from '#lib/session.svelte.ts';

	const u = $derived(page.url.searchParams.get('u') ?? '');
	const o = $derived(page.url.searchParams.get('o'));
	const t = $derived(page.url.searchParams.get('t'));

	const load = $derived.by(() => {
		const data = session.data;
		if (!data || !u) return null;
		return (async () => {
			const [unit, offerings] = await Promise.all([data.unit(u), data.offerings()]);
			const offering = o ? (offerings.find(([path]) => path === o)?.[1] ?? null) : null;
			if (o && !offering) throw new Error(`${o} is not an offering in this repo.`);
			const refs = lessonRefs(u, unit, offering, t);
			const lessons = await Promise.all(
				refs.map(async (ref) => {
					try {
						return { ref, lesson: (await data.lesson(join(u, ref))).doc };
					} catch {
						return { ref, lesson: null };
					}
				})
			);
			return {
				unit,
				offering,
				lessons,
				tasks: tasksForOffering(unit, offering?.id ?? null, offering ? t : null),
				entries: offeringEntries(u, offerings),
				names: new Map(offerings.map(([, x]) => [x.id, className(x)])),
				houses: houseMap(offerings)
			};
		})();
	});

	/**
	 * Per lesson: open feedback from every class's records, when this class
	 * last had it, the plan it had then, and whether the plan has changed
	 * since. Read after the lessons, only for the lessons shown, so the list
	 * never waits on them.
	 */
	const marks = $derived.by(() => {
		const data = session.data;
		const pending = load;
		if (!data || !pending) return null;
		return pending.then(({ lessons }) =>
			Promise.all(
				lessons.map(async ({ ref, lesson }) => {
					const held = await data.deliveries(join(u, ref)).catch(() => []);
					const open = held
						.flatMap((h) => h.record.deliveries)
						.flatMap((d) => d.feedback ?? [])
						.filter((f) => f.status === 'open').length;
					const mine = held.find((h) => o && h.offeringPath === o)?.record.deliveries ?? [];
					const taught =
						mine
							.map((d) => d.taught)
							.filter(Boolean)
							.at(-1) ?? null;
					const plan = mine.findLast((d) => d.plan)?.plan ?? null;
					const changed = !!(lesson && plan && planChanged(plan, lesson));
					return [ref, { open, taught, plan, changed }] as const;
				})
			).then((rows) => new Map(rows))
		);
	});
	/**
	 * In a class's context, the class's assessments that examine this unit,
	 * with the due date and weighting from each notification. Read after the
	 * page, so the lessons never wait on them.
	 */
	const specs = $derived.by(() => {
		const data = session.data;
		const pending = load;
		if (!data || !pending || !o) return null;
		return pending.then(async ({ offering }) => {
			if (!offering) return [];
			const names = await data.assessments(o);
			const found = await Promise.all(
				names.map(async (name) => {
					const spec = (await data.assessment(o, name).catch(() => null))?.doc;
					if (!spec?.units?.some((unit) => join(offering.subject, unit) === u)) return null;
					const text = await data.text(spec.notification).catch(() => null);
					const details = text ? readNotification(text).details : [];
					const detail = (re: RegExp) => {
						const d = details.find((x) => re.test(x.label));
						return d ? leadOf(d.text).lead : null;
					};
					return {
						name,
						title: spec.title,
						due: detail(/^(due|date)$/i),
						weight: detail(/^weighting$/i),
						marks: detail(/^(total\s+)?marks$/i)
					};
				})
			);
			return found.filter((x) => x !== null);
		});
	});
	type Specs = Awaited<NonNullable<typeof specs>>;
	let classSpecs = $state.raw<Specs>([]);
	$effect(() => {
		const pending = specs;
		classSpecs = [];
		pending
			?.then((list) => {
				if (specs === pending) classSpecs = list;
			})
			.catch(() => {});
	});

	type Marks = Awaited<NonNullable<typeof marks>>;
	let found = $state.raw<Marks | null>(null);
	$effect(() => {
		const pending = marks;
		found = null;
		pending
			?.then((m) => {
				if (marks === pending) found = m;
			})
			.catch(() => {});
	});

	function onkeydown(event: KeyboardEvent) {
		if (event.ctrlKey || event.metaKey || event.altKey || !u) return;
		if ((event.target as HTMLElement).closest('input, textarea, select, dialog[open]')) return;
		if (event.key === 'n') goto(links.newLesson(u, o, t));
		else if (event.key === 'e') goto(links.unitEdit(u, o, t));
	}
</script>

<svelte:window {onkeydown} />

{#if !u}
	<PageHead title="No unit given" />
	<div class="page">
		<div class="msg warn"><div>Open a unit from the list of classes.</div></div>
	</div>
{:else if load}
	{#await load}
		<PageHead title={null} />
		<div class="page"><div class="loading"><span></span><span></span><span></span></div></div>
	{:then { unit, offering, lessons, tasks, entries, names, houses }}
		{@const minutes = lessons.reduce((n, l) => n + (l.lesson?.duration_minutes ?? 0), 0)}
		{@const planned = unit.planned ?? []}
		<PageHead
			crumbs={[
				{ href: links.home(), label: offering ? className(offering) : titleCase(subjectOf(u)) },
				...(t ? [{ href: links.unit(u, o, t), label: t }] : [])
			]}
			title={unit.unit_title}
			lede={unit.description}
		>
			{#snippet actions()}
				{#if o}
					<a class="btn" href={links.calendar(o)}>
						<Icon name="calendar" size={16} /> Calendar
					</a>
					<a class="btn" href={links.editClass(o, u, t)}>
						<Icon name="pencil" size={16} /> Edit class
					</a>
				{/if}
				<a class="btn" href={links.coverage(u, o, t)}>
					<Icon name="check" size={16} /> Coverage
				</a>
				<a class="btn" href={links.unitEdit(u, o, t)} title="Edit unit (E)">
					<Icon name="pencil" size={16} /> Edit unit
				</a>
				<a class="btn solid" href={links.newLesson(u, o, t)} title="New lesson (N)">
					<Icon name="plus" size={16} /> New lesson
				</a>
			{/snippet}
			{#snippet meta()}
				<span>{lessons.length} lessons</span>
				{#if planned.length}<span>{planned.length} planned, not yet written</span>{/if}
				<span>{Math.round(minutes / 6) / 10} hours of class time</span>
				<span>{offering ? `In ${className(offering)}’s order` : 'In the unit’s own order'}</span>
			{/snippet}
			<nav class="views" aria-label="Whose order">
				<a href={links.unit(u)} aria-current={!o ? 'page' : undefined} data-house="none">
					Every plan
				</a>
				{#each entries as entry, i (i)}
					<a
						href={links.unit(u, entry.path, entry.term)}
						aria-current={o === entry.path && t === entry.term ? 'page' : undefined}
						data-house={houseOf(entry.path, houses)}
					>
						<span class="sw" aria-hidden="true"></span>
						{className(entry.offering)}{entry.term ? ` · ${entry.term}` : ''}
					</a>
				{/each}
			</nav>
		</PageHead>

		<div class="page">
			<div class="legend" aria-hidden="true">
				<span><i class="k talk"></i>Talk</span>
				<span><i class="k act"></i>Activity</span>
				<span><i class="k str"></i>Stretch</span>
				<span><i class="k fin"></i>Lesson length</span>
			</div>
			<ol class="lanes">
				{#each lessons as { ref, lesson }, i (ref)}
					<li>
						{#if lesson}
							{@const mark = found?.get(ref)}
							<!-- In a class's context, a lesson the class has had shows as it had it. -->
							{@const plan = mark?.plan ?? lesson}
							{@const tm = timing(plan)}
							<a href={links.lesson(u, ref, o, t)} class="lane-row">
								<span class="num">{String(i + 1).padStart(2, '0')}</span>
								<span class="what">
									<span class="title">{plan.title}</span>
									<span class="sub">
										{plan.duration_minutes} min · {tm.talk} talk · {tm.activity} activity
										{#if tm.nominal && tm.total !== tm.nominal}
											<strong class="off">
												· {tm.total > tm.nominal
													? `${tm.total - tm.nominal} min over`
													: `${tm.nominal - tm.total} min spare`}
											</strong>
										{/if}
										{#if mark?.taught}
											<span class="taught">· Taught {formatDate(mark.taught)}</span>
										{/if}
										{#if mark?.changed}
											<span class="taught">· Plan changed since</span>
										{/if}
										{#if mark?.open}
											<span class="fb">· {mark.open} feedback</span>
										{/if}
									</span>
								</span>
								<span class="bar"
									><Lane sections={plan.sections} nominal={plan.duration_minutes} compact /></span
								>
							</a>
						{:else}
							<div class="lane-row missing">
								<span class="num">{String(i + 1).padStart(2, '0')}</span>
								<span class="what">
									<span class="title">{humanise(ref.split('/').pop() ?? ref)}</span>
									<span class="sub">Listed, but <code>{ref}</code> is not in the repo.</span>
								</span>
							</div>
						{/if}
					</li>
				{:else}
					{#if !planned.length}
						<li class="empty">
							No lesson plans yet. <a href={links.newLesson(u, o, t)}>Write the first one</a>, or
							press <kbd>N</kbd>.
						</li>
					{/if}
				{/each}
				<!-- Agreed but not written: the unit's `planned`, after every written plan. -->
				{#each planned as item, i (i)}
					<li>
						<div class="lane-row planned">
							<span class="num">{String(lessons.length + i + 1).padStart(2, '0')}</span>
							<span class="what">
								<span class="title">{item.title}</span>
								<span class="sub">
									<span class="pill">Planned</span>
									{#if item.ids?.length}· {item.ids.join(', ')}{/if}
								</span>
								{#if item.note}<span class="note">{item.note}</span>{/if}
							</span>
						</div>
					</li>
				{/each}
			</ol>

			<section class="tasks" aria-labelledby="tasks-head">
				<div class="tasks-top">
					<h2 id="tasks-head">Assessment tasks</h2>
					<a class="btn" href={links.unitTasks(u, o, t)}>
						<Icon name="pencil" size={16} /> Edit tasks
					</a>
				</div>
				{#if classSpecs.length && o}
					<ul class="specs">
						{#each classSpecs as s (s.name)}
							<li>
								<a href={links.assessment(o, s.name)}>
									<span class="spec-due">{s.due ?? 'No date'}</span>
									<span class="spec-what">
										<span class="task-title">{s.title}</span>
										<span class="sub">
											{[s.weight, s.marks ? `${s.marks} marks` : '', 'Notification and rubric']
												.filter(Boolean)
												.join(' · ')}
										</span>
									</span>
									<Icon name="right" size={18} />
								</a>
							</li>
						{/each}
					</ul>
				{/if}
				{#if tasks.length}
					<ul>
						{#each tasks as task, i (i)}
							<li>
								<span class="task-title">{task.title}</span>
								<span class="sub">
									{[
										task.assessment_type,
										task.weight !== undefined ? `${task.weight}%` : '',
										task.class_minutes ? `${task.class_minutes} min of class time` : '',
										!offering && task.offerings
											? `Only ${task.offerings.map((id) => names.get(id) ?? id).join(', ')}`
											: '',
										!offering && task.term ? `${task.term} cohort` : ''
									]
										.filter(Boolean)
										.join(' · ')}
								</span>
							</li>
						{/each}
					</ul>
				{:else if !classSpecs.length}
					<p class="sub">
						{offering
							? `${className(offering)} sits none of this unit’s tasks.`
							: 'No assessment tasks yet.'}
					</p>
				{/if}
			</section>
		</div>
	{:catch error}
		<PageHead title="Could not open this unit" />
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

	/* The tabs sit inside the header, so they read the page's text colour, not their own house. */
	.views a {
		--sw: var(--house);
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

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 18px;
		justify-content: flex-end;
		font-size: 12px;
		color: var(--muted);
		margin-bottom: 10px;
	}

	.legend span {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}

	.k {
		display: inline-block;
		width: 16px;
		height: 10px;
	}

	.k.talk {
		background: var(--house);
	}

	.k.act {
		background:
			repeating-linear-gradient(
				135deg,
				color-mix(in oklab, var(--house) 35%, transparent) 0 2px,
				transparent 2px 5px
			),
			var(--house-soft);
	}

	.k.str {
		outline: 2px dashed var(--house);
		outline-offset: -2px;
	}

	.k.fin {
		width: 3px;
		height: 14px;
		background: var(--ink);
	}

	.lanes {
		list-style: none;
		margin: 0;
		padding: 0;
		border-top: 2px solid var(--ink);
	}

	.lane-row {
		display: grid;
		grid-template-columns: 64px minmax(0, 1fr) minmax(160px, 38%);
		gap: 6px 20px;
		align-items: center;
		padding: 14px 4px;
		border-bottom: 1px solid var(--rule);
		text-decoration: none;
		transition: background-color 160ms var(--ease);
	}

	a.lane-row:hover {
		background: var(--house-soft);
	}

	a.lane-row:hover .title {
		text-decoration: underline;
		text-decoration-thickness: 2px;
		text-underline-offset: 0.18em;
	}

	.num {
		font-size: 40px;
		font-weight: 900;
		font-stretch: 70%;
		line-height: 0.85;
		letter-spacing: -0.03em;
		color: var(--house);
	}

	.missing .num,
	.planned .num {
		color: var(--rule-strong);
	}

	.planned .title {
		color: var(--ink-2);
	}

	.pill {
		display: inline-block;
		padding: 0 6px;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		border: 1px solid var(--rule-strong);
		color: var(--ink-2);
	}

	.note {
		font-size: 13px;
		color: var(--ink-2);
		max-width: 72ch;
	}

	.what {
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-width: 0;
	}

	.title {
		font-size: 18px;
		font-weight: 750;
		font-stretch: 88%;
		line-height: 1.2;
	}

	.sub {
		font-size: 13px;
		color: var(--muted);
	}

	.off {
		color: var(--warn);
	}

	.fb {
		color: var(--note-deep);
		font-weight: 600;
	}

	.taught {
		color: var(--house-deep);
		font-weight: 600;
	}

	.bar {
		padding: 6px 0;
	}

	.empty {
		padding: 18px 4px;
		color: var(--ink-2);
	}

	.tasks {
		margin-top: 36px;
	}

	.tasks-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding-bottom: 8px;
		border-bottom: 2px solid var(--ink);
	}

	.tasks h2 {
		margin: 0;
	}

	.tasks ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.tasks li {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 12px 4px;
		border-bottom: 1px solid var(--rule);
	}

	.task-title {
		font-weight: 750;
	}

	.specs {
		margin-bottom: 8px !important;
	}

	.specs li {
		padding: 0 !important;
	}

	.specs a {
		display: grid;
		grid-template-columns: minmax(120px, 190px) minmax(0, 1fr) auto;
		gap: 4px 18px;
		align-items: center;
		padding: 14px 4px;
		text-decoration: none;
		transition: background-color 160ms var(--ease);
	}

	.specs a:hover {
		background: var(--house-soft);
	}

	.spec-due {
		font-size: 17px;
		font-weight: 850;
		font-stretch: 78%;
		line-height: 1.1;
		color: var(--house-deep);
	}

	.spec-what {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	@media (max-width: 640px) {
		.specs a {
			grid-template-columns: minmax(0, 1fr) auto;
		}

		.spec-due {
			grid-column: 1 / -1;
		}
	}

	.tasks > .sub {
		padding: 12px 4px;
	}

	@media (max-width: 720px) {
		.lane-row {
			grid-template-columns: 48px minmax(0, 1fr);
		}

		.num {
			font-size: 30px;
		}

		.bar {
			grid-column: 2;
		}
	}
</style>
