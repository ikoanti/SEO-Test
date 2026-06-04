import {
	analyzeDataForSEOHomePage,
	analyzeDataForSEOLlmsTxt,
	analyzeDataForSEOPages,
	analyzeDataForSEORobots,
	isDataForSEOConfigured,
	runDataForSEOCrawl
} from './checks/dataforseo-onpage';
import { analyzePageSpeed } from './checks/pagespeed';
import { cloneAuditSnapshot, createLogger, createSummary, normalizeUrl, runStep } from './shared';

type AuditHandlers = {
	onStepStart?: (label: string) => Promise<void> | void;
	onStepComplete?: (label: string, partialAudit: Record<string, unknown>) => Promise<void> | void;
};

export async function runAudit(inputUrl: string, handlers: AuditHandlers = {}) {
	const urlObj = normalizeUrl(inputUrl);
	const logger = createLogger(urlObj.hostname);
	if (!isDataForSEOConfigured()) throw new Error('DATAFORSEO_API_KEY is not configured.');

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

	await notifyStepStart('crawl');
	const dataForSEOCrawl = await runStep(logger, 'crawl:dataforseo', () =>
		runDataForSEOCrawl(urlObj, logger)
	);
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
	const llmsTxt = await runStep(logger, 'llms.txt', () => analyzeDataForSEOLlmsTxt(summary));
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
