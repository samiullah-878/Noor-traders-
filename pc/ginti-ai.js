// =========================================================
//  ginti-ai.js  v1.0 (2026-11-22) — 📦 Loading ginti ke naye model ka hisaab (ginti-cam.js isay require karta hai — sirf functions, apni service nahi)
//  Malik (21 Nov): "sab model lagao godam wale cameras mein · HD kar do" — 🧍 pose (banda kuch utha kar le ja raha) + 🙂 chehra (kaun tha).
//   🧍 POSE  : YOLO26n-pose (ginti-pose.onnx, Ultralytics — 512, 17 jor COCO) → carryOf(): kandhe / sar par (haath kandhe se upar) ya saamne
//              dono haath kamar se upar paas paas, ya maal ka dabba jism ke upar wale hisse par = "uthaya" (2D andaza — pakka nahi, app mein "shak").
//   🙂 CHEHRA: YuNet (ginti-face-det.onnx, MIT, opencv_zoo) — pose ke sar wale nuqton se HD tasveer ka tukra → chehra + 5 nuqte →
//              seedha (112×112, ArcFace wale nuqte) → SFace (ginti-face-id.onnx, Apache 2.0, opencv_zoo) 128 number → cosine ≥ 0.40 = wohi banda.
//   Sab PC par (onnxruntime-node) — internet / Gemini NAHI. Hisaab OpenCV (FaceDetectorYN / FaceRecognizerSF) jaisa — sandbox mein milaya.
// =========================================================
'use strict';
const POSE_SIZE = 512, FD = 640, FS = 112;
const REF = [[38.2946, 51.6963], [73.5318, 51.5014], [56.0252, 71.7366], [41.5493, 92.3655], [70.7299, 92.2041]];   // SFace / ArcFace (right eye, left eye, nose, mouth R, mouth L)
const iou = (a, b) => { const x1 = Math.max(a.x - a.w / 2, b.x - b.w / 2), y1 = Math.max(a.y - a.h / 2, b.y - b.h / 2), x2 = Math.min(a.x + a.w / 2, b.x + b.w / 2), y2 = Math.min(a.y + a.h / 2, b.y + b.h / 2), i = Math.max(0, x2 - x1) * Math.max(0, y2 - y1); return i / (a.w * a.h + b.w * b.h - i + 1e-9); };

// RGB (sw × sh) → RGB (dw × dh), bilinear — HD frame se YOLO ki 512 wali tasveer
function resizeRGB(src, sw, sh, dw, dh, out) {
  out = out && out.length === dw * dh * 3 ? out : new Uint8Array(dw * dh * 3);
  const fx = sw / dw, fy = sh / dh;
  for (let y = 0; y < dh; y++) {
    const syf = Math.max(0, (y + 0.5) * fy - 0.5), y0 = Math.min(sh - 1, Math.floor(syf)), y1 = Math.min(sh - 1, y0 + 1), wy = syf - y0;
    for (let x = 0; x < dw; x++) {
      const sxf = Math.max(0, (x + 0.5) * fx - 0.5), x0 = Math.min(sw - 1, Math.floor(sxf)), x1 = Math.min(sw - 1, x0 + 1), wx = sxf - x0;
      const a = (y0 * sw + x0) * 3, b = (y0 * sw + x1) * 3, c = (y1 * sw + x0) * 3, d = (y1 * sw + x1) * 3, o = (y * dw + x) * 3;
      for (let k = 0; k < 3; k++) out[o + k] = (src[a + k] * (1 - wx) + src[b + k] * wx) * (1 - wy) + (src[c + k] * (1 - wx) + src[d + k] * wx) * wy + 0.5;
    }
  }
  return out;
}

// ---------- 🧍 pose ----------
// out0 [1, 56, N]: cx cy w h conf + 17 × (x y conf) — sab 512 wali tasveer ke pixel → 0-1000 (asal tasveer ke, ginti-cam jaisa)
function posePost(D, dims, tw, th, px, py, thr = 0.45) {
  const N = dims[2], cand = [];
  for (let i = 0; i < N; i++) {
    const s = D[4 * N + i]; if (s < thr) continue;
    const kp = []; for (let k = 0; k < 17; k++) { const b = (5 + k * 3) * N + i; kp.push([(D[b] - px) / tw * 1000, (D[b + N] - py) / th * 1000, D[b + 2 * N]]); }
    cand.push({ s, x: (D[i] - px) / tw * 1000, y: (D[N + i] - py) / th * 1000, w: D[2 * N + i] / tw * 1000, h: D[3 * N + i] / th * 1000, kp });
  }
  cand.sort((a, b) => b.s - a.s);
  const keep = []; for (const d of cand) { if (keep.some(k => iou(k, d) > 0.5)) continue; keep.push(d); if (keep.length >= 20) break; }
  return keep.filter(d => d.w > 8 && d.h > 15);
}
// "uthaya" (1) / nahi (0) — goods = ginti-cam ke maal ke dabbe (0-1000)
function carryOf(p, goods) {
  const K = p.kp, ok = i => K[i] && K[i][2] > 0.35, y = i => K[i][1];
  for (const g of goods || []) {   // maal ka dabba jism ke upar wale 70% hisse par / saath
    const top = p.y - p.h / 2, inX = g.x > p.x - p.w * 0.75 && g.x < p.x + p.w * 0.75, inY = g.y > top - p.h * 0.15 && g.y < top + p.h * 0.7;
    if (inX && inY && g.w < p.w * 2.5) return 1;
  }
  const sh = [5, 6].filter(ok), wr = [9, 10].filter(ok), hp = [11, 12].filter(ok);
  if (!sh.length || !wr.length) return 0;
  const shY = sh.reduce((a, i) => a + y(i), 0) / sh.length;
  if (wr.some(i => y(i) < shY - 0.02 * p.h)) return 1;   // haath kandhe se upar = bori kandhe / sar par
  if (!hp.length || wr.length < 2) return 0;
  const hpY = hp.reduce((a, i) => a + y(i), 0) / hp.length, torso = hpY - shY; if (torso < 15) return 0;
  const wrY = Math.max(y(9), y(10)), wx = Math.abs(K[9][0] - K[10][0]), shW = sh.length === 2 ? Math.abs(K[5][0] - K[6][0]) : p.w * 0.4;
  const bent = [[7, 9], [8, 10]].every(([e, w]) => ok(e) && y(w) < y(e) + 0.1 * torso);   // kalai kohni ke barabar / upar = bazu mude (khali haath neeche latakte hain)
  return bent && wrY < hpY - 0.18 * torso && wx < Math.max(1.4 * shW, 25) ? 1 : 0;   // dono haath kamar se upar, mude, paas paas = saamne kuch utha rakha
}

// ---------- 🙂 chehra ----------
// pose ke sar wale nuqte (naak / aankh / kaan) → HD tasveer (W × H) mein chaukor tukra {x, y, s} — chehra camera ki taraf na ho = null
function headBox(p, W, H) {
  const K = p.kp, okk = i => K[i] && K[i][2] > 0.4;
  if (!(okk(0) || (okk(1) && okk(2)))) return null;
  const pts = [0, 1, 2, 3, 4].filter(okk).map(i => [K[i][0] * W / 1000, K[i][1] * H / 1000]); if (pts.length < 3) return null;
  const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const span = Math.max(Math.max(...xs) - Math.min(...xs), p.w * W / 1000 * 0.25, 14), S = Math.round(span * 2.6);
  return { x: Math.round(cx - S / 2), y: Math.round(cy - S * 0.45), s: S };
}
// HD RGB ka tukra (x, y, s chaukor) → YuNet input Float32 [1,3,640,640] BGR 0-255 (OpenCV jaisa, bahar = 0)
function cropBGR(src, W, H, bx, by, bs, out) {
  out = out || new Float32Array(3 * FD * FD); const N = FD * FD, f = bs / FD;
  for (let y = 0; y < FD; y++) {
    const syf = by + (y + 0.5) * f - 0.5, y0 = Math.floor(syf), wy = syf - y0;
    for (let x = 0; x < FD; x++) {
      const sxf = bx + (x + 0.5) * f - 0.5, x0 = Math.floor(sxf), wx = sxf - x0, o = y * FD + x;
      let r = 0, g = 0, b = 0;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const yy = y0 + dy, xx = x0 + dx; if (yy < 0 || yy >= H || xx < 0 || xx >= W) continue;
        const w = (dx ? wx : 1 - wx) * (dy ? wy : 1 - wy), i = (yy * W + xx) * 3; r += src[i] * w; g += src[i + 1] * w; b += src[i + 2] * w;
      }
      out[o] = b; out[N + o] = g; out[2 * N + o] = r;
    }
  }
  return out;
}
// YuNet ke 12 output (cls/obj/bbox/kps × 8/16/32) → chehre [{x1, y1, w, h, s, lm[10]}] 640 wali tasveer mein (OpenCV face_detect.cpp jaisa)
function yunetPost(O, thr = 0.6, size = FD) {
  const out = [];
  for (const st of [8, 16, 32]) {
    const cls = O['cls_' + st], obj = O['obj_' + st], bb = O['bbox_' + st], kp = O['kps_' + st]; if (!cls) continue;
    const cols = Math.floor(size / st), rows = Math.floor(size / st);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c, cs = Math.min(1, Math.max(0, cls[i])), os = Math.min(1, Math.max(0, obj[i])), s = Math.sqrt(cs * os); if (s < thr) continue;
      const cx = (c + bb[i * 4]) * st, cy = (r + bb[i * 4 + 1]) * st, w = Math.exp(bb[i * 4 + 2]) * st, h = Math.exp(bb[i * 4 + 3]) * st;
      const lm = []; for (let n = 0; n < 5; n++) lm.push((kp[i * 10 + 2 * n] + c) * st, (kp[i * 10 + 2 * n + 1] + r) * st);
      out.push({ x1: cx - w / 2, y1: cy - h / 2, w, h, s, lm, x: cx, y: cy });
    }
  }
  out.sort((a, b) => b.s - a.s);
  const keep = []; for (const f of out) { if (keep.some(k => iou(k, f) > 0.3)) continue; keep.push(f); if (keep.length >= 20) break; }
  return keep;
}
// 5 nuqte (src) → REF par seedha (least squares similarity = Umeyama) {a, b, tx, ty}: dst = [a −b; b a]·src + t
function simTf(P) {
  let mx = 0, my = 0, qx = 0, qy = 0; for (let i = 0; i < 5; i++) { mx += P[i][0]; my += P[i][1]; qx += REF[i][0]; qy += REF[i][1]; }
  mx /= 5; my /= 5; qx /= 5; qy /= 5;
  let sa = 0, sb = 0, ss = 0;
  for (let i = 0; i < 5; i++) { const px = P[i][0] - mx, py = P[i][1] - my, ux = REF[i][0] - qx, uy = REF[i][1] - qy; sa += px * ux + py * uy; sb += px * uy - py * ux; ss += px * px + py * py; }
  const a = sa / (ss || 1), b = sb / (ss || 1);
  return { a, b, tx: qx - (a * mx - b * my), ty: qy - (b * mx + a * my) };
}
// HD RGB + 5 nuqte (HD pixel) → 112×112 RGB (bilinear, bahar = 0)
function alignFace(src, W, H, lm) {
  const P = [0, 1, 2, 3, 4].map(i => [lm[2 * i], lm[2 * i + 1]]), T = simTf(P), det = T.a * T.a + T.b * T.b || 1;
  const ia = T.a / det, ib = -T.b / det, out = new Uint8Array(FS * FS * 3);   // ulta: src = R⁻¹ (dst − t)
  for (let v = 0; v < FS; v++) for (let u = 0; u < FS; u++) {
    const dx = u - T.tx, dy = v - T.ty, sx = ia * dx - ib * dy, sy = ib * dx + ia * dy;
    const x0 = Math.floor(sx), y0 = Math.floor(sy), wx = sx - x0, wy = sy - y0, o = (v * FS + u) * 3;
    for (let k = 0; k < 3; k++) {
      let acc = 0;
      for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) { const yy = y0 + ty, xx = x0 + tx; if (yy < 0 || yy >= H || xx < 0 || xx >= W) continue; acc += src[(yy * W + xx) * 3 + k] * (tx ? wx : 1 - wx) * (ty ? wy : 1 - wy); }
      out[o + k] = Math.max(0, Math.min(255, acc + 0.5));
    }
  }
  return out;
}
function sfaceTensor(rgb) { const N = FS * FS, t = new Float32Array(3 * N); for (let i = 0; i < N; i++) { t[i] = rgb[i * 3]; t[N + i] = rgb[i * 3 + 1]; t[2 * N + i] = rgb[i * 3 + 2]; } return t; }   // RGB 0-255 (OpenCV swapRB)
const unit = e => { let s = 0; for (let i = 0; i < e.length; i++) s += e[i] * e[i]; s = Math.sqrt(s) || 1; const o = new Float32Array(e.length); for (let i = 0; i < e.length; i++) o[i] = e[i] / s; return o; };
const cos = (a, b) => { let s = 0; const n = Math.min(a.length, b.length); for (let i = 0; i < n; i++) s += a[i] * b[i]; return s; };
async function embed(ORT, sId, rgb112) {
  const r = await sId.run({ [sId.inputNames[0]]: new ORT.Tensor('float32', sfaceTensor(rgb112), [1, 3, FS, FS]) });
  return unit(r[sId.outputNames[0]].data);
}
async function yunet(ORT, sDet, tensor, thr) {
  const r = await sDet.run({ [sDet.inputNames[0]]: new ORT.Tensor('float32', tensor, [1, 3, FD, FD]) }); const O = {};
  for (const k of Object.keys(r)) O[k] = r[k].data;
  return yunetPost(O, thr);
}
// HD tasveer + tukra (headBox) → {q, e, rgb (112), fw, s} | null — chehra 28 px se chhota = nahi (pehchan ghalat hoti)
let CROP = null;
async function faceIn(ORT, sDet, sId, src, W, H, box, minW = 28) {
  if (!box || box.s < 20) return null;
  CROP = cropBGR(src, W, H, box.x, box.y, box.s, CROP);
  const F = await yunet(ORT, sDet, CROP, 0.6), k = box.s / FD;
  const f = F.find(z => z.x > FD * 0.2 && z.x < FD * 0.8 && z.y > FD * 0.12 && z.y < FD * 0.85); if (!f) return null;
  const fw = f.w * k; if (fw < minW) return null;
  const lm = f.lm.map((v, i) => (i % 2 ? box.y : box.x) + v * k), rgb = alignFace(src, W, H, lm), e = await embed(ORT, sId, rgb);
  const eyeD = Math.hypot(lm[0] - lm[2], lm[1] - lm[3]), front = Math.min(1, eyeD / (fw * 0.38 || 1));   // aankhon ka faasla = seedha chehra
  return { q: Math.round(f.s * Math.min(1, fw / 72) * front * 1000) / 1000, e, rgb, fw: Math.round(fw), s: f.s };
}
// poori tasveer (larke ki photo) → sab se bara saaf chehra → {q, e, rgb, fw} | null
async function faceFromPhoto(ORT, sDet, sId, src, W, H) {
  const S = Math.max(W, H), bx = (W - S) / 2, by = (H - S) / 2;
  const F = await yunet(ORT, sDet, cropBGR(src, W, H, bx, by, S), 0.6), k = S / FD; if (!F.length) return null;
  const f = F.slice().sort((a, b) => Math.sqrt(b.w * b.h) * b.s * b.s - Math.sqrt(a.w * a.h) * a.s * a.s)[0], fw = f.w * k;
  const lm = f.lm.map((v, i) => (i % 2 ? by : bx) + v * k), rgb = alignFace(src, W, H, lm), e = await embed(ORT, sId, rgb);
  return { q: Math.round(f.s * Math.min(1, fw / 72) * 1000) / 1000, e, rgb, fw: Math.round(fw), s: f.s };
}
const e2s = e => Buffer.from(new Float32Array(e).buffer).toString('base64');
const s2e = s => { const b = Buffer.from(String(s || ''), 'base64'); return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length)); };

module.exports = { VER: '1.0', POSE_SIZE, FD, FS, REF, resizeRGB, posePost, carryOf, headBox, cropBGR, yunetPost, simTf, alignFace, sfaceTensor, unit, cos, embed, yunet, faceIn, faceFromPhoto, e2s, s2e };
