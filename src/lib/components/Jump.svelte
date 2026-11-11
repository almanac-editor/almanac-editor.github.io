<script lang="ts" module>
	import type { House } from '#lib/house.ts';

	export interface JumpItem {
		kind: 'Class' | 'Calendar' | 'Unit' | 'Lesson';
		label: string;
		sub: string;
		href: string;
		house: House;
	}
</script>

<script lang="ts">
	// Jump to any class, unit or lesson by typing part of its name. Opens with
	// "/" or Ctrl+K from anywhere that is not a text field.
	import { goto } from '$app/navigation';
	import Icon from './Icon.svelte';

	let { items }: { items: JumpItem[] } = $props();

	let dialog = $state<HTMLDialogElement>();
	let input = $state<HTMLInputElement>();
	let query = $state('');
	let active = $state(0);

	const results = $derived.by(() => {
		const words = query.toLowerCase().split(/\s+/).filter(Boolean);
		const found = words.length
			? items.filter((item) => {
					const hay = `${item.label} ${item.sub} ${item.kind}`.toLowerCase();
					return words.every((w) => hay.includes(w));
				})
			: items.filter((item) => item.kind !== 'Lesson');
		return found.slice(0, 40);
	});

	export function open() {
		query = '';
		active = 0;
		dialog?.showModal();
		input?.focus();
	}

	function choose(item: JumpItem | undefined) {
		if (!item) return;
		dialog?.close();
		goto(item.href);
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			active = Math.min(active + 1, results.length - 1);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			active = Math.max(active - 1, 0);
		} else if (event.key === 'Enter') {
			event.preventDefault();
			choose(results[active]);
		}
	}

	$effect(() => {
		// Keep the highlighted row in view as the arrow keys move it.
		dialog?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
	});
</script>

<dialog
	bind:this={dialog}
	aria-label="Jump to a class, unit or lesson"
	onclick={(e) => e.target === dialog && dialog?.close()}
>
	<div class="box">
		<label class="search">
			<Icon name="search" size={20} />
			<span class="sr-only">Search</span>
			<input
				bind:this={input}
				bind:value={query}
				oninput={() => (active = 0)}
				{onkeydown}
				type="search"
				placeholder="Jump to a class, unit or lesson"
				autocomplete="off"
				spellcheck="false"
			/>
			<kbd>Esc</kbd>
		</label>
		{#if results.length}
			<ul role="listbox" aria-label="Results">
				{#each results as item, i (item.href + i)}
					<li role="option" aria-selected={i === active} data-index={i} data-house={item.house}>
						<a
							href={item.href}
							onclick={(e) => {
								e.preventDefault();
								choose(item);
							}}
							onmousemove={() => (active = i)}
						>
							<span class="swatch" aria-hidden="true"></span>
							<span class="label">{item.label}</span>
							<span class="sub">{item.sub}</span>
							<span class="kind">{item.kind}</span>
						</a>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="empty">Nothing matches “{query}”. Try a word from the lesson’s file name.</p>
		{/if}
		<p class="hint">
			<span><kbd>↑</kbd> <kbd>↓</kbd> to move</span>
			<span><kbd>Enter</kbd> to open</span>
		</p>
	</div>
</dialog>

<style>
	dialog {
		width: min(640px, calc(100vw - 32px));
		max-height: min(560px, calc(100vh - 96px));
		margin: 12vh auto auto;
		padding: 0;
		border: 0;
		background: var(--paper);
		color: var(--ink);
		box-shadow:
			0 2px 4px rgb(0 0 0 / 0.08),
			0 24px 60px -12px rgb(0 0 0 / 0.35);
		overflow: hidden;
	}

	dialog[open] {
		animation: rise 220ms var(--ease);
	}

	dialog::backdrop {
		background: rgb(13 14 17 / 0.45);
		backdrop-filter: blur(2px);
	}

	@keyframes rise {
		from {
			transform: translateY(8px) scale(0.985);
			opacity: 0.6;
		}
	}

	.box {
		display: flex;
		flex-direction: column;
		max-height: inherit;
	}

	.search {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 0 16px;
		border-bottom: 2px solid var(--ink);
	}

	.search input {
		border: 0;
		background: transparent;
		padding: 18px 0;
		font-size: 18px;
		font-weight: 600;
		box-shadow: none;
	}

	.search input:focus {
		box-shadow: none;
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 6px 0;
		overflow-y: auto;
	}

	li a {
		display: grid;
		grid-template-columns: 6px minmax(0, auto) minmax(0, 1fr) auto;
		align-items: center;
		gap: 12px;
		padding: 9px 16px;
		text-decoration: none;
	}

	li[aria-selected='true'] a {
		background: var(--house-soft);
	}

	.swatch {
		align-self: stretch;
		background: var(--house);
	}

	.label {
		font-weight: 700;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.sub {
		font-size: 13px;
		color: var(--muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.kind {
		font-size: 12px;
		font-weight: 700;
		color: var(--muted);
	}

	.empty {
		padding: 24px 16px;
		margin: 0;
		color: var(--muted);
	}

	.hint {
		display: flex;
		gap: 18px;
		margin: 0;
		padding: 10px 16px;
		border-top: 1px solid var(--rule);
		font-size: 12px;
		color: var(--muted);
	}

	@media (max-width: 560px) {
		li a {
			grid-template-columns: 6px minmax(0, 1fr) auto;
		}
		.sub {
			grid-column: 2;
			grid-row: 2;
		}
		.hint {
			display: none;
		}
	}
</style>
