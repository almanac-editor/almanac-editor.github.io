<script lang="ts">
	// One class's assessment task, edited where it reads. The page looks like
	// the assessment page: the house header with the details as figures, the
	// notification's sections drawn in order, the teacher notes folded at the
	// foot, and a side column of contents and checks. Click a section, or Edit
	// title and details, and that one part opens as a boxed editor with Done
	// and Cancel; everything else stays drawn. A bar at the foot keeps the
	// unsaved changes, what to check, and Save in reach.
	import { tick, untrack } from 'svelte';
	import { page } from '$app/state';
	import { beforeNavigate, goto } from '$app/navigation';
	import Failure from '#lib/components/Failure.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import type { TopicMark } from '#lib/components/Markdown.svelte';
	import PageHead from '#lib/components/PageHead.svelte';
	import SectionBlock from '#lib/components/SectionBlock.svelte';
	import {
		blankSection,
		classUnits,
		fromAssessmentDraft,
		joinTitle,
		rehalve,
		marksFromParts,
		headingFollows,
		splitFromParts,
		syncMarks,
		moveSection,
		newAssessmentDraft,
		newAssessmentPaths,
		overviewProblems,
		stemProblem,
		teacherDivider,
		titleParts,
		toAssessmentDraft,
		topicRows,
		type AssessmentDraft,
		type TaskSection
	} from '#lib/domain/assessmentEdit.ts';
	import {
		assessmentPath,
		specProblems,
		unitDir,
		type AssessmentSpec,
		type Registries
	} from '#lib/domain/assessments.ts';
	import { EditError } from '#lib/domain/lessonEdit.ts';
	import { leadOf } from '#lib/domain/notification.ts';
	import { leadNumber, marksProblems, type DetailRow } from '#lib/domain/notificationEdit.ts';
	import { forgetUndo, removing, undo, undoRemove } from '#lib/undo.svelte.ts';
	import { ConflictError, PartlySavedError } from '#lib/domain/repo.ts';
	import type { Offering, Unit } from '#lib/domain/types.ts';
	import { className, humanise } from '#lib/house.ts';
	import { links } from '#lib/links.ts';
	import { session } from '#lib/session.svelte.ts';

	const o = $derived(page.url.searchParams.get('o') ?? '');
	const a = $derived(page.url.searchParams.get('a'));

	interface Opened {
		offering: Offering;
		/** Every unit the class takes or the spec names, with its file (null where missing). */
		units: Map<string, Unit | null>;
		spec: { doc: AssessmentSpec; sha: string } | null;
		notification: { text: string; sha: string } | null;
		notes: string[];
		taken: Set<string>;
	}

	/** The labels every notification has; their names stay fixed. */
	const STANDARD = /^(due|date|weighting|marks?|time|teacher)$/i;

	let draft = $state<AssessmentDraft>({
		title: '',
		syncTitle: true,
		units: [],
		lead: '',
		sections: [],
		__spec: null
	});
	let baseline = $state('');
	let stem = $state('');
	let offeringId = $state('');
	let saving = $state(false);
	let problem = $state<string | null>(null);
	/** What is open for editing: a section's key, the title and details, or nothing. */
	let openKey = $state<number | 'head' | null>(null);
	/** What the open part held when it opened, for Cancel. */
	let before: string | null = null;
	let teacherOpen = $state(false);
	/** Escape was pressed in a changed section: asking whether to keep the changes. */
	let asking = $state(false);
	/** The opened task, for Ctrl/Cmd+S. */
	let openedNow = $state<Opened | null>(null);
	/** Details whose Small print field has been opened in the band. */
	let smallPrint = $state(new Set<number>());

	const load = $derived.by(() => {
		const data = session.data;
		void session.revision;
		if (!data || !o) return null;
		const name = a;
		return (async (): Promise<Opened> => {
			const offering = (await data.offerings()).find(([path]) => path === o)?.[1];
			if (!offering) throw new Error(`${o} is not a class in ${session.label}.`);
			const spec = name ? await data.assessment(o, name) : null;
			const note = spec ? await data.textFile(spec.doc.notification) : null;
			const names = [...new Set([...classUnits(offering), ...(spec?.doc.units ?? [])])];
			const units = new Map<string, Unit | null>(
				await Promise.all(
					names.map(
						async (u) => [u, await data.unit(unitDir(offering, u)).catch(() => null)] as const
					)
				)
			);
			let notes: string[] = [];
			let next: AssessmentDraft;
			if (spec) {
				const loaded = toAssessmentDraft(spec.doc, note?.doc ?? '');
				next = loaded.draft;
				const probe = toAssessmentDraft(spec.doc, note?.doc ?? '').draft;
				if (syncMarks(probe)) {
					loaded.notes.push(
						'Some marks in Task overview or the details didn’t match Marking criteria. They now follow it; save to keep that.'
					);
				}
				notes = note
					? loaded.notes
					: [`${spec.doc.notification} is not there yet. Saving makes it.`];
			} else {
				const subject = humanise(offering.subject.replace(/^subjects\//, '').split('/')[0] ?? '');
				next = newAssessmentDraft(offering, subject);
			}
			untrack(() => {
				offeringId = offering.id;
				draft = next;
				stem = '';
				problem = null;
				openKey = null;
				before = null;
				baseline = snapshot();
				remember();
				if (!spec) openPart('head');
			});
			const opened: Opened = {
				offering,
				units,
				spec,
				notification: note ? { text: note.doc, sha: note.sha } : null,
				notes,
				taken: new Set((await data.store.paths()).keys())
			};
			openedNow = opened;
			return opened;
		})();
	});

	/** What Save would compare: the draft's own fields, not where each piece came from. */
	const plain = (value: unknown): string =>
		JSON.stringify(value, (k, v) => (k.startsWith('__') || k === 'key' ? undefined : v));

	function snapshot(): string {
		return JSON.stringify([draft.title, draft.units, JSON.parse(plain(draft.sections)), stem]);
	}

	/** Each section as loaded or last saved, by key, to mark the ones that changed. */
	let savedSections = $state(new Map<number, string>());
	const remember = () => {
		savedSections = new Map(draft.sections.map((s) => [s.key, plain(s)]));
	};

	const dirty = $derived(baseline !== '' && snapshot() !== baseline);

	/** The sections (and the title and details) that differ from the file: what Save would write. */
	const changedKeys = $derived.by(() => {
		void snapshot();
		return new Set(
			draft.sections.filter((s) => savedSections.get(s.key) !== plain(s)).map((s) => s.key)
		);
	});

	/** The changed parts by name, for the save bar: "Marking criteria, Task overview". */
	const changedNames = $derived.by(() => {
		const names: string[] = [];
		let head = false;
		for (const s of draft.sections) {
			if (!changedKeys.has(s.key)) continue;
			if (s.role === 'title' || s.role === 'subject') head = true;
			else names.push(s.heading || 'an untitled section');
		}
		const removed = [...savedSections.keys()].some((k) => !draft.sections.some((s) => s.key === k));
		if (removed) names.push('a removed section');
		if (head || (draft.__spec && draft.title !== draft.__spec.title))
			names.unshift('the title and details');
		return names;
	});

	/** Where the teacher asked to go with unsaved changes, while the page asks first. */
	let leavingTo = $state<URL | null>(null);
	let leaving = false;

	beforeNavigate((nav) => {
		// Closing the tab can only use the browser's own question (onbeforeunload below).
		if (!dirty || nav.willUnload || leaving || !nav.to) return;
		nav.cancel();
		leavingTo = nav.to.url;
		void tick().then(() => document.getElementById('leave-stay')?.focus());
	});

	async function leave() {
		const to = leavingTo;
		leavingTo = null;
		if (!to) return;
		leaving = true;
		await goto(to);
	}

	function freshFields() {
		return {
			offering: offeringId,
			notification: newAssessmentPaths(o, stem || 'new').notification
		};
	}

	/** Both files as they would be saved, or why they can't be yet. */
	const made = $derived.by(() => {
		void snapshot();
		try {
			const snap = $state.snapshot(draft) as AssessmentDraft;
			return {
				ok: true as const,
				...fromAssessmentDraft({ ...snap, __spec: draft.__spec }, freshFields())
			};
		} catch (error) {
			if (error instanceof EditError) return { ok: false as const, why: error.message };
			throw error;
		}
	});

	const titleSection = $derived(draft.sections.find((s) => s.role === 'title'));
	const subjectSection = $derived(draft.sections.find((s) => s.role === 'subject'));
	const teacherAt = $derived(draft.sections.findIndex((s) => s.role === 'teacher'));
	const details = $derived(titleSection?.body.kind === 'details' ? titleSection.body : null);
	const totalMarks = $derived(
		leadNumber(details?.rows.find((r) => /^marks?$/i.test(r.label.trim()))?.value ?? '')
	);
	const criteriaSection = $derived(draft.sections.find((s) => s.body.kind === 'criteria'));
	const topicsSection = $derived(draft.sections.find((s) => s.body.kind === 'topics'));
	const marks = $derived([
		...(criteriaSection?.body.kind === 'criteria'
			? marksProblems(criteriaSection.body, totalMarks)
			: []),
		...overviewProblems(draft.sections)
	]);

	/* Opening, Done and Cancel: one part open at a time. */

	function partState(key: number | 'head'): string {
		if (key === 'head') {
			return JSON.stringify({
				title: draft.title,
				stem,
				head: draft.sections.filter((s) => s.role === 'title' || s.role === 'subject')
			});
		}
		return JSON.stringify(draft.sections.find((s) => s.key === key) ?? null);
	}

	function openPart(key: number | 'head') {
		openKey = key;
		if (key === 'head') smallPrint = new Set();
		before = partState(key);
		void tick().then(() => {
			const box = document.querySelector<HTMLElement>('.editor');
			box?.scrollIntoView({ block: 'nearest' });
			box?.querySelector<HTMLElement>('input, textarea, [contenteditable]')?.focus();
		});
	}

	/** Back to the Edit button of what was open, so keyboard and screen reader users keep their place. */
	async function focusEdit(key: number | 'head' | null) {
		if (key === null) return;
		await tick();
		document.getElementById(key === 'head' ? 'edit-head' : `edit-${key}`)?.focus();
	}

	function done() {
		const key = openKey;
		openKey = null;
		before = null;
		asking = false;
		void focusEdit(key);
	}

	/** Whether the open part differs from when it opened. */
	const changedOpen = () => openKey !== null && before !== null && partState(openKey) !== before;

	/** Escape: close at once if nothing changed; otherwise ask, in the page. */
	function escape() {
		if (openKey === null) return;
		if (asking) {
			asking = false;
			return;
		}
		if (changedOpen()) {
			asking = true;
			void tick().then(() => document.getElementById('keep-yes')?.focus());
		} else {
			done();
		}
	}

	function cancel() {
		const key = openKey;
		if (key !== null && before) {
			const was = JSON.parse(before);
			if (key === 'head') {
				draft.title = was.title;
				stem = was.stem;
				for (const s of was.head as TaskSection[]) {
					const i = draft.sections.findIndex((x) => x.key === s.key);
					if (i !== -1) draft.sections[i] = s;
				}
			} else if (was) {
				const i = draft.sections.findIndex((x) => x.key === key);
				if (i !== -1) draft.sections[i] = was;
				else draft.sections.splice(Math.min(was.__at ?? 0, draft.sections.length), 0, was);
			} else {
				// A section added and then cancelled goes away again.
				const i = draft.sections.findIndex((x) => x.key === key);
				if (i !== -1) draft.sections.splice(i, 1);
			}
		}
		openKey = null;
		before = null;
		asking = false;
		forgetUndo();
		void focusEdit(key);
	}

	function open(key: number | 'head') {
		if (openKey !== null && openKey !== key) done();
		openPart(key);
	}

	function remove(i: number) {
		const gone = $state.snapshot(draft.sections[i]) as TaskSection;
		removing(`Removed the section “${gone.heading || 'untitled'}”`, () => {
			draft.sections.splice(Math.min(i, draft.sections.length), 0, gone);
			rehalve(draft.sections);
		});
		draft.sections.splice(i, 1);
		openKey = null;
		before = null;
	}

	/* Marks follow Marking criteria everywhere else they appear. */
	const lockedMarks = $derived(marksFromParts(draft.sections));
	const lockedSplit = $derived(splitFromParts(draft.sections));
	$effect(() => {
		void snapshot();
		untrack(() => syncMarks(draft));
	});

	const MONTHS = [
		'January',
		'February',
		'March',
		'April',
		'May',
		'June',
		'July',
		'August',
		'September',
		'October',
		'November',
		'December'
	];
	const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

	/** "Friday 12 June 2026" -> "2026-06-12", for the date picker; "" when it isn't a date. */
	function isoDate(text: string): string {
		const m = /(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/.exec(text);
		const month = m ? MONTHS.findIndex((x) => x.toLowerCase() === m[2].toLowerCase()) : -1;
		if (!m || month === -1) return '';
		return `${m[3]}-${String(month + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
	}

	/** "2026-06-12" -> "Friday 12 June 2026", the way notifications write dates. */
	function houseDate(iso: string): string {
		const [y, mo, d] = iso.split('-').map(Number);
		const day = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
		return `${DAYS[day]} ${d} ${MONTHS[mo - 1]} ${y}`;
	}

	function addSection(half: TaskSection['half']) {
		if (openKey !== null) done();
		const fresh = blankSection(half);
		if (half === 'issued' && teacherAt !== -1) draft.sections.splice(teacherAt, 0, fresh);
		else draft.sections.push(fresh);
		openKey = fresh.key;
		before = 'null';
		void tick().then(() => {
			const box = document.querySelector<HTMLElement>('.editor');
			box?.scrollIntoView({ block: 'center' });
			box?.querySelector<HTMLElement>('input')?.focus();
		});
	}

	const canMove = (i: number, by: -1 | 1) => {
		const s = draft.sections[i + by];
		return !!s && s.role !== 'subject' && s.role !== 'title';
	};

	/* The title and details. */

	function setName(name: string) {
		if (!titleSection) return;
		titleSection.heading = joinTitle(titleParts(titleSection.heading).prefix, name);
		// The spec's title follows the notification's.
		if (draft.syncTitle || !draft.__spec) draft.title = name;
	}

	function setPrefix(prefix: string) {
		if (!titleSection) return;
		titleSection.heading = joinTitle(prefix, titleParts(titleSection.heading).name);
	}

	/** A detail's value and its note joined the way the notification writes them. */
	function joinDetail(lead: string, rest: string): string {
		const r = rest.trim();
		if (!r) return lead.trim();
		return r.startsWith('(') ? `${lead.trim()} ${r}` : `${lead.trim()}, ${r}`;
	}

	function setLead(row: DetailRow, lead: string) {
		row.value = joinDetail(lead, leadOf(row.value).rest);
	}

	function setRest(row: DetailRow, rest: string) {
		row.value = joinDetail(leadOf(row.value).lead, rest);
	}

	/* Checks. */

	async function goTo(key: number | undefined) {
		if (key === undefined) return;
		const s = draft.sections.find((x) => x.key === key);
		if (s?.half === 'teacher') teacherOpen = true;
		await tick();
		document.getElementById(`s-${key}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
	}

	async function save(opened: Opened) {
		const data = session.data;
		if (!data || saving || !made.ok) return;
		problem = null;
		const fresh = !opened.spec;
		const name = a ?? stem;
		if (fresh) {
			const why = stemProblem(stem, (p) => opened.taken.has(p), o);
			if (why) {
				problem = why;
				open('head');
				return;
			}
		}
		saving = true;
		try {
			if (openKey !== null) done();
			const done_ = made;
			await data.saveAssessment(
				assessmentPath(o, name),
				done_.spec,
				opened.spec?.sha ?? null,
				done_.notification,
				opened.notification?.sha ?? null,
				fresh ? `Add assessment ${name} for ${opened.offering.id}` : `Edit assessment ${name}`
			);
			baseline = snapshot();
			remember();
			forgetUndo();
			session.revision += 1;
			await goto(links.assessment(o, name));
		} catch (error) {
			problem =
				error instanceof ConflictError
					? fresh
						? `Not saved: ${error.message} Choose another file name.`
						: 'Not saved: the notification or its spec changed since you opened them. Copy what you need, then reload the page.'
					: error instanceof PartlySavedError
						? `Only partly saved. ${error.message} Copy what you need, then reload the page and check both files.`
						: `Not saved. ${(error as Error).message}`;
		} finally {
			saving = false;
		}
	}
</script>

<svelte:window
	onbeforeunload={(e) => dirty && e.preventDefault()}
	onkeydown={(e) => {
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
			// Save, as the lesson editor does.
			e.preventDefault();
			if (openedNow && dirty && made.ok && !saving) void save(openedNow);
			return;
		}
		if (e.key !== 'Escape' || openKey === null) return;
		// Escape in an open More menu closes the menu, not the section.
		if (e.target instanceof Element && e.target.closest('details[open].more')) return;
		e.preventDefault();
		escape();
	}}
/>

{#if !o}
	<PageHead title="No class given" />
	<div class="page">
		<div class="msg warn">
			<div>Open an assessment from its class, or start a new one there.</div>
		</div>
	</div>
{:else if load}
	{#await load}
		<PageHead title={null} />
		<div class="page"><div class="loading"><span></span><span></span><span></span></div></div>
	{:then opened}
		{@const { offering, units, spec, notes } = opened}
		{@const registries = new Map(
			draft.units.map((u) => [u, units.get(u) ? (units.get(u)?.syllabus_registry ?? []) : null])
		) as Registries}
		{@const checks = made.ok
			? specProblems(made.spec, offering, registries, made.notification)
			: []}
		{@const why = made.ok ? null : made.why}
		{@const back = spec && a ? links.assessment(o, a) : links.home()}
		{@const title = titleParts(titleSection?.heading ?? '')}
		{@const issued = draft.sections.filter((s) => s.role === 'section' && s.half === 'issued')}
		{@const teacher = draft.sections.filter((s) => s.role === 'section' && s.half === 'teacher')}
		{@const topicMark = (text: string): TopicMark | undefined => {
			const row = topicRows(draft).find((t) => t.text.trim() === text.trim());
			if (!row) return undefined;
			const reg = registries.get(row.unit);
			const known = new Set((reg ?? []).map((e) => e.id));
			return {
				ids: row.ids.map((id) => ({ id, known: !reg || known.has(id) })),
				note: row.note || undefined
			};
		}}

		{#snippet block(s: TaskSection)}
			{@const i = draft.sections.indexOf(s)}
			<SectionBlock
				bind:section={draft.sections[i]}
				bind:examined={draft.units}
				open={openKey === s.key}
				{units}
				problems={checks}
				{why}
				{marks}
				{topicMark}
				canUp={canMove(i, -1)}
				canDown={canMove(i, 1)}
				fixed={s.role === 'teacher'}
				marksLocked={lockedMarks}
				headingLocked={(t) => headingFollows(draft.sections, t)}
				changed={changedKeys.has(s.key)}
				onopen={() => open(s.key)}
				ondone={done}
				oncancel={cancel}
				onmove={(by) => moveSection(draft.sections, i, by)}
				onremove={() => remove(i)}
			/>
		{/snippet}

		{#if openKey === 'head'}
			<header class="band" aria-label="Editing the title and details">
				<div class="band-inner">
					<nav class="crumbs" aria-label="Breadcrumb">
						<a href={links.home()}>{className(offering)}</a>
						{#if spec && a}<Icon name="right" size={14} /><a href={back}
								>{title.name || spec.doc.title}</a
							>{/if}
					</nav>
					<div class="band-titles">
						<label class="bf number">
							<span>Task number</span>
							<input
								type="text"
								value={title.prefix}
								oninput={(e) => setPrefix(e.currentTarget.value)}
								placeholder="Assessment Task 1"
							/>
						</label>
						<label class="bf title">
							<span>Title</span>
							<input
								type="text"
								value={title.name}
								oninput={(e) => setName(e.currentTarget.value)}
								placeholder="e.g. Torch Redesign"
							/>
						</label>
						{#if subjectSection}
							<label class="bf subject">
								<span>Year and subject</span>
								<input type="text" bind:value={subjectSection.heading} />
							</label>
						{/if}
						{#if !spec}
							{@const stemWhy = stem ? stemProblem(stem, (p) => opened.taken.has(p), o) : null}
							<label class="bf subject">
								<span>File name</span>
								<input
									type="text"
									bind:value={stem}
									placeholder="task3_final_exam"
									aria-invalid={stemWhy ? 'true' : undefined}
									aria-describedby="stem-hint"
								/>
								<small id="stem-hint" class:bad={stemWhy}>
									{stemWhy ??
										(stem
											? `Saved as ${newAssessmentPaths(o, stem).spec} and .md`
											: 'Lower-case letters, digits and underscores')}
								</small>
							</label>
						{/if}
					</div>
					{#if details}
						<div class="band-facts">
							{#each details.rows as row, i (i)}
								{@const { lead, rest } = leadOf(row.value)}
								{@const fixed = row.__raw !== undefined && STANDARD.test(row.label.trim())}
								{@const isMarks = /^marks?$/i.test(row.label.trim())}
								{@const isDue = /^(due|date)$/i.test(row.label.trim())}
								<div class="band-fact">
									{#if fixed}
										<span class="fact-name">{row.label}</span>
									{:else}
										<label class="bf">
											<span>Name</span>
											<input type="text" bind:value={row.label} placeholder="e.g. Presentation" />
										</label>
									{/if}
									{#if isMarks && lockedMarks}
										<span class="fact-locked">{lead}</span>
										<span class="fact-from">Worked out from Marking criteria</span>
									{:else}
										<label class="bf figure">
											<span class="sr-only">{row.label || 'Detail'}</span>
											<input
												type="text"
												value={lead}
												oninput={(e) => setLead(row, e.currentTarget.value)}
												placeholder={isMarks ? '40' : ''}
											/>
										</label>
										{#if isDue}
											<span class="date-pick">
												<button
													type="button"
													class="band-add"
													onclick={(e) => {
														const input = e.currentTarget.nextElementSibling as HTMLInputElement;
														try {
															input.showPicker();
														} catch {
															input.focus();
														}
													}}
												>
													<Icon name="calendar" size={14} /> Choose a date
												</button>
												<input
													class="date-input"
													type="date"
													tabindex="-1"
													aria-hidden="true"
													value={isoDate(lead)}
													oninput={(e) => {
														const d = e.currentTarget.value;
														if (d) setLead(row, houseDate(d));
													}}
												/>
											</span>
										{/if}
									{/if}
									{#if isMarks && lockedSplit && /in class|at home/i.test(rest)}
										<span class="fact-from">{rest} · worked out from each part’s Where</span>
									{:else if rest || smallPrint.has(i)}
										<label class="bf">
											<span>Small print</span>
											<input
												type="text"
												value={rest}
												oninput={(e) => setRest(row, e.currentTarget.value)}
												placeholder="e.g. (20% in class, 10% at home)"
											/>
										</label>
									{:else}
										<button
											type="button"
											class="band-add"
											onclick={() => (smallPrint = new Set([...smallPrint, i]))}
										>
											<Icon name="plus" size={14} /> Small print
										</button>
									{/if}
									{#if !fixed}
										<button
											type="button"
											class="band-remove"
											onclick={() => {
												const gone = $state.snapshot(row) as DetailRow;
												const rows = details.rows;
												removing(`Removed ${gone.label || 'a detail'}`, () =>
													rows.splice(Math.min(i, rows.length), 0, gone)
												);
												details.rows.splice(i, 1);
											}}
										>
											Remove {row.label || 'this detail'}
										</button>
									{/if}
								</div>
							{/each}
							<button
								type="button"
								class="band-add"
								onclick={() => details.rows.push({ label: '', value: '' })}
							>
								<Icon name="plus" size={14} /> Add a detail
							</button>
						</div>
					{/if}
					<div class="band-foot">
						<button type="button" class="band-done" onclick={done}>
							<Icon name="check" size={16} /> Done
						</button>
						<button type="button" class="band-cancel" onclick={cancel}>Cancel</button>
					</div>
				</div>
			</header>
		{:else}
			<PageHead
				crumbs={[
					{ href: links.home(), label: className(offering) },
					...(spec && a ? [{ href: back, label: title.name || spec.doc.title }] : [])
				]}
				title={title.name || 'New assessment'}
				lede={subjectSection?.heading}
			>
				{#snippet actions()}
					{#if openKey !== 'head'}
						<button id="edit-head" type="button" class="solid" onclick={() => open('head')}>
							<Icon name="pencil" size={16} /> Edit title and details
						</button>
					{/if}
				{/snippet}
				{#if details?.rows.length}
					<dl class="facts">
						{#each details.rows as d, i (i)}
							{@const { lead, rest } = leadOf(d.value)}
							<div class:wide={lead.length > 8}>
								<dt>{d.label}</dt>
								<dd>
									<span class="lead">{lead || '—'}</span>
									{#if rest}<span class="rest">{rest}</span>{/if}
								</dd>
							</div>
						{/each}
					</dl>
				{/if}
			</PageHead>
		{/if}

		<div class="page doc-page">
			<aside class="side" aria-label="Contents and checks">
				<nav class="side-block toc" aria-labelledby="toc-h">
					<h2 id="toc-h">On this page</h2>
					<ul>
						{#each issued as s (s.key)}
							<li>
								<a href="#s-{s.key}" onclick={(e) => (e.preventDefault(), goTo(s.key))}
									>{s.heading || 'Untitled section'}</a
								>
							</li>
						{/each}
						<li>
							<a
								href="#teacher-notes"
								onclick={() => {
									teacherOpen = true;
								}}>Teacher notes</a
							>
						</li>
					</ul>
				</nav>
				<section class="side-block" aria-labelledby="checks-h">
					<h2 id="checks-h">Checks</h2>
					<button
						type="button"
						class="check"
						class:bad={marks.length}
						onclick={() => goTo(criteriaSection?.key)}
					>
						<i aria-hidden="true"></i>
						{marks.length
							? `${marks.length} marking ${marks.length === 1 ? 'problem' : 'problems'}`
							: 'Marks add up'}
					</button>
					<button
						type="button"
						class="check"
						class:bad={why || checks.length}
						onclick={() => goTo(topicsSection?.key)}
					>
						<i aria-hidden="true"></i>
						{why
							? 'Topics not finished'
							: checks.length
								? `${checks.length} syllabus ${checks.length === 1 ? 'problem' : 'problems'}`
								: 'Topics match the syllabus'}
					</button>
				</section>
			</aside>

			<article class="doc">
				{#each notes as note, i (i)}<div class="msg note"><div>{note}</div></div>{/each}
				{#if problem}<div class="msg warn" role="alert"><div>{problem}</div></div>{/if}

				{#if details?.after.text}
					<section class="doc-section">
						<p class="preface">{details.after.text}</p>
					</section>
				{/if}

				{#each issued as s (s.key)}{@render block(s)}{/each}

				<button type="button" class="add-section" onclick={() => addSection('issued')}>
					<Icon name="plus" size={16} /> Add a section
				</button>

				<details class="teacher" id="teacher-notes" bind:open={teacherOpen}>
					<summary>
						<span class="chev"><Icon name="down" size={18} /></span>
						Teacher notes
						<span>
							Students never see these{teacher.length
								? ` · ${teacher.map((s) => s.heading).join(' · ')}`
								: ''}
						</span>
					</summary>
					{#if teacherAt === -1}
						<p class="hint">This notification has no teacher notes yet.</p>
						<button
							type="button"
							class="add-section"
							onclick={() => draft.sections.push(teacherDivider())}
						>
							<Icon name="plus" size={16} /> Add teacher notes
						</button>
					{:else}
						{@const intro = draft.sections[teacherAt].body}
						<div class="teacher-ground">
							{#if intro.kind === 'text' && intro.text.trim()}
								<p class="teacher-intro">{intro.text}</p>
							{/if}
							{#each teacher as s (s.key)}{@render block(s)}{/each}
							<button type="button" class="add-section" onclick={() => addSection('teacher')}>
								<Icon name="plus" size={16} /> Add a teacher section
							</button>
						</div>
					{/if}
				</details>
			</article>
		</div>

		{#if leavingTo}
			<div class="keep" role="alertdialog" aria-labelledby="leave-h" aria-describedby="leave-p">
				<h2 id="leave-h">Leave without saving?</h2>
				<p id="leave-p">
					You changed {changedNames.join(', ') || 'this task'}. Leaving throws those changes away.
				</p>
				<div class="keep-acts">
					<button id="leave-stay" type="button" class="primary" onclick={() => (leavingTo = null)}
						>Stay and keep editing</button
					>
					<button type="button" class="danger-btn" onclick={leave}>Discard changes and leave</button
					>
				</div>
			</div>
		{/if}

		{#if asking}
			<div class="keep" role="alertdialog" aria-labelledby="keep-h" aria-describedby="keep-p">
				<h2 id="keep-h">Keep these changes?</h2>
				<p id="keep-p">
					You changed {openKey === 'head' ? 'the title and details' : 'this section'}. Press Escape
					again to keep editing.
				</p>
				<div class="keep-acts">
					<button id="keep-yes" type="button" class="primary" onclick={done}>Keep my changes</button
					>
					<button type="button" onclick={cancel}>Undo my changes</button>
				</div>
			</div>
		{/if}

		<div class="save-bar" role="region" aria-label="Saving">
			<div class="save-inner">
				<span class="state" aria-live="polite">
					{#if !dirty}
						No changes
					{:else}
						<b>Changed: {changedNames.join(', ') || 'this task'}</b>
					{/if}
				</span>
				{#if undo.label}
					<span class="bar-note">
						{undo.label}.
						<button
							type="button"
							class="link"
							onclick={() => {
								undoRemove();
								void tick().then(() =>
									document
										.querySelector<HTMLElement>('.editor input, .editor .rich, .save-bar .state')
										?.focus()
								);
							}}>Undo</button
						>
					</span>
				{/if}
				{#if dirty && why}
					<span class="bar-note bad">Can’t save yet: {why}</span>
				{:else if dirty && (marks.length || checks.length)}
					<span class="bar-note bad">
						Saves with
						{#if marks.length}
							<button type="button" class="link" onclick={() => goTo(criteriaSection?.key)}>
								{marks.length} marking {marks.length === 1 ? 'problem' : 'problems'}
							</button>
						{/if}
						{#if marks.length && checks.length}and{/if}
						{#if checks.length}
							<button type="button" class="link" onclick={() => goTo(topicsSection?.key)}>
								{checks.length} syllabus {checks.length === 1 ? 'problem' : 'problems'}
							</button>
						{/if}
						to fix later
					</span>
				{/if}
				<span class="spacer"></span>
				<a class="btn quiet" href={back}>{dirty ? 'Leave without saving' : 'Back'}</a>
				<button
					type="button"
					class="primary go"
					disabled={saving || !dirty || !made.ok}
					onclick={() => save(opened)}
				>
					{saving ? 'Saving…' : spec ? 'Save' : 'Create'}
					<kbd>Ctrl S</kbd>
				</button>
			</div>
		</div>
	{:catch error}
		<PageHead title="Could not open this assessment" />
		<div class="page"><Failure {error} /></div>
	{/await}
{/if}

<style>
	/* Header: the details as figures, as on the assessment page. */
	.facts {
		display: flex;
		flex-wrap: wrap;
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
		font-size: 13px;
		font-weight: 650;
		opacity: 0.85;
	}

	.facts dd {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin: 6px 0 0;
	}

	.facts .lead {
		font-size: 36px;
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
	}

	.facts .rest {
		font-size: 13px;
		line-height: 1.35;
		opacity: 0.88;
	}

	/* Editing the title and details in the house band itself. */
	.band {
		background: var(--house);
		color: var(--house-on);
		border-bottom: 4px solid color-mix(in oklab, var(--house-on) 70%, transparent);
	}

	.band-inner {
		max-width: var(--page-max);
		margin-inline: auto;
		padding: 22px clamp(16px, 4vw, 48px) 22px;
	}

	.crumbs {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px;
		margin-bottom: 14px;
		font-size: 13px;
		font-weight: 600;
		opacity: 0.85;
	}

	.crumbs a {
		text-decoration: none;
	}

	.band-titles {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 2.4fr);
		gap: 10px 16px;
	}

	.band-titles .subject {
		grid-column: 1 / -1;
		max-width: 640px;
	}

	.bf {
		display: block;
	}

	.bf > span {
		display: block;
		margin-bottom: 4px;
		font-size: 13px;
		font-weight: 700;
		opacity: 0.9;
	}

	/* A field on the house colour: a light well at rest, white and dark text in use. */
	.bf input {
		width: 100%;
		padding: 7px 10px;
		background: color-mix(in oklab, var(--house-on) 14%, transparent);
		border: 1px solid color-mix(in oklab, var(--house-on) 70%, transparent);
		border-radius: 2px;
		color: var(--house-on);
	}

	/* A placeholder is an example, never a value: italic, and lighter than what's typed. */
	.bf input::placeholder {
		font-style: italic;
		font-weight: 500;
		color: color-mix(in oklab, var(--house-on) 78%, var(--house));
	}

	.date-pick {
		position: relative;
		display: inline-flex;
	}

	.date-input {
		position: absolute;
		left: 0;
		bottom: 0;
		width: 1px;
		height: 1px;
		opacity: 0;
		pointer-events: none;
	}

	.bf input:hover {
		border-color: var(--house-on);
	}

	.bf input:focus {
		background: var(--field-on);
		border-color: var(--house-on);
		color: var(--ink);
		outline: 3px solid var(--house-on);
		outline-offset: 1px;
		box-shadow: none;
	}

	.bf input:focus::placeholder {
		color: var(--muted);
	}

	.bf.title input {
		font-size: 30px;
		font-weight: 850;
		font-stretch: 75%;
		line-height: 1.1;
	}

	.bf small {
		display: block;
		margin-top: 4px;
		font-size: 13px;
	}

	.bf small.bad {
		font-weight: 750;
	}

	.band-facts {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: 14px 22px;
		margin-top: 22px;
	}

	.band-fact {
		display: flex;
		flex-direction: column;
		gap: 6px;
		width: 230px;
		padding-top: 10px;
		border-top: 2px solid color-mix(in oklab, var(--house-on) 55%, transparent);
	}

	.fact-name {
		font-size: 13px;
		font-weight: 800;
	}

	.bf.figure input {
		font-size: 22px;
		font-weight: 850;
		font-stretch: 80%;
	}

	.fact-locked {
		font-size: 36px;
		font-weight: 900;
		font-stretch: 70%;
		line-height: 1;
	}

	.fact-from {
		font-size: 13px;
		opacity: 0.9;
	}

	.band-remove,
	.band-add,
	.band-cancel {
		align-self: flex-start;
		min-height: 32px;
		padding: 0 10px;
		background: transparent;
		border: 1px solid color-mix(in oklab, var(--house-on) 60%, transparent);
		color: var(--house-on);
		font-size: 13px;
	}

	.band-add {
		align-self: flex-end;
	}

	.band-fact .band-add {
		align-self: flex-start;
	}

	.band-foot {
		display: flex;
		gap: 8px;
		margin-top: 22px;
	}

	.band-done {
		min-height: 42px;
		padding: 0 22px;
		background: var(--house-on);
		border-color: var(--house-on);
		color: var(--house-deep);
		font-size: 15px;
		font-weight: 800;
	}

	.band-cancel {
		min-height: 42px;
		font-size: 15px;
	}

	.band :global(:focus-visible) {
		outline-color: var(--house-on);
	}

	/* The document beside its side column. */
	.doc-page {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 260px;
		grid-template-areas: 'doc side';
		gap: 0 48px;
		align-items: start;
		padding-bottom: 120px;
	}

	.doc {
		grid-area: doc;
		min-width: 0;
	}

	.side {
		grid-area: side;
		position: sticky;
		top: 24px;
		padding-top: 10px;
	}

	.side-block {
		padding-top: 10px;
		border-top: 2px solid var(--ink);
	}

	.side-block + .side-block {
		margin-top: 26px;
	}

	.side-block h2 {
		margin: 0 0 10px;
		font-size: 13px;
		font-weight: 800;
	}

	.toc ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.toc a {
		display: block;
		padding: 5px 0 5px 12px;
		border-left: 2px solid var(--rule);
		font-size: 14px;
		color: var(--ink-2);
		text-decoration: none;
	}

	.toc a:hover {
		color: var(--house-deep);
		border-left-color: var(--house);
	}

	.check {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		min-height: 34px;
		margin-bottom: 4px;
		padding: 0;
		background: transparent;
		border: 0;
		justify-content: flex-start;
		font-size: 14px;
		font-weight: 650;
		color: var(--good);
		white-space: normal;
		text-align: left;
	}

	.check:hover {
		text-decoration: underline;
	}

	.check i {
		flex: none;
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: currentColor;
	}

	.check.bad {
		color: var(--warn-deep);
	}

	.check.bad i {
		border-radius: 0;
		transform: rotate(45deg);
	}

	.preface {
		margin: 0;
		color: var(--ink-2);
	}

	.doc-section {
		margin-top: 10px;
	}

	.add-section {
		margin-top: 28px;
		min-height: 38px;
		background: var(--paper);
		border: 1px dashed var(--field-edge);
		font-size: 14px;
		font-weight: 750;
		color: var(--house-deep);
	}

	.add-section:hover:not(:disabled) {
		border-style: solid;
		border-color: var(--house);
	}

	/* Teacher notes, folded at the foot, as on the assessment page. */
	.teacher {
		margin-top: 48px;
		border-top: 2px solid var(--ink);
	}

	/* The teacher's half has its own ground, so it is never mistaken for what students get. */
	.teacher-ground {
		margin: 0 -18px;
		padding: 4px 18px 24px;
		background: var(--sunk);
		border: 1px solid var(--rule-strong);
	}

	.teacher-ground :global(.doc-section:first-of-type) {
		margin-top: 16px;
	}

	.teacher-intro {
		margin: 12px 0 0;
		font-size: 14px;
		color: var(--ink-2);
	}

	.teacher summary {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 10px;
		padding: 16px 0;
		cursor: pointer;
		font-size: 18px;
		font-weight: 800;
		list-style: none;
	}

	.teacher summary::-webkit-details-marker {
		display: none;
	}

	.teacher summary > span:last-child {
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

	.hint {
		font-size: 14px;
		color: var(--muted);
	}

	/* Escape in a changed section asks, in the page, never in a browser dialog. */
	.keep {
		position: fixed;
		left: 50%;
		bottom: 88px;
		z-index: 20;
		width: min(460px, calc(100vw - 32px));
		padding: 16px 18px;
		background: var(--paper);
		border: 2px solid var(--house);
		border-radius: 2px;
		box-shadow: var(--shadow);
		transform: translateX(-50%);
	}

	.keep h2 {
		margin: 0 0 4px;
		font-size: 18px;
	}

	.keep p {
		margin: 0 0 12px;
		font-size: 14px;
		color: var(--ink-2);
	}

	.keep button:not(.primary) {
		border-color: var(--field-edge);
	}

	.danger-btn {
		color: var(--warn-deep);
		border-color: var(--warn-deep);
	}

	.keep-acts {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	/* Save: always in reach at the foot of the window. */
	.save-bar {
		position: sticky;
		bottom: 0;
		z-index: 5;
		background: var(--paper);
		border-top: 2px solid var(--house);
		box-shadow: 0 -6px 18px -10px rgb(21 23 28 / 0.25);
	}

	.save-inner {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px 14px;
		max-width: var(--page-max);
		margin-inline: auto;
		padding: 10px clamp(16px, 4vw, 48px);
	}

	.state {
		font-size: 14px;
	}

	.bar-note {
		font-size: 14px;
	}

	.bar-note.bad {
		color: var(--warn-deep);
	}

	.link {
		display: inline;
		min-height: 0;
		padding: 0;
		background: none;
		border: 0;
		font: inherit;
		font-weight: 750;
		color: inherit;
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.spacer {
		flex: 1;
	}

	.go {
		min-height: 42px;
		padding: 0 26px;
		font-size: 15px;
		font-weight: 800;
	}

	@media (max-width: 900px) {
		.doc-page {
			grid-template-columns: minmax(0, 1fr);
			grid-template-areas: 'side' 'doc';
		}

		.side {
			position: static;
			margin-bottom: 20px;
		}

		.toc {
			display: none;
		}
	}

	@media (max-width: 640px) {
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
