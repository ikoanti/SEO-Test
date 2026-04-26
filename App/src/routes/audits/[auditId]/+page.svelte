<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { AuditFindingStatus } from '$lib/audit-status';
	import AuditFindingCard from '$lib/components/AuditFindingCard.svelte';
	import AuditOverviewCard from '$lib/components/AuditOverviewCard.svelte';
	import OpenPageRankCard from '$lib/components/OpenPageRankCard.svelte';
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
			report_status?: string;
		} | null;
		reportRecord: {
			status?: string;
			error_message?: string;
			started_at?: string;
			completed_at?: string;
		};
		audit: Record<string, unknown> | null;
		summary: {
			domain?: string;
			summary?: { passed?: number; warnings?: number; failed?: number };
		} | null;
		reportHtml: string;
		aiVisibility: Record<string, unknown> | null;
		normalizedItems: AuditItemView[];
		isPendingReport?: boolean;
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
	let fallbackInterval: number | undefined;
	let stream: EventSource | undefined;

	const pendingStatuses = new Set(['queued', 'running']);
	const reportPendingStatuses = new Set(['queued', 'running']);
	const runStatus = () => pageData.runRecord.status || 'queued';
	const isPending = () => pendingStatuses.has(runStatus());
	const isFailed = () => runStatus() === 'failed';
	const reportStatus = () => pageData.reportRecord?.status || 'idle';
	const isReportPending = () => reportPendingStatuses.has(reportStatus());
	const isReportFailed = () => reportStatus() === 'failed';
	const canGenerateReport = () => runStatus() === 'completed' && !isReportPending();
	const hasReport = () => Boolean(pageData.reportHtml);
	const needsLiveUpdates = () => isPending() || isReportPending();
	const pageTitle = () =>
		pageData.auditRecord?.name ||
		pageData.runRecord?.name ||
		pageData.auditRecord?.url ||
		pageData.runRecord?.url;

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

	function stopLiveUpdates() {
		stream?.close();
		stream = undefined;
		if (fallbackInterval) {
			window.clearInterval(fallbackInterval);
			fallbackInterval = undefined;
		}
	}

	function startFallbackPolling() {
		if (fallbackInterval || !needsLiveUpdates()) return;
		fallbackInterval = window.setInterval(() => {
			void invalidateAll();
		}, 1000);
	}

	function ensureLiveUpdates() {
		if (!needsLiveUpdates()) {
			stopLiveUpdates();
			return;
		}

		if (stream) return;

		stream = new EventSource(`/api/audits/${pageData.auditId}/stream`);
		stream.onmessage = (event) => {
			const next = JSON.parse(event.data) as AuditPageViewData;
			liveData = next;
			if (
				!pendingStatuses.has(next.runRecord.status || '') &&
				!reportPendingStatuses.has(next.reportRecord?.status || '')
			) {
				stopLiveUpdates();
			}
		};
		stream.onerror = () => {
			if (stream?.readyState === EventSource.CLOSED) {
				stream = undefined;
				startFallbackPolling();
			}
		};
	}

	const enhanceReportGeneration = () => {
		return async ({
			result,
			update
		}: {
			result: { type: string };
			update: (options?: { reset?: boolean; invalidateAll?: boolean }) => Promise<void>;
		}) => {
			if (result.type === 'failure') {
				await update();
				return;
			}

			await update({ reset: false, invalidateAll: false });
			liveData = {
				...pageData,
				auditRecord: pageData.auditRecord
					? {
							...pageData.auditRecord,
							report_status: 'queued'
						}
					: null,
				reportRecord: {
					...pageData.reportRecord,
					status: 'queued',
					error_message: '',
					started_at: undefined,
					completed_at: undefined
				},
				reportHtml: '',
				isPendingReport: true
			};
			ensureLiveUpdates();
		};
	};

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
		ensureLiveUpdates();

		return () => {
			stopLiveUpdates();
		};
	});
</script>

<AuditHeader title={pageTitle()} status={runStatus()} isPending={isPending()} />

{#if isFailed()}
	<section class="card audit-card">
		<h2>Run failed</h2>
		<p class="error">{pageData.runRecord.error_message || 'The audit run failed.'}</p>
	</section>
{/if}

{#if pageData.auditRecord}
	<AuditOverviewCard
		passed={pageData.summary?.summary?.passed ?? 0}
		warnings={pageData.summary?.summary?.warnings ?? 0}
		failed={pageData.summary?.summary?.failed ?? 0}
		barStyle={summaryBarStyle()}
	/>

	<section class="results-grid audit-results">
		<OpenPageRankCard
			pageRank={displayValue(openPageRank().pageRank)}
			globalRank={displayValue(openPageRank().globalRank)}
		/>

		<PageSpeedCard pageSpeedData={pageSpeed()} />

		{#each legacySections as section (section.key)}
			<AuditFindingCard {section} item={itemByKey(section.key)} />
		{/each}

		<div class="card audit-card" id="card-ai-visibility">
			<h3 class="audit-card-title">AI Visibility Analysis</h3>
			<p class="section-subtitle">Upload an AI Visibility PDF report to extract key metrics</p>
			<form
				method="POST"
				action="?/parsePdf"
				enctype="multipart/form-data"
				class="audit-upload-row"
			>
				<input name="pdf" type="file" accept="application/pdf" required />
				<button type="submit" class="audit-primary-button">
					<FileUp size={18} />
					<span>Analyze PDF</span>
				</button>
			</form>
			{#if form?.pdfError}
				<p class="report-error">{form.pdfError}</p>
			{/if}

			{#if pageData.aiVisibility}
				<div class="metric-grid ai-visibility-results">
					<div class="metric-card">
						<span class="metric-label">AI Visibility</span>
						<span class="metric-value highlight-yellow"
							>{pageData.aiVisibility.aiVisibility ?? '-'}</span
						>
					</div>
					<div class="metric-card">
						<span class="metric-label">Monthly Audience</span>
						<span class="metric-value highlight-green"
							>{pageData.aiVisibility.monthlyAudience ?? '-'}</span
						>
					</div>
					<div class="metric-card">
						<span class="metric-label">Mentions</span>
						<span class="metric-value highlight-green">{pageData.aiVisibility.mentions ?? '-'}</span
						>
					</div>
					<div class="metric-card">
						<span class="metric-label">Cited Pages</span>
						<span class="metric-value highlight-green"
							>{pageData.aiVisibility.citedPages ?? '-'}</span
						>
					</div>
					<div class="metric-card">
						<span class="metric-label">Perf. Topics</span>
						<span class="metric-value highlight-yellow"
							>{pageData.aiVisibility.performingTopics ?? '-'}</span
						>
					</div>
					<div class="metric-card">
						<span class="metric-label">Topic Opps</span>
						<span class="metric-value highlight-yellow"
							>{pageData.aiVisibility.topicOpportunities ?? '-'}</span
						>
					</div>
					<div class="metric-card">
						<span class="metric-label">Cited Sources</span>
						<span class="metric-value highlight-yellow"
							>{pageData.aiVisibility.citedSources ?? '-'}</span
						>
					</div>
					<div class="metric-card">
						<span class="metric-label">Source Opps</span>
						<span class="metric-value highlight-yellow"
							>{pageData.aiVisibility.sourceOpportunities ?? '-'}</span
						>
					</div>
				</div>
			{/if}
		</div>

		<div class="card audit-card" id="card-report">
			<h3 class="audit-card-title">📄 AI Report Generator</h3>
			{#if isReportPending()}
				<p class="muted report-status-note">
					Report generation is running in the background and will finish even if you leave this
					page.
				</p>
			{:else if isReportFailed()}
				<p class="report-error">
					{pageData.reportRecord?.error_message || 'The last report generation attempt failed.'}
				</p>
				<form
					method="POST"
					action="?/generateReport"
					class="stack"
					use:enhance={enhanceReportGeneration}
				>
					{#if form?.reportError}
						<p class="report-error">{form.reportError}</p>
					{/if}
					<button type="submit" class="audit-primary-button">
						<Sparkles size={18} />
						<span>Retry report generation</span>
					</button>
				</form>
			{:else if canGenerateReport()}
				<form
					method="POST"
					action="?/generateReport"
					class="stack"
					use:enhance={enhanceReportGeneration}
				>
					{#if form?.reportError}
						<p class="report-error">{form.reportError}</p>
					{/if}
					<button type="submit" class="audit-primary-button">
						<Sparkles size={18} />
						<span>{hasReport() ? 'Regenerate report' : 'Generate report'}</span>
					</button>
				</form>
			{:else}
				<p class="muted report-status-note">
					{#if isPending()}
						Available after the audit completes.
					{:else if isFailed()}
						Unavailable because the audit run failed.
					{:else}
						Available after audit completion.
					{/if}
				</p>
			{/if}

			{#if hasReport()}
				<div class="audit-inline-actions">
					<button
						type="button"
						class="audit-action-button"
						title="Copy to Clipboard"
						onclick={copyReport}
					>
						<Copy size={16} />
						<span>{copyState}</span>
					</button>
					<button
						type="button"
						class="audit-action-button"
						title="Download as HTML"
						onclick={downloadReportHtml}
					>
						<Download size={16} />
						<span>Download HTML</span>
					</button>
					<button
						type="button"
						class="audit-action-button"
						title="Download as Word Doc"
						onclick={downloadReportDoc}
					>
						<FileText size={16} />
						<span>Download Doc</span>
					</button>
				</div>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				<div class="report-output">{@html pageData.reportHtml}</div>
			{:else if !isReportPending()}
				<p class="muted">No generated report yet.</p>
			{/if}
		</div>
	</section>
{/if}

{#if pageData.runRecord.run_log}
	<section class="card audit-card run-log-card">
		<h2>Run log</h2>
		<pre>{pageData.runRecord.run_log}</pre>
	</section>
{/if}

<style>
	.results-grid {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.5rem;
		animation: fadeInUp 0.8s ease 0.1s both;
	}

	.highlight-yellow {
		color: var(--goldenweb-primary);
	}

	.highlight-green {
		color: var(--status-pass);
	}

	.report-error {
		margin: 0.75rem 0;
		color: #fca5a5;
	}

	.report-status-note {
		margin: 0 0 1rem;
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
</style>
