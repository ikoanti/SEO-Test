import { captureAuditSidebarScreenshot } from './renderer';
import { buildSidebarData } from '$lib/audit-sidebar';
import type { AuditSidebarData } from '$lib/audit-sidebar';

type AuditCaptureRequestBase = {
	reportTemplateKey?: string;
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
	sidebarTabs?: AuditSidebarData['tabs']
) {
	return captureAuditSidebarScreenshot({
		pageUrl: capturePageUrl || pageUrl,
		fallbackPageUrls,
		sidebarData: buildSidebarData(
			'pagespeed',
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
	entries: Array<{ page: string; issue: string }>,
	count = entries.length,
	title = '',
	description = '',
	capturePageUrl?: string,
	fallbackPageUrls: string[] = [],
	sidebarTabs?: AuditSidebarData['tabs']
) {
	if (!entries.length) return null;
	return captureAuditSidebarScreenshot({
		pageUrl: screenshotPageUrl(entries, capturePageUrl),
		fallbackPageUrls,
		sidebarData: buildSidebarData(
			'headings',
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
	sidebarTabs?: AuditSidebarData['tabs']
) {
	if (!entries.length) return null;
	return captureAuditSidebarScreenshot({
		pageUrl: screenshotPageUrl(entries, capturePageUrl),
		fallbackPageUrls,
		sidebarData: buildSidebarData(
			'image-alts',
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
	sidebarTabs?: AuditSidebarData['tabs']
) {
	if (!entries.length) return null;
	const pageUrl = screenshotPageUrl(entries, capturePageUrl);
	return captureAuditSidebarScreenshot({
		pageUrl,
		fallbackPageUrls,
		sidebarData: buildSidebarData(
			'meta-tags',
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
	sidebarTabs?: AuditSidebarData['tabs']
) {
	if (!entries.length) return null;
	return captureAuditSidebarScreenshot({
		pageUrl: screenshotPageUrl(entries, capturePageUrl),
		fallbackPageUrls,
		sidebarData: buildSidebarData(
			'canonicals',
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
	sidebarTabs?: AuditSidebarData['tabs']
) {
	if (!entries.length) return null;
	return captureAuditSidebarScreenshot({
		pageUrl: screenshotPageUrl(entries, capturePageUrl),
		fallbackPageUrls,
		sidebarData: buildSidebarData(
			'internal-links',
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
	sidebarTabs?: AuditSidebarData['tabs']
) {
	if (!entries.length) return null;
	return captureAuditSidebarScreenshot({
		pageUrl: screenshotPageUrl(entries, capturePageUrl),
		fallbackPageUrls,
		sidebarData: buildSidebarData(
			'lazy-loading',
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
	sidebarTabs?: AuditSidebarData['tabs']
) {
	if (!entries.length) return null;
	return captureAuditSidebarScreenshot({
		pageUrl: screenshotPageUrl(entries, capturePageUrl),
		fallbackPageUrls,
		sidebarData: buildSidebarData(
			'open-graph',
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
	sidebarTabs?: AuditSidebarData['tabs']
) {
	if (!entries.length) return null;
	return captureAuditSidebarScreenshot({
		pageUrl: screenshotPageUrl(entries, capturePageUrl),
		fallbackPageUrls,
		sidebarData: buildSidebarData(
			'content-quality',
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
	sidebarTabs?: AuditSidebarData['tabs']
) {
	if (!entries.length) return null;
	return captureAuditSidebarScreenshot({
		pageUrl: screenshotPageUrl(entries, capturePageUrl),
		fallbackPageUrls,
		sidebarData: buildSidebarData(
			'shopify-urls',
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
	sidebarTabs?: AuditSidebarData['tabs']
) {
	if (!entries.length) return null;
	return captureAuditSidebarScreenshot({
		pageUrl: screenshotPageUrl(entries, capturePageUrl),
		fallbackPageUrls,
		sidebarData: buildSidebarData(
			kind,
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
	sidebarTabs
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
}) {
	return captureAuditSidebarScreenshot({
		pageUrl: capturePageUrl || robotsUrl,
		fallbackPageUrls: [
			...fallbackCapturePageUrls,
			...(!fallbackCapturePageUrls.includes(storefrontUrl) ? [storefrontUrl] : [])
		],
		sidebarData: buildSidebarData(
			'ai-bot-visibility',
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
				request.sidebarTabs
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
				request.sidebarTabs
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
				request.sidebarTabs
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
				request.sidebarTabs
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
				request.sidebarTabs
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
				request.sidebarTabs
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
				request.sidebarTabs
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
				request.sidebarTabs
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
				request.sidebarTabs
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
				request.sidebarTabs
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
				request.sidebarTabs
			);
		case 'robots':
			return captureRobotsEvidence(request);
	}
}
