// @ts-nocheck
import axios from 'axios';
import * as cheerio from 'cheerio';

const USER_AGENT =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const COMMON_SITEMAPS = ['/sitemap.xml', '/sitemap_index.xml', '/sitemap.xml.gz'];
const AI_BOTS = [
	'GPTBot',
	'Google-Extended',
	'Anthropic-AI',
	'FacebookBot',
	'Applebot-Extended',
	'CCBot',
	'Bytespider'
];
const SEARCH_BOTS = ['Googlebot', 'Bingbot', 'Yandex', 'DuckDuckBot', 'Baidu'];

function createSummary() {
	return { passed: 0, warnings: 0, failed: 0 };
}

function createListResult() {
	return { items: [], stats: '' };
}

function addItem(summary, list, status, detail, extra = {}) {
	if (status === 'pass') summary.passed += 1;
	if (status === 'warn') summary.warnings += 1;
	if (status === 'fail') summary.failed += 1;
	list.items.push({ status, detail, ...extra });
}

function createLogger(context) {
	return {
		info(message) {
			console.log(`[audit:${context}] ${message}`);
		},
		warn(message) {
			console.warn(`[audit:${context}] ${message}`);
		}
	};
}

function durationMs(start) {
	return `${Date.now() - start}ms`;
}

async function runStep(logger, label, fn) {
	const start = Date.now();
	logger.info(`${label}: started`);
	try {
		const result = await fn();
		logger.info(`${label}: finished in ${durationMs(start)}`);
		return result;
	} catch (error) {
		logger.warn(`${label}: failed after ${durationMs(start)} (${error.message})`);
		throw error;
	}
}

function normalizeUrl(input) {
	const value = String(input || '').trim();
	if (!value) throw new Error('url is required');
	const normalized = /^https?:\/\//i.test(value) ? value : `https://${value}`;
	const url = new URL(normalized);
	if (!['http:', 'https:'].includes(url.protocol))
		throw new Error('Only http and https URLs are supported');
	return url;
}

async function fetchText(url, options = {}) {
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

function loadDocument(html) {
	return cheerio.load(html, { decodeEntities: false });
}

function extractInternalLinks($, baseUrl, origin) {
	const seen = new Set();

	$('a[href]').each((_, element) => {
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

async function gatherPages(urlObj, logger) {
	const queue = [urlObj.href];
	const seen = new Set([urlObj.href, urlObj.href.replace(/\/$/, '')]);
	const links = [];
	let homepageHtml = null;
	let fetched = 0;

	while (queue.length > 0 && links.length < 50) {
		const currentUrl = queue.shift();
		fetched += 1;

		try {
			const response = await fetchText(currentUrl);
			if (currentUrl === urlObj.href) homepageHtml = response.data;
			const $ = loadDocument(response.data);
			const found = extractInternalLinks($, currentUrl, urlObj.origin);

			for (const link of found) {
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
			logger.warn(`crawl: failed to fetch ${currentUrl} (${error.message})`);
		}
	}

	return { homepageHtml, links };
}

async function analyzePageSpeed(targetUrl, summary, logger) {
	const apiKey = process.env.PAGESPEED_API_KEY || 'AIzaSyDq_Fam7GNCloxDbbryv3sA8brDbZZum8I';
	const result = {
		mobile: { score: 'N/A', metrics: {} },
		desktop: { score: 'N/A', metrics: {} }
	};

	const fetchStrategy = async (strategy) => {
		logger.info(`pagespeed:${strategy}: requesting`);
		const response = await axios.get('https://www.googleapis.com/pagespeedonline/v5/runPagespeed', {
			params: { url: targetUrl, strategy, key: apiKey }
		});
		const audits = response.data?.lighthouseResult?.audits || {};
		const score = Math.round(
			(response.data?.lighthouseResult?.categories?.performance?.score || 0) * 100
		);

		if (score >= 90) summary.passed += 1;
		else if (score >= 50) summary.warnings += 1;
		else summary.failed += 1;

		logger.info(`pagespeed:${strategy}: score ${score}`);
		return {
			score,
			metrics: {
				FCP: audits['first-contentful-paint']?.displayValue || 'N/A',
				LCP: audits['largest-contentful-paint']?.displayValue || 'N/A',
				CLS: audits['cumulative-layout-shift']?.displayValue || 'N/A',
				TBT: audits['total-blocking-time']?.displayValue || 'N/A'
			}
		};
	};

	try {
		const [mobile, desktop] = await Promise.all([
			fetchStrategy('mobile'),
			fetchStrategy('desktop')
		]);
		result.mobile = mobile;
		result.desktop = desktop;
	} catch (error) {
		logger.warn(`pagespeed: fallback due to ${error.message}`);
		return result;
	}

	return result;
}

async function analyzeOpenPageRank(hostname, logger) {
	const result = { pageRank: 'N/A', globalRank: 'N/A' };
	if (!process.env.OPEN_PAGE_RANK_API_KEY) {
		logger.info('openpagerank: skipped, OPEN_PAGE_RANK_API_KEY missing');
		return result;
	}

	try {
		logger.info(`openpagerank: requesting for ${hostname}`);
		const response = await axios.get('https://openpagerank.com/api/v1.0/getPageRank', {
			timeout: 10000,
			params: { 'domains[]': hostname },
			headers: { 'API-OPR': process.env.OPEN_PAGE_RANK_API_KEY }
		});
		const entry = response.data?.response?.[0];
		result.pageRank =
			entry?.page_rank_decimal != null ? Number(entry.page_rank_decimal).toFixed(2) : 'N/A';
		result.globalRank = entry?.rank ? Number(entry.rank).toLocaleString() : 'N/A';
	} catch (error) {
		logger.warn(`openpagerank: failed (${error.message})`);
		return result;
	}

	return result;
}

async function analyzeRobots(origin, summary, logger) {
	const result = createListResult();
	let robotsSitemap = null;

	try {
		logger.info('robots: fetching robots.txt');
		const response = await fetchText(`${origin}/robots.txt`);
		const text = response.data;
		const lines = text.split('\n').map((line) => line.trim().toLowerCase());
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

		result.stats =
			aiIssues > 0 ? `${aiIssues} AI issue(s) found` : 'robots.txt configuration looks good.';
	} catch (error) {
		logger.warn(`robots: failed (${error.message})`);
		addItem(summary, result, 'fail', 'robots.txt not found or unavailable.');
	}

	return { result, robotsSitemap };
}

async function analyzeSitemap(origin, robotsSitemap, summary, logger) {
	const result = createListResult();
	const candidates = [
		...new Set(
			[robotsSitemap, ...COMMON_SITEMAPS.map((path) => `${origin}${path}`)].filter(Boolean)
		)
	];
	let foundAny = false;

	for (const candidate of candidates) {
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
			logger.warn(`sitemap: probe failed for ${candidate} (${error.message})`);
		}
	}

	if (!foundAny) addItem(summary, result, 'fail', 'No Sitemap Found');
	return result;
}

function analyzeHomePage(urlObj, $, summary, logger) {
	logger.info('homepage: analyzing single-page checks');
	const structuredData = createListResult();
	const webIcons = createListResult();
	const ssl = createListResult();
	const mobileUsability = createListResult();
	const flash = createListResult();
	const charsetResult = createListResult();
	const loremIpsum = createListResult();
	const openGraph = createListResult();
	const internationalDomains = createListResult();
	const trustSignals = createListResult();
	const lazyLoadImages = createListResult();

	const schemaScripts = $('script[type="application/ld+json"]').length;
	addItem(
		summary,
		structuredData,
		schemaScripts > 0 ? 'pass' : 'warn',
		schemaScripts > 0 ? 'JSON-LD Found' : 'No JSON-LD Found',
		{ title: `${schemaScripts} JSON-LD block(s)` }
	);

	const iconHref = $('link[rel="icon"], link[rel="shortcut icon"]').attr('href');
	addItem(
		summary,
		webIcons,
		iconHref ? 'pass' : 'warn',
		iconHref ? 'Favicon Present' : 'Favicon Missing',
		{ title: iconHref || '' }
	);

	const appleTouchHref = $('link[rel="apple-touch-icon"]').attr('href');
	addItem(
		summary,
		webIcons,
		appleTouchHref ? 'pass' : 'warn',
		appleTouchHref ? 'Apple Touch Icon Present' : 'Apple Touch Icon Missing',
		{ title: appleTouchHref || '' }
	);

	addItem(
		summary,
		ssl,
		urlObj.protocol === 'https:' ? 'pass' : 'fail',
		urlObj.protocol === 'https:' ? 'HTTPS Enabled' : 'HTTPS Not Enabled'
	);

	const viewport = $('meta[name="viewport"]').attr('content');
	addItem(
		summary,
		mobileUsability,
		viewport ? 'pass' : 'warn',
		viewport ? 'Viewport Meta Tag Present' : 'Viewport Meta Tag Missing'
	);

	addItem(
		summary,
		flash,
		$('object, embed').length > 0 ? 'warn' : 'pass',
		$('object, embed').length > 0 ? 'Legacy Flash-like embeds found' : 'No Flash embeds found'
	);

	const charset = $('meta[charset]').attr('charset');
	addItem(
		summary,
		charsetResult,
		charset ? 'pass' : 'warn',
		charset ? 'Charset Declared' : 'Charset Missing',
		{ title: charset || '' }
	);

	const bodyText = $('body').text();
	addItem(
		summary,
		loremIpsum,
		/lorem ipsum/i.test(bodyText) ? 'warn' : 'pass',
		/lorem ipsum/i.test(bodyText) ? 'Lorem Ipsum Detected' : 'No Lorem Ipsum Detected'
	);

	const ogTags = ['og:title', 'og:description', 'og:image', 'og:url'];
	ogTags.forEach((property) => {
		const content = $(`meta[property="${property}"]`).attr('content');
		addItem(
			summary,
			openGraph,
			content ? 'pass' : 'warn',
			content ? `${property} Present` : `${property} Missing`,
			{ title: content || '' }
		);
	});

	addItem(
		summary,
		internationalDomains,
		/\.[a-z]{2}$/i.test(urlObj.hostname) ? 'pass' : 'warn',
		/\.[a-z]{2}$/i.test(urlObj.hostname)
			? 'Country-code domain detected'
			: 'Generic domain detected',
		{ title: urlObj.hostname }
	);

	const trustSignalsMatches = ['refund', 'returns', 'privacy', 'terms', 'shipping'].filter((term) =>
		new RegExp(term, 'i').test(bodyText)
	);
	addItem(
		summary,
		trustSignals,
		trustSignalsMatches.length >= 3 ? 'pass' : 'warn',
		trustSignalsMatches.length >= 3 ? 'Trust signals detected' : 'Limited trust signals detected',
		{ title: trustSignalsMatches.join(', ') || 'None' }
	);

	const images = $('img').toArray();
	const lazyImages = images.filter(
		(element) => ($(element).attr('loading') || '').toLowerCase() === 'lazy'
	).length;
	const totalImages = images.length;
	const nonLazyImages = images.filter(
		(element) => ($(element).attr('loading') || '').toLowerCase() !== 'lazy'
	);

	if (totalImages === 0) {
		addItem(summary, lazyLoadImages, 'pass', 'No Images Found');
	} else if (nonLazyImages.length === 0) {
		addItem(summary, lazyLoadImages, 'pass', 'Images Use Lazy Loading', {
			title: `${lazyImages}/${totalImages} images use loading="lazy"`
		});
	} else {
		for (const element of nonLazyImages) {
			const rawSrc =
				$(element).attr('src') ||
				$(element).attr('data-src') ||
				$(element).attr('data-lazy-src') ||
				'';
			const imageUrl = (() => {
				try {
					return rawSrc ? new URL(rawSrc, urlObj.href).href : urlObj.href;
				} catch {
					return rawSrc || urlObj.href;
				}
			})();

			addItem(summary, lazyLoadImages, 'warn', 'Image missing loading="lazy"', {
				title: imageUrl
			});
		}
	}

	return {
		structuredData,
		webIcons,
		ssl,
		mobileUsability,
		flash,
		charset: charsetResult,
		loremIpsum,
		openGraph,
		internationalDomains,
		trustSignals,
		lazyLoadImages
	};
}

async function analyzeMetaAndHeadings(pages, summary, logger) {
	const h1Tags = createListResult();
	const metaTitles = createListResult();
	const imageAltTags = createListResult();
	const canonicalUrls = createListResult();
	const internalLinks = createListResult();
	const contentQuality = createListResult();
	const shopifyUrls = createListResult();

	const titleMap = new Map();
	const descriptionMap = new Map();

	for (const page of pages) {
		try {
			const response = await fetchText(page);
			const $ = loadDocument(response.data);
			const h1Count = $('h1').length;
			const emptyH1 = $('h1').filter((_, element) => !$(element).text().trim()).length;
			const title = $('title').text().trim();
			const metaDescription = $('meta[name="description"]').attr('content')?.trim() || '';
			const canonical = $('link[rel="canonical"]').attr('href') || '';
			const missingAlt = $('img').filter((_, element) => !$(element).attr('alt')?.trim()).length;
			const wordCount = $('body')
				.text()
				.replace(/\s+/g, ' ')
				.trim()
				.split(' ')
				.filter(Boolean).length;

			if (h1Count === 1 && emptyH1 === 0)
				addItem(summary, h1Tags, 'pass', 'Single H1 tag present', { title: page });
			else if (h1Count === 0) addItem(summary, h1Tags, 'fail', 'Missing H1 tag', { title: page });
			else
				addItem(
					summary,
					h1Tags,
					'warn',
					emptyH1 > 0 ? 'Empty or multiple H1 tags found' : 'Multiple H1 tags found',
					{ title: `${page} (${h1Count} H1 tags)` }
				);

			if (title.length === 0)
				addItem(summary, metaTitles, 'fail', 'Missing meta title', { title: page });
			else if (title.length > 60)
				addItem(summary, metaTitles, 'warn', 'Meta title too long', {
					title: `${page} (${title.length} chars)`
				});
			else addItem(summary, metaTitles, 'pass', 'Meta title looks good', { title });

			if (metaDescription.length > 160)
				addItem(summary, metaTitles, 'warn', 'Meta description too long', {
					title: `${page} (${metaDescription.length} chars)`
				});
			if (missingAlt > 0)
				addItem(summary, imageAltTags, 'warn', 'Images missing alt text', {
					title: `${page} (${missingAlt} images)`
				});
			else addItem(summary, imageAltTags, 'pass', 'All images include alt text', { title: page });

			addItem(
				summary,
				canonicalUrls,
				canonical ? 'pass' : 'warn',
				canonical ? 'Canonical URL present' : 'Canonical URL missing',
				{ title: canonical || page }
			);

			const sameOriginLinks = extractInternalLinks($, page, new URL(page).origin);
			addItem(
				summary,
				internalLinks,
				sameOriginLinks.length > 0 ? 'pass' : 'warn',
				sameOriginLinks.length > 0 ? 'Internal links found' : 'No crawlable internal links found',
				{ title: `${page} (${sameOriginLinks.length} links)` }
			);

			addItem(
				summary,
				contentQuality,
				wordCount >= 250 ? 'pass' : 'warn',
				wordCount >= 250 ? 'Content length looks reasonable' : 'Thin content detected',
				{ title: `${page} (${wordCount} words)` }
			);

			addItem(
				summary,
				shopifyUrls,
				/\/collections\/|\/products\//.test(page) ? 'warn' : 'pass',
				/\/collections\/|\/products\//.test(page)
					? 'Shopify URL pattern detected'
					: 'No Shopify URL pattern detected',
				{ title: page }
			);

			if (title) {
				const pagesForTitle = titleMap.get(title) || [];
				pagesForTitle.push(page);
				titleMap.set(title, pagesForTitle);
			}
			if (metaDescription) {
				const pagesForDescription = descriptionMap.get(metaDescription) || [];
				pagesForDescription.push(page);
				descriptionMap.set(metaDescription, pagesForDescription);
			}
		} catch (error) {
			logger.warn(`page-analysis: failed for ${page} (${error.message})`);
		}
	}

	for (const [title, pagesForTitle] of titleMap.entries()) {
		if (pagesForTitle.length > 1) {
			addItem(summary, metaTitles, 'warn', 'Duplicate meta title detected', {
				title: `${title} (${pagesForTitle.length} pages)`
			});
		}
	}

	for (const [description, pagesForDescription] of descriptionMap.entries()) {
		if (pagesForDescription.length > 1) {
			addItem(summary, metaTitles, 'warn', 'Duplicate meta description detected', {
				title: `${description.slice(0, 80)}${description.length > 80 ? '…' : ''} (${pagesForDescription.length} pages)`
			});
		}
	}

	return {
		h1Tags,
		metaTitles,
		imageAltTags,
		canonicalUrls,
		internalLinks,
		contentQuality,
		shopifyUrls
	};
}

function cloneAuditSnapshot(value) {
	return JSON.parse(JSON.stringify(value));
}

export async function runAudit(inputUrl, handlers = {}) {
	const urlObj = normalizeUrl(inputUrl);
	const logger = createLogger(urlObj.hostname);
	const summary = createSummary();
	const auditedAt = new Date().toISOString();
	const partialAudit = {
		domain: urlObj.hostname,
		auditedAt,
		summary,
		crawl: {
			homepage: urlObj.href,
			discoveredLinks: []
		}
	};

	const notifyStepStart = async (label) => {
		if (typeof handlers.onStepStart === 'function') {
			await handlers.onStepStart(label);
		}
	};

	const notifyStepComplete = async (label) => {
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
		analyzeHomePage(urlObj, $, summary, logger)
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

	await notifyStepStart('openpagerank');
	const openPageRank = await runStep(logger, 'openpagerank', () =>
		analyzeOpenPageRank(urlObj.hostname, logger)
	);
	partialAudit.openPageRank = openPageRank;
	await notifyStepComplete('openpagerank');

	return {
		domain: urlObj.hostname,
		auditedAt,
		summary,
		crawl: {
			homepage: urlObj.href,
			discoveredLinks: links
		},
		pageSpeed,
		openPageRank,
		robotsTxt,
		sitemap,
		...homeResults,
		...pageResults
	};
}
