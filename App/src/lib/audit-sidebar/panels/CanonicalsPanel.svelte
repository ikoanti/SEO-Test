<script lang="ts">
	import type { BasePanelData } from '../types';
	import IssueListPanel from './IssueListPanel.svelte';

	let { panel }: { panel?: BasePanelData } = $props();
</script>

<IssueListPanel
	{panel}
	summaryNote={'Canonical URL issues found on {domain}'}
	fields={[
		{ label: 'Canonical', key: 'value', strong: true },
		{ label: 'Page', key: 'page' }
	]}
/>
