// po-formula.js — v2.99.29 (2026-10-11): 🛒 PURCHASE ORDER ka shaffaf FORMULA (AI andaza nahi — har qadam card par likha)
// Data: PC ki sales-stats v1.2 (posStats) — s30/s90/s180, w (hafte), mo (mahine), pt (mahine ke 4 hisse), ph (aakhri 12 purchase), lp
// Stock: sab godam jama (minus = 0). Malik: "pehle 10 din bikri zyada, phir kam, phir kam, 25 ke baad phir zyada".
//
//  1) Roz ki bikri  = 50% (30 din) + 30% (90 din) + 20% (6 mahine)       [jo khana khali ho us ka wazan baqi mein bant jata hai]
//  2) Mahine ka rujhan: 4 hisse (1-10, 11-20, 21-25, 26-31) — har hisse ka roz ka rate ÷ aam rate = index (item ka, data kam ho to dukan ka)
//  3) Kitne din chalega: aane wale har din ki bikri us din ke hisse ke index se — stock khatam hone tak din gino
//  4) Purchase ka tareeqa (ph): har kitne din (beech ke farq ka median) · aam tadad (sab se zyada dafa wali) · aakhri purchase
//  5) Order:  din baqi < (agla order aane tak = har kitne din) + bachat (3/5/7)  -> mangwao
//            tadad = (us muddat ki bikri, rujhan ke saath) − stock  -> carton mein poora -> aam tadad ke qareeb ho to aam tadad / us ke guna

export const PARTS = [[1, 10, '1–10'], [11, 20, '11–20'], [21, 25, '21–25'], [26, 31, '26–31']];
export const partOf = d => d <= 10 ? 0 : d <= 20 ? 1 : d <= 25 ? 2 : 3;
const r1 = n => Math.round((Number(n) || 0) * 10) / 10, r2 = n => Math.round((Number(n) || 0) * 100) / 100;
const dayStr = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const addD = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);

// 1) roz ki bikri (pieces)
export function dailyOf(s) {
  const parts = [[s?.s30, 30, 0.5], [s?.s90, 90, 0.3], [s?.s180, 182, 0.2]].filter(([q]) => Number(q) > 0);
  if (!parts.length) return 0;
  const W = parts.reduce((n, p) => n + p[2], 0);
  return parts.reduce((n, [q, d, w]) => n + (Number(q) / d) * (w / W), 0);
}
// 2) mahine ke hisson ka index
const clampIdx = v => Math.min(2.5, Math.max(0.4, v));
export function idxFrom(pt, ptDays) {
  if (!Array.isArray(pt) || !Array.isArray(ptDays) || ptDays.some(d => !(d > 0))) return null;
  const tot = pt.reduce((n, q) => n + (Number(q) || 0), 0), days = ptDays.reduce((n, d) => n + d, 0); if (!(tot > 0)) return null;
  const avg = tot / days; return pt.map((q, b) => clampIdx(((Number(q) || 0) / ptDays[b]) / avg));
}
export function shopIdx(items, meta) {
  const sum = [0, 0, 0, 0]; for (const s of items || []) if (Array.isArray(s.pt)) s.pt.forEach((q, b) => { sum[b] += Number(q) || 0; });
  return idxFrom(sum, meta?.ptDays) || [1, 1, 1, 1];
}
export function itemIdx(s, meta, shop) {
  const pt = s?.pt; if (!Array.isArray(pt)) return { idx: shop, own: false };
  const tot = pt.reduce((n, q) => n + (Number(q) || 0), 0), filled = pt.filter(q => q > 0).length;
  const mine = idxFrom(pt, meta?.ptDays);
  if (!mine || filled < 3 || tot < 20) return { idx: shop, own: false };   // data kam -> dukan ka rujhan
  return { idx: mine.map(r2), own: true };
}
// 3) aage ki bikri / kitne din
export function forecast(daily, idx, from, n) { let t = 0; for (let k = 0; k < n; k++) t += daily * idx[partOf(addD(from, k).getDate())]; return t; }
export function daysLeft(have, daily, idx, from, cap = 120) {
  if (!(daily > 0)) return cap; let left = have;
  for (let k = 0; k < cap; k++) { const need = daily * idx[partOf(addD(from, k).getDate())]; if (left < need) return r1(k + left / need); left -= need; }
  return cap;
}
// 4) purchase ka tareeqa (pieces)
export function buyPattern(s, meta) {
  const ph = (Array.isArray(s?.ph) ? s.ph : []).filter(x => Array.isArray(x) && x[0] && Number(x[1]) > 0);
  const party = i => String(meta?.parties?.[i] ?? '').trim();
  const last = ph[0] ? { d: ph[0][0], q: Number(ph[0][1]), r: Number(ph[0][2]) || 0, party: party(ph[0][3]) } : s?.lp ? { d: s.lp.d, q: Number(s.lp.q) || 0, r: Number(s.lp.r) || 0, party: s.lp.party || '' } : null;
  let gap = 0, aam = 0, aamN = 0;
  if (ph.length >= 3) {
    const g = []; for (let k = 0; k + 1 < ph.length; k++) { const x = daysBetween(ph[k + 1][0], ph[k][0]); if (x > 0) g.push(x); }
    if (g.length) { g.sort((a, b) => a - b); gap = g[Math.floor(g.length / 2)]; }
    const cnt = new Map(); for (const x of ph) { const q = Math.round(Number(x[1]) * 1000) / 1000; cnt.set(q, (cnt.get(q) || 0) + 1); }
    [aam, aamN] = [...cnt].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];   // sab se zyada dafa (barabar ho to chhoti)
  } else if (Number(s?.pn) > 1) gap = Math.round(182 / Number(s.pn));
  return { n: ph.length || Number(s?.pn) || 0, gap, aam, aamN, last, parties: [...new Set(ph.map(x => party(x[3])).filter(Boolean))] };
}
// 5) ek item ka poora hisaab
//   it: stock ka item {id,name,pack,cName,uName,gs:{godam:qty}}  s: posStats item  opts: {meta, shop, safety, today, dukan}
export function planItem(it, s, opts = {}) {
  const { meta = {}, shop = [1, 1, 1, 1], safety = 5, today = new Date(), dukan = '' } = opts;
  const pk = Number(it.pack) > 1 ? Number(it.pack) : 1, unit = pk > 1 ? (it.cName || 'Ctn') : (it.uName || 'Pcs'), U = q => r1(q / pk);
  const gs = it.gs || {}, minus = Object.entries(gs).filter(([, q]) => q < 0).map(([g, q]) => [g, U(q)]);
  const have = Object.values(gs).reduce((n, q) => n + Math.max(0, Number(q) || 0), 0) || Math.max(0, Number(it.stock) || 0);
  const daily = dailyOf(s), { idx, own } = itemIdx(s, meta, shop), left = daysLeft(have, daily, idx, today);
  const bp = buyPattern(s, meta), cycle = Math.min(30, Math.max(3, bp.gap || 7)), cover = cycle + safety;
  const needPcs = forecast(daily, idx, today, cover), flat = daily * cover;
  let q = Math.max(0, Math.ceil(((needPcs - have) / pk) - 1e-9)), why = '';
  const aamU = bp.aam ? U(bp.aam) : 0;
  if (q > 0 && aamU >= 1 && bp.aamN >= 3) {
    if (q <= aamU * 1.35) { why = `aam tadad ${aamU}`; q = Math.ceil(aamU); }
    else { const m = Math.max(1, Math.round(q / aamU)); why = `aam tadad ${aamU} × ${m}`; q = Math.ceil(aamU * m); }
  }
  const order = daily > 0 && left < cover && q > 0;
  // 🚚 dukan khali, godam mein para: order nahi — godam se mangwao
  let transfer = null;
  if (dukan && daily > 0) {
    const dk = Math.max(0, Number(gs[dukan]) || 0), dkLeft = daysLeft(dk, daily, idx, today), others = Object.entries(gs).filter(([g, v]) => g !== dukan && v > 0).sort((a, b) => b[1] - a[1]);
    if (dkLeft < 3 && others.length) {
      const want = Math.max(pk, forecast(daily, idx, today, safety + 3) - dk), [from, avail] = others[0];
      const t = Math.min(avail, Math.ceil(want / pk) * pk);
      if (t >= Math.min(pk, avail) && t > 0) transfer = { from, to: dukan, pcs: t, units: U(t), dkLeft };
    }
  }
  const mo = Array.isArray(s?.mo) ? s.mo.map(x => U(x)) : [];
  const trend = (() => { const w = (s?.w || []).map(Number); if (w.length < 8) return ''; const a = (w[0] + w[1] + w[2] + w[3]) / 4, b = (w[4] + w[5] + w[6] + w[7]) / 4; if (!(b > 0)) return a > 0 ? '↗' : ''; return a > b * 1.15 ? '↗ barh rahi' : a < b * 0.85 ? '↘ ghat rahi' : '→ barabar'; })();
  return {
    id: String(it.id), name: it.name, pk, unit, have: U(have), gs: Object.fromEntries(Object.entries(gs).map(([g, v]) => [g, U(v)])), minus,
    daily: r2(daily / pk), week: r1(daily * 7 / pk), month: r1(daily * 30 / pk), trend, idx, ownIdx: own, left, cycle, safety, cover,
    need: U(needPcs), flat: U(flat), q, why, order, transfer, bp: { ...bp, aam: aamU, last: bp.last ? { ...bp.last, q: U(bp.last.q), r: r2(bp.last.r) } : null },
    mo, thin: bp.n < 3, noSale: !(daily > 0),
  };
}
// card ke liye lines (shaffaf hisaab)
export function hisaabLines(h, meta = {}, today = new Date()) {
  const n = v => (Math.round(v * 10) / 10).toLocaleString('en-PK'), u = h.unit;
  const gsT = Object.entries(h.gs).map(([g, v]) => `${g} ${n(v)}`).join(' + ');
  const L = [];
  L.push(['📦 Stock', `${gsT || '0'} = <b>${n(h.have)} ${u}</b>${h.minus.length ? ` · <i class="bad">${h.minus.map(([g, v]) => g + ' ' + n(v)).join(', ')} (minus = 0 gina — transfer baqi?)</i>` : ''}`]);
  L.push(['📈 Bikri', `roz <b>${n(h.daily)}</b> · hafta ${n(h.week)} · mahina ${n(h.month)} ${u}${h.trend ? ' · ' + h.trend : ''}`]);
  if (h.mo.length && Array.isArray(meta.months)) L.push(['🗓 Mahine-war', meta.months.map((m, i) => `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m.slice(5)) - 1]}${i === meta.months.length - 1 ? ' (' + today.getDate() + ' din)' : ''} <b>${n(h.mo[i] || 0)}</b>`).join(' · ')]);
  L.push(['🌙 Mahine ka rujhan', PARTS.map(([, , lab], b) => `${lab} <b class="${h.idx[b] >= 1.1 ? 'up' : h.idx[b] <= 0.9 ? 'dn' : ''}">${Math.round(h.idx[b] * 100)}%</b>`).join(' · ') + (h.ownIdx ? '' : ' <i>(dukan ka aam — is item ka data kam)</i>')]);
  const bp = h.bp;
  L.push(['🛒 Purchase', bp.n ? `${bp.n} dafa${bp.gap ? ` · har ~${bp.gap} din` : ''}${bp.aam ? ` · aam tadad <b>${n(bp.aam)} ${u}</b>${bp.aamN ? ' (' + bp.aamN + ' dafa)' : ''}` : ''}${bp.parties.length > 1 ? ' · ' + bp.parties.slice(0, 3).join(' / ') : ''}` : '<i>purani purchase nahi mili</i>']);
  if (bp.last) L.push(['🧾 Aakhri', `${bp.last.d} · ${bp.last.party || '—'} · ${n(bp.last.q)} ${u}${bp.last.r ? ' · POS rate Rs ' + n(bp.last.r) : ''}`]);
  L.push(['⏳ Chalega', `<b>${n(h.left)} din</b> (rujhan ke saath)`]);
  L.push(['🧮 Hisaab', `agla order ~${h.cycle} din + bachat ${h.safety} = <b>${h.cover} din</b> ki bikri ${n(h.need)}${Math.abs(h.need - h.flat) >= 0.5 ? ` (seedha ${n(h.flat)})` : ''} − stock ${n(h.have)} = ${n(Math.max(0, h.need - h.have))} → <b>${h.q} ${u}</b>${h.why ? ' (' + h.why + ')' : ''}`]);
  if (!h.order) L.push(['✅', h.noSale ? 'bikri nahi — order nahi' : `${n(h.left)} din chalega — abhi order ki zaroorat nahi`]);
  if (h.transfer) L.push(['🚚', `${h.transfer.to} mein ${n(h.transfer.dkLeft)} din ka — ${h.transfer.from} se <b>${n(h.transfer.units)} ${u}</b> mangwao`]);
  if (h.thin) L.push(['⚠️', 'purchase ka data kam (3 se kam) — tadad sirf bikri se']);
  return L;
}
export const _poTest = { dayStr, daysBetween, addD };
