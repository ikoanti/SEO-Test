<script lang="ts">
	import type { BasePanelData } from '../types';
	import IssueListPanel from './IssueListPanel.svelte';

	let { panel }: { panel?: BasePanelData } = $props();
</script>

<IssueListPanel
	{panel}
	defaultTitle="Thin Content"
	summaryNote={'Thin content pages found on {domain}'}
	defaultIssue="Thin content detected"
	fields={[
		{ label: 'Page', key: 'page' },
		{ label: 'Word Count', key: 'wordCount', getValue: (entry) => entry.wordCount ?? entry.value ?? '' }
	]}
/>
