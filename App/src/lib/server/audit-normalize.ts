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
		info?: number;
	};
	pageSpeed?: {
		mobile?: { score?: number | string; metrics?: Record<string, unknown> };
		desktop?: { score?: number | string; metrics?: Record<string, unknown> };
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
	['missing-h1-tags', 'Missing H1 tags'],
	['multiple-h1-tags', 'Multiple H1 tags'],
	['missing-product-schema', 'Missing product schema'],
	['missing-faq-schema', 'Missing FAQ Schema'],
	['missing-organization-schema', 'Missing Organization Schema'],
	['unlinked-blog', 'Unlinked Blog'],
	['meta-titles-too-long-unoptimized', 'Meta Titles Are Too Long & Unoptimized'],
	['duplicated-page-titles', 'Duplicated Page Titles'],
	['duplicated-meta-descriptions', 'Duplicated Meta Descriptions'],
	['overly-long-meta-descriptions', 'Overly Long Meta Descriptions'],
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
			const status = normalizeFindingStatus(item.status);
			if (status === 'warn') accumulator.warn += 1;
			else if (status === 'pass') accumulator.pass += 1;
			else accumulator.info += 1;
			return accumulator;
		},
		{ pass: 0, warn: 0, info: 0 }
	);

	if (counts.warn > 0) return 'warn';
	if (counts.pass > 0) return 'pass';
	return 'info';
}

function normalizeFindingStatus(status: unknown): AuditFindingStatus {
	if (status === 'pass' || status === 'warn' || status === 'info') return status;
	if (status === 'fail') return 'warn';
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
			status: normalizeFindingStatus(item.status),
			title,
			detail,
			page_url,
			meta_json: JSON.stringify(meta)
		};
	});

	return {
		key,
		label,
		status: findings.length ? deriveStatusFromCounts(section.items || []) : 'pass',
		summary: section.stats || `${findings.length} finding${findings.length === 1 ? '' : 's'}`,
		stats_json: JSON.stringify({ stats: section.stats || '', count: findings.length }),
		sort_order: order,
		findings
	};
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
							? 'warn'
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
	keys: Iterable<string> = ['pageSpeed']
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
}
