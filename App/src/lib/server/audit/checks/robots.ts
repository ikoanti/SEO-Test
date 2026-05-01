import type { AuditCaptureRequest } from '$lib/server/audit-capture';
import type { AuditLogger, AuditSummary } from '../shared';
import { addItem, AI_BOTS, createListResult, fetchText, SEARCH_BOTS } from '../shared';

function attachScreenshotRequest(
	item: Record<string, unknown> | undefined,
	request: AuditCaptureRequest
) {
	if (!item) return;
	item.meta = {
		...((item.meta as Record<string, unknown> | undefined) || {}),
		screenshotRequest: request
	};
}

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
				blocked ? 'warn' : 'pass',
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
				addItem(summary, result, 'warn', `${bot} Blocked`, { category: 'ai' });
			} else if (found) {
				addItem(summary, result, 'pass', `${bot} Allowed`, { category: 'ai' });
			} else {
				aiIssues += 1;
				addItem(summary, result, 'warn', `${bot} Not Specified`, { category: 'ai' });
			}
		});

		if (aiIssues > 0) {
			const aiIssueEntries = result.items
				.filter((item) => item.category === 'ai' && item.status === 'warn')
				.map((item) => ({
					issue: item.detail,
					status: item.status
				}));

			attachScreenshotRequest(
				result.items.find(
					(item) => item.category === 'ai' && item.status === 'warn'
				),
				{
					kind: 'robots',
					reportTemplateKey: 'ai-chatbots-llms-not-whitelisted',
					title: 'AI Chatbots/LLMs Not Whitelisted',
					domain: new URL(origin).hostname,
					robotsUrl: `${origin}/robots.txt`,
					storefrontUrl: `${origin}/`,
					foundAgents,
					entries: aiIssueEntries,
					count: aiIssueEntries.length
				}
			);
		}

		result.stats =
			aiIssues > 0 ? `${aiIssues} AI issue(s) found` : 'robots.txt configuration looks good.';
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		logger.warn(`robots: failed (${message})`);
		addItem(summary, result, 'warn', 'robots.txt not found or unavailable.');
	}

	return { result, robotsSitemap };
}

export async function analyzeLlmsTxt(origin: string, summary: AuditSummary, logger: AuditLogger) {
	const result = createListResult();
	const candidates = [`${origin}/.well-known/llms.txt`, `${origin}/llms.txt`];

	for (const url of candidates) {
		try {
			logger.info(`llms.txt: fetching ${url}`);
			const response = await fetchText(url, {
				validateStatus: (status) => status >= 200 && status < 500
			});
			const text = response.data.trim();

			if (response.status >= 200 && response.status < 300 && text) {
				addItem(summary, result, 'pass', 'LLMs.txt found', {
					title: url,
					page_url: url,
					meta: {
						status: response.status,
						bytes: response.data.length
					}
				});
				result.stats = `Found at ${url}`;
				return result;
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			logger.warn(`llms.txt: failed ${url} (${message})`);
		}
	}

	addItem(summary, result, 'warn', 'LLMs.txt not found', {
		title: candidates.join(', '),
		page_url: candidates[0],
		meta: { checkedUrls: candidates }
	});
	result.stats = 'LLMs.txt not found.';
	return result;
}
