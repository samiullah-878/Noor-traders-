// =========================================================
//  photo-print.js  v1.0 (2026-10-12) — 📷 tasveer ko TM-T88IV (thermal) par chhapna — ESC/POS raster (GS v 0)
//  Malik: "samaan ki tasveer chhoti si aaye" — data:image/jpeg -> kaala-safed (Floyd-Steinberg) -> chhoti chaurai (default 256 dots = aadha kaghaz).
//  jpeg-decode.js (jpeg-js) se — koi npm install nahi. PNG / ghalat tasveer = '' (parchi tasveer ke baghair).
// =========================================================
const decode = require('./jpeg-decode.js');
function photoRaster(dataUrl, width = 256, maxH = 320) {
  const m = String(dataUrl || '').match(/^data:image\/jpe?g;base64,(.+)$/i); if (!m) return '';
  let img; try { img = decode(Buffer.from(m[1], 'base64'), { useTArray: true, formatAsRGBA: true, maxResolutionInMP: 30, maxMemoryUsageInMB: 256 }); } catch { return ''; }
  const sw = img.width, sh = img.height; if (!sw || !sh) return '';
  let W = Math.max(8, Math.min(512, Math.round(width / 8) * 8)), H = Math.round(sh * W / sw);
  if (H > maxH) { H = maxH; W = Math.max(8, Math.round((sw * H / sh) / 8) * 8); }
  // chhota karo (box average) + grey
  const g = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const x0 = Math.floor(x * sw / W), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sw / W)), y0 = Math.floor(y * sh / H), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sh / H));
    let s = 0, n = 0;
    for (let yy = y0; yy < y1; yy += 1 + ((y1 - y0) >> 3)) for (let xx = x0; xx < x1; xx += 1 + ((x1 - x0) >> 3)) { const i = (yy * sw + xx) * 4; s += 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2]; n++; }
    g[y * W + x] = s / n;
  }
  // contrast khincho (2% - 98%)
  const hist = new Array(256).fill(0); for (const v of g) hist[Math.max(0, Math.min(255, v | 0))]++;
  let lo = 0, hi = 255, acc = 0; for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc > g.length * 0.02) { lo = i; break; } } acc = 0; for (let i = 255; i >= 0; i--) { acc += hist[i]; if (acc > g.length * 0.02) { hi = i; break; } }
  const span = Math.max(1, hi - lo); for (let i = 0; i < g.length; i++) g[i] = Math.max(0, Math.min(255, (g[i] - lo) * 255 / span));
  // Floyd-Steinberg
  const bytesW = W / 8, out = Buffer.alloc(bytesW * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, old = g[i], nv = old < 128 ? 0 : 255, err = old - nv;
    if (nv === 0) out[y * bytesW + (x >> 3)] |= 0x80 >> (x & 7);
    if (x + 1 < W) g[i + 1] += err * 7 / 16;
    if (y + 1 < H) { if (x > 0) g[i + W - 1] += err * 3 / 16; g[i + W] += err * 5 / 16; if (x + 1 < W) g[i + W + 1] += err / 16; }
  }
  const hdr = Buffer.from([0x1b, 0x61, 0x01, 0x1d, 0x76, 0x30, 0x00, bytesW & 0xff, bytesW >> 8, H & 0xff, H >> 8]);   // beech mein + GS v 0
  return Buffer.concat([hdr, out, Buffer.from([0x0a, 0x1b, 0x61, 0x00])]).toString('latin1');
}
module.exports = { photoRaster };
