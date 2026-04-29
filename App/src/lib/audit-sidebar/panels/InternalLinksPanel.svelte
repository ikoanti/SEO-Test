<script lang="ts">
	import type { BasePanelData } from '../types';
	import IssueListPanel from './IssueListPanel.svelte';

	let { panel }: { panel?: BasePanelData } = $props();
</script>

<IssueListPanel
	{panel}
	summaryNote={'Internal link issues found on {domain}'}
	fields={[
		{ label: 'Page', key: 'page' },
		{ label: 'Internal Links', key: 'count', strong: true, fallback: 0 }
	]}
/>
