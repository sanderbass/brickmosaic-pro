
import React, { useEffect, useRef, useState } from "react";
import { saveAs } from "file-saver";
import { jsPDF } from "jspdf";

/** --- Palette par défaut (RGB approx) --- */
const DEFAULT_PALETTE = [
  ["Black", [33, 32, 35]],
  ["Very Dark Blue", [16, 42, 61]],
  ["Dark Bluish Gray", [99, 95, 98]],
  ["Light Bluish Gray", [182, 185, 189]],
  ["Nougat", [204, 142, 105]],
  ["Reddish Brown", [105, 64, 40]],
  ["Dark Tan", [162, 140, 117]],
  ["Tan", [215, 197, 153]],
  ["Dark Orange", [160, 80, 0]],
  ["Orange", [218, 133, 65]],
  ["Dark Red", [123, 46, 47]],
  ["Red", [196, 40, 27]],
  ["Sand Green", [120, 144, 130]],
  ["Dark Green", [0, 69, 26]],
  ["Green", [40, 127, 70]],
  ["Lime", [164, 189, 71]],
  ["Dark Blue", [0, 70, 173]],
  ["Blue", [13, 105, 171]],
  ["Light Blue", [180, 210, 228]],
  ["Pink", [255, 152, 213]],
  ["Yellow", [245, 205, 47]],
  ["Bright Light Yellow", [255, 255, 153]],
  ["Beige", [230, 220, 200]],
  ["White", [242, 243, 242]]
];

/** Codes par défaut 1..N — à remplacer par tes refs LEGO si tu veux */
const DEFAULT_CODES = Object.fromEntries(DEFAULT_PALETTE.map(([n], i) => [n, i+1]));

const sqr=(x)=>x*x;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const luminance = (r,g,b)=> (0.2126*r + 0.7152*g + 0.0722*b)/255;

function grayWorldBalance(data){
  let r=0,g=0,b=0; const n=data.length/4;
  for(let i=0;i<data.length;i+=4){ r+=data[i]; g+=data[i+1]; b+=data[i+2]; }
  const avg = (r+g+b)/(3*n);
  const rG = avg/(r/n||1), gG = avg/(g/n||1), bG = avg/(b/n||1);
  for(let i=0;i<data.length;i+=4){
    data[i]   = clamp((data[i]*rG)|0,0,255);
    data[i+1] = clamp((data[i+1]*gG)|0,0,255);
    data[i+2] = clamp((data[i+2]*bG)|0,0,255);
  }
}

function adjustPixel(r,g,b, adj){
  let R=r, G=g, B=b;
  R = (R*adj.brightness-128)*adj.contrast + 128;
  G = (G*adj.brightness-128)*adj.contrast + 128;
  B = (B*adj.brightness-128)*adj.contrast + 128;
  const max = Math.max(R,G,B), min = Math.min(R,G,B), l = (max+min)/2;
  let s=0, h=0;
  if(max!==min){
    const d = max-min; s = l>127 ? d/(510-max-min) : d/(max+min);
    switch(max){ case R: h=(G-B)/d + (G<B?6:0); break; case G: h=(B-R)/d + 2; break; case B: h=(R-G)/d + 4; break; }
    h/=6;
  }
  s = clamp(s*adj.saturation,0,1);
  const L = l/255; const q = L<0.5? L*(1+s) : L+s-L*s; const p = 2*L-q;
  const hue2rgb=(p,q,t)=>{ if(t<0)t+=1; if(t>1)t-=1; if(t<1/6)return p+(q-p)*6*t; if(t<1/2)return q; if(t<2/3)return p+(q-p)*(2/3-t)*6; return p; };
  if(s>0){ R = hue2rgb(p,q,h+1/3)*255; G = hue2rgb(p,q,h)*255; B = hue2rgb(p,q,h-1/3)*255; }
  const inv = 1/Math.max(1e-6, adj.gamma);
  R = 255*Math.pow(clamp(R,0,255)/255, inv);
  G = 255*Math.pow(clamp(G,0,255)/255, inv);
  B = 255*Math.pow(clamp(B,0,255)/255, inv);
  return [R|0, G|0, B|0];
}

function nearestIndex([r,g,b], palette) {
  let best = 1e18, idx = 0;
  for(let i=0;i<palette.length;i++){
    const [_, [R,G,B]] = palette[i];
    const d = sqr(R-r)+sqr(G-g)+sqr(B-b);
    if (d<best){ best=d; idx=i; }
  }
  return idx;
}

function floydSteinbergQuantize(data, w, h, palette) {
  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
      const i=(y*w+x)*4; const old=[data[i],data[i+1],data[i+2]];
      const idx = nearestIndex(old, palette); const [, [R,G,B]] = palette[idx];
      const errR=old[0]-R, errG=old[1]-G, errB=old[2]-B;
      data[i]=R; data[i+1]=G; data[i+2]=B;
      const add=(x2,y2,fr)=>{ if(x2>=0&&x2<w&&y2>=0&&y2<h){ const j=(y2*w+x2)*4; data[j]=clamp(data[j]+errR*fr,0,255); data[j+1]=clamp(data[j+1]+errG*fr,0,255); data[j+2]=clamp(data[j+2]+errB*fr,0,255);} };
      add(x+1,y,7/16); add(x-1,y+1,3/16); add(x,y+1,5/16); add(x+1,y+1,1/16);
    }
  }
}

/** Dessine un crop au bon ratio (gridW:gridH) puis scale vers le canvas (gridW x gridH) */
function drawCroppedToRect(img, target, gridW, gridH, zoom, offsetX, offsetY){
  const ctx = target.getContext("2d", { willReadFrequently: true });
  target.width = gridW; target.height = gridH;

  const aspect = gridW / gridH;
  const z = Math.max(1, zoom);

  // Essayer largeur pleine / zoom → calculer hauteur selon ratio
  let viewW = img.width / z;
  let viewH = viewW / aspect;

  // Si trop haut, ajuste sur la hauteur
  if (viewH > img.height / z){
    viewH = img.height / z;
    viewW = viewH * aspect;
  }

  // Centre + offset relatif
  const maxX = img.width - viewW;
  const maxY = img.height - viewH;
  const sx = clamp(img.width/2 - viewW/2 + offsetX * maxX, 0, maxX);
  const sy = clamp(img.height/2 - viewH/2 + offsetY * maxY, 0, maxY);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0,0,gridW,gridH);
  ctx.drawImage(img, sx, sy, viewW, viewH, 0, 0, gridW, gridH);
}

export default function App(){
  const [files, setFiles] = useState([]);
  const [images, setImages] = useState([]);
  const [gridW, setGridW] = useState(48);   // colonnes
  const [gridH, setGridH] = useState(64);   // lignes
  const [round, setRound] = useState(true);
  const [stud, setStud] = useState(true);
  const [dither, setDither] = useState(true);
  const [wbalance, setWbalance] = useState(true);
  const [brightness, setBrightness] = useState(1.06);
  const [contrast, setContrast] = useState(1.06);
  const [saturation, setSaturation] = useState(1.06);
  const [gamma, setGamma] = useState(1.0);
  const [zoom, setZoom] = useState(1.15);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [palette, setPalette] = useState(DEFAULT_PALETTE.map(p=>[...p]));
  const [enabled, setEnabled] = useState(()=>{ const o={}; DEFAULT_PALETTE.forEach(([n])=>o[n]=true); return o; });
  const [codes, setCodes] = useState({...DEFAULT_CODES}); // { name: codeNumber }
  const [maxColors, setMaxColors] = useState(DEFAULT_PALETTE.length);
  const [showNumbers, setShowNumbers] = useState(true);
  const [secCols, setSecCols] = useState(3);
  const [secRows, setSecRows] = useState(4);
  const mosaicRef = useRef(null);
  const tinyRef = useRef(null);
  const [counts, setCounts] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(()=>{
    if(files.length===0){ setImages([]); return; }
    let cancelled=false;
    (async()=>{
      const arr=[];
      for(const f of files){
        const url = URL.createObjectURL(f);
        await new Promise((res)=>{ const im=new Image(); im.onload=()=>{arr.push(im); res();}; im.src=url; });
      }
      if(!cancelled) setImages(arr);
    })();
    return ()=>{cancelled=true};
  }, [files]);

  function activePalette(){
    let act = palette.filter(([name])=> enabled[name]);
    if (maxColors < act.length){
      const tmp = quickMapCounts(act);
      const order = Array.from(tmp.entries()).sort((a,b)=>b[1]-a[1]).map(([name])=>name);
      const pick = new Set(order.slice(0, maxColors));
      act = act.filter(([n])=> pick.has(n));
    }
    return act;
  }

  function quickMapCounts(act){
    const out = new Map();
    const m = tinyRef.current; if(!m) return out; const ctx=m.getContext('2d'); const id = ctx.getImageData(0,0,m.width,m.height); const data=id.data;
    for(let y=0;y<m.height;y++){
      for(let x=0;x<m.width;x++){
        const i=(y*m.width+x)*4; const idx = nearestIndex([data[i],data[i+1],data[i+2]], act); const name = act[idx][0];
        out.set(name, (out.get(name)||0)+1);
      }
    }
    return out;
  }

  function processOne(img){
    const tiny = tinyRef.current; const mosaic = mosaicRef.current;
    // prépare canvases aux dimensions demandées
    drawCroppedToRect(img, tiny, gridW, gridH, zoom, offsetX, offsetY);

    let id = tiny.getContext('2d').getImageData(0,0,gridW,gridH);
    const data = id.data;
    if(wbalance) grayWorldBalance(data);
    for(let i=0;i<data.length;i+=4){
      const [r,g,b] = adjustPixel(data[i], data[i+1], data[i+2], {brightness, contrast, saturation, gamma});
      data[i]=r; data[i+1]=g; data[i+2]=b;
    }
    const act = activePalette();
    if(dither){
      const tmp = new Uint8ClampedArray(data); floydSteinbergQuantize(tmp, gridW, gridH, act); for(let i=0;i<data.length;i++) data[i]=tmp[i];
    } else {
      for(let y=0;y<gridH;y++){
        for(let x=0;x<gridW;x++){
          const i=(y*gridW+x)*4; const idx = nearestIndex([data[i],data[i+1],data[i+2]], act); const [,rgb] = act[idx];
          data[i]=rgb[0]; data[i+1]=rgb[1]; data[i+2]=rgb[2];
        }
      }
    }
    tiny.getContext('2d').putImageData(id,0,0);

    // Comptage
    const cts = new Map();
    for(let y=0;y<gridH;y++){
      for(let x=0;x<gridW;x++){
        const i=(y*gridW+x)*4; const idx = nearestIndex([data[i],data[i+1],data[i+2]], act); const name = act[idx][0];
        cts.set(name, (cts.get(name)||0)+1);
      }
    }
    setCounts(Array.from(cts.entries()).sort((a,b)=>b[1]-a[1]));

    // Dessin
    const cell = 14;
    mosaic.width = gridW*cell; mosaic.height=gridH*cell;
    const g = mosaic.getContext('2d'); g.clearRect(0,0,mosaic.width,mosaic.height);

    for(let y=0;y<gridH;y++){
      for(let x=0;x<gridW;x++){
        const i=(y*gridW+x)*4;
        const R=data[i], G=data[i+1], B=data[i+2];
        const idx = nearestIndex([R,G,B], act);
        const name = act[idx][0];
        const code = (codes[name] ?? (idx+1)).toString();

        const cx=x*cell, cy=y*cell;
        if(round){
          const pad=Math.max(1, Math.floor(cell*0.12)); const rad=(cell-pad*2)/2;
          g.fillStyle=`rgb(${R},${G},${B})`;
          g.strokeStyle="#111"; g.lineWidth=Math.max(1,Math.floor(cell*0.06));
          g.beginPath(); g.arc(cx+cell/2, cy+cell/2, rad, 0, Math.PI*2); g.fill(); g.stroke();
          if(stud){ g.beginPath(); g.fillStyle='rgba(255,255,255,0.22)'; g.arc(cx+cell*0.40, cy+cell*0.40, rad*0.35, 0, Math.PI*2); g.fill(); }
        } else {
          g.fillStyle=`rgb(${R},${G},${B})`; g.fillRect(cx,cy,cell,cell);
        }

        if(showNumbers){
          const lum = luminance(R,G,B);
          g.font = `bold ${Math.floor(cell*0.55)}px system-ui, -apple-system, Segoe UI, Roboto`;
          g.textAlign='center'; g.textBaseline='middle';
          g.lineWidth = 3;
          g.strokeStyle = lum<0.5 ? 'rgba(255,255,255,0.9)' : 'rgba(20,20,20,0.9)';
          g.fillStyle   = '#000';
          g.strokeText(code, cx+cell/2, cy+cell/2);
          g.fillText(code,   cx+cell/2, cy+cell/2);
        }
      }
    }

    // Grille fine
    g.strokeStyle = round ? 'rgba(0,0,0,0.18)' : '#000';
    g.lineWidth=1;
    for(let i=0;i<=gridW;i++){ g.beginPath(); g.moveTo(i*cell,0); g.lineTo(i*cell, gridH*cell); g.stroke(); }
    for(let j=0;j<=gridH;j++){ g.beginPath(); g.moveTo(0,j*cell); g.lineTo(gridW*cell, j*cell); g.stroke(); }

    // Sections
    if(secCols>0 && secRows>0){
      const secW = Math.floor(gridW/secCols);
      const secH = Math.floor(gridH/secRows);
      g.strokeStyle='#ddd'; g.lineWidth=4;
      for(let c=1;c<secCols;c++){ const x = c*secW*cell; g.beginPath(); g.moveTo(x,0); g.lineTo(x, gridH*cell); g.stroke(); }
      for(let r=1;r<secRows;r++){ const y = r*secH*cell; g.beginPath(); g.moveTo(0,y); g.lineTo(gridW*cell, y); g.stroke(); }
      // Numéros de sections
      let n=1;
      g.fillStyle='rgba(255,255,255,0.85)'; g.strokeStyle='rgba(0,0,0,0.3)';
      for(let r=0;r<secRows;r++){
        for(let c=0;c<secCols;c++){
          const cx = (c*secW + secW/2)*cell;
          const cy = (r*secH + secH/2)*cell;
          g.font = `bold ${Math.floor(cell*Math.min(secW,secH)*0.35)}px system-ui`;
          g.textAlign='center'; g.textBaseline='middle';
          g.strokeText(String(n), cx, cy);
          g.fillText(String(n), cx, cy);
          n++;
        }
      }
    }
  }

  useEffect(()=>{ if(images[currentIndex]) processOne(images[currentIndex]); }, [images, currentIndex, gridW, gridH, round, stud, dither, wbalance, brightness, contrast, saturation, gamma, zoom, offsetX, offsetY, enabled, palette, maxColors, showNumbers, secCols, secRows, codes]);

  // Exports
  function exportPNG(){ const url = mosaicRef.current.toDataURL('image/png'); saveAs(url, `mosaic_${gridW}x${gridH}${round?"_round":"_square"}_num.png`); }
  function exportCSV(){
    const tiny = tinyRef.current; const ctx=tiny.getContext('2d'); const id=ctx.getImageData(0,0,tiny.width,tiny.height); const data=id.data; const act=activePalette();
    const rows=[]; for(let y=0;y<tiny.height;y++){ const cols=[]; for(let x=0;x<tiny.width;x++){ const i=(y*tiny.width+x)*4; const idx=nearestIndex([data[i],data[i+1],data[i+2]], act); const name=act[idx][0]; cols.push(codes[name] ?? (idx+1)); } rows.push(cols.join(';')); }
    saveAs(new Blob([rows.join('\\n')],{type:'text/csv;charset=utf-8'}), `matrix_codes_${gridW}x${gridH}.csv`);
    const list = counts.map(([name,qty])=>`[${codes[name]}] ${name};${qty}`);
    saveAs(new Blob([`Code-Name;Qty\\n`+list.join('\\n')],{type:'text/csv;charset=utf-8'}), `parts_codes_${gridW}x${gridH}.csv`);
  }
  function exportPDF_A3(){
    const doc = new jsPDF({orientation:'portrait', unit:'mm', format:'a3'});
    const W=doc.internal.pageSize.getWidth(); const H=doc.internal.pageSize.getHeight(); const margin=12;
    doc.setFontSize(18); doc.text(`Brick Mosaic ${gridW}×${gridH}${round?" (ronds)":" (carrés)"} — codes`, W/2, 12, {align:'center'});
    const sideW = W - margin*2 - 45; const sideH = H - margin*2 - 10;
    const aspect = mosaicRef.current.width / mosaicRef.current.height;
    let drawW = sideW, drawH = drawW / aspect;
    if (drawH > sideH){ drawH = sideH; drawW = drawH * aspect; }
    const dataUrl = mosaicRef.current.toDataURL('image/png');
    doc.addImage(dataUrl, 'PNG', margin, 18, drawW, drawH);
    let x = margin + drawW + 10, y = 24; doc.setFontSize(12); doc.text('Légende & Quantités', x, y); y+=6; const box=6;
    counts.forEach(([name,qty])=>{
      const rgb=(palette.find(p=>p[0]===name)?.[1])||[200,200,200]; const code = codes[name] ?? '?';
      doc.setFillColor(rgb[0],rgb[1],rgb[2]); doc.rect(x,y,box,box,'F'); doc.setDrawColor(0); doc.rect(x,y,box,box);
      doc.text(`[${code}] ${name}: ${qty}`, x+box+3, y+4);
      y+=box+3; if(y>H-margin){ doc.addPage(); y=margin; }
    });
    doc.save(`print_codes_A3_${gridW}x${gridH}.pdf`);
  }
  function exportPDF_Sections(){
    const tiny = tinyRef.current; const Gx = tiny.width; const Gy = tiny.height;
    const secW = Math.floor(Gx/secCols), secH = Math.floor(Gy/secRows);
    const doc = new jsPDF({orientation:'portrait', unit:'mm', format:'a4'});
    const W=doc.internal.pageSize.getWidth(); const H=doc.internal.pageSize.getHeight();
    const margin=10; const usableW=W-2*margin; const usableH=H-2*margin-10;
    const cell = Math.min(usableW/secW, (usableH)/secH);
    const ctx = tiny.getContext('2d'); const id=ctx.getImageData(0,0,Gx,Gy); const data=id.data; const act=activePalette();

    let n=1; let first=true;
    for(let r=0;r<secRows;r++){
      for(let c=0;c<secCols;c++){
        if(!first) doc.addPage(); first=false;
        const title = `Section ${n}`;
        doc.setFontSize(16); doc.text(title, W/2, 10, {align:'center'});
        const boardW = secW*cell, boardH = secH*cell;
        const ox = margin + (usableW - boardW)/2;
        const oy = margin + 10 + (usableH - boardH)/2;
        for(let y=0;y<secH;y++){
          for(let x=0;x<secW;x++){
            const gx = c*secW + x, gy = r*secH + y; if(gx>=Gx||gy>=Gy) continue; const i=(gy*Gx+gx)*4; const idx=nearestIndex([data[i],data[i+1],data[i+2]], act); const [name,rgb]=act[idx];
            const px = ox + x*cell, py = oy + y*cell;
            if(round){ const rad = (cell*0.76)/2; doc.setFillColor(rgb[0],rgb[1],rgb[2]); doc.setDrawColor(0); doc.circle(px+cell/2, py+cell/2, rad, 'FD'); }
            else { doc.setFillColor(rgb[0],rgb[1],rgb[2]); doc.rect(px,py,cell,cell,'F'); }
            const code = codes[name] ?? (idx+1);
            const lum = luminance(rgb[0],rgb[1],rgb[2]);
            doc.setTextColor(lum<0.5?255:0, lum<0.5?255:0, lum<0.5?255:0);
            doc.setFontSize(Math.max(6, cell*0.55));
            doc.text(String(code), px+cell/2, py+cell/2, {align:'center', baseline:'middle'});
          }
        }
        // cadre + grille légère
        doc.setDrawColor(180); doc.setLineWidth(0.1);
        for(let i=0;i<=secW;i++){ const x = ox + i*cell; doc.line(x, oy, x, oy+cell*secH); }
        for(let j=0;j<=secH;j++){ const y = oy + j*cell; doc.line(ox, y, ox+cell*secH, y); }
        doc.setDrawColor(0); doc.setLineWidth(0.2); doc.rect(ox, oy, cell*secW, cell*secH);
        n++;
      }
    }
    doc.save(`sections_${secCols}x${secRows}_${gridW}x${gridH}.pdf`);
  }

  useEffect(()=>{ if(images[currentIndex]) processOne(images[currentIndex]); }, [images, currentIndex]);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">BrickMosaic Pro — Codes + Numéros (W×H)</h1>
          <div className="text-xs opacity-70">Largeur et hauteur indépendantes</div>
        </header>

        <div className="grid lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl shadow p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">1) Charger photo(s)</label>
              <input type="file" accept="image/*" multiple onChange={(e)=>{ const f=e.target.files; if(!f) return; setFiles(Array.from(f)); setCurrentIndex(0);} }/>
              {images.length>0 && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs">Image:</span>
                  <select className="border rounded px-2 py-1 text-sm" value={currentIndex} onChange={e=>setCurrentIndex(parseInt(e.target.value))}>
                    {images.map((_,i)=>(<option key={i} value={i}>{i+1}/{images.length}</option>))}
                  </select>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium">Grille (colonnes × lignes): {gridW} × {gridH}</label>
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-xs">Largeur</span><input type="range" min={24} max={128} step={1} value={gridW} onChange={e=>setGridW(parseInt(e.target.value))} className="w-full"/></div>
                <div><span className="text-xs">Hauteur</span><input type="range" min={24} max={128} step={1} value={gridH} onChange={e=>setGridH(parseInt(e.target.value))} className="w-full"/></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button className={`px-3 py-2 rounded-xl border ${round?'bg-black text-white':'bg-white'}`} onClick={()=>setRound(true)}>Plots ronds</button>
              <button className={`px-3 py-2 rounded-xl border ${!round?'bg-black text-white':'bg-white'}`} onClick={()=>setRound(false)}>Carrés</button>
            </div>
            <div className="flex items-center gap-2">
              <input id="stud" type="checkbox" checked={stud} onChange={e=>setStud(e.target.checked)} />
              <label htmlFor="stud" className="text-sm">Reflet 3D</label>
            </div>
            <div className="flex items-center gap-2">
              <input id="dither" type="checkbox" checked={dither} onChange={e=>setDither(e.target.checked)} />
              <label htmlFor="dither" className="text-sm">Dithering</label>
            </div>
            <div className="flex items-center gap-2">
              <input id="wb" type="checkbox" checked={wbalance} onChange={e=>setWbalance(e.target.checked)} />
              <label htmlFor="wb" className="text-sm">Balance des blancs</label>
            </div>

            <div className="space-y-2">
              <div><label className="text-sm">Zoom: {zoom.toFixed(2)}</label><input type="range" min={1} max={3} step={0.01} value={zoom} onChange={e=>setZoom(parseFloat(e.target.value))} className="w-full"/></div>
              <div><label className="text-sm">Décalage X: {offsetX.toFixed(2)}</label><input type="range" min={-0.5} max={0.5} step={0.01} value={offsetX} onChange={e=>setOffsetX(parseFloat(e.target.value))} className="w-full"/></div>
              <div><label className="text-sm">Décalage Y: {offsetY.toFixed(2)}</label><input type="range" min={-0.5} max={0.5} step={0.01} value={offsetY} onChange={e=>setOffsetY(parseFloat(e.target.value))} className="w-full"/></div>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <label className="text-sm font-medium">Numérotation & sections</label>
              <div className="flex items-center gap-2">
                <input id="nums" type="checkbox" checked={showNumbers} onChange={e=>setShowNumbers(e.target.checked)} />
                <label htmlFor="nums" className="text-sm">Afficher les numéros sur chaque pion</label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-sm">Colonnes (sections): <input type="number" min={1} className="border rounded px-2 py-1 w-20 ml-2" value={secCols} onChange={e=>setSecCols(parseInt(e.target.value)||1)}/></label>
                <label className="text-sm">Lignes (sections): <input type="number" min={1} className="border rounded px-2 py-1 w-20 ml-2" value={secRows} onChange={e=>setSecRows(parseInt(e.target.value)||1)}/></label>
              </div>
            </div>

            <div className="pt-2 border-t space-y-2">
              <button className="w-full bg-black text-white rounded-xl py-2" onClick={()=>images[currentIndex] && processOne(images[currentIndex])} disabled={images.length===0}>Générer l'aperçu</button>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={exportPNG} className="px-3 py-2 rounded-xl border" disabled={!images.length}>PNG</button>
                <button onClick={exportCSV} className="px-3 py-2 rounded-xl border" disabled={!images.length}>CSV (codes + parts)</button>
                <button onClick={exportPDF_A3} className="px-3 py-2 rounded-xl border col-span-2" disabled={!images.length}>PDF A3 (mosaic + légende)</button>
                <button onClick={exportPDF_Sections} className="px-3 py-2 rounded-xl border col-span-2" disabled={!images.length}>PDF Sections ({secCols}×{secRows})</button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 bg-white rounded-2xl shadow p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Aperçu</h2>
            </div>
            <div className="overflow-auto w-full border rounded-xl">
              <canvas ref={mosaicRef} className="w-full h-auto"/>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Palette, codes & quantités</h3>
              <div className="flex items-center gap-3 mb-2">
                <label className="text-sm">Limiter à : {maxColors} couleurs</label>
                <input type="range" min={2} max={palette.length} value={maxColors} onChange={e=>setMaxColors(parseInt(e.target.value))}/>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
                {palette.map(([name, rgb])=>{
                  const qty = (counts.find(([n])=>n===name)||[])[1] || 0; const active = enabled[name];
                  return (
                    <div key={name} className={`flex items-center gap-2 p-2 rounded-xl border ${active?'':'opacity-40'}`}>
                      <div className="w-6 h-6 rounded" style={{background:`rgb(${rgb[0]},${rgb[1]},${rgb[2]})`}}/>
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-sm">
                          <span>[{codes[name] ?? ''}] {name}</span>
                          <span className="opacity-70">{qty}</span>
                        </div>
                        <div className="text-xs opacity-60">rgb({rgb.join(',')})</div>
                      </div>
                      <input className="w-16 border rounded px-1 py-0.5 text-xs" defaultValue={codes[name]} onBlur={(e)=>{ const v=parseInt(e.target.value); setCodes(prev=>({...prev, [name]: isNaN(v)? prev[name]: v })); }} title="Code" />
                      <label className="text-xs flex items-center gap-1 ml-2">
                        <input type="checkbox" checked={!!enabled[name]} onChange={e=>setEnabled(prev=>({...prev, [name]: e.target.checked}))}/>
                        actif
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <canvas ref={tinyRef} style={{display:'none'}}/>
        <footer className="text-xs text-neutral-500 text-center pt-4">
          Exemple: mets largeur=48 et hauteur=64 pour un 48×64 (3×4 sections de 16×16 par ex.).
        </footer>
      </div>
    </div>
  );
}
