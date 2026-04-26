type AuditListItem = {
	status?: string;
	detail?: string;
	title?: string;
};

type AuditListSection = {
	items?: AuditListItem[];
	stats?: string;
};

type AuditResult = {
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

type NormalizedAuditItem = {
	key: string;
	label: string;
	status: 'ok' | 'warn' | 'err' | 'info';
	summary: string;
	stats_json: string;
	sort_order: number;
	findings: Array<{
		status: 'ok' | 'warn' | 'err' | 'info';
		title: string;
		detail: string;
		page_url: string;
		meta_json: string;
	}>;
};

const SECTION_LABELS: Array<[string, string]> = [
	['pageSpeed', 'Page Speed'],
	['openPageRank', 'Open PageRank'],
	['h1Tags', 'H1 Tags'],
	['metaTitles', 'Meta Titles'],
	['imageAltTags', 'Image Alt Tags'],
	['canonicalUrls', 'Canonical URLs'],
	['internalLinks', 'Internal Links'],
	['sitemap', 'Sitemap'],
	['robotsTxt', 'Robots.txt'],
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
	['trustSignals', 'Trust Signals'],
	['lazyLoadImages', 'Lazy Load Images']
];

function deriveStatusFromCounts(items: AuditListItem[]): 'ok' | 'warn' | 'err' | 'info' {
	const counts = items.reduce(
		(accumulator, item) => {
			const status = item.status || 'info';
			if (status === 'err') accumulator.err += 1;
			else if (status === 'warn') accumulator.warn += 1;
			else if (status === 'ok') accumulator.ok += 1;
			else accumulator.info += 1;
			return accumulator;
		},
		{ ok: 0, warn: 0, err: 0, info: 0 }
	);

	if (counts.err > 0) return 'err';
	if (counts.warn > 0) return 'warn';
	if (counts.ok > 0) return 'ok';
	return 'info';
}

function buildListSection(
	key: string,
	label: string,
	order: number,
	section: AuditListSection
): NormalizedAuditItem {
	const findings = (section.items || []).map((item) => {
		const title = String(item.title || item.detail || label);
		const detail = String(item.detail || '');
		const page_url =
			title.startsWith('http://') || title.startsWith('https://')
				? title
				: detail.startsWith('http://') || detail.startsWith('https://')
					? detail
					: '';

		return {
			status: (item.status || 'info') as 'ok' | 'warn' | 'err' | 'info',
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
	status: 'ok' | 'warn' | 'err' | 'info' = 'info'
): NormalizedAuditItem {
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

export function buildNormalizedAuditItems(audit: AuditResult): NormalizedAuditItem[] {
	const items: NormalizedAuditItem[] = [];
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
				averageScore >= 90 ? 'ok' : averageScore >= 50 ? 'warn' : averageScore > 0 ? 'err' : 'info';

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
