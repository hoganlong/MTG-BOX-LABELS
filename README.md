# MTG Box Label Generator

A local Node.js web app for browsing Magic: The Gathering sets and generating printable PDF labels for your card boxes. Set data comes from the [Scryfall API](https://scryfall.com/docs/api); labels are laid out for Avery 8163 sheets (4" × 2", 2-up × 5 rows = 10 per page).

## Requirements

- Node.js v18 or newer
- npm (bundled with Node)

## Install & run

```powershell
npm install      # first time, or after pulling new dependencies
npm start        # equivalent to: node server.js
```

Then open <http://localhost:3000> in a browser. Press `Ctrl+C` in the terminal to stop.

To use a different port:

```powershell
$env:PORT = 4000
npm start
```

## How to use

1. **Browse sets.** All Scryfall sets load on first open. Use the search box (name or code) and the type dropdown to filter. "Hide digital-only" is on by default.
2. **Filter by format.** The colored format buttons (Standard / Play / Legacy / Vintage) act as toggles — clicking one shows only sets legal in that format. Multiple toggles combine as a union.
   - *Play* is a custom format used here for organizing physical boxes; it covers tournament-legal expansion/core/starter sets and excludes older non-tournament-legal core sets.
3. **Preview a label.** Click any row (not the checkbox) to see a live canvas preview in the right panel using the current label size and note.
4. **Select sets.** Check the boxes next to the sets you want labels for. Use **Select All** / **Select None** for quick bulk changes (Select All applies to the current filtered view).
5. **Choose a label size.** Standard (4" × 2"), Tall (4" × 3"), or Custom (enter width / height in inches).
6. **Optional note.** Add a custom note (e.g. "Box 1 of 3") — it appears on every label in the batch.
7. **Generate PDF.** Click **Generate PDF**. The file `mtg-box-labels.pdf` downloads automatically and is ready to print on Avery 8163 (or compatible) label sheets.

## What's on each label

- Large set symbol (left)
- Set name (top right) with release date, card count, set type, block, and your optional note
- Set code (bottom left) and the Play number (bottom right) when applicable

Play numbers: base sets are pinned (`B1` = LEA/LEB/2ED, `B2` = M10, …, `B12` = FDN); all other Play-legal sets get an incrementing integer in release-date order.

## Project layout

```
server.js              Express server + Scryfall proxy + PDF endpoint
label-generator.js     PDFKit rendering and Avery 8163 layout
config.js              Standard rotation cutoff date
public/
  index.html           UI
  app.js               State, filtering, canvas preview, PDF request
  formats.js           Legality logic (Standard/Play/Legacy/Vintage)
  style.css            Dark gold-on-brown theme
```

## Notes

- Scryfall responses are cached server-side for 1 hour; SVG symbols are converted to PNG with `sharp` and cached in your OS temp directory under `mtg-symbols/`.
- After each fall Standard rotation, update `STANDARD_CUTOFF_DATE` in `config.js` and `public/formats.js`.
