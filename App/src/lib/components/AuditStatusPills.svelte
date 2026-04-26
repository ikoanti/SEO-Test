<script lang="ts">
	import { AlertTriangle, CheckCircle2, CircleX } from 'lucide-svelte';

	let {
		good,
		warn,
		bad,
		selectedStatus = $bindable<StatusFilter | null>(null)
	}: {
		good: number;
		warn: number;
		bad: number;
		selectedStatus?: StatusFilter | null;
	} = $props();

	type StatusFilter = 'good' | 'warn' | 'bad';

	function toggleSelection(status: StatusFilter) {
		selectedStatus = selectedStatus === status ? null : status;
	}
</script>

<div class="scan-stats">
	<button
		type="button"
		class={`scan-stat good ${selectedStatus === 'good' ? 'is-active' : ''}`}
		aria-pressed={selectedStatus === 'good'}
		onclick={() => toggleSelection('good')}
	>
		<CheckCircle2 size={16} strokeWidth={2.25} />
		<span>{good}</span>
		<span>Good</span>
	</button>
	<button
		type="button"
		class={`scan-stat warn ${selectedStatus === 'warn' ? 'is-active' : ''}`}
		aria-pressed={selectedStatus === 'warn'}
		onclick={() => toggleSelection('warn')}
	>
		<AlertTriangle size={16} strokeWidth={2.25} />
		<span>{warn}</span>
		<span>Issues</span>
	</button>
	<button
		type="button"
		class={`scan-stat bad ${selectedStatus === 'bad' ? 'is-active' : ''}`}
		aria-pressed={selectedStatus === 'bad'}
		onclick={() => toggleSelection('bad')}
	>
		<CircleX size={16} strokeWidth={2.25} />
		<span>{bad}</span>
		<span>Missing</span>
	</button>
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
		cursor: pointer;
		transition:
			transform 0.16s ease,
			border-color 0.16s ease,
			box-shadow 0.16s ease;
	}

	.scan-stat:hover {
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
