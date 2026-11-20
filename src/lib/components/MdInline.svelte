<script lang="ts">
	// Inline Markdown from a notification, drawn as elements: never as HTML.
	import type { Inline } from '#lib/domain/markdown.ts';
	import Self from './MdInline.svelte';

	let { nodes }: { nodes: Inline[] } = $props();
</script>

{#each nodes as node, i (i)}{#if node.kind === 'text'}{node.text}{:else if node.kind === 'code'}<code
			>{node.text}</code
		>{:else if node.kind === 'strong'}<strong><Self nodes={node.children} /></strong
		>{:else if node.kind === 'em'}<em><Self nodes={node.children} /></em
		>{:else if node.kind === 'link'}<a href={node.href} target="_blank" rel="noopener noreferrer"
			><Self nodes={node.children} /></a
		>{/if}{/each}
