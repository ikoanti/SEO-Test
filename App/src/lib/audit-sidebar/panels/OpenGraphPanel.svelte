<script lang="ts">
	import type { BasePanelData } from '../types';
	import IssueListPanel from './IssueListPanel.svelte';

	let { panel }: { panel?: BasePanelData } = $props();
</script>

<IssueListPanel
	{panel}
	summaryLabel="Missing"
	summaryNote={'OpenGraph tags missing on {domain}'}
	fields={[
		{ label: 'Property', key: 'property', strong: true },
		{ label: 'Page', key: 'page' }
	]}
/>
