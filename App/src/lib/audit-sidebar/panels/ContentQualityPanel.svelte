<script lang="ts">
	import type { BasePanelData } from '../types';
	import IssueListPanel from './IssueListPanel.svelte';

	let { panel }: { panel?: BasePanelData } = $props();
</script>

<IssueListPanel
	{panel}
	summaryNote={'Thin content pages found on {domain}'}
	fields={[
		{ label: 'Page', key: 'page' },
		{ label: 'Word Count', key: 'wordCount', getValue: (entry) => entry.wordCount ?? entry.value ?? '' }
	]}
/>
