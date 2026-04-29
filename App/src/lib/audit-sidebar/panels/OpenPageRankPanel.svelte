<script lang="ts">
	import type { BasePanelData } from '../types';

	let {
		panel
	}: {
		panel?: BasePanelData & {
			openPageRank?: { pageRank?: string | number; globalRank?: string | number };
		};
	} = $props();
	let rank = $derived(panel?.openPageRank ?? {});
</script>

<section class="section">
	{#if panel?.title}
		<h1 class="title">{panel.title}</h1>
	{/if}
	{#if panel?.description}
		<p class="copy">{panel.description}</p>
	{/if}
</section>
<section class="section">
	<div class="rank-stack">
		<article class="rank-panel-stat">
			<p class="rank-panel-label">Page Rank</p>
			<p class="rank-panel-value">{rank.pageRank ?? 'N/A'}</p>
		</article>
		<article class="rank-panel-stat">
			<p class="rank-panel-label">Global Rank</p>
			<p class="rank-panel-value">{rank.globalRank ?? 'N/A'}</p>
		</article>
	</div>
</section>

<style>
	@import './panel-shared.css';

	.rank-stack {
		display: grid;
		gap: 12px;
		min-width: 0;
	}

	.rank-panel-stat {
		min-width: 0;
		padding: 14px;
		border: 1px solid #e0e3e7;
		border-radius: 14px;
		background: #fff;
	}

	.rank-panel-label {
		margin: 0 0 8px;
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #5f6368;
	}

	.rank-panel-value {
		margin: 0;
		max-width: 100%;
		overflow-wrap: anywhere;
		font-size: 38px;
		line-height: 1;
		font-weight: 800;
		color: #1a73e8;
	}
</style>
