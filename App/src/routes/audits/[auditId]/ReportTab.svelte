<script lang="ts">
	import { resolve } from '$app/paths';
	import CustomCheckmark from '$lib/components/CustomCheckmark.svelte';
	import { Cloud, ExternalLink, FileText, Image as ImageIcon } from 'lucide-svelte';
	import type { ReportPreviewItem } from './types';

	let {
		auditId,
		canExport,
		isPending,
		isFailed,
		reportPreviewItems,
		reportSelectionMin,
		reportSelectionIsValid,
		selectedReportKeys = $bindable(),
		formElement = $bindable(),
		googleExportIsRunning,
		googleExportUrl,
		googleExportError,
		onExportGoogleDoc
	}: {
		auditId: string;
		canExport: boolean;
		isPending: boolean;
		isFailed: boolean;
		reportPreviewItems: ReportPreviewItem[];
		reportSelectionMin: number;
		reportSelectionIsValid: boolean;
		selectedReportKeys: string[];
		formElement?: HTMLFormElement;
		googleExportIsRunning: boolean;
		googleExportUrl: string;
		googleExportError: string;
		onExportGoogleDoc: () => void;
	} = $props();
</script>

<div class="card audit-card" id="card-report">
	<h3 class="audit-card-title">Export</h3>
	{#if canExport}
		<form
			bind:this={formElement}
			method="GET"
			action={resolve(`/api/audits/${auditId}/export.docx`)}
			class="report-builder"
		>
			<div class="report-builder-header">
				<div>
					<p class="report-builder-title">Review export findings</p>
					<p class="muted report-builder-copy">
						Select {reportSelectionMin}-10 findings. These previews are exactly what will appear in
						the final export.
					</p>
				</div>
				<span class="report-selection-count"
					>{selectedReportKeys.length}/{reportPreviewItems?.length ?? 0} selected</span
				>
			</div>

			{#if reportPreviewItems?.length}
				<div class="report-preview-list">
					{#each reportPreviewItems as item (item.key)}
						<label class="report-preview-item">
							<input
								type="checkbox"
								name="reportTemplateKey"
								value={item.key}
								bind:group={selectedReportKeys}
							/>
							<CustomCheckmark
								checked={selectedReportKeys.includes(item.key)}
								label={`${item.title} selected`}
							/>
							<div class="report-preview-body">
								<div class="report-preview-heading">
									<span>{item.title}</span>
									<span class="report-priority">{item.priority}</span>
								</div>
								{#each item.paragraphs as paragraph, index (`${item.key}-paragraph-${index}`)}
									<p>{paragraph}</p>
								{/each}
								<div
									class:report-preview-proof-placeholder={!item.screenshot?.image_url}
									class="report-preview-proof"
								>
									{#if item.screenshot?.image_url}
										<img
											src={item.screenshot.image_url}
											alt={item.screenshot.title || item.title}
										/>
									{:else}
										<ImageIcon size={34} strokeWidth={1.6} aria-hidden="true" />
									{/if}
								</div>
							</div>
						</label>
					{/each}
				</div>
			{:else}
				<p class="muted report-status-note">
					No export-ready findings are available for this audit.
				</p>
			{/if}

			<div class="report-export-strip">
				<div class="report-export-actions">
					<button
						type="button"
						class="audit-primary-button"
						disabled={!reportSelectionIsValid || googleExportIsRunning}
						onclick={onExportGoogleDoc}
					>
						<Cloud size={18} />
						<span>{googleExportIsRunning ? 'Exporting...' : 'Export to Google Docs'}</span>
					</button>
					<button type="submit" class="audit-secondary-button" disabled={!reportSelectionIsValid}>
						<FileText size={18} />
						<span>Download DOCX</span>
					</button>
				</div>
				{#if googleExportUrl}
					<a class="google-doc-link" href={googleExportUrl} target="_blank" rel="noreferrer">
						<ExternalLink size={17} />
						<span>Open Google Doc</span>
					</a>
				{/if}
				{#if googleExportError}
					<p class="report-error">{googleExportError}</p>
				{/if}
			</div>
		</form>
	{:else}
		<p class="muted report-status-note">
			{#if isPending}
				Available after the audit completes.
			{:else if isFailed}
				Unavailable because the audit run failed.
			{:else}
				Available after audit completion.
			{/if}
		</p>
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

	.muted {
		color: var(--text-muted);
	}

	button {
		border-radius: 9999px;
		font: inherit;
		padding: 16px 22px;
		border: 0;
		background: linear-gradient(135deg, #3b82f6, #6366f1);
		color: white;
		font-weight: 600;
		cursor: pointer;
		transition: opacity 0.2s ease;
	}

	button:disabled {
		cursor: not-allowed;
		opacity: 0.65;
	}

	.audit-primary-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
	}

	#card-report {
		--report-border: rgba(58, 71, 88, 0.9);
		background: var(--card-bg);
		border-color: var(--report-border);
		color: var(--text-main);
	}

	#card-report :global(button),
	#card-report :global(a),
	#card-report :global(input) {
		outline-color: var(--goldenweb-primary);
	}

	#card-report :global(button:focus-visible),
	.google-doc-link:focus-visible,
	.report-preview-item:has(input:focus-visible) {
		outline: 2px solid var(--goldenweb-primary);
		outline-offset: 3px;
	}

	.report-error {
		margin: 0.75rem 0;
		color: #fca5a5;
	}

	.report-status-note {
		margin: 0 0 1rem;
	}

	.report-builder {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.report-builder-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	.report-builder-title {
		margin: 0 0 0.35rem;
		color: var(--text-primary);
		font-size: 1.05rem;
		font-weight: 800;
	}

	.report-builder-copy {
		margin: 0;
	}

	.report-selection-count {
		flex: 0 0 auto;
		border: 1px solid var(--report-border);
		border-radius: 999px;
		padding: 0.55rem 0.85rem;
		color: var(--text-muted);
		font-size: 0.9rem;
		font-weight: 800;
	}

	.report-preview-list {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		padding-bottom: 0.75rem;
	}

	.report-preview-item {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.9rem;
		padding: 1rem;
		border: 1px solid var(--report-border);
		border-radius: 18px;
		background: rgba(9, 14, 22, 0.28);
		cursor: pointer;
	}

	.report-preview-item input {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.report-preview-item:has(input:focus-visible) {
		border-color: var(--goldenweb-primary);
	}

	.report-preview-body {
		min-width: 0;
	}

	.report-preview-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.65rem;
		color: var(--text-primary);
		font-size: 1rem;
		font-weight: 900;
	}

	.report-priority {
		flex: 0 0 auto;
		color: var(--goldenweb-primary);
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.report-export-strip {
		position: sticky;
		z-index: 5;
		bottom: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin: 0 -1.5rem -1.5rem;
		padding: 1rem 1.5rem;
		border-top: 1px solid var(--report-border);
		border-radius: 0 0 18px 18px;
		background: rgba(9, 14, 22, 0.96);
		backdrop-filter: blur(12px);
		box-shadow: 0 -14px 34px rgba(0, 0, 0, 0.24);
	}

	.report-export-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.audit-secondary-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		border: 1px solid var(--report-border);
		background: rgba(15, 23, 42, 0.86);
		color: var(--text-primary);
	}

	.audit-secondary-button:hover,
	.audit-secondary-button:focus-visible {
		border-color: rgba(255, 183, 27, 0.72);
		background: rgba(15, 23, 42, 0.96);
	}

	.google-doc-link {
		display: inline-flex;
		align-items: center;
		flex: 0 0 auto;
		gap: 0.45rem;
		width: fit-content;
		color: var(--goldenweb-primary);
		font-weight: 800;
		text-decoration: none;
	}

	.report-preview-body p {
		margin: 0 0 0.65rem;
		color: var(--text-muted);
		font-size: 0.95rem;
		line-height: 1.55;
	}

	.report-preview-proof {
		display: flex;
		align-items: center;
		justify-content: center;
		margin-top: 0.85rem;
		aspect-ratio: 16 / 9;
		max-height: 260px;
		overflow: hidden;
		border: 1px solid var(--report-border);
		border-radius: 12px;
		background: rgba(148, 163, 184, 0.08);
	}

	.report-preview-proof img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.report-preview-proof-placeholder {
		color: var(--text-muted);
	}

	@media (max-width: 760px) {
		.report-export-strip {
			align-items: stretch;
			flex-direction: column;
			margin-right: -1rem;
			margin-left: -1rem;
			padding: 0.85rem 1rem;
		}

		.report-export-actions {
			flex-direction: column;
		}

		.report-export-actions :global(button),
		.report-export-actions button {
			width: 100%;
		}
	}
</style>
