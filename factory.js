// factory.js — v2.99.95: 🏭 FACTORY PRODUCTION (malik: "apni factory ki items — formula, batch, larka OK kare to POS stock khud +/−, rates khud,
//   batch ka barcode label, raw maal ki purchase"). Naqsha: Design artifact "Factory Production — naqsha".
// Items: POS ki category mein 'factory' (pos-stock isFactory) ya malik ka ☑ — jis ka FORMULA bana = tayyar maal, baqi = raw maal. Stock / rate POS se.
// Firestore: factory/cfg {formulas:{itemId:{per, lines:[{id,q,n}], lab, gas, cpp, at} | null}, items:{id:true|false|null}, pend:{jobId:{n,at,c}|null}, wm, rm, lbl} (sirf malik) ·
//   factoryBatches/<id> {no, itemId, n (1–10), per, out, lines:[{id,name,q,c}], cost, oh, labels:[…], status 'new'} — larka (Full / Stock) banaye;
//   PC factory-post.js: POS Adjustment (+ tayyar maal, − raw maal; dukan godam) -> status 'posted' + adjNo, phir label jobs (batch no ke saath).
//   Malik: 'cancelReq' (ulta Adjustment) / 'new' dobara. Rate: pos-stock stockAgentItemSave (itemJobs, PC item-post) — malik dabaye tab.
// v2.99.95: NAYI TARTEEB (malik: "sahi tarteeb se nahi, bohat masail, easy + premium") — 4 tab (📋 Batches · 🧪 Formulas · 🏷 Rates · 📦 Raw maal),
//   ⚙️ Settings sheet (☑ items chunna + nafa % + label default), batch 3 qadam (① item ② batch 1–10 ③ OK; "Aur…" mein asal ginti / label / raw list).
//   Bugs: (1) ⏳ pending ka naam POS mein pehle se = ⚠️ alert (2) larke ke phone par bhi done job = factory item (3) ⏳ item par rate nahi
//   (4) ❌ masla alert tap se batch khule (5) raw ka naam formula mein mehfooz (n) — item hat jaye to bhi dikhe (6) formula chooser mein raw alag (7) mara hua code hata.
//   📷 PHOTO SE FORMULA (AI sirf tasveer parhne ke liye — Excel / parchi): lines -> POS items se milao (stockAgentFind) -> na mile to naya item
//   (stockNewItemQuick, ⏳ job:) -> formula save. Fi piece packing × pieces; labour -> mazdoori. Tez: OK = setDoc foran. AI aur kahin NAHI.
import { stockAgentReady, stockFactoryList, stockFactoryCanRate, stockAgentItemSave, stockPickList, stockRepaint, stockIsFactoryCat, onItemJobs, stockAgentFind, stockNewItemQuick } from './pos-stock.js?v=2.99.95';

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
const fold = s => String(s || '').toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, ' ').trim();
const un = it => (it?.un || 'pcs').toLowerCase();
// ginti -> "5 ctn + 3" (POS jaisa)
function qt(q, it) {
  q = r3(q); const pk = Number(it?.pack) || 0, cn = (it?.cn || 'Ctn').toLowerCase(), u = un(it);
  if (pk > 1) { const neg = q < 0, a = Math.abs(q), c = Math.floor(a / pk + 1e-9), p = r3(a - c * pk); return (neg ? '−' : '') + (c ? num(c) + ' ' + cn : '') + (c && p ? ' + ' : '') + (p || !c ? num(p) + (c ? '' : ' ' + u) : ''); }
  return num(q) + ' ' + u;
}

let cloud = null, notice = () => {}, pdfOf = null, canOf = () => true, ownerOf = () => false, whoOf = () => '', goPurchase = null, batchOf = null, aiFormula = null;
let cfg = null, cfgStop = null, batches = [], bStop = null, bFrom = 0, items = [], byId = new Map(), itemsOk = false, itemsErr = '';
const LS = 'sam-fac';
const st = (() => { let v = {}; try { v = JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch {} return { per: v.per || 'aaj', tab: v.tab || 'batches' }; })();
const keep = () => { try { localStorage.setItem(LS, JSON.stringify({ per: st.per, tab: st.tab })); } catch {} };
let fb = null;   // batch form ki haalat
let fe = null;   // formula editor ki haalat
let pk = null;   // ☑ picker
let fn = null;   // ➕ naya formula chooser
let pf = null;   // 📷 photo se formula

export function factorySetup(o) { cloud = o.cloud || cloud; notice = o.notice || notice; pdfOf = o.pdf || pdfOf; canOf = o.can || canOf; ownerOf = o.owner || ownerOf; whoOf = o.who || whoOf; goPurchase = o.purchase || goPurchase; batchOf = o.batch || batchOf; aiFormula = o.aiFormula || aiFormula; }
export function factoryStop() { if ($('fcBatch') || $('fcForm') || $('fcPick') || $('fcPhoto') || $('fcNew')) return;   // stock screen se khula batch / formula — listener zinda rahe
  if (bStop) { try { bStop(); } catch {} bStop = null; } }   // cfg (1 doc) zinda — stock screen ke ☐ 🏭 Factory ke liye
const isOwner = () => { try { return !!ownerOf(); } catch { return false; } };
export const canFacBatch = () => { try { return isOwner() || (batchOf ? !!batchOf() : false); } catch { return false; } };

function watchCfg() { if (!cfgStop && cloud?.listenFactory) cfgStop = cloud.listenFactory(c => { if (c) cfg = c; else if (!cfg) cfg = {}; doneCalc(); repaint(); try { linkCheck(); } catch {} try { stockRepaint(); } catch {} }); }
// bug 2: job 'done' (PC ne item bana diya) magar malik ka app abhi link nahi kar saka — HAR phone asli item ko factory wala samjhe
let doneReal = new Set();
const doneCalc = () => { doneReal = new Set(lastJobs.filter(j => j.status === 'done' && j.itemId && cfg?.pend?.[j.id]).map(j => String(j.itemId))); };
const facPick = r => { const v = cfg?.items?.[String(r.id)]; return v === true ? true : v === false ? false : doneReal.has(String(r.id)) ? true : null; };
const facIs = r => { const v = facPick(r); return v == null ? stockIsFactoryCat(r) : v; };
window.ntFacIs = r => { watchCfg(); return facIs(r); };
// ⏳ naya item (PC band) + 🏭 tick — cfg.pend {jobId: {n, at, c} | null}; PC item bana de to items[itemId] = true (malik ka app jorta hai)
const pendList = () => Object.entries(cfg?.pend || {}).filter(([, v]) => v && v.n).map(([id, v]) => ({ id, n: v.n, at: v.at, c: Number(v.c) || 0 }));
window.ntFacPend = (jid, name, c) => { if (!isOwner() || !cloud?.setFactoryCfg) return; watchCfg();
  const v = { n: String(name || '').slice(0, 80), at: Date.now(), ...(c > 0 ? { c: r2(c) } : {}) };
  cfg = { ...(cfg || {}), pend: { ...(cfg?.pend || {}), [jid]: v } }; loadItemsQuiet(); repaint();
  cloud.setFactoryCfg({ pend: { [jid]: v } }).catch(e => notice('🏭 factory tick save nahi hua: ' + (e?.message || e))); };
window.ntFacPendHas = jid => !!(cfg?.pend?.[jid]);
window.ntFacPendDel = jid => { if (!isOwner() || !cloud?.setFactoryCfg || !cfg?.pend?.[jid]) return; cfg = { ...cfg, pend: { ...(cfg.pend || {}), [jid]: null } }; loadItemsQuiet(); repaint(); cloud.setFactoryCfg({ pend: { [jid]: null } }).catch(() => {}); };
let linking = new Set(), lastJobs = [];
let jobsById = new Map();
onItemJobs(list => { lastJobs = list; jobsById = new Map(list.map(j => [j.id, j])); doneCalc(); loadItemsQuiet(); linkCheck(); repaint(); });
// ⏳ PC baqi item ABHI se factory mein (malik: "yahan aa jaye, POS mein baad mein chali jaye") — naqli item id 'job:<jobId>',
//   rate / pack / barcode job se, stock 0. Formula / batch abhi; PC factory-post item bante hi asli id se post karta hai; app formulas
//   'job:<id>' -> asli itemId khud badalti hai (linkCheck). bug 1: wahi naam POS mein pehle se = dup.
function pendItems(real) {
  const names = new Set(real.map(x => fold(x.name)));
  return pendList().map(p => { const j = jobsById.get(p.id); if (j && (j.status === 'cancelled' || j.status === 'failed' || (j.status === 'done' && j.itemId))) return null;
    const pk = Number(j?.pack) > 1 ? Number(j.pack) : 0, rp = Number(j?.rpcs) || 0, name = j?.name || p.n;
    return { id: 'job:' + p.id, jid: p.id, name, code: String(j?.code || ''), pack: pk, cn: 'Ctn', un: 'Pcs', cat: '⏳ PC baqi', stock: 0, prate: Number(j?.costP) || p.c || 0,
      rate: pk && j?.rctn ? Number(j.rctn) / pk : rp, rate2: rp, wrate: pk && j?.wctn ? Number(j.wctn) / pk : Number(j?.wpcs) || rp, ws: Number(j?.wpcs) || rp, urdu: '', pending: true, dup: names.has(fold(name)),
      labels: [{ code: String(j?.code || ''), qty: 1, price: rp, main: true }] };
  }).filter(Boolean);
}
const isPend = it => !!it?.pending;
function linkCheck() {
  const list = lastJobs;
  if (!isOwner() || !cfg || !cloud?.setFactoryCfg || !list.length) return;
  for (const j of list) { const p = cfg.pend?.[j.id]; if (!p || linking.has(j.id)) continue;
    if (j.status === 'done' && j.itemId) { linking.add(j.id);
      const real = String(j.itemId), fake = 'job:' + j.id, F = cfg.formulas || {}, fp = {};
      for (const [fid, f] of Object.entries(F)) { if (!f) continue; const lines = (f.lines || []).map(l => String(l.id) === fake ? { ...l, id: real } : l), ch = lines.some((l, i) => l !== f.lines[i]);
        if (fid === fake) { if (!F[real]) fp[real] = { ...f, lines }; fp[fake] = null; } else if (ch) fp[fid] = { ...f, lines }; }
      const patch = { items: { [real]: true }, pend: { [j.id]: null }, ...(Object.keys(fp).length ? { formulas: fp } : {}) };
      cfg = { ...cfg, items: { ...(cfg.items || {}), [real]: true }, pend: { ...(cfg.pend || {}), [j.id]: null }, formulas: { ...F, ...fp } };
      cloud.setFactoryCfg(patch).then(() => { notice('🏭 ' + p.n + ' POS mein ban gaya — factory mein asli item se jur gaya'); loadItemsQuiet(); repaint(); }).catch(() => linking.delete(j.id)); }
    else if (j.status === 'failed') { linking.add(j.id); cloud.setFactoryCfg({ pend: { [j.id]: null } }).catch(() => linking.delete(j.id)); }
  }
}
function watch() {
  watchCfg();
  const d = new Date(); d.setHours(0, 0, 0, 0); const wk = new Date(d); wk.setDate(wk.getDate() - 6); const mo = new Date(d.getFullYear(), d.getMonth(), 1);
  const from = Math.min(wk.getTime(), mo.getTime());
  if (bStop && bFrom === from) return;
  if (bStop) { try { bStop(); } catch {} } bFrom = from;
  bStop = cloud?.listenFactoryBatches ? cloud.listenFactoryBatches(from, (l, e) => { if (l) batches = l; else if (e) notice('Factory batch nahi parhe: ' + (e.code || e.message || e)); repaint(); }) : null;
}
function loadItems() {
  try { const real = stockFactoryList(facPick); items = [...real, ...pendItems(real)]; byId = new Map(items.map(x => [x.id, x])); itemsOk = true; } catch (e) { itemsErr = e?.message || String(e); }
}
async function ensureItems() {
  if (itemsOk) { loadItems(); return true; }
  try { await stockAgentReady(); loadItems(); return true; } catch (e) { itemsErr = e?.message || String(e); repaint(); return false; }
}
const forms = () => Object.fromEntries(Object.entries(cfg?.formulas || {}).filter(([, v]) => v && v.per > 0));
const finished = () => { const F = forms(); return items.filter(x => F[x.id]); };
const rawItems = () => { const F = forms(); return items.filter(x => !F[x.id]); };
const rawUsed = () => { const s = new Set(); for (const f of Object.values(forms())) for (const l of f.lines || []) s.add(String(l.id)); return s; };
const wm = () => Number(cfg?.wm ?? 10), rm = () => Number(cfg?.rm ?? 15);
// laagat: n batch ka raw + mazdoori / gas (bug 5: naam line mein mehfooz — item factory se hat jaye to bhi dikhe)
function costOf(f, n = 1) {
  const lines = (f?.lines || []).map(l => { const it = byId.get(String(l.id)); const q = r3((Number(l.q) || 0) * n), c = Number(it?.prate) || 0; return { id: String(l.id), name: it?.name || l.n || 'Item ' + l.id, it, q, c, rs: q * c, stock: Number(it?.stock) || 0, gone: !it }; });
  const raw = lines.reduce((s, l) => s + l.rs, 0), oh = ((Number(f?.lab) || 0) + (Number(f?.gas) || 0)) * n, out = (Number(f?.per) || 0) * n;
  return { lines, raw, oh, total: raw + oh, out, cpp: out ? (raw + oh) / out : 0, noRate: lines.filter(l => !l.c).length, gone: lines.filter(l => l.gone).length };
}
// naye rate (fi piece POS jaisa): khula piece upar 1 Rs tak, carton upar 5 Rs tak
function suggest(it, cpp) {
  const pk = Number(it.pack) || 0, w = cpp * (1 + wm() / 100), r = cpp * (1 + rm() / 100);
  const ctn = x => pk > 1 ? Math.ceil(x * pk / 5) * 5 : 0;
  return { wctn: ctn(w), wpcs: Math.ceil(w), rctn: ctn(r), rpcs: Math.ceil(r) };
}
const curRates = it => { const pk = Number(it.pack) || 0, c = x => pk > 1 ? Math.round(x * pk) : 0; return { wctn: c(it.wrate), wpcs: r2(it.ws), rctn: c(it.rate), rpcs: r2(it.rate2) }; };
const rateRows = () => { const F = forms(); return finished().filter(it => !isPend(it)).map(it => { const c = costOf(F[it.id]); return { it, c, sg: suggest(it, c.cpp), cr: curRates(it) }; }); };
const rateDiff = x => ['wctn', 'wpcs', 'rctn', 'rpcs'].some(k => (x.it.pack > 1 || k.endsWith('pcs')) && Math.abs((x.sg[k] || 0) - (x.cr[k] || 0)) >= 1);

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
const statOf = b => b._pend ? ['wait', '⏳ Bhej raha…'] : b.status === 'new' && b.waitItem ? ['wait', '⏳ Item POS mein banne ka intezar'] : (STAT[b.status] || ['wait', b.status]);

// search likhte waqt input dobara na bane (mobile keyboard) — poora html bana kar sirf diye gaye #id dabbon ka andar badlo.
function swapParts(root, html, ids) { const t = document.createElement('div'); t.innerHTML = html; for (const id of ids) { const a = t.querySelector('#' + id), b = root.querySelector('#' + id); if (a && b) b.innerHTML = a.innerHTML; } }
// ---------- screen ----------
const TABS = [['batches', '📋', 'Batches', false], ['formulas', '🧪', 'Formulas', true], ['rates', '🏷', 'Rates', true], ['raw', '📦', 'Raw maal', false]];
const tabsOf = () => TABS.filter(t => !t[3] || isOwner());
export function renderFactory() {
  watch();
  $('summary').innerHTML = '<div class="bc-root ir-root fc-root" id="fcRoot"></div>';
  if ($('list')) $('list').innerHTML = '';
  $('actions').innerHTML = '<button class="got" data-fc-pdf="1">📄 Production PDF · WhatsApp</button>';
  paint();
  ensureItems().then(ok => { if (ok) paint(); });
}
let rpT = 0;
function repaint() { clearTimeout(rpT); rpT = setTimeout(() => { const ad = document.activeElement?.dataset || {};   // likhte waqt input na toote
  if ($('fcRoot')) { loadItemsQuiet(); paint(ad.fcRq != null ? ['fcRqList'] : undefined); }
  if (fb && $('fcBatch') && ad.fbReal == null) batchPaint(); if (fe && $('fcForm')) formPaint(ad.fcFq2 != null ? ['feHits'] : undefined); if (pk && $('fcPick')) pickPaint(ad.fcPq != null ? ['fcPickList'] : undefined);
  if (fn && $('fcNew')) fnewPaint(ad.fcFq != null ? ['fcFqList'] : undefined); if (pf && $('fcPhoto') && ad.pfPq == null && ad.pfSq == null && ad.pfPieces == null && ad.pfQ == null) pfPaint(); }, 30); }
const loadItemsQuiet = () => { if (itemsOk) loadItems(); };
function paint(only) {
  const root = $('fcRoot'); if (!root) return;
  const B = batches.filter(inPer), live = B.filter(b => b.status !== 'cancelled' && b.status !== 'cancelReq');
  const tot = live.reduce((s, b) => s + (Number(b.cost) || 0), 0), nb = live.reduce((s, b) => s + (Number(b.n) || 0), 0);
  const F = forms(), own = isOwner();
  if (!tabsOf().some(t => t[0] === st.tab)) st.tab = 'batches';
  const up = itemsOk && own ? rateRows().filter(x => { const old = Number(F[x.it.id]?.cpp) || 0; return old > 0 && x.c.cpp >= old * 1.03; }) : [];
  const todo = itemsOk && own ? rateRows().filter(rateDiff).length : 0;
  const errs = batches.filter(b => b.status === 'error'), dups = itemsOk ? items.filter(x => x.dup) : [], kam = itemsOk ? rawKam().length : 0;
  const kp = (b, s) => `<div><b>${b}</b><small>${s}</small></div>`;
  const badge = { batches: errs.length ? '❌' + errs.length : '', formulas: Object.keys(F).length ? num(Object.keys(F).length) : '', rates: todo ? '⚠' + todo : '', raw: kam ? '⚠' + kam : '' };
  const html = `
  <div class="ir-hero fc-hero"><div class="fc-hrow"><div><small>NOOR TRADERS · APNI FACTORY</small><strong>🏭 Factory</strong></div>${own ? '<button type="button" class="fc-gear" data-fc-set="1" aria-label="Settings">⚙️</button>' : ''}</div>
    <div class="fc-per">${PER.map(([k, l]) => `<button type="button" class="${st.per === k ? 'on' : ''}" data-fc-per="${k}">${l}</button>`).join('')}</div>
    <div class="ir-kp">${kp(num(live.length), 'batch slip')}${kp(num(nb), 'batch (1–10)')}${kp(rs(tot), 'laagat')}</div></div>
  <div class="fc-tabs">${tabsOf().map(([k, ic, l]) => `<button type="button" class="${st.tab === k ? 'on' : ''}" data-fc-tab="${k}"><span>${ic}</span>${l}${badge[k] ? `<i>${badge[k]}</i>` : ''}</button>`).join('')}</div>
  ${itemsErr && !itemsOk ? `<p class="ir-say">⏳ Stock load nahi hua: ${esc(itemsErr)}</p>` : ''}
  ${errs.length ? `<button type="button" class="fc-alert bad" data-fc-b="${esc(errs[0].id)}"><span>❌</span><div><b>${num(errs.length)} batch POS mein nahi gaye</b> — tap karein, wajah dekhein</div><em>›</em></button>` : ''}
  ${own && dups.length ? dups.map(x => `<div class="fc-alert"><span>⚠️</span><div><b>${esc(x.name)}</b> ⏳ PC baqi hai magar ye naam POS mein pehle se hai — PC dobara item banayega. Agar wahi item hai to pending hatayein aur POS wali ko ☑ karein.</div><button type="button" data-fc-penddel="${esc(x.jid)}">✕ Hatao</button></div>`).join('') : ''}
  ${up.length && own && st.tab !== 'rates' ? `<div class="fc-alert"><span>⚠️</span><div><b>${up.map(x => esc(x.it.name)).slice(0, 3).join(', ')}</b> ki laagat barh gayi (+${Math.round((up[0].c.cpp / (Number(F[up[0].it.id].cpp) || 1) - 1) * 100)}%) — rate dekh lein.</div><button type="button" data-fc-tab="rates">Dekhein</button></div>` : ''}
  ${itemsOk && !items.length && own ? `<p class="ir-say">Abhi factory mein koi item nahi — ⚙️ mein <b>☑ Factory items chunein</b> (ya POS mein category "factory").</p>` : ''}
  ${st.tab === 'formulas' && own ? formulasHTML() : st.tab === 'rates' && own ? ratesHTML(up) : st.tab === 'raw' ? rawHTML() : batchesHTML(B)}`;
  if (only) { swapParts(root, html, only); return; }
  root.innerHTML = html;
}
function batchesHTML(B) {
  return `${canFacBatch() ? `<button type="button" class="fc-big" data-fc-batch="1"><span class="fc-ic">➕</span><b>Naya batch</b><small>item · kitne batch · OK — POS stock khud</small></button>` : ''}
  ${pendList().length && isOwner() ? `<div class="fc-pend">${pendList().map(p => `<span>⏳ ${esc(p.n)} <small>POS mein PC on hote hi banega — formula / batch abhi ban sakta hai</small></span>`).join('')}</div>` : ''}
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
  return `<div class="fc-two fc-fnew"><button type="button" class="fc-big" data-fc-fnew="1"><span class="fc-ic">➕</span><b>Naya formula</b><small>item chun kar raw maal likhein</small></button>
    ${aiFormula ? `<button type="button" class="fc-big alt" data-fc-photo="1"><span class="fc-ic">📷</span><b>Photo se formula</b><small>Excel / parchi ki tasveer — AI parhe</small></button>` : ''}</div>
    <section class="ir-sec"><div class="ir-sh"><b>🧪 Formulas</b><small>${num(fin.length)}</small></div>
    <div class="ir-tbl">${fin.map(it => { const c = costOf(F[it.id]); return `<button type="button" class="ir-row" data-fc-f="${esc(it.id)}"><span><b>${esc(it.name)}${isPend(it) ? ' <i class="fc-pend-i">⏳</i>' : ''}</b><small>1 batch = ${esc(qt(F[it.id].per, it))} · ${num(F[it.id].lines?.length || 0)} raw${c.noRate ? ' · ⚠️ ' + c.noRate + ' ka rate nahi' : ''}${c.gone ? ' · ⚠️ ' + c.gone + ' item factory mein nahi' : ''}</small></span><span class="ir-num"><b>${rs(c.cpp)} / ${esc(un(it))}</b><small>${it.pack > 1 ? rs(c.cpp * it.pack) + ' / ctn' : ''}</small></span></button>`; }).join('') || '<p class="lk-note">Abhi koi formula nahi — upar ➕ ya 📷 se banayein.</p>'}</div></section>`;
}
// bug 6: chooser alag dialog — tayyar maal pehle, raw mein istemaal wali neeche alag
function fnewDlg() { if (!isOwner()) return; fn = { q: '' }; dlg('➕ Naya formula — item chunein', '<div id="fcNew"></div>'); fnewPaint(); }
function fnewPaint(only) {
  const el = $('fcNew'); if (!el || !fn) return; const F = forms(), used = rawUsed(), q = fn.q.trim().toLowerCase();
  const all = items.filter(x => !F[x.id] && (!q || x.name.toLowerCase().includes(q) || x.code.includes(q)));
  const A = all.filter(x => !used.has(x.id)).slice(0, 15), R = all.filter(x => used.has(x.id)).slice(0, 8);
  const row = x => `<button type="button" class="ir-row" data-fc-f="${esc(x.id)}"><span><b>${esc(x.name)}${isPend(x) ? ' ⏳' : ''}</b><small>${esc(x.cat)} · stock ${esc(qt(x.stock, x))}</small></span><span class="ir-num"><b>➕</b></span></button>`;
  const html = `<p class="ir-say">Jis <b>tayyar maal</b> ka nuskha banana hai wo chunein. ${aiFormula ? 'Ya <b>📷 Photo se formula</b> — Excel / parchi ki tasveer.' : ''}</p>
    <label class="hs-search"><input type="search" data-fc-fq="1" placeholder="🔍 item ka naam / barcode…" value="${esc(fn.q)}" autocomplete="off"></label>
    <div id="fcFqList"><div class="ir-tbl">${A.map(row).join('') || '<p class="lk-note">Kuch nahi mila — ⚙️ mein ☑ Factory items chunein.</p>'}</div>
    ${R.length ? `<div class="fc-sub">Ye raw maal ki tarah formulas mein lagti hain (phir bhi chun sakte hain):</div><div class="ir-tbl">${R.map(row).join('')}</div>` : ''}</div>
    ${aiFormula ? '<div class="fc-btns"><button type="button" class="fc-no" data-fc-photo="1">📷 Photo se formula</button></div>' : ''}`;
  if (only) { swapParts(el, html, only); return; }
  el.innerHTML = html;
}
function openFormula(id) {
  const it = byId.get(String(id)); if (!it) return;
  const f = forms()[it.id]; fn = null;
  fe = { id: it.id, per: f?.per || (it.pack > 1 ? it.pack * 5 : 100), lines: (f?.lines || []).map(l => ({ id: String(l.id), q: Number(l.q) || 0, n: l.n || '' })), lab: Number(f?.lab) || 0, gas: Number(f?.gas) || 0, q: '' };
  dlg('🧪 Formula — ' + it.name, '<div id="fcForm"></div>'); formPaint();
}
function formPaint(only) {
  const el = $('fcForm'); if (!el || !fe) return; const it = byId.get(fe.id); if (!it) return;
  const c = costOf(fe), sg = suggest(it, c.cpp), cr = curRates(it);
  const hits = fe.q.trim().length >= 2 ? items.filter(x => x.id !== fe.id && !fe.lines.some(l => l.id === x.id) && x.name.toLowerCase().includes(fe.q.trim().toLowerCase())).slice(0, 10) : [];
  const html = `<section class="ir-sec"><div class="fc-batchrow"><span>1 batch =</span><input type="number" inputmode="decimal" min="1" step="any" data-fe-per="1" value="${esc(String(fe.per))}"><span>${esc(un(it))}${it.pack > 1 ? ' (' + esc(qt(fe.per, it)) + ')' : ''}</span></div></section>
    <section class="ir-sec"><div class="ir-sh"><b>Raw maal (1 batch)</b><small>rate = abhi ka khareed</small></div>
      <div class="ir-tbl">${c.lines.map((l, i) => `<div class="ir-row"><span><b>${esc(l.name)}</b><small>${l.gone ? '⚠️ factory items mein nahi — ⚙️ se ☑ karein' : esc(un(l.it)) + ' × ' + (l.c ? rs(l.c) : '⚠️ rate nahi')}</small></span><span class="fc-crow"><input type="number" inputmode="decimal" min="0" step="any" data-fe-q="${i}" value="${esc(String(fe.lines[i].q))}"><b>${rs(l.rs)}</b><button type="button" class="ir-cx" data-fe-del="${i}">✕</button></span></div>`).join('') || '<p class="lk-note">Neeche se raw maal jorein.</p>'}</div>
      <label class="hs-search"><input type="search" data-fc-fq2="1" placeholder="➕ raw maal ka naam…" value="${esc(fe.q)}" autocomplete="off"></label>
      <div class="ir-tbl" id="feHits">${hits.map(x => `<button type="button" class="ir-row" data-fe-add="${esc(x.id)}"><span><b>${esc(x.name)}</b><small>stock ${esc(qt(x.stock, x))} · ${x.prate ? rs(x.prate) + ' / ' + esc(un(x)) : 'rate nahi'}</small></span><span class="ir-num"><b>➕</b></span></button>`).join('')}</div></section>
    <section class="ir-sec"><div class="ir-sh"><b>Batch ka baqi kharcha</b></div>
      <div class="fc-two"><label>Mazdoori Rs<input type="number" inputmode="decimal" min="0" data-fe-lab="1" value="${fe.lab || ''}" placeholder="0"></label><label>Gas / bijli Rs<input type="number" inputmode="decimal" min="0" data-fe-gas="1" value="${fe.gas || ''}" placeholder="0"></label></div></section>
    <section class="ir-sec fc-sum"><div class="fc-sumrow"><span>Laagat 1 batch</span><b>${rs(c.total)}</b></div><div class="fc-sumrow"><span>Laagat fi ${esc(un(it))}</span><b>${rs(c.cpp)}${it.pack > 1 ? ' · ' + rs(c.cpp * it.pack) + ' / ctn' : ''}</b></div>
      <div class="fc-sumrow"><span>Naye rate (W ${wm()}% · R ${rm()}%)</span><b>${it.pack > 1 ? 'W ' + num(sg.wctn) + '/' + num(sg.wpcs) + ' · R ' + num(sg.rctn) + '/' + num(sg.rpcs) : 'W ' + num(sg.wpcs) + ' · R ' + num(sg.rpcs)}</b></div>
      <div class="fc-sumrow"><span>Abhi POS mein</span><b>${it.pack > 1 ? 'W ' + num(cr.wctn) + '/' + num(cr.wpcs) + ' · R ' + num(cr.rctn) + '/' + num(cr.rpcs) : 'W ' + num(cr.wpcs) + ' · R ' + num(cr.rpcs)}</b></div></section>
    <div class="fc-btns">${forms()[fe.id] ? '<button type="button" class="fc-no" data-fe-rm="1">🗑 Formula hatao</button>' : ''}<button type="button" class="fc-go" data-fe-save="1">✓ Formula save</button></div>`;
  if (only) { swapParts(el, html, only); return; }
  el.innerHTML = html;
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
  const v = del ? null : { per: r3(fe.per), lines: fe.lines.map(l => ({ id: l.id, q: r3(l.q), n: String(byId.get(l.id)?.name || l.n || '').slice(0, 80) })), lab: r2(fe.lab), gas: r2(fe.gas), cpp: r2(c.cpp), at: Date.now() };
  const id = fe.id;
  cfg = { ...(cfg || {}), formulas: { ...(cfg?.formulas || {}), [id]: v } };   // foran (tez)
  try { await cloud.setFactoryCfg({ formulas: { [id]: v } }); notice(del ? 'Formula hata diya' : '✓ ' + (it?.name || '') + ' ka formula save'); fe = null; $('dialog')?.close(); st.tab = 'formulas'; keep(); repaint(); }
  catch (e) { notice('Save nahi hua: ' + (e?.message || e)); }
}

// ---------- 📷 photo se formula (malik · AI sirf tasveer parhne ke liye) ----------
function pickPhoto() {
  if (!aiFormula) { notice('AI key nahi — Settings (⋮) > AI key'); return; }
  if (!isOwner()) { notice('Sirf malik'); return; }
  const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.multiple = true; i.style.display = 'none'; document.body.appendChild(i);
  i.onchange = () => { const f = [...(i.files || [])]; i.remove(); if (f.length) photoFormula(f); }; i.click();
}
async function photoFormula(files) {
  fn = null; pf = { busy: true, res: null, prodId: '', prodNew: false, prodQ: '', pieces: 0, lines: [], pick: -1, sq: '', err: '' };
  dlg('📷 Photo se formula', '<div id="fcPhoto"><div class="fc-pfwait">🤖 AI tasveer parh raha hai…<small>10–20 second</small></div></div>');
  await ensureItems();
  try {
    const r = await aiFormula(files); if (!pf) return;
    pf.res = r; pf.pieces = r.pieces > 0 ? Math.round(r.pieces) : 0;
    pf.lines = r.lines.map(l => ({ ...l, ...(l.kind === 'labour' ? { id: '', status: 'labour' } : matchItem(l.name)) }));
    const ph = pfProdHits(r.product); if (r.product && ph.length === 1 && fold(ph[0].name) === fold(r.product)) pf.prodId = ph[0].id;
    else if (r.product) { const m = matchItem(r.product); if (m.status === 'ok') pf.prodId = m.id; else if (m.status === 'new') pf.prodNew = true; }
    pf.busy = false; pfPaint();
  } catch (e) { if (!pf) return; pf.busy = false; pf.err = e?.message || String(e); pfPaint(); }
}
// naam -> POS item: pehle factory items mein bilkul, phir POS (stockAgentFind) pakka / shak, warna naya
function matchItem(name) {
  const f = fold(name); if (!f) return { id: '', status: 'new', cands: [] };
  const ex = items.find(x => fold(x.name) === f); if (ex) return { id: ex.id, status: 'ok', hit: ex.name, cands: [] };
  let r = null; try { r = stockAgentFind(name, [], 5); } catch { r = null; }
  const cands = (r?.candidates || []).map(c => ({ id: String(c.item_id), name: c.name, pack: Number(c.pack) || 0, rate: Number(c.rate?.khareed_pcs) || 0, un: c.pcs_naam || 'Pcs' }));
  if (r?.decision === 'pakka' && r.item_id) { const c = cands.find(x => x.id === String(r.item_id)) || cands[0]; return { id: String(r.item_id), status: 'ok', hit: c?.name || name, cand: c, cands }; }
  if (cands.length) { const sub = cands.find(c => fold(c.name).includes(f) || f.includes(fold(c.name))); return { id: sub ? sub.id : '', status: 'maybe', hit: sub?.name || '', cand: sub || null, cands }; }
  return { id: '', status: 'new', cands: [] };
}
const pfProdHits = q => { const F = forms(), s = String(q || '').trim().toLowerCase(); return items.filter(x => !F[x.id] && (!s || x.name.toLowerCase().includes(s) || x.code.includes(s))).slice(0, 8); };
const pfOutside = l => l.id && !byId.has(l.id);   // POS mein hai magar factory items mein nahi — save par ☑
function pfLineQ(l) {   // tasveer ki miqdaar -> formula (1 batch) — fi piece × pieces; g / ml -> kg / L agar item kg / L mein ho
  let q = Number(l.qty) || 0; if (l.per === 'piece') q *= pf.pieces || 0;
  const it = byId.get(l.id) || l.cand, u = String(it?.un || '').toLowerCase(), lu = String(l.unit || '').toLowerCase();
  if ((lu === 'g' || lu === 'gm' || lu === 'ml') && /kg|ltr|lit|^l$/.test(u)) q /= 1000;
  return r3(q);
}
function pfPaint(el0) {
  const el = el0 || $('fcPhoto'); if (!el || !pf) return;
  if (pf.busy) return;
  if (pf.err) { el.innerHTML = `<div class="fc-alert bad"><span>❌</span><div>${esc(pf.err)}</div></div><div class="fc-btns"><button type="button" class="fc-no" data-pf-back="1">✕ Band</button><button type="button" class="fc-go" data-fc-photo="1">📷 Dobara</button></div>`; return; }
  const r = pf.res, prod = byId.get(pf.prodId);
  if (pf.pick >= 0) {   // ek line ka item badalna
    const l = pf.lines[pf.pick], s = pf.sq.trim(); let hits = [];
    if (s.length >= 2) { hits = items.filter(x => x.name.toLowerCase().includes(s.toLowerCase())).slice(0, 8).map(x => ({ id: x.id, name: x.name, un: x.un, rate: x.prate }));
      try { const rr = stockAgentFind(s, [], 6); for (const c of rr?.candidates || []) if (!hits.some(h => h.id === String(c.item_id))) hits.push({ id: String(c.item_id), name: c.name, un: c.pcs_naam, rate: Number(c.rate?.khareed_pcs) || 0, out: true }); } catch {} }
    else hits = (l.cands || []).map(c => ({ ...c, out: !byId.has(c.id) }));
    el.innerHTML = `<div class="fc-bhead"><b>${esc(l.name)}</b><small>${num(l.qty)} ${esc(l.unit)} ${l.per === 'piece' ? 'fi piece' : '1 batch'}</small></div>
      <p class="ir-say">Ye POS ki kaun si item hai?</p>
      <label class="hs-search"><input type="search" data-pf-sq="1" placeholder="🔍 POS mein dhoondein…" value="${esc(pf.sq)}" autocomplete="off"></label>
      <div class="ir-tbl" id="pfHits">${hits.map(h => `<button type="button" class="ir-row" data-pf-set="${esc(h.id)}"><span><b>${esc(h.name)}</b><small>${h.rate ? rs(h.rate) + ' / ' + esc(String(h.un || 'pcs').toLowerCase()) : 'rate nahi'}${h.out ? ' · factory mein ☑ ho jayegi' : ''}</small></span><span class="ir-num"><b>✓</b></span></button>`).join('') || '<p class="lk-note">Likh kar dhoondein.</p>'}</div>
      <div class="fc-btns"><button type="button" class="fc-no" data-pf-set="new">➕ Naya item banao</button><button type="button" class="fc-no" data-pf-set="del">🗑 Line hatao</button></div>
      <div class="fc-btns"><button type="button" class="fc-no" data-pf-set="">‹ Wapas</button></div>`;
    return;
  }
  const raw = pf.lines.filter(l => l.status !== 'labour'), lab = pf.lines.filter(l => l.status === 'labour');
  const labRs = lab.reduce((s, l) => s + ((l.amount || (l.qty * l.rate)) || 0) * (l.per === 'piece' ? (pf.pieces || 0) : 1), 0);
  const rawRs = raw.reduce((s, l) => { const it = byId.get(l.id) || l.cand; const c = Number(it?.prate ?? it?.rate) || 0; const a = l.amount || l.qty * l.rate; return s + (c ? pfLineQ(l) * c : (a || 0) * (l.per === 'piece' ? (pf.pieces || 0) : 1)); }, 0);
  const nNew = raw.filter(l => l.status === 'new').length, nMaybe = raw.filter(l => l.status === 'maybe').length;
  const stat = l => l.status === 'ok' ? `<b class="fc-pfm ok">✓ ${esc(l.hit || byId.get(l.id)?.name || '')}</b>` : l.status === 'maybe' ? (l.id ? `<b class="fc-pfm maybe">? ${esc(l.hit)}</b>` : '<b class="fc-pfm maybe">? kaun si item</b>') : '<b class="fc-pfm new">➕ naya item banega</b>';
  el.innerHTML = `<section class="ir-sec fc-pfprod"><div class="fc-lab">TAYYAR MAAL (jis ka formula)</div>
      ${prod ? `<div class="fc-pfp"><div><b>${esc(prod.name)}${isPend(prod) ? ' ⏳' : ''}</b><small>${esc(prod.cat)} · stock ${esc(qt(prod.stock, prod))}</small></div><button type="button" class="fc-x" data-pf-prod="">✕</button></div>` : pf.prodNew ? `<div class="fc-pfp new"><div><b>➕ Naya item: ${esc((pf.prodQ || r.product).trim())}</b><small>POS mein PC banayega (⏳) — formula abhi</small></div><button type="button" class="fc-x" data-pf-prod="">✕</button></div>`
        : `<label class="hs-search"><input type="search" data-pf-pq="1" placeholder="🔍 tayyar maal ka naam…" value="${esc(pf.prodQ || r.product)}" autocomplete="off"></label><div class="ir-tbl" id="pfProd">${pfProdHits(pf.prodQ || r.product).map(x => `<button type="button" class="ir-row" data-pf-prod="${esc(x.id)}"><span><b>${esc(x.name)}</b><small>${esc(x.cat)}</small></span><span class="ir-num"><b>✓</b></span></button>`).join('')}${(pf.prodQ || r.product).trim() ? `<button type="button" class="ir-row" data-pf-prodnew="1"><span><b>➕ Naya item "${esc(pf.prodQ || r.product)}"</b><small>POS mein nahi — PC banayega</small></span></button>` : ''}</div>`}
      <div class="fc-batchrow"><span>1 batch =</span><input type="number" inputmode="numeric" min="1" step="1" data-pf-pieces="1" value="${pf.pieces || ''}" placeholder="?"><span>piece${r.packSize ? ' (' + esc(r.packSize) + ')' : ''}</span></div>
      ${!pf.pieces ? '<small class="fc-lnote bad">⚠️ Ek batch se kitne piece bante hain — likhein (fi piece packing isi se lagti hai)</small>' : r.totalQty ? `<small class="fc-lnote">tasveer: batch ${num(r.totalQty)} · ${r.totalCost ? rs(r.totalCost) : ''}</small>` : ''}</section>
    <section class="ir-sec"><div class="ir-sh"><b>Raw maal</b><small>${num(raw.length)} line${nNew ? ' · ' + nNew + ' nayi' : ''}${nMaybe ? ' · ' + nMaybe + ' shak' : ''}</small></div>
      <div class="ir-tbl">${pf.lines.map((l, i) => l.status === 'labour' ? '' : `<div class="ir-row fc-pfl"><span><b>${esc(l.name)}</b><small>${num(l.qty)} ${esc(l.unit)} ${l.per === 'piece' ? 'fi piece → ' + num(pfLineQ(l)) + ' / batch' : '/ batch'}${l.rate ? ' · ' + rs(l.rate) : ''}${l.kind === 'packing' ? ' · packing' : ''}</small>${stat(l)}</span><span class="fc-crow"><input type="number" inputmode="decimal" min="0" step="any" data-pf-q="${i}" value="${esc(String(l.qty))}"><button type="button" class="fc-pfa${l.status === 'ok' ? '' : ' warn'}" data-pf-pick="${i}">${l.status === 'ok' ? '✎' : '?'}</button></span></div>`).join('')}</div>
      ${lab.length ? `<div class="fc-sub">Mazdoori / labour → batch ka kharcha</div><div class="ir-tbl">${lab.map((l, i) => `<div class="ir-row"><span><b>${esc(l.name)}</b><small>${num(l.qty)} ${esc(l.unit)} ${l.per === 'piece' ? 'fi piece' : ''}${l.rate ? ' × ' + rs(l.rate) : ''}</small></span><span class="fc-crow"><b>${rs(((l.amount || l.qty * l.rate) || 0) * (l.per === 'piece' ? (pf.pieces || 0) : 1))}</b><button type="button" class="ir-cx" data-pf-del="${i}">✕</button></span></div>`).join('')}</div>` : ''}</section>
    <section class="ir-sec fc-sum"><div class="fc-sumrow"><span>Raw (tasveer ke rate / POS khareed)</span><b>${rs(rawRs)}</b></div><div class="fc-sumrow"><span>Mazdoori</span><b>${rs(labRs)}</b></div><div class="fc-sumrow"><span>Laagat fi piece</span><b>${pf.pieces ? rs((rawRs + labRs) / pf.pieces) : '—'}</b></div></section>
    <p class="lk-note">Save ke baad formula mein POS ka <b>khareed rate</b> lagta hai (tasveer ka nahi). Nayi items PC on hote hi POS mein banengi (⏳).</p>
    <div class="fc-btns"><button type="button" class="fc-no" data-pf-back="1">✕ Chhoro</button><button type="button" class="fc-go" data-pf-save="1">✓ Formula banao</button></div>`;
}
async function pfSave() {
  if (!pf || pf.busy) return; const r = pf.res;
  if (!pf.prodId && !pf.prodNew) { notice('Tayyar maal chunein (ya ➕ naya)'); return; }
  if (!(pf.pieces > 0)) { notice('1 batch = kitne piece — likhein'); return; }
  const raw = pf.lines.filter(l => l.status !== 'labour');
  if (!raw.length) { notice('Koi raw maal line nahi'); return; }
  if (raw.some(l => l.status === 'maybe' && !l.id)) { notice('"?" wali lines ka item chunein'); return; }
  if (!cloud?.setFactoryCfg) { notice('App update karein'); return; }
  pf.busy = true; $('fcPhoto').innerHTML = '<div class="fc-pfwait">⏳ Items ban rahi hain…</div>';
  try {
    const tick = {};
    let prodId = pf.prodId;
    if (pf.prodNew) { const name = (pf.prodQ || r.product).trim(); const jid = await stockNewItemQuick({ name, rpcs: 0 }); window.ntFacPend(jid, name); prodId = 'job:' + jid; }
    else if (!byId.has(prodId)) tick[prodId] = true;
    const lines = [];
    for (const l of raw) {
      let id = l.id;
      if (l.status === 'new' || !id) { const jid = await stockNewItemQuick({ name: l.name, costP: l.rate || 0, rpcs: 0 }); window.ntFacPend(jid, l.name, l.rate || 0); id = 'job:' + jid; }
      else if (!byId.has(id)) tick[id] = true;
      lines.push({ id, q: pfLineQ(l), n: l.name });
    }
    if (Object.keys(tick).length) { cfg = { ...(cfg || {}), items: { ...(cfg?.items || {}), ...tick } }; await cloud.setFactoryCfg({ items: tick }); }
    loadItemsQuiet();
    const lab = pf.lines.filter(l => l.status === 'labour').reduce((s, l) => s + ((l.amount || (l.qty * l.rate)) || 0) * (l.per === 'piece' ? pf.pieces : 1), 0);
    fe = { id: prodId, per: pf.pieces, lines: lines.filter(l => l.q > 0).map(l => ({ id: l.id, q: l.q, n: l.n })), lab: r2(lab), gas: 0, q: '' };
    pf = null; await formSave(false); try { stockRepaint(); } catch {}
  } catch (e) { pf.busy = false; pf.err = e?.message || String(e); pfPaint(); }
}

// ---------- 🏷 rates (malik) ----------
function ratesHTML(up) {
  const can = stockFactoryCanRate(), rows = rateRows().sort((a, b) => (rateDiff(b) ? 1 : 0) - (rateDiff(a) ? 1 : 0));
  const todo = rows.filter(rateDiff);
  const cell = (k, lab, x) => (x.it.pack > 1 || k.endsWith('pcs')) ? `<div class="fc-rb"><small>${lab}</small>${Math.abs((x.sg[k] || 0) - (x.cr[k] || 0)) >= 1 ? `<s>${num(x.cr[k])}</s><b>${num(x.sg[k])}</b>` : `<b class="same">${num(x.cr[k])}</b>`}</div>` : '';
  return `<section class="ir-sec"><div class="ir-sh"><b>🏷 Rates — laagat + nafa</b><small>W ${wm()}% · R ${rm()}% <button type="button" class="fc-link" data-fc-set="1">⚙️ badlein</button></small></div>
    ${todo.length > 1 && can ? `<button type="button" class="fc-go" data-fc-rate="*">✓ Sab ${num(todo.length)} naye rate POS mein lagao</button>` : ''}
    ${rows.map(x => `<div class="fc-rc${rateDiff(x) ? '' : ' same'}"><div class="fc-rh"><b>${esc(x.it.name)}</b><small>laagat ${rs(x.c.cpp)}${x.it.pack > 1 ? ' · ' + rs(x.c.cpp * x.it.pack) + ' / ctn' : ''}${up?.some(u => u.it.id === x.it.id) ? ' · ⚠️ barhi' : ''}</small></div>
      <div class="fc-rg">${cell('wctn', 'W CTN', x)}${cell('wpcs', 'W PCS', x)}${cell('rctn', 'R CTN', x)}${cell('rpcs', 'R PCS', x)}</div>
      ${rateDiff(x) ? (can ? `<button type="button" class="fc-go sm" data-fc-rate="${esc(x.it.id)}">Ye rate POS mein lagao</button>` : '<small class="lk-note">Rate sirf malik laga sakta hai</small>') : '<small class="fc-ok">✓ Rate theek hai</small>'}</div>`).join('') || '<p class="lk-note">Pehle formula banayein (⏳ PC baqi items ka rate POS mein banne ke baad).</p>'}
    <p class="lk-note">Rate tab tak nahi badalta jab tak aap "lagao" na dabayein. PC 1 min mein POS mein lagata hai.</p></section>`;
}
async function applyRate(id) {
  const F = forms(), list = id === '*' ? rateRows().filter(rateDiff).map(x => x.it) : [byId.get(String(id))].filter(x => x && !isPend(x));
  if (!list.length) return;
  if (id === '*' && !confirm(list.length + ' items ke naye rate POS mein lagane hain?')) return;
  let ok = 0;
  for (const it of list) { const sg = suggest(it, costOf(F[it.id]).cpp); const p = it.pack > 1 ? { wctn: sg.wctn, wpcs: sg.wpcs, rctn: sg.rctn, rpcs: sg.rpcs } : { wpcs: sg.wpcs, rpcs: sg.rpcs };
    try { await stockAgentItemSave(it.id, p); ok++; } catch (e) { notice(it.name + ': ' + (e?.message || e)); } }
  if (ok) notice('✓ ' + ok + ' item ke rate PC ko bheje — 1 min mein POS mein');
}

// ---------- 📦 raw maal ----------
let rq = '';
function rawRows() {
  const F = forms(), uses = new Map();
  for (const [fid, f] of Object.entries(F)) for (const l of f.lines || []) { const a = uses.get(String(l.id)) || []; a.push({ fid, q: Number(l.q) || 0 }); uses.set(String(l.id), a); }
  return rawItems().map(x => { const u = uses.get(x.id) || []; const need = Math.max(0, ...u.map(y => y.q)); return { x, u, need, kam: need > 0 && x.stock < need }; });
}
const rawKam = () => rawRows().filter(r => r.kam);
function rawHTML() {
  const list = rawRows().filter(({ x }) => !rq || x.name.toLowerCase().includes(rq.toLowerCase())).sort((a, b) => (b.kam ? 1 : 0) - (a.kam ? 1 : 0) || (b.u.length ? 1 : 0) - (a.u.length ? 1 : 0) || a.x.name.localeCompare(b.x.name));
  return `<section class="ir-sec"><div class="ir-sh"><b>📦 Raw maal (dukan godam)</b><small>${num(list.length)}</small></div>
    ${goPurchase && (isOwner() || canOf('v:purchase')) ? '<button type="button" class="fc-go sm" data-fc-pur="1">🧾 Raw maal ki purchase daalein</button>' : ''}
    <label class="hs-search"><input type="search" data-fc-rq="1" placeholder="🔍 raw maal…" value="${esc(rq)}" autocomplete="off"></label>
    <div class="ir-tbl" id="fcRqList">${list.slice(0, 80).map(({ x, u, need, kam }) => `<div class="ir-row${kam ? ' kam' : ''}"><span><b>${esc(x.name)}${isPend(x) ? ' ⏳' : ''}</b><small>${u.length ? u.length + ' formula mein · 1 batch = ' + esc(qt(need, x)) : 'kisi formula mein nahi'}${x.prate ? ' · ' + rs(x.prate) + ' / ' + esc(un(x)) : ''}</small></span><span class="ir-num"><b class="${x.stock < 0 || kam ? 'fc-neg' : ''}">${esc(qt(x.stock, x))}</b><small class="${kam ? 'neg' : 'pos'}">${kam ? 'kam — 1 batch se kam' : need ? '~' + num(Math.floor(x.stock / need)) + ' batch ka' : ''}</small></span></div>`).join('') || '<p class="lk-note">Raw maal nahi mila — ⚙️ mein ☑ Factory items chunein.</p>'}</div></section>`;
}

// ---------- ⚙️ settings (malik): ☑ items · nafa % · label default ----------
function setDlg() {
  if (!isOwner()) { notice('Sirf malik'); return; }
  watchCfg(); dlg('⚙️ Factory settings', '<div id="fcSet"></div>'); setPaint();
}
function setPaint() {
  const el = $('fcSet'); if (!el) return; const lbl = cfg?.lbl || 'pcs';
  el.innerHTML = `<button type="button" class="fc-pickbtn" data-fc-pick="1">☑ Factory items chunein <small>${itemsOk ? num(items.filter(x => !isPend(x)).length) + ' factory mein' : ''}</small></button>
    <section class="ir-sec"><div class="ir-sh"><b>Nafa % (naye rate ke liye)</b></div>
      <div class="fc-two"><label>Wholesale nafa %<input type="number" inputmode="decimal" min="0" max="200" data-fc-wm="1" value="${wm()}"></label><label>Retail nafa %<input type="number" inputmode="decimal" min="0" max="300" data-fc-rm="1" value="${rm()}"></label></div>
      <small class="fc-lnote">Rate = laagat + nafa — carton 5 Rs tak upar, piece 1 Rs tak upar. Rate POS mein tab lagta hai jab aap 🏷 mein "lagao" dabayein.</small></section>
    <section class="ir-sec"><div class="ir-sh"><b>Batch par label (default)</b></div>
      <div class="fc-lbl">${[['pcs', 'Packet'], ['ctn', 'Carton'], ['both', 'Dono'], ['none', 'Nahi']].map(([k, l]) => `<button type="button" class="${lbl === k ? 'on' : ''}" data-fc-lbldef="${k}">${l}</button>`).join('')}</div>
      <small class="fc-lnote">Larka batch mein "Aur…" se badal sakta hai.</small></section>
    ${pendList().length ? `<section class="ir-sec"><div class="ir-sh"><b>⏳ PC baqi items</b><small>${num(pendList().length)}</small></div><div class="ir-tbl">${pendList().map(p => `<div class="ir-row"><span><b>${esc(p.n)}</b><small>POS mein PC on hote hi banegi</small></span><span class="fc-crow"><button type="button" class="ir-cx" data-fc-penddel="${esc(p.id)}">✕</button></span></div>`).join('')}</div></section>` : ''}`;
}

// ---------- ☑ factory items chunna (malik) ----------
async function openPicker() {
  if (!isOwner()) { notice('Sirf malik'); return; }
  watchCfg(); pk = { q: '', f: 'sab', lim: 60 };
  dlg('☑ Factory items chunein', '<div id="fcPick"><p class="lk-note">⏳ Items aa rahi hain…</p></div>');
  if (!(await ensureItems())) return; pickPaint();
}
function pickPaint(only) {
  const el = $('fcPick'); if (!el || !pk) return;
  let all = []; try { all = stockPickList(); } catch {}
  const isOn = x => { const v = cfg?.items?.[x.id]; return v === true || (v !== false && (x.catFac || doneReal.has(x.id))); };
  const q = pk.q.trim().toLowerCase(), F = forms();
  const list = all.filter(x => (pk.f === 'on' ? isOn(x) : pk.f === 'cat' ? x.catFac : true) && (!q || x.name.toLowerCase().includes(q) || x.code.includes(q)))
    .sort((a, b) => (isOn(b) ? 1 : 0) - (isOn(a) ? 1 : 0) || a.name.localeCompare(b.name));
  const nOn = all.filter(isOn).length;
  const html = `<p class="ir-say">Jis item par <b>☑</b> lagayein wo factory mein aa jayegi — formula wali = <b>tayyar maal</b>, baqi = <b>raw maal</b>.</p>
    <div class="fc-per fc-pf">${[['sab', 'Sab (' + num(all.length) + ')'], ['on', '☑ Chuni hui (' + num(nOn) + ')'], ['cat', 'Category wali (' + num(all.filter(x => x.catFac).length) + ')']].map(([k, l]) => `<button type="button" class="${pk.f === k ? 'on' : ''}" data-fp-f="${k}">${l}</button>`).join('')}</div>
    <label class="hs-search"><input type="search" data-fc-pq="1" placeholder="🔍 naam ya barcode…" value="${esc(pk.q)}" autocomplete="off"></label>
    <div id="fcPickList">${pendList().map(p => `<div class="fc-pk pk-on"><span>⏳</span><span><b>${esc(p.n)}</b><small>PC baqi — formula / batch abhi; POS mein bante hi asli item se jur jayega</small></span></div>`).join('')}
    <div class="fc-picks">${list.slice(0, pk.lim).map(x => `<label class="fc-pk${isOn(x) ? ' pk-on' : ''}"><input type="checkbox" data-fac-tick="${esc(x.id)}"${isOn(x) ? ' checked' : ''}><span><b>${esc(x.name)}</b><small>${esc(x.cat || '—')} · stock ${esc(qt(x.stock, x))}${F[x.id] ? ' · 🧪 formula' : ''}</small></span></label>`).join('') || '<p class="lk-note">Kuch nahi mila.</p>'}</div>
    ${list.length > pk.lim ? `<button type="button" class="fc-no" data-fp-more="1">Aur dikhao (${num(list.length - pk.lim)})</button>` : ''}</div>`;
  if (only) { swapParts(el, html, only); return; }
  el.innerHTML = html;
}
async function facToggle(id, on, box) {
  if (!isOwner() || !cloud?.setFactoryCfg) { if (box) box.checked = !on; notice('Sirf malik'); return; }
  let cat = false; try { const x = stockPickList().find(y => y.id === String(id)); cat = !!x?.catFac; } catch {}
  if (!on && forms()[String(id)] && !confirm('Is item ka formula bana hua hai — factory se hatana hai?')) { if (box) box.checked = true; return; }
  const v = on ? (cat ? null : true) : (cat || doneReal.has(String(id)) ? false : null), prev = cfg?.items?.[String(id)];
  cfg = { ...(cfg || {}), items: { ...(cfg?.items || {}), [String(id)]: v } };   // foran (tez)
  loadItemsQuiet(); repaint(); if ($('fcPick')) pickPaint(); try { stockRepaint(); } catch {}
  try { await cloud.setFactoryCfg({ items: { [String(id)]: v } }); }
  catch (e) { cfg = { ...(cfg || {}), items: { ...(cfg?.items || {}), [String(id)]: prev ?? null } }; loadItemsQuiet(); repaint(); if ($('fcPick')) pickPaint(); notice('Save nahi hua: ' + (e?.message || e)); }
}

// ---------- ➕ naya batch (larka) — 3 qadam ----------
export async function openBatch() {
  watch();
  if (!canFacBatch()) { notice('🔒 Batch ki ijazat nahi (malik: Settings → Mulazim)'); return; }
  dlg('🏭 Naya batch', '<div id="fcBatch"><p class="lk-note">⏳ Items aa rahi hain…</p></div>');
  const ok = await ensureItems(); if (!ok) { const el = $('fcBatch'); if (el) el.innerHTML = `<p class="ir-say">Stock load nahi hua: ${esc(itemsErr)}</p>`; return; }
  const fin = finished(); fb = { id: fin.length === 1 ? fin[0].id : (fb?.id && forms()[fb.id] ? fb.id : ''), n: 1, real: '', lbl: cfg?.lbl || 'pcs', busy: false, more: false };
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
const stepn = (n, t, s) => `<div class="fc-stepn"><span>${n}</span><b>${t}</b>${s ? `<small>${s}</small>` : ''}</div>`;
function batchPaint() {
  const el = $('fcBatch'); if (!el || !fb) return;
  const fin = finished(), F = forms();
  if (!fin.length) { el.innerHTML = `<p class="ir-say">Abhi koi formula nahi bana. ${isOwner() ? 'Pehle 🧪 Formulas mein tayyar maal ka nuskha banayein.' : 'Malik pehle formula banaye.'}</p>`; return; }
  const it = byId.get(fb.id), f = it ? F[it.id] : null, c = f ? costOf(f, fb.n) : null;
  const out = c ? (Number(fb.real) > 0 ? r3(Number(fb.real)) : c.out) : 0;
  const L = labelSpecs(it, out, fb.lbl), kam = c ? c.lines.filter(l => l.stock < l.q) : [];
  const ctnOk = it && it.pack > 1 && (it.labels || []).some(x => !x.main && Math.abs(x.qty - it.pack) < 0.001);
  el.innerHTML = `<div class="fc-bhead"><b>${esc(batchNo())}</b><small>${esc(today())} · ${esc(whoOf() || '')}</small></div>
    ${stepn(1, 'Kya banaya?')}
    <div class="fc-items">${fin.map(x => `<button type="button" class="fc-it${x.id === fb.id ? ' on' : ''}" data-fb-it="${esc(x.id)}"><b>${esc(x.name)}</b><small>stock: ${esc(qt(x.stock, x))}</small></button>`).join('')}</div>
    ${it ? `${stepn(2, 'Kitne batch bane?', '1 batch = ' + esc(qt(f.per, it)))}
    <div class="fc-nums">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<button type="button" class="${n === fb.n ? 'on' : ''}" data-fb-n="${n}">${n}</button>`).join('')}</div>
    <div class="fc-out"><div><b>+ ${esc(qt(out, it))}</b><small>${num(out)} ${esc(un(it))}${Number(fb.real) > 0 ? ' (asal ginti)' : ''} · laagat ${rs(c.total)}</small></div></div>
    <div class="fc-rawsum ${kam.length ? 'bad' : 'ok'}">${kam.length ? `⚠️ ${num(kam.length)} raw maal stock mein kam: ${esc(kam.map(l => l.name).slice(0, 3).join(', '))}` : `✓ ${num(c.lines.length)} raw maal khud minus hoga — stock poora hai`}${c.gone ? ` · ⚠️ ${c.gone} item factory mein nahi` : ''}</div>
    <button type="button" class="fc-moreb" data-fb-more="1">${fb.more ? '▴ Kam dikhao' : '▾ Aur… (asal ginti · label · raw list)'}</button>
    ${fb.more ? `<div class="fc-more">
      <div class="fc-lab">ASAL GINTI ALAG? <small>formula se kam / zyada bana ho</small></div>
      <div class="fc-out"><label>Asal ${esc(un(it))}<input type="number" inputmode="decimal" min="0" step="any" data-fb-real="1" value="${esc(String(fb.real || ''))}" placeholder="${num(c.out)}"></label><div><small>khali = formula ke mutabiq ${num(c.out)}</small></div></div>
      <div class="fc-lab">RAW MAAL — KHUD MINUS <small>lagega / stock</small></div>
      <div class="fc-raw">${c.lines.map(l => `<div><span>${esc(l.name)}</span><b>${esc(qt(l.q, l.it))}</b><em class="${l.stock < l.q ? 'bad' : 'ok'}">${esc(qt(l.stock, l.it))}${l.stock < l.q ? ' kam' : ' ✓'}</em></div>`).join('')}</div>
      <div class="fc-lab">BARCODE LABEL <small>batch no ke saath</small></div>
      <div class="fc-lbl">${[['pcs', 'Packet'], ...(ctnOk ? [['ctn', 'Carton (sub)'], ['both', 'Dono']] : []), ['none', 'Nahi']].map(([k, l]) => `<button type="button" class="${fb.lbl === k ? 'on' : ''}" data-fb-lbl="${k}">${l}</button>`).join('')}</div>
      <small class="fc-lnote">${L.length ? L.map(x => `${num(x.copies)} label × ${esc(x.code || 'naya barcode (POS dega)')}${x.qty > 1 ? ' (' + num(x.qty) + ')' : ''}`).join(' · ') + ' — OK par khud chhapenge' : fb.lbl === 'none' ? 'Label nahi chhapenge' : '⚠️ Is item ka barcode nahi mila'}</small></div>` : `<small class="fc-lnote">${L.length ? 'Label: ' + L.map(x => num(x.copies) + ' × ' + (x.qty > 1 ? 'carton' : 'packet')).join(' · ') + ' — OK par khud chhapenge' : fb.lbl === 'none' ? 'Label nahi chhapenge' : '⚠️ Is item ka barcode nahi — label nahi chhapega'}</small>`}
    ${stepn(3, 'OK')}
    <button type="button" class="fc-ok-btn" data-fb-ok="1"${fb.busy ? ' disabled' : ''}>✓ OK — ${num(fb.n)} batch darj karo</button>` : '<p class="lk-note">Upar se item chunein.</p>'}`;
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
  notice(`✓ ${d.no} · ${it.name} · ${fb.n} batch — PC 1 min mein POS stock badlega${d.labels.length ? ' + label' : ''}`);
  fb = null; $('dialog')?.close(); st.tab = 'batches'; keep(); repaint();
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
      ${step(posted ? 'ok' : b.status === 'error' ? 'bad' : 'wait', posted ? 'POS stock badla' : b.status === 'error' ? 'POS mein nahi gaya' : b.waitItem ? 'Item POS mein banne ka intezar' : 'PC ko ja raha…', posted ? `Adjustment # ${esc(b.adjNo || '')} · ${b.postedAt ? esc(short(b.postedAt)) : ''}` : b.status === 'error' ? esc(b.err || '') : 'Server PC 1 min mein')}
      <div class="fc-mv"><div><span>${esc(b.name)}</span><b class="plus">+${esc(qt(b.out, it))}</b></div>${(b.lines || []).map(l => `<div><span>${esc(l.name)}</span><b class="minus">−${esc(qt(l.q, byId.get(String(l.id))))}</b></div>`).join('')}</div>
      ${(b.labels || []).length ? step(b.lblDone ? 'ok' : 'wait', b.lblDone ? 'Label printer ko gaye' : 'Label (POS ke baad)', (b.labels || []).map(l => `${num(l.copies)} × ${esc(l.code)}`).join(' · ')) : ''}
      ${b.status === 'cancelled' ? step('ok', '↩ Wapas ho gaya', `ulta adjustment # ${esc(b.revNo || '')}`) : b.status === 'cancelReq' ? step('wait', '↩ Wapas ho raha…', '') : ''}
    </section>
    <section class="ir-sec fc-sum"><div class="fc-sumrow"><span>Laagat</span><b>${rs(b.cost)}</b></div><div class="fc-sumrow"><span>Fi ${esc(un(it))}</span><b>${rs(b.out ? b.cost / b.out : 0)}</b></div>${b.oh ? `<div class="fc-sumrow"><span>Mazdoori / gas</span><b>${rs(b.oh)}</b></div>` : ''}</section>
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
  const t = e.target.closest?.('[data-fc-per],[data-fc-tab],[data-fc-set],[data-fc-batch],[data-fc-b],[data-fc-f],[data-fc-fnew],[data-fc-photo],[data-fc-rate],[data-fc-pdf],[data-fc-bpdf],[data-fc-act],[data-fc-pur],[data-fc-lbldef],[data-fc-penddel],[data-fb-it],[data-fb-n],[data-fb-lbl],[data-fb-more],[data-fb-ok],[data-fe-del],[data-fe-add],[data-fe-save],[data-fe-rm],[data-pf-prod],[data-pf-prodnew],[data-pf-pick],[data-pf-set],[data-pf-del],[data-pf-back],[data-pf-save]');
  if (!t) return; const d = t.dataset;
  if (d.fcPdf != null) { if (!pdfOf) return; const l = batches.filter(inPer); pdfOf(pdfHTML(l, 'Factory production — ' + (PER.find(p => p[0] === st.per)?.[1] || '')), 'Factory production ' + today()); return; }
  if (!t.closest('.fc-root')) return;
  if (d.fcPer) { st.per = d.fcPer; keep(); paint(); return; }
  if (d.fcTab) { st.tab = d.fcTab; keep(); paint(); return; }
  if (d.fcSet != null) { setDlg(); return; }
  if (d.fcBatch != null) { openBatch(); return; }
  if (d.fcB) { batchDlg(d.fcB); return; }
  if (d.fcFnew != null) { fnewDlg(); return; }
  if (d.fcPhoto != null) { pickPhoto(); return; }
  if (d.fcF) { openFormula(d.fcF); return; }
  if (d.fcRate) { applyRate(d.fcRate); return; }
  if (d.fcPur != null) { try { goPurchase?.(); } catch {} return; }
  if (d.fcLbldef) { if (!cloud?.setFactoryCfg) return; cfg = { ...(cfg || {}), lbl: d.fcLbldef }; setPaint(); cloud.setFactoryCfg({ lbl: d.fcLbldef }).catch(er => notice('Save nahi hua: ' + (er?.message || er))); return; }
  if (d.fcPenddel) { if (confirm('Ye pending item factory se hatani hai? (POS job wahi rahega)')) { window.ntFacPendDel(d.fcPenddel); if ($('fcSet')) setPaint(); } return; }
  if (d.fcBpdf) { const b = batches.find(x => x.id === d.fcBpdf); if (b && pdfOf) { $('dialog')?.close(); pdfOf(pdfHTML([b], 'Batch ' + b.no + ' — ' + b.name), 'Batch ' + b.no); } return; }
  if (d.fcAct) { const id = d.id; if (d.fcAct === 'cancel' && !confirm('Ye batch wapas lena hai? POS mein ulta adjustment banega (tayyar maal −, raw maal +).')) return;
    Promise.resolve(cloud?.factoryBatchAct?.(id, d.fcAct)).then(() => { notice(d.fcAct === 'cancel' ? '↩ Wapas ho raha — PC 1 min' : '↻ Dobara bheja'); $('dialog')?.close(); }).catch(er => notice('Nahi hua: ' + (er?.message || er))); return; }
  if (d.fbIt && fb) { fb.id = d.fbIt; fb.real = ''; batchPaint(); return; }
  if (d.fbN && fb) { fb.n = Number(d.fbN); fb.real = ''; batchPaint(); return; }
  if (d.fbLbl && fb) { fb.lbl = d.fbLbl; batchPaint(); return; }
  if (d.fbMore != null && fb) { fb.more = !fb.more; batchPaint(); return; }
  if (d.fbOk != null) { batchOk(); return; }
  if (d.feDel != null && fe) { fe.lines.splice(Number(d.feDel), 1); formPaint(); return; }
  if (d.feAdd && fe) { fe.lines.push({ id: d.feAdd, q: 1, n: byId.get(d.feAdd)?.name || '' }); fe.q = ''; formPaint(); return; }
  if (d.feSave != null) { formSave(false); return; }
  if (d.feRm != null) { formSave(true); return; }
  if (!pf) return;
  if (d.pfProd != null) { pf.prodId = d.pfProd; pf.prodNew = false; pfPaint(); return; }
  if (d.pfProdnew != null) { pf.prodNew = true; pf.prodId = ''; pfPaint(); return; }
  if (d.pfPick != null) { pf.pick = Number(d.pfPick); pf.sq = ''; pfPaint(); return; }
  if (d.pfSet != null) { const l = pf.lines[pf.pick]; if (l) { if (d.pfSet === 'new') { l.id = ''; l.status = 'new'; l.hit = ''; l.cand = null; } else if (d.pfSet === 'del') pf.lines.splice(pf.pick, 1);
      else if (d.pfSet) { const h = byId.get(d.pfSet); const cc = (l.cands || []).find(c => c.id === d.pfSet); l.id = d.pfSet; l.status = 'ok'; l.hit = h?.name || cc?.name || $('pfHits')?.querySelector(`[data-pf-set="${CSS.escape(d.pfSet)}"] b`)?.textContent || d.pfSet; l.cand = cc || (h ? null : { id: d.pfSet, name: l.hit, un: 'Pcs', rate: 0 }); } }
    pf.pick = -1; pfPaint(); return; }
  if (d.pfDel != null) { pf.lines.splice(Number(d.pfDel), 1); pfPaint(); return; }
  if (d.pfBack != null) { pf = null; $('dialog')?.close(); return; }
  if (d.pfSave != null) { pfSave(); return; }
});
let qT = 0;
document.addEventListener('input', e => {
  const t = e.target; if (!t?.dataset || !t.closest?.('.fc-root')) return; const d = t.dataset;
  if (d.fcFq != null && fn) { fn.q = t.value || ''; clearTimeout(qT); qT = setTimeout(() => fnewPaint(['fcFqList']), 180); return; }
  if (d.fcRq != null) { rq = t.value || ''; clearTimeout(qT); qT = setTimeout(() => paint(['fcRqList']), 180); return; }
  if (d.fcPq != null && pk) { pk.q = t.value || ''; pk.lim = 60; clearTimeout(qT); qT = setTimeout(() => pickPaint(['fcPickList']), 180); return; }
  if (d.fcFq2 != null && fe) { fe.q = t.value || ''; clearTimeout(qT); qT = setTimeout(() => formPaint(['feHits']), 180); return; }
  if (d.pfPq != null && pf) { pf.prodQ = t.value || ''; clearTimeout(qT); qT = setTimeout(() => pfSwap(['pfProd']), 180); return; }
  if (d.pfSq != null && pf) { pf.sq = t.value || ''; clearTimeout(qT); qT = setTimeout(() => pfSwap(['pfHits']), 180); return; }
});
// photo dialog: search ke waqt sirf list badle (input na toote)
function pfSwap(ids) { const el = $('fcPhoto'); if (!el || !pf) return; const tmp = document.createElement('div'); pfPaint(tmp); swapParts(el, tmp.innerHTML, ids); }
document.addEventListener('change', e => {
  const t = e.target;
  if (t?.dataset?.facTick) { facToggle(t.dataset.facTick, t.checked, t); return; }   // stock screen + picker
  if (!t?.dataset || !t.closest?.('.fc-root')) return; const d = t.dataset, v = Number(t.value);
  if (d.fbReal != null && fb) { fb.real = v > 0 ? v : ''; batchPaint(); return; }
  if (fe) {
    if (d.fePer != null) { fe.per = v > 0 ? v : fe.per; formPaint(); return; }
    if (d.feQ != null) { const l = fe.lines[Number(d.feQ)]; if (l) l.q = v >= 0 ? v : 0; formPaint(); return; }
    if (d.feLab != null) { fe.lab = v >= 0 ? v : 0; formPaint(); return; }
    if (d.feGas != null) { fe.gas = v >= 0 ? v : 0; formPaint(); return; }
  }
  if (pf) {
    if (d.pfPieces != null) { pf.pieces = v > 0 ? Math.round(v) : 0; pfPaint(); return; }
    if (d.pfQ != null) { const l = pf.lines[Number(d.pfQ)]; if (l) l.qty = v >= 0 ? v : 0; pfPaint(); return; }
  }
  if ((d.fcWm != null || d.fcRm != null) && cloud?.setFactoryCfg) { if (!(v >= 0)) return; cfg = { ...(cfg || {}), ...(d.fcWm != null ? { wm: v } : { rm: v }) }; cloud.setFactoryCfg(d.fcWm != null ? { wm: v } : { rm: v }).then(() => notice('✓ Nafa ' + v + '% save')).catch(er => notice('Save nahi hua: ' + (er?.message || er))); }
});
export const _fcTest = { costOf, suggest, labelSpecs, qt, set: (c, b, it) => { cfg = c; batches = b || []; items = it || []; byId = new Map(items.map(x => [x.id, x])); itemsOk = true; }, batchNo, pdfHTML, st, matchItem, photoFormula, pf: () => pf, pendItems: () => pendItems(items.filter(x => !x.pending)) };
