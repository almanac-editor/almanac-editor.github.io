<script lang="ts">
	// A line of notification text edited as formatted text: bold, italic,
	// code and links show as formatting, never as Markdown marks. The field is
	// built from parsed nodes (never from an HTML string) and read back into
	// Markdown on every keystroke. Pasting brings in plain text only.
	import { parseInline, type Inline } from '#lib/domain/markdown.ts';

	let {
		value,
		onchange,
		multiline = false,
		placeholder = '',
		label,
		class: klass = '',
		onenter,
		onemptyback
	}: {
		value: string;
		onchange: (value: string) => void;
		/** Shift+Enter starts a new line inside the text. */
		multiline?: boolean;
		placeholder?: string;
		label: string;
		class?: string;
		/** Enter pressed: the parent adds the next paragraph, item or row. */
		onenter?: () => void;
		/** Backspace in an empty field: the parent removes it. */
		onemptyback?: () => void;
	} = $props();

	let el: HTMLDivElement;
	let shown: string | null = null;

	function build(parent: Node, nodes: Inline[]) {
		for (const n of nodes) {
			if (n.kind === 'text') {
				n.text.split('\n').forEach((part, i) => {
					if (i > 0) parent.appendChild(document.createElement('br'));
					if (part) parent.appendChild(document.createTextNode(part));
				});
			} else if (n.kind === 'code') {
				const code = document.createElement('code');
				code.textContent = n.text;
				parent.appendChild(code);
			} else {
				const tag = n.kind === 'strong' ? 'strong' : n.kind === 'em' ? 'em' : 'a';
				const node = document.createElement(tag);
				if (n.kind === 'link') node.setAttribute('data-href', n.href);
				build(node, n.children);
				parent.appendChild(node);
			}
		}
	}

	function read(node: Node): string {
		let out = '';
		node.childNodes.forEach((child) => {
			if (child.nodeType === Node.TEXT_NODE) {
				out += (child.textContent ?? '').replace(/\u00a0/g, ' ');
				return;
			}
			if (!(child instanceof HTMLElement)) return;
			const inner = read(child);
			switch (child.tagName) {
				case 'BR':
					out += '\n';
					break;
				case 'STRONG':
				case 'B':
					out += inner.trim() ? `**${inner}**` : inner;
					break;
				case 'EM':
				case 'I':
					out += inner.trim() ? `*${inner}*` : inner;
					break;
				case 'CODE':
					out += `\`${child.textContent ?? ''}\``;
					break;
				case 'A': {
					const href = child.getAttribute('data-href') ?? child.getAttribute('href');
					out += href ? `[${inner}](${href})` : inner;
					break;
				}
				case 'DIV':
				case 'P':
					out += (out && !out.endsWith('\n') ? '\n' : '') + inner;
					break;
				default:
					out += inner;
			}
		});
		return out;
	}

	function emit() {
		let text = read(el).replace(/\n+$/, '');
		if (!multiline) text = text.replace(/\s*\n\s*/g, ' ');
		shown = text;
		onchange(text);
	}

	// Draw the value when it changes from outside (loading, Cancel), never
	// while the teacher types, so the caret stays put.
	$effect(() => {
		const v = value;
		if (v === shown) return;
		shown = v;
		// The field's content is this component's own, never Svelte's: it is built here from parsed nodes.
		// eslint-disable-next-line svelte/no-dom-manipulating
		el.replaceChildren();
		build(el, parseInline(v));
	});

	function keydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			if (multiline && e.shiftKey) {
				e.preventDefault();
				document.execCommand('insertLineBreak');
				return;
			}
			e.preventDefault();
			onenter?.();
		} else if (e.key === 'Backspace' && !el.textContent && onemptyback) {
			e.preventDefault();
			onemptyback();
		} else if ((e.metaKey || e.ctrlKey) && (e.key === 'b' || e.key === 'i')) {
			e.preventDefault();
			document.execCommand(e.key === 'b' ? 'bold' : 'italic');
		}
	}

	function paste(e: ClipboardEvent) {
		e.preventDefault();
		const text = e.clipboardData?.getData('text/plain') ?? '';
		document.execCommand('insertText', false, multiline ? text : text.replace(/\s*\n\s*/g, ' '));
	}
</script>

<div
	bind:this={el}
	class="rich {klass}"
	contenteditable="true"
	role="textbox"
	tabindex="0"
	aria-label={label}
	aria-multiline={multiline}
	data-placeholder={placeholder}
	oninput={emit}
	onkeydown={keydown}
	onpaste={paste}
></div>

<style>
	.rich {
		min-height: 1.5em;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		cursor: text;
	}

	.rich:empty::before {
		content: attr(data-placeholder);
		color: var(--muted);
		pointer-events: none;
	}

	.rich :global(code) {
		font-family: var(--mono, ui-monospace, monospace);
		font-size: 0.92em;
	}

	.rich :global(a) {
		color: var(--house-deep);
		text-decoration: underline;
	}
</style>
