<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		AuditSidebar,
		buildSidebarData,
		type AuditPanelData,
		type AuditSidebarData
	} from '$lib/audit-sidebar';
	import type { AuditFindingStatus } from '$lib/audit-status';
	import AuditFindingCard from '$lib/components/AuditFindingCard.svelte';
	import AuditOverviewCard from '$lib/components/AuditOverviewCard.svelte';
	import CustomCheckmark from '$lib/components/CustomCheckmark.svelte';
	import OpenPageRankCard from '$lib/components/OpenPageRankCard.svelte';
	import PageSpeedCard from '$lib/components/PageSpeedCard.svelte';
	import SegmentedPicker from '$lib/components/SegmentedPicker.svelte';
	import { FileText, FileUp, Image as ImageIcon } from 'lucide-svelte';
	import { onMount, tick } from 'svelte';
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
		reportTemplates: {
			key: string;
			title: string;
			priority: 'Urgent' | 'High' | 'Medium';
			match_pattern?: string;
			template_body: string;
			sort_order: number;
			findingTypeKey: string;
			findingTypeLabel: string;
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

	type AuditTab = 'findings' | 'ai-visibility' | 'report' | 'sidebar-preview';
	type AuditNavItem = {
		key: string;
		title: string;
		href: string;
	};
	type SidebarPreviewItem = {
		key: string;
		label: string;
		data: AuditSidebarData;
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
			title: 'AI Chatbots/LLMs Not Whitelisted',
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
	let fallbackInterval: number | undefined;
	let stream: EventSource | undefined;
	let cleanupScrollSpy: (() => void) | undefined;
	let auditSectionNavElement = $state<HTMLElement | undefined>();

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
		{ key: 'sidebar-preview', label: 'Sidebar' },
		{ key: 'report', label: 'Export' }
	];
	const auditNavItems: AuditNavItem[] = [
		{ key: 'openPageRank', title: 'Open Page Rank', href: '#section-opr' },
		{ key: 'pageSpeed', title: 'Unoptimized page speed', href: '#section-speed' },
		...legacySections.map((section) => ({
			key: section.key,
			title: section.title,
			href: `#section-${section.key}`
		}))
	];
	const pageTitle = () =>
		pageData.auditRecord?.name ||
		pageData.runRecord?.name ||
		pageData.auditRecord?.url ||
		pageData.runRecord?.url;
	let activeAuditSection = $state(auditNavItems[0]?.key || '');

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

	function parseMeta(value: unknown) {
		if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
		return value as Record<string, unknown>;
	}

	function extractFirstHttpUrl(value: unknown) {
		const text = String(value ?? '');
		const match = text.match(/https?:\/\/[^\s)]+/);
		if (!match) return '';
		try {
			return new URL(match[0]).href;
		} catch {
			return '';
		}
	}

	function pageUrlFromFinding(finding: AuditFindingView) {
		if (finding.page_url) return finding.page_url;
		const meta = parseMeta(finding.meta);
		const explicit = typeof meta.page_url === 'string' ? meta.page_url : '';
		return explicit || extractFirstHttpUrl(finding.title) || extractFirstHttpUrl(finding.detail);
	}

	function issueText(finding: AuditFindingView, item: AuditItemView) {
		return String(finding.detail || finding.title || item.label || '');
	}

	function issueFindings(item: AuditItemView) {
		return item.findings.filter((finding) => finding.status === 'warn' || finding.status === 'fail');
	}

	function templateForFindingType(key: string) {
		return pageData.reportTemplates?.find((template) => template.findingTypeKey === key);
	}

	function sidebarTitle(item: AuditItemView | undefined) {
		const template = item ? templateForFindingType(item.key) : undefined;
		return template?.title || item?.label || '';
	}

	function sidebarDescription(item: AuditItemView | undefined) {
		const template = item ? templateForFindingType(item.key) : undefined;
		return template?.template_body?.split(/\n{2,}/)[0]?.trim() || '';
	}

	function entryValue(finding: AuditFindingView) {
		const meta = parseMeta(finding.meta);
		const nested = parseMeta(meta.meta);
		const candidates = [
			meta.value,
			nested.value,
			nested.duplicateValue,
			meta.duplicateValue,
			meta.metaTitle,
			meta.metaDescription
		];

		for (const candidate of candidates) {
			if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
		}

		return '';
	}

	function currentDomain() {
		if (typeof pageData.summary?.domain === 'string' && pageData.summary.domain.trim()) {
			return pageData.summary.domain;
		}

		try {
			return new URL(pageData.runRecord.url || '').hostname;
		} catch {
			return 'this domain';
		}
	}

	function buildSidebarPreviewItems(): SidebarPreviewItem[] {
		const items: SidebarPreviewItem[] = [];
		const domain = currentDomain();
		const itemMap = new Map(pageData.normalizedItems.map((item) => [item.key, item]));
		const pageSpeedItem = itemMap.get('pageSpeed');
		const openPageRankItem = itemMap.get('openPageRank');

		if (Object.keys(pageSpeed()).length > 0) {
			const label = sidebarTitle(pageSpeedItem);
			items.push({
				key: 'pagespeed',
				label,
				data: buildSidebarData('pagespeed', {
					kind: 'pagespeed',
					title: label,
					description: sidebarDescription(pageSpeedItem),
					domain,
					pageSpeed: pageSpeed()
				})
			});
		}

		if (Object.keys(openPageRank()).length > 0) {
			const label = sidebarTitle(openPageRankItem);
			items.push({
				key: 'open-page-rank',
				label,
				data: buildSidebarData('open-page-rank', {
					kind: 'open-page-rank',
					title: label,
					description: sidebarDescription(openPageRankItem),
					domain,
					openPageRank: openPageRank()
				})
			});
		}

		const addListPreview = (
			itemKey: string,
			activeTab: string,
			buildPanel: (item: AuditItemView) => AuditPanelData | null
		) => {
			const item = itemMap.get(itemKey);
			if (!item) return;
			const panel = buildPanel(item);
			if (!panel) return;
			items.push({
				key: activeTab,
				label: sidebarTitle(item),
				data: buildSidebarData(activeTab, panel)
			});
		};

		addListPreview(
			'missing-h1-tags',
			'missing-h1-tags',
			(item) =>
			{
				const findings = issueFindings(item);
				const entries = findings
					.map((finding) => {
						const page = pageUrlFromFinding(finding);
						return page ? { page, issue: issueText(finding, item) } : null;
					})
					.filter((entry): entry is { page: string; issue: string } => Boolean(entry));

				return entries.length
					? { kind: 'headings', title: sidebarTitle(item), description: sidebarDescription(item), domain, count: findings.length, entries }
					: null;
			}
		);

		addListPreview(
			'multiple-h1-tags',
			'multiple-h1-tags',
			(item) =>
			{
				const findings = issueFindings(item);
				const entries = findings
					.map((finding) => {
						const page = pageUrlFromFinding(finding);
						return page ? { page, issue: issueText(finding, item) } : null;
					})
					.filter((entry): entry is { page: string; issue: string } => Boolean(entry));

				return entries.length
					? { kind: 'headings', title: sidebarTitle(item), description: sidebarDescription(item), domain, count: findings.length, entries }
					: null;
			}
		);

		addListPreview(
			'missing-product-schema',
			'missing-product-schema',
			(item) =>
			{
				const findings = issueFindings(item);
				const entries = findings
					.map((finding) => {
						const page = pageUrlFromFinding(finding);
						return page ? { page, issue: issueText(finding, item) } : null;
					})
					.filter((entry): entry is { page: string; issue: string } => Boolean(entry));

				return entries.length
					? { kind: 'missing-product-schema', title: sidebarTitle(item), description: sidebarDescription(item), domain, count: findings.length, entries }
					: null;
			}
		);

		addListPreview(
			'missing-faq-schema',
			'missing-faq-schema',
			(item) =>
			{
				const findings = issueFindings(item);
				const entries = findings
					.map((finding) => {
						const page = pageUrlFromFinding(finding);
						return page ? { page, issue: issueText(finding, item) } : null;
					})
					.filter((entry): entry is { page: string; issue: string } => Boolean(entry));

				return entries.length
					? { kind: 'missing-faq-schema', title: sidebarTitle(item), description: sidebarDescription(item), domain, count: findings.length, entries }
					: null;
			}
		);

		addListPreview(
			'missing-organization-schema',
			'missing-organization-schema',
			(item) =>
			{
				const findings = issueFindings(item);
				const entries = findings
					.map((finding) => {
						const page = pageUrlFromFinding(finding);
						return page ? { page, issue: issueText(finding, item) } : null;
					})
					.filter((entry): entry is { page: string; issue: string } => Boolean(entry));

				return entries.length
					? { kind: 'missing-organization-schema', title: sidebarTitle(item), description: sidebarDescription(item), domain, count: findings.length, entries }
					: null;
			}
		);

		addListPreview(
			'unlinked-blog',
			'unlinked-blog',
			(item) =>
			{
				const findings = issueFindings(item);
				const entries = findings
					.map((finding) => {
						const page = pageUrlFromFinding(finding);
						return page ? { page, issue: issueText(finding, item) } : null;
					})
					.filter((entry): entry is { page: string; issue: string } => Boolean(entry));

				return entries.length
					? { kind: 'unlinked-blog', title: sidebarTitle(item), description: sidebarDescription(item), domain, count: findings.length, entries }
					: null;
			}
		);

		addListPreview(
			'imageAltTags',
			'image-alts',
			(item) =>
			{
				const findings = issueFindings(item);
				const entries = findings
					.map((finding) => {
						const meta = parseMeta(finding.meta);
						const page = pageUrlFromFinding(finding);
						const image = extractFirstHttpUrl(meta.title) || extractFirstHttpUrl(finding.title);
						return page && image ? { page, image, issue: issueText(finding, item) } : null;
					})
					.filter(
						(entry): entry is { page: string; image: string; issue: string } => Boolean(entry)
					);

				return entries.length
					? { kind: 'image-alts', title: sidebarTitle(item), description: sidebarDescription(item), domain, count: findings.length, entries }
					: null;
			}
		);

		addListPreview(
			'metaTitles',
			'meta-tags',
			(item) =>
			{
				const findings = issueFindings(item);
				const entries = findings
					.map((finding) => {
						const page = pageUrlFromFinding(finding);
						if (!page) return null;
						const value = entryValue(finding);
						return value
							? { page, issue: issueText(finding, item), value }
							: { page, issue: issueText(finding, item) };
					})
					.filter((entry): entry is { page: string; issue: string; value?: string } => Boolean(entry));

				return entries.length
					? { kind: 'meta-tags', title: sidebarTitle(item), description: sidebarDescription(item), domain, count: findings.length, activePageUrl: entries[0]?.page || '', entries }
					: null;
			}
		);

		addListPreview(
			'canonicalUrls',
			'canonicals',
			(item) =>
			{
				const findings = issueFindings(item);
				const entries = findings
					.map((finding) => {
						const page = pageUrlFromFinding(finding);
						if (!page) return null;
						const value = entryValue(finding);
						return value
							? { page, issue: issueText(finding, item), value }
							: { page, issue: issueText(finding, item) };
					})
					.filter((entry): entry is { page: string; issue: string; value?: string } => Boolean(entry));

				return entries.length
					? { kind: 'canonicals', title: sidebarTitle(item), description: sidebarDescription(item), domain, count: findings.length, entries }
					: null;
			}
		);

		addListPreview(
			'internalLinks',
			'internal-links',
			(item) =>
			{
				const findings = issueFindings(item);
				const entries = findings.reduce<Array<{ page: string; issue: string; count?: number }>>(
					(accumulator, finding) => {
						const meta = parseMeta(finding.meta);
						const page = pageUrlFromFinding(finding);
						if (!page) return accumulator;
						accumulator.push({
							page,
							issue: issueText(finding, item),
							count:
								typeof meta.count === 'number'
									? meta.count
									: Number(meta.count || 0) || undefined
						});
						return accumulator;
					},
					[]
				);

				return entries.length
					? { kind: 'internal-links', title: sidebarTitle(item), description: sidebarDescription(item), domain, count: findings.length, entries }
					: null;
			}
		);

		addListPreview(
			'lazyLoadImages',
			'lazy-loading',
			(item) =>
			{
				const findings = issueFindings(item);
				const entries = findings
					.map((finding) => {
						const meta = parseMeta(finding.meta);
						const page = pageUrlFromFinding(finding);
						const image =
							extractFirstHttpUrl(meta.title) ||
							extractFirstHttpUrl(meta.image) ||
							extractFirstHttpUrl(finding.title);
						return page && image ? { page, issue: issueText(finding, item), image } : null;
					})
					.filter((entry): entry is { page: string; issue: string; image: string } => Boolean(entry));

				return entries.length
					? { kind: 'lazy-loading', title: sidebarTitle(item), description: sidebarDescription(item), domain, count: findings.length, entries }
					: null;
			}
		);

		addListPreview(
			'openGraph',
			'open-graph',
			(item) =>
			{
				const findings = issueFindings(item);
				const entries = findings.reduce<
					Array<{ page: string; issue: string; property?: string }>
				>(
					(accumulator, finding) => {
						const meta = parseMeta(finding.meta);
						const page = pageUrlFromFinding(finding);
						if (!page) return accumulator;
						accumulator.push({
							page,
							issue: issueText(finding, item),
							property:
								typeof meta.property === 'string'
									? meta.property
									: typeof meta.tag === 'string'
										? meta.tag
										: undefined
						});
						return accumulator;
					},
					[]
				);

				return entries.length
					? { kind: 'open-graph', title: sidebarTitle(item), description: sidebarDescription(item), domain, count: findings.length, entries }
					: null;
			}
		);

		addListPreview(
			'contentQuality',
			'content-quality',
			(item) =>
			{
				const findings = issueFindings(item);
				const entries = findings.reduce<Array<{ page: string; issue: string; wordCount?: number }>>(
					(accumulator, finding) => {
						const meta = parseMeta(finding.meta);
						const page = pageUrlFromFinding(finding);
						if (!page) return accumulator;
						accumulator.push({
							page,
							issue: issueText(finding, item),
							wordCount:
								typeof meta.wordCount === 'number'
									? meta.wordCount
									: Number(meta.wordCount || meta.value || 0) || undefined
						});
						return accumulator;
					},
					[]
				);

				return entries.length
					? { kind: 'content-quality', title: sidebarTitle(item), description: sidebarDescription(item), domain, count: findings.length, entries }
					: null;
			}
		);

		addListPreview(
			'shopifyUrls',
			'shopify-urls',
			(item) =>
			{
				const findings = issueFindings(item);
				const entries = findings
					.map((finding) => {
						const page = pageUrlFromFinding(finding);
						return page
							? {
									page,
									issue: issueText(finding, item),
									pattern: '/collections/{collection}/products/{product}'
								}
							: null;
					})
					.filter(
						(entry): entry is { page: string; issue: string; pattern: string } => Boolean(entry)
					);

				return entries.length
					? { kind: 'shopify-urls', title: sidebarTitle(item), description: sidebarDescription(item), domain, count: findings.length, entries }
					: null;
			}
		);

		const robotsItem = itemMap.get('robotsTxt');
		const robotsRequestMeta =
			robotsItem?.findings
				.map((finding) => {
					const meta = parseMeta(finding.meta);
					return parseMeta(meta.screenshotRequest);
				})
				.find((meta) => Array.isArray(meta.foundAgents)) ?? getRecord(auditSection('robotsTxt'));
		const robotsEntries =
			robotsItem?.findings
				.filter((finding) => finding.status === 'warn' || finding.status === 'fail')
				.filter((finding) => parseMeta(finding.meta).category === 'ai')
				.map((finding) => ({
					issue: robotsItem ? issueText(finding, robotsItem) : '',
					status: finding.status
				})) ?? [];

		if (robotsItem && (Array.isArray(robotsRequestMeta.foundAgents) || robotsEntries.length)) {
			items.unshift({
				key: 'ai-bot-visibility',
				label: sidebarTitle(robotsItem),
				data: buildSidebarData('ai-bot-visibility', {
					kind: 'ai-bot-visibility',
					title: sidebarTitle(robotsItem),
					description: sidebarDescription(robotsItem),
					domain,
					count: robotsEntries.length,
					entries: robotsEntries,
					foundAgents: Array.isArray(robotsRequestMeta.foundAgents)
						? robotsRequestMeta.foundAgents
						: []
				})
			});
		}

		return items;
	}

	const sidebarPreviewItems = $derived(buildSidebarPreviewItems());
	const sidebarPreviewData = $derived<AuditSidebarData | null>(
		sidebarPreviewItems.length
			? {
					activeTab: sidebarPreviewItems[0].key,
					tabs: sidebarPreviewItems.map((item) => ({ id: item.key, label: item.label })),
					panels: Object.fromEntries(
						sidebarPreviewItems
							.map((item) => [item.key, item.data.panels?.[item.key]] as const)
							.filter((entry): entry is readonly [string, AuditPanelData] => Boolean(entry[1]))
					)
				}
			: null
	);

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
		}, 5000);
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

	function sectionIdFromHref(href: string) {
		return href.replace(/^#/, '');
	}

	function updateActiveAuditSection() {
		if (activeTab !== 'findings') return;

		let currentKey = auditNavItems[0]?.key || '';
		const threshold = 140;

		for (const item of auditNavItems) {
			const element = document.getElementById(sectionIdFromHref(item.href));
			if (!element) continue;
			if (element.getBoundingClientRect().top <= threshold) {
				currentKey = item.key;
			}
		}

		if (activeAuditSection !== currentKey) {
			activeAuditSection = currentKey;
			void tick().then(scrollActiveNavItemIntoView);
		}
	}

	function scrollActiveNavItemIntoView() {
		if (!auditSectionNavElement || !activeAuditSection) return;

		const activeLink = auditSectionNavElement.querySelector<HTMLAnchorElement>(
			`a[data-section-key="${CSS.escape(activeAuditSection)}"]`
		);
		if (!activeLink) return;

		const navRect = auditSectionNavElement.getBoundingClientRect();
		const linkRect = activeLink.getBoundingClientRect();
		const isVertical = auditSectionNavElement.scrollHeight > auditSectionNavElement.clientHeight;

		if (isVertical) {
			const isAbove = linkRect.top < navRect.top;
			const isBelow = linkRect.bottom > navRect.bottom;
			if (isAbove || isBelow) {
				activeLink.scrollIntoView({ block: 'nearest', inline: 'nearest' });
			}
			return;
		}

		const isLeft = linkRect.left < navRect.left;
		const isRight = linkRect.right > navRect.right;
		if (isLeft || isRight) {
			activeLink.scrollIntoView({ block: 'nearest', inline: 'nearest' });
		}
	}

	function setupScrollSpy() {
		cleanupScrollSpy?.();
		window.addEventListener('scroll', updateActiveAuditSection, { passive: true });
		window.addEventListener('resize', updateActiveAuditSection);
		updateActiveAuditSection();
		cleanupScrollSpy = () => {
			window.removeEventListener('scroll', updateActiveAuditSection);
			window.removeEventListener('resize', updateActiveAuditSection);
		};
	}

	onMount(() => {
		ensureLiveUpdates();
		void tick().then(setupScrollSpy);

		return () => {
			stopLiveUpdates();
			cleanupScrollSpy?.();
		};
	});

	$effect(() => {
		if (activeTab !== 'findings') return;
		void tick().then(updateActiveAuditSection);
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

	<section class:report-results={activeTab === 'findings'} class="results-grid audit-results">
		{#if activeTab === 'findings'}
			<div class="audit-report-layout">
				<nav
					bind:this={auditSectionNavElement}
					class="audit-section-nav"
					aria-label="Audit findings"
				>
					{#each auditNavItems as navItem (navItem.key)}
						<a
							href={resolve(
								`/audits/${pageData.auditId}${navItem.href}` as `/audits/${string}#${string}`
							)}
							data-section-key={navItem.key}
							class:active={activeAuditSection === navItem.key}
							onclick={() => {
								activeAuditSection = navItem.key;
								void tick().then(scrollActiveNavItemIntoView);
							}}
						>
							<span>{navItem.title}</span>
						</a>
					{/each}
				</nav>

				<div class="audit-report-sections">
					<OpenPageRankCard
						pageRank={displayValue(openPageRank().pageRank)}
						globalRank={displayValue(openPageRank().globalRank)}
						screenshot={itemByKey('openPageRank')?.screenshot}
					/>

					<PageSpeedCard
						pageSpeedData={pageSpeed()}
						screenshot={itemByKey('pageSpeed')?.screenshot}
					/>

					{#each legacySections as section (section.key)}
						<AuditFindingCard {section} item={itemByKey(section.key)} />
					{/each}
				</div>
			</div>
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
		{:else if activeTab === 'sidebar-preview'}
			<div class="card audit-card sidebar-preview-card" id="card-sidebar-preview">
				<h3 class="audit-card-title">Sidebar Preview</h3>
				{#if sidebarPreviewData}
					<div class="sidebar-preview-shell">
						<div class="sidebar-preview-frame">
							<AuditSidebar data={sidebarPreviewData} />
						</div>
					</div>
				{:else}
					<p class="muted report-status-note">
						No sidebar preview is available for the current audit data yet.
					</p>
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
											<div
												class:report-preview-proof-placeholder={!item.screenshot?.image_url}
												class="report-preview-proof"
											>
												{#if item.screenshot?.image_url}
													<img
														src={item.screenshot.image_url}
														alt={item.screenshot.title || item.title}
													/>
												{:else}
													<ImageIcon size={34} strokeWidth={1.6} aria-hidden="true" />
												{/if}
											</div>
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

<style>
	.results-grid {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.5rem;
	}

	.report-results {
		align-items: stretch;
		width: min(100%, 1240px);
		margin: 0 auto;
		gap: 0;
	}

	.audit-report-layout {
		display: grid;
		grid-template-columns: minmax(180px, 220px) minmax(0, 800px) minmax(180px, 220px);
		gap: 1.25rem;
		align-items: start;
		justify-content: center;
	}

	.audit-section-nav {
		position: sticky;
		top: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		max-height: calc(100vh - 2.5rem);
		overflow-y: auto;
		overscroll-behavior: contain;
		padding: 0.25rem 0;
		font-size: 0.9rem;
		scrollbar-width: thin;
	}

	.audit-section-nav a {
		display: block;
		padding: 0.35rem 0;
		border-left: 2px solid transparent;
		padding-left: 0.75rem;
		color: var(--text-muted);
		line-height: 1.25;
	}

	.audit-section-nav a.active {
		border-left-color: var(--goldenweb-primary);
		color: var(--text-main);
		font-weight: 800;
	}

	.audit-report-sections {
		min-width: 0;
		grid-column: 2;
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
		display: flex;
		align-items: center;
		justify-content: center;
		margin-top: 0.85rem;
		aspect-ratio: 16 / 9;
		max-height: 260px;
		overflow: hidden;
		border: 1px solid var(--border-color);
		border-radius: 12px;
		background: rgba(148, 163, 184, 0.08);
	}

	.report-preview-proof img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.report-preview-proof-placeholder {
		color: var(--text-muted);
	}

	.ai-visibility-results {
		margin-top: 1rem;
		margin-bottom: 0;
	}

	.sidebar-preview-card {
		max-width: 980px;
	}

	.sidebar-preview-shell {
		display: flex;
		justify-content: center;
		padding-top: 0.5rem;
	}

	.sidebar-preview-frame {
		width: 420px;
		height: 868px;
		overflow: hidden;
		border-radius: 28px;
		background: #ffffff;
		box-shadow: 0 18px 40px rgba(15, 23, 42, 0.16);
	}

	@media (max-width: 980px) {
		.audit-report-layout {
			grid-template-columns: 1fr;
			gap: 1rem;
		}

		.audit-report-sections {
			grid-column: auto;
		}

		.audit-section-nav {
			position: sticky;
			z-index: 2;
			top: 0;
			flex-direction: row;
			max-height: none;
			overflow-y: hidden;
			overflow-x: auto;
			border-bottom: 1px solid var(--border);
			background: var(--goldenweb-background);
		}

		.audit-section-nav a {
			flex: 0 0 auto;
			border-left: 0;
			border-bottom: 2px solid transparent;
			padding: 0.65rem 0.75rem;
			white-space: nowrap;
		}

		.audit-section-nav a.active {
			border-bottom-color: var(--goldenweb-primary);
		}
	}
</style>
