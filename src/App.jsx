   import React, { useEffect, useMemo, useRef, useState } from "react";

/* ========= utilitaires de téléchargement (robustes) ========= */
async function saveFile(dataOrUrl, filename) {
  try {
    const mod = await import("file-saver"); // chargé dynamiquement si dispo
    const saveAs = mod.saveAs || mod.default;
    return saveAs(dataOrUrl, filename);
  } catch {
    const url = typeof dataOrUrl === "string" ? dataOrUrl : URL.createObjectURL(dataOrUrl);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (typeof dataOrUrl !== "string") setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
}

async function getJsPDF() {
  try {
    const m = await import("jspdf");
    return m.jsPDF || m.default;
  } catch {
    return window.jspdf?.jsPDF || null; // si tu ajoutes le CDN dans index.html
  }
}

/* ==================== Palettes couleurs ===================== */
/* BrickLink – codes officiels (approx hex pour affichage) */
const BL = [
  ["White", "#F2F3F2", 1, false],
  ["Black", "#000000", 26, false],
  ["Very Light Gray", "#E6E6E6", 49, false],
  ["Light Gray", "#9BA19D", 9, false],
  ["Light Bluish Gray", "#A3A2A4", 86, false],
  ["Dark Bluish Gray", "#6D6E5C", 85, false],
  ["Red", "#C91A09", 5, false],
  ["Dark Red", "#720E0F", 59, false],
  ["Orange", "#F08F1C", 4, false],
  ["Medium Orange", "#F19F4D", 31, false],
  ["Yellow", "#F2CD37", 3, false],
  ["Bright Light Yellow", "#FFF07A", 103, false],
  ["Tan", "#E4CD9E", 2, false],
  ["Dark Tan", "#958A73", 69, false],
  ["Light Nougat", "#F6D7B3", 90, false],
  ["Nougat", "#CC8E69", 18, false],
  ["Medium Nougat", "#AE7A59", 150, false],
  ["Reddish Brown", "#5C1E0F", 88, false],
  ["Brown", "#6B3F20", 8, false],
  ["Fabuland Brown", "#C56E2D", 160, false],
  ["Pink", "#FFB5D1", 221, false],
  ["Dark Pink", "#DA70D6", 47, false],
  ["Magenta", "#A0006D", 71, false],
  ["Blue", "#0055BF", 7, false],
  ["Dark Blue", "#0B3B8F", 63, false],
  ["Medium Blue", "#6C9BD2", 42, false],
  ["Bright Light Blue", "#9BC4E2", 102, false],
  ["Royal Blue", "#2C4DA7", 272, false],
  ["Dark Azure", "#0072A3", 153, false],
  ["Medium Azure", "#36A3E1", 156, false],
  ["Sand Blue", "#6074A1", 55, false],
  ["Dark Turquoise", "#008A8A", 39, false],
  ["Bright Green", "#4B9F4A", 36, false],
  ["Green", "#237841", 6, false],
  ["Dark Green", "#184632", 80, false],
  ["Lime", "#A6CA3A", 34, false],
  ["Olive Green", "#808E42", 330, false],
  ["Sand Green", "#A3C3A2", 48, false],
  ["Yellowish Green", "#C9D872", 226, false],
  ["Light Aqua", "#A7DCD6", 152, false],
  ["Coral", "#FF6F61", 353, false],
  ["Sand Red", "#A75D5E", 58, false],
  // Transparences
  ["Trans-Clear", "#E6F2F2", 12, true],
  ["Trans-Black", "#635F52", 251, true],
  ["Trans-Red", "#DE0000", 17, true],
  ["Trans-Orange", "#F08F1C", 98, true],
  ["Trans-Neon Orange", "#FF800D", 18, true],
  ["Trans-Yellow", "#F5CD2A", 19, true],
  ["Trans-Neon Yellow", "#E9F72C", 121, true],
  ["Trans-Green", "#5AC35E", 20, true],
  ["Trans-Neon Green", "#C0FF00", 16, true],
  ["Trans-Blue", "#0094FF", 43, true],
  ["Trans-Dark Blue", "#0B2E6F", 14, true],
  ["Trans-Medium Blue", "#6EC1E4", 74, true],
  ["Trans-Light Blue", "#A3D2F2", 15, true],
  ["Trans-Purple", "#5F2683", 51, true],
  ["Trans-Dark Pink", "#C94A83", 50, true],
  ["Trans-Pink", "#DF6695", 107, true],
  ["Trans-Brown", "#6F4E37", 13, true],
];

/* Palette fournisseur KKBBRICKS (01→99) */
const SUPPLIER = [
  [1, "White", "#F2F3F2", false], [2, "Very Light Gray", "#E6E6E6", false],
  [3, "Light Gray", "#9BA19D", false], [4, "Medium Gray", "#B7B7B7", false],
  [5, "Dark Gray", "#6D6E5C", false], [6, "Black", "#000000", false],
  [7, "Light Bluish Gray", "#A3A2A4", false], [8, "Dark Bluish Gray", "#6D6E5C", false],
  [9, "Eggshell", "#F2E6D6", false], [10, "Eggshell Pink", "#F7E1E8", false],
  [11, "Light Nougat", "#F6D7B3", false], [12, "Medium Tan", "#CBAE86", false],
  [13, "Nougat", "#CC8E69", false], [14, "Medium Nougat", "#AE7A59", false],
  [15, "Flesh", "#D78E76", false], [16, "Fabuland Brown", "#C56E2D", false],
  [17, "Brown", "#6B3F20", false], [18, "Dark Brown", "#4C2F27", false],
  [19, "Tan", "#E4CD9E", false], [20, "Dark Tan", "#958A73", false],
  [21, "Light Yellow", "#FFF07A", false], [22, "Yellow", "#F2CD37", false],
  [23, "Dark Yellow", "#D5A021", false], [24, "Medium Orange", "#F19F4D", false],
  [25, "Orange", "#F08F1C", false], [26, "Light Salmon", "#F6D5C9", false],
  [27, "Pink", "#FFB5D1", false], [28, "Dark Pink", "#DA70D6", false],
  [29, "Magenta", "#A0006D", false], [30, "Red", "#C91A09", false],
  [31, "Dark Red", "#720E0F", false], [32, "Sand Red", "#A75D5E", false],
  [33, "Lavender", "#CDA4DE", false], [34, "Medium Lavender", "#A06EBB", false],
  [35, "Purple", "#6A0DAD", false], [36, "Bright Light Blue", "#9BC4E2", false],
  [37, "Medium Blue", "#6C9BD2", false], [38, "Medium Azure", "#36A3E1", false],
  [39, "Royal Blue", "#2C4DA7", false], [40, "Dark Azure", "#0072A3", false],
  [41, "Blue", "#0055BF", false], [42, "Dark Blue", "#0B3B8F", false],
  [43, "Sand Blue", "#6074A1", false], [44, "Yellowish Green", "#C9D872", false],
  [45, "Lime", "#A6CA3A", false], [46, "Olive Green", "#808E42", false],
  [47, "Sand Green", "#A3C3A2", false], [48, "Dark Turquoise", "#008A8A", false],
  [49, "Bright Green", "#4B9F4A", false], [50, "Green", "#237841", false],
  [51, "Dark Green", "#184632", false], [52, "Military Green", "#5A6B54", false],
  [53, "Light Aqua", "#A7DCD6", false], [54, "Coral", "#FF6F61", false],
  [85, "Trans-Black", "#635F52", true], [86, "Trans-Brown", "#6F4E37", true],
  [87, "Trans-Purple", "#5F2683", true], [88, "Trans-Dark Pink", "#C94A83", true],
  [89, "Trans-Pink", "#DF6695", true], [90, "Trans-Neon Orange", "#FF800D", true],
  [91, "Trans-Orange", "#F08F1C", true], [92, "Trans-Neon Green", "#C0FF00", true],
  [93, "Trans-Green", "#5AC35E", true], [94, "Trans-Blue", "#0094FF", true],
  [95, "Trans-Light Blue", "#A3D2F2", true], [96, "Trans-Red", "#DE0000", true],
  [97, "Trans-Yellow", "#F5CD2A", true], [98, "Trans-Clear", "#E6F2F2", true],
  [99, "Trans-Medium Blue", "#6EC1E4", true],
];

/* ========================= helpers ========================= */
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const sqr = (x) => x * x;
const hexToRgb = (h) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(h || "").trim());
  if (!m) return [200, 200, 200];
  const v = m[1];
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
};
const luminance = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const nearestIdx = ([r, g, b], pal) => {
  let best = 1e18, idx = 0;
  for (let i = 0; i < pal.length; i++) {
    const [, rgb] = pal[i];
    const d = sqr(rgb[0] - r) + sqr(rgb[1] - g) + sqr(rgb[2] - b);
    if (d < best) { best = d; idx = i; }
  }
  return idx;
};

/* Ajustements image */
function applyBrightnessContrast(data, brightPct, contrastPct) {
  const B = clamp(brightPct, -100, 100) / 100 * 255; // -255..+255
  const C = clamp(contrastPct, -100, 100);
  const f = (259 * (C + 255)) / (255 * (259 - C)); // contraste
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i] + B, g = data[i + 1] + B, b = data[i + 2] + B;
    r = clamp(f * (r - 128) + 128, 0, 255);
    g = clamp(f * (g - 128) + 128, 0, 255);
    b = clamp(f * (b - 128) + 128, 0, 255);
    data[i] = r; data[i + 1] = g; data[i + 2] = b;
  }
}
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
      default: h = 0;
    }
    h /= 6;
  }
  return [h, s, l];
}
function hslToRgb(h, s, l) {
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}
function applySaturation(data, satPct) {
  const sDelta = clamp(satPct, -100, 100) / 100;
  if (sDelta === 0) return;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    let [h, s, l] = rgbToHsl(r, g, b);
    s = clamp(s + sDelta * (sDelta > 0 ? 1 - s : s), 0, 1);
    const [nr, ng, nb] = hslToRgb(h, s, l);
    data[i] = nr; data[i + 1] = ng; data[i + 2] = nb;
  }
}

/* corrélation fournisseur → BrickLink : renvoie [label, rgb, codeBL, isTrans, meta] */
function correlateSupplierToBL(listSupplier, listBL) {
  const bl = listBL.map(([n, hex, code, t]) => [n, hexToRgb(hex), code, t]);
  return listSupplier.map(([supCode, name, hex, isTrans]) => {
    const rgb = hexToRgb(hex);
    const j = nearestIdx(rgb, bl);
    const [blName, , blCode, blTrans] = bl[j];
    return [
      `${name} (#${String(supCode).padStart(2, "0")})`,
      rgb,
      blCode,
      isTrans || blTrans,
      { supplierCode: supCode, supplierName: name, blName, blCode },
    ];
  });
}

/* draw crop -> canvas W×H */
function drawCroppedToRect(img, target, gridW, gridH, zoom, dx, dy) {
  const ctx = target.getContext("2d", { willReadFrequently: true });
  target.width = gridW; target.height = gridH;
  const aspect = gridW / gridH, z = Math.max(1, zoom);
  let vw = img.width / z, vh = vw / aspect;
  if (vh > img.height / z) { vh = img.height / z; vw = vh * aspect; }
  const maxX = img.width - vw, maxY = img.height - vh;
  const sx = clamp(img.width / 2 - vw / 2 + dx * maxX, 0, maxX);
  const sy = clamp(img.height / 2 - vh / 2 + dy * maxY, 0, maxY);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  ctx.clearRect(0, 0, gridW, gridH);
  ctx.drawImage(img, sx, sy, vw, vh, 0, 0, gridW, gridH);
}

/* ============================ App =========================== */
export default function App() {
  // Images
  const [files, setFiles] = useState([]);
  const [images, setImages] = useState([]);
  const [idxImg, setIdxImg] = useState(0);

  // Grille
  const [W, setW] = useState(48);
  const [H, setH] = useState(64);

  // Cadrage
  const [zoom, setZoom] = useState(1.15);
  const [offX, setOffX] = useState(0);
  const [offY, setOffY] = useState(0);

  // Ajustements
  const [bright, setBright] = useState(0);     // -100 .. 100
  const [contrast, setContrast] = useState(0); // -100 .. 100
  const [saturation, setSaturation] = useState(0); // -100 .. 100

  // Palette
  const [useSupplier, setUseSupplier] = useState(true);  // par défaut : toutes tes couleurs
  const [inclTrans, setInclTrans] = useState(true);

  // Sections (aperçu : lignes seulement, pas de numéros)
  const [secCols, setSecCols] = useState(3);
  const [secRows, setSecRows] = useState(4);
  const [showSectionGrid, setShowSectionGrid] = useState(true);

  // Refs & comptage
  const mosaicRef = useRef(null);
  const tinyRef = useRef(null);
  const [counts, setCounts] = useState([]);
  const totalPieces = W * H;

  // charger fichiers
  useEffect(() => {
    if (!files.length) { setImages([]); return; }
    let cancel = false;
    (async () => {
      const arr = [];
      for (const f of files) {
        const url = URL.createObjectURL(f);
        await new Promise((res) => { const im = new Image(); im.onload = () => (arr.push(im), res()); im.src = url; });
      }
      if (!cancel) setImages(arr);
    })();
    return () => { cancel = true; };
  }, [files]);

  // Palettes prêtes
  const PAL_SUPPLIER = useMemo(() => correlateSupplierToBL(SUPPLIER, BL), []);
  const PAL_BL = useMemo(() => BL.map(([n, hex, code, t]) => [n, hexToRgb(hex), code, t]), []);
  const palette = useMemo(() => {
    const src = useSupplier ? PAL_SUPPLIER : PAL_BL;
    return src.filter((p) => (inclTrans ? true : !p[3]));
  }, [useSupplier, inclTrans, PAL_SUPPLIER, PAL_BL]);

  // Rendu aperçu (aucun numéro)
  function process(img) {
    const tiny = tinyRef.current, mosaic = mosaicRef.current;
    drawCroppedToRect(img, tiny, W, H, zoom, offX, offY);

    // récupère pixels et applique les ajustements
    const id = tiny.getContext("2d").getImageData(0, 0, W, H);
    const data = id.data;
    applyBrightnessContrast(data, bright, contrast);
    applySaturation(data, saturation);

    // quantification vers la palette
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const j = nearestIdx([data[i], data[i + 1], data[i + 2]], palette);
      const [, rgb] = palette[j];
      data[i] = rgb[0]; data[i + 1] = rgb[1]; data[i + 2] = rgb[2];
    }
    tiny.getContext("2d").putImageData(id, 0, 0);

    // comptage
    const cts = new Map();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const j = nearestIdx([data[i], data[i + 1], data[i + 2]], palette);
      const name = palette[j][0];
      cts.set(name, (cts.get(name) || 0) + 1);
    }
    setCounts([...cts.entries()].sort((a, b) => b[1] - a[1]));

    // dessin
    const cell = 14;
    mosaic.width = W * cell; mosaic.height = H * cell;
    const g = mosaic.getContext("2d"); g.clearRect(0, 0, mosaic.width, mosaic.height);

    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const j = nearestIdx([data[i], data[i + 1], data[i + 2]], palette);
      const [, rgb] = palette[j];
      const cx = x * cell, cy = y * cell;
      const pad = Math.max(1, Math.floor(cell * 0.12)), rad = (cell - pad * 2) / 2;
      g.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
      g.strokeStyle = "#111"; g.lineWidth = Math.max(1, Math.floor(cell * 0.06));
      g.beginPath(); g.arc(cx + cell / 2, cy + cell / 2, rad, 0, Math.PI * 2); g.fill(); g.stroke();
      // *** pas de numéros dans l’aperçu ***
    }

    // grille de la mosaïque
    g.strokeStyle = "rgba(0,0,0,0.18)"; g.lineWidth = 1;
    for (let i = 0; i <= W; i++) { g.beginPath(); g.moveTo(i * cell, 0); g.lineTo(i * cell, H * cell); g.stroke(); }
    for (let j = 0; j <= H; j++) { g.beginPath(); g.moveTo(0, j * cell); g.lineTo(W * cell, j * cell); g.stroke(); }

    // sections (lignes seulement si activé)
    if (showSectionGrid && secCols > 0 && secRows > 0) {
      const sW = Math.floor(W / secCols), sH = Math.floor(H / secRows);
      g.strokeStyle = "#ddd"; g.lineWidth = 4;
      for (let c = 1; c < secCols; c++) { const x = c * sW * cell; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H * cell); g.stroke(); }
      for (let r = 1; r < secRows; r++) { const y = r * sH * cell; g.beginPath(); g.moveTo(0, y); g.lineTo(W * cell, y); g.stroke(); }
      // *** pas de numéros de sections à l’écran ***
    }
  }

  useEffect(() => {
    if (images[idxImg]) process(images[idxImg]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    images, idxImg, W, H, zoom, offX, offY,
    useSupplier, inclTrans, secCols, secRows, showSectionGrid,
    bright, contrast, saturation
  ]);

  /* ============================= Exports ============================= */
  async function exportPNG() {
    const url = mosaicRef.current.toDataURL("image/png");
    await saveFile(url, `mosaic_${W}x${H}_${useSupplier ? "supplier" : "BL"}_${inclTrans ? "withTrans" : "opaque"}.png`);
  }

  async function exportCSV() {
    const tiny = tinyRef.current, ctx = tiny.getContext("2d");
    const id = ctx.getImageData(0, 0, tiny.width, tiny.height), data = id.data;
    const rows = [];
    for (let y = 0; y < tiny.height; y++) {
      const cols = [];
      for (let x = 0; x < tiny.width; x++) {
        const i = (y * tiny.width + x) * 4;
        const j = nearestIdx([data[i], data[i + 1], data[i + 2]], palette);
        cols.push(palette[j][2]); // code BL
      }
      rows.push(cols.join(";"));
    }
    await saveFile(new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" }), `matrix_codes_${W}x${H}.csv`);

    const list = counts.map(([name, qty]) => {
      const p = palette.find((q) => q[0] === name) || [];
      return `[${p[2] ?? "?"}] ${name};${qty}`;
    });
    await saveFile(new Blob([`Code-Name;Qty\n` + list.join("\n")], { type: "text/csv;charset=utf-8" }), `parts_${W}x${H}.csv`);
  }

  // Aide : dessiner légende multi-colonnes au bas de la page (ou nouvelle page si trop grand)
  function drawLegendAtBottom(doc, countsList, paletteRef, m = 10) {
    const Wp = doc.internal.pageSize.getWidth();
    const Hp = doc.internal.pageSize.getHeight();
    const title = "Légende (codes BrickLink) et quantités";
    const rowH = 6, sw = 5; // taille swatch
    const cols = 2;                       // 2 colonnes lisibles
    const colW = (Wp - 2 * m) / cols;
    const rows = Math.ceil(countsList.length / cols);
    const legendH = rows * rowH + 8;      // + titre

    let y0 = Hp - m - legendH;
    if (y0 < m + 10) {                     // pas assez de place -> nouvelle page
      doc.addPage();
      y0 = m + 4;
    }
    doc.setFontSize(12);
    doc.text(title, Wp / 2, y0, { align: "center" });
    let y = y0 + 4;
    doc.setFontSize(10);

    for (let i = 0; i < countsList.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = m + col * colW;
      const yy = y + row * rowH;

      const [name, qty] = countsList[i];
      const entry = paletteRef.find((p) => p[0] === name) || [];
      const rgb = entry[1] || [200, 200, 200];
      const code = entry[2] || "?";

      doc.setFillColor(rgb[0], rgb[1], rgb[2]);
      doc.rect(x, yy - 4, sw, sw, "F"); doc.setDrawColor(0); doc.rect(x, yy - 4, sw, sw);
      doc.text(`[${code}] ${name}: ${qty}`, x + sw + 3, yy);
    }
  }

  // PDF A3 : AVEC NUMÉROS (plots + sections)
  async function exportPDF_A3() {
    const JsPDF = await getJsPDF();
    if (!JsPDF) { alert("Export PDF indisponible (jsPDF non chargé). Ajoute jspdf ou un CDN)."); return; }

    const doc = new JsPDF({ orientation: "portrait", unit: "mm", format: "a3" });
    const Wp = doc.internal.pageSize.getWidth(), Hp = doc.internal.pageSize.getHeight(), m = 12;
    doc.setFontSize(18);
    doc.text(`Brick Mosaic ${W}×${H} — ${useSupplier ? "Supplier" : "BrickLink"} ${inclTrans ? "(+Trans)" : "(Opaque)"}`, Wp / 2, 12, { align: "center" });

    const tiny = tinyRef.current, Gx = tiny.width, Gy = tiny.height;
    const id = tiny.getContext("2d").getImageData(0, 0, Gx, Gy);
    const data = id.data;

    const aspect = Gx / Gy;
    const maxW = Wp - m * 2 - 60, maxH = Hp - m * 2 - 14;
    let drawW = maxW, drawH = drawW / aspect;
    if (drawH > maxH) { drawH = maxH; drawW = drawH * aspect; }
    const cell = Math.min(drawW / Gx, drawH / Gy);
    const ox = m, oy = 18;

    doc.setFillColor(255, 255, 255);
    doc.rect(ox, oy, cell * Gx, cell * Gy, "F");

    for (let y = 0; y < Gy; y++) {
      for (let x = 0; x < Gx; x++) {
        const i = (y * Gx + x) * 4;
        const j = nearestIdx([data[i], data[i + 1], data[i + 2]], palette);
        const [, rgb, code] = palette[j];

        const px = ox + x * cell, py = oy + y * cell, rad = (cell * 0.76) / 2;
        doc.setFillColor(rgb[0], rgb[1], rgb[2]); doc.setDrawColor(20);
        doc.circle(px + cell / 2, py + cell / 2, rad, "FD");

        const lum = luminance(...rgb);
        doc.setTextColor(lum < 0.5 ? 255 : 0, lum < 0.5 ? 255 : 0, lum < 0.5 ? 255 : 0);
        doc.setFontSize(Math.max(6, cell * 0.55));
        doc.text(String(code), px + cell / 2, py + cell / 2, { align: "center", baseline: "middle" });
      }
    }

    // Grille fine
    doc.setDrawColor(190); doc.setLineWidth(0.1);
    for (let i = 0; i <= Gx; i++) { const x = ox + i * cell; doc.line(x, oy, x, oy + cell * Gy); }
    for (let j = 0; j <= Gy; j++) { const y = oy + j * cell; doc.line(ox, y, ox + cell * Gx, y); }

    // Sections + numéros de sections
    const sW = Math.floor(Gx / secCols) || Gx, sH = Math.floor(Gy / secRows) || Gy;
    doc.setDrawColor(120); doc.setLineWidth(0.5);
    for (let c = 1; c < secCols; c++) { const x = ox + c * sW * cell; doc.line(x, oy, x, oy + cell * Gy); }
    for (let r = 1; r < secRows; r++) { const y = oy + r * sH * cell; doc.line(ox, y, ox + cell * Gx, y); }

    // Légende & quantités à droite
    let lx = ox + cell * Gx + 8, ly = 22; const box = 6;
    doc.setTextColor(0, 0, 0); doc.setFontSize(12); doc.text("Légende & Quantités", lx, ly); ly += 6;
    counts.forEach(([name, qty]) => {
      const entry = palette.find((p) => p[0] === name) || [];
      const rgb = entry[1] || [200, 200, 200], code = entry[2] || "?";
      doc.setFillColor(rgb[0], rgb[1], rgb[2]); doc.rect(lx, ly, box, box, "F"); doc.setDrawColor(0); doc.rect(lx, ly, box, box);
      doc.text(`[${code}] ${name}: ${qty}`, lx + box + 3, ly + 4);
      ly += box + 3;
      if (ly > Hp - 14) { doc.addPage(); lx = m; ly = 14; }
    });

    doc.save(`print_A3_${W}x${H}.pdf`);
  }

  // PDF Sections A4 : AVEC NUMÉROS (plots + titre de section) + LÉGENDE en bas de la dernière page
  async function exportPDF_Sections() {
    const JsPDF = await getJsPDF();
    if (!JsPDF) { alert("Export PDF indisponible (jsPDF non chargé). Ajoute jspdf ou un CDN)."); return; }

    const tiny = tinyRef.current, Gx = tiny.width, Gy = tiny.height;
    const sW = Math.floor(Gx / secCols) || Gx, sH = Math.floor(Gy / secRows) || Gy;

    const doc = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const Wp = doc.internal.pageSize.getWidth(), Hp = doc.internal.pageSize.getHeight();
    const m = 10, uW = Wp - 2 * m, uH = Hp - 2 * m - 10, cell = Math.min(uW / sW, uH / sH);
    const ctx = tiny.getContext("2d"), id = ctx.getImageData(0, 0, Gx, Gy), data = id.data;

    let n = 1, first = true;
    for (let r = 0; r < secRows; r++) for (let c = 0; c < secCols; c++) {
      if (!first) doc.addPage(); first = false;

      const title = `Section ${n}`; doc.setFontSize(16); doc.text(title, Wp / 2, 10, { align: "center" });

      const boardW = sW * cell, boardH = sH * cell, ox = m + (uW - boardW) / 2, oy = m + 10 + (uH - boardH) / 2;

      for (let y = 0; y < sH; y++) for (let x = 0; x < sW; x++) {
        const gx = c * sW + x, gy = r * sH + y; if (gx >= Gx || gy >= Gy) continue;
        const i = (gy * Gx + gx) * 4, j = nearestIdx([data[i], data[i + 1], data[i + 2]], palette);
        const [, rgb, code] = palette[j];
        const px = ox + x * cell, py = oy + y * cell, rad = (cell * 0.76) / 2;
        doc.setFillColor(rgb[0], rgb[1], rgb[2]); doc.setDrawColor(0); doc.circle(px + cell / 2, py + cell / 2, rad, "FD");
        const lum = luminance(...rgb); doc.setTextColor(lum < 0.5 ? 255 : 0, lum < 0.5 ? 255 : 0, lum < 0.5 ? 255 : 0);
        doc.setFontSize(Math.max(6, cell * 0.55)); doc.text(String(code), px + cell / 2, py + cell / 2, { align: "center", baseline: "middle" });
      }

      // grille + cadre
      doc.setDrawColor(180); doc.setLineWidth(0.1);
      for (let i = 0; i <= sW; i++) { const x = ox + i * cell; doc.line(x, oy, x, oy + cell * sH); }
      for (let j = 0; j <= sH; j++) { const y = oy + j * cell; doc.line(ox, y, ox + cell * sW, y); }
      doc.setDrawColor(0); doc.setLineWidth(0.2); doc.rect(ox, oy, cell * sW, cell * sH);

      n++;
    }

    // === LÉGENDE en bas de la dernière page (couleurs + codes + quantités) ===
    drawLegendAtBottom(doc, counts, palette, 10);

    doc.save(`sections_${secCols}x${secRows}_${W}x${H}.pdf`);
  }

  /* ============================== UI ============================== */
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">BrickMosaic Pro — Aperçu propre, numéros uniquement en PDF</h1>
          <div className="text-xs opacity-70">W×H indépendants · palette fournisseur 01→99 + BrickLink · Ajustements · PNG/CSV/PDF</div>
        </header>

        <div className="grid lg:grid-cols-3 gap-4">
          {/* Réglages */}
          <div className="bg-white rounded-2xl shadow p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">1) Charger photo(s)</label>
              <input type="file" accept="image/*" multiple onChange={(e) => {
                const f = e.target.files; if (!f) return; setFiles(Array.from(f)); setIdxImg(0);
              }} />
              {images.length > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs">Image :</span>
                  <select className="border rounded px-2 py-1 text-sm" value={idxImg}
                          onChange={(e) => setIdxImg(parseInt(e.target.value, 10))}>
                    {images.map((_, i) => <option key={i} value={i}>{i + 1}/{images.length}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium">2) Grille (colonnes × lignes)</label>
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-xs">Largeur : {W}</span>
                  <input type="range" min={24} max={128} step={1} value={W} onChange={(e) => setW(parseInt(e.target.value, 10))} className="w-full" />
                </div>
                <div><span className="text-xs">Hauteur : {H}</span>
                  <input type="range" min={24} max={128} step={1} value={H} onChange={(e) => setH(parseInt(e.target.value, 10))} className="w-full" />
                </div>
              </div>
              <div className="text-sm mt-1">
                <strong>Total pièces :</strong> {totalPieces.toLocaleString("fr-FR")}
                {counts.length > 0 && <> — <strong>Couleurs utilisées :</strong> {counts.length}</>}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <label className="text-sm font-medium">3) Palette utilisée</label>
              <div className="flex flex-col gap-2">
                <label className="text-sm flex items-center gap-2">
                  <input type="radio" name="src" checked={useSupplier} onChange={() => setUseSupplier(true)} />
                  Palette fournisseur (99 couleurs)
                </label>
                <label className="text-sm flex items-center gap-2">
                  <input type="radio" name="src" checked={!useSupplier} onChange={() => setUseSupplier(false)} />
                  BrickLink 4073 (référence)
                </label>
                <div className="ml-6 flex items-center gap-2">
                  <input id="trans" type="checkbox" checked={inclTrans} onChange={(e) => setInclTrans(e.target.checked)} />
                  <label htmlFor="trans" className="text-sm">Inclure les transparentes</label>
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <label className="text-sm font-medium">4) Sections (aperçu)</label>
              <div className="flex items-center gap-2">
                <input id="gridsec" type="checkbox" checked={showSectionGrid} onChange={(e) => setShowSectionGrid(e.target.checked)} />
                <label htmlFor="gridsec" className="text-sm">Afficher les lignes de sections (sans numéros)</label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-sm">Colonnes : <input type="number" min={1} className="border rounded px-2 py-1 w-20 ml-2" value={secCols} onChange={(e) => setSecCols(parseInt(e.target.value, 10) || 1)} /></label>
                <label className="text-sm">Lignes : <input type="number" min={1} className="border rounded px-2 py-1 w-20 ml-2" value={secRows} onChange={(e) => setSecRows(parseInt(e.target.value, 10) || 1)} /></label>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <label className="text-sm font-medium">5) Cadrage</label>
              <div><span className="text-xs">Zoom : {zoom.toFixed(2)}</span>
                <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))} className="w-full" />
              </div>
              <div><span className="text-xs">Décalage X : {offX.toFixed(2)}</span>
                <input type="range" min={-0.5} max={0.5} step={0.01} value={offX} onChange={(e) => setOffX(parseFloat(e.target.value))} className="w-full" />
              </div>
              <div><span className="text-xs">Décalage Y : {offY.toFixed(2)}</span>
                <input type="range" min={-0.5} max={0.5} step={0.01} value={offY} onChange={(e) => setOffY(parseFloat(e.target.value))} className="w-full" />
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <label className="text-sm font-medium">6) Ajustements d’image</label>
              <div><span className="text-xs">Lumière : {bright}</span>
                <input type="range" min={-100} max={100} step={1} value={bright} onChange={(e) => setBright(parseInt(e.target.value, 10))} className="w-full" />
              </div>
              <div><span className="text-xs">Contraste : {contrast}</span>
                <input type="range" min={-100} max={100} step={1} value={contrast} onChange={(e) => setContrast(parseInt(e.target.value, 10))} className="w-full" />
              </div>
              <div><span className="text-xs">Saturation : {saturation}</span>
                <input type="range" min={-100} max={100} step={1} value={saturation} onChange={(e) => setSaturation(parseInt(e.target.value, 10))} className="w-full" />
              </div>
            </div>

            <div className="pt-2 border-t space-y-2">
              <button className="w-full bg-black text-white rounded-xl py-2" onClick={() => images[idxImg] && process(images[idxImg])} disabled={!images.length}>Générer l’aperçu</button>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={exportPNG} className="px-3 py-2 rounded-xl border" disabled={!images.length}>PNG (sans numéros)</button>
                <button onClick={exportCSV} className="px-3 py-2 rounded-xl border" disabled={!images.length}>CSV (codes + pièces)</button>
                <button onClick={exportPDF_A3} className="px-3 py-2 rounded-xl border col-span-2" disabled={!images.length}>PDF A3 (numéros + légende)</button>
                <button onClick={exportPDF_Sections} className="px-3 py-2 rounded-xl border col-span-2" disabled={!images.length}>PDF Sections (numéros + légende en bas)</button>
              </div>
            </div>
          </div>

          {/* Aperçu + palette */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow p-4 space-y-4">
            <div className="overflow-auto w-full border rounded-xl">
              <canvas ref={mosaicRef} className="w-full h-auto" />
            </div>

            <div>
              <h3 className="font-semibold mb-2">
                Palette utilisée ({palette.length} couleurs) — {useSupplier ? "Fournisseur" : "BrickLink"} {inclTrans ? "(+Trans)" : "(Opaque)"}
              </h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
                {palette.map(([label, rgb, code, isTrans]) => (
                  <div key={`${label}-${code}`} className="flex items-center gap-2 p-2 rounded-xl border">
                    <div className="w-6 h-6 rounded" style={{ background: `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` }} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>{label}{isTrans ? " (Trans)" : ""}</span>
                        <span className="opacity-70">[{code}]</span>
                      </div>
                      <div className="text-xs opacity-60">rgb({rgb.join(",")})</div>
                    </div>
                    <div className="text-xs opacity-70">{(counts.find(([n]) => n === label) || [0, 0])[1]}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <canvas ref={tinyRef} style={{ display: "none" }} />
        <footer className="text-xs text-neutral-500 text-center pt-4">
          Aperçu sans numéros. Les numéros et la légende apparaissent dans les PDF.
        </footer>
      </div>
    </div>
  );
}
