<script lang="ts">
	import type { BasePanelData } from '../types';
	import IssueListPanel from './IssueListPanel.svelte';

	let { panel }: { panel?: BasePanelData } = $props();
</script>

<IssueListPanel
	{panel}
	defaultTitle="Unoptimized Shopify URL Structure"
	summaryNote={'Shopify URL structure issues found on {domain}'}
	defaultIssue="Shopify URL pattern detected"
	fields={[
		{ label: 'Page', key: 'page' },
		{ label: 'Pattern', key: 'pattern', strong: true }
	]}
/>
