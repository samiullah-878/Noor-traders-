// =========================================================
//  owner-login.js  v1.0 (2026-10-21) — 🔑 MALIK KA PAKKA CODE (malik: "pakka code bana do — jahan par bhi lagaye malik ka open ho jaye,
//  logout kar de to larka apna code likh kar login kar de")
//
//  App (login screen "📱 6 hindse ka code") pehle larke ka code (deviceJoins pc-…) dhoondti hai; na mile to anjaan (anonymous) device
//  businesses/noor-traders/ownerLogin/<uid> = { code, at, device, ua, status: 'new' } likhta hai. Ye script (admin key — firebase-key.json):
//    blueAccess/ownerCode = { hash, salt, it, uid, email } (sirf PBKDF2-SHA256 hash — code kahin likha nahi) se milata hai.
//    Theek = admin.auth().createCustomToken(uid, { ntOwner: true }) -> doc { status: 'ok', token } (rules 2.69: sirf wahi device parhe).
//    Ghalat = { status: 'bad', msg }. Ek ghante mein 10 ghalat = 1 ghanta BAND (blueAccess/ownerCodeLock) — malik app se khol sakta hai.
//  Har code-login / band history (auditLog) mein. 10 min purane request khud saaf. POS / SQL mein KUCH NAHI (sql: false). Lock port 47835.
//  Chalana: owner-login-auto.bat (loop). Log: owner-login-log.txt. Code / token log mein KABHI nahi likha jata.
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
const MAX_FAILS = 10, WINDOW = 60 * 60000, LOCK_MS = 60 * 60000, STALE = 10 * 60000, LOCK_PORT = 47835;

const hashOf = (code, salt, it) => crypto.pbkdf2Sync(String(code), Buffer.from(String(salt), 'base64'), Number(it) || 120000, 32, 'sha256').toString('base64');
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const audit = (act, what) => biz.collection('auditLog').add({ area: 'login', act, what: String(what).slice(0, 160), by: 'shop-pc', byName: 'Shop PC (owner-login)', at: Date.now(), ts: FieldValue.serverTimestamp() }).catch(() => {});

const busy = new Set();
async function handle(doc) {
  const id = doc.id; if (busy.has(id)) return; busy.add(id);
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

let stop = null;
function listen() {
  try { stop && stop(); } catch {}
  stop = biz.collection('ownerLogin').where('status', '==', 'new').onSnapshot(s => { for (const d of s.docs) handle(d); }, e => { log('sun nahi sake: ' + (e.message || e) + ' — 30 sec baad dobara'); setTimeout(listen, 30000); });
  log('🔑 malik ke code ka intezar…');
}
// purane (10 min) request saaf — jo device ne mitaye nahi
const safai = ZINDA.guard(async () => { const s = await biz.collection('ownerLogin').limit(200).get(); for (const d of s.docs) if (Date.now() - (d.updateTime?.toMillis?.() || 0) > STALE) await d.ref.delete().catch(() => {}); }, 5 * 60000, 'safai');
// ek hi owner-login chale (lock port 47835)
const lock = require('net').createServer();
lock.once('error', () => { console.log('owner-login pehle se chal raha hai.'); process.exit(3); });
lock.listen(LOCK_PORT, '127.0.0.1', () => {
  log(`owner-login v1.0 shuru — malik ka pakka code (lock ${LOCK_PORT})`);
  listen();
  setInterval(() => safai().catch(e => log('safai: ' + (e.message || e))), 10 * 60000);
});
