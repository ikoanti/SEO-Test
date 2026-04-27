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

	function gaugeStyle(score: unknown) {
		const value = Number(score);
		const normalized = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
		const color =
			normalized >= 90
				? 'var(--status-pass)'
				: normalized >= 50
					? 'var(--status-warn)'
					: normalized > 0
						? 'var(--status-fail)'
						: 'var(--border)';
		return `--score: ${normalized}; --score-color: ${color};`;
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

<div class="card page-speed-card" id="card-speed">
	<h3>PageSpeed Insights</h3>
	{#if screenshot?.image_url}
		<div class="card-image-proof">
			<img
				src={screenshot.image_url}
				alt={screenshot.title || 'PageSpeed Insights evidence screenshot'}
				loading="lazy"
			/>
		</div>
	{/if}
	<div class="speed-container">
		{#each pageSpeedStrategies as strategy (strategy)}
			{@const strategyData = getRecord(pageSpeedData[strategy])}
			<div class="speed-item">
				<div class="speed-score-row">
					<div
						class={`speed-gauge ${scoreClass(strategyData.score)}`}
						style={gaugeStyle(strategyData.score)}
						aria-label={`${strategy === 'mobile' ? 'Mobile' : 'Desktop'} score ${displayValue(strategyData.score, '--')}`}
					>
						<div class="speed-gauge-inner">
							{#if strategy === 'mobile'}
								<Smartphone size={18} strokeWidth={2.25} />
							{:else}
								<Monitor size={18} strokeWidth={2.25} />
							{/if}
							<strong>{displayValue(strategyData.score, '--')}</strong>
						</div>
					</div>
					<div class="speed-heading">
						<span>{strategy === 'mobile' ? 'Mobile' : 'Desktop'}</span>
						<strong>{strategy === 'mobile' ? 'Mobile Score' : 'Desktop Score'}</strong>
					</div>
				</div>
				<div class="speed-details">
					{#each metricsForPageSpeed(strategy) as metric (metric[0])}
						<div class="speed-metric">
							<span>{metric[0]}</span>
							<span>{displayValue(metric[1], 'N/A')}</span>
						</div>
					{/each}
				</div>
			</div>
		{/each}
	</div>
</div>

<style>
	.page-speed-card {
		width: 100%;
		max-width: 800px;
		padding: 1.5rem;
		border-radius: 1rem;
	}

	.page-speed-card h3 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0 0 1rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--border);
		font-size: 1.25rem;
		font-weight: 600;
	}

	.card-image-proof {
		margin: 0 0 1rem;
		overflow: hidden;
		border: 1px solid var(--border);
		border-radius: 0.9rem;
		background: rgba(15, 23, 42, 0.72);
	}

	.card-image-proof img {
		display: block;
		width: 100%;
		height: auto;
	}

	.speed-container {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1.25rem;
		padding: 0.5rem 0 0;
	}

	.speed-item {
		display: flex;
		flex-direction: column;
		min-width: 0;
		gap: 1rem;
	}

	.speed-score-row {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: 0.9rem;
		min-width: 0;
	}

	.speed-gauge {
		--score: 0;
		--score-color: var(--border);
		position: relative;
		display: grid;
		width: 86px;
		height: 86px;
		place-items: center;
		border-radius: 50%;
		background: conic-gradient(
			var(--score-color) calc(var(--score) * 1%),
			rgba(148, 163, 184, 0.18) 0
		);
		color: var(--score-color);
		flex: 0 0 auto;
	}

	.speed-gauge::before {
		position: absolute;
		inset: 7px;
		border-radius: inherit;
		background: var(--card-bg);
		content: '';
	}

	.speed-gauge-inner {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.15rem;
	}

	.speed-gauge-inner strong {
		color: var(--text-main);
		font-size: 1.45rem;
		line-height: 1;
		font-weight: 700;
	}

	.speed-heading {
		min-width: 0;
	}

	.speed-heading span {
		display: block;
		margin-bottom: 0.25rem;
		color: var(--text-muted);
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.speed-heading strong {
		display: block;
		color: var(--text-main);
		font-size: 1.05rem;
		line-height: 1.2;
		font-weight: 700;
	}

	.speed-details {
		display: flex;
		flex-direction: column;
		gap: 0;
		width: 100%;
		color: var(--text-muted);
	}

	.speed-metric {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.65rem 0;
		border-bottom: 1px solid rgba(148, 163, 184, 0.14);
		font-size: 0.9rem;
	}

	.speed-metric:first-child {
		border-top: 1px solid rgba(148, 163, 184, 0.14);
	}

	.speed-metric span:first-child {
		color: var(--text-muted);
		font-weight: 600;
	}

	.speed-metric span:last-child {
		color: var(--text-main);
		font-weight: 600;
		text-align: right;
	}

	@media (max-width: 760px) {
		.speed-container {
			grid-template-columns: 1fr;
		}
	}
</style>
