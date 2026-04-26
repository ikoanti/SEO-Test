import { captureRobotsEvidence } from '$lib/server/audit-capture';
import type { AuditLogger, AuditSummary } from '../shared';
import { addItem, AI_BOTS, createListResult, fetchText, SEARCH_BOTS } from '../shared';

export async function analyzeRobots(origin: string, summary: AuditSummary, logger: AuditLogger) {
	const result = createListResult();
	let robotsSitemap = null;

	try {
		logger.info('robots: fetching robots.txt');
		const response = await fetchText(`${origin}/robots.txt`);
		const text = response.data;
		const lines = text.split('\n').map((line) => line.trim().toLowerCase());
		const foundAgents = text
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter((line) => /^user-agent:/i.test(line))
			.map((line) => line.split(':', 2)[1]?.trim())
			.filter((value): value is string => Boolean(value));
		robotsSitemap = text.match(/^sitemap:\s*(.+)$/im)?.[1]?.trim() || null;

		if (robotsSitemap)
			addItem(summary, result, 'pass', 'Sitemap Reference Found', { title: robotsSitemap });
		else addItem(summary, result, 'warn', 'Missing Sitemap Reference');

		SEARCH_BOTS.forEach((bot) => {
			const botLow = bot.toLowerCase();
			const blocked = lines.some((line, index) => {
				if (!line.startsWith('user-agent:') || (!line.includes(botLow) && line !== 'user-agent: *'))
					return false;
				for (let i = index + 1; i < lines.length; i += 1) {
					if (lines[i].startsWith('user-agent:')) break;
					if (lines[i] === 'disallow: /' || lines[i] === 'disallow: /*') return true;
				}
				return false;
			});

			addItem(
				summary,
				result,
				blocked ? 'fail' : 'pass',
				blocked ? `${bot} is Blocked` : `${bot} Allowed`
			);
		});

		let aiIssues = 0;
		AI_BOTS.forEach((bot) => {
			const botLow = bot.toLowerCase();
			let found = false;
			let blocked = false;

			for (let index = 0; index < lines.length; index += 1) {
				if (!lines[index].startsWith('user-agent:') || !lines[index].includes(botLow)) continue;
				found = true;
				for (let i = index + 1; i < lines.length; i += 1) {
					if (lines[i].startsWith('user-agent:')) break;
					if (lines[i] === 'disallow: /' || lines[i] === 'disallow: /*') blocked = true;
				}
				break;
			}

			if (found && blocked) {
				aiIssues += 1;
				addItem(summary, result, 'fail', `${bot} Blocked`, { category: 'ai' });
			} else if (found) {
				addItem(summary, result, 'pass', `${bot} Allowed`, { category: 'ai' });
			} else {
				aiIssues += 1;
				addItem(summary, result, 'warn', `${bot} Not Specified`, { category: 'ai' });
			}
		});

		if (aiIssues > 0) {
			try {
				const capture = await captureRobotsEvidence({
					domain: new URL(origin).hostname,
					robotsUrl: `${origin}/robots.txt`,
					storefrontUrl: `${origin}/`,
					foundAgents
				});
				const firstAiIssue = result.items.find(
					(item) => item.category === 'ai' && (item.status === 'warn' || item.status === 'fail')
				);
				if (capture && firstAiIssue) {
					firstAiIssue.meta = {
						...((firstAiIssue.meta as Record<string, unknown> | undefined) || {}),
						screenshot: capture
					};
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				logger.warn(`robots: evidence capture failed (${message})`);
			}
		}

		result.stats =
			aiIssues > 0 ? `${aiIssues} AI issue(s) found` : 'robots.txt configuration looks good.';
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		logger.warn(`robots: failed (${message})`);
		addItem(summary, result, 'fail', 'robots.txt not found or unavailable.');
	}

	return { result, robotsSitemap };
}
