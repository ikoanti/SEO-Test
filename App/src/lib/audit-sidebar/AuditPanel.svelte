<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		header,
		highlight,
		content
	}: {
		title?: string;
		header?: Snippet;
		highlight?: Snippet;
		content?: Snippet;
	} = $props();
</script>

{#if title || header}
	<section class="section">
		{#if header}
			{@render header()}
		{:else if title}
			<h1 class="title">{title}</h1>
		{/if}
	</section>
{/if}

{#if highlight}
	<section class="section">
		{@render highlight()}
	</section>
{/if}

{#if content}
	<section class="section">
		{@render content()}
	</section>
{/if}

<style>
	.section {
		padding-top: 18px;
	}

	.section:first-child {
		padding-top: 0;
	}

	.title {
		margin: 0;
		font-size: 28px;
		line-height: 1.08;
		font-weight: 700;
		color: #d93025;
	}
</style>
