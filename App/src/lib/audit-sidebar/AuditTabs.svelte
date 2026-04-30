<script lang="ts">
	import type { AuditTab } from './types';

	let {
		tabs = [],
		activeTab = '',
		captureMode = false,
		onSelect = () => undefined
	}: {
		tabs?: AuditTab[];
		activeTab?: string;
		captureMode?: boolean;
		onSelect?: (tabId: string) => void;
	} = $props();

	let scrollView: HTMLDivElement | undefined;

	$effect(() => {
		if (captureMode || !scrollView || !activeTab) return;

		const activeButton = scrollView.querySelector<HTMLButtonElement>('[data-active="true"]');
		activeButton?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
	});
</script>

<div class="tabs-wrap" data-capture={captureMode ? 'true' : undefined}>
	<div class="horizontal-scrollview" bind:this={scrollView}>
		<div class="tabs">
			{#each tabs as tab}
				<button
					class:active={tab.id === activeTab}
					class="tab"
					type="button"
					data-active={tab.id === activeTab ? 'true' : undefined}
					onclick={() => onSelect(tab.id)}
				>
					{tab.label}
				</button>
			{/each}
		</div>
	</div>
</div>

<style>
	.tabs-wrap {
		padding: 18px 0 14px;
		border-bottom: 1px solid var(--border);
		overflow: hidden;
		flex: 0 0 auto;
		min-width: 0;
	}

	.horizontal-scrollview {
		min-width: 0;
		max-width: 100%;
		overflow-x: auto;
		overflow-y: hidden;
		overscroll-behavior-x: contain;
		scrollbar-width: thin;
		scroll-padding-left: 18px;
		scroll-padding-right: 18px;
	}

	.tabs {
		display: inline-flex;
		gap: 8px;
		flex-wrap: nowrap;
		padding: 0 18px 2px;
		min-width: max-content;
	}

	.tabs-wrap[data-capture='true'],
	.tabs-wrap[data-capture='true'] .horizontal-scrollview {
		overflow: visible;
	}

	.tabs-wrap[data-capture='true'] .horizontal-scrollview {
		max-width: none;
	}

	.tabs-wrap[data-capture='true'] .tabs {
		display: flex;
		min-width: 0;
		flex-wrap: wrap;
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
</style>
