// sale.js — Nayi Sale (Counter / Wholesale) — v1.79.1
// App sale ko Firestore "appSales" mein "new" likhta hai. POS bill PC ka sale-post.js banata hai
// (POS ke apne procedures se), rasid print karta hai aur Sale No wapas likhta hai.
// Counter = R rate (COUNTER SALE, cash) · Wholesale = W rate ("whole sale" party, udhaar + cash ka CRV)
// Malik rate badal sakta hai; mulazim ka rate fix (PC bhi mulazim ki sale POS ke rate se hi banata hai).

import { saleStock, setSaleScanHook, setSaleQtyHook, setSaleFindHook, setSaleCartHook, setSaleDelHook, openSaleCamera, camMissing, camCheck, stockWaitHTML, scanNewBill, setSaleGodamHook, setSaleBillsHook, setSaleLineGodamHook, scanReload } from './pos-stock.js?v=2.98.7';
import { smartSearch, topItems, noteHit, voiceSearch, fold, smartHit } from './smart-search.js?v=2.98.7';

const $ = id => document.getElementById(id);
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const NUMF = new Intl.NumberFormat('en-PK');
const num = n => NUMF.format(Math.round((Number(n) || 0) * 1000) / 1000);   // v1.61.1: tadad 3 decimal (0.125) tak dikhe
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;     // raqam / rate
const r3 = n => Math.round((Number(n) || 0) * 1000) / 1000;   // v1.61.1: TADAD (0.125 -> 0.13 nahi)
const todayStr = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

const SALE_BRANCH = 1;          // POS bill hamesha NOOR TRADERS (branch 1) mein
const DRAFT_KEY = 'sam-sale-draft';

let cloud = null, rerender = () => {}, notice = () => {}, isOwner = () => false, uidOf = () => '', nameOf = () => '';
let mode = 'counter', godam = null, cart = [], cash = null, note = '', saving = false;
let editing = null;   // v2.95: ✏️ bill edit {posId, saleNo, appId, credit, oldTotal}
let salePdf = null; export function setSalePdf(fn) { salePdf = fn; }
let sales = [], salesDay = '', stopSales = null, salesErr = '';
let searchFocused = false;   // v1.75

export function saleSetup(o) {
  { const before = camMissing(); camCheck().then(() => { if (camMissing() !== before && document.querySelector('.sale-camrow')) { try { renderSale(); } catch {} } }); }   // v2.77: PC par camera nahi -> 🔫
  cloud = o.cloud; rerender = o.rerender || rerender; notice = o.notice || notice;
  if (!pcsUn) try { pcsUn = cloud?.listenPrintPCs?.(pcsChanged) || null; } catch {}   // v2.78: 💻 PC chunein
  isOwner = o.owner || isOwner; uidOf = o.uid || uidOf; learnOf = o.learn || learnOf; nameOf = o.name || nameOf;
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    if (d && d.day === todayStr()) { editing = d.editing || null; cart = d.cart || []; mode = cart.length ? (d.mode || 'counter') : 'counter'; godam = cart.length ? (d.godam ?? null) : SALE_BRANCH; cash = d.cash ?? null; note = d.note || ''; }   // v2.63: khali bill = hamesha Counter
  } catch {}
}
function keepDraft() {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ day: todayStr(), mode, godam, cart, cash, note, editing })); } catch {}
}

// ---------- data ----------
function stock() {
  const s = saleStock();
  const pick = s.branches.includes(godam) ? godam : (s.branches.includes(SALE_BRANCH) ? SALE_BRANCH : s.branches[0]);
  godam = pick ?? null;
  const items = pick == null ? [] : s.itemsFor(pick).filter(r => !s.hidden[String(r.id)]);
  return { ...s, pick, items };
}
// v1.61: POS jaisa — counter mein KHULA PIECE "Peice Rate" (SaleRate2 -> item.rate2) se, POORA CARTON "Cotton Rate"
// (SaleRate -> item.rate, fi piece) se. rate2 na ho (purana sync) to dono item.rate. Wholesale pehle jaisa (ek hi rate).
const rateFor = (it, m = mode) => r2(m === 'wholesale' ? (Number(it.wrate) || Number(it.rate) || 0) : (Number(it.rate2) || Number(it.rate) || 0));
const crateFor = (it, m = mode) => r2(m === 'wholesale' ? (Number(it.wrate) || Number(it.rate) || 0) : (Number(it.rate) || 0));
const setStd = (l, it) => { l.rate = rateFor(it); l.std = l.rate; l.crate = crateFor(it); l.cstd = l.crate; };
const linePcs = l => r3((Number(l.ctn) || 0) * (Number(l.pack) > 1 ? Number(l.pack) : 0) + (Number(l.pcs) || 0));
const ctnPcsOf = l => r3((Number(l.ctn) || 0) * (Number(l.pack) > 1 ? Number(l.pack) : 0));
const crateOf = l => Number(l.crate ?? l.rate) || 0;
const lineTotal = l => r2(ctnPcsOf(l) * crateOf(l) + (Number(l.pcs) || 0) * (Number(l.rate) || 0));
const cartTotal = () => r2(cart.reduce((n, l) => n + lineTotal(l), 0));
const cashNow = () => cash == null ? cartTotal() : cash;

// kisi bhi godam ka item (line ke godam ke hisaab se stock/rate)
function itemIn(g, id) {
  const st = saleStock();
  return st.itemsFor(Number(g)).find(r => String(r.id) === String(id)) || null;
}
function setLineGodam(l, b) { l.godam = Number(b) || SALE_BRANCH; const it = itemIn(l.godam, l.id); if (it && !l.edited) setStd(l, it); cash = null; keepDraft(); rerender(); }
function findByCode(items, code) {
  const clean = String(code).trim(), bare = clean.replace(/^0+/, '');
  const codesOf = r => [r.code, ...(Array.isArray(r.bc) ? r.bc : []), ...(Array.isArray(r.bq) ? r.bq.map(x => x?.b) : [])].map(x => String(x || '').trim()).filter(Boolean);   // v2.55: sub-barcode (bq) bhi
  return items.find(r => codesOf(r).includes(clean))
    || items.find(r => bare && codesOf(r).some(x => x.replace(/^0+/, '') === bare)) || null;
}

// v1.58: POS sub-barcode ki tadad (sync-stock v5 -> item.bq [{b, q}]), misal garam masala label 0.25
function subQty(it, code) {
  const clean = String(code || '').trim(), bare = clean.replace(/^0+/, '');
  if (!clean || !Array.isArray(it?.bq)) return 1;
  const e = it.bq.find(x => { const b = String(x?.b || '').trim(); return b === clean || (bare && b.replace(/^0+/, '') === bare); });
  const q = Number(e?.q);
  return q > 0 ? q : 1;
}

// v1.62: har add (scan / search) bill mein NAYI line — jama nahi hota. Har line ki apni pehchan (k).
const newKey = () => 'L' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
function keepScan(el) {   // scan box upar nazar rahe; nayi line uske neeche — dono dikhein to screen na hile
  const sb = document.getElementById('search'); if (!el || !sb) return;
  const r = el.getBoundingClientRect(), s = sb.getBoundingClientRect(), vh = window.innerHeight || 800;
  if (r.top >= 0 && r.bottom <= vh && s.top >= 0 && s.bottom <= vh) return;
  window.scrollTo({ top: Math.max(0, (window.scrollY || 0) + s.top - 8), behavior: 'smooth' });
}
let lastAddAt = 0, lastScrolled = 0;
let quickSave = false, posSales = [], stopPosSales = null, posSyncAt = 0, stopPosSync = null;
const BASE_COUNTERS = [['abdurehman', 'Abdurehman'], ['bilal', 'Bilal bhai'], ['mithu', 'Mithu'], ['local', '🖥 Yehi device']];
// v2.78: 💻 PC chunein — har PC ka NT-PRINT agent printPCs/{id} mein zinda report deta hai; bill usi PC par bina window ke
let PCS = [], pcsUn = null;
const isPC = k => String(k || '').startsWith('pc:');
const pcOf = k => { const id = String(k || '').split(':')[1]; return PCS.find(p => p.id === id); };   // 'pc:<id>' ya 'pc:<id>:<printer>'
const pcKey = p => 'pc:' + p.id;
const prnOf = k => { const h = String(k || '').split(':')[2] || ''; const p = pcOf(k); const x = h && Array.isArray(p?.printers) ? p.printers.find(q => q && q.h === h) : null; return x ? x.n : ''; };   // v2.78: chuna hua printer ka naam
const samePC = (k, p) => isPC(k) && String(k).split(':')[1] === p.id;
const pcLive = p => !!p && Math.abs(Date.now() - (Number(p.at) || 0)) < 4 * 60000;
const allCounters = () => [...BASE_COUNTERS, ...PCS.filter(p => pcLive(p) || samePC(counter, p)).map(p => [samePC(counter, p) ? counter : pcKey(p), (pcLive(p) ? '💻 ' : '💤 ') + String(p.name || p.id).slice(0, 24) + (samePC(counter, p) && prnOf(counter) ? ' · 🖨 ' + prnOf(counter).slice(0, 18) : '')])];
const COUNTERS = { some: f => allCounters().some(f), find: f => allCounters().find(f), map: f => allCounters().map(f), get 0() { return BASE_COUNTERS[0]; } };   // v2.72: local = isi device ka default printer
let crates = 1;   // v2.72: token parchiyan (har crate ki ek)   // v2.68: kis counter ke printer par bill + gate pass
let counter = 'abdurehman'; try { const c = localStorage.getItem('sam-sale-counter'); if (BASE_COUNTERS.some(x => x[0] === c) || isPC(c)) counter = c; } catch {}
const counterName = k => isPC(k) ? '💻 ' + String(pcOf(k)?.name || 'PC') : (COUNTERS.find(x => x[0] === k) || COUNTERS[0])[1];
const setCounter = (k, force) => { if (!COUNTERS.some(x => x[0] === k) && !isPC(k)) return; if (!force && isPC(k) && isPC(counter) && String(k).split(':').length === 2 && String(counter).split(':')[1] === String(k).split(':')[1]) k = counter; const wasPC = isPC(counter); counter = k; try { localStorage.setItem('sam-sale-counter', k); } catch {} if ((isPC(k) || wasPC) && PCS.length) pcsChanged(PCS); document.querySelectorAll('[data-sale-counter]').forEach(x => x.classList.toggle('on', x.dataset.saleCounter === k)); document.querySelectorAll('[data-f5c]').forEach(x => x.classList.toggle('on', x.dataset.f5c === k)); };
document.addEventListener('click', e => { const b = e.target.closest?.('[data-sale-counter]'); if (b) setCounter(b.dataset.saleCounter); });   // v2.57: F5 -> sirf '1 ya 2 print?'
// v2.89: 🚪 GATE PASS switch — on ho to saari lines us godam se (default NOOR TRADERS) aur gate pass HAMESHA chhape (branch wala bhi)
let gate = 0; try { gate = Number(localStorage.getItem('sam-sale-gate')) || 0; } catch {}
const gateDiv = () => { const s = saleStock(); const br = (s.branches || []).filter(b => b !== 0); const on = gate > 0; return `<div class="sale-copies sale-gate"><small>🚪 Gate pass</small><button type="button" data-sale-gate="${on ? 0 : (SALE_BRANCH)}" class="${on ? 'on' : ''}">${on ? 'ON' : 'OFF'}</button>${on ? br.map(b => `<button type="button" data-sale-gate="${b}"${gate === b ? ' class="on"' : ''}>${esc(s.branchName ? s.branchName(b, s.names) : 'Godam ' + b)}</button>`).join('') : '<small class="sale-copies-h">off = sirf doosre godam ka</small>'}</div>`; };
document.addEventListener('click', e => { const b = e.target.closest?.('[data-sale-gate]'); if (!b) return; gate = Number(b.dataset.saleGate) || 0; try { localStorage.setItem('sam-sale-gate', String(gate)); } catch {} if (gate) for (const l of cart) { l.godam = gate; const it = itemIn(gate, l.id); if (it) setStd(l, it); } rerender(); });
let copies = 1; try { copies = Math.min(3, Math.max(1, Number(localStorage.getItem('sam-sale-copies')) || 1)); } catch {}   // v2.40: bill kitni dafa chhape (gate pass ek hi)
const counterDiv = () => `<div class="sale-copies sale-counter"><small>🖨 Counter</small>${COUNTERS.map(([k, n]) => `<button type="button" data-sale-counter="${k}"${isPC(k) ? ` class="pc-chip${pcLive(pcOf(k)) ? '' : ' off'}${counter === k ? ' on' : ''}" title="${pcLive(pcOf(k)) ? 'Is PC par bina window ke print — printer: ' + String(pcOf(k)?.printer || 'default').replace(/"/g, '') : 'PC band / agent nahi chal raha'}"` : (counter === k ? ' class="on"' : '')}>${n}</button>`).join('')}</div>`;
const printerDiv = () => { if (!isPC(counter)) return ''; const p = pcOf(counter); const list = Array.isArray(p?.printers) ? p.printers.filter(x => x && x.n && x.h) : []; if (!list.length) return ''; const cur = String(counter).split(':')[2] || '';
  return `<div class="sale-copies sale-prn"><small>🖨 Printer</small><button type="button" data-sale-printer=""${cur ? '' : ' class="on"'}>Default${p.printer ? ' (' + esc(String(p.printer).slice(0, 16)) + ')' : ''}</button>${list.map(x => `<button type="button" data-sale-printer="${esc(x.h)}"${cur === x.h ? ' class="on"' : ''}>${esc(x.n.slice(0, 22))}</button>`).join('')}</div>`; };
const setPrinter = h => { if (!isPC(counter)) return; setCounter('pc:' + String(counter).split(':')[1] + (h ? ':' + h : ''), true); };
document.addEventListener('click', e => { const b = e.target.closest?.('[data-sale-printer]'); if (b) setPrinter(b.dataset.salePrinter); const c = e.target.closest?.('[data-live-clear]'); if (c && isOwner() && cloud?.liveCartStop) cloud.liveCartStop(counter, null).then(() => notice('✓ Clear')).catch(er => notice('Nahi hua: ' + (er?.message || er))); });
const copyChips = () => counterDiv() + printerDiv() + gateDiv() + `<div class="sale-copies"><small>🖨 Bill print</small>${[1, 2, 3].map(n => `<button type="button" data-sale-copies="${n}"${copies === n ? ' class="on"' : ''}>×${n}</button>`).join('')}<small class="sale-copies-h">gate pass ×1</small></div>`;
function pcsChanged(list) {   // v2.78: chips jagah par badlo (poora render nahi — likhte waqt focus na jaye)
  PCS = (Array.isArray(list) ? list : []).filter(p => p && p.id).sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id)));
  document.querySelectorAll('.sale-prn').forEach(el => el.remove());
  document.querySelectorAll('.sale-counter').forEach(el => { const t = document.createElement('div'); t.innerHTML = counterDiv() + printerDiv(); el.replaceWith(...t.children); });
  const f = document.querySelector('.f5-ctr'); if (f) f.innerHTML = f5Chips() + f5Prn();
}
const f5Chips = () => COUNTERS.map(([k, n]) => `<button type="button" data-f5c="${k}" class="${isPC(k) ? 'pc-chip' + (pcLive(pcOf(k)) ? '' : ' off') : ''}${counter === k ? ' on' : ''}"><kbd>${k === 'local' ? 'D' : isPC(k) ? '💻' : n[0]}</kbd> ${isPC(k) ? n.replace(/^(💻|💤) /, '') : n}</button>`).join('');
const f5Prn = () => { const d = printerDiv(); return d ? d.replace(/data-sale-printer=/g, 'data-f5p=').replace('class="sale-copies sale-prn"', 'class="f5-prn"') : ''; };
setInterval(() => { if (PCS.length) pcsChanged(PCS); }, 60000);
document.addEventListener('click', e => { const b = e.target.closest?.('[data-sale-copies]'); if (!b) return; copies = Number(b.dataset.saleCopies) || 1; try { localStorage.setItem('sam-sale-copies', String(copies)); } catch {} document.querySelectorAll('[data-sale-copies]').forEach(x => x.classList.toggle('on', Number(x.dataset.saleCopies) === copies)); });
let qtyFocusNext = false;   // v2.62: PC — nayi line ki tadad par cursor
const finePtr = window.matchMedia ? window.matchMedia('(pointer:fine)') : { matches: false };
function addItem(it, qtyPcs = 1) {
  lastAddAt = Date.now(); qtyFocusNext = true;
  noteHit(it.id);   // v1.75: ranking ke liye
  {
    cart.push({
      k: newKey(), id: it.id, code: it.code || '', name: it.name, pack: Number(it.pack) || 0,
      cName: it.cName || 'Ctn', uName: it.uName || 'Pcs', godam: Number(gate || godam) || SALE_BRANCH,
      ctn: 0, pcs: qtyPcs, rate: rateFor(it), std: rateFor(it), crate: crateFor(it), cstd: crateFor(it), edited: false
    });
    // v1.60: nayi line par bhi poore carton alag (misal 2 Ctn likha = 24 pcs -> 2 Ctn)
    const nl = cart[cart.length - 1], pk = Number(nl.pack) || 0;
    if (pk > 1 && nl.pcs >= pk) { nl.ctn = Math.floor(nl.pcs / pk); nl.pcs = r3(nl.pcs % pk); }
  }
  cash = null; keepDraft();
  return cart[cart.length - 1];
}

// camera ki screen ka search
// v1.61.2: camera ki list bill se (rate bhi bill wala: khula piece l.rate, carton crate)
// v1.64: camera ki list ka ✕ -> bill ki wohi line (pehchan k se)
// v1.86: hooks function mein — POS Purchase screen bhi yahi hooks leti hai; jo screen khule woh apne laga leti hai
// ---------- v2.31: 🎤 BOL KAR BILL — scanner jaisa: har jumla = usi bill mein ek line (Urdu/Roman, ginti ke lafz, carton/kilo, godam) ----------
let vbRec = null, vbOn = false, vbAudio = null, vbSeq = 0;
const VB_DIG = s => String(s || '').replace(/[۰-۹]/g, x => String(x.charCodeAt(0) - 1776)).replace(/[٠-٩]/g, x => String(x.charCodeAt(0) - 1632));
const VB_WORD = { aik: 1, ek: 1, ایک: 1, do: 2, دو: 2, teen: 3, tin: 3, تین: 3, char: 4, chaar: 4, چار: 4, panch: 5, paanch: 5, پانچ: 5, chay: 6, che: 6, chhe: 6, چھ: 6, چھے: 6, saat: 7, sat: 7, سات: 7, aath: 8, ath: 8, آٹھ: 8, nau: 9, no: 9, نو: 9, das: 10, دس: 10, gyara: 11, گیارہ: 11, bara: 12, بارہ: 12, tera: 13, تیرہ: 13, chauda: 14, چودہ: 14, pandra: 15, پندرہ: 15, sola: 16, سولہ: 16, satra: 17, سترہ: 17, athara: 18, اٹھارہ: 18, unnis: 19, انیس: 19, bees: 20, بیس: 20, pachees: 25, پچیس: 25, tees: 30, تیس: 30, chalis: 40, چالیس: 40, pachas: 50, پچاس: 50, sath: 60, ساٹھ: 60, sattar: 70, ستر: 70, assi: 80, اسی: 80, nabbe: 90, نوے: 90, sau: 100, سو: 100, aadha: 0.5, آدھا: 0.5, dedh: 1.5, ڈیڑھ: 1.5, dhai: 2.5, ڈھائی: 2.5 };
const VB_CTN = new Set(['carton', 'cartoon', 'ctn', 'cotton', 'karton', 'kartan', 'peti', 'box', 'dabba', 'gatta', 'کارٹن', 'کاٹن', 'کارٹون', 'پیٹی', 'ڈبہ', 'بکس', 'گتا']);
const VB_PCS = new Set(['pcs', 'piece', 'pieces', 'pc', 'dana', 'adad', 'kilo', 'kg', 'kilogram', 'litre', 'liter', 'ltr', 'packet', 'pkt', 'bottle', 'botal', 'thaila', 'thela', 'bori', 'bag', 'kg.', 'کلو', 'کلوگرام', 'لیٹر', 'لٹر', 'پیس', 'دانہ', 'عدد', 'پیکٹ', 'بوتل', 'تھیلا', 'تھیلی', 'بوری', 'بیگ']);
const VB_GODAM = new Set(['godam', 'godaam', 'gudam', 'گودام', 'گودم', 'گدام']);
const VB_SKIP = new Set(['ka', 'ki', 'ke', 'ko', 'aur', 'or', 'and', 'wala', 'wali', 'walay', 'walee', 'کا', 'کی', 'کے', 'کو', 'اور', 'والا', 'والی', 'والے', 'daalo', 'dalo', 'dedo', 'ڈالو', 'ڈال', 'add', 'plus', 'lagao', 'لگاؤ', 'لگا']);
const VB_UR = { 'ا': 'a', 'آ': 'a', 'ب': 'b', 'پ': 'p', 'ت': 't', 'ٹ': 't', 'ث': 's', 'ج': 'j', 'چ': 'ch', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ڈ': 'd', 'ذ': 'z', 'ر': 'r', 'ڑ': 'r', 'ز': 'z', 'ژ': 'zh', 'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'z', 'ط': 't', 'ظ': 'z', 'ع': '', 'غ': 'gh', 'ف': 'f', 'ق': 'q', 'ک': 'k', 'ك': 'k', 'گ': 'g', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ں': 'n', 'و': 'o', 'ہ': 'h', 'ھ': 'h', 'ه': 'h', 'ء': '', 'ی': 'i', 'ي': 'i', 'ے': 'e', 'ئ': 'i', 'ۃ': 'h', 'ة': 'h', 'ؤ': 'o', 'أ': 'a', 'إ': 'i', 'ۓ': 'e' };
const vbRoman = s => String(s || '').replace(/[\u064B-\u065F\u0670\u0640]/g, '').split('').map((c, i, a) => c in VB_UR ? (c === 'و' && (i === 0 || a[i - 1] === ' ') ? 'w' : (c === 'ہ' || c === 'ه') && (i === a.length - 1 || a[i + 1] === ' ') && i > 0 && a[i - 1] !== ' ' ? 'a' : VB_UR[c]) : c).join('');
function vbNum(t) { const d = VB_DIG(t).replace(/[^\d.]/g, ''); if (d && /^\d+(\.\d+)?$/.test(d)) return Number(d); const w = t.toLowerCase(); return VB_WORD[w] ?? null; }
function vbTok(s) { return VB_DIG(s).toLowerCase().replace(/[،,؛;]/g, ' , ').replace(/(\d)([a-z\u0600-\u06ff])/g, '$1 $2').replace(/([a-z\u0600-\u06ff])(\d)/g, '$1 $2').split(/\s+/).filter(Boolean); }
function vbParse(text, items, st) {          // ek jumla -> { q, nq (pao samet naam), qty, pao (kg), unit, godam }
  const toks = vbTok(text); if (!toks.length) return null;
  const IN = (set, t) => set.has(t) || set.has(vbRoman(t)), NUM = t => { const n = vbNum(t); return n != null ? n : vbNum(vbRoman(t)); };
  let qty = null, mod = 0, unit = '', godam = null, pao = null, qtyInPao = false, lastNumTok = ''; const words = [], nwords = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (IN(VB_GODAM, t)) { const n = NUM(toks[i + 1] || ''); if (n != null) { i++; const nm = 'godam ' + n; godam = (st.branches || []).find(b => norm(st.names?.[b] || '').replace(/[^a-z0-9 ]/g, '') === nm) ?? (st.branches || []).find(b => String(b) === String(n)) ?? null; } continue; }
    if (IN(VB_SAWA, t)) { mod = 0.25; continue; }
    if (IN(VB_PAUNE, t)) { mod = -0.25; continue; }
    if (IN(VB_PAO, t)) { const base = (qty ?? 1) + (qty == null ? mod : 0); pao = base * 0.25; qtyInPao = qty != null; if (lastNumTok && !/\d/.test(lastNumTok)) nwords.push(lastNumTok); nwords.push('pao'); mod = 0; continue; }
    if (t === 'darjan' || t === 'dozen' || t === 'درجن') { qty = (qty ?? 1) * 12; if (!unit) unit = 'pcs'; continue; }
    const n = NUM(t); if (n != null && qty == null) { qty = n + mod; mod = 0; lastNumTok = t; continue; }
    if (IN(VB_CTN, t) || IN(VB_PCS, t)) { if (!unit) unit = t; continue; }
    if (IN(VB_SKIP, t)) continue;
    words.push(t); nwords.push(t);
  }
  if (qty == null && mod && pao == null) qty = 1 + mod;          // "sawa kilo" = 1.25
  return { q: words.join(' ').trim(), nq: nwords.join(' ').trim(), qty, pao, qtyInPao, unit, godam, paoWord: pao != null && lastNumTok ? fold(vbRoman(lastNumTok)) : '' };
}
// ---------- v2.32: 🎤 suggestion chips · Urdu -> Roman · pao/sawa/paune · ek dafa bolo yaad ----------
const VB_PAO = new Set(['pao', 'paao', 'pav', 'paw', 'پاؤ', 'پاو', 'پا']), VB_SAWA = new Set(['sawa', 'sowa', 'سوا']), VB_PAUNE = new Set(['paune', 'pone', 'paunay', 'پونے', 'پونا']);
const VB_LKEY = 'sam-voice-v1';
let vbLearn = null, learnOf = null, vbSug = null;
const vbKey = q => fold(vbRoman(q)).replace(/\s+/g, '');
function vbLearnGet(q) { try { vbLearn = vbLearn || JSON.parse(localStorage.getItem(VB_LKEY) || '{}'); } catch { vbLearn = {}; } return vbLearn[vbKey(q)] || null; }
function vbLearnSet(q, id, it) {
  const k = vbKey(q); if (!k) return;
  try { vbLearn = vbLearn || JSON.parse(localStorage.getItem(VB_LKEY) || '{}'); vbLearn[k] = String(id); const ks = Object.keys(vbLearn); if (ks.length > 600) delete vbLearn[ks[0]]; localStorage.setItem(VB_LKEY, JSON.stringify(vbLearn)); } catch {}
  if (learnOf && it) { const rom = vbRoman(q).trim(); Promise.resolve(learnOf(String(id), rom, /[\u0600-\u06ff]/.test(q) ? q : '')).catch(() => {}); }   // "doosre naam" mein bhi — sab phones
}
const vbNamePao = it => /\b(pao|pav|paw)\b|پاؤ/i.test(String(it?.name || ''));
function vbQty(r, it) {            // is item ke liye ctn / pcs
  if (r.pao != null) { if (vbNamePao(it)) return { ctn: 0, pcs: r.qty && Number.isInteger(r.qty) && r.qty >= 1 && !r.qtyInPao ? r.qty : 1 }; return { ctn: 0, pcs: Math.round(r.pao * 1000) / 1000 }; }
  const n = r.qty ?? 1, cn = norm(it.cName || 'ctn'), un = norm(it.uName || 'pcs'), u = norm(r.unit || '');
  const same = (x, y) => { if (!x || !y) return false; x = fold(vbRoman(x)); y = fold(vbRoman(y)); if (x === y) return true; if (x.length >= 3 && y.length >= 3 && (x.startsWith(y) || y.startsWith(x))) return true; if (Math.abs(x.length - y.length) > 1) return false; let d = 0, i = 0, j = 0; while (i < x.length && j < y.length) { if (x[i] === y[j]) { i++; j++; continue; } if (++d > 1) return false; if (x.length > y.length) i++; else if (y.length > x.length) j++; else { i++; j++; } } return d + (x.length - i) + (y.length - j) <= 1; };
  const isCtn = !!u && (same(u, cn) || (VB_CTN.has(u) && !same(u, un))) && !same(u, un);
  return isCtn ? { ctn: n, pcs: 0 } : { ctn: 0, pcs: n };
}
const vbSkel = w => fold(vbRoman(w)).replace(/[aeiouyhw]/g, '');   // harfon ka dhancha: garam / grm -> grm, masala / msalhh -> msl
const vbSk = new WeakMap();
function vbSkelHits(q, items) {
  const qs = String(q || '').split(/\s+/).map(vbSkel).filter(x => x.length >= 2); if (!qs.length) return [];
  const out = [];
  for (const it of items) { let e = vbSk.get(it); if (!e) { e = fold(String(it.name || '')).split(/\s+/).map(w => w.replace(/[aeiouyhw]/g, '')).filter(Boolean); vbSk.set(it, e); }
    let hit = 0; for (const x of qs) if (e.some(w => w === x || (x.length >= 2 && w.startsWith(x)) || (w.length >= 3 && x.startsWith(w)))) hit++;
    if (hit === qs.length) out.push([it, e.length - hit]); }
  return out.sort((a, b) => a[1] - b[1]).slice(0, 6).map(x => x[0]);
}
function vbCands(r, items) {      // milte julte items (learned pehle)
  const seen = new Set(), out = [], push = it => { if (it && !seen.has(String(it.id))) { seen.add(String(it.id)); out.push(it); } };
  const lid = vbLearnGet(r.q) || (r.nq !== r.q ? vbLearnGet(r.nq) : null);
  if (lid) push(items.find(x => String(x.id) === String(lid)));
  for (const q of [r.nq, r.q].filter(Boolean)) {
    for (const x of [q, /[\u0600-\u06ff]/.test(q) ? vbRoman(q) : ''].filter(Boolean)) for (const it of smartSearch(items, x, 6)) push(it);
    const qq = norm(vbRoman(q)); for (const it of items) { if (out.length >= 8) break; if (norm(it.name).includes(qq)) push(it); }
  }
  if (!out.length) for (const q of [r.nq, r.q].filter(Boolean)) for (const it of vbSkelHits(q, items)) push(it);   // sirf jab kuch na mile (Urdu zer-zabar baghair)
  if (r.pao != null && !lid) { const sc = it => { const f = fold(String(it.name || '')); return (vbNamePao(it) ? 2 : 0) + (r.paoWord && (f.includes(r.paoWord) || (r.paoWord === 'ada' && f.includes('adh'))) ? 1 : 0); }; out.sort((a, b) => sc(b) - sc(a)); }   // "adha pao" -> Adha Pao packet pehle
  return { list: out.slice(0, 6), learned: !!lid && out.length > 0 && String(out[0].id) === String(lid) };
}
function vbSure(r, c) {
  if (c.learned) return true;
  if (c.list.length === 1) return true;
  const a = c.list[0] ? fold(c.list[0].name).replace(/\s+/g, '') : '', b = c.list[1] ? fold(c.list[1].name).replace(/\s+/g, '') : '';
  return [r.q, r.nq].filter(Boolean).some(x => { const qf = vbKey(x); return qf.length >= 4 && a.startsWith(qf) && !b.startsWith(qf); });
}
function vbPut(r, it, st) {
  const l = addItem(it, 0), q = vbQty(r, it); l.ctn = q.ctn; l.pcs = q.pcs;
  if (r.godam != null && r.godam !== l.godam) { l.godam = Number(r.godam); const gi = itemIn(l.godam, it.id); if (gi) setStd(l, gi); }
  return l;
}
const vbQtyTxt = (r, it) => { const q = vbQty(r, it); return q.ctn ? q.ctn + ' ' + (it.cName || 'Ctn') : q.pcs + ' ' + (it.uName || 'Pcs'); };
function vbSugPaint() {
  let box = document.getElementById('vbSug');
  if (!vbSug || !document.querySelector('[data-sale-root]')) { if (box) box.hidden = true; return; }
  if (!box) { box = document.createElement('div'); box.id = 'vbSug'; box.className = 'vb-sug'; document.body.appendChild(box); }
  const s = vbSug;
  box.innerHTML = `<div class="vb-sug-h"><span>🎤 <b>${esc(s.heard)}</b>${s.added ? ` · ✓ <i>${esc(s.added.name)}</i> lag gaya` : ' · kaunsa?'}</span><button type="button" data-vb-x="1" aria-label="band">✕</button></div>`
    + `<div class="vb-sug-c">${s.list.filter(it => !s.added || String(it.id) !== String(s.added.id)).map((it, i) => `<button type="button" data-vb-pick="${esc(String(it.id))}">${esc(it.name)}<small>${esc(vbQtyTxt(s.r, it))}</small></button>`).join('') || '<small>Aur koi milta julta nahi</small>'}</div>`
    + (s.added ? '<small class="vb-sug-f">Ghalat hai? Sahi wala tap karein — badal jayega aur yaad rahega</small>' : '<small class="vb-sug-f">Tap karein — lag jayega aur agli dafa khud pehchanega</small>');
  box.hidden = false;
}
document.addEventListener('click', () => setTimeout(vbSugPaint, 60));   // sale screen chhori to chips chhupen
window.addEventListener('popstate', () => setTimeout(vbSugPaint, 60));
document.addEventListener('click', e => {
  const x = e.target.closest?.('[data-vb-x]'); if (x) { vbSug = null; vbSugPaint(); return; }
  const b = e.target.closest?.('[data-vb-pick]'); if (!b || !vbSug) return;
  const st = stock(), it = st.items.find(r => String(r.id) === b.dataset.vbPick) || vbSug.list.find(r => String(r.id) === b.dataset.vbPick); if (!it) return;
  if (vbSug.lineK) cart = cart.filter(l => l.k !== vbSug.lineK);    // ghalat wali line hatao
  const l = vbPut(vbSug.r, it, st);
  vbLearnSet(vbSug.r.nq || vbSug.r.q, it.id, it);
  notice('✓ ' + it.name + ' · ' + vbQtyTxt(vbSug.r, it) + ' — yaad kar liya');
  vbSug = null; cash = null; keepDraft(); rerender(); vbSugPaint();
  try { navigator.vibrate?.(40); } catch {}
});

function vbBeep(ok = true) { try { vbAudio = vbAudio || new (window.AudioContext || window.webkitAudioContext)(); const o = vbAudio.createOscillator(), g = vbAudio.createGain(); o.frequency.value = ok ? 1320 : 330; g.gain.value = 0.12; o.connect(g); g.connect(vbAudio.destination); o.start(); o.stop(vbAudio.currentTime + (ok ? 0.09 : 0.25)); } catch {} }
function vbAdd(text) {
  if (!document.querySelector('[data-sale-root]')) { vbStop(); return; }
  const st = stock(), heard = vbRoman(text).trim(), parts = String(text || '').split(/\s+(?:aur|or|and|اور)\s+|[،,]/i).map(x => x.trim()).filter(Boolean);
  let added = 0, lastSug = null;
  for (const p of parts) {
    const r = vbParse(p, st.items, st); if (!r || !(r.q || r.nq)) continue;
    const c = vbCands(r, st.items);
    const hp = vbRoman(p).trim();
    if (c.list.length && vbSure(r, c)) { const l = vbPut(r, c.list[0], st); added++; lastSug = { heard: hp, r, list: c.list, added: c.list[0], lineK: l.k }; notice('🎤 ✓ ' + c.list[0].name + ' · ' + vbQtyTxt(r, c.list[0])); }
    else lastSug = { heard: hp, r, list: c.list, added: null, lineK: null };
  }
  if (added) { cash = null; keepDraft(); rerender(); try { navigator.vibrate?.([40, 40, 40]); } catch {} vbBeep(true); }
  else if (lastSug) vbBeep(false);
  vbSug = lastSug; vbSugPaint();
  if (!lastSug) notice('🎤 Suna: "' + heard.slice(0, 60) + '" — item ka naam samajh nahi aaya');
}
let vbHold = false, vbStopT = 0, vbHeard = '', vbDone = '';
function vbStart() {               // v2.94.0: DABA KAR BOLO — button dabe rahne tak sunta hai, chhorte hi line
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { notice('Is phone/browser mein awaz nahi chalti'); return; }
  if (vbRec) { try { vbRec.abort(); } catch {} vbRec = null; }
  clearTimeout(vbStopT); vbOn = true; vbHold = true; vbHeard = ''; vbDone = ''; const seq = ++vbSeq;
  const mk = lang => { const r = new SR(); r.lang = lang; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
    r.onresult = ev => { let fin = '', tmp = ''; for (let i = 0; i < ev.results.length; i++) { const t = String(ev.results[i][0]?.transcript || ''); if (ev.results[i].isFinal) fin += ' ' + t; else tmp += ' ' + t; } vbHeard = (fin + ' ' + tmp).trim(); vbPaint(); };
    r.onerror = ev => { if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') { vbOn = false; vbHold = false; vbPaint(); notice('Mic ki ijazat dein (Chrome → Microphone → Allow)'); } else if (ev.error === 'language-not-supported' && lang !== 'en-IN') { vbRec = mk('en-IN'); try { vbRec.start(); } catch {} } };
    r.onend = () => { if (seq !== vbSeq || vbRec !== r) return; if (vbHold) { vbDone = (vbDone + ' ' + vbHeard).trim(); vbHeard = ''; try { r.start(); } catch {} return; } vbOn = false; vbRec = null; const t = (vbDone + ' ' + vbHeard).trim(); vbHeard = ''; vbDone = ''; vbPaint(); if (t) vbAdd(t); else notice('🎤 Kuch suna nahi — daba kar rakhein aur bolein'); };
    return r; };
  vbRec = mk('ur-PK');
  try { vbRec.start(); } catch (e) { vbOn = false; vbHold = false; notice('Mic shuru nahi hua: ' + (e?.message || e)); }
  try { navigator.vibrate?.(30); } catch {}
  vbPaint();
}
function vbRelease() {             // ungli uthi — aakhri lafz ke liye 0.6s ruk kar band
  if (!vbHold) return; vbHold = false;
  clearTimeout(vbStopT); vbStopT = setTimeout(() => { if (vbRec) { try { vbRec.stop(); } catch {} } }, 600);
  vbPaint();
}
function vbStop() { vbHold = false; vbOn = false; vbSeq++; clearTimeout(vbStopT); if (vbRec) { try { vbRec.onend = null; vbRec.abort(); } catch {} vbRec = null; } vbPaint(); }
function vbPaint() { const b = document.querySelector('[data-sale-mic]'); if (!b) return; b.classList.toggle('on', vbOn); b.textContent = vbOn ? (vbHold ? '🎤 ' + (vbHeard ? vbRoman(vbHeard).slice(-26) : 'Bolein…') : '⏳') : '🎤 Daba kar bolo'; }

// v2.95: module scope (pehle function ke andar tha -> scan screen ke godam chips ReferenceError se chhup jate the)
const gShort = b => { const st = saleStock(); const nm = String((st.branchName ? st.branchName(b, st.names) : '') || st.names?.[b] || b); const m = nm.match(/(\d+)\s*$/); return m ? m[1] : nm.slice(0, 3); };
const gLabel = b => Number(b) === SALE_BRANCH ? 'NT' : 'G' + gShort(b);
function installSaleHooks() {
setSaleDelHook(key => {
  const i = cart.findIndex(l => l.k === key);
  if (i < 0) return;
  cart.splice(i, 1); cash = null; keepDraft(); rerender();
});
setSaleCartHook(() => cart.map(l => ({ key: l.k || (l.k = newKey()),
  item: { id: l.id, code: l.code, name: l.name + ((Number(l.godam) || SALE_BRANCH) !== SALE_BRANCH ? ' · G' + gShort(l.godam) : ''), pack: Number(l.pack) || 0, cName: l.cName, uName: l.uName, rate: crateOf(l), rate2: Number(l.rate) || 0, g: Number(l.godam) || SALE_BRANCH },
  pcs: Number(l.pcs) || 0, ctn: Number(l.ctn) || 0 })));
setSaleFindHook(q => smartSearch(stock().items, q, 12));   // v1.75: smart search
setSaleLineGodamHook((key, b) => { const l = cart.find(x => x.k === key); if (!l) return; setLineGodam(l, b); });   // v2.95: line ka godam (scan screen chips)
// camera par tadad ke buttons -> bill ki line
setSaleQtyHook((it, q, key) => {
  // v1.62: camera ke buttons AAKHRI scan wali line par (line ki pehchan se), warna is item ki aakhri line
  const l = (key && cart.find(x => x.k === key)) || [...cart].reverse().find(x => String(x.id) === String(it.id));
  if (!l) return;
  l.pcs = Number(q.pcs) || 0; l.ctn = Number(q.ctn) || 0;
  cash = null; keepDraft(); rerender();
});
// scan (camera / USB scanner) — pos-stock.js yahan bhejta hai
setSaleScanHook((code, direct, qty) => {
  const { items } = stock();
  const it = direct || findByCode(items, code);
  if (!it) return { state: null };
  const q = Number(qty) > 0 ? Math.round(Number(qty) * 1000) / 1000 : (direct ? 1 : subQty(it, code));   // v1.59: search wale khane ki tadad
  const nl = addItem(it, q);
  notice(`✓ ${it.name}${q !== 1 ? ' — ' + q : ''}`);
  const s = $('search'); if (s && s.value) s.value = '';
  rerender();
  // v1.58: bill ki asal tadad wapas (camera ki list bhi wohi dikhaye — pehle dobara scan par list 1 hi dikhati thi)
  return { state: 'added', item: it, line: nl.k, pcs: Number(nl.pcs) || 0, ctn: Number(nl.ctn) || 0 };
});
}
installSaleHooks();

// ---------- aaj ki app sales ----------
function watchSales() {
  const day = todayStr();
  if (stopSales && salesDay === day) return;
  if (stopSales) { stopSales(); stopSales = null; }
  if (!cloud?.listenAppSales) return;
  salesDay = day;
  try { stopPosSales?.(); } catch {} let firstPos = true; stopPosSales = cloud.listenPosSales ? cloud.listenPosSales(day, b => { posSales = Array.isArray(b) ? b : []; if (!firstPos) posSyncAt = Date.now(); firstPos = false; billsRepaint(); }) : null;   // v2.64.1: POS ke bills
  try { stopPosSync?.(); } catch {} let firstSync = true; stopPosSync = cloud.listenPosSync ? cloud.listenPosSync(at => { if (firstSync) { firstSync = false; posSyncAt = Math.max(posSyncAt, Math.min(Date.now(), Number(at) || 0)); } else posSyncAt = Date.now(); billsRepaint(); }) : null;   // v2.95.3: is device ki ghari se (server PC ki ghari peeche thi -> '3 min pehle')   // v2.95: PC ka aakhri sync
  stopSales = cloud.listenAppSales(day, list => {
    sales = list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); salesErr = ''; localCheck();
    const box = $('saleTodayBtn'); if (box) box.textContent = todayLabel();
    billsRepaint();
  }, e => { salesErr = e?.message || 'Load nahi hui'; stopSales = null; });
}
const statusText = s => s.status === 'done' ? `✓ Sale ${esc(s.saleNo || '')}${s.crvNo ? ' · ' + esc(s.crvNo) : ''}`
  : s.status === 'failed' ? `✕ Nahi bani: ${esc(s.error || '')}`
  : s.status === 'posting' ? '… PC bill bana raha hai' : '⏳ PC ka intezar';
const todayLabel = () => {
  const all = billsDataOf(sales, posSales), wait = sales.filter(s => s.status === 'new' || s.status === 'posting').length, un = all.filter(b => b.ps === 1 && !b.cancelled && !b.farq).length;
  return `📋 Aaj ke bills (${num(all.length)})${un ? ' · ⏳ ' + num(un) + ' un-posted' : ''}${wait ? ' · ' + num(wait) + ' intezar' : ''}`;
};
function openToday() {   // v2.95: mobile par bhi wahi "Aaj ke bills" (PC + app, rang, posted / un-posted, edit, print)
  const d = $('dialog'); if (!d) return;
  d.classList.remove('search-dialog');
  $('dialogTitle').textContent = '🧾 Bills';
  $('dialogBody').innerHTML = '<div class="nb-wrap nb-dlg"></div>';
  if (!d.open) d.showModal();
  mountBills($('dialogBody').querySelector('.nb-wrap'));
}
function qtyText(l) {
  const pk = Number(l.pack) || 0, q = Number(l.qty) || 0;
  if (pk > 1 && q >= pk) { const c = Math.floor(q / pk), p = r3(q - c * pk); return `${num(c)} ${esc(l.cName || 'Ctn')}${p ? ' + ' + num(p) : ''} (${num(q)})`; }
  return `${num(q)} ${esc(l.uName || 'Pcs')}`;
}

// ---------- screen ----------
// v2.83: 📺 COUNTER NAZAR — bill bante waqt har line nigrani wale ko live (liveCarts/<counter>). ⛔ ROKO -> yahan laal, save band.
let liveSig = '', liveTimer = null, liveDoc = null, liveUn = null, liveCounter = '', liveIdleT = null;
const liveLines = () => cart.filter(l => l && l.name).map(l => { const pcs = Number(l.pcs) || 0, ctn = Number(l.ctn) || 0, pack = Number(l.pack) || 0; return { n: String(l.name).slice(0, 60), q: ctn && pack > 1 ? `${num(ctn)} ${l.cName || 'Ctn'}${pcs ? ' + ' + num(pcs) + ' ' + (l.uName || 'Pcs') : ''}` : `${num(pcs)} ${l.uName || 'Pcs'}`, a: lineTotal(l) }; });
function liveSync(force) {
  if (!cloud?.liveCartSet || !counter) return;
  const lines = liveLines(); const sig = counter + '|' + mode + '|' + JSON.stringify(lines);
  if (!force && sig === liveSig) return; liveSig = sig;
  clearTimeout(liveIdleT);
  const empty = !lines.length;
  cloud.liveCartSet(counter, { status: empty ? 'idle' : 'open', mode, lines, n: lines.length, total: cartTotal(), by: uidOf(), byName: byNameOf() }).catch(() => {});
}
const byNameOf = () => { try { return String(nameOf() || (isOwner() ? 'Malik' : '')).slice(0, 40); } catch { return ''; } };
function liveSaved(doc) {
  if (!cloud?.liveCartSet) return;
  const last = [{ saleId: doc.id, token: doc.token || 0, crates: doc.crates || 1, total: doc.total, n: doc.lines?.length || 0, at: Date.now(), byName: byNameOf() }, ...(Array.isArray(liveDoc?.last) ? liveDoc.last : [])].slice(0, 5);
  cloud.liveCartSet(counter, { status: 'saved', saleId: doc.id, token: doc.token || 0, crates: doc.crates || 1, total: doc.total, n: doc.lines?.length || 0, lines: liveLines(), last, byName: byNameOf() }).catch(() => {});
  liveSig = '';
  liveIdleT = setTimeout(() => { if (!cart.length) liveSync(true); }, 12000);
}
function liveWatch() {
  if (liveCounter === counter || !cloud?.listenLiveCart) return;
  try { liveUn?.(); } catch {} liveCounter = counter;
  liveUn = cloud.listenLiveCart(counter, d => { const was = !!liveDoc?.stop; liveDoc = d; if (!!d?.stop !== was) { if (d?.stop) { try { navigator.vibrate?.([200, 100, 200]); } catch {} } rerender(); } });
}
const liveStopped = () => !!liveDoc?.stop && liveDoc.counter === counter;
setInterval(() => { try { if (document.querySelector('.sale-camrow')) { liveWatch(); liveSync(); } } catch {} }, 800);
export function renderSale() {
  installSaleHooks(); watchSales();
  const s = stock();
  const owner = isOwner();
  const total = cartTotal();
  // rate: mulazim ke liye hamesha POS ka rate
  if (!owner) cart.forEach(l => { const it = s.items.find(r => String(r.id) === String(l.id)); if (it) { setStd(l, it); l.edited = false; } });

  // v1.54: godam ke buttons hata diye — bill hamesha main branch se; line ke andar godam badla ja sakta hai
  $('summary').innerHTML = `<div class="stock-head sale-head" data-sale-root="1">
    ${editing ? `<div class="sale-edit-bar"><b>✏️ Bill #${esc(String(editing.saleNo || ''))} edit ho raha hai</b><small>Purana Rs ${num(editing.oldTotal)} · items badlein, phir "Bill badlo" — POS mein wahi bill (number wahi) badlega</small><button type="button" data-sale-edit-x="1">✕ Edit chhoro</button></div>` : ''}
    <div class="account-tools">
      <button class="sale-mode${mode === 'counter' ? ' selected' : ''}" data-sale-mode="counter">🛒 Counter Sale</button>
      <button class="sale-mode${mode === 'wholesale' ? ' selected' : ''}" data-sale-mode="wholesale">📦 Wholesale</button>
    </div>
    <div class="sale-total"><small>${mode === 'wholesale' ? 'Wholesale (W rate)' : 'Counter (R rate)'} · ${num(cart.length)} items</small>
      <strong id="saleTotal">Rs ${num(total)}</strong></div>
    <div class="account-tools">
      <button class="sh-wide" id="saleTodayBtn" data-sale-today="1">${todayLabel()}</button>
    </div>
  </div>`;
  const si = $('search'); if (si) si.placeholder = '📷 scan ya naam / code likhein (Enter)';

  if (s.failed) { $('list').innerHTML = `<div class="empty"><strong>Stock nahi mila</strong><p>${esc(s.failed)}</p></div>`; $('actions').innerHTML = ''; return; }
  if (!s.loaded) { $('list').innerHTML = stockWaitHTML(); $('actions').innerHTML = ''; return; }

  const q = norm(si?.value || '');
  if (liveStopped()) { const b = document.createElement('div'); b.className = 'live-stop'; b.innerHTML = `<b>⛔ Nigrani ne roka</b> — crate camera ko dikhayein. Bill save nahi hoga jab tak clear na ho.${esc(liveDoc.stop.name || '')} ${liveDoc.stop.at ? new Date(liveDoc.stop.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''}${isOwner() ? ' <button type="button" data-live-clear="1">✓ Theek hai</button>' : ''}`; $('list').prepend(b); }
  let found = '';
  const camRow = `<div class="sale-camrow"><button type="button" class="sale-cam${camMissing() ? ' gun' : ''}" data-sale-camera="1" title="${camMissing() ? 'Is PC par camera nahi — scanner gun se scan karein' : 'Camera se barcode scan'}">${camMissing() ? '🔫 Scanner gun' : '📷 Scan'}</button><button type="button" class="sale-mic dm-btn" data-demand="1" title="Demand">📢</button><button type="button" class="sale-mic${vbOn ? ' on' : ''}" data-sale-mic="1" title="Daba kar bolo">${vbOn ? '🎤 Bolein…' : '🎤 Daba kar bolo'}</button><span class="stat-note">Naam likhein ya scan karein</span></div>`;
  if (!q && searchFocused) {   // v1.75: khali search par aksar bikne wale items
    const top = topItems(s.items, 10);
    if (top.length) found = `<div class="sale-found"><p class="stat-note" style="margin:0 0 4px">Aksar bikne wale</p>${top.map(r => `<button type="button" class="sale-hit" data-sale-add="${esc(r.id)}"><b>${esc(r.name)}</b><small>${esc(r.code || '')} · R ${num(r.rate)} · stock ${num(r.stock)}</small></button>`).join('')}</div>`;
  }
  if (q) {
    const codeKey = r => { const c = String(r.code || '').trim(); const n = Number(c); return Number.isFinite(n) && c !== '' ? String(n).padStart(20, '0') : c; };
    const hits = smartSearch(s.items, q, 25);   // v1.75: smart search (spelling, tarteeb, alias, zyada bikne wale pehle)
    found = `<div class="sale-found">${hits.length ? hits.map(r => `<button type="button" class="sale-hit" data-sale-add="${esc(r.id)}">
        <b>${esc(r.name)}</b><small>${esc(r.code || '')} · R ${num(r.rate)}${r.wrate ? ' · W ' + num(r.wrate) : ''} · stock ${num(r.stock)}${Number(r.pack) > 1 ? ' · 1 ' + esc(r.cName || 'Ctn') + ' = ' + num(r.pack) : ''}</small>
      </button>`).join('') : '<p class="stat-note">Koi item nahi mila</p>'}</div>`;
  }

  const rows = cart.map((l, i) => [l, i]).reverse().map(([l, i]) => {   // v2.33: nayi line upar (index wahi — baqi code waisa)
    const lg = Number(l.godam) || s.pick;
    const it = itemIn(lg, l.id) || s.items.find(r => String(r.id) === String(l.id));
    const pcs = linePcs(l), short = it && pcs > Number(it.stock), block = short && lg !== SALE_BRANCH;   // v1.72: godam mein rok
    const gsel = s.branches.filter(b => b !== 0).length > 1 ? `<div class="sale-lgc"><small>Godam</small>${s.branches.filter(b => b !== 0).map(b => `<button type="button" data-sale-lgc="${i}:${b}" title="${esc(s.branchName(b, s.names))}"${b === lg ? ' class="on"' : ''}>${gLabel(b)}</button>`).join('')}</div>` : '';   // v2.95: chips
    return `<div class="sale-line${linePcs(l) < 0 ? ' neg' : ''}${i === cart.length - 1 && Date.now() - lastAddAt < 1800 ? ' fresh' : ''}" data-sale-line="${i}">
      <div class="sale-line-top"><b>${esc(l.name)}</b><button type="button" class="danger sale-x" data-sale-del="${i}" aria-label="Hatao">✕</button></div>
      <small>${esc(l.code)}${it ? ' · stock ' + num(it.stock) + ' (' + esc(s.branchName(lg, s.names)) + ')' : ''}${block ? ' · <b class="red">⛔ godam mein stock nahi — godam badlein</b>' : short ? ' · <span class="red">stock kam hai</span>' : ''}</small>
      <div class="sale-inputs">
        <label>${esc(l.uName)}<input type="number" step="any" inputmode="decimal" data-sale-pcs="${i}" value="${l.pcs || ''}"></label>
        ${Number(l.pack) > 1 ? `<label>${esc(l.cName)} (${num(l.pack)})<input type="number" step="1" inputmode="numeric" data-sale-ctn="${i}" value="${l.ctn || ''}"></label>` : ''}
        <button type="button" class="sale-neg${linePcs(l) < 0 ? ' on' : ''}" data-sale-neg="${i}" title="Wapsi (minus)">${linePcs(l) < 0 ? '↩ Wapsi' : '± Wapsi'}</button>
        <label>Rate${l.edited ? ' ✎' : ''}<input type="number" min="0" step="any" inputmode="decimal" data-sale-rate="${i}" value="${l.rate}"${owner ? '' : ' readonly'}></label>
        ${gsel}
        ${Number(l.pack) > 1 && Math.abs(crateOf(l) - (Number(l.rate) || 0)) > 0.004 ? `<small class="sale-crate">${esc(l.cName)} rate ${num(r2(crateOf(l) * Number(l.pack)))}</small>` : ''}
        <div class="sale-amt"><small>${num(pcs)} ${esc(l.uName)}</small><b id="saleAmt${i}">${num(lineTotal(l))}</b></div>
      </div>
    </div>`;
  }).join('');

  const due = r2(total - cashNow());
  const pay = cart.length ? `<div class="sale-pay">
      <label>${mode === 'wholesale' ? 'Cash mila (baqi whole sale khate mein udhaar)' : 'Cash mila'}
        <input type="number" min="0" step="any" inputmode="decimal" data-sale-cash="1" value="${cashNow()}"></label>
      <p id="saleDue" class="stat-note">${dueText(due)}</p>
      <label>Note (ikhtiyari)<input maxlength="100" data-sale-note="1" value="${esc(note)}"></label>
    </div>` : '';

  $('list').innerHTML = camRow + found + (cart.length ? `<div class="sale-cart">${rows}</div>${pay}${copyChips()}` :
    (q ? '' : `<div class="empty"><strong>Naya bill</strong><p>Upar item ka naam likhein ya 📷 se scan karein.</p></div>`));
  if (Date.now() - lastAddAt < 1800 && lastAddAt !== lastScrolled) { lastScrolled = lastAddAt; requestAnimationFrame(() => keepScan(document.querySelector('.sale-line.fresh'))); }   // scan box upar rahe (nayi line us ke neeche)
  $('actions').innerHTML = cart.length ? `<button class="give" data-sale-clear="1">✕ Naya bill</button><button data-sale-camera="1" title="Barcode scan">${camMissing() ? '🔫' : '📷'}</button>
    <button class="got" data-sale-save="1"${saving ? ' disabled' : ''}>${saving ? 'Save ho raha hai…' : (editing ? '✏️ Bill badlo · Rs ' : '💾 Save + Print · Rs ') + num(total)}</button>` : '';
}
function dueText(due) {
  if (cartTotal() < 0) return `<b class="red">↩ Wapsi bill — customer ko Rs ${num(-cartTotal())} wapas</b>`;   // v2.95
  if (mode === 'wholesale') return due > 0 ? `Udhaar: Rs ${num(due)}` : due < 0 ? `<span class="red">Cash bill se zyada hai (Rs ${num(-due)})</span>` : 'Poora cash';
  return due > 0 ? `<span class="red">Rs ${num(due)} kam hain — counter sale mein poora cash chahiye</span>` : due < 0 ? `Wapas dein: Rs ${num(-due)}` : '';
}
function refreshTotals() {
  const total = cartTotal();
  const t = $('saleTotal'); if (t) t.textContent = 'Rs ' + num(total);
  cart.forEach((l, i) => { const a = $('saleAmt' + i); if (a) a.textContent = num(lineTotal(l)); });
  const c = document.querySelector('[data-sale-cash]');
  if (c && cash == null && document.activeElement !== c) c.value = total;
  const d = $('saleDue'); if (d) d.innerHTML = dueText(r2(total - cashNow()));
  const b = document.querySelector('[data-sale-save]'); if (b && !saving) b.textContent = (editing ? '✏️ Bill badlo · Rs ' : '💾 Save + Print · Rs ') + num(total);
}

// ---------- events ----------
document.addEventListener('input', e => {
  const t = e.target; if (!t.closest?.('#list')) return;
  let i;
  if ((i = t.dataset.saleCtn) != null) { cart[i].ctn = Math.trunc(Number(t.value) || 0); cash = null; }   // v2.95: minus bhi
  else if ((i = t.dataset.salePcs) != null) { cart[i].pcs = Number(t.value) || 0; cash = null; }
  else if ((i = t.dataset.saleRate) != null) { if (!isOwner()) return; cart[i].rate = Math.max(0, Number(t.value) || 0); cart[i].crate = cart[i].rate; cart[i].edited = cart[i].rate !== cart[i].std; cash = null; }   // malik ka apna rate: carton par bhi wohi
  else if (t.dataset.saleCash != null) { cash = t.value === '' ? 0 : Math.max(0, Number(t.value) || 0); }
  else if (t.dataset.saleNote != null) { note = t.value.slice(0, 100); }
  else return;
  keepDraft(); refreshTotals();
});

document.addEventListener('change', e => {
  const t = e.target; if (t.dataset?.saleLg == null) return;
  const l = cart[t.dataset.saleLg]; if (!l) return;
  l.godam = Number(t.value);
  const it = itemIn(l.godam, l.id);
  if (it && !l.edited) setStd(l, it);
  cash = null; keepDraft(); rerender();
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || e.target?.id !== 'search' || !document.querySelector('[data-sale-root]')) return;
  const v = e.target.value.trim(); if (!v) return;
  e.preventDefault();
  const { items } = stock();
  let it = findByCode(items, v); const byCode = !!it;   // v2.55: barcode se mila to sub-barcode ki tadad (500gm = 0.5) bhi
  if (!it) { const hs = smartSearch(items, v, 2); if (hs.length === 1) it = hs[0]; }
  if (!it) {
    const q = norm(v);
    const hits = items.filter(r => norm(r.name).includes(q) || norm(r.code).includes(q));
    if (hits.length === 1) it = hits[0];
  }
  if (!it) { notice('Ek item nahi mila — list se chunein'); return; }
  const q0 = byCode ? subQty(it, v) : 1; addItem(it, q0); e.target.value = ''; notice(`✓ ${it.name}${q0 !== 1 ? ' — ' + q0 : ''}`); rerender();
  setTimeout(() => qtyPad(cart.length - 1), 60);
});

document.addEventListener('pointerdown', e => { const m = e.target.closest?.('[data-sale-mic]'); if (!m) return; e.preventDefault(); try { m.setPointerCapture?.(e.pointerId); } catch {} vbStart(); });
document.addEventListener('pointerup', e => { if (e.target.closest?.('[data-sale-mic]') || vbHold) vbRelease(); });
document.addEventListener('pointercancel', () => vbRelease());
document.addEventListener('contextmenu', e => { if (e.target.closest?.('[data-sale-mic]')) e.preventDefault(); });
document.addEventListener('click', async e => {
  const mic = e.target.closest?.('[data-sale-mic]');
  if (mic) { if (!vbOn && !vbHold) notice('🎤 Button DABA KAR RAKHEIN, item bolein, phir chhor dein — line lag jayegi'); return; }   // v2.94.0: hold se chalta hai
  const t = e.target.closest?.('[data-sale-mode],[data-sale-godam],[data-sale-add],[data-sale-del],[data-sale-clear],[data-sale-save],[data-sale-today],[data-sale-reprint],[data-sale-camera],[data-sale-lgc],[data-sale-neg],[data-sale-edit-x]');
  if (!t) return;
  if (t.dataset.saleEditX) { if (confirm('Edit chhor dein? Bill waisa hi rahega.')) cancelEdit(); return; }
  if (t.dataset.saleLgc) { const [i, b] = t.dataset.saleLgc.split(':'); const l = cart[Number(i)]; if (l) setLineGodam(l, b); return; }
  if (t.dataset.saleNeg != null) { const l = cart[Number(t.dataset.saleNeg)]; if (l) { if (!(Number(l.pcs) || Number(l.ctn))) l.pcs = 1; l.pcs = -(Number(l.pcs) || 0); l.ctn = -(Number(l.ctn) || 0); cash = null; keepDraft(); rerender(); } return; }
  if (t.dataset.saleMode) {
    if (mode === t.dataset.saleMode) return;
    if (editing) { notice('Edit mein Counter / Wholesale nahi badalta (party wahi rehti hai)'); return; }
    mode = t.dataset.saleMode;
    const { items } = stock();
    cart.forEach(l => { const it = items.find(r => String(r.id) === String(l.id)); if (it && (!l.edited || !isOwner())) { setStd(l, it); l.edited = false; } });
    cash = null; keepDraft(); rerender(); return;
  }
  if (t.dataset.saleGodam) {
    if (cart.length && !confirm('Godam badalne par bill ke rate us godam ke hisaab se lagenge. Theek hai?')) return;
    godam = Number(t.dataset.saleGodam);
    const { items } = stock();
    cart = cart.filter(l => items.some(r => String(r.id) === String(l.id)));
    cart.forEach(l => { const it = items.find(r => String(r.id) === String(l.id)); if (!l.edited && it) setStd(l, it); });
    keepDraft(); rerender(); return;
  }
  if (t.dataset.saleAdd) {
    const it = stock().items.find(r => String(r.id) === t.dataset.saleAdd);
    if (it) { addItem(it); const s = $('search'); if (s) s.value = ''; rerender(); setTimeout(() => qtyPad(cart.length - 1), 60); }
    return;
  }
  if (t.dataset.saleDel != null) { cart.splice(Number(t.dataset.saleDel), 1); cash = null; keepDraft(); rerender(); return; }
  if (t.dataset.saleClear) { if (!confirm(editing ? 'Edit chhor dein? Bill waisa hi rahega.' : 'Yeh bill saaf kar dein?')) return; editing = null; cart = []; cash = null; note = ''; mode = 'counter'; godam = SALE_BRANCH; keepDraft(); rerender(); return; }   // v2.63: Naya bill = Counter
  if (t.dataset.saleCamera) { openSaleCamera(); return; }
  if (t.dataset.saleToday) { openToday(); return; }
  if (t.dataset.saleReprint) {
    try { t.disabled = true; const c = Number(prompt('Kitni dafa chhapein? (1-3)', String(copies))) || 1; await cloud.reprintAppSale(t.dataset.saleReprint, Math.min(3, Math.max(1, c)), counter); notice('Print ka hukam PC ko bhej diya (×' + Math.min(3, Math.max(1, c)) + ')'); }
    catch (err) { notice('Nahi hua: ' + (err?.message || err)); t.disabled = false; }
    return;
  }
  if (t.dataset.saleSave) save();
});
// chhota modal (app.js ka modal yahan nahi milta)
function saleModal(title, html) {
  const d = $('dialog'); if (!d) return null;
  d.classList.remove('search-dialog');
  $('dialogTitle').textContent = title;
  $('dialogBody').innerHTML = html;
  if (!d.open) d.showModal();
  return d;
}
// Item chunne par tadad ka pad (keyboard ke baghair) — scanner wale pad jaisa
function qtyPad(i) {
  const l = cart[i]; if (!l) return;
  const pack = Number(l.pack) || 0;
  const row = (unit, vals) => vals.map(v => `<button type="button" data-qp="${unit}:${v}">${v === '+1' ? '+1' : v}</button>`).join('');
  saleModal(`${l.name}${l.label ? ' · ' + l.label : ''}`, `<div class="qtypad">
    <div class="qtypad-now" id="qpNow">${num(l.pcs || 0)} ${esc(l.uName)}${pack > 1 && l.ctn ? ' · ' + num(l.ctn) + ' ' + esc(l.cName) : ''}</div>
    <div class="qtypad-lab">${esc(l.uName)}</div><div class="qtypad-row">${row('pcs', [1, 2, 3, 6, 12, 24, '+1'])}</div>
    ${pack > 1 ? `<div class="qtypad-lab">${esc(l.cName)} (1 = ${num(pack)})</div><div class="qtypad-row">${row('ctn', [1, 2, 3, 5, 10, '+1'])}</div>` : ''}
    <div class="qtypad-row"><button type="button" class="got" data-qp="done">✓ Theek hai</button><button type="button" class="danger" data-qp="del">✕ Hatao</button></div>
  </div>`);
  $('dialogBody').onclick = e => {
    const b = e.target.closest('[data-qp]'); if (!b) return;
    const v = b.dataset.qp;
    if (v === 'done') { $('dialog').close(); rerender(); return; }
    if (v === 'del') { cart.splice(i, 1); cash = null; keepDraft(); $('dialog').close(); rerender(); return; }
    const [unit, val] = v.split(':');
    if (val === '+1') l[unit] = (Number(l[unit]) || 0) + 1; else l[unit] = Number(val);
    cash = null; keepDraft();
    $('qpNow').textContent = `${num(l.pcs || 0)} ${l.uName}${pack > 1 && l.ctn ? ' · ' + num(l.ctn) + ' ' + l.cName : ''}`;
  };
}
function focusLast() {
  const i = cart.length - 1;
  const box = document.querySelector(`[data-sale-pcs="${i}"]`) || document.querySelector(`[data-sale-ctn="${i}"]`);
  if (box) { box.scrollIntoView({ block: 'center' }); box.focus(); try { box.select(); } catch {} }
}

async function saveEdit(lines, total, paid) {
  const ed = editing; if (!ed) return;
  if (!confirm(`✏️ Bill #${ed.saleNo} badal dein?\nPurana Rs ${num(ed.oldTotal)} → naya Rs ${num(total)}\n${lines.length} lines${ed.credit ? '\n(Wholesale: cash / udhaar wahi rahega)' : ''}`)) return;
  const id = 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const doc = { id, posId: Number(ed.posId), saleNo: String(ed.saleNo || ''), appId: String(ed.appId || ''), mode, lines, total, cash: paid, note: note.trim(), by: uidOf(), byName: byNameOf(), role: isOwner() ? 'owner' : 'staff', status: 'new', at: Date.now(), date: todayStr() };
  saving = true; rerender();
  try {
    const p = cloud.saveSaleEdit(doc);
    await Promise.race([p, new Promise(r => setTimeout(r, 4000))]);
    notice('✏️ Bill #' + ed.saleNo + ' badalne ka hukam PC ko gaya…');
    let un = null; un = cloud.listenSaleEdit?.(id, d => { if (!d) return;
      if (d.status === 'done') { notice('✅ Bill #' + ed.saleNo + ' badal gaya — Rs ' + num(d.total ?? total)); if (ed.posId) lineCache.delete(Number(ed.posId)); try { un?.(); } catch {} }
      else if (d.status === 'failed') { alert('❌ Bill #' + ed.saleNo + ' NAHI badla:\n' + (d.error || '') + '\n\nPOS mein bill waisa hi hai.'); try { un?.(); } catch {} } });
    editing = null; cart = []; cash = null; note = ''; mode = 'counter'; godam = SALE_BRANCH; keepDraft();
    setTimeout(() => scanReload(true), 50);
    p.catch(err => alert('Edit PC tak NAHI gaya: ' + (err?.message || err)));
  } catch (err) { notice('Nahi hua: ' + (err?.message || err)); }
  finally { saving = false; rerender(); }
}
async function save() {
  if (saving) return;
  if (liveStopped()) { notice('⛔ Nigrani ne roka hai — pehle crate dikhayein, clear hone ke baad save hoga'); try { navigator.vibrate?.(300); } catch {} return; }   // v2.83
  // v1.61: carton aur khule piece ke rate alag hon to POS ko DO lines (unit 'ctn' / 'pcs'), warna ek line
  const lines = [];
  let emptyLines = 0;
  cart.forEach(l => {
    const base = { id: String(l.id), code: String(l.code || ''), name: String(l.name || ''), pack: Number(l.pack) || 0,
      cName: l.cName, uName: l.uName, godam: gate > 0 && !editing ? gate : (Number(l.godam) || Number(godam) || SALE_BRANCH) };   // v2.89: gate switch · v2.95: edit mein line ka apna godam
    const cq = ctnPcsOf(l), pq = r3(Number(l.pcs) || 0), cr = r2(crateOf(l)), pr = r2(l.rate);
    if (Math.abs(cq + pq) < 0.0005 && !cq) { emptyLines++; return; }   // v2.95: minus (wapsi) lines bhi chalti hain
    if (cq && pq && Math.abs(cr - pr) > 0.004) {
      lines.push({ ...base, unit: 'ctn', qty: cq, rate: cr, std: r2(l.cstd ?? l.std) });
      lines.push({ ...base, unit: 'pcs', qty: pq, rate: pr, std: r2(l.std) });
    } else if (cq && !pq) lines.push({ ...base, unit: 'ctn', qty: cq, rate: cr, std: r2(l.cstd ?? l.std) });
    else if (!cq) lines.push({ ...base, unit: 'pcs', qty: pq, rate: pr, std: r2(l.std) });
    else lines.push({ ...base, qty: r3(cq + pq), rate: pr, std: r2(l.std) });
  });
  if (!lines.length) { notice('Kisi item ki qty likhein'); return; }
  // v1.72: POS ka qanoon — GODAM (branch 1 NOOR TRADERS ke ilawa) mein stock tadad se kam ho to sale nahi (dukaan par rok nahi)
  const s2 = stock();
  const shortG = [];
  for (const l of cart) {
    const g = Number(l.godam) || Number(godam) || SALE_BRANCH;
    if (g === SALE_BRANCH || editing) continue;   // v2.95: edit — purane bill ka stock pehle hi kat chuka (PC khud jaanchta hai)
    const need = linePcs(l); if (!(need > 0)) continue;
    const it = itemIn(g, l.id);
    const have = it ? Number(it.stock) || 0 : 0;
    if (have < need - 0.0005) shortG.push(`${l.name}: ${s2.branchName(g, s2.names)} mein stock ${num(have)}, chahiye ${num(need)}`);
  }
  if (shortG.length) { alert('Godam mein stock kam hai — sale nahi ban sakti:\n\n' + shortG.join('\n') + '\n\nGodam badlein (NOOR TRADERS par rok nahi).'); return; }
  if (emptyLines && !confirm('Jin items ki qty khali hai woh bill mein nahi jayenge. Theek hai?')) return;
  if (lines.some(l => !(l.rate > 0)) && !confirm('Kisi item ka rate 0 hai. Phir bhi save karein?')) return;
  const total = r2(lines.reduce((n, l) => n + l.qty * l.rate, 0));
  if (Math.abs(total) < 0.005) { notice('Bill ka total 0 hai — kuch qty badlein'); return; }
  let paid = r2(cashNow());
  if (total < 0) paid = mode === 'counter' ? total : 0;     // v2.95: wapsi bill — counter: cash wapas, wholesale: khate mein
  else {
  if (mode === 'counter' && paid < total) { notice('Counter sale mein poora cash likhein (ya Wholesale chunein)'); return; }
  if (mode === 'counter') paid = total;                     // POS: counter sale ka CashReceived = bill
  if (paid > total) { notice('Cash bill se zyada nahi ho sakta'); return; }
  }
  if (editing) { await saveEdit(lines, total, paid); return; }   // v2.95: ✏️ POS mein wahi bill badlo
  const msg = `${mode === 'wholesale' ? 'WHOLESALE' : 'COUNTER SALE'}\n${lines.length} items · Rs ${num(total)}` +
    (mode === 'wholesale' ? `\nCash Rs ${num(paid)}${total - paid > 0 ? ' · Udhaar Rs ' + num(total - paid) : ''}` : '') + '\n\nSave karke POS mein bill banayein?';
  if (!quickSave && !confirm(msg)) return;   // v2.57: F5 wala raasta pehle hi pooch chuka
  const id = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  let token = 0; try { token = await Promise.race([cloud.nextToken(todayStr()), new Promise((_, j) => setTimeout(() => j(Error('token der')), 4000))]); } catch { try { const k = 'sam-tok-' + todayStr(); token = Number(localStorage.getItem(k) || 0) + 1; localStorage.setItem(k, String(token)); } catch {} }   // v2.72
  const doc = { id, copies, counter, token: Number(token) || 0, crates: Math.min(20, Math.max(1, crates | 0)), date: todayStr(), at: new Date().toISOString(), mode, branch: SALE_BRANCH, godam: Number(godam) || SALE_BRANCH, gate: gate > 0 ? gate : 0,
    lines, total, cash: paid, note: note.trim(), role: isOwner() ? 'owner' : 'staff', by: uidOf(), status: 'new', createdAt: Date.now() };
  saving = true; rerender();
  try {
    const p = cloud.saveAppSale(doc);
    // internet na ho to bhi phone par mehfooz; net aate hi chali jayegi
    await Promise.race([p, new Promise(r => setTimeout(r, 4000))]);
    try { liveSaved(doc); } catch {}   // v2.83: nazar ko "✓ Bill ban gaya"
    if (counter === 'local') localQueue(doc.id, copies, doc.crates);   // v2.72: bill bante hi isi device par print
    if (isPC(counter) && !pcLive(pcOf(counter))) setTimeout(() => notice('💤 Chuna hua PC abhi band hai / NT-PRINT nahi chal raha — bill ban jayega magar print nahi hoga. Doosra counter chunein.'), 1200);   // v2.78
    crates = 1;
    cart = []; cash = null; note = ''; mode = 'counter'; godam = SALE_BRANCH; keepDraft();   // v2.90: godam wapas NOOR TRADERS · v2.63: Wholesale bill ke baad wapas Counter
    notice('Sale save ho gayi — PC bill bana kar print karega');
    setTimeout(() => { if (!scanNewBill()) { const se = $('search'); if (se) { se.value = ''; se.focus(); } } }, 60);   // v2.59: foran naya bill
    p.catch(err => {
      // server ne mana kar diya: bill wapas screen par le aao (khoye nahi)
      if (!cart.length) {
        mode = doc.mode; note = doc.note; cash = null;
        cart = lines.map(l => ({ id: l.id, code: l.code, name: l.name, pack: l.pack, cName: l.cName, uName: l.uName,
          ctn: 0, pcs: l.qty, rate: l.rate, std: l.std, edited: l.rate !== l.std }));
        keepDraft(); rerender();
      }
      alert('Sale PC tak NAHI gayi: ' + (err?.message || err) + '\nBill wapas screen par hai — dobara Save karein.');
    });
  } catch (err) {
    notice('Sale save nahi hui: ' + (err?.message || err));
  } finally {
    saving = false; rerender();
  }
}

// v1.75: search khali ho aur focus mein aaye to "aksar bikne wale" dikhao
document.addEventListener('focusin', e => { if (e.target?.id === 'search' && document.querySelector('[data-sale-root]') && !searchFocused) { searchFocused = true; if (!e.target.value.trim()) rerender(); } });
document.addEventListener('focusout', e => { if (e.target?.id === 'search' && searchFocused) { searchFocused = false; setTimeout(() => { if (document.querySelector('[data-sale-root]') && !$('search')?.value.trim() && document.activeElement?.id !== 'search') rerender(); }, 250); } });

// v2.57: PC — F5 = "Kitne print?" (1 / 2 / 3 / Enter) -> seedha Save + Print. Mouse ki zaroorat nahi. Esc = wapas.
document.addEventListener('keydown', e => {
  if (e.key !== 'F5' || !document.querySelector('[data-sale-root]')) return;
  e.preventDefault(); e.stopPropagation();
  if (document.getElementById('f5Ask')) return;
  if (!cart.length) { notice('Bill khali hai — pehle item lagayein'); return; }
  const box = document.createElement('div'); box.id = 'f5Ask'; box.className = 'f5-ask';
  box.innerHTML = `<div class="f5-card"><b>🧾 Bill ki kitni copy?</b><small class="f5-tok">🎫 Token parchi alag se khud aati hai</small><small>${cart.length} items · Rs ${num(cartTotal())}</small><div class="f5-ctr">${f5Chips()}${f5Prn()}</div><div class="f5-row">${[1, 2, 3].map(n => `<button type="button" data-f5="${n}"${n === copies ? ' class="on"' : ''}><span>${n}</span>print</button>`).join('')}</div><p>Counter: <kbd>A</kbd> <kbd>B</kbd> <kbd>M</kbd> <kbd>D</kbd> · Print: <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> · <kbd>Enter</kbd> = ${copies} · <kbd>Esc</kbd> = wapas</p></div>`;
  document.body.appendChild(box);
  const done = n => {
    document.removeEventListener('keydown', key, true); box.remove();
    if (!n) return;
    copies = n; try { localStorage.setItem('sam-sale-copies', String(n)); } catch {}
    document.querySelectorAll('[data-sale-copies]').forEach(x => x.classList.toggle('on', Number(x.dataset.saleCopies) === n));
    const b = document.querySelector('[data-sale-save]'); if (!b || b.disabled) { notice('Save abhi nahi ho sakta'); return; }
    { askCrates(() => { quickSave = true; setTimeout(() => { quickSave = false; }, 4000); b.click(); }); return; }   // v2.72 · v2.94.0: har counter (Abdurehman/Bilal/Mithu bhi — sale-post token chhapta hai)
    quickSave = true; setTimeout(() => { quickSave = false; }, 4000); b.click();
  };
  const key = ev => { const ck = { a: 'abdurehman', b: 'bilal', m: 'mithu', d: 'local' }[String(ev.key).toLowerCase()]; if (ck) { ev.preventDefault(); ev.stopPropagation(); setCounter(ck); return; } if (['1', '2', '3'].includes(ev.key)) { ev.preventDefault(); ev.stopPropagation(); done(Number(ev.key)); } else if (ev.key === 'Enter') { ev.preventDefault(); ev.stopPropagation(); done(copies); } else if (ev.key === 'Escape' || ev.key === 'F5') { ev.preventDefault(); ev.stopPropagation(); done(0); } };
  document.addEventListener('keydown', key, true);
  box.addEventListener('click', ev => { const pp = ev.target.closest('[data-f5p]'); if (pp) { setPrinter(pp.dataset.f5p); return; } const cc = ev.target.closest('[data-f5c]'); if (cc) { setCounter(cc.dataset.f5c); const f = box.querySelector('.f5-ctr'); if (f) f.innerHTML = f5Chips() + f5Prn(); return; } const t = ev.target.closest('[data-f5]'); if (t) done(Number(t.dataset.f5)); else if (ev.target === box) done(0); });
}, true);

// v2.62: PC — item lagte hi us ki TADAD badalne ke liye: number likho -> aakhri line ki tadad (0.4 sec ruk kar ya Enter).
// Harf likho = search. Esc = chhoro. Scanner ke tez hindse (barcode) nahi pakarta.
let qtyK = null, qBuf = '', qT0 = 0, qLast = 0, qTimer = null;
function qtyFocusPaint() {
  if (!qtyFocusNext) return;
  if (document.querySelector('#dialog[open]')) return;
  qtyFocusNext = false;
  if (!finePtr.matches || document.querySelector('.scan-box') || !document.querySelector('[data-sale-root]')) return;
  const l = cart[cart.length - 1]; qtyK = l ? l.k : null; qBuf = '';
  document.querySelectorAll('.qty-live').forEach(x => x.classList.remove('qty-live'));
  const i = cart.length - 1, box = document.querySelector(`[data-sale-pcs="${i}"]`) || document.querySelector(`[data-sale-ctn="${i}"]`);
  box?.classList.add('qty-live');
}
new MutationObserver(() => setTimeout(qtyFocusPaint, 0)).observe(document.getElementById('list') || document.body, { childList: true });
function qtyApply() {
  clearTimeout(qTimer); qTimer = null;
  const v = qBuf; qBuf = ''; if (!v) return;
  const fast = v.length >= 4 && (qLast - qT0) / Math.max(1, v.length - 1) < 40; if (fast) return;   // barcode tha
  const i = cart.findIndex(l => l.k === qtyK); if (i < 0) return;
  const n = Number(v); if (!(n >= 0)) return;
  cart[i].pcs = n; cash = null; keepDraft(); rerender(); notice(`✓ ${cart[i].name} — ${n}`);
}
document.addEventListener('keydown', e => {
  if (!finePtr.matches || !qtyK || !document.querySelector('[data-sale-root]') || document.querySelector('.scan-box,#dialog[open]') || e.ctrlKey || e.altKey || e.metaKey) return;
  const a = document.activeElement, se = $('search');
  const free = !a || a === document.body || (a === se && !se.value) || a.matches?.('button');
  if (e.key === 'Escape') { qtyK = null; qBuf = ''; document.querySelectorAll('.qty-live').forEach(x => x.classList.remove('qty-live')); return; }
  if (!free) { if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) { qtyK = null; document.querySelectorAll('.qty-live').forEach(x => x.classList.remove('qty-live')); } return; }
  if (/^[0-9.]$/.test(e.key)) { e.preventDefault(); const now = performance.now(); if (!qBuf) qT0 = now; qLast = now; qBuf += e.key; clearTimeout(qTimer); qTimer = setTimeout(qtyApply, 400); return; }
  if (e.key === 'Enter' && qBuf) { e.preventDefault(); e.stopPropagation(); qtyApply(); return; }
  if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) { qtyK = null; qBuf = ''; document.querySelectorAll('.qty-live').forEach(x => x.classList.remove('qty-live')); }
});

// v2.64: scanner screen ke liye — godam chips aur PC par aaj ke bills
// v2.95.1: HALKA — pehle stock() poore godam ke hazaron items banata tha (har scan line par) -> barcode ruk ruk kar chalta tha
setSaleGodamHook(() => { const st = saleStock(); const cur = st.branches.includes(godam) ? godam : (st.branches.includes(SALE_BRANCH) ? SALE_BRANCH : st.branches[0]);
  return { list: st.branches.filter(b => b !== 0).map(b => { const full = (st.branchName ? st.branchName(b, st.names) : '') || st.names?.[b] || ('Godam ' + b), m = String(full).match(/(\d+)\s*$/);
    return { b, name: b === SALE_BRANCH ? 'NT' : 'G' + (m ? m[1] : String(full).slice(0, 3)), full }; }), cur, set: b => { godam = Number(b); keepDraft(); rerender(); } }; });
// ===== v2.95: 🧾 AAJ KE BILLS — PC + app ek list. Rang: hara = paid, laal = udhaar, grey = cancel / farq.
// 📌 posted / ⏳ un-posted (POS DocStatusID 2 / 1), 💻 kis PC + kisne + kab, "sync X sec pehle". Un-posted = ✏️ edit
// (wahi scan screen par khulta hai; PC sale-post.js POS mein wahi bill badalta hai). 🖨 tamam un-posted ek report mein.
const isFarq = b => /stock\s*['"]?\s*f[ae]?r?a?q/i.test(String(b.p || ''));
const lineCache = new Map(), lineTried = new Set();   // posId -> lines [{i,n,q,r,g}]
const ago = t => { if (!t) return '—'; const s0 = Math.max(0, Math.round((Date.now() - t) / 1000)); return s0 < 45 ? 'abhi' : s0 < 60 ? s0 + ' sec pehle' : s0 < 3600 ? Math.round(s0 / 60) + ' min pehle' : new Date(t).toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit' }); };
// v2.96.2: 📅 bills ka DIN — '' = aaj (live), warna purana din (alag listener). Tarteeb BILL NUMBER (POS SaleID) se — waqt ghalat ho tab bhi jagah sahi.
let billsDay = '', pastSales = [], pastPos = [], pastStop = [], pastDay = '';
const viewDay = () => billsDay || todayStr();
function watchPast() {
  if (!billsDay || billsDay === todayStr()) { billsDay = ''; pastStop.forEach(f => { try { f?.(); } catch {} }); pastStop = []; pastDay = ''; return; }
  if (pastDay === billsDay) return;
  pastStop.forEach(f => { try { f?.(); } catch {} }); pastStop = []; pastSales = []; pastPos = []; pastDay = billsDay;
  try { if (cloud?.listenAppSales) pastStop.push(cloud.listenAppSales(billsDay, list => { pastSales = list || []; billsRepaint(); }, () => {})); } catch {}
  try { if (cloud?.listenPosSales) pastStop.push(cloud.listenPosSales(billsDay, b => { pastPos = Array.isArray(b) ? b : []; billsRepaint(); })); } catch {}
}
const billsData = () => billsDataOf(billsDay ? pastSales : sales, billsDay ? pastPos : posSales);
const salesOfView = () => billsDay ? pastSales : sales;
function billsDataOf(sales, posSales) {
  const posByApp = new Map(posSales.filter(b => b.app).map(b => [b.app, b]));
  const app = sales.map(s => { const pb = posByApp.get(s.id);
    return { id: s.id, src: 'app', saleNo: s.saleNo || pb?.no || '', posId: Number(s.saleId || pb?.id) || 0, total: Number(pb ? pb.t : s.total) || 0, cash: Number(s.cash) || 0,
      credit: s.mode === 'wholesale', status: s.status, error: s.error || '', cancelled: !!pb?.x, ps: pb ? Number(pb.ps) || 0 : 0, farq: false,
      createdAt: s.createdAt || 0, where: '📱 App · ' + String(counterName(s.counter) || '').replace(/^💻 /, ''), by: '', party: '', lines: s.lines || [], edited: !!s.editedAt }; });
  const pos = posSales.filter(b => !b.app).map(b => ({ id: 'pos-' + b.id, src: 'pos', saleNo: b.no, posId: Number(b.id) || 0, total: Number(b.t) || 0, cash: b.cr ? Number(b.c) || 0 : Number(b.t) || 0,
    credit: !!b.cr, status: 'done', cancelled: !!b.x, ps: Number(b.ps) || 0, farq: isFarq(b), createdAt: b.tm || 0, where: '💻 ' + (b.pc || 'POS'), by: b.by || '', party: b.p || '', n: b.n || 0 }));
  const ord = b => b.posId || 9e15;   // POS mein na pohancha (intezar / ghalti) sab se upar
  return [...app, ...pos].sort((a, b) => (ord(b) - ord(a)) || ((b.createdAt || 0) - (a.createdAt || 0)));
}
const billPaid = b => !b.credit || b.cash >= b.total - 0.5;
const billCls = b => b.farq ? 'fq' : b.cancelled ? 'cx' : b.status === 'failed' ? 'fl' : (b.status === 'new' || b.status === 'posting') ? 'wt' : billPaid(b) ? 'pd' : 'up';
const billIcon = { fq: '🧮', cx: '⊘', fl: '⚠', wt: '⏳', pd: '✓', up: '✗' };
// v2.95.2: nishan = POST haal — ✓ posted, ○ (khali) un-posted; rang = paid (hara) / udhaar (laal)
const psIcon = (b, c) => (c === 'fq' || c === 'cx' || c === 'fl' || c === 'wt') ? billIcon[c] : b.ps === 2 ? '✓' : b.ps === 1 ? '' : '•';
const canEditBill = b => !b.cancelled && !b.farq && b.ps === 1 && b.posId > 0 && (b.src === 'pos' || b.status === 'done');
async function billLines(b) {
  if (b.posId && lineCache.has(b.posId)) return lineCache.get(b.posId);
  if (b.posId && cloud?.getPosSaleLines) { try { const L = await cloud.getPosSaleLines(b.posId); if (L && L.length) { lineCache.set(b.posId, L); return L; } } catch {} lineTried.add(b.posId); }
  return (b.lines || []).map(l => ({ i: Number(l.id), n: l.name, q: Number(l.qty) || 0, r: Number(l.rate) || 0, g: Number(l.godam) || SALE_BRANCH }));
}
const mounts = new Set();
function billsRepaint() { for (const m of [...mounts]) { if (!m.box.isConnected) { mounts.delete(m); continue; } m.paint(); } const b = $('saleTodayBtn'); if (b) b.textContent = todayLabel(); }
const FILTERS = [['all', 'Sab'], ['un', '○ Un-posted'], ['po', '✓ Posted'], ['pd', '🟢 Paid'], ['up', '🔴 Udhaar'], ['pc', '💻 PC'], ['app', '📱 App']];
function mountBills(box) {
  let open = '', filter = 'all';
  try { filter = localStorage.getItem('sam-bills-f') || 'all'; } catch {}
  box.classList.add('nb-wrap');
  box.innerHTML = `<div class="nb-head"><span class="nb-day"><button type="button" data-nb-day="-1" title="Pichhla din">‹</button><b class="nb-dayt"></b><button type="button" data-nb-day="1" title="Agla din">›</button><label class="nb-cal" title="Tareekh chunein">📅<input type="date" class="nb-date"></label></span><small class="nb-sync"></small></div>
    <div class="nb-top"><input type="search" class="nb-q" placeholder="🔍 Bill no, naam, raqam…" autocomplete="off"><button type="button" class="nb-unp" data-nb-unp="1">🖨 Un-posted</button></div>
    <div class="nb-f"></div><div class="nb-sum"></div><div class="nb-list"></div>`;
  const dayT = box.querySelector('.nb-dayt'), dateIn = box.querySelector('.nb-date');
  const q = box.querySelector('.nb-q'), list = box.querySelector('.nb-list'), fbox = box.querySelector('.nb-f'), sum = box.querySelector('.nb-sum'), syncEl = box.querySelector('.nb-sync'), unpBtn = box.querySelector('.nb-unp');
  const paint = () => {
    watchPast();
    const vd = viewDay(), isToday = !billsDay, D = new Date(vd + 'T12:00:00');
    const yd = (() => { const t = new Date(); t.setDate(t.getDate() - 1); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; })();
    dayT.innerHTML = `🧾 Bills · ${['Itwar', 'Pir', 'Mangal', 'Budh', 'Jumerat', 'Juma', 'Hafta'][D.getDay()]} ${D.getDate()} ${D.toLocaleString('en-US', { month: 'short' })}${isToday ? ' <em>aaj</em>' : vd === yd ? ' <em class="old">kal</em>' : ' <em class="old">purana</em>'}`;
    dateIn.value = vd; dateIn.max = todayStr(); box.querySelector('[data-nb-day="1"]').disabled = isToday;
    box.classList.toggle('nb-past', !isToday);
    const all = billsData();
    const t = String(q.value || '').trim().toLowerCase(), dg = t.replace(/[^0-9]/g, '');
    const pass = b => filter === 'all' || (filter === 'pd' && billCls(b) === 'pd') || (filter === 'up' && billCls(b) === 'up') || (filter === 'un' && b.ps === 1 && !b.cancelled) || (filter === 'po' && b.ps === 2) || (filter === 'pc' && b.src === 'pos') || (filter === 'app' && b.src === 'app');
    const rows = all.filter(b => pass(b) && (!t || smartHit(`${b.saleNo || ''} ${b.party || ''} ${b.where || ''} ${b.by || ''}`, t) || (dg.length >= 2 && String(Math.round(Math.abs(b.total))).startsWith(dg))));
    const cnt = k => all.filter(b => k === 'all' || (k === 'pd' && billCls(b) === 'pd') || (k === 'up' && billCls(b) === 'up') || (k === 'un' && b.ps === 1 && !b.cancelled) || (k === 'po' && b.ps === 2) || (k === 'pc' && b.src === 'pos') || (k === 'app' && b.src === 'app')).length;
    fbox.innerHTML = FILTERS.map(([k, n]) => `<button type="button" data-nb-f="${k}" class="${filter === k ? 'on' : ''}">${n} <em>${cnt(k)}</em></button>`).join('');
    const live = rows.filter(b => !b.cancelled && !b.farq);
    const tot = live.reduce((n, b) => n + b.total, 0), udh = live.filter(b => billCls(b) === 'up').reduce((n, b) => n + (b.total - b.cash), 0);
    sum.innerHTML = `${num(rows.length)} bills · <b>Rs ${num(tot)}</b>${udh > 0.5 ? ` · <span class="red">udhaar Rs ${num(udh)}</span>` : ''}`;
    const un = all.filter(b => b.ps === 1 && !b.cancelled && !b.farq).length; unpBtn.textContent = `🖨 Un-posted ${un}`; unpBtn.title = `${un} un-posted bills ka print`; unpBtn.disabled = !un;
    syncEl.innerHTML = posSyncAt ? `🔄 PC sync ${ago(posSyncAt)}` : '';
    syncEl.className = 'nb-sync' + (posSyncAt && Date.now() - posSyncAt > 90000 ? ' old' : '');
    list.innerHTML = rows.map(b => { const c = billCls(b), bd = new Date(b.createdAt || 0), bds = `${bd.getFullYear()}-${String(bd.getMonth() + 1).padStart(2, '0')}-${String(bd.getDate()).padStart(2, '0')}`;
      const tm0 = bd.toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit' }), tm = !b.createdAt || bds === vd ? tm0 : `<b class="nb-odd">${bds === yd ? 'kal' : bd.getDate() + ' ' + bd.toLocaleString('en-US', { month: 'short' })} ${tm0}</b>`;
      const L = open === b.id ? (b.posId && lineCache.get(b.posId)) || (b.src === 'app' ? (b.lines || []).map(l => ({ n: l.name, q: l.qty, r: l.rate })) : null) : null;
      return `<div class="nb-bill ${c}${open === b.id ? ' open' : ''}" data-nb="${esc(b.id)}">
        <div class="nb-row"><i class="${b.ps === 1 && !b.cancelled ? 'unp' : b.ps === 2 ? 'pst' : ''}">${psIcon(b, c)}</i><b class="nb-no">${b.saleNo ? esc(String(b.saleNo).replace(/^0+(?=\d{4})/, '')) : (b.credit ? 'Wholesale' : 'Counter')}</b><b class="nb-amt">${num(b.total)}</b>
          <small class="nb-meta">${esc(b.where)}${b.by ? ' · ' + esc(b.by) : ''} · ${tm}${b.party && !/counter\s*sale/i.test(b.party) ? ' · ' + esc(b.party) : ''}</small><span class="nb-tags">${b.ps === 2 ? '<u class="ps2">✓ Posted</u>' : b.ps === 1 && !b.cancelled ? '<u class="ps1">○ Un-posted</u>' : ''}${b.farq ? '<u>farq</u>' : ''}${b.edited ? '<u>✏️</u>' : ''}${c === 'up' ? '<u class="ud">udhaar</u>' : ''}</span></div>
        ${open === b.id ? `<div class="nb-det">${b.status === 'failed' ? `<p class="red">⚠ ${esc(b.error)}</p>` : ''}${L ? L.map(l => `<p><span>${esc(l.n)}</span><span>${num(l.q)} × ${num(l.r)} = <b>${num(r2(l.q * l.r))}</b></span></p>`).join('') : (b.posId && lineTried.has(b.posId) ? '<p class="stat-note">Items abhi PC se nahi aaye (PC sync chalu hai?) — thori dair baad kholein</p>' : '<p class="stat-note">Items aa rahe hain…</p>')}
          <p class="nb-pay">${b.credit ? `Cash Rs ${num(b.cash)}${b.total - b.cash > 0.5 ? ` · <b class="red">Udhaar Rs ${num(b.total - b.cash)}</b>` : ''}` : 'Cash · poora'}</p>
          <div class="nb-acts">${canEditBill(b) ? `<button type="button" class="nb-edit" data-nb-edit="${esc(b.id)}">✏️ Edit</button>` : b.ps === 2 ? '<small>📌 Post ho chuka — edit band</small>' : ''}${b.src === 'app' && b.status === 'done' ? `<button type="button" data-nb-print="${esc(b.id)}">🖨 Dobara print</button>` : ''}</div></div>` : ''}
      </div>`; }).join('') || '<p class="stat-note">Koi bill nahi</p>';
  };
  q.oninput = paint;
  const goDay = v => { open = ''; billsDay = !v || v >= todayStr() ? '' : v; billsRepaint(); };
  dateIn.addEventListener('change', () => goDay(dateIn.value));
  box.addEventListener('click', async e => {
    const dd = e.target.closest('[data-nb-day]'); if (dd) { const t = new Date(viewDay() + 'T12:00:00'); t.setDate(t.getDate() + Number(dd.dataset.nbDay)); goDay(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`); return; }
    const f = e.target.closest('[data-nb-f]'); if (f) { filter = f.dataset.nbF; try { localStorage.setItem('sam-bills-f', filter); } catch {} paint(); return; }
    if (e.target.closest('[data-nb-unp]')) { printUnposted(); return; }
    const ed = e.target.closest('[data-nb-edit]'); if (ed) { e.stopPropagation(); const b = billsData().find(x => x.id === ed.dataset.nbEdit); if (b) editBill(b); return; }
    const pr = e.target.closest('[data-nb-print]'); if (pr) { e.stopPropagation(); const sl = salesOfView().find(x => x.id === pr.dataset.nbPrint); try { if (counter === 'local' && sl) printLocal(sl, copies, sl.crates || 1); else { await cloud.reprintAppSale(pr.dataset.nbPrint, copies, counter); notice('🖨 Print ka hukam bhej diya'); } } catch (er) { notice('Print nahi hua: ' + (er?.message || er)); } return; }
    const c = e.target.closest('[data-nb]'); if (!c) return;
    open = open === c.dataset.nb ? '' : c.dataset.nb; paint();
    if (open) { const b = billsData().find(x => x.id === open); if (b && b.posId && !lineCache.has(b.posId)) { lineTried.delete(b.posId); await billLines(b); paint(); } }
  });
  const m = { box, paint }; mounts.add(m); paint();
  return setInterval(() => { if (!box.isConnected) return; syncEl.innerHTML = posSyncAt ? `🔄 PC sync ${ago(posSyncAt)}` : ''; syncEl.className = 'nb-sync' + (posSyncAt && Date.now() - posSyncAt > 90000 ? ' old' : ''); }, 5000);
}
setSaleBillsHook(box => mountBills(box));   // PC scan screen ka baayan hissa
// v2.96.2: raat 12 ke baad screen khuli rahe to bhi naya din khud (pehle refresh tak kal ki list rehti thi)
setInterval(() => { if (salesDay && salesDay !== todayStr()) { watchSales(); if (billsDay && billsDay >= todayStr()) billsDay = ''; billsRepaint(); } }, 60000);

// ✏️ un-posted bill -> wahi scan screen par items ke saath. Save = PC (sale-post) POS mein ISI bill ko badalta hai.
async function editBill(b) {
  if (!canEditBill(b)) { notice(b.ps === 2 ? '📌 Bill post ho chuka — edit nahi ho sakta' : 'Ye bill edit nahi ho sakta'); return; }
  if (cart.length && !editing && !confirm('Screen par abhi wala bill hat jayega. Bill #' + b.saleNo + ' edit karein?')) return;
  notice('✏️ Bill #' + b.saleNo + ' khul raha hai…');
  const L = await billLines(b);
  if (!L.length) { notice('Is bill ke items nahi mile — 1 minute baad dobara koshish karein'); return; }
  const owner = isOwner();
  cart = L.map(x => { const g = Number(x.g) || SALE_BRANCH, it = itemIn(g, x.i) || itemIn(SALE_BRANCH, x.i); const std = it ? rateFor(it, b.credit ? 'wholesale' : 'counter') : Number(x.r) || 0;
    return { k: newKey(), id: String(x.i), code: it?.code || '', name: it?.name || x.n, pack: Number(it?.pack) || 0, cName: it?.cName || 'Ctn', uName: it?.uName || 'Pcs', godam: g,
      ctn: 0, pcs: Number(x.q) || 0, rate: Number(x.r) || 0, std, crate: Number(x.r) || 0, cstd: it ? crateFor(it, b.credit ? 'wholesale' : 'counter') : Number(x.r) || 0, edited: owner && Math.abs((Number(x.r) || 0) - std) > 0.004 }; });
  mode = b.credit ? 'wholesale' : 'counter'; cash = b.credit ? b.cash : null; note = '';
  editing = { posId: b.posId, saleNo: b.saleNo, appId: b.src === 'app' ? b.id : '', credit: b.credit, oldTotal: b.total };
  keepDraft();
  if ($('dialog')?.open && $('dialogTitle')?.textContent.startsWith('🧾')) $('dialog').close();
  rerender(); setTimeout(() => scanReload(), 80);
}
function cancelEdit() { editing = null; cart = []; cash = null; note = ''; mode = 'counter'; godam = SALE_BRANCH; keepDraft(); rerender(); setTimeout(() => scanReload(true), 50); }

// 🖨 tamam un-posted bills EK report mein (har bill alag hissa: no, PC, kisne, waqt, items, raqam) — PDF kholo / bhejo / print
async function printUnposted() {
  const L = billsData().filter(b => b.ps === 1 && !b.cancelled && !b.farq).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  if (!L.length) { notice('Koi un-posted bill nahi'); return; }
  notice('🖨 ' + L.length + ' un-posted bills ki report ban rahi hai…');
  if (cloud?.listPosSaleLines) { try { const all = await cloud.listPosSaleLines(viewDay()); all.forEach(d => { if (d.id && Array.isArray(d.lines)) lineCache.set(Number(d.id), d.lines); }); } catch {} }
  for (const b of L) if (b.posId && !lineCache.has(b.posId)) await billLines(b);
  const kul = L.reduce((n, b) => n + b.total, 0), udh = L.filter(b => !billPaid(b)).reduce((n, b) => n + (b.total - b.cash), 0);
  const html = `<h1>NOOR TRADERS</h1><h2>⏳ Un-posted bills — ${esc(new Date().toLocaleDateString('en-GB'))}</h2>
    <p>${L.length} bills · Kul <b>Rs ${num(kul)}</b>${udh > 0.5 ? ` · Udhaar Rs ${num(udh)}` : ''} · ${esc(new Date().toLocaleTimeString('en-PK'))}</p>
    ${L.map(b => { const lines = (b.posId && lineCache.get(b.posId)) || (b.lines || []).map(l => ({ n: l.name, q: l.qty, r: l.rate }));
      return `<div class="ub-bill"><h3>Bill # ${esc(String(b.saleNo || '-'))} <small>${esc(b.where)}${b.by ? ' · ' + esc(b.by) : ''} · ${esc(new Date(b.createdAt || 0).toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit' }))}${b.party && !/counter\s*sale/i.test(b.party) ? ' · ' + esc(b.party) : ''}</small></h3>
      <table class="iv-tbl"><thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Rs</th></tr></thead><tbody>${lines.map(l => `<tr><td>${esc(l.n)}</td><td class="iv-n">${num(l.q)}</td><td class="iv-n">${num(l.r)}</td><td class="iv-n">${num(r2(l.q * l.r))}</td></tr>`).join('')}
      <tr><td colspan="3"><b>KUL</b>${b.credit ? ` · cash ${num(b.cash)}${b.total - b.cash > 0.5 ? ' · udhaar ' + num(b.total - b.cash) : ''}` : ''}</td><td class="iv-n"><b>${num(b.total)}</b></td></tr></tbody></table></div>`; }).join('')}`;
  if (salePdf) salePdf(html, 'Un-posted bills'); else notice('Report nahi khul saki');
}

// ===== v2.72: "🖥 Yehi device" — bill + gate pass + TOKEN parchiyan isi device ke default printer par =====
// Chrome ko --kiosk-printing ke sath kholo (CHROME-SEEDHA-PRINT.bat) to print dabba nahi aata.
function askCrates(go) {
  const box = document.createElement('div'); box.id = 'f5Ask'; box.className = 'f5-ask';
  box.innerHTML = `<div class="f5-card"><b>📦 Kitne crate?</b><small>Har crate ki ek token parchi</small><div class="f5-row">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-cr="${n}"${n === 1 ? ' class="on"' : ''}><span>${n}</span>crate</button>`).join('')}</div><p><kbd>1</kbd>–<kbd>9</kbd> · <kbd>Enter</kbd> = 1 · <kbd>Esc</kbd> = wapas</p></div>`;
  document.body.appendChild(box);
  const done = n => { document.removeEventListener('keydown', key, true); box.remove(); if (n) { crates = n; go(); } };
  const key = ev => { if (/^[1-9]$/.test(ev.key)) { ev.preventDefault(); ev.stopPropagation(); done(Number(ev.key)); } else if (ev.key === 'Enter') { ev.preventDefault(); ev.stopPropagation(); done(1); } else if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); done(0); } };
  setTimeout(() => document.addEventListener('keydown', key, true), 0);
  box.addEventListener('click', ev => { const t = ev.target.closest('[data-cr]'); if (t) done(Number(t.dataset.cr)); else if (ev.target === box) done(0); });
}
const LQ = 'sam-local-print';
function localQueue(id, cp, cr) { try { const q = JSON.parse(localStorage.getItem(LQ) || '{}'); q[id] = { cp, cr, at: Date.now() }; localStorage.setItem(LQ, JSON.stringify(q)); } catch {} }
function localCheck() {
  let q = {}; try { q = JSON.parse(localStorage.getItem(LQ) || '{}'); } catch {}
  let ch = false;
  for (const [id, v] of Object.entries(q)) {
    const sl = sales.find(x => x.id === id);
    if (Date.now() - (v.at || 0) > 30 * 60 * 1000) { delete q[id]; ch = true; continue; }
    if (!sl) continue;
    if (sl.status === 'done' && sl.saleNo) { delete q[id]; ch = true; printLocal(sl, v.cp, v.cr); }
    else if (sl.status === 'failed') { delete q[id]; ch = true; notice('Bill nahi bana — print nahi hua'); }
  }
  if (ch) try { localStorage.setItem(LQ, JSON.stringify(q)); } catch {}
}
function printLocal(sl, cp = 1, cr = 1) {
  const st = stock(), gname = b => (st.branchName ? st.branchName(b, st.names) : '') || st.names?.[b] || ('Godam ' + b);
  const when = new Date(sl.createdAt || Date.now()), d8 = when.toLocaleDateString('en-GB'), tm = when.toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit' });
  const qtxt = l => l.unit === 'ctn' && Number(l.pack) > 1 ? `${num(l.qty / l.pack)} ${esc(l.cName || 'Ctn')}` : `${num(l.qty)} ${esc(l.uName || 'Pcs')}`;
  const lines = Array.isArray(sl.lines) ? sl.lines : [], total = Number(sl.total) || 0, cash = Number(sl.cash) || 0, tok = Number(sl.token) || 0;
  const bill = `<section class="pg bill"><h1>NOOR TRADERS</h1><p class="c">${sl.mode === 'wholesale' ? 'WHOLESALE' : 'COUNTER SALE'}</p><p class="row"><b>Bill # ${esc(sl.saleNo || '')}</b><b>Token ${tok || '-'}</b></p><p class="row"><span>${d8}</span><span>${tm}</span></p><hr>
    ${lines.map(l => `<div class="it"><b>${esc(l.name)}</b><p class="row"><span>${qtxt(l)} × ${num(l.rate)}</span><span>${num(Math.round(l.qty * l.rate))}</span></p></div>`).join('')}<hr>
    <p class="row big"><b>KUL</b><b>Rs ${num(total)}</b></p>${sl.mode === 'wholesale' ? `<p class="row"><span>Cash</span><span>${num(cash)}</span></p>${total - cash > 0.5 ? `<p class="row"><b>Udhaar</b><b>${num(total - cash)}</b></p>` : ''}` : ''}<p class="c sm">Shukriya · Blue Khata</p></section>`;
  const gp = {}; for (const l of lines) { const g = Number(l.godam) || 1; if (sl.gate || g !== Number(sl.branch || 1)) (gp[g] = gp[g] || []).push(l); }   // v2.89: gate switch = har godam ka
  const gates = Object.entries(gp).map(([g, ls]) => `<section class="pg gate"><h1>GATE PASS</h1><p class="c big">${esc(gname(Number(g)))}</p><p class="row"><b>Bill # ${esc(sl.saleNo || '')}</b><b>Token ${tok || '-'}</b></p><p class="row"><span>${d8}</span><span>${tm}</span></p><hr>${ls.map(l => `<p class="row"><span>${esc(l.name)}</span><b>${qtxt(l)}</b></p>`).join('')}<hr><p class="c sm">Maal de kar parchi rakh lein</p></section>`).join('');
  const n = Math.max(1, cr | 0);
  const toks = Array.from({ length: n }, (_, i) => `<section class="pg tok"><p class="tl">TOKEN</p><p class="tn">${tok || '-'}</p><p class="ur" dir="rtl" lang="ur">اس بل کے ${n} کریٹ ہیں</p><p class="tc">Crate ${i + 1} / ${n}</p><p class="row sm"><span>Bill # ${esc(sl.saleNo || '')}</span><span>${tm}</span></p></section>`).join('');
  // v2.77: har hissa ALAG print job (printer har job ke baad khud cut karta hai) — bill copies, gate pass, har crate ka token.
  // Chaurai 68mm (80mm printer asal mein ~72mm chhapta hai — 74mm par kinare kat-te the).
  const CSS = `
    @page{size:80mm auto;margin:2mm 0}*{box-sizing:border-box}body{margin:0 auto;font-family:Arial,Helvetica,sans-serif;color:#000;width:68mm;padding:0 1mm}
    .pg{page-break-after:always;break-after:page;padding:1mm 0}.pg:last-child{page-break-after:auto}
    h1{font-size:20px;text-align:center;margin:0 0 2px}.c{text-align:center;margin:2px 0}.sm{font-size:11px}.big{font-size:16px}
    .row{display:flex;justify-content:space-between;gap:6px;margin:2px 0;font-size:13px}.row.big{font-size:17px}
    .it{margin:3px 0}.it>b{font-size:13px}hr{border:0;border-top:1px dashed #000;margin:4px 0}
    .tok{text-align:center;padding:2mm 0 1mm}.tl{font-size:14px;font-weight:700;letter-spacing:3px;margin:0}.tn{font-size:64px;font-weight:900;line-height:1;margin:2px 0}
    .ur{font-size:24px;font-weight:700;margin:4px 0;font-family:'Noto Nastaliq Urdu','Jameel Noori Nastaleeq','Urdu Typesetting',Tahoma,Arial,sans-serif}.tc{font-size:18px;font-weight:800;margin:2px 0}
  `;
  const parts = h => String(h || '').split('</section>').filter(x => x.trim()).map(x => x + '</section>');
  const jobs = [...Array.from({ length: Math.max(1, cp | 0) }, () => bill), ...parts(gates), ...parts(toks)];
  const one = (body, k) => { const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(f); const w = f.contentWindow; w.document.open(); w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>NT ${k + 1}</title><style>${CSS}</style></head><body>${body}</body></html>`); w.document.close();
    setTimeout(() => { try { w.focus(); w.print(); } catch {} setTimeout(() => f.remove(), 60000); }, 300); };
  jobs.forEach((b, k) => setTimeout(() => one(b, k), k * 1600));
  notice(`🖨 Bill ${sl.saleNo} · token ${tok || '-'} · ${n} parchi — isi device par`);
}
