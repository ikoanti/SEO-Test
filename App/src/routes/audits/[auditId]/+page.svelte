<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { buildSidebarData, type AuditPanelData, type AuditSidebarData } from '$lib/audit-sidebar';
	import AuditOverviewCard from '$lib/components/AuditOverviewCard.svelte';
	import SegmentedPicker from '$lib/components/SegmentedPicker.svelte';
	import { onMount, tick } from 'svelte';
	import AiVisibilityTab from './AiVisibilityTab.svelte';
	import AuditHeader from './AuditHeader.svelte';
	import FindingsTab from './FindingsTab.svelte';
	import ReportTab from './ReportTab.svelte';
	import SidebarPreviewTab from './SidebarPreviewTab.svelte';
	import type { ActionData } from './$types';
	import type { AuditFindingView, AuditItemView, AuditNavItem, AuditPageViewData } from './types';

	type AuditTab = 'findings' | 'ai-visibility' | 'report' | 'sidebar-preview';
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

	function runFailureMessage() {
		const message = pageData.runRecord.error_message || 'The audit run failed.';
		const dnsTarget = message.match(/ENOTFOUND\s+([^\s]+)/)?.[1];
		if (dnsTarget) {
			return `We could not find DNS records for ${dnsTarget}. Check that the domain is spelled correctly and that the website is reachable, then restart the audit.`;
		}

		if (/ECONNREFUSED/.test(message)) {
			return 'The website refused the connection. Check that the site is online and accepts normal web requests, then restart the audit.';
		}

		if (/ETIMEDOUT|ECONNABORTED|timed? out/i.test(message)) {
			return 'The website took too long to respond. Try restarting the audit when the site is reachable.';
		}

		return message;
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

	function selectAuditSection(key: string) {
		activeAuditSection = key;
		void tick().then(scrollActiveNavItemIntoView);
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
	<section class="run-failed-panel" aria-live="polite">
		<div class="run-failed-icon" aria-hidden="true">!</div>
		<div>
			<h2>Run failed</h2>
			<p>{runFailureMessage()}</p>
		</div>
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
			<FindingsTab
				auditId={pageData.auditId}
				{auditNavItems}
				{auditFindingItems}
				{activeAuditSection}
				bind:auditSectionNavElement
				onSelectSection={selectAuditSection}
				{pageSpeed}
			/>
		{:else if activeTab === 'ai-visibility'}
			<AiVisibilityTab aiVisibility={pageData.aiVisibility} {form} />
		{:else if activeTab === 'sidebar-preview'}
			<SidebarPreviewTab {sidebarPreviewData} />
		{:else if activeTab === 'report'}
			<ReportTab
				auditId={pageData.auditId}
				canExport={canExport()}
				isPending={isPending()}
				isFailed={isFailed()}
				reportPreviewItems={pageData.reportPreviewItems || []}
				reportSelectionMin={reportSelectionMin()}
				reportSelectionIsValid={reportSelectionIsValid()}
				bind:selectedReportKeys
				bind:formElement={reportFormElement}
				googleExportIsRunning={googleExportIsRunning()}
				{googleExportUrl}
				{googleExportError}
				onExportGoogleDoc={exportGoogleDoc}
			/>
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

	.run-failed-panel {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: 0.9rem;
		align-items: flex-start;
		width: min(100%, 800px);
		margin: 0 auto 1.5rem;
		padding: 1rem;
		border: 1px solid color-mix(in srgb, var(--status-fail) 42%, var(--border));
		border-radius: 1rem;
		background: color-mix(in srgb, var(--status-fail) 12%, var(--card-bg));
		box-shadow: 0 18px 50px rgba(0, 0, 0, 0.16);
	}

	.run-failed-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--status-fail) 18%, transparent);
		color: #fecaca;
		font-weight: 800;
		line-height: 1;
	}

	.run-failed-panel h2 {
		margin: 0 0 0.25rem;
		color: var(--text-main);
		font-size: 1.05rem;
	}

	.run-failed-panel p {
		margin: 0;
		color: #fecaca;
		line-height: 1.5;
		overflow-wrap: anywhere;
	}

	@media (max-width: 560px) {
		.run-failed-panel {
			grid-template-columns: 1fr;
		}
	}
</style>
