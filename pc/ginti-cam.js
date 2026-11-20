// =========================================================
//  ginti-cam.js  v1.0 (2026-11-20) — 📦 LOADING GINTI: godam ke darwaze ka camera nag (carton / bori / crate) ginta hai jo LAKEER paar karein
//  Malik (20 Nov): "lakeer wala software install kar do · camera baad mein lagega · sab ek saath — ginti + note milan + bina note alarm +
//                  Gemini naam + reply se seekhna".
//  Raasta (server PC — wahi jahan bill-clip.js recording karta hai; NVR par KOI naya rabta nahi):
//    ① bill-clip ki apni recording clip-rec\ch<N>\s-YYYYMMDD-HHMMSS.mp4 (1-1 min) — sirf BAND hua tukra (is liye ginti 1-2 min peeche)
//       Camera = ⚙️ Camera setup ka counter ya ＋ mazeed camera (billClip.xc) — ⏺ Rec ON hona zaroori (warna tukre hi nahi).
//    ② ffmpeg (bill-clip ka clip-mods) har tukra `fps` (3-5) tasveer fi second 512px → harkat na ho to model nahi chalta (CPU bachao)
//    ③ YOLOE (ginti-model.onnx, open-vocabulary: cardboard box · sack · crate · person) — onnxruntime-node (apna folder ginti-mods,
//       pehli dafa khud npm) — AI NAHI (internet nahi, PC par hi). Tracker (markaz + raftar) → nag ne lakeer paar ki = ⬆ bahar / ⬇ andar.
//    ④ 90 s ke andar ki ginti = ek WAQIA → gintiEv/<cam>-<waqt> {out, in, xs}. Milan (AI NAHI): usi godam ka transfer note (posTransfers:
//       from = godam → bahar · to = godam → andar) ya gate pass (gatePass: gs mein godam) ±win min (default 20) → gintiDoc/<tn|gp>-<id>-<b>
//       {ec ctn, ek khule, out, in, st ok | kam | zyada | wait}. Note bana magar camera ne kuch nahi dekha = 📹 0 (kam) — app mein.
//    ⑤ Bahar gaya maal + koi note / gate pass nahi (win min tak) = 🚨 BINA NOTE → 4 tasveeron ka collage (laal dabba = nag) +
//       🤖 Gemini (blueAccess/aiConfig key — log / Firestore mein KABHI nahi) top-3 andaza → dhoond.mjs smartFind se POS item → waOut SIRF malik
//       (waParchi prFrom[0]) · roz ki hadd alMax · dukan ka waqt hrs. Malik usi paigham par REPLY: 1 / 2 / 3 / item ka naam / 0 = ghalat alarm
//       (wa-out → gintiEv.rep) → yahan item → lab + "✅ yaad kar liya" → agli dafa Gemini ko yeh misaal (tasveer + naam) saath (few-shot).
//  Setting: blueAccess/gintiCam {on, onAt, cams:[{n, b, bn, ln:[x1,y1,x2,y2] 0-1000, out ±1, al, on}], fps, hrs, win, alMax, snapReq, snapCam}
//           (sirf malik, app 📦 Loading ginti ⚙️). Haal: blueAccess/gintiPc. Lakeer ki tasveer: blueAccess/gintiSnap-<ck>.
//  Gahak / kisi aur number ko KABHI kuch nahi. POS mein KUCH nahi likhti. Process ki command line / NVR password kabhi log nahi.
//  Chalana: ginti-cam-auto.bat (doctor, sirf server). Log: ginti-cam-log.txt · Lock 47846.
// =========================================================
const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const { spawn, exec } = require('child_process');
const { pathToFileURL } = require('url');

const VER = '1.0';
const DIR = __dirname, BUSINESS_ID = 'noor-traders', LOCK_PORT = 47846;
const MODS = path.join(DIR, 'ginti-mods'), CLIP_MODS = path.join(DIR, 'clip-mods'), REC = path.join(DIR, 'clip-rec'), TMP = path.join(DIR, 'ginti-tmp');
const MODEL = path.join(DIR, 'ginti-model.onnx'), STATE = path.join(DIR, 'ginti-state.json');
const ORT_PKG = 'onnxruntime-node@1.20.1';
const IMG = 512, NAMES = ['cardboard box', 'sack', 'crate', 'person'];
const GOODS = new Set((process.env.GINTI_TEST_CLS || '0,1,2').split(',').map(Number));   // test mein person bhi (3)
const T_WIN = Number(process.env.GINTI_TEST_WINMS) || 0;   // sirf test (asal PC par khali)
const GAP = T_WIN ? 2000 : 90000, LAG = T_WIN ? 1000 : 3 * 60000, GRACE = T_WIN ? 1000 : 60000;
const log = (...a) => console.log(`[${new Date().toLocaleTimeString()}]`, ...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const r3 = n => Math.round(Number(n) * 1000) / 1000;
const pad2 = n => String(n).padStart(2, '0');
const dayOf = t => { const d = new Date(t); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
const hm = t => { const d = new Date(t); let h = d.getHours(); const ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12; return `${h}:${pad2(d.getMinutes())} ${ap}`; };
const ckOf = n => String(n || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'cam';

// ---------- 🧠 model: tayyari (tasveer → 512 ka dabba) + nateeja (dabbe) ----------
// frame: RGB (tw × th × 3) → Float32 [1,3,512,512] beech mein (letterbox, 114 bhara)
function prep(rgb, tw, th, out) {
  const N = IMG * IMG, px = (IMG - tw) >> 1, py = (IMG - th) >> 1;
  out = out || new Float32Array(3 * N); out.fill(114 / 255);
  for (let y = 0; y < th; y++) {
    let si = y * tw * 3, di = (y + py) * IMG + px;
    for (let x = 0; x < tw; x++, si += 3, di++) { out[di] = rgb[si] / 255; out[N + di] = rgb[si + 1] / 255; out[2 * N + di] = rgb[si + 2] / 255; }
  }
  return { data: out, px, py };
}
const iou = (a, b) => { const x1 = Math.max(a.x - a.w / 2, b.x - b.w / 2), y1 = Math.max(a.y - a.h / 2, b.y - b.h / 2), x2 = Math.min(a.x + a.w / 2, b.x + b.w / 2), y2 = Math.min(a.y + a.h / 2, b.y + b.h / 2), i = Math.max(0, x2 - x1) * Math.max(0, y2 - y1); return i / (a.w * a.h + b.w * b.h - i + 1e-9); };
// out0: [1, 4+nc+32, N] → dabbe 0-1000 (asal tasveer ke) — maal ki qismein ek doosre ko dabati hain (ek cheez = ek dabba), insaan alag
function post(out0, dims, tw, th, px, py, thr = 0.3) {
  const C = dims[1], N = dims[2], nc = NAMES.length, D = out0, cand = [];
  for (let i = 0; i < N; i++) {
    let best = -1, s = 0; for (let c = 0; c < nc && 4 + c < C; c++) { const v = D[(4 + c) * N + i]; if (v > s) { s = v; best = c; } }
    if (best < 0 || s < (best === 3 ? Math.max(thr, 0.4) : thr)) continue;
    const cx = D[i], cy = D[N + i], w = D[2 * N + i], h = D[3 * N + i];
    cand.push({ c: best, s, x: (cx - px) / tw * 1000, y: (cy - py) / th * 1000, w: w / tw * 1000, h: h / th * 1000 });
  }
  cand.sort((a, b) => b.s - a.s);
  const keep = [];
  for (const d of cand) { const g = GOODS.has(d.c); if (keep.some(k => GOODS.has(k.c) === g && iou(k, d) > 0.5)) continue; keep.push(d); if (keep.length >= 60) break; }
  return keep.filter(d => d.w > 4 && d.h > 4);
}

// ---------- ➖ lakeer + tracker ----------
function lineOf(cam) { const l = Array.isArray(cam.ln) && cam.ln.length === 4 ? cam.ln.map(Number) : null; if (!l || l.some(v => !isFinite(v))) return null; const dx = l[2] - l[0], dy = l[3] - l[1], L = Math.hypot(dx, dy); return L < 30 ? null : { x1: l[0], y1: l[1], dx, dy, L, out: Number(cam.out) === -1 ? -1 : 1 }; }
const sideOf = (ln, x, y) => (ln.dx * (y - ln.y1) - ln.dy * (x - ln.x1)) / ln.L;   // + / − (0-1000 ki ikai)
const projOf = (ln, x, y) => ((x - ln.x1) * ln.dx + (y - ln.y1) * ln.dy) / (ln.L * ln.L);   // 0..1 = lakeer ke andar
class Tracker {
  constructor(ln) { this.ln = ln; this.T = []; this.id = 0; this.M = 22; }
  // dets (sirf maal) + waqt → paar karne wale [{t, dir: +1 bahar / −1 andar, box}]
  step(dets, t) {
    const ln = this.ln, out = [], used = new Set();
    for (const k of this.T) { const dt = Math.min(1.5, (t - k.t) / 1000); k.px = k.x + k.vx * dt; k.py = k.y + k.vy * dt; }
    const pairs = [];
    this.T.forEach((k, ti) => dets.forEach((d, di) => { const sz = Math.max(60, k.w, k.h, d.w, d.h), c = Math.hypot(k.px - d.x, k.py - d.y) / sz - iou(k, d) * 0.5; if (c < 1.4) pairs.push([c, ti, di]); }));
    pairs.sort((a, b) => a[0] - b[0]);
    const tUsed = new Set();
    for (const [, ti, di] of pairs) {
      if (tUsed.has(ti) || used.has(di)) continue; tUsed.add(ti); used.add(di);
      const k = this.T[ti], d = dets[di], dt = Math.max(0.05, (t - k.t) / 1000);
      k.vx = 0.5 * k.vx + 0.5 * (d.x - k.x) / dt; k.vy = 0.5 * k.vy + 0.5 * (d.y - k.y) / dt;
      Object.assign(k, { x: d.x, y: d.y, w: d.w, h: d.h, t, hits: k.hits + 1 });
      const s = sideOf(ln, d.x, d.y), sd = s > this.M ? 1 : s < -this.M ? -1 : 0;
      if (sd && k.sd && sd !== k.sd && k.hits >= 2) {
        const p = projOf(ln, d.x, d.y), pp = projOf(ln, k.lx, k.ly);
        if ((p > -0.12 && p < 1.12) || (pp > -0.12 && pp < 1.12)) out.push({ t, dir: sd === ln.out ? 1 : -1, box: [Math.round(d.x), Math.round(d.y), Math.round(d.w), Math.round(d.h)], id: k.id });
      }
      if (sd) { k.sd = sd; k.lx = d.x; k.ly = d.y; }
    }
    dets.forEach((d, di) => { if (used.has(di)) return; const s = sideOf(ln, d.x, d.y); this.T.push({ id: ++this.id, x: d.x, y: d.y, w: d.w, h: d.h, vx: 0, vy: 0, t, hits: 1, sd: s > this.M ? 1 : s < -this.M ? -1 : 0, lx: d.x, ly: d.y }); });
    this.T = this.T.filter(k => t - k.t <= 1600).slice(-80);
    return out;
  }
  busy() { return this.T.length > 0; }
}

// ---------- 🎞 recording ke tukre (bill-clip.js jaisa naqsha) ----------
const recDir = ch => path.join(REC, 'ch' + ch);
function segList(ch, now = Date.now()) {
  let names = []; try { names = fs.readdirSync(recDir(ch)).filter(f => /^s-\d{8}-\d{6}\.mp4$/.test(f)).sort(); } catch { return []; }
  const out = names.map(f => { const m = f.match(/^s-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/); return { f: path.join(recDir(ch), f), t0: new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime(), t1: 0, done: false }; });
  for (let i = 0; i < out.length; i++) {
    const nx = out[i + 1];
    if (nx) { out[i].t1 = Math.min(nx.t0, out[i].t0 + 75000); out[i].done = now - nx.t0 > 15000; }
    else { let mt = 0; try { mt = fs.statSync(out[i].f).mtimeMs; } catch {} out[i].t1 = Math.min(Math.max(mt, out[i].t0 + 1000), out[i].t0 + 75000); out[i].done = now - mt > 90000; }   // recording ruki = aakhri tukra bhi band
  }
  return out;
}
function ffPath() { if (process.env.GINTI_FF) return process.env.GINTI_FF; try { const p = require(require.resolve('ffmpeg-static', { paths: [CLIP_MODS] })); if (p && fs.existsSync(p)) return p; } catch {} return ''; }
const lowPri = pid => { try { os.setPriority(pid, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch {} };
function ffRun(args, ms = 60000) {   // [code, stderr]
  return new Promise(res => {
    const ff = ffPath(); if (!ff) return res([-1, 'ffmpeg nahi']);
    let er = '', p; try { p = spawn(ff, args, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] }); } catch (e) { return res([-1, e.message]); }
    lowPri(p.pid); const t = setTimeout(() => { try { p.kill(); } catch {} }, ms);
    p.stderr.on('data', d => { if (er.length < 6000) er += d; }); p.on('error', e => { clearTimeout(t); res([-1, e.message]); }); p.on('close', c => { clearTimeout(t); res([c, er]); });
  });
}
const SIZE = new Map();   // ch → {w, h}
async function sizeOf(ch, f) {
  const s = SIZE.get(ch); if (s && Date.now() - s.at < 3600000) return s;
  const [, er] = await ffRun(['-hide_banner', '-nostdin', '-i', f], 20000);
  const m = String(er).match(/Video:[^\n]*?,\s(\d{2,5})x(\d{2,5})/); if (!m) return null;
  const v = { w: +m[1], h: +m[2], at: Date.now() }; SIZE.set(ch, v); return v;
}
// tukre ki har tasveer (fps) → onFrame(rgb, i) (async, ek waqt ek)
function decode(f, fps, tw, th, onFrame) {
  return new Promise(res => {
    const ff = ffPath(); if (!ff) return res({ ok: false, err: 'ffmpeg nahi' });
    const FB = tw * th * 3; let p, buf = Buffer.alloc(0), i = 0, q = Promise.resolve(), er = '', paused = false;
    try { p = spawn(ff, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-threads', '1', '-i', f, '-an', '-vf', `fps=${fps},scale=${tw}:${th}`, '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1'], { windowsHide: true }); } catch (e) { return res({ ok: false, err: e.message }); }
    lowPri(p.pid); const kill = setTimeout(() => { try { p.kill(); } catch {} }, 5 * 60000);
    p.stderr.on('data', d => { if (er.length < 2000) er += d; });
    p.stdout.on('data', d => {
      buf = buf.length ? Buffer.concat([buf, d]) : d;
      while (buf.length >= FB) { const fr = Buffer.from(buf.subarray(0, FB)); buf = buf.subarray(FB); const k = i++; q = q.then(() => onFrame(fr, k)).catch(e => log('⚠️ frame: ' + e.message)); }
      if (!paused && i > 8) { paused = true; p.stdout.pause(); q.then(() => { paused = false; try { p.stdout.resume(); } catch {} }); }   // model peeche = ffmpeg ruke (memory na bhare)
    });
    p.on('error', e => { clearTimeout(kill); res({ ok: false, err: e.message }); });
    p.on('close', c => { clearTimeout(kill); q.then(() => res({ ok: c === 0 || i > 0, n: i, err: c ? String(er).split(/\r?\n/)[0].slice(0, 120) : '' })); });
  });
}
// harkat: chhoti gray tasveer ka farq (0-255)
function tiny(rgb, tw, th) { const W = 48, H = Math.max(8, Math.round(48 * th / tw)), g = new Uint8Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const si = ((Math.floor(y * th / H) * tw) + Math.floor(x * tw / W)) * 3; g[y * W + x] = (rgb[si] * 3 + rgb[si + 1] * 6 + rgb[si + 2]) / 10; } return g; }
const diffOf = (a, b) => { if (!a || !b || a.length !== b.length) return 255; let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; };

// ---------- 📦 onnxruntime (apna folder) ----------
let ORT = null, SESS = null, sessMt = 0, npmAt = 0, npmBusy = false, MODS_ST = '';
function ort() {
  if (ORT) return ORT;
  try { ORT = require(require.resolve('onnxruntime-node', { paths: [MODS] })); MODS_ST = 'ok'; return ORT; } catch {}
  if (!npmBusy && Date.now() - npmAt > 30 * 60000) {
    npmBusy = true; npmAt = Date.now(); MODS_ST = 'install ho raha hai (pehli dafa 2-5 min)';
    try { fs.mkdirSync(MODS, { recursive: true }); const pj = path.join(MODS, 'package.json'); if (!fs.existsSync(pj)) fs.writeFileSync(pj, JSON.stringify({ name: 'ginti-mods', private: true, description: 'ginti-cam.js ka model chalane wala (onnxruntime) — alag folder' }, null, 1)); } catch {}
    log('📦 onnxruntime install ho raha hai — pehli dafa 2-5 min…');
    exec(`npm install ${ORT_PKG} --onnxruntime-node-install-cuda=skip --no-audit --no-fund --loglevel=error`, { cwd: MODS, windowsHide: true, timeout: 15 * 60000, maxBuffer: 8 << 20 }, er => {
      npmBusy = false;
      if (er) { log('✕ npm onnxruntime: ' + String(er.message).split(/\r?\n/)[0].slice(0, 160)); MODS_ST = '✕ install nahi hua — PC log (ginti-cam-log.txt)'; }
      else { log('📦 onnxruntime aa gaya'); MODS_ST = 'ok'; }
    });
  }
  return null;
}
async function session() {
  const O = ort(); if (!O) return null;
  let mt = 0; try { mt = fs.statSync(MODEL).mtimeMs; } catch { return null; }
  if (SESS && mt === sessMt) return SESS;
  try { SESS = await O.InferenceSession.create(MODEL, { intraOpNumThreads: 2, interOpNumThreads: 1, graphOptimizationLevel: 'all', executionMode: 'sequential' }); sessMt = mt; log('🧠 model tayyar'); return SESS; }
  catch (e) { log('✕ model: ' + e.message); SESS = null; return null; }
}
let TENSOR_BUF = null;
async function detect(sess, rgb, tw, th, thr) {
  const p = prep(rgb, tw, th, TENSOR_BUF); TENSOR_BUF = p.data;
  const r = await sess.run({ [sess.inputNames[0]]: new ORT.Tensor('float32', p.data, [1, 3, IMG, IMG]) });
  const o = r[sess.outputNames[0]];
  return post(o.data, o.dims, tw, th, p.px, p.py, thr);
}

// ---------- 🧮 note milan (AI NAHI) ----------
// nag ka andaza: carton wala = poore ctn (bacha = 1 khula) · pcs wala poora number = utne nag · kg / adhoora = 1 khula
function nagOf(lines) {
  let c = 0, k = 0;
  for (const l of lines || []) {
    const q = Number(l.q) || 0, pk = Number(l.pk) || 0; if (q <= 0) continue;
    if (pk > 1) { c += Math.floor(q / pk + 1e-9); if (q % pk > 1e-6) k++; }
    else if (Math.abs(q - Math.round(q)) < 1e-6 && q <= 500) c += Math.round(q); else k++;
  }
  return { c, k };
}
function verdict(d, now = Date.now(), winMs = 20 * 60000) {
  if (d.x) return 'x';
  if (now < d.t + winMs + LAG) return 'wait';
  const n = d.dirn === 'in' ? Math.max(0, (d.in || 0) - (d.out || 0)) : Math.max(0, (d.out || 0) - (d.in || 0));
  return n < d.ec ? 'kam' : n > d.ec + d.ek ? 'zyada' : 'ok';
}
// waqia → behtareen note (same godam, sahi taraf, ±win) | null
function bestDoc(ev, docs, winMs) {
  const dirn = ev.out > ev.in ? 'out' : ev.in > ev.out ? 'in' : ''; if (!dirn) return null;
  let best = null, bd = Infinity;
  for (const d of docs) {
    if (d.x || d.b !== ev.b || d.dirn !== dirn) continue;
    const dd = Math.min(Math.abs(ev.t0 - d.t), Math.abs(ev.t1 - d.t), ...(d.t2 ? [Math.abs(ev.t0 - d.t2)] : []));
    if (dd <= winMs && dd < bd) { bd = dd; best = d; }
  }
  return best;
}

module.exports = { prep, post, iou, Tracker, lineOf, sideOf, nagOf, verdict, bestDoc, segList, decode, sizeOf, ort, session, detect, tiny, diffOf, VER, main };
if (require.main === module) main();

// =========================================================
function main() {
  const srv = net.createServer().on('error', () => { log('ginti-cam pehle se chal raha hai — yeh band'); process.exit(3); });
  srv.listen(LOCK_PORT, '127.0.0.1');
  const ZINDA = (() => { try { return require('./zinda.js')(__filename, {}); } catch (e) { const f = path.join(DIR, 'ginti-cam.alive'), w = () => { try { fs.writeFileSync(f, String(Date.now())); } catch {} }; w(); setInterval(w, 30000).unref(); return { beat: w, guard: fn => fn }; } })();
  lowPri(process.pid);
  const { initializeApp, cert, getApps } = require('firebase-admin/app');
  const { getFirestore, FieldValue } = require('firebase-admin/firestore');
  if (!getApps().length) initializeApp({ credential: cert(require(path.join(DIR, 'firebase-key.json'))) });
  const db = getFirestore(), biz = db.collection('businesses').doc(BUSINESS_ID), BA = biz.collection('blueAccess');
  const EV = biz.collection('gintiEv'), DOC = biz.collection('gintiDoc'), OUT = biz.collection('waOut');
  let PN = null; try { PN = require('./pc-names.js'); PN.start(biz); } catch {}
  log(`ginti-cam v${VER} shuru (${os.hostname()})`);

  // ---------- setting ----------
  let CF = { on: false, onAt: 0, cams: [], fps: 3, hrs: '09:00-21:30', win: 20, alMax: 20, snapReq: 0, snapCam: '' };
  let BC = { ch: {}, xc: [] }, AI = { key: '', model: '' }, MALIK = '', BR = {};
  const cfApply = d => {
    d = d || {};
    const cams = (Array.isArray(d.cams) ? d.cams : []).map(c => ({ n: String((c && c.n) || '').trim().slice(0, 30), b: Math.floor(Number(c && c.b) || 0), bn: String((c && c.bn) || '').slice(0, 30), ln: Array.isArray(c && c.ln) ? c.ln.slice(0, 4).map(v => Math.max(0, Math.min(1000, Number(v) || 0))) : null, out: Number(c && c.out) === -1 ? -1 : 1, al: c && c.al === false ? 0 : 1, on: c && c.on === false ? 0 : 1 })).filter(c => c.n).slice(0, 8);
    CF = { on: !!d.on, onAt: Number(d.onAt) || 0, cams, fps: Math.max(2, Math.min(6, Math.round(Number(d.fps) || 3))), hrs: /^\d{1,2}:\d{2}-\d{1,2}:\d{2}$/.test(String(d.hrs || '')) ? String(d.hrs) : '09:00-21:30', win: Math.max(5, Math.min(90, Number(d.win) || 20)), alMax: Math.max(0, Math.min(100, d.alMax == null ? 20 : Number(d.alMax) || 0)), snapReq: Number(d.snapReq) || 0, snapCam: String(d.snapCam || '') };
  };
  BA.doc('gintiCam').onSnapshot(s => { cfApply(s.exists ? s.data() : null); kick(); }, e => log('⚠️ setting: ' + e.message));
  BA.doc('billClip').onSnapshot(s => { const d = (s.exists && s.data()) || {}; BC = { ch: d.ch && typeof d.ch === 'object' ? { ...d.ch } : {}, xc: (Array.isArray(d.xc) ? d.xc : []).map(x => ({ n: String((x && x.n) || '').trim(), ch: Math.floor(Number(x && x.ch) || 0), r: x && x.r ? 1 : 0 })).filter(x => x.n && x.ch > 0) }; }, e => log('⚠️ camera setting: ' + e.message));   // sirf channel — password yahan kabhi nahi chhua
  BA.doc('aiConfig').onSnapshot(s => { const d = (s.exists && s.data()) || {}; AI = { key: String(d.key || ''), model: String(d.model || '') }; }, () => {});
  BA.doc('waParchi').onSnapshot(s => { const d = (s.exists && s.data()) || {}; const p = Array.isArray(d.prFrom) ? d.prFrom[0] : d.prFrom; MALIK = String(p || '').replace(/\D/g, ''); }, () => {});
  biz.collection('posStock').where('meta', '==', true).get().then(q => { q.forEach(d => { const x = d.data() || {}, b = Number(x.branch ?? (String(d.id).match(/^b(\d+)-/) || [])[1]); if (b && x.name) BR[b] = String(x.name).slice(0, 30); }); }).catch(() => {});
  const camCh = n => { const x = BC.xc.find(c => c.n === n) || BC.xc.find(c => c.n.toLowerCase() === String(n).toLowerCase()); if (x) return { ch: x.ch, rec: x.r }; let ch = 0; try { ch = PN ? PN.chFind(BC.ch, n) : Number(BC.ch[n]) || 0; } catch {} return { ch, rec: ch ? 1 : 0 }; };
  const inHrs = t => { const [a, b] = CF.hrs.split('-').map(s => s.split(':').map(Number)), d = new Date(t), m = d.getHours() * 60 + d.getMinutes(), A = a[0] * 60 + a[1], B = b[0] * 60 + b[1]; return A <= B ? m >= A && m <= B : m >= A || m <= B; };

  // ---------- haal (local) ----------
  let S = { doneT: {}, al: { day: '', n: 0 } }; try { S = { ...S, ...JSON.parse(fs.readFileSync(STATE, 'utf8')) }; } catch {}
  const saveS = () => { try { fs.writeFileSync(STATE, JSON.stringify(S)); } catch {} };
  const ST = { err: '', cams: {} };

  // ---------- notes (posTransfers + gatePass) + waqiat + milan ----------
  const TN = new Map(), GPS = new Map(), EVS = new Map(), DOCS = new Map(); let unsub = [], curDay = '';
  const listen = () => {
    const today = dayOf(Date.now()); if (today === curDay && unsub.length) return; curDay = today; unsub.forEach(u => { try { u(); } catch {} }); unsub = []; TN.clear(); GPS.clear(); EVS.clear(); DOCS.clear();
    const u0 = new Date(Date.now() - 86400000).toISOString().slice(0, 10), u1 = new Date().toISOString().slice(0, 10);
    unsub.push(biz.collection('posTransfers').where('day', 'in', [...new Set([u0, u1])]).onSnapshot(q => { q.docChanges().forEach(c => { if (c.type === 'removed') TN.delete(c.doc.id); else TN.set(c.doc.id, c.doc.data() || {}); }); kick(); }, e => log('⚠️ transfer notes: ' + e.message)));
    unsub.push(biz.collection('gatePass').where('day', '==', today).onSnapshot(q => { q.docChanges().forEach(c => { if (c.type === 'removed') GPS.delete(c.doc.id); else GPS.set(c.doc.id, c.doc.data() || {}); }); kick(); }, e => log('⚠️ gate pass: ' + e.message)));
    unsub.push(EV.where('day', '==', today).onSnapshot(q => { q.docChanges().forEach(c => { if (c.type === 'removed') EVS.delete(c.doc.id); else { EVS.set(c.doc.id, c.doc.data() || {}); onEv(c.doc.id, c.doc.data() || {}); } }); }, e => log('⚠️ gintiEv: ' + e.message)));
    unsub.push(DOC.where('day', '==', today).onSnapshot(q => { q.docChanges().forEach(c => { if (c.type === 'removed') DOCS.delete(c.doc.id); else DOCS.set(c.doc.id, c.doc.data() || {}); }); }, e => log('⚠️ gintiDoc: ' + e.message)));
  };
  // notes jo dekhne wale godam ke hain → gintiDoc ki shakal
  function noteDocs() {
    const B = new Set(CF.cams.filter(c => c.on && c.b).map(c => c.b)), out = [], from = CF.onAt || 0;
    for (const [id, x] of TN) {
      const t = Number(x.createdOn) || Number(x.at) || 0; if (!t || t < from - 3600000) continue;
      const L = (Array.isArray(x.lines) ? x.lines : []).map(l => ({ q: Number(l.qty) || 0, pk: Number(l.pack) || 0 })), g = nagOf(L), no = String(x.transferNo || id);
      if (B.has(Number(x.from))) out.push({ key: `tn-${id}-${x.from}`, k: 'tn', id, no, b: Number(x.from), dirn: 'out', t, t2: 0, ec: g.c, ek: g.k, p: BR[x.to] || ('Branch ' + x.to), x: x.cancelled ? 1 : 0 });
      if (B.has(Number(x.to)) && Number(x.to) !== Number(x.from)) out.push({ key: `tn-${id}-${x.to}`, k: 'tn', id, no, b: Number(x.to), dirn: 'in', t, t2: 0, ec: g.c, ek: g.k, p: BR[x.from] || ('Branch ' + x.from), x: x.cancelled ? 1 : 0 });
    }
    for (const [id, x] of GPS) {
      const gs = (Array.isArray(x.gs) ? x.gs : []).map(Number), t = Number(x.pt) || Number(x.tm) || 0; if (!t || t < from - 3600000) continue;
      for (const b of gs) { if (!B.has(b)) continue; const g = nagOf((Array.isArray(x.l) ? x.l : []).filter(l => Number(l.g) === b).map(l => ({ q: l.q, pk: l.pk })));
        out.push({ key: `gp-${id}-${b}`, k: 'gp', id, no: String(x.no || id), b, dirn: 'out', t, t2: Number(x.tm) || 0, ec: g.c, ek: g.k, p: String(x.p || '').slice(0, 40), x: x.off ? 1 : 0 }); }
    }
    return out;
  }
  let milanBusy = false;
  async function milan() {
    if (milanBusy || !CF.on) return; milanBusy = true;
    try {
      listen(); const now = Date.now(), winMs = T_WIN || CF.win * 60000, nd = noteDocs(), batch = db.batch(); let n = 0;
      const ndMap = new Map(nd.map(d => [d.key, d]));
      // waqiat → note
      for (const [id, e] of EVS) {
        if (!['wait', 'bina'].includes(e.st) || e.cam == null) continue;
        const d = bestDoc({ b: e.b, t0: e.t0, t1: e.t1, out: e.out || 0, in: e.in || 0 }, nd, winMs);
        if (d) { batch.set(EV.doc(id), { st: e.st === 'bina' ? 'late' : 'doc', ref: d.key, refNo: `${d.k === 'tn' ? 'TN' : 'Gate pass'} #${d.no}`, at: now }, { merge: true }); e.st = 'doc'; e.ref = d.key; n++; continue; }
        if (e.st !== 'wait') continue;
        if (now - e.t1 > winMs + GRACE) {
          if (!(e.out > e.in)) { batch.set(EV.doc(id), { st: e.out === e.in ? 'zero' : 'in', at: now }, { merge: true }); e.st = 'in'; n++; }
          else { e.st = 'bina'; batch.set(EV.doc(id), { st: 'bina', at: now }, { merge: true }); n++; alarmQ.push(id); }
        }
      }
      // notes ka hisaab (waqiat jo un se jure)
      const sums = new Map(); for (const [id, e] of EVS) if (e.ref && ['doc', 'late'].includes(e.st)) { const s = sums.get(e.ref) || { out: 0, in: 0, ev: {} }; s.out += e.out || 0; s.in += e.in || 0; s.ev[id] = [e.out || 0, e.in || 0]; sums.set(e.ref, s); }
      for (const d of nd) {
        if (d.t < now - 6 * 3600000 && !DOCS.has(d.key)) continue;
        const s = sums.get(d.key) || { out: 0, in: 0, ev: {} }, cam = CF.cams.find(c => c.b === d.b), old = DOCS.get(d.key) || null;
        const doc = { k: d.k, id: String(d.id), no: d.no, b: d.b, bn: (cam && cam.bn) || BR[d.b] || '', cam: cam ? cam.n : '', dirn: d.dirn, t: d.t, day: dayOf(d.t), ec: d.ec, ek: d.ek, p: d.p, x: d.x, out: s.out, in: s.in, ev: s.ev };
        doc.st = verdict(doc, now, winMs);
        const sig = JSON.stringify([doc.ec, doc.ek, doc.out, doc.in, doc.st, doc.x, Object.keys(doc.ev).sort()]);
        if (old && old.sig === sig) continue;
        batch.set(DOC.doc(d.key), { ...doc, ev: JSON.stringify(doc.ev), sig, at: now }, { merge: true }); DOCS.set(d.key, { ...doc, sig }); n++;
        if (n >= 400) break;
      }
      if (n) await batch.commit();
      if (alarmQ.length) alarms().catch(e => log('⚠️ alarm: ' + e.message));
    } catch (e) { log('⚠️ milan: ' + e.message); ST.err = 'milan: ' + String(e.message).slice(0, 100); }
    finally { milanBusy = false; }
  }

  // ---------- 🚨 bina note alarm (collage + Gemini + WhatsApp malik) ----------
  const alarmQ = []; let alBusy = false;
  async function alarms() {
    if (alBusy) return; alBusy = true;
    try {
      while (alarmQ.length) {
        const id = alarmQ.shift(), e = EVS.get(id); if (!e || e.im || e.alSent) continue;
        const cam = CF.cams.find(c => c.n === e.cam); const today = dayOf(Date.now()); if (S.al.day !== today) S.al = { day: today, n: 0 };
        const why = !cam ? 'camera setting mein nahi' : !cam.al ? 'is camera ka alarm band' : !MALIK ? 'malik ka number nahi (WhatsApp setting)' : S.al.n >= CF.alMax ? `aaj ki hadd (${CF.alMax}) poori` : '';
        const img = await collage(e).catch(er => { log('⚠️ collage: ' + er.message); return null; });
        let ai = [], what = ''; if (img && AI.key) { const g = await aiGuess(img, e).catch(er => { log('⚠️ AI: ' + er.message); return null; }); if (g) { ai = g.list; what = g.what; } }
        const up = { ...(img ? { im: img } : {}), ai, what, alWhy: why, at: Date.now() };
        if (!why) {
          S.al.n++; saveS();
          const txt = `🚨 *Bina note maal nikla*\n📹 ${e.cam}${cam && cam.bn ? ' (' + cam.bn + ')' : ''} · ${hm(e.t0)}\n📦 ${e.out - e.in} nag bahar gaye — koi transfer note / gate pass nahi mila (±${CF.win} min)` +
            (ai.length ? `\n🤖 AI andaza${what ? ' (' + what + ')' : ''}:\n${ai.map((a, i) => `${i + 1}) ${a.n}`).join('\n')}` : '') + `\n\n↩ Isi paigham par reply: ${ai.length ? '1 / 2 / 3 ya ' : ''}item ka naam · 0 = ghalat alarm`;
          const wid = `gi-${id}`.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
          try { await OUT.doc(wid).create({ st: 'new', at: Date.now(), to: MALIK, nm: 'Malik', kind: 'gi', eid: wid, ev: id, txt, ...(img ? { im: img } : {}) }); up.alSent = Date.now(); log(`🚨 bina note — ${e.cam} ${hm(e.t0)} · ${e.out - e.in} nag`); }
          catch (er) { if (!/exists/i.test(er.message)) up.alWhy = 'WhatsApp line: ' + er.message.slice(0, 80); }
        } else log(`🚨 bina note (paigham nahi: ${why}) — ${e.cam} ${hm(e.t0)}`);
        await EV.doc(id).set(up, { merge: true }); Object.assign(e, up);
      }
    } finally { alBusy = false; }
  }
  function segAt(ch, t) { return segList(ch).find(s => t >= s.t0 - 500 && t < s.t1 + 500) || null; }
  async function collage(e) {
    const { ch } = camCh(e.cam); if (!ch) return null;
    let xs = []; try { xs = JSON.parse(e.xs || '[]'); } catch {}
    const first = xs.find(x => x[1] === 1) || xs[0] || [e.t0, 1, null], t0 = first[0], box = first[2];
    const times = xs.filter(x => x[1] === 1).length >= 4 ? xs.filter(x => x[1] === 1).slice(0, 4).map(x => [x[0], x[2]]) : [-1200, 0, 600, 1400].map(d => [t0 + d, d ? null : box]);
    fs.mkdirSync(TMP, { recursive: true }); const tag = Date.now().toString(36), parts = [];
    for (let i = 0; i < times.length; i++) {
      const [t, b] = times[i], s = segAt(ch, t); if (!s) continue; const o = path.join(TMP, `c-${tag}-${i}.jpg`);
      const db_ = Array.isArray(b) && b.length === 4 ? `,drawbox=x=iw*${r3((b[0] - b[2] / 2) / 1000)}:y=ih*${r3((b[1] - b[3] / 2) / 1000)}:w=iw*${r3(b[2] / 1000)}:h=ih*${r3(b[3] / 1000)}:color=red@0.9:t=4` : '';
      await ffRun(['-hide_banner', '-loglevel', 'error', '-nostdin', '-ss', String(Math.max(0, (t - s.t0) / 1000)), '-i', s.f, '-frames:v', '1', '-vf', `scale=480:-2${db_}`, '-q:v', '5', '-y', o], 30000);
      if (fs.existsSync(o)) parts.push(o);
    }
    if (!parts.length) return null;
    const out = path.join(TMP, `c-${tag}.jpg`);
    if (parts.length === 1) fs.copyFileSync(parts[0], out);
    else { const n = parts.length >= 4 ? 4 : 2, L = n === 4 ? '0_0|w0_0|0_h0|w0_h0' : '0_0|w0_0';
      await ffRun(['-hide_banner', '-loglevel', 'error', '-nostdin', ...parts.slice(0, n).flatMap(p => ['-i', p]), '-filter_complex', `xstack=inputs=${n}:layout=${L}`, '-q:v', '6', '-y', out], 30000); }
    let b = null; try { b = fs.readFileSync(out); } catch {}
    for (const f of [...parts, out]) { try { fs.unlinkSync(f); } catch {} }
    return b && b.length > 1500 && b.length < 700000 ? b : null;
  }
  // ---------- 🤖 Gemini (sirf bina note ki tasveer par) ----------
  const DEAD = new Set(); let GOOD = '';
  async function models() {
    try { const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': AI.key } }); const j = await r.json().catch(() => ({})); if (!r.ok) return [];
      const names = (j.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent')).map(m => String(m.name || '').replace(/^models\//, '')).filter(n => /flash/.test(n) && !/(lite|tts|image|live|audio|embedding|preview|exp)/.test(n));
      const ver = n => Number((String(n).match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || 0); return names.sort((a, b) => ver(b) - ver(a)); } catch { return []; }
  }
  async function gemini(parts) {
    const tryOne = async mdl => {
      const ac = new AbortController(), t = setTimeout(() => ac.abort(), 45000);
      try { const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(mdl) + ':generateContent', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': AI.key }, signal: ac.signal, body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { temperature: 0, responseMimeType: 'application/json' } }) });
        const j = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(Error('AI ' + r.status), { code: r.status });
        const c = j.candidates && j.candidates[0]; return ((c && c.content && c.content.parts) || []).filter(p => !p.thought).map(p => p.text || '').join(''); }
      finally { clearTimeout(t); }
    };
    const list = [...new Set([AI.model, GOOD].filter(Boolean))].filter(m => !DEAD.has(m));
    for (const m of list) { try { const o = await tryOne(m); GOOD = m; return o; } catch (e) { if (e.code === 404) DEAD.add(m); if (e.code === 401 || e.code === 403) throw Error('AI key ghalat / band'); } }
    for (const m of (await models()).slice(0, 3)) { if (DEAD.has(m) || list.includes(m)) continue; try { const o = await tryOne(m); GOOD = m; return o; } catch (e) { if (e.code === 404) DEAD.add(m); } }
    throw Error('AI model nahi chala');
  }
  // POS items (dukan b1) — 30 min cache + dhoond.mjs smartFind (AI NAHI)
  let CAT = { at: 0, items: [] }, DH = null;
  async function catalog() {
    if (CAT.items.length && Date.now() - CAT.at < 30 * 60000) return CAT.items;
    try { const s = await biz.collection('posStock').where('branch', '==', 1).get(), items = []; for (const d of s.docs) { const x = d.data() || {}; if (x.meta || !Array.isArray(x.items)) continue; for (const it of x.items) if (it && it.id != null && it.name) items.push({ id: String(it.id), name: String(it.name) }); } CAT = { at: Date.now(), items }; } catch (e) { log('⚠️ items: ' + e.message); }
    return CAT.items;
  }
  async function findItem(q) { if (!String(q || '').trim()) return []; try { DH = DH || await import(pathToFileURL(path.join(DIR, 'dhoond.mjs')).href); const L = await catalog(), r = DH.smartFind(L, q, it => it.name, it => it.id, 5); return [...r.hits, ...r.near].slice(0, 3); } catch (e) { log('⚠️ dhoond: ' + e.message); return []; } }
  const LEARN = [];   // [{id (ev), cam, lab: {id, n}, at}] — malik ke bataye hue (tasveer gintiEv.im mein)
  async function learnLoad() { try { const q = await EV.where('lk', '==', 1).limit(60).get(); q.forEach(d => { const x = d.data() || {}; if (x.lab && x.lab.id) LEARN.push({ id: d.id, cam: x.cam, lab: x.lab, at: Number(x.labAt) || 0 }); }); LEARN.sort((a, b) => b.at - a.at); log(`🧠 ${LEARN.length} misaalein yaad`); } catch (e) { log('⚠️ misaalein: ' + e.message); } }
  async function aiGuess(img, e) {
    const ex = [], seen = new Set();
    for (const l of LEARN) { if (ex.length >= 3) break; if (seen.has(l.lab.id) || l.id === e.id) continue; try { const d = await EV.doc(l.id).get(), im = d.exists && d.data().im; if (!im) continue; const b = Buffer.isBuffer(im) ? im : Buffer.from(im.toUint8Array ? im.toUint8Array() : im); seen.add(l.lab.id); ex.push({ b, n: l.lab.n }); } catch {} }
    const parts = [];
    for (const x of ex) parts.push({ text: `MISAAL (malik ne bataya): is tasveer mein "${x.n}" hai.` }, { inline_data: { mime_type: 'image/jpeg', data: x.b.toString('base64') } });
    parts.push({ text: 'Neeche 4 CCTV tasveerein hain — Pakistan ki kiryana wholesale dukan ke godam ka darwaza. Laal dabba = jo maal utha kar bahar le jaya ja raha hai (carton / bori / crate). ' +
      'Batao yeh kaun sa item hai: brand + cheez + size (carton / bori par jo likha / rang / shakal). Upar misaalein hon to un se milao. ' +
      'Sirf JSON: {"items":[{"name":"<brand cheez size, English/Roman>","sure":0.0-1.0}],"what":"<chhota Roman Urdu: kya cheez, kitne nag>"} — 3 tak andaze, behtareen pehle. Na samjho to shakal se (jaise "ghee ka carton", "atta ki bori").' },
    { inline_data: { mime_type: 'image/jpeg', data: img.toString('base64') } });
    const txt = await gemini(parts); let j = null; try { j = JSON.parse(String(txt).replace(/^```(?:json)?|```$/g, '').trim()); } catch { j = null; }
    const out = [], ids = new Set();
    for (const g of ((j && Array.isArray(j.items)) ? j.items : []).slice(0, 4)) { const nm = String((g && g.name) || '').slice(0, 60); if (!nm) continue; const h = await findItem(nm); const it = h.find(x => !ids.has(x.id)); if (it) { ids.add(it.id); out.push({ id: it.id, n: it.name.slice(0, 60), g: nm }); } else out.push({ id: '', n: nm, g: nm }); if (out.length >= 3) break; }
    return { list: out, what: j && j.what ? String(j.what).slice(0, 120) : '' };
  }
  // ---------- ↩ malik ka jawab (wa-out → gintiEv.rep) / app ka label ----------
  const repDone = new Set();
  function onEv(id, x) {
    if (x.lab && x.lab.id && x.lk === 1 && !LEARN.some(l => l.id === id)) { LEARN.unshift({ id, cam: x.cam, lab: x.lab, at: Number(x.labAt) || Date.now() }); LEARN.splice(80); }
    const r = x.rep; if (!r || !r.tx || repDone.has(id + ':' + r.at) || Number(x.repAt || 0) >= Number(r.at || 0)) return;
    repDone.add(id + ':' + r.at); onRep(id, x, r).catch(e => log('⚠️ jawab: ' + e.message));
  }
  async function onRep(id, x, r) {
    const tx = String(r.tx).trim().slice(0, 60), ai = Array.isArray(x.ai) ? x.ai : []; let lab = null, ok = 0, say = '';
    if (/^0$|^(ghalat|galat|nahi|no)\b/i.test(tx)) { lab = { id: '', n: 'Ghalat alarm' }; ok = 1; say = '✅ Theek — yeh ghalat alarm likh diya.'; }
    else if (/^[1-3]$/.test(tx) && ai[+tx - 1]) { const a = ai[+tx - 1]; lab = { id: String(a.id || ''), n: String(a.n || '') }; }
    else { const h = await findItem(tx); lab = h[0] ? { id: h[0].id, n: h[0].name.slice(0, 60) } : { id: '', n: tx }; }
    if (!say) say = lab.id ? `✅ Yaad kar liya: *${lab.n}* — agli dafa AI isay pehchane ga.` : `✅ Likh diya: "${lab.n}" (POS mein yeh naam nahi mila — app mein 📦 Loading ginti se item chun sakte hain).`;
    await EV.doc(id).set({ lab, lk: lab.id ? 1 : 0, ok, labBy: 'WhatsApp', labAt: Date.now(), repAt: Number(r.at) || Date.now() }, { merge: true });
    if (MALIK) { const wid = `gr-${id}-${Number(r.at) || Date.now()}`.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 90); try { await OUT.doc(wid).create({ st: 'new', at: Date.now(), to: MALIK, nm: 'Malik', kind: 'gi', eid: wid, txt: say }); } catch {} }
    log(`↩ jawab: ${x.cam} ${hm(x.t0)} → ${lab.n}`);
  }

  // ---------- 🎞 tukre ka kaam ----------
  const TR = new Map(), PREV = new Map(), GRP = new Map(), NOISE = new Map();   // ck → Tracker / pichhli chhoti tasveer / khula waqia / camera ki apni jhilmil
  async function flushGroup(cam, force, now) {
    const ck = ckOf(cam.n), g = GRP.get(ck); if (!g) return;
    if (!force && now - g.t1 < GAP) return; GRP.delete(ck);
    const id = `${ck}-${g.t0}`, d = { cam: cam.n, ck, b: cam.b, bn: cam.bn || BR[cam.b] || '', day: dayOf(g.t0), t0: g.t0, t1: g.t1, out: g.out, in: g.in, xs: JSON.stringify(g.xs.slice(0, 60)), st: 'wait', at: Date.now(), v: VER };
    try { await EV.doc(id).set(d, { merge: true }); EVS.set(id, { ...d }); log(`📦 ${cam.n} ${hm(g.t0)} — ⬆ ${g.out} · ⬇ ${g.in}`); } catch (e) { log('⚠️ waqia: ' + e.message); }
  }
  async function doSeg(cam, ch, seg) {
    const sess = await session(); if (!sess) return { wait: !fs.existsSync(MODEL) ? 'model file abhi nahi aayi (doctor la raha hai)' : 'model / onnxruntime tayyar nahi — ' + (MODS_ST || '…') };
    const sz = await sizeOf(ch, seg.f); if (!sz) return { skip: 'tukra parha nahi gaya' };
    const tw = sz.w >= sz.h ? IMG : Math.round(IMG * sz.w / sz.h / 2) * 2, th = sz.w >= sz.h ? Math.round(IMG * sz.h / sz.w / 2) * 2 : IMG;
    const ck = ckOf(cam.n), ln = lineOf(cam); if (!ln) return { skip: 'lakeer nahi lagi' };
    let tr = TR.get(ck); if (!tr || tr.ln.x1 !== ln.x1 || tr.ln.dx !== ln.dx || tr.ln.out !== ln.out || (tr.last && seg.t0 - tr.last > 10000)) { tr = new Tracker(ln); TR.set(ck, tr); }
    const fps = CF.fps, t0 = Date.now(); let inf = 0, ms = 0, lastInf = 0;
    const r = await decode(seg.f, fps, tw, th, async (rgb, i) => {
      const t = seg.t0 + Math.round(i * 1000 / fps), g = tiny(rgb, tw, th), mv = diffOf(PREV.get(ck), g); PREV.set(ck, g);
      const base = NOISE.has(ck) ? NOISE.get(ck) : mv, thr = Math.max(2.2, base * 1.5 + 1);   // raat / sasta camera = jhilmil zyada → had bhi upar
      if (mv < thr && !tr.busy() && t - lastInf < 4000) { NOISE.set(ck, 0.95 * base + 0.05 * Math.min(mv, 40)); return; }   // harkat nahi = model nahi
      lastInf = t; const a = Date.now(), dets = (await detect(sess, rgb, tw, th, 0.3)).filter(d => GOODS.has(d.c)); ms += Date.now() - a; inf++;
      if (!dets.length && !tr.busy()) NOISE.set(ck, 0.9 * base + 0.1 * Math.min(mv, 40));
      for (const x of tr.step(dets, t)) {
        let g2 = GRP.get(ck); if (g2 && t - g2.t1 > GAP) { await flushGroup(cam, true, t); g2 = null; }
        if (!g2) { g2 = { t0: t, t1: t, out: 0, in: 0, xs: [] }; GRP.set(ck, g2); }
        g2.t1 = t; if (x.dir > 0) g2.out++; else g2.in++; g2.xs.push([t, x.dir, x.box]);
      }
    });
    tr.last = seg.t1; await flushGroup(cam, false, seg.t1);
    const took = Date.now() - t0, c = ST.cams[ck] = ST.cams[ck] || {}; Object.assign(c, { n: cam.n, ch, segs: (c.segs || 0) + 1, inf: (c.inf || 0) + inf, ms: inf ? Math.round(ms / inf) : (c.ms || 0), took, sz: `${sz.w}x${sz.h}` });
    if (!r.ok) return { skip: r.err || 'decode nahi hua' };
    return { ok: 1, n: r.n, inf, took };
  }
  let busy = false, busyAt = 0;
  async function tick() {
    if (busy) { if (Date.now() - busyAt > 8 * 60000) { log('⚠️ tukre ka kaam 8 min se atka — script dobara'); process.exit(4); } return; }
    busy = true; busyAt = Date.now();
    try {
      if (!CF.on) return;
      listen(); const now = Date.now();
      for (const cam of CF.cams) {
        const ck = ckOf(cam.n), c = ST.cams[ck] = ST.cams[ck] || { n: cam.n }; if (!cam.on) { c.st = 'band'; continue; }
        const { ch, rec } = camCh(cam.n); c.ch = ch; if (!ch) { c.st = '✕ camera setting mein channel nahi'; continue; }
        if (!rec) { c.st = '⏺ recording band — ⚙️ Camera setup mein ⏺ Rec ON karein'; continue; }
        if (!lineOf(cam)) { c.st = '➖ lakeer nahi lagi (app ⚙️)'; continue; }
        const segs = segList(ch, now).filter(s => s.done);
        if (!segs.length) { c.st = '⏳ recording ke tukre nahi mile'; continue; }
        let done = Number(S.doneT[ck]) || 0; if (!done || now - done > 60 * 60000) done = Math.max(now - 4 * 60000, CF.onAt || 0);   // pehli dafa / 1 ghante se peeche = taza se
        const todo = segs.filter(s => s.t0 > done).slice(0, 3);
        for (const s of todo) {
          busyAt = Date.now();
          if (!inHrs(s.t0)) { S.doneT[ck] = s.t0; continue; }
          const r = await doSeg(cam, ch, s);
          if (r.wait) { c.st = '⏳ ' + r.wait; break; }
          S.doneT[ck] = s.t0; c.st = r.skip ? '⚠️ ' + r.skip : 'ok'; c.last = s.t1; c.lag = Math.round((Date.now() - s.t1) / 1000);
        }
        saveS();
        const g = GRP.get(ck); if (g && now - g.t1 > GAP + 120000) await flushGroup(cam, true, now);   // recording ruk gayi = khula waqia band
      }
      await milan(); await snaps();
    } catch (e) { log('⚠️ tick: ' + e.message); ST.err = String(e.message).slice(0, 140); }
    finally { busy = false; pushSt(); }
  }
  // ---------- 📸 lakeer lagane ke liye tasveer (app ne maangi) ----------
  let snapAt = 0;
  async function snaps() {
    if (!CF.snapReq || CF.snapReq <= snapAt || Date.now() - CF.snapReq > 10 * 60000) return; snapAt = CF.snapReq;
    const cams = CF.snapCam ? [{ n: CF.snapCam }] : CF.cams;
    for (const cam of cams.slice(0, 8)) {
      const { ch } = camCh(cam.n), ck = ckOf(cam.n); if (!ch) { await BA.doc('gintiSnap-' + ck).set({ n: cam.n, err: 'camera setting mein channel nahi', at: Date.now() }, { merge: true }); continue; }
      const s = segList(ch).filter(x => x.done).slice(-1)[0]; if (!s) { await BA.doc('gintiSnap-' + ck).set({ n: cam.n, err: 'recording ke tukre nahi (⏺ Rec ON?)', at: Date.now() }, { merge: true }); continue; }
      fs.mkdirSync(TMP, { recursive: true }); const o = path.join(TMP, `snap-${ck}.jpg`); try { fs.unlinkSync(o); } catch {}
      await ffRun(['-hide_banner', '-loglevel', 'error', '-nostdin', '-ss', '20', '-i', s.f, '-frames:v', '1', '-vf', 'scale=640:-2', '-q:v', '5', '-y', o], 30000);
      let b = null; try { b = fs.readFileSync(o); } catch {}
      await BA.doc('gintiSnap-' + ck).set(b && b.length > 1500 ? { n: cam.n, im: b, at: Date.now(), t: s.t0, err: '' } : { n: cam.n, err: 'tasveer nahi bani', at: Date.now() }, { merge: true });
      log(`📸 lakeer ki tasveer — ${cam.n}`);
    }
  }
  // ---------- haal ----------
  let stSig = '', stAt = 0;
  function pushSt() {
    const today = dayOf(Date.now()), cams = {};
    for (const [ck, c] of Object.entries(ST.cams)) if (CF.cams.some(x => ckOf(x.n) === ck)) cams[ck] = { n: c.n, ch: c.ch || 0, st: String(c.st || '').slice(0, 120), lag: c.lag || 0, ms: c.ms || 0, took: c.took || 0, sz: c.sz || '', last: c.last || 0 };
    let o = 0, i = 0, b = 0; for (const e of EVS.values()) { o += e.out || 0; i += e.in || 0; if (e.st === 'bina') b++; }
    const d = { v: VER, host: os.hostname(), on: CF.on ? 1 : 0, mods: MODS_ST || (ORT ? 'ok' : ''), model: fs.existsSync(MODEL) ? 1 : 0, err: ST.err, cams, today: { day: today, out: o, in: i, bina: b, al: S.al.day === today ? S.al.n : 0 }, fps: CF.fps };
    const sig = JSON.stringify(d); if (sig === stSig && Date.now() - stAt < 5 * 60000) return; stSig = sig; stAt = Date.now();
    BA.doc('gintiPc').set({ ...d, at: Date.now() }).catch(e => log('⚠️ haal: ' + e.message));
  }
  let kT = null; function kick() { clearTimeout(kT); kT = setTimeout(() => { milan().then(snaps).catch(() => {}); }, 1500); }

  learnLoad();
  setTimeout(() => { ort(); }, 5000);
  setInterval(ZINDA.guard ? ZINDA.guard(tick, 10 * 60000, 'tick') : tick, 15000);
  setTimeout(tick, 8000);
  // purani tmp files
  setInterval(() => { try { for (const f of fs.readdirSync(TMP)) { const p = path.join(TMP, f); if (Date.now() - fs.statSync(p).mtimeMs > 3600000) fs.unlinkSync(p); } } catch {} }, 30 * 60000);
}
