// khula.js — v2.159.0 (31 Oct 2026): 🌾 KHULA MAAL — sheeshe ke dabbe (dry fruit / masale) + farsh par tore (daal, chawal, cheeni)
//   Malik: "dabba is tarah (dry fruit wale khane, aage dhalwan sheesha) — real lagna chahiye, tora bhi aur dabba bhi".
//   Har daana canvas par alag (rang, chamak, saya) · dher beech mein ooncha · tasveer ho to wohi andar (dher ki shakal mein).
//   AI NAHI. Sirf drawing — data dukan.js deta hai.

let seed = 7;
const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const hashOf = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };

// daane ki qismein — c: [hue, sat, light] · rx/ry: aadha naap · shape
const T = {
  kaju: { c: [38, 55, 72], rx: 7.5, ry: 4.6, shape: 'kidney', s: 2.5 },
  pista: { c: [40, 30, 74], rx: 6, ry: 4.2, shape: 'pista', s: 2.3 },
  badam: { c: [24, 55, 45], rx: 7, ry: 4, shape: 'almond', s: 2.4 },
  akhrot: { c: [30, 45, 42], rx: 6.5, ry: 5.2, shape: 'walnut', s: 2.4 },
  mungphali: { c: [22, 50, 62], rx: 5.4, ry: 2.8, shape: 'peanut', s: 2.1 },
  kishmish: { c: [34, 72, 42], rx: 4, ry: 2.8, shape: 'oval', s: 2.1 },
  chuhara: { c: [22, 60, 28], rx: 7, ry: 3.6, shape: 'oval', s: 2.3 },
  mirch: { c: [20, 12, 14], rx: 3.2, ry: 3.2, shape: 'round', s: 1.6 },
  kalonji: { c: [0, 0, 10], rx: 2.2, ry: 1.4, shape: 'oval', s: 1.5 },
  ilaichi: { c: [85, 40, 45], rx: 5.6, ry: 3.4, shape: 'oval', s: 1.9 },
  zeera: { c: [33, 45, 38], rx: 4, ry: 1.3, shape: 'oval', s: 1.7 },
  saunf: { c: [70, 30, 50], rx: 4, ry: 1.5, shape: 'oval', s: 1.7 },
  laung: { c: [16, 55, 22], rx: 5, ry: 1.4, shape: 'clove', s: 1.9 },
  darchini: { c: [20, 55, 32], rx: 9, ry: 2.2, shape: 'stick', s: 1.9 },
  dhania: { c: [38, 40, 55], rx: 2.6, ry: 2.6, shape: 'round', s: 1.7 },
  chana: { c: [42, 75, 55], rx: 3.6, ry: 3.6, shape: 'round', s: 1.7 },
  kalachana: { c: [25, 45, 25], rx: 3.6, ry: 3.4, shape: 'round', s: 1.8 },
  masoor: { c: [18, 80, 52], rx: 3, ry: 2.6, shape: 'disc', s: 1.6 },
  moong: { c: [95, 45, 40], rx: 2.8, ry: 2.2, shape: 'oval', s: 1.6 },
  mash: { c: [45, 25, 88], rx: 2.8, ry: 2, shape: 'oval', s: 1.6 },
  rajma: { c: [355, 50, 30], rx: 5, ry: 3, shape: 'oval', s: 1.9 },
  chawal: { c: [45, 25, 92], rx: 5.2, ry: 1.7, shape: 'oval', s: 1.7 },
  cheeni: { c: [210, 8, 96], rx: 1.6, ry: 1.6, shape: 'crystal', s: 1.4 },
  til: { c: [40, 30, 88], rx: 2.2, ry: 1.3, shape: 'oval', s: 1.5 },
  atta: { c: [38, 40, 84], shape: 'powder' },
  maida: { c: [40, 15, 95], shape: 'powder' },
  besan: { c: [45, 70, 70], shape: 'powder' },
  haldi: { c: [44, 90, 52], shape: 'powder' },
  lalmirch: { c: [5, 75, 38], shape: 'powder' },
  namak: { c: [0, 0, 94], shape: 'powder' },
  sooji: { c: [44, 55, 78], rx: 1.2, ry: 1.2, shape: 'crystal', s: 1.4 },
  beans: { c: [32, 40, 60], rx: 4, ry: 3, shape: 'oval', s: 1.8 },
};
const KW = [
  [/kaju|cashew/i, 'kaju'], [/pista|pistachio/i, 'pista'], [/badam|almond/i, 'badam'], [/akhrot|walnut/i, 'akhrot'], [/mung ?phal|peanut|moongphali/i, 'mungphali'],
  [/kishmish|raisin|munakka/i, 'kishmish'], [/chuhar|chhuhar|khajoor|date/i, 'chuhara'], [/lal mirch|red chil|mirch powder|chilli powder/i, 'lalmirch'], [/kali mirch|black pepper|pepper|mirch/i, 'mirch'],
  [/kalonji|nigella/i, 'kalonji'], [/ilaichi|elaichi|cardamom/i, 'ilaichi'], [/zeera|jeera|cumin/i, 'zeera'], [/saunf|sonf|fennel/i, 'saunf'], [/laung|clove/i, 'laung'],
  [/darchini|cinnamon/i, 'darchini'], [/dhania|coriander/i, 'dhania'], [/haldi|turmeric/i, 'haldi'], [/namak|salt/i, 'namak'], [/besan|gram flour/i, 'besan'],
  [/maida/i, 'maida'], [/atta|flour/i, 'atta'], [/sooji|suji|semolina/i, 'sooji'], [/kala chana|black chana/i, 'kalachana'], [/masoor/i, 'masoor'], [/moong|mung/i, 'moong'],
  [/mash|urad/i, 'mash'], [/rajma|lobia|kidney/i, 'rajma'], [/chana|chickpea|channa/i, 'chana'], [/daal|dal\b/i, 'chana'], [/chawal|rice|basmati|sela/i, 'chawal'],
  [/cheeni|sugar|shakar|khand/i, 'cheeni'], [/til\b|sesame/i, 'til'], [/beans|lobia/i, 'beans'],
];
export function grainOf(name) { for (const [re, k] of KW) if (re.test(name)) return k; return ['beans', 'chana', 'moong', 'mash', 'til'][hashOf(name) % 5]; }
// 🫙 dabba (dry fruit / masale) ya 🧺 tora (daal, chawal, cheeni, atta) — malik app se badal sakta hai (racks.lp)
const GLASS = /kaju|cashew|pista|badam|almond|akhrot|walnut|mung ?phal|peanut|kishmish|raisin|munakka|chuhar|khajoor|anjeer|khopr|narial|chilgoza|mirch|pepper|kalonji|ilaichi|elaichi|cardamom|zeera|jeera|cumin|saunf|sonf|laung|clove|darchini|cinnamon|dhania|coriander|haldi|turmeric|masala|ajwain|methi|til\b|khashkhash|zafran|dry ?fruit|mewa|meva/i;
const SACK = /daal|dal\b|chana|channa|masoor|moong|mung\b|mash\b|urad|rajma|lobia|chawal|rice|basmati|sela|cheeni|sugar|shakar|khand|atta|maida|besan|sooji|suji|namak|salt|dalia|daliya|jau\b|bajra|makai|gandum|wheat|beans/i;
const KG = u => /^(kg|kgs|kilo|kilogram|kilograms)$/i.test(String(u || '').trim());
// khula maal: unit kg (POS mein tol kar bikta) — ya packet (sub-barcode) wala daal / chawal / dry fruit. Malik app se badal sakta (racks.lp: g / s / n)
export function kindOf(it, lp) {
  const o = lp && lp[it.id]; if (o === 'g' || o === 's' || o === 'n') return o;
  const loose = KG(it.u) || (Array.isArray(it.pk) && it.pk.length > 0 && (GLASS.test(it.n) || SACK.test(it.n)));
  return loose ? (GLASS.test(it.n) ? 'g' : 's') : 'n';
}
export const isKg = KG;

function grain(ctx, x, y, t, s) {
  const [h, sat, l] = t.c, dl = (R() - .5) * 14, dh = (R() - .5) * 6, rot = R() * Math.PI, sc = s * (0.82 + R() * 0.36), rx = t.rx * sc, ry = t.ry * sc;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(1.2 * s, 1.6 * s, rx, ry, 0, 0, 7); ctx.fill();
  const g = ctx.createRadialGradient(-rx * .35, -ry * .45, 0.5, 0, 0, Math.max(rx, ry) * 1.15);
  g.addColorStop(0, `hsl(${h + dh},${sat}%,${Math.min(97, l + 18 + dl)}%)`); g.addColorStop(.55, `hsl(${h + dh},${sat}%,${Math.max(3, l + dl)}%)`); g.addColorStop(1, `hsl(${h + dh},${sat}%,${Math.max(3, l - 22 + dl)}%)`);
  ctx.fillStyle = g; ctx.beginPath();
  if (t.shape === 'kidney') { ctx.lineCap = 'round'; ctx.lineWidth = ry * 1.5; ctx.strokeStyle = g; ctx.arc(0, ry * .6, rx * .78, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke(); ctx.lineWidth = ry * .35; ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(0, ry * .6, rx * .85, Math.PI * 1.2, Math.PI * 1.6); ctx.stroke(); }
  else if (t.shape === 'peanut') { ctx.ellipse(-rx * .4, 0, rx * .6, ry, 0, 0, 7); ctx.ellipse(rx * .45, 0, rx * .55, ry * .92, 0, 0, 7); ctx.fill(); }
  else if (t.shape === 'almond') { ctx.moveTo(-rx, 0); ctx.quadraticCurveTo(-rx * .2, -ry * 1.3, rx, 0); ctx.quadraticCurveTo(-rx * .2, ry * 1.3, -rx, 0); ctx.fill(); ctx.strokeStyle = `hsla(${h},${sat}%,${l - 20}%,.5)`; ctx.lineWidth = .6; for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(-rx * .7, k * ry * .25); ctx.lineTo(rx * .7, k * ry * .2); ctx.stroke(); } }
  else if (t.shape === 'pista') { ctx.ellipse(0, 0, rx, ry, 0, 0, 7); ctx.fill(); ctx.fillStyle = `hsl(80,45%,${38 + dl / 2}%)`; ctx.beginPath(); ctx.ellipse(rx * .1, 0, rx * .55, ry * .32, 0, 0, 7); ctx.fill(); }
  else if (t.shape === 'walnut') { ctx.ellipse(0, 0, rx, ry, 0, 0, 7); ctx.fill(); ctx.strokeStyle = `hsla(${h},${sat}%,${l - 25}%,.6)`; ctx.lineWidth = .9; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc((R() - .5) * rx, (R() - .5) * ry, rx * .4, R() * 6, R() * 6 + 2); ctx.stroke(); } }
  else if (t.shape === 'clove') { ctx.fillRect(-rx, -ry * .5, rx * 1.5, ry); ctx.beginPath(); ctx.arc(rx * .6, 0, ry * 1.4, 0, 7); ctx.fill(); }
  else if (t.shape === 'stick') { ctx.fillRect(-rx, -ry, rx * 2, ry * 2); ctx.strokeStyle = `hsla(${h},${sat}%,${l - 15}%,.7)`; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(-rx, 0); ctx.lineTo(rx, 0); ctx.stroke(); }
  else if (t.shape === 'crystal') { ctx.rect(-rx, -ry, rx * 2, ry * 2); ctx.fill(); }
  else { ctx.ellipse(0, 0, rx, ry, 0, 0, 7); ctx.fill(); if (t.shape === 'disc') { ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.ellipse(-rx * .2, -ry * .25, rx * .45, ry * .35, 0, 0, 7); ctx.fill(); } }
  ctx.fillStyle = 'rgba(255,255,255,.33)'; ctx.beginPath(); ctx.ellipse(-rx * .35, -ry * .4, rx * .28, ry * .18, 0, 0, 7); ctx.fill();
  ctx.restore();
}
function powder(ctx, x0, y0, w, h, t, top) {   // atta / besan / haldi — narm dher (daane nahi)
  const [hh, sat, l] = t.c;
  ctx.beginPath(); ctx.moveTo(x0, y0 + h); for (let x = x0; x <= x0 + w; x += 3) ctx.lineTo(x, top(x)); ctx.lineTo(x0 + w, y0 + h); ctx.closePath();
  const g = ctx.createLinearGradient(0, y0, 0, y0 + h); g.addColorStop(0, `hsl(${hh},${sat}%,${Math.min(98, l + 8)}%)`); g.addColorStop(1, `hsl(${hh},${sat}%,${Math.max(5, l - 14)}%)`); ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip(); for (let i = 0; i < w * h / 6; i++) { const x = x0 + R() * w, y = y0 + R() * h; ctx.fillStyle = R() < .5 ? `hsla(${hh},${sat}%,${l + 12}%,.5)` : `hsla(${hh},${sat}%,${l - 14}%,.35)`; ctx.fillRect(x, y, 1.2, 1.2); } ctx.restore();
}
// daane banane ka tez tareeqa: har qism + naap ka EK "tile" (seamless, ek dafa) — dher = tile ka pattern + upar kinare ke asli daane (ubhra hua kinara)
//   v2.159.0 perf: pehle har dabba hazaron daane alag banata tha (cheeni = 300 ms sust phone par) — ab ~5 ms.
function fastGrains(ctx, pts, t, s) {
  const [hh, sat, l] = t.c, pal = [-16, -9, -3, 3, 9, 15].map(d => `hsl(${hh},${sat}%,${Math.max(3, Math.min(97, l + d))}%)`), hi = `hsla(${hh},${sat}%,${Math.min(99, l + 26)}%,.8)`, sh0 = l > 85 ? 'rgba(60,70,90,.12)' : 'rgba(0,0,0,.22)';
  for (const [x, y] of pts) { const sc = s * (0.82 + R() * 0.36), rx = t.rx * sc, ry = t.ry * sc, a = R() * Math.PI;
    ctx.fillStyle = sh0; ctx.beginPath(); ctx.ellipse(x + .8 * s, y + 1.1 * s, rx, ry, a, 0, 7); ctx.fill();
    ctx.fillStyle = pal[(R() * 6) | 0]; ctx.beginPath(); if (t.shape === 'crystal') ctx.rect(x - rx, y - ry, rx * 2, ry * 2); else ctx.ellipse(x, y, rx, ry, a, 0, 7); ctx.fill();
    if (R() < .5) { ctx.fillStyle = hi; ctx.fillRect(x - rx * .4, y - ry * .5, Math.max(.6, rx * .5), Math.max(.6, ry * .4)); } }
}
const TILES = new Map();
function tileOf(t, s0, lite) {
  const s = Math.max(0.3, Math.round(s0 * 10) / 10), key = t.c.join() + t.shape + t.rx + '|' + s + (lite ? 'l' : ''); let c = TILES.get(key); if (c) return c;   // naap 0.1 tak gol — ek tile kai dabbon ke kaam
  const sx = t.rx * s * 1.05, sy = t.ry * s * 0.95, side = Math.max(64, sx * 10), nx = Math.max(4, Math.round(side / sx)), ny = Math.max(4, Math.round(side / sy)), TW = Math.round(nx * sx), TH = Math.round(ny * sy);
  c = document.createElement('canvas'); c.width = TW; c.height = TH; const ctx = c.getContext('2d'), [hh, sat, l] = t.c;
  ctx.fillStyle = `hsl(${hh},${sat}%,${Math.max(5, l - (l > 85 ? 12 : 30))}%)`; ctx.fillRect(0, 0, TW, TH);   // safed (cheeni / chawal) = halka neeche ka rang
  const m = Math.max(t.rx, t.ry) * s * 1.6, pts = [];
  for (let pass = 0; pass < (nx * ny > 900 ? 1 : 2); pass++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const x = i * sx + (R() - .5) * sx * 1.1 + (pass ? sx / 2 : 0), y = j * sy + (R() - .5) * sy * 1.1 + (pass ? sy / 2 : 0);
    for (const dx of [0, -TW, TW]) for (const dy of [0, -TH, TH]) { const X = x + dx, Y = y + dy; if (X > -m && X < TW + m && Y > -m && Y < TH + m) pts.push([X, Y]); } }   // kinare par dohra = jor nazar na aaye
  pts.sort((a, b) => a[1] - b[1]);
  if (pts.length > (lite ? 1500 : 3500)) fastGrains(ctx, pts, t, s); else for (const [x, y] of pts) grain(ctx, x, y, t, s);
  TILES.set(key, c); return c;
}
// dher: beech mein ooncha — neeche tile ka pattern, upar ka kinara asli daanon se (ubhra hua), aakhir mein roshni / saya
function heap(ctx, x0, y0, w, h, t, s, topAt, lite) {
  const top = x => y0 + h * topAt - Math.sin(Math.PI * Math.max(0, Math.min(1, (x - x0) / w))) * h * 0.14;
  if (t.shape === 'powder') { powder(ctx, x0, y0, w, h, t, top); return; }
  const sx = t.rx * s * 1.05, sy = t.ry * s * 0.95, tile = tileOf(t, s, lite);
  ctx.save(); ctx.beginPath(); ctx.moveTo(x0, y0 + h); for (let x = x0; x <= x0 + w; x += 4) ctx.lineTo(x, top(x) + sy * 0.6); ctx.lineTo(x0 + w, y0 + h); ctx.closePath();
  const pat = ctx.createPattern(tile, 'repeat'), ox = R() * tile.width, oy = R() * tile.height;
  ctx.translate(ox, oy); ctx.fillStyle = pat; ctx.translate(-ox, -oy);
  try { pat.setTransform(new DOMMatrix([1, 0, 0, 1, ox, oy])); } catch {}
  ctx.fill(); ctx.restore();
  const pts = [];   // upar ka kinara: 2 qatar asli daane
  for (let r = 0; r < (lite ? 1 : 2); r++) for (let x = x0 - sx; x < x0 + w + sx; x += sx * 0.85) pts.push([x + (R() - .5) * sx * .6, top(x) + sy * (r * 0.9 + R() * 0.5)]);
  pts.sort((a, b) => a[1] - b[1]);
  if (t.rx * s < 3 || lite) fastGrains(ctx, pts, t, s); else for (const [x, y] of pts) grain(ctx, x, y, t, s);
  const sh = ctx.createLinearGradient(0, y0, 0, y0 + h); sh.addColorStop(0, 'rgba(255,255,255,.06)'); sh.addColorStop(.5, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.25)'); ctx.fillStyle = sh; ctx.fillRect(x0, y0, w, h);
}
function photoHeap(ctx, x0, y0, w, h, img, topAt) {   // asal tasveer dher ki shakal mein
  const top = x => y0 + h * topAt - Math.sin(Math.PI * Math.max(0, Math.min(1, (x - x0) / w))) * h * 0.14;
  ctx.save(); ctx.beginPath(); ctx.moveTo(x0, y0 + h); for (let x = x0; x <= x0 + w; x += 3) ctx.lineTo(x, top(x)); ctx.lineTo(x0 + w, y0 + h); ctx.closePath(); ctx.clip();
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, k = Math.max(w / iw, h / ih); ctx.drawImage(img, x0 + (w - iw * k) / 2, y0 + (h - ih * k) / 2, iw * k, ih * k);
  const sh = ctx.createLinearGradient(0, y0, 0, y0 + h); sh.addColorStop(0, 'rgba(255,255,255,.1)'); sh.addColorStop(1, 'rgba(0,0,0,.28)'); ctx.fillStyle = sh; ctx.fillRect(x0, y0, w, h);
  ctx.restore();
}
// 🫙 dabbe ka andar (canvas — dabba / sheesha CSS mein) · dpr = screen ki tezi
export function drawBin(cv, name, img, lite) {
  const ctx = cv.getContext('2d'), W = cv.width, H = cv.height, t = T[grainOf(name)], dpr = cv._dpr || 1;
  seed = hashOf(name) % 2147483646 + 1; ctx.clearRect(0, 0, W, H);
  if (img) photoHeap(ctx, -2, H * .1, W + 4, H * .9, img, 0.16);
  else heap(ctx, -6, H * .1, W + 12, H * .9, t, (t.s || 1.8) * dpr / 2.6, 0.16, lite);
}
const WV = new Map();   // bori ki bunai — ek tile (rang + naap) ek dafa, phir pattern
function weave(ctx, x, y, w, h, base, line, k) {
  const kq = Math.max(0.3, Math.round(k * 10) / 10), key = base + kq; let c = WV.get(key);
  if (!c) { const st = 5.5 * kq, n = 16, T = Math.round(st * n); c = document.createElement('canvas'); c.width = c.height = T; const g = c.getContext('2d');
    g.fillStyle = base; g.fillRect(0, 0, T, T); g.strokeStyle = line; g.lineWidth = 1.4 * kq;
    for (let i = 0; i < n; i++) { g.globalAlpha = .35 + R() * .3; g.beginPath(); g.moveTo(i * st, 0); g.lineTo(i * st, T); g.stroke(); }
    for (let j = 0; j < n; j++) { g.globalAlpha = .3 + R() * .3; g.beginPath(); g.moveTo(0, j * st); g.lineTo(T, j * st); g.stroke(); }
    g.globalAlpha = 1; for (let i = 0; i < T * T / 900; i++) { g.fillStyle = `rgba(0,0,0,${R() * .08})`; g.fillRect(R() * T, R() * T, (1 + R() * 8) * kq, kq); }
    WV.set(key, c); }
  const ox = R() * c.width; ctx.save(); ctx.translate(ox, 0); ctx.fillStyle = ctx.createPattern(c, 'repeat'); ctx.fillRect(x - ox, y, w, h); ctx.restore();
}
// 🧺 tora: jute (daal / chana) ya safed bori (cheeni / chawal / atta) — mura hua munh, andar dher, farsh par saya, kabhi steel ka scoop
export function drawSack(cv, name, img, lite) {
  const ctx = cv.getContext('2d'), W = cv.width, H = cv.height, gk = grainOf(name), t = T[gk];
  seed = hashOf(name) % 2147483646 + 1; ctx.clearRect(0, 0, W, H);
  const white = /cheeni|chawal|atta|maida|namak|sooji|mash|til/.test(gk), cx = W / 2, by = H * .965, h = H * .84, w = Math.min(W * .9, h / 1.2), top = by - h, rim = top + h * .11, k = w / 300;
  ctx.save(); ctx.translate(cx + 6 * k, by - 2 * k); ctx.scale(1, 22 * k / (w * .6)); const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, w * .6); sg.addColorStop(0, 'rgba(40,25,10,.42)'); sg.addColorStop(.6, 'rgba(40,25,10,.22)'); sg.addColorStop(1, 'rgba(40,25,10,0)'); ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(0, 0, w * .6, 0, 7); ctx.fill(); ctx.restore();   // farsh par saya (blur filter nahi — tez)
  const body = new Path2D(); body.moveTo(cx - w * .46, rim + 20 * k); body.bezierCurveTo(cx - w * .56, by - h * .35, cx - w * .58, by - 30 * k, cx - w * .44, by - 4 * k); body.quadraticCurveTo(cx, by + 10 * k, cx + w * .44, by - 4 * k); body.bezierCurveTo(cx + w * .58, by - 30 * k, cx + w * .56, by - h * .35, cx + w * .46, rim + 20 * k); body.closePath();
  ctx.save(); ctx.clip(body);
  if (white) weave(ctx, cx - w, top, w * 2, h + 20 * k, '#ece8df', '#b9b2a4', k); else weave(ctx, cx - w, top, w * 2, h + 20 * k, '#c39a5c', '#7d5a2c', k);
  const sh = ctx.createLinearGradient(cx - w * .6, 0, cx + w * .6, 0); sh.addColorStop(0, 'rgba(0,0,0,.35)'); sh.addColorStop(.3, 'rgba(255,255,255,.08)'); sh.addColorStop(.55, 'rgba(255,255,255,.12)'); sh.addColorStop(1, 'rgba(0,0,0,.4)'); ctx.fillStyle = sh; ctx.fillRect(cx - w, top, w * 2, h + 20 * k);
  for (let q = 0; q < 3; q++) { ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 6 * k; ctx.beginPath(); const fx = cx - w * .25 + q * w * .25 + (R() - .5) * 20 * k; ctx.moveTo(fx, rim + 30 * k); ctx.quadraticCurveTo(fx + 12 * k, by - h * .4, fx - 6 * k, by - 20 * k); ctx.stroke(); }
  if (white) { ctx.fillStyle = 'rgba(30,120,60,.75)'; ctx.font = `bold ${Math.round(30 * k)}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('SUPER', cx, rim + 110 * k); ctx.fillStyle = 'rgba(200,40,40,.7)'; ctx.fillRect(cx - w * .32, rim + 120 * k, w * .64, 6 * k); }
  ctx.restore();
  const ow = w * .5, oh = h * .085;
  ctx.save(); ctx.beginPath(); ctx.ellipse(cx, rim, ow, oh, 0, 0, 7); ctx.clip();
  ctx.fillStyle = white ? '#9d978b' : '#5e4220'; ctx.fillRect(cx - ow, rim - oh, ow * 2, oh * 2);
  if (img) photoHeap(ctx, cx - ow, rim - oh - 6 * k, ow * 2, oh * 2 + 10 * k, img, 0.1);
  else heap(ctx, cx - ow, rim - oh - 6 * k, ow * 2, oh * 2 + 10 * k, t, 2.2 * k, 0.12, lite);
  const ins = ctx.createRadialGradient(cx, rim, ow * .55, cx, rim, ow); ins.addColorStop(0, 'rgba(0,0,0,0)'); ins.addColorStop(1, 'rgba(0,0,0,.45)'); ctx.fillStyle = ins; ctx.fillRect(cx - ow, rim - oh, ow * 2, oh * 2);
  ctx.restore();
  ctx.save(); ctx.lineWidth = 14 * k; ctx.strokeStyle = white ? '#f4f1ea' : '#b58c50'; ctx.beginPath(); ctx.ellipse(cx, rim, ow + 4 * k, oh + 4 * k, 0, 0, 7); ctx.stroke();
  ctx.lineWidth = 3 * k; ctx.strokeStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(cx, rim + 6 * k, ow + 8 * k, oh + 8 * k, 0, 0.1, Math.PI - 0.1); ctx.stroke();
  ctx.lineWidth = 2 * k; ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.ellipse(cx, rim - 3 * k, ow + 2 * k, oh + 1 * k, 0, Math.PI + .3, 2 * Math.PI - .3); ctx.stroke(); ctx.restore();
  if (hashOf(name) % 3 === 0) { ctx.save(); ctx.translate(cx + ow * .35, rim - 6 * k); ctx.rotate(-0.5); const g = ctx.createLinearGradient(-20 * k, 0, 20 * k, 0); g.addColorStop(0, '#9aa3ad'); g.addColorStop(.5, '#f2f5f8'); g.addColorStop(1, '#7c858f'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 20 * k, 12 * k, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#6b737c'; ctx.fillRect(16 * k, -4 * k, 40 * k, 8 * k); ctx.restore(); }   // steel ka scoop
}
// chhoti tasveer (tokri / parchi / khirki) — jab item ki apni tasveer na ho
export function thumbOf(name, kind, px = 120) {
  const cv = document.createElement('canvas'); cv.width = px; cv.height = px; cv._dpr = 1.8 * Math.sqrt(px / 120);
  if (kind === 's') { drawSack(cv, name, null, true); return cv.toDataURL('image/png'); } else { const ctx = cv.getContext('2d'); ctx.fillStyle = '#2a221e'; ctx.fillRect(0, 0, px, px); drawBin(cv, name, null, true); }
  return cv.toDataURL('image/jpeg', 0.84);
}
// packet ka naam: 0.25 kg = 250 g · 1 = 1 kg · Pcs wale = "6 Pcs"
export function pkLab(q, u) { const kg = /^(kg|kgs|kilo|kilogram)$/i.test(String(u || '').trim()) || !u; if (!kg) return `${q} ${u}`; return q < 1 ? `${Math.round(q * 1000)} g` : `${+q.toFixed(3)} kg`; }
