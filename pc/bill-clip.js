// =========================================================
//  bill-clip.js  v2.5 (2026-11-10) — 🎯 pehli item ka ASAL waqt counter ki POS screen se (posAdds, NT-PRINT v1.32) + clip PRINT hote hi (post ka intezar nahi)
//  v2.4 (2026-11-10) — 🔗 recording wali line ki COPY PC ke andar (udp 127.0.0.1:48500+ch) → live-cam v1.2 (NVR live ko doosra rabta nahi deta tha: "error -138"); copy se recording gire = khud purana tareeqa.
//  v2.3 (2026-11-10) — 🎬 video AAKHRI ITEM tak (`lt`, pos-sales-dekho v2.7): POS ka 'Created & Printed' waqt bill khatam hone se pehle ka hota hai → 18 item ke bill ki sirf 2 min video, 6 item ke baad app shuru se chala deti (malik). Ab t1 = max(print, aakhri item) + post. haal (billClipPc) mein `pcs` = setting ke counter naam (Live camera bina bill ke bhi).
//  v2.2 (2026-11-09) — 🎯 clip PEHLI ITEM se: `pre` 0 = bill ki pehli scan (`ft`, pos-sales-dekho v2.5) se 15 s pehle → print + post s; ft na ho = 120 s pehle. ⚙️ chips: Pehli item · 1 · 2 · 3 · 5 min.
//  v2.1 (2026-11-09) — v2.1: kamyab clip par ST.err saaf (ek purane bill ka ⚠ patti par atka rehta tha).
//  v2.0 (2026-11-09) — 🎞 LOCAL RECORDING + 5 MIN CLIP + hisse-war video + un-posted bill ki clip hukum par
//  Malik (9 Nov): "posted bill: print se 5 min pehle ki video · un-posted bill ki clip alehda, jab hum order karein · video Netflix jaisi speed se chale, slow na ho · PC + NVR ek Wi-Fi".
//    • Har counter ke camera ki LIVE sub-stream PC apne folder clip-rec\ch<N>\ mein 1-1 min ke tukron mein likhti rehti hai (ffmpeg -c copy = CPU nahi;
//      `rk` min rakhe, default 180; kill par bhi tukra parhne layak — fragmented mp4). Bill ki clip ab INHI tukron se kat-ti hai (foran — NVR playback
//      ka 5 min realtime intezar nahi); tukre na hon (PC band tha / purana bill) to purana NVR playback raasta.
//      NVR ka HTTP download (loadfile.cgi / ISAPI download) jaan kar NAHI lagaya — asal NVR par test nahi ho sakta; live stream wahi hai jo Rabta test
//      mein chal chuki.
//    • Clip = 60-60 s ke HISSE (billClip/<SaleID>_s<i>_<j>, meta.segs) — app pehla hissa aate hi chala deti hai, baqi peeche load (Netflix jaisa).
//    • Un-posted bill: app billClipReq/<SaleID> {st new} likhe → PC wahi clip banaye (meta rq 1) → req st ok/err. Purane 1-hisse clip (v1) app ab bhi chalati hai.
//  v1.5 (2026-11-09) — v1.5: har 💾 Save par Rabta test dobara (setting wahi ho tab bhi); 'Invalid data' / web timeout ki saaf wajah; ok clip aate hi purana ✕ test saaf.
//  v1.4 (2026-11-09) — v1.4: ffmpeg RTSP user:password ko %-decode NAHI karta — encodeURIComponent se "@" / "#" wala password
//  hamesha 401 deta; ab password jaisa likha (sirf / ? # % space ho to saaf paigham). Rabta test mein 🌐 web login jaanch (HTTP digest magicBox) — RTSP
//  aur web dono 401 = asal password / lock; web ✓ + RTSP 401 = RTSP ki setting.
//  v1.3 (2026-11-09) — v1.3: 401 (password) par FORAN ruko — har bill × 2 koshish = Dahua admin LOCK (DMSS bhi band ho jata); setting badle tab hi dobara + pehle
//  🔎 RABTA TEST (2 s live stream) → billClipPc.test {at, ok, err, raw} app setup mein; 401 wale bill setting badalne par dobara.
//  v1.2 (2026-11-09) — v1.2: sirf camera ON hone (on0) ke baad ke bill kaatna (pehle wale = skip, NVR se purani video ka ghanta bhar ka bojh nahi); app ko on0.
//  v1.1 (2026-11-08) — v1.1: clip ka waqt bill BANANE / PRINT ke waqt se (`ct`, pos-sales-dekho v2.4) — posting se nahi (malik: "Abdurehman ne jis time
//  bill bana kar print kiya, PC us time se peeche jaye, posting ke waqt se nahi"); ct na mile to SaleDate ka waqt, phir post ka waqt. Default pehle 45 s · baad 20 s.
//  v1.0 (2026-11-08) — 🎥 HAR POS BILL KI CHHOTI VIDEO (counter camera) → app "👀 Bill tally"
//  Malik (8 Nov): "maal chori hota hai — larka bill par kam likh de to kaise pakrein? Camera wala banda ghar par hai, app mein
//  us ki apni screen; ek insaan ek waqt mein items + video dono dekh kar zyada se zyada parchiyan tally kar sake."
//
//  Kaam (server PC, doctor chalata hai — bill-clip-auto.bat):
//    • posSales/<aaj> (pos-sales-dekho har ½ s likhta hai) sunta hai → har POSTED bill (ps 2, pt = post ka waqt) ke liye
//      us counter (bill ka `pc` = system ka naam) ke camera se NVR ki recording ka tukda: post se `pre` s pehle → post ke `post` s baad
//      (default 45 + 10 = 55 s) — ffmpeg (ffmpeg-static, apne folder clip-mods\ mein, C:\khata-sync\node_modules ko kabhi nahi chhuta)
//      RTSP PLAYBACK se (Dahua: /cam/playback?channel=N&subtype=1&starttime=… · Hikvision: /Streaming/tracks/N01?starttime=…) → 360p, 8 fps,
//      bina awaz, H.264 (~½ MB) → Firestore billClip/<SaleID>_<i> {b: Bytes ≤ 900 KB hisse} + billClip/<SaleID> {no, day, pt, pc, p, t, by, n, sz, dur, st 'ok'}.
//      Ghalti = st 'err' + wajah (app mein dikhe — khamosh nahi), 3 koshish (NVR recording 1-2 min peeche likhti hai, is liye post ke 90 s baad hi kaatna).
//    • Ek waqt mein EK clip (CPU). Purani clip `keep` din (default 2) baad khud mit jati (meta + hisse). billTally 60 din.
//    • Setting SIRF app se (malik, blueAccess/billClip — malik ke ilawa koi nahi parh sakta): {on, kind dahua|hik, ip, port, user, pw, sub, pre, post, keep,
//      ch: {"Bilal (server)": 1, "Abdurehman": 2, "Mithu": 3}} — NVR ka password Firestore mein malik-only doc (9 Oct ka faisla: camera password app se).
//    • Haal blueAccess/billClipPc {at, ok, err, ff, today {n, ok, err}, last, q} — app (⚙️ / patti) dikhati hai.
//    • Shaam `rep` (default 20:30) malik ko WhatsApp (waOut, naya number) ek line: "👀 Aaj N bill tally · ✕ M (naam ×k …)" — sirf jab kuch tally hua ho.
//  POS mein KUCH nahi likhta (SQL bhi nahi parhta — sab posSales se). AI NAHI. Lock 47843. Log: bill-clip-log.txt.
// =========================================================
const path = require('path');
const fs = require('fs');
const net = require('net');
const os = require('os');
const { spawn, exec } = require('child_process');
const ZINDA = (() => { try { return require('./zinda.js')(__filename, {}); } catch (e) { const f = path.join(__dirname, path.basename(__filename, '.js') + '.alive'); setInterval(() => { try { fs.writeFileSync(f, String(Date.now())); } catch {} }, 30000); return { guard: fn => fn }; } })();
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const DIR = __dirname, BUSINESS_ID = 'noor-traders', LOCK_PORT = 47843, VER = '2.5';
const MODS = path.join(DIR, 'clip-mods'), TMP = path.join(DIR, 'clip-tmp'), REC = path.join(DIR, 'clip-rec'), NPM_FILE = path.join(MODS, 'npm-at.json');
if (!getApps().length) initializeApp({ credential: cert(require(path.join(DIR, 'firebase-key.json'))) });
const db = getFirestore(), biz = db.collection('businesses').doc(BUSINESS_ID), CLIP = biz.collection('billClip'), TALLY = biz.collection('billTally');
const log = (...a) => console.log(`[${new Date().toLocaleTimeString()}]`, ...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PK = 5 * 3600000, dayOf = t => new Date((Number(t) || Date.now()) + PK).toISOString().slice(0, 10);
const within = (p, ms, what) => { let t; return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(Error(`${what} ne ${ms / 1000} s mein jawab nahi diya`)), ms); })]).finally(() => clearTimeout(t)); };
const CHUNK = 900 * 1024;

// ---------- setting (malik, app ⚙️) ----------
let CF = { on: false, kind: 'dahua', ip: '', port: 554, user: 'admin', pw: '', sub: 1, pre: 45, post: 20, keep: 2, ch: {}, rep: '20:30', maxs: 630, rk: 180 };
let cfReady = false;
function cfApply(d) {
  d = d || {};
  CF = { on: d.on !== false && !!d.ip, kind: /hik/i.test(d.kind || '') ? 'hik' : 'dahua', ip: String(d.ip || '').trim(), port: Math.max(1, Math.min(65535, Number(d.port) || 554)),
    user: String(d.user || 'admin').trim(), pw: String(d.pw || ''), sub: d.sub === 0 || d.sub === '0' ? 0 : 1,
    pre: d.pre === 0 || d.pre === '0' ? 0 : Math.max(10, Math.min(600, Number(d.pre) || 300)), post: Math.max(0, Math.min(90, Number(d.post) || 20)), rk: Math.max(30, Math.min(720, Number(d.rk) || 180)), keep: Math.max(1, Math.min(7, Number(d.keep) || 2)),
    ch: (d.ch && typeof d.ch === 'object') ? d.ch : {}, rep: /^\d{1,2}:\d{2}$/.test(String(d.rep || '')) ? String(d.rep) : '20:30', maxs: Math.max(30, Math.min(700, Number(d.maxs) || 630)) };
  cfReady = true;
}
let ON0 = 0;   // v1.2: camera kab ON hua (app `onAt`, purani setting = aakhri save `at`) — us se pehle ke bill nahi; PC restart par bhi wahi
let AUTHBAD = 0, cfSig = '', TEST = null;   // v1.3: 401 aaya = ruko jab tak user / password / IP / port na badle
biz.collection('blueAccess').doc('billClip').onSnapshot(s => { const d0 = s.exists ? s.data() : null; cfApply(d0);
  // v1.5: sig mein cfg.at = har Save naya Rabta test
  const sig = [CF.on, CF.kind, CF.ip, CF.port, CF.user, CF.pw, CF.sub, Number(d0 && d0.at) || 0].join('|'); if (sig !== cfSig) { const first = !cfSig; cfSig = sig; AUTHBAD = 0; for (const [k, v] of known) if (v.st === 'err') known.set(k, { st: 'err', tries: 0, at: 0 }); if (CF.on && CF.ip) setTimeout(() => rabta().catch(e => log('⚠️ rabta: ' + e.message)), first ? 20000 : 1500); recStopAll('setting badli'); } recSync(); ON0 = CF.on ? (Number(d0 && (d0.onAt || d0.at)) || Date.now()) : 0; log(`⚙️ setting: ${CF.on ? 'ON' : 'band'} · ${CF.kind} ${CF.ip || '(NVR ka IP nahi)'} · counters ${Object.keys(CF.ch).length} · ${CF.pre === 0 ? 'pehli item' : CF.pre + ' s'}+${CF.post} s`); kick(); }, e => log('⚠️ setting: ' + e.message));

// ---------- haal (app ke liye) ----------
let ST = { ff: '', err: '', last: '', q: 0 }, T = { day: '', n: 0, ok: 0, err: 0 }, stAt = 0;
async function pushSt(force) {
  if (!force && Date.now() - stAt < 20000) return; stAt = Date.now();
  const day = dayOf(); if (T.day !== day) T = { day, n: 0, ok: 0, err: 0 };
  try { await biz.collection('blueAccess').doc('billClipPc').set({ at: Date.now(), ver: VER, host: os.hostname(), on: CF.on, on0: ON0, pcs: Object.keys(CF.ch || {}).filter(k => Number(CF.ch[k]) > 0).slice(0, 12), ff: ST.ff ? 1 : 0, err: ST.err.slice(0, 160), last: ST.last.slice(0, 120), q: ST.q, today: { ...T }, test: TEST || null, rec: recState() }, { merge: true }); } catch (e) { log('⚠️ haal: ' + e.message); }
}

// ---------- ffmpeg (ffmpeg-static — apne folder mein) ----------
let ffTried = 0;
function ffPath() {
  if (ST.ff && fs.existsSync(ST.ff)) return ST.ff;
  try { const p = require(require.resolve('ffmpeg-static', { paths: [MODS] })); if (p && fs.existsSync(p)) { ST.ff = p; return p; } } catch {}
  return '';
}
function ffInstall() {
  if (Date.now() - ffTried < 30 * 60000) return; ffTried = Date.now();
  try { fs.mkdirSync(MODS, { recursive: true }); const pj = path.join(MODS, 'package.json'); if (!fs.existsSync(pj)) fs.writeFileSync(pj, JSON.stringify({ name: 'clip-mods', private: true, description: 'bill-clip.js ka ffmpeg (ffmpeg-static) — alag folder, C:\\khata-sync\\node_modules se alag' }, null, 1)); } catch {}
  log('📦 ffmpeg (ffmpeg-static) install ho raha hai — pehli dafa 1-3 min (≈ 80 MB)…'); ST.err = 'ffmpeg install ho raha hai (pehli dafa 1-3 min)'; pushSt(true);
  exec('npm install ffmpeg-static@5.2.0 --no-audit --no-fund --loglevel=error', { cwd: MODS, windowsHide: true, timeout: 15 * 60000, maxBuffer: 8 << 20 }, er => {
    if (er) { log('✕ npm install ffmpeg-static: ' + String(er.message).split(/\r?\n/)[0].slice(0, 160)); ST.err = 'ffmpeg install nahi hua — PC log (bill-clip-log.txt)'; }
    else { log('📦 ffmpeg aa gaya'); ST.err = ''; }
    try { fs.writeFileSync(NPM_FILE, JSON.stringify({ at: Date.now(), ok: !er })); } catch {}
    pushSt(true); kick();
  });
}

// ---------- NVR playback URL ----------
const two = n => String(n).padStart(2, '0');
function localParts(t) { const d = new Date(t); return { Y: d.getFullYear(), M: two(d.getMonth() + 1), D: two(d.getDate()), h: two(d.getHours()), m: two(d.getMinutes()), s: two(d.getSeconds()) }; }
function playUrl(ch, t0, t1) {
  const u = credOf(CF.user), p = credOf(CF.pw), a = localParts(t0), b = localParts(t1);
  if (CF.kind === 'hik') {   // Hikvision ISAPI RTSP playback (local time, 'Z' ke baghair bhi chalta — NVR ka apna waqt)
    const tr = two(ch) + (CF.sub ? '02' : '01');
    return `rtsp://${u}:${p}@${CF.ip}:${CF.port}/Streaming/tracks/${tr}?starttime=${a.Y}${a.M}${a.D}T${a.h}${a.m}${a.s}Z&endtime=${b.Y}${b.M}${b.D}T${b.h}${b.m}${b.s}Z`;
  }
  return `rtsp://${u}:${p}@${CF.ip}:${CF.port}/cam/playback?channel=${ch}&subtype=${CF.sub}&starttime=${a.Y}_${a.M}_${a.D}_${a.h}_${a.m}_${a.s}&endtime=${b.Y}_${b.M}_${b.D}_${b.h}_${b.m}_${b.s}`;
}
const safeUrl = s => String(s).replace(/(rtsp:\/\/[^:/@]+:)[^@]*@/, '$1****@');

function ffCut(url, dur, out) {   // RTSP → mp4 (360p, 8 fps, bina awaz); jawab {ok, err}
  return new Promise(res => {
    const ff = ffPath(); if (!ff) return res({ ok: false, err: 'ffmpeg nahi' });
    const args = ['-hide_banner', '-loglevel', 'error', '-nostdin', '-rtsp_transport', 'tcp', '-timeout', '15000000', '-i', url, '-t', String(dur), '-an',
      '-vf', 'fps=8,scale=\'min(640,iw)\':-2', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '30', '-profile:v', 'main', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-y', out];
    let err = '', done = false; const p = spawn(ff, args, { windowsHide: true });
    const t = setTimeout(() => { if (!done) { try { p.kill(); } catch {} err += ' (waqt khatam 3 min)'; } }, 3 * 60000);
    p.stderr.on('data', d => { err += String(d); if (err.length > 4000) err = err.slice(-4000); });
    p.on('error', e => { done = true; clearTimeout(t); res({ ok: false, err: e.message }); });
    p.on('close', code => { done = true; clearTimeout(t); let sz = 0; try { sz = fs.statSync(out).size; } catch {} res(code === 0 && sz > 2000 ? { ok: true } : { ok: false, err: (err.trim().split(/\r?\n/).filter(Boolean).pop() || `ffmpeg code ${code}`).replace(CF.pw ? new RegExp(CF.pw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g') : /$^/, '****') }); });
  });
}
function hint(err) {   // malik ko samajh aane wali wajah
  const e = String(err || '');
  if (/\b401\b|unauthori[sz]ed/i.test(e)) return 'NVR ka user / password ghalat (401) — ya ghalat koshishon se NVR ne admin 30 min ke liye band kiya';
  if (/\b404\b|not found|no such/i.test(e)) return 'NVR par ye channel / waqt ki recording nahi (404) — channel number ya recording dekhein';
  if (/\b453\b|forbidden|\b403\b/i.test(e)) return 'NVR user ko Playback ki ijazat nahi (NVR → User → Playback ✓)';
  if (/timed? ?out|connection refused|no route|network is unreachable|ehostunreach/i.test(e)) return 'NVR tak rasta nahi (IP / LAN dekhein)';
  if (/ffmpeg nahi/.test(e)) return 'ffmpeg abhi install nahi hua';
  if (/invalid data found/i.test(e)) return 'NVR ne video nahi di (NVR restart ho raha / RTSP band / port 554 ghalat) — 2 min baad ⚙️ Save';
  return e.slice(0, 140);
}

// v1.4: ffmpeg RTSP auth "user:pass" ko %-decode nahi karta — jaisa likha waisa bhejo (av_url_split aakhri @ leta hai, pehla : user/pass alag)
const credOf = x => String(x || '').replace(/[\s/?#]/g, c => encodeURIComponent(c));
const badPw = () => /[\s/?#%]/.test(CF.pw) || /[:@\s/?#%]/.test(CF.user);
// v1.4: 🌐 web login jaanch — HTTP digest (Dahua magicBox / Hik ISAPI deviceInfo) — RTSP se alag: dono 401 = password / lock
function webCheck() {
  const http = require('http'), crypto = require('crypto'), md5 = x => crypto.createHash('md5').update(x).digest('hex');
  const pth = CF.kind === 'hik' ? '/ISAPI/System/deviceInfo' : '/cgi-bin/magicBox.cgi?action=getDeviceType';
  const get = (auth) => new Promise(res => { const rq = http.get({ host: CF.ip, port: 80, path: pth, headers: auth ? { Authorization: auth } : {}, timeout: 8000 }, r => { let b = ''; r.on('data', d => { b += d; if (b.length > 2000) b = b.slice(0, 2000); }); r.on('end', () => res({ st: r.statusCode, h: r.headers, b })); }); rq.on('timeout', () => { rq.destroy(); res({ st: 0, b: 'timeout' }); }); rq.on('error', e => res({ st: 0, b: e.message })); });
  return (async () => {
    const r1 = await get(''); if (r1.st !== 401) return { st: r1.st, b: r1.b };
    const wa = String(r1.h['www-authenticate'] || ''), g = k => (wa.match(new RegExp(k + '="?([^",]+)"?', 'i')) || [])[1] || '';
    if (!/digest/i.test(wa)) { const r = await get('Basic ' + Buffer.from(CF.user + ':' + CF.pw).toString('base64')); return { st: r.st, b: r.b }; }
    const realm = g('realm'), nonce = g('nonce'), qop = /auth/.test(g('qop')) ? 'auth' : '', opq = g('opaque'), nc = '00000001', cn = crypto.randomBytes(8).toString('hex');
    const ha1 = md5(`${CF.user}:${realm}:${CF.pw}`), ha2 = md5(`GET:${pth}`), resp = qop ? md5(`${ha1}:${nonce}:${nc}:${cn}:${qop}:${ha2}`) : md5(`${ha1}:${nonce}:${ha2}`);
    const auth = `Digest username="${CF.user}", realm="${realm}", nonce="${nonce}", uri="${pth}", response="${resp}"` + (qop ? `, qop=${qop}, nc=${nc}, cnonce="${cn}"` : '') + (opq ? `, opaque="${opq}"` : '');
    const r2 = await get(auth); return { st: r2.st, b: r2.b };
  })();
}
// ---------- 🔎 rabta test (v1.3): live stream 2 s — password / IP / port pakka hai ya nahi ----------
async function rabta() {
  if (!CF.on || !CF.ip) return;
  if (!ffPath()) { ffInstall(); return; }
  const ch = Number(Object.values(CF.ch).find(v => Number(v) > 0)) || 1, u = credOf(CF.user), p = credOf(CF.pw);
  const url = CF.kind === 'hik' ? `rtsp://${u}:${p}@${CF.ip}:${CF.port}/Streaming/Channels/${ch}0${CF.sub ? 2 : 1}` : `rtsp://${u}:${p}@${CF.ip}:${CF.port}/cam/realmonitor?channel=${ch}&subtype=${CF.sub}`;
  fs.mkdirSync(TMP, { recursive: true }); const out = path.join(TMP, 'rabta.mp4');
  if (badPw()) { TEST = { at: Date.now(), ch, ok: 0, err: 'password / user mein / ? # % ya space hai — RTSP par nahi chalta; NVR par sirf harf + number wala password rakhein', raw: '' }; AUTHBAD = Date.now(); pushSt(true); return; }
  let web = null; try { web = await webCheck(); } catch (e) { web = { st: 0, b: e.message }; }
  const wtxt = !web ? '' : web.st === 200 ? '🌐 web login ✓' + (String(web.b).match(/type=([^\r\n]+)/) ? ' (' + String(web.b).match(/type=([^\r\n]+)/)[1].trim().slice(0, 30) + ')' : '') : web.st === 401 ? '🌐 web login bhi ✕ 401' + (/lock/i.test(web.b) ? ' — LOCKED' : '') : '🌐 web ' + (web.st || '✕') + ' ' + String(web.b || '').slice(0, 60);
  const r = await ffCut(url, 2, out); try { fs.unlinkSync(out); } catch {}
  TEST = { at: Date.now(), ch, ok: r.ok ? 1 : 0, web: wtxt, err: r.ok ? '' : hint(r.err), raw: r.ok ? wtxt : (wtxt + ' · ' + String(r.err || '').replace(/rtsp:\/\/[^@\s]*@/g, 'rtsp://****@')).slice(0, 260) };
  if (!r.ok && /401/.test(TEST.err)) AUTHBAD = Date.now();
  if (r.ok) recSync();
  log(`🔎 rabta test ch ${ch}: ${r.ok ? '✓ NVR se live video mili (password theek)' : '✕ ' + TEST.err + ' — ' + TEST.raw}`);
  pushSt(true); kick();
}


// ---------- 🎞 LOCAL RECORDING (v2.0): har camera ki live sub-stream 1-1 min ke tukron mein (clip-rec\ch<N>\s-YYYYMMDD-HHMMSS.mp4) ----------
const recs = new Map();   // ch → { p, at, errs, restarts, dead, lastErr }
function liveUrl(ch) { const u = credOf(CF.user), p = credOf(CF.pw); return CF.kind === 'hik' ? `rtsp://${u}:${p}@${CF.ip}:${CF.port}/Streaming/Channels/${ch}0${CF.sub ? 2 : 1}` : `rtsp://${u}:${p}@${CF.ip}:${CF.port}/cam/realmonitor?channel=${ch}&subtype=${CF.sub}`; }
function recChannels() { const s = new Set(); for (const v of Object.values(CF.ch)) if (Number(v) > 0) s.add(Number(v)); return [...s]; }
function recDir(ch) { return path.join(REC, 'ch' + ch); }
function segList(ch) {   // [{f, t0, t1}] waqt ke mutabiq (file ke naam se — PC ka local waqt)
  let names = []; try { names = fs.readdirSync(recDir(ch)).filter(f => /^s-\d{8}-\d{6}\.mp4$/.test(f)).sort(); } catch { return []; }
  const out = names.map(f => { const m = f.match(/^s-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/); return { f: path.join(recDir(ch), f), t0: new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime(), t1: 0 }; });
  for (let i = 0; i < out.length; i++) { out[i].t1 = i + 1 < out.length ? out[i + 1].t0 : Math.min(out[i].t0 + 60000, Date.now()); }
  return out;
}
function recStart(ch) {
  if (recs.get(ch)?.p) return; const ff = ffPath(); if (!ff || !CF.on || !CF.ip || AUTHBAD) return;
  const dir = recDir(ch); fs.mkdirSync(dir, { recursive: true });
  const st = recs.get(ch) || { errs: 0, restarts: 0 }; recs.set(ch, st);
  // v2.4 🔗: isi rabte ki copy PC ke andar (udp 127.0.0.1:48500+ch, mpegts) — live-cam v1.2 wahi leti hai, NVR par doosra rabta nahi (NVR doosra nahi deta: live "error -138").
  //   Sunne wala na ho = packet zaya (koi nuqsan nahi). HIFAZAT: is ke saath recording 2 dafa 20 s ke andar gire = copy band (purani args), 30 min baad ek koshish, 3 dafa = pakka band.
  if (st.noShare && (st.shOff || 0) < 3 && Date.now() - st.noShare > 30 * 60000) st.noShare = 0;
  const share = !st.noShare && ch < 1000;
  const args = ['-hide_banner', '-loglevel', 'error', '-nostdin', '-rtsp_transport', 'tcp', '-timeout', '15000000', '-i', liveUrl(ch), '-an', '-c:v', 'copy',
    '-f', 'segment', '-segment_time', '60', '-reset_timestamps', '1', '-segment_format', 'mp4', '-segment_format_options', 'movflags=+frag_keyframe+empty_moov+default_base_moof', '-strftime', '1', path.join(dir, 's-%Y%m%d-%H%M%S.mp4'),
    ...(share ? ['-an', '-c:v', 'copy', '-f', 'mpegts', '-flush_packets', '1', `udp://127.0.0.1:${48500 + ch}?pkt_size=1316`] : [])];
  const p = spawn(ff, args, { windowsHide: true }); let err = '';
  st.p = p; st.at = Date.now(); st.dead = 0; st.lastErr = '';
  p.stderr.on('data', d => { err += String(d); if (err.length > 2000) err = err.slice(-2000); });
  p.on('error', e => { err += ' ' + e.message; });
  p.on('close', code => {
    st.p = null; st.dead = Date.now(); st.restarts++; st.lastErr = (err.trim().split(/\r?\n/).filter(Boolean).pop() || `code ${code}`).replace(/rtsp:\/\/[^@\s]*@/g, 'rtsp://****@').slice(0, 200);
    if (Date.now() - st.at < 20000) st.errs++; else st.errs = 0;   // 20 s se pehle gira = ghalti
    if (share) { if (Date.now() - st.at < 20000) { st.shErr = (st.shErr || 0) + 1; if (st.shErr >= 2) { st.noShare = Date.now(); st.shOff = (st.shOff || 0) + 1; st.shErr = 0; log(`🔗 rec ch ${ch}: live ki copy ke saath 2 dafa giri — copy band (recording purane tareeqe se)`); } } else st.shErr = 0; }
    if (/\b401\b|unauthori[sz]ed/i.test(err)) { AUTHBAD = Date.now(); log(`⛔ rec ch ${ch}: 401 — sab recording band (password / lock)`); recStopAll('401'); ST.err = hint(err); pushSt(true); return; }
    log(`🎞 rec ch ${ch} ruk gayi (${st.lastErr}) — ${Math.min(60, 5 * Math.max(1, st.errs))} s baad dobara`);
    setTimeout(() => recSync(), Math.min(60, 5 * Math.max(1, st.errs)) * 1000);
  });
  log(`🎞 rec ch ${ch} shuru → ${dir}${share ? ' · 🔗 live copy :' + (48500 + ch) : ''}`);
}
function recStopAll(why) { for (const [ch, st] of recs) if (st.p) { try { st.p.kill(); } catch {} st.p = null; } if (why && recs.size) log(`🎞 recording band (${why})`); }
function recSync() {   // jo channel setting mein hain wahi chalein; baqi band
  if (!cfReady) return;
  const want = CF.on && CF.ip && !AUTHBAD && ffPath() ? recChannels() : [];
  for (const [ch, st] of recs) if (!want.includes(ch) && st.p) { try { st.p.kill(); } catch {} st.p = null; }
  for (const ch of want) recStart(ch);
}
function recTick() {   // watchdog + safai (har 30 s)
  const now = Date.now();
  for (const [ch, st] of recs) {
    if (!st.p) continue;
    const l = segList(ch); const last = l.length ? l[l.length - 1] : null; let fresh = 0; if (last) { try { fresh = fs.statSync(last.f).mtimeMs; } catch {} }
    if (now - st.at > 150000 && (!last || now - fresh > 150000)) { log(`🎞 rec ch ${ch}: 2.5 min se nayi video nahi — dobara`); try { st.p.kill(); } catch {} }
  }
  try { for (const ch of recChannels()) for (const x of segList(ch)) if (now - x.t0 > CF.rk * 60000) { try { fs.unlinkSync(x.f); } catch {} } } catch {}
  try { for (const d of fs.readdirSync(REC)) { const ch = Number((d.match(/^ch(\d+)$/) || [])[1]); if (ch && !recChannels().includes(ch)) for (const f of fs.readdirSync(path.join(REC, d))) { try { fs.unlinkSync(path.join(REC, d, f)); } catch {} } } } catch {}
}
function recState() { const o = {}; for (const [ch, st] of recs) { const l = segList(ch); const last = l.length ? l[l.length - 1] : null; o[ch] = { on: st.p ? 1 : 0, n: l.length, last: last ? last.t0 : 0, err: st.p ? '' : (st.lastErr || '').slice(0, 120) }; } return o; }
function recCover(ch, t0, t1) {   // tukre jo [t0, t1] dhakte hon — poora dhaka ho to list, warna null
  const l = segList(ch).filter(x => x.t1 > t0 - 2000 && x.t0 < t1 + 2000); if (!l.length) return null;
  if (l[0].t0 > t0 + 15000) return null; if (l[l.length - 1].t1 < t1 - 15000) return null;
  for (let i = 1; i < l.length; i++) if (l[i].t0 - l[i - 1].t1 > 10000) return null;
  return l;
}
// ---------- encode → 60-60 s ke hisse (360p, 8 fps, bina awaz) ----------
function ffSegs(inArgs, ss, dur, outDir) {
  return new Promise(res => {
    const ff = ffPath(); if (!ff) return res({ ok: false, err: 'ffmpeg nahi' });
    fs.mkdirSync(outDir, { recursive: true });
    const args = ['-hide_banner', '-loglevel', 'error', '-nostdin', ...inArgs, ...(ss > 0 ? ['-ss', String(ss)] : []), '-t', String(dur), '-an',
      '-vf', 'fps=8,scale=\'min(640,iw)\':-2', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '30', '-profile:v', 'main', '-pix_fmt', 'yuv420p', '-g', '48', '-force_key_frames', 'expr:gte(t,n_forced*60)',
      '-f', 'segment', '-segment_time', '60', '-reset_timestamps', '1', '-segment_format', 'mp4', '-segment_format_options', 'movflags=+faststart', '-y', path.join(outDir, 'p-%02d.mp4')];
    let err = '', done = false; const p = spawn(ff, args, { windowsHide: true });
    const t = setTimeout(() => { if (!done) { try { p.kill(); } catch {} err += ' (waqt khatam 12 min)'; } }, 12 * 60000);
    p.stderr.on('data', d => { err += String(d); if (err.length > 4000) err = err.slice(-4000); });
    p.on('error', e => { done = true; clearTimeout(t); res({ ok: false, err: e.message }); });
    p.on('close', code => { done = true; clearTimeout(t); let files = []; try { files = fs.readdirSync(outDir).filter(f => /^p-\d+\.mp4$/.test(f)).sort().map(f => path.join(outDir, f)).filter(f => { try { return fs.statSync(f).size > 2000; } catch { return false; } }); } catch {}
      res(code === 0 && files.length ? { ok: true, files } : { ok: false, err: (err.trim().split(/\r?\n/).filter(Boolean).pop() || `ffmpeg code ${code}`).replace(CF.pw ? new RegExp(CF.pw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g') : /$^/, '****') }); });
  });
}
const rmDir = d => { try { for (const f of fs.readdirSync(d)) { try { fs.unlinkSync(path.join(d, f)); } catch {} } fs.rmdirSync(d); } catch {} };

// ---------- 🔵 un-posted bill ki clip hukum par (billClipReq/<SaleID> {st new, by, at, no, day}) ----------
const reqs = new Map();
biz.collection('billClipReq').where('st', '==', 'new').onSnapshot(s => { reqs.clear(); s.forEach(d => reqs.set(d.id, d.data() || {})); if (reqs.size) log(`🔵 ${reqs.size} bill ki clip ka hukum`); kick(); }, e => log('⚠️ billClipReq: ' + e.message));
async function reqDone(id, st, err) { try { await biz.collection('billClipReq').doc(String(id)).set({ st, err: err || '', doneAt: Date.now() }, { merge: true }); } catch (e) { log('⚠️ req: ' + e.message); } reqs.delete(String(id)); }

// ---------- bills → queue ----------
// v1.1: clip ka langar = bill banane / print ka waqt (ct) › SaleDate ka waqt (00:00 nahi) › post ka waqt
const anchorOf = b => { const ct = Number(b.ct) || 0, tm = Number(b.tm) || 0, pt = Number(b.pt) || 0; if (ct > 0) return ct; if (tm > 0 && (tm % 86400000) !== (19 * 3600000) && Math.abs(pt - tm) < 12 * 3600000 && tm < pt + 60000) return tm; return pt; };   // Pakistan 00:00 = UTC 19:00 (tm % din = 19 h) → sirf tareekh = pt
let bills = [], billsDay = '', known = new Map(), busy = false, kickT = null, lastQ = 0;
biz.collection('posSales').doc(dayOf()).onSnapshot(s => { const x = s.exists ? s.data() : null; bills = x && Array.isArray(x.bills) ? x.bills : []; billsDay = dayOf(); kick(); }, e => log('⚠️ posSales: ' + e.message));
let dayWatch = dayOf();
setInterval(() => { const d = dayOf(); if (d !== dayWatch) { dayWatch = d; process.exit(0); } }, 60000);   // naya din = naya listener (bat / doctor dobara) — saada
async function loadKnown() {   // aaj + kal ke clip docs (dobara na banein)
  try {
    const days = [dayOf(), dayOf(Date.now() - 86400000)];
    const s = await within(CLIP.where('day', 'in', days).get(), 30000, 'billClip parhna');
    s.forEach(d => { const x = d.data() || {}; const pw = x.st === 'err' && /401/.test(String(x.err || '')); known.set(d.id, { st: x.st, tries: pw ? 0 : Number(x.tries) || 0, at: pw ? 0 : Number(x.at) || 0 }); });   // v1.3: 401 wale dobara (password theek hone par)
    log(`📼 pehle se ${known.size} clip (aaj / kal)`);
  } catch (e) { log('⚠️ purani clips: ' + e.message); }
}
// v2.5: 🎯 PEHLI ITEM ka asal waqt — counter NT-PRINT v1.32 POS screen par har item judne ka waqt posAdds/<HOST> mein likhta hai.
//   Bill ki pehli item = us counter ke pichhle bill ke baad se is bill ke print tak ke ADD (beech mein 4 min se bara waqfa = pichhla kaam, wahan ruk).
//   Counter ki ghari alag ho sakti hai -> off = (server ko mila − counter ka now) ka sab se chhota namoona.
const PC_DEFAULT = { 'DESKTOP-8BR23BF': 'Mithu', 'DESKTOP-KEIME1D': 'Abdurehman', 'DESKTOP-Q1SLV77': 'Bilal (server)' };
const pcNames = () => { try { return { ...PC_DEFAULT, ...(JSON.parse(fs.readFileSync(path.join(__dirname, 'local-config.json'), 'utf8')).pcNames || {}) }; } catch { return PC_DEFAULT; } };
const ADDS = new Map(); let addsFirst = true;
biz.collection('posAdds').onSnapshot(s => { const names = pcNames(), now = Date.now();
  s.docChanges().forEach(c => { if (c.type === 'removed') return; const x = c.doc.data() || {}, host = String(x.host || c.doc.id).toUpperCase(), nm = String(names[host] || host.replace(/^DESKTOP-/i, ''));
    const a = (Array.isArray(x.a) ? x.a : []).map(Number).filter(t => t > 0).sort((p, q) => p - q), o = ADDS.get(nm) || { off: 0, n: 0 };
    if (!addsFirst && Number(x.now) > 0) { const d = now - Number(x.now); if (Math.abs(d) < 6 * 3600000) { o.off = o.n ? Math.min(o.off, d) : d; o.n++; } }
    o.a = a; ADDS.set(nm, o); });
  addsFirst = false; }, e => log('⚠️ posAdds: ' + e.message));
function addStart(b) {
  const pc = String(b.pc || ''), e = ADDS.get(pc); if (!e || !e.a || !e.a.length) return 0;
  const an = anchorOf(b), id = String(b.id); let prev = 0;
  for (const x of bills) { if (!x || x.x || String(x.pc || '') !== pc || String(x.id) === id) continue; const a2 = anchorOf(x); if (a2 < an - 1000 && a2 > prev) prev = a2; }
  const lo = Math.max(prev + 1500, an - 20 * 60000), hi = an + 8000; let st = 0, last = 0;
  for (let i = e.a.length - 1; i >= 0; i--) { const t = e.a[i] + (e.off || 0); if (t > hi) continue; if (t < lo) break; if (last && last - t > 4 * 60000) break; st = t; last = t; }
  return st;
}
function kick() { if (kickT) return; kickT = setTimeout(() => { kickT = null; work().catch(e => log('❌ ' + (e.stack || e.message))); }, 1500); }
function pick() {
  const now = Date.now(), out = [];
  for (const b of bills) {
    if (!b || b.x) continue;
    const id = String(b.id), k = known.get(id), rq = reqs.has(id);   // v2.0: rq = app ka hukum (un-posted bhi)
    const posted = Number(b.ps) === 2 && Number(b.pt) > 0, printed = Number(b.ct) > 0;   // v2.5: PRINT hote hi clip — post ka intezar nahi
    if (!rq && (!(posted || printed) || !(Number(b.n) > 0))) continue;
    if (k && (k.st === 'ok' || k.st === 'skip' || k.tries >= 3 || (k.st === 'err' && now - k.at < 2 * 60000))) { if (rq && k.st === 'ok') reqDone(id, 'ok'); continue; }
    const ch = Number(CF.ch[b.pc] ?? CF.ch[String(b.pc || '').toLowerCase()]) || 0;
    const rec = ch && recs.get(ch)?.p ? 20 : 90;   // v2.0: apni recording = 20 s baad hi; NVR playback 1-2 min peeche likhta — 90 s
    const lt = Number(b.lt) || 0, endAt = Math.max(anchorOf(b), lt > anchorOf(b) && lt - anchorOf(b) < 20 * 60000 ? lt : 0, 0);   // v2.3: aakhri item ke baad hi
    if (now - endAt < (CF.post + rec) * 1000) continue;
    if (!rq && now - anchorOf(b) > CF.keep * 86400000) continue;
    if (!rq && !posted && now - anchorOf(b) > (CF.rk - 5) * 60000) continue;   // un-posted chhapa bill sirf jab tak apni recording (rk min) mein ho — purane ka NVR playback nahi (bojh)
    if (!rq && ON0 && anchorOf(b) < ON0 - 10 * 60000) continue;   // v1.2: camera ON se pehle ke bill nahi (10 min ki gunjaish)
    out.push(b);
  }
  return out.sort((a, b) => (reqs.has(String(b.id)) - reqs.has(String(a.id))) || (Number(a.pt || a.ct) - Number(b.pt || b.ct)));   // hukum wale pehle, phir purana pehle (koi reh na jaye)
}
async function work() {
  if (busy) return; busy = true;
  try {
    if (!cfReady) return;
    const q = pick(); ST.q = q.length; if (q.length !== lastQ) { lastQ = q.length; pushSt(true); }
    if (!CF.on) { ST.err = CF.ip ? 'band (⚙️ se ON karein)' : 'NVR ka IP nahi — app ⚙️ Bill tally setup'; recStopAll(''); pushSt(); return; }
    if (!ffPath()) { ffInstall(); return; }
    if (AUTHBAD) { ST.err = 'NVR ka user / password ghalat (401) — ruka hua; ⚙️ mein theek kar ke Save karein (ghalat koshishon se NVR admin band kar deta)'; pushSt(); return; }
    ST.err = '';
    for (const b of q) {
      if (!cfReady || !CF.on || AUTHBAD) break;
      await one(b);
      pushSt(true);
    }
    pushSt();
  } finally { busy = false; if (!AUTHBAD && pick().length && CF.on && ffPath()) kick(); }
}
async function one(b) {
  const id = String(b.id), ch = Number(CF.ch[b.pc] ?? CF.ch[String(b.pc || '').toLowerCase()]) || 0;
  const k = known.get(id) || { tries: 0 }; const tries = (k.tries || 0) + 1;
  const base = { no: String(b.no || ''), day: billsDay || dayOf(b.pt || b.ct), pt: Number(b.pt) || 0, tm: Number(b.tm) || 0, ct: Number(b.ct) || 0, an: anchorOf(b), pc: String(b.pc || ''), p: String(b.p || ''), t: Number(b.t) || 0, by: String(b.by || ''), nl: Number(b.n) || 0, at: Date.now(), tries, ver: VER };
  if (!ch) {   // counter ka camera lagaya hi nahi — skip (malik ⚙️ mein chip lagaye)
    known.set(id, { st: 'skip', tries, at: Date.now() });
    await CLIP.doc(id).set({ ...base, st: 'skip', err: `counter "${b.pc || '?'}" ka camera channel ⚙️ mein nahi` }, { merge: true });
    if (reqs.has(id)) reqDone(id, 'err', `counter "${b.pc || '?'}" ka camera channel ⚙️ mein nahi`);
    T.n++; T.err++; ST.last = `#${b.no} skip (counter ${b.pc || '?'} ka channel nahi)`; return;
  }
  const an = anchorOf(b), ft = Number(b.ft) || 0, lt = Number(b.lt) || 0;
  const t1 = (lt > an && lt - an < 20 * 60000 ? lt : an) + CF.post * 1000;   // v2.3: AAKHRI item tak (POS ka 'print' waqt bill khatam hone se pehle ka hota hai — malik: "6 items ke baad video phir se shuru")
  const as = CF.pre === 0 ? addStart(b) : 0;
  let t0 = CF.pre === 0 ? (as > 0 ? as - 12000 : ft > 0 && ft < an - 20000 && an - ft < 20 * 60000 ? ft - 15000 : an - 120000) : an - CF.pre * 1000;
  if (t1 - t0 > CF.maxs * 1000) t0 = t1 - CF.maxs * 1000;   // v2.2: pehli item se (ft) — na ho / ajeeb ho to 2 min
  const dur = Math.min(CF.maxs, Math.max(20, Math.round((t1 - t0) / 1000))), rq = reqs.has(id) ? 1 : 0;
  fs.mkdirSync(TMP, { recursive: true }); const outDir = path.join(TMP, 'b' + id); rmDir(outDir);
  const tA = Date.now(); let r, src = 'rec', url = '';
  const cov = recCover(ch, t0, t1);
  if (cov) {   // v2.0: apni recording ke tukron se — foran
    const lst = path.join(TMP, 'b' + id + '.txt'); fs.writeFileSync(lst, cov.map(x => `file '${x.f.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n') + '\n');
    r = await ffSegs(['-f', 'concat', '-safe', '0', '-i', lst], Math.max(0, (t0 - cov[0].t0) / 1000), dur, outDir); try { fs.unlinkSync(lst); } catch {}
    if (!r.ok) log(`⚠️ bill #${b.no}: apni recording se nahi bani (${r.err}) — NVR playback`);
  }
  if (!r || !r.ok) {   // NVR playback (purana raasta — PC band tha / tukre nahi)
    src = 'nvr'; url = playUrl(ch, t0, t1); const IN = u => ['-rtsp_transport', 'tcp', '-timeout', '15000000', '-i', u];
    const r1 = await ffSegs(IN(url), 0, dur, outDir); r = r1;
    if (!r.ok && CF.kind === 'dahua' && CF.sub && !/\b401\b|unauthori/i.test(r.err)) { rmDir(outDir); const r2 = await ffSegs(IN(url.replace('subtype=1', 'subtype=0')), 0, dur, outDir); if (r2.ok) r = r2; else r.err = r.err + ' | main: ' + r2.err; }   // sub stream record na ho to main
  }
  if (!r.ok) {
    known.set(id, { st: 'err', tries, at: Date.now() });
    const why = hint(r.err); if (/401/.test(why)) { AUTHBAD = Date.now(); known.set(id, { st: 'err', tries: 0, at: 0 }); recStopAll('401'); }   // v1.3: password ka masla bill ki ghalti nahi — setting theek hote hi dobara
    await CLIP.doc(id).set({ ...base, st: 'err', err: why, raw: String(r.err || '').slice(0, 300), rq }, { merge: true });
    if (rq && tries >= 3) reqDone(id, 'err', why);
    T.n++; T.err++; ST.last = `#${b.no} ✕ ${why}`; ST.err = why; log(`✕ bill #${b.no} (ch ${ch}, ${dur} s, ${src}): ${why}${url ? ' — ' + safeUrl(url).slice(0, 120) : ''}`);
    rmDir(outDir); return;
  }
  // v2.0: har 60 s ka hissa alag (billClip/<id>_s<i>_<j>) — app pehla hissa aate hi chalati hai
  const segs = [], pk = []; let sz = 0;
  for (let i = 0; i < r.files.length; i++) {
    const buf = fs.readFileSync(r.files[i]); const n = Math.ceil(buf.length / CHUNK);
    for (let j = 0; j < n; j++) { const did = `${id}_s${i}_${j}`; await CLIP.doc(did).set({ b: buf.subarray(j * CHUNK, (j + 1) * CHUNK), i, j, id }); pk.push(did); }
    segs.push({ n, sz: buf.length, d: Math.min(60, dur - i * 60) }); sz += buf.length;
  }
  rmDir(outDir);
  await CLIP.doc(id).set({ ...base, st: 'ok', v: 2, segs, pk, n: 0, sz, dur, ch, sub: CF.sub, src, rq, ft, as, lt: Number(b.lt) || 0, t0, err: FieldValue.delete(), raw: FieldValue.delete() }, { merge: true });
  known.set(id, { st: 'ok', tries, at: Date.now() });
  if (rq) reqDone(id, 'ok');
  ST.err = '';   // v2.1: kamyab clip = purana ⚠ (ek bill ki wajah) app mein foran saaf
  if (TEST && !TEST.ok) { TEST = { ...TEST, ok: 1, err: '', raw: 'clip ban gayi — rabta theek' }; }   // v1.5: asal clip ban gayi = purana ✕ test bekar
  T.n++; T.ok++; ST.last = `#${b.no} ✓ ${Math.round(sz / 1024)} KB · ${dur} s · ${segs.length} hisse (${src})`; log(`🎥 bill #${b.no} (${b.pc} ch ${ch}) ${dur} s → ${Math.round(sz / 1024)} KB, ${segs.length} hisse · ${src} · ${Math.round((Date.now() - tA) / 1000)} s`);
}

// ---------- safai: purani clips (keep din) + billTally 60 din ----------
async function cleanup() {
  try {
    const cut = dayOf(Date.now() - CF.keep * 86400000);
    const s = await within(CLIP.where('day', '<', cut).limit(60).get(), 60000, 'purani clips');
    let n = 0;
    for (const d of s.docs) { const x = d.data() || {}; const parts = Number(x.n) || 0; const batch = db.batch(); for (let i = 0; i < parts; i++) batch.delete(CLIP.doc(d.id + '_' + i)); for (const k of (Array.isArray(x.pk) ? x.pk : []).slice(0, 400)) batch.delete(CLIP.doc(String(k))); batch.delete(d.ref); await batch.commit(); known.delete(d.id); n++; }
    if (n) log(`🧹 ${n} purani clip hata di (${cut} se pehle)`);
    try { const s3 = await within(biz.collection('billClipReq').where('at', '<', Date.now() - 3 * 86400000).limit(100).get(), 30000, 'purane hukum'); if (s3.size) { const b3 = db.batch(); s3.forEach(d => b3.delete(d.ref)); await b3.commit(); } } catch {}
    const cut2 = dayOf(Date.now() - 60 * 86400000);
    const s2 = await within(TALLY.where('day', '<', cut2).limit(100).get(), 60000, 'purani tally'); if (s2.size) { const b2 = db.batch(); s2.forEach(d => b2.delete(d.ref)); await b2.commit(); log(`🧹 ${s2.size} purani tally (60 din)`); }
  } catch (e) { log('⚠️ safai: ' + e.message); }
}

// ---------- shaam ki ek line malik ko (waOut, naya number) ----------
let repDay = '';
async function report() {
  const day = dayOf(); if (repDay === day) return;
  const [h, m] = CF.rep.split(':').map(Number); const now = new Date(Date.now() + PK); const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
  if (mins < h * 60 + m || mins > h * 60 + m + 90) return;   // 90 min ki khirki (PC der se on ho to bhi)
  repDay = day;
  try {
    const s = await within(TALLY.where('day', '==', day).get(), 30000, 'tally'); if (!s.size) return;
    let ok = 0, bad = 0; const by = {}, who = {};
    s.forEach(d => { const x = d.data() || {}; if (x.ok) ok++; else { bad++; const k = x.by2 || x.pc || '?'; by[k] = (by[k] || 0) + 1; } const w = x.n || '?'; who[w] = (who[w] || 0) + 1; });
    const badS = Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ×${v}`).join(', ');
    const txt = `👀 *Bill tally aaj*: ${ok + bad} bill dekhe · ✓ ${ok} · ✕ ${bad}${bad ? ` (${badS})` : ''}\nTally kiya: ${Object.entries(who).map(([k, v]) => `${k} ${v}`).join(', ')}`;
    let to = ''; try { const w = await biz.collection('blueAccess').doc('waParchi').get(); const f = w.exists ? w.data().prFrom : null; to = Array.isArray(f) ? String(f[0] || '') : String(f || ''); } catch {}
    if (!to) to = '03450412515';
    await biz.collection('waOut').doc('bt-' + day).create({ st: 'new', at: Date.now(), to, nm: 'Malik', kind: 'rem', eid: 'bt-' + day, txt });
    log('📲 shaam ka hisaab malik ko: ' + txt.replace(/\n/g, ' · '));
  } catch (e) { if (!/already exists/i.test(e.message)) log('⚠️ shaam ka hisaab: ' + e.message); }
}

async function main() {
  log(`🎥 bill-clip v${VER} shuru — ${os.hostname()} · lock ${LOCK_PORT}`);
  await loadKnown();
  fs.mkdirSync(REC, { recursive: true });
  pushSt(true);
  setInterval(ZINDA.guard ? ZINDA.guard(() => { recTick(); recSync(); kick(); pushSt(); report(); }, 10 * 60000, 'tick') : () => { recTick(); recSync(); kick(); pushSt(); report(); }, 30000);
  process.on('exit', () => recStopAll(''));
  setInterval(() => cleanup().catch(() => {}), 60 * 60000); setTimeout(() => cleanup().catch(() => {}), 90000);
  kick();
}
const lock = net.createServer();
lock.once('error', () => { console.log(`[${new Date().toLocaleTimeString()}] bill-clip pehle se chal raha hai (lock ${LOCK_PORT})`); process.exit(3); });
lock.listen(LOCK_PORT, '127.0.0.1', () => main().catch(e => { log('❌ ' + (e.stack || e.message || e)); setTimeout(() => process.exit(1), 5000); }));
