<script lang="ts">
	import { AuditSidebar, type AuditSidebarData } from '$lib/audit-sidebar';

	let {
		sidebarPreviewData
	}: {
		sidebarPreviewData: AuditSidebarData | null;
	} = $props();
</script>

<div class="sidebar-preview-direct" id="card-sidebar-preview">
	{#if sidebarPreviewData}
		<AuditSidebar data={sidebarPreviewData} />
	{/if}
</div>

<style>
	.sidebar-preview-direct {
		width: min(100%, 420px);
		height: 868px;
		overflow: hidden;
	}

	.sidebar-preview-direct :global(.audit-sidebar) {
		width: 100%;
		height: 100%;
	}
</style>
