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

            // ── Step 3: Instant homepage checks ──
            if (homepageDoc) {
                runImageAltCheck(homepageDoc);
                runCanonicalCheck(homepageDoc, url.href);
                runStructuredDataCheck(homepageDoc);
            } else {
                setCardError('alt-list', "Could not fetch homepage HTML.");
                setCardError('canonical-list', "Could not fetch homepage HTML.");
                setCardError('schema-list', "Could not fetch homepage HTML.");
            }

            // ── Step 4: robots.txt → llms.txt → sitemap (sequential) ──
            setStatus("Checking robots.txt…");
            await runRobotsTxtInspector(url.origin);

            setStatus("Checking llms.txt…");
            await runLlmsTxtInspector(url.origin);

            setStatus("Checking sitemap.xml…");
            await runSitemapInspector(url.origin);

            // ── Step 5: Site-wide scan (H1 + Meta Titles across ≤50 pages) ──
            setStatus(`Scanning pages for H1 & Meta Title issues (0 of ${Math.min(internalLinks.length + 1, 50)})…`);
            await runSitewideScan(url.href, internalLinks, (done, total) => {
                setStatus(`Scanning pages for H1 & Meta Title issues (${done} of ${total})…`);
            });

            // ── Step 6: Internal link checker (sample 10) ──
            setStatus("Checking for broken internal links…");
            await runInternalLinkCheck(internalLinks);

            // ── Wait for PageSpeed ──
            await psPromise;

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
            'alt-list', 'canonical-list', 'sitemap-list',
            'ai-list', 'llms-list', 'schema-list', 'broken-links-list'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = '';
            });
        document.getElementById('h1-subtitle').textContent = 'Will scan up to 50 pages…';
        document.getElementById('titles-subtitle').textContent = 'Will scan up to 50 pages…';
        document.getElementById('ai-subtitle').textContent = 'Checking robots.txt for AI bots';
        document.getElementById('total-links').textContent = '0';
        document.getElementById('broken-links').textContent = '0';
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

        // Proxy 1 – corsproxy.io
        try {
            const res = await withTimeout(fetch(`https://corsproxy.io/?${enc}`), 8000);
            if (res.ok) { const t = await res.text(); if (t) return t; }
        } catch (e) { console.warn("corsproxy:", e.message); }

        // Proxy 2 – allorigins
        try {
            const res = await withTimeout(fetch(`https://api.allorigins.win/get?url=${enc}`), 8000);
            if (res.ok) {
                const d = await res.json();
                if (d.status?.http_code >= 400) throw new Error(`HTTP ${d.status.http_code}`);
                if (d.contents) return d.contents;
            }
        } catch (e) { console.warn("allorigins:", e.message); }

        // Proxy 3 – codetabs
        try {
            const res = await withTimeout(fetch(`https://api.codetabs.com/v1/proxy?quest=${enc}`), 8000);
            if (res.ok) { const t = await res.text(); if (t) return t; }
        } catch (e) { console.warn("codetabs:", e.message); }

        throw new Error("All proxies failed for: " + url);
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
    //  2. Image Alt Tags (homepage)
    // ═══════════════════════════════════════

    function runImageAltCheck(doc) {
        const list = document.getElementById('alt-list');
        const imgs = Array.from(doc.querySelectorAll('img'));
        if (imgs.length === 0) {
            list.innerHTML = li('warn', 'No Images Found', 'No &lt;img&gt; elements on the homepage.');
            return;
        }
        const missing = imgs.filter(img => img.getAttribute('alt') === null);
        const empty = imgs.filter(img => img.getAttribute('alt') === '');
        const good = imgs.length - missing.length;
        list.innerHTML = li('ok', `${good}/${imgs.length} Images Have Alt Text`, '');
        if (missing.length > 0) {
            const previews = missing.slice(0, 5).map(img => {
                const src = (img.getAttribute('src') || '(no src)').slice(0, 70);
                return `<div class="check-detail">${src}</div>`;
            }).join('');
            list.innerHTML += li('err', `${missing.length} Missing Alt Attribute`, previews);
        }
        if (empty.length > 0) {
            list.innerHTML += li('warn', `${empty.length} Empty Alt (decorative)`, 'alt="" is valid for decorative images.');
        }
    }

    // ═══════════════════════════════════════
    //  3. Canonical URL (homepage)
    // ═══════════════════════════════════════

    function runCanonicalCheck(doc, pageUrl) {
        const list = document.getElementById('canonical-list');
        const tags = Array.from(doc.querySelectorAll('link[rel="canonical"]'));
        if (tags.length === 0) {
            list.innerHTML = li('err', 'No Canonical Tag', 'Missing &lt;link rel="canonical" href="…"&gt;');
        } else if (tags.length > 1) {
            list.innerHTML = li('warn', `Multiple Canonicals (${tags.length})`, 'Only one canonical tag should exist.');
            tags.forEach(t => { list.innerHTML += `<li><div class="check-detail">${t.getAttribute('href')}</div></li>`; });
        } else {
            const href = tags[0].getAttribute('href') || '';
            const norm = (u) => u.replace(/\/$/, '');
            const isSelf = norm(href) === norm(pageUrl);
            list.innerHTML = li(isSelf ? 'ok' : 'warn',
                isSelf ? 'Self-referencing Canonical ✓' : 'Canonical Points Elsewhere',
                href);
        }
    }

    // ═══════════════════════════════════════
    //  5. Sitemap.xml
    // ═══════════════════════════════════════

    async function runSitemapInspector(origin) {
        const list = document.getElementById('sitemap-list');
        const paths = ['/sitemap.xml', '/sitemap_index.xml', '/sitemap.xml.gz'];
        for (const path of paths) {
            try {
                const txt = await fetchViaProxy(`${origin}${path}`);
                if (txt && (txt.includes('<urlset') || txt.includes('<sitemapindex'))) {
                    const urls = (txt.match(/<url>/g) || []).length;
                    const maps = (txt.match(/<sitemap>/g) || []).length;
                    list.innerHTML = li('ok', `Found at ${path}`,
                        maps > 0 ? `Sitemap index with ${maps} child sitemaps.` : `${urls} URL entries.`);
                    return;
                }
            } catch (e) { }
        }
        list.innerHTML = li('err', 'No Sitemap Found', `Checked: ${paths.join(', ')}`);
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
            const t = obj['@type'];
            if (Array.isArray(t)) {
                t.forEach(v => { if (v) allTypes.push(v); });
            } else if (t) {
                allTypes.push(t);
            } else {
                allTypes.push('Unknown');
            }
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
        let done = 0;

        // Concurrency pool of 5
        for (let i = 0; i < pool.length; i += 5) {
            const batch = pool.slice(i, i + 5);
            await Promise.all(batch.map(async pageUrl => {
                try {
                    const html = await fetchViaProxy(pageUrl);
                    const doc = new DOMParser().parseFromString(html, 'text/html');

                    // H1
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

                    // Meta Title
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
                } catch (e) { /* skip unreachable page */ }
                done++;
                onProgress(done, total);
            }));
            if (i + 5 < pool.length) await delay(300);
        }

        // ── Render H1 results ──
        const h1Total = h1R.ok + h1R.missing + h1R.multiple;
        document.getElementById('h1-subtitle').textContent = `Scanned ${h1Total} page${h1Total !== 1 ? 's' : ''}`;
        document.getElementById('h1-stats').innerHTML = statPills(h1R.ok, h1R.multiple, h1R.missing);
        const h1List = document.getElementById('h1-list');
        h1List.innerHTML = h1R.issues.length === 0
            ? li('ok', 'All pages have a single H1', '')
            : h1R.issues.map(r => li(r.icon, r.label, linkTag(r.url))).join('');

        // ── Render Meta Title results ──
        const tTotal = titR.ok + titR.missing + titR.long + titR.short;
        document.getElementById('titles-subtitle').textContent = `Scanned ${tTotal} page${tTotal !== 1 ? 's' : ''}`;
        document.getElementById('titles-stats').innerHTML = statPills(titR.ok, titR.long + titR.short, titR.missing);
        const tList = document.getElementById('titles-list');
        tList.innerHTML = titR.issues.length === 0
            ? li('ok', 'All titles look good', '')
            : titR.issues.map(r => li(r.icon, r.label,
                (r.detail ? `"${r.detail.slice(0, 50)}…" — ` : '') + linkTag(r.url)
            )).join('');
    }

    // ═══════════════════════════════════════
    //  Internal Link Checker (sample 10)
    // ═══════════════════════════════════════

    async function runInternalLinkCheck(links) {
        const blList = document.getElementById('broken-links-list');
        document.getElementById('total-links').textContent = links.length;
        const sample = links.slice(0, 10);
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
    //  AI Bot Whitelist (robots.txt)
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
            list.innerHTML = html;
            document.getElementById('ai-subtitle').textContent = `Found ${allowed}/${bots.length} explicitly allowed.`;
        } catch (e) {
            list.innerHTML = li('err', 'robots.txt not found or unavailable.', '');
        }
    }

    // ═══════════════════════════════════════
    //  LLMs.txt Inspector
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
    //  Shared UI Utilities
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
