const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;


// Middleware
app.use(cors());
app.use(express.json());

// Open Page Rank API Configuration
const OPEN_PAGE_RANK_API_KEY = process.env.OPEN_PAGE_RANK_API_KEY;

if (!OPEN_PAGE_RANK_API_KEY) {
    console.warn('OPEN_PAGE_RANK_API_KEY is missing');
}

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

// Serve frontend static files
app.use(express.static(path.join(__dirname)));

// Fallback to index.html for SPA behavior if needed (optional)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
