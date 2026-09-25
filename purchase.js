// purchase.js — v2.4.2 "POS Purchase" screen
// v2.4.2: BILL KHUD JAWAB DETA HAI — har line par ginti × rate = kul; hisaab na mile to app kul ÷ rate (ya
//          kul ÷ ginti) nikal kar khud theek karti hai jab wo AI ke diye number se bilkul mile (jaise 357 + 357 ->
//          357), warna button "Bill se ginti / rate lagao". Card par zinda milan "Aap X · bill Y ✓". "1 CTN = 1"
//          ya khali = carton BAND (bill ka سائز nahi lagta, yaad rehta hai). Bill ka سائز carton size sirf tab jab
//          app ne سائز wala tareeqa chuna ho (1000 gram jaisa number khud carton nahi banta).
// v2.4.1: Jaanch card EK SCREEN mein — upar bill ki PATTI (sirf wohi line, AI ki di hui jagah y se), do qataarein
//          (CTN · PCS · Khareed/CTN · Khareed/PCS / W/CTN · W/PCS · R/CTN · R/PCS, har ek ke neeche "pehle"),
//          carton size khali ho to "1 CTN =" ka khana, neeche chipka ✓, swipe (daayein = ✓ agla, baayein = pichhla).
//          Poori tasveer: do ungliyon se zoom, khainchna, do dafa tap, "‹ Wapas Jaanch". "🧾 Jaanch kholo" button.
//          Bill ke neeche ginti ke total (ctnTotal / pcsTotal) se lines ka milan.
// v2.4.0: JAANCH MODE — AI ki har line ka rang (🟢 pakki / 🟡 dekh lein / 🔴 shak), hari ek tap par pakki, baqi
//          ek ek card mein ("✓ Theek — agla ›" dabate hi agli line). Line ka dimagh: PCS / CTN / bill ka سائز /
//          Dono — jo khareed pichhle ke qareeb ho wahi. Hisaab + stock ke pehre. Naqsha khud pakarna, supplier ki
//          misalein AI ko, carton size yaad, aakhri khulasa (farq, mehnge/saste, do dafa item). Enter = agla khana.
// v2.3.0: HAR SUPPLIER KE BILL KA NAQSHA — ginti PCS hai ya CTN, rate fi PCS hai ya fi CTN. Naqsha maloom ho to
//          AI ka jawab usi hisaab se lagta hai; na ho to upar ek patti poochti hai (ek tap). Aur jab aap bill
//          theek kar ke POS bhejte hain, app AI ke parhe hue se farq dekh kar naqsha KHUD seekh leti hai.
// v2.2.0: jo bill ki tasveer AI ko di, wohi screen par — upar chhoti si, "📄 Bill dekhein" (poori screen, zoom),
//          aur "📌 upar chipka do" (aadhi screen par chipki rahe, neeche items chalte rahein).
//          Tasveer sirf usi waqt tak (memory mein) — refresh par chali jati hai, kahin save nahi hoti.
// v2.1.0: (1) har item ka PICHHLA khareed aur nafa yaad — item dobara lagayein ya bill edit mode mein aayein to
//          wohi nafa (W aur R) naye khareed par khud lag jata hai; (2) line par "bill ki raqam" likhne ka khana
//          (raqam ÷ ginti = khareed); (3) AI khud sahi item chun le to wo naam bhi bina dabaye yaad ho jata hai.
// v2.0.0: AI ko humare items ki list bhi jati hai (itemId khud wapas karta hai) — matching pehli dafa hi sahi.
// v1.99.0: AI wale bill ki har line par "bill ka naam → system ka naam" — ✓ Yaad kar lo (naam us item ke
//          "Doosre naam" mein save) aur ✏️ Badlein (sahi item chunein; chunte hi naam khud yaad ho jata hai).
// v1.98.0: SAB purchase ka kaam isi ek screen par — upar do chip (Items wali bill / 📷 sirf photo + raqam),
//          "🤖 Bill ki tasveer se items" (AI bill parh kar seedhe isi cart mein), aur Save par isi supplier ki
//          photo-purchase ka dhyan (do dafa na chare — POS bill aate hi Milao se khud jur jati hai).
// v1.97.0: POS ka KHULA bill yahan EDIT (editOf) -> PC wohi bill number update karta hai; supplier ki smart chips
//          (istemal ke hisaab se); supplier chunte hi "is supplier se aksar aane wale items" chips. (Purchase tab ke andar nayi screen)
// Sale screen jaisi: barcode scan / smart search / Ctn + Pcs. Har item par khareed rate + 4 naye rate
// (Wholesale Ctn/Pcs, Parchoon Ctn/Pcs) — PURANE NAFA se khud, % chips se wholesale.
// Save -> Firestore "appPurchases" (status new) -> PC ka purchase-post.js POS mein ASLI purchase bill
// banata hai (POS ke apne procedures, DocStatusID 1 — baqi bills jaisa) aur naye rates POS items par lagata hai.
// POS mein Qty = PIECES, Rate = FI PIECE khareed. Yahan sab RUPAY (paisa nahi).

import { saleStock, setSaleScanHook, setSaleQtyHook, setSaleFindHook, setSaleCartHook, setSaleDelHook, openSaleCamera } from './pos-stock.js?v=2.16.0';
import { smartSearch, noteHit, voiceSearch, notePartyPick } from './smart-search.js?v=2.16.0';

const $ = id => document.getElementById(id);
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const NUMF = new Intl.NumberFormat('en-PK');
const num = n => NUMF.format(Math.round((Number(n) || 0) * 100) / 100);
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
const r3 = n => Math.round((Number(n) || 0) * 1000) / 1000;
const r4 = n => Math.round((Number(n) || 0) * 10000) / 10000;
const todayStr = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

const BILL_BRANCH = 1;              // purchase bill hamesha NOOR TRADERS (branch 1); godam line par
const DRAFT_KEY = 'sam-pp-draft';
const W_CHIPS = [1, 1.25, 1.5, 2];

let cloud = null, rerender = () => {}, notice = () => {}, isOwner = () => false, uidOf = () => '';
let partiesOf = () => [], partyOf = () => null, matchesOf = () => true, canUse = () => false, rankOf = null, billIdsOf = () => [], pcBillsOf = () => [];
let photoFormOf = null, aiBillOf = null, cashDupesOf = () => [], learnOf = null, unlearnOf = null;
let lastRatesOf = () => ({}), saveRatesOf = () => {};   // v2.1.0: har item ka pichhla khareed / nafa
let billFmtOf = () => null, saveBillFmtOf = () => {};   // v2.3.0: supplier ke bill ka naqsha   // v1.98.0: photo wala purchase form, AI bill reader, milan ka dhyan
let pcQ = '', pcWhen = 'all';   // v1.96: PC ke bill ki list
let edit = null;            // v1.87: {purchaseId, billNo, stamp, partyId, posPartyId, date} — POS ka khula bill edit ho raha hai
const supItems = new Map();  // partyId -> {loading, list:[{id,n}]}
let supplier = '', godam = BILL_BRANCH, day = '', invoiceNo = '', note = '', cart = [], saving = false;
let xtra = 0, xtraName = '', pct = 0;   // v2.4.6: bill ka kharcha (labour / kiraya) — items par RAQAM ke hisaab se · v2.10: pct = har item par +%
let supQuery = '', supOpen = false;
let today = [], todayDay = '', stopToday = null, todayErr = '';

export function ppSetup(o) {
  cloud = o.cloud; rerender = o.rerender || rerender; notice = o.notice || notice;
  isOwner = o.owner || isOwner; uidOf = o.uid || uidOf;
  partiesOf = o.parties || partiesOf; partyOf = o.party || partyOf; matchesOf = o.accountMatches || matchesOf; canUse = o.canUse || canUse;
  rankOf = o.rank || rankOf; billIdsOf = o.billIdsOf || billIdsOf; pcBillsOf = o.pcBills || pcBillsOf;
  photoFormOf = o.photoForm || photoFormOf; aiBillOf = o.aiBill || aiBillOf; cashDupesOf = o.cashDupes || cashDupesOf; learnOf = o.learn || learnOf;
  unlearnOf = o.unlearn || unlearnOf; lastRatesOf = o.lastRates || lastRatesOf; saveRatesOf = o.saveRates || saveRatesOf;
  billFmtOf = o.billFmt || billFmtOf; saveBillFmtOf = o.saveBillFmt || saveBillFmtOf;
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    if (d && d.saved === todayStr()) { supplier = d.supplier || ''; godam = d.godam ?? BILL_BRANCH; day = d.day || ''; invoiceNo = d.invoiceNo || ''; note = d.note || ''; cart = Array.isArray(d.cart) ? d.cart : []; edit = d.edit || null; xtra = Number(d.xtra) || 0; xtraName = String(d.xtraName || ''); pct = Number(d.pct) || 0;
      if (d.jd && Array.isArray(d.jd.rows) && d.jd.rows.length) { aiRows = d.jd.rows; aiBillInfo = d.jd.info || null; jView = d.jd.view || 'list'; jIx = Number(d.jd.ix) >= 0 ? Number(d.jd.ix) : -1; aiFmtAuto = d.jd.fmt || ''; }   // v2.5.1
    }
  } catch {}
}
function keepDraft() {
  xtraApply();
  // v2.5.1: Jaanch bhi mehfooz — WhatsApp se wapas aayein to wahi card khula mile (tasveerein memory mein hi rehti hain)
  const jd = aiRows ? { rows: aiRows.map(r => ({ ...r, ai: r.ai, aiFix: r.aiFix || null })), info: aiBillInfo, view: jView, ix: jIx, fmt: aiFmtAuto } : null;
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ saved: todayStr(), supplier, godam, day, invoiceNo, note, cart, edit, xtra, xtraName, pct, jd })); } catch {}
}

// ---------- data ----------
function stock() {
  const s = saleStock();
  const base = s.branches.includes(BILL_BRANCH) ? BILL_BRANCH : s.branches[0];
  const items = base == null ? [] : s.itemsFor(base);
  if (!s.branches.includes(Number(godam))) godam = base ?? BILL_BRANCH;
  return { ...s, base, items };
}
const packOf = l => Number(l.pack) > 1 ? Number(l.pack) : 0;
const linePcs = l => r3((Number(l.ctn) || 0) * packOf(l) + (Number(l.pcs) || 0));
const lineTotal = l => r2(linePcs(l) * (Number(l.costP) || 0));           // bill ki line jaisi (kharcha ke baghair)
const effCost = l => r4((Number(l.costP) || 0) * (1 + (Number(pct) || 0) / 100) + (Number(l.xs) || 0));      // v2.4.6/v2.10: khareed × (1+%) + kharcha ka hissa (POS mein yahi)
const cartTotal = () => r2(cart.reduce((n, l) => n + linePcs(l) * effCost(l), 0));
// v2.4.6: kharcha RAQAM ke hisaab se: har line ko (line ki raqam ÷ kul) × kharcha -> fi piece = kharcha × khareed ÷ kul (sab par ek hi %)
let pctLast = 0;
function xtraApply() {
  const X = Number(xtra) || 0, base = cart.reduce((n, l) => n + lineTotal(l), 0);
  const pctChanged = pctLast !== (Number(pct) || 0); pctLast = Number(pct) || 0;
  for (const l of cart) {
    const nx = X > 0 && base > 0 && Number(l.costP) > 0 ? r4(X * Number(l.costP) / base) : 0;
    if (nx !== (Number(l.xs) || 0) || pctChanged) { l.xs = nx; recalc(l); }
  }
}
const xtraPct = () => { const b = cart.reduce((n, l) => n + lineTotal(l), 0); return b > 0 && xtra > 0 ? xtra / b * 100 : 0; };
const newKey = () => 'P' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
function findByCode(items, code) {
  const clean = String(code).trim(), bare = clean.replace(/^0+/, '');
  const codesOf = r => [r.code, ...(Array.isArray(r.bc) ? r.bc : [])].map(x => String(x || '').trim()).filter(Boolean);
  return items.find(r => codesOf(r).includes(clean)) || items.find(r => bare && codesOf(r).some(x => x.replace(/^0+/, '') === bare)) || null;
}

// purane rates (POS abhi jo hain) — sab FI PIECE: prate khareed, wrate W, rate R (carton wala), rate2 khula piece
function oldOf(it) {
  return { oldCost: r4(Number(it.prate) || 0), oldW: r2(Number(it.wrate) || 0), oldR: r2(Number(it.rate) || 0), oldR2: r2(Number(it.rate2) || Number(it.rate) || 0) };
}
// v2.1.0: pehle PICHHLE purchase ki yaad (khareed + us waqt lage hue rates), warna POS ke maujooda rates.
// Nafa isi se nikalta hai (recalc: oldW/oldCost), yani "jitna nafa pichhli dafa laga tha wohi is dafa bhi".
function baseOf(it) {
  const o = oldOf(it);
  let m = null; try { m = (lastRatesOf() || {})[String(it.id)] || null; } catch {}
  if (!m || !(Number(m.c) > 0)) return o;
  o.oldCost = r4(Number(m.c));
  if (Number(m.w) > 0) o.oldW = r2(Number(m.w));
  if (Number(m.r) > 0) { o.oldR = r2(Number(m.r)); o.oldR2 = r2(Number(m.r)); }
  o.mem = 1;
  return o;
}
const nafaPct = (a, b) => b > 0 && a > 0 ? Math.round((a / b - 1) * 1000) / 10 : null;
// cost ya mode badle to rates dobara (wMode: 'old' | % number | 'manual'; rMode: 'old' | 'manual')
// v2.4.5: bechne ke rate POORE RUPEE (upar ki taraf, nafa kam na ho); khareed mamooli badle (1 rupee / 0.5% se kam) to PURANE rate hi
const upR = v => { v = Number(v) || 0; const u = Math.ceil(v - 0.005); return v > 0 && (u - v) / v <= 0.01 ? u : r2(v); };   // 1% se zyada barhe (sasti cheez) to paise rahen
const tinyCost = l => l.oldCost > 0 && Math.abs(effCost(l) - l.oldCost) < Math.min(1, l.oldCost * 0.005);
function recalc(l) {
  const c = effCost(l), pk = packOf(l);
  if (!(c > 0)) return;
  const same = tinyCost(l) || (l.oldCost > 0 && c < l.oldCost);   // v2.10: khareed KAM ho to bhi purane rate (app khud kam nahi karti)
  if (l.wMode === 'old' && l.oldCost > 0 && l.oldW > 0) {
    if (same) { l.wpcs = r2(l.oldW); l.wctn = pk ? Math.round(l.oldW * pk) : 0; }
    else { const m = l.oldW / l.oldCost; l.wpcs = upR(c * m); l.wctn = pk ? upR(c * m * pk) : 0; }
  }
  else if (typeof l.wMode === 'number') { const m = 1 + l.wMode / 100; l.wpcs = upR(c * m); l.wctn = pk ? upR(c * m * pk) : 0; }
  if (l.rMode === 'old' && l.oldCost > 0 && l.oldR > 0) {
    if (same) { l.rctn = pk ? Math.round(l.oldR * pk) : 0; l.rpcs = r2(pk ? l.oldR2 : l.oldR); }
    else {
      l.rctn = pk ? upR(c * (l.oldR / l.oldCost) * pk) : 0;
      l.rpcs = upR(c * ((pk ? l.oldR2 : l.oldR) / l.oldCost));
    }
  }
  if (!pk && l.one) { if (!l.wcOwn) l.wctn = r2(l.wpcs); if (!l.rcOwn) l.rctn = r2(l.rpcs); }   // v2.4.2: 1 ctn = 1 pcs
}
function addItem(it, again = true) {
  noteHit(it.id);
  const had = again && [...cart].reverse().find(l => String(l.id) === String(it.id));
  if (had) {   // dobara scan / chunna = +1 Ctn (khula item ho to +1 Pcs)
    if (packOf(had)) had.ctn = (Number(had.ctn) || 0) + 1; else had.pcs = r3((Number(had.pcs) || 0) + 1);
    keepDraft(); return { line: had, again: true };
  }
  const o = baseOf(it), pk = Number(it.pack) > 1 ? Number(it.pack) : 0;
  const l = {
    k: newKey(), id: it.id, code: it.code || '', name: it.name, pack: Number(it.pack) || 0, cName: it.cName || 'Ctn', uName: it.uName || 'Pcs',
    godam: Number(godam) || BILL_BRANCH, ctn: pk ? 1 : 0, pcs: pk ? 0 : 1, costP: o.oldCost, ...o,
    wpcs: o.oldW, wctn: pk ? Math.round(o.oldW * pk) : 0, rpcs: pk ? o.oldR2 : o.oldR, rctn: pk ? Math.round(o.oldR * pk) : 0,
    wMode: 'old', rMode: 'old'
  };
  cart.push(l); keepDraft();
  return { line: l, again: false };
}

// ---------- camera / scanner hooks (Sale wale hi; jo screen khule woh apne laga leti hai) ----------
function installHooks() {
  setSaleDelHook(key => { const i = cart.findIndex(l => l.k === key); if (i < 0) return; cart.splice(i, 1); keepDraft(); rerender(); });
  setSaleCartHook(() => cart.map(l => ({ key: l.k,
    item: { id: l.id, code: l.code, name: l.name, pack: Number(l.pack) || 0, cName: l.cName, uName: l.uName, rate: Number(l.costP) || 0, rate2: Number(l.costP) || 0 },
    pcs: Number(l.pcs) || 0, ctn: Number(l.ctn) || 0 })));
  setSaleFindHook(q => smartSearch(stock().items, q, 12));
  setSaleQtyHook((it, q, key) => {
    const l = (key && cart.find(x => x.k === key)) || [...cart].reverse().find(x => String(x.id) === String(it.id));
    if (!l) return; l.pcs = Number(q.pcs) || 0; l.ctn = Number(q.ctn) || 0; keepDraft(); rerender();
  });
  setSaleScanHook((code, direct) => {
    const it = direct || findByCode(stock().items, code);
    if (!it) return { state: null };
    const r = addItem(it);
    notice(r.again ? `+1 · ${it.name}` : `✓ ${it.name}`);
    const s = $('search'); if (s && s.value) s.value = '';
    rerender();
    return { state: 'added', item: it, line: r.line.k, pcs: Number(r.line.pcs) || 0, ctn: Number(r.line.ctn) || 0 };
  });
}

// ---------- aaj ke app purchase bills ----------
function watchToday() {
  const d = todayStr();
  if (stopToday && todayDay === d) return;
  if (stopToday) { stopToday(); stopToday = null; }
  if (!cloud?.listenAppPurchases) return;
  todayDay = d;
  stopToday = cloud.listenAppPurchases(d, list => {
    today = list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); todayErr = '';
    const b = $('ppTodayBtn'); if (b) b.textContent = todayLabel();
    if ($('dialog')?.open && $('dialogTitle')?.textContent.startsWith('Aaj ke app purchase')) { const open = [...document.querySelectorAll('#dialogBody details[open]')].length; openToday(); if (open) document.querySelectorAll('#dialogBody details').forEach(d => d.open = true); }
  }, e => { todayErr = e?.message || 'Load nahi hue'; stopToday = null; });
}
const statusText = p => p.status === 'done' ? `✓ POS bill ${esc(p.purchaseNo || '')}${p.editOf ? ' UPDATE ho gaya' : ''}${p.rates ? ' · ' + esc(String(p.rates)) + ' items ke rate lage' : ''}${p.rateError ? ' · <span class="red">rates: ' + esc(p.rateError) + '</span>' : ''}`
  : p.status === 'failed' ? `<span class="red">✕ Nahi bana: ${esc(p.error || '')}</span>`
  : p.status === 'cancelled' ? '<span class="red">✕ Cancel kiya gaya</span>'
  : p.status === 'replaced' ? '↪ Screen par khol kar naya bana diya gaya'
  : p.status === 'posting' ? '… PC bill bana raha hai' : '⏳ PC ka intezar (PC on ho)';
const todayLabel = () => { const w = today.filter(p => p.status === 'new' || p.status === 'posting').length; return `📋 Aaj ke app purchase (${today.length})${w ? ' · ' + w + ' intezar' : ''}`; };
function dlg(title, html) {
  const d = $('dialog'); if (!d) return;
  d.classList.remove('search-dialog', 'full-dialog');
  $('dialogTitle').textContent = title; $('dialogBody').innerHTML = html;
  if (!d.open) d.showModal();
}
// v1.94: har app purchase par kaam — ✕ par Dobara bhejo / Screen par kholo, ✓ par Edit, ⏳ par Cancel
const mayTouch = p => isOwner() || (p.by === uidOf() && p.date === todayStr());
function billActs(p) {
  if (!mayTouch(p)) return '';
  const b = [];
  if (p.status === 'failed') b.push(`<button type="button" class="got" data-pp-retry="${esc(p.id)}">🔄 Dobara PC ko bhejo</button>`, `<button type="button" data-pp-reopen="${esc(p.id)}">✏️ Screen par kholo</button>`);
  if (p.status === 'cancelled') b.push(`<button type="button" data-pp-reopen="${esc(p.id)}">✏️ Screen par kholo</button>`);
  if (p.status === 'done' && p.purchaseId) b.push(`<button type="button" data-pp-editdone="${esc(p.id)}">✏️ Edit (POS bill ${esc(p.purchaseNo || '')})</button>`);
  if (p.status === 'new') b.push(`<button type="button" class="danger" data-pp-cancel="${esc(p.id)}">✕ Cancel</button>`);
  return b.length ? `<div class="pp-bill-acts">${b.join('')}</div>` : '';
}
// ✕/cancel wala bill screen par — NAYA bill (edit nahi); rates wahi jo bheje the
function loadFromJob(p) {
  const s = stock();
  if (!s.loaded) return 'Items abhi load ho rahe hain — thori der baad dobara dabayein.';
  const miss = [], next = [];
  for (const x of p.lines || []) {
    const it = s.items.find(r => String(r.id) === String(x.id));
    if (!it) { miss.push(x.name); continue; }
    const o = oldOf(it), pk = Number(it.pack) > 1 ? Number(it.pack) : 0, q = Number(x.qty) || 0;
    const hasW = Number(x.wctn) > 0 || Number(x.wpcs) > 0, hasR = Number(x.rctn) > 0 || Number(x.rpcs) > 0;
    next.push({ k: newKey(), id: it.id, code: it.code || '', name: it.name, pack: Number(it.pack) || 0, cName: it.cName || 'Ctn', uName: it.uName || 'Pcs',
      godam: Number(x.godam) || Number(p.godam) || BILL_BRANCH, ctn: pk ? Math.floor(q / pk + 1e-9) : 0, pcs: pk ? r3(q - Math.floor(q / pk + 1e-9) * pk) : q,
      costP: r4(Number(x.costP) || o.oldCost), ...o,
      wpcs: hasW ? r2(x.wpcs) : o.oldW, wctn: hasW ? r2(x.wctn) : (pk ? Math.round(o.oldW * pk) : 0),
      rpcs: hasR ? r2(x.rpcs) : (pk ? o.oldR2 : o.oldR), rctn: hasR ? r2(x.rctn) : (pk ? Math.round(o.oldR * pk) : 0),
      wMode: hasW ? 'manual' : 'old', rMode: hasR ? 'manual' : 'old' });
  }
  if (!next.length) return 'Is bill ka koi item POS stock list mein nahi mila.';
  cart = next; edit = null; supplier = String(p.partyId || ''); supOpen = !partyOf(supplier); supQuery = '';
  godam = Number(p.godam) || BILL_BRANCH; invoiceNo = String(p.invoiceNo || ''); note = String(p.note || ''); day = '';
  keepDraft();
  return miss.length ? 'Yeh items stock list mein nahi mile, is liye chhor diye:\n' + miss.join('\n') : '';
}
const STATUS_WORD = { new: '⏳ PC ke intezar mein', posting: '… PC abhi bana raha hai', done: '✓ POS mein ban chuka', failed: '✕ Nahi bana', cancelled: '✕ Cancel ho chuka', replaced: '↪ Naya bana diya gaya' };
const NEEDS = { retry: ['failed'], reopen: ['failed', 'cancelled'], cancel: ['new'], editdone: ['done'] };
async function billAct(kind, id, btn) {
  const p0 = today.find(x => x.id === id); if (!p0 || !cloud?.updateAppPurchase) return;
  if (!mayTouch(p0)) { notice('Is bill par aap ki ijazat nahi'); return; }
  btn.disabled = true;
  let p = p0;
  try {
    // v1.95: dabane se pehle TAZA haalat (list purani ho sakti hai — PC ne beech mein utha liya ho)
    if (cloud.getAppPurchase) {
      const fresh = await cloud.getAppPurchase(id).catch(() => null);
      if (fresh) { p = { ...p0, ...fresh, id }; if (!NEEDS[kind].includes(fresh.status)) { alert(`Is bill ki haalat badal chuki hai:\n${STATUS_WORD[fresh.status] || fresh.status}\n\nList taza kar di — dobara dekhein.`); openToday(); return; } }
    }
    if (kind === 'retry') {
      if (!confirm(`${p.partyName} · Rs ${num(p.total)}\n\nYahi bill dobara PC ko bhejein?`)) return;
      await cloud.updateAppPurchase(id, { status: 'new', retryAt: Date.now(), error: '' });
      notice('🔄 Dobara bhej diya — PC POS mein bana dega');
    } else if (kind === 'cancel') {
      if (!confirm(`${p.partyName} · Rs ${num(p.total)}\n\nYeh bill CANCEL karein? (PC isay POS mein nahi banayega)`)) return;
      await cloud.updateAppPurchase(id, { status: 'cancelled', cancelledAt: Date.now() });
      notice('✕ Cancel ho gaya');
    } else if (kind === 'reopen') {
      if (cart.length && !confirm('POS Purchase screen par pehle se items hain — woh hata kar yeh bill kholein?')) return;
      if (p.status === 'failed') await cloud.updateAppPurchase(id, { status: 'replaced', replacedAt: Date.now() });   // PC ab isay dobara na uthaye (double bill se bachao)
      const r = loadFromJob(p); if (r) alert(r);
      $('dialog')?.close(); rerender(); notice('✏️ Bill screen par — theek kar ke "POS mein bhejo" dabayein');
    } else if (kind === 'editdone') {
      await openBillForEdit('pos-' + p.purchaseId, p.partyId, Number(p.doneAt) || 0);   // v1.97: taza tafseel ka intezar, phir khud khule
    }
  } catch (err) {
    const perm = err?.code === 'permission-denied' || /permission/i.test(String(err?.message || ''));
    alert(perm
      ? (kind === 'cancel' ? 'Cancel nahi ho saka — PC ne yeh bill utha liya hai.' : 'Ijazat nahi mili. Do wajah ho sakti hain:\n1) Is bill ki haalat abhi badli hai (list taza kar di)\n2) Firebase rules v1.94+ publish nahi hue (copy page ki 2nd line dekhein)')
      : 'Nahi hua: ' + (err?.message || err));
    openToday();
  } finally { btn.disabled = false; }
}
// ---------- v1.96: PC par bane KHULE purchase bill — list se chun kar EDIT ----------
function pcRows() {
  const t = todayStr(), y = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })();
  const q = norm(pcQ);
  return pcBillsOf().filter(r => (isOwner() || r.date === t) && (pcWhen === 'all' || (pcWhen === 'today' ? r.date === t : r.date === y)))
    .filter(r => !q || norm(r.billNo).includes(q) || norm(r.partyName).includes(q) || (matchesOf(partyOf(r.partyId) || { name: r.partyName }, pcQ)))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.billNo).localeCompare(String(a.billNo))).slice(0, 60);
}
function pcListHTML() {
  const rows = pcRows();
  return rows.length ? rows.map(r => `<button type="button" class="pc-bill${r.posted ? ' posted' : ''}" data-pp-pcbill="${esc(r.id)}"${r.posted ? ' disabled' : ''}>
      <span><b>${esc(r.partyName || '')}</b><small>Bill ${esc(r.billNo || r.id)} · ${esc(r.date)}${r.posted ? ' · Posted — pehle Unpost' : ' · khula ✓'}</small></span><b>Rs ${num(r.rs)}</b></button>`).join('')
    : `<p class="stat-note">${isOwner() ? 'Is chunao mein koi PC ka purchase bill nahi.' : 'Aaj PC par koi purchase bill nahi bana (mulazim sirf aaj ka bill edit kar sakta hai).'}</p>`;
}
function openPcBills() {
  dlg('✏️ PC ka bill edit karein', `<p class="stat-note">PC par bane purchase bill — sirf <b>khule</b> (post na hue) edit hote hain.</p>
    <input id="ppPcQ" type="search" placeholder="🔍 Supplier ya bill number" value="${esc(pcQ)}" autocomplete="off">
    ${isOwner() ? `<div class="sort-chips" style="margin-top:8px">${[['today', 'Aaj'], ['yday', 'Kal'], ['all', 'Sab']].map(([k, l]) => `<button type="button" data-pp-pcwhen="${k}" class="${pcWhen === k ? 'on' : ''}">${l}</button>`).join('')}</div>` : ''}
    <div id="ppPcList" class="pc-bills">${pcListHTML()}</div>`);
  const i = $('ppPcQ'); if (i) i.oninput = () => { pcQ = i.value; const l = $('ppPcList'); if (l) l.innerHTML = pcListHTML(); };
}
async function openPcBill(id, btn) {
  const r = pcBillsOf().find(x => x.id === id); if (!r) return;
  btn.disabled = true;
  try { await openBillForEdit(id, r.partyId, 0); } finally { btn.disabled = false; }
}
// v1.97: bill ki poori (aur TAZA) tafseel — na ho to "⏳ aa rahi hai" khirki, har 5 second dekhna, aate hi edit khud khule
const billReady = (b, minUpdated) => !!(b && Number(b.purchaseId) && b.stamp && (b.lines || []).length && b.lines.every(l => l.itemId) && (Number(b.updatedAt) || 0) >= minUpdated);
function waitBill(id, minUpdated) {
  return new Promise(res => {
    const t0 = Date.now(); let done = false;
    const end = v => { if (done) return; done = true; res(v); };
    dlg('⏳ PC se tafseel aa rahi hai…', `<p>Bill abhi bana / badla hai — PC is ki poori tafseel bhej raha hai. Aate hi <b>edit khud khul jayega</b>, dobara dabane ki zaroorat nahi.</p><p class="stat-note" id="ppWaitSec">0 second</p><div class="account-tools"><button type="button" id="ppWaitStop">Band karo</button></div>`);
    $('ppWaitStop').onclick = () => { $('dialog')?.close(); end(null); };
    const tick = async () => {
      if (done) return;
      if (!$('dialog')?.open || !$('ppWaitSec')) { end(null); return; }   // khirki band kar di
      const s = $('ppWaitSec'); if (s) s.textContent = Math.round((Date.now() - t0) / 1000) + ' second';
      const b = await cloud.purchaseBill(id).catch(() => null);
      if (billReady(b, minUpdated)) { end(b); return; }
      if (Date.now() - t0 > 240000) { alert('4 minute mein bhi tafseel nahi aayi — PC par CHECK-BILLS.bat chalayein.'); $('dialog')?.close(); end(null); return; }
      setTimeout(tick, 5000);
    };
    setTimeout(tick, 2500);
  });
}
async function openBillForEdit(id, partyId, minUpdated) {
  let b = await cloud.purchaseBill(id).catch(() => null);
  if (!billReady(b, minUpdated)) { b = await waitBill(id, minUpdated); if (!b) return; }
  const st = Number(b.docStatus ?? b.status);
  if (st === 2) { alert('Yeh bill POSTED hai — pehle malik Unpost kare, phir edit.'); return; }
  if (st === 3) { alert('Yeh bill POS mein CANCEL hai.'); return; }
  if (!isOwner() && b.date !== todayStr()) { alert('Mulazim sirf AAJ ka khula bill edit kar sakta hai.'); return; }
  const m = ppLoadBill(b, { partyId }); if (m === 'cancel') return; if (m) { alert(m); return; }
  $('dialog')?.close(); rerender(); notice('✏️ Edit mode — party, godam, ginti, rates badal kar "💾 POS bill UPDATE" dabayein');
}
function openToday() {
  dlg(`Aaj ke app purchase (${today.length})`, todayErr ? `<p>${esc(todayErr)}</p>` : !today.length ? '<p>Aaj app se koi purchase bill nahi bana.</p>' :
    today.map(p => `<details class="sale-hist"><summary><b>${p.editOf ? '✏️ ' + esc(p.editOf.billNo || '') + ' · ' : ''}${esc(p.partyName || '')} · Rs ${num(p.total)}</b><small>${esc(new Date(p.createdAt || 0).toLocaleTimeString('en-PK'))} · ${statusText(p)}</small></summary>
      <div style="overflow-x:auto"><table><thead><tr><th>Item</th><th>Qty</th><th>Khareed</th><th>Rs</th></tr></thead><tbody>
      ${(p.lines || []).map(l => `<tr><td>${esc(l.name)}</td><td>${qtyText(l)}</td><td>${num(l.costP)}/${esc(l.uName || 'Pcs')}</td><td>${num(r2(l.qty * l.costP))}</td></tr>`).join('')}
      </tbody></table></div>${p.invoiceNo ? `<p>Supplier bill # ${esc(p.invoiceNo)}</p>` : ''}${p.note ? `<p>${esc(p.note)}</p>` : ''}${billActs(p)}</details>`).join(''));
}
function qtyText(l) {
  const pk = Number(l.pack) || 0, q = Number(l.qty) || 0;
  if (pk > 1 && q >= pk) { const c = Math.floor(q / pk + 1e-9), p = r3(q - c * pk); return `${num(c)} ${esc(l.cName || 'Ctn')}${p ? ' + ' + num(p) : ''}`; }
  return `${num(q)} ${esc(l.uName || 'Pcs')}`;
}

// ---------- screen ----------
function supplierBox() {
  const p = partyOf(supplier);
  if (p && !supOpen) return `<div class="pp-sup"><div><small>Supplier</small><b>${esc(p.name)}</b></div><button type="button" data-pp-sup-change>Badlein</button></div>`;
  return `<div class="pp-sup-pick"><label>Supplier chunein<input id="ppSupQ" type="search" placeholder="Naam / mobile (spelling ghalat bhi chalegi)" value="${esc(supQuery)}" autocomplete="off"></label>
    <div class="pp-sup-list">${supList()}</div></div>`;
}
function supList() {
  const q = supQuery.trim();
  const list = rankOf ? rankOf(partiesOf(), q, 25) : partiesOf().filter(x => !x.deleted && matchesOf(x, q)).slice(0, 25);
  return (list.length && !q ? '<small class="pchip-h">⭐ Aksar</small>' : '') + (list.map(x => `<button type="button" data-pp-sup="${esc(x.id)}">${esc(x.name)}</button>`).join('') || `<small>${q ? 'Koi supplier nahi mila' : 'Naam likhein'}</small>`);
}
export function renderPP() {
  installHooks(); watchToday();
  const s = stock();
  const total = cartTotal();
  const gopts = b => s.branches.map(x => `<option value="${x}"${Number(x) === Number(b) ? ' selected' : ''}>${esc(s.branchName(x, s.names))}</option>`).join('');
  $('summary').innerHTML = `<div class="stock-head sale-head pp-head" data-pp-root="1">
    <div class="pp-modes"><button type="button" class="on">🧾 Items wali bill</button>${photoFormOf ? '<button type="button" data-pp-photo="1">📷 Sirf photo + raqam</button>' : ''}</div>
    ${billStripHTML()}
    ${edit ? `<div class="pp-edit"><b>✏️ EDIT — POS bill ${esc(edit.billNo || '')}</b><small>Save par yahi bill POS mein UPDATE hoga (naya nahi banega)</small><button type="button" data-pp-edit-off="1">✕ Edit chhodo</button></div>` : ''}
    ${supplierBox()}
    <div class="pp-meta">
      ${s.branches.length ? `<label>Godam (sab items)<select data-pp-godam="1">${gopts(godam)}</select></label>` : ''}
      <label>Supplier bill # <input maxlength="40" data-pp-inv="1" value="${esc(invoiceNo)}" placeholder="ikhtiyari"></label>
    </div>
    <div class="pp-meta pp-add">
      <label>+ % (har item par)<input type="number" min="0" step="any" inputmode="decimal" data-pp-pct="1" value="${pct || ''}" placeholder="0"></label>
      <label>Mazdoori / kharcha Rs${xtraName ? ' (' + esc(xtraName) + ')' : ''}<input type="number" min="0" step="any" inputmode="decimal" data-pp-xtra="1" value="${xtra || ''}" placeholder="0"></label>
    </div>
    <p class="stat-note pp-addnote" id="ppXtraNote">${xtraNoteText()}</p>
    <div class="sale-total"><small>Purchase · ${cart.length} items</small><strong id="ppTotal">Rs ${num(total)}</strong></div>
    <div class="account-tools"><button class="sh-wide" id="ppTodayBtn" data-pp-today="1">${todayLabel()}</button>${aiBillOf && canUse() ? '<button class="sh-wide" data-pp-ai="1">🤖 Bill ki tasveer se items</button>' : ''}${aiRows && aiRows.length ? `<button class="sh-wide" data-pp-jopen="1">🧾 Jaanch kholo (${aiRows.filter(r => !r.skip && !r.done).length} baqi)</button>` : ''}${canUse() && !edit ? '<button class="sh-wide" data-pp-pcbills="1">✏️ PC ka bill edit karein</button>' : ''}${packGaps().length ? `<button data-pp-packs="1">📦 Carton size khali (${packGaps().length})</button>` : ''}${supplier ? '<button data-pp-copy="1">📑 Pichhla bill copy</button>' : ''}</div>
  </div>`;
  const si = $('search'); if (si) si.placeholder = '📷 scan ya item ka naam / code (Enter)';
  if (s.failed) { $('list').innerHTML = `<div class="empty"><strong>Items nahi mile</strong><p>${esc(s.failed)}</p></div>`; $('actions').innerHTML = ''; return; }
  if (!s.loaded) { $('list').innerHTML = '<p class="stat-note">Items load ho rahe hain…</p>'; $('actions').innerHTML = ''; return; }

  const q = norm(si?.value || '');
  const camRow = `<div class="sale-camrow"><button type="button" class="sale-cam" data-pp-camera="1">📷 Scan</button><button type="button" class="sale-mic" data-pp-mic="1" title="Awaz se">🎤</button><span class="stat-note">Wohi item dobara = +1 ${'Ctn'}</span></div>`;
  let found = '';
  if (q) {
    const hits = smartSearch(s.items, q, 25);
    found = `<div class="sale-found">${hits.length ? hits.map(r => `<button type="button" class="sale-hit" data-pp-add="${esc(r.id)}"><b>${esc(r.name)}</b><small>${esc(r.code || '')} · khareed ${num(r.prate)}${Number(r.pack) > 1 ? ' · 1 ' + esc(r.cName || 'Ctn') + ' = ' + num(r.pack) : ''} · stock ${num(r.stock)}</small></button>`).join('') : '<p class="stat-note">Koi item nahi mila</p>'}</div>`;
  }
  if (supplier && !q) loadSupItems(supplier);
  const si2 = supplier && !q ? (supItems.get(supplier)?.list || []).map(x => s.items.find(r => String(r.id) === String(x.id))).filter(Boolean).slice(0, 12) : [];
  if (si2.length) found = `<div class="sale-found"><p class="stat-note" style="margin:0 0 4px">📦 Is supplier se aksar aane wale</p><div class="mchips">${si2.map(r => `<button type="button" data-pp-add="${esc(r.id)}">${esc(r.name)}</button>`).join('')}</div></div>`;
  const bar = cart.length ? `<div class="ws-chips"><small>Wholesale nafa SAB items par (naye khareed ke upar):</small>${W_CHIPS.map(p => `<button type="button" data-pp-wall="${p}">+${p}%</button>`).join('')}<input id="ppWCustom" type="number" inputmode="decimal" min="0" step="0.01" placeholder="apni %"><button type="button" data-pp-wall-custom="1">Lagao</button><button type="button" data-pp-old-all="1">↺ Sab par purana nafa</button></div>` : '';
  const rows = cart.map((l, i) => {
    const pk = packOf(l), pcs = linePcs(l);
    const wN = nafaPct(l.oldW, l.oldCost), rN = nafaPct(l.oldR, l.oldCost);
    const hint = v => v > 0 ? `pehle ${num(v)}` : '—';
    const ch = (v, now) => v > 0 && Math.abs((Number(now) || 0) - v) > 0.004 ? ' changed' : '';
    return `<div class="sale-line pp-line" data-pp-line="${i}">
      <div class="sale-line-top"><b><span class="pp-no">${i + 1}.</span> ${esc(l.name)}${l.billName && l.billName !== l.name ? `<small class="pp-billname">bill: ${esc(l.billName)}</small>` : ''}</b><button type="button" class="danger sale-x" data-pp-del="${i}" aria-label="Hatao">✕</button></div>
      <small>${esc(l.code)}${pk ? ' · 1 ' + esc(l.cName) + ' = ' + num(pk) : ''} · ${l.mem ? '<b>pichhli dafa</b> khareed' : 'purana khareed'} <b>${l.oldCost > 0 ? num(l.oldCost) + '/' + esc(l.uName) + (pk ? ' (' + num(r2(l.oldCost * pk)) + '/' + esc(l.cName) + ')' : '') : 'maloom nahi'}</b>${wN != null ? ' · nafa W ' + wN + '%' : ''}${rN != null ? ' · R ' + rN + '%' : ''}</small>
      <div class="sale-inputs pp-inputs">
        ${pk ? `<label>${esc(l.cName)} (${num(pk)})<input type="number" min="0" step="1" inputmode="numeric" data-pp-ctn="${i}" value="${l.ctn || ''}"></label>` : ''}
        <label>${esc(l.uName)}<input type="number" min="0" step="any" inputmode="decimal" data-pp-pcs="${i}" value="${l.pcs || ''}"></label>
        ${pk ? `<label>Khareed / ${esc(l.cName)}<input type="number" min="0" step="any" inputmode="decimal" data-pp-costc="${i}" value="${l.costP ? r2(l.costP * pk) : ''}"></label>` : ''}
        <label>Khareed / ${esc(l.uName)}<input type="number" min="0" step="any" inputmode="decimal" data-pp-costp="${i}" value="${l.costP ? r2(l.costP) : ''}"></label>
        ${s.branches.length > 1 ? `<label>Godam<select data-pp-lg="${i}">${gopts(l.godam)}</select></label>` : ''}
        <label class="sale-amt pp-amt"><small>${num(pcs)} ${esc(l.uName)} · bill ki raqam</small><input type="number" min="0" step="any" inputmode="decimal" data-pp-amt="${i}" id="ppAmt${i}" value="${lineTotal(l) ? r2(lineTotal(l)) : ''}" placeholder="raqam"></label>
      </div>
      <div class="pp-rates">
        <small class="pp-rates-h">Naye rates (POS mein lagenge)${l.wMode === 'old' && l.rMode === 'old' ? ' · purane nafa se' : ''}</small>
        <div class="pp-rate-grid">
          ${pk ? `<label>Wholesale ${esc(l.cName)}<input class="${ch(r2(l.oldW * pk), l.wctn)}" type="number" min="0" step="any" inputmode="decimal" data-pp-wctn="${i}" value="${l.wctn || ''}" placeholder="${hint(Math.round(l.oldW * pk))}"><small>${hint(Math.round(l.oldW * pk))}</small></label>` : ''}
          <label>Wholesale ${esc(l.uName)}<input class="${ch(l.oldW, l.wpcs)}" type="number" min="0" step="any" inputmode="decimal" data-pp-wpcs="${i}" value="${l.wpcs || ''}"><small>${hint(l.oldW)}</small></label>
          ${pk ? `<label>Parchoon ${esc(l.cName)}<input class="${ch(Math.round(l.oldR * pk), l.rctn)}" type="number" min="0" step="any" inputmode="decimal" data-pp-rctn="${i}" value="${l.rctn || ''}"><small>${hint(Math.round(l.oldR * pk))}</small></label>` : ''}
          <label>Parchoon ${esc(l.uName)}<input class="${ch(pk ? l.oldR2 : l.oldR, l.rpcs)}" type="number" min="0" step="any" inputmode="decimal" data-pp-rpcs="${i}" value="${l.rpcs || ''}"><small>${hint(pk ? l.oldR2 : l.oldR)}</small></label>
        </div>
        <div class="mchips">${l.oldCost > 0 ? `<button type="button" class="${l.wMode === 'old' && l.rMode === 'old' ? 'on' : ''}" data-pp-old="${i}">↺ Purana nafa${wN != null ? ' W ' + wN + '%' : ''}${rN != null ? ' · R ' + rN + '%' : ''}</button>` : ''}${W_CHIPS.map(p => `<button type="button" class="${l.wMode === p ? 'on' : ''}" data-pp-w="${i}:${p}">W +${p}%</button>`).join('')}</div>
      </div>
    </div>`;
  }).join('');
  const foot = cart.length ? `<div class="sale-pay"><label>Note (ikhtiyari)<input maxlength="100" data-pp-note="1" value="${esc(note)}"></label>
    <p class="stat-note">Bill POS mein baqi bills jaisa (credit, open) banega — post baad mein "📌 post" se. Payment ki entry pehle jaisi alag.</p></div>` : '';
  const pinned = billPin && billPics.length ? `<div class="pp-billbar" data-zoom="${billZoom}"><div class="pp-billwrap"><img src="${billPics[Math.min(billIx, billPics.length - 1)]}" alt="bill"></div><div class="pp-billacts"><button type="button" data-pp-zoom="-1">−</button><button type="button" data-pp-zoom="1">+</button>${billPics.length > 1 ? `<button type="button" data-pp-nextpic="1">${billIx + 1}/${billPics.length} ›</button>` : ''}<button type="button" data-pp-pic="${billIx}">⤢ Poori screen</button><button type="button" data-pp-pin="1">✕</button></div></div>` : '';
  $('list').innerHTML = pinned + camRow + found + (cart.length ? bar + `<div class="sale-cart">${rows}</div>` + foot :
    (q ? '' : `<div class="empty"><strong>Naya purchase bill</strong><p>Upar supplier chunein, phir item ka naam likhein ya 📷 se scan karein.</p></div>`));
  $('actions').innerHTML = cart.length ? `<button class="give" data-pp-clear="1">✕ Naya bill</button><button data-pp-camera="1" title="Barcode scan">📷</button>
    <button class="got" data-pp-save="1"${saving ? ' disabled' : ''}>${saving ? 'Bhej raha hoon…' : saveLabel(total)}</button>` : '';
}
const saveLabel = t => (edit ? '💾 POS bill UPDATE · Rs ' : '💾 POS mein bhejo · Rs ') + num(t);
function xtraNoteText() {
  const parts = [];
  if (pct > 0) parts.push(`+${num(pct)}% har item par`);
  if (xtra > 0) parts.push(`Rs ${num(xtra)} raqam ke hisaab se sab par (+${num(Math.round(xtraPct() * 100) / 100)}%)`);
  return parts.length ? parts.join(' · ') + ` — POS bill Rs ${num(cartTotal())}` : 'Bill par % ya mazdoori / kiraya ho to upar likhein — har item ki khareed mein jud jayega.';
}
function refreshTotals() {
  const xn = $('ppXtraNote'); if (xn) xn.textContent = xtraNoteText();
  const t = $('ppTotal'); if (t) t.textContent = 'Rs ' + num(cartTotal());
  cart.forEach((l, i) => { const a = $('ppAmt' + i); if (a && document.activeElement !== a) a.value = lineTotal(l) ? r2(lineTotal(l)) : ''; });
  const b = document.querySelector('[data-pp-save]'); if (b && !saving) b.textContent = saveLabel(cartTotal());
}
// rates ke khane (focus kharab kiye baghair) taza karo
function paintRates(i) {
  const l = cart[i]; if (!l) return;
  for (const [k, v] of [['wctn', l.wctn], ['wpcs', l.wpcs], ['rctn', l.rctn], ['rpcs', l.rpcs], ['costc', l.costP ? r2(l.costP * packOf(l)) : ''], ['costp', l.costP ? r2(l.costP) : '']]) {
    const el = document.querySelector(`[data-pp-${k}="${i}"]`);
    if (el && document.activeElement !== el) el.value = v || '';
  }
}

// ---------- events ----------
const inPP = t => !!t?.closest?.('#list,#summary') && !!document.querySelector('[data-pp-root]');
document.addEventListener('input', e => {
  const t = e.target;
  if (t?.id === 'ppSupQ') { supQuery = t.value; const box = t.closest('.pp-sup-pick')?.querySelector('.pp-sup-list');
    if (box) box.innerHTML = supList(); return; }
  if (!inPP(t)) return;
  const d = t.dataset; let i;
  if ((i = d.ppCtn) != null) cart[i].ctn = Math.max(0, Math.floor(Number(t.value) || 0));
  else if ((i = d.ppPcs) != null) cart[i].pcs = Math.max(0, Number(t.value) || 0);
  else if ((i = d.ppCostc) != null) { const l = cart[i]; l.costP = packOf(l) ? r4((Number(t.value) || 0) / packOf(l)) : Number(t.value) || 0; recalc(l); paintRates(i); }
  else if ((i = d.ppCostp) != null) { const l = cart[i]; l.costP = r4(Number(t.value) || 0); recalc(l); paintRates(i); }
  else if ((i = d.ppAmt) != null) {   // v2.1.0: bill ki raqam likho -> khareed = raqam ÷ ginti
    const l = cart[i], q = linePcs(l), amt = Number(t.value) || 0;
    if (q > 0 && amt > 0) { l.costP = r4(amt / q); recalc(l); paintRates(i); }
  }
  else if ((i = d.ppWctn) != null) { cart[i].wctn = Number(t.value) || 0; cart[i].wMode = 'manual'; }
  else if ((i = d.ppWpcs) != null) { cart[i].wpcs = Number(t.value) || 0; cart[i].wMode = 'manual'; }
  else if ((i = d.ppRctn) != null) { cart[i].rctn = Number(t.value) || 0; cart[i].rMode = 'manual'; }
  else if ((i = d.ppRpcs) != null) { cart[i].rpcs = Number(t.value) || 0; cart[i].rMode = 'manual'; }
  else if (d.ppXtra != null) { xtra = Math.max(0, Number(t.value) || 0); xtraApply(); cart.forEach((_, j) => paintRates(j)); }
  else if (d.ppPct != null) { pct = Math.max(0, Math.min(100, Number(t.value) || 0)); xtraApply(); cart.forEach((_, j) => paintRates(j)); }
  else if (d.ppNote != null) note = t.value.slice(0, 100);
  else if (d.ppInv != null) invoiceNo = t.value.slice(0, 40);
  else return;
  keepDraft(); refreshTotals();
});
document.addEventListener('change', e => {
  const t = e.target; if (!inPP(t)) return;
  if (t.dataset.ppGodam != null) {
    godam = Number(t.value);
    if (cart.length && confirm('Sab items ka godam bhi yahi kar dein?')) cart.forEach(l => { l.godam = godam; });
    keepDraft(); rerender(); return;
  }
  if (t.dataset.ppLg != null) { const l = cart[t.dataset.ppLg]; if (l) { l.godam = Number(t.value); keepDraft(); } return; }
  if (t.dataset.ppDay != null) { day = t.value; keepDraft(); return; }
});
// v2.4.0: kisi khane mein Enter / Done = agla khana; line ka aakhri khana ho to agli line khud screen par
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || !document.querySelector('[data-pp-root]')) return;
  const t = e.target; if (!t || t.tagName !== 'INPUT' || t.id === 'search') return;
  const box = t.closest('.sale-cart, .jc-card'); if (!box) return;
  e.preventDefault();
  const all = [...box.querySelectorAll('input:not([type=hidden]):not([disabled])')];
  const i = all.indexOf(t), nx = all[i + 1];
  if (nx) {
    const l1 = t.closest('.pp-line'), l2 = nx.closest('.pp-line');
    nx.focus(); try { nx.select?.(); } catch {}
    if (l1 !== l2 && l2) l2.scrollIntoView({ block: 'start' });
  } else if (box.classList.contains('jc-card')) {
    document.querySelector('[data-pp-jok]')?.click();
  } else t.blur();
}, true);
document.addEventListener('input', e => {       // v2.4.6: Khulase mein kharcha
  const t = e.target; if (t?.dataset?.ppJxtra == null && t?.dataset?.ppJpct == null) return;
  if (t.dataset.ppJpct != null) pct = Math.max(0, Math.min(100, Number(t.value) || 0)); else xtra = Math.max(0, Number(t.value) || 0);
  keepDraft();
  const n = $('jXtraNote'); if (n) n.textContent = xtra > 0 ? `Har item ki khareed mein raqam ke hisaab se (+${num(Math.round(xtraPct() * 100) / 100)}%)` : 'Na ho to khali chhor dein';
  const sb = document.querySelector('[data-pp-jsend]'); if (sb) sb.textContent = '💾 POS mein bhejo · Rs ' + num(cartTotal());
  refreshTotals();
});
document.addEventListener('change', e => { if ((e.target?.dataset?.ppJxtra != null || e.target?.dataset?.ppJpct != null) && jView === 'sum') jSummary(); });   // farq dobara
document.addEventListener('input', e => {       // v2.4.1: Jaanch card ke khane seedha cart line mein (CTN rates bhi)
  const t = e.target, d = t?.dataset; if (!d || !t.closest?.('.jc-card')) return;
  const r = aiRows && aiRows[jIx]; const l = r && r.key ? cart.find(x => x.k === r.key) : null; if (!l) return;
  const v = Number(t.value) || 0, pk = packOf(l), cs = jCs(r, l), m = pk || cs;
  if (d.ppJcs != null) { r.cs = v > 1 ? v : -1; return; }                // 1 ya khali = carton BAND (change par card dobara)
  if (d.ppJctn != null) { if (pk) l.ctn = Math.max(0, Math.floor(v)); else if (cs) l.pcs = r3(v * cs); }
  else if (d.ppJpcs != null) { l.pcs = Math.max(0, v); if (l.kul > 0 && linePcs(l) > 0) { l.costP = r4(l.kul / linePcs(l)); recalc(l); } }   // kul raqam pakki, rate dobara
  else if (d.ppJtot != null) { l.kul = v; if (v > 0 && linePcs(l) > 0) { l.costP = r4(v / linePcs(l)); recalc(l); } }        // v2.4.4: kul ÷ ginti = net khareed
  else if (d.ppJkc != null) { if (m) { l.costP = r4(v / m); recalc(l); } }
  else if (d.ppJcost != null) { l.costP = r4(v); l.kul = 0; recalc(l); }
  else if (d.ppJwc != null) { if (pk) l.wctn = v; else if (cs) l.wpcs = r2(v / cs); else { l.wctn = v; l.wcOwn = true; } l.wMode = 'manual'; }
  else if (d.ppJw != null) { l.wpcs = v; if (pk && !l.wctn) l.wctn = Math.round(v * pk); if (!pk && l.one && !l.wcOwn) l.wctn = v; l.wMode = 'manual'; }
  else if (d.ppJrc != null) { if (pk) l.rctn = v; else if (cs) l.rpcs = r2(v / cs); else { l.rctn = v; l.rcOwn = true; } l.rMode = 'manual'; }
  else if (d.ppJr != null) { l.rpcs = v; if (pk && !l.rctn) l.rctn = Math.round(v * pk); if (!pk && l.one && !l.rcOwn) l.rctn = v; l.rMode = 'manual'; }
  else return;
  jRepaint(); keepDraft(); refreshTotals();
});
document.addEventListener('change', e => {      // "1 CTN =" likh kar chhora -> card naye size se
  const t = e.target; if (!t?.dataset || t.dataset.ppJcs == null || !t.closest?.('.jc-card')) return;
  const r = aiRows && aiRows[jIx]; if (!r) return;
  r.force = Number(r.cs) > 1 ? 'size' : 'pcs'; jJudge(r, billFmtOf(supplier));
  if (Number(r.cs) === -1) {                    // carton band: hisaab PCS par — na mile to khareed = kul ÷ PCS
    const l = r.key ? cart.find(x => x.k === r.key) : null, tt = aiNum(r.ai).total, q = l ? linePcs(l) : 0;
    if (l && tt > 0 && q > 0 && !jNear(lineTotal(l), tt)) { l.costP = r4(tt / q); recalc(l); jJudge(r, billFmtOf(supplier)); }
  }
  keepDraft(); rerender(); jCard(jIx);
});
// v2.4.1: card par ungli daayein = ✓ agla, baayein = pichhla (khane / button par nahi)
let jTouch = null;
document.addEventListener('touchstart', e => {
  const c = e.target.closest?.('.jc-card'); if (!c || e.target.closest('input,button,select,label')) { jTouch = null; return; }
  const t = e.touches[0]; jTouch = { x: t.clientX, y: t.clientY };
}, { passive: true });
document.addEventListener('touchend', e => {
  if (!jTouch || jView !== 'card') return;
  const t = e.changedTouches[0], dx = t.clientX - jTouch.x, dy = t.clientY - jTouch.y; jTouch = null;
  if (Math.abs(dx) < 70 || Math.abs(dy) > 60) return;
  if (dx > 0) document.querySelector('[data-pp-jok]')?.click(); else jPrev();
}, { passive: true });
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || e.target?.id !== 'search' || !document.querySelector('[data-pp-root]')) return;
  const v = e.target.value.trim(); if (!v) return;
  e.preventDefault();
  const { items } = stock();
  let it = findByCode(items, v);
  if (!it) { const hs = smartSearch(items, v, 2); if (hs.length === 1) it = hs[0]; }
  if (!it) { notice('Ek item nahi mila — list se chunein'); return; }
  const r = addItem(it); e.target.value = ''; notice(r.again ? `+1 · ${it.name}` : `✓ ${it.name}`); rerender(); focusLine(r.line.k);
});
function focusLine(k) {
  setTimeout(() => { const i = cart.findIndex(l => l.k === k); const box = document.querySelector(`[data-pp-ctn="${i}"]`) || document.querySelector(`[data-pp-pcs="${i}"]`);
    if (box) { box.scrollIntoView({ block: 'center' }); } }, 60);
}
document.addEventListener('click', async e => {
  if (!document.querySelector('[data-pp-root]')) return;
  const mic = e.target.closest?.('[data-pp-mic]');
  if (mic) { const ok = voiceSearch(t => { const s = $('search'); if (s) { s.value = t; s.dispatchEvent(new Event('input', { bubbles: true })); } }); if (!ok) notice('Is phone/browser mein awaz se search nahi chalti'); return; }
  const off = e.target.closest?.('[data-pp-edit-off]');
  if (off) { if (!confirm('Edit chhor dein? (POS ka bill waisa hi rahega; screen saaf ho jayegi)')) return; edit = null; cart = []; note = ''; invoiceNo = ''; day = ''; xtra = 0; xtraName = ''; pct = 0; keepDraft(); rerender(); return; }
  const pc = e.target.closest?.('[data-pp-pcbills],[data-pp-pcbill],[data-pp-pcwhen]');
  if (pc) { const d = pc.dataset; if (d.ppPcbills) openPcBills(); else if (d.ppPcwhen) { pcWhen = d.ppPcwhen; openPcBills(); } else if (d.ppPcbill) openPcBill(d.ppPcbill, pc); return; }
  const px = e.target.closest?.('[data-pp-photo],[data-pp-ai]');
  if (px) { if (px.dataset.ppPhoto != null) { if (photoFormOf) photoFormOf(); } else aiItems(); return; }
  const cm = e.target.closest?.('[data-pp-aicam],[data-pp-aigal],[data-pp-camgo],[data-pp-camnext],[data-pp-camredo],[data-pp-camx]');
  if (cm) { const d = cm.dataset;          // v2.4.5: camera / gallery
    if (d.ppAicam != null || d.ppCamnext != null) aiPick(true);
    else if (d.ppAigal != null) aiPick(false);
    else if (d.ppCamredo != null) { camPages.pop(); aiPick(true); }
    else if (d.ppCamx != null) { camClear(); $('dialog')?.close?.(); }
    else if (d.ppCamgo != null && camPages.length) { const f = camPages.slice(); camClear(); aiRead(f); }
    return; }
  const bp = e.target.closest?.('[data-pp-pic],[data-pp-pin],[data-pp-zoom],[data-pp-nextpic],[data-pp-vzoom],[data-pp-vnext]');
  if (bp) { const d = bp.dataset;
    if (d.ppPin != null) { billPin = !billPin; rerender(); }
    else if (d.ppZoom != null) { billZoom = Math.min(3, Math.max(1, billZoom + Number(d.ppZoom) * 0.5)); rerender(); }
    else if (d.ppNextpic != null) { billIx = (billIx + 1) % billPics.length; rerender(); }
    else if (d.ppVzoom != null) { zStep(Number(d.ppVzoom)); }
    else if (d.ppVnext != null) { billIx = (billIx + 1) % billPics.length; zFocus = 0; billView(); }
    else { billIx = Math.min(Number(d.ppPic) || 0, billPics.length - 1); zFocus = Number(d.ppFocus) || 0; billView(); }
    return; }
  const fm = e.target.closest?.('[data-pp-fmt]');
  if (fm) {
    const v = fm.dataset.ppFmt;
    if (v === 'ask') { jForceAsk = true; aiFmtAuto = ''; jView = 'list'; aiRender(); return; }
    const q = v === 'ctn' ? 'ctn' : v === 'both' ? 'both' : 'pcs';
    const old = billFmtOf(supplier) || {};
    const next = { ...old, q, n: (Number(old.n) || 0) + 1, t: Date.now() };
    if (supplier && saveBillFmtOf) { try { Promise.resolve(saveBillFmtOf(supplier, next)).catch(() => {}); } catch {} }
    jForceAsk = false; aiFmtAuto = '';
    const fmtNow = next;
    for (const r of aiRows || []) if (!r.skip) {          // aap ka tap = IS bill par zabardasti (agle bills par tarjeeh)
      const ln = r.key ? cart.find(l => l.k === r.key) : null;
      const has = ln ? jCandidates(ln, aiOf(r), r.band ? -1 : r.cs).map(c => c.mode) : [];
      r.force = q === 'pcs' ? 'pcs' : q === 'ctn' ? (has.includes('ctn') ? 'ctn' : has.includes('size') ? 'size' : '') : '';
      jJudge(r, fmtNow);
    }
    keepDraft(); rerender(); jView = 'list'; aiRender();
    notice('📐 Naqsha yaad kar liya: ginti = ' + jModeName(q));
    return;
  }
  // v2.4.0: Jaanch mode ke button
  if (e.target.closest?.('[data-pp-jopen]')) { if (aiRows) aiRender(); return; }
  if (e.target.closest?.('[data-pp-jprev]')) { jPrev(); return; }   // pichhla card — current pakka nahi hota
  if (e.target.closest?.('[data-pp-jfixq],[data-pp-jfixr]')) {      // v2.4.2: bill ke hisaab se
    const r = aiRows && aiRows[jIx]; if (!r) return;
    const base = aiOf(r);
    if (e.target.closest('[data-pp-jfixq]')) r.aiFix = { ...base, ctn: 0, pcs: 0, qty: r.fixQ };
    else r.aiFix = { ...base, rate: r.fixR };
    r.aiFixUser = true; r.fixNote = 'Aap ne bill ke hisaab se lagaya'; r.force = '';
    jJudge(r, billFmtOf(supplier)); keepDraft(); rerender(); jCard(jIx); return;
  }
  if (e.target.closest?.('[data-pp-vback]')) { if (jView === 'card' && jIx >= 0) jCard(jIx); else if (aiRows) aiRender(); else $('dialog')?.close(); return; }
  const jb = e.target.closest?.('[data-pp-jgreen],[data-pp-jstart],[data-pp-jcard],[data-pp-jok],[data-pp-jskip],[data-pp-junskip],[data-pp-jmode],[data-pp-jsum],[data-pp-jsend],[data-pp-jlist],[data-pp-jmerge],[data-pp-jclose],[data-pp-packs]');
  if (jb) { const d = jb.dataset;
    if (d.ppJgreen) { for (let i = 0; i < aiRows.length; i++) if (!aiRows[i].skip && !aiRows[i].done && aiRows[i].j?.conf === 'g') await jAccept(i); notice('✓ Hari lines pakki'); jView = 'list'; aiRender(); }
    else if (d.ppJstart) { const q = jQueue(); const first = q.find(x => aiRows[x].j?.conf !== 'g'); jIx = first != null ? first : (q[0] ?? -1); if (jIx < 0) jSummary(); else jCard(jIx); }
    else if (d.ppJcard != null) { jCard(Number(d.ppJcard)); }
    else if (d.ppJok) { await jAccept(jIx); jNext(); }
    else if (d.ppJskip) { jSkip(jIx); jNext(); }
    else if (d.ppJunskip != null) { jUnskip(Number(d.ppJunskip)); jSummary(); }
    else if (d.ppJmode) { const r = aiRows[jIx]; if (r) { r.force = d.ppJmode; jJudge(r, billFmtOf(supplier)); keepDraft(); rerender(); jCard(jIx); } }
    else if (d.ppJsum) { jSummary(); }
    else if (d.ppJsend) { $('dialog')?.close(); save(); }
    else if (d.ppJlist) { jView = 'list'; jIx = -1; aiRender(); }
    else if (d.ppJmerge) { const [x, y] = d.ppJmerge.split('|').map(Number); jMerge(x, y); jSummary(); }
    else if (d.ppJclose) { $('dialog')?.close(); }
    else if (d.ppPacks) { packsView(); }
    return; }
  const al = e.target.closest?.('[data-pp-learn],[data-pp-pick],[data-pp-picked],[data-pp-aiback]');
  if (al) { const d = al.dataset;
    if (d.ppLearn != null) aiLearn(Number(d.ppLearn), al);
    else if (d.ppPick != null) aiPickForm(Number(d.ppPick));
    else if (d.ppPicked != null) { const [i, id] = d.ppPicked.split('|'); aiPicked(Number(i), id); }
    else aiRender();
    return; }
  const ba = e.target.closest?.('[data-pp-retry],[data-pp-reopen],[data-pp-editdone],[data-pp-cancel]');
  if (ba) { const d = ba.dataset; billAct(d.ppRetry ? 'retry' : d.ppReopen ? 'reopen' : d.ppEditdone ? 'editdone' : 'cancel', d.ppRetry || d.ppReopen || d.ppEditdone || d.ppCancel, ba); return; }
  const t = e.target.closest?.('[data-pp-sup],[data-pp-sup-change],[data-pp-add],[data-pp-del],[data-pp-clear],[data-pp-save],[data-pp-today],[data-pp-camera],[data-pp-old],[data-pp-w],[data-pp-wall],[data-pp-wall-custom],[data-pp-old-all],[data-pp-copy]');
  if (!t) return;
  const d = t.dataset;
  if (d.ppSup) { supplier = d.ppSup; notePartyPick(supplier); supOpen = false; supQuery = ''; keepDraft(); rerender(); return; }
  if (d.ppSupChange != null) { supOpen = true; rerender(); setTimeout(() => $('ppSupQ')?.focus(), 50); return; }
  if (d.ppAdd) { const it = stock().items.find(r => String(r.id) === d.ppAdd); if (it) { const r = addItem(it); const s = $('search'); if (s) s.value = ''; notice(r.again ? `+1 · ${it.name}` : `✓ ${it.name}`); rerender(); focusLine(r.line.k); } return; }
  if (d.ppDel != null) { cart.splice(Number(d.ppDel), 1); keepDraft(); rerender(); return; }
  if (d.ppClear) { if (!confirm(edit ? 'Edit chhor kar screen saaf kar dein? (POS ka bill waisa hi rahega)' : 'Yeh purchase bill saaf kar dein?')) return; cart = []; note = ''; invoiceNo = ''; edit = null; day = ''; xtra = 0; xtraName = ''; pct = 0; setBillPics([]); billPin = false; aiRows = null; aiBillInfo = null; jView = 'list'; jIx = -1; keepDraft(); rerender(); return; }
  if (d.ppCamera) { openSaleCamera(); return; }
  if (d.ppToday) { openToday(); return; }
  if (d.ppOld != null) { const l = cart[d.ppOld]; if (l) { l.wMode = 'old'; l.rMode = 'old'; recalc(l); keepDraft(); rerender(); } return; }
  if (d.ppW) { const [i, p] = d.ppW.split(':'); const l = cart[i]; if (l) { l.wMode = Number(p); recalc(l); keepDraft(); rerender(); } return; }
  if (d.ppWall || d.ppWallCustom) {
    const p = Number(d.ppWall || $('ppWCustom')?.value) || 0; if (!(p > 0)) { notice('Pehle % likhein'); return; }
    cart.forEach(l => { l.wMode = p; recalc(l); }); keepDraft(); rerender(); notice(`Wholesale +${p}% sab items par`); return;
  }
  if (d.ppOldAll) { cart.forEach(l => { l.wMode = 'old'; l.rMode = 'old'; recalc(l); }); keepDraft(); rerender(); return; }
  if (d.ppCopy) { copyLast(t); return; }
  if (d.ppSave) save();
});

// ---------- v1.98.0: bill ki tasveer -> AI items parhe -> SEEDHE isi bill ke cart mein ----------
// v1.99.0: har line par bill ka naam aur system ka naam — Yaad kar lo / Badlein
let aiBusy = false, aiRows = null, aiBillInfo = null;
// v2.2.0: bill ki tasveerein — sirf is waqt ke liye (object URL, memory mein; kahin save nahi hoti)
let billPics = [], billPin = false, billIx = 0, billZoom = 1;
function setBillPics(files) {
  for (const u of billPics) { try { URL.revokeObjectURL(u); } catch {} }
  billPics = [...files].map(f => { try { return URL.createObjectURL(f); } catch { return ''; } }).filter(Boolean);
  billIx = 0; billZoom = 1;
}
function billStripHTML() {
  if (!billPics.length) return '';
  return `<div class="pp-pics">${billPics.map((u, i) => `<button type="button" class="pp-pic" data-pp-pic="${i}"><img src="${u}" alt="bill"></button>`).join('')}<button type="button" data-pp-pic="0">📄 Bill dekhein</button><button type="button" class="${billPin ? 'on' : ''}" data-pp-pin="1">${billPin ? '📌 Hata do' : '📌 Upar chipka do'}</button></div>`;
}
const aiQtyText = l => [(Number(l.ctn) || 0) && (num(l.ctn) + ' ctn'), (Number(l.pcs) || 0) && (num(l.pcs) + ' pcs')].filter(Boolean).join(' + ') || '—';
const aiNameOf = l => String(l.roman || l.name || '').trim();
// v2.4.0: jin items ka bill par carton size (سائز) mila magar POS mein "1 CTN = ?" khali ya alag hai
function packGaps() {
  let m = {}; try { m = lastRatesOf() || {}; } catch {}
  const { items } = stock(), out = [];
  for (const [id, v] of Object.entries(m)) {
    if (!(Number(v?.s) > 1)) continue;          // 1 = aap ne carton band kiya
    const it = items.find(x => String(x.id) === String(id)); if (!it) continue;
    const pk = Number(it.pack) > 1 ? Number(it.pack) : 0;
    if (!pk || Math.abs(pk - Number(v.s)) > 0.01) out.push({ it, s: Number(v.s), pk });
  }
  return out;
}
function packsView() {
  const g = packGaps();
  dlg('📦 Carton size khali / alag', (g.length ? g.map(x => `<div class="pc-row warn"><span>📦</span><div><b>${esc(x.it.name)}</b><br><small>Bill par 1 carton = <b>${num(x.s)}</b> · POS mein ${x.pk ? '1 CTN = ' + num(x.pk) : '<b>khali</b>'}</small></div></div>`).join('') : '<p>Koi item nahi.</p>') +
    '<p class="stat-note">App in items par bill ka size khud istemal karti hai. POS mein bhi bharna ho to abhi haath se bharein — PC ka "pack-lagao" script aane par yahin se ek tap mein bhar sakenge.</p>');
}
// ================= v2.4.0: LINE KA DIMAGH + JAANCH MODE =================
// Har AI line par app 3-4 tareeqe aazmati hai — PCS (ginti pieces, rate fi piece) · CTN (POS ka carton) ·
// SIZE (bill ka سائز: ginti × size = pieces, rate ÷ size) · DONO (bill par ctn aur pcs alag khane) — aur har ek
// ko parakhti hai: (1) nikla hua khareed PICHHLE khareed ke kitna qareeb, (2) supplier ka naqsha, phir
// line ka rang: 🟢 g (pakka) · 🟡 y (dekh lein) · 🔴 r (shak). Sath do pehre: hisaab (ginti × rate ≈ kul) aur
// stock (khareed maujooda stock ke muqable had se bari to nahi).
const J_OK = 0.10, J_WARN = 0.50;          // ±10% = hara, ±50% tak = peela, us se door = unit ka shak
const logR = (a, b) => (a > 0 && b > 0) ? Math.abs(Math.log(a / b)) : null;
function memOf(id) { try { return (lastRatesOf() || {})[String(id)] || null; } catch { return null; } }
function aiNum(ai) {                          // AI ne jo ginti di: ctn + pcs, ya akeli qty
  const c = Number(ai.ctn) || 0, p = Number(ai.pcs) || 0, q = Number(ai.qty) || 0;
  return { c, p, n: r3((c + p) || q), rate: Number(ai.rate) || 0, total: Number(ai.total) || 0 };
}
// v2.4.2: AI ki line — agar app ne bill ke hisaab se theek ki ho to wahi
const aiOf = r => r.aiFix || r.ai;
const jNear = (a, b, t = 0.005) => b > 0 && Math.abs(a - b) / b <= t;
function jFix(r, ln) {
  if (r.aiFixUser) return;                       // aap ne button se lagaya — chhedo mat
  r.aiFix = null; r.fixNote = ''; r.fixQ = 0; r.fixR = 0;
  const { c, p, n, rate, total } = aiNum(r.ai);
  if (!(total > 0) || !(rate > 0)) return;
  if (n > 0 && jNear(n * rate, total, 0.02)) return;              // hisaab pehle se theek
  const q = total / rate;
  let pick = [c, p].find(x => x > 0 && jNear(q, x, 0.01));       // bill ka kul ÷ rate = AI ka koi number
  if (!pick && c > 0 && c === p && jNear(c * rate, total, 0.20) && !jNear(2 * c * rate, total, 0.20)) pick = c;   // v2.4.4: ek number do khano mein (discount/tax 20% tak)
  if (pick) {
    r.aiFix = { ...r.ai, ctn: pick === c && !(c === p) ? c : 0, pcs: pick === p || c === p ? pick : 0, qty: pick };
    if (c === p) r.aiFix = { ...r.ai, ctn: 0, pcs: 0, qty: pick };   // ek hi number do khano mein tha
    r.fixNote = `Bill ke hisaab se theek kiya: ${num(pick)} × ${num(rate)} = ${num(total)}`;
    return;
  }
  const clean = Math.abs(q - Math.round(q * 1000) / 1000) < 1e-6 || Math.abs(q - Math.round(q)) < 0.02;
  // rate pichhle khareed se mil raha hai (fi pcs ya fi carton) -> ghalti ginti mein hai -> bill ki ginti khud lagao
  const old = Number(ln?.oldCost) || 0, pk = ln ? packOf(ln) : 0;
  const rateOk = old > 0 && (jNear(rate, old, 0.10) || (pk > 1 && jNear(rate, old * pk, 0.10)));
  if (q > 0 && clean && rateOk && Math.abs(q - Math.round(q)) < 0.02) {
    const g = Math.round(q), inCtn = pk > 1 && jNear(rate, old * pk, 0.10);
    r.aiFix = { ...r.ai, ctn: inCtn ? g : 0, pcs: 0, qty: g };
    r.fixNote = `Bill ke hisaab se theek kiya: ginti ${num(g)} (AI ne ${num(n)} parhi) · ${num(g)} × ${num(rate)} = ${num(total)}`;
    return;
  }
  if (q > 0 && clean) r.fixQ = r3(q);                             // button: bill se ginti
  if (n > 0) r.fixR = r4(total / n);                              // button: bill se rate
}
function jCandidates(ln, ai, cs0) {
  const pk = packOf(ln), { c, p, n, rate } = aiNum(ai);
  const band = Number(cs0) === -1 || (!(Number(cs0) > 1) && Number(memOf(ln.id)?.s) === 1);   // carton band
  const size = band ? 0 : (Number(cs0) > 1 ? Number(cs0) : (Number(ai.size) || Number(memOf(ln.id)?.s) || 0));
  const out = [{ mode: 'pcs', ctn: 0, pcs: n, costP: rate }];
  if (pk > 1) {
    if (c > 0 && p > 0 && c !== p) out.push({ mode: 'both', ctn: c, pcs: p, costP: rate / pk });   // "5+3" = 5 ctn 3 pcs
    const whole = Math.floor(n + 1e-9);
    out.push({ mode: 'ctn', ctn: whole, pcs: r3((n - whole) * pk), costP: rate / pk });
  }
  if (size > 1 && !(pk > 1 && Math.abs(size - pk) < 0.01)) out.push({ mode: 'size', ctn: 0, pcs: r3(n * size), costP: rate / size, size });
  return out;
}
// naqsha ek "tarjeeh" hai, zabardasti nahi — pichhla khareed wazeh bata de to wahi jeetega
function jPrior(mode, fmt) {
  const q = fmt && fmt.q;
  if (!q || q === 'both') return 0;
  if (q === mode || (q === 'ctn' && (mode === 'size' || mode === 'both'))) return -0.3;
  return 0;
}
// v2.4.2: carton BAND kab — POS mein carton size khali ho aur: aap ne 1 likha / yaad hai / bill par سائز 1
function jBand(r, ln, A, old) {
  if (packOf(ln)) return false;
  if (Number(r.cs) === -1) return true;
  if (Number(r.cs) > 1) return false;
  const ms = Number(memOf(ln.id)?.s) || 0;
  if (ms === 1) return true; if (ms > 1) return false;
  if (Number(A.size) !== 1) return false;
  const rate = Number(A.rate) || 0;                        // bill ka rate pichhle khareed ke qareeb ho tab hi
  return !(old > 0 && rate > 0) || Math.abs(rate / old - 1) <= J_WARN;
}
// v2.4.2: من ریٹ (fi 40 kg) se rate ka saboot
function jMan(A) {
  const mr = Number(A.mr) || 0, rate = Number(A.rate) || 0, sz = Number(A.size) || 0;
  if (!(mr > 0) || !(rate > 0)) return null;
  const per = mr / 40;
  if (jNear(rate, per, 0.01)) return { k: 'unit', t: `✓ من ریٹ ${num(mr)} ÷ 40 = ${num(r2(per))} = rate (fi kg / piece)` };
  if (sz > 1 && jNear(rate, per * sz, 0.01)) return { k: 'ctn', t: `✓ من ریٹ ${num(mr)} ÷ 40 × ${num(sz)} = ${num(r2(per * sz))} = rate (fi carton)` };
  if (sz >= 100 && jNear(rate, per * sz / 1000, 0.01)) return { k: 'unit', t: `✓ من ریٹ ${num(mr)} ÷ 40 × ${num(sz)}g = rate` };
  return { k: 'no', t: `من ریٹ ${num(mr)} se rate ${num(rate)} nahi milta — ek nazar` };
}
function jJudge(r, fmt) {
  const ln = r.key ? cart.find(l => l.k === r.key) : null;
  if (!ln) { r.j = { conf: 'r', why: ['Item stock mein nahi mila'], mode: '' }; return; }
  jFix(r, ln);
  const A = aiOf(r);
  const old = Number(ln.oldCost) || 0;
  r.band = jBand(r, ln, A, old); ln.one = !!r.band;               // v2.4.2: carton = piece
  const cands = jCandidates(ln, A, r.band ? -1 : r.cs);
  let best = null, bestS = Infinity;
  for (const cd of cands) {
    const lr = logR(cd.costP, old);
    let s = (lr == null ? 0.5 : lr) + jPrior(cd.mode, fmt);
    if (r.force && cd.mode === r.force) s -= 100;           // aap ne khud unit chuna
    if (s < bestS - 1e-9) { bestS = s; best = cd; }
  }
  if (!best) best = cands[0];
  // purana andaza (naqsha / pichhla khareed dono na hon): pack wale item par ctn di ho to CTN
  if (!r.force && !(old > 0) && !(fmt && fmt.q)) {
    const { c } = aiNum(A);
    best = cands.find(x => x.mode === (packOf(ln) && c ? 'ctn' : 'pcs')) || best;
  }
  ln.ctn = best.ctn; ln.pcs = best.pcs;
  if (best.costP > 0) { ln.costP = r4(best.costP); recalc(ln); }
  const why = [], { n, rate, total } = aiNum(A);
  let conf = 'g';
  if (r.fixNote) { why.push(r.fixNote); }
  const ratio = old > 0 && ln.costP > 0 ? ln.costP / old : 0;
  if (ratio) {
    const d = Math.abs(ratio - 1);
    if (d > J_WARN) { conf = 'r'; why.push(`Khareed pichhle se ${ratio > 1 ? num(ratio) + ' guna zyada' : num(1 / ratio) + ' guna kam'} — unit / ginti check karein`); }
    else if (d > J_OK) { conf = 'y'; why.push(`Rate ${ratio > 1 ? '+' : '−'}${Math.round(d * 100)}% badla`); }
  } else { conf = 'y'; why.push('Pichhla khareed maloom nahi (pehli dafa)'); }
  if (total > 0 && n > 0 && rate > 0) {                       // hisaab ka pehra (tax / discount ki gunjaish 20%)
    const calc = n * rate;
    if (Math.abs(calc - total) / total > 0.20) { conf = 'r'; why.push(`Hisaab nahi milta: ${num(n)} × ${num(rate)} = ${num(calc)}, bill par ${num(total)}`); }
  }
  const man = jMan(A);
  if (man) { why.push(man.t); if (man.k === 'no' && conf === 'g') conf = 'y'; }
  const exact = total > 0 && jNear(lineTotal(ln), total);
  if (exact) why.push(`✓ Hisaab bill se mila: ${num(linePcs(ln))} × ${num(r2(ln.costP))} = ${num(total)}`);
  if (r.band) why.push('Carton = piece (carton band) — ek hi ginti');
  const stockPcs = Math.max(0, Number(stock().items.find(x => String(x.id) === String(ln.id))?.stock) || 0);
  const add = linePcs(ln), pk = packOf(ln), cap = Math.max(stockPcs * 10, pk > 1 ? pk * 40 : 400);
  if (add > cap) {
    if (r.band || (man && man.k !== 'no')) why.push(`Stock ${num(stockPcs)} → ${num(stockPcs + add)} ${esc(ln.uName || 'Pcs')} (bada maal — sirf note)`);   // unit ka shak nahi
    else { conf = 'r'; why.push(`Stock ka pehra: ${num(stockPcs)} se ${num(stockPcs + add)} ${esc(ln.uName || 'Pcs')} ho jayega`); }
  }
  if (!r.byAi && conf === 'g') { conf = 'y'; why.push('Item naam ke andaze se mila'); }
  if (r.fixNote && conf === 'g') conf = 'y';                       // app ne khud theek kiya — ek nazar dekh lein
  r.j = { conf, why, mode: best.mode, size: best.size || 0, old, ratio };
}
function jJudgeAll() { const fmt = billFmtOf(supplier); for (const r of aiRows || []) if (!r.skip) jJudge(r, fmt); }
// hari lines se naqsha KHUD pakro (aur yaad rakho) — sawal sirf tab jab pakra na ja sake
function jAutoFmt() {
  if (!aiRows || !supplier) return;
  const fmt = billFmtOf(supplier); if (fmt && fmt.q) return;
  const modes = new Set(aiRows.filter(r => !r.skip && r.j?.conf === 'g').map(r => r.j.mode === 'size' || r.j.mode === 'both' ? 'ctn' : r.j.mode));
  if (!modes.size) return;
  const q = modes.has('pcs') && modes.has('ctn') ? 'both' : [...modes][0];
  try { Promise.resolve(saveBillFmtOf(supplier, { ...(fmt || {}), q, t: Date.now() })).catch(() => {}); } catch {}
  aiFmtAuto = q;
}
let aiFmtAuto = '', jView = 'list', jIx = -1, jForceAsk = false;
const jMark = c => c === 'g' ? '🟢' : c === 'y' ? '🟡' : '🔴';
const jUnit = (ln) => ln ? (packOf(ln) && Number(ln.ctn) ? `${num(ln.ctn)} ${esc(ln.cName)}${Number(ln.pcs) ? ' + ' + num(ln.pcs) : ''}` : `${num(linePcs(ln))} ${esc(ln.uName)}`) : '';
const jModeName = m => ({ pcs: 'PCS', ctn: 'CTN', size: 'سائز', both: 'CTN + PCS' }[m] || m);
function jCounts() {
  const act = (aiRows || []).filter(r => !r.skip);
  return { all: act.length, g: act.filter(r => r.j?.conf === 'g').length, y: act.filter(r => r.j?.conf === 'y').length, r: act.filter(r => r.j?.conf === 'r').length,
    open: act.filter(r => !r.done).length, openNotG: act.filter(r => !r.done && r.j?.conf !== 'g').length };
}
function jQueue() { return (aiRows || []).map((r, i) => i).filter(i => !aiRows[i].skip && !aiRows[i].done); }
function jBillTotals() {
  const lines = (aiRows || []).filter(r => !r.skip && r.key).map(r => cart.find(l => l.k === r.key)).filter(Boolean);
  return { mine: r2(lines.reduce((n, l) => n + lineTotal(l), 0) + (Number(xtra) || 0)), bill: Number(aiBillInfo?.total) || 0 };   // v2.4.6: + kharcha
}
// v2.4.1: bill ke neeche likhe ginti ke total vs AI ki lines — koi line chhooti / ghalat parhi to pata chale
function jColTotals() {
  const b = aiBillInfo || {}, ct = Number(b.ctnTotal) || 0, pt = Number(b.pcsTotal) || 0;
  if (!ct && !pt) return '';
  const L = b.lines || [], tol = T => Math.max(1, T * 0.005);
  let ok, txt;
  if (ct && pt) {
    const sc = r3(L.reduce((n, l) => n + (Number(l.ctn) || 0), 0)), sp = r3(L.reduce((n, l) => n + (Number(l.pcs) || 0), 0));
    ok = Math.abs(sc - ct) <= tol(ct) && Math.abs(sp - pt) <= tol(pt);
    txt = `Bill par ginti: CTN ${num(ct)} · PCS ${num(pt)} — lines mein ${num(sc)} · ${num(sp)}`;
  } else {
    const T = ct || pt, sn = r3(L.reduce((n, l) => n + aiNum(l).n, 0));
    ok = Math.abs(sn - T) <= tol(T);
    txt = `Bill par ginti ka total ${num(T)} — lines mein ${num(sn)}`;
  }
  return `<p class="${ok ? 'stat-note' : 'red'}">${ok ? '✓' : '⚠️'} ${txt}${ok ? '' : ' — koi line chhooti ya ghalat parhi?'}</p>`;
}
// ---------- overview (pehli khirki) ----------
function aiRender() {
  if (!aiRows) return;
  if (jView === 'card' && jIx >= 0) return jCard(jIx);
  if (jView === 'sum') return jSummary();
  const k = jCounts(), fmt = billFmtOf(supplier), { mine, bill } = jBillTotals();
  const { items } = stock();
  const sup = aiBillInfo?.supplier && !supplier && rankOf ? (rankOf(partiesOf(), aiBillInfo.supplier, 1)[0] || null) : null;
  const stat = fmt && Number(fmt.b) ? ` · pichhle ${num(fmt.b)} bill · ${Math.round(Number(fmt.g) || 0)}% hari` : '';
  const fmtLine = aiFmtAuto && !jForceAsk
    ? `<p class="stat-note">📐 Naqsha <b>khud pakra</b>: ginti = <b>${jModeName(aiFmtAuto)}</b>${stat} <button type="button" data-pp-fmt="ask">badlein</button></p>`
    : fmt && fmt.q && !jForceAsk
      ? `<p class="stat-note">📐 Naqsha: ginti = <b>${jModeName(fmt.q)}</b>${stat} <button type="button" data-pp-fmt="ask">badlein</button></p>`
      : `<div class="pp-ask"><b>Is supplier ke bill par ginti kya hoti hai?</b><small>Pichhla khareed maloom na hone ki wajah se app khud nahi pakar saki${aiBillInfo?.qtyLabel ? ' (bill par column: ' + esc(aiBillInfo.qtyLabel) + ')' : ''}. Ek dafa bata dein.</small>
         <div class="mchips"><button type="button" data-pp-fmt="pcs">PCS (pieces)</button><button type="button" data-pp-fmt="ctn">CTN (carton / peti)</button><button type="button" data-pp-fmt="both">Dono (alag khane)</button></div></div>`;
  dlg('🤖 Bill ki jaanch', `<div class="jz-head">
      <div class="jz-count"><b>${k.all}</b> lines · 🟢 ${k.g} · 🟡 ${k.y} · 🔴 ${k.r}</div>
      ${bill ? `<div class="jz-tot">Bill ${num(bill)} · lines ${num(mine)} · <b class="${Math.abs(bill - mine) > Math.max(10, bill * 0.02) ? 'red' : ''}">farq ${num(r2(bill - mine))}</b></div>` : ''}
    </div>
    ${jColTotals()}
    ${fmtLine}
    ${sup ? `<p><button type="button" data-pp-sup="${esc(sup.id)}">👤 Supplier lagayein: ${esc(sup.name)}</button> <small>(tasveer par: ${esc(aiBillInfo.supplier)})</small></p>` : aiBillInfo?.supplier && !supplier ? `<p class="stat-note">Tasveer par supplier: <b>${esc(aiBillInfo.supplier)}</b> — upar se khud chunein.</p>` : ''}
    <div class="jz-acts">
      ${k.g && aiRows.some(r => !r.skip && !r.done && r.j?.conf === 'g') ? `<button type="button" class="got" data-pp-jgreen="1">✓ ${aiRows.filter(r => !r.skip && !r.done && r.j?.conf === 'g').length} hari pakki karein</button>` : ''}
      ${k.openNotG || k.open ? `<button type="button" class="got" data-pp-jstart="1">Jaanch shuru (${k.openNotG || k.open}) ›</button>` : `<button type="button" class="got" data-pp-jsum="1">Khulasa ›</button>`}
    </div>
    <div class="jz-list">${aiRows.map((r, i) => {
      const ln = r.key ? cart.find(l => l.k === r.key) : null;
      const it = r.itemId ? items.find(x => String(x.id) === String(r.itemId)) : null;
      return `<button type="button" class="jz-row ${r.skip ? 'skip' : r.j?.conf || 'r'}${r.done ? ' done' : ''}" data-pp-jcard="${i}">
        <span class="jz-dot">${r.skip ? '✕' : r.done ? '✓' : jMark(r.j?.conf)}</span>
        <span class="jz-txt"><b>${esc(r.ai.name || '')}</b><small>${it ? esc(it.name) + ' · ' + jUnit(ln) + ' · ' + num(ln?.costP || 0) + '/' + esc(ln?.uName || 'Pcs') : 'item nahi mila'}${r.j?.why?.length ? ' · ' + esc(r.j.why[0]) : ''}</small></span></button>`;
    }).join('')}</div>
    <p class="stat-note">⚠️ AI hamesha theek nahi parhta. Hari lines par bhi nazar daal lein; ✓ dabane se naam, unit aur rate app yaad kar leti hai.</p>`);
  const d = $('dialog'); if (d) d.classList.add('full-dialog');
}
// ---------- v2.4.1: ek screen ka card — bill ki patti, do qataarein (CTN·PCS·Khareed / W·R), "1 CTN =", swipe ----------
function jPageIx(r) { return Math.max(0, Math.min(billPics.length - 1, (Number(r?.ai?.page) || 1) - 1)); }
function jY(r) {                       // line ki jagah (0..1000): AI ne di ho to wahi, warna padosi lines se andaza
  const y = Number(r?.ai?.y) || 0; if (y > 0) return y;
  const pg = Number(r?.ai?.page) || 1;
  const same = (aiRows || []).filter(x => (Number(x.ai.page) || 1) === pg);
  const i = same.indexOf(r), n = same.length;
  const known = same.map((x, k) => [k, Number(x.ai.y) || 0]).filter(v => v[1] > 0);
  if (known.length >= 2) {
    const [k1, y1] = known[0], [k2, y2] = known[known.length - 1];
    return Math.max(0, Math.min(1000, y1 + (i - k1) * (y2 - y1) / Math.max(1, k2 - k1)));
  }
  return n > 1 ? 280 + i * 570 / (n - 1) : 450;
}
function jCs(r, ln) {                 // carton size: POS ka pack, warna aap ka likha / yaad kiya / bill ka سائز
  const pk = ln ? packOf(ln) : 0; if (pk) return pk;
  if (Number(r?.cs) === -1 || r?.band) return 0;                        // carton band
  if (Number(r?.cs) > 1) return Number(r.cs);
  const ms = Number(memOf(ln?.id)?.s) || 0; if (ms === 1) return 0; if (ms > 1) return ms;
  return r?.j?.mode === 'size' && Number(r?.ai?.size) > 1 ? Number(r.ai.size) : 0;   // bill ka سائز sirf jab wahi tareeqa laga
}
function jPattiPaint(r) {
  const box = $('jcPatti'); if (!box || !billPics.length) return;
  if (typeof Image === 'undefined') return;
  const src = billPics[jPageIx(r)], img = new Image();
  img.onload = () => {
    const W = box.clientWidth || 340, H = box.clientHeight || 120;
    const ih = W * img.naturalHeight / Math.max(1, img.naturalWidth);
    const yy = jY(r) / 1000 * ih, top = Math.max(0, Math.min(Math.max(0, ih - H), yy - H * 0.45));
    box.style.backgroundImage = `url("${src}")`;
    box.style.backgroundSize = `${W}px ${ih}px`;
    box.style.backgroundPosition = `0 ${-top}px`;
    const m = box.querySelector('.jc-mark'); if (m) m.style.top = Math.max(0, yy - top - 15) + 'px';
  };
  img.src = src;
}
const jF = v => (v || v === 0) && Number(v) ? r2(Number(v)) : '';
function jCard(i) {
  const r = aiRows[i]; if (!r) { jView = 'list'; return aiRender(); }
  jView = 'card'; jIx = i;
  const q = jQueue(), pos = q.indexOf(i), ln = r.key ? cart.find(l => l.k === r.key) : null;
  const { total } = aiNum(r.ai), pk = ln ? packOf(ln) : 0, cs = ln ? jCs(r, ln) : 0, m = pk || cs;
  const it = ln ? stock().items.find(x => String(x.id) === String(ln.id)) : null;
  const size = Number(r.cs) > 1 ? Number(r.cs) : r.band ? 0 : (Number(r.ai.size) || Number(memOf(r.itemId)?.s) || 0);
  const modes = ln ? jCandidates(ln, aiOf(r), r.band ? -1 : r.cs).map(c => c.mode) : [];
  const diff = ln && r.j?.old ? r2(ln.costP - r.j.old) : 0;
  const o = ln || {}, oW = Number(o.oldW) || 0, oR = pk ? (Number(o.oldR2) || Number(o.oldR) || 0) : (Number(o.oldR) || 0), oC = Number(o.oldCost) || 0;
  const ph = v => `<small class="jc-ph">${v ? 'pehle ' + num(r2(v)) : '&nbsp;'}</small>`;
  const fld = (lab, key, val, pehle, off) => `<label class="jc-f"><span>${lab}</span><input type="number" min="0" step="any" inputmode="decimal" data-pp-${key}="1" value="${val}"${off ? ' disabled placeholder="—"' : ''}>${ph(pehle)}</label>`;
  const patti = billPics.length ? `<div class="jc-patti" id="jcPatti" data-pp-pic="${jPageIx(r)}" data-pp-focus="${Math.round(jY(r))}" role="button" aria-label="Poori tasveer"><span class="jc-mark"></span><span class="jc-patti-z">⤢</span></div>` : '';
  const ctnVal = pk ? (ln.ctn || '') : cs ? jF(linePcs(ln) / cs) : '';
  dlg(`🤖 Jaanch ${pos >= 0 ? (pos + 1) + '/' + q.length : ''}`, `${patti}
    <div class="jc-card ${r.j?.conf || 'r'}" id="jcCard">
      <div class="jc-top"><b>${esc(r.ai.name || '')}${ln ? ' → ' + esc(ln.name) : ''}</b><span id="jcAmt">${ln ? num(lineTotal(ln)) : ''}</span></div>
      ${ln && total ? `<div class="jc-milan" id="jcMilan">${jMilanHTML(ln, total)}</div>` : ''}
      <div class="jc-bill">Bill: ${esc(aiQtyText(r.ai))}${size ? ' · سائز ' + num(size) : ''} · ریٹ ${num(aiNum(r.ai).rate)}${total ? ' · کل ' + num(total) : ''}</div>
      ${r.j?.why?.length ? `<div class="jc-why">${r.j.why.map(w => `<small>${jMark(r.j.conf)} ${esc(w)}</small>`).join('')}</div>` : '<div class="jc-why"><small>🟢 Sab theek lag raha hai</small></div>'}
      ${ln ? `<div class="jc-units"><div class="mchips jc-modes">${modes.map(md => `<button type="button" class="${r.j?.mode === md ? 'on' : ''}" data-pp-jmode="${md}">${jModeName(md)}${md === 'size' ? ' ×' + num(size) : ''}</button>`).join('')}</div>
        ${!pk ? `<label class="jc-cs"><span>1 CTN =</span><input type="number" min="0" step="any" inputmode="decimal" data-pp-jcs="1" value="${r.band ? '1' : (cs || '')}" placeholder="?"></label>` : ''}</div>
      ${(r.fixQ || r.fixR) && r.j?.conf === 'r' ? `<div class="jc-fix">${r.fixQ ? `<button type="button" data-pp-jfixq="1">Bill se ginti lagao: ${num(r.fixQ)}</button>` : ''}${r.fixR ? `<button type="button" data-pp-jfixr="1">Bill se rate lagao: ${num(r2(r.fixR))}</button>` : ''}</div>` : ''}
      <div class="jc-g4">
        ${fld(esc(ln.cName || 'CTN') + (m ? ' (' + num(m) + ')' : ''), 'jctn', ctnVal, 0, !m)}
        ${fld(esc(ln.uName || 'PCS'), 'jpcs', pk ? (ln.pcs || '') : (ln.pcs || ''), 0)}
        ${m ? fld('Kh/' + esc(ln.cName || 'CTN'), 'jkc', jF(ln.costP * m), oC * m)
            : `<label class="jc-f jc-kul"><span>Kul raqam</span><input type="number" min="0" step="any" inputmode="decimal" data-pp-jtot="1" value="${ln.kul > 0 ? jF(ln.kul) : ''}" placeholder="${total ? num(total) : 'bill ki raqam'}"><small class="jc-ph">${total ? 'bill ' + num(total) : '&nbsp;'}</small></label>`}
        ${fld('Kh/' + esc(ln.uName || 'PCS'), 'jcost', jF(ln.costP), oC)}
      </div>
      <div class="jc-sub">Naye rates · pichhle nafa se${r.j?.old ? ` · khareed pichhli ${num(r.j.old)} <b class="${diff > 0 ? 'red' : 'green'}">${diff > 0 ? '+' : ''}${num(diff)}</b>` : ''}${Number(ln.xs) > 0 ? ` · kharcha +${num(r2(ln.xs))} (POS khareed ${num(r2(effCost(ln)))})` : ''}</div>
      <div class="jc-g4">
        ${fld('W/' + esc(ln.cName || 'CTN'), 'jwc', pk ? jF(ln.wctn) : cs ? jF(ln.wpcs * cs) : jF(ln.wctn), pk ? oW * pk : cs ? oW * cs : (ln.one ? oW : 0))}
        ${fld('W/' + esc(ln.uName || 'PCS'), 'jw', jF(ln.wpcs), oW)}
        ${fld('R/' + esc(ln.cName || 'CTN'), 'jrc', pk ? jF(ln.rctn) : cs ? jF(ln.rpcs * cs) : jF(ln.rctn), pk ? (Number(o.oldR) || 0) * pk : cs ? oR * cs : (ln.one ? oR : 0))}
        ${fld('R/' + esc(ln.uName || 'PCS'), 'jr', jF(ln.rpcs), oR)}
      </div>
      <small class="stat-note">Stock abhi ${num(Number(it?.stock) || 0)} ${esc(ln.uName)}${!pk && cs ? ' · POS mein carton size khali — CTN sirf app mein' : ''}</small>` :
      `<div class="jc-why"><small>🔴 Humare stock mein ye item nahi mila</small></div>`}
    </div>
    <div class="jc-acts jc-sticky">
      <div class="jc-okrow"><button type="button" class="jc-prev" data-pp-jprev="1"${jHasPrev() ? '' : ' disabled'}>‹ Pichhla</button>${ln ? '<button type="button" class="got jc-ok" data-pp-jok="1">✓ Theek — agla ›</button>' : ''}</div>
      <button type="button" data-pp-pick="${i}">✏️ ${ln ? 'Item' : 'Item chunein'}</button>
      <button type="button" class="danger" data-pp-jskip="1">✕ Chhor</button>
      <button type="button" data-pp-jlist="1">‹ List</button>
    </div>
    <small class="stat-note jc-hint">Ungli daayein khainchein = ✓ agla · baayein = pichhla</small>`);
  const d = $('dialog'); if (d) d.classList.add('full-dialog');
  jPattiPaint(r);
}
function jRepaint() {                 // card ke khane dobara bharo (jo khana likha ja raha ho use chhor kar)
  const r = aiRows && aiRows[jIx]; const l = r && r.key ? cart.find(x => x.k === r.key) : null; if (!l) return;
  const pk = packOf(l), cs = jCs(r, l), m = pk || cs, act = document.activeElement;
  const set = (k, v) => { const e = document.querySelector(`[data-pp-${k}]`); if (e && e !== act && !e.disabled) e.value = v; };
  set('jctn', pk ? (l.ctn || '') : cs ? jF(linePcs(l) / cs) : '');
  set('jpcs', l.pcs || '');
  set('jkc', m ? jF(l.costP * m) : ''); set('jcost', jF(l.costP));
  set('jtot', l.kul > 0 ? jF(l.kul) : '');
  set('jwc', pk ? jF(l.wctn) : cs ? jF(l.wpcs * cs) : jF(l.wctn)); set('jw', jF(l.wpcs));
  set('jrc', pk ? jF(l.rctn) : cs ? jF(l.rpcs * cs) : jF(l.rctn)); set('jr', jF(l.rpcs));
  const a = $('jcAmt'); if (a) a.textContent = num(lineTotal(l));
  const mm = $('jcMilan'), tt = aiNum(r.ai).total; if (mm && tt) mm.innerHTML = jMilanHTML(l, tt);
}
// v2.4.2: zinda milan — aap ki line vs bill ki kul raqam
function jMilanHTML(l, total) {
  const mine = lineTotal(l), d = total > 0 ? Math.abs(mine - total) / total : 1;
  const cls = d <= 0.005 ? 'ok' : d <= 0.20 ? 'near' : 'bad';
  const mark = cls === 'ok' ? '✓' : cls === 'near' ? '≈ (tax / discount?)' : '✗';
  return `<span class="${cls}">Aap ${num(mine)} · bill ${num(total)} ${mark}</span>`;
}
function jHasPrev() { return (aiRows || []).some((r, i) => i < jIx && !r.skip); }   // v2.4.2: "‹ Pichhla" button
function jPrev() {
  const act = (aiRows || []).map((r, i) => i).filter(i => !aiRows[i].skip);
  const before = act.filter(x => x < jIx);
  if (before.length) jCard(before[before.length - 1]);
}
// ---------- v2.4.1: poori tasveer — do ungliyon se zoom, khainchna, do dafa tap, "‹ Wapas Jaanch" ----------
let zS = 1, zX = 0, zY = 0, zFocus = 0;
function zApply() { const im = $('ppZoomImg'); if (im) im.style.transform = `translate(${zX}px, ${zY}px) scale(${zS})`; }
function zClamp() {
  const box = $('ppZoom'), im = $('ppZoomImg'); if (!box || !im) return;
  const W = box.clientWidth, H = box.clientHeight, iw = W * zS, ih = (im.naturalHeight / Math.max(1, im.naturalWidth)) * W * zS;
  zX = Math.min(0, Math.max(W - iw, zX)); zY = ih > H ? Math.min(0, Math.max(H - ih, zY)) : 0;
}
function zAt(ns, cx, cy) { ns = Math.max(1, Math.min(5, ns)); zX = cx - (cx - zX) * ns / zS; zY = cy - (cy - zY) * ns / zS; zS = ns; zClamp(); zApply(); }
function zStep(dir) { const box = $('ppZoom'); if (!box) return; zAt(zS + dir * 0.5, box.clientWidth / 2, box.clientHeight / 2); }
function zWire() {
  const box = $('ppZoom'), im = $('ppZoomImg'); if (!box || !im) return;
  const pts = new Map(); let start = null, lastTap = 0;
  const go = () => {
    zS = 1; zX = 0; zY = 0;
    if (zFocus > 0) {            // patti se aaye: seedha usi line par 2.2x
      const W = box.clientWidth, H = box.clientHeight, ih = (im.naturalHeight / Math.max(1, im.naturalWidth)) * W;
      zAt(2.2, 0, 0); zY = -(zFocus / 1000 * ih * zS - H / 2); zX = 0; zClamp(); zApply();
    } else zApply();
  };
  if (im.complete && im.naturalWidth) go(); else im.onload = go;
  box.addEventListener('pointerdown', e => {
    box.setPointerCapture?.(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const now = Date.now();
    if (pts.size === 1 && now - lastTap < 300) { const b = box.getBoundingClientRect(); zAt(zS > 1.2 ? 1 : 2.5, e.clientX - b.left, e.clientY - b.top); lastTap = 0; }
    else lastTap = now;
    start = null;
  });
  box.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    const prev = pts.get(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const b = box.getBoundingClientRect();
    if (pts.size === 1) { zX += e.clientX - prev.x; zY += e.clientY - prev.y; zClamp(); zApply(); return; }
    const [a, c] = [...pts.values()], dist = Math.hypot(a.x - c.x, a.y - c.y), mx = (a.x + c.x) / 2 - b.left, my = (a.y + c.y) / 2 - b.top;
    if (!start) { start = { dist, s: zS }; return; }
    zAt(start.s * dist / Math.max(1, start.dist), mx, my);
  });
  const up = e => { pts.delete(e.pointerId); if (pts.size < 2) start = null; };
  box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
}

function jNext() {
  const q = jQueue().filter(x => aiRows[x].j?.conf !== 'g' || !aiRows.some(r => !r.skip && !r.done && r.j?.conf !== 'g'));
  const after = q.find(x => x > jIx);
  const nx = after != null ? after : q[0];
  if (nx == null) { jView = 'sum'; jIx = -1; return jSummary(); }
  jCard(nx);
}
async function jAccept(i, quiet = true) {
  const r = aiRows[i]; if (!r || !r.key) return;
  r.done = true;
  if (r.itemId && learnOf && !r.learn) {           // ✓ = naam bhi yaad
    try { const res = await learnOf(r.itemId, aiNameOf(r.ai) || r.ai.name); r.learn = res === 'ok' ? 'ok' : res === 'pehle se' ? 'pehle se' : res; } catch {}
  }
  if (!quiet) notice('✓ ' + (r.ai.name || ''));
}
function jSkip(i) {
  const r = aiRows[i]; if (!r) return;
  if (r.key) { const ix = cart.findIndex(l => l.k === r.key); if (ix >= 0) { r.saved = cart[ix]; cart.splice(ix, 1); } }
  r.skip = true; r.done = false; keepDraft(); rerender();
}
function jUnskip(i) {
  const r = aiRows[i]; if (!r) return;
  if (r.saved) { cart.push(r.saved); r.key = r.saved.k; r.saved = null; }
  r.skip = false; jJudge(r, billFmtOf(supplier)); keepDraft(); rerender();
}
// ek hi item bill par do dafa — mila do (ginti jama, khareed wazni ausat)
function jDupes() {
  const seen = new Map(), out = [];
  (aiRows || []).forEach((r, i) => { if (r.skip || !r.itemId) return; if (seen.has(r.itemId)) out.push([seen.get(r.itemId), i]); else seen.set(r.itemId, i); });
  return out;
}
function jMerge(a, b) {
  const A = aiRows[a], B = aiRows[b]; if (!A || !B) return;
  const la = cart.find(l => l.k === A.key), lb = cart.find(l => l.k === B.key); if (!la || !lb) return;
  const qa = linePcs(la), qb = linePcs(lb), q = qa + qb, pk = packOf(la);
  const cost = q > 0 ? r4((qa * la.costP + qb * lb.costP) / q) : la.costP;
  la.ctn = pk ? Math.floor(q / pk + 1e-9) : 0; la.pcs = pk ? r3(q - la.ctn * pk) : r3(q); la.costP = cost; recalc(la);
  jSkip(b); B.merged = a;
  keepDraft(); rerender();
}
// ---------- aakhri khulasa ----------
function jSummary() {
  jView = 'sum'; jIx = -1;
  const k = jCounts(), { mine, bill } = jBillTotals();
  const up = [], down = [];
  for (const r of aiRows || []) {
    if (r.skip || !r.key) continue;
    const ln = cart.find(l => l.k === r.key); if (!ln || !(r.j?.old > 0)) continue;
    const d = r2(ln.costP - r.j.old);
    if (Math.abs(d) < 0.005) continue;
    (d > 0 ? up : down).push(`${esc(ln.name)} ${d > 0 ? '+' : ''}${num(d)}/${esc(ln.uName)}`);
  }
  const redLeft = (aiRows || []).filter(r => !r.skip && !r.done && r.j?.conf === 'r').length;
  const dup = jDupes(), skipped = (aiRows || []).map((r, i) => [r, i]).filter(([r]) => r.skip && !r.merged);
  const farq = r2(bill - mine);
  dlg('🤖 Khulasa', `<div class="jz-head"><div class="jz-count">🟢 ${k.g} · 🟡 ${k.y} · 🔴 ${k.r} · pakki ${aiRows.filter(r => r.done).length}/${k.all}</div></div>
    ${bill ? `<div class="jc-card ${Math.abs(farq) > Math.max(10, bill * 0.02) ? 'y' : 'g'}"><div class="jc-sec"><small>Bill ka total</small><b>${num(bill)}</b><span>Aap ki lines ${num(mine)} · farq <b>${num(farq)}</b>${Math.abs(farq) > 1 ? (farq > 0 ? ' — shayad tax / T.O. / mazdoori, ya koi line reh gayi' : ' — koi line zyada ya ginti ghalat') : ''}</span></div></div>` : ''}
    ${jColTotals()}
    <div class="jc-card ${xtra > 0 ? 'g' : ''}"><div class="jc-sec"><small>🧾 Bill par kharcha${xtraName ? ' — ' + esc(xtraName) : ' (labour / kiraya)'}</small>
      <label class="jc-xtra">Rs <input type="number" min="0" step="any" inputmode="decimal" data-pp-jxtra="1" value="${xtra || ''}" placeholder="0"></label>
      <label class="jc-xtra">+ % <input type="number" min="0" step="any" inputmode="decimal" data-pp-jpct="1" value="${pct || ''}" placeholder="0"></label>
      <span id="jXtraNote">${xtra > 0 ? `Har item ki khareed mein raqam ke hisaab se (+${num(Math.round(xtraPct() * 100) / 100)}%)` : 'Na ho to khali chhor dein'}</span></div></div>
    ${up.length ? `<div class="jc-card y"><div class="jc-sec"><small>📈 ${up.length} items mehnge</small><span>${up.join(' · ')}</span></div></div>` : ''}
    ${down.length ? `<div class="jc-card g"><div class="jc-sec"><small>📉 ${down.length} items saste</small><span>${down.join(' · ')}</span></div></div>` : ''}
    ${dup.map(([a, b]) => `<div class="jc-card y"><div class="jc-sec"><small>Ek item do dafa</small><span>${esc(aiRows[a].ai.name || '')} + ${esc(aiRows[b].ai.name || '')}</span></div><div class="jc-acts"><button type="button" data-pp-jmerge="${a}|${b}">Mila do</button></div></div>`).join('')}
    ${skipped.length ? `<div class="jc-card"><div class="jc-sec"><small>Chhori hui lines</small>${skipped.map(([r, i]) => `<span>${esc(r.ai.name || '')} <button type="button" data-pp-junskip="${i}">↺ wapas</button></span>`).join('')}</div></div>` : ''}
    ${redLeft ? `<p class="red"><b>${redLeft} laal line abhi pakki nahi</b> — bhejne se pehle dekh lein.</p>` : ''}
    <div class="jc-acts"><button type="button" class="got" data-pp-jsend="1">💾 POS mein bhejo · Rs ${num(cartTotal())}</button><button type="button" data-pp-jlist="1">‹ Lines</button><button type="button" data-pp-jclose="1">Screen par dekhein</button></div>`);
  const d = $('dialog'); if (d) d.classList.add('full-dialog');
}
// ---------- sikhna: har bill ke baad naqsha, misalein, hari ka %, carton size ----------
function learnFromBill() {
  if (!aiRows || !supplier || !saveBillFmtOf) return;
  const act = aiRows.filter(r => !r.skip && r.key && cart.some(l => l.k === r.key));
  if (!act.length) return;
  const old = billFmtOf(supplier) || {};
  const modes = new Set(act.map(r => r.j?.mode === 'size' || r.j?.mode === 'both' ? 'ctn' : r.j?.mode).filter(Boolean));
  const q = modes.has('pcs') && modes.has('ctn') ? 'both' : [...modes][0] || old.q || '';
  const g = Math.round(act.filter(r => r.j?.conf === 'g').length * 100 / act.length);
  const b = (Number(old.b) || 0) + 1, avg = Math.round(((Number(old.g) || 0) * (b - 1) + g) / b);
  const ex = act.slice(0, 12).map(r => {
    const ln = cart.find(l => l.k === r.key);
    return `${String(r.ai.name || '').slice(0, 40)} => ${String(ln?.name || '').slice(0, 40)} | ${jModeName(r.j?.mode || '')}${r.j?.size ? ' x' + r.j.size : ''}`;
  });
  const rr = q === 'pcs' ? 'pcs' : q === 'ctn' ? 'ctn' : '';
  try { Promise.resolve(saveBillFmtOf(supplier, { q, r: rr, n: (Number(old.n) || 0) + 1, t: Date.now(), g: avg, b, ex })).catch(() => {}); } catch {}
}
function sizeMemFromBill() {           // bill ka سائز item ke sath yaad (carton size)
  const m = {};
  for (const r of aiRows || []) {
    const sz = Number(r.cs) > 1 ? Number(r.cs) : (Number(r.cs) === -1 || r.band) ? 1 : Number(r.j?.size) > 1 ? Number(r.j.size) : 0;
    if (r.skip || !r.key || !sz) continue;
    const ln = cart.find(l => l.k === r.key); if (ln && !packOf(ln)) m[String(ln.id)] = sz;
  }
  return m;
}

// v2.4.5: 🤖 Bill ki tasveer se items — pehle raasta chunein: 📷 camera (page ba page) ya 🖼️ gallery
let camPages = [], camUrls = [];
function aiItems() {
  if (aiBusy) { notice('AI abhi bill parh raha hai…'); return; }
  if (!aiBillOf) { notice('Is login par AI nahi chalta'); return; }
  camClear();
  dlg('🤖 Bill ki tasveer se items', `<div class="pp-aichoose">
      <button type="button" class="got" data-pp-aicam="1">📷 Camera se photo lo</button>
      <button type="button" data-pp-aigal="1">🖼️ Gallery se chunein</button>
    </div><p class="stat-note">Lamba bill ho to camera se ek ek page lein (4 tak) — sab ek saath parhe jayenge.</p>`);
}
function aiPick(cam) {                    // cam: seedha peeche wala camera (capture) — warna gallery (kai tasveerein)
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*'; inp.style.display = 'none';
  if (cam) inp.setAttribute('capture', 'environment'); else inp.multiple = true;
  document.body.appendChild(inp);
  inp.onchange = async () => {
    const files = [...(inp.files || [])].slice(0, 4); inp.remove();
    if (!files.length) return;
    if (cam) { camPages.push(files[0]); camPages = camPages.slice(0, 4); camShow(); return; }
    await aiRead(files);
  };
  inp.click();
}
function camClear() { for (const u of camUrls) { try { URL.revokeObjectURL(u); } catch {} } camUrls = []; camPages = []; }
function camShow() {                      // li hui photos ki jhalak + agla page / dobara / parho
  for (const u of camUrls) { try { URL.revokeObjectURL(u); } catch {} }
  camUrls = camPages.map(f => { try { return URL.createObjectURL(f); } catch { return ''; } });
  const n = camPages.length;
  dlg(`📷 Bill ke page (${n})`, `<div class="pp-camthumbs">${camUrls.map((u, i) => `<div class="pp-camthumb">${u ? `<img src="${u}" alt="page ${i + 1}">` : ''}<small>Page ${i + 1}</small></div>`).join('')}</div>
    <p class="stat-note">Photo saaf aur seedhi ho — sab likha nazar aaye. Dhundli ho to "Dobara lo".</p>
    <div class="pp-camacts">
      <button type="button" class="got" data-pp-camgo="1">✓ Bas, parho (${n} page)</button>
      ${n < 4 ? '<button type="button" data-pp-camnext="1">📷 Agla page</button>' : ''}
      <button type="button" data-pp-camredo="1">🔁 Aakhri dobara lo</button>
      <button type="button" class="danger" data-pp-camx="1">✕ Chhor dein</button>
    </div>`);
}
async function aiRead(files) {
  setBillPics(files);   // v2.2.0: wohi tasveerein screen par bhi
  aiBusy = true; aiRows = null; aiBillInfo = null; aiFmtAuto = ''; jView = 'list'; jIx = -1; jForceAsk = false;
  dlg('🤖 Bill ki tasveer se items', '<p id="ppAiMsg" role="status">Tayyari…</p><div id="ppAiOut"></div>');
  const say = x => { const m = $('ppAiMsg'); if (m) m.textContent = x; };
  try {
    const bill = await aiBillOf({ files, onStatus: say, partyId: supplier });
    const lines = (bill && bill.lines) || [];
    if (!lines.length) throw Error('Tasveer se koi item nahi parha gaya. Saaf photo (seedhi, poori bill) lagayein.');
    const { items } = stock();
    const fmt = billFmtOf(supplier);   // v2.3.0: is supplier ke bill ka naqsha
    aiBillInfo = bill; aiRows = [];
    const bx = (bill.xtra || []).reduce((n, x) => n + (Number(x.amount) || 0), 0);   // v2.4.6: labour / kiraya
    if (bx > 0 && !(xtra > 0)) { xtra = bx; xtraName = (bill.xtra || []).map(x => x.name).filter(Boolean).join(' + ').slice(0, 40); }
    lines.sort((a, b) => ((Number(a.page) || 1) - (Number(b.page) || 1)) || ((Number(a.y) || 0) - (Number(b.y) || 0)));   // v2.10: bill ki tarteeb
    for (const l of lines) {
      const q = aiNameOf(l);
      // v2.0.0: AI ko humare items ki list di jati hai — wo khud itemId de de to wahi lagao, warna naam se dhoondo
      const byAi = l.itemId ? items.find(x => String(x.id) === String(l.itemId)) : null;
      const hit = byAi || (q ? (smartSearch(items, q, 1)[0] || null) : null);
      if (!hit) { aiRows.push({ ai: l, key: null, itemId: '', learn: '' }); continue; }
      const ln = addItem(hit, false).line;
      ln.billName = String(l.name || '').slice(0, 60);          // v2.10: bill wala naam line ke saath
      aiRows.push({ ai: l, key: ln.k, itemId: String(hit.id), learn: '', byAi: !!byAi });
    }
    jJudgeAll(); jAutoFmt();
    if (aiFmtAuto) jJudgeAll();          // naya naqsha mila — us ki tarjeeh ke sath dobara
    keepDraft(); rerender(); aiRender();
    // v2.1.0: jo item AI ne KHUD humari list se chuna, us ka bill wala naam bina dabaye yaad kar lo
    for (let i = 0; i < aiRows.length; i++) if (aiRows[i].byAi) await aiLearn(i, null, true);
  } catch (err) {
    say('❌ ' + ((err && err.message) || 'Nakam'));
  } finally { aiBusy = false; }
}
// v2.4.1: bill poori screen par — do ungliyon se zoom, khainchna, do dafa tap; Jaanch se aaye to "‹ Wapas Jaanch"
function billView() {
  if (!billPics.length) return;
  const back = aiRows && (jView === 'card' || jView === 'list' || jView === 'sum');
  dlg('📄 Bill' + (billPics.length > 1 ? ` (${billIx + 1}/${billPics.length})` : ''),
    `<div class="pp-zoom" id="ppZoom"><img id="ppZoomImg" src="${billPics[billIx]}" alt="bill" draggable="false"></div>
     <div class="pp-billacts">${back ? '<button type="button" class="got" data-pp-vback="1">‹ Wapas Jaanch</button>' : ''}<button type="button" data-pp-vzoom="-1" aria-label="Chhota">−</button><button type="button" data-pp-vzoom="1" aria-label="Bara">+</button>${billPics.length > 1 ? '<button type="button" data-pp-vnext="1">Agli tasveer ›</button>' : ''}<button type="button" data-pp-pin="1">📌</button></div>
     <small class="stat-note">Do ungliyon se zoom · ek ungli se khainchein · do dafa tap = zoom</small>`);
  const d = $('dialog'); if (d) d.classList.add('full-dialog');
  zWire();
}
async function aiLearn(i, btn, quiet) {
  const r = aiRows && aiRows[i]; if (!r || !r.itemId || !learnOf) return;
  if (btn) btn.disabled = true;
  const res = await learnOf(r.itemId, aiNameOf(r.ai) || r.ai.name);
  r.learn = res === 'ok' ? 'ok' : res === 'pehle se' ? 'pehle se' : res;
  if (!quiet) { if (res === 'ok') notice('✓ "' + (aiNameOf(r.ai) || '') + '" yaad kar liya'); else if (res !== 'pehle se') notice(res); }
  aiRender();
}
function aiPickForm(i) {
  const r = aiRows && aiRows[i]; if (!r) return;
  dlg('✏️ Item chunein — ' + (r.ai.name || ''),
    `<label>Item dhoondein<input id="ppPickQ" type="search" autocomplete="off" value="${esc(aiNameOf(r.ai))}"></label>
     <div class="pp-sup-list" id="ppPickList"></div>
     <p class="stat-note">Jo item chunenge, bill ka naam "<b>${esc(r.ai.name || '')}</b>" usi ke "Doosre naam" mein yaad ho jayega.</p>
     <p><button type="button" data-pp-aiback="1">‹ Wapas list par</button></p>`);
  const paint = () => {
    const q = String($('ppPickQ')?.value || '').trim();
    const l = q ? smartSearch(stock().items, q, 20) : stock().items.slice(0, 20);
    $('ppPickList').innerHTML = l.map(x => `<button type="button" data-pp-picked="${i}|${esc(String(x.id))}">${esc(x.name)}${x.code ? ' <small>' + esc(x.code) + '</small>' : ''}</button>`).join('') || '<small>Koi item nahi mila</small>';
  };
  const q = $('ppPickQ'); if (q) q.oninput = paint;
  paint();
}
async function aiPicked(i, id) {
  const r = aiRows && aiRows[i]; if (!r) return;
  const it = stock().items.find(x => String(x.id) === String(id)); if (!it) return;
  if (r.key) { const ix = cart.findIndex(l => l.k === r.key); if (ix >= 0) cart.splice(ix, 1); }
  // v2.1.0: pehle jo item laga tha (AI ka ya yaad kiya hua) us se yeh naam hata do — warna ghalat naam wahin chipka rehta
  if (r.itemId && String(r.itemId) !== String(it.id) && unlearnOf && (r.byAi || r.learn === 'ok' || r.learn === 'pehle se')) {
    try { await unlearnOf(r.itemId, aiNameOf(r.ai) || r.ai.name); } catch {}
  }
  const ln = addItem(it, false).line;
  r.key = ln.k; r.itemId = String(it.id); r.learn = ''; r.byAi = true; r.force = ''; r.skip = false;   // aap ne khud chuna = pakka naam
  jJudge(r, billFmtOf(supplier));
  if (jView !== 'sum') { jView = 'card'; jIx = i; }
  keepDraft(); rerender(); aiRender();
  await aiLearn(i, null);
}

// isi supplier ka app se bana aakhri bill — items/tadad/khareed wapas (rates naye hisaab se)
async function copyLast(btn) {
  if (!cloud?.appPurchasesOf || !supplier) return;
  if (cart.length && !confirm('Maujooda items ke saath pichhle bill ke items bhi jor dein?')) return;
  btn.disabled = true;
  try {
    const list = (await cloud.appPurchasesOf(supplier)).filter(p => p.status !== 'failed').sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const last = list[0];
    if (!last) { notice('Is supplier ka app se koi pichhla bill nahi (pehla bill yahin se banayein)'); return; }
    const { items } = stock(); let n = 0;
    for (const x of last.lines || []) {
      const it = items.find(r => String(r.id) === String(x.id)); if (!it) continue;
      const r = addItem(it, false), l = r.line, pk = packOf(l), q = Number(x.qty) || 0;
      l.ctn = pk ? Math.floor(q / pk + 1e-9) : 0; l.pcs = pk ? r3(q - l.ctn * pk) : q;
      if (Number(x.costP) > 0) { l.costP = r4(x.costP); recalc(l); }
      l.godam = Number(x.godam) || l.godam; n++;
    }
    keepDraft(); rerender(); notice(`${n} items pichhle bill (${last.date}) se aa gaye — ginti/rate check karein`);
  } catch (err) { notice('Pichhla bill nahi mila: ' + (err?.message || err)); }
  finally { btn.disabled = false; }
}

async function save() {
  if (saving) return;
  if (!canUse()) { notice('Is login par POS purchase ki ijazat nahi'); return; }
  const p = partyOf(supplier);
  if (!p) { notice('Pehle supplier chunein'); supOpen = true; rerender(); return; }
  const lines = [], zero = [], noCost = [];
  xtraApply();
  for (const l of cart) {
    const qty = linePcs(l);
    if (!(qty > 0)) { zero.push(l.name); continue; }
    if (!(Number(l.costP) > 0)) noCost.push(l.name);
    lines.push({ id: String(l.id), code: String(l.code || ''), name: String(l.name || '').slice(0, 120), pack: Number(l.pack) || 0,
      cName: String(l.cName || 'Ctn'), uName: String(l.uName || 'Pcs'), godam: Number(l.godam) || Number(godam) || BILL_BRANCH,
      qty: r3(qty), costP: effCost(l), wctn: r2(l.wctn), wpcs: r2(l.wpcs), rctn: r2(l.rctn), rpcs: r2(l.rpcs) });
  }
  if (!lines.length) { notice('Kisi item ki ginti likhein'); return; }
  if (noCost.length) { alert('In items ka khareed rate khali hai:\n\n' + noCost.join('\n')); return; }
  if (zero.length && !confirm('Jin items ki ginti khali hai woh bill mein nahi jayenge:\n' + zero.join('\n') + '\n\nTheek hai?')) return;
  const low = cart.filter(l => linePcs(l) > 0 && ((Number(l.wpcs) > 0 && Number(l.wpcs) < effCost(l)) || (Number(l.rpcs) > 0 && Number(l.rpcs) < effCost(l)))).map(l => l.name);
  if (low.length && !confirm('Dhyan: in items ka naya sale rate KHAREED SE KAM hai:\n\n' + low.join('\n') + '\n\nPhir bhi bhejein?')) return;
  const total = r2(lines.reduce((n, l) => n + l.qty * l.costP, 0));
  const date = todayStr();   // v1.97.0: tareekh ka khana nahi — naya bill hamesha AAJ ka
  const date2 = edit ? edit.date : date;   // edit: bill ki apni purani tareekh
  if (!edit) {   // v1.98.0: isi supplier ki photo wali purchase pehle se to nahi?
    const dup = (cashDupesOf(p.id, total) || []).slice(0, 5);
    if (dup.length && !confirm('Dhyan: isi supplier ki photo wali purchase pehle se maujood hai:\n\n' +
      dup.map(x => `${x.date} · Rs ${num(x.rs)}${x.note ? ' · ' + x.note : ''}`).join('\n') +
      '\n\nAgar yeh WAHI kharid hai to POS bill aate hi woh khud jur jayegi (do dafa nahi ginti) — warna "Milao" se jorein.\n\nBill bhejein?')) return;
  }
  if (!confirm(`${edit ? 'POS BILL ' + edit.billNo + ' — UPDATE' : 'POS PURCHASE BILL'}\n${p.name}\n${lines.length} items · Rs ${num(total)}${invoiceNo ? '\nSupplier bill # ' + invoiceNo : ''}\n\n${edit ? 'POS mein yahi bill badlein (purani lines hat kar yeh lagengi) aur naye rates lagayein?' : 'POS mein bill banayein aur naye rates lagayein?'}`)) return;
  const id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const doc = { id, date: date2, at: new Date().toISOString(), branch: BILL_BRANCH, godam: Number(godam) || BILL_BRANCH,
    partyId: String(p.id), partyName: String(p.name || '').slice(0, 120), invoiceNo: invoiceNo.trim(), note: note.trim(),
    lines, total, role: isOwner() ? 'owner' : 'staff', by: uidOf(), status: 'new', createdAt: Date.now(),
    ...(edit ? { editOf: { purchaseId: Number(edit.purchaseId), billNo: String(edit.billNo || ''), stamp: String(edit.stamp || ''), partyId: String(edit.partyId || ''), posPartyId: Number(edit.posPartyId) || 0 } } : {}) };
  saving = true; rerender();
  try {
    const w = cloud.saveAppPurchase(doc);
    await Promise.race([w, new Promise(r => setTimeout(r, 4000))]);
    try { learnFromBill(); } catch {}   // v2.4.0: naqsha + misalein + hari ka % seekho
    try {   // v2.1.0: is bill ke rates yaad — agli dafa wohi nafa khud lagega
      const mem = {};
      const sz = sizeMemFromBill();   // v2.4.0: bill ka سائز (carton size) bhi
      for (const l of lines) if (l.id) { const m0 = memOf(l.id) || {}; mem[String(l.id)] = { c: r4(l.costP), w: r2(l.wpcs), r: r2(l.rpcs), t: Date.now(), ...(sz[String(l.id)] || m0.s ? { s: sz[String(l.id)] || m0.s } : {}) }; }
      Promise.resolve(saveRatesOf(mem)).catch(() => {});
    } catch {}
    const keep = { cart, invoiceNo, note, edit, day };
    cart = []; note = ''; invoiceNo = ''; edit = null; day = ''; xtra = 0; xtraName = ''; pct = 0; keepDraft();
    aiRows = null; aiBillInfo = null; jView = 'list'; jIx = -1;   // v2.4.0: bheja hua bill — purani jaanch band
    notice(keep.edit ? 'Update PC ko bhej diya — PC POS mein wohi bill badal dega (Aaj ke app purchase mein status)' : 'Purchase bill bhej diya — PC POS mein bana dega (Aaj ke app purchase mein status)');
    w.catch(err => {
      if (!cart.length) { cart = keep.cart; invoiceNo = keep.invoiceNo; note = keep.note; edit = keep.edit; day = keep.day; keepDraft(); rerender(); }
      alert('Purchase bill PC tak NAHI gaya: ' + (err?.message || err) + '\nBill wapas screen par hai — dobara bhejein.');
    });
  } catch (err) { notice('Nahi gaya: ' + (err?.message || err)); }
  finally { saving = false; rerender(); }
}

// ---------- v1.87: is supplier se aksar aane wale items (app ke bills + POS ke pichhle 6 bills) ----------
async function loadSupItems(pid) {
  if (!pid || supItems.has(pid) || !cloud) return;
  supItems.set(pid, { loading: true, list: [] });
  try {
    const cnt = new Map(), add = id => { if (id != null && id !== '') cnt.set(String(id), (cnt.get(String(id)) || 0) + 1); };
    const apps = cloud.appPurchasesOf ? await cloud.appPurchasesOf(pid).catch(() => []) : [];
    apps.filter(p => p.status !== 'failed').forEach(p => (p.lines || []).forEach(l => add(l.id)));
    const { items } = stock();
    for (const id of billIdsOf(pid).slice(0, 6)) {
      const b = await cloud.purchaseBill(id).catch(() => null);
      for (const l of b?.lines || []) {
        if (l.itemId) { add(l.itemId); continue; }
        const it = items.find(r => norm(r.name) === norm(l.name)) || items.find(r => l.code && String(r.code) === String(l.code));
        if (it) add(it.id);
      }
    }
    supItems.set(pid, { loading: false, list: [...cnt].map(([id, n]) => ({ id, n })).sort((a, b) => b.n - a.n).slice(0, 12) });
  } catch { supItems.set(pid, { loading: false, list: [] }); }
  if (document.querySelector('[data-pp-root]') && supplier === pid && !$('search')?.value.trim()) rerender();
}

// ---------- v1.87: POS ka KHULA bill is screen par (edit) ----------
// b = posBills doc (sync-bills v5: purchaseId, stamp, posPartyId, invoiceNo, lines[{itemId, qtyPcs, ratePcs, godamId}])
export function ppLoadBill(b, ent) {
  if (!b || !Number(b.purchaseId) || !b.stamp || !(b.lines || []).every(l => l.itemId)) return 'Is bill ki poori tafseel PC se abhi nahi aayi.\n\nPC par CHECK-BILLS.bat chalayein (sync-bills v5 chalu karti hai) — 2-3 minute baad dobara kholein.';
  const s = stock();
  if (!s.loaded) return 'Items abhi load ho rahe hain — thori der baad dobara dabayein.';
  if (cart.length && !confirm('POS Purchase screen par pehle se items hain — woh hata kar yeh bill kholein?')) return 'cancel';
  const missing = [], next = [];
  const gcount = new Map();
  for (const x of b.lines) {
    const it = s.items.find(r => String(r.id) === String(x.itemId));
    if (!it) { missing.push(x.name); continue; }
    const o = baseOf(it), pk = Number(it.pack) > 1 ? Number(it.pack) : 0, q = Number(x.qtyPcs) || 0;
    const g = Number(x.godamId) || BILL_BRANCH; gcount.set(g, (gcount.get(g) || 0) + 1);
    next.push({ k: newKey(), id: it.id, code: it.code || '', name: it.name, pack: Number(it.pack) || 0, cName: it.cName || 'Ctn', uName: it.uName || 'Pcs',
      godam: g, ctn: pk ? Math.floor(q / pk + 1e-9) : 0, pcs: pk ? r3(q - Math.floor(q / pk + 1e-9) * pk) : q, costP: r4(Number(x.ratePcs) || o.oldCost), ...o,
      wpcs: o.oldW, wctn: pk ? Math.round(o.oldW * pk) : 0, rpcs: pk ? o.oldR2 : o.oldR, rctn: pk ? Math.round(o.oldR * pk) : 0, wMode: 'old', rMode: 'old' });
    recalc(next[next.length - 1]);   // v2.1.0: bill ke naye khareed par pichhla NAFA khud lag jaye
  }
  if (missing.length) return 'Yeh items POS stock list mein nahi mile, is liye edit nahi ho sakta:\n' + missing.join('\n');
  cart = next;
  godam = [...gcount].sort((a, c) => c[1] - a[1])[0]?.[0] ?? BILL_BRANCH;
  supplier = String(ent?.partyId || ''); supOpen = !partyOf(supplier); supQuery = '';
  day = b.date || ''; invoiceNo = String(b.invoiceNo || ''); note = '';
  edit = { purchaseId: Number(b.purchaseId), billNo: String(b.billNo || ''), stamp: String(b.stamp), partyId: supplier, posPartyId: Number(b.posPartyId) || 0, date: b.date || todayStr() };
  keepDraft();
  return '';
}
