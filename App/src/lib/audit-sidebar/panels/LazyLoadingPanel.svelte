<script lang="ts">
	import type { BasePanelData } from '../types';
	import IssueListPanel from './IssueListPanel.svelte';

	let { panel }: { panel?: BasePanelData } = $props();
</script>

<IssueListPanel
	{panel}
	summaryNote={'Images missing lazy loading found on {domain}'}
	fields={[
		{ label: 'Page', key: 'page' },
		{ label: 'Image', key: 'image' }
	]}
/>
