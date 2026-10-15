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
const LS = 'sam-irep';
const st = (() => { let v = {}; try { v = JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch {} return { mon: v.mon || '', per: v.per || 'm', from: v.from || '', to: v.to || '', ws: v.ws !== false, sort: v.sort || 'rs', q: '', lim: 60 }; })();
const keep = () => { try { localStorage.setItem(LS, JSON.stringify({ mon: st.mon, per: st.per, from: st.from, to: st.to, ws: st.ws, sort: st.sort })); } catch {} };

export function irepSetup(o) { cloud = o.cloud || cloud; notice = o.notice || notice; pdfOf = o.pdf || pdfOf; }
export function irepStop() { if (stop) { try { stop(); } catch {} stop = null; } if (cStop) { try { cStop(); } catch {} cStop = null; } }
function watch() {
  if (!cStop && cloud?.listenCommission) cStop = cloud.listenCommission(m => { commCfg = m || {}; if ($('irRoot')) paint(); if (document.querySelector('.ir-cset')) commSetPaint(); });
  if (stop || !cloud?.listenItemReport) return;
  stop = cloud.listenItemReport((d, e) => { loaded = true; if (d) { data = d; err = ''; ix = null; } else err = e?.code || e?.message || 'masla'; if ($('irRoot')) paint(); });
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
const fmtQty = (q, pk) => { q = Math.round(q * 1000) / 1000; if (pk > 1 && Math.abs(q) >= pk) { const c = Math.trunc(q / pk), p = Math.round((q - c * pk) * 1000) / 1000; return `${num(c)} ctn${p ? ' + ' + num(p) : ''}`; } return num(q) + ' pcs'; };

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
function topChart(rows, n = 12) {
  const top = rows.slice().sort((x, y) => y.rs - x.rs).slice(0, n), max = Math.max(1, ...top.map(r => r.rs));
  return `<div class="ir-top">${top.map((r, i) => { const w = Math.max(2, r.rs / max * 100), pw = r.rs > 0 && r.pf > 0 ? Math.min(100, r.pf / r.rs * 100) : 0;
    return `<button type="button" class="ir-tr" data-ir-item="${esc(String(r.it.i))}"><span class="ir-rk">${i + 1}</span><span class="ir-tn"><b>${esc(r.it.n)}</b><i class="ir-tb" style="width:${w}%"><u style="width:${pw}%"></u></i><small>${fmtQty(r.q, r.it.pk)} · nafa ${r.noCost ? '—' : 'Rs ' + num(r.pf) + ' (' + pct(r.pf, r.rs) + '%)'}</small></span><b class="ir-ta">Rs ${k1(r.rs)}</b></button>`; }).join('')}</div>`;
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
function ageText() { const at = Number(data?.meta?.at) || 0; if (!at) return ['', false]; const m = Math.round((Date.now() - at) / 60000); return [`🖥 PC ka data: ${m < 1 ? 'abhi' : m < 60 ? m + ' min pehle' : Math.round(m / 60) + ' ghante pehle'} (har ghante taza)`, m > 150]; }
let lastRows = null;
function rowsOf() {
  const { sorted, srt } = lastRows || { sorted: [], srt: () => 0 };
  const qn = st.q.trim().toLowerCase(), tbl = sorted.filter(r => !qn || r.it.n.toLowerCase().includes(qn)).sort(srt), shown = tbl.slice(0, st.lim);
  return { tbl, shown, html: `<div class="ir-tbl">${shown.map(r => `<button type="button" class="ir-row" data-ir-item="${esc(String(r.it.i))}"><span><b>${esc(r.it.n)}</b><small>${fmtQty(r.q, r.it.pk)}</small></span><span class="ir-num"><b>Rs ${num(r.rs)}</b><small class="${r.pf < 0 ? 'neg' : 'pos'}">${r.noCost ? 'nafa —' : 'Rs ' + num(r.pf) + ' · ' + pct(r.pf, r.rs) + '%'}</small></span></button>`).join('') || '<div class="nt-empty">🔍<b>Kuch nahi mila</b></div>'}</div>
    ${tbl.length > shown.length ? `<button type="button" class="sh-wide" data-ir-more="1">⬇️ Aur dikhao (${num(tbl.length - shown.length)})</button>` : ''}` };
}
function paint() {
  const root = $('irRoot'); if (!root) return;
  if (!loaded) { root.innerHTML = '<div class="nt-empty">⏳<b>Report aa rahi hai…</b></div>'; return; }
  if (!data?.meta || !index().items.length) { root.innerHTML = `<div class="nt-empty">📊<b>${err ? 'Report nahi khuli' : 'PC se abhi data nahi aaya'}</b><small>${err ? esc(err === 'permission-denied' ? 'Is login ko ijazat nahi' : err) : 'Server PC par "Sale / purchase data" (KHATA-DOCTOR) har ghante chalti hai — pehli dafa 1 ghante tak lag sakta hai'}</small></div>`; return; }
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
  const srt = { rs: (x, y) => y.rs - x.rs, pf: (x, y) => y.pf - x.pf, pm: (x, y) => pct(y.pf, y.rs) - pct(x.pf, x.rs), q: (x, y) => y.q - x.q }[st.sort] || ((x, y) => y.rs - x.rs);
  lastRows = { sorted, srt };   // v2.99.95: search par sirf list badle (keyboard na toote)
  const { tbl, shown, html: rowsH } = rowsOf();
  const chips = (list, attr, on) => `<div class="mchips">${list.map(([k, l]) => `<button type="button" class="rc${on(k) ? ' on' : ''}" ${attr}="${esc(k)}">${esc(l)}</button>`).join('')}</div>`;
  const perLabel = st.per === 'c' ? `${short(a)} – ${short(b)}` : `${(PERS.find(p => p[0] === st.per) || PERS[3])[1]} · ${short(a)} – ${short(b)}`;
  root.innerHTML = `<div class="bc-head ir-head">
    ${chips(X.mons.map(mm => [mm, monLabel(mm)]), 'data-ir-mon', k => k === m)}
    ${chips(PERS.filter(([k]) => !/^w5$/.test(k) || L > 28), 'data-ir-p', k => k === st.per)}
    ${st.per === 'c' ? `<div class="lk-filter ir-cf"><label>Tareekh se<input type="date" data-ir-from value="${esc(st.from || a)}" min="${esc(X.days[0] || '')}" max="${esc(X.days.slice(-1)[0] || '')}"></label><label>Tareekh tak<input type="date" data-ir-to value="${esc(st.to || b)}" min="${esc(X.days[0] || '')}" max="${esc(X.days.slice(-1)[0] || '')}"></label></div>` : ''}
    <div class="mchips"><button type="button" class="rc${st.ws ? ' on' : ''}" data-ir-ws="1">${st.ws ? '☑' : '☐'} 📦 Wholesale ke saath</button><button type="button" class="rc${st.ws ? '' : ' on'}" data-ir-ws="0">${st.ws ? '☐' : '☑'} Wholesale ke baghair</button></div>
    <div class="ir-hero"><small>${esc(perLabel)}</small><strong>Rs ${num(T.rs)}</strong><span>sale · ${num(T.n)} items</span>
      <div class="ir-kp"><div><b class="${T.pf < 0 ? 'neg' : ''}">Rs ${num(T.pf)}</b><small>nafa (andaza)</small></div><div><b>${pct(T.pf, T.rs)}%</b><small>nafa %</small></div><div><b>${num(pd.length ? T.rs / pd.length : 0)}</b><small>roz ki sale</small></div></div></div>
    <p class="lk-age${old ? ' warn' : ''}">${esc(age)}${T.noCost ? ` · ${T.noCost} items ka khareed rate nahi (nafa mein nahi)` : ''}</p></div>
  ${commHTML(a, b)}
  <section class="ir-sec"><div class="ir-sh"><b>🏆 Sab se zyada bikne wali</b><small>tap = item ki poori kahani</small></div>${legend()}${topChart(rows)}</section>
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
    ${chips([['rs', 'Sale'], ['pf', 'Nafa'], ['pm', 'Nafa %'], ['q', 'Ginti']], 'data-ir-sort', k => k === st.sort)}
    <label class="hs-search"><input type="search" data-ir-q="1" placeholder="🔍 item dhoondo…" value="${esc(st.q)}"></label>
    <div id="irRows">${rowsH}</div></section>`;
}

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
    ${sec('🌅 Shuru (1–10) mein zyada', P.part[0], x => esc(x.r.it.n))}${sec('🌤 Darmiyan (11–20) mein zyada', P.part[1], x => esc(x.r.it.n))}${sec(`🌙 Aakhir (21–${L}) mein zyada`, P.part[2], x => esc(x.r.it.n))}
    ${WD_ORDER.map(g => sec(`📆 ${WD[g]} ko zyada`, P.wd[g], x => esc(x.r.it.n))).join('')}${sec('⚠️ Zyada sale, kam nafa', P.thin, x => `${esc(x.r.it.n)} (${x.x}%)`)}${sec('🔻 Ghaate mein', P.loss, x => `${esc(x.r.it.n)} (Rs ${num(x.x)})`)}
    ${(() => { const C = commAgg(a, b); return C && C.men.length ? `<h3>💰 Commission — Supply Man wise (kul Rs ${num(C.trs)} · ${num(C.tq)} packet)</h3><table class="iv-tbl"><thead><tr><th>Supply Man</th><th>Items (packet)</th><th>Packet</th><th>Commission Rs</th></tr></thead><tbody>${C.men.map(m => `<tr><td><b>${esc(m.name)}</b></td><td>${[...m.items].sort((x, y) => y[1] - x[1]).map(([it, q]) => esc(cName(it)) + ' ' + num(q)).join(', ')}</td><td>${num(m.q)}</td><td><b>${num(m.rs)}</b></td></tr>`).join('')}</tbody></table>` : ''; })()}
    <table class="iv-tbl"><thead><tr><th>#</th><th>Item</th><th>Ginti</th><th>Sale Rs</th><th>Nafa Rs</th><th>Nafa %</th></tr></thead><tbody>
    ${rows.sort((x, y) => y.rs - x.rs).slice(0, 400).map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.it.n)}</td><td>${fmtQty(r.q, r.it.pk)}</td><td>${num(r.rs)}</td><td>${r.noCost ? '—' : num(r.pf)}</td><td>${r.noCost ? '—' : pct(r.pf, r.rs) + '%'}</td></tr>`).join('')}</tbody></table>
    <p><small>Nafa = abhi ka khareed rate × ginti (andaza). Data: POS (Noor Traders ke andar ke bill aur cancel bahar).</small></p>`;
}

// ---------- clicks ----------
document.addEventListener('click', e => {
  if (e.target.closest?.('[data-ir-pdf]')) { if (!data?.meta) { notice('Report abhi nahi aayi'); return; } const [a, b0] = range(); if (pdfOf) pdfOf(pdfHTML(), `Item sale ${a} se ${clipEnd(b0)}`); return; }
  const c = e.target.closest?.('[data-ir-cset],[data-ir-cadd],[data-ir-cdel],[data-ir-man]');
  if (c && c.closest('.ir-root')) { const d = c.dataset;
    if (d.irMan != null) { manDlg(d.irMan); return; }
    if (d.irCset != null) { cq = ''; dlg('💰 Commission items', commSetHTML()); return; }
    if (d.irCadd) { const it = index().items.find(x => String(x.i) === d.irCadd); if (!it) return; cq = ''; commSave({ ...commCfg, [d.irCadd]: { r: 10, n: it.n } }, '✓ ' + it.n + ' — Rs 10 / packet'); return; }
    if (d.irCdel) { const n = commCfg[d.irCdel]?.n || ''; if (!confirm((n || 'Yeh item') + ' commission list se hatana hai?')) return; const nx = { ...commCfg }; delete nx[d.irCdel]; commSave(nx, 'Hata diya'); return; } }
  const t = e.target.closest?.('[data-ir-item],[data-ir-mon],[data-ir-p],[data-ir-ws],[data-ir-sort],[data-ir-more],[data-ir-per],[data-ir-day],[data-ir-wd]'); if (!t) return;
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
  else if (d.irMore != null) st.lim += 100;
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
document.addEventListener('input', e => {   // v2.99.95: search par sirf neeche ki list badalti hai — input wahi rehta hai (mobile keyboard / Urdu-English keyboard theek)
  if (e.target.matches?.('[data-ir-cq]')) { cq = e.target.value || ''; clearTimeout(qT); qT = setTimeout(() => { const h = document.getElementById('irCHits'); if (h) h.innerHTML = commHitsHTML(); }, 150); return; }
  if (!e.target.matches?.('[data-ir-q]')) return; st.q = e.target.value || ''; st.lim = 60; clearTimeout(qT);
  qT = setTimeout(() => { const r = rowsOf(), el = document.getElementById('irRows'), n = document.getElementById('irTblN'); if (el) el.innerHTML = r.html; if (n) n.textContent = num(r.tbl.length); }, 200);
});
export const _irTest = { agg, range, patterns, partRange, setData: d => { data = d; loaded = true; ix = null; }, st, pdfHTML, commAgg, setComm: c => { commCfg = c; } };
