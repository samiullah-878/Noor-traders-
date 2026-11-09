// =========================================================
//  server-join.js  v1.0 (2026-11-09) — 🖥 NAYA SERVER PC: purane server ki chaabi / SQL setting malik ki app se lo
//  Chalana: server-setup.ps1 khud chalata hai (node server-join.js). Koi npm package nahi chahiye (Node 18+: fetch + webcrypto).
//
//  1) Firebase par GUMNAAM (anonymous) login — sirf apna ek doc likh / parh sake (rules: pcJoin/<apna uid>).
//  2) ECDH (P-256) ki chaabi-jori YAHIN banti hai (private kabhi bahar nahi) + 6 hindse ka code → pcJoin/<uid> {code, pub, host, at, st 'new'}.
//  3) Malik app → Settings → 🖥 Naya server jodo → code → app purane server ka taale wala backup (pcVault, sirf malik) isi PC ki public
//     chaabi se AES-GCM mein band kar ke {box, iv, apub, st 'ok'} likhti hai (code AAD — ghalat doc = khulega nahi).
//  4) Yahan khol kar SIRF ye files rakhta hai: firebase-key.json, local-config.json, label-settings.json, label-numbers.json
//     (pehle se ho to .old-<waqt> bana kar) → st 'done' → exit 0. server-setup.ps1 phir KHATA-DOCTOR chalata hai (baqi sab khud).
//  AI NAHI. POS mein KUCH nahi.
// =========================================================
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { subtle } = crypto.webcrypto;
const DIR = __dirname;
const RAW = 'https://raw.githubusercontent.com/samiullah-878/Noor-traders-/main/';
const ALLOW = ['firebase-key.json', 'local-config.json', 'label-settings.json', 'label-numbers.json'];
const REFERER = 'https://samiullah-878.github.io/Noor-traders-/';
const b64 = u8 => Buffer.from(u8).toString('base64');
const unb64 = s => new Uint8Array(Buffer.from(String(s || ''), 'base64'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const say = (t = '') => console.log(t);

async function config() {
  if (process.env.NT_CFG_JSON) return JSON.parse(process.env.NT_CFG_JSON);
  let txt = ''; try { txt = fs.readFileSync(path.join(DIR, 'firebase-config.js'), 'utf8'); } catch {}
  if (!txt) { const r = await fetch(RAW + 'firebase-config.js?t=' + Date.now()); txt = await r.text(); }
  const g = k => (txt.match(new RegExp(k + '\\s*:\\s*["\']([^"\']+)["\']')) || [])[1] || '';
  const c = { apiKey: g('apiKey'), projectId: g('projectId') || 'nt-traders' };
  if (!c.apiKey) throw Error('firebase-config.js se apiKey nahi mili');
  return c;
}
const AUTH = () => process.env.NT_AUTH_URL || 'https://identitytoolkit.googleapis.com/v1/accounts:signUp';
const FSB = c => (process.env.NT_FS_BASE || 'https://firestore.googleapis.com/v1') + `/projects/${c.projectId}/databases/(default)/documents/businesses/noor-traders/pcJoin`;
async function http(url, opt = {}) {
  const r = await fetch(url, { ...opt, headers: { 'Content-Type': 'application/json', Referer: REFERER, ...(opt.headers || {}) } });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
  if (!r.ok) throw Error(`${r.status} ${(j && j.error && (j.error.message || j.error.status)) || t.slice(0, 160)}`);
  return j || {};
}
const S = v => ({ stringValue: String(v) }), I = v => ({ integerValue: String(Math.round(v)) });
const val = f => f ? (f.stringValue ?? (f.integerValue != null ? Number(f.integerValue) : undefined)) : undefined;

// --- crypto (app naya-server.js ke sath HUBAHU ek format) ---
async function keyPair() { const kp = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']); const pub = new Uint8Array(await subtle.exportKey('raw', kp.publicKey)); return { priv: kp.privateKey, pub: b64(pub) }; }
async function openBox(priv, apubB64, ivB64, boxB64, code) {
  const apub = await subtle.importKey('raw', unb64(apubB64), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const key = await subtle.deriveKey({ name: 'ECDH', public: apub }, priv, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const pt = await subtle.decrypt({ name: 'AES-GCM', iv: unb64(ivB64), additionalData: new TextEncoder().encode(String(code)) }, key, unb64(boxB64));
  return new TextDecoder().decode(pt);
}
function writeFiles(j) {
  const o = JSON.parse(j); const files = (o && o.files) || {}; const done = [];
  for (const [n, t] of Object.entries(files)) {
    if (!ALLOW.includes(n)) continue;
    try { JSON.parse(t); } catch { say(`  ! ${n} theek nahi - chhor di`); continue; }
    const p = path.join(DIR, n);
    if (fs.existsSync(p)) { const old = fs.readFileSync(p, 'utf8'); if (old === t) { done.push(n + ' (pehle se wahi)'); continue; } fs.renameSync(p, p + '.old-' + Date.now()); }
    fs.writeFileSync(p, t); done.push(n);
  }
  return done;
}

async function main() {
  say(''); say('===== NAYA SERVER - malik ki app se chaabi lena =====');
  const c = await config();
  const auth = await http(AUTH() + '?key=' + encodeURIComponent(c.apiKey), { method: 'POST', body: JSON.stringify({ returnSecureToken: true }) });
  const tok = auth.idToken, uid = auth.localId; if (!tok || !uid) throw Error('Firebase login nahi hua');
  const H = { Authorization: 'Bearer ' + tok };
  const kp = await keyPair();
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const host = os.hostname().slice(0, 60);
  await http(FSB(c) + '?documentId=' + encodeURIComponent(uid), { method: 'POST', headers: H, body: JSON.stringify({ fields: { code: S(code), pub: S(kp.pub), host: S(host), at: I(Date.now()), st: S('new') } }) });
  say(''); say('   +-----------------------------+');
  say(`   |     CODE:   ${code.slice(0, 3)} ${code.slice(3)}         |`);
  say('   +-----------------------------+');
  say(`   PC: ${host}`); say('');
  say('   Malik app mein: Settings > Naya server jodo > ye code likhein > "Is PC ko do".');
  say('   DHYAN: purana server PC chal raha ho to PEHLE us ko band karein - dono chale to POS mein bill DO DAFA ban sakte hain.');
  say(''); say('   Intezar... (20 minute tak)');
  const until = Date.now() + 20 * 60000; let last = '';
  while (Date.now() < until) {
    await sleep(2000);
    let d; try { d = await http(FSB(c) + '/' + encodeURIComponent(uid), { headers: H }); } catch (e) { if (String(e.message) !== last) say('   ... ' + (last = String(e.message))); continue; }
    const f = d.fields || {}, st = val(f.st);
    if (st !== 'ok' || !val(f.box)) continue;
    let j;
    try { j = await openBox(kp.priv, val(f.apub), val(f.iv), val(f.box), code); }
    catch (e) { say('   X Taala nahi khula (code / chaabi ghalat): ' + e.message); await http(FSB(c) + '/' + encodeURIComponent(uid) + '?updateMask.fieldPaths=st&updateMask.fieldPaths=doneAt', { method: 'PATCH', headers: H, body: JSON.stringify({ fields: { st: S('err'), doneAt: I(Date.now()) } }) }).catch(() => {}); return 1; }
    const done = writeFiles(j);
    await http(FSB(c) + '/' + encodeURIComponent(uid) + '?updateMask.fieldPaths=st&updateMask.fieldPaths=doneAt', { method: 'PATCH', headers: H, body: JSON.stringify({ fields: { st: S('done'), doneAt: I(Date.now()) } }) }).catch(e => say('   (app ko "ho gaya" nahi bata saka: ' + e.message + ')'));
    say(''); say('   OK - chaabi aa gayi: ' + done.join(', ')); return 0;
  }
  say('   X 20 minute mein app se jawab nahi aaya - yehi command dobara chalayein (naya code).'); return 1;
}

if (require.main === module) main().then(c => process.exit(c || 0)).catch(e => { say('   X ' + (e && e.message || e)); process.exit(1); });
module.exports = { keyPair, openBox, writeFiles };
