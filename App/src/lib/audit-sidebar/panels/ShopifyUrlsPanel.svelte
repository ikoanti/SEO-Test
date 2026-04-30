<script lang="ts">
	import shopifyLogo from '$lib/assets/shopify/shopify-logo.png';
	import type { BasePanelData } from '../types';
	import AuditPanel from '../AuditPanel.svelte';
	import IssueList from '../IssueList.svelte';

	let { panel }: { panel?: BasePanelData } = $props();
	let entries = $derived(Array.isArray(panel?.entries) ? panel.entries : []);
</script>

{#snippet header()}
	<div class="shopify-brand">
		<img src={shopifyLogo} alt="Shopify" />
	</div>
{/snippet}

{#snippet content()}
	<IssueList
		{entries}
		fields={[
			{ label: 'Page', key: 'page' },
			{ label: 'Pattern', key: 'pattern', strong: true }
		]}
	/>
{/snippet}

<AuditPanel {header} {content} />

<style>
	.shopify-brand {
		width: 100%;
		margin: 0 0 16px;
	}

	.shopify-brand img {
		display: block;
		width: 100%;
		height: auto;
		object-fit: contain;
	}
</style>
