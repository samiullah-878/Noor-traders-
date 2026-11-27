// =========================================================
//  oc-naam.js  v1.0 (2026-11-27, malik: 'Sab cameras ke layout mein jab bill ban raha ho tab naam sahi nahi aa raha' · 'PC se poori list wala kaam')
//  Live counter khane ke OCR naam -> POS ka ASAL item naam. Counter NT-PRINT POS screen ki tasveer par Windows ka OCR chalata hai (posLive/<naam>__ocr);
//  OCR kuch harf ghalat parhta hai — grid ki qatar mein neeche ki dum kat jati hai: 'g' -> 'a' (ghee = ahee), 'j' -> 'i' (mujahid = muihid), '1' -> 'l'
//  (1kg = lka); kabhi pehla harf kat jata hai; POS ke upar koi aur khirki ho to us ki likhai. Yahan har qatar ko POS ki POORI item list (dbo.Items, stock 0
//  wale bhi) se harf-jor (bigram Dice, upar wali ghaltiyan dono taraf barabar kar ke) se milate hain: pakka mile = [asal naam, %], na mile = 0.
//  pos-sales-dekho (server) bulata hai, nateeja posLive/<naam>.oc {qatar ki chaabi: [naam, %] | 0} — app (live.js) WAHI chaabi (ocKey) se jorti hai.
//  AI nahi, internet nahi, POS mein kuch nahi likhta (sirf SELECT pos-sales-dekho karta hai).
// =========================================================
'use strict';
const UNIT = new Set(['kg', 'kgs', 'g', 'gm', 'gms', 'gram', 'grams', 'gr', 'grm', 'ml', 'l', 'lt', 'ltr', 'litre', 'liter', 'lb', 'mg', 'kilo']);
const DROP = new Set(['pcs', 'pc', 'ctn', 'ctns', 'carton', 'cartons', 'pack', 'packs', 'pkt', 'dz', 'doz', 'dozen', 'each', 'unit', 'nos', 'rs', 'qty', 'x']);
const MAXKEY = 140;

// qatar ki chaabi — app live.js ocKey HUBAHU (ek badlo to doosra bhi): har lafz ki likhai, chhote harf, ek space
function rowKey(row) {
  return (Array.isArray(row) && Array.isArray(row[2]) ? row[2] : []).map(w => String((w && w[2]) ?? '')).join(' ').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, MAXKEY);
}
// OCR jaisi ghaltiyan dono taraf barabar: neeche ki dum kati (g q -> a · j -> i · y -> v · p -> o), 1 l i | ! -> i, 0 -> o, rn -> m, vv -> w
function fold(s) {
  return String(s || '').toLowerCase().replace(/rn/g, 'm').replace(/vv/g, 'w')
    .replace(/[gq]/g, 'a').replace(/j/g, 'i').replace(/y/g, 'v').replace(/p/g, 'o')
    .replace(/[il1|!]/g, 'i').replace(/0/g, 'o').replace(/[^a-z0-9 ]+/g, '').replace(/\s+/g, ' ').trim();
}
// lafz -> milane wali likhai: '900 gm' = '900gm'; khali hindse (tadad / rate / raqam / code) aur unit ke lafz (pcs, ctn…) bahar
function tokens(words) {
  const out = [], nums = [];
  for (let i = 0; i < words.length; i++) {
    const w = String(words[i] || '').toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9/]+$/g, '');
    if (!w) continue;
    const nx = String(words[i + 1] || '').toLowerCase().replace(/[^a-z]/g, '');
    if (/^\d+([.,]\d+)?$/.test(w) && UNIT.has(nx)) { out.push(w.replace(',', '.') + nx); i++; continue; }
    if (/^[\d.,\-/]+$/.test(w)) { const n = w.replace(/,/g, ''); if (/^\d+(\.\d+)?$/.test(n)) nums.push(String(Number(n))); continue; }
    if (DROP.has(w)) continue;
    out.push(w);
  }
  return { t: out.join(' '), nums };
}
function grams(s) { const p = ' ' + s + ' ', g = new Set(); for (let i = 0; i < p.length - 1; i++) g.add(p.slice(i, i + 2)); return g; }

// items: [{id, n: naam}] -> index (bigram -> items)
function index(items) {
  const L = [], seen = new Set(), inv = new Map();
  for (const it of items || []) {
    const n = String((it && it.n) || '').replace(/\s+/g, ' ').trim(); if (!n) continue;
    const tk = tokens(n.split(' ')), f = fold(tk.t); if (f.replace(/ /g, '').length < 3 || seen.has(f)) continue;
    seen.add(f);
    const g = grams(f), i = L.length;
    L.push({ id: it.id, n, gs: g.size, nums: tk.nums });
    for (const x of g) { let a = inv.get(x); if (!a) inv.set(x, a = []); a.push(i); }
  }
  return { L, inv, cnt: new Uint16Array(L.length), cache: new Map() };
}

// ek qatar [y, h, [[x, w, 'lafz'], ...]] -> [asal naam, %] ya 0 (pakka nahi). Nateeja qatar ki likhai se yaad (OCR har second wahi qataren bhejta hai).
function matchRow(ix, row) {
  const key = rowKey(row); if (!key) return 0;
  if (ix.cache.has(key)) return ix.cache.get(key);
  const words = (Array.isArray(row) && Array.isArray(row[2]) ? row[2] : []).map(w => String((w && w[2]) ?? ''));
  const tk = tokens(words), f = fold(tk.t);
  let res = 0;
  if (f.replace(/ /g, '').length >= 4 && ix.L.length) {
    const B = grams(f), cnt = ix.cnt, touched = [];
    for (const g of B) { const a = ix.inv.get(g); if (!a) continue; for (const i of a) { if (!cnt[i]) touched.push(i); cnt[i]++; } }
    const top = [];
    for (const i of touched) {
      const s = 2 * cnt[i] / (B.size + ix.L[i].gs); cnt[i] = 0;
      if (top.length < 6 || s > top[top.length - 1][0]) { top.push([s, i]); top.sort((a, b) => b[0] - a[0]); if (top.length > 6) top.pop(); }
    }
    // naam ka khali hindsa (jaise 'Supreme 20') qatar mein bhi ho = thora upar (sirf barabar walon mein faisla)
    const rn = new Set(tk.nums);
    for (const t of top) { const it = ix.L[t[1]]; if (it.nums.length && it.nums.every(n => rn.has(n))) t[0] += 0.03; }
    top.sort((a, b) => b[0] - a[0]);
    const [b1, b2] = [top[0], top[1]];
    if (b1) {
      const s1 = b1[0], s2 = b2 ? b2[0] : 0, same = b2 && ix.L[b2[1]].n.toLowerCase() === ix.L[b1[1]].n.toLowerCase();
      const need = f.replace(/ /g, '').length < 8 ? 0.75 : 0.55;   // chhoti likhai ('Total', 'Recent') = kaafi pakka mel chahiye
      if (s1 >= need && (s1 - s2 >= 0.05 || s1 >= 0.82 || same)) res = [ix.L[b1[1]].n.slice(0, 60), Math.min(100, Math.round(s1 * 100))];
    }
  }
  if (ix.cache.size > 3000) for (const k of [...ix.cache.keys()].slice(0, 1000)) ix.cache.delete(k);
  ix.cache.set(key, res);
  return res;
}
// poori OCR (qataren) -> {chaabi: [naam, %] | 0}
function mapRows(ix, rows) {
  const m = {};
  for (const r of Array.isArray(rows) ? rows : []) { const k = rowKey(r); if (!k || k in m) continue; m[k] = matchRow(ix, r); }
  return m;
}
module.exports = { VER: '1.0', rowKey, fold, tokens, index, matchRow, mapRows };
