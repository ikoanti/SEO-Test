import type { AuditLogger, AuditSummary } from '../shared';
import { addItem, COMMON_SITEMAPS, createListResult, fetchText } from '../shared';

export async function analyzeSitemap(
	origin: string,
	robotsSitemap: string | null,
	summary: AuditSummary,
	logger: AuditLogger
) {
	const result = createListResult();
	const candidates = [
		...new Set(
			[robotsSitemap, ...COMMON_SITEMAPS.map((path) => `${origin}${path}`)].filter(Boolean)
		)
	];
	let foundAny = false;

	for (const candidate of candidates) {
		if (!candidate) continue;
		try {
			logger.info(`sitemap: probing ${candidate}`);
			const response = await fetchText(candidate);
			if (!response.data.includes('<urlset') && !response.data.includes('<sitemapindex')) continue;
			const urls = (response.data.match(/<url>/g) || []).length;
			const maps = (response.data.match(/<sitemap>/g) || []).length;
			addItem(summary, result, 'pass', `Found at ${new URL(candidate).pathname}`, {
				title:
					maps > 0
						? `Sitemap index with ${maps} child sitemap(s).`
						: `${urls} URL entr${urls === 1 ? 'y' : 'ies'}.`
			});
			foundAny = true;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			logger.warn(`sitemap: probe failed for ${candidate} (${message})`);
		}
	}

	if (!foundAny) addItem(summary, result, 'fail', 'No Sitemap Found');
	return result;
}
