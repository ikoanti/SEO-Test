<script lang="ts">
	import type { BasePanelData } from '../types';
	import AuditPanel from '../AuditPanel.svelte';

	let { panel }: { panel?: BasePanelData } = $props();
</script>

{#snippet header()}
	{#if panel?.title}
		<h1 class="title">{panel.title}</h1>
	{/if}
{/snippet}

<AuditPanel {header} />

<style>
	.title {
		margin: 0;
		font-size: 28px;
		line-height: 1.08;
		font-weight: 700;
		color: #202124;
	}
</style>
