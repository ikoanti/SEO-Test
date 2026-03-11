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

// Ahrefs API Configuration
const AHREFS_API_KEY = process.env.AHREFS_API_KEY;

if (!AHREFS_API_KEY) {
    console.warn('AHREFS_API_KEY is missing');
}

// ── Ahrefs Proxy Endpoint ──
app.get('/api/ahrefs', async (req, res) => {
    const { target, date, mode, country } = req.query;

    if (!AHREFS_API_KEY) {
        return res.status(500).json({ error: 'AHREFS_API_KEY is not configured on the server' });
    }

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
