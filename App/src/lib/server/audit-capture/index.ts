import { captureAuditSidebarScreenshot } from './renderer';
import { buildSidebarData } from '$lib/audit-sidebar';
import type { AuditSidebarData } from '$lib/audit-sidebar';

type AuditCaptureRequestBase = {
	reportTemplateKey?: string;
	activeTab?: string;
	title?: string;
	description?: string;
	capturePageUrl?: string;
	fallbackCapturePageUrls?: string[];
	sidebarTabs?: AuditSidebarData['tabs'];
	captureCandidatePageUrls?: string[];
	captureCandidateEntries?: Array<Record<string, unknown> & { page: string }>;
};

export type AuditCaptureRequest = AuditCaptureRequestBase &
	(
		| {
				kind: 'headings';
				domain: string;
				entries: Array<{ page: string; issue: string; headings?: string[] }>;
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
				kind:
					| 'missing-product-schema'
					| 'missing-faq-schema'
					| 'missing-organization-schema'
					| 'unlinked-blog';
				domain: string;
				entries: Array<{ page: string; issue: string }>;
				count: number;
		  }
		| {
				kind: 'pagespeed';
				domain: string;
				pageUrl: string;
				pageSpeed: Record<string, unknown>;
		  }
		| {
				kind: 'robots';
				domain: string;
				robotsUrl: string;
				storefrontUrl: string;
				foundAgents: string[];
				entries?: Array<{ issue: string; status?: 'pass' | 'warn' | 'info' }>;
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
	title = '',
	description = '',
	capturePageUrl?: string,
	fallbackPageUrls: string[] = [],
	sidebarTabs?: AuditSidebarData['tabs'],
	activeTab = 'pagespeed'
) {
	return captureAuditSidebarScreenshot({
		pageUrl: capturePageUrl || pageUrl,
		fallbackPageUrls,
		sidebarData: buildSidebarData(
			activeTab,
			{
				kind: 'pagespeed',
				title,
				description,
				domain,
				pageSpeed
			},
			sidebarTabs
		)
	});
}

export async function captureHeadingEvidence(
	domain: string,
	entries: Array<{ page: string; issue: string; headings?: string[] }>,
	count = entries.length,
	title = '',
	description = '',
	capturePageUrl?: string,
	fallbackPageUrls: string[] = [],
	sidebarTabs?: AuditSidebarData['tabs'],
	activeTab = 'headings'
) {
	if (!entries.length) return null;
	return captureAuditSidebarScreenshot({
		pageUrl: screenshotPageUrl(entries, capturePageUrl),
		fallbackPageUrls,
		sidebarData: buildSidebarData(
			activeTab,
			{
				kind: 'headings',
				title,
				description,
				domain,
				count,
				entries
			},
			sidebarTabs
		)
	});
}

export async function captureImageAltEvidence(
	domain: string,
	entries: Array<{ page: string; image: string; issue?: string }>,
	count = entries.length,
	title = '',
	description = '',
	capturePageUrl?: string,
	fallbackPageUrls: string[] = [],
	sidebarTabs?: AuditSidebarData['tabs'],
	activeTab = 'image-alts'
) {
	if (!entries.length) return null;
	return captureAuditSidebarScreenshot({
		pageUrl: screenshotPageUrl(entries, capturePageUrl),
		fallbackPageUrls,
		sidebarData: buildSidebarData(
			activeTab,
			{
				kind: 'image-alts',
				title,
				description,
				domain,
				count,
				entries
			},
			sidebarTabs
		)
	});
}

export async function captureMetaEvidence(
	domain: string,
	entries: Array<{ page: string; issue: string; value?: string }>,
	count = entries.length,
	title = '',
	description = '',
	capturePageUrl?: string,
	fallbackPageUrls: string[] = [],
	sidebarTabs?: AuditSidebarData['tabs'],
	activeTab = 'meta-tags'
) {
	if (!entries.length) return null;
	const pageUrl = screenshotPageUrl(entries, capturePageUrl);
	return captureAuditSidebarScreenshot({
		pageUrl,
		fallbackPageUrls,
		sidebarData: buildSidebarData(
			activeTab,
			{
				kind: 'meta-tags',
				title,
				description,
				domain,
				count,
				activePageUrl: pageUrl,
				entries
			},
			sidebarTabs
		)
	});
}

export async function captureCanonicalEvidence(
	domain: string,
	entries: Array<{ page: string; issue: string; value?: string }>,
	count = entries.length,
	title = '',
	description = '',
	capturePageUrl?: string,
	fallbackPageUrls: string[] = [],
	sidebarTabs?: AuditSidebarData['tabs'],
	activeTab = 'canonicals'
) {
	if (!entries.length) return null;
	return captureAuditSidebarScreenshot({
		pageUrl: screenshotPageUrl(entries, capturePageUrl),
		fallbackPageUrls,
		sidebarData: buildSidebarData(
			activeTab,
			{
				kind: 'canonicals',
				title,
				description,
				domain,
				count,
				entries
			},
			sidebarTabs
		)
	});
}

export async function captureInternalLinksEvidence(
	domain: string,
	entries: Array<{ page: string; issue: string; count?: number }>,
	count = entries.length,
	title = '',
	description = '',
	capturePageUrl?: string,
	fallbackPageUrls: string[] = [],
	sidebarTabs?: AuditSidebarData['tabs'],
	activeTab = 'internal-links'
) {
	if (!entries.length) return null;
	return captureAuditSidebarScreenshot({
		pageUrl: screenshotPageUrl(entries, capturePageUrl),
		fallbackPageUrls,
		sidebarData: buildSidebarData(
			activeTab,
			{
				kind: 'internal-links',
				title,
				description,
				domain,
				count,
				entries
			},
			sidebarTabs
		)
	});
}

export async function captureLazyLoadingEvidence(
	domain: string,
	entries: Array<{ page: string; issue: string; image?: string }>,
	count = entries.length,
	title = '',
	description = '',
	capturePageUrl?: string,
	fallbackPageUrls: string[] = [],
	sidebarTabs?: AuditSidebarData['tabs'],
	activeTab = 'lazy-loading'
) {
	if (!entries.length) return null;
	return captureAuditSidebarScreenshot({
		pageUrl: screenshotPageUrl(entries, capturePageUrl),
		fallbackPageUrls,
		sidebarData: buildSidebarData(
			activeTab,
			{
				kind: 'lazy-loading',
				title,
				description,
				domain,
				count,
				entries
			},
			sidebarTabs
		)
	});
}

export async function captureOpenGraphEvidence(
	domain: string,
	entries: Array<{ page: string; issue: string; property?: string }>,
	count = entries.length,
	title = '',
	description = '',
	capturePageUrl?: string,
	fallbackPageUrls: string[] = [],
	sidebarTabs?: AuditSidebarData['tabs'],
	activeTab = 'open-graph'
) {
	if (!entries.length) return null;
	return captureAuditSidebarScreenshot({
		pageUrl: screenshotPageUrl(entries, capturePageUrl),
		fallbackPageUrls,
		sidebarData: buildSidebarData(
			activeTab,
			{
				kind: 'open-graph',
				title,
				description,
				domain,
				count,
				entries
			},
			sidebarTabs
		)
	});
}

export async function captureContentQualityEvidence(
	domain: string,
	entries: Array<{ page: string; issue: string; wordCount?: number }>,
	count = entries.length,
	title = '',
	description = '',
	capturePageUrl?: string,
	fallbackPageUrls: string[] = [],
	sidebarTabs?: AuditSidebarData['tabs'],
	activeTab = 'content-quality'
) {
	if (!entries.length) return null;
	return captureAuditSidebarScreenshot({
		pageUrl: screenshotPageUrl(entries, capturePageUrl),
		fallbackPageUrls,
		sidebarData: buildSidebarData(
			activeTab,
			{
				kind: 'content-quality',
				title,
				description,
				domain,
				count,
				entries
			},
			sidebarTabs
		)
	});
}

export async function captureShopifyUrlEvidence(
	domain: string,
	entries: Array<{ page: string; issue: string; pattern?: string }>,
	count = entries.length,
	title = '',
	description = '',
	capturePageUrl?: string,
	fallbackPageUrls: string[] = [],
	sidebarTabs?: AuditSidebarData['tabs'],
	activeTab = 'shopify-urls'
) {
	if (!entries.length) return null;
	return captureAuditSidebarScreenshot({
		pageUrl: screenshotPageUrl(entries, capturePageUrl),
		fallbackPageUrls,
		sidebarData: buildSidebarData(
			activeTab,
			{
				kind: 'shopify-urls',
				title,
				description,
				domain,
				count,
				entries
			},
			sidebarTabs
		)
	});
}

export async function captureSchemaEvidence(
	kind:
		| 'missing-product-schema'
		| 'missing-faq-schema'
		| 'missing-organization-schema'
		| 'unlinked-blog',
	domain: string,
	entries: Array<{ page: string; issue: string }>,
	count = entries.length,
	title = '',
	description = '',
	capturePageUrl?: string,
	fallbackPageUrls: string[] = [],
	sidebarTabs?: AuditSidebarData['tabs'],
	activeTab: string = kind
) {
	if (!entries.length) return null;
	return captureAuditSidebarScreenshot({
		pageUrl: screenshotPageUrl(entries, capturePageUrl),
		fallbackPageUrls,
		sidebarData: buildSidebarData(
			activeTab,
			{
				kind,
				title,
				description,
				domain,
				count,
				entries
			},
			sidebarTabs
		)
	});
}

export async function captureRobotsEvidence({
	domain,
	robotsUrl,
	storefrontUrl,
	foundAgents,
	entries = [],
	count,
	title = '',
	description = '',
	capturePageUrl,
	fallbackCapturePageUrls = [],
	sidebarTabs,
	activeTab = 'ai-bot-visibility'
}: {
	domain: string;
	robotsUrl: string;
	storefrontUrl: string;
	foundAgents: string[];
	entries?: Array<{ issue: string; status?: 'pass' | 'warn' | 'info' }>;
	count?: number;
	title?: string;
	description?: string;
	capturePageUrl?: string;
	fallbackCapturePageUrls?: string[];
	sidebarTabs?: AuditSidebarData['tabs'];
	activeTab?: string;
}) {
	return captureAuditSidebarScreenshot({
		pageUrl: capturePageUrl || robotsUrl,
		fallbackPageUrls: [
			...fallbackCapturePageUrls,
			...(!fallbackCapturePageUrls.includes(storefrontUrl) ? [storefrontUrl] : [])
		],
		sidebarData: buildSidebarData(
			activeTab,
			{
				kind: 'ai-bot-visibility',
				title,
				description,
				domain,
				foundAgents,
				entries,
				count: count ?? entries.length
			},
			sidebarTabs
		)
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
				request.fallbackCapturePageUrls,
				request.sidebarTabs,
				request.activeTab
			);
		case 'image-alts':
			return captureImageAltEvidence(
				request.domain,
				request.entries,
				request.count,
				request.title,
				request.description,
				request.capturePageUrl,
				request.fallbackCapturePageUrls,
				request.sidebarTabs,
				request.activeTab
			);
		case 'meta-tags':
			return captureMetaEvidence(
				request.domain,
				request.entries,
				request.count,
				request.title,
				request.description,
				request.capturePageUrl,
				request.fallbackCapturePageUrls,
				request.sidebarTabs,
				request.activeTab
			);
		case 'canonicals':
			return captureCanonicalEvidence(
				request.domain,
				request.entries,
				request.count,
				request.title,
				request.description,
				request.capturePageUrl,
				request.fallbackCapturePageUrls,
				request.sidebarTabs,
				request.activeTab
			);
		case 'internal-links':
			return captureInternalLinksEvidence(
				request.domain,
				request.entries,
				request.count,
				request.title,
				request.description,
				request.capturePageUrl,
				request.fallbackCapturePageUrls,
				request.sidebarTabs,
				request.activeTab
			);
		case 'lazy-loading':
			return captureLazyLoadingEvidence(
				request.domain,
				request.entries,
				request.count,
				request.title,
				request.description,
				request.capturePageUrl,
				request.fallbackCapturePageUrls,
				request.sidebarTabs,
				request.activeTab
			);
		case 'open-graph':
			return captureOpenGraphEvidence(
				request.domain,
				request.entries,
				request.count,
				request.title,
				request.description,
				request.capturePageUrl,
				request.fallbackCapturePageUrls,
				request.sidebarTabs,
				request.activeTab
			);
		case 'content-quality':
			return captureContentQualityEvidence(
				request.domain,
				request.entries,
				request.count,
				request.title,
				request.description,
				request.capturePageUrl,
				request.fallbackCapturePageUrls,
				request.sidebarTabs,
				request.activeTab
			);
		case 'shopify-urls':
			return captureShopifyUrlEvidence(
				request.domain,
				request.entries,
				request.count,
				request.title,
				request.description,
				request.capturePageUrl,
				request.fallbackCapturePageUrls,
				request.sidebarTabs,
				request.activeTab
			);
		case 'missing-product-schema':
		case 'missing-faq-schema':
		case 'missing-organization-schema':
		case 'unlinked-blog':
			return captureSchemaEvidence(
				request.kind,
				request.domain,
				request.entries,
				request.count,
				request.title,
				request.description,
				request.capturePageUrl,
				request.fallbackCapturePageUrls,
				request.sidebarTabs,
				request.activeTab
			);
		case 'pagespeed':
			return capturePageSpeedEvidence(
				request.domain,
				request.pageUrl,
				request.pageSpeed,
				request.title,
				request.description,
				request.capturePageUrl,
				request.fallbackCapturePageUrls,
				request.sidebarTabs,
				request.activeTab
			);
		case 'robots':
			return captureRobotsEvidence(request);
	}
}
