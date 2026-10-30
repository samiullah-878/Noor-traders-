// factory.js — v2.101.1: 🏭 FACTORY PRODUCTION (malik: "apni factory ki items — formula, batch, larka OK kare to POS stock khud +/−, rates khud,
//   batch ka barcode label, raw maal ki purchase"). Naqsha: Design artifact "Factory Production — naqsha".
// Items: POS ki category mein 'factory' (pos-stock isFactory) ya malik ka ☑ — jis ka FORMULA bana = tayyar maal, baqi = raw maal. Stock / rate POS se.
// Firestore: factory/cfg {formulas:{itemId:{per, lines:[{id,q,n}], lab, gas, cpp, at} | null}, items:{id:true|false|null}, pend:{jobId:{n,at,c}|null}, wm, rm, lbl} (sirf malik) ·
//   factoryBatches/<id> {no, itemId, n (1–10), per, out, lines:[{id,name,q,c}], cost, oh, labels:[…], status 'new'} — larka (Full / Stock) banaye;
//   PC factory-post.js: POS Adjustment (+ tayyar maal, − raw maal; dukan godam) -> status 'posted' + adjNo, phir label jobs (batch no ke saath).
//   Malik: 'cancelReq' (ulta Adjustment) / 'new' dobara. Rate: pos-stock stockAgentItemSave (itemJobs, PC item-post) — malik dabaye tab.
// v2.101.1: NAYI TARTEEB (malik: "sahi tarteeb se nahi, bohat masail, easy + premium") — 4 tab (📋 Batches · 🧪 Formulas · 🏷 Rates · 📦 Raw maal),
//   ⚙️ Settings sheet (☑ items chunna + nafa % + label default), batch 3 qadam (① item ② batch 1–10 ③ OK; "Aur…" mein asal ginti / label / raw list).
//   Bugs: (1) ⏳ pending ka naam POS mein pehle se = ⚠️ alert (2) larke ke phone par bhi done job = factory item (3) ⏳ item par rate nahi
//   (4) ❌ masla alert tap se batch khule (5) raw ka naam formula mein mehfooz (n) — item hat jaye to bhi dikhe (6) formula chooser mein raw alag (7) mara hua code hata.
//   📷 PHOTO SE FORMULA (AI sirf tasveer parhne ke liye — Excel / parchi): lines -> POS items se milao (stockAgentFind) -> na mile to naya item
//   (stockNewItemQuick, ⏳ job:) -> formula save. Fi piece packing × pieces; labour -> mazdoori. Tez: OK = setDoc foran. AI aur kahin NAHI.
// v2.103.0: 📱 FACTORY SIRF APP (malik: "factory ka data sirf app mein rahe, POS mein na jaye — POS se sirf items uthaye, baqi kuch na jaye").
//   cfg.posOn !== true (default) = SIRF APP: batch status 'app' (PC factory-post chhoota bhi nahi), label app khud labelJobs (batch no),
//   ginti / 📥 maal aaya / 📤 maal diya = factoryMoves, naya item = cfg.local ('loc:<id>' — POS mein nahi), rate sirf factory (POS "lagao" band).
//   Factory ka STOCK = app ka apna: har item ke waqia (ginti = itna hai · aaya + · diya − · batch: tayyar + / raw −) waqt ke hisaab se.
//   cfg.posOn true = purana tareeqa (POS Adjustment, POS ginti, POS item). ⚙️ mein on / off (sirf malik).
import { stockAgentReady, stockFactoryList, stockFactoryCanRate, stockAgentItemSave, stockPickList, stockRepaint, stockIsFactoryCat, onItemJobs, stockAgentFind, stockNewItemQuick, stockCountsOn, stockCountState, stockCountInfo, stockCountSet, stockCountDel, stockOpenGinti, stockNewItemOpen, stockItemOpen, stockLabelOpen, stockIjobsOpen, stockIjCounts, stockCanItem, scanPick } from './pos-stock.js?v=2.154.0';
import { smartSearch, fold } from './smart-search.js?v=2.154.0';

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
const un = it => (it?.un || 'pcs').toLowerCase();
// v2.101.1: 🔍 SPELLING-MAAFI search (malik: "Slaphate" likha tha, "sulphate" se nahi mila) — Sale / Stock wali smartSearch + 2 harf ki
//   ghalti / ulat-palat (Damerau) 6+ harf ke lafz par. q khali = poori list (⏳ pending pehle).
function dl(a, b) {   // optimal string alignment distance
  const m = a.length, n = b.length; if (Math.abs(m - n) > 2) return 9; const d = [];
  for (let i = 0; i <= m; i++) { d[i] = [i]; for (let j = 1; j <= n; j++) d[i][j] = i ? 0 : j; }
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) { const c = a[i - 1] === b[j - 1] ? 0 : 1; d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1); }
  return d[m][n];
}
function srch(list, q, n = 20) {
  const s = String(q || '').trim(); if (!s) return list.slice(0, n);
  let out = []; try { out = smartSearch(list, s, n); } catch { out = list.filter(x => String(x.name || '').toLowerCase().includes(s.toLowerCase())); }
  if (out.length < n) { const all = fold(s).split(' ').filter(Boolean), toks = all.filter(t => t.length >= 4), nums = all.filter(t => /^\d+$/.test(t)), seen = new Set(out.map(x => x.id)), hit = [];
    if (toks.length) for (const x of list) { if (seen.has(x.id)) continue; const ws = fold(x.name).split(' ').filter(Boolean);
      if (toks.every(t => ws.some(w => dl(w, t) <= (t.length >= 6 ? 2 : 1)))) hit.push([x, nums.length && nums.every(k => ws.includes(k)) ? 0 : 1]); }
    hit.sort((a, b) => a[1] - b[1]); for (const [x] of hit) { out.push(x); if (out.length >= n) break; } }   // v2.108.0: "sruf 1" = Surf 1 kg pehle (number wala lafz bhi mile)
  return out.slice(0, n);
}
const pendFirst = (a, b) => (b.pending ? 1 : 0) - (a.pending ? 1 : 0);
// v2.101.1: ⚖️ 1 pcs = X gram / ml (malik: "kala tail POS mein 200 gm dabba, formula kg mein — barcode ka rate 280 na chhere") — cfg.conv {itemId: g}
//   POS ginti / stock / khareed rate pcs mein hi rehta hai; formula mein kg likhein -> app pcs banata hai. Rate POS mein nahi badalta.
const gOf = id => { const g = Number(cfg?.conv?.[String(id)]); return g > 0 ? g : 0; };
const kgOf = (q, id) => { const g = gOf(id); return g ? r3((Number(q) || 0) * g / 1000) : 0; };
const pcsOfKg = (kg, id) => { const g = gOf(id); return g ? r3((Number(kg) || 0) * 1000 / g) : 0; };
// v2.101.1: ✎ FACTORY KHAREED RATE (malik: "kg rate / carton rate yahan se bhi badle") — cfg.rate {itemId: Rs fi pcs} sirf factory laagat;
//   POS ka khareed rate tab hi badle jab malik "☐ POS mein bhi" tick kare (stockAgentItemSave costP). Sale rate / barcode kabhi nahi.
const fRate = id => { const v = Number(cfg?.rate?.[String(id)]); return v > 0 ? v : 0; };
const rateOf = (id, it) => fRate(id) || Number(it?.prate) || 0;
const rUnit = (id, it) => gOf(id) ? ['kg', 1000 / gOf(id)] : (Number(it?.pack) > 1 ? [String(it?.cn || 'ctn').toLowerCase(), Number(it.pack)] : [un(it), 1]);   // [naam, pcs fi unit]
const r4 = n => Math.round((Number(n) || 0) * 10000) / 10000;
let posRate = false;
const posOn = () => cfg?.posOn !== false;   // v2.103.2: malik — "factory wala kaam POS mein wapis" — default POS (sirf app = ⚙️ mein chunein) · v2.103.0 default app tha
let moves = [], mStop = null, appB = [], aStop = null, fsCache = null, mv = null, locB = [], lStop = null;   // v2.103.7: locB = POS wale batch jin mein 📱 sirf factory item (loc: true)
function watchApp() {
  if (!mStop && cloud?.listenFactoryMoves) mStop = cloud.listenFactoryMoves((l, e) => { if (l) { moves = l; fsCache = null; loadItemsQuiet(); repaint(); if (mv && $('fcMv')) mvPaint(); } else if (e) notice('Factory stock nahi parha: ' + (e.code || e.message || e)); });
  if (!lStop && cloud?.listenFactoryLocBatches) lStop = cloud.listenFactoryLocBatches((l, e) => { if (l) { locB = l; fsCache = null; loadItemsQuiet(); repaint(); } else if (e) console.warn('factory loc batches', e); });
  if (!aStop && cloud?.listenFactoryAppBatches) aStop = cloud.listenFactoryAppBatches((l, e) => { if (l) { appB = l; fsCache = null; loadItemsQuiet(); repaint(); } else if (e) notice('Factory batch nahi parhe: ' + (e.code || e.message || e)); });
}
// har item ke waqia — waqt ki tarteeb: ginti = itna hai (seedha) · aaya + · diya − · batch bana + / laga −
function fEvents() {
  const E = [];
  for (const m of moves) if (m && m.itemId) E.push({ at: Number(m.at) || 0, id: String(m.itemId), t: m.kind, q: Number(m.q) || 0, m });
  for (const b of appB) { if (!b || b.status !== 'app') continue; const at = Number(b.at) || 0;
    if (Number(b.out) > 0) E.push({ at, id: String(b.itemId), t: 'bana', q: Number(b.out), b });
    for (const o of b.outs || []) if (Number(o.q) > 0) E.push({ at, id: String(o.id), t: 'bana', q: Number(o.q), b });
    for (const l of b.lines || []) if (Number(l.q) > 0) E.push({ at, id: String(l.id), t: 'laga', q: -Number(l.q), b }); }
  // v2.103.7: POS mode — batch POS mein jata hai, magar 📱 sirf factory item (khula tail kg) ka hisaab yahin: bana + / laga −
  const seen = new Set(appB.map(b => b?.id));
  for (const b of locB) { if (!b || seen.has(b.id) || b.status === 'app' || ['cancelled', 'cancelReq'].includes(b.status)) continue; const at = Number(b.at) || 0, L = id => String(id).startsWith('loc:');
    if (Number(b.out) > 0 && L(b.itemId)) E.push({ at, id: String(b.itemId), t: 'bana', q: Number(b.out), b });
    for (const o of b.outs || []) if (Number(o.q) > 0 && L(o.id)) E.push({ at, id: String(o.id), t: 'bana', q: Number(o.q), b });
    for (const l of b.lines || []) if (Number(l.q) > 0 && L(l.id)) E.push({ at, id: String(l.id), t: 'laga', q: -Number(l.q), b }); }
  return E.sort((a, b) => a.at - b.at);
}
function fStocks() {
  if (fsCache) return fsCache; const M = new Map();
  for (const e of fEvents()) { const s = M.get(e.id) || { stock: 0, ginti: null, ev: [] };
    if (e.t === 'ginti') { e.sys = r3(s.stock); s.stock = r3(e.q); s.ginti = e; } else s.stock = r3(s.stock + (e.t === 'diya' ? -Math.abs(e.q) : e.t === 'aaya' ? Math.abs(e.q) : e.q));
    s.ev.push({ ...e, after: s.stock }); M.set(e.id, s); }
  return (fsCache = M);
}
const fStock = id => fStocks().get(String(id))?.stock || 0;
// 📱 sirf factory ke item (POS mein nahi) — cfg.local {lid: {n, un, pk, r, at}} -> id 'loc:<lid>'
const locList = () => Object.entries(cfg?.local || {}).filter(([, v]) => v && v.n).map(([lid, v]) => ({ id: 'loc:' + lid, lid, name: String(v.n), code: '', pack: Number(v.pk) > 1 ? Number(v.pk) : 0, cn: 'Ctn', un: v.un || 'Pcs', cat: '📱 sirf factory', stock: 0, prate: Number(v.r) || 0, rate: 0, rate2: 0, wrate: 0, ws: 0, urdu: '', local: true, labels: [] }));
const isLoc = it => !!it?.local || String(it?.id || '').startsWith('loc:');
const hasLoc = d => [d?.itemId, ...(d?.lines || []).map(l => l.id), ...(d?.outs || []).map(o => o.id)].some(id => String(id || '').startsWith('loc:'));
const canMove = () => isOwner() || canOf('fac.ginti') || canOf('stock.count') || canFacBatch();
const qk = (q, it) => { const g = it ? gOf(it.id) : 0; return g ? num(kgOf(q, it.id)) + ' kg (' + qt(q, it) + ')' : qt(q, it); };   // "2.5 kg (12.5 pcs)"
// ginti -> "5 ctn + 3" (POS jaisa)
function qt(q, it) {
  q = r3(q); const pk = Number(it?.pack) || 0, cn = (it?.cn || 'Ctn').toLowerCase(), u = un(it);
  if (pk > 1) { const neg = q < 0, a = Math.abs(q), c = Math.floor(a / pk + 1e-9), p = Math.round((a - c * pk) * 10) / 10, both = c && p; return (neg ? (both ? '−(' : '−') : '') + (c ? num(c) + ' ' + cn : '') + (both ? ' + ' : '') + (p || !c ? num(p) + (c ? '' : ' ' + u) : '') + (neg && both ? ')' : ''); }   // v2.108.0: minus = "−(122 ctn + 8)" (pehle "−122 ctn + 8.03" ulta parhta tha)
  return num(q) + ' ' + u;
}

let cloud = null, notice = () => {}, pdfOf = null, pdfFileOf = null, canOf = () => true, ownerOf = () => false, whoOf = () => '', goPurchase = null, batchOf = null, aiFormula = null, uidOf = () => '';
let cfg = null, cfgStop = null, batches = [], bStop = null, bFrom = 0, items = [], byId = new Map(), itemsOk = false, itemsErr = '';
const LS = 'sam-fac';
const st = (() => { let v = {}; try { v = JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch {} return { per: v.per || 'aaj', tab: v.tab || 'batches', view: v.view === 'old' ? 'old' : 'ek' }; })();   // v2.107.0: view 'ek' = nayi ek-screen · 'old' = purani tabs (⋮ se)
const keep = () => { try { localStorage.setItem(LS, JSON.stringify({ per: st.per, tab: st.tab, view: st.view })); } catch {} };
let fb = null;   // batch form ki haalat
let fe = null;   // formula editor ki haalat
let pk = null;   // ☑ picker
let fn = null;   // ➕ naya formula chooser
let pf = null;   // 📷 photo se formula

export function factorySetup(o) { cloud = o.cloud || cloud; notice = o.notice || notice; pdfOf = o.pdf || pdfOf; pdfFileOf = o.pdfFile || pdfFileOf; canOf = o.can || canOf; ownerOf = o.owner || ownerOf; whoOf = o.who || whoOf; goPurchase = o.purchase || goPurchase; batchOf = o.batch || batchOf; aiFormula = o.aiFormula || aiFormula; uidOf = o.uid || uidOf; }
export function factoryStop() { if ($('fcBatch') || $('fcForm') || $('fcPick') || $('fcPhoto') || $('fcNew') || $('fcPkDef')) return;   // stock screen se khula batch / formula — listener zinda rahe
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
window.ntFacPend = (jid, name, c, pk) => { if (!isOwner() || !cloud?.setFactoryCfg) return; watchCfg();
  const v = { n: String(name || '').slice(0, 80), at: Date.now(), ...(c > 0 ? { c: r2(c) } : {}), ...(pk ? { p: true } : {}) };
  cfg = { ...(cfg || {}), pend: { ...(cfg?.pend || {}), [jid]: v } }; loadItemsQuiet(); repaint();
  cloud.setFactoryCfg({ pend: { [jid]: v } }).catch(e => notice('🏭 factory tick save nahi hua: ' + (e?.message || e))); };
window.ntFacPendHas = jid => !!(cfg?.pend?.[jid]);
window.ntFacPendPack = jid => !!(cfg?.pend?.[jid]?.p);
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
      for (const [fid, f] of Object.entries(F)) { if (!f) continue; const lines = (f.lines || []).map(l => String(l.id) === fake ? { ...l, id: real } : l), sm0 = f.self?.mats || [], sm = sm0.map(m => String(m.id) === fake ? { ...m, id: real } : m), ch = lines.some((l, i) => l !== f.lines[i]) || sm.some((m, i) => m !== sm0[i]);
        const nf = { ...f, lines, ...(f.self ? { self: { ...f.self, mats: sm } } : {}) };
        if (fid === fake) { if (!F[real]) fp[real] = nf; fp[fake] = null; } else if (ch) fp[fid] = nf; }   // v2.102.0: self.mats bhi
      // v2.101: 📦 packing material / packing item (cfg.packs) ki 'job:' id bhi asli se
      const PK = cfg.packs || {}, pp = {}; for (const [pid, d] of Object.entries(PK)) { if (!d) continue; const mats = (d.mats || []).map(m => String(m.id) === fake ? { ...m, id: real } : m), ch = String(d.src) === fake || mats.some((m, i) => m !== d.mats[i]);
        if (pid === fake) { pp[real] = { ...d, src: String(d.src) === fake ? real : d.src, mats }; pp[fake] = null; } else if (ch) pp[pid] = { ...d, src: String(d.src) === fake ? real : d.src, mats }; }
      const patch = { items: { [real]: true }, pend: { [j.id]: null }, ...(Object.keys(fp).length ? { formulas: fp } : {}), ...(p.p ? { pack: { [real]: true } } : {}), ...(Object.keys(pp).length ? { packs: pp } : {}) };
      cfg = { ...cfg, items: { ...(cfg.items || {}), [real]: true }, pend: { ...(cfg.pend || {}), [j.id]: null }, formulas: { ...F, ...fp }, ...(p.p ? { pack: { ...(cfg.pack || {}), [real]: true } } : {}), packs: { ...PK, ...pp } };
      cloud.setFactoryCfg(patch).then(() => { notice('🏭 ' + p.n + ' POS mein ban gaya — factory mein asli item se jur gaya'); loadItemsQuiet(); repaint(); }).catch(() => linking.delete(j.id)); }
    else if (j.status === 'failed') { linking.add(j.id); cloud.setFactoryCfg({ pend: { [j.id]: null } }).catch(() => linking.delete(j.id)); }
  }
}
function watch() {
  watchCfg(); watchApp();
  const d = new Date(); d.setHours(0, 0, 0, 0); const wk = new Date(d); wk.setDate(wk.getDate() - 6); const mo = new Date(d.getFullYear(), d.getMonth(), 1);
  const from = Math.min(wk.getTime(), mo.getTime());
  if (bStop && bFrom === from) return;
  if (bStop) { try { bStop(); } catch {} } bFrom = from;
  bStop = cloud?.listenFactoryBatches ? cloud.listenFactoryBatches(from, (l, e) => { if (l) batches = l; else if (e) notice('Factory batch nahi parhe: ' + (e.code || e.message || e)); repaint(); }) : null;
}
function loadItems() {
  try { const real = stockFactoryList(facPick); let L = [...real, ...pendItems(real), ...locList()];
    if (!posOn()) { const M = fStocks(); L = L.map(x => ({ ...x, posStock: x.stock, stock: M.get(String(x.id))?.stock || 0 })); }   // v2.103.0: factory ka apna stock
    else { const M = fStocks(); L = L.map(x => isLoc(x) ? { ...x, stock: M.get(String(x.id))?.stock || 0 } : x); }   // v2.103.7: POS mode mein bhi 📱 sirf factory item ka apna stock
    items = L; byId = new Map(items.map(x => [x.id, x])); itemsOk = true; } catch (e) { itemsErr = e?.message || String(e); }
}
async function ensureItems() {
  if (itemsOk) { loadItems(); return true; }
  try { await stockAgentReady(); loadItems(); return true; } catch (e) { itemsErr = e?.message || String(e); repaint(); return false; }
}
// v2.102.0: purani "har pcs" (pp) lines = bharne ka maal (self.mats) — ek hi tareeqa
const normF = f => { const pp = (f.lines || []).filter(l => Number(l.pp) > 0); if (!pp.length) return f; const mats = [...(f.self?.mats || [])];
  for (const l of pp) if (!mats.some(m => String(m.id) === String(l.id))) mats.push({ id: String(l.id), q: Number(l.pp), n: l.n || '' });
  return { ...f, lines: (f.lines || []).filter(l => !(Number(l.pp) > 0)), self: { ...(f.self || {}), mats } }; };
const forms = () => Object.fromEntries(Object.entries(cfg?.formulas || {}).filter(([, v]) => v && v.per > 0).map(([k, v]) => [k, normF(Number(v.ml) > 0 && Number(v.ml) < 50 ? { ...v, ml: fixMl(v.ml) } : v)]));
// v2.102.0: 🧴 NUSKHA + KIS MEIN BHARA (malik: "batch quantity khud jama ho · batch banate waqt pooche bottle hai ya packet")
//   formula.ml = 1 pcs mein kitna (ml / g) -> raw maal (liter / kg) ka JAMA ÷ ml = 1 batch ke pcs (auto). formula.self.mats = is item ke
//   har pcs ke saath packing maal (bottle 1 + dhakan 1). Doosri packing = cfg.packs {pid: {src: formula item, g: ml, mats}} (packet 500 ml).
//   Batch: "Kis mein bhara?" — yahi item (bottle) + har packing ke pcs; bacha khula liquid sirf dikhta hai (POS mein nahi).
const mlFromName = n => { const t = String(n || ''); let m = t.match(/(\d+(?:\.\d+)?)\s*(?:ml|g|gm|gms|gram|grams)\b/i); if (m) return r3(Number(m[1]));
  m = t.match(/(\d+(?:\.\d+)?)\s*\/?\s*(?:l|ltr|ltrs|liter|litre|liters|lit|kg|kgs)\b/i); return m ? r3(Number(m[1]) * 1000) : 0; };
// v2.102.1: malik — "coco batain 1 kg, pani 165 kg khud jama ho; sirf kala tail 200 g ka piece" -> pcs wala raw = naam ka wazan ya 1 pcs = 1 kg
const pcsG = (id, name) => { const g = gOf(id); if (g) return g; const it = byId.get(String(id)), n = mlFromName(name || it?.name), pk = Number(it?.pack) || 0;
  return n ? (pk > 1 && Math.abs(n / 1000 - pk) < 0.001 ? 1000 : n) : 1000; };   // v2.102.2: naam "50 kg" + ctn = 50 pcs = poori bori (1 pcs = 1 kg); "Surf 1kg" (ctn 20) = piece 1 kg
const lineVolHow = id => { const it = byId.get(String(id)), u = un(it); if (gOf(id)) return 'g'; if (/^(kg|kgs|l|ltr|ltrs|liter|litre|lit|liters)$/.test(u)) return 'kg'; if (/^(ml|g|gm|gms|gram)$/.test(u)) return 'ml'; return mlFromName(it?.name) ? 'name' : 'khud'; };
const lineVol = (id, q, name) => { const it = byId.get(String(id)), u = un(it), g = gOf(id); if (g) return r3((Number(q) || 0) * g / 1000);   // liter / kg
  if (/^(kg|kgs|l|ltr|ltrs|liter|litre|lit|liters)$/.test(u)) return Number(q) || 0; if (/^(ml|g|gm|gms|gram)$/.test(u)) return r3((Number(q) || 0) / 1000);
  return r3((Number(q) || 0) * pcsG(id, name || it?.name) / 1000); };
const volOf = lines => { let v = 0; const miss = []; for (const l of lines || []) { const x = lineVol(l.id, l.q, l.n); if (x == null) miss.push(l); else v += x; } return { v: r3(v), miss }; };
const fixMl = m => { m = Number(m) || 0; return m > 0 && m < 50 ? r3(m * 1000) : m; };   // v2.102.1: 1.5 likha = 1.5 liter (ml nahi)
const selfMats = f => (Array.isArray(f?.self?.mats) ? f.self.mats : []).filter(m => m && m.id && Number(m.q) > 0);
const selfMatCost = f => selfMats(f).reduce((t, m) => t + Number(m.q) * rateOf(m.id, byId.get(String(m.id))), 0);
const srcMl = id => Number(forms()[String(id)]?.ml) || 0;
const volU = it => /\d\s*(kg|kgs|g|gm|gms|gram|grams)\b|\b(kg|kgs|gm|gms|gram|grams)\b/i.test(String(it?.name || '')) && !/\b(l|ltr|liter|litre|ml)\b|\d\s*l\b/i.test(String(it?.name || '')) ? 'kg' : 'L';   // surf = kg · liquid = L (v2.102.2: 'surf soda kg' bhi kg)
const finished = () => { const F = forms(); return items.filter(x => F[x.id]); };
const rawItems = () => { const F = forms(); return items.filter(x => !F[x.id]); };
const rawUsed = () => { const s = new Set(); for (const f of Object.values(forms())) for (const l of f.lines || []) s.add(String(l.id)); return s; };
const wm = () => Number(cfg?.wm ?? 10), rm = () => Number(cfg?.rm ?? 15);
const prnN = () => { const v = cfg?.prn; return v === 0 || v === 1 ? v : 2; };
// laagat: n batch ka raw + mazdoori / gas (bug 5: naam line mein mehfooz — item factory se hat jaye to bhi dikhe)
function costOf(f, n = 1) {
  const lines = (f?.lines || []).map(l => { const it = byId.get(String(l.id)); const q = r3((Number(l.q) || 0) * n), c = rateOf(l.id, it); return { own: !!fRate(l.id), id: String(l.id), name: it?.name || l.n || 'Item ' + l.id, it, q, c, rs: q * c, stock: Number(it?.stock) || 0, gone: !it }; });
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
// v2.101: rates — tayyar (formula) + packing items (packCpp) · 'raw' scope = raw / packing material (khareed + nafa) · rEd = malik ke haath ke rate
let rScope = 'tayyar'; const rEd = {};
const rateRows = (scope = 'tayyar') => { const F = forms();
  if (scope === 'raw') return items.filter(it => !isPend(it) && !F[it.id] && !packOf(it.id) && !cfg?.mcost?.[it.id]).map(it => { const cpp = rateOf(it.id, it); return { it, c: { cpp }, sg: suggest(it, cpp), cr: curRates(it), raw: true }; });
  return [...finished().filter(it => !isPend(it)).map(it => { const c0 = costOf(F[it.id]), c = { ...c0, cpp: c0.cpp + selfMatCost(F[it.id]) }; return { it, c, sg: suggest(it, c.cpp), cr: curRates(it) }; }),
    ...packDefs().map(p => byId.get(p.id)).filter(it => it && !isPend(it) && !F[it.id]).map(it => { const cpp = packCpp(packOf(it.id)); return { it, c: { cpp }, sg: suggest(it, cpp), cr: curRates(it), pk: true }; }),
    ...mcList().filter(([id]) => byId.has(id) && !F[id] && !packOf(id)).map(([id, v]) => { const it = byId.get(id), cpp = mcCpp(v); return { it, c: { cpp }, sg: suggest(it, cpp), cr: curRates(it), mc: v }; })]; };
// v2.103.8: 🧴 WAZAN SE LAAGAT (malik: "item uthaya, app pooche kitna wazan pack karwana — kala tail 200 g; fi kg rate × 200 g, phir harcha,
//   complete") — formula nahi. cfg.mcost {itemId: {g, kg, mats: [{id, q, n}], x: [{n, rs}]}} -> laagat fi pcs = kg × g / 1000 + packing maal + harcha.
const mcList = () => Object.entries(cfg?.mcost || {}).filter(([, v]) => v && Number(v.g) > 0);
const mcOil = v => r2((Number(v?.kg) || 0) * (Number(v?.g) || 0) / 1000);
const mcMat = v => (v?.mats || []).reduce((t, m) => t + (Number(m.q) || 0) * rateOf(String(m.id), byId.get(String(m.id))), 0);
const mcX = v => (v?.x || []).reduce((t, x) => t + (Number(x.rs) || 0), 0);
const mcCpp = v => r2(mcOil(v) + mcMat(v) + mcX(v));
const gTxt = g => g >= 1000 ? num(r3(g / 1000)) + ' kg' : num(g) + ' g';
const rateWant = x => ({ ...x.sg, ...(rEd[x.it.id] || {}) });
// ---------- v2.101.1: 📦 PACKING (malik: "surf ka batch — ek packing 4 kg, ek 0.700 g — kaise maintain") ----------
//   cfg.pack {itemId: true} = packing material (bag / pouch / dakan — ☑ picker ya naya item form) · cfg.packs {packItemId: {src: bulk itemId,
//   g: gram fi pcs, mats: [{id, q, n}]}} = packing item (Surf 4 kg = 4000 g Surf bulk + 1 bag). Batch: bulk bana -> larka pcs likhe ->
//   bulk mein se kg minus, packing material minus, packs plus, baqi bulk plus. 'pack' batch = purane bulk stock se packing.
const r6 = n => Math.round((Number(n) || 0) * 1e6) / 1e6;
const isMat = id => !!cfg?.pack?.[String(id)] || (String(id).startsWith('job:') && !!cfg?.pend?.[String(id).slice(4)]?.p);
const packDefs = () => Object.entries(cfg?.packs || {}).filter(([, v]) => v && v.src && Number(v.g) > 0).map(([id, v]) => ({ id, ...v, g: Number(v.g), mats: Array.isArray(v.mats) ? v.mats : [] }));
const packOf = id => packDefs().find(p => p.id === String(id)) || null;
const packsOf = src => packDefs().filter(p => String(p.src) === String(src) && byId.has(p.id));
const packSrcs = () => [...new Set(packDefs().filter(p => byId.has(p.id) && byId.has(String(p.src)) && !srcMl(p.src)).map(p => String(p.src)))];
const packUnit = p => r6(p.g / (srcMl(p.src) || gOf(p.src) || 1000));   // v2.102.0: nuskha (ml) wala src = 1 pcs = ml   // 1 pack pcs mein bulk ki kitni unit (bulk kg mein = g / 1000)
const bulkCpp = src => { const f = forms()[String(src)]; return f ? costOf(f).cpp : rateOf(src, byId.get(String(src))); };
const matCost = p => p.mats.reduce((t, m) => t + (Number(m.q) || 0) * rateOf(m.id, byId.get(String(m.id))), 0);
const packCpp = p => packUnit(p) * bulkCpp(p.src) + matCost(p);
function packCalc(src, pk) {   // pk {packId: pcs} -> bulk kitna laga, material kitna, laagat
  const rows = [], mats = new Map(); let used = 0, mc = 0;
  for (const p of packsOf(src)) { const n = Math.max(0, Math.floor(Number(pk?.[p.id]) || 0)); if (!n) continue; const b = r3(n * packUnit(p)); used += b;
    for (const m of p.mats) { const q = r3((Number(m.q) || 0) * n); if (!q) continue; mats.set(String(m.id), r3((mats.get(String(m.id)) || 0) + q)); mc += q * rateOf(m.id, byId.get(String(m.id))); }
    rows.push({ p, it: byId.get(p.id), n, bulk: b, c: r2(packCpp(p)) }); }
  return { rows, used: r3(used), mats, matCost: mc };
}
const rateDiff = x => ['wctn', 'wpcs', 'rctn', 'rpcs'].some(k => (x.it.pack > 1 || k.endsWith('pcs')) && Math.abs((rateWant(x)[k] || 0) - (x.cr[k] || 0)) >= 1);

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
  app: ['ok', '✅ Factory mein'], hold: ['hold', '📝 App mein — POS baqi'], new: ['wait', '⏳ PC ko ja raha'], posted: ['ok', '✓ POS mein'], error: ['bad', '❌ Masla'], cancelReq: ['wait', '↩ Wapas ho raha'], cancelled: ['off', '✕ Cancel'],
};
const statOf = b => b._pend ? ['wait', '⏳ Bhej raha…'] : b.status === 'new' && b.waitItem ? ['wait', '⏳ Item POS mein banne ka intezar'] : (STAT[b.status] || ['wait', b.status]);

// search likhte waqt input dobara na bane (mobile keyboard) — poora html bana kar sirf diye gaye #id dabbon ka andar badlo.
function swapParts(root, html, ids) { const t = document.createElement('div'); t.innerHTML = html; for (const id of ids) { const a = t.querySelector('#' + id), b = root.querySelector('#' + id); if (a && b) b.innerHTML = a.innerHTML; } }
// ---------- screen ----------
const TABS = [['batches', '📋', 'Batches', false], ['stock', '📦', 'Stock', false], ['formulas', '🧪', 'Formulas', true], ['rates', '🏷', 'Rates', true]];
const tabsOf = () => TABS.filter(t => t[3] === false || isOwner() || (t[3] !== true && canOf(t[3])));
export function renderFactory() {
  watch(); phWatch();   // v2.108.0: 📷 tasveer ka index
  $('summary').innerHTML = '<div class="bc-root ir-root fc-root" id="fcRoot"></div>';
  if ($('list')) $('list').innerHTML = '';
  $('actions').innerHTML = '<button class="got" data-fc-pdf="1">📄 Production PDF · WhatsApp</button>';
  paint();
  ensureItems().then(ok => { if (ok) paint(); });
}
let rpT = 0;
function repaint() { clearTimeout(rpT); rpT = setTimeout(() => { const ad = document.activeElement?.dataset || {};   // likhte waqt input na toote
  if ($('fcRoot')) { loadItemsQuiet(); paint(ad.fcRq != null || ad.fgCtn != null || ad.fgPcs != null || ad.fgKg != null ? ['fcRqList'] : ad.fr != null ? ['fcRates'] : undefined); }
  if (fb && $('fcBatch') && ad.fbReal == null && ad.fbPk == null && ad.fbSelf == null) batchPaint(); if (fe && $('fcForm')) formPaint(ad.fcFq2 != null ? ['feHits'] : undefined); if (pk && $('fcPick')) pickPaint(ad.fcPq != null ? ['fcPickList'] : undefined);
  if (fn && $('fcNew')) fnewPaint(ad.fcFq != null ? ['fcFqList'] : undefined); if (pf && $('fcPhoto') && ad.pfPq == null && ad.pfSq == null && ad.pfPieces == null && ad.pfQ == null) pfPaint(); }, 30); }
const loadItemsQuiet = () => { if (itemsOk) loadItems(); };
function paint(only) {
  const root = $('fcRoot'); if (!root) return;
  if (ekView()) { ekRender(root); return; }   // v2.107.0: 🏭 nayi ek-screen (purani tabs ⋮ se)
  const B = batches.filter(inPer), live = B.filter(b => b.status !== 'cancelled' && b.status !== 'cancelReq');
  const tot = live.reduce((s, b) => s + (Number(b.cost) || 0), 0), nb = live.reduce((s, b) => s + (Number(b.n) || 0), 0);
  const F = forms(), own = isOwner();
  if (st.tab === 'raw' || st.tab === 'ginti') st.tab = 'stock';
  if (!tabsOf().some(t => t[0] === st.tab)) st.tab = 'batches';
  const up = itemsOk && own ? rateRows().filter(x => { const old = Number(F[x.it.id]?.cpp) || 0; return old > 0 && x.c.cpp >= old * 1.03; }) : [];
  const todo = itemsOk && own ? rateRows().filter(rateDiff).length : 0;
  const errs = batches.filter(b => b.status === 'error'), dups = itemsOk ? items.filter(x => x.dup) : [], kam = itemsOk ? rawKam().length : 0;
  const kp = (b, s) => `<div><b>${b}</b><small>${s}</small></div>`;
  const holdN = batches.filter(b => b.status === 'hold').length;
  const badge = { batches: errs.length ? '❌' + errs.length : holdN ? '📝' + holdN : '', formulas: Object.keys(F).length ? num(Object.keys(F).length) : '', rates: todo ? '⚠' + todo : '', stock: kam ? '⚠' + kam : '' };
  const html = `${ekOn() ? '<button type="button" class="ek-back" data-ek-back="1">‹ 🏭 Nayi factory screen</button>' : ''}
  <div class="ir-hero fc-hero"><div class="fc-hrow"><div><small>NOOR TRADERS · APNI FACTORY</small><strong>🏭 Factory</strong></div>${own ? '<button type="button" class="fc-gear" data-fc-set="1" aria-label="Settings">⚙️</button>' : ''}</div>
    <div class="fc-per">${PER.map(([k, l]) => `<button type="button" class="${st.per === k ? 'on' : ''}" data-fc-per="${k}">${l}</button>`).join('')}</div>
    <div class="ir-kp">${kp(num(live.length), 'batch slip')}${kp(num(nb), 'batch (1–10)')}${kp(rs(tot), 'laagat')}</div></div>
  <div class="fc-tabs">${tabsOf().map(([k, ic, l]) => `<button type="button" class="${st.tab === k ? 'on' : ''}" data-fc-tab="${k}"><span>${ic}</span>${l}${badge[k] ? `<i>${badge[k]}</i>` : ''}</button>`).join('')}</div>
  ${itemsErr && !itemsOk ? `<p class="ir-say">⏳ Stock load nahi hua: ${esc(itemsErr)}</p>` : ''}
  ${errs.length ? `<button type="button" class="fc-alert bad" data-fc-b="${esc(errs[0].id)}"><span>❌</span><div><b>${num(errs.length)} batch POS mein nahi gaye</b> — tap karein, wajah dekhein</div><em>›</em></button>` : ''}
  ${own && dups.length ? dups.map(x => `<div class="fc-alert"><span>⚠️</span><div><b>${esc(x.name)}</b> ⏳ PC baqi hai magar ye naam POS mein pehle se hai — PC dobara item banayega. Agar wahi item hai to pending hatayein aur POS wali ko ☑ karein.</div><button type="button" data-fc-penddel="${esc(x.jid)}">✕ Hatao</button></div>`).join('') : ''}
  ${up.length && own && st.tab !== 'rates' ? `<div class="fc-alert"><span>⚠️</span><div><b>${up.map(x => esc(x.it.name)).slice(0, 3).join(', ')}</b> ki laagat barh gayi (+${Math.round((up[0].c.cpp / (Number(F[up[0].it.id].cpp) || 1) - 1) * 100)}%) — rate dekh lein.</div><button type="button" data-fc-tab="rates">Dekhein</button></div>` : ''}
  ${itemsOk && !items.length && own ? `<p class="ir-say">Abhi factory mein koi item nahi — ⚙️ mein <b>☑ Factory items chunein</b> (ya POS mein category "factory").</p>` : ''}
  ${st.tab === 'formulas' && own ? formulasHTML() : st.tab === 'rates' && own ? ratesHTML(up) : st.tab === 'stock' ? stockTabHTML() : batchesHTML(B)}`;
  if (only) { swapParts(root, html, only); return; }
  root.innerHTML = html;
}
function batchesHTML(B) {
  return `${canFacBatch() ? `<div class="fc-two fc-bnew"><button type="button" class="fc-big" data-fc-batch="1"><span class="fc-ic">➕</span><b>Naya batch</b><small>item · kitne batch${packSrcs().length ? ' · packing' : ''} · OK</small></button>${packSrcs().length ? `<button type="button" class="fc-big alt" data-fb-mode="pack"><span class="fc-ic">🎁</span><b>Bulk se packing</b><small>purane bulk stock se 4 kg / 700 g</small></button>` : ''}</div>` : ''}
  ${pendList().length && isOwner() ? `<div class="fc-pend">${pendList().map(p => `<span>⏳ ${esc(p.n)} <small>POS mein PC on hote hi banega — formula / batch abhi ban sakta hai</small></span>`).join('')}</div>` : ''}
  <section class="ir-sec"><div class="ir-sh"><b>${PER.find(p => p[0] === st.per)?.[1] || ''} ke batch</b><small>${num(B.length)}</small></div>
    <div class="fc-list">${B.map(batchCard).join('') || `<div class="nt-empty">🏭<b>Is waqt mein koi batch nahi</b>${canFacBatch() ? '<small>Upar "➕ Naya batch" dabayein</small>' : ''}</div>`}</div></section>`;
}
function batchCard(b) {
  const [c, t] = statOf(b), it = byId.get(String(b.itemId));
  const os = (b.outs || []).map(o => num(o.q) + ' × ' + o.name).join(' · ');
  return `<button type="button" class="fc-bt${b.status === 'hold' ? ' hold' : ''}" data-fc-b="${esc(b.id)}"><span class="fc-dot ${c}"></span><span class="fc-bn"><b>${esc(b.name)}</b><small>${esc(b.no)}${b.kind === 'pack' ? '' : ' · ' + num(b.n) + ' batch'}${b.out > 0 ? ' · ' + esc(qt(b.out, it)) : ''}${os ? ' · ' + esc(os) : ''} · ${esc(b.byName || '')} · ${esc(clock(b.at))}</small></span><span class="fc-st ${c}">${esc(t)}</span></button>`;
}

// ---------- 🧪 formulas (malik) ----------
function formulasHTML() {
  const F = forms(), fin = finished();
  return `<div class="fc-two fc-fnew"><button type="button" class="fc-big" data-fc-fnew="1"><span class="fc-ic">➕</span><b>Naya formula</b><small>item chun kar raw maal likhein</small></button>
    ${aiFormula ? `<button type="button" class="fc-big alt" data-fc-photo="1"><span class="fc-ic">📷</span><b>Photo se formula</b><small>Excel / parchi ki tasveer — AI parhe</small></button>` : ''}</div>
    <section class="ir-sec"><div class="ir-sh"><b>🧪 Formulas</b><small>${num(fin.length)}</small></div>
    <div class="ir-tbl">${fin.map(it => { const c = costOf(F[it.id]); return `<button type="button" class="ir-row" data-fc-f="${esc(it.id)}"><span><b>${esc(it.name)}${isPend(it) ? ' <i class="fc-pend-i">⏳</i>' : ''}</b><small>1 batch = ${esc(qt(F[it.id].per, it))} · ${num(F[it.id].lines?.length || 0)} raw${c.noRate ? ' · ⚠️ ' + c.noRate + ' ka rate nahi' : ''}${c.gone ? ' · ⚠️ ' + c.gone + ' item factory mein nahi' : ''}</small></span><span class="ir-num"><b>${rs(c.cpp)} / ${esc(un(it))}</b><small>${it.pack > 1 ? rs(c.cpp * it.pack) + ' / ctn' : ''}</small></span></button>`; }).join('') || '<p class="lk-note">Abhi koi formula nahi — upar ➕ ya 📷 se banayein.</p>'}</div></section>
    <section class="ir-sec"><div class="ir-sh"><b>🎁 Packing items</b><small>${num(packDefs().length)}</small></div>
    <p class="lk-note">Bulk (jaise Surf kg) se packing — 4 kg, 700 g. <b>Ek dafa</b> set karein: kitne gram + kaun sa packing maal. Batch mein larka sirf pcs likhe.</p>
    <div class="ir-tbl">${packDefs().map(p => { const it = byId.get(p.id), sr = byId.get(String(p.src)); return `<button type="button" class="ir-row" data-fc-pkdef="${esc(p.id)}"><span><b>${esc(it?.name || 'Item ' + p.id)}${it ? '' : ' ⚠️'}</b><small>${num(p.g)} g ${esc(sr?.name || '?')}${p.mats.length ? ' + ' + p.mats.map(m => num(m.q) + ' ' + esc(byId.get(String(m.id))?.name || m.n || '')).join(', ') : ' · packing maal nahi'}</small></span><span class="ir-num"><b>${it && sr ? rs(packCpp(p)) : '—'}</b><small>laagat / pcs</small></span></button>`; }).join('')}</div>
    <button type="button" class="fc-go sm" data-fc-pkdef="">➕ Packing item set karein</button></section>`;
}
// ---------- 🧴 v2.103.8: wazan se laagat — ek hi khirki (① item ② wazan ③ fi kg ④ harcha ⑤ laagat) ----------
let mc = null;
const MC_G = [100, 200, 250, 500, 1000], MC_X = ['🧴 Bottle', '🔩 Dhakkan', '🏷 Label', '👷 Mazdoori', '➕ Aur'];
function mcOpen(id) {
  if (!isOwner()) return; const v = id ? cfg?.mcost?.[id] : null;
  mc = { id: id || '', q: '', g: v?.g || '', kg: v?.kg ?? '', mats: Object.fromEntries((v?.mats || []).map(m => [String(m.id), Number(m.q) || 1])), x: (v?.x || []).map(x => ({ n: x.n, rs: x.rs })), old: !!v };
  if (id && !v) mcPick(id);
  dlg('🧴 Packing item — wazan se laagat', '<div id="fcMc"></div>'); mcPaint();
}
function mcPick(id) {   // item chuna — wazan / fi kg pehle se bharo
  const it = byId.get(String(id)); mc.id = String(id); mc.q = '';
  if (!(Number(mc.g) > 0)) mc.g = gOf(id) || mlFromName(it?.name) || '';
  if (mc.kg === '' || mc.kg == null) { const r = rateOf(id, it), g0 = gOf(id) || mlFromName(it?.name) || 1000; mc.kg = r ? r2(r * 1000 / g0) : ''; mc.kgAuto = !!r; }   // POS khareed fi pcs -> fi kg (item ke apne 1 pcs = g se)
}
const mcTmp = () => ({ g: Number(mc.g) || 0, kg: Number(mc.kg) || 0, mats: Object.entries(mc.mats).filter(([, q]) => Number(q) > 0).map(([id, q]) => ({ id, q: Number(q) })), x: mc.x.filter(x => Number(x.rs) > 0) });
function mcPaint(only) {
  const el = $('fcMc'); if (!el || !mc) return; const F = forms(), it = byId.get(mc.id);
  const pool = items.filter(x => !isPend(x) && !F[x.id] && !packOf(x.id) && !isMat(x.id) && !isLoc(x)), used = new Set(mcList().map(([id]) => id));
  const hits = (mc.q.trim() ? srch(pool, mc.q, 60) : pool.slice().sort((a, b) => (used.has(a.id) ? 1 : 0) - (used.has(b.id) ? 1 : 0) || a.name.localeCompare(b.name)).slice(0, 80));
  const mats = items.filter(x => (isMat(x.id) || looksPack(x.id, x.name)) && x.id !== mc.id), T = mcTmp(), oil = mcOil(T), mt = mcMat(T), xx = mcX(T), cpp = mcCpp(T), sg = it ? suggest(it, cpp) : null;
  const html = !mc.id ? `<div class="fc-lab">① KAUN SA ITEM? <small>jo bikta hai — jaise "kala tail"</small></div>
      <label class="hs-search"><input type="search" data-mc-q="1" placeholder="🔍 item ka naam / barcode…" value="${esc(mc.q)}" autocomplete="off"></label>
      <div class="ir-tbl" id="fcMcHits">${hits.map(x => `<button type="button" class="ir-row" data-mc-it="${esc(x.id)}"><span><b>${esc(x.name)}</b><small>${used.has(x.id) ? '✓ pehle se set · ' : ''}${gOf(x.id) ? '1 pcs = ' + gTxt(gOf(x.id)) + ' · ' : ''}khareed ${rs(rateOf(x.id, x))}</small></span><span class="ir-num"><b>${used.has(x.id) ? '✏️' : '➕'}</b></span></button>`).join('') || '<p class="lk-note">Nahi mila — Stock tab se ➕ Item jorein.</p>'}</div>`
    : `<div class="fc-bhead"><b>${esc(it?.name || mc.id)}</b><small>${esc(it?.code || '')} · POS khareed ${rs(rateOf(mc.id, it))} / ${esc(un(it))}${mc.old ? '' : ` · <button type="button" class="fc-link" data-mc-it="">badlein</button>`}</small></div>
      <div class="fc-lab">② KITNE WAZAN KI PACKING? <small>1 ${esc(un(it))} mein</small></div>
      <div class="fc-mcg">${MC_G.map(g => `<button type="button" class="${Number(mc.g) === g ? 'is-in' : ''}" data-mc-g="${g}">${gTxt(g)}</button>`).join('')}<label><input type="number" inputmode="decimal" min="1" step="any" data-mc-gin="1" value="${MC_G.includes(Number(mc.g)) ? '' : esc(String(mc.g || ''))}" placeholder="apna"><em>g</em></label></div>
      <div class="fc-lab">③ FI KG RATE <small>khula maal ka</small></div>
      <div class="fc-batchrow"><span>1 kg =</span><input type="number" inputmode="decimal" min="0" step="any" data-mc-kg="1" value="${esc(String(mc.kg ?? ''))}" placeholder="Rs"><span>Rs</span></div>
      ${mc.kgAuto ? `<p class="lk-note">POS khareed ${rs(rateOf(mc.id, it))} fi ${esc(un(it))}${gOf(mc.id) ? ' (' + gTxt(gOf(mc.id)) + ')' : ''} se nikala — khule maal ka fi kg rate alag ho to yahan badlein.</p>` : ''}
      ${T.g && T.kg ? `<div class="fc-mcoil">${gTxt(T.g)} = <b>${rs(oil)}</b> <small>(${rs(T.kg)} × ${num(r3(T.g / 1000))} kg)</small></div>` : ''}
      <div class="fc-lab">④ HARCHA FI PCS <small>bottle, dhakkan, mazdoori…</small></div>
      ${mats.length ? `<div class="fc-picks">${mats.map(x => { const on = mc.mats[x.id] != null; return `<div class="fc-pk${on ? ' pk-on' : ''}"><label class="fc-pkl"><input type="checkbox" data-mc-mat="${esc(x.id)}"${on ? ' checked' : ''}><span><b>${esc(x.name)}</b><small>${rs(rateOf(x.id, x))} / ${esc(un(x))}</small></span></label>${on ? `<input type="number" inputmode="decimal" min="0" step="any" class="fc-pkq" data-mc-mq="${esc(x.id)}" value="${mc.mats[x.id]}">` : ''}</div>`; }).join('')}</div>` : ''}
      <div id="fcMcX">${mc.x.map((x, i) => `<div class="fc-mcx"><input type="text" maxlength="40" data-mc-xn="${i}" value="${esc(x.n)}" placeholder="kya"><label><em>Rs</em><input type="number" inputmode="decimal" min="0" step="any" data-mc-xr="${i}" value="${esc(String(x.rs ?? ''))}" placeholder="0"></label><button type="button" class="ir-cx" data-mc-xdel="${i}">✕</button></div>`).join('')}</div>
      <div class="fc-mchips">${MC_X.map(n => `<button type="button" data-mc-xadd="${esc(n.replace(/^\S+\s/, '').replace('Aur', ''))}">${n}</button>`).join('')}</div>
      <section class="ir-sec fc-sum" id="fcMcSum"><div class="fc-sumrow"><span>Maal ${gTxt(T.g)}</span><b>${rs(oil)}</b></div>${mt ? `<div class="fc-sumrow"><span>Packing maal</span><b>${rs(mt)}</b></div>` : ''}${xx ? `<div class="fc-sumrow"><span>Harcha</span><b>${rs(xx)}</b></div>` : ''}<div class="fc-sumrow fc-mctot"><span>Laagat fi ${esc(un(it))}</span><b>${rs(cpp)}</b></div>${sg && cpp ? `<div class="fc-sumrow"><span>Raye: W ${wm()}% · R ${rm()}%</span><b>W ${num(sg.wpcs)} · R ${num(sg.rpcs)}</b></div>` : ''}</section>
      <div class="fc-btns">${mc.old ? '<button type="button" class="fc-no" data-mc-del="1">🗑 Hatao</button>' : ''}<button type="button" class="fc-go" data-mc-save="1">✓ Save — Rates mein</button></div>`;
  if (only) { swapParts(el, html, only); return; }
  el.innerHTML = html;
}
function mcSum() { const el = $('fcMc'); if (!el || !mc?.id) return; mcPaint(['fcMcSum']); }   // likhte waqt sirf jama (keyboard na toote)
async function mcSave(del) {
  if (!mc?.id || !cloud?.setFactoryCfg) return; const T = mcTmp();
  if (del) { if (!confirm('Is item ki wazan wali laagat hatani hai?')) return; }
  else { if (!(T.g > 0)) { notice('Kitne gram — chunein'); return; } if (!(T.kg > 0)) { notice('Fi kg rate likhein'); return; } }
  const v = del ? null : { g: r3(T.g), kg: r2(T.kg), mats: T.mats.map(m => ({ id: m.id, q: r3(m.q), n: String(byId.get(m.id)?.name || '').slice(0, 80) })), x: T.x.map(x => ({ n: String(x.n || 'Harcha').slice(0, 40), rs: r2(x.rs) })), at: Date.now() };
  const patch = { mcost: { [mc.id]: v } }; if (!del && gOf(mc.id) !== r3(T.g)) patch.conv = { [mc.id]: r3(T.g) };   // 1 pcs = g (ginti / formula kg mein bhi)
  cfg = { ...(cfg || {}), mcost: { ...(cfg?.mcost || {}), [mc.id]: v }, ...(patch.conv ? { conv: { ...(cfg?.conv || {}), ...patch.conv } } : {}) };
  const nm = byId.get(mc.id)?.name || '';
  try { await cloud.setFactoryCfg(patch); notice(del ? 'Hata diya' : `✓ ${nm} — laagat ${rs(mcCpp(v))} fi pcs · Rates mein`); mc = null; $('dialog')?.close(); st.tab = 'rates'; rScope = 'tayyar'; keep(); repaint(); }
  catch (e) { notice('Save nahi hua: ' + (e?.message || e)); }
}
// ---------- 🎁 packing item ki setting (ek dafa) ----------
let pd = null;
function pkDefOpen(id) {
  if (!isOwner()) return; const d0 = id ? packOf(id) : null;
  pd = { id: id || '', src: d0?.src ? String(d0.src) : (finished()[0]?.id || ''), g: d0?.g || '', mats: Object.fromEntries((d0?.mats || []).map(m => [String(m.id), Number(m.q) || 1])), q: '' };
  dlg(id ? '🎁 ' + (byId.get(id)?.name || 'Packing item') : '🎁 Naya packing item', '<div id="fcPkDef"></div>'); pkDefPaint();
}
function pkDefPaint(only) {
  const el = $('fcPkDef'); if (!el || !pd) return; const F = forms();
  const it = byId.get(pd.id), mats = items.filter(x => isMat(x.id) && x.id !== pd.id), fin = finished();
  const hits = !pd.id ? srch(items.filter(x => !F[x.id] && !isMat(x.id) && !packOf(x.id)).sort(pendFirst), pd.q, 12) : [];
  const tmp = pd.src && Number(pd.g) > 0 ? { id: pd.id, src: pd.src, g: Number(pd.g), mats: Object.entries(pd.mats).map(([id, q]) => ({ id, q })) } : null;
  const html = `${!pd.id ? `<div class="fc-lab">① KAUN SA ITEM? <small>jo bikta hai — jaise "Surf 4 kg"</small></div>
      <label class="hs-search"><input type="search" data-fc-pdq="1" placeholder="🔍 item ka naam…" value="${esc(pd.q)}" autocomplete="off"></label>
      <div class="ir-tbl" id="fcPdHits">${hits.map(x => `<button type="button" class="ir-row" data-pd-it="${esc(x.id)}"><span><b>${esc(x.name)}${isPend(x) ? ' ⏳' : ''}</b><small>${esc(x.cat || '')}</small></span><span class="ir-num"><b>✓</b></span></button>`).join('') || '<p class="lk-note">Nahi mila? Stock tab se ➕ Naya item banayein.</p>'}</div>`
      : `<div class="fc-bhead"><b>${esc(it?.name || pd.id)}</b><small>${esc(it?.code || '')}</small></div>`}
    ${pd.id ? `<div class="fc-lab">② KIS BULK SE? <small>jis ka formula hai</small></div>
      <div class="fc-items">${fin.map(x => `<button type="button" class="fc-it${x.id === pd.src ? ' on' : ''}" data-pd-src="${esc(x.id)}"><b>${esc(x.name)}</b><small>${esc(un(x))}</small></button>`).join('') || '<p class="lk-note">Pehle bulk ka formula banayein.</p>'}</div>
      <div class="fc-lab">③ 1 PCS MEIN KITNA? <small>gram / ml</small></div>
      <div class="fc-batchrow"><span>1 pcs =</span><input type="number" inputmode="decimal" min="1" step="any" data-pd-g="1" value="${esc(String(pd.g || ''))}" placeholder="4000"><span>g${pd.src ? ' ' + esc(byId.get(pd.src)?.name || '') : ''}${Number(pd.g) > 0 && pd.src ? ' = ' + num(r6(Number(pd.g) / (gOf(pd.src) || 1000))) + ' ' + esc(un(byId.get(pd.src))) : ''}</span></div>
      <div class="fc-lab">④ PACKING MAAL <small>☑ + fi pcs kitna — ek dafa</small></div>
      <div class="fc-picks">${mats.map(x => { const on = pd.mats[x.id] != null; return `<div class="fc-pk${on ? ' pk-on' : ''}"><label class="fc-pkl"><input type="checkbox" data-pd-mat="${esc(x.id)}"${on ? ' checked' : ''}><span><b>${esc(x.name)}</b><small>${rs(rateOf(x.id, x))} / ${esc(un(x))} · stock ${esc(qt(x.stock, x))}</small></span></label>${on ? `<input type="number" inputmode="decimal" min="0" step="any" class="fc-pkq" data-pd-mq="${esc(x.id)}" value="${pd.mats[x.id]}">` : ''}</div>`; }).join('') || '<p class="lk-note">Abhi koi packing maal nahi — ⚙️ ☑ Factory items mein <b>📦</b> tick lagayein, ya Stock tab → ➕ Naya item (📦 Packing material).</p>'}</div>
      ${tmp ? `<section class="ir-sec fc-sum"><div class="fc-sumrow"><span>Bulk ${num(packUnit(tmp))} ${esc(un(byId.get(pd.src)))} × ${rs(bulkCpp(pd.src))}</span><b>${rs(packUnit(tmp) * bulkCpp(pd.src))}</b></div><div class="fc-sumrow"><span>Packing maal</span><b>${rs(matCost(tmp))}</b></div><div class="fc-sumrow"><span>Laagat fi pcs</span><b>${rs(packCpp(tmp))}</b></div></section>` : ''}
      <div class="fc-btns">${packOf(pd.id) ? '<button type="button" class="fc-no" data-pd-del="1">🗑 Hatao</button>' : ''}<button type="button" class="fc-go" data-pd-save="1">✓ Save</button></div>` : ''}`;
  if (only) { swapParts(el, html, only); return; }
  el.innerHTML = html;
}
async function pkDefSave(del) {
  if (!pd?.id || !cloud?.setFactoryCfg) return;
  if (!del) { if (!pd.src) { notice('Bulk item chunein'); return; } if (!(Number(pd.g) > 0)) { notice('1 pcs = kitne gram — likhein'); return; } if (pd.src === pd.id) { notice('Item apna hi bulk nahi ho sakta'); return; } }
  else if (!confirm('Is packing item ki setting hatani hai?')) return;
  const v = del ? null : { src: pd.src, g: r3(pd.g), mats: Object.entries(pd.mats).filter(([, q]) => Number(q) > 0).map(([id, q]) => ({ id, q: r3(q), n: String(byId.get(id)?.name || '').slice(0, 80) })) };
  const patch = { packs: { [pd.id]: v } };
  if (!del && facPick({ id: pd.id }) == null && !items.some(x => x.id === pd.id)) patch.items = { [pd.id]: true };
  cfg = { ...(cfg || {}), packs: { ...(cfg?.packs || {}), [pd.id]: v } };
  try { await cloud.setFactoryCfg(patch); notice(del ? 'Hata diya' : '✓ ' + (byId.get(pd.id)?.name || '') + ' — packing set'); pd = null; $('dialog')?.close(); st.tab = 'formulas'; keep(); repaint(); }
  catch (e) { notice('Save nahi hua: ' + (e?.message || e)); }
}
// bug 6: chooser alag dialog — tayyar maal pehle, raw mein istemaal wali neeche alag
function fnewDlg() { if (!isOwner()) return; fn = { q: '' }; dlg('➕ Naya formula — item chunein', '<div id="fcNew"></div>'); fnewPaint(); }
function fnewPaint(only) {
  const el = $('fcNew'); if (!el || !fn) return; const F = forms(), used = rawUsed(), q = fn.q.trim().toLowerCase();
  const all = srch(items.filter(x => !F[x.id]).sort(pendFirst), q, 40);
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
  fe = feInit(it, f);
  dlg('🧪 Formula — ' + it.name, '<div id="fcForm"></div>'); formPaint();
}
// v2.102.0: formula editor ki haalat — lines = sirf raw (fi batch) · self {matId: har pcs} · fms = doosri packing [{id, g, mats{}}] · ml / auto
function feInit(it, f) {
  const x = { id: it.id, per: f?.per || (it.pack > 1 ? it.pack * 5 : 100), lines: (f?.lines || []).map(l => ({ id: String(l.id), q: Number(l.q) || 0, n: l.n || '' })), lab: Number(f?.lab) || 0, gas: Number(f?.gas) || 0, q: '', sel: new Set(), pf: 'sab', lim: 300,
    ml: fixMl(f?.ml), auto: f?.auto !== false, self: Object.fromEntries(selfMats(f).map(m => [String(m.id), Number(m.q)])), fms: packsOf(it.id).map(p => ({ id: p.id, g: p.g, mats: Object.fromEntries(p.mats.map(m => [String(m.id), Number(m.q) || 1])) })), fms0: packsOf(it.id).map(p => p.id), addF: false, saved: !!f };
  // purani bottle / dhakan / pouch line (ginti 1 ya = per) -> bharne ka maal (har pcs 1)
  x.lines = x.lines.filter(l => { if (looksPack(l.id, l.n) && (l.q === 1 || Math.abs(l.q - x.per) < 0.001)) { x.self[l.id] = 1; return false; } return true; });
  if (!x.ml && !f) { const m = mlFromName(it.name); if (m) x.ml = m; }   // naya formula: naam se (1.5 liter = 1500)
  return x;
}
const feUsed = () => new Set([...fe.lines.map(l => String(l.id)), ...Object.keys(fe.self || {}), ...(fe.fms || []).map(m => String(m.id))]);
function feAdd(id, name) {   // tick -> raw line ya bharne ka maal
  if (!fe) return; id = String(id); if (feUsed().has(id)) return;
  if (looksPack(id, name)) { fe.self = { ...(fe.self || {}), [id]: 1 }; return; }
  fe.lines.push({ id, q: 1, n: name || '' });
}
const feVol = () => volOf(fe.lines), feAutoPer = () => { const V = feVol(); return fe.ml > 0 && fe.auto && V.v > 0 ? r3(V.v * 1000 / fe.ml) : 0; };
const feSync = () => { const a = feAutoPer(); if (a > 0) fe.per = a; };
// v2.101.7: 🧪 RAW MAAL — LIST + MULTIPLE ☑ (malik: "yahan multiple selection, add hui items ki list ho to asani — search mein problem")
//   List foran (likhna nahi): chips Raw / 📦 Packing / Sab, ⭐ aksar (doosre formulon mein jitni dafa), stock + rate. ☑ = fe.sel (yaad, search
//   badle tab bhi) -> neeche "➕ N items jorein" (sab ek dafa, ginti 1). Formula mein pehle se = ✓ (tick hatao = puchh kar hatao).
//   Factory mein na mile (2+ harf) = POS ki saari items se "➕ factory + formula" (malik).
// 📦 bharne ka maal khud pehchaan: packing maal (isMat) ya naam (bottle / dhakan / cap / pouch / label / sticker / carton / shopper / bag / jar / dabba / lid / tube)
const PACK_RX = /bott?le|bott?el|botal|dhakk?an|dhakn|\bcap\b|caps\b|pouch|label|sticker|carton|\bbox\b|shopper|\bbag\b|\bjar\b|dabba|\blid\b|\btube\b/i;
const looksPack = (id, name) => isMat(id) || PACK_RX.test(String(name || byId.get(String(id))?.name || ''));
function feListHTML() {   // v2.101.8: malik — "yahan SIRF factory items, SAARI (abhi save ki ⏳ bhi), aur ☑ Sab chunein" (POS wali yahan nahi)
  if (!fe) return ''; const F = forms(), use = new Map(), inF = feUsed();
  for (const [fid, f] of Object.entries(F)) if (fid !== fe.id) for (const l of f.lines || []) use.set(String(l.id), (use.get(String(l.id)) || 0) + 1);
  const fac = items.filter(x => x.id !== fe.id), q = fe.q.trim(), kOk = x => fe.pf === 'sab' || (fe.pf === 'mat' ? kindOf(x) === 'mat' : kindOf(x) !== 'mat');
  const n = k => fac.filter(x => k === 'sab' || (k === 'mat' ? kindOf(x) === 'mat' : kindOf(x) !== 'mat')).length;
  const srt = (a, b) => (isPend(b) ? 1 : 0) - (isPend(a) ? 1 : 0) || (use.get(b.id) || 0) - (use.get(a.id) || 0) || a.name.localeCompare(b.name);   // nayi save ki (⏳) sab se upar
  const L = q ? srch(fac, q, 300) : fac.filter(kOk).sort(srt), shown = L.slice(0, fe.lim), on = x => inF.has(x.id) || fe.sel.has(x.id);
  const free = L.filter(x => !inF.has(x.id)), allOn = free.length > 0 && free.every(x => fe.sel.has(x.id));
  const row = x => { const inn = inF.has(x.id), u = use.get(x.id) || 0, r = rateOf(x.id, x);
    return `<label class="fc-pk${on(x) ? ' pk-on' : ''}${inn ? ' fe-in' : ''}"><span class="fc-pkl"><input type="checkbox" data-fe-tick="${esc(x.id)}"${on(x) ? ' checked' : ''}><span><b>${u ? '⭐ ' : ''}${esc(x.name)}${isPend(x) ? ' ⏳' : ''}</b><small>${inn ? '✓ formula mein · ' : ''}${isPend(x) ? '⏳ abhi save ki — PC POS mein bana raha · ' : ''}stock ${esc(qk(x.stock, x))} · ${r ? rs(r) + ' / ' + esc(un(x)) : 'rate nahi'}${u ? ' · ' + u + ' formula' : ''}</small></span></span></label>`; };
  return `${q ? `<p class="fc-acnt">🔍 "${esc(q)}" — ${num(L.length)} mili</p>` : `<div class="fc-per fc-pf">${[['sab', 'Sab ' + num(n('sab'))], ['raw', 'Raw ' + num(n('raw'))], ['mat', '📦 Packing ' + num(n('mat'))]].map(([k, l]) => `<button type="button" class="${fe.pf === k ? 'on' : ''}" data-fe-pf="${k}">${l}</button>`).join('')}</div>`}
    ${free.length ? `<label class="fc-selall"><input type="checkbox" data-fe-all="1"${allOn ? ' checked' : ''}><b>☑ Sab chunein</b><small>${num(free.length)} item${q ? ' (jo mili)' : ''}</small></label>` : ''}
    <div class="fc-picks fc-fepick">${shown.map(row).join('') || '<p class="lk-note">Factory mein koi item nahi — Stock tab se ➕ Item jorein.</p>'}</div>
    ${L.length > shown.length ? `<button type="button" class="fc-no" data-fe-more="1">⬇️ Aur dikhao (${num(L.length - shown.length)})</button>` : ''}
    ${fe.sel.size ? `<button type="button" class="fc-addsel" data-fe-addsel="1">➕ ${num(fe.sel.size)} item${fe.sel.size > 1 ? 's' : ''} formula mein jorein</button>` : ''}`;
}
// v2.103.4: ⚠️ "factory items mein nahi" — ek tap ilaaj (malik: "ye POS mein lao ya button de do koi")
//   POS mein yahi id = ☑ Factory mein jorein · milta julta naam = 🔗 Yahi hai (line usi se) · kuch nahi = 🖥 POS mein banayein (job:, PC banaye)
function goneFix(l, i) {
  if (!isOwner()) return '<small class="fc-fln bad">⚠️ factory items mein nahi — malik theek karega</small>';
  let P = []; try { P = stockPickList(); } catch {}
  const same = P.find(x => String(x.id) === String(l.id)), sim = same ? [] : srch(P, l.name, 3).filter(x => !byId.has(x.id) || true).slice(0, 3);
  return `<div class="fc-gone"><small>⚠️ ${same ? 'POS mein hai magar factory ☑ nahi' : sim.length ? 'POS mein isi id se nahi — shayad yahi hai:' : 'POS mein bhi nahi'}</small><div class="fc-gbtns">
    ${same ? `<button type="button" class="fc-go sm" data-fe-facon="${esc(same.id)}">☑ Factory mein jorein</button>` : ''}
    ${sim.map(x => `<button type="button" class="fc-link fc-rel" data-fe-relink="${i}|${esc(x.id)}">🔗 Yahi hai: ${esc(x.name)}</button>`).join('')}
    ${same ? '' : `<button type="button" class="fc-go sm alt" data-fe-mkpos="${i}">🖥 POS mein banayein${l.c ? ' · Rs ' + num(l.c) : ''}</button>`}</div></div>`;
}
async function mkPos(i) {   // formula line -> naya POS item (PC 1 min) — line 'job:' (PC bana de to asli id khud)
  const l = fe?.lines?.[i]; if (!l || !isOwner()) return; const name = String(byId.get(l.id)?.name || l.n || '').trim(); if (!name) { notice('Naam nahi'); return; }
  const c = fRate(l.id) || Number(byId.get(l.id)?.prate) || 0;
  if (!confirm(`"${name}" POS mein naya item banayein?${c ? '\nKhareed rate Rs ' + num(c) : ''}\nPC 1 minute mein banayega, formula khud asli item se jur jayega.`)) return;
  try { const jid = await stockNewItemQuick({ name, costP: c || 0, rpcs: 0 }); window.ntFacPend(jid, name, c); l.id = 'job:' + jid; l.n = name; loadItemsQuiet(); formPaint(); notice('🖥 ' + name + ' — PC ko bheja. Formula 💾 Save kar dein'); }
  catch (e) { notice('Nahi hua: ' + (e?.message || e)); }
}
async function locToPos(id) {   // 📱 'loc:' item -> POS (job:) — har formula / packing / gram / 📦 mein id badlo
  if (!isOwner() || !String(id).startsWith('loc:')) return; const lid = String(id).slice(4), v = cfg?.local?.[lid]; if (!v) return;
  if (!confirm(`"${v.n}" POS mein item banayein?${v.r ? '\nKhareed rate Rs ' + num(v.r) : ''}\nPC 1 minute mein banayega — formulas khud asli item se jur jayenge.`)) return;
  try {
    const jid = await stockNewItemQuick({ name: v.n, costP: Number(v.r) || 0, rpcs: 0 }), nid = 'job:' + jid, sw = x => String(x) === id ? nid : x;
    window.ntFacPend(jid, v.n, Number(v.r) || 0, !!cfg?.pack?.[id]);
    const fp = {}; for (const [fid, f] of Object.entries(cfg?.formulas || {})) { if (!f) continue; const lines = (f.lines || []).map(x => ({ ...x, id: sw(x.id) })), mats = (f.self?.mats || []).map(m => ({ ...m, id: sw(m.id) }));
      if (fid === id) { fp[nid] = { ...f, lines, ...(f.self ? { self: { ...f.self, mats } } : {}) }; fp[id] = null; } else if (JSON.stringify(lines) !== JSON.stringify(f.lines || []) || JSON.stringify(mats) !== JSON.stringify(f.self?.mats || [])) fp[fid] = { ...f, lines, ...(f.self ? { self: { ...f.self, mats } } : {}) }; }
    const pp = {}; for (const [pid, d] of Object.entries(cfg?.packs || {})) { if (!d) continue; const nd = { ...d, src: sw(d.src), mats: (d.mats || []).map(m => ({ ...m, id: sw(m.id) })) };
      if (pid === id) { pp[nid] = nd; pp[id] = null; } else if (JSON.stringify(nd) !== JSON.stringify(d)) pp[pid] = nd; }
    const g = gOf(id), patch = { local: { [lid]: null }, ...(Object.keys(fp).length ? { formulas: fp } : {}), ...(Object.keys(pp).length ? { packs: pp } : {}), ...(g ? { conv: { [nid]: g, [id]: null } } : {}), ...(cfg?.pack?.[id] ? { pack: { [nid]: true, [id]: null } } : {}) };
    const merge = (a, b) => { const o = { ...(a || {}) }; for (const [k, x] of Object.entries(b || {})) { if (x === null) delete o[k]; else o[k] = x; } return o; };
    cfg = { ...cfg, local: merge(cfg.local, patch.local), formulas: merge(cfg.formulas, fp), packs: merge(cfg.packs, pp), ...(patch.conv ? { conv: merge(cfg.conv, patch.conv) } : {}), ...(patch.pack ? { pack: merge(cfg.pack, patch.pack) } : {}) };
    if (fe) { fe.lines = fe.lines.map(x => ({ ...x, id: sw(x.id) })); if (fe.self && fe.self[id] != null) { fe.self[nid] = fe.self[id]; delete fe.self[id]; } if (fe.id === id) fe.id = nid; }
    loadItemsQuiet(); repaint(); if (fe && $('fcForm')) formPaint();
    await cloud.setFactoryCfg(patch); notice('🖥 ' + v.n + ' — PC ko bheja, 1 min mein POS mein (formulas khud jur jayenge)');
  } catch (e) { notice('Nahi hua: ' + (e?.message || e)); }
}
// v2.103.7: 🛢 KHULA MAAL (malik: "kala tail bottle ek item hai jis ka naam kala tail — formula kaise banaye") — wahi item apne formula mein
//   nahi aa sakta, to ek tap: "<naam> khula" 📱 sirf factory raw (kg / ltr, POS mein nahi — larkon ko kuch nahi dikhta) + formula mein 10 + 1 pcs = g.
const khulaName = it => String(it?.name || '').trim() + ' khula';
const khulaOf = it => items.find(x => isLoc(x) && fold(x.name) === fold(khulaName(it)));
function khulaBtn(it) {
  if (!fe || !isOwner() || !it || isLoc(it)) return ''; const k = khulaOf(it); if (k && fe.lines.some(l => l.id === k.id)) return '';
  const g = fe.ml || gOf(it.id) || mlFromName(it.name); if (!g) return ''; const u = volU(it) === 'kg' ? 'kg' : 'liter';
  return `<button type="button" class="fc-khula" data-fe-khula="1"><span>🛢</span><span><b>${k ? '➕ "' + esc(k.name) + '" formula mein jorein' : '➕ "' + esc(khulaName(it)) + '" (' + u + ') banao'}</b><small>📱 sirf factory raw — POS mein nahi · 1 ${esc(un(it))} = ${num(r3(g / 1000))} ${u} · batch khud jama</small></span></button>`;
}
async function khulaAdd() {
  if (!fe || !isOwner()) return; const it = byId.get(String(fe.id)); if (!it) return;
  const g = fe.ml || gOf(it.id) || mlFromName(it.name); if (!g) { notice('Pehle "1 pcs = kg" likhein'); return; }
  let k = khulaOf(it);
  if (!k) { const { id, patch } = locNew(khulaName(it), 0, { un: volU(it) === 'kg' ? 'Kg' : 'Ltr' }); loadItemsQuiet(); k = byId.get(id);
    try { await cloud.setFactoryCfg(patch); } catch (e) { notice('Save nahi hua: ' + (e?.message || e)); return; } }
  if (!k || !fe) return;
  if (!fe.lines.some(l => l.id === k.id)) fe.lines.push({ id: k.id, q: 10, n: k.name });
  fe.ml = g; fe.auto = true; formPaint();
  notice(`✓ ${k.name} — 10 ${volU(it) === 'kg' ? 'kg' : 'ltr'} likha (badal sakte hain) · rate fi ${volU(it) === 'kg' ? 'kg' : 'ltr'} likhein · 📥 drum aaye to Stock → Maal aaya`);
}
function formPaint(only) {
  const el = $('fcForm'); if (!el || !fe) return; const it = byId.get(fe.id); if (!it) return;
  feSync();
  const c = costOf(fe), V = feVol(), smC = Object.entries(fe.self || {}).reduce((t, [id, q]) => t + Number(q) * rateOf(id, byId.get(id)), 0), cppAll = c.cpp + smC;
  const sg = suggest(it, cppAll), cr = curRates(it), U = un(it), vol = fe.ml > 0, mlSug = !vol ? mlFromName(it.name) : 0;
  const Lt = x => num(r3(x)) + ' ' + volU(it);
  const nPcs = Math.floor(fe.per + 1e-9), extra = vol ? r3((fe.per - nPcs) * fe.ml / 1000) : 0;
  const pkCands = (skip, n = 14) => items.filter(x => x.id !== fe.id && !skip.has(x.id) && !fe.lines.some(l => l.id === x.id) && looksPack(x.id, x.name)).slice(0, n);
  const matRows = (mats, key) => Object.entries(mats).map(([id, q]) => { const m = byId.get(id), r = rateOf(id, m);
    return `<div class="fc-mrow"><span><b>${esc(m?.name || 'Item ' + id)}</b><small>${r ? rs(r) + ' / ' + esc(un(m)) : 'rate nahi'}</small></span><label><input type="number" inputmode="decimal" min="0" step="any" data-fe-mq="${esc(key + '|' + id)}" value="${esc(String(q))}"><em>har pcs</em></label>${key === 'self' ? `<button type="button" class="fc-link fc-mraw" data-fe-mraw="${esc(id)}" title="Raw maal mein">↑ raw</button>` : ''}<button type="button" class="ir-cx" data-fe-mdel="${esc(key + '|' + id)}">✕</button></div>`; }).join('');
  const addChips = (mats, key) => { const C = pkCands(new Set(Object.keys(mats))); return C.length ? `<div class="fc-mchips">${C.map(x => `<button type="button" data-fe-madd="${esc(key + '|' + x.id)}">+ ${esc(x.name)}</button>`).join('')}</div>` : ''; };
  const html = `<section class="ir-sec fc-nus">
      <div class="fc-mlrow"><span>1 ${esc(U)} ${esc(it.name)} =</span><input type="number" inputmode="decimal" min="0" step="any" data-fe-ml="1" value="${vol ? esc(String(r3(fe.ml / 1000))) : ''}" placeholder="${mlSug ? num(r3(mlSug / 1000)) : '—'}"><span>${volU(it) === 'kg' ? 'kg' : 'liter'}</span></div>
      ${!vol && mlSug ? `<button type="button" class="fc-sugml" data-fe-mlset="${mlSug}">🧪 Naam se: 1 ${esc(U)} = ${num(r3(mlSug / 1000))} ${volU(it) === 'kg' ? 'kg' : 'liter'} — ✓ Lagao <small>(batch khud jama hoga)</small></button>` : ''}
      ${vol && fe.auto ? `<div class="fc-autob"><small>1 batch = raw maal ka jama</small><b>${Lt(V.v)} = ${num(nPcs)} ${esc(U)}</b>${extra > 0.0005 ? `<small>+ ${Lt(extra)} bacha</small>` : ''}<button type="button" class="fc-link" data-fe-auto="0">✎ haath se</button></div>
        ${V.miss.length ? `<p class="fc-fln bad">⚠️ ${V.miss.map(l => esc(byId.get(l.id)?.name || l.n)).join(', ')} — "1 pcs = g" likhein, warna jama mein nahi</p>` : ''}${!(V.v > 0) ? '<p class="lk-note">Neeche raw maal ki ginti (liter / kg) likhein — batch khud jama hoga.</p>' : ''}`
      : `<div class="fc-batchrow"><span>1 batch =</span><input type="number" inputmode="decimal" min="1" step="any" data-fe-per="1" value="${esc(String(fe.per))}"><span>${esc(U)}${it.pack > 1 ? ' (' + esc(qt(fe.per, it)) + ')' : ''}</span></div>${vol ? `<button type="button" class="fc-link" data-fe-auto="1">↺ Khud jama karo (${Lt(V.v)})</button>` : ''}`}</section>
    <section class="ir-sec"><div class="ir-sh"><b>🧪 Raw maal (1 batch)</b><small>khareed rate</small></div>${khulaBtn(it)}
      ${posOn() ? `<label class="fc-posr"><input type="checkbox" data-fe-posr="1"${posRate ? ' checked' : ''}> <span>POS mein bhi khareed rate lagao<small>sale rate / barcode nahi badlega</small></span></label>` : ''}
      <div class="ir-tbl">${c.lines.map((l, i) => { const g = gOf(l.id), [ru, per] = rUnit(l.id, l.it), canG = !(/kg|ltr|lit|^l$/.test(un(l.it)) && !g), pr = Number(l.it?.prate) || 0;
        return `<div class="ir-row fc-fl"><div class="fc-flh"><b>${esc(l.name)}</b><b class="fc-flrs">${rs(l.rs)}</b><button type="button" class="ir-cx" data-fe-del="${i}">✕</button></div>
        ${l.gone ? goneFix(l, i) : isLoc(l.it) && posOn() ? `<div class="fc-gone"><small>📱 sirf factory item — POS mein nahi · batch mein app ke factory stock se minus</small>${isOwner() ? `<button type="button" class="fc-go sm" data-fe-locpos="${esc(l.id)}">🖥 POS mein banayein</button>` : ''}</div>` : ''}
        <div class="fc-flg"><label><small>Ginti</small><span><input type="number" inputmode="decimal" min="0" step="any" data-fe-q="${i}" value="${esc(String(g ? kgOf(fe.lines[i].q, l.id) : fe.lines[i].q))}"><em>${g ? 'kg / L' : esc(un(l.it))}</em></span></label>
          <label class="${l.own ? 'own' : ''}"><small>Rate / ${esc(ru)}</small><span><input type="number" inputmode="decimal" min="0" step="any" data-fe-r="${esc(l.id)}" value="${l.c ? r2(l.c * per) : ''}" placeholder="⚠️"></span></label>
          ${canG ? `<label><small>1 ${esc(un(l.it))} =</small><span><input type="number" inputmode="decimal" min="0" step="any" data-fe-g="${esc(l.id)}" value="${g || (vol ? r3(pcsG(l.id, l.name)) : '')}" placeholder="—" class="${!g && vol ? 'fc-gauto' : ''}"><em>g/ml${!g && vol ? ' · khud' : ''}</em></span></label>` : ''}</div>
        <small class="fc-fln">${g ? esc(qt(l.q, l.it)) + ' · ' : ''}${l.c ? rs(l.c) + ' / ' + esc(un(l.it)) : 'rate nahi — likhein'}${l.own ? ` · <b>✎ factory rate</b>${pr ? ` <button type="button" class="fc-link" data-fe-rpos="${esc(l.id)}">↺ POS wala ${rs(pr * per)}</button>` : ''}` : ''}${vol && !g ? (() => { const h = lineVolHow(l.id), x = lineVol(l.id, l.q, l.name); return h === 'khud' ? ` · <b>= ${num(x)} kg (1 pcs = 1 kg, khud)</b>` : h === 'name' ? ` · <b>= ${num(x)} kg (${pcsG(l.id, l.name) === 1000 && Number(l.it?.pack) > 1 ? 'bori = ' + num(l.it.pack) + ' kg, 1 pcs = 1 kg' : 'naam se'})</b>` : ''; })() : ''} <button type="button" class="fc-link" data-fe-mv="${i}">↓ bharne ka maal</button></small></div>`; }).join('') || '<p class="lk-note">Neeche list se raw maal ☑ karein.</p>'}</div>
      <div class="fc-lab fc-fehd">➕ MAAL CHUNEIN <small>☑ kai ek saath — bottle / dhakan khud neeche jayenge</small></div>
      <label class="hs-search"><input type="search" data-fc-fq2="1" placeholder="🔍 dhoondein (naam / barcode)…" value="${esc(fe.q)}" autocomplete="off"></label>
      <div id="feHits">${feListHTML()}</div></section>
    <section class="ir-sec fc-pksec"><div class="ir-sh"><b>🧴 Kis mein bharte hain?</b><small>batch par poochega</small></div>
      <div class="fc-form1"><div class="fc-f1h"><b>🧴 ${esc(it.name)}</b><small>yahi item${vol ? ' · 1 = ' + num(r3(fe.ml / 1000)) + ' ' + volU(it) : ''} · har pcs ke saath:</small></div>
        ${matRows(fe.self || {}, 'self') || '<p class="lk-note">Bottle / dhakan / label neeche se + karein (ek dafa).</p>'}${addChips(fe.self || {}, 'self')}
        ${Object.keys(fe.self || {}).length ? `<small class="fc-fln">Fi pcs packing ${rs(smC)} · laagat fi pcs ${rs(cppAll)}</small>` : ''}</div>
      ${(fe.fms || []).map((fm, k) => { const m = byId.get(fm.id), mc = Object.entries(fm.mats).reduce((t, [id, q]) => t + Number(q) * rateOf(id, byId.get(id)), 0), cp = vol && fm.g ? c.cpp * fm.g / fe.ml + mc : 0;
        return `<div class="fc-form1 alt"><div class="fc-f1h"><b>🛍 ${esc(m?.name || 'Item ' + fm.id)}</b><button type="button" class="ir-cx" data-fe-fdel="${k}">✕</button></div>
        <div class="fc-mlrow sm"><span>1 pcs =</span><input type="number" inputmode="decimal" min="0" step="any" data-fe-fg="${k}" value="${fm.g ? r3(fm.g / 1000) : ''}" placeholder="${mlFromName(m?.name) ? num(r3(mlFromName(m?.name) / 1000)) : '0.5'}"><span>${volU(it) === 'kg' ? 'kg' : 'liter'}${vol && fm.g ? ' = ' + num(r3(fm.g / fe.ml)) + ' ' + esc(it.name) : ''}</span></div>
        ${matRows(fm.mats, 'f' + k)}${addChips(fm.mats, 'f' + k)}${cp ? `<small class="fc-fln">Laagat fi pcs ${rs(cp)}</small>` : ''}</div>`; }).join('')}
      ${vol ? (fe.addF ? `<div class="fc-addf"><div class="fc-lab">DOOSRI PACKING KA ITEM <small>jaise packet / chhoti bottle</small></div><div class="fc-mchips">${items.filter(x => x.id !== fe.id && !feUsed().has(x.id) && !looksPack(x.id, x.name)).sort((a, b) => (fold(b.name).split(' ')[0] === fold(it.name).split(' ')[0] ? 1 : 0) - (fold(a.name).split(' ')[0] === fold(it.name).split(' ')[0] ? 1 : 0) || a.name.localeCompare(b.name)).slice(0, 40).map(x => `<button type="button" data-fe-fadd="${esc(x.id)}">${esc(x.name)}</button>`).join('') || '<p class="lk-note">Factory mein aur item nahi — Stock tab se ➕ Item jorein.</p>'}</div></div>`
        : '<button type="button" class="fc-anew" data-fe-addf="1">➕ Doosri packing (packet / chhoti bottle)</button>') : '<p class="lk-note">Packet jaisi doosri packing ke liye upar "1 pcs = ml / g" likhein.</p>'}</section>
    <section class="ir-sec"><div class="ir-sh"><b>Batch ka baqi kharcha</b></div>
      <div class="fc-two"><label>Mazdoori Rs<input type="number" inputmode="decimal" min="0" data-fe-lab="1" value="${fe.lab || ''}" placeholder="0"></label><label>Gas / bijli Rs<input type="number" inputmode="decimal" min="0" data-fe-gas="1" value="${fe.gas || ''}" placeholder="0"></label></div></section>
    <section class="ir-sec fc-sum"><div class="fc-sumrow"><span>🧪 Raw + kharcha (1 batch)</span><b>${rs(c.total)}</b></div><div class="fc-sumrow"><span>${vol ? 'Fi ' + esc(U) + ' (nuskha)' : 'Laagat fi ' + esc(U)}</span><b>${rs(c.cpp)}</b></div>${smC ? `<div class="fc-sumrow"><span>🧴 Packing fi ${esc(U)}</span><b>${rs(smC)}</b></div>` : ''}
      <div class="fc-sumrow"><span>Laagat fi ${esc(U)}</span><b>${rs(cppAll)}${it.pack > 1 ? ' · ' + rs(cppAll * it.pack) + ' / ctn' : ''}</b></div>
      <div class="fc-sumrow"><span>Naye rate (W ${wm()}% · R ${rm()}%)</span><b>${it.pack > 1 ? 'W ' + num(sg.wctn) + '/' + num(sg.wpcs) + ' · R ' + num(sg.rctn) + '/' + num(sg.rpcs) : 'W ' + num(sg.wpcs) + ' · R ' + num(sg.rpcs)}</b></div>
      <div class="fc-sumrow"><span>Abhi POS mein</span><b>${it.pack > 1 ? 'W ' + num(cr.wctn) + '/' + num(cr.wpcs) + ' · R ' + num(cr.rctn) + '/' + num(cr.rpcs) : 'W ' + num(cr.wpcs) + ' · R ' + num(cr.rpcs)}</b></div></section>
    <div class="fc-btns">${forms()[fe.id] ? '<button type="button" class="fc-no" data-fe-rm="1">🗑 Formula hatao</button>' : ''}<button type="button" class="fc-go" data-fe-save="1">✓ Formula save</button></div>`;
  if (only) { swapParts(el, html, only); return; }
  el.innerHTML = html;
}
// rate likha (fi kg / ctn / pcs) -> fi pcs; -1 = POS wala wapas
function setRate(id, v) {
  if (!isOwner() || !cloud?.setFactoryCfg) { notice('Sirf malik'); return; }
  const it = byId.get(String(id)), [ru, per] = rUnit(id, it), pr = Number(it?.prate) || 0;
  const pcs = v === -1 || !(v > 0) ? 0 : r4(v / per), keepF = pcs > 0 && Math.abs(pcs - pr) > 0.0001 ? pcs : null;
  cfg = { ...(cfg || {}), rate: { ...(cfg?.rate || {}), [String(id)]: keepF } }; formPaint();
  cloud.setFactoryCfg({ rate: { [String(id)]: keepF } }).then(() => notice(v === -1 ? '↺ ' + (it?.name || '') + ' — POS ka khareed rate' : pcs ? '✓ ' + (it?.name || '') + ' Rs ' + num(v) + ' / ' + ru + ' (factory)' : 'Rate hata diya')).catch(er => notice('Save nahi hua: ' + (er?.message || er)));
  if (posOn() && posRate && pcs > 0 && v !== -1 && it && !isPend(it) && !isLoc(it)) {   // v2.103.0: sirf POS mode
    stockAgentItemSave(String(id), { costP: pcs }).then(r => notice(r?.ok ? '✓ ' + it.name + ' — POS khareed rate Rs ' + num(pcs) + ' / ' + un(it) : r?.pending ? '⏳ ' + it.name + ': POS rate PC on hote hi' : '❌ POS rate: ' + (r?.why || 'nakam'))).catch(er => notice('POS rate: ' + (er?.message || er)));
  } else if (posOn() && posRate && it && isPend(it)) notice('⏳ item abhi POS mein nahi — rate sirf factory mein');
}
async function formSave(del) {
  if (!fe) return; if (!cloud?.setFactoryCfg) { notice('App update karein'); return; }
  const it = byId.get(fe.id);
  if (!del) {
    if (fe.ml > 0 && fe.auto !== false) feSync();
    if (!(fe.per > 0)) { notice(fe.ml > 0 ? 'Raw maal ki ginti (liter / kg) likhein — batch khud jama hoga' : '1 batch mein kitne bante hain — likhein'); return; }
    const lines = fe.lines.filter(l => l.q > 0); if (!lines.length) { notice('Kam se kam ek raw maal (ginti ke saath) jorein'); return; }
    if ((fe.fms || []).some(f => !(Number(f.g) > 0))) { notice('Doosri packing ka "1 pcs = ml / g" likhein'); return; }
    fe.lines = lines;
  } else if (!confirm('Is item ka formula hatana hai?')) return;
  const c = costOf(fe), nm = id => String(byId.get(String(id))?.name || '').slice(0, 80);
  const self = Object.entries(fe.self || {}).filter(([, q]) => Number(q) > 0).map(([id, q]) => ({ id, q: r3(q), n: nm(id) }));
  const smC = self.reduce((t, m) => t + m.q * rateOf(m.id, byId.get(m.id)), 0);
  const v = del ? null : { per: r3(fe.per), lines: fe.lines.map(l => ({ id: l.id, q: r3(l.q), n: String(byId.get(l.id)?.name || l.n || '').slice(0, 80) })), lab: r2(fe.lab), gas: r2(fe.gas), cpp: r2(c.cpp + smC), at: Date.now(),
    ml: fe.ml > 0 ? r3(fe.ml) : 0, auto: fe.auto !== false, self: { mats: self } };   // v2.102.0 (merge: har key likhi — purani na reh jaye)
  const id = fe.id, packs = {};
  if (Array.isArray(fe.fms)) { for (const fm of fe.fms) packs[fm.id] = del ? null : { src: id, g: r3(fm.g), mats: Object.entries(fm.mats).filter(([, q]) => Number(q) > 0).map(([mid, q]) => ({ id: mid, q: r3(q), n: nm(mid) })) };
    for (const old of fe.fms0 || []) if (!fe.fms.some(f => f.id === old)) packs[old] = null; }
  const hasP = Object.keys(packs).length;
  cfg = { ...(cfg || {}), formulas: { ...(cfg?.formulas || {}), [id]: v }, ...(hasP ? { packs: { ...(cfg?.packs || {}), ...packs } } : {}) };   // foran (tez)
  try { await cloud.setFactoryCfg({ formulas: { [id]: v }, ...(hasP ? { packs } : {}) }); notice(del ? 'Formula hata diya' : '✓ ' + (it?.name || '') + ' ka formula save'); fe = null; $('dialog')?.close(); st.tab = 'formulas'; keep(); repaint(); }
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
  const near = srch(items, name, 3), nc = near.map(x => ({ id: x.id, name: x.name, pack: x.pack, rate: x.prate, un: x.un }));   // ⏳ pending bhi yahin
  if (near.length === 1 && (isPend(near[0]) || dl(fold(near[0].name), f) <= 2)) return { id: near[0].id, status: 'ok', hit: near[0].name, cand: nc[0], cands: nc };
  let r = null; try { r = stockAgentFind(name, [], 5); } catch { r = null; }
  const cands = (r?.candidates || []).map(c => ({ id: String(c.item_id), name: c.name, pack: Number(c.pack) || 0, rate: Number(c.rate?.khareed_pcs) || 0, un: c.pcs_naam || 'Pcs' }));
  if (r?.decision === 'pakka' && r.item_id) { const c = cands.find(x => x.id === String(r.item_id)) || cands[0]; return { id: String(r.item_id), status: 'ok', hit: c?.name || name, cand: c, cands }; }
  const all = [...nc, ...cands.filter(c => !nc.some(x => x.id === c.id))];
  if (all.length) { const sub = all.find(c => fold(c.name).includes(f) || f.includes(fold(c.name))) || (near.length ? nc[0] : null); return { id: sub ? sub.id : '', status: 'maybe', hit: sub?.name || '', cand: sub || null, cands: all }; }
  return { id: '', status: 'new', cands: [] };
}
const pfProdHits = q => { const F = forms(); return srch(items.filter(x => !F[x.id]).sort(pendFirst), q, 8); };
const pfOutside = l => l.id && !byId.has(l.id);   // POS mein hai magar factory items mein nahi — save par ☑
function pfLineQ(l) {   // tasveer ki miqdaar -> formula (1 batch) — fi piece × pieces; g / ml -> kg / L agar item kg / L mein ho
  let q = Number(l.qty) || 0; if (l.per === 'piece') q *= pf.pieces || 0;
  const it = byId.get(l.id) || l.cand, u = String(it?.un || '').toLowerCase(), lu = String(l.unit || '').toLowerCase(), g = l.id ? gOf(l.id) : 0;
  const isG = lu === 'g' || lu === 'gm' || lu === 'gram' || lu === 'ml', isKg = lu === 'kg' || lu === 'l' || lu === 'ltr' || lu === 'litre' || lu === 'liter';
  if (g && (isG || isKg)) return r3((isG ? q : q * 1000) / g);   // 1 pcs = g gram -> pcs
  if (isG && /kg|ltr|lit|^l$/.test(u)) q /= 1000;
  return r3(q);
}
function pfPaint(el0) {
  const el = el0 || $('fcPhoto'); if (!el || !pf) return;
  if (pf.busy) return;
  if (pf.err) { el.innerHTML = `<div class="fc-alert bad"><span>❌</span><div>${esc(pf.err)}</div></div><div class="fc-btns"><button type="button" class="fc-no" data-pf-back="1">✕ Band</button><button type="button" class="fc-go" data-fc-photo="1">📷 Dobara</button></div>`; return; }
  const r = pf.res, prod = byId.get(pf.prodId);
  if (pf.pick >= 0) {   // ek line ka item badalna
    const l = pf.lines[pf.pick], s = pf.sq.trim(); let hits = [];
    if (s.length >= 2) { hits = srch(items, s, 8).map(x => ({ id: x.id, name: x.name + (isPend(x) ? ' ⏳' : ''), un: x.un, rate: x.prate }));
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
      <div class="ir-tbl">${pf.lines.map((l, i) => l.status === 'labour' ? '' : `<div class="ir-row fc-pfl"><span><b>${esc(l.name)}</b><small>${num(l.qty)} ${esc(l.unit)} ${l.per === 'piece' ? 'fi piece → ' + num(pfLineQ(l)) + ' / batch' : '/ batch'}${l.id && gOf(l.id) ? ' = ' + num(pfLineQ(l)) + ' pcs (1 pcs ' + gOf(l.id) + ' g)' : ''}${l.rate ? ' · ' + rs(l.rate) : ''}${l.kind === 'packing' ? ' · packing' : ''}</small>${stat(l)}</span><span class="fc-crow"><input type="number" inputmode="decimal" min="0" step="any" data-pf-q="${i}" value="${esc(String(l.qty))}"><button type="button" class="fc-pfa${l.status === 'ok' ? '' : ' warn'}" data-pf-pick="${i}">${l.status === 'ok' ? '✎' : '?'}</button></span></div>`).join('')}</div>
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
    const lp = {}; const addLp = p => { for (const [k, v] of Object.entries(p)) lp[k] = { ...(lp[k] || {}), ...v }; };   // v2.103.0: sirf app = naye item cfg.local
    if (pf.prodNew) { const name = (pf.prodQ || r.product).trim(); if (!posOn()) { const x = locNew(name, 0); addLp(x.patch); prodId = x.id; } else { const jid = await stockNewItemQuick({ name, rpcs: 0 }); window.ntFacPend(jid, name); prodId = 'job:' + jid; } }
    else if (!byId.has(prodId)) tick[prodId] = true;
    const lines = [];
    for (const l of raw) {
      let id = l.id;
      if (l.status === 'new' || !id) { if (!posOn()) { const x = locNew(l.name, l.rate || 0); addLp(x.patch); id = x.id; } else { const jid = await stockNewItemQuick({ name: l.name, costP: l.rate || 0, rpcs: 0 }); window.ntFacPend(jid, l.name, l.rate || 0); id = 'job:' + jid; } }
      else if (!byId.has(id)) tick[id] = true;
      lines.push({ id, q: pfLineQ(l), n: l.name });
    }
    if (Object.keys(tick).length) { cfg = { ...(cfg || {}), items: { ...(cfg?.items || {}), ...tick } }; addLp({ items: tick }); }
    if (Object.keys(lp).length) await cloud.setFactoryCfg(lp);
    loadItemsQuiet();
    const lab = pf.lines.filter(l => l.status === 'labour').reduce((s, l) => s + ((l.amount || (l.qty * l.rate)) || 0) * (l.per === 'piece' ? pf.pieces : 1), 0);
    fe = { id: prodId, per: pf.pieces, lines: lines.filter(l => l.q > 0).map(l => ({ id: l.id, q: l.q, n: l.n })), lab: r2(lab), gas: 0, q: '' };
    pf = null; await formSave(false); try { stockRepaint(); } catch {}
  } catch (e) { pf.busy = false; pf.err = e?.message || String(e); pfPaint(); }
}

// ---------- 🏷 rates (malik) — v2.101: har rate khud bhi likh sakte hain (% sirf shuru ki raye) ----------
function ratesHTML(up) {
  const can = posOn() && stockFactoryCanRate(), rows = rateRows(rScope).sort((a, b) => (rateDiff(b) ? 1 : 0) - (rateDiff(a) ? 1 : 0) || a.it.name.localeCompare(b.it.name));
  const todo = rows.filter(rateDiff);
  const cell = (k, lab, x) => { if (!(x.it.pack > 1 || k.endsWith('pcs'))) return ''; const w = rateWant(x), ch = Math.abs((w[k] || 0) - (x.cr[k] || 0)) >= 1, own = rEd[x.it.id]?.[k] != null;
    return `<label class="fc-rb ed${ch ? ' chg' : ''}${own ? ' own' : ''}"><small>${lab}</small><span class="cur">POS ${num(x.cr[k])}</span><input type="number" inputmode="decimal" min="0" step="any" data-fr="${k}" data-fr-id="${esc(x.it.id)}" value="${w[k] || ''}"></label>`; };
  return `<section class="ir-sec"><div class="ir-sh"><b>🏷 Rates — laagat + nafa</b><small>W ${wm()}% · R ${rm()}% <button type="button" class="fc-link" data-fc-set="1">⚙️ badlein</button></small></div>
    <div class="fc-per fc-pf">${[['tayyar', '🧪 Tayyar / packing items'], ['raw', '📦 Raw / packing maal']].map(([k, l]) => `<button type="button" class="${rScope === k ? 'on' : ''}" data-fr-scope="${k}">${l}</button>`).join('')}</div>
    ${posOn() ? '' : '<div class="fc-alert"><span>📱</span><div><b>Factory sirf app mein</b> — yahan laagat + nafa ka hisaab hai; rate POS mein nahi lagta (⚙️ mein POS ON karein to "lagao" wapas).</div></div>'}
    ${rScope === 'tayyar' && isOwner() ? '<button type="button" class="fc-mcnew" data-mc-open=""><span>🧴</span><span><b>➕ Packing item — wazan se laagat</b><small>formula ke baghair: kitne gram × fi kg rate + harcha (bottle, dhakkan, mazdoori)</small></span></button>' : ''}
    <p class="lk-note">Dabbe mein rate <b>khud likh sakte hain</b> — % wala sirf raye hai. Peela = aap ka likha.</p>
    ${todo.length > 1 && can ? `<button type="button" class="fc-go" data-fc-rate="*">✓ Sab ${num(todo.length)} naye rate POS mein lagao</button>` : ''}
    <div id="fcRates">${rows.map(x => `<div class="fc-rc${rateDiff(x) ? '' : ' same'}"><div class="fc-rh"><b>${esc(x.it.name)}${x.pk ? ' <i class="fc-kind">📦 packing</i>' : ''}${x.mc ? ' <i class="fc-kind">🧴 wazan se</i>' : ''}</b><small>${x.raw ? 'khareed' : 'laagat'} ${rs(x.c.cpp)}${x.mc ? ' · ' + gTxt(x.mc.g) + ' × ' + rs(x.mc.kg) + '/kg = ' + rs(mcOil(x.mc)) + (mcMat(x.mc) + mcX(x.mc) ? ' + harcha ' + rs(mcMat(x.mc) + mcX(x.mc)) : '') : ''}${x.it.pack > 1 ? ' · ' + rs(x.c.cpp * x.it.pack) + ' / ctn' : ''}${up?.some(u => u.it.id === x.it.id) ? ' · ⚠️ barhi' : ''}</small></div>
      <div class="fc-rg">${cell('wctn', 'W CTN', x)}${cell('wpcs', 'W PCS', x)}${cell('rctn', 'R CTN', x)}${cell('rpcs', 'R PCS', x)}</div>
      <div class="fc-rbtn">${x.mc && isOwner() ? `<button type="button" class="fc-link" data-mc-open="${esc(x.it.id)}">✏️ laagat</button>` : ''}${rEd[x.it.id] ? `<button type="button" class="fc-link" data-fr-reset="${esc(x.it.id)}">↺ % wala rate</button>` : ''}${rateDiff(x) ? (can ? `<button type="button" class="fc-go sm" data-fc-rate="${esc(x.it.id)}">Ye rate POS mein lagao</button>` : posOn() ? '<small class="lk-note">Rate sirf malik laga sakta hai</small>' : '<small class="lk-note">📱 POS band</small>') : '<small class="fc-ok">✓ POS mein yahi rate hai</small>'}</div></div>`).join('') || `<p class="lk-note">${rScope === 'raw' ? 'Raw maal nahi.' : 'Pehle formula / packing item banayein.'}</p>`}</div>
    ${posOn() ? '<p class="lk-note">Rate tab tak nahi badalta jab tak aap "lagao" na dabayein. PC 1 min mein POS mein lagata hai.</p>' : ''}</section>`;
}
async function applyRate(id) {
  if (!posOn()) { notice('📱 Factory sirf app mein — rate POS mein nahi jata (⚙️ mein POS ON)'); return; }
  const all = [...rateRows('tayyar'), ...rateRows('raw')], list = id === '*' ? rateRows(rScope).filter(rateDiff) : all.filter(x => x.it.id === String(id));
  if (!list.length) return;
  if (id === '*' && !confirm(list.length + ' items ke naye rate POS mein lagane hain?')) return;
  let ok = 0;
  for (const x of list) { const w = rateWant(x), it = x.it; const p = it.pack > 1 ? { wctn: w.wctn, wpcs: w.wpcs, rctn: w.rctn, rpcs: w.rpcs } : { wpcs: w.wpcs, rpcs: w.rpcs };
    try { stockAgentItemSave(it.id, p).then(r => { if (r && r.ok === false && !r.pending) notice(it.name + ': ' + (r.why || 'nakam')); }).catch(e => notice(it.name + ': ' + (e?.message || e))); ok++; delete rEd[it.id]; } catch (e) { notice(it.name + ': ' + (e?.message || e)); } }
  if (ok) { notice('✓ ' + ok + ' item ke rate PC ko bheje — 1 min mein POS mein'); paint(); }
}

// ---------- 📦 STOCK tab — v2.101 (malik: "factory ka stock yahan bhi, stock screen par na jana pare — same working") ----------
//   Raw maal + Ginti ek jagah: sab factory items (tayyar / packing item / packing maal / raw), stock, physical likho + Save (ginti, dobara =
//   edit), history, 🏷 label, ✏️ item, ➕ naya item, ⏳ PC baqi, 🧾 purchase, 🧾 ginti ka bill. Wahi stockCount docs — dono jagah ek saath.
let rq = '', gfl = 'sab', gOpen = new Set();
function rawRows() {
  const F = forms(), uses = new Map();
  for (const [fid, f] of Object.entries(F)) for (const l of f.lines || []) { const a = uses.get(String(l.id)) || []; a.push({ fid, q: Number(l.q) || 0 }); uses.set(String(l.id), a); }
  for (const p of packDefs()) for (const m of p.mats) { const a = uses.get(String(m.id)) || []; a.push({ fid: p.id, q: Number(m.q) || 0, pk: true }); uses.set(String(m.id), a); }
  return rawItems().map(x => { const u = uses.get(x.id) || []; const need = Math.max(0, ...u.filter(y => !y.pk).map(y => y.q)); return { x, u, need, kam: need > 0 && x.stock < need }; });
}
const rawKam = () => rawRows().filter(r => r.kam);
const kindOf = x => forms()[x.id] ? 'tayyar' : packOf(x.id) ? 'pkitem' : isMat(x.id) ? 'mat' : 'raw';
const KIND = { tayyar: '🧪 tayyar', pkitem: '🎁 packing item', mat: '📦 packing maal', raw: 'raw' };
const canCount = () => isOwner() || canOf('fac.ginti') || canOf('stock.count');
// v2.103.0: 📱 STOCK TAB — SIRF APP (factory ka apna stock; POS ginti / bill / PC baqi nahi)
const EVL = { aaya: '📥 Aaya', diya: '📤 Diya', ginti: '🔢 Ginti', bana: '🏭 Bana', laga: '🧪 Laga' };
function appStockTabHTML() {
  const R = new Map(rawRows().map(r => [r.x.id, r])), M = fStocks(), td = today();
  const all = items.filter(x => !isPend(x)).map(x => { const s = M.get(x.id); return { x, k: kindOf(x), s, r: R.get(x.id), gi: s?.ginti && dayOf(new Date(s.ginti.at)) === td ? s.ginti : null }; });
  const C = all.filter(y => y.gi), net = C.reduce((t, y) => t + (y.gi.q - (y.gi.sys || 0)) * rateOf(y.x.id, y.x), 0);
  const ids = rq.trim() ? new Set(srch(items, rq, 200).map(x => x.id)) : null;
  const L = all.filter(y => (!ids || ids.has(y.x.id)) && (gfl === 'sab' || (gfl === 'tayyar' ? y.k === 'tayyar' || y.k === 'pkitem' : gfl === 'raw' ? y.k === 'raw' : gfl === 'mat' ? y.k === 'mat' : gfl === 'minus' ? y.x.stock < 0 : gfl === 'kam' ? y.r?.kam : gfl === 'gine' ? !!y.gi : gfl === 'baqi' ? !y.gi : gfl === 'never' ? !y.s?.ginti : true)))
    .sort((a, b) => (b.r?.kam ? 1 : 0) - (a.r?.kam ? 1 : 0) || ['tayyar', 'pkitem', 'raw', 'mat'].indexOf(a.k) - ['tayyar', 'pkitem', 'raw', 'mat'].indexOf(b.k) || a.x.name.localeCompare(b.x.name));
  const n = k => all.filter(y => y.k === k).length, never = all.filter(y => !y.s?.ginti).length;
  const chips = [['sab', 'Sab ' + num(all.length)], ['tayyar', 'Tayyar ' + num(n('tayyar') + n('pkitem'))], ['raw', 'Raw ' + num(n('raw'))], ['mat', 'Packing ' + num(n('mat'))], ['minus', 'Minus ' + num(all.filter(y => y.x.stock < 0).length)], ['kam', 'Batch se kam ' + num(all.filter(y => y.r?.kam).length)], ['gine', 'Aaj gine ' + num(C.length)], ['baqi', 'Aaj baqi'], ['never', 'Kabhi nahi gine ' + num(never)]];
  return `<section class="ir-sec"><div class="ir-sh"><b>📦 Factory stock</b><small>📱 sirf app · POS mein kuch nahi</small></div>
    <div class="fc-sacts">${canMove() ? '<button type="button" class="fc-sa in" data-fm-open="aaya"><span>📥</span>Maal aaya</button><button type="button" class="fc-sa out" data-fm-open="diya"><span>📤</span>Maal diya</button>' : ''}${isOwner() ? '<button type="button" class="fc-sa" data-fc-newitem="1"><span>➕</span>Item jorein</button>' : ''}${goPurchase && (isOwner() || canOf('v:purchase')) ? '<button type="button" class="fc-sa" data-fc-pur="1"><span>🧾</span>Purchase</button>' : ''}</div>
    ${never && all.length ? `<div class="fc-alert"><span>🔢</span><div><b>${num(never)} item ki ginti kabhi nahi hui</b> — pehli dafa physical gin kar likhein, wahi se factory ka stock shuru (warna 0 se).</div><button type="button" data-fg-f="never">Dekhein</button></div>` : ''}
    ${C.length ? `<div class="ir-kp fc-gkp"><div><b>${num(C.length)}</b><small>aaj gine</small></div><div><b class="${net < 0 ? 'neg' : ''}">Rs ${net > 0 ? '+' : ''}${num(Math.round(net))}</b><small>farq (laagat)</small></div></div>` : ''}
    <div class="fc-chips">${chips.map(([k, l]) => `<button type="button" class="${gfl === k ? 'on' : ''}" data-fg-f="${k}">${l}</button>`).join('')}</div>
    <label class="hs-search"><input type="search" data-fc-rq="1" placeholder="🔍 item / barcode…" value="${esc(rq)}" autocomplete="off"></label>
    <div id="fcRqList">${L.slice(0, 150).map(appRow).join('') || '<p class="lk-note">Kuch nahi — ⚙️ mein ☑ Factory items chunein ya ➕ Item jorein.</p>'}</div></section>`;
}
function appRow({ x, k, s, r, gi }) {
  const pk = Number(x.pack) || 0, use = r?.u?.length ? (r.need ? r.u.filter(y => !y.pk).length + ' formula · 1 batch = ' + esc(qk(r.need, x)) : '') + (r.u.some(y => y.pk) ? (r.need ? ' · ' : '') + 'packing mein' : '') : '';
  const pd = packOf(x.id), f = gi ? r3(gi.q - (gi.sys || 0)) : 0, ev = s?.ev || [];
  return `<div class="fc-g${gi ? ' done' : ''}${r?.kam ? ' kam' : ''}"><div class="fc-gh"><div><b>${esc(x.name)}</b><small><i class="fc-kind k-${k}">${KIND[k]}</i>${isLoc(x) ? ' · 📱 sirf factory' : ''}${pd ? ' · ' + num(pd.g) + ' g ' + esc(byId.get(String(pd.src))?.name || '') : ''}${use ? ' · ' + use : ''}${rateOf(x.id, x) ? ' · ' + rs(rateOf(x.id, x)) + ' / ' + esc(un(x)) : ''}</small></div>
      <div class="fc-gst"><b class="${x.stock < 0 || r?.kam ? 'bad' : ''}">${esc(qk(x.stock, x))}</b><small>${r?.kam ? 'kam — 1 batch se kam' : r?.need ? '~' + num(Math.floor(Math.max(0, x.stock) / r.need)) + ' batch ka' : s?.ginti ? 'factory' : 'ginti nahi hui'}</small></div></div>
    ${gi ? `<div class="fc-gdone"><b class="${f < 0 ? 'bad' : f > 0 ? 'ok' : ''}">Gina ${esc(qk(gi.q, x))} · farq ${f > 0 ? '+' : ''}${esc(qk(f, x))}</b> · ${esc(clock(gi.at))}${gi.m?.byName ? ' · ' + esc(gi.m.byName) : ''}</div>` : ''}
    ${canMove() ? `<div class="fc-gin">${gOf(x.id) ? `<label class="fc-gkg">⚖️ Physical KG<input type="number" inputmode="decimal" min="0" step="any" data-fg-kg="${esc(x.id)}" placeholder="kg"></label>` : ''}${pk > 1 ? `<label>${esc(x.cn || 'Ctn')}<input type="number" inputmode="decimal" min="0" step="any" data-fg-ctn="${esc(x.id)}"></label>` : ''}<label>Physical ${esc(x.un || 'Pcs')}<input type="number" inputmode="decimal" min="0" step="any" data-fg-pcs="${esc(x.id)}"></label><button type="button" class="fc-gsave" data-fg-save="${esc(x.id)}">${gi ? '✏️ Save' : 'Save'}</button></div>${gOf(x.id) ? `<small class="fc-kgh" data-fg-kgh="${esc(x.id)}">1 ${esc(un(x))} = ${num(gOf(x.id))} g — kg likhein, ${esc(un(x))} khud ban jayenge</small>` : ''}` : ''}
    <div class="fc-gbtn">${ev.length ? `<button type="button" class="fc-link" data-fg-hist="${esc(x.id)}">🕘 history (${ev.length})${gOpen.has(x.id) ? ' ▴' : ' ▾'}</button>` : ''}${!isLoc(x) ? `<button type="button" class="fc-link" data-fc-lbl="${esc(x.id)}">🏷 Label</button>` : ''}${!isLoc(x) && stockCanItem().edit ? `<button type="button" class="fc-link" data-fc-item="${esc(x.id)}">✏️ Item</button>` : ''}</div>
    ${gOpen.has(x.id) && ev.length ? `<div class="fc-ghist">${ev.slice(-10).reverse().map(e => `<div><span>${esc(short(e.at))} · ${EVL[e.t] || e.t}${e.b ? ' ' + esc(e.b.no || '') : ''}${e.m?.note ? ' · ' + esc(e.m.note) : ''}${e.m?.byName ? ' · ' + esc(e.m.byName) : ''}</span><span>${e.t === 'ginti' ? 'gina ' + esc(qk(e.q, x)) : (e.t === 'diya' || e.q < 0 ? '−' : '+') + esc(qk(Math.abs(e.q), x))} → ${esc(qk(e.after, x))}</span>${e.m && isOwner() ? `<button type="button" class="fc-link" data-fm-del="${esc(e.m.id)}" aria-label="Hatao">✕</button>` : ''}</div>`).join('')}</div>` : ''}</div>`;
}
// 📥 MAAL AAYA / 📤 MAAL DIYA — list pehle se, ☑ tick, "N jorein", kg / ctn / pcs
function mvOpen(kind) {
  if (!canMove()) { notice('🔒 Ijazat nahi (malik: Settings → Mulazim)'); return; }
  watchApp(); mv = { kind, q: '', sel: {}, note: '', f: kind === 'aaya' ? 'raw' : 'tayyar', busy: false };
  dlg(kind === 'aaya' ? '📥 Maal aaya — factory mein' : '📤 Maal diya — factory se', '<div id="fcMv"><p class="lk-note">⏳ Items aa rahi hain…</p></div>');
  ensureItems().then(ok => { if (ok) mvPaint(); });
}
const mvTot = (id, v) => { const x = byId.get(id); if (!v) return 0; if (gOf(id) && Number(v.kg) > 0) return pcsOfKg(v.kg, id); return r3((Number(v.ctn) || 0) * (Number(x?.pack) || 0) + (Number(v.pcs) || 0)); };
function mvPaint(only) {
  const el = $('fcMv'); if (!el || !mv) return;
  const all = items.filter(x => !isPend(x) && (!posOn() || isLoc(x))), q = mv.q.trim(), sel = mv.sel, nSel = Object.keys(sel).length;
  const base = q ? srch(all, q, 300) : all.filter(x => mv.f === 'sab' || (mv.f === 'tayyar' ? ['tayyar', 'pkitem'].includes(kindOf(x)) : kindOf(x) === mv.f));
  const L = [...all.filter(x => sel[x.id] && !base.includes(x)), ...base].sort((a, b) => (sel[b.id] ? 1 : 0) - (sel[a.id] ? 1 : 0) || a.name.localeCompare(b.name));
  const tot = Object.keys(sel).filter(id => mvTot(id, sel[id]) > 0).length;
  const row = x => { const v = sel[x.id], pk = Number(x.pack) || 0, t = mvTot(x.id, v);
    return `<div class="fc-mvr${v ? ' is-in' : ''}"><label class="fc-pkl"><input type="checkbox" data-mv-tick="${esc(x.id)}"${v ? ' checked' : ''}><span><b>${esc(x.name)}</b><small>${KIND[kindOf(x)]} · stock ${esc(qk(x.stock, x))}</small></span></label>
      ${v ? `<div class="fc-gin">${gOf(x.id) ? `<label class="fc-gkg">KG<input type="number" inputmode="decimal" min="0" step="any" data-mv-q="${esc(x.id)}" data-mv-k="kg" value="${esc(v.kg ?? '')}"></label>` : ''}${pk > 1 ? `<label>${esc(x.cn || 'Ctn')}<input type="number" inputmode="decimal" min="0" step="any" data-mv-q="${esc(x.id)}" data-mv-k="ctn" value="${esc(v.ctn ?? '')}"></label>` : ''}<label>${esc(x.un || 'Pcs')}<input type="number" inputmode="decimal" min="0" step="any" data-mv-q="${esc(x.id)}" data-mv-k="pcs" value="${esc(v.pcs ?? '')}"></label></div>
      <small class="fc-kgh" data-mv-h="${esc(x.id)}">${t > 0 ? `= <b>${esc(qk(t, x))}</b> · stock ${mv.kind === 'aaya' ? 'ab' : 'baad'} ${esc(qk(r3(x.stock + (mv.kind === 'aaya' ? t : -t)), x))}` : 'miqdar likhein'}</small>` : ''}</div>`; };
  const html = `<p class="ir-say">${mv.kind === 'aaya' ? '📥 Factory mein jo maal <b>aaya</b> (khareeda / dukan se laya) — ☑ lagayein, miqdar likhein.' : '📤 Factory se jo maal <b>gaya</b> (dukan ko / party ko) — ☑ lagayein, miqdar likhein.'} Sirf app — POS mein kuch nahi.</p>
    <div class="fc-per fc-pf">${[['raw', 'Raw'], ['mat', 'Packing'], ['tayyar', 'Tayyar'], ['sab', 'Sab']].map(([k, l]) => `<button type="button" class="${mv.f === k ? 'on' : ''}" data-mv-f="${k}">${l}</button>`).join('')}</div>
    <label class="hs-search"><input type="search" data-mv-search="1" placeholder="🔍 item / barcode…" value="${esc(mv.q)}" autocomplete="off"></label>
    <div id="fcMvList">${L.slice(0, 200).map(row).join('') || '<p class="lk-note">Kuch nahi mila.</p>'}</div>
    <div id="fcMvFoot" class="fc-mvfoot"><label>Note (ikhtiyari)<input type="text" data-mv-note="1" maxlength="200" value="${esc(mv.note)}" placeholder="${mv.kind === 'aaya' ? 'jaise: Ali traders se · bill 512' : 'jaise: dukan ko · Zeeshan ne liya'}"></label>
      <button type="button" class="fc-ok-btn" data-mv-save="1"${!tot || mv.busy ? ' disabled' : ''}>${nSel ? `✓ ${num(tot)} item ${mv.kind === 'aaya' ? '📥 jorein' : '📤 minus karein'}` : '☑ Upar item chunein'}</button></div>`;
  if (only) { swapParts(el, html, only); return; }
  el.innerHTML = html;
}
async function mvSave() {
  if (!mv || mv.busy) return; const L = Object.entries(mv.sel).map(([id, v]) => ({ id, x: byId.get(id), q: mvTot(id, v) })).filter(y => y.x && y.q > 0);
  if (!L.length) { notice('Miqdar likhein'); return; }
  if (!cloud?.addFactoryMove) { notice('App update karein'); return; }
  if (mv.kind === 'diya') { const neg = L.filter(y => y.x.stock - y.q < -0.0005); if (neg.length && !confirm(`${neg.map(y => y.x.name).join(', ')} — factory stock se zyada!\nPhir bhi minus karein?`)) return; }
  mv.busy = true; const kind = mv.kind, note = mv.note.trim(); let ok = 0;
  for (const y of L) { try { const r = cloud.addFactoryMove({ itemId: y.id, name: y.x.name, kind, q: y.q, note, byName: whoOf() || '', day: today() }); moves = [...moves, { id: r.id, itemId: y.id, name: y.x.name, kind, q: y.q, note, byName: whoOf() || '', at: Date.now(), day: today() }]; ok++; Promise.resolve(r.done).catch(e => notice('❌ ' + y.x.name + ' save nahi hua: ' + (e?.message || e))); } catch (e) { notice('❌ ' + (e?.message || e)); } }
  fsCache = null; mv = null; $('dialog')?.close(); loadItemsQuiet(); repaint();
  notice(`✓ ${num(ok)} item ${kind === 'aaya' ? '📥 factory stock mein jor diye' : '📤 factory stock se minus'}`);
}
function stockTabHTML() {
  if (!posOn()) return appStockTabHTML();   // v2.103.0
  stockCountsOn(); const S = stockCountState(), see = S.see !== false, R = new Map(rawRows().map(r => [r.x.id, r])), hasLocIt = items.some(x => isLoc(x));
  const all = items.filter(x => !isPend(x)).map(x => ({ x, k: kindOf(x), i: stockCountInfo(x.id), r: R.get(x.id) }));
  const C = all.filter(y => y.i?.c), net = C.reduce((t, y) => t + (y.i.rs || 0), 0), w = C.filter(y => y.i.bill?.k === 'baqi' || y.i.bill?.k === 'part').length;
  const ids = rq.trim() ? new Set(srch(items, rq, 200).map(x => x.id)) : null;
  const L = all.filter(y => (!ids || ids.has(y.x.id)) && (gfl === 'sab' || (gfl === 'tayyar' ? y.k === 'tayyar' || y.k === 'pkitem' : gfl === 'raw' ? y.k === 'raw' : gfl === 'mat' ? y.k === 'mat' : gfl === 'minus' ? y.x.stock < 0 : gfl === 'kam' ? y.r?.kam : gfl === 'gine' ? !!y.i?.c : gfl === 'baqi' ? !y.i?.c : gfl === 'farq' ? y.i?.c && y.i.farq !== 0 : true)))
    .sort((a, b) => (b.r?.kam ? 1 : 0) - (a.r?.kam ? 1 : 0) || ['tayyar', 'pkitem', 'raw', 'mat'].indexOf(a.k) - ['tayyar', 'pkitem', 'raw', 'mat'].indexOf(b.k) || a.x.name.localeCompare(b.x.name));
  const ic = stockIjCounts(), ci = stockCanItem(), n = k => all.filter(y => y.k === k).length;
  const chips = [['sab', 'Sab ' + num(all.length)], ['tayyar', 'Tayyar ' + num(n('tayyar') + n('pkitem'))], ['raw', 'Raw ' + num(n('raw'))], ['mat', 'Packing ' + num(n('mat'))], ...(see ? [['minus', 'Minus ' + num(all.filter(y => y.x.stock < 0).length)], ['kam', 'Batch se kam ' + num(all.filter(y => y.r?.kam).length)]] : []), ['gine', 'Gine ' + num(C.length)], ['baqi', 'Ginti baqi'], ...(see ? [['farq', 'Farq wale']] : [])];
  return `<section class="ir-sec"><div class="ir-sh"><b>📦 Factory stock</b><small>dukan godam · ${S.round ? 'ginti ' + (S.autoOn ? 'aaj' : esc(S.round)) : 'ginti band'}</small></div>
    <div class="fc-sacts">${ci.add ? '<button type="button" class="fc-sa" data-fc-newitem="1"><span>➕</span>Item jorein</button>' : ''}${ic.pend || ic.bad ? `<button type="button" class="fc-sa warn" data-fc-ijobs="1"><span>⏳</span>${num(ic.pend)} PC baqi${ic.bad ? ' · ❌ ' + num(ic.bad) : ''}</button>` : ''}${goPurchase && (isOwner() || canOf('v:purchase')) ? '<button type="button" class="fc-sa" data-fc-pur="1"><span>🧾</span>Purchase</button>' : ''}${S.owner ? `<button type="button" class="fc-sa" data-fg-bills="1"><span>📋</span>Ginti bill${w ? ' · ' + num(w) : ''}</button>` : ''}</div>
    ${see && C.length ? `<div class="ir-kp fc-gkp"><div><b>${num(C.length)}</b><small>aaj gine</small></div><div><b class="${net < 0 ? 'neg' : ''}">Rs ${net > 0 ? '+' : ''}${num(net)}</b><small>farq</small></div><div><b>${num(w)}</b><small>bill baqi</small></div></div>` : ''}
    ${!S.round && canCount() ? `<div class="fc-alert"><span>⏳</span><div>Ginti abhi shuru nahi — ${S.owner ? 'Stock screen ⚙️ mein <b>"📅 Session = din"</b> ON karein.' : 'malik shuru kare.'}</div></div>` : S.locked ? '<div class="fc-alert bad"><span>🔴</span><div>Malik ne counting band ki hui hai.</div></div>' : ''}
    <div class="fc-chips">${chips.map(([k, l]) => `<button type="button" class="${gfl === k ? 'on' : ''}" data-fg-f="${k}">${l}</button>`).join('')}</div>
    <label class="hs-search"><input type="search" data-fc-rq="1" placeholder="🔍 item / barcode…" value="${esc(rq)}" autocomplete="off"></label>
    ${hasLocIt ? `<div class="fc-sacts fc-locacts"><small>📱 Sirf factory maal (khula tail jaisa — POS mein nahi):</small>${canMove() ? '<button type="button" class="fc-sa in" data-fm-open="aaya"><span>📥</span>Maal aaya</button><button type="button" class="fc-sa out" data-fm-open="diya"><span>📤</span>Maal diya</button>' : ''}</div>` : ''}
    <div id="fcRqList">${L.slice(0, 120).map(y => isLoc(y.x) ? locRowPos(y) : sRow(y, S)).join('') || '<p class="lk-note">Kuch nahi — ⚙️ mein ☑ Factory items chunein ya ➕ Naya item.</p>'}</div></section>`;
}
// v2.103.7: POS mode mein 📱 sirf factory item — app wali row (ginti / 📥 / history = factoryMoves + batch)
function locRowPos({ x, k, r }) { const s = fStocks().get(String(x.id)), td = today(), gi = s?.ginti && dayOf(new Date(s.ginti.at)) === td ? s.ginti : null; return appRow({ x, k, s, r, gi }); }
function sRow({ x, k, i, r }, S) {
  const see = S.see !== false, pk = Number(x.pack) || 0, c = i?.c, f = i?.farq || 0, kk = c ? (f < 0 ? 'bad' : f > 0 ? 'ok' : '') : '', bi = i?.bill || { k: 'none' };
  const use = r?.u?.length ? (r.need ? r.u.filter(y => !y.pk).length + ' formula · 1 batch = ' + esc(qk(r.need, x)) : '') + (r.u.some(y => y.pk) ? (r.need ? ' · ' : '') + 'packing mein' : '') : '';
  const pd = packOf(x.id);
  return `<div class="fc-g${c ? ' done' : ''}${r?.kam ? ' kam' : ''}"><div class="fc-gh"><div><b>${esc(x.name)}</b><small><i class="fc-kind k-${k}">${KIND[k]}</i>${pd ? ' · ' + num(pd.g) + ' g ' + esc(byId.get(String(pd.src))?.name || '') : ''}${use ? ' · ' + use : ''}${see && rateOf(x.id, x) ? ' · ' + rs(rateOf(x.id, x)) + ' / ' + esc(un(x)) : ''}</small></div>
      ${see ? `<div class="fc-gst"><b class="${x.stock < 0 || r?.kam ? 'bad' : ''}">${esc(qk(x.stock, x))}</b><small>${r?.kam ? 'kam — 1 batch se kam' : r?.need ? '~' + num(Math.floor(Math.max(0, x.stock) / r.need)) + ' batch ka' : 'system'}</small></div>` : ''}</div>
    ${c ? `<div class="fc-gdone">${see ? `<b class="${kk}">Gina ${gOf(x.id) ? esc(qk(i.total, x)) : num(i.total)} · farq ${f > 0 ? '+' : ''}${gOf(x.id) ? esc(qk(f, x)) : num(f)}</b>${i.rs ? ' · Rs ' + (i.rs > 0 ? '+' : '') + num(i.rs) : ''} · ${bi.k === 'done' ? '✓ ' + esc(bi.no) : bi.k === 'part' ? esc(bi.no) + ' · baqi' : bi.k === 'baqi' ? 'bill baqi' : 'barabar'}` : `<b>✓ Gina ${gOf(x.id) ? esc(qk(i.total, x)) : num(i.total)}</b>`} · ${esc(clock(i.at))}${i.byName ? ' · ' + esc(i.byName) : ''}</div>` : ''}
    ${S.round && !S.locked && canCount() ? `<div class="fc-gin">${gOf(x.id) ? `<label class="fc-gkg">⚖️ Physical KG<input type="number" inputmode="decimal" min="0" step="any" data-fg-kg="${esc(x.id)}" value="${c && Number(c.pcs) && !Number(c.ctn) ? esc(String(kgOf(c.pcs, x.id))) : ''}" placeholder="kg"></label>` : ''}${pk > 1 ? `<label>${esc(x.cn || 'Ctn')}<input type="number" inputmode="decimal" min="0" step="any" data-fg-ctn="${esc(x.id)}" value="${c ? esc(String(c.ctn ?? '')) : ''}"></label>` : ''}<label>Physical ${esc(x.un || 'Pcs')}<input type="number" inputmode="decimal" min="0" step="any" data-fg-pcs="${esc(x.id)}" value="${c ? esc(String(c.pcs ?? '')) : ''}"></label><button type="button" class="fc-gsave" data-fg-save="${esc(x.id)}">${c ? '✏️ Save' : 'Save'}</button></div>${gOf(x.id) ? `<small class="fc-kgh" data-fg-kgh="${esc(x.id)}">1 ${esc(un(x))} = ${num(gOf(x.id))} g — kg likhein, ${esc(un(x))} khud ban jayenge</small>` : ''}` : ''}
    <div class="fc-gbtn">${c ? `<button type="button" class="fc-link" data-fg-hist="${esc(x.id)}">🕘 history (${i.hist.length})${gOpen.has(x.id) ? ' ▴' : ' ▾'}</button>` : ''}${isLoc(x) ? (isOwner() ? `<button type="button" class="fc-go sm" data-fe-locpos="${esc(x.id)}">📱 sirf factory · 🖥 POS mein banayein</button>` : '<small>📱 sirf factory</small>') : `<button type="button" class="fc-link" data-fc-lbl="${esc(x.id)}">🏷 Label</button>${stockCanItem().edit ? `<button type="button" class="fc-link" data-fc-item="${esc(x.id)}">✏️ Item</button>` : ''}`}</div>
    ${c && gOpen.has(x.id) ? `<div class="fc-ghist">${i.hist.slice(-6).reverse().map(h => `<div><span>${esc(short(h.at))}${h.tick ? ' ✓ tick' : ''}</span><span>gina ${num(h.total)}${see ? ' · system ' + num(h.sys) : ''}</span>${see ? `<b class="${h.total - h.sys < 0 ? 'bad' : h.total - h.sys > 0 ? 'ok' : ''}">${h.total - h.sys > 0 ? '+' : ''}${num(r2(h.total - h.sys))}</b>` : ''}</div>`).join('')}${S.owner && bi.k !== 'done' ? `<button type="button" class="fc-link" data-fg-del="${esc(x.id)}">🗑 ginti hatao</button>` : ''}</div>` : ''}</div>`;
}
async function gSave(id, btn) {
  const row = btn.closest('.fc-g'), v = { ctn: row.querySelector('[data-fg-ctn]')?.value, pcs: row.querySelector('[data-fg-pcs]')?.value };
  if ((v.ctn ?? '') === '' && (v.pcs ?? '') === '') { notice('Physical ginti likhein'); return; }
  const x = byId.get(String(id)); if (Number(v.ctn || 0) + Number(v.pcs || 0) === 0 && !confirm(`"${x?.name}" ki ginti ZERO save karein?`)) return;
  btn.disabled = true;
  if (!posOn() || isLoc(x)) {   // v2.103.0: ginti = factory ka stock (POS mein nahi) · v2.103.7: POS mode mein 📱 sirf factory item bhi
    const q = r3((Number(v.ctn) || 0) * (Number(x?.pack) || 0) + (Number(v.pcs) || 0)), sys = fStock(id);
    try { const r = cloud.addFactoryMove({ itemId: String(id), name: x?.name || '', kind: 'ginti', q, sys, byName: whoOf() || '', day: today() });
      moves = [...moves, { id: r.id, itemId: String(id), name: x?.name || '', kind: 'ginti', q, sys, byName: whoOf() || '', at: Date.now(), day: today() }]; fsCache = null; loadItemsQuiet();
      notice(`✓ ${x?.name || ''} — gina ${qk(q, x)} · farq ${q - sys > 0 ? '+' : ''}${qk(r3(q - sys), x)}`); paint();
      Promise.resolve(r.done).catch(e => notice('❌ Ginti save nahi hui: ' + (e?.message || e))); }
    catch (e) { notice('⚠️ ' + (e?.message || e)); btn.disabled = false; }
    return; }
  try { const t = await stockCountSet(id, v); notice(`✓ ${x?.name || ''} — ${num(t)} ${un(x)}`); setTimeout(() => paint(), 250); }
  catch (e) { notice('⚠️ ' + (e?.message || e)); btn.disabled = false; }
}

// v2.103.0: 🔌 sirf app / POS mein bhi (sirf malik)
async function setPosOn(on) {
  if (!isOwner() || !cloud?.setFactoryCfg) { notice('Sirf malik'); return; }
  if (on === posOn()) return;
  if (!confirm(on ? 'POS mein bhi? Naye batch POS stock badlenge, ginti / naya item / rate POS mein jayenge (purana tareeqa).' : 'Factory sirf app mein? Ab se batch / ginti / maal aaya-diya / naye item sab app mein — POS mein kuch nahi jayega. Factory ka stock pehli ginti se shuru hoga.')) return;
  cfg = { ...(cfg || {}), posOn: on }; fsCache = null; loadItemsQuiet(); setPaint(); repaint();
  try { await cloud.setFactoryCfg({ posOn: on }); notice(on ? '🖥 Factory: POS mein bhi' : '📱 Factory: sirf app — POS mein kuch nahi'); }
  catch (e) { cfg = { ...(cfg || {}), posOn: !on }; loadItemsQuiet(); setPaint(); repaint(); notice('Save nahi hua: ' + (e?.message || e)); }
}
// v2.103.0: ➕ NAYA ITEM — SIRF FACTORY (POS mein nahi): cfg.local {lid: {n, un, pk, r, at}} · g = 1 pcs ka wazan (cfg.conv) · 📦 = packing maal
let fl = null;
function locForm(q0) {
  if (!isOwner()) { notice('Naya item sirf malik'); return; }
  fl = { n: String(q0 || ''), un: 'Pcs', pk: '', r: '', g: '', mat: false, busy: false };
  dlg('➕ Naya item — sirf factory', '<div id="fcLoc"></div>'); locPaint(); setTimeout(() => document.querySelector('#fcLoc [data-fl-n="n"]')?.focus(), 60);
}
function locPaint() {
  const el = $('fcLoc'); if (!el || !fl) return; const nm = fold(fl.n || ''), dup = nm ? items.filter(x => fold(x.name) === nm) : [];
  el.innerHTML = `<p class="ir-say">📱 Ye item <b>sirf factory app</b> mein banega — POS mein nahi jayega (raw maal / packing ke liye). Dukan par bechni ho to Stock screen se POS item banayein.</p>
    <label>Naam<input type="text" data-fl-n="n" maxlength="80" value="${esc(fl.n)}" placeholder="jaise: Coco batain"></label>
    ${dup.length ? `<p class="fc-alert"><span>⚠️</span>"${esc(dup[0].name)}" factory mein pehle se hai — dobara mat banayein.</p>` : ''}
    <div class="fc-lab">KIS MEIN GINTE HAIN?</div><div class="fc-lbl">${['Pcs', 'Kg', 'Ltr'].map(u => `<button type="button" class="${fl.un === u ? 'on' : ''}" data-fl-un="${u}">${u}</button>`).join('')}</div>
    <div class="fc-two"><label>Khareed rate (Rs fi ${esc(fl.un)})<input type="number" inputmode="decimal" min="0" step="any" data-fl-n="r" value="${esc(fl.r)}"></label><label>Ctn mein kitne (ikhtiyari)<input type="number" inputmode="decimal" min="0" step="1" data-fl-n="pk" value="${esc(fl.pk)}"></label></div>
    ${fl.un === 'Pcs' ? `<label>1 pcs ka wazan gram (ikhtiyari — formula kg mein)<input type="number" inputmode="decimal" min="0" step="any" data-fl-n="g" value="${esc(fl.g)}" placeholder="jaise 200"></label>` : ''}
    <label class="fc-posr"><input type="checkbox" data-fl-mat="1"${fl.mat ? ' checked' : ''}> <span>📦 Packing maal hai<small>bottle / dhakan / bag / label</small></span></label>
    <button type="button" class="fc-ok-btn" data-fl-save="1"${fl.busy ? ' disabled' : ''}>✓ Factory mein banayein</button>`;
}
function locNew(name, r, extra = {}) {   // naya 'loc:' item — cfg patch wapas (save bahar)
  const lid = 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), v = { n: String(name).trim().slice(0, 80), un: extra.un || 'Pcs', ...(Number(extra.pk) > 1 ? { pk: Math.floor(Number(extra.pk)) } : {}), ...(Number(r) > 0 ? { r: r2(r) } : {}), at: Date.now() };
  const id = 'loc:' + lid, patch = { local: { [lid]: v }, ...(Number(extra.g) > 0 ? { conv: { [id]: r2(extra.g) } } : {}), ...(extra.mat ? { pack: { [id]: true } } : {}) };
  cfg = { ...(cfg || {}), local: { ...(cfg?.local || {}), [lid]: v }, ...(patch.conv ? { conv: { ...(cfg?.conv || {}), ...patch.conv } } : {}), ...(patch.pack ? { pack: { ...(cfg?.pack || {}), ...patch.pack } } : {}) };
  return { id, patch };
}
async function locSave() {
  if (!fl || fl.busy) return; const n = String(fl.n || '').trim(); if (!n) { notice('Naam likhein'); return; }
  if (items.some(x => fold(x.name) === fold(n)) && !confirm(`"${n}" factory mein pehle se hai — phir bhi naya banayein?`)) return;
  fl.busy = true; const { id, patch } = locNew(n, fl.r, { un: fl.un, pk: fl.pk, g: fl.un === 'Pcs' ? fl.g : 0, mat: fl.mat });
  loadItemsQuiet(); repaint();
  try { await cloud.setFactoryCfg(patch); notice('✓ ' + n + ' — sirf factory mein bana (POS mein nahi)'); fl = null; $('dialog')?.close(); }
  catch (e) { fl.busy = false; locPaint(); notice('Save nahi hua: ' + (e?.message || e)); }
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
    <section class="ir-sec"><div class="ir-sh"><b>🔌 Factory ka data</b></div><div class="fc-lbl"><button type="button" class="${!posOn() ? 'on' : ''}" data-fc-poson="0">📱 Sirf app (POS mein kuch nahi)</button><button type="button" class="${posOn() ? 'on' : ''}" data-fc-poson="1">🖥 POS mein bhi</button></div><small class="fc-lnote">${posOn() ? 'Abhi: batch POS stock badalta hai, ginti / naya item / rate POS mein jate hain (purana tareeqa).' : 'Abhi: batch, ginti, 📥 maal aaya / 📤 diya, naye item, rate — sab sirf app mein. POS se sirf items (naam, code, rate) aate hain. Factory ka stock app ka apna.'}</small></section>
    ${posOn() ? `<section class="ir-sec"><div class="ir-sh"><b>Batch OK ke baad</b></div><div class="fc-lbl"><button type="button" class="${!cfg?.autoSend ? 'on' : ''}" data-fc-autosend="0">📝 App mein ruke — 📤 bhejo par POS</button><button type="button" class="${cfg?.autoSend ? 'on' : ''}" data-fc-autosend="1">⚡ Seedha POS mein</button></div><small class="fc-lnote">Ruka hua batch: edit / cancel foran; POS mein jane ke baad sirf "wapas + naya".</small></section>` : ''}
    <section class="ir-sec"><div class="ir-sh"><b>🖨 ${posOn() ? 'POS mein jane par parchi' : 'Batch ki parchi (sirf printer — POS nahi)'}</b><small>server printer</small></div><div class="fc-lbl">${[[2, '2 copy (factory + munshi)'], [1, '1 copy'], [0, 'Band']].map(([k, l]) => `<button type="button" class="${prnN() === k ? 'on' : ''}" data-fc-prn="${k}">${l}</button>`).join('')}</div><small class="fc-lnote">Parchi par: kya bana, kitna raw / packing maal laga, ${posOn() ? 'POS' : 'factory'} mein ab kitna baqi, kam pad gaya to ⚠️.</small></section>
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
  const list = srch(all.filter(x => (pk.f === 'on' ? isOn(x) : pk.f === 'cat' ? x.catFac : true)), q, 400)
    .sort((a, b) => (isOn(b) ? 1 : 0) - (isOn(a) ? 1 : 0) || a.name.localeCompare(b.name));
  const nOn = all.filter(isOn).length;
  const html = `<p class="ir-say">Jis item par <b>☑</b> lagayein wo factory mein aa jayegi — formula wali = <b>tayyar maal</b>, baqi = <b>raw maal</b>. <b>📦</b> = packing maal (bag / pouch / dakan) — rate POS ki purchase se khud.</p>
    <div class="fc-per fc-pf">${[['sab', 'Sab (' + num(all.length) + ')'], ['on', '☑ Chuni hui (' + num(nOn) + ')'], ['cat', 'Category wali (' + num(all.filter(x => x.catFac).length) + ')']].map(([k, l]) => `<button type="button" class="${pk.f === k ? 'on' : ''}" data-fp-f="${k}">${l}</button>`).join('')}</div>
    <label class="hs-search"><input type="search" data-fc-pq="1" placeholder="🔍 naam ya barcode…" value="${esc(pk.q)}" autocomplete="off"></label>
    <div id="fcPickList">${pendList().map(p => `<div class="fc-pk pk-on"><span>⏳</span><span><b>${esc(p.n)}</b><small>PC baqi — formula / batch abhi; POS mein bante hi asli item se jur jayega</small></span></div>`).join('')}
    <div class="fc-picks">${list.slice(0, pk.lim).map(x => `<div class="fc-pk${isOn(x) ? ' pk-on' : ''}"><label class="fc-pkl"><input type="checkbox" data-fac-tick="${esc(x.id)}"${isOn(x) ? ' checked' : ''}><span><b>${esc(x.name)}</b><small>${esc(x.cat || '—')} · stock ${esc(qt(x.stock, x))}${F[x.id] ? ' · 🧪 formula' : ''}${packOf(x.id) ? ' · 🎁 packing item' : ''}</small></span></label><label class="fc-pkm${isMat(x.id) ? ' on' : ''}" title="Packing material"><input type="checkbox" data-fac-mat="${esc(x.id)}"${isMat(x.id) ? ' checked' : ''}>📦</label></div>`).join('') || '<p class="lk-note">Kuch nahi mila.</p>'}</div>
    ${list.length > pk.lim ? `<button type="button" class="fc-no" data-fp-more="1">Aur dikhao (${num(list.length - pk.lim)})</button>` : ''}</div>`;
  if (only) { swapParts(el, html, only); return; }
  el.innerHTML = html;
}
async function matToggle(id, on, box) {   // v2.101: 📦 packing material tick
  if (!isOwner() || !cloud?.setFactoryCfg) { if (box) box.checked = !on; notice('Sirf malik'); return; }
  const isIn = items.some(x => x.id === String(id)), patch = { pack: { [String(id)]: on ? true : null }, ...(on && !isIn ? { items: { [String(id)]: true } } : {}) };
  cfg = { ...(cfg || {}), pack: { ...(cfg?.pack || {}), [String(id)]: on ? true : null }, ...(patch.items ? { items: { ...(cfg?.items || {}), ...patch.items } } : {}) };
  loadItemsQuiet(); repaint(); if ($('fcPick')) pickPaint(); if ($('fcPkDef')) pkDefPaint(); if ($('fcAdd')) addPaint(true);
  try { await cloud.setFactoryCfg(patch); } catch (e) { if (box) box.checked = !on; notice('Save nahi hua: ' + (e?.message || e)); }
}
async function facToggle(id, on, box) {
  if (!isOwner() || !cloud?.setFactoryCfg) { if (box) box.checked = !on; notice('Sirf malik'); return; }
  let cat = false; try { const x = stockPickList().find(y => y.id === String(id)); cat = !!x?.catFac; } catch {}
  if (!on && forms()[String(id)] && !confirm('Is item ka formula bana hua hai — factory se hatana hai?')) { if (box) box.checked = true; return; }
  const v = on ? (cat ? null : true) : (cat || doneReal.has(String(id)) ? false : null), prev = cfg?.items?.[String(id)];
  cfg = { ...(cfg || {}), items: { ...(cfg?.items || {}), [String(id)]: v } };   // foran (tez)
  loadItemsQuiet(); repaint(); if ($('fcPick')) pickPaint(); if ($('fcAdd')) addPaint(true); try { stockRepaint(); } catch {}
  try { await cloud.setFactoryCfg({ items: { [String(id)]: v } }); }
  catch (e) { cfg = { ...(cfg || {}), items: { ...(cfg?.items || {}), [String(id)]: prev ?? null } }; loadItemsQuiet(); repaint(); if ($('fcPick')) pickPaint(); notice('Save nahi hua: ' + (e?.message || e)); }
}

// ---------- v2.101.6: ➕ ITEM JOREIN (malik: "naya item mein agar pehle se koi item ho to kaise select karein, do baar add ho jayegi") ----------
//   Pehle POS ki saari items mein dhoondo (naam spelling-maafi / barcode / 📷 scan). Mil jaye = ☑ Factory / 📦 Packing (wahi asli item,
//   cfg.items / cfg.pack — sirf malik). Na mile = "➕ Naya item banayein" (naam pehle se bhara; form khud bhi dohra jaanchta hai).
let fa = null;
const facIsOn = x => { const v = cfg?.items?.[x.id]; return v === true || (v !== false && (x.catFac || doneReal.has(x.id))); };
async function openAdd(q0 = '') {
  watchCfg(); fa = { q: String(q0 || '') };
  dlg('➕ Item jorein', '<div id="fcAdd"><p class="lk-note">⏳ Items aa rahi hain…</p></div>');
  if (!(await ensureItems())) return; addPaint(); setTimeout(() => { const i = document.querySelector('[data-fa-q]'); if (i) { i.focus(); try { i.setSelectionRange(i.value.length, i.value.length); } catch {} } }, 60);
}
function addListHTML() {
  let all = []; try { all = stockPickList(); } catch {}
  const q = fa.q.trim(), ci = stockCanItem(), own = isOwner();
  if (!q) return '<p class="lk-note">Naam ya barcode likhein (ya 📷 scan) — POS mein pehle se ho to yahin mil jayegi.</p>';
  const byCode = all.filter(x => x.code && x.code === q), L = byCode.length && /^\d{3,}$/.test(q) ? byCode : [...byCode, ...srch(all, q, 30).filter(x => !byCode.includes(x))].slice(0, 30);
  return (L.length ? `<p class="fc-acnt">🔎 <b>${num(L.length)}</b> POS mein pehle se — naya mat banayein, inhi mein se chunein:</p><div class="fc-alist">${L.map(x => { const on = facIsOn(x), mat = !!cfg?.pack?.[x.id];
      return `<div class="fc-arow${on ? ' is-in' : ''}${byCode.includes(x) ? ' code' : ''}"><span><b>${esc(x.name)}</b><small>${x.code ? '🏷 ' + esc(x.code) + ' · ' : ''}stock ${esc(qt(x.stock, x))}${x.cat ? ' · ' + esc(x.cat) : ''}${byCode.includes(x) ? ' · <i>wahi barcode</i>' : ''}</small></span><span class="fc-abtn">${on ? `<i class="fc-aok">✓ Factory mein${mat ? ' · 📦' : ''}</i>${own && !mat ? `<button type="button" data-fa-mat="${esc(x.id)}">📦</button>` : ''}` : own ? `<button type="button" class="pri" data-fa-on="${esc(x.id)}">☑ Factory</button><button type="button" data-fa-mat="${esc(x.id)}">📦 Packing</button>` : '<small>malik factory mein jorega</small>'}</span></div>`; }).join('')}</div>`
    : `<div class="fc-anone">✓ "${esc(q)}" — POS mein aisi koi item nahi mili.</div>`)
    + (!posOn() ? (own ? `<button type="button" class="fc-anew${L.length ? '' : ' big'}" data-fa-loc="1">➕ ${L.length ? 'Phir bhi naya' : 'Naya'} item — sirf factory (POS mein nahi): "${esc(q)}"</button>` : '<p class="lk-note">🔒 Naya item — malik banayega.</p>')
    : ci.add ? `<button type="button" class="fc-anew${L.length ? '' : ' big'}" data-fa-new="1">➕ ${L.length ? 'Phir bhi naya item banayein' : 'Naya item banayein'}: "${esc(q)}"</button>` : '<p class="lk-note">🔒 Naya item — malik ki ijazat chahiye.</p>');
}
function addPaint(onlyList) {
  const el = $('fcAdd'); if (!el || !fa) return;
  if (onlyList && $('fcAddList')) { $('fcAddList').innerHTML = addListHTML(); return; }
  el.innerHTML = `<p class="ir-say">Pehle <b>dhoondein</b> — item POS mein pehle se ho to <b>☑ Factory</b> (ya <b>📦 Packing</b>) dabayein, wahi item jur jayegi. Na mile tab neeche <b>➕ Naya</b>.</p>
    <div class="fc-aq"><label class="hs-search"><input type="search" data-fa-q="1" placeholder="🔍 naam ya barcode…" value="${esc(fa.q)}" autocomplete="off"></label><button type="button" class="fc-ascan" data-fa-scan="1" aria-label="Barcode scan">📷</button></div>
    <div id="fcAddList">${addListHTML()}</div>`;
}
window.ntFacAdd = async (id, pkg) => { if (!isOwner()) { notice('Factory mein jorna sirf malik'); return false; } watchCfg(); if (pkg) await matToggle(id, true); else await facToggle(id, true); return true; };   // pos-stock item form "Yahi chunein"

// ---------- ➕ naya batch (larka) — 3 qadam ----------
export async function openBatch(editId, mode) {
  watch();
  if (!canFacBatch()) { notice('🔒 Batch ki ijazat nahi (malik: Settings → Mulazim)'); return; }
  const eb = editId ? batches.find(x => x.id === editId) : null;
  if (eb?.kind === 'pack') mode = 'pack';
  dlg(eb ? '✏️ Edit — ' + eb.no : mode === 'pack' ? '🎁 Packing (bulk se)' : '🏭 Naya batch', '<div id="fcBatch"><p class="lk-note">⏳ Items aa rahi hain…</p></div>');
  const ok = await ensureItems(); if (!ok) { const el = $('fcBatch'); if (el) el.innerHTML = `<p class="ir-say">Stock load nahi hua: ${esc(itemsErr)}</p>`; return; }
  const fin = finished(), canSend = isOwner() || canOf('fac.send');
  const send0 = canSend && !!cfg?.autoSend;
  if (eb) { const f = forms()[String(eb.itemId)], made = r3((Number(eb.out) || 0) + (eb.outs || []).reduce((t, o) => { const p = packOf(o.id); return t + (p ? r3(o.q * packUnit(p)) : 0); }, 0));
    fb = { mode: mode === 'pack' ? 'pack' : 'make', id: String(eb.itemId), n: Number(eb.n) || 1, real: mode !== 'pack' && f && Math.abs((Number(f.per) || 0) * (Number(eb.n) || 1) - made) > 0.001 ? made : '', pk: Object.fromEntries((eb.outs || []).map(o => [String(o.id), Number(o.q) || 0])),
      lbl: (eb.labels || []).length ? ((eb.labels || []).some(l => l.qty > 1) ? ((eb.labels || []).some(l => !(l.qty > 1)) ? 'both' : 'ctn') : 'pcs') : 'none', busy: false, more: true, edit: eb, send: false, self: f && (Number(f.ml) > 0 || selfMats(f).length) ? Number(eb.out) || 0 : '' };
    if (fb.self !== '') fb.real = ''; }   // v2.102.0: bhara wala batch — bana formula jitna (bacha khula alag)
  else if (mode === 'pack') { const S = packSrcs(); fb = { mode: 'pack', id: S.length === 1 ? S[0] : '', n: 1, real: '', pk: {}, lbl: cfg?.lbl || 'pcs', busy: false, more: false, send: send0 }; }
  else fb = { mode: 'make', id: fin.length === 1 ? fin[0].id : (fb?.id && forms()[fb.id] ? fb.id : ''), n: 1, real: '', pk: {}, self: '', lbl: cfg?.lbl || 'pcs', busy: false, more: false, send: send0 };
  try { if (!fb.edit && localStorage.getItem('sam-fc-bc') === '0') { fb.lbl0 = fb.lbl; fb.lbl = 'none'; } } catch {}   // v2.103.42: pichhli dafa 'Nahi' tha
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
  if ((mode === 'pcs' || mode === 'both') && main && out > 0) out2.push({ itemId: it.id, code: main.code, name: it.name, qty: main.qty || 1, rate: main.price || it.rate2, copies: Math.round(out / (main.qty || 1)) });
  if ((mode === 'ctn' || mode === 'both') && ctn && nC > 0) out2.push({ itemId: it.id, code: ctn.code, name: it.name, qty: ctn.qty, rate: ctn.price, copies: nC });
  return out2;
}
const stepn = (n, t, s) => `<div class="fc-stepn"><span>${n}</span><b>${t}</b>${s ? `<small>${s}</small>` : ''}</div>`;
// batch ka poora hisaab (form, OK aur test sab isi se) — make: formula × n (+ packing) · pack: bulk stock se packing
function batchCalc() {
  const F = forms(), it = byId.get(fb.id); if (!it) return null;
  if (fb.mode === 'pack') {
    const k = packCalc(it.id, fb.pk), bc = bulkCpp(it.id), avail = Number(it.stock) || 0;
    const lines = [...(k.used > 0 ? [{ id: it.id, name: it.name, it, q: k.used, c: bc, stock: avail }] : []), ...[...k.mats].map(([id, q]) => { const m = byId.get(id); return { id, name: m?.name || id, it: m, q, c: rateOf(id, m), stock: Number(m?.stock) || 0 }; })];
    const total = lines.reduce((t, l) => t + l.q * l.c, 0);
    return { it, f: null, k, made: 0, out: 0, rem: 0, lines, oh: 0, total, avail, over: false, kam: lines.filter(l => l.stock < l.q) };
  }
  const f = F[it.id]; if (!f) return null;
  const c = costOf(f, fb.n), made = Number(fb.real) > 0 ? r3(Number(fb.real)) : c.out, k = packCalc(it.id, fb.pk), rem = r3(made - k.used);
  const map = new Map(c.lines.map(l => [l.id, { ...l }])), add = (id, q) => { if (!(q > 0)) return; const m = byId.get(id), x = map.get(id); if (x) x.q = r3(x.q + q); else map.set(id, { id, name: m?.name || id, it: m, q: r3(q), c: rateOf(id, m), stock: Number(m?.stock) || 0 }); };
  for (const [id, q] of k.mats) add(id, q);
  // v2.102.0: 🧴 KIS MEIN BHARA — nuskha (ml) ya bharne ka maal (self) wala formula: yahi item kitne (fb.self, khali = baqi sab), bacha khula sirf dikhe
  const SM = selfMats(f), vol = Number(f.ml) > 0, fill = vol || SM.length > 0;
  const auto = Math.max(0, Math.floor(rem + 1e-6)), selfN = !fill ? 0 : fb.self === '' || fb.self == null ? auto : Math.max(0, Math.floor(Number(fb.self) || 0));
  let smCost = 0; if (fill) for (const m of SM) { const q = r3(Number(m.q) * selfN); add(String(m.id), q); smCost += q * rateOf(m.id, byId.get(String(m.id))); }
  const left = fill ? r3(rem - selfN) : 0, lines = [...map.values()];
  return { it, f, c, k, made, out: fill ? selfN : Math.max(0, rem), rem: fill ? left : rem, left, selfN, auto, fill, vol, SM, lines, oh: c.oh, total: c.total + k.matCost + smCost, avail: made, over: (fill ? left : rem) < -0.001, kam: lines.filter(l => l.stock < l.q) };
}
function fillStep(no, z) {   // v2.102.0: 🧴 Kis mein bhara?
  const it = z.it, P = packsOf(it.id), U = un(it), ml = Number(z.f.ml) || 0, L = x => ml ? num(r3(x * ml / 1000)) + ' ' + volU(it) : num(r3(x)) + ' ' + esc(U);
  const used = r3(z.k.used + z.selfN);
  return `${stepn(no, 'Kis mein bhara?', 'bana ' + L(z.made))}
    <div class="fc-pkg"><label class="fc-pkr self"><span><b>🧴 ${esc(it.name)}</b><small>${ml ? '1 = ' + num(r3(ml / 1000)) + ' ' + volU(it) : 'yahi item'}${z.SM.length ? ' · ' + z.SM.map(m => esc(byId.get(String(m.id))?.name || m.n || '')).join(' + ') : ''}</small></span><input type="number" inputmode="numeric" min="0" step="1" data-fb-self="1" value="${fb.self === '' || fb.self == null ? '' : esc(String(fb.self))}" placeholder="${num(z.auto)}"><em>pcs</em></label>
    ${P.map(p => { const pit = byId.get(p.id), n = Number(fb.pk[p.id]) || 0; return `<label class="fc-pkr"><span><b>🛍 ${esc(pit.name)}</b><small>1 = ${num(r3(p.g / 1000))} ${volU(it)}${p.mats.length ? ' · ' + p.mats.map(m => esc(byId.get(String(m.id))?.name || m.n || '')).join(' + ') : ''}</small></span><input type="number" inputmode="numeric" min="0" step="1" data-fb-pk="${esc(p.id)}" value="${n || ''}" placeholder="0"><em>pcs</em></label>`; }).join('')}</div>
    <div class="fc-rawsum ${z.over ? 'bad' : 'ok'}">${z.over ? `⚠️ Bhara ${L(used)} — bana sirf ${L(z.made)}! Ginti kam karein` : `Bhara ${L(used)}${z.left > 0.0005 ? ` · <b>bacha khula ${L(z.left)}</b> (POS mein nahi)` : ' · sab bhar gaya ✓'}`}${fb.self === '' || fb.self == null ? `<br><small>🧴 khali = baqi sab ${esc(it.name)} (${num(z.auto)})</small>` : ''}</div>`;
}
function packStep(no, src, z) {
  const P = packsOf(src); if (!P.length) return '';
  const U = un(byId.get(src));
  return `${stepn(no, 'Packing — kitne pcs bane?', fb.mode === 'pack' ? 'bulk stock ' + num(z.avail) + ' ' + esc(U) : 'bana ' + num(z.made) + ' ' + esc(U))}
    <div class="fc-pkg">${P.map(p => { const it = byId.get(p.id), n = Number(fb.pk[p.id]) || 0; return `<label class="fc-pkr"><span><b>${esc(it.name)}</b><small>1 = ${num(p.g)} g${p.mats.length ? ' · ' + p.mats.map(m => esc(byId.get(String(m.id))?.name || m.n || '')).join(', ') : ''}</small></span><input type="number" inputmode="numeric" min="0" step="1" data-fb-pk="${esc(p.id)}" value="${n || ''}" placeholder="0"><em>${n ? num(r3(n * packUnit(p))) + ' ' + esc(U) : ''}</em></label>`; }).join('')}</div>
    <div class="fc-rawsum ${z.over || (fb.mode === 'pack' && z.k.used > z.avail + 0.001) ? 'bad' : 'ok'}">${fb.mode === 'pack'
      ? (z.k.used ? `Bulk se ${num(z.k.used)} ${esc(U)} lagega${z.k.used > z.avail + 0.001 ? ` — ⚠️ stock sirf ${num(z.avail)} (minus ho jayega)` : ` · baqi ${num(r3(z.avail - z.k.used))}`}` : 'Packing ke pcs likhein')
      : z.over ? `⚠️ Packing ${num(z.k.used)} ${esc(U)} — bana sirf ${num(z.made)}! Ginti theek karein` : `${z.k.used ? `Packing ${num(z.k.used)} ${esc(U)} · ` : ''}baqi bulk <b>+${num(z.rem)} ${esc(U)}</b> stock mein`}${z.k.mats.size ? ' · packing maal: ' + [...z.k.mats].map(([id, q]) => num(q) + ' ' + esc(byId.get(id)?.name || '')).join(', ') : ''}</div>`;
}
function sendStep(no) {
  const canSend = isOwner() || canOf('fac.send');
  if (fb.edit) return '';
  if (!posOn()) return `<div class="fc-appnote">📱 <b>Sirf app</b> — factory stock mein darj hoga (tayyar maal +, raw maal −). POS mein kuch nahi jayega.${prnN() ? ` 🖨 ${prnN()} parchi server printer se.` : ''}</div>`;   // v2.103.0 · v2.103.1 parchi
  return `${stepn(no, 'POS?')}
    <div class="fc-lbl fc-send"><button type="button" class="${!fb.send ? 'on' : ''}" data-fb-send="0">📝 Abhi app mein rakho</button>${canSend ? `<button type="button" class="${fb.send ? 'on' : ''}" data-fb-send="1">📤 POS mein bhejo + 🖨 print</button>` : ''}</div>
    <small class="fc-lnote">${fb.send ? `PC 1 min mein POS stock badlega${prnN() ? ' · 🖨 ' + prnN() + ' parchi (' + (prnN() === 2 ? 'factory + munshi' : 'ek') + ')' : ''}` : 'Batch app mein rahega — edit / cancel aazad; pakka ho to batch khol kar 📤 dabayein'}</small>`;
}
function batchPaint() {
  const el = $('fcBatch'); if (!el || !fb) return;
  const fin = finished(), pack = fb.mode === 'pack';
  if (!pack && !fin.length) { el.innerHTML = `<p class="ir-say">Abhi koi formula nahi bana. ${isOwner() ? 'Pehle 🧪 Formulas mein tayyar maal ka nuskha banayein.' : 'Malik pehle formula banaye.'}</p>`; return; }
  const srcs = pack ? packSrcs().map(id => byId.get(id)).filter(Boolean) : fin;
  if (pack && !srcs.length) { el.innerHTML = `<p class="ir-say">Abhi koi packing item set nahi. ${isOwner() ? '🧪 Formulas → 🎁 Packing items mein set karein.' : 'Malik set kare.'}</p>`; return; }
  const z = batchCalc(), it = z?.it, hasPk = it && packsOf(it.id).length, fill = !pack && z?.fill;
  const lblIt = it && !pack && (fill || !hasPk) ? it : null, Lmain = lblIt ? labelSpecs(lblIt, z.out, fb.lbl) : [];
  const Lpk = z ? z.k.rows.flatMap(r => labelSpecs(r.it, r.n, fb.lbl)) : [], L = [...Lmain, ...Lpk];
  const ctnOk = it && it.pack > 1 && (it.labels || []).some(x => !x.main && Math.abs(x.qty - it.pack) < 0.001);
  let n = 1;
  el.innerHTML = `<div class="fc-bhead"><b>${esc(fb.edit ? fb.edit.no + ' ✏️' : batchNo())}</b><small>${esc(today())} · ${esc(whoOf() || '')}${fb.edit && fb.edit.adjNo ? ' · pehla wapas hoga, naya banega' : ''}</small></div>
    ${!fb.edit && packSrcs().length ? `<div class="fc-per fc-pf fc-mode"><button type="button" class="${!pack ? 'on' : ''}" data-fb-mode="make">🏭 Batch banaya</button><button type="button" class="${pack ? 'on' : ''}" data-fb-mode="pack">🎁 Bulk se packing</button></div>` : ''}
    ${stepn(n++, pack ? 'Kis bulk se packing?' : 'Kya banaya?')}
    <div class="fc-items">${srcs.map(x => `<button type="button" class="fc-it${x.id === fb.id ? ' on' : ''}" data-fb-it="${esc(x.id)}"><b>${esc(x.name)}</b><small>stock: ${esc(qt(x.stock, x))}</small></button>`).join('')}</div>
    ${!z ? '<p class="lk-note">Upar se item chunein.</p>' : `
    ${!pack ? `${stepn(n++, 'Kitne batch bane?', '1 batch = ' + esc(qt(z.f.per, it)))}
    <div class="fc-nums">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(k => `<button type="button" class="${k === fb.n ? 'on' : ''}" data-fb-n="${k}">${k}</button>`).join('')}</div>
    <div class="fc-out"><div><b>+ ${z.vol ? num(r3(z.made * z.f.ml / 1000)) + ' ' + volU(it) : esc(qt(z.made, it))}</b><small>${z.vol ? '= ' + num(Math.floor(z.made + 1e-6)) + ' ' + esc(un(it)) + ' barabar' : num(z.made) + ' ' + esc(un(it))}${Number(fb.real) > 0 ? ' (asal ginti)' : ''} · laagat ${rs(z.total)}</small></div></div>` : ''}
    ${fill ? fillStep(n++, z) : hasPk ? packStep(n++, it.id, z) : ''}
    <div class="fc-rawsum ${z.kam.length ? 'bad' : 'ok'}">${z.kam.length ? `⚠️ ${num(z.kam.length)} maal ${posOn() ? '' : 'factory '}stock mein kam: ${esc(z.kam.map(l => l.name).slice(0, 3).join(', '))}` : `✓ ${num(z.lines.length)} maal khud minus hoga — ${posOn() ? '' : 'factory '}stock poora hai`}${z.c?.gone ? ` · ⚠️ ${z.c.gone} item factory mein nahi` : ''}</div>
    ${!pack || z?.k?.rows?.length ? `<div class="fc-lab">🏷 BARCODE CHHAPEIN?</div><div class="fc-lbl fc-bc"><button type="button" class="${fb.lbl !== 'none' ? 'on' : ''}" data-fb-bc="1">🏷 Haan${fb.lbl !== 'none' && L.length ? ` (${num(L.reduce((t, x) => t + x.copies, 0))} label)` : ''}</button><button type="button" class="${fb.lbl === 'none' ? 'on' : ''}" data-fb-bc="0">Nahi</button></div>` : ''}
    <button type="button" class="fc-moreb" data-fb-more="1">${fb.more ? '▴ Kam dikhao' : '▾ Aur… (' + (pack ? '' : 'asal ginti · ') + 'label · maal list)'}</button>
    ${fb.more ? `<div class="fc-more">
      ${!pack ? `<div class="fc-lab">ASAL GINTI ALAG? <small>formula se kam / zyada bana ho</small></div>
      <div class="fc-out"><label>Asal ${esc(un(it))}<input type="number" inputmode="decimal" min="0" step="any" data-fb-real="1" value="${esc(String(fb.real || ''))}" placeholder="${num(z.c.out)}"></label><div><small>khali = formula ke mutabiq ${num(z.c.out)}</small></div></div>` : ''}
      <div class="fc-lab">MAAL — KHUD MINUS <small>lagega / stock</small></div>
      <div class="fc-raw">${z.lines.map(l => `<div><span>${esc(l.name)}</span><b>${esc(qk(l.q, l.it))}</b><em class="${l.stock < l.q ? 'bad' : 'ok'}">${esc(qk(l.stock, l.it))}${l.stock < l.q ? ' kam' : ' ✓'}</em></div>`).join('')}</div>
      <div class="fc-lab">BARCODE LABEL <small>batch no ke saath</small></div>
      <div class="fc-lbl">${[['pcs', 'Packet'], ...(ctnOk || z.k.rows.length ? [['ctn', 'Carton (sub)'], ['both', 'Dono']] : []), ['none', 'Nahi']].map(([k, l]) => `<button type="button" class="${fb.lbl === k ? 'on' : ''}" data-fb-lbl="${k}">${l}</button>`).join('')}</div>
      <small class="fc-lnote">${L.length ? L.map(x => `${num(x.copies)} label × ${esc(x.code || 'naya barcode (POS dega)')} ${esc(x.name)}${x.qty > 1 ? ' (' + num(x.qty) + ')' : ''}`).join(' · ') + (posOn() ? ' — POS ke baad khud chhapenge' : ' — OK dabate hi printer ko') : fb.lbl === 'none' ? 'Label nahi chhapenge' : '⚠️ Barcode nahi mila — label nahi chhapega'}</small></div>` : `<small class="fc-lnote">${L.length ? 'Label: ' + L.map(x => num(x.copies) + ' × ' + esc(x.name)).join(' · ') : fb.lbl === 'none' ? 'Label nahi chhapenge' : ''}</small>`}
    ${sendStep(n++)}
    <button type="button" class="fc-ok-btn" data-fb-ok="1"${fb.busy || z.over ? ' disabled' : ''}>${fb.edit ? '✓ Edit save' : pack ? '✓ OK — packing darj karo' : '✓ OK — ' + num(fb.n) + ' batch darj karo'}${fb.edit ? '' : !posOn() ? ' · 🏭 factory' : fb.send ? ' · 📤 POS' : ' · 📝 app'}</button>`}`;
}
function batchOk() {
  if (!fb || fb.busy) return; const z = batchCalc(); if (!z) { notice('Item chunein'); return; }
  if (!cloud?.addFactoryBatch) { notice('App update karein'); return; }
  const pack = fb.mode === 'pack', it = z.it;
  if (pack && !z.k.rows.length) { notice('Packing ke pcs likhein'); return; }
  if (!pack && !(z.made > 0)) { notice('Kitne bane — likhein'); return; }
  if (z.over) { notice(z.fill ? 'Bhara zyada — bana kam. Ginti theek karein' : `Packing ${num(z.k.used)} — bana sirf ${num(z.made)}. Ginti theek karein`); return; }
  if (z.fill && !(z.out > 0) && !z.k.rows.length) { notice('Kis mein bhara — pcs likhein'); return; }
  if (z.kam.length && !confirm(`${z.kam.map(l => l.name).join(', ')} stock mein kam hai.\nPhir bhi darj karein? (${posOn() ? 'POS' : 'factory stock'} mein minus ho jayega)`)) return;
  fb.busy = true;
  const outs = z.k.rows.map(r => ({ id: r.it.id, name: r.it.name, q: r.n, c: r2(r.c) }));
  const lbl = [...(!pack && (z.fill || !packsOf(it.id).length) ? labelSpecs(it, z.out, fb.lbl) : []), ...z.k.rows.flatMap(r => labelSpecs(r.it, r.n, fb.lbl))].slice(0, 6);
  const d = { no: batchNo(), itemId: it.id, name: pack ? '🎁 ' + it.name + ' → packing' : it.name, n: pack ? 1 : fb.n, per: pack ? 0 : z.f.per, out: z.out, outs, kind: pack ? 'pack' : 'make',
    lines: z.lines.map(l => ({ id: l.id, name: l.name, q: r3(l.q), c: r2(l.c) })), cost: Math.round(z.total), oh: z.oh, labels: lbl, byName: whoOf() || '', day: today(), hold: posOn() && !fb.send, app: !posOn() };
  d.loc = posOn() && hasLoc(d);   // v2.103.7: POS batch mein khula (loc) — app us ka stock ghatati hai   // v2.103.0: 'app' = POS mein kuch nahi
  if (fb.edit) {   // ✏️ edit — POS mein nahi gaya = wahi doc badlo; posted = purana wapas (cancelReq) + naya
    const eb = fb.edit, fresh = ['new', 'hold', 'cancelReq', 'app'].includes(eb.status) && !eb.adjNo;
    (async () => { if (fresh) { await cloud.editFactoryBatch(eb.id, d); notice(`✓ ${eb.no} edit`); }
      else { await cloud.factoryBatchAct(eb.id, 'cancel'); const r2_ = cloud.addFactoryBatch({ ...d, no: eb.no + 'E', hold: posOn() }); notice(`✓ ${eb.no} wapas + naya ${eb.no}E${posOn() ? ' (📝 app mein — 📤 se POS)' : ' (🏭 factory mein)'}`); await r2_?.done; } })()
      .then(() => { fb = null; $('dialog')?.close(); st.tab = 'batches'; keep(); repaint(); }).catch(e => { fb.busy = false; batchPaint(); notice('Nahi hua: ' + (e?.message || e)); });
    return;
  }
  let r; try { r = cloud.addFactoryBatch(d); } catch (e) { fb.busy = false; notice('Nahi hua: ' + (e?.message || e)); return; }
  notice(d.app ? `✓ ${d.no} · ${it.name} — 🏭 factory stock mein darj (POS mein kuch nahi)${d.labels.length ? ' · 🏷 label printer ko' : ''}` : d.hold ? `✓ ${d.no} · ${it.name} — 📝 app mein mehfooz; POS ke liye batch khol kar 📤 dabayein` : `✓ ${d.no} · ${it.name} — PC 1 min mein POS stock badlega${prnN() ? ' + 🖨 parchi' : ''}${d.labels.length ? ' + label' : ''}`);
  if (d.app && r?.id) appB = [...appB.filter(b => b.id !== r.id), { ...d, id: r.id, status: 'app', at: Date.now() }], fsCache = null;   // foran stock mein (listener baad mein wahi)
  fb = null; $('dialog')?.close(); st.tab = 'batches'; keep(); repaint();
  Promise.resolve(r?.done).then(() => { if (d.app && d.labels.length) sendLabels(d.labels, d.no); }).catch(e => notice('❌ Batch save nahi hua: ' + (e?.message || e)));
}

// v2.103.0: 🏷 sirf app wale batch ke label — app khud labelJobs (PC label-print chhapta hai; POS mein kuch nahi)
async function sendLabels(L, no) {
  if (!cloud?.requestLabel) return; let n = 0;
  for (const x of (L || []).slice(0, 6)) { if (!x.code) continue; let left = Math.max(0, Math.floor(Number(x.copies) || 0));
    while (left > 0) { const c = Math.min(200, left); left -= c;
      try { await cloud.requestLabel({ itemId: String(x.itemId || ''), code: x.code, name: x.name, qty: Number(x.qty) || 1, rate: Number(x.rate) || 0, copies: c, batch: no }); n += c; } catch (e) { notice('🏷 Label nahi gaya: ' + (e?.message || e)); return; } } }
  if (n) notice(`🏷 ${num(n)} label printer ko gaye (${no})`);
}
// v2.103.2: "sirf app" wala batch -> POS (naya 'new' batch wahi data, label nahi; app wala cancel — dohra stock nahi)
async function app2pos(id) {
  const b = batches.find(x => x.id === id) || appB.find(x => x.id === id); if (!b || b.status !== 'app') return;
  if (!confirm(`${b.no} POS mein bhejein? PC 1 min mein POS stock badlega (tayyar maal +, raw maal −). Label dobara nahi chhapenge.`)) return;
  try { const r = cloud.addFactoryBatch({ no: b.no, itemId: b.itemId, name: b.name, n: Math.max(1, Math.min(10, Math.floor(Number(b.n) || 1))), per: Number(b.per) || 0, out: Number(b.out) || 0, outs: b.outs || [], kind: b.kind === 'pack' ? 'pack' : 'make',
      lines: b.lines || [], cost: Number(b.cost) || 0, oh: Number(b.oh) || 0, labels: [], byName: b.byName || whoOf() || '', day: b.day || today(), hold: false, loc: hasLoc(b) });
    await r?.done; await cloud.factoryBatchAct(id, 'cancelNow'); appB = appB.filter(x => x.id !== id); fsCache = null;
    notice(`📤 ${b.no} POS ko bheja — PC 1 min mein stock badlega`); $('dialog')?.close(); repaint(); }
  catch (e) { notice('Nahi hua: ' + (e?.message || e)); }
}
// ---------- batch tafseel ----------
function batchDlg(id) {
  const b = batches.find(x => x.id === id); if (!b) return;
  const it = byId.get(String(b.itemId)), [c, t] = statOf(b), own = isOwner();
  const step = (ok, title, sub) => `<div class="fc-step"><span class="fc-sd ${ok}">${ok === 'ok' ? '✓' : ok === 'bad' ? '!' : '…'}</span><div><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</div></div>`;
  const posted = !!b.adjNo || b.status === 'posted' || (b.status === 'cancelReq' && !!b.adjNo);
  const mine = own || (b.by && b.by === uidOf()), fresh = ['new', 'hold', 'cancelReq', 'app'].includes(b.status) && !b.adjNo, canSend = own || canOf('fac.send');
  const after = new Map((b.after || []).map(a => [String(a.id), a]));
  const aft = id => { const a = after.get(String(id)); if (!a) return ''; const x = byId.get(String(id)); return ` <small class="fc-aft${a.s < 0 ? ' bad' : ''}">baqi ${esc(qk(a.s, x))}${a.s < 0 ? ' ⚠️ kam' : ''}</small>`; };
  dlg('🏭 ' + b.no, `<div class="ir-hero fc-hero ${c}"><small>${esc(b.no)} · ${esc(short(b.at))}</small><strong>${esc(b.name)}</strong><span>${b.kind === 'pack' ? 'packing' : num(b.n) + ' batch'}${b.out > 0 ? ' · ' + esc(qt(b.out, it)) : ''} · <b>${esc(t)}</b></span></div>
    <section class="ir-sec">
      ${step('ok', 'Larke ne OK kiya', `${esc(b.byName || '')} · ${esc(short(b.at))}`)}
      ${b.status === 'app' ? step('ok', '🏭 Factory stock mein darj', 'Sirf app — POS mein kuch nahi gaya') : b.status === 'cancelled' && !b.revNo ? '' : step(posted ? 'ok' : b.status === 'error' ? 'bad' : 'wait', posted ? 'POS stock badla' : b.status === 'error' ? 'POS mein nahi gaya' : b.status === 'hold' ? 'POS mein abhi nahi bheja' : b.waitItem ? 'Item POS mein banne ka intezar' : 'PC ko ja raha…', posted ? `Adjustment # ${esc(b.adjNo || '')} · ${b.postedAt ? esc(short(b.postedAt)) : ''}` : b.status === 'error' ? esc(b.err || '') : b.status === 'hold' ? 'neeche "📤 POS mein bhejo" — us se pehle edit / cancel aazad' : 'Server PC 1 min mein')}
      <div class="fc-mv">${b.out > 0 ? `<div><span>${esc(it?.name || b.name)}${aft(b.itemId)}</span><b class="plus">+${esc(qt(b.out, it))}</b></div>` : ''}${(b.outs || []).map(o => `<div><span>${esc(o.name)}${aft(o.id)}</span><b class="plus">+${esc(qt(o.q, byId.get(String(o.id))))}</b></div>`).join('')}${(b.lines || []).map(l => `<div><span>${esc(l.name)}${aft(l.id)}</span><b class="minus">−${esc(qk(l.q, byId.get(String(l.id))))}</b></div>`).join('')}</div>
      ${b.prnAt ? step('ok', '🖨 Parchi nikli', `${num(b.prnN || 0)} copy · ${esc(short(b.prnAt))}`) : b.prnErr ? step('bad', '🖨 Parchi nahi nikli', esc(b.prnErr)) : b.status === 'app' && b.prnState === 'off' ? step('ok', '🖨 Parchi band (setting)', '') : b.status === 'app' && prnN() && Date.now() - (Number(b.at) || 0) < 12 * 3600000 ? step('wait', '🖨 Parchi nikal rahi…', 'server PC 1 min — sirf printer, POS nahi') : ''}
      ${(b.labels || []).length ? step(b.lblDone || b.status === 'app' ? 'ok' : 'wait', b.lblDone || b.status === 'app' ? 'Label printer ko gaye' : 'Label (POS ke baad)', (b.labels || []).map(l => `${num(l.copies)} × ${esc(l.code)}`).join(' · ')) : b.status !== 'cancelled' && b.status !== 'cancelReq' && (b.out > 0 || (b.outs || []).length) ? `<div class="fc-step"><i>🏷</i><div><b>Label nahi chhape (Nahi chuna tha)</b><small><button type="button" class="fc-link" data-fc-lblnow="${esc(b.id)}">🏷 Label ab chhapo</button></small></div></div>` : ''}
      ${b.status === 'cancelled' ? step('ok', b.revNo ? '↩ Wapas ho gaya' : '✕ Cancel — POS mein gaya hi nahi', b.revNo ? `ulta adjustment # ${esc(b.revNo)}` : esc(short(b.cancelAt || b.at))) : b.status === 'cancelReq' ? step('wait', '↩ Wapas ho raha…', b.adjNo ? 'PC ulta adjustment banayega' : 'POS mein gaya hi nahi tha — neeche ✕ Cancel (foran)') : ''}${b.editAt ? step('ok', '✏️ Edit hua', esc(short(b.editAt))) : ''}
    </section>
    <section class="ir-sec fc-sum"><div class="fc-sumrow"><span>Laagat</span><b>${rs(b.cost)}</b></div>${(b.outs || []).length ? (b.outs || []).map(o => `<div class="fc-sumrow"><span>${esc(o.name)} fi pcs</span><b>${rs(o.c)}</b></div>`).join('') : `<div class="fc-sumrow"><span>Fi ${esc(un(it))}</span><b>${rs(b.out ? b.cost / b.out : 0)}</b></div>`}${b.oh ? `<div class="fc-sumrow"><span>Mazdoori / gas</span><b>${rs(b.oh)}</b></div>` : ''}</section>
    <div class="fc-btns">${own && b.status === 'error' ? `<button type="button" class="fc-go" data-fc-act="retry" data-id="${esc(b.id)}">↻ Dobara bhejo</button>` : ''}
      ${b.status === 'app' && posOn() && (mine || canSend) ? `<button type="button" class="fc-go" data-fc-app2pos="${esc(b.id)}">📤 POS mein bhejo</button><small class="lk-note">Ye batch "sirf app" mein bana tha — POS mein bhejne se POS stock badlega (label dobara nahi chhapenge).</small>` : ''}
      ${b.status === 'hold' && canSend && posOn() ? `<button type="button" class="fc-go" data-fc-act="send" data-id="${esc(b.id)}">📤 POS mein bhejo</button>` : ''}${b.status === 'hold' && !posOn() ? '<small class="lk-note">📱 Ye purana ruka batch hai (factory stock mein nahi) — ✕ Cancel kar ke dobara banayein, ab sirf app mein darj hoga.</small>' : ''}
      ${fresh && mine ? `<button type="button" class="fc-no" data-fc-edit="${esc(b.id)}">✏️ Edit</button><button type="button" class="fc-no" data-fc-act="cancelNow" data-id="${esc(b.id)}">✕ Cancel (foran)</button>` : ''}${b.status === 'app' && fresh && !mine ? '<small class="lk-note">Edit / cancel — malik ya jis ne banaya</small>' : ''}
      ${own && !fresh && ['posted', 'error'].includes(b.status) ? `<button type="button" class="fc-no" data-fc-edit="${esc(b.id)}">✏️ Edit (wapas + naya)</button><button type="button" class="fc-no" data-fc-act="cancel" data-id="${esc(b.id)}">↩ Ghalti — wapas lo</button>` : ''}
      <button type="button" class="fc-no" data-fc-bpdf="${esc(b.id)}">📄 PDF · WhatsApp</button></div>`);
}

// ---------- PDF ----------
function pdfHTML(list, title) {
  const tot = list.filter(b => b.status !== 'cancelled').reduce((s, b) => s + (Number(b.cost) || 0), 0);
  return `<h1>🏭 ${esc(title)}</h1><p>Noor Traders · apni factory · ${esc(new Date().toLocaleString('en-PK'))}</p>
    <table class="iv-tbl"><thead><tr><th>Batch</th><th>Item</th><th>Batch</th><th>Bana</th><th>Laagat Rs</th><th>Kis ne</th><th>Haalat</th></tr></thead><tbody>
    ${list.map(b => `<tr><td>${esc(b.no)}<br><small>${esc(short(b.at))}</small></td><td><b>${esc(b.name)}</b><br><small>${(b.lines || []).map(l => esc(l.name) + ' −' + num(l.q)).join(', ')}</small></td><td>${b.kind === 'pack' ? '—' : num(b.n)}</td><td>${b.out > 0 ? esc(qt(b.out, byId.get(String(b.itemId)))) : ''}${(b.outs || []).map(o => '<br>' + num(o.q) + ' × ' + esc(o.name)).join('')}</td><td>${num(Math.round(b.cost || 0))}</td><td>${esc(b.byName || '')}</td><td>${esc(statOf(b)[1])}${b.adjNo ? ' #' + esc(b.adjNo) : ''}</td></tr>`).join('')}
    </tbody></table><p><b>Kul laagat: ${rs(tot)}</b> · ${num(list.length)} batch slip</p>`;
}

// =====================================================================================================================
// v2.107.0: 🏭 EK SCREEN (malik, 21 Oct 2026: "puri screen change — pehle item, neeche formula ke chips · naya maal wahin chips mein ·
//   packing / raw ek hi screen · stock wahin se · save = batch + POS stock + formula · edit bhi yahi · do ki tadad likho, teesri khud ·
//   har item ka rate alag · 🏭 Factory stock chip → Stock screen · pehle wale hisse ⋮ ke andar"). Data WAHI: cfg.formulas (nuskha) ·
//   cfg.packs (isi maal se bane items) · factoryBatches (PC factory-post wahi). Purani tabs = st.view 'old'. AI nahi — hisaab app ka.
//   Bana: har khana Ctn + Pcs; jo khana KHALI chhoro, aakhri khali wala bachi hui tadad khud le leta hai. CAP fac.ekscreen.
// =====================================================================================================================
let ek = null, ekQT = 0;
const EKL = 'sam-fac-ek';   // aakhri item (agli dafa wahi khule)
const KGU = /^(kg|kgs|ltr|ltrs|l|liter|litre|lit|liters)$/;
const ekOn = () => { try { return isOwner() || (canFacBatch() && canOf('fac.ekscreen') !== false); } catch { return false; } };
const ekView = () => ekOn() && st.view !== 'old';
const ekLast = () => { try { return localStorage.getItem(EKL) || ''; } catch { return ''; } };
const ekKeep = id => { try { localStorage.setItem(EKL, String(id || '')); } catch {} };
const ekLbl = () => { let s = ''; try { s = localStorage.getItem('sam-fc-bc') || ''; } catch {} if (s === '0') return 'none'; const v = cfg?.lbl || 'pcs'; return s === '1' && v === 'none' ? 'pcs' : v; };
const ekPos = id => { try { return stockPickList().find(x => x.id === String(id)) || null; } catch { return null; } };
const ekJob = id => { id = String(id || ''); if (!id.startsWith('job:')) return id; const j = jobsById.get(id.slice(4)); return j && j.status === 'done' && j.itemId ? String(j.itemId) : id; };   // ⏳ PC ne bana diya = asli id
function ekFresh(it, eb) {
  const f = it ? forms()[it.id] : null, x = it ? feInit(it, f) : null;
  if (x && f?.sum) x.sum = true;
  if (x && !f && !x.ml && KGU.test(un(it))) x.sum = true;   // naya nuskha kg / ltr wala: 1 batch = raw ka jama (khud)
  return { id: it ? String(it.id) : '', q: '', fe: x, n: 1, oq: {}, rEd: {}, posR: false, pq: '', sel: new Set(), nw: null, ni: null, eb: eb || null, busy: false, hlOpen: false, plOpen: false, smOpen: false, spm: null };   // v2.108.1: hlOpen ① doosre items · plOpen ➕ maal list · smOpen 🧴 packing chunna · spm naya packing
}
const ekPerOf = F => { if (Number(F.ml) > 0 && F.auto !== false) { const V = volOf(F.lines); return V.v > 0 ? r3(V.v * 1000 / F.ml) : 0; } if (F.sum) { const V = volOf(F.lines); return V.v > 0 ? r3(V.v) : 0; } return Number(F.per) || 0; };
const ekForm = F => ({ per: ekPerOf(F), lines: F.lines.filter(l => Number(l.q) > 0), lab: Number(F.lab) || 0, gas: Number(F.gas) || 0, ml: Number(F.ml) || 0, auto: F.auto !== false, self: { mats: Object.entries(F.self || {}).filter(([, q]) => Number(q) > 0).map(([id, q]) => ({ id, q: Number(q) })) } });
// poora hisaab — formula (abhi likha hua) × batch → bana; khane: isi maal ke items (cfg.packs) + yahi item (bhara wala nuskha)
function ekCalc() {
  const it = ek && byId.get(String(ek.id)); if (!it || !ek.fe) return null;
  const f = ekForm(ek.fe), n = Math.max(0, Math.min(10, Math.floor(Number(ek.n) || 0))), c1 = costOf(f, 1), smC = selfMatCost(f), bulk = c1.cpp, main = bulk + smC;
  const fill = Number(f.ml) > 0 || selfMats(f).length > 0;
  const rows = [...packsOf(it.id).map(p => { const x = byId.get(p.id), u = packUnit(p); return { k: p.id, it: x, p, unit: u, pk: Number(x?.pack) || 0, cpp: u * bulk + matCost(p) }; }),
    ...(fill ? [{ k: '_self', it, p: null, unit: 1, pk: Number(it.pack) || 0, self: true, cpp: main }] : [])];
  const made = r3((Number(f.per) || 0) * (n || 1));
  const typed = r => { const v = ek.oq[r.k]; if (!v) return null; const c = String(v.c ?? '').trim(), p = String(v.p ?? '').trim(); if (c === '' && p === '') return null; return Math.max(0, Math.floor((r.pk > 1 ? (Number(c) || 0) * r.pk : 0) + (Number(p) || 0) + 1e-9)); };
  let used = 0; for (const r of rows) { r.t = typed(r); if (r.t != null) used += r.t * r.unit; }
  let autoK = ''; if (fill || rows.some(r => r.t != null)) for (let i = rows.length - 1; i >= 0; i--) if (rows[i].t == null) { autoK = rows[i].k; break; }   // kuch na likha (bulk) = sab bulk stock mein
  for (const r of rows) { r.auto = r.k === autoK; r.q = r.auto ? Math.max(0, Math.floor((made - used) / (r.unit || 1) + 1e-6)) : (r.t || 0); }
  const left = r3(made - rows.reduce((t, r) => t + r.q * r.unit, 0));
  return { it, f, n, made, rows, fill, left, over: left < -0.001, bulk, main, c1, per: Number(f.per) || 0, U: un(it) };
}
const ekRateRows = z => [{ it: z.it, cpp: z.fill || !z.rows.length ? z.main : z.bulk }, ...z.rows.filter(r => !r.self && r.it).map(r => ({ it: r.it, cpp: r.cpp }))];
const ekSz = (p, src) => { const g = Number(p?.g) || 0, kg = volU(src) === 'kg'; return g >= 1000 ? num(r3(g / 1000)) + (kg ? ' kg' : ' L') : num(g) + (kg ? ' g' : ' ml'); };
const ekSplit = r => r.pk > 1 ? { c: Math.floor(r.q / r.pk), p: r.q % r.pk } : { c: 0, p: r.q };
const ekDup = nm => { const f = fold(nm); if (f.length < 3) return []; let P = []; try { P = stockPickList(); } catch {} const seen = new Set(), out = [];
  for (const x of [...items, ...P]) { if (seen.has(x.id)) continue; seen.add(x.id); const g = fold(x.name); if (g === f || (f.length >= 5 && Math.abs(g.length - f.length) <= 2 && dl(g, f) <= 2)) out.push(x); if (out.length >= 3) break; }
  return out; };
function ekDupHTML(dup, kind) {
  if (!dup.length) return '';
  return `<div class="fc-alert"><span>⚠️</span><div><b>Milta julta pehle se hai:</b> ${dup.map(x => esc(x.name)).join(' · ')} — dobara mat banayein</div><button type="button" ${kind === 'out' ? 'data-ek-niuse' : 'data-ek-nwuse'}="${esc(dup[0].id)}">${kind === 'raw' ? 'Isi ko jorein' : 'Isi ko chuno'}</button></div>`;
}
// ---------- screen ----------
function ekRender(root) {
  if (!itemsOk) { root.innerHTML = `<div id="ekRoot" class="ek"><div class="ir-hero fc-hero ek-hero"><div class="fc-hrow"><div><small>NOOR TRADERS · APNI FACTORY</small><strong>🏭 Factory</strong></div></div></div><div class="ek-mn">${ekMenu()}</div>${itemsErr ? `<p class="ir-say">⏳ Stock load nahi hua: ${esc(itemsErr)}</p>` : '<p class="lk-note">⏳ Items aa rahi hain…</p>'}</div>`; return; }
  if (!ek) { const last = ekJob(ekLast()), it = last ? byId.get(last) : null; ek = ekFresh(it && (isOwner() || forms()[it.id]) ? it : null); }
  else { const nid = ekJob(ek.id); if (nid !== ek.id) ek.id = nid;   // ⏳ PC ne item bana diya — asli id
    if (ek.fe) { for (const l of ek.fe.lines) l.id = ekJob(l.id); for (const k of Object.keys(ek.oq)) { const nk = ekJob(k); if (nk !== k) { ek.oq[nk] = ek.oq[k]; delete ek.oq[k]; } }
      for (const k of Object.keys(ek.fe.self || {})) { const nk = ekJob(k); if (nk !== k) { ek.fe.self[nk] = ek.fe.self[k]; delete ek.fe.self[k]; } } }
    else if (ek.id && byId.get(ek.id)) ek = ekFresh(byId.get(ek.id), ek.eb); }
  const a = document.activeElement;
  if ($('ekRoot') && a && root.contains(a) && a.matches?.('input,textarea')) { ekSoft(); return; }   // likhte waqt poori screen na bane (keyboard na toote)
  root.innerHTML = ekHTML();
}
function ekSoft() { const s = (id, h) => { const el = $(id); if (el && el.innerHTML !== h) el.innerHTML = h; }; s('ekHero', ekHeroChips()); s('ekHist', ekHistHTML()); ekLive(); }
function ekHeroChips() {
  const T = today(), B = batches.filter(b => b.day === T && !['cancelled', 'cancelReq'].includes(b.status)), pcs = B.reduce((t, b) => t + (Number(b.out) || 0) + (b.outs || []).reduce((s, o) => s + (Number(o.q) || 0), 0), 0);
  return `<button type="button" class="ek-fstock" data-ek-fstock="1">🏭 Factory stock <i>${num(items.filter(x => !isPend(x)).length)}</i></button><span class="ek-today">Aaj: ${num(B.length)} batch · ${num(Math.round(pcs))} pcs</span>`;
}
function ekMenu() {
  const own = isOwner(), g = '🏭 Factory — purane hisse', lblOn = ekLbl() !== 'none';
  const b = (k, i, t, s, a, on) => `<button type="button"${on ? ' class="is-in"' : ''} data-mn="${k}" data-mn-i="${i}" data-mn-t="${esc(t)}" data-mn-s="${esc(s)}" data-mn-g="${g}" ${a}>${i} ${esc(t)}</button>`;
  return [b('fc.batches', '📋', 'Batches', 'saare batch · haal · edit / cancel', 'data-ek-old="batches"'),
    canFacBatch() ? b('fc.oldbatch', '🧾', 'Batch — purana form', 'pehle wala 3 qadam', 'data-fc-batch="1"') : '',
    canFacBatch() && packSrcs().length ? b('fc.bulkpack', '🎁', 'Bulk se packing', 'purane bulk stock se 4 kg / 700 g', 'data-fb-mode="pack"') : '',
    b('fc.stock', '📦', 'Stock (purana tab)', 'factory ka pehle wala stock tab', 'data-ek-old="stock"'),
    own ? b('fc.formulas', '🧪', 'Formulas', 'sab nuskhe ki list', 'data-ek-old="formulas"') : '',
    own ? b('fc.rates', '🏷', 'Rates', 'laagat + nafa · W / R', 'data-ek-old="rates"') : '',
    own ? b('fc.pkitems', '🎁', 'Packing items', 'pouch · bag · 4 kg / 700 g', 'data-fc-pkdef=""') : '',
    own ? b('fc.mcost', '🧴', 'Wazan se laagat', 'formula ke baghair · gram × rate', 'data-mc-open=""') : '',
    own && aiFormula ? b('fc.photo', '📷', 'Photo se formula · AI', 'Excel / parchi ki tasveer', 'data-fc-photo="1"') : '',
    canFacBatch() ? b('fc.label', '🏷', 'Batch label: ' + (lblOn ? 'Haan' : 'Nahi'), 'Save par barcode label chhapein?', 'data-ek-lbl="1"', lblOn) : '',
    own ? b('fc.set', '⚙️', 'Settings', 'factory items ☑ · nafa % · POS on / off', 'data-fc-set="1"') : '',
    phCan() ? `<button type="button" data-mn="fc.catpdf" data-mn-i="📄" data-mn-t="Rate list PDF — tasveerein" data-mn-s="${esc(String(cfg?.cat?.title || 'ADREES SOAP FACTORY'))} · Wholesale / Parchoon · HD" data-mn-g="📷 Tasveer · PDF" data-ek-cat="1">📄 Rate list PDF</button>` : '',
    own ? `<button type="button" data-mn="fc.aicmd" data-mn-i="📸" data-mn-t="Sab items ki AI commands" data-mn-s="har item ki tasveer ki command · 📋 copy" data-mn-g="📷 Tasveer · PDF" data-ek-cmds="1">📸 AI commands</button>` : ''].join('');
}
function ekHTML() {
  const own = isOwner(), z = ekCalc(), errs = batches.filter(b => b.status === 'error'), dups = own ? items.filter(x => x.dup) : [];
  return `<div id="ekRoot" class="ek">
    <div class="ir-hero fc-hero ek-hero"><div class="fc-hrow"><div><small>NOOR TRADERS · APNI FACTORY</small><strong>🏭 Factory</strong></div></div><div class="ek-hchips" id="ekHero">${ekHeroChips()}</div></div>
    <div class="ek-mn">${ekMenu()}</div>
    ${errs.length ? `<button type="button" class="fc-alert bad" data-fc-b="${esc(errs[0].id)}"><span>❌</span><div><b>${num(errs.length)} batch POS mein nahi gaye</b> — tap karein, wajah dekhein</div><em>›</em></button>` : ''}
    ${dups.map(x => `<div class="fc-alert"><span>⚠️</span><div><b>${esc(x.name)}</b> ⏳ PC baqi hai magar ye naam POS mein pehle se hai — PC dobara item banayega. Agar wahi item hai to pending hatayein aur POS wali ko ☑ karein.</div><button type="button" data-fc-penddel="${esc(x.jid)}">✕ Hatao</button></div>`).join('')}
    <section class="ir-sec ek-c" id="ekItem"><div class="ek-h"><span class="ek-no">1</span><b>Kaun sa maal banana hai?</b></div>
      <div class="ek-sr"><label class="hs-search"><input type="search" data-ek-q="1" placeholder="🔍 item ka naam / barcode — likhte hi milta julta" value="${esc(ek.q)}" autocomplete="off"></label>${ek.id && !ek.nw ? `<button type="button" class="ek-dots${ek.hlOpen ? ' is-in' : ''}" data-ek-hl="1" aria-label="Doosre items" title="Doosre items">⋮</button>` : ''}</div>
      <div id="ekHits">${ekHitsHTML()}</div></section>
    ${z ? ekFormHTML(z) + ekBatchHTML(z) + ekOutHTML(z) + (own ? ekRateHTML(z) : '') + `<div class="ek-save" id="ekSaveC">${ekSaveInner(z)}</div>` : ''}
    <section class="ir-sec ek-c" id="ekHist">${ekHistHTML()}</section></div>`;
}
function ekHitsHTML() {
  const own = isOwner(), F = forms(), q = ek.q.trim(), it = ek.id ? byId.get(ek.id) : null;
  if (ek.nw?.kind === 'main') return ekNwHTML();
  const row = (x, pos) => `<button type="button" class="ek-hit${pos ? ' pos' : ''}" data-ek-it="${esc(x.id)}">${phImg(x.id, 'ek-th', false)}<span><b>${esc(x.name)}${isPend(x) ? ' ⏳' : ''}${isLoc(x) ? ' 📱' : ''}</b><small>${pos ? '🏪 POS item · factory mein bhi jur jayegi' : F[x.id] ? '🧪 formula hai · 1 batch = ' + esc(qt(F[x.id].per, x)) : 'formula abhi nahi'} · stock ${esc(pos ? qt(x.stock, x) : qk(x.stock, x))}</small></span><em>›</em></button>`;
  if (q) {
    const fac = srch(items.filter(x => own || F[x.id]), q, 8); let pos = [];
    if (own && fac.length < 6) { let P = []; try { P = stockPickList(); } catch {} const have = new Set(items.map(x => x.id)); pos = srch(P.filter(x => !have.has(x.id)), q, 6 - fac.length); }
    const exact = [...fac, ...pos].some(x => fold(x.name) === fold(q));
    return `<div class="ek-hl">${fac.map(x => row(x, false)).join('')}${pos.map(x => row(x, true)).join('')}${!fac.length && !pos.length ? `<p class="lk-note">"${esc(q)}" — koi milta julta item nahi.</p>` : ''}${own && !exact ? `<button type="button" class="ek-new" data-ek-nwmain="1">➕ Naya item banao: "${esc(q)}"</button>` : ''}</div>`;
  }
  if (it) {
    const f = F[it.id];
    const th = phThumb(it.id), ph = th && phCan() ? `<button type="button" class="ek-ph img" data-ek-ph="${esc(it.id)}" aria-label="${esc(it.name)} ki tasveer"><img src="${esc(th)}" alt=""></button>` : own ? `<button type="button" class="ek-ph add" data-ek-ph="${esc(it.id)}" aria-label="Tasveer lagao"><span>📷</span><i>tasveer</i></button>` : `<div class="ek-ph" aria-hidden="true">${esc((it.name || '?').trim().charAt(0).toUpperCase())}</div>`;
    return `<div class="ek-sel">${ph}<div class="ek-seli"><b>${esc(it.name)}${isPend(it) ? ' ⏳' : ''}${isLoc(it) ? ' 📱' : ''}</b>
        <small>${f ? '✓ Formula bana hua · 1 batch = ' + esc(qt(f.per, it)) : '🧪 Naya formula — neeche maal jorein'}</small><small>stock ${esc(qk(it.stock, it))}${it.code ? ' · ' + esc(it.code) : ''}</small></div>
        <button type="button" class="ek-x" data-ek-it="" aria-label="Doosra item chunein">✕</button></div>
      ${ek.hlOpen ? `<div class="ek-hlw">${ekAllHTML(row, it.id)}</div>` : ''}`;   // v2.108.1: doosre items ⋮ ke peeche (malik: "zaroorat par saamne")
  }
  return ekAllHTML(row, '');
}
function ekAllHTML(row, skip) {
  const own = isOwner(), F = forms(), fin = finished().filter(x => x.id !== skip && (own || !isPend(x))), rest = own ? items.filter(x => x.id !== skip && !F[x.id] && !isMat(x.id) && !packOf(x.id) && !isPend(x)).slice(0, 12) : [];
  return `${fin.length ? `<div class="fc-lab">🧪 FORMULA WALE <small>${num(fin.length)}</small></div><div class="ek-hl">${fin.map(x => row(x, false)).join('')}</div>` : ''}
    ${rest.length ? `<div class="fc-lab">BAQI FACTORY ITEMS <small>naya formula banayein</small></div><div class="ek-hl">${rest.map(x => row(x, false)).join('')}</div>` : ''}
    ${!fin.length && !rest.length ? `<p class="lk-note">${skip ? 'Aur koi item nahi.' : own ? 'Factory mein abhi koi item nahi — upar naam likhein (POS mein ho to mil jayega) ya ➕ naya.' : 'Abhi koi formula nahi — malik banayega.'}</p>` : ''}`;
}
// ➕ naya item (jo banana hai) / naya raw maal — wahin chips mein (dohra roko)
function ekNwHTML() {
  const w = ek.nw, raw = w.kind === 'raw';
  return `<div class="ek-mini" id="ekNwBox"><div class="fc-lab">${raw ? '➕ NAYA MAAL — YAHIN' : '➕ NAYA ITEM — JO BANANA HAI'} <small>${posOn() ? '⏳ POS mein PC banayega' : '📱 sirf factory'}</small></div>
    <label class="ek-f"><span>Naam</span><input type="text" data-ek-nwf="n" maxlength="80" value="${esc(w.n)}" placeholder="${raw ? 'jaise: Soda ash' : 'jaise: Surf 2 kg'}"></label>
    <div id="ekNwDup">${ekDupHTML(ekDup(String(w.n || '').trim()), w.kind)}</div>
    <div class="ek-f"><span>Kis mein ginte hain?</span><div class="ek-seg">${['Kg', 'Ltr', 'Pcs'].map(u => `<button type="button" class="${w.un === u ? 'is-in' : ''}" data-ek-nwun="${u}">${u}</button>`).join('')}</div></div>
    <div class="ek-two"><label class="ek-f"><span>Khareed rate (Rs fi ${esc(w.un)})</span><input type="number" inputmode="decimal" min="0" step="any" data-ek-nwf="r" value="${esc(w.r)}" placeholder="${raw ? '0' : 'ikhtiyari'}"></label>
      ${raw ? `<label class="ek-f"><span>1 batch mein kitna (${esc(w.un)})</span><input type="number" inputmode="decimal" min="0" step="any" data-ek-nwf="q" value="${esc(w.q)}" placeholder="0"></label>` : `<label class="ek-f"><span>1 Ctn = kitne pcs</span><input type="number" inputmode="numeric" min="0" step="1" data-ek-nwf="pk" value="${esc(w.pk)}" placeholder="ikhtiyari"></label>`}</div>
    <div class="fc-btns"><button type="button" class="fc-no" data-ek-nwx="1">✕ Chhoro</button><button type="button" class="fc-go" data-ek-nwok="1"${w.busy ? ' disabled' : ''}>${raw ? '✓ Jor do — formula mein bhi' : '✓ Banao aur chuno'}</button></div></div>`;
}
function ekFormHTML(z) {
  const own = isOwner(), F = ek.fe, SM = Object.entries(F.self || {}).filter(([, q]) => Number(q) > 0);
  return `<section class="ir-sec ek-c" id="ekForm"><div class="ek-h"><span class="ek-no">2</span><b>Formula — 1 batch ka nuskha</b>${own ? '' : '<small>🔒 sirf malik badle</small>'}</div>
    <div class="fc-lab">RAW MAAL <small>${num(F.lines.length)}</small></div>
    <div class="ek-chips" id="ekLines">${ekLinesHTML()}</div>
    ${ekSelfHTML(z)}
    ${own ? `<div class="ek-pick" id="ekPickBox">${ek.nw?.kind === 'raw' ? ekNwHTML() : `<div class="fc-lab">➕ MAAL JOREIN <small>☑ kai ek saath</small></div>
      <div class="ek-sr"><label class="hs-search"><input type="search" data-ek-pq="1" placeholder="🔍 naam likhein · ⋮ = poori list" value="${esc(ek.pq)}" autocomplete="off"></label><button type="button" class="ek-dots${ek.plOpen ? ' is-in' : ''}" data-ek-pl="1" aria-label="Poori list" title="Poori list">⋮</button></div>
      <div id="ekPickList">${ekPickListHTML()}</div><div id="ekPickFoot">${ekPickFootHTML()}</div>`}</div>` : ''}
    <div class="fc-lab">KHARCHA <small>fi batch</small></div>
    <div class="ek-xr"><label>👷 Mazdoori<span><em>Rs</em><input type="number" inputmode="decimal" min="0" step="any" data-ek-lab="1" value="${F.lab || ''}" placeholder="0"${own ? '' : ' disabled'}></span></label>
      <label>🔥 Gas / bijli<span><em>Rs</em><input type="number" inputmode="decimal" min="0" step="any" data-ek-gas="1" value="${F.gas || ''}" placeholder="0"${own ? '' : ' disabled'}></span></label></div>
    <div id="ekPer" class="ek-per">${ekPerHTML(z)}</div>
    <div id="ekSum" class="ek-sum">${ekSumHTML(z)}</div></section>`;
}
// v2.108.1: 🧴 HAR PCS KE SAATH (bottle / raper / dhakan) — malik: ✕ hatao · miqdaar · ➕ packing (list se ya naya) — Save par formula ke saath
function ekSelfHTML(z) {
  const own = isOwner(), F = ek.fe, S = F.self || {}, ids = Object.keys(S), show = ids.length || Number(F.ml) > 0 || !KGU.test(un(z.it));
  if (!show || (!own && !ids.some(id => Number(S[id]) > 0))) return '';
  const chip = id => { const it = byId.get(id), nm = it?.name || id, q = Number(S[id]) || 0, r = rateOf(id, it);
    return `<span class="ek-chip${q > 0 ? '' : ' warn'}${it ? '' : ' gone'}"><b>${esc(nm)}${isPend(it) ? ' ⏳' : ''}</b>${own ? `<input type="number" inputmode="decimal" min="0" step="any" data-ek-sq="${esc(id)}" value="${q > 0 ? q : ''}" placeholder="1" aria-label="${esc(nm)} fi pcs">` : `<i>${num(q)}</i>`}<em>fi pcs</em>${r ? `<small>${rs(r)}</small>` : ''}${own ? `<button type="button" class="ek-cx" data-ek-sdel="${esc(id)}" aria-label="${esc(nm)} hatao">✕</button>` : ''}</span>`; };
  const M = own && ek.smOpen ? items.filter(y => y.id !== z.it.id && (isMat(y.id) || looksPack(y.id, y.name))) : [];
  return `<div class="fc-lab">🧴 HAR PCS KE SAATH <small>bottle / raper / dhakan</small>${own ? `<button type="button" class="ek-tgl${ek.smOpen ? ' is-in' : ''}" data-ek-smo="1">${ek.smOpen ? '⌃ Chhupao' : '➕ packing'}</button>` : ''}</div>
    <div class="ek-chips" id="ekSelf">${ids.map(chip).join('') || '<p class="lk-note">Har pcs ke saath koi packing nahi — ➕ packing se jorein.</p>'}</div>
    ${ek.smOpen ? `<div class="ek-mats sm">${M.map(y => `<button type="button" class="${S[y.id] != null ? 'is-in' : ''}" data-ek-smat="${esc(y.id)}">${S[y.id] != null ? '✓ ' : ''}${esc(y.name)}</button>`).join('')}<button type="button" class="alt" data-ek-spmnew="1">➕ naya packing</button></div>
      ${ek.spm ? `<div class="ek-two ek-pm"><label class="ek-f"><span>Packing ka naam</span><input type="text" data-ek-spmf="n" maxlength="80" value="${esc(ek.spm.n)}" placeholder="jaise: Bottle 500 ml"></label><label class="ek-f"><span>Rate (Rs fi pc)</span><input type="number" inputmode="decimal" min="0" step="any" data-ek-spmf="r" value="${esc(ek.spm.r)}" placeholder="0"></label><button type="button" class="fc-go sm" data-ek-spmok="1">✓ Packing banao</button></div>` : ''}` : ''}`;
}
function ekLinesHTML() {
  const own = isOwner();
  return ek.fe.lines.map((l, i) => { const it = byId.get(String(l.id)), g = gOf(l.id), [ru, per] = g ? ['kg', 1000 / g] : [un(it), 1], r = rateOf(l.id, it), v = Number(l.q) > 0 ? (g ? kgOf(l.q, l.id) : r3(l.q)) : '', nm = it?.name || l.n || 'Item ' + l.id;
    return `<span class="ek-chip${Number(l.q) > 0 ? '' : ' warn'}${it ? '' : ' gone'}"><b>${esc(nm)}${isPend(it) ? ' ⏳' : ''}</b>${own ? `<input type="number" inputmode="decimal" min="0" step="any" data-ek-lq="${i}" value="${v}" placeholder="kitna" aria-label="${esc(nm)} kitna">` : `<i>${num(v)}</i>`}<em>${g ? 'kg' : esc(un(it))}</em><small>${r ? rs(r * per) + '/' + esc(ru) : '⚠️ rate nahi'}</small>${own ? `<button type="button" class="ek-cx" data-ek-ldel="${i}" aria-label="${esc(nm)} hatao">✕</button>` : ''}</span>`; }).join('')
    || `<p class="lk-note">${own ? 'Neeche list se maal ☑ karein — ya naam likh kar naya.' : 'Is item ka formula abhi nahi.'}</p>`;
}
function ekPickData() {
  const F = forms(), inF = new Set(ek.fe.lines.map(l => String(l.id))), outs = new Set(packsOf(ek.id).map(p => p.id)), use = new Map(), q = ek.pq.trim();
  for (const [fid, f] of Object.entries(F)) if (fid !== ek.id) for (const l of f.lines || []) use.set(String(l.id), (use.get(String(l.id)) || 0) + 1);
  const base = items.filter(x => x.id !== ek.id && !outs.has(x.id));
  const L0 = q ? srch(base, q, 40) : base.filter(x => !inF.has(x.id) && !F[x.id]).sort((a, b) => (isMat(a.id) ? 1 : 0) - (isMat(b.id) ? 1 : 0) || (use.get(b.id) || 0) - (use.get(a.id) || 0) || a.name.localeCompare(b.name));   // packing maal (bag / pouch) neeche
  const L = L0.slice(0, q ? 40 : 8); let pos = [];
  if (q && L0.length < 6) { let P = []; try { P = stockPickList(); } catch {} const have = new Set(items.map(x => x.id)); pos = srch(P.filter(x => !have.has(x.id)), q, 6); }
  return { L, pos, more: L0.length - L.length, inF, use, q, exact: [...L0, ...pos].some(x => fold(x.name) === fold(q)) };
}
function ekPickListHTML() {
  if (!ek.plOpen && !ek.pq.trim()) return '';   // v2.108.1: list ⋮ ke peeche (malik: "zaroorat par saamne")
  const { L, pos, more, inF, use } = ekPickData();
  const row = (x, isPos) => { const has = inF.has(x.id), on = has || ek.sel.has(x.id), r = isPos ? 0 : rateOf(x.id, x);
    return `<label class="ek-pr${on ? ' is-in' : ''}${has ? ' has' : ''}"><input type="checkbox" data-ek-pt="${esc(x.id)}"${on ? ' checked' : ''}${has ? ' disabled' : ''}><span><b>${use.get(x.id) ? '⭐ ' : ''}${esc(x.name)}${isPend(x) ? ' ⏳' : ''}</b><small>${has ? '✓ pehle se formula mein · ' : ''}${isPos ? '🏪 POS — factory mein bhi jur jayegi · ' : ''}stock ${esc(isPos ? qt(x.stock, x) : qk(x.stock, x))}${r ? ' · ' + rs(r) + '/' + esc(un(x)) : ''}</small></span></label>`; };
  return `${L.map(x => row(x, false)).join('')}${pos.map(x => row(x, true)).join('')}${!L.length && !pos.length ? '<p class="lk-note">Koi milta julta naam nahi.</p>' : ''}${more > 0 ? `<p class="lk-note">+${num(more)} aur — likh kar dhoondein</p>` : ''}`;
}
function ekPickFootHTML() {
  const { exact, q } = ekPickData(), n = ek.sel.size;
  return `${n ? `<button type="button" class="ek-add" data-ek-padd="1">➕ ${num(n)} jorein</button>` : ''}${q && !exact ? `<button type="button" class="ek-new" data-ek-nwraw="1">➕ "${esc(q)}" naya maal banao — yahin</button>` : ''}`;
}
function ekPerHTML(z) {
  const F = ek.fe, it = z.it, own = isOwner(), V = volOf(F.lines), U = esc(un(it));
  if (Number(F.ml) > 0 && F.auto !== false) return `<div class="ek-perb"><span>1 batch = raw ka jama</span><b>${num(r3(V.v))} ${volU(it)} = ${num(Math.floor(z.per + 1e-9))} ${U}</b>${own ? '<button type="button" class="fc-link" data-ek-perman="1">✎ haath se</button>' : ''}</div>`;
  if (F.sum) return `<div class="ek-perb"><span>1 batch = raw ka jama</span><b>${num(z.per)} ${U}</b>${own ? '<button type="button" class="fc-link" data-ek-perman="1">✎ haath se</button>' : ''}</div>`;
  return `<div class="ek-perb"><span>1 batch =</span>${own ? `<input type="number" inputmode="decimal" min="0" step="any" data-ek-per="1" value="${Number(F.per) > 0 ? esc(String(F.per)) : ''}" placeholder="?" aria-label="1 batch mein kitna">` : `<b>${num(F.per)}</b>`}<span>${U}${it.pack > 1 && F.per > 0 ? ' · ' + esc(qt(F.per, it)) : ''}</span>${own && V.v > 0 ? `<button type="button" class="fc-link" data-ek-persum="1">↺ raw ka jama: ${num(V.v)}</button>` : ''}</div>`;
}
function ekSumHTML(z) {
  const miss = ek.fe.lines.filter(l => !(Number(l.q) > 0)).length, noR = z.c1.noRate;
  return `<div class="ek-sumr"><span>1 batch = <b>${num(z.per)} ${esc(z.U)}</b></span><span>laagat <b>${rs(z.c1.total)}</b> · ${rs(z.fill || !z.rows.length ? z.main : z.bulk)} / ${esc(z.U)}</span></div>
    ${miss ? `<small class="ek-warn">⚠️ ${num(miss)} maal ki miqdaar likhein (ya ✕ hatayein)</small>` : ''}${noR ? `<small class="ek-warn">⚠️ ${num(noR)} maal ka rate nahi — laagat kam dikhegi (⋮ → 🧪 Formulas)</small>` : ''}`;
}
function ekBatchHTML(z) {
  const eb = ek.eb, fresh = eb && ['new', 'hold', 'cancelReq', 'app'].includes(eb.status) && !eb.adjNo;
  return `<section class="ir-sec ek-c" id="ekBatchC"><div class="ek-h"><span class="ek-no">3</span><b>Kitne batch?</b>
      <span class="ek-step"><button type="button" data-ek-n="-1" aria-label="Kam">−</button><b id="ekN">${num(z.n)}</b><button type="button" data-ek-n="1" aria-label="Zyada">+</button></span></div>
    <small class="ek-bulk" id="ekBulk">${ekBulkHTML(z)}</small>
    ${eb ? `<div class="fc-alert"><span>✏️</span><div><b>Edit: ${esc(eb.no)}</b> — Save par ${fresh ? 'yahi batch badlega' : 'purana wapas + naya (' + esc(eb.no) + 'E)'}</div><button type="button" data-ek-ebx="1">✕ Chhoro</button></div>` : ''}</section>`;
}
const ekBulkHTML = z => z.n ? `Kul bana: <b>${esc(qt(z.made, z.it))}</b> · laagat ${rs(z.c1.total * z.n)} — neeche items mein bat jayega` : '0 = <b>sirf formula save</b> (batch nahi, stock nahi)';
function ekOutHTML(z) {
  const own = isOwner(), it = z.it;
  return `<section class="ir-sec ek-c${z.n ? '' : ' ek-dim'}" id="ekOutC"><div class="ek-h"><span class="ek-no">4</span><b>Is batch se kya bana?</b></div>
    ${z.rows.length > 1 ? '<small class="ek-hint">Jo khana <b>khali</b> chhorein — aakhri khali wala bachi hui tadad <b>khud</b> le lega.</small>' : ''}
    <div class="ek-outs">${z.rows.map((r, i) => ekRowHTML(r, i, z)).join('') || `<div class="ek-made">Bana: <b id="ekMade">${esc(qt(z.made, it))}</b> ${esc(it.name)}</div>`}</div>
    <div id="ekBal" class="fc-rawsum ${z.over ? 'bad' : z.made > 0 ? 'ok' : 'warn'}">${ekBalHTML(z)}</div>
    ${own ? `<div class="ek-acts"><button type="button" class="ek-new" data-ek-ninew="1">➕ Naya item — isi maal se</button><button type="button" class="ek-new alt" data-ek-niold="1">+ Pehle wala item jorein</button></div><div id="ekNiBox">${ek.ni ? ekNiHTML(z) : ''}</div>` : ''}</section>`;
}
function ekRowHTML(r, i, z) {
  const x = r.it, own = isOwner(), v = ek.oq[r.k] || {}, cn = x?.cn || 'Ctn', U = x?.un || 'Pcs', a = ekSplit(r);
  return `<div class="ek-or${r.auto ? ' auto' : ''}" data-ek-orow="${i}"><div class="ek-orh">${x ? phImg(x.id, 'ek-th sm') : ''}<b>${esc(x?.name || r.k)}${isPend(x) ? ' ⏳' : ''}</b>
      <small>${r.self ? 'yahi item' : esc(ekSz(r.p, z.it))}${r.p?.mats?.length ? ' · 🎁 ' + r.p.mats.map(m => esc(byId.get(String(m.id))?.name || m.n || '')).join(' + ') : ''}${r.pk > 1 ? ' · 1 ' + esc(cn) + ' = ' + num(r.pk) : ''} · stock ${esc(qt(x?.stock || 0, x))}</small></div>
    ${own && !r.self ? `<button type="button" class="ek-cx" data-ek-odel="${esc(r.k)}" aria-label="${esc(x?.name || '')} hatao">✕</button>` : ''}
    <div class="ek-oin">${r.pk > 1 ? `<label><span>${esc(cn)}</span><input type="number" inputmode="numeric" min="0" step="1" data-ek-oc="${esc(r.k)}" value="${esc(v.c ?? '')}" placeholder="${r.auto ? a.c : 0}"></label>` : ''}
      <label><span>${esc(U)}</span><input type="number" inputmode="numeric" min="0" step="1" data-ek-op="${esc(r.k)}" value="${esc(v.p ?? '')}" placeholder="${r.auto ? a.p : 0}"></label>
      <span class="ek-ot" id="ekOt${i}">${ekOtHTML(r)}</span></div></div>`;
}
const ekOtHTML = r => r.auto ? `<i class="ek-khud">KHUD</i><b>${num(r.q)}</b><small>pcs</small>` : `<b>= ${num(r.q)}</b><small>pcs</small>`;
function ekBalHTML(z) {
  const it = z.it, ml = Number(z.f.ml) || 0, L = x => ml ? num(r3(x * ml / 1000)) + ' ' + volU(it) : esc(qt(r3(x), it));
  if (!(z.made > 0)) return `⚠️ Pehle upar <b>1 batch = ?</b> likhein — phir yahan bata jayega`;   // v2.108.0: khali par "sab bat gaya ✓" ghalat tha
  if (!z.rows.length) return `✓ ${esc(qt(z.made, it))} ${esc(it.name)} stock mein jayega`;
  if (z.over) return `⚠️ Tadad zyada — bana sirf ${L(z.made)}, likha ${L(r3(z.made - z.left))}. Kam karein`;
  const parts = z.rows.filter(r => r.q > 0).map(r => num(r.q) + ' × ' + esc(r.it?.name || '')).join(' + ') || '—';
  return `Bana ${L(z.made)} = ${parts}${z.left > 0.0005 ? (z.fill ? ` · bacha khula ${L(z.left)} (stock mein nahi)` : ` · baqi <b>${esc(it.name)} +${L(z.left)}</b> stock mein`) : ' · sab bat gaya ✓'}`;
}
// ➕ naya item / + pehle wala item — isi maal se (cfg.packs: src = ye item, g = 1 pc mein kitna, mats = packing maal)
function ekNiHTML(z) {
  const s = ek.ni, it = z.it, old = s.mode === 'old', x = old && s.id ? (byId.get(s.id) || ekPos(s.id)) : null, vu = volU(it) === 'kg' ? 'kg' : 'L';
  const M = items.filter(y => y.id !== it.id && (isMat(y.id) || looksPack(y.id, y.name)));
  return `<div class="ek-mini"><div class="fc-lab">${old ? '+ PEHLE WALA ITEM — ISI MAAL SE' : '➕ NAYA ITEM — ISI MAAL SE'} <small>${esc(it.name)}</small></div>
    ${old ? (x ? `<div class="ek-sel sm"><div class="ek-seli"><b>${esc(x.name)}</b><small>${esc(x.code || '')}${x.pack > 1 ? ' · 1 ctn = ' + num(x.pack) : ''}</small></div><button type="button" class="ek-x" data-ek-niit="" aria-label="Badlo">✕</button></div>`
        : `<label class="hs-search"><input type="search" data-ek-niq="1" placeholder="🔍 item dhoondein (jaise Surf 2 kg)" value="${esc(s.q)}" autocomplete="off"></label><div id="ekNiHits" class="ek-hl">${ekNiHitsHTML()}</div>`)
      : `<label class="ek-f"><span>Naam</span><input type="text" data-ek-nif="n" maxlength="80" value="${esc(s.n)}" placeholder="jaise: Surf 2 kg"></label><div id="ekNiDup">${ekDupHTML(ekDup(String(s.n || '').trim()), 'out')}</div>`}
    ${!old || x ? `<div class="ek-two"><label class="ek-f"><span>Ek pc mein kitna (${vu})</span><input type="number" inputmode="decimal" min="0" step="any" data-ek-nif="g" value="${esc(s.g)}" placeholder="0.5"></label>
      ${old ? '' : `<label class="ek-f"><span>1 Ctn = kitne pcs</span><input type="number" inputmode="numeric" min="0" step="1" data-ek-nif="pk" value="${esc(s.pk)}" placeholder="ikhtiyari"></label>`}</div>
      ${(() => { const nSel = M.filter(y => s.mats[y.id]).length, hide = s.mHide && nSel, L = hide ? M.filter(y => s.mats[y.id]) : M;   // v2.108.1: chunne ke baad ⌃ Chhupao
        return `<div class="fc-lab">🎁 PACKING MAAL <small>har pc ke saath 1</small>${nSel ? `<button type="button" class="ek-tgl${hide ? '' : ' is-in'}" data-ek-mhide="1">${hide ? '▾ Sab (' + num(M.length) + ')' : '⌃ Chhupao'}</button>` : ''}</div>
      <div class="ek-mats">${L.map(y => `<button type="button" class="${s.mats[y.id] ? 'is-in' : ''}" data-ek-nimat="${esc(y.id)}">${s.mats[y.id] ? '✓ ' : ''}${esc(y.name)}</button>`).join('')}${hide ? '' : '<button type="button" class="alt" data-ek-pmnew="1">➕ naya packing</button>'}</div>`; })()}
      ${s.pm ? `<div class="ek-two ek-pm"><label class="ek-f"><span>Packing ka naam</span><input type="text" data-ek-pmf="n" maxlength="80" value="${esc(s.pm.n)}" placeholder="jaise: Pouch 2 kg"></label><label class="ek-f"><span>Rate (Rs fi pc)</span><input type="number" inputmode="decimal" min="0" step="any" data-ek-pmf="r" value="${esc(s.pm.r)}" placeholder="0"></label><button type="button" class="fc-go sm" data-ek-pmok="1">✓ Packing banao</button></div>` : ''}
      <div class="ek-nicost" id="ekNiCost">${ekNiCost(z)}</div>
      <div class="fc-btns"><button type="button" class="fc-no" data-ek-nix="1">✕ Chhoro</button><button type="button" class="fc-go" data-ek-niok="1"${s.busy ? ' disabled' : ''}>✓ Jor do</button></div>` : '<div class="fc-btns"><button type="button" class="fc-no" data-ek-nix="1">✕ Chhoro</button></div>'}</div>`;
}
function ekNiCost(z) {
  const s = ek.ni; if (!s) return ''; const g = Number(s.g) > 0 ? Number(s.g) * 1000 : 0; if (!g) return 'Ek pc ka wazan likhein — laagat khud';
  const unit = g / (srcMl(z.it.id) || gOf(z.it.id) || 1000), mc = Object.entries(s.mats).filter(([, q]) => Number(q) > 0).reduce((t, [id, q]) => t + Number(q) * rateOf(id, byId.get(id)), 0), cpp = unit * z.bulk + mc;
  const x = s.mode === 'old' && s.id ? (byId.get(s.id) || ekPos(s.id)) : null, sg = suggest({ pack: x ? Number(x.pack) || 0 : Number(s.pk) || 0 }, cpp);
  return `Laagat fi pc <b>${rs(cpp)}</b> · raye: W ${num(sg.wpcs)} · R ${num(sg.rpcs)}`;
}
function ekNiHitsHTML() {
  const s = ek.ni, q = String(s.q || '').trim(), outs = new Set(packsOf(ek.id).map(p => p.id)), inF = new Set(ek.fe.lines.map(l => String(l.id)));
  const pool = items.filter(x => x.id !== ek.id && !outs.has(x.id) && !inF.has(x.id) && !isMat(x.id));
  const L = q ? srch(pool, q, 10) : pool.filter(x => !forms()[x.id]).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 10); let pos = [];
  if (q && L.length < 6) { let P = []; try { P = stockPickList(); } catch {} const have = new Set(items.map(x => x.id)); pos = srch(P.filter(x => !have.has(x.id)), q, 6); }
  return [...L.map(x => [x, 0]), ...pos.map(x => [x, 1])].map(([x, p]) => `<button type="button" class="ek-hit${p ? ' pos' : ''}" data-ek-niit="${esc(x.id)}"><span><b>${esc(x.name)}</b><small>${p ? '🏪 POS · ' : ''}stock ${esc(qt(x.stock, x))}</small></span><em>›</em></button>`).join('') || '<p class="lk-note">Likh kar dhoondein.</p>';
}
function ekRateHTML(z) {
  const R = ekRateRows(z), can = posOn() && stockFactoryCanRate();
  return `<section class="ir-sec ek-c" id="ekRateC"><div class="ek-h"><span class="ek-no">5</span><b>Rates — har item alag</b><small>W ${wm()}% · R ${rm()}%</small></div>
    <div class="ek-rt">${R.map((x, i) => ekRateRowHTML(x, i)).join('')}</div>
    ${can ? `<label class="fc-posr"><input type="checkbox" data-ek-posr="1"${ek.posR ? ' checked' : ''}> <span>POS mein bhi yahi rate lagao<small>Save par — sirf jin ka rate badla · ⏳ naye item ka PC banne ke baad</small></span></label>` : `<small class="lk-note">${posOn() ? 'POS mein rate sirf ijazat wala laga sakta hai' : '📱 Factory sirf app mein — rate POS mein nahi jata'}</small>`}</section>`;
}
function ekRateRowHTML(x, i) {
  const it = x.it, w = { ...suggest(it, x.cpp), ...(ek.rEd[it.id] || {}) }, cr = curRates(it), pk = it.pack > 1;
  const cell = (k, lab) => (pk || k.endsWith('pcs')) ? `<label class="ek-rc${Math.abs((w[k] || 0) - (cr[k] || 0)) >= 1 ? ' chg' : ''}${ek.rEd[it.id]?.[k] != null ? ' own' : ''}"><small>${lab}</small><input type="number" inputmode="decimal" min="0" step="any" data-ek-r="${k}|${i}" value="${w[k] || ''}" aria-label="${esc(it.name)} ${lab}"><em>POS ${num(cr[k])}</em></label>` : '';
  return `<div class="ek-rr"><div class="ek-rn">${phImg(it.id, 'ek-th sm')}<b>${esc(it.name)}${isPend(it) ? ' ⏳' : ''}</b><small id="ekC${i}">laagat ${rs(x.cpp)}${pk ? ' · ' + rs(x.cpp * it.pack) + ' / ctn' : ''}</small></div>
    <div class="ek-rg ${pk ? 'c4' : 'c2'}">${cell('wctn', 'W CTN')}${cell('wpcs', 'W PCS')}${cell('rctn', 'R CTN')}${cell('rpcs', 'R PCS')}</div></div>`;
}
function ekSaveInner(z) {
  const own = isOwner(), send = posOn() && (own || canOf('fac.send')), tot = z.rows.reduce((t, r) => t + r.q, 0), nIt = z.rows.filter(r => r.q > 0).length;
  const lab = z.n === 0 ? '💾 Save — sirf formula' : ek.eb ? '💾 Edit save — ' + ek.eb.no : (own ? '💾 Save — formula + batch' : '💾 Save — batch') + (posOn() ? (send ? ' + POS stock' : ' (app mein)') : ' + factory stock');
  const gp = []; if (tot > 0) gp.push(num(tot) + ' pcs (' + num(nIt) + ' item)'); if (z.rows.length && !z.fill && z.left > 0.0005) gp.push(esc(qt(z.left, z.it)) + ' ' + esc(z.it.name)); if (!z.rows.length) gp.push(esc(qt(z.made, z.it)) + ' ' + esc(z.it.name));
  const gain = gp.join(' + ') || '0';
  const note = z.n === 0 ? 'Batch nahi banega — sirf nuskha mehfooz' : `${posOn() ? (send ? 'PC 1 min mein POS: ' : '📝 app mein rahega (POS ke liye malik 📤) · ') : '📱 factory stock: '}<b>+${gain}</b> · raw maal minus · 🏷 ${ekLbl() === 'none' ? 'label nahi' : 'label haan'} (⋮ se badlein)${own ? ' · ✏️ Edit = yahi screen' : ''}`;
  return `<button type="button" class="fc-ok-btn" data-ek-save="1"${ek.busy || (z.n && z.over) ? ' disabled' : ''}>${ek.busy ? '⏳ Save ho raha…' : lab}</button><small class="ek-note">${note}</small>`;
}
function ekHistHTML() {
  const T = today(), B = batches.filter(b => b.day === T).slice(0, 12);
  return `<div class="ek-h"><span class="ek-no sm" aria-hidden="true">📋</span><b>Aaj ke batch</b><small>sab: ⋮ → 📋 Batches</small></div>
    <div class="fc-list">${B.map(batchCard).join('') || '<p class="lk-note">Aaj abhi koi batch nahi.</p>'}</div>`;
}
// likhte waqt sirf hisaab wale hisse (input wahi rahe)
function ekLive() {
  const root = $('ekRoot'); if (!root || !ek) return; const z = ekCalc(); if (!z) return;
  const s = (id, h) => { const el = $(id); if (el && el.innerHTML !== h) el.innerHTML = h; }, a = document.activeElement;
  if (!(a && a.dataset?.ekPer != null)) s('ekPer', ekPerHTML(z));
  s('ekSum', ekSumHTML(z)); s('ekBulk', ekBulkHTML(z)); s('ekN', num(z.n)); $('ekOutC')?.classList.toggle('ek-dim', !z.n);
  const bal = $('ekBal'); if (bal) { bal.className = 'fc-rawsum ' + (z.over ? 'bad' : z.made > 0 ? 'ok' : 'warn'); s('ekBal', ekBalHTML(z)); }
  s('ekMade', esc(qt(z.made, z.it)));
  z.rows.forEach((r, i) => { const row = root.querySelector(`[data-ek-orow="${i}"]`); if (!row) return; row.classList.toggle('auto', !!r.auto); s('ekOt' + i, ekOtHTML(r));
    const sp = ekSplit(r), c = row.querySelector('[data-ek-oc]'), p = row.querySelector('[data-ek-op]'); if (c) c.placeholder = r.auto ? String(sp.c) : '0'; if (p) p.placeholder = r.auto ? String(sp.p) : '0'; });
  if (isOwner()) ekRateRows(z).forEach((x, i) => { s('ekC' + i, `laagat ${rs(x.cpp)}${x.it.pack > 1 ? ' · ' + rs(x.cpp * x.it.pack) + ' / ctn' : ''}`); const w = { ...suggest(x.it, x.cpp), ...(ek.rEd[x.it.id] || {}) }, cr = curRates(x.it);
    for (const k of ['wctn', 'wpcs', 'rctn', 'rpcs']) { const inp = root.querySelector(`[data-ek-r="${k}|${i}"]`); if (!inp) continue; if (inp !== a && ek.rEd[x.it.id]?.[k] == null) inp.value = w[k] || ''; inp.closest('.ek-rc')?.classList.toggle('chg', Math.abs((w[k] || 0) - (cr[k] || 0)) >= 1); } });
  s('ekSaveC', ekSaveInner(z));
}
// ---------- kaam ----------
function ekSelect(id) {
  id = String(id || '');
  if (!id) { ek = ekFresh(null); ekKeep(''); paint(); setTimeout(() => document.querySelector('#ekRoot [data-ek-q]')?.focus(), 40); return; }
  const it = byId.get(id);
  if (!it) { if (!isOwner()) { notice('Factory mein jorna sirf malik'); return; } facToggle(id, true).then(() => { loadItemsQuiet(); if (byId.get(id)) ekSelect(id); }); return; }
  if (!isOwner() && !forms()[id]) { notice('Is item ka formula malik banayega'); return; }
  ek = ekFresh(it); ekKeep(id); paint();
}
function ekPickAdd() {
  const ids = [...ek.sel].filter(id => !ek.fe.lines.some(l => String(l.id) === id)); if (!ids.length) return;
  let P = []; try { P = stockPickList(); } catch {} const PM = new Map(P.map(x => [x.id, x])), newF = ids.filter(id => !byId.has(id));
  if (newF.length && !isOwner()) { notice('🏪 POS wali items factory mein sirf malik jor sakta hai'); return; }
  for (const id of newF) facToggle(id, true);   // POS wali = factory mein bhi (foran)
  for (const id of ids) ek.fe.lines.push({ id, q: 0, n: byId.get(id)?.name || PM.get(id)?.name || '' });
  const n0 = ek.fe.lines.length - ids.length; ek.sel.clear(); ek.pq = ''; paint();
  notice('✓ ' + ids.length + ' maal jur gaya' + (newF.length ? ' (' + newF.length + ' factory mein bhi)' : '') + ' — ab har ek ki miqdaar likhein');
  setTimeout(() => document.querySelector(`#ekLines [data-ek-lq="${n0}"]`)?.focus(), 60);
}
async function ekNwSave() {
  const w = ek?.nw; if (!w || w.busy) return; const n = String(w.n || '').trim(); if (!n) { notice('Naam likhein'); return; }
  if (!isOwner()) { notice('Naya item sirf malik'); return; }
  const r = Number(w.r) > 0 ? r2(Number(w.r)) : 0; w.busy = true; paint();
  try {
    let id;
    if (posOn()) { const jid = await stockNewItemQuick({ name: n, costP: r, rpcs: 0, pack: w.kind === 'main' && Number(w.pk) > 1 ? Math.floor(Number(w.pk)) : 0 }); window.ntFacPend(jid, n, r); id = 'job:' + jid; }
    else { const x = locNew(n, r, { un: w.un, pk: w.kind === 'main' ? w.pk : 0 }); await cloud.setFactoryCfg(x.patch); id = x.id; }
    loadItemsQuiet();
    if (w.kind === 'main') { const it = byId.get(id); ek = ekFresh(it || null); if (it) ekKeep(id); else ek.id = id; notice(`✓ ${n} — ${posOn() ? '⏳ POS mein PC on hote hi banega' : '📱 sirf factory'} · ab neeche formula banayein`); }
    else { ek.fe.lines.push({ id, q: Number(w.q) > 0 ? r3(Number(w.q)) : 0, n }); ek.nw = null; ek.pq = ''; notice(`✓ ${n} formula mein jur gaya${posOn() ? ' — ⏳ POS mein PC on hote hi banega' : ''}`); }
    paint();
  } catch (e) { w.busy = false; paint(); notice('Nahi hua: ' + (e?.message || e)); }
}
function ekNwUse(id) {   // ⚠️ milta julta pehle se — wahi lo
  const w = ek?.nw; if (!w) return; ek.nw = null;
  if (w.kind === 'main') { ekSelect(id); return; }
  if (!ek.fe.lines.some(l => String(l.id) === String(id))) { if (!byId.has(String(id))) facToggle(String(id), true); ek.fe.lines.push({ id: String(id), q: Number(w.q) > 0 ? r3(Number(w.q)) : 0, n: byId.get(String(id))?.name || ekPos(id)?.name || '' }); }
  ek.pq = ''; paint(); notice('✓ Pehle wala item jur gaya (naya nahi bana)');
}
async function ekPmSave(to = 'ni') {   // ➕ naya packing maal (pouch / bag / bottle) — wahin · to 'ni' = naye item ka · 'self' = 🧴 har pcs ke saath (v2.108.1)
  const s = to === 'self' ? ek?.spm : ek?.ni?.pm; if (!s) return; const n = String(s.n || '').trim(); if (!n) { notice('Packing ka naam likhein'); return; }
  const put = id => { if (to === 'self') { if (ek?.fe) { ek.fe.self = ek.fe.self || {}; ek.fe.self[id] = 1; } if (ek) ek.spm = null; } else if (ek?.ni) { ek.ni.mats[id] = 1; ek.ni.pm = null; } };
  const d = ekDup(n).find(x => fold(x.name) === fold(n)); if (d) { put(String(d.id)); if (!byId.has(String(d.id))) matToggle(String(d.id), true); paint(); notice('✓ ' + d.name + ' pehle se tha — wahi chuna'); return; }
  const r = Number(s.r) > 0 ? r2(Number(s.r)) : 0;
  try { let id; if (posOn()) { const jid = await stockNewItemQuick({ name: n, costP: r, rpcs: 0 }); window.ntFacPend(jid, n, r, true); id = 'job:' + jid; } else { const x = locNew(n, r, { mat: true }); await cloud.setFactoryCfg(x.patch); id = x.id; }
    loadItemsQuiet(); put(id); paint(); notice('✓ ' + n + ' packing maal ban gaya' + (posOn() ? ' (⏳ POS mein PC banayega)' : '') + (to === 'self' ? ' — Save par formula mein' : '')); }
  catch (e) { notice('Nahi hua: ' + (e?.message || e)); }
}
async function ekNiSave() {
  const s = ek?.ni, it = ek && byId.get(ek.id); if (!s || s.busy || !it) return; if (!isOwner() || !cloud?.setFactoryCfg) { notice('Sirf malik'); return; }
  const g = Number(s.g) > 0 ? r3(Number(s.g) * 1000) : 0; if (!(g > 0)) { notice('Ek pc mein kitna — likhein'); return; }
  let id = s.mode === 'old' ? String(s.id || '') : ''; if (s.mode === 'old' && !id) { notice('Item chunein'); return; }
  const n = s.mode === 'old' ? (byId.get(id)?.name || ekPos(id)?.name || '') : String(s.n || '').trim(); if (!n) { notice('Naam likhein'); return; }
  const z = ekCalc(), mats = Object.entries(s.mats).filter(([, q]) => Number(q) > 0).map(([mid, q]) => ({ id: mid, q: r3(q), n: String(byId.get(mid)?.name || '').slice(0, 80) }));
  s.busy = true; paint();
  try {
    if (!id) { const unit = g / (srcMl(it.id) || gOf(it.id) || 1000), cpp = r2(unit * (z?.bulk || 0) + mats.reduce((t, m) => t + m.q * rateOf(m.id, byId.get(m.id)), 0)), pk = Number(s.pk) > 1 ? Math.floor(Number(s.pk)) : 0, sg = suggest({ pack: pk }, cpp);
      if (posOn()) { const jid = await stockNewItemQuick({ name: n, pack: pk, costP: cpp, rpcs: sg.rpcs, wpcs: sg.wpcs }); window.ntFacPend(jid, n, cpp); id = 'job:' + jid; }
      else { const x = locNew(n, cpp, { pk }); await cloud.setFactoryCfg(x.patch); id = x.id; } }
    const v = { src: it.id, g, mats }, patch = { packs: { [id]: v } };
    if (!id.startsWith('job:') && !id.startsWith('loc:') && !items.some(x => x.id === id)) patch.items = { [id]: true };   // POS wali item = factory mein bhi
    cfg = { ...(cfg || {}), packs: { ...(cfg?.packs || {}), [id]: v }, ...(patch.items ? { items: { ...(cfg?.items || {}), ...patch.items } } : {}) };
    loadItemsQuiet(); ek.ni = null; paint();
    notice(`✓ ${n} — ${it.name} se banega (${ekSz(v, it)} fi pc)${id.startsWith('job:') ? ' · ⏳ POS mein PC banayega' : ''}`);
    await cloud.setFactoryCfg(patch);
  } catch (e) { if (ek?.ni) ek.ni.busy = false; paint(); notice('Nahi hua: ' + (e?.message || e)); }
}
async function ekOutDel(k) {
  if (!isOwner() || !cloud?.setFactoryCfg) return; const x = byId.get(String(k));
  if (!confirm(`"${x?.name || k}" ab is maal se nahi banega? (packing ki setting hategi — item wahi rahega)`)) return;
  cfg = { ...(cfg || {}), packs: { ...(cfg?.packs || {}), [k]: null } }; delete ek.oq[k]; loadItemsQuiet(); paint();
  try { await cloud.setFactoryCfg({ packs: { [k]: null } }); notice('Hata diya'); } catch (e) { notice('Save nahi hua: ' + (e?.message || e)); }
}
function ekFormulaV(z) {   // malik — wahi cfg.formulas shakal (purana Formulas tab bhi wahi parhta hai)
  const F = ek.fe, nm = id => String(byId.get(String(id))?.name || '').slice(0, 80);
  const self = Object.entries(F.self || {}).filter(([, q]) => Number(q) > 0).map(([id, q]) => ({ id, q: r3(q), n: nm(id) }));
  return { per: r3(z.per), lines: F.lines.filter(l => Number(l.q) > 0).map(l => ({ id: String(l.id), q: r3(l.q), n: String(byId.get(String(l.id))?.name || l.n || '').slice(0, 80) })), lab: r2(F.lab), gas: r2(F.gas), cpp: r2(z.main), at: Date.now(),
    ml: Number(F.ml) > 0 ? r3(F.ml) : 0, auto: F.auto !== false, self: { mats: self }, sum: !!F.sum && !(Number(F.ml) > 0) };
}
const ekSetF = (id, v) => { cfg = { ...(cfg || {}), formulas: { ...(cfg?.formulas || {}), [id]: v } }; };
function ekBatchWrite(it, z0) {   // wahi batchCalc + batch doc (purana form jaisa) — PC factory-post wahi · kam stock par poochhe (null = ruk gaye)
  const pk = {}; for (const r of z0.rows) if (!r.self && r.q > 0) pk[r.k] = r.q;
  const keepFb = fb; fb = { mode: 'make', id: it.id, n: z0.n, real: '', pk, self: z0.fill ? String(z0.rows.find(r => r.self)?.q ?? '') : '', lbl: ekLbl(), busy: false, send: false };
  let z; try { z = batchCalc(); } finally { fb = keepFb; }
  if (!z) throw Error('Formula nahi mila');
  if (z.over) throw Error('Tadad zyada — bana kam');
  if (z.kam.length && !confirm(`${z.kam.map(l => l.name).join(', ')} stock mein kam hai.\nPhir bhi darj karein? (${posOn() ? 'POS' : 'factory stock'} mein minus ho jayega)`)) return null;
  const send = posOn() && (isOwner() || canOf('fac.send')), mode = ekLbl();
  const outs = z.k.rows.map(r => ({ id: r.it.id, name: r.it.name, q: r.n, c: r2(r.c) }));
  const lbl = [...(z.fill || !packsOf(it.id).length ? labelSpecs(it, z.out, mode) : []), ...z.k.rows.flatMap(r => labelSpecs(r.it, r.n, mode))].slice(0, 6);
  const d = { no: batchNo(), itemId: it.id, name: it.name, n: z0.n, per: z.f.per, out: z.out, outs, kind: 'make', lines: z.lines.map(l => ({ id: l.id, name: l.name, q: r3(l.q), c: r2(l.c) })), cost: Math.round(z.total), oh: z.oh, labels: lbl, byName: whoOf() || '', day: today(), hold: posOn() && !send, app: !posOn() };
  d.loc = posOn() && hasLoc(d);
  const eb = ek.eb;
  if (eb) { const fresh = ['new', 'hold', 'cancelReq', 'app'].includes(eb.status) && !eb.adjNo;
    if (fresh) return { msg: `✓ ${eb.no} edit — ${it.name}`, done: cloud.editFactoryBatch(eb.id, d) };
    return { msg: `✓ ${eb.no} wapas + naya ${eb.no}E${d.hold ? ' (📝 app mein)' : ''}`, done: (async () => { await cloud.factoryBatchAct(eb.id, 'cancel'); const r = cloud.addFactoryBatch({ ...d, no: eb.no + 'E' }); await r?.done; })() }; }
  const r = cloud.addFactoryBatch(d);
  if (d.app && r?.id) { appB = [...appB.filter(b => b.id !== r.id), { ...d, id: r.id, status: 'app', at: Date.now() }]; fsCache = null; }   // foran factory stock mein
  return { msg: d.app ? `✓ ${d.no} · ${it.name} — 🏭 factory stock mein darj${d.labels.length ? ' · 🏷 label' : ''}` : d.hold ? `✓ ${d.no} · ${it.name} — 📝 app mein mehfooz (POS ke liye ⋮ → Batches → 📤)` : `✓ ${d.no} · ${it.name} — PC 1 min mein POS stock badlega${d.labels.length ? ' + 🏷 label' : ''}`,
    done: Promise.resolve(r?.done).then(() => { if (d.app && d.labels.length) sendLabels(d.labels, d.no); }) };
}
function ekRatesWrite(z) {   // ☑ POS mein bhi — sirf jin ka rate badla (wahi stockAgentItemSave jo 🏷 Rates tab)
  let n = 0, skip = 0;
  for (const x of ekRateRows(z)) { const it = x.it, w = { ...suggest(it, x.cpp), ...(ek.rEd[it.id] || {}) }, cr = curRates(it);
    if (!['wctn', 'wpcs', 'rctn', 'rpcs'].some(k => (it.pack > 1 || k.endsWith('pcs')) && Math.abs((w[k] || 0) - (cr[k] || 0)) >= 1)) continue;
    if (isPend(it) || isLoc(it)) { skip++; continue; }
    const p = it.pack > 1 ? { wctn: w.wctn, wpcs: w.wpcs, rctn: w.rctn, rpcs: w.rpcs } : { wpcs: w.wpcs, rpcs: w.rpcs };
    try { stockAgentItemSave(it.id, p).then(r => { if (r && r.ok === false && !r.pending) notice(it.name + ': ' + (r.why || 'rate nahi laga')); }).catch(e => notice(it.name + ': ' + (e?.message || e))); n++; } catch (e) { notice(it.name + ': ' + (e?.message || e)); } }
  return { n, skip };
}
async function ekSave() {
  if (!ek || ek.busy) return; const z = ekCalc(); if (!z) { notice('Pehle item chunein'); return; }
  const it = z.it, own = isOwner(), F = ek.fe;
  if (own) { const miss = F.lines.filter(l => !(Number(l.q) > 0));
    if (!F.lines.length) { notice('Kam se kam ek raw maal jorein'); return; }
    if (miss.length) { notice('⚠️ ' + miss.map(l => byId.get(String(l.id))?.name || l.n || '').slice(0, 3).join(', ') + ' — kitna? likhein (ya ✕ hatayein)'); return; }
    if (!(z.per > 0)) { notice('1 batch mein kitna banta hai — likhein'); return; } }
  else if (!forms()[it.id]) { notice('Is item ka formula malik banayega'); return; }
  if (z.n > 0) { if (!canFacBatch()) { notice('🔒 Batch ki ijazat nahi (malik: Settings → Mulazim)'); return; } if (!cloud?.addFactoryBatch) { notice('App update karein'); return; }
    if (z.over) { notice('Tadad zyada — bana kam. Theek karein'); return; } if (!(z.made > 0)) { notice('Kitna bana — formula dekhein'); return; } }
  if (!cloud?.setFactoryCfg && own) { notice('App update karein'); return; }
  if (!own && !(z.n > 0)) { notice('Kitne batch bane — + dabayein'); return; }
  ek.busy = true; ekLive();
  const oldF = cfg?.formulas?.[it.id], v = own ? ekFormulaV(z) : null; let wrote = false;
  const undo = () => { if (v && !wrote) { ekSetF(it.id, oldF ?? null); loadItemsQuiet(); } if (ek) { ek.busy = false; ekLive(); } };
  try {
    if (v) { ekSetF(it.id, v); loadItemsQuiet(); }   // foran (tez) — batchCalc bhi naya nuskha parhe
    let msg = '✓ ' + it.name + ' — formula save', r = null;
    if (z.n > 0) { r = ekBatchWrite(it, z); if (!r) { undo(); return; } msg = r.msg; }   // kam stock par "nahi" = kuch save nahi (formula bhi nahi)
    wrote = true;
    const ps = [...(v ? [cloud.setFactoryCfg({ formulas: { [it.id]: v } })] : []), ...(r ? [r.done] : [])];
    const rr = own && ek.posR && posOn() && stockFactoryCanRate() ? ekRatesWrite(z) : null;
    notice(msg + (rr?.n ? ' · 🏷 ' + rr.n + ' rate POS ko' : '') + (rr?.skip ? ' · ⏳ ' + rr.skip + ' naye item ka rate PC banne ke baad' : ''));
    ek = ekFresh(byId.get(it.id) || it); ekKeep(it.id); paint(); try { stockRepaint(); } catch {}
    Promise.all(ps).catch(er => notice('❌ Save nahi hua: ' + (er?.message || er)));
  } catch (e) { undo(); notice('Save nahi hua: ' + (e?.message || e)); }
}
// ✏️ edit — wahi screen bhari hui (POS mein nahi gaya = wahi batch badle · gaya = wapas + naya)
function ekEdit(id) {
  const b = batches.find(x => x.id === id) || appB.find(x => x.id === id); if (!b) return;
  const it = byId.get(String(b.itemId)); if (b.kind === 'pack' || !ekOn() || !it || !forms()[it.id]) { openBatch(id); return; }
  ek = ekFresh(it, b); ek.n = Math.max(1, Math.min(10, Number(b.n) || 1));
  const put = (k, q, pk) => { q = Math.max(0, Math.floor(Number(q) || 0)); ek.oq[k] = pk > 1 ? { c: String(Math.floor(q / pk)), p: String(q % pk) } : { c: '', p: String(q) }; };
  const O = new Map((b.outs || []).map(o => [String(o.id), Number(o.q) || 0]));
  for (const p of packsOf(it.id)) put(p.id, O.get(p.id) || 0, Number(byId.get(p.id)?.pack) || 0);   // jo is batch mein nahi tha = 0 (khud wala na bane)
  const f = forms()[it.id]; if (Number(f.ml) > 0 || selfMats(f).length) put('_self', b.out, Number(it.pack) || 0);
  try { $('dialog')?.close(); } catch {} st.view = 'ek'; keep(); ekKeep(it.id);
  if (!$('fcRoot')) { try { window.ntRecentOpen?.({ open: { kind: 'route', v: 'factory' } }); } catch {} } else paint();
  setTimeout(() => { if ($('fcRoot') && !$('ekRoot')) paint(); $('ekBatchC')?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }); }, 350);
}
function ekFactoryStock() { try { window.ntRecentOpen?.({ open: { kind: 'stock', screen: 'factory' } }); } catch (e) { notice('Stock screen nahi khuli: ' + (e?.message || e)); } }

// ---------- 📷 v2.108.0: factory items ki HD TASVEER · ✨ AI command · 📄 rate list PDF (asal kaam fac-photo.js — zaroorat par load) ----------
//   Index factory/phIdx ek doc (har item ka chhota namoona ~3 KB) — Stock / Sale / factory list mein tez. Lagana sirf malik · dekhna / bhejna CAP fac.catalog.
let phIdx = {}, phStop = null, phErr = false, phT = 0, phMod = null; const phU = new Map();   // id -> {v, url}
function phWatch() {
  if (phStop || phErr || !cloud?.listenFacPhotos) return;
  try { phStop = cloud.listenFacPhotos(m => { if (!m) { phErr = true; try { phStop?.(); } catch {} phStop = null; return; } phIdx = m; phSweep(); phChanged(); }); } catch { phErr = true; }
}
function phChanged() { clearTimeout(phT); phT = setTimeout(() => { try { if ($('fcRoot')) paint(); } catch {} try { stockRepaint(); } catch {} try { window.ntSaleRepaint?.(); } catch {} }, 60); }
function phSweep() { for (const [id, c] of phU) if (!phIdx[id] || phIdx[id].v !== c.v) { try { URL.revokeObjectURL(c.url); } catch {} phU.delete(id); } }
function phThumb(id) {
  id = String(id || ''); const m = phIdx[id]; if (!m?.t) return ''; const c = phU.get(id); if (c && c.v === m.v) return c.url;
  try { const u8 = typeof m.t.toUint8Array === 'function' ? m.t.toUint8Array() : m.t instanceof Uint8Array ? m.t : null; if (!u8) return '';
    const url = URL.createObjectURL(new Blob([u8], { type: 'image/jpeg' })); if (c) { try { URL.revokeObjectURL(c.url); } catch {} } phU.set(id, { v: m.v, url }); return url; } catch { return ''; }
}
const phCan = () => isOwner() || (canOf('fac.catalog') !== false && (canFacBatch() || canOf('v:factory') !== false));
const phImg = (id, cls, tap = true) => { const th = phThumb(id); return th ? `<img class="${cls}" src="${esc(th)}" alt="" loading="lazy"${tap && phCan() ? ` data-ek-ph="${esc(id)}"` : ''}>` : ''; };
const phSize = id => { const p = packOf(id), src = p ? byId.get(String(p.src)) : null; return p && src ? ekSz(p, src) : ''; };
function phSell() {   // bikne wale factory items: formula wala + us se bane (packing) — ek khandan saath
  const F = forms(), seen = new Set(), out = [], add = x => { if (x && !seen.has(x.id) && !isPend(x) && !isMat(x.id)) { seen.add(x.id); out.push(x); } };
  for (const x of items.filter(y => F[y.id]).sort((a, b) => String(a.name).localeCompare(String(b.name)))) { add(x); for (const p of packsOf(x.id).sort((a, b) => (Number(b.g) || 0) - (Number(a.g) || 0))) add(byId.get(p.id)); }
  for (const p of packDefs()) add(byId.get(p.id));
  return out;
}
function phCtx() {
  return { cloud, notice, own: isOwner(), esc, num, rs, srch, idx: () => phIdx, thumb: phThumb,
    setIdx: (id, meta) => { const n = { ...phIdx }; if (meta) n[String(id)] = meta; else delete n[String(id)]; phIdx = n; phSweep(); phChanged(); },
    item: id => byId.get(String(id)) || ekPos(id) || null, sell: phSell, rates: it => it ? curRates(it) : { wctn: 0, wpcs: 0, rctn: 0, rpcs: 0 }, size: phSize,
    cat: () => cfg?.cat || {}, saveCat: p => { cfg = { ...(cfg || {}), cat: { ...(cfg?.cat || {}), ...p } }; return cloud.setFactoryCfg({ cat: p }); },
    dlg, pdf: pdfFileOf, repaint: phChanged };
}
const phLoad = () => phMod || (phMod = import('./fac-photo.js?v=2.154.0').catch(e => { phMod = null; throw e; }));
async function phOpen(id) { if (!phCan()) { notice('🔒 Tasveer ki ijazat nahi (malik: Settings → Mulazim)'); return; } watchCfg(); phWatch(); await ensureItems(); try { (await phLoad()).photoSheet(phCtx(), id); } catch (e) { notice('Tasveer nahi khuli: ' + (e?.message || e)); } }
async function phCmds() { if (!isOwner()) { notice('AI commands sirf malik'); return; } watchCfg(); phWatch(); await ensureItems(); try { (await phLoad()).commandsDlg(phCtx()); } catch (e) { notice('Nahi khula: ' + (e?.message || e)); } }
async function phCat() { if (!phCan()) { notice('🔒 Rate list PDF ki ijazat nahi (malik: Settings → Mulazim)'); return; } watchCfg(); phWatch(); await ensureItems(); try { (await phLoad()).catalogOpen(phCtx()); } catch (e) { notice('Nahi khula: ' + (e?.message || e)); } }
window.ntFacThumb = id => { phWatch(); return phThumb(id); };   // Stock / Sale list ki chhoti tasveer (pos-stock.js / sale.js)
window.ntFacPhOpen = id => phOpen(id);
document.addEventListener('click', e => { const t = e.target.closest?.('[data-fac-ph]'); if (!t) return; e.preventDefault(); e.stopPropagation(); phOpen(t.dataset.facPh); }, true);   // Stock / Sale ki tasveer = poori khirki

// ---------- dialog ----------
function dlg(title, html) { const d = $('dialog'); if (!d) return; d.classList.remove('search-dialog'); d.classList.add('full-dialog'); $('dialogTitle').textContent = title; $('dialogBody').innerHTML = `<div class="ir-root fc-root fc-dlg">${html}</div>`; if (!d.open) d.showModal(); }

// ---------- clicks ----------
document.addEventListener('click', e => {
  const o = e.target.closest?.('[data-fac-open]'); if (o) { e.preventDefault(); openBatch(); return; }
  const mcq = e.target.closest?.('[data-mc-open],[data-mc-it],[data-mc-g],[data-mc-xadd],[data-mc-xdel],[data-mc-save],[data-mc-del]');   // v2.103.8: 🧴
  if (mcq && mcq.closest('.fc-root')) { const d = mcq.dataset;
    if (d.mcOpen != null) { mcOpen(d.mcOpen); return; } if (!mc) return;
    if (d.mcIt != null) { if (d.mcIt) { if (cfg?.mcost?.[d.mcIt]) { mcOpen(d.mcIt); return; } mcPick(d.mcIt); } else { mc.id = ''; mc.g = ''; mc.kg = ''; mc.kgAuto = false; } mcPaint(); return; }
    if (d.mcG) { mc.g = Number(d.mcG); mcPaint(); return; }
    if (d.mcXadd != null) { mc.x.push({ n: d.mcXadd, rs: '' }); mcPaint(); const k = mc.x.length - 1; setTimeout(() => document.querySelector(`#fcMc [data-mc-${d.mcXadd ? 'xr' : 'xn'}="${k}"]`)?.focus(), 30); return; }
    if (d.mcXdel != null) { mc.x.splice(Number(d.mcXdel), 1); mcPaint(); return; }
    if (d.mcSave != null) { mcSave(false); return; } if (d.mcDel != null) { mcSave(true); return; } }
  const kh = e.target.closest?.('[data-fe-khula]'); if (kh && fe && kh.closest('#fcForm')) { khulaAdd(); return; }   // v2.103.7
  const fx = e.target.closest?.('[data-fe-pf],[data-fe-more],[data-fe-addsel],[data-fe-pos],[data-fe-mlset],[data-fe-auto],[data-fe-mdel],[data-fe-madd],[data-fe-addf],[data-fe-fadd],[data-fe-fdel],[data-fe-mraw]');   // v2.101.7: 🧪 raw maal list · v2.102.0 🧴
  if (fx && fe && fx.closest('#fcForm')) { const d = fx.dataset;
    if (d.feMlset) { fe.ml = Number(d.feMlset) || 0; fe.auto = true; formPaint(); return; }
    if (d.feAuto != null) { fe.auto = d.feAuto === '1'; formPaint(); return; }
    if (d.feMdel || d.feMadd) { const [k, id] = String(d.feMdel || d.feMadd).split('|'), M = k === 'self' ? (fe.self = fe.self || {}) : fe.fms[Number(k.slice(1))]?.mats; if (!M) return; if (d.feMdel) delete M[id]; else M[id] = M[id] || 1; formPaint(); return; }
    if (d.feMraw) { const q = Number(fe.self?.[d.feMraw]) || 1; delete fe.self[d.feMraw]; fe.lines.push({ id: d.feMraw, q: r3(q * fe.per), n: byId.get(d.feMraw)?.name || '' }); formPaint(); return; }   // galti se bharne mein gaya = wapas raw
    if (d.feAddf != null) { fe.addF = true; formPaint(); return; }
    if (d.feFadd) { const x = byId.get(d.feFadd); fe.fms = [...(fe.fms || []), { id: d.feFadd, g: mlFromName(x?.name) || 0, mats: {} }]; fe.addF = false; formPaint(); return; }
    if (d.feFdel != null) { fe.fms.splice(Number(d.feFdel), 1); formPaint(); return; }
    if (d.fePf) { fe.pf = d.fePf; fe.lim = 300; formPaint(['feHits']); return; }
    if (d.feMore != null) { fe.lim += 100; formPaint(['feHits']); return; }
    if (d.feAddsel != null) { const ids = [...fe.sel].filter(id => !fe.lines.some(l => l.id === id)), P = new Map((() => { try { return stockPickList(); } catch { return []; } })().map(x => [x.id, x])), newF = ids.filter(id => !byId.has(id));
      if (newF.length && !isOwner()) { notice('🏪 POS wali items factory mein sirf malik jor sakta hai'); return; }
      for (const id of newF) facToggle(id, true);   // v2.101.8: POS wali = factory mein bhi (foran, cfg)
      for (const id of ids) feAdd(id, byId.get(id)?.name || P.get(id)?.name || ''); fe.sel.clear(); fe.q = ''; formPaint(); notice('✓ ' + ids.length + ' items jur gayi' + (newF.length ? ' (' + newF.length + ' factory mein bhi)' : '') + ' — ab har ek ki ginti likhein'); setTimeout(() => document.querySelector('#fcForm [data-fe-q]')?.scrollIntoView?.({ block: 'center', behavior: 'smooth' }), 60); return; }
    if (d.fePos) { const x = (stockPickList() || []).find(y => y.id === d.fePos); facToggle(d.fePos, true).then(() => { if (fe) feAdd(d.fePos, x?.name || ''); fe.q = ''; formPaint(); notice('✓ ' + (x?.name || 'Item') + ' factory + formula mein'); }); return; } }
  const fq = e.target.closest?.('[data-fa-on],[data-fa-mat],[data-fa-new],[data-fa-scan]');   // v2.101.6: ➕ item jorein
  if (fq && fa && fq.closest('#fcAdd')) { const d = fq.dataset;
    if (d.faOn) { const x = (stockPickList() || []).find(y => y.id === d.faOn); facToggle(d.faOn, true).then(() => notice('✓ ' + (x?.name || 'Item') + ' factory mein jur gayi (naya nahi bana)')); return; }
    if (d.faMat) { const x = (stockPickList() || []).find(y => y.id === d.faMat); matToggle(d.faMat, true).then(() => notice('📦 ' + (x?.name || 'Item') + ' packing maal mein')); return; }
    if (d.faNew != null) { const q = fa.q.trim(); stockNewItemOpen(/^\d{5,}$/.test(q) ? { fac: true, code: q } : { fac: true, name: q }); return; }
    if (d.faScan != null) { scanPick(code => openAdd(code)); return; } }
  const gx = e.target.closest?.('[data-fe-facon],[data-fe-relink],[data-fe-mkpos],[data-fe-locpos]');   // v2.103.4
  if (gx && gx.closest('.fc-root')) { const d = gx.dataset;
    if (d.feFacon) { facToggle(d.feFacon, true).then(() => { if (fe && $('fcForm')) formPaint(); notice('☑ Factory mein jur gayi'); }); return; }
    if (d.feRelink && fe) { const [i, id] = d.feRelink.split('|'), l = fe.lines[Number(i)]; if (!l) return; const P = (() => { try { return stockPickList(); } catch { return []; } })(), x = P.find(y => String(y.id) === id);
      l.id = id; l.n = x?.name || l.n; const done = () => { if (fe && $('fcForm')) formPaint(); notice('🔗 ' + (x?.name || '') + ' se jur gayi — formula 💾 Save kar dein'); }; if (!byId.has(id)) facToggle(id, true).then(done); else done(); return; }
    if (d.feMkpos != null) { mkPos(Number(d.feMkpos)); return; }
    if (d.feLocpos) { locToPos(d.feLocpos); return; } }
  const mq = e.target.closest?.('[data-fm-open],[data-fm-del],[data-mv-f],[data-mv-save],[data-fa-loc],[data-fl-save],[data-fl-un],[data-fc-poson]');   // v2.103.0
  if (mq && mq.closest('.fc-root')) { const d = mq.dataset;
    if (d.fmOpen) { mvOpen(d.fmOpen); return; }
    if (d.fmDel) { if (!isOwner() || !confirm('Ye entry hatani hai? (factory stock wapas)')) return; moves = moves.filter(m => m.id !== d.fmDel); fsCache = null; loadItemsQuiet(); repaint(); cloud?.delFactoryMove?.(d.fmDel).then(() => notice('Hata di')).catch(er => notice('Nahi hua: ' + (er?.message || er))); return; }
    if (d.mvF && mv) { mv.f = d.mvF; mv.q = ''; mvPaint(); return; }
    if (d.mvSave != null) { mvSave(); return; }
    if (d.faLoc != null && fa) { locForm(fa.q.trim()); return; }
    if (d.flUn && fl) { fl.un = d.flUn; locPaint(); return; }
    if (d.flSave != null) { locSave(); return; }
    if (d.fcPoson != null) { setPosOn(d.fcPoson === '1'); return; } }
  const pq = e.target.closest?.('[data-fc-pick],[data-fp-f],[data-fp-more]');
  if (pq) { const d = pq.dataset; if (d.fcPick != null) { openPicker(); return; } if (!pk) return; if (d.fpF) { pk.f = d.fpF; pk.lim = 60; } else pk.lim += 100; pickPaint(); return; }
  const t = e.target.closest?.('[data-fb-bc],[data-fc-lblnow],[data-fc-per],[data-fc-tab],[data-fc-set],[data-fc-batch],[data-fc-b],[data-fc-f],[data-fc-fnew],[data-fc-photo],[data-fc-rate],[data-fc-pdf],[data-fc-bpdf],[data-fc-act],[data-fc-app2pos],[data-fc-edit],[data-fc-pur],[data-fc-lbldef],[data-fc-autosend],[data-fc-prn],[data-fc-newitem],[data-fc-ijobs],[data-fc-lbl],[data-fc-item],[data-fr-scope],[data-fr-reset],[data-fc-pkdef],[data-pd-it],[data-pd-src],[data-pd-save],[data-pd-del],[data-fb-send],[data-fb-mode],[data-fc-penddel],[data-fg-f],[data-fg-bills],[data-fg-save],[data-fg-hist],[data-fg-del],[data-fb-it],[data-fb-n],[data-fb-lbl],[data-fb-more],[data-fb-ok],[data-fe-del],[data-fe-mv],[data-fe-add],[data-fe-save],[data-fe-rpos],[data-fe-rm],[data-pf-prod],[data-pf-prodnew],[data-pf-pick],[data-pf-set],[data-pf-del],[data-pf-back],[data-pf-save]');
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
  if (d.fcPrn != null) { if (!cloud?.setFactoryCfg) return; const n = Number(d.fcPrn); cfg = { ...(cfg || {}), prn: n }; setPaint(); cloud.setFactoryCfg({ prn: n }).catch(er => notice('Save nahi hua: ' + (er?.message || er))); return; }
  if (d.fcAutosend != null) { if (!cloud?.setFactoryCfg) return; cfg = { ...(cfg || {}), autoSend: d.fcAutosend === '1' }; setPaint(); cloud.setFactoryCfg({ autoSend: d.fcAutosend === '1' }).catch(er => notice('Save nahi hua: ' + (er?.message || er))); return; }
  if (d.fcLbldef) { if (!cloud?.setFactoryCfg) return; cfg = { ...(cfg || {}), lbl: d.fcLbldef }; setPaint(); cloud.setFactoryCfg({ lbl: d.fcLbldef }).catch(er => notice('Save nahi hua: ' + (er?.message || er))); return; }
  if (d.fgF) { gfl = d.fgF; paint(); return; }
  if (d.fcNewitem != null) { openAdd(); return; }   // v2.101.6: pehle dhoondo (pehle se ho to jorein — do dafa nahi)
  if (d.fcIjobs != null) { stockIjobsOpen(); return; }
  if (d.fcLbl) { stockLabelOpen(d.fcLbl); return; }
  if (d.fcItem) { stockItemOpen(d.fcItem); return; }
  if (d.frScope) { rScope = d.frScope; paint(); return; }
  if (d.frReset) { delete rEd[d.frReset]; paint(); return; }
  if (d.fcPkdef != null) { pkDefOpen(d.fcPkdef); return; }
  if (pd && d.pdIt) { pd.id = d.pdIt; pkDefPaint(); return; }
  if (pd && d.pdSrc) { pd.src = d.pdSrc; pkDefPaint(); return; }
  if (d.pdSave != null) { pkDefSave(false); return; }
  if (d.pdDel != null) { pkDefSave(true); return; }
  if (d.fbSend != null && fb) { fb.send = d.fbSend === '1'; batchPaint(); return; }
  if (d.fbMode != null) { openBatch(null, d.fbMode); return; }
  if (d.fgBills != null) { stockOpenGinti(); return; }
  if (d.fgSave) { gSave(d.fgSave, t); return; }
  if (d.fgHist) { if (gOpen.has(d.fgHist)) gOpen.delete(d.fgHist); else gOpen.add(d.fgHist); paint(); return; }
  if (d.fgDel) { if (!confirm('Is item ki aaj ki ginti hatani hai? (POS mein farq wapas)')) return; stockCountDel(d.fgDel).then(() => { notice('Ginti hata di'); setTimeout(() => paint(), 250); }).catch(er => notice('Nahi hua: ' + (er?.message || er))); return; }
  if (d.fcPenddel) { if (confirm('Ye pending item factory se hatani hai? (POS job wahi rahega)')) { window.ntFacPendDel(d.fcPenddel); if ($('fcSet')) setPaint(); } return; }
  if (d.fcBpdf) { const b = batches.find(x => x.id === d.fcBpdf); if (b && pdfOf) { $('dialog')?.close(); pdfOf(pdfHTML([b], 'Batch ' + b.no + ' — ' + b.name), 'Batch ' + b.no); } return; }
  if (d.fcLblnow) { const b = batches.find(x => x.id === d.fcLblnow); if (!b) return; const mode = cfg?.lbl && cfg.lbl !== 'none' ? cfg.lbl : 'pcs';
    const L = [...(b.out > 0 ? labelSpecs(byId.get(String(b.itemId)), Number(b.out), mode) : []), ...(b.outs || []).flatMap(o => labelSpecs(byId.get(String(o.id)), Number(o.q), mode))].slice(0, 6);
    if (!L.length) { notice('🏷 Is item ka barcode nahi mila'); return; } if (!confirm(`${b.no}: ${num(L.reduce((t, x) => t + x.copies, 0))} label chhapein?`)) return; sendLabels(L, b.no); return; }   // v2.103.42
  if (d.fcAct) { const id = d.id; if (d.fcAct === 'cancel' && !confirm('Ye batch wapas lena hai? POS mein ulta adjustment banega (tayyar maal −, raw maal +).')) return;
    if (d.fcAct === 'cancelNow' && !confirm(batches.find(x => x.id === id)?.status === 'app' ? 'Ye batch cancel? Factory stock wapas (tayyar maal −, raw maal +) — foran.' : 'Ye batch cancel? (abhi POS mein nahi gaya — foran khatam)')) return;
    if (d.fcAct === 'cancelNow') { appB = appB.filter(x => x.id !== id); fsCache = null; }   // v2.103.0: foran stock wapas
    if (d.fcAct === 'send' && !confirm('POS mein bhejein? PC 1 min mein stock badlega — us ke baad edit sirf "wapas + naya".')) return;
    Promise.resolve(cloud?.factoryBatchAct?.(id, d.fcAct)).then(() => { notice(d.fcAct === 'cancel' ? '↩ Wapas ho raha — PC 1 min' : d.fcAct === 'cancelNow' ? '✕ Batch cancel' : d.fcAct === 'send' ? '📤 POS ko bheja — PC 1 min' : '↻ Dobara bheja'); $('dialog')?.close(); }).catch(er => notice('Nahi hua: ' + (er?.message || er))); return; }
  if (d.fcApp2pos) { app2pos(d.fcApp2pos); return; }   // v2.103.2
  if (d.fcEdit) { if (ekOn()) ekEdit(d.fcEdit); else openBatch(d.fcEdit); return; }   // v2.107.0: edit = wahi ek-screen
  if (d.fbIt && fb) { fb.id = d.fbIt; fb.real = ''; fb.pk = {}; batchPaint(); return; }
  if (d.fbN && fb) { fb.n = Number(d.fbN); fb.real = ''; batchPaint(); return; }
  if (d.fbLbl && fb) { fb.lbl = d.fbLbl; batchPaint(); return; }
  if (d.fbBc != null && fb) { fb.lbl = d.fbBc === '1' ? (fb.lbl0 || cfg?.lbl || 'pcs') : 'none'; if (fb.lbl !== 'none') fb.lbl0 = fb.lbl; try { localStorage.setItem('sam-fc-bc', d.fbBc); } catch {} batchPaint(); return; }   // v2.103.42: 🏷 Haan / Nahi
  if (d.fbMore != null && fb) { fb.more = !fb.more; batchPaint(); return; }
  if (d.fbOk != null) { batchOk(); return; }
  if (d.feDel != null && fe) { fe.lines.splice(Number(d.feDel), 1); formPaint(); return; }
  if (d.feMv != null && fe) { const l = fe.lines[Number(d.feMv)]; if (l) { fe.self = { ...(fe.self || {}), [l.id]: 1 }; fe.lines.splice(Number(d.feMv), 1); } formPaint(); return; }   // v2.102.0: raw -> bharne ka maal
  if (d.feAdd && fe) { feAdd(d.feAdd, byId.get(d.feAdd)?.name || ''); fe.q = ''; formPaint(); return; }
  if (d.feRpos && fe) { setRate(d.feRpos, -1); return; }
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
  if (d.fgKg != null || (d.fgPcs != null && gOf(d.fgPcs))) { const row = t.closest('.fc-g'), id = d.fgKg ?? d.fgPcs, h = row?.querySelector('[data-fg-kgh]'), x = byId.get(String(id));   // v2.102.7: ⚖️ kg <-> pcs
    if (d.fgKg != null) { const p = row?.querySelector('[data-fg-pcs]'), c0 = row?.querySelector('[data-fg-ctn]'); const v = t.value === '' ? '' : String(pcsOfKg(t.value, id)); if (p) p.value = v; if (c0 && v !== '') c0.value = '';
      if (h) h.innerHTML = v === '' ? `1 ${esc(un(x))} = ${num(gOf(id))} g` : `${num(t.value)} kg = <b>${num(Number(v))} ${esc(un(x))}</b> — yahi save honge`; }
    else { const k = row?.querySelector('[data-fg-kg]'); if (k) k.value = t.value === '' ? '' : String(kgOf(t.value, id)); if (h) h.innerHTML = t.value === '' ? `1 ${esc(un(x))} = ${num(gOf(id))} g` : `${num(t.value)} ${esc(un(x))} = <b>${num(kgOf(t.value, id))} kg</b>`; }
    return; }
  if (d.mvSearch != null && mv) { mv.q = t.value || ''; clearTimeout(qT); qT = setTimeout(() => mvPaint(['fcMvList']), 180); return; }   // v2.103.0
  if (d.mvNote != null && mv) { mv.note = t.value || ''; return; }
  if (d.mvQ != null && mv) { const id = d.mvQ, v = mv.sel[id] = mv.sel[id] || {}; v[d.mvK] = t.value; const box = t.closest('.fc-mvr'); if (d.mvK === 'kg') { v.ctn = ''; v.pcs = ''; box?.querySelectorAll('[data-mv-k="ctn"],[data-mv-k="pcs"]').forEach(i => { i.value = ''; }); } else if (v.kg) { v.kg = ''; const k = box?.querySelector('[data-mv-k="kg"]'); if (k) k.value = ''; }
    const x = byId.get(id), tt = mvTot(id, v), h = document.querySelector(`#fcMv [data-mv-h="${CSS.escape(id)}"]`); if (h) h.innerHTML = tt > 0 ? `= <b>${esc(qk(tt, x))}</b> · stock ${mv.kind === 'aaya' ? 'ab' : 'baad'} ${esc(qk(r3(x.stock + (mv.kind === 'aaya' ? tt : -tt)), x))}` : 'miqdar likhein';
    const sv = document.querySelector('#fcMv [data-mv-save]'), n = Object.keys(mv.sel).filter(k => mvTot(k, mv.sel[k]) > 0).length; if (sv) { sv.disabled = !n; sv.textContent = `✓ ${num(n)} item ${mv.kind === 'aaya' ? '📥 jorein' : '📤 minus karein'}`; } return; }
  if (d.flN != null && fl) { fl[d.flN] = t.value; return; }
  if (d.fcRq != null) { rq = t.value || ''; clearTimeout(qT); qT = setTimeout(() => paint(['fcRqList']), 180); return; }
  if (d.fcPdq != null && pd) { pd.q = t.value || ''; clearTimeout(qT); qT = setTimeout(() => pkDefPaint(['fcPdHits']), 180); return; }
  if (mc && d.mcQ != null) { mc.q = t.value || ''; clearTimeout(qT); qT = setTimeout(() => mcPaint(['fcMcHits']), 180); return; }   // v2.103.8
  if (mc && d.mcKg != null) { mc.kg = t.value; mc.kgAuto = false; mcSum(); return; }
  if (mc && d.mcGin != null) { mc.g = Number(t.value) > 0 ? Number(t.value) : ''; mcSum(); return; }
  if (mc && d.mcXn != null) { const x = mc.x[Number(d.mcXn)]; if (x) x.n = t.value; return; }
  if (mc && d.mcXr != null) { const x = mc.x[Number(d.mcXr)]; if (x) x.rs = t.value; mcSum(); return; }
  if (mc && d.mcMq != null) { mc.mats[d.mcMq] = Number(t.value) > 0 ? Number(t.value) : 0; mcSum(); return; }
  if (d.faQ != null && fa) { fa.q = t.value || ''; clearTimeout(qT); qT = setTimeout(() => addPaint(true), 180); return; }   // v2.101.6
  if (d.fcPq != null && pk) { pk.q = t.value || ''; pk.lim = 60; clearTimeout(qT); qT = setTimeout(() => pickPaint(['fcPickList']), 180); return; }
  if (d.fcFq2 != null && fe) { fe.q = t.value || ''; fe.lim = 300; clearTimeout(qT); qT = setTimeout(() => formPaint(['feHits']), 180); return; }
  if (d.pfPq != null && pf) { pf.prodQ = t.value || ''; clearTimeout(qT); qT = setTimeout(() => pfSwap(['pfProd']), 180); return; }
  if (d.pfSq != null && pf) { pf.sq = t.value || ''; clearTimeout(qT); qT = setTimeout(() => pfSwap(['pfHits']), 180); return; }
});
// v2.107.0: 🏭 ek-screen ke clicks / likhai (alag listener — purane data-fc-* wahi)
document.addEventListener('click', e => {
  const t = e.target.closest?.('[data-ek-ph],[data-ek-cmds],[data-ek-cat],[data-ek-fstock],[data-ek-old],[data-ek-back],[data-ek-lbl],[data-ek-it],[data-ek-nwmain],[data-ek-nwraw],[data-ek-nwun],[data-ek-nwx],[data-ek-nwok],[data-ek-nwuse],[data-ek-ldel],[data-ek-padd],[data-ek-perman],[data-ek-persum],[data-ek-n],[data-ek-ebx],[data-ek-ninew],[data-ek-niold],[data-ek-niit],[data-ek-niuse],[data-ek-nimat],[data-ek-pmnew],[data-ek-pmok],[data-ek-nix],[data-ek-niok],[data-ek-odel],[data-ek-save],[data-ek-hl],[data-ek-pl],[data-ek-smo],[data-ek-smat],[data-ek-sdel],[data-ek-spmnew],[data-ek-spmok],[data-ek-mhide]');
  if (!t || !t.closest('.fc-root')) return; const d = t.dataset;
  if (d.ekPh != null) { phOpen(d.ekPh); return; }   // v2.108.0: 📷
  if (d.ekCmds != null) { phCmds(); return; }
  if (d.ekCat != null) { phCat(); return; }
  if (d.ekFstock != null) { ekFactoryStock(); return; }
  if (d.ekOld) { st.view = 'old'; st.tab = d.ekOld; keep(); paint(); return; }
  if (d.ekBack != null) { st.view = 'ek'; keep(); paint(); return; }
  if (d.ekLbl != null) { const on = ekLbl() === 'none'; try { localStorage.setItem('sam-fc-bc', on ? '1' : '0'); } catch {} paint(); notice(on ? '🏷 Batch par barcode label chhapenge' : '🏷 Label nahi chhapenge'); return; }
  if (!ek) return;
  if (d.ekIt != null) { ekSelect(d.ekIt); return; }
  if (d.ekHl != null) { ek.hlOpen = !ek.hlOpen; paint(); return; }   // v2.108.1: ① doosre items ⋮
  if (d.ekNwmain != null) { ek.nw = { kind: 'main', n: ek.q.trim(), un: 'Pcs', r: '', q: '', pk: '' }; ek.q = ''; paint(); setTimeout(() => document.querySelector('#ekNwBox [data-ek-nwf="n"]')?.focus(), 40); return; }
  if (d.ekNwraw != null) { ek.nw = { kind: 'raw', n: ek.pq.trim(), un: 'Kg', r: '', q: '' }; ek.pq = ''; paint(); setTimeout(() => document.querySelector('#ekNwBox [data-ek-nwf="r"]')?.focus(), 40); return; }
  if (d.ekNwun && ek.nw) { ek.nw.un = d.ekNwun; paint(); return; }
  if (d.ekNwx != null) { ek.nw = null; paint(); return; }
  if (d.ekNwok != null) { ekNwSave(); return; }
  if (d.ekNwuse) { ekNwUse(d.ekNwuse); return; }
  if (!ek.fe) return;
  if (d.ekPl != null) { ek.plOpen = !ek.plOpen; const a = $('ekPickList'); if (a) a.innerHTML = ekPickListHTML(); t.classList.toggle('is-in', ek.plOpen); return; }   // v2.108.1: ➕ maal ki list ⋮
  if (d.ekSmo != null) { ek.smOpen = !ek.smOpen; if (!ek.smOpen) ek.spm = null; paint(); return; }   // 🧴 ➕ packing / ⌃ Chhupao
  if (d.ekSmat) { const S = ek.fe.self = ek.fe.self || {}; if (S[d.ekSmat] != null) delete S[d.ekSmat]; else { S[d.ekSmat] = 1; if (!byId.has(d.ekSmat)) matToggle(d.ekSmat, true); } paint(); return; }
  if (d.ekSdel) { if (ek.fe.self) delete ek.fe.self[d.ekSdel]; paint(); notice('Hata diya — Save par formula se bhi'); return; }
  if (d.ekSpmnew != null) { ek.spm = { n: '', r: '' }; paint(); setTimeout(() => document.querySelector('#ekForm [data-ek-spmf="n"]')?.focus(), 40); return; }
  if (d.ekSpmok != null) { ekPmSave('self'); return; }
  if (d.ekLdel != null) { ek.fe.lines.splice(Number(d.ekLdel), 1); paint(); return; }
  if (d.ekPadd != null) { ekPickAdd(); return; }
  if (d.ekPerman != null) { const z = ekCalc(); if (Number(ek.fe.ml) > 0) ek.fe.auto = false; ek.fe.sum = false; ek.fe.per = z?.per || ek.fe.per; paint(); return; }
  if (d.ekPersum != null) { if (Number(ek.fe.ml) > 0) ek.fe.auto = true; else ek.fe.sum = true; paint(); return; }
  if (d.ekN) { ek.n = Math.max(0, Math.min(10, Math.floor(Number(ek.n) || 0) + Number(d.ekN))); ekLive(); return; }
  if (d.ekEbx != null) { ek = ekFresh(byId.get(ek.id) || null); paint(); return; }
  if (d.ekNinew != null || d.ekNiold != null) { const nw = d.ekNinew != null; ek.ni = { mode: nw ? 'new' : 'old', id: '', q: '', n: '', g: '', pk: '', mats: {}, pm: null, busy: false, gT: false }; paint(); setTimeout(() => document.querySelector(nw ? '#ekNiBox [data-ek-nif="n"]' : '#ekNiBox [data-ek-niq]')?.focus(), 40); return; }
  if (d.ekOdel) { ekOutDel(d.ekOdel); return; }
  if (d.ekSave != null) { ekSave(); return; }
  const s = ek.ni; if (!s) return;
  if (d.ekNiit != null || d.ekNiuse) { const id = String(d.ekNiuse || d.ekNiit || ''); s.mode = 'old'; s.id = id; if (id && !s.gT) { const m = mlFromName((byId.get(id) || ekPos(id))?.name); if (m) s.g = String(r3(m / 1000)); } paint(); return; }
  if (d.ekNimat) { if (s.mats[d.ekNimat]) delete s.mats[d.ekNimat]; else s.mats[d.ekNimat] = 1; paint(); return; }
  if (d.ekMhide != null) { s.mHide = !s.mHide; paint(); return; }   // v2.108.1: ⌃ Chhupao / ▾ Sab
  if (d.ekPmnew != null) { s.pm = { n: '', r: '' }; paint(); setTimeout(() => document.querySelector('#ekNiBox [data-ek-pmf="n"]')?.focus(), 40); return; }
  if (d.ekPmok != null) { ekPmSave(); return; }
  if (d.ekNix != null) { ek.ni = null; paint(); return; }
  if (d.ekNiok != null) { ekNiSave(); return; }
});
document.addEventListener('input', e => {
  const t = e.target; if (!t?.dataset || !ek || !t.closest?.('#ekRoot')) return; const d = t.dataset;
  if (d.ekQ != null) { ek.q = t.value || ''; clearTimeout(ekQT); ekQT = setTimeout(() => { const h = $('ekHits'); if (h && ek) h.innerHTML = ekHitsHTML(); }, 150); return; }
  if (d.ekPq != null) { ek.pq = t.value || ''; clearTimeout(ekQT); ekQT = setTimeout(() => { const a = $('ekPickList'), b = $('ekPickFoot'); if (a && ek) a.innerHTML = ekPickListHTML(); if (b && ek) b.innerHTML = ekPickFootHTML(); }, 150); return; }
  if (d.ekNiq != null && ek.ni) { ek.ni.q = t.value || ''; clearTimeout(ekQT); ekQT = setTimeout(() => { const h = $('ekNiHits'); if (h && ek?.ni) h.innerHTML = ekNiHitsHTML(); }, 150); return; }
  if (d.ekNwf != null && ek.nw) { ek.nw[d.ekNwf] = t.value; if (d.ekNwf === 'n') { clearTimeout(ekQT); ekQT = setTimeout(() => { const el = $('ekNwDup'); if (el && ek?.nw) el.innerHTML = ekDupHTML(ekDup(String(ek.nw.n || '').trim()), ek.nw.kind); }, 220); } return; }
  if (d.ekPmf != null && ek.ni?.pm) { ek.ni.pm[d.ekPmf] = t.value; return; }
  if (d.ekNif != null && ek.ni) { const s = ek.ni; s[d.ekNif] = t.value; if (d.ekNif === 'g') s.gT = t.value !== '';
    if (d.ekNif === 'n') { if (!s.gT) { const m = mlFromName(t.value); s.g = m ? String(r3(m / 1000)) : ''; const gi = document.querySelector('#ekNiBox [data-ek-nif="g"]'); if (gi) gi.value = s.g; }
      clearTimeout(ekQT); ekQT = setTimeout(() => { const el = $('ekNiDup'); if (el && ek?.ni) el.innerHTML = ekDupHTML(ekDup(String(ek.ni.n || '').trim()), 'out'); }, 220); }
    const z = ekCalc(), c = $('ekNiCost'); if (c && z) c.innerHTML = ekNiCost(z); return; }
  if (!ek.fe) return;
  if (d.ekLq != null) { const l = ek.fe.lines[Number(d.ekLq)]; if (l) { const v = Number(t.value); l.q = v > 0 ? (gOf(l.id) ? pcsOfKg(v, l.id) : v) : 0; t.closest('.ek-chip')?.classList.toggle('warn', !(l.q > 0)); } ekLive(); return; }
  if (d.ekSq != null) { const v = Number(t.value); ek.fe.self = ek.fe.self || {}; ek.fe.self[d.ekSq] = v > 0 ? v : 0; t.closest('.ek-chip')?.classList.toggle('warn', !(v > 0)); ekLive(); return; }   // v2.108.1: 🧴 fi pcs
  if (d.ekSpmf != null && ek.spm) { ek.spm[d.ekSpmf] = t.value; return; }
  if (d.ekLab != null) { ek.fe.lab = Number(t.value) > 0 ? Number(t.value) : 0; ekLive(); return; }
  if (d.ekGas != null) { ek.fe.gas = Number(t.value) > 0 ? Number(t.value) : 0; ekLive(); return; }
  if (d.ekPer != null) { ek.fe.per = Number(t.value) > 0 ? Number(t.value) : 0; ekLive(); return; }
  if (d.ekOc != null || d.ekOp != null) { const k = d.ekOc ?? d.ekOp, v = ek.oq[k] = ek.oq[k] || {}; v[d.ekOc != null ? 'c' : 'p'] = t.value; ekLive(); return; }
  if (d.ekR != null) { const [k, i] = String(d.ekR).split('|'), z = ekCalc(), x = z && ekRateRows(z)[Number(i)]; if (x) { ek.rEd[x.it.id] = { ...(ek.rEd[x.it.id] || {}), [k]: Number(t.value) >= 0 ? Number(t.value) : 0 }; t.closest('.ek-rc')?.classList.add('own'); } return; }
});
document.addEventListener('change', e => {
  const t = e.target; if (!t?.dataset || !ek || !t.closest?.('#ekRoot')) return; const d = t.dataset;
  if (d.ekPt != null) { const id = d.ekPt; if (t.checked) ek.sel.add(id); else ek.sel.delete(id); t.closest('.ek-pr')?.classList.toggle('is-in', t.checked); const f = $('ekPickFoot'); if (f) f.innerHTML = ekPickFootHTML(); return; }
  if (d.ekPosr != null) { ek.posR = !!t.checked; return; }
});
// photo dialog: search ke waqt sirf list badle (input na toote)
function pfSwap(ids) { const el = $('fcPhoto'); if (!el || !pf) return; const tmp = document.createElement('div'); pfPaint(tmp); swapParts(el, tmp.innerHTML, ids); }
document.addEventListener('change', e => {
  const t = e.target;
  if (t?.dataset?.facTick) { facToggle(t.dataset.facTick, t.checked, t); return; }   // stock screen + picker
  if (t?.dataset?.facMat) { matToggle(t.dataset.facMat, t.checked, t); return; }   // v2.101: 📦
  if (t?.dataset?.flMat && fl) { fl.mat = !!t.checked; return; }   // v2.103.0
  if (t?.dataset?.mvTick && mv) { const id = t.dataset.mvTick; if (t.checked) mv.sel[id] = mv.sel[id] || {}; else delete mv.sel[id]; mvPaint(['fcMvList', 'fcMvFoot']); if (t.checked) setTimeout(() => document.querySelector(`#fcMv [data-mv-q="${CSS.escape(id)}"]`)?.focus(), 30); return; }   // v2.103.0
  if (t?.dataset?.feAll != null && fe) { const inF = new Set(fe.lines.map(l => String(l.id))), q = fe.q.trim(), fac = items.filter(x => x.id !== fe.id && !inF.has(x.id));   // v2.101.8: ☑ Sab chunein
    const L = q ? srch(fac, q, 300) : fac.filter(x => fe.pf === 'sab' || (fe.pf === 'mat' ? kindOf(x) === 'mat' : kindOf(x) !== 'mat'));
    for (const x of L) { if (t.checked) fe.sel.add(x.id); else fe.sel.delete(x.id); } formPaint(['feHits']); return; }
  if (t?.dataset?.feTick && fe) { const id = t.dataset.feTick, inn = fe.lines.findIndex(l => l.id === id);   // v2.101.7
    if (t.checked) { if (inn < 0) fe.sel.add(id); } else if (fe.sel.has(id)) fe.sel.delete(id); else if (inn >= 0 || fe.self?.[id] != null) { if (confirm((byId.get(id)?.name || 'Yeh item') + ' formula se hatana hai?')) { if (inn >= 0) fe.lines.splice(inn, 1); else delete fe.self[id]; formPaint(); return; } t.checked = true; return; } else if ((fe.fms || []).some(f => f.id === id)) { t.checked = true; return; }
    formPaint(['feHits']); return; }
  if (!t?.dataset || !t.closest?.('.fc-root')) return; const d = t.dataset, v = Number(t.value);
  if (d.fbReal != null && fb) { fb.real = v > 0 ? v : ''; batchPaint(); return; }
  if (d.fbPk != null && fb) { fb.pk[d.fbPk] = v > 0 ? Math.floor(v) : 0; batchPaint(); return; }
  if (d.fbSelf != null && fb) { fb.self = t.value === '' ? '' : Math.max(0, Math.floor(v) || 0); batchPaint(); return; }   // v2.102.0
  if (d.fr != null) { const id = d.frId; rEd[id] = { ...(rEd[id] || {}), [d.fr]: v >= 0 ? v : 0 }; paint(); return; }
  if (mc) {   // v2.103.8
    if (d.mcMat != null) { if (t.checked) mc.mats[d.mcMat] = mc.mats[d.mcMat] || 1; else delete mc.mats[d.mcMat]; mcPaint(); return; }
    if (d.mcGin != null) { mcPaint(); return; }
  }
  if (pd) {
    if (d.pdG != null) { pd.g = v > 0 ? v : ''; pkDefPaint(); return; }
    if (d.pdMat != null) { if (t.checked) pd.mats[d.pdMat] = pd.mats[d.pdMat] || 1; else delete pd.mats[d.pdMat]; pkDefPaint(); return; }
    if (d.pdMq != null) { pd.mats[d.pdMq] = v > 0 ? v : 0; pkDefPaint(); return; }
  }
  if (fe) {
    if (d.fePer != null) { fe.per = v > 0 ? v : fe.per; formPaint(); return; }
    if (d.feMl != null) { fe.ml = v > 0 ? (v < 50 ? r3(v * 1000) : v) : 0; if (fe.ml) fe.auto = true; formPaint(); return; }   // v2.102.1: liter / kg likhte hain
    if (d.feFg != null) { const fm = fe.fms[Number(d.feFg)]; if (fm) fm.g = v > 0 ? (v < 50 ? r3(v * 1000) : v) : 0; formPaint(); return; }
    if (d.feMq) { const [k, id] = String(d.feMq).split('|'), M = k === 'self' ? fe.self : fe.fms[Number(k.slice(1))]?.mats; if (M) { if (v > 0) M[id] = v; else delete M[id]; } formPaint(); return; }
    if (d.feQ != null) { const l = fe.lines[Number(d.feQ)]; if (l) l.q = v >= 0 ? (gOf(l.id) ? pcsOfKg(v, l.id) : v) : 0; formPaint(); return; }
    if (d.feG != null) { if (!cloud?.setFactoryCfg || !isOwner()) return; const g = v > 0 ? r2(v) : null; cfg = { ...(cfg || {}), conv: { ...(cfg?.conv || {}), [d.feG]: g } }; formPaint();
      cloud.setFactoryCfg({ conv: { [d.feG]: g } }).then(() => notice(g ? '✓ 1 pcs = ' + g + ' g save — formula ab kg mein' : 'Gram hata diya')).catch(er => notice('Save nahi hua: ' + (er?.message || er))); return; }
    if (d.feR != null) { setRate(d.feR, t.value === '' ? 0 : v); return; }
    if (d.fePosr != null) { posRate = !!t.checked; return; }
    if (d.feLab != null) { fe.lab = v >= 0 ? v : 0; formPaint(); return; }
    if (d.feGas != null) { fe.gas = v >= 0 ? v : 0; formPaint(); return; }
  }
  if (pf) {
    if (d.pfPieces != null) { pf.pieces = v > 0 ? Math.round(v) : 0; pfPaint(); return; }
    if (d.pfQ != null) { const l = pf.lines[Number(d.pfQ)]; if (l) l.qty = v >= 0 ? v : 0; pfPaint(); return; }
  }
  if ((d.fcWm != null || d.fcRm != null) && cloud?.setFactoryCfg) { if (!(v >= 0)) return; cfg = { ...(cfg || {}), ...(d.fcWm != null ? { wm: v } : { rm: v }) }; cloud.setFactoryCfg(d.fcWm != null ? { wm: v } : { rm: v }).then(() => notice('✓ Nafa ' + v + '% save')).catch(er => notice('Save nahi hua: ' + (er?.message || er))); }
});
export const _fcTest = { mcCpp, mcOpen, get mc() { return mc; }, rateRows, items: () => items, fStocks: () => fStocks(), pcsG, volU, lineVol, fixMl, looksPack, get fe() { return fe; }, forms, selfMats, mlFromName, volOf, openAdd, addListHTML, get fa() { return fa; }, packCalc, packDefs, packUnit, packCpp, bulkCpp, batchCalc: () => batchCalc(), fb: () => fb, rEd, rateRows, isMat, fRate, rateOf, setRate, posRate: v => { posRate = v; }, gOf, kgOf, pcsOfKg, qk, costOf, suggest, labelSpecs, qt, set: (c, b, it) => { cfg = c; batches = b || []; items = it || []; byId = new Map(items.map(x => [x.id, x])); itemsOk = true; }, batchNo, pdfHTML, st, matchItem, photoFormula, pf: () => pf, pendItems: () => pendItems(items.filter(x => !x.pending)),
  get ek() { return ek; }, ekCalc: () => ekCalc(), ekSelect, ekOn: () => ekOn(), ekView: () => ekView(), phSell: () => phSell(), phCtx: () => phCtx(), phIdx: () => phIdx, phThumb, phSize };

// v2.103.48: 🤖 agent actions — factory
import { agentRegister } from './agent.js?v=2.154.0';
agentRegister([
  { name: 'factory_batches', read: true, desc: 'Factory ke aaj ke (ya pichhle N din ke) batch: item, kitne batch, pcs, haal (POS mein / app / hold).', params: { type: 'OBJECT', properties: { days: { type: 'INTEGER' } } },
    run({ days }) { watch(); const from = Date.now() - Math.max(1, Math.min(60, Number(days) || 1)) * 864e5; return { list: batches.filter(b => (b.at || 0) >= from).slice(0, 40).map(b => ({ no: b.no, item: b.name || byId.get(String(b.itemId))?.name || '', batch: b.n, pcs: b.out, haal: b.status, kis_ne: b.byName || '', kab: new Date(b.at).toLocaleString('en-PK'), laagat: b.cost })) }; } },
  { name: 'factory_batch_kholo', read: true, desc: 'Naya factory batch ka form kholo (item + kitne batch bhar kar) — OK aap dabayein.', params: { type: 'OBJECT', properties: { item: { type: 'STRING' }, n: { type: 'INTEGER' } }, required: ['item'] },
    async run({ item, n }) { await openBatch(null, 'make'); await new Promise(r => setTimeout(r, 400)); const q = String(item).toLowerCase(), it = items.filter(x => (forms()[x.id]) && String(x.name).toLowerCase().includes(q)); if (!it.length) throw Error('Factory item "' + item + '" nahi (formula wala)'); if (fb) { fb.id = it[0].id; fb.n = Math.max(1, Math.min(10, Number(n) || 1)); batchPaint(); } return { khul_gaya: it[0].name, batch: fb?.n || 1 }; } },
  // v2.107.0: 🏭 ek-screen + Factory stock — wahi function jo button chalata hai (Save malik / larka khud dabaye)
  { name: 'factory_ek_kholo', read: true, desc: 'Factory ki nayi EK SCREEN kholo (item + formula + batch + bana + rate ek jagah) — item chun kar, kitne batch (0 = sirf formula). Save aap dabayein.', params: { type: 'OBJECT', properties: { item: { type: 'STRING' }, n: { type: 'INTEGER' } } },
    async run({ item, n }) { if (!ekOn()) throw Error('Factory ek-screen ki ijazat nahi (malik: Settings → Mulazim)'); st.view = 'ek'; keep();
      if (!$('fcRoot')) { try { window.ntRecentOpen?.({ open: { kind: 'route', v: 'factory' } }); } catch {} await new Promise(r => setTimeout(r, 500)); }
      await ensureItems(); paint();
      if (item) { const L = srch(items.filter(x => isOwner() || forms()[x.id]), String(item), 3); if (!L.length) throw Error('Factory item "' + item + '" nahi mila'); ekSelect(L[0].id); }
      if (n != null && ek) { ek.n = Math.max(0, Math.min(10, Math.floor(Number(n) || 0))); paint(); }
      return { khul_gayi: 'factory ek-screen', item: ek?.id ? (byId.get(ek.id)?.name || '') : '', batch: ek?.n ?? 1 }; } },
  { name: 'factory_stock_kholo', read: true, desc: 'Factory ka poora stock Stock screen par kholo — sirf factory items (ginti Ctn / Pcs, Save, Tick, label, item sab wahi).', params: { type: 'OBJECT', properties: {} },
    run() { ekFactoryStock(); return { khul_gaya: 'factory stock (Stock screen)' }; } },
  // v2.108.0: 📷 tasveer · ✨ AI commands · 📄 rate list PDF — wahi function jo button chalata hai
  { name: 'factory_photo_kholo', read: true, desc: 'Factory item ki HD tasveer ki khirki kholo — malik: 📷 lagao / badlo, ✨ AI command (ChatGPT / Gemini), 📤 rate ke saath customer ko bhejo.', params: { type: 'OBJECT', properties: { item: { type: 'STRING' } }, required: ['item'] },
    async run({ item }) { watchCfg(); await ensureItems(); const pool = phSell(), L = srch(pool.length ? pool : items, String(item || ''), 1); if (!L.length) throw Error('Factory item "' + item + '" nahi mila'); await phOpen(L[0].id); return { khul_gayi: 'tasveer', item: L[0].name, tasveer: phIdx[L[0].id]?.v ? 'hai' : 'abhi nahi' }; } },
  { name: 'factory_rate_pdf', read: true, desc: '"ADREES SOAP FACTORY" rate list PDF ki khirki kholo (upar sab tasveerein + rate, neeche har item ☑ Wholesale / ☑ Parchoon) — items chun kar PDF banao: Download HD · Kholo · Bhejo.', params: { type: 'OBJECT', properties: {} },
    async run() { await phCat(); return { khul_gayi: 'rate list PDF', tasveer_wale: Object.keys(phIdx).length }; } },
  { name: 'factory_ai_commands', read: true, desc: 'Sab factory items ki tasveer edit karne wali AI commands (ChatGPT / Gemini ke liye, background ke saath) kholo — har item ka 📋 Copy. Sirf malik.', params: { type: 'OBJECT', properties: {} },
    async run() { await phCmds(); return { khul_gayi: 'AI commands' }; } },
]);
