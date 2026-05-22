import { analyzeHomePage } from './checks/homepage';
import { gatherPages } from './checks/crawl';
import {
	analyzeDataForSEOHomePage,
	analyzeDataForSEOPages,
	isDataForSEOConfigured,
	runDataForSEOCrawl
} from './checks/dataforseo-onpage';
import { analyzeMetaAndHeadings } from './checks/page-analysis';
import { analyzePageSpeed } from './checks/pagespeed';
import { analyzeLlmsTxt, analyzeRobots } from './checks/robots';
import {
	cloneAuditSnapshot,
	createLogger,
	createSummary,
	fetchText,
	loadDocument,
	normalizeUrl,
	runStep
} from './shared';

type AuditHandlers = {
	onStepStart?: (label: string) => Promise<void> | void;
	onStepComplete?: (label: string, partialAudit: Record<string, unknown>) => Promise<void> | void;
};

function alternateWwwUrl(url: URL) {
	if (!url.hostname.includes('.') || /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)) return null;

	const alternate = new URL(url.href);
	alternate.hostname = /^www\./i.test(url.hostname)
		? url.hostname.replace(/^www\./i, '')
		: `www.${url.hostname}`;
	return alternate;
}

function canRetryWithAlternateHost(error: unknown) {
	if (!(error instanceof Error)) return false;
	const code = String((error as Error & { code?: unknown }).code || '');
	return (
		code === 'ENOTFOUND' ||
		code === 'ECONNREFUSED' ||
		code === 'ETIMEDOUT' ||
		code === 'ECONNABORTED' ||
		/ENOTFOUND|ECONNREFUSED|timed? out/i.test(error.message)
	);
}

async function resolveAuditUrl(inputUrl: string) {
	const primary = normalizeUrl(inputUrl);
	const alternate = alternateWwwUrl(primary);
	const logger = createLogger(primary.hostname);

	try {
		await fetchText(primary.href, {
			timeout: 8000,
			validateStatus: (status) => status >= 200 && status < 500
		});
		return primary;
	} catch (error) {
		if (!alternate || !canRetryWithAlternateHost(error)) throw error;

		logger.warn(`target: ${primary.hostname} was not reachable, trying ${alternate.hostname}`);
		try {
			await fetchText(alternate.href, {
				timeout: 8000,
				validateStatus: (status) => status >= 200 && status < 500
			});
			logger.info(`target: using ${alternate.hostname}`);
			return alternate;
		} catch (alternateError) {
			if (canRetryWithAlternateHost(alternateError)) {
				throw new Error(
					`Neither ${primary.hostname} nor ${alternate.hostname} could be reached. Check that the domain is spelled correctly and that DNS is configured for at least one version.`,
					{ cause: alternateError }
				);
			}
			throw alternateError;
		}
	}
}

export async function runAudit(inputUrl: string, handlers: AuditHandlers = {}) {
	const urlObj = await resolveAuditUrl(inputUrl);
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

	await notifyStepStart('crawl');
	let dataForSEOCrawl: Awaited<ReturnType<typeof runDataForSEOCrawl>> | null = null;
	let homepageHtml: string | null = null;
	let links: string[] = [];
	try {
		const crawlResult = await runStep(logger, 'crawl', () => gatherPages(urlObj, logger));
		homepageHtml = crawlResult.homepageHtml;
		links = crawlResult.links;
	} catch (error) {
		if (!isDataForSEOConfigured()) throw error;

		const message = error instanceof Error ? error.message : String(error);
		logger.warn(`crawl: manual crawler failed, falling back to DataForSEO (${message})`);
		dataForSEOCrawl = await runStep(logger, 'crawl:dataforseo', () =>
			runDataForSEOCrawl(urlObj, logger)
		);
		links = dataForSEOCrawl.links;
	}
	partialAudit.crawl = {
		homepage: urlObj.href,
		discoveredLinks: links
	};
	await notifyStepComplete('crawl');

	await notifyStepStart('homepage');
	const homeResults = dataForSEOCrawl
		? await runStep(logger, 'homepage', async () =>
				analyzeDataForSEOHomePage(urlObj, dataForSEOCrawl, summary)
			)
		: await (async () => {
				const homepageResponse = homepageHtml ?? (await fetchText(urlObj.href)).data;
				const $ = loadDocument(homepageResponse);
				return runStep(logger, 'homepage', async () =>
					analyzeHomePage(urlObj, $, summary, logger, links)
				);
			})();
	Object.assign(partialAudit, homeResults);
	await notifyStepComplete('homepage');

	await notifyStepStart('robots');
	const { result: robotsTxt } = await runStep(logger, 'robots', () =>
		analyzeRobots(urlObj.origin, summary, logger)
	);
	partialAudit.robotsTxt = robotsTxt;
	const llmsTxt = await runStep(logger, 'llms.txt', () =>
		analyzeLlmsTxt(urlObj.origin, summary, logger)
	);
	partialAudit.llmsTxt = llmsTxt;
	await notifyStepComplete('robots');

	await notifyStepStart('page-analysis');
	const pageResults = dataForSEOCrawl
		? await runStep(logger, 'page-analysis', () => analyzeDataForSEOPages(dataForSEOCrawl, summary))
		: await runStep(logger, 'page-analysis', () =>
				analyzeMetaAndHeadings([urlObj.href, ...links], summary, logger)
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
