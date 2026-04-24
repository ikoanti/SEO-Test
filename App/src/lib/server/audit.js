// @ts-nocheck
import axios from 'axios';
import * as cheerio from 'cheerio';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const COMMON_SITEMAPS = ['/sitemap.xml', '/sitemap_index.xml', '/sitemap.xml.gz'];
const AI_BOTS = ['GPTBot', 'Google-Extended', 'Anthropic-AI', 'FacebookBot', 'Applebot-Extended', 'CCBot', 'Bytespider'];
const SEARCH_BOTS = ['Googlebot', 'Bingbot', 'Yandex', 'DuckDuckBot', 'Baidu'];

function createSummary() {
  return { passed: 0, warnings: 0, failed: 0 };
}

function createListResult() {
  return { items: [], stats: '' };
}

function addItem(summary, list, status, detail, extra = {}) {
  if (status === 'ok') summary.passed += 1;
  if (status === 'warn') summary.warnings += 1;
  if (status === 'err') summary.failed += 1;
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
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only http and https URLs are supported');
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
        logger.info(`crawl: fetched ${fetched} page(s), discovered ${links.length}, queue ${queue.length}`);
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
      timeout: 20000,
      params: { url: targetUrl, strategy, key: apiKey }
    });
    const audits = response.data?.lighthouseResult?.audits || {};
    const score = Math.round((response.data?.lighthouseResult?.categories?.performance?.score || 0) * 100);

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
    const [mobile, desktop] = await Promise.all([fetchStrategy('mobile'), fetchStrategy('desktop')]);
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
    result.pageRank = entry?.page_rank_decimal != null ? Number(entry.page_rank_decimal).toFixed(2) : 'N/A';
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

    if (robotsSitemap) addItem(summary, result, 'ok', 'Sitemap Reference Found', { title: robotsSitemap });
    else addItem(summary, result, 'warn', 'Missing Sitemap Reference');

    SEARCH_BOTS.forEach((bot) => {
      const botLow = bot.toLowerCase();
      const blocked = lines.some((line, index) => {
        if (!line.startsWith('user-agent:') || (!line.includes(botLow) && line !== 'user-agent: *')) return false;
        for (let i = index + 1; i < lines.length; i += 1) {
          if (lines[i].startsWith('user-agent:')) break;
          if (lines[i] === 'disallow: /' || lines[i] === 'disallow: /*') return true;
        }
        return false;
      });

      addItem(summary, result, blocked ? 'err' : 'ok', blocked ? `${bot} is Blocked` : `${bot} Allowed`);
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
        addItem(summary, result, 'err', `${bot} Blocked`, { category: 'ai' });
      } else if (found) {
        addItem(summary, result, 'ok', `${bot} Allowed`, { category: 'ai' });
      } else {
        aiIssues += 1;
        addItem(summary, result, 'warn', `${bot} Not Specified`, { category: 'ai' });
      }
    });

    result.stats = aiIssues > 0 ? `${aiIssues} AI issue(s) found` : 'robots.txt configuration looks good.';
  } catch (error) {
    logger.warn(`robots: failed (${error.message})`);
    addItem(summary, result, 'err', 'robots.txt not found or unavailable.');
  }

  return { result, robotsSitemap };
}

async function analyzeSitemap(origin, robotsSitemap, summary, logger) {
  const result = createListResult();
  const candidates = [...new Set([robotsSitemap, ...COMMON_SITEMAPS.map((path) => `${origin}${path}`)].filter(Boolean))];
  let foundAny = false;

  for (const candidate of candidates) {
    try {
      logger.info(`sitemap: probing ${candidate}`);
      const response = await fetchText(candidate);
      if (!response.data.includes('<urlset') && !response.data.includes('<sitemapindex')) continue;
      const urls = (response.data.match(/<url>/g) || []).length;
      const maps = (response.data.match(/<sitemap>/g) || []).length;
      addItem(summary, result, 'ok', `Found at ${new URL(candidate).pathname}`, {
        title: maps > 0 ? `Sitemap index with ${maps} child sitemap(s).` : `${urls} URL entr${urls === 1 ? 'y' : 'ies'}.`
      });
      foundAny = true;
    } catch (error) {
      logger.warn(`sitemap: probe failed for ${candidate} (${error.message})`);
    }
  }

  if (!foundAny) addItem(summary, result, 'err', 'No Sitemap Found');
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
  addItem(summary, structuredData, schemaScripts > 0 ? 'ok' : 'warn', schemaScripts > 0 ? 'JSON-LD Found' : 'No JSON-LD Found', { title: `${schemaScripts} JSON-LD block(s)` });

  addItem(summary, webIcons, $('link[rel*="icon"]').length ? 'ok' : 'err', $('link[rel*="icon"]').length ? 'Favicon Found' : 'Missing Favicon');
  addItem(summary, webIcons, $('link[rel="apple-touch-icon"]').length ? 'ok' : 'warn', $('link[rel="apple-touch-icon"]').length ? 'Apple Touch Icon Found' : 'Missing Apple Touch Icon');

  addItem(summary, ssl, urlObj.protocol === 'https:' ? 'ok' : 'err', urlObj.protocol === 'https:' ? 'SSL Enabled' : 'SSL Missing');
  const viewportOk = (($('meta[name="viewport"]').attr('content') || '').includes('width=device-width'));
  addItem(summary, mobileUsability, viewportOk ? 'ok' : 'err', viewportOk ? 'Mobile Viewport Configured' : 'Viewport Missing');

  const flashCount = $('object, embed').toArray().filter((element) => {
    const type = ($(element).attr('type') || '').toLowerCase();
    const src = (($(element).attr('src') || '') + ($(element).attr('data') || '')).toLowerCase();
    return type.includes('application/x-shockwave-flash') || src.includes('.swf');
  }).length;
  addItem(summary, flash, flashCount > 0 ? 'err' : 'ok', flashCount > 0 ? 'Flash Usage Detected' : 'No Flash Found', { title: flashCount > 0 ? `${flashCount} Flash element(s) found.` : '' });

  const charset = $('meta[charset]').attr('charset') || '';
  addItem(summary, charsetResult, charset ? (charset.toLowerCase() === 'utf-8' || charset.toLowerCase() === 'utf8' ? 'ok' : 'warn') : 'err', charset ? `Encoding set to ${charset.toLowerCase()}` : 'Missing Charset Meta Tag');

  const bodyText = $('body').text().toLowerCase();
  addItem(summary, loremIpsum, bodyText.includes('lorem ipsum') ? 'err' : 'ok', bodyText.includes('lorem ipsum') ? 'Dummy Text Detected' : 'No Dummy Text');

  const missingOg = ['og:title', 'og:description', 'og:image'].filter((tag) => {
    const value = $(`meta[property="${tag}"]`).attr('content') || $(`meta[name="${tag}"]`).attr('content');
    return !value;
  });
  addItem(summary, openGraph, missingOg.length === 0 ? 'ok' : missingOg.length < 3 ? 'warn' : 'err', missingOg.length === 0 ? 'OpenGraph Verified' : missingOg.length < 3 ? 'Partial OpenGraph Tags' : 'No OpenGraph Tags Found', { title: missingOg.length ? `Missing: ${missingOg.join(', ')}` : '' });

  addItem(summary, internationalDomains, $('html').attr('lang') ? 'ok' : 'err', $('html').attr('lang') ? 'HTML Lang Attribute' : 'Missing HTML Lang Attribute');
  addItem(summary, internationalDomains, $('link[rel="alternate"][hreflang]').length ? 'ok' : 'warn', $('link[rel="alternate"][hreflang]').length ? 'Hreflang Tags Found' : 'No Hreflang Tags');

  const linkTexts = $('a').toArray().map((element) => ($(element).text() || '').toLowerCase().trim());
  addItem(summary, trustSignals, linkTexts.some((text) => text.includes('privacy')) ? 'ok' : 'warn', linkTexts.some((text) => text.includes('privacy')) ? 'Privacy Policy Link Found' : 'Privacy Policy Link Missing');
  addItem(summary, trustSignals, linkTexts.some((text) => text.includes('terms') || text.includes('conditions')) ? 'ok' : 'warn', linkTexts.some((text) => text.includes('terms') || text.includes('conditions')) ? 'Terms Link Found' : 'Terms Link Missing');

  const images = $('img').toArray();
  const lazyImages = images.filter((element) => ($(element).attr('loading') || '').toLowerCase() === 'lazy').length;
  addItem(summary, lazyLoadImages, images.length === 0 || lazyImages === images.length ? 'ok' : 'warn', images.length === 0 ? 'No Images Found' : lazyImages === images.length ? 'Images Use Lazy Loading' : lazyImages > 0 ? 'Partial Lazy Loading' : 'Lazy Loading Missing', { title: images.length ? `${lazyImages}/${images.length} image(s) lazy-loaded.` : '' });

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

async function analyzeSitewide(urlObj, links, summary, logger) {
  const pages = [urlObj.href, ...links].slice(0, 50);
  const h1Tags = createListResult();
  const metaTitles = createListResult();
  const imageAltTags = createListResult();
  const canonicalUrls = createListResult();
  const security = createListResult();
  const mixedContent = createListResult();
  const contentQuality = createListResult();
  const titles = [];
  let scanned = 0;

  logger.info(`sitewide: scanning ${pages.length} page(s)`);

  for (const pageUrl of pages) {
    try {
      const response = await fetchText(pageUrl);
      const $ = loadDocument(response.data);
      scanned += 1;

      const h1Count = $('h1').length;
      if (h1Count === 0) addItem(summary, h1Tags, 'err', 'Missing H1', { url: pageUrl });
      else if (h1Count > 1) addItem(summary, h1Tags, 'warn', 'Multiple H1', { title: `Found ${h1Count} H1 tags`, url: pageUrl });

      titles.push({ url: pageUrl, title: $('title').first().text().trim() });

      if (pageUrl.startsWith('https://')) addItem(summary, security, 'ok', 'Secure URL', { url: pageUrl });
      else addItem(summary, security, 'err', 'Insecure (HTTP)', { url: pageUrl });

      const insecureAssets = $('img[src^="http://"], script[src^="http://"], link[rel="stylesheet"][href^="http://"], iframe[src^="http://"]').length;
      if (pageUrl.startsWith('https://') && insecureAssets > 0) addItem(summary, mixedContent, 'err', `Mixed Content: ${insecureAssets} insecure asset(s)`, { url: pageUrl });

      const wordCount = $('body').text().replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).length;
      if (wordCount < 300) addItem(summary, contentQuality, 'warn', `Thin Content (${wordCount} words)`, { url: pageUrl });

      const images = $('img').toArray();
      const missingAlt = images.filter((image) => {
        const alt = $(image).attr('alt');
        return alt == null || alt === '';
      }).length;
      if (missingAlt > 0) addItem(summary, imageAltTags, 'err', `${missingAlt} Missing/Empty Alt Tags`, { url: pageUrl });

      const canonicals = $('link[rel="canonical"]').length;
      if (canonicals === 0) addItem(summary, canonicalUrls, 'err', 'Missing Canonical Tag', { url: pageUrl });
      else if (canonicals > 1) addItem(summary, canonicalUrls, 'warn', `Multiple Canonicals (${canonicals})`, { url: pageUrl });

      if (scanned === 1 || scanned % 5 === 0 || scanned === pages.length) {
        logger.info(`sitewide: processed ${scanned}/${pages.length}`);
      }
    } catch (error) {
      logger.warn(`sitewide: failed for ${pageUrl} (${error.message})`);
    }
  }

  const titleCounts = titles.reduce((acc, item) => {
    if (item.title) acc[item.title] = (acc[item.title] || 0) + 1;
    return acc;
  }, {});

  titles.forEach((item) => {
    if (!item.title) addItem(summary, metaTitles, 'err', 'Missing Title', { url: item.url });
    else if (titleCounts[item.title] > 1) addItem(summary, metaTitles, 'err', 'Duplicate Title', { title: item.title, url: item.url });
    else if (item.title.length > 60) addItem(summary, metaTitles, 'warn', `Too Long (${item.title.length} chars)`, { title: item.title, url: item.url });
    else if (item.title.length < 30) addItem(summary, metaTitles, 'warn', `Too Short (${item.title.length} chars)`, { title: item.title, url: item.url });
  });

  h1Tags.stats = `Scanned ${pages.length} page${pages.length === 1 ? '' : 's'}`;
  metaTitles.stats = `Scanned ${titles.length} page${titles.length === 1 ? '' : 's'}`;
  imageAltTags.stats = `Scanned images across ${pages.length} page${pages.length === 1 ? '' : 's'}`;
  canonicalUrls.stats = `Scanned ${pages.length} page${pages.length === 1 ? '' : 's'}`;
  security.stats = `Scanned ${pages.length} page${pages.length === 1 ? '' : 's'}`;
  mixedContent.stats = `Scanned ${pages.length} page${pages.length === 1 ? '' : 's'}`;
  contentQuality.stats = `Scanned ${pages.length} page${pages.length === 1 ? '' : 's'}`;

  if (h1Tags.items.length === 0) addItem(summary, h1Tags, 'ok', 'All pages have a single H1');
  if (metaTitles.items.length === 0) addItem(summary, metaTitles, 'ok', 'All titles look good');
  if (imageAltTags.items.length === 0) addItem(summary, imageAltTags, 'ok', 'All images have alt text');
  if (canonicalUrls.items.length === 0) addItem(summary, canonicalUrls, 'ok', 'All pages have valid canonicals');
  if (!security.items.some((item) => item.detail === 'Insecure (HTTP)')) addItem(summary, security, 'ok', 'All pages are secure (HTTPS)');
  if (mixedContent.items.length === 0) addItem(summary, mixedContent, 'ok', 'No mixed content found');
  if (contentQuality.items.length === 0) addItem(summary, contentQuality, 'ok', 'All pages have sufficient content');

  return { h1Tags, metaTitles, imageAltTags, canonicalUrls, security, mixedContent, contentQuality };
}

async function analyzeInternalLinks(links, summary, logger) {
  const result = createListResult();
  let broken = 0;
  const sample = links.slice(0, 50);
  let checked = 0;

  logger.info(`internal-links: checking ${sample.length} link(s)`);

  for (const url of sample) {
    try {
      const response = await axios.get(url, {
        timeout: 8000,
        validateStatus: () => true,
        headers: { 'User-Agent': USER_AGENT }
      });
      if (response.status >= 400) {
        broken += 1;
        addItem(summary, result, 'err', `HTTP ${response.status}`, { url });
      }
    } catch {
      broken += 1;
      addItem(summary, result, 'err', 'Request failed', { url });
    }

    checked += 1;
    if (checked === 1 || checked % 10 === 0 || checked === sample.length) {
      logger.info(`internal-links: checked ${checked}/${sample.length}, broken ${broken}`);
    }
  }

  result.totalLinks = String(links.length);
  result.brokenLinks = String(broken);
  if (broken === 0) addItem(summary, result, 'ok', `No broken links found (sampled ${Math.min(links.length, 50)})`);
  return result;
}

function analyzeShopifyUrls(links, summary, logger) {
  logger.info('shopify-urls: analyzing URL patterns');
  const result = createListResult();
  const unoptimized = links.filter((link) => link.includes('/collections/') && link.includes('/products/'));
  if (unoptimized.length > 0) addItem(summary, result, 'warn', 'Unoptimized Shopify URLs Found', { title: `${unoptimized.length} URL(s) contain both /collections/ and /products/.` });
  else addItem(summary, result, 'ok', 'URL Structure Looks Good');
  return result;
}

async function runAudit(inputUrl) {
  const urlObj = normalizeUrl(inputUrl);
  const summary = createSummary();
  const logger = createLogger(urlObj.hostname);
  const totalStart = Date.now();

  logger.info(`request started for ${urlObj.href}`);

  const { homepageHtml, links } = await runStep(logger, 'crawl', () => gatherPages(urlObj, logger));
  if (!homepageHtml) throw new Error('Could not fetch homepage HTML');

  const $ = loadDocument(homepageHtml);

  const [pageSpeed, openPageRank, robotsBundle, sitewide, internalLinks] = await Promise.all([
    runStep(logger, 'pagespeed', () => analyzePageSpeed(urlObj.href, summary, logger)),
    runStep(logger, 'openpagerank', () => analyzeOpenPageRank(urlObj.hostname, logger)),
    runStep(logger, 'robots', () => analyzeRobots(urlObj.origin, summary, logger)),
    runStep(logger, 'sitewide', () => analyzeSitewide(urlObj, links, summary, logger)),
    runStep(logger, 'internal-links', () => analyzeInternalLinks(links, summary, logger))
  ]);

  const sitemap = await runStep(logger, 'sitemap', () => analyzeSitemap(urlObj.origin, robotsBundle.robotsSitemap, summary, logger));
  const homePageChecks = await runStep(logger, 'homepage', () => Promise.resolve(analyzeHomePage(urlObj, $, summary, logger)));
  const shopifyUrls = await runStep(logger, 'shopify-urls', () => Promise.resolve(analyzeShopifyUrls(links, summary, logger)));

  logger.info(`request finished in ${durationMs(totalStart)}`);

  return {
    domain: urlObj.hostname,
    auditedAt: new Date().toISOString(),
    crawl: {
      homepage: urlObj.href,
      pagesDiscovered: links.length,
      pagesScanned: Math.min(links.length + 1, 50)
    },
    summary,
    pageSpeed,
    openPageRank,
    h1Tags: sitewide.h1Tags,
    metaTitles: sitewide.metaTitles,
    imageAltTags: sitewide.imageAltTags,
    canonicalUrls: sitewide.canonicalUrls,
    internalLinks,
    sitemap,
    robotsTxt: robotsBundle.result,
    llmsTxt: createListResult(),
    structuredData: homePageChecks.structuredData,
    security: sitewide.security,
    mixedContent: sitewide.mixedContent,
    contentQuality: sitewide.contentQuality,
    webIcons: homePageChecks.webIcons,
    ssl: homePageChecks.ssl,
    mobileUsability: homePageChecks.mobileUsability,
    flash: homePageChecks.flash,
    charset: homePageChecks.charset,
    loremIpsum: homePageChecks.loremIpsum,
    openGraph: homePageChecks.openGraph,
    shopifyUrls,
    internationalDomains: homePageChecks.internationalDomains,
    trailingSlash: createListResult(),
    wwwResolve: createListResult(),
    trustSignals: homePageChecks.trustSignals,
    lazyLoadImages: homePageChecks.lazyLoadImages,
    aiVisibility: {
      score: '-',
      monthlyAudience: '-',
      mentions: '-',
      citedPages: '-',
      performingTopics: '-',
      topicOpportunities: '-',
      citedSources: '-',
      sourceOpportunities: '-'
    }
  };
}

export { runAudit };
