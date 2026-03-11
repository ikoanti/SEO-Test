document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('audit-btn');
    const input = document.getElementById('url-input');
    const results = document.getElementById('results-container');
    const errorMsg = document.getElementById('error-message');
    const statusMsg = document.getElementById('status-msg');
    const btnText = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.spinner');

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

        startLoading();
        clearResults();

        try {
            // ── Step 1: Fetch homepage HTML (reused by many checks) ──
            setStatus("Fetching homepage HTML…");
            let homepageDoc = null;
            let internalLinks = [];

            try {
                const html = await fetchViaProxy(url.href);
                const parser = new DOMParser();
                homepageDoc = parser.parseFromString(html, 'text/html');
                internalLinks = extractInternalLinks(homepageDoc, url.href, url.origin);
            } catch (e) {
                console.warn("Homepage fetch failed:", e);
            }

            // ── Step 2: PageSpeed Mobile + Desktop (runs in background) ──
            setStatus("Requesting PageSpeed scores…");
            const psPromise = runPageSpeed(url.href);

            // ── Step 2.5: Website Screenshot ──
            runScreenshotCapture(url.href);

            // ── Step 3: Instant homepage checks ──
            if (homepageDoc) {
                runStructuredDataCheck(homepageDoc);
                runIconsCheck(homepageDoc);
            } else {
                setCardError('schema-list', "Could not fetch homepage HTML.");
                setCardError('icons-list', "Could not fetch homepage HTML.");
            }

            // ── Step 4: robots.txt → llms.txt → sitemap (sequential) ──
            setStatus("Checking robots.txt…");
            const robotsSitemap = await runRobotsTxtInspector(url.origin);

            setStatus("Checking llms.txt…");
            await runLlmsTxtInspector(url.origin);

            setStatus("Checking sitemap.xml…");
            await runSitemapInspector(url.origin, robotsSitemap);

            // ── Step 5: Site-wide scan (H1 + Meta Titles across ≤50 pages) ──
            setStatus(`Scanning pages for H1 & Meta Title issues (0 of ${Math.min(internalLinks.length + 1, 50)})…`);
            await runSitewideScan(url.href, internalLinks, (done, total) => {
                setStatus(`Scanning pages for H1 & Meta Title issues (${done} of ${total})…`);
            });

            // ── Step 6: Internal link checker (sample 10) ──
            setStatus("Checking for broken internal links…");
            await runInternalLinkCheck(internalLinks);

            // ── Wait for Async Tasks ──
            await Promise.all([psPromise]);

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
        errorMsg.classList.add('hidden');
        statusMsg.classList.remove('hidden');
    }

    function stopLoading() {
        btn.disabled = false;
        btnText.classList.remove('hidden');
        spinner.classList.add('hidden');
        setTimeout(() => statusMsg.classList.add('hidden'), 2000);
    }

    function showResults() { results.classList.remove('hidden'); }
    function showError(msg) { errorMsg.textContent = msg; errorMsg.classList.remove('hidden'); }
    function setStatus(msg) { statusMsg.textContent = msg; }

    function clearResults() {
        ['speed-mobile', 'speed-desktop'].forEach(id => {
            const el = document.getElementById(id);
            el.textContent = '--';
            el.className = 'metric-circle';
        });
        ['h1-list', 'h1-stats', 'titles-list', 'titles-stats',
            'alt-list', 'alt-stats', 'canonical-list', 'canonical-stats', 'sitemap-list',
            'ai-list', 'llms-list', 'schema-list', 'broken-links-list',
            'security-list', 'security-stats', 'content-list', 'content-stats', 'icons-list'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = '';
            });
        document.getElementById('h1-subtitle').textContent = 'Will scan up to 50 pages…';
        document.getElementById('titles-subtitle').textContent = 'Will scan up to 50 pages…';
        document.getElementById('alt-subtitle').textContent = 'Will scan up to 50 pages…';
        document.getElementById('canonical-subtitle').textContent = 'Will scan up to 50 pages…';
        document.getElementById('security-subtitle').textContent = 'Will scan up to 50 pages…';
        document.getElementById('content-subtitle').textContent = 'Will scan up to 50 pages…';


        document.getElementById('ai-subtitle').textContent = 'Checking robots.txt for AI bots';
        document.getElementById('total-links').textContent = '0';
        document.getElementById('broken-links').textContent = '0';

        const sImg = document.getElementById('screenshot-img');
        const sPlace = document.getElementById('screenshot-placeholder');
        if (sImg) {
            sImg.src = '';
            sImg.classList.add('hidden');
        }
        if (sPlace) sPlace.classList.remove('hidden');

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
            return Math.round((data.lighthouseResult?.categories?.performance?.score || 0) * 100);
        };
        try {
            const [mobile, desktop] = await Promise.all([fetchScore('mobile'), fetchScore('desktop')]);
            [['mobile', mobile], ['desktop', desktop]].forEach(([type, score]) => {
                const el = document.getElementById(`speed-${type}`);
                el.textContent = score;
                el.className = 'metric-circle ' + (score >= 90 ? 'good' : score >= 50 ? 'needs-improvement' : 'poor');
            });
        } catch (e) {
            ['mobile', 'desktop'].forEach(t => { document.getElementById(`speed-${t}`).textContent = 'Err'; });
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
    //  Site-wide Scan: H1 + Meta Titles (≤50 pages)

    // ═══════════════════════════════════════

    async function runSitewideScan(homeUrl, links, onProgress) {
        // Always include the homepage, then up to 49 random internal pages
        const pool = [homeUrl, ...shuffle(links)].slice(0, 50);
        const total = pool.length;

        // Init UI
        document.getElementById('h1-list').innerHTML = '<li><div class="check-detail">Scanning…</div></li>';
        document.getElementById('titles-list').innerHTML = '<li><div class="check-detail">Scanning…</div></li>';

        const h1R = { ok: 0, missing: 0, multiple: 0, issues: [] };
        const titR = { ok: 0, missing: 0, long: 0, short: 0, issues: [] };
        const altR = { ok: 0, missing: 0, issues: [] };
        const canR = { ok: 0, missing: 0, multiple: 0, issues: [] };
        const secR = { ok: 0, missing: 0, issues: [] };
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
                    const h1s = Array.from(doc.querySelectorAll('h1'))
                        .map(el => el.textContent.trim()).filter(Boolean);
                    if (h1s.length === 0) {
                        h1R.missing++;
                        h1R.issues.push({ url: pageUrl, icon: 'err', label: 'Missing H1' });
                    } else if (h1s.length > 1) {
                        h1R.multiple++;
                        h1R.issues.push({ url: pageUrl, icon: 'warn', label: `Multiple H1 (${h1s.length})` });
                    } else {
                        h1R.ok++;
                    }

                    // 2. Meta Title
                    const titles = Array.from(doc.querySelectorAll('title'))
                        .map(el => el.textContent.trim()).filter(Boolean);
                    if (titles.length === 0) {
                        titR.missing++;
                        titR.issues.push({ url: pageUrl, icon: 'err', label: 'Missing Title' });
                    } else {
                        const len = titles[0].length;
                        if (len > 60) { titR.long++; titR.issues.push({ url: pageUrl, icon: 'warn', label: `Too Long (${len} chars)`, detail: titles[0] }); }
                        else if (len < 30) { titR.short++; titR.issues.push({ url: pageUrl, icon: 'warn', label: `Too Short (${len} chars)`, detail: titles[0] }); }
                        else { titR.ok++; }
                    }

                    // 3. HTTPS Check
                    if (pageUrl.startsWith('https://')) {
                        secR.ok++;
                    } else {
                        secR.missing++;
                        secR.issues.push({ url: pageUrl, icon: 'err', label: 'Insecure (HTTP)' });
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
                        const missing = imgs.filter(img => img.getAttribute('alt') === null || img.getAttribute('alt') === '').length;
                        if (missing > 0) {
                            altR.missing += missing;
                            altR.issues.push({ url: pageUrl, icon: 'err', label: `${missing} Missing/Empty Alt Tags` });
                        }
                        altR.ok += (imgs.length - missing);
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
        // ── Render Content results ──
        renderScanResults('content', cntR, 'All pages have sufficient content');
    }


    function renderScanResults(prefix, data, okMsg) {
        let total = (data.ok || 0) + (data.missing || 0) + (data.multiple || 0) + (data.long || 0) + (data.short || 0);
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
            const err = (prefix === 'content' ? 0 : data.missing) || 0;
            stats.innerHTML = statPills(data.ok, warn, err);
        }

        const list = document.getElementById(`${prefix}-list`);
        if (list) {
            list.innerHTML = data.issues.length === 0
                ? li('ok', okMsg, '')
                : data.issues.map(r => li(r.icon, r.label,
                    (r.detail ? `"${r.detail.slice(0, 50)}…" — ` : '') + linkTag(r.url)
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
        if (broken === 0) blList.innerHTML = li('ok', `No broken links found (sampled ${sample.length})`, '');
    }



    // ═══════════════════════════════════════
    //  AI Bot Whitelist (robots.txt) from my github
    // ═══════════════════════════════════════

    async function runRobotsTxtInspector(origin) {
        const bots = ["GPTBot", "Google-Extended", "Anthropic-AI", "FacebookBot", "Applebot-Extended",
            "CCBot", "Bytespider", "Googlebot", "Bingbot", "Yandex", "DuckDuckBot", "Baidu"];
        const list = document.getElementById('ai-list');
        list.innerHTML = '';
        try {
            const txt = await fetchViaProxy(`${origin}/robots.txt`);
            if (!txt) throw new Error("Empty");
            const lines = txt.split('\n').map(l => l.trim().toLowerCase());
            let html = '', allowed = 0;
            bots.forEach(bot => {
                const bLow = bot.toLowerCase();
                let found = false, blocked = false;
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].startsWith('user-agent:') && lines[i].includes(bLow)) {
                        found = true;
                        for (let j = i + 1; j < lines.length; j++) {
                            if (lines[j].startsWith('user-agent:')) break;
                            if (lines[j].startsWith('disallow: /')) blocked = true;
                        }
                        break;
                    }
                }
                if (found && !blocked) { html += li('ok', bot, 'Explicitly whitelisted.'); allowed++; }
                else if (found) { html += li('err', bot, 'Explicitly blocked.'); }
                else { html += li('warn', bot, 'Not explicitly mentioned.'); }
            });

            // Check for Sitemap link (now separate)
            const sitemapMatch = txt.match(/^sitemap:\s*(.+)$/im);
            const robotsSitemap = sitemapMatch ? sitemapMatch[1].trim() : null;

            list.innerHTML = html;
            document.getElementById('ai-subtitle').textContent = `Found ${allowed}/${bots.length} allowed.`;

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
    //  Web icons
    // ═══════════════════════════════════════

    function li(icon, title, detail) {
        const icons = { ok: '<span class="icon-ok">✅</span>', warn: '<span class="icon-warn">⚠️</span>', err: '<span class="icon-err">❌</span>' };
        return `<li><div class="check-status">${icons[icon] || ''} ${title}</div>${detail ? `<div class="check-detail">${detail}</div>` : ''}</li>`;
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
});
