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
	import PageSpeedCard from '$lib/components/PageSpeedCard.svelte';
	import SegmentedPicker from '$lib/components/SegmentedPicker.svelte';
	import { Cloud, ExternalLink, FileText, FileUp, Image as ImageIcon } from 'lucide-svelte';
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
			error_message?: string;
			run_log?: string;
		};
		website?: {
			id?: string;
			url?: string;
			domain?: string;
			display_name?: string;
			name?: string;
		};
		auditRecord: {
			report_status?: string;
			google_drive_folder_id?: string;
			google_drive_folder_name?: string;
			google_doc_id?: string;
			google_doc_name?: string;
			google_doc_url?: string;
			google_doc_exported_at?: string;
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
			summary?: { passed?: number; warnings?: number; info?: number };
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
		findingDisplayItems?: AuditItemView[];
		isPendingReport?: boolean;
		isPendingScreenshots?: boolean;
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

	let { data, form }: { data: AuditPageViewData; form?: ActionData } = $props();
	let liveData = $state<AuditPageViewData | null>(null);
	const pageData = $derived(liveData ?? data);
	let activeTab = $state<AuditTab>('findings');
	let selectedReportKeys = $state<string[]>([]);
	let reportPriorities = $state<Record<string, 'Urgent' | 'High' | 'Medium'>>({});
	let reportSelectionSeed = $state('');
	let reportFormElement = $state<HTMLFormElement | undefined>();
	let googleExportStatus = $state<'idle' | 'running' | 'done' | 'error'>('idle');
	let googleExportUrl = $state('');
	let googleExportError = $state('');
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
	const googleExportIsRunning = () => googleExportStatus === 'running';
	const needsLiveUpdates = () => isPending() || Boolean(pageData.isPendingScreenshots);
	const tabs: { key: AuditTab; label: string }[] = [
		{ key: 'findings', label: 'Findings' },
		{ key: 'ai-visibility', label: 'AI Visibility' },
		{ key: 'sidebar-preview', label: 'Sidebar' },
		{ key: 'report', label: 'Export' }
	];
	const auditFindingItems = $derived(
		pageData.findingDisplayItems || pageData.normalizedItems || []
	);
	const auditNavItems: AuditNavItem[] = $derived(
		auditFindingItems.map((item) => ({
			key: item.key,
			title: item.label,
			href: `#section-${item.key}`
		}))
	);
	const pageTitle = () =>
		pageData.website?.display_name ||
		pageData.website?.name ||
		pageData.website?.domain ||
		pageData.website?.url;
	let activeAuditSection = $state('');

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

	function stringArray(value: unknown) {
		return Array.isArray(value) ? value.map((item) => String(item)) : [];
	}

	function issueFindings(item: AuditItemView) {
		return item.findings.filter((finding) => finding.status === 'warn');
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

		return pageData.website?.domain || pageData.website?.url || 'this domain';
	}

	function buildSidebarPreviewItems(): SidebarPreviewItem[] {
		const items: SidebarPreviewItem[] = [];
		const domain = currentDomain();
		const itemMap = new Map(pageData.normalizedItems.map((item) => [item.key, item]));
		const pageSpeedItem = itemMap.get('pageSpeed');

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

		addListPreview('missing-h1-tags', 'missing-h1-tags', (item) => {
			const findings = issueFindings(item);
			const entries = findings
				.map((finding) => {
					const page = pageUrlFromFinding(finding);
					return page ? { page, issue: issueText(finding, item) } : null;
				})
				.filter((entry): entry is { page: string; issue: string } => Boolean(entry));

			return entries.length
				? {
						kind: 'headings',
						title: sidebarTitle(item),
						description: sidebarDescription(item),
						domain,
						count: findings.length,
						entries
					}
				: null;
		});

		addListPreview('multiple-h1-tags', 'multiple-h1-tags', (item) => {
			const findings = issueFindings(item);
			const entries = findings
				.map((finding) => {
					const page = pageUrlFromFinding(finding);
					const meta = parseMeta(finding.meta);
					const nestedMeta = parseMeta(meta.meta);
					const headings = stringArray(nestedMeta.headings || meta.headings);
					return page ? { page, issue: issueText(finding, item), headings } : null;
				})
				.filter((entry): entry is { page: string; issue: string; headings: string[] } =>
					Boolean(entry)
				);

			return entries.length
				? {
						kind: 'headings',
						title: sidebarTitle(item),
						description: sidebarDescription(item),
						domain,
						count: findings.length,
						entries
					}
				: null;
		});

		addListPreview('missing-product-schema', 'missing-product-schema', (item) => {
			const findings = issueFindings(item);
			const entries = findings
				.map((finding) => {
					const page = pageUrlFromFinding(finding);
					return page ? { page, issue: issueText(finding, item) } : null;
				})
				.filter((entry): entry is { page: string; issue: string } => Boolean(entry));

			return entries.length
				? {
						kind: 'missing-product-schema',
						title: sidebarTitle(item),
						description: sidebarDescription(item),
						domain,
						count: findings.length,
						entries
					}
				: null;
		});

		addListPreview('missing-faq-schema', 'missing-faq-schema', (item) => {
			const findings = issueFindings(item);
			const entries = findings
				.map((finding) => {
					const page = pageUrlFromFinding(finding);
					return page ? { page, issue: issueText(finding, item) } : null;
				})
				.filter((entry): entry is { page: string; issue: string } => Boolean(entry));

			return entries.length
				? {
						kind: 'missing-faq-schema',
						title: sidebarTitle(item),
						description: sidebarDescription(item),
						domain,
						count: findings.length,
						entries
					}
				: null;
		});

		addListPreview('missing-organization-schema', 'missing-organization-schema', (item) => {
			const findings = issueFindings(item);
			const entries = findings
				.map((finding) => {
					const page = pageUrlFromFinding(finding);
					return page ? { page, issue: issueText(finding, item) } : null;
				})
				.filter((entry): entry is { page: string; issue: string } => Boolean(entry));

			return entries.length
				? {
						kind: 'missing-organization-schema',
						title: sidebarTitle(item),
						description: sidebarDescription(item),
						domain,
						count: findings.length,
						entries
					}
				: null;
		});

		addListPreview('unlinked-blog', 'unlinked-blog', (item) => {
			const findings = issueFindings(item);
			const entries = findings
				.map((finding) => {
					const page = pageUrlFromFinding(finding);
					return page ? { page, issue: issueText(finding, item) } : null;
				})
				.filter((entry): entry is { page: string; issue: string } => Boolean(entry));

			return entries.length
				? {
						kind: 'unlinked-blog',
						title: sidebarTitle(item),
						description: sidebarDescription(item),
						domain,
						count: findings.length,
						entries
					}
				: null;
		});

		addListPreview('imageAltTags', 'image-alts', (item) => {
			const findings = issueFindings(item);
			const entries = findings
				.map((finding) => {
					const meta = parseMeta(finding.meta);
					const page = pageUrlFromFinding(finding);
					const image = extractFirstHttpUrl(meta.title) || extractFirstHttpUrl(finding.title);
					return page && image ? { page, image, issue: issueText(finding, item) } : null;
				})
				.filter((entry): entry is { page: string; image: string; issue: string } => Boolean(entry));

			return entries.length
				? {
						kind: 'image-alts',
						title: sidebarTitle(item),
						description: sidebarDescription(item),
						domain,
						count: findings.length,
						entries
					}
				: null;
		});

		const addMetaPreview = (itemKey: string) => {
			addListPreview(itemKey, itemKey, (item) => {
				const findings = issueFindings(item);
				const entries = findings
					.map((finding) => {
						const page = pageUrlFromFinding(finding);
						if (!page) return null;
						const issue = issueText(finding, item);
						const value = entryValue(finding);
						return value ? { page, issue, value } : { page, issue };
					})
					.filter((entry): entry is { page: string; issue: string; value?: string } =>
						Boolean(entry)
					);

				return entries.length
					? {
							kind: 'meta-tags',
							title: sidebarTitle(item),
							description: sidebarDescription(item),
							domain,
							count: findings.length,
							activePageUrl: entries[0]?.page || '',
							entries
						}
					: null;
			});
		};

		addMetaPreview('meta-titles-too-long-unoptimized');
		addMetaPreview('duplicated-page-titles');
		addMetaPreview('duplicated-meta-descriptions');
		addMetaPreview('overly-long-meta-descriptions');

		addListPreview('canonicalUrls', 'canonicals', (item) => {
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
				.filter((entry): entry is { page: string; issue: string; value?: string } =>
					Boolean(entry)
				);

			return entries.length
				? {
						kind: 'canonicals',
						title: sidebarTitle(item),
						description: sidebarDescription(item),
						domain,
						count: findings.length,
						entries
					}
				: null;
		});

		addListPreview('internalLinks', 'internal-links', (item) => {
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
							typeof meta.count === 'number' ? meta.count : Number(meta.count || 0) || undefined
					});
					return accumulator;
				},
				[]
			);

			return entries.length
				? {
						kind: 'internal-links',
						title: sidebarTitle(item),
						description: sidebarDescription(item),
						domain,
						count: findings.length,
						entries
					}
				: null;
		});

		addListPreview('lazyLoadImages', 'lazy-loading', (item) => {
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
				? {
						kind: 'lazy-loading',
						title: sidebarTitle(item),
						description: sidebarDescription(item),
						domain,
						count: findings.length,
						entries
					}
				: null;
		});

		addListPreview('openGraph', 'open-graph', (item) => {
			const findings = issueFindings(item);
			const entries = findings.reduce<Array<{ page: string; issue: string; property?: string }>>(
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
				? {
						kind: 'open-graph',
						title: sidebarTitle(item),
						description: sidebarDescription(item),
						domain,
						count: findings.length,
						entries
					}
				: null;
		});

		addListPreview('contentQuality', 'content-quality', (item) => {
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
				? {
						kind: 'content-quality',
						title: sidebarTitle(item),
						description: sidebarDescription(item),
						domain,
						count: findings.length,
						entries
					}
				: null;
		});

		addListPreview('shopifyUrls', 'shopify-urls', (item) => {
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
				.filter((entry): entry is { page: string; issue: string; pattern: string } =>
					Boolean(entry)
				);

			return entries.length
				? {
						kind: 'shopify-urls',
						title: sidebarTitle(item),
						description: sidebarDescription(item),
						domain,
						count: findings.length,
						entries
					}
				: null;
		});

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
				.filter((finding) => finding.status === 'warn')
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
		reportPriorities = Object.fromEntries(
			(pageData.reportPreviewItems || []).map((item) => [item.key, item.priority])
		);
		googleExportStatus = 'idle';
		googleExportUrl = '';
		googleExportError = '';
		reportSelectionSeed = seed;
	});

	async function exportGoogleDoc() {
		if (!reportFormElement || !reportSelectionIsValid() || googleExportIsRunning()) return;

		googleExportStatus = 'running';
		googleExportUrl = '';
		googleExportError = '';

		try {
			const response = await fetch(resolve(`/api/audits/${pageData.auditId}/export.google-doc`), {
				method: 'POST',
				body: new FormData(reportFormElement)
			});
			const body = await response.json().catch(() => ({}));

			if (!response.ok) {
				throw new Error(body?.message || body?.error || 'Google Docs export failed.');
			}

			googleExportUrl = String(body.url || '');
			googleExportStatus = 'done';
			if (googleExportUrl) window.open(googleExportUrl, '_blank', 'noopener,noreferrer');
		} catch (error) {
			googleExportError = error instanceof Error ? error.message : 'Google Docs export failed.';
			googleExportStatus = 'error';
		}
	}

	$effect(() => {
		if (auditNavItems.some((item) => item.key === activeAuditSection)) return;
		activeAuditSection = auditNavItems[0]?.key || '';
	});

	function summaryBarStyle() {
		const passed = pageData.summary?.summary?.passed ?? 0;
		const warnings = pageData.summary?.summary?.warnings ?? 0;
		const info = pageData.summary?.summary?.info ?? 0;
		const total = passed + warnings + info;
		if (!total) return '';
		const passedPct = (passed / total) * 100;
		const warnPct = (warnings / total) * 100;
		return `background: linear-gradient(to right, var(--status-pass) 0%, var(--status-pass) ${passedPct}%, var(--status-warn) ${passedPct}%, var(--status-warn) ${passedPct + warnPct}%, var(--status-info) ${passedPct + warnPct}%, var(--status-info) 100%)`;
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
		info={pageData.summary?.summary?.info ?? 0}
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
					{#each auditFindingItems as item (item.key)}
						{#if item.key === 'pageSpeed'}
							<PageSpeedCard
								title={item.label}
								pageSpeedData={pageSpeed()}
								screenshot={item.screenshot}
							/>
						{:else}
							<AuditFindingCard {item} />
						{/if}
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
			<div class="sidebar-preview-direct" id="card-sidebar-preview">
				{#if sidebarPreviewData}
					<AuditSidebar data={sidebarPreviewData} />
				{/if}
			</div>
		{:else if activeTab === 'report'}
			<div class="card audit-card" id="card-report">
				<h3 class="audit-card-title">Export</h3>
				{#if canExport()}
					<form
						bind:this={reportFormElement}
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
												<div class="report-priority-control">
													<span>Priority</span>
													<select
														name={`reportPriority:${item.key}`}
														bind:value={reportPriorities[item.key]}
													>
														<option value="Urgent">Urgent</option>
														<option value="High">High</option>
														<option value="Medium">Medium</option>
													</select>
												</div>
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

						<div class="report-export-strip">
							<div class="report-export-actions">
								<button
									type="button"
									class="audit-primary-button"
									disabled={!reportSelectionIsValid() || googleExportIsRunning()}
									onclick={exportGoogleDoc}
								>
									<Cloud size={18} />
									<span>{googleExportIsRunning() ? 'Exporting...' : 'Export to Google Docs'}</span>
								</button>
								<button
									type="submit"
									class="audit-secondary-button"
									disabled={!reportSelectionIsValid()}
								>
									<FileText size={18} />
									<span>Download DOCX</span>
								</button>
							</div>
							{#if googleExportUrl}
								<a class="google-doc-link" href={googleExportUrl} target="_blank" rel="noreferrer">
									<ExternalLink size={17} />
									<span>Open Google Doc</span>
								</a>
							{/if}
							{#if googleExportError}
								<p class="report-error">{googleExportError}</p>
							{/if}
						</div>
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
		display: flex;
		align-items: center;
		width: 100%;
		min-height: 2.75rem;
		box-sizing: border-box;
		padding: 0.5rem 0.75rem;
		border-left: 2px solid transparent;
		border-radius: 0 8px 8px 0;
		color: var(--text-muted);
		line-height: 1.25;
	}

	.audit-section-nav a:hover,
	.audit-section-nav a:focus-visible {
		background: rgba(255, 255, 255, 0.05);
		color: var(--text-primary);
	}

	.audit-section-nav a:focus-visible {
		outline: 2px solid var(--goldenweb-primary);
		outline-offset: 2px;
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
		padding-bottom: 0.75rem;
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

	.report-priority-control {
		flex: 0 0 auto;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--goldenweb-primary);
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.report-priority-control select {
		min-width: 7.5rem;
		border: 1px solid var(--border-color);
		border-radius: 8px;
		padding: 0.45rem 0.6rem;
		background: rgba(15, 23, 42, 0.95);
		color: var(--text-primary);
		font: inherit;
		font-size: 0.85rem;
		font-weight: 800;
		text-transform: none;
		letter-spacing: 0;
	}

	.report-export-strip {
		position: sticky;
		z-index: 5;
		bottom: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin: 0 -1.5rem -1.5rem;
		padding: 1rem 1.5rem;
		border-top: 1px solid var(--border-color);
		border-radius: 0 0 18px 18px;
		background: rgba(9, 14, 22, 0.96);
		backdrop-filter: blur(12px);
		box-shadow: 0 -14px 34px rgba(0, 0, 0, 0.24);
	}

	.report-export-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.audit-secondary-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		border: 1px solid var(--border-color);
		background: rgba(15, 23, 42, 0.86);
		color: var(--text-primary);
	}

	.google-doc-link {
		display: inline-flex;
		align-items: center;
		flex: 0 0 auto;
		gap: 0.45rem;
		width: fit-content;
		color: var(--goldenweb-primary);
		font-weight: 800;
		text-decoration: none;
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

	@media (max-width: 760px) {
		.report-export-strip {
			align-items: stretch;
			flex-direction: column;
			margin-right: -1rem;
			margin-left: -1rem;
			padding: 0.85rem 1rem;
		}

		.report-export-actions {
			flex-direction: column;
		}

		.report-export-actions :global(button),
		.report-export-actions button {
			width: 100%;
		}
	}

	.ai-visibility-results {
		margin-top: 1rem;
		margin-bottom: 0;
	}

	.sidebar-preview-direct {
		width: min(100%, 420px);
		height: 868px;
		overflow: hidden;
	}

	.sidebar-preview-direct :global(.audit-sidebar) {
		width: 100%;
		height: 100%;
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
			width: auto;
			border-left: 0;
			border-bottom: 2px solid transparent;
			padding: 0.65rem 0.75rem;
			border-radius: 8px 8px 0 0;
			white-space: nowrap;
		}

		.audit-section-nav a.active {
			border-bottom-color: var(--goldenweb-primary);
		}
	}
</style>
