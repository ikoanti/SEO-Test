<script lang="ts">
	import { FileUp } from 'lucide-svelte';
	import type { ActionData } from './$types';

	let {
		aiVisibility,
		form
	}: {
		aiVisibility: Record<string, unknown> | null;
		form?: ActionData;
	} = $props();
</script>

<div class="card audit-card" id="card-ai-visibility">
	<h3 class="audit-card-title">AI Visibility Analysis</h3>
	<p class="section-subtitle">Upload an AI Visibility PDF report to extract key metrics</p>
	<form method="POST" action="?/parsePdf" enctype="multipart/form-data" class="audit-upload-row">
		<input name="pdf" type="file" accept="application/pdf" required />
		<button type="submit" class="audit-primary-button">
			<FileUp size={18} />
			<span>Analyze PDF</span>
		</button>
	</form>
	{#if form?.pdfError}
		<p class="report-error">{form.pdfError}</p>
	{/if}

	{#if aiVisibility}
		<div class="metric-grid ai-visibility-results">
			<div class="metric-card">
				<span class="metric-label">AI Visibility</span>
				<span class="metric-value highlight-yellow">{aiVisibility.aiVisibility ?? '-'}</span>
			</div>
			<div class="metric-card">
				<span class="metric-label">Monthly Audience</span>
				<span class="metric-value highlight-green">{aiVisibility.monthlyAudience ?? '-'}</span>
			</div>
			<div class="metric-card">
				<span class="metric-label">Mentions</span>
				<span class="metric-value highlight-green">{aiVisibility.mentions ?? '-'}</span>
			</div>
			<div class="metric-card">
				<span class="metric-label">Cited Pages</span>
				<span class="metric-value highlight-green">{aiVisibility.citedPages ?? '-'}</span>
			</div>
			<div class="metric-card">
				<span class="metric-label">Perf. Topics</span>
				<span class="metric-value highlight-yellow">{aiVisibility.performingTopics ?? '-'}</span>
			</div>
			<div class="metric-card">
				<span class="metric-label">Topic Opps</span>
				<span class="metric-value highlight-yellow">{aiVisibility.topicOpportunities ?? '-'}</span>
			</div>
			<div class="metric-card">
				<span class="metric-label">Cited Sources</span>
				<span class="metric-value highlight-yellow">{aiVisibility.citedSources ?? '-'}</span>
			</div>
			<div class="metric-card">
				<span class="metric-label">Source Opps</span>
				<span class="metric-value highlight-yellow">{aiVisibility.sourceOpportunities ?? '-'}</span>
			</div>
		</div>
	{/if}
</div>

<style>
	.highlight-yellow {
		color: var(--goldenweb-primary);
	}

	.highlight-green {
		color: var(--status-pass);
	}

	.report-error {
		margin: 0.75rem 0;
		color: #fca5a5;
	}

	.ai-visibility-results {
		margin-top: 1rem;
		margin-bottom: 0;
	}
</style>
