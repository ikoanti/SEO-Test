import type { CheerioAPI } from 'cheerio';
import type { AnyNode } from 'domhandler';
import { captureLazyLoadingEvidence, captureOpenGraphEvidence } from '$lib/server/audit-capture';
import type { AuditLogger, AuditSummary } from '../shared';
import { addItem, createListResult } from '../shared';

export async function analyzeHomePage(
	urlObj: URL,
	$: CheerioAPI,
	summary: AuditSummary,
	logger: AuditLogger
) {
	logger.info('homepage: analyzing single-page checks');
	const structuredData = createListResult();
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
	const maxEvidenceItems = 5;
	const domain = urlObj.hostname || 'this domain';
	const openGraphEvidence: Array<{ page: string; issue: string; property?: string }> = [];
	const lazyLoadingEvidence: Array<{ page: string; issue: string; image?: string }> = [];

	const schemaScripts = $('script[type="application/ld+json"]').length;
	addItem(
		summary,
		structuredData,
		schemaScripts > 0 ? 'pass' : 'warn',
		schemaScripts > 0 ? 'JSON-LD Found' : 'No JSON-LD Found',
		{ title: `${schemaScripts} JSON-LD block(s)` }
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
				title: resolveImageUrl(element)
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
				title: resolveImageUrl(element)
			});
		}
	}

	if (lazyLoadingEvidence.length > 0) {
		try {
			const capture = await captureLazyLoadingEvidence(domain, lazyLoadingEvidence);
			const firstIssue = lazyLoadImages.items.find(
				(item) => item.status === 'warn' || item.status === 'fail'
			);
			if (capture && firstIssue) {
				firstIssue.meta = {
					...((firstIssue.meta as Record<string, unknown> | undefined) || {}),
					screenshot: capture
				};
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			logger.warn(`homepage: lazy loading evidence capture failed (${message})`);
		}
	}

	if (openGraphEvidence.length > 0) {
		try {
			const capture = await captureOpenGraphEvidence(domain, openGraphEvidence);
			const firstIssue = openGraph.items.find(
				(item) => item.status === 'warn' || item.status === 'fail'
			);
			if (capture && firstIssue) {
				firstIssue.meta = {
					...((firstIssue.meta as Record<string, unknown> | undefined) || {}),
					screenshot: capture
				};
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			logger.warn(`homepage: open graph evidence capture failed (${message})`);
		}
	}

	return {
		structuredData,
		webIcons,
		ssl,
		mobileUsability,
		flash,
		charset: charsetResult,
		loremIpsum,
		openGraph,
		internationalDomains,
		trustSignals,
		lazyLoadImages
	};
}
