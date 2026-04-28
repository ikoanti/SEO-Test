import type { AuditFindingStatus } from '$lib/audit-status';
import type { AuditCaptureRequest } from '$lib/server/audit-capture';
import { listProblemCatalogSectionDefinitions, listProblemCatalogTemplates } from '$lib/server/problem-catalog';

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
	source_key?: string;
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
	['pageSpeed', 'Page Speed'],
	['openPageRank', 'Open PageRank'],
	['h1Tags', 'H1 Tags'],
	['metaTitles', 'Meta Titles'],
	['imageAltTags', 'Image Alt Tags'],
	['canonicalUrls', 'Canonical URLs'],
	['internalLinks', 'Internal Links'],
	['sitemap', 'Sitemap'],
	['robotsTxt', 'Robots.txt'],
	['llmsTxt', 'LLMs.txt'],
	['structuredData', 'Structured Data'],
	['security', 'Security'],
	['mixedContent', 'Mixed Content'],
	['contentQuality', 'Content Quality'],
	['webIcons', 'Web Icons'],
	['ssl', 'SSL'],
	['mobileUsability', 'Mobile Usability'],
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
	return listProblemCatalogSectionDefinitions();
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
		const meta = item as Record<string, unknown>;
		const nestedMeta =
			meta.meta && typeof meta.meta === 'object' && !Array.isArray(meta.meta)
				? (meta.meta as Record<string, unknown>)
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
			meta_json: JSON.stringify(item)
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

function buildMetricSection(
	key: string,
	label: string,
	order: number,
	summary: string,
	stats: Record<string, unknown>,
	status: AuditFindingStatus = 'info',
	sourceKey?: string
): NormalizedAuditFindingType {
	return {
		key,
		label,
		source_key: sourceKey,
		status,
		summary,
		stats_json: JSON.stringify(stats),
		sort_order: order,
		findings: []
	};
}

function issueMatcher(pattern: string | undefined) {
	if (!pattern?.trim()) return undefined;

	try {
		const regex = new RegExp(pattern, 'i');
		return (finding: NormalizedAuditFindingType['findings'][number]) =>
			regex.test(`${finding.title || ''} ${finding.detail || ''}`);
	} catch {
		return undefined;
	}
}

function statusFromFindings(
	findings: NormalizedAuditFindingType['findings'],
	fallback: AuditFindingStatus = 'info'
): AuditFindingStatus {
	if (findings.some((finding) => finding.status === 'fail')) return 'fail';
	if (findings.some((finding) => finding.status === 'warn')) return 'warn';
	if (findings.some((finding) => finding.status === 'pass')) return 'pass';
	return fallback;
}

export function buildNormalizedAuditItems(audit: AuditResult): NormalizedAuditFindingType[] {
	const items: NormalizedAuditFindingType[] = [];
	const technicalItems = new Map<string, NormalizedAuditFindingType>();

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
							? 'fail'
							: 'info';

			items.push(
				buildMetricSection(
					key,
					label,
					technicalItems.size + 1,
					`Mobile ${metrics.mobile?.score ?? 'N/A'} / Desktop ${metrics.desktop?.score ?? 'N/A'}`,
					metrics as Record<string, unknown>,
					status,
					key
				)
			);
			technicalItems.set(key, items[items.length - 1]);
			continue;
		}

		if (key === 'openPageRank' && value && typeof value === 'object') {
			const stats = value as NonNullable<AuditResult['openPageRank']>;
			items.push(
				buildMetricSection(
					key,
					label,
					technicalItems.size + 1,
					`PageRank ${stats.pageRank ?? 'N/A'} / Global ${stats.globalRank ?? 'N/A'}`,
					stats as Record<string, unknown>,
					'info',
					key
				)
			);
			technicalItems.set(key, items[items.length - 1]);
			continue;
		}

		if (value && typeof value === 'object' && Array.isArray((value as AuditListSection).items)) {
			const item = buildListSection(key, label, technicalItems.size + 1, value as AuditListSection);
			item.source_key = key;
			items.push(item);
			technicalItems.set(key, item);
		}
	}

	const problemItems: NormalizedAuditFindingType[] = [];
	for (const template of listProblemCatalogTemplates()) {
		const sourceKey = String(template.expand?.audit_finding_type?.key || '');
		if (!sourceKey) continue;

		const sourceItem = technicalItems.get(sourceKey);
		if (!sourceItem) continue;

		if (sourceItem.findings.length === 0) {
			if (sourceItem.status !== 'warn' && sourceItem.status !== 'fail') continue;
			problemItems.push({
				...sourceItem,
				key: template.key,
				label: template.title,
				source_key: sourceKey,
				sort_order: template.sort_order
			});
			continue;
		}

		const matcher = issueMatcher(template.match_pattern);
		const findings = sourceItem.findings.filter((finding) => {
			if (finding.status !== 'warn' && finding.status !== 'fail') return false;
			return matcher ? matcher(finding) : true;
		});
		if (!findings.length) continue;

		problemItems.push({
			key: template.key,
			label: template.title,
			source_key: sourceKey,
			status: statusFromFindings(findings, sourceItem.status),
			summary: `${findings.length} finding${findings.length === 1 ? '' : 's'}`,
			stats_json: JSON.stringify({ stats: sourceItem.summary, count: findings.length }),
			sort_order: template.sort_order,
			findings
		});
	}

	return problemItems;
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
