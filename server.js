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

    const prompt = `You are a professional SEO consultant and skilled HTML designer. Based on the following audit data for the website "${domain}", generate a complete Mini Technical SEO Audit report as styled HTML.

OUTPUT FORMAT: Return ONLY the inner HTML content (no <html>, <head>, or <body> tags). Use inline CSS styles on every element for self-contained styling. The design must look premium and professional with a dark theme.

DESIGN REQUIREMENTS:
- Use a dark color scheme: backgrounds #0d1117 and #161b22, text #e6edf3, muted text #8b949e
- Include these visual elements:
  1. A header banner with the domain name and "Mini Technical SEO Audit" title, using a gradient background (from #6366f1 to #8b5cf6)
  2. An "Audit Snapshot" section with colored metric circles/badges: PageSpeed Mobile score, PageSpeed Desktop score, Passed/Warnings/Failed counts. Use green (#10b981) for good, orange (#f59e0b) for warnings, red (#ef4444) for failures
  3. A horizontal progress bar showing the pass/warn/fail ratio with corresponding colors
  4. Each problem in the Challenges section should be in a styled card with a red left border (#ef4444), numbered clearly
  5. Use emoji icons: ✅ for passed checks, ⚠️ for warnings, ❌ for failures
  6. Add a "Quick Wins" section with green left-border cards showing easy fixes found in the data
  7. Use proper spacing, rounded corners (8px), subtle borders (1px solid #30363d), and box shadows

TEMPLATE STRUCTURE (follow this exactly, filling in real data):

SECTION 1 - HEADER:
"Mini Technical SEO Audit" with domain name, styled as a banner

SECTION 2 - OVERVIEW:
"${domain} wants to rank higher for target keywords and generate more organic traffic. We analyzed 10 different factors in this mini technical SEO Audit, out of the 285 total factors that are included in the FULL version of the technical SEO Audit. The goal of this brief document is to provide an evaluation of challenges, which if resolved can be quick-win opportunities that can yield better rankings and higher organic traffic."

SECTION 3 - AUDIT SNAPSHOT:
Visual metrics dashboard showing PageSpeed scores, pass/warn/fail counts, and progress bar

SECTION 4 - CHALLENGES:
"In our brief evaluation of the current technical optimization status of ${domain} we identified problems and errors with the site architecture. These exact problems are among the top reasons why you're not ranking for more of your target keywords."
Then list Problem 1, Problem 2, etc. as styled cards. Be specific with numbers from the audit data. Aim for 3-6 problems.
End with: "All of the above problems have a direct negative impact on your organic rankings, visibility, and traffic and present a massive opportunity cost over the long term."

SECTION 5 - QUICK WINS:
List 2-3 easy fixes from the audit data as green-bordered cards (things that passed partially or are simple to fix)

SECTION 6 - SUMMARY:
"${domain} is an established website with valuable assets, links and content and many uncaptured opportunities, but also problems… In order to rank for more keywords, as well as rank higher for existing ones and outrank your competitors, we'd highly suggest taking care of the issues mentioned above. We'd also highly suggest considering our full technical SEO audit, where we take an in-depth look at 285 different technical factors, instead of just 10 covered in this mini technical SEO audit. When doing the full technical audit, it's very easy to find quick wins and optimizations that need to be done in order to dramatically increase existing organic traffic. An example of this would be one of the recent case studies that we just published, where weekly organic traffic jumped from 200,000 to 315,000 in 45 days, by simply changing a few settings and bits of code. (Results typically kick in 30-45 days after Google indexes the applied changes). We highly believe that we can find the same problems/opportunities if not even more if we were to audit ${domain}. In case of any questions, feel free to reach out to us at any time."

AUDIT DATA (JSON):
${JSON.stringify(auditData, null, 2)}

IMPORTANT RULES:
1. Only mention problems that are ACTUALLY present in the audit data. Do not invent problems.
2. If a check passed, do NOT list it as a problem.
3. Be specific — mention exact numbers (e.g., "3 pages have missing H1 tags", "PageSpeed mobile score is 34").
4. Keep the professional consultative tone throughout.
5. Return ONLY HTML content. No markdown, no code fences, no explanation.
6. Every element MUST have inline styles. Do not use <style> tags or external CSS.`;

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
