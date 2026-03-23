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
app.use(express.json({ limit: '50mb' }));

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

    const prompt = `You are a highly critical, meticulous SEO auditor and skilled HTML designer. Based on the following audit data for the website "${domain}", generate a complete, unsparing Mini Technical SEO Audit report as styled HTML. 

OUTPUT FORMAT: Return ONLY the inner HTML content (no <html>, <head>, or <body> tags). Use inline CSS styles on every element for self-contained styling. The design must look high-end, data-dense, and professional with a dark theme.

DESIGN REQUIREMENTS:
- Use a dark color scheme: backgrounds #0d1117 and #161b22, text #e6edf3, muted text #8b949e
- Data visualization is mandatory: Include as many HTML/CSS based illustrations, bar charts, circular progress rings, and data figures as possible to visualize the metrics.
- Include these visual elements:
  1. A header banner with the domain name and "Critical Mini Technical SEO & AI Audit" title, using a gradient background (from #6366f1 to #8b5cf6)
  2. An "Audit Snapshot" section with colored metric circles/badges: PageSpeed Mobile score, PageSpeed Desktop score, Passed/Warnings/Failed counts. Use green (#10b981) for good, orange (#f59e0b) for warnings, red (#ef4444) for failures
  3. A horizontal progress bar showing the pass/warn/fail ratio with corresponding colors
  4. Each problem in the Challenges section should be in a styled card with a red left border (#ef4444), numbered clearly
  5. Use emoji icons: ✅ for passed checks, ⚠️ for warnings, ❌ for critical failures. Emphasize failures using bold red colors.
  6. Add a "Quick Wins" section with green left-border cards showing easy fixes found in the data
  7. Use proper spacing, rounded corners (8px), subtle borders (1px solid #30363d), and box shadows.

TEMPLATE STRUCTURE (follow this exactly, filling in real data):

SECTION 1 - HEADER:
"Critical Mini Technical SEO & AI Audit" with domain name, styled as a banner

SECTION 2 - OVERVIEW:
"We conducted a strict evaluation of the technical and AI optimization status of ${domain}. We analyzed a fraction of the 285 total factors included in our FULL audit, and frankly, the results show significant room for improvement. The goal of this document is to expose the exact structural, technical, and speed bottlenecks that are currently sabotaging your rankings, AI visibility, and user experience."

SECTION 3 - AUDIT SNAPSHOT & AI VISIBILITY:
Visual metrics dashboard showing PageSpeed scores, Speed Index, pass/warn/fail counts, and progress bars. 
Explicitly include a deeply critical "AI Visibility" sub-section. You MUST comment extensively on the "AI Visibility Score", "Monthly Audience", "Mentions", and "Topic Opportunities", adding a critical assessment of how the current AI visibility is leaving massive opportunities on the table. Create CSS-based illustrations (like bar charts or gauge charts) to visually represent these scores.
Also, explicitly comment on the PageSpeed index and scores, strongly highlighting the negative impact on user retention and SEO if they are less than perfect.

SECTION 4 - CRITICAL CHALLENGES:
"Our analysis uncovered severe technical liabilities on ${domain}. These specific errors are actively penalizing your search visibility, squandering your crawl budget, and destroying your AI search presence."
Then list Problem 1, Problem 2, etc. as styled cards. Focus heavily on numbers, percentages, and figures from the audit data. Include 4-7 severe problems.
CRITICAL INSTRUCTION FOR CHALLENGES: You MUST include a balanced mix of BOTH standard technical SEO audit issues (like PageSpeed, speed index, Alt Tags, Meta Titles, Robots.txt, missing icons) AND AI Visibility report issues based on the uploaded data. Do not hold back; the tone must be critical and urgent.
End with: "Every single day these problems remain unresolved is a day you are bleeding organic traffic and failing to capture your target audience."

SECTION 5 - QUICK WINS:
List 2-3 easy fixes from the audit data as green-bordered cards (things that passed partially or are simple to fix)

SECTION 6 - SUMMARY:
"${domain} has severe vulnerabilities and massive uncaptured opportunities. To have any chance of outranking your competitors and securing visibility in both traditional and AI-driven search engines, you must address the issues highlighted above immediately. We strongly advise proceeding with our full, comprehensive 285-point technical SEO audit to uncover the remaining underlying issues. In a recent case study, addressing these exact types of foundational flaws caused a client's weekly organic traffic to surge from 200,000 to 315,000 in just 45 days. We anticipate similar, if not more dramatic, recovery opportunities for ${domain}. Contact us to resolve these critical issues."

AUDIT DATA (JSON):
${JSON.stringify(auditData)}

IMPORTANT RULES:
1. Only mention problems that are ACTUALLY present in the audit data. Do not invent problems, but extract every negative detail you can find.
2. Be extremely specific — use exact numbers, ratios, and percentages (e.g., "3 out of 50 pages have missing H1 tags", "PageSpeed mobile score is a disastrous 34").
3. Use HTML/CSS to draw charts/illustrations where possible to make the report visually data-rich.
4. Keep the tone highly critical, urgent, and professional.
5. Provide detailed commentary on the AI visibility score and speed index.
6. Return ONLY HTML content. No markdown, no code fences, no explanation.
7. Every element MUST have inline styles. Do not use <style> tags or external CSS.`;

    try {
        const message = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2048,
            messages: [{ role: 'user', content: prompt }]
        });

        res.json({ report: message.content[0].text });
    } catch (error) {
        console.error('Claude API Error:', error.message);
        res.status(500).json({ error: 'Failed to generate report: ' + error.message });
    }
});

// ── AI Visibility PDF Analysis Endpoint ──
// Accepts { pdfBase64: "base64_string" } and returns extracted metrics.
app.post('/api/parse-pdf', async (req, res) => {
    const { pdfBase64 } = req.body;

    if (!anthropic) {
        return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured on the server.' });
    }
    if (!pdfBase64) {
        return res.status(400).json({ error: 'pdfBase64 is required.' });
    }

    const prompt = `You are an AI that extracts specific metrics from an SEO PDF report. 
Please look at the provided document and extract the following exact numbers/values:
1. AI Visibility (number scale 0-100)
2. Monthly Audience (string e.g. "2.87M")
3. Mentions (number)
4. Cited Pages (number)
5. Your Performing Topics (number)
6. Topic Opportunities (string e.g. "2.52K")
7. Cited Sources (number)
8. Source Opportunities (string e.g. "13.68K")

Return the result STRICTLY as a JSON object with these exact keys: 
"aiVisibility", "monthlyAudience", "mentions", "citedPages", "performingTopics", "topicOpportunities", "citedSources", "sourceOpportunities".

Do NOT include any markdown formatting, backticks, or explanation. ONLY output the raw JSON object.`;

    try {
        const message = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            messages: [{
                role: 'user',
                content: [
                    {
                        type: 'document',
                        source: {
                            type: 'base64',
                            media_type: 'application/pdf',
                            data: pdfBase64
                        }
                    },
                    {
                        type: 'text',
                        text: prompt
                    }
                ]
            }]
        });

        const responseText = message.content[0].text.trim();
        res.json(JSON.parse(responseText));
    } catch (error) {
        console.error('Claude API PDF Parse Error:', error.message);
        res.status(500).json({ error: 'Failed to analyze PDF: ' + error.message });
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
