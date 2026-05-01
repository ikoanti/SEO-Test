<script lang="ts">
	import type { BasePanelData } from '../types';
	import AuditPanel from '../AuditPanel.svelte';
	import ImageIssueListPanelBody from './ImageIssueListPanelBody.svelte';

	let { panel }: { panel?: BasePanelData } = $props();

	let entries = $derived(Array.isArray(panel?.entries) ? panel.entries : []);
	let title = $derived(panel?.title || 'Lazy Load Images');
</script>

{#snippet highlight()}
	<div class="summary">
		<p class="summary-count">{panel?.count ?? entries.length}</p>
		<p class="summary-label">Detected</p>
	</div>
{/snippet}

{#snippet content()}
	<ImageIssueListPanelBody {entries} />
{/snippet}

<AuditPanel {title} {highlight} {content} />

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
</style>
