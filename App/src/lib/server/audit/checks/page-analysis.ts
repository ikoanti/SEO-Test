import type { AnyNode } from 'domhandler';
import {
	addItem,
	createListResult,
	extractInternalLinks,
	fetchText,
	loadDocument
} from '../shared';
import type { AuditLogger, AuditSummary } from '../shared';

export async function analyzeMetaAndHeadings(
	pages: string[],
	summary: AuditSummary,
	logger: AuditLogger
) {
	const h1Tags = createListResult();
	const metaTitles = createListResult();
	const imageAltTags = createListResult();
	const canonicalUrls = createListResult();
	const internalLinks = createListResult();
	const contentQuality = createListResult();
	const shopifyUrls = createListResult();

	const titleMap = new Map();
	const descriptionMap = new Map();

	for (const page of pages) {
		try {
			const response = await fetchText(page);
			const $ = loadDocument(response.data);
			const h1Count = $('h1').length;
			const emptyH1 = $('h1').filter(
				(_: number, element: AnyNode) => !$(element).text().trim()
			).length;
			const title = $('title').text().trim();
			const metaDescription = $('meta[name="description"]').attr('content')?.trim() || '';
			const canonical = $('link[rel="canonical"]').attr('href') || '';
			const missingAlt = $('img').filter(
				(_: number, element: AnyNode) => !$(element).attr('alt')?.trim()
			).length;
			const wordCount = $('body')
				.text()
				.replace(/\s+/g, ' ')
				.trim()
				.split(' ')
				.filter(Boolean).length;

			if (h1Count === 1 && emptyH1 === 0) {
				addItem(summary, h1Tags, 'pass', 'Single H1 tag present', { title: page });
			} else if (h1Count === 0) {
				addItem(summary, h1Tags, 'warn', 'Missing H1 tag', { title: page });
			} else {
				addItem(
					summary,
					h1Tags,
					'warn',
					emptyH1 > 0 ? 'Empty or multiple H1 tags found' : 'Multiple H1 tags found',
					{ title: `${page} (${h1Count} H1 tags)` }
				);
			}

			if (title.length === 0) {
				addItem(summary, metaTitles, 'warn', 'Missing meta title', { title: page });
			} else if (title.length > 60) {
				addItem(summary, metaTitles, 'warn', 'Meta title too long', {
					title: `${page} (${title.length} chars)`
				});
			} else {
				addItem(summary, metaTitles, 'pass', 'Meta title looks good', { title });
			}

			if (metaDescription.length > 160) {
				addItem(summary, metaTitles, 'warn', 'Meta description too long', {
					title: `${page} (${metaDescription.length} chars)`
				});
			}

			if (missingAlt > 0) {
				addItem(summary, imageAltTags, 'warn', 'Images missing alt text', {
					title: `${page} (${missingAlt} images)`
				});
			} else {
				addItem(summary, imageAltTags, 'pass', 'All images include alt text', { title: page });
			}

			addItem(
				summary,
				canonicalUrls,
				canonical ? 'pass' : 'warn',
				canonical ? 'Canonical URL present' : 'Canonical URL missing',
				{ title: canonical || page }
			);

			const sameOriginLinks = extractInternalLinks($, page, new URL(page).origin);
			addItem(
				summary,
				internalLinks,
				sameOriginLinks.length > 0 ? 'pass' : 'warn',
				sameOriginLinks.length > 0 ? 'Internal links found' : 'No crawlable internal links found',
				{ title: `${page} (${sameOriginLinks.length} links)` }
			);

			addItem(
				summary,
				contentQuality,
				wordCount >= 250 ? 'pass' : 'warn',
				wordCount >= 250 ? 'Content length looks reasonable' : 'Thin content detected',
				{ title: `${page} (${wordCount} words)` }
			);

			addItem(
				summary,
				shopifyUrls,
				/\/collections\/|\/products\//.test(page) ? 'warn' : 'pass',
				/\/collections\/|\/products\//.test(page)
					? 'Shopify URL pattern detected'
					: 'No Shopify URL pattern detected',
				{ title: page }
			);

			if (title) {
				const pagesForTitle = titleMap.get(title) || [];
				pagesForTitle.push(page);
				titleMap.set(title, pagesForTitle);
			}

			if (metaDescription) {
				const pagesForDescription = descriptionMap.get(metaDescription) || [];
				pagesForDescription.push(page);
				descriptionMap.set(metaDescription, pagesForDescription);
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			logger.warn(`page-analysis: failed for ${page} (${message})`);
		}
	}

	for (const [title, pagesForTitle] of titleMap.entries()) {
		if (pagesForTitle.length > 1) {
			addItem(summary, metaTitles, 'warn', 'Duplicate meta title detected', {
				title: `${title} (${pagesForTitle.length} pages)`
			});
		}
	}

	for (const [description, pagesForDescription] of descriptionMap.entries()) {
		if (pagesForDescription.length > 1) {
			addItem(summary, metaTitles, 'warn', 'Duplicate meta description detected', {
				title: `${description.slice(0, 80)}${description.length > 80 ? '…' : ''} (${pagesForDescription.length} pages)`
			});
		}
	}

	return {
		h1Tags,
		metaTitles,
		imageAltTags,
		canonicalUrls,
		internalLinks,
		contentQuality,
		shopifyUrls
	};
}
