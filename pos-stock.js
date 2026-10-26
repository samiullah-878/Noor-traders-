// pos-stock.js — POS ka stock (posStock collection) app mein dikhata hai
// Data sirf padha jata hai. Likhne ka kaam PC par chalne wala sync-stock.js karta hai.

import { smartSearch, setAliases, aliasOf, noteHit, voiceSearch, hlName, smartHit, fold, topItems } from './smart-search.js?v=2.127.0';
import { liveLabelsHTML } from './barcode.js?v=2.127.0';   // v2.97: 🖨 label live + ✕ cancel (wahi module jo app.js — ek hi nusqha)
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
let postReq = null, postQ = null;
let hidden = {};   // item id -> true (Band kiye hue items, sab branches mein chhupe)
let bandDone = { items: {}, fail: {} };   // v2.103.55: PC post-farq ka jawab (stockCount/_bandDone) — kis band item ka POS kaam ho gaya / fail
let counts = new Map(), round = '', stopCount = null, isOwner = () => false;
// v2.101.1: 📋 GINTI KHUD POS MEIN (malik: "physical likhein, Save — PC bill saath saath banata rahe, dobara gino to edit") —
//   stockCount/_auto {on}: round = aaj ka din (YYYY-MM-DD) khud; har count doc {auto, sys0, pfAt, pfAdj, pfQ, del} — PC ginti-post.js
//   roz ke ek POS Adjustment "Ginti <din> NT" mein har Save ka farq (delta) jorta hai; dobara gino = agla delta, hatao = ulta.
let lateRuleOn = false;   // v2.103.31: stockCount/_late {on}
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
const seeStock = () => isOwner() || (can('stock.see') && !roz);   // v2.109.0: 📋 roz ki ginti mein larke ko stock nazar nahi (andaza na lagaye)
// v1.49: _flags (baqi / check nishan), _lock (malik ne ginti band ki)
let flags = {}, countOff = false;
const flagOf = id => flags[String(id)] || {};
const countLocked = () => (countOff || (!can('stock.count') && !rozCanHere())) && !isOwner();   // v2.109.0: roz ki ginti ki ijazat = us jagah ginti

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
  if (!trStop && opts?.cloud?.listenTransfers) trStop = opts.cloud.listenTransfers(trGot);   // v2.6: transfer shuru se (aaya hua maal ke liye)
  if (!ijStop && opts?.cloud?.listenItemJobs) ijStop = opts.cloud.listenItemJobs(Date.now() - 7 * 86400000, ijGot);   // v2.99.91: ⏳ PC baqi items
  if (!ptStop && opts?.cloud?.listenPosTransfers) ptStop = opts.cloud.listenPosTransfers(list => { ptList = list || []; });   // v2.8: POS ke apne transfer (PC transfer-dekho.js)
  cloud = opts.cloud;
  auditOf = opts.audit || auditOf; nameOf = opts.name || nameOf; deviceOf = opts.device || deviceOf;   // v2.99.21: transfer check
  rerender = opts.rerender || (() => {});
  notice = opts.notice || (() => {});
  isOwner = opts.owner || (() => false);
  uidOf = opts.uid || uidOf;   // v2.99.92
  rozSid = opts.sid || rozSid;   // v2.109.0: 📋 roz ki ginti — larke ki pehchan (staffId)
}

// Snapshot par poori screen foran na banao: thora ruko, aur jab koi ginti likh raha ho to us ke baad
let softTimer = null, softWaiting = false;
function soft() {
  clearTimeout(softTimer);
  softTimer = setTimeout(() => {
    if ($('bdList')) try { bdPaint(); } catch {}   // v2.105.9: ⛔ band list khuli ho to PC ka jawab live
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
      list => { rows = list.map(fixCost); loaded = true; failed = ''; soft(); try { inLive(); } catch {} try { qtrMod?.qtrLive?.(); } catch {} },   // v2.103.4: 🟢 aaya/gaya live · v2.116.0: ⇄ khirki bhi
      e => { failed = e?.message || 'Stock load nahi hua'; loaded = true; stop = null; rerender(); }
    );
  }
  if (withCounts && !stopCount && cloud.listenStockCount) {
    stopCount = cloud.listenStockCount(list => {
      counts = new Map();
      round = list.find(r => r.id === '_round')?.round || ''; roundDoc = round;
      lateRuleOn = list.find(r => r.id === '_late')?.on === true;
      autoOn = !!list.find(r => r.id === '_auto')?.on; postedMap = new Map(list.filter(r => String(r.id).startsWith('_posted-')).map(r => [r.id, r])); roundNow();
      postReq = list.find(r => r.id === '_post') || null; postQ = list.find(r => r.id === '_postQ') || null;   // v2.109.0: 📋 ek click theek ki line
      hidden = list.find(r => r.id === '_hidden')?.items || {};
      { const bd = list.find(r => r.id === '_bandDone'); bandDone = { items: bd?.items || {}, fail: bd?.fail || {} }; }
      flags = list.find(r => r.id === '_flags')?.items || {};
      countOff = !!list.find(r => r.id === '_lock')?.off;
      bills = list.filter(r => String(r.id).startsWith('_bill-')).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
      list.forEach(r => { if (!String(r.id).startsWith('_') && !String(r.id).startsWith('pcwarn-')) counts.set(r.id, r); });
      pcWarnAll = list.filter(r => String(r.id).startsWith('pcwarn-')); try { pcSeen(list); } catch {}   // v2.110.0: 📡 PC ka jawab
      soft();
      try { gmLive(); } catch {}   // v2.103.29: 🧮 stock milao live (doosre larke ki ginti)
      try { if (farqMod && $('fqRoot')) farqMod.farqLive(stockRozApi()); } catch {}   // v2.113.0: ⚖️ stock farq live
    }, () => {}, pend => { pendCount = pend || new Set(); try { pcPaint(); } catch {} });   // v2.110.0: abhi sirf phone mein (server tak nahi)
    if (!pcTimer) pcTimer = setInterval(() => { try { pcTick(); } catch {} }, 5000);
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
      return `${stampText(h.at)}: ${num(h.ctn)}+${num(h.pcs)} = ${num(h.total)} · Farq ${hd > 0 ? '+' : ''}${num(hd)}${hWho(h, c) ? ' · ' + hWho(h, c) : ''}`;
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
// v2.103.55: band item ka PC status: 'done' (POS inactive), 'fail' (PC 3 dafa nakam), 'wait' (PC baqi)
const bandFailN = id => { const v = bandDone.fail[String(id)]; return Number(v && typeof v === 'object' ? v.n : v) || 0; };
const bandWhy = id => { const v = bandDone.fail[String(id)]; return v && typeof v === 'object' ? String(v.why || '') : ''; };
const bandSt = id => bandDone.items[String(id)] ? 'done' : bandFailN(id) >= 3 ? 'fail' : 'wait';
const bandChip = id => { const st = bandSt(id); return st === 'done' ? '<i class="rk-c ok">✓ POS inactive</i>' : st === 'fail' ? `<i class="rk-c kh" title="${esc(bandWhy(id))}">❌ PC nahi kar saka</i>${bandWhy(id) ? `<small class="rk-why">${esc(bandWhy(id).slice(0, 90))}</small>` : ''}${isOwner() ? `<button type="button" class="rk-retry" data-ro-bretry="${esc(id)}">🔁 dobara</button>` : ''}` : '<i class="rk-c lo">⏳ PC baqi</i>'; };
function bandPendList() { return Object.keys(hidden).filter(id => hidden[id] && bandSt(id) !== 'done').map(id => ({ id, name: bandNameOf(id), st: bandSt(id) })); }
// v2.105.9: ⛔ BAND LIST (Stock screen) — malik: "band kiya to stock mein aaye, POS on hote hi bill bane aur app yaad rakh kar deactive kare".
//   Sab band items (POS mein inactive ho kar posStock se ghaib ho chuke bhi). Naam: posStock → PC ka jawab (_bandDone) → mangwao → is phone ki yaad.
//   haal: wait = ⏳ PC baqi · fail = ❌ · done = ✓ POS deactive · live = 🟢 POS mein dobara chalu (posStock mein wapas = sync-stock sirf active bhejta hai).
let bdNm = null, bdIx = null, bdIxKey = null;
const bdNmGet = () => { if (!bdNm) { try { bdNm = JSON.parse(localStorage.getItem('sam-band-nm') || '{}') || {}; } catch { bdNm = {}; } } return bdNm; };
function bdNmPut(id, n, c) { if (!n) return; const M = bdNmGet(), k = String(id); if (M[k]?.n === n && M[k]?.c === (c || '')) return; M[k] = { n: String(n).slice(0, 80), c: String(c || '').slice(0, 40) }; try { localStorage.setItem('sam-band-nm', JSON.stringify(M)); } catch {} }
function bdIndex() { if (bdIx && bdIxKey === rows) return bdIx; const M = new Map(), sy = new Map();   // id → [{b, stock}] har godam se + godam ka aakhri sync
  for (const r of rows) { if (r.meta) { sy.set(r.branch, Number(r.syncedAt) || 0); continue; } if (!Array.isArray(r.items)) continue; for (const it of r.items) { if (!it || it.id == null) continue; const k = String(it.id); if (!M.has(k)) M.set(k, []); M.get(k).push({ b: r.branch, stock: Number(it.stock) || 0, it }); } }
  bdIx = { M, sy }; bdIxKey = rows; return bdIx; }
function bandNameOf(id) { const k = String(id), x = bdIndex().M.get(k)?.[0]?.it; return x?.name || bandDone.items[k]?.name || ro?.rows?.find(r => String(r.i) === k)?.n || bdNmGet()[k]?.n || ('Item #' + k); }
const BD_ORD = { fail: 0, wait: 1, live: 2, done: 3 };
function bandAll() {
  const ids = Object.keys(hidden).filter(id => hidden[id]); if (!ids.length) return [];
  const { M, sy } = bdIndex();
  return ids.map(id => {
    const at = M.get(id) || [], it = at[0]?.it, d = bandDone.items[id];
    if (it?.name) bdNmPut(id, it.name, it.code);
    let st = bandSt(id);
    if (st === 'done' && at.length) { const t = Number(d?.at) || 0; if (!t || at.some(x => (sy.get(x.b) || 0) > t + 15000)) st = 'live'; }   // PC ke deactive ke BAAD bhi sync mein = POS mein kisi ne chalu kiya
    return { id, name: bandNameOf(id), code: it?.code || d?.code || bdNmGet()[id]?.c || '', st, d, at };
  }).sort((a, b) => (BD_ORD[a.st] - BD_ORD[b.st]) || NAMEC.compare(a.name, b.name));
}
function bandCardHTML() {
  if (!canBand()) return ''; const L = bandAll(); if (!L.length) return '';
  const n = k => L.filter(b => b.st === k).length, w = n('wait'), f = n('fail'), lv = n('live'), dn = n('done');
  const bits = [w ? '⏳ ' + num(w) + ' PC baqi' : '', f ? '❌ ' + num(f) + ' nahi hua' : '', lv ? '🟢 ' + num(lv) + ' POS mein chalu' : '', dn ? '✓ ' + num(dn) + ' POS deactive' : ''].filter(Boolean).join(' · ');
  return `<button type="button" class="sk-band${f ? ' bad' : w ? ' hot' : ''}" data-stock-band="1"><span class="bi">⛔</span><span><b>Band items · ${num(L.length)}</b><small>${bits}</small>${w ? '<small class="sub">POS on hote hi khud: stock 0 ka bill + deactive</small>' : ''}</span><em>›</em></button>`;
}
let bdQ = '', bdMore = false;
function bandDlg(q = '') { const d = $('dialog'); if (!d) return; bdQ = String(q || ''); bdMore = false; d.classList.remove('search-dialog'); d.classList.add('full-dialog'); $('dialogTitle').textContent = '⛔ Band items';
  $('dialogBody').innerHTML = `<div class="bd-wrap"><label class="bd-q"><span>🔍</span><input type="search" data-bd-q="1" placeholder="Naam ya code…" value="${esc(bdQ)}" autocomplete="off"></label><div id="bdList"></div></div>`; if (!d.open) d.showModal(); bdPaint(); }
function bdPaint() {
  const el = $('bdList'); if (!el) return;
  const all = bandAll(), q = norm(bdQ), L = q ? all.filter(b => norm(b.name).includes(q) || fold(b.name).includes(fold(q)) || (b.code && String(b.code).toLowerCase().includes(q))) : all;
  const cnt = k => all.filter(b => b.st === k).length, names = collect().names || {};
  const kpi = (k, ic, t) => `<div class="bd-k ${k}"><b>${num(cnt(k))}</b><small>${ic} ${t}</small></div>`;
  const stk = b => seeStock() && b.at.length ? b.at.map(x => `${esc(branchName(x.b, names))} ${num(x.stock)}`).join(' · ') : '';
  const line = b => b.st === 'wait' ? `⏳ PC baqi — POS on hote hi stock 0 + deactive${stk(b) ? ' · abhi ' + stk(b) : ''}`
    : b.st === 'fail' ? `❌ PC nahi kar saka${bandWhy(b.id) ? ' — ' + esc(bandWhy(b.id).slice(0, 110)) : ''}`
    : b.st === 'live' ? `🟢 POS mein chalu hai — app mein abhi band${stk(b) ? ' · ' + stk(b) : ''}`
    : b.d?.note === 'purana' ? '✓ Pehle se band (purana)' : b.d?.note ? '✓ ' + esc(b.d.note) : `✓ POS mein deactive${(b.d?.bills || []).length ? ' · bill ' + esc(b.d.bills.slice(0, 3).join(', ')) : ''}${b.d?.at ? ' · ' + esc(stampText(b.d.at)) : ''}`;
  const row = b => `<div class="bd-row ${b.st}"><div class="bd-m"><b>${esc(b.name)}</b><small>${b.code ? esc(b.code) + ' · ' : ''}${line(b)}</small></div><div class="bd-a">${b.st === 'fail' && isOwner() ? `<button type="button" class="bd-re" data-ro-bretry="${esc(b.id)}">🔁 Dobara</button>` : ''}${canBand() ? `<button type="button" class="bd-on" data-band-on="${esc(b.id)}">↩️ Chalu</button>` : ''}</div></div>`;
  const grp = (k, t, cap) => { const g = L.filter(b => b.st === k); if (!g.length) return ''; const sh = cap && !bdMore && !q ? g.slice(0, cap) : g; return `<div class="bd-g"><h4>${t} <i>${num(g.length)}</i></h4>${sh.map(row).join('')}${sh.length < g.length ? `<button type="button" class="bd-more" data-bd-more="1">Aur ${num(g.length - sh.length)} dikhao</button>` : ''}</div>`; };
  el.innerHTML = all.length ? `<div class="bd-kpis">${kpi('wait', '⏳', 'PC baqi')}${kpi('fail', '❌', 'Nahi hua')}${kpi('live', '🟢', 'POS chalu')}${kpi('done', '✓', 'Deactive')}</div>
    <p class="bd-note">⛔ <b>Band</b> = POS mein stock 0 (stock fraq ka bill) + item <b>INACTIVE</b>. Server PC on hote hi <b>khud</b> hota hai — koi click nahi. Dukan band ho to PC on hone par.</p>
    ${grp('fail', '❌ PC nahi kar saka')}${grp('wait', '⏳ PC baqi')}${grp('live', '🟢 POS mein dobara chalu')}${grp('done', '✓ POS mein deactive', 40)}${q && !L.length ? '<p class="bd-note">Is naam ka koi band item nahi</p>' : ''}
    <p class="bd-foot">Naya band: Stock list mein item par ☐ <b>Band</b>, ya Rack bharo / Mangwao mein ⛔ — password ke saath. ↩️ Chalu = app + POS dono mein wapas (stock 0 hi rahega). POS mein khud chalu kiya ho to yahan 🟢 aayega.</p>`
    : '<p class="bd-note">✓ Koi item band nahi</p>';
}
document.addEventListener('input', e => { if (e.target?.matches?.('[data-bd-q]')) { bdQ = e.target.value || ''; bdPaint(); } });
document.addEventListener('click', e => { const t = e.target.closest?.('[data-band-on],[data-bd-more]'); if (!t) return; e.preventDefault();
  if (t.dataset.bdMore) { bdMore = true; bdPaint(); return; }
  bandAsk(t.dataset.bandOn, false).then(() => bdPaint()); });
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
const COUNT_SEL = '[data-count-ctn],[data-count-pcs],[data-count-tot],[data-count-pk]';   // v2.118.0: + 📦 packet patti
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
  const pkL = v.pkTxt ? `<span class="cnt-pkl">📦 ${esc(v.pkTxt)} →</span> ` : '';   // v2.118.0: packet se gina — kaise jora
  if (!seeStock()) { box.innerHTML = `${pkL}<b>${num(v.total)} ${esc(u)}</b>`; return; }
  box.innerHTML = `${pkL}<b>${num(v.total)} ${esc(u)}</b> · System ${num(sys)} · <b class="${diff < 0 ? 'red' : diff > 0 ? 'green' : ''}">Farq ${diff > 0 ? '+' : ''}${num(diff)} ${esc(u)}${diff < 0 ? ' (kam)' : diff > 0 ? ' (zyada)' : ' (barabar)'}</b>${item.prate && diff ? ' · Rs ' + (diff > 0 ? '+' : '') + num(diff * item.prate) : ''}`;
}
document.addEventListener('input', e => {
  const t = e.target;
  const id = t.dataset?.countCtn ?? t.dataset?.countPcs ?? t.dataset?.countTot ?? (t.dataset?.countPk ? String(t.dataset.countPk).split('|')[0] : undefined);
  if (id != null) liveCount(id);
});
let stockActive = false;
// v2.107.0: 🏭 FACTORY STOCK (factory ek-screen ka chip) — Stock screen par sirf factory items (☑ 🏭 Factory / category); baqi sab wahi
//   (ginti Ctn · Pcs · Kul, Save, ✓ Tick, label, item, band). Stock screen se bahar gaye = khud band (main.sk-screen hata).
let facOnly = false;
const isFacRow = r => { try { return !!window.ntFacIs?.(r); } catch { return false; } };
try { const mn = document.querySelector('main'); if (mn && window.MutationObserver) { let was = mn.classList.contains('sk-screen'); new MutationObserver(() => { const now = mn.classList.contains('sk-screen'); if (was && !now) facOnly = false; was = now; }).observe(mn, { attributes: true, attributeFilter: ['class'] }); } } catch {}
export const stockFacOnly = () => facOnly;
// ================= v2.109.0: 📋 ROZ KI GINTI (malik: "roz kuch items app khud de · har larke ko apne ALAG items — 4 larke = 4 guna · mahine / hafte mein poori
//   dukan + godam tally · farq ho to pehle doosri jagah dekhe · ek click theek + parchi"). Malik ki setting stockConfig.roz {on, n, locs:{nt,g1,g2,g3}} ·
//   stockCount/roz-<jagah> {day, b, taken:{itemId: sid}, by:{sid:{n, ids:[], at}}, want:{itemId:1}, hist:{din:{sid:[naam, liye, gine]}}} — larka transaction se N
//   items leta hai (cloud.rozClaim — do larkon ko ek item kabhi nahi). Ginti WAHI stockCount/c-<branch>-<id> (round = aaj, _auto). Jagah NAAM se (Noor · Godam 1/2/3).
//   Tarteeb: malik ka "dobara gino" → minus stock → 48 ghante mein hile (transfer) → kabhi nahi gine (qeemat zyada pehle) → sab se purane gine → 0 stock.
//   Aaj gine / transfer raste mein (3 ghante) / band = list mein nahi. Larke ko stock / farq nazar nahi. Dashboard + farq + ek click = roz.js.
const ROZ_LOC = [['nt', 'Noor Traders', '🏪', 'stock.rozdukan'], ['g1', 'Godam 1', '🏬', 'stock.rozg1'], ['g2', 'Godam 2', '🏬', 'stock.rozg2'], ['g3', 'Godam 3', '🏬', 'stock.rozg3']];
let roz = null, rozSid = () => '', rozBusy = false, rozPrevBranch;
const rozCfg = () => { const c = itemCfg?.roz || {}; return { on: c.on === true, n: [10, 20, 30].includes(Number(c.n)) ? Number(c.n) : 20, locs: c.locs || {} }; };
let brC = null, brKey = null;
function brInfo() { if (brC && brKey === rows) return brC; const chunks = rows.filter(r => !r.meta && Array.isArray(r.items)), names = {}, by = new Map();
  rows.forEach(r => { if (r.branch != null && r.name) names[r.branch] = r.name; });
  for (const c of chunks.slice().sort((a, b) => (a.order || 0) - (b.order || 0))) { if (!by.has(c.branch)) by.set(c.branch, []); by.get(c.branch).push(...c.items); }
  brC = { branches: [...by.keys()].sort((a, b) => a - b), names, by }; brKey = rows; return brC; }
const itemsOf = b => brInfo().by.get(Number(b)) || [];
// v2.113.0: jagah + id se item (Map — har dafa poori list nahi chhanni)
const itIdx = new WeakMap();
const itemAt = (b, id) => { const L = itemsOf(b); let m = itIdx.get(L); if (!m) { m = new Map(L.map(x => [String(x.id), x])); itIdx.set(L, m); } return m.get(String(id)) || null; };
function rozLocs(all) {   // jagah NAAM se (POS branch 2 ka naam "Godam 1" hai — number se nahi)
  const { branches, names } = brInfo(), find = rx => branches.find(b => rx.test(String(names[b] || ''))), C = rozCfg();
  const B = { nt: find(/noor/i) ?? (branches.includes(1) ? 1 : undefined), g1: find(/godam\s*-?\s*1\b/i), g2: find(/godam\s*-?\s*2\b/i), g3: find(/godam\s*-?\s*3\b/i) };
  return ROZ_LOC.filter(([k]) => B[k] != null && (all || C.locs[k] !== false)).map(([k, t, ic, cap]) => ({ k, t, ic, cap, b: B[k], name: branchName(B[k], names) }));
}
const rozDoc = k => { const d = counts.get('roz-' + k); return d && d.day === dayStr() ? d : null; };   // sirf aaj ka (purana din = khali)
// v2.117.0: ⏭ SKIP + ➕ MAZEED (malik: "larka kisi item ko skip karna chahe to kar sake — alag tab mein aaye, kisi aur larke ki list mein bhi na aaye, sirf
//   stock counting se deactive · larka mazeed items bhi gin sake"). stockCount/rozskip-<jagah> {loc, items: {itemId: {by (sid), n (naam), at, why, b, nm}}} —
//   hamesha (din badalne se nahi mitta). Skip = us jagah ki roz ginti se band (pool / list / mahine ka hisaab) — POS / stock / sale par asar nahi; skip par
//   us ki jagah 1 naya item. ↩ Wapas = malik ya jis ne skip kiya. ➕ Aur hamesha + search mein jagah ka koi bhi khula item → "➕ Main ginoon".
//   CAP stock.rozskip · stock.rozmore (shuru se ON). Rules nahi badle (stockCount non-_ doc mulazim likh sakta, counting band ho to nahi).
const ROZ_WHY = ['Maal nahi hai', 'Band / purana item', 'Ginna mushkil (khula)', 'Doosri jagah ka'];
let rozTab = 'list', rozSkipOpen = '', rozSkipWhy = '', rozGen = 0;
const rozSkips = k => { const d = counts.get('rozskip-' + k); return (d && d.items && typeof d.items === 'object') ? d.items : {}; };
const rozSkipOk = () => isOwner() || can('stock.rozskip');
const rozMoreOk = () => isOwner() || can('stock.rozmore');
const skScreen = () => !!document.querySelector('main')?.classList.contains('sk-screen');
const rozMine = k => { const d = rozDoc(k), me = d?.by?.[rozSid()], sk = rozSkips(k); return me && Array.isArray(me.ids) ? me.ids.map(String).filter(id => !sk[id]) : []; };
const rozCan = L => isOwner() || can(L.cap);
const rozCanHere = () => !!roz && rozCan(roz);
const rozGina = (b, id) => { const c = counts.get(countId(b, id)); return !!(c && c.round === dayStr() && !c.del); };
function rozPend(b) {   // transfer abhi POS mein nahi (job new / working) ya 3 ghante se kam purana note jo abhi mila nahi = aaj mat gino (farq ghalat aata)
  const out = new Set(), T = Date.now();
  for (const j of trList || []) { if (!['new', 'working'].includes(j.status) || (Number(j.from) !== b && Number(j.to) !== b)) continue; for (const l of j.lines || []) if (l.itemId != null) out.add(String(l.itemId)); }
  try { for (const t of tcAll()) { const at = tcIssued(t); if (!at || T - at > 3 * 3600e3 || t.cancelled || (Number(t.from) !== b && Number(t.to) !== b)) continue; const st = tcState(t).k; if (st === 'ok' || st === 'farq' || st === 'hisaab') continue; for (const l of t.lines || []) if (l.itemId != null) out.add(String(l.itemId)); } } catch {}
  return out;
}
function rozPool(L) {
  const d = rozDoc(L.k), taken = d?.taken || {}, want = counts.get('roz-' + L.k)?.want || {}, T = Date.now(), moved = new Set(), pend = rozPend(L.b), sk = rozSkips(L.k);   // v2.117.0: ⏭ skip = kisi ki list mein nahi
  for (const t of ptLive()) { const at = Number(t.createdOn) || Number(t.at) || 0; if (T - at > 48 * 3600e3 || (Number(t.from) !== L.b && Number(t.to) !== L.b)) continue; for (const l of t.lines || []) if (l.itemId != null) moved.add(String(l.itemId)); }
  const list = [];
  for (const r of itemsOf(L.b)) { const id = String(r.id), c = counts.get(countId(L.b, id)), wt = Number(want[id]) || 0, again = wt > (Number(c?.at) || 0);   // malik: dobara ginwao (gine ke baad laga)
    if (isHidden(r) || sk[id] || pend.has(id) || ((taken[id] || rozGina(L.b, id)) && !again)) continue;
    const last = c && !c.del ? Number(c.at) || 0 : 0, st = Number(r.stock) || 0;
    const w = again ? 0 : st < 0 ? 1 : moved.has(id) ? 2 : !last ? (st === 0 ? 5 : 3) : 4;
    list.push({ id, w, last, v: Math.abs(st * (Number(r.prate) || 0)), n: String(r.name || '') }); }
  list.sort((a, b) => a.w - b.w || a.last - b.last || b.v - a.v || NAMEC.compare(a.n, b.n));
  return list.map(x => x.id);
}
function rozHistOf(d0) {   // naya din: kal ke har larke ka [naam, liye, gine] (mahine ka hisaab)
  const o = {}; for (const [sid, m] of Object.entries(d0?.by || {})) { const ids = Array.isArray(m?.ids) ? m.ids.map(String) : [];
    o[sid] = [String(m?.n || '').slice(0, 40), ids.length, ids.filter(id => { const c = counts.get(countId(d0.b, id)); return c && c.round === d0.day && !c.del; }).length]; }
  return o;
}
async function rozClaim(L, nn) {
  if (!cloud?.rozClaim) throw Error('App update karein');
  const sid = rozSid(); if (!sid) throw Error('Login ki pehchan nahi mili — dobara login karein');
  const n = Math.max(1, Number(nn) || rozCfg().n), pool = rozPool(L).slice(0, n * 5);   // v2.117.0: nn = skip ki jagah 1
  if (!pool.length) return [];
  return cloud.rozClaim({ loc: L.k, b: L.b, day: dayStr(), ids: pool, sid, name: whoName(), n, histFn: rozHistOf });
}
async function rozEnter(k, opts = {}) {
  const L = rozLocs().find(x => x.k === k); if (!L) { notice('Ye jagah roz ki ginti mein nahi (malik: ⚙️)'); return; }
  if (!rozCfg().on) { notice('📋 Roz ki ginti malik ne band rakhi hai'); return; }
  if (!rozCan(L)) { notice('🔒 ' + L.name + ' ki ginti ki ijazat nahi (malik: Settings → Mulazim)'); return; }
  if (!roz) rozPrevBranch = branch;
  roz = L; branch = L.b; inPick = null; facOnly = false; limit = 200; const s = $('search'); if (s) s.value = ''; rerender();
  if (!rozMine(k).length || opts.more) await rozTake(opts.more);
}
async function rozTake(more) {
  if (!roz || rozBusy) return;
  if (countOff && !isOwner()) { notice('🔴 Malik ne counting band ki hui hai — malik se ON karwayein'); return; }   // rules bhi mana karte (_lock.off)
  // v2.117.0: malik ka "Main bhi ginoon" — list aate waqt (net ki der) screen ek pal badli to roz band ho jata tha → roz.name null = "Items nahi mile: Cannot
  //   read properties of null" (items naam ho chuke, list nahi khulti). Ab jagah pehle se yaad (L); khud band hua (✕ / godam nahi) = wapas list.
  const L = roz, g0 = rozGen;
  rozBusy = true; rerender();
  try { const got = await rozClaim(L);
    if (!roz && rozGen === g0 && skScreen()) { rozPrevBranch = branch; roz = L; branch = L.b; }
    if (!got.length) notice(more ? '✓ Is jagah ke liye aaj aur items baqi nahi' : '✓ Is jagah ke sab items aaj gine ja chuke / liye ja chuke'); else notice(`📋 ${got.length} items aap ke — ${L.name} (kisi aur ke paas nahi)`); }
  catch (e) { notice('Items nahi mile: ' + (e?.message || e)); }
  finally { rozBusy = false; rerender(); }
}
// v2.117.0: ⏭ skip (us ki jagah 1 naya item) · ↩ wapas · ➕ search wala ek item
async function rozSkipGo(id) {
  if (!roz || rozBusy) return; const L = roz, r = itemAt(L.b, id);
  if (!rozSkipOk()) { notice('⏭ Skip ki ijazat nahi (malik: Settings → Mulazim)'); return; }
  if (countOff && !isOwner()) { notice('🔴 Malik ne counting band ki hui hai — malik se ON karwayein'); return; }
  if (!cloud?.rozSkip) { notice('App update karein'); return; }
  rozBusy = true; rerender();
  try { await cloud.rozSkip({ loc: L.k, b: L.b, day: dayStr(), id: String(id), sid: rozSid(), name: whoName(), why: rozSkipWhy, iname: r?.name || '' });
    rozSkipOpen = ''; rozSkipWhy = '';
    let got = []; try { got = await rozClaim(L, 1); } catch {}
    notice(`⏭ ${r?.name || 'Item'} — ${L.name} ki ginti se band${got.length ? ' · us ki jagah naya item list mein' : ''}`); }
  catch (e) { notice('Skip nahi hua: ' + (e?.message || e)); }
  finally { rozBusy = false; rerender(); }
}
async function rozUnskipGo(id) {
  if (!roz || rozBusy) return; const L = roz, x = rozSkips(L.k)[String(id)];
  if (!isOwner() && String(x?.by || '') !== rozSid()) { notice('↩ Sirf malik ya jis ne skip kiya'); return; }
  if (!cloud?.rozUnskip) { notice('App update karein'); return; }
  rozBusy = true; rerender();
  try { await cloud.rozUnskip({ loc: L.k, id: String(id) }); notice(`↩ ${itemAt(L.b, id)?.name || x?.nm || 'Item'} — wapas ${L.name} ki ginti mein`); }
  catch (e) { notice('Nahi hua: ' + (e?.message || e)); }
  finally { rozBusy = false; rerender(); }
}
async function rozAddOne(id) {
  if (!roz || rozBusy) return; const L = roz;
  if (!rozMoreOk()) { notice('➕ Mazeed items ki ijazat nahi (malik: Settings → Mulazim)'); return; }
  if (countOff && !isOwner()) { notice('🔴 Malik ne counting band ki hui hai — malik se ON karwayein'); return; }
  const sid = rozSid(); if (!cloud?.rozClaim || !sid) { notice('App update karein / dobara login'); return; }
  rozBusy = true; rerender();
  try { const got = await cloud.rozClaim({ loc: L.k, b: L.b, day: dayStr(), ids: [String(id)], sid, name: whoName(), n: 1, histFn: rozHistOf });
    notice(got.length ? `➕ ${itemAt(L.b, id)?.name || 'Item'} — aap ki list mein` : 'Ye item ab kisi aur ke paas hai'); }
  catch (e) { notice('Nahi hua: ' + (e?.message || e)); }
  finally { rozBusy = false; rerender(); }
}
function rozExit() { if (!roz) return; roz = null; if (rozPrevBranch !== undefined) branch = rozPrevBranch; rozPrevBranch = undefined; limit = PAGE; rozTab = 'list'; rozSkipOpen = ''; }
// v2.117.0: Stock screen se nikle = roz band — magar ek pal ki class-badli (render) par nahi (400 ms baad bhi sk-screen na ho tab)
try { const mn = document.querySelector('main'); if (mn && window.MutationObserver) { let was = mn.classList.contains('sk-screen'), tm = null; new MutationObserver(() => { const now = mn.classList.contains('sk-screen'); if (was && !now) { clearTimeout(tm); tm = setTimeout(() => { if (!mn.classList.contains('sk-screen')) rozExit(); }, 400); } was = now; }).observe(mn, { attributes: true, attributeFilter: ['class'] }); } } catch {}
function rozStripHTML(mine) {
  const done = mine.filter(r => rozGina(roz.b, r.id)).length, all = mine.length, n = rozCfg().n, fin = all && done >= all, skN = Object.keys(rozSkips(roz.k)).length;
  const more = fin || (all && rozMoreOk() && !(countOff && !isOwner()));   // v2.117.0: ➕ hamesha (list poori hone ka intezar nahi)
  return `<div class="in-strip roz-strip${fin ? ' fin' : ''}"><span class="rz-t">📋 Aaj ki ginti — <b>${esc(roz.name)}</b></span><span class="rz-n">${rozBusy ? '⏳ …' : !all ? '' : fin ? '✅ ' + num(done) + ' / ' + num(all) + ' — shabash!' : '✓ ' + num(done) + ' / ' + num(all)}</span>
    ${more ? `<button type="button" class="rz-more" data-roz-more="1"${rozBusy ? ' disabled' : ''}>➕ Aur ${num(n)}</button>` : ''}<button type="button" class="rz-x" data-roz-x="1" aria-label="Band">✕</button>
    ${!all && !rozBusy && rozTab === 'list' ? (countOff && !isOwner() ? '<small class="rz-note">🔴 Malik ne counting band ki hui hai — malik se ON karwayein</small>' : `<small class="rz-note">Aaj aap ke liye koi item nahi — ➕ dabayein ya malik se poochhein</small><button type="button" class="rz-more" data-roz-more="1">➕ ${num(n)} items lo</button>`) : ''}
    ${all || skN || rozTab === 'skip' ? `<div class="rz-tabs" role="tablist"><button type="button" class="${rozTab === 'list' ? 'is-in' : ''}" data-roz-tab="list">📋 Meri list <i>${num(all)}</i></button><button type="button" class="${rozTab === 'skip' ? 'is-in' : ''}" data-roz-tab="skip">⏭ Skip <i>${num(skN)}</i></button></div>` : ''}</div>`;
}
// v2.117.0: ⏭ skip ki chhoti khirki (item ke neeche) · ⏭ Skip tab · ➕ search mein jagah ke baqi khule items
function rozSkipBoxHTML(r) {
  return `<div class="rz-skip" data-rz-skipbox="${esc(r.id)}"><b>⏭ Skip — ${esc(r.name)}</b><small>${esc(roz.name)} ki ginti se band — kisi larke ki list mein nahi aayega (stock / POS par asar nahi). Us ki jagah naya item milega. Wajah (zaroori nahi):</small>
    <div class="rz-why">${ROZ_WHY.map(w => `<button type="button" class="${rozSkipWhy === w ? 'is-in' : ''}" data-roz-why="${esc(w)}">${esc(w)}</button>`).join('')}</div>
    <div class="rz-sk-acts"><button type="button" class="rz-sk-go" data-roz-skipgo="${esc(r.id)}"${rozBusy ? ' disabled' : ''}>⏭ Skip karo</button><button type="button" class="rz-sk-no" data-roz-skipno="1">Nahi</button></div></div>`;
}
function rozSkipTabHTML(byId) {
  const sk = rozSkips(roz.k), me = rozSid(), own = isOwner();
  const L = Object.entries(sk).filter(([, x]) => x && typeof x === 'object').map(([id, x]) => ({ id, x, r: byId.get(String(id)) })).sort((a, b) => (Number(b.x.at) || 0) - (Number(a.x.at) || 0));
  if (!L.length) return '<div class="th-empty rz-sk-empty">⏭<b>' + esc(roz.name) + ' mein koi item skip nahi</b><small>Meri list mein item par "⏭ Skip" dabayein — wo is jagah ki ginti se band ho jayega</small></div>';
  return `<p class="stat-note">⏭ ${num(L.length)} item${L.length === 1 ? '' : 's'} ${esc(roz.name)} ki ginti se band — kisi larke ki list mein nahi aate (stock / POS par asar nahi). ↩ Wapas = phir ginti mein.</p>
    <div class="rz-sks">${L.map(({ id, x, r }) => `<div class="rz-skr"><span><b>${esc(r?.name || x.nm || 'Item ' + id)}</b><small>⏭ ${esc(x.n || '—')} · ${esc(stampText(x.at))}${x.why ? ' · ' + esc(x.why) : ''}</small></span>${own || String(x.by || '') === me ? `<button type="button" data-roz-unskip="${esc(id)}"${rozBusy ? ' disabled' : ''}>↩ Wapas</button>` : ''}</div>`).join('')}</div>`;
}
function rozFindMore(q, mine) {   // search: jagah ke wo items jo kisi ke paas nahi, aaj gine nahi, skip / band nahi (rozPool wahi qaida)
  const pool = new Set(rozPool(roz)), have = new Set(mine.map(r => String(r.id)));
  return smartSearch(itemsOf(roz.b).filter(r => pool.has(String(r.id)) && !have.has(String(r.id))), q, 12);
}
function rozMoreHTML(list) {
  return `<div class="rz-mores"><p class="stat-note">➕ ${esc(roz.name)} ke aur items — kisi ke paas nahi, aaj gine nahi. "➕ Main ginoon" = aap ki list mein:</p>${list.map(r => `<div class="rz-mr"><span><b>${esc(r.name)}</b><small>${esc(r.code || '')}</small></span><button type="button" data-roz-add="${esc(r.id)}"${rozBusy ? ' disabled' : ''}>➕ Main ginoon</button></div>`).join('')}</div>`;
}
// 📋 larke ka bara button Stock par (phone par upar ki chip ⋮ mein chhup jati hai — yahan seedha nazar aaye). Malik = tile + dashboard.
function rozBigHTML() {
  if (roz || isOwner() || !loaded || !rozCfg().on) return '';
  const L = rozLocs().filter(rozCan); if (!L.length) return '';
  let done = 0, all = 0; for (const x of L) { const m = rozMine(x.k); all += m.length; done += m.filter(id => rozGina(x.b, id)).length; }
  const fin = all && done >= all, where = L.map(x => x.name).join(' · ');
  return `<button type="button" class="sk-big roz${fin ? ' fin' : ''}" data-roz-open="1"><span class="bi">${fin ? '✅' : '📋'}</span><span><b>${fin ? 'Aaj ki list poori · ' + num(done) + ' / ' + num(all) : all ? 'Aaj ki list · ✓ ' + num(done) + ' / ' + num(all) : 'Aaj ki list — aap ke ' + num(rozCfg().n) + ' items'}</b><small>${esc(where)} · ${countOff ? '🔴 malik ne counting band ki hui hai' : fin ? 'shabash! aur lene hon to tap' : all ? num(all - done) + ' baqi — tap, jari rakhein' : 'tap karein — items milenge (har larke ke alag)'}</small></span><em>›</em></button>`;
}
// 🏷 upar ki chip (home bar) — larka: "📋 Ginti 7/20" · malik: jagah-war
export function stockRozChip() {
  const C = rozCfg(); if (!C.on || !cloud) return null;
  if (!loaded) { if (!isOwner() && ROZ_LOC.some(x => can(x[3]))) start(); return null; }
  const L = rozLocs().filter(rozCan); if (!L.length) return null;
  if (isOwner()) { const per = L.map(x => { const d = rozDoc(x.k), ids = Object.keys(d?.taken || {}); return { x, n: ids.length, done: ids.filter(id => rozGina(x.b, id)).length }; });
    const t = per.reduce((a, p) => a + p.done, 0), all = per.reduce((a, p) => a + p.n, 0);
    return { t: `📋 Ginti ${num(t)}${all ? ' / ' + num(all) : ''}`, cls: all && t >= all ? 'ok' : all ? 'warn' : '', n: all ? `roz ki ginti ${num(t)} / ${num(all)}` : 'roz ki ginti abhi shuru nahi' }; }
  let done = 0, all = 0; for (const x of L) { const m = rozMine(x.k); all += m.length; done += m.filter(id => rozGina(x.b, id)).length; }
  return { t: all ? `📋 Ginti ${num(done)} / ${num(all)}` : '📋 Aaj ki ginti', cls: all && done >= all ? 'ok' : 'warn', n: all ? (done >= all ? 'aaj ki ginti poori ✓' : `aaj ki ginti baqi ${num(all - done)}`) : 'aaj ki ginti shuru karein' };
}
// 📋 kholna: larka — ek jagah = seedha list · zyada = chunao · malik = dashboard (roz.js)
export async function stockRozOpen(k) {
  if (!cloud) return; start();
  if (!loaded) { notice('⏳ Stock aa raha hai — 2 second baad dobara'); return; }
  if (isOwner() && !k) { try { (await import('./roz.js?v=2.127.0')).rozDash(stockRozApi()); } catch (e) { notice('Nahi khula: ' + (e?.message || e)); } return; }
  const L = rozLocs().filter(rozCan);
  if (!rozCfg().on) { notice('📋 Roz ki ginti malik ne band rakhi hai'); return; }
  if (!L.length) { notice('🔒 Roz ki ginti ki ijazat nahi (malik: Settings → Mulazim → 📋 Roz ki ginti)'); return; }
  const go = x => { try { window.ntRecentOpen?.({ open: { kind: 'stock', screen: 'roz', k: x } }); } catch { rozEnter(x); } };
  if (k || L.length === 1) { go(k || L[0].k); return; }
  try { (await import('./roz.js?v=2.127.0')).rozPick(stockRozApi(), go); } catch (e) { notice('Nahi khula: ' + (e?.message || e)); }
}
// roz.js ke liye andar ka saman (sirf parhna + wahi kaam jo buttons karte hain)
export function stockRozApi() {
  return { cloud, notice, esc, num, isOwner: () => isOwner(), can, sid: () => rozSid(), who: () => whoName(), day: dayStr, cfg: rozCfg, locs: rozLocs, doc: rozDoc, rawDoc: k => counts.get('roz-' + k) || null, mine: rozMine, gina: rozGina, pool: rozPool, pend: rozPend,
    items: itemsOf, names: () => brInfo().names, count: (b, id) => { const c = counts.get(countId(b, id)); return c && !c.del ? c : null; }, sys: (c, r) => sysOf(c, r), counted: countedPcs,
    bill: (r, c, b) => billOf(r, c, b), round: () => roundNow(), autoOn: () => autoOn, post: () => postReq, postQ: () => postQ, bills: () => bills, posted: k => postedMap.get(k) || null, trJobs: () => trList || [], notes: () => { try { return tcAll(); } catch { return []; } },
    seeStock: () => seeStock(), loaded: () => loaded, hidden: r => isHidden(r), counts: () => counts, enter: k => stockRozOpen(k), branchName: b => branchName(b, brInfo().names), locked: () => countOff, pc: () => stockPcState(),
    skips: k => rozSkips(k), unskip: (k, id) => cloud?.rozUnskip ? cloud.rozUnskip({ loc: k, id: String(id) }) : Promise.reject(Error('App update karein')),   // v2.117.0: ⏭
    // v2.113.0: ⚖️ Stock farq (farq.js) — sab jagah + doosri jagah ki ginti wahin
    branches: () => brInfo().branches, item: (b, id) => itemAt(b, id), canCount: () => !!roundNow() && (!countOff || isOwner()) && (isOwner() || can('stock.count')), canWant: () => isOwner() && rozCfg().on,
    rozKeys: bs => rozLocs().filter(L => (bs || []).map(Number).includes(Number(L.b))).map(L => L.k), save: (b, id, ctn, pcs) => oxSave(b, id, ctn, pcs),
    qtr: o => qtrGo(o), qtrCan: () => qtrCan(),   // v2.114.0
    ask: d => window.ntIjAsk ? window.ntIjAsk(d) : Promise.reject(Error('Ijazat abhi nahi')), askCan: () => !!window.ntIjCan?.(), askPend: k => !!window.ntIjPend?.(k) };   // v2.115.0: 📲 malik ki ijazat (farq bill)
}
// ================= v2.113.0 ⚖️ STOCK FARQ + 📍 DOOSRI JAGAH (malik: "jo bhi larka stock gine, agar stock kam ho to ek screen mein dukan ka piece phir
//   saath godam ka piece — dono apni apni jagah adjust ho kar wahi stock se bill bane, kam zyada apne khane mein; larkon ko khapna nahi parega") =================
//   (1) Ginti ke neeche "📍 Baqi jagah": isi item ki doosri jagahon ka POS + aaj ki ginti, aur jo nahi gini wahin likh kar gino (WAHI writeCount,
//       us jagah ki ginti) + asal farq (sab ka jor). Sirf jin ko stock dikhta hai (andhi ginti mein nahi). (2) ⚖️ Stock farq screen = farq.js.
//   (3) Roz ki ginti ON: kisi jagah bara KAM nikla to wahi item doosri roz-jagahon ki list mein sab se upar (cloud.rozAsk) — wahan ka larka gine,
//       jagah badli khud pakri jaye. Larke ko kuch nahi dikhta. AI NAHI. CAP stock.farq.
let farqMod = null;
const farqCan = () => seeStock() && (isOwner() || can('stock.farq'));
async function farqOpenNow() { if (!farqCan()) { notice('⚖️ Stock farq — ijazat nahi (malik se kahein)'); return; } start(true); if (!loaded) { notice('⏳ Stock aa raha hai — 2 second baad dobara'); return; }
  try { farqMod = farqMod || await import('./farq.js?v=2.127.0'); recentPush({ key: 'farq', icon: '⚖️', label: 'Stock farq', open: { kind: 'stock', screen: 'farq' } }); farqMod.farqOpen(stockRozApi()); } catch (e) { notice('Nahi khula: ' + (e?.message || e)); } }
// sab jagah (jo gini) ka asal farq — is round ki ginti
function oxNet(id) { let net = 0, k = false, z = false, n = 0, pr = 0; for (const b of brInfo().branches) { const it = itemAt(b, id); if (!it) continue; const c = countOf(b, it); if (!c) continue; const f = r3(countedPcs(c) - Number(sysOf(c, it))); net += f; n++; if (f < -0.001) k = true; if (f > 0.001) z = true; pr = Number(it.prate) || pr; } return n ? { net: r3(net), rs: net * pr, both: k && z, n } : null; }
function oxHTML(r, c, diff) {
  if (!c || !farqCan() || pickedBranch === JAMA || Math.abs(Number(diff) || 0) < 0.001) return '';
  const { branches, names } = brInfo(), id = String(r.id), canC = (isOwner() || can('stock.count')) && (!countOff || isOwner());
  const rowsH = branches.filter(b => b !== pickedBranch).map(b => { const it = itemAt(b, id); if (!it || isHidden(it)) return '';
    const oc = countOf(b, it), pk = Number(it.pack) || 0, stk = Number(it.stock) || 0, cps = pk > 1 ? ` (${num(Math.floor(Math.abs(stk) / pk))} ${esc(it.cName || 'ctn')}${r3(Math.abs(stk) % pk) ? ' ' + num(r3(Math.abs(stk) % pk)) : ''})` : '';
    const cell = oc ? (() => { const f = r3(countedPcs(oc) - Number(sysOf(oc, it))); return `<span class="ox-g">gina <b>${num(countedPcs(oc))}</b> → <b class="${f < -0.001 ? 'r' : f > 0.001 ? 'g' : ''}">${Math.abs(f) < 0.001 ? '✓ barabar' : (f > 0 ? '+' : '') + num(f)}</b>${oc.byName ? ' · 👤 ' + esc(oc.byName) : ''}</span>`; })()
      : canC ? `<span class="ox-in">${pk > 1 ? `<input type="number" inputmode="decimal" step="any" min="0" placeholder="${esc(it.cName || 'Ctn')}" data-ox-ctn="${b}|${esc(id)}">` : ''}<input type="number" inputmode="decimal" step="any" min="0" placeholder="${esc(it.uName || 'Pcs')}" data-ox-pcs="${b}|${esc(id)}"><button type="button" data-ox-save="${b}|${esc(id)}">✓ Gino</button></span>` : '<span class="ox-g">abhi nahi gina</span>';
    return `<div class="ox-r${oc ? ' done' : ''}"><span class="ox-n"><span class="ox-t">${b === 1 ? '🏪' : '🏬'} <b>${esc(branchName(b, names))}</b></span><small>POS ${num(stk)}${cps}</small></span>${cell}</div>`; }).join('');
  if (!rowsH) return '';
  const N = oxNet(id), lab = N ? (N.both ? '🔁 jagah badli' : N.net < -0.001 ? '⬇️ asal kami' : N.net > 0.001 ? '⬆️ asal zyadti' : '✓ sab barabar') : '';
  const P = N && N.both && qtrCan() ? oxPair(id) : null;   // v2.114.0: ⇄ jagah badli = transfer note (malik: "wahin likh kar transfer kar sake")
  return `<div class="ox-box" data-ox-box="${esc(id)}"><div class="ox-h">📍 Baqi jagah — ${diff < 0 ? 'yahan kam hai, kahin aur to nahi?' : 'yahan zyada hai — kahin aur kam to nahi?'}</div>${rowsH}${N && N.n > 1 ? `<div class="ox-net ${N.both ? 'jagah' : N.net < 0 ? 'k' : N.net > 0 ? 'z' : 'e'}">⚖️ Asal farq (sab jagah): <b>${Math.abs(N.net) < 0.001 ? '0' : (N.net > 0 ? '+' : '') + num(N.net)}</b>${Math.abs(N.rs) >= 1 ? ' · Rs ' + (N.rs > 0 ? '+' : '') + num(Math.round(N.rs)) : ''} — ${lab}</div>` : ''}${P ? `<button type="button" class="ox-tr" data-qtr-ox="${esc(id)}|${P.from}|${P.to}|${P.q}">⇄ Transfer ${esc(qtyTxt(P.q, r))}: ${esc(branchName(P.from, names))} → ${esc(branchName(P.to, names))}<small>maal pehle se wahan — note sirf hisaab · dono ginti khud taza (farq 0)</small></button>` : ''}<button type="button" class="ox-open" data-sk-farq="1">⚖️ Stock farq — sab jagah ek screen ›</button></div>`;
}
// ================= v2.114.0 🏬 HAR GODAM + ⇄ JALDI TRANSFER (malik: "aik item ka stock har godam ke hisab se · zero wale godam ka naam na aaye ·
//   larkon ki ginti mein bhi · farq ho to neeche tab mein likh kar transfer kar sake · password laga do · sab par default, har stock screen par").
//   Patti = sirf jahan stock hai (0 = naam nahi) · sirf jin ko stock dikhta hai (andhi ginti mein nahi). ⇄ = qtr.js (WAHI transferJobs → PC TN).
//   Mulazim = ⛔ Band wala password (rules 2.70 jaanchte). Jagah badli TN = dono ginti wahi tadad par dobara (farq 0). CAP stock.hargodam / stock.qtr. AI NAHI.
let hgOn = (() => { try { return localStorage.getItem('sam-hg') === '1'; } catch { return false; } })(), qtrMod = null;
const hgCan = () => seeStock() && (isOwner() || can('stock.hargodam'));
const qtrCan = () => isOwner() || can('stock.qtr');
const qtyTxt = (n, it) => { const pk = Number(it?.pack) || 0, a = Math.abs(Number(n) || 0), sg = Number(n) < -0.0005 ? '−' : ''; if (pk <= 1) return sg + num(r3(a)) + ' ' + (it?.uName || 'pcs'); const c = Math.floor(a / pk + 1e-9), p = r3(a - c * pk); return (sg + [c ? num(c) + ' ' + (it.cName || 'ctn') : '', p ? num(p) + (c ? '' : ' ' + (it.uName || 'pcs')) : ''].filter(Boolean).join(' ')) || '0'; };
const hgShort = (b, names) => { const n = String(branchName(b, names) || ''), m = n.match(/godam\s*-?\s*(\d+)/i); if (m) return 'G' + m[1]; const w = n.split(/\s+/)[0] || (b === 1 ? 'Dukan' : 'B' + b); return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); };
function hgHTML(r) {
  if (!hgOn || !hgCan()) return '';
  const { branches, names } = brInfo(), id = String(r.id);
  const cs = branches.map(b => { const it = itemAt(b, id); if (!it || isHidden(it)) return ''; const s = Number(it.stock) || 0; if (Math.abs(s) < 0.0005) return '';
    return `<span class="hg-c${b === pickedBranch ? ' here' : ''}${s < 0 ? ' neg' : ''}" title="${esc(branchName(b, names))}">${b === 1 ? '🏪' : '🏬'} ${esc(hgShort(b, names))} <b>${esc(qtyTxt(s, it))}</b></span>`; }).join('');
  return `<div class="hg-row" data-hg="${esc(id)}">${cs || '<span class="hg-none">🏬 Kisi jagah stock nahi</span>'}</div>`;
}
function qtrApi() { return { cloud, notice, esc, num, branches: () => brInfo().branches, item: (b, id) => itemAt(b, id), hidden: r => isHidden(r), branchName: b => branchName(b, brInfo().names), see: () => seeStock(), isOwner: () => isOwner(), who: () => whoName(), copies: () => trCopies, canTr: () => qtrCan(), here: () => pickedBranch, recount: (b, id, why) => recountSame(b, id, why), after: () => { try { soft(); } catch {} },
  main: () => agPool().main ?? 1, canFix: () => isOwner() || can('stock.theek'), trHist: (id, days) => qtrHist(id, days), ginti: (b, id) => qtrGinti(b, id),   /* v2.116.0: ⚖️ stock theek + 📜 item ke TN + 📋 ginti ka farq (dohra na ho) */
  askCan: () => { try { return !!window.ntIjCan?.(); } catch { return false; } }, ask: d => window.ntIjAsk ? window.ntIjAsk(d) : Promise.reject(Error('App update karein')) }; }
// v2.116.0: 📜 ⇄ khirki ke neeche — is item ke transfer note (POS + app ke bane + ⏳ abhi PC par), naye pehle
function qtrHist(id, days) {
  const sid = String(id), lim = Date.now() - (Number(days) || 3) * 864e5, out = [], qOf = ls => { let q = 0; for (const l of ls || []) if (String(l.itemId) === sid) q += Number(l.qty) || 0; return r3(q); };
  for (const t of tcAll()) { const at = Number(t?.at) || 0; if (!t || at < lim) continue; const q = qOf(t.lines); if (!(q > 0)) continue;
    out.push({ at, no: String(t.transferNo || '').replace(/^0+/, ''), from: Number(t.from), to: Number(t.to), q, hisaab: tcHisaab(t), app: !!t.app, edited: Number(t.editCount) > 0, cancelled: !!t.cancelled, by: String(t.byName || '') }); }
  for (const j of trList || []) { const at = Number(j?.at) || 0; if (!j || at < lim || !['new', 'working'].includes(j.status) || (j.op && j.op !== 'create')) continue; const q = qOf(j.lines); if (!(q > 0)) continue;
    out.push({ at, no: '', from: Number(j.from), to: Number(j.to), q, hisaab: tcHisaab(j), pend: true, by: String(j.byName || '') }); }
  return out.sort((a, b) => b.at - a.at).slice(0, 80);
}
// v2.116.0: ⚖️ is jagah ki larkon ki GINTI ka farq abhi bill nahi hua? — stock theek bhi kiya to wahi farq DOHRA bill (sirf khabar, ginti nahi chhuti).
//   Ginti khud POS mein (_auto) = har Save PC foran POS mein daal deta hai — wahan dohra nahi.
function qtrGinti(b, id) {
  try { if (autoOn || !round) return null; const r = itemAt(b, id); if (!r) return null; const c = countOf(b, r); if (!c) return null; const bi = billOf(r, c, b);
    if (bi.k !== 'baqi' && bi.k !== 'part') return null; const f = bi.k === 'part' ? Math.sign(bi.f) * Math.max(0, Math.abs(bi.f) - (Number(bi.q) || 0)) : bi.f;
    return Math.abs(f) > 0.0005 ? { f: r3(f), round } : null; } catch { return null; }
}
async function qtrGo(o) { if (!qtrCan()) { notice('⇄ Transfer — ijazat nahi (malik se kahein)'); return; } start(true); if (!loaded) { notice('⏳ Stock aa raha hai — 2 second baad dobara'); return; }
  try { qtrMod = qtrMod || await import('./qtr.js?v=2.127.0'); qtrMod.qtrOpen(qtrApi(), o); } catch (e) { notice('Nahi khula: ' + (e?.message || e)); } }
// jagah badli: sab se bara KAM (yahan maal kam = POS zyada) → sab se bari ZYADTI, tadad = dono mein chhoti
function oxPair(id) {
  let k = null, z = null; for (const b of brInfo().branches) { const it = itemAt(b, id); if (!it) continue; const c = countOf(b, it); if (!c) continue; const f = r3(countedPcs(c) - Number(sysOf(c, it)));
    if (f < -0.001 && (!k || f < k.f)) k = { b, f }; if (f > 0.001 && (!z || f > z.f)) z = { b, f }; }
  if (!k || !z) return null; const q = r3(Math.min(-k.f, z.f)); return q > 0 ? { from: k.b, to: z.b, q } : null;
}
// TN ban gaya = usi jagah ki ginti WAHI tadad par dobara (PC is lamhe ka POS stock likhega → farq 0, fraq bill nahi)
async function recountSame(b, id, why) {
  const it = itemAt(b, id); if (!it || !roundNow()) return false; const c = countOf(b, it); if (!c) return false;
  await writeCount(it, { ctn: Number(c.ctn) || 0, pcs: Number(c.pcs) || 0, total: countedPcs(c), bad: false, note: why || '⇄ TN ke baad' }, null, false, b); return true;
}
async function oxSave(b, id, ctn, pcs) {
  if (!roundNow()) throw Error(isOwner() ? 'Pehle "📋 Nayi ginti shuru" dabayein' : 'Malik ne abhi ginti shuru nahi ki');
  if (countOff && !isOwner()) throw Error('🔴 Malik ne counting band ki hui hai');
  if (!(isOwner() || can('stock.count'))) throw Error('Ginti ki ijazat nahi');
  const it = itemAt(b, id); if (!it) throw Error('Is jagah yeh item nahi');
  const pk = Number(it.pack) || 0, c = pk > 1 ? Math.max(0, Number(ctn) || 0) : 0, p = Math.max(0, Number(pcs) || 0) + (pk > 1 ? 0 : Math.max(0, Number(ctn) || 0)), total = r3(c * (pk > 1 ? pk : 0) + p);
  if (!staleOk()) return null;
  if (total === 0 && !confirm(`"${it.name}" (${branchName(b, brInfo().names)}) ki ginti ZERO save karein?`)) return null;
  await writeCount(it, { ctn: c, pcs: p, total, bad: false }, null, false, b);
  return { total };
}
// roz: bara KAM = doosri roz-jagahon ki list mein sab se upar (us jagah aaj nahi gina ho to)
function rozAskOthers(item, b0, total) {
  try { const C = rozCfg(); if (!C.on || !cloud?.rozAsk) return; const f = r3(total - (Number(item.stock) || 0)), pk = Number(item.pack) || 0, pr = Number(item.prate) || 0;
    if (!(f < -0.001) || !((pk > 1 && -f >= pk) || -f * pr >= 500)) return;
    for (const L of rozLocs()) { if (Number(L.b) === Number(b0)) continue; const it = itemAt(L.b, item.id); if (!it || isHidden(it) || rozGina(L.b, item.id) || rozDoc(L.k)?.taken?.[String(item.id)]) continue; cloud.rozAsk(L.k, [String(item.id)]).catch(() => {}); }   // v2.113.1: kisi larke ki list mein pehle se (taken) = mat maango (ek item do larkon ko kabhi nahi)
  } catch {}
}
// ================= v2.110.0: 📡 PC KA JAWAB (malik: "har ginti ke saath PC ka jawab — na mile to app bataye: PC jawab nahi de raha / save nahi hua, malik se rabta karo") =================
//   Save → ⏳ bhej rahe (sirf phone mein — Firestore hasPendingWrites) → ☁️ Save ✓ (server) → ✅ PC ✓ (post-farq ne us second ka POS stock likha: sysPosAt === at, ~20–30 s).
//   15 s server tak nahi = ❌ "Save nahi hua — internet" (Firestore khud bhejta rehta, ginti zaya nahi) · 90 s PC ka ✓ nahi = ⚠️ "PC jawab nahi de raha" → larke ko upar
//   laal patti + 📲 Malik ko batao (WhatsApp, likha hua paigham) + stockCount/pcwarn-<sid> (malik ki app ka chip, 10 min taaza). PC zinda (baad ki ginti ✓) magar ye item
//   5 min se nahi = "PC ne ye item POS mein nahi pehchana". CAP stock.pcwarn (deny = shuru se chalu). Rules / PC script NAHI badle. AI NAHI.
const PC_SEND = 15000, PC_WAIT = 90000, PC_ITEM = 5 * 60000, PC_FRESH = 10 * 60000;
let pendCount = new Set(), pcOkSeen = 0, pcOkKeys = null, pcTimer = null, pcWarnAt = 0, pcWarnSig = '', pcWarnAll = [], pcWarnDocs = [], pcWarnStop = null, pcLastC = null, pcLastV = 0;
const pcOn = () => isOwner() || can('stock.pcwarn');
const pcMine = c => isOwner() || (!!whoName() && String(c?.byName || '') === whoName());
const pcSafe = v => String(v || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60);
const onStockScreen = () => !!document.querySelector('main')?.classList.contains('sk-screen');
function pcSeen(list) {   // nayi ✅ (PC ne abhi pakki ki) = PC zinda — waqt yaad (pehli dafa sirf yaad, waqt nahi)
  const keys = new Set(); for (const c of list) if (String(c.id).startsWith('c-') && sysSure(c)) keys.add(c.id + '@' + c.at);
  if (pcOkKeys) for (const k of keys) if (!pcOkKeys.has(k)) { pcOkSeen = Date.now(); break; }
  pcOkKeys = keys;
}
function pcLastOk() {   // is round mein PC ki aakhri pakki ginti ka waqt (counts badle tab dobara)
  if (pcLastC === counts) return pcLastV;
  let m = 0; const R = roundNow(); for (const [k, c] of counts) if (k.startsWith('c-') && c.round === R && sysSure(c)) m = Math.max(m, Number(c.at) || 0);
  pcLastC = counts; pcLastV = m; return m;
}
function pcState(c, id, lastOk = pcLastOk()) {   // '' | send | nosave | wait | ok | down | item
  if (!c || c.del || !c.at || c.round !== roundNow()) return '';
  const age = Date.now() - Number(c.at); if (age > 12 * 3600e3) return '';
  if (pendCount.has(id)) return age < PC_SEND ? 'send' : 'nosave';
  if (sysSure(c)) return 'ok';
  if (age < PC_WAIT) return 'wait';
  if (lastOk > Number(c.at)) return age > PC_ITEM ? 'item' : 'wait';   // PC zinda — baad ki ginti pakki ho chuki
  return Date.now() - pcOkSeen < 120000 ? 'wait' : 'down';   // abhi abhi PC ne kuch pakka kiya = chal raha, intezar
}
const PC_TXT = { send: ['⏳', 'bhej rahe…'], nosave: ['❌', 'Save nahi hua — internet check karein'], wait: ['☁️', 'Save ✓ · ⏳ PC…'], ok: ['✅', 'PC ✓'], down: ['⚠️', 'Save ✓ · PC jawab nahi de raha'], item: ['⚠️', 'PC ne ye item POS mein nahi pehchana — malik ko batayein'] };
const pcTxt = s => s ? `${PC_TXT[s][0]} ${esc(PC_TXT[s][1])}` : '';
function pcSpan(c, id) { const s = pcOn() ? pcState(c, id) : ''; return `<small class="pcst" data-pcst="${esc(id)}" data-st="${s}">${pcTxt(s)}</small>`; }
function pcSum() {   // meri (malik = sab ki) is round ki gintiyon ka haal
  const out = { send: [], nosave: [], wait: [], ok: [], down: [], item: [] }; if (!loaded || !pcOn()) return out;
  const R = roundNow(), lastOk = pcLastOk();
  for (const [k, c] of counts) { if (!k.startsWith('c-') || c.round !== R || !pcMine(c)) continue; const st = pcState(c, k, lastOk); if (out[st]) out[st].push(c); }
  return out;
}
function pcWhere(L) { const nm = brInfo().names, b = [...new Set(L.map(c => Number(c.branch)))]; return b.map(x => branchName(x, nm)).join(' · '); }
function pcWaUrl(L, since) {
  const t = new Date(since).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return 'https://wa.me/?text=' + encodeURIComponent(`Malik, PC jawab nahi de raha ⚠️\n${whoName() || 'Mulazim'} — ${pcWhere(L)} ki ginti: ${L.length} items PC ne pakke nahi kiye (${t} se).\nPC / KHATA-DOCTOR check karein.`);
}
function pcBannerInner(S = pcSum()) {
  let h = '';
  if (S.nosave.length) h += `<div class="pc-warn ns"><b>❌ ${num(S.nosave.length)} ginti abhi server tak nahi pohanchi</b><span>Internet check karein — app khud bhejti rahegi, ginti zaya nahi hogi.</span></div>`;
  if (S.down.length) { const since = Math.min(...S.down.map(c => Number(c.at))), m = Math.max(1, Math.round((Date.now() - since) / 60000));
    h += `<div class="pc-warn dn"><b>⚠️ PC jawab nahi de raha</b><span>${num(S.down.length)} ginti PC ne pakki nahi ki (${num(m)} min se). Ginti mehfooz hai — PC on hote hi khud pakki ho jayegi.${isOwner() ? ' PC / KHATA-DOCTOR dekhein.' : ' <b>Malik se rabta karein.</b>'}</span>${isOwner() ? '' : `<a class="pc-wa" href="${esc(pcWaUrl(S.down, since))}" target="_blank" rel="noopener">📲 Malik ko batao</a>`}</div>`; }
  return h;
}
const pcSig = S => `${S.nosave.length}|${S.down.length}|${S.down.length ? Math.round((Date.now() - Math.min(...S.down.map(c => Number(c.at)))) / 60000) : 0}`;
function pcBannerHTML() { const S = pcSum(); return `<div id="pcWarn" data-sig="${pcSig(S)}">${pcBannerInner(S)}</div>`; }
function pcPaint() {   // sirf chhote status + patti badlo (list dobara nahi — khane / keyboard wahi)
  if (!onStockScreen()) return;
  const lastOk = pcLastOk(), on = pcOn();
  document.querySelectorAll('#list [data-pcst]').forEach(el => { const id = el.dataset.pcst, s = on ? pcState(counts.get(id), id, lastOk) : ''; if ((el.dataset.st || '') !== s) { el.dataset.st = s; el.innerHTML = pcTxt(s); } });
  const w = $('pcWarn'); if (w) { const S = pcSum(), g = pcSig(S); if (w.dataset.sig !== g) { w.dataset.sig = g; w.innerHTML = pcBannerInner(S); } }
}
let pcWas = { down: 0, nosave: 0 }, pcChipT = '';
function pcTick() {
  if (!cloud) return;
  if (isOwner()) { const t = stockPcChip()?.t || ''; if (t !== pcChipT) { pcChipT = t; try { window.dispatchEvent(new Event('sam-hb')); } catch {} } }   // malik ki chip badli (ya purani hui) = upar dobara
  if (!loaded) return;
  pcPaint();
  if (onStockScreen() && pcOn()) {   // naya masla = ek dafa neeche notice (larka list mein neeche ho to bhi pata chale)
    const S0 = pcSum(), d = S0.down.length, n = S0.nosave.length;
    if (d && !pcWas.down) notice(`⚠️ PC jawab nahi de raha — ${num(d)} ginti pakki nahi.${isOwner() ? ' PC / KHATA-DOCTOR dekhein.' : ' Upar "📲 Malik ko batao" dabayein.'}`);
    else if (n && !pcWas.nosave) notice(`❌ ${num(n)} ginti server tak nahi pohanchi — internet check karein`);
    pcWas = { down: d, nosave: n };
  }
  if (isOwner() || !pcOn() || !cloud.setPcWarn) return;
  const sid = rozSid(); if (!sid) return;
  const S = pcSum(), self = pcWarnAll.find(d => d.id === 'pcwarn-' + pcSafe(sid));
  if (S.down.length) { const since = Math.min(...S.down.map(c => Number(c.at))), g = S.down.length + '|' + since;
    if (g !== pcWarnSig || Date.now() - pcWarnAt > 120000) { pcWarnSig = g; pcWarnAt = Date.now(); cloud.setPcWarn(sid, { name: whoName(), where: pcWhere(S.down), n: S.down.length, since }).catch(() => {}); } }
  else if (pcWarnSig || self) { pcWarnSig = ''; pcWarnAt = 0; cloud.setPcWarn(sid, null).catch(() => {}); }   // theek ho gaya = malik ki chip se hata
}
// 🏷 malik ki upar ki chip — Stock khula ho to apna hisaab, warna larkon ke pcwarn docs (sirf in ka chhota listener)
export function stockPcChip() {
  if (!cloud || !isOwner()) return null;
  if (!pcWarnStop && cloud.listenPcWarn) { pcWarnStop = cloud.listenPcWarn(l => { pcWarnDocs = Array.isArray(l) ? l : []; try { window.dispatchEvent(new Event('sam-hb')); } catch {} }); if (!pcTimer) pcTimer = setInterval(() => { try { pcTick(); } catch {} }, 5000); }
  const T = Date.now(), W = [...pcWarnDocs, ...pcWarnAll].filter((d, i, a) => a.findIndex(x => x.id === d.id) === i && Number(d.n) > 0 && T - (Number(d.at) || 0) < PC_FRESH);
  const S = loaded ? pcSum() : null, n = Math.max(S ? S.down.length : 0, W.reduce((t, d) => t + (Number(d.n) || 0), 0));   // apna hisaab ya larkon ki khabar — jo zyada
  if (!n && !(S && S.nosave.length)) return null;
  const who = [...new Set(W.map(d => String(d.name || '').trim()).filter(Boolean))].slice(0, 3).join(', ');
  return n ? { t: `⚠️ PC jawab nahi de raha · ${num(n)}`, cls: 'bad', n: `PC jawab nahi de raha — ${num(n)} ginti pakki nahi${who ? ' (' + who + ')' : ''}` }
    : { t: `❌ ${num(S.nosave.length)} ginti save nahi`, cls: 'bad', n: 'kuch ginti abhi server tak nahi pohanchi (internet)' };
}
export function stockPcState() { const S = pcSum(), T = Date.now();
  return { down: S.down.length, nosave: S.nosave.length, wait: S.wait.length + S.send.length, ok: S.ok.length, item: S.item.map(c => String(c.name || '')).slice(0, 20),
    warns: [...pcWarnDocs, ...pcWarnAll].filter((d, i, a) => a.findIndex(x => x.id === d.id) === i && Number(d.n) > 0 && T - (Number(d.at) || 0) < PC_FRESH).map(d => ({ naam: d.name, jagah: d.where, ginti: d.n, kab_se: new Date(Number(d.since) || 0).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) })) }; }
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

  if (roz && pickedBranch !== roz.b) { rozPrevBranch = undefined; rozExit(); return renderStockInner(); }   // v2.109.0: 📋 roz mein doosra godam chuna = roz band, wahi godam (loop nahi)
  if (roz) {   // 📋 roz ki ginti: sirf MERE aaj ke items (lene ki tarteeb mein) — filter / tabs nahi
    const byId = new Map(items.map(r => [String(r.id), r])), mine = rozMine(roz.k).map(id => byId.get(id)).filter(Boolean);
    if (rozTab === 'skip') { $('list').innerHTML = rozStripHTML(mine) + rozSkipTabHTML(byId); return; }   // v2.117.0: ⏭ Skip tab
    const shownR = q ? smartSearch(mine, q, 200) : mine, extra = q && rozMoreOk() && !(countOff && !isOwner()) ? rozFindMore(q, mine) : [];   // v2.117.0: ➕ search se aur
    $('list').innerHTML = rozStripHTML(mine) + (q ? `<p class="stat-note">${num(shownR.length)} item mile (aap ki aaj ki list mein)</p>` : '') + shownR.map(rowHTML).join('') + (extra.length ? rozMoreHTML(extra) : '');
    return;
  }
  if (pickedBranch !== 1 && filter === 'all' && !godamAll) filter = 'has';   // v1.97: godam khula ho to shuru se sirf usi ke items
  let shown = items.filter(passes), wide = 0;
  if (facOnly) shown = shown.filter(isFacRow);   // v2.107.0: 🏭 Factory stock (factory ek-screen ka chip)
  if (inPick && inPick.size) shown = items.filter(r => inPick.has(String(r.id)));   // v2.6: aaye hue maal ki ginti
  if (q) {   // v2.4.5: sale jaisi — poore stock mein (filter se bahar bhi), best match UPAR (tarteeb smartSearch ki)
    const pool = items.filter(r => (filter === 'hidden' ? isHidden(r) : !isHidden(r)) && (!facOnly || isFacRow(r)));
    const inF = new Set(shown);
    shown = smartSearch(pool, q, 500);
    wide = shown.filter(r => !inF.has(r)).length;
  } else if (sort === 'stock') shown.sort((a, b) => b.stock - a.stock);
  else shown.sort((a, b) => NAMEC.compare(String(a.name), String(b.name)));

  const extra = shown.length - limit;
  const list = shown.slice(0, limit);
  // v2.105.9: search mein band item bhi mile to upar patti (band list se gayab nahi lagta)
  const bdHit = q && filter !== 'hidden' ? bandAll().filter(b => norm(b.name).includes(q) || fold(b.name).includes(fold(q)) || (b.code && String(b.code).toLowerCase().includes(q))) : [];
  const bdSt = b => b.st === 'wait' ? '⏳ PC baqi (POS on hote hi bill + deactive)' : b.st === 'fail' ? '❌ PC nahi kar saka' : b.st === 'live' ? '🟢 POS mein chalu, app mein band' : '✓ POS mein deactive';

  $('list').innerHTML =
    (facOnly && !(inPick && inPick.size) ? `<div class="in-strip fac-strip">🏭 Factory stock — ${num(shown.length)} items <button type="button" data-fac-clear="1">✕ Sab items</button></div>` : '') +
    (inPick && inPick.size ? `<div class="in-strip">📥 Aaye hue maal ki ginti — ${num(shown.length)} items <button type="button" data-in-clear="1">✕ saaf karein</button></div>` : '') +
    (bdHit.length ? `<button type="button" class="bd-hit" data-stock-band="1" data-bd-qv="${esc($('search')?.value || '')}"><span class="bi">⛔</span><span><b>${esc(bdHit.slice(0, 2).map(b => b.name).join(' · '))}${bdHit.length > 2 ? ' +' + num(bdHit.length - 2) : ''}</b><small>${bdHit.length === 1 ? 'Band hai — ' + bdSt(bdHit[0]) : num(bdHit.length) + ' band items is naam se'}</small></span><em>›</em></button>` : '') +
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
      ${cntPkHTML(r)}
      <button type="button" data-count-save="${esc(r.id)}">💾 Save</button>
      <div class="count-live" data-count-live="${esc(r.id)}"></div></div>`}</details>
  </article>`;
}
document.addEventListener('click', async e => {   // v2.103.30: ⚡ sab chhore hue (late) items ek dafa
  const b = e.target.closest?.('[data-fq-forceall]'); if (!b || !isOwner()) return;
  const ids = String(b.dataset.fqForceall || '').split(',').filter(Boolean), br = Number(postReq?.branch) || pickedBranch; if (!ids.length) { notice('Items ki pehchan nahi — PC update ka intezar'); return; }
  if (!confirm(`${ids.length} items — ginti ke baad bill bana tha.\nPhir bhi sab ka farq bill mein shamil karein? (late bill tha to stock do dafa kat sakta hai)`)) return;
  b.disabled = true; b.textContent = '⏳ …'; let ok = 0;
  for (const id of ids) { try { await cloud.patchStockCount(countId(br, id), { forceBill: true }); ok++; } catch {} }
  notice(`✓ ${ok} items bill mein shamil honge — ab "Bill banao" dobara dabayein`); b.textContent = `✓ ${ok} shamil`;
});
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
  const d = $('dialog'); if (!d) return; recentPush({ key: 'ginti', icon: '📋', label: 'Ginti', open: { kind: 'stock', screen: 'ginti' } });
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
    <div class="sk-two">${list.length && see ? '<button type="button" class="sk-btn p" data-ginti-pdf="1">📄 PDF · WhatsApp</button>' : ''}${own && !autoOn ? '<button type="button" class="sk-btn" data-stock-round="new">Nayi ginti shuru</button>' : ''}</div>${farqCan() ? '<button type="button" class="sk-btn sk-farq-l" data-sk-farq="1">⚖️ Stock farq — dukan + godam ek screen (jagah badli khud) ›</button>' : ''}`}
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
    ${H.length ? `<div class="sk-list"><div class="sk-lh">AAJ KI GINTI</div>${H.map((h, i) => `<div class="sk-hist${i === 0 ? ' cur' : ''}"><span class="t"><b>${esc(stampText(h.at))}${i === 0 ? ' (abhi lagi hui)' : ''}${h.tick ? ' · ✓ tick' : ''}</b><span>${seeStock() ? 'system ' + num(h.sys) + ' · ' : ''}gina ${num(h.total)}${h.ctn ? ' (' + num(h.ctn) + ' ctn + ' + num(h.pcs) + ')' : ''}${hWhoHTML(h, c)}</span></span>${seeStock() ? `<b class="${h.total - h.sys < 0 ? 'r' : h.total - h.sys > 0 ? 'g' : 'z'}">${h.total - h.sys > 0 ? '+' : ''}${num(Math.round((h.total - h.sys) * 100) / 100)}</b>` : ''}</div>`).join('')}</div>` : ''}
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
  const tile = (attr, ic, lab, cls = '') => `<button type="button" class="sk-tile${cls ? ' ' + cls : ''}" ${attr}="1" data-mn="sk.${attr.replace(/^data-/, '')}" data-mn-keep="1" data-mn-i="${ic}" data-mn-t="${esc(lab)}" data-mn-g="📦 Stock"><span>${ic}</span>${lab}</button>`;   // v2.105.0: chhote chips + ⋮
  const tiles = [
    canNewItem() ? tile('data-stock-newitem', '➕', 'Naya item') : '',
    can('stock.in') ? tile('data-stock-in', '📥', 'Aaya / gaya') : '',
    can('stock.reg') ? tile('data-stock-reg', '📋', 'Register') : '',
    can('stock.tc') ? tile('data-stock-tc', '🧾', 'Note check') : '',
    can('stock.demand') ? tile('data-demand', '📢', 'Demand') : '',
    can('stock.tolai') ? tile('data-stock-tolai', '⚖️', 'Tolai') : '',
    can('stock.transfer') ? tile('data-stock-transfer', '⇄', 'Transfer') : '',
    canEditItem() ? tile('data-stock-urdu', '🔤', 'Urdu naam') : '',
    can('stock.ratepdf') ? tile('data-stock-ratepdf', '📄', 'Rate list PDF') : '',   // v2.103.41
    (isOwner() || (rozCfg().on && ROZ_LOC.some(x => can(x[3])))) ? tile('data-roz-open', '📋', 'Roz ki ginti') : '',   // v2.109.0
    farqCan() ? tile('data-sk-farq', '⚖️', 'Stock farq') : '',   // v2.113.0: sab jagah ek screen
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
      ${pcBannerHTML()}
    </div>
    <div class="sk-body">
      <small class="sk-meta">${seeStock() ? 'kul ' + num(totalPcs) + ' pcs' : num(shownCount) + ' items'}${stamp ? ' · aakhri tabdeeli ' + esc(since(stamp)) : ''}</small>${liveChip()}
      ${scanList.length ? `<div class="sk-scan"><button type="button" class="sh-wide sh-scan" data-stock-scan="1">${camIco()} Aur scan karein (${num(scanList.length)} list mein)</button><button type="button" class="sh-wide sh-clear" data-stock-clear="1">✕ Saaf karein — wapas poori list</button></div>` : ''}
      ${rozBigHTML()}
      ${can('stock.count') || isOwner() ? gintiBig(pick, items) : ''}
      ${tiles.length ? `<div class="sk-tiles">${tiles.join('')}</div>` : ''}
      ${ijPend().length || ijBad().length ? `<button type="button" class="sk-pend${ijBad().length && !ijPend().length ? ' bad' : ''}" data-stock-ijobs="1">${ijPend().length ? '⏳ ' + num(ijPend().length) + ' item PC baqi' : ''}${ijPend().length && ijBad().length ? ' · ' : ''}${ijBad().length ? '❌ ' + num(ijBad().length) + ' nahi bana' : ''} — dekhein</button>` : ''}
      ${bandCardHTML()}
      ${postLine(pick)}
      <div class="sk-chips"><button type="button" class="sk-chip${filter === 'all' ? ' on' : ''}" data-stock-filter="all">Sab ${num(live.length)}</button>${seeStock() ? `<button type="button" class="sk-chip${filter === 'has' ? ' on' : ''}" data-stock-filter="has">${pick !== 1 ? '📦 Is godam ka' : 'Stock'} ${num(hasN)}</button><button type="button" class="sk-chip${filter === 'minus' ? ' on' : ''}" data-stock-filter="minus">Minus ${num(minus)}</button>` : ''}${hgCan() ? `<button type="button" class="sk-chip hg${hgOn ? ' on' : ''}" data-sk-hg="1" aria-pressed="${hgOn}">${hgOn ? '☑' : '☐'} 🏬 Har godam</button>` : ''}${extra ? `<button type="button" class="sk-chip x" data-stock-filter="all">${esc(extra)} ✕</button>` : ''}<button type="button" class="sk-chip f" data-sk-filter="1">☰ Filter${fN ? ' <i>' + fN + '</i>' : ''}</button></div>
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
  const nishanN = items.filter(r => flagOf(r.id).baqi).length, checkN = items.filter(r => flagOf(r.id).check).length, bandN = Object.keys(hidden).filter(id => hidden[id]).length;   // v2.105.9: sab band (POS se ghaib bhi) → ⛔ list
  const row = (k, t, sub, n) => `<button type="button" class="sk-li${filter === k ? ' on' : ''}" data-stock-filter="${k}"><span class="t"><b>${t}</b><span>${sub}</span></span><b>${num(n)}</b></button>`;
  d.classList.remove('search-dialog'); d.classList.add('full-dialog'); $('dialogTitle').textContent = '☰ Kya dikhayein?';
  $('dialogBody').innerHTML = `<div class="sk-sheet" id="skFilter">
    <div class="sk-list">${row('baqi', 'Ginti baqi', 'Is ginti mein abhi nahi gine', items.length - done)}${gap && seeStock() ? row('farq', '⚖️ Farq wale', 'Gine magar system se kam / zyada', gap) : ''}${row('nishan', '⏳ Baqi nishan', 'Larke ne "aur ginna hai" lagaya', nishanN)}${checkN ? row('check', '🔍 Check wale', 'Dobara check karne ka nishan', checkN) : ''}${bandN ? `<button type="button" class="sk-li" data-stock-band="1"><span class="t"><b>⛔ Band items</b><span>POS mein stock 0 + inactive · har item ka haal</span></span><b>${num(bandN)}</b></button>` : ''}</div>
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
      <label class="sk-li"><span class="t"><b>🧾 Ginti ke baad sale ho to farq bill roko</b><span>Band (aam) = bill ginti ke waqt ke POS stock se, baad ki sale se farq nahi bigarta. Chalu = aise item dobara ginne tak bill mein nahi.</span></span><input type="checkbox" data-sk-late="1"${lateRuleOn ? ' checked' : ''}></label>
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
    const subs = Array.isArray(r.bs) ? r.bs.map(b => String(b).trim()) : (Array.isArray(r.bc) ? r.bc.map(b => String(b).trim()) : [...q.keys()]);   // v2.103.39: bq se bhi
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
let trLines = [], trFrom = null, trTo = null, trStop = null, trList = [], trNote = '';
function trGot(list) { trList = list || []; const h = document.querySelector('[data-tr-hist]'); if (h) h.innerHTML = trHistHTML(); if (rk && $('rkBody')) rkPaint(); }   // v2.103.37: rack bharo ka ⏳ box bhi   // v2.99.64: note re-render par na mite
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
let ssiRows = null, ssiIdx = null;   // v2.119.0: ⚡ index — rows badle tab hi (pehle har bulave par poori list; ☐ Sab items mein hazaron dafa)
function saleStockItem(b, id) { if (ssiRows !== rows) { ssiRows = rows; ssiIdx = new Map(); for (const r of rows) { if (r.meta || !Array.isArray(r.items)) continue; let m = ssiIdx.get(r.branch); if (!m) ssiIdx.set(r.branch, m = new Map()); for (const x of r.items) { const k = String(x.id); if (!m.has(k)) m.set(k, x); } } } return ssiIdx.get(Number(b))?.get(String(id)) || null; }
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
// ---- v2.103.41: 📄 RATE LIST PDF — malik: "all items ki ek PDF: names, rates, wholesale, carton pieces — kisi ko bhejni hai".
//   Chips: Sab / sirf stock wale / category · Rate chhupao (sirf naam + pcs) · barcode bhi. regPdfOf (printArea + openReportPreview = kholo + bhejo).
let rp = null;
function rpItems() { return agPool().list.filter(it => !isHidden(it)); }
function rpOpen() { if (!can('stock.ratepdf') && !isOwner()) { notice('Ijazat nahi'); return; } rp = rp || { who: 'all', cat: '', hide: false, bc: false, q: '' }; recentPush({ key: 'ratelist', icon: '📄', label: 'Rate list PDF', open: { kind: 'stock', screen: 'ratelist' } });
  const d = $('dialog'); if (!d) return; d.classList.remove('full-dialog'); d.classList.add('search-dialog'); $('dialogTitle').textContent = '📄 Rate list PDF'; $('dialogBody').innerHTML = '<div id="rpBody"></div>'; if (!d.open) d.showModal(); rpPaint(); }
function rpList() { const all = rpItems(), st1 = id => Number(saleStockItem(1, id)?.stock) || 0;
  let L = all.filter(it => rp.who !== 'stock' || st1(it.id) > 0 || Number(it.stock) > 0); if (rp.cat) L = L.filter(it => String(it.cat || '').trim() === rp.cat);
  if (rp.q.trim()) L = smartSearch(L, rp.q, 500); return L.sort((a, b) => String(a.cat || '').localeCompare(String(b.cat || '')) || String(a.name).localeCompare(String(b.name))); }
function rpPaint() { const el = $('rpBody'); if (!el || !rp) return; const all = rpItems(), cats = [...new Set(all.map(it => String(it.cat || '').trim()).filter(Boolean))].sort(), L = rpList();
  el.innerHTML = `<div class="rk-root"><p class="rk-note">Jis ko bhejni ho utne items chunein — PDF mein naam, retail, wholesale, 1 ctn = pcs, ctn rate.</p>
    <div class="rk-nb"><span>Items</span>${[['all', 'Sab'], ['stock', 'Sirf stock wale']].map(([k, l]) => `<button type="button" class="${rp.who === k ? 'is-in' : ''}" data-rp-who="${k}">${l}</button>`).join('')}</div>
    ${cats.length ? `<div class="rk-nb"><span>Category</span><button type="button" class="${!rp.cat ? 'is-in' : ''}" data-rp-cat="">Sab</button>${cats.map(c => `<button type="button" class="${rp.cat === c ? 'is-in' : ''}" data-rp-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>` : ''}
    <div class="rk-nb"><span>Dikhao</span><button type="button" class="${rp.hide ? 'is-in' : ''}" data-rp-hide="1">${rp.hide ? '🙈 Rate chhupe hain' : '🙈 Rate chhupao'}</button><button type="button" class="${rp.bc ? 'is-in' : ''}" data-rp-bc="1">🏷 Barcode bhi</button></div>
    <label class="hs-search"><input type="search" data-rp-q="1" placeholder="🔍 naam se chhanto (ikhtiyari)" value="${esc(rp.q)}" autocomplete="off"></label>
    <div class="rk-ed"><button type="button" class="rk-sv" data-rp-go="1"${L.length ? '' : ' disabled'}>📄 PDF banao — ${num(L.length)} items</button></div>
    <p class="rk-note">Rate = POS ke aaj ke rate (retail = piece, wholesale = W). Pehle 5: ${esc(L.slice(0, 5).map(it => it.name).join(' · '))}${L.length > 5 ? ' …' : ''}</p></div>`; }
function rpPdf() { const L = rpList(); if (!L.length || !regPdfOf) { notice('Koi item nahi'); return; } const h = rp.hide, r2 = v => Math.round(v * 100) / 100, fmt = v => Number(v) > 0 ? num(r2(Number(v))) : '—';
  let cat = null, n = 0; const rows = L.map(it => { const pk = Number(it.pack) || 0, rt = Number(it.rate2) || Number(it.rate) || 0, cr = pk > 1 ? (Number(it.rate) || 0) * pk : 0, wr = Number(it.ws) || Number(it.wrate) || 0, wc = pk > 1 && Number(it.wrate) > 0 ? Number(it.wrate) * pk : 0, c = String(it.cat || '').trim();
      const head = c !== cat ? (cat = c, `<tr class="rp-cat"><td colspan="${h ? 3 : 6}">${esc(c || 'Baqi items')}</td></tr>`) : ''; n++;
      return head + `<tr><td class="rp-n">${n}</td><td class="rp-item"><b>${esc(it.name)}</b>${rp.bc && it.code ? `<br><small>${esc(String(it.code))}</small>` : ''}</td>${h ? '' : `<td class="rp-r">${fmt(rt)}</td><td class="rp-r">${fmt(wr)}</td>`}<td class="rp-r">${pk > 1 ? num(pk) + ' ' + esc(it.uName || 'pcs') : '—'}</td>${h ? '' : `<td class="rp-r">${cr ? fmt(cr) : '—'}${wc ? `<br><small>W ${fmt(wc)}</small>` : ''}</td>`}</tr>`; }).join('');
  const html = `<h1>NOOR TRADERS</h1><h2>${h ? 'Items ki list' : 'Rate list'}${rp.cat ? ' — ' + esc(rp.cat) : ''}</h2><p>${num(L.length)} items · ${esc(new Date().toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }))}${h ? '' : ' · Rate fi piece (Rs) · Ctn rate = poore carton ka'}</p>
    <table class="iv-tbl rp-tbl"><thead><tr><th>#</th><th>Item</th>${h ? '' : '<th>Retail</th><th>Wholesale</th>'}<th>1 Ctn</th>${h ? '' : '<th>Ctn rate</th>'}</tr></thead><tbody>${rows}</tbody></table>
    <p style="font-size:11px;color:#666">Noor Traders · 0345-0412515 · rate badal sakte hain</p>`;
  regPdfOf(html, (h ? 'Items-list' : 'Rate-list') + (rp.cat ? '-' + rp.cat : '')); }
document.addEventListener('click', e => { const t = e.target.closest?.('[data-rp-who],[data-rp-cat],[data-rp-hide],[data-rp-bc],[data-rp-go]'); if (!t || !rp || !t.closest('#rpBody')) return; const d = t.dataset;
  if (d.rpWho) rp.who = d.rpWho; else if (d.rpCat != null) rp.cat = d.rpCat; else if (d.rpHide) rp.hide = !rp.hide; else if (d.rpBc) rp.bc = !rp.bc; else if (d.rpGo) { rpPdf(); return; } rpPaint(); });
document.addEventListener('input', e => { const t = e.target; if (rp && t?.dataset?.rpQ != null) { rp.q = t.value || ''; clearTimeout(rpPaint.t); rpPaint.t = setTimeout(() => { const b = document.querySelector('[data-rp-go]'), L = rpList(); if (b) { b.textContent = `📄 PDF banao — ${num(L.length)} items`; b.disabled = !L.length; } }, 120); } });

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
function openRegister() { recentPush({ key: 'register', icon: '📋', label: 'Transfer register', open: { kind: 'stock', screen: 'register' } });
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
// v2.118.0: 📦 tcGv = transferGive (dene wale ka item-war "de diya", server — rules 2.72) · tcAutoWait = larke ne sab ✓ kiye magar dene wale ka G abhi nahi aaya
let tcGv = new Map(), tcGvStop = null, tcGvErr = '', tcGvWarned = false; const tcAutoWait = new Set();
let tcSel = new Set(), tcView = 'nikle', tcDays = 1, tcDir = 'all', tcChecks = new Map(), tcStop = null, tcErr = '', tcRes = null, tcBusy = false, tcFarq = false, tcOpen = new Set(), tcCode = '', tcBack = false;   // v2.105.6: tcBack = list se 📄 / chip se note khula (← Wapas list)
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
  if (!tcGvStop && cloud?.listenTransferGive) tcGvStop = cloud.listenTransferGive(Date.now() - 62 * 864e5, (list, e) => {   // v2.118.0: 📦 item-war "de diya" (rules 2.72)
    if (!list) { tcGvErr = /permission|insufficient/i.test(String(e?.code || '') + String(e?.message || '')) ? 'rules' : 'net'; try { tcGvStop?.(); } catch {} tcGvStop = null; }
    else { tcGvErr = ''; tcGv = new Map(list.map(d => [d.id, d])); }
    tcPaint();
  });
  if (tcStop || !cloud?.listenTransferChecks) return;
  tcStop = cloud.listenTransferChecks(Date.now() - 62 * 864e5, (list, e) => {
    if (!list) { tcErr = /permission|insufficient/i.test(String(e?.code || '') + String(e?.message || '')) ? 'rules' : 'net'; try { tcStop?.(); } catch {} tcStop = null; }
    else { tcErr = ''; tcChecks = new Map(list.map(c => [c.id, c])); tcAutoWaitGo(); }
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
// v2.103.57: malik — "Godam 1: Zeeshan de diya tick, larka mil gaya; baqi godam: sirf larka" → do-tick sirf Godam 1 (NAAM se; rules mein branch 2) ke notes par
const tcG1 = b => { const n = String(branchName(Number(b), collect().names || {}) || ''); return /godam\s*1\b/i.test(n) || (Number(b) === 2 && !/godam/i.test(n)); };
const tcNeedG = t => tcIssued(t) >= TC2_FROM && (tcG1(t.from) || tcG1(t.to));
// v2.102.4: 📦 GODAM WALE KAI (malik: "Zeeshan ke saath kisi aur larke ko bhi godam ke tick mein") — stockConfig.tcGiver = "Zeeshan|Bilal"
//   (rules 2.58: naam matches '.*(zeeshan|bilal).*'). Naam sirf harf / hindse / space (regex mehfooz). Purana akela naam bhi chalta.
const tcClean = n => String(n || '').replace(/[^A-Za-z0-9\u0600-\u06FF ]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 30);
const tcGivers = () => { const l = String(itemCfg.tcGiver || 'Zeeshan').split('|').map(tcClean).filter(Boolean); return l.length ? l : ['Zeeshan']; };
const tcGiver = () => tcGivers().join(', ');
const tcIsGiver = () => isOwner() || tcGivers().some(g => String(nameOf() || '').toLowerCase().includes(g.toLowerCase()));
let tcGEd = null;   // { sel: Set, staff: [names], extra: '' } — malik ka chooser khula
const tcGodamSide = (t, step) => { const b = step === 1 ? t.from : t.to; return Number(b) !== TC_SHOP && tcG1(b); };   // v2.103.57: sirf Godam 1 par godam wale (Zeeshan) ka tick; baqi godam = larka
const tcCanStep = (t, step) => (!tcGodamSide(t, step) || tcIsGiver()) && (step !== 1 || isOwner() || can('stock.tcgive'));
// v2.105.6: "wo tick karein, idhar se hum" — list mein sirf APNI taraf: godam wala (Zeeshan) = Godam 1 wali taraf, baqi = dukan / doosre godam; malik = sab
const tcMySide = (t, step) => isOwner() || (tcIsGiver() ? tcGodamSide(t, step) : !tcGodamSide(t, step));
const tcSide = (t, step) => tcGodamSide(t, step) ? '📦 ' + tcGiver() : Number(step === 1 ? t.from : t.to) !== TC_SHOP ? '📦 Godam (larka)' : '🏪 Dukan';
// v2.116.0: ⚖️ "sirf hisaab" note (stock theek / ginti farq — maal pehle se wahan) = Zeeshan ki tick, raste mein, late, check baqi NAHI; register mein haan
const tcHisaab = t => /sirf\s*hisaa?b/i.test(String(t?.note || ''));
function tcState(t) {
  if (t && t.cancelled) return { k: 'cancel' };
  if (tcHisaab(t)) return { k: 'hisaab' };
  const c = tcChecks.get(tcKey(t)), g = tcChecks.get(tcGKey(t)) || null;
  if (c) return { k: c.status === 'farq' ? 'farq' : 'ok', c, g };
  const age = Date.now() - tcIssued(t);
  return { k: age > TC_LATE ? 'late' : 'wait', age, g, ng: tcNeedG(t) && !g };
}
// v2.118.0: 📦 malik — "Zeeshan jitni items OK kare wo larka bhi utni items OK kare (poora note ka intezar nahi) — jaise Godam 2 ka maal aata hai".
//   Dene wale ka har item "✓ de diya" = transferGive/<key>.g[i] (server) → lene wale ke "📦 Aane wala maal" mein wohi item foran. Poora note diya (G) ka
//   qaida wahi (sab items ✓ = khud G) — "mil gaya" check G ke baghair nahi (rules). Rules 2.72 na lagi ho = purana tareeqa (sirf phone ki yaad).
const tcGvSet = t => { const d = tcGv.get(tcKey(t)), S = new Set(); for (const [i, v] of Object.entries(d?.g || {})) if (v) S.add(Number(i)); return S; };
function tcGiven(t) { const S = new Set(tcGTk().get(tcKey(t)) || []); for (const i of tcGvSet(t)) S.add(i); return S; }   // apne phone ki yaad + server (doosre godam wale ke ✓ bhi)
const tcGvTxt = t => { const n = (t.lines || []).length, g = [...tcGvSet(t)].filter(i => i < n).length; return g ? ` · ${num(g)}/${num(n)} item de diye` : ''; };
function tcGvSend(t, i, on) {
  if (!cloud?.setTransferGive) return;
  cloud.setTransferGive(tcKey(t), { i, on, nm: nameOf() || (isOwner() ? 'Malik' : 'Mulazim'), t: tcIssued(t), from: Number(t.from) || 0, to: Number(t.to) || 0 })
    .catch(e => { if (/permission|insufficient/i.test(String(e?.code || '') + String(e?.message || '')) && !tcGvWarned) { tcGvWarned = true; notice('🔐 Firebase rules 2.72 abhi nahi lagi — item-war "de diya" larke ke paas nahi ja raha (poora note wala tareeqa chal raha). Malik 🔐 Rules lagaye.'); } });
}
function tcAutoWaitGo() {   // larke ne sab ✓ kar diye the jab dene wale ka G abhi nahi tha → G aate hi check khud (sirf isi session ke)
  for (const k of [...tcAutoWait]) { const t = tcAll().find(x => tcKey(x) === k); if (!t || tcChecks.get(k)) { tcAutoWait.delete(k); continue; }
    if (!tcState(t).ng) { tcAutoWait.delete(k); if (tcTkAll(t) && !tcFarqItems(t).length) tcAutoSave(t); } }
}
function tcStepsHTML(t, s) {
  if (s.k === 'cancel' || s.k === 'hisaab' || !tcNeedG(t)) return '';
  const g = s.g, rc = s.c, k = esc(tcKey(t));
  const one = g ? `<span class="tc-sd">✓ ${esc(g.byName || '')} · ${tcClock(g.ts)}${g.pend ? ' · ⏳' : ''}</span>` : tcCanStep(t, 1) ? `<button type="button" class="tc-give${tcArmed('g:' + k) ? ' arm' : ''}" data-tc-give="${k}">${tcArmed('g:' + k) ? '✓ Pakka? dobara dabao' : '☐ Tick — maal de diya'}</button>` : `<span class="tc-sw">⏳ ${tcSide(t, 1)} ka tick baqi${tcGvTxt(t)}</span>`;
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
  if (s.ng) return `📦 ${esc(tcSide(t, 1).replace(/^\S+ /, ''))} ne abhi "maal de diya" tick nahi kiya${tcGvTxt(t)} · ${tcAgo(s.age)}`;   // v2.99.74
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
// v2.103.56: ⚠️ farq ka nishan bhi item par (Set mein 'f<i>'); tcTkSt = '' | 'ok' | 'farq'
const tcTkSt = (t, i) => { const S = tcTkOf(t); return S.has(i) ? 'ok' : S.has('f' + i) ? 'farq' : ''; };
function tcTkSet(t, i, st) { const k = tcKey(t), m = tcTk(); if (!m.has(k)) m.set(k, new Set()); const S = m.get(k); S.delete(i); S.delete('f' + i); if (st === 'ok') S.add(i); else if (st === 'farq') S.add('f' + i); m.delete(k); m.set(k, S); tcTkSave();
  if (tcTkAll(t) && !tcChecks.get(k) && !tcFarqItems(t).length) { tcSel.delete(k); if (tcState(t).ng) tcAutoWait.add(k); else tcAutoSave(t); } else tcSel.delete(k); }   // v2.118.0: G abhi nahi = intezar (aate hi khud)
// v2.103.57: larka ne har item ✓ kar diya → check khud save (button nahi) — farq ho to nahi; ghalti par malik 🗑
function tcAutoSave(t) { const key = tcKey(t); if (tcHisaab(t) || tcChecks.get(key) || tcState(t).ng || !tcCanStep(t, 2) || !cloud?.saveTransferCheck) return;
  const d = { transferId: t.transferId, transferNo: t.transferNo, from: t.from, to: t.to, issuedAt: tcIssued(t), status: 'ok', note: '', byName: nameOf() || (isOwner() ? 'Malik' : 'Mulazim'), device: deviceOf(), lines: (t.lines || []).length };
  tcFast(key, d, { onOk: () => { try { auditOf?.({ area: 'stock', act: 'tr-check', what: `TN ${t.transferNo || t.transferId} ✓ poora (items tick)`.slice(0, 120), ref: key, refType: 'transfer' }); } catch {} } }); notice(`✓ TN ${t.transferNo || t.transferId} check — sab items aa gaye`); }
function tcFarqItems(t) { const S = tcTkOf(t); return (t.lines || []).filter((_, i) => S.has('f' + i)).map(l => l.name); }
// v2.105.6: malik — "Zeeshan ke paas bhi tick system mein items — wo tick kare, idhar se hum". 📦 JANE WALA MAAL: dene wala (godam wala, step 1) har item ✓ de diya
//   (is phone par yaad, sam-tc-gtick) → note ke SAB items ✓ = "maal de diya" khud save (tcGiveNow, wahi transferChecks/<key>G) — phir lene wale ke "Aane wala maal" mein.
const TC_GTK = 'sam-tc-gtick';
function tcGTk() { try { if (!tcGTk.m) { const o = JSON.parse(localStorage.getItem(TC_GTK) || '{}'); tcGTk.m = new Map(Object.entries(o).map(([k, v]) => [k, new Set(v)])); } } catch { tcGTk.m = new Map(); } return tcGTk.m; }
function tcGTkSave() { try { const m = tcGTk(), o = {}; [...m.entries()].slice(-40).forEach(([k, v]) => { if (v.size) o[k] = [...v]; }); localStorage.setItem(TC_GTK, JSON.stringify(o)); } catch {} }
function tcGTkSet(t, i, on) { const k = tcKey(t), m = tcGTk(), S = m.get(k) || new Set(); if (on) S.add(i); else S.delete(i); m.delete(k); m.set(k, S); tcGTkSave();
  if (!on) { const d = tcGv.get(k); if (d?.g && d.g[i] != null) { const g = { ...d.g }; delete g[i]; tcGv.set(k, { ...d, g }); } }   // wapas = foran (server baad mein)
  tcGvSend(t, i, on);   // v2.118.0: server par bhi — lene wale ke phone par wohi item foran
  const n = (t.lines || []).length, G = tcGiven(t); if (on && n && (t.lines || []).every((_, j) => G.has(j)) && !tcChecks.get(tcGKey(t))) tcGiveNow(t); }
const tcQty = l => { const x = cp(Number(l.qty) || 0, Number(l.pack) || 0), pk = Array.isArray(l.pk) && l.pk.length ? ' · 📦 ' + l.pk.map(p => `${p.nm} ×${num(p.n)}`).join(', ') : ''; return `${x.c ? num(x.c) + ' ctn' : ''}${x.c && x.p ? ' + ' : ''}${x.p ? num(x.p) + ' pcs' : ''}${pk}`; };   // v2.103.58: sub-barcode packet (500 gm ×2) bhi
let tcIq = '';
// v2.103.56: 📦 AANE WALA MAAL — sab pending notes ke items ek list (jis taraf aa raha hai us ke neeche); ✓ aa gaya / ⚠️ farq → note ke andar wahi item khud; ticked = neeche chips
function tcInHTML(pend, shown) {   // v2.105.6: shown = jin notes ke items yahan dikhe (baqi chips mein) · har item par 📄 = poora note
  const names = collect().names || {}, rows = [], wait = [];
  for (const { t, s } of pend) { if (!tcCanStep(t, 2) || !tcMySide(t, 2)) continue; const k = tcKey(t), tn = String(t.transferNo || t.transferId), L = t.lines || [];
    if (s?.ng) {   // v2.118.0: dene wale ne poora note abhi nahi diya — jo item "✓ de diya" ho chuke (server) wohi yahan (Godam 2 jaisa)
      const G = tcGvSet(t), idx = L.map((_, i) => i).filter(i => G.has(i) || tcTkSt(t, i)); if (!idx.length) continue;
      shown?.add(k); idx.forEach(i => rows.push({ t, k, i, l: L[i], st: tcTkSt(t, i), to: branchName(t.to, names), tn }));
      const left = L.filter((_, i) => !G.has(i)).length; if (left > 0) wait.push({ k, tn, left, who: tcSide(t, 1) }); continue; }
    shown?.add(k); L.forEach((l, i) => rows.push({ t, k, i, l, st: tcTkSt(t, i), to: branchName(t.to, names), tn })); }
  if (!rows.length) return '';
  const q = fold(tcIq.trim()), open = rows.filter(r => !r.st && (!q || fold(r.l.name).includes(q))), done = rows.filter(r => r.st), G = new Map();
  for (const r of open) { if (!G.has(r.to)) G.set(r.to, []); G.get(r.to).push(r); }
  const row = r => `<div class="tc-ir"><span><b>${esc(r.l.name)}</b><small>${tcQty(r.l)} · TN ${esc(r.tn)}</small></span><button type="button" class="tc-idoc" data-tc-show="${esc(r.k)}" aria-label="Poora note" title="Poora transfer note">📄</button>${isOwner() || can('stock.tcprint') ? `<button type="button" class="tc-ilb" data-tc-lb1="${esc(r.k)}|${r.i}" aria-label="Barcode">🏷</button>` : ''}<button type="button" class="tc-iok" data-tc-itk="${esc(r.k)}|${r.i}|ok">✓ aa gaya</button><button type="button" class="tc-ifq" data-tc-itk="${esc(r.k)}|${r.i}|farq">⚠️</button></div>`;
  return `<details class="rk-set tc-in" open><summary>📦 Aane wala maal — <b>${num(rows.length - done.length)}</b> items baqi${done.length ? ` · ✓ ${num(done.length)}` : ''}</summary>
    <label class="hs-search tc-iq"><input type="search" data-tc-iq="1" placeholder="🔍 item dhoondo…" value="${esc(tcIq)}" autocomplete="off"></label>
    ${[...G].map(([to, ys]) => `<div class="tc-ig"><b>→ ${esc(to)} <i>${num(ys.length)}</i></b>${ys.sort((a, b) => a.l.name.localeCompare(b.l.name)).map(row).join('')}</div>`).join('') || (q ? '<p class="muted">Kuch nahi mila</p>' : wait.length ? '<p class="tc-iall">✓ Jo items diye gaye wo sab aa gaye</p>' : '<p class="tc-iall">✓ Sab items aa gaye — neeche note par "Maal poora mila" dabao</p>')}
    ${wait.map(w => `<p class="tc-iwait">⏳ TN ${esc(w.tn)} — <b>${num(w.left)} item</b> abhi ${esc(w.who)} ke paas (de diya baqi) · diye to yahan khud aa jayenge</p>`).join('')}
    ${done.length ? `<div class="tc-ich"><small>✓ Maal aa gaya (chip dabao = wapas)</small>${done.map(r => `<button type="button" class="tc-ic ${r.st}" data-tc-itk="${esc(r.k)}|${r.i}|">${r.st === 'farq' ? '⚠️' : '✓'} ${esc(r.l.name)} <i>${tcQty(r.l)}</i></button>`).join('')}${[...new Map(done.filter(r => r.st === 'farq').map(r => [r.k, r])).values()].map(r => `<button type="button" class="tc-ic farq tc-fqs" data-tc-show="${esc(r.k)}">📄 TN ${esc(r.tn)} — ⚠️ farq likh kar save karo</button>`).join('')}</div>` : ''}</details>`;
}
function tcOutHTML(pend, shown) {   // v2.105.6: 📦 Jane wala maal — jo step 1 (de diya) laga sakta hai (malik nahi — malik note khol kar tick)
  if (isOwner()) return '';   // dene wala: Godam 1 se = godam wala (Zeeshan) · dukan se = larka (tcCanStep 1)
  const names = collect().names || {}, rows = [];
  for (const { t, s } of pend) { if (!tcNeedG(t) || s.g || !tcCanStep(t, 1) || !tcMySide(t, 1)) continue; const k = tcKey(t), S = tcGiven(t); shown?.add(k);   // v2.118.0: phone + server (doosre godam wale ke ✓ bhi)
    (t.lines || []).forEach((l, i) => rows.push({ t, k, i, l, on: S.has(i), to: branchName(t.to, names), tn: String(t.transferNo || t.transferId) })); }
  if (!rows.length) return '';
  const open = rows.filter(r => !r.on), done = rows.filter(r => r.on), G = new Map(); for (const r of open) { if (!G.has(r.to)) G.set(r.to, []); G.get(r.to).push(r); }
  const row = r => `<div class="tc-ir"><span><b>${esc(r.l.name)}</b><small>${tcQty(r.l)} · TN ${esc(r.tn)}</small></span><button type="button" class="tc-idoc" data-tc-show="${esc(r.k)}" aria-label="Poora note" title="Poora transfer note">📄</button><button type="button" class="tc-iok tc-igv" data-tc-gtk="${esc(r.k)}|${r.i}|1">✓ de diya</button></div>`;
  return `<details class="rk-set tc-in tc-out" open><summary>📦 Jane wala maal — <b>${num(open.length)}</b> items baqi (de diya)${done.length ? ` · ✓ ${num(done.length)}` : ''}</summary>
    ${[...G].map(([to, ys]) => `<div class="tc-ig"><b>→ ${esc(to)} <i>${num(ys.length)}</i></b>${ys.sort((a, b) => a.l.name.localeCompare(b.l.name)).map(row).join('')}</div>`).join('') || '<p class="tc-iall">✓ Sab items de diye — note khud save ho raha hai</p>'}
    ${done.length ? `<div class="tc-ich"><small>✓ De diya (chip dabao = wapas)</small>${done.map(r => `<button type="button" class="tc-ic ok" data-tc-gtk="${esc(r.k)}|${r.i}|">✓ ${esc(r.l.name)} <i>${tcQty(r.l)}</i></button>`).join('')}</div>` : ''}</details>`;
}
// v2.105.6: note ka chhota chip (⏳ raste · 📦 de diya baqi · ✓ check · ⚠️ farq · ❌ cancel) — dabao = poora note (Scan / Check view)
function tcChip(t, s, names) {
  const k = tcKey(t), tn = esc(t.transferNo || t.transferId), dir = `${esc(branchName(t.from, names))} → ${esc(branchName(t.to, names))}`;
  const lab = s.k === 'ok' ? `✓ TN ${tn} · ${tcClock(s.c.ts)}` : s.k === 'farq' ? `⚠️ TN ${tn} · farq` : s.k === 'cancel' ? `❌ TN ${tn}` : s.ng ? `📦 TN ${tn} · de diya ${(() => { const n = (t.lines || []).length, g = [...tcGvSet(t)].filter(i => i < n).length; return g ? num(g) + '/' + num(n) : 'baqi'; })()}` : `⏳ TN ${tn} · ${tcAgo(s.age)}`;
  return `<button type="button" class="tc-nc ${s.k}${s.ng ? ' ng' : ''}${!s.c && s.k !== 'cancel' && tcFarqItems(t).length ? ' fq' : ''}" data-tc-show="${esc(k)}"><b>${lab}</b><small>${dir} · ${tcSum(t)}</small></button>`;
}
function tcLinesCk(t) { const k = tcKey(t), S = tcTkOf(t), L = t.lines || [], n = L.filter((_, i) => S.has(i)).length;
  return `<div class="tc-tkh"><i class="tc-tkc${n === L.length ? ' ok' : ''}">✓ ${num(n)}/${num(L.length)} gine</i>${isOwner() ? `<button type="button" class="tc-tka" data-tc-tka="${esc(k)}">${n === L.length ? '☐ koi nahi' : '☑ sab'}</button>` : ''}</div>`
    + L.map((l, i) => { const x = cp(Number(l.qty) || 0, Number(l.pack) || 0), st = tcTkSt(t, i), on = st === 'ok'; return `<label class="tc-ln tc-lck${on ? ' is-in' : st === 'farq' ? ' is-fq' : ''}"><input type="checkbox" data-tc-tk="${esc(k)}|${i}"${on ? ' checked' : ''}><span>${esc(l.name)}${st === 'farq' ? ' <i class="rk-c kh">⚠️ farq</i>' : ''}</span><b>${tcQty(l)}</b><button type="button" class="tc-ifq${st === 'farq' ? ' on' : ''}" data-tc-itk="${esc(k)}|${i}|${st === 'farq' ? '' : 'farq'}" aria-label="farq">⚠️</button></label>`; }).join(''); }
function tcLines(t) { return (t.lines || []).map(l => `<div class="tc-ln"><span>${esc(l.name)}</span><b>${tcQty(l)}</b></div>`).join(''); }
function tcWho(c) { return `<div class="tc-who"><span>👤 ${esc(c.byName || '—')}</span><span>🕒 ${tcClock(c.ts)} · ${esc(regDay(c.ts || Date.now()))}</span><span>📱 Device: <b>${esc(c.device || '—')}</b></span></div>`; }
function tcAll() {   // v2.99.25: POS ke note + app ke bane note (transferJobs done) jo abhi POS list (transfer-dekho) mein nahi aaye
  const dels = new Set((trList || []).filter(j => (j.op === 'delete' && j.transferId || j.op === 'edit' && j.oldId) && j.status === 'done').map(j => String(j.op === 'edit' ? j.oldId : j.transferId)));   // v2.99.58: app se cancel · v2.99.68: edit = purana cancel
  const pkOf = new Map(); for (const j of trList || []) { if (j.status !== 'done' || !j.transferId || j.op === 'delete') continue; for (const l of j.lines || []) if (Array.isArray(l.pk) && l.pk.length) pkOf.set(String(j.transferId) + '|' + String(l.itemId), l.pk); }   // v2.103.58: POS note par bhi packet (app job se)
  const L = (ptList || []).map(t => { const x = dels.has(String(t.transferId)) && !t.cancelled ? { ...t, cancelled: true, cancelledAt: t.cancelledAt || 0 } : t; return pkOf.size && (x.lines || []).some(l => pkOf.has(String(x.transferId) + '|' + String(l.itemId))) ? { ...x, lines: x.lines.map(l => { const pk = pkOf.get(String(x.transferId) + '|' + String(l.itemId)); return pk ? { ...l, pk } : l; }) } : x; }), ids = new Set(L.map(t => String(t.transferId)));
  for (const j of trList || []) { if (j.op === 'delete' || j.status !== 'done' || !j.transferId || ids.has(String(j.transferId)) || dels.has(String(j.transferId))) continue;
    L.push({ id: 'T' + j.transferId, transferId: Number(j.transferId), transferNo: String(j.transferNo || ''), from: Number(j.from), to: Number(j.to), at: Number(j.doneAt) || Number(j.at) || 0, createdOn: Number(j.doneAt) || Number(j.at) || 0, app: true, lines: (j.lines || []).map(l => ({ itemId: String(l.itemId), name: l.name, qty: Number(l.qty) || 0, pack: Number(l.pack) || 0, ...(Array.isArray(l.pk) && l.pk.length ? { pk: l.pk } : {}) })) }); }
  return L;
}
// v2.111.0: 💰 MAZDOORI — godam → dukan transfer note ke packet (malik: "larke ne note banaya, dukan par maal aa gaya (✓ mil gaya) = usi waqt mazdoori").
//   Har note: {key (tcKey — pay ka nishan), no, from, at, st (ok / farq / wait / late), by (note banane wala), lines [{itemId, name, z (packet size), n}]}.
//   Packet: line.pk (📦 250 gm ×10) — 14 din se purane app note ka pk = oldJobs (barcode.js ek dafa server se). pk na ho = poore pcs (z 1, sirf poore hindse).
export const stockShop = () => { const { branches, names } = brInfo(); return branches.find(b => /noor/i.test(String(names[b] || ''))) ?? (branches.includes(1) ? 1 : branches[0]); };
export function stockArrivals(lo, hi, oldJobs = []) {
  thWatch(); const shop = stockShop();
  const pkOld = new Map(), byJob = new Map();
  for (const j of [...(oldJobs || []), ...(trList || [])]) { if (!j || !j.transferId || j.op === 'delete') continue; byJob.set(String(j.transferId), j);
    if (j.status === 'done') for (const l of j.lines || []) if (Array.isArray(l.pk) && l.pk.length) pkOld.set(String(j.transferId) + '|' + String(l.itemId), l.pk); }
  const out = [];
  for (const t of tcAll()) {
    const at = tcIssued(t); if (!(at >= lo && at < hi) || t.cancelled || Number(t.to) !== Number(shop) || Number(t.from) === Number(shop)) continue;
    const lines = [];
    for (const l of t.lines || []) { const pk = Array.isArray(l.pk) && l.pk.length ? l.pk : pkOld.get(String(t.transferId) + '|' + String(l.itemId));
      if (pk) { for (const p of pk) { const z = Number(p.z) || 0, n = Number(p.n) || 0; if (z > 0 && n > 0) lines.push({ itemId: String(l.itemId), name: String(l.name || ''), z, n, pk: true }); } }
      else { const q = Number(l.qty) || 0; if (q > 0 && Math.abs(q - Math.round(q)) < 1e-9) lines.push({ itemId: String(l.itemId), name: String(l.name || ''), z: 1, n: Math.round(q), pk: false }); } }
    const job = byJob.get(String(t.transferId));
    out.push({ key: tcKey(t), no: String(t.transferNo || '').replace(/^0+/, ''), from: Number(t.from), at, st: tcState(t).k, by: String(job?.byName || '').trim() || (t.app ? 'Mulazim' : 'POS'), lines });
  }
  return out.sort((a, b) => b.at - a.at);
}
function tcRows() {
  const since = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (tcDays === 2 ? 1 : tcDays - 1)); return d.getTime(); })();
  const till = tcDays === 2 ? (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })() : Infinity;
  const main = agPool().main ?? 1;
  return tcAll().filter(t => t && !tcHisaab(t) && tcIssued(t) >= since && tcIssued(t) < till)
    .filter(t => tcDir === 'all' || (tcDir === 'in' ? Number(t.to) === Number(main) : Number(t.from) === Number(main)));
}
function tcNikleHTML() {   // v2.105.6: malik — bare card (Note dobara / Barcode dobara) nahi; sirf items (lene / dene wala) + chhote chips; 📄 / chip = poora note
  const names = collect().names || {}, rows = tcRows().map(t => ({ t, s: tcState(t) }));
  const pend = rows.filter(x => x.s.k === 'wait' || x.s.k === 'late').sort((a, b) => tcIssued(a.t) - tcIssued(b.t));
  const done = rows.filter(x => x.s.k === 'ok' || x.s.k === 'farq').sort((a, b) => (b.s.c.ts || 0) - (a.s.c.ts || 0));
  const canc = rows.filter(x => x.s.k === 'cancel');
  const late = pend.filter(x => x.s.k === 'late').length, farq = done.filter(x => x.s.k === 'farq').length;
  const C = (on, k, v, lab) => `<button type="button" class="rc${on ? ' on' : ''}" data-tc-${k}="${v}">${lab}</button>`;
  const shown = new Set(), outH = tcOutHTML(pend, shown), inH = tcInHTML(pend, shown), rest = pend.filter(x => !shown.has(tcKey(x.t)));
  const dl = tcDays === 1 ? 'Aaj' : tcDays === 2 ? 'Kal' : tcDays + ' din', dr = tcDir === 'in' ? 'Godam → Dukan' : tcDir === 'out' ? 'Dukan → Godam' : 'Sab taraf';
  return `<button type="button" class="rk-pill" data-mn-sheet="1"><span>📅 ${dl} · ⇄ ${dr}</span><i>⋮ badlein</i></button>
    <div class="mchips" data-mn-seg="tc.d" data-mn-i="📅" data-mn-t="Kis din ke note" data-mn-g="🧾 Transfer check">${C(tcDays === 1, 'd', 1, 'Aaj')}${C(tcDays === 2, 'd', 2, 'Kal')}${C(tcDays === 7, 'd', 7, '7 din')}${C(tcDays === 30, 'd', 30, '30 din')}</div>
    <div class="mchips" data-mn-seg="tc.dir" data-mn-i="⇄" data-mn-t="Kis taraf ke note" data-mn-g="🧾 Transfer check">${C(tcDir === 'all', 'dir', 'all', 'Sab')}${C(tcDir === 'in', 'dir', 'in', 'Godam → Dukan')}${C(tcDir === 'out', 'dir', 'out', 'Dukan → Godam')}</div>
    ${isOwner() ? (tcGEd ? tcGEdHTML() : `<button type="button" class="tc-giver" data-tc-giver="1" data-mn="tc.giver" data-mn-i="📦" data-mn-t="Godam wale (pehla tick)" data-mn-s="${esc(tcGiver())}" data-mn-g="🧾 Transfer check">📦 Godam wale (pehla tick): <b>${esc(tcGiver())}</b> ✎</button>`) : ''}
    <div class="tc-kpis">${(() => { const ng = pend.filter(x => x.s.ng).length; return ng ? `<div class="bad"><b>${ng}</b><small>📦 de diya tick nahi</small></div>` : ''; })()}<div class="${pend.length ? 'bad' : ''}"><b>${pend.length}</b><small>⏳ nahi pahunche${late ? ` · ${late} der se` : ''}</small></div><div class="good"><b>${done.length - farq}</b><small>✓ check ho gaye</small></div><div class="${farq ? 'warn' : ''}"><b>${farq}</b><small>⚠️ farq</small></div></div>
    ${outH}${inH}
    ${rest.length ? `<div class="tc-ncs"><h4 class="tc-hh">⏳ Raste mein (${rest.length}) <small>— chip dabao = poora note</small></h4><div class="tc-ncw">${rest.map(x => tcChip(x.t, x.s, names)).join('')}</div></div>` : ''}
    ${done.length ? `<div class="tc-ncs"><h4 class="tc-hh">✓ Check ho chuke (${done.length}) <small>— chip dabao = poora note</small></h4><div class="tc-ncw">${done.map(x => tcChip(x.t, x.s, names)).join('')}</div></div>` : ''}
    ${canc.length ? `<details class="tc-ncs"><summary class="tc-hh">❌ Cancel ho gaye (${canc.length}) <small>— POS mein mita diye, check nahi karne</small></summary><div class="tc-ncw">${canc.map(x => tcChip(x.t, x.s, names)).join('')}</div></details>` : ''}
    ${rows.length ? '' : '<p class="muted">Is arse mein koi transfer note nahi nikla.</p>'}`;
}
function tcNoteMore(t, withLines, noSteps) {   // v2.105.6: poora note — pehle Nikle ke bare card mein tha
  const s = tcState(t), k = tcKey(t), names = collect().names || {};
  return `<div class="tc-more tc-full"><small class="tc-fh">${esc(branchName(t.from, names))} → ${esc(branchName(t.to, names))} · ${tcSum(t)} · nikla ${tcClock(tcIssued(t))} · ${esc(regDay(tcIssued(t)))}</small>${s.k === 'cancel' || noSteps ? '' : tcStepsHTML(t, s)}${s.k === 'cancel' ? '' : tcEditHTML(t)}${withLines ? `<div class="tc-lines">${tcLines(t)}</div>` : ''}
    ${s.k !== 'cancel' && (isOwner() || can('stock.tcprint')) ? `<div class="tc-rp"><button type="button" data-tc-rp="${esc(k)}|note">🖨 Note dobara</button><button type="button" data-tc-rp="${esc(k)}|lb">🏷 Barcode dobara</button><button type="button" data-tc-rp="${esc(k)}|both">🖨+🏷 Dono</button></div>` : ''}
    ${s.g && tcNeedG(t) ? `<p class="tc-note">📦 1 number: ${esc(s.g.byName || '')} · ${tcClock(s.g.ts)} · 📱 ${esc(s.g.device || '—')}</p>${isOwner() && !s.c ? `<button type="button" class="tc-del" data-tc-del="${esc(tcGKey(t))}">🗑 "De diya" tick hatao (sirf malik)</button>` : ''}` : ''}${s.c && isOwner() ? `<button type="button" class="tc-del" data-tc-del="${esc(k)}">🗑 Check hatao (sirf malik — ghalti par)</button>` : ''}</div>`;
}
function tcScanHTML() {
  const names = collect().names || {}, r = tcRes, me = (() => { const t0 = new Date(); t0.setHours(0, 0, 0, 0); const d = deviceOf(); return [...tcChecks.values()].filter(c => (c.ts || 0) >= t0.getTime() && c.device === d).length; })();
  let res = '';
  if (r?.type === 'none') res = `<div class="tc-res bad"><b>❌ "${esc(r.code)}" — yeh transfer note nahi mila</b><small>POS mein note bane ke 1-2 minute baad app mein aata hai. Thori der baad dobara scan karein. Number ghalat ho to parchi par likha number dekhein.</small><button type="button" data-tc-retry="1">🔄 Dobara dhoondo</button></div>`;
  else if (r?.type === 'cancel') res = `<div class="tc-res bad"><b>❌ TN ${esc(r.t.transferNo || r.t.transferId)} cancel ho chuka hai</b><small>POS mein yeh note mita diya gaya${r.t.cancelledAt ? ' (' + tcClock(r.t.cancelledAt) + ')' : ''} — check ki zaroorat nahi. Maal aaya ho to malik ko batayein.</small></div>`;
  else if (r?.type === 'hisaab') res = `<div class="tc-res good"><b>⚖️ TN ${esc(r.t.transferNo || r.t.transferId)} — sirf hisaab ka note</b><small>Stock theek / ginti farq — maal pehle se wahan tha, hila nahi. Check (tick) ki zaroorat nahi.</small></div>`;
  else if (r?.type === 'nogive') res = `<div class="tc-res lock"><b>🔒 TN ${esc(r.t.transferNo || r.t.transferId)} — pehle ${esc(tcSide(r.t, 1))} "maal de diya" tick kare</b><small>Dene wale ke tick ke baghair "mil gaya" save nahi hota. ${tcCanStep(r.t, 1) ? 'Aap hi dene wale hain — neeche tick karein.' : 'Us se kahein apne login se tick kare.'}</small>${tcCanStep(r.t, 1) ? `<button type="button" class="tc-give" data-tc-give="${esc(tcKey(r.t))}">☐ Tick — maal de diya</button>` : ''}</div>`;
  else if (r?.type === 'noside') res = `<div class="tc-res lock"><b>🔒 TN ${esc(r.t.transferNo || r.t.transferId)} — yeh check sirf ${esc(tcSide(r.t, 2))} kar sakta hai</b><small>Maal godam mein aaya hai — godam wala apne login se "mil gaya" kare.</small></div>`;
  else if (r?.type === 'done') res = `<div class="tc-res lock"><b>🔒 TN ${esc(r.t.transferNo || r.t.transferId)} pehle hi check ho chuka</b><small>${r.c.status === 'farq' ? '⚠️ Farq: ' + esc(r.c.note || '') + ' · ' : '✓ Poora mila · '}ab badla nahi ja sakta</small>${tcWho(r.c)}</div>`;
  else if (r?.type === 'saved') res = `<div class="tc-res good"><b>${r.c.status === 'farq' ? '⚠️ Farq ke saath save' : '✓ Check ho gaya'} — TN ${esc(r.t.transferNo || r.t.transferId)}</b><small>${tcIssued(r.t) ? 'Nikalne ke ' + tcAgo((r.c.ts || Date.now()) - tcIssued(r.t)) + ' baad pahuncha · ' : ''}ab koi badal nahi sakta</small>${tcWho(r.c)}</div>`;
  else if (r?.type === 'open') { const t = r.t, age = Date.now() - tcIssued(t);
    res = `<div class="tc-res open"><div class="tc-rh"><b>TN ${esc(t.transferNo || t.transferId)}</b><span class="tc-st ${age > TC_LATE ? 'late' : 'wait'}">⏳ ${tcAgo(age)}</span></div>
      <small>${esc(branchName(t.from, names))} → ${esc(branchName(t.to, names))} · nikla ${tcClock(tcIssued(t))} · ${esc(regDay(tcIssued(t)))}</small>
      ${tcEditHTML(t)}<div class="tc-lines">${tcLinesCk(t)}</div>
      ${tcFarq ? `<label class="tc-fl">Kya farq hai? (jaise "cheeni 1 bori kam")<textarea data-tc-note="1" maxlength="300" rows="2" placeholder="Kya kam / zyada / toota aaya…">${esc((() => { const f = tcFarqItems(t), m = tcMissing(t).filter(x => !f.some(n => x.startsWith(n))); return ((f.length ? 'Farq: ' + f.join(', ') : '') + (m.length && m.length < (t.lines || []).length ? (f.length ? ' · ' : '') + 'Nahi mila: ' + m.join(', ') : '')).slice(0, 280); })())}</textarea></label>
        <div class="tc-btns"><button type="button" class="tc-fsave" data-tc-fsave="1"${tcBusy ? ' disabled' : ''}>⚠️ Farq save karo</button><button type="button" class="tc-back" data-tc-fback="1">Wapas</button></div>`
      : `<div class="tc-btns"><button type="button" class="tc-ok" data-tc-ok="1"${tcBusy || (tcNeedAll() && !tcTkAll(t)) ? ' disabled' : ''}>${tcBusy ? '⏳ Save…' : tcNeedAll() && !tcTkAll(t) ? `☐ Pehle sab gin kar ✓ (${num((t.lines || []).length - tcTkOf(t).size)} baqi)` : '✓ Maal poora mila'}</button><button type="button" class="tc-farq" data-tc-farq="1"${tcBusy ? ' disabled' : ''}>⚠️ Farq hai</button></div>`}
      <p class="tc-warn">Save ke baad yeh check <b>koi badal nahi sakta</b>. Pehle maal gin lein.</p></div>`; }
  const more = r?.t ? tcNoteMore(r.t, r.type !== 'open', r.type === 'nogive') : '';   // nogive: tick ka button upar natije mein — steps dobara nahi
  if (tcBack && r?.t) return `<button type="button" class="tc-back2" data-tc-back="1">← Wapas list</button>${res}${more}`;   // v2.105.6: list se khula = sirf note (scanner nahi)
  return `<div class="tc-scan"><button type="button" class="tc-cam" data-tc-cam="1">${camMissing() ? '🔫 Scanner gun se scan karein' : '📷 Camera se barcode scan'}</button><small>Ya scanner gun chalayein / parchi ka number neeche likhein</small></div>
    <form class="tc-inp" data-tc-form="1"><input data-tc-code="1" inputmode="numeric" autocomplete="off" enterkeyhint="go" placeholder="Transfer note number / barcode" value="${esc(tcCode)}"><button type="submit">✓</button></form>
    ${res}${more}
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
  tcDays = 1; tcDir = 'all'; openTransferCheck('nikle'); tcShow(key);   // v2.105.6: bare card nahi — seedha poora note
}
window.addEventListener?.('hashchange', () => tcHashGo());
setTimeout(() => tcHashGo(), 2500);
export function openTransferCheck(view) {
  const d = $('dialog'); if (!d) return;
  tcStart(); if (view) tcView = view; recentPush({ key: 'tc', icon: '🧾', label: 'Transfer check', open: { kind: 'stock', screen: 'check', view: tcView } });
  d.classList.remove('search-dialog'); d.classList.add('full-dialog');
  $('dialogTitle').textContent = '🧾 Transfer check';
  $('dialogBody').innerHTML = tcHTML();
  if (!d.open) d.showModal();
  if (tcView === 'scan' && !matchMedia?.('(pointer:coarse)')?.matches) document.querySelector('[data-tc-code]')?.focus();
}
// v2.105.6: 📄 / chip → poora note (Scan / Check view ka natija + steps + 🖨 dobara), upar "← Wapas list"
function tcShow(key) {
  const t = tcAll().find(x => tcKey(x) === key); if (!t) { notice('Note nahi mila'); return; }
  const s = tcState(t), c = tcChecks.get(key); tcCode = String(t.transferNo || t.transferId); tcFarq = false;
  tcRes = s.k === 'cancel' ? { type: 'cancel', t } : s.k === 'hisaab' ? { type: 'hisaab', t } : c ? { type: 'done', t, c } : s.ng ? { type: 'nogive', t } : !tcCanStep(t, 2) ? { type: 'noside', t } : { type: 'open', t };
  tcView = 'scan'; tcBack = true; tcPaint(); try { $('dialogBody').scrollTop = 0; } catch {}
}
function tcLookup(code) {
  tcCode = String(code || '').trim(); tcFarq = false;
  if (!tcCode) { tcRes = null; tcPaint(); return; }
  const t = tcFind(tcCode);
  if (!t) { tcRes = { type: 'none', code: tcCode }; beep(false); tcPaint(); return; }
  if (tcState(t).k === 'cancel') { tcRes = { type: 'cancel', t }; beep(false); tcPaint(); return; }   // v2.99.58
  if (tcState(t).k === 'hisaab') { tcRes = { type: 'hisaab', t }; beep(true); tcPaint(); return; }   // v2.116.0: sirf hisaab — tick nahi
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
  const sh = e.target.closest?.('[data-tc-show]'); if (sh) { e.preventDefault(); tcShow(sh.dataset.tcShow); return; }   // v2.105.6
  const tg = e.target.closest?.('[data-tc-gtk]'); if (tg) { e.preventDefault(); const [k, i, on] = tg.dataset.tcGtk.split('|'), tt = tcAll().find(x => tcKey(x) === k); if (!tt) return; tcGTkSet(tt, Number(i), on === '1'); tcPaint(); return; }
  if (e.target.closest?.('[data-tc-back]')) { tcView = 'nikle'; tcRes = null; tcCode = ''; tcFarq = false; tcBack = false; tcPaint(); return; }
  const ti = e.target.closest?.('[data-tc-itk]'); if (ti) { e.preventDefault(); const [k, i, st] = ti.dataset.tcItk.split('|'), tt = tcAll().find(x => tcKey(x) === k); if (!tt) return; tcTkSet(tt, Number(i), st); tcPaint(); return; }
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
  if (d.tcView) { tcView = d.tcView; tcBack = false; if (tcView === 'scan' && tcRes?.type !== 'open') tcRes = null; }
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
  tcArm = { k: '', until: 0 }; tcGiveNow(t);
}
function tcGiveNow(t) {   // v2.105.6: Jane wala maal ke sab items ✓ → khud (bina "pakka?")
  if (!cloud?.saveTransferCheck || !tcCanStep(t, 1) || tcChecks.get(tcGKey(t))) return;
  const gk = tcGKey(t), d = { transferId: t.transferId, transferNo: t.transferNo, from: t.from, to: t.to, issuedAt: tcIssued(t), status: 'diya', note: '', byName: nameOf() || (isOwner() ? 'Malik' : 'Mulazim'), device: deviceOf(), lines: (t.lines || []).length };
  if (tcRes?.type === 'nogive' && tcRes.t === t) tcRes = tcCanStep(t, 2) ? { type: 'open', t } : tcBack ? { type: 'noside', t } : null;
  notice('✓ "Maal de diya" — TN ' + (t.transferNo || t.transferId));
  tcFast(gk, d, { onOk: () => { try { auditOf?.({ area: 'stock', act: 'tr-give', what: `TN ${t.transferNo || t.transferId} 📦 maal de diya`.slice(0, 120), ref: gk, refType: 'transfer' }); } catch {} } });   // v2.99.78: ⚡ foran ✓
}
document.addEventListener('input', e => { const t = e.target; if (!t.matches?.('[data-tc-iq]')) return; tcIq = t.value; const box = t.closest('.tc-in'); if (!box) return;   // v2.103.56: sirf list dobara (focus na toote)
  const tmp = document.createElement('div'); const names = collect().names || {}, rows = tcRows().map(x => ({ t: x, s: tcState(x) })).filter(x => x.s.k === 'wait' || x.s.k === 'late').filter(x => !x.s.ng); tmp.innerHTML = tcInHTML(rows); const nb = tmp.querySelector('.tc-in');
  if (nb) { for (const el of [...box.children]) if (!el.matches('summary,.tc-iq')) el.remove(); for (const el of [...nb.children]) if (!el.matches('summary,.tc-iq')) box.appendChild(el); } });
document.addEventListener('change', e => { if (e.target.matches?.('[data-tc-gn]') && tcGEd) { const n = e.target.dataset.tcGn; if (e.target.checked) tcGEd.sel.add(n); else tcGEd.sel.delete(n); tcPaint(); return; } if (e.target.matches?.('[data-tc-tk]')) { const [k, i] = e.target.dataset.tcTk.split('|'), t = tcAll().find(x => tcKey(x) === k); if (!t) return; tcTkSet(t, Number(i), e.target.checked ? 'ok' : ''); tcPaint(); return; }
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
  const d = $('dialog'); if (!d) return; recentPush({ key: 'transfer', icon: '⇄', label: 'Transfer note', open: { kind: 'stock', screen: 'transfer' } });
  trZeroShow = false;   // v2.18
  const bs = trBranches();
  if (trFrom == null) trFrom = bs.find(b => b.id !== 1)?.id ?? bs[0]?.id;
  if (trTo == null) trTo = 1;
  d.classList.remove('search-dialog'); d.classList.add('full-dialog');   // v2.99.64: poori screen
  $('dialogTitle').textContent = '⇄ Transfer note';
  const sel = (name, val) => `<select data-tr-${name}>${bs.map(b => `<option value="${b.id}"${b.id === val ? ' selected' : ''}>${esc(b.name)}</option>`).join('')}</select>`;
  const kul = trLines.reduce((s, l) => s + l.qty, 0);
  const names0 = collect().names, gN = esc(branchName(trFrom, names0)), cpTxt = (q, pk, l) => { q = Math.max(0, Number(q) || 0); if (!(pk > 1)) return num(q) + ' ' + esc(l.uName || 'Pcs'); const c = Math.floor(q / pk + 1e-9), p = Math.round((q - c * pk) * 1000) / 1000; return (c ? num(c) + ' ' + esc(l.cName || 'Ctn') : '') + (c && p ? ' + ' : '') + (p || !c ? num(p) + ' ' + esc(l.uName || 'Pcs') : ''); };
  const totC = trLines.reduce((n, l) => n + (Number(l.pack) > 1 && !l.pk?.length ? Number(l.ctn) || 0 : 0), 0), totP = trLines.reduce((n, l) => n + (l.pk?.length ? 0 : Number(l.pcs) || 0), 0), totK = trLines.reduce((n, l) => n + (l.pk?.length ? l.pk.reduce((t, p) => t + p.n, 0) : 0), 0);
  $('dialogBody').innerHTML = `<div class="tn-root">${trEdit ? `<div class="tn-edit">✏️ <b>Edit — TN ${esc(trEdit.no)}</b><small>Save par purana note cancel ho kar naya banega (naya TN number)</small><button type="button" data-tr-editx="1">✕ Edit chhoro</button></div>` : ''}
    <div class="tn-route"><label class="tn-g from"><small>📤 Se (nikle)</small>${sel('from', trFrom)}</label><span class="tn-arrow">➜</span><label class="tn-g to"><small>📥 Ko (jaye)</small>${sel('to', trTo)}</label></div>
    <div class="tn-find"><div class="scan-find"><input class="scan-q" data-tr-q type="search" placeholder="🔍 ${gN} ka item — naam / code" autocomplete="off"><div class="scan-hits" data-tr-hits hidden></div></div><button type="button" class="tn-scan" data-tr-scan="1">${camMissing() ? '🔫' : '📷'}<small>${camMissing() ? 'Gun' : 'Scan'}</small></button></div>
    <p class="tn-hint">Sirf <b>${gN}</b> ke woh items jin ka stock hai · tadad pehle <b>Ctn</b> mein</p>
    <div class="tn-lines">${trLines.map((l, i) => [l, i]).reverse().map(([l, i]) => { const have = trAvail(l.id); const short = trFrom !== 1 && have < l.qty - 0.0005; const pk = Number(l.pack) || 0; const full = Math.abs(have - l.qty) < 0.0005;
      return `<div class="tn-line${short ? ' short' : ''}"><div class="tn-top"><span class="tn-no">${i + 1}</span><div class="tn-nm"><b>${esc(l.name)}</b><small>📦 ${gN} mein: <b>${cpTxt(have, pk, l)}</b>${pk > 1 ? ' · 1 ' + esc(l.cName || 'Ctn') + ' = ' + num(pk) : ''}${short ? ' · <b class="red">⛔ stock kam</b>' : ''}</small></div><button type="button" class="tn-x" data-tr-del="${i}" aria-label="Hatao">✕</button></div>
      ${(() => { const S = trSizes(l); return S.length > 1 ? `<div class="tn-pkc"><span>📦 Packet</span>${S.map(x => `<button type="button" class="${l.pk?.some(y => Math.abs(y.z - x.z) < 1e-9) ? 'is-in' : ''}" data-tr-pk="${i}|${x.z}">${esc(x.nm)}</button>`).join('')}</div>` : ''; })()}
      ${l.pk?.length ? `<div class="tn-pks">${l.pk.map(p => `<div class="tn-pkr"><b>${esc(p.nm)}</b><span><button type="button" data-tr-pkm="${i}|${p.z}">➖</button><input type="text" inputmode="numeric" value="${num(p.n)}" data-tr-pkn="${i}|${p.z}"><button type="button" data-tr-pkp="${i}|${p.z}">➕</button></span><small>packet</small></div>`).join('')}<small class="tn-eq">= POS mein <b>${num(l.qty)} ${esc(l.uName || 'Pcs')}</b> · ${num(l.pk.reduce((t, p) => t + p.n, 0))} packet</small></div>` :
      `<div class="tn-qty">${pk > 1 ? `<label class="tn-q ctn"><span>${esc(l.cName || 'Ctn')}</span><input type="text" inputmode="decimal" value="${num(l.ctn || 0)}" data-tr-ctn="${i}"></label>` : ''}<label class="tn-q"><span>${esc(l.uName || 'Pcs')}</span><input type="text" inputmode="decimal" value="${num(l.pcs ?? l.qty)}" data-tr-pcs="${i}"></label>
      <button type="button" class="tn-all${full ? ' on' : ''}" data-tr-all="${i}"${have > 0.0005 ? '' : ' disabled'}>⤓ Sara<small>${cpTxt(have, pk, l)}</small></button></div>${pk > 1 ? `<small class="tn-eq">= ${num(l.qty)} ${esc(l.uName || 'Pcs')}</small>` : ''}`}</div>`; }).join('') || `<div class="tn-empty">⇄<b>Upar se item likhein ya 📷 scan karein</b><small>${gN} ka sirf majood maal dikhega</small></div>`}</div>
    <label class="tn-note">📝 Note<input type="text" data-tr-note maxlength="150" placeholder="ikhtiyari" value="${esc(trNote)}"></label>
    ${trLines.length ? trCopyChips() : ''}
    <div class="tn-bar"><div class="tn-sum"><b>${trLines.length} item</b><small>${[totC ? num(totC) + ' Ctn' : '', totP ? num(totP) + ' Pcs' : '', totK ? num(totK) + ' packet' : ''].filter(Boolean).join(' + ') || '0'}</small></div>${trLines.length ? '<button type="button" class="tn-clear" data-tr-clear="1">Saaf</button>' : ''}<button type="button" class="tn-save primary" data-tr-save="1"${trLines.length ? '' : ' disabled'}>✓ Transfer note banao</button></div>
    <p class="muted tr-msg" style="font-size:.85em"></p>
    <details class="tr-hist tn-hist"><summary>🕘 Pichhle 14 din (app se) — ${trList.length}</summary><div data-tr-hist>${trHistHTML()}</div></details></div>`;
  if (!d.open) d.showModal();
  if (!trStop && cloud?.listenTransfers) trStop = cloud.listenTransfers(trGot);
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
      const sub = items.find(x => Array.isArray(x.bq) && x.bq.some(b => String(b?.b || '').trim() === t));   // v2.103.33: sub-barcode = wohi packet
      if (sub && trHas(sub)) { hits.hidden = true; q.value = ''; trRecNote(sub.id); const z = Number(sub.bq.find(b => String(b?.b || '').trim() === t).q) || 1; let l = trLines.find(x => String(x.id) === String(sub.id)); if (!l) l = trAddLine(sub); if (!l.pk?.length) l.pk = []; trPkAdd(l, z, 1); openTransfer(); return; }
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
// v2.103.33: 📦 SUB-BARCODE PACKET — line.pk [{z, n, nm}] (500 gm × 20); POS mein wazan (Σ z·n), parchi par packet. Khaali = wapas Ctn / Pcs.
function trPkAdd(l, z, d = 1, set = null) { if (!l) return l; const it = collect().items.find(x => String(x.id) === String(l.id)) || {}; l.pk = Array.isArray(l.pk) ? l.pk : [];
  let p = l.pk.find(y => Math.abs(y.z - z) < 1e-9); if (!p) { p = { z, n: 0, nm: pkName(z, it) }; l.pk.push(p); l.pk.sort((a, b) => b.z - a.z); }
  p.n = Math.max(0, set != null ? Math.floor(Number(set) || 0) : (Number(p.n) || 0) + d); if (!p.n) l.pk = l.pk.filter(y => y !== p);
  if (!l.pk.length) { delete l.pk; const pk = Number(l.pack) || 0; l.ctn = pk > 1 ? 1 : 0; l.pcs = pk > 1 ? 0 : 1; } return trCalc(l); }
const trSizes = l => { const it = collect().items.find(x => String(x.id) === String(l.id)); return it ? gmSizes(it).map(x => ({ ...x, nm: pkName(x.z, it) })) : []; };
function trCalc(l) { if (Array.isArray(l.pk) && l.pk.length) { l.ctn = 0; l.pcs = Math.round(l.pk.reduce((t, p) => t + p.z * (Number(p.n) || 0), 0) * 1000) / 1000; l.qty = l.pcs; return l; } const pk = Number(l.pack) || 0; l.qty = Math.round(((pk > 1 ? (Number(l.ctn) || 0) * pk : 0) + (Number(l.pcs) || 0)) * 1000) / 1000; return l; }
// v2.17: naya item = 1 CTN (carton ho to), warna 1 PCS; wahi dobara aaye to +1 CTN. Naya neeche jurta hai.
function trAddLine(r) { if (!r) return null; const pk = Number(r.pack) || 0; let l = trLines.find(x => String(x.id) === String(r.id));
  if (l?.pk?.length) { l.pk[0].n = (Number(l.pk[0].n) || 0) + 1; trCalc(l); }
  else if (l) { if (pk > 1) l.ctn = (Number(l.ctn) || 0) + 1; else l.pcs = Math.round(((Number(l.pcs) || 0) + 1) * 1000) / 1000; trCalc(l); }
  else { l = trCalc({ id: r.id, name: r.name, pack: pk, cName: r.cName || 'Ctn', uName: r.uName || 'Pcs', ctn: pk > 1 ? 1 : 0, pcs: pk > 1 ? 0 : 1, qty: 0 }); trLines.push(l); }
  return l; }
function trAdd(r) { if (trAddLine(r)) openTransfer(); }
function trQtyText(l) { const pk = Number(l.pack) || 0; return pk > 1 ? `${num(l.ctn || 0)} ${l.cName || 'Ctn'}${Number(l.pcs) ? ' + ' + num(l.pcs) + ' ' + (l.uName || 'Pcs') : ''}` : `${num(l.pcs || 0)} ${l.uName || 'Pcs'}`; }
function trHistHTML() {
  if (!trList.length) return '<p class="muted">Koi nahi.</p>';
  const names = collect().names;
  return trList.slice(0, 20).map(j => `<div class="tr-hist-row"><div><b>${j.status === 'done' ? (j.op === 'delete' ? 'Hataya' : 'STN ' + esc(j.transferNo || '')) : j.status === 'failed' ? '⚠️ Nahi bana' : '⏳ PC...'}</b> · ${esc(branchName(j.from, names))} → ${esc(branchName(j.to, names))} · ${(j.lines || []).length} items<br><small>${esc(new Date(j.at).toLocaleString('en-PK'))}${j.error ? ' · <span class="red">' + esc(j.error) + '</span>' : ''}${(j.lines || []).slice(0, 4).map(l => ' · ' + esc(l.name) + ' ' + (Array.isArray(l.pk) && l.pk.length ? l.pk.map(p => esc(p.nm || '') + '×' + num(p.n)).join(', ') : Number(l.pack) > 1 && (l.ctn || l.pcs != null) ? num(l.ctn || 0) + ' ' + esc(l.cName || 'Ctn') + (l.pcs ? ' + ' + num(l.pcs) + ' ' + esc(l.uName || 'Pcs') : '') : num(l.qty))).join('')}${j.reprints?.length ? ` · <b>dobara print ${j.reprints.length}x</b>` : ''}</small></div>
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
    const jid = await cloud.requestTransfer({ op: ed ? 'edit' : 'create', ...(ed ? { transferId: ed.id, force: true, reason: 'Edit' } : {}), copies: trCopies, from: trFrom, to: trTo, lines: trLines.map(l => ({ itemId: l.id, name: l.name, qty: l.qty, ctn: Number(l.ctn) || 0, pcs: Number(l.pcs) || 0, pack: Number(l.pack) || 0, cName: l.cName || 'Ctn', uName: l.uName || 'Pcs', ...(l.pk?.length ? { pk: l.pk } : {}) })), note, byName: '' });
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
  if (t.matches?.('[data-sk-late]')) { const on = !!t.checked; if (!cloud?.setLateRule) { t.checked = !on; notice('App update karein'); return; } cloud.setLateRule(on).then(() => notice(on ? '🧾 Ginti ke baad sale par bill ROKA jayega' : '✓ Ginti ke baad sale ho to bhi bill banega (ginti ke waqt ke hisaab se)')).catch(e => { t.checked = !on; notice(e?.message || 'Nahi hua'); }); return; }   // v2.103.31
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
  else if (t.matches?.('[data-tr-pkn]')) { const [i, z] = t.dataset.trPkn.split('|'), l = trLines[Number(i)]; if (l) trPkAdd(l, Number(z), 0, t.value); openTransfer(); }   // v2.103.33
  else if (t.matches?.('[data-tr-pcs]')) { const l = trLines[Number(t.dataset.trPcs)]; if (l) { l.pcs = Math.max(0, Math.round((Number(String(t.value).replace(',', '.')) || 0) * 1000) / 1000); trCalc(l); } openTransfer(); }
});

document.addEventListener('click', e => { const t = e.target.closest?.('[data-tr-pk],[data-tr-pkm],[data-tr-pkp]'); if (!t || !t.closest('.tn-root')) return;   // v2.103.33: 📦 packet
  const d = t.dataset, [i, zs] = (d.trPk || d.trPkm || d.trPkp).split('|'), l = trLines[Number(i)], z = Number(zs); if (!l) return;
  if (d.trPk) { const has = l.pk?.find(y => Math.abs(y.z - z) < 1e-9); if (has) trPkAdd(l, z, 0, 0); else { if (!l.pk?.length) l.pk = []; trPkAdd(l, z, 1); } } else trPkAdd(l, z, d.trPkm ? -1 : 1);
  openTransfer(); });
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
// v2.118.0: 📦 PACKET SE GINO — malik: "stock screen mein jis item ke packet bhi hon (jaise anardana) — ginti ka hisaab kaise?" → Ctn / Pcs ke saath har packet
//   ki tadad (250 gm [16] · 125 gm [48]); app khud kg mein jore (16 × 0.25 + 48 × 0.125 = 10) + khula (Pcs / Kul khana) = ginti. History line mein h.pk
//   ("250 gm ×16 · 125 gm ×48"), doc mein pkn {size: tadad} (⏳ Baqi = jama). Dukan (branch 1) + Packet % item + aakhri Save = Rack bharo ka "👀 abhi"
//   (rackPk c, at = abhi) bhi isi ginti se — dobara ginna nahi. Andhi ginti mein stock phir bhi nahi. CAP stock.ginpk (shuru se ON).
const cntPkOk = () => isOwner() || can('stock.ginpk');
function cntPkSizes(r) {
  const cf = pkCfg(r.id), out = [];
  for (const x of (cf ? pkSizesOf(r, cf) : gmSizes(r))) {
    const z = Number(x.z); if (!(z > 0)) continue;
    const ck = cf ? Object.keys(cf.p || {}).find(y => Math.abs(Number(y) - z) < 1e-9) : null, o = ck != null ? cf.p[ck] : null;
    if (Math.abs(z - 1) < 1e-9 ? !(o && Number(o.b) > 0) : (!cf && z > 1)) continue;   // 1 = asal barcode (khula = Pcs khana) — sirf jab Packet % mein us ka 🧺 100% laga · bina Packet % sirf chhote packet (0.25 kg)
    out.push({ z, k: gmKey(z) });
  }
  return out.sort((a, b) => b.z - a.z);
}
function cntPkHTML(r) {
  if (!cntPkOk()) return ''; const S = cntPkSizes(r); if (!S.length) return ''; const id = esc(r.id);
  return `<div class="cnt-pk"><span class="cnt-pkh">📦 Packet gino</span>${S.map(x => `<label>${esc(pkName(x.z, r))}<input type="number" step="1" min="0" inputmode="numeric" style="width:4.4em" data-count-pk="${id}|${esc(x.k)}" value="" placeholder="0"></label>`).join('')}<small class="cnt-pkn">khula maal = ${esc(r.uName || 'Pcs')} khana · app khud jor kar kul banayega</small></div>`;
}
function cntPkRead(item) {
  const o = { any: false, bad: false, sum: 0, n: {}, parts: [], txt: '' };
  const L = $('list')?.querySelectorAll?.(`[data-count-pk^="${CSS.escape(String(item.id))}|"]`) || [];
  for (const el of L) { const k = String(el.dataset.countPk || '').split('|')[1] || '', z = Number(k), raw = String(el.value ?? '').trim(); if (raw === '' || !(z > 0)) continue;
    const n = Number(raw); if (!Number.isFinite(n) || n < 0) { o.bad = true; continue; } o.any = true; o.n[k] = r3(n); if (!n) continue;
    o.sum = r3(o.sum + n * z); o.parts.push(`${pkName(z, item)} ×${num(n)}`); }
  o.txt = o.parts.join(' · '); return o;
}
const cntPkMerge = (a, b) => { const o = { ...(a && typeof a === 'object' ? a : {}) }; for (const [k, v] of Object.entries(b || {})) o[k] = r3((Number(o[k]) || 0) + (Number(v) || 0)); return o; };
function cntPkClear(item) { const L = $('list'); if (!L) return; const id = CSS.escape(String(item.id)); L.querySelectorAll(`[data-count-pk^="${id}|"],[data-count-ctn="${id}"],[data-count-pcs="${id}"],[data-count-tot="${id}"]`).forEach(el => { el.value = ''; }); }
async function cntPkRack(item, pkn) {   // dukan ki aakhri ginti → Rack bharo Packet % ka 👀 abhi (c) + at (bikri yahan se)
  const id = String(item.id), cf = pkCfg(id); if (!cf || !cloud?.setRackPk || !pkn) return '';
  const p = { ...(cf.p || {}) }; let n = 0;
  for (const [k, o] of Object.entries(p)) { if (!(Number(o?.b) > 0)) continue; const hit = Object.keys(pkn).find(y => Math.abs(Number(y) - Number(k)) < 1e-9); p[k] = { ...o, c: r3(Math.max(0, Number(hit != null ? pkn[hit] : 0) || 0)) }; n++; }
  if (!n) return '';
  const { _new, ...cf0 } = cf, v = { ...cf0, p, at: Date.now() };
  itemCfg = { ...(itemCfg || {}), rackPk: { ...(itemCfg?.rackPk || {}), [id]: JSON.stringify(v) } }; rk?.plDr?.delete?.(id);
  await cloud.setRackPk(id, v); return ' · 🧺 Rack bharo ka "abhi" bhi';
}
function countHTML(r) {
  const c = countOf(pickedBranch, r);
  const diff = c ? Math.round((countedPcs(c) - Number(sysOf(c, r))) * 100) / 100 : 0;
  if (countLocked()) return `<div style="margin:0 4px 14px">${c ? `<small>Ginti ${num(countedPcs(c))}${seeStock() ? ' · Farq ' + (diff > 0 ? '+' : '') + num(diff) : ''}</small><br>` : ''}${flagHTML(r)}</div>${historyHTML(r, c)}`;
  if (!round) return `<div style="margin:0 4px 12px"><small class="stat-note">Ginti abhi band hai — ${isOwner() ? 'upar patte mein "📋 Nayi ginti shuru" dabayein' : 'malik "Nayi ginti shuru" kare'}, phir yahan Save aur ✓ Tick aayenge.</small></div>${historyHTML(r, c)}`;
  return `<div class="pos-dates" style="margin:0 4px 8px">
    <label>Ctn<input type="number" step="any" inputmode="decimal" style="width:4.6em" data-count-ctn="${esc(r.id)}" value="${c && !c.pkn ? esc(String(c.ctn ?? '')) : ''}"></label>
    <label>${esc(r.uName || 'Pcs')}<input type="number" step="any" inputmode="decimal" style="width:4.6em" data-count-pcs="${esc(r.id)}" value="${c && !c.pkn ? esc(String(c.pcs ?? '')) : ''}"></label>
    <label>Kul ${esc(r.uName || 'Pcs')}<input type="number" step="any" inputmode="decimal" style="width:5.6em" data-count-tot="${esc(r.id)}" value=""></label>
    ${cntPkHTML(r)}
    <button type="button" data-count-save="${esc(r.id)}">Save</button>
    ${seeStock() ? `<button type="button" class="count-tick" data-count-tick="${esc(r.id)}" title="Jitna system mein hai utna hi maal hai">✓ Tick</button>` : ''}
    <div class="count-live" data-count-live="${esc(r.id)}"></div>
    ${c && !seeStock() ? `<small style="align-self:center">✓ Gina ${num(countedPcs(c))} ${esc(r.uName || 'Pcs')} · ${esc(stampText(c.at))}${c.byName ? ' · ' + esc(c.byName) : ''}${(c.history || []).length > 1 ? ' · ✏️ ' + c.history.length + ' dafa' : ''}</small>` : ''}
    ${c ? pcSpan(c, countId(pickedBranch, r.id)) : ''}
    ${c && seeStock() ? `<small style="align-self:center">Ginti ${num(countedPcs(c))} · Us waqt system ${num(sysOf(c, r))}${sysSure(c) ? ' ✓' : autoOn || (pcOn() && pcState(c, countId(pickedBranch, r.id))) ? '' : ' (PC tasdeeq baqi)'} · Farq ${diff > 0 ? '+' : ''}${num(diff)}${
      r.prate ? ' · Rs ' + (diff > 0 ? '+' : '') + num(diff * r.prate) : ''}${(() => { const bi = billOf(r, c); return bi.k === 'done' ? ` · <b class="sk-ok">✓ ${esc(bi.no)}</b>` : bi.k === 'part' ? ` · <b class="sk-w">${esc(bi.no)} (${num(bi.q)}) · baqi</b>` : bi.k === 'baqi' ? ' · <b class="sk-w">bill baqi</b>' : ''; })()}</small>` : ''}
  </div>
  ${oxHTML(r, c, diff)}
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

// v2.113.0 (malik: "jis larke ki id se save ho us ka naam history mein bhi aaye"): har line ka naam h.n (naya) — purani lines mein naam
//   save hi nahi hota tha, sirf aakhri (h.at === c.at) ka naam c.byName se.
const hWho = (h, c) => String(h?.n || (c && Number(h?.at) && Number(h.at) === Number(c.at) ? c.byName || '' : '') || '').trim();
const hWhoHTML = (h, c) => { const w = hWho(h, c); return w ? ` <span class="hs-who">👤 ${esc(w)}</span>` : ''; };
function historyHTML(r, c) {
  const R = hRange();   // v2.99.87: sirf chune din ki history
  const list = Array.isArray(c?.history) ? c.history.filter(h => hIn(h, R)).reverse() : [];
  if (!list.length) return '';
  return `<div class="stat-note" style="margin:0 4px 12px">${list.map(h => {
    const d = Math.round((Number(h.total) - Number(h.sys)) * 100) / 100;
    const ctn = esc(r.cName || 'Ctn'), pcs = esc(r.uName || 'Pcs');
    const jama = h.tick ? '<b style="color:#0b6b2e">✓ Tick — system jaisa</b> · ' : h.add ? `<b style="color:#0b6b2e">+${num(h.add.ctn)} ${ctn} + ${num(h.add.pcs)} ${pcs}${h.note ? ' (' + esc(h.note) + ')' : ''}</b> → ` : (h.note ? `(${esc(h.note)}) ` : '');
    const who = hWhoHTML(h, c);   // v2.113.0: 👤 naam
    const pkH = h.pk ? ` <span class="hs-pk">📦 ${esc(h.pk)}</span>` : '';   // v2.118.0
    if (!seeStock()) return `${esc(stampText(h.at))} — ${h.tick ? '<b style="color:#0b6b2e">✓ Tick</b> · ' : ''}<b>${num(h.ctn)} ${ctn} + ${num(h.pcs)} ${pcs}</b> · ${num(h.total)} ${pcs}${pkH}${who}`;   // v2.109.0: stock nazar nahi = system / farq bhi nahi (andhi ginti)
    return `${esc(stampText(h.at))} — ${jama}<b>${num(h.ctn)} ${ctn} + ${num(h.pcs)} ${pcs}</b> · ${num(h.total)} ${pcs} · System ${num(h.sys)} · Farq ${d > 0 ? '+' : ''}${num(d)}${
      r.prate ? ' · Rs ' + (d > 0 ? '+' : '') + num(d * r.prate) : ''}${pkH}${who}`;
  }).join('<br>')}</div>`;
}

const rowCache = new Map();   // v1.66: label ke liye item
function rowHTML(r) {
  rowCache.set(String(r.id), r);
  const pack = Number(r.pack) || 0;
  const big = pack > 0
    ? `${num(r.ctn)} ${esc(r.cName || 'Ctn')} + ${num(r.pcs)} ${esc(r.uName || 'Pcs')}`
    : `${num(r.stock)} ${esc(r.uName || 'Pcs')}`;

  let th = ''; try { th = window.ntFacThumb?.(r.id) || ''; } catch {}   // v2.108.0: 📷 factory item ki chhoti tasveer (tap = poori)
  return `<div class="stock-row${String(r.id) === String(scanHit) ? ' stock-hit' : ''}" data-stock-row="${esc(r.id)}">
    <div class="party" style="border-bottom:0">
    <div class="name">
      ${th ? `<img class="sk-th" src="${esc(th)}" alt="" loading="lazy" data-fac-ph="${esc(r.id)}">` : ''}<b>${esc(r.name)}</b>
      ${urduOf(r.id) || canEditItem() ? `<span class="ur-name" data-ur-edit="${esc(r.id)}" dir="rtl" title="Urdu naam — tap kar ke badlein">${urduOf(r.id) ? esc(urduOf(r.id)) : '<i>+ Urdu naam</i>'}</span>` : ''}
      <small>${esc(r.code || '')}${pack > 0 ? ` · 1 ${esc(r.cName || 'Ctn')} = ${num(pack)}` : ''}${r.rate ? ' · R ' + num(r.rate) : ''}${r.wrate ? ' · W ' + num(r.wrate) : ''}${seeStock() && r.prate ? ' · Khareed ' + num(r.prate) : ''}</small>
    </div>
    <div class="amount">
      ${seeStock() ? `<strong>${big}</strong>
      <small>${num(r.stock)} ${esc(r.uName || 'Pcs')}</small>` : ''}
      ${r._jama ? `<small class="jama-sum">NT ${r._fac ? `<s>${num(r._nt)}</s> 0` : num(r._nt)} + G2 ${num(r._g2)} = ${num(r.stock)}${r._fac ? ' 🏭' : ''}</small>` : ''}
      <button type="button" class="stock-label-btn" data-stock-label="${esc(r.id)}">🏷️ Label</button>
      ${qtrCan() && brInfo().branches.length > 1 ? `<button type="button" class="stock-tr-btn" data-qtr="${esc(r.id)}">⇄ Transfer</button>` : ''}
      ${canEditItem() ? `<button type="button" class="stock-item-btn" data-stock-item="${esc(r.id)}">✏️ Item</button>` : ''}
      ${isOwner() && typeof window.ntFacIs === 'function' ? `<label class="fac-tick"><input type="checkbox" data-fac-tick="${esc(r.id)}"${window.ntFacIs(r) ? ' checked' : ''}> 🏭 Factory</label>` : ''}
      ${canBand() ? `<label style="display:block;font-size:.85em;white-space:nowrap"><input type="checkbox" style="width:auto" data-stock-hide="${esc(r.id)}"${isHidden(r) ? ' checked' : ''}> Band</label>${isHidden(r) ? bandChip(r.id) : ''}` : ''}
      ${roz && rozSkipOk() && rozMine(roz.k).includes(String(r.id)) ? `<button type="button" class="stock-skip-btn${rozSkipOpen === String(r.id) ? ' is-in' : ''}" data-roz-skip="${esc(r.id)}">⏭ Skip</button>` : ''}
    </div>
    </div>
    ${roz && rozSkipOpen === String(r.id) ? rozSkipBoxHTML(r) : ''}
    ${hgHTML(r)}
    ${countHTML(r)}
  </div>`;
}

// branch aur sort ke buttons
document.addEventListener('click', e => {
  const b = e.target.closest?.('[data-stock-branch]');
  if (b) { if (roz) rozGen++; branch = Number(b.dataset.stockBranch); godamAll = false; if (branch !== 1) filter = 'has'; limit = PAGE; rerender(); return; }   // v2.82: 0 = jama (filter has)   // v1.95/97: godam kholte hi sirf USI godam ka stock · v2.117.0: roz mein godam badla = khud band (wapas nahi)
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
  { const bb = e.target.closest?.('[data-stock-band]'); if (bb) { bandDlg(bb.dataset.bdQv || ''); return; } }   // v2.105.9: ⛔ band list (card / ☰ / search patti)
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
    const on = hb.checked; bandPwCheck((on ? 'Item BAND karne' : 'Item dobara CHALU karne') + ' ka password:').then(pw => { if (pw == null) { hb.checked = !on; return; } toggleHidden(hb.dataset.stockHide, on, hb, pw); }); return; }
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
  if (e.target.closest?.('[data-stock-ratepdf]')) { rpOpen(); return; }   // v2.103.41
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
  if (e.target.closest?.('[data-fac-clear]')) { facOnly = false; rerender(); return; }   // v2.107.0
  if (e.target.closest?.('[data-roz-more]')) { rozTake(true); return; }   // v2.109.0: 📋 ➕ aur N
  if (e.target.closest?.('[data-roz-x]')) { rozGen++; rozExit(); rerender(); return; }
  { const rz = e.target.closest?.('[data-roz-tab],[data-roz-skip],[data-roz-why],[data-roz-skipno],[data-roz-skipgo],[data-roz-unskip],[data-roz-add]');   // v2.117.0: ⏭ skip · ➕ mazeed
    if (rz && roz) { const d = rz.dataset;
      if (d.rozTab) { rozTab = d.rozTab === 'skip' ? 'skip' : 'list'; rozSkipOpen = ''; rerender(); return; }
      if (d.rozSkip) { rozSkipOpen = rozSkipOpen === d.rozSkip ? '' : d.rozSkip; rozSkipWhy = ''; rerender(); return; }
      if (d.rozWhy) { rozSkipWhy = rozSkipWhy === d.rozWhy ? '' : d.rozWhy; rerender(); return; }
      if (d.rozSkipno) { rozSkipOpen = ''; rozSkipWhy = ''; rerender(); return; }
      if (d.rozSkipgo) { rozSkipGo(d.rozSkipgo); return; }
      if (d.rozUnskip) { rozUnskipGo(d.rozUnskip); return; }
      if (d.rozAdd) { rozAddOne(d.rozAdd); return; } } }
  if (e.target.closest?.('[data-roz-open]')) { const v = e.target.closest('[data-roz-open]').dataset.rozOpen || ''; stockRozOpen(v === '1' ? '' : v); return; }
  if (e.target.closest?.('[data-sk-farq]')) { farqOpenNow(); return; }   // v2.113.0: ⚖️ Stock farq
  if (e.target.closest?.('[data-sk-hg]')) { hgOn = !hgOn; try { localStorage.setItem('sam-hg', hgOn ? '1' : '0'); } catch {} rerender(); return; }   // v2.114.0: 🏬 har godam patti
  { const q = e.target.closest?.('[data-qtr]'); if (q) { qtrGo({ id: q.dataset.qtr, from: pickedBranch }); return; } }   // v2.114.0: ⇄ jaldi transfer
  { const q = e.target.closest?.('[data-qtr-ox]'); if (q) { const [id, f, t, n] = q.dataset.qtrOx.split('|'); qtrGo({ id, from: Number(f), to: Number(t), qty: Number(n), recount: true, why: '🔁 Jagah badli — maal ' + branchName(Number(f), brInfo().names) + ' se ' + branchName(Number(t), brInfo().names) + ' gaya, note nahi bana tha. Note banne ke baad dono jagah ki ginti khud taza (farq 0).' }); return; } }
  { const ox = e.target.closest?.('[data-ox-save]'); if (ox) { const [b, id] = ox.dataset.oxSave.split('|'), box = ox.closest('.ox-r'), cI = box?.querySelector('[data-ox-ctn]'), pI = box?.querySelector('[data-ox-pcs]');
    if (!cI?.value && !pI?.value) { notice('Ginti likhein (Ctn / Pcs)'); return; }
    ox.disabled = true; oxSave(Number(b), id, Number(cI?.value || 0) || 0, Number(pI?.value || 0) || 0).then(r => { if (r) notice('✓ ' + branchName(Number(b), brInfo().names) + ': ginti save (' + num(r.total) + ')'); }).catch(er => notice('⚠️ Ginti save nahi hui: ' + errTxt(er))).finally(() => { ox.disabled = false; }); return; } }
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
    const skipped = (lateS.length ? `<div class="fq-warn">🧾 <b>${num(lateS.length)} items dobara ginne baqi — bill mein shamil nahi:</b> ${esc(lateS.map(x => x.name).join(', '))}${isOwner() && lateS.some(x => x.id) ? `<button type="button" class="fq-force fq-forceall" data-fq-forceall="${esc(lateS.map(x => x.id).filter(Boolean).join(','))}">⚡ Sab ko phir bhi bill mein shamil karo (${num(lateS.length)})</button><small>Phir "Cancel" kar ke bill dobara bhejein</small>` : ''}</div>` : '')
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
  // v2.103.30: PC ne jo items CHHORE (wajah ke saath) — late = "ginti ke baad bill" -> malik ek tap mein sab shamil (forceBill)
  const SK = Array.isArray(p.skipped) ? p.skipped : [], lateS = SK.filter(x => x.late), othS = SK.filter(x => !x.late);
  const skH = p.status === 'nothing' && SK.length ? `<div class="fq-warn">⚠️ <b>${num(SK.length)} items PC ne chhore</b>${lateS.length ? `<br>🧾 Ginti ke baad bill bana (${num(lateS.length)}): ${esc(lateS.map(x => x.name).join(', '))}` : ''}${othS.length ? `<br>${othS.map(x => `${esc(x.name)} — ${esc(x.why || '')}`).join('<br>')}` : ''}
    ${lateS.length && isOwner() ? `<button type="button" class="fq-force fq-forceall" data-fq-forceall="${esc(lateS.map(x => x.id).filter(Boolean).join(','))}">⚡ Sab ko phir bhi bill mein shamil karo (${num(lateS.length)})</button><small>Phir upar "Bill banao" dobara dabayein</small>` : ''}</div>` : '';
  return msg ? `<div class="account-tools"><small><b>${esc(msg)}</b>${t ? ' · ' + esc(t) : ''}</small>${skH}</div>` : '';
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

// v2.103.84: 🔒 BAND har mulazim (CAP stock.band) — password server par (rules 2.66: blueAccess/bandKey); malik Settings se badle. Malik ka check phone par (bandKey parh sakta hai).
let bandPwCache = null;
const canBand = () => isOwner() || can('stock.band');
async function bandPwWant() { if (bandPwCache) return bandPwCache; let k = null; try { k = await cloud?.getBandKey?.(); } catch {} if (!k) { k = String(itemCfg?.bandPw || '7183'); try { await cloud?.setBandKey?.(k); } catch {} } bandPwCache = k; return k; }
export function bandPwReset() { bandPwCache = null; }
async function bandPwCheck(msg) { const got = prompt(msg); if (got === null) return null; if (isOwner()) { const want = await bandPwWant(); if (got !== want) { notice('❌ Password ghalat'); return null; } } return got; }
// v2.105.9: sirf TABDEELI bhejo {id: true/false} — poori list nahi (merge:true mein hataya hua item reh jata tha = ↩️ Chalu nahi hota tha)
const bandApply = (h, ch) => { const n = { ...h }; for (const [k, on] of Object.entries(ch || {})) { if (on) n[k] = true; else delete n[k]; } return n; };
async function bandSend(ch, pw) { if (cloud.setBand) await cloud.setBand(ch, pw); else await cloud.setStockHidden(bandApply(hidden, ch), null, pw); }
async function bandWrite(ch, pw) { try { await bandSend(ch, isOwner() ? null : pw); return true; } catch (e) { notice(/permission|insufficient/i.test(String(e?.code || e?.message || e)) ? '❌ Password ghalat (ya malik ne rules 2.66 upload nahi kiye)' : '⚠️ ' + (e?.message || e)); return false; } }
async function toggleHidden(id, on, box, pw) {
  if (!cloud?.setStockHidden || !canBand()) { box.checked = !on; return; }
  const item = collect().items.find(r => String(r.id) === String(id));
  const nm = item ? item.name : bandNameOf(id);   // v2.105.9: POS se ghaib (deactive) item ka naam bhi
  const stk = item ? `\nAbhi stock: ${num(item.stock)} ${item.uName || 'Pcs'}` : '';
  const msg = on
    ? `"${nm}" BAND karein?${stk}\n\nServer PC on hote hi KHUD: POS mein stock 0 (stock fraq ka bill) + item INACTIVE.\nStock screen par "⛔ Band items" mein nazar aayega.`
    : `"${nm}" ko wapas chalu karein?\n\nPOS mein item dobara ACTIVE ho jayega (stock 0 hi rahega).`;
  if (on && item) bdNmPut(id, item.name, item.code);
  if (!confirm(msg)) { box.checked = !on; return; }
  const next = { ...hidden };
  if (on) next[String(id)] = true; else delete next[String(id)];
  box.disabled = true;
  try {
    if (!(await bandWrite({ [String(id)]: !!on }, pw))) throw Object.assign(Error(''), { quiet: true });
    hidden = next;
    notice(on ? `⛔ "${nm}" band — Stock par "⛔ Band items" mein · PC on hote hi khud bill + deactive` : `↩️ "${nm}" wapas chalu — PC POS mein bhi active karega`);
    rerender(); if ($('bdList')) bdPaint();
  } catch (e) { box.checked = !on; if (!e?.quiet) notice(e?.message || 'Nahi hua'); }
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
  const pk = cntPkRead(item);   // v2.118.0: 📦 packet patti (250 gm ×16 …) — kg mein jud kar
  if (skipBlank && rawTot === '' && rawCtn === '' && rawPcs === '' && !pk.any) return null;
  if (pk.any) {   // packet ke saath: 3 hindse tak (0.125 kg) · khula = Pcs / Kul khana
    let ctn, pcs, total;
    if (rawTot !== '') { total = r3(Number(rawTot) + pk.sum); ctn = per > 1 ? Math.floor(total / per) : 0; pcs = r3(total - ctn * (per > 1 ? per : 0)); }
    else { ctn = Number(rawCtn || 0); pcs = r3(Number(rawPcs || 0) + pk.sum); total = r3(ctn * (per > 0 ? per : 1) + pcs); }
    return { ctn, pcs, total, bad: pk.bad || !Number.isFinite(total) || !Number.isFinite(ctn) || !Number.isFinite(pcs), pkn: pk.n, pkTxt: pk.txt };
  }
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
  // v2.113.0: pichhli aakhri line ka naam (purane save mein line par naam nahi tha, sirf byName) — naye save se pehle line mein pakka kar do
  const past = Array.isArray(old?.history) ? old.history.map((x, i, a) => i === a.length - 1 && x && !x.n && old.byName && Number(x.at) === Number(old.at) ? { ...x, n: String(old.byName).slice(0, 40) } : x) : [];
  const h = { at, ctn: v.ctn, pcs: v.pcs, total: v.total, sys: item.stock };
  if (v.note && !add) h.note = String(v.note).slice(0, 60);   // v2.114.0: "⇄ TN 123 ke baad" (jagah badli ka transfer — wahi tadad dobara)
  const nm = whoName(); if (nm) h.n = nm;   // v2.113.0: 👤 jis larke ke login se save hua (history ki har line par naam)
  if (add) { h.add = { ctn: add.ctn, pcs: add.pcs, total: add.total }; if (add.note) h.note = add.note; }
  if (tick) h.tick = true;
  { const pkT = (add && add.pkTxt) || v.pkTxt; if (pkT) h.pk = String(pkT).slice(0, 120); }   // v2.118.0: 📦 packet se gina
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
    ...(autoOn ? { auto: true, day: round, sys0, del: false } : {}), byName: whoName(),
    ...(v.pkn && typeof v.pkn === 'object' && Object.keys(v.pkn).length ? { pkn: v.pkn } : {})   // v2.118.0: 📦 packet tadad {size: n}
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
  const pkNow = v.pkn || null, pkTxt = v.pkTxt || '';   // v2.118.0: 📦 is dafa packet se gina
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
  // v2.118.0: 📦 packet tadad doc mein (pkn) — ⏳ Baqi (jama) = pichhle hisse ke packet + ye hissa
  const oldPk = jama && old?.pkn && typeof old.pkn === 'object' ? old.pkn : null, pkn = pkNow ? (oldPk ? cntPkMerge(oldPk, pkNow) : { ...pkNow }) : (oldPk ? { ...oldPk } : null);
  if (pkn) v = { ...v, pkn }; if (pkTxt) v = { ...v, pkTxt };
  if (!staleOk()) return;
  if (v.total === 0 && !confirm(`"${item.name}" ki ginti ZERO save karein?\n\n${zeroText(item)}`)) return;
  button.disabled = true;
  try {
    if (!(mode === 'save' && jama && v.total === countedPcs(old) && !add)) { await writeCount(item, v, add); if (mode !== 'baqi') rozAskOthers(item, pickedBranch, v.total); }   // v2.113.0
    if (mode === 'baqi') { if (!baqi) await setFlag(item.id, { baqi: true }); const id = CSS.escape(String(item.id)); ['ctn', 'pcs', 'tot'].forEach(k => { const b = $('list').querySelector(`[data-count-${k}="${id}"]`); if (b) b.value = ''; }); }
    else if (baqi) await setFlag(item.id, { baqi: false });
    let rkNote = ''; if (pkNow) cntPkClear(item);   // v2.118.0: packet ginti ke baad khane khali (dobara Save par khula + packet dohra na jure)
    if (mode === 'save' && pickedBranch === 1 && pkn && (pkNow || jama)) { try { rkNote = await cntPkRack(item, pkn); } catch { rkNote = ' · ⚠️ Rack bharo ka "abhi" nahi bana'; } }
    itemMsg(item.id, '✓ ' + item.name + (mode === 'baqi' ? ` — ab tak ${num(v.total)} ${item.uName || 'Pcs'} (baqi ginna hai)` : add ? ` — jama: kul ${num(v.total)} ${item.uName || 'Pcs'}` : ` — ginti save (${num(v.total)} ${item.uName || 'Pcs'})`) + (pkTxt ? ' · 📦 ' + pkTxt : '') + rkNote, true);
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
    try { await writeCount(item, v); ok++; if (v.pkn) { cntPkClear(item); if (pickedBranch === 1) { try { await cntPkRack(item, v.pkn); } catch {} } } }   // v2.118.0: 📦
    catch (e) { fail.push(item.name); }
  }
  button.disabled = false;
  notice(fail.length ? `${ok} save hue · NAHI hue: ${fail.join(', ')}` : `${ok} items ki ginti mehfooz ✓`);
}

// Enter dabane par agla ginti ka khana
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || !e.target.matches?.('[data-count-ctn],[data-count-pcs],[data-count-tot],[data-count-pk]')) return;
  const all = [...($('list')?.querySelectorAll('[data-count-ctn],[data-count-pcs],[data-count-tot],[data-count-pk]') || [])];
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
  if (e.target?.closest?.('#qtrDlg')) return;   // v2.114.0: ⇄ transfer khirki (password / tadad) — tez likhai scanner nahi
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
// v2.114.3: 🔍 DHOONDO MEIN ITEM (malik: "yahan item bhi search ho sake — us item ka stock checkbox se stock screen aa jaye"). shell.js Dhoondo
//   naam / Urdu naam / barcode se items (band nahi) + har jagah ka stock (sirf jahan ≠ 0; andhi ginti = hindsa nahi). Tap = Stock screen, wahi item
//   (search mein naam, row roshan) + 🏬 ☐ Har godam laga hua. AI NAHI. CAP app.dhitem (shell.js).
window.ntItemFind = async (q, n = 8) => {
  if (!loaded) { start(false); for (const t0 = Date.now(); !loaded && Date.now() - t0 < 6000;) await new Promise(r => setTimeout(r, 150)); }
  if (!loaded) return null;
  const P = agPool(), s = String(q || '').trim(); if (s.length < 2) return [];
  const c = s.replace(/\s/g, ''); let L = /^\d{5,}$/.test(c) ? P.list.filter(r => agCodes(r).some(x => x === c || x.replace(/^0+/, '') === c.replace(/^0+/, ''))) : [];
  if (!L.length) L = /[\u0600-\u06ff]/.test(s) ? smartSearch(P.urList, s, n * 2).map(x => x._r) : smartSearch(P.list, s, n * 2);
  const see = seeStock();
  return L.filter(r => r && !isHidden(r)).slice(0, n).map(r => { const per = see ? P.branches.map(b => ({ b, pcs: r2(Number(saleStockItem(b, r.id)?.stock) || 0) })).filter(x => Math.abs(x.pcs) > 0.0005) : [];
    return { id: String(r.id), name: r.name, sub: !see ? '📦 Stock screen par dekhein' : per.length ? per.map(x => (x.b === P.main ? '🏪 ' : '🏬 ') + hgShort(x.b, P.names) + ' ' + qtyTxt(x.pcs, r)).join(' · ') : '⚪ Kahin stock nahi (0)' }; });
};
window.ntItemOpen = async id => {
  try { if ($('dialog')?.open) $('dialog').close(); } catch {}
  if (roz) { notice('📋 Roz ki ginti chal rahi hai — pehle us se bahar aayein'); return; }
  if (!loaded) { start(false); for (const t0 = Date.now(); !loaded && Date.now() - t0 < 8000;) await new Promise(r => setTimeout(r, 150)); }
  const P = agPool(), r = P.byId.get(String(id)); if (!r) { notice('Item nahi mila (stock abhi load nahi?)'); return; }
  if (window.ntShellView?.() !== 'stock') { $('stockNav')?.click(); for (const t0 = Date.now(); window.ntShellView?.() !== 'stock' && Date.now() - t0 < 3000;) await new Promise(r => setTimeout(r, 80)); }
  const has = b => !!itemAt(b, r.id), brs = collect().branches;
  if (!(branch != null && has(branch))) branch = has(P.main) ? P.main : (brs.find(b => has(b) && Math.abs(Number(itemAt(b, r.id)?.stock) || 0) > 0.0005) ?? brs.find(has) ?? branch);
  filter = 'all'; facOnly = false; inPick = null; scanHit = r.id; if (hgCan()) hgOn = true;
  const s = $('search'); if (s) s.value = r.name; limit = PAGE; rerender();
  setTimeout(() => { try { document.querySelector(`[data-stock-row="${CSS.escape(String(r.id))}"]`)?.scrollIntoView({ block: 'center' }); } catch {} }, 120);
};
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
    const pkL = Array.isArray(x.pk) ? x.pk.filter(p => Number(p.z) > 0 && Number(p.n) > 0).map(p => ({ z: Number(p.z), n: Number(p.n), nm: String(p.nm || pkName(p.z, it)) })) : [];   // v2.103.33: 📦 packet
    const pk = Number(it.pack) > 1 && !pkL.length ? Number(it.pack) : 0, ctn = pk ? Math.max(0, Number(x.ctn) || 0) : 0, pcs = pkL.length ? r3(pkL.reduce((t, p) => t + p.z * p.n, 0)) : Math.max(0, Number(x.pcs) || 0) + (pk ? 0 : Math.max(0, Number(x.ctn) || 0));
    const qty = r3(ctn * pk + pcs); if (!(qty > 0)) throw Error('Tadad 0 — ' + it.name);
    return { itemId: it.id, name: it.name, qty, ctn, pcs, pack: Number(it.pack) || 0, cName: it.cName || 'Ctn', uName: it.uName || 'Pcs', ...(pkL.length ? { pk: pkL } : {}) };
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
    try { trStop?.(); } catch {} trStop = cloud.listenTransfers ? cloud.listenTransfers(list => { trGot(list); if (document.querySelector('.th-root')) rerender(); }) : null;
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
setInterval(() => { const el = document.getElementById('rkAge'); if (!el || !rackAt) return; const a = Math.round((Date.now() - rackAt) / 60000); el.textContent = a < 1 ? 'abhi' : a + ' min pehle'; el.style.color = a > 5 ? '#fca5a5' : ''; }, 20000);   // v2.103.75: "x min pehle" khud taza
let bandStop = null;   // v2.103.55: rack/mangwao window mein band + PC jawab live (stock screen khule baghair)
function bandWatch() { if (bandStop || !cloud?.listenBand) return; bandStop = cloud.listenBand((k, v) => { if (k === 'h') hidden = v || {}; else bandDone = { items: v?.items || {}, fail: v?.fail || {} }; if (rk) rkPaint(); if ($('bdList')) try { bdPaint(); } catch {} }); }
function rackWatch() { if (!rackAt && !irStop) setTimeout(() => { if (!rackAt) rackLocalWatch(); }, 20000); bandWatch(); if (rackStop || !cloud?.listenRack) return; rackStop = cloud.listenRack(d => { rackRows = Array.isArray(d?.rows) ? d.rows : []; rackPk = Array.isArray(d?.pk) ? d.pk : []; rackZero = Array.isArray(d?.z) ? d.z : []; rackAt = Number(d?.at) || 0; if (!rk) { const tl = document.querySelector('.th-root [data-th="rack"] small'); if (tl) { const n = rackDue().length + pkDue().length; tl.textContent = n ? `${n} items godam se lane` : 'Sab rack bhare ✓'; } } if (rk && $('rkBody')) rkPaint(); }); }   // v2.103.88: ⚡ 3-mahine report (bhari) sirf jab PC rack data 20 s mein na aaye; Transfer screen poori dobara nahi — sirf tile ka number
const rackCfg = id => itemCfg?.rack?.[String(id)] || null;
// v2.105.3: malik — "rack bharo 100 percent sab mobiles par by default": 🔒 100% lock ab mulazim bhi lagaye / hataye → stockConfig.rackB {id: pcs}
//   (rules 2.68: mulazim stockConfig mein sirf rackPk + rackB). rackB pehle, phir malik ka purana rack[id].b. CAP stock.rack100.
const rackBOf = id => { const v = Number(itemCfg?.rackB?.[String(id)]); return v > 0 ? v : 0; };
async function rack100Save(id, pcs) {
  id = String(id); const v = Number(pcs) > 0 ? Math.round(Number(pcs)) : 0;
  if (!cloud?.setRackB) throw Error('App update karein');
  const prevB = itemCfg?.rackB?.[id], rb = { ...(itemCfg?.rackB || {}) }; if (v) rb[id] = v; else delete rb[id]; itemCfg = { ...(itemCfg || {}), rackB: rb };
  let legacy;   // malik hataye to purana rack[id].b bhi (warna wapas aa jaye)
  if (!v && isOwner() && Number(rackCfg(id)?.b) > 0) { const { b: _b, ...r } = rackCfg(id); legacy = Object.keys(r).length ? r : null; itemCfg = { ...itemCfg, rack: { ...(itemCfg?.rack || {}), [id]: legacy } }; }
  if (rk && $('rkBody')) rkPaint();
  try { await cloud.setRackB(id, v || null); }
  catch (er) { const b2 = { ...(itemCfg?.rackB || {}) }; if (prevB != null) b2[id] = prevB; else delete b2[id]; itemCfg = { ...itemCfg, rackB: b2 }; if (rk && $('rkBody')) rkPaint();   // wapas — screen jhooth na bole
    throw /permission|insufficient/i.test(String(er?.message || er)) ? Error('🔐 Firebase rules 2.68 abhi nahi lagi — malik 🔐 Rules se update kare') : er; }
  if (legacy !== undefined && cloud.setRackCfg) await cloud.setRackCfg(id, legacy);
}
// v2.103.78: 🔒 100% lock wale godam — NAAM se Godam 1 aur Godam 3 (POS branch 2 ka naam "Godam 1"); Godam 2 = purana qaida
const rkLockedIds = () => { const S = new Set(); for (const [k, v] of Object.entries(itemCfg?.rackB || {})) if (Number(v) > 0) S.add(String(k)); for (const [k, v] of Object.entries(itemCfg?.rack || {})) if (Number(v?.b) > 0) S.add(String(k)); return S; };
const rk100G = g => { const n = String(branchName(Number(g), collect().names || {}) || '').toLowerCase(); return /godam\s*[13]\b/.test(n) || (Number(g) === 2 && !/godam/.test(n)); };
function rackCalc(x) {   // v2.103.16: 🔹 pcs wala (masale) · 🔴 rack khali · 🚫 sirf godam
  const P = Number(x.pk) > 1 ? Number(x.pk) : 0, cf = rackCfg(x.i) || {}, cm = !!P && (cf.mode ? cf.mode === 'ctn' : x.fc !== 0), pk = cm ? P : 0;
  const unit = Number(cf.u) > 0 ? Number(cf.u) : (pk || Math.max(1, Math.round(Number(x.m) || 1)));
  const live = saleStockItem(Number(x.g), String(x.i)), gs = live ? Number(live.stock) || 0 : Number(x.gs) || 0, sl = saleStockItem(1, String(x.i)), ss = sl ? Number(sl.stock) || 0 : Number(x.ss) || 0;
  // v2.103.23: 📤 NIKLA = aamad ke baad bika (s) + wapas godam (o) − seedha dukan purchase (p) · 📉 malik ki hadd (rackLo: dukan mein ¼ / ½ ctn reh jaye)
  const khali = !!x.k && ss <= 0, sold = Math.max(0, (Number(x.s) || 0) + (Number(x.o) || 0) - (Number(x.p) || 0)), hd = rackLo(), add = !!x.add;
  const lo = !khali && !!pk && hd > 0 && ss > 0 && ss <= pk * hd + 1e-9;
  // v2.103.24: 📊 % bacha — 100% = maal aane ke foran baad (dukan abhi + nikla); malik chip (rackPct 10–40) = sirf jab itna % ya kam bache
  // v2.103.74: 🔒 RACK POORA lock — malik ka (cf.b) > PC ka b0 (pehle rack transfer ke baad dukan ka stock) > purana (abhi + nikla). Transfer notes se nahi badalta.
  const bLock = rackBOf(x.i) || (Number(cf.b) > 0 ? Number(cf.b) : 0),   /* v2.103.80: 🔒 sirf jab malik khud lock kare (auto 18 Oct wala HATAYA — ghalat aata tha); sab godam */ full = bLock || (x.w && sold > 0 ? ss + sold : 0), pct = full > 0 ? Math.max(0, Math.round(ss / full * 100)) : null, pc = RK_PCTS.includes(Number(cf.pct)) ? Number(cf.pct) : rackPct(),   /* v2.103.31: item ka apna % · v2.105.4: rackPct = dekhne wale ka (mulazim ka apna ya malik ka) */ pctOk = !pc || khali || add || pct == null || pct <= pc;
  const pctDue = !!pc && !!bLock && pct != null && pct <= pc && ss < bLock;   // v2.103.74: ≤ % bacha = lane ka sabab (lao = poora − abhi)
  let want = Number(cf.q) > 0 ? Number(cf.q) : Math.floor(sold / unit) * unit; if (khali || lo || add) want = Math.max(want, unit); if (bLock && (pctDue || khali || lo || add || sold >= unit)) want = Math.max(want, Number(cf.q) > 0 ? Number(cf.q) : r3(bLock - ss));   /* v2.103.78: list mein aaye to 100% tak bharo */ if (pk) want = Math.floor(want / pk) * pk;
  const cap = pk ? Math.floor(gs / pk) * pk : Math.floor(gs), q = Math.max(0, Math.min(want, cap));
  return { pk, P, unit, want, q, gs, ss, khali, lo, add, nik: sold, full, pct, pc, bLock, bOwn: bLock > 0, bt: Number(x.bt) || 0, short: q < want, due: (!cf.off || add) && pctOk && (sold >= unit || khali || lo || add || pctDue) && q > 0, own: !!rackCfg(x.i), off: !!cf.off };
}
// v2.103.21: 5-5 ki PATTI (malik: "har 5 ki patti print phir agle 5 — larkon par bojh na bane"). Poori list dikhti hai, upar ke N par khud ✓
//   (khali pehle); malik/larka ✓ badal sakte hain (rk.man[key] = apna chunav). Print ke baad item list se hat-ta hai -> agle N par khud ✓.
function rkNGet() { try { const v = localStorage.getItem('sam-rk-n'); return v == null ? 5 : Math.max(0, Number(v) || 0); } catch { return 5; } }
function rkPick(key, ids) { const m = rk?.man?.get(key); if (m) { const S = new Set(ids.filter(id => m.has(id))); if (S.size || !m.size || !ids.length) return S; rk.man.delete(key); }   // v2.103.40: purani (patti nikal chuki) chunai = wapas default
  const T = rkTransit(), free = ids.filter(id => !T.has(String(id)));   // v2.103.87: raste wale default ☐
  return new Set(rk?.n ? free.slice(0, rk.n) : free); }
function rkToggle(key, ids, id, on) { const cur = rkPick(key, ids); if (on) cur.add(id); else cur.delete(id); rk.man.set(key, cur); }
function rkGroups(all, qOf) { const G = new Map(); for (const y of all) { if (!(qOf(y) > 0)) continue; const g = String(y.x.g); if (!G.has(g)) G.set(g, []); G.get(g).push(String(y.x.i)); } return G; }
function rkQOf(y) { return rk.sel.has(String(y.x.i)) ? rk.sel.get(String(y.x.i)) : y.c.q; }
// v2.103.22: ➕ "Phir bhi lao" — list se bahar item ka farzi row (stock se): jis godam mein sab se zyada maal
// v2.105.4: malik — "mulazim ki apni screen: wo 20% badle to us ki screen us ke hisaab, main 30 to meri mere hisaab": mulazim ka apna % / hadd SIRF
//   us ke phone par (localStorage, login naam ke saath); malik ka stockConfig.rackPct / rackLo = sab ka default. CAP stock.rackpct. % mein 50 / 60 bhi.
const RK_PCTS = [10, 20, 30, 40, 50, 60];
const rkMineOk = () => !isOwner() && can('stock.rackpct');
const rkMineKey = k => 'sam-rk-' + k + '|' + String(nameOf() || '').trim().toLowerCase().slice(0, 40);
function rkMine(k) { if (!rkMineOk()) return null; try { const s = localStorage.getItem(rkMineKey(k)); if (s == null || s === '') return null; const v = Number(s); return k === 'pct' ? (v === 0 || RK_PCTS.includes(v) ? v : null) : (v === 0 || v === 0.25 || v === 0.5 ? v : null); } catch { return null; } }
function rkMineSet(k, v) { try { if (v == null) localStorage.removeItem(rkMineKey(k)); else localStorage.setItem(rkMineKey(k), String(v)); } catch {} }
const rackPctMalik = () => { const v = Number(itemCfg?.rackPct); return RK_PCTS.includes(v) ? v : 0; };
const rackLoMalik = () => { const v = Number(itemCfg?.rackLo); return v === 0.25 || v === 0.5 ? v : 0; };
const rackPct = () => { const m = rkMine('pct'); return m != null ? m : rackPctMalik(); };
const rackLo = () => { const m = rkMine('lo'); return m != null ? m : rackLoMalik(); };
// v2.118.0: malik — "% reh jaye to lao ka ab koi maqsad nahi — qaida jitna % par aaye usi waqt item list mein": packet ka apna % (o.pct) ab NAHI chalta.
//   Har packet ⚙️ Qaide ka % (rackPct — dekhne wale ka: malik ka ya mulazim ka apna, baqi items jaisa). Qaida "Sab" (0) = packet 20% (purana default).
const pkQ = () => rackPct() || 20;
const pkDefPct = pkQ;
const pkQTxt = () => rackPct() ? `⚙️ Qaida 0–${rackPct()}%` : '⚙️ Qaida Sab (packet 0–20%)';   // v2.119.0: "0 se X% tak" (malik: 50 chuno to 10 · 20 · 30 · 40 sab)
function rkMineNote() {
  const mp = rackPctMalik(), malik = `${mp ? mp + '%' : 'Sab'} · ${rkHdName(rackLoMalik())}`;
  if (isOwner()) return '<small class="rk-only">👑 Ye sab phones ka default — mulazim chahe to apne phone par apna chune</small>';
  if (!rkMineOk()) return `<small class="rk-only">🔒 Malik wala chal raha hai (${esc(malik)}) — apna chunne ki ijazat nahi</small>`;
  return rkMine('pct') != null || rkMine('lo') != null ? `<small class="rk-only rk-mine">👤 Sirf aap ke phone par · malik ka: ${esc(malik)} <button type="button" class="rk-mine0" data-rk-mine0="1">↺ Malik wala</button></small>`
    : `<small class="rk-only">👤 Abhi malik wala (${esc(malik)}) — chip dabayein to sirf aap ke phone par badlega</small>`;
}
// v2.118.0: ⚙️ Qaide ka dabba — 🧺 Lane wale AUR 📋 Packet % dono tab mein (phone par ⋮ → ⚙️ Qaide) · packet bhi isi % par (pkQ)
function rkSetHTML(nAll) {
  const dis = isOwner() || rkMineOk() ? '' : ' disabled';
  return `<details class="rk-set" data-mn-box="rk.set" data-mn-i="⚙️" data-mn-t="Qaide — % · hadd · patti" data-mn-s="Qaida: 0 se itne % tak sab lao (packet bhi)" data-mn-g="🧺 Rack bharo"${rk.setOpen ? ' open' : ''}><summary>⚙️ Qaide — % · hadd · patti</summary>
    <div class="rk-nb rk-pct"><span>📊 Qaida — 0 se itne % tak sab lao</span>${[[0, 'Sab'], ...RK_PCTS.map(v => [v, v + '%'])].map(([v, l]) => `<button type="button" class="${rackPct() === v ? 'is-in' : ''}" data-rk-pct="${v}"${dis}>${l}</button>`).join('')}</div>
    <div class="rk-nb rk-hd"><span>📉 Dukan mein itna reh jaye to lao</span>${[[0, 'Khali (0)'], [0.25, '¼ ctn'], [0.5, '½ ctn']].map(([v, l]) => `<button type="button" class="${rackLo() === v ? 'is-in' : ''}" data-rk-hd="${v}"${dis}>${l}</button>`).join('')}</div>${rkMineNote()}
    ${nAll > 3 ? `<div class="rk-nb"><span>🖨 Ek patti mein</span>${[3, 5, 10, 0].map(n => `<button type="button" class="${rk.n === n ? 'is-in' : ''}" data-rk-n="${n}">${n || 'Sab'}</button>`).join('')}</div>` : ''}
    </details>`;
}
document.addEventListener('click', e => { if (!e.target.closest?.('[data-rk-mine0]') || !rk) return; rkMineSet('pct', null); rkMineSet('lo', null); rk.man.clear(); rkPaint(); notice('↺ Malik wala % / hadd — aap ke phone par bhi'); });
const rkHdName = v => v === 0.25 ? '¼ ctn' : v === 0.5 ? '½ ctn' : 'khali';
function rkSynth(id) { const P = agPool(), it = P.byId.get(String(id)); if (!it) return null; const { branches } = collect(), gods = branches.filter(b => b !== 1);
  const gl = gods.map(b => [b, Number(saleStockItem(b, id)?.stock) || 0]), g = (rk?.g && gl.find(z => z[0] === rk.g && z[1] > 0)) || gl.sort((a, b) => b[1] - a[1])[0]; const sI = saleStockItem(1, id), pk = Number(it.pack) || 0;   // v2.103.80: chuna hua godam pehle
  return { i: String(id), n: it.name, pk, g: g ? g[0] : 0, gs: g ? g[1] : 0, ss: Number(sI?.stock) || 0, w: 0, s: 0, m: pk > 1 ? pk : 1, fc: 1, add: 1 }; }
// 🔍 Ye kyun nahi aaya? — rack list mein na hone ki wajah
function rkWhy(id) { id = String(id); const names = collect().names || {}, x = rackSrc().find(r => String(r.i) === id), cf = rackCfg(id) || {}, gods = collect().branches.filter(b => b !== 1);
  const gst = gods.map(b => [b, Number(saleStockItem(b, id)?.stock) || 0]).filter(z => z[1] > 0), ss = Number(saleStockItem(1, id)?.stock) || 0;
  const stk = `dukan ${num(r3(ss))} · ${gst.length ? gst.map(([b, v]) => esc(branchName(b, names)) + ' ' + num(r3(v))).join(' · ') : 'godam 0'}`;
  const any = gst.length > 0;   // v2.103.80: godam mein maal ho to ➕ hamesha (packet wala / farq wala bhi)
  if (pkCfg(id)) { if (cf.off) return { w: '🚫 "Nahi lana" laga hai — Packet % list mein ↺ se wapas', stk, can: true, any }; const gg0 = Number(pkCfg(id).g || 0), gq0 = Number(saleStockItem(gg0, id)?.stock) || 0; if (gq0 <= 0.0005 && !any) return { w: '🏬 Godam khali', stk, can: false }; return { w: '📦 Packet-war item — yahan se seedha line mein bhi', stk, can: true, any }; }
  if (false) { if (cf.off) return { w: '🚫 "Nahi lana" laga hai — Packet % list mein ↺ se wapas', stk, can: true }; const gg = Number(pkCfg(id).g || 0), gq = Number(saleStockItem(gg, id)?.stock) || 0; if (gq <= 0.0005) return { w: '🏬 Godam khali — 1 packet bhi nahi banta', stk, can: false }; return { w: '📦 Packet-war mein hai — wahan se aata hai', stk, can: false }; }
  if (cf.off) return { w: '🚫 "Sirf godam" laga hai — ✏️ se hatayein', stk, can: true };
  if (rackSent.get(id) > (Number(x?.w) || 0)) return { w: '🖨 Abhi patti nikli hai (30 min tak chhupa)', stk, can: false, any };
  if (!gst.length) return { w: '⛔ Kisi godam mein stock nahi', stk, can: false };
  { const bL = rackBOf(id) || (Number(cf.b) > 0 ? Number(cf.b) : 0), xs = bL > 0 ? (x || (() => { const z = rkSynth(id); return z ? { ...z, add: 0, lk: 1 } : null; })()) : null;   // v2.105.4
    if (xs) { const c = rackCalc(xs); if (c.pct != null && c.pc && c.pct > c.pc) return { w: `🔒 100% = ${rkQty(bL, c.pk)} · abhi ${c.pct}% bacha — ${c.pc}% (${rkQty(Math.floor(bL * c.pc / 100), c.pk)}) reh jaye to khud list mein`, stk, can: true }; } }
  if (x) { const c = rackCalc(x); if (c.pk && c.gs < c.pk) return { w: `📦 Godam mein poora carton nahi (${num(r3(c.gs))} pcs, 1 ctn = ${num(c.pk)})`, stk, can: true };
    return { w: `⏳ Aakhri aamad ke baad ${num(r3(c.nik))} nikle — hadd ${num(c.unit)}${c.pk ? ' (1 carton)' : ''}; dukan mein ${num(r3(c.ss))} hain`, stk, can: true }; }
  return { w: ss > 0 ? '🛒 6 mahine mein dukan par nahi bika (ya PC data mein nahi)' : '🛒 Dukan par kabhi nahi bika', stk, can: true }; }
function rackDue() {
  const now = Date.now(); for (const [k, t] of rackSent) if (now - t > 30 * 60000) rackSent.delete(k);
  const src = rackSrc(), ex = rk?.extra || new Map(), have = new Set(src.map(x => String(x.i)));
  const L = src.map(x => ex.has(String(x.i)) ? { ...x, add: 1 } : x);
  for (const id of ex.keys()) if (!have.has(id)) { const x = rkSynth(id); if (x) { L.push(x); have.add(id); } }
  // v2.105.4: 🔒 100% lock wale items bhi — PC list mein na hon (aamad ke baad bika hi nahi) phir bhi dukan abhi / poora % hadd par aaye to KHUD list mein
  for (const id of rkLockedIds()) if (!have.has(id)) { const x = rkSynth(id); if (x) L.push({ ...x, add: 0, lk: 1 }); }
  const TR = rkTransit(), rank = (c, x) => c.add ? 9 : TR.has(String(x.i)) ? -1 : c.khali ? 3 : c.lo ? 2 : 0;   // v2.103.82: 🔍 search se laya = sab se upar · v2.103.87: 🚚 raste wale neeche
  return L.filter(x => (x.add || !pkCfg(x.i)) && (x.add || !(rackSent.get(String(x.i)) > (Number(x.w) || 0)))).map(x => ({ x, c: rackCalc(x) })).filter(y => y.c.due).sort((a, b) => rank(b.c, b.x) - rank(a.c, a.x));
}
const rkQty = (q, pk) => pk ? `${num(Math.floor(q / pk))} ctn` : `${num(q)} pcs`;
const rkWhen = ms => { const d = new Date(ms); return `${d.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]} ${d.toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit' })}`; };
// ---- v2.103.17: 📦 PACKET-WAR (Godam 2) — ek item ke kai barcode (garam masala 1 kg · 250 gm, ilaichi 50 gm): POS ek hi stock (kg) rakhta hai,
//   magar har sale line ki miqdaar = packet (0.250 = 250 gm). PC rack-bharo v1.2 ginta hai (aakhri transfer / chunne ke baad). Malik: kaun se items,
//   kaun sa godam (default Godam 2), har packet "itne bikein to" (n) + "itne lao" (a). Transfer note: POS mein wazan, note mein "250 gm × 10".
const pkCfg = id => { const v = itemCfg?.rackPk?.[String(id)]; if (!v) return null; try { const o = typeof v === 'string' ? JSON.parse(v) : v; return o && o.p ? o : null; } catch { return null; } };
const pkSent = new Map();
const pkName = (z, it) => { const u = String(it?.uName || '').toLowerCase(), kg = /kg|kilo/.test(u) || !u || u === 'pcs'; z = Number(z); return kg && z < 1 ? `${Math.round(z * 1000)} gm` : `${+z.toFixed(3)} ${it?.uName || (kg ? 'kg' : '')}`.trim(); };
// v2.103.32: 📦 packet ka haal — b = rack POORA bhara (100%), c = set karte waqt rack par ABHI (at); refill (transfer at ke baad) = wapas b se.
//   left = base − bika (from se); due = left <= b·pct%; lao = b − left (wapas 100%). Purane cfg (b nahi) = n/a wala tareeqa.
function pkLeft(o, r, z, at) { const b = Number(o?.b) || 0; if (!b) return null; const stale = Number(r?.from) > 0 && Number(r.from) < (Number(at) || 0) - 1000, sold = stale ? 0 : Number(r?.sold?.[z] ?? r?.sold?.[String(Number(z))]) || 0;   // v2.103.33: PC ne naya at abhi nahi dekha = bika 0
  const refill = Number(r?.from) > (Number(at) || 0) + 60000, base = !refill && o?.c != null && o.c !== '' ? Number(o.c) : b;
  const left = Math.max(0, r3(base - sold)), lim = Math.floor(b * pkQ() / 100);   // v2.118.0: ⚙️ Qaida ka % (packet ka apna o.pct nahi)
  return { b, sold, left, now: Math.round(left / b * 100), lim, due: left <= lim + 1e-9, lao: Math.max(1, Math.round(b - left)) }; }
// v2.103.67: ⚠️ POS se milana BAND (v2.103.66 wapas) — malik: "app ka apna data hona chahiye: 500 gm barcode ki sale 500 gm se minus, POS mein to sirf kul hai".
//   App ka packet-war bacha = aakhri likha (c) − us packet ke barcode ki sale. Ghalat likha ho to gin kar likho. pkReconcile ab sirf 🏪 "POS ke hisaab se bharo" button par (editor), khud kabhi nahi.
function pkReconcile(packs, pos) { const K = packs.filter(p => p.left != null && p.b > 0); if (!K.length || !(pos >= 0)) return 0; let ex = r3(K.reduce((t, p) => t + p.left * p.z, 0) - pos); if (ex <= 0.0005) return 0; const cut = ex;
  for (const p of [...K].sort((a, b) => b.z - a.z)) { if (ex <= 0.0005) break; const take = Math.min(p.left, r3(ex / p.z)); p.left = r3(p.left - take); ex = r3(ex - take * p.z); p.now = Math.round(p.left / p.b * 100); p.due = p.left <= Math.floor(p.b * pkQ() / 100) + 1e-9; p.lao = Math.max(1, Math.round(p.b - p.left)); p.adj = true; }
  return cut; }
function pkN(b, c, pct) { const base = c != null && c !== '' ? Number(c) : b; return Math.max(0, Math.round(base - Math.floor(b * pct / 100))); }
// v2.103.83: ☑ GODAM JITNA HI — malik: "jitna godam mein hai utna hi nikle, kam stock ho to bikta nahi" → line ki tadad godam ke stock tak (bara packet pehle); untick = poora
function pkCapOn(id) { return !(rk?.capOff?.has(String(id))); }
function pkQOf(y) { const id = String(y.r.i), want = new Map(y.packs.map(p => [p.z, rkpWant(y, p)])),   // v2.119.0: rkpWant — 🚚 raste / ☐ Sab wale 0 se
    need = r3([...want].reduce((t, [z, n]) => t + z * n, 0)), gs = Number(y.gs) || 0, short = need > gs + 1e-9;
  if (!short || !pkCapOn(id)) return { q: want, short, need, gs, capped: false };
  let left = gs; const out = new Map(); for (const p of [...y.packs].sort((a, b) => b.z - a.z)) { const n = Math.min(want.get(p.z) || 0, Math.floor((left + 1e-9) / p.z)); out.set(p.z, n); left = r3(left - n * p.z); }
  return { q: out, short, need, gs, capped: true }; }
function pkDue() {
  const out = [];
  const fx = rk?.pkx || new Set(); for (const r of rackPk) { const cf = pkCfg(r.i), force = fx.has(String(r.i)); if (!cf) continue; if (!force && pkSent.get(String(r.i)) > (Number(r.from) || 0)) continue;   // v2.103.82: "Rack bhara?" (larke ka ✓) hataya; 🔍 search se laya = force
    if (!force && rackCfg(r.i)?.off) continue;   // v2.103.72: 🚫 nahi lana (packet wale bhi)
    const it = saleStockItem(1, String(r.i)) || saleStockItem(Number(r.g), String(r.i)), gI = saleStockItem(Number(cf.g || r.g), String(r.i)), gs = gI ? Number(gI.stock) || 0 : Number(r.gs) || 0;
    const packs = Object.entries(cf.p || {}).map(([z, o]) => { const zz = Number(z); const sold = Number(r.sold?.[z] ?? r.sold?.[String(zz)]) || 0, n = Math.max(1, Number(o?.n) || 10), b = Number(o?.b) || 0, pct = pkQ(), L = pkLeft(o, r, z, cf.at), a = L ? L.lao : Math.max(1, Number(o?.a) || n);
      return { z: zz, sold, n, a, b, pct, left: L ? L.left : null, due: L ? L.due : sold >= n, lao: a, name: pkName(zz, it) }; });
    let packsDue = packs.filter(p => p.due); if (force && !packsDue.length) packsDue = (packs.some(p => p.b > 0) ? packs.filter(p => p.b > 0) : packs).map(p => ({ ...p, a: Math.max(1, Number(p.lao) || 1) }));   // v2.103.82 · v2.103.67: POS se milana HATA diya — malik: "app ka apna data (barcode-war sale) chalega, POS mein sirf kul hai"

    if (!packsDue.length) continue;
    if (!force && (gs <= 0.0005 || gs < Math.min(...packsDue.map(p => p.z)) - 1e-9)) continue;   // v2.103.72: godam khali (1 packet bhi nahi banta) → list mein nahi
    out.push({ r, cf, it, g: Number(cf.g || r.g), gs, packs: packsDue, force, name: r.n || it?.name || 'Item ' + r.i });
  }
  const TRp = rkTransit(); return out.sort((a, b) => (b.force ? 1 : 0) - (a.force ? 1 : 0) || (TRp.has(String(a.r.i)) ? 1 : 0) - (TRp.has(String(b.r.i)) ? 1 : 0));
}
// ---- v2.103.39: 🏷 BARCODE LABEL transfer note ke saath — malik: "badam ka bhi barcode banane ka option · sub-barcode bhi · ek click: note + barcode".
//   rkLabelLines(lines): har line ke liye [{code, qty(z), rate, copies}] — pk wali: har packet (z) ka label × n (labelRows: qty == z, main = 1);
//   carton/pcs wali: asal code × pcs (ctn·pack + pcs), 1000 tak. requestLabel 200-200 ke hisson mein (labelJobs → PC label-print, TSC).
function rkLabelLines(lines) { const out = []; for (const l of lines) { const id = String(l.id ?? l.itemId), it = saleStockItem(1, id) || agPool().byId.get(id); if (!it) continue; const rows = labelRows(it).filter(x => x.show !== false);
    const want = Array.isArray(l.pk) && l.pk.length ? l.pk.map(p => ({ z: Number(p.z), n: Number(p.n) || 0 })) : [{ z: 1, n: Math.min(1000, Math.round((Number(l.ctn) || 0) * (Number(l.pack) || Number(it.pack) || 0) + (Number(l.pcs) || 0))) }];
    for (const w of want) { if (!(w.n > 0)) continue; const x = rows.find(y => Math.abs(Number(y.qty) - w.z) < 1e-9) || (w.z === 1 ? rows[0] : null); if (!x) continue; out.push({ itemId: id, code: x.code, name: it.name || l.name, qty: x.qty, rate: x.price, copies: Math.floor(w.n) }); } }
  return out; }
async function rkLabelsGo(lines, why) { if (!cloud?.requestLabel) { notice('Label ke liye app update karein'); return 0; } const L = rkLabelLines(lines); let n = 0;
  for (const x of L) for (let left = x.copies; left > 0; left -= 200) { const c = Math.min(200, left); try { await cloud.requestLabel({ itemId: x.itemId, code: x.code, name: x.name, qty: x.qty, rate: x.rate, copies: c }); n += c; } catch (e) { notice('🏷 Label nahi gaya: ' + (e?.message || e)); return n; } }
  if (n) notice(`🏷 ${num(n)} label ${why || ''} — PC label printer par`); else notice('🏷 Koi barcode nahi mila'); return n; }
const rkLbCount = lines => rkLabelLines(lines).reduce((t, x) => t + x.copies, 0);
// ---- v2.103.37: ⏳ PATTI NIKLI — RACK BHAR GAYA? — malik: "note ban jaye to item tab gayab ho jab larka shop par check kar ke ✓ kare ·
//   dobara note bhi · checkbox · barcode · note print · stock aaya check wahin · godam ke chips (default Godam 1)".
//   Source = transferJobs (trList, 14 din) jo rack bharo / packet se bane (note 🧺 / 📦), status done. ✓ = blueAccess/rackDone {jobs:{jobId:{ids,at,by}}}
//   (staff likh sakta — rules 2.64). Transfer check mein TN "✓ poora mila" (tcChecks ok) = sab items khud ✓. Pending item due list mein nahi.
let rackDone = {}, rackDoneStop = null;
// ---- v2.103.45: 🛒 MANGWAO (supplier se re-order) — malik: "godam ka stock sahi hai, usi ka re-order supplier se; aakhri purchase kab, kitna aaya,
//   us waqt kitna tha → poora = us waqt + aaya; chips 10/20/30/40% reh gaya; Demand bhi yahin; NOOR TRADERS (dukan) ka stock bhi".
//   Data: posStats/reorder (PC reorder.js, har 10 min): {i, n, pk, st:{branch:stock}, s30, h:[{at, q, pre, p, pid}]}. Target: stockConfig.reorder[id].t
//   (malik, warna khud = max(pre+q) aakhri 3 mein se). Item ka apna % = pre/target (aakhri purchase par kitna tha). Kul = sab jagah (dukan + godam).
//   Order = purchaseOrders doc (sirf record — v2.106.0 se Reminder screen par nahi dikhta) + yahin PDF (regPdfOf, kholo / bhejo).
let ro = { rows: [], at: 0 }, roStop = null, roDm = [], roDmStop = null;
const roCfg = id => itemCfg?.reorder?.[String(id)] || null;
function roTarget(x) { const c = roCfg(x.i); if (c && Number(c.t) > 0) return { t: Number(c.t), own: true }; const t = Math.max(0, ...x.h.slice(0, 3).map(h => Math.max(0, h.pre) + h.q)); return { t: r3(t), own: false }; }
// v2.103.54: supplier = jis se zyada dafa mangwaya (aakhri 6 purchase); barabar → sasta avg rate. Malik ka pakka (cfg.p) sab se upar. ps = party-war {p, n, r(avg), last}; cheap = sab se sasti party (agar chuni hui se alag)
// v2.103.83: "godam stock" / "stock fraq" / opening jaisi parties asal supplier nahi — na supplier, na sasta, na poora
const roBadP = p => /godam\s*stock|stock\s*f[ae]?r+a?q|opening|stock\s*adj/i.test(String(p || ''));
function roParty(x) { const M = new Map(); for (const h of x.h || []) { const k = h.p || ''; if (!k || roBadP(k)) continue; const o = M.get(k) || { p: k, n: 0, q: 0, rs: 0, last: 0 }; o.n++; if (h.r > 0 && h.q > 0) { o.q += h.q; o.rs += h.q * h.r; } o.last = Math.max(o.last, h.at || 0); M.set(k, o); }
  const ps = [...M.values()].map(o => ({ p: o.p, n: o.n, r: o.q > 0 ? Math.round(o.rs / o.q * 100) / 100 : 0, last: o.last })).sort((a, b) => b.n - a.n || (a.r || 1e12) - (b.r || 1e12) || b.last - a.last);
  const c = roCfg(x.i), own = c?.p ? String(c.p) : '', party = own || ps[0]?.p || '', withR = ps.filter(o => o.r > 0), cheapest = withR.length ? withR.reduce((a, b) => b.r < a.r ? b : a) : null, cheap = cheapest && cheapest.p !== party ? cheapest : null;
  return { party, own: !!own, ps, cheap, rate: ps.find(o => o.p === party)?.r || 0 }; }
function roRows() { const g = rk?.g || 0, dm = new Map(roDm.map(d => [String(d.i), d])), tq = rk?.roQ || new Map();
  return ro.rows.map(x0 => { const x = { ...x0, h: (x0.h || []).filter(h => !roBadP(h.p)) }, tot = r3(Object.values(x.st || {}).reduce((a, b) => a + b, 0)), gst = g ? r3(x.st?.[g] || 0) : tot, { t, own } = roTarget(x), last = x.h[0], pct = t > 0 ? Math.round(tot / t * 100) : null, lim = last && t > 0 ? Math.round(Math.max(0, last.pre) / t * 100) : 20;
    const need = t > 0 ? Math.max(0, r3(t - tot)) : 0, pk = Number(x.pk) || 0, lao = pk > 1 ? Math.ceil(need / pk - 1e-9) * pk : Math.ceil(need), q = tq.has(String(x.i)) ? tq.get(String(x.i)) : lao;
    const P = roParty(x); return { x, id: String(x.i), tot, gst, t, own, pct, lim, need, lao, q, pk, last, dm: dm.get(String(x.i)) || null, party: P.party, pOwn: P.own, ps: P.ps, cheap: P.cheap, rate: P.rate }; }); }
function roList() { const f = rk.roF, L = roRows().filter(r => !hidden[r.id] && (!rk.g || Number(r.x.st?.[rk.g] || 0) > 0 || r.dm) && (f === 'dm' ? !!r.dm : f === 'all' ? r.t > 0 : r.t > 0 && r.pct != null && r.pct <= f) || (f !== 'dm' && r.dm));
  const q = (rk.roQs || '').trim(); const out = q ? smartSearch(L.map(r => ({ ...r, name: r.x.n })), q, 200) : L; return out.sort((a, b) => (b.dm ? 1 : 0) - (a.dm ? 1 : 0) || (a.pct ?? 999) - (b.pct ?? 999)); }
const roWhen = at => { const d = Math.round((Date.now() - at) / 864e5); return d <= 0 ? 'aaj' : d === 1 ? 'kal' : d + ' din pehle'; };
function roHTML(names) { const L0 = roList(), G0 = new Map(); for (const r of L0) { const k = r.party || 'Supplier nahi pata'; if (!G0.has(k)) G0.set(k, []); G0.get(k).push(r); }
  if (rk.roP && !G0.has(rk.roP)) rk.roP = '';   // v2.103.53: supplier chip — jo is % mein hai hi nahi, khud "Sab"
  const G = rk.roP ? new Map([[rk.roP, G0.get(rk.roP)]]) : G0, L = rk.roP ? G0.get(rk.roP) : L0;
  const sq = (rk.roPq || '').trim(), supAll = [...G0].sort((a, b) => b[1].length - a[1].length), supL = sq ? smartSearch(supAll.map(([k, ys]) => ({ id: k, name: k, ys })), sq, 60).map(o => [o.id, o.ys]) : supAll;   // v2.103.55: 🔍 supplier smart search
  const supChips = G0.size > 1 ? `<label class="hs-search rk-supq"><input type="search" data-ro-pq="1" placeholder="🔍 supplier dhoondo… (${num(G0.size)})" value="${esc(rk.roPq || '')}" autocomplete="off"></label><div class="rk-nb rk-sup" data-mn-seg="rk.sup" data-mn-i="🏭" data-mn-t="Supplier" data-mn-g="🛒 Mangwao"><button type="button" class="${rk.roP ? '' : 'is-in'}" data-ro-p="">Sab ${num(L0.length)}</button>${supL.map(([k, ys]) => `<button type="button" class="${rk.roP === k ? 'is-in' : ''}" data-ro-p="${esc(k)}">${esc(k)} <b>${num(ys.length)}</b></button>`).join('') || '<small class="stat-note">koi supplier nahi mila</small>'}</div>` : '';
  const bp = canBand() ? bandPendList() : [], bandBox = bp.length ? `<details class="rk-set rk-bandp"><summary>⛔ Band — PC baqi <b>${num(bp.length)}</b> items (PC on hote hi khud POS mein inactive)${bp.some(b => b.st === 'fail') ? ` · ❌ ${num(bp.filter(b => b.st === 'fail').length)}` : ''}</summary><div class="rk-bp">${bp.some(b => b.st === 'fail') ? `<p class="rk-note">❌ = PC ne 3 dafa koshish ki, nahi hua — wajah item ke neeche. 🔁 dobara = PC phir koshish karega.</p>` : ''}${bp.map(b => `<div class="rk-bpr"><span><b>${esc(b.name)}</b> ${bandChip(b.id)}</span><button type="button" data-ro-unban="${esc(b.id)}">↩ wapas chalu</button></div>`).join('')}</div></details>` : '';
  const P = new Map(); for (const [k, ys] of G) P.set(k, rkPick('o' + k, ys.map(r => r.id))); const on = r => P.get(r.party || 'Supplier nahi pata')?.has(r.id) && r.q > 0; const nOn = L.filter(on).length, ed = rk.roEd;
  const unit = r => r.pk > 1 ? `${num(r.q / r.pk)} ctn` : `${num(r.q)} pcs`;
  return `${bandBox}<div class="rk-nb rk-pct" data-mn-seg="rk.ropct" data-mn-i="📊" data-mn-t="Itna % reh gaya" data-mn-g="🛒 Mangwao"><span>📊 Itna % reh gaya</span>${[...[10, 20, 30, 40, 50, 60, 70, 80, 90].map(v => [v, v + '%']), ['all', 'Sab'], ['dm', '📢 Demand' + (roDm.length ? ' ' + num(roDm.length) : '')]].map(([v, l]) => `<button type="button" class="${String(rk.roF) === String(v) ? 'is-in' : ''}" data-ro-f="${v}">${l}</button>`).join('')}</div>
    ${!ro.at ? '<div class="th-empty">🛒<b>PC data aa raha hai</b><small>Shop PC update ke baad 10 min — "🛒 Mangwao" script</small></div>' : `<p class="rk-note">🖥 PC ${esc(new Date(ro.at).toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit' }))} · kul = ${rk.g ? esc(branchName(rk.g, names)) + ' + baqi sab' : 'dukan + sab godam'} · poora = aakhri purchase par "us waqt tha + aaya" (✏️ se badlein)</p>`}
    ${supChips}<datalist id="roPartyList">${[...new Set(roRows().flatMap(r => r.ps.map(o => o.p)))].sort().map(p => `<option value="${esc(p)}">`).join('')}</datalist>
    <label class="hs-search"><input type="search" data-ro-q="1" placeholder="🔍 item dhoondo…" value="${esc(rk.roQs || '')}" autocomplete="off"></label>
    ${[...G].map(([k, ys]) => { const S = P.get(k), n = ys.filter(on).length; return `<section class="rk-g rk-ro"><div class="rk-gh"><b>🏪 ${esc(k)}</b><button type="button" class="rk-all" data-ro-all="${esc(k)}">${ys.every(r => S.has(r.id)) ? '☐ koi nahi' : '☑ sab'}</button>${canBand() ? `<button type="button" class="rk-all rk-banall" data-ro-banall="${esc(k)}" title="Is supplier ke sab items band">⛔ sab band</button>` : ''}</div>
      ${ys.map(r => { const x = r.x, st = Object.entries(x.st || {}).filter(([, v]) => v).map(([b, v]) => `${esc(branchName(Number(b), names))} ${num(v)}`).join(' · ');
        return `<div class="rk-r${on(r) ? ' is-in' : ''}"><label class="rk-tk"><input type="checkbox" data-ro-t="${esc(r.id)}"${S.has(r.id) ? ' checked' : ''}><span><b>${esc(x.n)}</b><span class="rk-chips"><i class="rk-c ${r.tot > 0 ? 'ok' : 'kh'}">📦 abhi ${num(r.tot)}${r.pk > 1 && r.tot > 0 ? ` (${num(Math.floor(r.tot / r.pk))} ctn)` : ''}</i>${r.t > 0 ? `<i class="rk-c ${r.pct <= 20 ? 'kh' : r.pct <= 40 ? 'lo' : 'pc'}">📊 ${num(r.tot)} / ${num(r.t)} (${r.pct}%)</i>` : '<i class="rk-c mu">poora nahi pata</i>'}${r.dm ? `<i class="rk-c own">📢 ${esc(r.dm.byName || 'larka')}: ${r.dm.lvl === 'out' ? 'khatam' : 'kam'}</i>` : ''}${r.own ? '<i class="rk-c pc">✏️ malik ka poora</i>' : ''}${r.pOwn ? '<i class="rk-c pc">📌 malik ka supplier</i>' : ''}${r.cheap ? `<i class="rk-c ok">💰 sasta: ${esc(r.cheap.p)} @ ${num(r.cheap.r)}</i>` : ''}</span>
          <small>${r.last ? `🛒 aakhri ${esc(roWhen(r.last.at))}: <b>${num(r.last.q)} aaya</b>, us waqt <b>${num(Math.max(0, r.last.pre))} tha</b> → poora ${num(r.t)}${x.h.length > 1 ? ' · pichhli: ' + x.h.map(h => num(h.q)).join(' · ') : ''}` : ''}<br>📍 ${st || '<b>kahin nahi (0)</b>'}${r.ps.length ? `<br>🏪 ${r.ps.slice(0, 4).map(o => `${o.p === r.party ? '<b>' : ''}${esc(o.p)} ×${o.n}${o.r > 0 ? ' @ ' + num(o.r) : ''}${o.p === r.party ? '</b>' : ''}`).join(' · ')}` : ''}${x.s30 ? ` · 30 din bika ${num(x.s30)}` : ''}</small></span></label>
          <div class="rk-q"><input type="number" inputmode="numeric" min="0" step="${r.pk > 1 ? r.pk : 1}" data-ro-qty="${esc(r.id)}" value="${r.q}"><small>${r.pk > 1 ? 'pcs (' + unit(r) + ')' : 'pcs'}</small></div>${isOwner() ? `<div class="rk-eb"><button type="button" class="rk-e" data-ro-e="${esc(r.id)}" aria-label="Poora">✏️</button><button type="button" class="rk-e rk-ban" data-ro-ban="${esc(r.id)}" aria-label="Band">🚫</button></div>` : canBand() ? `<div class="rk-eb"><button type="button" class="rk-e rk-ban" data-ro-ban="${esc(r.id)}" aria-label="Band">🚫</button></div>` : ''}
          ${ed === r.id ? `<div class="rk-ed"><label>🧺 Poora (100%) — godam + dukan mein kul kitna hona chahiye<input type="number" inputmode="numeric" min="0" data-ro-tv="${esc(r.id)}" value="${r.own ? r.t : ''}" placeholder="khud: ${num(r.t)}"></label><label>🏪 Pakka supplier (khali = khud: zyada dafa / sasta)<input type="text" list="roPartyList" data-ro-pv="${esc(r.id)}" value="${esc(r.pOwn ? r.party : '')}" placeholder="khud: ${esc(r.party)}" maxlength="60"></label><div class="rk-mode"><button type="button" class="rk-sv" data-ro-tsv="${esc(r.id)}">✓ Save</button>${r.own || r.pOwn ? `<button type="button" data-ro-tdel="${esc(r.id)}">↺ Khud (poora + supplier)</button>` : ''}</div></div>` : ''}</div>`; }).join('')}
      <button type="button" class="rk-go" data-ro-go="${esc(k)}"${n && !rk.busy ? '' : ' disabled'}>${rk.busy === 'o' + k ? '⏳…' : `🛒 ${num(n)} items — order (PDF · WhatsApp)`}</button></section>`; }).join('') || (ro.at ? `<div class="th-empty">✓<b>${rk.roF === 'dm' ? 'Koi demand nahi' : 'Is hadd tak koi item nahi'}</b><small>Chip badal kar dekhein</small></div>` : '')}
    ${nOn ? `<p class="rk-note">Chune hue: <b>${num(nOn)}</b> items</p>` : ''}`; }
async function roGo(k) { if (!rk || rk.busy) return; const L = roList().filter(r => (r.party || 'Supplier nahi pata') === k), S = rkPick('o' + k, L.map(r => r.id)), ys = L.filter(r => S.has(r.id) && r.q > 0); if (!ys.length) { notice('Koi item nahi chuna'); return; }
  if (!cloud?.savePurchaseOrder) { notice('App update karein'); return; } rk.busy = 'o' + k; rkPaint();
  try { const items = ys.map(r => ({ i: r.id, n: String(r.x.n).slice(0, 60), q: r.q, u: r.pk > 1 ? `pcs (${num(r.q / r.pk)} ctn)` : 'pcs', st: 'open', why: `${num(r.tot)}/${num(r.t)} (${r.pct}%)`, r: r.rate || 0, ...(r.dm ? { d: (r.dm.byName || 'larka') + ': ' + (r.dm.lvl === 'out' ? 'khatam' : 'kam'), di: r.dm.id } : {}) }));
    const o = { id: 'po' + Date.now().toString(36), at: Date.now(), by: uidOf() || '', byName: String(nameOf() || (isOwner() ? 'Malik' : '')).slice(0, 60), note: `🛒 mangwao · ${k} · ${items.length} items`, lines: [{ party: k.slice(0, 80), items }] };
    await cloud.savePurchaseOrder(o); rk.man.delete('o' + k); for (const r of ys) rk.roQ.delete(r.id);
    const html = `<h1>NOOR TRADERS</h1><h2>Order — ${esc(k)}</h2><p>${esc(new Date().toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }))} · ${num(items.length)} items</p><table class="iv-tbl rp-tbl"><thead><tr><th>#</th><th>Item</th><th>Tadad</th><th>Aakhri rate</th><th>Abhi / poora</th></tr></thead><tbody>${items.map((it, i) => `<tr><td class="rp-n">${i + 1}</td><td><b>${esc(it.n)}</b>${it.d ? `<br><small>📢 ${esc(it.d)}</small>` : ''}</td><td class="rp-r"><b>${num(it.q)}</b> ${esc(it.u)}</td><td class="rp-r">${it.r > 0 ? num(it.r) : '—'}</td><td class="rp-r">${esc(it.why)}</td></tr>`).join('')}</tbody></table><p style="font-size:11px;color:#666">Noor Traders · 0345-0412515</p>`;
    notice(`🛒 Order ban gaya — ${k} (${items.length} items) · PDF kholo / bhejo`);   // v2.106.0: Reminder screen ka 🛒 order hata diya if (regPdfOf) regPdfOf(html, 'Order-' + k.replace(/[^a-z0-9]+/gi, '-'));
  } catch (e) { notice('⚠️ ' + (e?.message || e)); }
  if (rk) { rk.busy = ''; rkPaint(); } }
// v2.103.87: 🚚 raste mein — ➕ Naya note (tick, confirm) / 🖨 Reprint (wahi note)
document.addEventListener('click', e => { const b = e.target.closest?.('[data-rk-tnew],[data-rk-trp]'); if (!b || !rk) return; e.preventDefault();
  if (b.dataset.rkTrp) { if (!cloud?.requestPrint) { notice('App update karein'); return; } cloud.requestPrint({ kind: 'transfer', id: b.dataset.rkTrp, reason: 'Rack bharo — raste mein, dobara', copies: 1 }).then(() => notice('🖨 Note dobara print — PC ko bheja')).catch(er => notice('⚠️ ' + (er?.message || er))); return; }
  const id = b.dataset.rkTnew, T = rkTransit().get(id); if (T && !confirm(`TN ${T.tn} abhi raste mein hai. Phir bhi naya note?`)) return;
  const yc = rackDue().find(z => String(z.x.i) === id); if (yc) { const g = String(yc.x.g); rkToggle('r' + g, rkGroups(rackDue(), rkQOf).get(g) || [], id, true); }
  const yp = pkDue().find(z => String(z.r.i) === id); if (yp) { const g = String(yp.g); rkToggle('p' + g, pkDue().filter(z => String(z.g) === g).map(z => String(z.r.i)), id, true); }
  rkPaint(); notice('✓ Line mein — ab patti print'); });
// v2.103.78: 🔒 100% lock (lane patti ke neeche) — malik likhe ya ☑ "abhi dukan = 100%" → rackCfg.b (pcs)
document.addEventListener('click', e => { const x = e.target.closest?.('[data-rk-100x]'); if (!x || !rk) return; rack100Save(x.getAttribute('data-rk-100x'), 0).then(() => notice('↺ 100% lock hata — purana qaida')).catch(er => notice('Save nahi hua: ' + (er?.message || er))); });
// v2.105.4: malik — "ghee ka 4 carton majood, larka 100% mein 10 likhe to wahin aaye abhi kitna % — auto chala jaye": likhte hi hisaab (rk100Prev);
//   keyboard band (change) / ✓ abhi dukan = 100% / 🔒 Lock par KHUD save; phir item dekhne wale ke % (apna ya malik ka) se list mein — ya baad mein.
//   change thora ruk kar (220 ms) — Lock / doosre button ka tap pehle chale; har id ka seq: purani der wali save naye hukum ke baad nahi chalti.
function rk100Prev(id, ss, pk, full, gs) {
  ss = Number(ss) || 0; pk = Number(pk) || 0; full = Number(full) || 0;
  if (!(full > 0)) return '<i>🧺 Rack poora bhara ho to dukan mein kitna — likhein, % khud ban jayega</i>';
  const Q = v => pk ? `${num(r3(v / pk))} ctn` : `${num(r3(v))} pcs`, pct = Math.max(0, Math.round(ss / full * 100)), cf = rackCfg(id) || {}, own = RK_PCTS.includes(Number(cf.pct)), pc = own ? Number(cf.pct) : rackPct();
  if (ss >= full) return `<b>${Q(full)} = 100%</b> · abhi ${Q(ss)}${ss > full ? ' — 100% se zyada' : ''} · <em class="ok">rack poora ✓</em>`;
  const head = `<b>${Q(full)} = 100%</b> · abhi ${Q(ss)} = <b>${pct}% bacha</b> (${100 - pct}% khali)`;
  const lao = pk ? Math.floor((full - ss) / pk) * pk : r3(full - ss), who = own ? 'is item ka' : 'aap ka';
  if ((Number(gs) || 0) < (pk || 1)) return head + ' · <em>⚠️ godam mein poora carton nahi</em>';
  if (!pc) return head + (lao > 0 ? ` · 100% tak <b>${rkQty(lao, pk)}</b>` : '');
  if (pct > pc) return head + ` · <em>⏳ ${who} ${pc}% — ${Q(Math.floor(full * pc / 100))} reh jaye to khud list mein</em>`;
  return head + (lao > 0 ? ` · <em class="ok">✓ ${who} ${pc}% — list mein</em> → <b>${rkQty(lao, pk)} lao</b>` : ' · <em>rack mein 1 carton ki jagah nahi</em>');
}
const rk100Seq = new Map();
function rk100Info(id) { const i = document.querySelector(`[data-rk-100="${CSS.escape(id)}"]`), [ss, pk, gs] = String(i?.getAttribute('data-rk-100i') || '0|0|0').split('|').map(Number); return { i, ss: ss || 0, pk: pk || 0, gs: gs || 0 }; }
function rk100Paint(id) { const { i, ss, pk, gs } = rk100Info(id), v = Number(i?.value) || 0, el = document.querySelector(`[data-rk-100p="${CSS.escape(id)}"]`); if (el) el.innerHTML = rk100Prev(id, ss, pk, v > 0 ? Math.round(v * (pk || 1)) : 0, gs); }
function rk100Commit(id, raw, f, loud) {   // f = rk100Info (us waqt ka) · loud = Lock dabaya (khali / pehle se save par bhi batao)
  const v = Number(raw) || 0; if (!(v > 0)) { if (loud) notice('100% likhein'); return; }
  const pcs = Math.round(v * (f.pk || 1)), msg = String(rk100Prev(id, f.ss, f.pk, pcs, f.gs)).replace(/<[^>]+>/g, '');
  if (pcs === rackBOf(id)) { if (loud) notice('🔒 Lock ✓ · ' + msg); return; }
  rk.sel.delete(id);
  rack100Save(id, pcs).then(() => notice('🔒 Lock ✓ · ' + msg)).catch(er => notice('Save nahi hua: ' + (er?.message || er)));
}
const rk100Bump = id => { const n = (rk100Seq.get(id) || 0) + 1; rk100Seq.set(id, n); return n; };
document.addEventListener('input', e => { const id = e.target.getAttribute?.('data-rk-100'); if (id && rk) rk100Paint(id); });
document.addEventListener('change', e => { const t = e.target; if (!rk) return; const id = t.getAttribute?.('data-rk-100');
  if (id) { const f = rk100Info(id), raw = t.value, n = rk100Bump(id); setTimeout(() => { if (rk && rk100Seq.get(id) === n) rk100Commit(id, raw, f, false); }, 220); return; }
  const nw = t.getAttribute?.('data-rk-100now'); if (!nw || !t.checked) return; const [nid, v] = nw.split('|'), f = rk100Info(nid); if (!f.i) return; f.i.value = v; rk100Paint(nid); rk100Bump(nid); rk100Commit(nid, v, f, true); });
document.addEventListener('click', e => { const b = e.target.closest?.('[data-rk-100sv]'); if (!b || !rk) return; const id = b.getAttribute('data-rk-100sv').split('|')[0], f = rk100Info(id); rk100Bump(id); rk100Commit(id, f.i?.value, f, true); });
// v2.105.3: malik — "search kar ke line mein liya, ab hatane ka button nahi": ➕ khud ke saath ✕ hatao (sirf is khirki ki line se — mulazim bhi)
document.addEventListener('click', e => { const b = e.target.closest?.('[data-rk-unadd]'); if (!b || !rk || !b.closest('#rkBody')) return; e.preventDefault(); const v = b.dataset.rkUnadd, isPk = v.startsWith('p:'), id = isPk ? v.slice(2) : v;
  if (isPk) rk.pkx?.delete(id); else rk.extra.delete(id); rk.sel.delete(id); rkPaint(); notice('✕ Line se hata diya'); });
// v2.103.85: 🖨 TRANSFER CHECK se dobara — note / barcode / dono (TN card) + ek item ka 🏷 (aane wala maal). 20+ label = pehle "Pakka?"
const tcLbLine = l => ({ itemId: l.itemId, name: l.name, pack: Number(l.pack) || 0, ctn: 0, pcs: Number(l.qty) || 0, ...(Array.isArray(l.pk) && l.pk.length ? { pk: l.pk } : {}) });
async function tcLabels(lines, why) { const n = rkLbCount(lines); if (!n) { notice('🏷 Koi barcode nahi mila'); return; } if (n > 20 && !confirm(`${num(n)} barcode label chhapein? Pakka?`)) return; await rkLabelsGo(lines, why); }
function tcNotePrint(t) { if (!cloud?.requestPrint) { notice('App update karein'); return; } const job = (trList || []).find(j => String(j.transferId) === String(t.transferId) && j.status === 'done' && j.op !== 'delete');
  cloud.requestPrint({ kind: 'transfer', id: job ? job.id : 'pos:' + t.transferId, reason: 'Transfer check — dobara', copies: 1 }).then(() => notice('🖨 TN ' + (t.transferNo || t.transferId) + ' dobara print — PC ko bheja')).catch(er => notice('⚠️ ' + (er?.message || er))); }
document.addEventListener('click', async e => { const b = e.target.closest?.('[data-tc-rp],[data-tc-lb1]'); if (!b) return; e.preventDefault(); e.stopPropagation();
  if (b.dataset.tcRp) { const [k, w] = b.dataset.tcRp.split('|'), t = tcAll().find(x => tcKey(x) === k); if (!t) return; if (w === 'note' || w === 'both') tcNotePrint(t); if (w === 'lb' || w === 'both') await tcLabels((t.lines || []).map(tcLbLine), '(TN ' + (t.transferNo || t.transferId) + ')'); return; }
  const [k, i] = b.dataset.tcLb1.split('|'), t = tcAll().find(x => tcKey(x) === k), l = t?.lines?.[Number(i)]; if (!l) return; await tcLabels([tcLbLine(l)], '(' + l.name + ')'); }, true);
// v2.103.51: Mangwao / kahin bhi se item band — stock screen wala password (stockConfig.bandPw, default 7183), phir wahi confirm; band hote hi rack/mangwao list se hat jata hai
document.addEventListener('click', e => { const b = e.target.closest?.('[data-ro-bretry]'); if (!b) return; e.preventDefault(); if (!cloud?.bandRetry) { notice('App update karein'); return; } b.disabled = true; cloud.bandRetry(b.dataset.roBretry).then(() => notice('🔁 PC dobara koshish karega (PC on ho)')).catch(er => { b.disabled = false; notice('⚠️ ' + (er?.message || er)); }); });   // v2.103.63: ❌ fail → dobara (stock screen + mangwao dono)
async function bandAsk(id, on) { if (!canBand()) return false; const pw = await bandPwCheck((on ? 'Item BAND karne' : 'Item dobara CHALU karne') + ' ka password:'); if (pw == null) return false;
  const box = { checked: on, disabled: false }; await toggleHidden(id, on, box, pw); if (rk) rkPaint(); return box.checked === on; }
// v2.103.55: supplier ke sab (is list ke) items ek saath band — password + "Pakka?" (N items)
async function bandAllAsk(k) { if (!canBand() || !cloud?.setStockHidden) return; const ys = roList().filter(r => (r.party || 'Supplier nahi pata') === k && !hidden[r.id]); if (!ys.length) { notice('Koi item nahi'); return; }
  const got = await bandPwCheck(`"${k}" ke ${ys.length} items BAND karne ka password:`); if (got == null) return;
  if (!confirm(`"${k}" ke ${ys.length} items BAND karein? Pakka?\n\n${ys.slice(0, 12).map(r => '• ' + r.x.n).join('\n')}${ys.length > 12 ? '\n…' : ''}\n\nPC par POS mein stock 0 + INACTIVE (PC on hote hi).`)) return;
  const next = { ...hidden }; for (const r of ys) { next[r.id] = true; bdNmPut(r.id, r.x?.n, r.x?.c); } try { if (!(await bandWrite(Object.fromEntries(ys.map(r => [String(r.id), true])), got))) return; hidden = next; notice(`⛔ ${ys.length} items band — Stock par "⛔ Band items" mein · PC on hote hi khud bill + deactive`); try { rerender(); } catch {} if (rk) rkPaint(); } catch (e) { notice('⚠️ ' + (e?.message || e)); } }
document.addEventListener('input', e => { const t = e.target; if (!rk || !t.dataset?.roPq || !t.closest?.('#rkBody')) return; rk.roPq = t.value; const box = t.closest('#rkBody')?.querySelector('.rk-sup'); if (!box) return;   // sirf chips dobara (search box ka focus na toote)
  const tmp = document.createElement('div'); tmp.innerHTML = roHTML(collect().names); const nb = tmp.querySelector('.rk-sup'); if (nb) box.replaceWith(nb); });
document.addEventListener('click', e => { const t = e.target.closest?.('[data-ro-f],[data-ro-p],[data-ro-all],[data-ro-go],[data-ro-e],[data-ro-ban],[data-ro-banall],[data-ro-unban],[data-ro-tsv],[data-ro-tdel]'); if (!t || !rk || !t.closest('#rkBody')) return; const d = t.dataset;
  if (d.roP != null) { rk.roP = d.roP; try { localStorage.setItem('sam-ro-p', rk.roP); } catch {} rkPaint(); return; }
  if (d.roF != null) { rk.roF = /^\d+$/.test(d.roF) ? Number(d.roF) : d.roF; try { localStorage.setItem('sam-ro-f', String(rk.roF)); } catch {} rkPaint(); return; }
  if (d.roAll != null) { const ids = roList().filter(r => (r.party || 'Supplier nahi pata') === d.roAll).map(r => r.id), cur = rkPick('o' + d.roAll, ids); rk.man.set('o' + d.roAll, cur.size === ids.length ? new Set() : new Set(ids)); rkPaint(); return; }
  if (d.roGo != null) { roGo(d.roGo); return; }
  if (d.roE) { rk.roEd = rk.roEd === d.roE ? '' : d.roE; rkPaint(); return; }
  if (d.roBan) { bandAsk(d.roBan, true); return; }   // v2.103.51: 🚫 Band — wahi password jo stock screen par
  if (d.roUnban) { bandAsk(d.roUnban, false); return; }
  if (d.roBanall != null) { bandAllAsk(d.roBanall); return; }   // v2.103.55: ⛔ supplier ke sab items
  if (d.roTsv || d.roTdel) { const id = d.roTsv || d.roTdel; if (!cloud?.setReorderCfg) return; const v = d.roTdel ? null : { t: Number(document.querySelector(`[data-ro-tv="${CSS.escape(id)}"]`)?.value) || 0, p: String(document.querySelector(`[data-ro-pv="${CSS.escape(id)}"]`)?.value || '').trim().slice(0, 60) }; if (v && !(v.t > 0) && !v.p) { notice('Poora ya supplier likhein'); return; }
    itemCfg = { ...(itemCfg || {}), reorder: { ...(itemCfg?.reorder || {}), [id]: v } }; rk.roEd = ''; rk.roQ.delete(id); rkPaint(); cloud.setReorderCfg(id, v).then(() => notice(v ? '✓ Save' : '↺ Khud')).catch(er => notice('Save nahi hua: ' + (er?.message || er))); return; } });
document.addEventListener('change', e => { const t = e.target; if (!rk || !t.closest?.('#rkBody')) return; const d = t.dataset;
  if (d.roT) { const r = roRows().find(x => x.id === d.roT), k = r ? (r.party || 'Supplier nahi pata') : ''; if (!r) return; rkToggle('o' + k, roList().filter(y => (y.party || 'Supplier nahi pata') === k).map(y => y.id), d.roT, t.checked); rkPaint(); return; }
  if (d.roQty) { rk.roQ.set(d.roQty, Math.max(0, Math.round(Number(t.value) || 0))); rkPaint(); } });
document.addEventListener('input', e => { const t = e.target; if (rk && t?.dataset?.roQ != null) { rk.roQs = t.value || ''; clearTimeout(rk.roT); rk.roT = setTimeout(() => rkPaint(), 160); } });
const rkIsRackJob = j => j && j.status === 'done' && j.op === 'create' && /^(🧺|📦)/.test(String(j.note || '')) && (j.lines || []).length;
function rkDoneIds(j) { const S = new Set((rackDone?.jobs?.[j.id]?.ids || []).map(String)); if (!S.size || S.size < (j.lines || []).length) { const c = tcChecks.get('T' + String(j.transferId)); if (c?.status === 'ok') for (const l of j.lines || []) S.add(String(l.itemId)); } return S; }
function rkPend() { const g = rk?.g || 0; return (trList || []).filter(rkIsRackJob).map(j => { const done = rkDoneIds(j), lines = (j.lines || []).filter(l => !done.has(String(l.itemId))); return { j, lines, done, n: (j.lines || []).length }; }).filter(x => x.lines.length && (!g || Number(x.j.from) === g)).sort((a, b) => b.j.at - a.j.at); }
// v2.103.87: 🚚 RASTE MEIN — rack note nikla (48 ghante andar), Transfer check / larke ka ✓ abhi nahi → item par chip, default ☐, neeche; ➕ Naya / 🖨 Reprint
function rkTransit() { const M = new Map(), lim = Date.now() - 48 * 3600e3; for (const j of trList || []) { if (!rkIsRackJob(j) || (Number(j.doneAt) || Number(j.at) || 0) < lim) continue; const done = rkDoneIds(j); for (const l of j.lines) { const id = String(l.itemId); if (done.has(id)) continue; const o = M.get(id); if (!o || (o.j.at || 0) < (j.at || 0)) M.set(id, { j, tn: String(j.transferNo || '').replace(/^0+/, ''), at: Number(j.doneAt) || Number(j.at) || 0 }); } } return M; }
const rkAgo = at => { const m = Math.max(0, Math.round((Date.now() - at) / 60000)); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' ghante' + (m % 60 ? ' ' + (m % 60) + ' min' : ''); };
function rkTransitHTML(id) { const T = rkTransit().get(String(id)); if (!T) return ''; return `<div class="rk-trn"><span>🚚 <b>TN ${esc(T.tn)}</b> · ${rkAgo(T.at)} pehle nikla — <b>raste mein</b></span><button type="button" data-rk-tnew="${esc(String(id))}">➕ Naya note</button><button type="button" data-rk-trp="${esc(T.j.id)}">🖨 Reprint</button></div>`; }
function rkPendIds() { const S = new Set(); for (const j of trList || []) { if (!rkIsRackJob(j)) continue; const done = rkDoneIds(j); for (const l of j.lines) if (!done.has(String(l.itemId))) S.add(String(l.itemId)); } return S; }
const rkLineQ = l => Array.isArray(l.pk) && l.pk.length ? l.pk.map(p => `${p.nm}×${num(p.n)}`).join(' · ') : Number(l.pack) > 1 && (l.ctn || l.pcs) ? `${num(l.ctn || 0)} ${l.cName || 'Ctn'}${l.pcs ? ' + ' + num(l.pcs) + ' ' + (l.uName || 'Pcs') : ''}` : `${num(l.qty)} ${l.uName || 'Pcs'}`;
function rkDt(jid) { if (!rk.dt.has(jid)) rk.dt.set(jid, new Set()); return rk.dt.get(jid); }
function rkPendHTML(names) { const L = rkPend(); if (!L.length) return '';
  return `<section class="rk-g rk-pend"><div class="rk-gh"><b>⏳ Patti nikli — rack bhar gaya? (${num(L.reduce((t, x) => t + x.lines.length, 0))})</b></div><p class="rk-note">Larka shop par dekh kar ☑ kare → "✓ rack bhar diye". Maal na aaya ho to 🖨 naya note. Jab tak ✓ nahi, item neeche list mein nahi aayega.</p>
    ${L.map(({ j, lines, n }) => { const jid = String(j.id), T = rkDt(jid), on = l => T.has(String(l.itemId)), k = lines.filter(on).length, ago = Math.max(0, Math.round((Date.now() - (j.at || 0)) / 60000)), pk = /^📦/.test(String(j.note || ''));
      return `<div class="rk-pj"><div class="rk-pjh"><span><b>${pk ? '📦' : '🧺'} TN ${esc(String(j.transferNo || '').replace(/^0+/, ''))}</b><small>${ago < 60 ? ago + ' min' : Math.round(ago / 60) + ' ghante'} pehle · ${esc(branchName(Number(j.from), names))} ➜ ${esc(branchName(Number(j.to), names))}${n > lines.length ? ` · ✓ ${num(n - lines.length)}/${num(n)} ho gaye` : ''}</small></span>
          <span class="rk-pb"><button type="button" class="rk-ag" data-rkd-prn="${esc(jid)}" title="Note dobara print">🖨</button><button type="button" class="rk-ag" data-rkd-tc="${esc(jid)}" title="Stock aaya — check">🧾 Check</button><button type="button" class="rk-ag" data-rkd-lb="${esc(jid)}" title="Barcode label">🏷</button><button type="button" class="rk-all" data-rkd-all="${esc(jid)}">${k === lines.length ? '☐ koi nahi' : '☑ sab'}</button></span></div>
        <div class="rk-bc">▌▌▌ ${esc(String(j.transferNo || ''))} <i class="rk-c pc">✓ ${num(k)}/${num(lines.length)}</i></div>
        ${lines.map(l => `<label class="rk-pli${on(l) ? ' is-in' : ''}"><input type="checkbox" data-rkd-t="${esc(jid)}|${esc(String(l.itemId))}"${on(l) ? ' checked' : ''}><span><b>${esc(l.name)}</b><small>${esc(rkLineQ(l))}</small></span></label>`).join('')}
        <div class="rk-pb rk-pbb"><button type="button" class="rk-sv" data-rkd-ok="${esc(jid)}"${k && !rk.busy ? '' : ' disabled'}>✓ ${num(k)} rack bhar diye</button><button type="button" class="rk-ag" data-rkd-again="${esc(jid)}"${lines.length - k && !rk.busy ? '' : ' disabled'}>${rk.busy === 'd' + jid ? '⏳' : `🖨 Naya note — baqi ${num(lines.length - k)}`}</button></div></div>`; }).join('')}</section>`; }
async function rkDoneSave(j, ids, msg) { if (!cloud?.setRackDone) { notice('App update karein'); return false; } const all = [...new Set([...(rackDone?.jobs?.[j.id]?.ids || []).map(String), ...ids])];
  rackDone = { ...(rackDone || {}), jobs: { ...(rackDone?.jobs || {}), [j.id]: { ids: all, at: Date.now() } } }; rk.dt.delete(String(j.id)); rkPaint();
  try { await cloud.setRackDone(j.id, all); if (msg) notice(msg); return true; } catch (e) { notice('Save nahi hua: ' + (e?.message || e)); return false; } }
async function rkAgain(j, lines) { if (!rk || rk.busy) return; const L = lines.map(l => ({ id: String(l.itemId), name: l.name, ctn: Number(l.ctn) || 0, pcs: Number(l.pcs) || 0, ...(Array.isArray(l.pk) && l.pk.length ? { pk: l.pk } : {}) }));
  rk.busy = 'd' + j.id; rkPaint();
  try { const r = await stockAgentTransfer({ from: Number(j.from), to: Number(j.to) || 1, lines: L, note: (/^📦/.test(String(j.note || '')) ? '📦 Packet rack bharo' : '🧺 Rack bharo') + ' (dobara)' });
    if (r?.ok || r?.pending) { await rkDoneSave(j, L.map(l => l.id), null); notice(r.ok ? `🖨 Naya note ${r.no ? '#' + r.no + ' ' : ''}— ${L.length} items (purana ✓)` : '⏳ ' + r.why); } else notice('⚠️ Nahi bana: ' + (r?.why || 'masla'));
  } catch (e) { notice('⚠️ ' + (e?.message || e)); }
  if (rk) { rk.busy = ''; rkPaint(); } }
document.addEventListener('click', e => { const t = e.target.closest?.('[data-rkd-all],[data-rkd-ok],[data-rkd-again],[data-rkd-prn],[data-rkd-tc],[data-rkd-lb]'); if (!t || !rk || !t.closest('#rkBody')) return; const d = t.dataset;
  const jid = d.rkdAll || d.rkdOk || d.rkdAgain || d.rkdPrn || d.rkdTc || d.rkdLb, x = rkPend().find(y => String(y.j.id) === jid); if (!x) return; const T = rkDt(jid);
  if (d.rkdAll) { if (T.size === x.lines.length) T.clear(); else for (const l of x.lines) T.add(String(l.itemId)); rkPaint(); return; }
  if (!canDoRk()) { notice('Ijazat nahi'); return; }
  if (d.rkdOk) { const ids = x.lines.filter(l => T.has(String(l.itemId))).map(l => String(l.itemId)); if (!ids.length) return; rkDoneSave(x.j, ids, `✓ ${ids.length} rack bhar diye`); return; }
  if (d.rkdAgain) { rkAgain(x.j, x.lines.filter(l => !T.has(String(l.itemId)))); return; }
  if (d.rkdPrn) { if (!cloud?.requestPrint) return; cloud.requestPrint({ kind: 'transfer', id: x.j.id, reason: 'Rack bharo — dobara', copies: 1 }).then(() => notice('🖨 Note dobara print — PC ko bheja')).catch(er => notice(er?.message || 'Nahi hua')); return; }
  if (d.rkdTc) { openTransferCheck('scan'); tcLookup(String(x.j.transferNo || '')); return; }
  if (d.rkdLb) { const n = rkLbCount(x.j.lines); if (!n) { notice('🏷 Koi barcode nahi mila'); return; } if (!confirm(`TN ${String(x.j.transferNo || '').replace(/^0+/, '')} — ${n} barcode label chhapein?`)) return; rkLabelsGo(x.j.lines, 'dobara'); return; } });
document.addEventListener('change', e => { const t = e.target; if (!rk || !t.matches?.('[data-rkd-t]')) return; const [jid, id] = t.dataset.rkdT.split('|'), T = rkDt(jid); if (t.checked) T.add(id); else T.delete(id); rkPaint(); });
document.addEventListener('toggle', e => { if (rk && e.target?.matches?.('.rk-set')) rk.setOpen = e.target.open; }, true);   // v2.103.38: ⚙️ qaide khula rahe
// godam chips: default naam "Godam 1" (number se nahi) · localStorage
function rkGDefault() { const { names, branches } = collect(); const G = (branches || []).filter(b => b !== 1); return G.find(b => /godam\s*1/i.test(String(names?.[b] || ''))) ?? G[0] ?? 0; }
function rackOpen() {
  rackWatch(); start(false); rk = { q: '', sel: new Map(), off: new Set(), ed: '', busy: '', pOff: new Set(), pQ: new Map(), pset: false, pq: '', pEd: '', pDraft: new Map(), pg: Number(localStorage.getItem('sam-rk-pg')) || 0, zAll: false, sab: (() => { try { return localStorage.getItem('sam-rk-sab') === '1'; } catch { return false; } })(), lbAll: (() => { try { return localStorage.getItem('sam-rk-lball') !== '0'; } catch { return true; } })(), x2: '', dirty: false, man: new Map(), n: rkNGet(), extra: new Map(), plOpen: false, plq: '', plEd: '', plDr: new Map(), pkNew: new Map(), dt: new Map(), g: 0, tab: 'lane', lbOff: new Set(), lbOn: new Set(), roF: (v => /^\d+$/.test(v) ? Number(v) : v || 'all')(localStorage.getItem('sam-ro-f')), roQ: new Map(), roQs: '', roEd: '', roP: localStorage.getItem('sam-ro-p') || '', roPq: '' };   // roP = supplier chip (v2.103.53) · lbOff = packet (default label ✓) · lbOn = carton (default ✗)
  { const v = Number(localStorage.getItem('sam-rk-g')); rk.g = v >= 0 && (v === 0 || collect().branches.includes(v)) && localStorage.getItem('sam-rk-g') != null ? v : rkGDefault(); } setTimeout(rkRecent, 0);   // v2.103.37: godam chip
  if (!trStop && cloud?.listenTransfers) trStop = cloud.listenTransfers(trGot);
  if (!rackDoneStop && cloud?.listenRackDone) rackDoneStop = cloud.listenRackDone(d => { rackDone = d || {}; if (rk && $('rkBody')) rkPaint(); }); tcStart();
  if (!roDmStop && cloud?.listenDemands) roDmStop = cloud.listenDemands(l => { roDm = l || []; if (rk && $('rkBody')) rkPaint(); });   // v2.103.45
  const d = $('dialog'); if (!d) return; d.classList.remove('search-dialog'); d.classList.add('full-dialog'); $('dialogTitle').textContent = '🧺 Rack bharo';   // v2.119.0: chhota (malik: faltu likhai nahi)
  $('dialogBody').innerHTML = '<div class="rk-root" id="rkBody"></div>'; if (!d.open) d.showModal(); rkPaint();
}
// v2.103.88: ⚡ 🛒 Mangwao ka bhari data (posStats/reorder) sirf jab Mangwao tab khula ho; khirki band = listener band
function roWatch() { if (!roStop && cloud?.listenReorder) { roStop = () => {}; const st = cloud.listenReorder(d => { ro = d || { rows: [], at: 0 }; if (rk && $('rkBody')) rkPaint(); }); if (roStop) roStop = st; else try { st(); } catch {} } }
function rkUnwatch() { if (roStop) { try { roStop(); } catch {} roStop = null; } }
// v2.105.2: malik — "chips andar (⋮), neeche ka kaam nazar aaye": phone par khirki ke chips upar ke ⋮ mein, screen par sirf yeh chhoti patti (kya chuna hai)
function rkPillHTML(names) {   // v2.119.0: tab ka naam bhi (tabs ⋮ mein) · Qaida "0–X%"
  const p = [{ lane: '🧺 Lane wale', pct: '📋 Packet %', ro: '🛒 Mangwao' }[rk.tab] || '🧺 Lane wale', rk.g ? '🏬 ' + branchName(rk.g, names) : '🏬 Sab godam'];
  if (rk.tab === 'lane') { const pc = rackPct(), lo = rackLo(), mp = rkMine('pct') != null, ml = rkMine('lo') != null; p.push(mp ? `👤 0–${pc ? pc + '%' : 'Sab'}` : pc ? `📊 0–${pc}%` : '📊 % shart nahi', ...(lo || ml ? [`${ml ? '👤' : '📉'} ${rkHdName(lo)}`] : [])); }   // v2.105.4: mulazim ka apna (sirf us ka phone)
  if (rk.tab === 'pct') { const A = pkAllRows(), n = A.filter(x => Math.abs(x.far) > 0.0005).length; p.push(rk.plFar ? `⚖️ Farq wale ${num(n)}` : `📋 Sab ${num(A.length)}${n ? ` · ⚖️ ${num(n)} farq` : ''}`); }
  else if (rk.tab === 'ro') { const f = rk.roF; p.push(f === 'all' ? '📊 Sab %' : f === 'dm' ? '📢 Demand' : `📊 ${num(f)}% reh gaya`, '🏭 ' + (rk.roP || 'Sab supplier')); }
  return `<button type="button" class="rk-pill" data-mn-sheet="1"><span>${esc(p.join(' · '))}</span><i>⋮ badlein</i></button>`;
}
// ================= v2.119.0: 🧺 RACK BHARO — NAYA SAAF SCREEN. Malik: "search upar · baqi faltu cheezein nahi · Lane wale / Packet % / Mangwao ⋮ ke andar ·
//   ek screen par 10 items · upar ek tick — sab items (kam zyada sab) aa jayein, larka khud tadad bhar kar mangwaye · jo nahi mangwana us par 0 · Enter =
//   agla item (keyboard ka kaam kam) · ek click par print + barcode". Har item = ek patli line (naam + chhoti line + tadad); naam par tap = purane tools
//   (🏷 · 🚚 · 🔒 100% · ✏️ · 🚫). Tadad > 0 = patti mein (✓ tick / 5-5 patti nahi). 🖨 Print = har godam ka EK transfer note (aam + packet lines saath,
//   note '🧺 Rack bharo') + barcode. CAP stock.racksab ("☐ Sab items" — us godam ke sab items, zaroorat wale upar tadad bhari, baqi par 0).
const rkSabOk = () => isOwner() || can('stock.racksab');
const rkSabOn = () => !!(rk && rk.sab && rkSabOk());
const rkTr = () => rk?._tr || rkTransit();   // 🚚 raste wale (har paint par ek dafa)
const rkVal = y => { const id = String(y.x.i); return rk.sel.has(id) ? rk.sel.get(id) : (y.sab || rkTr().has(id) ? 0 : y.c.q); };   // aam item ki tadad (pcs) · 🚚 raste / Sab wale = 0 se
const rkpWant = (y, p) => { const k = String(y.r.i) + '|' + p.z; return Math.max(0, Math.floor(rk?.pQ?.has(k) ? rk.pQ.get(k) : (y.sab || (rk && rkTr().has(String(y.r.i))) ? 0 : p.a))); };
function pkSabEntry(id) {   // ☐ Sab items: packet item jo abhi hadd tak nahi — har packet 0 se (godam: upar chuna, warna set wala, warna sab se zyada maal wala)
  const cf = pkCfg(id); if (!cf) return null;
  const P = agPool(), it0 = P.byId.get(String(id)), sI = saleStockItem(1, String(id)), r0 = (rackPk || []).find(z => String(z.i) === String(id));
  const r = r0 ? { ...r0 } : { i: id, n: it0?.name || 'Item ' + id, g: Number(cf.g) || 0, gs: 0, ss: 0, sold: {}, from: 0, kh: 0 }; r.ss = sI ? Number(sI.stock) || 0 : Number(r.ss) || 0;
  const gods = collect().branches.filter(b => b !== 1), st = g => { const s = saleStockItem(Number(g), String(id)); return s ? Number(s.stock) || 0 : (Number(g) === Number(r.g) ? Number(r.gs) || 0 : 0); };
  let g = rk?.g || 0; if (!g) { const c0 = Number(cf.g || r.g) || 0; g = st(c0) > 0 ? c0 : (gods.map(b => [b, st(b)]).sort((a, b) => b[1] - a[1]).find(x => x[1] > 0)?.[0] || c0); }
  const it = sI || it0, packs = Object.entries(cf.p || {}).map(([z, o]) => { const zz = Number(z), L = pkLeft(o, r, z, cf.at); return { z: zz, sold: Number(r.sold?.[z] ?? r.sold?.[String(zz)]) || 0, n: Math.max(1, Number(o?.n) || 10), a: 0, b: Number(o?.b) || 0, pct: pkQ(), left: L ? L.left : null, due: false, lao: 0, name: pkName(zz, it) }; }).filter(p => p.z > 0).sort((a, b) => b.z - a.z);
  return packs.length ? { r, cf, it, g, gs: st(g), packs, sab: 1, name: r.n || it?.name || 'Item ' + id } : null;
}
function rkLaneRows() {   // { N: aam items, P: packet items } — pehle zaroorat wale (tadad bhari), phir ☐ Sab items ke baqi (0 se)
  const inG = g => !rk.g || Number(g) === rk.g, N = rackDue().filter(y => inG(y.x.g)), P = pkDue().filter(y => inG(y.g));
  if (rkSabOn()) {
    const have = new Set([...N.map(y => String(y.x.i)), ...P.map(y => String(y.r.i))]);
    for (const y of P) { const it = y.it; for (const [z] of Object.entries(y.cf?.p || {})) { const zz = Number(z); if (zz > 0 && !y.packs.some(p => Math.abs(p.z - zz) < 1e-9)) y.packs.push({ z: zz, sold: 0, n: 1, a: 0, b: 0, pct: pkQ(), left: null, due: false, lao: 0, name: pkName(zz, it), xtra: 1 }); } y.packs.sort((a, b) => b.z - a.z); }   // zaroorat wale ke baqi packet bhi (0)
    for (const id of pkIds()) { if (have.has(id) || rackCfg(id)?.off) continue; const e = pkSabEntry(id); if (e && inG(e.g)) { P.push(e); have.add(id); } }
    const gods = rk.g ? [rk.g] : collect().branches.filter(b => b !== 1);
    for (const it of agPool().list) { const id = String(it.id); if (have.has(id) || pkCfg(id) || rackCfg(id)?.off) continue;
      if (!gods.some(g => (Number(saleStockItem(g, id)?.stock) || 0) > 0)) continue;
      const x = rkSynth(id); if (!x || !inG(x.g) || !(Number(x.gs) > 0)) continue; const xx = { ...x, add: 0, sab: 1 }; N.push({ x: xx, c: rackCalc(xx), sab: 1 }); have.add(id); }
  }
  return { N, P };
}
function rkCount(lane) { if (!lane) return 0; let n = 0;
  for (const y of lane.N) { const v = rkVal(y); if (y.c.pk ? Math.floor(v / y.c.pk) > 0 : v > 0) n++; }
  for (const y of lane.P) { const cq = pkQOf(y); if ([...cq.q.values()].some(v => v > 0)) n++; }
  return n; }
function rkToolsN(y) {   // naam par tap — purane sab tools (chips · tafseel · 🏷 · 🚚 · 🔒 100% · ✏️ qaida)
  const x = y.x, c = y.c, id = String(x.i), v = rkVal(y), ed = rk.ed === id, cf = rackCfg(id);
  return `<span class="rk-chips">${c.khali ? '<i class="rk-c kh">🔴 Rack khali</i>' : ''}${c.lo ? `<i class="rk-c lo">📉 Dukan mein ${num(r3(c.ss))} bache (hadd ${rkHdName(rackLo())})</i>` : ''}${c.add ? `<i class="rk-c own">➕ khud</i><button type="button" class="rk-c rk-unadd" data-rk-unadd="${esc(id)}">✕ hatao</button>` : ''}${c.pct != null && !c.khali ? `${c.bLock ? `<i class="rk-c ${c.pct <= 20 ? 'kh' : c.pct <= 40 ? 'lo' : 'pc'}">🔒 poora ${esc(rkQty(c.bLock, c.pk))} · abhi ${esc(rkQty(c.ss, c.pk))} (${c.pct}%) · lao ${esc(rkQty(c.q, c.pk))}</i>` : `<i class="rk-c ${c.pct <= 20 ? 'kh' : c.pct <= 40 ? 'lo' : 'pc'}">📊 ${c.pct}% bacha (${num(r3(c.full))} mein se ${num(r3(c.ss))})${c.pc ? ` → ${esc(rkQty(c.q, c.pk))} lao (100% tak)` : ''}</i>`}` : ''}${cf?.pct ? `<i class="rk-c own">📊 apna % ${num(cf.pct)}</i>` : ''}${c.P && !c.pk ? '<i class="rk-c pc">🔹 pcs wala</i>' : ''}${c.own ? '<i class="rk-c own">✏️ apna qaida</i>' : ''}</span>
    <small class="rk2-det">${y.sab ? '☐ Sab items se (abhi zaroorat ki list mein nahi)' : x.w ? `${esc(rkWhen(x.w))} ke transfer ke baad <b>${esc(rkQty(c.nik, 0))}</b> ${x.o || x.p ? `nikle (${[`${num(r3(Number(x.s) || 0))} bike`, x.o ? `${num(r3(x.o))} wapas godam` : '', x.p ? `− ${num(r3(x.p))} purchase aayi` : ''].filter(Boolean).join(' · ')})` : 'bike'}` : (x.lk ? '🔒 100% lock ke hisaab se (aakhri aamad ke baad bika nahi)' : 'transfer note nahi mila')}${c.P ? ` (1 ctn = ${num(c.P)})` : ''} · godam ${esc(rkQty(c.gs, c.pk))}${c.pk && c.gs % c.pk ? ' + ' + num(r3(c.gs % c.pk)) + ' pcs' : ''} · dukan ${num(c.ss)} pcs</small>${c.short ? `<em class="rk-warn">⚠️ ${esc(rkQty(c.want, c.pk))} chahiye — godam mein itna hi</em>` : ''}
    <div class="rk2-tl"><label class="rk-lb rk-lbc${rk.lbOn.has(id) ? ' is-in' : ''}"><input type="checkbox" data-rk-lb="${esc(id)}"${rk.lbOn.has(id) ? ' checked' : ''}><span>🏷 barcode label${rk.lbOn.has(id) ? ` × ${num(c.pk ? Math.floor(v / c.pk) * c.pk : v)}` : ''}</span></label>${isOwner() ? `<button type="button" class="rk-e" data-rk-e="${esc(id)}" aria-label="Qaida" title="Is item ka qaida">✏️</button>` : ''}</div>${rkTransitHTML(id)}
    ${isOwner() || can('stock.rack100') ? `<div class="rk-100"><span class="rk-100l">🔒 100% ${c.bOwn ? '<i class="rk-c own">lock</i>' : ''}</span><input type="number" inputmode="decimal" min="0" step="any" data-rk-100="${esc(id)}" data-rk-100i="${r3(c.ss)}|${c.pk || 0}|${r3(c.gs)}" value="${c.bLock ? (c.pk ? r3(c.bLock / c.pk) : r3(c.bLock)) : ''}" placeholder="likho"><small>${c.pk ? 'ctn' : 'pcs'}</small><label class="rk-100n"><input type="checkbox" data-rk-100now="${esc(id)}|${c.pk ? r3(c.ss / c.pk) : r3(c.ss)}"> abhi dukan (${c.pk ? num(r3(c.ss / c.pk)) + ' ctn' : num(r3(c.ss))}) = 100%</label><button type="button" class="rk-100s" data-rk-100sv="${esc(id)}|${c.pk || 1}">🔒 Lock</button>${(isOwner() ? c.bOwn : rackBOf(id) > 0) ? `<button type="button" class="rk-100x" data-rk-100x="${esc(id)}">↺ hatao</button>` : ''}<small class="rk-100p" data-rk-100p="${esc(id)}">${rk100Prev(id, c.ss, c.pk, c.bLock, c.gs)}</small></div>` : ''}
    ${ed ? `<div class="rk-ed"><div class="rk-mode">${c.P ? [['', 'Khud'], ['ctn', '📦 Carton'], ['pcs', '🔹 Pcs']].map(([k, l]) => `<button type="button" class="${(cf?.mode || '') === k ? 'is-in' : ''}" data-rk-md="${esc(id)}|${k}">${l}</button>`).join('') : ''}<button type="button" class="rk-off" data-rk-off="${esc(id)}">🚫 Sirf godam — rack par nahi</button></div><div class="rk-mode rk-ipc"><small>📊 Is item ka %</small>${[[0, 'Sab wala'], [10, '10%'], [20, '20%'], [30, '30%'], [40, '40%']].map(([v2, l]) => `<button type="button" class="${(Number(cf?.pct) || 0) === v2 ? 'is-in' : ''}" data-rk-pc="${esc(id)}|${v2}">${l}</button>`).join('')}</div><label>🧺 Rack poora (100%) — lock${c.bt ? ` <small>(18 Oct note ke baad: ${num(r3(Number(x.b0) || 0))})</small>` : ''}<input type="number" inputmode="numeric" min="0" step="1" data-rk-b="${esc(id)}" value="${rackBOf(id) || cf?.b || ''}" placeholder="${c.bLock ? num(r3(c.bLock)) : 'likhein'}"><small>pcs</small></label><label>Kitna bikne par lana<input type="number" inputmode="numeric" min="0" step="1" data-rk-u="${esc(id)}" value="${cf?.u || ''}" placeholder="${c.unit}"><small>pcs</small></label><label>Kitna lana<input type="number" inputmode="numeric" min="0" step="1" data-rk-w="${esc(id)}" value="${cf?.q || ''}" placeholder="khud"><small>pcs</small></label><button type="button" class="rk-sv" data-rk-sv="${esc(id)}">✓ Save</button>${cf ? `<button type="button" class="rk-au" data-rk-au="${esc(id)}">↺ Khud</button>` : ''}</div>` : ''}`;
}
function rkToolsP(y, cq) {   // packet item ke tools — har packet ka haal · 🏷 · godam jitna hi · 🚚 · 🚫
  const id = String(y.r.i), Q = pkQ();
  return `<span class="rk-chips">${y.packs.map(p => `<i class="rk-c ${p.b && p.left != null && p.left <= Math.floor(p.b * Q / 100) + 1e-9 ? 'kh' : 'pc'}">${esc(p.name)}: ${p.b && p.left != null ? `${num(p.left)} / ${num(p.b)} bache (${Math.round(p.left / p.b * 100)}%)` : p.xtra || !p.b ? '🧺 100% nahi likha' : `${num(p.sold)} bike`}</i>`).join('')}${y.force ? `<button type="button" class="rk-c rk-unadd" data-rk-unadd="p:${esc(id)}">✕ hatao</button>` : ''}</span>
    <div class="rk2-tl"><label class="rk-lb${rk.lbOff.has(id) ? '' : ' is-in'}"><input type="checkbox" data-rkp-lb="${esc(id)}"${rk.lbOff.has(id) ? '' : ' checked'}><span>🏷 barcode label bhi</span></label>${cq.short ? `<label class="rk-lb rk-cap${pkCapOn(id) ? ' is-in' : ''}"><input type="checkbox" data-rkp-cap="${esc(id)}"${pkCapOn(id) ? ' checked' : ''}><span>🏬 godam jitna hi (godam ${num(r3(cq.gs))} · chahiye ${num(r3(cq.need))})</span></label>` : ''}${isOwner() ? `<button type="button" class="rk-e rk-ban" data-rk-off="${esc(id)}" title="Nahi lana — rack list se hatao">🚫 Nahi lana</button>` : ''}</div>${rkTransitHTML(id)}`;
}
function rkRowN(y) {
  const x = y.x, c = y.c, id = String(x.i), v = rkVal(y), open = rk.x2 === 'r:' + id, T = rkTr().has(id);
  const tag = c.khali ? '🔴 khali' : c.lo ? '📉 kam' : c.pct != null ? `📊 ${c.pct}%` : '';
  const info = [tag, `godam ${rkQty(c.gs, c.pk)}`, `dukan ${num(r3(c.ss))}`, T ? '🚚 raste' : '', c.add ? '➕ khud' : ''].filter(Boolean).join(' · ');
  return `<div class="rk2-r${v > 0 ? ' is-in' : ''}${c.khali ? ' kh' : ''}${open ? ' open' : ''}${y.sab ? ' sab' : ''}"><button type="button" class="rk2-n" data-rk2-x="r:${esc(id)}"><b>${esc(x.n)}</b><small>${esc(info)}</small></button><label class="rk2-q"><input type="number" inputmode="numeric" enterkeyhint="next" min="0" step="1" data-rk-qty="${esc(id)}" value="${c.pk ? Math.floor(v / c.pk) : v}"${c.gs > 0 ? '' : ' disabled'}><small>${c.pk ? 'ctn' : 'pcs'}</small></label>${open ? `<div class="rk2-tools">${rkToolsN(y)}</div>` : ''}</div>`;
}
function rkRowP(y) {   // packet item: 1 packet = aam line jaisa (packet ka naam chhoti line mein) · kai packet = doosri line mein [250 gm 0/6 ⌷] [125 gm ⌷]
  const id = String(y.r.i), open = rk.x2 === 'p:' + id, T = rkTr().has(id), cq = pkQOf(y), on = [...cq.q.values()].some(n => n > 0), dis = !(Number(y.gs) > 0), one = y.packs.length === 1;
  const pl = p => `${p.name}${p.b && p.left != null ? ` ${num(p.left)}/${num(p.b)}` : ''}`, inp = p => `<input type="number" inputmode="numeric" enterkeyhint="next" min="0" step="1" data-rkp-q="${esc(id + '|' + p.z)}" value="${cq.q.get(p.z) ?? 0}"${dis ? ' disabled' : ''}>`;
  const info = [one ? '📦 ' + pl(y.packs[0]) : '', `godam ${num(r3(Number(y.gs) || 0))}`, `dukan ${num(r3(Number(y.r.ss) || 0))}`, y.r.kh ? `khula ${num(y.r.kh)}` : '', T ? '🚚 raste' : '', y.force ? '➕ khud' : ''].filter(Boolean).join(' · ');
  return `<div class="rk2-r rk2-p${on ? ' is-in' : ''}${one ? '' : ' multi'}${open ? ' open' : ''}${y.sab ? ' sab' : ''}"><button type="button" class="rk2-n" data-rk2-x="p:${esc(id)}"><b>${one ? '' : '📦 '}${esc(y.name)}</b><small>${esc(info)}</small></button>${one ? `<label class="rk2-q">${inp(y.packs[0])}<small>pkt</small></label>` : `<div class="rk2-ps">${y.packs.map(p => `<label class="rk2-q rk2-qp"><small>${esc(pl(p))}</small>${inp(p)}</label>`).join('')}</div>`}${open ? `<div class="rk2-tools">${rkToolsP(y, cq)}</div>` : ''}</div>`;
}
function rkLaneHTML(names, lane) {
  const q = rk.q.trim(), mk = (y, k) => k === 'r' ? { y, k, id: String(y.x.i), name: y.x.n, g: Number(y.x.g) } : { y, k, id: String(y.r.i), name: y.name, g: Number(y.g) };
  let rows = [...lane.N.filter(y => !y.sab).map(y => mk(y, 'r')), ...lane.P.filter(y => !y.sab).map(y => mk(y, 'p'))];
  rows = rows.concat([...lane.N.filter(y => y.sab).map(y => mk(y, 'r')), ...lane.P.filter(y => y.sab).map(y => mk(y, 'p'))].sort((a, b) => String(a.name).localeCompare(String(b.name))));
  if (q) rows = smartSearch(rows, q, 400);
  const cap = q ? 400 : 300, shown = rows.slice(0, cap), G = new Map(); for (const r of shown) { const g = rk.g ? 0 : r.g; if (!G.has(g)) G.set(g, []); G.get(g).push(r); }
  const body = [...G].map(([g, rs]) => `${g ? `<div class="rk2-gh">🏬 ${esc(branchName(g, names))} ➜ ${esc(branchName(1, names))}</div>` : ''}${rs.map(r => r.k === 'r' ? rkRowN(r.y) : rkRowP(r.y)).join('')}`).join('');
  const why = q ? (() => { const inL = new Set(rows.map(r => r.id)), H = smartSearch(agPool().list.filter(it => !inL.has(String(it.id))), q, 6); if (!H.length) return '';
    return `<section class="rk-g rk-why"><div class="rk-gh"><b>🔍 Ye list mein kyun nahi?</b></div>${H.map(it => { const w = rkWhy(it.id); return `<div class="rk-wy"${w.can || w.any ? ` data-rk-add="${esc(String(it.id))}" role="button"` : ''}><span><b>${esc(it.name)}</b><i class="rk-c pc">${w.w}</i><small>📦 ${w.stk}</small></span>${w.can || w.any ? `<button type="button" class="rk-sv" data-rk-add="${esc(String(it.id))}">➕ Line mein lao</button>` : ''}</div>`; }).join('')}</section>`; })() : '';
  return `<div id="rkList" class="rk2-list">${body || (q ? `<p class="rk-note">"${esc(q)}" — list mein nahi${rkSabOk() && !rkSabOn() ? ' · "☐ Sab items" laga kar dekhein' : ''}</p>` : `<p class="rk2-empty">${rackAt || irData ? `✓ Abhi kuch lana nahi${rkSabOk() && !rkSabOn() ? ' — upar "☐ Sab items" se koi bhi item' : ''}` : '⏳ PC data aa raha hai (2–5 min)'}</p>`)}${rows.length > shown.length ? `<p class="rk-note">+${num(rows.length - shown.length)} aur — 🔍 upar search karein</p>` : ''}</div><div id="rkWhy">${why}</div>`;
}
function rkFootHTML(n) {
  return `<div class="rk2-foot" id="rkFoot"><label class="rk2-lb${rk.lbAll ? ' is-in' : ''}"><input type="checkbox" data-rk-lball="1"${rk.lbAll ? ' checked' : ''}><span>🏷 barcode</span></label><button type="button" class="rk-go rk2-go" data-rk-goall="1"${n && !rk.busy ? '' : ' disabled'}>${rk.busy ? '⏳ PC note bana raha hai…' : n ? `🖨 Print — ${num(n)} item${n === 1 ? '' : 's'}` : '🖨 Print — tadad likhein'}</button></div>`;
}
function rkFootPaint() { const b = document.querySelector('#rkBody [data-rk-goall]'); if (!b || !rk) return; const n = rkCount(rk._lane); b.disabled = !n || !!rk.busy; b.textContent = rk.busy ? '⏳ PC note bana raha hai…' : n ? `🖨 Print — ${num(n)} item${n === 1 ? '' : 's'}` : '🖨 Print — tadad likhein'; }
function rkPaint(only) { if (rk?.tab === 'ro') roWatch();
  const el = $('rkBody'); if (!el || !rk) return;
  if (!only && document.activeElement?.matches?.('#rkBody .rk2-q input')) { rk.dirty = true; return; }   // v2.119.0: tadad likhte waqt screen dobara nahi (khana / Enter na toote) — chhorte hi
  rk.dirty = false; rk._tr = rkTransit(); const names = collect().names || {}, age = rackAt ? Math.round((Date.now() - rackAt) / 60000) : null, lane = rk.tab === 'lane' ? rkLaneRows() : null; rk._lane = lane;
  if (only === 'pk') { const t = document.createElement('div'); t.innerHTML = rk.pset ? pkSetHTML(names) : ''; const a = t.querySelector('#rkPkList'), b = el.querySelector('#rkPkList'); if (a && b) { b.innerHTML = a.innerHTML; return; } }
  else if (only && lane) { const t = document.createElement('div'); t.innerHTML = rkLaneHTML(names, lane); const a = t.querySelector('#rkList'), b = el.querySelector('#rkList'), wa = t.querySelector('#rkWhy'), wb = el.querySelector('#rkWhy'); if (a && b) { b.innerHTML = a.innerHTML; if (wa && wb) wb.innerHTML = wa.innerHTML; rkFootPaint(); return; } }
  const laneN = lane ? lane.N.filter(y => !y.sab).length + lane.P.filter(y => !y.sab).length : rackDue().filter(y => !rk.g || Number(y.x.g) === rk.g).length + pkDue().filter(y => !rk.g || Number(y.g) === rk.g).length;
  const pctN = pkIds().length, roN = !ro.at ? '·' : can('stock.mangwao') ? roRows().filter(r => r.t > 0 && r.pct != null && r.pct <= 40 || r.dm).length : 0;
  const tabs = `<div class="rk-tabs${can('stock.mangwao') ? '' : ' two'}" data-mn-seg="rk.tab" data-mn-i="🧺" data-mn-t="Lane wale · Packet % · Mangwao" data-mn-g="🧺 Rack bharo">${[['lane', '🧺 Lane wale', laneN], ['pct', '📋 Packet %', pctN], ...(can('stock.mangwao') ? [['ro', '🛒 Mangwao', roN]] : [])].map(([k, l, n]) => `<button type="button" class="${rk.tab === k ? 'is-in' : ''}" data-rk-tab="${k}">${l} <i>${typeof n === 'string' ? n : num(n)}</i></button>`).join('')}</div>`;
  const gseg = `<div class="rk-nb rk-gch" data-mn-seg="rk.g" data-mn-i="🏬" data-mn-t="Kaun sa godam" data-mn-g="🧺 Rack bharo">${[...collect().branches.filter(b => b !== 1), 0].map(b => `<button type="button" class="${rk.g === b ? 'is-in' : ''}" data-rk-g="${b}">${b ? '🏬 ' + esc(branchName(b, names)) : 'Sab'}</button>`).join('')}</div>`;
  const top = rk.tab === 'lane'
    ? `<div class="rk2-top"><label class="hs-search rk2-qs"><input type="search" data-rk-q="1" placeholder="🔍 item dhoondo…" value="${esc(rk.q)}" autocomplete="off" enterkeyhint="search"></label><div class="rk2-bar">${rkSabOk() ? `<label class="rk2-sab${rkSabOn() ? ' is-in' : ''}"><input type="checkbox" data-rk-sab="1"${rkSabOn() ? ' checked' : ''}><span>Sab items</span></label>` : ''}${rkPillHTML(names)}</div></div>`
    : `<div class="rk2-top rk2-top2">${rkPillHTML(names)}</div>`;
  const warn = rackAt && age > 10 ? '<div class="rk-time old">⚠️ PC ka rack data 10 min se purana — rack script ruka?</div>' : '';
  const z0 = rackZero.length && isOwner() ? (() => { const Z = rk.zAll ? rackZero : rackZero.slice(0, 8); return `<div class="rk-z0" data-mn-box="rk.zero" data-mn-i="⚠️" data-mn-t="Carton pcs 0 wale items (${num(rackZero.length)})" data-mn-g="🧺 Rack bharo"><b>⚠️ ${num(rackZero.length)} items ka carton pcs <u>0</u> hai</b><small>POS mein in ka bill "Divide by zero" rok sakta hai. App se bane items PC khud 1 kar deta hai (item-post v1.3); baqi POS Item master mein Cotton/packing likhein (kam az kam 1).</small><span class="rk-chips">${Z.map(x => `<i class="rk-c kh" title="dukan ${num(x.ss)} · 30 din mein ${num(x.s)} bike">${esc(x.n)}${x.s ? ` · ${num(x.s)} bike` : ''}</i>`).join('')}${rackZero.length > 8 ? `<button type="button" class="rk-c pc rk-zm" data-rk-zall="1">${rk.zAll ? '▴ kam' : `+${num(rackZero.length - 8)} aur`}</button>` : ''}</span></div>`; })() : '';
  const offs = (() => { const L = rackSrc().filter(x => rackCfg(x.i)?.off); return L.length && isOwner() ? `<details class="rk-offs" data-mn-box="rk.offs" data-mn-i="🚫" data-mn-t="Sirf godam (${num(L.length)}) — rack se hatay" data-mn-g="🧺 Rack bharo"><summary>🚫 Sirf godam (${num(L.length)}) — rack list se hatay hue</summary>${L.map(x => `<div class="rk-or"><span>${esc(x.n)}</span><button type="button" data-rk-on="${esc(String(x.i))}">↺ Wapas</button></div>`).join('')}</details>` : ''; })();
  const pset = isOwner() ? `<button type="button" class="rk-all rk2-pset" data-rkp-set="${rk.pset ? 0 : 1}" data-mn="rk.pset" data-mn-i="⚙️" data-mn-t="Packet items chunein" data-mn-s="packet-war re-order (purana)" data-mn-g="📦 Packet-war">⚙️ Packet items chunein</button>` : '';
  const sy = document.getElementById('dialogBody')?.scrollTop || 0;
  if (rk.tab === 'pct') el.innerHTML = `${top}${gseg}${tabs}${(() => { const A = pkAllRows(), n = A.filter(x => Math.abs(x.far) > 0.0005).length; return `<div class="rk-nb rk-farbar" data-mn-seg="rk.far" data-mn-i="⚖️" data-mn-t="Kaun se items dikhayein" data-mn-g="📋 Packet %"><button type="button" class="${rk.plFar ? '' : 'is-in'}" data-rkp-plfar="0">Sab ${num(A.length)}</button><button type="button" class="${rk.plFar ? 'is-in' : ''} ${n ? 'kh' : ''}" data-rkp-plfar="1">⚖️ Farq wale ${num(n)}</button><span>farq = dono packet jama ≠ POS → dobara gino</span></div>`; })()}${pkAllHTML(true)}`;
  else if (rk.tab === 'ro') el.innerHTML = `${top}${gseg}${tabs}${roHTML(names)}`;
  else el.innerHTML = `${top}${warn}${gseg}${tabs}${rkSetHTML(0)}${z0}${pset}${rkLaneHTML(names, lane)}${rk.pset ? pkSetHTML(names) : ''}${offs}${rkFootHTML(rkCount(lane))}`;
  if (sy) { const db = document.getElementById('dialogBody'); if (db) db.scrollTop = sy; }
}
function rkQtySet(t) {   // likhte hi yaad (screen dobara nahi) — patti mein = tadad > 0
  if (!rk) return; const L = rk._lane;
  if (t.dataset.rkQty != null) { const id = String(t.dataset.rkQty), y = L?.N.find(z => String(z.x.i) === id); if (!y) return; const n = Math.max(0, Math.floor(Number(t.value) || 0)), pcs = y.c.pk ? n * y.c.pk : n, cap = y.c.pk ? Math.floor(y.c.gs / y.c.pk) * y.c.pk : Math.floor(y.c.gs); rk.sel.set(id, Math.max(0, Math.min(pcs, Math.max(0, cap)))); rk.off.delete(id); }
  else if (t.dataset.rkpQ != null) rk.pQ.set(String(t.dataset.rkpQ), Math.max(0, Math.floor(Number(t.value) || 0)));
  const row = t.closest('.rk2-r'); if (row) row.classList.toggle('is-in', [...row.querySelectorAll('.rk2-q input')].some(i => Number(i.value) > 0));
  rkFootPaint();
}
async function rkGoAll() {   // 🖨 ek click — har godam ka EK transfer note (aam + packet lines) + barcode label
  if (!rk || rk.busy) return; const lane = rk._lane || rkLaneRows(), names = collect().names || {}, byG = new Map(), G = g => { const k = Number(g); if (!byG.has(k)) byG.set(k, { lines: [], lb: [] }); return byG.get(k); };
  for (const y of lane.N) { const v = rkVal(y); if (!(v > 0)) continue; const id = String(y.x.i), l = y.c.pk ? { id, name: y.x.n, ctn: Math.floor(v / y.c.pk), pcs: 0 } : { id, name: y.x.n, ctn: 0, pcs: v }; if (!(l.ctn > 0 || l.pcs > 0)) continue; const o = G(y.x.g); o.lines.push(l); if (rk.lbAll && rk.lbOn.has(id)) o.lb.push({ ...l, pack: agPool().byId.get(id)?.pack }); }
  for (const y of lane.P) { const id = String(y.r.i), cq = pkQOf(y), pk = []; let qty = 0; for (const p of y.packs) { const n = Math.max(0, Math.floor(cq.q.get(p.z) || 0)); if (!n) continue; qty += n * p.z; pk.push({ z: p.z, n, nm: p.name }); } qty = r3(qty); if (!(qty > 0)) continue; const l = { id, name: y.name, ctn: 0, pcs: qty, pk }, o = G(y.g); o.lines.push(l); if (rk.lbAll && !rk.lbOff.has(id)) o.lb.push(l); }
  if (!byG.size) { notice('Kisi item par tadad nahi — tadad likhein (0 = nahi)'); return; }
  rk.busy = 'all'; rkPaint(); const ok = [], bad = [];
  for (const [g, o] of byG) {
    try { const r = await stockAgentTransfer({ from: g, to: 1, lines: o.lines, note: '🧺 Rack bharo' });
      if (r?.ok || r?.pending) { const t = Date.now(); for (const l of o.lines) { const id = String(l.id); if (l.pk) { pkSent.set(id, t); for (const p of l.pk) rk?.pQ.delete(id + '|' + p.z); rk?.pkx?.delete(id); } else { rackSent.set(id, t); rk?.sel.delete(id); rk?.extra.delete(id); } }
        ok.push(`${branchName(g, names)}${r.no ? ' #' + r.no : ''} · ${o.lines.length} item${r.ok ? '' : ' (⏳ ' + (r.why || 'PC baad mein') + ')'}`); if (o.lb.length) await rkLabelsGo(o.lb, 'bhi'); }
      else bad.push(`${branchName(g, names)}: ${r?.why || 'masla'}`);
    } catch (e) { bad.push(`${branchName(g, names)}: ${e?.message || e}`); }
  }
  notice(`${ok.length ? '🖨 Patti printer par — ' + ok.join(' · ') : ''}${bad.length ? (ok.length ? ' · ' : '') + '⚠️ Nahi bana: ' + bad.join(' · ') : ''}`);
  if (rk) { rk.busy = ''; rkPaint(); }
}
document.addEventListener('click', e => { const t = e.target.closest?.('[data-rk2-x],[data-rk-goall]'); if (!t || !rk || !t.closest('#rkBody')) return;
  if (t.dataset.rk2X) { rk.x2 = rk.x2 === t.dataset.rk2X ? '' : t.dataset.rk2X; rk.ed = ''; rkPaint(true); return; }
  if (t.dataset.rkGoall != null) rkGoAll(); });
document.addEventListener('input', e => { const t = e.target; if (rk && t?.matches?.('#rkBody .rk2-q input')) rkQtySet(t); });
document.addEventListener('keydown', e => { if (e.key !== 'Enter' || !rk) return; const t = e.target; if (!t?.matches?.('#rkBody .rk2-q input')) return; e.preventDefault(); rkQtySet(t);   // ↵ = agla item (keyboard ka kaam kam)
  const all = [...document.querySelectorAll('#rkBody .rk2-q input:not([disabled])')], nx = all[all.indexOf(t) + 1];
  if (nx) { nx.focus(); try { nx.select(); } catch {} nx.scrollIntoView({ block: 'center', behavior: 'smooth' }); } else { t.blur(); document.querySelector('#rkBody [data-rk-goall]')?.focus?.(); } });
document.addEventListener('focusout', e => { if (rk?.dirty && e.target?.matches?.('#rkBody .rk2-q input')) setTimeout(() => { if (rk?.dirty && !document.activeElement?.matches?.('#rkBody .rk2-q input')) rkPaint(); }, 350); });
document.addEventListener('change', e => { const t = e.target; if (!rk || !t.closest?.('#rkBody')) return;
  if (t.dataset.rkSab != null) { rk.sab = !!t.checked; try { localStorage.setItem('sam-rk-sab', rk.sab ? '1' : '0'); } catch {} rk.x2 = ''; rkPaint(); if (rk.sab) notice('☐ Sab items — zaroorat wale upar (tadad bhari), baqi par 0 · jo chahiye likhein, Enter = agla'); return; }
  if (t.dataset.rkLball != null) { rk.lbAll = !!t.checked; try { localStorage.setItem('sam-rk-lball', rk.lbAll ? '1' : '0'); } catch {} t.closest('.rk2-lb')?.classList.toggle('is-in', rk.lbAll); return; }
});
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
// ---- v2.103.29: 🧮 STOCK MILAO (pehle "Godam 2 milao" v2.103.26) — malik: "baqi godam bhi add karo, godamo ka stock bhi aise hi tally;
//   upar % chips (20% chuno to jis item ka 100 mein se 20 reh gaya wo saamne); godam mein zyada / dukan mein kam — ek larka godam mein, ek dukan
//   par LIVE ginti". 📍 Ginti kahan: Dukan (br 1) / har godam. Dukan = "kis godam ke items" chips (src) + har packet ki ginti + packet % (rackPk, g = src).
//   Godam = us godam ke items, carton wale par Ctn + Pcs, packet wale par har packet -> writeCount(br). 📊 % = (abhi POS stock + farq jo abhi bill
//   mein nahi gaya) / pichhli ginti ka kul (counts c-<br>-<id>). Card par dukan + har godam ka POS / gina / %. Live: counts listener -> gmLive()
//   (koi khana likha ja raha ho to blur tak ruko).
let gm = null;
const GM_LS = 'sam-gm';
const gmSizes = it => [{ z: 1, b: it?.code }, ...((it?.bq) || []).map(x => ({ z: Number(x.q) || 1, b: x.b }))].filter((x, i, a) => x.z > 0 && a.findIndex(y => Math.abs(y.z - x.z) < 1e-9) === i).sort((a, b) => b.z - a.z);
const gmDone = id => { const cf = pkCfg(id); return !!cf && Object.values(cf.p || {}).some(o => Number(o?.b) > 0); };
const gmKey = z => String(+Number(z).toFixed(4));
const gmCnt = (b, id) => { const c = counts.get(countId(b, id)); return c && !c.del && Number(c.total) >= 0 && c.at ? c : null; };
const gmNow = (b, id) => Number(saleStockItem(b, id)?.stock) || 0;
// farq jo abhi POS mein nahi gaya (bill / auto adjustment baqi) — % mein jor kar asal maal
function gmPend(b, id, c) {
  const f = r3((Number(c.total) || 0) - sysOf(c)); if (Math.abs(f) < 0.001) return 0;
  if (c.auto) return Number(c.pfAt) >= Number(c.at) ? 0 : f;
  const key = f < 0 ? String(id) : 'R' + id, q = Number(postedMap.get(`_posted-${c.round}-${b}`)?.items?.[key]) || 0, left = Math.max(0, Math.abs(f) - q);
  return f < 0 ? -left : left;
}
function gmPct(b, id) { const c = gmCnt(b, id); if (!c || !(Number(c.total) > 0)) return null; const adj = gmNow(b, id) + gmPend(b, id, c); return Math.max(0, Math.round(adj / Number(c.total) * 100)); }
const gmWhen = at => { const d = new Date(at); return `${d.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]} ${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`; };
function gmGods() { const C = collect(); return { C, gods: C.branches.filter(b => b !== 1), names: C.names || {} }; }
function gmList() {
  const { C, gods } = gmGods(), P = agPool(), br = gm?.br ?? 1, src = gods.includes(gm?.src) ? gm.src : (C.g2 != null ? C.g2 : gods[0]);
  const from = br === 1 ? (src != null ? [src] : []) : [br], seen = new Set(), L = [];
  const add = (id, x) => { if (!id || seen.has(id)) return; seen.add(id); const it = P.byId.get(id) || x; L.push({ id, it }); };
  for (const b of from) for (const c of rows.filter(r => !r.meta && Array.isArray(r.items) && r.branch === b)) for (const x of c.items) { const id = String(x?.id ?? ''); if (id && (Number(x.stock) || 0) > 0) add(id, x); }
  if (br !== 1) for (const [k, c] of counts) { const m = /^c-(\d+)-(.+)$/.exec(k); if (m && Number(m[1]) === br && !c.del) add(String(m[2]), { id: m[2], name: c.name }); }
  return { br, src, gods, L: L.sort((a, b) => String(a.it.name).localeCompare(String(b.it.name))) };
}
const gmIsDone = (br, id) => { const c = gmCnt(br, id); return !!(c && c.round === roundNow()) || (br === 1 && gmDone(id)); };
export function gmOpen() {
  start(true); rackWatch(); recentPush({ key: 'milao', icon: '🧮', label: 'Stock milao', open: { kind: 'stock', screen: 'milao' } }); let v = {}; try { v = JSON.parse(localStorage.getItem(GM_LS) || '{}') || {}; } catch {}
  gm = { q: '', tab: 'baqi', ed: '', dr: new Map(), busy: '', br: Number(v.br) || 1, src: Number(v.src) || 0, pct: Number(v.pct) || 0, dirty: false };
  const d = $('dialog'); if (!d) return; d.classList.remove('search-dialog'); d.classList.add('full-dialog'); $('dialogTitle').textContent = '🧮 Stock milao — ginti + %'; $('dialogBody').innerHTML = '<div class="rk-root" id="gmBody"></div>'; if (!d.open) d.showModal(); gmPaint();
}
const gmKeep = () => { try { localStorage.setItem(GM_LS, JSON.stringify({ br: gm.br, src: gm.src, pct: gm.pct })); } catch {} };
function gmLive() { if (!gm || !$('gmBody')) return; if (document.activeElement?.closest?.('#gmBody') && document.activeElement.matches('input')) { gm.dirty = true; return; } gmPaint(true); }
function gmDraft(r) {
  const k0 = gm.br + '|' + r.id; let dr = gm.dr.get(k0); if (dr) return dr; const cf = pkCfg(r.id); dr = { n: {}, f: {}, ctn: '', pcs: '' };
  for (const x of gmSizes(r.it)) { const k = gmKey(x.z), o = cf?.p?.[k]; dr.n[k] = ''; dr.f[k] = gm.br === 1 && o && Number(o.b) > 0 ? String(o.b) : ''; }
  gm.dr.set(k0, dr); return dr;
}
const gmCtn = (r, br) => br !== 1 && (Number(r.it.pack) || 0) > 1;   // godam mein carton wala: main barcode = Ctn + Pcs
function gmTot(r, dr, br) { let t = 0; for (const x of gmSizes(r.it)) { const k = gmKey(x.z); if (x.z === 1 && gmCtn(r, br)) t += (Number(dr.ctn) || 0) * (Number(r.it.pack) || 0) + (Number(dr.pcs) || 0); else t += (Number(dr.n[k]) || 0) * x.z; } return r3(t); }
const gmQ = (v, it) => { const pk = Number(it?.pack) || 0, u = esc(it?.uName || 'pcs'); if (pk > 1 && Math.abs(v) >= pk) { const c = Math.trunc(v / pk), p = r3(v - c * pk); return `${num(c)} ctn${p ? ' + ' + num(Math.abs(p)) + ' ' + u : ''}`; } return `${num(r3(v))} ${u}`; };
function gmSumHTML(r, br) { const dr = gmDraft(r), tot = gmTot(r, dr, br), pos = gmNow(br, r.id), far = r3(tot - pos); return `<span>Gina <b>${gmQ(tot, r.it)}</b></span><span>POS <b>${gmQ(pos, r.it)}</b></span><span class="${far < 0 ? 'neg' : far > 0 ? 'pos' : ''}">Farq <b>${far > 0 ? '+' : far < 0 ? '−' : ''}${gmQ(Math.abs(far), r.it)}</b></span>`; }
function gmPlaces(r, names, gods) {
  const one = (b, ic) => { const c = gmCnt(b, r.id), p = gmPct(b, r.id), pos = gmNow(b, r.id); if (b !== 1 && !c && !(pos > 0)) return '';
    return `<div class="gm-pl${gm.br === b ? ' is-in' : ''}"><span>${ic} ${esc(branchName(b, names))}</span><span>POS <b>${gmQ(pos, r.it)}</b></span>${c ? `<span>gina <b>${gmQ(Number(c.total) || 0, r.it)}</b> <small>${esc(c.byName || '')} · ${gmWhen(c.at)}</small></span>` : '<span class="mut">abhi nahi gina</span>'}${p != null ? `<i class="rk-c ${p <= 20 ? 'kh' : p <= 40 ? 'lo' : 'pc'}">📊 ${p}% bacha</i>` : ''}</div>`; };
  return one(1, '🏪') + gods.map(g => one(g, '🏬')).join('');
}
function gmPaint(only) {
  const el = $('gmBody'); if (!el || !gm) return; gm.dirty = false;
  const { names } = gmGods(), { br, src, gods, L } = gmList(); if (gods.includes(src)) gm.src = src;
  if (!gods.length) { el.innerHTML = '<div class="th-empty">🏬<b>Koi godam nahi mila</b></div>'; return; }
  const done = L.filter(r => gmIsDone(br, r.id)), baqi = L.filter(r => !gmIsDone(br, r.id)), q = gm.q.trim();
  let V = gm.tab === 'done' ? done : baqi;
  if (gm.pct) V = L.map(r => ({ r, p: gmPct(br, r.id) })).filter(x => x.p != null && x.p <= gm.pct).sort((a, b) => a.p - b.p).map(x => x.r);
  if (q) V = smartSearch(V.map(r => ({ ...r, name: r.it.name, code: r.it.code })), q, 60);
  const row = r => { const open = gm.ed === r.id, ok = gmIsDone(br, r.id), c = gmCnt(br, r.id), p = gmPct(br, r.id);
    return `<div class="rk-ps${ok ? ' is-in' : ''}"><button type="button" class="rk-psh" data-gm-ed="${esc(r.id)}"><span><b>${ok ? '✓ ' : ''}${esc(r.it.name)}</b><span class="rk-chips">${ok && c ? `<i class="rk-c own">✓ gina — ${esc(c.byName || '')} · ${gmWhen(c.at)}</i>` : ok ? '<i class="rk-c own">✓ packet % laga</i>' : '<i class="rk-c kh">baqi</i>'}${p != null ? `<i class="rk-c ${p <= 20 ? 'kh' : p <= 40 ? 'lo' : 'pc'}">📊 ${p}% bacha</i>` : ''}<i class="rk-c pc">${num(gmSizes(r.it).length)} barcode</i></span></span><i>${open ? '▴' : '▾'}</i></button>
      <div class="gm-pls">${gmPlaces(r, names, gods)}</div>
      ${open ? gmEdHTML(r, br) : ''}</div>`; };
  const html = `<div class="rk-hero"><div><small>STOCK MILAO · ${esc(br === 1 ? '🏪 ' + branchName(1, names) : '🏬 ' + branchName(br, names))}</small><b>${num(baqi.length)} items baqi</b><span>${num(done.length)} ho gaye · kul ${num(L.length)}</span></div><span class="rk-ic">🧮</span></div>
    <div class="rk-nb gm-where"><span>📍 Ginti kahan</span>${[1, ...gods].map(b => `<button type="button" class="${br === b ? 'is-in' : ''}" data-gm-br="${b}">${b === 1 ? '🏪' : '🏬'} ${esc(branchName(b, names))}</button>`).join('')}</div>
    ${br === 1 ? `<div class="rk-nb gm-src"><span>📦 Kis godam ke items</span>${gods.map(g => `<button type="button" class="${src === g ? 'is-in' : ''}" data-gm-src="${g}">${esc(branchName(g, names))}</button>`).join('')}</div>` : ''}
    <div class="rk-nb rk-pct"><span>📊 Itna % bacha</span>${[[0, 'Sab'], [10, '10%'], [20, '20%'], [30, '30%'], [40, '40%']].map(([v, l]) => `<button type="button" class="${gm.pct === v ? 'is-in' : ''}" data-gm-pct="${v}">${l}</button>`).join('')}</div>
    ${!roundNow() ? `<div class="rk-z0"><b>📋 Stock ginti shuru nahi</b><small>Stock theek karne ke liye pehle Stock → "📋 Nayi ginti shuru" (malik). Tab tak${br === 1 ? ' sirf packet %' : ' ginti'} save nahi hogi.</small></div>` : ''}
    ${gm.pct ? `<p class="rk-note">📊 ${gm.pct}% ya kam bacha — pichhli ginti ko 100% maan kar (sab se kam pehle). <b>${num(V.length)}</b> items</p>` : `<div class="mchips"><button type="button" class="rc${gm.tab === 'baqi' ? ' on' : ''}" data-gm-tab="baqi">⏳ Baqi (${num(baqi.length)})</button><button type="button" class="rc${gm.tab === 'done' ? ' on' : ''}" data-gm-tab="done">✓ Ho gaye (${num(done.length)})</button></div>`}
    <label class="hs-search"><input type="search" data-gm-q="1" placeholder="🔍 item dhoondo…" value="${esc(gm.q)}" autocomplete="off"></label>
    <div id="gmList">${V.map(row).join('') || `<div class="th-empty">🧮<b>${gm.pct ? `${gm.pct}% tak koi item nahi` : gm.tab === 'done' && !q ? 'Abhi koi nahi' : q ? 'Nahi mila' : 'Sab ho gaye ✓'}</b>${gm.pct ? '<small>% sirf un items ka jin ki pehle ginti ho chuki</small>' : ''}</div>`}</div>`;
  if (only) { const t = document.createElement('div'); t.innerHTML = html; const a = t.querySelector('#gmList'), b = el.querySelector('#gmList'), ha = t.querySelector('.rk-hero'), hb = el.querySelector('.rk-hero'); if (a && b) { b.innerHTML = a.innerHTML; if (ha && hb) hb.innerHTML = ha.innerHTML; return; } }
  el.innerHTML = html;
}
function gmPrevHTML(dr, k) { const c = String(dr.n[k] ?? '').trim(), f = Number(dr.f[k]) || 0; if (c === '' && !f) return '<small>👀 upar abhi ki ginti · 🧺 rack poora bhara ho to kitne</small>';
  return pkPrevHTML({ b: f || Number(c) || 0, c: c === '' ? null : Number(c) }, { left: null }); }
function gmEdHTML(r, br) {
  const dr = gmDraft(r), dk = br === 1;
  return `<div class="rk-psb"><p class="rk-note">${dk ? 'Dukan ke rack par' : 'Godam mein'} har barcode gin kar likhein${dk ? ' · 🧺 rack poora likhein — ' + esc(pkQTxt()) + ' tak bike to packet khud Rack bharo list mein' : ''}</p>
    ${gmSizes(r.it).map(x => { const k = gmKey(x.z);
      if (x.z === 1 && gmCtn(r, br)) return `<div class="gm-r"><div class="gm-l"><b>${esc(pkName(1, r.it))} · 1 ctn = ${num(r.it.pack)}</b><small>${esc(String(x.b || ''))}</small></div><span class="gm-cp"><label class="gm-n"><input type="number" inputmode="decimal" min="0" step="any" data-gm-c="${esc(r.id)}" value="${esc(dr.ctn)}" placeholder="0"><small>ctn</small></label><label class="gm-n"><input type="number" inputmode="decimal" min="0" step="any" data-gm-s="${esc(r.id)}" value="${esc(dr.pcs)}" placeholder="0"><small>${esc(r.it.uName || 'pcs')}</small></label></span></div>`;
      return `<div class="gm-r"><div class="gm-l"><b>${esc(pkName(x.z, r.it))}</b><small>${esc(String(x.b || ''))}</small></div><label class="gm-n"><input type="number" inputmode="decimal" min="0" step="any" data-gm-n="${esc(r.id)}|${k}" value="${esc(dr.n[k])}" placeholder="0"><small>${x.z === 1 && !(Number(r.it.pack) > 1) ? esc(r.it.uName || 'pcs') : 'packet'}</small></label>
        ${dk ? `<label class="gm-f"><small>🧺 Rack POORA bhara ho to (100%)</small><span><input type="number" inputmode="numeric" min="0" step="1" data-gm-f="${esc(r.id)}|${k}" value="${esc(dr.f[k] || '')}" placeholder="jaise 250"><em>packet</em></span></label>
        <div class="gm-prev" id="gmPrev-${esc(r.id)}-${k.replace('.', '_')}">${gmPrevHTML(dr, k)}</div>` : ''}</div>`; }).join('')}
    <div class="gm-sum" id="gmSum-${esc(r.id)}">${gmSumHTML(r, br)}</div>
    <div class="rk-ed"><button type="button" class="rk-sv" data-gm-sv="${esc(r.id)}"${gm.busy ? ' disabled' : ''}>${gm.busy === r.id ? '⏳ Save…' : dk ? '✓ Save — dukan ginti + packet %' : '✓ Save — godam ginti'}</button></div></div>`;
}
async function gmSave(id) {
  const { br, src, gods, L } = gmList(), r = L.find(x => x.id === id); if (!r || gm.busy) return;
  if (!isOwner() && !can('stock.g2milao')) { notice('Is kaam ki ijazat nahi — malik se kahein'); return; }
  const dr = gmDraft(r), p = {}; let any = false;
  if (br === 1) for (const x of gmSizes(r.it)) { const k = gmKey(x.z), c = Math.max(0, Number(dr.n[k]) || 0), f = Math.max(0, Math.round(Number(dr.f[k]) || 0)), b = f || c, pct = pkQ(); if (!(b > 0)) continue; any = true;   // v2.103.32: b = rack poora (100%), c = abhi gina
    p[k] = { n: Math.max(1, pkN(b, c, pct)), a: Math.max(1, b - Math.floor(b * pct / 100)), b, c, pct }; }
  const tot = gmTot(r, dr, br), typed = Object.values(dr.n).some(v => String(v).trim() !== '') || String(dr.ctn).trim() !== '' || String(dr.pcs).trim() !== '';
  if (!typed) { notice('Pehle ginti likhein'); return; }
  if (!(tot > 0) && !confirm(`${r.it.name}: ginti ZERO save karein?`)) return;
  gm.busy = id; gmPaint();
  const pos = gmNow(br, id), per = Number(r.it.pack) || 0, ctn = per > 1 ? Math.floor(tot / per + 1e-9) : 0, pcs = r3(tot - ctn * (per > 1 ? per : 0)), msg = [];
  try {
    if (roundNow() && !countLocked()) { await writeCount({ id, name: r.it.name, stock: pos, pack: per }, { ctn, pcs, total: tot }, null, false, br); msg.push(`ginti ${gmQ(tot, r.it)} (farq ${gmQ(r3(tot - pos), r.it)})`); }
    else msg.push('⚠️ ginti round nahi — stock baad mein');
    if (br === 1 && any && cloud?.setRackPk) { const g = gods.includes(src) ? src : gods.map(b => [b, gmNow(b, id)]).sort((a, b) => b[1] - a[1])[0]?.[0]; const v = { g, at: Date.now(), p }; await cloud.setRackPk(id, v); itemCfg = { ...(itemCfg || {}), rackPk: { ...(itemCfg?.rackPk || {}), [id]: JSON.stringify(v) } }; msg.push(Object.entries(p).map(([z, o]) => `${pkName(Number(z), r.it)} ${o.c}/${o.b}`).join(' · ')); }
    notice(`✓ ${r.it.name} — ${msg.join(' · ')}`); gm.ed = ''; gm.dr.delete(br + '|' + id);
  } catch (e) { notice('⚠️ Save nahi hua: ' + (e?.message || e)); }
  gm.busy = ''; gmPaint();
}
document.addEventListener('click', e => {
  const t = e.target.closest?.('[data-gm-ed],[data-gm-tab],[data-gm-sv],[data-gm-br],[data-gm-src],[data-gm-pct]'); if (!t || !gm || !t.closest('#gmBody')) return; const d = t.dataset;
  if (d.gmEd) { gm.ed = gm.ed === d.gmEd ? '' : d.gmEd; gmPaint(); return; }
  if (d.gmTab) { gm.tab = d.gmTab; gmPaint(); return; }
  if (d.gmBr) { gm.br = Number(d.gmBr); gm.ed = ''; gmKeep(); gmPaint(); return; }
  if (d.gmSrc) { gm.src = Number(d.gmSrc); gm.ed = ''; gmKeep(); gmPaint(); return; }
  if (d.gmPct != null) { gm.pct = Number(d.gmPct) || 0; gmKeep(); gmPaint(); return; }
  if (d.gmSv) { gmSave(d.gmSv); return; }
});
document.addEventListener('input', e => { const t = e.target; if (!gm) return;
  if (t?.dataset?.gmQ != null) { gm.q = t.value || ''; clearTimeout(gmPaint.t); gmPaint.t = setTimeout(() => gmPaint(true), 160); return; }
  const nk = t?.dataset?.gmN || t?.dataset?.gmF, id = nk ? nk.split('|')[0] : (t?.dataset?.gmC || t?.dataset?.gmS); if (!id) return;
  const r = gmList().L.find(x => x.id === id); if (!r) return; const dr = gmDraft(r), k = nk ? nk.split('|')[1] : '';
  if (t.dataset.gmN) dr.n[k] = t.value; else if (t.dataset.gmF) dr.f[k] = t.value; else if (t.dataset.gmC) dr.ctn = t.value; else dr.pcs = t.value;
  if (k) { const pv = document.getElementById(`gmPrev-${id}-${k.replace('.', '_')}`); if (pv) pv.innerHTML = gmPrevHTML(dr, k); }
  const box = document.getElementById('gmSum-' + id); if (box) box.innerHTML = gmSumHTML(r, gm.br);
});
document.addEventListener('focusout', e => { if (gm?.dirty && e.target?.closest?.('#gmBody')) setTimeout(() => { if (gm?.dirty && !document.activeElement?.closest?.('#gmBody input')) gmPaint(true); }, 300); });
// ---- v2.103.31: 📋 SAB PACKET ITEMS — malik: "item par click kar ke % badle · poori list ka % ek click · har item alag".
//   Har item: har packet "left / b bache (x%) · hadd y%" (rackPk PC rows sold); tap = b (100% = kitne packet) + % chips + Save (at wahi — ginti
//   nahi tootti). Upar "Sab ka % ek click 10–40" = jin ka b hai sab ka pct + n (cloud.setRackPkMany, ek write).
const pkIds = () => Object.keys(itemCfg?.rackPk || {}).filter(k => pkCfg(k));
const pkCan = () => isOwner() || can('stock.g2milao');
function pkNcalc(b, pct) { return Math.max(1, Math.round(b - Math.floor(b * pct / 100))); }
// v2.103.33: malik — "har sub-barcode alag · 👀 abhi = POS dukan stock (dobara na ginna pare) · jo likhein wahi stock (kam / zyada POS mein)".
//   pkSizesOf = item ke SAARE barcode (main + sub) + cfg wale. Editor ka 👀 khud bhara: ek packet = POS dukan ÷ size; kai = sab se bara
//   floor(POS ÷ size), baqi khaali (gino). _t = 👀 chhua → Save par ginti (writeCount dukan) — farq farq-bill raaste se POS mein; khaali = 0.
//   Na chhua: khaali packet = app ka bacha (left) — % badalne se halat nahi tootti. Save = at abhi (ginti wahin se).
function pkSizesOf(it, cf) { const S = gmSizes(it).map(x => ({ z: x.z, k: gmKey(x.z) })); for (const k of Object.keys(cf?.p || {})) if (!S.some(y => Math.abs(y.z - Number(k)) < 1e-9)) S.push({ z: Number(k), k }); return S.sort((a, b) => b.z - a.z); }
function pkAllRows(nw = false) {   // v2.105.4+: nw = Packet % tab ke ➕ naye (abhi save nahi — rk.pkNew) bhi, sab se upar
  const P = agPool(), by = new Map((rackPk || []).map(r => [String(r.i), r])), ids = pkIds(); if (nw && rk?.pkNew?.size) for (const id of rk.pkNew.keys()) if (!pkCfg(id)) ids.push(id);
  const L = ids.map(id => { const cf = pkCfg(id) || rk?.pkNew?.get(id), r = by.get(id), it = P.byId.get(id) || { name: r?.n || 'Item ' + id };
    const packs = pkSizesOf(it, cf).map(({ z, k }) => { const ck = Object.keys(cf.p || {}).find(y => Math.abs(Number(y) - z) < 1e-9), o = ck != null ? cf.p[ck] : null, L = o && Number(o.b) ? pkLeft(o, r, ck, cf.at) : null;
      return { z, k: ck ?? k, has: !!o, b: L ? L.b : 0, pct: o ? pkQ() : 0, n: Number(o?.n) || 0, sold: L ? L.sold : 0, left: L ? L.left : null, now: L ? L.now : null, lao: L ? L.lao : 0 }; });
    const K = packs.filter(p => p.left != null && p.b > 0), pos = gmNow(1, id), app = r3(K.reduce((t, p) => t + p.left * p.z, 0)), minZ = K.length ? Math.min(...K.map(p => p.z)) : 1, far0 = K.length ? r3(app - pos) : 0, far = Math.abs(far0) < minZ / 2 - 1e-9 ? 0 : far0;   // v2.103.68: ⚖️ dono packet jama vs POS kul · v2.103.70: aadhe chhote packet se kam farq = 0 (0.005 PCS jaisa nahi dikhana)
    // v2.103.69: farq KAHAN se — ginti ke waqt (app A0 vs POS s0) ya baad mein (bina-packet bika kh · aamad li · aur nikasi lo−sq) — PC rack-bharo v1.9 (s0/li/lo/sq)
    let why = null; if (K.length && r && r.s0 != null && !(Number(r.from) < (Number(cf.at) || 0) - 1000)) { const refill = Number(r.from) > (Number(cf.at) || 0) + 60000, A0 = r3(K.reduce((t, p) => { const o = cf.p?.[p.k]; return t + ((!refill && o?.c != null && o.c !== '') ? Number(o.c) : p.b) * p.z; }, 0));
      why = { A0, s0: r3(r.s0), f0: r3(A0 - r.s0), kh: r3(r.kh || 0), li: r3(Math.max(0, (r.li || 0) - (r.rq || 0))), rq: r3(r.rq || 0), wq: r3(r.wq || 0), other: r3(Math.max(0, (r.lo || 0) - (r.sq || 0) - (r.wq || 0))) }; }   // v2.103.93: ↩ rq = sale return (PC rack-bharo v1.15) — app mein plus ho chuka, aamad se alag
    const low = Math.min(999, ...packs.filter(p => p.now != null).map(p => p.now)); return { id, cf, it, packs, low, pos, app, far, why }; });
  return L.sort((a, b) => (b.cf?._new ? 1 : 0) - (a.cf?._new ? 1 : 0) || a.low - b.low || String(a.it.name).localeCompare(String(b.it.name)));
}
// v2.103.35: jin packets ka % laga (left maloom) → 👀 = app ka apna bacha (1 kg 3 · 500 gm 33 = 19.5 = POS); kul POS se na mile to farq sab se bare
//   % wale packet mein (0 se neeche nahi). Koi % nahi laga → POS sab se bare barcode mein (purana). Chip: 'app ke hisaab se' / '🏪 POS se'.
// v2.103.65: malik — "upar 15/25, neeche 2 kyun" → app ka apna hisaab waisa hi likho (farq chup-chaap bare packet mein NA dalo); farq alag chip, chahein to 🏪 POS se bharo (adjust=true)
function pkPosFill(packs, pos, adjust = false) { const o = {}; pos = Math.max(0, Number(pos) || 0); const K = packs.filter(p => p.has && p.left != null);
  if (!K.length) { const tg = packs[0]; for (const p of packs) o[p.k] = p === tg ? String(packs.length === 1 ? r3(pos / p.z) : Math.floor(pos / p.z + 1e-9)) : ''; o._src = 'pos'; return o; }
  for (const p of packs) o[p.k] = K.includes(p) ? String(r3(p.left)) : '';
  const tot = r3(K.reduce((t, p) => t + p.left * p.z, 0)), far = r3(pos - tot); if (adjust && Math.abs(far) > 0.0005) { const big = K[0], v = r3(Number(o[big.k]) + far / big.z); o[big.k] = String(Math.max(0, v)); }
  o._src = adjust ? 'pos' : 'app'; o._far = adjust ? 0 : far; return o; }
function pkDraftOf(id, x) { let dr = rk.plDr.get(id); if (dr) return dr; x = x || pkAllRows(true).find(y => y.id === id); if (!x) return null;
  dr = { _t: false, _pos: gmNow(1, id) }; const pre = pkPosFill(x.packs, dr._pos); dr._src = pre._src; dr._far = pre._far || 0;
  for (const p of x.packs) dr[p.k] = { b: p.b || '', c: pre[p.k] }; rk.plDr.set(id, dr); return dr; }
function pkTot(x, dr) { return r3(x.packs.reduce((t, p) => t + (Number(dr[p.k]?.c) || 0) * p.z, 0)); }
function pkSumHTML(x, dr) { const pos = gmNow(1, x.id), tot = pkTot(x, dr), far = r3(tot - pos), multi = x.packs.length > 1;
  return `<span>🏪 POS dukan <b>${gmQ(pos, x.it)}</b></span>${dr._t ? `<span>👀 aap ki ginti <b>${gmQ(tot, x.it)}</b></span><span class="${far < 0 ? 'neg' : far > 0 ? 'pos' : ''}">Farq <b>${far > 0 ? '+' : far < 0 ? '−' : ''}${gmQ(Math.abs(far), x.it)}</b>${Math.abs(far) > 0.0005 ? ' → POS mein' : ' ✓'}</span>` : `<span class="mut">👀 ${dr._src === 'app' ? 'app ke apne hisaab se bhara (barcode-war sale minus)' : 'POS se bhara' + (multi ? ' (bara packet) — chhote gin kar likhein' : '')} · sahi ho to bas Save</span>${dr._src === 'app' && Math.abs(far) > 0.0005 ? `<span class="neg">⚠️ POS <b>${gmQ(pos, x.it)}</b> · app <b>${gmQ(tot, x.it)}</b> — farq <b>${gmQ(Math.abs(far), x.it)}</b></span><button type="button" class="gm-posfill" data-rkp-posfill="${esc(x.id)}">🏪 POS ke hisaab se bharo</button>` : ''}`}`; }
// v2.103.69: farq ki wajah (chhoti line) — kis hisse mein hai: ginti ke waqt / bina-packet sale (khula) / aamad / aur nikasi
function pkWhyHTML(x) { const w = x.why; if (!w) return ''; const u = v => gmQ(Math.abs(v), x.it), parts = [];
  if (Math.abs(w.f0) > 0.0005) parts.push(`ginti ke waqt hi: app ${u(w.A0)} · POS ${u(w.s0)} (${w.f0 > 0 ? '+' : '−'}${u(w.f0)})`); else parts.push('ginti ke waqt theek tha');
  if (w.kh > 0.0005) parts.push(`POS mein bina-packet (khula) bika ${u(w.kh)} — app ne minus nahi kiya`); if (w.wq > 0.0005) parts.push(`wholesale bika ${u(w.wq)} (rack se nahi)`); if (w.rq > 0.0005) parts.push(`↩ wapis aaya (return) ${u(w.rq)} — app mein plus`); if (w.li > 0.0005) parts.push(`aamad ${u(w.li)}`); if (w.other > 0.0005) parts.push(`aur nikasi (transfer/adjust) ${u(w.other)}`);
  return `<small class="rk-why">↳ ${parts.join(' · ')}</small>`; }
// v2.119.0: 📋 Packet % — item 🧺 Lane wale mein hai ya nahi, aur kyun (pehle "⚠️ abhi se list mein" likhta tha magar godam / upar ke chip ki shart nahi batata)
function pkLaneWhy(id, packs) {
  const Q = pkQ(); if (!packs.some(p => p.b > 0 && p.left != null && p.left <= Math.floor(p.b * Q / 100) + 1e-9)) return null;
  const names = collect().names || {}, y = pkDue().find(z => String(z.r.i) === String(id));
  if (y) return rk?.g && Number(y.g) !== rk.g ? { k: 'g', t: `🏬 ${branchName(y.g, names)} ki list mein (upar ${branchName(rk.g, names)} chuna hai)` } : { k: 'ok', t: `✅ Lane wale mein (${branchName(y.g, names)} se)` };
  if (rackCfg(id)?.off) return { k: 'off', t: '🚫 "Nahi lana" laga hai' };
  const r = (rackPk || []).find(z => String(z.i) === String(id)), cf = pkCfg(id); if (!r) return { k: 'pc', t: '⏳ PC ka hisaab abhi nahi aaya (2–5 min)' };
  if (pkSent.get(String(id)) > (Number(r.from) || 0)) return { k: 'sent', t: '🖨 Patti nikal chuki — maal raste mein' };
  return { k: 'khali', t: `⛔ ${branchName(Number(cf?.g || r.g), names)} mein maal nahi — "☐ Sab items" se doosre godam se lao` };
}
function pkRowHTML(x, ed) {
  const why = pkLaneWhy(x.id, x.packs); if (rk) { rk._why = rk._why || new Map(); if (why) rk._why.set(String(x.id), why); else rk._why.delete(String(x.id)); }
  const open = rk.plEd === x.id, dr = open && ed ? pkDraftOf(x.id, x) : null;
  return `<div class="rk-ps${open ? ' is-in' : ''}"><button type="button" class="rk-psh" data-rkp-ped="${esc(x.id)}"><span><b>${esc(x.it.name)}</b><span class="rk-chips">${x.cf?._new ? '<i class="rk-c own">🆕 naya — 🧺 100% likh kar ✓ Save</i>' : ''}${x.packs.map(p => p.b ? `<i class="rk-c ${p.now <= p.pct ? 'kh' : p.now <= Math.max(40, p.pct + 10) ? 'lo' : 'pc'}">${esc(pkName(p.z, x.it))}: ${num(p.left)}/${num(p.b)} (${p.now}%)</i>` : p.has ? `<i class="rk-c pc">${esc(pkName(p.z, x.it))}: hadd ${num(p.n)} bikne par</i>` : `<i class="rk-c mu">${esc(pkName(p.z, x.it))}: 🧺 100% nahi likha</i>`).join('')}${why ? `<i class="rk-c ${why.k === 'ok' ? 'ok' : why.k === 'g' || why.k === 'pc' ? 'own' : 'kh'}">${esc(why.t)}</i>` : ''}${rackCfg(x.id)?.off ? `<i class="rk-c kh">🚫 nahi lana</i>${isOwner() ? `<button type="button" class="rk-all" data-rk-on="${esc(x.id)}">↺ wapas</button>` : ''}` : ''}${Math.abs(x.far) > 0.0005 ? `<i class="rk-c kh">⚖️ farq ${x.far > 0 ? '+' : '−'}${gmQ(Math.abs(x.far), x.it)} (app ${gmQ(x.app, x.it)} · POS ${gmQ(x.pos, x.it)})</i>${pkWhyHTML(x)}` : ''}</span></span><i>${open ? '▴' : '▾'}</i></button>
    ${dr ? `<div class="rk-psb"><div class="gm-sum" id="pkSum-${esc(x.id)}">${pkSumHTML(x, dr)}</div>${x.packs.map(p => { const d = dr[p.k], sk = esc(x.id) + '|' + esc(p.k); return `<div class="gm-r gm-r2"><div class="gm-l"><b>${esc(pkName(p.z, x.it))}</b>${p.b ? `<small>app: ${num(p.left)}/${num(p.b)} bacha</small>` : '<small>naya — 🧺 poora likhein</small>'}</div>
      <label class="gm-f"><small>🧺 Rack POORA bhara ho to (100%)</small><span><input type="number" inputmode="numeric" min="1" step="1" data-rkp-pb="${sk}" value="${esc(String(d.b))}" placeholder="jaise 250"><em>packet</em></span></label>
      <label class="gm-f"><small>👀 Abhi rack par <i class="gm-src">${dr._t ? '✏️ aap ne likha' : d.c !== '' ? (dr._src === 'app' ? '📱 app ke hisaab se' : '🏪 POS se') : 'gin kar'}</i></small><span><input type="number" inputmode="decimal" min="0" step="any" data-rkp-pc="${sk}" value="${esc(String(d.c ?? ''))}" placeholder="gino"><em>packet</em></span></label>
      <div class="gm-prev" id="pkPrev-${esc(x.id)}-${esc(String(p.k)).replace('.', '_')}">${pkPrevHTML(d, { left: dr._t ? 0 : p.left }, sk)}</div></div>`; }).join('')}
      <div class="rk-ed">${x.cf?._new ? `<button type="button" class="rk-au" data-rkp-newx="${esc(x.id)}">✕ Rehne dein</button>` : ''}<button type="button" class="rk-sv" data-rkp-psv="${esc(x.id)}">✓ Save${dr._t ? ' — ginti + %' : ''}</button></div></div>` : open ? '<p class="rk-note">Is kaam ki ijazat nahi</p>' : ''}</div>`;
}
function pkPrevHTML(d, p, sk) { const b = Number(d.b) || 0, pct = pkQ();   // v2.118.0: ⚙️ Qaida ka %
  if (!b) return '<small>🧺 rack poora bhara ho to kitne packet — likhein</small>';
  const now = d.c !== '' && d.c != null ? Number(d.c) : (p.left != null ? p.left : b), lim = Math.floor(b * pct / 100), pc = Math.round(now / b * 100);
  const why = now <= lim && sk ? rk?._why?.get(String(sk).split('|')[0]) : null;   // v2.119.0: asal haal (list mein hai ya kyun nahi)
  return `<small>Abhi <b>${num(now)}/${num(b)} = ${pc}%</b> · <b>${esc(pkQTxt())}</b> — ${now <= lim ? `<b>abhi list mein: ${num(Math.max(1, Math.round(b - now)))} packet</b> (wapas 100%)${why ? ` · <b class="rk-why-${why.k}">${esc(why.t)}</b>` : ''}` : `${num(lim)} reh jaye to khud list mein · tab <b>${num(b - lim)} packet</b> aayenge`}</small>${sk && now > b ? `<button type="button" class="gm-full" data-rkp-full="${sk}">⚠️ Abhi ${num(now)} — poore ${num(b)} se zyada · Poora ${num(Math.ceil(now))} kar dein?</button>` : ''}`; }
// v2.105.5: malik — Packet % mein "Bir" (Biryani masala 1kg) "Nahi mila" — sirf % wale 70 items aate the. Ab search par jo packet item nahi wo neeche
//   "🔍 Packet % mein nahi — ➕ jorein" (naam · packet / barcode · dukan + godam stock) → ➕ = rk.pkNew (abhi save NAHI) list mein upar khula editor
//   (🧺 100% · 👀 abhi · %) → ✓ Save = asal packet item (cloud.setRackPk, wahi pkCan). ✕ Rehne dein = draft hatao.
function pkNewG(id) { const C = collect(), gods = C.branches.filter(b => b !== 1), st = g => Number(saleStockItem(g, id)?.stock) || 0;
  if (rk?.g && gods.includes(rk.g) && st(rk.g) > 0) return rk.g;
  const best = gods.map(g => [g, st(g)]).sort((a, b) => b[1] - a[1])[0]; return best && best[1] > 0 ? best[0] : (rk?.g && gods.includes(rk.g) ? rk.g : (C.g2 != null ? C.g2 : gods[0])); }
function pkNewHTML(q, ed) {
  if (!q) return ''; const P = agPool(), names = collect().names || {}, H = smartSearch(P.list.filter(it => !pkCfg(it.id) && !rk.pkNew?.has(String(it.id))), q, 6); if (!H.length) return '';
  return `<section class="rk-g rk-why rk-pnew"><div class="rk-gh"><b>🔍 Packet % mein nahi — ➕ jorein</b></div>${H.map(it => { const id = String(it.id), g = pkNewG(id), sz = gmSizes(it).map(x => pkName(x.z, it)).join(' · ');
    return `<div class="rk-wy"><span><b>${esc(it.name)}</b><i class="rk-c pc">📦 ${esc(sz || '1 packet')}</i><small>dukan ${num(r3(Number(saleStockItem(1, id)?.stock) || 0))} · ${esc(branchName(g, names))} ${num(r3(Number(saleStockItem(g, id)?.stock) || 0))}</small></span>${ed ? `<button type="button" class="rk-sv" data-rkp-new="${esc(id)}">➕ Packet % lagao</button>` : ''}</div>`; }).join('')}${ed ? '' : '<p class="rk-note">🔒 Packet % lagane ki ijazat nahi — malik se kahein</p>'}</section>`;
}
function pkPlInner(ed) {
  let L = pkAllRows(true); if (rk.plFar) L = L.filter(x => x.cf?._new || Math.abs(x.far) > 0.0005); const q = String(rk.plq || '').trim(); if (q) L = smartSearch(L.map(x => ({ ...x, name: x.it.name })), q, 120);
  return (L.slice(0, 150).map(x => pkRowHTML(x, ed)).join('') || `<p class="rk-note">${q ? `"${esc(q)}" — packet % list mein nahi` : 'Nahi mila'}</p>`) + pkNewHTML(q, ed);
}
function pkAllHTML(force) {
  const ids = pkIds(), ed = pkCan(), q = String(rk.plq || '').trim();
  if (!ids.length && !rk.pkNew?.size) return force ? `<div class="th-empty">📦<b>Abhi koi packet item nahi</b><small>Neeche item dhoond kar ➕ Packet % lagao — ya Lane wale tab mein "⚙️ Items chunein"</small></div><label class="hs-search"><input type="search" data-rkp-plq="1" placeholder="🔍 item dhoondo…" value="${esc(rk.plq || '')}" autocomplete="off"></label><div id="rkPl">${pkNewHTML(q, ed)}</div>` : '';
  if (force) rk.plOpen = true;
  return `<div class="rk-pl">${force ? `<div class="rk-gh rk-plt"><b>📋 Sab packet items (${num(ids.length)}) — bacha dekho / gino</b></div>` : `<button type="button" class="rk-plh" data-rkp-plo="1">📋 Sab packet items (${num(ids.length)}) — bacha dekho / gino <i>${rk.plOpen ? '▴' : '▾'}</i></button>`}
    ${rk.plOpen ? `${force ? rkSetHTML(0) : ''}<p class="rk-note rk-pq"><b>${esc(pkQTxt())}</b> — 0 se ${rackPct() || 20}% tak jitne bhi packet bachein, item khud 🧺 Lane wale mein (wapas 100%) · badlein: ⚙️ Qaide</p>
      <label class="hs-search"><input type="search" data-rkp-plq="1" placeholder="🔍 item dhoondo…" value="${esc(rk.plq || '')}" autocomplete="off"></label>
      <div id="rkPl">${pkPlInner(ed)}</div>` : ''}</div>`;
}
document.addEventListener('click', e => {
  const t = e.target.closest?.('[data-rkp-plo],[data-rkp-plfar],[data-rkp-ped],[data-rkp-posfill],[data-rkp-psv],[data-rkp-full],[data-rkp-new],[data-rkp-newx]'); if (!t || !rk || !t.closest('#rkBody')) return; const d = t.dataset;
  if (d.rkpNew) { const id = String(d.rkpNew); if (!pkCan()) { notice('🔒 Packet % lagane ki ijazat nahi'); return; } if (pkCfg(id)) { rk.plEd = id; rkPaint(); return; }   // v2.105.5
    rk.pkNew = rk.pkNew || new Map(); rk.pkNew.set(id, { g: pkNewG(id), at: Date.now(), p: {}, _new: 1 }); rk.plDr.delete(id); rk.plEd = id; start(true); rkPaint();
    setTimeout(() => document.querySelector(`#rkPl [data-rkp-ped="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 80); notice('🆕 Har packet ka 🧺 100% likhein, phir ✓ Save'); return; }
  if (d.rkpNewx) { const id = String(d.rkpNewx); rk.pkNew?.delete(id); rk.plDr.delete(id); if (rk.plEd === id) rk.plEd = ''; rkPaint(); return; }
  if (d.rkpPlo) { rk.plOpen = !rk.plOpen; rkPaint(); return; }
  if (d.rkpPlfar != null) { rk.plFar = d.rkpPlfar === '1'; rkPaint(); return; }   // v2.103.68 · v2.103.71: upar sticky (Sab / Farq wale)
  if (d.rkpPosfill) { const x = pkAllRows(true).find(y => y.id === d.rkpPosfill), dr = x && pkDraftOf(x.id, x); if (!dr) return; const pre = pkPosFill(x.packs, dr._pos, true); for (const p of x.packs) dr[p.k].c = pre[p.k]; dr._src = 'pos'; dr._far = 0; dr._t = false; rkPaint(); return; }   // v2.103.65
  if (d.rkpPed) { rk.plEd = rk.plEd === d.rkpPed ? '' : d.rkpPed; if (rk.plEd) start(true); rkPaint(); return; }   // v2.103.33: ginti round chahiye (👀 = ginti)
  if (d.rkpFull) { const [id, k] = d.rkpFull.split('|'), dr = pkDraftOf(id); if (!dr?.[k]) return; dr[k].b = String(Math.ceil(Number(dr[k].c) || 0)); rkPaint(); return; }
  if (d.rkpPsv) { const id = d.rkpPsv, cf = pkCfg(id) || rk.pkNew?.get(id), x = pkAllRows(true).find(y => y.id === id), dr = pkDraftOf(id, x); if (!cf || !x || !dr || !cloud?.setRackPk) return; if (!pkCan()) { notice('Ijazat nahi'); return; }
    const p = {}, t = dr._t; let bad = '';
    for (const pp of x.packs) { const q = dr[pp.k] || {}, o = cf.p?.[pp.k], b = Math.max(0, Math.round(Number(q.b) || 0)), pct = pkQ(), blank = String(q.c ?? '').trim() === '';
      const c = !blank ? Math.max(0, Number(q.c) || 0) : t ? 0 : pp.left;   // v2.103.33: chhua = khaali 0 · na chhua = app ka bacha
      if (!(b > 0)) { if (o) p[pp.k] = o; else if (!blank && Number(q.c) > 0 && t) bad = pkName(pp.z, x.it); continue; }
      p[pp.k] = { n: Math.max(1, pkN(b, c, pct)), a: Math.max(1, b - Math.floor(b * pct / 100)), b, pct, ...(c != null ? { c: r3(c) } : {}) }; }
    if (bad) { notice(`${bad}: 🧺 rack poora bhi likhein`); return; }
    if (!Object.keys(p).length) { notice('🧺 Rack poora — kam az kam ek packet ka likhein'); return; }
    const { _new, ...cf0 } = cf, v = { ...cf0, p, at: Date.now() };   // ginti wahin se · v2.105.5: naya (rk.pkNew) yahin se asal packet item
    const tot = pkTot(x, dr), pos = gmNow(1, id), far = r3(tot - pos), per = Number(x.it.pack) || 0, ctn = per > 1 ? Math.floor(tot / per + 1e-9) : 0, pcs = r3(tot - ctn * (per > 1 ? per : 0));
    itemCfg = { ...(itemCfg || {}), rackPk: { ...(itemCfg?.rackPk || {}), [id]: JSON.stringify(v) } }; rk.plDr.delete(id); rk.pkNew?.delete(id); rk.plEd = ''; rkPaint();
    const go = t && Math.abs(far) > 0.0005, cnt = go && roundNow() && !countLocked();
    Promise.all([cloud.setRackPk(id, v), cnt ? writeCount({ id, name: x.it.name, stock: pos, pack: per }, { ctn, pcs, total: tot }, null, false, 1) : null])
      .then(() => notice(`✓ ${x.it.name} — packet % save${cnt ? ` · ginti ${gmQ(tot, x.it)} (farq ${far > 0 ? '+' : '−'}${gmQ(Math.abs(far), x.it)} POS mein jayega)` : go ? ' · ⚠️ stock ginti chalu nahi — farq POS mein NAHI gaya (Stock → 📋 Nayi ginti)' : ''}`))
      .catch(er => notice('Save nahi hua: ' + (er?.message || er))); return; }
});
document.addEventListener('input', e => { const t = e.target; if (!rk) return;
  if (t?.dataset?.rkpPlq != null) { rk.plq = t.value || ''; clearTimeout(rk.plT); rk.plT = setTimeout(() => { const el = document.getElementById('rkPl'); if (el) el.innerHTML = pkPlInner(pkCan()); }, 160); return; }   // v2.105.5: + 🔍 Packet % mein nahi — ➕ jorein
  if (t?.dataset?.rkpPb || t?.dataset?.rkpPc) { const [id, k] = (t.dataset.rkpPb || t.dataset.rkpPc).split('|'), x = pkAllRows(true).find(y => y.id === id), dr = x && pkDraftOf(id, x); if (!dr?.[k]) return;
    if (t.dataset.rkpPb) dr[k].b = t.value; else { dr[k].c = t.value; dr._t = true; document.querySelectorAll('#rkBody .gm-src').forEach(x => { if (x.closest('.rk-ps.is-in')) x.textContent = '✏️ aap ne likha'; }); }
    for (const pp of x.packs) { const el = document.getElementById(`pkPrev-${id}-${String(pp.k).replace('.', '_')}`); if (el) el.innerHTML = pkPrevHTML(dr[pp.k], { left: dr._t ? 0 : pp.left }, id + '|' + pp.k); }
    const sm = document.getElementById('pkSum-' + id); if (sm) sm.innerHTML = pkSumHTML(x, dr);
    const sv = document.querySelector(`[data-rkp-psv="${CSS.escape(id)}"]`); if (sv) sv.textContent = '✓ Save' + (dr._t ? ' — ginti + %' : ''); }
});
async function rkpGo(g) {
  if (!rk || rk.busy) return; const all = pkDue().filter(y => String(y.g) === String(g)), P = rkPick('p' + g, all.map(y => String(y.r.i))), ys = all.filter(y => P.has(String(y.r.i)));
  const lines = [], noteP = [];
  for (const y of ys) { let qty = 0; const parts = [], pk = [], cq = pkQOf(y); for (const p of y.packs) { const k = String(y.r.i) + '|' + p.z, n = Math.max(0, Math.floor(cq.q.get(p.z) ?? (rk.pQ.has(k) ? rk.pQ.get(k) : p.a))); if (!n) continue; qty += n * p.z; parts.push(`${p.name}×${n}`); pk.push({ z: p.z, n, nm: p.name }); }
    qty = r3(qty); if (!(qty > 0)) continue; lines.push({ id: String(y.r.i), name: y.name, ctn: 0, pcs: qty, pk }); noteP.push(`${y.name} ${parts.join(', ')}`); }
  if (!lines.length) { notice('Koi packet nahi chuna'); return; }
  rk.busy = 'p' + g; rkPaint();
  try { const r = await stockAgentTransfer({ from: Number(g), to: 1, lines, note: '📦 Packet rack bharo' });   // v2.103.33: packet har line par (parchi)
    if (r?.ok || r?.pending) { const t = Date.now(); for (const l of lines) pkSent.set(l.id, t); rk.man.delete('p' + g); notice(r.ok ? `🖨 Packet transfer note ${r.no ? '#' + r.no + ' ' : ''}bana — printer par · larka rack bhar ke ✓ kare` : '⏳ ' + r.why);
      const lb = lines.filter(l => !rk.lbOff.has(String(l.id))); if (lb.length) await rkLabelsGo(lb, 'bhi'); } else notice('⚠️ Nahi bana: ' + (r?.why || 'masla'));   // v2.103.39: 🏷
  } catch (e) { notice('⚠️ ' + (e?.message || e)); }
  if (rk) { rk.busy = ''; rkPaint(); }
}
async function rkGo(g) {
  if (!rk || rk.busy) return; const P = rkGroups(rackDue(), rkQOf).get(String(g)) || [], S = rkPick('r' + g, P), ys = rackDue().filter(y => String(y.x.g) === String(g) && S.has(String(y.x.i)));
  const lines = ys.map(y => { const v = rk.sel.has(String(y.x.i)) ? rk.sel.get(String(y.x.i)) : y.c.q; return y.c.pk ? { id: String(y.x.i), name: y.x.n, ctn: Math.floor(v / y.c.pk), pcs: 0 } : { id: String(y.x.i), name: y.x.n, ctn: 0, pcs: v }; }).filter(l => l.ctn > 0 || l.pcs > 0);
  if (!lines.length) { notice('Koi item nahi chuna'); return; }
  rk.busy = String(g); rkPaint();
  try { const r = await stockAgentTransfer({ from: Number(g), to: 1, lines, note: '🧺 Rack bharo' });
    if (r?.ok || r?.pending) { const lb = lines.filter(l => rk.lbOn.has(String(l.id))); if (lb.length) rkLabelsGo(lb.map(l => ({ ...l, pack: agPool().byId.get(String(l.id))?.pack })), 'bhi');   // v2.103.39: 🏷
      const t = Date.now(); for (const l of lines) { rackSent.set(String(l.id), t); rk.extra.delete(String(l.id)); } rk.man.delete('r' + g); const left = (rkGroups(rackDue(), rkQOf).get(String(g)) || []).length; notice(r.ok ? `🖨 Patti ${r.no ? '#' + r.no + ' ' : ''}printer par (${lines.length} items)${left ? ` — agle ${Math.min(left, rk.n || left)} par ✓ lag gaya` : ' — sab ho gaya ✓'}` : '⏳ ' + r.why); }
    else notice('⚠️ Nahi bana: ' + (r?.why || 'masla'));
  } catch (e) { notice('⚠️ ' + (e?.message || e)); }
  if (rk) { rk.busy = ''; rkPaint(); }
}
document.addEventListener('click', e => {
  const t = e.target.closest?.('[data-rk-all],[data-rk-go],[data-rk-e],[data-rk-sv],[data-rk-au],[data-rk-md],[data-rk-off],[data-rk-on],[data-rkp-set],[data-rkp-go],[data-rkp-ed],[data-rkp-g],[data-rkp-sv],[data-rkp-del],[data-rkp-pg],[data-rk-zall],[data-rk-n],[data-rk-add],[data-rk-hd],[data-rk-pct],[data-rk-pc],[data-rk-g],[data-rk-tab]'); if (!t || !rk || !t.closest('#rkBody')) return; const d = t.dataset;
  if (d.rkTab) { rk.tab = d.rkTab; rkPaint(); rkRecent(); return; }
  if (d.rkG != null) { rk.g = Number(d.rkG) || 0; try { localStorage.setItem('sam-rk-g', String(rk.g)); } catch {} rkPaint(); rkRecent(); return; }   // v2.103.37
  if (d.rkMd || d.rkOff || d.rkOn) { const id = d.rkMd ? d.rkMd.split('|')[0] : (d.rkOff || d.rkOn), old = rackCfg(id) || {};
    const v = d.rkMd ? { ...old, mode: d.rkMd.split('|')[1] || undefined } : d.rkOff ? { ...old, off: true } : { ...old, off: undefined };
    const clean = Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined && x !== '' && x !== false)), nv = Object.keys(clean).length ? clean : null;
    if (d.rkOff && !confirm('Ye item rack list mein kabhi nahi aayega (nahi lana / sirf godam se bikta hai). Theek?')) return;
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
  if (d.rkAdd) { const id = String(d.rkAdd), isPk = !!pkCfg(id) && (rackPk || []).some(r => String(r.i) === id); rk.pkx = rk.pkx || new Set(); if (isPk) rk.pkx.add(id); else rk.extra.set(id, 1);   // v2.103.82: tap = Lane wale list mein sab se upar (packet wala = packet-war line)
    const nm = agPool().byId.get(id)?.name || 'Item'; notice(`➕ ${nm} — Lane wale list mein upar (tadad badal kar patti print)`); rk.q = ''; rk.tab = 'lane'; const qi = document.querySelector('[data-rk-q]'); if (qi) qi.value = ''; rkPaint(); try { $('rkBody')?.scrollTo?.({ top: 0 }); document.getElementById('dialogBody')?.scrollTo?.({ top: 0 }); } catch {} return; }
  if (d.rkPc) { const [id, v] = d.rkPc.split('|'), old = rackCfg(id) || {}, nv = { ...old, pct: Number(v) || 0 }; if (!cloud?.setRackCfg) return;   // v2.103.31: item ka apna %
    itemCfg = { ...(itemCfg || {}), rack: { ...(itemCfg?.rack || {}), [id]: Number(v) ? nv : Object.fromEntries(Object.entries(nv).filter(([k]) => k !== 'pct')) } }; rkPaint();
    cloud.setRackCfg(id, nv).then(() => notice(Number(v) ? `📊 Is item ka % ${v}` : '📊 Sab wala %')).catch(er => notice('Save nahi hua: ' + (er?.message || er))); return; }
  if (d.rkPct != null && !isOwner()) { const v = Number(d.rkPct); if (!rkMineOk()) { notice('🔒 Apna % chunne ki ijazat nahi — malik wala chal raha hai'); return; } rkMineSet('pct', v); rk.man.clear(); rkPaint(); notice(`👤 Aap ka %: ${v ? v + '% ya kam bache to lao (packet bhi)' : 'Sab (% ki shart nahi · packet 20%)'} — sirf aap ke phone par`); return; }   // v2.105.4
  if (d.rkHd != null && !isOwner()) { const v = Number(d.rkHd); if (!rkMineOk()) { notice('🔒 Apni hadd chunne ki ijazat nahi — malik wali chal rahi hai'); return; } rkMineSet('lo', v); rk.man.clear(); rkPaint(); notice(`👤 Aap ki hadd: dukan mein ${rkHdName(v)} reh jaye to lao — sirf aap ke phone par`); return; }
  if (d.rkPct != null) { const v = Number(d.rkPct); if (!cloud?.setRackPct) { notice('App update karein'); return; } itemCfg = { ...(itemCfg || {}), rackPct: v }; rk.man.clear(); rkPaint(); cloud.setRackPct(v).then(() => notice(v ? `📊 Qaida ${v}% — itna ya kam bache to lao (packet bhi)` : '📊 Sab (% ki shart nahi · packet 20%)')).catch(er => notice('Save nahi hua: ' + (er?.message || er))); return; }
  if (d.rkHd != null) { const v = Number(d.rkHd); if (!cloud?.setRackLo) { notice('App update karein'); return; } itemCfg = { ...(itemCfg || {}), rackLo: v }; rk.man.clear(); rkPaint(); cloud.setRackLo(v).then(() => notice(`📉 Hadd: dukan mein ${rkHdName(v)} reh jaye to lao`)).catch(er => notice('Save nahi hua: ' + (er?.message || er))); return; }
  if (d.rkN != null) { rk.n = Math.max(0, Number(d.rkN) || 0); try { localStorage.setItem('sam-rk-n', String(rk.n)); } catch {} rk.man.clear(); rkPaint(); return; }
  if (d.rkGo) { rkGo(d.rkGo); return; }
  if (d.rkE) { rk.ed = rk.ed === d.rkE ? '' : d.rkE; rkPaint(); return; }
  if (d.rkSv || d.rkAu) { const id = d.rkSv || d.rkAu, u = Number($('rkBody').querySelector(`[data-rk-u="${CSS.escape(id)}"]`)?.value) || 0, w = Number($('rkBody').querySelector(`[data-rk-w="${CSS.escape(id)}"]`)?.value) || 0, bb = Number($('rkBody').querySelector(`[data-rk-b="${CSS.escape(id)}"]`)?.value) || 0;
    const keep = Object.fromEntries(Object.entries(rackCfg(id) || {}).filter(([k]) => k === 'mode' || k === 'off' || k === 'pct')), v0 = d.rkAu ? keep : { ...keep, ...(u > 0 ? { u } : {}), ...(w > 0 ? { q: w } : {}), ...(bb > 0 ? { b: bb } : {}) }, v = Object.keys(v0).length ? v0 : null;
    if (!cloud?.setRackCfg) { notice('App update karein'); return; }
    itemCfg = { ...(itemCfg || {}), rack: { ...(itemCfg?.rack || {}), [id]: v } }; rk.ed = ''; rk.sel.delete(id); rkPaint();
    cloud.setRackCfg(id, v).then(() => notice(v ? '✓ Qaida save' : '↺ Ab khud hisaab')).catch(er => notice('Save nahi hua: ' + (er?.message || er)));
    const nb = d.rkAu ? 0 : bb; if (nb !== rackBOf(id) && cloud?.setRackB) { const rb = { ...(itemCfg?.rackB || {}) }; if (nb) rb[id] = Math.round(nb); else delete rb[id]; itemCfg = { ...itemCfg, rackB: rb }; rkPaint(); cloud.setRackB(id, nb || null).catch(er => notice('100% save nahi hua: ' + (er?.message || er))); } }
});
document.addEventListener('change', e => { const t = e.target; if (!rk || !t.closest?.('#rkBody')) return; const d = t.dataset;
  if ((d.rkT || d.rkpT) && t.checked) { const T = rkTransit().get(String(d.rkT || d.rkpT)); if (T && !confirm(`TN ${T.tn} abhi raste mein hai (${rkAgo(T.at)} pehle nikla). Phir bhi naya note?`)) { t.checked = false; return; } }   // v2.103.87
  if (d.rkT) { const y = rackDue().find(z => String(z.x.i) === d.rkT); if (y) { const g = String(y.x.g); rkToggle('r' + g, rkGroups(rackDue(), rkQOf).get(g) || [], d.rkT, t.checked); } rkPaint(); return; }
  if (d.rkpLb) { if (t.checked) rk.lbOff.delete(d.rkpLb); else rk.lbOff.add(d.rkpLb); rkPaint(); return; }   // v2.103.39
  if (d.rkLb) { if (t.checked) rk.lbOn.add(d.rkLb); else rk.lbOn.delete(d.rkLb); rkPaint(); return; }
  if (d.rkpT) { const y = pkDue().find(z => String(z.r.i) === d.rkpT); if (y) { const g = String(y.g); rkToggle('p' + g, pkDue().filter(z => String(z.g) === g).map(z => String(z.r.i)), d.rkpT, t.checked); } rkPaint(); return; }
  if (d.rkpQ) { rkQtySet(t); return; }   // v2.119.0: paint nahi (Enter = agla)
  if (d.rkpCap) { rk.capOff = rk.capOff || new Set(); if (t.checked) rk.capOff.delete(d.rkpCap); else rk.capOff.add(d.rkpCap); rkPaint(); return; }   // v2.103.83
  if (d.rkpZ) { const [id, z] = d.rkpZ.split('|'), dr = rk.pDraft.get(id); if (dr) { if (t.checked) dr.p[z] = dr.p[z] || { n: '', a: '' }; else delete dr.p[z]; } rkPaint(); return; }
  if (d.rkpN || d.rkpA) { const [id, z] = (d.rkpN || d.rkpA).split('|'), dr = rk.pDraft.get(id); if (dr?.p[z]) dr.p[z][d.rkpN ? 'n' : 'a'] = Number(t.value) > 0 ? Math.floor(Number(t.value)) : ''; return; }
  if (d.rkQty) { rkQtySet(t); const y = rk._lane?.N.find(z => String(z.x.i) === d.rkQty); if (y) { const v = rk.sel.get(d.rkQty) ?? 0, show = y.c.pk ? Math.floor(v / y.c.pk) : v; if (Number(t.value) > show) { t.value = String(show); notice(`🏬 Godam mein itna hi — ${y.c.pk ? show + ' ctn' : show + ' pcs'}`); } } } });   // v2.119.0: paint nahi
document.addEventListener('input', e => { const t = e.target; if (rk && t?.dataset?.rkpQs != null) { rk.pq = t.value || ''; clearTimeout(rkQT); rkQT = setTimeout(() => rkPaint('pk'), 160); return; } if (rk && t?.dataset?.rkQ != null) { rk.q = t.value || ''; clearTimeout(rkQT); rkQT = setTimeout(() => rkPaint(true), 160); } });
let rkQT = 0;
document.addEventListener('close', e => { if (e.target?.id === 'dialog' && rk) { rk = null; rkUnwatch(); if (document.querySelector('.th-root')) rerender(); } }, true);   // v2.103.88: Mangwao listener band
export const _rkTest = { pkDue, rackCalc, rackDue, rackLocalRows, set rows(v) { rackRows = v; }, set cfg(v) { itemCfg = v; } };
// v2.105.8: 🏬 GODAM-WISE DASHBOARD (malik: Transfer notes screen ki tasveer — "yahan par har godam wise dashboard aaye"). Har godam (POS branch, naam se;
//   dukan = 1 nahi) ka dabba: aaj ke note · 📤 gaya / 📥 aaya ctn + pcs (wahi ⚖️ carton ginti jo upar) · ⏳ check baqi / ⏰ late / ⚠️ farq (pichhle 2 din, sirf
//   usi godam ke). Dabba dabao = neeche list sirf us godam ke notes (patti "✕ Sab"). Phone par ek qatar side scroll. CAP stock.thgodam / tr.godam. Yahan AI nahi.
let thG = 0;
const thTot = list => { let c = 0, ca = 0, p = 0; for (const t of list) for (const l of t.lines || []) { const x = cp(Number(l.qty) || 0, Number(l.pack) || 0); c += ctnG(x.c, ctnOf(l.itemId, l.name)); ca += x.c; p += x.p; } return { c: r2(c), ca: r2(ca), p: Math.round(p * 1000) / 1000 }; };
function thGodamStats(all, td) {
  const names = collect().names || {}, set = new Set((collect().branches || []).map(Number).filter(b => b && b !== 1 && b !== JAMA));
  for (const t of all) for (const b of [Number(t.from), Number(t.to)]) if (b && b !== 1 && b !== JAMA) set.add(b);
  return [...set].sort((a, b) => a - b).map(g => {
    const mine = t => Number(t.from) === g || Number(t.to) === g, tdG = td.filter(mine), o = tdG.filter(t => Number(t.from) === g), i = tdG.filter(t => Number(t.to) === g);
    const st = all.filter(t => mine(t) && Date.now() - tcIssued(t) < 2 * 864e5).map(t => tcState(t).k);
    return { g, name: branchName(g, names), n: tdG.length, nOut: o.length, nIn: i.length, out: thTot(o), inn: thTot(i), pend: st.filter(k => k === 'wait' || k === 'late').length, late: st.filter(k => k === 'late').length, farq: st.filter(k => k === 'farq').length };
  });
}
function thgCard(x) {
  const cls = x.farq || x.late ? 'bad' : x.pend ? 'w' : 'ok', q = v => `${num(v.c)} <small>ctn</small>${v.p ? ` + ${num(v.p)} <small>pcs</small>` : ''}`;
  return `<button type="button" class="thg ${cls}${thG === x.g ? ' is-in' : ''}" data-th-g="${x.g}" aria-pressed="${thG === x.g}"><span class="thg-h"><b>🏬 ${esc(x.name)}</b><i>${x.farq ? '⚠️ ' + x.farq : x.late ? '⏰ ' + x.late : x.pend ? '⏳ ' + x.pend : '✓'}</i></span>`
    + `<span class="thg-n">${x.n ? `<b>${x.n}</b> note aaj` : 'aaj koi note nahi'}</span>`
    + (x.nOut ? `<span class="thg-l">📤 Gaya <b>${q(x.out)}</b></span>` : '') + (x.nIn ? `<span class="thg-l">📥 Aaya <b>${q(x.inn)}</b></span>` : '')
    + `<span class="thg-s"><em class="${x.pend ? 'w' : ''}">⏳ ${x.pend}</em><em class="${x.late ? 'bad' : ''}">⏰ ${x.late}</em><em class="${x.farq ? 'bad' : ''}">⚠️ ${x.farq}</em></span></button>`;
}
export function thGodamNow() {   // agent / test ke liye — wahi hisaab jo dabbon par
  thWatch(); const today = regDay(Date.now()), all = tcAll().filter(t => t && !t.cancelled && !tcHisaab(t) && t.at >= Date.now() - 3 * 864e5), td = all.filter(t => regDay(t.at) === today);
  return thGodamStats(all, td).map(x => ({ godam: x.name, aaj_note: x.n, gaya: `${num(x.out.c)} ctn${x.out.p ? ' + ' + num(x.out.p) + ' pcs' : ''} (${x.nOut} note)`, aaya: `${num(x.inn.c)} ctn${x.inn.p ? ' + ' + num(x.inn.p) + ' pcs' : ''} (${x.nIn} note)`, check_baqi: x.pend, late: x.late, farq: x.farq }));
}
export function renderTransferHub(canDo = () => true) {
  thWatch(); rackWatch(); canDoRk = canDo;
  const names = collect().names || {}, today = regDay(Date.now()), y = new Date(); y.setDate(y.getDate() - 1); const yest = regDay(y.getTime());
  const all = tcAll().filter(t => t && !t.cancelled && t.at >= Date.now() - 3 * 864e5).sort((a, b) => b.at - a.at);
  // v2.99.80: malik — "register se carton piece": ⚖️ carton ginti (jaise 4 = 1) wahi jo Transfer register mein; asal (ca) chhota sa
  const tot = thTot;
  const allP = all.filter(t => !tcHisaab(t)), td = allP.filter(t => regDay(t.at) === today), T = tot(td);   // v2.116.0: upar ka jor = asal hila maal ("sirf hisaab" note neeche list mein, jor mein nahi)
  const gStat = canDo('stock.thgodam') ? thGodamStats(allP, td) : [];   // v2.105.8: 🏬 godam-wise
  if (thG && !gStat.some(x => x.g === thG)) thG = 0;
  const gCards = gStat.length ? `<div class="thg-row">${gStat.map(thgCard).join('')}</div>` : '';
  const st = all.filter(t => Date.now() - tcIssued(t) < 2 * 864e5).map(t => tcState(t).k), pend = st.filter(k => k === 'wait' || k === 'late').length, late = st.filter(k => k === 'late').length, farq = st.filter(k => k === 'farq').length;
  const job = (trList || []).find(j => j.status !== 'done' && j.status !== 'failed' && Date.now() - j.at < 10 * 60000);
  $('summary').innerHTML = `<div class="thh"><div class="thh-head"><span class="thh-ic">⇄</span><div><small>GODAM SE GODAM</small><b>Transfer notes</b></div>${job ? '<span class="thh-pill wait">⏳ PC bana raha hai</span>' : `<span class="thh-pill">${td.length} aaj</span>`}</div>
    <div class="thh-bal"><strong>${num(T.c)} <small>Ctn</small>${T.p ? ` + ${num(T.p)} <small>Pcs</small>` : ''}</strong><span>aaj ${td.length} note · ${td.reduce((n, t) => n + (t.lines || []).length, 0)} items${T.c !== T.ca ? ` · <em class="thh-asal">asal ${num(T.ca)} ctn</em>` : ''}</span></div>
    <div class="thh-stats"><div class="${pend ? 'w' : 'ok'}"><span>${pend ? '⏳' : '✓'}</span><div><small>Check baqi</small><b>${pend}</b></div></div><div class="${late ? 'bad' : 'ok'}"><span>⏰</span><div><small>Late (2 ghante+)</small><b>${late}</b></div></div><div class="${farq ? 'bad' : 'ok'}"><span>⚠️</span><div><small>Farq</small><b>${farq}</b></div></div></div>${gCards}</div>`;
  const stChip = t => { const s = tcState(t); return s.k === 'hisaab' ? '<span class="th-chip hs">⚖️ Sirf hisaab</span>' : s.k === 'ok' ? '<span class="th-chip ok">✓ Pohancha</span>' : s.k === 'farq' ? '<span class="th-chip bad">⚠️ Farq</span>' : s.ng ? '<span class="th-chip bad">📦 De diya tick nahi</span>' : s.k === 'late' ? `<span class="th-chip bad">⏰ ${tcAgo(s.age)}</span>` : `<span class="th-chip w">⏳ ${tcAgo(s.age)}</span>`; };
  const own = isOwner();
  const row = (t, dd) => { const x = tot([t]); const k = esc(tcKey(t)); return `<div class="th-rw"><button type="button" class="th-row" data-th-tc="${k}" data-th-d="${dd}"><span class="th-tn">TN<b>${esc(String(t.transferNo || '').replace(/^0+/, '') || '—')}</b></span><span class="th-mid"><b>${esc(branchName(t.from, names))} ➜ ${esc(branchName(t.to, names))}</b><small>${(t.lines || []).length} items · ${num(x.c)} ctn${x.p ? ' + ' + num(x.p) + ' pcs' : ''}${x.c !== x.ca ? ' (asal ' + num(x.ca) + ')' : ''} · ${esc(regClock(t.at))}${t.app ? ' · 📱' : ''}${Number(t.editCount) > 0 ? ' · ✏️' : ''}</small></span>${stChip(t)}</button>${own ? `<details class="th-more"><summary aria-label="Aur">⋯</summary><div><button type="button" data-th-prn="${esc(String(t.transferId))}">🖨 Dobara print</button><button type="button" data-th-edit="${esc(String(t.transferId))}">✏️ Edit</button><button type="button" class="danger" data-th-cancel="${esc(String(t.transferId))}">❌ Cancel</button></div></details>` : ''}</div>`; };
  const allF = thG ? all.filter(t => Number(t.from) === thG || Number(t.to) === thG) : all;   // v2.105.8: 🏬 chuna hua godam
  const grp = [[today, 'Aaj'], [yest, 'Kal']].map(([d, l]) => { const g = allF.filter(t => regDay(t.at) === d); return g.length ? `<section class="th-day"><div class="th-dh"><b>${l}</b><span>${g.length} note</span></div>${g.slice(0, 40).map(t => row(t, d === today ? 1 : 2)).join('')}</section>` : ''; }).join('');
  const tile = (k, ic, t, sub, cls) => `<button type="button" class="th-tile ${cls}" data-th="${k}" data-mn="th.${k}" data-mn-keep="1" data-mn-i="${ic}" data-mn-t="${esc(t)}" data-mn-s="${esc(String(sub).replace(/<[^>]*>/g, ''))}" data-mn-g="⇄ Transfer"><span>${ic}</span><b>${t}</b><small>${sub}</small></button>`;   // v2.105.0: chhote + ⋮
  $('list').innerHTML = `<div class="th-root"><div class="th-tiles">${canDo('stock.transfer') ? tile('new', '➕', 'Naya transfer note', 'Sirf majood maal · Ctn mein · ⤓ Sara', 'a') : ''}${canDo('stock.g2milao') && collect().branches.some(b => b !== 1) ? tile('g2m', '🧮', 'Stock milao', 'Dukan + godam ginti · 📊 % bacha · live', 'b') : ''}${canDo('stock.rack') ? (() => { const n = rackDue().length + pkDue().length; return tile('rack', '🧺', 'Rack bharo', (n ? `${n} items godam se lane` : rackAt || irData ? 'Sab rack bhare ✓' : 'Data aa raha hai') + (rackZero.length && isOwner() ? ` · ⚠️ ${rackZero.length} pcs 0` : ''), 'c' + (n ? ' rk-hot' : '')).replace('</button>', n ? `<i class="rk-badge">${n}</i></button>` : '</button>'); })() : ''}${canDo('stock.tc') ? tile('tc', '🧾', 'Transfer check', pend ? pend + ' baqi · scan karein' : 'Maal pohancha? Scan', 'b') : ''}${canDo('stock.reg') ? tile('reg', '📋', 'Transfer register', 'Din-war · PDF', 'c') : ''}${canDo('tr.barcode') && canDo('v:barcode') ? tile('bc', '🏷', 'Barcode', 'Label ginti · godam-war' + (isOwner() || canDo('tr.bcpaisa') ? ' · 💰 mazdoori' : ''), 'a') : ''}${canDo('v:irep') ? tile('irep', '📊', 'Item report', 'Item-war bikri', 'b') : ''}${canDo('v:larka') ? tile('larka', '👦', 'Larka report', 'Har larke ki sale', 'c') : ''}</div>
    ${thG ? `<div class="thg-pill"><span>🏬 Sirf <b>${esc(branchName(thG, names))}</b> ke notes</span><button type="button" data-th-g="0">✕ Sab</button></div>` : ''}${grp || (thG ? `<div class="th-empty">🏬<b>${esc(branchName(thG, names))} — aaj / kal koi note nahi</b><small>"✕ Sab" se poori list</small></div>` : '<div class="th-empty">⇄<b>Aaj / kal koi transfer note nahi</b><small>"Naya transfer note" se banayein</small></div>')}</div>`;
}
document.addEventListener('click', e => { const b = e.target.closest?.('[data-th],[data-th-reg],[data-th-tc],[data-th-prn],[data-th-edit],[data-th-cancel],[data-th-g]'); if (!b) return; const d = b.dataset;
  if (d.thG != null) { const g = Number(d.thG) || 0; thG = thG === g ? 0 : g; rerender(); if (thG) setTimeout(() => document.querySelector('.thg-pill')?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }), 80); return; }   // v2.105.8: 🏬
  if (d.thTc) { tcDays = Number(d.thD) === 2 ? 2 : 1; tcDir = 'all'; tcOpen.add(d.thTc); openTransferCheck('nikle');   // v2.99.68: note par tap = us ka check
    setTimeout(() => { const el = [...document.querySelectorAll('[data-tc-open]')].find(x => x.dataset.tcOpen === d.thTc); if (el) { el.scrollIntoView({ block: 'center' }); el.closest('.tc-n')?.classList.add('tc-flash'); } }, 500); return; }
  if (d.thPrn || d.thEdit || d.thCancel) { thAct(d, b); return; }
  const k = d.th || 'reg';
  if (k === 'bc' || k === 'irep' || k === 'larka') { try { window.ntFromTransfer?.(k === 'bc' ? 'barcode' : k); } catch {} return; }   // v2.111.0: ‹ wapas = Transfer
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
    return trCalc({ id: l.itemId, name: l.name || it.name || 'Item', pack: pk, cName: it.cName || 'Ctn', uName: it.uName || 'Pcs', ctn: c, pcs: pk > 1 ? Math.round((q - c * pk) * 1000) / 1000 : q, qty: 0, ...(Array.isArray(l.pk) && l.pk.length ? { pk: l.pk.map(p => ({ ...p })) } : {}) }); });
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

// ============================================================================================================
// v2.103.47: 🧩 AGENT ACTIONS — malik: "agent ko poori app ka access: har chip, har qaida; likh kar kaam". Har action WAHI function jo button
//   chalata hai (sab purane check khud). read = foran; baqi = card → ✓ (agent.js). Naya feature = yahan uska action bhi (CLAUDE.md qaida).
// ============================================================================================================
import { agentRegister } from './agent.js?v=2.127.0';
import { recentPush } from './recent.js?v=2.127.0';   // v2.103.61: 🕘 haal hi ki khirkiyan
const RK_TABN = { lane: 'Lane wale', pend: 'Rack bhara?', pct: 'Packet %', ro: 'Mangwao' };
function rkRecent() { if (!rk) return; recentPush({ key: 'rack', icon: '🧺', label: 'Rack · ' + (RK_TABN[rk.tab] || rk.tab) + (rk.g ? ' · ' + branchName(rk.g, collect().names) : ''), open: { kind: 'stock', screen: 'rack', g: rk.g || 0, tab: rk.tab } }); }
// v2.103.61: 🕘 recent chip se khirki wapas (app.js window.ntRecentOpen → yahan)
export function stockScreenOpen(o = {}) { try { $('dialog')?.close(); } catch {}
  if (o.screen === 'rack') { rackOpen(); if (o.g != null && collect().branches.includes(Number(o.g))) rk.g = Number(o.g); if (o.tab && RK_TABN[o.tab]) rk.tab = o.tab; rkPaint(); rkRecent(); }
  else if (o.screen === 'milao') gmOpen(); else if (o.screen === 'ratelist') rpOpen(); else if (o.screen === 'transfer') openTransfer(); else if (o.screen === 'check') openTransferCheck(o.view || 'nikle'); else if (o.screen === 'register') openRegister(); else if (o.screen === 'ginti') openGinti(); else if (o.screen === 'ijobs') ijDlg(); else if (o.screen === 'band') bandDlg(o.q || '');
  else if (o.screen === 'factory') { facOnly = true; inPick = null; const s = $('search'); if (s) s.value = ''; limit = PAGE; rerender(); }   // v2.107.0: 🏭 Factory stock
  else if (o.screen === 'roz') { if (o.k) rozEnter(String(o.k)); else stockRozOpen(); }   // v2.109.0: 📋 roz ki ginti
  else if (o.screen === 'farq') farqOpenNow(); }   // v2.113.0: ⚖️ stock farq
const AG = (() => {
  const S_ = { type: 'STRING' }, N_ = { type: 'NUMBER' }, B_ = { type: 'BOOLEAN' }, A_ = it => ({ type: 'ARRAY', items: it }), O_ = (p, r = []) => ({ type: 'OBJECT', properties: p, required: r });
  const names = () => collect().names || {};
  const gods = () => (collect().branches || []).filter(b => b !== JAMA);
  function godam(v, allowDukan = true) { if (v == null || v === '') return null; const q = fold(String(v)); const g = gods().find(b => fold(branchName(b, names())) === q) ?? gods().find(b => fold(branchName(b, names())).includes(q) || q.includes(fold(branchName(b, names())))) ?? (/^\d+$/.test(q) ? Number(q) : null);
    if (g == null || !gods().includes(g)) throw Error(`Godam "${v}" nahi mila — ${gods().map(b => branchName(b, names())).join(' / ')}`); if (!allowDukan && g === 1) throw Error('Dukan nahi, godam chunein'); return g; }
  function item(v) { const q = String(v ?? '').trim(); if (!q) throw Error('Item ka naam likhein'); const P = agPool(); const byId = P.byId.get(q); if (byId) return byId;
    const L = smartSearch(P.list, q, 6); if (!L.length) throw Error(`Item "${q}" nahi mila`); const fq = fold(q), ex = L.filter(x => fold(x.name) === fq); if (ex.length === 1) return ex[0];
    const ws = fq.split(' ').filter(Boolean), full = L.filter(x => ws.every(w => fold(x.name).includes(w))); if (full.length === 1) return full[0]; if (L.length === 1) return L[0];
    const e = Error(`"${q}" — kaun sa item? ${L.slice(0, 5).map(x => x.name).join(' / ')}`); e.cands = L.slice(0, 5).map(x => ({ item_id: x.id, name: x.name })); throw e; }
  // v2.105.9: CHALU karte waqt item POS se ghaib (deactive) ho sakta hai — pehle ⛔ band list mein dhoondo
  function bandItem(v, band) { if (band) return item(v); const q = String(v ?? '').trim(), L = bandAll(), byId = L.find(b => b.id === q); if (byId) return byId;
    const fq = fold(q), ex = L.filter(b => fold(b.name) === fq), H = ex.length ? ex : L.filter(b => fold(b.name).includes(fq)); if (H.length === 1) return H[0];
    if (H.length > 1) { const e = Error(`"${q}" — kaun sa band item? ${H.slice(0, 5).map(b => b.name).join(' / ')}`); e.cands = H.slice(0, 5).map(b => ({ item_id: b.id, name: b.name })); throw e; } return item(v); }
  const stAll = id => { const o = {}; for (const b of gods()) { const x = saleStockItem(b, String(id)); if (x) o[branchName(b, names())] = r3(Number(x.stock) || 0); } return o; };
  const ctnTxt = (q, pk) => pk > 1 ? `${num(Math.floor(q / pk))} ctn${q % pk ? ' + ' + num(r3(q - Math.floor(q / pk) * pk)) : ''}` : `${num(q)} pcs`;
  const lineOf = (x, it) => { const pk = Number(it.pack) || 0, ctn = Math.max(0, Number(x.ctn) || 0), pcs = Math.max(0, Number(x.pcs) || 0); if (!ctn && !pcs) throw Error(it.name + ': ctn ya pcs likhein'); return { id: String(it.id), name: it.name, ctn: pk > 1 ? ctn : 0, pcs: pk > 1 ? pcs : pcs + ctn }; };
  const needRk = () => { if (!rk) { rackWatch(); start(false); } roWatch(); };
  return [
    // ---------- PARHO ----------
    { name: 'stock_dekho', read: true, desc: 'Item ka stock har jagah (dukan + godam), rate, 1 ctn = pcs, barcode.', params: O_({ item: S_ }, ['item']),
      run({ item: v }) { const it = item(v), pk = Number(it.pack) || 0; return { item_id: it.id, name: it.name, ctn_pcs: pk, stock: stAll(it.id), rate_retail: it.rate2 || it.rate, rate_wholesale: it.ws || it.wrate || 0, cat: it.cat || '', barcode: it.code || '', packets: (it.bq || []).map(b => pkName(Number(b.q) || 1, it)) }; } },
    { name: 'godam_list', read: true, desc: 'Sab godam / dukan ke naam.', params: O_({}), run: () => ({ list: gods().map(b => ({ branch: b, name: branchName(b, names()), dukan: b === 1 })) }) },
    { name: 'rack_list', read: true, desc: 'Rack bharo: dukan ke rack ke liye godam se LANE wale items (carton) + packet-war. godam do to sirf us ka.', params: O_({ godam: S_ }),
      run({ godam: g }) { needRk(); const gg = g ? godam(g, false) : 0; const L = rackDue().filter(y => !gg || Number(y.x.g) === gg).map(y => ({ item_id: String(y.x.i), name: y.x.n, godam: branchName(Number(y.x.g), names()), lao: ctnTxt(y.c.q, y.c.pk), dukan_mein: r3(y.c.ss), wajah: y.c.khali ? 'rack khali' : y.c.lo ? 'kam' : y.c.pct != null ? y.c.pct + '% bacha' : 'nikla' }));
        const P = pkDue().filter(y => !gg || Number(y.g) === gg).map(y => ({ item_id: String(y.r.i), name: y.name, godam: branchName(y.g, names()), packets: y.packs.map(p => `${p.name} × ${p.a}` + (p.b ? ` (${p.left}/${p.b} bache)` : '')) }));
        return { pc_data: rackAt ? new Date(rackAt).toLocaleTimeString('en-PK') : 'nahi', carton: L, packet: P, pending_patti: rkPend().length }; } },
    { name: 'rack_pending', read: true, desc: '⏳ Patti nikli — rack bhar gaya? wali list (TN, items jin ka ✓ baqi).', params: O_({}),
      run() { needRk(); return { list: rkPend().map(x => ({ tn: String(x.j.transferNo || '').replace(/^0+/, ''), job: x.j.id, se: branchName(Number(x.j.from), names()), kab: new Date(x.j.at).toLocaleString('en-PK'), baqi_items: x.lines.map(l => ({ item_id: String(l.itemId), name: l.name, qty: rkLineQ(l) })) })) }; } },
    { name: 'mangwao_list', read: true, desc: 'Supplier se mangwane wale items (godam ka kul stock vs poora): pct = itna % ya kam (10/20/30/40), warna 40. supplier filter.', params: O_({ pct: N_, supplier: S_ }),
      run({ pct, supplier }) { needRk(); const lim = [10, 20, 30, 40].includes(Number(pct)) ? Number(pct) : 40, fs = supplier ? fold(supplier) : '';
        const L = roRows().filter(r => (r.t > 0 && r.pct != null && r.pct <= lim || r.dm) && (!fs || fold(r.party).includes(fs))).sort((a, b) => (a.pct ?? 999) - (b.pct ?? 999)).slice(0, 60);
        return { pc_data: ro.at ? new Date(ro.at).toLocaleString('en-PK') : 'nahi', list: L.map(r => ({ item_id: r.id, name: r.x.n, supplier: r.party, rate: r.rate, parties: r.ps.map(o => `${o.p} ×${o.n}${o.r > 0 ? ' @ ' + o.r : ''}`).join(' · '), sasta: r.cheap ? `${r.cheap.p} @ ${r.cheap.r}` : '', kul: r.tot, poora: r.t, pct: r.pct, lao: r.lao, aakhri: r.last ? `${roWhen(r.last.at)}: ${r.last.q} aaya, us waqt ${Math.max(0, r.last.pre)} tha` : '', demand: r.dm ? (r.dm.byName || 'larka') + ': ' + (r.dm.lvl === 'out' ? 'khatam' : 'kam') : '' })) }; } },
    { name: 'packet_list', read: true, desc: 'Packet % wale items: har packet kitna bacha / poora, hadd %. item do to sirf wo.', params: O_({ item: S_ }),
      run({ item: v }) { needRk(); let L = pkAllRows(); if (v) { const it = item(v); L = L.filter(x => x.id === String(it.id)); } return { list: L.slice(0, 80).map(x => ({ item_id: x.id, name: x.it.name, packets: x.packs.map(p => ({ packet: pkName(p.z, x.it), bacha: p.left, poora: p.b, pct_bacha: p.now, hadd: p.pct })) })) }; } },
    { name: 'demand_list', read: true, desc: 'Larkon ki demand (khatam / kam) jo abhi open hai.', params: O_({}), run() { needRk(); return { list: roDm.map(d => ({ item_id: String(d.i), name: d.n, kya: d.lvl === 'out' ? 'khatam' : 'kam', kis_ne: d.byName || '', kab: d.at ? new Date(d.at).toLocaleString('en-PK') : '' })) }; } },
    { name: 'transfer_list', read: true, desc: 'Aakhri 14 din ke transfer notes (app se bane).', params: O_({ limit: N_ }),
      run({ limit }) { return { list: (trList || []).filter(j => j.status === 'done' && j.op === 'create').slice(0, Math.min(40, Number(limit) || 15)).map(j => ({ tn: String(j.transferNo || '').replace(/^0+/, ''), job: j.id, se: branchName(Number(j.from), names()), ko: branchName(Number(j.to), names()), kab: new Date(j.at).toLocaleString('en-PK'), note: j.note || '', items: (j.lines || []).map(l => l.name + ' ' + rkLineQ(l)) })) }; } },
    { name: 'screen_kholo', read: true, icon: '📱', desc: 'App ki screen kholo: rack (rack bharo), milao (stock milao), ratelist (rate list PDF), transfer (naya transfer note), check (transfer check).', params: O_({ screen: { type: 'STRING', enum: ['rack', 'milao', 'ratelist', 'transfer', 'check'] }, godam: S_, tab: { type: 'STRING', enum: ['lane', 'pend', 'pct', 'ro'] } }, ['screen']),
      run({ screen, godam: g, tab }) { try { $('dialog')?.close(); } catch {} if (screen === 'rack') { rackOpen(); if (g) { rk.g = godam(g, false); } if (tab) rk.tab = tab; rkPaint(); } else if (screen === 'milao') gmOpen(); else if (screen === 'ratelist') rpOpen(); else if (screen === 'transfer') openTransfer(); else if (screen === 'check') openTransferCheck('scan'); return { khul_gayi: screen }; } },
    // ---------- KAAM (card → ✓) ----------
    { name: 'rack_patti', icon: '🧺', label: 'Rack patti (godam → dukan)', desc: 'Rack bharo ki patti: godam se dukan ka transfer note + print. items na do to us godam ki poori LANE WALI list (jo app ne nikali). items: [{item, ctn|pcs}]. label=true to barcode label bhi.', params: O_({ godam: S_, items: A_(O_({ item: S_, ctn: N_, pcs: N_ })), label: B_ }, ['godam']),
      summary({ godam: g, items, label }) { needRk(); const gg = godam(g, false); const L = items?.length ? items.map(x => { const it = item(x.item); return `${it.name} ${ctnTxt((Number(x.ctn) || 0) * (Number(it.pack) || 1) + (Number(x.pcs) || 0), Number(it.pack) || 0)}`; }) : rackDue().filter(y => Number(y.x.g) === gg).map(y => `${y.x.n} ${ctnTxt(rkQOf(y), y.c.pk)}`); if (!L.length) throw Error(branchName(gg, names()) + ' se abhi kuch lane wala nahi'); return `${branchName(gg, names())} → ${branchName(1, names())}: ${L.join(' · ')}${label ? ' · 🏷 label bhi' : ''}`; },
      async run({ godam: g, items, label }) { needRk(); const gg = godam(g, false); const lines = items?.length ? items.map(x => lineOf(x, item(x.item))) : rackDue().filter(y => Number(y.x.g) === gg).map(y => { const v = rkQOf(y); return y.c.pk ? { id: String(y.x.i), name: y.x.n, ctn: Math.floor(v / y.c.pk), pcs: 0 } : { id: String(y.x.i), name: y.x.n, ctn: 0, pcs: v }; }).filter(l => l.ctn > 0 || l.pcs > 0);
        if (!lines.length) throw Error('Koi item nahi'); const r = await stockAgentTransfer({ from: gg, to: 1, lines, note: '🧺 Rack bharo' }); if (!(r?.ok || r?.pending)) throw Error(r?.why || 'Nahi bana');
        const t = Date.now(); for (const l of lines) rackSent.set(String(l.id), t); if (label) await rkLabelsGo(lines.map(l => ({ ...l, pack: agPool().byId.get(String(l.id))?.pack })), 'bhi'); if (rk) rkPaint(); return r.ok ? `🖨 Patti TN ${r.no || ''} — ${lines.length} items printer par` : '⏳ ' + r.why; } },
    { name: 'packet_patti', icon: '📦', label: 'Packet patti (godam → dukan)', desc: 'Packet-war transfer note: jin packets ki hadd aa gayi (app ki list) ya items do [{item, packet (jaise "250 gm"), n}]. label default true.', params: O_({ godam: S_, items: A_(O_({ item: S_, packet: S_, n: N_ })), label: B_ }),
      summary({ godam: g, items, label = true }) { needRk(); const gg = g ? godam(g, false) : 0; const L = items?.length ? items.map(x => `${item(x.item).name} ${x.packet || ''}×${Number(x.n) || 0}`) : pkDue().filter(y => !gg || Number(y.g) === gg).map(y => `${y.name} ${y.packs.map(p => p.name + '×' + p.a).join(', ')}`); if (!L.length) throw Error('Abhi koi packet hadd tak nahi bika'); return `📦 ${L.join(' · ')}${label ? ' · 🏷 label bhi' : ''}`; },
      async run({ godam: g, items, label = true }) { needRk(); const gg = g ? godam(g, false) : 0; let lines = [], from = gg;
        if (items?.length) { for (const x of items) { const it = item(x.item), sizes = gmSizes(it), pz = x.packet ? sizes.find(z => fold(pkName(z.z, it)) === fold(x.packet) || fold(x.packet).includes(String(Math.round(z.z * 1000)))) : sizes[sizes.length - 1]; if (!pz) throw Error(`${it.name}: packet "${x.packet}" nahi (${sizes.map(z => pkName(z.z, it)).join(' / ')})`); const n = Math.max(1, Math.floor(Number(x.n) || 1)); lines.push({ id: String(it.id), name: it.name, ctn: 0, pcs: r3(pz.z * n), pk: [{ z: pz.z, n, nm: pkName(pz.z, it) }] }); if (!from) from = Number(pkCfg(it.id)?.g) || gods().find(b => b !== 1); } }
        else { const ys = pkDue().filter(y => !gg || Number(y.g) === gg); if (!ys.length) throw Error('Koi packet nahi'); from = Number(ys[0].g); for (const y of ys.filter(y => Number(y.g) === from)) { let qty = 0; const pk = []; for (const p of y.packs) { const n = Math.max(0, Math.floor(p.a)); if (!n) continue; qty += n * p.z; pk.push({ z: p.z, n, nm: p.name }); } if (qty > 0) lines.push({ id: String(y.r.i), name: y.name, ctn: 0, pcs: r3(qty), pk }); } }
        if (!lines.length || !from) throw Error('Koi packet nahi'); const r = await stockAgentTransfer({ from, to: 1, lines, note: '📦 Packet rack bharo' }); if (!(r?.ok || r?.pending)) throw Error(r?.why || 'Nahi bana'); const t = Date.now(); for (const l of lines) pkSent.set(l.id, t); if (label) await rkLabelsGo(lines, 'bhi'); if (rk) rkPaint(); return r.ok ? `🖨 Packet TN ${r.no || ''} — ${lines.length} items` : '⏳ ' + r.why; } },
    { name: 'rack_bhar_diya', icon: '✓', label: 'Rack bhar diya ✓', desc: '⏳ patti ke items ko "rack bhar diya" ✓ karo: tn do (poora note) ya items (naam) — ya sab=true.', params: O_({ tn: S_, items: A_(S_), sab: B_ }),
      summary({ tn, items, sab }) { needRk(); const P = rkPend(); if (!P.length) throw Error('Koi patti baqi nahi'); if (sab) return `Sab ${P.reduce((t, x) => t + x.lines.length, 0)} items ✓ rack bhar diya`; if (tn) { const x = P.find(y => String(y.j.transferNo || '').replace(/^0+/, '') === String(tn).replace(/^0+/, '')); if (!x) throw Error('TN ' + tn + ' pending mein nahi'); return `TN ${tn}: ${x.lines.map(l => l.name).join(', ')} ✓`; } const ids = (items || []).map(v => String(item(v).id)); const hit = P.flatMap(x => x.lines.filter(l => ids.includes(String(l.itemId))).map(l => l.name)); if (!hit.length) throw Error('Ye items pending mein nahi'); return hit.join(', ') + ' ✓ rack bhar diya'; },
      async run({ tn, items, sab }) { needRk(); const P = rkPend(); let n = 0; const ids = items?.length ? (items || []).map(v => String(item(v).id)) : null;
        for (const x of P) { const pick = sab ? x.lines : tn ? (String(x.j.transferNo || '').replace(/^0+/, '') === String(tn).replace(/^0+/, '') ? x.lines : []) : x.lines.filter(l => ids.includes(String(l.itemId))); if (!pick.length) continue; const ok = await rkDoneSave(x.j, pick.map(l => String(l.itemId)), null); if (ok) n += pick.length; } return `✓ ${n} items rack bhar diya`; } },
    { name: 'packet_pct', icon: '📊', label: 'Packet poora / abhi', desc: 'Item ke packet ka poora (100% = rack poora bhara ho to kitne packet) aur/ya abhi (abhi rack par kitne). % ab ⚙️ Qaida (rack_hadd / packet_pct_all) se — sab packets ka ek (v2.118.0). packet na do = sab packets.', params: O_({ item: S_, packet: S_, poora: N_, abhi: N_, pct: N_ }, ['item']),
      summary({ item: v, packet, poora, abhi }) { const it = item(v); if (!(Number(poora) > 0) && (abhi == null || abhi === '')) throw Error('poora ya abhi do'); return `${it.name}${packet ? ' ' + packet : ''}:${poora ? ` poora ${poora}` : ''}${abhi != null && abhi !== '' ? ` · abhi ${abhi}` : ''} · ${pkQTxt()}`; },
      async run({ item: v, packet, poora, abhi }) { const it = item(v), id = String(it.id), P = pkQ(); if (!cloud?.setRackPk) throw Error('App update karein'); const cf = pkCfg(id) || { g: Number(pkCfg(id)?.g) || gods().find(b => b !== 1), at: Date.now(), p: {} }, sizes = gmSizes(it), p = { ...(cf.p || {}) }; let any = false;
        for (const z of sizes) { const k = gmKey(z.z), nm = pkName(z.z, it); if (packet && fold(nm) !== fold(packet) && !fold(packet).includes(String(Math.round(z.z * 1000)))) continue; const o = p[k] || {}; const b = Number(poora) > 0 ? Math.round(Number(poora)) : Number(o.b) || 0; if (!(b > 0)) { if (packet) throw Error(`${nm}: poora (100% = kitne packet) likhein`); continue; } const c = abhi != null && abhi !== '' ? Math.max(0, Number(abhi)) : (o.c ?? null); p[k] = { n: Math.max(1, pkN(b, c, P)), a: Math.max(1, b - Math.floor(b * P / 100)), b, pct: P, ...(c != null ? { c } : {}) }; any = true; }
        if (!any) throw Error(it.name + ': pehle "poora" (100% = kitne packet) likhein'); const vv = { ...cf, p, ...(abhi != null && abhi !== '' ? { at: Date.now() } : {}) }; itemCfg = { ...(itemCfg || {}), rackPk: { ...(itemCfg?.rackPk || {}), [id]: JSON.stringify(vv) } }; await cloud.setRackPk(id, vv); if (rk) rkPaint(); return `✓ ${it.name} packet — ${pkQTxt()}`; } },
    { name: 'packet_pct_all', icon: '📊', label: 'Qaida % (packet bhi)', desc: 'Rack ka ⚙️ Qaida % (10/20/30/40/50/60): sab rack items AUR sab packet items isi % par khud list mein (malik ka sab phones ka default — v2.118.0 se packet ka apna % nahi).', params: O_({ pct: N_ }, ['pct']),
      summary({ pct }) { if (!RK_PCTS.includes(Number(pct))) throw Error('% 10 / 20 / 30 / 40 / 50 / 60'); return `⚙️ Qaida ${pct}% — sab rack items + ${pkIds().length} packet items`; },
      async run({ pct }) { const v = Number(pct); if (!RK_PCTS.includes(v)) throw Error('% 10–60'); if (!cloud?.setRackPct) throw Error('App update karein'); itemCfg = { ...(itemCfg || {}), rackPct: v }; await cloud.setRackPct(v); if (rk) rkPaint(); return `⚙️ Qaida ${v}% — packet bhi`; } },
    { name: 'rack_hadd', icon: '📉', label: 'Rack ki aam hadd', desc: 'Malik ki aam hadd (sab phones ka default; mulazim apne phone par apna chun sakta hai): pct (0=band,10/20/30/40/50/60 — maal aane par 100%, itna reh jaye to lao) aur/ya lo (0 = khali, 0.25 = ¼ ctn, 0.5 = ½ ctn dukan mein reh jaye).', params: O_({ pct: N_, lo: N_ }),
      summary({ pct, lo }) { const a = []; if (pct != null) a.push(`% hadd ${pct || 'band'}`); if (lo != null) a.push(`dukan hadd ${rkHdName(Number(lo))}`); if (!a.length) throw Error('pct ya lo do'); return a.join(' · '); },
      async run({ pct, lo }) { if (pct != null) await cloud.setRackPct(Number(pct) || 0); if (lo != null) await cloud.setRackLo(Number(lo) || 0); return '✓ Hadd badal gayi'; } },
    { name: 'item_band', icon: '⛔', label: 'Item band / chalu', danger: true, desc: 'Item BAND karo (POS mein INACTIVE, stock 0, sab listen se ghaib — band=true) ya wapas CHALU (band=false). Khatarnak: stock screen par password lagta hai, yahan "Pakka?" confirm.', params: O_({ item: S_, band: B_ }, ['item']),
      summary({ item: v, band = true }) { return `${bandItem(v, band).name}: ${band ? '⛔ BAND karo (POS inactive, stock 0)' : '✅ wapas CHALU'}`; },
      async run({ item: v, band = true }) { const it = bandItem(v, band), id = String(it.id); if (!cloud?.setStockHidden) throw new Error('App update karein'); const next = bandApply(hidden, { [id]: !!band }); if (band && it.name) bdNmPut(id, it.name, it.code); await bandSend({ [id]: !!band }); hidden = next; try { rerender(); } catch {} if (rk) rkPaint(); if ($('bdList')) bdPaint(); return `✓ ${it.name} ${band ? 'band — Stock par "⛔ Band items" mein · PC on hote hi khud bill + deactive' : 'wapas chalu — PC POS mein bhi active karega'}`; } },
    { name: 'transfer_items_pending', read: true, desc: 'Aane wala maal: pending transfer notes ke items jo abhi tick nahi hue (is phone par), kis taraf aa rahe hain.', params: O_({}),
      run() { tcStart(); const names = collect().names || {}, out = []; for (const t of tcRows()) { const st = tcState(t); if (st.k !== 'wait' && st.k !== 'late') continue; (t.lines || []).forEach((l, i) => { if (!tcTkSt(t, i)) out.push({ item: l.name, qty: tcQty(l), tn: String(t.transferNo || t.transferId), taraf: branchName(t.to, names) }); }); } return { baqi: out.length, list: out.slice(0, 80) }; } },
    { name: 'packet_farq_list', read: true, desc: 'Packet-war items jin ka app ka hisaab (sab packet jama) POS dukan ke kul se nahi milta — dobara ginne ke liye.', params: O_({}),
      run() { needRk(); const L = pkAllRows().filter(x => Math.abs(x.far) > 0.0005).sort((a, b) => Math.abs(b.far) - Math.abs(a.far)); return { farq_wale: L.length, list: L.slice(0, 60).map(x => ({ item: x.it.name, app: x.app, pos: x.pos, farq: x.far, packets: x.packs.filter(p => p.left != null).map(p => `${pkName(p.z, x.it)} ${num(p.left)}/${num(p.b)}`).join(' · ') })) }; } },
    { name: 'band_list', read: true, desc: 'SAB band items aur un ka haal: PC baqi (POS on hote hi stock 0 bill + inactive), fail, POS mein deactive ho chuke, POS mein dobara chalu (app mein band). Stock screen ki "⛔ Band items" list.', params: O_({}),
      run() { const L = bandAll(), g = k => L.filter(b => b.st === k).map(b => b.name); return { kul: L.length, pc_baqi: g('wait'), fail: L.filter(b => b.st === 'fail').map(b => ({ item: b.name, wajah: bandWhy(b.id) })), pos_mein_dobara_chalu: g('live'), pos_deactive: g('done').slice(0, 80), note: g('wait').length ? 'PC on hote hi khud POS mein stock 0 (stock fraq bill) + inactive — koi click nahi' : 'Koi band item PC baqi nahi' }; } },
    { name: 'band_list_kholo', read: true, icon: '⛔', desc: 'Stock screen ki "⛔ Band items" list kholo — har band item ka haal (PC baqi / POS deactive / fail) aur ↩️ Chalu. q = naam se dhoondo (khali = sab).', params: O_({ q: S_ }),
      run({ q }) { bandDlg(q || ''); return { khul_gayi: 'band_list', kul: bandAll().length }; } },
    { name: 'supplier_band', icon: '⛔', label: 'Supplier ke sab items band', danger: true, desc: 'Mangwao list ke is supplier ke SAB items band (POS inactive, stock 0). Bohat khatarnak.', params: O_({ supplier: S_ }, ['supplier']),
      summary({ supplier }) { needRk(); const fs = fold(supplier), ys = roRows().filter(r => fold(r.party).includes(fs) && !hidden[r.id]); return `⛔ "${supplier}" ke ${ys.length} items BAND: ${ys.slice(0, 8).map(r => r.x.n).join(', ')}${ys.length > 8 ? '…' : ''}`; },
      async run({ supplier }) { needRk(); const fs = fold(supplier), ys = roRows().filter(r => fold(r.party).includes(fs) && !hidden[r.id]); if (!ys.length) throw new Error('Is supplier ka koi item nahi'); const ch = {}; for (const r of ys) { ch[String(r.id)] = true; bdNmPut(r.id, r.x?.n, r.x?.c); } await bandSend(ch); hidden = bandApply(hidden, ch); try { rerender(); } catch {} if (rk) rkPaint(); return `⛔ ${ys.length} items band — Stock par "⛔ Band items" mein · PC on hote hi khud bill + deactive`; } },
    { name: 'rack_poora', icon: '🔒', label: 'Rack poora (lock)', desc: 'Carton wale item ka "rack poora" (100%) pakka number (pcs) — % isi se, transfer notes se nahi badalta. poora=0 = PC wala (pehle din ka).', params: O_({ item: S_, poora: N_ }, ['item', 'poora']),
      summary({ item: v, poora }) { return `${item(v).name}: rack poora ${Number(poora) > 0 ? num(Number(poora)) + ' pcs' : 'PC wala (pehle din)'}`; },
      async run({ item: v, poora }) { const it = item(v), id = String(it.id), n = Number(poora) > 0 ? Math.round(Number(poora)) : 0; await rack100Save(id, n); return `✓ ${it.name} rack poora ${n ? num(n) + ' pcs' : 'PC wala'}`; } },
    { name: 'item_rack_off', icon: '🚫', label: 'Rack list se hatao', desc: 'Item sirf godam se bikta hai — rack bharo list mein kabhi na aaye (off=true) ya wapas (off=false).', params: O_({ item: S_, off: B_ }, ['item']),
      summary({ item: v, off = true }) { return `${item(v).name}: ${off ? 'rack list se hatao (sirf godam)' : 'wapas rack list mein'}`; },
      async run({ item: v, off = true }) { const it = item(v), id = String(it.id), old = rackCfg(id) || {}, nv = off ? { ...old, off: true } : (() => { const { off: _o, ...r } = old; return Object.keys(r).length ? r : null; })(); itemCfg = { ...(itemCfg || {}), rack: { ...(itemCfg?.rack || {}), [id]: nv } }; await cloud.setRackCfg(id, nv); if (rk) rkPaint(); return `✓ ${it.name} ${off ? 'hata diya' : 'wapas'}`; } },
    { name: 'stock_milao', icon: '🧮', label: 'Stock ginti (milao)', desc: 'Item ki asal ginti likho (dukan ya godam) — POS ka stock farq-bill se theek hoga. ginti = kul pcs/kg; ya ctn + pcs.', params: O_({ item: S_, godam: S_, ginti: N_, ctn: N_, pcs: N_ }, ['item']),
      summary({ item: v, godam: g, ginti, ctn, pcs }) { const it = item(v), br = g ? godam(g) : 1, pk = Number(it.pack) || 0, tot = ginti != null ? Number(ginti) : (Number(ctn) || 0) * (pk > 1 ? pk : 1) + (Number(pcs) || 0); if (!roundNow()) throw Error('Stock ginti shuru nahi — Stock → 📋 Nayi ginti'); const pos = gmNow(br, String(it.id)); return `${it.name} @ ${branchName(br, names())}: gina ${num(tot)} (POS ${num(pos)}, farq ${tot - pos > 0 ? '+' : ''}${num(r3(tot - pos))})`; },
      async run({ item: v, godam: g, ginti, ctn, pcs }) { const it = item(v), br = g ? godam(g) : 1, pk = Number(it.pack) || 0, tot = r3(ginti != null ? Number(ginti) : (Number(ctn) || 0) * (pk > 1 ? pk : 1) + (Number(pcs) || 0)), c = pk > 1 ? Math.floor(tot / pk + 1e-9) : 0, p2 = r3(tot - c * (pk > 1 ? pk : 0)); if (countLocked()) throw Error('Ginti band hai'); await writeCount({ id: String(it.id), name: it.name, stock: gmNow(br, String(it.id)), pack: pk }, { ctn: c, pcs: p2, total: tot }, null, false, br); return `✓ ${it.name} ginti ${num(tot)} — farq POS mein jayega`; } },
    { name: 'mangwao_order', icon: '🛒', label: 'Supplier order', desc: 'Supplier se order: supplier ka naam do to us ke sab mangwane wale (app ki list, pct hadd) ya items [{item, qty}] khud do. Order ki PDF (kholo / bhejo).', params: O_({ supplier: S_, pct: N_, items: A_(O_({ item: S_, qty: N_ })) }),
      summary({ supplier, pct, items }) { needRk(); if (items?.length) return `🛒 ${supplier || 'order'}: ${items.map(x => `${item(x.item).name} × ${num(Number(x.qty) || 0)}`).join(' · ')}`; const lim = [10, 20, 30, 40].includes(Number(pct)) ? Number(pct) : 40, fs = fold(supplier || ''); const L = roRows().filter(r => r.t > 0 && r.pct != null && r.pct <= lim && (!fs || fold(r.party).includes(fs)) && r.lao > 0); if (!L.length) throw Error('Is supplier / hadd par koi item nahi'); return `🛒 ${supplier || 'sab'} (${lim}%): ${L.map(r => `${r.x.n} × ${num(r.lao)}`).join(' · ')}`; },
      async run({ supplier, pct, items }) { needRk(); let party = supplier || '', L; if (items?.length) L = items.map(x => { const it = item(x.item), q = Math.max(1, Math.round(Number(x.qty) || 0)), r = roRows().find(y => y.id === String(it.id)); if (!party) party = r?.party || ''; return { i: String(it.id), n: it.name, q, u: 'pcs', st: 'open', why: r ? `${num(r.tot)}/${num(r.t)} (${r.pct}%)` : 'agent' }; });
        else { const lim = [10, 20, 30, 40].includes(Number(pct)) ? Number(pct) : 40, fs = fold(supplier || ''); L = roRows().filter(r => r.t > 0 && r.pct != null && r.pct <= lim && (!fs || fold(r.party).includes(fs)) && r.lao > 0).map(r => ({ i: r.id, n: r.x.n, q: r.lao, u: r.pk > 1 ? `pcs (${num(r.lao / r.pk)} ctn)` : 'pcs', st: 'open', why: `${num(r.tot)}/${num(r.t)} (${r.pct}%)` })); if (!party && L.length) party = roRows().find(r => r.id === L[0].i)?.party || ''; }
        if (!L.length) throw Error('Koi item nahi'); const k = party || 'Supplier nahi pata'; const o = { id: 'po' + Date.now().toString(36), at: Date.now(), by: uidOf() || '', byName: 'Malik (agent)', note: `🛒 agent · ${k} · ${L.length} items`, lines: [{ party: k.slice(0, 80), items: L }] }; await cloud.savePurchaseOrder(o);
        const html = `<h1>NOOR TRADERS</h1><h2>Order — ${esc(k)}</h2><p>${esc(new Date().toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }))} · ${num(L.length)} items</p><table class="iv-tbl rp-tbl"><thead><tr><th>#</th><th>Item</th><th>Tadad</th><th>Abhi / poora</th></tr></thead><tbody>${L.map((it, i) => `<tr><td class="rp-n">${i + 1}</td><td><b>${esc(it.n)}</b></td><td class="rp-r"><b>${num(it.q)}</b> ${esc(it.u)}</td><td class="rp-r">${esc(it.why)}</td></tr>`).join('')}</tbody></table>`; if (regPdfOf) regPdfOf(html, 'Order-' + k.replace(/[^a-z0-9]+/gi, '-')); return `🛒 Order ${k} — ${L.length} items (PDF khul gayi — kholo / bhejo)`; } },
    { name: 'mangwao_poora', icon: '🧺', label: 'Godam mein kitna hona chahiye', desc: 'Item ka "poora" (godam + dukan mein kul kitna hona chahiye) aur/ya pakka supplier malik ka apna; poora=0 aur supplier khali = wapas khud.', params: O_({ item: S_, poora: N_, supplier: S_ }, ['item']),
      summary({ item: v, poora, supplier }) { return `${item(v).name}: ${Number(poora) > 0 ? 'poora ' + num(Number(poora)) : ''}${supplier ? ' supplier ' + supplier : ''}` || `${item(v).name}: wapas khud`; },
      async run({ item: v, poora, supplier }) { const it = item(v), id = String(it.id), old = roCfg(id) || {}, val = Number(poora) > 0 || supplier || old.p || old.t > 0 ? { t: Number(poora) > 0 ? Math.round(Number(poora)) : (poora == null ? Number(old.t) || 0 : 0), p: supplier != null ? String(supplier).slice(0, 60) : (old.p || '') } : null; if (val && !(val.t > 0) && !val.p) { itemCfg = { ...(itemCfg || {}), reorder: { ...(itemCfg?.reorder || {}), [id]: null } }; await cloud.setReorderCfg(id, null); if (rk) rkPaint(); return `✓ ${it.name} wapas khud`; } itemCfg = { ...(itemCfg || {}), reorder: { ...(itemCfg?.reorder || {}), [id]: val } }; await cloud.setReorderCfg(id, val); if (rk) rkPaint(); return `✓ ${it.name} ${val ? (val.t > 0 ? 'poora ' + num(val.t) : '') + (val.p ? ' supplier ' + val.p : '') : 'khud'}`; } },
    { name: 'label_print', icon: '🏷', label: 'Barcode label', desc: 'Item ke barcode label chhapo (PC label printer): kitne, packet (sub-barcode, jaise "250 gm") ikhtiyari.', params: O_({ item: S_, kitne: N_, packet: S_ }, ['item', 'kitne']),
      summary({ item: v, kitne, packet }) { const it = item(v), n = Math.max(1, Math.min(1000, Math.floor(Number(kitne) || 0))); return `🏷 ${it.name}${packet ? ' ' + packet : ''} × ${n} label`; },
      async run({ item: v, kitne, packet }) { const it = item(v), n = Math.max(1, Math.min(1000, Math.floor(Number(kitne) || 0))); let line; if (packet) { const z = gmSizes(it).find(x => fold(pkName(x.z, it)) === fold(packet) || fold(packet).includes(String(Math.round(x.z * 1000)))); if (!z) throw Error('Packet nahi mila'); line = { id: String(it.id), pk: [{ z: z.z, n, nm: pkName(z.z, it) }] }; } else line = { id: String(it.id), ctn: 0, pcs: n, pack: 0 }; const k = await rkLabelsGo([line], ''); return `🏷 ${k} label printer ko`; } },
    { name: 'note_dobara_print', icon: '🖨', label: 'Transfer note dobara print', desc: 'App ke bane transfer note (tn number) ka dobara print PC par.', params: O_({ tn: S_ }, ['tn']),
      summary({ tn }) { const j = (trList || []).find(x => String(x.transferNo || '').replace(/^0+/, '') === String(tn).replace(/^0+/, '')); if (!j) throw Error('TN ' + tn + ' (14 din mein, app se bana) nahi mila'); return `🖨 TN ${tn} dobara print`; },
      async run({ tn }) { const j = (trList || []).find(x => String(x.transferNo || '').replace(/^0+/, '') === String(tn).replace(/^0+/, '')); await cloud.requestPrint({ kind: 'transfer', id: j.id, reason: 'Agent — dobara', copies: 1 }); return '🖨 PC ko bheja'; } },
    { name: 'rate_list_pdf', icon: '📄', label: 'Rate list PDF', desc: 'Sab items (ya category) ki rate list PDF — naam, retail, wholesale, ctn pcs. rate_chhupao=true to sirf naam + pcs.', params: O_({ category: S_, rate_chhupao: B_, sirf_stock: B_ }),
      summary({ category, rate_chhupao, sirf_stock }) { return `📄 ${rate_chhupao ? 'Items list' : 'Rate list'}${category ? ' — ' + category : ''}${sirf_stock ? ' (sirf stock wale)' : ''}`; },
      async run({ category, rate_chhupao, sirf_stock }) { rp = { who: sirf_stock ? 'stock' : 'all', cat: category ? ([...new Set(rpItems().map(it => String(it.cat || '').trim()))].find(c => fold(c) === fold(category) || fold(c).includes(fold(category))) || '') : '', hide: !!rate_chhupao, bc: false, q: '' }; if (category && !rp.cat) throw Error('Category "' + category + '" nahi mili'); rpPdf(); return '📄 PDF khul gayi — kholo / bhejo'; } },
    { name: 'transfer_check_list', read: true, desc: 'Transfer check: kaun se transfer notes abhi "maal mil gaya" ✓ nahi hue (late bhi).', params: O_({}),
      run() { tcStart(); return { list: tcAll().filter(t => { const st = tcState(t); return st.k !== 'ok' && st.k !== 'cancel' && st.k !== 'farq' && st.k !== 'hisaab'; }).slice(0, 40).map(t => { const st = tcState(t); return { tn: String(t.transferNo || '').replace(/^0+/, ''), se: branchName(Number(t.from), names()), ko: branchName(Number(t.to), names()), haal: st.k === 'late' ? 'LATE' : st.ng ? 'pehle "maal de diya" tick baqi' : 'baqi', items: (t.lines || []).length, kab: new Date(tcIssued(t)).toLocaleString('en-PK') }; }) }; } },
    { name: 'godam_transfer_haal', read: true, desc: '🏬 Aaj ke transfer notes GODAM-WISE: har godam ke note, gaya / aaya ctn + pcs, check baqi / late / farq (Transfer notes screen ke dabbe).', params: O_({}),
      run() { const r = thGodamNow(); return r.length ? { godam: r } : { note: 'Abhi godam / transfer data nahi aaya' }; } },
    { name: 'transfer_check_ok', icon: '🧾', label: 'Transfer check ✓', desc: 'Transfer note (tn) ka "maal poora mil gaya" ✓ (ya farq=true + note).', params: O_({ tn: S_, farq: B_, note: S_ }, ['tn']),
      summary({ tn, farq, note }) { tcStart(); const t = tcFind(String(tn)); if (!t) throw Error('TN ' + tn + ' nahi mila'); const st = tcState(t); if (st.k === 'ok') throw Error('TN ' + tn + ' pehle hi ✓'); return `TN ${tn}: ${farq ? '⚠️ farq — ' + (note || '') : '✓ poora mila'}`; },
      async run({ tn, farq, note }) { const t = tcFind(String(tn)); await tcSaveOne(t, farq ? 'farq' : 'ok', note || ''); return `✓ TN ${tn} check`; } },
    { name: 'demand_done', icon: '📢', label: 'Demand ho gayi', desc: 'Larke ki demand (item) ko "ho gaya" karo.', params: O_({ item: S_ }, ['item']),
      summary({ item: v }) { const it = item(v), d = roDm.find(x => String(x.i) === String(it.id)); if (!d) throw Error(it.name + ' ki koi open demand nahi'); return `📢 ${it.name} — demand ho gayi (${d.byName || ''})`; },
      async run({ item: v }) { const it = item(v), d = roDm.find(x => String(x.i) === String(it.id)); await cloud.saveDemand({ ...d, st: 'done', doneAt: Date.now() }); return '✓ Demand band'; } },
    // v2.109.0: 📋 roz ki ginti — wahi function jo chip / tile chalate hain
    { name: 'roz_ginti_kholo', read: true, desc: '📋 Roz ki ginti kholo — larka: us ki aaj ki list (alag items, Ctn + Pcs) · malik: dashboard (har jagah larkon ki progress, mahine ka %, farq, ✅ ek click theek). jagah ikhtiyari (Noor Traders / Godam 1 / 2 / 3).', params: O_({ jagah: S_ }),
      async run({ jagah }) { let k = ''; if (jagah) { const q = fold(String(jagah)), L = rozLocs(true).find(x => fold(x.name).includes(q) || q.includes(fold(x.name)) || (q.includes('dukan') && x.k === 'nt')); if (!L) throw Error('Jagah "' + jagah + '" nahi mili'); k = L.k; }
        await stockRozOpen(k && !isOwner() ? k : (isOwner() && k ? k : '')); return { khul_gaya: k ? 'roz ki ginti — ' + k : 'roz ki ginti' }; } },
    { name: 'roz_ginti_haal', read: true, desc: '📋 Aaj ki roz ki ginti ka haal — har jagah kitne items liye / gine, kaun larka kitne, setting (on / items har larka).', params: O_({}),
      run() { start(); const C = rozCfg(); if (!C.on) return { haal: 'Roz ki ginti band hai (malik: Stock → 📋 Roz ki ginti → ✅ shuru)' };
        return { har_larka: C.n, jagah: rozLocs().map(L => { const d = rozDoc(L.k), by = d?.by || {}; return { jagah: L.name, larke: Object.entries(by).map(([sid, m]) => { const ids = (m?.ids || []).map(String); return { naam: m?.n || sid, liye: ids.length, gine: ids.filter(id => rozGina(L.b, id)).length }; }), kul_liye: Object.keys(d?.taken || {}).length }; }) }; } },
    { name: 'pc_jawab_haal', read: true, desc: '📡 Ginti ka PC jawab — aaj ki kitni ginti PC ne pakki ki (✅), kitni intezar, kitni ruki (PC jawab nahi de raha), kitni server tak nahi pohanchi, kaun larka bata raha hai.', params: O_({}),
      run() { start(); if (!loaded) return { haal: 'Stock abhi aa raha hai — 2 second baad dobara' }; const P = stockPcState();
        return { pakki_PC: P.ok, intezar: P.wait, ruki_PC_jawab_nahi: P.down, save_nahi_hui: P.nosave, PC_ne_item_nahi_pehchana: P.item, larkon_ki_khabar: P.warns, haal: P.down ? '⚠️ PC jawab nahi de raha — PC / KHATA-DOCTOR dekhein' : P.nosave ? '❌ kuch ginti server tak nahi pohanchi (internet)' : '✓ PC jawab de raha hai' }; } },
  ];
})();
agentRegister(AG);
