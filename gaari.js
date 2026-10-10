// gaari.js — 🚚 GAARI KA HISAAB v3 (v2.94, 2026-10-06) — sab kuch "PHERA" ke gird
// v2.98.1 (2026-10-08): ⛽ km ka WAQT — phere ke km jab save hon (kmLog [{at, km}]) usi waqt tanki se diesel katta (edit se kam/zyada);
//   phere ke andar ki diesel (tanki full) phere ke SHURU mein (us phere ke km nayi tanki se); purane din ka edit usi din mein (clamp).
//   💾 Phera page: Save button — khana khud save nahi; bina save band = poochta; naya phera Save par hi banta.
// v2.97.1 (2026-10-07): 🧾 EXTRA KHARCHA — phere se bahar (tyre, repair, token…) kind 'kharch' {extra:true, cat, amount, note, driver}.
//   Yaad wale sab kharchon ke chips (aakhri raqam bhi). Mahine ka NAFA = bachat − fixed − tanki farq − EXTRA − qist; agle mahine 0 se.
//   Mobil change (oil:true) bhi ab extra mein (phera-wise kharchon mein nahi). driver:true = driver ki jeb se → driver ke khate mein − (lena kam).
// v2.96.1 (2026-10-07): 📒 DRIVER KA KHATA — har phera + (kiraya − kharche − commission), "💵 Driver se liya" − (adhoora bhi), "Driver ko diye"
//   advance + (salary = khate se bahar); baqaya khud agle phere ke saath. Purane tick / "le liya" = liya. kind 'driver' {dir:'in'|'out', sal}.
// v2.96.0 (2026-10-07): ⛽ FARZI DIESEL + TANKI KHATA — phere ka nafa = kiraya − kharche − commission − farzi diesel (km ÷ average × rate);
//   asal diesel phere mein plus/minus NAHI, tanki khata mein: tanki full se full ka cycle (farzi vs asal, farq, asal average, "✓ farq mark" =
//   wohi average app mein). Dashboard: fuel dial + tanki (cfg.tankL 76 L) + meter. Mahina: safi nafa − fixed kharche (cfg.fixed) − qist (cfg.qist)
//   − tanki farq = NAFA / GHATA. 🛢 Mobil har cfg.oilKm (5000) km. ✅ Driver se le liya (phera settled: bilty col + commission driver ne rakh li).
//   Naye docs purani kinds mein: tanki = kind 'diesel' {litre, rate, amount, full, odo, at}, mobil = kind 'kharch' {oil:true} — rules wahi.
// v2.95.8 (2026-10-07): 📸 Falcon ki KAI screenshots ek saath — AI har trip (waqt + km) alag, dohra trip ek dafa, trackerTrips[{t,km,cut}]
//   jor = trackerKm; baad ki screenshot purane trips mein jurti. Meter reading na ho to hisaab (diesel banta, average, mahine km) Falcon km se.
// Ek PHERA = ek page: biltiyan (kiraya, kahan se->tak, ☐ driver se le liya), kharche (chips + search), meter (shuru = pichhle
// phere ki aakhri, aakhri + 📷 AI), Falcon tracker km (📸 AI) — dono ka milan, diesel (litre × rate, ☐ tanki full) aur
// "km ÷ average = itna lagna chahiye tha" vs asal, phere ka nafa. Har khana khud save (intezar nahi — Firestore peeche).
// Main screen: mahine ka hero, calendar (har din kitne pheray), chips (💰 driver se lena, ⛽ average, 🧾 kharche phera-wise…),
// phera cards. Purani alag entries (bilty/diesel/kharch/reading/tracker/driver — v2.92) bhi jor mein rehti hain.
// Data: businesses/noor-traders/gaari/{id} kind 'phera' {date, startR, endR, trackerKm, bilties[{id,from,to,party,kiraya,comm,col}],
//   kharche[{n,a}], diesel[{l,rate,amount,full}], status open|closed, note, by, byName, at, trackerTrips[{t,km,cut}] (v2.95.8)} + gaari/_config.
import { smartHit } from './smart-search.js?v=2.99.21';   // v2.98: 🔎 spelling-maafi list search
const $ = id => document.getElementById(id);
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v, d = 0) => Number(v || 0).toLocaleString('en-PK', { maximumFractionDigits: d });
const rs = v => 'Rs ' + num(Math.round(Number(v) || 0));
const r2 = v => Math.round((Number(v) || 0) * 100) / 100;
const N = v => Number(v) || 0;
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WD = ['Pir', 'Mng', 'Bud', 'Jum', 'Jma', 'Hft', 'Itw'];
const KHARCH = ['Toll / parchi', 'Khana', 'Police / challan', 'Repair', 'Tyre', 'Oil / filter', 'Parking', 'Mazdoori', 'Doosra'];
const uid6 = () => Math.random().toString(36).slice(2, 8);

let cloud = null, notice = () => {}, isOwner = () => false, byName = () => '', uidOf = () => '', modal = null, closeModal = () => {}, ai = null, pdf = null, shrink = null;
let un = null, rows = [], cfg = { avg: 5.5, commType: 'pct', commVal: 10, driver: '', no: 'GJL640630' }, month = today().slice(0, 7), day = '', mounted = false, err = '';
let cur = null, curTimer = null, curDirty = false, curNew = false;   // khula phera page (local copy) · v2.98.1: Save button (dirty / naya)

export function gaariSetup(o) {
  cloud = o.cloud; notice = o.notice || notice; isOwner = o.owner || isOwner; byName = o.byName || byName; uidOf = o.uid || uidOf;
  modal = o.modal; closeModal = o.close || closeModal; ai = o.ai || null; pdf = o.pdf || null; shrink = o.shrink || null;
}
export function gaariStop() { if (!mounted) return; mounted = false; try { un?.(); } catch {} un = null; }
function start() {
  if (un || !cloud?.listenGaari) return;
  un = cloud.listenGaari(list => {
    err = '';
    const c = list.find(r => r.id === '_config'); if (c) cfg = { ...cfg, ...c };
    rows = list.filter(r => r.id !== '_config' && !r.deleted);
    if (mounted && !cur) paint();
  }, e => { err = e?.message || 'rabta nahi'; if (mounted) paint(); });
}
export function renderGaari() {
  mounted = true;
  if ($('list')) $('list').innerHTML = '';
  if ($('actions')) $('actions').innerHTML = '';
  if ($('tabs')) $('tabs').hidden = true;
  start(); paint();
}

// ---------- hisaab ----------
const commOf = b => b.comm != null && b.comm !== '' ? N(b.comm) : !(N(b.kiraya) > 0) ? 0 : (cfg.commType === 'fixed' ? N(cfg.commVal) : r2(N(b.kiraya) * N(cfg.commVal) / 100));   // v2.96.1: khali bilty (kiraya 0) par commission nahi
const avgOf = () => N(cfg.avg) || 5.5;
// ---------- v2.96: tanki / diesel ----------
const tankCap = () => N(cfg.tankL) || 76;
const oilEvery = () => N(cfg.oilKm) || 5000;
const pKey = r => `${r.date || ''}|${String(Math.round(N(r.at))).padStart(15, '0')}`;
const keyAt = k => Number(String(k).split('|')[1]) || 0;
// v2.98.1: phere ke waqt ko us ke din ke andar rakho (purane din ka edit aaj ki tanki mein na aaye)
const dayEdge = d => { const [y, m, dd] = String(d || '').split('-').map(Number); if (!y) return null; return { s: new Date(y, m - 1, dd).getTime(), e: new Date(y, m - 1, dd, 23, 59, 59, 999).getTime() }; };
const evKey = (date, at, tail = '') => { const b = dayEdge(date), t = b ? Math.min(b.e, Math.max(b.s, N(at) || b.s)) : N(at); return `${date || ''}|${String(Math.round(t)).padStart(15, '0')}${tail}`; };
function kmEvents(p, c = pc(p)) {   // phere ke km — kab kitne save hue (purane phere: aakhri save par poore)
  const km = N(c.km), L = Array.isArray(p.kmLog) ? p.kmLog.filter(x => x && N(x.at)) : [], ev = []; let prev = 0;
  for (const x of L) { const d = N(x.km) - prev; if (Math.abs(d) > 1e-6) ev.push({ key: evKey(p.date, x.at, '|k'), km: d }); prev = N(x.km); }
  if (Math.abs(km - prev) > 1e-6) ev.push({ key: evKey(p.date, N(p.updatedAt) || N(p.at), '|k'), km: km - prev });
  return ev;
}
function withKmLog(next, prev) {   // Save par: km badle to {at, km} jor (purane phere ka pehla nishan bhi)
  const now = Date.now(), kmNew = r2(pc(next).km); let L = Array.isArray(next.kmLog) ? next.kmLog.filter(x => x && N(x.at)).slice() : [];
  if (!L.length && prev) { const k0 = r2(pc(prev).km); if (k0) L.push({ at: now, km: k0 }); }
  const last = L.length ? N(L[L.length - 1].km) : 0;
  if (Math.abs(kmNew - last) > 0.001) L.push({ at: now, km: kmNew });
  next.kmLog = L.slice(-40);
}
const dmy = d => { d = String(d || ''); return d.slice(8, 10) + ' ' + (MONTHS[Number(d.slice(5, 7)) - 1] || ''); };
function fills() {   // har diesel dalwana: phere ki diesel lines + alag 'diesel' docs (tanki full / thora)
  const F = [];
  for (const p of pheras()) (p.diesel || []).forEach((d, i) => { if (N(d.l) || N(d.amount)) F.push({ key: evKey(p.date, p.at, '|a' + String(i).padStart(3, '0')) /* v2.98.1: phere ke SHURU mein */, date: p.date, l: N(d.l), rate: N(d.rate) || (N(d.l) ? r2(N(d.amount) / N(d.l)) : 0), rs: N(d.amount), full: !!d.full, src: 'phera', pid: p.id, i, marked: d.marked, mAvg: N(d.mAvg) }); });
  for (const r of rows) if (r.kind === 'diesel' && (N(r.litre) || N(r.amount))) F.push({ key: pKey(r), date: r.date, l: N(r.litre), rate: N(r.rate) || (N(r.litre) ? r2(N(r.amount) / N(r.litre)) : 0), rs: N(r.amount), full: !!r.full, src: 'doc', id: r.id, odo: N(r.odo), marked: r.marked, mAvg: N(r.mAvg), note: r.note || '' });
  return F.sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
}
// rate / average US WAQT ke (phere ke waqt) — baad mein badlein to purane phere aur tanki milan na badle
function rateFor(key) {   // aakhri parchi ka rate us waqt se pehle — ya setting ka (agar us ke baad aur phere se pehle badla)
  const kAt = key ? keyAt(key) : Infinity; let last = null;
  for (const f of fills()) { if (key && f.key >= key) break; if (f.rate > 0) last = f; }
  const ra = N(cfg.rateAt);
  if (N(cfg.dieselRate) && ra <= kAt && (!last || ra >= keyAt(last.key))) return N(cfg.dieselRate);
  return last ? last.rate : (N(cfg.dieselRate) || lastRate());
}
const curRate = () => rateFor(null);
function avgFor(key) {   // cfg.avgHist [{at, avg}] — "farq mark" / setting se badli average sirf us ke BAAD ke pheron par
  const H = Array.isArray(cfg.avgHist) ? cfg.avgHist : [], kAt = key ? keyAt(key) : Infinity; let a = 0;
  for (const h of H) if (N(h.at) <= kAt && N(h.avg) > 0) a = N(h.avg);
  return a || avgOf();
}
const avgHistWith = (at, avg) => { const H = (Array.isArray(cfg.avgHist) && cfg.avgHist.length ? cfg.avgHist : [{ at: 0, avg: avgOf() }]).filter(h => N(h.at) !== at); H.push({ at, avg }); return H.sort((a, b) => N(a.at) - N(b.at)).slice(-60); };
function tankCycles() {   // tanki full se tanki full — v2.98.1: har phere ke km apne save-waqt (kmEvents) se cycle mein
  const F = fills(), P = pheras().map(p => { const c = pc(p); return { p, key: pKey(p), c, ev: kmEvents(p, c), lpk: c.km ? c.shouldL / c.km : 0, rpk: c.km ? c.shouldRs / c.km : 0 }; });
  const fi = []; F.forEach((f, i) => { if (f.full) fi.push(i); });
  const sum = (L, f) => L.reduce((t, x) => t + f(x), 0), cyc = [];
  const part = (a, b) => P.map(x => { const km = x.ev.filter(e => (a == null || e.key > a) && (b == null || e.key < b)).reduce((t, e) => t + e.km, 0); return Math.abs(km) > 1e-6 ? { ...x, km, L: km * x.lpk, Rs: km * x.rpk } : null; }).filter(Boolean);
  for (let k = 0; k < fi.length; k++) {
    const s0 = F[fi[k]], e = k + 1 < fi.length ? F[fi[k + 1]] : null;
    const inP = part(s0.key, e ? e.key : null);
    const tops = F.filter((f, i) => !f.full && i > fi[k] && (!e || i < fi[k + 1]));
    const o = { start: s0, end: e, pheras: inP, km: sum(inP, x => x.km), farziL: sum(inP, x => x.L), farziRs: sum(inP, x => x.Rs), topL: sum(tops, f => f.l), topRs: sum(tops, f => f.rs) };
    if (e) { o.actL = o.topL + e.l; o.actRs = o.topRs + e.rs; o.farqL = o.actL - o.farziL; o.farq = o.actRs - o.farziRs; o.avg = o.actL ? o.km / o.actL : 0; }
    cyc.push(o);
  }
  const first = fi.length ? F[fi[0]] : null;
  return { F, cyc, first, before: first ? part(null, first.key) : P, open: cyc.length && !cyc[cyc.length - 1].end ? cyc[cyc.length - 1] : null };
}
function tankNow(T = tankCycles()) {
  const o = T.open; if (!o) return null;
  const cap = tankCap(), used = Math.max(0, o.farziL - o.topL), left = Math.max(0, Math.min(cap, cap - used));   // thora diesel full tanki ko cap se upar nahi le jata
  return { ...o, cap, used, left, pct: cap ? left / cap : 0, needL: used, needRs: used * curRate() };
}
function odoNow() {   // aakhri meter reading + us ke baad ke km (Falcon)
  const ev = [];
  for (const p of pheras()) ev.push({ key: pKey(p), end: N(p.endR), start: N(p.startR), km: pc(p).km });
  for (const r of rows) if (r.kind === 'reading' && N(r.reading)) ev.push({ key: pKey(r), set: N(r.reading) });
  for (const f of fills()) if (f.odo) ev.push({ key: f.key, set: f.odo });
  for (const r of rows) if (r.kind === 'kharch' && r.oil && N(r.odo)) ev.push({ key: pKey(r), set: N(r.odo) });
  ev.sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
  let odo = 0, est = false;
  for (const e of ev) { if (e.set) { odo = e.set; est = false; } else if (e.end) { odo = e.end; est = false; } else if (e.km && (odo || e.start)) { odo = Math.max(odo, e.start) + e.km; est = true; } }
  return { odo: Math.round(odo), est };
}
// v2.96.1: 📒 DRIVER KA KHATA — chalta hisaab (sab mahine)
function driverLedger() {
  const ev = [];
  for (const p of pheras()) { const c = pc(p);
    if (c.driverDe) ev.push({ key: pKey(p), date: p.date, t: 'phera', amt: c.driverDe, p, c });
    const got = p.settled ? N(p.settled.amount) : c.colRs;   // purana tareeqa: bilty tick / "le liya"
    if (got) ev.push({ key: pKey(p) + '|y', date: p.date, t: 'liya', amt: -got, old: true, p }); }
  for (const r of rows) if (r.kind === 'kharch' && r.driver && N(r.amount)) ev.push({ key: pKey(r), date: r.date, t: 'kharch', amt: -N(r.amount), r });   // v2.97.1: driver ki jeb se extra kharcha
  for (const r of rows) if (r.kind === 'driver') ev.push(r.dir === 'in' ? { key: pKey(r), date: r.date, t: 'liya', amt: -N(r.amount), r } : r.sal ? { key: pKey(r), date: r.date, t: 'salary', amt: 0, r } : { key: pKey(r), date: r.date, t: 'diya', amt: N(r.amount), r });
  ev.sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
  let bal = 0; for (const e of ev) { bal = r2(bal + e.amt); e.bal = bal; }
  return { ev, bal, lastIn: [...ev].reverse().find(e => e.t === 'liya') || null };
}
const balBefore = (L, key) => { let b = 0; for (const e of L.ev) { if (e.key >= key) break; b = e.bal; } return b; };
function oilNow() {   // 🛢 mobil: aakhri badalne ke baad kitne km
  const O = rows.filter(r => r.kind === 'kharch' && r.oil).sort((a, b) => pKey(a) < pKey(b) ? -1 : 1), last = O[O.length - 1];
  if (!last) return null;
  const k = pKey(last), km = pheras().filter(p => pKey(p) > k).reduce((t, p) => t + pc(p).km, 0), every = oilEvery();
  return { last, km, every, left: every - km, lvl: km >= every ? 'bad' : km >= every * 0.9 ? 'warn' : 'ok' };
}
const pheras = () => rows.filter(r => r.kind === 'phera').sort((a, b) => String(a.date).localeCompare(String(b.date)) || N(a.at) - N(b.at));
function lastRate() { for (const p of pheras().slice().reverse()) for (const d of (p.diesel || []).slice().reverse()) if (N(d.rate)) return N(d.rate); for (const r of rows.slice().reverse()) if (r.kind === 'diesel' && N(r.rate)) return N(r.rate); return 0; }
function lastEnd(beforeAt) {
  let v = 0; for (const p of pheras()) { if (beforeAt && N(p.at) >= beforeAt) continue; if (N(p.endR) > v) v = N(p.endR); }
  if (!v) for (const r of rows) if (N(r.reading) > v) v = N(r.reading);
  return v;
}
function pc(p) {
  const B = p.bilties || [], K = p.kharche || [], D = p.diesel || [];
  const kiraya = B.reduce((s, b) => s + N(b.kiraya), 0), comm = B.reduce((s, b) => s + commOf(b), 0);
  const kh = K.reduce((s, k) => s + N(k.a), 0), dL = D.reduce((s, d) => s + N(d.l), 0), dRs = D.reduce((s, d) => s + N(d.amount), 0);
  const mk = N(p.endR) > N(p.startR) && N(p.startR) ? N(p.endR) - N(p.startR) : 0;   // meter se
  const tk = N(p.trackerKm), km = mk || tk, kmSrc = mk ? 'meter' : tk ? 'tracker' : '';   // v2.95.8: reading nahi to Falcon km
  // v2.96: FARZI diesel = km ÷ average × rate (band phere par us waqt ka rate/average jam jata: dRate/dAvg). Asal diesel (dL/dRs) nafe mein NAHI.
  const avg = N(p.dAvg) || avgFor(pKey(p)), rate = N(p.dRate) || rateFor(pKey(p));
  const shouldL = km ? km / avg : 0, shouldRs = shouldL * rate;
  const kmDiff = mk && tk ? mk - tk : 0, kmOk = !(mk && tk) || Math.abs(kmDiff) <= Math.max(10, mk * 0.05);
  const pending = p.settled ? 0 : B.filter(b => !b.col).reduce((s, b) => s + N(b.kiraya), 0);
  const nafa = kiraya - comm - kh - shouldRs, driverDe = kiraya - kh - comm;
  const colRs = B.filter(b => b.col).reduce((s, b) => s + N(b.kiraya), 0), lena = p.settled ? 0 : driverDe - colRs;
  return { kiraya, comm, kh, dL, dRs, km, mk, kmSrc, avg, rate, shouldL, shouldRs, tk, kmDiff, kmOk, pending, nafa, driverDe, colRs, lena, routes: B.map(b => `${b.from || '?'}→${b.to || '?'}`) };
}
// v2.96: is phere ki 'tanki full' line par khatam hone wala cycle (warna null)
function fullCheck(p) { const T = tankCycles(); return T.cyc.find(o => o.end && o.end.src === 'phera' && o.end.pid === p.id) || null; }
const isExtra = r => r.kind === 'kharch' && (r.extra || r.oil);
function monthCalc() {
  const inM = r => String(r.date || '').slice(0, 7) === month && (!day || r.date === day);
  const P = pheras().filter(inM), old0 = rows.filter(r => r.kind !== 'phera' && inM(r)), old = old0.filter(r => !isExtra(r));
  const s = { pheras: P, kiraya: 0, comm: 0, kh: 0, dL: 0, dRs: 0, km: 0, tk: 0, cat: {} };
  // v2.97.1: 🧾 extra kharche (aur mobil) — phere se bahar, sirf is mahine (ya chune din) ke; naya pehle
  s.extraL = old0.filter(isExtra).sort((a, b) => pKey(a) < pKey(b) ? 1 : -1); s.extra = s.extraL.reduce((t, r) => t + N(r.amount), 0);
  s.extraCat = {}; s.extraL.forEach(r => { const n = r.cat || 'Doosra'; s.extraCat[n] = (s.extraCat[n] || 0) + N(r.amount); });
  for (const p of P) { const c = pc(p); s.kiraya += c.kiraya; s.comm += c.comm; s.kh += c.kh; s.dL += c.dL; s.dRs += c.dRs; s.km += c.km; s.tk += c.tk; (p.kharche || []).forEach(k => { s.cat[k.n] = (s.cat[k.n] || 0) + N(k.a); }); }
  for (const r of old) {
    if (r.kind === 'bilty') { s.kiraya += N(r.kiraya); s.comm += commOf(r); (r.kharche || []).forEach(k => { s.kh += N(k.a); s.cat[k.n] = (s.cat[k.n] || 0) + N(k.a); }); }
    if (r.kind === 'diesel') { s.dL += N(r.litre); s.dRs += N(r.amount); }
    if (r.kind === 'kharch') { s.kh += N(r.amount); s.cat[r.cat || 'Doosra'] = (s.cat[r.cat || 'Doosra'] || 0) + N(r.amount); }
    if (r.kind === 'tracker') s.tk += N(r.km);
  }
  // v2.96: safi nafa (farzi diesel ke saath) − fixed kharche − tanki farq − qist = NAFA / GHATA
  s.farziRs = 0; s.shouldL = 0; for (const p of P) { const c = pc(p); s.farziRs += c.shouldRs; s.shouldL += c.shouldL; }
  s.old = old; s.safi = s.kiraya - s.comm - s.kh - s.farziRs;
  const T = tankCycles(); s.tank = T;
  s.cycM = T.cyc.filter(o => o.end && String(o.end.date).slice(0, 7) === month && (!day || o.end.date === day));
  s.tankFarq = s.cycM.reduce((t, o) => t + o.farq, 0);
  s.fillsM = T.F.filter(f => String(f.date).slice(0, 7) === month && (!day || f.date === day)); s.fillRs = s.fillsM.reduce((t, f) => t + f.rs, 0);
  s.fixedL = day ? [] : (Array.isArray(cfg.fixed) ? cfg.fixed : []).filter(x => x && N(x.a)); s.fixed = s.fixedL.reduce((t, x) => t + N(x.a), 0);
  s.qist = day ? 0 : N(cfg.qist);
  s.beforeQist = s.safi - s.fixed - s.tankFarq - s.extra;   // v2.97.1: − extra kharche
  s.qistPaid = Math.max(0, Math.min(s.qist, s.beforeQist)); s.qistBaqi = s.qist - s.qistPaid;
  s.nafa = s.beforeQist - s.qist;
  s.realAvg = s.cycM.length ? s.cycM.reduce((t, o) => t + o.km, 0) / (s.cycM.reduce((t, o) => t + o.actL, 0) || 1) : 0;
  // driver se lena (sab mahine) + commission baqaya
  s.pendList = []; for (const p of pheras()) if (!p.settled) (p.bilties || []).forEach(b => { if (!b.col && N(b.kiraya)) s.pendList.push({ p, b }); });
  s.pending = s.pendList.reduce((t, x) => t + N(x.b.kiraya), 0);
  const allComm = pheras().reduce((t, p) => t + pc(p).comm, 0) + rows.filter(r => r.kind === 'bilty').reduce((t, b) => t + commOf(b), 0);
  const keptComm = pheras().reduce((t, p) => t + (p.settled ? N(p.settled.comm) : 0), 0);   // v2.96: hisaab par driver ne commission khud rakh li
  s.driverBaqi = allComm - keptComm - rows.filter(r => r.kind === 'driver').reduce((t, d) => t + N(d.amount), 0);
  return s;
}
function monthName(m) { const [y, mm] = m.split('-'); return MONTHS[Number(mm) - 1] + ' ' + y; }
function shiftMonth(d) { const [y, m] = month.split('-').map(Number); const t = new Date(y, m - 1 + d, 1); month = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`; day = ''; paint(); }

// ---------- main screen ----------
function calendar() {
  const [y, m] = month.split('-').map(Number), first = new Date(y, m - 1, 1), days = new Date(y, m, 0).getDate();
  const cnt = {}; pheras().forEach(p => { if (String(p.date).slice(0, 7) === month) cnt[p.date] = (cnt[p.date] || 0) + 1; });
  const pad = (first.getDay() + 6) % 7, td = today(); let h = WD.map(w => `<i>${w}</i>`).join('') + '<span></span>'.repeat(pad);
  for (let d = 1; d <= days; d++) { const k = `${month}-${String(d).padStart(2, '0')}`, n = cnt[k] || 0;
    h += `<button type="button" data-gd="${k}" class="${n ? 'has' : ''}${k === day ? ' on' : ''}${k === td ? ' td' : ''}">${d}${n ? `<em>${n}</em>` : ''}</button>`; }
  return `<div class="gx-cal">${h}</div>`;
}
function paint() {
  const sum = $('summary'); if (!sum) return;
  const s = monthCalc(), up = s.nafa >= 0, own = isOwner();
  const chip = (k, ic, v, l, cls = '') => `<button type="button" class="gx-chip ${cls}" data-gr-open="${k}"><i>${ic}</i><b>${v}</b><small>${l}</small></button>`;
  const P = s.pheras.slice().reverse();
  sum.innerHTML = `<div class="gx">
    <div class="gx-hero" style="background:linear-gradient(135deg,#0b1a3a 0%,#1d3b7a 55%,#3a2c8f 100%);color:#fff">
      <div class="gx-top"><span class="gx-tag">🚚 ${esc(cfg.no || 'Gaari')}${cfg.driver ? ' · ' + esc(cfg.driver) : ''}</span>
        <span class="gx-month"><button type="button" data-gr-m="-1" style="color:#fff">‹</button><b style="color:#fff">${esc(monthName(month))}</b><button type="button" data-gr-m="1" style="color:#fff">›</button></span></div>
      <small style="color:rgba(255,255,255,.7)">${day ? esc(day.slice(8) + ' ' + monthName(month)) + ' ka ' : 'Is mahine ka '}${up ? 'NAFA' : 'GHATA'} · ${s.pheras.length} phera${s.qist ? ' · qist ke baad' : ''}</small>
      <strong class="gx-big" style="color:${up ? '#6dffb0' : '#ff9a9a'}">${up ? '' : '− '}${rs(Math.abs(s.nafa))}</strong>
      ${s.qist ? `<div class="gx-qist"><div class="gx-qbar"><span style="width:${Math.round(s.qistPaid / s.qist * 100)}%"></span></div>
        <small>🏦 Qist ${rs(s.qist)} · <b>${rs(s.qistPaid)}</b> pura${s.qistBaqi > 0 ? ` · <b class="q-baqi">${rs(s.qistBaqi)} baqi</b>` : ' ✓'}</small></div>` : ''}
      <div class="gx-flow">
        <span><small>Pheron ki bachat</small><b>${rs(s.safi)}</b></span>
        ${s.fixed ? `<span><small>− Fixed kharche</small><b>${rs(s.fixed)}</b></span>` : ''}
        ${s.tankFarq ? `<span><small>${s.tankFarq > 0 ? '− Tanki farq' : '+ Tanki bachat'}</small><b>${rs(Math.abs(s.tankFarq))}</b></span>` : ''}
        ${s.extra ? `<button type="button" class="gx-fx" data-gr-open="extra"><small>− Extra kharche ›</small><b>${rs(s.extra)}</b></button>` : ''}
        ${s.qist ? `<span><small>− Qist</small><b>${rs(s.qist)}</b></span>` : ''}
      </div>
      <small style="color:rgba(255,255,255,.75)">Kiraya ${rs(s.kiraya)} · Kharche ${rs(s.kh)} · Comm ${rs(s.comm)} · Diesel (farzi) ${rs(s.farziRs)}</small>
      ${err ? `<p class="gx-err">⚠ ${/permission/i.test(err) ? 'Ijazat nahi — Firebase mein Rules 2.32 publish karein' : esc(err)}</p>` : ''}
    </div>
    <button type="button" class="gx-new" data-gp-new="1">＋ Naya phera${day ? ' (' + esc(day.slice(8)) + ' tareekh)' : ''}</button>
    ${(() => { const L = driverLedger(); if (Math.abs(L.bal) < 1) return ''; const li = L.lastIn;
      return `<button type="button" class="gx-collect${L.bal < 0 ? ' gx-give' : ''}" data-gr-open="collect"><b>${L.bal > 0 ? '💰 Driver se lena hai' : '👤 Driver ko dena hai'}</b><strong>${rs(Math.abs(L.bal))}</strong><small>${li ? 'Aakhri dafa liya ' + rs(-li.amt) + ' · ' + esc(dmy(li.date)) + ' · ' : ''}tap = khata / 💵 paisa liya</small></button>`; })()}
    ${tankCard()}
    <div class="gx-chips">
      ${chip('km', '🛣️', s.km ? num(s.km) + ' km' : '—', 'Chali · tracker ' + (s.tk ? num(s.tk) : '—'))}
      ${(() => { const o = oilNow(); return o ? chip('oil', '🛢', num(o.km) + ' / ' + num(o.every), o.lvl === 'bad' ? 'Mobil badalwao!' : 'km · Mobil', o.lvl === 'bad' ? 'gx-bad' : o.lvl === 'warn' ? 'gx-warn' : '') : chip('oil', '🛢', '—', 'Mobil kab badla? likhein'); })()}
      ${chip('kharch', '🧾', rs(s.kh), 'Kharche · phera-wise')}
      ${chip('driver', '👤', rs(s.comm), 'Commission · driver ne rakhi')}
    </div>
    <details class="gx-calbox"${day ? ' open' : ''}><summary>📅 Calendar — tareekh chunein${day ? ` · <b>${esc(day.slice(8))} ${esc(monthName(month))}</b> <a data-gd="">sab dikhao</a>` : ''}</summary>${calendar()}</details>
    <div class="gx-acts"><button type="button" data-gr-pdf="1">⇩ PDF report</button>${s.old.length ? `<button type="button" data-gr-open="old">📋 Purani entries ${s.old.length}</button>` : ''}${own ? `<button type="button" data-gr-add="extra">🧾 Extra kharcha${s.extra ? ' · ' + rs(s.extra) : ''}</button><button type="button" data-gr-add="driver">👤 Driver ko diye</button><button type="button" data-gr-cfg="1">⚙ Setting</button>` : ''}</div>
    <div class="gx-plist">${P.length ? P.map(cardHTML).join('') : `<p class="gr-empty">${day ? 'Is din koi phera nahi' : 'Is mahine abhi koi phera nahi'} — upar "＋ Naya phera" dabayein.</p>`}</div>
  </div>`;
  const list = $('list'); if (list) list.innerHTML = '';
}
function cardHTML(p) {
  const c = pc(p), d = String(p.date || '').slice(8, 10) + ' ' + (MONTHS[Number(String(p.date).slice(5, 7)) - 1] || '');
  const warn = [!c.kmOk ? '📍 km farq' : '', c.driverDe ? '💰 driver ka ' + rs(c.driverDe) : ''].filter(Boolean);
  return `<button type="button" class="gp-card${p.status === 'closed' ? ' closed' : ''}" data-gp="${esc(p.id)}">
    <span class="gp-d"><b>${esc(d)}</b><small>${p.status === 'closed' ? '✅ band' : '🟢 khula'}</small></span>
    <span class="gp-m"><b>${esc(c.routes.join(' · ') || 'Bilty abhi nahi')}</b><small>${c.km ? num(c.km) + ' km' + (c.kmSrc === 'tracker' ? ' (tracker)' : '') : 'km baqi'} · ⛽ ${num(c.shouldL, 1)} L farzi · kharche ${rs(c.kh)}</small>${warn.length ? `<em>${warn.join(' · ')}</em>` : ''}</span>
    <span class="gp-v"><b class="${c.nafa >= 0 ? 'up' : 'down'}">${rs(c.nafa)}</b><small>bachat · kiraya ${rs(c.kiraya)}</small></span></button>`;
}

// ---------- v2.96: ⛽ dashboard (fuel dial + tanki + meter) ----------
function dialSVG(pct, big) {
  pct = Math.max(0, Math.min(1, Number(pct) || 0));
  const cx = 110, cy = 104, r = 84, P = a => [cx + r * Math.cos(Math.PI - a * Math.PI), cy - r * Math.sin(Math.PI - a * Math.PI)];
  const [ex, ey] = P(pct), na = Math.PI - pct * Math.PI, nx = cx + (r - 16) * Math.cos(na), ny = cy - (r - 16) * Math.sin(na);
  const ticks = [0, .125, .25, .375, .5, .625, .75, .875, 1].map(t => { const a = Math.PI - t * Math.PI, o = t % .25 === 0 ? 14 : 8;
    return `<line x1="${(cx + (r + 8) * Math.cos(a)).toFixed(1)}" y1="${(cy - (r + 8) * Math.sin(a)).toFixed(1)}" x2="${(cx + (r + 8 - o) * Math.cos(a)).toFixed(1)}" y2="${(cy - (r + 8 - o) * Math.sin(a)).toFixed(1)}" stroke="${t < .2 ? '#ff6b6b' : 'rgba(255,255,255,.75)'}" stroke-width="${o > 8 ? 3 : 2}" stroke-linecap="round"/>`; }).join('');
  const lab = (t, x) => { const a = Math.PI - t * Math.PI; return `<text x="${(cx + (r - 26) * Math.cos(a)).toFixed(1)}" y="${(cy - (r - 26) * Math.sin(a) + 5).toFixed(1)}" text-anchor="middle" font-size="14" font-weight="800" fill="${t === 0 ? '#ff8a8a' : '#cfe0ff'}">${x}</text>`; };
  const col = pct < .2 ? '#ff5d5d' : pct < .4 ? '#ffb020' : '#36e28a';
  return `<svg viewBox="0 0 220 128" class="gt-dial${big ? ' big' : ''}" role="img" aria-label="Diesel ${Math.round(pct * 100)}%">
    <defs><linearGradient id="gtArc" x1="0" x2="1"><stop offset="0" stop-color="#ff4d4d"/><stop offset=".35" stop-color="#ffb020"/><stop offset="1" stop-color="#36e28a"/></linearGradient>
      <radialGradient id="gtHub"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#9fb4dd"/></radialGradient></defs>
    <path d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="14" stroke-linecap="round"/>
    ${pct > 0.005 ? `<path d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${ex.toFixed(1)} ${ey.toFixed(1)}" fill="none" stroke="url(#gtArc)" stroke-width="14" stroke-linecap="round"/>` : ''}
    ${ticks}${lab(0, 'E')}${lab(.5, '½')}${lab(1, 'F')}
    <text x="${cx}" y="${cy - 30}" text-anchor="middle" font-size="22">⛽</text>
    <line x1="${cx}" y1="${cy}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="${col}" stroke-width="5" stroke-linecap="round" class="gt-needle"/>
    <circle cx="${cx}" cy="${cy}" r="9" fill="url(#gtHub)" stroke="${col}" stroke-width="3"/>
  </svg>`;
}
function tankSVG(pct) {
  pct = Math.max(0, Math.min(1, Number(pct) || 0)); const h = 92, y = 14 + h * (1 - pct), col = pct < .2 ? '#ff5d5d' : pct < .4 ? '#ffb020' : '#36e28a';
  return `<svg viewBox="0 0 84 120" class="gt-tank" role="img" aria-label="Tanki">
    <defs><linearGradient id="gtLiq" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}"/><stop offset="1" stop-color="${col}" stop-opacity=".55"/></linearGradient>
      <clipPath id="gtClip"><rect x="10" y="14" width="64" height="${h}" rx="14"/></clipPath></defs>
    <rect x="30" y="2" width="24" height="12" rx="4" fill="rgba(255,255,255,.35)"/>
    <rect x="10" y="14" width="64" height="${h}" rx="14" fill="rgba(255,255,255,.08)" stroke="rgba(255,255,255,.55)" stroke-width="3"/>
    <g clip-path="url(#gtClip)"><rect x="6" y="${y.toFixed(1)}" width="72" height="${(h - (y - 14) + 4).toFixed(1)}" fill="url(#gtLiq)"/>
      <path d="M6 ${y.toFixed(1)} q 9 -5 18 0 t 18 0 t 18 0 t 18 0" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="2"/></g>
    ${[.25, .5, .75].map(t => `<line x1="62" x2="72" y1="${(14 + h * (1 - t)).toFixed(1)}" y2="${(14 + h * (1 - t)).toFixed(1)}" stroke="rgba(255,255,255,.5)" stroke-width="2"/>`).join('')}
    <text x="42" y="${Math.min(100, Math.max(40, y + 22)).toFixed(1)}" text-anchor="middle" font-size="17" font-weight="900" fill="#fff">${Math.round(pct * 100)}%</text>
  </svg>`;
}
const odoHTML = o => { const d = String(Math.max(0, Math.round(o.odo || 0))).padStart(6, '0').split(''); return `<div class="gt-odo" title="${o.est ? 'Aakhri reading + Falcon km (andaza)' : 'Meter reading'}">${d.map(x => `<i>${x}</i>`).join('')}<em>km${o.est ? ' ≈' : ''}</em></div>`; };
function tankCard() {
  const t = tankNow(), o = odoNow();
  if (!t) return `<button type="button" class="gt-card gt-empty" data-gt-open="1"><span class="gt-mini">${dialSVG(0)}</span><span class="gt-txt"><b>⛽ Tanki khata</b><small>Pehli dafa: <u>Tanki full karwa li</u> dabayein — phir har phere ka farzi diesel yahan jurega</small></span></button>`;
  return `<button type="button" class="gt-card${t.pct < .2 ? ' low' : ''}" data-gt-open="1"><span class="gt-mini">${dialSVG(t.pct)}</span>
    <span class="gt-txt"><b>⛽ ${Math.round(t.pct * 100)}% · ${num(t.left, 0)} L bacha</b><small>Full ke baad ${t.pheras.length} phera · ${num(t.km)} km · farzi ${rs(t.farziRs)}</small>
    <small>Bharwana hai ~${num(t.needL, 1)} L ≈ <b>${rs(t.needRs)}</b></small>${o.odo ? odoHTML(o) : ''}</span></button>`;
}

// ---------- PHERA page ----------
function newPhera() {
  const date = day || today();
  const p = { kind: 'phera', date, startR: lastEnd() || 0, endR: 0, trackerKm: 0, bilties: [{ id: uid6(), from: '', to: '', party: '', kiraya: 0, col: false }], kharche: [], diesel: [], status: 'open', note: '', by: uidOf(), byName: byName() || '', at: Date.now() };
  const id = cloud.newGaariId();
  openPhera(id, p);   // v2.98.1: abhi sirf screen par — 💾 Save dabane par hi banega
}
function canEdit(p) { return isOwner() || p.status !== 'closed'; }
function save(fields) {   // v2.98.1: sirf screen par (dirty) — cloud par 💾 Save se
  if (!cur) return; Object.assign(cur, fields); curDirty = true; paintSaveBar();
}
function commitPhera(msg) {   // 💾 Save — rows + Firestore; km badle to kmLog (tanki usi waqt se)
  if (!cur) return false;
  const id = cur.id, prev = rows.find(x => x.id === id) || null;
  const data = JSON.parse(JSON.stringify(cur)); delete data.id; data.updatedAt = Date.now(); withKmLog(data, prev);
  if (prev) { for (const k of Object.keys(prev)) if (k !== 'id' && !(k in data)) delete prev[k]; Object.assign(prev, data); } else rows.push({ ...data, id });
  cur.updatedAt = data.updatedAt; cur.kmLog = data.kmLog;
  cloud.putGaari(id, data).catch(e => notice('❌ Phera save nahi hua: ' + (e?.message || e)));
  curDirty = false; curNew = false; paintSaveBar(); if (msg !== false) notice(msg || '💾 Phera save ho gaya');
  return true;
}
function paintSaveBar() {
  const b = $('gpSave'); if (!b || !cur) return; const need = curDirty || curNew;
  b.classList.toggle('dirty', need);
  b.innerHTML = need ? `<span class="gp-unsaved">● ${curNew ? 'Naya phera — abhi save nahi hua' : 'Tabdeeli save nahi hui'}</span><div class="gp-sbtns">${curDirty && !curNew ? '<button type="button" class="gp-undo" data-gp-undo="1">↩ Chhor dein</button>' : ''}<button type="button" class="gp-savebtn" data-gp-save="1">💾 Save</button></div>`
    : `<span class="gp-saved">✓ Sab save hai</span><button type="button" class="gp-savebtn off" data-gp-save="1">💾 Save</button>`;
}
function openPhera(id, fresh = null) {
  const p = fresh || rows.find(r => r.id === id); if (!p) return;
  cur = JSON.parse(JSON.stringify(p)); cur.id = id; curDirty = false; curNew = !!fresh;
  modal(`🚚 Phera · ${cur.date.slice(8)} ${MONTHS[Number(cur.date.slice(5, 7)) - 1]}`, `<div id="gpPage" class="gp-page"></div><div id="gpSave" class="gp-savebar"></div>`, true);
  drawPhera(); paintSaveBar();
  $('gpSave').onclick = e => {
    if (e.target.closest('[data-gp-save]')) { if (!curDirty && !curNew) { notice('✓ Sab pehle se save hai'); return; } commitPhera(); drawPhera(); return; }
    if (e.target.closest('[data-gp-undo]') && cur) { if (!confirm('Is dafa ki saari tabdeeli chhor dein? (purana save wala phera wapas)')) return;
      const r = rows.find(x => x.id === cur.id); if (r) { cur = JSON.parse(JSON.stringify(r)); cur.id = r.id; } curDirty = false; drawPhera(); paintSaveBar(); notice('↩ Tabdeeli chhor di'); }
  };
  const dlg = $('dialog');
  const onClose = () => { dlg?.removeEventListener('close', onClose);
    if (cur && curDirty && canEdit(cur)) { if (confirm('⚠️ Phere mein tabdeeli SAVE nahi hui.\n\nOK = 💾 Save karein\nCancel = Chhor dein (purana hi rahega)')) commitPhera(); else notice(curNew ? 'Naya phera nahi bana — save nahi kiya' : '↩ Tabdeeli chhor di — purana phera wahi'); }
    cur = null; curDirty = false; curNew = false; if (mounted) paint(); };
  dlg?.addEventListener('close', onClose);
}
// v2.96.5: tasveer — 📷 Camera YA 🖼 Gallery (pehle sirf camera khulta tha)
const photoPick = (title, attr) => `<div class="gr-ph2"><span>${title}</span><div><label class="gr-pbtn">📷 Camera<input type="file" accept="image/*" capture="environment" ${attr} hidden></label><label class="gr-pbtn">🖼 Gallery<input type="file" accept="image/*" ${attr} hidden></label></div></div>`;
const inp = (k, v, ph = '', type = 'number', cls = '') => `<input data-f="${k}" type="${type}" ${type === 'number' ? 'inputmode="decimal" step="any"' : ''} value="${esc(v ?? '')}" placeholder="${esc(ph)}" class="${cls}">`;
function drawPhera() {
  const box = $('gpPage'); if (!box || !cur) return;
  const ed = canEdit(cur), own = isOwner(), c = pc(cur), fc = fullCheck(cur);
  const dis = ed ? '' : ' disabled';
  box.innerHTML = `
  <div class="gp-sec"><div class="gp-h"><b>📄 Biltiyan</b>${ed ? '<button type="button" data-ga="bilty">＋ Bilty</button>' : ''}</div>
    ${(cur.bilties || []).map((b, i) => `<div class="gp-bilty" data-bi="${i}">
      <div class="gp-2">${inp('from', b.from, 'Kahan se', 'text')}${inp('to', b.to, 'Kahan tak', 'text')}</div>
      <div class="gp-2">${inp('party', b.party, 'Party / maal', 'text')}${inp('kiraya', b.kiraya || '', 'Kiraya Rs')}</div>
      <div class="gp-row"><label class="gp-chk"><input type="checkbox" data-f="col"${b.col ? ' checked' : ''}${own ? '' : ' disabled'}> 💰 Driver se kiraya le liya</label>
        <span class="gp-mini">comm ${rs(commOf(b))}</span>${ed ? `<button type="button" class="gp-x" data-gdel="bilty" data-i="${i}" title="Bilty hatao">🗑</button>` : ''}</div></div>`).join('') || '<p class="gr-empty">Bilty nahi</p>'}
  </div>
  <div class="gp-sec"><div class="gp-h"><b>🧾 Kharche</b><span class="gp-mini">${rs(c.kh)}</span></div>
    ${ed ? `<input type="search" class="gk-q" placeholder="🔍 Kharcha dhoondein ya naya likh kar Enter" autocomplete="off"><div class="gk-chips">${kChips()}</div>` : ''}
    <div class="gk-lines">${(cur.kharche || []).map((k, i) => `<div class="gk-line" data-ki="${i}"><span>${esc(k.n)}</span><input class="gk-a" data-f="a" type="number" inputmode="decimal" step="any" value="${esc(k.a || '')}" placeholder="Rs"${dis}>${ed ? `<button type="button" class="gk-x" data-gdel="kharch" data-i="${i}">✕</button>` : ''}</div>`).join('')}</div>
  </div>
  <div class="gp-sec"><div class="gp-h"><b>📍 Meter reading</b><span class="gp-mini">${c.km ? num(c.km) + ' km chali' + (c.kmSrc === 'tracker' ? ' · 📍 tracker se' : '') : ''}</span></div>
    <div class="gp-2"><label>Shuru (pichhle phere se)${inp('startR', cur.startR || '', 'Shuru reading')}</label><label>Aakhri (wapsi par)${inp('endR', cur.endR || '', 'Aakhri reading')}</label></div>
    ${ed && ai ? `<div class="gp-2">${photoPick('📷 Meter ki photo', 'data-gph="reading"')}<label class="gr-photo">📸 Falcon screenshots (ek ya zyada)<input type="file" accept="image/*" multiple data-gph="tracker" hidden></label></div><p class="gr-ai" id="gpAi" hidden></p>` : ''}
    ${tripsHTML(ed)}
    <label>Falcon tracker km${inp('trackerKm', cur.trackerKm || '', 'Tracker ke mutabiq km')}</label>
    <p class="gp-match ${c.mk && c.tk ? (c.kmOk ? 'ok' : 'bad') : c.kmSrc === 'tracker' ? 'trk' : ''}">${c.mk && c.tk ? (c.kmOk ? `✅ Meter ${num(c.mk)} km = tracker ${num(c.tk)} km` : `❌ Meter ${num(c.mk)} km, tracker ${num(c.tk)} km — ${num(Math.abs(c.kmDiff))} km farq`) : c.kmSrc === 'tracker' ? `📍 Meter reading nahi — hisaab Falcon ke <b>${num(c.tk, 2)} km</b> se. Reading baad mein likhein to milan bhi dikhega` : 'Meter aur tracker dono likhein to milan dikhega'}</p>
  </div>
  <div class="gp-sec"><div class="gp-h"><b>⛽ Diesel</b>${ed ? '<button type="button" data-ga="diesel">＋ Rastay mein dalwaya</button>' : ''}</div>
    <p class="gp-farzi">${c.km && !c.rate ? '<b class="gp-norate">⚠️ Diesel rate nahi — ⚙ Setting mein likhein ya tanki full ki parchi lagayein</b><br>' : ''}⛽ <b>Farzi diesel:</b> ${c.km ? `${num(c.km)} km ÷ ${num(c.avg, 2)} = <b>${num(c.shouldL, 1)} L</b> × Rs ${num(c.rate, 1)} = <b>${rs(c.shouldRs)}</b>${c.kmSrc === 'tracker' ? ' <small>(Falcon km)</small>' : ''}` : 'km likhne par lagega'}<br><small>Phere ke nafe mein yahi lagta hai. Asal diesel (tanki full / rastay mein) <u data-gt-open="1">tanki khata</u> mein jata hai — yahan plus/minus nahi.</small></p>
    ${ed && ai ? photoPick('🧾 Pump parchi ki photo — AI line bana dega', 'data-gph="diesel"') : ''}
    ${(cur.diesel || []).map((d, i) => `<div class="gp-diesel" data-di="${i}"><div class="gp-3">${inp('l', d.l || '', 'Litre')}${inp('rate', d.rate || '', 'Rate')}${inp('amount', d.amount || '', 'Rs')}</div>
      <div class="gp-row"><label class="gp-chk"><input type="checkbox" data-f="full"${d.full ? ' checked' : ''}${dis}> Tanki full karwayi</label>${ed ? `<button type="button" class="gp-x" data-gdel="diesel" data-i="${i}">🗑</button>` : ''}</div></div>`).join('')}
    ${c.dL ? `<p class="gp-dcheck">Is phere mein asal dalwaya: <b>${num(c.dL, 1)} L · ${rs(c.dRs)}</b> — tanki khata mein</p>` : ''}
    ${fc ? `<p class="gp-dcheck ${fc.farq > Math.max(300, fc.farziRs * 0.08) ? 'bad' : 'ok'}">🛢 Tanki full se full (${esc(dmy(fc.start.date))} se): ${num(fc.km)} km · asal ${num(fc.actL, 1)} L = average <b>${num(fc.avg, 2)}</b> · farzi ${num(fc.farziL, 1)} L · farq <b>${fc.farq >= 0 ? '+' : '−'}${rs(Math.abs(fc.farq))}</b></p>` : ''}
  </div>
  <div class="gp-sec gp-net"><div class="gp-h"><b>🧮 Phere ka nichod</b></div>
    <p><span>Kiraya</span><b>${rs(c.kiraya)}</b></p><p><span>− Kharche</span><b>${rs(c.kh)}</b></p><p><span>− Driver commission</span><b>${rs(c.comm)}</b></p><p><span>− Diesel (farzi ${num(c.shouldL, 1)} L)</span><b>${rs(c.shouldRs)}</b></p>
    <p class="gp-tot ${c.nafa >= 0 ? 'up' : 'down'}"><span>${c.nafa >= 0 ? 'BACHAT' : 'NUQSAN'}</span><b>${rs(Math.abs(c.nafa))}</b></p>
    ${!c.dL && c.shouldRs ? `<p class="gp-mini">Is phere se bachat ${rs(c.nafa)} — diesel abhi nahi dalwaya, farzi ${rs(c.shouldRs)} kaat liya (tanki khata mein jama)</p>` : ''}
    ${cur.settled ? `<p class="gp-settled">✅ Driver se hisaab ho gaya · ${rs(cur.settled.amount)} · ${esc(new Date(N(cur.settled.at)).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' }))}${own ? ' <button type="button" data-gp-unsettle="1">↩ wapas</button>' : ''}</p>`
      : c.driverDe ? (() => { const L = driverLedger(), before = balBefore(L, pKey(cur));
        return `<div class="gp-pend"><p>💰 Is phere ka driver se: <b>${rs(c.driverDe)}</b></p><small>Kiraya ${rs(c.kiraya)} − kharche ${rs(c.kh)} − commission ${rs(c.comm)} · is mein <b>safi nafa ${rs(c.nafa)}</b> + tanki ke liye farzi ${rs(c.shouldRs)}</small>
        <div class="dk-mini"><span>Pichhla baqaya <b>${rs(before)}</b></span><span>Abhi kul lena <b>${rs(L.bal)}</b></span></div>${own ? `<button type="button" class="gp-settle" data-gp-get="1">💵 Driver se paisa liya</button>` : ''}</div>`; })() : ''}
  </div>
  <label>Note${inp('note', cur.note, 'Kuch likhna ho', 'text')}</label>
  <div class="gp-foot">${cur.status === 'closed' ? (own ? '<button type="button" data-gst="open">🔓 Dobara kholein</button>' : '<span class="gp-mini">✅ Phera band — sirf malik badal sakta hai</span>') : '<button type="button" class="gp-close" data-gst="closed">✅ Phera band karein</button>'}${own ? '<button type="button" class="gp-del" data-gp-del="1">🗑 Phera hatao</button>' : ''}</div>`;
  wirePhera(box);
}
function liveNet(box) { // poora page dobara banaye bagair sirf hisaab wale hisse (focus na toote)
  const keep = document.activeElement, sel = keep && keep.dataset ? [keep.closest('[data-bi]')?.dataset.bi, keep.closest('[data-ki]')?.dataset.ki, keep.closest('[data-di]')?.dataset.di, keep.dataset.f] : null;
  drawPhera();
  if (sel) { const b = $('gpPage'); let q = sel[0] != null ? `[data-bi="${sel[0]}"] ` : sel[1] != null ? `[data-ki="${sel[1]}"] ` : sel[2] != null ? `[data-di="${sel[2]}"] ` : '';
    const el = b?.querySelector(q + `[data-f="${sel[3]}"]`); if (el) { el.focus(); try { const v = el.value; el.value = ''; el.value = v; } catch {} } }
}
function wirePhera(box) {
  let t = null;
  box.oninput = e => {
    const el = e.target, f = el.dataset.f; if (!f || !cur) return;
    const v = el.type === 'checkbox' ? el.checked : (el.type === 'number' ? (el.value === '' ? 0 : Number(el.value)) : el.value);
    const bi = el.closest('[data-bi]'), ki = el.closest('[data-ki]'), di = el.closest('[data-di]');
    if (bi) { const b = cur.bilties[Number(bi.dataset.bi)]; b[f] = typeof v === 'string' ? v.slice(0, 80) : v; if (f === 'col') b.colAt = v ? Date.now() : 0; save({ bilties: cur.bilties }); }
    else if (ki) { cur.kharche[Number(ki.dataset.ki)].a = N(v); save({ kharche: cur.kharche }); }
    else if (di) { const d = cur.diesel[Number(di.dataset.di)]; d[f] = v;
      if (f === 'l' || f === 'rate') { if (N(d.l) && N(d.rate)) { d.amount = Math.round(N(d.l) * N(d.rate)); const a = di.querySelector('[data-f="amount"]'); if (a) a.value = d.amount; } }
      if (f === 'amount' && N(d.l) && !N(d.rate)) d.rate = r2(N(d.amount) / N(d.l));
      save({ diesel: cur.diesel }); }
    else { save({ [f]: typeof v === 'string' ? v.slice(0, 200) : v }); }
    clearTimeout(t); t = setTimeout(() => liveNet(box), el.type === 'checkbox' ? 0 : 900);
  };
  box.onclick = e => {
    const a = e.target.closest('[data-ga]'); if (a && cur) {
      if (a.dataset.ga === 'bilty') { cur.bilties.push({ id: uid6(), from: cur.bilties.at(-1)?.to || '', to: '', party: '', kiraya: 0, col: false }); save({ bilties: cur.bilties }); }
      else { cur.diesel.push({ l: 0, rate: lastRate() || 0, amount: 0, full: false }); save({ diesel: cur.diesel }); }
      drawPhera(); return; }
    const d = e.target.closest('[data-gdel]'); if (d && cur) { const i = Number(d.dataset.i), k = d.dataset.gdel;
      if (k === 'bilty') { if (!confirm('Ye bilty hata dein?')) return; cur.bilties.splice(i, 1); save({ bilties: cur.bilties }); }
      if (k === 'kharch') { cur.kharche.splice(i, 1); save({ kharche: cur.kharche }); }
      if (k === 'diesel') { cur.diesel.splice(i, 1); save({ diesel: cur.diesel }); }
      drawPhera(); return; }
    const g = e.target.closest('[data-gk]'); if (g && cur) { addK(g.dataset.gk); return; }
    const tx = e.target.closest('[data-gtrip]'); if (tx && cur) { const L = (cur.trackerTrips || []).filter(x => x.t !== tx.dataset.gtrip); saveTrips(L); drawPhera(); return; }
    const st = e.target.closest('[data-gst]'); if (st && cur) {
      if (st.dataset.gst === 'closed' && !N(cur.endR) && !N(cur.trackerKm) && !confirm('Aakhri meter reading abhi nahi likhi — phir bhi band karein?')) return;
      // v2.96: band karte waqt diesel rate + average jama (baad mein badlein to purana phera na badle); kholne par phir live
      save(st.dataset.gst === 'closed' ? { status: 'closed', dRate: rateFor(pKey(cur)), dAvg: avgFor(pKey(cur)) } : { status: 'open', dRate: 0, dAvg: 0 }); commitPhera(st.dataset.gst === 'closed' ? '✅ Phera band + 💾 save' : '🔓 Phera khul gaya + 💾 save'); drawPhera(); return; }
    if (e.target.closest('[data-gp-settle]') && cur && isOwner()) { const c = pc(cur);
      if (!confirm(`Driver se ${rs(c.lena)} le liye?\n(sab biltiyan "le liya" ho jayengi, commission ${rs(c.comm)} driver ne rakh li)`)) return;
      (cur.bilties || []).forEach(b => { if (!b.col) { b.col = true; b.colAt = Date.now(); } });
      save({ bilties: cur.bilties, settled: { at: Date.now(), amount: Math.round(c.lena), comm: Math.round(c.comm), by: uidOf() } }); commitPhera('✅ ' + rs(c.lena) + ' le liye + 💾 save'); drawPhera(); return; }
    if (e.target.closest('[data-gp-get]') && cur && isOwner()) { if (curDirty || curNew) commitPhera(false); closeModal(); setTimeout(openDriverGet, 30); return; }   // pehle phera save
    if (e.target.closest('[data-gp-unsettle]') && cur && isOwner()) { if (!confirm('Hisaab wapas kholein?')) return; save({ settled: null }); commitPhera('↩ Hisaab khula + 💾 save'); drawPhera(); return; }
    if (e.target.closest('[data-gt-open]')) { closeModal(); setTimeout(openTank, 30); return; }
    if (e.target.closest('[data-gp-del]') && cur) { if (!confirm('Poora phera (sab biltiyan, kharche, diesel) hata dein?')) return; const id = cur.id, wasNew = curNew; curDirty = false; curNew = false; rows = rows.filter(r => r.id !== id); if (wasNew) { closeModal(); return; } cloud.delGaari(id).catch(er => notice('Nahi hua: ' + (er?.message || er))); closeModal(); notice('Phera hata diya'); }
  };
  const q = box.querySelector('.gk-q');
  if (q) { q.addEventListener('input', () => { box.querySelector('.gk-chips').innerHTML = kChips(q.value.trim()); }); q.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addK(q.value); } }); }
  box.querySelectorAll('[data-gph]').forEach(x => x.addEventListener('change', ev => { const L = [...(ev.target.files || [])]; ev.target.value = ''; photoPhera(x.dataset.gph, x.dataset.gph === 'tracker' ? L : L[0]); }));
}
function addK(n) {
  n = String(n || '').trim(); if (!n || !cur) return;
  cur.kharche.push({ n: n.slice(0, 40), a: 0 }); save({ kharche: cur.kharche }); drawPhera();
  const L = $('gpPage')?.querySelectorAll('.gk-line .gk-a'); L?.[L.length - 1]?.focus();
}
// kharchon ke naam: sab pheron + purani entries se yaad, zyada istemal pehle; malik Setting se chhupa sake (cfg.hideK)
function kNames() {
  const c = {}; const add = n => { n = String(n || '').trim(); if (n) c[n] = (c[n] || 0) + 1; };
  rows.forEach(r => { if (r.kind === 'kharch') add(r.cat); (r.kharche || []).forEach(k => add(k.n)); });
  KHARCH.forEach(k => { if (!c[k]) c[k] = 0; });
  const hide = new Set(Array.isArray(cfg.hideK) ? cfg.hideK : []);
  return Object.entries(c).filter(([n]) => !hide.has(n)).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([n]) => n);
}
const kChips = (q = '') => { const L = kNames().filter(n => !q || smartHit(n, q)).slice(0, 14);
  return L.map(n => `<button type="button" class="gk-chip" data-gk="${esc(n)}">${esc(n)}</button>`).join('') || (q ? `<button type="button" class="gk-chip gk-new" data-gk="${esc(q)}">＋ "${esc(q)}" naya</button>` : ''); };

// v2.95.8: Falcon trips — waqt se pehchan (dohra trip ek dafa), jor = trackerKm
const MI = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
function tripTime(t) {
  const m = String(t || '').match(/(\d{1,2})\s+([a-z]{3})[a-z]*\.?\s+(\d{4})\D+(\d{1,2}):(\d{2})\s*([ap]\.?m)?/i); if (!m) return 0;
  let h = Number(m[4]) % 12; if (m[6] && /^p/i.test(m[6])) h += 12; if (!m[6]) h = Number(m[4]);
  const mo = MI[m[2].toLowerCase()]; return mo == null ? 0 : new Date(Number(m[3]), mo, Number(m[1]), h, Number(m[5])).getTime();
}
const tripKey = t => { const x = tripTime(t); return x ? String(x) : String(t || '').toUpperCase().replace(/\s+/g, ' ').trim(); };
const tripLabel = t => { const x = tripTime(t); if (!x) return String(t || '?'); const d = new Date(x); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`; };
function saveTrips(L) {
  L = L.slice().sort((a, b) => tripTime(a.t) - tripTime(b.t));
  const tot = r2(L.reduce((s, x) => s + N(x.km), 0));
  save({ trackerTrips: L, trackerKm: tot });
}
function tripsHTML(ed) {
  const L = cur?.trackerTrips || []; if (!L.length) return '';
  const cut = L.filter(x => x.cut).length;
  return `<div class="gp-trips">${L.map(x => `<span class="gp-trip${x.cut ? ' cut' : ''}">${x.cut ? '⚠️' : '🕒'} ${esc(tripLabel(x.t))} · <b>${x.cut ? 'km nazar nahi' : num(x.km, 2) + ' km'}</b>${ed ? `<button type="button" data-gtrip="${esc(x.t)}" title="Ye trip hatao">✕</button>` : ''}</span>`).join('')}</div>
    <p class="gp-tsum">${L.length - cut} trip · jor <b>${num(L.reduce((s, x) => s + N(x.km), 0), 2)} km</b>${cut ? ` · <span class="bad">⚠️ ${cut} trip ka km screenshot mein kata hua — wo trip upar scroll kar ke dobara screenshot lein</span>` : ''}</p>`;
}
async function photoPhera(kind, file) {
  if (kind === 'tracker' && Array.isArray(file)) return photoTrips(file);
  if (!file || !cur) return; const out = $('gpAi'); if (out) { out.hidden = false; out.textContent = '🤖 AI parh raha hai… (10-30 second)'; } else notice('🤖 AI parh raha hai…');
  const P = {
    reading: 'Ye gaari ke odometer (meter) ki photo hai. Kul km (ODO) parh kar sirf JSON do: {"reading":n}. Trip meter nahi.',
    tracker: 'Ye Falcon-i / TPL tracker app ka screenshot hai. Kul chale km (Distance/Mileage/Total) sirf JSON mein: {"km":n}. Kai din hon to jor. Odometer dikhe to {"km":n,"odo":n}.',
    diesel: 'Ye petrol pump ki parchi hai. Sirf JSON: {"litre":n,"rate":n,"amount":n}. Jo na dikhe 0.'
  }[kind];
  try {
    const img = await shrink(file, 1600, 0.85); const txt = await ai([img], P);
    const m = String(txt || '').match(/\{[\s\S]*\}/); if (!m) throw Error('AI ko kuch samajh nahi aaya'); const j = JSON.parse(m[0]);
    let msg = '';
    if (kind === 'reading' && N(j.reading)) { save({ endR: N(j.reading) }); msg = '✓ Aakhri reading ' + num(j.reading); }
    if (kind === 'tracker' && N(j.km)) { save({ trackerKm: N(j.km) }); msg = '✓ Tracker ' + num(j.km) + ' km'; }
    if (kind === 'diesel' && (N(j.litre) || N(j.amount))) { const l = N(j.litre), a = N(j.amount), r = N(j.rate) || (l && a ? r2(a / l) : lastRate()); cur.diesel.push({ l: l || (a && r ? r2(a / r) : 0), rate: r, amount: a || Math.round(l * r), full: false }); save({ diesel: cur.diesel }); msg = '✓ Diesel line ban gayi'; }
    drawPhera(); const o2 = $('gpAi'); if (o2) { o2.hidden = false; o2.textContent = msg ? msg + ' — ek nazar dekh lein' : 'AI ko hindse saaf nahi mile — khud likh dein'; }
  } catch (e) { const o2 = $('gpAi'); if (o2) { o2.hidden = false; o2.textContent = '⚠ ' + (e?.message || e) + ' — khud likh dein'; } else notice('⚠ ' + (e?.message || e)); }
}

async function photoTrips(files) {
  files = (files || []).slice(0, 4); if (!files.length || !cur) return;
  const out = $('gpAi'); const say = t => { const o = $('gpAi'); if (o) { o.hidden = false; o.textContent = t; } else notice(t); };
  say(`🤖 AI ${files.length} screenshot parh raha hai… (10-40 second)`);
  const P = 'Ye Falcon-i / TPL tracker app ke "Trips" screen ke ' + files.length + ' screenshot hain (ek hi list, upar-neeche scroll). ' +
    'Har trip ka heading waqt (jaise "06 Oct 2026 05:26 PM") aur us ke neeche "Total Distance" ka km nikalo. ' +
    'Jo trip ek se zyada screenshot mein dikhe usay SIRF EK DAFA likho. Jis trip ka Total Distance screenshot mein kata hua / nazar na aaye us ka "km": null. ' +
    'Sirf JSON do: {"trips":[{"t":"06 Oct 2026 05:26 PM","km":10.37}]}. Agar trips ki list na ho aur sirf kul distance ho to {"km":n}.';
  try {
    const imgs = []; for (const f of files) imgs.push(await shrink(f, 1600, 0.85));
    const txt = await ai(imgs, P);
    const m = String(txt || '').match(/\{[\s\S]*\}/); if (!m) throw Error('AI ko kuch samajh nahi aaya');
    const j = JSON.parse(m[0]);
    if (!Array.isArray(j.trips) || !j.trips.length) {
      if (N(j.km)) { save({ trackerKm: N(j.km) }); drawPhera(); say('✓ Tracker ' + num(j.km) + ' km — ek nazar dekh lein'); return; }
      throw Error('Trips nazar nahi aaye');
    }
    const map = new Map((cur.trackerTrips || []).map(x => [tripKey(x.t), x]));
    let added = 0, filled = 0;
    for (const x of j.trips) {
      const t = String(x?.t || '').slice(0, 40).trim(); if (!t) continue;
      const k = tripKey(t), km = x.km == null || x.km === '' ? null : N(x.km), old = map.get(k);
      if (km == null) { if (!old) { map.set(k, { t, km: 0, cut: true }); added++; } continue; }
      if (!old) added++; else if (old.cut) filled++;
      map.set(k, { t, km: r2(km) });   // purana kata hua ho to ab poora
    }
    const L = [...map.values()]; saveTrips(L); drawPhera();
    const cut = L.filter(x => x.cut).length;
    say(`✓ ${L.length - cut} trip = ${num(N(cur.trackerKm), 2)} km${added ? ` · ${added} naye` : ''}${filled ? ` · ${filled} kata hua poora hua` : ''}${!added && !filled ? ' · koi naya trip nahi (pehle se the)' : ''}${cut ? ` · ⚠️ ${cut} trip ka km kata hua` : ''} — ek nazar dekh lein`);
  } catch (e) { say('⚠ ' + (e?.message || e) + ' — khud likh dein'); }
}

// ---------- windows (chips) ----------
function openDetail(k) {
  const s = monthCalc(), own = isOwner();
  const kv = arr => `<div class="gx-kv">${arr.map(([a, b]) => `<p><span>${a}</span><b>${b}</b></p>`).join('')}</div>`;
  if (k === 'collect' || k === 'driver') { openDriverKhata(); return; }
  if (k === 'kharch') {
    const P = s.pheras;
    modal('🧾 Kharche — phera-wise', `<div class="gx-win">${kv(Object.entries(s.cat).sort((a, b) => b[1] - a[1]).map(([a, b]) => [esc(a), rs(b)]).concat([['Kul', rs(s.kh)]]))}${P.map(p => { const c = pc(p); return (p.kharche || []).length ? `<div class="gp-kcard" data-gp="${esc(p.id)}"><b>${esc(String(p.date).slice(8))} ${esc(MONTHS[Number(String(p.date).slice(5, 7)) - 1])} · ${esc(c.routes.join(' · '))}</b><small>${(p.kharche || []).map(x => esc(x.n) + ' ' + num(x.a)).join(' · ')}</small><em>${rs(c.kh)}</em></div>` : ''; }).join('')}</div>`);
    return;
  }
  if (k === 'avg') { openTank(); return; }
  if (k === 'oil') { openOil(); return; }
  if (k === 'extra') { openExtraList(); return; }
  if (k === 'km') {
    modal('🛣️ Km — phera-wise', `<div class="gx-win">${kv([['Km (meter, warna Falcon)', num(s.km)], ['Falcon km', s.tk ? num(s.tk) : '—'], ['Farzi diesel', num(s.shouldL, 1) + ' L · ' + rs(s.farziRs)], ['Average (setting)', num(avgOf(), 2) + ' km/L']])}${s.pheras.map(p => { const c = pc(p); return `<div class="gp-kcard${!c.kmOk ? ' bad' : ''}" data-gp="${esc(p.id)}"><b>${esc(dmy(p.date))} · ${esc(c.routes.join(' · '))}</b><small>${c.kmSrc === 'tracker' ? 'Falcon ' + num(c.km) + ' km (meter nahi)' : 'Meter ' + num(c.km) + ' km'} · tracker ${c.tk ? num(c.tk) : '—'} · farzi ${num(c.shouldL, 1)} L / ${rs(c.shouldRs)}</small><em>${c.kmOk ? '✓' : '❌ ' + num(Math.abs(c.kmDiff)) + ' km'}</em></div>`; }).join('')}</div>`);
    return;
  }
  if (k === 'old') {
    modal('📋 Purani entries', `<div class="gx-win"><div class="gr-list">${s.old.map(r => `<div class="gr-row"><span class="gr-d">${esc(r.date)}</span><span class="gr-t">${esc(r.kind)} ${esc(r.from ? r.from + '→' + (r.to || '') : r.cat || r.note || '')}</span><span class="gr-v">${num(r.kiraya || r.amount || r.reading || r.km || r.litre)}</span>${own ? `<button type="button" class="gr-x" data-gr-del="${esc(r.id)}">✕</button>` : ''}</div>`).join('')}</div></div>`);
  }
}

// ---------- v2.97.1: 🧾 EXTRA KHARCHA (phere se bahar — mahine ke nafe se minus) ----------
const monthEnd = m => `${m}-${String(new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0).getDate()).padStart(2, '0')}`;
const xDate = () => day || (today().slice(0, 7) === month ? today() : month > today().slice(0, 7) ? month + '-01' : monthEnd(month));   // pichhla mahina khula ho to us ki aakhri tareekh
function lastAmt() {   // har kharche ke naam ki aakhri raqam (extra pehle, warna phere wali) — chip par chhoti likhi + tap par bhar de
  const m = {}, k = {};
  for (const p of pheras()) (p.kharche || []).forEach(x => { if (x.n && N(x.a)) { k[x.n] = N(x.a); } });
  for (const r of rows.filter(r => r.kind === 'kharch' && r.cat && N(r.amount)).sort((a, b) => pKey(a) < pKey(b) ? -1 : 1)) m[r.cat] = N(r.amount);
  return { ...k, ...m };
}
function openExtraList() {
  const s = monthCalc(), own = isOwner(), L = s.extraL, cats = Object.entries(s.extraCat).sort((a, b) => b[1] - a[1]);
  modal('🧾 Extra kharche — ' + (day ? dmy(day) : monthName(month)), `<div class="gx-win xk-win">
    <div class="xk-head"><small>${day ? 'Is din' : 'Is mahine'} ke extra kharche — upar wale NAFA se minus</small><strong>− ${rs(s.extra)}</strong>
      <span>${L.length} entry · ${day ? 'poore mahine ke liye calendar se din hatayein' : 'agle mahine khud 0 se'}</span></div>
    ${own ? '<div class="gt-btns"><button type="button" class="gt-full" data-gr-add="extra">＋ Extra kharcha</button></div>' : ''}
    ${cats.length > 1 ? `<div class="xk-cats">${cats.map(([n, a]) => `<span>${esc(n)}<b>${rs(a)}</b></span>`).join('')}</div>` : ''}
    <div class="gr-list">${L.map(r => `<div class="gr-row xk-row"><span class="gr-d">${esc(dmy(r.date))}</span>
      <span class="gr-t">${r.oil ? '🛢 ' : '🧾 '}<b>${esc(r.cat || 'Doosra')}</b>${r.driver ? ' <em class="xk-drv">👤 driver ki jeb</em>' : ''}${r.note ? `<small>${esc(r.note)}</small>` : ''}</span>
      <span class="gr-v">${rs(r.amount)}</span>${own ? `<button type="button" class="xk-ed" data-gx-edit="${esc(r.id)}" aria-label="Badlein">✏️</button><button type="button" class="gr-x" data-gr-del="${esc(r.id)}">✕</button>` : ''}</div>`).join('') || `<p class="gr-empty">${day ? 'Is din' : 'Is mahine'} abhi koi extra kharcha nahi</p>`}</div></div>`);
}
function openExtra(id) {
  const r = id ? rows.find(x => x.id === id) : null, LA = lastAmt(), sNow = monthCalc();
  modal(r ? '✏️ Extra kharcha badlein' : '🧾 Extra kharcha', `<form id="gxForm" class="gr-form xk-form">
    ${!r && sNow.extraL.length ? `<button type="button" class="xk-seen" data-gr-open="extra">📋 ${esc(day ? dmy(day) : monthName(month))} ke extra: <b>${sNow.extraL.length} · ${rs(sNow.extra)}</b> ›</button>` : ''}
    <label>Kharcha kis cheez ka?<input name="cat" type="search" class="gk-q" placeholder="🔍 Dhoondein ya naya naam likh kar Enter" autocomplete="off" value="${esc(r?.cat || '')}"></label>
    <div class="gk-chips xk-chips" id="gxChips"></div>
    <div class="gr-2">${field('amount', 'Raqam (Rs)', 'number', r ? r.amount : '')}${field('date', 'Tareekh', 'date', r?.date || xDate())}</div>
    ${field('note', 'Note (ikhtiyari)', 'text', r?.note || '', 'placeholder="jaise: agla right tyre · Gujrat workshop"')}
    <label class="gp-chk"><input type="checkbox" name="driver"${r?.driver ? ' checked' : ''}> 👤 Driver ne apni jeb se diya — driver ke khate mein jama (us se lena kam)</label>
    <p class="gr-ai" id="gxHint"></p><p class="gr-msg"></p><button type="submit" class="primary">💾 Save</button></form>`);
  const f = $('gxForm'), q = f.elements.cat, box = $('gxChips'), amt = f.elements.amount, hint = $('gxHint');
  const all = () => { const L = kNames(); if (r?.cat && !L.includes(r.cat)) L.unshift(r.cat); return L; };
  const paintChips = () => { const v = q.value.trim(), lv = v.toLowerCase(), L = all(), exact = L.some(n => n.toLowerCase() === lv);
    const show = (v && !exact ? L.filter(n => smartHit(n, v)) : L).slice(0, 24);
    box.innerHTML = show.map(n => `<button type="button" class="gk-chip${n.toLowerCase() === lv ? ' on' : ''}" data-xk="${esc(n)}">${esc(n)}${LA[n] ? `<small>${num(LA[n])}</small>` : ''}</button>`).join('')
      + (v && !exact ? `<button type="button" class="gk-chip gk-new" data-xk="${esc(v)}">＋ "${esc(v)}" naya</button>` : '');
    const d = String(f.elements.date.value || xDate()), m = d.slice(0, 7);
    hint.innerHTML = `Ye raqam <b>${esc(monthName(m))}</b> ke NAFA se minus hogi${f.elements.driver.checked ? ' · driver ke khate mein jama' : ''}. Agle mahine extra kharche 0 se.`; };
  const pick = n => { q.value = n; if (!N(amt.value) && LA[n]) amt.value = LA[n]; paintChips(); amt.focus(); amt.select?.(); };
  box.addEventListener('click', e => { const c = e.target.closest('[data-xk]'); if (c) pick(c.dataset.xk); });
  q.addEventListener('input', paintChips); f.elements.date.addEventListener('change', paintChips); f.elements.driver.addEventListener('change', paintChips);
  q.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); if (q.value.trim()) pick(q.value.trim()); } });
  paintChips(); if (!r) setTimeout(() => q.focus(), 60);
  f.onsubmit = e => { e.preventDefault(); const o = Object.fromEntries(new FormData(f)), msg = f.querySelector('.gr-msg');
    const cat = String(o.cat || '').trim().replace(/\s+/g, ' ').slice(0, 40), a = Math.round(N(o.amount) * 100) / 100, date = String(o.date || xDate()).slice(0, 10);
    if (!cat) { msg.textContent = 'Upar chip chunein ya kharche ka naam likhein'; q.focus(); return; }
    if (!(a > 0)) { msg.textContent = 'Raqam likhein'; amt.focus(); return; }
    const base = { cat, amount: a, date, note: String(o.note || '').trim().slice(0, 200), driver: !!o.driver };
    const did = r ? r.id : cloud.newGaariId();
    const d = r ? { ...r, ...base, updatedAt: Date.now() } : { kind: 'kharch', extra: true, ...base, at: Date.now(), by: uidOf(), byName: byName() || '' };
    delete d.id;
    if (r) Object.assign(r, d); else rows.push({ ...d, id: did });
    cloud.putGaari(did, d).catch(er => notice('❌ Extra kharcha save nahi hua: ' + (er?.message || er)));
    closeModal(); const m = date.slice(0, 7);
    notice(`✓ ${cat} ${rs(a)} — ${m === month ? 'NAFA se minus' : monthName(m) + ' ke hisaab mein'}${base.driver ? ' · driver ke khate mein jama' : ''}`); paint(); };
}

// ---------- v2.96: ⛽ TANKI KHATA ----------
function openTank() {
  const T = tankCycles(), t = tankNow(T), o = odoNow(), own = isOwner(), rate = curRate();
  const cyc = T.cyc.filter(x => x.end).slice().reverse();
  const head = t ? `<div class="gt-dash">
      <div class="gt-top"><span>🚚 ${esc(cfg.no || 'Gaari')}</span>${o.odo ? odoHTML(o) : '<em class="gt-noodo">meter reading nahi</em>'}</div>
      <div class="gt-row"><div class="gt-dialw">${dialSVG(t.pct, true)}<b>${num(t.left, 0)} / ${num(t.cap)} L</b><small>andaza bacha</small></div><div class="gt-tankw">${tankSVG(t.pct)}</div></div>
      <div class="gt-stats"><p><small>Full ke baad</small><b>${t.pheras.length} phera · ${num(t.km)} km</b></p><p><small>Lag chuka (farzi)</small><b>${num(t.farziL, 1)} L</b></p>
        <p><small>Tanki khata (farzi)</small><b>${rs(t.farziRs)}</b></p><p><small>Rate · average</small><b>Rs ${num(rate, 1)} · ${num(avgOf(), 2)}</b></p></div>
      <div class="gt-need">⛽ Ab full karwane par ~<b>${num(t.needL, 1)} L</b> lagega ≈ <b>${rs(t.needRs)}</b>${t.topL ? ` <small>(beech mein ${num(t.topL, 1)} L dalwaya — ghata diya)</small>` : ''}</div>
    </div>` : `<div class="gt-dash gt-first"><div class="gt-row"><div class="gt-dialw">${dialSVG(0, true)}</div><div class="gt-tankw">${tankSVG(0)}</div></div>
      <p>Abhi tanki ka hisaab shuru nahi hua. <b>Tanki full karwa kar</b> neeche button dabayein — us ke baad har phere ka farzi diesel (Falcon km ÷ ${num(avgOf(), 2)} × rate) yahan jurta jayega aur agli full par asal se milan hoga.</p></div>`;
  const btns = `<div class="gt-btns"><button type="button" class="gt-full" data-gt-fill="full">⛽ Tanki full karwa li</button><button type="button" data-gt-fill="part">＋ Thora diesel (full nahi)</button></div>`;
  const cards = cyc.map(c => { const bad = c.farq > Math.max(300, c.farziRs * 0.08), m = c.end.marked;
    return `<div class="gt-cyc ${bad ? 'bad' : 'ok'}"><div class="gt-ch"><b>${esc(dmy(c.start.date))} → ${esc(dmy(c.end.date))}</b><span>${c.pheras.length} phera · ${num(c.km)} km</span></div>
      <div class="gt-cg"><p><small>Farzi (nafe se kata)</small><b>${num(c.farziL, 1)} L · ${rs(c.farziRs)}</b></p><p><small>Asal dalwaya</small><b>${num(c.actL, 1)} L · ${rs(c.actRs)}</b></p>
        <p class="${c.farq > 0 ? 'neg' : 'pos'}"><small>${c.farq > 0 ? 'Zyada laga' : 'Bachat'}</small><b>${c.farq > 0 ? '+' : '−'}${num(Math.abs(c.farqL), 1)} L · ${rs(Math.abs(c.farq))}</b></p><p><small>Asal average</small><b>${c.avg ? num(c.avg, 2) + ' km/L' : '—'}</b></p></div>
      ${m ? `<p class="gt-marked">✓ Mark ho gaya — average ${num(c.end.mAvg || c.avg, 2)} app mein lagi</p>` : own && c.avg ? `<button type="button" class="gt-mark" data-gt-mark="${esc(c.end.key)}">✓ Farq mark karein — average ${num(c.avg, 2)} app mein lagao</button>` : ''}</div>`; }).join('');
  const hist = T.F.slice().reverse().slice(0, 40).map(f => `<div class="gr-row gr-diesel"><span class="gr-d">${esc(dmy(f.date))}</span><span class="gr-t">${f.full ? '⛽ Tanki full' : '＋ Thora'}${f.src === 'phera' ? ' <small>phere mein</small>' : ''}${f.note ? `<small>${esc(f.note)}</small>` : ''}</span><span class="gr-v">${num(f.l, 1)} L<small>${rs(f.rs)} · Rs ${num(f.rate, 1)}</small></span>${own && f.src === 'doc' ? `<button type="button" class="gr-x" data-gr-del="${esc(f.id)}">✕</button>` : ''}</div>`).join('');
  const before = T.first && T.before.length ? `<p class="gr-ai">Pehli tanki full (${esc(dmy(T.first.date))}) se pehle ${T.before.length} phera — un ka farzi diesel nafe mein laga hai, tanki milan mein nahi.</p>` : '';
  modal('⛽ Tanki khata', `<div class="gx-win gt-win">${head}${btns}${cards ? `<h4 class="gt-h">🔁 Tanki full se full — farzi vs asal</h4>${cards}` : ''}${before}${hist ? `<h4 class="gt-h">🧾 Diesel dalwaya</h4><div class="gr-list">${hist}</div>` : ''}</div>`);
}
function openFill(full) {
  const now = new Date(), hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`, t = tankNow();
  modal(full ? '⛽ Tanki full karwa li' : '＋ Thora diesel dalwaya', `<form id="gtForm" class="gr-form">
    ${t && full ? `<p class="gt-need">Andaza: ~<b>${num(t.needL, 1)} L</b> ≈ <b>${rs(t.needRs)}</b> lagna chahiye (${t.pheras.length} phera · ${num(t.km)} km)</p>` : ''}
    ${ai ? photoPick('🧾 Pump parchi ki photo — AI litre / rate / Rs bhar dega', 'data-gt-ph="1"') + '<p class="gr-ai" id="gtAi" hidden></p>' : ''}
    <div class="gr-2">${field('date', 'Tareekh', 'date', day || today())}${field('time', 'Waqt', 'time', hm)}</div>
    <div class="gr-2">${field('litre', 'Litre', 'number', '', 'required')}${field('rate', 'Rate (Rs/L)', 'number', curRate() || '')}</div>
    ${field('amount', 'Kul Rs', 'number', '')}
    ${field('odo', 'Meter reading (ikhtiyari)', 'number', '')}
    ${field('note', 'Note', 'text', '', 'placeholder="pump ka naam / kis ne dalwaya"')}
    <p class="gr-ai">${full ? 'Ye paisa asal nafe se katega. Pichhli full se farzi ke saath milan ho kar farq aur asal average tanki khata mein aa jayegi.' : 'Beech mein thora diesel — agli full par milan mein jur jayega.'}</p>
    <p class="gr-msg"></p><button type="submit" class="primary">💾 Save</button></form>`);
  const f = $('gtForm'), el = n => f.elements[n];
  const calc = () => { const l = N(el('litre').value), r = N(el('rate').value); if (l && r) el('amount').value = Math.round(l * r); };
  el('litre').addEventListener('input', calc); el('rate').addEventListener('input', calc);
  el('amount').addEventListener('input', () => { const l = N(el('litre').value), a = N(el('amount').value); if (l && a && !N(el('rate').value)) el('rate').value = r2(a / l); });
  f.querySelectorAll('[data-gt-ph]').forEach(inp0 => inp0.addEventListener('change', async ev => {
    const file = ev.target.files?.[0]; if (!file) return; const out = $('gtAi'); out.hidden = false; out.textContent = '🤖 AI parchi parh raha hai…';
    try { const img = await shrink(file, 1600, 0.85); const txt = await ai([img], 'Ye petrol pump ki diesel parchi hai. Sirf JSON: {"litre":n,"rate":n,"amount":n}. Jo na dikhe 0.');
      const m = String(txt || '').match(/\{[\s\S]*\}/); if (!m) throw Error('AI ko samajh nahi aaya'); const j = JSON.parse(m[0]);
      const l = N(j.litre), a = N(j.amount), r = N(j.rate) || (l && a ? r2(a / l) : 0);
      if (l) el('litre').value = l; if (r) el('rate').value = r; if (a) el('amount').value = a; else calc();
      out.textContent = `✓ ${num(l, 2)} L · Rs ${num(r, 2)} · ${rs(a || l * r)} — ek nazar dekh lein`; }
    catch (er) { out.textContent = '⚠ ' + (er?.message || er) + ' — khud likh dein'; }
  }));
  f.onsubmit = e => { e.preventDefault(); const o = Object.fromEntries(new FormData(f));
    const l = N(o.litre), r = N(o.rate) || (l && N(o.amount) ? r2(N(o.amount) / l) : 0), a = N(o.amount) || Math.round(l * r);
    if (!(l > 0)) { f.querySelector('.gr-msg').textContent = 'Litre likhein'; return; }
    const date = String(o.date || today()).slice(0, 10), [hh, mm] = String(o.time || '12:00').split(':').map(Number);
    const at = new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)), hh || 0, mm || 0).getTime();
    const id = cloud.newGaariId(), d = { kind: 'diesel', date, at, litre: r2(l), rate: r2(r), amount: Math.round(a), full: !!full, odo: N(o.odo) || 0, note: String(o.note || '').slice(0, 120), by: uidOf(), byName: byName() || '' };
    rows.push({ ...d, id }); cloud.putGaari(id, d).catch(er => notice('❌ Diesel save nahi hua: ' + (er?.message || er)));
    if (isOwner() && r > 0) { cfg.dieselRate = r2(r); cfg.rateAt = at; cloud.setGaariConfig({ dieselRate: r2(r), rateAt: at }).catch(() => {}); }   // parchi ka rate = aage ka farzi rate
    closeModal(); notice(full ? '⛽ Tanki full save — milan tanki khata mein' : '✓ Diesel save'); paint(); setTimeout(openTank, 60);
  };
}
function markCycle(key) {
  const T = tankCycles(), c = T.cyc.find(x => x.end && x.end.key === key); if (!c || !c.avg || !isOwner()) return;
  const avg = r2(c.avg);
  if (!confirm(`Farq mark karein?\nAsal average ${num(avg, 2)} km/L — aage ke pheron ka farzi diesel isi se lagega (abhi ${num(avgOf(), 2)}).`)) return;
  const stamp = Date.now();
  if (c.end.src === 'doc') { const r = rows.find(x => x.id === c.end.id); if (r) { r.marked = stamp; r.mAvg = avg; const d = { ...r }; delete d.id; cloud.putGaari(r.id, d).catch(er => notice('❌ ' + (er?.message || er))); } }
  else { const p = rows.find(x => x.id === c.end.pid); const dl = p?.diesel?.[c.end.i]; if (dl) { dl.marked = stamp; dl.mAvg = avg; const d = { ...p }; delete d.id; cloud.putGaari(p.id, d).catch(er => notice('❌ ' + (er?.message || er))); } }
  const H = avgHistWith(keyAt(c.end.key), avg);   // fill ke BAAD ke pheron par nayi average — is cycle ka milan wahi rehta
  cfg.avg = avg; cfg.avgHist = H; cloud.setGaariConfig({ avg, avgAt: stamp, avgHist: H }).catch(er => notice('❌ ' + (er?.message || er)));
  notice('✓ Average ' + num(avg, 2) + ' lag gayi'); paint(); openTank();
}
function openOil() {
  const o = oilNow(), od = odoNow();
  modal('🛢 Mobil (engine oil)', `<form id="goForm" class="gr-form">
    ${o ? `<div class="gt-oil ${o.lvl}"><b>${num(o.km)} / ${num(o.every)} km</b><div class="gx-qbar"><span style="width:${Math.min(100, Math.round(o.km / o.every * 100))}%"></span></div>
      <small>Aakhri dafa ${esc(dmy(o.last.date))}${o.last.amount ? ' · ' + rs(o.last.amount) : ''} · ${o.left > 0 ? num(o.left) + ' km baqi' : '⚠️ ' + num(-o.left) + ' km upar ho gaye — foran badalwao'}</small></div>`
      : '<p class="gr-ai">Abhi mobil ki koi tareekh nahi. Jab aakhri dafa badla tha woh likh dein — phir har phere ke km se ginti hogi.</p>'}
    <b>Mobil badal diya</b>
    <div class="gr-2">${field('date', 'Tareekh', 'date', today())}${field('amount', 'Kharcha Rs', 'number', '')}</div>
    ${field('odo', 'Meter reading (ikhtiyari)', 'number', od.odo && !od.est ? od.odo : '')}
    <p class="gr-msg"></p><button type="submit" class="primary">🛢 Save — ginti 0 se</button></form>`);
  const f = $('goForm');
  f.onsubmit = e => { e.preventDefault(); const x = Object.fromEntries(new FormData(f)); const date = String(x.date || today()).slice(0, 10);
    const id = cloud.newGaariId(), d = { kind: 'kharch', oil: true, cat: 'Mobil change', date, at: Date.now(), amount: N(x.amount), odo: N(x.odo) || 0, by: uidOf(), byName: byName() || '' };
    rows.push({ ...d, id }); cloud.putGaari(id, d).catch(er => notice('❌ ' + (er?.message || er))); closeModal(); notice('🛢 Mobil save — ginti 0 se'); paint(); };
}

// ---------- chhote forms (driver ko diye / setting) ----------
const field = (name, label, type = 'number', val = '', extra = '') => `<label>${label}<input name="${name}" type="${type}" ${type === 'number' ? 'inputmode="decimal" step="any"' : ''} value="${esc(val)}" ${extra}></label>`;
function openDriverKhata() {
  const L = driverLedger(), own = isOwner(), lab = { phera: '🚚 Phera', liya: '💵 Driver se liya', diya: '👤 Driver ko diye', salary: '👤 Salary / inaam', kharch: '🧾 Driver ne kharcha kiya' };
  modal('📒 Driver ka khata', `<div class="gx-win dk-win">
    <div class="dk-head ${L.bal > 0 ? 'lena' : L.bal < 0 ? 'dena' : 'saaf'}"><small>${L.bal > 0 ? 'Driver se lena hai' : L.bal < 0 ? 'Driver ko dena hai' : 'Hisaab saaf'}</small><strong>${rs(Math.abs(L.bal))}</strong>
      <span>Har phera: kiraya − kharche − commission · paisa liya to kam · baqaya agle phere ke saath</span></div>
    ${own ? `<div class="gt-btns"><button type="button" class="gt-full" data-dk-get="1">💵 Driver se liya</button><button type="button" data-gr-add="driver">👤 Driver ko diye</button></div>` : ''}
    <div class="dk-list">${L.ev.slice().reverse().slice(0, 80).map(e => `<div class="dk-row ${e.t}"${e.p ? ` data-gp="${esc(e.p.id)}"` : ''}>
      <span class="dk-d">${esc(dmy(e.date))}</span>
      <span class="dk-t">${lab[e.t]}${e.t === 'phera' ? `<small>${esc(e.c.routes.join(' · '))} · kiraya ${rs(e.c.kiraya)} − kharche ${rs(e.c.kh)} − comm ${rs(e.c.comm)}</small>` : ''}${e.old ? '<small>bilty tick / le liya (purana)</small>' : ''}${e.t === 'kharch' ? `<small>${esc(e.r.cat || '')} · extra kharcha (nafe se bhi minus)</small>` : ''}${e.r?.note ? `<small>${esc(e.r.note)}</small>` : ''}</span>
      <span class="dk-a ${e.amt > 0 ? 'plus' : e.amt < 0 ? 'minus' : ''}">${e.amt > 0 ? '+' : e.amt < 0 ? '−' : ''}${rs(Math.abs(e.amt || N(e.r?.amount)))}<small>baqaya ${rs(e.bal)}</small></span>
      ${own && e.r ? `<button type="button" class="gr-x" data-gr-del="${esc(e.r.id)}">✕</button>` : ''}</div>`).join('') || '<p class="gr-empty">Abhi koi hisaab nahi</p>'}</div></div>`);
}
function openDriverGet() {
  const L = driverLedger();
  modal('💵 Driver se paisa liya', `<form id="grForm" class="gr-form"><p class="dk-now">Abhi lena hai: <b>${rs(Math.max(0, L.bal))}</b></p>
    ${field('amount', 'Kitne liye (Rs)', 'number', L.bal > 0 ? Math.round(L.bal) : '', 'required')}<p class="gr-ai" id="dkLeft"></p>
    ${field('date', 'Tareekh', 'date', day || today())}${field('note', 'Note', 'text', '', 'placeholder="jaise: baqi kal dega"')}
    <button type="submit" class="primary">💾 Save</button></form>`);
  const f = $('grForm'), show = () => { const left = r2(L.bal - N(f.elements.amount.value)); $('dkLeft').textContent = left > 0 ? `Baqaya ${rs(left)} — agle phere ke saath jur jayega` : left < 0 ? `${rs(-left)} zyada — driver ko dena ban jayega` : '✓ Hisaab saaf'; };
  f.elements.amount.addEventListener('input', show); show();
  f.onsubmit = e => { e.preventDefault(); const o = Object.fromEntries(new FormData(f)); const amt = N(o.amount); if (!(amt > 0)) return;
    const id = cloud.newGaariId(), d = { kind: 'driver', dir: 'in', date: String(o.date || today()).slice(0, 10), amount: amt, note: String(o.note || '').slice(0, 200), by: uidOf(), byName: byName() || '', at: Date.now() };
    rows.push({ ...d, id }); cloud.putGaari(id, d).catch(er => notice('❌ ' + (er?.message || er))); closeModal();
    const left = r2(L.bal - amt); notice(`✓ ${rs(amt)} liye${left > 0 ? ' · baqaya ' + rs(left) : left < 0 ? ' · driver ko ' + rs(-left) + ' dena' : ' · hisaab saaf'}`); paint(); };
}
function openDriverPay() {
  modal('👤 Driver ko diye', `<form id="grForm" class="gr-form">${field('date', 'Tareekh', 'date', day || today())}${field('amount', 'Raqam (Rs)', 'number', '', 'required')}
    <label>Kis liye?<select name="typ"><option value="adv">Advance / kharche ke paise — driver ke khate mein jurega</option><option value="sal">Salary / inaam — khate se bahar (salary fixed kharche mein pehle se)</option></select></label>
    ${field('note', 'Note', 'text', '', 'placeholder="jaise: toll ke liye"')}<button type="submit" class="primary">💾 Save</button></form>`);
  const f = $('grForm');
  f.onsubmit = e => { e.preventDefault(); const o = Object.fromEntries(new FormData(f)); if (!(N(o.amount) > 0)) return;
    const id = cloud.newGaariId(), d = { kind: 'driver', dir: 'out', sal: o.typ === 'sal', date: String(o.date).slice(0, 10), amount: N(o.amount), note: String(o.note || '').slice(0, 200), by: uidOf(), byName: byName() || '', at: Date.now() };
    rows.push({ ...d, id }); cloud.putGaari(id, d).catch(er => notice('❌ ' + (er?.message || er))); closeModal(); notice('✓ Save'); paint(); };
}
function openCfg() {
  modal('⚙ Gaari setting', `<form id="grCfg" class="gr-form">${field('no', 'Gaari number', 'text', cfg.no || '')}${field('driver', 'Driver ka naam', 'text', cfg.driver || '')}${field('avg', 'Sahi average (km fi litre)', 'number', cfg.avg ?? 5.5)}
    <label>Driver commission<select name="commType"><option value="pct"${cfg.commType !== 'fixed' ? ' selected' : ''}>% kiraya ka</option><option value="fixed"${cfg.commType === 'fixed' ? ' selected' : ''}>Fixed fi bilty (Rs)</option></select></label>
    ${field('commVal', 'Commission (% ya Rs)', 'number', cfg.commVal ?? 10)}
    <div class="gr-2">${field('dieselRate', '⛽ Diesel rate (Rs/L)', 'number', N(cfg.dieselRate) || curRate() || '')}${field('tankL', 'Tanki (litre)', 'number', cfg.tankL ?? 76)}</div>
    <div class="gr-2">${field('qist', '🏦 Gaari ki qist (mahana Rs)', 'number', cfg.qist ?? '')}${field('oilKm', '🛢 Mobil har (km)', 'number', cfg.oilKm ?? 5000)}</div>
    <b>👤 Fixed mahana kharche</b><div id="gfRows" class="gf-rows">${((Array.isArray(cfg.fixed) && cfg.fixed.length) ? cfg.fixed : [{ n: 'Driver salary', a: '' }]).map(x => `<div class="gf-row"><input data-gf="n" type="text" value="${esc(x.n || '')}" placeholder="Naam (jaise driver salary)"><input data-gf="a" type="number" inputmode="decimal" step="any" value="${esc(x.a || '')}" placeholder="Rs"><button type="button" class="gr-x" data-gf-del="1">✕</button></div>`).join('')}</div>
    <button type="button" class="gf-add" data-gf-add="1">＋ Kharcha</button>
    <label class="gp-chk"><input type="checkbox" name="notifyOn"${cfg.notifyOn !== false ? ' checked' : ''}> 🔔 Roz sham notification: "driver se hisaab lena hai"</label>
    ${field('notifyTimes', 'Waqt (comma se)', 'text', (cfg.notifyTimes || ['18:00', '19:30', '21:00']).join(', '))}
    <p class="gr-ai">Notification server PC bhejta hai (app band ho tab bhi) — malik ke phone par Settings mein 🔔 notification ON honi chahiye.</p>
    <b>🧾 Yaad wale kharchon ke naam</b><div class="gk-chips">${kNames().map(n => `<button type="button" class="gk-chip" data-gk-hide="${esc(n)}">${esc(n)} ✕</button>`).join('')}</div>
    <p class="gr-msg"></p><button type="submit" class="primary">💾 Save</button></form>`);
  const f = $('grCfg');
  f.addEventListener('click', e => { if (e.target.closest('[data-gf-add]')) { const r = document.createElement('div'); r.className = 'gf-row'; r.innerHTML = '<input data-gf="n" type="text" placeholder="Naam"><input data-gf="a" type="number" inputmode="decimal" step="any" placeholder="Rs"><button type="button" class="gr-x" data-gf-del="1">✕</button>'; $('gfRows').appendChild(r); r.querySelector('input').focus(); }
    const x = e.target.closest('[data-gf-del]'); if (x) x.closest('.gf-row')?.remove(); });
  f.addEventListener('click', async e => { const b = e.target.closest('[data-gk-hide]'); if (!b) return; const h = new Set(Array.isArray(cfg.hideK) ? cfg.hideK : []); h.add(b.dataset.gkHide); cloud.setGaariConfig({ hideK: [...h].slice(0, 200) }).catch(() => {}); cfg.hideK = [...h]; b.remove(); });
  f.onsubmit = async e => { e.preventDefault(); const o = Object.fromEntries(new FormData(f));
    const times = String(o.notifyTimes || '').split(/[,\s]+/).map(x => x.trim()).filter(x => /^\d{1,2}:\d{2}$/.test(x)).map(x => x.padStart(5, '0')).slice(0, 6);
    const fixed = [...f.querySelectorAll('.gf-row')].map(r => ({ n: String(r.querySelector('[data-gf="n"]').value || '').trim().slice(0, 40), a: N(r.querySelector('[data-gf="a"]').value) })).filter(x => x.n && x.a > 0).slice(0, 20);
    const patch = { no: String(o.no || '').slice(0, 30), driver: String(o.driver || '').slice(0, 40), avg: N(o.avg) || 5.5, commType: o.commType === 'fixed' ? 'fixed' : 'pct', commVal: N(o.commVal), notifyOn: !!o.notifyOn, notifyTimes: times.length ? times : ['18:00', '19:30', '21:00'],
      tankL: N(o.tankL) || 76, qist: N(o.qist), oilKm: N(o.oilKm) || 5000, fixed, updatedAt: Date.now() };
    if (N(o.dieselRate) && N(o.dieselRate) !== curRate()) { patch.dieselRate = r2(N(o.dieselRate)); patch.rateAt = Date.now(); }   // v2.96: naya rate aaj se
    if (patch.avg !== avgOf()) patch.avgHist = avgHistWith(Date.now(), patch.avg);   // nayi average sirf aage ke pheron par
    try { await cloud.setGaariConfig(patch); Object.assign(cfg, patch); closeModal(); notice('✓ Setting save'); paint(); }
    catch (er) { f.querySelector('.gr-msg').textContent = 'Nahi hua: ' + (er?.message || er); } };
}

function makePdf() {
  const s = monthCalc(); if (!pdf) return;
  const line = (a, b) => `<tr><td>${a}</td><td class="iv-n">${b}</td></tr>`;
  pdf(`🚚 Gaari ${cfg.no || ''} — ${monthName(month)}`, `<h1>NOOR TRADERS</h1><h2>Gaari ${esc(cfg.no || '')} — ${esc(day ? day : monthName(month))}${cfg.driver ? ' · Driver: ' + esc(cfg.driver) : ''}</h2>
    <table class="iv-tbl"><tbody>${line('Pheray', s.pheras.length)}${line('Kiraya', rs(s.kiraya))}${line('− Kharche', rs(s.kh))}${line('− Driver commission', rs(s.comm))}${line('− Diesel farzi (' + num(s.shouldL, 1) + ' L)', rs(s.farziRs))}
    ${line('<b>Pheron ki bachat</b>', '<b>' + rs(s.safi) + '</b>')}${s.fixedL.map(x => line('− ' + esc(x.n), rs(x.a))).join('')}${s.tankFarq ? line(s.tankFarq > 0 ? '− Tanki farq (zyada laga)' : '+ Tanki bachat', rs(Math.abs(s.tankFarq))) : ''}${Object.entries(s.extraCat).sort((a, b) => b[1] - a[1]).map(([n, v]) => line('− Extra: ' + esc(n), rs(v))).join('')}${s.qist ? line('− Qist (' + rs(s.qistPaid) + ' pura, ' + rs(s.qistBaqi) + ' baqi)', rs(s.qist)) : ''}
    ${line('<b>' + (s.nafa >= 0 ? 'NAFA' : 'GHATA') + '</b>', '<b>' + rs(Math.abs(s.nafa)) + '</b>')}${line('Km (meter / Falcon)', num(s.km) + ' / ' + (s.tk ? num(s.tk) : '—'))}${line('Asal diesel dalwaya', rs(s.fillRs))}${line('Average', s.realAvg ? num(s.realAvg, 2) + ' (setting ' + num(avgOf(), 2) + ')' : num(avgOf(), 2) + ' (setting)')}${(() => { const L = driverLedger(); return line(L.bal >= 0 ? 'Driver se lena (kul baqaya)' : 'Driver ko dena', rs(Math.abs(L.bal))); })()}${line('Commission (driver ne rakhi)', rs(s.comm))}</tbody></table>
    <table class="iv-tbl"><thead><tr><th>Tareekh</th><th>Biltiyan</th><th>Kharche</th><th>Km</th><th>Diesel</th><th>Nafa</th></tr></thead><tbody>
    ${s.pheras.map(p => { const c = pc(p); return `<tr><td>${esc(p.date)}</td><td>${(p.bilties || []).map(b => `${esc(b.from)}→${esc(b.to)} ${rs(b.kiraya)}${b.col ? '' : ' (lena)'}`).join('<br>')}</td><td>${(p.kharche || []).map(k => esc(k.n) + ' ' + num(k.a)).join('<br>')}<br><b>${rs(c.kh)}</b></td><td class="iv-n">${num(c.km)}${c.tk ? '<br>trk ' + num(c.tk) : ''}${c.kmOk ? '' : ' ❌'}</td><td class="iv-n">farzi ${num(c.shouldL, 1)} L<br>${rs(c.shouldRs)}${c.dL ? '<br>asal ' + num(c.dL, 1) + ' L' : ''}</td><td class="iv-n"><b>${rs(c.nafa)}</b></td></tr>`; }).join('')}</tbody></table>
    ${s.extraL.length ? `<table class="iv-tbl"><thead><tr><th>Tareekh</th><th>Extra kharcha</th><th>Note</th><th>Rs</th></tr></thead><tbody>${s.extraL.slice().reverse().map(r => `<tr><td>${esc(r.date)}</td><td>${r.oil ? '🛢 ' : ''}${esc(r.cat || 'Doosra')}${r.driver ? ' (driver ki jeb)' : ''}</td><td>${esc(r.note || '')}</td><td class="iv-n">${rs(r.amount)}</td></tr>`).join('')}<tr><td colspan="3"><b>Kul extra (NAFA se minus)</b></td><td class="iv-n"><b>${rs(s.extra)}</b></td></tr></tbody></table>` : ''}
    <table class="iv-tbl"><thead><tr><th>Kharcha (phere)</th><th>Kul</th></tr></thead><tbody>${Object.entries(s.cat).sort((a, b) => b[1] - a[1]).map(([a, b]) => line(esc(a), rs(b))).join('')}</tbody></table>`);
}

document.addEventListener('click', e => {
  if (!mounted) return;
  const col = e.target.closest?.('[data-gcol]'); if (col) { const [pid, bid] = col.dataset.gcol.split('|'); const p = rows.find(r => r.id === pid); const b = p?.bilties?.find(x => x.id === bid);
    if (b) { b.col = true; b.colAt = Date.now(); const data = { ...p }; delete data.id; cloud.putGaari(pid, data).catch(er => notice('❌ ' + (er?.message || er))); col.closest('.gr-row')?.remove(); notice('✓ ' + rs(b.kiraya) + ' le liya'); if (!cur) paint(); } return; }
  if ($('dialog')?.contains(e.target) && e.target.closest?.('#gpPage')) return;   // phera page apna click khud sambhalta hai
  const gpc = e.target.closest?.('[data-gp]'); if (gpc) { if ($('dialog')?.open) closeModal(); setTimeout(() => openPhera(gpc.dataset.gp), 30); return; }
  if (e.target.closest?.('[data-gp-new]')) { newPhera(); return; }
  const gd = e.target.closest?.('[data-gd]'); if (gd) { e.preventDefault(); day = gd.dataset.gd === day ? '' : gd.dataset.gd; paint(); return; }
  const m = e.target.closest?.('[data-gr-m]'); if (m) { shiftMonth(Number(m.dataset.grM)); return; }
  const o = e.target.closest?.('[data-gr-open]'); if (o) { openDetail(o.dataset.grOpen); return; }
  if (e.target.closest?.('[data-gr-add="driver"]')) { if (isOwner()) openDriverPay(); return; }
  if (e.target.closest?.('[data-gr-add="extra"]')) { if (isOwner()) openExtra(); return; }
  const gxe = e.target.closest?.('[data-gx-edit]'); if (gxe) { if (isOwner()) openExtra(gxe.dataset.gxEdit); return; }
  if (e.target.closest?.('[data-gr-cfg]')) { if (isOwner()) openCfg(); return; }
  if (e.target.closest?.('[data-gr-pdf]')) { makePdf(); return; }
  if (e.target.closest?.('[data-gt-open]')) { openTank(); return; }
  if (e.target.closest?.('[data-dk-get]')) { if (isOwner()) openDriverGet(); return; }
  const gf = e.target.closest?.('[data-gt-fill]'); if (gf) { openFill(gf.dataset.gtFill === 'full'); return; }
  const gm = e.target.closest?.('[data-gt-mark]'); if (gm) { markCycle(gm.dataset.gtMark); return; }
  const x = e.target.closest?.('[data-gr-del]'); if (x) { if (!confirm('Ye entry hata dein?')) return; rows = rows.filter(r => r.id !== x.dataset.grDel); cloud.delGaari(x.dataset.grDel).catch(er => notice('Nahi hua: ' + (er?.message || er))); const inX = !!x.closest('.xk-win'); x.closest('.gr-row')?.remove(); if (inX) { paint(); setTimeout(openExtraList, 30); } }
});
