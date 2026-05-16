// ── State ──────────────────────────────────────────────────────
let allSets = [];
let activeFormats = new Set();
let selectedSets = new Set(); // set codes
let previewSetCode = null;
let currentLabelSize = 'standard';

// ── DOM refs ───────────────────────────────────────────────────
const searchInput = document.getElementById('search-input');
const typeSelect = document.getElementById('type-select');
const hideDigitalChk = document.getElementById('hide-digital');
const setListEl = document.getElementById('set-list');
const selectedCountEl = document.getElementById('selected-count');
const generateBtn = document.getElementById('generate-btn');
const customNoteInput = document.getElementById('custom-note');
const previewCanvas = document.getElementById('preview-canvas');
const previewEmpty = document.getElementById('preview-empty');
const previewCaption = document.getElementById('preview-set-name');
const customSizeDiv = document.getElementById('custom-size');
const customWidthInput = document.getElementById('custom-width');
const customHeightInput = document.getElementById('custom-height');

// ── Play set numbering ─────────────────────────────────────────
// Base sets get a fixed "B#" label. All other Play sets get incrementing integers.
const BASE_SET_NUMBERS = {
  lea: 'B1', leb: 'B1', '2ed': 'B1',
  m10: 'B2', m11: 'B3', m12: 'B4', m13: 'B5', m14: 'B6',
  m15: 'B7', ori: 'B8', m19: 'B9', m20: 'B10', m21: 'B11', fdn: 'B12',
};
let playSetNumbers = {}; // code -> number or "B#" string

function computePlayNumbers(sets) {
  const playSets = sets
    .filter(s => isPlayLegal(s))
    .sort((a, b) => (a.released_at || '').localeCompare(b.released_at || ''));

  let counter = 2;
  for (const set of playSets) {
    if (BASE_SET_NUMBERS[set.code]) {
      playSetNumbers[set.code] = BASE_SET_NUMBERS[set.code];
    } else {
      playSetNumbers[set.code] = counter++;
    }
  }
}

// ── Init ───────────────────────────────────────────────────────
async function init() {
  try {
    const res = await fetch('/api/sets');
    const data = await res.json();
    allSets = data.data || [];
    computePlayNumbers(allSets);
    renderList();
  } catch (err) {
    setListEl.innerHTML = `<div id="loading" style="color:#f44">Failed to load sets: ${err.message}</div>`;
  }
}

// ── Filtering ──────────────────────────────────────────────────
function getFilteredSets() {
  const query = searchInput.value.toLowerCase().trim();
  const typeFilter = typeSelect.value;
  const hideDigital = hideDigitalChk.checked;

  return allSets.filter(set => {
    if (hideDigital && set.digital) return false;
    if (typeFilter && set.set_type !== typeFilter) return false;
    if (query && !set.name.toLowerCase().includes(query) && !set.code.includes(query)) return false;

    if (activeFormats.size > 0) {
      const formats = getSetFormats(set);
      const match = [...activeFormats].some(f => formats[f]);
      if (!match) return false;
    }

    return true;
  });
}

// ── Rendering ──────────────────────────────────────────────────
function renderList() {
  const sets = getFilteredSets();

  if (!sets.length) {
    setListEl.innerHTML = '<div id="loading">No sets match your filters.</div>';
    return;
  }

  const fragment = document.createDocumentFragment();

  sets.forEach(set => {
    const formats = getSetFormats(set);
    const isSelected = selectedSets.has(set.code);
    const isPreviewing = previewSetCode === set.code;

    const row = document.createElement('div');
    row.className = 'set-row' + (isSelected ? ' selected' : '') + (isPreviewing ? ' previewing' : '');
    row.dataset.code = set.code;

    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = isSelected;
    chk.addEventListener('click', e => { e.stopPropagation(); toggleSelect(set.code); });

    const nameCell = document.createElement('div');
    nameCell.className = 'set-name-cell';

    const img = document.createElement('img');
    img.className = 'set-icon';
    img.src = `/api/symbol?url=${encodeURIComponent(set.icon_svg_uri)}`;
    img.alt = '';
    img.width = 18;
    img.height = 18;

    const nameText = document.createElement('span');
    nameText.className = 'set-name-text';
    nameText.textContent = set.name;

    nameCell.append(img, nameText);

    const codeCell = document.createElement('div');
    codeCell.className = 'set-code';
    const playNum = playSetNumbers[set.code];
    const codeSpan = document.createElement('span');
    codeSpan.textContent = set.code.toUpperCase();
    codeCell.appendChild(codeSpan);
    if (playNum != null) {
      const numSpan = document.createElement('span');
      numSpan.textContent = playNum;
      codeCell.appendChild(numSpan);
    }

    const dateCell = document.createElement('div');
    dateCell.className = 'set-date';
    dateCell.textContent = set.released_at || '—';

    const countCell = document.createElement('div');
    countCell.className = 'set-count';
    countCell.textContent = set.card_count;

    const badgesCell = document.createElement('div');
    badgesCell.className = 'format-badges';
    if (formats.standard) badgesCell.appendChild(makeBadge('S', 'badge-s'));
    if (formats.play)     badgesCell.appendChild(makeBadge('P', 'badge-p'));
    if (formats.legacy)   badgesCell.appendChild(makeBadge('L', 'badge-l'));
    if (formats.vintage)  badgesCell.appendChild(makeBadge('V', 'badge-v'));

    const numCell = document.createElement('div');
    numCell.className = 'set-num';
    numCell.textContent = playNum != null ? playNum : '';

    row.append(chk, nameCell, codeCell, dateCell, countCell, badgesCell, numCell);

    row.addEventListener('click', () => {
      previewSet(set);
    });

    fragment.appendChild(row);
  });

  setListEl.innerHTML = '';
  setListEl.appendChild(fragment);
}

function makeBadge(label, cls) {
  const span = document.createElement('span');
  span.className = `badge ${cls}`;
  span.textContent = label;
  return span;
}

// ── Selection ──────────────────────────────────────────────────
function toggleSelect(code) {
  if (selectedSets.has(code)) {
    selectedSets.delete(code);
  } else {
    selectedSets.add(code);
  }
  updateSelectedCount();
  renderList();
}

function updateSelectedCount() {
  const n = selectedSets.size;
  selectedCountEl.textContent = `${n} set${n !== 1 ? 's' : ''} selected`;
  generateBtn.disabled = n === 0;
}

// ── Format toggles ─────────────────────────────────────────────
document.querySelectorAll('.format-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const format = btn.dataset.format;
    if (activeFormats.has(format)) {
      activeFormats.delete(format);
      btn.classList.remove('active');
    } else {
      activeFormats.add(format);
      btn.classList.add('active');
    }
    renderList();
  });
});

document.getElementById('select-all-btn').addEventListener('click', () => {
  getFilteredSets().forEach(set => selectedSets.add(set.code));
  updateSelectedCount();
  renderList();
});

document.getElementById('select-none-btn').addEventListener('click', () => {
  selectedSets.clear();
  updateSelectedCount();
  renderList();
});

// ── Search / filter listeners ──────────────────────────────────
searchInput.addEventListener('input', renderList);
typeSelect.addEventListener('change', renderList);
hideDigitalChk.addEventListener('change', renderList);

// ── Label size buttons ─────────────────────────────────────────
document.querySelectorAll('.size-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentLabelSize = btn.dataset.size;
    customSizeDiv.style.display = currentLabelSize === 'custom' ? 'flex' : 'none';
    if (previewSetCode) {
      const set = allSets.find(s => s.code === previewSetCode);
      if (set) drawPreview(set);
    }
  });
});

// Redraw preview when custom dimensions change
customWidthInput.addEventListener('input', () => { if (previewSetCode) redrawPreview(); });
customHeightInput.addEventListener('input', () => { if (previewSetCode) redrawPreview(); });
customNoteInput.addEventListener('input', () => { if (previewSetCode) redrawPreview(); });

function redrawPreview() {
  const set = allSets.find(s => s.code === previewSetCode);
  if (set) drawPreview(set);
}

// ── Label Preview (canvas) ─────────────────────────────────────
const PREVIEW_DPI = 96;

function getLabelDimensions() {
  if (currentLabelSize === 'custom') {
    const w = parseFloat(customWidthInput.value) || 4;
    const h = parseFloat(customHeightInput.value) || 2;
    return { w: w * PREVIEW_DPI, h: h * PREVIEW_DPI };
  }
  const presets = { standard: [4, 2], tall: [4, 3] };
  const [wi, hi] = presets[currentLabelSize] || [4, 2];
  return { w: wi * PREVIEW_DPI, h: hi * PREVIEW_DPI };
}

function previewSet(set) {
  previewSetCode = set.code;
  renderList(); // update highlight
  drawPreview(set);
}

async function drawPreview(set) {
  const { w, h } = getLabelDimensions();
  const scale = Math.min(300 / w, 1.5);
  const cw = Math.round(w * scale);
  const ch = Math.round(h * scale);

  previewCanvas.width = cw;
  previewCanvas.height = ch;
  previewCanvas.style.display = 'block';
  previewEmpty.style.display = 'none';

  const ctx = previewCanvas.getContext('2d');
  ctx.scale(scale, scale);

  // Background
  ctx.fillStyle = '#fffef8';
  roundRect(ctx, 0, 0, w, h, 4 / scale);
  ctx.fill();

  // Border
  ctx.strokeStyle = '#c8a84b';
  ctx.lineWidth = 1.5 / scale;
  roundRect(ctx, 0.75 / scale, 0.75 / scale, w - 1.5 / scale, h - 1.5 / scale, 4 / scale);
  ctx.stroke();

  // Gold accent bar
  ctx.fillStyle = '#c8a84b';
  ctx.fillRect(0, 0, w, 4);

  const pad = 8;
  const symbolSize = Math.floor(h * 0.55);
  const symX = pad;
  const symY = 10;

  // Set symbol
  try {
    const svgUrl = `/api/symbol?url=${encodeURIComponent(set.icon_svg_uri)}`;
    const img = await loadImage(svgUrl);
    ctx.drawImage(img, symX, symY, symbolSize, symbolSize);
  } catch (_) {
    ctx.fillStyle = '#aaa';
    ctx.font = `bold ${symbolSize * 0.3}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(set.code.toUpperCase(), symX + symbolSize / 2, symY + symbolSize / 2 + 5);
  }

  // Set code large below symbol, filling remaining height
  const codeAreaTop = symY + symbolSize + 2;
  const codeAreaH = h - pad - codeAreaTop;
  const codeFontSize = Math.max(6, Math.min(codeAreaH * 0.75, symbolSize * 0.55));
  const codeTextY = codeAreaTop + (codeAreaH + codeFontSize) / 2;
  ctx.fillStyle = '#000000';
  ctx.font = `bold ${codeFontSize}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText(set.code.toUpperCase(), symX, codeTextY);
  if (playSetNumbers[set.code] != null) {
    ctx.textAlign = 'right';
    ctx.fillText(String(playSetNumbers[set.code]), w - pad, codeTextY);
  }

  // Right column
  const colX = symX + symbolSize + pad;
  const colW = w - colX - pad;
  let ty = 12;
  ctx.textAlign = 'left';

  // Set name
  const nameFontSize = h > 2 * PREVIEW_DPI ? 13 : 11;
  ctx.fillStyle = '#1a1a1a';
  ctx.font = `bold ${nameFontSize}px sans-serif`;
  const nameLines = wrapText(ctx, set.name, colW);
  for (const line of nameLines) {
    if (ty + nameFontSize > h - pad) break;
    ctx.fillText(line, colX, ty + nameFontSize);
    ty += nameFontSize + 1;
  }
  ty += 4;

  ctx.fillStyle = '#444';
  ctx.font = `${8}px sans-serif`;

  const note = customNoteInput.value.trim();

  const lines = [
    `Released: ${formatDateStr(set.released_at)}`,
    `${set.card_count} Cards`,
    `Type: ${capitalize(set.set_type)}`,
    set.block ? `Block: ${set.block}` : null,
    note ? `Note: ${note}` : null,
  ].filter(Boolean);

  for (const line of lines) {
    if (ty + 9 > h - pad) break;
    ctx.fillText(line, colX, ty + 9);
    ty += 10;
  }

  previewCaption.textContent = `Preview: ${set.name}`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

const imageCache = {};
function loadImage(src) {
  if (imageCache[src]) return imageCache[src];
  const p = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
  imageCache[src] = p;
  return p;
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function formatDateStr(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m, 10) - 1]} ${d}, ${y}`;
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
}

// ── PDF Generation ─────────────────────────────────────────────
generateBtn.addEventListener('click', async () => {
  const note = customNoteInput.value.trim();
  const selectedSetData = allSets
    .filter(s => selectedSets.has(s.code))
    .map(s => ({ ...s, note, playNum: playSetNumbers[s.code] ?? null }));

  if (!selectedSetData.length) return;

  generateBtn.disabled = true;
  generateBtn.textContent = 'Generating...';

  try {
    const payload = {
      sets: selectedSetData,
      labelSize: currentLabelSize,
      customWidth: parseFloat(customWidthInput.value) || 4,
      customHeight: parseFloat(customHeightInput.value) || 2,
    };

    const res = await fetch('/api/generate-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json();
      alert(`PDF error: ${err.error}`);
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mtg-box-labels.pdf';
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert(`Failed to generate PDF: ${err.message}`);
  } finally {
    generateBtn.disabled = selectedSets.size === 0;
    generateBtn.textContent = 'Generate PDF';
  }
});

// ── Start ──────────────────────────────────────────────────────
init();
