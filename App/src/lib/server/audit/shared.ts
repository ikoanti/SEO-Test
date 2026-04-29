import axios from 'axios';
import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';

export type AuditFindingStatus = 'pass' | 'warn' | 'info';
export type AuditSummary = { passed: number; warnings: number; info: number };
export type AuditListResult = {
	items: Array<Record<string, unknown> & { status?: AuditFindingStatus; detail: string }>;
	stats: string;
};
export type AuditLogger = {
	info(message: string): void;
	warn(message: string): void;
};
export type RobotsPolicy = {
	isAllowed(url: string): boolean;
	sitemap: string | null;
};
type FetchTextOptions = {
	timeout?: number;
	maxRedirects?: number;
	validateStatus?: (status: number) => boolean;
	headers?: Record<string, string>;
};

export const USER_AGENT =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
export const COMMON_SITEMAPS = ['/sitemap.xml', '/sitemap_index.xml', '/sitemap.xml.gz'];
export const AI_BOTS = [
	'GPTBot',
	'Google-Extended',
	'Anthropic-AI',
	'FacebookBot',
	'Applebot-Extended',
	'CCBot',
	'Bytespider'
];
export const SEARCH_BOTS = ['Googlebot', 'Bingbot', 'Yandex', 'DuckDuckBot', 'Baidu'];

export function createSummary(): AuditSummary {
	return { passed: 0, warnings: 0, info: 0 };
}

export function createListResult(): AuditListResult {
	return { items: [], stats: '' };
}

export function addItem(
	summary: AuditSummary,
	list: AuditListResult,
	status: AuditFindingStatus,
	detail: string,
	extra: Record<string, unknown> = {}
) {
	if (status === 'pass') summary.passed += 1;
	if (status === 'warn') summary.warnings += 1;
	if (status === 'info') summary.info += 1;
	list.items.push({ status, detail, ...extra });
}

export function createLogger(context: string): AuditLogger {
	return {
		info(message) {
			console.log(`[audit:${context}] ${message}`);
		},
		warn(message) {
			console.warn(`[audit:${context}] ${message}`);
		}
	};
}

export function durationMs(start: number) {
	return `${Date.now() - start}ms`;
}

export async function runStep<T>(
	logger: AuditLogger,
	label: string,
	fn: () => Promise<T> | T
): Promise<T> {
	const start = Date.now();
	logger.info(`${label}: started`);
	try {
		const result = await fn();
		logger.info(`${label}: finished in ${durationMs(start)}`);
		return result;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		logger.warn(`${label}: failed after ${durationMs(start)} (${message})`);
		throw error;
	}
}

export function normalizeUrl(input: string) {
	const value = String(input || '').trim();
	if (!value) throw new Error('url is required');
	const normalized = /^https?:\/\//i.test(value) ? value : `https://${value}`;
	const url = new URL(normalized);
	if (!['http:', 'https:'].includes(url.protocol))
		throw new Error('Only http and https URLs are supported');
	return url;
}

export async function fetchText(url: string, options: FetchTextOptions = {}) {
	const response = await axios.get(url, {
		timeout: options.timeout || 10000,
		maxRedirects: options.maxRedirects ?? 5,
		validateStatus: options.validateStatus || ((status) => status >= 200 && status < 400),
		responseType: 'text',
		headers: {
			'User-Agent': USER_AGENT,
			...options.headers
		}
	});

	return {
		status: response.status,
		headers: response.headers,
		data: typeof response.data === 'string' ? response.data : String(response.data || '')
	};
}

function escapeRegex(value: string) {
	return value.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
}

function robotsPatternMatches(pattern: string, path: string) {
	if (!pattern) return false;
	const anchored = pattern.endsWith('$');
	const normalizedPattern = anchored ? pattern.slice(0, -1) : pattern;
	const regex = new RegExp(
		`^${normalizedPattern.split('*').map(escapeRegex).join('.*')}${anchored ? '$' : ''}`
	);
	return regex.test(path);
}

function agentMatches(agent: string, userAgent: string) {
	const normalizedAgent = agent.trim().toLowerCase();
	if (!normalizedAgent) return false;
	if (normalizedAgent === '*') return true;
	return userAgent.toLowerCase().includes(normalizedAgent);
}

export function parseRobotsPolicy(text: string, userAgent = USER_AGENT): RobotsPolicy {
	type RobotsRule = { directive: 'allow' | 'disallow'; pattern: string };
	type RobotsGroup = { agents: string[]; rules: RobotsRule[] };

	const groups: RobotsGroup[] = [];
	let current: RobotsGroup = { agents: [], rules: [] };
	let sitemap: string | null = null;

	const flush = () => {
		if (current.agents.length || current.rules.length) groups.push(current);
		current = { agents: [], rules: [] };
	};

	for (const rawLine of text.split(/\r?\n/)) {
		const line = rawLine.replace(/#.*/, '').trim();
		if (!line) continue;

		const separatorIndex = line.indexOf(':');
		if (separatorIndex === -1) continue;

		const field = line.slice(0, separatorIndex).trim().toLowerCase();
		const value = line.slice(separatorIndex + 1).trim();

		if (field === 'sitemap' && value) {
			sitemap = value;
			continue;
		}

		if (field === 'user-agent') {
			if (current.rules.length) flush();
			current.agents.push(value);
			continue;
		}

		if ((field === 'allow' || field === 'disallow') && current.agents.length) {
			current.rules.push({ directive: field, pattern: value });
		}
	}

	flush();

	const matchingGroups = groups.filter((group) =>
		group.agents.some((agent) => agentMatches(agent, userAgent))
	);
	const specificGroups = matchingGroups.filter((group) =>
		group.agents.some((agent) => agent.trim() !== '*')
	);
	const applicableRules = (specificGroups.length ? specificGroups : matchingGroups).flatMap(
		(group) => group.rules
	);

	return {
		sitemap,
		isAllowed(url: string) {
			let path: string;
			try {
				const parsed = new URL(url);
				path = `${parsed.pathname || '/'}${parsed.search || ''}`;
			} catch {
				path = url || '/';
			}

			let winner: RobotsRule | null = null;
			for (const rule of applicableRules) {
				if (rule.directive === 'disallow' && rule.pattern === '') continue;
				if (!robotsPatternMatches(rule.pattern, path)) continue;
				if (!winner || rule.pattern.length > winner.pattern.length) {
					winner = rule;
				} else if (winner.pattern.length === rule.pattern.length && rule.directive === 'allow') {
					winner = rule;
				}
			}

			return winner?.directive !== 'disallow';
		}
	};
}

export async function fetchRobotsPolicy(origin: string, logger?: AuditLogger) {
	try {
		const response = await fetchText(`${origin}/robots.txt`, {
			validateStatus: (status) => status >= 200 && status < 500
		});
		if (response.status >= 400) return parseRobotsPolicy('');
		return parseRobotsPolicy(response.data);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		logger?.warn(`robots: policy fetch failed (${message})`);
		return parseRobotsPolicy('');
	}
}

export function loadDocument(html: string): cheerio.CheerioAPI {
	return cheerio.load(html);
}

export function extractInternalLinks(
	$: cheerio.CheerioAPI,
	baseUrl: string,
	origin: string
): string[] {
	const seen = new Set<string>();

	$('a[href]').each((_: number, element: AnyNode) => {
		const href = $(element).attr('href');
		if (!href || /^(javascript:|mailto:|tel:|#)/i.test(href)) return;

		try {
			const resolved = new URL(href, baseUrl);
			if (resolved.origin !== origin) return;
			if (resolved.search) return;
			if (/\.(png|jpe?g|gif|webp|svg|ico|bmp|tiff|pdf|mp4|webm)$/i.test(resolved.pathname)) return;
			seen.add(resolved.href.split('#')[0]);
		} catch {
			return;
		}
	});

	seen.delete(baseUrl);
	seen.delete(baseUrl.replace(/\/$/, ''));
	return Array.from(seen);
}

export function cloneAuditSnapshot<T>(value: T): T {
	return JSON.parse(JSON.stringify(value));
}
