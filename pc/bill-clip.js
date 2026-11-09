// =========================================================
//  bill-clip.js  v1.5 (2026-11-09) — v1.5: har 💾 Save par Rabta test dobara (setting wahi ho tab bhi); 'Invalid data' / web timeout ki saaf wajah; ok clip aate hi purana ✕ test saaf.
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
const DIR = __dirname, BUSINESS_ID = 'noor-traders', LOCK_PORT = 47843, VER = '1.5';
const MODS = path.join(DIR, 'clip-mods'), TMP = path.join(DIR, 'clip-tmp'), NPM_FILE = path.join(MODS, 'npm-at.json');
if (!getApps().length) initializeApp({ credential: cert(require(path.join(DIR, 'firebase-key.json'))) });
const db = getFirestore(), biz = db.collection('businesses').doc(BUSINESS_ID), CLIP = biz.collection('billClip'), TALLY = biz.collection('billTally');
const log = (...a) => console.log(`[${new Date().toLocaleTimeString()}]`, ...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PK = 5 * 3600000, dayOf = t => new Date((Number(t) || Date.now()) + PK).toISOString().slice(0, 10);
const within = (p, ms, what) => { let t; return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(Error(`${what} ne ${ms / 1000} s mein jawab nahi diya`)), ms); })]).finally(() => clearTimeout(t)); };
const CHUNK = 900 * 1024;

// ---------- setting (malik, app ⚙️) ----------
let CF = { on: false, kind: 'dahua', ip: '', port: 554, user: 'admin', pw: '', sub: 1, pre: 45, post: 20, keep: 2, ch: {}, rep: '20:30', maxs: 120 };
let cfReady = false;
function cfApply(d) {
  d = d || {};
  CF = { on: d.on !== false && !!d.ip, kind: /hik/i.test(d.kind || '') ? 'hik' : 'dahua', ip: String(d.ip || '').trim(), port: Math.max(1, Math.min(65535, Number(d.port) || 554)),
    user: String(d.user || 'admin').trim(), pw: String(d.pw || ''), sub: d.sub === 0 || d.sub === '0' ? 0 : 1,
    pre: Math.max(10, Math.min(180, Number(d.pre) || 45)), post: Math.max(0, Math.min(90, Number(d.post) || 20)), keep: Math.max(1, Math.min(7, Number(d.keep) || 2)),
    ch: (d.ch && typeof d.ch === 'object') ? d.ch : {}, rep: /^\d{1,2}:\d{2}$/.test(String(d.rep || '')) ? String(d.rep) : '20:30', maxs: Math.max(30, Math.min(180, Number(d.maxs) || 120)) };
  cfReady = true;
}
let ON0 = 0;   // v1.2: camera kab ON hua (app `onAt`, purani setting = aakhri save `at`) — us se pehle ke bill nahi; PC restart par bhi wahi
let AUTHBAD = 0, cfSig = '', TEST = null;   // v1.3: 401 aaya = ruko jab tak user / password / IP / port na badle
biz.collection('blueAccess').doc('billClip').onSnapshot(s => { const d0 = s.exists ? s.data() : null; cfApply(d0);
  const sig = [CF.on, CF.kind, CF.ip, CF.port, CF.user, CF.pw, CF.sub, Number(d0 && d0.at) || 0].join('|');   // v1.5: har Save = naya test if (sig !== cfSig) { const first = !cfSig; cfSig = sig; AUTHBAD = 0; for (const [k, v] of known) if (v.st === 'err') known.set(k, { st: 'err', tries: 0, at: 0 }); if (CF.on && CF.ip) setTimeout(() => rabta().catch(e => log('⚠️ rabta: ' + e.message)), first ? 20000 : 1500); } ON0 = CF.on ? (Number(d0 && (d0.onAt || d0.at)) || Date.now()) : 0; log(`⚙️ setting: ${CF.on ? 'ON' : 'band'} · ${CF.kind} ${CF.ip || '(NVR ka IP nahi)'} · counters ${Object.keys(CF.ch).length} · ${CF.pre}+${CF.post} s`); kick(); }, e => log('⚠️ setting: ' + e.message));

// ---------- haal (app ke liye) ----------
let ST = { ff: '', err: '', last: '', q: 0 }, T = { day: '', n: 0, ok: 0, err: 0 }, stAt = 0;
async function pushSt(force) {
  if (!force && Date.now() - stAt < 20000) return; stAt = Date.now();
  const day = dayOf(); if (T.day !== day) T = { day, n: 0, ok: 0, err: 0 };
  try { await biz.collection('blueAccess').doc('billClipPc').set({ at: Date.now(), ver: VER, host: os.hostname(), on: CF.on, on0: ON0, ff: ST.ff ? 1 : 0, err: ST.err.slice(0, 160), last: ST.last.slice(0, 120), q: ST.q, today: { ...T }, test: TEST || null }, { merge: true }); } catch (e) { log('⚠️ haal: ' + e.message); }
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
  log(`🔎 rabta test ch ${ch}: ${r.ok ? '✓ NVR se live video mili (password theek)' : '✕ ' + TEST.err + ' — ' + TEST.raw}`);
  pushSt(true); kick();
}

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
function kick() { if (kickT) return; kickT = setTimeout(() => { kickT = null; work().catch(e => log('❌ ' + (e.stack || e.message))); }, 1500); }
function pick() {
  const now = Date.now(), out = [];
  for (const b of bills) {
    if (!b || b.x || Number(b.ps) !== 2 || !(Number(b.pt) > 0) || !(Number(b.n) > 0)) continue;
    const id = String(b.id), k = known.get(id);
    if (k && (k.st === 'ok' || k.st === 'skip' || k.tries >= 3 || (k.st === 'err' && now - k.at < 2 * 60000))) continue;
    if (now - Math.max(anchorOf(b), 0) < (CF.post + 90) * 1000) continue;   // NVR recording 1-2 min peeche likhti — jaldi kaatna = adhoori / khali clip
    if (now - Number(b.pt) > CF.keep * 86400000) continue;
    if (ON0 && anchorOf(b) < ON0 - 10 * 60000) continue;   // v1.2: camera ON se pehle ke bill nahi (10 min ki gunjaish)
    out.push(b);
  }
  return out.sort((a, b) => Number(a.pt) - Number(b.pt));   // purana pehle (koi reh na jaye)
}
async function work() {
  if (busy) return; busy = true;
  try {
    if (!cfReady) return;
    const q = pick(); ST.q = q.length; if (q.length !== lastQ) { lastQ = q.length; pushSt(true); }
    if (!CF.on) { ST.err = CF.ip ? 'band (⚙️ se ON karein)' : 'NVR ka IP nahi — app ⚙️ Bill tally setup'; pushSt(); return; }
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
  const base = { no: String(b.no || ''), day: billsDay || dayOf(b.pt), pt: Number(b.pt) || 0, tm: Number(b.tm) || 0, ct: Number(b.ct) || 0, an: anchorOf(b), pc: String(b.pc || ''), p: String(b.p || ''), t: Number(b.t) || 0, by: String(b.by || ''), nl: Number(b.n) || 0, at: Date.now(), tries, ver: VER };
  if (!ch) {   // counter ka camera lagaya hi nahi — skip (malik ⚙️ mein chip lagaye)
    known.set(id, { st: 'skip', tries, at: Date.now() });
    await CLIP.doc(id).set({ ...base, st: 'skip', err: `counter "${b.pc || '?'}" ka camera channel ⚙️ mein nahi` }, { merge: true });
    T.n++; T.err++; ST.last = `#${b.no} skip (counter ${b.pc || '?'} ka channel nahi)`; return;
  }
  const an = anchorOf(b), t1 = an + CF.post * 1000, t0 = an - CF.pre * 1000, dur = Math.min(CF.maxs, Math.round((t1 - t0) / 1000));
  fs.mkdirSync(TMP, { recursive: true }); const out = path.join(TMP, id + '.mp4');
  const url = playUrl(ch, t0, t1);
  const tA = Date.now(); let r = await ffCut(url, dur, out);
  if (!r.ok && CF.kind === 'dahua' && CF.sub && !/\b401\b|unauthori/i.test(r.err)) { const r2 = await ffCut(url.replace('subtype=1', 'subtype=0'), dur, out); if (r2.ok) r = r2; else r.err = r.err + ' | main: ' + r2.err; }   // sub stream record na ho to main
  if (!r.ok) {
    known.set(id, { st: 'err', tries, at: Date.now() });
    const why = hint(r.err); if (/401/.test(why)) { AUTHBAD = Date.now(); known.set(id, { st: 'err', tries: 0, at: 0 }); }   // v1.3: password ka masla bill ki ghalti nahi — setting theek hote hi dobara
    await CLIP.doc(id).set({ ...base, st: 'err', err: why, raw: String(r.err || '').slice(0, 300) }, { merge: true });
    T.n++; T.err++; ST.last = `#${b.no} ✕ ${why}`; ST.err = why; log(`✕ bill #${b.no} (ch ${ch}, ${dur} s): ${why} — ${safeUrl(url).slice(0, 120)}`);
    try { fs.unlinkSync(out); } catch {} return;
  }
  const buf = fs.readFileSync(out); try { fs.unlinkSync(out); } catch {}
  const n = Math.ceil(buf.length / CHUNK);
  for (let i = 0; i < n; i++) await CLIP.doc(id + '_' + i).set({ b: buf.subarray(i * CHUNK, (i + 1) * CHUNK), i, id });   // hisse mein `day` NAHI (safai ki query sirf meta pakre)
  await CLIP.doc(id).set({ ...base, st: 'ok', n, sz: buf.length, dur, ch, sub: CF.sub, err: FieldValue.delete(), raw: FieldValue.delete() }, { merge: true });
  known.set(id, { st: 'ok', tries, at: Date.now() });
  if (TEST && !TEST.ok) { TEST = { ...TEST, ok: 1, err: '', raw: 'clip ban gayi — rabta theek' }; }   // v1.5: asal clip ban gayi = purana ✕ test bekar
  T.n++; T.ok++; ST.last = `#${b.no} ✓ ${Math.round(buf.length / 1024)} KB · ${dur} s`; log(`🎥 bill #${b.no} (${b.pc} ch ${ch}) ${dur} s → ${Math.round(buf.length / 1024)} KB, ${n} hisse · ${Math.round((Date.now() - tA) / 1000)} s`);
}

// ---------- safai: purani clips (keep din) + billTally 60 din ----------
async function cleanup() {
  try {
    const cut = dayOf(Date.now() - CF.keep * 86400000);
    const s = await within(CLIP.where('day', '<', cut).limit(60).get(), 60000, 'purani clips');
    let n = 0;
    for (const d of s.docs) { const x = d.data() || {}; const parts = Number(x.n) || 0; const batch = db.batch(); for (let i = 0; i < parts; i++) batch.delete(CLIP.doc(d.id + '_' + i)); batch.delete(d.ref); await batch.commit(); known.delete(d.id); n++; }
    if (n) log(`🧹 ${n} purani clip hata di (${cut} se pehle)`);
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
  pushSt(true);
  setInterval(ZINDA.guard ? ZINDA.guard(() => { kick(); pushSt(); report(); }, 10 * 60000, 'tick') : () => { kick(); pushSt(); report(); }, 30000);
  setInterval(() => cleanup().catch(() => {}), 60 * 60000); setTimeout(() => cleanup().catch(() => {}), 90000);
  kick();
}
const lock = net.createServer();
lock.once('error', () => { console.log(`[${new Date().toLocaleTimeString()}] bill-clip pehle se chal raha hai (lock ${LOCK_PORT})`); process.exit(3); });
lock.listen(LOCK_PORT, '127.0.0.1', () => main().catch(e => { log('❌ ' + (e.stack || e.message || e)); setTimeout(() => process.exit(1), 5000); }));
