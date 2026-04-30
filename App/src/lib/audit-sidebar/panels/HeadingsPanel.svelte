<script lang="ts">
	import { X } from 'lucide-svelte';
	import type { BasePanelData } from '../types';
	import AuditPanel from '../AuditPanel.svelte';

	let { panel }: { panel?: BasePanelData } = $props();

	let entries = $derived(Array.isArray(panel?.entries) ? panel.entries : []);
	let isMultipleH1 = $derived(
		entries.some((entry) => Array.isArray(entry.headings) && entry.headings.length > 0) ||
			String(panel?.title || '')
				.toLowerCase()
				.includes('multiple')
	);

	function displayPage(value?: string) {
		if (!value) return '';

		try {
			const url = new URL(value);
			return `${url.hostname}${url.pathname}${url.search}`;
		} catch {
			return value;
		}
	}

	function h1Code(value: string) {
		return `<h1>${value}</h1>`;
	}
</script>

{#snippet highlight()}
	<div class="summary">
		<p class="summary-count">{panel?.count ?? entries.length}</p>
		<p class="summary-label">Detected</p>
	</div>
{/snippet}

{#snippet content()}
	<div class="list">
		{#each entries as entry}
			<article class="card" class:multiple-card={isMultipleH1}>
				{#if isMultipleH1}
					<div class="card-head">
						<div class="badge"><X size={14} strokeWidth={3} aria-hidden="true" /></div>
						<p class="card-title">Duplicate</p>
					</div>
					<div class="heading-blocks">
						{#each entry.headings?.length ? entry.headings : [''] as heading, index}
							<div class="heading-block">
								{#if entry.page}
									<p class="page-link">{displayPage(entry.page)}</p>
								{/if}
								<pre><code>{h1Code(heading)}</code></pre>
							</div>
							{#if index < (entry.headings?.length || 1) - 1}
								<div class="divider"></div>
							{/if}
						{/each}
					</div>
				{:else}
					<div class="missing-row">
						<div class="badge"><X size={14} strokeWidth={3} aria-hidden="true" /></div>
						{#if entry.page}
							<p class="page-link">{displayPage(entry.page)}</p>
						{/if}
					</div>
				{/if}
			</article>
		{/each}
	</div>
{/snippet}

<AuditPanel title={panel?.title} {highlight} {content} />

<style>
	.summary {
		margin-top: 18px;
		padding: 18px 12px 14px;
		text-align: center;
	}

	.summary-label {
		margin: 8px 0 0;
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: #5f6368;
	}

	.summary-count {
		margin: 0;
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
		border-radius: 8px;
		padding: 14px;
		background: #fff;
		overflow: hidden;
	}

	.multiple-card {
		padding-bottom: 12px;
	}

	.card-head,
	.missing-row {
		display: grid;
		grid-template-columns: 22px minmax(0, 1fr);
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
		color: #d93025;
		background: #fce8e6;
	}

	.card-title {
		margin: 0;
		font-size: 15px;
		font-weight: 700;
		line-height: 1.35;
		color: #d93025;
	}

	.heading-blocks {
		margin-top: 12px;
		display: grid;
		gap: 10px;
	}

	.heading-block {
		min-width: 0;
		display: grid;
		gap: 6px;
	}

	.page-link {
		margin: 0;
		min-width: 0;
		font-size: 12px;
		line-height: 1.45;
		font-weight: 500;
		color: #1a73e8;
		overflow-wrap: anywhere;
		word-break: break-word;
	}

	pre {
		margin: 0;
		min-width: 0;
		overflow-x: auto;
		border-radius: 6px;
		background: #f8f9fa;
		padding: 9px 10px;
	}

	code {
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
		font-size: 11px;
		line-height: 1.45;
		color: #202124;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	.divider {
		height: 1px;
		background: #e0e3e7;
	}
</style>
