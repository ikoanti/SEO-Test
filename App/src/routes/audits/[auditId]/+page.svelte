<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { AuditFindingStatus } from '$lib/audit-status';
	import AuditFindingCard from '$lib/components/AuditFindingCard.svelte';
	import AuditOverviewCard from '$lib/components/AuditOverviewCard.svelte';
	import CustomCheckmark from '$lib/components/CustomCheckmark.svelte';
	import OpenPageRankCard from '$lib/components/OpenPageRankCard.svelte';
	import PageSpeedCard from '$lib/components/PageSpeedCard.svelte';
	import SegmentedPicker from '$lib/components/SegmentedPicker.svelte';
	import { ArrowUp, FileText, FileUp } from 'lucide-svelte';
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
		screenshot?: {
			id?: string;
			title?: string;
			page_url?: string;
			image_url?: string;
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
		reportPreviewItems: {
			key: string;
			title: string;
			sourceFindingTypeKey: string;
			sourceLabel: string;
			sortOrder: number;
			status: AuditFindingStatus;
			priority: 'Urgent' | 'High' | 'Medium';
			paragraphs: string[];
			count: number;
			screenshot?: {
				id?: string;
				title?: string;
				page_url?: string;
				image_url?: string;
			} | null;
			findings: AuditFindingView[];
		}[];
		selectedReportTemplateKeys: string[];
		aiVisibility: Record<string, unknown> | null;
		normalizedItems: AuditItemView[];
		isPendingReport?: boolean;
		isPendingScreenshots?: boolean;
	};

	type LegacySection = {
		key: string;
		title: string;
		subtitle?: string;
		mini?: boolean;
	};

	type AuditTab = 'findings' | 'ai-visibility' | 'report';

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
		{ key: 'shopifyUrls', title: 'Shopify URL Structure', mini: true },
		{ key: 'internationalDomains', title: 'International Domains & Hreflang' },
		{ key: 'trailingSlash', title: 'Trailing Slash Consistency' },
		{ key: 'wwwResolve', title: 'WWW vs Non-WWW Resolution' },
		{ key: 'trustSignals', title: 'Contact & Trust Signals' },
		{ key: 'tapTargets', title: 'Mobile Tap Targets', subtitle: 'Analyzing DOM heuristics' },
		{ key: 'lazyLoadImages', title: 'Lazy Loading Images', mini: true }
	];

	let { data, form }: { data: AuditPageViewData; form?: ActionData } = $props();
	let liveData = $state<AuditPageViewData | null>(null);
	const pageData = $derived(liveData ?? data);
	let activeTab = $state<AuditTab>('findings');
	let selectedReportKeys = $state<string[]>([]);
	let reportSelectionSeed = $state('');
	let showReturnToTop = $state(false);
	let fallbackInterval: number | undefined;
	let stream: EventSource | undefined;

	const pendingStatuses = new Set(['queued', 'running']);
	const runStatus = () => pageData.runRecord.status || 'queued';
	const isPending = () => pendingStatuses.has(runStatus());
	const isFailed = () => runStatus() === 'failed';
	const canExport = () => runStatus() === 'completed';
	const reportSelectionMin = () => Math.min(5, pageData.reportPreviewItems?.length ?? 0);
	const reportSelectionIsValid = () =>
		(pageData.reportPreviewItems?.length ?? 0) === 0 ||
		(selectedReportKeys.length >= reportSelectionMin() && selectedReportKeys.length <= 10);
	const needsLiveUpdates = () => isPending() || Boolean(pageData.isPendingScreenshots);
	const tabs: { key: AuditTab; label: string }[] = [
		{ key: 'findings', label: 'Findings' },
		{ key: 'ai-visibility', label: 'AI Visibility' },
		{ key: 'report', label: 'Export' }
	];
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
	const metricSection = (key: string) => {
		const auditValue = auditSection(key);
		if (Object.keys(auditValue).length > 0) return auditValue;
		return getRecord(itemByKey(key)?.findings?.[0]?.meta);
	};
	const displayValue = (value: unknown, fallback = '-') =>
		value === undefined || value === null || value === '' ? fallback : String(value);
	const openPageRank = () => metricSection('openPageRank');
	const pageSpeed = () => metricSection('pageSpeed');

	$effect(() => {
		const previewKeys = (pageData.reportPreviewItems || []).map((item) => item.key).join('|');
		const savedKeys = (pageData.selectedReportTemplateKeys || []).join('|');
		const seed = `${pageData.auditId}:${previewKeys}:${savedKeys}`;
		if (seed === reportSelectionSeed) return;

		selectedReportKeys = pageData.selectedReportTemplateKeys?.length
			? pageData.selectedReportTemplateKeys.filter((key) =>
					pageData.reportPreviewItems?.some((item) => item.key === key)
				)
			: (pageData.reportPreviewItems || []).slice(0, 10).map((item) => item.key);
		reportSelectionSeed = seed;
	});

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
		}, 3000);
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
			if (!pendingStatuses.has(next.runRecord.status || '') && !next.isPendingScreenshots) {
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

	function updateReturnToTopVisibility() {
		showReturnToTop = window.scrollY > window.innerHeight / 2;
	}

	function returnToTop() {
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	onMount(() => {
		ensureLiveUpdates();
		updateReturnToTopVisibility();
		window.addEventListener('scroll', updateReturnToTopVisibility, { passive: true });
		window.addEventListener('resize', updateReturnToTopVisibility);

		return () => {
			window.removeEventListener('scroll', updateReturnToTopVisibility);
			window.removeEventListener('resize', updateReturnToTopVisibility);
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

	<SegmentedPicker options={tabs} bind:selected={activeTab} ariaLabel="Audit sections" />

	<section class="results-grid audit-results">
		{#if activeTab === 'findings'}
			<OpenPageRankCard
				pageRank={displayValue(openPageRank().pageRank)}
				globalRank={displayValue(openPageRank().globalRank)}
				screenshot={itemByKey('openPageRank')?.screenshot}
			/>

			<PageSpeedCard pageSpeedData={pageSpeed()} screenshot={itemByKey('pageSpeed')?.screenshot} />

			{#each legacySections as section (section.key)}
				<AuditFindingCard {section} item={itemByKey(section.key)} />
			{/each}
		{:else if activeTab === 'ai-visibility'}
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
							<span class="metric-value highlight-green"
								>{pageData.aiVisibility.mentions ?? '-'}</span
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
		{:else if activeTab === 'report'}
			<div class="card audit-card" id="card-report">
				<h3 class="audit-card-title">Export</h3>
				{#if canExport()}
					<form
						method="GET"
						action={resolve(`/api/audits/${pageData.auditId}/export.docx`)}
						class="report-builder"
					>
						<div class="report-builder-header">
							<div>
								<p class="report-builder-title">Review export findings</p>
								<p class="muted report-builder-copy">
									Select {reportSelectionMin()}–10 findings. These previews are exactly what will
									appear in the final export.
								</p>
							</div>
							<span class="report-selection-count"
								>{selectedReportKeys.length}/{pageData.reportPreviewItems?.length ?? 0} selected</span
							>
						</div>

						{#if pageData.reportPreviewItems?.length}
							<div class="report-preview-list">
								{#each pageData.reportPreviewItems as item (item.key)}
									<label class="report-preview-item">
										<input
											type="checkbox"
											name="reportTemplateKey"
											value={item.key}
											bind:group={selectedReportKeys}
										/>
										<CustomCheckmark
											checked={selectedReportKeys.includes(item.key)}
											label={`${item.title} selected`}
										/>
										<div class="report-preview-body">
											<div class="report-preview-heading">
												<span>{item.title}</span>
												<span class="report-priority">{item.priority}</span>
											</div>
											{#each item.paragraphs as paragraph, index (`${item.key}-paragraph-${index}`)}
												<p>{paragraph}</p>
											{/each}
											{#if item.screenshot?.image_url}
												<div class="report-preview-proof">
													<img
														src={item.screenshot.image_url}
														alt={item.screenshot.title || item.title}
													/>
												</div>
											{/if}
										</div>
									</label>
								{/each}
							</div>
						{:else}
							<p class="muted report-status-note">
								No export-ready findings are available for this audit.
							</p>
						{/if}

						<button type="submit" class="audit-primary-button" disabled={!reportSelectionIsValid()}>
							<FileText size={18} />
							<span>Export DOCX</span>
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
			</div>
		{/if}
	</section>
{/if}

{#if showReturnToTop}
	<button class="return-to-top" type="button" aria-label="Return to top" onclick={returnToTop}>
		<ArrowUp size={20} />
		<span>Top</span>
	</button>
{/if}

<style>
	.results-grid {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.5rem;
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

	.report-builder {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.report-builder-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	.report-builder-title {
		margin: 0 0 0.35rem;
		color: var(--text-primary);
		font-size: 1.05rem;
		font-weight: 800;
	}

	.report-builder-copy {
		margin: 0;
	}

	.report-selection-count {
		flex: 0 0 auto;
		border: 1px solid var(--border-color);
		border-radius: 999px;
		padding: 0.55rem 0.85rem;
		color: var(--text-muted);
		font-size: 0.9rem;
		font-weight: 800;
	}

	.report-preview-list {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.report-preview-item {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.9rem;
		padding: 1rem;
		border: 1px solid var(--border-color);
		border-radius: 18px;
		background: rgba(9, 14, 22, 0.28);
		cursor: pointer;
	}

	.report-preview-item input {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.report-preview-item:has(input:focus-visible) {
		border-color: var(--goldenweb-primary);
	}

	.report-preview-body {
		min-width: 0;
	}

	.report-preview-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.65rem;
		color: var(--text-primary);
		font-size: 1rem;
		font-weight: 900;
	}

	.report-priority {
		flex: 0 0 auto;
		color: var(--goldenweb-primary);
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.report-preview-body p {
		margin: 0 0 0.65rem;
		color: var(--text-muted);
		font-size: 0.95rem;
		line-height: 1.55;
	}

	.report-preview-proof {
		margin-top: 0.85rem;
	}

	.report-preview-proof img {
		width: 100%;
		max-height: 260px;
		object-fit: cover;
		border: 1px solid var(--border-color);
		border-radius: 12px;
	}

	.ai-visibility-results {
		margin-top: 1rem;
		margin-bottom: 0;
	}

	.return-to-top {
		position: fixed;
		right: clamp(1rem, 3vw, 2rem);
		bottom: clamp(1rem, 3vw, 2rem);
		z-index: 30;
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		border: 1px solid var(--border-color);
		border-radius: 999px;
		padding: 0.75rem 1rem;
		background: rgba(24, 31, 43, 0.94);
		color: var(--text-primary);
		font: inherit;
		font-size: 0.92rem;
		font-weight: 900;
		cursor: pointer;
		backdrop-filter: blur(12px);
	}

	.return-to-top :global(svg) {
		color: var(--goldenweb-primary);
	}

	.return-to-top:focus-visible {
		outline: 2px solid var(--goldenweb-primary);
		outline-offset: 3px;
	}

	@media (max-width: 640px) {
		.return-to-top {
			right: 1rem;
			bottom: 1rem;
			padding: 0.7rem 0.9rem;
		}
	}
</style>
