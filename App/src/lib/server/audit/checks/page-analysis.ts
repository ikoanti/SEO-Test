import type { AnyNode } from 'domhandler';
import {
	addItem,
	createListResult,
	extractInternalLinks,
	fetchText,
	loadDocument
} from '../shared';
import type { AuditLogger, AuditSummary } from '../shared';

function attachScreenshotRequest(
	item: Record<string, unknown> | undefined,
	request: Record<string, unknown>
) {
	if (!item) return;
	item.meta = {
		...((item.meta as Record<string, unknown> | undefined) || {}),
		screenshotRequest: request
	};
}

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
	const headingEvidence: Array<{ page: string; issue: string }> = [];
	const imageAltEvidence: Array<{ page: string; image: string; issue?: string }> = [];
	const metaEvidence: Array<{ page: string; issue: string; value?: string }> = [];
	const canonicalEvidence: Array<{ page: string; issue: string; value?: string }> = [];
	const internalLinksEvidence: Array<{ page: string; issue: string; count?: number }> = [];
	const contentQualityEvidence: Array<{ page: string; issue: string; wordCount?: number }> = [];
	const shopifyUrlEvidence: Array<{ page: string; issue: string; pattern?: string }> = [];
	const maxEvidenceItems = 5;
	const domain = (() => {
		try {
			return new URL(pages[0] || '').hostname || 'this domain';
		} catch {
			return 'this domain';
		}
	})();

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
			const headingIssue =
				h1Count === 0
					? 'Missing H1 tag'
					: h1Count > 1
						? emptyH1 > 0
							? 'Empty or multiple H1 tags found'
							: 'Multiple H1 tags found'
						: null;

			if (headingIssue && headingEvidence.length < maxEvidenceItems) {
				headingEvidence.push({ page, issue: headingIssue });
			}

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
				if (metaEvidence.length < maxEvidenceItems) {
					metaEvidence.push({ page, issue: 'Missing meta title' });
				}
				addItem(summary, metaTitles, 'warn', 'Missing meta title', { title: page });
			} else if (title.length > 60) {
				if (metaEvidence.length < maxEvidenceItems) {
					metaEvidence.push({
						page,
						issue: 'Meta title too long',
						value: `${title.length} chars: ${title}`
					});
				}
				addItem(summary, metaTitles, 'warn', 'Meta title too long', {
					title: `${page} (${title.length} chars)`
				});
			} else {
				addItem(summary, metaTitles, 'pass', 'Meta title looks good', { title });
			}

			if (metaDescription.length > 160) {
				if (metaEvidence.length < maxEvidenceItems) {
					metaEvidence.push({
						page,
						issue: 'Meta description too long',
						value: `${metaDescription.length} chars: ${metaDescription}`
					});
				}
				addItem(summary, metaTitles, 'warn', 'Meta description too long', {
					title: `${page} (${metaDescription.length} chars)`
				});
			}

			if (missingAlt > 0) {
				$('img').each((_: number, element: AnyNode) => {
					if ($(element).attr('alt')?.trim()) return;
					const src = $(element).attr('src')?.trim();
					if (!src) return;

					try {
						const image = new URL(src, page).href;
						if (imageAltEvidence.length < maxEvidenceItems) {
							imageAltEvidence.push({ page, image, issue: 'Image missing alt text' });
						}
						addItem(summary, imageAltTags, 'warn', 'Image missing alt text', {
							title: image,
							page_url: page
						});
					} catch {
						return;
					}
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
			if (!canonical && canonicalEvidence.length < maxEvidenceItems) {
				canonicalEvidence.push({ page, issue: 'Canonical URL missing' });
			}

			const sameOriginLinks = extractInternalLinks($, page, new URL(page).origin);
			if (sameOriginLinks.length === 0 && internalLinksEvidence.length < maxEvidenceItems) {
				internalLinksEvidence.push({
					page,
					issue: 'No crawlable internal links found',
					count: sameOriginLinks.length
				});
			}
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
			if (wordCount < 250 && contentQualityEvidence.length < maxEvidenceItems) {
				contentQualityEvidence.push({
					page,
					issue: 'Thin content detected',
					wordCount
				});
			}

			const pagePath = new URL(page).pathname;
			const shopifyPattern = /^\/collections\/[^/]+\/products\/[^/]+\/?$/i.test(pagePath);
			if (shopifyPattern && shopifyUrlEvidence.length < maxEvidenceItems) {
				shopifyUrlEvidence.push({
					page,
					issue: 'Shopify URL pattern detected',
					pattern: '/collections/{collection}/products/{product}'
				});
			}
			addItem(
				summary,
				shopifyUrls,
				shopifyPattern ? 'warn' : 'pass',
				shopifyPattern ? 'Shopify URL pattern detected' : 'No Shopify URL pattern detected',
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
			for (const page of pagesForTitle) {
				if (metaEvidence.length < maxEvidenceItems) {
					metaEvidence.push({
						page,
						issue: 'Duplicate meta title detected',
						value: title
					});
				}
				addItem(summary, metaTitles, 'warn', 'Duplicate meta title detected', {
					title: page,
					meta: {
						duplicateValue: title,
						duplicateCount: pagesForTitle.length
					}
				});
			}
		}
	}

	for (const [description, pagesForDescription] of descriptionMap.entries()) {
		if (pagesForDescription.length > 1) {
			for (const page of pagesForDescription) {
				if (metaEvidence.length < maxEvidenceItems) {
					metaEvidence.push({
						page,
						issue: 'Duplicate meta description detected',
						value: description
					});
				}
				addItem(summary, metaTitles, 'warn', 'Duplicate meta description detected', {
					title: page,
					meta: {
						duplicateValue: description,
						duplicateCount: pagesForDescription.length
					}
				});
			}
		}
	}

	if (headingEvidence.length > 0) {
		const issueCount = h1Tags.items.filter(
			(item) => item.status === 'warn' || item.status === 'fail'
		).length;
		attachScreenshotRequest(
			h1Tags.items.find((item) => item.status === 'warn' || item.status === 'fail'),
			{ kind: 'headings', domain, entries: headingEvidence, count: issueCount }
		);
	}

	if (imageAltEvidence.length > 0) {
		const issueCount = imageAltTags.items.filter(
			(item) => item.status === 'warn' || item.status === 'fail'
		).length;
		attachScreenshotRequest(
			imageAltTags.items.find((item) => item.status === 'warn' || item.status === 'fail'),
			{ kind: 'image-alts', domain, entries: imageAltEvidence, count: issueCount }
		);
	}

	if (metaEvidence.length > 0) {
		const issueCount = metaTitles.items.filter(
			(item) => item.status === 'warn' || item.status === 'fail'
		).length;
		attachScreenshotRequest(
			metaTitles.items.find((item) => item.status === 'warn' || item.status === 'fail'),
			{ kind: 'meta-tags', domain, entries: metaEvidence, count: issueCount }
		);
	}

	if (canonicalEvidence.length > 0) {
		const issueCount = canonicalUrls.items.filter(
			(item) => item.status === 'warn' || item.status === 'fail'
		).length;
		attachScreenshotRequest(
			canonicalUrls.items.find((item) => item.status === 'warn' || item.status === 'fail'),
			{ kind: 'canonicals', domain, entries: canonicalEvidence, count: issueCount }
		);
	}

	if (internalLinksEvidence.length > 0) {
		const issueCount = internalLinks.items.filter(
			(item) => item.status === 'warn' || item.status === 'fail'
		).length;
		attachScreenshotRequest(
			internalLinks.items.find((item) => item.status === 'warn' || item.status === 'fail'),
			{ kind: 'internal-links', domain, entries: internalLinksEvidence, count: issueCount }
		);
	}

	if (contentQualityEvidence.length > 0) {
		const issueCount = contentQuality.items.filter(
			(item) => item.status === 'warn' || item.status === 'fail'
		).length;
		attachScreenshotRequest(
			contentQuality.items.find((item) => item.status === 'warn' || item.status === 'fail'),
			{ kind: 'content-quality', domain, entries: contentQualityEvidence, count: issueCount }
		);
	}

	if (shopifyUrlEvidence.length > 0) {
		const issueCount = shopifyUrls.items.filter(
			(item) => item.status === 'warn' || item.status === 'fail'
		).length;
		attachScreenshotRequest(
			shopifyUrls.items.find((item) => item.status === 'warn' || item.status === 'fail'),
			{ kind: 'shopify-urls', domain, entries: shopifyUrlEvidence, count: issueCount }
		);
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
