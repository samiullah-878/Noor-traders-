// =========================================================
//  live-cam.js  v1.3 (2026-11-10: ⚡ malik: "time bohat zyada lag raha — on karte hi aana chahiye": ICE ka intezar 4 s → 1.2 s, har 1 s keyframe (g 12), dekhne wala jaye to camera 2 min GARAM (dobara / counter badalna = foran).)
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
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const DIR = __dirname, BUSINESS_ID = 'noor-traders', LOCK_PORT = 47844, VER = '1.3';
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
    user: String(d.user || 'admin').trim(), pw: String(d.pw || ''), ch: (d.ch && typeof d.ch === 'object') ? d.ch : {} };
  const sig = [CF.kind, CF.ip, CF.port, CF.user, CF.pw, Number(d.at) || 0].join('|');
  if (sig !== cfSig) { cfSig = sig; AUTHBAD = 0; for (const p of pipes.values()) stopPipe(p, 'setting badli'); }
  srcSync();
  log(`⚙️ setting: ${CF.ip || '(NVR ka IP nahi)'} · counters ${Object.keys(CF.ch).length}`);
}, e => log('⚠️ setting: ' + e.message));
const credOf = x => String(x || '').replace(/[\s/?#]/g, c => encodeURIComponent(c));   // bill-clip v1.4 jaisa: ffmpeg %-decode nahi karta
function liveUrl(ch, main) { const u = credOf(CF.user), p = credOf(CF.pw); return CF.kind === 'hik' ? `rtsp://${u}:${p}@${CF.ip}:${CF.port}/Streaming/Channels/${ch}0${main ? 1 : 2}` : `rtsp://${u}:${p}@${CF.ip}:${CF.port}/cam/realmonitor?channel=${ch}&subtype=${main ? 0 : 1}`; }
function warnViewers(p, why) { for (const [id, v] of viewers) if (v.pipe === p && v.warn !== why) { v.warn = why; REQ.doc(id).set({ warn: why, warnAt: Date.now() }, { merge: true }).catch(() => {}); } }   // v1.1: asal wajah app ko (khamosh nahi)
const chOf = pc => Number(CF.ch[pc] ?? CF.ch[String(pc || '').toLowerCase()]) || 0;
const hint = e => { e = String(e || ''); if (/\b401\b|unauthori[sz]ed/i.test(e)) return 'NVR ka user / password ghalat (401)'; if (/\b404\b|not found/i.test(e)) return 'NVR par ye channel nahi (404)'; if (/timed? ?out|refused|unreachable/i.test(e)) return 'NVR tak rasta nahi (IP / LAN)'; if (/invalid data/i.test(e)) return 'NVR ne video nahi di (restart / RTSP band)'; return e.slice(0, 120); };

// ---------- 🔗 v1.2: recording wali line ki copy (bill-clip v2.4 → udp 127.0.0.1:48500+ch, mpegts) — NVR par doosra rabta nahi ----------
const SH_PORT = ch => 48500 + Number(ch), srcs = new Map();   // ch → {sock, subs:Set(ffmpeg stdin), last, pk}
function srcSync() {
  const want = new Set(); if (CF.on && CF.ip) for (const v of Object.values(CF.ch)) if (Number(v) > 0 && Number(v) < 1000) want.add(Number(v));
  for (const [ch, x] of srcs) if (!want.has(ch)) { try { x.sock.close(); } catch {} srcs.delete(ch); }
  for (const ch of want) {
    if (srcs.has(ch)) continue;
    const x = { subs: new Set(), last: 0, pk: 0 }; srcs.set(ch, x);
    try { const sock = dgram.createSocket('udp4'); x.sock = sock;
      sock.on('error', e => { x.err = e.message; log(`⚠️ share ch ${ch}: ${e.message}`); try { sock.close(); } catch {} if (srcs.get(ch) === x) srcs.delete(ch); });
      sock.on('message', m => { x.pk++; x.last = Date.now(); for (const w of x.subs) { try { if (w.writable && w.writableLength < 4e6) w.write(m); } catch {} } });
      sock.bind(SH_PORT(ch), '127.0.0.1');
    } catch (e) { log(`⚠️ share ch ${ch}: ${e.message}`); srcs.delete(ch); }
  }
}
const shareOk = ch => { const x = srcs.get(ch); return !!x && Date.now() - x.last < 3000; };

// ---------- ek camera = ek ffmpeg → RTP → sab dekhne walon ke track ----------
const pipes = new Map();   // key ch|codec → {ch, codec, ff, sock, tracks:Set, err, idleAt, tries}
function startPipe(ch, codec) {
  const key = ch + '|' + codec; let p = pipes.get(key); if (p && p.ff) return p;
  p = p || { ch, codec, tracks: new Set(), tries: 0, err: '' }; pipes.set(key, p);
  const ff = ffPath(); if (!ff) { p.err = 'ffmpeg abhi nahi (bill-clip install kar raha)'; return p; }
  const sock = dgram.createSocket('udp4'); p.sock = sock;
  p.pk = 0;
  sock.on('message', m => { p.pk++; for (const t of p.tracks) { try { t.writeRtp(m); } catch {} } });
  sock.bind(0, '127.0.0.1', () => {
    const port = sock.address().port;
    const enc = codec === 'vp8' ? ['-c:v', 'libvpx', '-deadline', 'realtime', '-cpu-used', '8', '-b:v', '500k', '-g', '12', '-error-resilient', '1']
      : ['-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', '-profile:v', 'baseline', '-pix_fmt', 'yuv420p', '-g', '12', '-bf', '0', '-b:v', '450k', '-maxrate', '600k', '-bufsize', '300k'];
    p.share = !p.noShare && !process.env.LIVE_TEST_SRC && shareOk(ch);   // v1.2: recording wali line chal rahi hai → wahi (NVR par naya rabta nahi)
    const src = process.env.LIVE_TEST_SRC ? ['-re', '-f', 'lavfi', '-i', 'testsrc=size=704x576:rate=15'] : p.share ? ['-f', 'mpegts', '-i', 'pipe:0'] : ['-rtsp_transport', 'tcp', '-timeout', '10000000', '-i', liveUrl(ch, p.main)];
    const args = ['-hide_banner', '-loglevel', 'error', ...(p.share ? [] : ['-nostdin']), '-fflags', 'nobuffer', ...src, '-an', '-vf', "fps=12,scale='min(640,iw)':-2", ...enc, '-f', 'rtp', '-payload_type', '96', '-pkt_size', '1200', `rtp://127.0.0.1:${port}`];
    const proc = spawn(ff, args, { windowsHide: true, stdio: [p.share ? 'pipe' : 'ignore', 'ignore', 'pipe'] }); p.ff = proc; p.at = Date.now(); let err = '';
    const sx = p.share ? srcs.get(ch) : null; if (sx) { proc.stdin.on('error', () => {}); sx.subs.add(proc.stdin); }
    proc.stderr.on('data', d => { err += String(d); if (err.length > 2000) err = err.slice(-2000); });
    proc.on('error', e => { err += ' ' + e.message; });
    proc.on('close', code => {
      if (sx) sx.subs.delete(proc.stdin);
      p.ff = null; const why = hint((err.trim().split(/\r?\n/).filter(Boolean).pop() || `ffmpeg code ${code}`).replace(/rtsp:\/\/[^@\s]*@/g, 'rtsp://****@'));
      if (p.stopped) return;
      if (/401/.test(why)) { AUTHBAD = Date.now(); p.err = why; log(`⛔ live ch ${ch}: 401 — ruka (setting badlein)`); failViewers(p, why); closePipe(p); return; }
      if (p.pk > 100) p.tries = 0;   // v1.2: video chal rahi thi — nayi ginti
      p.tries++; p.err = why; log(`🎞 live ch ${ch} ruki (${why})`); try { p.sock && p.sock.close(); } catch {} p.sock = null;
      if (!p.pk) { if (p.share) p.noShare = true; else p.main = !p.main; }   // v1.1: is stream se kuch nahi aaya — doosri (sub ↔ main) aazmao · v1.2: share se na aaya → RTSP
      warnViewers(p, `Camera ch ${ch}: ${why} — dobara koshish ${p.tries}/3${p.main ? ' (main stream)' : ''}`);
      if (p.tracks.size && p.tries <= 3) setTimeout(() => { if (p.tracks.size && !p.stopped) startPipe(ch, codec); }, 2000);
      else { failViewers(p, why); closePipe(p); }
    });
    log(`🔴 live ch ${ch} (${codec}${p.share ? ', recording ki line se' : p.main ? ', main' : ''}) shuru`);
  });
  return p;
}
function closePipe(p) { try { p.sock && p.sock.close(); } catch {} p.sock = null; pipes.delete(p.ch + '|' + p.codec); }
function stopPipe(p, why) { p.stopped = true; try { p.ff && p.ff.kill(); } catch {} closePipe(p); if (why) log(`🎞 live ch ${p.ch} band (${why})`); }
function failViewers(p, why) { for (const [id, v] of viewers) if (v.pipe === p) { REQ.doc(id).set({ st: 'err', err: why, doneAt: Date.now() }, { merge: true }).catch(() => {}); endViewer(id, ''); } }

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
  const ch = chOf(r.pc); if (!ch) return fail(`"${r.pc || '?'}" counter ka camera channel ⚙️ mein nahi`);
  if (viewers.size >= MAX_V) return fail(`Abhi ${MAX_V} log dekh rahe hain — thori der baad`);
  const w = werift(); if (!w) return fail('WebRTC abhi install ho raha hai — 1-2 min baad dobara');
  const offer = String(r.offer || ''); if (!/^v=0/.test(offer)) return fail('ghalat offer');
  const codec = /H264/i.test(offer) ? 'h264' : 'vp8';
  const p = startPipe(ch, codec); if (!p.ff && !p.sock) return fail(p.err || 'video shuru nahi hui');
  const pc = new w.RTCPeerConnection({ codecs: { video: [codec === 'vp8' ? w.useVP8() : w.useH264()], audio: [] }, iceServers: STUN });
  const track = new w.MediaStreamTrack({ kind: 'video' });
  pc.addTransceiver(track, { direction: 'sendonly' });
  await pc.setRemoteDescription({ type: 'offer', sdp: offer });
  await pc.setLocalDescription(await pc.createAnswer());
  if (pc.iceGatheringState !== 'complete') await new Promise(res => { const t = setTimeout(res, 1200); pc.iceGatheringStateChange.subscribe(s => { if (s === 'complete') { clearTimeout(t); res(); } }); });
  const v = { pc, track, pipe: p, hb: Date.now(), pcName: r.pc, ch };
  viewers.set(id, v); p.tracks.add(track); p.idleAt = 0;
  pc.connectionStateChange.subscribe(s => { if (s === 'failed' || s === 'closed') { if (viewers.has(id)) REQ.doc(id).set({ st: s === 'failed' ? 'err' : 'end', err: s === 'failed' ? 'rabta toot gaya / nahi bana (network)' : '', doneAt: Date.now() }, { merge: true }).catch(() => {}); endViewer(id, s); } });
  await REQ.doc(id).set({ ans: pc.localDescription.sdp, st: 'ok', codec, okAt: Date.now() }, { merge: true });
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
  for (const p of [...pipes.values()]) if (!p.tracks.size && p.idleAt && now - p.idleAt > 120000) stopPipe(p, 'koi nahi dekh raha');
  for (const p of pipes.values()) {   // v1.1: 🩺 video aa rahi hai ya nahi — app ko batao
    if (!p.tracks.size) continue;
    if (p.share && p.ff && now - (p.at || now) > 8000 && !shareOk(p.ch)) { log(`🔗 live ch ${p.ch}: recording ki line ruk gayi — dobara`); try { p.ff.kill(); } catch {} continue; }   // v1.2
    if (p.pk > 0) { for (const [id, v] of viewers) if (v.pipe === p && !v.rtp) { v.rtp = 1; v.warn = ''; REQ.doc(id).set({ rtp: 1, warn: '' }, { merge: true }).catch(() => {}); } }
    else if (p.ff && now - (p.at || now) > (p.share ? 20000 : 12000)) warnViewers(p, `Camera ch ${p.ch}: NVR se jur gaya par video nahi aa rahi — ye channel NVR par chal raha hai? (⚙️ mein counter ka channel dekhein)`);
  }
}, 10000);
setInterval(async () => { try { const s = await REQ.where('at', '<', Date.now() - 6 * 3600000).limit(200).get(); if (s.size) { const b = db.batch(); s.forEach(d => b.delete(d.ref)); await b.commit(); } } catch {} }, 60 * 60000);

// ---------- haal ----------
let ST = { err: '' }, stAt = 0;
async function pushSt(force) {
  if (!force && Date.now() - stAt < 20000) return; stAt = Date.now();
  const cams = [...pipes.values()].map(p => ({ ch: p.ch, n: p.tracks.size, on: p.ff ? 1 : 0, err: p.err || '' }));
  try { await biz.collection('blueAccess').doc('liveCamPc').set({ at: Date.now(), ver: VER, host: os.hostname(), ok: W ? 1 : 0, ff: ffPath() ? 1 : 0, err: AUTHBAD ? 'NVR 401 — ruka' : ST.err.slice(0, 160), v: viewers.size, cams }, { merge: true }); } catch (e) { log('⚠️ haal: ' + e.message); }
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
