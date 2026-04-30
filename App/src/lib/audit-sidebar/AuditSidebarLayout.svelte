<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { AuditPanelData, AuditTab } from './types';
	import AuditTabs from './AuditTabs.svelte';

	let {
		tabs = [],
		activeTab = '',
		activePanel = { kind: 'placeholder' },
		captureMode = false,
		onTabSelect = () => undefined,
		content
	}: {
		tabs?: AuditTab[];
		activeTab?: string;
		activePanel?: AuditPanelData;
		captureMode?: boolean;
		onTabSelect?: (tabId: string) => void;
		content: Snippet<[AuditPanelData]>;
	} = $props();
</script>

<aside class="audit-sidebar">
	<div class="vstack">
		<AuditTabs {tabs} {activeTab} {captureMode} onSelect={onTabSelect} />
		<div class="body">
			<div class="audit-sidebar-panel">
				{@render content(activePanel)}
			</div>
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

	.vstack {
		display: flex;
		height: 100%;
		min-height: 0;
		flex-direction: column;
	}

	.body {
		width: 100%;
		min-width: 0;
		min-height: 0;
		padding: 18px;
		overflow: auto;
		flex: 1 1 auto;
		box-sizing: border-box;
		overscroll-behavior-x: contain;
	}

	.audit-sidebar-panel {
		display: block;
		color: #202124;
		font-family: Arial, Helvetica, sans-serif;
	}
</style>
