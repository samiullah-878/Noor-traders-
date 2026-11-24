// =========================================================
//  live-cam.js  v2.9 (2026-11-25, malik: 'WiFi pr shi chlta ha' — 4G par '✕ Rabta nahi bana' · relay plan OK): 🔁 RELAY (TURN) — malik ki
//    Cloudflare chaabi blueAccess/turnKey {id, tok} (SIRF malik + PC; log / app / phone ko kabhi nahi) se PC 24 ghante ka chhota pass banata hai
//    (rtc.live.cloudflare.com generate-ice-servers, 18 ghante se kam baqi = naya) → liveIce/cur {j: sirf TURN JSON (:53 bahar), exp, at}
//    (malik / Full / Nigrani sirf get). Phone wahi pass le kar relay candidate offer mein daalta hai = 4G par bhi video. PC (werift) apni taraf
//    TURN NAHI leta (werift setLocalDescription TURN allocation ka intezar karta hai — Cloudflare dheera ho to jawab hi ruk jata; phone ka relay kaafi).
//    Haal liveCamPc.tu {ok, err, at, exp, k}. Pass na bane = purana pass (agar abhi chalu) rehta hai, sirf haal mein ghalti. AI NAHI.
//  v2.8 (2026-11-24 raat, malik ki photo 22:37: ⏪ Saaf = sab khane kaale + 'ffmpeg code null'): har camera ka feeder ab
//    mosaic ke jurne se PEHLE hi apna pehla tukra parh kar tayyar (pehle ek ek kar ke = Windows par 9 camera x process + seek > 15 s,
//    chowkidar 15 s par band kar deta tha); ⏪ ko pehli tasveer ke liye 45 s; band ho to wajah saaf: 'N/M camera ki recording pohanchi' + har
//    camera ka haal log mein. ⚡ Tez raasta (TCP) ab kisi aur ki ghalti (recording band = RTSP -138) par hamesha ke liye band nahi hota —
//    sirf tab jab tez raasta asal mein laga ho, aur 10 min baad khud dobara (24 Nov 10:34 se poori raat UDP par atka tha).
//  v2.7 (2026-11-24 shaam, malik: 'issue sirf live par aata hai · PC khud se live banaye jo kuch minute peeche chale to shayad problem na aaye' — OK):
//    (1) 📼 sab cameras ki group recording ab LIVE line se NAHI — PC ki apni recording files (bill-clip ke band 1-min tukre, jo saaf hain) se har 5 min ka
//        tukra 2-7 min BAAD (srMake: concat + xstack, 'below normal' darja, -threads 2) — har waqt 9 camera chalane wala bojh khatam. Recording na ho = khali khana.
//    (2) ⏪ SAAF LIVE: liveReq pc '<naam>~' / '@sab~' / '@godam~' = wahi screen magar recording files se ~2 min peeche — har camera ka feeder (ffmpeg -c copy
//        → mpegts) + Node ki ghari (DTS / PTS) se tasveer-war raftar (dlPump), agla tukra pehle se tayyar, TCP 127.0.0.1 → wahi mosaic encoder. Tukra gum nahi = grey nahi.
//    (3) mosaic inputs se -skip_loop_filter HATA (v2.6 mein laga tha — H.264 ki reference tasveer bina deblock = har GOP mein dhabbe barhte).
//  v2.6 (2026-11-24, malik ki screenshots: 🎛 Sab cameras grey + WhatsApp wali sab-rec video bhi grey — 'cwo cbi ok h'):
//    (1) yaad (ring) ab AAKHRI POORI TASVEER (keyframe) se — naya keyframe aate hi purana hissa hat-ta (20 s / 10 MB tak); naya dekhne wala ffmpeg hamesha poori
//    tasveer se shuru (pehle 3.5 s mein keyframe na hota to beech se = grey). Video ka PID PMT se (sirf video ka keyframe ginte hain).
//    (2) PC busy ho kar kisi ffmpeg ka dabba bhar jaye to tukre BEECH SE nahi girte — agli poori tasveer tak ruko, phir wahan se (relay `_skip`) = grey ki jagah pal bhar ruki
//    tasveer. Shuru mein yaad na ho to bhi pehli poori tasveer ka intezar. 30 s koi keyframe na dikhe = purana tareeqa (kabhi kaali screen nahi).
//    (3) 🎛 / 🏬 / 📼 ke inputs `-skip_loop_filter all` (chhote khane — CPU kam, farq nazar nahi aata). (4) 🩺 mosaic ka haal bhi app ko (pehle sirf ek camera wali live ka).
//  live-cam.js  v2.5 (2026-11-24, malik: 'KEIME1D wala system delete kar do, us ki jagah RN6 wala'): pc-names v1.2 (purana counter camera = RN6QU6D) +
//    🎛 Sab cameras ki list mein ek counter naam DO dafa nahi — camera setting mein naya naam (RN6QU6D) aur purani chaabi (Abdurehman) dono hon to naye naam wali chaabi.
//  live-cam.js  v2.4 (2026-11-24, malik ki screenshot: group ki video phone par beech mein patli patti — 3x2 chauri video, ek khana khali, baqi screen kaali):
//    📼 sab cameras ki recording ab phone KHARA rakh kar dekhne wali shakal — 7 camera tak sab EK column (ek ke neeche ek), 8-9 = 2 column (srGrid); khana 5 tak 512x288,
//    6-7 = 448x252, 8-9 = 384x216 (16 MB ki hadd wahi). Har khane ke upar baayein camera ka naam (counter = 'Counter <PC>') — drawtext: relative fontfile (clip-font) +
//    textfile (sab-rec-t) + expansion=none, ffmpeg ka cwd = DIR; naam se ffmpeg na chale = khud bina naam (srNoTxt), recording kabhi nahi rukti. App ka Live screen nahi badla.
//  live-cam.js  v2.3 (2026-11-23 raat, malik: 'recording ko PC mein save karne ki zaroorat nahi — us ki jagah SAB cameras ki live screen record karta rahe · group mein lagatar'):
//    📼 blueAccess/sabRec {on, g (group jid), gn, kd din, st / end 'HH:MM'} — 🎛 Sab cameras wali EK video dukan ke waqt lagatar record (5-5 min, sab-rec\sab-YYYYMMDD-HHMMSS.mp4,
//    recording wali line ki copy se — NVR par naya rabta NAHI), har band tukra wa-media\bv-sab-*.mp4 -> waOut {grp, vf} (wa-out group ki line). PC par kd din. Haal liveCamPc.sr.
//  v2.2 (2026-11-23, malik ki screenshot: Sab cameras ke khanon par 'Abdurehman' / 'Bilal (server)' — bill / POS screen nahi aa rahi thi): khane ka naam ab counter ka AAJ ka naam
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
if (require.main !== module && process.env.LIVE_MO_TEST) { module.exports = { moGrid, moFilter, srFilter, srBuild, srGrid, srTs, dlDiff, iceOf }; return; }   // v1.9: sirf test (sandbox) — doctor kabhi require nahi karta
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const DIR = __dirname, BUSINESS_ID = 'noor-traders', LOCK_PORT = 47844, VER = '2.9';
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

// ---------- 🔁 v2.9: RELAY (TURN) — 4G par live: malik ki Cloudflare chaabi (blueAccess/turnKey) se 24 ghante ka chhota pass → liveIce/cur ----------
// Chaabi (tok) kabhi log / Firestore ke kisi aur doc / app ko nahi jati — sirf Cloudflare ko (Authorization header). Phone ko sirf chhota pass.
const https = require('https');
const TU_TTL = 86400, TU_MIN = 18 * 3600000;   // pass 24 ghante ka · 18 ghante se kam baqi = naya (PC dukan ke waqt chalta hai)
let TK = null, TU = { ok: 0, err: '', at: 0, exp: 0, kid: '' }, tuBusy = false, tuNext = 0;
function iceOf(j) {   // Cloudflare ka jawab → sirf TURN (Google STUN pehle se) · :53 browser mein atak jata hai (bina trickle) = bahar
  const raw = j && j.iceServers, arr = Array.isArray(raw) ? raw : raw ? [raw] : [], out = [];
  for (const s of arr) {
    if (!s || typeof s !== 'object' || !s.username || !s.credential) continue;
    const urls = (Array.isArray(s.urls) ? s.urls : [s.urls]).map(u => String(u || '').trim()).filter(u => /^turns?:/i.test(u) && !/:53(\?|$)/.test(u));
    if (urls.length) out.push({ urls: urls.slice(0, 6), username: String(s.username).slice(0, 300), credential: String(s.credential).slice(0, 300) });
  }
  return out.slice(0, 2);
}
function turnGen(k) {
  return new Promise((res, rej) => {
    const body = JSON.stringify({ ttl: TU_TTL });
    const rq = https.request({ host: 'rtc.live.cloudflare.com', path: '/v1/turn/keys/' + encodeURIComponent(k.id) + '/credentials/generate-ice-servers', method: 'POST', timeout: 15000,
      headers: { Authorization: 'Bearer ' + k.tok, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, r => {
      let s = ''; r.setEncoding('utf8'); r.on('data', c => { if (s.length < 65536) s += c; });
      r.on('end', () => {
        const c = r.statusCode || 0;
        if (c === 401 || c === 403) return rej(Object.assign(new Error(`Cloudflare ne chaabi nahi maani (${c}) — Turn Token ID / API Token dobara copy karein`), { auth: 1 }));
        if (c === 404) return rej(Object.assign(new Error('Cloudflare: yeh Turn Token ID nahi mila (404) — dobara copy karein'), { auth: 1 }));
        if (c < 200 || c >= 300) return rej(new Error(`Cloudflare ka jawab ${c} — thori der baad khud dobara`));
        let j = null; try { j = JSON.parse(s); } catch {}
        const L = iceOf(j); if (!L.length) return rej(new Error('Cloudflare ke jawab mein relay pass nahi'));
        res(L);
      });
    });
    rq.on('timeout', () => rq.destroy(new Error('Cloudflare 15 s mein nahi bola (internet?)')));
    rq.on('error', e => rej(new Error('Cloudflare tak rasta nahi: ' + String((e && e.message) || e).slice(0, 80))));
    rq.end(body);
  });
}
const ICE_DOC = biz.collection('liveIce').doc('cur');
function turnTick() {
  if (tuBusy || !TK) return;
  const now = Date.now();
  if (now < tuNext) return;
  if (TU.ok && TU.kid === TK.id && TU.exp - now > TU_MIN) return;
  tuBusy = true; const k = TK;
  turnGen(k).then(async L => {
    if (TK !== k) return;   // beech mein chaabi badli — agla chakkar naya pass banayega
    const exp = Date.now() + TU_TTL * 1000 - 10 * 60000;
    await ICE_DOC.set({ j: JSON.stringify(L), exp, at: Date.now() });
    TU = { ok: 1, err: '', at: Date.now(), exp, kid: k.id }; tuNext = 0;
    log(`🔁 relay pass bana (24 ghante · ${L.reduce((a, s) => a + s.urls.length, 0)} raaste) — 4G par live ab relay se jur sakti hai`);
  }).catch(e => {
    const same = TU.kid === k.id && TU.exp > Date.now();   // purana pass abhi chalu = wohi rehta hai, sirf haal mein ghalti
    TU = { ok: same ? 1 : 0, err: String((e && e.message) || e).slice(0, 160), at: Date.now(), exp: same ? TU.exp : 0, kid: same ? k.id : '' };
    tuNext = Date.now() + (e && e.auth ? 30 : 5) * 60000;
    log('✕ relay pass: ' + TU.err);
  }).finally(() => { tuBusy = false; pushSt(true); });
}
biz.collection('blueAccess').doc('turnKey').onSnapshot(s => {
  const d = s.exists ? s.data() || {} : {};
  const id = String(d.id || '').replace(/\s+/g, ''), tok = String(d.tok || '').replace(/\s+/g, '');
  const nk = /^[A-Za-z0-9_-]{16,80}$/.test(id) && /^[A-Za-z0-9_.-]{20,300}$/.test(tok) ? { id, tok } : null;
  const was = TK ? TK.id + '|' + TK.tok : '', cur = nk ? nk.id + '|' + nk.tok : '';
  TK = nk;
  if (!nk) {
    const bad = !!(id || tok);
    if (TU.kid) { ICE_DOC.delete().catch(() => {}); log(bad ? '🔁 relay band (chaabi ki shakal ghalat)' : '🔁 relay band (malik ne chaabi hata di)'); }
    TU = { ok: 0, err: bad ? 'Chaabi ki shakal ghalat — Turn Token ID aur API Token dobara copy karein' : '', at: Date.now(), exp: 0, kid: '' }; pushSt(true); return;
  }
  if (was !== cur) { TU = { ok: 0, err: '', at: Date.now(), exp: 0, kid: '' }; tuNext = 0; turnTick(); pushSt(true); }
}, e => log('⚠️ turnKey: ' + e.message));

// ---------- setting (bill-clip wali — malik ⚙️) ----------
let CF = { on: false, kind: 'dahua', ip: '', port: 554, user: 'admin', pw: '', ch: {} }, cfSig = '', AUTHBAD = 0;
biz.collection('blueAccess').doc('billClip').onSnapshot(s => {
  const d = s.exists ? s.data() || {} : {};
  CF = { on: d.on !== false && !!d.ip, kind: /hik/i.test(d.kind || '') ? 'hik' : 'dahua', ip: String(d.ip || '').trim(), port: Math.max(1, Math.min(65535, Number(d.port) || 554)),
    user: String(d.user || 'admin').trim(), pw: String(d.pw || ''), ch: (d.ch && typeof d.ch === 'object') ? d.ch : {},
    xc: (Array.isArray(d.xc) ? d.xc : []).map(x => ({ n: String((x && x.n) || '').replace(/\s+/g, ' ').trim().slice(0, 30), ch: Math.floor(Number(x && x.ch) || 0), r: x && x.r ? 1 : 0 })).filter(x => x.n && x.ch > 0 && x.ch < 1000).slice(0, 16),   // v1.8
    gc: (Array.isArray(d.gc) ? d.gc : []).map(x => ({ g: Math.floor(Number(x && x.g) || 0), c: String((x && x.c) || '').trim().slice(0, 30), i: Number(x && x.i) === 2 ? 2 : 1 })).filter(x => x.g > 0 && x.c && x.c !== '-') };   // v1.9: 🏬 gate pass godam camera
  try { CF.rdrv = require('./rec-dir.js').letter(d.rdrv); } catch { CF.rdrv = ''; }   // v2.3: 📼 sab cameras ki recording usi drive par
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
// v2.1: ⚡ yaad (naya dekhne wala ffmpeg foran keyframe se shuru kare) · v2.6: yaad AAKHRI keyframe se (naya keyframe = purana hissa hata), 20 s / 10 MB tak
const RING_MS = 20000, RING_MAX = 10e6, LIM = 4e6, K_OK = 30000;
function pmtVid(b) {   // v2.6: PMT se video ka PID (H.264 / HEVC / MPEG) — audio ka random-access keyframe nahi ginte
  try { let o = 4 + 1 + b[4]; if (b[o] !== 0x02) return 0; const sl = ((b[o + 1] & 15) << 8) | b[o + 2], end = Math.min(b.length, o + 3 + sl - 4), pil = ((b[o + 10] & 15) << 8) | b[o + 11]; o += 12 + pil;
    while (o + 5 <= end) { const t = b[o], pid = ((b[o + 1] & 0x1f) << 8) | b[o + 2], il = ((b[o + 3] & 15) << 8) | b[o + 4]; if ([0x01, 0x02, 0x10, 0x1b, 0x24].includes(t)) return pid; o += 5 + il; } } catch {}
  return 0;
}
function ringAdd(x, m, now) {
  let ki = -1;
  for (let i = 0; i + 188 <= m.length; i += 188) {
    if (m[i] !== 0x47) break;
    const pid = ((m[i + 1] & 0x1f) << 8) | m[i + 2];
    if (pid === 0) x.pat = Buffer.from(m.subarray(i, i + 188));
    else if (pid === 0x1000) { x.pmt = Buffer.from(m.subarray(i, i + 188)); if ((m[i + 1] & 0x40) && !((m[i + 3] >> 4) & 2)) { const v = pmtVid(x.pmt); if (v) x.vpid = v; } }
    else if (ki < 0 && (!x.vpid || pid === x.vpid) && ((m[i + 3] >> 4) & 2) && m[i + 4] > 0 && (m[i + 5] & 0x40)) ki = i;   // random access = keyframe (datagram mein kahan se)
  }
  const R = x.ring || (x.ring = []);
  if (ki >= 0) { if (x.kAt) x.gop = now - x.kAt; x.kAt = now; R.length = 0; x.rb = 0; }   // naya keyframe = purana hissa bekaar
  R.push({ t: now, ki, m }); x.rb = (x.rb || 0) + m.length;
  while (R.length > 1 && (now - R[0].t > RING_MS || x.rb > RING_MAX)) { x.rb -= R[0].m.length; R.shift(); }
  return ki;
}
function ringHead(x) { const R = x.ring || [], out = []; if (!R.length || R[0].ki < 0) return null; if (x.pat) out.push(x.pat); if (x.pmt) out.push(x.pmt); out.push(R[0].m.subarray(R[0].ki)); for (let j = 1; j < R.length; j++) out.push(R[j].m); return Buffer.concat(out); }
const kOk = (x, now) => !!x.kAt && now - x.kAt < K_OK;   // is line mein keyframe pehchane ja rahe hain (na hon = purana tareeqa, kabhi kaali screen nahi)
function joinW(x, w) {   // v2.6: naya dekhne wala — yaad ho to poori tasveer se, warna agli poori tasveer ka intezar
  const h = ringHead(x); if (h) { w.write(h); w._lim = h.length + LIM; } else if (kOk(x, Date.now())) w._skip = 1;
}
function relay(x, w, m, ki, ok) {   // v2.6: dabba bhar jaye to beech se tukre nahi — agli poori tasveer tak ruko (grey ki jagah pal bhar ruki tasveer)
  if (w._skip) {
    if (!ok) w._skip = 0;
    else if (ki < 0) { if (w._skip === 2) x.drop = (x.drop || 0) + 1; return; }
    else { w._skip = 0; if (!w.writable) return; const b = []; if (x.pat) b.push(x.pat); if (x.pmt) b.push(x.pmt); b.push(m.subarray(ki)); w.write(b.length > 1 ? Buffer.concat(b) : b[0]); return; }
  }
  const lim = w._lim || LIM; if (w._lim && w.writableLength < LIM) w._lim = 0;
  if (w.writable && w.writableLength < lim) { w.write(m); return; }
  x.drop = (x.drop || 0) + 1; if (ok) { w._skip = 2; x.skn = (x.skn || 0) + 1; }
}
function srcSync() {
  const want = new Set(); if (CF.on && CF.ip) { for (const v of Object.values(CF.ch)) if (Number(v) > 0 && Number(v) < 1000) want.add(Number(v)); for (const x of CF.xc || []) if (x.r) want.add(x.ch); }   // v1.8: recording wale mazeed camera ki copy bhi
  for (const [ch, x] of srcs) if (!want.has(ch)) { try { x.sock.close(); } catch {} srcs.delete(ch); }
  for (const ch of want) {
    if (srcs.has(ch)) continue;
    const x = { subs: new Set(), last: 0, pk: 0 }; srcs.set(ch, x);
    try { const sock = dgram.createSocket('udp4'); x.sock = sock;
      sock.on('error', e => { x.err = e.message; log(`⚠️ share ch ${ch}: ${e.message}`); try { sock.close(); } catch {} if (srcs.get(ch) === x) srcs.delete(ch); });
      sock.on('message', m => { x.pk++; const now = Date.now(); x.last = now; x.gap = (x.gap || 0) + tsGaps(x, m); let ki = -1; try { ki = ringAdd(x, m, now); } catch {} const ok = kOk(x, now); for (const w of x.subs) { try { relay(x, w, m, ki, ok); } catch {} } });
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
    const sx = p.share ? srcs.get(ch) : null; if (sx) { proc.stdin.on('error', () => {}); try { joinW(sx, proc.stdin); } catch {} sx.subs.add(proc.stdin); }
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
function stopPipe(p, why) { p.stopped = true; try { p.ff && p.ff.kill(); } catch {} if (p.dl) dlStop(p); else if (p.mo) moUnfw(p); closePipe(p); if (why) log(`🎞 live ch ${p.ch} band (${why})`); }
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
  const nowOf = n => { let nm = String(n); try { nm = PN.nowName(n) || nm; } catch {} return String(nm).slice(0, 30); }, sN = new Set();
  // v2.5: jis chaabi ka naam hi aaj ka naam hai (RN6QU6D) wo pehle — purani chaabi (Abdurehman -> RN6QU6D) phir dohra naam nahi banati
  for (const n of Object.keys(CF.ch || {}).sort((a, b) => ((nowOf(b) === b) - (nowOf(a) === a)) || (a < b ? -1 : a > b ? 1 : 0))) { const ch = Math.floor(Number(CF.ch[n]) || 0); if (!n || ch <= 0 || sC.has(ch)) continue; const nm = nowOf(n); if (sN.has(nm)) continue; sC.add(ch); sN.add(nm); out.push({ n: nm, ch, k: 'c', g: 0 }); }
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
      c.setNoDelay(true); c.on('error', () => {}); try { joinW(x, c); } catch {}
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
    const fast = !(MO_FASTBAD && Date.now() - MO_FASTBAD < 10 * 60000) && !process.env.LIVE_TEST_SRC; p.fast = fast;   // v2.8: 10 min baad tez raasta khud dobara
    Promise.all(L.map(x => fast && shareOk(x.ch) ? moTcp(p, x.ch) : 0)).then(tp => {
    if (p.stopped || p.sock !== sock) { moUnfw(p); return; }
    L.forEach((x, i) => {
      const pre = ['-thread_queue_size', '512', '-probesize', '1000000', '-analyzeduration', '1000000', '-use_wallclock_as_timestamps', '1', '-fflags', 'nobuffer+discardcorrupt'];   // v2.7: -skip_loop_filter hata (dhabbe) · probe 1 s: inputs ek ek khulte hain (default = 4 camera ~25 s intezar, ab ~7 s)
      if (process.env.LIVE_TEST_SRC) { inArgs.push('-re', '-f', 'lavfi', '-i', `testsrc=size=704x576:rate=15`); how.push('test'); return; }
      if (tp[i]) { inArgs.push(...pre, '-f', 'mpegts', '-i', `tcp://127.0.0.1:${tp[i]}`); how.push('rec⚡'); return; }   // v2.1
      if (shareOk(x.ch)) {   // recording wali copy → is ffmpeg ke apne udp port par aage (ek ffmpeg ki stdin ek hi hoti hai)
        const fp = PB + i, fs2 = dgram.createSocket('udp4'); fs2.on('error', () => {});
        const obj = { writable: true, writableLength: 0, _skip: kOk(srcs.get(x.ch), Date.now()) ? 1 : 0, write: m => { try { fs2.send(m, fp, '127.0.0.1'); } catch {} } };
        srcs.get(x.ch).subs.add(obj); p.fw.push({ ch: x.ch, obj, sock: fs2 });
        inArgs.push(...pre, '-f', 'mpegts', '-i', `udp://127.0.0.1:${fp}?fifo_size=1000000&overrun_nonfatal=1&buffer_size=8388608`); how.push('rec');
      } else { inArgs.push(...pre, '-rtsp_transport', 'tcp', '-timeout', '10000000', '-i', liveUrl(x.ch, false)); how.push('rtsp'); }
    });
    p.how = how; const br = Math.round(400 + 220 * L.length);
    const enc = codec === 'vp8' ? ['-c:v', 'libvpx', '-deadline', 'realtime', '-cpu-used', '8', '-b:v', br + 'k', '-g', String(FPS * 2), '-error-resilient', '1']
      : ['-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', '-profile:v', 'baseline', '-pix_fmt', 'yuv420p', '-g', String(FPS * 2), '-bf', '0', '-b:v', br + 'k', '-maxrate', Math.round(br * 1.3) + 'k', '-bufsize', Math.round(br * 0.7) + 'k'];
    const args = ['-hide_banner', '-loglevel', 'error', '-nostdin', ...inArgs, '-filter_complex', f, '-map', '[out]', '-an', ...enc, '-f', 'rtp', '-payload_type', '96', '-pkt_size', '1200', `rtp://127.0.0.1:${port}`];
    const proc = spawn(ff, args, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] }); p.ff = proc; p.at = Date.now(); let err = '';
    proc.stderr.on('data', d => { const t = String(d); err += t; if (err.length > 2000) err = err.slice(-2000); const n = (t.match(DEC_ERR) || []).length; if (n) p.de = (p.de || 0) + n; });   // v2.6: 🩺 mosaic ki ghaltiyan bhi
    proc.on('error', e => { err += ' ' + e.message; });
    proc.on('close', code => {
      moUnfw(p); p.ff = null; const why = hint((err.trim().split(/\r?\n/).filter(Boolean).pop() || `ffmpeg code ${code}`).replace(/rtsp:\/\/[^@\s]*@/g, 'rtsp://****@'));
      if (p.stopped) return;
      if (p.fast && !p.pk && !/401/.test(why) && (p.how || []).includes('rec⚡') && !/rtsp:\/\//.test(why)) { MO_FASTBAD = Date.now(); log(`⚡ ${moLab(p)}: tez tareeqa nahi chala (${why}) — purana tareeqa`); try { p.sock && p.sock.close(); } catch {} p.sock = null; if (p.tracks.size || (p.idleAt && Date.now() - p.idleAt < 60000)) setTimeout(() => { if (!p.stopped) { startMosaic(codec, kind); moTell(p); } }, 300); else closePipe(p); return; }
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

// ---------- 🎞 v2.7: PC ki apni RECORDING files (bill-clip ke 1-min tukre) — 📼 aur ⏪ dono isi se ----------
// Malik (24 Nov): 'issue sirf live par aata hai · PC khud se banaye jo kuch minute peeche chale to shayad problem na aaye'.
// Bill ki video (recording files se) saaf hai — is liye 📼 group recording aur ⏪ saaf live dono ab UNHI files se (NVR par naya rabta NAHI).
let RDM = null; try { RDM = require('./rec-dir.js'); } catch {}
function recRoots() {
  let act = path.join(DIR, 'clip-rec'); if (!RDM) return [act];
  try { act = RDM.active(DIR, CF.rdrv).root; } catch {}
  try { return RDM.roots(DIR, act); } catch { return [act]; }
}
function recSegs(ch, rts) {   // [{f, t0, t1}] naam (waqt) ki tarteeb — t1 = agle tukre ka shuru (aakhri = abhi likha ja raha)
  if (!RDM) return [];
  let l = []; try { l = RDM.segFiles(rts || recRoots(), ch).map(x => ({ f: x.f, t0: RDM.t0Of(x.n), t1: 0 })).filter(x => x.t0 > 0); } catch { return []; }
  const now = Date.now(); for (let i = 0; i < l.length; i++) l[i].t1 = i + 1 < l.length ? l[i + 1].t0 : Math.min(l[i].t0 + 60000, now);
  return l;
}

// ---------- ⏪ v2.7: SAAF LIVE — recording files se, ~2 min peeche (grey nahi) ----------
// liveReq pc '<naam>~' / '@sab~' / '@godam~' (app ka '⏪ Saaf' chip). Har camera = ek feeder: band 1-min tukra ffmpeg -c copy → mpegts (bina -re, foran)
// → Node apni GHARI se har tasveer usi raftar se aage deta hai (PTS / DTS se) → TCP 127.0.0.1 → wahi mosaic / ek-camera encoder → WebRTC.
// Agla tukra pehle se tayyar (khali waqfa / jhatka nahi). File poori hai = koi tukra gum nahi = grey nahi. Jis camera ki recording nahi = us ka khana nahi.
const DL_MS = 120000, DL_HI = 6e6, DL_LO = 2e6, DL_BURST = 1500, TS90 = 8589934592;
function dlDiff(a, b) { let d = (a - b) % TS90; if (d < 0) d += TS90; return d > TS90 / 2 ? d - TS90 : d; }   // 33-bit PTS ka farq (90 kHz)
function dlParse(st, buf) {   // TS packets → tasveer-war hisse {ts, bufs, len, rb, cs}
  let b = st.rem && st.rem.length ? Buffer.concat([st.rem, buf]) : buf, i = 0;
  while (i + 188 <= b.length) {
    if (b[i] !== 0x47) { const j = b.indexOf(0x47, i + 1); if (j < 0) { i = b.length; break; } i = j; continue; }
    const pkt = b.subarray(i, i + 188); i += 188;
    const pid = ((pkt[1] & 0x1f) << 8) | pkt[2], pusi = pkt[1] & 0x40, afc = (pkt[3] >> 4) & 3;
    if (pid === 0x1000 && pusi && !(afc & 2)) { const v = pmtVid(pkt); if (v) st.vpid = v; }
    let ts = -1;
    if (pid === st.vpid && pusi && (afc & 1)) {
      const o = 4 + ((afc & 2) ? 1 + pkt[4] : 0);
      if (o + 14 <= 188 && pkt[o] === 0 && pkt[o + 1] === 0 && pkt[o + 2] === 1) {
        const fl = (pkt[o + 7] >> 6) & 3, at = fl === 3 ? o + 14 : o + 9;   // DTS ho to wohi (decode ki tarteeb), warna PTS
        if (fl >= 2 && at + 5 <= 188) ts = ((pkt[at] >> 1) & 7) * 1073741824 + ((pkt[at + 1] << 7) | (pkt[at + 2] >> 1)) * 32768 + ((pkt[at + 3] << 7) | (pkt[at + 4] >> 1));
      }
    }
    const cp = Buffer.from(pkt);
    if (afc & 1) { const cc = st.cc[pid] = ((st.cc[pid] === undefined ? -1 : st.cc[pid]) + 1) & 15; cp[3] = (cp[3] & 0xf0) | cc; }   // ginti (CC) apni — har naye tukre par 0 se shuru hoti thi = 'Packet corrupt'
    if (ts >= 0) {
      if (st.part) st.q.push(st.part);
      st.part = { ts, bufs: st.hdr && st.hdr.length ? [...st.hdr, cp] : [cp], len: 188 * (1 + (st.hdr ? st.hdr.length : 0)), rb: !!st.nb, cs: st.nb ? st.nb.cs : 0, gap: st.nb ? st.nb.gap : 0 };
      if (st.nb) { st.inst.ts0 = ts; st.nb = null; } st.inst.ts1 = ts; st.hdr = null; st.qb += st.part.len;
    } else if (st.part) { st.part.bufs.push(cp); st.part.len += 188; st.qb += 188; }
    else (st.hdr = st.hdr || []).push(cp);
  }
  st.rem = i < b.length ? Buffer.from(b.subarray(i)) : null;
}
function dlPump(st) {   // ghari ke mutabiq aage — mosaic dheema ho (TCP bhara) to ghari bhi ruke (baad mein jhatke se nahi bhagti)
  if (!st.c || st.dead || st.blk) return;
  const now = Date.now(); let n = 0;
  while (st.q.length && n < 600) {
    const h = st.q[0];
    if (h.rb || st.bp < 0) { st.bp = h.ts; st.bw = st.last ? Math.max(now, st.last + st.step + (h.gap || 0)) : now - DL_BURST; h.rb = false; }   // naya tukra = nayi ghari (beech ka waqfa = ruki tasveer, delay wahi)
    const due = st.bw + dlDiff(h.ts, st.bp) / 90;
    if (due > now + 4) break;
    st.q.shift(); st.qb -= h.len; n++;
    if (st.last && due > st.last && due - st.last < 400) st.step = due - st.last; st.last = Math.max(st.last, due);
    st.sb = (st.sb || 0) + h.len; const ok = st.c.write(h.bufs.length === 1 ? h.bufs[0] : Buffer.concat(h.bufs));
    if (!ok) { st.blk = Date.now(); st.c.once('drain', () => { const d = Date.now() - st.blk; st.bw += d; st.last += d; st.blk = 0; }); break; }
  }
  if (st.paused && st.qb < DL_LO && st.ff) { st.paused = false; try { st.ff.stdout.resume(); } catch {} }
  if (!st.q.length && !st.ff && st.waitAt && now - st.waitAt > 8000 && !st.ended) { st.ended = true; log(`⏪ ch ${st.ch}: agla recording tukra nahi mila — is khane ki video ruk gayi`); try { st.part && st.c.write(Buffer.concat(st.part.bufs)); st.part = null; st.c.end(); } catch {} }
}
function dlWhy(p) {   // v2.8: kitne camera ki recording mosaic tak pohanchi + har camera ka haal (log)
  const L = p.dlf || [], ok = L.filter(st => (st.sb || 0) > 0).length;
  return { ok, n: L.length, det: L.map(st => `ch${st.ch}:${Math.round((st.sb || 0) / 1024)}KB q${st.q.length}${st.waitAt ? ' intezar' : ''}${st.ff ? ' parh' : ''}${st.c ? '' : ' na-jura'}${st.er ? ' ✕' + st.er.slice(0, 40) : ''}`).join(' · ') };
}
function dlStop(p) { for (const st of p.dlf || []) { try { st.kill(); } catch {} } p.dlf = []; }
function dlFeeder(p, ch, ff, T0) {
  return new Promise(res => {
    const st = { ch, cur: null, ff: null, c: null, dead: false, q: [], qb: 0, part: null, hdr: null, rem: null, vpid: 0x100, bp: -1, bw: 0, last: 0, step: 66, blk: 0, paused: false, waitAt: 0, ended: false, inst: {}, nb: null, ce: 0, tm: null, wt: null, srv: null, cc: {} };
    (p.dlf = p.dlf || []).push(st);
    st.kill = () => { st.dead = true; clearInterval(st.tm); clearTimeout(st.wt); try { st.ff && st.ff.kill(); } catch {} st.ff = null; try { st.c && st.c.destroy(); } catch {} try { st.srv && st.srv.close(); } catch {} st.q = []; st.qb = 0; };
    const next = () => {   // agla tukra (pehla = T0 wala, beech se) — band (likha ja chuka) hi · v2.8: mosaic jurne se pehle bhi (pehle se tayyar)
      if (st.dead || st.ff) return;
      const now = Date.now(), segs = recSegs(ch); let i = -1, off = 0;
      if (!st.cur) { i = segs.findIndex(s => s.t0 <= T0 && T0 < s.t1); if (i < 0) i = segs.findIndex(s => s.t0 > T0); if (i >= 0 && segs[i].t0 < T0) off = (T0 - segs[i].t0) / 1000; }
      else i = segs.findIndex(s => s.t0 > st.cur.t0);
      if (i < 0 || !(i + 1 < segs.length || now - segs[i].t0 > 75000)) { if (!st.waitAt) st.waitAt = now; st.wt = setTimeout(next, 1000); return; }
      st.waitAt = 0; const s = segs[i], cs = s.t0 + off * 1000;
      const gap = st.cur && st.ce ? Math.max(0, Math.min(120000, s.t0 - st.ce)) : 0; if (gap > 2500) log(`⏪ ch ${ch}: recording mein ${Math.round(gap / 1000)} s ka waqfa (wahan tasveer ruki rahegi)`);
      const a = ['-hide_banner', '-loglevel', 'error', '-nostdin', ...(off > 0.05 ? ['-ss', off.toFixed(2)] : []), '-i', s.f, '-map', '0:v:0', '-c', 'copy', '-f', 'mpegts', '-muxdelay', '0', '-muxpreload', '0', 'pipe:1'];
      const f = spawn(ff, a, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); st.ff = f; let er = '';
      st.nb = { cs, gap: gap > 2500 ? gap : 0 }; st.inst = { cs, ts0: -1, ts1: -1 }; st.rem = null; st.hdr = null; const inst = st.inst;
      f.stdout.on('data', d => { if (st.dead) return; try { dlParse(st, d); } catch {} if (st.qb > DL_HI && !st.paused) { st.paused = true; try { f.stdout.pause(); } catch {} } });
      f.stderr.on('data', d => { er += String(d); if (er.length > 1000) er = er.slice(-1000); });
      f.on('error', e => { er += ' ' + e.message; });
      f.on('close', code => {
        if (st.ff === f) st.ff = null; if (st.dead) return;
        if (st.part) { st.q.push(st.part); st.part = null; }   // aakhri tasveer bhi line mein
        if (code && er) { st.er = er.trim().split(/\r?\n/).pop().slice(0, 100); log(`⏪ ch ${ch} tukra ${path.basename(s.f)}: ${st.er}`); }
        st.ce = inst.ts0 >= 0 ? inst.cs + dlDiff(inst.ts1, inst.ts0) / 90 + st.step : s.t1;   // is tukre ki video asal mein kahan tak thi (agla waqfa naapne ke liye)
        st.cur = s; next();
      });
    };
    const srv = net.createServer(c => {
      if (st.c || st.dead) { try { c.destroy(); } catch {} return; }
      st.c = c; c.setNoDelay(true); c.on('error', () => {}); c.on('close', () => { st.c = null; st.kill(); });
      st.tm = setInterval(() => { try { dlPump(st); } catch {} }, 15); next();
    });
    st.srv = srv; srv.on('error', () => res(0));
    srv.listen(0, '127.0.0.1', () => { res(srv.address().port); next(); });   // v2.8: pehla tukra foran parhna shuru
  });
}
function startDelayed(codec, kind, ch, nm) {   // kind: a = 🎛 sab · g = 🏬 godam · s = ek camera
  const chK = 'd' + kind + (kind === 's' ? ch : ''), key = chK + '|' + codec; let p = pipes.get(key); if (p && (p.ff || p.starting)) return p;
  p = p || { ch: chK, dl: 1, mo: kind === 's' ? 0 : 1, kind: kind === 'a' ? 'a' : 'g', codec, tracks: new Set(), tries: 0, err: '' }; pipes.set(key, p); p.stopped = false;
  const ff = ffPath(); if (!ff) { p.err = 'ffmpeg abhi nahi (bill-clip install kar raha)'; pipes.delete(key); return p; }
  const L0 = kind === 'a' ? allList() : kind === 'g' ? moList() : [{ n: nm, ch, k: 'c', g: 0 }];
  const rts = recRoots(), T0 = Date.now() - DL_MS, L = L0.filter(x => recSegs(x.ch, rts).some(s => s.t1 > T0 - 5000 && s.t0 <= T0 + 30000));
  if (!L.length) { p.err = L0.length ? '2 min pehle ki recording nahi mili — ⚙️ Camera setup mein in cameras ki ⏺ Rec ON hai?' : 'Koi camera ⚙️ Camera setup mein nahi'; pipes.delete(key); return p; }
  const one = kind === 's', T = one ? { w: 640, h: 360 } : L.length > 6 ? ALL_T : MO_T, FPS = one ? 12 : L.length > 6 ? ALL_FPS : MO_FPS;
  const { c, r, f } = moFilter(L.length, T.w, T.h, FPS); p.list = L; p.grid = { c, r }; p.tw = T.w; p.th = T.h; p.starting = 1;
  const sock = dgram.createSocket('udp4'); p.sock = sock; p.pk = 0; p.pkSeen = 0; p.pkAt = Date.now(); p.sq = undefined;
  sock.on('message', m => { p.pk++; if (m.length > 4) { const sq = m.readUInt16BE(2); if (p.sq !== undefined) { const dd = (sq - p.sq) & 0xffff; if (dd > 1 && dd < 3000) p.rg = (p.rg || 0) + dd - 1; } p.sq = sq; } for (const t of p.tracks) { try { t.writeRtp(m); } catch {} } });
  sock.bind(0, '127.0.0.1', () => {
    try { sock.setRecvBufferSize(BUF); } catch {}
    const port = sock.address().port; dlStop(p);
    Promise.all(L.map(x => dlFeeder(p, x.ch, ff, T0))).then(tp => {
      if (p.stopped || p.sock !== sock) { dlStop(p); p.starting = 0; return; }
      if (tp.some(x => !x)) { p.starting = 0; p.err = 'PC par andar ka darwaza (TCP) nahi khula'; dlStop(p); failViewers(p, p.err); closePipe(p); return; }
      const inArgs = [];
      for (const pt of tp) inArgs.push('-thread_queue_size', '512', '-probesize', '500000', '-analyzeduration', '700000', '-use_wallclock_as_timestamps', '1', '-fflags', 'nobuffer', '-f', 'mpegts', '-i', `tcp://127.0.0.1:${pt}`);   // discardcorrupt NAHI: har naye tukre par ginti (CC) badalti hai — wo tukra ghalat nahi
      const br = one ? 450 : Math.round(400 + 220 * L.length);
      const enc = codec === 'vp8' ? ['-c:v', 'libvpx', '-deadline', 'realtime', '-cpu-used', '8', '-b:v', br + 'k', '-g', String(FPS * 2), '-error-resilient', '1']
        : ['-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', '-profile:v', 'baseline', '-pix_fmt', 'yuv420p', '-g', String(FPS * 2), '-bf', '0', '-b:v', br + 'k', '-maxrate', Math.round(br * 1.3) + 'k', '-bufsize', Math.round(br * 0.7) + 'k'];
      const args = ['-hide_banner', '-loglevel', 'error', '-nostdin', ...inArgs, '-filter_complex', f, '-map', '[out]', '-an', ...enc, '-f', 'rtp', '-payload_type', '96', '-pkt_size', '1200', `rtp://127.0.0.1:${port}`];
      const proc = spawn(ff, args, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] }); p.ff = proc; p.at = Date.now(); p.starting = 0; let err = '';
      proc.stderr.on('data', d => { const t = String(d); err += t; if (err.length > 2000) err = err.slice(-2000); const n = (t.match(DEC_ERR) || []).length; if (n) p.de = (p.de || 0) + n; });
      proc.on('error', e => { err += ' ' + e.message; });
      proc.on('close', code => {
        const dw = dlWhy(p); dlStop(p); p.ff = null; let why = (err.trim().split(/\r?\n/).filter(Boolean).pop() || '').slice(0, 120);
        if (!why) why = p.pk ? 'video ruk gayi' : `video nahi bani — ${dw.ok}/${dw.n} camera ki recording pohanchi${dw.ok < dw.n ? ' (baqi ki recording file nahi parh saka)' : ' (PC dheera?)'}`;
        log(`⏪ haal: ${dw.det}`);
        if (p.stopped) return;
        if (p.pk > 100) p.tries = 0;
        p.tries++; p.err = why; log(`⏪ live ${p.ch} ruki (${why})`); try { p.sock && p.sock.close(); } catch {} p.sock = null;
        warnViewers(p, `⏪ Saaf video: ${why} — dobara koshish ${p.tries}/3`);
        if (p.tracks.size && p.tries <= 3) setTimeout(() => { if (p.tracks.size && !p.stopped) { startDelayed(codec, kind, ch, nm); if (p.mo) moTell(p); } }, 2000);
        else { failViewers(p, why); closePipe(p); }
      });
      log(`⏪ live saaf ${kind === 'a' ? 'sab' : kind === 'g' ? 'godam' : nm} (${codec}) shuru — ${L.length} camera, ${Math.round(DL_MS / 1000)} s peeche: ${L.map(x => x.n + ' ch' + x.ch).join(', ')}`);
    }).catch(e => { p.starting = 0; log('⚠️ saaf live: ' + (e && e.message)); });
  });
  return p;
}

// ---------- 📼 v2.3 → v2.7: 🎛 SAB CAMERAS ki ek-screen RECORDING (5-5 min) -> WhatsApp group ----------
// Malik (23 Nov): 'recording ko save karne ki ab PC mein zaroorat nahi — us ki jagah jo sab cameras ki live screen hai us ko record karta rahe · group mein lagatar videos'.
// v2.7 (24 Nov, malik: 'PC khud se banaye jo kuch minute peeche chale'): ab LIVE line se NAHI — PC ki apni recording files (bill-clip ke band 1-min tukre)
// se har 5 min ka tukra BAAD mein (2-7 min peeche), PC ka 'kam zaroori' darja (below normal) — har waqt 9 camera chalane ka bojh khatam, video saaf.
// Setting wahi blueAccess/sabRec (sirf malik). Jis camera ki recording na ho us ka khana khali (jagah pakki).
const SR_SEG = 300, SR_LAG = 100000, SR_BACK = 50 * 60000, SR_FILE = path.join(DIR, 'sab-rec-sent.json'), SR_WAM = path.join(DIR, 'wa-media'), SR_RE = /^sab-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})\.mp4$/;
let SR = { on: false, g: '', gn: '', kd: 2, st: 480, end: 1320 }, srJob = null, srCleanAt = 0, srNoTxt = false, srBoot = false, srFence = 0;
const srFail = {};
// v2.4: phone khara = ek column (7 tak), 8-9 = 2 column; khana camera ginti ke hisaab se
function srGrid(n) { return n <= 7 ? [1, Math.max(1, n)] : [2, Math.ceil(n / 2)]; }
function srTs(n) { return n <= 5 ? { w: 512, h: 288 } : n <= 7 ? { w: 448, h: 252 } : { w: 384, h: 216 }; }
const SR_TXD = 'sab-rec-t', srLab = x => ((x.k === 'c' ? 'Counter ' : '') + String(x.n || '')).replace(/[\r\n]+/g, ' ').slice(0, 34);
function srFont() {   // bill-clip ka clip-font (b / r) — na ho to Windows Fonts se apni copy (s.ttf); drawtext ko 'C:' wala raasta nahi dete (':' filter tor deta hai)
  const fd = path.join(DIR, 'clip-font'), win = path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts');
  for (const k of ['b', 'r', 's']) { try { if (fs.statSync(path.join(fd, k + '.ttf')).size > 10000) return 'clip-font/' + k + '.ttf'; } catch {} }
  for (const n of ['segoeuib.ttf', 'arialbd.ttf', 'segoeui.ttf', 'arial.ttf', 'tahoma.ttf']) {
    try { const f = path.join(win, n); if (fs.statSync(f).size > 10000) { fs.mkdirSync(fd, { recursive: true }); fs.copyFileSync(f, path.join(fd, 's.ttf')); return 'clip-font/s.ttf'; } } catch {}
  }
  return '';
}
function srTexts(L) {   // har khane ka naam alag likhai file mein (textfile = naam mein % ' : kuch bhi ho, filter nahi toot-ta)
  if (srNoTxt) return null;
  try {
    const font = srFont(); if (!font) return null;
    fs.mkdirSync(path.join(DIR, SR_TXD), { recursive: true });
    const f = L.map((x, i) => { const n = SR_TXD + '/n' + i + '.txt'; fs.writeFileSync(path.join(DIR, n), srLab(x), 'utf8'); return n; });
    return { font, f };
  } catch { return null; }
}
const srSt = { rec: 0, n: 0, err: '', last: '', at: 0, sent: 0, day: '', job: '', mk: 0, made: '' };
let srSent = {}; try { srSent = JSON.parse(fs.readFileSync(SR_FILE, 'utf8')) || {}; } catch {}
function srSave() { try { const k = Object.keys(srSent).sort(); for (const x of k.slice(0, Math.max(0, k.length - 1500))) delete srSent[x]; fs.writeFileSync(SR_FILE, JSON.stringify(srSent)); } catch {} }
function srDir() { let root = path.join(DIR, 'clip-rec'); try { root = require('./rec-dir.js').active(DIR, CF.rdrv).root; } catch {} return path.join(path.dirname(root), 'sab-rec'); }
const srT0 = n => { const m = String(n).match(SR_RE); return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime() : 0; };
const srMinOf = t => { const d = new Date(t); return d.getHours() * 60 + d.getMinutes(); };
const srHm = t => { const d = new Date(t); let h = d.getHours(); const ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12; return `${h}:${String(d.getMinutes()).padStart(2, '0')} ${ap}`; };
const srName = t => { const d = new Date(t), q = n => String(n).padStart(2, '0'); return `sab-${d.getFullYear()}${q(d.getMonth() + 1)}${q(d.getDate())}-${q(d.getHours())}${q(d.getMinutes())}${q(d.getSeconds())}.mp4`; };
function srSlot(t) { const d = new Date(t); d.setSeconds(0, 0); d.setMinutes(d.getMinutes() - d.getMinutes() % 5); return d.getTime(); }
const SR_MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
biz.collection('blueAccess').doc('sabRec').onSnapshot(s => {
  const d = s.exists ? s.data() || {} : {}, hm = (v, df) => { const m = String(v || '').match(/^(\d{1,2}):(\d{2})$/); return m ? Math.min(1439, +m[1] * 60 + +m[2]) : df; }, was = SR.on;
  SR = { on: d.on === true, g: /^[0-9]{6,30}(-[0-9]{6,20})?@g\.us$/.test(String(d.g || '')) ? String(d.g) : '', gn: String(d.gn || '').slice(0, 40), kd: Math.max(1, Math.min(30, Math.round(Number(d.kd) || 2))), st: hm(d.st, 480), end: hm(d.end, 1320) };
  if (srBoot && SR.on && !was) srFence = Date.now();   // abhi chalu ki = sirf ab se (pichhle 50 min ka dher group mein nahi)
  srBoot = true;
  log(`📼 sab cameras ki recording: ${SR.on ? 'CHALU' : 'band'}${SR.g ? ' · group ' + (SR.gn || SR.g) : ' · group nahi chuna'} · ${SR.kd} din · recording files se`);
  try { srTick(); pushSt(true); } catch {}
}, e => log('⚠️ sabRec: ' + e.message));
function srFilter(L, ok, w, h, fps, tx, lead) {   // khane ki jagah PAKKI (camera ki recording na ho = khali khana) — taake group ki har video mein har camera wahi jagah
  const [c, r] = srGrid(L.length), parts = [], lab = [], lay = [], fz = Math.max(14, Math.round(h / 13)); let k = 0;
  for (let i = 0; i < c * r; i++) {
    const ld = lead && Number(lead[i]) > 0.5 ? Number(lead[i]) : 0;   // v2.7: is camera ki recording tukre ke beech se shuru hui = itni der khali
    let v = i < L.length && ok[i] ? `[${k++}:v]fps=${fps},scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=0x0b0f16,setsar=1${ld ? `,tpad=start_duration=${ld.toFixed(2)}:color=0x0b0f16` : ''}` : `color=c=0x0b0f16:s=${w}x${h}:r=${fps}`;
    if (tx && tx.f[i]) v += `,drawtext=fontfile='${tx.font}':textfile='${tx.f[i]}':expansion=none:fontsize=${fz}:fontcolor=white:borderw=2:bordercolor=black@0.85:x=8:y=6`;
    parts.push(v + `[v${i}]`); lab.push(`[v${i}]`); lay.push(`${(i % c) * w}_${Math.floor(i / c) * h}`);
  }
  parts.push(c * r === 1 ? `[v0]null[out]` : `${lab.join('')}xstack=inputs=${c * r}:layout=${lay.join('|')}[out]`);
  return parts.join(';');
}
function srBuild(L, cov, t0, t1, tmp, T, fps, tx) {   // v2.7: recording ke tukron se ffmpeg ke inputs + filter (sandbox test bhi isi se)
  const inArgs = [], lead = [], ok = cov.map(c => !!(c && c.length));
  cov.forEach((c, i) => {
    if (!ok[i]) return;
    const lines = [];
    c.forEach((s, j) => { lines.push(`file '${String(s.f).replace(/\\/g, '/').replace(/'/g, "'\\''")}'`); const nx = c[j + 1]; if (nx && nx.t0 - s.t0 > 80000) lines.push(`duration ${((nx.t0 - s.t0) / 1000).toFixed(2)}`); });   // beech mein recording ruki = agla tukra apne asal waqt par (ruki tasveer, baqi cameras ke saath saath)
    const lst = path.join(tmp, 'in' + i + '.txt'); fs.writeFileSync(lst, lines.join('\n') + '\n');
    const ss = Math.max(0, (t0 - c[0].t0) / 1000), from = Math.max(t0, c[0].t0);
    lead[i] = Math.max(0, (c[0].t0 - t0) / 1000);
    inArgs.push('-threads', '2', ...(ss > 0.05 ? ['-ss', ss.toFixed(2)] : []), '-t', ((t1 - from) / 1000 + 1).toFixed(2), '-f', 'concat', '-safe', '0', '-i', lst);
  });
  return { inArgs, ok, f: srFilter(L, ok, T.w, T.h, fps, tx, lead) };
}
function srCovered(t0) {   // is 5 min ka hissa pehle se bheja ja chuka (purani live wali file ka naam 5 min par nahi hota)
  for (const [n, v] of Object.entries(srSent)) { if (v === 'bad' || v === 'none' || v === 'old') continue; const t = srT0(n); if (t && t >= t0 - 60000 && t < t0 + SR_SEG * 1000 - 60000) return true; }
  return false;
}
function srNext(now) {   // agla 5 min ka hissa jo banana hai (purana pehle — group mein tarteeb)
  const last = srSlot(now - SR_LAG) - SR_SEG * 1000, dir = srDir();
  for (let t0 = last - SR_BACK; t0 <= last; t0 += SR_SEG * 1000) {
    const n = srName(t0), m = srMinOf(t0);
    if (m < SR.st || m >= SR.end) continue;
    if (srFence && t0 + SR_SEG * 1000 <= srFence) continue;
    if (srSent[n] || (srFail[n] || 0) >= 2 || srCovered(t0)) continue;
    try { if (fs.existsSync(path.join(dir, n))) continue; } catch {}
    return t0;
  }
  return 0;
}
function srMake(t0) {
  const ff = ffPath(); if (!ff) { srSt.err = 'ffmpeg abhi nahi (bill-clip install kar raha)'; return; }
  const L = allList(); if (!L.length) { srSt.err = 'Koi camera ⚙️ Camera setup mein nahi'; return; }
  const n = srName(t0), t1 = t0 + SR_SEG * 1000, dir = srDir(), tmp = path.join(dir, 'tmp'), rts = recRoots();
  const cov = L.map(x => recSegs(x.ch, rts).filter(s => s.t1 > t0 + 500 && s.t0 < t1 - 500));
  if (!cov.some(c => c.length)) { srSent[n] = 'none'; srSave(); srSt.err = srHm(t0) + ': kisi camera ki recording nahi mili (⚙️ Camera setup — ⏺ Rec ON?)'; log(`📼 ${n}: recording nahi mili — chhoda`); return; }
  try { fs.mkdirSync(tmp, { recursive: true }); } catch (e) { srSt.err = 'recording ka folder nahi bana (' + String(e.code || e.message).slice(0, 40) + ')'; return; }
  const T = srTs(L.length), tx = srTexts(L), b = srBuild(L, cov, t0, t1, tmp, T, ALL_FPS, tx), out = path.join(tmp, n);
  try { fs.unlinkSync(out); } catch {}
  // 380k x 300 s = ~14 MB (WhatsApp ki 16 MB hadd ke andar); crf = khara manzar chhoti file (internet kam)
  const args = ['-hide_banner', '-loglevel', 'error', '-nostdin', ...b.inArgs, '-filter_complex', b.f, '-map', '[out]', '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-threads', '2', '-pix_fmt', 'yuv420p', '-crf', '30', '-maxrate', '380k', '-bufsize', '760k', '-g', String(ALL_FPS * 10),
    '-t', String(SR_SEG), '-movflags', '+faststart', '-f', 'mp4', '-y', out];
  const job = srJob = { n, t0, at: Date.now(), tx: !!tx, nc: b.ok.filter(Boolean).length, nl: L.length }; srSt.job = srHm(t0); let err = '';
  const proc = spawn(ff, args, { cwd: DIR, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] }); job.ff = proc;
  try { os.setPriority(proc.pid, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch {}   // dukan ke asal kaam (POS / live / bill video) pehle
  proc.stderr.on('data', d => { err += String(d); if (err.length > 2000) err = err.slice(-2000); });
  proc.on('error', e => { err += ' ' + e.message; });
  proc.on('close', code => {
    if (srJob === job) srJob = null; srSt.job = '';
    let ok = false, sz = 0; try { sz = fs.statSync(out).size; ok = code === 0 && sz > 20000 && srOkMp4(out); } catch {}
    if (ok) { try { fs.renameSync(out, path.join(dir, n)); } catch (e) { ok = false; err = 'rename: ' + e.message; } }
    if (ok) { srSt.mk = Math.round((Date.now() - job.at) / 1000); srSt.n = job.nc; srSt.made = srHm(t0); srSt.err = ''; log(`📼 ${n}: ${job.nc}/${job.nl} camera · ${Math.round(sz / 1024)} KB · ${srSt.mk} s mein bani`); }
    else {
      try { fs.unlinkSync(out); } catch {}
      const why = (err.trim().split(/\r?\n/).filter(Boolean).pop() || `ffmpeg code ${code}`).slice(0, 120);
      if (job.tx && !srNoTxt) { srNoTxt = true; log('📼 sab recording: camera ke naam (drawtext) se nahi bani — ab bina naam'); }
      else srFail[n] = (srFail[n] || 0) + 1;
      srSt.err = srHm(t0) + ' wali nahi bani: ' + why; log(`📼 ${n} nahi bani (${why})`);
    }
    pushSt(true); setTimeout(() => { try { srTick(); } catch {} }, 1500);
  });
}
function srOkMp4(f) { try { const fd = fs.openSync(f, 'r'), b = Buffer.alloc(65536), n = fs.readSync(fd, b, 0, 65536, 0); fs.closeSync(fd); const i = b.subarray(0, n).indexOf('moov'), j = b.subarray(0, n).indexOf('mdat'); return i > 0 && (j < 0 || i < j); } catch { return false; } }   // theek band hui file = moov shuru mein (faststart)
function srSend(now) {
  const dir = srDir(); let fl = []; try { fl = fs.readdirSync(dir).filter(n => SR_RE.test(n)).sort(); } catch { return; }
  let ch = false;
  for (const n of fl) {
    if (srSent[n]) continue;
    const f = path.join(dir, n), t0 = srT0(n); let st; try { st = fs.statSync(f); } catch { continue; }
    if (now - st.mtimeMs < 8000) continue;   // abhi band ho rahi hai
    ch = true;
    if (!SR.g) { srSent[n] = 'nog'; continue; }
    if (now - t0 > SR_BACK + 15 * 60000) { srSent[n] = 'old'; continue; }   // PC band tha / purani — group mein dher na lage
    if (st.size < 20000 || !srOkMp4(f)) { srSent[n] = 'bad'; continue; }
    if (st.size > 15.6e6) { srSent[n] = 'big'; log(`📼 ${n}: ${Math.round(st.size / 1e6)} MB — WhatsApp ki hadd se bari, nahi bheji`); continue; }
    const stamp = n.slice(4, -4), eid = 'bv-sab-' + stamp, vf = eid + '.mp4', t1 = t0 + SR_SEG * 1000, d0 = new Date(t0);
    try { fs.mkdirSync(SR_WAM, { recursive: true }); fs.copyFileSync(f, path.join(SR_WAM, vf)); } catch (e) { srSt.err = 'wa-media mein copy nahi hui (' + String(e.code || e.message).slice(0, 40) + ')'; ch = false; continue; }
    srSent[n] = 'q';
    const names = allList().map((x, i) => `${i + 1} ${x.n}`).join(' · ').slice(0, 300);
    const txt = `🎛 Sab cameras · ${d0.getDate()} ${SR_MON[d0.getMonth()]} · ${srHm(t0)} – ${srHm(t1)}${names ? '\n' + names : ''}`;
    biz.collection('waOut').doc(eid).create({ st: 'new', at: now, grp: SR.g, nm: SR.gn || 'Sab cameras', kind: 'bvs', eid, txt, vf })
      .then(() => { const day = new Date().toDateString(); if (srSt.day !== day) { srSt.day = day; srSt.sent = 0; } srSt.sent++; srSt.last = srHm(t0); srSt.at = Date.now(); srSent[n] = 'ok'; srSave(); })
      .catch(e => { if (/already exists|ALREADY_EXISTS/i.test(String(e && e.message))) { srSent[n] = 'ok'; } else { delete srSent[n]; srSt.err = 'group ko nahi gayi: ' + String(e && e.message).slice(0, 80); } srSave(); });
  }
  if (ch) srSave();
}
function srClean(now) {
  if (now - srCleanAt < 10 * 60000) return; srCleanAt = now;
  for (const dir of new Set([srDir(), path.join(DIR, 'sab-rec')])) { let fl = []; try { fl = fs.readdirSync(dir); } catch { continue; }
    for (const n of fl) { const t0 = srT0(n); if (t0 && now - t0 > SR.kd * 86400000) { try { fs.unlinkSync(path.join(dir, n)); } catch {} } } }
  if (!srJob) { const tmp = path.join(srDir(), 'tmp'); let fl = []; try { fl = fs.readdirSync(tmp); } catch {} for (const n of fl) { try { const f = path.join(tmp, n); if (now - fs.statSync(f).mtimeMs > 30 * 60000) fs.unlinkSync(f); } catch {} } }   // v2.7: adhoori / purani kaam ki files
}
function srTick() {
  const now = Date.now();
  srSt.rec = SR.on && CF.on ? 1 : 0; if (!SR.on) srSt.err = '';
  if (srJob && now - srJob.at > 9 * 60000) { log(`📼 ${srJob.n}: 9 min se ban rahi thi — band`); try { srJob.ff.kill(); } catch {} }
  else if (SR.on && CF.on && !srJob) { const t0 = srNext(now); if (t0) srMake(t0); }
  try { srSend(now); } catch (e) { log('⚠️ sab bhejna: ' + e.message); }
  try { srClean(now); } catch {}
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
  const dl = /~$/.test(String(r.pc || '')), pcN = dl ? String(r.pc).slice(0, -1) : String(r.pc || '');   // v2.7: ⏪ '~' = saaf (recording files se, ~2 min peeche)
  const isMo = isMoPc(pcN);   // v1.9: 🏬 sab godam cameras ek saath · v2.0: 🎛 '@sab' = sab cameras
  const ch = isMo ? (pcN === ALL ? 'ma' : 'mo') : chOf(pcN); if (!ch) return fail(`"${pcN || '?'}" counter ka camera channel ⚙️ mein nahi`);
  if (viewers.size >= MAX_V) return fail(`Abhi ${MAX_V} log dekh rahe hain — thori der baad`);
  const w = werift(); if (!w) return fail('WebRTC abhi install ho raha hai — 1-2 min baad dobara');
  const offer = String(r.offer || ''); if (!/^v=0/.test(offer)) return fail('ghalat offer');
  const codec = /H264/i.test(offer) ? 'h264' : 'vp8';
  const p = dl ? startDelayed(codec, isMo ? (pcN === ALL ? 'a' : 'g') : 's', isMo ? 0 : ch, pcN) : isMo ? startMosaic(codec, pcN === ALL ? 'a' : 'g') : startPipe(ch, codec); if (!p.ff && !p.sock) return fail(p.err || 'video shuru nahi hui');
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
    if (p.mo || p.dl) { if (p.pk !== p.pkSeen) { p.pkSeen = p.pk; p.pkAt = now; } else if (p.ff && now - (p.at || now) > (p.dl && !p.pk ? 45000 : 15000) && now - (p.pkAt || now) > (p.dl && !p.pk ? 45000 : 15000)) { log((p.dl ? '⏪ live ' + p.ch : '🏬 live ' + moLab(p)) + ': 15 s se video nahi — dobara (koi camera ruka)'); try { p.ff.kill(); } catch {} } }   // v1.9
    if (p.share && p.ff && now - (p.at || now) > 8000 && !shareOk(p.ch)) { log(`🔗 live ch ${p.ch}: recording ki line ruk gayi — dobara`); try { p.ff.kill(); } catch {} continue; }   // v1.2
    { const xs = p.dl ? [] : p.mo ? (p.list || []).map(v => srcs.get(v.ch)).filter(Boolean) : [p.share ? srcs.get(p.ch) : null].filter(Boolean), gT = xs.reduce((a, x) => a + (x.gap || 0) + (x.drop || 0), 0);   // v2.6: mosaic = sab camera   // v1.7: 🩺 pichhle 10 s mein tukre kahan gire — app chip
      const fresh = now - (p.at || now) < 8000;   // shuru ke pehle pal (beech GOP se jurna) ki ghaltiyan nahi gintay
      const d = fresh ? 0 : (p.de || 0) - (p.de0 || 0), g = fresh ? 0 : Math.max(0, gT - (p.g0 || 0)), r = fresh ? 0 : (p.rg || 0) - (p.rg0 || 0);
      p.de0 = p.de || 0; p.g0 = gT; p.rg0 = p.rg || 0;
      const kf = Math.round(Math.max(0, ...xs.map(x => kOk(x, now) ? (x.gop || 0) : 0)) / 1000);   // v2.6: camera ki poori tasveer (keyframe) har kitne second — NVR I-frame interval
      const sig = (d >= 2 ? 'd' : '') + (g > 0 ? 'g' : '') + (r > 0 ? 'r' : '') + (kf > 4 ? 'k' + kf : '');
      if (d >= 2 || g || r) log(`🩺 live ${p.mo ? moLab(p) : 'ch ' + p.ch}: 10 s mein NVR→PC ghalti ${d} · PC ke andar gire ${g} · RTP gire ${r}`);
      for (const [id, v] of viewers) if (v.pipe === p && (v.qs !== sig || d >= 2 || g || r)) { v.qs = sig; REQ.doc(id).set({ q: { d, g, r, kf, at: now } }, { merge: true }).catch(() => {}); } }
    if (p.pk > 0) { for (const [id, v] of viewers) if (v.pipe === p && !v.rtp) { v.rtp = 1; v.warn = ''; REQ.doc(id).set({ rtp: 1, warn: '' }, { merge: true }).catch(() => {}); } }
    else if (p.ff && now - (p.at || now) > (p.share || p.mo || p.dl ? 20000 : 12000)) warnViewers(p, p.dl ? '⏪ Saaf video abhi nahi aa rahi — recording ke tukre parh raha (⚙️ Setup → 🎞 Recording ON?)' : p.mo ? moLab(p) + ': abhi video nahi aa rahi — kisi camera ki recording ruki hai? (⚙️ Setup → 🎞 Recording)' : `Camera ch ${p.ch}: NVR se jur gaya par video nahi aa rahi — ye channel NVR par chal raha hai? (⚙️ mein counter ka channel dekhein)`);
  }
}, 10000);
setInterval(async () => { try { const s = await REQ.where('at', '<', Date.now() - 6 * 3600000).limit(200).get(); if (s.size) { const b = db.batch(); s.forEach(d => b.delete(d.ref)); await b.commit(); } } catch {} }, 60 * 60000);

// ---------- haal ----------
let ST = { err: '' }, stAt = 0;
async function pushSt(force) {
  if (!force && Date.now() - stAt < 20000) return; stAt = Date.now();
  const cams = [...pipes.values()].map(p => ({ ch: p.ch, n: p.tracks.size, on: p.ff ? 1 : 0, err: p.err || '' }));
  try { await biz.collection('blueAccess').doc('liveCamPc').set({ at: Date.now(), ver: VER, host: os.hostname(), ok: W ? 1 : 0, ff: ffPath() ? 1 : 0, err: AUTHBAD ? 'NVR 401 — ruka' : ST.err.slice(0, 160), v: viewers.size, cams, mo: moList().map(x => x.n), all: allList().map(x => x.n), sr: { on: SR.on ? 1 : 0, g: SR.g ? 1 : 0, kd: SR.kd, rec: srSt.rec, n: srSt.n, err: String(srSt.err || '').slice(0, 140), last: srSt.last, at: srSt.at, sent: srSt.sent, f: 1, job: srSt.job || '', mk: srSt.mk || 0, made: srSt.made || '' }, tu: { ok: TU.ok ? 1 : 0, err: TU.err, at: TU.at, exp: TU.exp, k: TK ? 1 : 0, k4: TK ? TK.id.slice(-4) : '' } }, { merge: true }); } catch (e) { log('⚠️ haal: ' + e.message); }   // v1.9: mo = godam cameras · v2.9: tu = 🔁 relay ka haal (chaabi kabhi nahi)
}

function main() {
  log(`🔴 live-cam v${VER} shuru — ${os.hostname()} · lock ${LOCK_PORT}`);
  werift(); pushSt(true);
  setInterval(ZINDA.guard ? ZINDA.guard(() => { werift(); pushSt(); turnTick(); }, 10 * 60000, 'tick') : () => { werift(); pushSt(); turnTick(); }, 30000);   // v2.9: 🔁 relay pass (sasta — zaroorat ho tab hi Cloudflare)
  setInterval(() => { try { srTick(); } catch (e) { log('⚠️ sab recording: ' + e.message); } }, 20000);   // v2.3: 📼
  process.on('exit', () => { for (const p of pipes.values()) { try { p.ff && p.ff.kill(); } catch {} } try { srJob && srJob.ff && srJob.ff.kill(); } catch {} for (const p of pipes.values()) { try { p.dl && dlStop(p); } catch {} } });
}
const lock = net.createServer();
lock.once('error', () => { console.log(`[${new Date().toLocaleTimeString()}] live-cam pehle se chal raha hai (lock ${LOCK_PORT})`); process.exit(3); });
lock.listen(LOCK_PORT, '127.0.0.1', () => { try { main(); } catch (e) { log('❌ ' + (e.stack || e.message || e)); setTimeout(() => process.exit(1), 5000); } });
