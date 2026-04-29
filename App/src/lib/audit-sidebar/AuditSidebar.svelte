<script lang="ts">
	import { tick } from 'svelte';
	import AIBotVisibilityPanel from './panels/AIBotVisibilityPanel.svelte';
	import BrokenLinksPanel from './panels/BrokenLinksPanel.svelte';
	import CanonicalsPanel from './panels/CanonicalsPanel.svelte';
	import ContentQualityPanel from './panels/ContentQualityPanel.svelte';
	import HeadingsPanel from './panels/HeadingsPanel.svelte';
	import ImageAltsPanel from './panels/ImageAltsPanel.svelte';
	import InternalLinksPanel from './panels/InternalLinksPanel.svelte';
	import LazyLoadingPanel from './panels/LazyLoadingPanel.svelte';
	import MetaTagsPanel from './panels/MetaTagsPanel.svelte';
	import OpenGraphPanel from './panels/OpenGraphPanel.svelte';
	import OpenPageRankPanel from './panels/OpenPageRankPanel.svelte';
	import PageSpeedPanel from './panels/PageSpeedPanel.svelte';
	import PlaceholderPanel from './panels/PlaceholderPanel.svelte';
	import ProductSchemaPanel from './panels/ProductSchemaPanel.svelte';
	import ShopifyUrlsPanel from './panels/ShopifyUrlsPanel.svelte';
	import type { AuditPanelData, AuditSidebarData } from './types';

	let { data = { activeTab: 'overview', tabs: [], panels: {} } }: { data?: AuditSidebarData } =
		$props();

	let tabs = $derived(data?.tabs ?? []);
	let requestedActiveTab = $state<string | undefined>();
	let activeTab = $state('overview');
	let tabsContainer: HTMLDivElement | undefined = $state();

	$effect(() => {
		const requested = data?.activeTab ?? tabs[0]?.id ?? 'overview';
		if (requested !== requestedActiveTab) {
			requestedActiveTab = requested;
			activeTab = requested;
		}
	});

	$effect(() => {
		activeTab;
		tabs.length;
		void tick().then(() => {
			const activeButton = tabsContainer?.querySelector<HTMLButtonElement>('.tab.active');
			if (!tabsContainer || !activeButton) return;

			const containerWidth = tabsContainer.clientWidth;
			const activeLeft = activeButton.offsetLeft;
			const activeWidth = activeButton.offsetWidth;
			const maxScroll = Math.max(0, tabsContainer.scrollWidth - containerWidth);
			const targetLeft = Math.min(
				maxScroll,
				Math.max(0, activeLeft - (containerWidth - activeWidth) / 2)
			);
			tabsContainer.scrollLeft = targetLeft;
		});
	});

	function setActiveTab(tabId: string) {
		activeTab = tabId;
	}

	let activePanel = $derived<AuditPanelData>(
		data?.panels?.[activeTab] ?? {
			kind: 'placeholder',
			title: 'Missing Panel',
			description: 'No panel data configured.'
		}
	);
</script>

<aside class="audit-sidebar">
	<div class="tabs-wrap">
		<div class="tabs" bind:this={tabsContainer}>
			{#each tabs as tab}
				<button
					class:active={tab.id === activeTab}
					class="tab"
					type="button"
					data-active={tab.id === activeTab ? 'true' : undefined}
					onclick={() => setActiveTab(tab.id)}
				>
					{tab.label}
				</button>
			{/each}
		</div>
	</div>
	<div class="body">
		<div class="audit-sidebar-panel">
			{#if activePanel.kind === 'image-alts'}
				<ImageAltsPanel panel={activePanel} />
			{:else if activePanel.kind === 'ai-bot-visibility'}
				<AIBotVisibilityPanel panel={activePanel} />
			{:else if activePanel.kind === 'pagespeed'}
				<PageSpeedPanel panel={activePanel} />
			{:else if activePanel.kind === 'open-page-rank'}
				<OpenPageRankPanel panel={activePanel} />
			{:else if activePanel.kind === 'broken-links'}
				<BrokenLinksPanel panel={activePanel} />
			{:else if activePanel.kind === 'headings'}
				<HeadingsPanel panel={activePanel} />
			{:else if activePanel.kind === 'missing-product-schema'}
				<ProductSchemaPanel panel={activePanel} />
			{:else if activePanel.kind === 'meta-tags'}
				<MetaTagsPanel panel={activePanel} />
			{:else if activePanel.kind === 'canonicals'}
				<CanonicalsPanel panel={activePanel} />
			{:else if activePanel.kind === 'internal-links'}
				<InternalLinksPanel panel={activePanel} />
			{:else if activePanel.kind === 'lazy-loading'}
				<LazyLoadingPanel panel={activePanel} />
			{:else if activePanel.kind === 'open-graph'}
				<OpenGraphPanel panel={activePanel} />
			{:else if activePanel.kind === 'content-quality'}
				<ContentQualityPanel panel={activePanel} />
			{:else if activePanel.kind === 'shopify-urls'}
				<ShopifyUrlsPanel panel={activePanel} />
			{:else}
				<PlaceholderPanel panel={activePanel} />
			{/if}
		</div>
	</div>
</aside>

<style>
	.audit-sidebar {
		--panel-width: 100%;
		--bg: #ffffff;
		--text: #202124;
		--muted: #5f6368;
		--border: #e0e3e7;
		--soft: #f2f4f7;
		--tab-active-bg: #e8f0fe;
		--tab-active-text: #1a73e8;
		display: block;
		box-sizing: border-box;
		width: var(--panel-width);
		max-width: 100%;
		height: 100%;
		overflow: hidden;
		background: var(--bg);
		font-family: Arial, Helvetica, sans-serif;
		color: var(--text);
	}

	.tabs-wrap {
		padding: 18px 0 14px;
		border-bottom: 1px solid var(--border);
		overflow: hidden;
		flex: 0 0 auto;
	}

	.tabs {
		display: flex;
		gap: 8px;
		flex-wrap: nowrap;
		overflow-x: auto;
		overflow-y: hidden;
		scrollbar-width: none;
		-ms-overflow-style: none;
		padding: 0 18px 2px;
		scroll-padding-left: 18px;
		scroll-padding-right: 18px;
	}

	.tabs::-webkit-scrollbar {
		display: none;
	}

	.tab {
		border-radius: 999px;
		padding: 9px 12px;
		font-size: 13px;
		font-weight: 700;
		background: var(--soft);
		color: var(--muted);
		white-space: nowrap;
		flex: 0 0 auto;
		border: 0;
		cursor: pointer;
	}

	.tab.active {
		background: var(--tab-active-bg);
		color: var(--tab-active-text);
	}

	.body {
		width: 100%;
		min-width: 0;
		padding: 18px;
		overflow: auto;
		height: calc(100% - 69px);
		box-sizing: border-box;
		overscroll-behavior-x: contain;
	}

	.audit-sidebar-panel {
		display: block;
		color: #202124;
		font-family: Arial, Helvetica, sans-serif;
	}
</style>
