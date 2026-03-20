document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('audit-btn');
    const input = document.getElementById('url-input');
    const results = document.getElementById('results-container');
    const errorMsg = document.getElementById('error-message');
    const statusMsg = document.getElementById('status-msg');
    const btnText = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.spinner');

    // ── Download Snippet Image Logic ──
    document.addEventListener('click', async (e) => {
        const downloadBtn = e.target.closest('.download-snippet-btn');
        if (!downloadBtn) return;
        
        const listItem = downloadBtn.closest('li');
        if (!listItem || typeof html2canvas === 'undefined') {
            console.error('Missing html2canvas or list item');
            return;
        }

        // Hide button during capture so it doesn't show in the screenshot
        downloadBtn.style.display = 'none';
        
        try {
            const canvas = await html2canvas(listItem, {
                backgroundColor: '#131a21', // Match the card background color
                scale: 2 // High resolution export
            });
            
            const link = document.createElement('a');
            link.download = 'seo-issue-snippet.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (err) {
            console.error('Failed to save snippet as image:', err);
        } finally {
            downloadBtn.style.display = '';
        }
    });

    // ── Scroll to Top Button Logic ──
    const scrollTopBtn = document.getElementById('scroll-top-btn');
    if (scrollTopBtn) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 400) {
                scrollTopBtn.classList.add('show');
            } else {
                scrollTopBtn.classList.remove('show');
            }
        });
        scrollTopBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            btn.click();
        }
    });

    btn.addEventListener('click', async () => {
        const urlStr = input.value.trim();
        if (!urlStr) return;

        let url;
        try {
            url = new URL(urlStr.startsWith('http') ? urlStr : `https://${urlStr}`);
        } catch (e) {
            showError("Please enter a valid URL.");
            return;
        }

        window.auditSummary = { passed: 0, warnings: 0, failed: 0 };

        startLoading();
        clearResults();

        try {
            // ── Step 1: Fetch homepage HTML and gather strictly 50 pages ──
            setStatus("Gathering pages to scan (strictly 50)…");
            let homepageDoc = null;
            let internalLinks = [];

            try {
                const html = await fetchViaProxy(url.href);
                const parser = new DOMParser();
                homepageDoc = parser.parseFromString(html, 'text/html');

                // Deep crawl to ensure we get strictly 50 pages if possible
                const seen = new Set([url.href, url.href.replace(/\/$/, '')]);
                const queue = [url.href];
                let crawlIndex = 0;

                // Initial links from homepage
                internalLinks = extractInternalLinks(homepageDoc, url.href, url.origin);
                internalLinks.forEach(l => { seen.add(l); seen.add(l.replace(/\/$/, '')); queue.push(l); });

                while (crawlIndex < queue.length && internalLinks.length < 500) { // Gather a larger pool first
                    const currentUrl = queue[crawlIndex++];
                    if (currentUrl === url.href) continue;
                    try {
                        const pageHtml = await fetchViaProxy(currentUrl);
                        const pageDoc = parser.parseFromString(pageHtml, 'text/html');
                        const pageLinks = extractInternalLinks(pageDoc, currentUrl, url.origin);

                        for (const link of pageLinks) {
                            const normalized = link.split('#')[0];
                            if (!seen.has(normalized)) {
                                seen.add(normalized);
                                seen.add(normalized.replace(/\/$/, ''));
                                internalLinks.push(normalized);
                                queue.push(normalized);
                                if (internalLinks.length >= 500) break;
                            }
                        }
                    } catch (e) { }
                }
                // Randomly select exactly 50 pages from the gathered pool (if we have that many)
                internalLinks = shuffle(internalLinks).slice(0, 50);
            } catch (e) {
                console.warn("Homepage fetch / crawl failed:", e);
            }

            // ── Step 2: PageSpeed Mobile + Desktop (runs in background) ──
            setStatus("Requesting PageSpeed scores…");
            const psPromise = runPageSpeed(url.href);

            // ── Step 2.5: Website Screenshot ──
            runScreenshotCapture(url.href);

            // ── Step 2.6: Open Page Rank ──
            setStatus("Fetching Open Page Rank metrics…");
            const oprPromise = runOpenPageRankCheck(url.hostname);

            // ── Step 3: Instant homepage checks ──
            if (homepageDoc) {
                runStructuredDataCheck(homepageDoc);
                runIconsCheck(homepageDoc);
                runSslCheck(url);
                runMobileUsabilityCheck(homepageDoc);
                runFlashCheck(homepageDoc);
                runIframesCheck(homepageDoc);
                runCharsetCheck(homepageDoc);
                runLoremIpsumCheck(homepageDoc);
                runOpenGraphCheck(homepageDoc);
                runIntlDomainsCheck(homepageDoc);
                runTrustSignalsCheck(homepageDoc);
                runLazyLoadImagesCheck(homepageDoc);
                runMobileTapTargetsCheck(homepageDoc);
            } else {
                setCardError('schema-list', "Could not fetch homepage HTML.");
                setCardError('icons-list', "Could not fetch homepage HTML.");
                setCardError('ssl-list', "Could not fetch homepage HTML.");
                setCardError('mobile-usability-list', "Could not fetch homepage HTML.");
                setCardError('flash-list', "Could not fetch homepage HTML.");
                setCardError('iframes-list', "Could not fetch homepage HTML.");
                setCardError('charset-list', "Could not fetch homepage HTML.");
                setCardError('lorem-list', "Could not fetch homepage HTML.");
                setCardError('opengraph-list', "Could not fetch homepage HTML.");
                setCardError('intl-list', "Could not fetch homepage HTML.");
                setCardError('trust-list', "Could not fetch homepage HTML.");
                setCardError('lazy-load-list', "Could not fetch homepage HTML.");
                setCardError('tap-targets-list', "Could not fetch homepage HTML.");
            }

            // ── Step 4: robots.txt → llms.txt → sitemap (sequential) ──
            setStatus("Checking robots.txt…");
            const robotsSitemap = await runRobotsTxtInspector(url.origin);

            setStatus("Checking llms.txt…");
            await runLlmsTxtInspector(url.origin);

            setStatus("Checking sitemap.xml…");
            await runSitemapInspector(url.origin, robotsSitemap);

            // ── Step 5: Site-wide scan (H1 + Meta Titles across 50 pages strictly) ──
            setStatus(`Scanning pages for H1 & Meta Title issues (0 of ${Math.min(internalLinks.length + 1, 50)})…`);
            await runSitewideScan(url.href, internalLinks, (done, total) => {
                setStatus(`Scanning pages for H1 & Meta Title issues (${done} of ${total})…`);
            });

            // ── Step 6: Internal link checker (sample 50) ──
            setStatus("Checking for broken internal links…");
            await runInternalLinkCheck(internalLinks);

            // ── Step 7: Shopify URL Structure Check ──
            setStatus("Checking Shopify URL structure…");
            runShopifyUrlCheck(internalLinks);

            // ── Step 8: Architecture & Redirect Checks ──
            setStatus("Checking URL resolutions…");
            const redirectPromise = runRedirectChecks(url);

            // ── Wait for Async Tasks ──
            await Promise.all([psPromise, oprPromise, redirectPromise]);

            renderSummary();
            setStatus("Audit complete!");
            showResults();
        } catch (err) {
            showError("Audit failed: " + err.message);
        } finally {
            stopLoading();
        }
    });


    // ═══════════════════════════════════════
    //  UI Helpers
    // ═══════════════════════════════════════

    function startLoading() {
        btn.disabled = true;
        btnText.classList.add('hidden');
        spinner.classList.remove('hidden');
        results.classList.add('hidden');
        const summaryBar = document.getElementById('summary-bar');
        if (summaryBar) summaryBar.classList.add('hidden');
        errorMsg.classList.add('hidden');
        statusMsg.classList.remove('hidden');
    }

    function stopLoading() {
        btn.disabled = false;
        btnText.classList.remove('hidden');
        spinner.classList.add('hidden');
        setTimeout(() => statusMsg.classList.add('hidden'), 2000);
    }

    function showResults() {
        results.classList.remove('hidden');
        const summaryBar = document.getElementById('summary-bar');
        if (summaryBar) summaryBar.classList.remove('hidden');
    }
    function showError(msg) { errorMsg.textContent = msg; errorMsg.classList.remove('hidden'); }
    function setStatus(msg) { statusMsg.textContent = msg; }

    function renderSummary() {
        const total = window.auditSummary.passed + window.auditSummary.warnings + window.auditSummary.failed;
        const sp = document.getElementById('summary-passed');
        const sw = document.getElementById('summary-warnings');
        const sf = document.getElementById('summary-failed');
        if (sp) sp.textContent = window.auditSummary.passed;
        if (sw) sw.textContent = window.auditSummary.warnings;
        if (sf) sf.textContent = window.auditSummary.failed;

        const bar = document.getElementById('summary-score-bar');
        if (bar && total > 0) {
            const passedPct = (window.auditSummary.passed / total) * 100;
            const warnPct = (window.auditSummary.warnings / total) * 100;
            const failedPct = (window.auditSummary.failed / total) * 100;
            bar.style.background = `linear-gradient(to right, 
                var(--success) 0%, var(--success) ${passedPct}%, 
                var(--warning) ${passedPct}%, var(--warning) ${passedPct + warnPct}%, 
                var(--danger) ${passedPct + warnPct}%, var(--danger) 100%)`;
        } else if (bar) {
            bar.style.background = 'transparent';
        }
    }

    function clearResults() {
        ['speed-mobile', 'speed-desktop'].forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.textContent = '--'; el.className = 'metric-circle'; }
        });
        ['speed-details-mobile', 'speed-details-desktop'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '';
        });
        ['h1-list', 'h1-stats', 'titles-list', 'titles-stats',
            'alt-list', 'alt-stats', 'canonical-list', 'canonical-stats', 'sitemap-list',
            'ai-list', 'llms-list', 'schema-list', 'broken-links-list', 'mixed-content-list', 'mixed-content-stats',
            'security-list', 'security-stats', 'content-list', 'content-stats', 'icons-list',
            'ssl-list', 'mobile-usability-list', 'flash-list', 'iframes-list',
            'charset-list', 'lorem-list', 'opengraph-list', 'shopify-list', 'intl-list',
            'trailing-slash-list', 'www-resolve-list', 'trust-list', 'tap-targets-list', 'lazy-load-list'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = '';
            });
        ['h1-subtitle', 'titles-subtitle', 'alt-subtitle',
            'canonical-subtitle', 'security-subtitle', 'content-subtitle', 'mixed-content-subtitle'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.textContent = 'Scanning exactly 50 pages…';
            });

        const aiSub = document.getElementById('ai-subtitle');
        if (aiSub) aiSub.textContent = 'Analyzing robots.txt patterns';
        const totalLinks = document.getElementById('total-links');
        if (totalLinks) totalLinks.textContent = '0';
        const brokenLinks = document.getElementById('broken-links');
        if (brokenLinks) brokenLinks.textContent = '0';
        
        const tapSub = document.getElementById('tap-targets-subtitle');
        if (tapSub) tapSub.textContent = 'Analyzing DOM heuristics';
        
        const tapList = document.getElementById('tap-targets-list');
        if (tapList) tapList.innerHTML = '<li><div class="check-detail">Checking Mobile Tap Targets…</div></li>';

        const sImg = document.getElementById('screenshot-img');
        const sPlace = document.getElementById('screenshot-placeholder');
        if (sImg) {
            sImg.src = '';
            sImg.classList.add('hidden');
        }
        if (sPlace) sPlace.classList.remove('hidden');

        // Open Page Rank Clear
        ['opr-page-rank', 'opr-global-rank'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '-';
        });
        const oprList = document.getElementById('opr-list');
        if (oprList) oprList.innerHTML = '';

        ['summary-passed', 'summary-warnings', 'summary-failed'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '0';
        });
        const bar = document.getElementById('summary-score-bar');
        if (bar) bar.style.background = 'transparent';
    }

    function setCardError(listId, msg) {
        const el = document.getElementById(listId);
        if (el) el.innerHTML = li('err', msg, '');
    }

    // ═══════════════════════════════════════
    //  Proxy Fetch (3-proxy waterfall + timeout)
    // ═══════════════════════════════════════

    function withTimeout(promise, ms) {
        return Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error("Timed out")), ms))
        ]);
    }

    async function fetchViaProxy(url) {
        const enc = encodeURIComponent(url);
        try {
            const res = await withTimeout(fetch(`/api/proxy?url=${enc}`), 10000);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.text();
        } catch (e) {
            console.error("Proxy Error:", e.message);
            throw e;
        }
    }

    // ═══════════════════════════════════════
    //  Internal Link Extractor
    // ═══════════════════════════════════════

    function extractInternalLinks(doc, baseUrl, origin) {
        const seen = new Set();
        Array.from(doc.querySelectorAll('a[href]')).forEach(a => {
            const href = a.getAttribute('href');
            if (!href || /^(javascript|mailto|tel|#)/.test(href)) return;
            try {
                const resolved = new URL(href, baseUrl);
                if (resolved.origin === origin) {
                    // Exclude image and media files
                    if (/\.(png|jpe?g|gif|webp|svg|ico|bmp|tiff|pdf|mp4|webm)$/i.test(resolved.pathname)) return;

                    // Exclude URLs with parameters
                    if (resolved.search) return;

                    seen.add(resolved.href.split('#')[0]);
                }
            } catch (e) { }
        });
        seen.delete(baseUrl);
        seen.delete(baseUrl.replace(/\/$/, ''));
        return Array.from(seen);
    }

    function shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    // ═══════════════════════════════════════
    //  1. PageSpeed (Mobile + Desktop)
    // ═══════════════════════════════════════

    async function runPageSpeed(url) {
        const key = "AIzaSyDq_Fam7GNCloxDbbryv3sA8brDbZZum8I";
        const fetchScore = async (strategy) => {
            const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}&key=${key}`);
            const data = await res.json();

            const audits = data.lighthouseResult?.audits || {};
            return {
                score: Math.round((data.lighthouseResult?.categories?.performance?.score || 0) * 100),
                fcp: audits['first-contentful-paint']?.displayValue || 'N/A',
                lcp: audits['largest-contentful-paint']?.displayValue || 'N/A',
                cls: audits['cumulative-layout-shift']?.displayValue || 'N/A',
                tbt: audits['total-blocking-time']?.displayValue || 'N/A',
                tapTargets: audits['tap-targets']
            };
        };
        try {
            const [mobile, desktop] = await Promise.all([fetchScore('mobile'), fetchScore('desktop')]);
            [['mobile', mobile], ['desktop', desktop]].forEach(([type, data]) => {
                const el = document.getElementById(`speed-${type}`);
                const score = data.score;
                el.textContent = score;
                el.className = 'metric-circle ' + (score >= 90 ? 'good' : score >= 50 ? 'needs-improvement' : 'poor');

                if (score >= 90) window.auditSummary.passed++;
                else if (score >= 50) window.auditSummary.warnings++;
                else window.auditSummary.failed++;

                const detailsEl = document.getElementById(`speed-details-${type}`);
                if (detailsEl) {
                    detailsEl.innerHTML = `
                        <div class="speed-metric"><span>FCP:</span> <span>${data.fcp}</span></div>
                        <div class="speed-metric"><span>LCP:</span> <span>${data.lcp}</span></div>
                        <div class="speed-metric"><span>CLS:</span> <span>${data.cls}</span></div>
                        <div class="speed-metric"><span>TBT:</span> <span>${data.tbt}</span></div>
                    `;
                }
            });
        } catch (e) {
            ['mobile', 'desktop'].forEach(t => {
                const el = document.getElementById(`speed-${t}`);
                if (el) el.textContent = 'Err';
            });
        }
    }

    // ═══════════════════════════════════════
    //  0. Screenshot Capture
    // ═══════════════════════════════════════

    function runScreenshotCapture(targetUrl) {
        const key = "20c343";
        const apiUrl = `https://api.screenshotmachine.com?key=${key}&url=${encodeURIComponent(targetUrl)}&dimension=1280x800`;

        const img = document.getElementById('screenshot-img');
        const placeholder = document.getElementById('screenshot-placeholder');

        if (!img || !placeholder) return;

        img.src = apiUrl;
        img.onload = () => {
            img.classList.remove('hidden');
            placeholder.classList.add('hidden');
        };
        img.onerror = () => {
            placeholder.innerHTML = '<span>Failed to capture screenshot</span>';
        };
    }

    // ═══════════════════════════════════════
    //  Open Page Rank
    // ═══════════════════════════════════════

    async function runOpenPageRankCheck(hostname) {
        const list = document.getElementById('opr-list');
        const prEl = document.getElementById('opr-page-rank');
        const rankEl = document.getElementById('opr-global-rank');

        try {
            const response = await fetch(`/api/opr?domain=${encodeURIComponent(hostname)}`);

            if (!response.ok) {
                let errMsg = `HTTP ${response.status}`;
                try {
                    const err = await response.json();
                    if (err.error) errMsg = err.error;
                } catch { }
                throw new Error(errMsg);
            }

            const data = await response.json();

            // OPR API returns data in response[0]
            const resultData = data.response && data.response[0] ? data.response[0] : {};

            const pageRank = resultData.page_rank_decimal ?? 0;
            const globalRank = resultData.rank ?? 0;

            if (prEl) prEl.textContent = Number(pageRank).toFixed(2);
            if (rankEl) rankEl.textContent = globalRank > 0 ? Number(globalRank).toLocaleString() : 'N/A';

            if (list) {
                list.innerHTML = li('ok', 'Open Page Rank Synced', `Metrics for ${hostname} fetched.`);
            }
        } catch (e) {
            console.error('Open Page Rank Error:', e);
            if (list) list.innerHTML = li('err', 'API Sync Failed', e.message);
            [prEl, rankEl].forEach(el => {
                if (el) el.textContent = 'Err';
            });
        }
    }


    // ═══════════════════════════════════════
    //  5. Sitemap.xml
    // ═══════════════════════════════════════

    async function runSitemapInspector(origin, robotsSitemap) {
        const list = document.getElementById('sitemap-list');
        list.innerHTML = '';

        if (robotsSitemap) {
            list.innerHTML += li('ok', 'Found in robots.txt', `<a href="${robotsSitemap}" target="_blank" class="check-link">${robotsSitemap}</a>`);
        }

        const paths = ['/sitemap.xml', '/sitemap_index.xml', '/sitemap.xml.gz'];
        let foundAny = !!robotsSitemap;

        for (const path of paths) {
            const fullPath = `${origin}${path}`;
            if (robotsSitemap === fullPath) continue; // Skip if already found via robots.txt

            try {
                const txt = await fetchViaProxy(fullPath);
                if (txt && (txt.includes('<urlset') || txt.includes('<sitemapindex'))) {
                    const urls = (txt.match(/<url>/g) || []).length;
                    const maps = (txt.match(/<sitemap>/g) || []).length;
                    list.innerHTML += li('ok', `Found at ${path}`,
                        maps > 0 ? `Sitemap index with ${maps} child sitemaps.` : `${urls} URL entries.`);
                    foundAny = true;
                }
            } catch (e) { }
        }

        if (!foundAny) {
            list.innerHTML = li('err', 'No Sitemap Found', `Checked robots.txt and common paths: ${paths.join(', ')}`);
        }
    }


    // ═══════════════════════════════════════
    //  8. Structured Data / JSON-LD (homepage)
    // ═══════════════════════════════════════

    function runStructuredDataCheck(doc) {
        const list = document.getElementById('schema-list');
        const scripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
        if (scripts.length === 0) {
            list.innerHTML = li('warn', 'No JSON-LD Found', 'No structured data (Schema.org) on the homepage.');
            return;
        }

        let validBlocks = 0, errorBlocks = 0;
        const allTypes = []; // collects every individual @type found

        function extractTypes(obj) {
            // Handle @graph containers
            if (obj['@graph'] && Array.isArray(obj['@graph'])) {
                obj['@graph'].forEach(node => extractTypes(node));
                return;
            }
            // Handle @type as string or array
            let types = obj['@type'];
            if (!types) {
                allTypes.push('Unknown');
                return;
            }
            if (!Array.isArray(types)) types = [types];

            types.forEach(t => {
                if (t && t !== 'SiteNavigationElement' && t !== 'BreadcrumbList') {
                    allTypes.push(t);
                }
            });
        }


        scripts.forEach(s => {
            try {
                const obj = JSON.parse(s.textContent.trim());
                validBlocks++;
                // obj could be an array at top level too
                (Array.isArray(obj) ? obj : [obj]).forEach(extractTypes);
            } catch (e) {
                errorBlocks++;
            }
        });

        const summary = `${allTypes.length} schema type${allTypes.length !== 1 ? 's' : ''} across ${validBlocks} block${validBlocks !== 1 ? 's' : ''}`;
        list.innerHTML = li('ok', `${validBlocks}/${scripts.length} Valid JSON-LD Blocks`, summary);

        // List each type individually
        allTypes.forEach(t => {
            list.innerHTML += `<li><div class="check-detail">📎 ${t}</div></li>`;
        });

        if (errorBlocks > 0) {
            list.innerHTML += li('err', `${errorBlocks} Invalid JSON-LD Block${errorBlocks > 1 ? 's' : ''}`,
                'JSON parse error. Validate at <a href="https://validator.schema.org/" target="_blank" class="check-link">schema.org/validator</a>.');
        }
    }

    // ═══════════════════════════════════════
    //  4. Web Icons Check
    // ═══════════════════════════════════════

    function runIconsCheck(doc) {
        const list = document.getElementById('icons-list');
        list.innerHTML = '';

        // 1. Favicon
        const favicon = doc.querySelector('link[rel*="icon"]');
        if (favicon) {
            list.innerHTML += li('ok', 'Favicon Found', favicon.getAttribute('href'));
        } else {
            list.innerHTML += li('err', 'Missing Favicon', 'No &lt;link rel="icon"&gt; found.');
        }

        // 2. Apple Touch Icon
        const appleIcon = doc.querySelector('link[rel="apple-touch-icon"]');
        if (appleIcon) {
            list.innerHTML += li('ok', 'Apple Touch Icon Found', appleIcon.getAttribute('href'));
        } else {
            list.innerHTML += li('warn', 'Missing Apple Touch Icon', 'Recommended for mobile book-marking.');
        }
    }

    // ═══════════════════════════════════════
    //  New Checks: SSL, Mobile, Flash, iFrames
    // ═══════════════════════════════════════

    function runSslCheck(url) {
        const list = document.getElementById('ssl-list');
        if (!list) return;
        list.innerHTML = '';
        if (url.protocol === 'https:') {
            list.innerHTML = li('ok', 'SSL Enabled', 'Website is using HTTPS.');
        } else {
            list.innerHTML = li('err', 'SSL Missing', 'Website is using insecure HTTP.');
        }
    }

    function runMobileUsabilityCheck(doc) {
        const list = document.getElementById('mobile-usability-list');
        if (!list) return;
        list.innerHTML = '';
        const viewport = doc.querySelector('meta[name="viewport"]');
        if (viewport && viewport.getAttribute('content') && viewport.getAttribute('content').includes('width=device-width')) {
            list.innerHTML = li('ok', 'Mobile Viewport Configured', 'Found meta viewport tag.');
        } else {
            list.innerHTML = li('err', 'Viewport Missing', 'No mobile viewport meta tag found. Important for mobile usability.');
        }
    }

    function runFlashCheck(doc) {
        const list = document.getElementById('flash-list');
        if (!list) return;
        list.innerHTML = '';
        const flashElements = Array.from(doc.querySelectorAll('object, embed')).filter(el => {
            const type = el.getAttribute('type') || '';
            const src = el.getAttribute('src') || el.getAttribute('data') || '';
            return type.includes('application/x-shockwave-flash') || src.includes('.swf');
        });

        if (flashElements.length > 0) {
            list.innerHTML = li('err', 'Flash Usage Detected', `${flashElements.length} Flash element(s) found. Flash is obsolete and not supported by modern browsers.`);
        } else {
            list.innerHTML = li('ok', 'No Flash Found', 'Website is not using obsolete Flash elements.');
        }
    }

    function runIframesCheck(doc) {
        const list = document.getElementById('iframes-list');
        if (!list) return;
        list.innerHTML = '';
        const iframes = Array.from(doc.querySelectorAll('iframe'));

        if (iframes.length > 0) {
            list.innerHTML = li('warn', 'iFrames Usage Detected', `${iframes.length} iframe(s) found. Excessive use can impact SEO and usability.`);
        } else {
            list.innerHTML = li('ok', 'No iFrames Found', 'Website is not using iframes.');
        }
    }

    // ═══════════════════════════════════════
    //  New Checks: Charset, Lorem Ipsum, OpenGraph
    // ═══════════════════════════════════════

    function runCharsetCheck(doc) {
        const list = document.getElementById('charset-list');
        if (!list) return;
        list.innerHTML = '';

        // Check for <meta charset="utf-8"> or <meta http-equiv="Content-Type" content="...charset=utf-8">
        const charsetMatch = doc.querySelector('meta[charset]') || doc.querySelector('meta[http-equiv="Content-Type"]');
        let charset = null;

        if (charsetMatch) {
            if (charsetMatch.hasAttribute('charset')) {
                charset = charsetMatch.getAttribute('charset').toLowerCase();
            } else if (charsetMatch.hasAttribute('content')) {
                const content = charsetMatch.getAttribute('content').toLowerCase();
                const match = content.match(/charset=([^;]+)/);
                if (match) charset = match[1];
            }
        }

        if (charset === 'utf-8' || charset === 'utf8') {
            list.innerHTML = li('ok', 'UTF-8 Encoding Verified', 'Character encoding is explicitly set to UTF-8.');
        } else if (charset) {
            list.innerHTML = li('warn', `Encoding set to ${charset}`, 'It is highly recommended to use UTF-8 character encoding.');
        } else {
            list.innerHTML = li('err', 'Missing Charset Meta Tag', 'No character encoding declaration found.');
        }
    }

    function runLoremIpsumCheck(doc) {
        const list = document.getElementById('lorem-list');
        if (!list) return;
        list.innerHTML = '';

        const textContent = doc.body ? doc.body.innerText.toLowerCase() : '';
        const hasLorem = textContent.includes('lorem ipsum');

        if (hasLorem) {
            list.innerHTML = li('err', 'Dummy Text Detected', 'Found "Lorem Ipsum" placeholder text on the page.');
        } else {
            list.innerHTML = li('ok', 'No Dummy Text', 'No "Lorem Ipsum" placeholder text detected.');
        }
    }

    function runOpenGraphCheck(doc) {
        const list = document.getElementById('opengraph-list');
        if (!list) return;
        list.innerHTML = '';

        const ogTags = ['og:title', 'og:description', 'og:image'];
        let missing = [];

        ogTags.forEach(tag => {
            const el = doc.querySelector(`meta[property="${tag}"]`) || doc.querySelector(`meta[name="${tag}"]`);
            if (!el || !el.getAttribute('content')) {
                missing.push(tag);
            }
        });

        if (missing.length === 0) {
            list.innerHTML = li('ok', 'OpenGraph Verified', 'Found og:title, og:description, and og:image.');
        } else if (missing.length < ogTags.length) {
            list.innerHTML = li('warn', 'Partial OpenGraph Tags', `Missing: ${missing.join(', ')}. Useful for rich previews on social media.`);
        } else {
            list.innerHTML = li('err', 'No OpenGraph Tags Found', 'Missing essential Social Media OpenGraph tags (title, description, image).');
        }
    }


    function runIntlDomainsCheck(doc) {
        const list = document.getElementById('intl-list');
        if (!list) return;
        list.innerHTML = '';

        const hreflangs = Array.from(doc.querySelectorAll('link[rel="alternate"][hreflang]'));
        const htmlLang = doc.documentElement.getAttribute('lang');

        // Check HTML lang attribute
        if (htmlLang) {
            list.innerHTML += li('ok', 'HTML Lang Attribute', `Present: lang="${htmlLang}"`);
        } else {
            list.innerHTML += li('err', 'Missing HTML Lang Attribute', 'Essential for international SEO and accessibility.');
        }

        if (hreflangs.length > 0) {
            list.innerHTML += li('ok', 'Hreflang Tags Found', `${hreflangs.length} hreflang tag(s) detected for international targeting.`);

            const hasXDefault = hreflangs.some(el => el.getAttribute('hreflang').toLowerCase() === 'x-default');
            if (hasXDefault) {
                list.innerHTML += li('ok', 'x-default Configured', 'Found x-default hreflang tag.');
            } else {
                list.innerHTML += li('warn', 'Missing x-default', 'No x-default hreflang tag found. It is strongly recommended for international domains as a fallback.');
            }

            // Display up to 5 hreflangs
            list.innerHTML += `<li><div style="font-size:0.8rem; margin:10px 0 5px; opacity:0.7">Detected Locales</div></li>`;
            hreflangs.slice(0, 5).forEach(el => {
                const hl = el.getAttribute('hreflang');
                const href = el.getAttribute('href');
                list.innerHTML += `<li><div class="check-detail"><strong>${hl}</strong>: ${linkTag(href)}</div></li>`;
            });
            if (hreflangs.length > 5) {
                list.innerHTML += `<li><div class="check-detail" style="opacity: 0.7;">...and ${hreflangs.length - 5} more.</div></li>`;
            }
        } else {
            list.innerHTML += li('warn', 'No Hreflang Tags', 'If this store targets multiple countries/languages, hreflang tags are missing.');
        }
    }

    // ═══════════════════════════════════════
    //  Additional Checks
    // ═══════════════════════════════════════

    async function runRedirectChecks(urlObj) {
        const tsList = document.getElementById('trailing-slash-list');
        const wwwList = document.getElementById('www-resolve-list');
        if (tsList) tsList.innerHTML = '';
        if (wwwList) wwwList.innerHTML = '';

        const dummyWithSlash = urlObj.origin + '/test-check-slash-123/';
        const dummyWithoutSlash = urlObj.origin + '/test-check-slash-123';

        try {
            // Trailing Slash Check (on dummy path)
            const [resSlash, resNoSlash] = await Promise.all([
                fetch(`/api/check-redirect?url=${encodeURIComponent(dummyWithSlash)}`).then(r => r.json()),
                fetch(`/api/check-redirect?url=${encodeURIComponent(dummyWithoutSlash)}`).then(r => r.json())
            ]);

            // If both return 200, duplicate content
            if (resSlash.status === 200 && resNoSlash.status === 200) {
                if (tsList) tsList.innerHTML = li('err', 'Trailing Slash Issue', 'Both slashed and non-slashed URLs return 200 OK. This causes duplicate content. One should 301 redirect to the other.');
            } else if (resSlash.status >= 300 && resSlash.status < 400 || resNoSlash.status >= 300 && resNoSlash.status < 400) {
                if (tsList) tsList.innerHTML = li('ok', 'Trailing Slash Configured', 'Redirects are properly handling trailing slashes.');
            } else {
                if (tsList) tsList.innerHTML = li('warn', 'Trailing Slash Check Inconclusive', 'Could not fully verify trailing slash redirect behavior on a test path.');
            }
        } catch (e) {
            if (tsList) tsList.innerHTML = li('warn', 'Trailing Slash Check Failed', e.message);
        }

        try {
            // WWW Check
            const isWww = urlObj.hostname.startsWith('www.');
            const altHostname = isWww ? urlObj.hostname.replace('www.', '') : 'www.' + urlObj.hostname;
            const altUrl = urlObj.protocol + '//' + altHostname + '/';

            const resAlt = await fetch(`/api/check-redirect?url=${encodeURIComponent(altUrl)}`).then(r => r.json());

            if (resAlt.status === 200) {
                if (wwwList) wwwList.innerHTML = li('err', 'WWW / Non-WWW Resolution Issue', `Both ${urlObj.hostname} and ${altHostname} return 200 OK. One must redirect to the other.`);
            } else if (resAlt.isRedirect) {
                if (wwwList) wwwList.innerHTML = li('ok', 'WWW Resolution Configured', `${altHostname} properly redirects.`);
            } else if (resAlt.status === 0 || resAlt.status >= 400) {
                if (wwwList) wwwList.innerHTML = li('warn', 'Alternate Domain Inaccessible', `${altHostname} does not resolve or return a valid response. Consider registering and redirecting it.`);
            }

        } catch (e) {
            if (wwwList) wwwList.innerHTML = li('warn', 'WWW Check Failed', e.message);
        }
    }

    function runTrustSignalsCheck(doc) {
        const list = document.getElementById('trust-list');
        if (!list) return;
        list.innerHTML = '';

        const textContent = doc.body ? doc.body.innerText.toLowerCase() : '';
        const htmlContent = doc.body ? doc.body.innerHTML.toLowerCase() : '';

        // Search for Privacy Policy or TOS links
        const hasPrivacy = Array.from(doc.querySelectorAll('a')).some(a => {
            const t = a.textContent.toLowerCase();
            const h = a.getAttribute('href') || '';
            return t.includes('privacy') || h.includes('privacy');
        });

        const hasTos = Array.from(doc.querySelectorAll('a')).some(a => {
            const t = a.textContent.toLowerCase();
            const h = a.getAttribute('href') || '';
            return t.includes('terms') || h.includes('terms') || t.includes('tos');
        });

        if (hasPrivacy && hasTos) {
            list.innerHTML += li('ok', 'Legal Pages Found', 'Links to Privacy Policy and Terms of Service detected.');
        } else if (hasPrivacy || hasTos) {
            list.innerHTML += li('warn', 'Partial Legal Pages', `Found link to ${hasPrivacy ? 'Privacy Policy' : 'Terms of Service'} but missing the other.`);
        } else {
            list.innerHTML += li('err', 'Missing Legal Pages', 'Could not find links to a Privacy Policy or Terms of Service. Important for trust.');
        }

        // Search for email or phone
        const hasEmail = htmlContent.includes('mailto:') || /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(textContent);
        const hasPhone = htmlContent.includes('tel:') || /(?:\+?\d{1,3}[\s-]?)?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}/.test(textContent);

        if (hasEmail || hasPhone) {
            list.innerHTML += li('ok', 'Contact Info Found', `Detected ${hasEmail ? 'Email' : ''} ${hasEmail && hasPhone ? '&' : ''} ${hasPhone ? 'Phone Number' : ''}.`);
        } else {
            list.innerHTML += li('warn', 'Missing Contact Info', 'No clear email or phone number detected on the homepage.');
        }
    }

    function runLazyLoadImagesCheck(doc) {
        const list = document.getElementById('lazy-load-list');
        if (!list) return;
        list.innerHTML = '';

        const imgs = Array.from(doc.querySelectorAll('img'));
        if (imgs.length === 0) {
            list.innerHTML = li('ok', 'No Images Found', 'No images to check for lazy loading.');
            return;
        }

        const lazyImgs = imgs.filter(img => img.getAttribute('loading') === 'lazy');

        if (lazyImgs.length > 0) {
            if (lazyImgs.length === imgs.length) {
                list.innerHTML = li('ok', 'Native Lazy Loading Active', `All ${imgs.length} image(s) use loading="lazy".`);
            } else {
                list.innerHTML = li('ok', 'Partial Lazy Loading', `${lazyImgs.length} out of ${imgs.length} image(s) use loading="lazy".`);
            }
        } else {
            const hasJsLazy = imgs.some(img => img.classList.contains('lazy') || img.classList.contains('lazyload') || img.hasAttribute('data-src'));
            if (hasJsLazy) {
                list.innerHTML = li('ok', 'JS Lazy Loading Active', 'Images appear to use a JS-based lazy loading solution (e.g., data-src or class="lazy").');
            } else {
                const sampleCode = imgs[0].outerHTML.substring(0, 150) + (imgs[0].outerHTML.length > 150 ? '...' : '');
                list.innerHTML = li('warn', 'Missing Native Lazy Loading', `None of the ${imgs.length} image(s) use the loading="lazy" attribute.`, sampleCode);
            }
        }
    }

    function runMobileTapTargetsCheck(doc) {
        const list = document.getElementById('tap-targets-list');
        if (!list) return;
        list.innerHTML = '';

        const subtitle = document.getElementById('tap-targets-subtitle');
        if (subtitle) subtitle.textContent = 'Heuristic DOM Analysis';

        const targets = Array.from(doc.querySelectorAll('a, button, input[type="button"], input[type="submit"], select'));

        if (targets.length === 0) {
            list.innerHTML = li('warn', 'No Interactive Elements', 'No links or buttons detected to check tap targets.');
            return;
        }

        const viewportMatch = doc.querySelector('meta[name="viewport"]');
        const hasViewport = viewportMatch && viewportMatch.getAttribute('content') && viewportMatch.getAttribute('content').includes('width=device-width');

        // Check heuristic: if they have inline styling for padding, or if mobile viewport is present.
        if (hasViewport) {
            list.innerHTML = li('ok', 'Viewport Configured', 'Mobile viewport meta tag is present. Interactive elements should scale naturally, but manual verification of tap target sizes (min 48x48px) is recommended.');
            list.innerHTML += li('warn', 'Manual Verification Required', `Detected ${targets.length} interactive element(s). Ensure they are properly spaced.`);
        } else {
            const sampleCode = targets[0] ? targets[0].outerHTML.substring(0, 150) : '';
            list.innerHTML = li('err', 'Missing Mobile Viewport', 'Without a properly configured mobile viewport, tap targets will likely be too small and difficult to tap.', sampleCode);
        }
    }


    // ═══════════════════════════════════════
    //  Site-wide Scan: H1 + Meta Titles (≤50 pages)
    // ═══════════════════════════════════════

    async function runSitewideScan(homeUrl, links, onProgress) {
        // ALWAYS scan strictly 50 pages if available
        const pool = [homeUrl, ...links].slice(0, 50);
        const total = pool.length;

        // Init UI
        document.getElementById('h1-list').innerHTML = '<li><div class="check-detail">Scanning…</div></li>';
        document.getElementById('titles-list').innerHTML = '<li><div class="check-detail">Scanning…</div></li>';

        const h1R = { ok: 0, missing: 0, multiple: 0, issues: [] };
        const titR = { ok: 0, missing: 0, long: 0, short: 0, duplicate: 0, scanned: [], issues: [] };
        const altR = { ok: 0, missing: 0, issues: [] };
        const canR = { ok: 0, missing: 0, multiple: 0, issues: [] };
        const secR = { ok: 0, missing: 0, issues: [] };
        const mixR = { ok: 0, missing: 0, issues: [] };
        const cntR = { ok: 0, missing: 0, issues: [] };
        let done = 0;


        // Concurrency pool of 5
        for (let i = 0; i < pool.length; i += 5) {
            const batch = pool.slice(i, i + 5);
            await Promise.all(batch.map(async pageUrl => {
                try {
                    const html = await fetchViaProxy(pageUrl);
                    const doc = new DOMParser().parseFromString(html, 'text/html');

                    // 1. H1
                    const h1Elems = Array.from(doc.querySelectorAll('h1'));
                    const h1s = h1Elems.map(el => el.textContent.trim()).filter(Boolean);
                    if (h1s.length === 0) {
                        h1R.missing++;
                        h1R.issues.push({ url: pageUrl, icon: 'err', label: 'Missing H1' });
                    } else if (h1s.length > 1) {
                        h1R.multiple++;
                        const sampleCode = h1Elems[0].outerHTML.substring(0, 80) + '\n' + h1Elems[1].outerHTML.substring(0, 80);
                        h1R.issues.push({ url: pageUrl, icon: 'warn', label: `Multiple H1 (${h1s.length})`, codeSnippet: sampleCode });
                    } else {
                        h1R.ok++;
                    }

                    // 2. Meta Title
                    const titles = Array.from(doc.querySelectorAll('title'))
                        .map(el => el.textContent.trim()).filter(Boolean);
                    titR.scanned.push({ url: pageUrl, title: titles.length > 0 ? titles[0] : null });

                    // 3. HTTPS Check
                    if (pageUrl.startsWith('https://')) {
                        secR.ok++;
                    } else {
                        secR.missing++;
                        secR.issues.push({ url: pageUrl, icon: 'err', label: 'Insecure (HTTP)' });
                    }

                    // 3.5 Mixed Content Check
                    if (pageUrl.startsWith('https://')) {
                        const insecureAssets = Array.from(doc.querySelectorAll('img[src^="http://"], script[src^="http://"], link[rel="stylesheet"][href^="http://"], iframe[src^="http://"]'));
                        if (insecureAssets.length > 0) {
                            mixR.missing++;
                            mixR.issues.push({ url: pageUrl, icon: 'err', label: `Mixed Content: ${insecureAssets.length} insecure asset(s)` });
                        } else {
                            mixR.ok++;
                        }
                    } else {
                        // If the page itself is HTTP, mixed content isn't the primary issue
                        mixR.ok++;
                    }

                    // 4. Word Count (Thin Content)
                    const text = doc.body ? doc.body.innerText : '';
                    const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
                    if (words < 300) {
                        cntR.missing++;
                        cntR.issues.push({ url: pageUrl, icon: 'warn', label: `Thin Content (${words} words)` });
                    } else {
                        cntR.ok++;
                    }

                    // 5. Image Alt Tags
                    const imgs = Array.from(doc.querySelectorAll('img'));
                    if (imgs.length > 0) {
                        const missingImgs = imgs.filter(img => img.getAttribute('alt') === null || img.getAttribute('alt') === '');
                        if (missingImgs.length > 0) {
                            altR.missing += missingImgs.length;
                            const sampleCode = missingImgs[0].outerHTML.substring(0, 150) + (missingImgs[0].outerHTML.length > 150 ? '...' : '');
                            altR.issues.push({ url: pageUrl, icon: 'err', label: `${missingImgs.length} Missing/Empty Alt Tags`, codeSnippet: sampleCode });
                        }
                        altR.ok += (imgs.length - missingImgs.length);
                    }

                    // 6. Canonical URL
                    const caps = Array.from(doc.querySelectorAll('link[rel="canonical"]'));
                    if (caps.length === 0) {
                        canR.missing++;
                        canR.issues.push({ url: pageUrl, icon: 'err', label: 'Missing Canonical Tag' });
                    } else if (caps.length > 1) {
                        canR.multiple++;
                        canR.issues.push({ url: pageUrl, icon: 'warn', label: `Multiple Canonicals (${caps.length})` });
                    } else {
                        canR.ok++;
                    }


                } catch (e) { /* skip unreachable page */ }
                done++;
                onProgress(done, total);
            }));
            if (i + 5 < pool.length) await delay(300);
        }

        // ── Process Meta Titles for Duplicates ──
        const titleCounts = {};
        titR.scanned.forEach(item => {
            if (item.title) titleCounts[item.title] = (titleCounts[item.title] || 0) + 1;
        });

        titR.scanned.forEach(item => {
            if (!item.title) {
                titR.missing++;
                titR.issues.push({ url: item.url, icon: 'err', label: 'Missing Title' });
                return;
            }

            const len = item.title.length;
            const isDup = titleCounts[item.title] > 1;

            if (isDup) {
                titR.duplicate++;
                titR.issues.push({ url: item.url, icon: 'err', label: `Duplicate Title`, detail: item.title });
            } else if (len > 60) {
                titR.long++;
                titR.issues.push({ url: item.url, icon: 'warn', label: `Too Long (${len} chars)`, detail: item.title });
            } else if (len < 30) {
                titR.short++;
                titR.issues.push({ url: item.url, icon: 'warn', label: `Too Short (${len} chars)`, detail: item.title });
            } else {
                titR.ok++;
            }
        });

        // ── Render H1 results ──
        renderScanResults('h1', h1R, 'All pages have a single H1');
        // ── Render Meta Title results ──
        renderScanResults('titles', titR, 'All titles look good');
        // ── Render Image Alt results ──
        renderScanResults('alt', altR, 'All images have alt text');
        // ── Render Canonical results ──
        renderScanResults('canonical', canR, 'All pages have valid canonicals');
        // ── Render Security results ──
        renderScanResults('security', secR, 'All pages are secure (HTTPS)');
        // ── Render Mixed Content results ──
        renderScanResults('mixed-content', mixR, 'No mixed content (HTTP) found on secure pages');
        // ── Render Content results ──
        renderScanResults('content', cntR, 'All pages have sufficient content');
    }


    function renderScanResults(prefix, data, okMsg) {
        let total = (data.ok || 0) + (data.missing || 0) + (data.multiple || 0) + (data.long || 0) + (data.short || 0) + (data.duplicate || 0);
        const sub = document.getElementById(`${prefix}-subtitle`);

        if (prefix === 'alt') {
            // For alt tags, total is total images found across all pages
            if (sub) sub.textContent = `Scanned images across 50 pages`;
        } else if (sub) {
            sub.textContent = `Scanned ${total} page${total !== 1 ? 's' : ''}`;
        }

        const stats = document.getElementById(`${prefix}-stats`);
        if (stats) {
            const warn = (data.multiple || 0) + (data.long || 0) + (data.short || 0) + (prefix === 'content' ? data.missing : 0);
            const err = (prefix === 'content' ? 0 : data.missing) + (data.duplicate || 0);
            stats.innerHTML = statPills(data.ok, warn, err);
        }

        const list = document.getElementById(`${prefix}-list`);
        if (list) {
            list.innerHTML = data.issues.length === 0
                ? li('ok', okMsg, '')
                : data.issues.map(r => li(r.icon, r.label,
                    (r.detail ? `"${r.detail.slice(0, 50)}…" — ` : '') + linkTag(r.url),
                    r.codeSnippet
                )).join('');
        }
    }



    // ═══════════════════════════════════════
    //  Internal Link Checker (sample 50)
    // ═══════════════════════════════════════

    async function runInternalLinkCheck(links) {
        const blList = document.getElementById('broken-links-list');
        document.getElementById('total-links').textContent = links.length;
        const sample = links.slice(0, 50);
        blList.innerHTML = '<li><div class="check-detail">Checking…</div></li>';
        let broken = 0;
        for (const url of sample) {
            try {
                const enc = encodeURIComponent(url);
                const res = await withTimeout(fetch(`https://api.allorigins.win/get?url=${enc}`), 8000);
                const d = await res.json();
                if (d.status?.http_code >= 400) {
                    broken++;
                    if (broken === 1) blList.innerHTML = '';
                    blList.innerHTML += `<li><div class="check-detail error">❌ HTTP ${d.status.http_code}: ${linkTag(url)}</div></li>`;
                }
            } catch (e) { }
            await delay(200);
        }
        document.getElementById('broken-links').textContent = broken;
        if (broken === 0) {
            blList.innerHTML = li('ok', `No broken links found (sampled ${sample.length})`, '');
        } else {
            window.auditSummary.failed += broken; // since they didn't go through the li helper
        }
    }

    // ═══════════════════════════════════════
    //  Shopify URL Structure Check
    // ═══════════════════════════════════════

    function runShopifyUrlCheck(links) {
        const list = document.getElementById('shopify-list');
        if (!list) return;
        list.innerHTML = '';

        const unoptimized = links.filter(link => link.includes('/collections/') && link.includes('/products/'));

        if (unoptimized.length > 0) {
            list.innerHTML = li('warn', 'Unoptimized Shopify URLs Found', `${unoptimized.length} URL(s) contain both /collections/ and /products/. This can cause duplicate content issues.`);
            unoptimized.slice(0, 5).forEach(url => {
                list.innerHTML += `<li><div class="check-detail">${linkTag(url)}</div></li>`;
            });
            if (unoptimized.length > 5) {
                list.innerHTML += `<li><div class="check-detail" style="opacity: 0.7;">...and ${unoptimized.length - 5} more.</div></li>`;
            }
        } else {
            list.innerHTML = li('ok', 'URL Structure Looks Good', 'No URLs containing both /collections/ and /products/ were found.');
        }
    }


    // ═══════════════════════════════════════
    //  Robots.txt Analysis
    // ═══════════════════════════════════════

    async function runRobotsTxtInspector(origin) {
        const aiBots = ["GPTBot", "Google-Extended", "Anthropic-AI", "FacebookBot", "Applebot-Extended",
            "CCBot", "Bytespider"];
        const importantBots = ["Googlebot", "Bingbot", "Yandex", "DuckDuckBot", "Baidu"];

        const list = document.getElementById('ai-list');
        if (!list) return null;
        list.innerHTML = '';
        try {
            const txt = await fetchViaProxy(`${origin}/robots.txt`);
            if (!txt) throw new Error("Empty");
            
            const lowerTxt = txt.trim().toLowerCase();
            if (lowerTxt.startsWith('<!doctype html') || lowerTxt.startsWith('<html') || lowerTxt.includes('<body')) {
                throw new Error("Invalid robots.txt (HTML returned)");
            }

            const lines = txt.split('\n').map(l => l.trim().toLowerCase());
            let html = '', allowedAI = 0, summaryIssues = 0;

            // Check important search engine bots
            importantBots.forEach(bot => {
                const bLow = bot.toLowerCase();
                let found = false, blocked = false;
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].startsWith('user-agent:') && lines[i].includes(bLow)) {
                        found = true;
                        for (let j = i + 1; j < lines.length; j++) {
                            if (lines[j].startsWith('user-agent:')) break;
                            if (lines[j].startsWith('disallow:')) {
                                const path = lines[j].substring(9).trim();
                                if (path === '/' || path === '/*') blocked = true; // Broad disallow
                            }
                        }
                        break;
                    }
                }

                // Also check if * blocks them
                if (!found) {
                    for (let i = 0; i < lines.length; i++) {
                        if (lines[i].startsWith('user-agent: *')) {
                            for (let j = i + 1; j < lines.length; j++) {
                                if (lines[j].startsWith('user-agent:')) break;
                                if (lines[j].startsWith('disallow:')) {
                                    const path = lines[j].substring(9).trim();
                                    if (path === '/' || path === '/*') blocked = true; // Broad disallow on *
                                }
                            }
                            break;
                        }
                    }
                }

                if (blocked) { html += li('err', `${bot} is Blocked`, 'A crucial search engine bot is blocked from crawling.'); summaryIssues++; }
                else { html += li('ok', bot, 'Allowed to crawl.'); }
            });

            // Check AI Bots
            html += `<li><div style="font-size:0.8rem; margin:10px 0 5px; opacity:0.7">AI Crawler Rules</div></li>`;
            aiBots.forEach(bot => {
                const bLow = bot.toLowerCase();
                let found = false, blocked = false;
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].startsWith('user-agent:') && lines[i].includes(bLow)) {
                        found = true;
                        for (let j = i + 1; j < lines.length; j++) {
                            if (lines[j].startsWith('user-agent:')) break;
                            if (lines[j].startsWith('disallow:')) {
                                const path = lines[j].substring(9).trim();
                                if (path === '/' || path === '/*') blocked = true;
                            }
                        }
                        break;
                    }
                }
                if (found && !blocked) { html += li('warn', bot, 'Explicitly whitelisted.'); allowedAI++; }
                else if (found) { html += li('ok', bot, 'Explicitly blocked.'); } // Blocking AI is usually preferred by publishers now
                else { html += li('warn', bot, 'Not explicitly blocked.'); }
            });

            // Check Crawl-Delay
            html += `<li><div style="font-size:0.8rem; margin:10px 0 5px; opacity:0.7">Crawl Directives</div></li>`;
            let crawlDelayFound = false;
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].startsWith('crawl-delay:')) {
                    crawlDelayFound = true;
                    html += li('warn', 'Crawl-Delay Directive Used', `Found: ${lines[i]}. Googlebot ignores this, but others use it. Extremely slow delays hurt indexing.`);
                    summaryIssues++;
                    break;
                }
            }
            if (!crawlDelayFound) {
                html += li('ok', 'No Crawl-Delay', 'Crawlers allowed to crawl normally.');
            }

            // Check for Sitemap link
            const sitemapMatch = txt.match(/^sitemap:\s*(.+)$/im);
            const robotsSitemap = sitemapMatch ? sitemapMatch[1].trim() : null;

            list.innerHTML = html;
            document.getElementById('ai-subtitle').textContent = summaryIssues > 0 ? `${summaryIssues} warning(s) found in robots.txt` : 'robots.txt configuration looks good.';

            return robotsSitemap;
        } catch (e) {
            list.innerHTML = li('err', 'robots.txt not found or unavailable.', '');
            return null;
        }
    }


    // ═══════════════════════════════════════
    //  LLMs.txt Inspector from my github
    // ═══════════════════════════════════════

    async function runLlmsTxtInspector(origin) {
        const list = document.getElementById('llms-list');
        list.innerHTML = '';
        try {
            let txt, path = '/llms.txt';
            try { txt = await fetchViaProxy(`${origin}/llms.txt`); }
            catch (e) { txt = await fetchViaProxy(`${origin}/.well-known/llms.txt`); path = '/.well-known/llms.txt'; }
            if (!txt || txt.includes('<html')) throw new Error("Not valid");
            list.innerHTML = li('ok', `Found at ${path}`, '');
            list.innerHTML += li(/^#\s+.+/m.test(txt) ? 'ok' : 'err', 'Title (H1)', /^#\s+.+/m.test(txt) ? 'Found markdown heading' : 'Missing # title');
            list.innerHTML += li(/^>\s+.+/m.test(txt) ? 'ok' : 'warn', 'Optional Summary', /^>\s+.+/m.test(txt) ? 'Found blockquote summary' : 'No > summary found');
            list.innerHTML += li(/\[.+\]\(.+\)/.test(txt) ? 'ok' : 'warn', 'Additional Links', /\[.+\]\(.+\)/.test(txt) ? 'Markdown links found' : 'No links referenced');
        } catch (e) {
            list.innerHTML = li('err', 'No valid llms.txt found.', 'Checked /llms.txt and /.well-known/llms.txt');
        }
    }

    // ═══════════════════════════════════════
    //  Web icons & UI Helpers
    // ═══════════════════════════════════════

    function li(icon, title, detail, codeSnippet = '') {
        if (window.auditSummary) {
            if (icon === 'ok') window.auditSummary.passed++;
            else if (icon === 'warn') window.auditSummary.warnings++;
            else if (icon === 'err') window.auditSummary.failed++;
        }
        const icons = { ok: '<span class="icon-ok">✅</span>', warn: '<span class="icon-warn">⚠️</span>', err: '<span class="icon-err">❌</span>' };
        
        let codeHtml = '';
        let dlBtn = '';
        if (codeSnippet) {
            const escaped = codeSnippet.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            codeHtml = `<div class="code-snippet-container"><pre><code>${escaped}</code></pre></div>`;
            dlBtn = `<button class="download-snippet-btn" title="Save this issue as Image">📸</button>`;
        }

        return `<li><div class="check-status">${icons[icon] || ''} ${title}</div>${detail ? `<div class="check-detail">${detail}</div>` : ''}${codeHtml}${dlBtn}</li>`;
    }

    function statPills(good, warn, bad) {
        return `<div class="scan-stat good">${good} ✅ Good</div>
                <div class="scan-stat warn">${warn} ⚠️ Issues</div>
                <div class="scan-stat bad">${bad} ❌ Missing</div>`;
    }

    function linkTag(url) {
        let label = url;
        try { const u = new URL(url); label = (u.pathname + u.search) || '/'; } catch (e) { }
        if (label.length > 55) label = label.slice(0, 55) + '…';
        return `<a href="${url}" target="_blank" rel="noopener" class="check-link">${label}</a>`;
    }

    function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

    // ═══════════════════════════════════════
    //  AI Report Generator (Claude)
    // ═══════════════════════════════════════

    function collectAuditData() {
        const data = {};

        // Summary counts
        data.summary = {
            passed: window.auditSummary?.passed || 0,
            warnings: window.auditSummary?.warnings || 0,
            failed: window.auditSummary?.failed || 0
        };

        // PageSpeed
        const mobileScore = document.getElementById('speed-mobile')?.textContent;
        const desktopScore = document.getElementById('speed-desktop')?.textContent;
        data.pageSpeed = {
            mobile: { score: mobileScore || 'N/A' },
            desktop: { score: desktopScore || 'N/A' }
        };
        // Grab FCP, LCP, CLS, TBT from detail elements
        ['mobile', 'desktop'].forEach(type => {
            const detailEl = document.getElementById(`speed-details-${type}`);
            if (detailEl) {
                const metrics = {};
                detailEl.querySelectorAll('.speed-metric').forEach(m => {
                    const spans = m.querySelectorAll('span');
                    if (spans.length >= 2) {
                        metrics[spans[0].textContent.replace(':', '').trim()] = spans[1].textContent.trim();
                    }
                });
                data.pageSpeed[type].metrics = metrics;
            }
        });

        // Open Page Rank
        data.openPageRank = {
            pageRank: document.getElementById('opr-page-rank')?.textContent || 'N/A',
            globalRank: document.getElementById('opr-global-rank')?.textContent || 'N/A'
        };

        // Collect card results by scraping text from each check list
        const cards = [
            { key: 'h1Tags', listId: 'h1-list', statsId: 'h1-stats' },
            { key: 'metaTitles', listId: 'titles-list', statsId: 'titles-stats' },
            { key: 'imageAltTags', listId: 'alt-list', statsId: 'alt-stats' },
            { key: 'canonicalUrls', listId: 'canonical-list', statsId: 'canonical-stats' },
            { key: 'internalLinks', listId: 'broken-links-list' },
            { key: 'sitemap', listId: 'sitemap-list' },
            { key: 'robotsTxt', listId: 'ai-list' },
            { key: 'llmsTxt', listId: 'llms-list' },
            { key: 'structuredData', listId: 'schema-list' },
            { key: 'security', listId: 'security-list', statsId: 'security-stats' },
            { key: 'mixedContent', listId: 'mixed-content-list', statsId: 'mixed-content-stats' },
            { key: 'contentQuality', listId: 'content-list', statsId: 'content-stats' },
            { key: 'webIcons', listId: 'icons-list' },
            { key: 'ssl', listId: 'ssl-list' },
            { key: 'mobileUsability', listId: 'mobile-usability-list' },
            { key: 'flash', listId: 'flash-list' },
            { key: 'charset', listId: 'charset-list' },
            { key: 'loremIpsum', listId: 'lorem-list' },
            { key: 'openGraph', listId: 'opengraph-list' },
            { key: 'shopifyUrls', listId: 'shopify-list' },
            { key: 'internationalDomains', listId: 'intl-list' },
            { key: 'trailingSlash', listId: 'trailing-slash-list' },
            { key: 'wwwResolve', listId: 'www-resolve-list' },
            { key: 'trustSignals', listId: 'trust-list' },
            { key: 'tapTargets', listId: 'tap-targets-list' },
            { key: 'lazyLoadImages', listId: 'lazy-load-list' }
        ];

        cards.forEach(card => {
            const listEl = document.getElementById(card.listId);
            const items = [];
            if (listEl) {
                listEl.querySelectorAll('li').forEach(li => {
                    const status = li.querySelector('.check-status')?.textContent?.trim() || '';
                    const detail = li.querySelector('.check-detail')?.textContent?.trim() || '';
                    if (status || detail) {
                        items.push({ status, detail });
                    }
                });
            }

            // Include stats if present
            let stats = '';
            if (card.statsId) {
                const statsEl = document.getElementById(card.statsId);
                if (statsEl) stats = statsEl.textContent.trim();
            }

            data[card.key] = { items, stats };
        });

        // Internal links summary numbers
        data.internalLinks.totalLinks = document.getElementById('total-links')?.textContent || '0';
        data.internalLinks.brokenLinks = document.getElementById('broken-links')?.textContent || '0';

        return data;
    }

    // Wire up the Generate Report button
    const reportBtn = document.getElementById('generate-report-btn');
    if (reportBtn) {
        reportBtn.addEventListener('click', async () => {
            const urlStr = document.getElementById('url-input')?.value?.trim();
            if (!urlStr) return;

            let domain;
            try {
                domain = new URL(urlStr.startsWith('http') ? urlStr : `https://${urlStr}`).hostname;
            } catch (e) {
                domain = urlStr;
            }

            const btnTextEl = reportBtn.querySelector('.report-btn-text');
            const spinnerEl = reportBtn.querySelector('.report-spinner');
            const outputWrapper = document.getElementById('report-output-wrapper');
            const outputEl = document.getElementById('report-output');
            const errorEl = document.getElementById('report-error');

            // Loading state
            reportBtn.disabled = true;
            if (btnTextEl) btnTextEl.textContent = 'Generating report…';
            if (spinnerEl) spinnerEl.classList.remove('hidden');
            if (outputWrapper) outputWrapper.classList.add('hidden');
            if (errorEl) { errorEl.classList.add('hidden'); errorEl.textContent = ''; }

            try {
                const auditData = collectAuditData();
                const res = await fetch('/api/generate-report', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ domain, auditData })
                });

                const result = await res.json();
                if (!res.ok) throw new Error(result.error || 'Unknown error');

                if (outputEl) outputEl.textContent = result.report;
                if (outputWrapper) outputWrapper.classList.remove('hidden');
            } catch (err) {
                if (errorEl) {
                    errorEl.textContent = '❌ ' + err.message;
                    errorEl.classList.remove('hidden');
                }
            } finally {
                reportBtn.disabled = false;
                if (btnTextEl) btnTextEl.textContent = 'Generate Mini SEO Audit Report';
                if (spinnerEl) spinnerEl.classList.add('hidden');
            }
        });
    }

    // Copy to Clipboard
    const copyBtn = document.getElementById('copy-report-btn');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const text = document.getElementById('report-output')?.textContent || '';
            navigator.clipboard.writeText(text).then(() => {
                copyBtn.textContent = '✅ Copied!';
                setTimeout(() => { copyBtn.textContent = '📋 Copy'; }, 2000);
            });
        });
    }

    // Download as .txt
    const downloadBtn = document.getElementById('download-report-btn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            const text = document.getElementById('report-output')?.textContent || '';
            const domain = document.getElementById('url-input')?.value?.trim() || 'audit';
            let filename;
            try {
                filename = new URL(domain.startsWith('http') ? domain : `https://${domain}`).hostname;
            } catch (e) {
                filename = 'audit';
            }
            const blob = new Blob([text], { type: 'text/plain' });
            const link = document.createElement('a');
            link.download = `Mini-SEO-Audit-${filename}.txt`;
            link.href = URL.createObjectURL(blob);
            link.click();
            URL.revokeObjectURL(link.href);
        });
    }
});
