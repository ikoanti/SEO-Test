<script lang="ts">
	let {
		pageRank = '-',
		globalRank = '-'
	}: {
		pageRank?: string;
		globalRank?: string;
	} = $props();
</script>

<div class="card audit-card" id="card-opr">
	<h3 class="audit-card-title">Open Page Rank</h3>
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
