import React, { useEffect, useMemo, useRef, useState } from "react";

/* =================== utilitaires =================== */
async function saveFile(dataOrUrl, filename) {
  try {
    const mod = await import("file-saver");
    const saveAs = mod.saveAs || mod.default;
    return saveAs(dataOrUrl, filename);
  } catch {
    const url = typeof dataOrUrl === "string" ? dataOrUrl : URL.createObjectURL(dataOrUrl);
    const a = document.createElement("a");
    a.href = url; a.download = filename; document.body.appendChild(a);
    a.click(); a.remove();
    if (typeof dataOrUrl !== "string") setTimeout(() => URL.revokeObjectURL(url), 1200);
  }
}
async function getJsPDF() {
  try { const m = await import("jspdf"); return m.jsPDF || m.default; }
  catch { return window.jspdf?.jsPDF || null; }
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const sqr = (x) => x * x;
const hexToRgb = (h) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(h || "").trim());
  if (!m) return [200, 200, 200];
  const v = m[1];
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
};
const luminance = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

// Poids d’une plate round 1x1
const GRAM_PER_PART = 0.11;

// taille d'une brique en pixels dans le PNG exporte (apercu client)
const PNG_CELL = 24;

// Contrainte physique : les plaques de fond font 16 x 16 tenons.
const PLATE = 16;          // tenons par cote de plaque
const STUD_MM = 8;         // pas d'un tenon, en millimetres
const PLATE_MM = PLATE * STUD_MM;  // 128 mm de cote

/* petit hook de “debounce” pour l’aperçu */
function useDebouncedEffect(fn, deps, delay = 250) {
  const t = useRef(null);
  useEffect(() => {
    clearTimeout(t.current);
    t.current = setTimeout(fn, delay);
    return () => clearTimeout(t.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/* =================== palettes =================== */
// BrickLink (référence)
const BL = [
  ["White", "#F2F3F2", 1, false], ["Black", "#000000", 26, false],
  ["Very Light Gray", "#E6E6E6", 49, false], ["Light Gray", "#9BA19D", 9, false],
  ["Light Bluish Gray", "#A3A2A4", 86, false], ["Dark Bluish Gray", "#6D6E5C", 85, false],
  ["Red", "#C91A09", 5, false], ["Dark Red", "#720E0F", 59, false],
  ["Orange", "#F08F1C", 4, false], ["Medium Orange", "#F19F4D", 31, false],
  ["Yellow", "#F2CD37", 3, false], ["Bright Light Yellow", "#FFF07A", 103, false],
  ["Tan", "#E4CD9E", 2, false], ["Dark Tan", "#958A73", 69, false],
  ["Light Nougat", "#F6D7B3", 90, false], ["Nougat", "#CC8E69", 18, false],
  ["Medium Nougat", "#AE7A59", 150, false], ["Reddish Brown", "#5C1E0F", 88, false],
  ["Brown", "#6B3F20", 8, false], ["Fabuland Brown", "#C56E2D", 160, false],
  ["Pink", "#FFB5D1", 221, false], ["Dark Pink", "#DA70D6", 47, false],
  ["Magenta", "#A0006D", 71, false], ["Blue", "#0055BF", 7, false],
  ["Dark Blue", "#0B3B8F", 63, false], ["Medium Blue", "#6C9BD2", 42, false],
  ["Bright Light Blue", "#9BC4E2", 102, false], ["Royal Blue", "#2C4DA7", 272, false],
  ["Dark Azure", "#0072A3", 153, false], ["Medium Azure", "#36A3E1", 156, false],
  ["Sand Blue", "#6074A1", 55, false], ["Dark Turquoise", "#008A8A", 39, false],
  ["Bright Green", "#4B9F4A", 36, false], ["Green", "#237841", 6, false],
  ["Dark Green", "#184632", 80, false], ["Lime", "#A6CA3A", 34, false],
  ["Olive Green", "#808E42", 330, false], ["Sand Green", "#A3C3A2", 48, false],
  ["Yellowish Green", "#C9D872", 226, false], ["Light Aqua", "#A7DCD6", 152, false],
  ["Coral", "#FF6F61", 353, false], ["Sand Red", "#A75D5E", 58, false],
  // Trans
  ["Trans-Clear", "#E6F2F2", 12, true], ["Trans-Black", "#635F52", 251, true],
  ["Trans-Red", "#DE0000", 17, true], ["Trans-Orange", "#F08F1C", 98, true],
  ["Trans-Neon Orange", "#FF800D", 18, true], ["Trans-Yellow", "#F5CD2A", 19, true],
  ["Trans-Neon Yellow", "#E9F72C", 121, true], ["Trans-Green", "#5AC35E", 20, true],
  ["Trans-Neon Green", "#C0FF00", 16, true], ["Trans-Blue", "#0094FF", 43, true],
  ["Trans-Dark Blue", "#0B2E6F", 14, true], ["Trans-Medium Blue", "#6EC1E4", 74, true],
  ["Trans-Light Blue", "#A3D2F2", 15, true], ["Trans-Purple", "#5F2683", 51, true],
  ["Trans-Dark Pink", "#C94A83", 50, true], ["Trans-Pink", "#DF6695", 107, true],
  ["Trans-Brown", "#6F4E37", 13, true],
];

// Palette fournisseur (codes #01→#99)
const SUPPLIER = [
  [1,"White","#F2F3F2",false],[2,"Very Light Gray","#E6E6E6",false],[3,"Light Gray","#9BA19D",false],[4,"Medium Gray","#B7B7B7",false],
  [5,"Dark Gray","#6D6E5C",false],[6,"Black","#000000",false],[7,"Light Bluish Gray","#AFB5C7",false],[8,"Dark Bluish Gray","#595D60",false],
  [9,"Eggshell","#F5E6C8",false],[10,"Eggshell Pink","#F5DCD6",false],[11,"Light Nougat","#F6D7B3",false],[12,"Medium Tan","#CBAE86",false],
  [13,"Nougat","#CC8E69",false],[14,"Medium Nougat","#AE7A59",false],[15,"Flesh","#E8A090",false],[16,"Fabuland Brown","#C56E2D",false],
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
  // Trans
  [85,"Trans-Black","#635F52",true],[86,"Trans-Brown","#6F4E37",true],[87,"Trans-Purple","#5F2683",true],[88,"Trans-Dark Pink","#C94A83",true],
  [89,"Trans-Pink","#DF6695",true],[90,"Trans-Neon Orange","#FF800D",true],[91,"Trans-Orange","#F5A03C",true],[92,"Trans-Neon Green","#C0FF00",true],
  [93,"Trans-Green","#5AC35E",true],[94,"Trans-Blue","#0094FF",true],[95,"Trans-Light Blue","#A3D2F2",true],[96,"Trans-Red","#DE0000",true],
  [97,"Trans-Yellow","#F5CD2A",true],[98,"Trans-Clear","#E6F2F2",true],[99,"Trans-Medium Blue","#6EC1E4",true],
];

/* ============ audit de contraste de la palette fournisseur ============ */
// Copie locale de la conversion OKLab du worker : celle-ci vit dans un
// template string et n'est pas accessible depuis le module.
function srgb2linLocal(c){ c/=255; return c<=0.04045 ? c/12.92 : Math.pow((c+0.055)/1.055,2.4); }
function rgb2oklab(r,g,b){
  const rl=srgb2linLocal(r), gl=srgb2linLocal(g), bl=srgb2linLocal(b);
  const l = 0.4122214708*rl + 0.5363325363*gl + 0.0514459929*bl;
  const m = 0.2119034982*rl + 0.6806995451*gl + 0.1073969566*bl;
  const s = 0.0883024619*rl + 0.2817188376*gl + 0.6299787005*bl;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  return [
    0.2104542553*l_ + 0.7936177850*m_ - 0.0040720468*s_,
    1.9779984951*l_ - 2.4285922050*m_ + 0.4505937099*s_,
    0.0259040371*l_ + 0.7827717662*m_ - 0.8086757660*s_
  ];
}
// Audit d'atteignabilite. Une couleur n'est perdue que si aucune teinte
// source ne la choisit jamais : la petitesse d'un domaine n'est pas un
// defaut, le noir et le blanc en ont de tres petits.
// On echantillonne le cube RVB tous les 8 niveaux (32768 points) et on
// compte, pour chaque couleur, les points dont elle est la plus proche.
function auditSupplierPalette(list) {
  const echantillons = [];
  for (let r = 0; r < 256; r += 8)
    for (let g = 0; g < 256; g += 8)
      for (let b = 0; b < 256; b += 8) echantillons.push(rgb2oklab(r, g, b));

  // opaques et transparentes traitees separement : une couleur ne concurrence
  // que celles de sa propre famille
  const perdues = [];
  for (const groupe of [list.filter((e) => !e[3]), list.filter((e) => e[3])]) {
    if (groupe.length < 2) continue;
    const labs = groupe.map((e) => rgb2oklab(...hexToRgb(e[2])));
    const gagnes = new Int32Array(groupe.length);
    for (let s = 0; s < echantillons.length; s++) {
      const L = echantillons[s];
      let best = 0, bd = Infinity;
      for (let i = 0; i < labs.length; i++) {
        // meme ponderation que le quantificateur, sans la penalite sur les sombres
        const dL = L[0] - labs[i][0], dA = L[1] - labs[i][1], dB = L[2] - labs[i][2];
        const d = 1.15 * dL * dL + 0.95 * (dA * dA + dB * dB);
        if (d < bd) { bd = d; best = i; }
      }
      gagnes[best]++;
    }
    for (let i = 0; i < groupe.length; i++) if (gagnes[i] === 0) perdues.push(groupe[i]);
  }

  if (perdues.length) {
    const pad2 = (n) => String(n).padStart(2, "0");
    console.warn("Palette : couleur inatteignable, elle ne sera jamais choisie\n" +
      perdues.map((e) => `#${pad2(e[0])} ${e[1]}`).join("\n"));
  }
}
// Une seule execution au chargement du module. Le garde sur import.meta.hot
// evite de relancer le calcul a chaque rechargement a chaud de Vite.
if (!import.meta.hot || !import.meta.hot.data.paletteAuditee) {
  auditSupplierPalette(SUPPLIER);
  if (import.meta.hot) import.meta.hot.data.paletteAuditee = true;
}

// corrélation fournisseur → BL
function correlateSupplierToBL(listSupplier, listBL) {
  const bl = listBL.map(([n, hex, code, t]) => [n, hexToRgb(hex), code, t]);
  return listSupplier.map(([supCode, name, hex, isTrans]) => {
    const rgb = hexToRgb(hex);
    let best = 0, dist = 1e18;
    for (let i = 0; i < bl.length; i++) {
      const d = sqr(rgb[0] - bl[i][1][0]) + sqr(rgb[1] - bl[i][1][1]) + sqr(rgb[2] - bl[i][1][2]);
      if (d < dist) { dist = d; best = i; }
    }
    const [blName, , blCode, blTrans] = bl[best];
    return [
      `${name} (#${String(supCode).padStart(2, "0")})`,
      rgb,
      blCode,
      isTrans || blTrans,
      { supplierCode: supCode, supplierName: name, blName, blCode }
    ];
  });
}

/* =================== cadrage =================== */
function drawCroppedToRect(img, target, gridW, gridH, zoom, dx, dy, maxS, bgColor, mode) {
  const ctx = target.getContext("2d", { willReadFrequently: true });
  const bg = bgColor || "#FFFFFF";
  const cap = (maxS === undefined || maxS === null) ? 4 : maxS;

  if (mode === "contenir") {
    // pas de bridage a 1 : le curseur peut dezoomer
    const z = Math.max(0.01, zoom);
    // S borne par la resolution reellement dispo, comme en mode remplir,
    // mais sur les dimensions de l'image entiere puisqu'on ne rogne pas
    const S = Math.max(1, Math.min(cap,
                Math.floor(Math.min(img.width / gridW, img.height / gridH))));
    target.width = gridW * S; target.height = gridH * S;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, target.width, target.height);
    const k = Math.min((gridW*S) / img.width, (gridH*S) / img.height) / z;
    const dw = Math.round(img.width * k), dh = Math.round(img.height * k);
    const px = Math.round((gridW*S - dw)/2 + dx * (gridW*S - dw)/2);
    const py = Math.round((gridH*S - dh)/2 + dy * (gridH*S - dh)/2);
    ctx.drawImage(img, 0, 0, img.width, img.height, px, py, dw, dh);
    return S;
  }

  const aspect = gridW / gridH, z = Math.max(1, zoom);
  let vw = img.width / z, vh = vw / aspect;
  if (vh > img.height / z) { vh = img.height / z; vw = vh * aspect; }
  const maxX = img.width - vw, maxY = img.height - vh;
  const sx = clamp(img.width / 2 - vw / 2 + dx * maxX, 0, maxX);
  const sy = clamp(img.height / 2 - vh / 2 + dy * maxY, 0, maxY);
  // facteur de surechantillonnage, borne par la resolution reellement dispo
  const S = Math.max(1, Math.min(cap,
              Math.floor(Math.min(vw / gridW, vh / gridH))));
  target.width = gridW * S; target.height = gridH * S;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, target.width, target.height);
  ctx.drawImage(img, sx, sy, vw, vh, 0, 0, gridW * S, gridH * S);
  return S;
}

/* =================== Worker OKLab + dithering =================== */
function makeQuantWorker() {
  const code = `
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  function srgb2lin(c){ c/=255; return c<=0.04045 ? c/12.92 : Math.pow((c+0.055)/1.055,2.4); }
  function lin2srgb(c){ const v = c<=0.0031308 ? 12.92*c : 1.055*Math.pow(c,1/2.4)-0.055; return Math.round(clamp(v,0,1)*255); }
  function rgb2lab(r,g,b){
    const rl=srgb2lin(r), gl=srgb2lin(g), bl=srgb2lin(b);
    const l = 0.4122214708*rl + 0.5363325363*gl + 0.0514459929*bl;
    const m = 0.2119034982*rl + 0.6806995451*gl + 0.1073969566*bl;
    const s = 0.0883024619*rl + 0.2817188376*gl + 0.6299787005*bl;
    const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
    return [
      0.2104542553*l_ + 0.7936177850*m_ - 0.0040720468*s_,
      1.9779984951*l_ - 2.4285922050*m_ + 0.4505937099*s_,
      0.0259040371*l_ + 0.7827717662*m_ - 0.8086757660*s_
    ];
  }
  function gaussBlurSep(w,h, r,g,b){
    const k = [1,4,6,4,1]; const ksum=16;
    const R=new Float32Array(r), G=new Float32Array(g), B=new Float32Array(b);
    for(let y=0;y<h;y++){
      const o=y*w;
      for(let x=0;x<w;x++){
        let sr=0,sg=0,sb=0;
        for(let i=-2;i<=2;i++){
          const xx=Math.min(w-1, Math.max(0,x+i));
          const kv=k[i+2];
          sr += r[o+xx]*kv; sg += g[o+xx]*kv; sb += b[o+xx]*kv;
        }
        R[o+x]=sr/ksum; G[o+x]=sg/ksum; B[o+x]=sb/ksum;
      }
    }
    for(let y=0;y<h;y++){
      const o=y*w;
      for(let x=0;x<w;x++){
        let sr=0,sg=0,sb=0;
        for(let i=-2;i<=2;i++){
          const yy=Math.min(h-1, Math.max(0,y+i));
          const kv=k[i+2];
          const idx=yy*w+x;
          sr += R[idx]*kv; sg += G[idx]*kv; sb += B[idx]*kv;
        }
        r[o+x]=sr/ksum; g[o+x]=sg/ksum; b[o+x]=sb/ksum;
      }
    }
  }
  // Matrice de Bayer 8×8 (centrée)
  const BAYER8 = [
    [0,48,12,60,3,51,15,63],[32,16,44,28,35,19,47,31],
    [8,56,4,52,11,59,7,55],[40,24,36,20,43,27,39,23],
    [2,50,14,62,1,49,13,61],[34,18,46,30,33,17,45,29],
    [10,58,6,54,9,57,5,53],[42,26,38,22,41,25,37,21]
  ].map(r=>r.map(v=>v/64-0.5));

  onmessage = (e)=>{
    const { img, W, H, S, opts, pal, stocks } = e.data;
    const N=W*H;
    const SS = (S && S >= 1) ? S : 1;
    const sw = W * SS, sh = H * SS, SN = sw * sh;

    const palRGB = pal.map(p=>p.rgb);
    const palLAB = palRGB.map(([r,g,b])=>rgb2lab(r,g,b));
    const palLen = palLAB.length;

    // pénalité pour couleurs très sombres (moins de "noir")
    // facteur configurable via opts.darkPenalty (0..100), defaut 30
    const darkPenaltyPct = (opts.darkPenalty === undefined || opts.darkPenalty === null) ? 30 : opts.darkPenalty;
    const darkPenaltyF = clamp(darkPenaltyPct, 0, 100) / 100;
    const penalty = new Float32Array(palLen);
    for (let i=0;i<palLen;i++){
      const L = palLAB[i][0];
      penalty[i] = (L < 0.35) ? (darkPenaltyF * (0.35 - L) / 0.35) : 0;
    }

    // Lecture a la resolution surechantillonnee (valeurs sRGB 0..255)
    const SR=new Float32Array(SN), SG=new Float32Array(SN), SB=new Float32Array(SN);
    for(let i=0,j=0;i<SN;i++,j+=4){ SR[i]=img[j]; SG[i]=img[j+1]; SB[i]=img[j+2]; }

    // Accentuation AVANT reduction, a resolution surechantillonnee
    if (opts.sharpen > 0){
      const bR=new Float32Array(SR), bG=new Float32Array(SG), bB=new Float32Array(SB);
      gaussBlurSep(sw, sh, bR, bG, bB);
      const amt = opts.sharpen/100;
      for(let i=0;i<SN;i++){
        SR[i]=clamp(SR[i] + amt*(SR[i]-bR[i]), 0,255);
        SG[i]=clamp(SG[i] + amt*(SG[i]-bG[i]), 0,255);
        SB[i]=clamp(SB[i] + amt*(SB[i]-bB[i]), 0,255);
      }
    }

    // Reduction par moyenne de blocs SS x SS, calculee en lumiere lineaire
    const R=new Float32Array(N), G=new Float32Array(N), B=new Float32Array(N);
    const inv = 1/(SS*SS);
    for(let y=0;y<H;y++){
      for(let x=0;x<W;x++){
        let ar=0, ag=0, ab=0;
        for(let by=0;by<SS;by++){
          const row=(y*SS+by)*sw + x*SS;
          for(let bx=0;bx<SS;bx++){
            const k=row+bx;
            ar += srgb2lin(SR[k]); ag += srgb2lin(SG[k]); ab += srgb2lin(SB[k]);
          }
        }
        const i=y*W+x;
        R[i]=lin2srgb(ar*inv); G[i]=lin2srgb(ag*inv); B[i]=lin2srgb(ab*inv);
      }
    }

    const Badd = clamp(opts.brightness,-100,100)/100*255;
    const C = clamp(opts.contrast,-100,100);
    const f = (259*(C+255))/(255*(259-C));
    const gamma = clamp(opts.gamma, 0.5, 2.5);
    const sat = clamp(opts.saturation,-100,100)/100;

    function rgb2hsl(r,g,b){
      r/=255; g/=255; b/=255;
      const max=Math.max(r,g,b), min=Math.min(r,g,b);
      let h,s,l=(max+min)/2;
      if(max===min){h=s=0;}
      else{
        const d=max-min;
        s = l>0.5? d/(2-max-min): d/(max+min);
        switch(max){case r:h=(g-b)/d + (g<b?6:0); break;
          case g:h=(b-r)/d + 2; break;
          case b:h=(r-g)/d + 4; break;}
        h/=6;
      }
      return [h,s,l];
    }
    function hsl2rgb(h,s,l){
      const a=(p,q,t)=>{ if(t<0)t+=1; if(t>1)t-=1;
        if(t<1/6)return p+(q-p)*6*t; if(t<1/2)return q; if(t<2/3)return p+(q-p)*(2/3-t)*6; return p; };
      let r,g,b;
      if(s===0){r=g=b=l;}
      else{
        const q = l<0.5 ? l*(1+s) : l+s-l*s;
        const p = 2*l-q;
        r=a(p,q,h+1/3); g=a(p,q,h); b=a(p,q,h-1/3);
      }
      return [Math.round(r*255),Math.round(g*255),Math.round(b*255)];
    }

    for(let i=0;i<N;i++){
      let r = clamp(f*(R[i]+Badd-128)+128,0,255);
      let g = clamp(f*(G[i]+Badd-128)+128,0,255);
      let b = clamp(f*(B[i]+Badd-128)+128,0,255);
      r = lin2srgb(Math.pow(srgb2lin(r), 1/gamma));
      g = lin2srgb(Math.pow(srgb2lin(g), 1/gamma));
      b = lin2srgb(Math.pow(srgb2lin(b), 1/gamma));
      if (sat !== 0) {
        let [h, Sat, L] = rgb2hsl(r,g,b);
        Sat = clamp(Sat + sat*(sat>0 ? (1-Sat) : Sat), 0, 1);
        const rr = hsl2rgb(h,Sat,L); r=rr[0]; g=rr[1]; b=rr[2];
      }
      R[i]=r; G[i]=g; B[i]=b;
    }

    // Part de pastilles orphelines : aucune voisine perceptivement proche.
    // Mesure le mouchetage, c'est-a-dire l'illisibilite de la mosaique.
    const ORPHAN_SEUIL = 84;   // somme |dR|+|dG|+|dB| en deca de laquelle
                               // deux pastilles sont jugees proches
    let orphans = 0;
    for(let y=0;y<H;y++){
      for(let x=0;x<W;x++){
        const k=y*W+x;
        let mini = 1e9;
        const vois = [[1,0],[-1,0],[0,1],[0,-1]];
        for(let v=0;v<4;v++){
          const xx=x+vois[v][0], yy=y+vois[v][1];
          if (xx<0||yy<0||xx>=W||yy>=H) continue;
          const kk=yy*W+xx;
          const d = Math.abs(R[k]-R[kk]) + Math.abs(G[k]-G[kk]) + Math.abs(B[k]-B[kk]);
          if (d < mini) mini = d;
        }
        if (mini > ORPHAN_SEUIL) orphans++;
      }
    }
    const orphanPct = 100 * orphans / N;

    let AR=R, AG=G, AB=B;

    function nearestIndexRGB_w(r,g,b){
      const lab = rgb2lab(r,g,b);
      const wL = 1.15, wC = 0.95;
      let best=-1, bd=1e18;
      for(let i=0;i<palLen;i++){
        const dL = lab[0]-palLAB[i][0], dA = lab[1]-palLAB[i][1], dB = lab[2]-palLAB[i][2];
        const d = wL*dL*dL + wC*(dA*dA + dB*dB);
        const adj = d * (1 + penalty[i]);
        if (adj<bd){bd=adj; best=i;}
      }
      return best;
    }

    const indices = new Uint16Array(N);
    const counts = new Int32Array(palLen);

    const dType = opts.ditherType;
    const dAmt  = clamp(opts.ditherAmt,0,100)/100;

    if (dType==='none' || dAmt===0){
      for(let i=0;i<N;i++){
        const j = nearestIndexRGB_w(AR[i]|0, AG[i]|0, AB[i]|0);
        indices[i]=j; counts[j]++;
      }
    } else if (dType==='bayer') {
      for(let y=0;y<H;y++){
        for(let x=0;x<W;x++){
          const k=y*W+x;
          const bias = BAYER8[y&7][x&7] * 0.08 * dAmt;
          const rr = clamp(Math.round(AR[k] + bias*255),0,255);
          const gg = clamp(Math.round(AG[k] + bias*255),0,255);
          const bb = clamp(Math.round(AB[k] + bias*255),0,255);
          const j = nearestIndexRGB_w(rr,gg,bb);
          indices[k]=j; counts[j]++;
        }
      }
    } else {
      // FS / Atkinson (comme avant)
      const r = new Float32Array(R), g = new Float32Array(G), b = new Float32Array(B);
      AR=r; AG=g; AB=b;
      const push = (x,y, fr,fg,fb, w)=>{
        if (x<0||y<0||x>=W||y>=H) return;
        const k=(y*W+x);
        r[k]+=fr*w*dAmt; g[k]+=fg*w*dAmt; b[k]+=fb*w*dAmt;
      };
      if (dType==='fs'){
        for(let y=0;y<H;y++){
          // balayage serpentin : gauche->droite sur lignes paires, droite->gauche sur lignes impaires
          const dir = (y%2===1) ? -1 : 1;
          const xStart = (dir===1) ? 0 : W-1;
          for(let n=0;n<W;n++){
            const x = xStart + n*dir;
            const k=y*W+x;
            const rr=clamp(Math.round(r[k]),0,255), gg=clamp(Math.round(g[k]),0,255), bb=clamp(Math.round(b[k]),0,255);
            const j = nearestIndexRGB_w(rr,gg,bb);
            indices[k]=j; counts[j]++;
            const pr=palRGB[j][0], pg=palRGB[j][1], pb=palRGB[j][2];
            const er=rr-pr, eg=gg-pg, eb=bb-pb;
            push(x+dir,y  , er,eg,eb, 7/16);
            push(x-dir,y+1, er,eg,eb, 3/16);
            push(x    ,y+1, er,eg,eb, 5/16);
            push(x+dir,y+1, er,eg,eb, 1/16);
          }
        }
      } else {
        for(let y=0;y<H;y++){
          // balayage serpentin : gauche->droite sur lignes paires, droite->gauche sur lignes impaires
          const dir = (y%2===1) ? -1 : 1;
          const xStart = (dir===1) ? 0 : W-1;
          for(let n=0;n<W;n++){
            const x = xStart + n*dir;
            const k=y*W+x;
            const rr=clamp(Math.round(r[k]),0,255), gg=clamp(Math.round(g[k]),0,255), bb=clamp(Math.round(b[k]),0,255);
            const j = nearestIndexRGB_w(rr,gg,bb);
            indices[k]=j; counts[j]++;
            const pr=palRGB[j][0], pg=palRGB[j][1], pb=palRGB[j][2];
            const er=(rr-pr)/8*dAmt, eg=(gg-pg)/8*dAmt, eb=(bb-pb)/8*dAmt;
            const push2=(xx,yy)=>{ if(xx>=0&&yy>=0&&xx<W&&yy<H){ const kk=yy*W+xx; r[kk]+=er; g[kk]+=eg; b[kk]+=eb; } };
            push2(x+dir,y); push2(x+2*dir,y); push2(x-dir,y+1); push2(x,y+1); push2(x+dir,y+1); push2(x,y+2);
          }
        }
      }
    }

    // Anti-singleton
    if (opts.antiSingleton){
      const out = new Uint16Array(indices);
      const idx = (x,y)=> y*W+x;
      for(let y=0;y<H;y++){
        for(let x=0;x<W;x++){
          const k=idx(x,y), v=indices[k];
          let same=0, nb=[];
          const neigh=[[1,0],[-1,0],[0,1],[0,-1]];
          for(const [dx,dy] of neigh){
            const xx=x+dx, yy=y+dy;
            if (xx<0||yy<0||xx>=W||yy>=H) continue;
            const vv=indices[idx(xx,yy)]; if (vv===v) same++; nb.push(vv);
          }
          if (same===0 && nb.length){
            const hist=new Map(); let bestv=v, bestc=0;
            for(const t of nb){ const c=(hist.get(t)||0)+1; hist.set(t,c); if(c>bestc){bestc=c;bestv=t;} }
            if (bestc < 2) continue;
            out[k]=bestv;
          }
        }
      }
      counts.fill(0); for(let i=0;i<N;i++){ counts[out[i]]++; }
      indices.set(out);
    }

    // Filtre de quantite minimale : les references anecdotiques sont
    // reaffectees a la couleur conservee la plus proche en OKLab.
    // Place APRES l'anti-singleton (qui pourrait recreer des isolats) et
    // AVANT les contraintes de stock (qui statuent sur le resultat final).
    let fusions = null;
    const qtyMin = (opts.qtyMin|0);
    if (qtyMin > 1){
      const cnt = new Int32Array(palLen);
      for(let i=0;i<N;i++){ cnt[indices[i]]++; }
      const keep = [];
      for(let i=0;i<palLen;i++){ if (cnt[i] >= qtyMin) keep.push(i); }
      if (keep.length > 0){
        const wL = 1.15, wC = 0.95;
        const remap = new Int32Array(palLen);
        for(let i=0;i<palLen;i++) remap[i] = i;
        let removed = 0, moved = 0;
        for(let i=0;i<palLen;i++){
          if (cnt[i] === 0 || cnt[i] >= qtyMin) continue;
          let best = keep[0], bd = 1e18;
          for(let q=0;q<keep.length;q++){
            const j = keep[q];
            const dL = palLAB[i][0]-palLAB[j][0];
            const dA = palLAB[i][1]-palLAB[j][1];
            const dB = palLAB[i][2]-palLAB[j][2];
            const d = wL*dL*dL + wC*(dA*dA + dB*dB);
            if (d < bd){ bd = d; best = j; }
          }
          remap[i] = best;
          removed++; moved += cnt[i];
        }
        if (removed > 0){
          for(let i=0;i<N;i++){ indices[i] = remap[indices[i]]; }
          counts.fill(0); for(let i=0;i<N;i++){ counts[indices[i]]++; }
        }
        fusions = { removed, moved };
      }
    }

    // Contraintes stock (identique à avant)
    let stockNote=null;
    if (Array.isArray(stocks)){
      const cap = new Int32Array(palLen);
      for(let i=0;i<palLen;i++){ cap[i] = (stocks[i]==null || stocks[i]<0) ? 2147483647 : stocks[i]|0; }
      const byColor = Array.from({length: palLen}, ()=>[]);
      for(let k=0;k<N;k++){ byColor[indices[k]].push(k); }

      let unmet=0;
      const deficit = new Int32Array(palLen);
      for(let i=0;i<palLen;i++){
        const d = counts[i]-cap[i];
        deficit[i] = d>0 ? d : 0;
        if (deficit[i]>0) unmet += deficit[i];
      }
      if (unmet>0){
        function nearestAvail(r,g,b, forbid){
          const lab = rgb2lab(r,g,b);
          let best=-1, bd=1e18;
          for(let j=0;j<palLen;j++){
            if (j===forbid) continue;
            if (cap[j]-counts[j] <= 0) continue;
            const L=palLAB[j][0]-lab[0], A=palLAB[j][1]-lab[1], Bv=palLAB[j][2]-lab[2];
            const d=L*L+A*A+Bv*Bv;
            if (d<bd){bd=d; best=j;}
          }
          return best;
        }
        for(let i=0;i<palLen;i++){
          let need = deficit[i];
          if (need<=0) continue;
          const list = byColor[i];
          let ptr=0;
          while(need>0 && ptr<list.length){
            const k = list[ptr++];
            const rr=AR[k], gg=AG[k], bb=AB[k];
            const j = nearestAvail(rr,gg,bb, i);
            if (j>=0 && (cap[j]-counts[j])>0){
              counts[i]--; counts[j]++;
              indices[k]=j;
              need--;
            }
          }
          if (need>0){ unmet += need; }
        }
        stockNote = unmet>0 ? "Certaines couleurs dépassent le stock disponible (contraintes partiellement satisfaites)." : "Contraintes de stock satisfaites.";
      } else {
        stockNote = "Contraintes de stock satisfaites.";
      }
    }

    const finalCounts = new Int32Array(palLen);
    for(let i=0;i<N;i++){ finalCounts[indices[i]]++; }

    postMessage({ indices, counts: finalCounts, stockNote, orphanPct, fusions });
  };`;
  const blob = new Blob([code], { type: "application/javascript" });
  return new Worker(URL.createObjectURL(blob));
}

/* =================== Légende PDF (tri par #, une ligne, poids) =================== */
function addLegendPagesSortedBySupplier(doc, countsList, paletteRef, plateCount) {
  const pad2 = (n) => String(n).padStart(2, "0");

  const items = countsList.map(([name, qty]) => {
    const p = paletteRef.find((q) => q[0] === name) || [];
    const rgb = p[1] || [200, 200, 200];
    const codeBL = p[2] ?? "?";
    const codeSUP = p?.[4]?.supplierCode ?? null;
    const grams = qty * GRAM_PER_PART;
    return { name, qty, grams, rgb, codeBL, codeSUP };
  }).sort((a, b) => ((a.codeSUP ?? 9999) - (b.codeSUP ?? 9999)) || a.name.localeCompare(b.name));

  const Wp = doc.internal.pageSize.getWidth();
  const Hp = doc.internal.pageSize.getHeight();
  const m = 12, box = 6, lineGap = 3, wrapW = Wp - 2*m - (box + 4);

  let y = m + 10, piecesTotal = 0, gramsTotal = 0;

  doc.addPage();
  doc.setTextColor(0,0,0);
  doc.setFontSize(14);
  doc.text("Légende — tri par code fournisseur (#01 a #99)", Wp/2, m, {align:"center"});
  doc.setFontSize(10);

  for (const it of items) {
    const tag = it.codeSUP != null ? `(#${pad2(it.codeSUP)})` : "";
    const suf = (tag && it.name.indexOf(tag) === -1) ? ` ${tag}` : "";
    const label = `[${it.codeBL}] ${it.name}${suf}: ${it.qty} pcs — ${it.grams.toFixed(1)} g`;

    const blockH = Math.max(box, doc.splitTextToSize(label, wrapW).length * 5);
    if (y + blockH + lineGap > Hp - m) { doc.addPage(); y = m + 2; doc.setFontSize(10); }

    doc.setFillColor(it.rgb[0], it.rgb[1], it.rgb[2]);
    doc.setDrawColor(0); doc.rect(m, y - box + 4, box, box, "F"); doc.rect(m, y - box + 4, box, box);

    const lines = doc.splitTextToSize(label, wrapW);
    doc.text(lines, m + box + 4, y + 1);

    y += blockH + lineGap;
    piecesTotal += it.qty; gramsTotal += it.grams;
  }

  if (y + 16 > Hp - m) { doc.addPage(); y = m + 2; }
  doc.setFontSize(11);
  doc.text(`Total : ${piecesTotal} pièces — ${gramsTotal.toFixed(1)} g`, m, y + 6);
  doc.text(`Plaques de fond 16x16 necessaires : ${plateCount}`, m, y + 12);
}

/* =================== composant principal =================== */
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
  // fond applique aux zones transparentes des images detourees
  const [bgColor, setBgColor] = useState("#FFFFFF");
  // "remplir" (rogne les bords) ou "contenir" (image entiere + fond)
  const [cadrage, setCadrage] = useState("remplir");

  // Ajustements
  const [bright, setBright] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [gamma, setGamma] = useState(1.0);
  const [sharpen, setSharpen] = useState(40);
  // penalite appliquee aux couleurs sombres (0..100)
  const [darkPenalty, setDarkPenalty] = useState(30);

  // Palette & numérotation
  const [useSupplier, setUseSupplier] = useState(true);
  const [inclTrans, setInclTrans] = useState(false);
  const [codeMode, setCodeMode] = useState("SUP"); // "BL" | "SUP"

  // Dithering & post-traitement
  const [ditherType, setDitherType] = useState("bayer"); // 'none' | 'fs' | 'atk' | 'bayer'
  const [ditherAmt, setDitherAmt] = useState(40);        // %
  const [antiSingleton, setAntiSingleton] = useState(true);
  // quantite minimale par couleur : 0 desactive le filtre
  const [qtyMin, setQtyMin] = useState(0);
  const [fusions, setFusions] = useState(null);
  // "plat" (lecture des couleurs) ou "realiste" (rendu monte)
  const [rendu, setRendu] = useState("plat");

  // Sections
  const [showSectionGrid, setShowSectionGrid] = useState(true);

  // Stocks
  const [stockEnabled, setStockEnabled] = useState(false);
  const [stockMap, setStockMap] = useState({});
  const [stockNote, setStockNote] = useState(null);

  // Résultats
  const mosaicRef = useRef(null);
  const tinyRef = useRef(null);
  const [counts, setCounts] = useState([]);
  const [indices, setIndices] = useState(null);
  // dimensions de grille ayant reellement produit "indices"
  const [gridDims, setGridDims] = useState(null);
  const [lastMs, setLastMs] = useState(null);
  // part de pastilles orphelines : conseil sur l'adequation image / grille
  const [orphanPct, setOrphanPct] = useState(null);

  // Grille suggeree : multiples de 16 dont le rapport colle au format de
  // l'image, a nombre de tenons voisin de la grille courante.
  const gridSuggestion = useMemo(() => {
    const im = images[idxImg];
    if (!im || !im.width || !im.height) return null;
    const ratio = im.width / im.height;
    const target = W * H;
    const all = [];
    for (let a = PLATE; a <= 128; a += PLATE) {
      for (let b = PLATE; b <= 128; b += PLATE) {
        all.push({ a, b, err: Math.abs(Math.log((a / b) / ratio)) });
      }
    }
    // Un ecart de rapport de 10 % est invisible sur une mosaique, un facteur
    // trois sur le nombre de plaques ne l'est pas : on tolere puis on choisit
    // la grille la plus proche de la courante en nombre de tenons.
    const errMin = Math.min(...all.map((c) => c.err));
    const seuil = Math.max(errMin + 0.02, 0.10);
    let best = null;
    for (const c of all) {
      if (c.err > seuil) continue;
      const ds = Math.abs(c.a * c.b - target);
      if (!best || ds < best.ds || (ds === best.ds && c.err < best.err)) best = { ...c, ds };
    }
    return {
      w: im.width, h: im.height, a: best.a, b: best.b,
      plaques: (best.a / PLATE) * (best.b / PLATE),
      cmW: best.a * STUD_MM / 10, cmH: best.b * STUD_MM / 10,
    };
  }, [images, idxImg, W, H]);

  // decoupe en plaques 16 x 16, derivee des dimensions
  const plateCols = Math.max(1, Math.round(W / PLATE));
  const plateRows = Math.max(1, Math.round(H / PLATE));

  const totalPieces = W * H;
  const usedPieces = counts.reduce((s,[,q])=>s+q,0);
  const totalWeight = (usedPieces * GRAM_PER_PART).toFixed(1);

  // Charge images
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

  // Palettes
  const PAL_SUPPLIER = useMemo(() => correlateSupplierToBL(SUPPLIER, BL), []);
  const PAL_BL = useMemo(() => BL.map(([n, hex, code, t]) => [n, hexToRgb(hex), code, t]), []);
  const palette = useMemo(() => {
    const src = useSupplier ? PAL_SUPPLIER : PAL_BL;
    return src.filter((p) => (inclTrans ? true : !p[3]));
  }, [useSupplier, inclTrans, PAL_SUPPLIER, PAL_BL]);

  // Palette triée UI (# fournisseur)
  const paletteUISorted = useMemo(() => {
    const copy = [...palette];
    copy.sort((a, b) => {
      const aa = a?.[4]?.supplierCode ?? 9999;
      const bb = b?.[4]?.supplierCode ?? 9999;
      return aa - bb || (a[2] - b[2]);
    });
    return copy;
  }, [palette]);

  // Worker
  const workerRef = useRef(null);
  useEffect(() => {
    workerRef.current = makeQuantWorker();
    return () => { workerRef.current && workerRef.current.terminate(); };
  }, []);

  // Dessine la mosaique sur un canvas quelconque.
  // canvas   : element canvas cible (redimensionne par la fonction)
  // idxArray : tableau d'indices de palette
  // gw, gh   : dimensions de la grille
  // cell     : taille d'une brique en pixels
  // sections : booleen, tracer ou non les separations de sections
  // realiste : rendu monte (tenon, ombre, plaque de fond visible)
  function drawMosaicTo(canvas, idxArray, gw, gh, cell, sections, realiste) {
    canvas.width = gw * cell; canvas.height = gh * cell;
    const g = canvas.getContext("2d");
    g.clearRect(0, 0, canvas.width, canvas.height);

    // mise a l'echelle d'un canal, bornee a 0..255
    const shade = (rgb, f) => [
      Math.max(0, Math.min(255, Math.round(rgb[0] * f))),
      Math.max(0, Math.min(255, Math.round(rgb[1] * f))),
      Math.max(0, Math.min(255, Math.round(rgb[2] * f))),
    ];
    const css = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;

    if (realiste) {
      // plaque de fond visible entre les pieces
      g.fillStyle = "#3A3A3A";
      g.fillRect(0, 0, canvas.width, canvas.height);
    }

    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      const j = idxArray[y * gw + x];
      const [, rgb] = palette[j];
      const cx = x * cell, cy = y * cell;
      const pad = Math.max(1, Math.floor(cell * 0.12)), rad = (cell - pad * 2) / 2;
      const mx = cx + cell / 2, my = cy + cell / 2;

      if (realiste) {
        // plaque ronde
        g.fillStyle = css(rgb);
        g.beginPath(); g.arc(mx, my, rad, 0, Math.PI * 2); g.fill();
        // lisere de la plaque
        g.strokeStyle = css(shade(rgb, 0.75));
        g.lineWidth = 1;
        g.beginPath(); g.arc(mx, my, rad, 0, Math.PI * 2); g.stroke();
        // ombre portee du tenon, en bas a droite
        const rt = rad * 0.62;
        g.strokeStyle = css(shade(rgb, 0.82));
        g.lineWidth = Math.max(1, cell * 0.08);
        g.beginPath(); g.arc(mx, my, rt, -Math.PI / 4, Math.PI * 3 / 4); g.stroke();
        // relief du tenon
        g.fillStyle = css(shade(rgb, 1.12));
        g.beginPath(); g.arc(mx, my, rt, 0, Math.PI * 2); g.fill();
        continue;
      }

      g.fillStyle = css(rgb);
      const lum = (0.2126*rgb[0] + 0.7152*rgb[1] + 0.0722*rgb[2]) / 255;
      g.strokeStyle = lum < 0.45 ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.28)";
      g.lineWidth = Math.max(1, Math.floor(cell * 0.05));
      g.beginPath(); g.arc(mx, my, rad, 0, Math.PI * 2); g.fill(); g.stroke();
    }

    // grille
    g.strokeStyle = "rgba(0,0,0,0.18)"; g.lineWidth = 1;
    for (let i = 0; i <= gw; i++) { g.beginPath(); g.moveTo(i * cell, 0); g.lineTo(i * cell, gh * cell); g.stroke(); }
    for (let j = 0; j <= gh; j++) { g.beginPath(); g.moveTo(0, j * cell); g.lineTo(gw * cell, j * cell); g.stroke(); }

    // sections
    if (sections) {
      g.strokeStyle = "#ddd"; g.lineWidth = 4;
      for (let x = PLATE; x < gw; x += PLATE) {
        g.beginPath(); g.moveTo(x*cell, 0); g.lineTo(x*cell, gh*cell); g.stroke();
      }
      for (let y = PLATE; y < gh; y += PLATE) {
        g.beginPath(); g.moveTo(0, y*cell); g.lineTo(gw*cell, y*cell); g.stroke();
      }
    }
  }

  // Aperçu (sans numéros) + contours adaptatifs
  function renderFromIndices() {
    if (!indices || !gridDims) return;
    if (gridDims.w !== W || gridDims.h !== H) return;
    if (indices.length !== W * H) return;
    if (gridDims.pal !== palette) return;
    drawMosaicTo(mosaicRef.current, indices, W, H, 14, showSectionGrid, rendu === "realiste");
  }

  // Traitement principal
  async function processImage() {
    const img = images[idxImg]; if (!img) return null;
    const tiny = tinyRef.current;
    const S = drawCroppedToRect(img, tiny, W, H, zoom, offX, offY, 4, bgColor, cadrage);
    const id = tiny.getContext("2d").getImageData(0, 0, W * S, H * S);

    let stocksArr = null;
    if (stockEnabled) {
      stocksArr = palette.map((p) => {
        const key = p[0];
        const v = stockMap[key];
        if (v == null || v === "" || isNaN(v)) return -1;
        return Math.max(-1, parseInt(v, 10));
      });
    }
    const palPack = palette.map(p => ({
      rgb: p[1], codeBL: p[2], supplierCode: p?.[4]?.supplierCode ?? null
    }));
    const worker = workerRef.current;
    if (!worker) return null;

    const opts = {
      brightness: bright, contrast, saturation, gamma, sharpen,
      ditherType, ditherAmt, antiSingleton, darkPenalty, qtyMin
    };

    const t0 = performance.now();
    const result = await new Promise((resolve) => {
      worker.onmessage = (ev) => resolve(ev.data);
      worker.postMessage({ img: id.data, W, H, S, opts, pal: palPack, stocks: stocksArr }, [id.data.buffer]);
    });
    const t1 = performance.now();

    const countsArray = [];
    for (let i = 0; i < palette.length; i++) {
      const qty = result.counts[i] || 0;
      if (qty > 0) countsArray.push([palette[i][0], qty]);
    }
    countsArray.sort((a, b) => b[1] - a[1]);

    setIndices(result.indices);
    setGridDims({ w: W, h: H, pal: palette });
    setCounts(countsArray);
    setLastMs(Math.round(t1 - t0));
    setStockNote(result.stockNote || null);
    setOrphanPct(typeof result.orphanPct === "number" ? result.orphanPct : null);
    setFusions(result.fusions && result.fusions.removed > 0 ? result.fusions : null);

    return { indices: result.indices, counts: countsArray };
  }

  useEffect(() => { renderFromIndices(); /* eslint-disable-next-line */ }, [indices, palette, showSectionGrid, rendu, W, H]);
  useDebouncedEffect(() => { if (images[idxImg]) processImage(); },
    [images, idxImg, W, H, zoom, offX, offY, bgColor, cadrage, useSupplier, inclTrans, bright, contrast, saturation, gamma, sharpen, darkPenalty, ditherType, ditherAmt, antiSingleton, qtyMin, stockEnabled, stockMap], 250);

  /* =================== Exports =================== */
  // Renvoie des donnees garanties coherentes avec W/H courants,
  // en relancant le calcul si l'etat est perime.
  async function ensureGrid() {
    const fresh = indices && gridDims
      && gridDims.w === W && gridDims.h === H
      && indices.length === W * H
      && gridDims.pal === palette;
    if (fresh) return { indices, counts };
    return await processImage();
  }

  async function exportPNG() {
    const grid = await ensureGrid();
    if (!grid) return;
    // canvas hors ecran : independant de l'etat du DOM et du cycle React
    const off = document.createElement("canvas");
    drawMosaicTo(off, grid.indices, W, H, PNG_CELL, showSectionGrid, rendu === "realiste");
    const url = off.toDataURL("image/png");
    await saveFile(url, `mosaic_${W}x${H}.png`);
  }
  async function exportCSV() {
    const grid = await ensureGrid();
    if (!grid) return;
    const gridIdx = grid.indices;
    const gridCounts = grid.counts;
    const rows = [];
    for (let y = 0; y < H; y++) {
      const cols = [];
      for (let x = 0; x < W; x++) {
        const idx = gridIdx[y * W + x];
        const entry = palette[idx];
        const codeBL = entry[2];
        const codeSUP = entry?.[4]?.supplierCode ?? codeBL;
        cols.push(codeMode === "SUP" ? codeSUP : codeBL);
      }
      rows.push(cols.join(";"));
    }
    await saveFile(new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" }), `matrix_${codeMode}_${W}x${H}.csv`);

    const list = gridCounts.map(([name, qty]) => {
      const p = palette.find((q) => q[0] === name) || [];
      const codeBL = p[2] ?? "?"; const codeSUP = p?.[4]?.supplierCode ?? null;
      const grams = (qty * GRAM_PER_PART).toFixed(1);
      return `[${codeBL}] ${name}${codeSUP != null ? ` (#${String(codeSUP).padStart(2,"0")})` : ""};${qty};${grams} g`;
    });
    await saveFile(new Blob([`Code-Name;Qty;Weight(g)\n` + list.join("\n")], { type: "text/csv;charset=utf-8" }), `parts_${codeMode}_${W}x${H}.csv`);
  }

  async function exportPDF_A3() {
    const grid = await ensureGrid();
    if (!grid) return;
    const gridIdx = grid.indices;
    const gridCounts = grid.counts;
    const JsPDF = await getJsPDF(); if (!JsPDF) { alert("jsPDF manquant"); return; }
    const doc = new JsPDF({ orientation: "portrait", unit: "mm", format: "a3" });
    const Wp = doc.internal.pageSize.getWidth(), Hp = doc.internal.pageSize.getHeight(), m = 12;

    doc.setFontSize(18);
    doc.text(`Brick Mosaic ${W}×${H} — numéros: ${codeMode === "SUP" ? "Fournisseur #" : "BrickLink"}`, Wp / 2, 12, { align: "center" });

    const aspect = W / H;
    const maxW = Wp - 2 * m - 60, maxH = Hp - 2 * m - 14;
    let drawW = maxW, drawH = drawW / aspect;
    if (drawH > maxH) { drawH = maxH; drawW = drawH * aspect; }
    const cell = Math.min(drawW / W, drawH / H);
    const ox = m, oy = 18;

    doc.setFillColor(255, 255, 255); doc.rect(ox, oy, cell * W, cell * H, "F");

    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const idx = gridIdx[y * W + x];
      const entry = palette[idx]; const [, rgb] = entry;
      const codeBL = entry[2]; const codeSUP = entry?.[4]?.supplierCode ?? codeBL;
      const code = codeMode === "SUP" ? codeSUP : codeBL;

      const px = ox + x * cell, py = oy + y * cell, rad = (cell * 0.76) / 2;
      doc.setFillColor(rgb[0], rgb[1], rgb[2]); doc.setDrawColor(20);
      doc.circle(px + cell / 2, py + cell / 2, rad, "FD");
      const lum = luminance(...rgb);
      doc.setTextColor(lum < 0.5 ? 255 : 0, lum < 0.5 ? 255 : 0, lum < 0.5 ? 255 : 0);
      doc.setFontSize(Math.max(6, cell * 0.55));
      doc.text(String(code), px + cell / 2, py + cell / 2, { align: "center", baseline: "middle" });
    }

    // grille
    doc.setDrawColor(190); doc.setLineWidth(0.1);
    for (let i = 0; i <= W; i++) { const x = ox + i * cell; doc.line(x, oy, x, oy + cell * H); }
    for (let j = 0; j <= H; j++) { const y = oy + j * cell; doc.line(ox, y, ox + cell * W, y); }

    // mini-légende
    let lx = ox + cell * W + 8, ly = 22; const box = 6;
    doc.setTextColor(0, 0, 0); doc.setFontSize(12); doc.text("Légende & quantités", lx, ly); ly += 6; doc.setFontSize(10);
    const items = gridCounts.map(([name, qty]) => {
      const p = palette.find((q) => q[0] === name) || []; const rgb = p[1] || [200, 200, 200];
      const codeBL = p[2] ?? "?"; const codeSUP = p?.[4]?.supplierCode ?? null;
      const grams = qty * GRAM_PER_PART;
      return { name, qty, grams, rgb, codeBL, codeSUP };
    }).sort((a, b) => ((a.codeSUP ?? 9999) - (b.codeSUP ?? 9999)) || a.name.localeCompare(b.name));
    const pad2 = (n) => String(n).padStart(2, "0");
    for (const it of items) {
      doc.setFillColor(it.rgb[0], it.rgb[1], it.rgb[2]); doc.rect(lx, ly, box, box, "F"); doc.setDrawColor(0); doc.rect(lx, ly, box, box);
      const tag = it.codeSUP != null ? `(#${pad2(it.codeSUP)})` : "";
      const suf = (tag && it.name.indexOf(tag) === -1) ? ` ${tag}` : "";
      doc.text(`[${it.codeBL}] ${it.name}${suf}: ${it.qty} pcs — ${it.grams.toFixed(1)} g`, lx + box + 3, ly + 4);
      ly += box + 3; if (ly > Hp - 14) { doc.addPage(); lx = m; ly = 14; }
    }

    doc.save(`print_A3_${codeMode}_${W}x${H}.pdf`);
  }

  async function exportPDF_Sections() {
    const grid = await ensureGrid();
    if (!grid) return;
    const gridIdx = grid.indices;
    const gridCounts = grid.counts;
    const JsPDF = await getJsPDF(); if (!JsPDF) { alert("jsPDF manquant"); return; }
    const doc = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const Wp = doc.internal.pageSize.getWidth();
    const m = 10;
    // taille de case fixe : impression a l'echelle reelle
    const cell = STUD_MM;                 // 8 mm par tenon
    const board = PLATE_MM;               // 128 mm de cote
    const ox = (Wp - board) / 2;          // plateau centre horizontalement
    const oy = 20;                        // juste sous le titre

    let n = 1, first = true;
    for (let pr = 0; pr < plateRows; pr++) for (let pc = 0; pc < plateCols; pc++) {
      const x0 = pc * PLATE, y0 = pr * PLATE;
      if (!first) doc.addPage(); first = false;
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(16);
      doc.text(`Plaque ${n}/${plateCols*plateRows} - colonne ${pc+1}, ligne ${pr+1}`, Wp / 2, 12, { align: "center" });

      for (let y = 0; y < PLATE; y++) for (let x = 0; x < PLATE; x++) {
        const idp = gridIdx[(y0 + y) * W + (x0 + x)];
        const entry = palette[idp]; const [, rgb] = entry;
        const codeBL = entry[2]; const codeSUP = entry?.[4]?.supplierCode ?? codeBL;
        const code = codeMode === "SUP" ? codeSUP : codeBL;

        const px = ox + x * cell, py = oy + y * cell, rad = (cell * 0.76) / 2;
        doc.setFillColor(rgb[0], rgb[1], rgb[2]); doc.setDrawColor(0); doc.circle(px + cell / 2, py + cell / 2, rad, "FD");
        const lum = luminance(...rgb); doc.setTextColor(lum < 0.5 ? 255 : 0, lum < 0.5 ? 255 : 0, lum < 0.5 ? 255 : 0);
        doc.setFontSize(Math.max(6, cell * 0.55));
        doc.text(String(code), px + cell / 2, py + cell / 2, { align: "center", baseline: "middle" });
      }

      doc.setDrawColor(180); doc.setLineWidth(0.1);
      for (let i = 0; i <= PLATE; i++) { const x = ox + i * cell; doc.line(x, oy, x, oy + board); }
      for (let j = 0; j <= PLATE; j++) { const y = oy + j * cell; doc.line(ox, y, ox + board, y); }
      doc.setDrawColor(0); doc.setLineWidth(0.2); doc.rect(ox, oy, board, board);

      // Controle d'echelle : trait de reference de 100 mm exactement
      const ctrlY = oy + board + 18;
      const cx0 = (Wp - 100) / 2;
      doc.setDrawColor(0); doc.setLineWidth(0.3);
      doc.line(cx0, ctrlY, cx0 + 100, ctrlY);
      doc.setTextColor(0, 0, 0); doc.setFontSize(9);
      doc.text("Echelle 1:1 - ce trait doit mesurer 100 mm. Imprimer a 100%, sans ajustement a la page.", Wp / 2, ctrlY + 7, { align: "center" });
      doc.text("Poser la plaque 16x16 sur le plateau ci-dessus pour placer les briques.", Wp / 2, ctrlY + 13, { align: "center" });

      n++;
    }

    // Légende pages finales (une couleur par ligne + poids)
    addLegendPagesSortedBySupplier(doc, gridCounts, palette, plateCols * plateRows);
    doc.save(`plaques_${plateCols}x${plateRows}_${codeMode}_${W}x${H}.pdf`);
  }

  /* =================== UI =================== */
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">BrickMosaic Pro — OKLab + Dithering + Stock</h1>
          <div className="text-xs opacity-70">
            Aperçu sans numéros · PDF numérotés · Légende triée par # · {lastMs!=null ? `Traitement ${lastMs} ms` : "Prêt"}
          </div>
        </header>

        <div className="grid lg:grid-cols-3 gap-4">
          {/* Panneau gauche */}
          <div className="bg-white rounded-2xl shadow p-4 space-y-4">
            {/* 1) Import */}
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
              <div className="flex items-center gap-2 mt-2">
                <label htmlFor="bg" className="text-sm">Fond des zones transparentes</label>
                <input id="bg" type="color" value={bgColor} onChange={(e)=>setBgColor(e.target.value)} />
                <span className="text-xs opacity-60">S'applique aux images detourees (PNG, WebP, AVIF).</span>
              </div>
            </div>

            {/* 2) Grille */}
            <div className="space-y-2">
              <label className="block text-sm font-medium">2) Grille (colonnes × lignes)</label>
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-xs">Largeur : {W} tenons ({plateCols} plaques)</span>
                  <input type="range" min={PLATE} max={128} step={PLATE} value={W} onChange={(e)=>setW(parseInt(e.target.value,10))} className="w-full" />
                </div>
                <div><span className="text-xs">Hauteur : {H} tenons ({plateRows} plaques)</span>
                  <input type="range" min={PLATE} max={128} step={PLATE} value={H} onChange={(e)=>setH(parseInt(e.target.value,10))} className="w-full" />
                </div>
              </div>
              <div className="text-xs opacity-70">
                {plateCols*plateRows} plaques ({plateCols} x {plateRows}) - {(W*STUD_MM/10).toFixed(1)} x {(H*STUD_MM/10).toFixed(1)} cm - {W*H} tenons
              </div>
              {orphanPct != null && (
                <>
                  <div className={`text-xs ${orphanPct > 3.0 ? "text-amber-700 font-medium" : orphanPct < 1.5 ? "text-green-700" : "text-neutral-600"}`}>
                    {orphanPct > 3.0
                      ? `Image trop detaillee pour cette grille (${orphanPct.toFixed(1)} % de pastilles isolees)`
                      : orphanPct < 1.5
                        ? `Image bien adaptee a cette grille (${orphanPct.toFixed(1)} % de pastilles isolees)`
                        : `Image assez detaillee, rendu correct (${orphanPct.toFixed(1)} % de pastilles isolees)`}
                  </div>
                  {orphanPct > 3.0 && (
                    <div className="text-xs opacity-60">
                      Recadrer plus serre sur le sujet est plus efficace qu'agrandir la grille.
                    </div>
                  )}
                </>
              )}
              {gridSuggestion && (
                <div className="text-xs opacity-70 flex items-center gap-2 flex-wrap">
                  <span>
                    Format de l'image : {gridSuggestion.w} x {gridSuggestion.h}. Grille la plus proche : {gridSuggestion.a} x {gridSuggestion.b} ({gridSuggestion.plaques} plaques, {gridSuggestion.cmW.toFixed(1)} x {gridSuggestion.cmH.toFixed(1)} cm).
                  </span>
                  <button
                    className="px-2 py-0.5 border rounded"
                    onClick={()=>{ setW(gridSuggestion.a); setH(gridSuggestion.b); }}
                    disabled={W===gridSuggestion.a && H===gridSuggestion.b}
                  >Appliquer</button>
                </div>
              )}
              <div className="space-y-1">
                <label className="text-sm flex items-center gap-2">
                  <input type="radio" name="cadrage" checked={cadrage==="remplir"} onChange={()=>{ setCadrage("remplir"); setZoom(1.15); }} />
                  Remplir la grille (rogne les bords)
                </label>
                <label className="text-sm flex items-center gap-2">
                  <input type="radio" name="cadrage" checked={cadrage==="contenir"} onChange={()=>{ setCadrage("contenir"); setZoom(1.00); }} />
                  Contenir l'image entiere (ajoute du fond)
                </label>
                <div><span className="text-xs">Zoom : {zoom.toFixed(2)}</span>
                  <input type="range" min={0.5} max={3} step={0.05} value={zoom} onChange={(e)=>setZoom(parseFloat(e.target.value))} className="w-full" />
                </div>
                <div className="text-xs opacity-60">
                  {cadrage==="contenir"
                    ? "En mode contenir : 1.00 ajuste l'image au cadre, au-dela elle est reduite et le fond apparait."
                    : "En mode remplir : les valeurs sous 1.00 sont sans effet, le cadre est toujours entierement couvert."}
                </div>
              </div>
              <label className="text-sm flex items-center gap-2">
                <input type="checkbox" checked={showSectionGrid} onChange={(e)=>setShowSectionGrid(e.target.checked)} />
                Afficher la separation des plaques
              </label>
              <div className="text-sm mt-1">
                <strong>Total pièces :</strong> {totalPieces.toLocaleString("fr-FR")}
                {counts.length>0 && <> — <strong>Utilisées :</strong> {usedPieces.toLocaleString("fr-FR")} — <strong>Poids :</strong> {totalWeight} g</>}
              </div>
            </div>

            {/* 3) Palette */}
            <div className="space-y-2 pt-2 border-t">
              <label className="text-sm font-medium">3) Palette & transparents</label>
              <label className="text-sm flex items-center gap-2">
                <input type="radio" name="src" checked={useSupplier} onChange={()=>setUseSupplier(true)} />
                Palette fournisseur (69 couleurs)
              </label>
              <label className="text-sm flex items-center gap-2">
                <input type="radio" name="src" checked={!useSupplier} onChange={()=>setUseSupplier(false)} />
                BrickLink 4073 (référence)
              </label>
              <div className="ml-6 flex items-center gap-2">
                <input id="trans" type="checkbox" checked={inclTrans} onChange={(e)=>setInclTrans(e.target.checked)} />
                <label htmlFor="trans" className="text-sm">Inclure les transparentes</label>
              </div>
              <div className="ml-6 text-xs opacity-60">
                Posees sur une plaque de fond, les briques transparentes laissent voir la plaque : leur rendu reel differe de la couleur affichee.
              </div>
            </div>

            {/* 4) Numéros */}
            <div className="space-y-2 pt-2 border-t">
              <label className="text-sm font-medium">4) Numéros imprimés</label>
              <label className="text-sm flex items-center gap-2">
                <input type="radio" name="code" checked={codeMode==="BL"} onChange={()=>setCodeMode("BL")} />
                Codes BrickLink
              </label>
              <label className="text-sm flex items-center gap-2">
                <input type="radio" name="code" checked={codeMode==="SUP"} onChange={()=>setCodeMode("SUP")} />
                Codes Fournisseur (#01→#99)
              </label>
              <div className="text-xs opacity-60 ml-6">La légende PDF est toujours triée par # fournisseur.</div>
            </div>

            {/* 5) Dithering */}
            <div className="space-y-2 pt-2 border-t">
              <label className="text-sm font-medium">5) Dithering & anti-bruit</label>
              <div className="grid grid-cols-2 gap-2">
                <select className="border rounded px-2 py-1" value={ditherType} onChange={(e)=>setDitherType(e.target.value)}>
                  <option value="bayer">Bayer (ordonné)</option>
                  <option value="fs">Floyd–Steinberg</option>
                  <option value="atk">Atkinson</option>
                  <option value="none">Aucun</option>
                </select>
                <div>
                  <span className="text-xs">Intensité : {ditherAmt}%</span>
                  <input type="range" min={0} max={100} step={1} value={ditherAmt} onChange={(e)=>setDitherAmt(parseInt(e.target.value,10))} className="w-full" />
                </div>
              </div>
              <label className="text-sm flex items-center gap-2">
                <input type="checkbox" checked={antiSingleton} onChange={(e)=>setAntiSingleton(e.target.checked)} />
                Anti-singleton (corrige les pixels isolés)
              </label>
              <div><span className="text-xs">Quantite minimale par couleur : {qtyMin}</span>
                <input type="range" min={0} max={30} step={1} value={qtyMin} onChange={(e)=>setQtyMin(parseInt(e.target.value,10))} className="w-full" />
                <div className="text-xs opacity-60">
                  0 desactive le filtre. Reduit le nombre de references a commander et a trier, sans changement visible.
                </div>
                {fusions && (
                  <div className="text-xs text-green-700">
                    {fusions.removed} couleurs supprimees, {fusions.moved} briques reaffectees.
                  </div>
                )}
              </div>
            </div>

            {/* 6) Ajustements */}
            <div className="space-y-2 pt-2 border-t">
              <label className="text-sm font-medium">6) Ajustements d’image</label>
              <div><span className="text-xs">Lumière : {bright}</span>
                <input type="range" min={-100} max={100} step={1} value={bright} onChange={(e)=>setBright(parseInt(e.target.value,10))} className="w-full" />
              </div>
              <div><span className="text-xs">Contraste : {contrast}</span>
                <input type="range" min={-100} max={100} step={1} value={contrast} onChange={(e)=>setContrast(parseInt(e.target.value,10))} className="w-full" />
              </div>
              <div><span className="text-xs">Saturation : {saturation}</span>
                <input type="range" min={-100} max={100} step={1} value={saturation} onChange={(e)=>setSaturation(parseInt(e.target.value,10))} className="w-full" />
              </div>
              <div><span className="text-xs">Gamma : {gamma.toFixed(2)}</span>
                <input type="range" min={0.5} max={2.5} step={0.05} value={gamma} onChange={(e)=>setGamma(parseFloat(e.target.value))} className="w-full" />
              </div>
              <div><span className="text-xs">Netteté (unsharp) : {sharpen}%</span>
                <input type="range" min={0} max={100} step={1} value={sharpen} onChange={(e)=>setSharpen(parseInt(e.target.value,10))} className="w-full" />
              </div>
              <div><span className="text-xs">Penalite noirs : {darkPenalty}</span>
                <input type="range" min={0} max={100} step={1} value={darkPenalty} onChange={(e)=>setDarkPenalty(parseInt(e.target.value,10))} className="w-full" />
              </div>
              <div className="flex gap-2">
                <button className="px-2 py-1 border rounded" onClick={()=>{
                  setGamma(1.12); setBright(5); setContrast(10); setSaturation(6); setSharpen(45);
                  setDitherType("bayer"); setDitherAmt(40); setAntiSingleton(true); setUseSupplier(true);
                }}>Preset Portrait</button>
                <button className="px-2 py-1 border rounded" onClick={()=>{
                  setGamma(1.0); setBright(0); setContrast(8); setSaturation(0); setSharpen(28);
                  setDitherType("none"); setDitherAmt(0); setAntiSingleton(false);
                }}>Preset Logo</button>
              </div>
            </div>

            {/* 7) Stock */}
            <div className="space-y-2 pt-2 border-t">
              <label className="text-sm font-medium">7) Contraintes de stock</label>
              <label className="text-sm flex items-center gap-2">
                <input type="checkbox" checked={stockEnabled} onChange={(e)=>setStockEnabled(e.target.checked)} />
                Activer les contraintes (réallocation auto si dépassement)
              </label>
              <div className="flex gap-2">
                <button className="px-2 py-1 border rounded text-xs" onClick={()=>{
                  const next = {...stockMap};
                  counts.forEach(([name, qty]) => { next[name] = qty; });
                  setStockMap(next);
                }}>Remplir avec les quantités utilisées</button>
                <button className="px-2 py-1 border rounded text-xs" onClick={()=>setStockMap({})}>Tout vider (illimité)</button>
              </div>
              <div className="text-xs opacity-70">
                Vide = “illimité”. Saisissez un nombre pour limiter la quantité disponible d’une couleur.
              </div>
              <div className="max-h-60 overflow-auto border rounded p-2">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left">
                      <th>Couleur</th><th>BL</th><th>#</th><th>Dispo</th><th>Utilisé</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paletteUISorted.map((p)=>{
                      const label=p[0], codeBL=p[2], codeSUP=p?.[4]?.supplierCode ?? null;
                      const used=(counts.find(([n])=>n===label)||[0,0])[1];
                      return (
                        <tr key={label}>
                          <td>{label}</td>
                          <td>[{codeBL}]</td>
                          <td>{codeSUP!=null?`#${String(codeSUP).padStart(2,"0")}`:""}</td>
                          <td>
                            <input
                              type="number"
                              className="w-24 border rounded px-1 py-0.5"
                              placeholder="illimité"
                              value={stockMap[label] ?? ""}
                              onChange={(e)=>{
                                const v=e.target.value;
                                setStockMap(s=>({...s, [label]: v}));
                              }}
                            />
                          </td>
                          <td>{used}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {stockNote && <div className={`text-xs mt-1 ${/satisfaites/.test(stockNote)?"text-green-700":"text-amber-700"}`}>{stockNote}</div>}
            </div>

            {/* Actions */}
            <div className="pt-2 border-t space-y-2">
              <button className="w-full bg-black text-white rounded-xl py-2" onClick={processImage} disabled={!images.length}>Générer l’aperçu (worker)</button>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={exportPNG} className="px-3 py-2 rounded-xl border" disabled={!images.length}>PNG</button>
                <button onClick={exportCSV} className="px-3 py-2 rounded-xl border" disabled={!images.length}>CSV</button>
                <button onClick={exportPDF_A3} className="px-3 py-2 rounded-xl border col-span-2" disabled={!images.length}>PDF A3 (numéros + mini-légende)</button>
                <button onClick={exportPDF_Sections} className="px-3 py-2 rounded-xl border col-span-2" disabled={!images.length}>PDF Sections (légende finale)</button>
              </div>
            </div>
          </div>

          {/* Aperçu + palette */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow p-4 space-y-4">
            <div className="space-y-1">
              <label className="text-sm flex items-center gap-2">
                <input type="radio" name="rendu" checked={rendu==="plat"} onChange={()=>setRendu("plat")} />
                Apercu a plat (lecture des couleurs)
              </label>
              <label className="text-sm flex items-center gap-2">
                <input type="radio" name="rendu" checked={rendu==="realiste"} onChange={()=>setRendu("realiste")} />
                Apercu realiste (rendu monte)
              </label>
              <div className="text-xs opacity-60">
                Le rendu realiste montre les tenons, les ombres et la plaque de fond visible entre les pieces. Utilisez-le pour presenter un projet a un client.
              </div>
            </div>

            <div className="overflow-auto w-full border rounded-xl">
              <canvas ref={mosaicRef} className="w-full h-auto" />
            </div>

            <div>
              <h3 className="font-semibold mb-2">
                Palette (tri par # fournisseur) — {inclTrans ? "avec" : "sans"} transparentes — Numéros: {codeMode==="SUP"?"Fournisseur":"BrickLink"}
              </h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
                {paletteUISorted.map(p=>{
                  const label=p[0], rgb=p[1], codeBL=p[2], codeSUP=p?.[4]?.supplierCode ?? null;
                  const qty=(counts.find(([n])=>n===label)||[0,0])[1];
                  return (
                    <div key={`${label}-${codeBL}`} className="flex items-center gap-2 p-2 rounded-xl border">
                      <div className="w-6 h-6 rounded" style={{background:`rgb(${rgb[0]},${rgb[1]},${rgb[2]})`}} />
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-sm">
                          <span>{label}</span>
                          <span className="opacity-70">[{codeBL}] {codeSUP!=null ? `#${String(codeSUP).padStart(2,"0")}` : ""}</span>
                        </div>
                        <div className="text-xs opacity-60">rgb({rgb.join(",")})</div>
                      </div>
                      <div className="text-xs opacity-70">{qty}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <canvas ref={tinyRef} style={{ display: "none" }} />
        <footer className="text-xs text-neutral-500 text-center pt-4">
          Aperçu sans numéros. PDF : numéros sur les tenons + légende uniquement en dernières pages (tri par #, poids inclus).
        </footer>
      </div>
    </div>
  );
}
