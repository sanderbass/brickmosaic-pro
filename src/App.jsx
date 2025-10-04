import React, { useEffect, useRef, useState } from "react";
import { saveAs } from "file-saver";
import { jsPDF } from "jspdf";
import JSZip from "jszip";

const DEFAULT_PALETTE = [
  ["White", [242, 243, 242]], ["Black", [33, 32, 35]],
  ["Light Gray", [160, 165, 169]], ["Dark Gray", [99, 95, 98]],
  ["Light Bluish Gray", [182, 185, 189]], ["Dark Bluish Gray", [99, 95, 98]],
  ["Tan", [215, 197, 153]], ["Dark Tan", [162, 140, 117]],
  ["Brown", [124, 92, 70]], ["Reddish Brown", [105, 64, 40]],
  ["Beige", [230, 220, 200]], ["Nougat", [204, 142, 105]],
  ["Red", [196, 40, 27]], ["Dark Red", [123, 46, 47]],
  ["Blue", [13, 105, 171]], ["Dark Blue", [0, 70, 173]],
  ["Light Blue", [180, 210, 228]], ["Yellow", [245, 205, 47]],
  ["Bright Light Yellow", [255, 255, 153]], ["Orange", [218, 133, 65]],
  ["Dark Orange", [160, 80, 0]], ["Green", [40, 127, 70]],
  ["Dark Green", [0, 69, 26]], ["Lime", [164, 189, 71]],
  ["Sand Green", [120, 144, 130]], ["Purple", [124, 92, 171]],
  ["Magenta", [170, 45, 152]], ["Pink", [255, 152, 213]],
];

const sqr=(x)=>x*x; const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
function grayWorldBalance(data){ let r=0,g=0,b=0; const n=data.length/4; for(let i=0;i<data.length;i+=4){ r+=data[i]; g+=data[i+1]; b+=data[i+2]; } const avg=(r+g+b)/(3*n); const rG=avg/(r/n||1), gG=avg/(g/n||1), bG=avg/(b/n||1); for(let i=0;i<data.length;i+=4){ data[i]=clamp((data[i]*rG)|0,0,255); data[i+1]=clamp((data[i+1]*gG)|0,0,255); data[i+2]=clamp((data[i+2]*bG)|0,0,255);} }
function adjustPixel(r,g,b, adj){ let R=r,G=g,B=b; R=(R*adj.brightness-128)*adj.contrast+128; G=(G*adj.brightness-128)*adj.contrast+128; B=(B*adj.brightness-128)*adj.contrast+128; const max=Math.max(R,G,B), min=Math.min(R,G,B), l=(max+min)/2; let s=0,h=0; if(max!==min){ const d=max-min; s=l>127? d/(510-max-min): d/(max+min); switch(max){case R:h=(G-B)/d+(G<B?6:0); break; case G:h=(B-R)/d+2; break; case B:h=(R-G)/d+4; break;} h/=6;} s=clamp(s*adj.saturation,0,1); const L=l/255; const q=L<0.5? L*(1+s): L+s-L*s; const p=2*L-q; const hue2rgb=(p,q,t)=>{ if(t<0)t+=1; if(t>1)t-=1; if(t<1/6)return p+(q-p)*6*t; if(t<1/2)return q; if(t<2/3)return p+(q-p)*(2/3-t)*6; return p; }; if(s>0){ R=hue2rgb(p,q,h+1/3)*255; G=hue2rgb(p,q,h)*255; B=hue2rgb(p,q,h-1/3)*255; } const inv=1/Math.max(1e-6,adj.gamma); R=255*Math.pow(clamp(R,0,255)/255,inv); G=255*Math.pow(clamp(G,0,255)/255,inv); B=255*Math.pow(clamp(B,0,255)/255,inv); return [R|0,G|0,B|0]; }
function nearestIndex([r,g,b], pal){ let best=1e18, idx=0; for(let i=0;i<pal.length;i++){ const [_,[R,G,B]]=pal[i]; const d=sqr(R-r)+sqr(G-g)+sqr(B-b); if(d<best){ best=d; idx=i; } } return idx; }
function floydSteinbergQuantize(data,w,h,pal){ for(let y=0;y<h;y++){ for(let x=0;x<w;x++){ const i=(y*w+x)*4; const old=[data[i],data[i+1],data[i+2]]; const idx=nearestIndex(old,pal); const [, [R,G,B]]=pal[idx]; const errR=old[0]-R, errG=old[1]-G, errB=old[2]-B; data[i]=R; data[i+1]=G; data[i+2]=B; const add=(x2,y2,fr)=>{ if(x2>=0&&x2<w&&y2>=0&&y2<h){ const j=(y2*w+x2)*4; data[j]=clamp(data[j]+errR*fr,0,255); data[j+1]=clamp(data[j+1]+errG*fr,0,255); data[j+2]=clamp(data[j+2]+errB*fr,0,255);} }; add(x+1,y,7/16); add(x-1,y+1,3/16); add(x,y+1,5/16); add(x+1,y+1,1/16); } } }
function drawCroppedToSquare(img,target,grid,zoom,offsetX,offsetY){ const ctx=target.getContext("2d",{willReadFrequently:true}); target.width=grid; target.height=grid; const side=Math.min(img.width,img.height); const zoomClamp=Math.max(1,zoom); const view=side/zoomClamp; const cx=img.width/2 + offsetX*(side - view); const cy=img.height/2 + offsetY*(side - view); const sx=clamp(cx - view/2,0,img.width - view); const sy=clamp(cy - view/2,0,img.height - view); ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high'; ctx.clearRect(0,0,grid,grid); ctx.drawImage(img,sx,sy,view,view,0,0,grid,grid); }
function autoCropFromSkin(img){ const S=256; const off=document.createElement('canvas'); off.width=S; off.height=S; const g=off.getContext('2d'); const side=Math.min(img.width,img.height); const sx=(img.width-side)/2, sy=(img.height-side)/2; g.drawImage(img,sx,sy,side,side,0,0,S,S); const id=g.getImageData(0,0,S,S); const d=id.data; let minX=S,minY=S,maxX=0,maxY=0,found=0; for(let y=0;y<S;y++){ for(let x=0;x<S;x++){ const i=(y*S+x)*4; const r=d[i], gc=d[i+1], b=d[i+2]; const Y=0.299*r+0.587*gc+0.114*b; const Cb=128-0.169*r-0.331*gc+0.5*b; const Cr=128+0.5*r-0.419*gc-0.081*b; if(Cr>135&&Cr<180&&Cb>85&&Cb<135&&Y>40){ if(x<minX)minX=x; if(x>maxX)maxX=x; if(y<minY)minY=y; if(y>maxY)maxY=y; found++; } } } if(found<100) return {zoom:1,offsetX:0,offsetY:0}; const cx=(minX+maxX)/2, cy=(minY+maxY)/2; const bw=maxX-minX, bh=maxY-minY; const rad=Math.max(bw,bh)/2; const centerX=(cx/S-0.5)*2; const centerY=(cy/S-0.5)*2; const desiredView=Math.min(1,Math.max(0.5,0.8*(1/(rad/S)))); return { zoom: desiredView*1.2, offsetX: centerX*0.2, offsetY: centerY*0.2 }; }

export default function App(){
  const [files,setFiles]=useState([]); const [images,setImages]=useState([]); const [grid,setGrid]=useState(64);
  const [round,setRound]=useState(true); const [stud,setStud]=useState(true); const [dither,setDither]=useState(true);
  const [wbalance,setWbalance]=useState(true); const [brightness,setBrightness]=useState(1.06);
  const [contrast,setContrast]=useState(1.06); const [saturation,setSaturation]=useState(1.06); const [gamma,setGamma]=useState(1.0);
  const [zoom,setZoom]=useState(1.2); const [offsetX,setOffsetX]=useState(0); const [offsetY,setOffsetY]=useState(0);
  const [palette,setPalette]=useState(DEFAULT_PALETTE.map(p=>[...p])); const [enabled,setEnabled]=useState(()=>{const o={}; DEFAULT_PALETTE.forEach(([n])=>o[n]=true); return o;}); const [maxColors,setMaxColors]=useState(DEFAULT_PALETTE.length);
  const mosaicRef=useRef(null); const tinyRef=useRef(null); const [counts,setCounts]=useState([]); const [currentIndex,setCurrentIndex]=useState(0);

  useEffect(()=>{ if(files.length===0){ setImages([]); return; } let cancelled=false; (async()=>{ const arr=[]; for(const f of files){ const url=URL.createObjectURL(f); await new Promise((res)=>{ const im=new Image(); im.onload=()=>{arr.push(im); res();}; im.src=url; }); } if(!cancelled) setImages(arr); })(); return ()=>{cancelled=true}; }, [files]);

  function activePalette(){ let act=palette.filter(([name])=>enabled[name]); if(maxColors<act.length){ const tmp=quickMapCounts(act); const order=Array.from(tmp.entries()).sort((a,b)=>b[1]-a[1]).map(([name])=>name); const pick=new Set(order.slice(0,maxColors)); act=act.filter(([n])=>pick.has(n)); } return act; }
  function quickMapCounts(act){ const out=new Map(); const m=tinyRef.current; if(!m) return out; const ctx=m.getContext('2d'); const id=ctx.getImageData(0,0,m.width,m.height); const data=id.data; for(let y=0;y<m.height;y++){ for(let x=0;x<m.width;x++){ const i=(y*m.width+x)*4; const idx=nearestIndex([data[i],data[i+1],data[i+2]],act); const name=act[idx][0]; out.set(name,(out.get(name)||0)+1); } } return out; }

  function processOne(img){
    const gridN=grid; const tiny=tinyRef.current; const mosaic=mosaicRef.current; drawCroppedToSquare(img,tiny,gridN,zoom,offsetX,offsetY);
    let id=tiny.getContext('2d').getImageData(0,0,gridN,gridN); const data=id.data;
    if(wbalance) grayWorldBalance(data);
    for(let i=0;i<data.length;i+=4){ const [r,g,b]=adjustPixel(data[i],data[i+1],data[i+2],{brightness,contrast,saturation,gamma}); data[i]=r; data[i+1]=g; data[i+2]=b; }
    const act=activePalette(); if(dither){ const tmp=new Uint8ClampedArray(data); floydSteinbergQuantize(tmp,gridN,gridN,act); for(let i=0;i<data.length;i++) data[i]=tmp[i]; } else { for(let y=0;y<gridN;y++){ for(let x=0;x<gridN;x++){ const i=(y*gridN+x)*4; const idx=nearestIndex([data[i],data[i+1],data[i+2]],act); const [,rgb]=act[idx]; data[i]=rgb[0]; data[i+1]=rgb[1]; data[i+2]=rgb[2]; } } }
    tiny.getContext('2d').putImageData(id,0,0);
    const cts=new Map(); for(let y=0;y<gridN;y++){ for(let x=0;x<gridN;x++){ const i=(y*gridN+x)*4; const idx=nearestIndex([data[i],data[i+1],data[i+2]],act); const name=act[idx][0]; cts.set(name,(cts.get(name)||0)+1); } } setCounts(Array.from(cts.entries()).sort((a,b)=>b[1]-a[1]));
    const cell=12; mosaic.width=gridN*cell; mosaic.height=gridN*cell; const g=mosaic.getContext('2d'); g.clearRect(0,0,mosaic.width,mosaic.height);
    for(let y=0;y<gridN;y++){ for(let x=0;x<gridN;x++){ const i=(y*gridN+x)*4; const R=data[i],G=data[i+1],B=data[i+2]; const cx=x*cell, cy=y*cell;
      if(round){ const pad=Math.max(1,Math.floor(cell*0.12)); const rad=(cell-pad*2)/2; g.fillStyle=`rgb(${R},${G},${B})`; g.strokeStyle="#000"; g.beginPath(); g.arc(cx+cell/2,cy+cell/2,rad,0,Math.PI*2); g.fill(); g.lineWidth=Math.max(1,Math.floor(cell*0.06)); g.stroke(); if(stud){ g.beginPath(); g.fillStyle='rgba(255,255,255,0.24)'; g.arc(cx+cell*0.40, cy+cell*0.40, rad*0.35, 0, Math.PI*2); g.fill(); } }
      else { g.fillStyle=`rgb(${R},${G},${B})`; g.fillRect(cx,cy,cell,cell); } } }
    g.strokeStyle=round?'rgba(0,0,0,0.2)':'#000'; g.lineWidth=1; for(let i=0;i<=gridN;i++){ g.beginPath(); g.moveTo(i*cell,0); g.lineTo(i*cell,gridN*cell); g.stroke(); g.beginPath(); g.moveTo(0,i*cell); g.lineTo(gridN*cell,i*cell); g.stroke(); }
  }

  useEffect(()=>{ if(images[currentIndex]) processOne(images[currentIndex]); }, [images,currentIndex,grid,round,stud,dither,wbalance,brightness,contrast,saturation,gamma,zoom,offsetX,offsetY,enabled,palette,maxColors]);

  function exportPNG(){ const url=mosaicRef.current.toDataURL('image/png'); saveAs(url, `mosaic_${grid}${round?"_round":"_square"}.png`); }
  function exportCSV(){ const tiny=tinyRef.current; const ctx=tiny.getContext('2d'); const id=ctx.getImageData(0,0,tiny.width,tiny.height); const data=id.data; const act=activePalette(); const rows=[]; for(let y=0;y<tiny.height;y++){ const cols=[]; for(let x=0;x<tiny.width;x++){ const i=(y*tiny.width+x)*4; const idx=nearestIndex([data[i],data[i+1],data[i+2]],act); cols.push(act[idx][0]); } rows.push(cols.join(';')); } saveAs(new Blob([rows.join('\\n')],{type:'text/csv;charset=utf-8'}), `matrix_${grid}x${grid}.csv`); const list=counts.map(([name,qty])=>`${name};${qty}`); saveAs(new Blob([`Color;Qty\\n`+list.join('\\n')],{type:'text/csv;charset=utf-8'}), `parts_${grid}x${grid}.csv`); }
  function exportPDF_A3(){ const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a3'}); const W=doc.internal.pageSize.getWidth(); const H=doc.internal.pageSize.getHeight(); const margin=12; const title=`Portrait Brick Mosaic ${grid}×${grid}${round?" (ronds)":" (carrés)"}`; doc.setFontSize(18); doc.text(title, W/2, 12, {align:'center'}); const side=Math.min(W - margin*2 - 45, H - margin*2 - 10); const dataUrl=mosaicRef.current.toDataURL('image/png'); doc.addImage(dataUrl,'PNG',margin,18,side,side); let x=margin+side+10,y=24; doc.setFontSize(12); doc.text('Légende & Quantités', x, y); y+=6; const box=6; counts.forEach(([name,qty])=>{ const rgb=(DEFAULT_PALETTE.find(p=>p[0]===name)?.[1])||[200,200,200]; doc.setFillColor(rgb[0],rgb[1],rgb[2]); doc.rect(x,y,box,box,'F'); doc.setDrawColor(0); doc.rect(x,y,box,box); doc.text(`${name}: ${qty}`, x+box+3, y+4); y+=box+3; if(y>H-margin){ doc.addPage(); y=margin; }}); doc.save(`print_A3_${grid}${round?"_round":"_square"}.pdf`); }
  function exportPDF_Plaques(){ const tiny=tinyRef.current; const G=tiny.width; const plates=32; const cols=Math.ceil(G/plates); const rows=Math.ceil(G/plates); const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'}); const W=doc.internal.pageSize.getWidth(); const H=doc.internal.pageSize.getHeight(); const margin=10; const usableW=W-2*margin; const usableH=H-2*margin-10; const side=Math.min(usableW,usableH); const cell=side/plates; const ctx=tiny.getContext('2d'); const id=ctx.getImageData(0,0,G,G); const data=id.data; const act=activePalette(); let first=true; for(let pr=0; pr<rows; pr++){ for(let pc=0; pc<cols; pc++){ if(!first) doc.addPage(); first=false; doc.setFontSize(14); doc.text(`Plaque (${pr+1},${pc+1}) — 32×32`, W/2, 8, {align:'center'}); const ox=margin + (W-2*margin - cell*plates)/2; const oy=margin + 10 + (H-2*margin-10 - cell*plates)/2; for(let y=0;y<plates;y++){ for(let x=0;x<plates;x++){ const gx=pc*plates + x, gy=pr*plates + y; if(gx>=G||gy>=G) continue; const i=(gy*G+gx)*4; const idx=nearestIndex([data[i],data[i+1],data[i+2]],act); const [,rgb]=act[idx]; const px=ox + x*cell, py=oy + y*cell; if(round){ const rad=(cell*0.76)/2; doc.setFillColor(rgb[0],rgb[1],rgb[2]); doc.setDrawColor(0); doc.circle(px+cell/2, py+cell/2, rad, 'FD'); } else { doc.setFillColor(rgb[0],rgb[1],rgb[2]); doc.rect(px,py,cell,cell,'F'); } } } doc.setDrawColor(180); doc.setLineWidth(0.1); for(let i=0;i<=plates;i++){ const x=ox + i*cell; doc.line(x, oy, x, oy+cell*plates); const y=oy + i*cell; doc.line(ox, y, ox+cell*plates, y); } doc.setDrawColor(0); doc.setLineWidth(0.2); doc.rect(ox, oy, cell*plates, cell*plates); doc.setFontSize(10); doc.text(`Col ${pc+1}`, ox, oy-2); doc.text(`Ligne ${pr+1}`, ox-8, oy+4); } } doc.save(`plaques_${grid}x${grid}_${rows}x${cols}.pdf`); }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="bg-white p-4 rounded-xl shadow">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">BrickMosaic Pro</h1>
          <div className="text-xs opacity-60">PNG · CSV · PDF</div>
        </div>
        <div className="grid lg:grid-cols-3 gap-4 mt-4">
          <div className="space-y-3">
            <input type="file" accept="image/*" multiple onChange={(e)=>{ const f=e.target.files; if(!f)return; setFiles(Array.from(f)); setCurrentIndex(0); }}/>
            <div>
              <label className="text-sm">Grille {grid}×{grid}</label>
              <input type="range" min={24} max={128} step={1} value={grid} onChange={e=>setGrid(parseInt(e.target.value))} className="w-full"/>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button className={`px-3 py-2 rounded border ${round?'bg-black text-white':''}`} onClick={()=>setRound(true)}>Ronds</button>
              <button className={`px-3 py-2 rounded border ${!round?'bg-black text-white':''}`} onClick={()=>setRound(false)}>Carrés</button>
            </div>
            <div className="flex items-center gap-2"><input type="checkbox" checked={stud} onChange={e=>setStud(e.target.checked)}/><span className="text-sm">Reflet 3D</span></div>
            <div className="flex items-center gap-2"><input type="checkbox" checked={dither} onChange={e=>setDither(e.target.checked)}/><span className="text-sm">Dithering</span></div>
            <div className="flex items-center gap-2"><input type="checkbox" checked={wbalance} onChange={e=>setWbalance(e.target.checked)}/><span className="text-sm">WB</span></div>
            <button className="w-full bg-black text-white rounded py-2" onClick={()=>images[currentIndex] && processOne(images[currentIndex])} disabled={!images.length}>Générer</button>
            <button className="w-full border rounded py-2" onClick={exportPNG} disabled={!images.length}>Exporter PNG</button>
            <button className="w-full border rounded py-2" onClick={exportCSV} disabled={!images.length}>Exporter CSV</button>
            <button className="w-full border rounded py-2" onClick={exportPDF_A3} disabled={!images.length}>PDF A3</button>
            <button className="w-full border rounded py-2" onClick={exportPDF_Plaques} disabled={!images.length}>PDF Plaques</button>
          </div>
          <div className="lg:col-span-2">
            <canvas ref={mosaicRef} className="w-full h-auto border rounded"/>
            <canvas ref={tinyRef} style={{display:'none'}}/>
          </div>
        </div>
      </div>
    </div>
  )
}
