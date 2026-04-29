<script lang="ts">
	import { AuditSidebar, type AuditSidebarData } from '$lib/audit-sidebar';

	let { data }: { data: { sidebarData: AuditSidebarData } } = $props();
</script>

<svelte:head>
	<title>Audit Sidebar Capture</title>
</svelte:head>

<div class="capture-stage" data-sidebar-stage>
	<div class="sidebar-frame" data-sidebar-frame>
		<AuditSidebar data={data.sidebarData} />
	</div>
</div>

<style>
	:global(html),
	:global(body) {
		margin: 0;
		width: 100%;
		min-height: 100%;
		background: transparent;
	}

	.capture-stage {
		box-sizing: border-box;
		width: 500px;
		height: 900px;
		padding: 16px 40px;
		background: transparent;
	}

	.sidebar-frame {
		width: 420px;
		height: calc(900px - 32px);
		overflow: hidden;
		border-radius: 28px;
		background: #ffffff;
		box-shadow: 0 18px 40px rgba(15, 23, 42, 0.16);
	}
</style>
