# MTG Box Label Generator — Project Spec for Claude Code

## Project Overview

A Node.js web application that lets you search for Magic: The Gathering sets, view their metadata, and generate printable box labels (PDF) featuring the set symbol, name, release date, card count, set code, and more.

---

## Tech Stack

- **Runtime:** Node.js (v18+)
- **Frontend:** Plain HTML + CSS + Vanilla JS (single-page app, no framework needed)
- **Backend:** Express.js (serves the app and proxies API calls)
- **PDF Generation:** PDFKit or Puppeteer (for printing labels)
- **Data Source:** [Scryfall API](https://scryfall.com/docs/api) — free, no auth required
  - Sets endpoint: `https://api.scryfall.com/sets`
  - Individual set: `https://api.scryfall.com/sets/{code}`
  - Set SVG symbol: included in the API response as `icon_svg_uri`

---

## Project Structure

```
mtg-box-labels/
├── package.json
├── server.js              # Express server
├── public/
│   ├── index.html         # Main UI
│   ├── style.css          # Styling
│   └── app.js             # Frontend logic
├── label-generator.js     # PDF label generation logic
└── README.md
```

---

## Features — Version 1

### 1. Set Search & Browse
- On load, fetch all sets from Scryfall and display them in a searchable list
- Search/filter by set name or set code
- Filter by set type (core, expansion, masters, commander, etc.)
- Each set shows: name, code, release date, card count, set type

### 1b. Format Legality Filters (NEW)
- Display four toggle buttons at the top: **Standard**, **Historic**, **Legacy**, **Vintage**
- When a format toggle is active, all sets that contain cards legal in that format are automatically checked/selected
- Multiple formats can be active at once (union — a set is selected if it qualifies for *any* active format)
- A "Select None" and "Select All" button for quick overrides
- Format membership logic (based on Scryfall set data and known format rules):
  - **Standard** — sets currently legal in Standard (Scryfall provides a `card_count` per set; use the Scryfall bulk `/api/sets` data and cross-reference with the [Scryfall Standard legality list](https://scryfall.com/docs/api/sets)). A practical approach: fetch a single known Standard-legal card (e.g. a basic land) and check which sets appear in the `legalities.standard` field, OR maintain a set-type heuristic (recent expansion/core sets within ~2 years) and supplement with a hardcoded rotation boundary set code.
  - **Historic** — all sets legal on MTG Arena (set field `arena_code` is non-null, or set type is `expansion`, `core`, `masters`, `draft_innovation` released after Ixalan)
  - **Legacy** — nearly all paper sets are Legacy-legal; exclude: `funny` type sets (Unsets), `memorabilia`, `token`, `minigame`, `vanguard`, `planechase`, `archenemy`, digital-only sets
  - **Vintage** — same as Legacy plus unrestricted access; for labeling purposes treat Vintage as identical to Legacy (all non-joke, non-token paper sets)
- Each set row in the list shows small colored badge icons for which formats it's legal in (e.g. 🟢 S H L V)

### 2. Set Detail View
- Click a set to see full metadata:
  - Set name, code, set type
  - Release date
  - Total card count
  - Block (if applicable)
  - Set symbol (SVG rendered on page)
  - Link to Scryfall page

### 3. Label Generator
- Select one or multiple sets via checkboxes
- Choose label size:
  - Standard box label: 4" × 2" (fits standard card box front)
  - Tall box label: 4" × 3"
  - Custom size (user inputs width/height in inches)
- Label contents:
  - Large set symbol (SVG)
  - Set full name (large text)
  - Set code in corner
  - Release date
  - Card count (e.g. "306 Cards")
  - Set type (e.g. "Expansion")
  - Format legality badges: **Historic**, **Legacy**, **Vintage** only (e.g. "HIS · LEG · VIN") — Standard intentionally omitted as it rotates too frequently and would make labels go stale
  - Optional: custom note field (e.g. "Box 1 of 3")
- Generate a printable PDF with all selected labels
- PDF should have labels arranged for standard label paper (e.g. Avery 8163 — 2 per row, 5 per page)

### 4. Label Preview
- Live preview of the label in the browser before generating PDF
- Shows roughly how the printed label will look

---

## API Details (Scryfall)

### Get All Sets
```
GET https://api.scryfall.com/sets
```
Returns a list of set objects. Key fields per set:
- `name` — Full set name
- `code` — 3-5 letter set code
- `released_at` — ISO date string
- `card_count` — Number of cards
- `set_type` — Type (core, expansion, masters, etc.)
- `icon_svg_uri` — URL to the set symbol SVG
- `block` — Block name (if any)
- `block_code` — Block code
- `parent_set_code` — For subsets
- `digital` — Boolean (true for MTGO-only sets)
- `foil_only` / `nonfoil_only`
- `scryfall_uri` — Link to the set page

### Proxy Setup
To avoid CORS issues, the Express server should proxy requests to Scryfall:
- `GET /api/sets` → proxies to Scryfall sets list
- `GET /api/sets/:code` → proxies to individual set
- `GET /api/symbol?url=<icon_svg_uri>` → proxies/fetches the SVG icon

---

## Label Design Spec

```
┌─────────────────────────────────────┐
│  [SET SYMBOL]   SET NAME            │
│    (large)      Release: 2023-09-08 │
│                 Cards: 306          │
│  [SET CODE]     Type: Expansion     │
│                 Note: [custom]      │
└─────────────────────────────────────┘
```

- Background: white or light parchment color
- Set symbol: left-aligned, ~40% of label height
- Text: right column with name, metadata
- Thin border with slightly rounded corners
- Optional: color accent bar at top using set's colors (or a neutral MTG gold)

---

## PDF Output Spec

- Use PDFKit for PDF generation
- Default layout: Avery 8163 (4" × 2" labels, 2-up, 5 rows = 10 per page)
- Letter size pages (8.5" × 11")
- Margins: 0.5" top/bottom, 0.19" left/right (matching Avery 8163)
- Each label embedded as a rendered block
- SVG symbols: fetch the SVG, embed as image (convert to PNG via sharp or svg2img if needed)

---

## package.json Dependencies

```json
{
  "dependencies": {
    "express": "^4.18.0",
    "node-fetch": "^3.3.0",
    "pdfkit": "^0.14.0",
    "svg2img": "^1.0.0",
    "sharp": "^0.33.0"
  }
}
```

---

## Implementation Notes for Claude Code

1. **Start with the Express server** — set up routes for the API proxy first, then serve static files from `/public`.

2. **Frontend first, PDF second** — get the search UI and label preview working before implementing PDF generation.

3. **SVG handling** — Scryfall set symbols are SVGs. To embed in PDF, fetch the SVG bytes and convert to PNG using `sharp`. Cache fetched symbols in a `/tmp/symbols/` directory to avoid re-fetching.

4. **CORS** — all Scryfall API calls should go through the Express proxy (`/api/...`), not directly from the browser.

5. **Label preview** — render a live preview using an HTML `<canvas>` element or a styled `<div>` that mirrors what the PDF will look like.

6. **Format legality logic** — implement a `getSetFormats(set)` helper function in a shared `formats.js` module used by both the frontend and label generator. Logic:
   - **Vintage/Legacy**: `set.digital === false` AND `set.set_type` not in `['token','memorabilia','minigame','vanguard','planechase','archenemy','funny']`
   - **Historic**: same as Legacy/Vintage AND (`set.arena_code` is non-null OR set released on/after 2017-09-29 (Ixalan) with type `expansion` or `core`)
   - **Standard**: fetch `https://api.scryfall.com/sets` — Scryfall doesn't expose Standard legality directly per-set, so on startup make one extra call to `https://api.scryfall.com/cards/search?q=f:standard&unique=prints&select=set` to get the list of currently Standard-legal set codes, cache the result. Alternatively use a hardcoded rotation boundary (configurable in a `config.js` file so it's easy to update after rotation).

7. **Error handling** — Scryfall rate limits to ~10 req/sec. Add a small delay or cache the full sets list on first load (it's ~300KB).

7. **Filtering** — hide digital-only sets by default (add a toggle to show them).

---

## Future Features (v2+)

- Save/load a "collection inventory" (which sets you own, how many boxes)
- Custom color themes per set
- QR code on label linking to Scryfall set page
- Binder spine labels
- Support for custom/unofficial sets
- Electron wrapper for offline desktop app

---

## Getting Started Instructions (for README)

```bash
git clone <repo>
cd mtg-box-labels
npm install
node server.js
# Open http://localhost:3000
```

---

## Success Criteria for v1

- [ ] All MTG sets are searchable and browsable
- [ ] Format toggle buttons (Standard, Historic, Legacy, Vintage) auto-select relevant sets
- [ ] Sets display format legality badges in the list view
- [ ] Clicking a set shows full metadata and symbol
- [ ] User can select sets and generate a PDF of labels
- [ ] PDF labels are correctly sized for standard label paper

- [ ] Labels include set symbol, name, card count, release date, set type, and Historic/Legacy/Vintage format badges
- [ ] App runs locally with `node server.js`
