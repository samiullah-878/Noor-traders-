// =========================================================
//  live-cam.js  v2.2 (2026-11-23, malik ki screenshot: Sab cameras ke khanon par 'Abdurehman' / 'Bilal (server)' — bill / POS screen nahi aa rahi thi): khane ka naam ab counter ka AAJ ka naam
//    (PN.nowName — camera setting ki purani chaabi nahi), warna app posLive/<naam> ghalat naam se sunti thi.
//  v2.1 (2026-11-23, malik: 'speed tez ka rasta nikalo' — Sab cameras 10-20 s mein khulte the): ⚡ har recording wali line ke aakhri ~3.5 s yaad (ring, aakhri keyframe se)
//    + mosaic ke input ab TCP (127.0.0.1) — ffmpeg jis pal input khole usi pal yaad wala hissa mil jata hai (probe ka 1-2 s fi camera intezar nahi). Namoona test 6 camera:
//    20.7 s -> 0.6 s. Na chale (video na aaye) = khud purana UDP tareeqa (MO_FASTBAD). Mosaic 5 min garam (pehle 2). NVR par naya rabta nahi.
//  v2.0 (2026-11-23, malik: 'aik screen jis par sab cameras aik saath · godam wali par gate pass, bill wali par bill'): 🎛 liveReq pc '@sab' =
//    counter + godam + mazeed cameras EK video (9 tak: 7-9 = 3x3, khana 384x216, 6 fps); jawab mo {c, r, n, k:[c|g|x], g:[godam branch], tw, th} — app har khane par
//    bill (posLive) / gate pass (gatePass) khud dikhati hai (video par kuch nahi likha jata). Godam wala '@godam' pehle jaisa. Port 48920+ / 48930+.
//  v1.9 (2026-11-22, malik: 'live ma godam ka cameras akhetha chahie'): 🏬 liveReq pc '@godam' = sab godam cameras EK video (ffmpeg xstack:
//    2 = aamne saamne, 3-4 = 2x2, 5-6 = 3x2, khana 448x252, 8 fps) — kaun se: billClip.gc (gate pass godam camera) › gintiCam cams (📦 Loading ginti) ›
//    xc naam mein 'godam' (zyada se zyada 6). Har camera recording wali udp copy se (127.0.0.1 par apne port 48900+ ko aage — NVR par naya rabta NAHI),
//    recording band = RTSP seedha. Jawab mein mo {c, r, n:[naam]} — app har khane par naam + tap = wohi camera akela. Ek camera ruke = 15 s mein dobara.
//    Haal liveCamPc.mo = godam cameras ke naam (app chip). · v1.8 (2026-11-19: 📹 mazeed cameras — billClip.xc [{n, ch, r}] (counter ke ilawa, app ⚙️ Camera setup): live ka naam counter na ho to
//    xc se channel; recording (r) wale ki copy bhi udp se (bill-clip v2.10 bhejta), r band = RTSP seedha (pehle jaisa).) · v1.7 (2026-11-18: malik ki screenshot RN6QU6D — video grey / dhundli (tukre gum): recording ki line ki UDP aur RTP socket ka dabba 8 MB
//    (Windows ka chhota dabba = PC thora busy ho to tukre girte), ffmpeg `discardcorrupt` (gira hua tukra = grey dhabba nahi, pichhli saaf tasveer ruki
//    rahe jab tak naya keyframe), 🩺 liveReq.q {d: NVR→PC decode ghaltiyan, g: PC ke andar gire tukre, r: RTP gire, at} har 10 s (badle to) — app chip.)
//  v1.3 (2026-11-10: ⚡ malik: "time bohat zyada lag raha — on karte hi aana chahiye": ICE ka intezar 4 s → 1.2 s, har 1 s keyframe (g 12), dekhne wala jaye to camera 2 min GARAM (dobara / counter badalna = foran).)
//  v1.4 (2026-11-11: malik ki screenshot RN6QU6D 'Camera ch 4 … -138 — dobara koshish 1/3 (main stream)': recording ki line (udp copy) us pal nahi aa rahi thi → live foran RTSP par gayi (NVR doosra rabta nahi deta).
//    Ab pehle 10 s recording ki line ka intezar (bill-clip recording dobara shuru hoti hai), aur -138 par saaf wajah: us camera ki recording ka haal (billClipPc.rec) — khamosh / kacha error nahi.)
//  v1.2 (2026-11-10: 🔗 EK HI RABTA — malik ki screenshots: "error -138" / "NVR ne video nahi di": NVR ek camera par PC ko DOOSRA rabta nahi deta (pehla bill-clip ki recording ka).
//    Ab bill-clip v2.4 apni recording wali line ki copy PC ke andar udp 127.0.0.1:48500+ch par deta hai — live wahi leta hai (NVR par naya rabta NAHI); na mile to purana RTSP raasta.)
//  v1.1 (2026-11-10: 🩺 "Juda hai par video nahi" — asal wajah app ko (liveReq.warn: ffmpeg / NVR ki ghalti foran, 12 s koi packet nahi), sub-stream na chale to MAIN stream, liveReq.rtp = PC video bhej raha hai (phone na chala sake to app VP8 se dobara)) · v1.0 (2026-11-09) — 🔴 COUNTER CAMERA KI LIVE VIDEO app mein (WebRTC, seedha PC → phone)
//  Malik (9 Nov): "kya direct live nahi chal sakti, koi tareeqa nikalo · only live video wala chahiye".
//
//  Kaam (server PC, doctor chalata hai — live-cam-auto.bat):
//    • App (👀 Nigrani → ⋮ 🔴 Live) liveReq/<id> {pc: counter ka naam, offer: SDP, by, at, st 'new'} likhti hai.
//    • PC counter ka camera channel malik ki setting (blueAccess/billClip.ch — bill-clip wali, NVR password wahi) se leta hai
//      (app ko channel / password kabhi nahi milta) → ffmpeg (bill-clip ka ffmpeg-static, clip-mods\) NVR ki LIVE sub-stream
//      → 640 chaura, 12 fps, H.264 baseline (zerolatency) ya VP8 (phone jo maange) → RTP 127.0.0.1 → werift (apna folder live-mods\,
//      pure JS WebRTC) → answer SDP liveReq mein {ans, st 'ok'} → video SEEDHA PC se phone (Firestore se nahi guzarti, kharcha nahi).
//    • Ek camera ka EK ffmpeg — kai dekhne wale ho to wahi video sab ko. Dekhne wala na rahe (hb 45 s purana / st 'end' / rabta
//      toota) = band; 20 s koi na ho = ffmpeg bhi band. Ek waqt mein zyada se zyada 4 dekhne wale (dukan ka upload).
//    • NVR 401 = FORAN ruko (bill-clip v1.3 jaisa — ghalat koshishon se Dahua admin LOCK) jab tak setting na badle.
//    • Haal blueAccess/liveCamPc {at, ver, host, ok, err, v (dekhne wale), cams}.
//  POS mein KUCH nahi. AI NAHI. Lock 47844. Log: live-cam-log.txt.
// =========================================================
const path = require('path');
const fs = require('fs');
const net = require('net');
const os = require('os');
const dgram = require('dgram');
const { spawn, exec } = require('child_process');
const ZINDA = (() => { try { return require('./zinda.js')(__filename, {}); } catch (e) { const f = path.join(__dirname, path.basename(__filename, '.js') + '.alive'); setInterval(() => { try { fs.writeFileSync(f, String(Date.now())); } catch {} }, 30000); return { guard: fn => fn }; } })();
if (require.main !== module && process.env.LIVE_MO_TEST) { module.exports = { moGrid, moFilter }; return; }   // v1.9: sirf test (sandbox) — doctor kabhi require nahi karta
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const DIR = __dirname, BUSINESS_ID = 'noor-traders', LOCK_PORT = 47844, VER = '2.2';
const CLIP_MODS = path.join(DIR, 'clip-mods'), MODS = path.join(DIR, 'live-mods');
const WERIFT = 'werift@0.24.4';
const MAX_V = 4;
const STUN = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
if (!getApps().length) initializeApp({ credential: cert(require(path.join(DIR, 'firebase-key.json'))) });
const db = getFirestore(), biz = db.collection('businesses').doc(BUSINESS_ID), REQ = biz.collection('liveReq');
const log = (...a) => console.log(`[${new Date().toLocaleTimeString()}]`, ...a);

// ---------- werift (apna folder) + ffmpeg (bill-clip wala) ----------
let W = null, npmAt = 0, npmBusy = false;
function werift() {
  if (W) return W;
  try { W = require(require.resolve('werift', { paths: [MODS] })); return W; } catch {}
  if (!npmBusy && Date.now() - npmAt > 30 * 60000) {
    npmBusy = true; npmAt = Date.now();
    try { fs.mkdirSync(MODS, { recursive: true }); const pj = path.join(MODS, 'package.json'); if (!fs.existsSync(pj)) fs.writeFileSync(pj, JSON.stringify({ name: 'live-mods', private: true, description: 'live-cam.js ka WebRTC (werift) — alag folder' }, null, 1)); } catch {}
    log('📦 werift (WebRTC) install ho raha hai — pehli dafa 1-2 min…'); ST.err = 'WebRTC install ho raha hai (pehli dafa 1-2 min)'; pushSt(true);
    exec(`npm install ${WERIFT} --no-audit --no-fund --loglevel=error`, { cwd: MODS, windowsHide: true, timeout: 10 * 60000, maxBuffer: 8 << 20 }, er => {
      npmBusy = false;
      if (er) { log('✕ npm werift: ' + String(er.message).split(/\r?\n/)[0].slice(0, 160)); ST.err = 'WebRTC install nahi hua — PC log (live-cam-log.txt)'; }
      else { log('📦 werift aa gaya'); ST.err = ''; }
      pushSt(true);
    });
  }
  return null;
}
function ffPath() { try { const p = require(require.resolve('ffmpeg-static', { paths: [CLIP_MODS] })); if (p && fs.existsSync(p)) return p; } catch {} return ''; }

// ---------- setting (bill-clip wali — malik ⚙️) ----------
let CF = { on: false, kind: 'dahua', ip: '', port: 554, user: 'admin', pw: '', ch: {} }, cfSig = '', AUTHBAD = 0;
biz.collection('blueAccess').doc('billClip').onSnapshot(s => {
  const d = s.exists ? s.data() || {} : {};
  CF = { on: d.on !== false && !!d.ip, kind: /hik/i.test(d.kind || '') ? 'hik' : 'dahua', ip: String(d.ip || '').trim(), port: Math.max(1, Math.min(65535, Number(d.port) || 554)),
    user: String(d.user || 'admin').trim(), pw: String(d.pw || ''), ch: (d.ch && typeof d.ch === 'object') ? d.ch : {},
    xc: (Array.isArray(d.xc) ? d.xc : []).map(x => ({ n: String((x && x.n) || '').replace(/\s+/g, ' ').trim().slice(0, 30), ch: Math.floor(Number(x && x.ch) || 0), r: x && x.r ? 1 : 0 })).filter(x => x.n && x.ch > 0 && x.ch < 1000).slice(0, 16),   // v1.8
    gc: (Array.isArray(d.gc) ? d.gc : []).map(x => ({ g: Math.floor(Number(x && x.g) || 0), c: String((x && x.c) || '').trim().slice(0, 30), i: Number(x && x.i) === 2 ? 2 : 1 })).filter(x => x.g > 0 && x.c && x.c !== '-') };   // v1.9: 🏬 gate pass godam camera
  const sig = [CF.kind, CF.ip, CF.port, CF.user, CF.pw, Number(d.at) || 0].join('|');
  if (sig !== cfSig) { cfSig = sig; AUTHBAD = 0; for (const p of pipes.values()) stopPipe(p, 'setting badli'); }
  srcSync(); try { pushSt(true); } catch {}   // v1.9: godam cameras ki list (mo) app tak
  log(`⚙️ setting: ${CF.ip || '(NVR ka IP nahi)'} · counters ${Object.keys(CF.ch).length}`);
}, e => log('⚠️ setting: ' + e.message));
const credOf = x => String(x || '').replace(/[\s/?#]/g, c => encodeURIComponent(c));   // bill-clip v1.4 jaisa: ffmpeg %-decode nahi karta
function liveUrl(ch, main) { const u = credOf(CF.user), p = credOf(CF.pw); return CF.kind === 'hik' ? `rtsp://${u}:${p}@${CF.ip}:${CF.port}/Streaming/Channels/${ch}0${main ? 1 : 2}` : `rtsp://${u}:${p}@${CF.ip}:${CF.port}/cam/realmonitor?channel=${ch}&subtype=${main ? 0 : 1}`; }
function warnViewers(p, why) { for (const [id, v] of viewers) if (v.pipe === p && v.warn !== why) { v.warn = why; REQ.doc(id).set({ warn: why, warnAt: Date.now() }, { merge: true }).catch(() => {}); } }   // v1.1: asal wajah app ko (khamosh nahi)
const PN = require('./pc-names.js'); PN.start(biz);   // v1.5: counter ka naam NT-PRINT se — purane naam ka channel bhi
const xcOf = n => { const s = String(n || '').trim().toLowerCase(), x = (CF.xc || []).find(v => v.n.toLowerCase() === s); return x ? x.ch : 0; };   // v1.8: 📹 mazeed camera
const chOf = pc => PN.chFind(CF.ch, pc) || xcOf(pc);   // v1.6 (2026-11-17): naam = PC ka apna (pc-names v1.1) — purane naam / host / 🔗 jore hue naam ka channel bhi
const hint = e => { e = String(e || ''); if (/\b401\b|unauthori[sz]ed/i.test(e)) return 'NVR ka user / password ghalat (401)'; if (/\b404\b|not found/i.test(e)) return 'NVR par ye channel nahi (404)'; if (/timed? ?out|refused|unreachable/i.test(e)) return 'NVR tak rasta nahi (IP / LAN)'; if (/invalid data/i.test(e)) return 'NVR ne video nahi di (restart / RTSP band)'; return e.slice(0, 120); };

// ---------- 🔗 v1.2: recording wali line ki copy (bill-clip v2.4 → udp 127.0.0.1:48500+ch, mpegts) — NVR par doosra rabta nahi ----------
const SH_PORT = ch => 48500 + Number(ch), srcs = new Map();
const BUF = 8 << 20;   // v1.7: UDP dabba 8 MB (Windows ka 64 KB = PC ka pal bhar ruka = tukre gire = grey video)
function tsGaps(x, m) {   // v1.7: 🩺 recording ki line ke tukre PC ke andar gire? (mpegts continuity counter — sirf ginti, video nahi chhoota)
  const cc = x.cc || (x.cc = {}); let g = 0;
  for (let i = 0; i + 188 <= m.length; i += 188) {
    if (m[i] !== 0x47) break;
    const pid = ((m[i + 1] & 0x1f) << 8) | m[i + 2]; if (pid === 0x1fff) continue;
    const afc = (m[i + 3] >> 4) & 3, c = m[i + 3] & 15; if (!(afc & 1)) continue;
    if ((afc & 2) && m[i + 4] > 0 && (m[i + 5] & 0x80)) { cc[pid] = c; continue; }   // discontinuity (recording dobara shuru)
    const l = cc[pid]; if (l !== undefined && c !== ((l + 1) & 15) && c !== l) g++; cc[pid] = c;
  }
  return g;
}   // ch → {sock, subs:Set(ffmpeg stdin), last, pk}
// v2.1: ⚡ aakhri ~3.5 s yaad (naya dekhne wala ffmpeg foran keyframe se shuru kare)
const RING_MS = 3500, RING_MAX = 6e6;
function ringAdd(x, m, now) {
  let k = false;
  for (let i = 0; i + 188 <= m.length; i += 188) {
    if (m[i] !== 0x47) break;
    const pid = ((m[i + 1] & 0x1f) << 8) | m[i + 2];
    if (pid === 0) x.pat = Buffer.from(m.subarray(i, i + 188)); else if (pid === 0x1000) x.pmt = Buffer.from(m.subarray(i, i + 188));
    else if (((m[i + 3] >> 4) & 2) && m[i + 4] > 0 && (m[i + 5] & 0x40)) k = true;   // random access = keyframe
  }
  const R = x.ring || (x.ring = []); R.push({ t: now, k, m }); x.rb = (x.rb || 0) + m.length;
  while (R.length > 1 && (now - R[0].t > RING_MS || x.rb > RING_MAX)) { x.rb -= R[0].m.length; R.shift(); }
}
function ringHead(x) { const R = x.ring || [], i = R.findIndex(e => e.k), out = []; if (i < 0) return null; if (x.pat) out.push(x.pat); if (x.pmt) out.push(x.pmt); for (let j = i; j < R.length; j++) out.push(R[j].m); return Buffer.concat(out); }
function srcSync() {
  const want = new Set(); if (CF.on && CF.ip) { for (const v of Object.values(CF.ch)) if (Number(v) > 0 && Number(v) < 1000) want.add(Number(v)); for (const x of CF.xc || []) if (x.r) want.add(x.ch); }   // v1.8: recording wale mazeed camera ki copy bhi
  for (const [ch, x] of srcs) if (!want.has(ch)) { try { x.sock.close(); } catch {} srcs.delete(ch); }
  for (const ch of want) {
    if (srcs.has(ch)) continue;
    const x = { subs: new Set(), last: 0, pk: 0 }; srcs.set(ch, x);
    try { const sock = dgram.createSocket('udp4'); x.sock = sock;
      sock.on('error', e => { x.err = e.message; log(`⚠️ share ch ${ch}: ${e.message}`); try { sock.close(); } catch {} if (srcs.get(ch) === x) srcs.delete(ch); });
      sock.on('message', m => { x.pk++; x.last = Date.now(); x.gap = (x.gap || 0) + tsGaps(x, m); try { ringAdd(x, m, x.last); } catch {} for (const w of x.subs) { try { if (w.writable && w.writableLength < 4e6) w.write(m); else x.drop = (x.drop || 0) + 1; } catch {} } });
      sock.bind(SH_PORT(ch), '127.0.0.1', () => { try { sock.setRecvBufferSize(BUF); } catch (e) { log(`⚠️ share ch ${ch} dabba: ${e.message}`); } });
    } catch (e) { log(`⚠️ share ch ${ch}: ${e.message}`); srcs.delete(ch); }
  }
}
let REC = {};   // v1.4: bill-clip ki recording ka haal (ch → {on, n, err})
biz.collection('blueAccess').doc('billClipPc').onSnapshot(s => { REC = (s.exists && s.data().rec) || {}; }, () => {});
const recWhy = ch => { const r = REC[ch] || REC[String(ch)]; return !r ? 'is camera ki recording abhi shuru nahi hui' : r.on ? 'recording chal rahi hai magar us ki live copy nahi aa rahi (30 min mein khud dobara)' : 'is camera ki recording BAND hai' + (r.err ? ' (' + String(r.err).slice(0, 80) + ')' : ''); };
const shareOk = ch => { const x = srcs.get(ch); return !!x && Date.now() - x.last < 3000; };

// ---------- ek camera = ek ffmpeg → RTP → sab dekhne walon ke track ----------
const DEC_ERR = /error while decoding|concealing|missing picture|reference picture missing|corrupt|non-existing|invalid nal|out of range|decode_slice_header error|no frame!/gi;   // v1.7: ffmpeg h264 ki tootay tukron wali lines
const pipes = new Map();   // key ch|codec → {ch, codec, ff, sock, tracks:Set, err, idleAt, tries}
function startPipe(ch, codec) {
  const key = ch + '|' + codec; let p = pipes.get(key); if (p && p.ff) return p;
  p = p || { ch, codec, tracks: new Set(), tries: 0, err: '' }; pipes.set(key, p);
  const ff = ffPath(); if (!ff) { p.err = 'ffmpeg abhi nahi (bill-clip install kar raha)'; return p; }
  if (p.waitT) return p;
  if (!p.noShare && !process.env.LIVE_TEST_SRC && srcs.has(ch) && !shareOk(ch) && (p.wait || 0) < 4) {
    p.wait = (p.wait || 0) + 1; warnViewers(p, `Camera ch ${ch}: recording ki line ka intezar ${p.wait}/4…`);
    p.waitT = setTimeout(() => { p.waitT = null; if (p.tracks.size && !p.stopped) startPipe(ch, codec); }, 2500); return p;
  }
  const sock = dgram.createSocket('udp4'); p.sock = sock;
  p.pk = 0; p.sq = undefined;
  sock.on('message', m => { p.pk++; if (m.length > 4) { const sq = m.readUInt16BE(2); if (p.sq !== undefined) { const dd = (sq - p.sq) & 0xffff; if (dd > 1 && dd < 3000) p.rg = (p.rg || 0) + dd - 1; } p.sq = sq; } for (const t of p.tracks) { try { t.writeRtp(m); } catch {} } });
  sock.bind(0, '127.0.0.1', () => {
    try { sock.setRecvBufferSize(BUF); } catch {}   // v1.7
    const port = sock.address().port;
    const enc = codec === 'vp8' ? ['-c:v', 'libvpx', '-deadline', 'realtime', '-cpu-used', '8', '-b:v', '500k', '-g', '12', '-error-resilient', '1']
      : ['-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', '-profile:v', 'baseline', '-pix_fmt', 'yuv420p', '-g', '12', '-bf', '0', '-b:v', '450k', '-maxrate', '600k', '-bufsize', '300k'];
    p.share = !p.noShare && !process.env.LIVE_TEST_SRC && shareOk(ch);   // v1.2: recording wali line chal rahi hai → wahi (NVR par naya rabta nahi)
    { const x0 = srcs.get(ch); p.g0 = x0 ? (x0.gap || 0) + (x0.drop || 0) : 0; }   // v1.7: nayi ginti
    const src = process.env.LIVE_TEST_SRC ? ['-re', '-f', 'lavfi', '-i', 'testsrc=size=704x576:rate=15'] : p.share ? ['-f', 'mpegts', '-i', 'pipe:0'] : ['-rtsp_transport', 'tcp', '-timeout', '10000000', '-i', liveUrl(ch, p.main)];
    const args = ['-hide_banner', '-loglevel', 'error', ...(p.share ? [] : ['-nostdin']), '-fflags', 'nobuffer+discardcorrupt', ...src, '-an', '-vf', "fps=12,scale='min(640,iw)':-2", ...enc, '-f', 'rtp', '-payload_type', '96', '-pkt_size', '1200', `rtp://127.0.0.1:${port}`];
    const proc = spawn(ff, args, { windowsHide: true, stdio: [p.share ? 'pipe' : 'ignore', 'ignore', 'pipe'] }); p.ff = proc; p.at = Date.now(); let err = '';
    const sx = p.share ? srcs.get(ch) : null; if (sx) { proc.stdin.on('error', () => {}); sx.subs.add(proc.stdin); }
    proc.stderr.on('data', d => { const t = String(d); err += t; if (err.length > 2000) err = err.slice(-2000); const n = (t.match(DEC_ERR) || []).length; if (n) p.de = (p.de || 0) + n; });   // v1.7: 🩺 NVR→PC ki ghaltiyan gino
    proc.on('error', e => { err += ' ' + e.message; });
    proc.on('close', code => {
      if (sx) sx.subs.delete(proc.stdin);
      p.ff = null; const why = hint((err.trim().split(/\r?\n/).filter(Boolean).pop() || `ffmpeg code ${code}`).replace(/rtsp:\/\/[^@\s]*@/g, 'rtsp://****@'));
      if (p.stopped) return;
      if (/401/.test(why)) { AUTHBAD = Date.now(); p.err = why; log(`⛔ live ch ${ch}: 401 — ruka (setting badlein)`); failViewers(p, why); closePipe(p); return; }
      if (p.pk > 100) { p.tries = 0; p.wait = 0; }   // v1.2: video chal rahi thi — nayi ginti
      p.tries++; p.err = why; log(`🎞 live ch ${ch} ruki (${why})`); try { p.sock && p.sock.close(); } catch {} p.sock = null;
      if (!p.pk) { if (p.share) p.noShare = true; else p.main = !p.main; }   // v1.1: is stream se kuch nahi aaya — doosri (sub ↔ main) aazmao · v1.2: share se na aaya → RTSP
      const why2 = !p.share && /-138/.test(why) ? `NVR ne doosra rabta nahi diya — ${recWhy(ch)}. ⚙️ Setup → 🎞 Recording dekhein` : why;
      warnViewers(p, `Camera ch ${ch}: ${why2} — dobara koshish ${p.tries}/3`);
      if (p.tracks.size && p.tries <= 3) setTimeout(() => { if (p.tracks.size && !p.stopped) startPipe(ch, codec); }, 2000);
      else { failViewers(p, why); closePipe(p); }
    });
    log(`🔴 live ch ${ch} (${codec}${p.share ? ', recording ki line se' : p.main ? ', main' : ''}) shuru`);
  });
  return p;
}
function closePipe(p) { try { p.sock && p.sock.close(); } catch {} p.sock = null; pipes.delete(p.ch + '|' + p.codec); }
function stopPipe(p, why) { p.stopped = true; try { p.ff && p.ff.kill(); } catch {} if (p.mo) moUnfw(p); closePipe(p); if (why) log(`🎞 live ch ${p.ch} band (${why})`); }
function failViewers(p, why) { for (const [id, v] of viewers) if (v.pipe === p) { REQ.doc(id).set({ st: 'err', err: why, doneAt: Date.now() }, { merge: true }).catch(() => {}); endViewer(id, ''); } }

// ---------- 🏬 v1.9: Godam — sab cameras EK video (xstack) ----------
const MO_T = { w: 448, h: 252 }, MO_MAX = 6, MO_FPS = 8, MO_PORT = { h264: 48900, vp8: 48910 };
const ALL = '@sab', ALL_MAX = 9, ALL_T = { w: 384, h: 216 }, ALL_FPS = 6;   // v2.0: 🎛 sab cameras (7-9 = chhota khana, 6 fps — PC ka bojh)
const isMoPc = pc => pc === '@godam' || pc === ALL, moLab = p => p && p.kind === 'a' ? 'Sab cameras' : 'Godam cameras';
let GIC = [];   // 📦 Loading ginti ke camera (gintiCam.cams[].n)
biz.collection('blueAccess').doc('gintiCam').onSnapshot(s => { const d = s.exists ? s.data() || {} : {}; GIC = (Array.isArray(d.cams) ? d.cams : []).map(c => ({ n: String((c && c.n) || '').trim(), b: Math.floor(Number(c && c.b) || 0) })).filter(c => c.n); try { pushSt(true); } catch {} }, () => {});
function moList(max, sC) {
  const out = [], sN = new Set(); sC = sC || new Set();
  const add = (n, g) => { n = String(n || '').trim(); const k = n.toLowerCase(); if (!n || n === '-' || sN.has(k)) return; sN.add(k); const ch = chOf(n); if (!ch || sC.has(ch)) return; sC.add(ch); out.push({ n, ch, k: 'g', g: Math.floor(Number(g) || 0) }); };
  (CF.gc || []).slice().sort((a, b) => a.g - b.g || a.i - b.i).forEach(x => add(x.c, x.g));
  GIC.forEach(c => add(c.n, c.b));
  (CF.xc || []).forEach(x => { if (/go?dd?a+m|gudam|gdm|store/i.test(x.n)) add(x.n, 0); });
  return out.slice(0, max || MO_MAX);
}
function allList() {   // v2.0: 🎛 counter (bill) → godam (gate pass) → baqi mazeed cameras
  const out = [], sC = new Set();
  for (const n of Object.keys(CF.ch || {}).sort()) { const ch = Math.floor(Number(CF.ch[n]) || 0); if (!n || ch <= 0 || sC.has(ch)) continue; sC.add(ch); let nm = String(n); try { nm = PN.nowName(n) || nm; } catch {} out.push({ n: String(nm).slice(0, 30), ch, k: 'c', g: 0 }); }
  out.push(...moList(ALL_MAX, sC));
  for (const x of CF.xc || []) { if (sC.has(x.ch)) continue; sC.add(x.ch); out.push({ n: x.n, ch: x.ch, k: 'x', g: 0 }); }
  return out.slice(0, ALL_MAX);
}
const moObj = p => ({ c: p.grid.c, r: p.grid.r, n: p.list.map(x => x.n), k: p.list.map(x => x.k || 'g'), g: p.list.map(x => x.g || 0), tw: p.tw || MO_T.w, th: p.th || MO_T.h });
function moGrid(n) { return n <= 1 ? [1, 1] : n === 2 ? [2, 1] : n <= 4 ? [2, 2] : n <= 6 ? [3, 2] : [3, 3]; }
function moFilter(n, w, h, fps) {   // har camera = ek khana (barabar naap, kaali patti), khali khane = gehra rang
  const [c, r] = moGrid(n), parts = [], lab = [], lay = [];
  for (let i = 0; i < c * r; i++) {
    if (i < n) parts.push(`[${i}:v]fps=${fps},scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=0x0b0f16,setsar=1[v${i}]`);
    else parts.push(`color=c=0x0b0f16:s=${w}x${h}:r=${fps}[v${i}]`);
    lab.push(`[v${i}]`); lay.push(`${(i % c) * w}_${Math.floor(i / c) * h}`);
  }
  parts.push(c * r === 1 ? `[v0]null[out]` : `${lab.join('')}xstack=inputs=${c * r}:layout=${lay.join('|')}[out]`);
  return { c, r, f: parts.join(';') };
}
let MO_FASTBAD = 0;   // v2.1: TCP + yaad wala tareeqa na chale = purana UDP
function moTcp(p, ch) {   // ek input = ek chhota TCP darwaza (sirf 127.0.0.1); ffmpeg jure = pehle yaad wala hissa, phir chalti line
  return new Promise(res => {
    const x = srcs.get(ch); if (!x) return res(0);
    const srv = net.createServer(c => {
      c.setNoDelay(true); c.on('error', () => {}); try { const h = ringHead(x); if (h) c.write(h); } catch {}
      x.subs.add(c); p.fw.push({ ch, obj: c, sock: { close: () => { try { c.destroy(); } catch {} } } }); c.on('close', () => { try { x.subs.delete(c); } catch {} });
    });
    srv.on('error', () => res(0)); (p.srv = p.srv || []).push(srv);
    srv.listen(0, '127.0.0.1', () => res(srv.address().port));
  });
}
function moUnfw(p) { for (const sv of p.srv || []) { try { sv.close(); } catch {} } p.srv = []; for (const f of p.fw || []) { try { const x = srcs.get(f.ch); x && x.subs.delete(f.obj); } catch {} try { f.sock.close(); } catch {} } p.fw = []; }
function moTell(p) { const mo = moObj(p), sig = JSON.stringify(mo); for (const [id, v] of viewers) if (v.pipe === p && v.moSig !== sig) { v.moSig = sig; REQ.doc(id).set({ mo }, { merge: true }).catch(() => {}); } }
function startMosaic(codec, kind) {
  kind = kind === 'a' ? 'a' : 'g'; const chK = kind === 'a' ? 'ma' : 'mo';
  const key = chK + '|' + codec; let p = pipes.get(key); if (p && p.ff) return p;
  p = p || { ch: chK, mo: 1, kind, codec, tracks: new Set(), tries: 0, err: '' }; pipes.set(key, p); p.stopped = false;
  const ff = ffPath(); if (!ff) { p.err = 'ffmpeg abhi nahi (bill-clip install kar raha)'; return p; }
  const L = kind === 'a' ? allList() : moList(); if (!L.length) { p.err = kind === 'a' ? 'Koi camera ⚙️ Camera setup mein nahi (counter ↔ camera jorein)' : 'Godam ka koi camera ⚙️ Camera setup mein nahi (gate pass godam camera / 📦 Loading ginti / naam mein "godam")'; pipes.delete(key); return p; }
  const T = L.length > 6 ? ALL_T : MO_T, FPS = L.length > 6 ? ALL_FPS : MO_FPS, PB = MO_PORT[codec] + (kind === 'a' ? 20 : 0);
  const { c, r, f } = moFilter(L.length, T.w, T.h, FPS); p.list = L; p.grid = { c, r }; p.tw = T.w; p.th = T.h;
  const sock = dgram.createSocket('udp4'); p.sock = sock; p.pk = 0; p.pkSeen = 0; p.pkAt = Date.now(); p.sq = undefined;
  sock.on('message', m => { p.pk++; for (const t of p.tracks) { try { t.writeRtp(m); } catch {} } });
  sock.bind(0, '127.0.0.1', () => {
    try { sock.setRecvBufferSize(BUF); } catch {}
    const port = sock.address().port, inArgs = [], how = []; moUnfw(p);
    const fast = !MO_FASTBAD && !process.env.LIVE_TEST_SRC; p.fast = fast;
    Promise.all(L.map(x => fast && shareOk(x.ch) ? moTcp(p, x.ch) : 0)).then(tp => {
    if (p.stopped || p.sock !== sock) { moUnfw(p); return; }
    L.forEach((x, i) => {
      const pre = ['-thread_queue_size', '512', '-probesize', '1000000', '-analyzeduration', '1000000', '-use_wallclock_as_timestamps', '1', '-fflags', 'nobuffer+discardcorrupt'];   // probe 1 s: inputs ek ek khulte hain (default = 4 camera ~25 s intezar, ab ~7 s)
      if (process.env.LIVE_TEST_SRC) { inArgs.push('-re', '-f', 'lavfi', '-i', `testsrc=size=704x576:rate=15`); how.push('test'); return; }
      if (tp[i]) { inArgs.push(...pre, '-f', 'mpegts', '-i', `tcp://127.0.0.1:${tp[i]}`); how.push('rec⚡'); return; }   // v2.1
      if (shareOk(x.ch)) {   // recording wali copy → is ffmpeg ke apne udp port par aage (ek ffmpeg ki stdin ek hi hoti hai)
        const fp = PB + i, fs2 = dgram.createSocket('udp4'); fs2.on('error', () => {});
        const obj = { writable: true, writableLength: 0, write: m => { try { fs2.send(m, fp, '127.0.0.1'); } catch {} } };
        srcs.get(x.ch).subs.add(obj); p.fw.push({ ch: x.ch, obj, sock: fs2 });
        inArgs.push(...pre, '-f', 'mpegts', '-i', `udp://127.0.0.1:${fp}?fifo_size=1000000&overrun_nonfatal=1&buffer_size=8388608`); how.push('rec');
      } else { inArgs.push(...pre, '-rtsp_transport', 'tcp', '-timeout', '10000000', '-i', liveUrl(x.ch, false)); how.push('rtsp'); }
    });
    const br = Math.round(400 + 220 * L.length);
    const enc = codec === 'vp8' ? ['-c:v', 'libvpx', '-deadline', 'realtime', '-cpu-used', '8', '-b:v', br + 'k', '-g', String(FPS * 2), '-error-resilient', '1']
      : ['-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', '-profile:v', 'baseline', '-pix_fmt', 'yuv420p', '-g', String(FPS * 2), '-bf', '0', '-b:v', br + 'k', '-maxrate', Math.round(br * 1.3) + 'k', '-bufsize', Math.round(br * 0.7) + 'k'];
    const args = ['-hide_banner', '-loglevel', 'error', '-nostdin', ...inArgs, '-filter_complex', f, '-map', '[out]', '-an', ...enc, '-f', 'rtp', '-payload_type', '96', '-pkt_size', '1200', `rtp://127.0.0.1:${port}`];
    const proc = spawn(ff, args, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] }); p.ff = proc; p.at = Date.now(); let err = '';
    proc.stderr.on('data', d => { err += String(d); if (err.length > 2000) err = err.slice(-2000); });
    proc.on('error', e => { err += ' ' + e.message; });
    proc.on('close', code => {
      moUnfw(p); p.ff = null; const why = hint((err.trim().split(/\r?\n/).filter(Boolean).pop() || `ffmpeg code ${code}`).replace(/rtsp:\/\/[^@\s]*@/g, 'rtsp://****@'));
      if (p.stopped) return;
      if (p.fast && !p.pk && !/401/.test(why)) { MO_FASTBAD = Date.now(); log(`⚡ ${moLab(p)}: tez tareeqa nahi chala (${why}) — purana tareeqa`); try { p.sock && p.sock.close(); } catch {} p.sock = null; if (p.tracks.size || (p.idleAt && Date.now() - p.idleAt < 60000)) setTimeout(() => { if (!p.stopped) { startMosaic(codec, kind); moTell(p); } }, 300); else closePipe(p); return; }
      if (/401/.test(why)) { AUTHBAD = Date.now(); p.err = why; log('⛔ live ' + moLab(p) + ': 401 — ruka (setting badlein)'); failViewers(p, why); closePipe(p); return; }
      if (p.pk > 100) p.tries = 0;
      p.tries++; p.err = why; log(`🎞 live ${moLab(p)} ruki (${why})`); try { p.sock && p.sock.close(); } catch {} p.sock = null;
      warnViewers(p, `${moLab(p)}: ${why} — dobara koshish ${p.tries}/3`);
      if (p.tracks.size && p.tries <= 3) setTimeout(() => { if (p.tracks.size && !p.stopped) { startMosaic(codec, kind); moTell(p); } }, 2000);
      else { failViewers(p, why); closePipe(p); }
    });
    log(`${kind === 'a' ? '🎛 live sab' : '🏬 live godam'} (${codec}) shuru — ${L.length} camera ${c}x${r}: ${L.map((x, i) => x.n + ' ch' + x.ch + '/' + how[i]).join(', ')}`);
    }).catch(e => { log('⚠️ mosaic: ' + (e && e.message)); });
  });
  return p;
}

// ---------- dekhne wale ----------
const viewers = new Map();   // reqId → {pc, track, pipe, hb}
function endViewer(id, why) {
  const v = viewers.get(id); if (!v) return; viewers.delete(id);
  try { v.pipe.tracks.delete(v.track); } catch {} try { v.pc.close(); } catch {}
  if (!v.pipe.tracks.size) v.pipe.idleAt = Date.now();
  if (why) log(`👋 dekhne wala gaya (${why}) · baqi ${viewers.size}`); pushSt(true);
}
async function answer(id, r) {
  const fail = why => REQ.doc(id).set({ st: 'err', err: why, doneAt: Date.now() }, { merge: true }).catch(() => {});
  if (!CF.on || !CF.ip) return fail('Camera setup band / NVR ka IP nahi (malik ⚙️)');
  if (AUTHBAD) return fail('NVR ka user / password ghalat (401) — malik ⚙️ mein theek karein');
  const isMo = isMoPc(r.pc);   // v1.9: 🏬 sab godam cameras ek saath · v2.0: 🎛 '@sab' = sab cameras
  const ch = isMo ? (r.pc === ALL ? 'ma' : 'mo') : chOf(r.pc); if (!ch) return fail(`"${r.pc || '?'}" counter ka camera channel ⚙️ mein nahi`);
  if (viewers.size >= MAX_V) return fail(`Abhi ${MAX_V} log dekh rahe hain — thori der baad`);
  const w = werift(); if (!w) return fail('WebRTC abhi install ho raha hai — 1-2 min baad dobara');
  const offer = String(r.offer || ''); if (!/^v=0/.test(offer)) return fail('ghalat offer');
  const codec = /H264/i.test(offer) ? 'h264' : 'vp8';
  const p = isMo ? startMosaic(codec, r.pc === ALL ? 'a' : 'g') : startPipe(ch, codec); if (!p.ff && !p.sock) return fail(p.err || 'video shuru nahi hui');
  const pc = new w.RTCPeerConnection({ codecs: { video: [codec === 'vp8' ? w.useVP8() : w.useH264()], audio: [] }, iceServers: STUN });
  const track = new w.MediaStreamTrack({ kind: 'video' });
  pc.addTransceiver(track, { direction: 'sendonly' });
  await pc.setRemoteDescription({ type: 'offer', sdp: offer });
  await pc.setLocalDescription(await pc.createAnswer());
  if (pc.iceGatheringState !== 'complete') await new Promise(res => { const t = setTimeout(res, 1200); pc.iceGatheringStateChange.subscribe(s => { if (s === 'complete') { clearTimeout(t); res(); } }); });
  const v = { pc, track, pipe: p, hb: Date.now(), pcName: r.pc, ch };
  viewers.set(id, v); p.tracks.add(track); p.idleAt = 0;
  pc.connectionStateChange.subscribe(s => { if (s === 'failed' || s === 'closed') { if (viewers.has(id)) REQ.doc(id).set({ st: s === 'failed' ? 'err' : 'end', err: s === 'failed' ? 'rabta toot gaya / nahi bana (network)' : '', doneAt: Date.now() }, { merge: true }).catch(() => {}); endViewer(id, s); } });
  const moD = isMo && p.list ? { mo: moObj(p) } : {}; if (isMo) v.moSig = JSON.stringify(moD.mo || null);
  await REQ.doc(id).set({ ans: pc.localDescription.sdp, st: 'ok', codec, okAt: Date.now(), ...moD }, { merge: true });
  log(`🔴 ${r.pc} (ch ${ch}) dekhne wala jur raha · ${viewers.size}`); pushSt(true);
}
const seen = new Set();
function onReqs(docs) {
  const now = Date.now();
  for (const d of docs) {
    const id = d.id, r = d.data() || {};
    if (r.st === 'new' && !seen.has(id) && now - (Number(r.at) || 0) < 60000) { seen.add(id); answer(id, r).catch(e => { log('✕ answer: ' + e.message); REQ.doc(id).set({ st: 'err', err: 'PC: ' + String(e.message).slice(0, 100), doneAt: Date.now() }, { merge: true }).catch(() => {}); }); }
    const v = viewers.get(id); if (v) { if (r.st === 'end' || r.st === 'err') endViewer(id, r.st); else if (Number(r.hb) > v.hb) v.hb = Number(r.hb); }
  }
  if (seen.size > 500) seen.clear();
}
REQ.where('st', 'in', ['new', 'ok']).onSnapshot(s => { onReqs(s.docs); s.docChanges().forEach(c => { if (c.type === 'removed' && viewers.has(c.doc.id)) endViewer(c.doc.id, 'band'); }); }, e => log('⚠️ liveReq: ' + e.message));
setInterval(() => { REQ.where('st', 'in', ['new', 'ok']).get().then(s => { onReqs(s.docs); const ids = new Set(s.docs.map(d => d.id)); for (const id of [...viewers.keys()]) if (!ids.has(id)) endViewer(id, 'band'); }).catch(() => {}); }, 30000);   // qaida: onSnapshot ke saath poll bhi

// ---------- chowkidar: purane dekhne wale + khali ffmpeg + purane req ----------
setInterval(() => {
  const now = Date.now();
  for (const [id, v] of viewers) if (now - v.hb > 45000) { REQ.doc(id).set({ st: 'end', doneAt: now }, { merge: true }).catch(() => {}); endViewer(id, 'hb purana'); }
  for (const p of [...pipes.values()]) if (!p.tracks.size && p.idleAt && now - p.idleAt > (p.mo ? 300000 : 120000)) stopPipe(p, 'koi nahi dekh raha');   // v2.1: mosaic 5 min garam
  for (const p of pipes.values()) {   // v1.1: 🩺 video aa rahi hai ya nahi — app ko batao
    if (!p.tracks.size) continue;
    if (p.mo) { if (p.pk !== p.pkSeen) { p.pkSeen = p.pk; p.pkAt = now; } else if (p.ff && now - (p.at || now) > 15000 && now - (p.pkAt || now) > 15000) { log('🏬 live ' + moLab(p) + ': 15 s se video nahi — dobara (koi camera ruka)'); try { p.ff.kill(); } catch {} } }   // v1.9
    if (p.share && p.ff && now - (p.at || now) > 8000 && !shareOk(p.ch)) { log(`🔗 live ch ${p.ch}: recording ki line ruk gayi — dobara`); try { p.ff.kill(); } catch {} continue; }   // v1.2
    { const x = p.share ? srcs.get(p.ch) : null, gT = x ? (x.gap || 0) + (x.drop || 0) : 0;   // v1.7: 🩺 pichhle 10 s mein tukre kahan gire — app chip
      const fresh = now - (p.at || now) < 8000;   // shuru ke pehle pal (beech GOP se jurna) ki ghaltiyan nahi gintay
      const d = fresh ? 0 : (p.de || 0) - (p.de0 || 0), g = fresh ? 0 : Math.max(0, gT - (p.g0 || 0)), r = fresh ? 0 : (p.rg || 0) - (p.rg0 || 0);
      p.de0 = p.de || 0; p.g0 = gT; p.rg0 = p.rg || 0;
      const sig = (d >= 2 ? 'd' : '') + (g > 0 ? 'g' : '') + (r > 0 ? 'r' : '');
      if (d >= 2 || g || r) log(`🩺 live ch ${p.ch}: 10 s mein NVR→PC ghalti ${d} · PC ke andar gire ${g} · RTP gire ${r}`);
      for (const [id, v] of viewers) if (v.pipe === p && (v.qs !== sig || sig)) { v.qs = sig; REQ.doc(id).set({ q: { d, g, r, at: now } }, { merge: true }).catch(() => {}); } }
    if (p.pk > 0) { for (const [id, v] of viewers) if (v.pipe === p && !v.rtp) { v.rtp = 1; v.warn = ''; REQ.doc(id).set({ rtp: 1, warn: '' }, { merge: true }).catch(() => {}); } }
    else if (p.ff && now - (p.at || now) > (p.share || p.mo ? 20000 : 12000)) warnViewers(p, p.mo ? moLab(p) + ': abhi video nahi aa rahi — kisi camera ki recording ruki hai? (⚙️ Setup → 🎞 Recording)' : `Camera ch ${p.ch}: NVR se jur gaya par video nahi aa rahi — ye channel NVR par chal raha hai? (⚙️ mein counter ka channel dekhein)`);
  }
}, 10000);
setInterval(async () => { try { const s = await REQ.where('at', '<', Date.now() - 6 * 3600000).limit(200).get(); if (s.size) { const b = db.batch(); s.forEach(d => b.delete(d.ref)); await b.commit(); } } catch {} }, 60 * 60000);

// ---------- haal ----------
let ST = { err: '' }, stAt = 0;
async function pushSt(force) {
  if (!force && Date.now() - stAt < 20000) return; stAt = Date.now();
  const cams = [...pipes.values()].map(p => ({ ch: p.ch, n: p.tracks.size, on: p.ff ? 1 : 0, err: p.err || '' }));
  try { await biz.collection('blueAccess').doc('liveCamPc').set({ at: Date.now(), ver: VER, host: os.hostname(), ok: W ? 1 : 0, ff: ffPath() ? 1 : 0, err: AUTHBAD ? 'NVR 401 — ruka' : ST.err.slice(0, 160), v: viewers.size, cams, mo: moList().map(x => x.n), all: allList().map(x => x.n) }, { merge: true }); } catch (e) { log('⚠️ haal: ' + e.message); }   // v1.9: mo = godam cameras
}

function main() {
  log(`🔴 live-cam v${VER} shuru — ${os.hostname()} · lock ${LOCK_PORT}`);
  werift(); pushSt(true);
  setInterval(ZINDA.guard ? ZINDA.guard(() => { werift(); pushSt(); }, 10 * 60000, 'tick') : () => { werift(); pushSt(); }, 30000);
  process.on('exit', () => { for (const p of pipes.values()) { try { p.ff && p.ff.kill(); } catch {} } });
}
const lock = net.createServer();
lock.once('error', () => { console.log(`[${new Date().toLocaleTimeString()}] live-cam pehle se chal raha hai (lock ${LOCK_PORT})`); process.exit(3); });
lock.listen(LOCK_PORT, '127.0.0.1', () => { try { main(); } catch (e) { log('❌ ' + (e.stack || e.message || e)); setTimeout(() => process.exit(1), 5000); } });
