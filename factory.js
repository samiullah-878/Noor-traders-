// factory.js — v2.99.88: 🏭 FACTORY PRODUCTION (malik: "apni factory ki items — formula, batch, larka OK kare to POS stock khud +/−, rates khud,
//   batch ka barcode label, raw maal ki purchase"). Naqsha: Design artifact "Factory Production — naqsha".
// Items: POS ki category mein 'factory' (pos-stock isFactory) — jis ka FORMULA bana = tayyar maal, baqi = raw maal. Stock / rate POS se (posStock).
// Firestore: factory/cfg {formulas:{itemId:{per, lines:[{id,q}], lab, gas, cpp, at} | null}, wm, rm, lbl} (sirf malik likhe) ·
//   factoryBatches/<id> {no, itemId, n (1–10), per, out, lines:[{id,name,q,c}], cost, oh, labels:[…], status 'new'} — larka (Full / Stock) banaye;
//   PC factory-post.js: POS Adjustment (+ tayyar maal, − raw maal; dukan godam) -> status 'posted' + adjNo, phir label jobs (batch no ke saath).
//   Malik: 'cancelReq' (ulta Adjustment) / 'new' dobara. Rate: pos-stock stockAgentItemSave (itemJobs, PC item-post) — malik dabaye tab.
// Tez: OK = setDoc foran (intezar nahi) — list mein "⏳ PC ko ja raha" foran. Yahan AI NAHI.
import { stockAgentReady, stockFactoryList, stockFactoryCanRate, stockAgentItemSave, stockPickList, stockRepaint, stockIsFactoryCat } from './pos-stock.js?v=2.99.90';
// v2.99.89: ☑ FACTORY ITEMS TICK SE (malik: "check box de do items list mein — factory mein items aa jayein") — factory/cfg.items {id: true | false | null}:
//   true = malik ne ☑ kiya, false = category wali ko hataya, null = category ke hisaab se. Factory screen "☑ Factory items chunein" + stock screen har item par ☐ 🏭 Factory.

const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = n => new Intl.NumberFormat('en-PK', { maximumFractionDigits: 2 }).format(Number(n) || 0);
const rs = n => 'Rs ' + new Intl.NumberFormat('en-PK').format(Math.round(Number(n) || 0));
const r2 = n => Math.round((Number(n) || 0) * 100) / 100, r3 = n => Math.round((Number(n) || 0) * 1000) / 1000;
const p2 = n => String(n).padStart(2, '0');
const dayOf = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const today = () => dayOf(new Date());
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const clock = t => new Date(t).toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit' });
const short = t => { const d = new Date(t); return d.getDate() + ' ' + MON[d.getMonth()] + ' · ' + clock(t); };
// ginti -> "5 ctn + 3" (POS jaisa)
function qt(q, it) {
  q = r3(q); const pk = Number(it?.pack) || 0, cn = (it?.cn || 'Ctn').toLowerCase(), un = (it?.un || 'Pcs').toLowerCase();
  if (pk > 1) { const neg = q < 0, a = Math.abs(q), c = Math.floor(a / pk + 1e-9), p = r3(a - c * pk); return (neg ? '−' : '') + (c ? num(c) + ' ' + cn : '') + (c && p ? ' + ' : '') + (p || !c ? num(p) + (c ? '' : ' ' + un) : ''); }
  return num(q) + ' ' + un;
}

let cloud = null, notice = () => {}, pdfOf = null, canOf = () => true, ownerOf = () => false, whoOf = () => '', goPurchase = null, batchOf = null;
let cfg = null, cfgStop = null, batches = [], bStop = null, bFrom = 0, items = [], byId = new Map(), itemsOk = false, itemsErr = '';
const LS = 'sam-fac';
const st = (() => { let v = {}; try { v = JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch {} return { per: v.per || 'aaj', pg: v.pg || 'home' }; })();
const keep = () => { try { localStorage.setItem(LS, JSON.stringify({ per: st.per, pg: st.pg })); } catch {} };
let fb = null;   // batch form ki haalat
let fe = null;   // formula editor ki haalat

export function factorySetup(o) { cloud = o.cloud || cloud; notice = o.notice || notice; pdfOf = o.pdf || pdfOf; canOf = o.can || canOf; ownerOf = o.owner || ownerOf; whoOf = o.who || whoOf; goPurchase = o.purchase || goPurchase; batchOf = o.batch || batchOf; }
export function factoryStop() { if ($('fcBatch') || $('fcForm') || $('fcPick')) return;   // stock screen se khula batch / formula — listener zinda rahe
  if (bStop) { try { bStop(); } catch {} bStop = null; } }   // v2.99.89: cfg (1 doc) zinda — stock screen ke ☐ 🏭 Factory ke liye
const isOwner = () => { try { return !!ownerOf(); } catch { return false; } };
export const canFacBatch = () => { try { return isOwner() || (batchOf ? !!batchOf() : false); } catch { return false; } };

function watchCfg() { if (!cfgStop && cloud?.listenFactory) cfgStop = cloud.listenFactory(c => { if (c) cfg = c; else if (!cfg) cfg = {}; repaint(); try { stockRepaint(); } catch {} }); }
const facPick = r => { const v = cfg?.items?.[String(r.id)]; return v === true ? true : v === false ? false : null; };
const facIs = r => { const v = facPick(r); return v == null ? stockIsFactoryCat(r) : v; };
window.ntFacIs = r => { watchCfg(); return facIs(r); };
function watch() {
  watchCfg();
  const d = new Date(); d.setHours(0, 0, 0, 0); const wk = new Date(d); wk.setDate(wk.getDate() - 6); const mo = new Date(d.getFullYear(), d.getMonth(), 1);
  const from = Math.min(wk.getTime(), mo.getTime());
  if (bStop && bFrom === from) return;
  if (bStop) { try { bStop(); } catch {} } bFrom = from;
  bStop = cloud?.listenFactoryBatches ? cloud.listenFactoryBatches(from, (l, e) => { if (l) batches = l; else if (e) notice('Factory batch nahi parhe: ' + (e.code || e.message || e)); repaint(); }) : null;
}
function loadItems() {
  try { items = stockFactoryList(facPick); byId = new Map(items.map(x => [x.id, x])); itemsOk = true; } catch (e) { itemsErr = e?.message || String(e); }
}
async function ensureItems() {
  if (itemsOk) { loadItems(); return true; }
  try { await stockAgentReady(); loadItems(); return true; } catch (e) { itemsErr = e?.message || String(e); repaint(); return false; }
}
const forms = () => Object.fromEntries(Object.entries(cfg?.formulas || {}).filter(([, v]) => v && v.per > 0));
const finished = () => { const F = forms(); return items.filter(x => F[x.id]); };
const rawItems = () => { const F = forms(); return items.filter(x => !F[x.id]); };
const wm = () => Number(cfg?.wm ?? 10), rm = () => Number(cfg?.rm ?? 15);
// laagat: n batch ka raw + mazdoori / gas
function costOf(f, n = 1) {
  const lines = (f?.lines || []).map(l => { const it = byId.get(String(l.id)); const q = r3((Number(l.q) || 0) * n), c = Number(it?.prate) || 0; return { id: String(l.id), name: it?.name || 'Item ' + l.id, it, q, c, rs: q * c, stock: Number(it?.stock) || 0 }; });
  const raw = lines.reduce((s, l) => s + l.rs, 0), oh = ((Number(f?.lab) || 0) + (Number(f?.gas) || 0)) * n, out = (Number(f?.per) || 0) * n;
  return { lines, raw, oh, total: raw + oh, out, cpp: out ? (raw + oh) / out : 0, noRate: lines.filter(l => !l.c).length };
}
// naye rate (fi piece POS jaisa): khula piece upar 1 Rs tak, carton upar 5 Rs tak
function suggest(it, cpp) {
  const pk = Number(it.pack) || 0, w = cpp * (1 + wm() / 100), r = cpp * (1 + rm() / 100);
  const ctn = x => pk > 1 ? Math.ceil(x * pk / 5) * 5 : 0;
  return { wctn: ctn(w), wpcs: Math.ceil(w), rctn: ctn(r), rpcs: Math.ceil(r) };
}
const curRates = it => { const pk = Number(it.pack) || 0, c = x => pk > 1 ? Math.round(x * pk) : 0; return { wctn: c(it.wrate), wpcs: r2(it.ws), rctn: c(it.rate), rpcs: r2(it.rate2) }; };

// ---------- waqt ----------
function perRange(k = st.per) {
  const d = new Date(); d.setHours(0, 0, 0, 0); const t = d.getTime(), D = 86400000;
  if (k === 'hafta') return [t - 6 * D, t + D];
  if (k === 'mahina') return [new Date(d.getFullYear(), d.getMonth(), 1).getTime(), t + D];
  return [t, t + D];
}
const PER = [['aaj', 'Aaj'], ['hafta', '7 din'], ['mahina', 'Is mahina']];
const inPer = b => { const [a, z] = perRange(); return b.at >= a && b.at < z; };
const STAT = {
  new: ['wait', '⏳ PC ko ja raha'], posted: ['ok', '✓ POS mein'], error: ['bad', '❌ Masla'], cancelReq: ['wait', '↩ Wapas ho raha'], cancelled: ['off', '↩ Wapas ho gaya'],
};
const statOf = b => b._pend ? ['wait', '⏳ Bhej raha…'] : (STAT[b.status] || ['wait', b.status]);

// ---------- screen ----------
export function renderFactory() {
  watch();
  $('summary').innerHTML = '<div class="bc-root ir-root fc-root" id="fcRoot"></div>';
  if ($('list')) $('list').innerHTML = '';
  $('actions').innerHTML = '<button class="got" data-fc-pdf="1">📄 Production PDF · WhatsApp</button>';
  paint();
  ensureItems().then(ok => { if (ok) paint(); });
}
let rpT = 0;
function repaint() { clearTimeout(rpT); rpT = setTimeout(() => { if ($('fcRoot')) { loadItemsQuiet(); paint(); } if (fb && $('fcBatch')) batchPaint(); if (fe && $('fcForm')) formPaint(); }, 30); }
const loadItemsQuiet = () => { if (itemsOk) loadItems(); };
function paint() {
  const root = $('fcRoot'); if (!root) return;
  const B = batches.filter(inPer), live = B.filter(b => b.status !== 'cancelled' && b.status !== 'cancelReq');
  const tot = live.reduce((s, b) => s + (Number(b.cost) || 0), 0), nb = live.reduce((s, b) => s + (Number(b.n) || 0), 0);
  const F = forms(), own = isOwner();
  // alerts: laagat barhi (formula save ke waqt se ≥3%)
  const up = itemsOk ? finished().map(it => { const f = F[it.id], c = costOf(f).cpp; return { it, c, old: Number(f.cpp) || 0 }; }).filter(x => x.old > 0 && x.c >= x.old * 1.03) : [];
  const errs = batches.filter(b => b.status === 'error');
  const kp = (b, s) => `<div><b>${b}</b><small>${s}</small></div>`;
  root.innerHTML = `
  <div class="ir-hero fc-hero"><small>NOOR TRADERS · APNI FACTORY</small><strong>🏭 Factory Production</strong>
    <div class="fc-per">${PER.map(([k, l]) => `<button type="button" class="${st.per === k ? 'on' : ''}" data-fc-per="${k}">${l}</button>`).join('')}</div>
    <div class="ir-kp">${kp(num(live.length), 'batch slip')}${kp(num(nb), 'batch (1–10)')}${kp(rs(tot), 'laagat')}</div></div>
  ${itemsErr && !itemsOk ? `<p class="ir-say">⏳ Stock load nahi hua: ${esc(itemsErr)}</p>` : ''}
  <div class="fc-acts">
    ${canFacBatch() ? `<button type="button" class="fc-act go" data-fc-batch="1"><span class="fc-ic">➕</span><b>Naya batch</b><small>larka bana kar OK kare</small></button>` : ''}
    ${own ? `<button type="button" class="fc-act" data-fc-pg="formulas"><span class="fc-ic">🧪</span><b>Formulas</b><small>${num(Object.keys(F).length)} item ka nuskha</small></button>` : ''}
    ${own ? `<button type="button" class="fc-act" data-fc-pg="rates"><span class="fc-ic">🏷</span><b>Rates</b><small>${up.length ? num(up.length) + ' ki laagat barhi' : 'laagat + nafa'}</small></button>` : ''}
    <button type="button" class="fc-act" data-fc-pg="raw"><span class="fc-ic">📦</span><b>Raw maal</b><small>${itemsOk ? num(rawItems().length) + ' cheezen' : '…'}</small></button>
  </div>
  ${own ? `<button type="button" class="fc-pickbtn" data-fc-pick="1">☑ Factory items chunein <small>${itemsOk ? num(items.length) + ' factory mein' : ''}</small></button>` : ''}
  ${itemsOk && !items.length ? `<p class="ir-say">Abhi factory mein koi item nahi — upar <b>☑ Factory items chunein</b> se tick lagayein (ya POS mein category mein "factory").</p>` : ''}
  ${'' && itemsOk && !items.length ? `<p class="ir-say">POS mein abhi koi item <b>"factory"</b> wali category mein nahi. Tayyar maal aur raw maal ko POS mein category <b>apni factory</b> / <b>factory raw</b> mein daalein — 2 min mein yahan aa jayengi.</p>` : ''}
  ${up.length && own ? `<div class="fc-alert"><span>⚠️</span><div><b>${up.map(x => esc(x.it.name)).slice(0, 3).join(', ')}</b> ki laagat barh gayi (+${Math.round((up[0].c / up[0].old - 1) * 100)}%) — rate dekh lein.</div><button type="button" data-fc-pg="rates">Dekhein</button></div>` : ''}
  ${errs.length ? `<div class="fc-alert bad"><span>❌</span><div><b>${num(errs.length)} batch POS mein nahi gaye</b> — tap kar ke wajah dekhein.</div></div>` : ''}
  ${st.pg === 'formulas' && own ? formulasHTML() : st.pg === 'rates' && own ? ratesHTML() : st.pg === 'raw' ? rawHTML() : ''}
  <section class="ir-sec"><div class="ir-sh"><b>${PER.find(p => p[0] === st.per)?.[1] || ''} ke batch</b><small>${num(B.length)}</small></div>
    <div class="fc-list">${B.map(batchCard).join('') || `<div class="nt-empty">🏭<b>Is waqt mein koi batch nahi</b>${canFacBatch() ? '<small>Upar "➕ Naya batch" dabayein</small>' : ''}</div>`}</div></section>`;
}
function batchCard(b) {
  const [c, t] = statOf(b), it = byId.get(String(b.itemId));
  return `<button type="button" class="fc-bt" data-fc-b="${esc(b.id)}"><span class="fc-dot ${c}"></span><span class="fc-bn"><b>${esc(b.name)}</b><small>${esc(b.no)} · ${num(b.n)} batch · ${esc(qt(b.out, it))} · ${esc(b.byName || '')} · ${esc(clock(b.at))}</small></span><span class="fc-st ${c}">${esc(t)}</span></button>`;
}

// ---------- 🧪 formulas (malik) ----------
function formulasHTML() {
  const F = forms(), fin = finished();
  return `<section class="ir-sec"><div class="ir-sh"><b>🧪 Formulas</b><button type="button" class="fc-x" data-fc-pg="home">✕</button></div>
    <div class="ir-tbl">${fin.map(it => { const c = costOf(F[it.id]); return `<button type="button" class="ir-row" data-fc-f="${esc(it.id)}"><span><b>${esc(it.name)}</b><small>1 batch = ${esc(qt(F[it.id].per, it))} · ${num(F[it.id].lines?.length || 0)} raw${c.noRate ? ' · ⚠️ ' + c.noRate + ' ka rate nahi' : ''}</small></span><span class="ir-num"><b>${rs(c.cpp)} / ${esc((it.un || 'pcs').toLowerCase())}</b><small>${it.pack > 1 ? rs(c.cpp * it.pack) + ' / ctn' : ''}</small></span></button>`; }).join('') || '<p class="lk-note">Abhi koi formula nahi.</p>'}</div>
    <div class="fc-sub">Formula banao — tayyar maal chunein:</div>
    <label class="hs-search"><input type="search" data-fc-fq="1" placeholder="🔍 item ka naam…" value="${esc(fq)}"></label>
    <div class="ir-tbl">${items.filter(x => !F[x.id] && (!fq || x.name.toLowerCase().includes(fq.toLowerCase()))).slice(0, 12).map(x => `<button type="button" class="ir-row" data-fc-f="${esc(x.id)}"><span><b>${esc(x.name)}</b><small>${esc(x.cat)}</small></span><span class="ir-num"><b>➕ Formula</b></span></button>`).join('')}</div></section>`;
}
let fq = '', rq = '';
function openFormula(id) {
  const it = byId.get(String(id)); if (!it) return;
  const f = forms()[it.id];
  fe = { id: it.id, per: f?.per || (it.pack > 1 ? it.pack * 5 : 100), lines: (f?.lines || []).map(l => ({ id: String(l.id), q: Number(l.q) || 0 })), lab: Number(f?.lab) || 0, gas: Number(f?.gas) || 0, q: '' };
  dlg('🧪 Formula — ' + it.name, '<div id="fcForm"></div>'); formPaint();
}
function formPaint() {
  const el = $('fcForm'); if (!el || !fe) return; const it = byId.get(fe.id); if (!it) return;
  const c = costOf(fe), sg = suggest(it, c.cpp), cr = curRates(it);
  const hits = fe.q.trim().length >= 2 ? items.filter(x => x.id !== fe.id && !fe.lines.some(l => l.id === x.id) && x.name.toLowerCase().includes(fe.q.trim().toLowerCase())).slice(0, 10) : [];
  const keepF = document.activeElement?.dataset?.fcFq2 != null;
  el.innerHTML = `<section class="ir-sec"><div class="fc-batchrow"><span>1 batch =</span><input type="number" inputmode="decimal" min="1" step="any" data-fe-per="1" value="${esc(String(fe.per))}"><span>${esc((it.un || 'pcs').toLowerCase())}${it.pack > 1 ? ' (' + esc(qt(fe.per, it)) + ')' : ''}</span></div></section>
    <section class="ir-sec"><div class="ir-sh"><b>Raw maal (1 batch)</b><small>rate = abhi ka khareed</small></div>
      <div class="ir-tbl">${c.lines.map((l, i) => `<div class="ir-row"><span><b>${esc(l.name)}</b><small>${esc((l.it?.un || 'pcs').toLowerCase())} × ${l.c ? rs(l.c) : '⚠️ rate nahi'}</small></span><span class="fc-crow"><input type="number" inputmode="decimal" min="0" step="any" data-fe-q="${i}" value="${esc(String(fe.lines[i].q))}"><b>${rs(l.rs)}</b><button type="button" class="ir-cx" data-fe-del="${i}">✕</button></span></div>`).join('') || '<p class="lk-note">Neeche se raw maal jorein.</p>'}</div>
      <label class="hs-search"><input type="search" data-fc-fq2="1" placeholder="➕ raw maal ka naam (factory category)…" value="${esc(fe.q)}"></label>
      <div class="ir-tbl">${hits.map(x => `<button type="button" class="ir-row" data-fe-add="${esc(x.id)}"><span><b>${esc(x.name)}</b><small>stock ${esc(qt(x.stock, x))} · ${x.prate ? rs(x.prate) + ' / ' + esc((x.un || 'pcs').toLowerCase()) : 'rate nahi'}</small></span><span class="ir-num"><b>➕</b></span></button>`).join('')}</div></section>
    <section class="ir-sec"><div class="ir-sh"><b>Batch ka baqi kharcha</b></div>
      <div class="fc-two"><label>Mazdoori Rs<input type="number" inputmode="decimal" min="0" data-fe-lab="1" value="${fe.lab || ''}" placeholder="0"></label><label>Gas / bijli Rs<input type="number" inputmode="decimal" min="0" data-fe-gas="1" value="${fe.gas || ''}" placeholder="0"></label></div></section>
    <section class="ir-sec fc-sum"><div class="fc-sumrow"><span>Laagat 1 batch</span><b>${rs(c.total)}</b></div><div class="fc-sumrow"><span>Laagat fi ${esc((it.un || 'pcs').toLowerCase())}</span><b>${rs(c.cpp)}${it.pack > 1 ? ' · ' + rs(c.cpp * it.pack) + ' / ctn' : ''}</b></div>
      <div class="fc-sumrow"><span>Naye rate (W ${wm()}% · R ${rm()}%)</span><b>${it.pack > 1 ? 'W ' + num(sg.wctn) + '/' + num(sg.wpcs) + ' · R ' + num(sg.rctn) + '/' + num(sg.rpcs) : 'W ' + num(sg.wpcs) + ' · R ' + num(sg.rpcs)}</b></div>
      <div class="fc-sumrow"><span>Abhi POS mein</span><b>${it.pack > 1 ? 'W ' + num(cr.wctn) + '/' + num(cr.wpcs) + ' · R ' + num(cr.rctn) + '/' + num(cr.rpcs) : 'W ' + num(cr.wpcs) + ' · R ' + num(cr.rpcs)}</b></div></section>
    <div class="fc-btns">${forms()[fe.id] ? '<button type="button" class="fc-no" data-fe-rm="1">🗑 Formula hatao</button>' : ''}<button type="button" class="fc-go" data-fe-save="1">✓ Formula save</button></div>`;
  if (keepF) { const i = el.querySelector('[data-fc-fq2]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
}
async function formSave(del) {
  if (!fe) return; if (!cloud?.setFactoryCfg) { notice('App update karein'); return; }
  const it = byId.get(fe.id);
  if (!del) {
    if (!(fe.per > 0)) { notice('1 batch mein kitne bante hain — likhein'); return; }
    const lines = fe.lines.filter(l => l.q > 0); if (!lines.length) { notice('Kam se kam ek raw maal (ginti ke saath) jorein'); return; }
    fe.lines = lines;
  } else if (!confirm('Is item ka formula hatana hai?')) return;
  const c = costOf(fe);
  const v = del ? null : { per: r3(fe.per), lines: fe.lines.map(l => ({ id: l.id, q: r3(l.q) })), lab: r2(fe.lab), gas: r2(fe.gas), cpp: r2(c.cpp), at: Date.now() };
  try { await cloud.setFactoryCfg({ formulas: { [fe.id]: v } }); notice(del ? 'Formula hata diya' : '✓ ' + (it?.name || '') + ' ka formula save'); fe = null; $('dialog')?.close(); repaint(); }
  catch (e) { notice('Save nahi hua: ' + (e?.message || e)); }
}

// ---------- 🏷 rates (malik) ----------
function ratesHTML() {
  const F = forms(), can = stockFactoryCanRate();
  const rows = finished().map(it => { const c = costOf(F[it.id]); return { it, c, sg: suggest(it, c.cpp), cr: curRates(it) }; });
  const diff = x => ['wctn', 'wpcs', 'rctn', 'rpcs'].some(k => (x.it.pack > 1 || k.endsWith('pcs')) && Math.abs((x.sg[k] || 0) - (x.cr[k] || 0)) >= 1);
  const todo = rows.filter(diff);
  const cell = (k, lab, x) => (x.it.pack > 1 || k.endsWith('pcs')) ? `<div class="fc-rb"><small>${lab}</small>${Math.abs((x.sg[k] || 0) - (x.cr[k] || 0)) >= 1 ? `<s>${num(x.cr[k])}</s><b>${num(x.sg[k])}</b>` : `<b class="same">${num(x.cr[k])}</b>`}</div>` : '';
  return `<section class="ir-sec"><div class="ir-sh"><b>🏷 Rates — laagat + nafa</b><button type="button" class="fc-x" data-fc-pg="home">✕</button></div>
    <div class="fc-two"><label>Wholesale nafa %<input type="number" inputmode="decimal" min="0" max="200" data-fc-wm="1" value="${wm()}"></label><label>Retail nafa %<input type="number" inputmode="decimal" min="0" max="300" data-fc-rm="1" value="${rm()}"></label></div>
    ${rows.map(x => `<div class="fc-rc"><div class="fc-rh"><b>${esc(x.it.name)}</b><small>laagat ${rs(x.c.cpp)}${x.it.pack > 1 ? ' · ' + rs(x.c.cpp * x.it.pack) + ' / ctn' : ''}</small></div>
      <div class="fc-rg">${cell('wctn', 'W CTN', x)}${cell('wpcs', 'W PCS', x)}${cell('rctn', 'R CTN', x)}${cell('rpcs', 'R PCS', x)}</div>
      ${diff(x) ? (can ? `<button type="button" class="fc-go sm" data-fc-rate="${esc(x.it.id)}">Ye rate POS mein lagao</button>` : '<small class="lk-note">Rate sirf malik laga sakta hai</small>') : '<small class="fc-ok">✓ Rate theek hai</small>'}</div>`).join('') || '<p class="lk-note">Pehle formula banayein.</p>'}
    ${todo.length > 1 && can ? `<button type="button" class="fc-go" data-fc-rate="*">✓ Sab ${num(todo.length)} rate lagao</button>` : ''}
    <p class="lk-note">Rate tab tak nahi badalta jab tak aap "lagao" na dabayein. PC 1 min mein POS mein lagata hai.</p></section>`;
}
async function applyRate(id) {
  const F = forms(), list = id === '*' ? finished() : [byId.get(String(id))].filter(Boolean);
  if (!list.length) return;
  if (id === '*' && !confirm(list.length + ' items ke naye rate POS mein lagane hain?')) return;
  let ok = 0;
  for (const it of list) { const sg = suggest(it, costOf(F[it.id]).cpp); const p = it.pack > 1 ? { wctn: sg.wctn, wpcs: sg.wpcs, rctn: sg.rctn, rpcs: sg.rpcs } : { wpcs: sg.wpcs, rpcs: sg.rpcs };
    try { await stockAgentItemSave(it.id, p); ok++; } catch (e) { notice(it.name + ': ' + (e?.message || e)); } }
  if (ok) notice('✓ ' + ok + ' item ke rate PC ko bheje — 1 min mein POS mein');
}

// ---------- 📦 raw maal ----------
function rawHTML() {
  const F = forms(), uses = new Map();
  for (const [fid, f] of Object.entries(F)) for (const l of f.lines || []) { const a = uses.get(String(l.id)) || []; a.push({ fid, q: Number(l.q) || 0 }); uses.set(String(l.id), a); }
  const list = rawItems().filter(x => !rq || x.name.toLowerCase().includes(rq.toLowerCase())).map(x => { const u = uses.get(x.id) || []; const need = Math.max(0, ...u.map(y => y.q)); return { x, u, need, kam: need > 0 && x.stock < need }; })
    .sort((a, b) => (b.kam ? 1 : 0) - (a.kam ? 1 : 0) || a.x.name.localeCompare(b.x.name));
  return `<section class="ir-sec"><div class="ir-sh"><b>📦 Raw maal (dukan godam)</b><button type="button" class="fc-x" data-fc-pg="home">✕</button></div>
    ${goPurchase && (isOwner() || canOf('v:purchase')) ? '<button type="button" class="fc-go" data-fc-pur="1">🧾 Raw maal ki purchase daalein</button>' : ''}
    <label class="hs-search"><input type="search" data-fc-rq="1" placeholder="🔍 raw maal…" value="${esc(rq)}"></label>
    <div class="ir-tbl">${list.slice(0, 80).map(({ x, u, need, kam }) => `<div class="ir-row"><span><b>${esc(x.name)}</b><small>${u.length ? u.length + ' formula mein · 1 batch = ' + esc(qt(need, x)) : 'kisi formula mein nahi'}${x.prate ? ' · ' + rs(x.prate) + ' / ' + esc((x.un || 'pcs').toLowerCase()) : ''}</small></span><span class="ir-num"><b class="${x.stock < 0 || kam ? 'fc-neg' : ''}">${esc(qt(x.stock, x))}</b><small class="${kam ? 'neg' : 'pos'}">${kam ? 'kam — 1 batch se kam' : need ? '~' + num(Math.floor(x.stock / need)) + ' batch ka' : ''}</small></span></div>`).join('') || '<p class="lk-note">Raw maal nahi mila (POS mein category "factory raw").</p>'}</div></section>`;
}

// ---------- ☑ factory items chunna (malik) ----------
let pk = null;
async function openPicker() {
  if (!isOwner()) { notice('Sirf malik'); return; }
  watchCfg(); pk = { q: '', f: 'sab', lim: 60 };
  dlg('☑ Factory items chunein', '<div id="fcPick"><p class="lk-note">⏳ Items aa rahi hain…</p></div>');
  if (!(await ensureItems())) return; pickPaint();
}
function pickPaint() {
  const el = $('fcPick'); if (!el || !pk) return;
  let all = []; try { all = stockPickList(); } catch {}
  const isOn = x => { const v = cfg?.items?.[x.id]; return v === true || (v !== false && x.catFac); };
  const q = pk.q.trim().toLowerCase(), F = forms();
  const list = all.filter(x => (pk.f === 'on' ? isOn(x) : pk.f === 'cat' ? x.catFac : true) && (!q || x.name.toLowerCase().includes(q) || x.code.includes(q)))
    .sort((a, b) => (isOn(b) ? 1 : 0) - (isOn(a) ? 1 : 0) || a.name.localeCompare(b.name));
  const nOn = all.filter(isOn).length, keepF = document.activeElement?.dataset?.fcPq != null;
  el.innerHTML = `<p class="ir-say">Jis item par <b>☑</b> lagayein wo factory mein aa jayegi — formula wali = <b>tayyar maal</b>, baqi = <b>raw maal</b>.</p>
    <div class="fc-per fc-pf">${[['sab', 'Sab (' + num(all.length) + ')'], ['on', '☑ Chuni hui (' + num(nOn) + ')'], ['cat', 'Category wali (' + num(all.filter(x => x.catFac).length) + ')']].map(([k, l]) => `<button type="button" class="${pk.f === k ? 'on' : ''}" data-fp-f="${k}">${l}</button>`).join('')}</div>
    <label class="hs-search"><input type="search" data-fc-pq="1" placeholder="🔍 naam ya barcode…" value="${esc(pk.q)}"></label>
    <div class="fc-picks">${list.slice(0, pk.lim).map(x => `<label class="fc-pk${isOn(x) ? ' pk-on' : ''}"><input type="checkbox" data-fac-tick="${esc(x.id)}"${isOn(x) ? ' checked' : ''}><span><b>${esc(x.name)}</b><small>${esc(x.cat || '—')} · stock ${esc(qt(x.stock, x))}${F[x.id] ? ' · 🧪 formula' : ''}</small></span></label>`).join('') || '<p class="lk-note">Kuch nahi mila.</p>'}</div>
    ${list.length > pk.lim ? `<button type="button" class="fc-no" data-fp-more="1">Aur dikhao (${num(list.length - pk.lim)})</button>` : ''}`;
  if (keepF) { const i = el.querySelector('[data-fc-pq]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
}
async function facToggle(id, on, box) {
  if (!isOwner() || !cloud?.setFactoryCfg) { if (box) box.checked = !on; notice('Sirf malik'); return; }
  let cat = false; try { const x = stockPickList().find(y => y.id === String(id)); cat = !!x?.catFac; } catch {}
  if (!on && forms()[String(id)] && !confirm('Is item ka formula bana hua hai — factory se hatana hai?')) { if (box) box.checked = true; return; }
  const v = on ? (cat ? null : true) : (cat ? false : null), prev = cfg?.items?.[String(id)];
  cfg = { ...(cfg || {}), items: { ...(cfg?.items || {}), [String(id)]: v } };   // foran (tez)
  loadItemsQuiet(); repaint(); if ($('fcPick')) pickPaint(); try { stockRepaint(); } catch {}
  try { await cloud.setFactoryCfg({ items: { [String(id)]: v } }); }
  catch (e) { cfg = { ...(cfg || {}), items: { ...(cfg?.items || {}), [String(id)]: prev ?? null } }; loadItemsQuiet(); repaint(); if ($('fcPick')) pickPaint(); notice('Save nahi hua: ' + (e?.message || e)); }
}

// ---------- ➕ naya batch (larka) ----------
export async function openBatch() {
  watch();
  if (!canFacBatch()) { notice('🔒 Batch ki ijazat nahi (malik: Settings → Mulazim)'); return; }
  dlg('🏭 Naya batch', '<div id="fcBatch"><p class="lk-note">⏳ Items aa rahi hain…</p></div>');
  const ok = await ensureItems(); if (!ok) { const el = $('fcBatch'); if (el) el.innerHTML = `<p class="ir-say">Stock load nahi hua: ${esc(itemsErr)}</p>`; return; }
  const fin = finished(); fb = { id: fin.length === 1 ? fin[0].id : (fb?.id && forms()[fb.id] ? fb.id : ''), n: 1, real: '', lbl: cfg?.lbl || 'pcs', busy: false };
  batchPaint();
}
function batchNo() {
  const d = new Date(), t = today(), n = batches.filter(b => b.day === t).length + 1;
  return `B-${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(n)}`;
}
function labelSpecs(it, out, mode) {
  if (!it || mode === 'none') return [];
  const L = it.labels || [], main = L.find(x => x.main) || L[0], pk = Number(it.pack) || 0;
  const ctn = pk > 1 ? L.find(x => !x.main && Math.abs(x.qty - pk) < 0.001) : null, nC = pk > 1 ? Math.floor(out / pk + 1e-9) : 0;
  const out2 = [];
  if ((mode === 'pcs' || mode === 'both') && main && out > 0) out2.push({ code: main.code, name: it.name, qty: main.qty || 1, rate: main.price || it.rate2, copies: Math.round(out / (main.qty || 1)) });
  if ((mode === 'ctn' || mode === 'both') && ctn && nC > 0) out2.push({ code: ctn.code, name: it.name, qty: ctn.qty, rate: ctn.price, copies: nC });
  return out2;
}
function batchPaint() {
  const el = $('fcBatch'); if (!el || !fb) return;
  const fin = finished(), F = forms();
  if (!fin.length) { el.innerHTML = `<p class="ir-say">Abhi koi formula nahi bana. ${isOwner() ? 'Pehle 🧪 Formulas mein tayyar maal ka nuskha banayein.' : 'Malik pehle formula banaye.'}</p>`; return; }
  const it = byId.get(fb.id), f = it ? F[it.id] : null, c = f ? costOf(f, fb.n) : null;
  const out = c ? (Number(fb.real) > 0 ? r3(Number(fb.real)) : c.out) : 0;
  const L = labelSpecs(it, out, fb.lbl), kam = c ? c.lines.filter(l => l.stock < l.q) : [];
  const ctnOk = it && it.pack > 1 && (it.labels || []).some(x => !x.main && Math.abs(x.qty - it.pack) < 0.001);
  el.innerHTML = `<div class="fc-bhead"><b>${esc(batchNo())}</b><small>${esc(today())} · ${esc(whoOf() || '')}</small></div>
    <div class="fc-lab">KYA BANAYA?</div>
    <div class="fc-items">${fin.map(x => `<button type="button" class="fc-it${x.id === fb.id ? ' on' : ''}" data-fb-it="${esc(x.id)}"><b>${esc(x.name)}</b><small>stock: ${esc(qt(x.stock, x))}</small></button>`).join('')}</div>
    ${it ? `<div class="fc-lab">KITNE BATCH BANE? <small>1 batch = ${esc(qt(f.per, it))}</small></div>
    <div class="fc-nums">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<button type="button" class="${n === fb.n ? 'on' : ''}" data-fb-n="${n}">${n}</button>`).join('')}</div>
    <div class="fc-out"><div><b>${esc(qt(out, it))}</b><small>${num(out)} ${esc((it.un || 'pcs').toLowerCase())}${Number(fb.real) > 0 ? ' (asal ginti)' : ''}</small></div>
      <label>Asal ginti alag?<input type="number" inputmode="decimal" min="0" step="any" data-fb-real="1" value="${esc(String(fb.real || ''))}" placeholder="${num(c.out)}"></label></div>
    <div class="fc-lab">RAW MAAL — KHUD MINUS <small>lagega / stock</small></div>
    <div class="fc-raw">${c.lines.map(l => `<div><span>${esc(l.name)}</span><b>${esc(qt(l.q, l.it))}</b><em class="${l.stock < l.q ? 'bad' : 'ok'}">${esc(qt(l.stock, l.it))}${l.stock < l.q ? ' kam' : ' ✓'}</em></div>`).join('')}</div>
    <div class="fc-lab">BARCODE LABEL <small>batch no ke saath</small></div>
    <div class="fc-lbl">${[['pcs', 'Packet'], ...(ctnOk ? [['ctn', 'Carton (sub)'], ['both', 'Dono']] : []), ['none', 'Nahi']].map(([k, l]) => `<button type="button" class="${fb.lbl === k ? 'on' : ''}" data-fb-lbl="${k}">${l}</button>`).join('')}</div>
    <small class="fc-lnote">${L.length ? L.map(x => `${num(x.copies)} label × ${esc(x.code)}${x.qty > 1 ? ' (' + num(x.qty) + ')' : ''}`).join(' · ') + ' — OK par khud chhapenge' : fb.lbl === 'none' ? 'Label nahi chhapenge' : '⚠️ Is item ka barcode nahi mila'}</small>
    <div class="fc-cost">Laagat ${rs(c.total)} · fi ${esc((it.un || 'pcs').toLowerCase())} ${rs(out ? c.total / out : 0)}</div>
    <button type="button" class="fc-ok-btn" data-fb-ok="1"${fb.busy ? ' disabled' : ''}>✓ OK — production darj karo</button>
    ${kam.length ? `<small class="fc-lnote bad">⚠️ ${kam.length} raw maal stock mein kam hai — POS mein minus ho jayega</small>` : ''}` : '<p class="lk-note">Upar se item chunein.</p>'}`;
}
function batchOk() {
  if (!fb || fb.busy) return; const it = byId.get(fb.id), f = it && forms()[it.id]; if (!f) { notice('Item chunein'); return; }
  if (!cloud?.addFactoryBatch) { notice('App update karein'); return; }
  const c = costOf(f, fb.n), out = Number(fb.real) > 0 ? r3(Number(fb.real)) : c.out;
  if (!(out > 0)) { notice('Kitne bane — likhein'); return; }
  const kam = c.lines.filter(l => l.stock < l.q);
  if (kam.length && !confirm(`${kam.map(l => l.name).join(', ')} stock mein kam hai.\nPhir bhi batch darj karein? (POS mein minus ho jayega)`)) return;
  fb.busy = true;
  const d = { no: batchNo(), itemId: it.id, name: it.name, n: fb.n, per: f.per, out, lines: c.lines.map(l => ({ id: l.id, name: l.name, q: l.q, c: r2(l.c) })), cost: c.total, oh: c.oh,
    labels: labelSpecs(it, out, fb.lbl), byName: whoOf() || '', day: today() };
  let r; try { r = cloud.addFactoryBatch(d); } catch (e) { fb.busy = false; notice('Nahi hua: ' + (e?.message || e)); return; }
  try { if (cfg?.lbl !== fb.lbl && isOwner() && cloud.setFactoryCfg) cloud.setFactoryCfg({ lbl: fb.lbl }).catch(() => {}); } catch {}
  notice(`✓ ${d.no} · ${it.name} · ${fb.n} batch — PC 1 min mein POS stock badlega${d.labels.length ? ' + label' : ''}`);
  fb = null; $('dialog')?.close(); repaint();
  Promise.resolve(r?.done).catch(e => notice('❌ Batch save nahi hua: ' + (e?.message || e)));
}

// ---------- batch tafseel ----------
function batchDlg(id) {
  const b = batches.find(x => x.id === id); if (!b) return;
  const it = byId.get(String(b.itemId)), [c, t] = statOf(b), own = isOwner();
  const step = (ok, title, sub) => `<div class="fc-step"><span class="fc-sd ${ok}">${ok === 'ok' ? '✓' : ok === 'bad' ? '!' : '…'}</span><div><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</div></div>`;
  const posted = b.status === 'posted' || b.status === 'cancelReq' || b.status === 'cancelled';
  dlg('🏭 ' + b.no, `<div class="ir-hero fc-hero ${c}"><small>${esc(b.no)} · ${esc(short(b.at))}</small><strong>${esc(b.name)}</strong><span>${num(b.n)} batch · ${esc(qt(b.out, it))} · <b>${esc(t)}</b></span></div>
    <section class="ir-sec">
      ${step('ok', 'Larke ne OK kiya', `${esc(b.byName || '')} · ${esc(short(b.at))}`)}
      ${step(posted ? 'ok' : b.status === 'error' ? 'bad' : 'wait', posted ? 'POS stock badla' : b.status === 'error' ? 'POS mein nahi gaya' : 'PC ko ja raha…', posted ? `Adjustment # ${esc(b.adjNo || '')} · ${b.postedAt ? esc(short(b.postedAt)) : ''}` : b.status === 'error' ? esc(b.err || '') : 'Server PC 1 min mein')}
      <div class="fc-mv"><div><span>${esc(b.name)}</span><b class="plus">+${esc(qt(b.out, it))}</b></div>${(b.lines || []).map(l => `<div><span>${esc(l.name)}</span><b class="minus">−${esc(qt(l.q, byId.get(String(l.id))))}</b></div>`).join('')}</div>
      ${(b.labels || []).length ? step(b.lblDone ? 'ok' : posted ? 'wait' : 'wait', b.lblDone ? 'Label printer ko gaye' : 'Label (POS ke baad)', (b.labels || []).map(l => `${num(l.copies)} × ${esc(l.code)}`).join(' · ')) : ''}
      ${b.status === 'cancelled' ? step('ok', '↩ Wapas ho gaya', `ulta adjustment # ${esc(b.revNo || '')}`) : b.status === 'cancelReq' ? step('wait', '↩ Wapas ho raha…', '') : ''}
    </section>
    <section class="ir-sec fc-sum"><div class="fc-sumrow"><span>Laagat</span><b>${rs(b.cost)}</b></div><div class="fc-sumrow"><span>Fi ${esc((it?.un || 'pcs').toLowerCase())}</span><b>${rs(b.out ? b.cost / b.out : 0)}</b></div>${b.oh ? `<div class="fc-sumrow"><span>Mazdoori / gas</span><b>${rs(b.oh)}</b></div>` : ''}</section>
    <div class="fc-btns">${own && b.status === 'error' ? `<button type="button" class="fc-go" data-fc-act="retry" data-id="${esc(b.id)}">↻ Dobara bhejo</button>` : ''}${own && ['new', 'posted', 'error'].includes(b.status) ? `<button type="button" class="fc-no" data-fc-act="cancel" data-id="${esc(b.id)}">↩ Ghalti — wapas lo</button>` : ''}<button type="button" class="fc-no" data-fc-bpdf="${esc(b.id)}">📄 PDF · WhatsApp</button></div>`);
}

// ---------- PDF ----------
function pdfHTML(list, title) {
  const tot = list.filter(b => b.status !== 'cancelled').reduce((s, b) => s + (Number(b.cost) || 0), 0);
  return `<h1>🏭 ${esc(title)}</h1><p>Noor Traders · apni factory · ${esc(new Date().toLocaleString('en-PK'))}</p>
    <table class="iv-tbl"><thead><tr><th>Batch</th><th>Item</th><th>Batch</th><th>Bana</th><th>Laagat Rs</th><th>Kis ne</th><th>Haalat</th></tr></thead><tbody>
    ${list.map(b => `<tr><td>${esc(b.no)}<br><small>${esc(short(b.at))}</small></td><td><b>${esc(b.name)}</b><br><small>${(b.lines || []).map(l => esc(l.name) + ' −' + num(l.q)).join(', ')}</small></td><td>${num(b.n)}</td><td>${esc(qt(b.out, byId.get(String(b.itemId))))}</td><td>${num(Math.round(b.cost || 0))}</td><td>${esc(b.byName || '')}</td><td>${esc(statOf(b)[1])}${b.adjNo ? ' #' + esc(b.adjNo) : ''}</td></tr>`).join('')}
    </tbody></table><p><b>Kul laagat: ${rs(tot)}</b> · ${num(list.length)} batch slip</p>`;
}

// ---------- dialog ----------
function dlg(title, html) { const d = $('dialog'); if (!d) return; d.classList.remove('search-dialog'); d.classList.add('full-dialog'); $('dialogTitle').textContent = title; $('dialogBody').innerHTML = `<div class="ir-root fc-root fc-dlg">${html}</div>`; if (!d.open) d.showModal(); }

// ---------- clicks ----------
document.addEventListener('click', e => {
  const o = e.target.closest?.('[data-fac-open]'); if (o) { e.preventDefault(); openBatch(); return; }
  const pq = e.target.closest?.('[data-fc-pick],[data-fp-f],[data-fp-more]');
  if (pq) { const d = pq.dataset; if (d.fcPick != null) { openPicker(); return; } if (!pk) return; if (d.fpF) { pk.f = d.fpF; pk.lim = 60; } else pk.lim += 100; pickPaint(); return; }
  const t = e.target.closest?.('[data-fc-per],[data-fc-pg],[data-fc-batch],[data-fc-b],[data-fc-f],[data-fc-rate],[data-fc-pdf],[data-fc-bpdf],[data-fc-act],[data-fc-pur],[data-fb-it],[data-fb-n],[data-fb-lbl],[data-fb-ok],[data-fe-del],[data-fe-add],[data-fe-save],[data-fe-rm]');
  if (!t) return; const d = t.dataset;
  if (d.fcPdf != null) { if (!pdfOf) return; const l = batches.filter(inPer); pdfOf(pdfHTML(l, 'Factory production — ' + (PER.find(p => p[0] === st.per)?.[1] || '')), 'Factory production ' + today()); return; }
  if (!t.closest('.fc-root')) return;
  if (d.fcPer) { st.per = d.fcPer; keep(); paint(); return; }
  if (d.fcPg) { st.pg = st.pg === d.fcPg ? 'home' : d.fcPg; keep(); paint(); if (st.pg !== 'home') $('fcRoot')?.querySelector('.ir-sec')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }); return; }
  if (d.fcBatch != null) { openBatch(); return; }
  if (d.fcB) { batchDlg(d.fcB); return; }
  if (d.fcF) { openFormula(d.fcF); return; }
  if (d.fcRate) { applyRate(d.fcRate); return; }
  if (d.fcPur != null) { try { goPurchase?.(); } catch {} return; }
  if (d.fcBpdf) { const b = batches.find(x => x.id === d.fcBpdf); if (b && pdfOf) { $('dialog')?.close(); pdfOf(pdfHTML([b], 'Batch ' + b.no + ' — ' + b.name), 'Batch ' + b.no); } return; }
  if (d.fcAct) { const id = d.id; if (d.fcAct === 'cancel' && !confirm('Ye batch wapas lena hai? POS mein ulta adjustment banega (tayyar maal −, raw maal +).')) return;
    Promise.resolve(cloud?.factoryBatchAct?.(id, d.fcAct)).then(() => { notice(d.fcAct === 'cancel' ? '↩ Wapas ho raha — PC 1 min' : '↻ Dobara bheja'); $('dialog')?.close(); }).catch(er => notice('Nahi hua: ' + (er?.message || er))); return; }
  if (d.fbIt && fb) { fb.id = d.fbIt; fb.real = ''; batchPaint(); return; }
  if (d.fbN && fb) { fb.n = Number(d.fbN); fb.real = ''; batchPaint(); return; }
  if (d.fbLbl && fb) { fb.lbl = d.fbLbl; batchPaint(); return; }
  if (d.fbOk != null) { batchOk(); return; }
  if (d.feDel != null && fe) { fe.lines.splice(Number(d.feDel), 1); formPaint(); return; }
  if (d.feAdd && fe) { fe.lines.push({ id: d.feAdd, q: 1 }); fe.q = ''; formPaint(); return; }
  if (d.feSave != null) { formSave(false); return; }
  if (d.feRm != null) { formSave(true); return; }
});
document.addEventListener('input', e => {
  const t = e.target; if (!t?.dataset || !t.closest?.('.fc-root')) return; const d = t.dataset;
  if (d.fcFq != null) { fq = t.value || ''; clearTimeout(qT); qT = setTimeout(() => { paint(); const i = document.querySelector('[data-fc-fq]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 200); return; }
  if (d.fcRq != null) { rq = t.value || ''; clearTimeout(qT); qT = setTimeout(() => { paint(); const i = document.querySelector('[data-fc-rq]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 200); return; }
  if (d.fcPq != null && pk) { pk.q = t.value || ''; pk.lim = 60; clearTimeout(qT); qT = setTimeout(pickPaint, 180); return; }
  if (d.fcFq2 != null && fe) { fe.q = t.value || ''; clearTimeout(qT); qT = setTimeout(formPaint, 180); return; }
});
let qT = 0;
document.addEventListener('change', e => {
  const t = e.target;
  if (t?.dataset?.facTick) { facToggle(t.dataset.facTick, t.checked, t); return; }   // v2.99.89: stock screen + picker
  if (!t?.dataset || !t.closest?.('.fc-root')) return; const d = t.dataset, v = Number(t.value);
  if (d.fbReal != null && fb) { fb.real = v > 0 ? v : ''; batchPaint(); return; }
  if (fe) {
    if (d.fePer != null) { fe.per = v > 0 ? v : fe.per; formPaint(); return; }
    if (d.feQ != null) { const l = fe.lines[Number(d.feQ)]; if (l) l.q = v >= 0 ? v : 0; formPaint(); return; }
    if (d.feLab != null) { fe.lab = v >= 0 ? v : 0; formPaint(); return; }
    if (d.feGas != null) { fe.gas = v >= 0 ? v : 0; formPaint(); return; }
  }
  if ((d.fcWm != null || d.fcRm != null) && cloud?.setFactoryCfg) { if (!(v >= 0)) return; cloud.setFactoryCfg(d.fcWm != null ? { wm: v } : { rm: v }).then(() => notice('✓ Nafa ' + v + '% save')).catch(er => notice('Save nahi hua: ' + (er?.message || er))); }
});
export const _fcTest = { costOf, suggest, labelSpecs, qt, set: (c, b, it) => { cfg = c; batches = b || []; items = it || []; byId = new Map(items.map(x => [x.id, x])); itemsOk = true; }, batchNo, pdfHTML, st };
