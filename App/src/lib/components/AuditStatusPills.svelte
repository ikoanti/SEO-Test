<script lang="ts">
	import type { AuditFindingStatusFilter } from '$lib/audit-status';
	import { AlertTriangle, CheckCircle2, Info } from 'lucide-svelte';

	type PillStatus = AuditFindingStatusFilter;

	let {
		pass,
		warn,
		info,
		statuses = ['pass', 'warn', 'info'] as PillStatus[],
		selectable = true,
		selectedStatus = $bindable<AuditFindingStatusFilter | null>(null)
	}: {
		pass: number;
		warn: number;
		info: number;
		statuses?: PillStatus[];
		selectable?: boolean;
		selectedStatus?: AuditFindingStatusFilter | null;
	} = $props();

	function toggleSelection(status: AuditFindingStatusFilter) {
		if (!selectable) return;
		selectedStatus = selectedStatus === status ? null : status;
	}
</script>

<div class="scan-stats">
	{#if statuses.includes('pass')}
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
	{/if}
	{#if statuses.includes('warn')}
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
	{/if}
	{#if statuses.includes('info')}
		<svelte:element
			this={selectable ? 'button' : 'div'}
			type={selectable ? 'button' : undefined}
			class={`scan-stat info ${selectedStatus === 'info' ? 'is-active' : ''} ${selectable ? 'is-selectable' : 'is-static'}`}
			aria-pressed={selectable ? selectedStatus === 'info' : undefined}
			role={selectable ? undefined : 'status'}
			tabindex={selectable ? 0 : undefined}
			onclick={() => toggleSelection('info')}
		>
			<Info size={16} strokeWidth={2.25} />
			<span>{info}</span>
			<span>Info</span>
		</svelte:element>
	{/if}
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

	.scan-stat.info {
		background: color-mix(in srgb, var(--status-info) 12%, transparent);
		color: var(--status-info);
	}

	.scan-stat :global(svg) {
		flex: 0 0 auto;
	}
</style>
