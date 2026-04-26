<script lang="ts">
	import { AlertTriangle, CheckCircle2, CircleX } from 'lucide-svelte';

	let {
		good,
		warn,
		bad
	}: {
		good: number;
		warn: number;
		bad: number;
	} = $props();
</script>

<div class="scan-stats">
	<div class="scan-stat good">
		<CheckCircle2 size={16} strokeWidth={2.25} />
		<span>{good}</span>
		<span>Good</span>
	</div>
	<div class="scan-stat warn">
		<AlertTriangle size={16} strokeWidth={2.25} />
		<span>{warn}</span>
		<span>Issues</span>
	</div>
	<div class="scan-stat bad">
		<CircleX size={16} strokeWidth={2.25} />
		<span>{bad}</span>
		<span>Missing</span>
	</div>
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
		border-radius: 999px;
		background: rgba(0, 0, 0, 0.2);
		font-size: 0.8rem;
		font-weight: 600;
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
