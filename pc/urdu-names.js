// =====================================================================================================
//  urdu-names.js  v1.5 (2026-10-20: 📅 dateUr / dateLine — Urdu tareekh (آج / کل کا بل / N دن پرانا) · 📝 note() + fillNotes() — Tafseel / Note / Wajah AI se Urdu, 4 s hadd, yaad (urdu-notes.json); printConfig.urduNote) · v1.4 (2026-10-16: line(ur, px, a) — a=1 beech mein, voucher ka bara Urdu naam) · v1.3 (2026-10-15: partyAny + fillParties force — 💰 galla parchi) · v1.2 (2026-10-14: fillParties — Server PC khud AI (Gemini, blueAccess/aiConfig) se baqi parties ke Urdu naam, har 10 min) · v1.1 (2026-10-14: + PARTY ke Urdu naam blueAccess/urduParties — voucher parchi) · v1.0 (2026-10-14) — 🔤 PARCHI PAR URDU NAAM (transfer note + gate pass)
//  Malik: "jitna bi gate pass or transfer notes print kar rahe hain un sb ko urdu bi sath ani chahie".
//  Naam wahi jo app mein (Stock → 🔤 Urdu naam / labels): Firestore blueAccess/urduNames {map: itemId -> Urdu} — LIVE (onSnapshot),
//  har print par Firestore nahi parhta (tez). Setting blueAccess/printConfig.urduSlip (default ON; app: 🖨 Print setting).
//  Text parchi mein Urdu line ek NISHAN ke saath: line(ur, px) -> toJob(text) us ko nt-parchi ki raster tasveer bana deta hai (daayein).
//  Jis item ka Urdu naam nahi = sirf English (pehle jaisa).
//  Istemal: transfer-sync.js (STOCK TRANSFER NOTE) · sale-post.js + nt-print.js (GATE PASS).
// =====================================================================================================
const MARK = '\u0001UR\u0001';
const NOTE = '\u0001UN\u0001';   // v1.5: Tafseel ki jagah — print se pehle fillNotes() isay Urdu tasveer (ya kuch nahi) bana deta hai
let map = {}, pmap = {}, on = true, started = false, noteOn = true, aiKey = '', aiModel = '';

function watch(db, businessId, log = () => {}) {
  if (started || !db) return; started = true;
  const ba = db.collection('businesses').doc(businessId).collection('blueAccess');
  try { ba.doc('urduNames').onSnapshot(s => { map = (s.exists && (s.data() || {}).map) || {}; }, e => log('Urdu naam nahi mile: ' + e.message)); } catch (e) { log('Urdu naam nahi mile: ' + e.message); }
  try { ba.doc('urduParties').onSnapshot(s => { pmap = (s.exists && (s.data() || {}).map) || {}; }, () => {}); } catch {}   // v1.1
  try { ba.doc('printConfig').onSnapshot(s => { const d = (s.exists && s.data()) || {}; on = d.urduSlip !== false; noteOn = d.urduNote !== false; }, () => {}); } catch {}   // v1.5: urduNote
  try { ba.doc('aiConfig').onSnapshot(s => { const d = (s.exists && s.data()) || {}; aiKey = String(d.key || ''); aiModel = String(d.model || ''); }, () => {}); } catch {}   // v1.5: Tafseel Urdu ke liye
}
const get = id => (on && id != null ? String(map[String(id)] || '').replace(/[\u0001\r\n]+/g, ' ').trim() : '');
const party = id => (on && id ? String(pmap[String(id)] || '').replace(/[\u0001\r\n]+/g, ' ').trim() : '');   // v1.1
const isOn = () => on;
const partyAny = id => (id ? String(pmap[String(id)] || '').replace(/[\u0001\r\n]+/g, ' ').trim() : '');   // v1.3: galla parchi — urduSlip band ho tab bhi
const line = (ur, px = 32, a) => MARK + String(ur).replace(/[\u0001\r\n]+/g, ' ') + '\u0001' + (Number(px) || 32) + (a === 1 || a === 0 ? '\u0001' + a : '');   // v1.4: a = 1 beech mein (bara naam)
const has = t => String(t || '').includes(MARK);
const strip = t => String(t || '').split('\r\n').filter(l => !l.startsWith(MARK) && !l.startsWith(NOTE)).join('\r\n');   // tasveer na ban sake to bina Urdu (v1.5: NOTE bhi)

// ---------- v1.5 (2026-10-20): 📅 URDU TAREEKH — malik: "har parchi ke upar bara aaj / kal ka narration bhi Urdu mein" ----------
const UD = n => String(n).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
const UMON = ['جنوری', 'فروری', 'مارچ', 'اپریل', 'مئی', 'جون', 'جولائی', 'اگست', 'ستمبر', 'اکتوبر', 'نومبر', 'دسمبر'];
const toDay = v => { if (v == null || v === '') return null; const d = /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? new Date(v + 'T00:00:00') : new Date(v); return isNaN(d) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
function dateUr(date, now = new Date()) {   // -> { d: '۲۰ اکتوبر ۲۰۲۶', k: 'aaj'|'kal'|'old'|'aage', n, t: poori line }
  const d = toDay(date) || toDay(now), t0 = toDay(now), n = Math.round((t0 - d) / 864e5), ds = UD(d.getDate()) + ' ' + UMON[d.getMonth()] + ' ' + UD(d.getFullYear());
  if (n === 0) return { d: ds, k: 'aaj', n, t: 'آج — ' + ds };
  if (n === 1) return { d: ds, k: 'kal', n, t: 'کل کا بل — ' + ds };
  if (n > 1) return { d: ds, k: 'old', n, t: UD(n) + ' دن پرانا — ' + ds };
  return { d: ds, k: 'aage', n, t: 'آگے کی تاریخ — ' + ds };
}
const dateLine = (date, px = 56, now) => { if (!on) return ''; const u = dateUr(date, now); return line(u.t, u.k === 'aaj' ? px : Math.round(px * 0.86), 1); };   // khali = Urdu band · lambi line (kal / purana) thori chhoti

// ---------- v1.5: 📝 TAFSEEL / NOTE / WAJAH URDU MEIN (AI) — malik: "all prints ki narration Urdu mein bari bari" ----------
//   Parchi banate waqt note(text) sirf NISHAN rakhta hai; print se pehle `text = await fillNotes(text)`: AI (Gemini, wahi key/model jo app mein)
//   4 second hadd — na aaye to line hata do (parchi English Tafseel ke saath, kabhi na ruke). Bani Urdu urdu-notes.json mein yaad (dobara AI nahi).
//   Tarjuma NAHI — wahi lafz Urdu harfon mein (naam jaisa). Hindse / TXN / bill number waise hi.
const note = (text, px = 50) => { const t = String(text || '').replace(/[\u0001\r\n]+/g, ' ').replace(/\s+/g, ' ').trim(); return t && /[a-z]/i.test(t) ? NOTE + t.slice(0, 160) + '\u0001' + (Number(px) || 50) : ''; };
const fs = require('fs'), path = require('path'), NFILE = path.join(__dirname, 'urdu-notes.json');
let nmap = null; const nload = () => { if (nmap) return nmap; try { nmap = JSON.parse(fs.readFileSync(NFILE, 'utf8')) || {}; } catch { nmap = {}; } return nmap; };
const nkey = t => String(t).toLowerCase().replace(/\s+/g, ' ').trim();
function nsave() { try { const k = Object.keys(nmap); if (k.length > 3000) for (const x of k.slice(0, k.length - 3000)) delete nmap[x]; fs.writeFileSync(NFILE, JSON.stringify(nmap)); } catch {} }
let noteWaitTill = 0;
async function noteUr(t, ms = 4000) {
  const m = nload(), k = nkey(t); if (m[k]) return m[k];
  if (!aiKey || Date.now() < noteWaitTill) return '';
  const prompt = 'Pakistani dukaan ki parchi par yeh likhai (Roman Urdu / English / naam) URDU rasm-ul-khat mein likho — TARJUMA NAHI, wahi lafz Urdu harfon mein, ghalat spelling ko sahi lafz samjho (walal = wala). Hindse, raqam, bill / TXN number waise hi rehne do. Sirf JSON: {"ur":"..."}\n\n' + t;
  try {
    const out = await gem(aiKey, aiModel || 'gemini-2.5-flash', prompt, true, ms);
    const mm = String(out || '').match(/\{[\s\S]*\}/); let ur = ''; try { ur = String(JSON.parse(mm ? mm[0] : '{}').ur || '').trim(); } catch {}
    if (!/[\u0600-\u06FF]/.test(ur)) return '';
    ur = ur.replace(/[\u0001\r\n]+/g, ' ').slice(0, 200); m[k] = ur; nsave(); return ur;
  } catch (e) { if (!/jawab nahi/.test(String(e?.message))) noteWaitTill = Date.now() + 10 * 60000; return ''; }   // key / hadd ki ghalti = 10 min AI nahi (print tez rahe)
}
async function fillNotes(text, ms = 4000) {
  const ls = String(text || '').split('\r\n'); if (!ls.some(l => l.startsWith(NOTE))) return text;
  const out = [];
  for (const l of ls) {
    if (!l.startsWith(NOTE)) { out.push(l); continue; }
    if (!on || !noteOn) continue;
    const [t, px] = l.slice(NOTE.length).split('\u0001'), ur = await noteUr(t, ms);
    if (ur) out.push(line(ur, Number(px) || 50, 1));
  }
  return out.join('\r\n');
}
// nt-parchi Seg wali parchiyan (nt-print / sale-post): seg.img se seedha
async function noteSeg(seg, text, px = 50, ms = 4000) { if (!on || !noteOn) return; const t = String(text || '').replace(/\s+/g, ' ').trim(); if (!t || !/[a-z]/i.test(t)) return; const ur = await noteUr(t.slice(0, 160), ms); if (ur) seg.img(ur, px, true, 1); }   // tasveer na ban sake to bina Urdu

// ESC/POS text ('\r\n' lines, latin1) -> nt-parchi job { s: [...] } — aam lines jaisi thi, Urdu lines tasveer (daayein, mota)
function toJob(text, { font = 'Jameel Noori Nastaleeq,Urdu Typesetting,Segoe UI,Tahoma,Arial', dots = 512 } = {}) {
  const s = [], ls = String(text || '').split('\r\n'); let buf = '';
  const flush = () => { if (buf) { s.push({ r: Buffer.from(buf, 'latin1').toString('base64') }); buf = ''; } };
  ls.forEach((l, i) => {
    if (l.startsWith(MARK)) { const [ur, px, al] = l.slice(MARK.length).split('\u0001'); flush(); s.push({ i: ur, f: font, px: Number(px) || 32, b: true, w: dots, a: al === '1' ? 1 : al === '0' ? 0 : 2 }); }
    else if (l.startsWith(NOTE)) { /* v1.5: fillNotes na chala ho to nishan chhapo mat */ }
    else buf += l + (i < ls.length - 1 ? '\r\n' : '');
  });
  flush();
  return { s };
}
// v1.2: 🤖 PARTY KE URDU NAAM KHUD (malik: "parties ka naam bhi Urdu mein likh diya karo") — jin ka naam nahi, 80 ek dafa, Gemini tez (bina soche).
//   Key wahi jo app mein (blueAccess/aiConfig). Print ke waqt AI NAHI chalta (naam pehle se bane) — parchi slow nahi. Ghalti par 1 ghanta ruko.
const https = require('https');
function gem(key, model, prompt, noThink = true, ms = 60000) {   // v1.5: ms hadd · Gemini 3 = thinkingLevel minimal
  const tc = noThink ? (/gemini-3/i.test(String(model)) ? { thinkingLevel: 'minimal' } : { thinkingBudget: 0 }) : null;
  const body = JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0, responseMimeType: 'application/json', ...(tc ? { thinkingConfig: tc } : {}) } });
  return new Promise((res, rej) => {
    const rq = https.request({ hostname: 'generativelanguage.googleapis.com', path: '/v1beta/models/' + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(key), method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: ms }, r => {
      let d = ''; r.setEncoding('utf8'); r.on('data', c => { d += c; }); r.on('end', () => { let j = null; try { j = JSON.parse(d); } catch {} if (r.statusCode !== 200) return rej(Object.assign(new Error('AI ' + r.statusCode + ': ' + String(j?.error?.message || d).slice(0, 160)), { code: r.statusCode })); res((j?.candidates?.[0]?.content?.parts || []).filter(p => !p.thought).map(p => p.text || '').join('')); });
    });
    rq.on('timeout', () => rq.destroy(new Error('AI ' + Math.round(ms / 1000) + ' sec mein jawab nahi'))); rq.on('error', rej); rq.write(body); rq.end();
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
module.exports = { fillParties, watch, get, party, partyAny, isOn, line, has, strip, toJob, MARK, NOTE, dateUr, dateLine, UD, note, noteUr, fillNotes, noteSeg, _set: (m, o = true, pm) => { map = m || {}; on = o; if (pm) pmap = pm; }, _ai: (k, m, no = true) => { aiKey = k; aiModel = m; noteOn = no; nmap = {}; noteWaitTill = 0; } };
