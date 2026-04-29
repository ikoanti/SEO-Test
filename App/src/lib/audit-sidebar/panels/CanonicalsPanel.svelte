<script lang="ts">
	import type { BasePanelData } from '../types';
	import IssueListPanel from './IssueListPanel.svelte';

	let { panel }: { panel?: BasePanelData } = $props();
</script>

<IssueListPanel
	{panel}
	defaultTitle="Unoptimized Canonicals"
	summaryNote={'Canonical URL issues found on {domain}'}
	defaultIssue="Canonical issue"
	fields={[
		{ label: 'Canonical', key: 'value', strong: true },
		{ label: 'Page', key: 'page' }
	]}
/>
