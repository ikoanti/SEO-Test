<script lang="ts">
	import type { AuditFindingStatusFilter } from '$lib/audit-status';
	import { AlertTriangle, CheckCircle2, CircleX } from 'lucide-svelte';

	let {
		pass,
		warn,
		fail,
		selectable = true,
		selectedStatus = $bindable<AuditFindingStatusFilter | null>(null)
	}: {
		pass: number;
		warn: number;
		fail: number;
		selectable?: boolean;
		selectedStatus?: AuditFindingStatusFilter | null;
	} = $props();

	function toggleSelection(status: AuditFindingStatusFilter) {
		if (!selectable) return;
		selectedStatus = selectedStatus === status ? null : status;
	}
</script>

<div class="scan-stats">
	<svelte:element
		this={selectable ? 'button' : 'div'}
		type={selectable ? 'button' : undefined}
		class={`scan-stat pass ${selectedStatus === 'pass' ? 'is-active' : ''} ${selectable ? 'is-selectable' : 'is-static'}`}
		aria-pressed={selectable ? selectedStatus === 'pass' : undefined}
		role={selectable ? undefined : 'status'}
		tabindex={selectable ? 0 : undefined}
		onclick={() => toggleSelection('pass')}
	>
		<CheckCircle2 size={16} strokeWidth={2.25} />
		<span>{pass}</span>
		<span>Pass</span>
	</svelte:element>
	<svelte:element
		this={selectable ? 'button' : 'div'}
		type={selectable ? 'button' : undefined}
		class={`scan-stat warn ${selectedStatus === 'warn' ? 'is-active' : ''} ${selectable ? 'is-selectable' : 'is-static'}`}
		aria-pressed={selectable ? selectedStatus === 'warn' : undefined}
		role={selectable ? undefined : 'status'}
		tabindex={selectable ? 0 : undefined}
		onclick={() => toggleSelection('warn')}
	>
		<AlertTriangle size={16} strokeWidth={2.25} />
		<span>{warn}</span>
		<span>Issues</span>
	</svelte:element>
	<svelte:element
		this={selectable ? 'button' : 'div'}
		type={selectable ? 'button' : undefined}
		class={`scan-stat fail ${selectedStatus === 'fail' ? 'is-active' : ''} ${selectable ? 'is-selectable' : 'is-static'}`}
		aria-pressed={selectable ? selectedStatus === 'fail' : undefined}
		role={selectable ? undefined : 'status'}
		tabindex={selectable ? 0 : undefined}
		onclick={() => toggleSelection('fail')}
	>
		<CircleX size={16} strokeWidth={2.25} />
		<span>{fail}</span>
		<span>Fail</span>
	</svelte:element>
</div>

<style>
	.scan-stats {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	.scan-stat {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.35rem 0.7rem;
		border: 1px solid transparent;
		border-radius: 999px;
		background: rgba(0, 0, 0, 0.2);
		font-size: 0.8rem;
		font-weight: 600;
		transition: border-color 0.16s ease;
	}

	.scan-stat.is-selectable {
		cursor: pointer;
	}

	.scan-stat.is-active {
		border-color: currentColor;
	}

	.scan-stat.pass {
		background: rgba(16, 185, 129, 0.12);
		color: var(--status-pass);
	}

	.scan-stat.warn {
		background: rgba(245, 158, 11, 0.12);
		color: var(--status-warn);
	}

	.scan-stat.fail {
		background: rgba(239, 68, 68, 0.12);
		color: var(--status-fail);
	}

	.scan-stat :global(svg) {
		flex: 0 0 auto;
	}
</style>
