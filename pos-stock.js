// pos-stock.js — POS ka stock (posStock collection) app mein dikhata hai
// Data sirf padha jata hai. Likhne ka kaam PC par chalne wala sync-stock.js karta hai.

import { smartSearch, setAliases, aliasOf, noteHit, voiceSearch, hlName, smartHit, fold, topItems } from './smart-search.js?v=2.103.27';
import { liveLabelsHTML } from './barcode.js?v=2.103.27';   // v2.97: 🖨 label live + ✕ cancel (wahi module jo app.js — ek hi nusqha)
const $ = id => document.getElementById(id);
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const NUMF = new Intl.NumberFormat('en-PK');   // ek hi dafa banao (har number par naya banana bohat slow tha)
const num = n => NUMF.format(Math.round((Number(n) || 0) * 1000) / 1000);   // v1.61.1: tadad 3 decimal
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;   // v1.61: yeh maujood nahi tha — camera ki list banate waqt ruk jata tha (kaala camera)
const NAMEC = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

const PAGE = 30;        // ek dafa itni rows — baqi "Aur dikhao" se (phone tez rahe)
let limit = PAGE;

let cloud = null, rerender = () => {}, notice = () => {};
let stop = null, rows = [], loaded = false, failed = '';
let branch = null, sort = 'name', filter = 'all', bills = [];
let godamAll = false;   // v1.97: godam par 'Sab' khud chuna ho tabhi sab items   // v1.67: shuru mein SAB items
let postReq = null;
let hidden = {};   // item id -> true (Band kiye hue items, sab branches mein chhupe)
let counts = new Map(), round = '', stopCount = null, isOwner = () => false;
// v2.101.1: 📋 GINTI KHUD POS MEIN (malik: "physical likhein, Save — PC bill saath saath banata rahe, dobara gino to edit") —
//   stockCount/_auto {on}: round = aaj ka din (YYYY-MM-DD) khud; har count doc {auto, sys0, pfAt, pfAdj, pfQ, del} — PC ginti-post.js
//   roz ke ek POS Adjustment "Ginti <din> NT" mein har Save ka farq (delta) jorta hai; dobara gino = agla delta, hatao = ulta.
let autoOn = false, roundDoc = '', roundFixT = 0, postedMap = new Map();
const dayStr = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const roundNow = () => { if (autoOn) { round = dayStr(); if (isOwner() && roundDoc !== round && cloud?.setStockRound && Date.now() - roundFixT > 60000) { roundFixT = Date.now(); cloud.setStockRound(round).catch(() => {}); } } return round; };
// v2.101.1: malik ki marzi ka bill (Sale = kam, Return = zyada) — "_posted-<round>-<branch>" (PC post-farq) batata hai kitna bill mein ja chuka
function billOf(r, c, b = pickedBranch) {
  if (!c) return { k: 'none' }; const f = Math.round((countedPcs(c) - Number(sysOf(c, r))) * 1000) / 1000;
  if (Math.abs(f) < 0.001) return { k: 'eq', f };
  const key = f < 0 ? String(r.id) : 'R' + r.id, pd = postedMap.get(`_posted-${round}-${b}`), q = Number(pd?.items?.[key]) || 0;
  if (!(q > 0)) return { k: 'baqi', f };
  const bl = bills.find(x => x.round === round && Number(x.branch) === Number(b) && (f < 0 ? x.kam : x.zyada || []).some(y => String(y.id) === key));
  return { k: q >= Math.abs(f) - 0.001 ? 'done' : 'part', f, q, no: bl ? (f < 0 ? 'Sale #' + (bl.saleNo || '') : 'Return #' + (bl.returnNo || '')) : 'bill' };
}
// v2.101.1: 👁 stock sirf jis mulazim ko malik dikhaye (CAP stock.see) — baqi sirf ginti likhein
const seeStock = () => isOwner() || can('stock.see');
// v1.49: _flags (baqi / check nishan), _lock (malik ne ginti band ki)
let flags = {}, countOff = false;
const flagOf = id => flags[String(id)] || {};
const countLocked = () => (countOff || !can('stock.count')) && !isOwner();

let aliasStop = null;
let itemCfg = {}, cfgStop = null, ptList = [], ptStop = null;
const ptLive = () => (ptList || []).filter(t => t && !t.cancelled);   // v2.99.58: POS mein cancel (mita diya) note register / aaya maal mein nahi                         // v2.5: stockConfig (mulazim item/rates badal sake)
const can = k => { try { return typeof window.ntCan === 'function' ? window.ntCan(k) : true; } catch { return true; } };   // v2.99.24: mulazim ke andar ke option (app.js can)
const canEditItem = () => isOwner() || (itemCfg.itemEdit === true && can('stock.item'));
// v2.99.86: malik — "mulazim ko naya item ki access" — ALAG switch (itemNew): sirf NAYA item; purane ka rate / naam nahi (wo itemEdit). itemEdit ON = naya bhi.
const facBtnOk = () => { try { return typeof window.ntFacBatch === 'function' && window.ntFacBatch() && rows.some(c => !c.meta && Array.isArray(c.items) && c.items.some(isFactory)); } catch { return false; } };   // v2.99.88
const canNewItem = () => isOwner() || ((itemCfg.itemNew === true || itemCfg.itemEdit === true) && can('stock.itemnew'));
let inPdfOf = null, tolaiOf = null, tolaiClickOf = null;
export function setInPdf(fn) { inPdfOf = fn; }
export function setTolai(open, click) { tolaiOf = open; tolaiClickOf = click; }   // v2.7
// v2.84: 🔤 URDU NAAM — blueAccess/urduNames {map: itemId -> Urdu}; AI (Gemini) se ek dafa, phir malik/stock theek kar sake; label par English ke saath.
let urdu = {}, urduStop = null, aiText = null, urduBusy = false;
const urduOf = id => String(urdu[String(id)] || '');
async function urduMake(items, onlyMissing = true) {
  if (!aiText) throw Error('AI tayyar nahi (login / key)');
  const todo = items.filter(r => r && r.id && r.name && (!onlyMissing || !urduOf(r.id)));
  if (!todo.length) return 0;
  let done = 0;
  for (let i = 0; i < todo.length; i += 60) {
    const chunk = todo.slice(i, i + 60);
    const prompt = `Tum ek Pakistani grocery (kiryana) ki dukaan ke items ke naam Urdu rasm-ul-khat mein likhte ho. Har English/Roman naam ko URDU script mein likho — tarjuma nahi, wahi naam Urdu harfon mein (brand ke naam jaise chhapte hain waise: Dettol = ڈیٹول, Surf = سرف, Colgate = کولگیٹ). Wazan/size (5kg, 160g, 1.5 ltr) hindson mein wahi rakho (jaise 5 کلو, 160 گرام, 1.5 لیٹر). Sirf JSON array do, aur kuch nahi: [{"id":"...","ur":"..."}]\n` + JSON.stringify(chunk.map(r => ({ id: String(r.id), en: String(r.name).slice(0, 80) })));
    const out = await aiText(prompt);
    const m = String(out || '').match(/\[[\s\S]*\]/); if (!m) continue;
    let arr = []; try { arr = JSON.parse(m[0]); } catch { continue; }
    const patch = {}; for (const x of arr) { if (x && x.id && x.ur && /[\u0600-\u06FF]/.test(x.ur)) patch[String(x.id)] = String(x.ur).trim().slice(0, 120); }
    if (Object.keys(patch).length) { await cloud.setUrdu(patch); Object.assign(urdu, patch); done += Object.keys(patch).length; }
    notice(`🔤 ${done} / ${todo.length} Urdu naam ban gaye…`);
  }
  return done;
}
// v2.99.91: ⏳ PC BAND HO TAB BHI NAYA ITEM (malik: "koi item add karni ho to bhi ho jaye, PC on hote hi pata chal jaye").
//   itemJobs (7 din) ka listener: 'new' / 'working' = "⏳ PC baqi" chip + list; is session mein done / failed hua to patti (notice).
//   PC item-post v1.2 der wali job par phone notification bhejta hai. onItemJobs(fn) — factory.js (🏭 pend jorna).
let ijobs = [], ijStop = null, uidOf = () => ''; const ijSeen = new Map(), ijHooks = [];
const ijPend = () => ijobs.filter(j => j.status === 'new' || j.status === 'working');
const ijBad = () => ijobs.filter(j => j.status === 'failed' && Date.now() - (Number(j.doneAt) || 0) < 86400000);
export function onItemJobs(fn) { ijHooks.push(fn); if (ijobs.length) try { fn(ijobs); } catch {} }
function ijGot(l) {
  if (!Array.isArray(l)) return;
  for (const j of l) { const p = ijSeen.get(j.id);
    if (p && (p === 'new' || p === 'working') && j.status === 'done') notice('✓ ' + (j.name || 'Item') + ' POS mein ' + (j.op === 'new' ? 'ban gaya' : 'save ho gaya') + (j.code ? ' · ' + j.code : ''));
    else if (p && (p === 'new' || p === 'working') && j.status === 'failed') notice('❌ ' + (j.name || 'Item') + ' POS mein nahi bana: ' + (j.error || ''));
    ijSeen.set(j.id, j.status); }
  ijobs = l; ijHooks.forEach(f => { try { f(l); } catch {} });
  if (stockActive) soft(); if ($('ijList')) ijPaint();
}
function ijDlg() { const d = $('dialog'); if (!d) return; d.classList.remove('search-dialog'); $('dialogTitle').textContent = '⏳ PC baqi items'; $('dialogBody').innerHTML = '<div id="ijList"></div>'; if (!d.open) d.showModal(); ijPaint(); }
function ijPaint() {
  const el = $('ijList'); if (!el) return; const P = ijPend(), B = ijBad();
  const mine = j => isOwner() || (j.by && j.by === uidOf());   // v2.99.92: ✏️ / ✕ — malik ya jis ne daala (rules 2.54)
  const row = (j, bad) => `<div class="ij-row${bad ? ' bad' : ''}"><b>${esc(j.name || 'Item')}</b><small>${j.op === 'new' ? '➕ Naya' : '✏️ Badla'}${j.rpcs ? ' · R ' + num(j.rpcs) : ''}${j.code ? ' · ' + esc(j.code) : ''} · ${esc(stampText(j.at))}${j.editAt ? ' · ✏️ ' + esc(stampText(j.editAt)) : ''}${bad ? ' · ❌ ' + esc(j.error || '') : j.status === 'working' ? ' · ⚙️ PC bana raha — ab nahi badal sakta' : ' · ⏳ PC on hote hi'}</small>${!bad && j.status === 'new' && mine(j) ? `<div class="ij-acts">${j.op === 'new' ? `<button type="button" data-ij-edit="${esc(j.id)}">✏️ Edit</button>` : ''}<button type="button" class="x" data-ij-cancel="${esc(j.id)}">✕ Cancel</button></div>` : ''}</div>`;
  el.innerHTML = `<p class="stat-note">Ye items line mein mehfooz hain — Server PC on hote hi khud POS mein ban jayengi aur phone par khabar aayegi.</p>${P.map(j => row(j)).join('') || '<p class="stat-note">✓ Koi item baqi nahi</p>'}${B.length ? '<h4>❌ Nahi bane (24 ghante)</h4>' + B.map(j => row(j, true)).join('') : ''}`;
}
const whoName = () => { try { return String(setupName?.() || '').slice(0, 40); } catch { return ''; } };
let setupName = null;
export function stockSetup(opts) {
  if (opts.name) setupName = opts.name;
  aiText = opts?.ai || aiText;
  if (!urduStop && opts?.cloud?.listenUrdu) urduStop = opts.cloud.listenUrdu(m => { urdu = m || {}; if (stockActive) soft(); });
  if (!aliasStop && opts?.cloud?.listenAliases) aliasStop = opts.cloud.listenAliases(m => setAliases(m));   // v1.75: doosre naam
  if (!cfgStop && opts?.cloud?.listenStockConfig) cfgStop = opts.cloud.listenStockConfig(c => { itemCfg = c || {}; if (stockActive) soft(); if (!ctnBusy && document.querySelector('.reg-root')) ctnPaint(); });   // v2.99.18: register khula ho to nayi carton ginti
  if (!trStop && opts?.cloud?.listenTransfers) trStop = opts.cloud.listenTransfers(list => { trList = list; const h = document.querySelector('[data-tr-hist]'); if (h) h.innerHTML = trHistHTML(); });   // v2.6: transfer shuru se (aaya hua maal ke liye)
  if (!ijStop && opts?.cloud?.listenItemJobs) ijStop = opts.cloud.listenItemJobs(Date.now() - 7 * 86400000, ijGot);   // v2.99.91: ⏳ PC baqi items
  if (!ptStop && opts?.cloud?.listenPosTransfers) ptStop = opts.cloud.listenPosTransfers(list => { ptList = list || []; });   // v2.8: POS ke apne transfer (PC transfer-dekho.js)
  cloud = opts.cloud;
  auditOf = opts.audit || auditOf; nameOf = opts.name || nameOf; deviceOf = opts.device || deviceOf;   // v2.99.21: transfer check
  rerender = opts.rerender || (() => {});
  notice = opts.notice || (() => {});
  isOwner = opts.owner || (() => false);
  uidOf = opts.uid || uidOf;   // v2.99.92
}

// Snapshot par poori screen foran na banao: thora ruko, aur jab koi ginti likh raha ho to us ke baad
let softTimer = null, softWaiting = false;
function soft() {
  clearTimeout(softTimer);
  softTimer = setTimeout(() => {
    const a = document.activeElement;
    if (a && a.matches?.('input') && a.closest?.('#list')) { softWaiting = true; return; }
    softWaiting = false;
    rerender();
  }, 300);
}
document.addEventListener('input', e => {   // v2.101.1: upar chipki search = asli #search
  const t = e.target; if (!t?.matches?.('[data-sk-q]')) return; const g = $('search'); if (!g || g.value === t.value) return; g.value = t.value; g.dispatchEvent(new Event('input', { bubbles: true }));
});
document.addEventListener('focusout', e => {
  if (softWaiting && e.target.closest?.('#list')) setTimeout(soft, 50);
});

let stockT0 = 0, stockRetried = false, stockTick = null;   // v2.94.0: atke to khud / button se dobara
export function stockRetry() { if (stop) { try { stop(); } catch {} stop = null; } loaded = false; failed = ''; stockT0 = 0; start(false); rerender(); }
export function stockWaitHTML() {
  const w = stockT0 ? Date.now() - stockT0 : 0;
  if (w < 12000) return '<p class="stat-note">Items load ho rahe hain…</p>';
  const why = navigator.onLine === false ? '📵 Phone par internet nahi — Wi-Fi / mobile data dekhein.' : (w < 30000 ? '⏳ Pehli dafa (ya dheema internet) — sara stock aa raha hai, thora aur ruk jayein.' : '⚠️ Bohat der ho gayi — neeche dabayein, rabta naya jorta hoon.');
  return `<div class="empty stock-wait"><strong>Items load ho rahe hain… (${Math.round(w / 1000)} sec)</strong><p>${why}</p><button type="button" class="primary" data-stock-retry="1">🔄 Dobara load karo</button></div>`;
}
document.addEventListener('click', e => { if (e.target.closest?.('[data-stock-retry]')) { stockRetried = true; stockRetry(); } });
function start(withCounts = true) {
  if (!cloud) return;
  if (!stop) {
    loaded = false; failed = ''; stockT0 = Date.now();
    clearInterval(stockTick); stockTick = setInterval(() => { if (loaded) { clearInterval(stockTick); stockTick = null; return; } const w = Date.now() - stockT0; if (w > 30000 && !stockRetried) { stockRetried = true; stockRetry(); return; } if (w > 12000) rerender(); }, 6000);
    stop = cloud.listenStock(
      list => { rows = list.map(fixCost); loaded = true; failed = ''; soft(); try { inLive(); } catch {} },   // v2.103.4: 🟢 aaya/gaya live
      e => { failed = e?.message || 'Stock load nahi hua'; loaded = true; stop = null; rerender(); }
    );
  }
  if (withCounts && !stopCount && cloud.listenStockCount) {
    stopCount = cloud.listenStockCount(list => {
      counts = new Map();
      round = list.find(r => r.id === '_round')?.round || ''; roundDoc = round;
      autoOn = !!list.find(r => r.id === '_auto')?.on; postedMap = new Map(list.filter(r => String(r.id).startsWith('_posted-')).map(r => [r.id, r])); roundNow();
      postReq = list.find(r => r.id === '_post') || null;
      hidden = list.find(r => r.id === '_hidden')?.items || {};
      flags = list.find(r => r.id === '_flags')?.items || {};
      countOff = !!list.find(r => r.id === '_lock')?.off;
      bills = list.filter(r => String(r.id).startsWith('_bill-')).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
      list.forEach(r => { if (!String(r.id).startsWith('_')) counts.set(r.id, r); });
      soft();
    }, () => {});
  }
}

// POS mein kisi item ka Purchase Rate carton ka hota hai, kisi ka ek piece ka.
// sync-stock.js har dafa pack se taqseem karta hai, jis se piece wale items ka cost
// pack guna kam ho jata hai (ghee pouch: 590.4 / 5 = 118.08).
// Is liye dono imkaan dekhe jate hain aur jo sale Rate ke qareeb ho woh liya jata hai.
export function pieceCost(cost, pack, rate) {
  cost = Number(cost) || 0; pack = Number(pack) || 0; rate = Number(rate) || 0;
  if (!cost || pack <= 1 || !rate) return cost;
  const gap = v => Math.abs(Math.log(v / rate));
  const whole = cost * pack;
  return gap(whole) < gap(cost) ? Math.round(whole * 100) / 100 : cost;
}
function fixCost(r) {
  if (!r || !r.prate) return r;
  const c = pieceCost(r.prate, r.pack, r.rate);
  return c === r.prate ? r : { ...r, prate: c };
}

// Ginti ke waqt ka stock: PC ne POS ledger se nikaal kar likha ho to wahi (sahi), warna app ka dekha hua
const sysOf = (c, r) => (c && c.sysPos != null && c.sysPosAt === c.at) ? Number(c.sysPos) : Number(c?.sys ?? r?.stock ?? 0);
const sysSure = c => !!(c && c.sysPos != null && c.sysPosAt === c.at);

const countId = (b, itemId) => `c-${b}-${itemId}`;
const countOf = (b, r) => {
  const c = counts.get(countId(b, r.id));
  return c && c.round === round && round && !c.del ? c : null;
};
const countedPcs = c => Number(c?.total) || 0;
// v2.99.87: 🕘 GINTI / TICK HISTORY DIN KE HISAAB SE (malik: "stock ki tick save history ke upar day wise kar do — jo selected days hon un ki hi
//   history samne aaye"). hDay: '' = sab (pehle jaisa) · 'aaj' · 'kal' · '7' (pichhle 7 din) · 'YYYY-MM-DD'. Sirf phone par chhaanta — Firebase par kuch nahi.
let hDay = (() => { try { return localStorage.getItem('sam-stock-hday') || ''; } catch { return ''; } })();
const hDayKeep = () => { try { localStorage.setItem('sam-stock-hday', hDay); } catch {} };
const dStart = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };
function hRange(k = hDay) {
  if (!k) return null; const t0 = dStart(Date.now()), D = 86400000;
  if (k === 'aaj') return [t0, t0 + D]; if (k === 'kal') return [t0 - D, t0]; if (k === '7') return [t0 - 6 * D, t0 + D];
  if (/^\d{4}-\d{2}-\d{2}$/.test(k)) { const a = new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10)).getTime(); return [a, a + D]; }
  return null;
}
const hIn = (h, R) => { const t = Number(h?.at) || 0; return !R || (t >= R[0] && t < R[1]); };
const hHas = (c, R) => !!R && Array.isArray(c?.history) && c.history.some(h => hIn(h, R));
function hCount(k) { const R = hRange(k); if (!R) return 0; const pre = `c-${pickedBranch}-`; let n = 0; for (const [id, c] of counts) if (id.startsWith(pre) && hHas(c, R)) n++; return n; }
const hDayLabel = k => k === 'aaj' ? 'Aaj' : k === 'kal' ? 'Kal' : k === '7' ? 'Pichhle 7 din' : /^\d{4}-/.test(k) ? new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'Sab';
const stampText = t => {
  const d = new Date(t);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' ' +
         d.toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit' });
};

// Bill se cost: POS ke purchase bills (posBills) mein har item ka aakhri khareed bhao.
export function billRates(bills) {
  const byCode = new Map(), byName = new Map();
  const when = b => Number(b.at || b.createdAt) || Date.parse(b.date || '') || 0;
  const packOf = l => {
    const r = rows.find(x => (l.code && x.code === l.code) || norm(x.name) === norm(l.name));
    return Number(r?.pack) || 0;
  };
  bills.slice().sort((a, b) => when(a) - when(b)).forEach(b => (b.lines || []).forEach(l => {
    let c = Number(l.pcs) || 0;
    const item = rows.find(x => (l.code && x.code === l.code) || norm(x.name) === norm(l.name));
    if (!c && Number(l.ctn)) { const p = packOf(l); c = p > 0 ? Number(l.ctn) / p : Number(l.ctn); }
    if (!Number(l.pcs) && item && Number(l.ctn) && Number(item.pack) > 1 && Number(item.rate)) {
      const p = Number(item.pack), ctnPc = Number(l.ctn) / p;
      c = Math.abs(Math.log(ctnPc / item.rate)) < Math.abs(Math.log(Number(l.ctn) / item.rate)) ? ctnPc : Number(l.ctn);
    }
    if (!c) return;
    if (l.code) byCode.set(String(l.code), c);
    if (l.name) byName.set(norm(l.name), c);
  }));
  return r => (r.code && byCode.get(String(r.code))) || byName.get(norm(r.name)) || 0;
}

export function stockReport(fallback) {
  const { pick, items: raw, names } = collect();
  const items = raw.map(r => r.prate || !fallback ? r : { ...r, prate: fallback(r) });
  const line = r => {
    const c = countOf(pick, r);
    if (!c) return null;
    const d = Math.round((countedPcs(c) - Number(sysOf(c, r))) * 100) / 100;
    const past = Array.isArray(c.history) ? c.history.slice().reverse() : [];
    const hist = past.map(h => {
      const hd = Math.round((Number(h.total) - Number(h.sys)) * 100) / 100;
      return `${stampText(h.at)}: ${num(h.ctn)}+${num(h.pcs)} = ${num(h.total)} · Farq ${hd > 0 ? '+' : ''}${num(hd)}`;
    }).join('\n');
    return {
      name: r.name, code: r.code || '',
      sys: num(sysOf(c, r)),
      now: num(r.stock),
      nowDiff: (() => { const nd = Math.round((r.stock - countedPcs(c)) * 100) / 100; return (nd > 0 ? '+' : '') + num(nd); })(),
      cost: r.prate ? (Number(r.pack) > 1
        ? `${num(r.prate)} / ${r.uName || 'Pcs'}\n${num(r.prate)} × ${num(r.pack)} = ${num(Math.round(r.prate * r.pack * 100) / 100)} / ${r.cName || 'Ctn'}`
        : num(r.prate)) : '',
      count: `${num(c.ctn)} ${r.cName || 'Ctn'} + ${num(c.pcs)} ${r.uName || 'Pcs'} = ${num(c.total)}`,
      diff: (d > 0 ? '+' : '') + num(d),
      value: r.prate ? (d > 0 ? '+' : '') + num(d * r.prate) : '',
      rs: r.prate ? Math.round(d * r.prate * 100) / 100 : 0,
      calc: r.prate ? `${(d > 0 ? '+' : '') + num(d)} × ${num(r.prate)} = ${(d > 0 ? '+' : '') + num(Math.round(d * r.prate * 100) / 100)}` : '',
      hist, d, sure: sysSure(c)
    };
  };
  const rows = items.map(line).filter(Boolean).filter(r => filter !== 'farq' || Math.abs(r.d) > 0.001);
  const netRs = rows.reduce((n, x) => n + x.rs, 0);
  const kamRs = rows.reduce((n, x) => n + (x.rs < 0 ? x.rs : 0), 0);
  const zyadaRs = rows.reduce((n, x) => n + (x.rs > 0 ? x.rs : 0), 0);
  const noCost = rows.filter(x => Math.abs(x.d) > 0.001 && !x.cost).length;
  return {
    kamRs: Math.round(kamRs * 100) / 100,
    zyadaRs: Math.round(zyadaRs * 100) / 100,
    noCost,
    unsure: rows.filter(x => !x.sure).length,
    branch: branchName(pick, names),
    round,
    counted: rows.length,
    total: items.length,
    netRs: Math.round(netRs * 100) / 100,
    rows
  };
}

export function stockStop() {
  stockActive = false;
  if (stop) { stop(); stop = null; }
  if (stopCount) { stopCount(); stopCount = null; }
  counts = new Map(); round = '';
  rows = []; loaded = false; failed = '';
}

export function stockBack() { stockStop(); }

// ---------- Nayi Sale (sale.js) ke liye: wahi posStock data, ginti ke baghair ----------
export function saleStock() {
  start(false);
  const chunks = rows.filter(r => !r.meta && Array.isArray(r.items));
  const branches = [...new Set(chunks.map(c => c.branch))].sort((a, b) => a - b);
  const names = {};
  rows.forEach(r => { if (r.branch != null && r.name) names[r.branch] = r.name; });
  const itemsFor = b => chunks.filter(c => c.branch === b)
    .sort((x, y) => (x.order || 0) - (y.order || 0)).flatMap(c => c.items);
  return { loaded, failed, branches, names, itemsFor, hidden, branchName, syncedAt: b => Number(rows.find(r => r.meta && r.branch === b)?.syncedAt) || 0 };   // v2.99.16: POS rate kitne taza
}
let saleHook = null, saleSeen = [], saleQtyHook = null, saleFindHook = null;
export function setSaleFindHook(fn) { saleFindHook = fn; }
// v1.61.2: camera khulte waqt apni list BILL se dobara banaye (Naya bill / item hatane ke baad purani list na dikhe)
let saleCartHook = null, saleDelHook = null;
export function setSaleDelHook(fn) { saleDelHook = fn; }
let saleGodamHook = null, saleBillsHook = null;   // v2.64: scanner par godam chips + PC par aaj ke bills
export function setSaleGodamHook(fn) { saleGodamHook = fn; }
export function setSaleBillsHook(fn) { saleBillsHook = fn; }   // v1.64: camera ki list se line katna
export function setSaleCartHook(fn) { saleCartHook = fn; }
let saleLineGodamHook = null; export function setSaleLineGodamHook(fn) { saleLineGodamHook = fn; }   // v2.95: line ka godam
// v2.95: bill (edit / naya) bahar se badla -> khuli scan screen ki list dobara bill se; band ho to khol do
export function scanReload(noOpen) { if (scanBox && scanBox._reload) { scanBox._reload(); return; } if (!noOpen && saleRoot()) openSaleCamera(); }
function syncFromCart() {
  if (!saleRoot() || !saleCartHook) return;
  try {
    const cur = saleCartHook() || [];
    scanOrder = []; scanItems = new Map(); scanQty = new Map();
    for (const c of cur) {
      const k = String(c.key || c.item.id);   // v1.62: har bill line alag
      if (!scanItems.has(k)) { scanItems.set(k, c.item); scanOrder.push(k); scanQty.set(k, { pcs: 0, ctn: 0 }); }
      const q = scanQty.get(k); q.pcs = Math.round(((Number(q.pcs) || 0) + (Number(c.pcs) || 0)) * 1000) / 1000; q.ctn = (Number(q.ctn) || 0) + (Number(c.ctn) || 0);
    }
    lastKey = scanOrder[scanOrder.length - 1] || '';
    lastScan = lastKey ? scanItems.get(lastKey) : null;
  } catch {}
}
export function setSaleQtyHook(fn) { saleQtyHook = fn; }
let lastScan = null, lastKey = '', scanQty = new Map(), padUnit = 'pcs';   // v1.62: lastKey = aakhri line ki pehchan   // camera par tadad ke buttons
let scanOrder = [], scanItems = new Map();   // camera ki screen par bill ki lines
export function setSaleScanHook(fn) { saleHook = fn; }
export function openSaleCamera() { saleSeen = []; openScanner(); }
const saleRoot = () => !!document.querySelector('[data-sale-root],[data-pp-root],[data-tr-root]');   // v1.86: POS Purchase screen bhi · v2.42: transfer note bhi

// ---------- data ----------

function collect() {
  const chunks = rows.filter(r => !r.meta && Array.isArray(r.items));
  const branches = [...new Set(chunks.map(c => c.branch))].sort((a, b) => a - b);
  const names = {};
  rows.forEach(r => { if (r.branch != null && r.name) names[r.branch] = r.name; });
  const g2 = jamaG2(branches, names);
  const canJama = branches.includes(1) && g2 != null;
  const pick = (branch === JAMA && canJama) ? JAMA : branches.includes(branch) ? branch : (branches.includes(1) ? 1 : branches[0]);   // v1.67: shuru mein NOOR TRADERS (branch 1) · v2.82: 0 = 🧮 jama
  const of = b => chunks.filter(c => c.branch === b).sort((a, b) => (a.order || 0) - (b.order || 0)).flatMap(c => c.items);
  const items = pick === JAMA ? jamaItems(of(1), of(g2)) : of(pick);
  const meta = rows.find(r => r.meta && r.branch === (pick === JAMA ? 1 : pick)) || null;
  return { branches, pick, items, meta, names, g2, canJama };
}

// v2.82: 🧮 JAMA (farzi) — NOOR TRADERS + Godam 2 ek jagah. Sirf dikhane ke liye, POS mein kuch nahi badalta.
// "apni factory" category (surf, soda, kala soap) ka NT wala MINUS stock jama mein shamil NAHI (0 gina jata).
const JAMA = 0;
const isFactory = r => /factory|fact?ry|فیکٹری/i.test(String(r.cat || ''));
function jamaG2(branches, names) {
  const byName = branches.find(b => /godam\s*-?\s*2\b/i.test(String(names[b] || '')));
  if (byName != null) return byName;
  return branches.includes(2) ? 2 : null;
}
function jamaItems(nt, g2) {
  const map = new Map();
  for (const r of nt) map.set(String(r.id), { ...r, _nt: Number(r.stock) || 0, _g2: 0 });
  for (const r of g2) { const k = String(r.id); const o = map.get(k); if (o) o._g2 = Number(r.stock) || 0; else map.set(k, { ...r, _nt: 0, _g2: Number(r.stock) || 0 }); }
  return [...map.values()].map(o => {
    const fac = isFactory(o) && o._nt < 0;
    const stock = Math.round(((fac ? 0 : o._nt) + o._g2) * 100) / 100;
    const pack = Number(o.pack) || 0, ctn = pack > 0 ? Math.floor(stock / pack) : 0;
    return { ...o, stock, ctn, pcs: pack > 0 ? Math.round((stock - ctn * pack) * 100) / 100 : stock, _fac: fac, _jama: true };
  }).sort((a, b) => String(a.name).localeCompare(String(b.name)));
}
const isHidden = r => !!hidden[String(r.id)];
const passes = r => {
  if (filter === 'hidden') return isHidden(r);
  if (isHidden(r)) return false;
  if (filter === 'has') return Math.abs(Number(r.stock) || 0) > 0.001 || !!countOf(pickedBranch, r);
  if (filter === 'minus') return r.stock < 0;
  if (filter === 'baqi') return !countOf(pickedBranch, r);
  if (filter === 'farq') { const c = countOf(pickedBranch, r); return c && Math.abs(countedPcs(c) - Number(sysOf(c, r))) > 0.001; }
  if (filter === 'nishan') return !!flagOf(r.id).baqi;
  if (filter === 'hday') return hHas(counts.get(countId(pickedBranch, r.id)), hRange());   // v2.99.87
  if (filter === 'check') return !!flagOf(r.id).check;
  return true;
};
let pickedBranch = null;
const branchName = (b, names) => (names && names[b]) || (b === 9 ? 'Godam 1' : 'Branch ' + b);

// v2.99.26: sync-stock v2 ka posStock/_live — PC POS se kitni dair pehle juri thi (har ~2 min likhta hai; tabdeeli par seconds mein)
const liveDoc = () => rows.find(r => r.id === '_live' && r.live);
const liveAge = () => { const L = liveDoc(); return L ? Date.now() - (Number(L.checkedAt) || 0) : null; };
function liveChip() {
  const a = liveAge(); if (a == null) return '';
  const m = Math.floor(a / 60000), s = Math.max(0, Math.floor(a / 1000));
  const t = s < 60 ? s + ' sec' : m < 60 ? m + ' min' : Math.floor(m / 60) + ' ghante';
  const cls = a <= 3 * 60000 ? 'ok' : a <= 5 * 60000 ? 'warn' : 'bad';
  const txt = cls === 'ok' ? `🟢 POS se juda · ${t} pehle check` : cls === 'warn' ? `🟡 POS check ${t} pehle` : `🔴 ${t} se POS ka stock nahi aaya — Server PC check karein`;
  return `<span class="live-chip ${cls}" title="Server PC har 5 sec POS dekhta hai — bill / purchase / transfer ke chand second baad yahan stock badalta hai">${txt}</span>`;
}
// ginti save se pehle: stock 5 min se purana ho to poochho (10 min mein ek dafa)
let staleAskedAt = 0;
function staleOk() {
  const a = liveAge(); if (a == null || a <= 5 * 60000 || Date.now() - staleAskedAt < 10 * 60000) return true;
  staleAskedAt = Date.now();
  return confirm(`⚠️ System stock ${Math.floor(a / 60000)} minute purana hai (Server PC se taza stock nahi aa raha).\nFarq ghalat aa sakta hai.\n\nPhir bhi ginti save karein?`);
}
function since(stamp) {
  if (!stamp) return '';
  const mins = Math.floor((Date.now() - stamp) / 60000);
  if (mins < 1) return 'abhi abhi';
  if (mins < 60) return mins + ' minute pehle';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + ' ghante pehle';
  return new Date(stamp).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' });
}

// ---------- screen ----------

// Screen dobara banne par likhi hui (abhi save nahi hui) ginti gum na ho
const COUNT_SEL = '[data-count-ctn],[data-count-pcs],[data-count-tot]';
// Likhte hi neeche ginti / system / farq dikhao
function liveCount(id) {
  const box = $('list')?.querySelector(`[data-count-live="${CSS.escape(String(id))}"]`);
  if (!box) return;
  const { items } = collect();
  const item = items.find(r => String(r.id) === String(id));
  if (!item) return;
  const v = readCount(item, true);
  if (!v || v.bad) { box.innerHTML = ''; return; }
  const sys = Number(item.stock) || 0, diff = Math.round((v.total - sys) * 100) / 100;
  const u = item.uName || 'Pcs';
  if (!seeStock()) { box.innerHTML = `<b>${num(v.total)} ${esc(u)}</b>`; return; }
  box.innerHTML = `<b>${num(v.total)} ${esc(u)}</b> · System ${num(sys)} · <b class="${diff < 0 ? 'red' : diff > 0 ? 'green' : ''}">Farq ${diff > 0 ? '+' : ''}${num(diff)} ${esc(u)}${diff < 0 ? ' (kam)' : diff > 0 ? ' (zyada)' : ' (barabar)'}</b>${item.prate && diff ? ' · Rs ' + (diff > 0 ? '+' : '') + num(diff * item.prate) : ''}`;
}
document.addEventListener('input', e => {
  const t = e.target;
  const id = t.dataset?.countCtn ?? t.dataset?.countPcs ?? t.dataset?.countTot;
  if (id != null) liveCount(id);
});
let stockActive = false;
function captureTyped() {
  const keep = new Map();
  const lst = $('list');
  if (!lst?.querySelectorAll) return keep;
  lst.querySelectorAll(COUNT_SEL).forEach(el => {
    if (el.value === el.defaultValue) return;
    const [name, id] = Object.entries(el.dataset)[0] || [];
    if (name) keep.set(`${pickedBranch}|${name}|${id}`, el.value);
  });
  return keep;
}
function restoreTyped(keep) {
  if (!keep.size) return;
  const lst = $('list');
  if (!lst?.querySelectorAll) return;
  lst.querySelectorAll(COUNT_SEL).forEach(el => {
    const [name, id] = Object.entries(el.dataset)[0] || [];
    const k = `${pickedBranch}|${name}|${id}`;
    if (keep.has(k)) el.value = keep.get(k);
  });
}

export function renderStock() {
  stockActive = true;
  const typed = captureTyped();
  renderStockInner();
  restoreTyped(typed);
}

function renderStockInner() {
  start();

  const q = norm($('search')?.value || '');
  const { branches, pick, items, meta, names, canJama } = collect();
  pickedBranch = pick;

  $('actions').innerHTML = '';
  { // v2.101.1: upar chipki search mein likhte waqt sirf neeche ka hissa badle (input wahi rahe — keyboard na toote)
    const html = summaryHTML(branches, pick, items, meta, names, canJama), sm = $('summary'), a = document.activeElement;
    if (a?.matches?.('[data-sk-q]') && sm.querySelector('.sk-body')) { const t = document.createElement('div'); t.innerHTML = html; const nb = t.querySelector('.sk-body'), ob = sm.querySelector('.sk-body'); if (nb && ob) ob.innerHTML = nb.innerHTML; const ne = t.querySelector('.sk-hrow em'), oe = sm.querySelector('.sk-hrow em'); if (ne && oe) oe.textContent = ne.textContent; }
    else sm.innerHTML = html;
  }

  if (failed) {
    $('list').innerHTML = `<div class="empty"><strong>Stock nahi mila</strong><p>${esc(failed)}</p></div>`;
    return;
  }
  if (!loaded) { $('list').innerHTML = '<p class="stat-note">Stock load ho raha hai…</p>'; return; }
  if (!items.length) {
    $('list').innerHTML = `<div class="empty"><strong>Abhi stock nahi aaya</strong>
      <p>PC par <b>node sync-stock.js</b> chala kar dekhein.</p></div>`;
    return;
  }

  if (scanList.length) {
    // SCAN LIST: sirf scan kiye hue items, scan ki tarteeb mein (filter/search nahi lagta)
    const byId = new Map(items.map(r => [String(r.id), r]));
    const shownScan = scanList.map(id => byId.get(String(id))).filter(Boolean);
    $('list').innerHTML = `<div class="scan-bar">
        <b>Scan list: ${num(shownScan.length)} items</b>
        <small>Har item ki ginti likhein (Enter = agla khana), phir neeche "Sab save karein"</small>
      </div>` + shownScan.map(rowHTML).join('') +
      `<div class="account-tools scan-foot">
        <button class="sh-wide scan-save" data-scan-saveall="1">💾 Sab save karein (${num(shownScan.length)})</button>
        <button class="sh-wide" data-stock-scan="1">${camIco()} Aur scan karein</button>
        <button class="sh-wide sh-clear" data-stock-clear="1">✕ Saaf karein — wapas poori list</button>
      </div>`;
    return;
  }

  if (pickedBranch !== 1 && filter === 'all' && !godamAll) filter = 'has';   // v1.97: godam khula ho to shuru se sirf usi ke items
  let shown = items.filter(passes), wide = 0;
  if (inPick && inPick.size) shown = items.filter(r => inPick.has(String(r.id)));   // v2.6: aaye hue maal ki ginti
  if (q) {   // v2.4.5: sale jaisi — poore stock mein (filter se bahar bhi), best match UPAR (tarteeb smartSearch ki)
    const pool = items.filter(r => filter === 'hidden' ? isHidden(r) : !isHidden(r));
    const inF = new Set(shown);
    shown = smartSearch(pool, q, 500);
    wide = shown.filter(r => !inF.has(r)).length;
  } else if (sort === 'stock') shown.sort((a, b) => b.stock - a.stock);
  else shown.sort((a, b) => NAMEC.compare(String(a.name), String(b.name)));

  const extra = shown.length - limit;
  const list = shown.slice(0, limit);

  $('list').innerHTML =
    (inPick && inPick.size ? `<div class="in-strip">📥 Aaye hue maal ki ginti — ${num(shown.length)} items <button type="button" data-in-clear="1">✕ saaf karein</button></div>` : '') +
    (q ? `<p class="stat-note">${shown.length} item mile${wide && filter !== 'all' ? ` · ${num(wide)} filter ke bahar se bhi (poore stock mein dhoonda)` : ''}</p>` : '') +
    (filter === 'farq' && !q ? farqHeadHTML(shown) + list.map(farqCardHTML).join('') : list.map(rowHTML).join('')) +
    (extra > 0 ? `<div class="account-tools"><button data-stock-more="1">Aur ${num(Math.min(extra, PAGE))} dikhao (${num(extra)} baqi)</button></div>
      <p class="stat-note">Ya naam / code search karein.</p>` : '');
}

// ================= v2.99.58 💎 FARQ TAB (premium) + 🧾 ginti ke baad bill ka nishan =================
// PC (post-farq v13) count doc par `later` likhta hai = ginti ke BAAD is item ki POS harkat (sale / purchase). Aisa item farq bill
// mein tab tak NAHI jata jab tak dobara na gina jaye (recount) ya malik "Phir bhi shamil karo" (forceBill) na kare.
const lateOf = c => (c && Array.isArray(c.later) && c.later.length && !c.recount && !c.forceBill && c.laterFor === c.at) ? c.later : null;
const hm = ms => { const d = new Date(Number(ms) || 0); return isNaN(d) ? '' : d.toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit' }); };
function farqHeadHTML(shown) {
  let kam = 0, zy = 0, rs = 0, late = 0;
  for (const r of shown) { const c = countOf(pickedBranch, r); if (!c) continue; const d = countedPcs(c) - Number(sysOf(c, r)); if (d < 0) kam++; else if (d > 0) zy++; if (r.prate) rs += d * r.prate; if (lateOf(c)) late++; }
  return `<div class="fq-head"><div><small>Farq wale items</small><b>${num(kam + zy)}</b></div><div class="red"><small>Kam</small><b>${num(kam)}</b></div><div class="green"><small>Zyada</small><b>${num(zy)}</b></div><div class="${rs < 0 ? 'red' : 'green'}"><small>Kul farq</small><b>Rs ${rs > 0 ? '+' : ''}${num(Math.round(rs))}</b></div></div>
    ${late ? `<div class="fq-warn">🧾 <b>${num(late)} items</b> ka ginti ke baad bill bana — inhein <b>dobara gino</b>. Tab tak yeh farq bill mein nahi jayenge (late bill ho sakta hai).</div>` : ''}`;
}
function farqCardHTML(r) {
  rowCache.set(String(r.id), r);
  const c = countOf(pickedBranch, r); if (!c) return rowHTML(r);
  const sys = Number(sysOf(c, r)), got = countedPcs(c), d = Math.round((got - sys) * 100) / 100, u = esc(r.uName || 'Pcs'), L = lateOf(c);
  const pack = Number(r.pack) || 0, fmt = q => pack > 1 ? `${num(Math.trunc(q / pack))} ${esc(r.cName || 'Ctn')} + ${num(Math.round((q % pack) * 100) / 100)} ${u}` : `${num(q)} ${u}`;
  const lsum = L ? Math.round(L.reduce((n, m) => n + Number(m.qty || 0), 0) * 100) / 100 : 0;
  const match = L && Math.abs(Math.abs(lsum) - Math.abs(d)) < 0.01 && Math.sign(lsum) === Math.sign(d);
  const lateBox = L ? `<div class="fq-late${match ? ' match' : ''}"><b>🧾 Ginti (${esc(hm(c.at))}) ke baad bill bana — dobara gino</b>
      ${L.slice(0, 5).map(m => `<span>${m.kind === 'sale' ? '🛒 Sale' : m.kind === 'purchase' ? '📦 Purchase' : '⇄'} ${m.qty > 0 ? '+' : ''}${num(m.qty)} ${u} · ${esc(hm(m.at))}${m.ref ? ' · ' + esc(m.ref) : ''}</span>`).join('')}
      ${match ? '<small>⚠️ Farq aur bill ki tadad barabar — shayad late bill tha, asal farq nahi</small>' : ''}
      ${isOwner() ? `<button type="button" class="fq-force" data-fq-force="${esc(r.id)}">Phir bhi farq bill mein shamil karo</button>` : ''}</div>` : '';
  const tag = c.recount ? '<i class="fq-tag ok">✓ Dobara gin liya — theek hai</i>' : c.forceBill ? '<i class="fq-tag">Malik: bill mein shamil</i>' : '';
  return `<article class="fq-card ${d < 0 ? 'kam' : 'zy'}${L ? ' late' : ''}" data-stock-row="${esc(r.id)}">
    <div class="fq-top"><div class="fq-nm"><b>${esc(r.name)}</b><small>${[r.code || '', r.prate ? 'Khareed ' + num(r.prate) : '', 'Gina ' + stampText(c.at)].filter(Boolean).map(esc).join(' · ')}</small>${tag}</div>
      <div class="fq-amt"><b>${d > 0 ? '+' : ''}${num(d)} ${u}</b>${r.prate ? `<small>Rs ${d > 0 ? '+' : ''}${num(Math.round(d * r.prate))}</small>` : ''}</div></div>
    <div class="fq-chips"><span><small>Gina</small><b>${fmt(got)}</b></span><span><small>System (us waqt)</small><b>${fmt(sys)}</b>${sysSure(c) ? '' : '<em>PC tasdeeq baqi</em>'}</span><span><small>Abhi system</small><b>${fmt(Number(r.stock) || 0)}</b></span></div>
    ${lateBox}
    <details class="fq-re${L ? ' must' : ''}"${L ? ' open' : ''}><summary>${L ? '✏️ Dobara gino (zaroori)' : '✏️ Ginti badalni ho to (zaroori nahi)'}</summary>${countLocked() || !round ? '<small class="stat-note">Ginti abhi band hai</small>' : `<div class="pos-dates">
      <label>Ctn<input type="number" step="any" inputmode="decimal" style="width:4.6em" data-count-ctn="${esc(r.id)}" value=""></label>
      <label>${u}<input type="number" step="any" inputmode="decimal" style="width:4.6em" data-count-pcs="${esc(r.id)}" value=""></label>
      <label>Kul ${u}<input type="number" step="any" inputmode="decimal" style="width:5.6em" data-count-tot="${esc(r.id)}" value=""></label>
      <button type="button" data-count-save="${esc(r.id)}">💾 Save</button>
      <div class="count-live" data-count-live="${esc(r.id)}"></div></div>`}</details>
  </article>`;
}
document.addEventListener('click', async e => {
  const b = e.target.closest?.('[data-fq-force]'); if (!b || !isOwner()) return;
  const r = rowCache.get(String(b.dataset.fqForce)); if (!r) return;
  if (!confirm(`"${r.name}" — ginti ke baad bill bana tha.\nPhir bhi is ka farq bill mein shamil karein? (late bill tha to stock do dafa kat sakta hai)`)) return;
  try { await cloud.patchStockCount(countId(pickedBranch, r.id), { forceBill: true }); notice('✓ Farq bill mein shamil hoga'); } catch (er) { notice('Nahi hua: ' + (er?.message || er)); }
});

// v1.67: ginti ka sirf ek line ka khulasa; poori tafseel "📋 Dekhein" khirki mein. Counting ON/OFF, Nayi ginti,
// Farq wale / Check wale ab samne nahi (malik ki farmaish). Nayi ginti sirf khirki ke andar (malik) — bill ke baad.
function gintiLine(pick, done) {
  if (!round) return '<div class="sh-note">Abhi koi ginti nahi hui</div>' + (isOwner() ? '<div class="account-tools"><button data-stock-ginti="1">📋 Ginti</button></div>' : '');
  const billed = postReq && postReq.round === round && postReq.branch === pick && postReq.status === 'done';
  const d = round.slice(8, 10) + '-' + round.slice(5, 7);
  return `<div class="sh-note">${esc(d)} ki ginti: <b>${num(done)} items</b> gine gaye · ${billed ? 'bill ban gaya' : 'bill abhi nahi bana'}</div>
    <div class="account-tools"><button data-stock-ginti="1">📋 Dekhein</button>${isOwner() ? '<button data-stock-post="1">Farq ka bill PC par banao</button>' : ''}</div>
    ${isOwner() && countOff ? '<div class="account-tools"><button data-stock-lock="1" class="sh-lock off">🔴 Counting band hai — kholein</button></div>' : ''}
    ${countLocked() ? '<p class="stat-note sh-locked">🔴 Malik ne counting band ki hui hai — ginti save nahi ho sakti.</p>' : ''}`;
}
// v2.13: ginti ki report ka data (PDF app.js banata hai)
export function gintiReport() {
  const { pick, items, names } = collect();
  const list = items.map(r => ({ r, c: countOf(pick, r) })).filter(x => x.c)
    .sort((a, b) => (Number(b.c.at) || 0) - (Number(a.c.at) || 0));
  if (!list.length) return null;
  let net = 0, kam = 0, zyada = 0;
  const rows = list.map(({ r, c }) => {
    const sys = Number(sysOf(c, r)), got = countedPcs(c), f = got - sys, rs = r.prate ? f * r.prate : 0;
    net += rs; if (f < 0) kam++; else if (f > 0) zyada++;
    return { name: r.name, at: stampText(c.at), gina: `${num(c.ctn)}+${num(c.pcs)}`, ginaPcs: num(got), sys: num(sys),
      farq: (f > 0 ? '+' : '') + num(f), rs: (rs > 0 ? '+' : '') + num(Math.round(rs)), conf: f < 0 ? 'r' : f > 0 ? 'g' : '' };
  });
  return { branch: branchName(pick, names), round: round || '', rows, net: Math.round(net), kam, zyada, total: list.length };
}
let gintiPdfOf = null;
export function setGintiPdf(fn) { gintiPdfOf = fn; }
let gf = 'all', gSel = null;   // gSel: null = sab farq wale tick
function openGinti() {
  const d = $('dialog'); if (!d) return;
  const { pick, items, names } = collect(); roundNow();
  const list = items.map(r => ({ r, c: countOf(pick, r) })).filter(x => x.c).sort((a, b) => (Number(b.c.at) || 0) - (Number(a.c.at) || 0));
  const see = seeStock(), own = isOwner();
  let net = 0, kam = 0, zy = 0, kr = 0, zr = 0;
  const rows0 = list.map(({ r, c }) => { const f = Math.round((countedPcs(c) - Number(sysOf(c, r))) * 100) / 100, rs = r.prate ? f * r.prate : 0, bi = billOf(r, c, pick); net += rs; if (f < 0) { kam++; kr += rs; } else if (f > 0) { zy++; zr += rs; } return { r, c, f, rs, bi }; });
  const L = rows0.filter(x => gf === 'all' || (gf === 'kam' ? x.f < 0 : gf === 'zy' ? x.f > 0 : gf === 'baqi' ? (x.bi.k === 'baqi' || x.bi.k === 'part') : Math.abs(x.f) < 0.001));
  const pend = rows0.filter(x => x.bi.k === 'baqi' || x.bi.k === 'part');
  const sel = gSel || new Set(pend.map(x => String(x.r.id)));
  const selK = pend.filter(x => x.f < 0 && sel.has(String(x.r.id))), selZ = pend.filter(x => x.f > 0 && sel.has(String(x.r.id)));
  const p = postReq && postReq.round === round && postReq.branch === pick ? postReq : null, busyP = p && ['pending', 'approved', 'posting', 'preview'].includes(p.status);
  const st = x => x.bi.k === 'done' ? `<span class="ok">✓ ${esc(x.bi.no)}</span>` : x.bi.k === 'part' ? `<span class="w">${esc(x.bi.no)} ${num(x.bi.q)} · baqi</span>` : x.bi.k === 'baqi' ? `<span class="w">bill baqi</span>` : `<span class="e">barabar</span>`;
  const who = x => `${esc(stampText(x.c.at))}${x.c.byName ? ' · ' + esc(x.c.byName) : ''}${(x.c.history || []).length > 1 ? ' · ✏️ ' + x.c.history.length + ' dafa' : ''}`;
  const rows = L.map(x => { const k = x.f < 0 ? 'r' : x.f > 0 ? 'g' : 'z', canSel = own && (x.bi.k === 'baqi' || x.bi.k === 'part') && !busyP;
    return `<div class="sk-tr${see ? '' : ' nosee'}${own ? ' own' : ''}">${own ? `<span class="ck">${canSel ? `<input type="checkbox" data-ginti-sel="${esc(x.r.id)}"${sel.has(String(x.r.id)) ? ' checked' : ''}>` : ''}</span>` : ''}<button type="button" class="nm" data-ginti-row="${esc(x.r.id)}"><b>${esc(x.r.name)}</b><span class="e">${who(x)}</span>${see ? st(x) : ''}</button>${see ? `<span class="n">${num(sysOf(x.c, x.r))}</span>` : ''}<span class="n"><b>${num(countedPcs(x.c))}</b></span>${see ? `<span class="fq"><b class="${k}">${x.f > 0 ? '+' : ''}${num(x.f)}</b><span class="${k}">${x.rs ? 'Rs ' + (x.rs > 0 ? '+' : '') + num(Math.round(x.rs)) : 'barabar'}</span></span>` : ''}</div>`; }).join('');
  d.classList.remove('search-dialog'); d.classList.add('full-dialog');
  $('dialogTitle').textContent = (autoOn ? '📋 Aaj ki ginti' : `📋 Ginti ${round || ''}`) + ' — ' + branchName(pick, names);
  $('dialogBody').innerHTML = `<div class="sk-sheet" id="skGinti">
    ${!round ? `<div class="sc-banner warn"><b>⏳ Abhi ginti shuru nahi</b><small>${own ? '"📅 Session = din" on karein — roz khud shuru.' : 'Malik shuru kare.'}</small></div>${own ? '<div class="sk-two"><button type="button" class="sk-btn p" data-sk-auto-on="1">📅 Session = din (ON)</button><button type="button" class="sk-btn" data-stock-round="new">Nayi ginti (haath se)</button></div>' : ''}` : `
    ${see ? `<div class="sk-ghead"><div class="sk-kp"><div><b>${num(list.length)}</b><span>items gine</span></div><div><b>${num(kam)} kam</b><span>Rs ${num(Math.round(kr))}</span></div><div><b>${num(zy)} zyada</b><span>Rs +${num(Math.round(zr))}</span></div></div>
      <div class="sk-kul"><span>Kul farq (khareed rate)</span><b class="${net < 0 ? 'r' : net > 0 ? 'g' : ''}">Rs ${net > 0 ? '+' : ''}${num(Math.round(net))}</b></div></div>` : `<div class="sk-ghead"><div class="sk-kp"><div><b>${num(list.length)}</b><span>items gine</span></div></div></div>`}
    ${postLine(pick)}
    ${own && !busyP && pend.length ? `<div class="sk-bill"><div class="sk-lab">🧾 Bill banao — "stock fraq" khata (tick wale items)</div>
      <div class="sk-two"><button type="button" class="sk-btn p" data-ginti-bill="kam"${selK.length ? '' : ' disabled'}>Kam wale ka Sale bill<small>${num(selK.length)} items · Rs ${num(Math.round(selK.reduce((t, x) => t - x.rs, 0)))}</small></button><button type="button" class="sk-btn n" data-ginti-bill="zyada"${selZ.length ? '' : ' disabled'}>Zyada wale ka Return bill<small>${num(selZ.length)} items · Rs ${num(Math.round(selZ.reduce((t, x) => t + x.rs, 0)))}</small></button></div>
      <div class="sk-two"><button type="button" class="sk-link" data-ginti-selall="1">☑ Sab tick</button><button type="button" class="sk-link" data-ginti-selnone="1">☐ Sab hatao</button></div></div>` : ''}
    <div class="sk-chips">${[['all', 'Sab'], ['baqi', 'Bill baqi ' + num(pend.length)], ...(see ? [['kam', 'Kam ' + num(kam)], ['zy', 'Zyada ' + num(zy)], ['eq', 'Barabar']] : [])].map(([k, l]) => `<button type="button" class="sk-chip${gf === k ? ' on' : ''}" data-ginti-f="${k}">${l}</button>`).join('')}</div>
    <div class="sk-tbl"><div class="sk-th${see ? '' : ' nosee'}${own ? ' own' : ''}">${own ? '<span></span>' : ''}<span>ITEM</span>${see ? '<span>SYSTEM</span>' : ''}<span>GINA</span>${see ? '<span>FARQ</span>' : ''}</div>${rows || '<p class="sk-note">Is mein koi item nahi.</p>'}</div>
    <p class="sk-note">Line par tap = dobara gino / edit (jab tak bill na bane, wahi ginti badalti hai).</p>
    <div class="sk-two">${list.length && see ? '<button type="button" class="sk-btn p" data-ginti-pdf="1">📄 PDF · WhatsApp</button>' : ''}${own && !autoOn ? '<button type="button" class="sk-btn" data-stock-round="new">Nayi ginti shuru</button>' : ''}</div>`}
    </div>`;
  if (!d.open) d.showModal();
}
// 🧾 malik: chune hue items ka Sale (kam) / Return (zyada) — PC post-farq direct (preview nahi)
async function gintiBill(kind) {
  if (!isOwner() || !cloud?.requestFarqPost || !round) return;
  const { pick, items } = collect();
  const rows = items.map(r => ({ r, c: countOf(pick, r) })).filter(x => x.c).map(x => ({ ...x, f: countedPcs(x.c) - Number(sysOf(x.c, x.r)), bi: billOf(x.r, x.c, pick) }));
  const pend = rows.filter(x => x.bi.k === 'baqi' || x.bi.k === 'part'), sel = gSel || new Set(pend.map(x => String(x.r.id)));
  const pickd = pend.filter(x => sel.has(String(x.r.id)) && (kind === 'kam' ? x.f < 0 : x.f > 0));
  if (!pickd.length) { notice('Koi item tick nahi'); return; }
  const rs = Math.round(pickd.reduce((t, x) => t + Math.abs(x.f) * (x.r.prate || 0), 0));
  if (!confirm(`${kind === 'kam' ? 'SALE bill (kam nikle)' : 'RETURN bill (zyada nikle)'} — "stock fraq" khata\n${pickd.length} items · Rs ${num(rs)}\n${pickd.slice(0, 8).map(x => x.r.name + ' ' + (x.f > 0 ? '+' : '') + num(x.f)).join('\n')}${pickd.length > 8 ? '\n…' : ''}\n\nPC par bill banayein?`)) return;
  try { await cloud.requestFarqPost({ round, branch: pick, status: 'approved', direct: true, kind, items: pickd.map(x => String(x.r.id)), at: Date.now(), approvedAt: Date.now() }); gSel = null; notice('PC ko bhej diya — bill 1 min mein, yahin dikhega'); openGinti(); }
  catch (e) { notice(e?.message || 'Nahi bheja ja saka'); }
}
// ✏️ dobara gino / edit (ginti dialog ki line par tap) — pichhli ginti + nayi; auto: POS mein agla delta
function openRecount(itemId) {
  const d = $('dialog'); if (!d) return;
  const { pick, items } = collect(); const r = items.find(x => String(x.id) === String(itemId)); if (!r) return;
  const c = countOf(pick, r), per = Number(r.pack) || 0, H = Array.isArray(c?.history) ? c.history.slice(-5).reverse() : [];
  const f = c ? Math.round((countedPcs(c) - Number(sysOf(c, r))) * 100) / 100 : 0;
  d.classList.remove('search-dialog'); d.classList.add('full-dialog'); $('dialogTitle').textContent = '✏️ Dobara gino — ' + r.name;
  $('dialogBody').innerHTML = `<div class="sk-sheet" id="skRe" data-re-item="${esc(r.id)}">
    <div class="sk-rehead"><b>${esc(r.name)}</b><small>${seeStock() ? 'system ' + num(r.stock) + ' ' + esc(r.uName || 'Pcs') : esc(r.code || '')}${per > 1 ? ' · 1 ' + esc(r.cName || 'Ctn') + ' = ' + num(per) : ''}${seeStock() && r.prate ? ' · khareed Rs ' + num(r.prate) : ''}</small></div>
    ${H.length ? `<div class="sk-list"><div class="sk-lh">AAJ KI GINTI</div>${H.map((h, i) => `<div class="sk-hist${i === 0 ? ' cur' : ''}"><span class="t"><b>${esc(stampText(h.at))}${i === 0 ? ' (abhi lagi hui)' : ''}${h.tick ? ' · ✓ tick' : ''}</b><span>${seeStock() ? 'system ' + num(h.sys) + ' · ' : ''}gina ${num(h.total)}${h.ctn ? ' (' + num(h.ctn) + ' ctn + ' + num(h.pcs) + ')' : ''}</span></span>${seeStock() ? `<b class="${h.total - h.sys < 0 ? 'r' : h.total - h.sys > 0 ? 'g' : 'z'}">${h.total - h.sys > 0 ? '+' : ''}${num(Math.round((h.total - h.sys) * 100) / 100)}</b>` : ''}</div>`).join('')}</div>` : ''}
    <div class="sk-lab">Nayi ginti (physical)</div>
    <div class="sk-phy">${per > 1 ? `<label>${esc(r.cName || 'Ctn')}<input type="number" step="any" inputmode="decimal" data-re-ctn="1" value="${c ? esc(String(c.ctn ?? '')) : ''}"></label>` : ''}<label>${esc(r.uName || 'Pcs')}<input type="number" step="any" inputmode="decimal" data-re-pcs="1" value="${c ? esc(String(c.pcs ?? '')) : ''}"></label></div>
    ${seeStock() ? `<div class="sk-farq ${f < 0 ? 'r' : f > 0 ? 'g' : 'z'}" id="reFarq">${c ? `${num(countedPcs(c))} ${esc(r.uName || 'Pcs')} · farq ${f > 0 ? '+' : ''}${num(f)}${r.prate ? ' · Rs ' + (f > 0 ? '+' : '') + num(Math.round(f * r.prate)) : ''}` : 'Ginti likhein'}</div>` : ''}
    ${c && billOf(r, c).k === 'done' ? '<div class="sk-info">⚠️ Is item ka bill ban chuka hai — nayi ginti ka farq agle bill mein jayega.</div>' : ''}
    <button type="button" class="sk-gbig" data-re-save="1">✓ Ye ginti Save</button>
    ${c && isOwner() ? '<button type="button" class="sk-rbtn" data-re-del="1">🗑 Is item ki ginti hatao (farq 0) — sirf malik</button>' : ''}
    <button type="button" class="sk-btn" data-stock-ginti="1">‹ Wapas list</button></div>`;
  if (!d.open) d.showModal();
}
function reRead(r) {
  const per = Number(r.pack) || 0, ctn = Number($('skRe')?.querySelector('[data-re-ctn]')?.value || 0), pcs = Number($('skRe')?.querySelector('[data-re-pcs]')?.value || 0);
  const total = Math.round((ctn * (per > 0 ? per : 1) + pcs) * 100) / 100;
  return { ctn: per > 1 ? ctn : 0, pcs, total, bad: !Number.isFinite(total) };
}
async function reSave() {
  const box = $('skRe'); if (!box) return; const { items } = collect(); const r = items.find(x => String(x.id) === box.dataset.reItem); if (!r) return;
  if (!roundNow()) { notice('Ginti shuru nahi'); return; } if (countLocked()) { notice('🔴 Counting band hai'); return; }
  const v = reRead(r); if (v.bad) { notice('Sirf hindse'); return; }
  if (v.total === 0 && !confirm(`"${r.name}" ki ginti ZERO save karein?`)) return;
  try { await writeCount(r, v, null); if (flagOf(r.id).baqi) await setFlag(r.id, { baqi: false }); notice(`✓ ${r.name} — ${num(v.total)} ${r.uName || 'Pcs'}`); openGinti(); }
  catch (e) { notice('⚠️ Save nahi hui: ' + errTxt(e)); }
}
// 🗑 ginti hatao (malik): auto = PC ulta delta (pfQ wapas); purana = doc del
async function reDel() {
  const box = $('skRe'); if (!box || !isOwner()) return; const { items, pick } = collect(); const r = items.find(x => String(x.id) === box.dataset.reItem); if (!r) return;
  const c = countOf(pick, r); if (!c) return;
  if (billOf(r, c, pick).k === 'done') { notice('Bill ban chuka — ab hatana nahi, dobara gino'); return; }
  if (!confirm(`"${r.name}" ki aaj ki ginti hatani hai?`)) return;
  try { await cloud.saveStockCount({ ...c, id: countId(pick, r.id), del: true, delAt: Date.now(), at: Date.now(), total: Number(c.sys0 ?? c.sys) || 0, ctn: 0, pcs: 0 }); notice('Ginti hata di'); openGinti(); }
  catch (e) { notice('Nahi hua: ' + errTxt(e)); }
}

// v2.76: MALIK ONLY — stock ki kul maaliyat (khareed rate se), bechne par, nafa; har godam alag. Minus / rate-ke-baghair alag gine.
let valShowUntil = 0;
function valueCardHTML(branches, names) {
  const chunks = rows.filter(r => !r.meta && Array.isArray(r.items));
  const per = [], tot = { cost: 0, sale: 0, neg: 0, noRate: 0, n: 0 };
  for (const b of branches) {
    const its = chunks.filter(c => c.branch === b).flatMap(c => c.items).map(fixCost);
    const g = { b, cost: 0, sale: 0, neg: 0, noRate: 0, n: 0 };
    for (const r of its) {
      const q = Number(r.stock) || 0; if (q < -0.0005) { g.neg++; continue; } if (q <= 0.0005) continue;
      const pr = Number(r.prate) || 0, sr = Number(r.rate) || 0;
      if (!pr) { g.noRate++; } else g.cost += q * pr;
      if (sr) g.sale += q * sr; g.n++;
    }
    per.push(g); for (const k of Object.keys(tot)) tot[k] += g[k];
  }
  const show = Date.now() < valShowUntil, R = v => show ? 'Rs ' + num(Math.round(v)) : 'Rs ••••';
  return `<div class="val-card" data-val-toggle="1"><div class="vc-top"><span>💰 Kul stock ki maaliyat <small>(sirf malik)</small></span><b>${R(tot.cost)}</b></div>
    <div class="vc-sub"><span>Bechne par ${R(tot.sale)}</span><span>Andaza nafa <b>${R(tot.sale - tot.cost)}</b></span></div>
    <div class="vc-g">${per.map(g => `<span><small>${esc(branchName(g.b, names))}</small><b>${R(g.cost)}</b></span>`).join('')}</div>
    ${tot.neg || tot.noRate ? `<p class="vc-warn">${tot.neg ? `⚠ ${num(tot.neg)} items ka stock minus — jor mein nahi` : ''}${tot.neg && tot.noRate ? ' · ' : ''}${tot.noRate ? `${num(tot.noRate)} items ka khareed rate nahi` : ''}</p>` : ''}
    <p class="vc-tap">${show ? 'Tap = chhupao' : 'Tap = 30 second dikhao'}</p></div>`;
}
document.addEventListener('click', e => { const c = e.target.closest?.('[data-val-toggle]'); if (!c || !isOwner()) return; valShowUntil = Date.now() < valShowUntil ? 0 : Date.now() + 30000; rerender(); if (valShowUntil) setTimeout(() => { if (Date.now() >= valShowUntil) rerender(); }, 30500); });
function summaryHTML(branches, pick, items, meta, names, canJama = false) {
  // v2.101.1: NAYI TARTEEB (malik: "search tak scroll, chips bohat zyada") — upar CHIPKI patti (search · scan · mic · godam),
  //   ginti ka ek bara button, 8 tiles, 3 chips + Filter (baqi filter / din / tarteeb sheet mein), ⚙️ (malik: switches / purana bill flow).
  const totalPcs = meta?.totalPcs ?? items.reduce((s, r) => s + (r.stock || 0), 0);
  const stamp = meta?.syncedAt;
  const minus = items.filter(r => r.stock < 0 && !isHidden(r)).length;
  const live = items.filter(r => !isHidden(r));
  const hasN = live.filter(r => Math.abs(Number(r.stock) || 0) > 0.001 || countOf(pick, r)).length;
  const hiddenN = items.length - live.length;
  const shownCount = items.filter(passes).length;
  const q = $('search')?.value || '';
  const gd = branches.length > 1 ? `<div class="sk-gd">${branches.map(b => `<button type="button" data-stock-branch="${b}"${b === pick ? ' class="on"' : ''}>${esc(branchName(b, names))}</button>`).join('')}${canJama ? `<button type="button" data-stock-branch="${JAMA}"${pick === JAMA ? ' class="on"' : ''}>🧮 NT + G2</button>` : ''}</div>` : '';
  const tile = (attr, ic, lab, cls = '') => `<button type="button" class="sk-tile${cls ? ' ' + cls : ''}" ${attr}="1"><span>${ic}</span>${lab}</button>`;
  const tiles = [
    canNewItem() ? tile('data-stock-newitem', '➕', 'Naya item') : '',
    can('stock.in') ? tile('data-stock-in', '📥', 'Aaya / gaya') : '',
    can('stock.reg') ? tile('data-stock-reg', '📋', 'Register') : '',
    can('stock.tc') ? tile('data-stock-tc', '🧾', 'Note check') : '',
    can('stock.demand') ? tile('data-demand', '📢', 'Demand') : '',
    can('stock.tolai') ? tile('data-stock-tolai', '⚖️', 'Tolai') : '',
    can('stock.transfer') ? tile('data-stock-transfer', '⇄', 'Transfer') : '',
    canEditItem() ? tile('data-stock-urdu', '🔤', 'Urdu naam') : '',
  ].filter(Boolean);
  const extra = filter === 'baqi' ? 'Ginti baqi' : filter === 'farq' ? '⚖️ Farq wale' : filter === 'nishan' ? '⏳ Baqi nishan' : filter === 'check' ? '🔍 Check wale' : filter === 'hidden' ? 'Band items' : filter === 'hday' && hDay ? '🕘 ' + hDayLabel(hDay) : '';
  const fN = (hDay ? 1 : 0) + (sort !== 'name' ? 1 : 0) + (extra ? 1 : 0);
  return `${countBanner()}<div class="stock-head sk">
    <div class="sk-top">
      <div class="sk-hrow"><div><small>${esc(branchName(pick, names))}${autoOn ? ' · 📅 aaj ki ginti' : round ? ' · ginti ' + esc(round) : ''}</small><strong>Stock <em>${num(shownCount)} items</em></strong></div>
        ${isOwner() ? '<button type="button" class="sk-ico" data-sk-set="1" aria-label="Settings">⚙️</button>' : ''}</div>
      <div class="sk-srow"><label class="sk-sbox"><span>🔍</span><input type="search" data-sk-q="1" placeholder="Naam ya barcode…" value="${esc(q)}" autocomplete="off"></label>
        <button type="button" class="sk-ico go" data-stock-scan="1" aria-label="Scan">${camMissing() ? '🔫' : '📷'}</button><button type="button" class="sk-ico" data-stock-mic="1" aria-label="Awaz">🎤</button></div>
      ${gd}
    </div>
    <div class="sk-body">
      <small class="sk-meta">${seeStock() ? 'kul ' + num(totalPcs) + ' pcs' : num(shownCount) + ' items'}${stamp ? ' · aakhri tabdeeli ' + esc(since(stamp)) : ''}</small>${liveChip()}
      ${scanList.length ? `<div class="sk-scan"><button type="button" class="sh-wide sh-scan" data-stock-scan="1">${camIco()} Aur scan karein (${num(scanList.length)} list mein)</button><button type="button" class="sh-wide sh-clear" data-stock-clear="1">✕ Saaf karein — wapas poori list</button></div>` : ''}
      ${can('stock.count') || isOwner() ? gintiBig(pick, items) : ''}
      ${tiles.length ? `<div class="sk-tiles">${tiles.join('')}</div>` : ''}
      ${ijPend().length || ijBad().length ? `<button type="button" class="sk-pend${ijBad().length && !ijPend().length ? ' bad' : ''}" data-stock-ijobs="1">${ijPend().length ? '⏳ ' + num(ijPend().length) + ' item PC baqi' : ''}${ijPend().length && ijBad().length ? ' · ' : ''}${ijBad().length ? '❌ ' + num(ijBad().length) + ' nahi bana' : ''} — dekhein</button>` : ''}
      ${postLine(pick)}
      <div class="sk-chips"><button type="button" class="sk-chip${filter === 'all' ? ' on' : ''}" data-stock-filter="all">Sab ${num(live.length)}</button>${seeStock() ? `<button type="button" class="sk-chip${filter === 'has' ? ' on' : ''}" data-stock-filter="has">${pick !== 1 ? '📦 Is godam ka' : 'Stock'} ${num(hasN)}</button><button type="button" class="sk-chip${filter === 'minus' ? ' on' : ''}" data-stock-filter="minus">Minus ${num(minus)}</button>` : ''}${extra ? `<button type="button" class="sk-chip x" data-stock-filter="all">${esc(extra)} ✕</button>` : ''}<button type="button" class="sk-chip f" data-sk-filter="1">☰ Filter${fN ? ' <i>' + fN + '</i>' : ''}</button></div>
      ${($('search')?.value || '').trim() ? '<button type="button" class="sk-clear" data-stock-clear="1">✕ Search saaf karein</button>' : ''}
    </div>
  </div>`;
}
// 📋 ginti ka bara button (auto: aaj ki ginti · farq · POS mein kitne)
function gintiBig(pick, items) {
  const C = items.map(r => ({ r, c: countOf(pick, r) })).filter(x => x.c);
  let net = 0, w = 0; for (const { r, c } of C) { const f = countedPcs(c) - Number(sysOf(c, r)); net += r.prate ? f * r.prate : 0; const bi = billOf(r, c, pick); if (bi.k === 'baqi' || bi.k === 'part') w++; }
  const billed = postReq && postReq.round === round && postReq.branch === pick && postReq.status === 'done';
  if (!round) return `<button type="button" class="sk-big warn" data-stock-ginti="1"><span class="bi">📋</span><span><b>Ginti abhi shuru nahi</b><small>${isOwner() ? 'tap karein — nayi ginti shuru / khud POS mein' : 'malik shuru kare'}</small></span><em>›</em></button>`;
  const t = autoOn ? 'Aaj ki ginti' : 'Ginti ' + round.slice(5, 10).replace('-', '/');
  const busyP = postReq && postReq.round === round && postReq.branch === pick && ['pending', 'approved', 'posting', 'preview'].includes(postReq.status);
  return `<button type="button" class="sk-big" data-stock-ginti="1"><span class="bi">📋</span><span><b>${esc(t)} · ${num(C.length)} items</b><small>${seeStock() ? `Farq Rs ${net > 0 ? '+' : ''}${num(Math.round(net))} · ` : ''}${busyP ? '⏳ PC bill bana raha' : w ? num(w) + ' ka bill baqi' + (isOwner() ? ' — tap' : '') : C.length ? (billed ? 'bill ban gaya ✓' : 'sab bill mein ✓') : 'abhi kuch nahi gina'}</small></span><em>›</em></button>`;
}
// ☰ filter sheet: baqi filter / check / band · kis din ki history · tarteeb
function openSkFilter() {
  const d = $('dialog'); if (!d) return;
  const { pick, items } = collect();
  const done = items.filter(r => countOf(pick, r)).length, gap = items.filter(r => { const c = countOf(pick, r); return c && Math.abs(countedPcs(c) - Number(sysOf(c, r))) > 0.001; }).length;
  const nishanN = items.filter(r => flagOf(r.id).baqi).length, checkN = items.filter(r => flagOf(r.id).check).length, hiddenN = items.filter(isHidden).length;
  const row = (k, t, sub, n) => `<button type="button" class="sk-li${filter === k ? ' on' : ''}" data-stock-filter="${k}"><span class="t"><b>${t}</b><span>${sub}</span></span><b>${num(n)}</b></button>`;
  d.classList.remove('search-dialog'); d.classList.add('full-dialog'); $('dialogTitle').textContent = '☰ Kya dikhayein?';
  $('dialogBody').innerHTML = `<div class="sk-sheet" id="skFilter">
    <div class="sk-list">${row('baqi', 'Ginti baqi', 'Is ginti mein abhi nahi gine', items.length - done)}${gap && seeStock() ? row('farq', '⚖️ Farq wale', 'Gine magar system se kam / zyada', gap) : ''}${row('nishan', '⏳ Baqi nishan', 'Larke ne "aur ginna hai" lagaya', nishanN)}${checkN ? row('check', '🔍 Check wale', 'Dobara check karne ka nishan', checkN) : ''}${hiddenN ? row('hidden', 'Band items', 'POS mein inactive', hiddenN) : ''}</div>
    <div class="sk-lab">🕘 Kis din ki ginti / tick?</div>
    <div class="sk-seg c4"><button type="button" class="${!hDay ? 'on' : ''}" data-stock-hday="">Sab</button>${['aaj', 'kal', '7'].map(k => `<button type="button" class="${hDay === k ? 'on' : ''}" data-stock-hday="${k}">${hDayLabel(k)} (${num(hCount(k))})</button>`).join('')}</div>
    <label class="sk-date${/^\d{4}-/.test(hDay) ? ' on' : ''}">📅 ${/^\d{4}-/.test(hDay) ? esc(hDayLabel(hDay)) + ' (' + num(hCount(hDay)) + ')' : 'Koi tareekh chunein'}<input type="date" data-stock-hdate="1" value="${/^\d{4}-/.test(hDay) ? esc(hDay) : ''}" max="${dayStr()}"></label>
    ${hDay ? `<button type="button" class="sk-li on" data-stock-filter="hday"><span class="t"><b>🕘 ${esc(hDayLabel(hDay))} mein gine</b><span>sirf wo items jo us din gine / tick hue</span></span><b>${num(hCount(hDay))}</b></button>` : ''}
    <div class="sk-lab">Tarteeb</div>
    <div class="sk-seg c2"><button type="button" class="${sort === 'name' ? 'on' : ''}" data-stock-sort="name">Naam se</button><button type="button" class="${sort === 'stock' ? 'on' : ''}" data-stock-sort="stock">Zyada stock pehle</button></div>
    <div class="sk-two"><button type="button" class="sk-btn" data-sk-reset="1">Sab saaf</button><button type="button" class="sk-btn p" data-sk-close="1">Dikhao</button></div></div>`;
  if (!d.open) d.showModal();
}
// ⚙️ malik: switches · counting · ginti khud POS mein · purana bill flow · maaliyat
function openSkSet() {
  const d = $('dialog'); if (!d || !isOwner()) return;
  const { branches, names, pick } = collect();
  d.classList.remove('search-dialog'); d.classList.add('full-dialog'); $('dialogTitle').textContent = '⚙️ Stock settings (malik)';
  $('dialogBody').innerHTML = `<div class="sk-sheet" id="skSet">
    <div class="sk-list">
      <label class="sk-li"><span class="t"><b>🟢 Counting ON</b><span>Band ho to mulazim ginti save nahi kar sakta (sirf ⏳ nishan)</span></span><input type="checkbox" data-sk-lock="1"${countOff ? '' : ' checked'}></label>
      <label class="sk-li"><span class="t"><b>📅 Ginti ka session = din (khud shuru)</b><span>"Nayi ginti shuru" nahi dabana parta — roz nayi ginti khud. Bill aap "Aaj ki ginti" mein items chun kar banayein.</span></span><input type="checkbox" data-sk-auto="1"${autoOn ? ' checked' : ''}></label>
      <label class="sk-li"><span class="t"><b>➕ Mulazim NAYA item bana sake</b></span><input type="checkbox" data-stock-itemnew="1"${itemCfg.itemNew || itemCfg.itemEdit ? ' checked' : ''}${itemCfg.itemEdit ? ' disabled' : ''}></label>
      <label class="sk-li"><span class="t"><b>✏️ Mulazim purane item ka rate / naam badle</b></span><input type="checkbox" data-stock-itemedit="1"${itemCfg.itemEdit ? ' checked' : ''}></label>
    </div>
    ${autoOn ? '' : `<div class="sk-list"><button type="button" class="sk-li" data-stock-round="new"><span class="t"><b>📋 Nayi ginti shuru (haath se)</b><span>${round ? 'Abhi: ' + esc(round) : 'Abhi koi ginti nahi'}</span></span><em>›</em></button></div>`}
    <div class="sk-list">${bills.length ? `<button type="button" class="sk-li" data-stock-bills="1"><span class="t"><b>📋 Farq bills ki history</b><span>${num(bills.length)} bill</span></span><em>›</em></button>` : ''}<button type="button" class="sk-li" data-stock-ginti="1"><span class="t"><b>📊 Ginti dekhein</b><span>aaj ki ginti · PDF</span></span><em>›</em></button></div>
    ${valueCardHTML(branches, names)}
    <p class="sk-note">Mulazim ko ⚙️ nazar nahi aata.</p></div>`;
  if (!d.open) d.showModal();
}

// ---------- v1.66: BARCODE LABEL — item ke saare barcode, har ek ki tadad; PC ka TSC printer chhapta hai ----------
function labelRows(r) {
  const q = new Map((Array.isArray(r.bq) ? r.bq : []).map(x => [String(x.b || '').trim(), Number(x.q) || 1]));
  // v1.68: POS mein sub-barcode ka "Show" ✓ (sync-stock v8 -> r.bs) — sirf asal code + Show wale. bs na ho (purani sync) to sab.
  const pr = Number(r.rate2) || Number(r.rate) || 0;   // khula piece rate (POS "Peice Rate")
  const main = String(r.code || '').trim();
  const out = main ? [{ code: main, qty: 1, main: true, show: true }] : [];
  const seen = new Set(out.map(x => x.code));
  const sbList = subOverride(r);   // v1.70: sync-stock v9 ka sb (id ke saath) + app ki taaza tabdeeli
  if (sbList) {
    for (const x of sbList) { const c = String(x.b || '').trim(); if (!c || seen.has(c)) continue; seen.add(c); out.push({ code: c, qty: Number(x.q) || 1, subId: x.id, show: x.s !== false, rate: Number(x.r) || 0 }); }
  } else {
    const subs = Array.isArray(r.bs) ? r.bs.map(b => String(b).trim()) : (Array.isArray(r.bc) ? r.bc.map(b => String(b).trim()) : []);
    for (const c of subs) { if (!c || seen.has(c)) continue; seen.add(c); out.push({ code: c, qty: q.get(c) || 1, show: true }); }
  }
  return out.map(x => ({ ...x, price: x.rate > 0 ? x.rate : Math.round(x.qty * pr * 100) / 100 }));
}
// v1.70: app se banaya / badla / hataya barcode — sync-stock (2 min) se pehle bhi khirki mein sahi dikhe
const subPatch = new Map();   // itemId -> [{id,b,q,r,s}]
function subOverride(r) {
  const k = String(r.id);
  if (subPatch.has(k) && Date.now() - subPatch.get(k).at > 5 * 60000) subPatch.delete(k);   // 5 min baad sync-stock ka data hi sahi hai
  if (subPatch.has(k)) return subPatch.get(k).list;
  return Array.isArray(r.sb) ? r.sb : null;
}
function applySub(r, op, x) {
  const k = String(r.id);
  const list = (subOverride(r) || []).map(y => ({ ...y }));
  if (op === 'delete') subPatch.set(k, { at: Date.now(), list: list.filter(y => Number(y.id) !== Number(x.subId)) });
  else if (op === 'edit') subPatch.set(k, { at: Date.now(), list: list.map(y => Number(y.id) === Number(x.subId) ? { ...y, b: x.code, q: x.qty, r: x.rate, s: x.show } : y) });
  else subPatch.set(k, { at: Date.now(), list: [...list, { id: x.subId, b: x.code, q: x.qty, r: x.rate, s: x.show }] });
}
// ---------- v2.5: ITEM — naam, barcode, 1 CTN = PCS, khareed + parchoon / wholesale rates ----------
const itemDraft = new Map();
const ctnR = (p, pk) => { const x = (Number(p) || 0) * pk, n = Math.round(x); return Math.abs(x - n) <= 0.005 * pk + 1e-6 ? n : r2(x); };   // v2.98.7
function itemForm(r, pre, jobId) {   // v2.99.92: jobId = ⏳ PC baqi item ka edit
  const d = $('dialog'); if (!d) return;
  const isNew = !r;
  // v2.98.7: POS fi PIECE rakhta hai — CTN = fi piece × pack (POS ki 2-decimal gol-mol hata kar: 534.38 × 16 = 8550.08 -> 8550).
  //   W PCS = ws (SaleRateSize, sync-stock sirf farq par bhejti) warna wrate; W CTN = wrate (SaleRate3) × pack — dono alag
  const pk1 = Number(r?.pack) > 1 ? Number(r.pack) : 0;
  const v = { name: r?.name || '', code: r?.code || '', pack: Number(r?.pack) || 0,
    costP: Number(r?.prate) || 0, rpcs: Number(r?.rate2) || Number(r?.rate) || 0,
    rctn: (pk1 ? ctnR(Number(r?.rate) || 0, pk1) : 0) || 0,
    wpcs: Number(r?.ws) || Number(r?.wrate) || 0, wctn: (pk1 ? ctnR(Number(r?.wrate) || 0, pk1) : 0) || 0, costC: 0, ...(pre || {}) };
  const pk0 = Number(v.pack) > 0 ? Number(v.pack) : 1;
  if (!v.costC) v.costC = pk0 > 1 ? ctnR(v.costP, pk0) : r2(v.costP);
  if (Number(v.pack) > 1) { if (!v.rctn) v.rctn = r2(v.rpcs * v.pack); if (!v.wctn) v.wctn = r2(v.wpcs * v.pack); }
  const rates = isNew ? canNewItem() : canEditItem();
  d.classList.remove('search-dialog');
  $('dialogTitle').textContent = isNew ? '➕ Naya item' : '✏️ ' + r.name;
  const f = (lab, k) => `<label class="it-f"><span>${lab}</span><input type="number" min="0" step="any" inputmode="decimal" name="${k}" value="${v[k] ? r2(v[k]) : ''}" placeholder="0"${rates ? '' : ' disabled'}></label>`;
  const subs = r ? labelRows(r).filter(x => !x.main) : [];
  if (jobId) $('dialogTitle').textContent = '✏️ PC baqi item';
  $('dialogBody').innerHTML = `<form class="item-form" data-item-form="${r ? esc(r.id) : 'new'}"${jobId ? ` data-job-id="${esc(jobId)}"` : ''}>
    <label class="it-wide"><span>Item ka naam</span><input name="name" required maxlength="150" autocomplete="off" value="${esc(v.name)}" placeholder="misal: marhaba honey 80gm"></label>
    <label class="it-wide"><span>Barcode</span><div class="it-code"><input name="code" maxlength="50" autocomplete="off" value="${esc(v.code)}" placeholder="${isNew ? 'Khali chhorein to POS khud banayega' : ''}"><button type="button" data-item-scan="1">📷</button></div></label>
    ${isNew && !jobId ? '<div class="it-dup" data-it-dup="1"></div>' : ''}
    <label class="it-wide"><span>1 CTN = kitne PCS</span><input type="number" min="0" step="any" inputmode="decimal" name="pack" value="${v.pack || ''}" placeholder="misal: 12"></label>
    <div class="it-head">Khareed</div>
    <div class="it-grid">${f('Kh / CTN', 'costC')}${f('Kh / PCS', 'costP')}</div>
    <div class="it-note">Kh / CTN likhein — Kh / PCS khud nikal aayega</div>
    <div class="it-head">Parchoon</div>
    <div class="it-grid">${f('R / CTN', 'rctn')}${f('R / PCS', 'rpcs')}</div>
    <div class="it-head">Wholesale</div>
    <div class="it-grid">${f('W / CTN', 'wctn')}${f('W / PCS', 'wpcs')}</div>
    ${rates ? '' : '<p class="muted it-lock">🔒 Rates sirf malik badal sakta hai</p>'}
    ${r ? `<div class="it-head">Sub-barcode (${subs.length})</div>
      <div class="it-subs">${subs.map(x => `<div class="it-sub${x.show === false ? ' off' : ''}"><div><b>${esc(x.code)}</b><small>${x.qty !== 1 ? 'Tadad ' + num(x.qty) + ' · ' : ''}Rs ${num(x.price)}${x.show === false ? ' · Show off' : ''}</small></div>
        <button type="button" data-sub-edit="${x.subId}" data-sub-item="${esc(r.id)}" aria-label="Badlein">✏️</button>
        <button type="button" class="danger" data-sub-del="${x.subId}" data-sub-item="${esc(r.id)}" aria-label="Hatao">🗑️</button></div>`).join('') || '<p class="muted">Koi sub-barcode nahi</p>'}</div>
      <div class="account-tools"><button type="button" data-sub-new="${esc(r.id)}">➕ Naya barcode</button></div>` : ''}
    ${isNew && isOwner() && typeof window.ntFacPend === 'function' ? `<label class="it-fac"><input type="checkbox" name="fac"${(jobId && window.ntFacPendHas?.(jobId)) || v._fac ? ' checked' : ''}> 🏭 Factory item (factory list mein bhi)</label><label class="it-fac"><input type="checkbox" name="pk"${(jobId && window.ntFacPendPack?.(jobId)) || v._pack ? ' checked' : ''}> 📦 Packing material (bag / pouch / dakan — factory packing mein)</label>` : ''}
    <div class="account-tools it-acts"><button type="submit" class="primary">${isNew ? '➕ POS mein banao' : '💾 POS mein save'}</button><button type="button" data-item-close="1">Wapas</button></div>
    <p class="muted it-msg" role="status"></p></form>`;
  if (!d.open) d.showModal();
  setTimeout(() => $('dialogBody').querySelector('input[name=name]')?.focus(), 50);
  if (isNew && !jobId && (v.name || v.code)) dupPaint($('dialogBody').querySelector('form[data-item-form]'));   // v2.101.6
}
// v2.101.6: 🔁 DOHRA ROKNA (malik: "pehle se item ho to do baar add ho jayegi") — naya item likhte waqt POS mein wahi barcode / wahi naam /
//   milti julti items + ⏳ PC baqi line mein wahi naam. "Yahi chunein" = factory form se aaye to wahi item factory mein (window.ntFacAdd),
//   warna us item ka edit form. Save par wahi naam / barcode = poochta hai (phir bhi naya?).
function dupFind(name, code) {
  const P = agPool(), out = [], seen = new Set(), add = (r, why) => { const id = String(r.id); if (seen.has(id)) return; seen.add(id); out.push({ r, why }); };
  const c = String(code || '').trim(); if (c) for (const r of P.list) if (String(r.code || '') === c) add(r, 'code');
  const fn = fold(name);
  if (fn.length >= 3) { for (const r of P.list) if (fold(r.name) === fn) add(r, 'same'); try { for (const r of smartSearch(P.list, String(name), 4)) if (r && r.id != null && P.byId.has(String(r.id))) add(P.byId.get(String(r.id)), 'like'); } catch {} }
  const pend = fn ? ijobs.filter(j => j.op === 'new' && (j.status === 'new' || j.status === 'working') && fold(j.name) === fn) : [];
  return { list: out.slice(0, 4), hard: out.filter(x => x.why !== 'like'), pend };
}
function dupPaint(form) {
  const box = form?.querySelector('[data-it-dup]'); if (!box) return;
  const v = itemRead(form), { list, hard, pend } = dupFind(v.name, v.code), P = agPool();
  if (!list.length && !pend.length) { box.innerHTML = ''; return; }
  const st = r => { try { return num(Number(saleStockItem(P.main, r.id)?.stock) || 0); } catch { return '—'; } };
  box.innerHTML = `<div class="it-dupbox${hard.length || pend.length ? ' hard' : ''}"><b>${hard.length || pend.length ? '⚠️ Yeh item pehle se hai — naya mat banayein' : '🔎 Milti julti items pehle se hain'}</b>
    ${list.map(({ r, why }) => `<div class="it-duprow"><span><b>${esc(r.name)}</b><small>${r.code ? '🏷 ' + esc(r.code) + ' · ' : ''}stock ${st(r)}${why === 'code' ? ' · <i>wahi barcode</i>' : why === 'same' ? ' · <i>wahi naam</i>' : ''}</small></span><button type="button" data-dup-pick="${esc(String(r.id))}">Yahi chunein</button></div>`).join('')}
    ${pend.map(j => `<div class="it-duprow"><span><b>${esc(j.name)}</b><small>⏳ PC baqi — pehle se line mein (POS mein ban raha)</small></span></div>`).join('')}</div>`;
}
let dupT = 0;
document.addEventListener('input', e => { const f = e.target?.closest?.('form[data-item-form="new"]'); if (!f || !/^(name|code)$/.test(e.target.name || '')) return; clearTimeout(dupT); dupT = setTimeout(() => dupPaint(f), 250); });
document.addEventListener('click', async e => {
  const b = e.target.closest?.('[data-dup-pick]'); if (!b) return; const f = b.closest('form'), id = b.dataset.dupPick, r = agPool().byId.get(String(id));
  const fac = !!f?.elements?.fac?.checked, pkg = !!f?.elements?.pk?.checked;
  if ((fac || pkg) && typeof window.ntFacAdd === 'function') { const ok = await window.ntFacAdd(id, pkg); if (ok) { notice('✓ ' + (r?.name || 'Item') + (pkg ? ' packing maal mein' : ' factory mein') + ' jur gayi — naya nahi bana'); $('dialog')?.close(); } return; }
  stockItemOpen(id);
});
function itemRead(form) {
  const g = k => form.querySelector('[name=' + k + ']');
  const nv = k => { const e = g(k); return e && !e.disabled ? Math.max(0, Number(e.value) || 0) : null; };
  return { name: String(g('name').value || '').trim(), code: String(g('code').value || '').trim(),
    pack: Math.max(0, Number(g('pack').value) || 0), costC: nv('costC'), costP: nv('costP'), rctn: nv('rctn'), rpcs: nv('rpcs'), wctn: nv('wctn'), wpcs: nv('wpcs') };
}
async function itemSave(form, btn) {
  const id = form.dataset.itemForm, isNew = id === 'new';
  const r = isNew ? null : rowCache.get(String(id));
  const v = itemRead(form), msg = form.querySelector('.it-msg');
  const pk = (Number(v.pack) > 0 ? Number(v.pack) : 1);
  if (!(v.costP > 0) && v.costC > 0) v.costP = r2(v.costC / pk);        // v2.5.1: sirf CTN likha to PCS khud
  if (pk > 1 && v.costC > 0 && v.costP > 0 && Math.abs(v.costP * pk - v.costC) <= 0.005 * pk + 1e-6) v.costP = Math.round(v.costC / pk * 10000) / 10000;   // v2.98.7: POS ka CTN bilkul wohi (8450 ÷ 16 = 528.125)
  if (!v.name) { msg.textContent = 'Item ka naam likhein'; return; }
  if (!cloud?.requestItem) { msg.textContent = 'Item ke liye app update karein'; return; }
  if (isNew && !form.dataset.jobId) { const D = dupFind(v.name, v.code), h = D.hard[0];   // v2.101.6: dohra
    if ((h || D.pend.length) && !confirm(`"${h ? h.r.name : D.pend[0].name}" ${h ? 'POS mein pehle se hai' + (h.why === 'code' ? ' (wahi barcode)' : ' (wahi naam)') : 'pehle se line mein hai (⏳ PC baqi)'}.\n\nPhir bhi NAYA item banana hai? (Cancel = nahi — "Yahi chunein" se purana lein)`)) { dupPaint(form); return; } }
  const keep = k => (v[k] == null ? (k === 'costP' ? Number(r?.prate) || 0 : k === 'rpcs' ? Number(r?.rate2) || Number(r?.rate) || 0 : k === 'wpcs' ? Number(r?.ws) || Number(r?.wrate) || 0 : 0) : v[k]);   // v2.98.7: W PCS = ws
  const job = { op: isNew ? 'new' : 'edit', itemId: isNew ? '' : String(r.id), code: v.code, name: v.name, pack: v.pack,
    costP: keep('costP'), rctn: keep('rctn'), rpcs: keep('rpcs'), wctn: keep('wctn'), wpcs: keep('wpcs') };
  if (!isNew) job.subs = labelRows(r).filter(x => !x.main).map(x => ({ b: x.code, q: x.qty, r: x.rate || 0, s: x.show !== false }));
  if (form.dataset.jobId) {   // v2.99.92: ⏳ PC baqi item badalna — wahi darkhwast (naya item nahi)
    const jid = form.dataset.jobId, cur = ijobs.find(j => j.id === jid);
    if (!cur || cur.status !== 'new') { msg.textContent = '⚙️ PC bana raha hai / ho gaya — ab yahan se nahi badal sakta'; return; }
    if (!cloud?.editItemJob) { msg.textContent = 'App update karein'; return; }
    btn.disabled = true;
    try { await cloud.editItemJob(jid, job);
      if (form.elements.fac?.checked || form.elements.pk?.checked) window.ntFacPend?.(jid, v.name, job.costP, !!form.elements.pk?.checked); else window.ntFacPendDel?.(jid);
      notice('✓ Badal diya — PC on hote hi yahi banega'); $('dialog')?.close(); }
    catch (e) { btn.disabled = false; msg.textContent = 'Nahi hua: ' + (e?.code === 'permission-denied' ? 'ijazat nahi (rules 2.54? ya PC ne utha liya)' : (e?.message || e)); }
    return;
  }
  btn.disabled = true; const old = btn.textContent; btn.textContent = '⏳ PC ko bhej raha hoon…';
  try {
    const jid = await cloud.requestItem(job);
    if (isNew && (form.elements.fac?.checked || form.elements.pk?.checked)) { try { window.ntFacPend?.(jid, v.name, job.costP, !!form.elements.pk?.checked); } catch {} }   // v2.99.91: 🏭 · v2.101: 📦 packing
    btn.textContent = '✓ Line mein lag gaya';
    msg.textContent = '✓ Line mein lag gaya — PC on hote hi POS mein banega (phone par khabar aayegi). Form band kar sakte hain.';
    let stop = null, done = false;
    const end = (m, ok) => { if (done) return; done = true; try { stop && stop(); } catch {}
      btn.disabled = false; btn.textContent = old; msg.textContent = m;
      if (ok) { notice(isNew ? '✓ Item POS mein ban gaya' : '✓ Item POS mein save ho gaya'); setTimeout(() => $('dialog')?.close(), 900); rerender(); } };
    stop = cloud.watchItem ? cloud.watchItem(jid, j => {
      if (!j) return;
      if (j.status === 'done') end('✓ POS mein ho gaya' + (j.code ? ' — code ' + j.code : ''), true);
      else if (j.status === 'failed') end('Nahi hua: ' + (j.error || 'nakam'), false);
    }) : null;
    setTimeout(() => end('⏳ PC abhi jawab nahi de raha (shayad band hai) — item line mein mehfooz hai, PC on hote hi banega aur phone par khabar aayegi. Stock screen par "⏳ PC baqi" mein dekh sakte hain.', false), 45000);
  } catch (e) { btn.disabled = false; btn.textContent = old; msg.textContent = 'Nahi bheja: ' + (e?.message || e); }
}
function subForm(r, edit) {
  const d = $('dialog');
  const isEdit = !!(edit && edit.subId);
  $('dialogTitle').textContent = (isEdit ? '✏️ Barcode badlein — ' : '➕ Naya barcode — ') + r.name;
  const q = edit ? edit.qty : 1, qs = [0.125, 0.25, 0.5, 1, 5];
  $('dialogBody').innerHTML = `<form class="sub-form" data-sub-form="${esc(r.id)}"${isEdit ? ` data-sub-id="${edit.subId}"` : ''}>
    <label>Barcode<div class="sub-code-row"><input name="code" required maxlength="50" autocomplete="off" value="${esc(edit?.code || '')}" placeholder="Likhein ya scan karein"><button type="button" data-sub-scan="1">📷</button></div></label>
    <label>Tadad<input name="qty" type="text" inputmode="decimal" required value="${num(q)}"></label>
    <div class="account-tools sub-qty">${qs.map(v => `<button type="button" data-sub-qty="${v}"${v === q ? ' class="selected"' : ''}>${num(v)}</button>`).join('')}</div>
    <label>Rate (khali = item rate × tadad)<input name="rate" type="text" inputmode="decimal" value="${edit && edit.rate > 0 ? num(edit.rate) : ''}" placeholder="0"></label>
    <label class="sub-show"><input type="checkbox" name="show"${!edit || edit.show ? ' checked' : ''}> Show ✓ (label mein dikhe)</label>
    <div class="account-tools"><button type="submit" class="primary">${isEdit ? '💾 Save' : '➕ POS mein banao'}</button><button type="button" data-sub-back="${esc(r.id)}">Wapas</button></div>
    <p class="muted sub-msg" style="font-size:.85em"></p></form>`;
  if (!d.open) d.showModal();
  setTimeout(() => $('dialogBody').querySelector('input[name=code]')?.focus(), 50);
}
function subDupe(r, code, skipSubId) {
  const c = String(code).trim().toLowerCase();
  for (const it of collect().items) {
    if (String(it.code || '').trim().toLowerCase() === c) return `item "${it.name}" ka asal code`;
    const sb = subOverride(it);
    if (sb) { for (const x of sb) if (String(x.b || '').trim().toLowerCase() === c && Number(x.id) !== Number(skipSubId)) return `item "${it.name}" ka sub-barcode`; }
    else if (Array.isArray(it.bc) && it.bc.some(b => String(b).trim().toLowerCase() === c) && String(it.id) !== String(r.id)) return `item "${it.name}" ka sub-barcode`;
  }
  return '';
}
async function subSend(r, op, x, msgEl, btn) {
  if (!cloud?.requestSubcode) { notice('App update karein'); return; }
  if (btn) btn.disabled = true;
  const say = t => { if (msgEl) msgEl.textContent = t; };
  say('🖥 PC ko ja raha hai…');
  try {
    const jid = await cloud.requestSubcode({ op, itemId: r.id, subId: x.subId, code: x.code, qty: x.qty, rate: x.rate, show: x.show });
    let stop = null, done = false;
    const end = (ok, t) => { if (done) return; done = true; try { stop && stop(); } catch {} if (btn) btn.disabled = false;
      if (ok) { applySub(r, op, { ...x, subId: t.subId || x.subId, code: t.code || x.code }); notice(op === 'delete' ? '✓ Barcode POS se hat gaya' : '✓ POS mein ho gaya'); openLabels(r.id); }
      else { say('⚠️ ' + t); notice('Nahi hua: ' + t); } };
    stop = cloud.watchSubcode(jid, j => { if (!j) return; if (j.status === 'done') end(true, j); else if (j.status === 'failed') end(false, j.error || 'masla'); });
    setTimeout(() => end(false, 'PC se jawab nahi aaya — PC on hai aur subcode-sync chal raha hai? (hukum mehfooz hai, PC on hote hi ho jayega)'), 45000);
  } catch (e) { if (btn) btn.disabled = false; say('⚠️ ' + (e?.message || e)); }
}
// ek barcode scan karke wapas (chhota camera, sirf is form ke liye)
async function scanOnce(input) {
  if (!navigator.mediaDevices?.getUserMedia || !(await camCheck())) { notice('🔫 Is device par camera nahi — barcode scanner gun se seedha khane mein scan karein, ya code likhein.'); try { input.focus(); } catch {} return; }
  let det;
  if ('BarcodeDetector' in window) { try { det = new BarcodeDetector(); } catch {} }
  if (!det) { try { det = await zxingDetector(); } catch { notice('Barcode library load nahi hui'); return; } }
  const box = document.createElement('div'); box.className = 'sub-scan';
  box.innerHTML = '<video playsinline muted autoplay></video><div class="scan-line"></div><button type="button" class="sub-scan-x">✕ Band</button>';
  document.body.appendChild(box);
  const v = box.querySelector('video'); let stream = null, on = true;
  const close = () => { on = false; try { stream?.getTracks().forEach(t => t.stop()); } catch {} box.remove(); };
  box.querySelector('.sub-scan-x').onclick = close;
  try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false }); v.srcObject = stream; await v.play(); }
  catch (e) { close(); notice(e?.name === 'NotFoundError' ? '🔫 Is device par camera nahi mila — scanner gun se khane mein scan karein, ya code likhein.' : 'Camera nahi khula: ' + (e?.message || e)); try { input.focus(); } catch {} return; }
  const loop = async () => {
    if (!on) return;
    if (v.readyState >= 2) { try { const f = await det.detect(v); const c = f.map(x => String(x.rawValue || '').trim()).find(Boolean); if (c) { input.value = c; beep(true); if (navigator.vibrate) navigator.vibrate(60); close(); return; } } catch {} }
    setTimeout(loop, 120);
  };
  loop();
}
document.addEventListener('click', e => {
  const t = e.target.closest?.('[data-sub-new],[data-sub-edit],[data-sub-del],[data-sub-back],[data-sub-scan],[data-sub-qty]');
  if (!t) return;
  if (t.dataset.subNew) { const r = rowCache.get(t.dataset.subNew); if (r) subForm(r, null); return; }
  if (t.dataset.subBack) { openLabels(t.dataset.subBack); return; }
  if (t.dataset.subQty) { const f = t.closest('form'); f.elements.qty.value = t.dataset.subQty; f.querySelectorAll('[data-sub-qty]').forEach(b => b.classList.toggle('selected', b === t)); return; }
  if (t.dataset.subScan) {   // v1.74: sale wala bara scanner (Focus/Zoom/Camera/Light); dialog band karke, code milte hi form dobara
    const f = t.closest('form'), r = rowCache.get(f.dataset.subForm); if (!r) return;
    const st = { subId: Number(f.dataset.subId) || 0, code: f.elements.code.value, qty: Number(String(f.elements.qty.value).replace(',', '.')) || 1, rate: Number(f.elements.rate.value) || 0, show: f.elements.show.checked };
    try { $('dialog').close(); } catch {}
    scanPick(code => { subForm(r, { ...st, code }); });
    return;
  }
  if (t.dataset.subEdit) { const r = rowCache.get(t.dataset.subItem), x = r && labelRows(r).find(y => String(y.subId) === t.dataset.subEdit); if (x) subForm(r, x); return; }
  if (t.dataset.subDel) { const r = rowCache.get(t.dataset.subItem), x = r && labelRows(r).find(y => String(y.subId) === t.dataset.subDel);
    if (!x) return; if (!confirm(`"${x.code}" (${r.name}) POS se hata dein?`)) return; subSend(r, 'delete', x, t.closest('.label-row')?.querySelector('small'), t); return; }
});
// v2.5.1: Kh / CTN likhein -> Kh / PCS khud (÷ pack). Kh / PCS likhein to Kh / CTN khud (× pack).
// Parchoon aur Wholesale ko app HAATH NAHI lagati — wo aap ke apne likhe hue rehte hain.
document.addEventListener('input', e => {
  const t = e.target, f = t?.closest?.('[data-item-form]'); if (!f) return;
  const k = t.name; if (!['pack', 'costC', 'costP'].includes(k)) return;
  const g = n => f.querySelector('[name=' + n + ']');
  const pk = Math.max(0, Number(g('pack').value) || 0) || 1;
  const put = (n, val) => { const el = g(n); if (el && document.activeElement !== el && !el.disabled) el.value = val > 0 ? String(r2(val)) : ''; };   // number khane mein comma nahi
  if (k === 'costC') put('costP', (Number(t.value) || 0) / pk);
  else if (k === 'costP') put('costC', (Number(t.value) || 0) * pk);
  else { const c = Number(g('costC').value) || 0; if (c > 0) put('costP', c / pk); else put('costC', (Number(g('costP').value) || 0) * pk); }
});
document.addEventListener('submit', e => {                            // v2.5: item form
  const itf = e.target.closest?.('[data-item-form]');
  if (itf) { e.preventDefault(); itemSave(itf, itf.querySelector('button[type=submit]')); return; }
});
document.addEventListener('submit', e => {
  const f = e.target.closest?.('[data-sub-form]'); if (!f) return;
  e.preventDefault();
  const r = rowCache.get(f.dataset.subForm); if (!r) return;
  const code = String(f.elements.code.value || '').trim(), qty = Number(String(f.elements.qty.value).replace(',', '.')), rate = Number(f.elements.rate.value) || 0;
  const msg = f.querySelector('.sub-msg');
  if (!code) { msg.textContent = '⚠️ Barcode likhein'; return; }
  if (!(qty > 0)) { msg.textContent = '⚠️ Tadad 0 se zyada likhein'; return; }
  const subId = Number(f.dataset.subId) || 0;
  const dupe = subDupe(r, code, subId);
  if (dupe) { msg.textContent = `⚠️ "${code}" pehle se ${dupe} hai`; return; }
  subSend(r, subId ? 'edit' : 'add', { subId, code, qty: Math.round(qty * 1000) / 1000, rate, show: f.elements.show.checked }, msg, f.querySelector('button[type=submit]'));
});

function openLabels(id) {
  const r = rowCache.get(String(id)), d = $('dialog');
  if (!r || !d) return;
  d.classList.remove('search-dialog');
  $('dialogTitle').textContent = '🏷️ ' + r.name;
  const rows = labelRows(r);
  const pack = Number(r.pack) || 0;
  $('dialogBody').innerHTML = `<p style="margin:0 0 8px">${esc(r.code || '')} · Stock ${num(r.stock)} ${esc(r.uName || 'Pcs')}${pack > 1 ? ` · 1 ${esc(r.cName || 'Ctn')} = ${num(pack)}` : ''}
      <br>Piece rate <b>${num(Number(r.rate2) || Number(r.rate) || 0)}</b>${pack > 1 ? ` · ${esc(r.cName || 'Ctn')} rate <b>${num((Number(r.rate) || 0) * pack)}</b>` : ''}${r.wrate ? ` · Wholesale <b>${num(r.wrate)}</b>` : ''}</p>
    <div class="label-list">${rows.map((x, i) => `<div class="label-row${x.show === false ? ' off' : ''}">
      <div class="label-info"><b>${esc(x.code)}</b><small>${x.qty !== 1 ? 'Tadad ' + num(x.qty) + ' · ' : ''}Rs ${num(x.price)}${x.show === false ? ' · Show off' : ''}${x.main ? ' · asal code' : ''}</small></div>
      ${x.show === false ? '' : `<input type="number" min="1" max="1000" value="1" inputmode="numeric" data-label-copies="${i}" aria-label="Kitne label">
      <button type="button" class="primary" data-label-print="${i}" data-label-item="${esc(r.id)}">🖨️</button>`}
      ${x.subId ? `<button type="button" data-sub-edit="${x.subId}" data-sub-item="${esc(r.id)}" aria-label="Badlein">✏️</button><button type="button" class="danger" data-sub-del="${x.subId}" data-sub-item="${esc(r.id)}" aria-label="Hatao">🗑️</button>` : ''}
    </div>`).join('') || '<p>Is item ka koi barcode nahi.</p>'}</div>
    <div class="account-tools" style="margin-top:8px"><button type="button" data-sub-new="${esc(r.id)}">➕ Naya barcode</button></div>
    ${isOwner() ? `<label style="display:block;margin-top:10px">Doosre naam (search ke liye, comma se alag)<input type="text" data-alias-item="${esc(r.id)}" value="${esc(aliasOf(r.id))}" placeholder="misal: surkh mirch, lal mirch, chilli" maxlength="250"></label>` : (aliasOf(r.id) ? `<p class="muted" style="font-size:.85em">Doosre naam: ${esc(aliasOf(r.id))}</p>` : '')}
    <p class="muted" style="font-size:.85em;margin-top:8px">Label PC ke TSC printer par chhapta hai (PC par label-print chalna chahiye).</p>`;
  if (!d.open) d.showModal();
}
async function printLabel(btn) {
  const r = rowCache.get(String(btn.dataset.labelItem)); if (!r) return;
  const i = Number(btn.dataset.labelPrint), x = labelRows(r)[i]; if (!x) return;
  const inp = document.querySelector(`[data-label-copies="${i}"]`);
  const copies = Math.max(1, Math.min(1000, Math.floor(Number(inp?.value) || 1)));   // v2.95.5: 1000 tak — 200-200 ke hisson mein
  if (!cloud?.requestLabel) { notice('Label ke liye app update karein'); return; }
  const parts = []; for (let left = copies; left > 0; left -= 200) parts.push(Math.min(200, left));
  if (parts.length > 1 && !confirm(`${copies} label — ${parts.length} hisson mein chhapenge (${parts.join(' + ')}). Theek?`)) return;
  btn.disabled = true; const old = btn.textContent; btn.textContent = '⏳ Bhej rahe...';
  try {
    const jids = [];
    for (const c of parts) jids.push(await cloud.requestLabel({ itemId: r.id, code: x.code, name: r.name, qty: x.qty, rate: x.price, copies: c }));
    btn.textContent = '⏳ PC...';
    // v2.97: 🖨 live patti isi khirki mein — kitne chhape, line mein kaun, ✕ Cancel
    { const dlg = btn.closest('dialog') || document; let box = dlg.querySelector('.lv-pop'); if (!box) { box = document.createElement('div'); box.className = 'lv-pop'; (btn.closest('form,.label-box,div') || dlg.body || dlg).insertAdjacentElement('afterend', box); }
      if (cloud.listenLabelJobs && !box._un) { box._un = cloud.listenLabelJobs(Date.now() - 3 * 3600000, l => { if (!box.isConnected) { try { box._un?.(); } catch {} return; } box.innerHTML = liveLabelsHTML(l); }); } }
    const stops = []; let done = false, ok = 0;
    const end = (msg, good) => { if (done) return; done = true; stops.forEach(f => { try { f && f(); } catch {} }); btn.disabled = false; btn.textContent = good ? '✓ Chhap gaya' : old; notice(msg); setTimeout(() => { if (btn.isConnected) btn.textContent = old; }, 4000); };
    if (cloud.watchLabel) jids.forEach(jid => { let seen = false; stops.push(cloud.watchLabel(jid, j => {
      if (!j || seen) return;
      if (j.status === 'done') { seen = true; ok++; if (ok === jids.length) end(`✓ ${copies} label chhap gaye`, true); else btn.textContent = `⏳ ${ok}/${jids.length}`; }
      else if (j.status === 'failed' || j.status === 'skipped') { seen = true; end('Label nahi chhapa: ' + (j.error || j.status), false); }
      else if (j.status === 'cancelled') { seen = true; end('✕ Label cancel' + (Number(j.sent) ? ' — ~' + j.sent + ' chhapne ke baad' : ''), false); }
    })); });
    setTimeout(() => end('PC se jawab nahi aaya — PC on hai aur label-print chal raha hai? (hukum mehfooz hai, PC on hote hi chhapega)', false), 45000 * parts.length);
  } catch (e) { btn.disabled = false; btn.textContent = old; notice('Label nahi bheja: ' + (e?.message || e)); }
}

// ---------- v1.73: STOCK TRANSFER NOTE (godam se godam) — PC transfer-sync.js POS mein STN banata hai ----------
let trLines = [], trFrom = null, trTo = null, trStop = null, trList = [], trNote = '';   // v2.99.64: note re-render par na mite
function trBranches() { const { branches, names } = collect(); return branches.map(b => ({ id: b, name: branchName(b, names) })); }
function trStockOf(b, id) { return Number(saleStockItem(b, id)?.stock || 0); }
// v2.99.68: ✏️ edit mein purana note pehle hatega — us ka maal "Se" godam mein wapas aayega, is liye majood = stock + purani tadad
let trEdit = null;
function trAvail(id) { const base = trStockOf(trFrom, id); if (!trEdit || Number(trEdit.from) !== Number(trFrom)) return base; const o = (trEdit.lines || []).filter(l => String(l.itemId) === String(id)).reduce((n, l) => n + (Number(l.qty) || 0), 0); return Math.round((base + o) * 1000) / 1000; }
// ---------- v2.18: Transfer note ki SMART search ----------
// - jis godam se maal nikalna hai wahan STOCK 0 / minus wale items DIKHTE HI NAHI (chahein to ek tap se dikha lein)
// - bade chips: godam · stock (green/amber/red) · 1 Ctn = ? · code | match hue harf highlight
// - poora barcode likhte hi item khud lag jata hai aur cursor seedha tadad par
// - khali khana: "aksar bheje jane wale" (isi phone ki yaad-dasht se)
const TR_REC_KEY = 'sam-tr-recent-v1';
let trRecent = null, trFocus = null, trZeroShow = false, trFindTimer = null, trQuiet = false;
let trCopies = 1; try { trCopies = Math.min(3, Math.max(1, Number(localStorage.getItem('sam-tr-copies')) || 1)); } catch {}   // v2.43: note kitni dafa chhape
const trCopyChips = () => `<div class="sale-copies"><small>🖨 Note print</small>${[1, 2, 3].map(n => `<button type="button" data-tr-copies="${n}"${trCopies === n ? ' class="on"' : ''}>×${n}</button>`).join('')}</div>`;
document.addEventListener('click', e => { const b = e.target.closest?.('[data-tr-copies]'); if (!b) return; trCopies = Number(b.dataset.trCopies) || 1; try { localStorage.setItem('sam-tr-copies', String(trCopies)); } catch {} document.querySelectorAll('[data-tr-copies]').forEach(x => x.classList.toggle('on', Number(x.dataset.trCopies) === trCopies)); });
function trRecLoad() { if (trRecent) return trRecent; try { trRecent = JSON.parse(localStorage.getItem(TR_REC_KEY) || '[]'); } catch { trRecent = []; } if (!Array.isArray(trRecent)) trRecent = []; return trRecent; }
function trRecNote(id) { const a = trRecLoad().filter(x => String(x) !== String(id)); a.unshift(String(id)); trRecent = a.slice(0, 15); try { localStorage.setItem(TR_REC_KEY, JSON.stringify(trRecent)); } catch {} }
function trRecRank(id) { const i = trRecLoad().indexOf(String(id)); return i < 0 ? 0 : (15 - i) / 6; }   // halka sa upar, match ki jagah nahi leta
function trRecItems(items, n = 6) { const out = [];
  for (const id of trRecLoad()) { const r = items.find(x => String(x.id) === String(id)); if (r && trHas(r)) out.push(r); if (out.length >= n) break; }
  return out; }
const trHas = r => trAvail(r.id) > 0.0005;
function trStockChip(r) {
  const s = trAvail(r.id), pk = Number(r.pack) || 0;
  const cls = s <= 0.0005 ? 'red' : (pk > 1 ? (s < pk ? 'amber' : 'green') : (s < 5 ? 'amber' : 'green'));
  const ctn = pk > 1 && s >= pk ? ` · ${num(Math.floor(s / pk))} ${esc(r.cName || 'Ctn')}` : '';
  return `<span class="sh-chip ${cls}">📦 ${num(s)} ${esc(r.uName || 'Pcs')}${ctn}</span>`;
}
function trRowHTML(r, i, q, gname) {
  const pk = Number(r.pack) || 0;
  return `<button type="button" class="sh-row" data-tr-pick="${i}"><b class="sh-name">${hlName(r.name, q)}</b><span class="sh-chips"><span class="sh-chip godam">${gname}</span>${trStockChip(r)}${pk > 1 ? `<span class="sh-chip pack">1 ${esc(r.cName || 'Ctn')} = ${num(pk)}</span>` : ''}${r.code ? `<span class="sh-chip code">#${esc(r.code)}</span>` : ''}</span></button>`;
}
function trMark(hits, n) {
  const rows = [...hits.querySelectorAll('[data-tr-pick]')];
  rows.forEach((b, i) => b.classList.toggle('on', i === n));
  if (n >= 0 && rows[n]) try { rows[n].scrollIntoView({ block: 'nearest' }); } catch {}
}
function trPaint(hits, list, q, zeroN, gname) {
  hits._src = list;
  hits.innerHTML = `<p class="sh-head">🔍 ${esc(q)}<button type="button" class="sh-close" data-tr-close="1" aria-label="band">✕</button></p>` + (list.length ? list.map((r, i) => trRowHTML(r, i, q, gname)).join('') : `<p class="sh-empty">Kuch nahi mila${zeroN ? '' : ' — naam ya code dobara dekh lein'}</p>`)
    + (zeroN ? `<button type="button" class="sh-more" data-tr-zero="1">🚫 ${num(zeroN)} item mile magar ${gname} mein stock 0 — phir bhi dikhayein</button>` : '');
  trMark(hits, list.length ? 0 : -1);
  hits.hidden = false;
}
function trShowRecent(hits) {
  const { items, names } = collect(), list = trRecItems(items, 6);
  if (!list.length) { hits.hidden = true; return; }
  const gname = esc(branchName(trFrom, names));
  hits._src = list;
  hits.innerHTML = `<p class="sh-head">⏱ Aksar bheje jane wale<button type="button" class="sh-close" data-tr-close="1" aria-label="band">✕</button></p>` + list.map((r, i) => trRowHTML(r, i, '', gname)).join('');
  trMark(hits, -1);
  hits.hidden = false;
}
function trPick(r, qtyFocus) { if (!r) return; trRecNote(r.id); trFocus = { id: r.id, qty: true }; trAdd(r); }   // v2.99.65: chunte hi cursor Ctn par (5 likho = 5 Ctn) — pehle ✕ kar ke neeche jana parta tha
function saleStockItem(b, id) { const chunks = rows.filter(r => !r.meta && Array.isArray(r.items) && r.branch === Number(b)); for (const c of chunks) { const it = c.items.find(x => String(x.id) === String(id)); if (it) return it; } return null; }
// ---------- v2.6: 📥 AAYA HUA MAAL — transfer + purchase bill se aaye items, dono taraf ka stock ----------
let inDays = 1, inKind = 'all', inRows = null, inFilter = false, inPick = null, inHere = false;
// v2.103.4: 🟢 LIVE (malik: "har time live data dikhta rahe jaise jaise bill bante jayen") — khirki khuli = "ab" stock listener se khud
//   (POS ~5 sec), "pehle" pehli dafa ka andaza jama (inFrozen — sale se nahi hilta), har 1 min naye transfer / bill, tarteeb + scroll wahi.
let inOpenNow = false, inFrozen = new Map(), inLiveAt = 0, inTimer = null;
const dayAgo = n => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (n - 1)); return d.getTime(); };
const dmy = t => { const d = new Date(t); return String(d.getDate()).padStart(2, '0') + '-' + ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]; };
async function inCollect() {
  const since = dayAgo(inDays), { pick, items, names } = collect();
  const G = new Map();                       // hisse: "tr:9>1" / "bill:Bhaiya"
  const add = (key, head, l, at) => {
    const qty = Number(l.qty) || 0; if (!(qty > 0)) return;
    let g = G.get(key); if (!g) { g = { key, ...head, items: new Map(), at: 0 }; G.set(key, g); }
    g.at = Math.max(g.at, at || 0);
    const id = String(l.itemId ?? l.id); let e = g.items.get(id);
    if (!e) { e = { id, name: l.name || '', qty: 0, at: 0 }; g.items.set(id, e); }
    e.qty = r2(e.qty + qty); e.at = Math.max(e.at, at || 0); e.name = e.name || l.name;
  };
  if (inKind !== 'bill') {
    // v2.8: POS ke apne transfer (PC se) — in mein app wale bhi aa jate hain, is liye yahi asal list hai
    const seen = new Set();
    for (const j of ptLive()) {
      if (Number(j.at) < since) continue;
      if (inHere && Number(j.to) !== Number(pick)) continue;
      seen.add(String(j.transferNo || '').trim());
      for (const l of (j.lines || [])) add(`tr:${j.from}>${j.to}`, { kind: 'tr', from: Number(j.from), to: Number(j.to) }, l, j.at);
    }
    for (const j of trList) {                                 // app ke wo transfer jo abhi POS tak nahi pahunche
      if (Number(j.at) < since || j.op === 'delete' || j.status === 'failed') continue;
      if (seen.has(String(j.transferNo || '').trim())) continue;
      if (inHere && Number(j.to) !== Number(pick)) continue;
      for (const l of (j.lines || [])) add(`tr:${j.from}>${j.to}`, { kind: 'tr', from: Number(j.from), to: Number(j.to) }, l, j.at);
    }
  }
  if (inKind !== 'tr' && cloud?.appPurchasesRecent) {        // 🧾 purchase bill
    try {
      for (const b of await cloud.appPurchasesRecent(since)) {
        if (b.status === 'cancelled' || b.status === 'replaced') continue;
        const at = b.at || Date.parse(b.date) || 0, party = b.partyName || 'Bill';
        for (const l of (b.lines || [])) {
          const to = Number(l.godam ?? b.godam) || 0;
          if (inHere && to !== Number(pick)) continue;
          add(`bill:${party}>${to}`, { kind: 'bill', party, to }, l, at);
        }
      }
    } catch {}
  }
  const stockOf = (b, id) => Number(saleStockItem(b, id)?.stock || 0);
  const groups = [...G.values()].map(g => {
    const rows = [...g.items.values()].map(e => {
      const it = items.find(x => String(x.id) === e.id) || {};
      const pack = Number(it.pack) || 0, rate = Number(it.prate) || 0;
      const to = { b: g.to, ab: stockOf(g.to, e.id) };
      const fz = `${g.key}|${e.id}|${e.qty}`, f0 = inFrozen.get(fz);   // v2.103.4: pehle jama (live sale se nahi hilta)
      to.pehle = f0 ? f0.t : r2(to.ab - e.qty);                        // andaza: ab − jo aaya
      const from = g.kind === 'tr' ? { b: g.from, ab: stockOf(g.from, e.id) } : null;
      if (from) from.pehle = f0 && f0.f != null ? f0.f : r2(from.ab + e.qty);   // andaza: ab + jo gaya
      if (!f0) inFrozen.set(fz, { t: to.pehle, f: from ? from.pehle : null });
      const bad = to.ab <= 0.001 && e.qty > 0;
      const tez = !bad && e.qty > 0 && to.ab / e.qty < 0.1;
      return { ...e, gkey: g.key, pack, rate, uName: it.uName || 'Pcs', cName: it.cName || 'Ctn',
        to, from, conf: bad ? 'r' : tez ? 'y' : 'g' };
    }).sort((x, y) => (x.conf === y.conf ? y.qty * y.rate - x.qty * x.rate : x.conf === 'r' ? -1 : y.conf === 'r' ? 1 : x.conf === 'y' ? -1 : 1));
    return { ...g, rows,
      title: g.kind === 'tr' ? `${branchName(g.from, names)} → ${branchName(g.to, names)}` : `${g.party} → ${branchName(g.to, names)}`,
      red: rows.filter(r => r.conf === 'r').length };
  }).sort((a, b) => {                                                   // tarteeb: transfer pehle (godam ke number se), phir bill
    if (a.kind !== b.kind) return a.kind === 'tr' ? -1 : 1;
    if (a.kind === 'tr') return (a.from - b.from) || (a.to - b.to);
    return String(a.party).localeCompare(String(b.party));
  });
  inRows = { groups, pick, names, at: Date.now() };
  return inRows;
}
// CTN / PCS alag — 20 carton hon to PCS 0
const cp = (qty, pack) => {
  const q = Number(qty) || 0, pk = Number(pack) || 0;
  if (pk > 1) { const c = Math.floor(Math.abs(q) / pk) * (q < 0 ? -1 : 1), p = r2(q - c * pk); return { c, p }; }
  return { c: 0, p: r2(q) };
};
const cpCell = (qty, pack, tilde) => { const { c, p } = cp(qty, pack); const t = tilde ? '~' : '';
  return `<span>${c ? t + num(c) : '0'}</span><span>${p ? t + num(p) : '0'}</span>`; };
function inRowHTML(r, names) {
  const line = (lab, qty, tilde, cls) => `<div class="iv-line ${cls || ''}"><small>${lab}</small>${cpCell(qty, r.pack, tilde)}</div>`;
  return `<button type="button" class="iv-card ${r.conf}" data-in-item="${esc(r.id)}">
    <div class="iv-top"><b>${esc(r.name)}</b><small>${dmy(r.at)}</small></div>
    <div class="iv-grid">
      <div class="iv-head"><small></small><span>${esc(r.cName).toUpperCase()}</span><span>${esc(r.uName).toUpperCase()}</span></div>
      ${line(r.from ? 'Gaya' : 'Bill se', r.qty, false, 'go')}
      ${r.from ? `<div class="iv-sub">${esc(branchName(r.from.b, names))}</div>
        ${line('pehle', r.from.pehle, true)}${line('ab 🟢', r.from.ab, false, 'now')}` : ''}
      <div class="iv-sub">${esc(branchName(r.to.b, names))}</div>
      ${line('pehle', r.to.pehle, true)}${line('ab 🟢', r.to.ab, false, 'now')}
    </div>
    ${r.conf === 'r' ? '<div class="iv-warn">⚠ Stock mein nahi — POS mein chadha?</div>'
      : r.conf === 'y' ? '<div class="iv-warn amber">Qareeb qareeb khatam</div>' : ''}</button>`;
}
function inLive() {   // sirf "ab" + rang dobara (tarteeb / pehle wahi)
  if (!inOpenNow || !inRows || !$('dialog')?.open || !/Aaya \/ gaya/.test($('dialogTitle')?.textContent || '')) return;   // doosri khirki (item tafseel) par na likhe
  const stockOf = (b, id) => Number(saleStockItem(b, id)?.stock || 0); let ch = false;
  for (const g of inRows.groups) { for (const r of g.rows) {
    const ab = stockOf(r.to.b, r.id); if (ab !== r.to.ab) { r.to.ab = ab; ch = true; }
    if (r.from) { const fa = stockOf(r.from.b, r.id); if (fa !== r.from.ab) { r.from.ab = fa; ch = true; } }
    const bad = r.to.ab <= 0.001 && r.qty > 0, tez = !bad && r.qty > 0 && r.to.ab / r.qty < 0.1; r.conf = bad ? 'r' : tez ? 'y' : 'g'; }
    g.red = g.rows.filter(r => r.conf === 'r').length; }
  inLiveAt = Date.now(); if (ch) openIn(false, true); else { const n = document.getElementById('ivLive'); if (n) n.textContent = '🟢 Live · ' + new Date(inLiveAt).toLocaleTimeString('en-PK'); }
}
async function openIn(refresh = true, keepScroll = false) {
  const sc = keepScroll ? ($('dialogBody')?.scrollTop || 0) : 0, scD = keepScroll ? ($('dialog')?.scrollTop || 0) : 0;
  const d = $('dialog'); if (!d) return;
  d.classList.remove('search-dialog'); d.classList.add('full-dialog');
  $('dialogTitle').textContent = '📥 Aaya / gaya maal';
  if (refresh || !inRows) { if (!keepScroll) $('dialogBody').innerHTML = '<p class="stat-note">Taza data le raha hoon…</p>'; if (!d.open) d.showModal(); await inCollect(); inLiveAt = Date.now(); }
  if (!inOpenNow) { inOpenNow = true; clearInterval(inTimer); inTimer = setInterval(() => { if (!inOpenNow || !$('dialog')?.open || !/Aaya \/ gaya/.test($('dialogTitle')?.textContent || '')) { inOpenNow = false; inFrozen.clear(); clearInterval(inTimer); return; } openIn(true, true); }, 60000);
    d.addEventListener('close', () => { inOpenNow = false; inFrozen.clear(); clearInterval(inTimer); }, { once: true }); }
  const { groups, pick, names, at } = inRows;
  const show = groups.map(g => ({ ...g, rows: inFilter ? g.rows.filter(r => r.conf !== 'g') : g.rows })).filter(g => g.rows.length);
  const nItems = groups.reduce((n, g) => n + g.rows.length, 0), red = groups.reduce((n, g) => n + g.red, 0);
  const C = (on, k, v, lab) => `<button type="button" class="${on ? 'on' : ''}" data-in-${k}="${v}">${lab}</button>`;
  $('dialogBody').innerHTML = `<div class="iv-chips">
      ${C(inDays === 1, 'd', 1, 'Aaj')}${C(inDays === 3, 'd', 3, '3 din')}${C(inDays === 7, 'd', 7, '7 din')}
    </div><div class="iv-chips">
      ${C(inKind === 'all', 'k', 'all', 'Sab')}${C(inKind === 'tr', 'k', 'tr', '⇄ Transfer')}${C(inKind === 'bill', 'k', 'bill', '🧾 Bill')}
      ${C(inHere, 'here', '1', '📍 Sirf yahan')}${red ? C(inFilter, 'red', '1', `🔴 ${red}`) : ''}
    </div>
    <p class="iv-note">${esc(branchName(pick, names))} · ${num(nItems)} items · <b id="ivLive" class="iv-live">🟢 Live · ${new Date(inLiveAt || at).toLocaleTimeString('en-PK')}</b> <small>bill bante hi "ab" khud badle</small></p>
    ${show.map(g => `<div class="iv-group">
      <div class="iv-gh ${g.kind}"><span>${g.kind === 'tr' ? '⇄' : '🧾'}</span><b>${esc(g.title)}</b><small>${g.rows.length}</small></div>
      ${g.rows.map(r => inRowHTML(r, names)).join('')}
    </div>`).join('') || '<p class="muted">Is arse mein kuch nahi aaya / gaya.</p>'}
    <div class="account-tools iv-acts">
      ${nItems ? `<button type="button" class="sh-wide" data-in-count="1">📋 Poori list ginti mein kholein (${nItems})</button>` : ''}
      <button type="button" class="primary" data-in-pdf="1">⇩ PDF</button><button type="button" data-in-close="1">✕ Band</button></div>`;
  if (!d.open) d.showModal();
  if (keepScroll) { const b = $('dialogBody'); if (b) b.scrollTop = sc; if (d) d.scrollTop = scD; }
}
// ---------- v2.35: 📋 TRANSFER REGISTER — har transfer note, waqt ke sath (POS + app), din-wise jor ----------
let regDays = 1, regGodam = 'all', regQ = '', regOpen = new Set(), regPdfOf = null;
export function setRegPdf(fn) { regPdfOf = fn; }
const regClock = ms => { try { return new Date(ms).toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit' }); } catch { return ''; } };
const regDay = ms => { const d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
// ---------- v2.99.18: ⚖️ CARTON GINTI — chhote carton (Sufi oil, Dalda…) register mein "4 carton = 1" gine jayein ----------
// Data: blueAccess/stockConfig.ctnGinti = { itemId: { r: 4, n: 'NAAM' } } (sirf malik likhe — rules ka generic owner rule; mulazim sirf parhe).
// Sirf Transfer register ki ginti (note ka total, din ka total, upar ke dabbe, PDF). POS / stock / labels kuch nahi badalta.
let regView = 'list', ctnQ = '', ctnPick = new Set(), ctnRatio = 4, ctnLine = '', ctnBusy = false, ctnNames = {};
const ctnMap = () => (itemCfg && itemCfg.ctnGinti && typeof itemCfg.ctnGinti === 'object') ? itemCfg.ctnGinti : {};
const ctnNameKey = n => fold(String(n || '')).replace(/\s+/g, ' ').trim();
function ctnOf(id, name) {
  const m = ctnMap(), v = id != null ? m[String(id)] : null;
  let r = Number(v?.r ?? v) || 0;
  if (!(r > 1) && name) { const k = ctnNameKey(name); const hit = Object.values(m).find(x => x && x.n && ctnNameKey(x.n) === k); r = Number(hit?.r) || 0; }
  return r > 1 ? r : 1;
}
const ctnG = (c, r) => r > 1 ? Math.round(c / r * 100) / 100 : c;
const ctnCount = () => Object.values(ctnMap()).filter(v => Number(v?.r ?? v) > 1).length;
async function ctnSave(next, msg) {
  if (!isOwner()) { notice('Sirf malik carton ginti badal sakta hai'); return; }
  if (!cloud?.setCtnGinti) { notice('App update karein'); return; }
  if (ctnBusy) return; ctnBusy = true;
  const before = itemCfg; itemCfg = { ...itemCfg, ctnGinti: next };
  ctnPaint();
  try { await cloud.setCtnGinti(next); if (msg) notice(msg); }
  catch (err) { itemCfg = before; notice('Save nahi hua: ' + (err?.message || err)); }
  finally { ctnBusy = false; ctnPaint(); }
}
function ctnSet(ids, r, names) {
  const next = { ...ctnMap() };
  for (const id of ids) { if (r > 1) next[String(id)] = { r, n: String(names[String(id)] || next[String(id)]?.n || '').slice(0, 120) }; else delete next[String(id)]; }
  return next;
}
function ctnPool() {   // POS ke items (sab godam) + register mein aaye items (agar stock list mein na hon)
  const P = agPool(), map = new Map();
  for (const it of P.list) if (it && it.id != null && !hidden[String(it.id)]) map.set(String(it.id), { id: String(it.id), name: String(it.name || ''), pack: Number(it.pack) || 0, n: 0 });
  for (const t of ptLive()) for (const l of t.lines || []) { if (l.itemId == null) continue; const k = String(l.itemId); const o = map.get(k) || { id: k, name: String(l.name || ''), pack: Number(l.pack) || 0, n: 0 }; o.n++; map.set(k, o); }
  return [...map.values()];
}
function ctnRows() {
  const pool = ctnPool(), q = ctnQ.trim();
  if (!q) return pool.filter(x => x.n > 0).sort((a, b) => b.n - a.n || NAMEC.compare(a.name, b.name)).slice(0, 30);
  return pool.filter(x => smartHit(x.name, q)).sort((a, b) => b.n - a.n || NAMEC.compare(a.name, b.name)).slice(0, 60);
}
function ctnHTML() {
  const own = isOwner(), m = ctnMap(), rows = own ? ctnRows() : [], q = ctnQ.trim();
  const groups = new Map(); for (const [id, v] of Object.entries(m)) { const r = Number(v?.r ?? v) || 0; if (r > 1) { if (!groups.has(r)) groups.set(r, []); groups.get(r).push({ id, n: v?.n || ('Item ' + id) }); } }
  const R = [2, 3, 4, 6], custom = !R.includes(ctnRatio);
  const picks = ctnPick.size, allOn = rows.length && rows.every(x => ctnPick.has(x.id));
  return `<div class="reg-root ctn-root">
    <button type="button" class="ctn-back" data-ctn-back="1">← Transfer register</button>
    <div class="ctn-help">⚖️ Jin items ke <b>chhote carton</b> hain unko chunein aur batayein <b>kitne carton = 1 carton</b> gina jaye. Sirf Transfer register ki ginti badlegi — POS aur stock wahi rehte hain.</div>
    ${own ? `<div class="ctn-step"><i>1</i>Naam likhein</div>
    <label class="hs-search"><input type="search" data-ctn-q="1" placeholder="🔍 sufi, dalda, ghee…" value="${esc(ctnQ)}" autocomplete="off"></label>
    ${rows.length ? `<div class="mchips"><button type="button" class="rc ctn-all${allOn ? ' on' : ''}" data-ctn-all="1">${allOn ? '☑ Sab chune hue' : '☑ Sab chuno'} (${rows.length})</button>${picks ? `<button type="button" class="rc" data-ctn-clear="1">✕ Saaf (${picks})</button>` : ''}</div>` : ''}
    <div class="ctn-step"><i>2</i>Tick lagayein${q ? '' : '<small>Neeche register mein aaye items hain — ya upar naam likhein</small>'}</div>
    <div class="ctn-list">${rows.map(x => { const on = ctnPick.has(x.id), cur = ctnOf(x.id); return `<button type="button" class="ctn-it${on ? ' on' : ''}" data-ctn-pick="${esc(x.id)}" data-ctn-name="${esc(x.name)}"><span class="ctn-bx">${on ? '✓' : ''}</span><span class="ctn-nm"><b>${hlName ? hlName(x.name, ctnQ) : esc(x.name)}</b><small>${x.pack > 1 ? num(x.pack) + ' pcs / ctn' : 'khula item'}${x.n ? ' · ' + x.n + ' transfer line' : ''}</small></span>${cur > 1 ? `<em class="ctn-r">abhi ${num(cur)} = 1</em>` : ''}</button>`; }).join('') || `<p class="muted">${q ? 'Is naam ka koi item nahi mila.' : 'Upar naam likhein — jaise "sufi".'}</p>`}</div>
    <div class="ctn-step"><i>3</i>Kitne carton = 1 carton?</div>
    <div class="mchips ctn-rs">${R.map(r => `<button type="button" class="rc${ctnRatio === r ? ' on' : ''}" data-ctn-r="${r}">${r} = 1</button>`).join('')}<button type="button" class="rc${custom ? ' on' : ''}" data-ctn-r="apna">✏️ ${custom ? num(ctnRatio) + ' = 1' : 'Apna'}</button></div>
    <button type="button" class="ctn-save" data-ctn-save="1"${picks && !ctnBusy ? '' : ' disabled'}>${picks ? `✓ Save · ${picks} item · ${num(ctnRatio)} = 1` : 'Pehle upar item chunein'}</button>` : '<p class="ctn-help ctn-ro">👁 Yeh list sirf malik badal sakta hai.</p>'}
    <h4 class="ctn-h">Chune hue items${groups.size ? '' : ''}</h4>
    ${[...groups].sort((a, b) => b[0] - a[0]).map(([r, list]) => `<div class="ctn-grp"><div class="ctn-gh"><b>${num(r)} carton = 1</b><i>${list.length} item</i></div>${list.sort((a, b) => NAMEC.compare(a.n, b.n)).map(x => `<div class="ctn-row"><span>${esc(x.n)}</span>${own ? `<button type="button" class="ctn-del" data-ctn-del="${esc(x.id)}" aria-label="Hatao">✕</button>` : ''}</div>`).join('')}</div>`).join('') || '<p class="muted">Abhi koi item nahi — sab items 1 carton = 1 gine ja rahe hain.</p>'}
    ${own && groups.size ? '<p class="ctn-help ctn-foot">✕ = us item ki ginti wapas normal (1 = 1). Number badalna ho to item dobara chun kar naya number Save karein.</p>' : ''}
  </div>`;
}
function ctnPaint() {
  if (!document.querySelector('.reg-root')) return;
  const q = document.activeElement?.matches?.('[data-ctn-q]');
  $('dialogTitle').textContent = regView === 'ctn' ? '⚖️ Carton ginti' : '📋 Transfer register';
  $('dialogBody').innerHTML = regView === 'ctn' ? ctnHTML() : regHTML();
  if (q) { const i = document.querySelector('[data-ctn-q]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
}
function regLineHTML(t, l) {   // note ke andar ek line — ginti + (malik) tap se number
  const x = cp(Number(l.qty) || 0, Number(l.pack) || 0), r = ctnOf(l.itemId, l.name), key = String(t.transferId || t.id) + '|' + String(l.itemId ?? l.name);
  const qty = r > 1 && x.c ? `${num(x.c)} ctn → <b class="ctn-g">${num(ctnG(x.c, r))}</b>${x.p ? ' + ' + num(x.p) + ' pcs' : ''}<em class="ctn-r">${num(r)} = 1</em>` : `<b>${x.c ? num(x.c) + ' ctn' : ''}${x.c && x.p ? ' + ' : ''}${x.p ? num(x.p) + ' pcs' : ''}</b>`;
  const open = isOwner() && ctnLine === key;
  const row = isOwner() ? `<button type="button" class="reg-ln${open ? ' on' : ''}" data-reg-line="${esc(key)}"><span>${esc(l.name)}</span><span class="reg-q">${qty}</span></button>` : `<div><span>${esc(l.name)}</span><span class="reg-q">${qty}</span></div>`;
  if (!open) return row;
  const ids = `data-ctn-id="${esc(String(l.itemId ?? ''))}" data-ctn-name="${esc(l.name)}"`;
  return row + `<div class="ctn-pop"><p>⚖️ ${esc(l.name)} — kitne carton = 1?</p><div class="mchips">${[2, 3, 4, 6].map(n => `<button type="button" class="rc${r === n ? ' on' : ''}" data-ctn-one="${n}" ${ids}>${n}</button>`).join('')}<button type="button" class="rc" data-ctn-one="apna" ${ids}>✏️</button>${r > 1 ? `<button type="button" class="rc ctn-off" data-ctn-one="1" ${ids}>Hatao</button>` : ''}</div></div>`;
}
function regRows() {
  const since = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (regDays === 2 ? 1 : regDays - 1)); return d.getTime(); })();
  const till = regDays === 2 ? (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })() : Infinity;
  const q = norm(regQ);
  return ptLive().filter(t => t && t.at >= since && t.at < till)
    .filter(t => regGodam === 'all' || String(t.from) === regGodam || String(t.to) === regGodam)
    .filter(t => !q || smartHit('TN ' + (t.transferNo || '') + ' ' + (t.note || '') + ' ' + (t.byName || ''), regQ) || (t.lines || []).some(l => smartHit(l.name, regQ)))
    .map(t => { let c = 0, ca = 0, p = 0, rs = 0; for (const l of t.lines || []) { const x = cp(Number(l.qty) || 0, Number(l.pack) || 0); c += ctnG(x.c, ctnOf(l.itemId, l.name)); ca += x.c; p += x.p; rs += (Number(l.qty) || 0) * (Number(l.rate) || 0); } return { ...t, c: r2(c), ca, p: Math.round(p * 1000) / 1000, rs: Math.round(rs), n: (t.lines || []).length }; })   // v2.99.18: c = ginti (⚖️), ca = asal ctn
    .sort((a, b) => b.at - a.at);
}
function regHTML() {
  const rows = regRows(), names = collect().names || {};
  const tot = rows.reduce((s, t) => ({ n: s.n + 1, i: s.i + t.n, c: s.c + t.c, ca: s.ca + t.ca, p: s.p + t.p, rs: s.rs + t.rs }), { n: 0, i: 0, c: 0, ca: 0, p: 0, rs: 0 }); tot.c = r2(tot.c);
  const asal = (g, a) => r2(g) !== r2(a) ? `<small class="ctn-asal">asal ${num(a)}</small>` : '', nCtn = ctnCount();
  const days = new Map(); for (const t of rows) { const k = regDay(t.at); if (!days.has(k)) days.set(k, []); days.get(k).push(t); }
  const gods = [...new Set(ptLive().flatMap(t => [t.from, t.to]))].filter(Boolean).sort((a, b) => a - b);
  const C = (on, k, v, lab) => `<button type="button" class="rc${on ? ' on' : ''}" data-reg-${k}="${esc(String(v))}">${lab}</button>`;
  const today = regDay(Date.now()), yest = regDay(Date.now() - 864e5);
  return `<div class="reg-root">
    <div class="mchips">${C(regDays === 1, 'd', 1, 'Aaj')}${C(regDays === 2, 'd', 2, 'Kal')}${C(regDays === 7, 'd', 7, '7 din')}${C(regDays === 30, 'd', 30, '30 din')}${C(regDays === 60, 'd', 60, '60 din')}</div>
    <div class="mchips">${C(regGodam === 'all', 'g', 'all', 'Sab godam')}${gods.map(g => C(regGodam === String(g), 'g', g, esc(branchName(g, names)))).join('')}</div>
    <div class="mchips"><button type="button" class="rc ctn-chip${nCtn ? ' has' : ''}" data-reg-ctn="1">⚖️ Carton ginti${nCtn ? ' · ' + nCtn + ' item' : isOwner() ? ' · lagayein' : ''}</button></div>
    <label class="hs-search"><input type="search" data-reg-q="1" placeholder="🔍 item ya TN number…" value="${esc(regQ)}"></label>
    <div class="bc-kpis"><div><b>${num(tot.n)}</b><small>transfer note</small></div><div><b>${num(tot.i)}</b><small>items</small></div><div><b>${num(tot.c)}</b><small>ctn${nCtn ? ' (ginti)' : ''}</small>${asal(tot.c, tot.ca)}</div><div><b>${num(tot.p)}</b><small>pcs</small></div></div>
    ${tot.rs ? `<p class="iv-note">Kul maal: <b>Rs ${num(tot.rs)}</b></p>` : ''}
    ${[...days].map(([d, list]) => { const dc = r2(list.reduce((s, t) => s + t.c, 0)), dca = list.reduce((s, t) => s + t.ca, 0), dp = list.reduce((s, t) => s + t.p, 0);
      return `<div class="bc-day"><div class="bc-dayhead"><b>${d === today ? 'Aaj' : d === yest ? 'Kal' : esc(d)}</b><span>${list.length} note · ${num(dc)} ctn${dp ? ' + ' + num(dp) + ' pcs' : ''}${dc !== dca ? ' <small class="ctn-asal">asal ' + num(dca) + '</small>' : ''}</span></div>
      ${list.map(t => { const op = regOpen.has(String(t.transferId || t.id));
        return `<div class="reg-card${op ? ' open' : ''}"><button type="button" class="reg-h" data-reg-open="${esc(String(t.transferId || t.id))}">
          <span class="reg-time">${esc(regClock(t.at))}</span><span class="reg-main"><b>${esc(t.transferNo || '—')}</b><small>${esc(branchName(t.from, names))} → ${esc(branchName(t.to, names))}</small></span>
          <span class="reg-tot"><b>${num(t.c)} ctn${t.p ? ' + ' + num(t.p) : ''}</b><small>${t.n} items${t.rs ? ' · Rs ' + num(t.rs) : ''}${t.c !== t.ca ? ' · asal ' + num(t.ca) : ''}</small></span><i class="reg-src">${t.app ? '📱 App' : '🖥 POS'}${tcBadge(t)}</i></button>
          ${op ? `<div class="reg-lines">${(t.lines || []).map(l => regLineHTML(t, l)).join('')}${isOwner() ? '<small class="ctn-tip">👆 Item par tap = carton ginti (jaise 4 = 1)</small>' : ''}${t.note ? `<small>📝 ${esc(t.note)}</small>` : ''}</div>` : ''}</div>`; }).join('')}</div>`; }).join('') || '<p class="muted">Is arse mein koi transfer note nahi.</p>'}
    <div class="account-tools iv-acts"><button type="button" class="primary" data-reg-pdf="1">📄 PDF · WhatsApp</button><button type="button" data-in-close="1">✕ Band</button></div></div>`;
}
function openRegister() {
  const d = $('dialog'); if (!d) return;
  d.classList.remove('search-dialog'); d.classList.add('full-dialog');
  regView = 'list'; ctnLine = ''; tcStart();   // v2.99.18 · v2.99.21: ✓/⏳ nishan
  $('dialogTitle').textContent = '📋 Transfer register';
  $('dialogBody').innerHTML = regHTML();
  if (!d.open) d.showModal();
}
function regPdf() {
  const rows = regRows(), names = collect().names || {}; if (!rows.length) { notice('Is arse mein koi transfer note nahi'); return; }
  const lab = { 1: 'Aaj', 2: 'Kal', 7: 'Pichhle 7 din', 30: 'Pichhle 30 din', 60: 'Pichhle 60 din' }[regDays];
  const html = `<h1>NOOR TRADERS</h1><h2>📋 Transfer register — ${esc(lab)}${regGodam !== 'all' ? ' · ' + esc(branchName(Number(regGodam), names)) : ''}</h2><p>${rows.length} transfer note · ${esc(new Date().toLocaleString('en-PK'))}</p>
    <table class="iv-tbl"><thead><tr><th>Waqt</th><th>TN</th><th>Se → Ko</th><th>Items (naam · tadad)</th><th>Kul</th><th>Rs</th></tr></thead><tbody>
    ${rows.map(t => `<tr><td>${esc(regDay(t.at))}<br><small>${esc(regClock(t.at))}</small></td><td><b>${esc(t.transferNo || '')}</b><br><small>${t.app ? 'App' : 'POS'}</small></td><td>${esc(branchName(t.from, names))} → ${esc(branchName(t.to, names))}</td><td class="reg-items">${(t.lines || []).map(l => { const x = cp(Number(l.qty) || 0, Number(l.pack) || 0), r = ctnOf(l.itemId, l.name); return `<div>${esc(l.name)} <b>${r > 1 && x.c ? num(x.c) + ' ctn → ' + num(ctnG(x.c, r)) + ' (' + num(r) + '=1)' : x.c ? num(x.c) + ' ctn' : ''}${x.c && x.p ? ' + ' : ''}${x.p ? num(x.p) + ' pcs' : ''}</b></div>`; }).join('') || t.n}</td><td class="iv-n">${num(t.c)} ctn${t.p ? ' + ' + num(t.p) : ''}${t.c !== t.ca ? '<br><small>asal ' + num(t.ca) + '</small>' : ''}</td><td class="iv-n">${t.rs ? num(t.rs) : ''}</td></tr>`).join('')}
    </tbody></table>${(() => { const tc = r2(rows.reduce((s, t) => s + t.c, 0)), ta = rows.reduce((s, t) => s + t.ca, 0), tp = rows.reduce((s, t) => s + t.p, 0); const g = new Map(); for (const v of Object.values(ctnMap())) { const r = Number(v?.r ?? v) || 0; if (r > 1) { if (!g.has(r)) g.set(r, []); g.get(r).push(v?.n || ''); } }
      return `<p><b>Kul: ${num(tc)} ctn${tp ? ' + ' + num(r2(tp)) + ' pcs' : ''}</b>${tc !== ta ? ' (asal ' + num(ta) + ' ctn)' : ''}</p>${g.size ? `<p><b>⚖️ Carton ginti ke qaide:</b> ${[...g].sort((a, b) => b[0] - a[0]).map(([r, ns]) => num(r) + ' carton = 1 — ' + ns.map(esc).join(', ')).join(' · ')}</p>` : ''}`; })()}`;
  regPdfOf ? regPdfOf(html, 'Transfer register ' + regDay(Date.now())) : notice('PDF abhi nahi bana');
}
document.addEventListener('click', e => {
  if (e.target.closest?.('[data-stock-reg]')) { openRegister(); return; }
  if (!document.querySelector('.reg-root')) return;
  if (ctnClick(e)) return;   // v2.99.18: ⚖️ carton ginti
  const t = e.target.closest?.('[data-reg-d],[data-reg-g],[data-reg-open],[data-reg-pdf]'); if (!t) return;
  const d = t.dataset;
  if (d.regD) regDays = Number(d.regD); else if (d.regG) regGodam = d.regG; else if (d.regOpen) { if (regOpen.has(d.regOpen)) regOpen.delete(d.regOpen); else regOpen.add(d.regOpen); } else if (d.regPdf != null) { regPdf(); return; }
  $('dialogBody').innerHTML = regHTML();
});
function ctnAsk(cur) { const v = prompt('Kitne carton = 1 carton? (jaise 4, 2.5)', cur > 1 ? String(cur) : ''); if (v == null) return 0; const n = Math.round(Number(String(v).replace(',', '.')) * 100) / 100; if (!(n > 1) || n > 100) { notice('1 se bara number likhein (jaise 4)'); return 0; } return n; }
function ctnClick(e) {
  const t = e.target.closest?.('[data-reg-ctn],[data-ctn-back],[data-reg-line],[data-ctn-one],[data-ctn-pick],[data-ctn-all],[data-ctn-clear],[data-ctn-r],[data-ctn-save],[data-ctn-del]'); if (!t) return false;
  const d = t.dataset;
  if (d.regCtn != null) { regView = 'ctn'; ctnLine = ''; ctnPaint(); document.querySelector('#dialogBody')?.scrollTo?.(0, 0); return true; }
  if (d.ctnBack != null) { regView = 'list'; ctnPaint(); return true; }
  if (d.regLine != null) { ctnLine = ctnLine === d.regLine ? '' : d.regLine; ctnPaint(); return true; }
  if (d.ctnOne != null) {
    const id = d.ctnId || Object.entries(ctnMap()).find(([, v]) => v && ctnNameKey(v.n) === ctnNameKey(d.ctnName))?.[0] || '';
    if (!id) { notice('Is line ka item number nahi mila — list se chunein'); return true; }
    let r = d.ctnOne === 'apna' ? ctnAsk(ctnOf(id)) : Number(d.ctnOne); if (!r) return true;
    ctnLine = ''; ctnSave(ctnSet([id], r, { [id]: d.ctnName }), r > 1 ? `⚖️ ${d.ctnName}: ${num(r)} carton = 1` : `${d.ctnName}: ginti normal`); return true;
  }
  if (d.ctnPick != null) { if (ctnPick.has(d.ctnPick)) ctnPick.delete(d.ctnPick); else { ctnPick.add(d.ctnPick); ctnNames[d.ctnPick] = d.ctnName || ''; } ctnPaint(); return true; }
  if (d.ctnAll != null) { const rows = ctnRows(), all = rows.every(x => ctnPick.has(x.id)); for (const x of rows) { if (all) ctnPick.delete(x.id); else { ctnPick.add(x.id); ctnNames[x.id] = x.name; } } ctnPaint(); return true; }
  if (d.ctnClear != null) { ctnPick.clear(); ctnPaint(); return true; }
  if (d.ctnR != null) { if (d.ctnR === 'apna') { const n = ctnAsk(ctnRatio); if (n) ctnRatio = n; } else ctnRatio = Number(d.ctnR); ctnPaint(); return true; }
  if (d.ctnSave != null) { if (!ctnPick.size) return true; const ids = [...ctnPick], n = ids.length, r = ctnRatio; ctnPick.clear(); ctnQ = ''; ctnSave(ctnSet(ids, r, ctnNames), `✓ ${n} item: ${num(r)} carton = 1`); return true; }
  if (d.ctnDel != null) { const nm = ctnMap()[d.ctnDel]?.n || ''; if (!confirm((nm || 'Is item') + ' ki carton ginti hata dein? (wapas 1 = 1)')) return true; ctnSave(ctnSet([d.ctnDel], 1, {}), (nm || 'Item') + ': ginti normal'); return true; }
  return false;
}
document.addEventListener('input', e => { if (e.target.matches?.('[data-tr-note]')) { trNote = e.target.value || ''; return; } if (e.target.matches?.('[data-ctn-q]')) { ctnQ = e.target.value || ''; ctnPaint(); return; } if (!e.target.matches?.('[data-reg-q]')) return; regQ = e.target.value || ''; $('dialogBody').innerHTML = regHTML(); const q = document.querySelector('[data-reg-q]'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } });

// ---------- v2.99.21: 🧾 TRANSFER CHECK — parchi ka barcode scan = maal pahuncha (chori rokne ke liye) ----------
// Malik: "transfer note par barcode — do screen: jo nikle (waqt ke saath) aur larka godam se maal laaye to check kar ke scan / number;
//   scan ke baad edit na ho; neeche device ID". Data: transferChecks/T<TransferID> (rules v2.35: sirf create, ts = server waqt,
//   koi update nahi; sirf malik ghalti par delete). Notes: posTransfers (PC transfer-dekho). Yahan AI nahi.
let tcSel = new Set(), tcView = 'nikle', tcDays = 1, tcDir = 'all', tcChecks = new Map(), tcStop = null, tcErr = '', tcRes = null, tcBusy = false, tcFarq = false, tcOpen = new Set(), tcCode = '';
let auditOf = null, nameOf = () => '', deviceOf = () => '';
const TC_LATE = 120 * 60000;
const tcBase = t => String(t?.id || ('T' + t?.transferId));
// v2.99.58: POS mein note EDIT hua (transfer-dekho v1.3: editCount) -> nayi check chahiye: key 'T123E2' (purani check edit se pehle ki)
const tcKey = t => tcBase(t) + (Number(t?.editCount) > 0 ? 'E' + Number(t.editCount) : '');
const tcIssued = t => Number(t?.createdOn) || Number(t?.at) || 0;
const tcClock = ms => ms ? regClock(ms) : '';
const tcAgo = ms => { const m = Math.max(0, Math.round(ms / 60000)); return m < 60 ? m + ' min' : m < 1440 ? Math.floor(m / 60) + ' ghante' + (m % 60 ? ' ' + (m % 60) + ' min' : '') : Math.floor(m / 1440) + ' din'; };
const tcZ = s => String(s || '').replace(/\D/g, '').replace(/^0+/, '');
function tcStart() {
  if (tcStop || !cloud?.listenTransferChecks) return;
  tcStop = cloud.listenTransferChecks(Date.now() - 62 * 864e5, (list, e) => {
    if (!list) { tcErr = /permission|insufficient/i.test(String(e?.code || '') + String(e?.message || '')) ? 'rules' : 'net'; try { tcStop?.(); } catch {} tcStop = null; }
    else { tcErr = ''; tcChecks = new Map(list.map(c => [c.id, c])); }
    tcPaint(); if (document.querySelector('.reg-root') && regView === 'list') ctnPaint();   // register ke ✓ / ⏳
  });
}
function tcFind(code) {
  const c = String(code || '').trim(), z = tcZ(c), L = tcAll();
  if (!c) return null;
  return L.find(t => String(t.transferNo || '').trim().toLowerCase() === c.toLowerCase())
    || (z && L.find(t => tcZ(t.transferNo) === z)) || (z && L.find(t => String(t.transferId) === z)) || null;
}
// v2.99.74: 📦 DO TICK (malik: "pehle Zeeshan tick kare maine samaan de diya, phir dukan ka larka tick — mazeed security, koi awein
//   transfer note na banaye"). 1) dene wala "maal de diya" -> transferChecks/<key>G (status 'diya')  2) lene wala "maal mil gaya" (purana
//   check). Godam ki taraf ka tick (Godam -> Dukan: step 1 · Dukan -> Godam: step 2) SIRF godam wale (stockConfig.tcGiver, default
//   Zeeshan — login ke naam mein) ya malik. Step 2 step 1 ke baghair nahi (rules v2.48 bhi). TC2_FROM se pehle ke note: purana ek tick.
const TC2_FROM = 1791903600000, TC_SHOP = 1;   // 2026-10-13 8:00 pm PKT · dukan = branch 1 (rules mein bhi 1)
const tcGKey = t => tcKey(t) + 'G';
const tcNeedG = t => tcIssued(t) >= TC2_FROM;
// v2.102.4: 📦 GODAM WALE KAI (malik: "Zeeshan ke saath kisi aur larke ko bhi godam ke tick mein") — stockConfig.tcGiver = "Zeeshan|Bilal"
//   (rules 2.58: naam matches '.*(zeeshan|bilal).*'). Naam sirf harf / hindse / space (regex mehfooz). Purana akela naam bhi chalta.
const tcClean = n => String(n || '').replace(/[^A-Za-z0-9\u0600-\u06FF ]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 30);
const tcGivers = () => { const l = String(itemCfg.tcGiver || 'Zeeshan').split('|').map(tcClean).filter(Boolean); return l.length ? l : ['Zeeshan']; };
const tcGiver = () => tcGivers().join(', ');
const tcIsGiver = () => isOwner() || tcGivers().some(g => String(nameOf() || '').toLowerCase().includes(g.toLowerCase()));
let tcGEd = null;   // { sel: Set, staff: [names], extra: '' } — malik ka chooser khula
const tcGodamSide = (t, step) => step === 1 ? Number(t.from) !== TC_SHOP : Number(t.to) !== TC_SHOP;
const tcCanStep = (t, step) => (!tcGodamSide(t, step) || tcIsGiver()) && (step !== 1 || isOwner() || can('stock.tcgive'));
const tcSide = (t, step) => tcGodamSide(t, step) ? '📦 ' + tcGiver() : '🏪 Dukan';
function tcState(t) {
  if (t && t.cancelled) return { k: 'cancel' };
  const c = tcChecks.get(tcKey(t)), g = tcChecks.get(tcGKey(t)) || null;
  if (c) return { k: c.status === 'farq' ? 'farq' : 'ok', c, g };
  const age = Date.now() - tcIssued(t);
  return { k: age > TC_LATE ? 'late' : 'wait', age, g, ng: tcNeedG(t) && !g };
}
function tcStepsHTML(t, s) {
  if (s.k === 'cancel' || !tcNeedG(t)) return '';
  const g = s.g, rc = s.c, k = esc(tcKey(t));
  const one = g ? `<span class="tc-sd">✓ ${esc(g.byName || '')} · ${tcClock(g.ts)}${g.pend ? ' · ⏳' : ''}</span>` : tcCanStep(t, 1) ? `<button type="button" class="tc-give${tcArmed('g:' + k) ? ' arm' : ''}" data-tc-give="${k}">${tcArmed('g:' + k) ? '✓ Pakka? dobara dabao' : '☐ Tick — maal de diya'}</button>` : `<span class="tc-sw">⏳ ${tcSide(t, 1)} ka tick baqi</span>`;
  const two = rc ? `<span class="tc-sd">${rc.status === 'farq' ? '⚠️' : '✓'} ${esc(rc.byName || '')} · ${tcClock(rc.ts)}</span>` : !g ? '<span class="tc-sw lock">🔒 pehle 1 number tick</span>' : tcCanStep(t, 2) ? '<span class="tc-sw">☐ upar tick ya 📷 scan</span>' : `<span class="tc-sw">⏳ ${tcSide(t, 2)} ka tick baqi</span>`;
  return `<div class="tc-2"><div class="tc-stp${g ? ' done' : ''}"><i>1</i><b>${tcSide(t, 1)} — maal de diya</b>${one}</div><div class="tc-stp${rc ? ' done' : g ? ' next' : ''}"><i>2</i><b>${tcSide(t, 2)} — maal mil gaya</b>${two}</div></div>`;
}
// v2.99.58: edit ka nishan + kya badla (pehle -> ab)
function tcEditHTML(t) {
  if (!(Number(t?.editCount) > 0)) return '';
  const fmt = l => { const x = cp(Number(l.qty) || 0, Number(l.pack) || 0); return `${x.c ? num(x.c) + ' ctn' : ''}${x.c && x.p ? ' + ' : ''}${x.p || !x.c ? num(x.p) + ' pcs' : ''}`; };
  const prev = new Map((t.prevLines || []).map(l => [String(l.itemId), l])), now = new Map((t.lines || []).map(l => [String(l.itemId), l])), ch = [];
  for (const [k, l] of now) { const p = prev.get(k); if (!p) ch.push(`➕ ${esc(l.name)}: ${fmt(l)}`); else if (Math.abs((Number(p.qty) || 0) - (Number(l.qty) || 0)) > 0.0005) ch.push(`✏️ ${esc(l.name)}: ${fmt(p)} → <b>${fmt(l)}</b>`); }
  for (const [k, p] of prev) if (!now.has(k)) ch.push(`➖ ${esc(p.name)}: ${fmt(p)} hata diya`);
  const old = tcChecks.get(tcBase(t));
  return `<div class="tc-edit"><b>✏️ Note EDIT hua${t.editedAt ? ' ' + tcClock(t.editedAt) : ''} — maal dobara mila kar lo</b>${ch.length ? `<div class="tc-ch">${ch.slice(0, 8).join('<br>')}</div>` : ''}${old ? `<small>Edit se pehle wali check: ${old.status === 'farq' ? '⚠️ farq' : '✓'} ${esc(old.byName || '')} ${tcClock(old.ts)} — ab nayi check chahiye</small>` : ''}</div>`;
}
function tcStatusText(t, s) {
  if (s.k === 'cancel') return `❌ Cancel ho gaya${t.cancelledAt ? ' ' + tcClock(t.cancelledAt) : ''} — check ki zaroorat nahi`;
  if (s.k === 'ok') return `✓ Pahunch gaya ${tcClock(s.c.ts)} · ${esc(s.c.byName || '')}${tcIssued(t) && s.c.ts ? ' · ' + tcAgo(s.c.ts - tcIssued(t)) : ''}`;
  if (s.k === 'farq') return `⚠️ Farq: "${esc(String(s.c.note || '').slice(0, 60))}" · ${esc(s.c.byName || '')} ${tcClock(s.c.ts)}`;
  if (s.ng) return `📦 ${esc(tcSide(t, 1).replace(/^\S+ /, ''))} ne abhi "maal de diya" tick nahi kiya · ${tcAgo(s.age)}`;   // v2.99.74
  if (s.g && tcNeedG(t)) return `🚚 ${tcAgo(Date.now() - (s.g.ts || Date.now()))} se raste mein (diya ${tcClock(s.g.ts)})`;
  return s.k === 'late' ? `⏳ ${tcAgo(s.age)} se nahi pahuncha` : `⏳ ${tcAgo(s.age)} se raste mein`;
}
function tcSum(t) { let c = 0, p = 0; for (const l of t.lines || []) { const x = cp(Number(l.qty) || 0, Number(l.pack) || 0); c += x.c; p += x.p; } return `${(t.lines || []).length} item · ${c ? num(c) + ' ctn' : ''}${c && p ? ' + ' : ''}${p ? num(r2(p)) + ' pcs' : ''}${!c && !p ? '0' : ''}`; }
// v2.103.21: ☐ HAR ITEM KA CHECKBOX (malik: "stock transfer check par item select karne ka checkbox") — larka gin kar ✓ lagaye; "✓ Maal poora mila"
//   tab hi jab saare ✓ (CAP stock.tcall band = zaroori nahi). Farq par baghair ✓ wale khud likhe aate hain. ✓ phone par yaad (sam-tc-tick).
const TC_TK = 'sam-tc-tick';
function tcTk() { try { if (!tcTk.m) { const o = JSON.parse(localStorage.getItem(TC_TK) || '{}'); tcTk.m = new Map(Object.entries(o).map(([k, v]) => [k, new Set(v)])); } } catch { tcTk.m = new Map(); } return tcTk.m; }
function tcTkSave() { try { const m = tcTk(), o = {}; [...m.entries()].slice(-40).forEach(([k, v]) => { if (v.size) o[k] = [...v]; }); localStorage.setItem(TC_TK, JSON.stringify(o)); } catch {} }
function tcTkOf(t) { return tcTk().get(tcKey(t)) || new Set(); }
function tcTkAll(t) { const n = (t.lines || []).length, S = tcTkOf(t); return !n || (t.lines || []).every((_, i) => S.has(i)); }
const tcNeedAll = () => can('stock.tcall');
function tcMissing(t) { const S = tcTkOf(t); return (t.lines || []).filter((_, i) => !S.has(i)).map(l => { const x = cp(Number(l.qty) || 0, Number(l.pack) || 0); return `${l.name} ${x.c ? x.c + ' ctn' : ''}${x.c && x.p ? '+' : ''}${x.p ? x.p + ' pcs' : ''}`.trim(); }); }
function tcLinesCk(t) { const k = tcKey(t), S = tcTkOf(t), L = t.lines || [], n = L.filter((_, i) => S.has(i)).length;
  return `<div class="tc-tkh"><i class="tc-tkc${n === L.length ? ' ok' : ''}">✓ ${num(n)}/${num(L.length)} gine</i>${isOwner() ? `<button type="button" class="tc-tka" data-tc-tka="${esc(k)}">${n === L.length ? '☐ koi nahi' : '☑ sab'}</button>` : ''}</div>`
    + L.map((l, i) => { const x = cp(Number(l.qty) || 0, Number(l.pack) || 0), on = S.has(i); return `<label class="tc-ln tc-lck${on ? ' is-in' : ''}"><input type="checkbox" data-tc-tk="${esc(k)}|${i}"${on ? ' checked' : ''}><span>${esc(l.name)}</span><b>${x.c ? num(x.c) + ' ctn' : ''}${x.c && x.p ? ' + ' : ''}${x.p ? num(x.p) + ' pcs' : ''}</b></label>`; }).join(''); }
function tcLines(t) { return (t.lines || []).map(l => { const x = cp(Number(l.qty) || 0, Number(l.pack) || 0); return `<div class="tc-ln"><span>${esc(l.name)}</span><b>${x.c ? num(x.c) + ' ctn' : ''}${x.c && x.p ? ' + ' : ''}${x.p ? num(x.p) + ' pcs' : ''}</b></div>`; }).join(''); }
function tcWho(c) { return `<div class="tc-who"><span>👤 ${esc(c.byName || '—')}</span><span>🕒 ${tcClock(c.ts)} · ${esc(regDay(c.ts || Date.now()))}</span><span>📱 Device: <b>${esc(c.device || '—')}</b></span></div>`; }
function tcAll() {   // v2.99.25: POS ke note + app ke bane note (transferJobs done) jo abhi POS list (transfer-dekho) mein nahi aaye
  const dels = new Set((trList || []).filter(j => (j.op === 'delete' && j.transferId || j.op === 'edit' && j.oldId) && j.status === 'done').map(j => String(j.op === 'edit' ? j.oldId : j.transferId)));   // v2.99.58: app se cancel · v2.99.68: edit = purana cancel
  const L = (ptList || []).map(t => dels.has(String(t.transferId)) && !t.cancelled ? { ...t, cancelled: true, cancelledAt: t.cancelledAt || 0 } : t), ids = new Set(L.map(t => String(t.transferId)));
  for (const j of trList || []) { if (j.op === 'delete' || j.status !== 'done' || !j.transferId || ids.has(String(j.transferId)) || dels.has(String(j.transferId))) continue;
    L.push({ id: 'T' + j.transferId, transferId: Number(j.transferId), transferNo: String(j.transferNo || ''), from: Number(j.from), to: Number(j.to), at: Number(j.doneAt) || Number(j.at) || 0, createdOn: Number(j.doneAt) || Number(j.at) || 0, app: true, lines: (j.lines || []).map(l => ({ itemId: String(l.itemId), name: l.name, qty: Number(l.qty) || 0, pack: Number(l.pack) || 0 })) }); }
  return L;
}
function tcRows() {
  const since = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (tcDays === 2 ? 1 : tcDays - 1)); return d.getTime(); })();
  const till = tcDays === 2 ? (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })() : Infinity;
  const main = agPool().main ?? 1;
  return tcAll().filter(t => t && tcIssued(t) >= since && tcIssued(t) < till)
    .filter(t => tcDir === 'all' || (tcDir === 'in' ? Number(t.to) === Number(main) : Number(t.from) === Number(main)));
}
function tcNikleHTML() {
  const names = collect().names || {}, rows = tcRows().map(t => ({ t, s: tcState(t) }));
  const pend = rows.filter(x => x.s.k === 'wait' || x.s.k === 'late').sort((a, b) => tcIssued(a.t) - tcIssued(b.t));
  const done = rows.filter(x => x.s.k === 'ok' || x.s.k === 'farq').sort((a, b) => (b.s.c.ts || 0) - (a.s.c.ts || 0));
  const canc = rows.filter(x => x.s.k === 'cancel');
  const late = pend.filter(x => x.s.k === 'late').length, farq = done.filter(x => x.s.k === 'farq').length;
  const C = (on, k, v, lab) => `<button type="button" class="rc${on ? ' on' : ''}" data-tc-${k}="${v}">${lab}</button>`;
  const card = ({ t, s }) => { const k = tcKey(t), op = tcOpen.has(k);
    return `<div class="tc-n ${s.k}${s.ng ? ' ng' : ''}">${(s.k === 'wait' || s.k === 'late') && !s.ng && tcCanStep(t, 2) ? `<label class="tc-ck"><input type="checkbox" data-tc-sel="${esc(k)}"${tcSel.has(k) ? ' checked' : ''}></label>` : ''}<button type="button" class="tc-h" data-tc-open="${esc(k)}"><span class="tc-l"><b>TN ${esc(t.transferNo || t.transferId)}</b><small>${esc(branchName(t.from, names))} → ${esc(branchName(t.to, names))} · ${tcSum(t)}</small></span><span class="tc-t">${tcClock(tcIssued(t))}${regDay(tcIssued(t)) !== regDay(Date.now()) ? `<small>${esc(regDay(tcIssued(t)).slice(5))}</small>` : ''}</span></button>
      <span class="tc-st ${s.k}${s.ng ? ' ng' : ''}">${tcStatusText(t, s)}</span>${tcStepsHTML(t, s)}${s.k === 'cancel' ? '' : tcEditHTML(t)}
      ${op ? `<div class="tc-more">${(s.k === 'wait' || s.k === 'late') && !s.ng && tcCanStep(t, 2) ? tcLinesCk(t) : tcLines(t)}${s.g && tcNeedG(t) ? `<p class="tc-note">📦 1 number: ${esc(s.g.byName || '')} · ${tcClock(s.g.ts)} · 📱 ${esc(s.g.device || '—')}</p>${isOwner() && !s.c ? `<button type="button" class="tc-del" data-tc-del="${esc(tcGKey(t))}">🗑 "De diya" tick hatao (sirf malik)</button>` : ''}` : ''}${s.c ? tcWho(s.c) + (s.c.note ? `<p class="tc-note">📝 ${esc(s.c.note)}</p>` : '') + (isOwner() ? `<button type="button" class="tc-del" data-tc-del="${esc(k)}">🗑 Check hatao (sirf malik — ghalti par)</button>` : '') : '<p class="tc-note">Abhi kisi ne scan nahi kiya. Maal aane par "📷 Scan / Check" mein parchi scan karein.</p>'}</div>` : ''}</div>`; };
  return `<div class="mchips">${C(tcDays === 1, 'd', 1, 'Aaj')}${C(tcDays === 2, 'd', 2, 'Kal')}${C(tcDays === 7, 'd', 7, '7 din')}${C(tcDays === 30, 'd', 30, '30 din')}</div>
    <div class="mchips">${C(tcDir === 'all', 'dir', 'all', 'Sab')}${C(tcDir === 'in', 'dir', 'in', 'Godam → Dukan')}${C(tcDir === 'out', 'dir', 'out', 'Dukan → Godam')}</div>
    ${isOwner() ? (tcGEd ? tcGEdHTML() : `<button type="button" class="tc-giver" data-tc-giver="1">📦 Godam wale (pehla tick): <b>${esc(tcGiver())}</b> ✎</button>`) : ''}
    <div class="tc-kpis">${(() => { const ng = pend.filter(x => x.s.ng).length; return ng ? `<div class="bad"><b>${ng}</b><small>📦 de diya tick nahi</small></div>` : ''; })()}<div class="${pend.length ? 'bad' : ''}"><b>${pend.length}</b><small>⏳ nahi pahunche${late ? ` · ${late} der se` : ''}</small></div><div class="good"><b>${done.length - farq}</b><small>✓ check ho gaye</small></div><div class="${farq ? 'warn' : ''}"><b>${farq}</b><small>⚠️ farq</small></div></div>
    ${pend.length ? `<h4 class="tc-hh">⏳ Abhi nahi pahunche (${pend.length}) <small>— tick lagao, neeche "✓ Check" (scan ke baghair)</small></h4>${pend.map(card).join('')}${tcSel.size ? `<div class="tc-bulk"><b>${tcSel.size} note chune</b><button type="button" class="tc-ok${tcArmed('bulk') ? ' arm' : ''}" data-tc-bulk="1"${tcBusy ? ' disabled' : ''}>${tcArmed('bulk') ? '✓ Pakka? dobara dabao' : '✓ Maal poora mila — check karo'}</button><button type="button" data-tc-selclear="1">✕</button></div>` : ''}` : ''}
    ${done.length ? `<h4 class="tc-hh">✓ Check ho chuke (${done.length})</h4>${done.map(card).join('')}` : ''}
    ${canc.length ? `<h4 class="tc-hh">❌ Cancel ho gaye (${canc.length}) <small>— POS mein mita diye, check nahi karne</small></h4>${canc.map(card).join('')}` : ''}
    ${rows.length ? '' : '<p class="muted">Is arse mein koi transfer note nahi nikla.</p>'}`;
}
function tcScanHTML() {
  const names = collect().names || {}, r = tcRes, me = (() => { const t0 = new Date(); t0.setHours(0, 0, 0, 0); const d = deviceOf(); return [...tcChecks.values()].filter(c => (c.ts || 0) >= t0.getTime() && c.device === d).length; })();
  let res = '';
  if (r?.type === 'none') res = `<div class="tc-res bad"><b>❌ "${esc(r.code)}" — yeh transfer note nahi mila</b><small>POS mein note bane ke 1-2 minute baad app mein aata hai. Thori der baad dobara scan karein. Number ghalat ho to parchi par likha number dekhein.</small><button type="button" data-tc-retry="1">🔄 Dobara dhoondo</button></div>`;
  else if (r?.type === 'cancel') res = `<div class="tc-res bad"><b>❌ TN ${esc(r.t.transferNo || r.t.transferId)} cancel ho chuka hai</b><small>POS mein yeh note mita diya gaya${r.t.cancelledAt ? ' (' + tcClock(r.t.cancelledAt) + ')' : ''} — check ki zaroorat nahi. Maal aaya ho to malik ko batayein.</small></div>`;
  else if (r?.type === 'nogive') res = `<div class="tc-res lock"><b>🔒 TN ${esc(r.t.transferNo || r.t.transferId)} — pehle ${esc(tcSide(r.t, 1))} "maal de diya" tick kare</b><small>Dene wale ke tick ke baghair "mil gaya" save nahi hota. ${tcCanStep(r.t, 1) ? 'Aap hi dene wale hain — neeche tick karein.' : 'Us se kahein apne login se tick kare.'}</small>${tcCanStep(r.t, 1) ? `<button type="button" class="tc-give" data-tc-give="${esc(tcKey(r.t))}">☐ Tick — maal de diya</button>` : ''}</div>`;
  else if (r?.type === 'noside') res = `<div class="tc-res lock"><b>🔒 TN ${esc(r.t.transferNo || r.t.transferId)} — yeh check sirf ${esc(tcSide(r.t, 2))} kar sakta hai</b><small>Maal godam mein aaya hai — godam wala apne login se "mil gaya" kare.</small></div>`;
  else if (r?.type === 'done') res = `<div class="tc-res lock"><b>🔒 TN ${esc(r.t.transferNo || r.t.transferId)} pehle hi check ho chuka</b><small>${r.c.status === 'farq' ? '⚠️ Farq: ' + esc(r.c.note || '') + ' · ' : '✓ Poora mila · '}ab badla nahi ja sakta</small>${tcWho(r.c)}</div>`;
  else if (r?.type === 'saved') res = `<div class="tc-res good"><b>${r.c.status === 'farq' ? '⚠️ Farq ke saath save' : '✓ Check ho gaya'} — TN ${esc(r.t.transferNo || r.t.transferId)}</b><small>${tcIssued(r.t) ? 'Nikalne ke ' + tcAgo((r.c.ts || Date.now()) - tcIssued(r.t)) + ' baad pahuncha · ' : ''}ab koi badal nahi sakta</small>${tcWho(r.c)}</div>`;
  else if (r?.type === 'open') { const t = r.t, age = Date.now() - tcIssued(t);
    res = `<div class="tc-res open"><div class="tc-rh"><b>TN ${esc(t.transferNo || t.transferId)}</b><span class="tc-st ${age > TC_LATE ? 'late' : 'wait'}">⏳ ${tcAgo(age)}</span></div>
      <small>${esc(branchName(t.from, names))} → ${esc(branchName(t.to, names))} · nikla ${tcClock(tcIssued(t))} · ${esc(regDay(tcIssued(t)))}</small>
      ${tcEditHTML(t)}<div class="tc-lines">${tcLinesCk(t)}</div>
      ${tcFarq ? `<label class="tc-fl">Kya farq hai? (jaise "cheeni 1 bori kam")<textarea data-tc-note="1" maxlength="300" rows="2" placeholder="Kya kam / zyada / toota aaya…">${esc((() => { const m = tcMissing(t); return m.length && m.length < (t.lines || []).length ? ('Nahi mila: ' + m.join(', ')).slice(0, 280) : ''; })())}</textarea></label>
        <div class="tc-btns"><button type="button" class="tc-fsave" data-tc-fsave="1"${tcBusy ? ' disabled' : ''}>⚠️ Farq save karo</button><button type="button" class="tc-back" data-tc-fback="1">Wapas</button></div>`
      : `<div class="tc-btns"><button type="button" class="tc-ok" data-tc-ok="1"${tcBusy || (tcNeedAll() && !tcTkAll(t)) ? ' disabled' : ''}>${tcBusy ? '⏳ Save…' : tcNeedAll() && !tcTkAll(t) ? `☐ Pehle sab gin kar ✓ (${num((t.lines || []).length - tcTkOf(t).size)} baqi)` : '✓ Maal poora mila'}</button><button type="button" class="tc-farq" data-tc-farq="1"${tcBusy ? ' disabled' : ''}>⚠️ Farq hai</button></div>`}
      <p class="tc-warn">Save ke baad yeh check <b>koi badal nahi sakta</b>. Pehle maal gin lein.</p></div>`; }
  return `<div class="tc-scan"><button type="button" class="tc-cam" data-tc-cam="1">${camMissing() ? '🔫 Scanner gun se scan karein' : '📷 Camera se barcode scan'}</button><small>Ya scanner gun chalayein / parchi ka number neeche likhein</small></div>
    <form class="tc-inp" data-tc-form="1"><input data-tc-code="1" inputmode="numeric" autocomplete="off" enterkeyhint="go" placeholder="Transfer note number / barcode" value="${esc(tcCode)}"><button type="submit">✓</button></form>
    ${res}
    <p class="tc-foot">Is device se aaj ${me} note check hue · 📱 Device: <b>${esc(deviceOf() || '—')}</b></p>`;
}
function tcHTML() {
  const pending = tcRows().filter(t => !t.cancelled && !tcChecks.get(tcKey(t))).length;
  return `<div class="tc-root">
    <div class="tc-tabs"><button type="button" class="${tcView === 'nikle' ? 'on' : ''}" data-tc-view="nikle">📤 Nikle${pending ? ` <i>${pending}</i>` : ''}</button><button type="button" class="${tcView === 'scan' ? 'on' : ''}" data-tc-view="scan">📷 Scan / Check</button></div>
    ${tcErr === 'rules' ? '<p class="warning">⚠️ Transfer check ke Firestore rules abhi upload nahi hue (v2.35) — malik rules wali html file upload kare.</p>' : tcErr === 'net' ? '<p class="warning">⚠️ Internet / server se check ki list nahi aayi — dobara kholein.</p>' : ''}
    ${tcView === 'scan' ? tcScanHTML() : tcNikleHTML()}
    <div class="account-tools iv-acts"><button type="button" data-in-close="1">✕ Band</button></div></div>`;
}
function tcGEdHTML() {
  const all = [...new Set([...tcGEd.staff, ...tcGEd.sel])].sort((a, b) => a.localeCompare(b));
  return `<div class="tc-ged"><b>📦 Godam wale — kaun "maal de diya" / godam ka "mil gaya" tick kare?</b>
    <div class="tc-gl">${all.map(n => `<label class="tc-gn${tcGEd.sel.has(n) ? ' on' : ''}"><input type="checkbox" data-tc-gn="${esc(n)}"${tcGEd.sel.has(n) ? ' checked' : ''}> ${esc(n)}</label>`).join('') || '<small>Mulazim ki list nahi mili — neeche naam likhein</small>'}</div>
    <div class="tc-gadd"><input type="text" data-tc-gx="1" placeholder="➕ aur naam (login wala)" value="${esc(tcGEd.extra || '')}" maxlength="30"><button type="button" data-tc-gxadd="1">Jorein</button></div>
    <small class="tc-ghint">Login ke naam mein yeh lafz ho to tick chalega (jaise "Bilal" = "Bilal Ahmed").</small>
    <div class="tc-gbtns"><button type="button" class="tc-gno" data-tc-gcancel="1">Wapas</button><button type="button" class="tc-gok" data-tc-gsave="1"${tcGEd.sel.size ? '' : ' disabled'}>✓ Save (${tcGEd.sel.size})</button></div></div>`;
}
function tcPaint() {
  if (!document.querySelector('.tc-root')) return;
  const focus = document.activeElement?.matches?.('[data-tc-code]'), note = document.querySelector('[data-tc-note]')?.value;
  $('dialogBody').innerHTML = tcHTML();
  const nt = document.querySelector('[data-tc-note]'); if (nt && note) nt.value = note;
  if (tcView === 'scan' && (focus || !nt) && !matchMedia?.('(pointer:coarse)')?.matches) document.querySelector('[data-tc-code]')?.focus();
}
// v2.99.58: 🔔 notification se seedha — '#tc=<key>' (Server PC auto-backup v1.5: transfer 10 min mein check na ho)
function tcHashGo(tries = 0) {
  const m = String(location.hash || '').match(/^#tc=([^&]+)/); if (!m) return;
  if (!cloud?.listenTransferChecks) { if (tries < 20) setTimeout(() => tcHashGo(tries + 1), 1000); return; }
  const key = decodeURIComponent(m[1]);
  try { history.replaceState(null, '', location.pathname + location.search); } catch {}
  tcDays = 1; tcDir = 'all'; tcOpen.add(key); openTransferCheck('nikle');
  setTimeout(() => { const el = [...document.querySelectorAll('[data-tc-open]')].find(b => b.dataset.tcOpen === key); if (el) { el.scrollIntoView({ block: 'center' }); el.closest('.tc-n')?.classList.add('tc-flash'); } }, 900);
}
window.addEventListener?.('hashchange', () => tcHashGo());
setTimeout(() => tcHashGo(), 2500);
export function openTransferCheck(view) {
  const d = $('dialog'); if (!d) return;
  tcStart(); if (view) tcView = view;
  d.classList.remove('search-dialog'); d.classList.add('full-dialog');
  $('dialogTitle').textContent = '🧾 Transfer check';
  $('dialogBody').innerHTML = tcHTML();
  if (!d.open) d.showModal();
  if (tcView === 'scan' && !matchMedia?.('(pointer:coarse)')?.matches) document.querySelector('[data-tc-code]')?.focus();
}
function tcLookup(code) {
  tcCode = String(code || '').trim(); tcFarq = false;
  if (!tcCode) { tcRes = null; tcPaint(); return; }
  const t = tcFind(tcCode);
  if (!t) { tcRes = { type: 'none', code: tcCode }; beep(false); tcPaint(); return; }
  if (tcState(t).k === 'cancel') { tcRes = { type: 'cancel', t }; beep(false); tcPaint(); return; }   // v2.99.58
  const c = tcChecks.get(tcKey(t)), st = tcState(t);
  tcRes = c ? { type: 'done', t, c } : st.ng ? { type: 'nogive', t } : !tcCanStep(t, 2) ? { type: 'noside', t } : { type: 'open', t };   // v2.99.74
  beep(!c); if (c && navigator.vibrate) navigator.vibrate([80, 60, 80]);
  tcPaint();
}
// v2.99.78: ⚡ TEZ TICK — malik: "Zeeshan jab tick kare to speed se ho". Do tap (pehla = "Pakka? dobara dabao", 3 second) — popup nahi.
// Tick usi second screen par ✓ (tcChecks mein), save peeche (cloud.saveTransferCheckFast = seedha setDoc, transaction nahi). Na hua to ✓ hat jata hai + notice.
let tcArm = { k: '', until: 0 }, tcArmT = 0;
const tcArmed = k => tcArm.k === k && Date.now() < tcArm.until;
function tcArmSet(k) { tcArm = { k, until: Date.now() + 3000 }; clearTimeout(tcArmT); tcArmT = setTimeout(() => { tcArm = { k: '', until: 0 }; tcPaint(); }, 3000); if (navigator.vibrate) navigator.vibrate(25); tcPaint(); }
const tcErrMsg = e => /permission|insufficient/i.test(String(e?.code || '') + String(e?.message || '')) ? 'ijazat nahi / rules' : /offline|unavailable|network/i.test(String(e?.code || '') + String(e?.message || '')) ? 'internet' : (e?.message || String(e));
function tcFast(key, d, { onOk, onErr } = {}) {
  tcChecks.set(key, { ...d, id: key, ts: Date.now(), pend: true }); beep(true); if (navigator.vibrate) navigator.vibrate(40); tcPaint();
  const save = cloud.saveTransferCheckFast || cloud.saveTransferCheck;
  return save(key, d).then(() => { try { onOk?.(); } catch {} }).catch(e => {
    if (e?.code === 'tc/done') { if (e.done) tcChecks.set(key, e.done); notice('Pehle hi tick ho chuka'); }
    else { const c = tcChecks.get(key); if (c && c.pend) tcChecks.delete(key); beep(false); notice('⚠️ Tick save nahi hua (TN ' + (d.transferNo || d.transferId) + ') — dobara lagao: ' + tcErrMsg(e)); }
    try { onErr?.(e); } catch {}
    tcPaint();
  });
}
async function tcSaveOne(t, status, note) {
  if (tcNeedG(t) && !tcChecks.get(tcGKey(t))) throw Object.assign(Error('pehle maal de diya tick'), { code: 'tc/nogive' });   // v2.99.74
  if (!tcCanStep(t, 2)) throw Object.assign(Error('sirf ' + tcSide(t, 2)), { code: 'tc/noside' });
  const key = tcKey(t), d = { transferId: t.transferId, transferNo: t.transferNo, from: t.from, to: t.to, issuedAt: tcIssued(t), status, note: String(note || '').trim(), byName: nameOf() || (isOwner() ? 'Malik' : 'Mulazim'), device: deviceOf(), lines: (t.lines || []).length };
  await cloud.saveTransferCheck(key, d); if (!tcChecks.has(key)) tcChecks.set(key, { ...d, id: key, ts: Date.now() });
  try { auditOf?.({ area: 'stock', act: 'tr-check', what: `TN ${t.transferNo || t.transferId} ${status === 'farq' ? '⚠️ farq' : '✓ poora'} (tick)`.slice(0, 120), ref: key, refType: 'transfer' }); } catch {}
}
async function tcBulk() {
  if (tcBusy || !tcSel.size) return; if (!cloud?.saveTransferCheck) { notice('App update karein'); return; }
  const list = tcRows().filter(t => tcSel.has(tcKey(t)) && !tcChecks.get(tcKey(t)) && !tcState(t).ng && tcCanStep(t, 2) && (!tcNeedAll() || tcTkAll(t)));
  if (!list.length) { notice('☐ Pehle har note ke items gin kar ✓ lagayein'); return; }
  if (!tcArmed('bulk')) { tcArmSet('bulk'); return; }   // v2.99.78: popup ki jagah doosra tap
  tcArm = { k: '', until: 0 };
  for (const t of list) { const key = tcKey(t), d = { transferId: t.transferId, transferNo: t.transferNo, from: t.from, to: t.to, issuedAt: tcIssued(t), status: 'ok', note: '', byName: nameOf() || (isOwner() ? 'Malik' : 'Mulazim'), device: deviceOf(), lines: (t.lines || []).length };
    tcFast(key, d, { onOk: () => { try { auditOf?.({ area: 'stock', act: 'tr-check', what: `TN ${t.transferNo || t.transferId} ✓ poora (tick)`.slice(0, 120), ref: key, refType: 'transfer' }); } catch {} } }); }
  tcSel.clear(); notice(`✓ ${list.length} note check`); tcPaint();
}
async function tcSave(status, note) {
  const t = tcRes?.t; if (!t || tcBusy) return;
  if (!cloud?.saveTransferCheck) { notice('App update karein'); return; }
  if (status === 'farq' && !String(note || '').trim()) { notice('Farq likhein — kya kam / zyada aaya'); return; }
  if (tcState(t).ng) { notice('🔒 Pehle ' + tcSide(t, 1) + ' "maal de diya" tick kare'); return; }   // v2.99.74
  if (!tcCanStep(t, 2)) { notice('🔒 Yeh check sirf ' + tcSide(t, 2) + ' kar sakta hai'); return; }
  if (status === 'ok' && tcNeedAll() && !tcTkAll(t)) { notice('☐ Pehle har item gin kar ✓ lagayein'); return; }   // v2.103.21
  if (tcChecks.get(tcKey(t)) && !tcChecks.get(tcKey(t)).pend) { tcRes = { type: 'done', t, c: tcChecks.get(tcKey(t)) }; beep(false); tcPaint(); return; }
  const key = tcKey(t), d = { transferId: t.transferId, transferNo: t.transferNo, from: t.from, to: t.to, issuedAt: tcIssued(t), status, note: String(note || '').trim(), byName: nameOf() || (isOwner() ? 'Malik' : 'Mulazim'), device: deviceOf(), lines: (t.lines || []).length };
  tcRes = { type: 'saved', t, c: { ...d, id: key, ts: Date.now() } }; tcCode = ''; tcFarq = false;   // v2.99.78: ⚡ foran
  tcFast(key, d, { onOk: () => { try { auditOf?.({ area: 'stock', act: 'tr-check', what: `TN ${t.transferNo || t.transferId} ${status === 'farq' ? '⚠️ farq' : '✓ poora'}`.slice(0, 120), ref: key, refType: 'transfer', note: d.note.slice(0, 200) }); } catch {} },
    onErr: e => { tcRes = e?.code === 'tc/done' ? { type: 'done', t, c: e.done } : { type: 'open', t }; } });
}
document.addEventListener('click', e => {
  if (e.target.closest?.('[data-stock-tc]')) { openTransferCheck(); return; }
  if (!document.querySelector('.tc-root')) return;
  if (e.target.closest?.('.tc-ck,.tc-lck')) return;   // checkbox: change par
  const ta = e.target.closest?.('[data-tc-tka]'); if (ta) { const k = ta.dataset.tcTka, t = tcAll().find(x => tcKey(x) === k); if (!t) return; const m = tcTk(), all = tcTkAll(t); m.delete(k); m.set(k, all ? new Set() : new Set((t.lines || []).map((_, i) => i))); tcTkSave(); tcPaint(); return; }
  const t = e.target.closest?.('[data-tc-view],[data-tc-d],[data-tc-dir],[data-tc-open],[data-tc-cam],[data-tc-retry],[data-tc-ok],[data-tc-farq],[data-tc-fback],[data-tc-fsave],[data-tc-del],[data-tc-bulk],[data-tc-selclear],[data-tc-give],[data-tc-giver],[data-tc-gxadd],[data-tc-gcancel],[data-tc-gsave]'); if (!t) return;
  const d = t.dataset;
  if (d.tcGive) { tcGive(d.tcGive, t); return; }   // v2.99.74
  if (d.tcGiver != null) { if (!isOwner()) return; tcGEd = { sel: new Set(tcGivers()), staff: [], extra: '' }; tcPaint();   // v2.102.4: ☑ kai godam wale
    if (cloud?.listenStaffList) { let stop = null; stop = cloud.listenStaffList(l => { if (tcGEd) { tcGEd.staff = [...new Set((l || []).filter(x => x && x.active !== false && x.name).map(x => tcClean(x.name)).filter(Boolean))]; tcPaint(); } setTimeout(() => { try { stop && stop(); } catch {} }, 0); }); }
    return; }
  if (d.tcGxadd != null && tcGEd) { const n = tcClean(document.querySelector('[data-tc-gx]')?.value); if (!n) { notice('Naam likhein'); return; } tcGEd.sel.add(n); tcGEd.extra = ''; tcPaint(); return; }
  if (d.tcGcancel != null) { tcGEd = null; tcPaint(); return; }
  if (d.tcGsave != null && tcGEd) { const l = [...tcGEd.sel].map(tcClean).filter(Boolean); if (!l.length) { notice('Kam se kam ek naam'); return; } if (!cloud?.setTcGiver) { notice('App update karein'); return; }
    const v = l.join('|'); cloud.setTcGiver(v).then(() => { itemCfg = { ...itemCfg, tcGiver: v }; tcGEd = null; notice('📦 Godam wale: ' + l.join(', ')); tcPaint(); }).catch(er => notice('Nahi hua: ' + (er?.message || er) + (/permission/i.test(String(er?.message || er)) ? ' — rules 2.58 upload karein' : ''))); return; }
  if (d.tcBulk != null) { tcBulk(); return; }
  if (d.tcSelclear != null) { tcSel.clear(); tcPaint(); return; }
  if (d.tcView) { tcView = d.tcView; if (tcView === 'scan' && tcRes?.type !== 'open') tcRes = null; }
  else if (d.tcD) tcDays = Number(d.tcD);
  else if (d.tcDir) tcDir = d.tcDir;
  else if (d.tcOpen) { if (tcOpen.has(d.tcOpen)) tcOpen.delete(d.tcOpen); else tcOpen.add(d.tcOpen); }
  else if (d.tcCam != null) { const dl = $('dialog'); try { dl.close(); } catch {} scanPick(code => { openTransferCheck('scan'); tcLookup(code); }); return; }
  else if (d.tcRetry != null) { tcLookup(tcCode); return; }
  else if (d.tcOk != null) { tcSave('ok', ''); return; }
  else if (d.tcFarq != null) { tcFarq = true; tcPaint(); document.querySelector('[data-tc-note]')?.focus(); return; }
  else if (d.tcFback != null) tcFarq = false;
  else if (d.tcFsave != null) { tcSave('farq', document.querySelector('[data-tc-note]')?.value || ''); return; }
  else if (d.tcDel) {
    if (!isOwner()) return;
    const c = tcChecks.get(d.tcDel); if (!c) return;
    if (!confirm(`TN ${c.transferNo} ka check (${c.byName} · ${tcClock(c.ts)}) hatana hai?\nYeh sirf ghalti par karein — history mein likha jayega.`)) return;
    cloud?.deleteTransferCheck?.(d.tcDel).then(() => { tcChecks.delete(d.tcDel); try { auditOf?.({ area: 'stock', act: 'tr-check-del', what: `TN ${c.transferNo} ka check hataya (${c.byName})`.slice(0, 120), ref: d.tcDel, refType: 'transfer' }); } catch {} notice('Check hata diya'); tcPaint(); }).catch(er => notice('Nahi hua: ' + (er?.message || er)));
    return;
  }
  tcPaint();
});
// v2.99.74: 📦 step 1 — "maal de diya"
async function tcGive(key, btn) {
  const t = tcAll().find(x => tcKey(x) === key); if (!t || tcBusy) return;
  if (!cloud?.saveTransferCheck) { notice('App update karein'); return; }
  if (!tcCanStep(t, 1)) { notice('🔒 Yeh tick sirf ' + tcSide(t, 1) + ' (apne login se) laga sakta hai'); return; }
  if (tcChecks.get(tcGKey(t))) { notice('Pehle hi tick ho chuka'); return; }
  if (!tcArmed('g:' + key)) { tcArmSet('g:' + key); return; }   // v2.99.78: popup ki jagah doosra tap (3 second)
  tcArm = { k: '', until: 0 };
  const gk = tcGKey(t), d = { transferId: t.transferId, transferNo: t.transferNo, from: t.from, to: t.to, issuedAt: tcIssued(t), status: 'diya', note: '', byName: nameOf() || (isOwner() ? 'Malik' : 'Mulazim'), device: deviceOf(), lines: (t.lines || []).length };
  if (tcRes?.type === 'nogive' && tcRes.t === t) tcRes = tcCanStep(t, 2) ? { type: 'open', t } : null;
  notice('✓ "Maal de diya" — TN ' + (t.transferNo || t.transferId));
  tcFast(gk, d, { onOk: () => { try { auditOf?.({ area: 'stock', act: 'tr-give', what: `TN ${t.transferNo || t.transferId} 📦 maal de diya`.slice(0, 120), ref: gk, refType: 'transfer' }); } catch {} } });   // v2.99.78: ⚡ foran ✓
}
document.addEventListener('change', e => { if (e.target.matches?.('[data-tc-gn]') && tcGEd) { const n = e.target.dataset.tcGn; if (e.target.checked) tcGEd.sel.add(n); else tcGEd.sel.delete(n); tcPaint(); return; } if (e.target.matches?.('[data-tc-tk]')) { const [k, i] = e.target.dataset.tcTk.split('|'), m = tcTk(); if (!m.has(k)) m.set(k, new Set()); const S = m.get(k); if (e.target.checked) S.add(Number(i)); else S.delete(Number(i)); m.delete(k); m.set(k, S); tcTkSave();
    const t = tcAll().find(x => tcKey(x) === k); if (t && tcTkAll(t) && tcOpen.has(k) && !tcChecks.get(k)) tcSel.add(k); else if (t && !tcTkAll(t)) tcSel.delete(k); tcPaint(); return; }
  if (!e.target.matches?.('[data-tc-sel]')) return; const k = e.target.dataset.tcSel, t = tcAll().find(x => tcKey(x) === k);
  if (e.target.checked && t && tcNeedAll() && !tcTkAll(t)) { e.target.checked = false; tcOpen.add(k); notice('☐ Pehle is note ke har item ko gin kar ✓ lagayein'); tcPaint(); return; }
  if (e.target.checked) tcSel.add(k); else tcSel.delete(k); tcPaint(); });
document.addEventListener('submit', e => { if (!e.target.matches?.('[data-tc-form]')) return; e.preventDefault(); tcLookup(e.target.querySelector('[data-tc-code]')?.value || ''); });
document.addEventListener('input', e => { if (e.target.matches?.('[data-tc-code]')) tcCode = e.target.value; });
export function tcBadge(t) {   // 📋 Transfer register ke card par chhota nishan
  if (!tcChecks.size && !tcStop) return '';
  const s = tcState(t);
  return `<i class="tc-mini ${s.k}" title="${s.k === 'ok' ? 'Pahunch gaya' : s.k === 'farq' ? 'Farq' : s.ng ? 'De diya tick nahi' : 'Abhi nahi pahuncha'}">${s.k === 'ok' ? '✓' : s.k === 'farq' ? '⚠️' : s.ng ? '📦' : '⏳'}</i>`;
}

// app.js PDF banata hai — yahan se sirf data
export function inReport() {
  const { groups, pick, names, at } = inRows || {}; if (!groups || !groups.length) return null;
  const cell = (q, pk) => { const x = cp(q, pk); return { c: x.c ? num(x.c) : '0', p: x.p ? num(x.p) : '0' }; };
  return { branch: branchName(pick, names), din: inDays === 1 ? 'Aaj' : inDays + ' din',
    at: new Date(at).toLocaleString('en-PK'),
    groups: groups.map(g => ({ title: g.title, kind: g.kind, red: g.red,
      rows: g.rows.map(r => ({ name: r.name, conf: r.conf, date: dmy(r.at), cName: r.cName, uName: r.uName,
        gaya: cell(r.qty, r.pack),
        from: r.from ? { name: branchName(r.from.b, names), pehle: cell(r.from.pehle, r.pack), ab: cell(r.from.ab, r.pack) } : null,
        to: { name: branchName(r.to.b, names), pehle: cell(r.to.pehle, r.pack), ab: cell(r.to.ab, r.pack) } })) })) };
}
document.addEventListener('keydown', e => { if (e.key !== 'Enter' || !e.target.matches?.('[data-tr-ctn],[data-tr-pcs]')) return; e.preventDefault(); trFocus = { id: null, qty: false }; e.target.blur(); setTimeout(() => { if (trFocus && trFocus.id === null) { trFocus = null; const q = document.querySelector('[data-tr-q]'); trQuiet = true; try { q?.focus(); } catch {} trQuiet = false; } }, 60); });   // v2.99.65: tadad likh kar Enter = wapas search (agla item)
document.addEventListener('pointerdown', e => { const h = document.querySelector('[data-tr-hits]'); if (!h || h.hidden) return; if (e.target.closest?.('[data-tr-hits],[data-tr-q]')) return; h.hidden = true; }, true);   // v2.41: list ke bahar tap = band
// ===== v2.42: transfer note ka camera = Sale wali screen (wahi hooks, wahi list, wahi Tadad/Pcs/Ctn pad) =====
let trRootMark = null, trHooksSaved = null;
const trKey = l => l.k || (l.k = 'tr' + Math.random().toString(36).slice(2, 8));
function trScanOpen() {
  try { $('dialog').close(); } catch {}
  trRootMark = document.createElement('div'); trRootMark.dataset.trRoot = '1'; trRootMark.hidden = true; document.body.appendChild(trRootMark);
  trHooksSaved = { saleHook, saleQtyHook, saleCartHook, saleDelHook, saleFindHook };
  saleDelHook = key => { const i = trLines.findIndex(l => l.k === key); if (i >= 0) trLines.splice(i, 1); };
  saleCartHook = () => trLines.map(l => ({ key: trKey(l), item: { id: l.id, code: l.code || '', name: l.name, pack: Number(l.pack) || 0, cName: l.cName, uName: l.uName, rate: 0, rate2: 0 }, pcs: Number(l.pcs) || 0, ctn: Number(l.ctn) || 0 }));
  saleFindHook = q => smartSearch(collect().items, q, 40).filter(trHas).slice(0, 12).map(r => ({ ...r, stock: trAvail(r.id) }));   // stock = jis godam SE nikal raha hai · v2.99.64: sirf us godam ka majood maal (zero nahi)
  saleQtyHook = (it, q, key) => { const l = (key && trLines.find(x => x.k === key)) || [...trLines].reverse().find(x => String(x.id) === String(it.id)); if (!l) return; l.pcs = Number(q.pcs) || 0; l.ctn = Number(q.ctn) || 0; trCalc(l); };
  saleHook = (code, direct, qty) => {
    const { items, names } = collect(), c = String(code || '').trim();
    const it = direct ? (items.find(x => String(x.id) === String(direct.id)) || direct) : items.find(x => String(x.code).trim() === c || (Array.isArray(x.bc) && x.bc.some(b => String(b).trim() === c)));
    if (!it) return { state: null };
    if (!trHas(it)) { notice(`⚠️ ${it.name} — ${branchName(trFrom, names)} mein stock NAHI, lagaya nahi`); return { state: null }; }
    trRecNote(it.id);
    const l = trAddLine(it); trKey(l);
    if (Number(qty) > 0) { const pk = Number(it.pack) || 0, q = Math.round(Number(qty) * 1000) / 1000; if (pk > 1) { l.ctn = Math.floor(q / pk + 1e-9); l.pcs = Math.round((q - l.ctn * pk) * 1000) / 1000; } else { l.pcs = q; l.ctn = 0; } trCalc(l); }
    const have = trAvail(it.id); if (l.qty > have + 0.0005) notice(`⚠️ ${it.name}: stock ${num(have)} — ${num(l.qty)} nahi ja sakte`);
    return { state: 'added', item: it, line: l.k, pcs: Number(l.pcs) || 0, ctn: Number(l.ctn) || 0 };
  };
  pickHook = null; pickMulti = { done: () => { trRootMark?.remove(); trRootMark = null; padUnit = 'pcs'; if (trHooksSaved) ({ saleHook, saleQtyHook, saleCartHook, saleDelHook, saleFindHook } = trHooksSaved); trHooksSaved = null; openTransfer(); } };
  saleSeen = []; padUnit = 'ctn'; openScanner();   // v2.99.64: transfer mein tadad pehle Ctn
}
function openTransfer() {
  const d = $('dialog'); if (!d) return;
  trZeroShow = false;   // v2.18
  const bs = trBranches();
  if (trFrom == null) trFrom = bs.find(b => b.id !== 1)?.id ?? bs[0]?.id;
  if (trTo == null) trTo = 1;
  d.classList.remove('search-dialog'); d.classList.add('full-dialog');   // v2.99.64: poori screen
  $('dialogTitle').textContent = '⇄ Transfer note';
  const sel = (name, val) => `<select data-tr-${name}>${bs.map(b => `<option value="${b.id}"${b.id === val ? ' selected' : ''}>${esc(b.name)}</option>`).join('')}</select>`;
  const kul = trLines.reduce((s, l) => s + l.qty, 0);
  const names0 = collect().names, gN = esc(branchName(trFrom, names0)), cpTxt = (q, pk, l) => { q = Math.max(0, Number(q) || 0); if (!(pk > 1)) return num(q) + ' ' + esc(l.uName || 'Pcs'); const c = Math.floor(q / pk + 1e-9), p = Math.round((q - c * pk) * 1000) / 1000; return (c ? num(c) + ' ' + esc(l.cName || 'Ctn') : '') + (c && p ? ' + ' : '') + (p || !c ? num(p) + ' ' + esc(l.uName || 'Pcs') : ''); };
  const totC = trLines.reduce((n, l) => n + (Number(l.pack) > 1 ? Number(l.ctn) || 0 : 0), 0), totP = trLines.reduce((n, l) => n + (Number(l.pcs) || 0), 0);
  $('dialogBody').innerHTML = `<div class="tn-root">${trEdit ? `<div class="tn-edit">✏️ <b>Edit — TN ${esc(trEdit.no)}</b><small>Save par purana note cancel ho kar naya banega (naya TN number)</small><button type="button" data-tr-editx="1">✕ Edit chhoro</button></div>` : ''}
    <div class="tn-route"><label class="tn-g from"><small>📤 Se (nikle)</small>${sel('from', trFrom)}</label><span class="tn-arrow">➜</span><label class="tn-g to"><small>📥 Ko (jaye)</small>${sel('to', trTo)}</label></div>
    <div class="tn-find"><div class="scan-find"><input class="scan-q" data-tr-q type="search" placeholder="🔍 ${gN} ka item — naam / code" autocomplete="off"><div class="scan-hits" data-tr-hits hidden></div></div><button type="button" class="tn-scan" data-tr-scan="1">${camMissing() ? '🔫' : '📷'}<small>${camMissing() ? 'Gun' : 'Scan'}</small></button></div>
    <p class="tn-hint">Sirf <b>${gN}</b> ke woh items jin ka stock hai · tadad pehle <b>Ctn</b> mein</p>
    <div class="tn-lines">${trLines.map((l, i) => [l, i]).reverse().map(([l, i]) => { const have = trAvail(l.id); const short = trFrom !== 1 && have < l.qty - 0.0005; const pk = Number(l.pack) || 0; const full = Math.abs(have - l.qty) < 0.0005;
      return `<div class="tn-line${short ? ' short' : ''}"><div class="tn-top"><span class="tn-no">${i + 1}</span><div class="tn-nm"><b>${esc(l.name)}</b><small>📦 ${gN} mein: <b>${cpTxt(have, pk, l)}</b>${pk > 1 ? ' · 1 ' + esc(l.cName || 'Ctn') + ' = ' + num(pk) : ''}${short ? ' · <b class="red">⛔ stock kam</b>' : ''}</small></div><button type="button" class="tn-x" data-tr-del="${i}" aria-label="Hatao">✕</button></div>
      <div class="tn-qty">${pk > 1 ? `<label class="tn-q ctn"><span>${esc(l.cName || 'Ctn')}</span><input type="text" inputmode="decimal" value="${num(l.ctn || 0)}" data-tr-ctn="${i}"></label>` : ''}<label class="tn-q"><span>${esc(l.uName || 'Pcs')}</span><input type="text" inputmode="decimal" value="${num(l.pcs ?? l.qty)}" data-tr-pcs="${i}"></label>
      <button type="button" class="tn-all${full ? ' on' : ''}" data-tr-all="${i}"${have > 0.0005 ? '' : ' disabled'}>⤓ Sara<small>${cpTxt(have, pk, l)}</small></button></div>${pk > 1 ? `<small class="tn-eq">= ${num(l.qty)} ${esc(l.uName || 'Pcs')}</small>` : ''}</div>`; }).join('') || `<div class="tn-empty">⇄<b>Upar se item likhein ya 📷 scan karein</b><small>${gN} ka sirf majood maal dikhega</small></div>`}</div>
    <label class="tn-note">📝 Note<input type="text" data-tr-note maxlength="150" placeholder="ikhtiyari" value="${esc(trNote)}"></label>
    ${trLines.length ? trCopyChips() : ''}
    <div class="tn-bar"><div class="tn-sum"><b>${trLines.length} item</b><small>${[totC ? num(totC) + ' Ctn' : '', totP ? num(totP) + ' Pcs' : ''].filter(Boolean).join(' + ') || '0'}</small></div>${trLines.length ? '<button type="button" class="tn-clear" data-tr-clear="1">Saaf</button>' : ''}<button type="button" class="tn-save primary" data-tr-save="1"${trLines.length ? '' : ' disabled'}>✓ Transfer note banao</button></div>
    <p class="muted tr-msg" style="font-size:.85em"></p>
    <details class="tr-hist tn-hist"><summary>🕘 Pichhle 14 din (app se) — ${trList.length}</summary><div data-tr-hist>${trHistHTML()}</div></details></div>`;
  if (!d.open) d.showModal();
  if (!trStop && cloud?.listenTransfers) trStop = cloud.listenTransfers(list => { trList = list; const h = document.querySelector('[data-tr-hist]'); if (h) h.innerHTML = trHistHTML(); });
  const q = $('dialogBody').querySelector('[data-tr-q]'), hits = $('dialogBody').querySelector('[data-tr-hits]');
  hits.classList.add('sh-hits');   // v2.18: premium rows + chips
  const trFind = () => {
    const raw = q.value, t = norm(raw);
    if (!t) { trShowRecent(hits); return; }
    if (t.length < 2) { hits.hidden = true; return; }
    const { items, names } = collect(), gname = esc(branchName(trFrom, names));
    if (/^[0-9]{8,}$/.test(t)) {   // poora barcode — seedha lag jaye, cursor tadad par
      const exact = items.find(x => String(x.code || '').trim() === t || (Array.isArray(x.bc) && x.bc.some(b => String(b).trim() === t)));
      if (exact) { hits.hidden = true; q.value = ''; trPick(exact, true); return; }
    }
    const all = smartSearch(items, raw, 30, { bonus: r => trRecRank(r.id) });
    const ok = [], zero = [];
    for (const r of all) (trHas(r) ? ok : zero).push(r);
    const list = ok.slice(0, 8);   // v2.99.64: malik — zero stock wala item bilkul nahi (pehle "phir bhi dikhayein" tha)
    trPaint(hits, list, raw, 0, gname);
  };
  q.oninput = () => { trZeroShow = false; clearTimeout(trFindTimer); trFindTimer = setTimeout(trFind, 70); };
  q.onfocus = () => { if (!trQuiet && !norm(q.value)) trShowRecent(hits); };
  hits.onclick = e => {
    if (e.target.closest('[data-tr-close]')) { hits.hidden = true; q.blur(); return; }   // v2.41: ✕ se list band
    if (e.target.closest('[data-tr-zero]')) { trZeroShow = true; trFind(); return; }
    const b = e.target.closest('[data-tr-pick]'); if (!b) return;
    trPick((hits._src || [])[Number(b.dataset.trPick)]);
  };
  q.onkeydown = e => {
    const rows = [...hits.querySelectorAll('[data-tr-pick]')];
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !hits.hidden && rows.length) {
      e.preventDefault();
      const cur = rows.findIndex(b => b.classList.contains('on'));
      trMark(hits, Math.max(0, Math.min(rows.length - 1, (cur < 0 ? -1 : cur) + (e.key === 'ArrowDown' ? 1 : -1))));
      return;
    }
    if (e.key === 'Escape') { hits.hidden = true; return; }
    if (e.key === 'Enter') { e.preventDefault(); clearTimeout(trFindTimer);
      const cur = rows.findIndex(b => b.classList.contains('on'));
      const r = (hits._src || [])[cur < 0 ? 0 : cur]; if (r && !hits.hidden) trPick(r); }
  };
  if (trFocus) {   // item lagne ke baad: barcode wala -> tadad par, warna wapas search par (agla item foran likh sakein)
    const f = trFocus; trFocus = null;
    const i = trLines.findIndex(l => String(l.id) === String(f.id));
    const cell = f.qty && i >= 0 ? ($('dialogBody').querySelector(`[data-tr-ctn="${i}"]`) || $('dialogBody').querySelector(`[data-tr-pcs="${i}"]`)) : null;
    if (cell) { try { hits.hidden = true; cell.focus(); cell.select(); cell.scrollIntoView({ block: 'center' }); } catch {} }
    else { trQuiet = true; try { q.focus(); } catch {} trQuiet = false; }
  }
}
function trCalc(l) { const pk = Number(l.pack) || 0; l.qty = Math.round(((pk > 1 ? (Number(l.ctn) || 0) * pk : 0) + (Number(l.pcs) || 0)) * 1000) / 1000; return l; }
// v2.17: naya item = 1 CTN (carton ho to), warna 1 PCS; wahi dobara aaye to +1 CTN. Naya neeche jurta hai.
function trAddLine(r) { if (!r) return null; const pk = Number(r.pack) || 0; let l = trLines.find(x => String(x.id) === String(r.id));
  if (l) { if (pk > 1) l.ctn = (Number(l.ctn) || 0) + 1; else l.pcs = Math.round(((Number(l.pcs) || 0) + 1) * 1000) / 1000; trCalc(l); }
  else { l = trCalc({ id: r.id, name: r.name, pack: pk, cName: r.cName || 'Ctn', uName: r.uName || 'Pcs', ctn: pk > 1 ? 1 : 0, pcs: pk > 1 ? 0 : 1, qty: 0 }); trLines.push(l); }
  return l; }
function trAdd(r) { if (trAddLine(r)) openTransfer(); }
function trQtyText(l) { const pk = Number(l.pack) || 0; return pk > 1 ? `${num(l.ctn || 0)} ${l.cName || 'Ctn'}${Number(l.pcs) ? ' + ' + num(l.pcs) + ' ' + (l.uName || 'Pcs') : ''}` : `${num(l.pcs || 0)} ${l.uName || 'Pcs'}`; }
function trHistHTML() {
  if (!trList.length) return '<p class="muted">Koi nahi.</p>';
  const names = collect().names;
  return trList.slice(0, 20).map(j => `<div class="tr-hist-row"><div><b>${j.status === 'done' ? (j.op === 'delete' ? 'Hataya' : 'STN ' + esc(j.transferNo || '')) : j.status === 'failed' ? '⚠️ Nahi bana' : '⏳ PC...'}</b> · ${esc(branchName(j.from, names))} → ${esc(branchName(j.to, names))} · ${(j.lines || []).length} items<br><small>${esc(new Date(j.at).toLocaleString('en-PK'))}${j.error ? ' · <span class="red">' + esc(j.error) + '</span>' : ''}${(j.lines || []).slice(0, 4).map(l => ' · ' + esc(l.name) + ' ' + (Number(l.pack) > 1 && (l.ctn || l.pcs != null) ? num(l.ctn || 0) + ' ' + esc(l.cName || 'Ctn') + (l.pcs ? ' + ' + num(l.pcs) + ' ' + esc(l.uName || 'Pcs') : '') : num(l.qty))).join('')}${j.reprints?.length ? ` · <b>dobara print ${j.reprints.length}x</b>` : ''}</small></div>
    ${j.status === 'done' && j.op !== 'delete' ? `<button type="button" data-tr-print="${esc(j.id)}">🖨️</button>${isOwner() && Date.now() - j.at < 86400000 ? `<button type="button" class="danger" data-tr-undo="${esc(j.id)}">🗑️</button>` : ''}` : ''}</div>`).join('');
}
async function trSave(btn) {
  const msg = $('dialogBody').querySelector('.tr-msg'), note = $('dialogBody').querySelector('[data-tr-note]')?.value || '';
  if (trFrom === trTo) { msg.textContent = '⚠️ "Se" aur "Ko" alag godam chunein'; return; }
  const short = trLines.filter(l => trFrom !== 1 && trAvail(l.id) < l.qty - 0.0005);
  if (short.length) { msg.textContent = '⛔ Godam mein stock kam: ' + short.map(l => l.name).join(', '); return; }
  if (!confirm(`${trEdit ? '✏️ EDIT — purana TN ' + trEdit.no + ' cancel ho kar naya banega\n' : ''}${trLines.length} items · ${branchName(trFrom, collect().names)} → ${branchName(trTo, collect().names)}\nPOS mein transfer note banayein?`)) return;
  btn.disabled = true; msg.textContent = '🖥 PC ko ja raha hai…';
  try {
    if (trLines.some(l => !(l.qty > 0))) { msg.textContent = '⚠️ Har item ki tadad 0 se zyada likhein'; return; }
    const ed = trEdit;
    const jid = await cloud.requestTransfer({ op: ed ? 'edit' : 'create', ...(ed ? { transferId: ed.id, force: true, reason: 'Edit' } : {}), copies: trCopies, from: trFrom, to: trTo, lines: trLines.map(l => ({ itemId: l.id, name: l.name, qty: l.qty, ctn: Number(l.ctn) || 0, pcs: Number(l.pcs) || 0, pack: Number(l.pack) || 0, cName: l.cName || 'Ctn', uName: l.uName || 'Pcs' })), note, byName: '' });
    let stop = null, done = false; const t0 = Date.now(), tick = setInterval(() => { if (!done && msg) msg.textContent = `🖥 PC bana raha hai… ${Math.round((Date.now() - t0) / 1000)}s`; }, 1000);   // v2.46: kitna waqt lag raha hai
    const end = (ok, t) => { if (done) return; done = true; clearInterval(tick); try { stop && stop(); } catch {} btn.disabled = false;
      if (ok) { trLines = []; trNote = ''; const was = trEdit; trEdit = null; notice((was ? '✏️ TN ' + was.no + ' badal kar naya ' : '✓ Transfer note ') + t + ' ban gaya (' + Math.round((Date.now() - t0) / 1000) + 's)'); openTransfer(); } else { msg.textContent = '⚠️ ' + t; notice('Transfer nahi bana: ' + t); } };
    stop = cloud.watchTransfer(jid, j => { if (!j) return; if (j.status === 'done') end(true, j.transferNo || ''); else if (j.status === 'failed') end(false, j.error || 'masla'); });
    setTimeout(() => end(false, 'PC se jawab nahi aaya — PC on hai aur transfer-sync chal raha hai? (hukum mehfooz hai)'), 45000);
  } catch (e) { btn.disabled = false; msg.textContent = '⚠️ ' + (e?.message || e); }
}
document.addEventListener('click', e => {
  const t = e.target.closest?.('[data-tr-editx],[data-tr-del],[data-tr-all],[data-tr-save],[data-tr-clear],[data-tr-scan],[data-tr-print],[data-tr-undo]');
  if (!t) return;
  if (t.dataset.trDel) { trLines.splice(Number(t.dataset.trDel), 1); openTransfer(); }
  else if (t.dataset.trAll) { const l = trLines[Number(t.dataset.trAll)]; if (!l) return; const have = trAvail(l.id), pk = Number(l.pack) || 0;   // v2.99.64: ⤓ sara majood stock
    if (!(have > 0.0005)) { notice('Is godam mein stock nahi'); return; }
    if (pk > 1) { l.ctn = Math.floor(have / pk + 1e-9); l.pcs = Math.round((have - l.ctn * pk) * 1000) / 1000; } else { l.ctn = 0; l.pcs = Math.round(have * 1000) / 1000; } trCalc(l); openTransfer(); }
  else if (t.dataset.trClear) { trLines = []; trNote = ''; trEdit = null; openTransfer(); }
  else if (t.dataset.trEditx) { trLines = []; trNote = ''; trEdit = null; openTransfer(); }
  else if (t.dataset.trSave) { const bad = trFrom !== 1 ? trLines.filter(l => l.qty > trAvail(l.id) + 0.0005) : []; if (bad.length) { notice(`⚠️ Stock se zyada: ${bad.slice(0, 3).map(l => l.name + ' (stock ' + num(trAvail(l.id)) + ')').join(', ')}${bad.length > 3 ? ' …' : ''} — pehle theek karein`); return; } trSave(t); }   // v2.42
  else if (t.dataset.trScan) trScanOpen();   // v2.42: Sale wali camera screen (search + Tadad + Pcs/Ctn + list)
  else if (t.dataset.trPrint) {   // v1.75: dobara print — wajah zaroori, note par bara "DOBARA PRINT" chhapta hai
    const j = trList.find(x => x.id === t.dataset.trPrint); const n = (j?.reprints?.length || 0) + 1;
    const reason = prompt(`Dobara print (${n}) ki wajah likhein:`); if (reason == null) return; if (!reason.trim()) { notice('Wajah likhna zaroori hai'); return; }
    const cps = Math.min(3, Math.max(1, Number(prompt('Kitni dafa chhapein? (1-3)', String(trCopies))) || 1));   // v2.43
    t.disabled = true; cloud.requestPrint({ kind: 'transfer', id: t.dataset.trPrint, reason: reason.trim().slice(0, 100), copies: cps }).then(() => notice('🖨️ Dobara print PC ko bheja')).catch(er => notice(er?.message || 'Nahi hua')).finally(() => { t.disabled = false; }); }
  else if (t.dataset.trUndo) { const j = trList.find(x => x.id === t.dataset.trUndo); if (!j || !confirm('Transfer note ' + (j.transferNo || '') + ' POS se hata dein? Dono godam ka stock wapas ho jayega.')) return; t.disabled = true;
    cloud.requestTransfer({ op: 'delete', from: j.from, to: j.to, transferId: j.transferId, lines: j.lines }).then(() => notice('Hatane ka hukum PC ko bheja')).catch(er => notice(er?.message || 'Nahi hua')); }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.matches?.('[data-stock-hdate]')) { if (/^\d{4}-\d{2}-\d{2}$/.test(t.value)) { hDay = t.value; hDayKeep(); limit = PAGE; if (t.closest('#skFilter')) openSkFilter(); rerender(); } return; }   // v2.99.87
  if (t.matches?.('[data-sk-lock]')) { toggleLock(t); return; }
  if (t.matches?.('[data-ginti-sel]')) { if (!gSel) gSel = new Set([...document.querySelectorAll('[data-ginti-sel]')].filter(x => x.checked && x !== t).map(x => x.dataset.gintiSel)); if (t.checked) gSel.add(t.dataset.gintiSel); else gSel.delete(t.dataset.gintiSel); openGinti(); return; }
  if (t.matches?.('[data-sk-auto]')) { setAuto(t.checked, t); return; }
  if (t.matches?.('[data-stock-itemnew]')) {                           // v2.99.86: sirf NAYA item ka switch
    const on = t.checked;
    (cloud?.setItemNew ? cloud.setItemNew(on) : Promise.reject(Error('app update karein')))
      .then(() => { itemCfg = { ...itemCfg, itemNew: on }; notice(on ? '✓ Mulazim ab naya item bana sakta hai (purane ka rate nahi)' : 'Mulazim ab naya item nahi bana sakta'); })
      .catch(err => { t.checked = !on; notice('Nahi hua: ' + (err?.message || err)); });
    return;
  }
  if (t.matches?.('[data-stock-itemedit]')) {                          // v2.5: malik ka switch
    const on = t.checked;
    (cloud?.setItemEdit ? cloud.setItemEdit(on) : Promise.reject(Error('app update karein')))
      .then(() => notice(on ? 'Mulazim ab item aur rates badal sakta hai' : 'Mulazim ab item / rates nahi badal sakta'))
      .catch(err => { t.checked = !on; notice('Nahi hua: ' + (err?.message || err)); });
    return;
  }
  if (t.matches?.('[data-tr-from]')) { trFrom = Number(t.value); openTransfer(); }
  else if (t.matches?.('[data-tr-to]')) { trTo = Number(t.value); openTransfer(); }
  else if (t.matches?.('[data-tr-ctn]')) { const l = trLines[Number(t.dataset.trCtn)]; if (l) { l.ctn = Math.max(0, Math.floor(Number(t.value) || 0)); trCalc(l); } openTransfer(); }
  else if (t.matches?.('[data-tr-pcs]')) { const l = trLines[Number(t.dataset.trPcs)]; if (l) { l.pcs = Math.max(0, Math.round((Number(String(t.value).replace(',', '.')) || 0) * 1000) / 1000); trCalc(l); } openTransfer(); }
});

// v1.45.8: history ab alag khirki (dialog) mein — pehle list ke upar khulti thi aur search bohat neeche chala jata tha
function openBills() {
  const d = $('dialog');
  if (!d) return;
  d.classList.remove('search-dialog');
  $('dialogTitle').textContent = `Farq bills ki history (${num(bills.length)})`;
  $('dialogBody').innerHTML = bills.length ? billsHTML(collect().names) : '<p>Abhi koi farq bill nahi.</p>';
  if (!d.open) d.showModal();
}

function billsHTML(names) {
  const rows = (list, sign) => (list || []).map(x => `<tr><td>${esc(x.name)}</td><td>${num(x.sys)}</td><td>${num(x.count)}</td><td>${sign}${num(x.qty)}</td><td>${num(x.rate)}</td><td>${sign}${num(x.amount)}</td></tr>`).join('');
  const table = (title, list, sign) => (list || []).length ? `<p><b>${esc(title)}</b></p>
    <div style="overflow-x:auto"><table><thead><tr><th>Item</th><th>System</th><th>Ginti</th><th>Farq</th><th>Bhao</th><th>Rs</th></tr></thead>
    <tbody>${rows(list, sign)}</tbody></table></div>` : '';
  return bills.map(b => `<details style="margin:6px 0;padding:8px;border:1px solid #d5e0f2;border-radius:10px">
    <summary><b>Sale ${esc(b.saleNo || '')}${b.returnNo ? ' · Return ' + esc(b.returnNo) : ''}</b>
      · Rs ${num(b.total)} · ${esc(b.doneAt ? new Date(b.doneAt).toLocaleString('en-PK') : '')}
      <small>· Ginti ${esc(b.round || '')} · ${esc(branchName(b.branch, names))}</small></summary>
    ${b.party ? `<p><small>Account: ${esc(b.party)}</small></p>` : ''}
    ${table('Kam nikle — Sale', b.kam, '-')}
    ${table('Zyada nikle — Return', b.zyada, '+')}
    <p>Kam: Rs ${num(b.kamRs)} · Zyada: Rs ${num(b.zyadaRs)} · <b>Kul farq: Rs ${num(b.total)}</b></p>
  </details>`).join('');
}

function flagHTML(r) {
  const f = flagOf(r.id);
  const chk = f.checkedAt ? `<small class="stat-note">✓ Check hua ${esc(stampText(f.checkedAt))}${f.checkedNote ? ' · ' + esc(f.checkedNote) : ''}</small>` : '';
  return `<div class="account-tools sc-flags">
    <button type="button" data-flag-baqi="${esc(r.id)}"${f.baqi ? ' class="selected"' : ''}>⏳ ${f.baqi ? 'Baqi hai — aur likh kar dabayein, ya nishan hatao' : 'Baqi — aur ginna hai (likha hua jama hoga)'}</button>
  </div>${chk}`;
}
function countHTML(r) {
  const c = countOf(pickedBranch, r);
  const diff = c ? Math.round((countedPcs(c) - Number(sysOf(c, r))) * 100) / 100 : 0;
  if (countLocked()) return `<div style="margin:0 4px 14px">${c ? `<small>Ginti ${num(countedPcs(c))}${seeStock() ? ' · Farq ' + (diff > 0 ? '+' : '') + num(diff) : ''}</small><br>` : ''}${flagHTML(r)}</div>${historyHTML(r, c)}`;
  if (!round) return `<div style="margin:0 4px 12px"><small class="stat-note">Ginti abhi band hai — ${isOwner() ? 'upar patte mein "📋 Nayi ginti shuru" dabayein' : 'malik "Nayi ginti shuru" kare'}, phir yahan Save aur ✓ Tick aayenge.</small></div>${historyHTML(r, c)}`;
  return `<div class="pos-dates" style="margin:0 4px 8px">
    <label>Ctn<input type="number" step="any" inputmode="decimal" style="width:4.6em" data-count-ctn="${esc(r.id)}" value="${c ? esc(String(c.ctn ?? '')) : ''}"></label>
    <label>${esc(r.uName || 'Pcs')}<input type="number" step="any" inputmode="decimal" style="width:4.6em" data-count-pcs="${esc(r.id)}" value="${c ? esc(String(c.pcs ?? '')) : ''}"></label>
    <label>Kul ${esc(r.uName || 'Pcs')}<input type="number" step="any" inputmode="decimal" style="width:5.6em" data-count-tot="${esc(r.id)}" value=""></label>
    <button type="button" data-count-save="${esc(r.id)}">Save</button>
    ${seeStock() ? `<button type="button" class="count-tick" data-count-tick="${esc(r.id)}" title="Jitna system mein hai utna hi maal hai">✓ Tick</button>` : ''}
    <div class="count-live" data-count-live="${esc(r.id)}"></div>
    ${c && !seeStock() ? `<small style="align-self:center">✓ Gina ${num(countedPcs(c))} ${esc(r.uName || 'Pcs')} · ${esc(stampText(c.at))}${c.byName ? ' · ' + esc(c.byName) : ''}${(c.history || []).length > 1 ? ' · ✏️ ' + c.history.length + ' dafa' : ''}</small>` : ''}
    ${c && seeStock() ? `<small style="align-self:center">Ginti ${num(countedPcs(c))} · Us waqt system ${num(sysOf(c, r))}${sysSure(c) ? ' ✓' : autoOn ? '' : ' (PC tasdeeq baqi)'} · Farq ${diff > 0 ? '+' : ''}${num(diff)}${
      r.prate ? ' · Rs ' + (diff > 0 ? '+' : '') + num(diff * r.prate) : ''}${(() => { const bi = billOf(r, c); return bi.k === 'done' ? ` · <b class="sk-ok">✓ ${esc(bi.no)}</b>` : bi.k === 'part' ? ` · <b class="sk-w">${esc(bi.no)} (${num(bi.q)}) · baqi</b>` : bi.k === 'baqi' ? ' · <b class="sk-w">bill baqi</b>' : ''; })()}</small>` : ''}
  </div>
  ${flagHTML(r)}
  ${c ? historyHTML(r, c) : oldHistoryHTML(r)}`;
}
// v2.61: is round mein abhi nahi gina — pichhli gintiyon ki history (wahi jo gine hue par neeche aati hai), tap se khule
function oldHistoryHTML(r) {
  const old = counts.get(countId(pickedBranch, r.id));
  const R = hRange(), n = Array.isArray(old?.history) ? old.history.filter(h => hIn(h, R)).length : 0;   // v2.99.87
  if (!n) return '';
  return `<details class="old-hist"><summary>🕘 Pichhli ginti ki history (${n})</summary>${historyHTML(r, old)}</details>`;
}

function historyHTML(r, c) {
  const R = hRange();   // v2.99.87: sirf chune din ki history
  const list = Array.isArray(c?.history) ? c.history.filter(h => hIn(h, R)).reverse() : [];
  if (!list.length) return '';
  return `<div class="stat-note" style="margin:0 4px 12px">${list.map(h => {
    const d = Math.round((Number(h.total) - Number(h.sys)) * 100) / 100;
    const ctn = esc(r.cName || 'Ctn'), pcs = esc(r.uName || 'Pcs');
    const jama = h.tick ? '<b style="color:#0b6b2e">✓ Tick — system jaisa</b> · ' : h.add ? `<b style="color:#0b6b2e">+${num(h.add.ctn)} ${ctn} + ${num(h.add.pcs)} ${pcs}${h.note ? ' (' + esc(h.note) + ')' : ''}</b> → ` : (h.note ? `(${esc(h.note)}) ` : '');
    return `${esc(stampText(h.at))} — ${jama}<b>${num(h.ctn)} ${ctn} + ${num(h.pcs)} ${pcs}</b> · ${num(h.total)} ${pcs} · System ${num(h.sys)} · Farq ${d > 0 ? '+' : ''}${num(d)}${
      r.prate ? ' · Rs ' + (d > 0 ? '+' : '') + num(d * r.prate) : ''}`;
  }).join('<br>')}</div>`;
}

const rowCache = new Map();   // v1.66: label ke liye item
function rowHTML(r) {
  rowCache.set(String(r.id), r);
  const pack = Number(r.pack) || 0;
  const big = pack > 0
    ? `${num(r.ctn)} ${esc(r.cName || 'Ctn')} + ${num(r.pcs)} ${esc(r.uName || 'Pcs')}`
    : `${num(r.stock)} ${esc(r.uName || 'Pcs')}`;

  return `<div class="stock-row${String(r.id) === String(scanHit) ? ' stock-hit' : ''}" data-stock-row="${esc(r.id)}">
    <div class="party" style="border-bottom:0">
    <div class="name">
      <b>${esc(r.name)}</b>
      ${urduOf(r.id) || canEditItem() ? `<span class="ur-name" data-ur-edit="${esc(r.id)}" dir="rtl" title="Urdu naam — tap kar ke badlein">${urduOf(r.id) ? esc(urduOf(r.id)) : '<i>+ Urdu naam</i>'}</span>` : ''}
      <small>${esc(r.code || '')}${pack > 0 ? ` · 1 ${esc(r.cName || 'Ctn')} = ${num(pack)}` : ''}${r.rate ? ' · R ' + num(r.rate) : ''}${r.wrate ? ' · W ' + num(r.wrate) : ''}${seeStock() && r.prate ? ' · Khareed ' + num(r.prate) : ''}</small>
    </div>
    <div class="amount">
      ${seeStock() ? `<strong>${big}</strong>
      <small>${num(r.stock)} ${esc(r.uName || 'Pcs')}</small>` : ''}
      ${r._jama ? `<small class="jama-sum">NT ${r._fac ? `<s>${num(r._nt)}</s> 0` : num(r._nt)} + G2 ${num(r._g2)} = ${num(r.stock)}${r._fac ? ' 🏭' : ''}</small>` : ''}
      <button type="button" class="stock-label-btn" data-stock-label="${esc(r.id)}">🏷️ Label</button>
      ${canEditItem() ? `<button type="button" class="stock-item-btn" data-stock-item="${esc(r.id)}">✏️ Item</button>` : ''}
      ${isOwner() && typeof window.ntFacIs === 'function' ? `<label class="fac-tick"><input type="checkbox" data-fac-tick="${esc(r.id)}"${window.ntFacIs(r) ? ' checked' : ''}> 🏭 Factory</label>` : ''}
      ${isOwner() ? `<label style="display:block;font-size:.85em;white-space:nowrap"><input type="checkbox" style="width:auto" data-stock-hide="${esc(r.id)}"${isHidden(r) ? ' checked' : ''}> Band</label>` : ''}
    </div>
    </div>
    ${countHTML(r)}
  </div>`;
}

// branch aur sort ke buttons
document.addEventListener('click', e => {
  const b = e.target.closest?.('[data-stock-branch]');
  if (b) { branch = Number(b.dataset.stockBranch); godamAll = false; if (branch !== 1) filter = 'has'; limit = PAGE; rerender(); return; }   // v2.82: 0 = jama (filter has)   // v1.95/97: godam kholte hi sirf USI godam ka stock
  if (e.target.closest?.('[data-stock-scan]')) { openScanner(); return; }
  { const u = e.target.closest?.('[data-ur-edit]'); if (u && canEditItem()) { const id = u.dataset.urEdit; const cur = urduOf(id); const v = prompt('Urdu naam (label par English ke saath aayega):', cur); if (v === null) return; cloud.setUrdu({ [id]: String(v).trim() }).then(() => { urdu[id] = String(v).trim(); notice('✓ Urdu naam save'); soft(); }).catch(er => notice('Nahi hua: ' + (er?.message || er))); return; } }
  if (e.target.closest?.('[data-stock-urdu]')) {
    if (urduBusy) { notice('Pehle wala kaam chal raha hai…'); return; }
    const { items } = collect(); const miss = items.filter(r => !urduOf(r.id)).length;
    if (!miss) { notice('Sab items ke Urdu naam pehle se hain'); return; }
    if (!confirm(`${miss} items ke Urdu naam AI se banayein? (sirf jin ka nahi hai — ${Math.ceil(miss / 60)} dafa AI chalega)`)) return;
    urduBusy = true; notice('🔤 AI se Urdu naam ban rahe hain…');
    urduMake(items, true).then(n => notice(`✓ ${n} Urdu naam ban gaye — ghalat ho to naam par tap kar ke theek karein`)).catch(er => notice('Nahi hua: ' + (er?.message || er))).finally(() => { urduBusy = false; soft(); });
    return;
  }
  if (e.target.closest?.('[data-stock-ijobs]')) { ijDlg(); return; }   // v2.99.91
  { const ie = e.target.closest?.('[data-ij-edit],[data-ij-cancel]');   // v2.99.92
    if (ie) { const j = ijobs.find(x => x.id === (ie.dataset.ijEdit || ie.dataset.ijCancel)); if (!j) return;
      if (j.status !== 'new') { notice('⚙️ PC bana raha hai — ab nahi badal sakta'); return; }
      if (ie.dataset.ijEdit) { itemForm(null, { name: j.name || '', code: j.code || '', pack: Number(j.pack) || 0, costP: Number(j.costP) || 0, rctn: Number(j.rctn) || 0, rpcs: Number(j.rpcs) || 0, wctn: Number(j.wctn) || 0, wpcs: Number(j.wpcs) || 0 }, j.id); return; }
      if (!confirm(`"${j.name}" cancel karna hai? PC isay kabhi nahi banayega.`)) return;
      Promise.resolve(cloud?.cancelItemJob?.(j.id)).then(() => { notice('✕ ' + j.name + ' cancel'); window.ntFacPendDel?.(j.id); }).catch(er => notice('Nahi hua: ' + (er?.code === 'permission-denied' ? 'ijazat nahi (rules 2.54?)' : (er?.message || er))));
      return; } }
  const ib = e.target.closest?.('[data-stock-item],[data-stock-newitem],[data-item-close]');
  if (ib) { const d = ib.dataset;
    if (d.itemClose != null) $('dialog')?.close();
    else if (d.stockNewitem != null) { if (canNewItem()) itemForm(null, null); else notice('🔒 Naya item — malik ki ijazat chahiye'); }
    else itemForm(rowCache.get(String(d.stockItem)), null);
    return; }
  const isc = e.target.closest?.('[data-item-scan]');
  if (isc) { const form = isc.closest('form'), id = form.dataset.itemForm, v = itemRead(form);
    itemDraft.set(id, v); scanPick(code => { const r = id === 'new' ? null : rowCache.get(String(id)); itemForm(r, { ...itemDraft.get(id), code }); }); return; }
  if (e.target.closest?.('[data-stock-mic]')) {   // v2.4.5: awaz se search (sale jaisa)
    const ok = voiceSearch(t => { const s = $('search'); if (s) { s.value = t; s.dispatchEvent(new Event('input', { bubbles: true })); } });
    if (!ok) alert('Is phone/browser mein awaz se search nahi chalti'); return;
  }
  if (e.target.closest?.('[data-stock-clear]')) { clearScan(); return; }
  const sa = e.target.closest?.('[data-scan-saveall]');
  if (sa) { saveAll(sa); return; }
  const hb = e.target.closest?.('[data-stock-hide]');
  if (hb) {   // v2.94.0: 🔒 Band par password (default 7183; stockConfig.bandPw se badal sakte hain) — on aur off dono
    const want = String(itemCfg.bandPw || '7183'), got = prompt((hb.checked ? 'Item BAND karne' : 'Item dobara CHALU karne') + ' ka password:');
    if (got === null || got !== want) { hb.checked = !hb.checked; if (got !== null) notice('❌ Password ghalat'); return; }
    toggleHidden(hb.dataset.stockHide, hb.checked, hb); return; }
  if (e.target.closest?.('[data-stock-more]')) { limit += PAGE; rerender(); return; }
  if (e.target.closest?.('[data-stock-bills]')) { openBills(); return; }
  if (e.target.closest?.('[data-stock-ginti]')) { openGinti(); return; }
  if (e.target.closest?.('[data-sk-set]')) { openSkSet(); return; }   // v2.101.1: nayi stock screen
  if (e.target.closest?.('[data-sk-filter]')) { openSkFilter(); return; }
  if (e.target.closest?.('[data-sk-close]')) { $('dialog')?.close(); return; }
  if (e.target.closest?.('[data-sk-reset]')) { filter = 'all'; hDay = ''; hDayKeep(); sort = 'name'; limit = PAGE; $('dialog')?.close(); rerender(); return; }
  if (e.target.closest?.('[data-sk-auto-on]')) { setAuto(true); return; }
  const gr = e.target.closest?.('[data-ginti-row]'); if (gr) { openRecount(gr.dataset.gintiRow); return; }
  const gfb = e.target.closest?.('[data-ginti-f]'); if (gfb) { gf = gfb.dataset.gintiF; openGinti(); return; }
  const gb = e.target.closest?.('[data-ginti-bill]'); if (gb) { gintiBill(gb.dataset.gintiBill); return; }
  if (e.target.closest?.('[data-ginti-selall]')) { gSel = null; openGinti(); return; }
  if (e.target.closest?.('[data-ginti-selnone]')) { gSel = new Set(); openGinti(); return; }
  if (e.target.closest?.('[data-re-save]')) { reSave(); return; }
  if (e.target.closest?.('[data-re-del]')) { reDel(); return; }
  if (e.target.closest?.('[data-stock-transfer]')) { openTransfer(); return; }
  if (e.target.closest?.('[data-stock-in]')) { openIn(true); return; }
  if (e.target.closest?.('[data-ginti-pdf]')) { gintiPdfOf?.(); return; }       // v2.13
  if (e.target.closest?.('[data-stock-tolai]')) { tolaiOf?.(); return; }        // v2.7
  if (tolaiClickOf && tolaiClickOf(e)) return;          // v2.6
  const inb = e.target.closest?.('[data-in-d],[data-in-k],[data-in-red],[data-in-item],[data-in-count],[data-in-pdf],[data-in-close]');
  if (inb) { const d = inb.dataset;                                   // v2.6: aaya hua maal
    if (d.inD != null) { inDays = Number(d.inD); openIn(true); }
    else if (d.inK != null) { inKind = d.inK; openIn(true); }
    else if (d.inRed != null) { inFilter = !inFilter; openIn(false); }
    else if (d.inClose != null) $('dialog')?.close();
    else if (d.inPdf != null) inPdfOf?.();
    else if (d.inCount != null) { const ids = (inRows?.groups || []).flatMap(g => g.rows).filter(r => !inFilter || r.conf !== 'g').map(r => r.id); inPick = new Set(ids); $('dialog')?.close(); const q = $('search'); if (q) q.value = ''; rerender(); }
    else if (d.inItem != null) { const r = (inRows?.groups || []).flatMap(g => g.rows).find(x => x.id === d.inItem); $('dialog')?.close(); const q = $('search'); if (q && r) { q.value = r.name; q.dispatchEvent(new Event('input', { bubbles: true })); } rerender(); setTimeout(() => document.querySelector(`[data-stock-row="${d.inItem}"] input`)?.focus(), 200); }
    return; }
  if (e.target.closest?.('[data-in-clear]')) { inPick = null; rerender(); return; }
  const lb = e.target.closest?.('[data-stock-label]');
  if (lb) { openLabels(lb.dataset.stockLabel); return; }
  const lp = e.target.closest?.('[data-label-print]');
  if (lp) { printLabel(lp); return; }
  const s = e.target.closest?.('[data-stock-sort]');
  if (s) { sort = s.dataset.stockSort; if (s.closest('#skFilter')) openSkFilter(); rerender(); return; }
  const f = e.target.closest?.('[data-stock-filter]');
  if (f) { filter = f.dataset.stockFilter; if (filter === 'all') godamAll = true; limit = PAGE; if (f.closest('#skFilter')) $('dialog')?.close(); rerender(); return; }
  const hd = e.target.closest?.('[data-stock-hday]');   // v2.99.87: history ke din
  if (hd) { hDay = hd.dataset.stockHday || ''; hDayKeep(); if (!hDay && filter === 'hday') filter = 'all'; limit = PAGE; if (hd.closest('#skFilter')) openSkFilter(); rerender(); return; }

  const nr = e.target.closest?.('[data-stock-round]');
  if (nr) { startNewRound(); return; }
  if (e.target.closest?.('[data-stock-post]')) { requestPost(); return; }
  if (e.target.closest?.('[data-stock-approve]')) { answerPost(true); return; }
  if (e.target.closest?.('[data-stock-cancelpost]')) { answerPost(false); return; }

  const tk = e.target.closest?.('[data-count-tick]');
  if (tk) { try { noteHit(tk.dataset.countTick); } catch {} tickCount(tk.dataset.countTick, tk); return; }   // v2.4.5: search mein aage
  const sv = e.target.closest?.('[data-count-save]');
  if (sv) { try { noteHit(sv.dataset.countSave); } catch {} saveCount(sv.dataset.countSave, sv); return; }
  const ad = e.target.closest?.('[data-count-add]');
  if (ad) { saveCount(ad.dataset.countAdd, ad, 'baqi'); return; }
  const fb = e.target.closest?.('[data-flag-baqi]');
  if (fb) { const it = collect().items.find(r => String(r.id) === fb.dataset.flagBaqi); const v = it ? readCount(it, false) : null; if (v && !v.bad && v.total > 0) saveCount(fb.dataset.flagBaqi, fb, 'baqi'); else setFlag(fb.dataset.flagBaqi, { baqi: !flagOf(fb.dataset.flagBaqi).baqi }); return; }
  const fc = e.target.closest?.('[data-flag-check]');
  if (fc) { setFlag(fc.dataset.flagCheck, { check: !flagOf(fc.dataset.flagCheck).check }); return; }
  const fd = e.target.closest?.('[data-flag-checked]');
  if (fd) { setFlag(fd.dataset.flagChecked, { check: false, checkedAt: Date.now() }); notice('✓ Check ho gaya'); return; }
  if (e.target.closest?.('[data-stock-lock]')) { toggleLock(); return; }
});

async function setFlag(id, patch) {
  if (!cloud?.setStockFlag) return;
  try { await cloud.setStockFlag(String(id), { ...flagOf(id), ...patch }); }
  catch (e) { itemMsg(id, '⚠️ Nishan save nahi hua: ' + errTxt(e)); }
}
async function setAuto(on, box) {
  if (!isOwner() || !cloud?.setStockAuto) { if (box) box.checked = !on; notice('App update karein'); return; }
  if (!confirm(on ? 'Ginti ka session = din? Roz nayi ginti khud shuru hogi ("Nayi ginti shuru" nahi dabana parega). Bill aap khud items chun kar banayenge.' : 'Band karein? Phir "Nayi ginti shuru" haath se dabana hoga.')) { if (box) box.checked = !on; return; }
  try { await cloud.setStockAuto(on); if (on && countOff && cloud.setStockLock) { try { await cloud.setStockLock(false); } catch {} } if (on && cloud.setStockRound) { try { await cloud.setStockRound(dayStr()); } catch {} } notice(on ? '✓ Session = din — aaj ki ginti shuru' : 'Band — nayi ginti haath se'); if ($('skSet')) openSkSet(); else $('dialog')?.close(); }
  catch (e) { if (box) box.checked = !on; notice('Nahi hua: ' + errTxt(e)); }
}
async function toggleLock(box) {
  if (!isOwner() || !cloud?.setStockLock) { if (box) box.checked = !box.checked; return; }
  const off = !countOff;
  if (!confirm(off ? 'Counting OFF karein? Mulazim koi ginti save nahi kar sakega (nishan laga sakega).' : 'Counting ON karein? Mulazim phir ginti save kar sakega.')) { if (box) box.checked = !box.checked; return; }
  try { await cloud.setStockLock(off); notice(off ? 'Counting OFF' : 'Counting ON'); if ($('skSet')) setTimeout(openSkSet, 400); }
  catch (e) { if (box) box.checked = !box.checked; notice(e?.message || 'Nahi hua'); }
}

function postLine(pick) {
  const p = postReq;
  if (!p || p.round !== round || p.branch !== pick) return '';
  const when = p.doneAt || p.previewAt || p.at;
  const t = when ? new Date(when).toLocaleString('en-PK') : '';
  if (p.status === 'preview' && p.preview) {
    const v = p.preview;
    const rows = (list, sign) => list.map(x => `<tr><td>${esc(x.name)}</td><td>${sign}${num(x.qty)}</td><td>${num(x.rate)}</td><td>${sign}${num(x.amount)}</td></tr>`).join('');
    const table = (title, list, sign) => list.length ? `<p><b>${esc(title)}</b></p>
      <div style="overflow-x:auto"><table><thead><tr><th>Item</th><th>Qty</th><th>Bhao</th><th>Rs</th></tr></thead>
      <tbody>${rows(list, sign)}</tbody></table></div>` : '';
    const lateS = (v.skipped || []).filter(x => x.late), othS = (v.skipped || []).filter(x => !x.late);
    const skipped = (lateS.length ? `<div class="fq-warn">🧾 <b>${num(lateS.length)} items dobara ginne baqi — bill mein shamil nahi:</b> ${esc(lateS.map(x => x.name).join(', '))}</div>` : '')
      + (othS.length ? `<p><small>Chhor diye: ${esc(othS.map(x => x.name).join(', '))}</small></p>` : '');
    return `<div style="margin:8px 0;padding:10px;border:1px solid #9bb7e8;border-radius:10px">
      <p><b>PC ne bill ki list bheji hai — account ${esc(v.party || '')}</b></p>
      ${p.note ? `<p><small><b>${esc(p.note)}</b></small></p>` : ''}
      ${table('Kam nikle — Sale (stock kam hoga)', v.kam || [], '-')}
      ${table('Zyada nikle — Return (stock barhega)', v.zyada || [], '+')}
      ${skipped}
      <p>Kam: Rs ${num(v.kamRs)} · Zyada: Rs ${num(v.zyadaRs)}<br><b>Kul farq: Rs ${num(v.total)}</b></p>
      ${isOwner() ? `<div class="account-tools">
        <button data-stock-approve="1" class="selected">Bill banao</button>
        <button data-stock-cancelpost="1">Cancel</button></div>`
        : '<p><small>Bill sirf malik bana sakta hai</small></p>'}
      <small>${esc(t)}</small></div>`;
  }
  const msg = {
    pending: 'PC ko bheja gaya — PC list tayyar kar raha hai (PC chalu hona chahiye)',
    approved: 'OK ho gaya — PC bill bana raha hai…',
    posting: 'PC bill bana raha hai…',
    done: `PC par bill ban gaya: Sale No ${p.saleNo || ''}${p.returnNo ? ' · Return No ' + p.returnNo : ''} · Kul farq Rs ${num(p.total)} · ${num(p.lines)} items`,
    nothing: 'PC ne dekha: bill banane ke liye koi naya farq wala item nahi',
    cancelled: 'Bill cancel kar diya gaya',
    failed: 'PC par bill nahi bana: ' + (p.error || '')
  }[p.status] || '';
  return msg ? `<div class="account-tools"><small><b>${esc(msg)}</b>${t ? ' · ' + esc(t) : ''}</small></div>` : '';
}

async function answerPost(ok) {
  const p = postReq;
  if (!cloud?.requestFarqPost || !p || p.status !== 'preview') return;
  const v = p.preview || {};
  if (ok && !confirm(`POS mein bill ban jayega.\nKul farq: Rs ${num(v.total)}\nPakka?`)) return;
  const { id, ...rest } = p;
  try {
    await cloud.requestFarqPost(ok
      ? { ...rest, status: 'approved', approvedAt: Date.now() }
      : { round: p.round, branch: p.branch, at: p.at, status: 'cancelled', doneAt: Date.now() });
    notice(ok ? 'PC ko OK bhej diya' : 'Cancel kar diya');
  } catch (e) { notice(e?.message || 'Nahi hua'); }
}

async function requestPost() {
  if (!cloud?.requestFarqPost || !round) return;
  const r = stockReport();
  const kam = r.rows.filter(x => x.d < -0.001);
  const zyada = r.rows.filter(x => x.d > 0.001);
  if (!kam.length && !zyada.length) { notice('Koi farq wala item nahi'); return; }
  if (!confirm(`PC par bill banana hai?\nKam nikle: ${kam.length} items (Rs ${num(-r.kamRs)}) — Sale\nZyada nikle: ${zyada.length} items (Rs ${num(r.zyadaRs)}) — Return\nList thori der mein yahin aa jayegi.`)) return;
  try {
    await cloud.requestFarqPost({ round, branch: pickedBranch, status: 'pending', at: Date.now() });
    notice('PC ko bhej diya — list thori der mein yahin aayegi');
  } catch (e) { notice(e?.message || 'Nahi bheja ja saka'); }
}

async function toggleHidden(id, on, box) {
  if (!cloud?.setStockHidden || !isOwner()) { box.checked = !on; return; }
  const item = collect().items.find(r => String(r.id) === String(id));
  const nm = item ? item.name : 'Yeh item';
  const stk = item ? `\nAbhi stock: ${num(item.stock)} ${item.uName || 'Pcs'}` : '';
  const msg = on
    ? `"${nm}" BAND karein?${stk}\n\nPC par POS mein is ka stock 0 ho jayega (stock fraq ka bill banega) aur item INACTIVE ho jayega.`
    : `"${nm}" ko wapas chalu karein?\n\nPOS mein item dobara ACTIVE ho jayega (stock 0 hi rahega).`;
  if (!confirm(msg)) { box.checked = !on; return; }
  const next = { ...hidden };
  if (on) next[String(id)] = true; else delete next[String(id)];
  box.disabled = true;
  try {
    await cloud.setStockHidden(next);
    hidden = next;
    notice(on ? 'Item band — list se hat gaya ("Band items" mein milega)' : 'Item wapas list mein');
    rerender();
  } catch (e) { box.checked = !on; notice(e?.message || 'Nahi hua'); }
  finally { box.disabled = false; }
}

async function startNewRound() {
  if (!cloud?.setStockRound) return;
  // v1.67: waqt bhi saath, taake ek hi din mein nayi ginti purani se alag rahe
  const n = new Date(), p2 = x => String(x).padStart(2, '0');
  const label = `${n.getFullYear()}-${p2(n.getMonth() + 1)}-${p2(n.getDate())} ${p2(n.getHours())}:${p2(n.getMinutes())}`;
  if (!confirm('Nayi ginti shuru karein? Purani ginti ki list saaf ho jayegi (bills ki history rehti hai).')) return;
  try { $('dialog')?.open && $('dialog').close(); } catch {}
  try { await cloud.setStockRound(label); let on = ''; if (countOff && cloud.setStockLock) { try { await cloud.setStockLock(false); on = ' · 🟢 Counting ON (mulazim ginti kar sakte hain)'; } catch {} } notice('Nayi ginti shuru — ' + label + on); }
  catch (e) { notice(e?.message || 'Nahi hua'); }
}

// v2.99.14: GINTI KA HAAL SAAF — malik: "sirf mulazim ki stock screen par masla". Mulazim ko pata hi nahi chalta tha ke ginti kyun save
//   nahi ho rahi (counting OFF / nayi ginti shuru nahi) — sirf chhota notice. Ab: upar bara patta + haal ki line; har item ke neeche
//   laal / hara paigham (asal ghalti bhi: ijazat / internet). Malik ko counting OFF par ek tap se ON.
function countBanner() {
  const own = isOwner(), ver = ((document.querySelector('.storage')?.textContent || '').match(/v\d+\.\d+\.\d+/) || [''])[0];
  let big = '';
  const nb = own && !round ? '<button type="button" data-stock-round="new">📋 Nayi ginti shuru</button><button type="button" data-sk-auto-on="1">📅 Session = din (khud)</button>' : '';
  if (own && countOff) big = `<div class="sc-banner bad"><b>🔴 Counting OFF hai</b><small>Mulazim ginti, Save aur ✓ Tick nahi kar sakte (sirf ⏳ Baqi ka nishan).</small><span class="sc-bb"><button type="button" data-stock-lock="1">🟢 Counting ON karo</button>${nb}</span></div>`;
  else if (!own && countOff) big = `<div class="sc-banner bad"><b>🔴 Malik ne counting band ki hui hai</b><small>Abhi ginti / Save / ✓ Tick nahi ho sakti — sirf ⏳ Baqi ka nishan lag sakta hai. Malik se "Counting ON" karwayein.</small></div>`;
  else if (!round) big = `<div class="sc-banner warn"><b>⏳ Abhi nayi ginti shuru nahi hui</b><small>${own ? 'Neeche ka button dabayein — phir aap aur mulazim ginti kar sakenge.' : 'Malik Stock screen par "Nayi ginti shuru" dabaye — phir ginti save hogi.'}</small>${nb ? `<span class="sc-bb">${nb}</span>` : ''}</div>`;
  return `<div class="sc-top">` + big + `<div class="sc-state"><span>${own ? '👑 Malik' : '👤 Mulazim'}</span><span>📋 ${round ? 'Ginti ' + esc(round) : 'Ginti shuru nahi'}</span><span class="${countOff ? 'bad' : 'good'}">${countOff ? '🔴 Counting OFF' : '🟢 Counting ON'}</span>${ver ? `<span>${esc(ver)}</span>` : ''}</div></div>`;
}
const errTxt = e => { const m = String(e?.message || e || ''); return /permission|insufficient/i.test(m) ? 'Ijazat nahi mili (permission) — malik se is login ki Stock ijazat check karwayein' : /offline|network|unavailable|failed to fetch/i.test(m) ? 'Internet nahi — net check kar ke dobara' : m || 'Save nahi hua'; };
function itemMsg(id, text, ok = false) {
  const sel = CSS.escape(String(id)), list = $('list');
  const anchor = list?.querySelector(`[data-count-live="${sel}"]`) || list?.querySelector(`[data-flag-baqi="${sel}"]`)?.closest('.sc-flags');
  notice(text);
  if (!anchor) return;
  let m = list.querySelector(`.sc-msg[data-for="${sel}"]`);
  if (!m) { m = document.createElement('p'); m.dataset.for = String(id); anchor.insertAdjacentElement('afterend', m); }
  m.className = 'sc-msg ' + (ok ? 'ok' : 'bad'); m.textContent = text;
  if (!ok) { try { navigator.vibrate?.(120); } catch {} }
}
// Ek item ke khanon se ginti parho. skipBlank=true: teeno khane khali hon to null
function readCount(item, skipBlank) {
  const id = CSS.escape(String(item.id));
  const box = sel => $('list').querySelector(`[data-count-${sel}="${id}"]`);
  const per = Number(item.pack) || 0;
  const rawTot = (box('tot')?.value ?? '').trim();
  const rawCtn = (box('ctn')?.value ?? '').trim();
  const rawPcs = (box('pcs')?.value ?? '').trim();
  if (skipBlank && rawTot === '' && rawCtn === '' && rawPcs === '') return null;
  let ctn, pcs, total;
  if (rawTot !== '') {
    // Sirf kul pieces likhe gaye — carton khud ban jayega
    total = Math.round(Number(rawTot) * 100) / 100;
    ctn = per > 1 ? Math.floor(total / per) : 0;
    pcs = Math.round((total - ctn * (per > 1 ? per : 0)) * 100) / 100;
  } else {
    ctn = Number(rawCtn || 0);
    pcs = Number(rawPcs || 0);
    total = Math.round((ctn * (per > 0 ? per : 1) + pcs) * 100) / 100;
  }
  return { ctn, pcs, total, bad: !Number.isFinite(total) || !Number.isFinite(ctn) || !Number.isFinite(pcs) };
}

async function writeCount(item, v, add = null, tick = false, br = pickedBranch) {
  const at = Date.now();
  const old = counts.get(countId(br, item.id));
  const past = Array.isArray(old?.history) ? old.history : [];
  const h = { at, ctn: v.ctn, pcs: v.pcs, total: v.total, sys: item.stock };
  if (add) { h.add = { ctn: add.ctn, pcs: add.pcs, total: add.total }; if (add.note) h.note = add.note; }
  if (tick) h.tick = true;
  const history = [...past, h].slice(-20);
  // v2.99.58: ginti ke baad bill bana tha (later) aur ab dobara gina = recount (farq bill mein ab shamil ho sakta hai)
  const re = !!(old && (old.recount || (Array.isArray(old.later) && old.later.length)));
  // v2.101.1: auto — sys0 = is din ki pehli ginti ke waqt ka system (farq isi se); PC ka pfQ (ab tak POS mein gaya) wahi rahe
  const same = old && old.round === round && !old.del, sys0 = same && old.sys0 != null ? old.sys0 : item.stock;
  await cloud.saveStockCount({
    id: countId(br, item.id),
    round, branch: br, itemId: item.id,
    name: item.name, sys: item.stock,
    ctn: v.ctn, pcs: v.pcs, total: v.total, at, history, ...(re ? { recount: true, recountAt: at } : {}),
    ...(autoOn ? { auto: true, day: round, sys0, del: false } : {}), byName: whoName()
  });
}

const zeroText = item => {
  const gap = -Number(item.stock || 0);
  const rs = item.prate ? ` (Rs ${num(gap * item.prate)})` : '';
  return `System mein: ${num(item.stock)} ${item.uName || 'Pcs'} · Farq: ${gap > 0 ? '+' : ''}${num(gap)}${rs}`;
};

// v1.76 (malik ki hidayat): "⏳ Baqi — aur ginna hai" = jo likha hai save + pichhli mein JAMA + nishan + khane saaf;
// phir "Save" = likha hua pichhli (baqi) ginti mein jama karke FINAL, nishan hat jata hai. Nishan na ho to Save = pehle jaisa (badal deta hai).
async function saveCount(itemId, button, mode = 'save') {
  if (!round) { itemMsg(itemId, isOwner() ? '⏳ Pehle upar patte mein "📋 Nayi ginti shuru" dabayein' : '⏳ Malik ne abhi nayi ginti shuru nahi ki — ginti save nahi hogi'); return; }
  if (countLocked()) { itemMsg(itemId, '🔴 Malik ne counting band ki hui hai — ginti save nahi hogi (malik se ON karwayein)'); return; }
  const { items } = collect();
  const item = items.find(r => String(r.id) === String(itemId));
  if (!item) return;
  let v = readCount(item, false), add = null;
  if (v.bad) { itemMsg(itemId, 'Ginti sahi likhein (sirf hindse)'); return; }
  const old = countOf(pickedBranch, item);
  const baqi = flagOf(item.id).baqi;
  const jama = (mode === 'baqi' && old) || (mode === 'save' && baqi && old);
  if (mode === 'baqi' && v.total === 0 && !old) { itemMsg(itemId, 'Pehle ginti likhein, phir "⏳ Baqi"'); return; }
  if (jama && v.total > 0) {
    const per = Number(item.pack) || 0;
    const total = Math.round((countedPcs(old) + v.total) * 1000) / 1000;
    const ctn = per > 1 ? Math.floor(total / per) : 0;
    const pcs = Math.round((total - ctn * (per > 1 ? per : 0)) * 1000) / 1000;
    add = { ...v, note: '' };
    v = { ctn, pcs, total, bad: false };
  } else if (jama && v.total === 0 && mode === 'save') {
    v = { ctn: Number(old.ctn) || 0, pcs: Number(old.pcs) || 0, total: countedPcs(old), bad: false };   // kuch nahi likha: pichhli ginti hi final
  }
  if (!staleOk()) return;
  if (v.total === 0 && !confirm(`"${item.name}" ki ginti ZERO save karein?\n\n${zeroText(item)}`)) return;
  button.disabled = true;
  try {
    if (!(mode === 'save' && jama && v.total === countedPcs(old) && !add)) await writeCount(item, v, add);
    if (mode === 'baqi') { if (!baqi) await setFlag(item.id, { baqi: true }); const id = CSS.escape(String(item.id)); ['ctn', 'pcs', 'tot'].forEach(k => { const b = $('list').querySelector(`[data-count-${k}="${id}"]`); if (b) b.value = ''; }); }
    else if (baqi) await setFlag(item.id, { baqi: false });
    itemMsg(item.id, '✓ ' + item.name + (mode === 'baqi' ? ` — ab tak ${num(v.total)} ${item.uName || 'Pcs'} (baqi ginna hai)` : add ? ` — jama: kul ${num(v.total)} ${item.uName || 'Pcs'}` : ` — ginti save (${num(v.total)} ${item.uName || 'Pcs'})`), true);
  } catch (e) {
    itemMsg(itemId, '⚠️ Ginti save nahi hui: ' + errTxt(e));
  } finally {
    button.disabled = false;
  }
}

// v1.97: ✓ Tick — "jitna system mein hai utna hi maal hai": system stock ko hi ginti maan kar save; history mein "✓ Tick" line
async function tickCount(itemId, button) {
  if (!round) { itemMsg(itemId, isOwner() ? '⏳ Pehle upar patte mein "📋 Nayi ginti shuru" dabayein' : '⏳ Malik ne abhi nayi ginti shuru nahi ki — tick save nahi hoga'); return; }
  if (countLocked()) { itemMsg(itemId, '🔴 Malik ne counting band ki hui hai — tick save nahi hoga (malik se ON karwayein)'); return; }
  const item = collect().items.find(r => String(r.id) === String(itemId));
  if (!item) return;
  // v2.95.6: khanon mein ginti likhi ho to Tick = wahi ginti Save (farq ke saath history mein), system jaisa NAHI
  { const typed = readCount(item, true); if (typed && !typed.bad) { await saveCount(itemId, button); return; } }
  const sys = Math.round((Number(item.stock) || 0) * 1000) / 1000;
  if (sys < 0) { itemMsg(itemId, `System mein stock minus (${num(sys)}) hai — tick nahi hota, asal ginti likh kar Save karein`); return; }
  const per = Number(item.pack) || 0;
  const ctn = per > 1 ? Math.floor(sys / per + 1e-9) : 0;
  const pcs = Math.round((sys - ctn * (per > 1 ? per : 0)) * 1000) / 1000;
  const old = countOf(pickedBranch, item);
  if (old && countedPcs(old) !== sys && !confirm(`"${item.name}" ki pehle ginti ${num(countedPcs(old))} hai.\nTick se ginti system jaisi ${num(sys)} ho jayegi — theek?`)) return;
  if (sys === 0 && !confirm(`"${item.name}" — system mein 0 hai. Tick = ginti ZERO. Theek?`)) return;
  if (!staleOk()) return;
  button.disabled = true;
  try {
    await writeCount(item, { ctn, pcs, total: sys, bad: false }, null, true);
    if (flagOf(item.id).baqi) await setFlag(item.id, { baqi: false });
    itemMsg(item.id, `✓ ${item.name} — system jaisa ${num(sys)} ${item.uName || 'Pcs'} (tick)`, true);
  } catch (e) { itemMsg(itemId, '⚠️ Tick save nahi hua: ' + errTxt(e)); }
  finally { button.disabled = false; }
}

// Scan list ke sab items ek dafa save (jin ki ginti likhi hai aur badli hai)
async function saveAll(button) {
  if (countLocked()) { notice('🔴 Malik ne counting band ki hui hai — ginti save nahi hogi (malik se ON karwayein)'); return; }
  if (!round) { notice(isOwner() ? '⏳ Pehle upar patte mein "📋 Nayi ginti shuru" dabayein' : '⏳ Malik ne abhi nayi ginti shuru nahi ki'); return; }
  const { items } = collect();
  const byId = new Map(items.map(r => [String(r.id), r]));
  const jobs = [], bad = [];
  for (const id of scanList) {
    const item = byId.get(String(id));
    if (!item) continue;
    const v = readCount(item, true);
    if (!v) continue;
    if (v.bad) { bad.push(item.name); continue; }
    const old = countOf(pickedBranch, item);
    if (old && Number(old.total) === v.total && Number(old.ctn) === v.ctn && Number(old.pcs) === v.pcs) continue;  // pehle se yahi save hai
    jobs.push([item, v]);
  }
  if (bad.length) { notice('Ginti sahi likhein: ' + bad.join(', ')); return; }
  if (!jobs.length) { notice('Koi nayi ginti nahi likhi (ya sab pehle se save hain)'); return; }
  const zeros = jobs.filter(([, v]) => v.total === 0);
  const lines = jobs.map(([it, v]) => `• ${it.name}: ${num(v.total)}${v.total === 0 ? '  ← ZERO (' + zeroText(it) + ')' : ''}`);
  if (!confirm(`${jobs.length} items ki ginti save karein?${zeros.length ? `\n\n${zeros.length} item ZERO hain!` : ''}\n\n${lines.join('\n')}`)) return;
  if (!staleOk()) return;
  button.disabled = true;
  let ok = 0;
  const fail = [];
  for (const [item, v] of jobs) {
    try { await writeCount(item, v); ok++; }
    catch (e) { fail.push(item.name); }
  }
  button.disabled = false;
  notice(fail.length ? `${ok} save hue · NAHI hue: ${fail.join(', ')}` : `${ok} items ki ginti mehfooz ✓`);
}

// Enter dabane par agla ginti ka khana
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || !e.target.matches?.('[data-count-ctn],[data-count-pcs],[data-count-tot]')) return;
  const all = [...($('list')?.querySelectorAll('[data-count-ctn],[data-count-pcs],[data-count-tot]') || [])];
  const i = all.indexOf(e.target);
  if (i < 0) return;
  e.preventDefault();
  const next = all[i + 1];
  if (next) { next.focus(); try { next.select(); } catch {} next.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  else e.target.blur();
});

// ============================================================
//  BARCODE SCAN (mobile camera) — Chrome (Android) ka BarcodeDetector
//  Camera khula rehta hai: ek ke baad ek items scan karein -> "Ho gaya" -> sirf woh items ki list
//  -> ginti likh kar "Sab save karein" -> "Saaf karein" se wapas poori list
// ============================================================
let scanHit = null;
let scanList = [];        // scan kiye hue item ids (tarteeb se)
let scanStream = null, scanTimer = null, scanBox = null, scanBusy = false;
let scanCamOff = false; try { scanCamOff = localStorage.getItem('sam-scan-camoff') === '1'; } catch {}   // v2.40: 📷 camera band/chalu (phone yaad rakhta hai)
function camOffBtn(tools) { const b = document.createElement('button'); b.type = 'button'; b.className = 'scan-camoff'; b.textContent = scanCamOff ? '📷 Camera chalu' : '📷 Camera band';
  b.onclick = () => { scanCamOff = !scanCamOff; try { localStorage.setItem('sam-scan-camoff', scanCamOff ? '1' : '0'); } catch {} closeScanner(); openScanner(); }; tools.appendChild(b); return b; }
let lastCode = '', lastCodeAt = 0;
let badCode = '', badN = 0, lastGoodAt = 0;   // v1.56: ghalat parhai ka filter
let camRetry = 0, audioCtx = null;            // v1.57: kaala camera dobara chalu, scan ki awaz
// v2.95.4: PC par scanner gun (keyboard) ka pehla scan hi awaz chalu kar de — mouse click ki zaroorat nahi
if (typeof document !== 'undefined') document.addEventListener('keydown', () => { try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state !== 'running') audioCtx.resume(); } catch {} }, true);
// v1.74: "ek barcode chuno" mode — wohi bara scanner (Focus/Zoom/Camera/Light) sirf ek code parh kar wapas
let pickHook = null, pickMulti = null;   // v2.17: pickMulti = { done } — camera khula rahe, har code par cb (transfer note)
export function scanPick(cb) { pickMulti = null; pickHook = cb; if (scanBox) finishScan(); openScanner(); }
export function scanPickMany(cb, done) { if (scanBox) finishScan(); pickMulti = { done }; pickHook = cb; openScanner(); }
// v1.59: camera ka jawab 4 sec mein na aaye to intezar khatam (baad mein mila stream foran band, taake camera na phanse)
function gumT(c, ms = 4000) {
  return new Promise((res, rej) => {
    let done = false;
    const t = setTimeout(() => { done = true; const e = new Error('Camera kahin aur khula hai'); e.name = 'Timeout'; rej(e); }, ms);
    navigator.mediaDevices.getUserMedia(c).then(s => {
      if (done) { s.getTracks().forEach(x => x.stop()); return; }
      clearTimeout(t); done = true; res(s);
    }, e => { if (!done) { clearTimeout(t); done = true; rej(e); } });
  });
}
// v1.59: tab / app peeche jaye (doosra tab, call, doosri app) to camera chhor do — warna doosri jagah kaala camera
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.hidden && scanBox) finishScan(); });
function beep(ok) {
  try {
    if (!audioCtx) return;
    if (audioCtx.state !== 'running') audioCtx.resume();
    const t = audioCtx.currentTime + 0.01;
    // v1.60: zyada tez aur lambi awaz
    const tones = ok ? [[2200, 0, 0.18]] : [[380, 0, 0.2], [380, 0.28, 0.2]];
    for (const [f, s, d] of tones) {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'square'; o.frequency.value = f;
      g.gain.setValueAtTime(0.6, t + s); g.gain.exponentialRampToValueAtTime(0.001, t + s + d);
      o.connect(g); g.connect(audioCtx.destination); o.start(t + s); o.stop(t + s + d + 0.02);
    }
  } catch {}
}

function clearScan() {
  $('list')?.querySelectorAll?.(COUNT_SEL).forEach(el => { el.value = el.defaultValue; });
  scanList = []; scanHit = null; scanQty = new Map(); lastScan = null; lastKey = ''; scanOrder = []; scanItems = new Map();
  const si = $('search'); if (si) si.value = '';
  limit = PAGE;
  rerender();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// v2.71: search natije mein item ke SAARE barcode (code + extra barcode + sub-barcode tadad ke sath)
function hitCodes(r) {
  const sub = new Map((Array.isArray(r.bq) ? r.bq : []).filter(x => x && x.b).map(x => [String(x.b).trim(), x.q]));
  const all = [...new Set([r.code, ...(Array.isArray(r.bc) ? r.bc : []), ...sub.keys()].map(x => String(x || '').trim()).filter(Boolean))];
  if (!all.length) return '';
  return `<span class="hit-codes">${all.map(c => `<i class="hc${sub.has(c) ? ' sub' : ''}">${esc(c)}${sub.has(c) ? ` <b>${num(sub.get(c))}</b>` : ''}</i>`).join('')}</span>`;
}
// v2.70: search natije mein 4 rate — Parchoon (Pcs / Ctn) · Wholesale (Pcs / Ctn)
function hitRates(r) {
  const pk = Number(r.pack) || 0, rp = Number(r.rate2) || Number(r.rate) || 0, rc = Number(r.rate) || 0, wp = Number(r.wrate) || Number(r.rate) || 0;
  if (!rp && !wp) return '';
  const c = (lbl, v, cls) => v ? `<i class="hr ${cls}">${lbl} <b>${num(Math.round(v * 100) / 100)}</b></i>` : '';
  return `<span class="hit-rates">${c('Parchoon', rp, 'r')}${pk > 1 ? c('P/' + (r.cName || 'Ctn'), rc * pk, 'r') : ''}${c('Wholesale', wp, 'w')}${pk > 1 ? c('W/' + (r.cName || 'Ctn'), wp * pk, 'w') : ''}</span>`;
}
function closeScanner() {
  try { clearInterval(scanBox?._billsTimer); } catch {}
  clearTimeout(scanTimer); try { cancelAnimationFrame(scanTimer); } catch {} scanTimer = null;
  if (scanStream) { scanStream.getTracks().forEach(t => t.stop()); scanStream = null; }
  if (scanBox) { scanBox.remove(); scanBox = null; }
}

function finishScan() {
  camRetry = 0;
  const wasPick = !!pickHook, many = pickMulti; pickHook = null; pickMulti = null;
  closeScanner();
  if (many) { try { many.done?.(); } catch {} return; }   // v2.17: kai code wala chunao khatam
  if (wasPick) return;   // v1.74: sirf code chunna tha — sale/ginti ko haath na lagao
  if (saleRoot()) { saleSeen = []; rerender(); return; }
  if (!scanList.length) return;
  rerender();
  const { items } = collect();
  // camera par chuni hui tadad ginti ke khanon mein bhar do
  setTimeout(() => {
    for (const [id, q] of scanQty) {
      const esc_ = CSS.escape(String(id));
      const c = $('list')?.querySelector(`[data-count-ctn="${esc_}"]`), p = $('list')?.querySelector(`[data-count-pcs="${esc_}"]`), t = $('list')?.querySelector(`[data-count-tot="${esc_}"]`);
      if (c && q.ctn) c.value = q.ctn;
      if (p && q.pcs) p.value = q.pcs; else if (!p && t && q.pcs) t.value = q.pcs;
      liveCount(id);
    }
    scanQty = new Map(); lastScan = null; lastKey = '';
  }, 60);
  const first = items.find(r => String(r.id) === String(scanList[0]));
  if (first) setTimeout(() => focusItem(first), 80);
}

// code se item dhoondo (is branch mein): ItemCode + POS ke baqi barcode
function findByCode(code) {
  const clean = String(code).trim();
  const bare = clean.replace(/^0+/, '');
  const { items } = collect();
  const codesOf = r => [r.code, ...(Array.isArray(r.bc) ? r.bc : []), ...(Array.isArray(r.bq) ? r.bq.map(x => x?.b) : [])].map(x => String(x || '').trim()).filter(Boolean);   // v2.55: sub-barcode bhi
  return items.find(r => codesOf(r).includes(clean))
    || items.find(r => bare && codesOf(r).some(x => x.replace(/^0+/, '') === bare))
    || null;
}

// scan list mein daalo. Wapas: 'added' | 'again' | null (nahi mila)
function addScanned(code) {
  if (saleRoot()) {
    const r = saleHook ? saleHook(code) : { state: null };
    if (r.state) saleSeen.push(r.item.name);
    return r;
  }
  const item = findByCode(code);
  if (!item) return { state: null };
  if (scanList.some(id => String(id) === String(item.id))) return { state: 'again', item };
  scanList.push(item.id);
  scanHit = item.id;
  return { state: 'added', item };
}

// ---------- v1.69: iPhone ke liye barcode parhna (ZXing, vendor/zxing.min.js — pehli dafa aa kar phone mein mehfooz) ----------
let zxingP = null;
function zxingDetector() {
  if (!zxingP) zxingP = new Promise((res, rej) => {
    if (window.ZXing) return res();
    const s = document.createElement('script');
    s.src = './vendor/zxing.min.js?v=0.21.3';
    s.onload = () => res();
    s.onerror = () => rej(new Error('zxing load'));
    document.head.appendChild(s);
  }).then(() => {
    const Z = window.ZXing, F = Z.BarcodeFormat;
    const hints = new Map();
    hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128, F.CODE_39, F.CODE_93, F.ITF, F.CODABAR, F.QR_CODE]);
    hints.set(Z.DecodeHintType.TRY_HARDER, true);
    const reader = new Z.MultiFormatReader(); reader.setHints(hints);
    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d', { willReadFrequently: true });
    return {
      detect: async video => {
        const vw = video.videoWidth, vh = video.videoHeight;
        if (!vw || !vh) return [];
        const k = Math.min(1, 1024 / vw);
        canvas.width = Math.round(vw * k); canvas.height = Math.round(vh * k);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        try {
          const r = reader.decodeWithState(new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.HTMLCanvasElementLuminanceSource(canvas))));
          return [{ rawValue: r.getText() }];
        } catch { return []; }
        finally { try { reader.reset(); } catch {} }
      }
    };
  }).catch(e => { zxingP = null; throw e; });
  return zxingP;
}

// v2.77: is device par camera hai? (PC par aksar nahi) — na ho to 📷 ki jagah 🔫 scanner gun wala tareeqa
let noCam = null;
try { if (localStorage.getItem('sam-nocam') === '1') noCam = true; } catch {}
export function camMissing() { return noCam === true; }
function camIco() { return noCam === true ? '🔫' : '📷'; }
export async function camCheck() {
  let none = false;
  try {
    if (!navigator.mediaDevices?.enumerateDevices) none = true;
    else none = !(await navigator.mediaDevices.enumerateDevices()).some(d => d.kind === 'videoinput');
  } catch { none = false; }
  noCam = none; try { localStorage.setItem('sam-nocam', none ? '1' : '0'); } catch {}
  return !none;
}
try { navigator.mediaDevices?.addEventListener?.('devicechange', () => { camCheck(); }); } catch {}
async function openScanner() {
  if (scanBox) return;
  const hasCam = await camCheck();   // v2.77
  if (scanBox) return;
  if (!pickHook) syncFromCart();
  // awaz: button dabane (user ke haath) par hi chalu ho sakti hai
  try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); } catch {}
  if (hasCam && !navigator.mediaDevices?.getUserMedia) {
    notice('Is phone/browser mein camera nahi khulta — code search mein likhein.');
    return;
  }
  let detector;
  if (!hasCam) { /* v2.77: camera nahi — detector ki zaroorat nahi */ }
  else if ('BarcodeDetector' in window) {   // Android Chrome: phone ka apna tez tareeqa
    let formats = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'code_93', 'itf', 'codabar', 'qr_code'];
    try { const sup = await BarcodeDetector.getSupportedFormats(); formats = formats.filter(f => sup.includes(f)); } catch {}
    try { detector = new BarcodeDetector({ formats }); } catch { detector = new BarcodeDetector(); }
  } else {                              // v1.69: iPhone (Safari / iPhone Chrome) — ZXing library se
    try { detector = await zxingDetector(); }
    catch { notice('Barcode parhne wali library load nahi hui (internet check karein) — code search mein likhein.'); return; }
    if (scanBox) return;               // intezar ke dauran dobara na khul jaye
  }

  scanBox = document.createElement('div');
  scanBox.className = 'scan-box';
  scanBox.innerHTML = `<div class="scan-inner">
      <div class="scan-find"><div class="scan-find-row"><input class="scan-q" type="search" enterkeyhint="next" placeholder="🔍 Naam ya code likhein" autocomplete="off"><input class="scan-n" type="text" inputmode="decimal" enterkeyhint="done" placeholder="Pcs" autocomplete="off"><input class="scan-c" type="text" inputmode="decimal" enterkeyhint="done" placeholder="Ctn" autocomplete="off"><button type="button" class="scan-u" hidden>Pcs</button></div><div class="scan-hits" hidden></div></div>
      <div class="scan-mid">
        <div class="scan-left"></div>
        <div class="scan-cam"><video playsinline muted autoplay></video><div class="scan-line"></div></div>
        <div class="scan-pad" hidden>
          <div class="scan-pad-name"></div>
          <div class="scan-pad-row"><button type="button" data-unit="pcs" class="selected">Pcs</button><button type="button" data-unit="ctn">Ctn</button>
            ${[1,2,3,4,5,6,7,8,9,10,11,12].map(n => `<button type="button" data-qty="${n}">${n}</button>`).join('')}<button type="button" data-qty="+1">+1</button></div>
        </div>
      </div>
      <p class="scan-msg">Barcode camera ke saamne rakhein — ek ke baad ek scan karte jayein</p>
      <ol class="scan-names"></ol>
      <div class="scan-sum"></div>
      <button type="button" class="scan-done">✓ Ho gaya — list dikhao (<span>0</span>)</button>
      <button type="button" class="scan-close">✕ Band karein</button>
    </div>`;
  document.body.appendChild(scanBox);
  const msg = scanBox.querySelector('.scan-msg');
  if (pickHook) {   // v1.74: sirf ek code chunna hai — search/tadad/list chhupa do (v2.41: transfer wale pickMulti mein search rahe)
    scanBox.classList.add('pick-mode');
    if (!pickMulti) scanBox.querySelector('.scan-find')?.setAttribute('hidden', '');
    scanBox.querySelector('.scan-pad')?.setAttribute('hidden', '');
    if (pickMulti) { const dn = scanBox.querySelector('.scan-done'); if (dn) dn.innerHTML = '✓ Ho gaya — list dikhao (<span>0</span>)'; msg.textContent = 'Ek ke baad ek barcode camera ke saamne laayein — har item neeche list mein jurta jayega'; }
    else { scanBox.querySelector('.scan-done')?.setAttribute('hidden', ''); msg.textContent = 'Barcode camera ke saamne rakhein — parhte hi wapas form khulega'; }
  }
  const namesBox = scanBox.querySelector('.scan-names');
  const countBox = scanBox.querySelector('.scan-done span');
  const { items } = collect();
  const byId = new Map(items.map(r => [String(r.id), r]));
  const sumBox = scanBox.querySelector('.scan-sum');
  const lineOf = (it, k) => {
    const q = scanQty.get(k ?? String(it.id)) || { pcs: 0, ctn: 0 };
    const pack = Number(it.pack) || 0;
    const total = Math.round(((Number(q.ctn) || 0) * (pack > 1 ? pack : 0) + (Number(q.pcs) || 0)) * 1000) / 1000;
    const rate = Number(it.rate2) || Number(it.rate) || 0;   // v1.61: khula piece POS "Peice Rate"
    const ctnRate = Number(it.rate) || rate;                  // carton fi piece
    const qtxt = `${q.ctn ? num(q.ctn) + ' ' + (it.cName || 'Ctn') + (q.pcs ? ' + ' : '') : ''}${q.pcs || !q.ctn ? num(q.pcs || 0) + ' ' + (it.uName || 'Pcs') : ''}`;
    const ctnPcs = Math.round((Number(q.ctn) || 0) * (pack > 1 ? pack : 0) * 1000) / 1000;
    return { total, rate, amt: r2(ctnPcs * ctnRate + (Number(q.pcs) || 0) * rate), qtxt };
  };
  let liG = null;   // v2.95.1: godam list EK dafa fi draw (pehle har line par — scan dheema)
  const liGodam = (k, it) => { if (!saleLineGodamHook || !saleGodamHook) return ''; const g = liG; if (!g || !g.list || g.list.length < 2) return '';
    const cur = Number(it.g) || 1; return `<div class="li-g">${g.list.map(x => `<button type="button" data-lgk="${esc(k)}" data-lgb="${x.b}" title="${esc(x.full || x.name)}"${Number(x.b) === cur ? ' class="on"' : ''}>${esc(x.name)}</button>`).join('')}</div>`; };
  const drawNames = (keepScroll) => {
    const sale = saleRoot();
    if (sale) {
      const list = scanOrder.map(k => [k, scanItems.get(k)]).filter(x => x[1]);
      liG = null; if (saleLineGodamHook && saleGodamHook) { try { liG = saleGodamHook(); } catch {} }
      countBox.textContent = list.length;
      namesBox.innerHTML = list.slice().reverse().map(([k, it]) => { const L = lineOf(it, k);   // v2.33: nayi upar
        return `<li data-k="${esc(k)}"${k === lastKey ? ' class="now"' : ''}><button type="button" class="scan-del" data-del="${esc(k)}" aria-label="Hatao">✕</button><b>${esc(it.name)}</b><span>${esc(L.qtxt)}${L.rate ? ` x ${num(L.rate)} = <b>${num(L.amt)}</b>` : ''}</span>${(() => { const q = scanQty.get(k) || { pcs: 0, ctn: 0 }, pk = Number(it.pack) || 0; return `<div class="li-qty">${pk > 1 ? `<label>${esc(it.cName || 'Ctn')}<input class="li-in" data-li="${esc(k)}" data-u="ctn" type="text" inputmode="decimal" autocomplete="off" value="${q.ctn || ''}" placeholder="0"></label>` : ''}<label>${esc(it.uName || 'Pcs')}<input class="li-in" data-li="${esc(k)}" data-u="pcs" type="text" inputmode="decimal" autocomplete="off" value="${q.pcs || ''}" placeholder="0"></label><button type="button" class="li-neg${L.total < 0 ? ' on' : ''}" data-neg="${esc(k)}" title="Wapsi (minus)">${L.total < 0 ? '↩' : '±'}</button></div>`; })()}${liGodam(k, it)}</li>`; }).join('');   // v2.95: ± wapsi + line ka godam   // v2.67: har line par Pcs (aur Ctn) ke khane   // v2.42: transfer (rate 0) par sirf tadad
      namesBox.reversed = true; namesBox.start = list.length;
      const kul = list.reduce((n, [k, it]) => n + lineOf(it, k).amt, 0);
      sumBox.innerHTML = list.length ? (kul ? `Kul: <b>Rs ${num(kul)}</b>` : `<b>${list.length}</b> items`) : '';
      if (keepScroll) { namesBox.querySelector('li.now')?.scrollIntoView({ block: 'nearest' }); } else { try { namesBox.scrollTop = 0; } catch {} }   // v2.55.1: nayi line upar · v2.58: chuni line nazar mein
      return;
    }
    const names = scanList.slice(-6).map(id => byId.get(String(id))?.name || id);
    countBox.textContent = scanList.length;
    namesBox.innerHTML = names.map(x => `<li>${esc(x)}</li>`).join('');
    namesBox.start = Math.max(1, scanList.length - 5);
    sumBox.innerHTML = '';
  };
  drawNames();
  scanBox._redraw = () => { try { showPad(); drawNames(); } catch {} };
  scanBox._reload = () => { const keep = lastKey; syncFromCart(); if (keep && scanItems.has(keep)) { lastKey = keep; lastScan = scanItems.get(keep); } try { showPad(); drawNames(true); } catch {} };   // v2.95
  // v2.64: Pcs/Ctn ke sath GODAM chips (sale) — agla scan isi godam se
  if (saleRoot() && saleGodamHook && !pickHook) {
    const gw = document.createElement('div'); gw.className = 'scan-godam';
    const paintG = () => { let g = null; try { g = saleGodamHook(); } catch {} if (!g || !g.list || g.list.length < 2) { gw.hidden = true; return; } gw.hidden = false;
      gw.innerHTML = g.list.map(x => `<button type="button" data-sg="${x.b}" title="${esc(x.full || x.name)}"${Number(x.b) === Number(g.cur) ? ' class="on"' : ''}>${esc(x.name)}</button>`).join(''); };   // v2.90: chhote NT/G1/G2
    gw.addEventListener('click', e => { const b = e.target.closest('[data-sg]'); if (!b) return; try { saleGodamHook().set(Number(b.dataset.sg)); } catch {} paintG(); if (msg) msg.textContent = `✓ Godam: ${b.title || b.textContent} — agla item yahin se`; qBox?.focus?.(); });
    gw.className = 'scan-godam scan-godam-in'; paintG(); { const row = scanBox.querySelector('.scan-find-row'); if (row) row.appendChild(gw); else (scanBox.querySelector('.scan-find') || scanBox.firstElementChild).after(gw); }   // v2.90: Pcs/Ctn ke aage isi line mein
  }
  // v2.64: PC par baayein — AAJ KE BILLS (chips: ✓ paid · ✗ baqi · ⊘ cancel · ⏳ PC · ⚠ fail) + search
  if (saleRoot() && saleBillsHook && !pickHook && window.matchMedia && window.matchMedia('(min-width:1100px)').matches) {
    const side = document.createElement('aside'); side.className = 'scan-bills';   // v2.95: sale.js mountBills (PC + app, rang, posted, edit)
    scanBox.appendChild(side); scanBox.classList.add('has-bills');
    try { scanBox._billsTimer = saleBillsHook(side); } catch (e) { console.warn('bills', e); }
  }   // v2.59: naya bill par list saaf
  // v1.64: list ki line ka ✕ — bill se bhi kat jaye
  namesBox.addEventListener('pointerdown', e => { if (e.target.closest('.scan-del,.li-g,.li-neg')) e.preventDefault(); });
  namesBox.addEventListener('click', e => {   // v2.95: line ka godam chip / ± wapsi
    const gb = e.target.closest('[data-lgk]'); if (gb) { e.stopPropagation(); try { saleLineGodamHook?.(gb.dataset.lgk, Number(gb.dataset.lgb)); } catch {} scanBox._reload?.(); msg.textContent = '✓ Godam: ' + (gb.title || gb.textContent); return; }
    const nb = e.target.closest('[data-neg]'); if (nb) { e.stopPropagation(); const k = nb.dataset.neg, it = scanItems.get(k); if (!it) return; const q = scanQty.get(k) || { pcs: 0, ctn: 0 };
      const nq = (Number(q.pcs) || Number(q.ctn)) ? { pcs: -(Number(q.pcs) || 0), ctn: -(Number(q.ctn) || 0) } : { pcs: -1, ctn: 0 };
      scanQty.set(k, nq); lastKey = k; lastScan = it; if (saleQtyHook) saleQtyHook(it, nq, k); showPad(); drawNames(true); msg.textContent = (nq.pcs < 0 || nq.ctn < 0) ? `↩ ${it.name} — WAPSI (minus)` : `✓ ${it.name} — wapis plus`; return; }
  });
  // v2.58: list ki line par tap / ↑↓ = wo line chuno -> Pcs/Ctn pad aur Tadad usi par lagein
  const pickLine = k => { if (!k || !scanItems.has(k)) return; lastKey = k; lastScan = scanItems.get(k); showPad(); drawNames(true); };
  namesBox.addEventListener('click', e => { if (e.target.closest('.scan-del,.li-in,.li-qty,.li-g,.li-neg')) return;   // v2.69: khane par tap = sirf likhna (redraw nahi)
    const li = e.target.closest('li[data-k]'); if (li) { pickLine(li.dataset.k); kbLine = true; } });
  let kbLine = false, kbNum = '';
  // v2.67: list ki line ke khane — Shift / click = wahan jao, Tab = agla khana, Enter = lagao + wapas search. Scanner ke tez hindse = naya item.
  const liFocus = k => { const box = namesBox.querySelector(`li[data-k="${CSS.escape(k)}"] .li-in[data-u="pcs"]`) || namesBox.querySelector(`li[data-k="${CSS.escape(k)}"] .li-in`); if (box) { box.focus(); try { box.select(); } catch {} } };
  const liApply = (inp, redraw) => { const k = inp.dataset.li; if (!k || !scanItems.has(k)) return; const it = scanItems.get(k), li = inp.closest('li');
    const val = u => { const x = li.querySelector(`.li-in[data-u="${u}"]`); return x ? Number(String(x.value).replace(/[^0-9.\-]/g, '')) || 0 : 0; };   // v2.95: minus (wapsi) bhi
    const q = { pcs: val('pcs'), ctn: Number(it.pack) > 1 ? Math.trunc(val('ctn')) : 0 };
    scanQty.set(k, q); lastKey = k; lastScan = it; if (saleQtyHook) saleQtyHook(it, q, k);
    if (redraw) { showPad(); drawNames(true); } else { const L = lineOf(it, k), sp = li.querySelector(':scope > span'); if (sp) sp.innerHTML = `${esc(L.qtxt)}${L.rate ? ` x ${num(L.rate)} = <b>${num(L.amt)}</b>` : ''}`; } };
  let liT0 = 0, liLast = 0, liN = 0;
  namesBox.addEventListener('keydown', e => { const inp = e.target.closest?.('.li-in'); if (!inp) return;
    const now = performance.now(); if (/^[0-9]$/.test(e.key)) { if (!liN || now - liLast > 300) { liT0 = now; liN = 0; } liN++; liLast = now; }
    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation();
      const raw = String(inp.value).replace(/[^0-9]/g, '');
      if (raw.length >= 5 && liN >= 5 && (liLast - liT0) / Math.max(1, liN - 1) < 40) { inp.value = inp.defaultValue; liN = 0; feedCode(raw); qBox?.focus(); return; }   // scanner ka barcode
      liN = 0; liApply(inp, true); qBox?.focus(); return; }
    if (e.key === 'Escape') { e.preventDefault(); inp.value = inp.defaultValue; qBox?.focus(); return; }
  }, true);
  namesBox.addEventListener('input', e => { const inp = e.target.closest?.('.li-in'); if (inp) liApply(inp, false); });
  namesBox.addEventListener('focusout', e => { const inp = e.target.closest?.('.li-in'); if (inp && !namesBox.contains(e.relatedTarget)) { liApply(inp, true); } });
  namesBox.addEventListener('pointerdown', e => { if (e.target.closest('.li-in,.scan-del,.li-g,.li-neg')) return; const li = e.target.closest('li[data-k]'); if (li) { e.preventDefault(); pickLine(li.dataset.k); setTimeout(() => liFocus(li.dataset.k), 0); } });
  const lineKeys = () => [...namesBox.querySelectorAll('li[data-k]')].map(li => li.dataset.k);
  scanBox.addEventListener('keydown', e => {
    if (!saleRoot()) return;
    const inQ = document.activeElement === qBox, inN = document.activeElement === nBox;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (inQ && !hitBox.hidden && hitBox.querySelector('[data-pick]')) return;   // search ke natije pehle (app.js)
      if (inN) return;
      const ks = lineKeys(); if (!ks.length) return;
      e.preventDefault(); e.stopPropagation();
      let i = kbLine ? ks.indexOf(lastKey) : -1;
      if (e.key === 'ArrowDown') i = Math.min(ks.length - 1, i + 1); else i = i - 1;
      if (i < 0) { kbLine = false; kbNum = ''; namesBox.querySelectorAll('li').forEach(li => li.classList.remove('kbsel')); qBox.focus(); return; }
      kbLine = true; kbNum = ''; if (inQ) qBox.blur(); pickLine(ks[i]);
      namesBox.querySelector(`li[data-k="${CSS.escape(ks[i])}"]`)?.classList.add('kbsel');
      msg.textContent = `↑↓ line chuno · tadad likh kar Enter · ${padUnit === 'ctn' ? 'Ctn' : 'Pcs'} badalne ke liye C / P`;
      return;
    }
    if (document.activeElement?.closest?.('.li-in,.scan-c')) return;   // v2.69: line ke khane / Ctn khane mein likhna — rokna nahi
    if (!kbLine || inQ || inN || !lastScan) return;
    if (/^[0-9.]$/.test(e.key)) { e.preventDefault(); kbNum += e.key; clearTimeout(scanBox._kbT); if (kbNum.length >= 8) scanBox._kbT = setTimeout(() => { if (kbNum.length >= 8) { const c = kbNum; kbNum = ''; kbLine = false; feedCode(c); } }, 220); msg.textContent = `${lastScan.name}: ${kbNum} ${padUnit === 'ctn' ? 'Ctn' : 'Pcs'} — Enter dabayein`; return; }   // 8+ hindse = scanner ka barcode
    if (e.key === 'Backspace') { e.preventDefault(); kbNum = kbNum.slice(0, -1); return; }
    if (e.key.toLowerCase() === 'c' && Number(lastScan.pack) > 1) { e.preventDefault(); padUnit = 'ctn'; showPad(); return; }
    if (e.key.toLowerCase() === 'p') { e.preventDefault(); padUnit = 'pcs'; showPad(); return; }
    if (e.key === 'Enter' && kbNum) {
      e.preventDefault(); e.stopPropagation();
      if (kbNum.length >= 5) { const c = kbNum; kbNum = ''; kbLine = false; clearTimeout(scanBox._kbT); feedCode(c); return; }   // barcode, tadad nahi
      const v = Number(kbNum); kbNum = ''; if (!(v >= 0)) return;
      const id = lastKey || String(lastScan.id), q = scanQty.get(id) || { pcs: 0, ctn: 0 };
      q[padUnit] = v; scanQty.set(id, q);
      if (saleQtyHook) saleQtyHook(lastScan, q, lastKey);
      showPad(); drawNames(true); namesBox.querySelector('li.now')?.classList.add('kbsel');
      msg.textContent = `✓ ${lastScan.name} — ${v} ${padUnit === 'ctn' ? 'Ctn' : 'Pcs'}`; beep(true);
    }
  }, true);
  namesBox.addEventListener('click', e => {
    const b = e.target.closest('.scan-del'); if (!b) return;
    const k = b.dataset.del;
    if (saleRoot() && saleDelHook) saleDelHook(k);
    scanOrder = scanOrder.filter(x => x !== k); scanItems.delete(k); scanQty.delete(k);
    if (!saleRoot()) scanList = scanList.filter(id => String(id) !== k);
    if (lastKey === k || !scanItems.has(lastKey)) { lastKey = scanOrder[scanOrder.length - 1] || ''; lastScan = lastKey ? scanItems.get(lastKey) : null; }
    if (navigator.vibrate) navigator.vibrate(30);
    showPad(); drawNames();
  });
  const pad = scanBox.querySelector('.scan-pad'), padName = scanBox.querySelector('.scan-pad-name');
  const showPad = () => {
    if (!lastScan) { pad.hidden = true; return; }
    pad.hidden = false;
    const q = scanQty.get(lastKey || String(lastScan.id)) || { pcs: 0, ctn: 0 };
    padName.textContent = `${lastScan.name} — ${q.ctn ? q.ctn + ' ' + (lastScan.cName || 'Ctn') + ' + ' : ''}${q.pcs || 0} ${lastScan.uName || 'Pcs'}`;
    pad.querySelectorAll('[data-unit]').forEach(b => b.classList.toggle('selected', b.dataset.unit === padUnit));
    pad.querySelector('[data-unit="ctn"]').hidden = !(Number(lastScan.pack) > 1);
  };
  pad.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !lastScan) return;
    if (b.dataset.unit) { padUnit = b.dataset.unit; showPad(); return; }
    const id = lastKey || String(lastScan.id), q = scanQty.get(id) || { pcs: 0, ctn: 0 };
    const v = b.dataset.qty;
    if (v === '+1') q[padUnit] = (Number(q[padUnit]) || 0) + 1; else q[padUnit] = Number(v);
    scanQty.set(id, q);
    if (saleRoot() && saleQtyHook) saleQtyHook(lastScan, q, lastKey);
    if (navigator.vibrate) navigator.vibrate(30);
    showPad(); drawNames();
  });
  // camera ki screen par search: naam ya code se item add
  const qBox = scanBox.querySelector('.scan-q'), hitBox = scanBox.querySelector('.scan-hits'), nBox = scanBox.querySelector('.scan-n');
  let chosen = null;   // v1.59: search se chuna hua item, tadad ka intezar
  const uBtn = scanBox.querySelector('.scan-u');
  let nUnit = 'pcs';   // v1.60: Tadad ki ikai — hamesha Pcs se shuru, tap par Ctn
  const setUnit = (u, it) => {
    const canCtn = Number((it || chosen)?.pack) > 1;
    nUnit = canCtn ? u : 'pcs';
    uBtn.textContent = nUnit === 'ctn' ? ((it || chosen)?.cName || 'Ctn') : ((it || chosen)?.uName || 'Pcs');
    uBtn.classList.toggle('ctn', nUnit === 'ctn');
    uBtn.disabled = !canCtn;
    const cB = scanBox?.querySelector('.scan-c'); if (cB) { cB.disabled = !!(it || chosen) && !canCtn; cB.placeholder = (it || chosen)?.cName || 'Ctn'; }   // v2.69
    if (nBox) nBox.placeholder = (it || chosen)?.uName || 'Pcs';
  };
  uBtn.addEventListener('pointerdown', e => e.preventDefault());   // keyboard band na ho
  uBtn.onclick = () => { setUnit(nUnit === 'pcs' ? 'ctn' : 'pcs'); nBox.focus(); };
  setUnit('pcs', null);
  // v1.60: kuch phones par awaz tab chalu hoti hai jab screen chhui jaye
  scanBox.addEventListener('pointerdown', () => { try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state !== 'running') audioCtx.resume(); } catch {} }, true);
  const scanSearch = () => {
    chosen = null;
    const q = String(qBox.value || '').toLowerCase().trim();
    if (!q) { hitBox.hidden = true; hitBox.innerHTML = ''; return; }
    const src = saleRoot() && saleFindHook ? saleFindHook(q) : smartSearch(items, q, 12);   // v1.75
    hitBox.hidden = false;
    hitBox.innerHTML = src.length ? src.map((r, i) => `<button type="button" data-pick="${i}"><b>${esc(r.name)}</b><small>${r.stock != null ? 'stock ' + num(r.stock) : ''}</small>${hitCodes(r)}${hitRates(r)}</button>`).join('') : '<p class="stat-note">Nahi mila</p>';
    hitBox._src = src;
  };
  showPad();   // v1.57: dobara kholne par aakhri item ki tadad fauran nazar aaye
  qBox.oninput = scanSearch;
  // v2.53: USB scanner (ya haath se poora barcode) is khane mein aaye to camera jaisa hi lagao — "Nahi mila" nahi
  const feedCode = code => {
    const r = addScanned(code);
    if (!r.state) { msg.textContent = `"${code}" stock mein nahi mila`; beep(false); if (navigator.vibrate) navigator.vibrate([60, 60, 60]); return; }
    lastScan = r.item; const k = String(r.line || r.item.id); lastKey = k;
    if (r.pcs != null) scanQty.set(k, { pcs: Number(r.pcs) || 0, ctn: Number(r.ctn) || 0 }); else if (!scanQty.has(k)) scanQty.set(k, { pcs: 1, ctn: 0 });
    if (!scanItems.has(k)) { scanItems.set(k, r.item); scanOrder.push(k); }
    showPad(); drawNames();
    msg.textContent = r.state === 'added' ? `✓ ${r.item.name} — tadad chunein ya agla scan karein` : `${r.item.name} pehle se list mein`;
    beep(true); if (navigator.vibrate) navigator.vibrate(80);
  };
  // v2.67: search mein akela SHIFT = neeche abhi wali line ke tadad ke khane mein (Tab = Ctn / agli line)
  { let shiftAlone = false;
    qBox.addEventListener('keydown', e => { if (e.key === 'Shift') shiftAlone = true; else shiftAlone = false; });
    qBox.addEventListener('keyup', e => { if (e.key !== 'Shift' || !shiftAlone) return; shiftAlone = false; if (!saleRoot()) return; const k = (lastKey && scanItems.has(lastKey)) ? lastKey : namesBox.querySelector('li[data-k]')?.dataset.k; if (!k) return; hitBox.hidden = true; pickLine(k); setTimeout(() => { const box = namesBox.querySelector(`li[data-k="${CSS.escape(k)}"] .li-in[data-u="pcs"]`) || namesBox.querySelector(`li[data-k="${CSS.escape(k)}"] .li-in`); if (box) { box.focus(); try { box.select(); } catch {} } }, 0); });
  }
  const codeLike = v => /^[0-9]{6,}$/.test(v) || (v.length >= 1 && !/\s/.test(v) && !!findByCode(v));   // v2.55 / v2.60: chhota sub-code (jaise "99") pehle barcode samjho, naam-search baad mein
  qBox.addEventListener('input', () => { const v = String(qBox.value || '').trim(); if (/^[0-9]{8,}$/.test(v) && findByCode(v)) { clearTimeout(qBox._ft); qBox._ft = setTimeout(() => { if (String(qBox.value || '').trim() === v) { qBox.value = ''; hitBox.hidden = true; chosen = null; feedCode(v); } }, 140); } });   // Enter na bhejne wala scanner
  qBox.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); const v = String(qBox.value || '').trim(); if (codeLike(v)) { clearTimeout(qBox._ft); qBox.value = ''; hitBox.hidden = true; chosen = null; feedCode(v); return; } if (chosen) { nBox.focus(); return; } const r = (hitBox._src || [])[0]; if (r) pickHit(r); } };
  // v1.59 (sale): item chunne par seedha add nahi — cursor "Tadad" mein; wahan Enter par add, phir cursor wapas search mein
  const pickHit = r => {
    if (pickHook && pickMulti) {   // v2.41: transfer note — search se chuna item bhi scan ki tarah list mein
      qBox.value = ''; hitBox.hidden = true;
      let res = null; try { res = pickHook(String(r.code || r.bc?.[0] || ''), r); } catch {}
      const ok = !!(res && res.ok); beep(ok); if (ok && navigator.vibrate) navigator.vibrate(60);
      if (msg) msg.innerHTML = res?.text || (ok ? '✓' : 'nahi mila'); const c = scanBox?.querySelector('.scan-done span'); if (c && res?.count != null) c.textContent = res.count;
      qBox.focus(); return;
    }
    if (saleRoot() && saleHook) {
      chosen = r; qBox.value = r.name; hitBox.hidden = true; nBox.value = ''; setUnit('pcs', r);
      const cB0 = scanBox.querySelector('.scan-c'), ctnFirst = !!trRootMark && Number(r.pack) > 1 && cB0 && !cB0.disabled;   // v2.99.64: transfer = pehle Ctn
      msg.textContent = `${r.name} — ${ctnFirst ? (r.cName || 'Ctn') + ' likh kar Enter (Pcs ke liye saath wala khana)' : 'tadad likh kar Enter dabayein (khali = 1)'}`;
      (ctnFirst ? cB0 : nBox).focus();
      return;
    }
    addHit(r, 0);
  };
  const addHit = (r, qty) => {
    qBox.value = ''; hitBox.hidden = true;
    if (saleRoot() && saleHook) { const res = saleHook(String(r.code || r.bc?.[0] || r.name), r, qty); if (res && res.item) { const k = String(res.line || res.item.id); lastScan = res.item; lastKey = k; if (res.pcs != null) scanQty.set(k, { pcs: Number(res.pcs) || 0, ctn: Number(res.ctn) || 0 }); else if (!scanQty.has(k)) scanQty.set(k, { pcs: 1, ctn: 0 }); if (!scanItems.has(k)) { scanItems.set(k, res.item); scanOrder.push(k); } showPad(); drawNames(); } return; }
    addScanned(String(r.code || r.id)); drawNames();
  };
  nBox.onkeydown = e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (!chosen) { const r = (hitBox._src || [])[0]; if (!r) { qBox.focus(); return; } chosen = r; setUnit('pcs', r); }
    const cBox = scanBox.querySelector('.scan-c');   // v2.69: upar Pcs + Ctn dono khane
    let q = Number(String(nBox.value || '').replace(',', '.').trim()) || 0, cq = Math.floor(Number(String(cBox?.value || '').replace(',', '.').trim()) || 0);
    const r = chosen, pk = Number(r.pack) || 0;
    if (!(pk > 1)) cq = 0;
    if (!(q > 0) && !(cq > 0)) { if (trRootMark && pk > 1) cq = 1; else q = 1; }   // v2.99.64: transfer mein khali = 1 Ctn
    chosen = null; nBox.value = ''; if (cBox) cBox.value = '';
    addHit(r, cq * pk + q);   // Ctn = pack se zarb (bill khud carton mein badal deta hai)
    beep(true);
    msg.textContent = `✓ ${r.name} — ${cq ? cq + ' ' + (r.cName || 'Ctn') + (q ? ' + ' : '') : ''}${q ? num(q) + ' ' + (r.uName || 'Pcs') : ''} · agla item likhein`;
    setUnit('pcs', null);
    qBox.focus();
  };
  { const cB = scanBox.querySelector('.scan-c'); if (cB) cB.onkeydown = e => { if (e.key === 'Enter') nBox.onkeydown(e); }; }   // v2.69: Ctn khane mein Enter bhi wahi
  hitBox.addEventListener('pointerdown', e => e.preventDefault());   // list par tap se keyboard band na ho
  hitBox.addEventListener('click', e => { const b = e.target.closest('[data-pick]'); if (!b) return; const r = (hitBox._src || [])[Number(b.dataset.pick)]; if (r) pickHit(r); });
  scanBox.querySelector('.scan-done').onclick = finishScan;
  scanBox.querySelector('.scan-close').onclick = finishScan;
  const video = scanBox.querySelector('video');

  // Sahi lens chunna: phone ke peeche kai camera hote hain (wide/macro mein focus nahi hota) — main camera dhoondo
  const pickCamera = async () => {
    let devs = [];
    try { devs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput'); } catch {}
    const saved = localStorage.getItem('sam-scan-cam');
    if (saved && devs.some(d => d.deviceId === saved)) return { deviceId: { exact: saved } };
    const back = devs.filter(d => /back|rear|environment|پیچھے/i.test(d.label));
    const main = back.find(d => !/wide|ultra|macro|tele|depth|bokeh/i.test(d.label)) || back[0];
    return main ? { deviceId: { exact: main.deviceId } } : { facingMode: { ideal: 'environment' } };
  };
  if (scanCamOff || !hasCam) {   // v2.40: camera band — scanner / search se kaam, video nahi · v2.77: camera hai hi nahi (PC)
    scanBox.classList.add('cam-off');   // v2.56: camera band = safed screen
    if (!hasCam) scanBox.classList.add('no-cam');
    const msg0 = scanBox.querySelector('.scan-msg'); if (msg0) msg0.textContent = hasCam ? 'Camera band hai — barcode gun ya naam/code se item lagayein. Chalu karne ke liye 📷 dabayein.' : '🔫 Is PC par camera nahi — barcode scanner gun se scan karein, ya naam / code likh kar Enter.';
    const tools0 = document.createElement('div'); tools0.className = 'scan-tools';
    if (hasCam) camOffBtn(tools0); else { const g = document.createElement('span'); g.className = 'gun-chip'; g.textContent = '🔫 Scanner gun tayyar'; tools0.appendChild(g); }
    (scanBox.querySelector('.scan-left') || msg0).append(tools0);
    setTimeout(() => scanBox?.querySelector('.scan-q')?.focus(), 60);
    const v0 = scanBox.querySelector('video'); if (v0) v0.style.display = 'none';
    return;
  }
  try {
    // pehle ijazat (labels tabhi milte hain), phir sahi camera
    let cam = await pickCamera();
    if (!cam.deviceId) {
      const tmp = await gumT({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      tmp.getTracks().forEach(t => t.stop());
      cam = await pickCamera();
    }
    scanStream = await gumT({
      video: { ...cam, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 }, advanced: [{ focusMode: 'continuous' }] }, audio: false
    });
  } catch (e) {
    closeScanner();
    if (e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError' || /device not found/i.test(e?.message || '')) {   // v2.77: camera mila hi nahi -> scanner gun
      noCam = true; try { localStorage.setItem('sam-nocam', '1'); } catch {}
      if (!await camCheck()) { setTimeout(openScanner, 200); return; }
    }
    if (e?.name === 'Timeout' && camRetry < 1) {   // ek dafa khud dobara (yaad kiya lens bhool kar)
      camRetry++; try { localStorage.removeItem('sam-scan-cam'); } catch {}
      setTimeout(openScanner, 600); return;
    }
    notice('Camera nahi khula: ' + (e?.name === 'NotAllowedError' ? 'camera ki ijazat dein (browser settings)'
      : e?.name === 'Timeout' || e?.name === 'NotReadableError' ? 'camera kahin aur khula hai — Chrome ke doosre tabs / doosri apps (call, camera) band karke dobara kholein'
      : (e?.message || e)));
    return;
  }
  if (!scanBox) { scanStream.getTracks().forEach(t => t.stop()); scanStream = null; return; }
  video.srcObject = scanStream;
  try { await video.play(); } catch {}
  // v1.57: kuch phones par band karke foran dobara kholne se camera kaala rehta hai.
  // 1.5 sec mein tasveer na aaye to camera khud dobara chalu (doosri dafa mein yaad kiya hua lens bhi bhool jao).
  setTimeout(() => {
    if (!scanBox || scanBox.querySelector('video') !== video) return;
    if (video.videoWidth > 0) { camRetry = 0; return; }
    if (camRetry < 2) {
      camRetry++;
      if (camRetry === 2) { try { localStorage.removeItem('sam-scan-cam'); } catch {} }
      closeScanner(); setTimeout(openScanner, 500);
    } else msg.textContent = 'Camera ki tasveer nahi aa rahi — 🔄 Camera dabayein, ya band karke dobara kholein';
  }, 1500);
  // Tez scan: continuous focus, aur zoom / torch ke buttons (chhote barcode ke liye)
  const track = scanStream.getVideoTracks()[0];
  const caps = track.getCapabilities?.() || {};
  try { if (caps.focusMode?.includes('continuous')) await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }); } catch {}
  const tools = document.createElement('div'); tools.className = 'scan-tools';
  if (caps.zoom) {
    let z = Math.min(caps.zoom.max, Math.max(caps.zoom.min, (track.getSettings().zoom || 1)));
    const setZ = async v => { z = Math.min(caps.zoom.max, Math.max(caps.zoom.min, v)); try { await track.applyConstraints({ advanced: [{ zoom: z }] }); } catch {} zb.textContent = `🔍 ${z.toFixed(1)}x`; };
    const zb = document.createElement('button'); zb.type = 'button'; zb.textContent = `🔍 ${z.toFixed(1)}x`;
    zb.onclick = () => setZ(z + 1 > caps.zoom.max ? caps.zoom.min : z + (caps.zoom.step || 1));
    tools.appendChild(zb);
    setZ(caps.zoom.min || 1);   // default 1x (zoom se tasveer dhundli ho sakti hai)
  }
  // 🎯 Focus: camera ko dobara focus karne par majboor karo (single-shot -> continuous)
  const refocus = async () => {
    try {
      if (caps.focusMode?.includes('single-shot')) { await track.applyConstraints({ advanced: [{ focusMode: 'single-shot' }] }); await new Promise(r => setTimeout(r, 400)); }
      if (caps.focusMode?.includes('continuous')) await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
      else if (caps.focusMode?.includes('auto')) await track.applyConstraints({ advanced: [{ focusMode: 'auto' }] });
      msg.textContent = 'Focus ho raha hai… barcode ko 12-15 cm door, seedha rakhein';
    } catch {}
  };
  const fb = document.createElement('button'); fb.type = 'button'; fb.textContent = '🎯 Focus'; fb.onclick = refocus;
  tools.prepend(fb);
  // 🔄 Camera badlein: agla lens (jo theek chale woh yaad rahega)
  try {
    const devs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
    if (devs.length > 1) {
      const cb = document.createElement('button'); cb.type = 'button'; cb.textContent = `🔄 Camera (${devs.length})`;
      cb.onclick = () => {
        const cur = track.getSettings().deviceId;
        const i = devs.findIndex(d => d.deviceId === cur);
        const next = devs[(i + 1) % devs.length];
        localStorage.setItem('sam-scan-cam', next.deviceId);
        closeScanner(); openScanner();
      };
      tools.appendChild(cb);
      msg.textContent = `Camera: ${track.label || 'main'} — dhundla ho to 🔄 se badlein`;
    }
  } catch {}
  camOffBtn(tools);   // v2.40: 🔄 Camera ke neeche 📷 Camera band
  video.addEventListener('click', refocus);
  if (caps.torch) {
    let on = false; const tb = document.createElement('button'); tb.type = 'button'; tb.textContent = '🔦 Light';
    tb.onclick = async () => { on = !on; try { await track.applyConstraints({ advanced: [{ torch: on }] }); } catch {} tb.textContent = on ? '🔦 Light ON' : '🔦 Light'; };
    tools.appendChild(tb);
  }
  if (tools.children.length) (scanBox.querySelector('.scan-left') || msg).append(tools);   // v1.63: camera ke buttons LEFT patti mein

  const loop = async () => {
    if (!scanBox) return;
    let wait = 0;
    if (!scanBusy && video.readyState >= 2) {
      scanBusy = true;
      try {
        const found = await detector.detect(video);
        const code = found.map(f => String(f.rawValue || '').trim()).find(Boolean);
        const now = Date.now();
        // v1.62: jab tak wahi barcode camera ke saamne hai, dobara na gino (warna har 1.5 sec nayi line banti)
        if (code && code === lastCode && now - lastCodeAt < 1500) lastCodeAt = now;
        if (code && pickHook && pickMulti) {   // v2.17: camera khula — har naya code list mein
          if (!(code === lastCode && now - lastCodeAt < 1500)) {
            lastCode = code; lastCodeAt = now;
            let res = null; try { res = pickHook(code); } catch {}
            const ok = !!(res && res.ok);
            beep(ok); if (ok && navigator.vibrate) navigator.vibrate(60);
            const m = scanBox?.querySelector('.scan-msg'); if (m) m.innerHTML = res?.text || (ok ? '✓' : '"' + code + '" nahi mila');
            const c = scanBox?.querySelector('.scan-done span'); if (c && res?.count != null) c.textContent = res.count;
          }
        } else
        if (code && pickHook) { const cb = pickHook; pickHook = null; beep(true); if (navigator.vibrate) navigator.vibrate(60); finishScan(); try { cb(code); } catch {} return; }
        if (code && !(code === lastCode && now - lastCodeAt < 1500)) {   // wahi barcode dobara foran na gine
          const r = addScanned(code);
          if (r.state) { lastCode = code; lastCodeAt = now; lastGoodAt = now; badCode = ''; badN = 0; }
          else {
            // v1.56: camera kabhi ek-do frame ghalat parhta hai. "Nahi mila" tabhi jab wahi code 3 dafa lagataar aaye
            // aur abhi (2.5 sec) koi sahi item add na hua ho — warna chupchaap agla frame dekho.
            if (code === badCode) badN++; else { badCode = code; badN = 1; }
            if (badN < 3 || now - lastGoodAt < 2500) { scanBusy = false; scanTimer = setTimeout(loop, 60); return; }
            badN = 0; lastCode = code; lastCodeAt = now;
          }
          if (r.state === 'added' || r.state === 'again') { lastScan = r.item; const k = String(r.line || r.item.id); lastKey = k;   // v1.62: sale mein har scan nayi line
            if (r.pcs != null) scanQty.set(k, { pcs: Number(r.pcs) || 0, ctn: Number(r.ctn) || 0 });   // v1.58: bill wali asal tadad
            else if (!scanQty.has(k)) scanQty.set(k, { pcs: 1, ctn: 0 });
            if (!scanItems.has(k)) { scanItems.set(k, r.item); scanOrder.push(k); }
            showPad(); drawNames(); }
          if (r.state === 'added') {
            msg.textContent = `✓ ${r.item.name} — tadad neeche se chunein ya agla scan karein`;
            beep(true);
            if (navigator.vibrate) navigator.vibrate(80);
            drawNames();
            wait = 350;
          } else if (r.state === 'again') {
            msg.textContent = `"${r.item.name}" pehle se list mein hai`;
            beep(true);
            if (navigator.vibrate) navigator.vibrate([40, 40, 40]);
            wait = 350;
          } else {
            msg.textContent = `"${code}" stock mein nahi mila — doosra scan karein`;
            beep(false);
            if (navigator.vibrate) navigator.vibrate([60, 60, 60]);
            wait = 700;
          }
        }
      } catch {}
      scanBusy = false;
    }
    scanTimer = wait ? setTimeout(loop, wait) : requestAnimationFrame(loop);
  };
  loop();
}

function focusItem(item) {
  const id = CSS.escape(String(item.id));
  const row = document.querySelector(`[data-stock-row="${id}"]`);
  if (!row) return;
  row.scrollIntoView({ block: 'center', behavior: 'smooth' });
  const box = Number(item.pack) > 1
    ? row.querySelector(`[data-count-ctn="${id}"]`)
    : row.querySelector(`[data-count-tot="${id}"]`);
  if (box) { box.focus({ preventScroll: true }); try { box.select(); } catch {} }
}


// ============================================================
//  USB / Bluetooth BARCODE SCANNER (keyboard ki tarah likhta hai)
//  Mobile (OTG) ya PC — bohat tez aane wale akshar + Enter/Tab = barcode.
//  Kisi bhi khane mein cursor ho, barcode wahan nahi likha jata; item scan list mein judta hai.
// ============================================================
let kbBuf = '', kbFirst = 0, kbLast = 0, kbTarget = null, kbStartVal = null, kbTimer = null;
const KB_GAP = 90;          // is se zyada ms ka faasla = insaan likh raha hai (v2.52: 50 -> 90, aahista USB scanner bhi)
function kbReset() { kbBuf = ''; kbTarget = null; kbStartVal = null; clearTimeout(kbTimer); kbTimer = null; }
function kbIsScan(now) {
  const n = kbBuf.length;
  return n >= 4 && (kbLast - kbFirst) / Math.max(1, n - 1) < 60 && now - kbLast < 220;   // v2.52: 35ms -> 60ms fi akshar
}
function kbFinish() {
  const code = kbBuf.trim();
  const target = kbTarget, startVal = kbStartVal;
  kbReset();
  // jo akshar kisi khane mein chale gaye, hata do
  if (target && startVal !== null && 'value' in target) {
    target.value = startVal;
    if (target === $('search')) target.dispatchEvent(new Event('input', { bubbles: true }));
  }
  if (document.querySelector('#dialog[open] .tc-root')) { if (tcView !== 'scan') tcView = 'scan'; tcLookup(code); return; }   // v2.99.21: 🧾 transfer check — scanner gun ka code seedha yahan
  const trq = !saleRoot() && document.querySelector('#dialog[open] [data-tr-q]');   // v2.52: transfer note khula ho to code wahan
  if (trq) { trq.value = code; trq.dispatchEvent(new Event('input', { bubbles: true })); return; }
  hardScan(code);
}
document.addEventListener('keydown', e => {
  const onStock = stockActive && !saleRoot() && !!document.querySelector('.stock-head');
  const onTr = !!document.querySelector('#dialog[open] [data-tr-q]'), onTc = !!document.querySelector('#dialog[open] .tc-root');   // v2.99.21
  if (onTc && e.target?.matches?.('[data-tc-note]')) return;   // farq likhte waqt nahi
  if ((!onStock && !saleRoot() && !onTr && !onTc) || scanBox || e.ctrlKey || e.altKey || e.metaKey) return;
  const now = performance.now();
  if (e.key.length === 1) {
    if (!kbBuf || now - kbLast > KB_GAP) {
      kbBuf = ''; kbFirst = now;
      kbTarget = e.target;
      kbStartVal = e.target && 'value' in e.target ? e.target.value : null;
    }
    kbBuf += e.key; kbLast = now;
    clearTimeout(kbTimer);
    kbTimer = setTimeout(() => { if (kbIsScan(performance.now() - 60)) kbFinish(); else kbReset(); }, 200);   // scanner jo Enter na bheje
    return;
  }
  if ((e.key === 'Enter' || e.key === 'Tab') && kbBuf) {
    if (kbIsScan(now)) { e.preventDefault(); e.stopImmediatePropagation(); kbFinish(); }
    else kbReset();
  }
}, true);

function hardScan(code) {
  if (!code) return;
  if (saleRoot()) {
    const r = saleHook ? saleHook(code) : { state: null };
    if (!r.state) { notice(`"${code}" stock mein nahi mila`); if (navigator.vibrate) navigator.vibrate([60, 60, 60]); }
    else if (navigator.vibrate) navigator.vibrate(80);
    return;
  }
  const r = addScanned(code);
  if (!r.state) {
    notice(`"${code}" stock mein nahi mila`);
    if (navigator.vibrate) navigator.vibrate([60, 60, 60]);
    return;
  }
  if (navigator.vibrate) navigator.vibrate(r.state === 'added' ? 80 : [40, 40, 40]);
  notice(r.state === 'added' ? `✓ ${r.item.name} (list mein ${scanList.length})` : `${r.item.name} pehle se list mein hai`);
  rerender();
  setTimeout(() => focusItem(r.item), 80);
}

// v1.75: alias save (malik) — likhne ke 1 sec baad
let aliasT = null;
document.addEventListener('input', e => {
  const t = e.target; if (!t.matches?.('[data-alias-item]')) return;
  clearTimeout(aliasT);
  aliasT = setTimeout(() => { cloud?.setAlias?.(t.dataset.aliasItem, t.value).then(() => notice('✓ Doosre naam save')).catch(er => notice('Nahi hua: ' + (er?.message || er))); }, 1200);
});

// v2.54: Esc = camera / scanner screen band
document.addEventListener('keydown', e => { if (e.key === 'Escape' && scanBox && !document.querySelector('#dialog[open]')) { e.preventDefault(); finishScan(); } });

// v2.59: bill save ho gaya -> scanner screen khuli ho to list saaf, search par cursor (naya bill)
export function scanNewBill() { if (!scanBox) return false; scanOrder = []; scanItems.clear(); scanQty.clear(); lastScan = null; lastKey = ''; saleSeen = []; scanBox._redraw?.(); const m = scanBox.querySelector('.scan-msg'); if (m) m.textContent = '✓ Bill save — naya bill: agla item scan karein'; const q = scanBox.querySelector('.scan-q'); if (q) { q.value = ''; setTimeout(() => q.focus(), 30); } return true; }

// ---------- v2.99.8: 🤖 NOOR AGENT — stock dekhna / rate badalna / naya item / godam transfer ----------
// Malik: "agent mein stock, sale, transfer, notes sab joro — bol kar rate change, purchase ke items bol kar chunwao".
// Sab WAHI raaste jo Stock screen ke (requestItem / requestTransfer -> PC). Item dhoondna: naam (Roman), Urdu naam (AI wala), barcode.
let agP = null, agKey = null, agUr = null;
const r3 = n => Math.round((Number(n) || 0) * 1000) / 1000;
function agPool() {
  if (agP && agKey === rows && agUr === urdu) return agP;
  const { branches, names } = collect();
  const main = branches.includes(1) ? 1 : branches[0];
  const chunks = rows.filter(r => !r.meta && Array.isArray(r.items)), byId = new Map();
  for (const b of [main, ...branches.filter(x => x !== main)]) for (const c of chunks.filter(c => c.branch === b).sort((x, y) => (x.order || 0) - (y.order || 0))) for (const it of c.items) if (it && it.id != null && !byId.has(String(it.id))) byId.set(String(it.id), it);
  const list = [...byId.values()];
  const urList = Object.entries(urdu || {}).map(([id, ur]) => ({ id: 'u' + id, name: ur, _r: byId.get(String(id)) })).filter(x => x._r);
  agP = { list, byId, urList, branches: branches.filter(b => b !== JAMA), names, main }; agKey = rows; agUr = urdu;
  return agP;
}
export async function stockAgentReady(ms = 15000) {
  start(false);
  const t0 = Date.now();
  while (!loaded && Date.now() - t0 < ms) await new Promise(r => setTimeout(r, 120));
  if (failed) throw Error('Stock load nahi hua: ' + failed);
  if (!loaded) throw Error('Stock abhi load nahi hua (internet?) — thori der baad dobara poochein');
  return true;
}
export function stockAgentGodams() { const P = agPool(); return P.branches.map(b => ({ id: b, name: branchName(b, P.names), dukan: b === P.main })); }
const agCodes = r => [r.code, ...(Array.isArray(r.bc) ? r.bc : [])].map(x => String(x || '').trim()).filter(Boolean);
const agQtyTxt = (s, pk, cn = 'Ctn', un = 'Pcs') => { s = r2(s); if (pk > 1) { const neg = s < 0, a = Math.abs(s), c = Math.floor(a / pk + 1e-9), p = r2(a - c * pk); return (neg ? '-' : '') + (c ? num(c) + ' ' + cn + (p ? ' + ' : '') : '') + (p || !c ? num(p) + ' ' + un : ''); } return num(s) + ' ' + un; };
export function stockAgentItem(id, { cost = true } = {}) {
  const P = agPool(), r = P.byId.get(String(id)); if (!r) return null;
  const pk = Number(r.pack) > 1 ? Number(r.pack) : 0, cn = r.cName || 'Ctn', un = r.uName || 'Pcs';
  const per = P.branches.map(b => ({ godam_id: b, godam: branchName(b, P.names), dukan: b === P.main, pcs: r2(Number(saleStockItem(b, r.id)?.stock) || 0) }))
    .filter(x => Math.abs(x.pcs) > 0.0005 || x.dukan).map(x => ({ ...x, text: agQtyTxt(x.pcs, pk, cn, un) }));
  const total = r2(per.reduce((n, x) => n + x.pcs, 0));
  const rp = Number(r.rate) || 0, wp = Number(r.wrate) || 0;
  const out = { item_id: String(r.id), name: r.name, code: r.code || '', urdu: urduOf(r.id), pack: pk || 1, ctn_naam: cn, pcs_naam: un,
    stock: per, stock_kul_pcs: total, stock_kul: agQtyTxt(total, pk, cn, un), band: !!hidden[String(r.id)],
    rate: { parchoon_ctn: pk ? ctnR(rp, pk) : 0, parchoon_pcs: r2(Number(r.rate2) || rp), wholesale_ctn: pk ? ctnR(wp || rp, pk) : 0, wholesale_pcs: r2(Number(r.ws) || wp || rp),
      ...(cost ? { khareed_ctn: pk ? ctnR(Number(r.prate) || 0, pk) : r2(r.prate), khareed_pcs: r2(Number(r.prate) || 0) } : {}) },
    // Sale screen jaisa bhao (sale.js rateFor / crateFor) — fi piece
    _sale: { wc: r2(wp || rp), wp: r2(wp || rp), cc: r2(rp), cp: r2(Number(r.rate2) || rp) } };
  return out;
}
export function stockAgentFind(query, alt = [], n = 6, opt = {}) {
  const P = agPool(), qs = [query, ...(Array.isArray(alt) ? alt : [])].map(s => String(s || '').trim()).filter(Boolean).slice(0, 5);
  if (!qs.length) return { decision: 'nahi_mila', note: 'naam khali' };
  const out = x => stockAgentItem(x.id, opt);
  for (const s of qs) {   // barcode bilkul
    const c = s.replace(/\s/g, ''); if (!/^\d{5,}$/.test(c)) continue;
    const hit = P.list.filter(r => agCodes(r).some(x => x === c || x.replace(/^0+/, '') === c.replace(/^0+/, '')));
    if (hit.length === 1) return { decision: 'pakka', item_id: String(hit[0].id), how: 'barcode', candidates: [out(hit[0])] };
  }
  const found = [];
  for (const s of qs) {
    const res = /[؀-ۿ]/.test(s) ? smartSearch(P.urList, s, n * 2).map(x => x._r) : smartSearch(P.list, s, n * 2);
    for (const r of res) if (r && !found.includes(r)) found.push(r);
  }
  if (!found.length) return { decision: 'nahi_mila', searched: qs };
  const fq = qs.map(s => fold(s)), exact = found.filter(r => fq.includes(fold(r.name)) || fq.includes(fold(urduOf(r.id))));
  let id = '';
  if (exact.length === 1) id = String(exact[0].id);
  else if (found.length === 1) id = String(found[0].id);
  else { const st = found.filter(r => fq.some(q => q && (fold(r.name) + ' ').startsWith(q + ' '))); if (st.length === 1) id = String(st[0].id); }
  return { decision: id ? 'pakka' : 'poochna', ...(id ? { item_id: id } : {}), candidates: found.slice(0, n).map(out) };
}
export const stockAgentCanEdit = () => canEditItem();
// rate badalna / naya item — itemSave jaisa job (POS fi PIECE rakhta hai; CTN = fi piece × pack)
export async function stockAgentItemSave(id, patch = {}) {
  if (!id ? !canNewItem() : !canEditItem()) throw Error(!id ? 'Naya item — malik Stock screen par "➕ Mulazim NAYA item bana sake" on kare' : 'Rate / item sirf malik badal sakta hai (ya malik Stock screen par "✏️ Mulazim purane item ka rate / naam bhi badal sake" on kare)');
  if (!cloud?.requestItem) throw Error('Item ke liye app update karein');
  const isNew = !id, r = isNew ? null : agPool().byId.get(String(id));
  if (!isNew && !r) throw Error('Item nahi mila');
  const pk1 = Number(r?.pack) > 1 ? Number(r.pack) : 0;
  const v = { name: r?.name || '', code: r?.code || '', pack: Number(r?.pack) || 0, costP: Number(r?.prate) || 0, rpcs: Number(r?.rate2) || Number(r?.rate) || 0,
    rctn: (pk1 ? ctnR(Number(r?.rate) || 0, pk1) : 0) || 0, wpcs: Number(r?.ws) || Number(r?.wrate) || 0, wctn: (pk1 ? ctnR(Number(r?.wrate) || 0, pk1) : 0) || 0 };
  const P = {}; for (const k of ['name', 'code', 'pack', 'costC', 'costP', 'rctn', 'rpcs', 'wctn', 'wpcs']) if (patch[k] != null && patch[k] !== '') P[k] = k === 'name' || k === 'code' ? String(patch[k]).trim() : Math.max(0, Number(patch[k]) || 0);
  Object.assign(v, P);
  const pk = Number(v.pack) > 0 ? Number(v.pack) : 1;
  if (pk > 1) { if (!(v.rctn > 0) && v.rpcs > 0 && isNew) v.rctn = r2(v.rpcs * pk); if (!(v.wctn > 0) && v.wpcs > 0 && isNew) v.wctn = r2(v.wpcs * pk); }
  if (P.costC > 0 && !(P.costP > 0)) v.costP = Math.abs(r2(P.costC / pk) * pk - P.costC) <= 0.005 * pk + 1e-6 ? r2(P.costC / pk) : Math.round(P.costC / pk * 10000) / 10000;
  if (pk > 1 && P.costC > 0 && v.costP > 0 && Math.abs(v.costP * pk - P.costC) <= 0.005 * pk + 1e-6) v.costP = Math.round(P.costC / pk * 10000) / 10000;
  if (!v.name) throw Error('Item ka naam chahiye');
  const job = { op: isNew ? 'new' : 'edit', itemId: isNew ? '' : String(r.id), code: v.code, name: v.name, pack: v.pack, costP: v.costP, rctn: v.rctn, rpcs: v.rpcs, wctn: v.wctn, wpcs: v.wpcs };
  if (!isNew) job.subs = labelRows(r).filter(x => !x.main).map(x => ({ b: x.code, q: x.qty, r: x.rate || 0, s: x.show !== false }));
  const jid = await cloud.requestItem(job);
  return await new Promise(res => {
    let stopW = null, done = false;
    const end = x => { if (done) return; done = true; try { stopW && stopW(); } catch {} if (x.ok) rerender(); res(x); };
    stopW = cloud.watchItem ? cloud.watchItem(jid, j => { if (!j) return; if (j.status === 'done') end({ ok: true, code: j.code || '' }); else if (j.status === 'failed') end({ ok: false, why: j.error || 'nakam' }); }) : null;
    setTimeout(() => end({ ok: false, pending: true, why: 'PC se 45 second mein jawab nahi aaya — hukum mehfooz hai, PC (item-post) on hote hi POS mein lag jayega' }), 45000);
  });
}
// godam se godam — trSave jaisa (dukan / branch 1 ke ilawa "se" godam mein stock kam ho to mana)
export async function stockAgentTransfer({ from, to, lines, note = '' }) {
  if (!cloud?.requestTransfer) throw Error('Transfer ke liye app update karein');
  const P = agPool(); from = Number(from); to = Number(to);
  if (!P.branches.includes(from) || !P.branches.includes(to)) throw Error('Godam samajh nahi aaya');
  if (from === to) throw Error('"Se" aur "Ko" alag godam hon');
  const L = (lines || []).map(x => {
    const it = P.byId.get(String(x.id)); if (!it) throw Error('Item nahi mila: ' + (x.name || x.id));
    const pk = Number(it.pack) > 1 ? Number(it.pack) : 0, ctn = pk ? Math.max(0, Number(x.ctn) || 0) : 0, pcs = Math.max(0, Number(x.pcs) || 0) + (pk ? 0 : Math.max(0, Number(x.ctn) || 0));
    const qty = r3(ctn * pk + pcs); if (!(qty > 0)) throw Error('Tadad 0 — ' + it.name);
    return { itemId: it.id, name: it.name, qty, ctn, pcs, pack: Number(it.pack) || 0, cName: it.cName || 'Ctn', uName: it.uName || 'Pcs' };
  });
  if (!L.length) throw Error('Koi item nahi');
  const short = from !== 1 ? L.filter(l => trStockOf(from, l.itemId) < l.qty - 0.0005) : [];
  if (short.length) throw Error('⛔ ' + branchName(from, P.names) + ' mein stock kam: ' + short.map(l => l.name + ' (stock ' + num(trStockOf(from, l.itemId)) + ')').join(', '));
  const jid = await cloud.requestTransfer({ op: 'create', copies: trCopies, from, to, lines: L, note: String(note || '').slice(0, 300), byName: '' });
  return await new Promise(res => {
    let stopW = null, done = false;
    const end = x => { if (done) return; done = true; try { stopW && stopW(); } catch {} res(x); };
    stopW = cloud.watchTransfer ? cloud.watchTransfer(jid, j => { if (!j) return; if (j.status === 'done') end({ ok: true, no: j.transferNo || '' }); else if (j.status === 'failed') end({ ok: false, why: j.error || 'masla' }); }) : null;
    setTimeout(() => end({ ok: false, pending: true, why: 'PC se 45 second mein jawab nahi aaya — hukum mehfooz hai (transfer-sync on hote hi banega)' }), 45000);
  });
}
// v2.99.10: 🎤 awaz ke liye naam (Gemini ko "yeh naam hain" — sahi spelling pakre): zyada chalne wale + dukan mein stock wale
export function stockAgentNames(n = 350) {
  start(false);
  const P = agPool(); if (!P.list.length) return [];
  const out = new Set(topItems(P.list, Math.min(150, n)).map(r => r.name));
  for (const c of rows) { if (c.meta || c.branch !== P.main || !Array.isArray(c.items)) continue; for (const r of c.items) { if (out.size >= n) break; if ((Number(r.stock) || 0) > 0 && !hidden[String(r.id)]) out.add(r.name); } }
  return [...out].filter(Boolean).slice(0, n);
}

// ================= v2.99.64 ⇄ TRANSFER SCREEN (Khata ke saath chip) — naya note · 🧾 check · 📋 register aik jagah =================
// Malik: "transfer notes wali screen khata ke neeche chips mein, us ke andar hi transfer check aur register, premium". Data: tcAll() (POS +
// app ke notes), tcState (check), trList (app jobs). Halka: sirf aaj / kal ke notes ginta hai (purchase screen wali susti nahi).
let thRetry = false;
function thWatch() {
  start(false); tcStart();
  if (cloud && !thRetry && !(ptList || []).length) {   // pehli dafa login se pehle listener ruk gaya ho to aik dafa dobara
    thRetry = true;
    try { ptStop?.(); } catch {} ptStop = cloud.listenPosTransfers ? cloud.listenPosTransfers(list => { ptList = list || []; if (document.querySelector('.th-root')) rerender(); }) : null;
    try { trStop?.(); } catch {} trStop = cloud.listenTransfers ? cloud.listenTransfers(list => { trList = list; const h = document.querySelector('[data-tr-hist]'); if (h) h.innerHTML = trHistHTML(); if (document.querySelector('.th-root')) rerender(); }) : null;
  }
}
// ================= v2.103.14: 🧺 RACK BHARO — dukan se jitna bika, utna godam se poore carton (malik: "open stock godam se nahi aata;
//   pichhla data dekh kar — transfer note ke baad ek carton jitna bik jaye to Transfer notes screen par, ek click mein print") =================
// PC rack-bharo.js (har 2 min) -> posStats/rack {at, j: [{i, n, pk, g, gs, ss, w, s, m}]}. Qaida: carton wala = pk pcs bike -> poore carton;
// pieces wala = m (pichhle 5 transfer ki aam miqdaar) · malik ka ✏️ stockConfig.rack {id: {u (kitna bikne par), q (kitna lana)}}.
// Godam ka stock LIVE (app) — us se zyada nahi. Bhejne ke baad item chhupa (rackSent) jab tak PC naya transfer na dekhe.
let rackPk = [], rackRows = [], rackZero = [], rackAt = 0, rackStop = null, rk = null, canDoRk = () => true; const rackSent = new Map();
// v2.103.15: malik — "live data zaroori; tumhare paas stock bhi hai, sale bhi — abhi ke liye kaafi". PC ka rack data (posStats/rack)
//   aane tak APP KE APNE data se: transfer notes (tcAll — 60 din, POS + app) + item report ki din-war bikri (+ aaj irep-today) + LIVE stock.
//   Transfer wale din ki baqi bikri nahi gini (din ka hisaab) — PC data aate hi khud us par.
let irData = null, irStop = null, irT = null, irTStop = null, rlCache = null, rlKey = '';
function rackLocalWatch() { if (irStop || !cloud?.listenItemReport) return;
  irStop = cloud.listenItemReport(d => { if (d) { irData = d; rlCache = null; rkKick(); } });
  if (cloud.listenItemToday) irTStop = cloud.listenItemToday(t => { irT = t; rlCache = null; rkKick(); }); }
function rkKick() { if (rackAt) return; if (rk && $('rkBody')) rkPaint(); else if (document.querySelector('.th-root')) rerender(); }
const msDay = ms => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const medN = a => { const x = a.filter(v => v > 0).sort((p, q) => p - q); if (!x.length) return 0; const k = x.length >> 1; return x.length % 2 ? x[k] : (x[k - 1] + x[k]) / 2; };
function rackLocalRows() {
  if (!irData?.meta?.days) return [];
  const T = tcAll().filter(t => t && !t.cancelled && Number(t.to) === 1 && Number(t.from) !== 1), key = [irData.meta.at, irT?.at || 0, T.length, rows.length].join('|');
  if (rlCache && rlKey === key) return rlCache;
  const days = irData.meta.days, byI = new Map((irData.items || []).map(it => [String(it.i), it])), tdDay = irT?.day || '', tdMap = new Map((irT?.items || []).map(r => [String(r.i), Number(r.q) || 0]));
  T.sort((a, b) => (Number(b.createdOn) || Number(b.at) || 0) - (Number(a.createdOn) || Number(a.at) || 0));
  const last = new Map(); for (const t of T) { const w = Number(t.createdOn) || Number(t.at) || 0; for (const l of t.lines || []) { const id = String(l.itemId), q = Number(l.qty) || 0; if (!(q > 0)) continue; const o = last.get(id); if (!o) last.set(id, { g: Number(t.from), w, qs: [q] }); else if (o.qs.length < 5) o.qs.push(q); } }
  const out = [];
  for (const [id, L] of last) { const wd = msDay(L.w), it = byI.get(id); let sold = 0;
    for (const x of it?.d || []) { const day = days[x[0]]; if (day > wd && !(tdDay && day === tdDay)) sold += Number(x[1]) || 0; }
    if (tdDay && tdDay > wd) sold += tdMap.get(id) || 0;
    const gI = saleStockItem(L.g, id), sI = saleStockItem(1, id), gs = Number(gI?.stock) || 0, ss = Number(sI?.stock) || 0; if (!(gs > 0) || (!(sold > 0) && ss > 0)) continue;
    const pk = Number(sI?.pack || gI?.pack || it?.pk) || 0, fc = pk > 1 && L.qs.some(q => Math.abs(q / pk - Math.round(q / pk)) > 1e-6) ? 0 : 1;
    out.push({ i: id, n: it?.n || sI?.name || gI?.name || 'Item ' + id, pk, g: L.g, gs, ss, w: L.w, s: Math.round(sold * 1000) / 1000, m: medN(L.qs), fc, ...(ss <= 0 ? { k: 1 } : {}) }); }
  rlKey = key; return (rlCache = out.sort((a, b) => a.n.localeCompare(b.n)));
}
const rackSrc = () => rackAt ? rackRows : rackLocalRows();
function rackWatch() { rackLocalWatch(); if (rackStop || !cloud?.listenRack) return; rackStop = cloud.listenRack(d => { rackRows = Array.isArray(d?.rows) ? d.rows : []; rackPk = Array.isArray(d?.pk) ? d.pk : []; rackZero = Array.isArray(d?.z) ? d.z : []; rackAt = Number(d?.at) || 0; if (document.querySelector('.th-root') && !rk) rerender(); if (rk && $('rkBody')) rkPaint(); }); }
const rackCfg = id => itemCfg?.rack?.[String(id)] || null;
function rackCalc(x) {   // v2.103.16: 🔹 pcs wala (masale) · 🔴 rack khali · 🚫 sirf godam
  const P = Number(x.pk) > 1 ? Number(x.pk) : 0, cf = rackCfg(x.i) || {}, cm = !!P && (cf.mode ? cf.mode === 'ctn' : x.fc !== 0), pk = cm ? P : 0;
  const unit = Number(cf.u) > 0 ? Number(cf.u) : (pk || Math.max(1, Math.round(Number(x.m) || 1)));
  const live = saleStockItem(Number(x.g), String(x.i)), gs = live ? Number(live.stock) || 0 : Number(x.gs) || 0, sl = saleStockItem(1, String(x.i)), ss = sl ? Number(sl.stock) || 0 : Number(x.ss) || 0;
  // v2.103.23: 📤 NIKLA = aamad ke baad bika (s) + wapas godam (o) − seedha dukan purchase (p) · 📉 malik ki hadd (rackLo: dukan mein ¼ / ½ ctn reh jaye)
  const khali = !!x.k && ss <= 0, sold = Math.max(0, (Number(x.s) || 0) + (Number(x.o) || 0) - (Number(x.p) || 0)), hd = rackLo(), add = !!x.add;
  const lo = !khali && !!pk && hd > 0 && ss > 0 && ss <= pk * hd + 1e-9;
  // v2.103.24: 📊 % bacha — 100% = maal aane ke foran baad (dukan abhi + nikla); malik chip (rackPct 10–40) = sirf jab itna % ya kam bache
  const full = x.w && sold > 0 ? ss + sold : 0, pct = full > 0 ? Math.max(0, Math.round(ss / full * 100)) : null, pc = rackPct(), pctOk = !pc || khali || add || pct == null || pct <= pc;
  let want = Number(cf.q) > 0 ? Number(cf.q) : Math.floor(sold / unit) * unit; if (khali || lo || add) want = Math.max(want, unit); if (pk) want = Math.floor(want / pk) * pk;
  const cap = pk ? Math.floor(gs / pk) * pk : Math.floor(gs), q = Math.max(0, Math.min(want, cap));
  return { pk, P, unit, want, q, gs, ss, khali, lo, add, nik: sold, full, pct, short: q < want, due: (!cf.off || add) && pctOk && (sold >= unit || khali || lo || add) && q > 0, own: !!rackCfg(x.i), off: !!cf.off };
}
// v2.103.21: 5-5 ki PATTI (malik: "har 5 ki patti print phir agle 5 — larkon par bojh na bane"). Poori list dikhti hai, upar ke N par khud ✓
//   (khali pehle); malik/larka ✓ badal sakte hain (rk.man[key] = apna chunav). Print ke baad item list se hat-ta hai -> agle N par khud ✓.
function rkNGet() { try { const v = localStorage.getItem('sam-rk-n'); return v == null ? 5 : Math.max(0, Number(v) || 0); } catch { return 5; } }
function rkPick(key, ids) { const m = rk?.man?.get(key); if (m) return new Set(ids.filter(id => m.has(id))); return new Set(rk?.n ? ids.slice(0, rk.n) : ids); }
function rkToggle(key, ids, id, on) { const cur = rkPick(key, ids); if (on) cur.add(id); else cur.delete(id); rk.man.set(key, cur); }
function rkGroups(all, qOf) { const G = new Map(); for (const y of all) { if (!(qOf(y) > 0)) continue; const g = String(y.x.g); if (!G.has(g)) G.set(g, []); G.get(g).push(String(y.x.i)); } return G; }
function rkQOf(y) { return rk.sel.has(String(y.x.i)) ? rk.sel.get(String(y.x.i)) : y.c.q; }
// v2.103.22: ➕ "Phir bhi lao" — list se bahar item ka farzi row (stock se): jis godam mein sab se zyada maal
const rackPct = () => { const v = Number(itemCfg?.rackPct); return [10, 20, 30, 40].includes(v) ? v : 0; };
const rackLo = () => { const v = Number(itemCfg?.rackLo); return v === 0.25 || v === 0.5 ? v : 0; };
const rkHdName = v => v === 0.25 ? '¼ ctn' : v === 0.5 ? '½ ctn' : 'khali';
function rkSynth(id) { const P = agPool(), it = P.byId.get(String(id)); if (!it) return null; const { branches } = collect(), gods = branches.filter(b => b !== 1);
  const g = gods.map(b => [b, Number(saleStockItem(b, id)?.stock) || 0]).sort((a, b) => b[1] - a[1])[0]; const sI = saleStockItem(1, id), pk = Number(it.pack) || 0;
  return { i: String(id), n: it.name, pk, g: g ? g[0] : 0, gs: g ? g[1] : 0, ss: Number(sI?.stock) || 0, w: 0, s: 0, m: pk > 1 ? pk : 1, fc: 1, add: 1 }; }
// 🔍 Ye kyun nahi aaya? — rack list mein na hone ki wajah
function rkWhy(id) { id = String(id); const names = collect().names || {}, x = rackSrc().find(r => String(r.i) === id), cf = rackCfg(id) || {}, gods = collect().branches.filter(b => b !== 1);
  const gst = gods.map(b => [b, Number(saleStockItem(b, id)?.stock) || 0]).filter(z => z[1] > 0), ss = Number(saleStockItem(1, id)?.stock) || 0;
  const stk = `dukan ${num(r3(ss))} · ${gst.length ? gst.map(([b, v]) => esc(branchName(b, names)) + ' ' + num(r3(v))).join(' · ') : 'godam 0'}`;
  if (pkCfg(id)) return { w: '📦 Packet-war mein hai — wahan se aata hai', stk, can: false };
  if (cf.off) return { w: '🚫 "Sirf godam" laga hai — ✏️ se hatayein', stk, can: true };
  if (rackSent.get(id) > (Number(x?.w) || 0)) return { w: '🖨 Abhi patti nikli hai (30 min tak chhupa)', stk, can: false };
  if (!gst.length) return { w: '⛔ Kisi godam mein stock nahi', stk, can: false };
  if (x) { const c = rackCalc(x); if (c.pk && c.gs < c.pk) return { w: `📦 Godam mein poora carton nahi (${num(r3(c.gs))} pcs, 1 ctn = ${num(c.pk)})`, stk, can: true };
    return { w: `⏳ Aakhri aamad ke baad ${num(r3(c.nik))} nikle — hadd ${num(c.unit)}${c.pk ? ' (1 carton)' : ''}; dukan mein ${num(r3(c.ss))} hain`, stk, can: true }; }
  return { w: ss > 0 ? '🛒 6 mahine mein dukan par nahi bika (ya PC data mein nahi)' : '🛒 Dukan par kabhi nahi bika', stk, can: true }; }
function rackDue() {
  const now = Date.now(); for (const [k, t] of rackSent) if (now - t > 30 * 60000) rackSent.delete(k);
  const src = rackSrc(), ex = rk?.extra || new Map(), have = new Set(src.map(x => String(x.i)));
  const L = src.map(x => ex.has(String(x.i)) ? { ...x, add: 1 } : x);
  for (const id of ex.keys()) if (!have.has(id)) { const x = rkSynth(id); if (x) L.push(x); }
  const rank = c => c.khali ? 3 : c.lo ? 2 : c.add ? 1 : 0;
  return L.filter(x => (x.add || !pkCfg(x.i)) && !(rackSent.get(String(x.i)) > (Number(x.w) || 0))).map(x => ({ x, c: rackCalc(x) })).filter(y => y.c.due).sort((a, b) => rank(b.c) - rank(a.c));
}
const rkQty = (q, pk) => pk ? `${num(Math.floor(q / pk))} ctn` : `${num(q)} pcs`;
const rkWhen = ms => { const d = new Date(ms); return `${d.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]} ${d.toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit' })}`; };
// ---- v2.103.17: 📦 PACKET-WAR (Godam 2) — ek item ke kai barcode (garam masala 1 kg · 250 gm, ilaichi 50 gm): POS ek hi stock (kg) rakhta hai,
//   magar har sale line ki miqdaar = packet (0.250 = 250 gm). PC rack-bharo v1.2 ginta hai (aakhri transfer / chunne ke baad). Malik: kaun se items,
//   kaun sa godam (default Godam 2), har packet "itne bikein to" (n) + "itne lao" (a). Transfer note: POS mein wazan, note mein "250 gm × 10".
const pkCfg = id => { const v = itemCfg?.rackPk?.[String(id)]; if (!v) return null; try { const o = typeof v === 'string' ? JSON.parse(v) : v; return o && o.p ? o : null; } catch { return null; } };
const pkSent = new Map();
const pkName = (z, it) => { const u = String(it?.uName || '').toLowerCase(), kg = /kg|kilo/.test(u) || !u || u === 'pcs'; z = Number(z); return kg && z < 1 ? `${Math.round(z * 1000)} gm` : `${+z.toFixed(3)} ${it?.uName || (kg ? 'kg' : '')}`.trim(); };
function pkDue() {
  const out = [];
  for (const r of rackPk) { const cf = pkCfg(r.i); if (!cf) continue; if (pkSent.get(String(r.i)) > (Number(r.from) || 0)) continue;
    const it = saleStockItem(1, String(r.i)) || saleStockItem(Number(r.g), String(r.i)), gI = saleStockItem(Number(cf.g || r.g), String(r.i)), gs = gI ? Number(gI.stock) || 0 : Number(r.gs) || 0;
    const packs = Object.entries(cf.p || {}).map(([z, o]) => { const zz = Number(z); const sold = Number(r.sold?.[z] ?? r.sold?.[String(zz)]) || 0, n = Math.max(1, Number(o?.n) || 10), a = Math.max(1, Number(o?.a) || n), b = Number(o?.b) || 0, pct = Number(o?.pct) || 0;
      return { z: zz, sold, n, a, b, pct, left: b ? Math.max(0, r3(b - sold)) : null, due: sold >= n, name: pkName(zz, it) }; }).filter(p => p.due);
    if (!packs.length) continue;
    out.push({ r, cf, it, g: Number(cf.g || r.g), gs, packs, name: r.n || it?.name || 'Item ' + r.i });
  }
  return out;
}
function rackOpen() {
  rackWatch(); start(false); rk = { q: '', sel: new Map(), off: new Set(), ed: '', busy: '', pOff: new Set(), pQ: new Map(), pset: false, pq: '', pEd: '', pDraft: new Map(), pg: Number(localStorage.getItem('sam-rk-pg')) || 0, zAll: false, man: new Map(), n: rkNGet(), extra: new Map() };
  const d = $('dialog'); if (!d) return; d.classList.remove('search-dialog'); d.classList.add('full-dialog'); $('dialogTitle').textContent = '🧺 Rack bharo — godam se lao'; $('dialogBody').innerHTML = '<div class="rk-root" id="rkBody"></div>'; if (!d.open) d.showModal(); rkPaint();
}
function rkPaint(only) {
  const el = $('rkBody'); if (!el || !rk) return; const names = collect().names || {}, all = rackDue(), q = rk.q.trim(), hit = q ? new Set(smartSearch(all.map(y => ({ ...y, id: String(y.x.i), name: y.x.n })), q, 300).map(r => r.id)) : null;
  const L = all.filter(y => !hit || hit.has(String(y.x.i))), G = new Map(); for (const y of L) { if (!G.has(y.x.g)) G.set(y.x.g, []); G.get(y.x.g).push(y); }
  const qOf = y => rk.sel.has(String(y.x.i)) ? rk.sel.get(String(y.x.i)) : y.c.q, PK = new Map(); for (const [g, ys] of rkGroups(all, qOf)) PK.set(g, rkPick('r' + g, ys)); const on = y => !!PK.get(String(y.x.g))?.has(String(y.x.i)) && qOf(y) > 0;
  const ctn = all.reduce((t, y) => t + (y.c.pk ? Math.floor(qOf(y) / y.c.pk) : 0), 0), age = rackAt ? Math.round((Date.now() - rackAt) / 60000) : null;
  const row = y => { const x = y.x, c = y.c, id = String(x.i), v = qOf(y), ed = rk.ed === id, cf = rackCfg(id);
    return `<div class="rk-r${on(y) ? ' is-in' : ''}${c.khali ? ' rk-kh' : ''}"><label class="rk-tk"><input type="checkbox" data-rk-t="${esc(id)}"${on(y) ? ' checked' : ''}><span><b>${esc(x.n)}</b><span class="rk-chips">${c.khali ? '<i class="rk-c kh">🔴 Rack khali</i>' : ''}${c.lo ? `<i class="rk-c lo">📉 Dukan mein ${num(r3(c.ss))} bache (hadd ${rkHdName(rackLo())})</i>` : ''}${c.add ? '<i class="rk-c own">➕ khud</i>' : ''}${c.pct != null && !c.khali ? `<i class="rk-c ${c.pct <= 20 ? 'kh' : c.pct <= 40 ? 'lo' : 'pc'}">📊 ${c.pct}% bacha (${num(r3(c.full))} mein se ${num(r3(c.ss))})</i>` : ''}${c.P && !c.pk ? '<i class="rk-c pc">🔹 pcs wala</i>' : ''}${c.own ? '<i class="rk-c own">✏️ apna qaida</i>' : ''}</span><small>${x.w ? `${esc(rkWhen(x.w))} ke transfer ke baad <b>${esc(rkQty(c.nik, 0))}</b> ${x.o || x.p ? `nikle (${[`${num(r3(Number(x.s) || 0))} bike`, x.o ? `${num(r3(x.o))} wapas godam` : '', x.p ? `− ${num(r3(x.p))} purchase aayi` : ''].filter(Boolean).join(' · ')})` : 'bike'}` : 'transfer note nahi mila'}${c.P ? ` (1 ctn = ${num(c.P)})` : ''} · godam ${esc(rkQty(c.gs, c.pk))}${c.pk && c.gs % c.pk ? ' + ' + num(r3(c.gs % c.pk)) + ' pcs' : ''} · dukan ${num(c.ss)} pcs</small>${c.short ? `<em class="rk-warn">⚠️ ${esc(rkQty(c.want, c.pk))} chahiye — godam mein itna hi</em>` : ''}</span></label>
      <div class="rk-q"><input type="number" inputmode="numeric" min="0" step="1" data-rk-qty="${esc(id)}" value="${c.pk ? Math.floor(v / c.pk) : v}"><small>${c.pk ? 'ctn' : 'pcs'}</small></div>${isOwner() ? `<button type="button" class="rk-e" data-rk-e="${esc(id)}" aria-label="Qaida">✏️</button>` : ''}
      ${ed ? `<div class="rk-ed"><div class="rk-mode">${c.P ? [['', 'Khud'], ['ctn', '📦 Carton'], ['pcs', '🔹 Pcs']].map(([k, l]) => `<button type="button" class="${(cf?.mode || '') === k ? 'is-in' : ''}" data-rk-md="${esc(id)}|${k}">${l}</button>`).join('') : ''}<button type="button" class="rk-off" data-rk-off="${esc(id)}">🚫 Sirf godam — rack par nahi</button></div><label>Kitna bikne par lana<input type="number" inputmode="numeric" min="0" step="1" data-rk-u="${esc(id)}" value="${cf?.u || ''}" placeholder="${c.unit}"><small>pcs</small></label><label>Kitna lana<input type="number" inputmode="numeric" min="0" step="1" data-rk-w="${esc(id)}" value="${cf?.q || ''}" placeholder="khud"><small>pcs</small></label><button type="button" class="rk-sv" data-rk-sv="${esc(id)}">✓ Save</button>${cf ? `<button type="button" class="rk-au" data-rk-au="${esc(id)}">↺ Khud</button>` : ''}</div>` : ''}</div>`; };
  const html = `<div class="rk-hero"><div><small>DUKAN KA RACK</small><b>${num(all.length + pkDue().length)} items godam se lane</b><span>${ctn ? num(ctn) + ' carton' : ''}</span></div><span class="rk-ic">🧺</span></div>
    ${rackAt ? `<div class="rk-time${age > 10 ? ' old' : ''}">🖥 PC data: <b>${esc(new Date(rackAt).toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit' }))}</b> · ${age < 1 ? 'abhi' : age + ' min pehle'}${age > 10 ? ' — ⚠️ PC ka rack script ruka?' : ' · har 2 min'}</div>` : irData ? '<div class="rk-time old">⚠️ Andaza — PC data abhi nahi aaya (is mein godam ki sale bhi shamil). PC data aate hi khud sahi.</div>' : ''}
    ${rackZero.length && isOwner() ? (() => { const Z = rk.zAll ? rackZero : rackZero.slice(0, 8); return `<div class="rk-z0"><b>⚠️ ${num(rackZero.length)} items ka carton pcs <u>0</u> hai</b><small>POS mein in ka bill "Divide by zero" rok sakta hai. App se bane items PC khud 1 kar deta hai (item-post v1.3); baqi POS Item master mein Cotton/packing likhein (kam az kam 1).</small><span class="rk-chips">${Z.map(x => `<i class="rk-c kh" title="dukan ${num(x.ss)} · 30 din mein ${num(x.s)} bike">${esc(x.n)}${x.s ? ` · ${num(x.s)} bike` : ''}</i>`).join('')}${rackZero.length > 8 ? `<button type="button" class="rk-c pc rk-zm" data-rk-zall="1">${rk.zAll ? '▴ kam' : `+${num(rackZero.length - 8)} aur`}</button>` : ''}</span></div>`; })() : ''}
    <label class="hs-search"><input type="search" data-rk-q="1" placeholder="🔍 item dhoondo… (list mein nahi? wajah bhi)" value="${esc(rk.q)}" autocomplete="off"></label>
    ${isOwner() ? `<div class="rk-nb rk-pct"><span>📊 Itna % reh jaye to lao</span>${[[0, 'Sab'], [10, '10%'], [20, '20%'], [30, '30%'], [40, '40%']].map(([v, l]) => `<button type="button" class="${rackPct() === v ? 'is-in' : ''}" data-rk-pct="${v}">${l}</button>`).join('')}</div>` : ''}
    ${isOwner() ? `<div class="rk-nb rk-hd"><span>📉 Dukan mein itna reh jaye to lao</span>${[[0, 'Khali (0)'], [0.25, '¼ ctn'], [0.5, '½ ctn']].map(([v, l]) => `<button type="button" class="${rackLo() === v ? 'is-in' : ''}" data-rk-hd="${v}">${l}</button>`).join('')}</div>` : ''}
    ${all.length + pkDue().length > 3 ? `<div class="rk-nb"><span>🖨 Ek patti mein</span>${[3, 5, 10, 0].map(n => `<button type="button" class="${rk.n === n ? 'is-in' : ''}" data-rk-n="${n}">${n || 'Sab'}</button>`).join('')}</div>` : ''}
    <div id="rkList">${[...G].map(([g, ys]) => { const n = ys.filter(on).length; return `<section class="rk-g"><div class="rk-gh"><b>🏬 ${esc(branchName(Number(g), names))} ➜ ${esc(branchName(1, names))}</b><button type="button" class="rk-all" data-rk-all="${esc(String(g))}">${ys.every(on) ? '☐ koi nahi' : '☑ sab'}</button></div>${ys.length > n ? `<div class="rk-left"><i class="rk-c pc">✓ ${num(n)} is patti mein</i><i class="rk-c own">⏳ ${num(ys.length - n)} agli patti mein</i></div>` : ''}
      ${ys.map(row).join('')}
      <button type="button" class="rk-go" data-rk-go="${esc(String(g))}"${n && !rk.busy ? '' : ' disabled'}>${rk.busy === String(g) ? '⏳ PC note bana raha hai…' : `🖨 ${num(n)} items — patti print${ys.length > n ? ' · phir agle' : ''}`}</button></section>`; }).join('') || (q ? `<p class="rk-note">"${esc(q)}" — list mein nahi. Neeche wajah dekhein.</p>` : `<div class="th-empty">🧺<b>${rackAt || irData ? 'Sab rack bhare hain' : 'Data aa raha hai'}</b><small>${rackAt || irData ? 'Jaise hi kisi item ka ek carton bikega, yahan aa jayega' : 'Shop PC update ke baad 2–5 minute'}</small></div>`)}</div>
    <div id="rkWhy">${q ? (() => { const due = new Set(all.map(y => String(y.x.i))), H = smartSearch(agPool().list.filter(it => !due.has(String(it.id))), q, 4); if (!H.length) return '';
      return `<section class="rk-g rk-why"><div class="rk-gh"><b>🔍 Ye list mein kyun nahi?</b></div>${H.map(it => { const w = rkWhy(it.id); return `<div class="rk-wy"><span><b>${esc(it.name)}</b><i class="rk-c pc">${w.w}</i><small>📦 ${w.stk}</small></span>${w.can ? `<button type="button" class="rk-sv" data-rk-add="${esc(String(it.id))}">➕ Phir bhi lao</button>` : ''}</div>`; }).join('')}</section>`; })() : ''}</div>
    ${(() => { const P = pkDue(), cnt = Object.keys(itemCfg?.rackPk || {}).filter(k => pkCfg(k)).length; if (!P.length && !cnt && !isOwner()) return '';
      const G = new Map(); for (const y of P) { if (!G.has(y.g)) G.set(y.g, []); G.get(y.g).push(y); }
      return `<section class="rk-g rk-pw"><div class="rk-gh"><b>📦 Packet-war${cnt ? ` · ${num(cnt)} items` : ''}</b>${isOwner() ? '<button type="button" class="rk-all" data-rkp-set="1">⚙️ Items chunein</button>' : ''}</div>
        ${!rackAt ? '<p class="rk-note">PC data aate hi (2 min) packet ki ginti aayegi.</p>' : !P.length ? `<p class="rk-note">${cnt ? '✓ Abhi koi packet hadd tak nahi bika.' : 'Ek item ke kai barcode (garam masala 250 gm · 1 kg, ilaichi 50 gm) — "⚙️ Items chunein" se packet-war hadd lagayein.'}</p>` : ''}
        ${[...G].map(([g, ys]) => `<div class="rk-pg"><b class="rk-pgh">🏬 ${esc(branchName(g, names))} ➜ ${esc(branchName(1, names))}</b>
          ${(() => { rk._pp = rkPick('p' + g, ys.map(y => String(y.r.i))); return ''; })()}${ys.length > (rk.n || 1e9) ? `<div class="rk-left"><i class="rk-c pc">✓ ${num(rk._pp.size)} is patti mein</i><i class="rk-c own">⏳ ${num(ys.length - rk._pp.size)} baqi</i></div>` : ''}
          ${ys.map(y => { const id = String(y.r.i), offI = !rk._pp.has(id); return `<div class="rk-r${offI ? '' : ' is-in'}"><label class="rk-tk"><input type="checkbox" data-rkp-t="${esc(id)}"${offI ? '' : ' checked'}><span><b>${esc(y.name)}</b><small>godam ${num(r3(y.gs))} · dukan ${num(r3(y.r.ss))}${y.r.kh ? ` · khula ${num(y.r.kh)}` : ''}</small></span></label>
            <div class="rk-packs">${y.packs.map(p => { const k = id + '|' + p.z, v = rk.pQ.has(k) ? rk.pQ.get(k) : p.a; return `<div class="rk-pk"><span><b>${esc(p.name)}</b><small>${p.b ? `${num(p.left)} / ${num(p.b)} bache (${Math.round(p.left / p.b * 100)}% · hadd ${num(p.pct)}%)` : `${num(p.sold)} bike · hadd ${num(p.n)}`}</small></span><label><input type="number" inputmode="numeric" min="0" step="1" data-rkp-q="${esc(k)}" value="${v}"><small>packet</small></label></div>`; }).join('')}</div></div>`; }).join('')}
          <button type="button" class="rk-go" data-rkp-go="${esc(String(g))}"${rk.busy ? ' disabled' : ''}>${rk.busy === 'p' + g ? '⏳ PC note bana raha hai…' : `🖨 ${num(rk._pp.size)} items — packet patti print`}</button></div>`).join('')}</section>`; })()}
    ${rk.pset ? pkSetHTML(names) : ''}
    ${(() => { const offs = rackSrc().filter(x => rackCfg(x.i)?.off); return offs.length && isOwner() ? `<details class="rk-offs"><summary>🚫 Sirf godam (${num(offs.length)}) — rack list se hatay hue</summary>${offs.map(x => `<div class="rk-or"><span>${esc(x.n)}</span><button type="button" data-rk-on="${esc(String(x.i))}">↺ Wapas</button></div>`).join('')}</details>` : ''; })()}
    <p class="rk-note">Qaida: 📦 carton wala = ek carton bika to poore carton · 🔹 pcs wala (masale) = jitna aam taur par aata hai · 📤 maal aane ke baad jitna nikla (bika + wapas godam) 1 carton = lao · 🔴 rack khali = foran · 📊 malik ka % (maal aane par 100% — itna % reh jaye tab) · 📉 malik ki hadd (¼ / ½ ctn reh jaye) · 📦 packet-war = har packet ki apni hadd · ✏️ malik apna qaida. Khula maal godam se nahi.</p>`;
  if (only === 'pk') { const t = document.createElement('div'); t.innerHTML = html; const a = t.querySelector('#rkPkList'), b = el.querySelector('#rkPkList'); if (a && b) { b.innerHTML = a.innerHTML; return; } }
  else if (only) { const t = document.createElement('div'); t.innerHTML = html; const a = t.querySelector('#rkList'), b = el.querySelector('#rkList'), wa = t.querySelector('#rkWhy'), wb = el.querySelector('#rkWhy'); if (a && b) { b.innerHTML = a.innerHTML; if (wa && wb) wb.innerHTML = wa.innerHTML; return; } }
  el.innerHTML = html;
}
// ⚙️ packet-war items chunna (malik) — list pehle se, search, har item ke barcode / packet, godam chip, hadd
function pkSetHTML(names) {
  const C = collect(), P = agPool(), q = rk.pq.trim(), gods = C.branches.filter(b => b !== 1), g0 = gods.includes(rk.pg) ? rk.pg : (C.g2 != null ? C.g2 : gods[0]);   // v2.103.19: Godam 2 NAAM se (branch 2 = "Godam 1" tha) + malik ki chip
  // v2.103.18: ⇄ Godam 2 -> Noor Traders ke transfer notes ke items SAB SE UPAR (malik: "pehle wo items aayein, phir stock saath likha
  //   aaye, re-order baad mein upar likhte jayenge") — naye pehle, har item ka TN # + tareekh; stock LIVE (dukan · godam)
  const tn = new Map(); for (const t of tcAll().filter(t => t && !t.cancelled && Number(t.from) === g0 && Number(t.to) === 1).sort((a, b) => (Number(b.createdOn) || Number(b.at) || 0) - (Number(a.createdOn) || Number(a.at) || 0)))
    for (const l of t.lines || []) { const id = String(l.itemId); if (!tn.has(id)) tn.set(id, { no: String(t.transferNo || '').replace(/^0+/, ''), at: Number(t.createdOn) || Number(t.at) || 0 }); }
  const inG = it => tn.has(String(it.id)) || pkCfg(it.id) || (Number(saleStockItem(g0, it.id)?.stock) || 0) > 0;   // v2.103.19: sirf is godam ka maal
  const cand = P.list.filter(it => ((Array.isArray(it.bq) && it.bq.length) || pkCfg(it.id) || tn.has(String(it.id))) && inG(it));
  const TN = q ? [] : [...tn.keys()].map(id => P.byId.get(id)).filter(Boolean);
  const L = (q ? smartSearch(cand, q, 80) : cand.filter(it => !tn.has(String(it.id))).sort((a, b) => (pkCfg(b.id) ? 1 : 0) - (pkCfg(a.id) ? 1 : 0) || String(a.name).localeCompare(String(b.name)))).slice(0, 80);
  const row = it => { const id = String(it.id), cf = pkCfg(id), open = rk.pEd === id, sizes = [{ z: 1, b: it.code }, ...(it.bq || []).map(x => ({ z: Number(x.q) || 1, b: x.b }))].filter((x, i, a) => x.z > 0 && a.findIndex(y => Math.abs(y.z - x.z) < 1e-9) === i);
    const dr = rk.pDraft.get(id) || { g: Number(cf?.g) || g0, p: Object.fromEntries(Object.entries(cf?.p || {}).map(([z, o]) => [z, { n: o.n, a: o.a || o.n }])) };
    if (open && !rk.pDraft.has(id)) rk.pDraft.set(id, dr);
    const t0 = tn.get(id), sS = saleStockItem(1, id), gS = saleStockItem(dr.g || g0, id), hs = Object.entries(cf?.p || {}).map(([z, o]) => `${pkName(Number(z), it)} ${o.n}`).join(' · ');
    return `<div class="rk-ps${cf ? ' is-in' : ''}"><button type="button" class="rk-psh" data-rkp-ed="${esc(id)}"><span><b>${cf ? '✓ ' : ''}${esc(it.name)}</b><span class="rk-chips">${t0 ? `<i class="rk-c pc">⇄ TN #${esc(t0.no || '—')} · ${esc(rkWhen(t0.at))}</i>` : ''}${hs ? `<i class="rk-c own">🔁 re-order: ${esc(hs)}</i>` : t0 ? '<i class="rk-c kh">re-order baqi</i>' : ''}</span><small>📦 dukan <b>${num(r3(Number(sS?.stock) || 0))}</b> · ${esc(branchName(dr.g || g0, names))} <b>${num(r3(Number(gS?.stock) || 0))}</b> ${esc(it.uName || '')}</small><small>${sizes.map(x => `${esc(pkName(x.z, it))}${x.b ? ' · ' + esc(String(x.b)) : ''}`).join('  ·  ')}</small></span><i>${open ? '▴' : '▾'}</i></button>
      ${open ? `<div class="rk-psb"><div class="rk-mode">${gods.map(g => `<button type="button" class="${dr.g === g ? 'is-in' : ''}" data-rkp-g="${esc(id)}|${g}">🏬 ${esc(branchName(g, names))}</button>`).join('')}</div>
        ${sizes.map(x => { const k = String(+x.z.toFixed(4)), o = dr.p[k]; return `<div class="rk-psr"><label class="rk-tk"><input type="checkbox" data-rkp-z="${esc(id)}|${k}"${o ? ' checked' : ''}><span><b>${esc(pkName(x.z, it))}</b><small>${esc(String(x.b || ''))}</small></span></label>${o ? `<label><small>🔁 re-order: itne bikein</small><input type="number" inputmode="numeric" min="1" step="1" data-rkp-n="${esc(id)}|${k}" value="${o.n || ''}" placeholder="likhein"></label><label><small>itne lao</small><input type="number" inputmode="numeric" min="1" step="1" data-rkp-a="${esc(id)}|${k}" value="${o.a || ''}" placeholder="${o.n || 'utne hi'}"></label>` : ''}</div>`; }).join('')}
        <div class="rk-ed">${cf ? `<button type="button" class="rk-au" data-rkp-del="${esc(id)}">🗑 Hatao</button>` : ''}<button type="button" class="rk-sv" data-rkp-sv="${esc(id)}">✓ Save</button></div></div>` : ''}</div>`; };
  return `<section class="rk-g rk-pset"><div class="rk-gh"><b>⚙️ Packet-war items</b><button type="button" class="rk-all" data-rkp-set="0">✕ Band</button></div>
    ${gods.length > 1 ? `<div class="rk-mode rk-pgs">${gods.map(g => `<button type="button" class="${g === g0 ? 'is-in' : ''}" data-rkp-pg="${g}">🏬 ${esc(branchName(g, names))}</button>`).join('')}</div>` : ''}
    <label class="hs-search"><input type="search" data-rkp-qs="1" placeholder="🔍 item (garam masala, ilaichi…)" value="${esc(rk.pq)}" autocomplete="off"></label>
    <div id="rkPkList">${TN.length ? `<div class="rk-tnh">⇄ ${esc(branchName(g0, names))} → ${esc(branchName(1, names))} transfer notes se <b>${num(TN.length)}</b> items <small>tap = re-order likhein</small></div>${TN.map(row).join('')}<div class="rk-tnh rk-tnh2">Baqi kai barcode wale items</div>` : ''}${L.map(row).join('') || (TN.length ? '' : '<p class="rk-note">Is godam mein kai barcode wala koi item nahi mila.</p>')}</div></section>`;
}
// ---- v2.103.26: 🧮 GODAM 2 MILAO — malik: "godam 2 mein items add kar liye, ab wohi items dukan ka stock adjust + har barcode ka % (kitna
//   reh jaye to transfer note)". Godam 2 (naam se, collect().g2) ke stock wale items; har barcode (packet) ki rack par ginti -> kul (kg) = dukan ki
//   GINTI (writeCount branch 1 — farq purane farq-bill raaste se POS mein) + packet-war cfg (rackPk: g = Godam 2, at = abhi, p[z] = {b: gina, pct,
//   n = b − floor(b·pct%), a = n}) — PC packet ginti pehle se karta hai; jab b ka pct% reh jaye -> packet transfer note "250 gm × 7".
let gm = null;
const gmSizes = it => [{ z: 1, b: it?.code }, ...((it?.bq) || []).map(x => ({ z: Number(x.q) || 1, b: x.b }))].filter((x, i, a) => x.z > 0 && a.findIndex(y => Math.abs(y.z - x.z) < 1e-9) === i).sort((a, b) => b.z - a.z);
const gmDone = id => { const cf = pkCfg(id); return !!cf && Object.values(cf.p || {}).some(o => Number(o?.b) > 0); };
function gmList() {
  const C = collect(), g2 = C.g2; if (g2 == null) return { g2: null, L: [] };
  const P = agPool(), seen = new Set(), L = [];
  for (const c of rows.filter(r => !r.meta && Array.isArray(r.items) && r.branch === g2)) for (const x of c.items) { const id = String(x?.id ?? ''); if (!id || seen.has(id)) continue; const gs = Number(x.stock) || 0; if (!(gs > 0)) continue; seen.add(id);
    const it = P.byId.get(id) || x, sI = saleStockItem(1, id); L.push({ id, it, gs, ss: Number(sI?.stock) || 0, sI }); }
  return { g2, L: L.sort((a, b) => String(a.it.name).localeCompare(String(b.it.name))) };
}
export function gmOpen() {
  start(true); rackWatch(); gm = { q: '', tab: 'baqi', ed: '', dr: new Map(), busy: '' };
  const d = $('dialog'); if (!d) return; d.classList.remove('search-dialog'); d.classList.add('full-dialog'); $('dialogTitle').textContent = '🧮 Godam 2 milao — dukan stock + packet %'; $('dialogBody').innerHTML = '<div class="rk-root" id="gmBody"></div>'; if (!d.open) d.showModal(); gmPaint();
}
function gmDraft(r) { let dr = gm.dr.get(r.id); if (dr) return dr; const cf = pkCfg(r.id), def = rackPct() || 20; dr = { n: {}, p: {} };
  for (const x of gmSizes(r.it)) { const k = String(+x.z.toFixed(4)), o = cf?.p?.[k]; dr.n[k] = o && Number(o.b) > 0 ? String(o.b) : ''; dr.p[k] = Number(o?.pct) || def; }
  gm.dr.set(r.id, dr); return dr; }
const gmTot = (r, dr) => r3(gmSizes(r.it).reduce((t, x) => t + (Number(dr.n[String(+x.z.toFixed(4))]) || 0) * x.z, 0));
function gmSumHTML(r, tot, far) { const U = esc(r.it?.uName || 'kg'); return `<span>Rack par kul <b>${num(tot)} ${U}</b></span><span>POS dukan <b>${num(r3(r.ss))}</b></span><span class="${far < 0 ? 'neg' : far > 0 ? 'pos' : ''}">Farq <b>${far > 0 ? '+' : ''}${num(far)} ${U}</b></span>`; }
function gmPaint(only) {
  const el = $('gmBody'); if (!el || !gm) return; const names = collect().names || {}, { g2, L } = gmList();
  if (g2 == null) { el.innerHTML = '<div class="th-empty">🏬<b>Godam 2 nahi mila</b><small>POS mein "Godam 2" naam ka godam chahiye</small></div>'; return; }
  const done = L.filter(r => gmDone(r.id)), baqi = L.filter(r => !gmDone(r.id)), q = gm.q.trim();
  let V = gm.tab === 'done' ? done : baqi; if (q) V = smartSearch(L.map(r => ({ ...r, name: r.it.name, code: r.it.code })), q, 60);
  const U = it => esc(it?.uName || 'kg');
  const row = r => { const open = gm.ed === r.id, ok = gmDone(r.id), dr = open ? gmDraft(r) : null, tot = dr ? gmTot(r, dr) : 0, far = r3(tot - r.ss), guess = r3(r.ss - r.gs);
    return `<div class="rk-ps${ok ? ' is-in' : ''}"><button type="button" class="rk-psh" data-gm-ed="${esc(r.id)}"><span><b>${ok ? '✓ ' : ''}${esc(r.it.name)}</b><span class="rk-chips">${ok ? '<i class="rk-c own">✓ mil gaya</i>' : '<i class="rk-c kh">baqi</i>'}<i class="rk-c pc">${num(gmSizes(r.it).length)} barcode</i></span><small>🏪 POS dukan <b>${num(r3(r.ss))}</b> · 🏬 ${esc(branchName(g2, names))} <b>${num(r3(r.gs))}</b> ${U(r.it)}</small></span><i>${open ? '▴' : '▾'}</i></button>
      ${open ? `<div class="rk-psb"><p class="rk-note">Dukan ke rack par har packet gin kar likhein · andaza (POS dukan − Godam 2) = <b>${num(Math.max(0, guess))} ${U(r.it)}</b></p>
        ${gmSizes(r.it).map(x => { const k = String(+x.z.toFixed(4)); return `<div class="gm-r"><div class="gm-l"><b>${esc(pkName(x.z, r.it))}</b><small>${esc(String(x.b || ''))}</small></div><label class="gm-n"><input type="number" inputmode="decimal" min="0" step="any" data-gm-n="${esc(r.id)}|${k}" value="${esc(dr.n[k])}" placeholder="0"><small>packet</small></label>
          <div class="gm-pc"><small>% reh jaye to lao</small><span>${[10, 20, 30, 40].map(v => `<button type="button" class="${Number(dr.p[k]) === v ? 'is-in' : ''}" data-gm-p="${esc(r.id)}|${k}|${v}">${v}%</button>`).join('')}</span></div></div>`; }).join('')}
        <div class="gm-sum" id="gmSum-${esc(r.id)}">${gmSumHTML(r, tot, far)}</div>
        <div class="rk-ed"><button type="button" class="rk-sv" data-gm-sv="${esc(r.id)}"${gm.busy ? ' disabled' : ''}>${gm.busy === r.id ? '⏳ Save…' : '✓ Save — dukan stock + packet %'}</button></div></div>` : ''}</div>`; };
  const html = `<div class="rk-hero"><div><small>GODAM 2 MILAO</small><b>${num(baqi.length)} items baqi</b><span>${num(done.length)} ho gaye · kul ${num(L.length)}</span></div><span class="rk-ic">🧮</span></div>
    <p class="rk-note">Har item: dukan ke rack par har barcode (packet) gino → dukan ka POS stock usi hisaab se theek (farq bill), aur har packet ka % — utna reh jaye to packet transfer note khud.</p>
    ${!roundNow() ? `<div class="rk-z0"><b>📋 Stock ginti shuru nahi</b><small>Dukan ka stock theek karne ke liye pehle Stock → "📋 Nayi ginti shuru" (malik). Tab tak sirf packet % save hoga.</small></div>` : ''}
    <div class="mchips"><button type="button" class="rc${gm.tab === 'baqi' ? ' on' : ''}" data-gm-tab="baqi">⏳ Baqi (${num(baqi.length)})</button><button type="button" class="rc${gm.tab === 'done' ? ' on' : ''}" data-gm-tab="done">✓ Ho gaye (${num(done.length)})</button></div>
    <label class="hs-search"><input type="search" data-gm-q="1" placeholder="🔍 item dhoondo…" value="${esc(gm.q)}" autocomplete="off"></label>
    <div id="gmList">${V.map(row).join('') || `<div class="th-empty">🧮<b>${gm.tab === 'done' && !q ? 'Abhi koi nahi' : q ? 'Nahi mila' : 'Sab ho gaye ✓'}</b></div>`}</div>`;
  if (only) { const t = document.createElement('div'); t.innerHTML = html; const a = t.querySelector('#gmList'), b = el.querySelector('#gmList'); if (a && b) { b.innerHTML = a.innerHTML; return; } }
  el.innerHTML = html;
}
async function gmSave(id) {
  const { g2, L } = gmList(), r = L.find(x => x.id === id); if (!r || gm.busy) return;
  if (!isOwner() && !can('stock.g2milao')) { notice('Is kaam ki ijazat nahi — malik se kahein'); return; }   // v2.103.27: mulazim bhi (rules 2.63)
  const dr = gmDraft(r), sizes = gmSizes(r.it), p = {}; let any = false;
  for (const x of sizes) { const k = String(+x.z.toFixed(4)), b = Math.max(0, Number(dr.n[k]) || 0), pct = Number(dr.p[k]) || 20; if (!(b > 0)) continue; any = true; const n = Math.max(1, Math.round(b - Math.floor(b * pct / 100))); p[k] = { n, a: n, b, pct }; }
  if (!any && !confirm(`${r.it.name}: koi packet nahi likha — dukan ka stock ZERO save karein?`)) return;
  gm.busy = id; gmPaint();
  const tot = gmTot(r, dr), per = Number(r.sI?.pack || r.it.pack) || 0, ctn = per > 1 ? Math.floor(tot / per + 1e-9) : 0, pcs = r3(tot - ctn * (per > 1 ? per : 0));
  const msg = [];
  try {
    if (roundNow() && !countLocked()) { await writeCount({ id, name: r.it.name, stock: r.ss, pack: per }, { ctn, pcs, total: tot }, null, false, 1); msg.push(`dukan ginti ${num(tot)} (farq ${num(r3(tot - r.ss))})`); }
    else msg.push('⚠️ ginti round nahi — dukan stock baad mein');
    if (any && cloud?.setRackPk) { const v = { g: g2, at: Date.now(), p }; await cloud.setRackPk(id, v); itemCfg = { ...(itemCfg || {}), rackPk: { ...(itemCfg?.rackPk || {}), [id]: JSON.stringify(v) } }; msg.push(Object.entries(p).map(([z, o]) => `${pkName(Number(z), r.it)} ${o.b}→${o.pct}%`).join(' · ')); }
    notice(`✓ ${r.it.name} — ${msg.join(' · ')}`); gm.ed = ''; gm.dr.delete(id);
  } catch (e) { notice('⚠️ Save nahi hua: ' + (e?.message || e)); }
  gm.busy = ''; gmPaint();
}
document.addEventListener('click', e => {
  const t = e.target.closest?.('[data-gm-ed],[data-gm-tab],[data-gm-p],[data-gm-sv]'); if (!t || !gm || !t.closest('#gmBody')) return; const d = t.dataset;
  if (d.gmEd) { gm.ed = gm.ed === d.gmEd ? '' : d.gmEd; gmPaint(); return; }
  if (d.gmTab) { gm.tab = d.gmTab; gmPaint(); return; }
  if (d.gmP) { const [id, k, v] = d.gmP.split('|'), r = gmList().L.find(x => x.id === id); if (!r) return; gmDraft(r).p[k] = Number(v); gmPaint(); return; }
  if (d.gmSv) { gmSave(d.gmSv); return; }
});
document.addEventListener('input', e => { const t = e.target; if (!gm) return;
  if (t?.dataset?.gmQ != null) { gm.q = t.value || ''; clearTimeout(gmPaint.t); gmPaint.t = setTimeout(() => gmPaint(true), 160); return; }
  if (t?.dataset?.gmN) { const [id, k] = t.dataset.gmN.split('|'), r = gmList().L.find(x => x.id === id); if (!r) return; const dr = gmDraft(r); dr.n[k] = t.value; const box = document.getElementById('gmSum-' + id); if (box) { const tot = gmTot(r, dr); box.innerHTML = gmSumHTML(r, tot, r3(tot - r.ss)); } }
});
async function rkpGo(g) {
  if (!rk || rk.busy) return; const all = pkDue().filter(y => String(y.g) === String(g)), P = rkPick('p' + g, all.map(y => String(y.r.i))), ys = all.filter(y => P.has(String(y.r.i)));
  const lines = [], noteP = [];
  for (const y of ys) { let qty = 0; const parts = []; for (const p of y.packs) { const k = String(y.r.i) + '|' + p.z, n = Math.max(0, Math.floor(rk.pQ.has(k) ? rk.pQ.get(k) : p.a)); if (!n) continue; qty += n * p.z; parts.push(`${p.name}×${n}`); }
    qty = r3(qty); if (!(qty > 0)) continue; lines.push({ id: String(y.r.i), name: y.name, ctn: 0, pcs: qty }); noteP.push(`${y.name} ${parts.join(', ')}`); }
  if (!lines.length) { notice('Koi packet nahi chuna'); return; }
  rk.busy = 'p' + g; rkPaint();
  try { const r = await stockAgentTransfer({ from: Number(g), to: 1, lines, note: ('📦 ' + noteP.join(' · ')).slice(0, 300) });
    if (r?.ok || r?.pending) { const t = Date.now(); for (const l of lines) pkSent.set(l.id, t); rk.man.delete('p' + g); notice(r.ok ? `🖨 Packet transfer note ${r.no ? '#' + r.no + ' ' : ''}bana — printer par` : '⏳ ' + r.why); } else notice('⚠️ Nahi bana: ' + (r?.why || 'masla'));
  } catch (e) { notice('⚠️ ' + (e?.message || e)); }
  if (rk) { rk.busy = ''; rkPaint(); }
}
async function rkGo(g) {
  if (!rk || rk.busy) return; const P = rkGroups(rackDue(), rkQOf).get(String(g)) || [], S = rkPick('r' + g, P), ys = rackDue().filter(y => String(y.x.g) === String(g) && S.has(String(y.x.i)));
  const lines = ys.map(y => { const v = rk.sel.has(String(y.x.i)) ? rk.sel.get(String(y.x.i)) : y.c.q; return y.c.pk ? { id: String(y.x.i), name: y.x.n, ctn: Math.floor(v / y.c.pk), pcs: 0 } : { id: String(y.x.i), name: y.x.n, ctn: 0, pcs: v }; }).filter(l => l.ctn > 0 || l.pcs > 0);
  if (!lines.length) { notice('Koi item nahi chuna'); return; }
  rk.busy = String(g); rkPaint();
  try { const r = await stockAgentTransfer({ from: Number(g), to: 1, lines, note: '🧺 Rack bharo' });
    if (r?.ok || r?.pending) { const t = Date.now(); for (const l of lines) { rackSent.set(String(l.id), t); rk.extra.delete(String(l.id)); } rk.man.delete('r' + g); const left = (rkGroups(rackDue(), rkQOf).get(String(g)) || []).length; notice(r.ok ? `🖨 Patti ${r.no ? '#' + r.no + ' ' : ''}printer par (${lines.length} items)${left ? ` — agle ${Math.min(left, rk.n || left)} par ✓ lag gaya` : ' — sab ho gaya ✓'}` : '⏳ ' + r.why); }
    else notice('⚠️ Nahi bana: ' + (r?.why || 'masla'));
  } catch (e) { notice('⚠️ ' + (e?.message || e)); }
  if (rk) { rk.busy = ''; rkPaint(); }
}
document.addEventListener('click', e => {
  const t = e.target.closest?.('[data-rk-all],[data-rk-go],[data-rk-e],[data-rk-sv],[data-rk-au],[data-rk-md],[data-rk-off],[data-rk-on],[data-rkp-set],[data-rkp-go],[data-rkp-ed],[data-rkp-g],[data-rkp-sv],[data-rkp-del],[data-rkp-pg],[data-rk-zall],[data-rk-n],[data-rk-add],[data-rk-hd],[data-rk-pct]'); if (!t || !rk || !t.closest('#rkBody')) return; const d = t.dataset;
  if (d.rkMd || d.rkOff || d.rkOn) { const id = d.rkMd ? d.rkMd.split('|')[0] : (d.rkOff || d.rkOn), old = rackCfg(id) || {};
    const v = d.rkMd ? { ...old, mode: d.rkMd.split('|')[1] || undefined } : d.rkOff ? { ...old, off: true } : { ...old, off: undefined };
    const clean = Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined && x !== '' && x !== false)), nv = Object.keys(clean).length ? clean : null;
    if (d.rkOff && !confirm('Ye item rack list mein kabhi nahi aayega (sirf godam se bikta hai). Theek?')) return;
    itemCfg = { ...(itemCfg || {}), rack: { ...(itemCfg?.rack || {}), [id]: nv } }; rk.sel.delete(id); if (!d.rkMd) rk.ed = ''; rkPaint();
    cloud?.setRackCfg?.(id, nv).then(() => notice(d.rkOff ? '🚫 Rack list se hata diya' : d.rkOn ? '↺ Wapas list mein' : '✓ Badal diya')).catch(er => notice('Save nahi hua: ' + (er?.message || er))); return; }
  if (d.rkpSet != null) { rk.pset = d.rkpSet === '1'; rkPaint(); return; }
  if (d.rkpPg) { rk.pg = Number(d.rkpPg); try { localStorage.setItem('sam-rk-pg', String(rk.pg)); } catch {} rk.pEd = ''; rkPaint(); return; }   // v2.103.19: packet-war ka godam
  if (d.rkZall) { rk.zAll = !rk.zAll; rkPaint(); return; }
  if (d.rkpGo) { rkpGo(d.rkpGo); return; }
  if (d.rkpEd) { rk.pEd = rk.pEd === d.rkpEd ? '' : d.rkpEd; rkPaint(); return; }
  if (d.rkpG) { const [id, g] = d.rkpG.split('|'); const dr = rk.pDraft.get(id); if (dr) dr.g = Number(g); rkPaint(); return; }
  if (d.rkpSv || d.rkpDel) { const id = d.rkpSv || d.rkpDel, dr = rk.pDraft.get(id), old = pkCfg(id);
    const p = Object.fromEntries(Object.entries(dr?.p || {}).filter(([, o]) => o && Number(o.n) > 0).map(([z, o]) => [z, { n: Math.max(1, Math.round(Number(o.n))), a: Math.max(1, Math.round(Number(o.a) || Number(o.n))) }]));
    if (d.rkpSv && !Object.keys(p).length) { notice('Re-order likhein — kitne bikein to lao'); return; }
    const v = d.rkpDel || !Object.keys(p).length ? null : { g: dr.g, at: old?.at || Date.now(), p };
    if (!cloud?.setRackPk) { notice('App update karein'); return; }
    itemCfg = { ...(itemCfg || {}), rackPk: { ...(itemCfg?.rackPk || {}), [id]: v ? JSON.stringify(v) : null } }; rk.pDraft.delete(id); rk.pEd = ''; rkPaint();
    cloud.setRackPk(id, v).then(() => notice(v ? '✓ Packet-war save — PC 2 min mein ginna shuru' : '🗑 Hata diya')).catch(er => notice('Save nahi hua: ' + (er?.message || er))); return; }
  if (d.rkAll) { const ids = rkGroups(rackDue(), rkQOf).get(d.rkAll) || [], cur = rkPick('r' + d.rkAll, ids); rk.man.set('r' + d.rkAll, cur.size === ids.length ? new Set() : new Set(ids)); rkPaint(); return; }
  if (d.rkAdd) { rk.extra.set(String(d.rkAdd), 1); const x = rkSynth(d.rkAdd); notice(`➕ ${x?.n || 'Item'} list mein — 1 ${Number(x?.pk) > 1 ? 'carton' : 'pcs'}`); rk.q = ''; rkPaint(); return; }
  if (d.rkPct != null) { const v = Number(d.rkPct); if (!cloud?.setRackPct) { notice('App update karein'); return; } itemCfg = { ...(itemCfg || {}), rackPct: v }; rk.man.clear(); rkPaint(); cloud.setRackPct(v).then(() => notice(v ? `📊 Sirf jab ${v}% ya kam bache` : '📊 Sab (% ki shart nahi)')).catch(er => notice('Save nahi hua: ' + (er?.message || er))); return; }
  if (d.rkHd != null) { const v = Number(d.rkHd); if (!cloud?.setRackLo) { notice('App update karein'); return; } itemCfg = { ...(itemCfg || {}), rackLo: v }; rk.man.clear(); rkPaint(); cloud.setRackLo(v).then(() => notice(`📉 Hadd: dukan mein ${rkHdName(v)} reh jaye to lao`)).catch(er => notice('Save nahi hua: ' + (er?.message || er))); return; }
  if (d.rkN != null) { rk.n = Math.max(0, Number(d.rkN) || 0); try { localStorage.setItem('sam-rk-n', String(rk.n)); } catch {} rk.man.clear(); rkPaint(); return; }
  if (d.rkGo) { rkGo(d.rkGo); return; }
  if (d.rkE) { rk.ed = rk.ed === d.rkE ? '' : d.rkE; rkPaint(); return; }
  if (d.rkSv || d.rkAu) { const id = d.rkSv || d.rkAu, u = Number($('rkBody').querySelector(`[data-rk-u="${CSS.escape(id)}"]`)?.value) || 0, w = Number($('rkBody').querySelector(`[data-rk-w="${CSS.escape(id)}"]`)?.value) || 0;
    const keep = Object.fromEntries(Object.entries(rackCfg(id) || {}).filter(([k]) => k === 'mode' || k === 'off')), v0 = d.rkAu ? keep : { ...keep, ...(u > 0 ? { u } : {}), ...(w > 0 ? { q: w } : {}) }, v = Object.keys(v0).length ? v0 : null;
    if (!cloud?.setRackCfg) { notice('App update karein'); return; }
    itemCfg = { ...(itemCfg || {}), rack: { ...(itemCfg?.rack || {}), [id]: v } }; rk.ed = ''; rk.sel.delete(id); rkPaint();
    cloud.setRackCfg(id, v).then(() => notice(v ? '✓ Qaida save' : '↺ Ab khud hisaab')).catch(er => notice('Save nahi hua: ' + (er?.message || er))); }
});
document.addEventListener('change', e => { const t = e.target; if (!rk || !t.closest?.('#rkBody')) return; const d = t.dataset;
  if (d.rkT) { const y = rackDue().find(z => String(z.x.i) === d.rkT); if (y) { const g = String(y.x.g); rkToggle('r' + g, rkGroups(rackDue(), rkQOf).get(g) || [], d.rkT, t.checked); } rkPaint(); return; }
  if (d.rkpT) { const y = pkDue().find(z => String(z.r.i) === d.rkpT); if (y) { const g = String(y.g); rkToggle('p' + g, pkDue().filter(z => String(z.g) === g).map(z => String(z.r.i)), d.rkpT, t.checked); } rkPaint(); return; }
  if (d.rkpQ) { rk.pQ.set(d.rkpQ, Math.max(0, Math.floor(Number(t.value) || 0))); return; }
  if (d.rkpZ) { const [id, z] = d.rkpZ.split('|'), dr = rk.pDraft.get(id); if (dr) { if (t.checked) dr.p[z] = dr.p[z] || { n: '', a: '' }; else delete dr.p[z]; } rkPaint(); return; }
  if (d.rkpN || d.rkpA) { const [id, z] = (d.rkpN || d.rkpA).split('|'), dr = rk.pDraft.get(id); if (dr?.p[z]) dr.p[z][d.rkpN ? 'n' : 'a'] = Number(t.value) > 0 ? Math.floor(Number(t.value)) : ''; return; }
  if (d.rkQty) { const y = rackDue().find(z => String(z.x.i) === d.rkQty); if (!y) return; const n = Math.max(0, Math.floor(Number(t.value) || 0)), pcs = y.c.pk ? n * y.c.pk : n; rk.sel.set(d.rkQty, Math.min(pcs, y.c.pk ? Math.floor(y.c.gs / y.c.pk) * y.c.pk : Math.floor(y.c.gs))); if (pcs > 0) rk.off.delete(d.rkQty); rkPaint(); } });
document.addEventListener('input', e => { const t = e.target; if (rk && t?.dataset?.rkpQs != null) { rk.pq = t.value || ''; clearTimeout(rkQT); rkQT = setTimeout(() => rkPaint('pk'), 160); return; } if (rk && t?.dataset?.rkQ != null) { rk.q = t.value || ''; clearTimeout(rkQT); rkQT = setTimeout(() => rkPaint(true), 160); } });
let rkQT = 0;
document.addEventListener('close', e => { if (e.target?.id === 'dialog' && rk) { rk = null; if (document.querySelector('.th-root')) rerender(); } }, true);
export const _rkTest = { pkDue, rackCalc, rackDue, rackLocalRows, set rows(v) { rackRows = v; }, set cfg(v) { itemCfg = v; } };
export function renderTransferHub(canDo = () => true) {
  thWatch(); rackWatch(); canDoRk = canDo;
  const names = collect().names || {}, today = regDay(Date.now()), y = new Date(); y.setDate(y.getDate() - 1); const yest = regDay(y.getTime());
  const all = tcAll().filter(t => t && !t.cancelled && t.at >= Date.now() - 3 * 864e5).sort((a, b) => b.at - a.at);
  // v2.99.80: malik — "register se carton piece": ⚖️ carton ginti (jaise 4 = 1) wahi jo Transfer register mein; asal (ca) chhota sa
  const tot = list => { let c = 0, ca = 0, p = 0; for (const t of list) for (const l of t.lines || []) { const x = cp(Number(l.qty) || 0, Number(l.pack) || 0); c += ctnG(x.c, ctnOf(l.itemId, l.name)); ca += x.c; p += x.p; } return { c: r2(c), ca: r2(ca), p: Math.round(p * 1000) / 1000 }; };
  const td = all.filter(t => regDay(t.at) === today), T = tot(td);
  const st = all.filter(t => Date.now() - tcIssued(t) < 2 * 864e5).map(t => tcState(t).k), pend = st.filter(k => k === 'wait' || k === 'late').length, late = st.filter(k => k === 'late').length, farq = st.filter(k => k === 'farq').length;
  const job = (trList || []).find(j => j.status !== 'done' && j.status !== 'failed' && Date.now() - j.at < 10 * 60000);
  $('summary').innerHTML = `<div class="thh"><div class="thh-head"><span class="thh-ic">⇄</span><div><small>GODAM SE GODAM</small><b>Transfer notes</b></div>${job ? '<span class="thh-pill wait">⏳ PC bana raha hai</span>' : `<span class="thh-pill">${td.length} aaj</span>`}</div>
    <div class="thh-bal"><strong>${num(T.c)} <small>Ctn</small>${T.p ? ` + ${num(T.p)} <small>Pcs</small>` : ''}</strong><span>aaj ${td.length} note · ${td.reduce((n, t) => n + (t.lines || []).length, 0)} items${T.c !== T.ca ? ` · <em class="thh-asal">asal ${num(T.ca)} ctn</em>` : ''}</span></div>
    <div class="thh-stats"><div class="${pend ? 'w' : 'ok'}"><span>${pend ? '⏳' : '✓'}</span><div><small>Check baqi</small><b>${pend}</b></div></div><div class="${late ? 'bad' : 'ok'}"><span>⏰</span><div><small>Late (2 ghante+)</small><b>${late}</b></div></div><div class="${farq ? 'bad' : 'ok'}"><span>⚠️</span><div><small>Farq</small><b>${farq}</b></div></div></div></div>`;
  const stChip = t => { const s = tcState(t); return s.k === 'ok' ? '<span class="th-chip ok">✓ Pohancha</span>' : s.k === 'farq' ? '<span class="th-chip bad">⚠️ Farq</span>' : s.ng ? '<span class="th-chip bad">📦 De diya tick nahi</span>' : s.k === 'late' ? `<span class="th-chip bad">⏰ ${tcAgo(s.age)}</span>` : `<span class="th-chip w">⏳ ${tcAgo(s.age)}</span>`; };
  const own = isOwner();
  const row = (t, dd) => { const x = tot([t]); const k = esc(tcKey(t)); return `<div class="th-rw"><button type="button" class="th-row" data-th-tc="${k}" data-th-d="${dd}"><span class="th-tn">TN<b>${esc(String(t.transferNo || '').replace(/^0+/, '') || '—')}</b></span><span class="th-mid"><b>${esc(branchName(t.from, names))} ➜ ${esc(branchName(t.to, names))}</b><small>${(t.lines || []).length} items · ${num(x.c)} ctn${x.p ? ' + ' + num(x.p) + ' pcs' : ''}${x.c !== x.ca ? ' (asal ' + num(x.ca) + ')' : ''} · ${esc(regClock(t.at))}${t.app ? ' · 📱' : ''}${Number(t.editCount) > 0 ? ' · ✏️' : ''}</small></span>${stChip(t)}</button>${own ? `<details class="th-more"><summary aria-label="Aur">⋯</summary><div><button type="button" data-th-prn="${esc(String(t.transferId))}">🖨 Dobara print</button><button type="button" data-th-edit="${esc(String(t.transferId))}">✏️ Edit</button><button type="button" class="danger" data-th-cancel="${esc(String(t.transferId))}">❌ Cancel</button></div></details>` : ''}</div>`; };
  const grp = [[today, 'Aaj'], [yest, 'Kal']].map(([d, l]) => { const g = all.filter(t => regDay(t.at) === d); return g.length ? `<section class="th-day"><div class="th-dh"><b>${l}</b><span>${g.length} note</span></div>${g.slice(0, 40).map(t => row(t, d === today ? 1 : 2)).join('')}</section>` : ''; }).join('');
  const tile = (k, ic, t, sub, cls) => `<button type="button" class="th-tile ${cls}" data-th="${k}"><span>${ic}</span><b>${t}</b><small>${sub}</small></button>`;
  $('list').innerHTML = `<div class="th-root"><div class="th-tiles">${canDo('stock.transfer') ? tile('new', '➕', 'Naya transfer note', 'Sirf majood maal · Ctn mein · ⤓ Sara', 'a') : ''}${canDo('stock.g2milao') && collect().g2 != null ? (() => { const { L } = gmList(), b = L.filter(r => !gmDone(r.id)).length; return tile('g2m', '🧮', 'Godam 2 milao', L.length ? (b ? `${b} items baqi` : 'Sab mil gaye ✓') : 'Godam 2 mein stock nahi', 'b'); })() : ''}${canDo('stock.rack') ? (() => { const n = rackDue().length + pkDue().length; return tile('rack', '🧺', 'Rack bharo', (n ? `${n} items godam se lane` : rackAt || irData ? 'Sab rack bhare ✓' : 'Data aa raha hai') + (rackZero.length && isOwner() ? ` · ⚠️ ${rackZero.length} pcs 0` : ''), 'c' + (n ? ' rk-hot' : '')).replace('</button>', n ? `<i class="rk-badge">${n}</i></button>` : '</button>'); })() : ''}${canDo('stock.tc') ? tile('tc', '🧾', 'Transfer check', pend ? pend + ' baqi · scan karein' : 'Maal pohancha? Scan', 'b') : ''}${canDo('stock.reg') ? tile('reg', '📋', 'Transfer register', 'Din-war · PDF', 'c') : ''}</div>
    ${grp || '<div class="th-empty">⇄<b>Aaj / kal koi transfer note nahi</b><small>"Naya transfer note" se banayein</small></div>'}</div>`;
}
document.addEventListener('click', e => { const b = e.target.closest?.('[data-th],[data-th-reg],[data-th-tc],[data-th-prn],[data-th-edit],[data-th-cancel]'); if (!b) return; const d = b.dataset;
  if (d.thTc) { tcDays = Number(d.thD) === 2 ? 2 : 1; tcDir = 'all'; tcOpen.add(d.thTc); openTransferCheck('nikle');   // v2.99.68: note par tap = us ka check
    setTimeout(() => { const el = [...document.querySelectorAll('[data-tc-open]')].find(x => x.dataset.tcOpen === d.thTc); if (el) { el.scrollIntoView({ block: 'center' }); el.closest('.tc-n')?.classList.add('tc-flash'); } }, 500); return; }
  if (d.thPrn || d.thEdit || d.thCancel) { thAct(d, b); return; }
  const k = d.th || 'reg';
  if (k === 'rack') { rackOpen(); return; }   // v2.103.14
  if (k === 'g2m') { gmOpen(); return; }   // v2.103.26
  if (k === 'new') { if (trEdit) { trEdit = null; trLines = []; } openTransfer(); } else if (k === 'tc') openTransferCheck(); else openRegister(); });
// v2.99.68: 🖨 / ✏️ / ❌ — sirf malik. App ka note: job id se print (dobara-print ginti) · POS ka: 'pos:<TransferID>' (transfer-sync v4.7)
function thAct(d, b) {
  if (!isOwner()) { notice('Sirf malik'); return; }
  const id = String(d.thPrn || d.thEdit || d.thCancel), t = tcAll().find(x => String(x.transferId) === id); if (!t) { notice('Note nahi mila'); return; }
  b.closest('details')?.removeAttribute('open');
  const job = (trList || []).find(j => j.status === 'done' && j.op !== 'delete' && String(j.transferId) === id);
  if (d.thPrn) {
    const reason = prompt(`TN ${t.transferNo} — dobara print ki wajah:`); if (reason == null) return; if (!reason.trim()) { notice('Wajah likhna zaroori hai'); return; }
    const cps = Math.min(3, Math.max(1, Number(prompt('Kitni dafa chhapein? (1-3)', String(trCopies))) || 1));
    cloud.requestPrint({ kind: 'transfer', id: job ? job.id : 'pos:' + id, reason: reason.trim().slice(0, 100), copies: cps }).then(() => notice('🖨 Dobara print PC ko bheja')).catch(er => notice(er?.message || 'Nahi hua'));
    return;
  }
  if (d.thCancel) {
    const reason = prompt(`❌ TN ${t.transferNo} cancel karein?\n${branchName(t.from, collect().names)} → ${branchName(t.to, collect().names)} · ${(t.lines || []).length} items\nDono godam ka stock wapas ho jayega.\n\nWajah likhein:`); if (reason == null) return; if (!reason.trim()) { notice('Wajah likhna zaroori hai'); return; }
    cloud.requestTransfer({ op: 'delete', from: t.from, to: t.to, transferId: t.transferId, lines: t.lines || [], force: !t.app, reason: reason.trim().slice(0, 150) }).then(() => notice('❌ Cancel ka hukum PC ko bheja')).catch(er => notice(er?.message || 'Nahi hua'));
    return;
  }
  // ✏️ edit: wahi form, items bhare hue
  const { items } = collect();
  trFrom = Number(t.from); trTo = Number(t.to); trNote = '';
  trEdit = { id: Number(t.transferId), no: String(t.transferNo || '').replace(/^0+/, ''), from: Number(t.from), lines: (t.lines || []).map(l => ({ itemId: String(l.itemId), qty: Number(l.qty) || 0 })) };
  trLines = (t.lines || []).map(l => { const it = items.find(x => String(x.id) === String(l.itemId)) || {}; const pk = Number(l.pack ?? it.pack) || 0, q = Number(l.qty) || 0, c = pk > 1 ? Math.floor(q / pk + 1e-9) : 0;
    return trCalc({ id: l.itemId, name: l.name || it.name || 'Item', pack: pk, cName: it.cName || 'Ctn', uName: it.uName || 'Pcs', ctn: c, pcs: pk > 1 ? Math.round((q - c * pk) * 1000) / 1000 : q, qty: 0 }); });
  openTransfer();
}
// v2.99.88: 🏭 FACTORY (factory.js) — "apni factory" category (isFactory: category mein 'factory') ki items, dukan (main godam) ka stock,
//   rates fi PIECE (POS jaisa: rate = CTN wala fi piece, rate2 = khula piece, wrate = W CTN fi piece, ws = W piece) + label ke barcode.
// v2.99.89: pick(r) -> true (malik ne ☑ kiya) / false (hataya) / null (category se: isFactory)
export function stockFactoryList(pick) {
  const P = agPool();
  return P.list.filter(r => { const v = pick ? pick(r) : null; return v == null ? isFactory(r) : !!v; }).map(r => {
    const s = saleStockItem(P.main, r.id), pk = Number(r.pack) > 1 ? Number(r.pack) : 0;
    return { id: String(r.id), name: String(r.name || ''), code: String(r.code || ''), pack: pk, cn: r.cName || 'Ctn', un: r.uName || 'Pcs', cat: String(r.cat || ''),
      stock: Number(s?.stock) || 0, prate: Number(r.prate) || 0, rate: Number(r.rate) || 0, rate2: Number(r.rate2) || Number(r.rate) || 0,
      wrate: Number(r.wrate) || Number(r.rate) || 0, ws: Number(r.ws) || Number(r.wrate) || Number(r.rate) || 0, urdu: urduOf(r.id),
      labels: labelRows(r).filter(x => x.show !== false).map(x => ({ code: x.code, qty: Number(x.qty) || 1, price: Number(x.price) || 0, main: !!x.main })) };
  });
}
export const stockFactoryMain = () => agPool().main;
export const stockFactoryCanRate = () => canEditItem();
// v2.99.89: ☑ factory items chunne ke liye — dukan ki saari items (halki) + category wali pehchaan · stock screen dobara
export function stockPickList() { const P = agPool(); return P.list.map(r => ({ id: String(r.id), name: String(r.name || ''), code: String(r.code || ''), cat: String(r.cat || ''), catFac: isFactory(r), stock: Number(saleStockItem(P.main, r.id)?.stock) || 0, pack: Number(r.pack) > 1 ? Number(r.pack) : 0, cn: r.cName || 'Ctn', un: r.uName || 'Pcs' })); }
export function stockRepaint() { if (stockActive) soft(); }
export const stockIsFactoryCat = r => isFactory(r);
// v2.101.1: 🏭 factory "photo se formula" — naya item FORAN line mein (intezar nahi) -> jobId (PC band ho tab bhi theek: ⏳ job:)
export async function stockNewItemQuick(v) {
  if (!canNewItem()) throw Error('Naya item — malik ki ijazat chahiye');
  if (!cloud?.requestItem) throw Error('App update karein');
  const pk = Number(v.pack) > 1 ? Number(v.pack) : 0, costP = Math.max(0, Number(v.costP) || 0), rp = Math.max(0, Number(v.rpcs) || 0), wp = Math.max(0, Number(v.wpcs) || rp);
  const job = { op: 'new', itemId: '', code: String(v.code || '').trim(), name: String(v.name || '').trim().slice(0, 150), pack: pk, costP, rctn: pk ? r2(rp * pk) : 0, rpcs: rp, wctn: pk ? r2(wp * pk) : 0, wpcs: wp };
  if (!job.name) throw Error('Item ka naam chahiye');
  return await cloud.requestItem(job);
}

// v2.101.1: 🏭 FACTORY ki 📊 Ginti tab (factory.js) — wahi stockCount docs, dukan godam (main); PC ginti-post wahi
export function stockCountsOn() { try { start(true); } catch {} }
export function stockCountState() { return { round: roundNow(), autoOn, locked: countLocked(), owner: isOwner(), see: seeStock() }; }
export const stockOpenGinti = () => openGinti();
function fcItem(itemId) { const P = agPool(); const r = P.byId.get(String(itemId)); if (!r) return null; return { ...r, stock: Number(saleStockItem(P.main, r.id)?.stock) || 0 }; }
export function stockCountInfo(itemId) {
  const r = fcItem(itemId); if (!r) return null; const P = agPool(); const c = countOf(P.main, r);
  const sys = c ? Number(sysOf(c, r)) : r.stock, total = c ? countedPcs(c) : null, farq = c ? Math.round((total - sys) * 100) / 100 : 0;
  const bi = billOf(r, c, P.main);
  return { c, sys, stock: r.stock, total, farq, rs: c && r.prate ? Math.round(farq * r.prate) : 0, bill: bi, at: c?.at || 0, hist: Array.isArray(c?.history) ? c.history : [], byName: c?.byName || '', see: seeStock() };
}
export async function stockCountSet(itemId, v) {
  const r = fcItem(itemId); if (!r) throw Error('Item nahi mila');
  if (!roundNow()) throw Error(isOwner() ? 'Ginti shuru nahi — Stock screen ⚙️ "Ginti khud POS mein" ON karein' : 'Malik ne ginti shuru nahi ki');
  if (countLocked()) throw Error('🔴 Malik ne counting band ki hui hai');
  const per = Number(r.pack) || 0, ctn = per > 1 ? Number(v.ctn) || 0 : 0, pcs = Number(v.pcs) || 0, total = Math.round((ctn * (per > 1 ? per : 1) + pcs) * 100) / 100;
  if (!Number.isFinite(total) || total < 0) throw Error('Sirf hindse');
  await writeCount(r, { ctn, pcs, total, bad: false }, null, false, agPool().main);
  if (flagOf(r.id).baqi) await setFlag(r.id, { baqi: false });
  return total;
}
export async function stockCountDel(itemId) {
  if (!isOwner()) throw Error('Sirf malik'); const r = fcItem(itemId); if (!r) throw Error('Item nahi mila'); const P = agPool(), c = countOf(P.main, r); if (!c) return;
  await cloud.saveStockCount({ ...c, id: countId(P.main, r.id), del: true, delAt: Date.now(), at: Date.now(), total: Number(c.sys0 ?? c.sys) || 0, ctn: 0, pcs: 0 });
}

// v2.101.1: 🏭 factory se seedha (stock screen par jaye baghair) — naya item (🏭 / 📦 tick laga hua), item edit, label, ⏳ PC baqi list
export function stockNewItemOpen(o = {}) { if (!canNewItem()) { notice('🔒 Naya item — malik ki ijazat chahiye'); return; } itemForm(null, { _fac: !!o.fac, _pack: !!o.pack, ...(o.name ? { name: String(o.name) } : {}), ...(o.code ? { code: String(o.code) } : {}) }); }   // v2.101.6: naam / barcode pehle se
function fcRow(id) { const P = agPool(), r = P.byId.get(String(id)); if (!r) return null; const x = { ...r, stock: Number(saleStockItem(P.main, r.id)?.stock) || 0 }; rowCache.set(String(r.id), x); return x; }
export function stockItemOpen(id) { const r = fcRow(id); if (!r) { notice('Item POS mein nahi mila (⏳ PC baqi ho to "PC baqi" list se edit)'); return; } itemForm(r, null); }
export function stockLabelOpen(id) { const r = fcRow(id); if (!r) { notice('Item POS mein nahi mila'); return; } openLabels(String(r.id)); }
export function stockIjobsOpen() { ijDlg(); }
export const stockIjCounts = () => ({ pend: ijPend().length, bad: ijBad().length });
export const stockCanItem = () => ({ edit: canEditItem(), add: canNewItem() });
