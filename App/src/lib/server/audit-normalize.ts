import type { AuditFindingStatus } from '$lib/audit-status';
import type { AuditCaptureRequest } from '$lib/server/audit-capture';

type AuditListItem = {
	status?: AuditFindingStatus;
	detail?: string;
	title?: string;
	meta?: Record<string, unknown>;
	screenshot?: unknown;
};

type AuditListSection = {
	items?: AuditListItem[];
	stats?: string;
};

export type AuditResult = {
	domain?: string;
	auditedAt?: string;
	summary?: {
		passed?: number;
		warnings?: number;
		failed?: number;
	};
	pageSpeed?: {
		mobile?: { score?: number | string; metrics?: Record<string, unknown> };
		desktop?: { score?: number | string; metrics?: Record<string, unknown> };
	};
	openPageRank?: {
		pageRank?: string;
		globalRank?: string;
	};
	[key: string]: unknown;
};

export type NormalizedAuditFindingType = {
	key: string;
	label: string;
	status: AuditFindingStatus;
	summary: string;
	stats_json: string;
	sort_order: number;
	findings: Array<{
		status: AuditFindingStatus;
		title: string;
		detail: string;
		page_url: string;
		meta_json: string;
	}>;
};

export const SECTION_LABELS: Array<[string, string]> = [
	['pageSpeed', 'Unoptimized page speed'],
	['openPageRank', 'Open PageRank'],
	['missing-h1-tags', 'Missing H1 tags'],
	['multiple-h1-tags', 'Multiple H1 tags'],
	['missing-product-schema', 'Missing product schema'],
	['missing-faq-schema', 'Missing FAQ Schema'],
	['missing-organization-schema', 'Missing Organization Schema'],
	['unlinked-blog', 'Unlinked Blog'],
	['metaTitles', 'Meta Titles'],
	['imageAltTags', 'Image Alt Tags'],
	['canonicalUrls', 'Canonical URLs'],
	['internalLinks', 'Internal Links'],
	['sitemap', 'Sitemap'],
	['robotsTxt', 'AI Chatbots/LLMs Not Whitelisted'],
	['llmsTxt', 'LLMs.txt'],
	['security', 'Security'],
	['mixedContent', 'Mixed Content'],
	['contentQuality', 'Content Quality'],
	['webIcons', 'Web Icons'],
	['ssl', 'SSL'],
	['viewportMetaTag', 'Viewport Meta Tag'],
	['flash', 'Flash'],
	['charset', 'Charset'],
	['loremIpsum', 'Lorem Ipsum'],
	['openGraph', 'Open Graph'],
	['shopifyUrls', 'Shopify URLs'],
	['internationalDomains', 'International Domains'],
	['trailingSlash', 'Trailing Slash'],
	['wwwResolve', 'WWW Resolve'],
	['trustSignals', 'Trust Signals'],
	['tapTargets', 'Tap Targets'],
	['lazyLoadImages', 'Lazy Load Images'],
	['aiVisibility', 'AI Visibility']
];

export function getNormalizedSectionDefinitions() {
	return SECTION_LABELS.map(([key, label], index) => ({
		key,
		label,
		sort_order: index + 1
	}));
}

function truncateText(value: string, maxLength: number) {
	if (value.length <= maxLength) {
		return value;
	}

	return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}

function extractFirstHttpUrl(value: string) {
	const match = value.match(/https?:\/\/[^\s)]+/);
	if (!match) return '';

	try {
		return new URL(match[0]).href;
	} catch {
		return '';
	}
}

function deriveStatusFromCounts(items: AuditListItem[]): AuditFindingStatus {
	const counts = items.reduce(
		(accumulator, item) => {
			const status = item.status || 'info';
			if (status === 'fail') accumulator.fail += 1;
			else if (status === 'warn') accumulator.warn += 1;
			else if (status === 'pass') accumulator.pass += 1;
			else accumulator.info += 1;
			return accumulator;
		},
		{ pass: 0, warn: 0, fail: 0, info: 0 }
	);

	if (counts.fail > 0) return 'fail';
	if (counts.warn > 0) return 'warn';
	if (counts.pass > 0) return 'pass';
	return 'info';
}

function buildListSection(
	key: string,
	label: string,
	order: number,
	section: AuditListSection
): NormalizedAuditFindingType {
	const findings = (section.items || []).map((item) => {
		const meta = { ...(item as Record<string, unknown>) };
		const nestedMeta =
			meta.meta && typeof meta.meta === 'object' && !Array.isArray(meta.meta)
				? { ...(meta.meta as Record<string, unknown>) }
				: null;
		const screenshot = meta.screenshot || nestedMeta?.screenshot;
		const screenshotRequest = meta.screenshotRequest || nestedMeta?.screenshotRequest;
		if (screenshot) {
			meta.screenshot = screenshot;
			if (nestedMeta) {
				delete nestedMeta.screenshot;
				meta.meta = nestedMeta;
			}
		}
		if (screenshotRequest) {
			meta.screenshotRequest = screenshotRequest;
			if (nestedMeta) {
				delete nestedMeta.screenshotRequest;
				meta.meta = nestedMeta;
			}
		}
		const rawTitle = String(item.title || item.detail || label);
		const title = truncateText(rawTitle, 255);
		const detail = String(item.detail || '');
		const explicitPageUrl = typeof meta.page_url === 'string' ? meta.page_url : '';
		const page_url =
			extractFirstHttpUrl(explicitPageUrl) ||
			extractFirstHttpUrl(title) ||
			extractFirstHttpUrl(detail);

		return {
			status: (item.status || 'info') as AuditFindingStatus,
			title,
			detail,
			page_url,
			meta_json: JSON.stringify(meta)
		};
	});

	return {
		key,
		label,
		status: deriveStatusFromCounts(section.items || []),
		summary: section.stats || `${findings.length} finding${findings.length === 1 ? '' : 's'}`,
		stats_json: JSON.stringify({ stats: section.stats || '', count: findings.length }),
		sort_order: order,
		findings
	};
}

function h1IssueSection(
	key: string,
	label: string,
	order: number,
	section: AuditListSection,
	matcher: (item: AuditListItem) => boolean
): NormalizedAuditFindingType | null {
	const sourceItems = section.items || [];
	const issueItems = sourceItems.filter(
		(item) => (item.status === 'warn' || item.status === 'fail') && matcher(item)
	);

	if (!sourceItems.length && !issueItems.length) return null;
	if (!issueItems.length) {
		return {
			key,
			label,
			status: 'pass',
			summary: `No ${label.toLowerCase()} found.`,
			stats_json: JSON.stringify({ stats: '', count: 0 }),
			sort_order: order,
			findings: []
		};
	}

	return buildListSection(key, label, order, {
		items: issueItems,
		stats: `${issueItems.length} ${label.toLowerCase()} issue${
			issueItems.length === 1 ? '' : 's'
		} found`
	});
}

function buildMetricSection(
	key: string,
	label: string,
	order: number,
	summary: string,
	stats: Record<string, unknown>,
	status: AuditFindingStatus = 'info'
): NormalizedAuditFindingType {
	return {
		key,
		label,
		status,
		summary,
		stats_json: JSON.stringify(stats),
		sort_order: order,
		findings: []
	};
}

export function buildNormalizedAuditItems(audit: AuditResult): NormalizedAuditFindingType[] {
	const items: NormalizedAuditFindingType[] = [];
	let order = 1;

	for (const [key, label] of SECTION_LABELS) {
		const value = audit[key];

		if (key === 'missing-h1-tags' || key === 'multiple-h1-tags') {
			const h1Section = audit.h1Tags;
			if (h1Section && typeof h1Section === 'object' && Array.isArray((h1Section as AuditListSection).items)) {
				const item = h1IssueSection(
					key,
					label,
					order,
					h1Section as AuditListSection,
					key === 'missing-h1-tags'
						? (entry) => String(entry.detail || '') === 'Missing H1 tag'
						: (entry) => String(entry.detail || '').toLowerCase().includes('multiple h1')
				);
				if (item) items.push(item);
				order += 1;
			}
			continue;
		}

		if (key === 'pageSpeed' && value && typeof value === 'object') {
			const metrics = value as NonNullable<AuditResult['pageSpeed']>;
			const mobileScore = Number(metrics.mobile?.score ?? 0);
			const desktopScore = Number(metrics.desktop?.score ?? 0);
			const averageScore =
				Number.isFinite(mobileScore) && Number.isFinite(desktopScore)
					? Math.round((mobileScore + desktopScore) / 2)
					: 0;
			const status =
				averageScore >= 90
					? 'pass'
					: averageScore >= 50
						? 'warn'
						: averageScore > 0
							? 'fail'
							: 'info';

			items.push(
				buildMetricSection(
					key,
					label,
					order,
					`Mobile ${metrics.mobile?.score ?? 'N/A'} / Desktop ${metrics.desktop?.score ?? 'N/A'}`,
					metrics as Record<string, unknown>,
					status
				)
			);
			order += 1;
			continue;
		}

		if (key === 'openPageRank' && value && typeof value === 'object') {
			const stats = value as NonNullable<AuditResult['openPageRank']>;
			items.push(
				buildMetricSection(
					key,
					label,
					order,
					`PageRank ${stats.pageRank ?? 'N/A'} / Global ${stats.globalRank ?? 'N/A'}`,
					stats as Record<string, unknown>,
					'info'
				)
			);
			order += 1;
			continue;
		}

		if (value && typeof value === 'object' && Array.isArray((value as AuditListSection).items)) {
			items.push(buildListSection(key, label, order, value as AuditListSection));
			order += 1;
		}
	}

	return items;
}

function snapshotRecord(value: Record<string, unknown>) {
	const snapshot = { ...value };
	delete snapshot.screenshot;
	delete snapshot.screenshotRequest;
	return snapshot;
}

function setScreenshotRequest(target: Record<string, unknown>, request: AuditCaptureRequest) {
	target.screenshotRequest = request;
}

export function attachMetricScreenshots(
	audit: AuditResult,
	pageUrl: string,
	keys: Iterable<string> = ['pageSpeed', 'openPageRank']
) {
	const requestedKeys = new Set(keys);
	const domain =
		audit.domain ||
		(() => {
			try {
				return new URL(pageUrl).hostname;
			} catch {
				return 'this domain';
			}
		})();

	if (requestedKeys.has('pageSpeed') && audit.pageSpeed && typeof audit.pageSpeed === 'object') {
		const pageSpeed = audit.pageSpeed as Record<string, unknown>;
		setScreenshotRequest(pageSpeed, {
			kind: 'pagespeed',
			reportTemplateKey: 'unoptimized-page-speed',
			title: 'Unoptimized page speed',
			domain,
			pageUrl,
			pageSpeed: snapshotRecord(pageSpeed)
		});
	}

	if (
		requestedKeys.has('openPageRank') &&
		audit.openPageRank &&
		typeof audit.openPageRank === 'object'
	) {
		const openPageRank = audit.openPageRank as Record<string, unknown>;
		setScreenshotRequest(openPageRank, {
			kind: 'open-page-rank',
			reportTemplateKey: 'open-page-rank',
			title: 'Open PageRank',
			domain,
			pageUrl,
			openPageRank: snapshotRecord(openPageRank)
		});
	}
}
