// fx-app.js — v2.207.0 (2026-11-08): Detail parser theek (key ' : value) + list ke har trip se pata + km pehle / naqsha baad + Photon 4 saath.
// v2.206.0 (2026-11-08): macro v5 — FX3 · '~~LT~~<n>' (list load × 0.5 s) · 'SAATHI~~' (malik ne khud trips kholin) · trips Detail se bhi (list na ho to) —
//   fxDetail ab `day` bhi deta hai ('08-11-2026 08:10 PM'). PC gaari-gps ki copy (dormant) NAHI badli — ab sirf app parhti hai.
// v2.205.0 (2026-11-08): 🗑 hataye trips `fh` (gaariDay JSON ["HH:MM"]) — malik ne jo trip hataya wo macro ke dobara parhne par WAPAS NAHI aata (fxMerge skip + fk/fn bina un ke);
//   fxTotal(ft) = din ke km ek jagah (screen + save ek qaida). v2.202.0 (2026-11-07) 🛰 FALCON TEXT APP KHUD PARHE (PC ke baghair)
//   Malik: "shop PC 9 bje band hota hai — PC ko chhor do, app par hi shift kar do · jaldi bhi ho jayega".
//   Malik ke phone ka MacroDroid (falcon-macro.js v2) Falcon-i ka text ab `gaariFx` (rules 2.92) mein bhejta hai (gaariGps nahi).
//   Ye module (sirf malik ka phone, gaari.js se): gaariFx ke naye docs → trips (waqt + km) + har trip ka Detail (Start / End pata)
//   → pata se nuqta (OpenStreetMap Nominatim, muft, seedha phone se — 1.1 s faasla, localStorage cache) → gaariDay/<din> {fk, fn, ft, fd, fa}
//   + gaariDay/_falcon → parhe docs mita. PC (gaari-gps.js) ab Falcon ke liye zaroori nahi (us ka FX code sirf gaariGps par — dormant).
//   Qaida PC gaari-gps.js v1.2 ke fxParse / fxSplit / fxDetail / fxMerge / geoParts ki HUBAHU copy — ek badlo to doosra bhi. AI nahi.
const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const MRX = '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?';
const DT_RX = [
  new RegExp('\\b(\\d{1,2})[\\s\\-\\/.]+' + MRX + '[\\s\\-\\/.,]+(\\d{4})[\\s,T]*(?:at\\s*)?(\\d{1,2}):(\\d{2})(?::\\d{2})?\\s*([ap]\\.?\\s?m\\.?)?', 'gi'),
  new RegExp('\\b' + MRX + '\\s+(\\d{1,2}),?\\s+(\\d{4})[\\s,T]*(?:at\\s*)?(\\d{1,2}):(\\d{2})(?::\\d{2})?\\s*([ap]\\.?\\s?m\\.?)?', 'gi'),
  /\b(\d{4})-(\d{1,2})-(\d{1,2})[\sT]+(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap]\.?\s?m\.?)?/gi,
  /\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})[\s,]+(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap]\.?\s?m\.?)?/gi
];
const KM_LBL = /distance[\s\S]{0,90}?(?<![\w.])(\d{1,4}(?:[.,]\d{1,3})?)\s*(?:km|kms|kilomet)(?![a-z]*\s*\/\s*h|ph|\/hr)/gi;
const KM_ANY = /(?<![\w.])(\d{1,4}(?:[.,]\d{1,3})?)\s*(?:km|kms)\b(?!\s*\/\s*h|ph|\/hr)/gi;
const PK = 5 * 3600000; const N0 = v => Number(v) || 0;
export const dayOf = ms => new Date(ms + PK).toISOString().slice(0, 10);
function parseTimes(s) {
  const ev = [], hh = (h, ap) => { h = Number(h); if (ap) { const p = /^p/i.test(ap); h = h % 12 + (p ? 12 : 0); } return h; };
  DT_RX.forEach((rx, k) => { rx.lastIndex = 0; let m; while ((m = rx.exec(s))) {
    let y, mo, d, h, mi, ap;
    if (k === 0) { d = +m[1]; mo = MON[m[2].slice(0, 3).toLowerCase()]; y = +m[3]; h = m[4]; mi = +m[5]; ap = m[6]; }
    else if (k === 1) { mo = MON[m[1].slice(0, 3).toLowerCase()]; d = +m[2]; y = +m[3]; h = m[4]; mi = +m[5]; ap = m[6]; }
    else if (k === 2) { y = +m[1]; mo = +m[2]; d = +m[3]; h = m[4]; mi = +m[5]; ap = m[6]; }
    else { d = +m[1]; mo = +m[2]; y = +m[3]; h = m[4]; mi = +m[5]; ap = m[6]; }
    const H = hh(h, ap); if (!mo || mo > 12 || d < 1 || d > 31 || y < 2024 || y > 2100 || H > 23 || mi > 59) continue;
    ev.push({ i: m.index, end: m.index + m[0].length, day: `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`, t: `${String(H).padStart(2, '0')}:${String(mi).padStart(2, '0')}` });
  } });
  return ev.sort((a, b) => a.i - b.i).filter((x, i, A) => !i || x.i >= A[i - 1].end);
}
export function fxParse(txt) {
  const s = String(txt || ''), D = parseTimes(s);
  const kmEv = rx => { const out = []; rx.lastIndex = 0; let m; while ((m = rx.exec(s))) { const v = Number(String(m[1]).replace(',', '.')); if (v >= 0 && v < 800) out.push({ i: m.index + m[0].lastIndexOf(m[1]), kind: 'km', km: Math.round(v * 100) / 100 }); } return out; };
  let K = kmEv(KM_LBL); if (!K.length) K = kmEv(KM_ANY);
  const all = [...D.map(x => ({ ...x, kind: 'dt' })), ...K].sort((a, b) => a.i - b.i), trips = [];
  let first = null, orphan = 0;
  for (const e of all) { if (e.kind === 'dt') { if (!first) first = e; continue; } if (first) { if (e.km > 0) trips.push({ day: first.day, t: first.t, km: e.km, ...listAddr(s.slice(first.end, e.i)) }); first = null; } else orphan++; }
  return { trips, nDt: D.length, nKm: K.length, orphan };
}
// v2.207.0: Today's Trips list ki har line mein Start + End pata pehle se: "08 Nov 2026 02:19 PM 0.61 Km away From, Dr. …, Pakistan 0.08 Km away From, Purana …, Pakistan Total Distance: 19.15 Km"
//   → trip khole baghair naqsha (malik: "har dafa har trip kholna nahi"). Pata nahi = khali (kuch nahi bigarta).
function listAddr(seg) {
  const P = String(seg || '').split(/\d{1,4}(?:[.,]\d{1,3})?\s*km\s+away\s+from\s*,?\s*/i).slice(1)
    .map(q => q.replace(/total\s*dist[\s\S]*$/i, '').replace(/['"{}]|\s*,\s*'?\$?\d*'?\s*:.*$/g, '').replace(/[\s,]+$/, '').trim()).filter(q => /[a-z]{3}/i.test(q) && q.includes(','));
  return P.length ? { f: P[0] || '', e: P[1] || '' } : {};
}
export function fxHidden(fhJ) { try { const a = JSON.parse(fhJ || '[]'); return Array.isArray(a) ? a.filter(x => Array.isArray(x) && x[0]).map(x => [String(x[0]), Number(x[1]) || 0]) : []; } catch { return []; } }   // [["HH:MM", km]] — ↩ wapas ke liye km bhi
export function fxMerge(oldJ, add, fhJ) {
  const H = new Set(fxHidden(fhJ).map(x => x[0]));   // v2.205.0: 🗑 malik ke hataye trips — dobara parhne par bhi nahi
  const m = new Map(); try { for (const [t, km] of JSON.parse(oldJ || '[]') || []) if (t && !H.has(String(t))) m.set(String(t), Number(km) || 0); } catch {}
  for (const x of add) if (!H.has(String(x.t))) m.set(x.t, x.km);
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}
export const fxTotal = ft => Math.round((ft || []).reduce((s, q) => s + (Number(q[1]) || 0), 0) * 100) / 100;
export function fxSplit(body) {
  const parts = String(body || '').split('~~'), list = [], det = []; let lt = 0, saathi = false;
  for (let i = 0; i < parts.length; i++) { const q = parts[i], k = q.trim();
    if (k === 'DET') { if (parts[i + 1]) det.push(parts[i + 1]); i++; }
    else if (k === 'LT') { lt = Math.max(lt, Number(String(parts[i + 1] || '').trim()) || 0); i++; }   // v2.206.0: list load (0.5 s ke qadam)
    else if (k === 'SAATHI') saathi = true;
    else if (/'\s*trip\s*detail\s*'/i.test(k)) det.push(q);   // v2.207.0: bina ~~DET~~ wali Trip Detail (saathi ki pehli) list mein ghus kar waqt / km ghalat jorti thi
    else if (k) list.push(q); }
  return { list: list.join('~~'), det, lt, saathi };
}
export function fxDetail(txt) {
  // v2.207.0: MacroDroid ka text {'' :'Trip Detail','$2' :'Start','$3' :'0.08 Km away From, …'} — key ke baad ' :' (space) hai; purana regex
  //   key + value ek bana deta tha ("$2' :'Start") → 'start' kabhi nahi milta tha = 0 detail, naqsha nahi. Ab sirf VALUES (Today's jaisa ' andar theek).
  const S = []; const rx = /'([^']*)'\s*:\s*'((?:[^']|'(?!\s*(?:,\s*'|\})))*)'/g; let m; while ((m = rx.exec(txt))) S.push(m[2].trim());
  if (!S.length) { const r2 = /'((?:[^']|'(?=[^,}:]))*)'/g; while ((m = r2.exec(txt))) S.push(m[1].trim()); }
  const val = i => { for (let j = i + 1; j < Math.min(S.length, i + 4); j++) { const v = S[j]; if (/[ ,]/.test(v) && /[a-z]/i.test(v) && !/^(start|end|distance|time)$/i.test(v)) return v; } return ''; };
  const lab = n => S.findIndex(q => q.toLowerCase() === n);
  const out = { t: '', km: 0, f: '', e: '' };
  const si = lab('start'), ei = lab('end'), di = lab('distance'), ti = lab('time');
  if (si >= 0) out.f = val(si); if (ei >= 0) out.e = val(ei);
  if (di >= 0) { for (let j = di + 1; j < Math.min(S.length, di + 4); j++) { const k = /(\d{1,4}(?:[.,]\d{1,3})?)\s*km/i.exec(S[j]); if (k) { out.km = Math.round(Number(k[1].replace(',', '.')) * 100) / 100; break; } } }
  if (ti >= 0) { for (let j = ti + 1; j < Math.min(S.length, ti + 4); j++) { const P = parseTimes(S[j]); if (P.length) { out.t = P[0].t; out.day = P[0].day; if (P[1]) out.te = P[1].t; break; } } }   // v2.209.0: te = khatam waqt
  if (!out.t) { const P = parseTimes(txt); out.t = P.length ? P[0].t : ''; out.day = P.length ? P[0].day : ''; }
  return out.t && (out.f || out.e) ? out : null;
}
export const geoParts = addr => String(addr || '').replace(/^[\d.,]+\s*km\s*away\s*from\s*,?\s*/i, '').trim().split(',').map(q => q.trim()).filter(Boolean);
// ---- pata → nuqta (Nominatim, seedha phone se; cache localStorage sam-fx-geo) ----
const GK = 'sam-fx-geo'; let G = null; let geoLast = 0;
function gLoad() { if (G) return G; try { G = JSON.parse(localStorage.getItem(GK) || '{}') || {}; } catch { G = {}; } return G; }
function gSave() { try { const ks = Object.keys(G); if (ks.length > 600) ks.slice(0, ks.length - 500).forEach(k => delete G[k]); localStorage.setItem(GK, JSON.stringify(G)); } catch {} }
async function nominatim(q) {
  const wait = Math.max(0, geoLast + 1100 - Date.now()); if (wait) await new Promise(r => setTimeout(r, wait)); geoLast = Date.now();
  try {
    const c = new AbortController(); const tm = setTimeout(() => c.abort(), 12000);
    const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=pk&viewbox=73.3,33.4,74.9,31.9&q=' + encodeURIComponent(q), { headers: { 'Accept-Language': 'en' }, signal: c.signal });
    clearTimeout(tm); if (!r.ok) return null; const J = await r.json();
    return Array.isArray(J) && J[0] ? [Number(J[0].lat), Number(J[0].lon)] : null;
  } catch { return null; }
}
// v2.207.0 (malik: "naqsha tezi se"): pehle Photon (OpenStreetMap, muft, saath saath 4) — na mile to Nominatim (1 s faasla). Sirf Pakistan ke andar.
const inPk = (a, o) => a > 23 && a < 37.5 && o > 60 && o < 78;
async function photon(q) {
  try {
    const c = new AbortController(); const tm = setTimeout(() => c.abort(), 8000);
    const r = await fetch('https://photon.komoot.io/api/?limit=1&lat=32.57&lon=74.08&q=' + encodeURIComponent(q), { signal: c.signal });
    clearTimeout(tm); if (!r.ok) return null; const J = await r.json(); const g = J?.features?.[0]?.geometry?.coordinates;
    return g && inPk(+g[1], +g[0]) ? [+g[1], +g[0]] : null;
  } catch { return null; }
}
export async function geocode(addr) {
  const parts = geoParts(addr); if (parts.length < 2) return null;
  const C = gLoad(), key = parts.join(', ').toLowerCase();
  if (C[key] && (C[key].p || Date.now() - (C[key].at || 0) < 3600000)) return C[key].p || null;   // v2.208.0: na mila = sirf 1 ghanta yaad (pehle 7 din — net ki ek ghalti hafta bhar naqsha rok deti)
  for (let q = 0; q < parts.length - 1 && q < 3; q++) { const p = await photon(parts.slice(q).join(', ')); if (p) { C[key] = { p: [p[0], p[1], q], at: Date.now() }; gSave(); return C[key].p; } }
  for (let q = 0; q < parts.length - 1 && q < 4; q++) { const p = await nominatim(parts.slice(q).join(', ')); if (p) { C[key] = { p: [p[0], p[1], q], at: Date.now() }; gSave(); return C[key].p; } }
  C[key] = { p: null, at: Date.now() }; gSave(); return null;
}
const nz = a => geoParts(a).join(',').toLowerCase(), chg = (d, o) => (d.f && nz(d.f) !== nz(o.f)) || (d.e && nz(d.e) !== nz(o.e));   // v2.209.0: pata badla = nuqta dobara
export async function fxDetails(oldJ, dets, onStatus) {
  const m = new Map(); try { for (const x of JSON.parse(oldJ || '[]') || []) if (x && x.t) m.set(String(x.t), x); } catch {}
  for (const d of dets) { const o = m.get(d.t) || {}; m.set(d.t, { t: d.t, km: d.km || o.km || 0, f: d.f || o.f || '', e: d.e || o.e || '', ...((d.te || o.te) ? { te: d.te || o.te } : {}), p: chg(d, o) ? null : (o.p || null), q: chg(d, o) ? null : (o.q || null) }); }
  const todo = [...m.values()].filter(x => !x.p && (x.f || x.e)); const U = [...new Set(todo.flatMap(x => [x.f, x.e]).filter(Boolean))], R = new Map(); let n = 0, i = 0;
  const work = async () => { while (i < U.length) { const a = U[i++]; R.set(a, await geocode(a)); n++; onStatus?.(`📍 Naqsha ${n}/${U.length}…`); } };
  await Promise.all([work(), work(), work(), work()]);
  for (const x of todo) { const a = x.f ? R.get(x.f) : null, b = x.e ? R.get(x.e) : null;
    if (a || b) { x.p = [a ? a[0] : null, a ? a[1] : null, b ? b[0] : null, b ? b[1] : null]; x.q = [a ? a[2] : null, b ? b[2] : null]; } }
  return [...m.values()].sort((a, b) => a.t.localeCompare(b.t));
}
// ---- poora kaam: gaariFx docs → gaariDay ----
let busy = null;
export function fxProcess(cloud, onStatus) {
  if (busy) return busy;
  busy = (async () => {
    const docs = (await cloud.listGaariFx()).sort((a, b) => a.at - b.at); if (!docs.length) return { n: 0 };
    const today = dayOf(Date.now()), minDay = dayOf(Date.now() - 40 * 86400000)   /* v2.208.0: Falcon mein 5 / 6 tareekh (Past Trips) kholo = usi din mein */, done = [], kmOut = {}; let trips = 0, det = 0, last = null, hid = 0;
    for (const d of docs) {
      const body = String(d.p || '').replace(/^FX\d\|[^|]*\|/, '');
      if (/^MENU\?/.test(body)) { if (last && N0(last.n)) { done.push(d.id); continue; } last = { at: Date.now(), recv: d.at || Date.now(), n: 0, nDt: 0, nKm: 0, reads: 0, km: {}, why: 'menu nahi (☰ nahi mila)', raw: body.slice(0, 3500), src: 'app' }; done.push(d.id); continue; }
      const SP = fxSplit(body), P = fxParse(SP.list), reads = SP.list.split('~~').filter(q => q.trim()).length, dets = SP.det.map(fxDetail).filter(Boolean);
      for (const x of P.trips) if ((x.f || x.e) && !dets.some(q => q.t === x.t && (q.day || x.day) === x.day)) dets.push({ t: x.t, day: x.day, km: x.km, f: x.f || '', e: x.e || '' });   // v2.207.0: list ke pate
      { const have = new Set(P.trips.map(t => t.day + ' ' + t.t)); for (const x of dets) if (x.day && x.km > 0 && !have.has(x.day + ' ' + x.t)) { P.trips.push({ day: x.day, t: x.t, km: x.km }); have.add(x.day + ' ' + x.t); } }   // v2.206.0: 👆 saathi — list na parhi ho to Detail se
      const byDay = new Map(); let bad = 0;
      for (const t of P.trips) { if (t.day > today || t.day < minDay) { bad++; continue; } if (!byDay.has(t.day)) byDay.set(t.day, []); byDay.get(t.day).push(t); }
      for (const [day, L] of byDay) {
        onStatus?.(`🛰 ${day}: ${L.length} trip parh liye…`);
        const old = (await cloud.getGaariDay(day)) || {};
        const ft = fxMerge(old.ft, L, old.fh), fk = fxTotal(ft); { const H = new Set(fxHidden(old.fh).map(x => x[0])); hid += new Set(L.filter(x => H.has(x.t)).map(x => x.t)).size; }   // v2.207.1: 🗑 wale gino — malik ko batao
        const myDet = dets.filter(q => (!q.day || q.day === day) && ft.some(z => z[0] === q.t));
        const upd = { date: day, fk, fn: ft.length, ft: JSON.stringify(ft), fa: Date.now() };
        await cloud.setGaariDay(day, upd); kmOut[day] = fk; trips += new Set(L.map(x => x.t)).size; det += myDet.length;   // v2.207.0: km + trips PEHLE (foran screen par)
        if (myDet.length) { try { const fd = await fxDetails(old.fd, myDet, onStatus); await cloud.setGaariDay(day, { date: day, fd: JSON.stringify(fd) }); } catch {} }   // naqsha baad mein
      }
      const why = P.trips.length ? (bad && !byDay.size ? 'purane din' : '') : !P.nDt && !P.nKm ? 'kuch nahi' : !P.nKm ? 'km nahi' : !P.nDt ? 'waqt nahi' : 'jori nahi';
      last = { at: Date.now(), recv: d.at || Date.now(), n: P.trips.length, nDt: P.nDt, nKm: P.nKm, reads, det: dets.length, km: kmOut, why, raw: body.slice(0, 3500), src: SP.saathi ? 'saathi' : 'app', lt: SP.lt || 0, hid };
      done.push(d.id);
    }
    if (last) { try { await cloud.setGaariDay('_falcon', last, false); } catch {} }
    if (done.length) { try { await cloud.delGaariFx(done); } catch {} }
    return { n: done.length, trips, det, km: kmOut, hid };
  })().finally(() => { busy = null; });
  return busy;
}

// ---- v2.209.0 (2026-11-08): 🖼 GALLERY SE SCREENSHOTS (malik: "gallery se direct ek hi dafa photos upload") ----
//   Falcon-i ke screenshot (Trips list / Past Trips / Trip Detail) → 🤖 AI (Gemini) SIRF parhta hai → wahi fxMerge (🗑 wapas nahi) + fxDetails (nuqta, AI nahi).
const shotPrompt = today => 'These are screenshots from the Falcon-i (TPL vehicle tracker) app: the Trips list (each trip has a heading date-time like "08 Nov 2026 08:18 AM", ' +
  'a Start address, an End address and "Total Distance: N Km") and/or "Trip Detail" pages (Start, End, Distance, Time "dd-mm-yyyy hh:mm AM to dd-mm-yyyy hh:mm PM"). ' +
  'List every trip EXACTLY ONCE (same trip in several screenshots = one). For each: "day" = YYYY-MM-DD, "t" = START time 24h "HH:MM", "te" = END time 24h if visible else "", ' +
  '"km" = total distance number (null if cut off), "f" = Start address exactly as written, "e" = End address exactly as written ("" if not visible). Today is ' + today + '. ' +
  'Reply ONLY JSON: {"trips":[{"day":"2026-11-08","t":"08:18","te":"","km":12.34,"f":"","e":""}]}';
const hm24 = v => { const m = /(\d{1,2})\s*[:.]\s*(\d{2})\s*([ap])?/i.exec(String(v || '')); if (!m) return ''; let h = +m[1]; const mi = +m[2]; if (m[3]) h = h % 12 + (/p/i.test(m[3]) ? 12 : 0); return h > 23 || mi > 59 ? '' : `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`; };
export async function fxFromShots(cloud, files, { ai, shrink, onStatus } = {}) {
  if (!ai || !shrink) throw Error('AI tayyar nahi — Settings mein AI key dekhein');
  files = (files || []).filter(f => f && /^image\//.test(f.type || '')).slice(0, 20); if (!files.length) throw Error('Koi tasveer nahi mili');
  const today = dayOf(Date.now()), minDay = dayOf(Date.now() - 40 * 86400000), T = new Map(); let bad = 0;
  for (let i = 0; i < files.length; i += 4) {
    const part = files.slice(i, i + 4); onStatus?.(`🤖 Screenshot ${i + 1}${part.length > 1 ? '–' + (i + part.length) : ''} / ${files.length} parh raha hoon…`);
    const imgs = []; for (const f of part) imgs.push(await shrink(f, 1600, 0.85));
    let j = null; try { const txt = await ai(imgs, shotPrompt(today)); const m = String(txt || '').match(/\{[\s\S]*\}/); j = m ? JSON.parse(m[0]) : null; } catch (e) { if (i === 0 && files.length <= 4) throw e; }
    for (const x of Array.isArray(j?.trips) ? j.trips : []) {
      const t = hm24(x?.t); let day = /^\d{4}-\d{2}-\d{2}$/.test(String(x?.day || '')) ? x.day : today; if (!t) continue; if (day > today || day < minDay) { bad++; continue; }
      const km = x.km == null || x.km === '' ? 0 : Math.round(Number(String(x.km).replace(',', '.')) * 100) / 100, k = day + ' ' + t, o = T.get(k) || { day, t, km: 0, f: '', e: '', te: '' };
      if (km > 0 && km < 800) o.km = km; if (x.f && !o.f) o.f = String(x.f).slice(0, 200).trim(); if (x.e && !o.e) o.e = String(x.e).slice(0, 200).trim(); if (!o.te) o.te = hm24(x.te); T.set(k, o);
    }
  }
  const byDay = new Map(); for (const x of T.values()) { if (!byDay.has(x.day)) byDay.set(x.day, []); byDay.get(x.day).push(x); }
  const out = { trips: 0, cut: 0, km: {}, days: {}, bad };
  for (const [day, L] of byDay) {
    const old = (await cloud.getGaariDay(day)) || {}; const withKm = L.filter(x => x.km > 0); out.cut += L.length - withKm.length;
    const ft = fxMerge(old.ft, withKm, old.fh); if (!ft.length) continue;
    const upd = { date: day, fk: fxTotal(ft), fn: ft.length, ft: JSON.stringify(ft), fa: Date.now() };
    await cloud.setGaariDay(day, upd); out.km[day] = upd.fk; out.days[day] = upd; out.trips += withKm.length;
    const myDet = L.filter(x => (x.f || x.e) && ft.some(z => z[0] === x.t)).map(x => ({ t: x.t, km: x.km || (ft.find(z => z[0] === x.t) || [])[1] || 0, f: x.f, e: x.e, te: x.te || '' }));
    if (myDet.length) { onStatus?.(`📍 ${day}: naqsha bana raha hoon…`); try { const fd = await fxDetails(old.fd, myDet, onStatus); upd.fd = JSON.stringify(fd); await cloud.setGaariDay(day, { date: day, fd: upd.fd }); } catch {} }
  }
  try { await cloud.setGaariDay('_falcon', { at: Date.now(), recv: Date.now(), n: out.trips, km: out.km, why: out.trips ? '' : 'screenshot mein trips nahi', src: 'shot', reads: files.length }, false); } catch {}
  return out;
}
