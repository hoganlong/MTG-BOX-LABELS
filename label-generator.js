const PDFDocument = require('pdfkit');
const fetch = require('node-fetch');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { getSetFormats } = require('./public/formats');

// Symbol cache directory
const SYMBOL_CACHE_DIR = path.join(require('os').tmpdir(), 'mtg-symbols');
if (!fs.existsSync(SYMBOL_CACHE_DIR)) {
  fs.mkdirSync(SYMBOL_CACHE_DIR, { recursive: true });
}

// Avery 8163: 4" x 2" labels, 2-up, 5 rows, letter page
const LABEL_PRESETS = {
  standard: { width: 4, height: 2 },
  tall: { width: 4, height: 3 },
};

const DPI = 72; // PDFKit uses 72 points per inch
const PAGE_WIDTH = 8.5 * DPI;
const PAGE_HEIGHT = 11 * DPI;
const MARGIN_TOP = 0.5 * DPI;
const MARGIN_BOTTOM = 0.5 * DPI;
const MARGIN_LEFT = 0.19 * DPI;
const MARGIN_RIGHT = 0.19 * DPI;
const GAP_H = 0; // horizontal gap between labels
const GAP_V = 0; // vertical gap between labels

async function fetchSymbolAsPng(iconSvgUri, sizePx) {
  const cacheKey = iconSvgUri.replace(/[^a-z0-9]/gi, '_') + `_${sizePx}.png`;
  const cachePath = path.join(SYMBOL_CACHE_DIR, cacheKey);

  if (fs.existsSync(cachePath)) {
    return cachePath;
  }

  try {
    const res = await fetch(iconSvgUri, { headers: { 'User-Agent': 'MTGBoxLabels/1.0' } });
    if (!res.ok) return null;
    const svgBuffer = await res.buffer();

    const pngBuffer = await sharp(svgBuffer, { density: 300 })
      .resize(sizePx, sizePx, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toBuffer();

    fs.writeFileSync(cachePath, pngBuffer);
    return cachePath;
  } catch (err) {
    console.error('Symbol fetch/convert error:', err.message);
    return null;
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m, 10) - 1]} ${d}, ${y}`;
}

function getFormatBadges(set) {
  const formats = getSetFormats(set);
  const badges = [];
  if (formats.play)    badges.push('PLY');
  if (formats.legacy)  badges.push('LEG');
  if (formats.vintage) badges.push('VIN');
  return badges.join(' · ');
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
}

async function drawLabel(doc, set, x, y, labelW, labelH) {
  const pad = 6;
  const symbolSize = Math.floor(labelH * 0.55);

  // Background
  doc.save();
  doc.roundedRect(x, y, labelW, labelH, 4).fillAndStroke('#fffef8', '#c8a84b');
  doc.restore();

  // Gold accent bar at top
  doc.save();
  doc.rect(x, y, labelW, 4).fill('#c8a84b');
  doc.restore();

  // Set symbol
  const symbolPath = await fetchSymbolAsPng(set.icon_svg_uri, symbolSize * 2);
  const symX = x + pad;
  const symY = y + 10;
  if (symbolPath) {
    doc.image(symbolPath, symX, symY, { width: symbolSize, height: symbolSize });
  } else {
    // Fallback: draw code text
    doc.fontSize(10).fillColor('#888').text(set.code.toUpperCase(), symX, symY + symbolSize / 2 - 5, { width: symbolSize, align: 'center' });
  }

  // Set code large below symbol, sized to fill remaining height
  const codeAreaTop = symY + symbolSize + 2;
  const codeAreaH = y + labelH - pad - codeAreaTop;
  const codeFontSize = Math.max(6, Math.min(codeAreaH * 0.75, symbolSize * 0.55));
  const codeTextY = codeAreaTop + (codeAreaH - codeFontSize) / 2;
  doc.fontSize(codeFontSize).fillColor('#000000').font('Helvetica-Bold');
  doc.text(set.code.toUpperCase(), symX, codeTextY, { lineBreak: false });
  if (set.playNum != null) {
    doc.text(String(set.playNum), x + pad, codeTextY, { width: labelW - pad * 2, align: 'right', lineBreak: false });
  }

  // Right column
  const colX = x + pad + symbolSize + pad;
  const colW = labelW - colX + x - pad;
  let textY = y + 10;

  // Set name
  const nameFontSize = labelH > 2 * DPI ? 13 : 11;
  doc.fontSize(nameFontSize).fillColor('#1a1a1a').font('Helvetica-Bold');
  doc.text(set.name, colX, textY, { width: colW, lineBreak: true });
  textY = doc.y + 3;

  doc.fontSize(7.5).fillColor('#444444').font('Helvetica');

  const releaseDate = formatDate(set.released_at);
  const block = set.block ? `Block: ${set.block}` : null;

  const lines = [
    `Released: ${releaseDate}`,
    `${set.card_count} Cards`,
    `Type: ${capitalize(set.set_type)}`,
    block,
    set.note ? `Note: ${set.note}` : null,
  ].filter(Boolean);

  for (const line of lines) {
    if (textY + 9 > y + labelH - pad) break;
    doc.text(line, colX, textY, { width: colW });
    textY += 9;
  }
}

async function generateLabelsPDF(sets, options = {}) {
  const { labelSize = 'standard', customWidth, customHeight } = options;

  let lw, lh;
  if (labelSize === 'custom' && customWidth && customHeight) {
    lw = parseFloat(customWidth) * DPI;
    lh = parseFloat(customHeight) * DPI;
  } else {
    const preset = LABEL_PRESETS[labelSize] || LABEL_PRESETS.standard;
    lw = preset.width * DPI;
    lh = preset.height * DPI;
  }

  const usableW = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
  const usableH = PAGE_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM;

  const cols = Math.floor((usableW + GAP_H) / (lw + GAP_H));
  const rows = Math.floor((usableH + GAP_V) / (lh + GAP_V));
  const perPage = cols * rows;

  return new Promise(async (resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 0, autoFirstPage: true });
    const buffers = [];
    doc.on('data', chunk => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    let i = 0;
    for (const set of sets) {
      if (i > 0 && i % perPage === 0) {
        doc.addPage();
      }
      const pos = i % perPage;
      const col = pos % cols;
      const row = Math.floor(pos / cols);
      const x = MARGIN_LEFT + col * (lw + GAP_H);
      const y = MARGIN_TOP + row * (lh + GAP_V);

      await drawLabel(doc, set, x, y, lw, lh);
      i++;
    }

    doc.end();
  });
}

module.exports = { generateLabelsPDF };
