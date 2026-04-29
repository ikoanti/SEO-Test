import type { CheerioAPI } from 'cheerio';
import type { AnyNode } from 'domhandler';
import type { AuditCaptureRequest } from '$lib/server/audit-capture';
import type { AuditLogger, AuditSummary } from '../shared';
import { addItem, createListResult } from '../shared';

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
	return items.filter((item) => item.status === 'warn' || item.status === 'fail').length;
}

function valueHasSchemaType(value: unknown, schemaType: string): boolean {
	if (!value || typeof value !== 'object') return false;
	if (Array.isArray(value)) return value.some((item) => valueHasSchemaType(item, schemaType));

	const record = value as Record<string, unknown>;
	const typeValue = record['@type'];
	const types = Array.isArray(typeValue) ? typeValue : [typeValue];
	if (types.some((type) => String(type).toLowerCase() === schemaType.toLowerCase())) return true;

	return Object.values(record).some((item) => valueHasSchemaType(item, schemaType));
}

function hasJsonLdSchemaType($: CheerioAPI, schemaType: string) {
	return $('script[type="application/ld+json"]')
		.toArray()
		.some((element) => {
			const raw = $(element).contents().text().trim();
			if (!raw) return false;

			try {
				return valueHasSchemaType(JSON.parse(raw), schemaType);
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
	const structuredData = createListResult();
	const organizationSchema = createListResult();
	const webIcons = createListResult();
	const ssl = createListResult();
	const mobileUsability = createListResult();
	const flash = createListResult();
	const charsetResult = createListResult();
	const loremIpsum = createListResult();
	const openGraph = createListResult();
	const internationalDomains = createListResult();
	const trustSignals = createListResult();
	const lazyLoadImages = createListResult();
	const unlinkedBlog = createListResult();
	const maxEvidenceItems = 5;
	const domain = urlObj.hostname || 'this domain';
	const openGraphEvidence: Array<{ page: string; issue: string; property?: string }> = [];
	const lazyLoadingEvidence: Array<{ page: string; issue: string; image?: string }> = [];
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

	const schemaScripts = $('script[type="application/ld+json"]').length;
	addItem(
		summary,
		structuredData,
		schemaScripts > 0 ? 'pass' : 'warn',
		schemaScripts > 0 ? 'JSON-LD Found' : 'No JSON-LD Found',
		{ title: `${schemaScripts} JSON-LD block(s)` }
	);

	const hasOrganizationSchema = hasJsonLdSchemaType($, 'Organization');
	addItem(
		summary,
		organizationSchema,
		hasOrganizationSchema ? 'pass' : 'warn',
		hasOrganizationSchema ? 'Organization Schema found' : 'Missing Organization Schema',
		{ title: urlObj.href, page_url: urlObj.href }
	);

	const iconHref = $('link[rel="icon"], link[rel="shortcut icon"]').attr('href');
	addItem(
		summary,
		webIcons,
		iconHref ? 'pass' : 'warn',
		iconHref ? 'Favicon Present' : 'Favicon Missing',
		{
			title: iconHref || ''
		}
	);

	const appleTouchHref = $('link[rel="apple-touch-icon"]').attr('href');
	addItem(
		summary,
		webIcons,
		appleTouchHref ? 'pass' : 'warn',
		appleTouchHref ? 'Apple Touch Icon Present' : 'Apple Touch Icon Missing',
		{ title: appleTouchHref || '' }
	);

	addItem(
		summary,
		ssl,
		urlObj.protocol === 'https:' ? 'pass' : 'fail',
		urlObj.protocol === 'https:' ? 'HTTPS Enabled' : 'HTTPS Not Enabled'
	);

	const viewport = $('meta[name="viewport"]').attr('content');
	addItem(
		summary,
		mobileUsability,
		viewport ? 'pass' : 'warn',
		viewport ? 'Viewport Meta Tag Present' : 'Viewport Meta Tag Missing'
	);

	addItem(
		summary,
		flash,
		$('object, embed').length > 0 ? 'warn' : 'pass',
		$('object, embed').length > 0 ? 'Legacy Flash-like embeds found' : 'No Flash embeds found'
	);

	const charset = $('meta[charset]').attr('charset');
	addItem(
		summary,
		charsetResult,
		charset ? 'pass' : 'warn',
		charset ? 'Charset Declared' : 'Charset Missing',
		{
			title: charset || ''
		}
	);

	const bodyText = $('body').text();
	addItem(
		summary,
		loremIpsum,
		/lorem ipsum/i.test(bodyText) ? 'warn' : 'pass',
		/lorem ipsum/i.test(bodyText) ? 'Lorem Ipsum Detected' : 'No Lorem Ipsum Detected'
	);

	for (const property of ['og:title', 'og:description', 'og:image', 'og:url']) {
		const content = $(`meta[property="${property}"]`).attr('content');
		if (!content && openGraphEvidence.length < maxEvidenceItems) {
			openGraphEvidence.push({
				page: urlObj.href,
				issue: `${property} Missing`,
				property
			});
		}
		addItem(
			summary,
			openGraph,
			content ? 'pass' : 'warn',
			content ? `${property} Present` : `${property} Missing`,
			{
				title: content || ''
			}
		);
	}

	addItem(
		summary,
		internationalDomains,
		/\.[a-z]{2}$/i.test(urlObj.hostname) ? 'pass' : 'warn',
		/\.[a-z]{2}$/i.test(urlObj.hostname)
			? 'Country-code domain detected'
			: 'Generic domain detected',
		{ title: urlObj.hostname }
	);

	const trustSignalsMatches = ['refund', 'returns', 'privacy', 'terms', 'shipping'].filter((term) =>
		new RegExp(term, 'i').test(bodyText)
	);
	addItem(
		summary,
		trustSignals,
		trustSignalsMatches.length >= 3 ? 'pass' : 'warn',
		trustSignalsMatches.length >= 3 ? 'Trust signals detected' : 'Limited trust signals detected',
		{ title: trustSignalsMatches.join(', ') || 'None' }
	);

	const images = $('img').toArray();
	const resolveImageUrl = (element: AnyNode) => {
		const rawSrc =
			$(element).attr('src') ||
			$(element).attr('data-src') ||
			$(element).attr('data-lazy-src') ||
			'';

		try {
			return rawSrc ? new URL(rawSrc, urlObj.href).href : urlObj.href;
		} catch {
			return rawSrc || urlObj.href;
		}
	};
	const lazyImageElements = images.filter(
		(element: AnyNode) => ($(element).attr('loading') || '').toLowerCase() === 'lazy'
	);
	const nonLazyImages = images.filter(
		(element: AnyNode) => ($(element).attr('loading') || '').toLowerCase() !== 'lazy'
	);

	if (images.length === 0) {
		addItem(summary, lazyLoadImages, 'pass', 'No Images Found');
	} else {
		for (const element of lazyImageElements) {
			addItem(summary, lazyLoadImages, 'pass', 'Image uses loading="lazy"', {
				title: resolveImageUrl(element),
				page_url: urlObj.href
			});
		}

		for (const element of nonLazyImages) {
			if (lazyLoadingEvidence.length < maxEvidenceItems) {
				lazyLoadingEvidence.push({
					page: urlObj.href,
					issue: 'Image missing loading="lazy"',
					image: resolveImageUrl(element)
				});
			}
			addItem(summary, lazyLoadImages, 'warn', 'Image missing loading="lazy"', {
				title: resolveImageUrl(element),
				page_url: urlObj.href
			});
		}
	}

	if (lazyLoadingEvidence.length > 0) {
		attachScreenshotRequest(
			lazyLoadImages.items.find((item) => item.status === 'warn' || item.status === 'fail'),
			{
				kind: 'lazy-loading',
				domain,
				entries: lazyLoadingEvidence,
				count: issueCount(lazyLoadImages.items)
			}
		);
	}

	if (openGraphEvidence.length > 0) {
		attachScreenshotRequest(
			openGraph.items.find((item) => item.status === 'warn' || item.status === 'fail'),
			{
				kind: 'open-graph',
				domain,
				entries: openGraphEvidence,
				count: issueCount(openGraph.items)
			}
		);
	}

	if (!hasOrganizationSchema) {
		attachScreenshotRequest(
			organizationSchema.items.find((item) => item.status === 'warn' || item.status === 'fail'),
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
			unlinkedBlog.items.find((item) => item.status === 'warn' || item.status === 'fail'),
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
		structuredData,
		organizationSchema,
		webIcons,
		ssl,
		mobileUsability,
		flash,
		charset: charsetResult,
		loremIpsum,
		openGraph,
		internationalDomains,
		trustSignals,
		lazyLoadImages,
		unlinkedBlog
	};
}
