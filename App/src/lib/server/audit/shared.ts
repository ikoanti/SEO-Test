import axios from 'axios';
import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';

export type AuditFindingStatus = 'pass' | 'warn' | 'fail' | 'info';
export type AuditSummary = { passed: number; warnings: number; failed: number };
export type AuditListResult = {
	items: Array<Record<string, unknown> & { status?: AuditFindingStatus; detail: string }>;
	stats: string;
};
export type AuditLogger = {
	info(message: string): void;
	warn(message: string): void;
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
	return { passed: 0, warnings: 0, failed: 0 };
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
	if (status === 'fail') summary.failed += 1;
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
