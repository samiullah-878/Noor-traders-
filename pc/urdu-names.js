// =====================================================================================================
//  urdu-names.js  v1.3 (2026-10-15: partyAny + fillParties force — 💰 galla parchi) · v1.2 (2026-10-14: fillParties — Server PC khud AI (Gemini, blueAccess/aiConfig) se baqi parties ke Urdu naam, har 10 min) · v1.1 (2026-10-14: + PARTY ke Urdu naam blueAccess/urduParties — voucher parchi) · v1.0 (2026-10-14) — 🔤 PARCHI PAR URDU NAAM (transfer note + gate pass)
//  Malik: "jitna bi gate pass or transfer notes print kar rahe hain un sb ko urdu bi sath ani chahie".
//  Naam wahi jo app mein (Stock → 🔤 Urdu naam / labels): Firestore blueAccess/urduNames {map: itemId -> Urdu} — LIVE (onSnapshot),
//  har print par Firestore nahi parhta (tez). Setting blueAccess/printConfig.urduSlip (default ON; app: 🖨 Print setting).
//  Text parchi mein Urdu line ek NISHAN ke saath: line(ur, px) -> toJob(text) us ko nt-parchi ki raster tasveer bana deta hai (daayein).
//  Jis item ka Urdu naam nahi = sirf English (pehle jaisa).
//  Istemal: transfer-sync.js (STOCK TRANSFER NOTE) · sale-post.js + nt-print.js (GATE PASS).
// =====================================================================================================
const MARK = '\u0001UR\u0001';
let map = {}, pmap = {}, on = true, started = false;

function watch(db, businessId, log = () => {}) {
  if (started || !db) return; started = true;
  const ba = db.collection('businesses').doc(businessId).collection('blueAccess');
  try { ba.doc('urduNames').onSnapshot(s => { map = (s.exists && (s.data() || {}).map) || {}; }, e => log('Urdu naam nahi mile: ' + e.message)); } catch (e) { log('Urdu naam nahi mile: ' + e.message); }
  try { ba.doc('urduParties').onSnapshot(s => { pmap = (s.exists && (s.data() || {}).map) || {}; }, () => {}); } catch {}   // v1.1
  try { ba.doc('printConfig').onSnapshot(s => { on = !(s.exists && (s.data() || {}).urduSlip === false); }, () => {}); } catch {}
}
const get = id => (on && id != null ? String(map[String(id)] || '').replace(/[\u0001\r\n]+/g, ' ').trim() : '');
const party = id => (on && id ? String(pmap[String(id)] || '').replace(/[\u0001\r\n]+/g, ' ').trim() : '');   // v1.1
const isOn = () => on;
const partyAny = id => (id ? String(pmap[String(id)] || '').replace(/[\u0001\r\n]+/g, ' ').trim() : '');   // v1.3: galla parchi — urduSlip band ho tab bhi
const line = (ur, px = 32) => MARK + String(ur).replace(/[\u0001\r\n]+/g, ' ') + '\u0001' + (Number(px) || 32);
const has = t => String(t || '').includes(MARK);
const strip = t => String(t || '').split('\r\n').filter(l => !l.startsWith(MARK)).join('\r\n');   // tasveer na ban sake to bina Urdu

// ESC/POS text ('\r\n' lines, latin1) -> nt-parchi job { s: [...] } — aam lines jaisi thi, Urdu lines tasveer (daayein, mota)
function toJob(text, { font = 'Jameel Noori Nastaleeq,Urdu Typesetting,Segoe UI,Tahoma,Arial', dots = 512 } = {}) {
  const s = [], ls = String(text || '').split('\r\n'); let buf = '';
  const flush = () => { if (buf) { s.push({ r: Buffer.from(buf, 'latin1').toString('base64') }); buf = ''; } };
  ls.forEach((l, i) => {
    if (l.startsWith(MARK)) { const [ur, px] = l.slice(MARK.length).split('\u0001'); flush(); s.push({ i: ur, f: font, px: Number(px) || 32, b: true, w: dots, a: 2 }); }
    else buf += l + (i < ls.length - 1 ? '\r\n' : '');
  });
  flush();
  return { s };
}
// v1.2: 🤖 PARTY KE URDU NAAM KHUD (malik: "parties ka naam bhi Urdu mein likh diya karo") — jin ka naam nahi, 80 ek dafa, Gemini tez (bina soche).
//   Key wahi jo app mein (blueAccess/aiConfig). Print ke waqt AI NAHI chalta (naam pehle se bane) — parchi slow nahi. Ghalti par 1 ghanta ruko.
const https = require('https');
function gem(key, model, prompt, noThink = true) {
  const body = JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0, responseMimeType: 'application/json', ...(noThink ? { thinkingConfig: { thinkingBudget: 0 } } : {}) } });
  return new Promise((res, rej) => {
    const rq = https.request({ hostname: 'generativelanguage.googleapis.com', path: '/v1beta/models/' + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(key), method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: 60000 }, r => {
      let d = ''; r.setEncoding('utf8'); r.on('data', c => { d += c; }); r.on('end', () => { let j = null; try { j = JSON.parse(d); } catch {} if (r.statusCode !== 200) return rej(Object.assign(new Error('AI ' + r.statusCode + ': ' + String(j?.error?.message || d).slice(0, 160)), { code: r.statusCode })); res((j?.candidates?.[0]?.content?.parts || []).filter(p => !p.thought).map(p => p.text || '').join('')); });
    });
    rq.on('timeout', () => rq.destroy(new Error('AI 60 sec mein jawab nahi'))); rq.on('error', rej); rq.write(body); rq.end();
  });
}
let fillBusy = false, fillWaitTill = 0;
async function fillParties({ db, businessId, parties, log = () => {}, force = false }) {
  if (fillBusy || (!on && !force) || (Date.now() < fillWaitTill && !force) || !db) return 0;
  const todo = (parties || []).filter(p => p && p.id && String(p.name || '').trim() && !String(pmap[String(p.id)] || '').trim());
  if (!todo.length) return 0;
  fillBusy = true; let done = 0;
  try {
    const ba = db.collection('businesses').doc(businessId).collection('blueAccess');
    const c = await ba.doc('aiConfig').get(), cfg = c.exists ? (c.data() || {}) : {};
    if (!cfg.key) { fillWaitTill = Date.now() + 3600000; return 0; }
    const model = String(cfg.model || 'gemini-2.5-flash');
    for (let i = 0; i < Math.min(todo.length, 240); i += 80) {
      const chunk = todo.slice(i, i + 80);
      const prompt = 'Tum Pakistani dukaan ke khaton (customers / suppliers / kharcha) ke naam Urdu rasm-ul-khat mein likhte ho. Har naam ko URDU script mein likho — TARJUMA NAHI, wahi naam Urdu harfon mein. Chhote lafz: cus / cust / customer = کسٹمر, traders = ٹریڈرز, store = سٹور, sb = صاحب, bhai = بھائی. Shehar: lalamusa = لالہ موسیٰ, kharian = کھاریاں, gujrat = گجرات, jhelum = جہلم. Bank: HBL = ایچ بی ایل, Alfalah = الفلاح. Hindse wahi rakho. Sirf JSON array do, aur kuch nahi: [{"id":"...","ur":"..."}]\n' + JSON.stringify(chunk.map(p => ({ id: String(p.id), en: String(p.name).slice(0, 80) })));
      let out; try { out = await gem(cfg.key, model, prompt, true); } catch (e) { if (e.code === 400) out = await gem(cfg.key, model, prompt, false); else throw e; }
      const m = String(out || '').match(/\[[\s\S]*\]/); if (!m) continue;
      let arr = []; try { arr = JSON.parse(m[0]); } catch { continue; }
      const patch = {}; for (const x of arr) if (x && x.id && x.ur && /[\u0600-\u06FF]/.test(x.ur) && chunk.some(p => String(p.id) === String(x.id))) patch[String(x.id)] = String(x.ur).trim().slice(0, 120);
      if (Object.keys(patch).length) { await ba.doc('urduParties').set({ map: patch, updatedAt: Date.now(), by: 'pc' }, { merge: true }); Object.assign(pmap, patch); done += Object.keys(patch).length; }
    }
    if (done) log('🔤 ' + done + ' party ke Urdu naam AI se bane (voucher parchi)');
  } catch (e) { fillWaitTill = Date.now() + 3600000; log('🔤 Party Urdu naam nahi bane: ' + e.message + ' — 1 ghante baad dobara'); }
  finally { fillBusy = false; }
  return done;
}
module.exports = { fillParties, watch, get, party, partyAny, isOn, line, has, strip, toJob, MARK, _set: (m, o = true, pm) => { map = m || {}; on = o; if (pm) pmap = pm; } };
