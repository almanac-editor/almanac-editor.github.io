<script lang="ts">
	// The page header: a flat field in the house colour, with the crumbs, the
	// title at display size and the page's actions. When it appears it fades
	// from the previous page's house colour (--from) to this one, so moving
	// between classes reads as the colour changing hands.
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	let {
		crumbs = [],
		title,
		numeral,
		lede,
		actions,
		meta,
		children
	}: {
		crumbs?: { href: string; label: string }[];
		title: string | null;
		numeral?: string | null;
		lede?: string | null;
		actions?: Snippet;
		meta?: Snippet;
		children?: Snippet;
	} = $props();
</script>

<header class="head">
	<div class="inner">
		{#if crumbs.length}
			<nav class="crumbs" aria-label="Breadcrumb">
				{#each crumbs as c, i (i)}
					{#if i > 0}<Icon name="right" size={14} />{/if}
					<a href={c.href}>{c.label}</a>
				{/each}
			</nav>
		{/if}
		<div class="row">
			{#if numeral}<span class="numeral" aria-hidden="true">{numeral}</span>{/if}
			<div class="titles">
				{#if title === null}
					<span class="placeholder" aria-label="Loading"></span>
				{:else}
					<h1>{title}</h1>
				{/if}
				{#if lede}<p class="lede">{lede}</p>{/if}
			</div>
			{#if actions}<div class="actions">{@render actions()}</div>{/if}
		</div>
		{#if meta}<div class="meta">{@render meta()}</div>{/if}
	</div>
	{#if children}{@render children()}{/if}
</header>

<style>
	.head {
		background: var(--house);
		color: var(--house-on);
		transition:
			background-color 650ms var(--ease),
			color 650ms var(--ease);
	}

	@starting-style {
		.head {
			background-color: var(--from, var(--house));
			color: var(--from-on, var(--house-on));
		}
	}

	.inner {
		max-width: var(--page-max);
		margin-inline: auto;
		padding: 22px clamp(16px, 4vw, 48px) 26px;
	}

	.crumbs {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px;
		font-size: 13px;
		font-weight: 600;
		margin-bottom: 14px;
		opacity: 0.85;
	}

	.crumbs a {
		text-decoration: none;
	}

	.crumbs a:hover {
		text-decoration: underline;
	}

	.row {
		display: flex;
		align-items: flex-end;
		gap: 12px 24px;
		flex-wrap: wrap;
	}

	.numeral {
		font-size: clamp(64px, 9vw, 112px);
		font-weight: 900;
		font-stretch: 70%;
		line-height: 0.78;
		letter-spacing: -0.04em;
		font-variant-numeric: tabular-nums;
		opacity: 0.92;
	}

	.titles {
		flex: 1 1 320px;
		min-width: 0;
	}

	h1 {
		font-size: clamp(30px, 4.2vw, 52px);
		font-weight: 850;
		font-stretch: 75%;
		line-height: 0.98;
		letter-spacing: -0.02em;
		max-width: 26ch;
	}

	.lede {
		margin: 12px 0 0;
		font-size: 16px;
		line-height: 1.45;
		max-width: var(--measure);
		opacity: 0.9;
	}

	.placeholder {
		display: block;
		height: 44px;
		width: min(420px, 70%);
		background: color-mix(in oklab, currentColor 18%, transparent);
	}

	/* The actions always take a row of their own under the title, so the
	   title and lede keep the full width and the buttons sit in the same
	   place on every screen size. */
	.actions {
		flex-basis: 100%;
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		align-items: center;
	}

	.actions :global(.btn),
	.actions :global(button) {
		background: color-mix(in oklab, var(--house-on) 12%, transparent);
		border-color: color-mix(in oklab, var(--house-on) 35%, transparent);
		color: var(--house-on);
	}

	.actions :global(.btn:hover),
	.actions :global(button:hover:not(:disabled)) {
		background: color-mix(in oklab, var(--house-on) 22%, transparent);
		border-color: var(--house-on);
	}

	.actions :global(.btn.solid),
	.actions :global(button.solid) {
		background: var(--house-on);
		border-color: var(--house-on);
		color: var(--house);
	}

	.actions :global(.btn.solid:hover) {
		background: var(--house-on);
		color: var(--house-deep);
	}

	.meta {
		margin-top: 18px;
		display: flex;
		flex-wrap: wrap;
		gap: 6px 22px;
		font-size: 13px;
		font-weight: 600;
	}

	.head :global(::selection) {
		background: var(--house-on);
		color: var(--house);
	}

	.head :global(:focus-visible) {
		outline-color: var(--house-on);
	}
</style>
