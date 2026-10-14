// =====================================================================================================
//  urdu-names.js  v1.0 (2026-10-14) — 🔤 PARCHI PAR URDU NAAM (transfer note + gate pass)
//  Malik: "jitna bi gate pass or transfer notes print kar rahe hain un sb ko urdu bi sath ani chahie".
//  Naam wahi jo app mein (Stock → 🔤 Urdu naam / labels): Firestore blueAccess/urduNames {map: itemId -> Urdu} — LIVE (onSnapshot),
//  har print par Firestore nahi parhta (tez). Setting blueAccess/printConfig.urduSlip (default ON; app: 🖨 Print setting).
//  Text parchi mein Urdu line ek NISHAN ke saath: line(ur, px) -> toJob(text) us ko nt-parchi ki raster tasveer bana deta hai (daayein).
//  Jis item ka Urdu naam nahi = sirf English (pehle jaisa).
//  Istemal: transfer-sync.js (STOCK TRANSFER NOTE) · sale-post.js + nt-print.js (GATE PASS).
// =====================================================================================================
const MARK = '\u0001UR\u0001';
let map = {}, on = true, started = false;

function watch(db, businessId, log = () => {}) {
  if (started || !db) return; started = true;
  const ba = db.collection('businesses').doc(businessId).collection('blueAccess');
  try { ba.doc('urduNames').onSnapshot(s => { map = (s.exists && (s.data() || {}).map) || {}; }, e => log('Urdu naam nahi mile: ' + e.message)); } catch (e) { log('Urdu naam nahi mile: ' + e.message); }
  try { ba.doc('printConfig').onSnapshot(s => { on = !(s.exists && (s.data() || {}).urduSlip === false); }, () => {}); } catch {}
}
const get = id => (on && id != null ? String(map[String(id)] || '').replace(/[\u0001\r\n]+/g, ' ').trim() : '');
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
module.exports = { watch, get, line, has, strip, toJob, MARK, _set: (m, o = true) => { map = m || {}; on = o; } };
