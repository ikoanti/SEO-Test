<script lang="ts">
	import type { BasePanelData } from '../types';
	import IssueListPanel from './IssueListPanel.svelte';

	let { panel }: { panel?: BasePanelData } = $props();
</script>

<IssueListPanel
	{panel}
	defaultTitle="Broken Links"
	summaryNote={'Broken links found on {domain}'}
	defaultIssue="Broken link"
	cardTitle={(_, index) => `Broken link #${index + 1}`}
	fields={[
		{ label: 'Page', key: 'page' },
		{ label: 'Link', key: 'link' }
	]}
/>
