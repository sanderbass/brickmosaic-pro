// src/App.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

/* ========= Constantes et utilitaires ========= */
const GRAM_PER_PART = 0.11; // 1x1 round plate ~0.11 g
const clamp = (v,a,b)=>Math.min(b,Math.max(a,v));
const sqr = (x)=>x*x;
const hexToRgb = (h)=> {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(h||"").trim());
  if (!m) return [200,200,200];
  const v = m[1];
  return [parseInt(v.slice(0,2),16), parseInt(v.slice(2,4),16), parseInt(v.slice(4,6),16)];
};
const luminance = (r,g,b)=>(0.2126*r+0.7152*g+0.0722*b)/255;

async function saveFile(dataOrUrl, filename){
  try{
    const mod = await import("file-saver");
    const saveAs = mod.saveAs || mod.default;
    return saveAs(dataOrUrl, filename);
  }catch{
    const url = typeof dataOrUrl==="string" ? dataOrUrl : URL.createObjectURL(dataOrUrl);
    const a=document.createElement("a"); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove();
    if(typeof dataOrUrl!=="string") setTimeout(()=>URL.revokeObjectURL(url),1200);
  }
}
async function getJsPDF(){
  try{ const m = await import("jspdf"); return m.jsPDF || m.default; }
  catch{ return window.jspdf?.jsPDF || null; }
}

/* ========= Palettes ========= */
// BrickLink (extrait pertinent + trans)
const BL = [
  ["White","#F2F3F2",1,false],["Black","#000000",26,false],
  ["Very Light Gray","#E6E6E6",49,false],["Light Gray","#9BA19D",9,false],
  ["Light Bluish Gray","#A3A2A4",86,false],["Dark Bluish Gray","#6D6E5C",85,false],
  ["Red","#C91A09",5,false],["Dark Red","#720E0F",59,false],
  ["Orange","#F08F1C",4,false],["Medium Orange","#F19F4D",31,false],
  ["Yellow","#F2CD37",3,false],["Bright Light Yellow","#FFF07A",103,false],
  ["Tan","#E4CD9E",2,false],["Dark Tan","#958A73",69,false],
  ["Light Nougat","#F6D7B3",90,false],["Nougat","#CC8E69",18,false],
  ["Medium Nougat","#AE7A59",150,false],["Reddish Brown","#5C1E0F",88,false],
  ["Brown","#6B3F20",8,false],["Fabuland Brown","#C56E2D",160,false],
  ["Pink","#FFB5D1",221,false],["Dark Pink","#DA70D6",47,false],
  ["Blue","#0055BF",7,false],["Dark Blue","#0B3B8F",63,false],
  ["Medium Blue","#6C9BD2",42,false],["Bright Light Blue","#9BC4E2",102,false],
  ["Royal Blue","#2C4DA7",272,false],["Dark Azure","#0072A3",153,false],
  ["Medium Azure","#36A3E1",156,false],["Sand Blue","#6074A1",55,false],
  ["Dark Turquoise","#008A8A",39,false],["Bright Green","#4B9F4A",36,false],
  ["Green","#237841",6,false],["Dark Green","#184632",80,false],
  ["Lime","#A6CA3A",34,false],["Olive Green","#808E42",330,false],
  ["Sand Green","#A3C3A2",48,false],["Yellowish Green","#C9D872",226,false],
  ["Light Aqua","#A7DCD6",152,false],["Coral","#FF6F61",353,false],
  // Transparentes
  ["Trans-Clear","#E6F2F2",12,true],["Trans-Black","#635F52",251,true],
  ["Trans-Red","#DE0000",17,true],["Trans-Orange","#F08F1C",98,true],
  ["Trans-Neon Orange","#FF800D",18,true],["Trans-Yellow","#F5CD2A",19,true],
  ["Trans-Neon Yellow","#E9F72C",121,true],["Trans-Green","#5AC35E",20,true],
  ["Trans-Neon Green","#C0FF00",16,true],["Trans-Blue","#0094FF",43,true],
  ["Trans-Dark Blue","#0B2E6F",14,true],["Trans-Medium Blue","#6EC1E4",74,true],
  ["Trans-Light Blue","#A3D2F2",15,true],["Trans-Purple","#5F2683",51,true],
  ["Trans-Dark Pink","#C94A83",50,true],["Trans-Pink","#DF6695",107,true],
  ["Trans-Brown","#6F4E37",13,true],
];

// Palette fournisseur (#01 → #99)
const SUPPLIER = [
  [1,"White","#F2F3F2",false],[2,"Very Light Gray","#E6E6E6",false],[3,"Light Gray","#9BA19D",false],[4,"Medium Gray","#B7B7B7",false],
  [5,"Dark Gray","#6D6E5C",false],[6,"Black","#000000",false],[7,"Light Bluish Gray","#A3A2A4",false],[8,"Dark Bluish Gray","#6D6E5C",false],
  [9,"Eggshell","#F2E6D6",false],[10,"Eggshell Pink","#F7E1E8",false],[11,"Light Nougat","#F6D7B3",false],[12,"Medium Tan","#CBAE86",false],
  [13,"Nougat","#CC8E69",false],[14,"Medium Nougat","#AE7A59",false],[15,"Flesh","#D78E76",false],[16,"Fabuland Brown","#C56E2D",false],
  [17,"Brown","#6B3F20",false],[18,"Dark Brown","#4C2F27",false],[19,"Tan","#E4CD9E",false],[20,"Dark Tan","#958A73",false],
  [21,"Light Yellow","#FFF07A",false],[22,"Yellow","#F2CD37",false],[23,"Dark Yellow","#D5A021",false],[24,"Medium Orange","#F19F4D",false],
  [25,"Orange","#F08F1C",false],[26,"Light Salmon","#F6D5C9",false],[27,"Pink","#FFB5D1",false],[28,"Dark Pink","#DA70D6",false],
  [29,"Magenta","#A0006D",false],[30,"Red","#C91A09",false],[31,"Dark Red","#720E0F",false],[32,"Sand Red","#A75D5E",false],
  [33,"Lavender","#CDA4DE",false],[34,"Medium Lavender","#A06EBB",false],[35,"Purple","#6A0DAD",false],[36,"Bright Light Blue","#9BC4E2",false],
  [37,"Medium Blue","#6C9BD2",false],[38,"Medium Azure","#36A3E1",false],[39,"Royal Blue","#2C4DA7",false],[40,"Dark Azure","#0072A3",false],
  [41,"Blue","#0055BF",false],[42,"Dark Blue","#0B3B8F",false],[43,"Sand Blue","#6074A1",false],[44,"Yellowish Green","#C9D872",false],
  [45,"Lime","#A6CA3A",false],[46,"Olive Green","#808E42",false],[47,"Sand Green","#A3C3A2",false],[48,"Dark Turquoise","#008A8A",false],
  [49,"Bright Green","#4B9F4A",false],[50,"Green","#237841",false],[51,"Dark Green","#184632",false],[52,"Military Green","#5A6B54",false],
  [53,"Light Aqua","#A7DCD6",false],[54,"Coral","#FF6F61",false],
  // Transparentes fournisseur
  [85,"Trans-Black","#635F52",true],[86,"Trans-Brown","#6F4E37",true],[87,"Trans-Purple","#5F2683",true],[88,"Trans-Dark Pink","#C94A83",true],
  [89,"Trans-Pink","#DF6695",true],[90,"Trans-Neon Orange","#FF800D",true],[91,"Trans-Orange","#F08F1C",true],[92,"Trans-Neon Green","#C0FF00",true],
  [93,"Trans-Green","#5AC35E",true],[94,"Trans-Blue","#0094FF",true],[95,"Trans-Light Blue","#A3D2F2",true],[96,"Trans-Red","#DE0000",true],
  [97,"Trans-Yellow","#F5CD2A",true],[98,"Trans-Clear","#E6F2F2",true],[99,"Trans-Medium Blue","#6EC1E4",true],
];

function correlateSupplierToBL(listSupplier, listBL){
  const bl = listBL.map(([n,hex,code,t])=>[n,hexToRgb(hex),code,t]);
  return listSupplier.map(([supCode,name,hex,isTrans])=>{
    const rgb=hexToRgb(hex);
    let best=0,dist=1e18;
    for(let i=0;i<bl.length;i++){
      const d = sqr(rgb[0]-bl[i][1][0])+sqr(rgb[1]-bl[i][1][1])+sqr(rgb[2]-bl[i][1][2]);
      if(d<dist){dist=d;best=i;}
    }
    const [blName,,blCode,blTrans]=bl[best];
    return [
      `${name} (#${String(supCode).padStart(2,"0")})`,
      rgb,
      blCode,
      isTrans||blTrans,
      { supplierCode:supCode, supplierName:name, blName, blCode }
    ];
  });
}

/* ========= Cadrage simple ========= */
function drawCroppedToRect(img, target, gridW, gridH, zoom, dx, dy){
  const ctx=target.getContext("2d",{willReadFrequently:true});
  target.width=gridW; target.height=gridH;
  const aspect=gridW/gridH, z=Math.max(1,zoom);
  let vw=img.width/z, vh=vw/aspect;
  if(vh>img.height/z){ vh=img.height/z; vw=vh*aspect; }
  const maxX=img.width-vw, maxY=img.height-vh;
  const sx=clamp(img.width/2-vw/2+dx*maxX,0,maxX);
  const sy=clamp(img.height/2-vh/2+dy*maxY,0,maxY);
  ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality="high";
  ctx.clearRect(0,0,gridW,gridH);
  ctx.drawImage(img,sx,sy,vw,vh,0,0,gridW,gridH);
}

/* ========= Worker de quantisation (OKLab + dither FS/Atkinson) ========= */
function makeQuantWorker(){
  const code = `
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  function srgb2lin(c){ c/=255; return c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4); }
  function lin2srgb(c){ const v=c<=0.0031308?12.92*c:1.055*Math.pow(c,1/2.4)-0.055; return Math.round(clamp(v,0,1)*255); }
  function rgb2lab(r,g,b){
    const rl=srgb2lin(r), gl=srgb2lin(g), bl=srgb2lin(b);
    const l=0.4122214708*rl+0.5363325363*gl+0.0514459929*bl;
    const m=0.2119034982*rl+0.6806995451*gl+0.1073969566*bl;
    const s=0.0883024619*rl+0.2817188376*gl+0.6299787005*bl;
    const l_=Math.cbrt(l), m_=Math.cbrt(m), s_=Math.cbrt(s);
    return [
      0.2104542553*l_ + 0.793617785*m_ - 0.0040720468*s_,
      1.9779984951*l_ - 2.428592205*m_ + 0.4505937099*s_,
      0.0259040371*l_ + 0.7827717662*m_ - 0.808675766*s_
    ];
  }
  function gaussBlurSep(w,h,r,g,b){
    const k=[1,4,6,4,1], ksum=16;
    const R=new Float32Array(r), G=new Float32Array(g), B=new Float32Array(b);
    for(let y=0;y<h;y++){ const o=y*w;
      for(let x=0;x<w;x++){ let sr=0,sg=0,sb=0;
        for(let i=-2;i<=2;i++){ const xx=Math.min(w-1,Math.max(0,x+i)); const kv=k[i+2];
          sr+=r[o+xx]*kv; sg+=g[o+xx]*kv; sb+=b[o+xx]*kv; }
        R[o+x]=sr/ksum; G[o+x]=sg/ksum; B[o+x]=sb/ksum;
      }}
    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){ let sr=0,sg=0,sb=0;
        for(let i=-2;i<=2;i++){ const yy=Math.min(h-1,Math.max(0,y+i)); const kv=k[i+2];
          const idx=yy*w+x; sr+=R[idx]*kv; sg+=G[idx]*kv; sb+=B[idx]*kv; }
        r[y*w+x]=sr/ksum; g[y*w+x]=sg/ksum; b[y*w+x]=sb/ksum;
      }}
  }

  onmessage=(e)=>{
    const { img,W,H,opts,pal,stocks } = e.data;
    const N=W*H;
    const palRGB=pal.map(p=>p.rgb);
    const palLAB=palRGB.map(([r,g,b])=>rgb2lab(r,g,b));
    const palLen=palLAB.length;

    const R=new Float32Array(N), G=new Float32Array(N), B=new Float32Array(N);
    for(let i=0,j=0;i<N;i++,j+=4){ R[i]=img[j]; G[i]=img[j+1]; B[i]=img[j+2]; }

    const Badd=clamp(opts.brightness,-100,100)/100*255;
    const C=clamp(opts.contrast,-100,100); const f=(259*(C+255))/(255*(259-C));
    const gamma=clamp(opts.gamma,0.5,2.5);
    const sat=clamp(opts.saturation,-100,100)/100;

    function rgb2hsl(r,g,b){ r/=255; g/=255; b/=255;
      const max=Math.max(r,g,b), min=Math.min(r,g,b); let h,s,l=(max+min)/2;
      if(max===min){h=s=0;}else{ const d=max-min; s=l>0.5? d/(2-max-min): d/(max+min);
        switch(max){case r:h=(g-b)/d + (g<b?6:0);break; case g:h=(b-r)/d+2;break; default:h=(r-g)/d+4;}
        h/=6; } return [h,s,l];
    }
    function hsl2rgb(h,s,l){
      const a=(p,q,t)=>{ if(t<0)t+=1; if(t>1)t-=1; if(t<1/6)return p+(q-p)*6*t; if(t<1/2)return q; if(t<2/3)return p+(q-p)*(2/3-t)*6; return p; };
      let r,g,b;
      if(s===0){ r=g=b=l; }else{ const q=l<0.5?l*(1+s):l+s-l*s; const p=2*l-q;
        r=a(p,q,h+1/3); g=a(p,q,h); b=a(p,q,h-1/3); }
      return [Math.round(r*255),Math.round(g*255),Math.round(b*255)];
    }

    for(let i=0;i<N;i++){
      let r=clamp(f*(R[i]+Badd-128)+128,0,255);
      let g=clamp(f*(G[i]+Badd-128)+128,0,255);
      let b=clamp(f*(B[i]+Badd-128)+128,0,255);
      r=lin2srgb(Math.pow(srgb2lin(r),1/gamma));
      g=lin2srgb(Math.pow(srgb2lin(g),1/gamma));
      b=lin2srgb(Math.pow(srgb2lin(b),1/gamma));
      if(sat!==0){ let [h,S,L]=rgb2hsl(r,g,b); S=clamp(S+sat*(sat>0?(1-S):S),0,1); [r,g,b]=hsl2rgb(h,S,L); }
      R[i]=r; G[i]=g; B[i]=b;
    }

    if(opts.sharpen>0){
      const rB=new Float32Array(R), gB=new Float32Array(G), bB=new Float32Array(B);
      gaussBlurSep(W,H,rB,gB,bB);
      const amt=opts.sharpen/100;
      for(let i=0;i<N;i++){ R[i]=clamp(R[i]+amt*(R[i]-rB[i]),0,255); G[i]=clamp(G[i]+amt*(G[i]-gB[i]),0,255); B[i]=clamp(B[i]+amt*(B[i]-bB[i]),0,255); }
    }

    const cache=new Int16Array(4096); cache.fill(-1);
    function nearestIndexRGB(r,g,b){
      const key=((r>>>4)<<8)|((g>>>4)<<4)|(b>>>4);
      const c=cache[key]; if(c>=0) return c;
      const lab=rgb2lab(r,g,b); let best=-1,bd=1e18;
      for(let i=0;i<palLen;i++){ const L=palLAB[i][0]-lab[0],A=palLAB[i][1]-lab[1],B=palLAB[i][2]-lab[2]; const d=L*L+A*A+B*B;
        if(d<bd){bd=d;best=i;} }
      cache[key]=best; return best;
    }

    const indices=new Uint16Array(N); const counts=new Int32Array(palLen);
    const dType=opts.ditherType, dAmt=clamp(opts.ditherAmt,0,100)/100;

    if(dType==='none' || dAmt===0){
      for(let i=0;i<N;i++){ const j=nearestIndexRGB(R[i]|0,G[i]|0,B[i]|0); indices[i]=j; counts[j]++; }
    }else{
      const r=new Float32Array(R), g=new Float32Array(G), b=new Float32Array(B);
      const push=(x,y,fr,fg,fb,w)=>{ if(x<0||y<0||x>=W||y>=H) return; const k=y*W+x; r[k]+=fr*w*dAmt; g[k]+=fg*w*dAmt; b[k]+=fb*w*dAmt; };
      if(dType==='fs'){
        for(let y=0;y<H;y++) for(let x=0;x<W;x++){
          const k=y*W+x; const rr=clamp(Math.round(r[k]),0,255), gg=clamp(Math.round(g[k]),0,255), bb=clamp(Math.round(b[k]),0,255);
          const j=nearestIndexRGB(rr,gg,bb); indices[k]=j; counts[j]++;
          const pr=palRGB[j][0], pg=palRGB[j][1], pb=palRGB[j][2];
          const er=rr-pr, eg=gg-pg, eb=bb-pb;
          push(x+1,y,er,eg,eb,7/16); push(x-1,y+1,er,eg,eb,3/16); push(x,y+1,er,eg,eb,5/16); push(x+1,y+1,er,eg,eb,1/16);
        }
      }else{ // Atkinson
        for(let y=0;y<H;y++) for(let x=0;x<W;x++){
          const k=y*W+x; const rr=clamp(Math.round(r[k]),0,255), gg=clamp(Math.round(g[k]),0,255), bb=clamp(Math.round(b[k]),0,255);
          const j=nearestIndexRGB(rr,gg,bb); indices[k]=j; counts[j]++;
          const pr=palRGB[j][0], pg=palRGB[j][1], pb=palRGB[j][2];
          const er=(rr-pr)/8, eg=(gg-pg)/8, eb=(bb-pb)/8;
          const p=(xx,yy)=>{ if(xx>=0&&yy>=0&&xx<W&&yy<H){ const kk=yy*W+xx; r[kk]+=er; g[kk]+=eg; b[kk]+=eb; } };
          p(x+1,y); p(x+2,y); p(x-1,y+1); p(x,y+1); p(x+1,y+1); p(x,y+2);
        }
      }
    }

    if(opts.antiSingleton){
      const out=new Uint16Array(indices);
      const idx=(x,y)=>y*W+x;
      for(let y=0;y<H;y++) for(let x=0;x<W;x++){
        const k=idx(x,y), v=indices[k]; let same=0; const nb=[]; const neigh=[[1,0],[-1,0],[0,1],[0,-1]];
        for(const [dx,dy] of neigh){ const xx=x+dx, yy=y+dy; if(xx<0||yy<0||xx>=W||yy>=H) continue; const vv=indices[idx(xx,yy)]; if(vv===v) same++; nb.push(vv); }
        if(same<=1 && nb.length){ const hist=new Map(); let bestv=v,bestc=0; for(const t of nb){ const c=(hist.get(t)||0)+1; hist.set(t,c); if(c>bestc){bestc=c;bestv=t;} } out[k]=bestv; }
      }
      const final=new Uint16Array(out); out.set(final);
      for(let i=0;i<final.length;i++) indices[i]=final[i];
    }

    const finalCounts=new Int32Array(palLen);
    for(let i=0;i<N;i++){ finalCounts[indices[i]]++; }
    postMessage({ indices, counts:finalCounts });
  }`;
  const blob = new Blob([code],{type:"application/javascript"});
  return new Worker(URL.createObjectURL(blob));
}

/* ========= Légende PDF : colonne unique + poids ========= */
function addLegendSingleColumn(doc, countsList, paletteRef){
  // Prépare items (tri par code fournisseur croissant)
  const items = countsList.map(([name,qty])=>{
    const p = paletteRef.find(q=>q[0]===name)||[];
    const rgb = p[1]||[200,200,200];
    const codeBL = p[2] ?? "?";
    const codeSUP = p?.[4]?.supplierCode ?? null;
    return { name, qty, rgb, codeBL, codeSUP };
  }).sort((a,b)=>((a.codeSUP??9999)-(b.codeSUP??9999)) || a.name.localeCompare(b.name));

  const Wp = doc.internal.pageSize.getWidth();
  const Hp = doc.internal.pageSize.getHeight();
  const m = 12, sw = 6, rowH = 7;
  const leftX = m, rectX = leftX, textX = rectX + sw + 3;
  const rightX = Wp - m;
  const usableTop = m + 10;
  const usableBottom = Hp - m;

  const pad2=(n)=>String(n).padStart(2,"0");

  doc.addPage();
  doc.setFontSize(14);
  doc.text("Légende — tri par code fournisseur (#01→#99)", Wp/2, m, {align:"center"});
  doc.setFontSize(10);

  let y = usableTop;
  let totalWeight = 0;

  for(const it of items){
    const grams = it.qty * GRAM_PER_PART;
    totalWeight += grams;

    const leftLabel = `[${it.codeBL}] ${it.name}${it.codeSUP!=null?` (#${pad2(it.codeSUP)})`:""}`;
    const rightLabel = `${it.qty} pcs — ${grams.toFixed(1)} g`;

    const maxLeftWidth = rightX - textX - 40; // place pour la partie droite
    const wrapped = doc.splitTextToSize(leftLabel, maxLeftWidth);
    const neededHeight = rowH * wrapped.length;

    if (y + neededHeight > usableBottom) {
      doc.addPage();
      doc.setFontSize(14);
      doc.text("Légende — suite", Wp/2, m, {align:"center"});
      doc.setFontSize(10);
      y = usableTop;
    }

    // carré couleur
    doc.setFillColor(it.rgb[0], it.rgb[1], it.rgb[2]);
    doc.rect(rectX, y - (rowH-5), sw, sw, "F");
    doc.setDrawColor(0); doc.rect(rectX, y - (rowH-5), sw, sw);

    // libellé à gauche (peut aller sur 2+ lignes)
    for(let i=0;i<wrapped.length;i++){
      doc.text(wrapped[i], textX, y + i*rowH);
    }
    // quantité + poids alignés à droite, sur la première ligne
    doc.text(rightLabel, rightX, y, {align:"right"});

    y += neededHeight;
  }

  // Résumé total
  if (y + rowH*2 > usableBottom) { doc.addPage(); doc.setFontSize(10); y = usableTop; }
  doc.setFontSize(11);
  const totalPieces = items.reduce((s,i)=>s+i.qty,0);
  doc.text(`Total pièces : ${totalPieces} — Poids total estimé : ${totalWeight.toFixed(1)} g`, leftX, y + rowH);
}

/* ========= Composant principal ========= */
export default function App(){
  // images
  const [files,setFiles]=useState([]); const [images,setImages]=useState([]); const [idxImg,setIdxImg]=useState(0);
  // grille
  const [W,setW]=useState(48); const [H,setH]=useState(64);
  // cadrage
  const [zoom,setZoom]=useState(1.15); const [offX,setOffX]=useState(0); const [offY,setOffY]=useState(0);
  // ajustements
  const [bright,setBright]=useState(0); const [contrast,setContrast]=useState(10); const [saturation,setSaturation]=useState(4);
  const [gamma,setGamma]=useState(1.1); const [sharpen,setSharpen]=useState(40);
  // palette & numéros
  const [useSupplier,setUseSupplier]=useState(true); const [inclTrans,setInclTrans]=useState(true); const [codeMode,setCodeMode]=useState("SUP");
  // dithering
  const [ditherType,setDitherType]=useState("fs"); const [ditherAmt,setDitherAmt]=useState(25); const [antiSingleton,setAntiSingleton]=useState(true);
  // sections
  const [secCols,setSecCols]=useState(3); const [secRows,setSecRows]=useState(4); const [showSectionGrid,setShowSectionGrid]=useState(true);
  // résultats
  const mosaicRef=useRef(null); const tinyRef=useRef(null);
  const [counts,setCounts]=useState([]); const [indices,setIndices]=useState(null);

  const totalPieces = W*H;
  const totalWeight = (counts.reduce((s,[,q])=>s+q,0) * GRAM_PER_PART).toFixed(1);

  // loading images
  useEffect(()=>{ if(!files.length){ setImages([]); return;}
    let cancel=false;
    (async()=>{
      const arr=[];
      for(const f of files){
        const url=URL.createObjectURL(f);
        await new Promise(res=>{ const im=new Image(); im.onload=()=>{arr.push(im);res();}; im.src=url; });
      }
      if(!cancel) setImages(arr);
    })();
    return ()=>{cancel=true;};
  },[files]);

  // palettes
  const PAL_SUPPLIER = useMemo(()=>correlateSupplierToBL(SUPPLIER,BL),[]);
  const PAL_BL = useMemo(()=>BL.map(([n,hex,code,t])=>[n,hexToRgb(hex),code,t]),[]);
  const palette = useMemo(()=>{
    const src = useSupplier ? PAL_SUPPLIER : PAL_BL;
    return src.filter(p=>inclTrans?true:!p[3]);
  },[useSupplier,inclTrans,PAL_SUPPLIER,PAL_BL]);

  const paletteUISorted = useMemo(()=>{
    const copy=[...palette];
    copy.sort((a,b)=>((a?.[4]?.supplierCode??9999)-(b?.[4]?.supplierCode??9999)) || (a[2]-b[2]));
    return copy;
  },[palette]);

  const workerRef=useRef(null);
  useEffect(()=>{ workerRef.current=makeQuantWorker(); return ()=>workerRef.current?.terminate(); },[]);

  function renderFromIndices(){
    if(!indices) return;
    const cell=14; const canvas=mosaicRef.current;
    canvas.width=W*cell; canvas.height=H*cell;
    const g=canvas.getContext("2d"); g.clearRect(0,0,canvas.width,canvas.height);
    for(let y=0;y<H;y++) for(let x=0;x<W;x++){
      const j=indices[y*W+x]; const [,rgb]=palette[j]; const cx=x*cell, cy=y*cell;
      const pad=Math.max(1,Math.floor(cell*0.12)), rad=(cell-pad*2)/2;
      g.fillStyle=`rgb(${rgb[0]},${rgb[1]},${rgb[2]})`; g.strokeStyle="#111"; g.lineWidth=Math.max(1,Math.floor(cell*0.06));
      g.beginPath(); g.arc(cx+cell/2, cy+cell/2, rad, 0, Math.PI*2); g.fill(); g.stroke();
    }
    g.strokeStyle="rgba(0,0,0,0.18)"; g.lineWidth=1;
    for(let i=0;i<=W;i++){ g.beginPath(); g.moveTo(i*cell,0); g.lineTo(i*cell,H*cell); g.stroke(); }
    for(let j=0;j<=H;j++){ g.beginPath(); g.moveTo(0,j*cell); g.lineTo(W*cell,j*cell); g.stroke(); }
    if(showSectionGrid && secCols>0 && secRows>0){
      const sW=Math.floor(W/secCols), sH=Math.floor(H/secRows);
      g.strokeStyle="#ddd"; g.lineWidth=4;
      for(let c=1;c<secCols;c++){ const x=c*sW*cell; g.beginPath(); g.moveTo(x,0); g.lineTo(x,H*cell); g.stroke(); }
      for(let r=1;r<secRows;r++){ const y=r*sH*cell; g.beginPath(); g.moveTo(0,y); g.lineTo(W*cell,y); g.stroke(); }
    }
  }

  async function processImage(){
    const img=images[idxImg]; if(!img) return;
    const tiny=tinyRef.current; drawCroppedToRect(img,tiny,W,H,zoom,offX,offY);
    const id=tiny.getContext("2d").getImageData(0,0,W,H);

    const palPack = palette.map(p=>({rgb:p[1], codeBL:p[2], supplierCode:p?.[4]?.supplierCode ?? null}));
    const worker=workerRef.current; if(!worker) return;
    const opts={ brightness:bright, contrast, saturation, gamma, sharpen, ditherType, ditherAmt, antiSingleton };
    const result=await new Promise(res=>{ worker.onmessage=(ev)=>res(ev.data); worker.postMessage({img:id.data,W,H,opts,pal:palPack}); });

    const countsArray=[];
    for(let i=0;i<palette.length;i++){ const qty=result.counts[i]||0; if(qty>0) countsArray.push([palette[i][0],qty]); }
    countsArray.sort((a,b)=>b[1]-a[1]);

    setIndices(result.indices); setCounts(countsArray);
    renderFromIndices();
  }

  useEffect(()=>{ renderFromIndices(); /* eslint-disable-next-line */ },[indices,palette,showSectionGrid,secCols,secRows,W,H]);
  useEffect(()=>{ if(images[idxImg]) processImage(); /* eslint-disable-next-line */ },[images,idxImg,W,H,zoom,offX,offY,useSupplier,inclTrans,bright,contrast,saturation,gamma,sharpen,ditherType,ditherAmt,antiSingleton]);

  /* ========= Exports ========= */
  async function exportPNG(){ if(!indices) await processImage(); const url=mosaicRef.current.toDataURL("image/png"); await saveFile(url,`mosaic_${W}x${H}.png`); }

  async function exportCSV(){
    if(!indices) await processImage();
    const rows=[];
    for(let y=0;y<H;y++){
      const cols=[];
      for(let x=0;x<W;x++){
        const idx=indices[y*W+x]; const entry=palette[idx]; const codeBL=entry[2]; const codeSUP=entry?.[4]?.supplierCode ?? codeBL;
        cols.push(codeMode==="SUP"?codeSUP:codeBL);
      }
      rows.push(cols.join(";"));
    }
    await saveFile(new Blob([rows.join("\n")],{type:"text/csv;charset=utf-8"}),`matrix_${codeMode}_${W}x${H}.csv`);

    const list = counts.map(([name,qty])=>{
      const p=palette.find(q=>q[0]===name)||[]; const codeBL=p[2]??"?"; const codeSUP=p?.[4]?.supplierCode ?? null;
      const grams=(qty*GRAM_PER_PART).toFixed(1);
      return `[${codeBL}] ${name}${codeSUP!=null?` (#${String(codeSUP).padStart(2,"0")})`:""};${qty};${grams} g`;
    });
    await saveFile(new Blob([`Code-Name;Qty;Weight(g)\n`+list.join("\n")],{type:"text/csv;charset=utf-8"}),`parts_${codeMode}_${W}x${H}.csv`);
  }

  async function exportPDF_Sections(){
    if(!indices) await processImage();
    const JsPDF=await getJsPDF(); if(!JsPDF){ alert("jsPDF manquant"); return; }
    const doc=new JsPDF({orientation:"portrait",unit:"mm",format:"a4"});
    const Wp=doc.internal.pageSize.getWidth(), Hp=doc.internal.pageSize.getHeight();
    const m=10, uW=Wp-2*m, uH=Hp-2*m-10;
    const sW=Math.floor(W/secCols)||W, sH=Math.floor(H/secRows)||H;
    const cell=Math.min(uW/sW, uH/sH);

    let n=1, firstPage=true;
    for(let r=0;r<secRows;r++) for(let c=0;c<secCols;c++){
      if(!firstPage) doc.addPage(); firstPage=false;
      doc.setFontSize(16); doc.text(`Section ${n}`, Wp/2, 10, {align:"center"});

      const boardW=sW*cell, boardH=sH*cell;
      const ox=m+(uW-boardW)/2, oy=m+10+(uH-boardH)/2;

      for(let y=0;y<sH;y++) for(let x=0;x<sW;x++){
        const gx=c*sW+x, gy=r*sH+y; if(gx>=W||gy>=H) continue;
        const idp=indices[gy*W+gx]; const entry=palette[idp]; const [,rgb]=entry;
        const codeBL=entry[2]; const codeSUP=entry?.[4]?.supplierCode ?? codeBL; const code=codeMode==="SUP"?codeSUP:codeBL;
        const px=ox+x*cell, py=oy+y*cell, rad=(cell*0.76)/2;
        doc.setFillColor(rgb[0],rgb[1],rgb[2]); doc.setDrawColor(0); doc.circle(px+cell/2,py+cell/2,rad,"FD");
        const lum=luminance(...rgb); doc.setTextColor(lum<0.5?255:0, lum<0.5?255:0, lum<0.5?255:0);
        doc.setFontSize(Math.max(6,cell*0.55)); doc.text(String(code), px+cell/2, py+cell/2, {align:"center", baseline:"middle"});
      }

      doc.setDrawColor(180); doc.setLineWidth(0.1);
      for(let i=0;i<=sW;i++){ const x=ox+i*cell; doc.line(x,oy,x,oy+cell*sH); }
      for(let j=0;j<=sH;j++){ const y=oy+j*cell; doc.line(ox,y,ox+cell*sH,y); }
      doc.setDrawColor(0); doc.setLineWidth(0.2); doc.rect(ox,oy,cell*sW,cell*sH);
      n++;
    }

    // LÉGENDE (page(s) finale(s) uniquement) – une seule colonne + poids
    addLegendSingleColumn(doc, counts, palette);

    doc.save(`sections_${secCols}x${secRows}_${codeMode}_${W}x${H}.pdf`);
  }

  /* ========= UI ========= */
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">BrickMosaic Pro — Légende verticale + poids</h1>

        <div className="grid lg:grid-cols-3 gap-4">
          {/* Panneau gauche */}
          <div className="bg-white rounded-2xl shadow p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">1) Charger photo(s)</label>
              <input type="file" accept="image/*" multiple onChange={(e)=>{ const f=e.target.files; if(!f) return; setFiles(Array.from(f)); setIdxImg(0); }} />
              {images.length>0 && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs">Image :</span>
                  <select className="border rounded px-2 py-1 text-sm" value={idxImg} onChange={(e)=>setIdxImg(parseInt(e.target.value,10))}>
                    {images.map((_,i)=><option key={i} value={i}>{i+1}/{images.length}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium">2) Grille</label>
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-xs">Largeur : {W}</span><input type="range" min={24} max={128} step={1} value={W} onChange={(e)=>setW(parseInt(e.target.value,10))} className="w-full"/></div>
                <div><span className="text-xs">Hauteur : {H}</span><input type="range" min={24} max={128} step={1} value={H} onChange={(e)=>setH(parseInt(e.target.value,10))} className="w-full"/></div>
              </div>
              <div className="text-sm mt-1">
                <strong>Total pièces :</strong> {totalPieces.toLocaleString("fr-FR")}
                {counts.length>0 && <> — <strong>Utilisées :</strong> {counts.reduce((s,[,q])=>s+q,0).toLocaleString("fr-FR")} — <strong>Poids :</strong> {totalWeight} g</>}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <label className="text-sm font-medium">3) Palette & transparents</label>
              <label className="text-sm flex items-center gap-2"><input type="radio" name="src" checked={useSupplier} onChange={()=>setUseSupplier(true)}/>Palette fournisseur (99)</label>
              <label className="text-sm flex items-center gap-2"><input type="radio" name="src" checked={!useSupplier} onChange={()=>setUseSupplier(false)}/>BrickLink 4073 (réf.)</label>
              <div className="ml-6 flex items-center gap-2"><input id="trans" type="checkbox" checked={inclTrans} onChange={(e)=>setInclTrans(e.target.checked)}/><label htmlFor="trans" className="text-sm">Inclure les transparentes</label></div>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <label className="text-sm font-medium">4) Numéros imprimés</label>
              <label className="text-sm flex items-center gap-2"><input type="radio" name="code" checked={codeMode==="BL"} onChange={()=>setCodeMode("BL")}/>Codes BrickLink</label>
              <label className="text-sm flex items-center gap-2"><input type="radio" name="code" checked={codeMode==="SUP"} onChange={()=>setCodeMode("SUP")}/>Codes Fournisseur (#01→#99)</label>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <label className="text-sm font-medium">5) Dithering & anti-bruit</label>
              <div className="grid grid-cols-2 gap-2">
                <select className="border rounded px-2 py-1" value={ditherType} onChange={(e)=>setDitherType(e.target.value)}>
                  <option value="fs">Floyd–Steinberg</option>
                  <option value="atk">Atkinson</option>
                  <option value="none">Aucun</option>
                </select>
                <div><span className="text-xs">Intensité : {ditherAmt}%</span><input type="range" min={0} max={100} step={1} value={ditherAmt} onChange={(e)=>setDitherAmt(parseInt(e.target.value,10))} className="w-full"/></div>
              </div>
              <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={antiSingleton} onChange={(e)=>setAntiSingleton(e.target.checked)}/>Anti-singleton</label>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <label className="text-sm font-medium">6) Ajustements d’image</label>
              <div><span className="text-xs">Lumière : {bright}</span><input type="range" min={-100} max={100} step={1} value={bright} onChange={(e)=>setBright(parseInt(e.target.value,10))} className="w-full"/></div>
              <div><span className="text-xs">Contraste : {contrast}</span><input type="range" min={-100} max={100} step={1} value={contrast} onChange={(e)=>setContrast(parseInt(e.target.value,10))} className="w-full"/></div>
              <div><span className="text-xs">Saturation : {saturation}</span><input type="range" min={-100} max={100} step={1} value={saturation} onChange={(e)=>setSaturation(parseInt(e.target.value,10))} className="w-full"/></div>
              <div><span className="text-xs">Gamma : {gamma.toFixed(2)}</span><input type="range" min={0.5} max={2.5} step={0.05} value={gamma} onChange={(e)=>setGamma(parseFloat(e.target.value))} className="w-full"/></div>
              <div><span className="text-xs">Netteté : {sharpen}%</span><input type="range" min={0} max={100} step={1} value={sharpen} onChange={(e)=>setSharpen(parseInt(e.target.value,10))} className="w-full"/></div>
            </div>

            <div className="pt-2 border-t space-y-2">
              <button className="w-full bg-black text-white rounded-xl py-2" onClick={processImage} disabled={!images.length}>Générer l’aperçu (worker)</button>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={exportPNG} className="px-3 py-2 rounded-xl border" disabled={!images.length}>PNG</button>
                <button onClick={exportCSV} className="px-3 py-2 rounded-xl border" disabled={!images.length}>CSV (avec poids)</button>
                <button onClick={exportPDF_Sections} className="px-3 py-2 rounded-xl border col-span-2" disabled={!images.length}>PDF Sections (légende verticale + poids)</button>
              </div>
            </div>
          </div>

          {/* Aperçu */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow p-4 space-y-4">
            <div className="overflow-auto w-full border rounded-xl">
              <canvas ref={mosaicRef} className="w-full h-auto"/>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Palette (tri par # fournisseur) — {inclTrans?"avec":"sans"} transparentes — Numéros: {codeMode==="SUP"?"Fournisseur":"BrickLink"}</h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
                {paletteUISorted.map(p=>{
                  const label=p[0], rgb=p[1], codeBL=p[2], codeSUP=p?.[4]?.supplierCode ?? null;
                  const qty=(counts.find(([n])=>n===label)||[0,0])[1]; const grams=(qty*GRAM_PER_PART).toFixed(1);
                  return (
                    <div key={`${label}-${codeBL}`} className="flex items-center gap-2 p-2 rounded-xl border">
                      <div className="w-6 h-6 rounded" style={{background:`rgb(${rgb[0]},${rgb[1]},${rgb[2]})`}}/>
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-sm"><span>{label}</span><span className="opacity-70">[{codeBL}] {codeSUP!=null?`#${String(codeSUP).padStart(2,"0")}`:""}</span></div>
                        <div className="text-xs opacity-60">{qty} pcs · {grams} g — rgb({rgb.join(",")})</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <canvas ref={tinyRef} style={{display:"none"}}/>
        <footer className="text-xs text-neutral-500 text-center pt-4">PDF Sections : numéros sur les plots + **légende à la fin**, colonne unique, quantité & poids par couleur (0,11 g/part). Poids total affiché.</footer>
      </div>
    </div>
  );
}
