import type { CheerioAPI } from 'cheerio';
import type { AnyNode } from 'domhandler';
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

function textMatchesAny(value: string, patterns: RegExp[]) {
	return patterns.some((pattern) => pattern.test(value));
}

function hasInternalPathMatch(links: string[], patterns: RegExp[]) {
	return links.some((link) => {
		try {
			const url = new URL(link);
			const path = `${url.pathname} ${url.pathname.replace(/[-_]/g, ' ')}`;
			return textMatchesAny(path, patterns);
		} catch {
			return false;
		}
	});
}

function detectTrustSignals(bodyText: string, links: string[]) {
	const normalizedText = bodyText.replace(/\s+/g, ' ');
	return [
		{
			label: 'Contact information',
			detected:
				textMatchesAny(normalizedText, [
					/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
					/\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/,
					/\bcontact\s+us\b/i
				]) || hasInternalPathMatch(links, [/\/contact(?:-us)?(?:\/|$)/i])
		},
		{
			label: 'About page',
			detected:
				textMatchesAny(normalizedText, [/\babout\s+us\b/i]) ||
				hasInternalPathMatch(links, [/\/about(?:-us)?(?:\/|$)/i])
		},
		{
			label: 'Privacy policy',
			detected:
				textMatchesAny(normalizedText, [/\bprivacy\s+policy\b/i]) ||
				hasInternalPathMatch(links, [/\/privacy(?:-policy)?(?:\/|$)/i])
		},
		{
			label: 'Terms policy',
			detected:
				textMatchesAny(normalizedText, [/\bterms(?:\s+(?:of\s+service|and\s+conditions))?\b/i]) ||
				hasInternalPathMatch(links, [/\/terms(?:-of-service|-and-conditions)?(?:\/|$)/i])
		},
		{
			label: 'Return/refund policy',
			detected:
				textMatchesAny(normalizedText, [
					/\breturns?\b/i,
					/\brefunds?\b/i,
					/\breturn\s+policy\b/i,
					/\brefund\s+policy\b/i
				]) || hasInternalPathMatch(links, [/\/(?:returns?|refunds?)(?:-policy)?(?:\/|$)/i])
		},
		{
			label: 'Shipping policy',
			detected:
				textMatchesAny(normalizedText, [/\bshipping\b/i]) ||
				hasInternalPathMatch(links, [/\/shipping(?:-policy)?(?:\/|$)/i])
		},
		{
			label: 'Customer proof',
			detected: textMatchesAny(normalizedText, [
				/\breviews?\b/i,
				/\btestimonials?\b/i,
				/\bverified\s+(?:reviews?|customers?)\b/i
			])
		},
		{
			label: 'Security/guarantee',
			detected: textMatchesAny(normalizedText, [
				/\bsecure\s+(?:checkout|payment|payments)\b/i,
				/\bmoney[-\s]?back\s+guarantee\b/i,
				/\bsatisfaction\s+guarantee\b/i
			])
		}
	];
}

function declaredCharacterEncoding($: CheerioAPI) {
	const metaCharset = $('meta[charset]').first().attr('charset')?.trim();
	if (metaCharset) return metaCharset;

	const contentType = $('meta[http-equiv]')
		.toArray()
		.find((element) => /^content-type$/i.test($(element).attr('http-equiv') || ''));
	const content = contentType ? $(contentType).attr('content') || '' : '';
	return content.match(/charset\s*=\s*([^;\s]+)/i)?.[1]?.trim() || '';
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
	const webIcons = createListResult();
	const ssl = createListResult();
	const viewportMetaTag = createListResult();
	const flash = createListResult();
	const charsetResult = createListResult();
	const openGraph = createListResult();
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

	const hasOrganizationSchema = hasValidJsonLd($, hasValidOrganizationJsonLd);
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
		urlObj.protocol === 'https:' ? 'pass' : 'warn',
		urlObj.protocol === 'https:' ? 'HTTPS Enabled' : 'HTTPS Not Enabled'
	);

	const viewport = $('meta[name="viewport"]').attr('content');
	addItem(
		summary,
		viewportMetaTag,
		viewport ? 'pass' : 'warn',
		viewport ? 'Viewport Meta Tag Present' : 'Viewport Meta Tag Missing'
	);

	addItem(
		summary,
		flash,
		$('object, embed').length > 0 ? 'warn' : 'pass',
		$('object, embed').length > 0 ? 'Legacy Flash-like embeds found' : 'No Flash embeds found'
	);

	const charset = declaredCharacterEncoding($);
	addItem(
		summary,
		charsetResult,
		charset ? 'pass' : 'warn',
		charset ? `Character Encoding Declared (${charset})` : 'Character Encoding Missing',
		{
			title: charset || ''
		}
	);

	const bodyText = $('body').text();
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

	for (const signal of detectTrustSignals(bodyText, allHomepageLinks)) {
		addItem(
			summary,
			trustSignals,
			signal.detected ? 'pass' : 'warn',
			signal.detected ? `${signal.label} detected` : `${signal.label} missing`,
			{ title: signal.label, page_url: urlObj.href }
		);
	}

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
			lazyLoadImages.items.find((item) => item.status === 'warn'),
			{
				kind: 'lazy-loading',
				title: 'Lazy Load Images',
				domain,
				entries: lazyLoadingEvidence,
				count: issueCount(lazyLoadImages.items)
			}
		);
	}

	if (openGraphEvidence.length > 0) {
		attachScreenshotRequest(
			openGraph.items.find((item) => item.status === 'warn'),
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
		webIcons,
		ssl,
		viewportMetaTag,
		flash,
		charset: charsetResult,
		openGraph,
		trustSignals,
		lazyLoadImages,
		unlinkedBlog
	};
}
