import axios from 'axios';
import type { AuditLogger, AuditSummary } from '../shared';
import { addItem, createListResult } from '../shared';

type DataForSEOTask<T = unknown> = {
	id?: string;
	status_code?: number;
	status_message?: string;
	result?: T[];
};

type DataForSEOResponse<T = unknown> = {
	tasks?: Array<DataForSEOTask<T>>;
};

type CrawlSummary = {
	crawl_progress?: string;
	crawl_status?: {
		pages_crawled?: number;
		pages_in_queue?: number;
		max_crawl_pages?: number;
	};
};

export type DataForSEOPage = {
	resource_type?: string;
	status_code?: number;
	url?: string;
	meta?: {
		title?: string | null;
		meta_title?: string | null;
		description?: string | null;
		htags?: Record<string, string[] | undefined> | null;
		images_count?: number | null;
		content?: {
			plain_text_word_count?: number | null;
		} | null;
	};
	checks?: Record<string, boolean | undefined>;
};

export type DataForSEOCrawl = {
	id: string;
	homepage: string;
	links: string[];
	pages: DataForSEOPage[];
};

const API_BASE = 'https://api.dataforseo.com/v3';

function credentialHeader() {
	const apiKey = process.env.DATAFORSEO_API_KEY?.trim();
	if (apiKey) return `Basic ${apiKey}`;

	const login = process.env.DATAFORSEO_LOGIN?.trim();
	const password = process.env.DATAFORSEO_PASSWORD?.trim();
	if (login && password) return `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`;

	return null;
}

export function isDataForSEOConfigured() {
	return Boolean(credentialHeader());
}

function maxCrawlPages() {
	const value = Number(process.env.DATAFORSEO_MAX_CRAWL_PAGES || 100);
	return Number.isFinite(value) ? Math.max(1, Math.min(200, Math.trunc(value))) : 100;
}

function pollAttempts() {
	const value = Number(process.env.DATAFORSEO_POLL_ATTEMPTS || 40);
	return Number.isFinite(value) ? Math.max(1, Math.trunc(value)) : 40;
}

function pollIntervalMs() {
	const value = Number(process.env.DATAFORSEO_POLL_INTERVAL_MS || 10000);
	return Number.isFinite(value) ? Math.max(2000, Math.trunc(value)) : 10000;
}

function taskError(task: DataForSEOTask<unknown> | undefined, fallback: string) {
	if (!task) return fallback;
	if (task.status_code && task.status_code >= 40000) {
		return `${task.status_message || fallback} (${task.status_code})`;
	}
	return '';
}

function normalizeTarget(urlObj: URL) {
	return urlObj.hostname.replace(/^www\./i, '');
}

async function postDataForSEO<T>(path: string, payload: Record<string, unknown>[]) {
	const authorization = credentialHeader();
	if (!authorization) throw new Error('DATAFORSEO_API_KEY is not configured.');

	const response = await axios.post<DataForSEOResponse<T>>(`${API_BASE}${path}`, payload, {
		headers: {
			Authorization: authorization,
			'Content-Type': 'application/json'
		},
		timeout: 120000
	});
	return response.data;
}

async function createTask(urlObj: URL) {
	const data = await postDataForSEO('/on_page/task_post', [
		{
			target: normalizeTarget(urlObj),
			start_url: urlObj.href,
			max_crawl_pages: maxCrawlPages(),
			load_resources: true,
			enable_javascript: true,
			force_sitewide_checks: true
		}
	]);
	const task = data.tasks?.[0];
	const error = taskError(task, 'DataForSEO did not accept the crawl task.');
	if (error) throw new Error(error);
	if (!task?.id) throw new Error('DataForSEO did not return a crawl task id.');
	return task.id;
}

async function getSummary(id: string) {
	const data = await postDataForSEO<CrawlSummary>('/on_page/summary', [{ id }]);
	const task = data.tasks?.[0];
	const error = taskError(task, 'DataForSEO summary request failed.');
	if (error) throw new Error(error);
	return task?.result?.[0] ?? null;
}

async function getPages(id: string) {
	const data = await postDataForSEO<{ items?: DataForSEOPage[] }>('/on_page/pages', [
		{
			id,
			limit: maxCrawlPages(),
			filters: ['resource_type', '=', 'html']
		}
	]);
	const task = data.tasks?.[0];
	const error = taskError(task, 'DataForSEO pages request failed.');
	if (error) throw new Error(error);
	return task?.result?.[0]?.items ?? [];
}

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runDataForSEOCrawl(urlObj: URL, logger: AuditLogger): Promise<DataForSEOCrawl> {
	const id = await createTask(urlObj);
	logger.info(`crawl: DataForSEO task created ${id}`);

	for (let attempt = 1; attempt <= pollAttempts(); attempt += 1) {
		const summary = await getSummary(id);
		const progress = summary?.crawl_progress || 'unknown';
		const status = summary?.crawl_status;
		logger.info(
			`crawl: DataForSEO ${progress} attempt ${attempt}/${pollAttempts()} crawled=${status?.pages_crawled ?? 0} queue=${status?.pages_in_queue ?? 0}`
		);

		if (progress === 'finished') {
			const pages = await getPages(id);
			const links = pages
				.map((page) => page.url)
				.filter((url): url is string => Boolean(url))
				.filter((url) => url !== urlObj.href && url !== urlObj.href.replace(/\/$/, ''));
			return {
				id,
				homepage: pages.find((page) => page.url === urlObj.href)?.url || urlObj.href,
				links,
				pages
			};
		}

		await sleep(pollIntervalMs());
	}

	throw new Error('DataForSEO crawl did not finish before timeout.');
}

function pageTitle(page: DataForSEOPage) {
	return page.meta?.title || page.meta?.meta_title || '';
}

function pageDescription(page: DataForSEOPage) {
	return page.meta?.description || '';
}

function h1Headings(page: DataForSEOPage) {
	return page.meta?.htags?.h1 || [];
}

function isProductLikePage(page: DataForSEOPage) {
	return /\/products?\//i.test(new URL(page.url || 'https://example.com').pathname);
}

function isFaqLikePage(page: DataForSEOPage) {
	return /\/faqs?(\/|$)|frequently-asked-questions/i.test(
		new URL(page.url || 'https://example.com').pathname
	);
}

export function analyzeDataForSEOHomePage(
	urlObj: URL,
	crawl: DataForSEOCrawl,
	summary: AuditSummary
) {
	const organizationSchema = createListResult();
	const unlinkedBlog = createListResult();
	const homepage = crawl.pages.find((page) => page.url === crawl.homepage) || crawl.pages[0];
	const hasStructuredData = Boolean(homepage?.checks?.has_micromarkup);
	const detectedBlogUrl = crawl.links.find((link) => {
		try {
			return /^\/(blog|blogs|articles|news)(\/|$)/i.test(new URL(link).pathname);
		} catch {
			return false;
		}
	});

	if (detectedBlogUrl) {
		addItem(summary, unlinkedBlog, 'pass', 'Blog detected in crawled links', {
			title: detectedBlogUrl,
			page_url: detectedBlogUrl
		});
	}

	addItem(
		summary,
		organizationSchema,
		hasStructuredData ? 'pass' : 'warn',
		hasStructuredData ? 'Structured data found' : 'Missing Organization Schema',
		{ title: urlObj.href, page_url: urlObj.href }
	);

	return { organizationSchema, unlinkedBlog };
}

export function analyzeDataForSEOPages(crawl: DataForSEOCrawl, summary: AuditSummary) {
	const missingH1Tags = createListResult();
	const multipleH1Tags = createListResult();
	const metaTitleIssues = createListResult();
	const duplicatePageTitles = createListResult();
	const duplicateMetaDescriptions = createListResult();
	const overlyLongMetaDescriptions = createListResult();
	const imageAltTags = createListResult();
	const shopifyUrls = createListResult();
	const productSchema = createListResult();
	const faqSchema = createListResult();

	const titleMap = new Map<string, string[]>();
	const descriptionMap = new Map<string, string[]>();

	for (const page of crawl.pages) {
		if (!page.url || page.status_code && page.status_code >= 400) continue;
		const title = pageTitle(page).trim();
		const metaDescription = pageDescription(page).trim();
		const h1s = h1Headings(page).map((heading) => heading.trim());
		const emptyH1 = h1s.filter((heading) => !heading).length;

		if (h1s.length === 0 || page.checks?.no_h1_tag) {
			addItem(summary, missingH1Tags, 'warn', 'Missing H1 tag', {
				title: page.url,
				page_url: page.url
			});
		} else if (h1s.length > 1 || emptyH1 > 0) {
			addItem(summary, multipleH1Tags, 'warn', 'Multiple H1 tags found', {
				title: `${page.url} (${h1s.length} H1 tags)`,
				page_url: page.url,
				meta: { headings: h1s }
			});
		}

		if (!title) {
			addItem(summary, metaTitleIssues, 'warn', 'Missing meta title', {
				title: page.url,
				page_url: page.url
			});
		} else if (title.length > 60) {
			addItem(summary, metaTitleIssues, 'warn', 'Meta title too long', {
				title: `${page.url} (${title.length} chars)`,
				page_url: page.url,
				value: `${title.length} chars: ${title}`
			});
		}

		if (metaDescription.length > 160) {
			addItem(summary, overlyLongMetaDescriptions, 'warn', 'Meta description too long', {
				title: `${page.url} (${metaDescription.length} chars)`,
				page_url: page.url,
				value: `${metaDescription.length} chars: ${metaDescription}`
			});
		}

		if (page.checks?.no_image_alt) {
			addItem(summary, imageAltTags, 'warn', 'Image missing alt text', {
				title: page.url,
				page_url: page.url
			});
		} else if ((page.meta?.images_count || 0) > 0) {
			addItem(summary, imageAltTags, 'pass', 'All images include alt text', { title: page.url });
		}

		const pagePath = new URL(page.url).pathname;
		const shopifyPattern = /^\/collections\/[^/]+\/products\/[^/]+\/?$/i.test(pagePath);
		addItem(
			summary,
			shopifyUrls,
			shopifyPattern ? 'warn' : 'pass',
			shopifyPattern ? 'Shopify URL pattern detected' : 'No Shopify URL pattern detected',
			{ title: page.url }
		);

		if (isProductLikePage(page)) {
			addItem(
				summary,
				productSchema,
				page.checks?.has_micromarkup ? 'pass' : 'warn',
				page.checks?.has_micromarkup ? 'Product schema found' : 'Missing product schema',
				{ title: page.url, page_url: page.url }
			);
		}

		if (isFaqLikePage(page)) {
			addItem(
				summary,
				faqSchema,
				page.checks?.has_micromarkup ? 'pass' : 'warn',
				page.checks?.has_micromarkup ? 'FAQ Schema found' : 'Missing FAQ Schema',
				{ title: page.url, page_url: page.url }
			);
		}

		if (title) titleMap.set(title, [...(titleMap.get(title) || []), page.url]);
		if (metaDescription) {
			descriptionMap.set(metaDescription, [...(descriptionMap.get(metaDescription) || []), page.url]);
		}
	}

	for (const [title, pages] of titleMap.entries()) {
		if (pages.length <= 1) continue;
		for (const page of pages) {
			addItem(summary, duplicatePageTitles, 'warn', 'Duplicate meta title detected', {
				title: page,
				page_url: page,
				meta: { duplicateValue: title, duplicateCount: pages.length }
			});
		}
	}

	for (const [description, pages] of descriptionMap.entries()) {
		if (pages.length <= 1) continue;
		for (const page of pages) {
			addItem(summary, duplicateMetaDescriptions, 'warn', 'Duplicate meta description detected', {
				title: page,
				page_url: page,
				meta: { duplicateValue: description, duplicateCount: pages.length }
			});
		}
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
		shopifyUrls
	};
}
