<script lang="ts">
	let {
		pageRank = '-',
		globalRank = '-'
	}: {
		pageRank?: string;
		globalRank?: string;
	} = $props();
</script>

<div class="card legacy-card card-ahrefs" id="card-opr">
	<div class="card-header">
		<h3>Open Page Rank</h3>
	</div>
	<div class="ahrefs-metrics">
		<div class="metric-item">
			<span class="metric-label">Page Rank</span>
			<span class="metric-value">{pageRank}</span>
		</div>
		<div class="metric-item">
			<span class="metric-label">Global Rank</span>
			<span class="metric-value">{globalRank}</span>
		</div>
	</div>
</div>

<style>
	.legacy-card {
		width: 100%;
		max-width: 800px;
		border-radius: 1rem;
		padding: 1.5rem;
	}

	.legacy-card h3 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0 0 1rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--border);
		font-size: 1.25rem;
		font-weight: 600;
	}

	.ahrefs-metrics {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.metric-item {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 1rem;
		border: 1px solid rgba(255, 255, 255, 0.05);
		border-radius: 0.75rem;
		background: rgba(255, 255, 255, 0.03);
	}

	.metric-label {
		color: var(--text-muted);
		font-size: 0.75rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.metric-value {
		color: #fff;
		font-size: 1.25rem;
		font-weight: 700;
	}

	@media (max-width: 760px) {
		.ahrefs-metrics {
			grid-template-columns: 1fr;
		}
	}
</style>
