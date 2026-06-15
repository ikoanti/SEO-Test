import {
	analyzeDataForSEOHomePage,
	analyzeDataForSEOPages,
	analyzeDataForSEORobots,
	collectDataForSEOCrawl,
	createDataForSEOCrawlTask,
	type DataForSEOCrawl,
	isDataForSEOConfigured,
	isDataForSEORateLimitError,
	isDataForSEOCrawlTaskReady
} from './checks/dataforseo-onpage';
import { analyzePageSpeed } from './checks/pagespeed';
import { analyzeLlmsTxt } from './checks/robots';
import { cloneAuditSnapshot, createLogger, createSummary, normalizeUrl, runStep } from './shared';

export { isDataForSEORateLimitError };

type AuditHandlers = {
	onStepStart?: (label: string) => Promise<void> | void;
	onStepComplete?: (label: string, partialAudit: Record<string, unknown>) => Promise<void> | void;
};

export async function submitDataForSEOCrawlTask(inputUrl: string) {
	const urlObj = normalizeUrl(inputUrl);
	if (!isDataForSEOConfigured()) throw new Error('DATAFORSEO_API_KEY is not configured.');
	return createDataForSEOCrawlTask(urlObj);
}

export async function isSubmittedDataForSEOCrawlReady(taskId: string) {
	if (!isDataForSEOConfigured()) throw new Error('DATAFORSEO_API_KEY is not configured.');
	return isDataForSEOCrawlTaskReady(taskId);
}

export async function collectSubmittedDataForSEOCrawl(inputUrl: string, taskId: string) {
	const urlObj = normalizeUrl(inputUrl);
	const logger = createLogger(urlObj.hostname);
	if (!isDataForSEOConfigured()) throw new Error('DATAFORSEO_API_KEY is not configured.');
	return collectDataForSEOCrawl(urlObj, taskId, logger);
}

export async function runAuditAfterDataForSEOCrawl(
	inputUrl: string,
	dataForSEOCrawl: DataForSEOCrawl,
	handlers: AuditHandlers = {}
) {
	const urlObj = normalizeUrl(inputUrl);
	const logger = createLogger(urlObj.hostname);

	const summary = createSummary();
	const auditedAt = new Date().toISOString();
	const partialAudit: Record<string, unknown> = {
		domain: urlObj.hostname,
		auditedAt,
		summary,
		crawl: {
			homepage: urlObj.href,
			discoveredLinks: []
		}
	};

	const notifyStepStart = async (label: string) => {
		if (typeof handlers.onStepStart === 'function') {
			await handlers.onStepStart(label);
		}
	};

	const notifyStepComplete = async (label: string) => {
		if (typeof handlers.onStepComplete === 'function') {
			await handlers.onStepComplete(label, cloneAuditSnapshot(partialAudit));
		}
	};

	const links = dataForSEOCrawl.links;
	partialAudit.crawl = {
		homepage: urlObj.href,
		discoveredLinks: links
	};
	await notifyStepComplete('crawl');

	await notifyStepStart('homepage');
	const homeResults = await runStep(logger, 'homepage', async () =>
		analyzeDataForSEOHomePage(urlObj, dataForSEOCrawl, summary)
	);
	Object.assign(partialAudit, homeResults);
	await notifyStepComplete('homepage');

	await notifyStepStart('robots');
	const robotsTxt = await runStep(logger, 'robots', () =>
		analyzeDataForSEORobots(dataForSEOCrawl, summary)
	);
	partialAudit.robotsTxt = robotsTxt;
	const llmsTxt = await runStep(logger, 'llms.txt', () =>
		analyzeLlmsTxt(urlObj.origin, summary, logger)
	);
	partialAudit.llmsTxt = llmsTxt;
	await notifyStepComplete('robots');

	await notifyStepStart('page-analysis');
	const pageResults = await runStep(logger, 'page-analysis', () =>
		analyzeDataForSEOPages(dataForSEOCrawl, summary)
	);
	Object.assign(partialAudit, pageResults);
	await notifyStepComplete('page-analysis');

	await notifyStepStart('pagespeed');
	const pageSpeed = await runStep(logger, 'pagespeed', () =>
		analyzePageSpeed(urlObj.href, summary, logger)
	);
	partialAudit.pageSpeed = pageSpeed;
	await notifyStepComplete('pagespeed');

	return {
		domain: urlObj.hostname,
		auditedAt,
		summary,
		crawl: {
			homepage: urlObj.href,
			discoveredLinks: links
		},
		pageSpeed,
		robotsTxt,
		llmsTxt,
		...homeResults,
		...pageResults
	};
}

export async function runAudit(inputUrl: string, taskId: string, handlers: AuditHandlers = {}) {
	const dataForSEOCrawl = await collectSubmittedDataForSEOCrawl(inputUrl, taskId);
	return runAuditAfterDataForSEOCrawl(inputUrl, dataForSEOCrawl, handlers);
}
