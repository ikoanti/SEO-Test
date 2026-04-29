<script lang="ts">
	import type { BasePanelData } from '../types';
	import IssueListPanel from './IssueListPanel.svelte';

	let { panel }: { panel?: BasePanelData } = $props();
</script>

<IssueListPanel
	{panel}
	defaultTitle="Unoptimized Alt Tags"
	summaryNote={'Missing image alt tags found on {domain}'}
	defaultIssue="Image missing alt text"
	fields={[
		{ label: 'Page', key: 'page' },
		{ label: 'Image', key: 'image' }
	]}
/>
