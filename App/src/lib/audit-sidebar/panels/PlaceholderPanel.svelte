<script lang="ts">
	import type { BasePanelData } from '../types';

	let { panel }: { panel?: BasePanelData } = $props();
</script>

<section class="section">
	{#if panel?.title}
		<h1 class="title">{panel.title}</h1>
	{/if}
	{#if panel?.description}
		<p class="copy">{panel.description}</p>
	{/if}
</section>

<style>
	@import './panel-shared.css';

	.title {
		color: #202124;
	}
</style>
