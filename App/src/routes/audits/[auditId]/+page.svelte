<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import type { AuditFindingStatus } from '$lib/audit-status';
	import AuditFindingCard from '$lib/components/AuditFindingCard.svelte';
	import PageSpeedCard from '$lib/components/PageSpeedCard.svelte';
	import { Copy, Download, FileText, FileUp, Sparkles } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import AuditHeader from './AuditHeader.svelte';
	import type { ActionData } from './$types';

	type AuditFindingView = {
		id: string;
		status?: AuditFindingStatus;
		title?: string;
		detail?: string;
		page_url?: string;
		meta?: Record<string, unknown> | null;
	};

	type AuditItemView = {
		id: string;
		key: string;
		label: string;
		status?: AuditFindingStatus;
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
	const displayValue = (value: unknown, fallback = '-') =>
		value === undefined || value === null || value === '' ? fallback : String(value);
	const openPageRank = () => auditSection('openPageRank');
	const pageSpeed = () => auditSection('pageSpeed');

	function summaryBarStyle() {
		const passed = pageData.summary?.summary?.passed ?? 0;
		const warnings = pageData.summary?.summary?.warnings ?? 0;
		const failed = pageData.summary?.summary?.failed ?? 0;
		const total = passed + warnings + failed;
		if (!total) return '';
		const passedPct = (passed / total) * 100;
		const warnPct = (warnings / total) * 100;
		return `background: linear-gradient(to right, var(--status-pass) 0%, var(--status-pass) ${passedPct}%, var(--status-warn) ${passedPct}%, var(--status-warn) ${passedPct + warnPct}%, var(--status-fail) ${passedPct + warnPct}%, var(--status-fail) 100%)`;
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

<AuditHeader title={pageTitle()} status={runStatus()} isPending={isPending()} />

{#if isFailed()}
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
		</div>

		<PageSpeedCard pageSpeedData={pageSpeed()} />

		{#each legacySections as section (section.key)}
			<AuditFindingCard {section} item={itemByKey(section.key)} />
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
		color: var(--status-pass);
		line-height: 1;
	}

	.summary-count.warn {
		color: var(--status-warn);
	}

	.summary-count.fail {
		color: var(--status-fail);
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

	.subtitle {
		margin: -0.5rem 0 1rem;
		color: var(--text-muted);
		font-size: 0.85rem;
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
		color: var(--goldenweb-primary);
	}

	.highlight-green {
		color: var(--status-pass);
	}

	.file-upload-container {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-bottom: 1rem;
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
	}

	.report-error {
		margin: 0.75rem 0;
		color: #fca5a5;
	}

	.report-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		margin: 16px 0;
	}

	.report-output {
		padding: 20px;
		overflow: auto;
		border-radius: 16px;
		background: #ffffff;
		color: #0f172a;
	}

	.ai-visibility-results {
		margin-top: 1rem;
		margin-bottom: 0;
	}

	.run-log-card {
		max-width: 800px;
		margin: 1.5rem auto 0;
	}

	pre {
		padding: 16px;
		overflow: auto;
		border-radius: 12px;
		background: rgba(0, 0, 0, 0.2);
		white-space: pre-wrap;
		word-break: break-word;
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

	@media (max-width: 760px) {
		.summary-bar,
		.ahrefs-metrics {
			grid-template-columns: 1fr;
		}

		.file-upload-container {
			flex-direction: column;
		}
	}
</style>
