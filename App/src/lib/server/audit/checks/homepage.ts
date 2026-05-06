import type { CheerioAPI } from 'cheerio';
import type { AuditCaptureRequest } from '$lib/server/audit-capture';
import type { AuditLogger, AuditSummary } from '../shared';
import { addItem, createListResult, hasValidOrganizationJsonLd } from '../shared';

function attachScreenshotRequest(
	item: Record<string, unknown> | undefined,
	request: AuditCaptureRequest
) {
	if (!item) return;
	item.meta = {
		...((item.meta as Record<string, unknown> | undefined) || {}),
		screenshotRequest: request
	};
}

function issueCount(items: Array<{ status?: string }>) {
	return items.filter((item) => item.status === 'warn').length;
}

function hasValidJsonLd($: CheerioAPI, validator: (value: unknown) => boolean) {
	return $('script[type="application/ld+json"]')
		.toArray()
		.some((element) => {
			const raw = $(element).contents().text().trim();
			if (!raw) return false;

			try {
				return validator(JSON.parse(raw));
			} catch {
				return false;
			}
		});
}

function isBlogLikeUrl(value: string, origin: string) {
	try {
		const url = new URL(value, origin);
		if (url.origin !== origin) return false;
		return /^\/(blog|blogs|articles|news)(\/|$)/i.test(url.pathname);
	} catch {
		return false;
	}
}

function normalizeInternalUrl(value: string, baseUrl: string, origin: string) {
	try {
		const url = new URL(value, baseUrl);
		if (url.origin !== origin) return '';
		url.hash = '';
		return url.href;
	} catch {
		return '';
	}
}

function homepageLinks($: CheerioAPI, selector: string, baseUrl: string, origin: string) {
	const links = new Set<string>();
	$(selector)
		.find('a[href]')
		.each((_, element) => {
			const href = $(element).attr('href') || '';
			const normalized = normalizeInternalUrl(href, baseUrl, origin);
			if (normalized) links.add(normalized);
		});
	return [...links];
}

export async function analyzeHomePage(
	urlObj: URL,
	$: CheerioAPI,
	summary: AuditSummary,
	logger: AuditLogger,
	discoveredLinks: string[] = []
) {
	logger.info('homepage: analyzing single-page checks');
	const organizationSchema = createListResult();
	const unlinkedBlog = createListResult();
	const domain = urlObj.hostname || 'this domain';
	const allHomepageLinks = homepageLinks($, 'body', urlObj.href, urlObj.origin);
	const keyNavigationLinks = homepageLinks(
		$,
		'header, nav, [role="navigation"], footer',
		urlObj.href,
		urlObj.origin
	);
	const detectedBlogUrl = [...allHomepageLinks, ...discoveredLinks].find((link) =>
		isBlogLikeUrl(link, urlObj.origin)
	);
	const hasBlogInKeyNavigation = keyNavigationLinks.some((link) =>
		isBlogLikeUrl(link, urlObj.origin)
	);

	if (detectedBlogUrl) {
		addItem(
			summary,
			unlinkedBlog,
			hasBlogInKeyNavigation ? 'pass' : 'warn',
			hasBlogInKeyNavigation ? 'Blog linked from key navigation' : 'Unlinked Blog',
			{
				title: detectedBlogUrl,
				page_url: detectedBlogUrl,
				meta: {
					detectedBlogUrl,
					checkedAreas: ['header', 'nav', 'role=navigation', 'footer']
				}
			}
		);
	}

	const hasOrganizationSchema = hasValidJsonLd($, hasValidOrganizationJsonLd);
	addItem(
		summary,
		organizationSchema,
		hasOrganizationSchema ? 'pass' : 'warn',
		hasOrganizationSchema ? 'Organization Schema found' : 'Missing Organization Schema',
		{ title: urlObj.href, page_url: urlObj.href }
	);

	if (!hasOrganizationSchema) {
		attachScreenshotRequest(
			organizationSchema.items.find((item) => item.status === 'warn'),
			{
				kind: 'missing-organization-schema',
				reportTemplateKey: 'missing-organization-schema',
				title: 'Missing Organization Schema',
				domain,
				entries: [{ page: urlObj.href, issue: 'Missing Organization Schema' }],
				count: issueCount(organizationSchema.items)
			}
		);
	}

	if (detectedBlogUrl && !hasBlogInKeyNavigation) {
		attachScreenshotRequest(
			unlinkedBlog.items.find((item) => item.status === 'warn'),
			{
				kind: 'unlinked-blog',
				reportTemplateKey: 'unlinked-blog',
				title: 'Unlinked Blog',
				domain,
				entries: [{ page: detectedBlogUrl, issue: 'Unlinked Blog' }],
				count: issueCount(unlinkedBlog.items)
			}
		);
	}

	return {
		organizationSchema,
		unlinkedBlog
	};
}
