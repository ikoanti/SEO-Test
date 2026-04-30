import { analyzeHomePage } from './checks/homepage';
import { gatherPages } from './checks/crawl';
import { analyzeMetaAndHeadings } from './checks/page-analysis';
import { analyzePageSpeed } from './checks/pagespeed';
import { analyzeRobots } from './checks/robots';
import { analyzeSitemap } from './checks/sitemap';
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

export async function runAudit(inputUrl: string, handlers: AuditHandlers = {}) {
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

	await notifyStepStart('crawl');
	const { homepageHtml, links } = await runStep(logger, 'crawl', () => gatherPages(urlObj, logger));
	partialAudit.crawl = {
		homepage: urlObj.href,
		discoveredLinks: links
	};
	await notifyStepComplete('crawl');

	const homepageResponse = homepageHtml ?? (await fetchText(urlObj.href)).data;
	const $ = loadDocument(homepageResponse);

	await notifyStepStart('homepage');
	const homeResults = await runStep(logger, 'homepage', async () =>
		analyzeHomePage(urlObj, $, summary, logger, links)
	);
	Object.assign(partialAudit, homeResults);
	await notifyStepComplete('homepage');

	await notifyStepStart('robots');
	const { result: robotsTxt, robotsSitemap } = await runStep(logger, 'robots', () =>
		analyzeRobots(urlObj.origin, summary, logger)
	);
	partialAudit.robotsTxt = robotsTxt;
	await notifyStepComplete('robots');

	await notifyStepStart('sitemap');
	const sitemap = await runStep(logger, 'sitemap', () =>
		analyzeSitemap(urlObj.origin, robotsSitemap, summary, logger)
	);
	partialAudit.sitemap = sitemap;
	await notifyStepComplete('sitemap');

	await notifyStepStart('page-analysis');
	const pageResults = await runStep(logger, 'page-analysis', () =>
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
		sitemap,
		...homeResults,
		...pageResults
	};
}
