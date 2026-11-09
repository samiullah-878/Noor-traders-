// =========================================================
//  owner-login.js  v2.0 (2026-11-09; v1.0 2026-10-21) — 🔑 MALIK KA PAKKA CODE (malik: "pakka code bana do — jahan par bhi lagaye malik ka open ho jaye,
//  logout kar de to larka apna code likh kar login kar de")
//
//  App (login screen "📱 6 hindse ka code") pehle larke ka code (deviceJoins pc-…) dhoondti hai; na mile to anjaan (anonymous) device
//  businesses/noor-traders/ownerLogin/<uid> = { code, at, device, ua, status: 'new' } likhta hai. Ye script (admin key — firebase-key.json):
//    blueAccess/ownerCode = { hash, salt, it, uid, email } (sirf PBKDF2-SHA256 hash — code kahin likha nahi) se milata hai.
//    Theek = admin.auth().createCustomToken(uid, { ntOwner: true }) -> doc { status: 'ok', token } (rules 2.69: sirf wahi device parhe).
//    Ghalat = { status: 'bad', msg }. Ek ghante mein 10 ghalat = 1 ghanta BAND (blueAccess/ownerCodeLock) — malik app se khol sakta hai.
//  Har code-login / band history (auditLog) mein. 10 min purane request khud saaf. POS / SQL mein KUCH NAHI (sql: false). Lock port 47835.
//  Chalana: owner-login-auto.bat (loop). Log: owner-login-log.txt. Code / token log mein KABHI nahi likha jata.
//
//  v2.0 (2026-11-09, app v2.221.0, rules 2.101) — 👥 MULAZIM LOGIN BHI YAHIN (malik: "koi bhi hacker na aaye"):
//    pehle phone khud blueStaffSessions likhta tha — rules sirf dekhte the ke key maujood hai. 6 hindse ka code / 6 hindse ka
//    password = hacker ka program be-hadd koshish kar ke mulazim ban sakta tha. Ab session SIRF yeh script (admin) likhti hai.
//    Phone businesses/noor-traders/staffLogin/<uid> = { k, v, scope, at, device, ua, status: 'new' } (sirf apna uid, rules 2.101):
//      k 'code' (v = 6 hindse — deviceJoins/pc-…; na mile aur malik ka code ho to { status: 'owner' } — app phir ownerLogin wala raasta)
//      k 'tk'   (v = 8 harf ka link — deviceJoins/tk-…, 7 din)            → { status: 'ok', cid, scope, perms, name, staffId }
//      k 'cid'  (v = credentialId — link / code ke baad, ya password ka PBKDF2) → blueStaffSessions/<uid> banao (key active ho)
//      k 'sw'   (v = credentialId — screen badalna, password se)              → apna session nayi key par
//    Ghalat = fails++ (blueAccess/staffLoginLock); ek ghante mein 10 = 1 ghanta BAND (sirf kamzor raaste: code / password key;
//    'st-' + 40 hex wali asli mulazim key aur 8 harf ka link band mein bhi chalte — un ka andaza mumkin hi nahi). Malik app
//    (👥 Mulazim screen) se khol sakta hai. Code ka doc tabhi mitta jab session ban jaye (2 min yaad), warna larka dobara likh sake.
// =========================================================
const path = require('path');
const crypto = require('crypto');
const ZINDA = (() => { try { return require('./zinda.js')(__filename, { sql: false }); } catch (e) { const f = require('path').join(__dirname, require('path').basename(__filename, '.js') + '.alive'), w = () => { try { require('fs').writeFileSync(f, String(Date.now())); } catch {} }; w(); setInterval(w, 30000).unref(); return { beat: w, guard: fn => fn }; } })();
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

const DIR = __dirname, BUSINESS_ID = 'noor-traders';
const log = (...a) => console.log(`[${new Date().toLocaleTimeString()}]`, ...a);
if (!getApps().length) initializeApp({ credential: cert(require(path.join(DIR, 'firebase-key.json'))) });
const db = getFirestore(), biz = db.collection('businesses').doc(BUSINESS_ID);
const codeRef = biz.collection('blueAccess').doc('ownerCode'), lockRef = biz.collection('blueAccess').doc('ownerCodeLock');
const sLockRef = biz.collection('blueAccess').doc('staffLoginLock');   // v2.0: 👥 mulazim login ki ghalat koshishen
const MAX_FAILS = 10, WINDOW = 60 * 60000, LOCK_MS = 60 * 60000, STALE = 10 * 60000, LOCK_PORT = 47835;

const hashOf = (code, salt, it) => crypto.pbkdf2Sync(String(code), Buffer.from(String(salt), 'base64'), Number(it) || 120000, 32, 'sha256').toString('base64');
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const audit = (act, what) => biz.collection('auditLog').add({ area: 'login', act, what: String(what).slice(0, 160), by: 'shop-pc', byName: 'Shop PC (owner-login)', at: Date.now(), ts: FieldValue.serverTimestamp() }).catch(() => {});

const busy = new Set();
async function handle(doc) {
  const id = doc.id + ':' + (doc.updateTime?.toMillis?.() || 0); if (busy.has(id)) return; busy.add(id);   // v2.0: har darkhwast alag — foran dobara likha code atakta nahi
  try {
    const r = doc.data() || {};
    if (r.status !== 'new') return;
    const t = doc.updateTime?.toMillis?.() || Number(r.at) || 0;   // server ka waqt (phone ki ghalat ghari se nahi)
    if (Date.now() - t > STALE) { await doc.ref.delete().catch(() => {}); return; }
    const dev = String(r.device || '').slice(0, 20) || '?';
    const [cs, ls] = await Promise.all([codeRef.get(), lockRef.get()]);
    const c = cs.exists ? cs.data() : null, L = ls.exists ? ls.data() : {};
    if (!c || !c.hash || !c.salt || !c.uid) { await doc.ref.update({ status: 'off', msg: 'Code ghalat ya khatam — malik se naya code lein' }); return; }   // malik ka code laga hi nahi = larke ka purana code
    if (Number(L.until) > Date.now()) { await doc.ref.update({ status: 'lock', msg: `Bohat ghalat koshishen — ${new Date(Number(L.until)).toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit' })} tak code band (password se login karein)` }); return; }
    const ok = /^\d{6}$/.test(String(r.code || '')) && same(hashOf(r.code, c.salt, c.it), c.hash);
    if (!ok) {
      const fails = (Array.isArray(L.fails) ? L.fails : []).filter(t => Date.now() - Number(t) < WINDOW).concat(Date.now()).slice(-50);
      const lock = fails.length >= MAX_FAILS;
      await lockRef.set({ fails, until: lock ? Date.now() + LOCK_MS : 0, at: Date.now() }, { merge: true });
      await doc.ref.update({ status: lock ? 'lock' : 'bad', msg: lock ? 'Bohat ghalat koshishen — malik ka code 1 ghante ke liye band (password se login karein)' : `Code ghalat ya purana (${fails.length}/${MAX_FAILS}) — larka malik se naya code le` });
      log(`❌ ghalat malik code — device ${dev} (${fails.length}/${MAX_FAILS})${lock ? ' — 1 GHANTA BAND' : ''}`);
      if (lock) audit('owner-code-lock', `🔒 Malik ka code ${MAX_FAILS} ghalat koshishon par 1 ghanta band · aakhri device ${dev}`);
      return;
    }
    const token = await getAuth().createCustomToken(String(c.uid), { ntOwner: true });
    await doc.ref.update({ status: 'ok', token });
    await lockRef.set({ fails: [], until: 0, last: Date.now(), lastDev: dev, at: Date.now() }, { merge: true });
    audit('owner-code', `🔑 Malik code se login · device ${dev}`);
    log(`✅ malik code se login — device ${dev}`);
  } catch (e) {
    log('masla: ' + (e.message || e));
    try { await doc.ref.update({ status: 'bad', msg: 'Shop PC par masla — dobara koshish karein' }); } catch {}
  } finally { setTimeout(() => busy.delete(id), 5000); }
}

// ---------- v2.0: 👥 MULAZIM LOGIN (session sirf yahan banta hai) ----------
const CODE_AGE = 30 * 60000, LINK_AGE = 7 * 24 * 3600e3, PEND_MS = 2 * 60000;
const STRONG_CID = /^st-[0-9a-f]{40}$/;
const pend = new Map();   // cid → { ref (deviceJoins doc), at } — session bante hi code / link mita do
const keyOk = k => !!k && k.active === true && k.loginEnabled !== false;
const sBusy = new Set();
async function staffFail(doc, L, dev, what) {
  const fails = (Array.isArray(L.fails) ? L.fails : []).filter(t => Date.now() - Number(t) < WINDOW).concat(Date.now()).slice(-50);
  const lock = fails.length >= MAX_FAILS;
  await sLockRef.set({ fails, until: lock ? Date.now() + LOCK_MS : 0, at: Date.now(), lastBad: Date.now(), lastBadDev: dev }, { merge: true });
  const msg = lock ? 'Bohat ghalat koshishen — naya login 1 ghante ke liye band. Malik app (👥 Mulazim) se khol sakta hai.' : `${what} (${fails.length}/${MAX_FAILS})`;
  await doc.ref.update({ status: lock ? 'lock' : 'bad', msg });
  log(`❌ mulazim login ghalat — ${doc.data().k} · device ${dev} (${fails.length}/${MAX_FAILS})${lock ? ' — 1 GHANTA BAND' : ''}`);
  if (lock) audit('staff-login-lock', `🔒 Mulazim login ${MAX_FAILS} ghalat koshishon par 1 ghanta band · aakhri device ${dev}`);
}
async function handleStaff(doc) {
  const uid = doc.id, bk = uid + ':' + (doc.updateTime?.toMillis?.() || 0); if (sBusy.has(bk)) return; sBusy.add(bk);   // har darkhwast alag (wahi phone foran dobara likhe to bhi)
  try {
    const r = doc.data() || {};
    if (r.status !== 'new') return;
    const t = doc.updateTime?.toMillis?.() || Number(r.at) || 0;
    if (Date.now() - t > STALE) { await doc.ref.delete().catch(() => {}); return; }
    const k = String(r.k || ''), v = String(r.v || ''), dev = String(r.device || '').slice(0, 20) || '?';
    const ls = await sLockRef.get(), L = ls.exists ? ls.data() : {};
    const strong = k === 'tk' || ((k === 'cid' || k === 'sw') && STRONG_CID.test(v));
    if (!strong && Number(L.until) > Date.now()) {
      await doc.ref.update({ status: 'lock', msg: `Bohat ghalat koshishen — ${new Date(Number(L.until)).toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit' })} tak naya login band (malik app se khol sakta hai)` });
      return;
    }
    if (k === 'code' || k === 'tk') {
      const okFmt = k === 'code' ? /^\d{6}$/.test(v) : /^[A-Z0-9]{8}$/.test(v);
      const jr = okFmt ? biz.collection('deviceJoins').doc((k === 'code' ? 'pc-' : 'tk-') + v) : null;
      const js = jr ? await jr.get() : null, j = js && js.exists ? js.data() : null;
      if (j && j.credentialId) {
        const age = Date.now() - (Number(j.at) || 0);
        if (k === 'code' ? (!j.keep && age > CODE_AGE) : age > LINK_AGE) {
          await jr.delete().catch(() => {});
          await doc.ref.update({ status: 'bad', msg: k === 'code' ? 'Code 30 minute purana hai — malik se naya code lein' : 'Link 7 din purana hai — malik se naya link lein' });
          return;
        }
        pend.set(String(j.credentialId), { ref: jr, at: Date.now() });
        await doc.ref.update({ status: 'ok', cid: String(j.credentialId), scope: String(j.scope || ''), perms: Array.isArray(j.perms) ? j.perms.slice(0, 10).map(String) : [], name: String(j.name || '').slice(0, 40), staffId: String(j.staffId || '').slice(0, 40) });
        log(`✅ mulazim ${k === 'code' ? 'code' : 'link'} theek — ${String(j.name || '').slice(0, 20)} · device ${dev}`);
        return;
      }
      if (k === 'code' && okFmt) {   // larke ka code nahi — shayad malik ka pakka code (us ka faisla owner-login wala raasta karega, yahan ginti nahi)
        const cs = await codeRef.get(), c = cs.exists ? cs.data() : null;
        if (c && c.hash && c.salt && same(hashOf(v, c.salt, c.it), c.hash)) { await doc.ref.update({ status: 'owner' }); return; }
      }
      return staffFail(doc, L, dev, k === 'code' ? 'Code ghalat ya khatam — malik se naya code lein' : 'Yeh link khatam ho chuka ya ghalat hai — malik se naya link lein');
    }
    if (k === 'cid' || k === 'sw') {
      const ks = /^[A-Za-z0-9_-]{8,90}$/.test(v) ? await biz.collection('blueStaffKeys').doc(v).get() : null;
      if (!ks || !ks.exists || !keyOk(ks.data())) return staffFail(doc, L, dev, 'Password ghalat hai (ya ye screen band hai)');
      const sRef = biz.collection('blueStaffSessions').doc(uid);
      if (k === 'sw') {
        const ss = await sRef.get();
        if (!ss.exists) { await doc.ref.update({ status: 'bad', msg: 'Pehle login karein' }); return; }
        await sRef.set({ credentialId: v, createdAt: Number(ss.data().createdAt) || Date.now(), switchedAt: Date.now() });
      } else await sRef.set({ credentialId: v, createdAt: Date.now() });
      const p = pend.get(v); if (p) { pend.delete(v); await p.ref.delete().catch(() => {}); }
      await doc.ref.update({ status: 'ok' });
      log(`✅ mulazim ${k === 'sw' ? 'screen badli' : 'login'} — ${String(ks.data().name || '').slice(0, 20)} · device ${dev}`);
      return;
    }
    await doc.ref.update({ status: 'bad', msg: 'Ghalat darkhwast' });
  } catch (e) {
    log('mulazim login masla: ' + (e.message || e));
    try { await doc.ref.update({ status: 'bad', msg: 'Shop PC par masla — dobara koshish karein' }); } catch {}
  } finally { setTimeout(() => sBusy.delete(bk), 5000); }
}
let stopS = null;
function listenStaff() {
  try { stopS && stopS(); } catch {}
  stopS = biz.collection('staffLogin').where('status', '==', 'new').onSnapshot(s => { for (const d of s.docs) handleStaff(d); }, e => { log('mulazim login sun nahi sake: ' + (e.message || e) + ' — 30 sec baad dobara'); setTimeout(listenStaff, 30000); });
  log('👥 mulazim login ka intezar…');
}

let stop = null;
function listen() {
  try { stop && stop(); } catch {}
  stop = biz.collection('ownerLogin').where('status', '==', 'new').onSnapshot(s => { for (const d of s.docs) handle(d); }, e => { log('sun nahi sake: ' + (e.message || e) + ' — 30 sec baad dobara'); setTimeout(listen, 30000); });
  log('🔑 malik ke code ka intezar…');
}
// purane (10 min) request saaf — jo device ne mitaye nahi
const safai = ZINDA.guard(async () => {
  for (const col of ['ownerLogin', 'staffLogin']) { const s = await biz.collection(col).limit(200).get(); for (const d of s.docs) if (Date.now() - (d.updateTime?.toMillis?.() || 0) > STALE) await d.ref.delete().catch(() => {}); }
  for (const [cid, p] of pend) if (Date.now() - p.at > PEND_MS) pend.delete(cid);   // session nahi bana — code / link wahi rahe (larka dobara likh sake)
}, 5 * 60000, 'safai');
// ek hi owner-login chale (lock port 47835)
const lock = require('net').createServer();
lock.once('error', () => { console.log('owner-login pehle se chal raha hai.'); process.exit(3); });
lock.listen(LOCK_PORT, '127.0.0.1', () => {
  log(`owner-login v2.0 shuru — malik ka pakka code + 👥 mulazim login (lock ${LOCK_PORT})`);
  listen();
  listenStaff();
  setInterval(() => safai().catch(e => log('safai: ' + (e.message || e))), 10 * 60000);
});
