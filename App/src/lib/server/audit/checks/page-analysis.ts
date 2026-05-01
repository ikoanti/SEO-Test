import type { AnyNode } from 'domhandler';
import {
	addItem,
	createListResult,
	extractInternalLinks,
	fetchText,
	hasValidFaqJsonLd,
	hasValidProductJsonLd,
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

function isProductLikePage(page: string, title: string, bodyText: string) {
	try {
		const pathname = new URL(page).pathname;
		if (/\/products?\//i.test(pathname)) return true;
	} catch {
		// Fall through to text heuristics.
	}

	return /\b(add to cart|buy now|sale price|regular price|variant|sku)\b/i.test(
		`${title} ${bodyText}`.slice(0, 20000)
	);
}

function isFaqLikePage(page: string, title: string, bodyText: string) {
	try {
		const pathname = new URL(page).pathname;
		if (/\/faqs?(\/|$)|frequently-asked-questions/i.test(pathname)) return true;
	} catch {
		// Fall through to text heuristics.
	}

	const text = `${title} ${bodyText}`.slice(0, 30000);
	if (/\b(faqs?|frequently asked questions)\b/i.test(text)) return true;
	const questionMarks = (text.match(/\?/g) || []).length;
	return questionMarks >= 4;
}

function hasValidJsonLd(
	$: ReturnType<typeof loadDocument>,
	validator: (value: unknown) => boolean
) {
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

function hasProductJsonLd($: ReturnType<typeof loadDocument>) {
	return hasValidJsonLd($, hasValidProductJsonLd);
}

function hasFaqJsonLd($: ReturnType<typeof loadDocument>) {
	return hasValidJsonLd($, hasValidFaqJsonLd);
}

export async function analyzeMetaAndHeadings(
	pages: string[],
	summary: AuditSummary,
	logger: AuditLogger
) {
	const missingH1Tags = createListResult();
	const multipleH1Tags = createListResult();
	const metaTitleIssues = createListResult();
	const duplicatePageTitles = createListResult();
	const duplicateMetaDescriptions = createListResult();
	const overlyLongMetaDescriptions = createListResult();
	const imageAltTags = createListResult();
	const loremIpsum = createListResult();
	const canonicalUrls = createListResult();
	const internalLinks = createListResult();
	const contentQuality = createListResult();
	const shopifyUrls = createListResult();
	const productSchema = createListResult();
	const faqSchema = createListResult();

	const titleMap = new Map();
	const descriptionMap = new Map();
	const missingH1Evidence: Array<{ page: string; issue: string }> = [];
	const multipleH1Evidence: Array<{ page: string; issue: string; headings?: string[] }> = [];
	const imageAltEvidence: Array<{ page: string; image: string; issue?: string }> = [];
	const metaTitleEvidence: Array<{ page: string; issue: string; value?: string }> = [];
	const longDescriptionEvidence: Array<{ page: string; issue: string; value?: string }> = [];
	const duplicateTitleEvidence: Array<{ page: string; issue: string; value?: string }> = [];
	const duplicateDescriptionEvidence: Array<{ page: string; issue: string; value?: string }> = [];
	const canonicalEvidence: Array<{ page: string; issue: string; value?: string }> = [];
	const internalLinksEvidence: Array<{ page: string; issue: string; count?: number }> = [];
	const contentQualityEvidence: Array<{ page: string; issue: string; wordCount?: number }> = [];
	const shopifyUrlEvidence: Array<{ page: string; issue: string; pattern?: string }> = [];
	const productSchemaEvidence: Array<{ page: string; issue: string }> = [];
	const faqSchemaEvidence: Array<{ page: string; issue: string }> = [];
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
			const h1Headings = $('h1')
				.toArray()
				.map((element) => $(element).text().replace(/\s+/g, ' ').trim());
			const emptyH1 = $('h1').filter(
				(_: number, element: AnyNode) => !$(element).text().trim()
			).length;
			const title = $('title').text().trim();
			const metaDescription = $('meta[name="description"]').attr('content')?.trim() || '';
			const canonical = $('link[rel="canonical"]').attr('href') || '';
			const bodyText = $('body').text();
			const hasLoremIpsum = /lorem ipsum/i.test(bodyText);
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
					: h1Count > 1 || emptyH1 > 0
						? emptyH1 > 0
							? 'Empty or multiple H1 tags found'
							: 'Multiple H1 tags found'
						: null;

			if (headingIssue === 'Missing H1 tag' && missingH1Evidence.length < maxEvidenceItems) {
				missingH1Evidence.push({ page, issue: headingIssue });
			} else if (headingIssue && multipleH1Evidence.length < maxEvidenceItems) {
				multipleH1Evidence.push({ page, issue: headingIssue, headings: h1Headings });
			}

			if (h1Count === 0) {
				addItem(summary, missingH1Tags, 'warn', 'Missing H1 tag', {
					title: page,
					page_url: page
				});
			} else if (h1Count > 1) {
				addItem(
					summary,
					multipleH1Tags,
					'warn',
					emptyH1 > 0 ? 'Empty or multiple H1 tags found' : 'Multiple H1 tags found',
					{
						title: `${page} (${h1Count} H1 tags)`,
						page_url: page,
						meta: { headings: h1Headings }
					}
				);
			} else if (emptyH1 > 0) {
				addItem(summary, multipleH1Tags, 'warn', 'Empty or multiple H1 tags found', {
					title: `${page} (${h1Count} H1 tags)`,
					page_url: page,
					meta: { headings: h1Headings }
				});
			} else {
				// Passing pages don't need persisted findings for split H1 report problems.
			}

			const productLikePage = isProductLikePage(page, title, bodyText);
			const productJsonLd = hasProductJsonLd($);
			if (productLikePage && !productJsonLd) {
				if (productSchemaEvidence.length < maxEvidenceItems) {
					productSchemaEvidence.push({ page, issue: 'Missing product schema' });
				}
				addItem(summary, productSchema, 'warn', 'Missing product schema', {
					title: page,
					page_url: page
				});
			} else if (productLikePage) {
				addItem(summary, productSchema, 'pass', 'Product schema found', {
					title: page,
					page_url: page
				});
			}

			const faqLikePage = isFaqLikePage(page, title, bodyText);
			const faqJsonLd = hasFaqJsonLd($);
			if (faqLikePage && !faqJsonLd) {
				if (faqSchemaEvidence.length < maxEvidenceItems) {
					faqSchemaEvidence.push({ page, issue: 'Missing FAQ Schema' });
				}
				addItem(summary, faqSchema, 'warn', 'Missing FAQ Schema', {
					title: page,
					page_url: page
				});
			} else if (faqLikePage) {
				addItem(summary, faqSchema, 'pass', 'FAQ Schema found', {
					title: page,
					page_url: page
				});
			}

			if (title.length === 0) {
				if (metaTitleEvidence.length < maxEvidenceItems) {
					metaTitleEvidence.push({ page, issue: 'Missing meta title' });
				}
				addItem(summary, metaTitleIssues, 'warn', 'Missing meta title', {
					title: page,
					page_url: page
				});
			} else if (title.length > 60) {
				const value = `${title.length} chars: ${title}`;
				if (metaTitleEvidence.length < maxEvidenceItems) {
					metaTitleEvidence.push({
						page,
						issue: 'Meta title too long',
						value
					});
				}
				addItem(summary, metaTitleIssues, 'warn', 'Meta title too long', {
					title: `${page} (${title.length} chars)`,
					page_url: page,
					value
				});
			} else {
				// Passing pages don't need persisted findings for split meta-title report problems.
			}

			if (metaDescription.length > 160) {
				const value = `${metaDescription.length} chars: ${metaDescription}`;
				if (longDescriptionEvidence.length < maxEvidenceItems) {
					longDescriptionEvidence.push({
						page,
						issue: 'Meta description too long',
						value
					});
				}
				addItem(summary, overlyLongMetaDescriptions, 'warn', 'Meta description too long', {
					title: `${page} (${metaDescription.length} chars)`,
					page_url: page,
					value
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
				loremIpsum,
				hasLoremIpsum ? 'warn' : 'pass',
				hasLoremIpsum ? 'Lorem Ipsum Detected' : 'No Lorem Ipsum Detected',
				{ title: page, page_url: page }
			);

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
				if (duplicateTitleEvidence.length < maxEvidenceItems) {
					duplicateTitleEvidence.push({
						page,
						issue: 'Duplicate meta title detected',
						value: title
					});
				}
				addItem(summary, duplicatePageTitles, 'warn', 'Duplicate meta title detected', {
					title: page,
					page_url: page,
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
				if (duplicateDescriptionEvidence.length < maxEvidenceItems) {
					duplicateDescriptionEvidence.push({
						page,
						issue: 'Duplicate meta description detected',
						value: description
					});
				}
				addItem(summary, duplicateMetaDescriptions, 'warn', 'Duplicate meta description detected', {
					title: page,
					page_url: page,
					meta: {
						duplicateValue: description,
						duplicateCount: pagesForDescription.length
					}
				});
			}
		}
	}

	const issueItems = (
		items: Array<Record<string, unknown>>,
		matcher: (item: Record<string, unknown>) => boolean
	) => items.filter((item) => item.status === 'warn' && matcher(item));

	if (missingH1Evidence.length > 0) {
		const matchingItems = issueItems(
			missingH1Tags.items,
			(item) => item.detail === 'Missing H1 tag'
		);
		attachScreenshotRequest(matchingItems[0], {
			kind: 'headings',
			reportTemplateKey: 'missing-h1-tags',
			title: 'Missing H1 tags',
			domain,
			entries: missingH1Evidence,
			count: matchingItems.length
		});
	}

	if (multipleH1Evidence.length > 0) {
		const matchingItems = issueItems(multipleH1Tags.items, (item) =>
			String(item.detail || '')
				.toLowerCase()
				.includes('multiple h1')
		);
		attachScreenshotRequest(matchingItems[0], {
			kind: 'headings',
			reportTemplateKey: 'multiple-h1-tags',
			title: 'Multiple H1 tags',
			domain,
			entries: multipleH1Evidence,
			count: matchingItems.length
		});
	}

	if (imageAltEvidence.length > 0) {
		const issueCount = imageAltTags.items.filter((item) => item.status === 'warn').length;
		attachScreenshotRequest(
			imageAltTags.items.find((item) => item.status === 'warn'),
			{
				kind: 'image-alts',
				reportTemplateKey: 'images-with-missing-alt-text',
				title: 'Images with Missing Alt text',
				domain,
				entries: imageAltEvidence,
				count: issueCount
			}
		);
	}

	if (metaTitleEvidence.length > 0) {
		const matchingItems = issueItems(
			metaTitleIssues.items,
			(item) => item.detail === 'Meta title too long' || item.detail === 'Missing meta title'
		);
		attachScreenshotRequest(matchingItems[0], {
			kind: 'meta-tags',
			reportTemplateKey: 'meta-titles-too-long-unoptimized',
			title: 'Meta Titles Are Too Long & Unoptimized',
			domain,
			entries: metaTitleEvidence,
			count: matchingItems.length
		});
	}

	if (duplicateTitleEvidence.length > 0) {
		const matchingItems = issueItems(
			duplicatePageTitles.items,
			(item) => item.detail === 'Duplicate meta title detected'
		);
		attachScreenshotRequest(matchingItems[0], {
			kind: 'meta-tags',
			reportTemplateKey: 'duplicated-page-titles',
			title: 'Duplicated Page Titles',
			domain,
			entries: duplicateTitleEvidence,
			count: matchingItems.length
		});
	}

	if (duplicateDescriptionEvidence.length > 0) {
		const matchingItems = issueItems(
			duplicateMetaDescriptions.items,
			(item) => item.detail === 'Duplicate meta description detected'
		);
		attachScreenshotRequest(matchingItems[0], {
			kind: 'meta-tags',
			reportTemplateKey: 'duplicated-meta-descriptions',
			title: 'Duplicated Meta Descriptions',
			domain,
			entries: duplicateDescriptionEvidence,
			count: matchingItems.length
		});
	}

	if (longDescriptionEvidence.length > 0) {
		const matchingItems = issueItems(
			overlyLongMetaDescriptions.items,
			(item) => item.detail === 'Meta description too long'
		);
		attachScreenshotRequest(matchingItems[0], {
			kind: 'meta-tags',
			reportTemplateKey: 'overly-long-meta-descriptions',
			title: 'Overly Long Meta Descriptions',
			domain,
			entries: longDescriptionEvidence,
			count: matchingItems.length
		});
	}

	if (canonicalEvidence.length > 0) {
		const issueCount = canonicalUrls.items.filter((item) => item.status === 'warn').length;
		attachScreenshotRequest(
			canonicalUrls.items.find((item) => item.status === 'warn'),
			{ kind: 'canonicals', domain, entries: canonicalEvidence, count: issueCount }
		);
	}

	if (internalLinksEvidence.length > 0) {
		const issueCount = internalLinks.items.filter((item) => item.status === 'warn').length;
		attachScreenshotRequest(
			internalLinks.items.find((item) => item.status === 'warn'),
			{ kind: 'internal-links', domain, entries: internalLinksEvidence, count: issueCount }
		);
	}

	if (contentQualityEvidence.length > 0) {
		const issueCount = contentQuality.items.filter((item) => item.status === 'warn').length;
		attachScreenshotRequest(
			contentQuality.items.find((item) => item.status === 'warn'),
			{ kind: 'content-quality', domain, entries: contentQualityEvidence, count: issueCount }
		);
	}

	if (shopifyUrlEvidence.length > 0) {
		const issueCount = shopifyUrls.items.filter((item) => item.status === 'warn').length;
		attachScreenshotRequest(
			shopifyUrls.items.find((item) => item.status === 'warn'),
			{
				kind: 'shopify-urls',
				reportTemplateKey: 'unoptimized-shopify-url-structure',
				title: 'Unoptimized Shopify URL structure',
				domain,
				entries: shopifyUrlEvidence,
				count: issueCount
			}
		);
	}

	if (productSchemaEvidence.length > 0) {
		const issueCount = productSchema.items.filter((item) => item.status === 'warn').length;
		attachScreenshotRequest(
			productSchema.items.find((item) => item.status === 'warn'),
			{
				kind: 'missing-product-schema',
				reportTemplateKey: 'missing-product-schema',
				title: 'Missing product schema',
				domain,
				entries: productSchemaEvidence,
				count: issueCount
			}
		);
	}

	if (faqSchemaEvidence.length > 0) {
		const issueCount = faqSchema.items.filter((item) => item.status === 'warn').length;
		attachScreenshotRequest(
			faqSchema.items.find((item) => item.status === 'warn'),
			{
				kind: 'missing-faq-schema',
				reportTemplateKey: 'missing-faq-schema',
				title: 'Missing FAQ Schema',
				domain,
				entries: faqSchemaEvidence,
				count: issueCount
			}
		);
	}

	return {
		'missing-h1-tags': missingH1Tags,
		'multiple-h1-tags': multipleH1Tags,
		'missing-product-schema': productSchema,
		faqSchema,
		'meta-titles-too-long-unoptimized': metaTitleIssues,
		'duplicated-page-titles': duplicatePageTitles,
		'duplicated-meta-descriptions': duplicateMetaDescriptions,
		'overly-long-meta-descriptions': overlyLongMetaDescriptions,
		imageAltTags,
		loremIpsum,
		canonicalUrls,
		internalLinks,
		contentQuality,
		shopifyUrls
	};
}
