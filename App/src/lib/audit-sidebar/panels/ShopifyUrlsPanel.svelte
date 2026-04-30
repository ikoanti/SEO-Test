<script lang="ts">
	import type { BasePanelData } from '../types';
	import AuditPanel from '../AuditPanel.svelte';
	import IssueList from '../IssueList.svelte';
	import { siShopify } from 'simple-icons';

	let { panel }: { panel?: BasePanelData } = $props();
	let entries = $derived(Array.isArray(panel?.entries) ? panel.entries : []);
</script>

{#snippet highlight()}
	<div class="shopify-summary">
		<div class="shopify-logo" aria-hidden="true">
			<svg viewBox="0 0 24 24" role="img">
				<path d={siShopify.path} />
			</svg>
		</div>
		<p>Unoptimized URL structure</p>
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

<AuditPanel title={panel?.title} {highlight} {content} />

<style>
	.shopify-summary {
		display: grid;
		justify-items: center;
		gap: 12px;
		margin-top: 18px;
		padding: 18px 12px 14px;
		text-align: center;
	}

	.shopify-logo {
		display: grid;
		width: 76px;
		height: 76px;
		place-items: center;
		border: 1px solid #e0e3e7;
		border-radius: 18px;
		background: #ffffff;
		box-shadow: 0 10px 22px rgba(32, 33, 36, 0.08);
	}

	.shopify-logo svg {
		width: 46px;
		height: 46px;
		fill: #7ab55c;
	}

	.shopify-summary p {
		margin: 0;
		color: #d93025;
		font-size: 16px;
		font-weight: 700;
		line-height: 1.25;
	}
</style>
