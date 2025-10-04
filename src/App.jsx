import React, { useEffect, useRef, useState } from "react";
import { saveAs } from "file-saver";
import { jsPDF } from "jspdf";

/** =======================
 *  Palette LEGO 4073 (BrickLink)
 *  Codes = BrickLink Color IDs
 *  Hex = approximations proches des charts BrickLink/Rebrickable
 *  ======================= */
const PALETTE_4073_OPAQUE = [
  ["White", "#F2F3F2", 1],
  ["Black", "#000000", 26],
  ["Light Bluish Gray", "#A3A2A4", 86],
  ["Dark Bluish Gray", "#6D6E5C", 85],
  ["Light Gray", "#9BA19D", 9],
  ["Dark Gray", "#6D6E5C", 10], // legacy approx
  ["Red", "#C91A09", 5],
  ["Dark Red", "#720E0F", 59],
  ["Orange", "#F08F1C", 4],
  ["Dark Orange", "#A95500", 68],
  ["Yellow", "#F2CD37", 3],
  ["Tan", "#E4CD9E", 2],
  ["Dark Tan", "#958A73", 69],
  ["Reddish Brown", "#5C1E0F", 88],
  ["Brown", "#6B3F20", 8],
  ["Nougat", "#CC8E69", 18],
  ["Green", "#237841", 6],
  ["Bright Green", "#4B9F4A", 36],
  ["Dark Green", "#184632", 80],
  ["Sand Green", "#A3C3A2", 48],
  ["Blue", "#0055BF", 7],
  ["Dark Blue", "#0B3B8F", 63],
  ["Medium Blue", "#6C9BD2", 42],
  ["Light Blue", "#A5C6EA", 62],
  ["Dark Brown", "#4C2F27", 120],
];

const PALETTE_4073_TRANS = [
  ["Trans-Clear", "#E6F2F2", 12],
  ["Trans-Black", "#635F52", 251],
  ["Trans-Red", "#DE0000", 17],
  ["Trans-Orange", "#F08F1C", 98],
  ["Trans-Neon Orange", "#FF800D", 18],
  ["Trans-Yellow", "#F5CD2A", 19],
  ["Trans-Neon Yellow", "#E9F72C", 121],
  ["Trans-Neon Green", "#C0FF00", 16],
  ["Trans-Green", "#5AC35E", 20],
  ["Trans-Bright Green", "#7DC291", 108],
  ["Trans-Light Green", "#BFE8A3", 221],
  ["Trans-Light Bright Green", "#D8F1C9", 226],
  ["Trans-Light Blue", "#A3D2F2", 15],
  ["Trans-Medium Blue", "#6EC1E4", 74],
  ["Trans-Dark Blue", "#0B2E6F", 14],
  ["Trans-Aqua", "#99C9EA", 113],
  ["Trans-Purple", "#5F2683", 51],
  ["Trans-Light Purple", "#D9BDE4", 114],
  ["Trans-Dark Pink", "#C94A83", 50],
  ["Trans-Pink", "#DF6695", 107],
  ["Trans-Brown", "#6F4E37", 13],
  ["Satin Trans-Clear", "#E6F2F2", 228],
  ["Satin Trans-Light Blue", "#A3D2F2", 223],
];

// utils
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const sqr = (x) => x * x;
const luminance = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [200, 200, 200];
  const v = m[1];
  return [
    parseInt(v.slice(0, 2), 16),
    parseInt(v.slice(2, 4), 16),
    parseInt(v.slice(4, 6), 16),
  ];
}

function buildPalette(includeTrans) {
  const arr = [];
  for (const [name, hex, code] of PALETTE_4073_OPAQUE)
    arr.push([name, hexToRgb(hex), code, false]);
  if (includeTrans)
    for (const [name, hex, code] of PALETTE_4073_TRANS)
      arr.push([name, hexToRgb(hex), code, true]);
  return arr;
}

function nearestIndex([r, g, b], palette) {
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
}

/** Crop de l'image d'entrée au ratio (gridW:gridH), puis scale vers (gridW × gridH) */
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
  // image & grille
  const [files, setFiles] = useState([]);
  const [images, setImages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [gridW, setGridW] = useState(48); // colonnes
  const [gridH, setGridH] = useState(64); // lignes

  // palette
  const [includeTrans, setIncludeTrans] = useState(false);
  const [palette, setPalette] = useState(() => buildPalette(false));

  // rendu & sections
  const [showNumbers, setShowNumbers] = useState(true);
  const [secCols, setSecCols] = useState(3);
  const [secRows, setSecRows] = useState(4);

  // cadrage
  const [zoom, setZoom] = useState(1.15);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);

  const mosaicRef = useRef(null);
  const tinyRef = useRef(null);

  const [counts, setCounts] = useState([]);

  // charge les fichiers
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

  // toggle transparents → reconstruit la palette
  useEffect(() => {
    setPalette(buildPalette(includeTrans));
  }, [includeTrans]);

  function processOne(img) {
    const tiny = tinyRef.current;
    const mosaic = mosaicRef.current;

    // 1) crop/resize vers la grille
    drawCroppedToRect(img, tiny, gridW, gridH, zoom, offsetX, offsetY);

    // 2) quantification à la palette (nearest color)
    const id = tiny.getContext("2d").getImageData(0, 0, gridW, gridH);
    const data = id.data;
    for (let y = 0; y < gridH; y++) {
      for (let x = 0; x < gridW; x++) {
        const i = (y * gridW + x) * 4;
        const idx = nearestIndex([data[i], data[i + 1], data[i + 2]], palette);
        const [, rgb] = palette[idx];
        data[i] = rgb[0];
        data[i + 1] = rgb[1];
        data[i + 2] = rgb[2];
      }
    }
    tiny.getContext("2d").putImageData(id, 0, 0);

    // 3) comptage des pièces
    const cts = new Map();
    for (let y = 0; y < gridH; y++) {
      for (let x = 0; x < gridW; x++) {
        const i = (y * gridW + x) * 4;
        const idx = nearestIndex([data[i], data[i + 1], data[i + 2]], palette);
        const name = palette[idx][0];
        cts.set(name, (cts.get(name) || 0) + 1);
      }
    }
    setCounts(Array.from(cts.entries()).sort((a, b) => b[1] - a[1]));

    // 4) rendu "plots ronds" avec numéro (code BrickLink)
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
        const idx = nearestIndex([R, G, B], palette);
        const [, rgb, code] = palette[idx];

        const cx = x * cell,
          cy = y * cell;
        const pad = Math.max(1, Math.floor(cell * 0.12));
        const rad = (cell - pad * 2) / 2;

        // pion rond + bord
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

    // grille fine
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

    // séparateurs & numéros de sections
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

  // re-render quand paramètres changent
  useEffect(() => {
    if (images[currentIndex]) processOne(images[currentIndex]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    images,
    currentIndex,
    gridW,
    gridH,
    includeTrans,
    showNumbers,
    secCols,
    secRows,
    zoom,
    offsetX,
    offsetY,
    palette,
  ]);

  // ======== Exports ========
  function exportPNG() {
    const url = mosaicRef.current.toDataURL("image/png");
    saveAs(url, `mosaic_${gridW}x${gridH}_4073_${includeTrans ? "withTrans" : "opaque"}.png`);
  }

  function exportCSV() {
    const tiny = tinyRef.current;
    const ctx = tiny.getContext("2d");
    const id = ctx.getImageData(0, 0, tiny.width, tiny.height);
    const data = id.data;

    // Matrice codes (IDs BrickLink)
    const rows = [];
    for (let y = 0; y < tiny.height; y++) {
      const cols = [];
      for (let x = 0; x < tiny.width; x++) {
        const i = (y * tiny.width + x) * 4;
        const idx = nearestIndex([data[i], data[i + 1], data[i + 2]], palette);
        const code = palette[idx][2];
        cols.push(code);
      }
      rows.push(cols.join(";"));
    }
    saveAs(
      new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" }),
      `matrix_codes_${gridW}x${gridH}.csv`
    );

    // Liste pièces
    const list = counts.map(
      ([name, qty]) => `[${(palette.find((p) => p[0] === name) || [,, "?"])[2]}] ${name};${qty}`
    );
    saveAs(
      new Blob([`Code-Name;Qty\n` + list.join("\n")], {
        type: "text/csv;charset=utf-8",
      }),
      `parts_codes_${gridW}x${gridH}.csv`
    );
  }

  function exportPDF_A3() {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a3" });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const margin = 12;
    doc.setFontSize(18);
    doc.text(
      `Brick Mosaic ${gridW}×${gridH} — 4073 ${includeTrans ? "(+Trans)" : "(Opaque)"}`,
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
      const entry = palette.find((p) => p[0] === name);
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

    doc.save(`print_A3_${gridW}x${gridH}_4073.pdf`);
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
            const idx = nearestIndex([data[i], data[i + 1], data[i + 2]], palette);
            const [, rgb, code] = palette[idx];

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

        // cadre + grille légère
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

    doc.save(`sections_${secCols}x${secRows}_${gridW}x${gridH}_4073.pdf`);
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">BrickMosaic Pro — 4073 (codes BrickLink)</h1>
          <div className="text-xs opacity-70">
            Grille W×H, numéros par plot, sections & exports
          </div>
        </header>

        <div className="grid lg:grid-cols-3 gap-4">
          {/* colonne options */}
          <div className="bg-white rounded-2xl shadow p-4 space-y-4">
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

            <div className="space-y-2">
              <label className="block text-sm font-medium">
                2) Grille (colonnes × lignes) : {gridW} × {gridH}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-xs">Largeur</span>
                  <input
                    type="range"
                    min={24}
                    max={128}
                    step={1}
                    value={gridW}
                    onChange={(e) => setGridW(parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <span className="text-xs">Hauteur</span>
                  <input
                    type="range"
                    min={24}
                    max={128}
                    step={1}
                    value={gridH}
                    onChange={(e) => setGridH(parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <label className="text-sm font-medium">3) Palette</label>
              <div className="flex items-center gap-2">
                <input
                  id="trans"
                  type="checkbox"
                  checked={includeTrans}
                  onChange={(e) => setIncludeTrans(e.target.checked)}
                />
                <label htmlFor="trans" className="text-sm">
                  Inclure les couleurs transparentes
                </label>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <label className="text-sm font-medium">4) Numérotation & sections</label>
              <div className="flex items-center gap-2">
                <input
                  id="nums"
                  type="checkbox"
                  checked={showNumbers}
                  onChange={(e) => setShowNumbers(e.target.checked)}
                />
                <label htmlFor="nums" className="text-sm">
                  Afficher les numéros (codes BrickLink) sur chaque plot
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-sm">
                  Colonnes (sections):{" "}
                  <input
                    type="number"
                    min={1}
                    className="border rounded px-2 py-1 w-20 ml-2"
                    value={secCols}
                    onChange={(e) => setSecCols(parseInt(e.target.value) || 1)}
                  />
                </label>
                <label className="text-sm">
                  Lignes (sections):{" "}
                  <input
                    type="number"
                    min={1}
                    className="border rounded px-2 py-1 w-20 ml-2"
                    value={secRows}
                    onChange={(e) => setSecRows(parseInt(e.target.value) || 1)}
                  />
                </label>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <label className="text-sm font-medium">5) Cadrage</label>
              <div>
                <span className="text-xs">Zoom : {zoom.toFixed(2)}</span>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <span className="text-xs">Décalage X : {offsetX.toFixed(2)}</span>
                <input
                  type="range"
                  min={-0.5}
                  max={0.5}
                  step={0.01}
                  value={offsetX}
                  onChange={(e) => setOffsetX(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <span className="text-xs">Décalage Y : {offsetY.toFixed(2)}</span>
                <input
                  type="range"
                  min={-0.5}
                  max={0.5}
                  step={0.01}
                  value={offsetY}
                  onChange={(e) => setOffsetY(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>

            <div className="pt-2 border-t space-y-2">
              <button
                className="w-full bg-black text-white rounded-xl py-2"
                onClick={() => images[currentIndex] && processOne(images[currentIndex])}
                disabled={images.length === 0}
              >
                Générer l’aperçu
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={exportPNG} className="px-3 py-2 rounded-xl border" disabled={!images.length}>
                  PNG
                </button>
                <button onClick={exportCSV} className="px-3 py-2 rounded-xl border" disabled={!images.length}>
                  CSV (codes + pièces)
                </button>
                <button onClick={exportPDF_A3} className="px-3 py-2 rounded-xl border col-span-2" disabled={!images.length}>
                  PDF A3 (aperçu + légende)
                </button>
                <button onClick={exportPDF_Sections} className="px-3 py-2 rounded-xl border col-span-2" disabled={!images.length}>
                  PDF Sections ({secCols} × {secRows})
                </button>
              </div>
            </div>
          </div>

          {/* colonne aperçu + palette */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow p-4 space-y-4">
            <div className="overflow-auto w-full border rounded-xl">
              <canvas ref={mosaicRef} className="w-full h-auto" />
            </div>

            <div>
              <h3 className="font-semibold mb-2">Palette ({palette.length} couleurs)</h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
                {palette.map(([name, rgb, code, isTrans]) => (
                  <div key={name} className="flex items-center gap-2 p-2 rounded-xl border">
                    <div
                      className="w-6 h-6 rounded"
                      style={{ background: `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` }}
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>
                          {name} {isTrans ? "(Trans)" : ""}
                        </span>
                        <span className="opacity-70">[{code}]</span>
                      </div>
                      <div className="text-xs opacity-60">rgb({rgb.join(",")})</div>
                    </div>
                    <div className="text-xs opacity-70">{(counts.find(([n]) => n === name) || [0, 0])[1]}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* canvas interne (quantifié) */}
        <canvas ref={tinyRef} style={{ display: "none" }} />
        <footer className="text-xs text-neutral-500 text-center pt-4">
          Astuce : pour un 48×64 en 12 sections, mets sections 3×4 (plaques 16×16).
        </footer>
      </div>
    </div>
  );
}
