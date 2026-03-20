const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const PORT = process.env.PORT || 3000;


// Middleware
app.use(cors());
app.use(express.json());

// Open Page Rank API Configuration
const OPEN_PAGE_RANK_API_KEY = process.env.OPEN_PAGE_RANK_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!OPEN_PAGE_RANK_API_KEY) {
    console.warn('OPEN_PAGE_RANK_API_KEY is missing');
}
if (!ANTHROPIC_API_KEY) {
    console.warn('ANTHROPIC_API_KEY is missing');
}

const anthropic = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;

// ── Open Page Rank Proxy Endpoint ──
app.get('/api/opr', async (req, res) => {
    const { domain } = req.query;

    if (!OPEN_PAGE_RANK_API_KEY) {
        return res.status(500).json({ error: 'OPEN_PAGE_RANK_API_KEY is not configured on the server' });
    }

    if (!domain) return res.status(400).json({ error: "Target domain is required" });

    try {
        const response = await axios.get('https://openpagerank.com/api/v1.0/getPageRank', {
            params: { 'domains[]': domain },
            headers: { 'API-OPR': OPEN_PAGE_RANK_API_KEY }
        });

        res.json(response.data);
    } catch (error) {
        console.error("Open Page Rank Proxy Error:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
    }
});


// ── Generic Site Proxy Endpoint ──
// Used for fetching homepage HTML, robots.txt, sitemaps, etc.
app.get('/api/proxy', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: "URL is required" });

    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 10000
        });
        res.send(response.data);
    } catch (error) {
        console.error("General Proxy Error:", error.message);
        res.status(error.response?.status || 500).json({ error: error.message });
    }
});

// ── Redirect Check Endpoint ──
app.get('/api/check-redirect', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: "URL is required" });

    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 8000,
            maxRedirects: 0,
            validateStatus: status => status >= 200 && status < 400
        });

        const isRedirect = response.status >= 300 && response.status < 400;
        const location = isRedirect ? response.headers.location : null;

        res.json({
            status: response.status,
            isRedirect,
            location
        });
    } catch (error) {
        res.status(500).json({ error: error.message, status: 0 });
    }
});

// ── Claude Report Generation Endpoint ──
app.post('/api/generate-report', async (req, res) => {
    const { domain, auditData } = req.body;

    if (!anthropic) {
        return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured on the server.' });
    }
    if (!domain || !auditData) {
        return res.status(400).json({ error: 'domain and auditData are required.' });
    }

    const prompt = `You are a professional SEO consultant. Based on the following audit data for the website "${domain}", generate a complete Mini Technical SEO Audit report.

Use EXACTLY this template structure and tone. Replace all placeholders with real data from the audit. Write in a professional, consultative tone. Do NOT use markdown formatting — write in plain text with clear section headers.

--- BEGIN TEMPLATE ---

Mini Technical SEO Audit
${domain}


Overview

${domain} wants to rank higher for target keywords and generate more organic traffic.

We analyzed 10 different factors in this mini technical SEO Audit, out of the 285 total factors that are included in the FULL version of the technical SEO Audit.

The goal of this brief document is to provide an evaluation of challenges, which if resolved can be quick-win opportunities that can yield better rankings and higher organic traffic.


Challenges

In our brief evaluation of the current technical optimization status of ${domain} we identified many problems and errors with the site architecture.

These exact problems are among the top reasons why you're not ranking for more of your target keywords and in some cases are stuck at the bottom of page 1.

The main problems are listed below:

[List each real problem detected from the audit data as "Problem N: description". Be specific — reference actual findings like missing H1 tags, duplicate titles, broken links, missing canonical tags, low PageSpeed scores, missing SSL, thin content, etc. Only list problems that were actually found. Aim for 3-6 problems.]

All of the above problems have a direct negative impact on your organic rankings, visibility, and traffic and present a massive opportunity cost over the long term.


Summary

${domain} is an established website with valuable assets, links and content and many uncaptured opportunities, but also problems…

In order to rank for more keywords, as well as rank higher for existing ones and outrank your competitors, we'd highly suggest taking care of the issues mentioned above.

We'd also highly suggest considering our full technical SEO audit, where we take an in-depth look at 285 different technical factors, instead of just 10 covered in this mini technical SEO audit.

When doing the full technical audit, it's very easy to find quick wins and optimizations that need to be done in order to dramatically increase existing organic traffic.

An example of this would be one of the recent case studies that we just published, where weekly organic traffic jumped from 200,000 to 315,000 in 45 days, by simply changing a few settings and bits of code.

(Results typically kick in 30-45 days after Google indexes the applied changes).

We highly believe that we can find the same problems/opportunities if not even more if we were to audit ${domain}.

In case of any questions, feel free to reach out to us at any time.

--- END TEMPLATE ---

Here is the audit data (JSON):
${JSON.stringify(auditData, null, 2)}

IMPORTANT RULES:
1. Only mention problems that are ACTUALLY present in the audit data. Do not invent problems.
2. If a check passed, do NOT list it as a problem.
3. Be specific in the Challenges section — mention exact numbers (e.g., "3 pages have missing H1 tags", "PageSpeed mobile score is 34").
4. Keep the professional consultative tone throughout.
5. Output the report as plain text, ready to be copied into a document.`;

    try {
        const message = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4096,
            messages: [{ role: 'user', content: prompt }]
        });

        res.json({ report: message.content[0].text });
    } catch (error) {
        console.error('Claude API Error:', error.message);
        res.status(500).json({ error: 'Failed to generate report: ' + error.message });
    }
});

// Serve frontend static files
app.use(express.static(path.join(__dirname)));

// Fallback to index.html for SPA behavior if needed (optional)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
