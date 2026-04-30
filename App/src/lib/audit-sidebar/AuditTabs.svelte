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
</script>

<div class="tabs-wrap" data-capture={captureMode ? 'true' : undefined}>
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

<style>
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

	.tabs-wrap[data-capture='true'],
	.tabs-wrap[data-capture='true'] .tabs {
		overflow: visible;
	}

	.tabs-wrap[data-capture='true'] .tabs {
		flex-wrap: wrap;
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
</style>
