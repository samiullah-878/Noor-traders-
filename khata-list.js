// khata-list.js v1.0 (app v2.359.0, 23 Nov 2026) — 🖨 KHATON KI LIST ka thermal print
// Malik: "yahan par thermal print · supplier aur customer ka alehda · us par last entry ki date bhi likhi ho · ek taraf amount, upar date, aage amount ·
//   neeche total raqam · kharcha wala account list mein na aaye · same supplier ke liye · one click, three dots ke andar · default malik aur mulazim jo khata dekh sakte hain".
// Khata list ke ⋮ ke do chip -> WAHI khataPrints (j.k 'list') -> PC pos-khata-sync `listSlip`. Raqam PAISA. Kharcha / bank khate nahi, baqaya 0 wale nahi. AI NAHI.
const A = s => String(s ?? '').replace(/[^\x20-\x7e]/g, '').replace(/\s+/g, ' ').trim();
const dmy = d => { const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(String(d || '')); return m ? m[3] + '-' + m[2] + '-' + m[1].slice(2) : ''; };
// rows: [[naam, 'DD-MM-YY', aakhri entry ki raqam (paisa), baqaya (paisa: + lena / − dena)]] — bara baqaya upar
export function rowsOf(cat, parties, es, balance) {
  const last = new Map();
  for (const e of es) {
    if (!e || e.deleted || !e.partyId) continue;
    const o = last.get(e.partyId);
    if (!o || String(e.date || '') > String(o.date || '') || (String(e.date || '') === String(o.date || '') && (e.createdAt || 0) > (o.createdAt || 0))) last.set(e.partyId, e);
  }
  const R = [];
  for (const p of parties) {
    if (!p || p.category !== cat || p.kharcha || p.bank || p.active === false) continue;
    const b = Math.round(Number(balance(p, es)) || 0); if (Math.abs(b) < 100) continue;
    const e = last.get(p.id);
    R.push([A(p.name).slice(0, 40) || '?', e ? dmy(e.date) : '', e ? Math.round(Number(e.amount) || 0) : 0, b]);
  }
  R.sort((x, y) => Math.abs(y[3]) - Math.abs(x[3]));
  return R;
}
let busy = false;
export async function print(C) {
  if (busy) return; const cat = C.cat === 'Supplier' ? 'Supplier' : 'Customer', nm = cat === 'Supplier' ? 'Suppliers' : 'Customers';
  const R = rowsOf(cat, C.parties, C.es, C.balance);
  if (!R.length) { C.notice('🖨 ' + nm + ': baqaya wala koi khata nahi'); return; }
  const m = Math.max(1, Math.round(R.length * 0.9 + 12) / 100).toFixed(1);
  if (!confirm('🖨 ' + nm + ' ki list — ' + R.length + ' khate\n(kharcha khate shamil nahi)\n\nParchi taqreeban ' + m + ' meter. Dukan ke thermal printer par chhapein?')) return;
  busy = true; C.notice('⏳ ' + nm + ' ki list printer ko ja rahi hai…');
  try {
    const id = await C.cloud.requestKhataPrint({ j: JSON.stringify({ k: 'list', t: cat === 'Supplier' ? 's' : 'c', R }), name: nm + ' list', byName: C.name() });
    let done = false;
    const un = C.cloud.watchKhataPrint?.(id, x => { const st = x?.status; if (!st || st === 'new' || st === 'printing' || done) return; done = true; busy = false; try { un?.(); } catch {} C.notice(st === 'done' ? '✅ 🖨 ' + nm + ' ki list chhap gayi (' + R.length + ' khate)' : '✕ List nahi chhapi: ' + (x.err || st)); });
    setTimeout(() => { if (done) return; done = true; busy = false; try { un?.(); } catch {} C.notice('⚠️ 60 s mein PC ka jawab nahi aaya — shop PC / printer chal raha hai? (PC scripts ka 🖨 dabba dekhein)'); }, 60000);
  } catch (er) { busy = false; C.notice('❌ Print nahi gaya: ' + (er?.message || er)); }
}
