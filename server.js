const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const { GoogleGenerativeAI } = require('@google-generative-ai/generative-ai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Gemini API Configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyAyA5-k0G98_qSpmHu5FOAq_AU330b3U4E';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Middleware
app.use(cors());
app.use(express.json());

// Ahrefs API Configuration
const AHREFS_API_KEY = process.env.AHREFS_API_KEY;

// ── Gemini Summarize Endpoint ──
app.post('/api/summarize', async (req, res) => {
    const { issues, url } = req.body;

    if (!issues || !Array.isArray(issues)) {
        return res.status(400).json({ error: "Issues array is required" });
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `
You are a senior SEO consultant. Below are the audit findings for: ${url}

Issues detected:
${issues.map(i => `- [${i.type.toUpperCase()}] [${i.category}] ${i.label}`).join('\n')}

Write a brief, professional audit summary in plain English. Structure it like this:

### Overview
One or two sentences describing the overall health of the site.

### Critical Issues
Bullet list of the most urgent problems (errors only). Be specific.

### Recommended Fixes
Bullet list of top 3–5 prioritized actions, starting with the highest-impact fix.

Rules:
- Keep the total response under 200 words.
- Use simple, non-technical language where possible.
- Do not repeat the URL or list every single issue — focus on patterns and priorities.
`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        res.json({ summary: text });
    } catch (error) {
        console.error("Gemini Error:", error);
        res.status(500).json({ error: "Failed to generate AI summary. " + error.message });
    }
});

// ── Ahrefs Proxy Endpoint ──
app.get('/api/ahrefs', async (req, res) => {
    const { target, date, mode, country } = req.query;

    if (!target) return res.status(400).json({ error: "Target domain is required" });

    const baseUrl = 'https://api.ahrefs.com/v3/site-explorer';
    const headers = { 'Authorization': `Bearer ${AHREFS_API_KEY}` };

    try {
        const [drRes, bsRes, mtRes] = await Promise.all([
            axios.get(`${baseUrl}/domain-rating`, { params: { target, date, mode }, headers }),
            axios.get(`${baseUrl}/backlinks-stats`, { params: { target, date, mode }, headers }),
            axios.get(`${baseUrl}/metrics`, { params: { target, date, mode, country }, headers })
        ]);

        res.json({
            domain_rating: drRes.data,
            backlinks_stats: bsRes.data,
            metrics: mtRes.data
        });
    } catch (error) {
        console.error("Ahrefs Proxy Error:", error.response?.data || error.message);
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

// Serve frontend static files
app.use(express.static(path.join(__dirname)));

// Fallback to index.html for SPA behavior if needed (optional)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
