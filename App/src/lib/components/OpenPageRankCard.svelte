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

<section class="audit-metric-section" id="section-opr">
	<h2>Open Page Rank</h2>
	{#if screenshot?.image_url}
		<figure class="audit-evidence">
			<img
				src={screenshot.image_url}
				alt={screenshot.title || 'Open Page Rank evidence screenshot'}
				loading="lazy"
			/>
		</figure>
	{/if}
	<div class="metric-grid">
		<div class="metric-cell">
			<span class="metric-label">Page Rank</span>
			<span class="metric-value">{pageRank}</span>
		</div>
		<div class="metric-cell">
			<span class="metric-label">Global Rank</span>
			<span class="metric-value">{globalRank}</span>
		</div>
	</div>
</section>

<style>
	.audit-metric-section {
		width: 100%;
		padding: 1.5rem 0;
		border-top: 1px solid var(--border);
	}

	.audit-metric-section:first-child {
		border-top: 0;
		padding-top: 0;
	}

	.audit-metric-section h2 {
		margin: 0 0 1rem;
		font-size: 1.35rem;
		font-weight: 800;
	}

	.audit-evidence {
		margin: 0 0 1rem;
		overflow: hidden;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		background: rgba(15, 23, 42, 0.72);
	}

	.audit-evidence img {
		display: block;
		width: 100%;
		height: auto;
	}

	.metric-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
		margin: 0;
	}

	.metric-cell {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 0.85rem 0;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}

	@media (max-width: 760px) {
		.metric-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
