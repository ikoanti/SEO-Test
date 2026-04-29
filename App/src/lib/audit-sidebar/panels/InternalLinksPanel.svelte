<script lang="ts">
	import type { BasePanelData } from '../types';
	import IssueListPanel from './IssueListPanel.svelte';

	let { panel }: { panel?: BasePanelData } = $props();
</script>

<IssueListPanel
	{panel}
	defaultTitle="Unoptimized Internal Links"
	summaryNote={'Internal link issues found on {domain}'}
	defaultIssue="Internal link issue"
	fields={[
		{ label: 'Page', key: 'page' },
		{ label: 'Internal Links', key: 'count', strong: true, fallback: 0 }
	]}
/>
