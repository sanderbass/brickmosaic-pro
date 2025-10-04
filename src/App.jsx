import React, { useEffect, useRef, useState } from "react";
import { saveAs } from "file-saver";
import { jsPDF } from "jspdf";

/* ============================================================
   1) TABLE COULEURS BRICKLINK (4073) — noms, hex, code BL, isTrans
   - Hex = approximations pour l’affichage/quantification
   - Liste étendue (opaques + métalliques/pearls + glow + trans + satin)
   ============================================================ */
const BL_COLORS_4073 = [
  // --- OPAQUES de base
  ["White", "#F2F3F2", 1, false],
  ["Black", "#000000", 26, false],
  ["Light Gray", "#9BA19D", 9, false],
  ["Dark Gray", "#6D6E5C", 10, false],
  ["Light Bluish Gray", "#A3A2A4", 86, false],
  ["Dark Bluish Gray", "#6D6E5C", 85, false],
  ["Red", "#C91A09", 5, false],
  ["Dark Red", "#720E0F", 59, false],
  ["Orange", "#F08F1C", 4, false],
  ["Dark Orange", "#A95500", 68, false],
  ["Yellow", "#F2CD37", 3, false],
  ["Tan", "#E4CD9E", 2, false],
  ["Dark Tan", "#958A73", 69, false],
  ["Brown", "#6B3F20", 8, false],
  ["Reddish Brown", "#5C1E0F", 88, false],
  ["Nougat", "#CC8E69", 18, false],
  ["Light Nougat", "#F6D7B3", 90, false],
  ["Green", "#237841", 6, false],
  ["Bright Green", "#4B9F4A", 36, false],
  ["Dark Green", "#184632", 80, false],
  ["Lime", "#A6CA3A", 34, false],
  ["Sand Green", "#A3C3A2", 48, false],
  ["Blue", "#0055BF", 7, false],
  ["Dark Blue", "#0B3B8F", 63, false],
  ["Medium Blue", "#6C9BD2", 42, false],
  ["Light Blue", "#A5C6EA", 62, false],
  ["Bright Light Yellow", "#FFF07A", 103, false],
  ["Bright Light Orange", "#F8BB3D", 110, false],
  ["Bright Light Blue", "#9FC3E9", 102, false],
  ["Medium Azure", "#36A3E1", 156, false],
  ["Dark Brown", "#4C2F27", 120, false],
  // --- METAL/PEARL
  ["Flat Silver", "#8A8C8E", 95, false],
  ["Metallic Silver", "#9C9C9C", 80_001, false], // pseudo code local (pas BL) pour tri; BL réel: 296/315 selon époques
  ["Pearl Dark Gray", "#6E6E6E", 68_001, false],
  ["Pearl Light Gray", "#9E9E9E", 66_001, false],
  ["Pearl Gold", "#D9A526", 115, false],
  ["Pearl Light Gold", "#E0C674", 127, false],
  ["Flat Dark Gold", "#AA8A00", 147, false],
  // --- GLOW
  ["Glow In Dark Opaque", "#D7E594", 50_001, false],
  ["Glow In Dark White", "#E6F2BF", 50_002, false],
  // --- TRANSPARENTS / SATIN
  ["Trans-Clear", "#E6F2F2", 12, true],
  ["Trans-Black", "#635F52", 251, true],
  ["Trans-Red", "#DE0000", 17, true],
  ["Trans-Orange", "#FF7F00", 98, true],
  ["Trans-Neon Orange", "#FF800D", 18, true],
  ["Trans-Yellow", "#F5CD2A", 19, true],
  ["Trans-Neon Yellow", "#E9F72C", 121, true],
  ["Trans-Green", "#5AC35E", 20, true],
  ["Trans-Neon Green", "#C0FF00", 16, true],
  ["Trans-Bright Green", "#7DC291", 108, true],
  ["Trans-Light Green", "#BFE8A3", 221, true],
  ["Trans-Light Bright Green", "#D8F1C9", 226, true],
  ["Trans-Light Blue", "#A3D2F2", 15, true],
  ["Trans-Medium Blue", "#6EC1E4", 74, true],
  ["Trans-Dark Blue", "#0B2E6F", 14, true],
  ["Trans-Aqua", "#99C9EA", 113, true],
  ["Trans-Purple", "#5F2683", 51, true],
  ["Trans-Light Purple", "#D9BDE4", 114, true],
  ["Trans-Dark Pink", "#C94A83", 50, true],
  ["Trans-Pink", "#DF6695", 107, true],
  ["Trans-Brown", "#6F4E37", 13, true],
  ["Satin Trans-Clear", "#E6F2F2", 228, true],
  ["Satin Trans-Light Blue", "#A3D2F2", 223, true],
];

// helpers
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const sqr = (x) => x * x;
const luminance = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const hexToRgb = (hex) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return [200, 200, 200];
  const v = m[1];
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
};
const nearestIndex = ([r, g, b], palette) => {
  let best = 1e18,
    idx = 0;
  for (let i = 0; i < palette.length; i++) {
    const [, rgb] = palette[i];
    const d = sqr(rgb[0] - r) + sqr(rgb[1] - g) + sqr(rgb[2] - b);
    if (d < best) {
      best = d;
      idx = i;
    }
  }
  return idx;
};

/* ============================================================
   2) IMPORT FOURNISSEUR + CORRÉLATION
   - Colles une liste texte: "Nom, #HEX, Code" OU "Code Nom #HEX" OU "Nom (#HEX)"
   - On infère isTrans si nom contient "Trans", "Transparent", "Satin", "Neon"
   - Corrélation: si code BL fourni => on garde; sinon on fait "nearest hex"
   ============================================================ */
function parseSupplierText(text) {
  const rows = [];
  const lines = String(text || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    // capture hex
    const hexMatch = line.match(/#([0-9a-f]{6})/i);
    const hex = hexMatch ? `#${hexMatch[1]}` : null;

    // capture code (nombre isolé ou entre [] ou après '=')
    const codeMatch = line.match(/(?:^|\s|\[|=)(\d{1,4})(?:\]|$|\s|,)/);
    const supCode = codeMatch ? parseInt(codeMatch[1], 10) : null;

    // name = ligne sans hex, sans code nu
    let name = line.replace(/#([0-9a-f]{6})/ig, "").replace(/(\[?\d{1,4}\]?)/g, "").replace(/[=,:]/g, "").trim();
    if (!name) name = `Color ${rows.length + 1}`;

    const isTrans =
      /trans|transparent|satin|neon/i.test(name);

    const rgb = hex ? hexToRgb(hex) : [200, 200, 200];
    rows.push([name, rgb, supCode, isTrans, hex]);
  }
  return rows; // [name, rgb, supplierCode?, isTrans?, hex?]
}

function correlateToBrickLink(supplierRows, blPalette) {
  // Retourne la palette "fournisseur étendue" mappée avec codeBL s'il existe
  // Format palette UI: [displayName, rgb, codeDisplayed, isTrans, meta]
  // meta = { blName?, blCode?, supplierCode?, supplierHex? }
  const out = [];
  for (const [name, rgb, supCode, isTrans, hex] of supplierRows) {
    // On cherche nearest BL par hex (si hex manquant on prend nearest par rgb)
    const blIdx = nearestIndex(rgb, blPalette);
    const [blName, blRgb, blCode, blIsTrans] = blPalette[blIdx];

    // Si le nom inclut un code BL (ex "Trans-Red 17"), on surclasse par ce code
    const embedded = name.match(/\b(\d{1,4})\b/);
    const embeddedCode = embedded ? parseInt(embedded[1], 10) : null;
    const finalBLCode = embeddedCode ?? blCode;

    const displayName = name || blName;
    const transFlag = isTrans || blIsTrans || /trans|transparent|satin|neon/i.test(name);

    out.push([
      displayName,
      rgb,
      finalBLCode,
      transFlag,
      { blName, blCode: finalBLCode, supplierCode: supCode ?? null, supplierHex: hex ?? null },
    ]);
  }
  return out;
}

/* ============================================================
   3) CROP -> QUANTIF -> RENDU + EXPORTS
   ============================================================ */
function drawCroppedToRect(img, target, gridW, gridH, zoom, offsetX, offsetY) {
  const ctx = target.getContext("2d", { willReadFrequently: true });
  target.width = gridW;
  target.height = gridH;

  const aspect = gridW / gridH;
  const z = Math.max(1, zoom);

  let viewW = img.width / z;
  let viewH = viewW / aspect;
  if (viewH > img.height / z) {
    viewH = img.height / z;
    viewW = viewH * aspect;
  }

  const maxX = img.width - viewW;
  const maxY = img.height - viewH;
  const sx = clamp(img.width / 2 - viewW / 2 + offsetX * maxX, 0, maxX);
  const sy = clamp(img.height / 2 - viewH / 2 + offsetY * maxY, 0, maxY);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.clearRect(0, 0, gridW, gridH);
  ctx.drawImage(img, sx, sy, viewW, viewH, 0, 0, gridW, gridH);
}

export default function App() {
  // images
  const [files, setFiles] = useState([]);
  const [images, setImages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // grille
  const [gridW, setGridW] = useState(48);
  const [gridH, setGridH] = useState(64);

  // cadrage
  const [zoom, setZoom] = useState(1.15);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);

  // palette source
  const [source, setSource] = useState("bricklink"); // "bricklink" | "supplier"
  const [includeTransBL, setIncludeTransBL] = useState(false);

  // supplier import
  const [supplierText, setSupplierText] = useState("");
  const [supplierPalette, setSupplierPalette] = useState([]); // [name,rgb,codeBL,isTrans,meta]
  const [supplierExclTrans, setSupplierExclTrans] = useState(false);

  // rendu
  const [showNumbers, setShowNumbers] = useState(true);
  const [secCols, setSecCols] = useState(3);
  const [secRows, setSecRows] = useState(4);

  const mosaicRef = useRef(null);
  const tinyRef = useRef(null);
  const [counts, setCounts] = useState([]);

  // charge fichiers
  useEffect(() => {
    if (files.length === 0) {
      setImages([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const arr = [];
      for (const f of files) {
        const url = URL.createObjectURL(f);
        await new Promise((res) => {
          const im = new Image();
          im.onload = () => {
            arr.push(im);
            res();
          };
          im.src = url;
        });
      }
      if (!cancelled) setImages(arr);
    })();
    return () => {
      cancelled = true;
    };
  }, [files]);

  // palette effective pour quantifier
  const effectivePalette = React.useMemo(() => {
    if (source === "supplier" && supplierPalette.length) {
      const arr = supplierPalette.filter((p) => (supplierExclTrans ? !p[3] : true));
      return arr.map(([n, rgb, code, isTrans]) => [n, rgb, code, isTrans]);
    }
    // BrickLink
    const arrBL = BL_COLORS_4073.filter((p) => (includeTransBL ? true : !p[3]));
    return arrBL;
  }, [source, supplierPalette, supplierExclTrans, includeTransBL]);

  function processOne(img) {
    const tiny = tinyRef.current;
    const mosaic = mosaicRef.current;

    drawCroppedToRect(img, tiny, gridW, gridH, zoom, offsetX, offsetY);
    const id = tiny.getContext("2d").getImageData(0, 0, gridW, gridH);
    const data = id.data;

    // Quantification "nearest"
    for (let y = 0; y < gridH; y++) {
      for (let x = 0; x < gridW; x++) {
        const i = (y * gridW + x) * 4;
        const idx = nearestIndex([data[i], data[i + 1], data[i + 2]], effectivePalette);
        const [, rgb] = effectivePalette[idx];
        data[i] = rgb[0];
        data[i + 1] = rgb[1];
        data[i + 2] = rgb[2];
      }
    }
    tiny.getContext("2d").putImageData(id, 0, 0);

    // Comptage
    const cts = new Map();
    for (let y = 0; y < gridH; y++) {
      for (let x = 0; x < gridW; x++) {
        const i = (y * gridW + x) * 4;
        const idx = nearestIndex([data[i], data[i + 1], data[i + 2]], effectivePalette);
        const name = effectivePalette[idx][0];
        cts.set(name, (cts.get(name) || 0) + 1);
      }
    }
    setCounts(Array.from(cts.entries()).sort((a, b) => b[1] - a[1]));

    // Dessin des plots ronds + numéros
    const cell = 14;
    mosaic.width = gridW * cell;
    mosaic.height = gridH * cell;
    const g = mosaic.getContext("2d");
    g.clearRect(0, 0, mosaic.width, mosaic.height);

    for (let y = 0; y < gridH; y++) {
      for (let x = 0; x < gridW; x++) {
        const i = (y * gridW + x) * 4;
        const R = data[i],
          G = data[i + 1],
          B = data[i + 2];
        const idx = nearestIndex([R, G, B], effectivePalette);
        const [name, rgb, code] = effectivePalette[idx];

        const cx = x * cell,
          cy = y * cell;
        const pad = Math.max(1, Math.floor(cell * 0.12));
        const rad = (cell - pad * 2) / 2;

        g.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
        g.strokeStyle = "#111";
        g.lineWidth = Math.max(1, Math.floor(cell * 0.06));
        g.beginPath();
        g.arc(cx + cell / 2, cy + cell / 2, rad, 0, Math.PI * 2);
        g.fill();
        g.stroke();

        if (showNumbers) {
          const lum = luminance(rgb[0], rgb[1], rgb[2]);
          g.font = `bold ${Math.floor(cell * 0.55)}px system-ui, -apple-system, Segoe UI, Roboto`;
          g.textAlign = "center";
          g.textBaseline = "middle";
          g.lineWidth = 3;
          g.strokeStyle =
            lum < 0.5 ? "rgba(255,255,255,0.9)" : "rgba(20,20,20,0.9)";
          g.fillStyle = "#000";
          g.strokeText(String(code), cx + cell / 2, cy + cell / 2);
          g.fillText(String(code), cx + cell / 2, cy + cell / 2);
        }
      }
    }

    // Grille
    g.strokeStyle = "rgba(0,0,0,0.18)";
    g.lineWidth = 1;
    for (let i = 0; i <= gridW; i++) {
      g.beginPath();
      g.moveTo(i * cell, 0);
      g.lineTo(i * cell, gridH * cell);
      g.stroke();
    }
    for (let j = 0; j <= gridH; j++) {
      g.beginPath();
      g.moveTo(0, j * cell);
      g.lineTo(gridW * cell, j * cell);
      g.stroke();
    }

    // Sections
    if (secCols > 0 && secRows > 0) {
      const sW = Math.floor(gridW / secCols);
      const sH = Math.floor(gridH / secRows);
      g.strokeStyle = "#ddd";
      g.lineWidth = 4;
      for (let c = 1; c < secCols; c++) {
        const x = c * sW * cell;
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x, gridH * cell);
        g.stroke();
      }
      for (let r = 1; r < secRows; r++) {
        const y = r * sH * cell;
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(gridW * cell, y);
        g.stroke();
      }
      // Numéros de sections
      let n = 1;
      g.fillStyle = "rgba(255,255,255,0.85)";
      g.strokeStyle = "rgba(0,0,0,0.3)";
      for (let r = 0; r < secRows; r++) {
        for (let c = 0; c < secCols; c++) {
          const ox = (c * sW + sW / 2) * cell;
          const oy = (r * sH + sH / 2) * cell;
          g.font = `bold ${Math.floor(cell * Math.min(sW, sH) * 0.35)}px system-ui`;
          g.textAlign = "center";
          g.textBaseline = "middle";
          g.strokeText(String(n), ox, oy);
          g.fillText(String(n), ox, oy);
          n++;
        }
      }
    }
  }

  useEffect(() => {
    if (images[currentIndex]) processOne(images[currentIndex]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    images,
    currentIndex,
    gridW,
    gridH,
    zoom,
    offsetX,
    offsetY,
    includeTransBL,
    source,
    supplierPalette,
    supplierExclTrans,
    showNumbers,
    secCols,
    secRows,
  ]);

  // Exports
  function exportPNG() {
    const url = mosaicRef.current.toDataURL("image/png");
    saveAs(
      url,
      `mosaic_${gridW}x${gridH}_${source === "supplier" ? "supplier" : "BL"}${
        source === "supplier" ? (supplierExclTrans ? "_noTrans" : "") : includeTransBL ? "_withTrans" : "_opaque"
      }.png`
    );
  }

  function exportCSV() {
    const tiny = tinyRef.current;
    const ctx = tiny.getContext("2d");
    const id = ctx.getImageData(0, 0, tiny.width, tiny.height);
    const data = id.data;

    // Matrice des codes (code BL si connu, sinon code fournisseur, sinon index)
    const rows = [];
    for (let y = 0; y < tiny.height; y++) {
      const cols = [];
      for (let x = 0; x < tiny.width; x++) {
        const i = (y * tiny.width + x) * 4;
        const idx = nearestIndex([data[i], data[i + 1], data[i + 2]], effectivePalette);
        const [name, rgb, code] = effectivePalette[idx];
        cols.push(code ?? 0);
      }
      rows.push(cols.join(";"));
    }
    saveAs(new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" }), `matrix_codes_${gridW}x${gridH}.csv`);

    // Liste pièces (avec nom + code affiché)
    const list = counts.map(([name, qty]) => {
      const entry = effectivePalette.find((p) => p[0] === name);
      const code = entry ? entry[2] : "?";
      return `[${code}] ${name};${qty}`;
    });
    saveAs(
      new Blob([`Code-Name;Qty\n` + list.join("\n")], { type: "text/csv;charset=utf-8" }),
      `parts_${gridW}x${gridH}.csv`
    );
  }

  function exportPDF_A3() {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a3" });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const margin = 12;
    doc.setFontSize(18);
    doc.text(
      `Brick Mosaic ${gridW}×${gridH} — ${source === "supplier" ? "Fournisseur" : "BrickLink"}${
        source === "supplier" ? (supplierExclTrans ? " (sans trans)" : "") : includeTransBL ? " (+Trans)" : " (Opaque)"
      }`,
      W / 2,
      12,
      { align: "center" }
    );

    const aspect = mosaicRef.current.width / mosaicRef.current.height;
    const maxW = W - margin * 2 - 50;
    const maxH = H - margin * 2 - 12;
    let drawW = maxW,
      drawH = drawW / aspect;
    if (drawH > maxH) {
      drawH = maxH;
      drawW = drawH * aspect;
    }
    const dataUrl = mosaicRef.current.toDataURL("image/png");
    doc.addImage(dataUrl, "PNG", margin, 18, drawW, drawH);

    let x = margin + drawW + 8,
      y = 24;
    const box = 6;
    doc.setFontSize(12);
    doc.text("Légende & Quantités", x, y);
    y += 6;

    counts.forEach(([name, qty]) => {
      const entry = effectivePalette.find((p) => p[0] === name);
      const rgb = (entry && entry[1]) || [200, 200, 200];
      const code = (entry && entry[2]) || "?";
      doc.setFillColor(rgb[0], rgb[1], rgb[2]);
      doc.rect(x, y, box, box, "F");
      doc.setDrawColor(0);
      doc.rect(x, y, box, box);
      doc.text(`[${code}] ${name}: ${qty}`, x + box + 3, y + 4);
      y += box + 3;
      if (y > H - margin) {
        doc.addPage();
        y = margin;
      }
    });

    doc.save(`print_A3_${gridW}x${gridH}.pdf`);
  }

  function exportPDF_Sections() {
    const tiny = tinyRef.current;
    const Gx = tiny.width;
    const Gy = tiny.height;
    const sW = Math.floor(Gx / secCols);
    const sH = Math.floor(Gy / secRows);

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const margin = 10;
    const usableW = W - 2 * margin;
    const usableH = H - 2 * margin - 10;
    const cell = Math.min(usableW / sW, usableH / sH);

    const ctx = tiny.getContext("2d");
    const id = ctx.getImageData(0, 0, Gx, Gy);
    const data = id.data;

    let n = 1;
    let first = true;
    for (let r = 0; r < secRows; r++) {
      for (let c = 0; c < secCols; c++) {
        if (!first) doc.addPage();
        first = false;

        const title = `Section ${n}`;
        doc.setFontSize(16);
        doc.text(title, W / 2, 10, { align: "center" });

        const boardW = sW * cell,
          boardH = sH * cell;
        const ox = margin + (usableW - boardW) / 2;
        const oy = margin + 10 + (usableH - boardH) / 2;

        for (let y = 0; y < sH; y++) {
          for (let x = 0; x < sW; x++) {
            const gx = c * sW + x,
              gy = r * sH + y;
            if (gx >= Gx || gy >= Gy) continue;
            const i = (gy * Gx + gx) * 4;
            const idx = nearestIndex([data[i], data[i + 1], data[i + 2]], effectivePalette);
            const [, rgb, code] = effectivePalette[idx];

            const px = ox + x * cell,
              py = oy + y * cell;
            const rad = (cell * 0.76) / 2;
            doc.setFillColor(rgb[0], rgb[1], rgb[2]);
            doc.setDrawColor(0);
            doc.circle(px + cell / 2, py + cell / 2, rad, "FD");

            const lum = luminance(rgb[0], rgb[1], rgb[2]);
            doc.setTextColor(lum < 0.5 ? 255 : 0, lum < 0.5 ? 255 : 0, lum < 0.5 ? 255 : 0);
            doc.setFontSize(Math.max(6, cell * 0.55));
            doc.text(String(code), px + cell / 2, py + cell / 2, {
              align: "center",
              baseline: "middle",
            });
          }
        }

        // grille
        doc.setDrawColor(180);
        doc.setLineWidth(0.1);
        for (let i = 0; i <= sW; i++) {
          const x = ox + i * cell;
          doc.line(x, oy, x, oy + cell * sH);
        }
        for (let j = 0; j <= sH; j++) {
          const y = oy + j * cell;
          doc.line(ox, y, ox + cell * sW, y);
        }
        doc.setDrawColor(0);
        doc.setLineWidth(0.2);
        doc.rect(ox, oy, cell * sW, cell * sH);

        n++;
      }
    }

    doc.save(`sections_${secCols}x${secRows}_${gridW}x${gridH}.pdf`);
  }

  // Actions palette fournisseur
  function handleParseSupplier() {
    const sup = parseSupplierText(supplierText);
    const corr = correlateToBrickLink(
      sup.map(([n, rgb, supCode, isTrans]) => [n, rgb, supCode, isTrans, null]),
      BL_COLORS_4073
    );
    setSupplierPalette(corr);
    setSource("supplier");
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">BrickMosaic Pro — 4073 (corrélation fournisseur ↔ BrickLink)</h1>
          <div className="text-xs opacity-70">W×H, numéros, sections, PNG/CSV/PDF</div>
        </header>

        <div className="grid lg:grid-cols-3 gap-4">
          {/* Colonne 1 : réglages */}
          <div className="bg-white rounded-2xl shadow p-4 space-y-4">
            {/* Import image */}
            <div>
              <label className="block text-sm font-medium mb-1">1) Charger photo(s)</label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  const f = e.target.files;
                  if (!f) return;
                  setFiles(Array.from(f));
                  setCurrentIndex(0);
                }}
              />
              {images.length > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs">Image :</span>
                  <select
                    className="border rounded px-2 py-1 text-sm"
                    value={currentIndex}
                    onChange={(e) => setCurrentIndex(parseInt(e.target.value))}
                  >
                    {images.map((_, i) => (
                      <option key={i} value={i}>
                        {i + 1}/{images.length}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Grille */}
            <div className="space-y-2">
              <label className="block text-sm font-medium">2) Grille (colonnes × lignes) : {gridW} × {gridH}</label>
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-xs">Largeur</span><input type="range" min={24} max={128} step={1} value={gridW} onChange={(e) => setGridW(parseInt(e.target.value))} className="w-full" /></div>
                <div><span className="text-xs">Hauteur</span><input type="range" min={24} max={128} step={1} value={gridH} onChange={(e) => setGridH(parseInt(e.target.value))} className="w-full" /></div>
              </div>
            </div>

            {/* Palette source */}
            <div className="space-y-2 pt-2 border-t">
              <label className="text-sm font-medium">3) Palette utilisée pour la mosaïque</label>
              <div className="flex flex-col gap-2">
                <label className="text-sm flex items-center gap-2">
                  <input type="radio" name="src" checked={source === "bricklink"} onChange={() => setSource("bricklink")} />
                  BrickLink 4073
                </label>
                <div className="ml-6 flex items-center gap-2">
                  <input id="incTrans" type="checkbox" checked={includeTransBL} onChange={(e) => setIncludeTransBL(e.target.checked)} />
                  <label htmlFor="incTrans" className="text-sm">Inclure les transparentes (BL)</label>
                </div>

                <label className="text-sm flex items-center gap-2 mt-2">
                  <input type="radio" name="src" checked={source === "supplier"} onChange={() => setSource("supplier")} />
                  Palette fournisseur (importée)
                </label>
                <div className="ml-6 flex items-center gap-2">
                  <input id="supExcl" type="checkbox" checked={supplierExclTrans} onChange={(e) => setSupplierExclTrans(e.target.checked)} />
                  <label htmlFor="supExcl" className="text-sm">Exclure les transparentes (fournisseur)</label>
                </div>
              </div>
            </div>

            {/* Import fournisseur + corrélation */}
            <div className="space-y-2 pt-2 border-t">
              <label className="text-sm font-medium">4) Importer la liste du fournisseur</label>
              <textarea
                className="w-full border rounded p-2 text-sm"
                rows={6}
                placeholder={`Exemples de lignes acceptées :
Trans-Red, #DE0000, 17
21 Light Yellow #FFF07A
Pearl Gold,#D9A526
Trans-Clear #E6F2F2 12
Dark Bluish Gray, 85
`}
                value={supplierText}
                onChange={(e) => setSupplierText(e.target.value)}
              />
              <button className="w-full bg-black text-white rounded-xl py-2" onClick={handleParseSupplier}>
                Importer + Corréler vers BrickLink
              </button>
            </div>

            {/* Numérotation & sections */}
            <div className="space-y-2 pt-2 border-t">
              <label className="text-sm font-medium">5) Numérotation & sections</label>
              <div className="flex items-center gap-2">
                <input id="nums" type="checkbox" checked={showNumbers} onChange={(e) => setShowNumbers(e.target.checked)} />
                <label htmlFor="nums" className="text-sm">Afficher les numéros (codes)</label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-sm">Colonnes (sections): <input type="number" min={1} className="border rounded px-2 py-1 w-20 ml-2" value={secCols} onChange={(e) => setSecCols(parseInt(e.target.value) || 1)} /></label>
                <label className="text-sm">Lignes (sections): <input type="number" min={1} className="border rounded px-2 py-1 w-20 ml-2" value={secRows} onChange={(e) => setSecRows(parseInt(e.target.value) || 1)} /></label>
              </div>
            </div>

            {/* Cadrage */}
            <div className="space-y-2 pt-2 border-t">
              <label className="text-sm font-medium">6) Cadrage</label>
              <div><span className="text-xs">Zoom : {zoom.toFixed(2)}</span><input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))} className="w-full" /></div>
              <div><span className="text-xs">Décalage X : {offsetX.toFixed(2)}</span><input type="range" min={-0.5} max={0.5} step={0.01} value={offsetX} onChange={(e) => setOffsetX(parseFloat(e.target.value))} className="w-full" /></div>
              <div><span className="text-xs">Décalage Y : {offsetY.toFixed(2)}</span><input type="range" min={-0.5} max={0.5} step={0.01} value={offsetY} onChange={(e) => setOffsetY(parseFloat(e.target.value))} className="w-full" /></div>
            </div>

            {/* Exports */}
            <div className="pt-2 border-t space-y-2">
              <button className="w-full bg-black text-white rounded-xl py-2" onClick={() => images[currentIndex] && processOne(images[currentIndex])} disabled={images.length === 0}>
                Générer l’aperçu
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={exportPNG} className="px-3 py-2 rounded-xl border" disabled={!images.length}>PNG</button>
                <button onClick={exportCSV} className="px-3 py-2 rounded-xl border" disabled={!images.length}>CSV (codes + pièces)</button>
                <button onClick={exportPDF_A3} className="px-3 py-2 rounded-xl border col-span-2" disabled={!images.length}>PDF A3 (aperçu + légende)</button>
                <button onClick={exportPDF_Sections} className="px-3 py-2 rounded-xl border col-span-2" disabled={!images.length}>PDF Sections ({secCols} × {secRows})</button>
              </div>
            </div>
          </div>

          {/* Colonne 2–3 : aperçu & palettes */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow p-4 space-y-4">
            <div className="overflow-auto w-full border rounded-xl">
              <canvas ref={mosaicRef} className="w-full h-auto" />
            </div>

            {/* Palette affichée */}
            <div>
              <h3 className="font-semibold mb-2">
                Palette utilisée ({effectivePalette.length} couleurs)
                {source === "supplier" ? (supplierExclTrans ? " — fournisseur (sans trans)" : " — fournisseur") : includeTransBL ? " — BrickLink (+Trans)" : " — BrickLink (opaque)"}
              </h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
                {effectivePalette.map(([name, rgb, code]) => (
                  <div key={`${name}-${code}`} className="flex items-center gap-2 p-2 rounded-xl border">
                    <div className="w-6 h-6 rounded" style={{ background: `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` }} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>{name}</span>
                        <span className="opacity-70">[{code}]</span>
                      </div>
                      <div className="text-xs opacity-60">rgb({rgb.join(",")})</div>
                    </div>
                    <div className="text-xs opacity-70">{(counts.find(([n]) => n === name) || [0, 0])[1]}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Aperçu palette fournisseur importée & mapping */}
            {source === "supplier" && supplierPalette.length > 0 && (
              <div className="mt-2">
                <h4 className="font-semibold mb-1 text-sm">Mapping fournisseur → BrickLink (interne)</h4>
                <div className="text-xs opacity-70 mb-2">Le code affiché sur les plots = code BrickLink estimé (ou fourni s’il était dans la ligne).</div>
                <div className="grid md:grid-cols-2 gap-2">
                  {supplierPalette.map(([name, rgb, code, isTrans, meta], i) => (
                    <div key={`${name}-${i}`} className="flex items-center gap-2 p-2 rounded-xl border">
                      <div className="w-5 h-5 rounded" style={{ background: `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` }} />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">{name}{isTrans ? " (Trans)" : ""}</span>
                          <span className="text-xs opacity-70">→ BL [{meta?.blCode ?? code}]</span>
                        </div>
                        <div className="text-[11px] opacity-60">
                          fournisseur:{meta?.supplierCode ?? "—"} {meta?.supplierHex ? `· ${meta?.supplierHex}` : ""}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <canvas ref={tinyRef} style={{ display: "none" }} />
        <footer className="text-xs text-neutral-500 text-center pt-4">
          Astuce : colle la liste du fournisseur (une couleur par ligne). On détecte automatiquement #hex / code / nom & on estime le code BrickLink si absent.
        </footer>
      </div>
    </div>
  );
}
