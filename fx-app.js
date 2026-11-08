// fx-app.js — v2.205.0 (2026-11-08): 🗑 hataye trips `fh` (gaariDay JSON ["HH:MM"]) — malik ne jo trip hataya wo macro ke dobara parhne par WAPAS NAHI aata (fxMerge skip + fk/fn bina un ke);
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
const PK = 5 * 3600000;
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
  for (const e of all) { if (e.kind === 'dt') { if (!first) first = e; continue; } if (first) { if (e.km > 0) trips.push({ day: first.day, t: first.t, km: e.km }); first = null; } else orphan++; }
  return { trips, nDt: D.length, nKm: K.length, orphan };
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
  const parts = String(body || '').split('~~'), list = [], det = [];
  for (let i = 0; i < parts.length; i++) { const q = parts[i]; if (q.trim() === 'DET') { if (parts[i + 1]) det.push(parts[i + 1]); i++; } else if (q.trim()) list.push(q); }
  return { list: list.join('~~'), det };
}
export function fxDetail(txt) {
  const S = []; const rx = /'((?:[^']|'(?=[^,}:]))*)'/g; let m; while ((m = rx.exec(txt))) S.push(m[1].trim());
  const val = i => { for (let j = i + 1; j < Math.min(S.length, i + 4); j++) { const v = S[j]; if (/[ ,]/.test(v) && /[a-z]/i.test(v) && !/^(start|end|distance|time)$/i.test(v)) return v; } return ''; };
  const lab = n => S.findIndex(q => q.toLowerCase() === n);
  const out = { t: '', km: 0, f: '', e: '' };
  const si = lab('start'), ei = lab('end'), di = lab('distance'), ti = lab('time');
  if (si >= 0) out.f = val(si); if (ei >= 0) out.e = val(ei);
  if (di >= 0) { for (let j = di + 1; j < Math.min(S.length, di + 4); j++) { const k = /(\d{1,4}(?:[.,]\d{1,3})?)\s*km/i.exec(S[j]); if (k) { out.km = Math.round(Number(k[1].replace(',', '.')) * 100) / 100; break; } } }
  if (ti >= 0) { for (let j = ti + 1; j < Math.min(S.length, ti + 4); j++) { const P = parseTimes(S[j]); if (P.length) { out.t = P[0].t; break; } } }
  if (!out.t) { const P = parseTimes(txt); out.t = P.length ? P[0].t : ''; }
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
    const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=pk&q=' + encodeURIComponent(q), { headers: { 'Accept-Language': 'en' }, signal: c.signal });
    clearTimeout(tm); if (!r.ok) return null; const J = await r.json();
    return Array.isArray(J) && J[0] ? [Number(J[0].lat), Number(J[0].lon)] : null;
  } catch { return null; }
}
export async function geocode(addr) {
  const parts = geoParts(addr); if (parts.length < 2) return null;
  const C = gLoad(), key = parts.join(', ').toLowerCase();
  if (C[key] && (C[key].p || Date.now() - (C[key].at || 0) < 7 * 86400000)) return C[key].p || null;
  for (let q = 0; q < parts.length - 1 && q < 4; q++) { const p = await nominatim(parts.slice(q).join(', ')); if (p) { C[key] = { p: [p[0], p[1], q], at: Date.now() }; gSave(); return C[key].p; } }
  C[key] = { p: null, at: Date.now() }; gSave(); return null;
}
export async function fxDetails(oldJ, dets, onStatus) {
  const m = new Map(); try { for (const x of JSON.parse(oldJ || '[]') || []) if (x && x.t) m.set(String(x.t), x); } catch {}
  for (const d of dets) { const o = m.get(d.t) || {}; m.set(d.t, { t: d.t, km: d.km || o.km || 0, f: d.f || o.f || '', e: d.e || o.e || '', p: o.p || null, q: o.q || null }); }
  let n = 0; const todo = [...m.values()].filter(x => !x.p && (x.f || x.e));
  for (const x of todo) {
    n++; onStatus?.(`📍 Pata se nuqta ${n}/${todo.length}…`);
    const a = x.f ? await geocode(x.f) : null, b = x.e ? await geocode(x.e) : null;
    if (a || b) { x.p = [a ? a[0] : null, a ? a[1] : null, b ? b[0] : null, b ? b[1] : null]; x.q = [a ? a[2] : null, b ? b[2] : null]; }
  }
  return [...m.values()].sort((a, b) => a.t.localeCompare(b.t));
}
// ---- poora kaam: gaariFx docs → gaariDay ----
let busy = null;
export function fxProcess(cloud, onStatus) {
  if (busy) return busy;
  busy = (async () => {
    const docs = (await cloud.listGaariFx()).sort((a, b) => a.at - b.at); if (!docs.length) return { n: 0 };
    const today = dayOf(Date.now()), minDay = dayOf(Date.now() - 3 * 86400000), done = [], kmOut = {}; let trips = 0, det = 0, last = null;
    for (const d of docs) {
      const body = String(d.p || '').replace(/^FX[12]\|[^|]*\|/, '');
      if (/^MENU\?/.test(body)) { last = { at: Date.now(), recv: d.at || Date.now(), n: 0, nDt: 0, nKm: 0, reads: 0, km: {}, why: 'menu nahi (☰ nahi mila)', raw: body.slice(0, 3500), src: 'app' }; done.push(d.id); continue; }
      const SP = fxSplit(body), P = fxParse(SP.list), reads = SP.list.split('~~').filter(q => q.trim()).length, dets = SP.det.map(fxDetail).filter(Boolean);
      const byDay = new Map(); let bad = 0;
      for (const t of P.trips) { if (t.day > today || t.day < minDay) { bad++; continue; } if (!byDay.has(t.day)) byDay.set(t.day, []); byDay.get(t.day).push(t); }
      for (const [day, L] of byDay) {
        onStatus?.(`🛰 ${day}: ${L.length} trip parh liye…`);
        const old = (await cloud.getGaariDay(day)) || {};
        const ft = fxMerge(old.ft, L, old.fh), fk = fxTotal(ft);
        const myDet = dets.filter(q => ft.some(z => z[0] === q.t)); let fd = null;
        if (myDet.length || old.fd) { try { fd = await fxDetails(old.fd, myDet, onStatus); } catch {} }
        const upd = { date: day, fk, fn: ft.length, ft: JSON.stringify(ft), fa: Date.now() }; if (fd) upd.fd = JSON.stringify(fd);
        await cloud.setGaariDay(day, upd); kmOut[day] = fk; trips += new Set(L.map(x => x.t)).size; det += myDet.length;
      }
      const why = P.trips.length ? (bad && !byDay.size ? 'purane din' : '') : !P.nDt && !P.nKm ? 'kuch nahi' : !P.nKm ? 'km nahi' : !P.nDt ? 'waqt nahi' : 'jori nahi';
      last = { at: Date.now(), recv: d.at || Date.now(), n: P.trips.length, nDt: P.nDt, nKm: P.nKm, reads, det: dets.length, km: kmOut, why, raw: body.slice(0, 3500), src: 'app' };
      done.push(d.id);
    }
    if (last) { try { await cloud.setGaariDay('_falcon', last, false); } catch {} }
    if (done.length) { try { await cloud.delGaariFx(done); } catch {} }
    return { n: done.length, trips, det, km: kmOut };
  })().finally(() => { busy = null; });
  return busy;
}
