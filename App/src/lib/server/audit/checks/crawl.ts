import type { AuditLogger } from '../shared';
import { extractInternalLinks, fetchRobotsPolicy, fetchText, loadDocument } from '../shared';

export async function gatherPages(urlObj: URL, logger: AuditLogger) {
	const robotsPolicy = await fetchRobotsPolicy(urlObj.origin, logger);
	const queue = [urlObj.href];
	const seen = new Set([urlObj.href, urlObj.href.replace(/\/$/, '')]);
	const links = [];
	let homepageHtml = null;
	let fetched = 0;

	while (queue.length > 0 && links.length < 50) {
		const currentUrl = queue.shift();
		if (!currentUrl) continue;
		const isSubmittedUrl =
			currentUrl === urlObj.href || currentUrl === urlObj.href.replace(/\/$/, '');
		if (!isSubmittedUrl && !robotsPolicy.isAllowed(currentUrl)) {
			logger.info(`crawl: skipped robots-disallowed URL ${currentUrl}`);
			continue;
		}
		fetched += 1;

		try {
			const response = await fetchText(currentUrl);
			if (currentUrl === urlObj.href) homepageHtml = response.data;
			const $ = loadDocument(response.data);
			const found = extractInternalLinks($, currentUrl, urlObj.origin);

			for (const link of found) {
				if (!robotsPolicy.isAllowed(link)) continue;
				const normalized = link.replace(/\/$/, '');
				if (seen.has(link) || seen.has(normalized)) continue;
				seen.add(link);
				seen.add(normalized);
				links.push(link);
				queue.push(link);
				if (links.length >= 50) break;
			}

			if (fetched === 1 || fetched % 5 === 0 || links.length >= 50 || queue.length === 0) {
				logger.info(
					`crawl: fetched ${fetched} page(s), discovered ${links.length}, queue ${queue.length}`
				);
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			logger.warn(`crawl: failed to fetch ${currentUrl} (${message})`);
		}
	}

	return { homepageHtml, links };
}
