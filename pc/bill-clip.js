// =========================================================
//  bill-clip.js  v2.13 (2026-11-20: ⚡ malik: 'bill ki video WhatsApp par aur tez' + 'last item (red lobia) NT print par OK ho to agla safha khud':
//    patti ka safha ab NT-PRINT ke ADD waqt (posAdds) se — pichhle safhe ki AAKHRI item judne ke 2 s baad agla safha (agli item pehle aa jaye to usi waqt);
//    ADD na milein / ginti ajeeb = purana 5 s ka chakkar. Raftar: apni recording ka intezar 20 → 8 s · har bill ka apna timer (tayyar hote hi, 30 s ka
//    chakkar nahi) · 👥 group video line 'a' ke saath hi (app clip ka intezar nahi; dohra nahi — gwSeen) · group faasla 20 → 10 s · items ka intezar 20 s tak.)
//  v2.12 (2026-11-20: ⚡ malik: 'en ki speed tez karo — BHT slow' (clip 2 ghante peeche) + '2-3 cameras ki ikatthi recording':
//    DO LINE saath saath — 'taza' (naya bill PEHLE, sirf PC ki apni recording se, NVR ka intezar kabhi nahi) + 'purana' (purana pehle, NVR playback bhi);
//    ek bill ek hi line mein (inProg). ffSegs: -ss ab -i se PEHLE (pura minute decode nahi). Har Firestore likhai par hadd (atke to aage, bill ghalti gin kar).
//    billClipPc.ln {a, b: {n, ms, cur}} + nvr = app mein 'ek clip N s'. 🎥 billClipCam/<SaleID>~<key> {st new, cam, sid} → counter clip ka WAHI t0 + dur doosre
//    camera ki recording se → billClip/<SaleID>~<key> (x 1, cam) — sirf recording ON camera, NVR par naya rabta nahi.)
//  v2.11 (2026-11-20: 🪟 patti DAAYEIN patli column (malik: 'aik side par — right side') — ovPlan x0 = W-10-cw (214), 12 items fi safha.
//  v2.10 (2026-11-19: 📹 malik: 'live likhein -> camera ke naam -> number -> abhi ki tasveer / pichhle 30 sec … 30 min ki video, tarteeb se ·
//    counter ke ilawa mazeed cameras · kisi ki recording chalu karni ho to wo bhi': CF.xc [{n, ch, r}] (mazeed cameras, r = recording), billClipWa kind 'live'
//    (kh-wa v1.12) -> lvOne: 📸 taza tukre ka aakhri frame / RTSP (recording band ho to) · 🎥 apni recording se 5-5 min ke hisse -> SIRF maangne wale ko.
//    billClipPc.cams [{n, c, r, on}] = app / WhatsApp ki list.) · v2.9 (2026-11-19: 👥 malik: 'din mein jitni videos banein SAB WhatsApp group mein · counter-wise · video ke upar transparent
//    items naam + tadad · background nazar aaye, blur nahi': har kamyab clip → mkVideo (patti: gol kinara + kaale kinare wali likhai, canvas 640x480) →
//    waOut bv-g<SaleID> {grp} → wa-out v1.28 group mein; blueAccess/billWaGroup {on, g, gd, gn, lim 400, end 22:00}, 20 s faasla, billClip.wg (dobara nahi).
//    Maangi hui video (malik + Mubeen) par bhi wohi patti.) · v2.8 (2026-11-18: 🎥 malik: "bill number likhein to us ki video hamare aur Mubeen ke WhatsApp par full speed se — customer ko wait na karna pare": billClipWa/<id>
//    (app ⋮ 📲 ya WhatsApp 'video 138841', kh-wa v1.11) → bill dhoondo (aaj / kal / parson) → bani clip ke hisse jor kar (copy) ya PC ki apni recording se → wa-media\bv-<id>.mp4
//    → waOut bv-<id>-1/2 {vf, rid} → wa-out v1.27 video malik + Mubeen ko (gahak ko KABHI nahi). NVR se dobara nahi (malik: "us ko rehne do").) · v2.7 (2026-11-17: 🌐 NVR tak rasta nahi (Windows ffmpeg 'Error number -138' = waqt khatam — 17 Nov aaj ki 628 clip ✕) = har bill par 15 s koshish NAHI: kaam ruke, har 5 min halka TCP sawal, rasta khule to wahi bill dobara (koshish nahi gini); server PC ke IP + NVR IP + isi network par camera port (554) khula kahan — app ⚙️ mein (billClipPc.net). Counter ka naam = PC ka apna naam (pc-names v1.1, chFind).) · v2.6 (2026-11-16: counter ka naam NT-PRINT se — pc-names.js; purane naam ka channel bhi chalta) ·  v2.5 (2026-11-10) — 🎯 pehli item ka ASAL waqt counter ki POS screen se (posAdds, NT-PRINT v1.32) + clip PRINT hote hi (post ka intezar nahi)
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
const RD = require('./rec-dir.js');   // v2.16: 💽 recording kahan
const DIR = __dirname, BUSINESS_ID = 'noor-traders', LOCK_PORT = 47843, VER = '2.23';   // v2.23 (24 Nov): sirf pc-names v1.2 ke liye dobara shuru (KEIME1D ka camera ab RN6QU6D ka) · v2.22 (23 Nov raat, malik: 'recording ko PC mein save karne ki zaroorat nahi — sab cameras ki screen record ho'): billClip.rkd 1 se kam = GHANTE (0.125 = 3 ghante, kam az kam 3) — har camera ki alag recording sirf bill / gate pass video ke liye; lambi recording = live-cam v2.3 ki 🎛 Sab cameras wali ek video (sab-rec).
// v2.20 (22 Nov, malik: 'sab model lagao godam wale cameras mein · HD kar do'): 🎞 HD recording — godam ke camera (📦 ginti / 🚪 gate pass / naam se) khud MAIN stream (HD) par record (isHd), malik ⚙️ se har camera HD on/off (billClip.hdc [{ch, hd 0|1}] — list, merge mein poori badalti); counter camera pehle jaisa chhota · HD badla = us channel ki recording naye stream se dobara · 🏬 godam ka HAR WAQIA = video: gintiEv (ginti-cam v2.0: ⬆ / ⬇ maal, 🧍 uthaya) → us godam ke 1-2 camera (gpCam) t0 − 20 s → t1 + 20 s (6 min tak) → billClip/gv~<evId> (+ gv~<evId>b) · 📹 0 (transfer note bana magar camera ne kuch nahi gina) = note ke waqt − 30 s → + 5 min billClip/gv~d-<key> (ms 1) · apni line (gvRun), SIRF apni recording · haal billClipPc.gv.
// v2.21 (22 Nov, malik: 'AI ko filhal band kar do'): gintiCam.ai (1 = chalu) na ho = godam camera ka AUTO HD band (halki recording) + 🏬 waqie ki nayi video nahi. Malik ka 🎞 HD chip (hdc) phir bhi chalta hai. Recording / bill / gate pass video wahi.
// v2.19 (21 Nov, malik: 'aik hi godam par two cameras hain — dono side by side dikha diya karo'): 🚪 har godam par 2 camera (billClip.gc [{g, c, i 1|2}], auto = 📦 ginti + naam se jitne milein, 2 tak) — har camera ki apni clip (doosra = billClip/<SaleID>~g<godam>b, ci 2), dono ka WAHI waqt · WhatsApp (group + 'video <bill>') = EK video mein ek ke upar doosra (640x720), akela = 640x360 · patti camera ki ghari ke neeche (y0 48). gpm mein cam2 / how2 / r2.
// v2.18 (21 Nov, malik: 'jis item ka gate pass banta hai us item ka godam ka camera — screen ke upar bhi + WhatsApp wali recording mein bhi'): 🚪 gatePass (PC gate-pass.js) ke har godam ka camera (malik ka chuna `billClip.gc` [{g, c}] › 📦 Loading ginti ka camera › naam se) → post se 20 s pehle → us godam ki sab items ✓ ke 1 min baad (✓ na ho = post + 10 min, max 15 min) SIRF apni recording se → billClip/<SaleID>~g<godam> (st wait → ok / err) · 👥 group mein bill video ke baad · 'video <bill>' mein bhi · alag line (gpRun) · haal billClipPc.gp + gpm (har godam ka camera).
// v2.17 (21 Nov, malik: 'time calculate kar ke dekho fi video kitna time laga'): counter clip ke meta mein `rd` (video tayyar = aakhri likhai ka waqt) + `mk` (PC ne kitne ms mein banai: rd − at) — app 📋 Bills mein har bill ka ⏱ + average.
// v2.16 (20 Nov, malik: 'PC scripts mein poora drive show karwa do — C ya D · phir selection · us mein 10 din ki video bhi pari rahe'): 💽 recording ki jagah malik ka chuna drive `billClip.rdrv` (rec-dir.js — ginti-cam bhi wahi) · din `billClip.rkd` (default 10, 1–90; v2.15 ka rkh ghante ab nahi) · purani jagah ki recording parhi jati hai aur din pure kar ke khud mitti (move nahi) · safai + hisaab har 10 min (band tukre ka size yaad) · billClipPc.drv = har drive (PowerShell Win32_LogicalDisk, har 10 min) + dk {d, free, tot, used, day, can, est, err}. Safai sirf setting aane ke baad (cfReady).
// v2.15 (20 Nov, malik: 'recording poora do din ki rehni chahiye · 750 GB ki hard pari hui hai'): recording ab GHANTON mein `billClip.rkh` (default 48 = 2 din; purana `rk` 180 min chhor diya) — 💾 hifazat: recording wali drive par 25 GB se kam jagah = 6 ghante se purane tukre pehle mitao (35 GB tak), haal billClipPc.dk {free, tot, cut}. Un-posted bill ki clip ki khirki pehle jaisi 3 ghante.
// v2.14 (20 Nov, malik: 'WhatsApp par time ka clip — hum time likhein, us waqt ki video'): 📹 live hukum mein f0 / f1 (kh-wa v1.13 '3:45' · '3:45 5' · '3:40-3:50') = USI waqt ki video apni recording (clip-rec) se — NVR nahi; recording itni purani na ho = saaf wajah + sab se purana waqt.
const MODS = path.join(DIR, 'clip-mods'), TMP = path.join(DIR, 'clip-tmp'), REC = path.join(DIR, 'clip-rec'), NPM_FILE = path.join(MODS, 'npm-at.json');
if (!getApps().length) initializeApp({ credential: cert(require(path.join(DIR, 'firebase-key.json'))) });
const db = getFirestore(), biz = db.collection('businesses').doc(BUSINESS_ID), CLIP = biz.collection('billClip'), TALLY = biz.collection('billTally');
const log = (...a) => console.log(`[${new Date().toLocaleTimeString()}]`, ...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PK = 5 * 3600000, dayOf = t => new Date((Number(t) || Date.now()) + PK).toISOString().slice(0, 10);
const within = (p, ms, what) => { let t; return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(Error(`${what} ne ${ms / 1000} s mein jawab nahi diya`)), ms); })]).finally(() => clearTimeout(t)); };
const CHUNK = 900 * 1024;

// ---------- setting (malik, app ⚙️) ----------
let CF = { on: false, kind: 'dahua', ip: '', port: 554, user: 'admin', pw: '', sub: 1, pre: 45, post: 20, keep: 2, ch: {}, rep: '20:30', maxs: 630, rk: 14400, rdrv: '' };
let cfReady = false;
function cfApply(d) {
  d = d || {};
  CF = { on: d.on !== false && !!d.ip, kind: /hik/i.test(d.kind || '') ? 'hik' : 'dahua', ip: String(d.ip || '').trim(), port: Math.max(1, Math.min(65535, Number(d.port) || 554)),
    user: String(d.user || 'admin').trim(), pw: String(d.pw || ''), sub: d.sub === 0 || d.sub === '0' ? 0 : 1,
    pre: d.pre === 0 || d.pre === '0' ? 0 : Math.max(10, Math.min(600, Number(d.pre) || 300)), post: Math.max(0, Math.min(90, Number(d.post) || 20)), rk: Number(d.rkd) > 0 && Number(d.rkd) < 1 ? Math.max(180, Math.round(Number(d.rkd) * 1440)) : (Number(d.rkd) > 0 ? Math.max(1, Math.min(90, Math.round(Number(d.rkd)))) : 10) * 1440, rdrv: RD.letter(d.rdrv), keep: Math.max(1, Math.min(7, Number(d.keep) || 2)),
    xc: (Array.isArray(d.xc) ? d.xc : []).map(x => ({ n: String((x && x.n) || '').replace(/\s+/g, ' ').trim().slice(0, 30), ch: Math.floor(Number(x && x.ch) || 0), r: x && x.r ? 1 : 0 })).filter(x => x.n && x.ch > 0 && x.ch < 1000).slice(0, 16),   // v2.10: 📹 mazeed cameras
    ch: (d.ch && typeof d.ch === 'object') ? d.ch : {}, rep: /^\d{1,2}:\d{2}$/.test(String(d.rep || '')) ? String(d.rep) : '20:30', maxs: Math.max(30, Math.min(700, Number(d.maxs) || 630)),
    hdc: (Array.isArray(d.hdc) ? d.hdc : []).reduce((o, x) => { const ch = Math.floor(Number(x && x.ch) || 0); if (ch > 0 && ch < 1000 && x && (x.hd === 0 || x.hd === 1 || x.hd === '0' || x.hd === '1')) o[ch] = Number(x.hd) ? 1 : 0; return o; }, {}),   // v2.20: 🎞 HD on/off (malik) — na ho = auto (godam camera HD)
    gpv: d.gpv !== false, gc: (Array.isArray(d.gc) ? d.gc : []).reduce((o, x) => { const g = Math.floor(Number(x && x.g) || 0), c = String((x && x.c) || '').trim().slice(0, 30), i = Number(x && x.i) === 2 ? 1 : 0; if (g > 0 && g < 10000 && c) { const k = String(g); o[k] = o[k] || ['', '']; o[k][i] = c; } return o; }, {}) };   // v2.18: 🚪 godam ka camera [{g, c ('-' = koi nahi), i (v2.19: 1 | 2 — doosra camera)}] — list (merge mein poori badalti) → {g: [slot1, slot2]} ('' = auto)
  cfReady = true;
}
let ON0 = 0;   // v1.2: camera kab ON hua (app `onAt`, purani setting = aakhri save `at`) — us se pehle ke bill nahi; PC restart par bhi wahi
let AUTHBAD = 0, cfSig = '', TEST = null;   // v1.3: 401 aaya = ruko jab tak user / password / IP / port na badle
biz.collection('blueAccess').doc('billClip').onSnapshot(s => { const d0 = s.exists ? s.data() : null; cfApply(d0); try { recRoot(); } catch (e) { log('⚠️ jagah: ' + e.message); }
  // v1.5: sig mein cfg.at = har Save naya Rabta test
  const sig = [CF.on, CF.kind, CF.ip, CF.port, CF.user, CF.pw, CF.sub, Number(d0 && d0.at) || 0].join('|'); if (sig !== cfSig) { const first = !cfSig; cfSig = sig; AUTHBAD = 0; NETBAD = 0; netScanAt = 0; for (const [k, v] of known) if (v.st === 'err') known.set(k, { st: 'err', tries: 0, at: 0 }); if (CF.on && CF.ip) setTimeout(() => rabta().catch(e => log('⚠️ rabta: ' + e.message)), first ? 20000 : 1500); recStopAll('setting badli'); } recSync(); ON0 = CF.on ? (Number(d0 && (d0.onAt || d0.at)) || Date.now()) : 0; log(`⚙️ setting: ${CF.on ? 'ON' : 'band'} · ${CF.kind} ${CF.ip || '(NVR ka IP nahi)'} · counters ${Object.keys(CF.ch).length} · ${CF.pre === 0 ? 'pehli item' : CF.pre + ' s'}+${CF.post} s`); kick(); }, e => log('⚠️ setting: ' + e.message));

// ---------- haal (app ke liye) ----------
let ST = { ff: '', err: '', last: '', q: 0 }, T = { day: '', n: 0, ok: 0, err: 0 }, stAt = 0;
async function pushSt(force) {
  if (!force && Date.now() - stAt < 20000) return; stAt = Date.now();
  const day = dayOf(); if (T.day !== day) T = { day, n: 0, ok: 0, err: 0 };
  try { await biz.collection('blueAccess').doc('billClipPc').set({ at: Date.now(), ver: VER, host: os.hostname(), on: CF.on, on0: ON0, pcs: (() => { const K = Object.keys(CF.ch || {}).filter(k => Number(CF.ch[k]) > 0); try { return [...new Set(K.map(k => PN.nowName(k)))].slice(0, 12); } catch { return K.slice(0, 12); } })(), ff: ST.ff ? 1 : 0, err: ST.err.slice(0, 160), last: ST.last.slice(0, 120), q: ST.q, today: { ...T }, ln: ST.ln || null, test: TEST || null, rec: recState(), dk: DISK, rkd: CF.rk < 1440 ? Math.round(CF.rk / 1440 * 1000) / 1000 : Math.round(CF.rk / 1440), rdrv: CF.rdrv || '', drv: drvOut(), net: NET || null, wg: ST.wg || null, gp: ST.gp || null, gv: ST.gv || null, gpm: (() => { try { return gpMapOut(); } catch { return []; } })(), cams: (() => { try { return camList().map(c => ({ n: c.n, ch: c.ch, c: c.c, r: c.r, on: recOn(c.ch) ? 1 : 0, hd: isHd(c.ch) ? 1 : 0, hdx: (CF.hdc || {})[c.ch] === undefined ? 0 : 1 })); } catch { return []; } })() }, { merge: true }); } catch (e) { log('⚠️ haal: ' + e.message); }
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
  if (netErr(e)) return 'NVR tak rasta nahi (waqt khatam) — server PC aur NVR ek network par? IP / LAN dekhein';
  if (/ffmpeg nahi/.test(e)) return 'ffmpeg abhi install nahi hua';
  if (/invalid data found/i.test(e)) return 'NVR ne video nahi di (NVR restart ho raha / RTSP band / port 554 ghalat) — 2 min baad ⚙️ Save';
  return e.slice(0, 140);
}

// v2.7: 🌐 NVR TAK RASTA — Windows par ffmpeg ka 'Error number -138 occurred' = ETIMEDOUT (rabta waqt par nahi bana). Pehle har bill 15 s + main stream
//   dobara = 628 bill sab ✕ aur 3 koshish ke baad hamesha ke liye chhoot gaye. Ab: rasta band = NETBAD (kaam ruka, recording band), har 5 min halka
//   TCP sawal (NVR:port) — khule to wahi bill dobara (koshish nahi gini). netDiag: server PC ke LAN IP, NVR ka IP, ek network (pehle 3 hisse) ya nahi,
//   aur isi network par camera port kahan khula (30 min mein ek dafa, sirf apne /24 par) -> app ⚙️ Camera setup (billClipPc.net). Setting khud nahi badalti.
const netErr = e => /error number -138\b|-10060|-10061|timed? ?out|connection refused|no route|network is unreachable|ehostunreach|etimedout|econnrefused/i.test(String(e || ''));
let NETBAD = 0, NET = null, netScanAt = 0;
function tcp(ip, port, ms) {
  return new Promise(res => { let s, done = false; const end = ok => { if (done) return; done = true; try { s && s.destroy(); } catch {} res(ok); };
    try { s = require('net').connect({ host: ip, port }); } catch { return end(false); }
    s.setTimeout(ms, () => end(false)); s.on('connect', () => end(true)); s.on('error', () => end(false)); });
}
function myIps() {
  const out = [];
  for (const L of Object.values(os.networkInterfaces() || {})) for (const a of L || []) {
    if (!a || a.internal || !(a.family === 'IPv4' || a.family === 4)) continue;
    if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address)) out.push(a.address);
  }
  return [...new Set(out)].slice(0, 4);
}
async function netDiag(scan) {
  const my = myIps(), ip = CF.ip, pre = x => String(x || '').split('.').slice(0, 3).join('.');
  const pOk = ip ? await tcp(ip, CF.port, 3000) : false, wOk = ip ? await tcp(ip, 80, 3000) : false;
  let found = (NET && NET.found) || [];
  if (scan && ip && !pOk && my.length && Date.now() - netScanAt > 30 * 60000) {
    netScanAt = Date.now(); found = [];
    for (const m of my) {
      const hs = []; for (let i = 1; i < 255; i++) { const h = pre(m) + '.' + i; if (h !== m) hs.push(h); }
      for (let i = 0; i < hs.length; i += 48) { const rs = await Promise.all(hs.slice(i, i + 48).map(h => tcp(h, CF.port, 700).then(ok => ok ? h : ''))); for (const h of rs) if (h) found.push(h); }
    }
    found = found.slice(0, 8);
    log(`🌐 NVR dhoondo (server ${my.join(', ')}): port ${CF.port} khula — ${found.join(', ') || 'kahin nahi'}`);
  }
  NET = { at: Date.now(), my, ip, port: CF.port, p554: pOk ? 1 : 0, p80: wOk ? 1 : 0, same: my.some(m => pre(m) === pre(ip)) ? 1 : 0, found };
  return pOk;
}
const netMsg = () => `NVR (${CF.ip}) tak rasta nahi — server PC ${(NET && NET.my && NET.my.join(', ')) || ''} ${NET && !NET.same ? '(alag network) ' : ''}· clips ruki hain, rasta khulte hi khud banengi`;

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
  if (!r.ok && netErr(r.err)) { try { await netDiag(true); } catch {} }   // v2.7: 🌐 rasta nahi = server / NVR ka network app mein
  if (r.ok) { NETBAD = 0; recSync(); }
  log(`🔎 rabta test ch ${ch}: ${r.ok ? '✓ NVR se live video mili (password theek)' : '✕ ' + TEST.err + ' — ' + TEST.raw}`);
  pushSt(true); kick();
}


// ---------- 🎞 LOCAL RECORDING (v2.0): har camera ki live sub-stream 1-1 min ke tukron mein (clip-rec\ch<N>\s-YYYYMMDD-HHMMSS.mp4) ----------
const recs = new Map();   // ch → { p, at, errs, restarts, dead, lastErr }
function liveUrl(ch) { const u = credOf(CF.user), p = credOf(CF.pw), sub = subOf(ch); return CF.kind === 'hik' ? `rtsp://${u}:${p}@${CF.ip}:${CF.port}/Streaming/Channels/${ch}0${sub ? 2 : 1}` : `rtsp://${u}:${p}@${CF.ip}:${CF.port}/cam/realmonitor?channel=${ch}&subtype=${sub}`; }
// v2.20: 🎞 HD — godam ke camera (📦 ginti / 🚪 gate pass / naam se, counter nahi) khud main stream; malik ka hdc har camera par aakhri faisla
function hdAuto() { const s = new Set(); if (!GAI) return s; try { for (const x of GIC) { const c = camFind(x.n); if (c && !c.c) s.add(c.ch); } const gs = new Set([...Object.keys(GN), ...Object.keys(CF.gc || {})].map(Number).filter(g => g > 1)); for (const g of gs) for (const c of gpCam(g).cs) if (!c.c) s.add(c.ch); } catch {} return s; }
function isHd(ch) { const v = (CF.hdc || {})[ch]; if (v === 1) return true; if (v === 0) return false; return hdAuto().has(Number(ch)); }
const subOf = ch => isHd(ch) ? 0 : CF.sub;
function recChannels() { const s = new Set(); for (const v of Object.values(CF.ch)) if (Number(v) > 0) s.add(Number(v)); for (const x of CF.xc || []) if (x.r) s.add(x.ch); return [...s]; }   // v2.10: mazeed camera sirf jab ⏺ recording chalu
// v2.16: 💽 likhne ki jagah (malik ka drive) + parhne ki sab jagahein
let RA = { root: REC, d: '', err: '' };
function recRoot() { const a = RD.active(DIR, CF.rdrv); const moved = path.resolve(a.root) !== path.resolve(RA.root); const was = RA.root; RA = a; if (moved) { log(`💽 recording ki jagah: ${was} → ${a.root}`); recStopAll('jagah badli'); } if (a.err && a.err !== recRoot.e) log('💽 ' + a.err); recRoot.e = a.err; return moved; }
const roots = () => RD.roots(DIR, RA.root);
function recDir(ch) { return path.join(RA.root, 'ch' + ch); }
function segList(ch) {   // [{f, t0, t1}] waqt ke mutabiq (file ke naam se — PC ka local waqt)
  const out = RD.segFiles(roots(), ch).map(x => ({ f: x.f, t0: RD.t0Of(x.n), t1: 0 }));   // v2.16: sab jagahon se (purani jagah bhi)
  for (let i = 0; i < out.length; i++) { out[i].t1 = i + 1 < out.length ? out[i + 1].t0 : Math.min(out[i].t0 + 60000, Date.now()); }
  return out;
}
function recStart(ch) {
  if (recs.get(ch)?.p) return; const ff = ffPath(); if (!ff || !CF.on || !CF.ip || AUTHBAD || NETBAD) return;
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
  st.p = p; st.at = Date.now(); st.dead = 0; st.lastErr = ''; st.sub = subOf(ch);   // v2.20: kaun sa stream (0 = HD)
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
  log(`🎞 rec ch ${ch} shuru${st.sub === 0 && CF.sub ? ' (HD)' : ''} → ${dir}${share ? ' · 🔗 live copy :' + (48500 + ch) : ''}`);
}
function recStopAll(why) { for (const [ch, st] of recs) if (st.p) { try { st.p.kill(); } catch {} st.p = null; } if (why && recs.size) log(`🎞 recording band (${why})`); }
function recSync() {   // jo channel setting mein hain wahi chalein; baqi band
  if (!cfReady) return;
  const want = CF.on && CF.ip && !AUTHBAD && !NETBAD && ffPath() ? recChannels() : [];
  for (const [ch, st] of recs) if (!want.includes(ch) && st.p) { try { st.p.kill(); } catch {} st.p = null; }
  for (const [ch, st] of recs) if (want.includes(ch) && st.p && st.sub !== subOf(ch)) { log(`🎞 rec ch ${ch}: ${subOf(ch) === 0 ? 'HD' : 'chhota'} stream par dobara`); st.errs = 0; try { st.p.kill(); } catch {} }   // v2.20: HD badla
  for (const ch of want) recStart(ch);
}
function recTick() {   // watchdog + safai (har 30 s)
  const now = Date.now();
  for (const [ch, st] of recs) {
    if (!st.p) continue;
    const l = segList(ch); const last = l.length ? l[l.length - 1] : null; let fresh = 0; if (last) { try { fresh = fs.statSync(last.f).mtimeMs; } catch {} }
    if (now - st.at > 150000 && (!last || now - fresh > 150000)) { log(`🎞 rec ch ${ch}: 2.5 min se nayi video nahi — dobara`); try { st.p.kill(); } catch {} }
  }
  try { recClean(now); } catch (e) { log('⚠️ safai: ' + e.message); }   // v2.16: har 10 min (sab jagah)
}
// v2.16: 🧹 safai + 💽 hisaab (har 10 min, setting aane ke baad): rk se purane tukre (SAB jagah), setting se nikle channel ke tukre, drive 25 GB se kam = 6 ghante se
//   purane tukre (sab se purane pehle) jab tak 35 GB na ho. Size ka hisaab: band tukre ka size yaad (SZ) — har dafa 36,000 file nahi naapte.
const GB = 1073741824, r1 = x => Math.round(x * 10) / 10, SYSD = String(process.env.SystemDrive || 'C:').slice(0, 1).toUpperCase();
let DISK = null, cleanAt = 0, USE = {}, DRV = [], drvAt = 0, drvBusy = false; const SZ = new Map();
function freeOf(dv) {
  const b = RD.base(dv) || (dv === RD.driveOf(RA.root) ? RA.root : null);
  if (b && typeof fs.statfsSync === 'function') { try { const st = fs.statfsSync(b); return { free: st.bavail * st.bsize, tot: st.blocks * st.bsize }; } catch {} }
  const x = DRV.find(y => y.d === dv); return x ? { free: x.free, tot: x.tot } : null;
}
function drvScan() {   // 💽 PC ki drives (har 10 min) — Windows: PowerShell Win32_LogicalDisk (DriveType 3 = PC ki apni hard, 2 = USB, 4 = network)
  if (drvBusy || Date.now() - drvAt < 9 * 60000) return; drvBusy = true;
  const done = a => { drvBusy = false; drvAt = Date.now(); if (a.length) DRV = a; };
  if (process.platform !== 'win32') { const a = []; for (const L of 'CDEFGH') { const b = RD.base(L); if (!b || !fs.existsSync(b)) continue; const f = freeOf(L); if (f) a.push({ d: L, t: 3, free: f.free, tot: f.tot, lbl: '' }); } return done(a); }
  exec('powershell -NoProfile -NonInteractive -Command "Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID,DriveType,FreeSpace,Size,VolumeName | ConvertTo-Json -Compress"', { timeout: 25000, windowsHide: true, maxBuffer: 1 << 20 }, (e, out) => {
    let a = []; try { a = JSON.parse(String(out || '').trim() || '[]'); if (!Array.isArray(a)) a = [a]; } catch {}
    a = a.map(x => ({ d: String((x && x.DeviceID) || '').slice(0, 1).toUpperCase(), t: Number(x && x.DriveType) || 0, free: Number(x && x.FreeSpace) || 0, tot: Number(x && x.Size) || 0, lbl: String((x && x.VolumeName) || '').slice(0, 24) })).filter(x => /^[C-Z]$/.test(x.d) && x.tot > 0);
    if (!a.length && typeof fs.statfsSync === 'function') for (const L of 'CDEFGHIJKLMNOPQRSTUVWXYZ') { try { if (!fs.existsSync(L + ':\\')) continue; const st = fs.statfsSync(L + ':\\'); a.push({ d: L, t: 0, free: st.bavail * st.bsize, tot: st.blocks * st.bsize, lbl: '' }); } catch {} }
    if (e && !a.length) log('⚠️ drives ki list nahi mili: ' + String(e.message || e).slice(0, 80));
    done(a); pushSt(true);
  });
}
function drvOut() { return DRV.slice(0, 12).map(x => { const f = freeOf(x.d) || x; return { d: x.d, t: x.t, lbl: x.lbl, free: r1(f.free / GB), tot: Math.round(f.tot / GB), sys: x.d === SYSD ? 1 : 0, rec: x.d === RD.driveOf(RA.root) ? 1 : 0, use: r1((USE[x.d] || 0) / GB) }; }); }
function recClean(now) {
  if (!cfReady || now - cleanAt < 10 * 60000) return; cleanAt = now;
  try { recRoot(); } catch {} try { drvScan(); } catch {}
  const rts = roots(), keep = new Set(recChannels()), all = [];
  for (const r of rts) { let ds = []; try { ds = fs.readdirSync(r); } catch { continue; }
    for (const d of ds) { const ch = Number((d.match(/^ch(\d+)$/) || [])[1]); if (!ch) continue; let fl = []; try { fl = fs.readdirSync(path.join(r, d)); } catch { continue; }
      for (const n of fl) { if (!/^s-\d{8}-\d{6}\.mp4$/.test(n)) continue; const f = path.join(r, d, n), t0 = RD.t0Of(n);
        if (!keep.has(ch) || now - t0 > CF.rk * 60000) { try { fs.unlinkSync(f); } catch {} SZ.delete(f); continue; }
        let sz = SZ.get(f); if (sz == null || now - t0 < 3 * 60000) { try { sz = fs.statSync(f).size; } catch { continue; } if (now - t0 >= 3 * 60000) SZ.set(f, sz); }
        all.push({ f, t0, sz, dv: RD.driveOf(f) }); } } }
  if (SZ.size > all.length + 500) { const live = new Set(all.map(x => x.f)); for (const k of SZ.keys()) if (!live.has(k)) SZ.delete(k); }
  let cut = 0; const ad = RD.driveOf(RA.root);
  for (const dv of new Set(all.map(x => x.dv).concat([ad]))) {
    const fr0 = freeOf(dv); if (!fr0 || fr0.free >= 25 * GB) continue; let fr = fr0.free, c = 0;
    const mine = all.filter(x => x.dv === dv && now - x.t0 > 6 * 3600000).sort((a, b) => a.t0 - b.t0);
    for (const x of mine) { try { fs.unlinkSync(x.f); c++; fr += x.sz; x.gone = 1; SZ.delete(x.f); } catch {} if (fr >= 35 * GB) break; }
    if (c) log(`💾 ${dv}: drive par jagah kam — ${c} purane recording tukre mitaye (ab ${(fr / GB).toFixed(1)} GB khali)`); cut += c;
  }
  const left = all.filter(x => !x.gone); USE = {}; let bytes = 0, d24 = 0, old = 0;
  for (const x of left) { USE[x.dv] = (USE[x.dv] || 0) + x.sz; bytes += x.sz; if (x.t0 > now - 86400000) d24 += x.sz; if (!old || x.t0 < old) old = x.t0; }
  let day = d24, est = 0; if (left.length && (!old || now - old < 20 * 3600000)) { day = bytes / left.length * 720 * Math.max(1, keep.size); est = 1; }   // 1 din se kam recording = andaza (PC ~12 ghante on)
  const af = freeOf(ad), can = af && day > 0 ? Math.max(0, (af.free + (USE[ad] || 0) - 25 * GB) / day) : 0;
  DISK = { d: ad, err: RA.err || '', free: af ? r1(af.free / GB) : null, tot: af ? Math.round(af.tot / GB) : null, used: r1(bytes / GB), day: r1(day / GB), est, can: Math.floor(can), old, cut, n: left.length, at: now };
}
function recState() { const o = {}; for (const [ch, st] of recs) { const l = segList(ch); const last = l.length ? l[l.length - 1] : null; o[ch] = { on: st.p ? 1 : 0, n: l.length, last: last ? last.t0 : 0, err: st.p ? '' : (st.lastErr || '').slice(0, 120), hd: st.p && st.sub === 0 && CF.sub ? 1 : 0 }; } return o; }
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
    const args = ['-hide_banner', '-loglevel', 'error', '-nostdin', ...(ss > 0 ? ['-ss', String(ss)] : []), ...inArgs, '-t', String(dur), '-an',   // v2.12: -ss input se PEHLE (seek — poora minute decode nahi)
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
    s.forEach(d => { const x = d.data() || {}; const pw = x.st === 'err' && /401/.test(String(x.err || '')); known.set(d.id, { st: x.st, tries: pw ? 0 : Number(x.tries) || 0, at: pw ? 0 : Number(x.at) || 0, wg: x.wg || 0, fin: x.fin ? 1 : 0 }); });   // v1.3: 401 wale dobara (password theek hone par) · v2.18: fin = 🚪 godam clip ki pakki ghalti
    log(`📼 pehle se ${known.size} clip (aaj / kal)`);
  } catch (e) { log('⚠️ purani clips: ' + e.message); }
}
// v2.5: 🎯 PEHLI ITEM ka asal waqt — counter NT-PRINT v1.32 POS screen par har item judne ka waqt posAdds/<HOST> mein likhta hai.
//   Bill ki pehli item = us counter ke pichhle bill ke baad se is bill ke print tak ke ADD (beech mein 4 min se bara waqfa = pichhla kaam, wahan ruk).
//   Counter ki ghari alag ho sakti hai -> off = (server ko mila − counter ka now) ka sab se chhota namoona.
const PN = require('./pc-names.js'); PN.start(biz); const pcNames = () => PN.names(__dirname);   // v2.6: naam NT-PRINT se (pc-names.js)
const ADDS = new Map(); let addsFirst = true;
biz.collection('posAdds').onSnapshot(s => { const names = pcNames(), now = Date.now();
  s.docChanges().forEach(c => { if (c.type === 'removed') return; const x = c.doc.data() || {}, host = String(x.host || c.doc.id).toUpperCase(), nm = String(names[host] || host.replace(/^DESKTOP-/i, ''));
    const a = (Array.isArray(x.a) ? x.a : []).map(Number).filter(t => t > 0).sort((p, q) => p - q), o = ADDS.get(nm) || { off: 0, n: 0 };
    if (!addsFirst && Number(x.now) > 0) { const d = now - Number(x.now); if (Math.abs(d) < 6 * 3600000) { o.off = o.n ? Math.min(o.off, d) : d; o.n++; } }
    o.a = a; ADDS.set(nm, o); });
  addsFirst = false; }, e => log('⚠️ posAdds: ' + e.message));
function addTimes(b) {   // v2.13: is bill ke SAARE ADD waqt (pehli item → print), purane se naye — counter ki ghari ka farq (off) jor kar
  const pc = String(b.pc || ''), e = ADDS.get(pc); if (!e || !e.a || !e.a.length) return [];
  const an = anchorOf(b), id = String(b.id); let prev = 0;
  for (const x of bills) { if (!x || x.x || String(x.pc || '') !== pc || String(x.id) === id) continue; const a2 = anchorOf(x); if (a2 < an - 1000 && a2 > prev) prev = a2; }
  const lo = Math.max(prev + 1500, an - 20 * 60000), hi = an + 8000, out = []; let last = 0;
  for (let i = e.a.length - 1; i >= 0; i--) { const t = e.a[i] + (e.off || 0); if (t > hi) continue; if (t < lo) break; if (last && last - t > 4 * 60000) break; out.push(t); last = t; }
  return out.reverse();
}
function addStart(b) { const a = addTimes(b); return a.length ? a[0] : 0; }
function kick() { kickLane('a'); kickLane('b'); armDue(); }   // v2.12: dono line · v2.13: agla tayyar bill ka timer
const REC_WAIT = 8;   // v2.13: apni recording (fragmented mp4 har keyframe par likhta hai) — 20 s ki zaroorat nahi
function dueOf(b) {   // bill kab clip ke qabil (aakhri item + post + recording / NVR ka intezar)
  const ch = PN.chFind(CF.ch, b.pc), rec = ch && recs.get(ch)?.p ? REC_WAIT : 90;
  const an = anchorOf(b), lt = Number(b.lt) || 0, endAt = Math.max(an, lt > an && lt - an < 20 * 60000 ? lt : 0, 0);
  return endAt + (CF.post + rec) * 1000;
}
let dueT = null, dueAt = 0;
function armDue() {   // v2.13: jo bill thori der mein tayyar hoga usi second line chalao — 30 s ke chakkar ka intezar nahi
  const now = Date.now(); let best = 0;
  for (const b of bills) {
    if (!b || b.x || !(Number(b.ct) > 0 || Number(b.pt) > 0) || !(Number(b.n) > 0)) continue;
    const k = known.get(String(b.id)); if (k && (k.st === 'ok' || k.st === 'skip' || k.tries >= 3)) continue;
    const d = dueOf(b); if (d > now && d - now < 15 * 60000 && (!best || d < best)) best = d;
  }
  if (!best || (dueT && dueAt <= best)) return;
  if (dueT) clearTimeout(dueT);
  dueAt = best; dueT = setTimeout(() => { dueT = null; dueAt = 0; kick(); }, best - now + 400);
}
function pick() {
  const now = Date.now(), out = [];
  for (const b of bills) {
    if (!b || b.x) continue;
    const id = String(b.id), k = known.get(id), rq = reqs.has(id);   // v2.0: rq = app ka hukum (un-posted bhi)
    const posted = Number(b.ps) === 2 && Number(b.pt) > 0, printed = Number(b.ct) > 0;   // v2.5: PRINT hote hi clip — post ka intezar nahi
    if (!rq && (!(posted || printed) || !(Number(b.n) > 0))) continue;
    if (k && (k.st === 'ok' || k.st === 'skip' || k.tries >= 3 || (k.st === 'err' && now - k.at < 2 * 60000) || (k.st === 'net' && NETBAD))) { if (rq && k.st === 'ok') reqDone(id, 'ok'); continue; }
    if (now < dueOf(b)) continue;   // v2.3: aakhri item ke baad hi · v2.13: apni recording = 8 s baad (pehle 20), NVR playback 90 s
    if (!rq && now - anchorOf(b) > CF.keep * 86400000) continue;
    if (!rq && !posted && now - anchorOf(b) > (Math.min(CF.rk, 180) - 5) * 60000) continue;   // un-posted chhapa bill sirf jab tak apni recording (rk min) mein ho — purane ka NVR playback nahi (bojh)
    if (!rq && ON0 && anchorOf(b) < ON0 - 10 * 60000) continue;   // v1.2: camera ON se pehle ke bill nahi (10 min ki gunjaish)
    out.push(b);
  }
  return out.sort((a, b) => (reqs.has(String(b.id)) - reqs.has(String(a.id))) || (Number(a.pt || a.ct) - Number(b.pt || b.ct)));   // hukum wale pehle, phir purana pehle (koi reh na jaye)
}
// ---------- ⚡ v2.12: DO LINE (malik 20 Nov: 'en ki speed tez karo — BHT slow') ----------
//   Pehle EK line thi, purana bill pehle — ek bill NVR playback par (asal waqt jitna) atka to sab peeche; 2 ghante purane bill ⏳.
//   Ab: 'a' TAZA = naya bill pehle, sirf PC ki apni recording wale (foran) + 🎥 doosre camera ke hukum · 'b' PURANA = purana pehle, NVR playback bhi.
//   Ek bill ek hi line mein (inProg). Line 'a' mein recording na chale = bill line 'b' ke liye chhod do (deferA), NVR kabhi nahi.
const inProg = new Set(), deferA = new Set();
const LANES = { a: { busy: false, t: null, n: 0, ms: [], cur: '' }, b: { busy: false, t: null, n: 0, ms: [], cur: '' } };
let probing = false;
function kickLane(k) { const L = LANES[k]; if (L.t) return; L.t = setTimeout(() => { L.t = null; laneRun(k).catch(e => log('❌ line ' + k + ': ' + (e.stack || e.message))); }, 1500); }
function fastOf(b) { const ch = PN.chFind(CF.ch, b.pc); if (!ch || !recs.get(ch)?.p) return false; const w = winOf(b); return !!recCover(ch, w.t0, w.t1); }
function laneNext(k) {
  const q = pick().filter(b => !inProg.has(String(b.id)));
  if (k === 'b') return q[0] || null;   // purana pehle (hukum wale sab se pehle — pick() ki tarteeb)
  const rq = q.filter(b => reqs.has(String(b.id)) && !deferA.has(String(b.id)) && fastOf(b));
  if (rq.length) return rq[0];
  const fq = q.filter(b => !deferA.has(String(b.id))).sort((a, b) => Number(b.pt || b.ct) - Number(a.pt || a.ct));   // naya pehle
  for (const b of fq.slice(0, 40)) if (fastOf(b)) return b;
  return null;
}
async function gate() {   // pehle wali work() ki jaanch — dono line ke liye
  if (!cfReady) return false;
  const q = pick(); ST.q = q.length; if (q.length !== lastQ) { lastQ = q.length; pushSt(true); }
  if (!CF.on) { ST.err = CF.ip ? 'band (⚙️ se ON karein)' : 'NVR ka IP nahi — app ⚙️ Bill tally setup'; recStopAll(''); pushSt(); return false; }
  if (!ffPath()) { ffInstall(); return false; }
  if (AUTHBAD) { ST.err = 'NVR ka user / password ghalat (401) — ruka hua; ⚙️ mein theek kar ke Save karein (ghalat koshishon se NVR admin band kar deta)'; pushSt(); return false; }
  if (NETBAD) {   // v2.7: 🌐 rasta band — har 5 min ek halka sawal, tab tak koi bill nahi
    if (probing || Date.now() - NETBAD < 5 * 60000) { ST.err = netMsg(); pushSt(); return false; }
    probing = true; let ok = false; try { ok = await netDiag(true); } catch {} finally { probing = false; }
    if (!ok) { NETBAD = Date.now(); ST.err = netMsg(); pushSt(true); return false; }
    NETBAD = 0; log('🌐 NVR ka rasta khul gaya — ruki clips ab banengi'); recSync();
  }
  return true;
}
function laneSt() { const o = {}; for (const k of ['a', 'b']) { const L = LANES[k], m = L.ms; o[k] = { n: L.n, ms: m.length ? Math.round(m.reduce((x, y) => x + y, 0) / m.length) : 0, cur: L.cur || '' }; } return o; }
async function laneRun(k) {
  const L = LANES[k]; if (L.busy) return; L.busy = true;
  try {
    if (!(await gate())) return;
    for (let n = 0; n < 300; n++) {
      if (!cfReady || !CF.on || AUTHBAD || NETBAD) break;
      if (k === 'a') { const cr = camNext(); if (cr) { await camRun(cr); continue; } }
      const b = laneNext(k); if (!b) break;
      const id = String(b.id); inProg.add(id); L.cur = '#' + (b.no || id); const tA = Date.now(); let res = '';
      if (k === 'a') gwAdd(b);   // v2.13: 👥 group video app clip ka intezar kiye baghair (isi recording se, saath saath)
      try { res = await one(b, k); }
      catch (e) { const kk = known.get(id) || {}; known.set(id, { ...kk, st: 'err', tries: (kk.tries || 0) + 1, at: Date.now() }); log(`✕ line ${k} #${b.no}: ${e.message}`); }
      finally { inProg.delete(id); L.cur = ''; }
      if (res !== 'defer') { L.n++; L.ms.push(Date.now() - tA); if (L.ms.length > 12) L.ms.shift(); }
      ST.ln = laneSt(); pushSt(true);
    }
    ST.ln = laneSt(); pushSt();
  } finally { L.busy = false; if (!AUTHBAD && !NETBAD && CF.on && ffPath() && (k === 'a' ? (camNext() || laneNext('a')) : pick().some(b => !inProg.has(String(b.id))))) kickLane(k); }   // 'a' sirf jab tez wala kaam ho (khali chakkar nahi)
}

// ---------- 🎥 v2.12: 2-3 camera ek saath (malik 20 Nov: 'aik hi time par do cameras ya teen cameras ki ikatthi recording') ----------
//   app billClipCam/<SaleID>~<key> {st new, cam (naam), sid, by, at, day} → counter clip (billClip/<SaleID>) ka WAHI t0 + dur us camera ki PC recording se →
//   billClip/<SaleID>~<key> {st ok, x 1, cam, segs, pk, t0, dur, day} (app counter video ke saath sync chalati hai). Recording band camera = saaf ghalti; NVR par naya rabta NAHI.
const CAMQ = biz.collection('billClipCam'), camReqs = new Map(), camTry = new Map();
CAMQ.where('st', '==', 'new').onSnapshot(s => { s.docChanges().forEach(c => { if (c.type === 'removed') camReqs.delete(c.doc.id); else camReqs.set(c.doc.id, c.doc.data() || {}); }); if (camReqs.size) kickLane('a'); }, e => log('⚠️ billClipCam: ' + e.message));
setInterval(() => { CAMQ.where('st', '==', 'new').limit(30).get().then(s => { s.forEach(d => { if (!camReqs.has(d.id)) camReqs.set(d.id, d.data() || {}); }); if (camReqs.size) kickLane('a'); }).catch(() => {}); }, 30000);   // qaida: onSnapshot ke saath poll
function camNext() { const now = Date.now(); for (const [id, r] of camReqs) { if (now - (camTry.get(id) || 0) < 45000) continue; return [id, r]; } return null; }
async function camDone(id, st, err, extra) {
  camReqs.delete(id); camTry.delete(id);
  try { await within(CAMQ.doc(id).set({ st, err: err || '', doneAt: Date.now() }, { merge: true }), 30000, 'cam hukum'); } catch (e) { log('⚠️ cam hukum: ' + e.message); }
  if (st !== 'ok') { try { await within(CLIP.doc(id).set({ st: 'err', x: 1, err: String(err || '').slice(0, 160), day: (extra && extra.day) || dayOf(), at: Date.now(), cam: (extra && extra.cam) || '' }, { merge: true }), 30000, 'cam clip'); } catch {} }
}
async function camRun([id, r]) {
  camTry.set(id, Date.now());
  const sid = String(r.sid || id.split('~')[0]), camN = String(r.cam || '');
  let meta = null; try { const sn = await within(CLIP.doc(sid).get(), 20000, 'counter clip'); meta = sn.exists ? sn.data() || {} : null; } catch (e) { log('⚠️ 🎥 cam: ' + e.message); return; }
  const day = (meta && meta.day) || String(r.day || '') || dayOf();
  if (!meta || meta.st !== 'ok') { if (Date.now() - (Number(r.at) || 0) > 10 * 60000) await camDone(id, 'err', 'counter ki clip abhi nahi bani', { day, cam: camN }); return; }   // abhi nahi = 45 s baad dobara
  const c = camFind(camN); if (!c) { await camDone(id, 'err', `camera "${camN}" setting mein nahi`, { day, cam: camN }); return; }
  let t0 = Number(meta.t0) || 0, dur = Number(meta.dur) || 0;
  if (!t0 || !dur) { const b = bills.find(x => String(x.id) === sid); if (b) { const w = winOf(b); t0 = w.t0; dur = w.dur; } }
  if (!t0 || !dur) { await camDone(id, 'err', 'is bill ka waqt nahi mila', { day, cam: camN }); return; }
  const cov = recCover(c.ch, t0, t0 + dur * 1000);
  if (!cov) { await camDone(id, 'err', recs.get(c.ch)?.p ? 'is waqt ki recording PC mein nahi (purana bill)' : `"${c.n}" ki ⏺ recording band hai — malik ⚙️ Camera setup se ON kare`, { day, cam: camN }); return; }
  const tA = Date.now(), outDir = path.join(TMP, 'c' + id.replace(/[^\w-]/g, '_')); rmDir(outDir); fs.mkdirSync(TMP, { recursive: true });
  const lst = outDir + '.txt'; fs.writeFileSync(lst, cov.map(x => `file '${x.f.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n') + '\n');
  const rr = await ffSegs(['-f', 'concat', '-safe', '0', '-i', lst], Math.max(0, (t0 - cov[0].t0) / 1000), dur, outDir); try { fs.unlinkSync(lst); } catch {}
  if (!rr.ok) { rmDir(outDir); await camDone(id, 'err', 'video nahi bani: ' + String(rr.err).slice(0, 100), { day, cam: camN }); return; }
  const segs = [], pk = []; let sz = 0;
  try {
    for (let i = 0; i < rr.files.length; i++) {
      const buf = fs.readFileSync(rr.files[i]); const n = Math.ceil(buf.length / CHUNK);
      for (let j = 0; j < n; j++) { const did = `${id}_s${i}_${j}`; await within(CLIP.doc(did).set({ b: buf.subarray(j * CHUNK, (j + 1) * CHUNK), i, j, id }), 60000, 'cam hissa'); pk.push(did); }
      segs.push({ n, sz: buf.length, d: Math.min(60, dur - i * 60) }); sz += buf.length;
    }
  } catch (e) { rmDir(outDir); await camDone(id, 'err', 'upload: ' + e.message, { day, cam: camN }); return; } finally { rmDir(outDir); }
  await within(CLIP.doc(id).set({ st: 'ok', x: 1, v: 2, sid, cam: c.n, ch: c.ch, segs, pk, n: 0, sz, dur, t0, day, at: Date.now(), err: FieldValue.delete() }, { merge: true }), 30000, 'cam clip');
  await camDone(id, 'ok', '', { day, cam: camN });
  log(`🎥 cam ${c.n} (ch ${c.ch}) bill ${sid} ${dur} s → ${Math.round(sz / 1024)} KB · ${Math.round((Date.now() - tA) / 1000)} s`);
}
// v2.8: clip ka waqt [t0, t1] — one() aur 🎥 WhatsApp video EK hisaab
function winOf(b) {
  const an = anchorOf(b), ft = Number(b.ft) || 0, lt = Number(b.lt) || 0;
  const t1 = (lt > an && lt - an < 20 * 60000 ? lt : an) + CF.post * 1000;   // v2.3: AAKHRI item tak (POS ka 'print' waqt bill khatam hone se pehle ka hota hai — malik: "6 items ke baad video phir se shuru")
  const as = CF.pre === 0 ? addStart(b) : 0;
  let t0 = CF.pre === 0 ? (as > 0 ? as - 12000 : ft > 0 && ft < an - 20000 && an - ft < 20 * 60000 ? ft - 15000 : an - 120000) : an - CF.pre * 1000;
  if (t1 - t0 > CF.maxs * 1000) t0 = t1 - CF.maxs * 1000;   // v2.2: pehli item se (ft) — na ho / ajeeb ho to 2 min
  const dur = Math.min(CF.maxs, Math.max(20, Math.round((t1 - t0) / 1000)));
  return { an, ft, lt, t1, as, t0, dur };
}
async function one(b, lane) {   // v2.12: lane 'a' = sirf apni recording (NVR ka intezar kabhi nahi)
  const id = String(b.id), ch = PN.chFind(CF.ch, b.pc);
  const k = known.get(id) || { tries: 0 }; const tries = (k.tries || 0) + 1;
  const base = { no: String(b.no || ''), day: billsDay || dayOf(b.pt || b.ct), pt: Number(b.pt) || 0, tm: Number(b.tm) || 0, ct: Number(b.ct) || 0, an: anchorOf(b), pc: String(b.pc || ''), p: String(b.p || ''), t: Number(b.t) || 0, by: String(b.by || ''), nl: Number(b.n) || 0, at: Date.now(), tries, ver: VER };
  if (!ch) {   // counter ka camera lagaya hi nahi — skip (malik ⚙️ mein chip lagaye)
    known.set(id, { st: 'skip', tries, at: Date.now() });
    await CLIP.doc(id).set({ ...base, st: 'skip', err: `counter "${b.pc || '?'}" ka camera channel ⚙️ mein nahi` }, { merge: true });
    if (reqs.has(id)) reqDone(id, 'err', `counter "${b.pc || '?'}" ka camera channel ⚙️ mein nahi`);
    T.n++; T.err++; ST.last = `#${b.no} skip (counter ${b.pc || '?'} ka channel nahi)`; return;
  }
  const { an, ft, lt, t1, as, t0, dur } = winOf(b), rq = reqs.has(id) ? 1 : 0;   // v2.8: hisaab winOf mein (WhatsApp video bhi wahi)
  fs.mkdirSync(TMP, { recursive: true }); const outDir = path.join(TMP, 'b' + id); rmDir(outDir);
  const tA = Date.now(); let r, src = 'rec', url = '';
  const cov = recCover(ch, t0, t1);
  if (lane === 'a' && !cov) { deferA.add(id); return 'defer'; }   // v2.12: recording nahi = line 'b' (NVR) ke liye chhoro
  if (cov) {   // v2.0: apni recording ke tukron se — foran
    const lst = path.join(TMP, 'b' + id + '.txt'); fs.writeFileSync(lst, cov.map(x => `file '${x.f.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n') + '\n');
    r = await ffSegs(['-f', 'concat', '-safe', '0', '-i', lst], Math.max(0, (t0 - cov[0].t0) / 1000), dur, outDir); try { fs.unlinkSync(lst); } catch {}
    if (!r.ok) log(`⚠️ bill #${b.no}: apni recording se nahi bani (${r.err}) — NVR playback`);
    if (!r.ok && lane === 'a') { deferA.add(id); rmDir(outDir); return 'defer'; }   // v2.12: line 'a' NVR ka intezar nahi karti
  }
  if (!r || !r.ok) {   // NVR playback (purana raasta — PC band tha / tukre nahi)
    src = 'nvr'; url = playUrl(ch, t0, t1); const IN = u => ['-rtsp_transport', 'tcp', '-timeout', '15000000', '-i', u];
    const r1 = await ffSegs(IN(url), 0, dur, outDir); r = r1;
    if (!r.ok && CF.kind === 'dahua' && CF.sub && !/\b401\b|unauthori/i.test(r.err)) { rmDir(outDir); const r2 = await ffSegs(IN(url.replace('subtype=1', 'subtype=0')), 0, dur, outDir); if (r2.ok) r = r2; else r.err = r.err + ' | main: ' + r2.err; }   // sub stream record na ho to main
  }
  if (!r.ok && netErr(r.err) && !(await tcp(CF.ip, CF.port, 3000))) {   // v2.7: 🌐 NVR tak rasta hi nahi — bill ki ghalti nahi, koshish nahi gini
    NETBAD = Date.now(); known.set(id, { st: 'net', tries: k.tries || 0, at: Date.now() });
    try { await netDiag(true); } catch {}
    const why = netMsg();
    await CLIP.doc(id).set({ ...base, st: 'err', err: why, raw: String(r.err || '').slice(0, 300), rq }, { merge: true });
    ST.last = `#${b.no} ⏸ NVR tak rasta nahi`; ST.err = why; log(`⏸ bill #${b.no} (ch ${ch}, ${src}): ${why} — ${String(r.err || '').slice(0, 120)}`);
    recStopAll('net'); rmDir(outDir); return;
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
  try { for (let i = 0; i < r.files.length; i++) {
    const buf = fs.readFileSync(r.files[i]); const n = Math.ceil(buf.length / CHUNK);
    for (let j = 0; j < n; j++) { const did = `${id}_s${i}_${j}`; await within(CLIP.doc(did).set({ b: buf.subarray(j * CHUNK, (j + 1) * CHUNK), i, j, id }), 60000, 'clip hissa'); pk.push(did); }
    segs.push({ n, sz: buf.length, d: Math.min(60, dur - i * 60) }); sz += buf.length;
  } } finally { rmDir(outDir); }
  await within(CLIP.doc(id).set({ ...base, st: 'ok', v: 2, segs, pk, n: 0, sz, dur, ch, sub: CF.sub, src, rq, ft, as, lt: Number(b.lt) || 0, t0, ln: lane || '', rd: Date.now(), mk: Date.now() - base.at, err: FieldValue.delete(), raw: FieldValue.delete() }, { merge: true }), 30000, 'clip');
  if (src === 'nvr') T.nvr = (T.nvr || 0) + 1;
  known.set(id, { st: 'ok', tries, at: Date.now() });
  if (rq) reqDone(id, 'ok');
  gwAdd(b);   // v2.9: 👥 group video
  ST.err = '';   // v2.1: kamyab clip = purana ⚠ (ek bill ki wajah) app mein foran saaf
  if (TEST && !TEST.ok) { TEST = { ...TEST, ok: 1, err: '', raw: 'clip ban gayi — rabta theek' }; }   // v1.5: asal clip ban gayi = purana ✕ test bekar
  T.n++; T.ok++; ST.last = `#${b.no} ✓ ${Math.round(sz / 1024)} KB · ${dur} s · ${segs.length} hisse (${src})`; log(`🎥 bill #${b.no} (${b.pc} ch ${ch}) ${dur} s → ${Math.round(sz / 1024)} KB, ${segs.length} hisse · ${src} · ${Math.round((Date.now() - tA) / 1000)} s`);
}

// ---------- 🚪 v2.18: GATE PASS → GODAM KA CAMERA (malik 21 Nov: 'jis item ka gate pass banta hai us item ka godam ka camera screen ke upar bhi + WhatsApp wali recording mein bhi') ----------
//   gatePass/<SaleID> (PC gate-pass.js: posted bill ki godam lines — l[].g godam, g.<k>.t = ✓ de diya ka waqt) → bill ke har godam (gs) ka camera:
//   ① malik ka chuna billClip.gc [{g, c}] ('-' = koi nahi) ② 📦 Loading ginti ka camera (gintiCam cams b) ③ naam se (camera ke naam mein godam ka naam, jaise 'Godam 2 gate').
//   Khirki: post se 20 s pehle → us godam ki SAB items ✓ ke 1 min baad; ✓ na ho = post + 10 min; zyada se zyada 15 min.
//   SIRF PC ki apni recording (camera ⏺ Rec ON) — NVR par naya rabta NAHI. billClip/<SaleID>~g<godam> {st wait|ok|err|skip, x 1, gp 1, sid, g, gn, cam, it [{n, q, qs, ok}], nt / nl, gb, …}
//   → app tally (counter video ke upar chhoti) · 👥 group mein bill video ke BAAD · 'video <bill>' mein bhi. Apni alag line (gpRun) — bill ki clips kabhi na rukein. AI NAHI.
const GPC = biz.collection('gatePass'), GPW = { pre: 20, after: 60, wait: 600, max: 900, back: 3 * 3600000 };
const gpDocs = new Map(), GN = {}, gpMeta = new Map(); let GIC = [], GAI = false, gpOn = false, gpBusy = false, gpT = null, armG = null, armGAt = 0, brAt = 0;
const gpTs = v => typeof v === 'number' ? v : v && typeof v.toMillis === 'function' ? v.toMillis() : v && v._seconds ? v._seconds * 1000 : 0;
GPC.where('day', 'in', [dayOf(), dayOf(Date.now() - 86400000)]).onSnapshot(s => {
  s.docChanges().forEach(c => { if (c.type === 'removed') { gpDocs.delete(c.doc.id); return; } const x = c.doc.data() || {}; gpDocs.set(c.doc.id, x);
    for (const g of (Array.isArray(x.gs) ? x.gs : [])) { const nm = String((x.gn || {})[String(g)] || '').trim(); if (nm) GN[g] = nm.slice(0, 30); } });
  gpKick();
}, e => log('⚠️ gatePass: ' + e.message));
biz.collection('blueAccess').doc('gintiCam').onSnapshot(s => { const d = s.exists ? s.data() || {} : {}; GIC = (Array.isArray(d.cams) ? d.cams : []).map(c => ({ n: String((c && c.n) || '').trim(), b: Math.floor(Number(c && c.b) || 0) })).filter(c => c.n && c.b > 0); GAI = !!d.on && Number(d.ai) === 1; try { recSync(); } catch {} }, () => {});   // v2.20: ginti camera = HD · v2.21: sirf jab AI chalu (GAI)
function gpBr() {   // godam ke naam (posStock meta) — setup mein godam gate pass se pehle bhi nazar aaye
  if (Date.now() - brAt < 10 * 60000) return; brAt = Date.now();
  biz.collection('posStock').where('meta', '==', true).get().then(q => { q.forEach(d => { const x = d.data() || {}, b = Number(x.branch != null ? x.branch : (String(d.id).match(/^b(\d+)-/) || [])[1]); if (b > 1 && x.name && !GN[b]) GN[b] = String(x.name).trim().slice(0, 30); }); }).catch(() => {});
}
function gpAuto(g) {   // auto: 📦 Loading ginti ke camera, phir naam se (camera ke naam mein godam ka naam) — tarteeb se, dohra nahi, counter ka camera nahi
  const out = [], add = (c, how) => { if (c && !c.c && !out.some(x => x.c.n === c.n)) out.push({ c, how }); };
  for (const x of GIC) if (x.b === Number(g)) add(camFind(x.n), 'ginti');
  const nm = String(GN[g] || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (nm) { const re = new RegExp('(^|[^a-z0-9])' + nm.split(' ').join('[^a-z0-9]*') + '($|[^a-z0-9])'); for (const c of camList()) if (re.test(c.n.toLowerCase())) add(c, 'naam'); }
  return out;
}
function gpCam(g) {   // v2.19: ek godam par 2 camera (malik 21 Nov: 'aik hi godam par two cameras') — slot 1 / 2: malik ka chuna, '-' = koi nahi, '' = auto
  const S = (CF.gc || {})[String(g)] || ['', ''], A = gpAuto(g), slot = [null, null], how = ['', ''], want = ['', ''];
  const used = c => slot.some(y => y && y.n === c.n);
  for (let i = 0; i < 2; i++) { const v = String(S[i] || ''); if (v === '-') { how[i] = 'off'; continue; } if (!v) continue; const c = camFind(v); if (c && !used(c)) { slot[i] = c; how[i] = 'set'; } else if (!c) { how[i] = 'gum'; want[i] = v; } }
  for (let i = 0; i < 2; i++) { if (slot[i] || String(S[i] || '')) continue; const a = A.find(x => !used(x.c)); if (a) { slot[i] = a.c; how[i] = a.how; } }
  const cs = slot.filter(Boolean);
  return { c: cs[0] || null, cs, slot, how, want };
}
function gpWin(d, g) {   // [t0, t1] + kab banana (due)
  const pt = Number(d.pt) || 0; if (!pt) return null;
  const L = (Array.isArray(d.l) ? d.l : []).filter(x => x && Number(x.g) === Number(g)); if (!L.length) return null;
  const G = d.g || {}, T = L.map(x => gpTs(G[x.k] && G[x.k].t)).filter(t => t > 0), all = T.length === L.length, last = T.length ? Math.max(...T) : 0;
  const t0 = pt - GPW.pre * 1000;
  let t1 = all ? last + GPW.after * 1000 : Math.max(pt + GPW.wait * 1000, last ? last + GPW.after * 1000 : 0);
  if (t1 < pt + 30000) t1 = pt + 30000;   // ✓ post se pehle ka (purana) — kam az kam 30 s
  if (t1 - t0 > GPW.max * 1000) t1 = t0 + GPW.max * 1000;
  return { t0, t1, dur: Math.round((t1 - t0) / 1000), due: t1 + REC_WAIT * 1000, all: all ? 1 : 0, nt: T.length, nl: L.length, L };
}
const r3n = v => Math.round((Number(v) || 0) * 1000) / 1000;
const qsOf = (q, pk) => { q = Number(q) || 0; pk = Number(pk) || 0; if (pk > 1 && q >= pk) { const c = Math.floor(q / pk), r = r3n(q - c * pk); return `${c} ctn${r ? ' + ' + fq(r) : ''}`; } return fq(q); };
function gpItemsOf(d, g) { const G = d.g || {}; return (Array.isArray(d.l) ? d.l : []).filter(x => x && Number(x.g) === Number(g)).slice(0, 40).map(x => ({ n: String(x.n || '').replace(/\s+/g, ' ').trim().slice(0, 60), q: Number(x.q) || 0, qs: qsOf(x.q, x.pk), ok: G[x.k] ? 1 : 0 })); }
function gpGb(d, g) { const G = d.g || {}, s = new Set(); for (const x of (Array.isArray(d.l) ? d.l : [])) if (x && Number(x.g) === Number(g) && G[x.k] && G[x.k].n) s.add(String(G[x.k].n).trim()); return [...s].join(', ').slice(0, 40); }
function gpItems() {
  const now = Date.now(), out = [];
  if (!gpOn || !cfReady || !CF.on || !CF.gpv) return out;
  for (const [sid, d] of gpDocs) {
    if (Number(d.ps) !== 2 || !(Number(d.pt) > 0)) continue;
    const pt = Number(d.pt);
    for (const g of (Array.isArray(d.gs) ? d.gs : [])) {
      const gid = sid + '~g' + g, k = known.get(gid);
      if (k && (k.st === 'ok' || k.st === 'skip' || (k.st === 'err' && (k.fin || k.tries >= 3 || now - k.at < 2 * 60000)) || (k.hold && k.hold > now))) continue;
      if (d.off) { if (k && k.st === 'wait') out.push({ sid, g, d, gid, off: 1, due: 0, k }); continue; }
      if (!k && now - pt > GPW.back) continue;   // pehli dafa dekha aur 3 ghante purana = nahi (PC restart par purane gate pass ka bojh nahi)
      if (ON0 && pt < ON0 - 10 * 60000) continue;
      const w = gpWin(d, g); if (!w) continue;
      out.push({ sid, g, d, gid, w, due: w.due, k });
    }
  }
  return out;
}
const gpBill = sid => bills.find(x => x && String(x.id) === String(sid)) || null;
async function gpPut(it, o) {
  const d = it.d, b = gpBill(it.sid);
  await within(CLIP.doc(it.gid).set({ x: 1, gp: 1, sid: String(it.sid), g: Number(it.g), gn: String(GN[it.g] || (d.gn || {})[String(it.g)] || 'Godam ' + it.g).slice(0, 30), day: String(d.day || dayOf(d.pt)), no: String(d.no || ''), pc: String((b && b.pc) || d.pc || ''), p: String(d.p || '').slice(0, 60), pt: Number(d.pt) || 0, t: Number(b && b.t) || 0, at: Date.now(), ...o }, { merge: true }), 30000, 'godam clip');
}
function gpKick() { if (!gpOn || gpT) return; gpT = setTimeout(() => { gpT = null; gpRun().catch(e => log('❌ 🚪 ' + (e.stack || e.message))); }, 1200); }
function gpArm(L) {   // agla tayyar godam clip — usi second
  const now = Date.now(); let best = 0;
  for (const it of L) if (!it.off && it.due > now && (!best || it.due < best) && gpCam(it.g).c) best = it.due;
  if (!best || (armG && armGAt <= best)) return; if (armG) clearTimeout(armG);
  armGAt = best; armG = setTimeout(() => { armG = null; armGAt = 0; gpKick(); }, Math.min(best - now + 500, 10 * 60000));
}
function gpStat(o) { const day = dayOf(); const p = ST.gp && ST.gp.day === day ? ST.gp : { day, ok: 0, err: 0 }; ST.gp = { ...p, ...o }; }
async function gpRun() {
  if (gpBusy) return; gpBusy = true;
  try {
    gpBr();
    for (let n = 0; n < 200; n++) {
      const now = Date.now(), L = gpItems();
      for (const it of L) if (!it.k && !it.off) { const cm = gpCam(it.g); if (!cm.c) continue; known.set(it.gid, { st: 'wait', tries: 0, at: now }); it.k = known.get(it.gid); try { for (let i = 0; i < cm.cs.length; i++) await gpPut({ ...it, gid: i ? it.gid + 'b' : it.gid }, { st: 'wait', ci: i + 1, due: it.due, cam: cm.cs[i].n, it: gpItemsOf(it.d, it.g), nl: it.w.nl, nt: it.w.nt }); } catch (e) { log('⚠️ 🚪 wait: ' + e.message); } }   // v2.19: doosra camera = <gid>b
      gpStat({ w: L.filter(it => !it.off && gpCam(it.g).c).length });
      const ready = L.filter(it => it.off || (it.due <= now && gpCam(it.g).c)).sort((a, b) => a.due - b.due);
      if (!ready.length) { gpArm(L); break; }
      try { await gpOne(ready[0]); } catch (e) { const kk = known.get(ready[0].gid) || {}; known.set(ready[0].gid, { ...kk, st: 'err', tries: (kk.tries || 0) + 1, at: Date.now() }); log(`✕ 🚪 ${ready[0].gid}: ${e.message}`); }
      pushSt();
    }
  } finally { gpBusy = false; }
}
async function gpOne(it) {   // v2.19: godam ke 1-2 camera — har camera ki apni clip (doosra = <gid>b, ci 2), dono ka WAHI waqt
  const { sid, g, d, gid } = it, kk = known.get(gid) || { tries: 0 }, gn = String(GN[g] || 'Godam ' + g);
  if (it.off) { known.set(gid, { st: 'skip', tries: 0, at: Date.now() }); await gpPut(it, { st: 'skip', err: 'bill cancel / gate pass hata' }); if (known.has(gid + 'b')) await gpPut({ ...it, gid: gid + 'b' }, { st: 'skip', ci: 2, err: 'bill cancel / gate pass hata' }); return; }
  const cm = gpCam(g), w = gpWin(d, g); if (!cm.cs.length || !w) return;
  if (Date.now() < w.t1 + 3 * 60000 && cm.cs.some(c => c.r && recs.get(c.ch)?.p && !recCover(c.ch, w.t0, w.t1))) { known.set(gid, { ...kk, st: 'wait', hold: Date.now() + 20000 }); return; }   // aakhri tukra abhi likha ja raha — dono camera ek saath
  const x = { tries: (kk.tries || 0) + 1, items: gpItemsOf(d, g), gb: gpGb(d, g), gn }, R = [];
  for (let i = 0; i < cm.cs.length; i++) R.push(await gpClip(it, cm.cs[i], w, i ? gid + 'b' : gid, i + 1, x));
  const ok = R.filter(r => r.ok);
  if (ok.length) { known.set(gid, { st: 'ok', tries: x.tries, at: Date.now() }); gpStat({ ok: (ST.gp.ok || 0) + 1, last: `#${d.no} ${gn} ${w.dur} s${ok.length > 1 ? ' · 2 camera' : ''}` }); gwAddG(gid); }   // 👥 group: bill video ke baad
  else { const why = R.map(r => r.why).filter(Boolean).join(' · '); known.set(gid, { st: 'err', tries: x.tries, at: Date.now(), fin: R.every(r => r.fin) ? 1 : 0 }); gpStat({ err: (ST.gp.err || 0) + 1, le: `#${d.no} ${gn}: ${why.slice(0, 80)}` }); }
}
async function gpClip(it, c, w, id, ci, x) {   // ek camera ki clip → billClip/<id> (hisse <id>_s<i>_<j>)
  const d = it.d, tA = Date.now(), put = o => gpPut({ ...it, gid: id }, { ci, cam: c.n, ...o });
  const fail = async (why, fin) => { await put({ st: 'err', err: String(why).slice(0, 160), fin: fin ? 1 : 0, tries: x.tries, it: x.items, nt: w.nt, nl: w.nl }); log(`✕ 🚪 #${d.no} ${x.gn} (${c.n}): ${why}`); return { ok: false, fin: fin ? 1 : 0, why: `${c.n}: ${why}` }; };
  if (!c.r) return fail(`"${c.n}" ki ⏺ recording band — ⚙️ Camera setup mein ⏺ Rec ON karein`, 1);
  const cov = recCover(c.ch, w.t0, w.t1);
  if (!cov) return fail(recs.get(c.ch)?.p ? 'is waqt ki recording PC mein nahi (recording beech mein ruki thi)' : `"${c.n}" ki recording chal nahi rahi`, 1);
  const outDir = path.join(TMP, 'g' + id.replace(/[^\w-]/g, '_')); rmDir(outDir); fs.mkdirSync(TMP, { recursive: true });
  const lst = outDir + '.txt'; fs.writeFileSync(lst, cov.map(y => `file '${y.f.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n') + '\n');
  const rr = await ffSegs(['-f', 'concat', '-safe', '0', '-i', lst], Math.max(0, (w.t0 - cov[0].t0) / 1000), w.dur, outDir); try { fs.unlinkSync(lst); } catch {}
  if (!rr.ok) { rmDir(outDir); return fail('video nahi bani: ' + String(rr.err).slice(0, 100), x.tries >= 3); }
  const segs = [], pk = []; let sz = 0;
  try {
    for (let i = 0; i < rr.files.length; i++) {
      const buf = fs.readFileSync(rr.files[i]); const n = Math.ceil(buf.length / CHUNK);
      for (let j = 0; j < n; j++) { const did = `${id}_s${i}_${j}`; await within(CLIP.doc(did).set({ b: buf.subarray(j * CHUNK, (j + 1) * CHUNK), i, j, id }), 60000, 'godam hissa'); pk.push(did); }
      segs.push({ n, sz: buf.length, d: Math.min(60, w.dur - i * 60) }); sz += buf.length;
    }
  } finally { rmDir(outDir); }
  const meta = { st: 'ok', v: 2, ch: c.ch, segs, pk, n: 0, sz, dur: w.dur, t0: w.t0, t1: w.t1, all: w.all, nt: w.nt, nl: w.nl, gb: x.gb, it: x.items, rd: Date.now(), mk: Date.now() - tA, err: FieldValue.delete(), fin: FieldValue.delete() };
  await put(meta);
  const b = gpBill(it.sid); gpMeta.set(id, { ...meta, err: '', fin: 0, ci, cam: c.n, sid: it.sid, g: it.g, gn: x.gn, no: String(d.no || ''), pc: String((b && b.pc) || d.pc || ''), pt: Number(d.pt) || 0, t: Number(b && b.t) || 0 }); if (gpMeta.size > 200) gpMeta.delete(gpMeta.keys().next().value);
  log(`🚪 #${d.no} ${x.gn} (${c.n} ch ${c.ch}) ${w.dur} s · ✓ ${w.nt}/${w.nl}${x.gb ? ' ' + x.gb : ''} → ${Math.round(sz / 1024)} KB · ${Math.round((Date.now() - tA) / 1000)} s`);
  return { ok: true, id, sz };
}
function gpMapOut() {   // app ⚙️: har godam ka camera (PC ka asal faisla)
  const ks = new Set(Object.keys(GN).map(Number).filter(b => b > 1)); for (const k of Object.keys(CF.gc || {})) ks.add(Number(k));
  const rs = c => c ? (c.r ? (recOn(c.ch) ? 2 : 1) : 0) : 0;
  return [...ks].filter(g => g > 0).sort((a, b) => a - b).slice(0, 16).map(g => { const m = gpCam(g), s1 = m.slot[0], s2 = m.slot[1]; return { g, n: String(GN[g] || 'Godam ' + g).slice(0, 30), cam: s1 ? s1.n : '', how: m.how[0], want: m.want[0], r: rs(s1), cam2: s2 ? s2.n : '', how2: m.how[1], want2: m.want[1], r2: rs(s2) }; });   // v2.19: cam2 = doosra camera
}
// 🎬 godam video WhatsApp ke liye (patti: godam · bill # · items × tadad · kis ne diya) — recording se, na ho to bani clip se
// v2.19: list = [{id, m}] — 2 camera = EK video mein ek ke upar doosra (640x720; phone par side by side bohat chhota) · 1 camera = 640x360 (godam camera 16:9, kale patte nahi)
//   patti camera ki apni ghari (upar daayein) ke NEECHE (y0 ~48) — malik 21 Nov: patti ghari ko dhak rahi thi.
async function mkGVideo(list, out) {
  list = (list || []).filter(x => x && x.m && x.m.st === 'ok'); if (!list.length) return { ok: false, err: 'godam clip nahi' };
  const m = list[0].m, t0 = Number(m.t0) || 0, dur = Math.min(...list.map(x => Number(x.m.dur) || 0)); if (!t0 || !dur) return { ok: false, err: 'godam clip ka waqt nahi' };
  const items = (Array.isArray(m.it) ? m.it : []).map(x => ({ n: String((x && x.n) || ''), q: Number(x && x.q) || 0, qs: String((x && x.qs) || '') })).filter(x => x.n);
  const b = { id: String(m.sid || list[0].id.split('~')[0]), no: m.no, pc: cut(String(m.gn || 'Godam'), 16) + ' gate pass', pt: Number(m.pt) || t0, t: Number(m.t) || 0, n: items.length, by: m.gb ? 'diya: ' + m.gb : (Number(m.nt) ? '' : 'tick nahi hua') };
  const ins = [], tmpF = [], src = [], cams = []; fs.mkdirSync(TMP, { recursive: true });
  try {
    for (const x of list.slice(0, 2)) {
      const ch = Number(x.m.ch) || 0, cov = ch ? recCover(ch, t0, t0 + dur * 1000) : null;
      if (cov) { const lst = path.join(TMP, 'mg-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + '.txt'); fs.writeFileSync(lst, cov.map(y => `file '${y.f.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n') + '\n'); tmpF.push(lst); ins.push({ pre: ['-ss', String(Math.max(0, (t0 - cov[0].t0) / 1000))], inp: ['-f', 'concat', '-safe', '0', '-i', lst] }); src.push('rec'); cams.push(x.m.cam || ''); continue; }
      const tmp = path.join(TMP, `mgsrc-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}.mp4`); tmpF.push(tmp);
      const r1 = await clipToMp4(x.id, x.m, tmp); if (r1.ok) { ins.push({ pre: [], inp: ['-i', tmp] }); src.push('clip'); cams.push(x.m.cam || ''); } else log(`⚠️ 🚪 ${x.id}: clip nahi juri — ${String(r1.err).slice(0, 80)}`);
    }
    if (!ins.length) return { ok: false, err: 'godam ki video nahi mili (recording / clip)' };
    const o = ins.length > 1 ? { W: 640, H: 720, y0: 52, R: 7 } : { W: 640, H: 360, y0: 48, R: 7 };
    const r = await ovRender(b, items, { ins, dur, t0 }, out, '', o);
    return r.ok ? { ...r, src: src.join('+'), dur, n: ins.length, cams } : { ok: false, err: 'video nahi bani: ' + String(r.err).slice(0, 100) };
  } finally { for (const f of tmpF) { try { fs.unlinkSync(f); } catch {} } }
}
const gpCap = m => { const nl = Number(m.nl) || (Array.isArray(m.it) ? m.it.length : 0), nt = Number(m.nt) || 0;
  return `🚪 Gate pass · Bill #${m.no || m.sid} · 🏬 ${m.gn || 'Godam'} · ${nl} item${nl === 1 ? '' : 's'} · ${nt && nt === nl ? '✓ sab diya' : nt ? `✓ ${nt}/${nl} diya` : '✓ tick nahi hua'}${m.gb ? ' (' + m.gb + ')' : ''}\n📹 ${(m.cams && m.cams.length ? m.cams.join(' + ') : m.cam) || ''} · ${hm(Number(m.t0) + GPW.pre * 1000)} → ${hm(Number(m.t1) || Number(m.t0) + Number(m.dur) * 1000)}`; };

// ---------- 🏬 v2.20: GODAM KA HAR WAQIA = VIDEO (malik 21 Nov: 'maal aane / jane ki video AI khud banaye — phir hum ✓ / ✕ se training karwayein') ----------
//   gintiEv/<id> (PC ginti-cam v2.0: lakeer paar — ⬆ out / ⬇ in maal, 🧍 po / pi uthaya, 🙂 fc chehre) → us godam (b) ke 1-2 camera (gpCam — wahi 🚪 wala
//   chunao; na ho to waqie ka apna camera) ki clip t0 − 20 s → t1 + 20 s (6 min tak) → billClip/gv~<evId> (ci 1) + gv~<evId>b (ci 2).
//   📹 0 (chhooti): gintiDoc transfer note jahan camera ne kuch nahi gina (out + in = 0, st kam) → note ke waqt − 30 s → + 5 min → billClip/gv~d-<key> (ms 1).
//   SIRF apni recording (⏺ Rec ON) — NVR par naya rabta NAHI. Apni line (gvRun) — bill / gate pass ki line kabhi na ruke. AI NAHI (yahan sirf clip).
const GVW = { pre: 20, post: 20, max: 360, back: 6 * 3600000, dPre: 30, dPost: 300 }, gvEv = new Map(), gvDoc = new Map(); let gvBusy = false, gvT = null, gvArm = null, gvArmAt = 0;
biz.collection('gintiEv').where('day', 'in', [dayOf(), dayOf(Date.now() - 86400000)]).onSnapshot(s => { s.docChanges().forEach(c => { if (c.type === 'removed') gvEv.delete(c.doc.id); else gvEv.set(c.doc.id, c.doc.data() || {}); }); gvKick(); }, e => log('⚠️ gintiEv: ' + e.message));
biz.collection('gintiDoc').where('day', 'in', [dayOf(), dayOf(Date.now() - 86400000)]).onSnapshot(s => { s.docChanges().forEach(c => { if (c.type === 'removed') gvDoc.delete(c.doc.id); else gvDoc.set(c.doc.id, c.doc.data() || {}); }); gvKick(); }, e => log('⚠️ gintiDoc: ' + e.message));
function gvCams(b, camN) { const cs = b > 0 ? gpCam(b).cs : []; if (cs.length) return cs.slice(0, 2); const c = camFind(camN); return c ? [c] : []; }
function gvItems() {
  const now = Date.now(), out = [], skip = k => k && (k.st === 'ok' || k.st === 'skip' || (k.st === 'err' && (k.fin || k.tries >= 3 || now - k.at < 2 * 60000)) || (k.hold && k.hold > now));
  if (!gpOn || !cfReady || !CF.on) return out;
  for (const [eid, e] of gvEv) {
    const goods = (Number(e.out) || 0) + (Number(e.in) || 0), pose = (Number(e.po) || 0) + (Number(e.pi) || 0), t0e = Number(e.t0) || 0, t1e = Number(e.t1) || t0e;
    if ((!goods && !pose) || !t0e) continue;
    const gid = 'gv~' + eid, k = known.get(gid); if (skip(k)) continue;
    if (!k && now - t1e > GVW.back) continue;
    const t0 = t0e - GVW.pre * 1000, t1 = Math.min(t1e + GVW.post * 1000, t0 + GVW.max * 1000);
    out.push({ gid, eid, src: e, b: Number(e.b) || 0, camN: String(e.cam || ''), w: { t0, t1, dur: Math.round((t1 - t0) / 1000), due: t1 + REC_WAIT * 1000 }, k });
  }
  for (const [key, d] of gvDoc) {
    if (d.k !== 'tn' || d.x || d.st !== 'kam' || (Number(d.out) || 0) + (Number(d.in) || 0) > 0) continue;
    const t = Number(d.t) || 0; if (!t) continue;
    const gid = 'gv~d-' + key, k = known.get(gid); if (skip(k)) continue;
    if (!k && now - t > GVW.back) continue;
    const t0 = t - GVW.dPre * 1000, t1 = t + GVW.dPost * 1000;
    out.push({ gid, dk: key, src: d, b: Number(d.b) || 0, camN: String(d.cam || ''), ms: 1, w: { t0, t1, dur: Math.round((t1 - t0) / 1000), due: t1 + REC_WAIT * 1000 }, k });
  }
  return out;
}
async function gvPut(it, id, o) {
  const x = it.src || {}, gn = String(GN[it.b] || x.bn || 'Godam ' + it.b).slice(0, 30);
  await within(CLIP.doc(id).set({ x: 1, gv: 1, ...(it.eid ? { ev: it.eid } : { dk: it.dk, ms: 1, no: String(x.no || '') }), g: it.b, gn, day: String(x.day || dayOf(it.w.t0)), out: Number(x.out) || 0, in: Number(x.in) || 0, po: Number(x.po) || 0, pi: Number(x.pi) || 0, at: Date.now(), ...o }, { merge: true }), 30000, 'godam waqia clip');
}
function gvKick() { if (!gpOn || !GAI || gvT) return; gvT = setTimeout(() => { gvT = null; gvRun().catch(e => log('❌ 🏬 ' + (e.stack || e.message))); }, 1500); }
function gvStat(o) { const day = dayOf(); const p = ST.gv && ST.gv.day === day ? ST.gv : { day, ok: 0, err: 0 }; ST.gv = { ...p, ...o }; }
async function gvRun() {
  if (gvBusy) return; gvBusy = true;
  try {
    for (let n = 0; n < 200; n++) {
      const now = Date.now(), L = gvItems();
      gvStat({ w: L.filter(it => gvCams(it.b, it.camN).length).length });
      const ready = L.filter(it => it.w.due <= now && gvCams(it.b, it.camN).length).sort((a, b) => a.w.due - b.w.due);
      if (!ready.length) {   // agla tayyar waqia — usi second
        let best = 0; for (const it of L) if (it.w.due > now && (!best || it.w.due < best) && gvCams(it.b, it.camN).length) best = it.w.due;
        if (best && !(gvArm && gvArmAt <= best)) { if (gvArm) clearTimeout(gvArm); gvArmAt = best; gvArm = setTimeout(() => { gvArm = null; gvArmAt = 0; gvKick(); }, Math.min(best - now + 500, 10 * 60000)); }
        break;
      }
      const it = ready[0];
      try { await gvOne(it); } catch (e) { const kk = known.get(it.gid) || {}; known.set(it.gid, { ...kk, st: 'err', tries: (kk.tries || 0) + 1, at: Date.now() }); log(`✕ 🏬 ${it.gid}: ${e.message}`); }
      pushSt();
    }
  } finally { gvBusy = false; }
}
async function gvOne(it) {
  const { gid, w } = it, kk = known.get(gid) || { tries: 0 }, cs = gvCams(it.b, it.camN);
  if (Date.now() < w.t1 + 3 * 60000 && cs.some(c => c.r && recs.get(c.ch)?.p && !recCover(c.ch, w.t0, w.t1))) { known.set(gid, { ...kk, st: 'wait', hold: Date.now() + 20000 }); return; }   // aakhri tukra abhi likha ja raha
  const tries = (kk.tries || 0) + 1, R = [];
  for (let i = 0; i < cs.length; i++) R.push(await gvClip(it, cs[i], i ? gid + 'b' : gid, i + 1, tries));
  const ok = R.filter(r => r.ok);
  if (ok.length) { known.set(gid, { st: 'ok', tries, at: Date.now() }); gvStat({ ok: (ST.gv.ok || 0) + 1, last: `${hm(w.t0 + GVW.pre * 1000)} ${String(GN[it.b] || it.camN)} ${w.dur} s${ok.length > 1 ? ' · 2 camera' : ''}${it.ms ? ' · 📹 0' : ''}` }); }
  else known.set(gid, { st: 'err', tries, at: Date.now(), fin: R.every(r => r.fin) ? 1 : 0 });
  if (!ok.length) gvStat({ err: (ST.gv.err || 0) + 1, le: R.map(r => r.why).filter(Boolean).join(' · ').slice(0, 100) });
}
async function gvClip(it, c, id, ci, tries) {   // ek camera ki clip → billClip/<id> (hisse <id>_s<i>_<j>) — gpClip jaisa
  const w = it.w, tA = Date.now(), put = o => gvPut(it, id, { ci, cam: c.n, ch: c.ch, t0: w.t0, t1: w.t1, dur: w.dur, ...o });
  const fail = async (why, fin) => { await put({ st: 'err', err: String(why).slice(0, 160), fin: fin ? 1 : 0, tries }); log(`✕ 🏬 ${id} (${c.n}): ${why}`); return { ok: false, fin: fin ? 1 : 0, why: `${c.n}: ${why}` }; };
  if (!c.r) return fail(`"${c.n}" ki ⏺ recording band — ⚙️ Camera setup mein ⏺ Rec ON karein`, 1);
  const cov = recCover(c.ch, w.t0, w.t1);
  if (!cov) return fail(recs.get(c.ch)?.p ? 'is waqt ki recording PC mein nahi (recording beech mein ruki thi)' : `"${c.n}" ki recording chal nahi rahi`, 1);
  const outDir = path.join(TMP, 'v' + id.replace(/[^\w-]/g, '_')); rmDir(outDir); fs.mkdirSync(TMP, { recursive: true });
  const lst = outDir + '.txt'; fs.writeFileSync(lst, cov.map(y => `file '${y.f.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n') + '\n');
  const rr = await ffSegs(['-f', 'concat', '-safe', '0', '-i', lst], Math.max(0, (w.t0 - cov[0].t0) / 1000), w.dur, outDir); try { fs.unlinkSync(lst); } catch {}
  if (!rr.ok) { rmDir(outDir); return fail('video nahi bani: ' + String(rr.err).slice(0, 100), tries >= 3); }
  const segs = [], pk = []; let sz = 0;
  try {
    for (let i = 0; i < rr.files.length; i++) {
      const buf = fs.readFileSync(rr.files[i]); const n = Math.ceil(buf.length / CHUNK);
      for (let j = 0; j < n; j++) { const did = `${id}_s${i}_${j}`; await within(CLIP.doc(did).set({ b: buf.subarray(j * CHUNK, (j + 1) * CHUNK), i, j, id }), 60000, 'godam waqia hissa'); pk.push(did); }
      segs.push({ n, sz: buf.length, d: Math.min(60, w.dur - i * 60) }); sz += buf.length;
    }
  } finally { rmDir(outDir); }
  await put({ st: 'ok', v: 2, segs, pk, n: 0, sz, rd: Date.now(), mk: Date.now() - tA, err: FieldValue.delete(), fin: FieldValue.delete() });
  log(`🏬 ${id} (${c.n} ch ${c.ch}) ${w.dur} s → ${Math.round(sz / 1024)} KB · ${Math.round((Date.now() - tA) / 1000)} s`);
  return { ok: true, id, sz };
}

// ---------- 🎥 v2.8: bill ki video WhatsApp par (malik 18 Nov: "bill number likhein to us ki video hamare aur Mubeen ke WhatsApp par full speed se — customer ko wait na karna pare") ----------
//   billClipWa/<id> {st new, no | sid, by, at, src app|wa, from (wa: maangne wala), byN} → bill dhoondo (aaj / kal / parson ka posSales) →
//   (1) bani clip (billClip st ok) ke hisse Firestore se + ffmpeg concat COPY (re-encode nahi — foran) · (2) na ho to PC ki apni recording ke tukron se (recCover).
//   NVR se dobara nahi mangwate (malik: "us ko rehne do"). File isi PC par wa-media\bv-<id>.mp4 → waOut bv-<id>-1/2 {vf, rid} → wa-out video bhejta —
//   SIRF malik + Mubeen (waParchi prFrom[0] / prTo[0]), gahak ko KABHI nahi. Haal: st run (m) → q (WhatsApp line mein) / err; wa-out s.<naam> ok / ✕.
const WAQ = biz.collection('billClipWa'), WAM = path.join(DIR, 'wa-media'), waSeen = new Set(), waPend = new Map(); let waBusy = false, waOn = false;   // waOn: main() ke baad (lock mila) hi kaam
WAQ.where('st', '==', 'new').onSnapshot(s => { s.docChanges().forEach(c => { if (c.type !== 'removed' && !waSeen.has(c.doc.id)) waPend.set(c.doc.id, c.doc.data() || {}); }); waKick(); }, e => log('⚠️ billClipWa: ' + e.message));
setInterval(() => { WAQ.where('st', '==', 'new').limit(20).get().then(s => { s.forEach(d => { if (!waSeen.has(d.id)) waPend.set(d.id, d.data() || {}); }); waKick(); }).catch(() => {}); }, 30000);   // qaida: onSnapshot ke saath poll
const waSet = (id, o) => WAQ.doc(id).set({ ...o, upAt: Date.now() }, { merge: true }).catch(e => log('⚠️ billClipWa haal: ' + e.message));
function waKick() {
  if (!waOn || waBusy || !waPend.size) return; waBusy = true;
  (async () => { try { while (waPend.size) {
    const [id, r] = [...waPend.entries()].sort((a, b) => (Number(a[1].at) || 0) - (Number(b[1].at) || 0))[0]; waPend.delete(id);
    if (waSeen.has(id)) continue; waSeen.add(id); if (waSeen.size > 500) waSeen.clear();
    if (r.kind === 'live') { lvChain = lvChain.then(() => lvOne(id, r)).catch(e => { log('✕ 📹 live: ' + (e.stack || e.message)); waSet(id, { st: 'err', err: 'PC: ' + String(e.message || e).slice(0, 120), doneAt: Date.now() }); }); continue; }   // v2.10: apni line (bill ki video na ruke)
    try { await waOne(id, r); } catch (e) { log('✕ 🎥 video WhatsApp: ' + (e.stack || e.message)); await waSet(id, { st: 'err', err: 'PC: ' + String(e.message || e).slice(0, 120), doneAt: Date.now() }); }
  } } finally { waBusy = false; } })();
}
const hm = t => { const d = new Date(Number(t) + PK); let h = d.getUTCHours(); const ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12; return `${h}:${two(d.getUTCMinutes())} ${ap}`; };
async function billFind(sid, no) {
  const nn = Number(no) || 0, m = b => b && ((sid && String(b.id) === sid) || (nn > 0 && Number(String(b.no || '').replace(/\D/g, '')) === nn));   // bill number EXACT (aakhri hindse smart nahi)
  let x = bills.find(m); if (x) return { b: x, day: billsDay || dayOf() };
  for (const k of [1, 2]) { const day = dayOf(Date.now() - k * 86400000);
    try { const sn = await within(biz.collection('posSales').doc(day).get(), 15000, 'purane bill'); const L = sn.exists && Array.isArray((sn.data() || {}).bills) ? sn.data().bills : []; x = L.find(m); if (x) return { b: x, day }; } catch (e) { log('⚠️ posSales ' + day + ': ' + e.message); } }
  return null;
}
async function waTo() {   // malik + Mubeen (WhatsApp Parchi setting) — repo mein koi number nahi
  try { const sn = await within(biz.collection('blueAccess').doc('waParchi').get(), 15000, 'waParchi'); const d = sn.exists ? sn.data() || {} : {};
    const L = [['Malik', Array.isArray(d.prFrom) && d.prFrom[0]], ['Mubeen', Array.isArray(d.prTo) && d.prTo[0]]].map(([n, p]) => ({ n, p: String(p || '').replace(/\D/g, '') })).filter(a => a.p.length >= 10);
    return L.filter((a, i) => L.findIndex(x => x.p === a.p) === i);
  } catch (e) { log('⚠️ waParchi: ' + e.message); return []; }
}
function ffRun(args, ms, cwd) {
  return new Promise(res => { const ff = ffPath(); if (!ff) return res({ ok: false, err: 'ffmpeg nahi' });
    let err = '', done = false; const p = spawn(ff, ['-hide_banner', '-loglevel', 'error', '-nostdin', ...args], { windowsHide: true, ...(cwd ? { cwd } : {}) });
    const t = setTimeout(() => { if (!done) { try { p.kill(); } catch {} err += ' (waqt khatam)'; } }, ms);
    p.stderr.on('data', d => { err += String(d); if (err.length > 3000) err = err.slice(-3000); });
    p.on('error', e => { done = true; clearTimeout(t); res({ ok: false, err: e.message }); });
    p.on('close', code => { done = true; clearTimeout(t); res(code === 0 ? { ok: true } : { ok: false, err: (err.trim().split(/\r?\n/).filter(Boolean).pop() || `ffmpeg code ${code}`).replace(/rtsp:\/\/[^@\s]*@/g, 'rtsp://****@') }); }); });
}
async function clipToMp4(bid, meta, out) {   // bani clip (Firestore ke hisse) → ek mp4, copy se (foran)
  const dir = path.join(TMP, 'bv-' + bid); rmDir(dir); fs.mkdirSync(dir, { recursive: true });
  try {
    const rd = async ids => { const P = await within(Promise.all(ids.map(k => CLIP.doc(k).get())), 30000, 'clip ke hisse'); const B = P.map(sn => { const v = sn.exists ? (sn.data() || {}).b : null; return v ? Buffer.from(v.toUint8Array ? v.toUint8Array() : v) : Buffer.alloc(0); }); if (B.some(x => !x.length)) throw Error('clip ka koi hissa gum'); return Buffer.concat(B); };
    if (meta.v === 2 && Array.isArray(meta.segs) && meta.segs.length) {
      const files = [];
      for (let i = 0; i < meta.segs.length; i++) { const n = Math.max(1, Number(meta.segs[i].n) || 1); const f = path.join(dir, `s${two(i)}.mp4`); fs.writeFileSync(f, await rd(Array.from({ length: n }, (_, j) => `${bid}_s${i}_${j}`))); files.push(f); }
      if (files.length === 1) { fs.copyFileSync(files[0], out); return { ok: true }; }
      const lst = path.join(dir, 'l.txt'); fs.writeFileSync(lst, files.map(f => `file '${f.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n') + '\n');
      return await ffRun(['-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', '-movflags', '+faststart', '-y', out], 60000);
    }
    const n = Number(meta.n) || 0; if (!n) return { ok: false, err: 'clip khali' };
    fs.writeFileSync(out, await rd(Array.from({ length: n }, (_, i) => `${bid}_${i}`))); return { ok: true };
  } catch (e) { return { ok: false, err: e.message }; } finally { rmDir(dir); }
}
// ---------- 🪟 v2.9: video par TRANSPARENT patti (malik 19 Nov: 'video ke upar transparent items naam + tadad · background nazar aaye · blur nahi') ----------
//   Canvas 640x480 (kam ho to kala pad). Neeche patti = sirf gol safed kinara (b.png ek dafa) — andar kuch nahi, video saaf nazar aaye; likhai par kaala
//   kinara (borderw) taake har rang par parhi jaye. Upar: Bill # · counter · waqt / Rs (bara) / N items · larka; phir items × tadad (tadad peeli),
//   OV.R qatar fi safha, har 5 s agla safha (chakkar). Font: Windows Segoe UI (na ho Arial) clip-font mein copy — drawtext ko C: wala raasta nahi dete
//   (':' filter tor deta hai). drawtext / font na chale = bina patti video (ov 0) — video kabhi nahi rukti.
// v2.11 (malik 20 Nov: 'aik side par — right side'): patti ab DAAYEIN patli column (chaurai 214, upar se) — baayein / beech ka counter khula; R 12.
const OV = { W: 640, H: 480, R: 12, PAGE: 5 }, FONT_DIR = path.join(DIR, 'clip-font');
function ovFonts() {
  const win = path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts');
  const pick = (k, names) => {
    const dst = path.join(FONT_DIR, k + '.ttf'); try { if (fs.statSync(dst).size > 10000) return dst; } catch {}
    for (const c of [process.env['NT_FONT_' + k.toUpperCase()], ...names.map(n => path.join(win, n))].filter(Boolean)) {
      try { if (fs.statSync(c).size > 10000) { fs.mkdirSync(FONT_DIR, { recursive: true }); fs.copyFileSync(c, dst); return dst; } } catch {}
    }
    return null;
  };
  const r = pick('r', ['segoeui.ttf', 'arial.ttf', 'tahoma.ttf']), b = pick('b', ['segoeuib.ttf', 'seguisb.ttf', 'arialbd.ttf', 'tahomabd.ttf']) || r;
  return r ? { r, b } : null;
}
async function linesOf(sid) {   // posSaleLines/<SaleID> {lines:[{i,n,q,r,g}]} — pos-sales-dekho likhta hai (nayi SQL nahi)
  try {
    const sn = await within(biz.collection('posSaleLines').doc(String(sid)).get(), 15000, 'items');
    if (!sn.exists) return null;   // abhi PC (pos-sales-dekho) ne nahi likha
    const L = Array.isArray((sn.data() || {}).lines) ? sn.data().lines : [];
    return L.map(x => ({ n: String((x && (x.n || x.i)) || '').replace(/\s+/g, ' ').trim(), q: Number(x && x.q) || 0 })).filter(x => x.n);
  } catch (e) { log('⚠️ items parhna: ' + e.message); return null; }
}
const fq = q => Number.isInteger(q) ? String(q) : String(+Number(q).toFixed(3));
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
function pageAt(b, n, t0, dur, R0) {   // v2.13: safha kab badle (video ke second) — pichhle safhe ki AAKHRI item NT-PRINT par judne ke 2 s baad; agli item pehle aaye to usi waqt
  const R = R0 || OV.R, pages = Math.ceil(n / R); if (pages < 2 || !(t0 > 0) || !(dur > 0)) return null;
  const A = addTimes(b); if (A.length < 2 || A.length < n * 0.6 || A.length > n * 2 + 4) return null;   // ADD na milein / ginti ajeeb = purana chakkar
  const at = k => A[Math.max(0, Math.min(A.length - 1, A.length === n ? k : Math.round(k * (A.length - 1) / Math.max(1, n - 1))))];
  const s = [0];
  for (let p = 1; p < pages; p++) {
    const last = at(p * R - 1), next = at(p * R), w = next > last && next < last + 2000 ? next : last + 2000;
    const sec = Math.round((w - t0) / 100) / 10;
    if (!(sec > s[p - 1] + 1) || sec > dur - 2) return null;
    s.push(sec);
  }
  return s;
}
function ovPlan(dir, b, items, dayTag, t0, dur, o) {   // filter ka likha hissa + text files (dir mein) · v2.19: o {W, y0, R} (godam video: patti camera ki ghari ke neeche)
  const F = ovFonts(); if (!F) return null; o = o || {};
  const W = o.W || OV.W, R = o.R || OV.R, PAGE = OV.PAGE, nr = items && items.length ? Math.min(R, items.length) : 1, many = !!(items && items.length > R);   // kam items = chhoti patti (video zyada nazar aaye)
  const cw = 214, x0 = W - 10 - cw, y0 = o.y0 || 10, ch = 112 + nr * 23 + (many ? 24 : 8);   // v2.11: daayein patli column
  const rel = f => path.relative(dir, f).replace(/\\/g, '/');
  let n = 0; const tf = s => { const f = `t${n++}.txt`; fs.writeFileSync(path.join(dir, f), String(s).replace(/[\r\n]+/g, ' '), 'utf8'); return f; };
  const dt = (font, txt, size, x, y, color, en) => `drawtext=fontfile='${rel(font)}':textfile='${tf(txt)}':expansion=none:fontsize=${size}:fontcolor=${color}:borderw=2:bordercolor=black@0.85:x=${x}:y=${y}${en ? `:enable='${en}'` : ''}`;
  const an = anchorOf(b), rs = Math.round(Number(b.t) || 0).toLocaleString('en-US');
  const P = [];
  P.push(dt(F.r, `Bill #${b.no || b.id}`, 14, x0 + 12, y0 + 10, 'white'));
  P.push(dt(F.r, cut(`${b.pc || '?'}  ${an ? hm(an) : ''}${dayTag ? '  (' + dayTag + ')' : ''}`, 30), 13, x0 + 12, y0 + 28, 'white@0.9'));
  P.push(dt(F.b, 'Rs ' + rs, 28, x0 + 11, y0 + 46, 'white'));
  const nIt = items && items.length ? items.length : Number(b.n) || 0;
  P.push(dt(F.r, cut(`${nIt} items${b.by ? '  ' + String(b.by) : ''}`, 28), 13, x0 + 12, y0 + 80, 'white'));
  P.push(`drawbox=x=${x0 + 12}:y=${y0 + 101}:w=${cw - 24}:h=1:color=white@0.6:t=fill`);
  if (!items || !items.length) P.push(dt(F.r, items ? 'Items nahi mile' : 'Items abhi nahi aaye', 14, x0 + 12, y0 + 112, 'white'));
  else {
    const pages = Math.ceil(items.length / R), cyc = pages * PAGE, ps = pageAt(b, items.length, t0, dur, R);
    for (let p = 0; p < pages; p++) {
      const en = pages < 2 ? '' : ps ? (p === 0 ? `lt(t,${ps[1]})` : p === pages - 1 ? `gte(t,${ps[p]})` : `between(t,${ps[p]},${+(ps[p + 1] - 0.01).toFixed(2)})`)
        : `between(mod(t,${cyc}),${p * PAGE},${p * PAGE + PAGE - 0.01})`;
      items.slice(p * R, (p + 1) * R).forEach((it, i) => {
        const y = y0 + 110 + i * 23;
        const qs = it.qs && /ctn/.test(it.qs) ? it.qs.replace(' ctn', 'ctn').replace(' + ', '+') : 'x' + fq(it.q);   // v2.18: 🚪 godam patti par carton (2ctn+3)
        P.push(dt(F.r, cut(it.n, qs.length > 4 ? 15 : 18), 15, x0 + 12, y, 'white', en));
        P.push(dt(F.b, qs, 15, `${x0 + cw - 12}-tw`, y, '0xFFE278', en));
      });
      if (pages > 1) P.push(dt(F.r, ps ? `safha ${p + 1}/${pages}${p < pages - 1 ? ' - agla khud' : ''}` : `safha ${p + 1}/${pages} - 5 sec agla`, 12, x0 + 12, y0 + 112 + nr * 23, 'white@0.85', en));
    }
  }
  return { x0, y0, cw, ch, filt: P.join(',') };
}
// src = { pre: [...input se pehle args], inp: [...input args], dur, t0 } · v2.19: src.ins = [{pre, inp}, …] (2 camera = ek ke upar doosra) · o = {W, H, y0, R}
async function ovRender(b, items, src, out, dayTag, o) {
  const dir = path.join(TMP, 'ov-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)); rmDir(dir); fs.mkdirSync(dir, { recursive: true });
  o = o || {}; const ins = Array.isArray(src.ins) && src.ins.length ? src.ins : [{ pre: src.pre, inp: src.inp }], N = ins.length;
  const W = o.W || OV.W, H = o.H || OV.H, CH = Math.round(H / N), cell = `fps=10,scale=${W}:${CH}:force_original_aspect_ratio=decrease,pad=${W}:${CH}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1`;
  const baseG = N === 1 ? `[0:v]${cell}[v]` : ins.map((_, i) => `[${i}:v]${cell}[c${i}]`).join(';') + ';' + ins.map((_, i) => `[c${i}]`).join('') + `vstack=inputs=${N}[v]`;
  const inArgs = [].concat(...ins.map(x => [...(x.pre || []), ...(x.inp || [])]));
  const kb = Math.max(150, Math.min(700, Math.floor(12 * 8192 / Math.max(10, Number(src.dur) || 60))));   // WhatsApp ki hadd (16 MB) se neeche: ~12 MB tak
  const enc = ['-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '27', '-maxrate', kb + 'k', '-bufsize', 2 * kb + 'k', '-profile:v', 'main', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-t', String(src.dur), '-y', out];
  const plain = async why => { const r = await ffRun([...inArgs, '-filter_complex', baseG, '-map', '[v]', ...enc], 5 * 60000); return r.ok ? { ok: true, ov: 0, why } : { ok: false, err: r.err }; };
  try {
    const pl = ovPlan(dir, b, items, dayTag, Number(src.t0) || 0, Number(src.dur) || 0, { W, y0: o.y0, R: o.R });
    if (!pl) return await plain('font nahi mila (Windows Fonts)');
    const R0 = 22, a = `clip(1.6-abs(hypot(max(max(${R0}-X,X-(W-1-${R0})),0),max(max(${R0}-Y,Y-(H-1-${R0})),0))-(${R0}-1.2)),0,1)*210`;
    const rb = await ffRun(['-f', 'lavfi', '-i', `color=c=black@0:s=${pl.cw}x${pl.ch}:d=1`, '-frames:v', '1', '-vf', `format=rgba,geq=r='255':g='255':b='255':a='${a}'`, '-y', path.join(dir, 'b.png')], 30000);
    if (!rb.ok) return await plain('kinara nahi bana: ' + rb.err);
    fs.writeFileSync(path.join(dir, 'f.txt'), `${baseG};[${N}:v]format=rgba[bd];[v][bd]overlay=${pl.x0}:${pl.y0}:shortest=1,${pl.filt}[o]`, 'utf8');
    const r = await ffRun([...inArgs, '-loop', '1', '-i', 'b.png', '-filter_complex_script', 'f.txt', '-map', '[o]', ...enc], 5 * 60000, dir);
    if (r.ok) return { ok: true, ov: 1 };
    log('⚠️ patti wali video nahi bani (' + String(r.err).slice(0, 140) + ') — bina patti');
    return await plain('patti: ' + String(r.err).slice(0, 80));
  } finally { rmDir(dir); }
}
// v2.9: EK raasta — maangi hui video (malik + Mubeen) aur group dono. Pehle PC ki apni recording (behtar, download nahi), na ho to bani clip; patti hamesha.
async function mkVideo(b, out, dayTag, step) {
  const bid = String(b.id), w = winOf(b), ch = PN.chFind(CF.ch, b.pc);
  const covNow = () => (ch ? recCover(ch, w.t0, w.t1) : null);
  let items = await linesOf(bid), cov = covNow(), meta = null;
  if (!cov) { try { const cm = await within(CLIP.doc(bid).get(), 15000, 'clip'); meta = cm.exists ? cm.data() || {} : null; } catch (e) { log('⚠️ 🎥 clip parhna: ' + e.message); } }
  if (!cov && !(meta && meta.st === 'ok')) {
    if (!ch) return { ok: false, err: `counter "${b.pc || '?'}" ka camera channel ⚙️ mein nahi` };
    const wt = w.t1 + REC_WAIT * 1000 - Date.now();   // abhi bana bill = aakhri tukra likhne ka intezar (v2.13: 8 s)
    if (wt > 4 * 60000) return { ok: false, err: 'bill abhi ban raha hai — print ke baad bhejein' };
    if (wt > 0) { if (step) await step(`⏳ bill abhi bana — ${Math.ceil(wt / 1000)} s recording ka intezar`); await sleep(wt); }
    cov = covNow();
    if (!cov) return { ok: false, err: NETBAD ? 'NVR tak rasta nahi tha — us waqt PC ki recording ruki thi' : 'is waqt ki recording PC mein nahi (purana bill / recording band thi)' };
  }
  for (let i = 0; i < 4 && (!items || !items.length) && Date.now() - (w.an || 0) < 5 * 60000; i++) { await sleep(5000); items = (await linesOf(bid)) || items; }   // naya bill: items PC (pos-sales-dekho) se thori der baad (v2.13: 20 s tak)
  if (step) await step('🎬 video bana raha');
  if (cov) {
    const lst = path.join(TMP, 'mv-' + bid + '-' + Date.now().toString(36) + '.txt'); fs.mkdirSync(TMP, { recursive: true });
    fs.writeFileSync(lst, cov.map(x => `file '${x.f.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n') + '\n');
    try { const r = await ovRender(b, items, { pre: ['-ss', String(Math.max(0, (w.t0 - cov[0].t0) / 1000))], inp: ['-f', 'concat', '-safe', '0', '-i', lst], dur: w.dur, t0: w.t0 }, out, dayTag); return r.ok ? { ...r, src: 'rec', dur: w.dur } : { ok: false, err: 'video nahi bani: ' + String(r.err).slice(0, 100) }; }
    finally { try { fs.unlinkSync(lst); } catch {} }
  }
  const tmp = path.join(TMP, `mvsrc-${bid}-${Date.now().toString(36)}.mp4`);
  try {
    const r1 = await clipToMp4(bid, meta, tmp); if (!r1.ok) return { ok: false, err: 'bani clip nahi juri: ' + String(r1.err).slice(0, 80) };
    const dur = Number(meta.dur) || w.dur, r = await ovRender(b, items, { pre: [], inp: ['-i', tmp], dur, t0: Number(meta.t0) || w.t0 }, out, dayTag);
    return r.ok ? { ...r, src: 'clip', dur } : { ok: false, err: 'video nahi bani: ' + String(r.err).slice(0, 100) };
  } finally { try { fs.unlinkSync(tmp); } catch {} }
}
async function waTell(ph, txt, wid, nm) { try { await biz.collection('waOut').doc(wid).create({ st: 'new', at: Date.now(), to: String(ph), nm: String(nm || '').slice(0, 30), kind: 'bv', eid: wid, txt }); } catch (e) { if (!/exists/i.test(e.message)) log('⚠️ waOut: ' + e.message); } }
async function waClaim(id) {   // ek hukum = ek hi dafa (do PC / do chalte script ho to bhi)
  try { return await db.runTransaction(async tx => { const ref = WAQ.doc(id), sn = await tx.get(ref); if (!sn.exists || (sn.data() || {}).st !== 'new') return false; tx.update(ref, { st: 'run', m: '🔎 bill dhoond raha', host: os.hostname(), upAt: Date.now() }); return true; }); }
  catch (e) { log('⚠️ 🎥 claim: ' + e.message); return false; }
}
async function waOne(id, r) {
  const tA = Date.now(), no = String(r.no || '').replace(/\D/g, ''), sid = String(r.sid || '').replace(/\D/g, ''), lbl = '#' + (no || sid);
  const fail = async why => { await waSet(id, { st: 'err', err: why, doneAt: Date.now() }); if (r.src === 'wa' && r.from) await waTell(r.from, `✕ Bill ${lbl} ki video: ${why}`, 'bvx-' + id, r.byN); log(`✕ 🎥 video ${lbl}: ${why}`); };
  if (!(await waClaim(id))) return;
  if (Date.now() - (Number(r.at) || 0) > 15 * 60000) return fail('hukum purana (15 min+) — dobara bhejein');
  if (!no && !sid) return fail('bill number nahi likha');
  const f = await billFind(sid, no); if (!f) return fail('bill nahi mila (aaj / kal / parson ke bills mein)');
  const b = f.b, bid = String(b.id), w = winOf(b), out = path.join(WAM, `bv-${id}.mp4`);
  if (!(w.an > 0)) return fail('bill abhi print / post nahi hua');
  fs.mkdirSync(WAM, { recursive: true }); try { fs.unlinkSync(out); } catch {}
  const dayTag = f.day !== dayOf() ? f.day.slice(8) + '/' + f.day.slice(5, 7) : '';
  const mv = await mkVideo(b, out, dayTag, m => waSet(id, { m }));   // v2.9: patti ke saath (recording ya bani clip)
  if (!mv.ok) return fail(mv.err);
  const src = mv.src, dur = mv.dur;
  let sz = 0; try { sz = fs.statSync(out).size; } catch {}
  if (sz < 2000) return fail('video khali bani');
  if (sz > 15 * 1048576) return fail(`video bohat bari (${Math.round(sz / 1048576)} MB)`);
  const to = await waTo(); if (!to.length) return fail('WhatsApp Parchi setting mein malik / Mubeen ka number nahi');
  const rs = Number(b.t) ? ' · Rs ' + Math.round(Number(b.t)).toLocaleString('en-US') : '';
  let G = []; try { const gq = await within(CLIP.where('sid', '==', bid).get(), 15000, 'godam clips'); G = gq.docs.map(sn => ({ id: sn.id, m: sn.data() || {} })).filter(x => x.m.gp).sort((a, c) => (Number(a.m.g) || 0) - (Number(c.m.g) || 0)); } catch (e) { log('⚠️ 🚪 godam clips: ' + e.message); }   // v2.18: 🚪 gate pass ki godam video bhi
  const GG = new Map(); for (const x of G) { const k = Number(x.m.g) || 0; if (!GG.has(k)) GG.set(k, []); GG.get(k).push(x); } for (const L of GG.values()) L.sort((a, c) => (Number(a.m.ci) || 1) - (Number(c.m.ci) || 1));   // v2.19: godam → 1-2 camera
  const gW = [...new Set(G.filter(x => x.m.st === 'wait').map(x => x.m.gn || 'Godam'))], gE = [...GG.values()].filter(L => !L.some(x => x.m.st === 'ok' || x.m.st === 'wait')).map(L => `${L[0].m.gn || 'Godam'}: ${String(L[0].m.err || '').slice(0, 60)}`);
  const cap = `🎥 Bill #${b.no || bid} · 🖥 ${b.pc || '?'} · ${hm(w.an)}${f.day !== dayOf() ? ' (' + f.day.slice(8) + '/' + f.day.slice(5, 7) + ')' : ''}${rs}${Number(b.n) ? ' · ' + b.n + ' items' : ''}${b.by ? ' · 👦 ' + b.by : ''}\n${dur >= 120 ? Math.round(dur / 60) + ' min' : dur + ' s'} ki video · maangi: ${r.src === 'wa' ? (r.byN || 'WhatsApp') : 'app'}${gW.length ? `\n🚪 ${gW.join(', ')} ki video abhi ban rahi (✓ de diya ke 1 min baad)` : ''}${gE.length ? `\n🚪 ✕ ${gE.join(' · ')}` : ''}`;
  for (let i = 0; i < to.length; i++) { const eid = `bv-${id}-${i + 1}`; try { await biz.collection('waOut').doc(eid).create({ st: 'new', at: Date.now(), to: to[i].p, nm: to[i].n, kind: 'bv', eid, txt: cap, vf: path.basename(out), rid: id }); } catch (e) { if (!/exists/i.test(e.message)) throw e; } }
  await waSet(id, { st: 'q', m: '📲 WhatsApp par bhej rahe', sid: bid, no: String(b.no || ''), pc: String(b.pc || ''), src, sz, dur, ov: mv.ov ? 1 : 0, to: to.map(a => a.n), doneAt: Date.now() });
  log(`🎥📲 bill #${b.no} (${b.pc}) video ${Math.round(sz / 1024)} KB · ${dur} s · ${src} · ${Math.round((Date.now() - tA) / 1000)} s → ${to.map(a => a.n).join(' + ')}`);
  let gn = 0;
  for (const L of GG.values()) {   // 🚪 bill ki video ke BAAD godam ki (har godam alag; v2.19: 2 camera = ek video, ek ke upar doosra)
    const x = L.find(y => y.m.st === 'ok'); if (!x) continue;
    const go = path.join(WAM, `bv-${id}-g${Number(x.m.g) || 0}.mp4`); try { fs.unlinkSync(go); } catch {}
    const gv = await mkGVideo(L, go); let gs = 0; try { gs = fs.statSync(go).size; } catch {}
    if (!gv.ok || gs < 2000 || gs > 15 * 1048576) { log(`✕ 🚪📲 #${b.no} ${x.m.gn}: ${gv.ok ? 'video ' + (gs < 2000 ? 'khali' : 'bohat bari') : gv.err}`); continue; }
    for (let i = 0; i < to.length; i++) { const eid = `bv-${id}-g${Number(x.m.g) || 0}-${i + 1}`; try { await biz.collection('waOut').doc(eid).create({ st: 'new', at: Date.now(), to: to[i].p, nm: to[i].n, kind: 'bv', eid, txt: gpCap({ ...x.m, cams: gv.cams }), vf: path.basename(go), rid: id }); } catch (e) { if (!/exists/i.test(e.message)) throw e; } }
    gn++; log(`🚪📲 #${b.no} ${x.m.gn} video ${Math.round(gs / 1024)} KB · ${gv.dur} s → ${to.map(a => a.n).join(' + ')}`);
  }
  if (gn) await waSet(id, { gp: gn });
}

// ---------- 👥 v2.9: HAR bill ki video WhatsApp GROUP mein (malik 19 Nov: 'din mein jitni videos banein SAB · group · counter-wise · patti transparent, blur nahi') ----------
//   blueAccess/billWaGroup {on, g: {<counter naam>: groupJid}, gd: jid (baqi sab counters), gn: {jid: naam}, lim (din ki hadd, 400), end 'HH:MM' (22:00)}
//   — malik: tally ⋮ '👥 Group videos'. Clip kamyab (one) → gwAdd → har 20 s mein EK → mkVideo (patti) → waOut bv-g<SaleID> {grp, vf, txt} → wa-out
//   (Business number, group ki apni line — gahak ka faasla / hadd nahi khata). Bheji = billClip.wg (restart par dobara nahi). Raat `end` ke baad / din ki
//   hadd poori = nahi bhejte (ST.wg.err app mein). SIRF malik ke chune group — gahak / kisi number ko kabhi nahi.
const GW_GAP = 10000, GW_FILE = path.join(DIR, 'wg-day.json');
let GW = { on: false, g: {}, gd: '', gn: {}, lim: 400, end: 22 * 60 }, gwLast = 0, gwBusy = false; const gwQ = new Map(), gwDone = new Set();
const gwSeen = id => gwDone.has(String(id)) || !!(known.get(String(id)) || {}).wg;   // v2.13: line 'a' + clip dono bulayein — ek hi dafa
let gwN = (() => { try { const x = JSON.parse(fs.readFileSync(GW_FILE, 'utf8')); return { day: String(x.day || ''), n: Number(x.n) || 0 }; } catch { return { day: '', n: 0 }; } })();
const gwSave = () => { try { fs.writeFileSync(GW_FILE, JSON.stringify(gwN)); } catch {} };
const isGrpJid = j => /^[0-9]{6,30}(-[0-9]{6,20})?@g\.us$/.test(String(j || ''));
biz.collection('blueAccess').doc('billWaGroup').onSnapshot(sn => {
  const d = (sn.exists && sn.data()) || {}, g = {};
  for (const [k, v] of Object.entries(d.g && typeof d.g === 'object' ? d.g : {})) if (isGrpJid(v)) g[String(k)] = String(v);
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(d.end || ''));
  GW = { on: d.on === true, g, gd: isGrpJid(d.gd) ? String(d.gd) : '', gn: d.gn && typeof d.gn === 'object' ? d.gn : {}, lim: Math.max(1, Math.min(2000, Number(d.lim) || 400)), end: m ? Math.min(1439, +m[1] * 60 + +m[2]) : 22 * 60 };
  log(`👥 group videos ${GW.on ? 'CHALU' : 'band'} · ${Object.keys(GW.g).length} counter alag${GW.gd ? ' + baqi sab ka group' : ''} · hadd ${GW.lim}/din · band ${Math.floor(GW.end / 60)}:${two(GW.end % 60)}`);
  if (GW.on) setTimeout(gwSweep, 3000);
}, e => log('⚠️ billWaGroup: ' + e.message));
function gwJid(pc) { const p = String(pc || ''); if (GW.g[p]) return GW.g[p]; const k = Object.keys(GW.g).find(x => x.toLowerCase() === p.toLowerCase()); return k ? GW.g[k] : GW.gd; }
const pkMin = () => Math.floor(((Date.now() + PK) % 86400000) / 60000);
function gwAdd(b) {
  if (!GW.on || !b) return; const id = String(b.id), k = known.get(id) || {};
  if (gwQ.has(id) || gwSeen(id) || !gwJid(b.pc)) return;
  gwQ.set(id, b); gwKick();
}
function gwSweep() {   // restart / ON ke baad: pichhle 30 min ki bani clips jo group mein nahi gayin
  if (!GW.on) return; const since = Date.now() - 30 * 60000;
  for (const b of bills) { const k = known.get(String(b.id)); if (k && k.st === 'ok' && !gwSeen(b.id) && (Number(k.at) || 0) > since) gwAdd(b); }
  for (const [id, k] of known) if (/~g\d+$/.test(id) && k.st === 'ok' && !gwSeen(id) && (Number(k.at) || 0) > since) gwAddG(id);   // v2.18: 🚪 godam video bhi
}
function gwAddG(gid) { if (!GW.on || gwQ.has(gid) || gwSeen(gid)) return; gwQ.set(gid, { _g: 1 }); gwKick(); }   // v2.18: 🚪 godam video — bill ki video ke BAAD
function gwKick() {
  if (!waOn || gwBusy || !gwQ.size) return; gwBusy = true;
  (async () => { try { while (gwQ.size && GW.on) {
    const [id, b] = gwQ.entries().next().value; gwQ.delete(id);
    if (b && b._g) { const sid = id.split('~')[0]; if (gwQ.has(sid)) { gwQ.set(id, b); continue; } }   // v2.18: is bill ki apni video abhi line mein = godam video us ke peeche
    const wt = GW_GAP - (Date.now() - gwLast); if (wt > 0) await sleep(wt);
    try { if (b && b._g) await gwOneG(id); else await gwOne(b); } catch (e) { log('✕ 👥 group video: ' + (e.stack || e.message)); ST.wg = { ...(ST.wg || {}), err: String(e.message || e).slice(0, 120) }; }
  } } finally { gwBusy = false; } })();
}
async function gwOneG(gid) {   // v2.18: 🚪 godam ki video group mein (bill wala group)
  const day = dayOf(); if (gwN.day !== day) { gwN = { day, n: 0 }; gwSave(); }
  if (gwSeen(gid)) return;
  const rd = async id => { let x = gpMeta.get(id); if (!x) { const sn = await within(CLIP.doc(id).get(), 15000, 'godam clip'); x = sn.exists ? sn.data() || {} : null; } return x; };
  const m = await rd(gid), m2 = await rd(gid + 'b');   // v2.19: doosra camera
  if (!m || m.st !== 'ok') return;
  const sid = String(m.sid || gid.split('~')[0]), b = gpBill(sid), pc = String((b && b.pc) || m.pc || ''), jid = gwJid(pc); if (!jid) return;
  const mark = async v => { gwDone.add(gid); known.set(gid, { ...(known.get(gid) || {}), wg: v }); try { await CLIP.doc(gid).set({ wg: v }, { merge: true }); } catch {} };
  if (pkMin() >= GW.end) { await mark('late'); return; }
  if (gwN.n >= GW.lim) { await mark('lim'); return; }
  fs.mkdirSync(WAM, { recursive: true }); const out = path.join(WAM, `bv-gp${sid}-${Number(m.g) || 0}.mp4`); try { fs.unlinkSync(out); } catch {}
  const tA = Date.now(), mv = await mkGVideo([{ id: gid, m }, { id: gid + 'b', m: m2 }], out);
  if (!mv.ok) { log(`✕ 👥🚪 #${m.no} ${m.gn}: ${mv.err}`); ST.wg = { ...(ST.wg || {}), err: `🚪 #${m.no}: ${String(mv.err).slice(0, 90)}` }; await mark('err'); return; }
  let sz = 0; try { sz = fs.statSync(out).size; } catch {}
  if (sz < 2000 || sz > 15 * 1048576) { await mark('err'); return; }
  const eid = `bv-gp${sid}-${Number(m.g) || 0}`, gnm = String((GW.gn || {})[jid] || 'group').slice(0, 40);
  try { await biz.collection('waOut').doc(eid).create({ st: 'new', at: Date.now(), grp: jid, nm: gnm, kind: 'bvg', eid, txt: gpCap({ ...m, sid, cams: mv.cams }), vf: path.basename(out) }); }
  catch (e) { if (!/exists/i.test(e.message)) throw e; }
  gwLast = Date.now(); gwN.n++; gwSave(); await mark(Date.now());
  ST.wg = { ...(ST.wg || {}), day, n: gwN.n, last: `🚪 #${m.no} · ${m.gn || ''}`, at: Date.now() }; pushSt(true);
  log(`👥🚪 #${m.no} ${m.gn} → ${gnm} · ${Math.round(sz / 1024)} KB · ${mv.dur} s · ${mv.src} · ${Math.round((Date.now() - tA) / 1000)} s (aaj ${gwN.n})`);
}
async function gwOne(b) {
  const id = String(b.id), day = dayOf(); if (gwN.day !== day) { gwN = { day, n: 0 }; gwSave(); }
  if (gwSeen(id)) return;
  const jid = gwJid(b.pc); if (!jid) return;
  const mark = async v => { gwDone.add(id); known.set(id, { ...(known.get(id) || {}), wg: v }); try { await CLIP.doc(id).set({ wg: v }, { merge: true }); } catch {} };
  const say = err => { ST.wg = { ...(ST.wg || {}), day, n: gwN.n, err }; pushSt(true); };
  if (pkMin() >= GW.end) { say(`raat ${Math.floor(GW.end / 60)}:${two(GW.end % 60)} ke baad group mein nahi`); await mark('late'); return; }
  if (gwN.n >= GW.lim) { say(`aaj ki hadd ${GW.lim} poori — baqi nahi bheji`); await mark('lim'); return; }
  fs.mkdirSync(WAM, { recursive: true }); const out = path.join(WAM, `bv-g${id}.mp4`); try { fs.unlinkSync(out); } catch {}
  const tA = Date.now(), mv = await mkVideo(b, out, '', null);
  if (!mv.ok) { log(`✕ 👥 #${b.no}: ${mv.err}`); say(`#${b.no}: ${String(mv.err).slice(0, 100)}`); await mark('err'); return; }
  let sz = 0; try { sz = fs.statSync(out).size; } catch {}
  if (sz < 2000 || sz > 15 * 1048576) { say(`#${b.no}: video ${sz < 2000 ? 'khali' : 'bohat bari'}`); await mark('err'); return; }
  const rs = Number(b.t) ? ' · Rs ' + Math.round(Number(b.t)).toLocaleString('en-US') : '';
  const cap = `🎥 Bill #${b.no || id} · 🖥 ${b.pc || '?'} · ${hm(winOf(b).an)}${rs}${Number(b.n) ? ' · ' + b.n + ' items' : ''}${b.by ? ' · 👦 ' + b.by : ''}`;
  const eid = `bv-g${id}`, gnm = String((GW.gn || {})[jid] || 'group').slice(0, 40);
  try { await biz.collection('waOut').doc(eid).create({ st: 'new', at: Date.now(), grp: jid, nm: gnm, kind: 'bvg', eid, txt: cap, vf: path.basename(out) }); }
  catch (e) { if (!/exists/i.test(e.message)) throw e; }
  gwLast = Date.now(); gwN.n++; gwSave(); await mark(Date.now());
  ST.wg = { day, n: gwN.n, last: `#${b.no} · ${b.pc || ''}`, at: Date.now(), err: mv.ov ? '' : 'patti nahi lagi: ' + String(mv.why || '').slice(0, 80), ov: mv.ov ? 1 : 0 };
  pushSt(true);
  log(`👥🎥 #${b.no} (${b.pc}) → ${gnm} · ${Math.round(sz / 1024)} KB · ${mv.dur} s · ${mv.src}${mv.ov ? '' : ' · patti NAHI (' + mv.why + ')'} · ${Math.round((Date.now() - tA) / 1000)} s (aaj ${gwN.n})`);
}

// ---------- 📹 v2.10: LIVE WhatsApp par + mazeed cameras (malik 19 Nov: 'live likhein -> camera ke naam -> number -> abhi ki tasveer / 30 sec … 30 min ·
//   tarteeb se · counter ke ilawa mazeed cameras (7 jaise) · kisi ki recording chalu karni ho to wo bhi') ----------
//   Cameras = counter (CF.ch, recording hamesha) + mazeed CF.xc [{n, ch, r}] (app ⚙️ Camera setup / WhatsApp live → 8 se r). Hukum billClipWa {kind 'live',
//   cam (naam | '*'), sec (0 = tasveer), from, byN} (kh-wa v1.12) -> SIRF maangne wale ko (malik / Mubeen). Tasveer: recording wale camera = taza tukre ka aakhri
//   frame (NVR par naya rabta NAHI); recording band = ek chhota RTSP rabta (sirf tab jab us camera ka koi aur rabta na ho; 401 = AUTHBAD, sab ruko).
//   Video: PC ki apni recording (pichhle N sec, recording band = video nahi) -> 5-5 min ke hisse, har hissa bante hi WhatsApp par (tarteeb se, `at` se).
let lvChain = Promise.resolve();
const np = x => { let d = String(x || '').split('@')[0].replace(/\D/g, ''); if (d.startsWith('00')) d = d.slice(2); if (d.length === 12 && d.startsWith('92')) d = '0' + d.slice(2); else if (d.length === 10 && d.startsWith('3')) d = '0' + d; return d; };
const fdur = s => (s >= 60 ? (Math.round(s / 6) / 10).toString().replace(/\.0$/, '') + ' min' : s + ' sec');
function camList() {   // [{n, ch, c (1 = counter), r (recording chahiye)}]
  const M = new Map();
  for (const k of Object.keys(CF.ch || {})) { const ch = Number(CF.ch[k]); if (!(ch > 0 && ch < 1000)) continue; let n = k; try { n = PN.nowName(k) || k; } catch {}
    if (![...M.values()].some(c => c.c && c.ch === ch) && !M.has(n)) M.set(n, { n, ch, c: 1, r: 1 }); }
  for (const x of CF.xc || []) if (!M.has(x.n)) M.set(x.n, { n: x.n, ch: x.ch, c: 0, r: x.r ? 1 : 0 });
  return [...M.values()].slice(0, 24);
}
function camFind(n) { const L = camList(), s = String(n || '').trim(); return L.find(c => c.n === s) || L.find(c => c.n.toLowerCase() === s.toLowerCase()) || null; }
function recOn(ch) { const st = recs.get(ch), l = segList(ch), last = l[l.length - 1]; return !!(st && st.p && last && Date.now() - last.t0 < 130000); }
async function snapOf(c) {
  const out = path.join(TMP, `sn-${c.ch}-${Date.now().toString(36)}.jpg`), rd = () => { try { const b = fs.readFileSync(out); return b.length > 1500 ? b : null; } catch { return null; } };
  fs.mkdirSync(TMP, { recursive: true });
  try {
    for (const s of segList(c.ch).slice(-2).reverse()) {   // sab se taza tukra (likha ja raha) — phir pichhla
      let sz = 0, mt = 0; try { const st = fs.statSync(s.f); sz = st.size; mt = st.mtimeMs; } catch { continue; }
      if (sz < 20000 || Date.now() - mt > 120000) continue;
      await ffRun(['-i', s.f, '-an', '-vf', "fps=2,scale='min(1280,iw)':-2", '-update', '1', '-q:v', '3', '-y', out], 40000);
      const b = rd(); if (b) return { ok: true, buf: b, at: mt };
    }
    if (recs.get(c.ch)?.p) return { ok: false, err: 'recording chal rahi magar taza file nahi — 1 min baad dobara' };
    if (AUTHBAD) return { ok: false, err: 'NVR ka password ghalat (401) — ⚙️ Camera setup dekhein' };
    if (NETBAD) return { ok: false, err: 'NVR tak rasta nahi (network)' };
    const r = await ffRun(['-rtsp_transport', 'tcp', '-timeout', '8000000', '-i', liveUrl(c.ch), '-an', '-frames:v', '1', '-q:v', '3', '-y', out], 25000);
    const b = rd(); if (b) return { ok: true, buf: b, at: Date.now() };
    const e = String(r.err || '').replace(/rtsp:\/\/[^@\s]*@/g, 'rtsp://****@');
    if (/\b401\b|unauthori[sz]ed/i.test(e)) { AUTHBAD = Date.now(); recStopAll('401'); ST.err = hint(e); pushSt(true); }
    return { ok: false, err: hint(e) || 'tasveer nahi mili' };
  } finally { try { fs.unlinkSync(out); } catch {} }
}
function lvEnc(lst, ss, dur, out) {
  const kb = Math.max(150, Math.min(700, Math.floor(12 * 8192 / Math.max(10, dur))));   // WhatsApp ki hadd (16 MB) se neeche
  return ffRun(['-ss', String(Math.max(0, ss)), '-f', 'concat', '-safe', '0', '-i', lst, '-t', String(dur), '-an', '-vf', "fps=10,scale='min(640,iw)':-2",
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '27', '-maxrate', kb + 'k', '-bufsize', 2 * kb + 'k', '-profile:v', 'main', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-y', out], 6 * 60000);
}
async function lvOne(id, r) {
  const ph = np(r.from), nm = String(r.byN || '').slice(0, 30), OUT = biz.collection('waOut');
  const put = async (eid, o) => { try { await OUT.doc(eid).create({ st: 'new', at: Date.now(), to: ph, nm, kind: 'lv', eid, rid: id, ...o }); return true; } catch (e) { if (!/exists/i.test(e.message)) log('⚠️ 📹 live waOut: ' + e.message); return false; } };
  const tell = (txt, k) => put(`lvx-${id}-${k || 'm'}`, { txt });
  const fail = async (why, quiet) => { await waSet(id, { st: 'err', err: why, doneAt: Date.now() }); if (!quiet) await tell('✕ ' + why, 'x'); log(`✕ 📹 live: ${why}`); };
  if (!(await waClaim(id))) return;
  if (!(await waTo()).some(a => np(a.p) === ph)) return fail('sirf malik / Mubeen', true);
  if (Date.now() - (Number(r.at) || 0) > 15 * 60000) return fail('hukum purana (15 min+) — dobara live likhein');
  if (!CF.on || !CF.ip) return fail('camera setting band / NVR ka IP nahi (app → Bill tally ⋮ ⚙️ Camera setup)');
  const sec = Math.max(0, Math.min(1800, Number(r.sec) || 0)), cams = r.cam === '*' ? camList() : [camFind(r.cam)].filter(Boolean);
  if (!cams.length) return fail(`"${r.cam || '?'}" naam ka camera ⚙️ setting mein nahi`);
  fs.mkdirSync(WAM, { recursive: true }); fs.mkdirSync(TMP, { recursive: true });
  const ic = c => (c.c ? '🖥' : '📹'), tA = Date.now();
  if (sec === 0) {   // 📸 abhi ki tasveer (ek ya sab)
    await waSet(id, { st: 'run', m: '📸 tasveer le raha' }); let ok = 0; const bad = [];
    for (const c of cams) {
      const s = await snapOf(c); if (!s.ok) { bad.push(`${c.n}: ${s.err}`); continue; }
      if (await put(`lvs-${id}-${c.ch}`, { im: s.buf, txt: `📸 ${ic(c)} ${c.n} · ${hm(s.at)}${recOn(c.ch) ? '' : ' · ⏹ recording band'}` })) ok++;
    }
    if (bad.length) await tell('✕ ' + bad.join('\n'), 'b');
    await waSet(id, { st: ok ? 'q' : 'err', m: ok ? '📲 tasveer bhej rahe' : '', err: ok ? '' : bad.join(' · ').slice(0, 160), n: ok, doneAt: Date.now() });
    log(`📸📲 live tasveer ${ok}/${cams.length} → ${nm} · ${Math.round((Date.now() - tA) / 1000)} s${bad.length ? ' · ✕ ' + bad.join(' · ') : ''}`); return;
  }
  const c = cams[0];
  if (!recOn(c.ch)) {   // recording band = pichhle waqt ki video nahi — tasveer + raasta
    await tell(`⏹ ${c.n} ki recording band hai — pichhle waqt ki video nahi ban sakti.${c.c ? ' (Camera setup / PC dekhein)' : '\nRecording chalu karni ho: live → ' + c.n + ' → 9'}\n📸 Abhi ki tasveer bhej raha hoon.`, 'r');
    const s = await snapOf(c); if (s.ok) await put(`lvs-${id}-${c.ch}`, { im: s.buf, txt: `📸 ${ic(c)} ${c.n} · ${hm(s.at)} · ⏹ recording band` });
    await waSet(id, { st: 'err', err: 'recording band — sirf tasveer', doneAt: Date.now() }); return;
  }
  const TW = Number(r.f0) > 0 && Number(r.f1) > Number(r.f0);   // v2.14: 🕒 waqt ki video (kh-wa v1.13) — warna pichhle sec
  const t1 = TW ? Math.min(Number(r.f1), Date.now() - 2000) : Date.now() - 2000, want0 = TW ? Math.max(Number(r.f0), t1 - 1800000) : t1 - sec * 1000;
  const segs = segList(c.ch).filter(x => x.t1 > want0 - 2000 && x.t0 < t1);
  let i0 = segs.length - 1; while (i0 > 0 && segs[i0].t0 - segs[i0 - 1].t1 <= 10000) i0--;
  const run = segs.slice(Math.max(0, i0));
  if (!run.length) { const old = (segList(c.ch)[0] || {}).t0; return fail(TW ? `${c.n}: ${hm(want0)} – ${hm(t1)} ki recording nahi mili${old ? ` (PC par sab se purani: ${hm(old)})` : ''}` : `${c.n}: recording ki file nahi mili`); }
  const t0 = Math.max(want0, run[0].t0), tEnd = TW ? Math.min(t1, run[run.length - 1].t1) : t1, tot = Math.round((tEnd - t0) / 1000);
  if (tot < 5) return fail(TW ? `${c.n}: ${hm(want0)} – ${hm(t1)} ki recording nahi mili (beech mein recording band thi?)` : `${c.n}: recording abhi shuru hui hai — 1 min baad dobara`);
  const P = Math.ceil(tot / 300), lst = path.join(TMP, `lv-${id}.txt`);
  fs.writeFileSync(lst, run.map(x => `file '${x.f.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n') + '\n');
  if (tot < sec - 20) await tell(TW ? `ℹ️ ${c.n}: sirf ${hm(t0)} – ${hm(tEnd)} ki recording mili (poori ${fdur(sec)} nahi) — wohi bhej raha hoon.` : `ℹ️ ${c.n}: sirf ${fdur(tot)} ki recording mili (poori ${fdur(sec)} nahi) — wohi bhej raha hoon.`, 'p');
  let sent = 0;
  try {
    for (let i = 0; i < P; i++) {
      const pt0 = t0 + i * 300000, pd = Math.min(300, Math.round((tEnd - pt0) / 1000)); if (pd < 2) break;
      await waSet(id, { st: 'run', m: `🎬 ${P > 1 ? `hissa ${i + 1}/${P} ` : ''}bana raha` });
      const out = path.join(WAM, `bv-lv${id}-${i + 1}.mp4`); try { fs.unlinkSync(out); } catch {}
      const e2 = await lvEnc(lst, (pt0 - run[0].t0) / 1000, pd, out); let sz = 0; try { sz = fs.statSync(out).size; } catch {}
      if (!e2.ok || sz < 2000 || sz > 15 * 1048576) { await tell(`✕ ${c.n}: ${P > 1 ? `hissa ${i + 1}/${P}` : 'video'} nahi bani${e2.ok ? (sz < 2000 ? ' (khali)' : ' (bohat bari)') : ''}`, 'e' + i); continue; }
      if (await put(`bv-lv${id}-${i + 1}`, { vf: path.basename(out), txt: `🎥 ${ic(c)} ${c.n} · ${hm(pt0)} – ${hm(pt0 + pd * 1000)} · ${fdur(pd)}${P > 1 ? ` · hissa ${i + 1}/${P}` : ''}` })) sent++;
    }
  } finally { try { fs.unlinkSync(lst); } catch {} }
  await waSet(id, { st: sent ? 'q' : 'err', m: sent ? '📲 WhatsApp par bhej rahe' : '', err: sent ? '' : 'video nahi bani', n: sent, parts: P, dur: tot, doneAt: Date.now() });
  log(`🎥📲 live ${c.n} ${fdur(tot)} · ${sent}/${P} hisse → ${nm} · ${Math.round((Date.now() - tA) / 1000)} s`);
}

// ---------- safai: purani clips (keep din) + billTally 60 din ----------
async function cleanup() {
  try { for (const f of fs.readdirSync(WAM)) { const p2 = path.join(WAM, f); try { if (Date.now() - fs.statSync(p2).mtimeMs > 3 * 3600000) fs.unlinkSync(p2); } catch {} } } catch {}   // v2.8: WhatsApp ki video 3 ghante baad
  try { const s4 = await within(WAQ.where('at', '<', Date.now() - 3 * 86400000).limit(100).get(), 30000, 'purane video hukum'); if (s4.size) { const b4 = db.batch(); s4.forEach(d => b4.delete(d.ref)); await b4.commit(); } } catch {}
  try {
    const cut = dayOf(Date.now() - CF.keep * 86400000);
    const s = await within(CLIP.where('day', '<', cut).limit(60).get(), 60000, 'purani clips');
    let n = 0;
    for (const d of s.docs) { const x = d.data() || {}; const parts = Number(x.n) || 0; const batch = db.batch(); for (let i = 0; i < parts; i++) batch.delete(CLIP.doc(d.id + '_' + i)); for (const k of (Array.isArray(x.pk) ? x.pk : []).slice(0, 400)) batch.delete(CLIP.doc(String(k))); batch.delete(d.ref); await batch.commit(); known.delete(d.id); n++; }
    if (n) log(`🧹 ${n} purani clip hata di (${cut} se pehle)`);
    try { const s3 = await within(biz.collection('billClipReq').where('at', '<', Date.now() - 3 * 86400000).limit(100).get(), 30000, 'purane hukum'); if (s3.size) { const b3 = db.batch(); s3.forEach(d => b3.delete(d.ref)); await b3.commit(); } } catch {}
    try { const s5 = await within(CAMQ.where('at', '<', Date.now() - 3 * 86400000).limit(100).get(), 30000, 'purane cam hukum'); if (s5.size) { const b5 = db.batch(); s5.forEach(d => b5.delete(d.ref)); await b5.commit(); } } catch {}   // v2.12
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
  kick(); waOn = true; waKick();   // v2.8
  gpOn = true; gpBr(); gpKick(); setInterval(gpKick, 30000);   // v2.18: 🚪 godam camera ki line
  gvKick(); setInterval(gvKick, 30000);   // v2.20: 🏬 godam ke waqiat ki video
  setTimeout(gwSweep, 5000); setInterval(gwSweep, 2 * 60000);   // v2.9: 👥 restart ke baad bachi clips
}
const lock = net.createServer();
lock.once('error', () => { console.log(`[${new Date().toLocaleTimeString()}] bill-clip pehle se chal raha hai (lock ${LOCK_PORT})`); process.exit(3); });
lock.listen(LOCK_PORT, '127.0.0.1', () => main().catch(e => { log('❌ ' + (e.stack || e.message || e)); setTimeout(() => process.exit(1), 5000); }));
