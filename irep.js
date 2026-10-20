// irep.js — v2.99.81: 📊 ITEM SALE REPORT (sirf malik) — kaun si item kab bikti hai, kitna nafa, kin dino / hafton mein zyada.
// Malik: "poore month ka actual data: 1–10, 10–20, 20–30, poora mahina, week wise · har item · pattern · nafa · chart, click par aage data".
// Data: PC item-report.js (sales-stats ke saath har ghante) -> posStats/irep-meta + irep-<k>. 3 calendar mahine, har item har din:
//   d: [[dayIdx, ginti, Rs, wholesale ginti, wholesale Rs]] · c = fi piece khareed (ABHI ka rate — purane din ka nafa andaza).
// Screen: mahina + waqt chips (1–10 / 11–20 / 21–31 / poora / hafta 1–5 / apni tareekh) · wholesale saath / baghair · KPI ·
//   charts (top items, hafta-war, din-war, mahine ke hisse, roz ki sale) — har bar par tap = aage tafseel · patterns · saari items ki table · PDF.
// v2.99.83: 💰 COMMISSION — malik items tick kare (blueAccess/commission {items:{id:{r,n}}}, Rs 10 / packet default); PC irep-comm:
//   rows [[dayIdx, supplyManId (0 = bina), itemId, packet]] -> Supply Man wise packet × rate. Setup aur commission ke ilawa app kuch LIKHTI nahi.
// App kuch LIKHTI nahi — sirf parhti hai. Rang: dataviz reference palette (sale = neela, nafa = aqua, ghaata = laal) — style.css .ir-*.
const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = n => new Intl.NumberFormat('en-PK').format(Math.round(Number(n) || 0));
const k1 = n => { n = Number(n) || 0; const a = Math.abs(n); return a >= 1e7 ? (n / 1e7).toFixed(a >= 1e8 ? 0 : 1) + ' cr' : a >= 1e5 ? (n / 1e5).toFixed(a >= 1e6 ? 0 : 1) + ' lac' : a >= 1e3 ? Math.round(n / 1e3) + 'k' : String(Math.round(n)); };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MFULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WD = ['Itwaar', 'Peer', 'Mangal', 'Budh', 'Jumerat', 'Juma', 'Hafta'];
const WD_ORDER = [1, 2, 3, 4, 5, 6, 0];   // Peer se Itwaar
const WD_S = ['Itwr', 'Peer', 'Mngl', 'Budh', 'Jmrt', 'Juma', 'Hfta'];   // chart ke chhote naam (Jumerat / Juma alag)
const p2 = n => String(n).padStart(2, '0');
const toDate = s => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const dayOf = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const short = s => `${+s.slice(8, 10)} ${MONTHS[+s.slice(5, 7) - 1]}`;
const monLabel = m => `${MFULL[+m.slice(5, 7) - 1]} ${m.slice(0, 4)}`;
const lastDay = m => new Date(+m.slice(0, 4), +m.slice(5, 7), 0).getDate();
const isDay = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const pct = (a, b) => b ? Math.round(a / b * 1000) / 10 : 0;

let cloud = null, notice = () => {}, pdfOf = null, stop = null, data = null, err = '', loaded = false, cStop = null, commCfg = {}, cq = '';
let kdoc = null, kStop = null, pcs = null, pcStop = null;   // v2.103.28: 📅 kal ka data (irep-kal) + PC script ka haal
let full = null, tdoc = null, tStop = null, slowT = 0, slow = false;   // v2.103.6: ⚡ aaj ka data (irep-today) alag aata hai, data = full + aaj
const LS = 'sam-irep';
const st = (() => { let v = {}; try { v = JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch {} return { mon: v.mon || '', per: v.per || 'm', from: v.from || '', to: v.to || '', ws: v.ws !== false, sort: v.sort || 'rs', q: '', lim: 60, tsort: v.tsort || 'rs', tq: '', tAll: false, rev: !!v.rev, trev: !!v.trev }; })();   // v2.103.3: ⇅ ulta
const keep = () => { try { localStorage.setItem(LS, JSON.stringify({ mon: st.mon, per: st.per, from: st.from, to: st.to, ws: st.ws, sort: st.sort, tsort: st.tsort, rev: st.rev, trev: st.trev })); } catch {} };

let stockOf = () => null;
export function irepSetup(o) { cloud = o.cloud || cloud; notice = o.notice || notice; pdfOf = o.pdf || pdfOf; stockOf = o.stock || stockOf; }
export function irepStop() { if (stop) { try { stop(); } catch {} stop = null; } if (tStop) { try { tStop(); } catch {} tStop = null; } if (kStop) { try { kStop(); } catch {} kStop = null; } if (pcStop) { try { pcStop(); } catch {} pcStop = null; } clearTimeout(slowT); slowT = 0; if (cStop) { try { cStop(); } catch {} cStop = null; } }
function watch() {
  if (!cStop && cloud?.listenCommission) cStop = cloud.listenCommission(m => { commCfg = m || {}; if ($('irRoot')) paint(); if (document.querySelector('.ir-cset')) commSetPaint(); });
  if (!tStop && cloud?.listenItemToday) tStop = cloud.listenItemToday(t => { tdoc = t; remerge(); });
  if (!kStop && cloud?.listenItemKal) kStop = cloud.listenItemKal(t => { kdoc = t; remerge(); });
  if (!pcStop && cloud?.listenPcStatus) { try { pcStop = cloud.listenPcStatus(d => { pcs = d; if ($('irRoot')) paint(); }); } catch {} }
  if (stop || !cloud?.listenItemReport) return;
  slow = false; clearTimeout(slowT); slowT = setTimeout(() => { if (!loaded) { slow = true; if ($('irRoot')) paint(); } }, 10000);   // v2.103.6: 📶 hamesha ghoomta na rahe
  stop = cloud.listenItemReport((d, e) => { loaded = true; clearTimeout(slowT); if (d) { full = d; err = ''; remerge(); return; } err = e?.code || e?.message || 'masla'; if ($('irRoot')) paint(); });
}
function remerge() { data = mergeToday(mergeToday(full, kdoc), tdoc); ix = null; if (data) loaded = true; if ($('irRoot')) paint(); }
// v2.103.6: ⚡ poori report (har ghante) + aaj ka hissa (har 10 min). Aaj ka doc naya ho to us din ki lines us se badal do.
function mergeToday(F, T) {
  if (!T?.day || !Array.isArray(T.items) || !isDay(T.day)) return F;
  if (F?.meta && Number(F.meta.at) >= Number(T.at) && (F.meta.days || []).includes(T.day)) return F;   // poori report hi nayi hai
  const days = (F?.meta?.days || []).slice();
  if (days.length && T.day < days[0]) return F;
  let k = days.indexOf(T.day);
  if (k < 0) { const last = days[days.length - 1]; if (last) { const d = toDate(last); for (let n = 0; n < 7; n++) { d.setDate(d.getDate() + 1); const s = dayOf(d); if (s >= T.day) break; days.push(s); } } days.push(T.day); k = days.length - 1; }
  const M = new Map();
  for (const it of F?.items || []) M.set(String(it.i), { ...it, d: (it.d || []).filter(x => x[0] !== k) });
  for (const t of T.items) { if (!t || t.i == null) continue; const e = M.get(String(t.i)) || { i: t.i, n: t.n, c: t.c, pk: t.pk, d: [] }; if (!M.has(String(t.i))) M.set(String(t.i), e);
    e.d.push(t.wq || t.wrs ? [k, Number(t.q) || 0, Number(t.rs) || 0, Number(t.wq) || 0, Number(t.wrs) || 0] : [k, Number(t.q) || 0, Number(t.rs) || 0]); e.d.sort((a, b) => a[0] - b[0]); }
  const items = [...M.values()].filter(e => e.d.length);
  let comm = F?.comm || null;
  if (T.comm) { const men = new Map((comm?.men || []).map(x => [Number(x[0]), x])); for (const x of T.comm.men || []) if (!men.has(Number(x[0]))) men.set(Number(x[0]), x);
    comm = { ...(comm || {}), ids: comm?.ids || [], men: [...men.values()], rows: [...(comm?.rows || []).filter(r => r[0] !== k), ...(T.comm.rows || []).map(r => [k, r[0], r[1], r[2]])] }; }
  return { ...(F || {}), meta: { ...(F?.meta || { from: T.day, n: items.length }), days, to: days[days.length - 1], at: Number(F?.meta?.at) || 0, tAt: Number(T.at) || 0, tDay: T.day }, items, comm };
}

// ---------- hisaab ----------
let ix = null;   // data se bana index (har data par naya)
function index() {
  if (ix && ix.src === data) return ix;
  const days = data?.meta?.days || [], di = new Map(days.map((d, i) => [d, i]));
  const mons = [...new Set(days.map(d => d.slice(0, 7)))];
  ix = { src: data, days, di, mons, items: data?.items || [] };
  return ix;
}
const today = () => dayOf(new Date());
function monthOf() { const X = index(); if (!X.mons.includes(st.mon)) st.mon = X.mons[X.mons.length - 1] || today().slice(0, 7); return st.mon; }
// waqt -> [se, tak] (tak shamil)
const PERS = [['p1', '1–10'], ['p2', '11–20'], ['p3', '21–31'], ['m', 'Poora mahina'], ['w1', 'Hafta 1'], ['w2', 'Hafta 2'], ['w3', 'Hafta 3'], ['w4', 'Hafta 4'], ['w5', 'Hafta 5'], ['c', '📅 Apni tareekh']];
function partRange(m, per) {
  const L = lastDay(m), d = n => `${m}-${p2(Math.min(L, n))}`;
  if (per === 'p1') return [d(1), d(10)]; if (per === 'p2') return [d(11), d(20)]; if (per === 'p3') return [d(21), d(L)];
  const w = /^w([1-5])$/.exec(per); if (w) { const a = (+w[1] - 1) * 7 + 1; return a > L ? null : [d(a), d(+w[1] === 5 ? L : a + 6)]; }
  return [d(1), d(L)];
}
function range() {
  const m = monthOf();
  if (st.per === 'c' && isDay(st.from) && isDay(st.to)) return st.from <= st.to ? [st.from, st.to] : [st.to, st.from];
  return partRange(m, st.per === 'c' ? 'm' : st.per) || partRange(m, 'm');
}
const clipEnd = b => { const t = today(), last = index().days.slice(-1)[0] || t; return b > last ? last : b; };
// ek item ka [a..b] mein jod — ws = wholesale shamil?
function sumItem(it, a, b) {
  const X = index(), ia = X.di.has(a) ? X.di.get(a) : (a < (X.days[0] || '') ? 0 : X.days.length), ib = X.di.has(b) ? X.di.get(b) : (b < (X.days[0] || '') ? -1 : X.days.length - 1);
  let q = 0, rs = 0;
  for (const x of it.d) { if (x[0] < ia || x[0] > ib) continue; q += st.ws ? x[1] : x[1] - (x[3] || 0); rs += st.ws ? x[2] : x[2] - (x[4] || 0); }
  const cost = (Number(it.c) || 0) * q;
  return { q, rs, cost, pf: rs - cost, noCost: !(Number(it.c) > 0) };
}
function agg(a, b) {
  const rows = []; let T = { q: 0, rs: 0, pf: 0, n: 0, noCost: 0 };
  for (const it of index().items) { const s = sumItem(it, a, b); if (!s.q && !s.rs) continue; rows.push({ it, ...s }); T.q += s.q; T.rs += s.rs; if (!s.noCost) T.pf += s.pf; else T.noCost++; T.n++; }
  return { rows, T };
}
// roz ka jod [a..b]
function perDay(a, b, only) {
  const X = index(), out = [];
  for (let d = toDate(a); dayOf(d) <= b; d.setDate(d.getDate() + 1)) out.push({ day: dayOf(d), rs: 0, pf: 0 });
  const at = new Map(out.map((o, i) => [o.day, i]));
  for (const it of only ? [only] : X.items) for (const x of it.d) { const day = X.days[x[0]], i = at.get(day); if (i == null) continue; const q = st.ws ? x[1] : x[1] - (x[3] || 0), rs = st.ws ? x[2] : x[2] - (x[4] || 0); out[i].rs += rs; out[i].pf += Number(it.c) > 0 ? rs - it.c * q : 0; }
  return out;
}
const numQ = n => new Intl.NumberFormat('en-PK', { maximumFractionDigits: 3 }).format(Math.round((Number(n) || 0) * 1000) / 1000);   // v2.103.3: 0.25 kg = 0 na dikhe
const fmtQty = (q, pk) => { q = Math.round(q * 1000) / 1000; if (pk > 1 && Math.abs(q) >= pk) { const c = Math.trunc(q / pk), p = Math.round((q - c * pk) * 1000) / 1000; return `${num(c)} ctn${p ? ' + ' + numQ(p) : ''}`; } return numQ(q) + ' pcs'; };

// ---------- chart (SVG, bina library) ----------
// cols: [{label, a (sale), b (nafa), act, sub}] — sale + nafa saath saath, aik hi axis. Tap = act (aage tafseel).
function colChart(cols, { h = 150, unit = '', dense = false, one = false } = {}) {
  if (!cols.length) return '';
  const max = Math.max(1, ...cols.map(c => Math.max(c.a, c.b, 0))), W = 100 / cols.length;
  return `<div class="ir-cc${dense || cols.length > 12 ? ' dense' : ''}${one ? ' one' : ''}" style="--n:${cols.length}">${cols.map(c => { const ha = Math.max(0, c.a) / max * 100, hb = Math.max(0, c.b) / max * 100, neg = c.b < 0;
    return `<button type="button" class="ir-col" ${c.act || ''} title="${esc(c.label)} · ${one ? '' : 'sale '}Rs ${num(c.a)}${one ? '' : ' · nafa Rs ' + num(c.b)}"><span class="ir-v">${k1(c.a)}</span><span class="ir-bars" style="height:${h}px"><i class="${one ? 'p' : 's'}" style="height:${ha}%"></i>${one ? '' : `<i class="${neg ? 'l' : 'p'}" style="height:${neg ? 6 : hb}%"></i>`}</span><span class="ir-lab">${esc(c.label)}</span>${c.sub ? `<small>${esc(c.sub)}</small>` : ''}</button>`; }).join('')}</div>${unit ? `<p class="ir-unit">${esc(unit)}</p>` : ''}`;
}
const legend = () => '<div class="ir-leg"><span><i class="s"></i>Sale</span><span><i class="p"></i>Nafa</span><span><i class="l"></i>Ghaata</span></div>';
// top items: list-chart (naam + sale bar + nafa hissa), tap = item ki poori kahani
// v2.101.5: 🏆 SAARI ITEMS (malik: "yahan tamam items chahiye" + "nafa % ke ilawa Rupees mein, sum amount ke saath") — pehle top 12,
//   "⬇️ Saari N items" = isi chart mein sab; 🔍 search (asal rank #), tarteeb Sale / Nafa / Nafa % / Ginti; har item: sale Rs · nafa Rs (%) ·
//   fi pc nafa; jitni list mein hon un ka JAMA (sale Rs + nafa Rs). Nafa = sale − (abhi ka khareed rate × ginti) — andaza.
const TSORT = { pp: (x, y) => (perPc(y) ?? -1e15) - (perPc(x) ?? -1e15), n: (x, y) => String(y.it.n).localeCompare(String(x.it.n)), rs: (x, y) => y.rs - x.rs, pf: (x, y) => (y.noCost ? -1e15 : y.pf) - (x.noCost ? -1e15 : x.pf), pm: (x, y) => (y.noCost ? -1e9 : pct(y.pf, y.rs)) - (x.noCost ? -1e9 : pct(x.pf, x.rs)), q: (x, y) => y.q - x.q };
const qHit = (n, q) => { const L = String(n || '').toLowerCase(); return String(q || '').toLowerCase().split(/\s+/).filter(Boolean).every(t => L.includes(t)); };
// v2.103.3: ⇅ ulta (kam se zyada / Z–A ka ulta = A–Z) — naam par seedha A–Z
const sorter = (k, rev) => { const f = TSORT[k] || TSORT.rs, up = k === 'n' ? !rev : rev; return up ? (x, y) => f(y, x) : f; };
const SORTS = [['rs', 'Sale'], ['pf', 'Nafa Rs'], ['pm', 'Nafa %'], ['pp', 'Fi pc nafa'], ['q', 'Ginti'], ['n', 'Naam A–Z']];
const perPc = r => !r.noCost && r.q > 0 ? r.rs / r.q - (Number(r.it.c) || 0) : null;
function itemLine(r, rank, max, metric) {
  const v = metric === 'pf' ? Math.max(0, r.pf) : metric === 'q' ? r.q : r.rs, w = Math.max(2, v / Math.max(1, max) * 100), pw = r.rs > 0 && r.pf > 0 ? Math.min(100, r.pf / r.rs * 100) : 0, pp = perPc(r);
  return `<button type="button" class="ir-tr${!r.noCost && r.pf < 0 ? ' loss' : ''}" data-ir-item="${esc(String(r.it.i))}"><span class="ir-rk">${rank}</span><span class="ir-tn"><b>${esc(r.it.n)}</b><i class="ir-tb${metric === 'pf' ? ' pf' : ''}" style="width:${w}%"><u style="width:${metric === 'pf' ? 100 : pw}%"></u></i><small>${fmtQty(r.q, r.it.pk)}${pp != null ? ` · fi pc nafa Rs ${num(pp)}` : ''}${r.noCost ? ' · khareed rate nahi' : ''}</small></span><span class="ir-ta"><b>Rs ${num(r.rs)}</b><small class="${r.noCost ? '' : r.pf < 0 ? 'neg' : 'pos'}">${r.noCost ? 'nafa —' : `nafa Rs ${num(r.pf)} · ${pct(r.pf, r.rs)}%`}</small></span></button>`;
}
const revLbl = (k, rev) => k === 'n' ? (rev ? 'Z–A' : 'A–Z') : rev ? '⬆ Kam pehle' : '⬇ Zyada pehle';
function sortBar(chips, attr, cur, rattr, rev) { return `<div class="ir-sortb">${chips(SORTS, attr, k => k === cur)}<button type="button" class="rc ir-rev${rev ? ' on' : ''}" ${rattr}="${rev ? 0 : 1}">⇅ ${revLbl(cur, rev)}</button></div>`; }
function topHTML() {
  const all = (lastRows?.sorted || []).slice().sort(sorter(st.tsort, st.trev)), rank = new Map(all.map((r, i) => [r, i + 1]));
  const q = st.tq.trim(), list = q ? all.filter(r => qHit(r.it.n, q)) : all, shown = q || st.tAll ? list : list.slice(0, 12);
  const metric = st.tsort === 'pf' || st.tsort === 'pp' ? 'pf' : st.tsort === 'q' ? 'q' : 'rs', max = Math.max(1, ...shown.map(r => metric === 'pf' ? r.pf : metric === 'q' ? r.q : r.rs));
  const S = shown.reduce((o, r) => { o.rs += r.rs; if (!r.noCost) { o.pf += r.pf; o.rc += r.rs; } return o; }, { rs: 0, pf: 0, rc: 0 });
  return `<div class="ir-tsum"><span><small>${q ? `🔍 ${num(list.length)} mili` : st.tAll ? `Saari ${num(list.length)} items` : `Top ${shown.length} (kul ${num(all.length)})`}</small><b>Sale Rs ${num(S.rs)}</b></span><span><small>Nafa (Rs)</small><b class="${S.pf < 0 ? 'neg' : 'pos'}">Rs ${num(S.pf)}</b></span><span><small>Nafa %</small><b>${pct(S.pf, S.rc)}%</b></span></div>
    <div class="ir-top">${shown.map(r => itemLine(r, rank.get(r), max, metric)).join('') || '<div class="nt-empty">🔍<b>Kuch nahi mila</b></div>'}</div>
    ${q ? '' : all.length > 12 ? `<button type="button" class="sh-wide ir-tall" data-ir-tall="${st.tAll ? 0 : 1}">${st.tAll ? '▴ Sirf top 12' : `⬇️ Saari ${num(all.length)} items dikhao`}</button>` : ''}`;
}
// v2.101.5: 💰 NAFA KAHAN SE AA RAHA HAI — kul nafa Rs, retail / wholesale alag, kitni items se kitna nafa, top hissa, ghaata, khareed rate nahi
function wsSplit(a, b) {
  const X = index(), ia = X.di.has(a) ? X.di.get(a) : (a < (X.days[0] || '') ? 0 : X.days.length), ib = X.di.has(b) ? X.di.get(b) : (b < (X.days[0] || '') ? -1 : X.days.length - 1);
  const o = { r: { rs: 0, pf: 0 }, w: { rs: 0, pf: 0 } };
  for (const it of X.items) { const c = Number(it.c) || 0; for (const x of it.d) { if (x[0] < ia || x[0] > ib) continue; const wq = x[3] || 0, wr = x[4] || 0, rq = x[1] - wq, rr = x[2] - wr;
    o.r.rs += rr; o.w.rs += wr; if (c > 0) { o.r.pf += rr - c * rq; o.w.pf += wr - c * wq; } } }
  return o;
}
function nafaHTML(rows, T, a, b) {
  const has = rows.filter(r => !r.noCost), plus = has.filter(r => r.pf > 0).sort((x, y) => y.pf - x.pf), loss = has.filter(r => r.pf < 0).sort((x, y) => x.pf - y.pf), none = rows.filter(r => r.noCost).sort((x, y) => y.rs - x.rs);
  const P = plus.reduce((s, r) => s + r.pf, 0), L = loss.reduce((s, r) => s + r.pf, 0), NR = none.reduce((s, r) => s + r.rs, 0);
  let cum = 0, k80 = 0; for (const r of plus) { cum += r.pf; k80++; if (cum >= P * 0.8) break; }
  const top10 = plus.slice(0, 10).reduce((s, r) => s + r.pf, 0), W = wsSplit(a, b), maxP = Math.max(1, ...plus.slice(0, 10).map(r => r.pf));
  return `<section class="ir-sec ir-nafa"><div class="ir-sh"><b>💰 Nafa kahan se aa raha hai <small>(andaza — aaj ke rate se)</small></b><small>Rupees mein · tap = item</small></div>
    <div class="ir-tsum big"><span><small>Kul sale</small><b>Rs ${num(T.rs)}</b></span><span><small>Kul nafa</small><b class="${T.pf < 0 ? 'neg' : 'pos'}">Rs ${num(T.pf)}</b></span><span><small>Nafa %</small><b>${pct(T.pf, T.rs - NR)}%</b></span></div>
    ${st.ws ? `<div class="ir-split"><div><small>🛍 Retail (counter)</small><b class="pos">Rs ${num(W.r.pf)}</b><span>sale Rs ${num(W.r.rs)} · ${pct(W.r.pf, W.r.rs)}%</span></div><div><small>📦 Wholesale</small><b class="pos">Rs ${num(W.w.pf)}</b><span>sale Rs ${num(W.w.rs)} · ${pct(W.w.pf, W.w.rs)}%</span></div></div>` : '<p class="lk-note">Wholesale ke baghair dekh rahe hain — upar "📦 Wholesale ke saath" se retail / wholesale alag nafa.</p>'}
    ${plus.length ? `<p class="ir-say">📌 Kul nafa ka <b>${pct(top10, P)}%</b> (Rs ${num(top10)}) sirf <b>top ${Math.min(10, plus.length)} items</b> se · 80% nafa <b>${num(k80)} items</b> se · nafa dene wali kul <b>${num(plus.length)}</b> items.</p>` : ''}
    <h5>🥇 Sab se zyada nafa (Rs) — kul nafa mein hissa</h5>
    <div class="ir-top">${plus.slice(0, 10).map((r, i) => `<button type="button" class="ir-tr" data-ir-item="${esc(String(r.it.i))}"><span class="ir-rk">${i + 1}</span><span class="ir-tn"><b>${esc(r.it.n)}</b><i class="ir-tb pf" style="width:${Math.max(2, r.pf / maxP * 100)}%"><u style="width:100%"></u></i><small>sale Rs ${num(r.rs)} · ${fmtQty(r.q, r.it.pk)}${perPc(r) != null ? ' · fi pc Rs ' + num(perPc(r)) : ''}</small></span><span class="ir-ta"><b class="pos">Rs ${num(r.pf)}</b><small>${pct(r.pf, P)}% hissa · ${pct(r.pf, r.rs)}%</small></span></button>`).join('')}</div>
    <button type="button" class="sh-wide" data-ir-tnafa="1">📋 Saari items nafa (Rs) ke hisaab se</button>
    ${loss.length ? `<details class="ir-det neg" open><summary>🔻 Ghaate wali ${num(loss.length)} items — kul ghaata <b>Rs ${num(Math.abs(L))}</b></summary><div class="ir-top">${loss.map((r, i) => itemLine(r, i + 1, Math.max(1, ...loss.map(x => x.rs)), 'rs')).join('')}</div><p class="lk-note">Bechne ka rate khareed (abhi ka) se kam — ya POS mein khareed rate ghalat / purana.</p></details>` : '<p class="lk-note">✓ Is arse mein koi item ghaate mein nahi.</p>'}
    ${none.length ? `<details class="ir-det"><summary>⚠️ ${num(none.length)} items ka khareed rate POS mein nahi — sale Rs ${num(NR)} ka nafa nahi gina</summary><div class="ir-top">${none.map((r, i) => itemLine(r, i + 1, Math.max(1, ...none.map(x => x.rs)), 'rs')).join('')}</div><p class="lk-note">POS mein in ka khareed (Purchase) rate daal dein — agle ghante nafa khud aa jayega.</p></details>` : ''}
    <p class="lk-note">Nafa = bechne ki raqam − (POS mein item ka ABHI ka khareed rate × ginti). Andaza: pehle sasta / mehnga liya tha to asal thora mukhtalif.</p></section>`;
}

// ---------- patterns (poora mahina, aaj tak) ----------
function patterns(m) {
  const L = lastDay(m), t = today(), endD = (m === t.slice(0, 7)) ? +t.slice(8, 10) : L;
  const parts = [[1, Math.min(10, endD)], [11, Math.min(20, endD)], [21, endD]].map(([a, b]) => ({ a, b, n: Math.max(0, b - a + 1) }));
  const wdN = [0, 0, 0, 0, 0, 0, 0]; for (let d = 1; d <= endD; d++) wdN[toDate(`${m}-${p2(d)}`).getDay()]++;
  const X = index(), out = { part: [[], [], []], wd: [[], [], [], [], [], [], []], thin: [], loss: [], up: [], down: [] };
  const a = `${m}-01`, b = `${m}-${p2(endD)}`;
  const pm = X.mons[X.mons.indexOf(m) - 1];
  const all = agg(a, b).rows.sort((x, y) => y.rs - x.rs);
  const big = all.slice(0, 120).filter(r => r.rs > 0);
  for (const r of big) {
    const pd = perDay(a, b, r.it), tot = pd.reduce((s, x) => s + x.rs, 0); if (tot <= 0) continue;
    const avg = tot / endD;
    const pr = parts.map(p => p.n ? pd.slice(p.a - 1, p.b).reduce((s, x) => s + x.rs, 0) / p.n : 0);
    const okP = parts.map((p, i) => i).filter(i => parts[i].n >= 3), bi = pr.indexOf(Math.max(...okP.map(i => pr[i])));   // baqi hisson ki ausat se muqabla (adhoora mahina bhi)
    if (okP.length >= 2 && okP.includes(bi)) { const oth = okP.filter(i => i !== bi), oa = oth.reduce((s2, i) => s2 + pr[i], 0) / oth.length; if (pr[bi] >= oa * 1.6 && pr[bi] > 0) out.part[bi].push({ r, x: oa ? pr[bi] / oa : 9 }); }
    const wr = [0, 0, 0, 0, 0, 0, 0]; pd.forEach(x => { wr[toDate(x.day).getDay()] += x.rs; });
    const wa = wr.map((v, i) => wdN[i] ? v / wdN[i] : 0), wi = wa.indexOf(Math.max(...wa)), wo = wa.filter((v, i) => i !== wi && wdN[i]), woA = wo.length ? wo.reduce((s2, v) => s2 + v, 0) / wo.length : 0;
    if (wdN[wi] >= 2 && wa[wi] >= woA * 1.8 && wa[wi] > 0) out.wd[wi].push({ r, x: woA ? wa[wi] / woA : 9 });
    if (r.rs >= 5000 && !r.noCost && r.pf >= 0 && pct(r.pf, r.rs) < 5) out.thin.push({ r, x: pct(r.pf, r.rs) });
    if (!r.noCost && r.pf < 0) out.loss.push({ r, x: r.pf });
    if (pm) { const pL = lastDay(pm), prev = sumItem(r.it, `${pm}-01`, `${pm}-${p2(pL)}`).rs / pL; if (prev > 0) { const ch = (avg - prev) / prev; if (ch >= 0.3 && r.rs >= 3000) out.up.push({ r, x: ch }); else if (ch <= -0.3) out.down.push({ r, x: ch }); } else if (r.rs >= 5000) out.up.push({ r, x: 9 }); }
  }
  for (const k of ['thin', 'loss']) out[k].sort((x, y) => k === 'loss' ? x.x - y.x : y.r.rs - x.r.rs);
  out.up.sort((x, y) => y.r.rs - x.r.rs); out.down.sort((x, y) => y.r.rs - x.r.rs);
  return { out, parts, endD, pm };
}
const pchip = (r, txt) => `<button type="button" class="ir-pc" data-ir-item="${esc(String(r.it.i))}"><b>${esc(r.it.n)}</b><small>${esc(txt)}</small></button>`;

// ---------- 💰 commission ----------
const cRate = id => Number(commCfg[String(id)]?.r) || 0;
function commAgg(a, b) {
  const X = index(), C = data?.comm; if (!C || !Object.keys(commCfg).length) return null;
  const ia = X.di.has(a) ? X.di.get(a) : (a < (X.days[0] || '') ? 0 : X.days.length), ib = X.di.has(b) ? X.di.get(b) : (b < (X.days[0] || '') ? -1 : X.days.length - 1);
  const names = new Map((C.men || []).map(([id, n]) => [Number(id), n])), per = new Map(); let tq = 0, trs = 0;
  for (const [d, m, it, q] of C.rows || []) { if (d < ia || d > ib) continue; const r = cRate(it); if (!r) continue;
    const o = per.get(m) || { id: m, name: m ? (names.get(m) || 'SP Man ' + m) : 'Bina SP Man', q: 0, rs: 0, items: new Map(), days: new Map() };
    o.q += q; o.rs += q * r; o.items.set(it, (o.items.get(it) || 0) + q); o.days.set(d, (o.days.get(d) || 0) + q * r); per.set(m, o); tq += q; trs += q * r; }
  const miss = Object.keys(commCfg).filter(id => !(C.ids || []).map(String).includes(id));
  return { men: [...per.values()].sort((x, y) => (y.id ? 1 : 0) - (x.id ? 1 : 0) || y.rs - x.rs), tq, trs, miss };
}
const cName = id => commCfg[String(id)]?.n || index().items.find(x => String(x.i) === String(id))?.n || 'Item ' + id;
function commHTML(a, b) {
  const nItems = Object.keys(commCfg).length;
  if (!nItems) return `<section class="ir-sec ir-comm"><div class="ir-sh"><b>💰 Commission — Supply Man wise</b></div><p class="lk-note">Jin items par fi packet commission hai (jaise Biryani 100g, Qorma 100g — Rs 10) un ko tick karein — phir har larke ka packet × Rs = commission yahan.</p><button type="button" class="sh-wide" data-ir-cset="1">💰 Commission items chunein</button></section>`;
  const C = commAgg(a, b);
  const head = `<div class="ir-sh"><b>💰 Commission — Supply Man wise</b><button type="button" class="ir-cbtn" data-ir-cset="1">⚙️ ${nItems} items</button></div>`;
  if (!C) return `<section class="ir-sec ir-comm">${head}<p class="lk-note">⏳ PC agle ghante tak in items ka Supply Man wise data bhejega.</p></section>`;
  const max = Math.max(1, ...C.men.map(m => m.rs));
  return `<section class="ir-sec ir-comm">${head}
    <div class="ir-ctot"><div><b>Rs ${num(C.trs)}</b><small>kul commission</small></div><div><b>${num(C.tq)}</b><small>packet</small></div><div><b>${C.men.filter(m => m.id).length}</b><small>larke</small></div></div>
    <div class="ir-top">${C.men.map(m => `<button type="button" class="ir-tr" data-ir-man="${m.id}"><span class="ir-rk">${m.id ? '👦' : '❔'}</span><span class="ir-tn"><b>${esc(m.name)}</b><i class="ir-tb ir-cb" style="width:${Math.max(2, m.rs / max * 100)}%"></i><small>${num(m.q)} packet · ${[...m.items].sort((x, y) => y[1] - x[1]).slice(0, 3).map(([it, q]) => esc(cName(it).replace(/\s+\d+\s*g(m|ram)?\b/i, '')) + ' ' + num(q)).join(' · ')}</small></span><b class="ir-ta">Rs ${num(m.rs)}</b></button>`).join('') || '<div class="nt-empty">🧾<b>In tareekhon mein in items ki sale nahi</b></div>'}</div>
    ${C.miss.length ? `<p class="lk-note">⏳ ${C.miss.length} naye item ka data PC agle ghante tak bhejega.</p>` : ''}
    <p class="lk-note">Packet = POS ki ginti (wapas aaye minus, cancel / Noor Traders ke andar ke bill bahar). Rate: ⚙️ mein har item ka.</p></section>`;
}
function manDlg(id) {
  const [a, b0] = range(), b = clipEnd(b0), C = commAgg(a, b), m = C?.men.find(x => String(x.id) === String(id)); if (!m) return;
  const X = index(), dcols = [...m.days].sort((x, y) => x[0] - y[0]).map(([d, rs]) => ({ label: String(+X.days[d].slice(8)), a: rs, b: 0 }));
  dlg('💰 ' + m.name, `<div class="ir-hero"><small>${esc(short(a))} – ${esc(short(b))}</small><strong>Rs ${num(m.rs)}</strong><span>commission · ${num(m.q)} packet</span></div>
    <section class="ir-sec"><div class="ir-sh"><b>Item-wise</b></div><div class="ir-tbl">${[...m.items].sort((x, y) => y[1] - x[1]).map(([it, q]) => `<div class="ir-row"><span><b>${esc(cName(it))}</b><small>Rs ${num(cRate(it))} / packet</small></span><span class="ir-num"><b>${num(q)} packet</b><small class="pos">Rs ${num(q * cRate(it))}</small></span></div>`).join('')}</div></section>
    ${dcols.length ? `<section class="ir-sec"><div class="ir-sh"><b>📈 Din-war commission</b></div><div class="ir-scroll">${colChart(dcols, { h: 110, one: true, unit: 'Har din ka commission (Rs) — bar chhoo kar raqam' })}</div></section>` : ''}`);
}
// ⚙️ commission items — malik: tick + rate (default Rs 10)
function commHitsHTML() {
  const qn = cq.trim().toLowerCase(), hits = qn.length < 2 ? [] : index().items.filter(x => !commCfg[String(x.i)] && x.n.toLowerCase().includes(qn)).slice(0, 20);
  return hits.map(x => `<button type="button" class="ir-row" data-ir-cadd="${esc(String(x.i))}"><span><b>${esc(x.n)}</b></span><span class="ir-num"><b>➕ Rs 10</b></span></button>`).join('');
}
function commSetHTML() {
  const cur = Object.entries(commCfg), qn = cq.trim().toLowerCase();
  return `<div class="ir-sec ir-cset"><p class="ir-say">Jin items par <b>fi packet commission</b> hai un ko yahan jorein. Rate badalne ke liye khana chhoo kar likhein.</p>
    <div class="ir-tbl">${cur.map(([id, v]) => `<div class="ir-row"><span><b>${esc(v.n || cName(id))}</b><small>Rs / packet</small></span><span class="ir-crow"><input type="number" inputmode="decimal" min="0" step="0.5" value="${esc(String(v.r))}" data-ir-crate="${esc(id)}"><button type="button" class="ir-cx" data-ir-cdel="${esc(id)}">✕</button></span></div>`).join('') || '<p class="lk-note">Abhi koi item nahi.</p>'}</div>
    <label class="hs-search"><input type="search" data-ir-cq="1" placeholder="🔍 item ka naam (jaise biryani)…" value="${esc(cq)}"></label>
    <div class="ir-tbl" id="irCHits">${commHitsHTML()}</div>
    <p class="lk-note">Sirf wahi items dikhti hain jo pichhle 3 mahine mein biki hain.</p></div>`;
}
function commSetPaint() { const el = document.querySelector('.ir-cset'); if (!el) return; const f = document.activeElement?.matches?.('[data-ir-cq]'); el.outerHTML = commSetHTML(); if (f) { const i = document.querySelector('[data-ir-cq]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } } }
async function commSave(next, msg) { if (!cloud?.setCommission) { notice('App update karein'); return; } try { await cloud.setCommission(next); commCfg = next; notice(msg); commSetPaint(); if ($('irRoot')) paint(); } catch (e) { notice('Save nahi hua: ' + (e?.message || e)); } }

// ---------- screen ----------
export function renderIrep() {
  watch();
  $('summary').innerHTML = '<div class="bc-root ir-root" id="irRoot"></div>';
  if ($('list')) $('list').innerHTML = '';
  $('actions').innerHTML = '<button class="got" data-ir-pdf="1">📄 PDF · WhatsApp</button>';
  paint();
}
const agoT = at => { const m = Math.round((Date.now() - at) / 60000); return m < 1 ? 'abhi' : m < 60 ? m + ' min pehle' : m < 1440 ? Math.round(m / 60) + ' ghante pehle' : Math.round(m / 1440) + ' din pehle'; };
function ageText() {   // v2.103.6: ⚡ aaj ka data har 10 min — 40 min se purana = PC ka script ruka
  const at = Number(data?.meta?.at) || 0, tAt = Number(data?.meta?.tAt) || 0, tOk = tAt && data?.meta?.tDay === today();
  // v2.103.28: bari (3 mahine) report 3 ghante se purani = alag khabar + PC script ki aakhri line (pcStatus)
  const big = at && (Date.now() - at) / 60000 > 180 ? ` · ⚠️ 3 mahine wali report ${agoT(at)}${(() => { const r = (pcs?.services || []).find(x => /sales-stats/.test(String(x.script || ''))); return r?.log ? ` — PC: "${String(r.log).slice(0, 80)}"` : ''; })()}` : '';
  if (tOk) { const m = (Date.now() - tAt) / 60000; return [(m > 40 ? `⚠️ PC ka sale script ruka — aaj ka data ${agoT(tAt)}` : `⚡ Aaj ka data: ${agoT(tAt)} (har 10 min)`) + big, m > 40 || !!big]; }
  if (!at) return ['', false]; const m = (Date.now() - at) / 60000;
  return [m > 150 ? `⚠️ PC ka sale script ruka — data ${agoT(at)}` : `🖥 PC ka data: ${agoT(at)} (har ghante taza)`, m > 150];
}
let lastRows = null;
function rowsOf() {
  const { sorted, srt } = lastRows || { sorted: [], srt: () => 0 };
  const qn = st.q.trim().toLowerCase(), tbl = sorted.filter(r => !qn || r.it.n.toLowerCase().includes(qn)).sort(srt), shown = tbl.slice(0, st.lim);
  return { tbl, shown, html: `<div class="ir-tbl">${shown.map(r => `<button type="button" class="ir-row" data-ir-item="${esc(String(r.it.i))}"><span><b>${esc(r.it.n)}</b><small>${fmtQty(r.q, r.it.pk)}</small></span><span class="ir-num"><b>Rs ${num(r.rs)}</b><small class="${r.pf < 0 ? 'neg' : 'pos'}">${r.noCost ? 'nafa —' : 'Rs ' + num(r.pf) + ' · ' + pct(r.pf, r.rs) + '%'}</small></span></button>`).join('') || '<div class="nt-empty">🔍<b>Kuch nahi mila</b></div>'}</div>
    ${tbl.length > shown.length ? `<button type="button" class="sh-wide" data-ir-more="1">⬇️ Aur dikhao (${num(tbl.length - shown.length)})</button>` : ''}` };
}
function paint() {
  const root = $('irRoot'); if (!root) return;
  if (!loaded) { root.innerHTML = slow ? '<div class="nt-empty">📶<b>Net kamzor — report abhi nahi aayi</b><small>PC ki report server se aa rahi hai; net theek hote hi khud aa jayegi</small><button type="button" class="sh-wide" data-ir-retry="1">🔄 Dobara</button></div>' : '<div class="nt-empty">⏳<b>Report aa rahi hai…</b></div>'; return; }
  if (!data?.meta || !index().items.length) { root.innerHTML = `<div class="nt-empty">📊<b>${err ? (err === 'net' || /offline|unavailable|cache|net/i.test(err) ? '📶 Net nahi — report nahi aayi' : 'Report nahi khuli') : 'PC se abhi data nahi aaya'}</b>${err ? '<button type="button" class="sh-wide" data-ir-retry="1">🔄 Dobara</button>' : ''}<small>${err ? esc(err === 'permission-denied' ? 'Is login ko ijazat nahi' : err) : 'Server PC par "Sale / purchase data" (KHATA-DOCTOR) har ghante chalti hai — pehli dafa 1 ghante tak lag sakta hai'}</small></div>`; return; }
  const X = index(), m = monthOf(), [a, b0] = range(), b = clipEnd(b0), [age, old] = ageText();
  const { rows, T } = agg(a, b), sorted = rows.slice();
  const L = lastDay(m), weeks = [1, 2, 3, 4, 5].map(w => [w, partRange(m, 'w' + w)]).filter(x => x[1] && x[1][0] <= clipEnd(x[1][1]));   // aane wale hafte nahi
  const wkCols = weeks.map(([w, [wa, wb]]) => { const s = agg(wa, clipEnd(wb)).T; return { label: 'Hafta ' + w, sub: `${+wa.slice(8)}–${+wb.slice(8)}`, a: s.rs, b: s.pf, act: `data-ir-per="w${w}"` }; });
  const ptCols = [['p1', '1–10'], ['p2', '11–20'], ['p3', `21–${L}`]].map(([k, l]) => { const [pa, pb] = partRange(m, k), e = clipEnd(pb); if (pa > e) return { label: l, sub: 'abhi nahi', a: 0, b: 0 }; const s = agg(pa, e).T, nD = Math.max(1, Math.round((toDate(e) - toDate(pa)) / 864e5) + 1); return { label: l, sub: `roz ${k1(s.rs / nD)}`, a: s.rs, b: s.pf, act: `data-ir-per="${k}"` }; });
  const pd = perDay(a, b), wd = [0, 0, 0, 0, 0, 0, 0], wdp = [0, 0, 0, 0, 0, 0, 0], wdn = [0, 0, 0, 0, 0, 0, 0];
  pd.forEach(x => { const g = toDate(x.day).getDay(); wd[g] += x.rs; wdp[g] += x.pf; wdn[g]++; });
  const wdCols = WD_ORDER.map(g => ({ label: WD_S[g], sub: wdn[g] ? `${wdn[g]} din` : '', a: wdn[g] ? wd[g] / wdn[g] : 0, b: wdn[g] ? wdp[g] / wdn[g] : 0, act: `data-ir-wd="${g}"` }));
  const dayCols = pd.map(x => ({ label: String(+x.day.slice(8)), a: x.rs, b: x.pf, act: `data-ir-day="${x.day}"` }));
  const P = patterns(m), PO = P.out;
  const srt = sorter(st.sort, st.rev);   // v2.103.3: wahi 6 tarteeb + ⇅
  lastRows = { sorted, srt };   // v2.101.1: search par sirf list badle (keyboard na toote)
  const { tbl, shown, html: rowsH } = rowsOf();
  const chips = (list, attr, on) => `<div class="mchips">${list.map(([k, l]) => `<button type="button" class="rc${on(k) ? ' on' : ''}" ${attr}="${esc(k)}">${esc(l)}</button>`).join('')}</div>`;
  const perLabel = st.per === 'c' ? `${short(a)} – ${short(b)}` : `${(PERS.find(p => p[0] === st.per) || PERS[3])[1]} · ${short(a)} – ${short(b)}`;
  root.innerHTML = `<div class="bc-head ir-head">
    ${chips(X.mons.map(mm => [mm, monLabel(mm)]), 'data-ir-mon', k => k === m)}
    ${chips(PERS.filter(([k]) => !/^w5$/.test(k) || L > 28), 'data-ir-p', k => k === st.per)}
    ${st.per === 'c' ? `<div class="lk-filter ir-cf"><label>Tareekh se<input type="date" data-ir-from value="${esc(st.from || a)}" min="${esc(X.days[0] || '')}" max="${esc(X.days.slice(-1)[0] || '')}"></label><label>Tareekh tak<input type="date" data-ir-to value="${esc(st.to || b)}" min="${esc(X.days[0] || '')}" max="${esc(X.days.slice(-1)[0] || '')}"></label></div>` : ''}
    <div class="mchips"><button type="button" class="rc${st.ws ? ' on' : ''}" data-ir-ws="1">${st.ws ? '☑' : '☐'} 📦 Wholesale ke saath</button><button type="button" class="rc${st.ws ? '' : ' on'}" data-ir-ws="0">${st.ws ? '☐' : '☑'} Wholesale ke baghair</button></div>
    <div class="ir-hero"><small>${esc(perLabel)}</small><strong>Rs ${num(T.rs)}</strong><span>sale · ${num(T.n)} items</span>
      <div class="ir-kp"><div class="ir-tap" data-ir-nafa="1" role="button"><b class="${T.pf < 0 ? 'neg' : ''}">Rs ${num(T.pf)}</b><small>nafa (andaza) · items ▸</small></div><div><b>${pct(T.pf, T.rs)}%</b><small>nafa %</small></div><div><b>${num(pd.length ? T.rs / pd.length : 0)}</b><small>roz ki sale</small></div></div></div>
    <p class="lk-age${old ? ' warn' : ''}">${esc(age)}${T.noCost ? ` · ${T.noCost} items ka khareed rate nahi (nafa mein nahi)` : ''}</p></div>
  ${nfHTML(a, b)}
  ${commHTML(a, b)}
  <section class="ir-sec" id="irTopSec"><div class="ir-sh"><b>🏆 Items — sale aur nafa (Rs)</b><small>tap = item ki poori kahani</small></div>
    <div class="ir-sticky">${sortBar(chips, 'data-ir-tsort', st.tsort, 'data-ir-trev', st.trev)}
    <label class="hs-search"><input type="search" data-ir-tq="1" placeholder="🔍 item dhoondo (number bhi dikhega)…" value="${esc(st.tq)}"></label></div>
    <div id="irTop">${topHTML()}</div></section>
  ${nafaHTML(rows, T, a, b)}
  ${phHTML()}
  <section class="ir-sec"><div class="ir-sh"><b>📅 Hafta-war — ${esc(monLabel(m))}</b><small>tap = woh hafta</small></div>${legend()}${colChart(wkCols)}</section>
  <section class="ir-sec"><div class="ir-sh"><b>🗓 Mahine ke hisse</b><small>1–10 · 11–20 · 21–${L} — tap = woh hissa</small></div>${colChart(ptCols)}</section>
  <section class="ir-sec"><div class="ir-sh"><b>📆 Kis din zyada bikta hai</b><small>ek din ki ausat sale — tap = us din ki top items</small></div>${colChart(wdCols, { h: 120 })}</section>
  <section class="ir-sec"><div class="ir-sh"><b>📈 Roz ki sale</b><small>${esc(short(a))} – ${esc(short(b))} · tap = us din ki items</small></div><div class="ir-scroll">${colChart(dayCols, { h: 120 })}</div></section>
  <section class="ir-sec ir-pat"><div class="ir-sh"><b>🔎 Pattern — ${esc(monLabel(m))}</b><small>${P.endD < L ? `aaj tak (${P.endD} din)` : 'poora mahina'}</small></div>
    ${[0, 1, 2].map(i => PO.part[i].length ? `<h5>${['🌅 Mahine ke SHURU (1–10) mein zyada', '🌤 DARMIYAN (11–20) mein zyada', `🌙 AAKHIR (21–${L}) mein zyada`][i]}</h5><div class="ir-pcs">${PO.part[i].slice(0, 10).map(x => pchip(x.r, `${x.x.toFixed(1)}× baqi dino se`)).join('')}</div>` : '').join('')}
    ${WD_ORDER.map(g => PO.wd[g].length ? `<h5>📆 ${WD[g]} ko zyada</h5><div class="ir-pcs">${PO.wd[g].slice(0, 8).map(x => pchip(x.r, `${x.x.toFixed(1)}× baqi dino se`)).join('')}</div>` : '').join('')}
    ${PO.up.length ? `<h5>📈 Pichhle mahine se BARH rahi</h5><div class="ir-pcs">${PO.up.slice(0, 10).map(x => pchip(x.r, x.x >= 9 ? 'nayi' : '+' + Math.round(x.x * 100) + '% roz')).join('')}</div>` : ''}
    ${PO.down.length ? `<h5>📉 Pichhle mahine se GIR rahi</h5><div class="ir-pcs">${PO.down.slice(0, 10).map(x => pchip(x.r, Math.round(x.x * 100) + '% roz')).join('')}</div>` : ''}
    ${PO.thin.length ? `<h5>⚠️ Zyada sale, KAM nafa (5% se kam)</h5><div class="ir-pcs">${PO.thin.slice(0, 10).map(x => pchip(x.r, `nafa ${x.x}% · sale ${k1(x.r.rs)}`)).join('')}</div>` : ''}
    ${PO.loss.length ? `<h5 class="neg">🔻 GHAATE mein bik rahi</h5><div class="ir-pcs">${PO.loss.slice(0, 10).map(x => pchip(x.r, `Rs ${num(x.x)}`)).join('')}</div>` : ''}
    ${![...PO.part, ...PO.wd, PO.up, PO.down, PO.thin, PO.loss].some(l => l.length) ? '<p class="lk-note">Abhi koi khaas pattern nahi — mahina aage barhega to saaf hoga.</p>' : ''}
    <p class="lk-note">Pattern = item ki us hisse / din ki roz ki sale baqi hisson / dino se kitne guna zyada. Nafa = abhi ka khareed rate × ginti (andaza).</p></section>
  <section class="ir-sec"><div class="ir-sh"><b>📋 Saari items (<span id="irTblN">${num(tbl.length)}</span>)</b><small>tap = tafseel</small></div>
    <div class="ir-sticky">${sortBar(chips, 'data-ir-sort', st.sort, 'data-ir-rev', st.rev)}
    <label class="hs-search"><input type="search" data-ir-q="1" placeholder="🔍 item dhoondo…" value="${esc(st.q)}"></label></div>
    <div id="irRows">${rowsH}</div></section>`;
}

// ---------- 💰 v2.103.10: ASAL NAFA — sale bills se (malik: "sale bills ke data ke hisaab se profit") ----------
//   Har bill = sale − laagat (POS ne bill ke waqt ka khareed rate COGS mein likha) · PC item-report v1.4 -> posStats/nafa-<mahina>-<k>
//   {p: [party], b: [[din, 'HH:MM', billNo, pIdx, total, cost, ws, est]]} · aaj = irep-today.nb (har 10 min). est 1 = POS ne laagat nahi
//   likhi -> aaj ke rate se andaza (~). Wholesale chip wahi (st.ws). Sirf malik (item report hi malik ki).
const nfC = new Map();   // mahina -> {at, d, busy, err}
function nfNeed(mons) {
  const M = data?.meta?.nafa || full?.meta?.nafa; if (!M || !cloud?.getNafaMonth) return;
  const at = Number(full?.meta?.at) || 0;
  for (const mon of mons) { const n = Number(M[mon]) || 0, c = nfC.get(mon); if (!n || (c && (c.busy || c.at === at))) continue;
    nfC.set(mon, { at, d: c?.d || null, busy: true });
    cloud.getNafaMonth(mon, n).then(d => { nfC.set(mon, { at, d, busy: false }); if ($('irRoot')) paint(); }, e => { nfC.set(mon, { at, d: c?.d || null, busy: false, err: e?.message || 'net' }); if ($('irRoot')) paint(); }); }
}
const monsIn = (a, b) => { const out = []; let m = a.slice(0, 7); while (m <= b.slice(0, 7) && out.length < 4) { out.push(m); const d = new Date(+m.slice(0, 4), +m.slice(5, 7), 1); m = `${d.getFullYear()}-${p2(d.getMonth() + 1)}`; } return out; };
function nfBills(a, b) {   // [{day, t, no, party, sale, cost, nafa, ws, est}] — aaj ka hissa irep-today se (naya ho to)
  const out = [], TD = [kdoc, tdoc].filter(x => x?.nb && x.day && Number(x.at) > (Number(full?.meta?.at) || 0)), tdDays = new Set(TD.map(x => x.day));   // v2.103.28: kal bhi
  for (const mon of monsIn(a, b)) { const c = nfC.get(mon)?.d; const rows = [];
    if (c) for (const r of c.b) { const day = `${mon}-${p2(r[0])}`; if (tdDays.has(day)) continue; rows.push([day, r, c.p]); }
    for (const td of TD) if (td.day.slice(0, 7) === mon) for (const r of td.nb.b || []) rows.push([td.day, r, td.nb.p || []]);
    for (const [day, r, P] of rows) { if (day < a || day > b) continue; if (!st.ws && r[6]) continue;
      out.push({ day, t: r[1] || '', no: r[2] || '', party: P[r[3]] || '', sale: Number(r[4]) || 0, cost: Number(r[5]) || 0, nafa: (Number(r[4]) || 0) - (Number(r[5]) || 0), ws: !!r[6], est: !!r[7] }); } }
  return out;
}
function nfState(a, b) { const M = data?.meta?.nafa || full?.meta?.nafa; if (!M) return 'old'; const ms = monsIn(a, b).filter(m => M[m]); if (ms.some(m => !nfC.get(m)?.d)) { nfNeed(ms); return ms.some(m => nfC.get(m)?.err) ? 'err' : 'wait'; } nfNeed(ms); return 'ok'; }
function nfSum(B) { const T = { sale: 0, cost: 0, nafa: 0, n: B.length, loss: 0, est: 0 }; for (const x of B) { T.sale += x.sale; T.cost += x.cost; T.nafa += x.nafa; if (x.nafa < 0 && x.sale > 0) T.loss++; if (x.est) T.est++; } return T; }
let nfPartyAll = false;
function nfHTML(a, b) {
  const sh = '<div class="ir-sh"><b>💰 Asal nafa — sale bills se</b><small>bill ke waqt ka khareed rate</small></div>', S = nfState(a, b);
  if (S === 'old') return `<section class="ir-sec ir-nf">${sh}<p class="lk-note">🖥 Shop PC update ho raha hai — 1 ghante tak yahan har bill ka asal nafa aa jayega.</p></section>`;
  if (S !== 'ok') return `<section class="ir-sec ir-nf">${sh}<p class="lk-note">${S === 'err' ? '📶 Net kamzor — bills ka nafa nahi aaya. <button type="button" class="fc-link" data-ir-nfre="1">🔄 Dobara</button>' : '⏳ Bills ka nafa aa raha hai…'}</p></section>`;
  const B = nfBills(a, b), T = nfSum(B);
  if (!B.length) return `<section class="ir-sec ir-nf">${sh}<p class="lk-note">Is waqt mein koi sale bill nahi.</p></section>`;
  const days = new Map(); for (const x of B) { const o = days.get(x.day) || { sale: 0, nafa: 0 }; o.sale += x.sale; o.nafa += x.nafa; days.set(x.day, o); }
  const dayCols = [...days].sort((x, y) => x[0].localeCompare(y[0])).map(([d, o]) => ({ label: String(+d.slice(8)), a: o.sale, b: o.nafa, act: `data-ir-nd="${d}"` }));
  const P = new Map(); for (const x of B) { const k = x.party || 'Cash'; const o = P.get(k) || { name: k, sale: 0, nafa: 0, n: 0 }; o.sale += x.sale; o.nafa += x.nafa; o.n++; P.set(k, o); }
  const PL = [...P.values()].sort((x, y) => y.nafa - x.nafa), shown = nfPartyAll ? PL : PL.slice(0, 10);
  return `<section class="ir-sec ir-nf">${sh}
    <div class="ir-kp ir-nfkp"><div><b>Rs ${num(T.sale)}</b><small>sale · ${num(T.n)} bill</small></div><div><b>Rs ${num(T.cost)}</b><small>laagat</small></div><div><b class="${T.nafa < 0 ? 'neg' : 'pos'}">Rs ${num(T.nafa)}</b><small>asal nafa</small></div><div><b>${pct(T.nafa, T.sale)}%</b><small>nafa %</small></div></div>
    <div class="ir-nfch">${T.loss ? `<button type="button" class="ir-nfbad" data-ir-nd="loss">🔴 ${num(T.loss)} bill ghaate mein — dekhein</button>` : '<span class="ir-nfok">✓ Koi bill ghaate mein nahi</span>'}<button type="button" class="fc-link" data-ir-nd="all">🧾 Saare ${num(T.n)} bill</button></div>
    ${T.est ? `<p class="lk-note">~ ${num(T.est)} bill mein POS ne laagat nahi likhi — wahan aaj ke khareed rate se andaza.</p>` : ''}
    <h5 class="ir-nfh">📈 Roz ka asal nafa <small>tap = us din ke bill</small></h5><div class="ir-scroll">${colChart(dayCols, { h: 110 })}</div>
    <h5 class="ir-nfh">👥 Kis party se kitna nafa</h5>
    <div class="ir-tbl">${shown.map((o, i) => `<div class="ir-row ir-nfp"><span><b>${i + 1}. ${esc(o.name)}</b><small>${num(o.n)} bill · sale Rs ${num(o.sale)}</small></span><span class="ir-num"><b class="${o.nafa < 0 ? 'neg' : ''}">Rs ${num(o.nafa)}</b><small>${pct(o.nafa, o.sale)}%</small></span></div>`).join('')}</div>
    ${PL.length > 10 ? `<button type="button" class="sh-wide" data-ir-nfpall="1">${nfPartyAll ? '⬆️ Sirf top 10' : `⬇️ Saari parties (${num(PL.length)})`}</button>` : ''}</section>`;
}
// bills ki list (din / ghaate wale / saare) — tarteeb + search
let nfL = null;
// v2.103.46: 💰 NAFA ITEM-WAR TABLE — malik: "nafa (andaza) wale khane mein items ka nafa table, ek side item ka naam".
//   Tap → dialog: item · bika Rs · nafa Rs · nafa % (zyada nafa upar) · chips Top 20 / Sab / 🔴 Minus · search · kul · PDF.
let pfT = null;
function pfRows() { const [a, b0] = range(), b = clipEnd(b0), { rows, T } = agg(a, b), q = (pfT.q || '').trim().toLowerCase();
  let L = rows.filter(r => !r.noCost).sort((x, y) => y.pf - x.pf); if (pfT.f === 'loss') L = L.filter(r => r.pf < 0).sort((x, y) => x.pf - y.pf); if (q) L = L.filter(r => r.it.n.toLowerCase().includes(q));
  return { L: pfT.f === 'top' && !q ? L.slice(0, 20) : L, all: L, T, a, b, noCost: rows.filter(r => r.noCost).length }; }
function pfTable(L, pdf) { return `<table class="iv-tbl pf-tbl"><thead><tr><th>#</th><th>Item</th><th>Bika Rs</th><th>Nafa Rs</th><th>%</th></tr></thead><tbody>${L.map((r, i) => `<tr class="${r.pf < 0 ? 'neg' : ''}"><td class="rp-n">${i + 1}</td><td class="pf-nm">${pdf ? esc(r.it.n) : `<button type="button" data-ir-item="${esc(String(r.it.i))}">${esc(r.it.n)}</button>`}<small>${esc(fmtQty(r.q, r.it.pk))}</small></td><td class="rp-r">${num(r.rs)}</td><td class="rp-r pf-v">${r.pf < 0 ? '−' : ''}${num(Math.abs(r.pf))}</td><td class="rp-r">${pct(r.pf, r.rs)}%</td></tr>`).join('')}</tbody></table>`; }
function pfDlg() { if (!data?.meta) { notice('Report abhi nahi aayi'); return; } pfT = pfT || { f: 'top', q: '' }; dlg('💰 Nafa — item-war (andaza)', '<div id="irPf"></div>'); pfPaint(); }
function pfPaint(only) { const el = $('irPf'); if (!el || !pfT) return; const { L, all, T, a, b, noCost } = pfRows(), sum = L.reduce((t, r) => t + r.pf, 0), srs = L.reduce((t, r) => t + r.rs, 0);
  const body = `<div class="rk-note" style="margin:0 0 6px">${esc(short(a))} – ${esc(short(b))} · ${st.ws ? 'wholesale ke saath' : 'wholesale ke baghair'} · nafa = abhi ka khareed rate × ginti${noCost ? ` · ${noCost} items ka khareed rate nahi` : ''}</div>
    ${pfTable(L)}${!L.length ? '<p class="rk-note">Kuch nahi</p>' : ''}
    <div class="gm-sum"><span>${pfT.f === 'top' ? 'Top 20' : pfT.f === 'loss' ? 'Minus wale' : 'Sab'} <b>${num(L.length)}</b> items</span><span>Bika <b>Rs ${num(srs)}</b></span><span class="${sum < 0 ? 'neg' : 'pos'}">Nafa <b>Rs ${num(sum)}</b> (${pct(sum, srs)}%)</span></div>`;
  if (only) { const t = $('irPfBody'); if (t) { t.innerHTML = body; return; } }
  el.innerHTML = `<div class="mchips">${[['top', 'Top 20'], ['all', `Sab (${num(all.length)})`], ['loss', '🔴 Minus']].map(([k, l]) => `<button type="button" class="rc${pfT.f === k ? ' on' : ''}" data-ir-pff="${k}">${l}</button>`).join('')}</div>
    <label class="hs-search"><input type="search" data-ir-pfq="1" placeholder="🔍 item dhoondo…" value="${esc(pfT.q)}" autocomplete="off"></label>
    <div id="irPfBody">${body}</div>
    <div class="rk-ed"><button type="button" class="rk-sv" data-ir-pfpdf="1">📄 PDF · WhatsApp</button></div>`; }
function pfPdf() { const { L, T, a, b, noCost } = pfRows(), sum = L.reduce((t, r) => t + r.pf, 0), srs = L.reduce((t, r) => t + r.rs, 0);
  const html = `<h1>NOOR TRADERS</h1><h2>Nafa — item-war (andaza)</h2><p>${esc(short(a))} – ${esc(short(b))} · ${st.ws ? 'wholesale ke saath' : 'wholesale ke baghair'} · ${pfT.f === 'top' ? 'Top 20' : pfT.f === 'loss' ? 'Minus wale' : 'Sab'} ${num(L.length)} items · Kul sale Rs ${num(T.rs)} · kul nafa Rs ${num(T.pf)} (${pct(T.pf, T.rs)}%)</p>${pfTable(L, true)}<p><b>Is list ka:</b> bika Rs ${num(srs)} · nafa Rs ${num(sum)} (${pct(sum, srs)}%)</p><p><small>Nafa = abhi ka khareed rate × ginti (andaza).${noCost ? ' ' + noCost + ' items ka khareed rate nahi (shamil nahi).' : ''}</small></p>`;
  if (pdfOf) pdfOf(html, `Nafa items ${a} se ${b}`); }
document.addEventListener('click', e => { const t = e.target.closest?.('[data-ir-nafa],[data-ir-pff],[data-ir-pfpdf]'); if (!t) return; const d = t.dataset;
  if (d.irNafa) { pfDlg(); return; } if (!pfT) return; if (d.irPff) { pfT.f = d.irPff; pfPaint(); return; } if (d.irPfpdf) { pfPdf(); return; } });
document.addEventListener('input', e => { const t = e.target; if (pfT && t?.dataset?.irPfq != null) { pfT.q = t.value || ''; clearTimeout(pfT.t); pfT.t = setTimeout(() => pfPaint(true), 150); } });
function nfDlg(key) { const [a, b0] = range(), b = clipEnd(b0); nfL = { key, srt: key === 'loss' ? 'nafa' : 't', rev: false, q: '', lim: 150, a: /^\d{4}-/.test(key) ? key : a, b: /^\d{4}-/.test(key) ? key : b };
  dlg(key === 'loss' ? '🔴 Ghaate wale bill' : /^\d{4}-/.test(key) ? `🧾 ${short(key)} ${key.slice(0, 4)} · ${WD[toDate(key).getDay()]} — bills ka nafa` : '🧾 Saare bills ka nafa', '<div id="irNf"></div>'); nfPaint(); }
function nfPaint(only) {
  const el = $('irNf'); if (!el || !nfL) return; const q = nfL.q.trim().toLowerCase();
  let B = nfBills(nfL.a, nfL.b); if (nfL.key === 'loss') B = B.filter(x => x.nafa < 0 && x.sale > 0);
  const T = nfSum(B); if (q) B = B.filter(x => x.no.toLowerCase().includes(q) || x.party.toLowerCase().includes(q));
  const k = { nafa: x => x.nafa, sale: x => x.sale, p: x => x.sale ? x.nafa / x.sale : 0, t: x => x.day + ' ' + x.t }[nfL.srt];
  B.sort((x, y) => { const u = k(x), v = k(y), r = typeof u === 'string' ? String(u).localeCompare(v) : u - v; return (nfL.srt === 't' ? -r : nfL.key === 'loss' && nfL.srt === 'nafa' ? r : -r) * (nfL.rev ? -1 : 1); });
  const S = B.slice(0, nfL.lim), multi = nfL.a !== nfL.b;
  const html = `<div class="ir-kp ir-nfkp"><div><b>Rs ${num(T.sale)}</b><small>sale · ${num(T.n)} bill</small></div><div><b class="${T.nafa < 0 ? 'neg' : 'pos'}">Rs ${num(T.nafa)}</b><small>nafa · ${pct(T.nafa, T.sale)}%</small></div></div>
    <div class="ir-sticky"><div class="mchips">${[['nafa', 'Nafa'], ['sale', 'Sale'], ['p', 'Nafa %'], ['t', 'Waqt']].map(([kk, l]) => `<button type="button" class="rc${nfL.srt === kk ? ' on' : ''}" data-ir-nfs="${kk}">${l}</button>`).join('')}<button type="button" class="rc" data-ir-nfr="1">⇅ ${nfL.rev ? 'Ulta' : 'Seedha'}</button></div>
    <label class="hs-search"><input type="search" data-ir-nfq="1" placeholder="🔍 bill no / party…" value="${esc(nfL.q)}"></label></div>
    <div id="irNfList"><div class="ir-tbl">${S.map(x => `<div class="ir-row ir-nfb${x.nafa < 0 && x.sale > 0 ? ' bad' : ''}"><span><b>#${esc(x.no)} · ${esc(x.party || 'Cash')}${x.ws ? ' 📦' : ''}</b><small>${multi ? esc(short(x.day)) + ' · ' : ''}${esc(x.t)}${x.sale < 0 ? ' · ↩️ wapsi' : ''}</small></span><span class="ir-num"><b>Rs ${num(x.sale)}</b><small class="${x.nafa < 0 ? 'neg' : 'pos'}">${x.est ? '~' : ''}nafa Rs ${num(x.nafa)} · ${pct(x.nafa, x.sale)}%</small></span></div>`).join('') || '<div class="nt-empty">🔍<b>Kuch nahi mila</b></div>'}</div>
    ${B.length > S.length ? `<button type="button" class="sh-wide" data-ir-nfmore="1">⬇️ Aur dikhao (${num(B.length - S.length)})</button>` : ''}</div>`;
  if (only) { const t = document.createElement('div'); t.innerHTML = html; const a = t.querySelector('#irNfList'), b = el.querySelector('#irNfList'); if (a && b) { b.innerHTML = a.innerHTML; return; } }
  el.innerHTML = html;
}
document.addEventListener('click', e => {
  const t = e.target.closest?.('[data-ir-nd],[data-ir-nfpall],[data-ir-nfs],[data-ir-nfr],[data-ir-nfmore],[data-ir-nfre]'); if (!t || !t.closest('.ir-root')) return; const d = t.dataset;
  if (d.irNd) { nfDlg(d.irNd); return; }
  if (d.irNfpall != null) { nfPartyAll = !nfPartyAll; paint(); return; }
  if (d.irNfre != null) { nfC.clear(); paint(); return; }
  if (!nfL) return;
  if (d.irNfs) { if (nfL.srt === d.irNfs) nfL.rev = !nfL.rev; else { nfL.srt = d.irNfs; nfL.rev = false; } nfPaint(); return; }
  if (d.irNfr != null) { nfL.rev = !nfL.rev; nfPaint(); return; }
  if (d.irNfmore != null) { nfL.lim += 200; nfPaint(); return; }
});
document.addEventListener('input', e => { const t = e.target; if (t?.dataset?.irNfq != null && nfL) { nfL.q = t.value || ''; clearTimeout(nfQT); nfQT = setTimeout(() => nfPaint(true), 160); } });
let nfQT = 0;
function nfPdf(a, b) { const M = data?.meta?.nafa; if (!M || nfState(a, b) !== 'ok') return ''; const B = nfBills(a, b), T = nfSum(B); if (!B.length) return '';
  const P = new Map(); for (const x of B) { const k = x.party || 'Cash'; const o = P.get(k) || { name: k, sale: 0, nafa: 0, n: 0 }; o.sale += x.sale; o.nafa += x.nafa; o.n++; P.set(k, o); }
  const days = new Map(); for (const x of B) { const o = days.get(x.day) || { sale: 0, nafa: 0, n: 0 }; o.sale += x.sale; o.nafa += x.nafa; o.n++; days.set(x.day, o); }
  const loss = B.filter(x => x.nafa < 0 && x.sale > 0).sort((x, y) => x.nafa - y.nafa);
  return `<h3>💰 Asal nafa — sale bills se (bill ke waqt ka khareed rate)</h3><p>Sale <b>Rs ${num(T.sale)}</b> · laagat Rs ${num(T.cost)} · <b>asal nafa Rs ${num(T.nafa)} (${pct(T.nafa, T.sale)}%)</b> · ${num(T.n)} bill${T.loss ? ` · 🔴 ${num(T.loss)} ghaate mein` : ''}${T.est ? ` · ~${num(T.est)} andaza` : ''}</p>
    <table class="iv-tbl"><thead><tr><th>Din</th><th>Bill</th><th>Sale Rs</th><th>Nafa Rs</th><th>%</th></tr></thead><tbody>${[...days].sort((x, y) => x[0].localeCompare(y[0])).map(([d, o]) => `<tr><td>${esc(short(d))}</td><td>${num(o.n)}</td><td>${num(o.sale)}</td><td>${num(o.nafa)}</td><td>${pct(o.nafa, o.sale)}%</td></tr>`).join('')}</tbody></table>
    <table class="iv-tbl"><thead><tr><th>#</th><th>Party</th><th>Bill</th><th>Sale Rs</th><th>Nafa Rs</th></tr></thead><tbody>${[...P.values()].sort((x, y) => y.nafa - x.nafa).slice(0, 20).map((o, i) => `<tr><td>${i + 1}</td><td>${esc(o.name)}</td><td>${num(o.n)}</td><td>${num(o.sale)}</td><td>${num(o.nafa)}</td></tr>`).join('')}</tbody></table>
    ${loss.length ? `<table class="iv-tbl"><thead><tr><th>🔴 Ghaate wala bill</th><th>Din</th><th>Party</th><th>Sale Rs</th><th>Nafa Rs</th></tr></thead><tbody>${loss.slice(0, 25).map(x => `<tr><td>#${esc(x.no)}</td><td>${esc(short(x.day))} ${esc(x.t)}</td><td>${esc(x.party || 'Cash')}</td><td>${num(x.sale)}</td><td>${num(x.nafa)}</td></tr>`).join('')}</tbody></table>` : ''}`; }

// ---------- 💸 v2.103.14: PAISA PHANSA STOCK (malik: "jo maal nahi bik raha / zyada para hai — kitna paisa phansa") ----------
//   POS ka kul stock (sab godam) × fi pcs khareed (item report ka c). 😴 = 60 din se ek bhi nahi bika · 📦 = 90 din ki bikri se zyada para
//   (zaid hissa). Bikri = item report ke saare din (3 mahine). Aaj tak — tareekh ke chips se nahi badalta.
let phTab = 'dead', phLim = 40;
function phAgg() {
  const S = stockOf(); if (!S || !S.size) return null; const X = index(), td = today(), N = X.days.length || 1;
  const byI = new Map(X.items.map(it => [String(it.i), it])), dead = [], over = [];
  for (const [id, st] of S) { const q = Number(st.stock) || 0; if (!(q > 0)) continue; const it = byI.get(id), c = Number(it?.c) || 0;
    let li = -1, sold = 0; for (const x of it?.d || []) { if (x[1] > 0 && x[0] > li) li = x[0]; sold += Number(x[1]) || 0; }
    const lastDay = li >= 0 ? X.days[li] : '', ago = lastDay ? Math.round((toDate(td) - toDate(lastDay)) / 864e5) : null;
    const name = it?.n || st.name || 'Item ' + id, pk = Number(it?.pk || st.pack) || 0, row = { id, it, name, pk, q, c, ago, sold };
    if (ago == null ? N >= 60 : ago >= 60) { dead.push({ ...row, rs: q * c }); continue; }
    const per = sold / N; if (per > 0 && q / per > 90) { const extra = q - per * 90; over.push({ ...row, extra, cover: Math.round(q / per), rs: extra * c }); } }
  dead.sort((a, b) => b.rs - a.rs || b.q - a.q); over.sort((a, b) => b.rs - a.rs);
  const sum = l => l.reduce((t, r) => t + r.rs, 0); return { dead, over, D: sum(dead), O: sum(over), noC: [...dead, ...over].filter(r => !r.c).length, N };
}
function phHTML() {
  const A = phAgg(), sh = '<div class="ir-sh"><b>💸 Paisa phansa stock</b><small>aaj tak · POS ka kul stock</small></div>';
  if (!A) return `<section class="ir-sec ir-ph">${sh}<p class="lk-note">⏳ Stock aa raha hai…</p></section>`;
  const L = phTab === 'dead' ? A.dead : A.over, shown = L.slice(0, phLim);
  return `<section class="ir-sec ir-ph">${sh}
    <div class="ir-phhero"><small>Kul phansa paisa</small><strong>Rs ${num(Math.round(A.D + A.O))}</strong><span>${num(A.dead.length + A.over.length)} items · khareed rate se</span></div>
    <div class="ir-phtabs"><button type="button" class="${phTab === 'dead' ? 'is-in' : ''}" data-ir-ph="dead"><b>😴 Nahi bik raha</b><small>${num(A.dead.length)} items · Rs ${k1(A.D)}</small></button><button type="button" class="${phTab === 'over' ? 'is-in' : ''}" data-ir-ph="over"><b>📦 Zarurat se zyada</b><small>${num(A.over.length)} items · Rs ${k1(A.O)}</small></button></div>
    <p class="lk-note">${phTab === 'dead' ? '60 din se ek bhi nahi bika — maal para hai.' : '3 mahine (90 din) ki bikri se zyada para hai — sirf zaid hissa gina.'}</p>
    <div class="ir-tbl">${shown.map(r => `<button type="button" class="ir-row ir-phr" ${r.it ? `data-ir-item="${esc(String(r.it.i))}"` : 'disabled'}><span><b>${esc(r.name)}</b><small>stock ${fmtQty(r.q, r.pk)}${phTab === 'dead' ? ` · ${r.ago == null ? `${A.N}+ din se nahi bika` : `aakhri sale ${r.ago} din pehle`}` : ` · ${r.cover} din ka · zaid ${fmtQty(Math.round(r.extra), r.pk)}`}</small></span><span class="ir-num"><b>${r.c ? 'Rs ' + num(Math.round(r.rs)) : '—'}</b><small>${r.c ? 'phansa' : 'rate nahi'}</small></span></button>`).join('') || `<div class="nt-empty">✓<b>${phTab === 'dead' ? 'Sab maal bik raha hai' : 'Koi item zyada nahi para'}</b></div>`}</div>
    ${L.length > shown.length ? `<button type="button" class="sh-wide" data-ir-phmore="1">⬇️ Aur dikhao (${num(L.length - shown.length)})</button>` : ''}
    ${A.noC ? `<p class="lk-note">⚠️ ${num(A.noC)} items ka khareed rate POS mein nahi — un ka paisa nahi gina.</p>` : ''}</section>`;
}
document.addEventListener('click', e => { const t = e.target.closest?.('[data-ir-ph],[data-ir-phmore]'); if (!t || !t.closest('.ir-root')) return;
  if (t.dataset.irPh) { phTab = t.dataset.irPh; phLim = 40; paint(); return; } phLim += 80; paint(); });
function phPdf() { const A = phAgg(); if (!A || !(A.dead.length + A.over.length)) return '';
  const tb = (h, l, f) => l.length ? `<table class="iv-tbl"><thead><tr>${h.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${l.slice(0, 40).map(f).join('')}</tbody></table>` : '';
  return `<h3>💸 Paisa phansa stock — kul Rs ${num(Math.round(A.D + A.O))}</h3>
    <p>😴 Nahi bik raha (60 din+): ${num(A.dead.length)} items · Rs ${num(Math.round(A.D))} · 📦 Zarurat se zyada (90 din+ ka): ${num(A.over.length)} items · Rs ${num(Math.round(A.O))}</p>
    ${tb(['😴 Item', 'Stock', 'Aakhri sale', 'Phansa Rs'], A.dead, r => `<tr><td>${esc(r.name)}</td><td>${fmtQty(r.q, r.pk)}</td><td>${r.ago == null ? A.N + '+ din' : r.ago + ' din pehle'}</td><td>${r.c ? num(Math.round(r.rs)) : '—'}</td></tr>`)}
    ${tb(['📦 Item', 'Stock', 'Kitne din ka', 'Zaid Rs'], A.over, r => `<tr><td>${esc(r.name)}</td><td>${fmtQty(r.q, r.pk)}</td><td>${r.cover} din</td><td>${r.c ? num(Math.round(r.rs)) : '—'}</td></tr>`)}`; }

// ---------- tafseel (dialog) ----------
function dlg(title, html) { const d = $('dialog'); if (!d) return; d.classList.remove('search-dialog'); d.classList.add('full-dialog'); $('dialogTitle').textContent = title; $('dialogBody').innerHTML = `<div class="ir-root ir-dlg">${html}</div>`; if (!d.open) d.showModal(); }
function itemDlg(id) {
  const X = index(), it = X.items.find(x => String(x.i) === String(id)); if (!it) return;
  const m = monthOf(), L = lastDay(m), [a, b0] = range(), b = clipEnd(b0), s = sumItem(it, a, b), mEnd = clipEnd(`${m}-${p2(L)}`);
  const ms = sumItem(it, `${m}-01`, mEnd), pd = perDay(`${m}-01`, mEnd, it);
  const wd = [0, 0, 0, 0, 0, 0, 0], wn = [0, 0, 0, 0, 0, 0, 0]; pd.forEach(x => { const g = toDate(x.day).getDay(); wd[g] += x.rs; wn[g]++; });
  const wdCols = WD_ORDER.map(g => ({ label: WD_S[g], a: wn[g] ? wd[g] / wn[g] : 0, b: 0 }));
  const ptCols = [['p1', '1–10'], ['p2', '11–20'], ['p3', `21–${L}`]].map(([k, l]) => { const [pa, pb] = partRange(m, k), e = clipEnd(pb), x = sumItem(it, pa, e); return { label: l, sub: fmtQty(x.q, it.pk), a: x.rs, b: x.pf }; });
  const wkCols = [1, 2, 3, 4, 5].map(w => [w, partRange(m, 'w' + w)]).filter(x => x[1] && x[1][0] <= clipEnd(x[1][1])).map(([w, [wa, wb]]) => { const x = sumItem(it, wa, clipEnd(wb)); return { label: 'H' + w, sub: fmtQty(x.q, it.pk), a: x.rs, b: x.pf }; });
  const moCols = X.mons.map(mm => { const x = sumItem(it, `${mm}-01`, clipEnd(`${mm}-${p2(lastDay(mm))}`)); return { label: MONTHS[+mm.slice(5, 7) - 1], sub: fmtQty(x.q, it.pk), a: x.rs, b: x.pf }; });
  const best = WD_ORDER.slice().sort((x, y) => (wn[y] ? wd[y] / wn[y] : 0) - (wn[x] ? wd[x] / wn[x] : 0))[0], bp = ptCols.slice().sort((x, y) => y.a - x.a)[0];
  const avgRate = s.q ? s.rs / s.q : 0;
  dlg('📦 ' + it.n, `<div class="ir-hero"><small>${esc(short(a))} – ${esc(short(b))}${st.ws ? '' : ' · wholesale ke baghair'}</small><strong>Rs ${num(s.rs)}</strong><span>${fmtQty(s.q, it.pk)} bika</span>
    <div class="ir-kp"><div><b class="${s.pf < 0 ? 'neg' : ''}">${s.noCost ? '—' : 'Rs ' + num(s.pf)}</b><small>nafa</small></div><div><b>${s.noCost ? '—' : pct(s.pf, s.rs) + '%'}</b><small>nafa %</small></div><div><b>Rs ${num(avgRate)}</b><small>ausat rate / pc</small></div></div>
    <p class="ir-hint">Khareed (abhi): Rs ${num(it.c)} / pc${it.pk > 1 ? ' · ' + it.pk + ' pc = 1 ctn' : ''}${!s.noCost && avgRate ? ` · fi pc nafa Rs ${num(avgRate - it.c)}` : ''}</p></div>
    <p class="ir-say">📌 ${esc(monLabel(m))} mein sab se zyada <b>${esc(bp.label)}</b> tareekh mein bikta hai, aur hafte mein <b>${esc(WD[best])}</b> ko.</p>
    <section class="ir-sec"><div class="ir-sh"><b>📈 Roz ki sale — ${esc(monLabel(m))}</b></div><div class="ir-scroll">${colChart(pd.map(x => ({ label: String(+x.day.slice(8)), a: x.rs, b: x.pf })), { h: 110 })}</div></section>
    <section class="ir-sec"><div class="ir-sh"><b>🗓 Mahine ke hisse</b></div>${legend()}${colChart(ptCols, { h: 110 })}</section>
    <section class="ir-sec"><div class="ir-sh"><b>📅 Hafta-war</b></div>${colChart(wkCols, { h: 110 })}</section>
    <section class="ir-sec"><div class="ir-sh"><b>📆 Kis din (ek din ki ausat)</b></div>${colChart(wdCols, { h: 100 })}</section>
    <section class="ir-sec"><div class="ir-sh"><b>🗂 3 mahine</b></div>${colChart(moCols, { h: 110 })}</section>
    <p class="lk-note">Poore ${esc(monLabel(m))}: Rs ${num(ms.rs)} · ${fmtQty(ms.q, it.pk)} · nafa ${ms.noCost ? '—' : 'Rs ' + num(ms.pf)}</p>`);
}
function listDlg(title, rows, note) {
  dlg(title, `${note ? `<p class="ir-say">${note}</p>` : ''}<div class="ir-tbl">${rows.slice(0, 80).map(r => `<button type="button" class="ir-row" data-ir-item="${esc(String(r.it.i))}"><span><b>${esc(r.it.n)}</b><small>${fmtQty(r.q, r.it.pk)}</small></span><span class="ir-num"><b>Rs ${num(r.rs)}</b><small class="${r.pf < 0 ? 'neg' : 'pos'}">${r.noCost ? 'nafa —' : 'Rs ' + num(r.pf) + ' · ' + pct(r.pf, r.rs) + '%'}</small></span></button>`).join('') || '<div class="nt-empty">🧾<b>Koi sale nahi</b></div>'}</div>`);
}
function dayDlg(day) { const r = agg(day, day); listDlg(`📅 ${short(day)} ${day.slice(0, 4)} · ${WD[toDate(day).getDay()]}`, r.rows.sort((x, y) => y.rs - x.rs), `Kul sale <b>Rs ${num(r.T.rs)}</b> · nafa <b>Rs ${num(r.T.pf)}</b> · ${r.T.n} items`); }
function wdDlg(g) {
  const [a, b0] = range(), b = clipEnd(b0), ds = []; for (let d = toDate(a); dayOf(d) <= b; d.setDate(d.getDate() + 1)) if (d.getDay() === g) ds.push(dayOf(d));
  if (!ds.length) { notice('Is arse mein ' + WD[g] + ' nahi'); return; }
  const M = new Map(); for (const d of ds) for (const r of agg(d, d).rows) { const o = M.get(r.it.i) || { it: r.it, q: 0, rs: 0, pf: 0, noCost: r.noCost }; o.q += r.q; o.rs += r.rs; o.pf += r.pf; M.set(r.it.i, o); }
  listDlg(`📆 ${WD[g]} ki top items (${ds.length} din)`, [...M.values()].sort((x, y) => y.rs - x.rs), `${short(a)} – ${short(b)} ke saare ${WD[g]} jama`);
}

// ---------- PDF ----------
function pdfHTML() {
  const m = monthOf(), [a, b0] = range(), b = clipEnd(b0), { rows, T } = agg(a, b), P = patterns(m).out, L = lastDay(m);
  const sec = (t, l, f) => l.length ? `<h3>${t}</h3><p>${l.slice(0, 12).map(f).join(' · ')}</p>` : '';
  return `<h1>NOOR TRADERS</h1><h2>📊 Item Sale Report — ${esc(short(a))} se ${esc(short(b))} ${esc(b.slice(0, 4))}${st.ws ? '' : ' (wholesale ke baghair)'}</h2>
    <p><b>Kul sale Rs ${num(T.rs)}</b> · nafa (andaza) Rs ${num(T.pf)} (${pct(T.pf, T.rs)}%) · ${num(T.n)} items · ${esc(new Date().toLocaleString('en-PK'))}</p>
    ${nfPdf(a, b)}
    ${phPdf()}
    ${(() => { const W = wsSplit(a, b), has = rows.filter(r => !r.noCost), plus = has.filter(r => r.pf > 0).sort((x, y) => y.pf - x.pf), loss = has.filter(r => r.pf < 0), P = plus.reduce((t, r) => t + r.pf, 0), Lr = loss.reduce((t, r) => t + r.pf, 0), none = rows.filter(r => r.noCost);   // v2.101.5: 💰 nafa kahan se
      return `<h3>💰 Nafa kahan se (Rupees)</h3><p>Kul nafa <b>Rs ${num(T.pf)}</b>${st.ws ? ` · Retail Rs ${num(W.r.pf)} (sale Rs ${num(W.r.rs)}) · Wholesale Rs ${num(W.w.pf)} (sale Rs ${num(W.w.rs)})` : ''}${loss.length ? ` · ghaata ${loss.length} items Rs ${num(Math.abs(Lr))}` : ''}${none.length ? ` · ${none.length} items ka khareed rate nahi` : ''}</p>
        <table class="iv-tbl"><thead><tr><th>#</th><th>Sab se zyada nafa</th><th>Sale Rs</th><th>Nafa Rs</th><th>Hissa</th></tr></thead><tbody>${plus.slice(0, 15).map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.it.n)}</td><td>${num(r.rs)}</td><td>${num(r.pf)}</td><td>${pct(r.pf, P)}%</td></tr>`).join('')}</tbody></table>`; })()}
    ${sec('🌅 Shuru (1–10) mein zyada', P.part[0], x => esc(x.r.it.n))}${sec('🌤 Darmiyan (11–20) mein zyada', P.part[1], x => esc(x.r.it.n))}${sec(`🌙 Aakhir (21–${L}) mein zyada`, P.part[2], x => esc(x.r.it.n))}
    ${WD_ORDER.map(g => sec(`📆 ${WD[g]} ko zyada`, P.wd[g], x => esc(x.r.it.n))).join('')}${sec('⚠️ Zyada sale, kam nafa', P.thin, x => `${esc(x.r.it.n)} (${x.x}%)`)}${sec('🔻 Ghaate mein', P.loss, x => `${esc(x.r.it.n)} (Rs ${num(x.x)})`)}
    ${(() => { const C = commAgg(a, b); return C && C.men.length ? `<h3>💰 Commission — Supply Man wise (kul Rs ${num(C.trs)} · ${num(C.tq)} packet)</h3><table class="iv-tbl"><thead><tr><th>Supply Man</th><th>Items (packet)</th><th>Packet</th><th>Commission Rs</th></tr></thead><tbody>${C.men.map(m => `<tr><td><b>${esc(m.name)}</b></td><td>${[...m.items].sort((x, y) => y[1] - x[1]).map(([it, q]) => esc(cName(it)) + ' ' + num(q)).join(', ')}</td><td>${num(m.q)}</td><td><b>${num(m.rs)}</b></td></tr>`).join('')}</tbody></table>` : ''; })()}
    <table class="iv-tbl"><thead><tr><th>#</th><th>Item</th><th>Ginti</th><th>Sale Rs</th><th>Nafa Rs</th><th>Nafa %</th><th>Fi pc nafa</th></tr></thead><tbody>
    ${rows.sort(sorter(st.sort, st.rev)).map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.it.n)}</td><td>${fmtQty(r.q, r.it.pk)}</td><td>${num(r.rs)}</td><td>${r.noCost ? '—' : num(r.pf)}</td><td>${r.noCost ? '—' : pct(r.pf, r.rs) + '%'}</td><td>${perPc(r) == null ? '—' : num(perPc(r))}</td></tr>`).join('')}</tbody></table>
    <p><small>Nafa = abhi ka khareed rate × ginti (andaza). Data: POS (Noor Traders ke andar ke bill aur cancel bahar).</small></p>`;
}

// ---------- clicks ----------
document.addEventListener('click', e => {
  if (e.target.closest?.('[data-ir-retry]')) { irepStop(); loaded = false; err = ''; slow = false; watch(); paint(); return; }   // v2.103.6: 🔄 dobara
  if (e.target.closest?.('[data-ir-pdf]')) { if (!data?.meta) { notice('Report abhi nahi aayi'); return; } const [a, b0] = range(); if (pdfOf) pdfOf(pdfHTML(), `Item sale ${a} se ${clipEnd(b0)}`); return; }
  const c = e.target.closest?.('[data-ir-cset],[data-ir-cadd],[data-ir-cdel],[data-ir-man]');
  if (c && c.closest('.ir-root')) { const d = c.dataset;
    if (d.irMan != null) { manDlg(d.irMan); return; }
    if (d.irCset != null) { cq = ''; dlg('💰 Commission items', commSetHTML()); return; }
    if (d.irCadd) { const it = index().items.find(x => String(x.i) === d.irCadd); if (!it) return; cq = ''; commSave({ ...commCfg, [d.irCadd]: { r: 10, n: it.n } }, '✓ ' + it.n + ' — Rs 10 / packet'); return; }
    if (d.irCdel) { const n = commCfg[d.irCdel]?.n || ''; if (!confirm((n || 'Yeh item') + ' commission list se hatana hai?')) return; const nx = { ...commCfg }; delete nx[d.irCdel]; commSave(nx, 'Hata diya'); return; } }
  const t = e.target.closest?.('[data-ir-item],[data-ir-mon],[data-ir-p],[data-ir-ws],[data-ir-sort],[data-ir-more],[data-ir-per],[data-ir-day],[data-ir-wd],[data-ir-tsort],[data-ir-rev],[data-ir-trev],[data-ir-tall],[data-ir-tnafa]'); if (!t) return;
  if (!t.closest('.ir-root')) return;
  const d = t.dataset;
  if (d.irItem) { itemDlg(d.irItem); return; }
  if (d.irDay) { dayDlg(d.irDay); return; }
  if (d.irWd != null) { wdDlg(Number(d.irWd)); return; }
  if (d.irMon) { st.mon = d.irMon; if (st.per === 'c') st.per = 'm'; }
  else if (d.irP) { st.per = d.irP; if (d.irP === 'c' && !(isDay(st.from) && isDay(st.to))) { const [a, b] = partRange(monthOf(), 'm'); st.from = a; st.to = clipEnd(b); } }
  else if (d.irPer) { st.per = d.irPer; document.querySelector('#summary')?.scrollIntoView?.({ behavior: 'smooth' }); }
  else if (d.irWs != null) st.ws = d.irWs === '1';
  else if (d.irSort) st.sort = d.irSort;
  else if (d.irRev != null) st.rev = d.irRev === '1';   // v2.103.3
  else if (d.irTrev != null) st.trev = d.irTrev === '1';
  else if (d.irMore != null) st.lim += 100;
  else if (d.irTsort) st.tsort = d.irTsort;   // v2.101.5
  else if (d.irTall != null) { st.tAll = d.irTall === '1'; if (!st.tAll) setTimeout(() => $('irTopSec')?.scrollIntoView?.({ behavior: 'smooth' }), 30); }
  else if (d.irTnafa != null) { st.tsort = 'pf'; st.tAll = true; st.tq = ''; setTimeout(() => $('irTopSec')?.scrollIntoView?.({ behavior: 'smooth' }), 30); }
  keep(); paint();
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t?.matches?.('[data-ir-crate]')) { const id = t.dataset.irCrate, r = Math.round(Number(t.value) * 100) / 100; if (!(r > 0)) { notice('Rate 0 se zyada likhein'); return; } commSave({ ...commCfg, [id]: { ...(commCfg[id] || {}), r } }, '✓ Rs ' + r + ' / packet'); return; }
  if (!t?.matches || !$('irRoot')) return;
  if (t.matches('[data-ir-from]')) { if (isDay(t.value)) st.from = t.value; } else if (t.matches('[data-ir-to]')) { if (isDay(t.value)) st.to = t.value; } else return;
  keep(); paint();
});
let qT = 0;
document.addEventListener('input', e => {   // v2.101.1: search par sirf neeche ki list badalti hai — input wahi rehta hai (mobile keyboard / Urdu-English keyboard theek)
  if (e.target.matches?.('[data-ir-cq]')) { cq = e.target.value || ''; clearTimeout(qT); qT = setTimeout(() => { const h = document.getElementById('irCHits'); if (h) h.innerHTML = commHitsHTML(); }, 150); return; }
  if (e.target.matches?.('[data-ir-tq]')) { st.tq = e.target.value || ''; clearTimeout(qT); qT = setTimeout(() => { const el = document.getElementById('irTop'); if (el) el.innerHTML = topHTML(); }, 200); return; }   // v2.101.5
  if (!e.target.matches?.('[data-ir-q]')) return; st.q = e.target.value || ''; st.lim = 60; clearTimeout(qT);
  qT = setTimeout(() => { const r = rowsOf(), el = document.getElementById('irRows'), n = document.getElementById('irTblN'); if (el) el.innerHTML = r.html; if (n) n.textContent = num(r.tbl.length); }, 200);
});
export const _irTest = { phAgg, setStock: f => { stockOf = f; }, nfBills, nfSum, nfHTML, nfC, nfSetT: t => { tdoc = t; }, nfSetFull: f => { full = f; }, mergeToday, ageText, setFull: (f, t) => { full = f; tdoc = t; remerge(); }, fmtQty, topHTML, nafaHTML, wsSplit, setRows: r => { lastRows = { sorted: r, srt: () => 0 }; }, agg, range, patterns, partRange, setData: d => { data = d; loaded = true; ix = null; }, st, pdfHTML, commAgg, setComm: c => { commCfg = c; } };

// v2.103.48: 🤖 agent actions — item report (nafa / sale)
import { agentRegister } from './agent.js?v=2.103.71';
agentRegister([
  { name: 'nafa_report', read: true, desc: 'Item report: muddat (from/to YYYY-MM-DD, default aaj) ki sale, nafa (andaza), top items nafa ke hisaab se; wholesale ke saath/baghair.', params: { type: 'OBJECT', properties: { from: { type: 'STRING' }, to: { type: 'STRING' }, top: { type: 'INTEGER' }, wholesale: { type: 'BOOLEAN' } } },
    run({ from, to, top, wholesale }) { if (!data?.meta) throw Error('Report abhi PC se nahi aayi'); const ws0 = st.ws; if (wholesale != null) st.ws = !!wholesale; try { const X = index(), a = /^\d{4}-\d\d-\d\d$/.test(from || '') ? from : X.days[X.days.length - 1], b = /^\d{4}-\d\d-\d\d$/.test(to || '') ? to : a, { rows, T } = agg(a, b), L = rows.filter(r => !r.noCost).sort((x, y) => y.pf - x.pf);
        return { from: a, to: b, wholesale: st.ws ? 'saath' : 'baghair', sale_rs: Math.round(T.rs), nafa_rs: Math.round(T.pf), nafa_pct: pct(T.pf, T.rs), items: T.n, top: L.slice(0, Math.min(40, Number(top) || 10)).map(r => ({ item_id: String(r.it.i), name: r.it.n, bika_rs: Math.round(r.rs), nafa_rs: Math.round(r.pf), pct: pct(r.pf, r.rs), qty: r.q })), minus: L.filter(r => r.pf < 0).slice(0, 10).map(r => ({ name: r.it.n, nafa_rs: Math.round(r.pf) })) }; } finally { st.ws = ws0; } } },
  { name: 'item_sale', read: true, desc: 'Ek item ki muddat mein bikri (ginti, Rs, nafa).', params: { type: 'OBJECT', properties: { item: { type: 'STRING' }, from: { type: 'STRING' }, to: { type: 'STRING' } }, required: ['item'] },
    run({ item, from, to }) { if (!data?.meta) throw Error('Report abhi PC se nahi aayi'); const X = index(), q = String(item).toLowerCase(), L = X.items.filter(it => it.n.toLowerCase().includes(q)); if (!L.length) throw Error('Item "' + item + '" report mein nahi'); const a = /^\d{4}-\d\d-\d\d$/.test(from || '') ? from : X.days[0], b = /^\d{4}-\d\d-\d\d$/.test(to || '') ? to : X.days[X.days.length - 1];
      return { from: a, to: b, list: L.slice(0, 5).map(it => { const s = sumItem(it, a, b); return { name: it.n, qty: s.q, bika_rs: Math.round(s.rs), nafa_rs: s.noCost ? null : Math.round(s.pf) }; }) }; } },
  { name: 'nafa_pdf', icon: '📄', label: 'Nafa PDF', desc: 'Item-war nafa ki PDF (kholo / WhatsApp): top 20 / sab / minus.', params: { type: 'OBJECT', properties: { filter: { type: 'STRING', enum: ['top', 'all', 'loss'] } } },
    summary({ filter }) { if (!data?.meta) throw Error('Report abhi nahi aayi'); return `📄 Nafa PDF — ${filter === 'loss' ? 'minus wale' : filter === 'all' ? 'sab items' : 'top 20'}`; },
    run({ filter }) { pfT = { f: filter || 'top', q: '' }; pfPdf(); return '📄 PDF khul gayi'; } },
  { name: 'sale_report_pdf', icon: '📄', label: 'Item sale PDF', desc: 'Item report (sale) ki PDF.', params: { type: 'OBJECT', properties: {} }, summary() { if (!data?.meta) throw Error('Report abhi nahi aayi'); return '📄 Item sale report PDF'; }, run() { const [a, b0] = range(); if (pdfOf) pdfOf(pdfHTML(), `Item sale ${a} se ${clipEnd(b0)}`); return '📄 PDF khul gayi'; } },
]);
