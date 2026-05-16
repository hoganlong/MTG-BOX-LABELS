const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const { generateLabelsPDF } = require('./label-generator');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Cache for sets data
let setsCache = null;
let setsCacheTime = 0;
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

// Cache for standard-legal set codes
let standardSetsCache = null;
let standardCacheTime = 0;

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'MTGBoxLabels/1.0' }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 500 * (i + 1)));
    }
  }
}

// Proxy: GET all sets
app.get('/api/sets', async (req, res) => {
  try {
    const now = Date.now();
    if (setsCache && now - setsCacheTime < CACHE_TTL) {
      return res.json(setsCache);
    }
    const response = await fetchWithRetry('https://api.scryfall.com/sets');
    const data = await response.json();
    setsCache = data;
    setsCacheTime = now;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Proxy: GET single set by code
app.get('/api/sets/:code', async (req, res) => {
  try {
    const response = await fetchWithRetry(`https://api.scryfall.com/sets/${req.params.code}`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Proxy: GET SVG symbol by URL
app.get('/api/symbol', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url || !url.startsWith('https://svgs.scryfall.io/')) {
      return res.status(400).json({ error: 'Invalid symbol URL' });
    }
    const response = await fetchWithRetry(url);
    const svg = await response.text();
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svg);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Proxy: GET standard-legal set codes
app.get('/api/standard-sets', async (req, res) => {
  try {
    const now = Date.now();
    if (standardSetsCache && now - standardCacheTime < CACHE_TTL) {
      return res.json(standardSetsCache);
    }

    // Fetch Standard-legal cards that are NOT reprints — this gives us only the
    // sets where new Standard-legal cards were first printed, avoiding old sets
    // (e.g. Mirage) that merely contain reprints of Standard-legal basics.
    const response = await fetchWithRetry(
      'https://api.scryfall.com/cards/search?q=f%3Astandard+-is%3Areprint&unique=cards&order=set'
    );
    const data = await response.json();
    const codes = new Set();
    if (data.data) {
      data.data.forEach(card => codes.add(card.set));
    }

    // Handle pagination — Scryfall returns up to 175 per page
    let next = data.next_page;
    while (next) {
      const page = await fetchWithRetry(next);
      const pageData = await page.json();
      if (pageData.data) pageData.data.forEach(card => codes.add(card.set));
      next = pageData.next_page;
      await new Promise(r => setTimeout(r, 100)); // respect rate limit
    }

    standardSetsCache = { codes: Array.from(codes) };
    standardCacheTime = now;
    res.json(standardSetsCache);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate PDF
app.post('/api/generate-pdf', async (req, res) => {
  try {
    const { sets, labelSize, customWidth, customHeight } = req.body;
    if (!sets || !sets.length) {
      return res.status(400).json({ error: 'No sets provided' });
    }

    const pdfBuffer = await generateLabelsPDF(sets, { labelSize, customWidth, customHeight });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="mtg-box-labels.pdf"');
    res.send(pdfBuffer);
  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`MTG Box Labels running at http://localhost:${PORT}`);
});
