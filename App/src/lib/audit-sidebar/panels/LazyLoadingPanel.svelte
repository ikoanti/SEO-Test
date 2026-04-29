<script lang="ts">
	import type { BasePanelData } from '../types';
	import IssueListPanel from './IssueListPanel.svelte';

	let { panel }: { panel?: BasePanelData } = $props();
</script>

<IssueListPanel
	{panel}
	defaultTitle="Unoptimized Lazy Loading"
	summaryNote={'Images missing lazy loading found on {domain}'}
	defaultIssue="Image missing lazy loading"
	fields={[
		{ label: 'Page', key: 'page' },
		{ label: 'Image', key: 'image' }
	]}
/>
