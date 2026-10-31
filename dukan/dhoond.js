// dhoond.js — v2.160.0 (31 Oct 2026): 🔍 SMART DHOONDO — app (web-dukan.js) + website (dukan.js) dono yahi
//   Malik: "search smart nahi" (DaDalDaD likha → "nahi mila"). AI NAHI — foran, phone par hi.
//   ① spelling ka farq nahi: daal / dal / dhal · cheeni / chini · chawal / chaval · aa ee oo · double harf · jagah (kalimirch = kali mirch)
//   ② English ↔ Urdu naam: sugar = cheeni, rice = chawal, chilli = mirch …  ③ Urdu keyboard: دال → daal
//   ④ kuch na mile to "Shayad ye:" — sab se qareeb wale (ghalat typing par bhi khali screen nahi)

// Urdu harf → Roman (chhote zer / zabar nahi hote — "skeleton" milan se kaafi)
const UR = { 'ا': 'a', 'آ': 'a', 'أ': 'a', 'ب': 'b', 'پ': 'p', 'ت': 't', 'ٹ': 't', 'ث': 's', 'ج': 'j', 'چ': 'ch', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ڈ': 'd', 'ذ': 'z', 'ر': 'r', 'ڑ': 'r', 'ز': 'z', 'ژ': 'z',
  'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'z', 'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'q', 'ک': 'k', 'ك': 'k', 'گ': 'g', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ں': 'n', 'ہ': 'h', 'ھ': 'h', 'ۃ': 'h', 'ة': 'h',
  'ی': 'i', 'ي': 'i', 'ے': 'e', 'ۓ': 'e', 'ئ': 'i', 'ؤ': 'o', 'ء': '', '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9' };
function roman(s) {
  let o = '', p = '';
  for (const ch of String(s || '')) {
    if (ch === 'و') o += (p === 'ا' || p === 'آ' || p === '' || p === ' ') ? 'w' : 'o';   // چاول = chawal (w) · دودھ = dodh (o)
    else if (ch in UR) o += UR[ch];
    else o += ch;
    p = ch;
  }
  return o;
}
const low = s => roman(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/(\d)([a-z])/g, '$1 $2').replace(/([a-z])(\d)/g, '$1 $2').trim();   // "1kg" = "1 kg"
const DG = w => w.replace(/ph/g, 'f').replace(/kh/g, 'k').replace(/gh/g, 'g').replace(/sh/g, 's').replace(/ch/g, 'c').replace(/th/g, 't').replace(/dh/g, 'd').replace(/bh/g, 'b').replace(/jh/g, 'j').replace(/ck/g, 'k')
  .replace(/q/g, 'k').replace(/w/g, 'v').replace(/z/g, 'j').replace(/x/g, 'ks').replace(/y/g, 'i');
// do "chaabi": k2 = awaz (aa=a, ee=e=i, oo=o=u, dohre harf ek — daal = dal = dhal) · k1 = sirf consonant (ghalat vowel par bhi)
const K2 = new Map(), K1 = new Map();
export function k2(w) { let r = K2.get(w); if (r != null) return r; r = /^\d/.test(w) ? w : DG(w).replace(/e/g, 'i').replace(/o/g, 'u').replace(/(.)\1+/g, '$1'); if (K2.size > 20000) K2.clear(); K2.set(w, r); return r; }
export function sk(w) { let r = K1.get(w); if (r != null) return r; const s = k2(w); r = /^\d/.test(s) ? s : (s[0] + s.slice(1).replace(/[aiu]/g, '')).replace(/(.)\1+/g, '$1'); if (K1.size > 20000) K1.clear(); K1.set(w, r); return r; }
function lev(a, b) {   // kitne harf ka farq (chhota)
  if (a === b) return 0; const m = a.length, n = b.length; if (!m || !n) return m || n;
  let pr = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) { const cu = [i]; for (let j = 1; j <= n; j++) cu[j] = Math.min(pr[j] + 1, cu[j - 1] + 1, pr[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); pr = cu; }
  return pr[n];
}
// ek jaise lafz (pehla = asal naam) — awaz se milte hain, is liye spelling ki fikr nahi
const SYN = [
  ['cheeni', 'sugar', 'shakar', 'khand'], ['chawal', 'rice'], ['daal', 'lentil', 'lentils', 'pulse', 'pulses'], ['mirch', 'mirchi', 'chilli', 'chili', 'chilly', 'pepper'],
  ['namak', 'salt'], ['atta', 'flour'], ['tel', 'oil'], ['sabun', 'soap'], ['chai', 'tea', 'patti'], ['doodh', 'milk'], ['ilaichi', 'elaichi', 'cardamom'],
  ['zeera', 'jeera', 'cumin'], ['haldi', 'turmeric'], ['chana', 'channa', 'gram', 'chickpea', 'chickpeas'], ['badam', 'almond', 'almonds'], ['kaju', 'cashew', 'cashews'],
  ['kishmish', 'raisin', 'raisins'], ['akhrot', 'walnut', 'walnuts'], ['pista', 'pistachio', 'pistachios'], ['mungphali', 'peanut', 'peanuts', 'moongphali'], ['anday', 'anda', 'egg', 'eggs'],
  ['surf', 'detergent', 'washing'], ['machis', 'matchbox', 'match'], ['dahi', 'yogurt', 'yoghurt'], ['shehad', 'honey'], ['sirka', 'vinegar'], ['makhan', 'butter'], ['dhania', 'coriander'],
  ['saunf', 'fennel'], ['laung', 'clove', 'cloves'], ['darchini', 'cinnamon'], ['kalonji', 'nigella'], ['til', 'sesame'], ['sooji', 'suji', 'semolina'],
  ['khajoor', 'dates'], ['sharbat', 'syrup'], ['manjan', 'toothpaste'], ['biscuit', 'biscuits', 'biskut'], ['nimko', 'namkeen', 'namkin'], ['shampoo', 'shampu', 'shampo']
];
const CAN = new Map();
for (const g of SYN) { const c = k2(g[0]); for (const w of g) { const k = k2(w); if (k.length >= 2 && !CAN.has(k)) CAN.set(k, c); } }
const can = k => CAN.get(k) || k;

// har item ka ek dafa bana hua "pata" (naam + rack ka naam)
const IDX = new Map();
function grams(s) { const g = new Set(); for (let i = 0; i < s.length - 1; i++) g.add(s.slice(i, i + 2)); return g; }
function entry(id, text) {
  let e = IDX.get(id); if (e && e.t === text) return e;
  const raw = low(text).split(' ').filter(Boolean), w2 = raw.map(k2), w1 = raw.map(sk);
  e = { t: text, raw, w2: [...new Set([...w2, ...w2.map(can)])], w1, rawJ: raw.join(''), k1J: w1.join(''), big: [grams(w1.join('')), ...w1.filter(k => k.length > 1).map(grams)] };
  if (IDX.size > 20000) IDX.clear(); IDX.set(id, e); return e;
}
function tokScore(e, t) {   // 0 = seedha · 0.5 = awaz se (dal = daal) · 1 = spelling farq · 2 = andar kahin · -1 = nahi
  if (e.raw.some(w => w.startsWith(t))) return 0;
  if (/^\d/.test(t)) return e.rawJ.includes(t) ? 1 : -1;
  const a = k2(t), ac = can(a);
  if (a.length >= 2 && e.w2.some(w => w.startsWith(a) || w.startsWith(ac))) return 0.5;
  const b = sk(t);
  if (b.length >= 2) { const lim = a.length <= 4 ? 1 : a.length <= 7 ? 2 : 3;   // consonant mile + thora sa vowel farq (chana ≠ cheeni)
    for (let i = 0; i < e.w1.length; i++) if (e.w1[i].startsWith(b) && lev(a, k2(e.raw[i]).slice(0, a.length)) <= lim) return 1; }
  if (t.length >= 3 && e.rawJ.includes(t)) return 1;
  if (b.length >= 4 && e.k1J.includes(b)) return 2;
  return -1;
}
// L = items, textOf(it) = jis mein dhoondna hai, idOf(it) = pakka id
// wapas: { hits, near } — hits = mile · near = "Shayad ye" (kuch na mile / 3 se kam mile to qareeb wale)
export function smartFind(L, q, textOf, idOf, max = 400) {
  const toks = low(q).split(' ').filter(Boolean);
  if (!toks.length) return { hits: L.slice(), near: [] };
  const out = [];
  for (const it of L) {
    const e = entry(idOf(it), textOf(it)); let s = 0, ok = true;
    for (const t of toks) { const v = tokScore(e, t); if (v < 0) { ok = false; break; } s += v; }
    if (ok) out.push([s + (e.raw[0] && e.raw[0].startsWith(toks[0]) ? 0 : 0.25), it]);
  }
  const hits = out.sort((a, b) => a[0] - b[0]).slice(0, max).map(x => x[1]);
  if (hits.length >= 3) return { hits, near: [] };
  const qg = grams(toks.map(sk).join('')); if (!qg.size) return { hits, near: [] };
  const got = new Set(hits), near = [];
  for (const it of L) { if (got.has(it)) continue; const e = entry(idOf(it), textOf(it)); let d = 0;
    for (const g of e.big) { if (!g.size) continue; let c = 0; for (const x of qg) if (g.has(x)) c++; d = Math.max(d, 2 * c / (qg.size + g.size)); }
    if (d >= 0.5) near.push([d, it]); }
  return { hits, near: near.sort((a, b) => b[0] - a[0]).slice(0, 24).map(x => x[1]) };
}
