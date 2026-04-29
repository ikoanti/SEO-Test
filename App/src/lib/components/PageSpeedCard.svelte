<script lang="ts">
	import { Monitor, Smartphone } from 'lucide-svelte';

	let {
		pageSpeedData = {},
		screenshot = null
	}: {
		pageSpeedData?: Record<string, unknown>;
		screenshot?: {
			title?: string;
			image_url?: string;
		} | null;
	} = $props();

	const pageSpeedStrategies = ['mobile', 'desktop'] as const;

	const getRecord = (value: unknown): Record<string, unknown> =>
		value && typeof value === 'object' && !Array.isArray(value)
			? (value as Record<string, unknown>)
			: {};

	const displayValue = (value: unknown, fallback = '-') =>
		value === undefined || value === null || value === '' ? fallback : String(value);

	function scoreClass(score: unknown) {
		const value = Number(score);
		if (!Number.isFinite(value) || value <= 0) return '';
		if (value >= 90) return 'pass';
		if (value >= 50) return 'warn';
		return 'fail';
	}

	function metricsForPageSpeed(strategy: 'mobile' | 'desktop') {
		const strategyData = getRecord(pageSpeedData[strategy]);
		const metrics = getRecord(strategyData.metrics);
		return [
			['FCP', metrics.FCP ?? metrics.fcp],
			['LCP', metrics.LCP ?? metrics.lcp],
			['CLS', metrics.CLS ?? metrics.cls],
			['TBT', metrics.TBT ?? metrics.tbt]
		];
	}
</script>

<section class="page-speed-section" id="section-speed">
	<h2>Unoptimized page speed</h2>
	{#if screenshot?.image_url}
		<figure class="audit-evidence">
			<img
				src={screenshot.image_url}
				alt={screenshot.title || 'Unoptimized page speed evidence screenshot'}
				loading="lazy"
			/>
		</figure>
	{/if}
	<div class="speed-container">
		{#each pageSpeedStrategies as strategy (strategy)}
			{@const strategyData = getRecord(pageSpeedData[strategy])}
			<div class="speed-item">
				<div class={`metric-circle ${scoreClass(strategyData.score)}`}>
					{displayValue(strategyData.score, '--')}
				</div>
				<span class="speed-label">
					{#if strategy === 'mobile'}
						<Smartphone size={14} strokeWidth={2.25} />
					{:else}
						<Monitor size={14} strokeWidth={2.25} />
					{/if}
					<span>{strategy === 'mobile' ? 'Mobile' : 'Desktop'} Score</span>
				</span>
				<div class="speed-details">
					{#each metricsForPageSpeed(strategy) as metric (metric[0])}
						<div class="speed-metric">
							<span>{metric[0]}:</span>
							<span>{displayValue(metric[1], 'N/A')}</span>
						</div>
					{/each}
				</div>
			</div>
			{#if strategy === 'mobile'}
				<div class="speed-divider"></div>
			{/if}
		{/each}
	</div>
</section>

<style>
	.page-speed-section {
		width: 100%;
		padding: 1.5rem 0;
		border-top: 1px solid var(--border);
	}

	.page-speed-section h2 {
		margin: 0 0 1rem;
		font-size: 1.35rem;
		font-weight: 800;
	}

	.audit-evidence {
		margin: 0 0 1rem;
		overflow: hidden;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		background: rgba(15, 23, 42, 0.72);
	}

	.audit-evidence img {
		display: block;
		width: 100%;
		height: auto;
	}

	.speed-container {
		display: flex;
		align-items: flex-start;
		justify-content: space-around;
		gap: 1rem;
		padding: 0.25rem 0 0;
	}

	.speed-item {
		display: flex;
		flex: 1;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
	}

	.metric-circle {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 80px;
		height: 80px;
		border: 4px solid var(--border);
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.2);
		font-size: 1.5rem;
		font-weight: 700;
	}

	.metric-circle.pass {
		border-color: var(--status-pass);
		color: var(--status-pass);
	}

	.metric-circle.warn {
		border-color: var(--status-warn);
		color: var(--status-warn);
	}

	.metric-circle.fail {
		border-color: var(--status-fail);
		color: var(--status-fail);
	}

	.speed-label {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		color: var(--text-muted);
		font-size: 0.85rem;
		font-weight: 500;
	}

	.speed-divider {
		align-self: stretch;
		width: 1px;
		min-height: 100px;
		background: var(--border);
	}

	.speed-details {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		width: 100%;
		max-width: 250px;
		margin-top: 0.5rem;
		color: var(--text-muted);
		font-size: 0.85rem;
	}

	.speed-metric {
		display: flex;
		justify-content: space-between;
		padding: 0.45rem 0;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}

	.speed-metric span:last-child {
		color: var(--text-main);
		font-weight: 600;
	}

	@media (max-width: 760px) {
		.speed-container {
			flex-direction: column;
			align-items: stretch;
		}

		.speed-divider {
			width: 100%;
			min-height: 1px;
			height: 1px;
		}
	}
</style>
