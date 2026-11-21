<script lang="ts">
	// One section of a notification. Closed, it is drawn exactly as the
	// assessment page draws it, with an Edit button; clicking anywhere in it
	// opens it. Open, it is a boxed editor: its heading, its text as
	// paragraphs, lists and tables (or Marking criteria as parts, or the
	// topics), and Done, Cancel, move and remove.
	import BlocksEditor from './BlocksEditor.svelte';
	import CriteriaEditor from './CriteriaEditor.svelte';
	import Icon from './Icon.svelte';
	import Markdown, { type TopicMark } from './Markdown.svelte';
	import TopicsEditor from './TopicsEditor.svelte';
	import { sectionText, type TaskSection } from '#lib/domain/assessmentEdit.ts';
	import { parseMarkdown } from '#lib/domain/markdown.ts';
	import type { Unit } from '#lib/domain/types.ts';

	let {
		section = $bindable(),
		examined = $bindable(),
		open,
		units,
		problems,
		why,
		marks,
		topicMark,
		canUp,
		canDown,
		fixed = false,
		marksLocked = false,
		headingLocked = () => false,
		changed = false,
		onopen,
		ondone,
		oncancel,
		onmove,
		onremove
	}: {
		section: TaskSection;
		examined: string[];
		open: boolean;
		units: Map<string, Unit | null>;
		/** The syllabus check's findings, for the topics section. */
		problems: string[];
		/** Why the draft can't be saved yet, if it can't. */
		why: string | null;
		/** What doesn't add up in the marks, for Marking criteria. */
		marks: string[];
		topicMark: (text: string) => TopicMark | undefined;
		canUp: boolean;
		canDown: boolean;
		/** The teacher notes' opening: its heading and text only, never moved or removed. */
		fixed?: boolean;
		/** Marks come from Marking criteria (a parts table's Marks column is locked). */
		marksLocked?: boolean;
		headingLocked?: (text: string) => boolean;
		/** Edited since the file was opened or saved. */
		changed?: boolean;
		onopen: () => void;
		ondone: () => void;
		oncancel: () => void;
		onmove: (by: -1 | 1) => void;
		onremove: () => void;
	} = $props();

	let asText = $state(false);
	const body = $derived(section.body);
	const id = $derived(`s-${section.key}`);
	const drawn = $derived(open ? [] : parseMarkdown(sectionText(section)));
	const parts = $derived(
		body.kind === 'criteria'
			? body.parts.reduce((n, p) => n + (p.kind === 'part' ? (p.marks ?? 0) : 0), 0)
			: 0
	);

	function activate(e: MouseEvent) {
		if (open) return;
		// Links in the text still go where they point.
		if ((e.target as HTMLElement).closest('a, button')) return;
		onopen();
	}
</script>

{#snippet status()}
	{#if body.kind === 'criteria'}
		<span class="status" class:bad={marks.length}>
			<i aria-hidden="true"></i>
			{body.parts.length}
			{body.parts.length === 1 ? 'part' : 'parts'} · {parts} marks{marks.length
				? ` · ${marks.length} to check`
				: ''}
		</span>
	{:else if body.kind === 'topics'}
		<span class="status" class:bad={why || problems.length}>
			<i aria-hidden="true"></i>
			{why
				? 'Not finished'
				: problems.length
					? `${problems.length} to fix`
					: 'Matches the syllabus'}
		</span>
	{/if}
{/snippet}

{#if !open}
	<section class="doc-section closed" {id} data-toc aria-labelledby="{id}-h">
		<!-- A click anywhere in the section opens it; keyboard and screen readers use its Edit button. -->
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<div class="hit" onclick={activate}>
			<div class="doc-h">
				<h2 id="{id}-h">{section.heading || 'Untitled section'}</h2>
				{#if changed}<span class="changed">Changed, not saved yet</span>{/if}
				{@render status()}
				<button
					id="edit-{section.key}"
					type="button"
					class="edit-cue"
					aria-label="Edit {section.heading || 'this section'}"
					onclick={(e) => {
						e.stopPropagation();
						onopen();
					}}
				>
					<Icon name="pencil" size={15} /> Edit
				</button>
			</div>
			{#if body.kind === 'criteria' && marks.length}
				<div class="msg warn problems">
					<ul>
						{#each marks as m, i (i)}<li>{m}</li>{/each}
					</ul>
				</div>
			{:else if body.kind === 'topics' && (why || problems.length)}
				<div class="msg warn problems">
					<ul>
						{#if why}<li>{why}</li>{/if}
						{#each problems as p, i (i)}<li>{p}</li>{/each}
					</ul>
				</div>
			{/if}
			{#if drawn.length}
				<Markdown blocks={drawn} topic={body.kind === 'topics' ? topicMark : undefined} />
			{:else}
				<p class="empty">Nothing here yet. Click to write this section.</p>
			{/if}
		</div>
	</section>
{:else}
	<section
		class="doc-section editor"
		{id}
		data-toc
		aria-label="Editing {section.heading || 'section'}"
	>
		<label class="heading-field">
			<span>Section heading</span>
			<input type="text" bind:value={section.heading} placeholder="Section heading" />
		</label>

		{#if section.body.kind === 'text'}
			{#if asText}
				<p class="hint">
					The section as plain text. Use this only for something the layout editor can’t do.
				</p>
				<textarea class="as-text" bind:value={section.body.text} aria-label="Section as text"
				></textarea>
			{:else}
				<div class="format-bar" role="toolbar" aria-label="Formatting">
					<button
						type="button"
						class="fmt"
						title="Bold (Ctrl or Cmd + B)"
						onmousedown={(e) => {
							e.preventDefault();
							document.execCommand('bold');
						}}><b>B</b> Bold</button
					>
					<button
						type="button"
						class="fmt"
						title="Italic (Ctrl or Cmd + I)"
						onmousedown={(e) => {
							e.preventDefault();
							document.execCommand('italic');
						}}><i>I</i> Italic</button
					>
				</div>
				<BlocksEditor host={section.body} {marksLocked} {headingLocked} />
			{/if}
		{:else if section.body.kind === 'criteria'}
			<div class="status-row">{@render status()}</div>
			<CriteriaEditor bind:body={section.body} />
		{:else if section.body.kind === 'topics'}
			<div class="status-row">{@render status()}</div>
			<TopicsEditor bind:rows={section.body.rows} bind:examined {units} {problems} {why} />
		{/if}

		<div class="editor-foot">
			<button type="button" class="primary" onclick={ondone}>
				<Icon name="check" size={16} /> Done
			</button>
			<button type="button" onclick={oncancel}>Cancel</button>
			<span class="foot-hint">Done keeps your changes here. Save writes them.</span>
			<span class="spacer"></span>
			{#if section.body.kind === 'text' || !fixed}
				<details class="more">
					<summary>More <Icon name="down" size={14} /></summary>
					<div class="menu">
						{#if section.body.kind === 'text'}
							<button type="button" class="quiet" onclick={() => (asText = !asText)}>
								{asText ? 'Back to the layout editor' : 'Edit as plain text'}
							</button>
						{/if}
						{#if !fixed}
							<button type="button" class="quiet" disabled={!canUp} onclick={() => onmove(-1)}>
								<Icon name="up" size={15} /> Move section up
							</button>
							<button type="button" class="quiet" disabled={!canDown} onclick={() => onmove(1)}>
								<Icon name="down" size={15} /> Move section down
							</button>
							{#if section.body.kind !== 'topics'}
								<button type="button" class="quiet danger" onclick={onremove}>
									<Icon name="bin" size={15} /> Remove section
								</button>
							{/if}
						{/if}
					</div>
				</details>
			{/if}
		</div>
	</section>
{/if}

<style>
	.doc-section {
		margin-top: 40px;
		scroll-margin-top: 16px;
	}

	/* Closed: the section as students read it, with a clear cue to edit. */
	.hit {
		margin: 0 -14px;
		padding: 4px 14px 10px;
		border: 1px solid transparent;
		border-radius: 2px;
		cursor: pointer;
		transition:
			background-color 160ms var(--ease),
			border-color 160ms var(--ease);
	}

	.hit:hover {
		background: color-mix(in oklab, var(--house-soft) 55%, transparent);
		border-color: color-mix(in oklab, var(--house) 40%, transparent);
	}

	.doc-h {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 6px 16px;
		padding-bottom: 10px;
		margin-bottom: 16px;
		border-bottom: 2px solid var(--ink);
	}

	.doc-h h2 {
		flex: 1 1 auto;
		margin: 0;
	}

	.edit-cue {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px;
		background: var(--paper);
		border: 1px solid var(--field-edge);
		border-radius: 2px;
		font-size: 13px;
		font-weight: 750;
		color: var(--house-deep);
	}

	.hit:hover .edit-cue,
	.edit-cue:focus-visible {
		background: var(--house);
		border-color: var(--house);
		color: var(--house-on);
	}

	.status {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		font-size: 13px;
		font-weight: 650;
		color: var(--good);
	}

	.status i {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: currentColor;
	}

	.status.bad {
		color: var(--warn-deep);
	}

	.status.bad i {
		border-radius: 0;
		transform: rotate(45deg);
	}

	.problems {
		margin: 0 0 16px;
	}

	.problems ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.problems li + li {
		margin-top: 6px;
		padding-top: 6px;
		border-top: 1px solid color-mix(in oklab, var(--warn-deep) 18%, transparent);
	}

	.empty {
		margin: 0;
		font-size: 14px;
		color: var(--muted);
	}

	/* Open: the boxed editor. */
	.editor {
		margin-right: -18px;
		margin-left: -18px;
		padding: 16px 18px 14px;
	}

	.heading-field {
		display: block;
		margin-bottom: 14px;
	}

	.heading-field span,
	.hint {
		display: block;
		margin-bottom: 5px;
		font-size: 13px;
		font-weight: 700;
		color: var(--ink-2);
	}

	.heading-field input {
		font-size: 22px;
		font-weight: 850;
	}

	.format-bar {
		display: flex;
		gap: 4px;
		margin-bottom: 10px;
	}

	.fmt {
		min-height: 32px;
		padding: 0 10px;
		font-size: 13px;
	}

	.fmt b,
	.fmt i {
		font-size: 15px;
	}

	.as-text {
		width: 100%;
		min-height: 12em;
		font-family: var(--mono, ui-monospace, monospace);
		font-size: 13px;
	}

	.status-row {
		margin-bottom: 10px;
	}

	/* Done and Cancel stay in view above the save bar while the section is open. */
	.editor-foot {
		position: sticky;
		bottom: 64px;
		z-index: 2;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		margin: 18px -18px -14px;
		padding: 10px 18px;
		background: var(--paper);
		border-top: 1px solid color-mix(in oklab, var(--house) 35%, transparent);
	}

	.editor-foot .primary {
		min-height: 40px;
		padding: 0 18px;
		font-weight: 800;
	}

	.spacer {
		flex: 1;
	}

	.foot-hint {
		font-size: 13px;
		color: var(--muted);
	}

	.changed {
		padding: 2px 8px;
		background: var(--note-soft);
		border-radius: 2px;
		font-size: 13px;
		font-weight: 700;
		color: var(--note-deep);
	}

	.danger {
		color: var(--warn-deep);
	}

	.more {
		position: relative;
	}

	.more summary {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 36px;
		padding: 0 12px;
		border: 1px solid var(--field-edge);
		border-radius: 2px;
		background: var(--paper);
		font-size: 14px;
		font-weight: 650;
		cursor: pointer;
		list-style: none;
	}

	.more summary::-webkit-details-marker {
		display: none;
	}

	.more .menu {
		position: absolute;
		right: 0;
		bottom: calc(100% + 6px);
		z-index: 3;
		display: flex;
		flex-direction: column;
		min-width: 220px;
		padding: 6px;
		background: var(--paper);
		border: 1px solid var(--field-edge);
		border-radius: 2px;
		box-shadow: var(--shadow);
	}

	.more .menu button {
		justify-content: flex-start;
	}

	@media (max-width: 560px) {
		.editor {
			margin-right: -10px;
			margin-left: -10px;
			padding-inline: 10px;
		}

		.spacer {
			flex-basis: 100%;
		}
	}
</style>
