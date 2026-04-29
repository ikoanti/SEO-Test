<script lang="ts">
	import { X } from 'lucide-svelte';
	import type { AuditEntry, BasePanelData } from '../types';
	import FormattedValue from './FormattedValue.svelte';

	type FieldConfig = {
		label: string;
		key: keyof AuditEntry;
		strong?: boolean;
		preview?: boolean;
		getValue?: (entry: AuditEntry) => unknown;
	};

	let {
		panel,
		summaryLabel = 'Detected',
		fields = []
	}: {
		panel?: BasePanelData;
		summaryLabel?: string;
		fields?: FieldConfig[];
	} = $props();

	let entries = $derived(Array.isArray(panel?.entries) ? panel.entries : []);
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
	<div class="summary">
		<p class="summary-label">{summaryLabel}</p>
		<p class="summary-count">{panel?.count ?? entries.length}</p>
	</div>
</section>
<section class="section">
	<div class="list">
		{#each entries as entry}
			<article class="card">
				<div class="card-head">
					<div class="badge"><X size={14} strokeWidth={3} aria-hidden="true" /></div>
					<p class="card-title">{entry.issue}</p>
				</div>
				<div class="meta">
					{#each fields as field}
						{@const value = field.getValue?.(entry) ?? entry[field.key]}
						{#if value !== undefined && value !== null && value !== ''}
							<div>
								<p class="meta-label">{field.label}</p>
								<p
									class:meta-value-strong={field.strong}
									class:meta-value-preview={field.preview}
									class="meta-value"
								>
									<FormattedValue value={value} />
								</p>
							</div>
						{/if}
					{/each}
				</div>
			</article>
		{/each}
	</div>
</section>

<style>
	:global(.audit-sidebar-panel) {
		display: block;
		color: #202124;
		font-family: Arial, Helvetica, sans-serif;
	}

	.section {
		padding-top: 18px;
	}

	.section:first-child {
		padding-top: 0;
	}

	.title {
		margin: 0;
		font-size: 28px;
		line-height: 1.08;
		font-weight: 700;
		color: #d93025;
	}

	.copy {
		margin: 10px 0 0;
		font-size: 13px;
		line-height: 1.55;
		color: #5f6368;
	}

	.summary {
		margin-top: 18px;
		padding: 18px 12px 14px;
		text-align: center;
	}

	.summary-label {
		margin: 0;
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: #5f6368;
	}

	.summary-count {
		margin: 8px 0 0;
		font-size: 64px;
		line-height: 1;
		font-weight: 700;
		color: #d93025;
	}

	.list {
		margin-top: 16px;
		display: grid;
		gap: 12px;
	}

	.card {
		border: 1px solid #e0e3e7;
		border-radius: 14px;
		padding: 14px;
		background: #fff;
		overflow: hidden;
	}

	.card-head {
		display: grid;
		grid-template-columns: 22px 1fr;
		gap: 10px;
		align-items: center;
		min-width: 0;
	}

	.badge {
		width: 22px;
		height: 22px;
		border-radius: 999px;
		display: grid;
		place-items: center;
		font-size: 13px;
		font-weight: 700;
		color: #d93025;
		background: #fce8e6;
	}

	.card-title {
		margin: 0;
		font-size: 15px;
		font-weight: 700;
		line-height: 1.35;
		color: #d93025;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
	}

	.meta {
		margin-top: 10px;
		display: grid;
		gap: 8px;
		min-width: 0;
	}

	.meta-label {
		margin: 0;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: #5f6368;
	}

	.meta-value {
		margin: 2px 0 0;
		min-width: 0;
		font-size: 12px;
		line-height: 1.45;
		color: #202124;
		overflow-wrap: anywhere;
		word-break: break-word;
	}

	.meta-value-strong {
		font-weight: 700;
	}

	.meta-value-preview {
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 3;
		line-clamp: 3;
	}
</style>
