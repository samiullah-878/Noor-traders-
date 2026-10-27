// =========================================================
//  photo-print.js  v2.0 (2026-10-27: poori chaurai 512 · lambai 270 · Atkinson + sharp — saaf aur kam kaghaz) · v1.0 (2026-10-12) — 📷 tasveer ko TM-T88IV (thermal) par chhapna — ESC/POS raster (GS v 0)
//  Malik: "samaan ki tasveer chhoti si aaye" — data:image/jpeg -> kaala-safed (Floyd-Steinberg) -> chhoti chaurai (default 256 dots = aadha kaghaz).
//  jpeg-decode.js (jpeg-js) se — koi npm install nahi. PNG / ghalat tasveer = '' (parchi tasveer ke baghair).
// =========================================================
const decode = require('./jpeg-decode.js');
// v2.0 (2026-10-27): malik — "tasveer zyada clear chhape · kaghaz bohat lagta hai". Poori chaurai (512 dots, pehle 256), lambai hadd 270 dots
//   (~3.8 cm, pehle 320): pehle beech ka hissa (upar / neeche se kul 20% tak) kaat-te hain, phir bhi lambi ho to chaurai kam. Saaf karne ke liye:
//   har pixel ka asal average (pehle pixel chhor kar), 1–99% contrast, thori roshni (gamma — thermal gehra chhapta hai), tez kinare (unsharp),
//   aur Atkinson dithering (thermal par Floyd-Steinberg se saaf — safed jagah safed, dhabbe kam).
function photoRaster(dataUrl, width = 512, maxH = 270, opt = {}) {
  const m = String(dataUrl || '').match(/^data:image\/jpe?g;base64,(.+)$/i); if (!m) return '';
  let img; try { img = decode(Buffer.from(m[1], 'base64'), { useTArray: true, formatAsRGBA: true, maxResolutionInMP: 30, maxMemoryUsageInMB: 256 }); } catch { return ''; }
  const sw = img.width, sh = img.height; if (!sw || !sh) return '';
  const r8 = v => Math.max(8, Math.floor(v / 8) * 8), crop = Math.max(0, Math.min(0.5, opt.crop == null ? 0.2 : Number(opt.crop) || 0));
  let W = r8(Math.min(512, Number(width) || 512)), sy0 = 0, sh2 = sh, H = Math.round(sh * W / sw);
  if (H > maxH) {
    const rows = Math.max(maxH * sw / W, sh * (1 - crop));            // beech ka hissa — zyada se zyada `crop` kaato
    sy0 = Math.max(0, Math.round((sh - rows) / 2)); sh2 = Math.min(sh - sy0, Math.round(rows));
    H = Math.round(sh2 * W / sw);
    if (H > maxH) { H = maxH; W = r8(sw * H / sh2); }
  }
  // asal average (har pixel) + grey
  const g = new Float32Array(W * H), D = img.data;
  for (let y = 0; y < H; y++) {
    const y0 = sy0 + Math.floor(y * sh2 / H), y1 = Math.max(y0 + 1, sy0 + Math.floor((y + 1) * sh2 / H));
    for (let x = 0; x < W; x++) {
      const x0 = Math.floor(x * sw / W), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sw / W));
      let s = 0, n = 0;
      for (let yy = y0; yy < y1; yy++) { let i = (yy * sw + x0) * 4; for (let xx = x0; xx < x1; xx++, i += 4) { s += 0.299 * D[i] + 0.587 * D[i + 1] + 0.114 * D[i + 2]; n++; } }
      g[y * W + x] = s / n;
    }
  }
  // contrast khincho (1% - 99%) + thori roshni (gamma 0.85)
  const hist = new Array(256).fill(0); for (const v of g) hist[Math.max(0, Math.min(255, v | 0))]++;
  let lo = 0, hi = 255, acc = 0; for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc > g.length * 0.01) { lo = i; break; } } acc = 0; for (let i = 255; i >= 0; i--) { acc += hist[i]; if (acc > g.length * 0.01) { hi = i; break; } }
  const span = Math.max(1, hi - lo), gam = opt.gamma || 0.85;
  for (let i = 0; i < g.length; i++) { const v = Math.max(0, Math.min(1, (g[i] - lo) / span)); g[i] = 255 * Math.pow(v, gam); }
  // tez kinare (unsharp mask 3x3)
  const amt = opt.sharp == null ? 0.8 : Number(opt.sharp) || 0;
  if (amt > 0 && W > 2 && H > 2) {
    const b = new Float32Array(g.length);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let s = 0, n = 0; for (let dy = -1; dy <= 1; dy++) { const yy = y + dy; if (yy < 0 || yy >= H) continue; for (let dx = -1; dx <= 1; dx++) { const xx = x + dx; if (xx < 0 || xx >= W) continue; s += g[yy * W + xx]; n++; } } b[y * W + x] = s / n; }
    for (let i = 0; i < g.length; i++) g[i] = Math.max(0, Math.min(255, g[i] + amt * (g[i] - b[i])));
  }
  // Atkinson dithering (6/8 ghalti aage — thermal par saaf)
  const bytesW = W / 8, out = Buffer.alloc(bytesW * H);
  const add = (x, y, e) => { if (x >= 0 && x < W && y < H) g[y * W + x] += e; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, old = g[i], nv = old < 128 ? 0 : 255, e = (old - nv) / 8;
    if (nv === 0) out[y * bytesW + (x >> 3)] |= 0x80 >> (x & 7);
    add(x + 1, y, e); add(x + 2, y, e); add(x - 1, y + 1, e); add(x, y + 1, e); add(x + 1, y + 1, e); add(x, y + 2, e);
  }
  const hdr = Buffer.from([0x1b, 0x61, 0x01, 0x1d, 0x76, 0x30, 0x00, bytesW & 0xff, bytesW >> 8, H & 0xff, H >> 8]);   // beech mein + GS v 0
  return Buffer.concat([hdr, out, Buffer.from([0x0a, 0x1b, 0x61, 0x00])]).toString('latin1');
}
module.exports = { photoRaster };
