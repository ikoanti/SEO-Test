<script lang="ts">
	let {
		pageRank = '-',
		globalRank = '-',
		screenshot = null
	}: {
		pageRank?: string;
		globalRank?: string;
		screenshot?: {
			title?: string;
			image_url?: string;
		} | null;
	} = $props();
</script>

<div class="card audit-card" id="card-opr">
	<h3 class="audit-card-title">Open Page Rank</h3>
	{#if screenshot?.image_url}
		<div class="card-image-proof">
			<img
				src={screenshot.image_url}
				alt={screenshot.title || 'Open Page Rank evidence screenshot'}
				loading="lazy"
			/>
		</div>
	{/if}
	<div class="metric-grid">
		<div class="metric-card">
			<span class="metric-label">Page Rank</span>
			<span class="metric-value">{pageRank}</span>
		</div>
		<div class="metric-card">
			<span class="metric-label">Global Rank</span>
			<span class="metric-value">{globalRank}</span>
		</div>
	</div>
</div>

<style>
	.card-image-proof {
		margin: 0 0 1rem;
		overflow: hidden;
		border: 1px solid var(--border);
		border-radius: 0.9rem;
		background: rgba(15, 23, 42, 0.72);
	}

	.card-image-proof img {
		display: block;
		width: 100%;
		height: auto;
	}
</style>
