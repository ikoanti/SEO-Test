<script lang="ts">
	import type { AuditEntry, BasePanelData } from '../types';
	import AuditPanel from '../AuditPanel.svelte';
	import IssueList, { type IssueListField } from '../IssueList.svelte';

	let {
		panel,
		summaryLabel = 'Detected',
		fields = []
	}: {
		panel?: BasePanelData;
		summaryLabel?: string;
		fields?: IssueListField[];
	} = $props();

	let entries = $derived(Array.isArray(panel?.entries) ? panel.entries : []);
</script>

{#snippet highlight()}
	<div class="summary">
		<p class="summary-count">{panel?.count ?? entries.length}</p>
		<p class="summary-label">{summaryLabel}</p>
	</div>
{/snippet}

{#snippet content()}
	<IssueList {entries} {fields} />
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
</style>
