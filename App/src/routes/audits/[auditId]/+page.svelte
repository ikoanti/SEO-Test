<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { ArrowLeft, Copy, Download, FileText, FileUp, Sparkles } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import type { ActionData } from './$types';

	type AuditFindingView = {
		id: string;
		status?: string;
		title?: string;
		detail?: string;
		page_url?: string;
		meta?: Record<string, unknown> | null;
	};

	type AuditItemView = {
		id: string;
		key: string;
		label: string;
		status?: string;
		runStatus?: string;
		summary?: string;
		stats?: unknown;
		itemRun?: {
			status?: string;
			started_at?: string;
			completed_at?: string;
			run_log?: string;
			error_message?: string;
		} | null;
		findings: AuditFindingView[];
	};

	type AuditPageViewData = {
		auditId: string;
		runRecord: {
			status?: string;
			url?: string;
			name?: string;
			error_message?: string;
			run_log?: string;
		};
		auditRecord: {
			name?: string;
			url?: string;
		} | null;
		audit: Record<string, unknown> | null;
		summary: {
			domain?: string;
			summary?: { passed?: number; warnings?: number; failed?: number };
		} | null;
		reportHtml: string;
		aiVisibility: Record<string, unknown> | null;
		normalizedItems: AuditItemView[];
	};

	type LegacySection = {
		key: string;
		title: string;
		subtitle?: string;
		mini?: boolean;
	};

	const legacySections: LegacySection[] = [
		{ key: 'h1Tags', title: 'H1 Elements', subtitle: 'Scanning exactly 50 pages…', mini: true },
		{ key: 'metaTitles', title: 'Meta Titles', subtitle: 'Scanning exactly 50 pages…', mini: true },
		{ key: 'internalLinks', title: 'Internal Links', mini: true },
		{
			key: 'imageAltTags',
			title: 'Image Alt Tags',
			subtitle: 'Scanning exactly 50 pages…',
			mini: true
		},
		{
			key: 'canonicalUrls',
			title: 'Canonical URL',
			subtitle: 'Scanning exactly 50 pages…',
			mini: true
		},
		{ key: 'sitemap', title: 'Sitemap.xml' },
		{
			key: 'robotsTxt',
			title: 'Robots.txt Analysis',
			subtitle: 'Checking crawler directives and sitemap'
		},
		{
			key: 'aiVisibility',
			title: 'AI Bot Visibility',
			subtitle: 'Analyzing AI crawler rules in robots.txt'
		},
		{ key: 'llmsTxt', title: 'LLMs.txt Inspector' },
		{ key: 'structuredData', title: 'Structured Data' },
		{
			key: 'security',
			title: 'Security (HTTPS)',
			subtitle: 'Scanning exactly 50 pages…',
			mini: true
		},
		{
			key: 'mixedContent',
			title: 'Mixed Content',
			subtitle: 'Scanning exactly 50 pages…',
			mini: true
		},
		{
			key: 'contentQuality',
			title: 'Content Quality',
			subtitle: 'Scanning exactly 50 pages…',
			mini: true
		},
		{ key: 'webIcons', title: 'Web Icons' },
		{ key: 'ssl', title: 'SSL Certificate Check' },
		{ key: 'mobileUsability', title: 'Mobile Usability' },
		{ key: 'flash', title: 'Flash Usage' },
		{ key: 'charset', title: 'Character Encoding' },
		{ key: 'loremIpsum', title: 'Lorem Ipsum Test' },
		{ key: 'openGraph', title: 'OpenGraph Tags' },
		{ key: 'shopifyUrls', title: 'Shopify URL Structure' },
		{ key: 'internationalDomains', title: 'International Domains & Hreflang' },
		{ key: 'trailingSlash', title: 'Trailing Slash Consistency' },
		{ key: 'wwwResolve', title: 'WWW vs Non-WWW Resolution' },
		{ key: 'trustSignals', title: 'Contact & Trust Signals' },
		{ key: 'tapTargets', title: 'Mobile Tap Targets', subtitle: 'Analyzing DOM heuristics' },
		{ key: 'lazyLoadImages', title: 'Lazy Loading Images' }
	];

	let { data, form }: { data: AuditPageViewData; form?: ActionData } = $props();
	let liveData = $state<AuditPageViewData | null>(null);
	const pageData = $derived(liveData ?? data);
	let copyState = $state('Copy');

	const pageSpeedStrategies = ['mobile', 'desktop'] as const;
	const pendingStatuses = new Set(['queued', 'running']);
	const runStatus = () => pageData.runRecord.status || 'queued';
	const isPending = () => pendingStatuses.has(runStatus());
	const isFailed = () => runStatus() === 'failed';
	const pageTitle = () =>
		pageData.auditRecord?.name ||
		pageData.runRecord?.name ||
		pageData.auditRecord?.url ||
		pageData.runRecord?.url;
	const pageUrl = () => pageData.auditRecord?.url || pageData.runRecord?.url || '';

	const itemByKey = (key: string) => pageData.normalizedItems?.find((item) => item.key === key);
	const getRecord = (value: unknown): Record<string, unknown> =>
		value && typeof value === 'object' && !Array.isArray(value)
			? (value as Record<string, unknown>)
			: {};
	const auditSection = (key: string) => getRecord(pageData.audit?.[key]);
	const nestedRecord = (record: Record<string, unknown>, key: string) => getRecord(record[key]);
	const displayValue = (value: unknown, fallback = '-') =>
		value === undefined || value === null || value === '' ? fallback : String(value);
	const statusIcon = (status?: string) =>
		status === 'ok' ? '✅' : status === 'warn' ? '⚠️' : status === 'err' ? '❌' : 'ℹ️';
	const statusClass = (status?: string) =>
		status === 'ok'
			? 'icon-ok'
			: status === 'warn'
				? 'icon-warn'
				: status === 'err'
					? 'icon-err'
					: 'icon-info';
	const openPageRank = () => auditSection('openPageRank');
	const pageSpeed = () => auditSection('pageSpeed');

	function scoreClass(score: unknown) {
		const value = Number(score);
		if (!Number.isFinite(value) || value <= 0) return '';
		if (value >= 90) return 'good';
		if (value >= 50) return 'needs-improvement';
		return 'poor';
	}

	function metricsForPageSpeed(strategy: 'mobile' | 'desktop') {
		const pageSpeed = auditSection('pageSpeed');
		const metrics = nestedRecord(nestedRecord(pageSpeed, strategy), 'metrics');
		return [
			['FCP', metrics.FCP ?? metrics.fcp],
			['LCP', metrics.LCP ?? metrics.lcp],
			['CLS', metrics.CLS ?? metrics.cls],
			['TBT', metrics.TBT ?? metrics.tbt]
		];
	}

	function summaryBarStyle() {
		const passed = pageData.summary?.summary?.passed ?? 0;
		const warnings = pageData.summary?.summary?.warnings ?? 0;
		const failed = pageData.summary?.summary?.failed ?? 0;
		const total = passed + warnings + failed;
		if (!total) return '';
		const passedPct = (passed / total) * 100;
		const warnPct = (warnings / total) * 100;
		return `background: linear-gradient(to right, var(--success) 0%, var(--success) ${passedPct}%, var(--warning) ${passedPct}%, var(--warning) ${passedPct + warnPct}%, var(--danger) ${passedPct + warnPct}%, var(--danger) 100%)`;
	}

	function statsText(item?: AuditItemView) {
		const metaStats = item?.findings?.find((finding) => finding.meta)?.meta;
		const stats = getRecord(metaStats).stats;
		return typeof stats === 'string' ? stats : item?.summary || '';
	}

	function statPills(item?: AuditItemView) {
		const findings = item?.findings || [];
		return {
			good: findings.filter((finding) => finding.status === 'ok').length,
			warn: findings.filter((finding) => finding.status === 'warn').length,
			bad: findings.filter((finding) => finding.status === 'err').length
		};
	}

	function linkLabel(url: string) {
		try {
			const parsed = new URL(url);
			const label = `${parsed.pathname}${parsed.search}` || '/';
			return label.length > 55 ? `${label.slice(0, 55)}…` : label;
		} catch {
			return url.length > 55 ? `${url.slice(0, 55)}…` : url;
		}
	}

	async function copyReport() {
		if (!pageData.reportHtml) return;

		const container = document.createElement('div');
		container.innerHTML = pageData.reportHtml;
		const text = container.innerText || container.textContent || '';
		await navigator.clipboard.writeText(text);
		copyState = 'Copied';
		window.setTimeout(() => {
			copyState = 'Copy';
		}, 2000);
	}

	function resolvedFilename() {
		const raw = pageData.runRecord.url || pageData.summary?.domain || 'audit';
		try {
			return new URL(raw.startsWith('http') ? raw : `https://${raw}`).hostname;
		} catch {
			return 'audit';
		}
	}

	function downloadReportHtml() {
		if (!pageData.reportHtml) return;

		const filename = resolvedFilename();
		const fullHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Mini SEO Audit - ${filename}</title></head><body style="background:#ffffff;color:#333333;margin:0;padding:2rem;font-family:'Segoe UI',sans-serif;">${pageData.reportHtml}</body></html>`;
		const blob = new Blob([fullHtml], { type: 'text/html' });
		const link = document.createElement('a');
		link.download = `Mini-SEO-Audit-${filename}.html`;
		link.href = URL.createObjectURL(blob);
		link.click();
		URL.revokeObjectURL(link.href);
	}

	function downloadReportDoc() {
		if (!pageData.reportHtml) return;

		const filename = resolvedFilename();
		const header =
			"<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Mini SEO Audit</title><style>body { font-family: Arial, sans-serif; }</style></head><body>";
		const footer = '</body></html>';
		const blob = new Blob(['\ufeff', header + pageData.reportHtml + footer], {
			type: 'application/msword'
		});
		const link = document.createElement('a');
		link.download = `Mini-SEO-Audit-${filename}.doc`;
		link.href = URL.createObjectURL(blob);
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(link.href);
	}

	onMount(() => {
		let fallbackInterval: number | undefined;
		let stream: EventSource | undefined;

		const startFallbackPolling = () => {
			if (fallbackInterval || !pendingStatuses.has(pageData.runRecord.status || '')) return;
			fallbackInterval = window.setInterval(() => {
				void invalidateAll();
			}, 1000);
		};

		if (pendingStatuses.has(pageData.runRecord.status || '')) {
			stream = new EventSource(`/api/audits/${pageData.auditId}/stream`);
			stream.onmessage = (event) => {
				const next = JSON.parse(event.data) as AuditPageViewData;
				liveData = next;
				if (!pendingStatuses.has(next.runRecord.status || '')) {
					stream?.close();
					stream = undefined;
					if (fallbackInterval) {
						window.clearInterval(fallbackInterval);
						fallbackInterval = undefined;
					}
				}
			};
			stream.onerror = () => {
				if (stream?.readyState === EventSource.CLOSED) {
					startFallbackPolling();
				}
			};
		}

		return () => {
			stream?.close();
			if (fallbackInterval) {
				window.clearInterval(fallbackInterval);
			}
		};
	});
</script>

<section class="page-head audit-page-head">
	<div>
		<h1>{pageTitle()}</h1>
		<p class="muted">{pageUrl()}</p>
		<p class="muted">Run status: {runStatus()}</p>
	</div>
	<a class="back-link icon-link" href={resolve('/audits')}>
		<ArrowLeft size={16} />
		<span>Back to audits</span>
	</a>
</section>

{#if isPending()}
	<section class="card legacy-card">
		<h2>Run in progress</h2>
		<p class="muted">This audit is processing live. Cards update as each audit item completes.</p>
	</section>
{:else if isFailed()}
	<section class="card legacy-card">
		<h2>Run failed</h2>
		<p class="error">{pageData.runRecord.error_message || 'The audit run failed.'}</p>
	</section>
{/if}

{#if pageData.auditRecord}
	<section class="summary-bar">
		<div class="summary-item">
			<span class="summary-count">{pageData.summary?.summary?.passed ?? 0}</span>
			<span class="summary-label">✅ Passed</span>
		</div>
		<div class="summary-item">
			<span class="summary-count warn">{pageData.summary?.summary?.warnings ?? 0}</span>
			<span class="summary-label">⚠️ Warnings</span>
		</div>
		<div class="summary-item">
			<span class="summary-count fail">{pageData.summary?.summary?.failed ?? 0}</span>
			<span class="summary-label">❌ Failed</span>
		</div>
		<div class="summary-score-bar-wrap">
			<div class="summary-score-bar" style={summaryBarStyle()}></div>
		</div>
	</section>

	<section class="results-grid audit-results">
		<div class="card legacy-card" id="card-screenshot">
			<h3>Website Screenshot</h3>
			<div class="screenshot-container">
				<div class="screenshot-placeholder">
					<div class="pulse-loader"></div>
					<span>Screenshot capture is not persisted for this run yet.</span>
				</div>
			</div>
		</div>

		<div class="card legacy-card card-ahrefs" id="card-opr">
			<div class="card-header">
				<h3>Open Page Rank</h3>
			</div>
			<div class="ahrefs-metrics">
				<div class="metric-item">
					<span class="metric-label">Page Rank</span>
					<span class="metric-value">{displayValue(openPageRank().pageRank)}</span>
				</div>
				<div class="metric-item">
					<span class="metric-label">Global Rank</span>
					<span class="metric-value">{displayValue(openPageRank().globalRank)}</span>
				</div>
			</div>
			<ul class="check-list">
				<li>
					<div class="check-status">
						<span class="icon-info">ℹ️</span>
						{itemByKey('openPageRank')?.summary || 'Open Page Rank metrics'}
					</div>
				</li>
			</ul>
		</div>

		<div class="card legacy-card" id="card-speed">
			<h3>PageSpeed Insights</h3>
			<div class="speed-container">
				{#each pageSpeedStrategies as strategy (strategy)}
					{@const strategyData = nestedRecord(pageSpeed(), strategy)}
					<div class="speed-item">
						<div class={`metric-circle ${scoreClass(strategyData.score)}`}>
							{displayValue(strategyData.score, '--')}
						</div>
						<span class="speed-label">{strategy === 'mobile' ? 'Mobile' : 'Desktop'} Score</span>
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
		</div>

		{#each legacySections as section (section.key)}
			{@const item = itemByKey(section.key)}
			{@const pills = statPills(item)}
			<div class="card legacy-card" id={`card-${section.key}`}>
				<h3>{section.title}</h3>
				{#if section.subtitle || statsText(item)}
					<p class="subtitle">{statsText(item) || section.subtitle}</p>
				{/if}
				{#if section.mini}
					<div class="scan-stats">
						<div class="scan-stat good">{pills.good} ✅ Good</div>
						<div class="scan-stat warn">{pills.warn} ⚠️ Issues</div>
						<div class="scan-stat bad">{pills.bad} ❌ Missing</div>
					</div>
				{/if}
				{#if section.key === 'internalLinks'}
					<div class="links-summary">
						<div class="stat"><span>{pills.good + pills.warn + pills.bad}</span> Total</div>
						<div class="stat"><span class="error">{pills.bad}</span> Broken</div>
					</div>
				{/if}
				<ul class={`check-list ${section.mini ? 'mini-list' : ''}`}>
					{#if item?.findings?.length}
						{#each item.findings as finding, index (`${item.id}-${index}`)}
							<li>
								<div class="check-status">
									<span class={statusClass(finding.status)}>{statusIcon(finding.status)}</span>
									{finding.title || finding.status || 'Finding'}
								</div>
								{#if finding.detail}
									<div class="check-detail">{finding.detail}</div>
								{/if}
								{#if finding.page_url}
									<div class="check-detail">
										<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
										<a class="check-link" href={finding.page_url} target="_blank" rel="noopener">
											{linkLabel(finding.page_url)}
										</a>
									</div>
								{/if}
								{#if typeof finding.meta?.codeSnippet === 'string' && finding.meta.codeSnippet}
									<div class="code-snippet-container">
										<pre><code>{finding.meta.codeSnippet}</code></pre>
									</div>
								{/if}
							</li>
						{/each}
					{:else if item}
						<li>
							<div class="check-status">
								<span class={statusClass(item.status)}>{statusIcon(item.status)}</span>
								{item.summary || 'No findings.'}
							</div>
						</li>
					{:else}
						<li>
							<div class="check-status">
								<span class="icon-info">ℹ️</span>
								No persisted result for this check.
							</div>
						</li>
					{/if}
				</ul>
			</div>
		{/each}

		<div class="card legacy-card card-aiv" id="card-ai-visibility">
			<div class="card-header">
				<h3>AI Visibility Analysis</h3>
			</div>
			<p class="subtitle">Upload an AI Visibility PDF report to extract key metrics</p>
			<form
				method="POST"
				action="?/parsePdf"
				enctype="multipart/form-data"
				class="file-upload-container"
			>
				<input name="pdf" type="file" accept="application/pdf" required />
				<button type="submit" class="report-generate-btn">
					<FileUp size={18} />
					<span>Analyze PDF</span>
				</button>
			</form>
			{#if form?.pdfError}
				<p class="report-error">{form.pdfError}</p>
			{/if}

			{#if pageData.aiVisibility}
				<div class="ahrefs-metrics ai-visibility-results">
					<div class="metric-item">
						<span class="metric-label">AI Visibility</span>
						<span class="metric-value highlight-yellow"
							>{pageData.aiVisibility.aiVisibility ?? '-'}</span
						>
					</div>
					<div class="metric-item">
						<span class="metric-label">Monthly Audience</span>
						<span class="metric-value highlight-green"
							>{pageData.aiVisibility.monthlyAudience ?? '-'}</span
						>
					</div>
					<div class="metric-item">
						<span class="metric-label">Mentions</span>
						<span class="metric-value highlight-green">{pageData.aiVisibility.mentions ?? '-'}</span
						>
					</div>
					<div class="metric-item">
						<span class="metric-label">Cited Pages</span>
						<span class="metric-value highlight-green"
							>{pageData.aiVisibility.citedPages ?? '-'}</span
						>
					</div>
					<div class="metric-item">
						<span class="metric-label">Perf. Topics</span>
						<span class="metric-value highlight-yellow"
							>{pageData.aiVisibility.performingTopics ?? '-'}</span
						>
					</div>
					<div class="metric-item">
						<span class="metric-label">Topic Opps</span>
						<span class="metric-value highlight-yellow"
							>{pageData.aiVisibility.topicOpportunities ?? '-'}</span
						>
					</div>
					<div class="metric-item">
						<span class="metric-label">Cited Sources</span>
						<span class="metric-value highlight-yellow"
							>{pageData.aiVisibility.citedSources ?? '-'}</span
						>
					</div>
					<div class="metric-item">
						<span class="metric-label">Source Opps</span>
						<span class="metric-value highlight-yellow"
							>{pageData.aiVisibility.sourceOpportunities ?? '-'}</span
						>
					</div>
				</div>
			{/if}
		</div>

		<div class="card legacy-card card-report" id="card-report">
			<h3>📄 AI Report Generator</h3>
			<p class="subtitle">
				Generate a professional Mini Technical SEO Audit document using Claude AI
			</p>
			<form method="POST" action="?/generateReport" class="stack">
				{#if form?.reportError}
					<p class="report-error">{form.reportError}</p>
				{/if}
				<button type="submit" class="report-generate-btn">
					<Sparkles size={18} />
					<span>Generate Mini SEO Audit Report</span>
				</button>
			</form>

			{#if pageData.reportHtml}
				<div class="report-actions">
					<button
						type="button"
						class="report-action-btn"
						title="Copy to Clipboard"
						onclick={copyReport}
					>
						<Copy size={16} />
						<span>{copyState}</span>
					</button>
					<button
						type="button"
						class="report-action-btn"
						title="Download as HTML"
						onclick={downloadReportHtml}
					>
						<Download size={16} />
						<span>Download HTML</span>
					</button>
					<button
						type="button"
						class="report-action-btn"
						title="Download as Word Doc"
						onclick={downloadReportDoc}
					>
						<FileText size={16} />
						<span>Download Doc</span>
					</button>
				</div>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				<div class="report-output">{@html pageData.reportHtml}</div>
			{:else}
				<p class="muted">No generated report yet.</p>
			{/if}
		</div>
	</section>
{/if}

{#if pageData.runRecord.run_log}
	<section class="card legacy-card run-log-card">
		<h2>Run log</h2>
		<pre>{pageData.runRecord.run_log}</pre>
	</section>
{/if}

<style>
	.audit-page-head h1 {
		font-size: clamp(1.8rem, 3vw, 2.7rem);
	}

	.summary-bar {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 1rem;
		align-items: center;
		width: 100%;
		max-width: 800px;
		margin: 0 auto 1.5rem;
		padding: 1rem;
		border: 1px solid var(--border);
		border-radius: 1rem;
		background: var(--card-bg);
		box-shadow: var(--card-shadow);
	}

	.summary-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 0.75rem;
		border-radius: 0.75rem;
		background: rgba(0, 0, 0, 0.2);
	}

	.summary-count {
		font-size: 2rem;
		font-weight: 800;
		color: var(--success);
		line-height: 1;
	}

	.summary-count.warn {
		color: var(--warning);
	}

	.summary-count.fail {
		color: var(--danger);
	}

	.summary-label {
		margin-top: 0.4rem;
		color: var(--text-muted);
		font-size: 0.9rem;
		font-weight: 600;
	}

	.summary-score-bar-wrap {
		grid-column: 1 / -1;
		height: 12px;
		background: rgba(0, 0, 0, 0.4);
		border-radius: 6px;
		overflow: hidden;
		box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.5);
	}

	.summary-score-bar {
		width: 100%;
		height: 100%;
		transition: background 0.5s ease;
	}

	.results-grid {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.5rem;
		animation: fadeInUp 0.8s ease 0.1s both;
	}

	.legacy-card {
		width: 100%;
		max-width: 800px;
		border-radius: 1rem;
		padding: 1.5rem;
	}

	.legacy-card h3 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0 0 1rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--border);
		font-size: 1.25rem;
		font-weight: 600;
	}

	.legacy-card .subtitle {
		margin: -0.5rem 0 1rem;
		color: var(--text-muted);
		font-size: 0.85rem;
	}

	.screenshot-container {
		position: relative;
		width: 100%;
		aspect-ratio: 1280 / 800;
		overflow: hidden;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		background: rgba(0, 0, 0, 0.3);
	}

	.screenshot-placeholder {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		color: var(--text-muted);
		font-size: 0.9rem;
		text-align: center;
	}

	.pulse-loader {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: var(--accent);
		opacity: 0.6;
		animation: pulse 1.5s ease-in-out infinite;
	}

	.ahrefs-metrics {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.metric-item {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 1rem;
		border: 1px solid rgba(255, 255, 255, 0.05);
		border-radius: 0.75rem;
		background: rgba(255, 255, 255, 0.03);
	}

	.metric-label {
		color: var(--text-muted);
		font-size: 0.75rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.metric-value {
		color: #fff;
		font-size: 1.25rem;
		font-weight: 700;
	}

	.highlight-yellow {
		color: var(--accent);
	}

	.highlight-green {
		color: var(--success);
	}

	.speed-container {
		display: flex;
		align-items: flex-start;
		justify-content: space-around;
		gap: 1rem;
		padding: 0.75rem 0;
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

	.metric-circle.good {
		border-color: var(--success);
		color: var(--success);
	}

	.metric-circle.needs-improvement {
		border-color: var(--warning);
		color: var(--warning);
	}

	.metric-circle.poor {
		border-color: var(--danger);
		color: var(--danger);
	}

	.speed-label {
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
		padding: 0.4rem 0.6rem;
		border: 1px solid rgba(255, 255, 255, 0.05);
		border-radius: 0.4rem;
		background: rgba(255, 255, 255, 0.03);
	}

	.speed-metric span:last-child {
		color: var(--text-main);
		font-weight: 600;
	}

	.scan-stats,
	.links-summary,
	.file-upload-container {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	.scan-stat,
	.links-summary .stat {
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

	.links-summary .stat span {
		font-size: 1.1rem;
		font-weight: 700;
	}

	.check-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0;
		margin: 0;
		list-style: none;
	}

	.check-list li {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.75rem 1rem;
		border-radius: 0.5rem;
		background: rgba(0, 0, 0, 0.2);
		font-size: 0.95rem;
	}

	.check-status {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 500;
	}

	.check-detail {
		color: var(--text-muted);
		font-size: 0.85rem;
		word-break: break-word;
	}

	.check-link {
		color: #60a5fa;
		text-decoration: none;
		word-break: break-all;
	}

	.check-link:hover {
		text-decoration: underline;
	}

	.icon-ok {
		color: var(--success);
	}

	.icon-warn {
		color: var(--warning);
	}

	.icon-err {
		color: var(--danger);
	}

	.icon-info {
		color: #60a5fa;
	}

	.code-snippet-container {
		margin-top: 0.75rem;
		padding: 0.75rem 1rem;
		overflow-x: auto;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		background: #0f172a;
		box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.4);
	}

	.code-snippet-container pre {
		margin: 0;
		padding: 0;
		background: transparent;
		color: #e2e8f0;
		font-size: 0.85rem;
	}

	.report-generate-btn,
	.report-action-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
	}

	.report-action-btn {
		padding: 0.75rem 1rem;
		border: 1px solid var(--border);
		background: rgba(15, 23, 42, 0.9);
		box-shadow: none;
	}

	.report-error {
		margin: 0.75rem 0;
		color: #fca5a5;
	}

	.ai-visibility-results {
		margin-top: 1rem;
		margin-bottom: 0;
	}

	.run-log-card {
		max-width: 800px;
		margin: 1.5rem auto 0;
	}

	@keyframes fadeInUp {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes pulse {
		0%,
		100% {
			transform: scale(0.8);
			opacity: 0.3;
		}
		50% {
			transform: scale(1.1);
			opacity: 0.6;
		}
	}

	@media (max-width: 760px) {
		.summary-bar,
		.ahrefs-metrics {
			grid-template-columns: 1fr;
		}

		.speed-container {
			flex-direction: column;
			align-items: stretch;
		}

		.speed-divider {
			width: 100%;
			min-height: 1px;
			height: 1px;
		}

		.file-upload-container {
			flex-direction: column;
		}
	}
</style>
