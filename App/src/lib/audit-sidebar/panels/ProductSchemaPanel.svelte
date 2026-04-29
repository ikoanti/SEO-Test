<script lang="ts">
	import type { BasePanelData } from '../types';
	import IssueListPanel from './IssueListPanel.svelte';

	let { panel }: { panel?: BasePanelData } = $props();
</script>

<IssueListPanel
	{panel}
	defaultTitle="Missing product schema"
	summaryNote={'Product schema issues found on {domain}'}
	defaultIssue="Missing product schema"
	fields={[{ label: 'Page', key: 'page' }]}
/>
