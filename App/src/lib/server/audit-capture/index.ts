import { captureAuditSidebarScreenshot, captureLocalRichResultsScreenshot } from './renderer';
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
				kind: 'rich-results';
				domain: string;
				pageUrl: string;
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

export async function captureRichResultsEvidence({
	pageUrl,
	reportTemplateKey,
	title
}: {
	pageUrl: string;
	reportTemplateKey?: string;
	title?: string;
}) {
	return captureLocalRichResultsScreenshot({ pageUrl, reportTemplateKey, title });
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
		case 'rich-results':
			return captureRichResultsEvidence(request);
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
