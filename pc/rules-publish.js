// =========================================================
//  rules-publish.js  v1.0 (2026-10-27) — 🔐 FIRESTORE RULES KHUD PUBLISH (malik: "rules wala kaam tum kar do")
//
//  Pehle har naye rules version par malik ko firestore-rules-X.html bhej kar Firebase console mein paste + Publish karwana parta tha.
//  Ab shop PC (admin key firebase-key.json) har 5 min dekhta hai:
//    GitHub (main) ka version.json  → rules: "2.76"
//    blueAccess/rulesPub            → { ver, at, ruleset }  (aakhri publish)
//  Naya version ho to GitHub se firestore.rules la kar (header "BLUE KHATA v2.76" wahi ho, "ONLY note-traders-khata-7ccc1" likha ho,
//  firebase-key.json ka project bhi wahi) Firebase Rules REST API se:
//    1) POST  /v1/projects/<pid>/rulesets                      (compile — ghalat rules yahin ruk jati hain, kuch nahi badalta)
//    2) PATCH /v1/projects/<pid>/releases/cloud.firestore       (live)
//  Kamyab = blueAccess/rulesPub { ver, at, ruleset, by } + auditLog. Ghalti (403 = key ko ijazat nahi / compile error) = rulesPub.err —
//  app ke 🔐 Rules dabbe mein dikhti hai, malik haath se kar sakta hai (purana tareeqa wahi). POS / SQL mein KUCH NAHI (sql: false).
//  Chalana: rules-auto.bat (loop 5 min). Log: rules-publish-log.txt. Lock port 47836.
// =========================================================
const path = require('path');
const https = require('https');
const ZINDA = (() => { try { return require('./zinda.js')(__filename, { sql: false }); } catch (e) { const f = path.join(__dirname, path.basename(__filename, '.js') + '.alive'); const fs = require('fs'); setInterval(() => { try { fs.writeFileSync(f, String(Date.now())); } catch {} }, 30000); return { guard: fn => fn }; } })();
const { initializeApp, cert, getApps, getApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const DIR = __dirname, BUSINESS_ID = 'noor-traders', WANT_PID = 'note-traders-khata-7ccc1', LOCK_PORT = 47836;
const log = (...a) => console.log(`[${new Date().toLocaleTimeString()}]`, ...a);
const KEY = require(path.join(DIR, 'firebase-key.json'));
if (!getApps().length) initializeApp({ credential: cert(KEY) });
const db = getFirestore(), biz = db.collection('businesses').doc(BUSINESS_ID);
const pubRef = biz.collection('blueAccess').doc('rulesPub');
const PID = String(KEY.project_id || '');

function repos() { try { const l = JSON.parse(require('fs').readFileSync(path.join(DIR, 'local-config.json'), 'utf8')); if (l.repo) return [l.repo]; } catch {} return ['samiullah-878/Noor-traders-', 'samiullah-878/Noor-traders']; }
function get(url, opt = {}) {
  return new Promise((res, rej) => {
    const u = new URL(url);
    const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method: opt.method || 'GET', headers: opt.headers || {}, timeout: 30000 }, r => {
      const ch = []; r.on('data', d => ch.push(d)); r.on('end', () => res({ status: r.statusCode, body: Buffer.concat(ch).toString('utf8') }));
    });
    req.on('error', rej).on('timeout', function () { this.destroy(Error('timeout')); });
    if (opt.body) req.write(opt.body);
    req.end();
  });
}
async function fromGitHub(file) {
  let last = '';
  for (const r of repos()) {
    try { const x = await get(`https://raw.githubusercontent.com/${r}/main/${file}?t=${Date.now()}`); if (x.status === 200) return x.body; last = file + ' ' + x.status; } catch (e) { last = e.message || String(e); }
  }
  throw Error('GitHub se nahi mila: ' + last);
}
async function token() {
  const t = await getApp().options.credential.getAccessToken();
  if (!t || !t.access_token) throw Error('access token nahi mila');
  return t.access_token;
}
async function api(method, p, body) {
  const tk = await token();
  const r = await get('https://firebaserules.googleapis.com/v1/' + p, { method, headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  let j = {}; try { j = JSON.parse(r.body || '{}'); } catch {}
  if (r.status < 200 || r.status >= 300) throw Error(`${method} ${p} → ${r.status}: ${(j.error && j.error.message) || r.body.slice(0, 300)}`);
  return j;
}
let lastErr = '';
async function tick() {
  if (PID !== WANT_PID) { if (lastErr !== 'pid') { lastErr = 'pid'; log('⛔ firebase-key.json ka project ' + PID + ' hai — rules SIRF ' + WANT_PID + ' ke liye. Kuch nahi kiya.'); } return; }
  let ver = '';
  try { ver = String(JSON.parse(await fromGitHub('version.json')).rules || ''); } catch (e) { log('version.json: ' + (e.message || e)); return; }
  if (!/^\d+\.\d+$/.test(ver)) { log('version.json mein rules ka number ajeeb: ' + ver); return; }
  const cur = (await pubRef.get()).data() || {};
  if (cur.ver === ver) return;   // pehle se yahi publish hai
  if (cur.errVer === ver && cur.errAt && Date.now() - Number(cur.errAt) < 6 * 3600000) return;   // isi version par ghalti aa chuki — 6 ghante baad dobara
  log(`🔐 rules v${ver} chahiye (publish: v${cur.ver || '—'}) — GitHub se la raha hoon…`);
  let txt = '';
  try { txt = await fromGitHub('firestore.rules'); } catch (e) { log('firestore.rules: ' + (e.message || e)); return; }
  const hv = (txt.match(/BLUE KHATA v([\d.]+)/) || [])[1] || '';
  if (hv !== ver) { log(`⚠️ GitHub ki firestore.rules v${hv} hai, version.json v${ver} kehta hai — abhi nahi (GitHub Pages / raw thori der mein ek ho jayenge)`); return; }
  if (!/ONLY\s+note-traders-khata-7ccc1/.test(txt) || !/rules_version\s*=\s*'2'/.test(txt)) { await fail(ver, 'rules file mein project ki pehchan nahi — publish nahi ki'); return; }
  try {
    const rs = await api('POST', `projects/${PID}/rulesets`, { source: { files: [{ name: 'firestore.rules', content: txt }] } });
    const name = rs.name; if (!name) throw Error('ruleset ka naam nahi mila');
    await api('PATCH', `projects/${PID}/releases/cloud.firestore`, { release: { name: `projects/${PID}/releases/cloud.firestore`, rulesetName: name } });
    await pubRef.set({ ver, at: Date.now(), ruleset: name, by: 'shop-pc', lines: txt.split('\n').length, err: FieldValue.delete(), errAt: FieldValue.delete(), errVer: FieldValue.delete() }, { merge: true });
    await biz.collection('auditLog').add({ area: 'rules', act: 'publish', what: `Firestore rules v${ver} publish (PC se) — ${name.split('/').pop()}`, by: 'shop-pc', byName: 'Shop PC (rules-publish)', at: Date.now(), ts: FieldValue.serverTimestamp() }).catch(() => {});
    lastErr = ''; log(`✅ rules v${ver} LIVE — ${name}`);
  } catch (e) { await fail(ver, e.message || String(e)); }
}
async function fail(ver, why) {
  log('❌ v' + ver + ': ' + why);
  const hint = /403|PERMISSION_DENIED|permission/i.test(why) ? ' · firebase-key.json ko "Firebase Rules Admin" role chahiye (Google Cloud → IAM) — ya malik app ke 🔐 Rules se haath se publish kare' : '';
  await pubRef.set({ err: String(why).slice(0, 400) + hint, errAt: Date.now(), errVer: ver }, { merge: true }).catch(() => {});
}
const lock = require('net').createServer();
lock.once('error', () => { console.log('rules-publish pehle se chal raha hai.'); process.exit(3); });
lock.listen(LOCK_PORT, '127.0.0.1', () => {
  log(`rules-publish v1.0 shuru — har 5 min GitHub rules dekhta hoon (lock ${LOCK_PORT})`);
  const run = ZINDA.guard(tick, 4 * 60000, 'tick');
  run().catch(e => log('tick: ' + (e.message || e)));
  setInterval(() => run().catch(e => log('tick: ' + (e.message || e))), 5 * 60000);
});
