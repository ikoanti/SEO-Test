import { captureAuditSidebarScreenshot } from './renderer';
import { SIDEBAR_TABS, buildSidebarData } from '$lib/audit-sidebar';

type AuditCaptureRequestBase = {
	reportTemplateKey?: string;
	title?: string;
	description?: string;
	capturePageUrl?: string;
	fallbackCapturePageUrls?: string[];
	captureCandidatePageUrls?: string[];
	captureCandidateEntries?: Array<Record<string, unknown> & { page: string }>;
};

export type AuditCaptureRequest = AuditCaptureRequestBase &
	(
		| {
				kind: 'headings';
				domain: string;
				entries: Array<{ page: string; issue: string }>;
				count: number;
		  }
		| {
				kind: 'image-alts';
				domain: string;
				entries: Array<{ page: string; image: string; issue?: string }>;
				count: number;
		  }
		| {
				kind: 'meta-tags';
				domain: string;
				entries: Array<{ page: string; issue: string; value?: string }>;
				count: number;
		  }
		| {
				kind: 'canonicals';
				domain: string;
				entries: Array<{ page: string; issue: string; value?: string }>;
				count: number;
		  }
		| {
				kind: 'internal-links';
				domain: string;
				entries: Array<{ page: string; issue: string; count?: number }>;
				count: number;
		  }
		| {
				kind: 'lazy-loading';
				domain: string;
				entries: Array<{ page: string; issue: string; image?: string }>;
				count: number;
		  }
		| {
				kind: 'open-graph';
				domain: string;
				entries: Array<{ page: string; issue: string; property?: string }>;
				count: number;
		  }
		| {
				kind: 'content-quality';
				domain: string;
				entries: Array<{ page: string; issue: string; wordCount?: number }>;
				count: number;
		  }
		| {
				kind: 'shopify-urls';
				domain: string;
				entries: Array<{ page: string; issue: string; pattern?: string }>;
				count: number;
		  }
		| {
				kind: 'pagespeed';
				domain: string;
				pageUrl: string;
				pageSpeed: Record<string, unknown>;
		  }
		| {
				kind: 'open-page-rank';
				domain: string;
				pageUrl: string;
				openPageRank: Record<string, unknown>;
		  }
		| {
				kind: 'robots';
				domain: string;
				robotsUrl: string;
				storefrontUrl: string;
				foundAgents: string[];
				entries?: Array<{ issue: string; status?: 'pass' | 'warn' | 'fail' | 'info' }>;
				count?: number;
		  }
	);

function isHomepageUrl(value: string) {
	try {
		const url = new URL(value);
		const pathname = url.pathname.replace(/\/+$/, '') || '/';
		return pathname === '/';
	} catch {
		return false;
	}
}

function screenshotPageUrl(entries: Array<{ page: string }>, capturePageUrl?: string) {
	if (capturePageUrl) return capturePageUrl;
	const firstNonHomepage = entries.find((entry) => entry.page && !isHomepageUrl(entry.page));
	return firstNonHomepage?.page || entries[0]?.page;
}

export async function capturePageSpeedEvidence(
	domain: string,
	pageUrl: string,
	pageSpeed: Record<string, unknown>,
	title = 'PageSpeed Insights',
	description = 'Google PageSpeed Insights scores and Core Web Vitals-style lab metrics for the audited page.',
	capturePageUrl?: string,
	fallbackPageUrls: string[] = []
) {
	return captureAuditSidebarScreenshot({
		pageUrl: capturePageUrl || pageUrl,
		fallbackPageUrls,
		sidebarData: buildSidebarData('pagespeed', {
			kind: 'pagespeed',
			title,
			description,
			domain,
			pageSpeed
		})
	});
}

export async function captureOpenPageRankEvidence(
	domain: string,
	pageUrl: string,
	openPageRank: Record<string, unknown>,
	title = 'Open PageRank',
	description = 'Domain authority and global ranking data from Open PageRank.',
	capturePageUrl?: string,
	fallbackPageUrls: string[] = []
) {
	return captureAuditSidebarScreenshot({
		pageUrl: capturePageUrl || pageUrl,
		fallbackPageUrls,
		sidebarData: buildSidebarData('open-page-rank', {
			kind: 'open-page-rank',
			title,
			description,
			domain,
			openPageRank
		})
	});
}

export async function captureHeadingEvidence(
	domain: string,
	entries: Array<{ page: string; issue: string }>,
	count = entries.length,
	title = 'Unoptimized Heading Tags',
	description = 'Important pages are missing strong heading structure, which weakens topical clarity and makes page hierarchy less obvious to search engines.',
	capturePageUrl?: string,
	fallbackPageUrls: string[] = []
) {
	if (!entries.length) return null;
	return captureAuditSidebarScreenshot({
		pageUrl: screenshotPageUrl(entries, capturePageUrl),
		fallbackPageUrls,
		sidebarData: buildSidebarData('headings', {
			kind: 'headings',
			title,
			description,
			domain,
			count,
			entries
		})
	});
}

export async function captureImageAltEvidence(
	domain: string,
	entries: Array<{ page: string; image: string; issue?: string }>,
	count = entries.length,
	title = 'Unoptimized Alt Tags',
	description = 'Important product and collection images are missing descriptive alt text, reducing image search discoverability and weakening crawler context.',
	capturePageUrl?: string,
	fallbackPageUrls: string[] = []
) {
	if (!entries.length) return null;
	return captureAuditSidebarScreenshot({
		pageUrl: screenshotPageUrl(entries, capturePageUrl),
		fallbackPageUrls,
		sidebarData: buildSidebarData('image-alts', {
			kind: 'image-alts',
			title,
			description,
			domain,
			count,
			entries
		})
	});
}

export async function captureMetaEvidence(
	domain: string,
	entries: Array<{ page: string; issue: string; value?: string }>,
	count = entries.length,
	title = 'Unoptimized Meta Tags',
	description = 'Important pages have missing, duplicated, or oversized metadata, which can weaken search result relevance and click-through clarity.',
	capturePageUrl?: string,
	fallbackPageUrls: string[] = []
) {
	if (!entries.length) return null;
	const pageUrl = screenshotPageUrl(entries, capturePageUrl);
	return captureAuditSidebarScreenshot({
		pageUrl,
		fallbackPageUrls,
		sidebarData: buildSidebarData('meta-tags', {
			kind: 'meta-tags',
			title,
			description,
			domain,
			count,
			activePageUrl: pageUrl,
			entries
		})
	});
}

export async function captureCanonicalEvidence(
	domain: string,
	entries: Array<{ page: string; issue: string; value?: string }>,
	count = entries.length,
	title = 'Unoptimized Canonicals',
	description = 'Canonical tags help consolidate ranking signals and clarify the preferred URL for indexed pages.',
	capturePageUrl?: string,
	fallbackPageUrls: string[] = []
) {
	if (!entries.length) return null;
	return captureAuditSidebarScreenshot({
		pageUrl: screenshotPageUrl(entries, capturePageUrl),
		fallbackPageUrls,
		sidebarData: buildSidebarData('canonicals', {
			kind: 'canonicals',
			title,
			description,
			domain,
			count,
			entries
		})
	});
}

export async function captureInternalLinksEvidence(
	domain: string,
	entries: Array<{ page: string; issue: string; count?: number }>,
	count = entries.length,
	title = 'Unoptimized Internal Links',
	description = 'Pages with no crawlable internal links create dead ends for users and search crawlers.',
	capturePageUrl?: string,
	fallbackPageUrls: string[] = []
) {
	if (!entries.length) return null;
	return captureAuditSidebarScreenshot({
		pageUrl: screenshotPageUrl(entries, capturePageUrl),
		fallbackPageUrls,
		sidebarData: buildSidebarData('internal-links', {
			kind: 'internal-links',
			title,
			description,
			domain,
			count,
			entries
		})
	});
}

export async function captureLazyLoadingEvidence(
	domain: string,
	entries: Array<{ page: string; issue: string; image?: string }>,
	count = entries.length,
	title = 'Unoptimized Lazy Loading',
	description = 'Images without native lazy loading can increase initial page weight and delay rendering on image-heavy pages.',
	capturePageUrl?: string,
	fallbackPageUrls: string[] = []
) {
	if (!entries.length) return null;
	return captureAuditSidebarScreenshot({
		pageUrl: screenshotPageUrl(entries, capturePageUrl),
		fallbackPageUrls,
		sidebarData: buildSidebarData('lazy-loading', {
			kind: 'lazy-loading',
			title,
			description,
			domain,
			count,
			entries
		})
	});
}

export async function captureOpenGraphEvidence(
	domain: string,
	entries: Array<{ page: string; issue: string; property?: string }>,
	count = entries.length,
	title = 'Unoptimized OpenGraph Tags',
	description = 'OpenGraph tags control how pages appear when shared and help AI and social surfaces understand page context.',
	capturePageUrl?: string,
	fallbackPageUrls: string[] = []
) {
	if (!entries.length) return null;
	return captureAuditSidebarScreenshot({
		pageUrl: screenshotPageUrl(entries, capturePageUrl),
		fallbackPageUrls,
		sidebarData: buildSidebarData('open-graph', {
			kind: 'open-graph',
			title,
			description,
			domain,
			count,
			entries
		})
	});
}

export async function captureContentQualityEvidence(
	domain: string,
	entries: Array<{ page: string; issue: string; wordCount?: number }>,
	count = entries.length,
	title = 'Thin Content',
	description = 'Pages with limited body copy can struggle to communicate topical depth and satisfy search intent.',
	capturePageUrl?: string,
	fallbackPageUrls: string[] = []
) {
	if (!entries.length) return null;
	return captureAuditSidebarScreenshot({
		pageUrl: screenshotPageUrl(entries, capturePageUrl),
		fallbackPageUrls,
		sidebarData: buildSidebarData('content-quality', {
			kind: 'content-quality',
			title,
			description,
			domain,
			count,
			entries
		})
	});
}

export async function captureShopifyUrlEvidence(
	domain: string,
	entries: Array<{ page: string; issue: string; pattern?: string }>,
	count = entries.length,
	title = 'Unoptimized Shopify URL Structure',
	description = 'Duplicate Shopify collection/product URL paths can split ranking signals and create avoidable crawl duplication.',
	capturePageUrl?: string,
	fallbackPageUrls: string[] = []
) {
	if (!entries.length) return null;
	return captureAuditSidebarScreenshot({
		pageUrl: screenshotPageUrl(entries, capturePageUrl),
		fallbackPageUrls,
		sidebarData: buildSidebarData('shopify-urls', {
			kind: 'shopify-urls',
			title,
			description,
			domain,
			count,
			entries
		})
	});
}

export async function captureRobotsEvidence({
	domain,
	robotsUrl,
	storefrontUrl,
	foundAgents,
	entries = [],
	count,
	title = 'Unoptimized Robots.txt',
	description = 'Robots.txt is missing explicit coverage for important AI and search crawler user-agents, which can limit discovery in ChatGPT, Perplexity, Claude, and modern search tools.',
	capturePageUrl,
	fallbackCapturePageUrls = []
}: {
	domain: string;
	robotsUrl: string;
	storefrontUrl: string;
	foundAgents: string[];
	entries?: Array<{ issue: string; status?: 'pass' | 'warn' | 'fail' | 'info' }>;
	count?: number;
	title?: string;
	description?: string;
	capturePageUrl?: string;
	fallbackCapturePageUrls?: string[];
}) {
	return captureAuditSidebarScreenshot({
		pageUrl: capturePageUrl || robotsUrl,
		fallbackPageUrls: [
			...fallbackCapturePageUrls,
			...(!fallbackCapturePageUrls.includes(storefrontUrl) ? [storefrontUrl] : [])
		],
		sidebarData: buildSidebarData('ai-bot-visibility', {
			kind: 'ai-bot-visibility',
			title,
			description,
			domain,
			foundAgents,
			entries,
			count: count ?? entries.length
		})
	});
}

export async function runAuditCaptureRequest(request: AuditCaptureRequest) {
	switch (request.kind) {
		case 'headings':
			return captureHeadingEvidence(
				request.domain,
				request.entries,
				request.count,
				request.title,
				request.description,
				request.capturePageUrl,
				request.fallbackCapturePageUrls
			);
		case 'image-alts':
			return captureImageAltEvidence(
				request.domain,
				request.entries,
				request.count,
				request.title,
				request.description,
				request.capturePageUrl,
				request.fallbackCapturePageUrls
			);
		case 'meta-tags':
			return captureMetaEvidence(
				request.domain,
				request.entries,
				request.count,
				request.title,
				request.description,
				request.capturePageUrl,
				request.fallbackCapturePageUrls
			);
		case 'canonicals':
			return captureCanonicalEvidence(
				request.domain,
				request.entries,
				request.count,
				request.title,
				request.description,
				request.capturePageUrl,
				request.fallbackCapturePageUrls
			);
		case 'internal-links':
			return captureInternalLinksEvidence(
				request.domain,
				request.entries,
				request.count,
				request.title,
				request.description,
				request.capturePageUrl,
				request.fallbackCapturePageUrls
			);
		case 'lazy-loading':
			return captureLazyLoadingEvidence(
				request.domain,
				request.entries,
				request.count,
				request.title,
				request.description,
				request.capturePageUrl,
				request.fallbackCapturePageUrls
			);
		case 'open-graph':
			return captureOpenGraphEvidence(
				request.domain,
				request.entries,
				request.count,
				request.title,
				request.description,
				request.capturePageUrl,
				request.fallbackCapturePageUrls
			);
		case 'content-quality':
			return captureContentQualityEvidence(
				request.domain,
				request.entries,
				request.count,
				request.title,
				request.description,
				request.capturePageUrl,
				request.fallbackCapturePageUrls
			);
		case 'shopify-urls':
			return captureShopifyUrlEvidence(
				request.domain,
				request.entries,
				request.count,
				request.title,
				request.description,
				request.capturePageUrl,
				request.fallbackCapturePageUrls
			);
		case 'pagespeed':
			return capturePageSpeedEvidence(
				request.domain,
				request.pageUrl,
				request.pageSpeed,
				request.title,
				request.description,
				request.capturePageUrl,
				request.fallbackCapturePageUrls
			);
		case 'open-page-rank':
			return captureOpenPageRankEvidence(
				request.domain,
				request.pageUrl,
				request.openPageRank,
				request.title,
				request.description,
				request.capturePageUrl,
				request.fallbackCapturePageUrls
			);
		case 'robots':
			return captureRobotsEvidence(request);
	}
}
