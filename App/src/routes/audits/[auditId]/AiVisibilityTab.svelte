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
	.card {
		background: var(--card-bg);
		border: 1px solid var(--border);
		border-radius: 18px;
		padding: 20px;
		transition: border-color 0.3s ease;
	}

	.audit-card {
		width: 100%;
		max-width: 800px;
		border-radius: 1rem;
		padding: 1.5rem;
	}

	.audit-card-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0 0 1rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--border);
		font-size: 1.25rem;
		font-weight: 600;
	}

	.section-subtitle {
		margin: -0.5rem 0 1rem;
		color: var(--text-muted);
		font-size: 0.85rem;
	}

	input,
	button {
		border-radius: 9999px;
		font: inherit;
	}

	input {
		padding: 16px 18px;
		border: 1px solid var(--border);
		background: rgba(24, 33, 43, 0.95);
		color: var(--text-main);
		outline: none;
		transition: border-color 0.3s ease;
	}

	input:focus {
		border-color: var(--goldenweb-primary);
	}

	input[type='file'] {
		padding: 10px 12px;
		border-radius: 16px;
		line-height: 1.2;
	}

	input[type='file']::file-selector-button {
		margin-right: 12px;
		padding: 10px 14px;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.05);
		color: var(--text-main);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	button {
		padding: 16px 22px;
		border: 0;
		background: linear-gradient(135deg, #3b82f6, #6366f1);
		color: white;
		font-weight: 600;
		cursor: pointer;
		transition: opacity 0.2s ease;
	}

	.audit-primary-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
	}

	.audit-upload-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	.audit-upload-row input[type='file'] {
		flex: 1 1 18rem;
		min-width: 0;
		max-width: 100%;
	}

	.audit-upload-row .audit-primary-button {
		flex: 0 1 auto;
		min-width: 0;
	}

	.metric-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.metric-card {
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

	@media (max-width: 760px) {
		.metric-grid {
			grid-template-columns: 1fr;
		}

		.audit-upload-row {
			flex-direction: column;
		}

		.audit-upload-row .audit-primary-button {
			width: 100%;
		}
	}
</style>
