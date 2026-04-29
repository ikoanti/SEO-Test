<script lang="ts">
	import type { BasePanelData } from '../types';
	import IssueListPanel from './IssueListPanel.svelte';

	let { panel }: { panel?: BasePanelData } = $props();
</script>

<IssueListPanel
	{panel}
	defaultTitle="Unoptimized OpenGraph Tags"
	summaryLabel="Missing"
	summaryNote={'OpenGraph tags missing on {domain}'}
	defaultIssue="OpenGraph tag missing"
	fields={[
		{ label: 'Property', key: 'property', strong: true },
		{ label: 'Page', key: 'page' }
	]}
/>
