<script lang="ts">
	// A year's school calendar: periods, terms and days off, saved as
	// calendar/<year>.json. A year without a file is created on its first save.
	import { beforeNavigate, goto } from '$app/navigation';
	import Icon from './Icon.svelte';
	import PageHead from './PageHead.svelte';
	import {
		calendarProblems,
		fromCalendarDraft,
		newDayOff,
		newPeriod,
		newTerm,
		toCalendarDraft,
		type CalendarDraft
	} from '#lib/domain/calendarEdit.ts';
	import { calendarPath } from '#lib/domain/layout.ts';
	import { AuthError, ConflictError } from '#lib/domain/repo.ts';
	import type { SchoolCalendar } from '#lib/domain/types.ts';
	import { links } from '#lib/links.ts';
	import { session } from '#lib/session.svelte.ts';

	let {
		calendar,
		sha,
		years,
		o = null
	}: {
		calendar: SchoolCalendar;
		/** Null for a year with no file yet. */
		sha: string | null;
		/** The years that have a calendar. */
		years: number[];
		/** The class whose calendar it was opened from, to go back to. */
		o?: string | null;
	} = $props();

	// svelte-ignore state_referenced_locally
	let draft = $state<CalendarDraft>(toCalendarDraft(calendar));
	// svelte-ignore state_referenced_locally
	let baseline = $state(JSON.stringify(toCalendarDraft(calendar)));
	let saving = $state(false);
	let problem = $state<string | null>(null);
	const year = $derived(calendar.year);
	const dirty = $derived(sha === null || JSON.stringify(draft) !== baseline);
	const problems = $derived(calendarProblems(draft));
	const where = $derived(session.source === 'github' ? 'on GitHub' : 'on disk');
	const back = $derived(o ? links.calendar(o) : links.home());
	const shownYears = $derived(
		[...new Set([...years, year, (years.at(-1) ?? year) + 1])].sort((a, b) => a - b)
	);

	async function save() {
		const data = session.data;
		if (!data || saving || !dirty || problems.length) return;
		problem = null;
		saving = true;
		try {
			const next = fromCalendarDraft(calendar, $state.snapshot(draft) as CalendarDraft);
			const message = sha ? `Edit ${year} school calendar` : `Add ${year} school calendar`;
			await data.saveCalendar(next, sha, message);
			baseline = JSON.stringify(draft);
			session.revision += 1;
			await goto(back);
		} catch (error) {
			problem =
				error instanceof ConflictError
					? `Not saved: ${calendarPath(year)} changed ${where} after you opened it. Copy what you need, then reload the page.`
					: error instanceof AuthError
						? 'Not saved. GitHub no longer accepts the token. Copy your edits, then add a new token in Settings.'
						: `Not saved. ${(error as Error).message}`;
		} finally {
			saving = false;
		}
	}

	function onkeydown(event: KeyboardEvent) {
		if ((event.metaKey || event.ctrlKey) && event.key === 's') {
			event.preventDefault();
			save();
		}
	}

	beforeNavigate(({ cancel, willUnload, to }) => {
		// Leaving an unsaved new year untouched loses nothing.
		const touched = JSON.stringify(draft) !== baseline;
		if (to?.url.pathname.endsWith('/calendar-edit') && !touched) return;
		if (
			touched &&
			!willUnload &&
			!confirm('Leave without saving? Your edits to this calendar will be lost.')
		) {
			cancel();
		}
	});
</script>

<svelte:window
	{onkeydown}
	onbeforeunload={(e) => JSON.stringify(draft) !== baseline && e.preventDefault()}
/>

<PageHead
	crumbs={o ? [{ href: back, label: 'Calendar' }] : [{ href: links.home(), label: 'Classes' }]}
	title="School calendar {year}"
	lede="The periods of the day, the terms and the days without normal lessons. Every class’s calendar is laid over it."
>
	{#snippet meta()}
		<span>{calendarPath(year)}</span>
		<span>{sha ? 'Saved' : 'Not saved yet'}</span>
	{/snippet}
	<nav class="views" aria-label="Year">
		{#each shownYears as n (n)}
			<a href={links.calendarEdit(n, o)} aria-current={n === year ? 'page' : undefined}>
				{n}{years.includes(n) ? '' : ' (new)'}
			</a>
		{/each}
	</nav>
</PageHead>

<div class="page">
	<form
		onsubmit={(event) => {
			event.preventDefault();
			save();
		}}
	>
		{#if !sha}
			<div class="msg note">
				<div>
					There is no calendar for {year} yet.
					{draft.periods.length
						? 'It starts with the periods of the year before.'
						: 'Add the periods of the day, then the terms.'}
				</div>
			</div>
		{/if}

		<section>
			<h2>Periods</h2>
			<p class="hint">
				The school day, in order. A class’s timetable names them by their short name.
			</p>
			<ol class="rows">
				{#each draft.periods as period, i (i)}
					<li class="period">
						<label class="field">
							<span>Short name</span>
							<input type="text" bind:value={period.id} placeholder="P1" required />
						</label>
						<label class="field">
							<span>Name</span>
							<input type="text" bind:value={period.name} placeholder="Period 1" />
						</label>
						<label class="field">
							<span>Starts</span>
							<input type="time" bind:value={period.start} />
						</label>
						<label class="field">
							<span>Ends</span>
							<input type="time" bind:value={period.end} />
						</label>
						<button
							type="button"
							class="quiet icon danger"
							title="Remove"
							aria-label="Remove {period.id || `period ${i + 1}`}"
							onclick={() => draft.periods.splice(i, 1)}><Icon name="bin" /></button
						>
					</li>
				{/each}
			</ol>
			<button type="button" onclick={() => draft.periods.push(newPeriod(draft.periods.length + 1))}>
				<Icon name="plus" size={16} /> Add a period
			</button>
		</section>

		<section>
			<h2>Terms</h2>
			<p class="hint">
				Days outside every term are holidays. For a fortnightly timetable, say whether a term opens
				on Week A or Week B; weeks then alternate from its first Monday.
			</p>
			<ol class="rows">
				{#each draft.terms as term, i (i)}
					<li class="term">
						<label class="field">
							<span>Name</span>
							<input type="text" bind:value={term.name} placeholder="Term 1" required />
						</label>
						<label class="field">
							<span>First day</span>
							<input type="date" bind:value={term.start} required />
						</label>
						<label class="field">
							<span>Last day</span>
							<input type="date" bind:value={term.end} required />
						</label>
						<label class="field">
							<span>Opens on</span>
							<select bind:value={term.first_week}>
								<option value="">Week A</option>
								<option value="B">Week B</option>
								{#if term.first_week === 'A'}<option value="A">Week A (as written)</option>{/if}
							</select>
						</label>
						<button
							type="button"
							class="quiet icon danger"
							title="Remove"
							aria-label="Remove {term.name || `term ${i + 1}`}"
							onclick={() => draft.terms.splice(i, 1)}><Icon name="bin" /></button
						>
					</li>
				{/each}
			</ol>
			<button type="button" onclick={() => draft.terms.push(newTerm(draft.terms.length + 1))}>
				<Icon name="plus" size={16} /> Add a term
			</button>
		</section>

		<section>
			<h2>Days off</h2>
			<p class="hint">
				Days or periods in a term with no normal lessons: public holidays, staff days, carnivals,
				exams. Leave the periods empty for the whole day, and the year groups empty for everyone.
			</p>
			<ol class="rows">
				{#each draft.days_off as off, i (i)}
					<li class="off">
						<label class="field wide">
							<span>What</span>
							<input type="text" bind:value={off.title} placeholder="Swimming carnival" required />
						</label>
						<label class="field">
							<span>From</span>
							<input type="date" bind:value={off.start} required />
						</label>
						<label class="field">
							<span>To</span>
							<input type="date" bind:value={off.end} min={off.start} />
						</label>
						<label class="field">
							<span>Periods</span>
							<input type="text" bind:value={off.periods} placeholder="All day" />
						</label>
						<label class="field">
							<span>Year groups</span>
							<input type="text" bind:value={off.year_groups} placeholder="Everyone" />
						</label>
						<button
							type="button"
							class="quiet icon danger"
							title="Remove"
							aria-label="Remove {off.title || `day off ${i + 1}`}"
							onclick={() => draft.days_off.splice(i, 1)}><Icon name="bin" /></button
						>
					</li>
				{/each}
			</ol>
			<button type="button" onclick={() => draft.days_off.push(newDayOff())}>
				<Icon name="plus" size={16} /> Add a day off
			</button>
		</section>

		<div class="dock">
			{#if problem}<div class="msg warn"><div>{problem}</div></div>{/if}
			{#if problems.length}
				<div class="msg warn">
					<div>
						{#each problems as p, i (i)}<p>{p}</p>{/each}
					</div>
				</div>
			{/if}
			<div class="actions">
				<button
					class="primary go"
					type="submit"
					disabled={saving || !dirty || problems.length > 0 || !session.active}
				>
					{saving ? 'Saving…' : sha ? 'Save calendar' : `Add ${year}’s calendar`}
					<kbd>Ctrl S</kbd>
				</button>
				<a class="btn quiet" href={back}>{dirty && sha ? 'Discard' : 'Back'}</a>
				<span class="state">
					{JSON.stringify(draft) !== baseline ? 'Unsaved changes' : sha ? 'No changes' : ''}
				</span>
			</div>
		</div>
	</form>
</div>

<style>
	form {
		max-width: 960px;
	}

	section {
		margin: 0 0 40px;
	}

	h2 {
		margin: 0 0 4px;
	}

	.hint {
		margin: 0 0 14px;
		font-size: 13px;
		color: var(--muted);
		max-width: 68ch;
	}

	.rows {
		list-style: none;
		margin: 0 0 14px;
		padding: 0;
		border-top: 2px solid var(--ink);
	}

	.rows:empty {
		border-top-width: 0;
	}

	.rows li {
		display: grid;
		gap: 10px;
		align-items: end;
		padding: 12px 0;
		border-bottom: 1px solid var(--rule);
	}

	.rows .period {
		grid-template-columns: 110px minmax(0, 1fr) 130px 130px 32px;
	}

	.rows .term {
		grid-template-columns: minmax(0, 1fr) 160px 160px 140px 32px;
	}

	.rows .off {
		grid-template-columns: minmax(0, 1.4fr) 150px 150px minmax(0, 0.8fr) minmax(0, 1fr) 32px;
	}

	.danger:hover:not(:disabled) {
		color: var(--warn);
	}

	.views {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-top: 18px;
	}

	.views a {
		padding: 6px 12px;
		font-size: 13px;
		font-weight: 700;
		color: inherit;
		text-decoration: none;
		background: color-mix(in oklab, currentColor 10%, transparent);
	}

	.views a[aria-current='page'] {
		background: var(--chalk);
		color: var(--ink);
	}

	.dock {
		position: sticky;
		bottom: 0;
		z-index: 5;
		padding: 14px 0 12px;
		background: linear-gradient(transparent, var(--chalk) 14px);
	}

	.dock .msg {
		margin: 0 0 8px;
	}

	.dock .msg p {
		margin: 0;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
	}

	.go {
		min-height: 44px;
		padding: 0 22px;
		font-size: 15px;
	}

	.go kbd {
		font-size: 10px;
	}

	.state {
		margin-left: auto;
		font-size: 13px;
		color: var(--muted);
	}

	@media (max-width: 760px) {
		.rows .period,
		.rows .term,
		.rows .off {
			grid-template-columns: 1fr 1fr;
		}

		.rows li > button {
			justify-self: start;
		}

		.go kbd {
			display: none;
		}
	}
</style>
