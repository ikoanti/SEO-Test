<script lang="ts">
	import type { BasePanelData } from '../types';
	import IssueListPanel from './IssueListPanel.svelte';

	let { panel }: { panel?: BasePanelData } = $props();
</script>

<IssueListPanel
	{panel}
	summaryNote={'Shopify URL structure issues found on {domain}'}
	fields={[
		{ label: 'Page', key: 'page' },
		{ label: 'Pattern', key: 'pattern', strong: true }
	]}
/>
