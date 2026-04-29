<script lang="ts">
	import pageSpeedLogo from '$lib/assets/page-speed/google-pagespeed-insights.png';
	import type { BasePanelData, PageSpeedStrategyData } from '../types';

	let {
		panel
	}: { panel?: BasePanelData & { pageSpeed?: Record<string, PageSpeedStrategyData | undefined> } } =
		$props();
	let pageSpeed = $derived(panel?.pageSpeed ?? {});

	function scoreClass(score: unknown) {
		const value = Number(score);
		if (!Number.isFinite(value) || value <= 0) return 'speed-info';
		if (value >= 90) return 'speed-pass';
		if (value >= 50) return 'speed-warn';
		return 'speed-fail';
	}

	function gaugeStyle(score: unknown) {
		const value = Number(score);
		const normalized = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
		const color =
			normalized >= 90
				? '#10b981'
				: normalized >= 50
					? '#f59e0b'
					: normalized > 0
						? '#d93025'
						: '#dadce0';
		return `--score:${normalized};--score-color:${color};`;
	}

	function metricRows(strategyData?: PageSpeedStrategyData) {
		const metrics = strategyData?.metrics ?? {};
		return [
			['FCP', metrics.FCP ?? metrics.fcp ?? 'N/A'],
			['LCP', metrics.LCP ?? metrics.lcp ?? 'N/A'],
			['CLS', metrics.CLS ?? metrics.cls ?? 'N/A'],
			['TBT', metrics.TBT ?? metrics.tbt ?? 'N/A'],
			['Speed Index', metrics['Speed Index'] ?? metrics.speedIndex ?? metrics.SI ?? 'N/A']
		];
	}

	function sortedStrategies(data: Record<string, PageSpeedStrategyData | undefined>) {
		return ['mobile', 'desktop']
			.map((strategy) => ({ strategy, data: data[strategy] ?? {} }))
			.sort((a, b) => {
				const aScore = Number(a.data?.score);
				const bScore = Number(b.data?.score);
				const normalizedA = Number.isFinite(aScore) && aScore > 0 ? aScore : 101;
				const normalizedB = Number.isFinite(bScore) && bScore > 0 ? bScore : 101;
				return normalizedA - normalizedB;
			});
	}

	let strategies = $derived(sortedStrategies(pageSpeed));
</script>

<section class="section">
	<div class="pagespeed-brand">
		<img src={pageSpeedLogo} alt="Google PageSpeed Insights" />
	</div>
	<h1 class="title">{panel?.title ?? 'PageSpeed Insights'}</h1>
	<p class="copy">{panel?.description ?? ''}</p>
</section>
<section class="section">
	<div class="metric-stack">
		{#each strategies as { strategy, data }}
			<article class={`speed-panel-card ${scoreClass(data.score)}`}>
				<div class="speed-panel-head">
					<div class="speed-gauge" style={gaugeStyle(data.score)}>
						<div class="speed-gauge-inner">
							<strong>{data.score ?? 'N/A'}</strong>
						</div>
					</div>
					<div class="speed-panel-copy">
						<p class="metric-panel-title">
							{strategy === 'mobile' ? 'Mobile Score' : 'Desktop Score'}
						</p>
					</div>
				</div>
				<div class="speed-metric-list">
					{#each metricRows(data) as [label, value]}
						<div class="speed-metric-row">
							<span>{label}</span>
							<strong>{value}</strong>
						</div>
					{/each}
				</div>
			</article>
		{/each}
	</div>
</section>

<style>
	@import './panel-shared.css';

	.pagespeed-brand {
		width: 100%;
		margin: 0 0 16px;
	}

	.pagespeed-brand img {
		display: block;
		width: 100%;
		height: auto;
		object-fit: contain;
	}

	.metric-stack {
		display: grid;
		gap: 14px;
	}

	.speed-panel-card {
		min-width: 0;
		border: 1px solid #e0e3e7;
		border-radius: 14px;
		padding: 16px;
		background: #fff;
	}

	.speed-panel-head {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		min-width: 0;
		text-align: center;
	}

	.speed-panel-copy {
		min-width: 0;
	}

	.speed-gauge {
		--score: 0;
		--score-color: #dadce0;
		position: relative;
		display: grid;
		width: 84px;
		height: 84px;
		place-items: center;
		border-radius: 999px;
		background: conic-gradient(var(--score-color) calc(var(--score) * 1%), #eceff3 0);
		color: var(--score-color);
	}

	.speed-gauge::before {
		position: absolute;
		inset: 7px;
		border-radius: inherit;
		background: #fff;
		content: '';
	}

	.speed-gauge-inner {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
	}

	.speed-gauge-inner strong {
		font-size: 22px;
		line-height: 1;
		font-weight: 800;
		color: var(--score-color);
	}

	.speed-panel-card .metric-panel-title {
		margin: 0;
		color: var(--score-color);
		font-size: 16px;
		line-height: 1.25;
		font-weight: 700;
	}

	.speed-metric-list {
		display: grid;
		gap: 0;
		margin-top: 14px;
	}

	.speed-metric-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
		padding: 9px 0;
		border-top: 1px solid #edf0f3;
		font-size: 13px;
	}

	.speed-metric-row span {
		color: #5f6368;
		font-weight: 700;
	}

	.speed-metric-row strong {
		color: #202124;
		font-weight: 700;
		text-align: right;
	}
</style>
