<script lang="ts">
	import AIBotVisibilityPanel from './panels/AIBotVisibilityPanel.svelte';
	import BrokenLinksPanel from './panels/BrokenLinksPanel.svelte';
	import HeadingsPanel from './panels/HeadingsPanel.svelte';
	import ImageAltsPanel from './panels/ImageAltsPanel.svelte';
	import MetaTagsPanel from './panels/MetaTagsPanel.svelte';
	import PageSpeedPanel from './panels/PageSpeedPanel.svelte';
	import PlaceholderPanel from './panels/PlaceholderPanel.svelte';
	import ProductSchemaPanel from './panels/ProductSchemaPanel.svelte';
	import SchemaIssuePanel from './panels/SchemaIssuePanel.svelte';
	import ShopifyUrlsPanel from './panels/ShopifyUrlsPanel.svelte';
	import AuditSidebarLayout from './AuditSidebarLayout.svelte';
	import type { AuditPanelData, AuditSidebarData } from './types';

	let { data = { activeTab: 'overview', tabs: [], panels: {} } }: { data?: AuditSidebarData } =
		$props();

	let tabs = $derived(data?.tabs ?? []);
	let requestedActiveTab = $state<string | undefined>();
	let activeTab = $state('overview');

	$effect(() => {
		const requested = data?.activeTab ?? tabs[0]?.id ?? 'overview';
		if (requested !== requestedActiveTab) {
			requestedActiveTab = requested;
			activeTab = requested;
		}
	});

	function setActiveTab(tabId: string) {
		activeTab = tabId;
	}

	let activePanel = $derived<AuditPanelData>(
		data?.panels?.[activeTab] ?? {
			kind: 'placeholder'
		}
	);
</script>

{#snippet panelContent(panel: AuditPanelData)}
	{#if panel.kind === 'image-alts'}
		<ImageAltsPanel {panel} />
	{:else if panel.kind === 'ai-bot-visibility'}
		<AIBotVisibilityPanel {panel} />
	{:else if panel.kind === 'pagespeed'}
		<PageSpeedPanel {panel} />
	{:else if panel.kind === 'broken-links'}
		<BrokenLinksPanel {panel} />
	{:else if panel.kind === 'headings'}
		<HeadingsPanel {panel} />
	{:else if panel.kind === 'missing-product-schema'}
		<ProductSchemaPanel {panel} />
	{:else if panel.kind === 'missing-faq-schema'}
		<SchemaIssuePanel {panel} />
	{:else if panel.kind === 'missing-organization-schema'}
		<SchemaIssuePanel {panel} />
	{:else if panel.kind === 'unlinked-blog'}
		<SchemaIssuePanel {panel} />
	{:else if panel.kind === 'meta-tags'}
		<MetaTagsPanel {panel} />
	{:else if panel.kind === 'shopify-urls'}
		<ShopifyUrlsPanel {panel} />
	{:else}
		<PlaceholderPanel {panel} />
	{/if}
{/snippet}

<AuditSidebarLayout
	{tabs}
	{activeTab}
	{activePanel}
	captureMode={Boolean(data?.captureMode)}
	onTabSelect={setActiveTab}
	content={panelContent}
/>
