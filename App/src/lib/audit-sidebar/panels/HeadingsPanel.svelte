<script lang="ts">
	import type { BasePanelData } from '../types';
	import IssueListPanel from './IssueListPanel.svelte';

	let { panel }: { panel?: BasePanelData } = $props();
</script>

<IssueListPanel
	{panel}
	defaultTitle="Unoptimized Heading Tags"
	summaryNote={'Heading issues found on {domain}'}
	defaultIssue="Heading issue"
	fields={[{ label: 'Page', key: 'page' }]}
/>
