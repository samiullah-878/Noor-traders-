// sale.js — Nayi Sale (Counter / Wholesale) — v1.79.1
// App sale ko Firestore "appSales" mein "new" likhta hai. POS bill PC ka sale-post.js banata hai
// (POS ke apne procedures se), rasid print karta hai aur Sale No wapas likhta hai.
// Counter = R rate (COUNTER SALE, cash) · Wholesale = W rate ("whole sale" party, udhaar + cash ka CRV)
// Malik rate badal sakta hai; mulazim ka rate fix (PC bhi mulazim ki sale POS ke rate se hi banata hai).

import { saleStock, setSaleScanHook, setSaleQtyHook, setSaleFindHook, setSaleCartHook, setSaleDelHook, openSaleCamera, stockWaitHTML, scanNewBill, setSaleGodamHook, setSaleBillsHook } from './pos-stock.js?v=2.71.0';
import { smartSearch, topItems, noteHit, voiceSearch, fold } from './smart-search.js?v=2.71.0';

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

let cloud = null, rerender = () => {}, notice = () => {}, isOwner = () => false, uidOf = () => '';
let mode = 'counter', godam = null, cart = [], cash = null, note = '', saving = false;
let sales = [], salesDay = '', stopSales = null, salesErr = '';
let searchFocused = false;   // v1.75

export function saleSetup(o) {
  cloud = o.cloud; rerender = o.rerender || rerender; notice = o.notice || notice;
  isOwner = o.owner || isOwner; uidOf = o.uid || uidOf; learnOf = o.learn || learnOf;
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    if (d && d.day === todayStr()) { cart = d.cart || []; mode = cart.length ? (d.mode || 'counter') : 'counter'; godam = d.godam ?? null; cash = d.cash ?? null; note = d.note || ''; }   // v2.63: khali bill = hamesha Counter
  } catch {}
}
function keepDraft() {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ day: todayStr(), mode, godam, cart, cash, note })); } catch {}
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
let quickSave = false, posSales = [], stopPosSales = null;
const COUNTERS = [['abdurehman', 'Abdurehman'], ['bilal', 'Bilal bhai'], ['mithu', 'Mithu']];   // v2.68: kis counter ke printer par bill + gate pass
let counter = 'abdurehman'; try { const c = localStorage.getItem('sam-sale-counter'); if (COUNTERS.some(x => x[0] === c)) counter = c; } catch {}
const counterName = k => (COUNTERS.find(x => x[0] === k) || COUNTERS[0])[1];
const setCounter = k => { if (!COUNTERS.some(x => x[0] === k)) return; counter = k; try { localStorage.setItem('sam-sale-counter', k); } catch {} document.querySelectorAll('[data-sale-counter]').forEach(x => x.classList.toggle('on', x.dataset.saleCounter === k)); document.querySelectorAll('[data-f5c]').forEach(x => x.classList.toggle('on', x.dataset.f5c === k)); };
document.addEventListener('click', e => { const b = e.target.closest?.('[data-sale-counter]'); if (b) setCounter(b.dataset.saleCounter); });   // v2.57: F5 -> sirf '1 ya 2 print?'
let copies = 1; try { copies = Math.min(3, Math.max(1, Number(localStorage.getItem('sam-sale-copies')) || 1)); } catch {}   // v2.40: bill kitni dafa chhape (gate pass ek hi)
const copyChips = () => `<div class="sale-copies sale-counter"><small>🖨 Counter</small>${COUNTERS.map(([k, n]) => `<button type="button" data-sale-counter="${k}"${counter === k ? ' class="on"' : ''}>${n}</button>`).join('')}</div><div class="sale-copies"><small>🖨 Bill print</small>${[1, 2, 3].map(n => `<button type="button" data-sale-copies="${n}"${copies === n ? ' class="on"' : ''}>×${n}</button>`).join('')}<small class="sale-copies-h">gate pass ×1</small></div>`;
document.addEventListener('click', e => { const b = e.target.closest?.('[data-sale-copies]'); if (!b) return; copies = Number(b.dataset.saleCopies) || 1; try { localStorage.setItem('sam-sale-copies', String(copies)); } catch {} document.querySelectorAll('[data-sale-copies]').forEach(x => x.classList.toggle('on', Number(x.dataset.saleCopies) === copies)); });
let qtyFocusNext = false;   // v2.62: PC — nayi line ki tadad par cursor
const finePtr = window.matchMedia ? window.matchMedia('(pointer:fine)') : { matches: false };
function addItem(it, qtyPcs = 1) {
  lastAddAt = Date.now(); qtyFocusNext = true;
  noteHit(it.id);   // v1.75: ranking ke liye
  {
    cart.push({
      k: newKey(), id: it.id, code: it.code || '', name: it.name, pack: Number(it.pack) || 0,
      cName: it.cName || 'Ctn', uName: it.uName || 'Pcs', godam: Number(godam) || SALE_BRANCH,
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
function vbStart() {               // v2.71.0: DABA KAR BOLO — button dabe rahne tak sunta hai, chhorte hi line
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

function installSaleHooks() {
setSaleDelHook(key => {
  const i = cart.findIndex(l => l.k === key);
  if (i < 0) return;
  cart.splice(i, 1); cash = null; keepDraft(); rerender();
});
setSaleCartHook(() => cart.map(l => ({ key: l.k || (l.k = newKey()),
  item: { id: l.id, code: l.code, name: l.name, pack: Number(l.pack) || 0, cName: l.cName, uName: l.uName, rate: crateOf(l), rate2: Number(l.rate) || 0 },
  pcs: Number(l.pcs) || 0, ctn: Number(l.ctn) || 0 })));
setSaleFindHook(q => smartSearch(stock().items, q, 12));   // v1.75: smart search
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
  try { stopPosSales?.(); } catch {} stopPosSales = cloud.listenPosSales ? cloud.listenPosSales(day, b => { posSales = Array.isArray(b) ? b : []; }) : null;   // v2.64.1: POS ke bills
  stopSales = cloud.listenAppSales(day, list => {
    sales = list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); salesErr = '';
    const box = $('saleTodayBtn'); if (box) box.textContent = todayLabel();
    if ($('dialog')?.open && $('dialogTitle')?.textContent.startsWith('Aaj ki app sales')) openToday();
  }, e => { salesErr = e?.message || 'Load nahi hui'; stopSales = null; });
}
const statusText = s => s.status === 'done' ? `✓ Sale ${esc(s.saleNo || '')}${s.crvNo ? ' · ' + esc(s.crvNo) : ''}`
  : s.status === 'failed' ? `✕ Nahi bani: ${esc(s.error || '')}`
  : s.status === 'posting' ? '… PC bill bana raha hai' : '⏳ PC ka intezar';
const todayLabel = () => {
  const wait = sales.filter(s => s.status === 'new' || s.status === 'posting').length;
  return `📋 Aaj ki app sales (${num(sales.length)})${wait ? ' · ' + num(wait) + ' intezar mein' : ''}`;
};
function openToday() {
  const d = $('dialog'); if (!d) return;
  d.classList.remove('search-dialog');
  $('dialogTitle').textContent = `Aaj ki app sales (${num(sales.length)})`;
  $('dialogBody').innerHTML = salesErr ? `<p>${esc(salesErr)}</p>` : !sales.length ? '<p>Aaj app se koi sale nahi hui.</p>' :
    sales.map(s => `<details class="sale-hist">
      <summary><b>${s.mode === 'wholesale' ? 'Wholesale' : 'Counter'} · Rs ${num(s.total)}</b>
        <small>${esc(new Date(s.createdAt || 0).toLocaleTimeString('en-PK'))} · ${statusText(s)}</small></summary>
      <div style="overflow-x:auto"><table><thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Rs</th></tr></thead><tbody>
      ${(s.lines || []).map(l => `<tr><td>${esc(l.name)}</td><td>${qtyText(l)}</td><td>${num(l.rate)}</td><td>${num(r2(l.qty * l.rate))}</td></tr>`).join('')}
      </tbody></table></div>
      <p>Cash: Rs ${num(s.cash)}${s.mode === 'wholesale' && s.total - s.cash > 0 ? ' · Udhaar Rs ' + num(s.total - s.cash) : ''}${s.note ? ' · ' + esc(s.note) : ''}</p>
      ${s.status === 'done' ? `<button type="button" data-sale-reprint="${esc(s.id)}">🖨 Dobara print (kuch save nahi hoga)</button>` : ''}
    </details>`).join('');
  if (!d.open) d.showModal();
}
function qtyText(l) {
  const pk = Number(l.pack) || 0, q = Number(l.qty) || 0;
  if (pk > 1 && q >= pk) { const c = Math.floor(q / pk), p = r3(q - c * pk); return `${num(c)} ${esc(l.cName || 'Ctn')}${p ? ' + ' + num(p) : ''} (${num(q)})`; }
  return `${num(q)} ${esc(l.uName || 'Pcs')}`;
}

// ---------- screen ----------
export function renderSale() {
  installSaleHooks(); watchSales();
  const s = stock();
  const owner = isOwner();
  const total = cartTotal();
  // rate: mulazim ke liye hamesha POS ka rate
  if (!owner) cart.forEach(l => { const it = s.items.find(r => String(r.id) === String(l.id)); if (it) { setStd(l, it); l.edited = false; } });

  // v1.54: godam ke buttons hata diye — bill hamesha main branch se; line ke andar godam badla ja sakta hai
  $('summary').innerHTML = `<div class="stock-head sale-head" data-sale-root="1">
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
  let found = '';
  const camRow = `<div class="sale-camrow"><button type="button" class="sale-cam" data-sale-camera="1">📷 Scan</button><button type="button" class="sale-mic dm-btn" data-demand="1" title="Demand">📢</button><button type="button" class="sale-mic${vbOn ? ' on' : ''}" data-sale-mic="1" title="Daba kar bolo">${vbOn ? '🎤 Bolein…' : '🎤 Daba kar bolo'}</button><span class="stat-note">Naam likhein ya scan karein</span></div>`;
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
    const gsel = s.branches.length > 1 ? `<label>Godam<select data-sale-lg="${i}">${s.branches.map(b => `<option value="${b}"${b === lg ? ' selected' : ''}>${esc(s.branchName(b, s.names))}</option>`).join('')}</select></label>` : '';
    return `<div class="sale-line${i === cart.length - 1 && Date.now() - lastAddAt < 1800 ? ' fresh' : ''}" data-sale-line="${i}">
      <div class="sale-line-top"><b>${esc(l.name)}</b><button type="button" class="danger sale-x" data-sale-del="${i}" aria-label="Hatao">✕</button></div>
      <small>${esc(l.code)}${it ? ' · stock ' + num(it.stock) + ' (' + esc(s.branchName(lg, s.names)) + ')' : ''}${block ? ' · <b class="red">⛔ godam mein stock nahi — godam badlein</b>' : short ? ' · <span class="red">stock kam hai</span>' : ''}</small>
      <div class="sale-inputs">
        <label>${esc(l.uName)}<input type="number" min="0" step="any" inputmode="decimal" data-sale-pcs="${i}" value="${l.pcs || ''}"></label>
        ${Number(l.pack) > 1 ? `<label>${esc(l.cName)} (${num(l.pack)})<input type="number" min="0" step="1" inputmode="numeric" data-sale-ctn="${i}" value="${l.ctn || ''}"></label>` : ''}
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
  $('actions').innerHTML = cart.length ? `<button class="give" data-sale-clear="1">✕ Naya bill</button><button data-sale-camera="1" title="Barcode scan">📷</button>
    <button class="got" data-sale-save="1"${saving ? ' disabled' : ''}>${saving ? 'Save ho raha hai…' : '💾 Save + Print · Rs ' + num(total)}</button>` : '';
}
function dueText(due) {
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
  const b = document.querySelector('[data-sale-save]'); if (b && !saving) b.textContent = '💾 Save + Print · Rs ' + num(total);
}

// ---------- events ----------
document.addEventListener('input', e => {
  const t = e.target; if (!t.closest?.('#list')) return;
  let i;
  if ((i = t.dataset.saleCtn) != null) { cart[i].ctn = Math.max(0, Math.floor(Number(t.value) || 0)); cash = null; }
  else if ((i = t.dataset.salePcs) != null) { cart[i].pcs = Math.max(0, Number(t.value) || 0); cash = null; }
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
  if (mic) { if (!vbOn && !vbHold) notice('🎤 Button DABA KAR RAKHEIN, item bolein, phir chhor dein — line lag jayegi'); return; }   // v2.71.0: hold se chalta hai
  const t = e.target.closest?.('[data-sale-mode],[data-sale-godam],[data-sale-add],[data-sale-del],[data-sale-clear],[data-sale-save],[data-sale-today],[data-sale-reprint],[data-sale-camera]');
  if (!t) return;
  if (t.dataset.saleMode) {
    if (mode === t.dataset.saleMode) return;
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
  if (t.dataset.saleClear) { if (!confirm('Yeh bill saaf kar dein?')) return; cart = []; cash = null; note = ''; mode = 'counter'; keepDraft(); rerender(); return; }   // v2.63: Naya bill = Counter
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

async function save() {
  if (saving) return;
  // v1.61: carton aur khule piece ke rate alag hon to POS ko DO lines (unit 'ctn' / 'pcs'), warna ek line
  const lines = [];
  let emptyLines = 0;
  cart.forEach(l => {
    const base = { id: String(l.id), code: String(l.code || ''), name: String(l.name || ''), pack: Number(l.pack) || 0,
      cName: l.cName, uName: l.uName, godam: Number(l.godam) || Number(godam) || SALE_BRANCH };
    const cq = ctnPcsOf(l), pq = r3(Number(l.pcs) || 0), cr = r2(crateOf(l)), pr = r2(l.rate);
    if (!(cq + pq > 0)) { emptyLines++; return; }
    if (cq > 0 && pq > 0 && Math.abs(cr - pr) > 0.004) {
      lines.push({ ...base, unit: 'ctn', qty: cq, rate: cr, std: r2(l.cstd ?? l.std) });
      lines.push({ ...base, unit: 'pcs', qty: pq, rate: pr, std: r2(l.std) });
    } else if (cq > 0 && !(pq > 0)) lines.push({ ...base, unit: 'ctn', qty: cq, rate: cr, std: r2(l.cstd ?? l.std) });
    else if (!(cq > 0)) lines.push({ ...base, unit: 'pcs', qty: pq, rate: pr, std: r2(l.std) });
    else lines.push({ ...base, qty: r3(cq + pq), rate: pr, std: r2(l.std) });
  });
  if (!lines.length) { notice('Kisi item ki qty likhein'); return; }
  // v1.72: POS ka qanoon — GODAM (branch 1 NOOR TRADERS ke ilawa) mein stock tadad se kam ho to sale nahi (dukaan par rok nahi)
  const s2 = stock();
  const shortG = [];
  for (const l of cart) {
    const g = Number(l.godam) || Number(godam) || SALE_BRANCH;
    if (g === SALE_BRANCH) continue;
    const need = linePcs(l); if (!(need > 0)) continue;
    const it = itemIn(g, l.id);
    const have = it ? Number(it.stock) || 0 : 0;
    if (have < need - 0.0005) shortG.push(`${l.name}: ${s2.branchName(g, s2.names)} mein stock ${num(have)}, chahiye ${num(need)}`);
  }
  if (shortG.length) { alert('Godam mein stock kam hai — sale nahi ban sakti:\n\n' + shortG.join('\n') + '\n\nGodam badlein (NOOR TRADERS par rok nahi).'); return; }
  if (emptyLines && !confirm('Jin items ki qty khali hai woh bill mein nahi jayenge. Theek hai?')) return;
  if (lines.some(l => !(l.rate > 0)) && !confirm('Kisi item ka rate 0 hai. Phir bhi save karein?')) return;
  const total = r2(lines.reduce((n, l) => n + l.qty * l.rate, 0));
  let paid = r2(cashNow());
  if (mode === 'counter' && paid < total) { notice('Counter sale mein poora cash likhein (ya Wholesale chunein)'); return; }
  if (mode === 'counter') paid = total;                     // POS: counter sale ka CashReceived = bill
  if (paid > total) { notice('Cash bill se zyada nahi ho sakta'); return; }
  const msg = `${mode === 'wholesale' ? 'WHOLESALE' : 'COUNTER SALE'}\n${lines.length} items · Rs ${num(total)}` +
    (mode === 'wholesale' ? `\nCash Rs ${num(paid)}${total - paid > 0 ? ' · Udhaar Rs ' + num(total - paid) : ''}` : '') + '\n\nSave karke POS mein bill banayein?';
  if (!quickSave && !confirm(msg)) return;   // v2.57: F5 wala raasta pehle hi pooch chuka
  const id = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const doc = { id, copies, counter, date: todayStr(), at: new Date().toISOString(), mode, branch: SALE_BRANCH, godam: Number(godam) || SALE_BRANCH,
    lines, total, cash: paid, note: note.trim(), role: isOwner() ? 'owner' : 'staff', by: uidOf(), status: 'new', createdAt: Date.now() };
  saving = true; rerender();
  try {
    const p = cloud.saveAppSale(doc);
    // internet na ho to bhi phone par mehfooz; net aate hi chali jayegi
    await Promise.race([p, new Promise(r => setTimeout(r, 4000))]);
    cart = []; cash = null; note = ''; mode = 'counter'; keepDraft();   // v2.63: Wholesale bill ke baad wapas Counter
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
  box.innerHTML = `<div class="f5-card"><b>🖨 Kitne print?</b><small>${cart.length} items · Rs ${num(cartTotal())}</small><div class="f5-ctr">${COUNTERS.map(([k, n]) => `<button type="button" data-f5c="${k}"${counter === k ? ' class="on"' : ''}><kbd>${n[0]}</kbd> ${n}</button>`).join('')}</div><div class="f5-row">${[1, 2, 3].map(n => `<button type="button" data-f5="${n}"${n === copies ? ' class="on"' : ''}><span>${n}</span>print</button>`).join('')}</div><p>Counter: <kbd>A</kbd> <kbd>B</kbd> <kbd>M</kbd> · Print: <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> · <kbd>Enter</kbd> = ${copies} · <kbd>Esc</kbd> = wapas</p></div>`;
  document.body.appendChild(box);
  const done = n => {
    document.removeEventListener('keydown', key, true); box.remove();
    if (!n) return;
    copies = n; try { localStorage.setItem('sam-sale-copies', String(n)); } catch {}
    document.querySelectorAll('[data-sale-copies]').forEach(x => x.classList.toggle('on', Number(x.dataset.saleCopies) === n));
    const b = document.querySelector('[data-sale-save]'); if (!b || b.disabled) { notice('Save abhi nahi ho sakta'); return; }
    quickSave = true; setTimeout(() => { quickSave = false; }, 4000); b.click();
  };
  const key = ev => { const ck = { a: 'abdurehman', b: 'bilal', m: 'mithu' }[String(ev.key).toLowerCase()]; if (ck) { ev.preventDefault(); ev.stopPropagation(); setCounter(ck); return; } if (['1', '2', '3'].includes(ev.key)) { ev.preventDefault(); ev.stopPropagation(); done(Number(ev.key)); } else if (ev.key === 'Enter') { ev.preventDefault(); ev.stopPropagation(); done(copies); } else if (ev.key === 'Escape' || ev.key === 'F5') { ev.preventDefault(); ev.stopPropagation(); done(0); } };
  document.addEventListener('keydown', key, true);
  box.addEventListener('click', ev => { const cc = ev.target.closest('[data-f5c]'); if (cc) { setCounter(cc.dataset.f5c); return; } const t = ev.target.closest('[data-f5]'); if (t) done(Number(t.dataset.f5)); else if (ev.target === box) done(0); });
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
setSaleGodamHook(() => { const st = stock(); return { list: st.branches.map(b => ({ b, name: (st.branchName ? st.branchName(b, st.names) : '') || st.names?.[b] || ('Godam ' + b) })), cur: st.pick, set: b => { godam = Number(b); keepDraft(); rerender(); } }; });
setSaleBillsHook(() => {   // v2.68: dobara print usi counter par jo chuna hai
  const posByApp = new Map(posSales.filter(b => b.app).map(b => [b.app, b]));
  const app = sales.map(s => { const pb = posByApp.get(s.id); return pb && pb.x ? { ...s, cancelled: true } : s; });
  const pos = posSales.filter(b => !b.app).map(b => ({ id: 'pos-' + b.id, pos: true, saleNo: b.no, total: b.t, cash: b.cr ? b.c : b.t, mode: b.cr ? 'wholesale' : 'counter', status: 'done', cancelled: !!b.x, createdAt: b.tm, party: b.p, n: b.n }));
  return { list: [...app, ...pos].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)), reprint: id => { if (String(id).startsWith('pos-')) throw Error('POS bill'); return cloud.reprintAppSale(id, copies, counter); } };
});
