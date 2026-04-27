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
	<div class="rank-grid">
		<div class="rank-stat">
			<span class="rank-label">Page Rank</span>
			<strong class="rank-value">{pageRank}</strong>
		</div>
		<div class="rank-stat">
			<span class="rank-label">Global Rank</span>
			<strong class="rank-value">{globalRank}</strong>
		</div>
	</div>
</div>

<style>
	.audit-card {
		overflow: hidden;
	}

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

	.rank-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
		width: 100%;
		min-width: 0;
	}

	.rank-stat {
		min-width: 0;
		padding: 1rem 0;
	}

	.rank-label {
		display: block;
		margin-bottom: 0.45rem;
		color: var(--text-muted);
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.rank-value {
		display: block;
		max-width: 100%;
		overflow-wrap: anywhere;
		color: var(--text-main);
		font-size: clamp(1.9rem, 5vw, 3rem);
		line-height: 0.95;
		font-weight: 800;
	}

	@media (max-width: 560px) {
		.rank-grid {
			grid-template-columns: 1fr;
			gap: 0.25rem;
		}
	}
</style>
