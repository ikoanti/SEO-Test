const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { runAudit } = require('./audit');

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

// ── Server-Side Audit Endpoint ──
app.post('/api/audit', async (req, res) => {
    const { url } = req.body || {};
    const startedAt = Date.now();

    console.log('[api:/api/audit] request started for ' + (url || '<missing-url>'));

    if (!url) {
        console.warn('[api:/api/audit] request rejected: missing url');
        return res.status(400).json({ error: 'url is required.' });
    }

    try {
        const audit = await runAudit(url);
        console.log('[api:/api/audit] request finished in ' + (Date.now() - startedAt) + 'ms');
        res.json(audit);
    } catch (error) {
        console.error('[api:/api/audit] request failed after ' + (Date.now() - startedAt) + 'ms:', error.message);
        res.status(500).json({ error: 'Failed to run audit: ' + error.message });
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

    const prompt = `You are a highly critical, senior SEO consultant and skilled HTML designer. Based on the following audit data for the website "${domain}", generate a comprehensive, unsparing Technical SEO & AI Audit report as styled HTML.

OUTPUT FORMAT: Return ONLY the inner HTML content (no <html>, <head>, or <body> tags). Use inline CSS styles on every element for self-contained styling.

DESIGN REQUIREMENTS:
- Dark color scheme: backgrounds #0d1117 and #161b22, text #e6edf3, muted text #8b949e
- Data visualization: Include HTML/CSS based bar charts, circular progress rings, and gauge charts to visualize key metrics.
- Visual elements:
  1. Header banner: domain name + "Mini Technical SEO & AI Audit" title, gradient background (#6366f1 to #8b5cf6)
  2. "Audit Snapshot" section: colored metric circles for PageSpeed Mobile, Desktop, Passed/Warnings/Failed counts. Green (#10b981) good, orange (#f59e0b) warnings, red (#ef4444) failures
  3. Horizontal pass/warn/fail progress bar
  4. Problem cards: dark background (#161b22), 4px left border colored by priority — red (#ef4444) for Urgent, orange (#f59e0b) for High, yellow (#eab308) for Medium. Rounded corners (8px), border (1px solid #30363d), box shadow, 20px padding, 16px margin-bottom
  5. Quick Win cards: same style but 4px GREEN (#10b981) left border
  6. Emoji: ❌ for failures/Urgent, ⚠️ for High, 🔶 for Medium, ✅ for Quick Wins

TEMPLATE STRUCTURE (follow EXACTLY):

═══ SECTION 1 — HEADER ═══
"Mini Technical SEO & AI Audit" with domain name, styled as a gradient banner.

═══ SECTION 2 — OVERVIEW ═══
"We conducted a strict evaluation of the technical and AI optimization status of ${domain}. We analyzed a fraction of the 285 total factors included in our FULL audit, and frankly, the results show significant room for improvement. The goal of this document is to expose the exact structural, technical, and speed bottlenecks that are currently sabotaging your rankings, AI visibility, and user experience."

═══ SECTION 3 — AUDIT SNAPSHOT & AI VISIBILITY ═══
Visual metrics dashboard with pass/warn/fail counts and progress bars.
Create a dedicated "Speed Index & Performance" sub-section: Include CSS-based visual gauges, data cards, or bar charts for PageSpeed Mobile/Desktop scores, and explicitly highlight Speed Index metrics (FCP, LCP, CLS, TBT) using styled visual boxes or progress rings. Comment critically on these scores and their negative impact on user retention and rankings.
Include a "Domain Authority" sub-section featuring Open Page Rank data: Create a beautiful visual representation (e.g., a styled badge, rank bar, or data card) for the Page Rank and Global Rank, commenting on site authority.
Include a critical "AI Visibility" sub-section with commentary on: AI Visibility Score, Monthly Audience, Mentions, Topic Opportunities — highlight how the current AI visibility is leaving massive opportunities on the table. Create CSS-based illustrations (bar charts or gauge charts) for these scores.


═══ SECTION 4 — CHALLENGES (Problems) ═══
Heading: "🔴 Challenges"
Intro paragraph: "In our evaluation of the current technical optimization status of ${domain} we identified problems and errors with the site architecture. These exact problems are among the top reasons why you're not ranking for more of your target keywords."

Then list EVERY SINGLE failed and warning issue from the audit data as a numbered Problem card. Each card MUST follow this EXACT format:

<div style="background:#161b22; border-left:4px solid [COLOR_BY_PRIORITY]; border:1px solid #30363d; border-radius:8px; padding:20px; margin-bottom:16px; box-shadow:0 2px 8px rgba(0,0,0,0.3);">
  <h3 style="color:[COLOR_BY_PRIORITY]; margin:0 0 4px 0;">[EMOJI] Problem N: [Descriptive Title]</h3>
  <div style="color:#8b949e; font-size:0.85rem; margin-bottom:12px;">Priority: [Urgent | High | Medium]</div>
  <p style="color:#e6edf3; line-height:1.7;">[2-4 paragraphs of detailed explanation with exact numbers from the audit data. Explain WHY this is a problem, what the negative SEO/traffic/conversion impact is, and what fixing it would achieve. Use the same consultative, critical tone as these examples:]</p>
</div>

EXAMPLE TONE & STYLE FOR PROBLEMS (match this writing style exactly):
- "At the moment your site scores only (X) out of 100 on Google's Page Speed Insight's test, this is currently negatively impacting both your conversion and organic rankings and we suggest fixing this as soon as possible."
- "One of the top SEO practices for on-page SEO is to always have only ONE H1 tag per page after all H1 tags are one of the top points that give Google the context of your page. At the moment, you have (X) pages with multiple H1 tags, which is negatively impacting their rankings and organic traffic."
- "We're noticing more and more traffic, as well as sales coming in from AI Chatbots such as ChatGPT, Perplexity, Gemini, etc - and with that, we need to ensure that your store is properly optimized, in order to maximize your visibility in AI Chatbots. Unfortunately, ${domain} is currently blocking ALL AI Chatbots and crawlers, which is having a significant negative impact on your visibility."
- "Missing alt tags for images can negatively impact your website's accessibility and SEO. Alt tags provide crucial information to visually impaired users and search engines. Currently, (X) images lack descriptions, affecting accessibility, user experience, and search visibility."

Issues to look for in the data (include ALL that have failed or warning status):
- AI Chatbots/LLMs Blocked (check robots.txt data for AI crawler blocking) → Priority: Urgent
- Unoptimized PageSpeed / Speed Index → Priority: High (include FCP, LCP, CLS, TBT numbers)
- Missing or Multiple H1 Tags → Priority: High (include exact page counts)
- Missing H1 Tags → Priority: High
- Meta Titles Too Long or Unoptimized → Priority: High
- Duplicated Page Titles → Priority: High
- Duplicated Meta Descriptions → Priority: Medium
- Overly Long Meta Descriptions → Priority: Medium
- Images with Missing Alt Text → Priority: High (include count)
- Missing Product/Organization Schema → Priority: Urgent/Medium
- Broken Internal Links / 4xx pages → Priority: High
- Missing Favicon or Apple Touch Icon → Priority: Medium
- Missing OpenGraph Tags → Priority: Medium
- Unoptimized Shopify URL Structure (collections/products duplication) → Priority: High
- SSL Issues → Priority: Urgent
- Missing Charset → Priority: Medium
- Heading Tag Misuse → Priority: Medium
- AI Visibility Score issues → Priority: High (comment on the score and what it means)
- Any other failed/warning checks in the data

Closing paragraph after all problems: "All of the above problems have a direct negative impact on your organic rankings, visibility, and traffic and present a massive opportunity cost over the long term."

═══ SECTION 5 — QUICK WINS ═══
Heading: "⚡ Quick Wins"
List 2-4 easy-to-fix items from the audit data as green-bordered cards using the same card format but with green (#10b981) left border and ✅ emoji. These are things that partially passed or are simple configuration changes. Each quick win should explain what to do and why it helps, in 1-2 paragraphs.

═══ SECTION 6 — SUMMARY ═══
Heading: "📋 Summary"
"${domain} is an established website with valuable assets, links and content and many uncaptured opportunities, but also problems… In order to rank for more keywords, as well as rank higher for existing ones and outrank your competitors, we'd highly suggest taking care of the issues mentioned above. We'd also highly suggest considering our full technical SEO audit, where we take an in-depth look at 285 different technical factors, instead of just the ones covered in this mini technical SEO audit. When doing the full technical audit, it's very easy to find quick wins and optimizations that need to be done in order to dramatically increase existing organic traffic. An example of this would be one of the recent case studies that we just published, where weekly organic traffic jumped from 200,000 to 315,000 in 45 days, by simply changing a few settings and bits of code. (Results typically kick in 30-45 days after Google indexes the applied changes). We highly believe that we can find the same problems/opportunities if not even more if we were to audit ${domain}. In case of any questions, feel free to reach out to us at any time."

AUDIT DATA (JSON):
${JSON.stringify(auditData)}

IMPORTANT RULES:
1. You MUST extract and explain EVERY SINGLE failed check and warning in the audit data as its own Problem card. Do not omit ANY. Do not invent problems not in the data.
2. Each Problem card must have: a numbered title, a Priority label (Urgent/High/Medium), and 2-4 paragraphs of detailed, critical explanation with exact numbers from the data.
3. Use the consultative, critical tone shown in the examples above. Write as if you are a senior SEO consultant presenting findings to a client.
4. Include as many exact numbers, counts, and figures as possible from the audit data.
5. Provide detailed commentary on the AI visibility score, speed index, PageSpeed scores, and all other metrics.
6. Use HTML/CSS charts and illustrations where possible to visualize key data.
7. Return ONLY HTML content. No markdown, no code fences, no explanation.
8. Every element MUST have inline styles. Do not use <style> tags or external CSS.`;

    try {
        const message = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 8192,
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
