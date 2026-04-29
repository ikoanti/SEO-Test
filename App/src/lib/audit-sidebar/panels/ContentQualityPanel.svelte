<script lang="ts">
	import type { BasePanelData } from '../types';
	import IssueListPanel from './IssueListPanel.svelte';

	let { panel }: { panel?: BasePanelData } = $props();
</script>

<IssueListPanel
	{panel}
	fields={[
		{ label: 'Page', key: 'page' },
		{ label: 'Word Count', key: 'wordCount', getValue: (entry) => entry.wordCount ?? entry.value ?? '' }
	]}
/>
