<script lang="ts">
	import type { BasePanelData } from '../types';
	import IssueListPanel from './IssueListPanel.svelte';

	let { panel }: { panel?: BasePanelData } = $props();
</script>

<IssueListPanel
	{panel}
	summaryNote={'Broken links found on {domain}'}
	cardTitle={(_, index) => `Broken link #${index + 1}`}
	fields={[
		{ label: 'Page', key: 'page' },
		{ label: 'Link', key: 'link' }
	]}
/>
