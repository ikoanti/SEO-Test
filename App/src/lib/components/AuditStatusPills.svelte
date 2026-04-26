<script lang="ts">
	import { AlertTriangle, CheckCircle2, CircleX } from 'lucide-svelte';

	type StatusFilter = 'good' | 'warn' | 'bad';

	type StatusMeta = {
		key: StatusFilter;
		count: number;
		label: string;
	};

	let {
		good,
		warn,
		bad,
		statuses = ['good', 'warn', 'bad'] as StatusFilter[],
		labels = {},
		selectable = true,
		selectedStatus = $bindable<StatusFilter | null>(null)
	}: {
		good: number;
		warn: number;
		bad: number;
		statuses?: StatusFilter[];
		labels?: Partial<Record<StatusFilter, string>>;
		selectable?: boolean;
		selectedStatus?: StatusFilter | null;
	} = $props();

	function toggleSelection(status: StatusFilter) {
		if (!selectable) return;
		selectedStatus = selectedStatus === status ? null : status;
	}

	const statusMeta = $derived.by<StatusMeta[]>(() =>
		statuses.map((status) => ({
			key: status,
			count: status === 'good' ? good : status === 'warn' ? warn : bad,
			label:
				labels[status] ?? (status === 'good' ? 'Good' : status === 'warn' ? 'Issues' : 'Missing')
		}))
	);
</script>

<div class="scan-stats">
	{#each statusMeta as status (status.key)}
		<svelte:element
			this={selectable ? 'button' : 'div'}
			type={selectable ? 'button' : undefined}
			class={`scan-stat ${status.key} ${selectedStatus === status.key ? 'is-active' : ''} ${selectable ? 'is-selectable' : 'is-static'}`}
			aria-pressed={selectable ? selectedStatus === status.key : undefined}
			role={selectable ? undefined : 'status'}
			tabindex={selectable ? 0 : undefined}
			onclick={() => toggleSelection(status.key)}
		>
			{#if status.key === 'good'}
				<CheckCircle2 size={16} strokeWidth={2.25} />
			{:else if status.key === 'warn'}
				<AlertTriangle size={16} strokeWidth={2.25} />
			{:else}
				<CircleX size={16} strokeWidth={2.25} />
			{/if}
			<span>{status.count}</span>
			<span>{status.label}</span>
		</svelte:element>
	{/each}
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
		transition:
			transform 0.16s ease,
			border-color 0.16s ease,
			box-shadow 0.16s ease;
	}

	.scan-stat.is-selectable {
		cursor: pointer;
	}

	.scan-stat.is-selectable:hover {
		transform: translateY(-1px);
	}

	.scan-stat.is-active {
		border-color: currentColor;
		box-shadow: inset 0 0 0 1px currentColor;
	}

	.scan-stat.good {
		background: rgba(16, 185, 129, 0.12);
		color: var(--success);
	}

	.scan-stat.warn {
		background: rgba(245, 158, 11, 0.12);
		color: var(--warning);
	}

	.scan-stat.bad {
		background: rgba(239, 68, 68, 0.12);
		color: var(--danger);
	}

	.scan-stat :global(svg) {
		flex: 0 0 auto;
	}
</style>
