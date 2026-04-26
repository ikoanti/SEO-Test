<script lang="ts">
	import { AlertTriangle, CheckCircle2, CircleX } from 'lucide-svelte';

	type StatusFilter = 'good' | 'warn' | 'bad';

	let {
		good,
		warn,
		bad,
		selectable = true,
		selectedStatus = $bindable<StatusFilter | null>(null)
	}: {
		good: number;
		warn: number;
		bad: number;
		selectable?: boolean;
		selectedStatus?: StatusFilter | null;
	} = $props();

	function toggleSelection(status: StatusFilter) {
		if (!selectable) return;
		selectedStatus = selectedStatus === status ? null : status;
	}
</script>

<div class="scan-stats">
	<svelte:element
		this={selectable ? 'button' : 'div'}
		type={selectable ? 'button' : undefined}
		class={`scan-stat good ${selectedStatus === 'good' ? 'is-active' : ''} ${selectable ? 'is-selectable' : 'is-static'}`}
		aria-pressed={selectable ? selectedStatus === 'good' : undefined}
		role={selectable ? undefined : 'status'}
		tabindex={selectable ? 0 : undefined}
		onclick={() => toggleSelection('good')}
	>
		<CheckCircle2 size={16} strokeWidth={2.25} />
		<span>{good}</span>
		<span>Good</span>
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
		class={`scan-stat bad ${selectedStatus === 'bad' ? 'is-active' : ''} ${selectable ? 'is-selectable' : 'is-static'}`}
		aria-pressed={selectable ? selectedStatus === 'bad' : undefined}
		role={selectable ? undefined : 'status'}
		tabindex={selectable ? 0 : undefined}
		onclick={() => toggleSelection('bad')}
	>
		<CircleX size={16} strokeWidth={2.25} />
		<span>{bad}</span>
		<span>Missing</span>
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
