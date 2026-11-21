<script lang="ts">
	// One class's assessment notification, laid out as students get it: the
	// logo and the year and subject line at the top of every page, the title,
	// then a label row per detail and per section. The layout is the one
	// `render_notification.py` gives the school's Word file (notificationPdf.ts).
	// "Save as PDF" prints the page, and the print styles keep only the sheet.
	// The teacher notes are never on it.
	import { page } from '$app/state';
	import Failure from '#lib/components/Failure.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import PageHead from '#lib/components/PageHead.svelte';
	import { assessmentPath } from '#lib/domain/assessments.ts';
	import type { Inline } from '#lib/domain/markdown.ts';
	import { notificationLayout } from '#lib/domain/notificationPdf.ts';
	import { stem } from '#lib/domain/paths.ts';
	import { className } from '#lib/house.ts';
	import { links } from '#lib/links.ts';
	import { session } from '#lib/session.svelte.ts';

	const o = $derived(page.url.searchParams.get('o') ?? '');
	const a = $derived(page.url.searchParams.get('a') ?? '');

	const load = $derived.by(() => {
		const data = session.data;
		if (!data || !o || !a) return null;
		return (async () => {
			const offerings = await data.offerings();
			const offering = offerings.find(([path]) => path === o)?.[1];
			if (!offering) throw new Error(`${o} is not a class in ${session.label}.`);
			const path = assessmentPath(o, a);
			if (!(await data.store.has(path))) {
				throw new Error(`${className(offering)} has no assessment at ${path}.`);
			}
			const spec = (await data.assessment(o, a)).doc;
			const [text, logo] = await Promise.all([data.text(spec.notification), data.logo()]);
			return {
				offering,
				spec,
				logo,
				layout: text === null ? null : notificationLayout(text)
			};
		})();
	});

	// The browser names the PDF after the page's title: the notification's file name.
	$effect(() => {
		const was = document.title;
		let live = true;
		load
			?.then(({ spec }) => {
				if (live) document.title = stem(spec.notification);
			})
			.catch(() => {});
		return () => {
			live = false;
			document.title = was;
		};
	});
</script>

<!-- Inline marks as they print: bold, italic, code; a link as its text. -->
{#snippet inline(
	nodes: Inline[]
)}{#each nodes as node, i (i)}{#if node.kind === 'text'}{node.text}{:else if node.kind === 'code'}<code
				>{node.text}</code
			>{:else if node.kind === 'strong'}<strong>{@render inline(node.children)}</strong
			>{:else if node.kind === 'em'}<em>{@render inline(node.children)}</em>{:else}{@render inline(
				node.children
			)}{/if}{/each}{/snippet}

{#if !o || !a}
	<PageHead title="No assessment given" />
	<div class="page">
		<div class="msg warn"><div>Open a notification from a class’s assessment page.</div></div>
	</div>
{:else if load}
	{#await load}
		<PageHead title={null} />
		<div class="page"><div class="loading"><span></span><span></span><span></span></div></div>
	{:then { offering, spec, logo, layout }}
		<PageHead
			crumbs={[
				{ href: links.home(), label: className(offering) },
				{ href: links.assessment(o, a), label: spec.title }
			]}
			title="Notification"
			lede="As students get it. The teacher notes are left out."
		>
			{#snippet actions()}
				{#if layout}
					<button class="btn" onclick={() => print()}>
						<Icon name="file" size={16} /> Save as PDF
					</button>
				{/if}
				<a class="btn" href={links.assessmentEdit(o, a)}>
					<Icon name="pencil" size={16} /> Edit
				</a>
			{/snippet}
		</PageHead>

		<div class="page">
			{#if layout === null}
				<div class="msg warn">
					<div>
						The notification <code>{spec.notification}</code> is not
						{session.source === 'folder' ? 'in the folder.' : 'in the repo.'} Editing the task makes it.
					</div>
				</div>
			{:else}
				<div class="notes no-print">
					<p>
						Save as PDF opens the print dialog. Choose <b>Save as PDF</b> as the destination. To change
						the wording, edit the task here, not the PDF.
					</p>
					{#if !logo}
						<p>
							No logo. Put one at <code>assets/logo.png</code> (or <code>.jpg</code>,
							<code>.svg</code>) and it shows top left on every page.
						</p>
					{/if}
				</div>

				<div class="preview">
					<div class="sheet">
						<table>
							<colgroup><col class="label-col" /><col /></colgroup>
							<thead>
								<tr>
									<td colspan="2">
										<div class="letterhead">
											<span class="logo"
												>{#if logo}<img src={logo} alt="" />{/if}</span
											>
											<b>{layout.subject ?? ''}</b>
										</div>
									</td>
								</tr>
							</thead>
							<tfoot>
								<tr><td colspan="2" class="foot"></td></tr>
							</tfoot>
							<tbody>
								<tr>
									<td colspan="2" class="title">
										<h2>
											{#if layout.lead}{`${layout.lead} `}{/if}<b>{layout.name}</b>
										</h2>
									</td>
								</tr>
								{#each layout.rows as row, r (r)}
									<tr class="row">
										<th scope="row">{row.label}</th>
										<td>
											{#each row.lines as line, l (l)}
												{#if line.kind === 'heading'}
													<p class="ln heading"><b>{@render inline(line.inline)}</b></p>
												{:else if line.kind === 'para'}
													<p class="ln para">{@render inline(line.inline)}</p>
												{:else if line.kind === 'item'}
													<p class="ln item" class:lead={line.bold} class:deep={line.level === 2}>
														<span class="mark">{line.mark}</span>
														<span
															>{#if line.bold}<b>{@render inline(line.inline)}</b
																>{:else}{@render inline(line.inline)}{/if}</span
														>
													</p>
												{:else if line.kind === 'quote'}
													<p class="ln quote"><i>{@render inline(line.inline)}</i></p>
												{:else}
													<p class="ln coded"><b>{line.code}</b><span>{line.text}</span></p>
												{/if}
											{/each}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}
		</div>
	{:catch error}
		<PageHead title="Could not open this notification" />
		<div class="page"><Failure {error} /></div>
	{/await}
{/if}

<style>
	/* The sheet: A4 in the school's house format, whatever the app's theme. The
	   measures are render_notification.py's: Arial 11, a 3.2cm label column
	   shaded D9D9D9, 808080 hairlines, 1.5cm side margins. */

	.notes {
		max-width: 21cm;
		margin: 0 auto 16px;
		color: var(--muted);
		font-size: 14px;
	}

	.notes p + p {
		margin-top: 6px;
	}

	.preview {
		overflow-x: auto;
		padding-bottom: 8px;
	}

	.sheet {
		box-sizing: border-box;
		width: 21cm;
		min-height: 29.7cm;
		margin: 0 auto;
		padding: 0 1.5cm;
		background: #fff;
		color: #000;
		box-shadow:
			0 1px 2px rgb(0 0 0 / 0.12),
			0 6px 24px rgb(0 0 0 / 0.1);
		font-family: Arial, 'Liberation Sans', Arimo, Helvetica, sans-serif;
		font-size: 11pt;
		line-height: 1.2;
		print-color-adjust: exact;
		-webkit-print-color-adjust: exact;
	}

	table {
		width: 18cm;
		table-layout: fixed;
		border-collapse: separate;
		/* A hair between label rows, so their hairlines don't double up. */
		border-spacing: 0 2pt;
	}

	/* The letterhead, repeated at the top of every printed page. */
	thead td {
		padding: 0.8cm 0 0.25cm;
	}

	.letterhead {
		display: grid;
		grid-template-columns: 6cm 1fr;
		align-items: end;
	}

	.logo {
		align-self: center;
	}

	.logo img {
		display: block;
		width: 4.5cm;
		height: auto;
	}

	.letterhead b {
		text-align: right;
		font-size: 14pt;
	}

	/* The bottom margin, repeated on every printed page. */
	.foot {
		height: 1.5cm;
		padding: 0;
	}

	.title {
		padding: 0 0 8pt;
	}

	.title h2 {
		margin: 0;
		font-size: 14pt;
		font-weight: 400;
	}

	.row th,
	.row td {
		padding: 3pt 6pt;
		border: 0.5pt solid #808080;
		vertical-align: top;
		text-align: left;
	}

	.label-col {
		width: 3.2cm;
	}

	.row th {
		border-right: 0;
		background: #d9d9d9;
		font-weight: 700;
		vertical-align: middle;
	}

	.ln {
		margin: 0;
		break-inside: avoid;
	}

	.ln.para + .ln,
	.ln + .ln.para,
	.ln + .ln.lead {
		margin-top: 4pt;
	}

	.ln + .ln.heading {
		margin-top: 6pt;
	}

	.ln.heading {
		break-after: avoid;
	}

	/* Bullets hang: the mark at 0.1cm, the text at 0.5cm; a level deeper at 1.1cm. */
	.ln.item {
		display: grid;
		grid-template-columns: minmax(0.4cm, max-content) 1fr;
		margin-left: 0.1cm;
		margin-bottom: 2pt;
	}

	.ln.item.deep {
		margin-left: 0.7cm;
	}

	.ln.item.lead {
		break-after: avoid;
	}

	.ln.quote {
		margin: 4pt 0 4pt 0.5cm;
	}

	.ln.coded {
		display: grid;
		grid-template-columns: 2.6cm 1fr;
		margin-bottom: 3pt;
	}

	code {
		font-family: Consolas, 'Courier New', monospace;
	}

	@page {
		size: A4;
		margin: 0;
	}

	/* Only the sheet prints. With no page margin, the browser adds no header or
	   footer of its own; the table's head and foot repeat as the margins. */
	@media print {
		:global(.topbar),
		:global(.rail),
		:global(.scrim),
		:global(header.head),
		.no-print {
			display: none !important;
		}

		:global(.app) {
			display: block;
			min-height: 0;
		}

		:global(main),
		:global(.page) {
			padding: 0 !important;
			margin: 0 !important;
			max-width: none !important;
		}

		:global(html),
		:global(body) {
			background: #fff !important;
		}

		.preview {
			overflow: visible;
			padding: 0;
		}

		.sheet {
			width: auto;
			min-height: 0;
			box-shadow: none;
		}
	}
</style>
